"""请求 / 响应模型。

字段名刻意保持 camelCase，与原 `shared/api.interface.ts` 一一对应，保证 API
输出格式与前端（以及旧客户端）完全兼容。
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

# --------------------------------------------------------------------------- #
# 请求体
# --------------------------------------------------------------------------- #


class MediaInput(BaseModel):
    mediaType: Literal["image", "video"]
    fileUrl: Optional[str] = None
    filePath: Optional[str] = None
    fileName: Optional[str] = None
    fileSize: Optional[int] = None


class ChatRecordInput(BaseModel):
    sender: str
    content: str
    sendTime: Optional[str] = None


class CreateEventRequest(BaseModel):
    eventTime: str
    location: Optional[str] = None
    description: str
    tags: List[str] = Field(default_factory=list)
    media: Optional[List[MediaInput]] = None
    chatRecords: Optional[List[ChatRecordInput]] = None
    chatRecordText: Optional[str] = None


class UpdateEventRequest(BaseModel):
    eventTime: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None


class ParseChatRecordRequest(BaseModel):
    text: str


class CreateAnalysisRequest(BaseModel):
    title: str
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    eventIds: Optional[List[str]] = None


# --------------------------------------------------------------------------- #
# 响应体
# --------------------------------------------------------------------------- #


class ParsedChatRecord(BaseModel):
    sender: str
    content: str
    sendTime: Optional[str] = None


class ParseChatRecordResponse(BaseModel):
    records: List[ParsedChatRecord]


class EventMedia(BaseModel):
    id: str
    eventId: str
    mediaType: str
    filePath: str
    fileUrl: str = ""
    fileName: Optional[str] = None
    fileSize: Optional[int] = None


class ChatRecord(BaseModel):
    id: str
    eventId: str
    sender: str
    content: str
    sendTime: Optional[str] = None


class EventItem(BaseModel):
    id: str
    eventTime: str
    location: Optional[str] = None
    description: str
    tags: List[str] = Field(default_factory=list)
    mediaCount: int = 0
    chatRecordCount: int = 0
    createdAt: str
    updatedAt: str


class EventDetail(EventItem):
    media: List[EventMedia] = Field(default_factory=list)
    chatRecords: List[ChatRecord] = Field(default_factory=list)


class EventListResponse(BaseModel):
    items: List[EventItem]
    total: int
    page: int
    pageSize: int


class KeyPerson(BaseModel):
    name: str
    role: str = ""
    mentions: int = 0


class KeyTimeline(BaseModel):
    time: str
    event: str
    importance: str = "一般"


class Doubt(BaseModel):
    point: str
    description: str = ""
    severity: str = "一般"


class EvidenceCategory(BaseModel):
    category: str
    items: List[str] = Field(default_factory=list)


class AnalysisReport(BaseModel):
    id: str
    title: str
    timeRangeStart: Optional[str] = None
    timeRangeEnd: Optional[str] = None
    summary: str = ""
    keyPersons: List[KeyPerson] = Field(default_factory=list)
    keyTimelines: List[KeyTimeline] = Field(default_factory=list)
    doubts: List[Doubt] = Field(default_factory=list)
    evidenceCategories: List[EvidenceCategory] = Field(default_factory=list)
    fullReport: str = ""
    status: str = "pending"
    createdAt: str
    updatedAt: str


class AnalysisReportListResponse(BaseModel):
    items: List[AnalysisReport]
    total: int


class UploadedMediaMeta(BaseModel):
    mediaType: Literal["image", "video"]
    fileUrl: str
    filePath: str
    fileName: str
    fileSize: int


# --------------------------------------------------------------------------- #
# 错误响应（与原 GlobalExceptionFilter 的输出结构一致）
# --------------------------------------------------------------------------- #


class ApiErrorBody(BaseModel):
    code: str
    message: str
    details: Optional[str] = None
    timestamp: Optional[int] = None


class ApiErrorResponse(BaseModel):
    error: ApiErrorBody
