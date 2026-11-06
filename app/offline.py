"""Mở dữ liệu bằng phần xử lý của bản offline 1.7.6.

Bản web dùng chung file SQLite với bản offline, nên các chức năng offline
(đánh giá, voucher, nhập/xuất Excel, báo cáo, chuyển dữ liệu ZIP...) gọi lại
đúng mã gốc. Khi mở, KHÔNG chạy các bước tự động của bản offline như tự tạo
tuần hiện tại hay tự xóa tuần cũ hơn 30 ngày (bản web giữ lịch sử).
"""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from .legacy.database import Database, DatabaseError  # noqa: F401
from .legacy.paths import database_path


class WebDatabase(Database):
    def __init__(self, path: Path | None = None) -> None:  # noqa: D401 - thay khởi tạo gốc
        self.path = Path(path or database_path())
        self.conn = sqlite3.connect(self.path, timeout=15, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.execute("PRAGMA busy_timeout = 15000")
        self._create_schema()
        self._migrate_dynamic_structure()
        self._seed_evaluation_criteria()


_ready = False


def open_db() -> WebDatabase:
    global _ready
    db = WebDatabase()
    _ready = True
    return db


@contextmanager
def legacy() -> Iterator[WebDatabase]:
    db = open_db()
    try:
        yield db
    finally:
        db.close()


def get_legacy() -> Iterator[WebDatabase]:
    """Dùng làm Depends trong FastAPI."""
    db = open_db()
    try:
        yield db
    finally:
        db.close()
