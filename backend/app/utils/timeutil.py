"""时间格式化工具。

统一产出 JS `Date.prototype.toISOString()` 风格字符串
（`YYYY-MM-DDTHH:mm:ss.sssZ`，UTC、毫秒 3 位），保证与旧数据、旧前端完全兼容。
"""

from __future__ import annotations

from datetime import datetime, timezone


def to_iso(dt: datetime) -> str:
    """naive datetime 视为本地时间，输出 UTC ISO（毫秒 3 位 + Z）。"""
    if dt.tzinfo is None:
        dt = dt.astimezone()
    dt = dt.astimezone(timezone.utc)
    millis = dt.microsecond // 1000
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % millis


def now_iso() -> str:
    return to_iso(datetime.now())


__all__ = ["to_iso", "now_iso"]
