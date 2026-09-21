"""FastAPI 应用入口。

职责：
  1. 启动时建表、建目录（等效原 NestJS DatabaseInitService）；
  2. 挂载 /api 接口；
  3. 静态托管上传的媒体（/api/media/<file>）；
  4. 静态托管 frontend/（单端口同时提供前端页面与 API）；
  5. 统一异常输出 `{"error": {"code", "message", "timestamp"}}`（等效原 GlobalExceptionFilter）。
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles

from .config import DATABASE_PATH, FRONTEND_DIR, SERVER_HOST, SERVER_PORT, UPLOADS_DIR
from .db import ensure_dirs, init_db
from .errors import DomainError
from .routers import analysis, events, media

# 与旧 RESPONSE_CODE 枚举保持一致
_HTTP_STATUS_TO_CODE = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "BAD_REQUEST",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "TOO_MANY_REQUESTS",
    500: "INTERNAL_ERROR",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
}


def _error_payload(code: str, message: str, details: str | None = None) -> dict:
    body: dict = {"code": code, "message": message, "timestamp": int(time.time() * 1000)}
    if details:
        body["details"] = details
    return {"error": body}


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    ensure_dirs()
    init_db()
    print(f"[startup] 数据库: {DATABASE_PATH}", flush=True)
    print(f"[startup] 上传目录: {UPLOADS_DIR}", flush=True)
    print(f"[startup] 前端目录: {FRONTEND_DIR}", flush=True)
    print(f"[startup] 服务地址: http://{SERVER_HOST}:{SERVER_PORT}", flush=True)
    yield


app = FastAPI(
    title="ttq-time",
    description="时间线事件记录与智能复盘系统 API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# 统一异常处理
# --------------------------------------------------------------------------- #


def _frontend_404() -> Response:
    page = FRONTEND_DIR / "404.html"
    if page.is_file():
        return FileResponse(str(page), status_code=404)
    return Response(status_code=404)


@app.exception_handler(DomainError)
async def handle_domain_error(_request: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(exc.code, exc.message),
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=_error_payload("VALIDATION_ERROR", "请求参数校验失败", str(exc.errors())),
    )


@app.exception_handler(StarletteHTTPException)
async def handle_http_exception(
    request: Request, exc: StarletteHTTPException
) -> Response:
    # 非 /api 的 404 交给前端 404 页面
    if exc.status_code == 404 and not request.url.path.startswith("/api"):
        return _frontend_404()

    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(
            _HTTP_STATUS_TO_CODE.get(exc.status_code, "UNKNOWN_ERROR"),
            str(exc.detail),
        ),
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(
    _request: Request, exc: Exception
) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=_error_payload("INTERNAL_ERROR", "服务器内部错误", repr(exc)),
    )


# --------------------------------------------------------------------------- #
# 路由与静态资源
# --------------------------------------------------------------------------- #

app.include_router(events.router)
app.include_router(analysis.router)
app.include_router(media.router)

# 上传的媒体文件：/api/media/<filename>
app.mount(
    "/api/media",
    StaticFiles(directory=str(UPLOADS_DIR), check_dir=False),
    name="media",
)


# 未匹配的 /api 路径统一返回 JSON 404。
# 必须在挂载 "/" 之前注册，否则会被前端静态兜底吞掉、返回 HTML 404。
@app.api_route(
    "/api/{rest:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    include_in_schema=False,
)
async def api_not_found(rest: str) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content=_error_payload("NOT_FOUND", f"接口不存在: /api/{rest}"),
    )


# 前端静态站点（index.html / event.html / analysis.html / 404.html / js / css）
app.mount(
    "/",
    StaticFiles(directory=str(FRONTEND_DIR), html=True, check_dir=False),
    name="frontend",
)
