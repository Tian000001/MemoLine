"""事件关联接口（/api/links）。"""

from __future__ import annotations

from fastapi import APIRouter

from ..schemas import CreateLinkRequest, EventLinkItem
from ..services import links_service

router = APIRouter(prefix="/api/links", tags=["links"])


@router.post("", response_model=EventLinkItem, status_code=201)
def create_link(dto: CreateLinkRequest) -> EventLinkItem:
    return links_service.create_link(dto)


@router.delete("/{link_id}", status_code=204)
def delete_link(link_id: str) -> None:
    links_service.delete_link(link_id)
