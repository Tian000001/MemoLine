"""领域异常。

对应原 NestJS 版本里的 `NotFoundException`，由 main.py 的异常处理器统一
转换成 `{"error": {"code", "message", "timestamp"}}` 结构。
"""

from __future__ import annotations


class DomainError(Exception):
    """所有业务异常的基类。"""

    status_code = 400
    code = "BUSINESS_ERROR"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(DomainError):
    status_code = 404
    code = "NOT_FOUND"


class BadRequestError(DomainError):
    status_code = 400
    code = "BAD_REQUEST"


__all__ = ["DomainError", "NotFoundError", "BadRequestError"]
