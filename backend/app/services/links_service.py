"""事件关联（links）服务。

事件之间可建立 引用(reference) / 因果(causal) / 反驳(refute) 三种有向关系；
查询按双向展开（本事件发起 out / 指向本事件 in），并附带对方事件摘要。
"""

from __future__ import annotations

import uuid
from typing import List, Optional

from ..db import get_db
from ..errors import BadRequestError, NotFoundError
from ..schemas import CreateLinkRequest, EventLinkItem, LinkRelatedEvent
from ..utils.timeutil import now_iso


def _related_summary(conn, event_id: str) -> Optional[LinkRelatedEvent]:
    row = conn.execute(
        "SELECT id, event_time, event_type, description, location "
        "FROM events WHERE id = ? LIMIT 1",
        (event_id,),
    ).fetchone()
    if row is None:
        return None
    return LinkRelatedEvent(
        id=row["id"],
        eventTime=row["event_time"],
        eventType=(row["event_type"] if "event_type" in row.keys() else None) or "记事",
        description=row["description"],
        location=row["location"],
    )


def get_links_for_event(event_id: str) -> List[EventLinkItem]:
    """查询某事件的全部关联（双向），按创建时间正序。"""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM event_links WHERE from_event = ? OR to_event = ? "
            "ORDER BY created_at ASC",
            (event_id, event_id),
        ).fetchall()

        items: List[EventLinkItem] = []
        for r in rows:
            if r["from_event"] == event_id:
                direction = "out"
                other_id = r["to_event"]
            else:
                direction = "in"
                other_id = r["from_event"]

            related = _related_summary(conn, other_id)
            if related is None:
                # 对方事件已被删除（外键级联通常会清掉本行，这里兜底跳过）
                continue

            items.append(
                EventLinkItem(
                    id=r["id"],
                    fromEvent=r["from_event"],
                    toEvent=r["to_event"],
                    relation=r["relation"],
                    note=r["note"],
                    createdAt=r["created_at"],
                    direction=direction,
                    relatedEvent=related,
                )
            )
    return items


def create_link(dto: CreateLinkRequest) -> EventLinkItem:
    if dto.fromEvent == dto.toEvent:
        raise BadRequestError("不能将事件关联到自己")

    now = now_iso()
    link_id = str(uuid.uuid4())

    with get_db() as conn:
        for eid in (dto.fromEvent, dto.toEvent):
            exists = conn.execute(
                "SELECT 1 FROM events WHERE id = ? LIMIT 1", (eid,)
            ).fetchone()
            if not exists:
                raise NotFoundError("关联的事件不存在")

        dup = conn.execute(
            "SELECT 1 FROM event_links WHERE from_event = ? AND to_event = ? "
            "AND relation = ? LIMIT 1",
            (dto.fromEvent, dto.toEvent, dto.relation),
        ).fetchone()
        if dup:
            raise BadRequestError("该关联关系已存在")

        conn.execute(
            "INSERT INTO event_links (id, from_event, to_event, relation, note, "
            "created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (link_id, dto.fromEvent, dto.toEvent, dto.relation, dto.note or None, now),
        )

    # 返回刚创建的这条（含对方事件摘要）
    for item in get_links_for_event(dto.fromEvent):
        if item.id == link_id:
            return item

    # 理论不可达；兜底直接构造
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM event_links WHERE id = ? LIMIT 1", (link_id,)
        ).fetchone()
        related = _related_summary(conn, row["to_event"])
        assert related is not None
        return EventLinkItem(
            id=row["id"],
            fromEvent=row["from_event"],
            toEvent=row["to_event"],
            relation=row["relation"],
            note=row["note"],
            createdAt=row["created_at"],
            direction="out",
            relatedEvent=related,
        )


def delete_link(link_id: str) -> None:
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM event_links WHERE id = ?", (link_id,))
        if cursor.rowcount == 0:
            raise NotFoundError("关联不存在")


__all__ = ["get_links_for_event", "create_link", "delete_link"]
