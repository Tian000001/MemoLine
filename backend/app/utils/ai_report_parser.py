"""把大模型返回的 Markdown 复盘文本解析成结构化字段。

`server/modules/analysis/ai-report-parser.ts` 的等价 Python 实现，行为保持一致：
按「事件整体摘要 / 人物与关键节点 / 关键节点 / 疑点识别 / 证据归类」切分，
再逐行提取关键人物、关键时间节点、疑点与证据分类。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List

_RE_LINE_PREFIX = re.compile(r"^[-*•\d.)]+\s*")
_RE_PERSON = re.compile(r"^([^，。：:（(]+)[，。：:（(]([^）)\n]+)?[）)]?")
_RE_MENTIONS = re.compile(r"(\d+)\s*次")
_RE_TIMELINE_TIME = re.compile(
    r"(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?(?:\s*\d{1,2}[:：]\d{2})?)|(\d{1,2}[:：]\d{2})"
)
_RE_TIMELINE_IMPORTANCE = re.compile(r"[【\[](重要|一般|次要|高|中|低)[】\]]")
_RE_DOUBT_SEVERITY = re.compile(r"[【\[](高|中|低|严重|一般|轻微)[】\]]")
_RE_DOUBT_COLON = re.compile(r"^([^：:]{1,30})[：:](.*)")
_RE_EVIDENCE_SPLIT = re.compile(r"\n(?=[^-*\s])")
_RE_STRIP_HEADING = re.compile(r"^#+\s*[^:\n]*[:：]?\s*\n?")


@dataclass
class ParsedAiReport:
    summary: str = ""
    keyPersons: List[Dict[str, object]] = field(default_factory=list)
    keyTimelines: List[Dict[str, object]] = field(default_factory=list)
    doubts: List[Dict[str, object]] = field(default_factory=list)
    evidenceCategories: List[Dict[str, object]] = field(default_factory=list)


def _extract_section(text: str, headings: List[str]) -> str:
    for heading in headings:
        escaped = re.escape(heading)
        patterns = [
            re.compile(r"##\s*" + escaped + r"[\s\S]*?\n(?=##\s|$)", re.I),
            re.compile(r"###\s*" + escaped + r"[\s\S]*?\n(?=###?\s|$)", re.I),
            re.compile(escaped + r"[:：][\s\S]*?(?=\n[^\s\-*].*[:：]|$)", re.I),
        ]
        for pattern in patterns:
            match = pattern.search(text)
            if match:
                return _RE_STRIP_HEADING.sub("", match.group(0), count=1).strip()
    return ""


def _clean_lines(text: str) -> List[str]:
    if not text:
        return []
    return [
        _RE_LINE_PREFIX.sub("", line).strip()
        for line in text.split("\n")
        if line.strip()
    ]


def _parse_key_persons(text: str) -> List[Dict[str, object]]:
    result: List[Dict[str, object]] = []
    for clean in _clean_lines(text):
        if not clean:
            continue
        match = _RE_PERSON.match(clean)
        if match:
            mentions = _RE_MENTIONS.search(clean)
            result.append(
                {
                    "name": match.group(1).strip(),
                    "role": (match.group(2) or "").strip(),
                    "mentions": int(mentions.group(1)) if mentions else 0,
                }
            )
        elif len(clean) < 20:
            result.append({"name": clean, "role": "", "mentions": 0})
    return result[:20]


def _parse_key_timelines(text: str) -> List[Dict[str, object]]:
    result: List[Dict[str, object]] = []
    for clean in _clean_lines(text):
        if not clean:
            continue
        time_match = _RE_TIMELINE_TIME.search(clean)
        if not time_match:
            continue
        time_value = time_match.group(0)
        rest = clean.replace(time_value, "", 1)
        rest = re.sub(r"^[-—:：\s]+", "", rest)
        rest = rest.strip()
        importance_match = _RE_TIMELINE_IMPORTANCE.search(rest)
        importance = importance_match.group(1) if importance_match else "一般"
        event = _RE_TIMELINE_IMPORTANCE.sub("", rest, count=1).strip()
        result.append(
            {"time": time_value, "event": event or rest, "importance": importance}
        )
    return result[:30]


def _parse_doubts(text: str) -> List[Dict[str, object]]:
    result: List[Dict[str, object]] = []
    for clean in _clean_lines(text):
        if not clean:
            continue
        severity_match = _RE_DOUBT_SEVERITY.search(clean)
        severity = severity_match.group(1) if severity_match else "一般"
        rest = _RE_DOUBT_SEVERITY.sub("", clean, count=1).strip()

        colon_match = _RE_DOUBT_COLON.match(rest)
        if colon_match:
            result.append(
                {
                    "point": colon_match.group(1).strip(),
                    "description": colon_match.group(2).strip(),
                    "severity": severity,
                }
            )
        elif len(rest) < 50:
            result.append({"point": rest, "description": rest, "severity": severity})
    return result[:20]


def _parse_evidence_categories(text: str) -> List[Dict[str, object]]:
    if not text:
        return []
    result: List[Dict[str, object]] = []
    for block in _RE_EVIDENCE_SPLIT.split(text):
        if not block.strip():
            continue
        lines = block.split("\n")
        first_line = _RE_LINE_PREFIX.sub("", lines[0]).strip()
        if not first_line:
            continue
        category_name = re.sub(r"[:：]\s*$", "", first_line).strip()
        items: List[str] = []
        for line in lines[1:]:
            item = _RE_LINE_PREFIX.sub("", line).strip()
            if item:
                items.append(item)
        if items or category_name:
            result.append(
                {"category": category_name or "未分类", "items": items[:50]}
            )
    return result[:20]


def parse_ai_report(text: str) -> ParsedAiReport:
    summary = _extract_section(text, ["事件整体摘要", "整体摘要", "摘要"])
    key_persons_text = _extract_section(text, ["人物与关键节点", "关键人物", "人物分析"])
    key_timelines_text = _extract_section(text, ["关键节点", "时间节点", "关键时间线"])
    doubts_text = _extract_section(text, ["疑点识别", "疑点分析", "疑点"])
    evidence_text = _extract_section(text, ["证据归类", "证据分类", "证据整理"])

    return ParsedAiReport(
        summary=summary or text[:500],
        keyPersons=_parse_key_persons(key_persons_text),
        keyTimelines=_parse_key_timelines(key_timelines_text),
        doubts=_parse_doubts(doubts_text),
        evidenceCategories=_parse_evidence_categories(evidence_text),
    )
