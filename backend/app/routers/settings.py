"""系统设置接口（/api/settings）。"""

from __future__ import annotations

from fastapi import APIRouter

from ..schemas import (
    AiSettingsResponse,
    AiTestResponse,
    AiTestRequest,
    UpdateAiSettingsRequest,
)
from ..services import settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/ai", response_model=AiSettingsResponse)
def get_ai_settings() -> AiSettingsResponse:
    return settings_service.get_ai_settings()


@router.put("/ai", response_model=AiSettingsResponse)
def update_ai_settings(dto: UpdateAiSettingsRequest) -> AiSettingsResponse:
    return settings_service.update_ai_settings(dto)


@router.post("/ai/test", response_model=AiTestResponse)
def test_ai_settings(dto: AiTestRequest) -> AiTestResponse:
    # 表单里临时填写的 key/baseUrl/model 优先，用于「保存前先试一试」。
    return settings_service.test_ai_connection(
        api_key=dto.apiKey, base_url=dto.baseUrl, model=dto.model
    )
