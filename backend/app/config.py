"""运行期配置。

所有路径都基于本文件位置推导，因此无论从哪个目录启动（run.bat 会进入
backend/，也可以从项目根或任意其他目录启动）都能正确定位 data/、uploads/、
frontend/。这替代了原 NestJS 版本里依赖 process.cwd() 的写法。
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent


def _load_dotenv(path: Path) -> None:
    """极简 .env 解析（避免额外依赖 python-dotenv）。"""
    if not path.is_file():
        return
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv(PROJECT_ROOT / ".env")
_load_dotenv(BACKEND_DIR / ".env")


def _resolve(raw: str) -> Path:
    p = Path(raw).expanduser()
    return p if p.is_absolute() else (PROJECT_ROOT / p).resolve()


def _path_from_env(name: str, default: Path) -> Path:
    raw = os.environ.get(name, "").strip()
    return _resolve(raw) if raw else default


def _database_path() -> Path:
    """支持两种写法：DATABASE_PATH=./data/app.db，或旧的 DATABASE_URL=file:./data/app.db。"""
    explicit = os.environ.get("DATABASE_PATH", "").strip()
    if explicit:
        return _resolve(explicit)

    url = os.environ.get("DATABASE_URL", "").strip()
    if url.startswith("file:"):
        return _resolve(url[len("file:") :])

    return PROJECT_ROOT / "data" / "app.db"


SERVER_HOST = os.environ.get("SERVER_HOST", "").strip() or "127.0.0.1"
try:
    SERVER_PORT = int(os.environ.get("SERVER_PORT", "").strip() or "3000")
except ValueError:
    SERVER_PORT = 3000

DATABASE_PATH: Path = _database_path()
UPLOADS_DIR: Path = _path_from_env("UPLOADS_DIR", PROJECT_ROOT / "uploads")
FRONTEND_DIR: Path = _path_from_env("FRONTEND_DIR", PROJECT_ROOT / "frontend")

MEDIA_BASE_URL = "/api/media"
CAPABILITIES_DIR = BACKEND_DIR / "capabilities"

AI_API_KEY = os.environ.get("AI_API_KEY", "").strip()
AI_BASE_URL = (
    os.environ.get("AI_BASE_URL", "").strip() or "https://api.openai.com/v1"
).rstrip("/")
AI_MODEL = os.environ.get("AI_MODEL", "").strip() or "gpt-4o-mini"

MAX_UPLOAD_BYTES = 200 * 1024 * 1024

AI_PROMPT_FALLBACK = "你是一位专业的事件复盘分析专家，请对以下时间线事件进行全面复盘分析。"


def ai_prompt() -> str:
    """读取 capabilities 里的大模型提示词，失败时回退到内置提示词。"""
    import json

    path = CAPABILITIES_DIR / "timeline_event_review_analysis_1.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return AI_PROMPT_FALLBACK
    prompt: Optional[str] = (data.get("formValue") or {}).get("prompt")
    return prompt or AI_PROMPT_FALLBACK
