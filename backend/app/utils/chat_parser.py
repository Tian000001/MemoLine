"""聊天记录文本解析。

`server/modules/events/utils/chat-parser.ts` 的等价 Python 实现，支持：
  - `[时间] 发送者: 内容`
  - `YYYY-MM-DD HH:mm(:ss) 发送者: 内容`
  - `HH:mm(:ss) 发送者: 内容`
  - `上午/下午/晚上/凌晨/中午X(:XX) 发送者: 内容`
  - `发送者: 内容`（无时间）

时间统一输出为 JS `Date.prototype.toISOString()` 风格的
`YYYY-MM-DDTHH:mm:ss.sssZ`（UTC），与库里既有数据保持一致。
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import List, Optional

from ..schemas import ParseChatRecordResponse, ParsedChatRecord
from .timeutil import to_iso

_RE_BRACKET_TIME = re.compile(r"^\[([^\]]+)\]\s*([^:：]+)[:：]\s*(.+)$")
_RE_DATETIME = re.compile(
    r"^(\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2})?)\s+([^:：]+)[:：]\s*(.+)$"
)
_RE_TIME_ONLY = re.compile(r"^(\d{1,2}:\d{2}(?::\d{2})?)\s+([^:：]+)[:：]\s*(.+)$")
_RE_CN_TIME = re.compile(
    r"^(上午|下午|晚上|凌晨|中午)(\d{1,2})([：:](\d{1,2}))?\s+([^:：]+)[:：]\s*(.+)$"
)
_RE_SENDER_ONLY = re.compile(r"^([^:：]+)[:：]\s*(.+)$")
_RE_HMS = re.compile(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$")
_RE_DATE_ONLY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_RE_NEWLINE = re.compile(r"\r?\n")


def _parse_direct(raw: str) -> Optional[datetime]:
    """尽量模拟 `new Date(str)`：带时区的按原样，不带时区的按本地时间。"""
    text = raw.strip()
    if not text:
        return None

    if _RE_DATE_ONLY.match(text):
        # JS 把纯日期按 UTC 解析
        try:
            return datetime.strptime(text, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return None

    candidate = text.replace(" ", "T")
    if candidate.endswith(("Z", "z")):
        candidate = candidate[:-1] + "+00:00"

    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.astimezone()
    return parsed


def _try_parse_time(time_str: str) -> Optional[str]:
    text = time_str.strip()
    if not text:
        return None

    direct = _parse_direct(text)
    if direct is not None:
        return to_iso(direct)

    hms = _RE_HMS.match(text)
    if hms:
        now = datetime.now()
        try:
            localized = now.replace(
                hour=int(hms.group(1)),
                minute=int(hms.group(2)),
                second=int(hms.group(3) or 0),
                microsecond=0,
            )
        except ValueError:
            return None
        return to_iso(localized)

    spaced = _parse_direct(text.replace(" ", "T"))
    return to_iso(spaced) if spaced is not None else None


def _parse_chat_line(line: str) -> Optional[ParsedChatRecord]:
    bracket = _RE_BRACKET_TIME.match(line)
    if bracket:
        return ParsedChatRecord(
            sender=bracket.group(2).strip(),
            content=bracket.group(3).strip(),
            sendTime=_try_parse_time(bracket.group(1).strip()),
        )

    datetime_match = _RE_DATETIME.match(line)
    if datetime_match:
        return ParsedChatRecord(
            sender=datetime_match.group(2).strip(),
            content=datetime_match.group(3).strip(),
            sendTime=_try_parse_time(datetime_match.group(1).strip().replace(" ", "T")),
        )

    time_only = _RE_TIME_ONLY.match(line)
    if time_only:
        return ParsedChatRecord(
            sender=time_only.group(2).strip(),
            content=time_only.group(3).strip(),
            sendTime=_try_parse_time(time_only.group(1).strip()),
        )

    cn_time = _RE_CN_TIME.match(line)
    if cn_time:
        period = cn_time.group(1)
        hour = int(cn_time.group(2))
        minute = int(cn_time.group(4)) if cn_time.group(4) else 0
        if period in ("下午", "晚上"):
            if hour < 12:
                hour += 12
        elif period == "凌晨" and hour == 12:
            hour = 0

        now = datetime.now()
        try:
            localized = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        except ValueError:
            return None
        return ParsedChatRecord(
            sender=cn_time.group(5).strip(),
            content=cn_time.group(6).strip(),
            sendTime=to_iso(localized),
        )

    sender_only = _RE_SENDER_ONLY.match(line)
    if sender_only:
        sender = sender_only.group(1).strip()
        content = sender_only.group(2).strip()
        if sender and content:
            return ParsedChatRecord(sender=sender, content=content, sendTime=None)

    return None


def parse_chat_text(text: str) -> ParseChatRecordResponse:
    # 与 JS 的 text.split(/\r?\n/) 保持一致（只按 \n / \r\n 切分）
    lines: List[str] = _RE_NEWLINE.split(text) if text else []
    records: List[ParsedChatRecord] = []
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        parsed = _parse_chat_line(line)
        if parsed is not None:
            records.append(parsed)
    return ParseChatRecordResponse(records=records)


__all__ = ["parse_chat_text", "to_iso"]
