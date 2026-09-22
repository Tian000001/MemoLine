"""事件服务：事件 CRUD、筛选搜索、媒体/聊天记录关联与聊天文本解析。

对应原 `server/modules/events/events.service.ts`。
"""

from __future__ import annotations

import json
import uuid
from typing import Any, List, Optional, Sequence

from ..db import get_db
from ..errors import NotFoundError
from ..schemas import (
    ChatRecord,
    CreateEventRequest,
    EventDetail,
    EventItem,
    EventListResponse,
    EventMedia,
    ParseChatRecordResponse,
    UpdateEventRequest,
)
from ..utils.chat_parser import parse_chat_text
from ..utils.timeutil import now_iso
from .links_service import get_links_for_event


def _load_tags(raw: Any) -> List[str]:
    if isinstance(raw, list):
        return raw
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return []
    return parsed if isinstance(parsed, list) else []


def _build_where(
    keyword: Optional[str],
    location: Optional[str],
    tag: Optional[str],
    start_time: Optional[str],
    end_time: Optional[str],
    event_type: Optional[str] = None,
) -> tuple[str, List[Any]]:
    """构造 WHERE 子句与参数（列名带 e. 前缀，需配合 FROM events e）。"""
    clauses: List[str] = []
    params: List[Any] = []

    if keyword:
        like = f"%{keyword}%"
        clauses.append("(e.description LIKE ? OR e.location LIKE ?)")
        params.extend([like, like])

    if location:
        clauses.append("e.location LIKE ?")
        params.append(f"%{location}%")

    if tag:
        clauses.append(
            "exists (select 1 from json_each(e.tags) where json_each.value = ?)"
        )
        params.append(tag)

    if event_type:
        clauses.append("e.event_type = ?")
        params.append(event_type)

    if start_time:
        clauses.append("e.event_time >= ?")
        params.append(start_time)

    if end_time:
        clauses.append("e.event_time <= ?")
        params.append(end_time)

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params


def list_events(
    *,
    page: int = 1,
    page_size: int = 20,
    keyword: Optional[str] = None,
    location: Optional[str] = None,
    tag: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    event_type: Optional[str] = None,
) -> EventListResponse:
    page = page if page and page > 0 else 1
    page_size = page_size if page_size and page_size > 0 else 20
    offset = (page - 1) * page_size

    where, params = _build_where(
        keyword, location, tag, start_time, end_time, event_type
    )

    sql = (
        "SELECT e.id, e.event_time, e.location, e.description, e.tags, e.event_type, "
        "       e.created_at, e.updated_at, "
        "       (SELECT COUNT(*) FROM event_media m WHERE m.event_id = e.id) AS media_count, "
        "       (SELECT COUNT(*) FROM event_chat_records c WHERE c.event_id = e.id) AS chat_count, "
        "       (SELECT COUNT(*) FROM event_links l "
        "        WHERE l.from_event = e.id OR l.to_event = e.id) AS link_count "
        "FROM events e" + where + " ORDER BY e.event_time DESC LIMIT ? OFFSET ?"
    )
    count_sql = "SELECT COUNT(*) AS total FROM events e" + where

    with get_db() as conn:
        rows = conn.execute(sql, [*params, page_size, offset]).fetchall()
        total = conn.execute(count_sql, params).fetchone()["total"]

    items: List[EventItem] = [
        EventItem(
            id=row["id"],
            eventTime=row["event_time"],
            location=row["location"],
            description=row["description"],
            tags=_load_tags(row["tags"]),
            eventType=row["event_type"] or "记事",
            mediaCount=row["media_count"],
            chatRecordCount=row["chat_count"],
            linkCount=row["link_count"],
            createdAt=row["created_at"],
            updatedAt=row["updated_at"],
        )
        for row in rows
    ]

    return EventListResponse(items=items, total=total, page=page, pageSize=page_size)


def get_event(event_id: str) -> EventDetail:
    with get_db() as conn:
        event_row = conn.execute(
            "SELECT * FROM events WHERE id = ? LIMIT 1", (event_id,)
        ).fetchone()
        if event_row is None:
            raise NotFoundError("事件不存在")

        media_rows = conn.execute(
            "SELECT * FROM event_media WHERE event_id = ? ORDER BY created_at ASC",
            (event_id,),
        ).fetchall()
        chat_rows = conn.execute(
            "SELECT * FROM event_chat_records WHERE event_id = ? "
            "ORDER BY send_time ASC, created_at ASC",
            (event_id,),
        ).fetchall()

    media: List[EventMedia] = [
        EventMedia(
            id=m["id"],
            eventId=m["event_id"],
            mediaType=m["media_type"],
            filePath=m["file_path"],
            fileUrl=m["file_url"] or "",
            fileName=m["file_name"],
            fileSize=m["file_size"],
        )
        for m in media_rows
    ]

    chat_records: List[ChatRecord] = [
        ChatRecord(
            id=c["id"],
            eventId=c["event_id"],
            sender=c["sender"],
            content=c["content"],
            sendTime=c["send_time"],
        )
        for c in chat_rows
    ]

    links = get_links_for_event(event_id)

    return EventDetail(
        id=event_row["id"],
        eventTime=event_row["event_time"],
        location=event_row["location"],
        description=event_row["description"],
        tags=_load_tags(event_row["tags"]),
        eventType=(event_row["event_type"] if "event_type" in event_row.keys() else None)
        or "记事",
        mediaCount=len(media),
        chatRecordCount=len(chat_records),
        linkCount=len(links),
        createdAt=event_row["created_at"],
        updatedAt=event_row["updated_at"],
        media=media,
        chatRecords=chat_records,
        links=links,
    )


def create_event(dto: CreateEventRequest) -> EventDetail:
    now = now_iso()
    event_id = str(uuid.uuid4())

    chat_from_text = (
        parse_chat_text(dto.chatRecordText).records if dto.chatRecordText else []
    )

    all_chat: List[dict] = [
        {
            "sender": r.sender,
            "content": r.content,
            "sendTime": r.sendTime or None,
        }
        for r in (dto.chatRecords or [])
    ] + [
        {"sender": r.sender, "content": r.content, "sendTime": r.sendTime or None}
        for r in chat_from_text
    ]

    with get_db() as conn:
        conn.execute(
            "INSERT INTO events (id, event_time, location, description, tags, "
            "event_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                event_id,
                dto.eventTime,
                dto.location or None,
                dto.description,
                json.dumps(dto.tags or [], ensure_ascii=False),
                dto.eventType or "记事",
                now,
                now,
            ),
        )

        if dto.media:
            conn.executemany(
                "INSERT INTO event_media (id, event_id, media_type, file_path, "
                "file_url, file_name, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (
                        str(uuid.uuid4()),
                        event_id,
                        m.mediaType,
                        # file_path 为 NOT NULL；前端上传后只回传 fileUrl，
                        # 因此缺省时回退到 fileUrl（与原实现一致）。
                        m.filePath or m.fileUrl or "",
                        m.fileUrl or None,
                        m.fileName or None,
                        m.fileSize,
                        now,
                    )
                    for m in dto.media
                ],
            )

        if all_chat:
            conn.executemany(
                "INSERT INTO event_chat_records (id, event_id, sender, content, "
                "send_time, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                [
                    (
                        str(uuid.uuid4()),
                        event_id,
                        r["sender"],
                        r["content"],
                        r["sendTime"],
                        now,
                    )
                    for r in all_chat
                ],
            )

    return get_event(event_id)


def update_event(event_id: str, dto: UpdateEventRequest) -> EventDetail:
    sets: List[str] = []
    params: List[Any] = []

    if dto.eventTime is not None:
        sets.append("event_time = ?")
        params.append(dto.eventTime)
    if dto.location is not None:
        sets.append("location = ?")
        params.append(dto.location)
    if dto.description is not None:
        sets.append("description = ?")
        params.append(dto.description)
    if dto.tags is not None:
        sets.append("tags = ?")
        params.append(json.dumps(dto.tags, ensure_ascii=False))
    if dto.eventType is not None:
        sets.append("event_type = ?")
        params.append(dto.eventType)

    if not sets:
        return get_event(event_id)

    sets.append("updated_at = ?")
    params.append(now_iso())
    params.append(event_id)

    with get_db() as conn:
        cursor = conn.execute(
            "UPDATE events SET " + ", ".join(sets) + " WHERE id = ?", params
        )
        if cursor.rowcount == 0:
            raise NotFoundError("事件不存在")

    return get_event(event_id)


def delete_event(event_id: str) -> None:
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM events WHERE id = ?", (event_id,))
        if cursor.rowcount == 0:
            raise NotFoundError("事件不存在")


def parse_chat(text: str) -> ParseChatRecordResponse:
    return parse_chat_text(text)


def fetch_events_by_ids(event_ids: Sequence[str]) -> List[dict]:
    """给分析模块复用：按 id 列表取事件行（原始 dict）。"""
    ids = list(event_ids)
    if not ids:
        return []
    placeholders = ",".join("?" for _ in ids)
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM events WHERE id IN (" + placeholders + ") "
            "ORDER BY event_time ASC",
            ids,
        ).fetchall()
    return [dict(row) for row in rows]


__all__ = [
    "list_events",
    "get_event",
    "create_event",
    "update_event",
    "delete_event",
    "parse_chat",
    "fetch_events_by_ids",
]
