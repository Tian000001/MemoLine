"""SQLite 访问层。

沿用原 Drizzle 版本的表结构（events / event_media / event_chat_records /
analysis_reports），建表语句与原 `DatabaseInitService` 完全一致，因此可以直接
打开旧库 `data/app.db`，无需数据迁移。
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .config import DATABASE_PATH, UPLOADS_DIR

SCHEMA_SQL: list[str] = [
    """CREATE TABLE IF NOT EXISTS "events" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "event_time" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
  )""",
    """CREATE INDEX IF NOT EXISTS "idx_events_event_time" ON "events" ("event_time")""",
    """CREATE TABLE IF NOT EXISTS "event_chat_records" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "event_id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "send_time" TEXT,
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE
  )""",
    """CREATE INDEX IF NOT EXISTS "idx_chat_records_event_id" ON "event_chat_records" ("event_id")""",
    """CREATE TABLE IF NOT EXISTS "event_media" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "event_id" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_url" TEXT,
    "file_name" TEXT,
    "file_size" INTEGER,
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE
  )""",
    """CREATE INDEX IF NOT EXISTS "idx_event_media_event_id" ON "event_media" ("event_id")""",
    """CREATE TABLE IF NOT EXISTS "analysis_reports" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "title" TEXT NOT NULL,
    "time_range_start" TEXT,
    "time_range_end" TEXT,
    "summary" TEXT,
    "key_persons" TEXT NOT NULL DEFAULT '[]',
    "key_timelines" TEXT NOT NULL DEFAULT '[]',
    "doubts" TEXT NOT NULL DEFAULT '[]',
    "evidence_categories" TEXT NOT NULL DEFAULT '[]',
    "full_report" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
  )""",
]


def ensure_dirs() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def _connect() -> sqlite3.Connection:
    ensure_dirs()
    conn = sqlite3.connect(str(DATABASE_PATH), timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def get_db() -> Iterator[sqlite3.Connection]:
    """每个请求/任务一个连接，正常结束提交、异常回滚。"""
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """幂等建表。等效于原 NestJS 的 DatabaseInitService.onModuleInit。"""
    with get_db() as conn:
        for sql in SCHEMA_SQL:
            conn.execute(sql)
