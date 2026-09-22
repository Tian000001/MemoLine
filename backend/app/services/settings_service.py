"""系统设置服务：大模型 API 配置的读取 / 保存 / 连接测试。

配置优先级：app_settings 表（设置页保存）> .env 环境变量 > 本地 mock。
API Key 只写入本地 SQLite，接口返回时始终打码，绝不回传明文。
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import NamedTuple, Optional

from ..config import AI_API_KEY as ENV_AI_KEY
from ..config import AI_BASE_URL as ENV_AI_BASE_URL
from ..config import AI_MODEL as ENV_AI_MODEL
from ..db import get_db
from ..errors import BadRequestError
from ..schemas import AiSettingsResponse, AiTestResponse, UpdateAiSettingsRequest
from ..utils.timeutil import now_iso

_AI_TIMEOUT_SECONDS = 30


class AiConfig(NamedTuple):
    api_key: str
    base_url: str
    model: str
    source: str


def _mask(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return key[0] + "****"
    return key[:4] + "****" + key[-4:]


def _get_stored(conn, key: str) -> Optional[str]:
    row = conn.execute(
        "SELECT value FROM app_settings WHERE key = ? LIMIT 1", (key,)
    ).fetchone()
    if row is None:
        return None
    value = row["value"]
    return value if value not in (None, "") else None


def resolve_ai_config() -> AiConfig:
    """解析当前生效的大模型配置：DB 覆盖 > .env > mock 占位。"""
    with get_db() as conn:
        db_key = _get_stored(conn, "ai_api_key")
        db_base = _get_stored(conn, "ai_base_url")
        db_model = _get_stored(conn, "ai_model")

    api_key = db_key if db_key is not None else ENV_AI_KEY
    base_url = (db_base if db_base is not None else ENV_AI_BASE_URL).rstrip("/")
    model = db_model if db_model is not None else ENV_AI_MODEL

    source = "db" if db_key is not None else ("env" if ENV_AI_KEY else "mock")
    return AiConfig(api_key=api_key, base_url=base_url, model=model, source=source)


def get_ai_settings() -> AiSettingsResponse:
    cfg = resolve_ai_config()
    return AiSettingsResponse(
        source=cfg.source,
        baseUrl=cfg.base_url,
        model=cfg.model,
        hasApiKey=bool(cfg.api_key),
        apiKeyMasked=_mask(cfg.api_key),
    )


def update_ai_settings(dto: UpdateAiSettingsRequest) -> AiSettingsResponse:
    has_any = dto.apiKey is not None or dto.baseUrl is not None or dto.model is not None
    if not has_any:
        raise BadRequestError("没有需要保存的设置")

    now = now_iso()
    with get_db() as conn:
        updates: list[tuple[str, str]] = []
        if dto.apiKey is not None:
            # 空串 = 清除（回退 .env / mock）；前后去空白
            updates.append(("ai_api_key", dto.apiKey.strip()))
        if dto.baseUrl is not None and dto.baseUrl.strip():
            updates.append(("ai_base_url", dto.baseUrl.strip().rstrip("/")))
        if dto.model is not None and dto.model.strip():
            updates.append(("ai_model", dto.model.strip()))

        for key, value in updates:
            conn.execute(
                "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value, "
                "updated_at = excluded.updated_at",
                (key, value, now),
            )

    return get_ai_settings()


def test_ai_connection(
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
) -> AiTestResponse:
    """用一条极短对话验证大模型连通性；缺省字段回退到已保存/环境配置。"""
    cfg = resolve_ai_config()
    key = (api_key or "").strip() or cfg.api_key
    url = ((base_url or "").strip() or cfg.base_url).rstrip("/")
    mdl = (model or "").strip() or cfg.model

    if not key:
        return AiTestResponse(
            ok=False, message="未配置 API Key，请先填写", model=mdl
        )

    payload = {
        "model": mdl,
        "max_tokens": 16,
        "messages": [{"role": "user", "content": "回复：OK"}],
    }
    request = urllib.request.Request(
        f"{url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        },
        method="POST",
    )

    started = time.time()
    try:
        with urllib.request.urlopen(request, timeout=_AI_TIMEOUT_SECONDS) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        return AiTestResponse(
            ok=False,
            message=f"AI 服务返回错误（HTTP {exc.code}）：{detail}",
            model=mdl,
            elapsedMs=int((time.time() - started) * 1000),
        )
    except Exception as exc:  # noqa: BLE001 - 网络/DNS/超时等统一兜底
        return AiTestResponse(
            ok=False,
            message=f"连接失败：{exc!r}",
            model=mdl,
            elapsedMs=int((time.time() - started) * 1000),
        )

    choices = body.get("choices") or []
    reply = ""
    if choices:
        reply = ((choices[0].get("message") or {}).get("content") or "").strip()
    elapsed = int((time.time() - started) * 1000)
    return AiTestResponse(
        ok=True,
        message=f"连接成功，模型已回复「{reply[:50] or '（空）'}」",
        model=mdl,
        elapsedMs=elapsed,
    )


__all__ = [
    "resolve_ai_config",
    "get_ai_settings",
    "update_ai_settings",
    "test_ai_connection",
]
