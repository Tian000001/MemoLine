"""分析服务：AI 复盘报告列表 / 详情 / 创建（后台异步生成）/ 删除。

对应原 `server/modules/analysis/analysis.service.ts`。
大模型调用使用标准库 urllib（不引入额外依赖）；未配置 `AI_API_KEY` 时走本地
结构化 mock，保证离线也能看到可用的报告。
"""

from __future__ import annotations

import json
import sqlite3
import urllib.error
import urllib.request
import uuid
from typing import Any, Dict, List, Optional, Sequence

from ..config import AI_API_KEY, AI_BASE_URL, AI_MODEL, ai_prompt
from ..db import get_db
from ..errors import NotFoundError
from ..schemas import AnalysisReport, AnalysisReportListResponse, CreateAnalysisRequest
from ..utils.ai_report_parser import parse_ai_report
from ..utils.timeutil import now_iso

_AI_TIMEOUT_SECONDS = 120


def _load_json_list(raw: Any) -> List[Any]:
    if isinstance(raw, list):
        return raw
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return []
    return parsed if isinstance(parsed, list) else []


def _map_report(row: sqlite3.Row) -> AnalysisReport:
    return AnalysisReport(
        id=row["id"],
        title=row["title"],
        timeRangeStart=row["time_range_start"],
        timeRangeEnd=row["time_range_end"],
        summary=row["summary"] or "",
        keyPersons=_load_json_list(row["key_persons"]),
        keyTimelines=_load_json_list(row["key_timelines"]),
        doubts=_load_json_list(row["doubts"]),
        evidenceCategories=_load_json_list(row["evidence_categories"]),
        fullReport=row["full_report"] or "",
        status=row["status"] or "pending",
        createdAt=row["created_at"],
        updatedAt=row["updated_at"],
    )


def get_report_list() -> AnalysisReportListResponse:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM analysis_reports ORDER BY created_at DESC"
        ).fetchall()
        total = conn.execute("SELECT COUNT(*) AS total FROM analysis_reports").fetchone()[
            "total"
        ]
    return AnalysisReportListResponse(
        items=[_map_report(row) for row in rows], total=total
    )


def get_report_detail(report_id: str) -> AnalysisReport:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM analysis_reports WHERE id = ?", (report_id,)
        ).fetchone()
    if row is None:
        raise NotFoundError("报告不存在")
    return _map_report(row)


def create_report(dto: CreateAnalysisRequest) -> AnalysisReport:
    """先落库为 pending，再由调用方把 generate_report 交给后台任务执行。"""
    now = now_iso()
    report_id = str(uuid.uuid4())

    with get_db() as conn:
        conn.execute(
            "INSERT INTO analysis_reports (id, title, time_range_start, time_range_end, "
            "summary, key_persons, key_timelines, doubts, evidence_categories, "
            "full_report, status, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, '', '[]', '[]', '[]', '[]', '', 'pending', ?, ?)",
            (
                report_id,
                dto.title,
                dto.startTime or None,
                dto.endTime or None,
                now,
                now,
            ),
        )

    return get_report_detail(report_id)


def delete_report(report_id: str) -> None:
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM analysis_reports WHERE id = ?", (report_id,))
        if cursor.rowcount == 0:
            raise NotFoundError("报告不存在")


# --------------------------------------------------------------------------- #
# 报告生成（后台执行）
# --------------------------------------------------------------------------- #


def generate_report(report_id: str, dto: CreateAnalysisRequest) -> None:
    """生成复盘报告；任何异常都会把状态置为 failed，不影响主流程。"""
    try:
        with get_db() as conn:
            conn.execute(
                "UPDATE analysis_reports SET status = 'generating' WHERE id = ?",
                (report_id,),
            )

        event_list = _fetch_events(dto)
        timeline_content = _build_timeline_content(event_list)

        full_text = (
            _call_real_ai(timeline_content)
            if AI_API_KEY
            else _build_local_mock(event_list)
        )

        parsed = parse_ai_report(full_text)

        with get_db() as conn:
            conn.execute(
                "UPDATE analysis_reports SET status = 'completed', summary = ?, "
                "key_persons = ?, key_timelines = ?, doubts = ?, evidence_categories = ?, "
                "full_report = ?, updated_at = ? WHERE id = ?",
                (
                    parsed.summary,
                    json.dumps(parsed.keyPersons, ensure_ascii=False),
                    json.dumps(parsed.keyTimelines, ensure_ascii=False),
                    json.dumps(parsed.doubts, ensure_ascii=False),
                    json.dumps(parsed.evidenceCategories, ensure_ascii=False),
                    full_text,
                    now_iso(),
                    report_id,
                ),
            )
    except Exception as exc:  # noqa: BLE001 - 兜底：失败也要落状态
        print(f"[analysis] 报告生成失败 {report_id}: {exc!r}", flush=True)
        try:
            with get_db() as conn:
                conn.execute(
                    "UPDATE analysis_reports SET status = 'failed', updated_at = ? WHERE id = ?",
                    (now_iso(), report_id),
                )
        except Exception as mark_exc:  # noqa: BLE001
            print(f"[analysis] 标记失败状态也出错了: {mark_exc!r}", flush=True)


def _fetch_events(dto: CreateAnalysisRequest) -> List[Dict[str, Any]]:
    with get_db() as conn:
        if dto.eventIds:
            placeholders = ",".join("?" for _ in dto.eventIds)
            rows = conn.execute(
                "SELECT * FROM events WHERE id IN (" + placeholders + ") "
                "ORDER BY event_time ASC",
                list(dto.eventIds),
            ).fetchall()
        else:
            clauses: List[str] = []
            params: List[Any] = []
            if dto.startTime:
                clauses.append("event_time >= ?")
                params.append(dto.startTime)
            if dto.endTime:
                clauses.append("event_time <= ?")
                params.append(dto.endTime)
            where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
            rows = conn.execute(
                "SELECT * FROM events" + where + " ORDER BY event_time ASC", params
            ).fetchall()
    return [dict(row) for row in rows]


def _build_timeline_content(event_list: Sequence[Dict[str, Any]]) -> str:
    if not event_list:
        return "（无事件数据）"

    event_ids = [e["id"] for e in event_list]
    placeholders = ",".join("?" for _ in event_ids)

    with get_db() as conn:
        chat_rows = conn.execute(
            "SELECT * FROM event_chat_records WHERE event_id IN (" + placeholders + ")",
            event_ids,
        ).fetchall()

    chat_by_event: Dict[str, List[Dict[str, Any]]] = {}
    for row in chat_rows:
        chat_by_event.setdefault(row["event_id"], []).append(dict(row))

    parts: List[str] = []
    for ev in event_list:
        tags = _load_json_list(ev.get("tags"))
        lines = [f"【事件】时间：{ev['event_time']}"]
        if ev.get("location"):
            lines.append(f"地点：{ev['location']}")
        if tags:
            lines.append("标签：" + "、".join(str(t) for t in tags))
        lines.append(f"描述：{ev['description']}")

        records = chat_by_event.get(ev["id"], [])
        if records:
            lines.append("聊天记录：")
            for r in records:
                send_time = f" ({r['send_time']})" if r.get("send_time") else ""
                lines.append(f"  {r['sender']}{send_time}：{r['content']}")

        parts.append("\n".join(lines))

    return "\n\n---\n\n".join(parts)


def _call_real_ai(content: str) -> str:
    """OpenAI 兼容接口调用（标准库实现）。"""
    payload = {
        "model": AI_MODEL,
        "temperature": 0.5,
        "max_tokens": 8192,
        "messages": [
            {"role": "system", "content": ai_prompt()},
            {"role": "user", "content": f"事件内容：{content}"},
        ],
    }
    request = urllib.request.Request(
        f"{AI_BASE_URL}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {AI_API_KEY}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=_AI_TIMEOUT_SECONDS) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"AI 请求失败: {exc.code} {detail}") from exc

    choices = body.get("choices") or []
    if not choices:
        return ""
    return (choices[0].get("message") or {}).get("content") or ""


def _build_local_mock(event_list: Sequence[Dict[str, Any]]) -> str:
    total = len(event_list)
    summary = (
        f"本次复盘共纳入 {total} 个事件，时间跨度已按时间线梳理。"
        "当前为本地演示模式（未配置真实大模型），以下结果由系统基于结构化数据自动提取，"
        "供参考，关键结论建议人工复核。"
    )

    key_timelines = "\n".join(
        f"{i + 1}. {ev['event_time']} {str(ev['description'])[:60]}【一般】"
        for i, ev in enumerate(event_list)
    )

    return "\n".join(
        [
            "## 事件整体摘要",
            summary,
            "",
            "## 人物与关键节点提取",
            "### 关键人物",
            "（演示模式：请接入大模型以提取关键人物）",
            "### 关键节点",
            key_timelines or "（无）",
            "",
            "## 疑点识别",
            "- 【一般】演示模式：未接入真实大模型，疑点与矛盾需人工复核",
            "",
            "## 证据归类",
            f"- 媒体与聊天记录：共 {total} 个事件关联素材，可在事件详情中查看",
        ]
    )


__all__ = [
    "get_report_list",
    "get_report_detail",
    "create_report",
    "delete_report",
    "generate_report",
]
