"""Thay cho paths.py của bản offline: trỏ vào dữ liệu của bản web."""
from __future__ import annotations

from pathlib import Path


def app_data_dir() -> Path:
    from ..db import DB_PATH

    path = Path(DB_PATH).parent
    path.mkdir(parents=True, exist_ok=True)
    return path


def database_path() -> Path:
    from ..db import DB_PATH

    return Path(DB_PATH)


def backup_dir() -> Path:
    path = app_data_dir() / "sao_luu"
    path.mkdir(parents=True, exist_ok=True)
    return path
