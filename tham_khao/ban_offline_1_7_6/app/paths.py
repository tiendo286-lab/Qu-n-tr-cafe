from __future__ import annotations

import os
import sys
from pathlib import Path


DATA_FOLDER = "QuanTriLichLamCafe"


def _platform_data_root() -> Path:
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support"
    if os.name == "nt":
        return Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))


def app_data_dir() -> Path:
    """Thư mục dữ liệu chính thức. SQLite giữ nguyên khi cập nhật ứng dụng."""
    path = _platform_data_root() / DATA_FOLDER
    path.mkdir(parents=True, exist_ok=True)
    return path


def database_path() -> Path:
    return app_data_dir() / "xep_lich.sqlite3"


def backup_dir() -> Path:
    path = app_data_dir() / "backups"
    path.mkdir(parents=True, exist_ok=True)
    return path
