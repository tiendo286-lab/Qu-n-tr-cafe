from __future__ import annotations

import json
import sqlite3
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any

from .constants import APP_VERSION


TRANSFER_FORMAT = "QuanTriLichLamCafe-Transfer-v1"
DATABASE_NAME = "xep_lich.sqlite3"
MANIFEST_NAME = "manifest.json"
INFO_NAME = "THONG_TIN_DU_LIEU.txt"


class TransferDataError(RuntimeError):
    pass


def _integrity_check(path: Path) -> None:
    try:
        conn = sqlite3.connect(path)
        try:
            row = conn.execute("PRAGMA integrity_check").fetchone()
            if not row or str(row[0]).strip().lower() != "ok":
                raise TransferDataError(f"Database không đạt integrity_check: {row}")
            tables = {
                str(r[0])
                for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            }
            required = {"settings", "employees", "weeks"}
            missing = sorted(required - tables)
            if missing:
                raise TransferDataError("File dữ liệu thiếu bảng bắt buộc: " + ", ".join(missing))
        finally:
            conn.close()
    except sqlite3.Error as exc:
        raise TransferDataError(f"Không đọc được database SQLite: {exc}") from exc


def _stats(path: Path) -> dict[str, int]:
    conn = sqlite3.connect(path)
    try:
        result: dict[str, int] = {}
        for table in ("employees", "weeks", "evaluation_rounds", "evaluation_round_employees", "evaluation_voucher_allocations"):
            try:
                result[table] = int(conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0])
            except sqlite3.Error:
                result[table] = 0
        return result
    finally:
        conn.close()


def create_transfer_package(db: Any, target_zip: Path) -> Path:
    """Tạo một ZIP nhất quán, đủ để chuyển dữ liệu qua Zalo giữa Mac/Windows."""
    target = Path(target_zip)
    if target.suffix.lower() != ".zip":
        target = target.with_suffix(".zip")
    target.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="quantri_transfer_") as temp_dir:
        temp_root = Path(temp_dir)
        snapshot = temp_root / DATABASE_NAME

        db.conn.commit()
        destination = sqlite3.connect(snapshot)
        try:
            db.conn.backup(destination)
        finally:
            destination.close()

        _integrity_check(snapshot)
        stats = _stats(snapshot)
        created = datetime.now()
        manifest = {
            "format": TRANSFER_FORMAT,
            "created_at": created.isoformat(timespec="seconds"),
            "app_version": APP_VERSION,
            "database": DATABASE_NAME,
            "stats": stats,
        }
        (temp_root / MANIFEST_NAME).write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (temp_root / INFO_NAME).write_text(
            "\n".join(
                [
                    "QUẢN TRỊ LỊCH LÀM CAFE - GÓI CHUYỂN DỮ LIỆU",
                    f"Thời điểm xuất: {created:%d/%m/%Y %H:%M:%S}",
                    f"Phiên bản: {APP_VERSION}",
                    "SQLite integrity_check: OK",
                    "",
                    f"Nhân viên: {stats.get('employees', 0)}",
                    f"Tuần làm việc: {stats.get('weeks', 0)}",
                    f"Lần đánh giá: {stats.get('evaluation_rounds', 0)}",
                    f"Phiếu đánh giá: {stats.get('evaluation_round_employees', 0)}",
                    f"Mã Voucher đã phân: {stats.get('evaluation_voucher_allocations', 0)}",
                    "",
                    "Có thể gửi nguyên file ZIP này qua Zalo rồi dùng nút NHẬP DỮ LIỆU TỪ MÁY KHÁC.",
                ]
            ),
            encoding="utf-8",
        )

        with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.write(snapshot, DATABASE_NAME)
            archive.write(temp_root / MANIFEST_NAME, MANIFEST_NAME)
            archive.write(temp_root / INFO_NAME, INFO_NAME)

    return target


def restore_transfer_package(db: Any, source_zip: Path) -> dict[str, Any]:
    """Kiểm tra ZIP, sao lưu dữ liệu hiện tại, rồi nạp database vào chính kết nối đang dùng."""
    source = Path(source_zip)
    if not source.exists():
        raise TransferDataError("Không tìm thấy file dữ liệu đã chọn.")

    with tempfile.TemporaryDirectory(prefix="quantri_restore_") as temp_dir:
        temp_root = Path(temp_dir)
        extracted_db = temp_root / DATABASE_NAME
        manifest: dict[str, Any] = {}

        try:
            with zipfile.ZipFile(source, "r") as archive:
                names = set(archive.namelist())
                if DATABASE_NAME not in names:
                    raise TransferDataError(f"File ZIP không có {DATABASE_NAME}.")
                with archive.open(DATABASE_NAME, "r") as src, extracted_db.open("wb") as dst:
                    while True:
                        chunk = src.read(1024 * 1024)
                        if not chunk:
                            break
                        dst.write(chunk)
                if MANIFEST_NAME in names:
                    try:
                        manifest = json.loads(archive.read(MANIFEST_NAME).decode("utf-8"))
                    except Exception:
                        manifest = {}
        except zipfile.BadZipFile as exc:
            raise TransferDataError("File đã chọn không phải ZIP hợp lệ.") from exc

        _integrity_check(extracted_db)
        incoming_stats = _stats(extracted_db)

        # Luôn tạo bản sao lưu dữ liệu máy hiện tại trước khi ghi đè.
        backup_path = db.backup("truoc_nhap_du_lieu_may_khac")
        db.conn.commit()
        try:
            db.conn.execute("PRAGMA wal_checkpoint(FULL)")
        except sqlite3.Error:
            pass

        source_conn = sqlite3.connect(extracted_db)
        try:
            source_conn.backup(db.conn)
            db.conn.commit()
        except sqlite3.Error as exc:
            db.conn.rollback()
            raise TransferDataError(f"Không thể nạp dữ liệu vào phần mềm: {exc}") from exc
        finally:
            source_conn.close()

        # Kiểm tra lại database đích sau khi nạp.
        row = db.conn.execute("PRAGMA integrity_check").fetchone()
        if not row or str(row[0]).strip().lower() != "ok":
            raise TransferDataError("Database sau khi nhập không đạt integrity_check.")

        return {
            "backup_path": str(backup_path or ""),
            "manifest": manifest,
            "stats": incoming_stats,
            "source_file": str(source),
        }
