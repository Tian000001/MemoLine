"""事件相关接口（路径与响应结构与原 NestJS 版本一致）。"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter

from ..schemas import (
    CreateEventRequest,
    EventDetail,
    EventListResponse,
    ParseChatRecordRequest,
    ParseChatRecordResponse,
    UpdateEventRequest,
)
from ..services import events_service

router = APIRouter(prefix="/api/events", tags=["events"])


@router.post("/parse-chat", response_model=ParseChatRecordResponse, status_code=201)
def parse_chat(payload: ParseChatRecordRequest) -> ParseChatRecordResponse:
    return events_service.parse_chat(payload.text)


@router.get("", response_model=EventListResponse)
def list_events(
    page: int = 1,
    pageSize: int = 20,
    keyword: Optional[str] = None,
    location: Optional[str] = None,
    tag: Optional[str] = None,
    startTime: Optional[str] = None,
    endTime: Optional[str] = None,
) -> EventListResponse:
    return events_service.list_events(
        page=page,
        page_size=pageSize,
        keyword=keyword,
        location=location,
        tag=tag,
        start_time=startTime,
        end_time=endTime,
    )


@router.get("/{event_id}", response_model=EventDetail)
def get_event(event_id: str) -> EventDetail:
    return events_service.get_event(event_id)


@router.post("", response_model=EventDetail, status_code=201)
def create_event(dto: CreateEventRequest) -> EventDetail:
    return events_service.create_event(dto)


@router.patch("/{event_id}", response_model=EventDetail)
def update_event(event_id: str, dto: UpdateEventRequest) -> EventDetail:
    return events_service.update_event(event_id, dto)


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: str) -> None:
    events_service.delete_event(event_id)
