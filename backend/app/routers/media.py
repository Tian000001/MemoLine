"""媒体接口：上传 + 静态访问。

上传落盘到 `uploads/`，通过 `/api/media/<filename>` 访问（静态挂载在 main.py）。
"""

from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, File, UploadFile

from ..config import MAX_UPLOAD_BYTES, MEDIA_BASE_URL, UPLOADS_DIR
from ..errors import BadRequestError
from ..schemas import UploadedMediaMeta

router = APIRouter(prefix="/api/media", tags=["media"])

_CHUNK_SIZE = 1024 * 1024


@router.post("/upload", response_model=UploadedMediaMeta, status_code=201)
async def upload(file: UploadFile = File(...)) -> UploadedMediaMeta:
    original_name = file.filename or "unnamed"
    ext = os.path.splitext(original_name)[1]
    stored_name = f"{uuid.uuid4()}{ext}"

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    destination = UPLOADS_DIR / stored_name

    written = 0
    too_large = False
    try:
        with destination.open("wb") as fh:
            while True:
                chunk = await file.read(_CHUNK_SIZE)
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    too_large = True
                    break
                fh.write(chunk)
    finally:
        await file.close()

    if too_large:
        destination.unlink(missing_ok=True)
        raise BadRequestError("文件过大，单文件最大支持 200MB")

    if written == 0:
        destination.unlink(missing_ok=True)
        raise BadRequestError("上传内容为空")

    media_type = "video" if (file.content_type or "").startswith("video/") else "image"

    return UploadedMediaMeta(
        mediaType=media_type,
        fileUrl=f"{MEDIA_BASE_URL}/{stored_name}",
        filePath=stored_name,
        fileName=original_name,
        fileSize=written,
    )
