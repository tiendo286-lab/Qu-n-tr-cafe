"""Dữ liệu & sao lưu (chỉ Chủ): xuất/nhập gói ZIP như bản offline, sao lưu ngay, tải bản sao lưu."""
from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, RedirectResponse

from . import db as dbm
from .db import audit, connect, now_str
from .legacy.data_transfer import TransferDataError, create_transfer_package, restore_transfer_package
from .legacy.paths import backup_dir
from .offline import get_legacy
from .security import require_user
from .web import drop_upload, file_download, flash, get_db, render, save_upload

router = APIRouter(prefix="/quan-ly/du-lieu")

# Cột/bảng chỉ bản web có: giữ lại khi nhập gói ZIP của bản offline.
ACCOUNT_COLS = ["id", "login_name", "display_name", "system_role", "password_hash", "must_change", "session_version",
                "password_set_at", "password_set_by", "last_login_at", "created_at"]


def _go(url="/quan-ly/du-lieu"):
    return RedirectResponse(url, status_code=303)


def _backups():
    out = []
    for p in sorted(backup_dir().glob("*.sqlite3"), key=lambda x: x.stat().st_mtime, reverse=True):
        st = p.stat()
        out.append({"name": p.name, "size": f"{st.st_size / 1024 / 1024:.1f} MB",
                    "at": datetime.fromtimestamp(st.st_mtime).strftime("%d/%m/%Y %H:%M")})
    return out


@router.get("")
def data_page(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="du_lieu")
    stats = {}
    for label, sql in (
        ("Nhân viên", "SELECT COUNT(*) FROM employees"),
        ("Nhân viên đang làm", "SELECT COUNT(*) FROM employees WHERE status = 'Đang làm'"),
        ("Tuần làm việc", "SELECT COUNT(*) FROM weeks"),
        ("Lần đánh giá", "SELECT COUNT(*) FROM evaluation_rounds"),
        ("Mã voucher đã phân", "SELECT COUNT(*) FROM evaluation_voucher_allocations"),
        ("Tài khoản đã có mật khẩu", "SELECT COUNT(*) FROM accounts WHERE password_hash IS NOT NULL"),
    ):
        try:
            stats[label] = con.execute(sql).fetchone()[0]
        except sqlite3.Error:
            stats[label] = 0
    size = Path(dbm.DB_PATH).stat().st_size / 1024 / 1024
    return render(request, "du_lieu.html", user, stats=stats, size=f"{size:.1f} MB", backups=_backups(),
                  result=request.session.pop("restore_result", None))


@router.get("/xuat")
def export_zip(request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm="du_lieu")
    audit(con, user.account_id, "xuat_du_lieu_zip", "")
    return file_download(lambda p: create_transfer_package(db, p),
                         f"DU_LIEU_QUAN_TRI_LICH_LAM_{datetime.now():%Y%m%d_%H%M}.zip")


@router.post("/sao-luu")
def backup_now(request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm="du_lieu")
    path = db.backup("sao_luu_thu_cong")
    audit(con, user.account_id, "sao_luu", path.name if path else "")
    flash(request, f"Đã sao lưu: {path.name if path else '—'}")
    return _go()


@router.get("/sao-luu/{name}")
def download_backup(name: str, request: Request, con=Depends(get_db)):
    require_user(request, con, perm="du_lieu")
    path = backup_dir() / Path(name).name
    if not path.exists() or path.suffix != ".sqlite3":
        flash(request, "Không tìm thấy bản sao lưu.", "error")
        return _go()
    return FileResponse(path, filename=path.name, media_type="application/octet-stream")


def _snapshot_web_state(con):
    """Lưu tài khoản và thông tin chỉ bản web có, để gắn lại sau khi nhập dữ liệu của bản offline."""
    tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    state = {"accounts": [], "perms": [], "contacts": {}}
    if "accounts" in tables:
        for r in con.execute(
            "SELECT a.*, e.code AS emp_code FROM accounts a LEFT JOIN employees e ON e.id = a.employee_id"
        ):
            state["accounts"].append(dict(r))
    if "role_permissions" in tables:
        state["perms"] = [dict(r) for r in con.execute("SELECT * FROM role_permissions")]
    cols = {r[1] for r in con.execute("PRAGMA table_info(employees)")}
    if {"email", "phone", "start_date"} <= cols:
        for r in con.execute("SELECT code, email, phone, start_date FROM employees"):
            state["contacts"][str(r["code"]).casefold()] = dict(r)
    return state


def _reattach_web_state(state) -> dict:
    """Sau khi nạp file offline: nâng cấp cấu trúc rồi gắn lại tài khoản theo mã nhân viên."""
    con = connect()
    kept = 0
    try:
        dbm.run_migrations(con)
        has_accounts = con.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
        con.execute("BEGIN")
        if not has_accounts and state["accounts"]:
            by_code = {str(r["code"]).casefold(): r["id"] for r in con.execute("SELECT id, code FROM employees")}
            for a in state["accounts"]:
                if a["employee_id"] is None:
                    emp_id = None
                else:
                    emp_id = by_code.get(str(a.get("emp_code") or "").casefold())
                    if emp_id is None:
                        continue
                con.execute(
                    f"INSERT INTO accounts(employee_id, {', '.join(ACCOUNT_COLS)}) VALUES (?{', ?' * len(ACCOUNT_COLS)})",
                    (emp_id, *[a.get(c) for c in ACCOUNT_COLS]),
                )
                kept += 1
            for p in state["perms"]:
                con.execute(
                    "INSERT INTO role_permissions(role, perm, allowed, updated_at) VALUES (?,?,?,?)"
                    " ON CONFLICT(role, perm) DO UPDATE SET allowed = excluded.allowed",
                    (p["role"], p["perm"], p["allowed"], p.get("updated_at") or now_str()),
                )
            for code, c in state["contacts"].items():
                con.execute(
                    "UPDATE employees SET email = COALESCE(email, ?), phone = COALESCE(phone, ?),"
                    " start_date = COALESCE(start_date, ?) WHERE code = ? COLLATE NOCASE",
                    (c["email"], c["phone"], c["start_date"], c["code"]),
                )
        dbm.ensure_accounts(con)
        dbm.ensure_owner(con)
        con.execute("COMMIT")
    finally:
        con.close()
    return {"kept": kept}


@router.post("/nhap")
async def import_zip(request: Request, file: UploadFile = File(...), xac_nhan: str = Form(""),
                     con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm="du_lieu")
    if xac_nhan.strip().upper() != "NHAP":
        flash(request, "Gõ NHAP để xác nhận ghi đè dữ liệu.", "error")
        return _go()
    path = None
    try:
        path = await save_upload(file, (".zip",))
        state = _snapshot_web_state(con)
        con.close()
        result = restore_transfer_package(db, path)
        db.conn.close()
    except (TransferDataError, ValueError, OSError) as exc:
        flash(request, f"Không nhập được dữ liệu: {exc}", "error")
        return _go()
    finally:
        drop_upload(path)
    info = _reattach_web_state(state)
    con2 = connect()
    try:
        audit(con2, user.account_id, "nhap_du_lieu_zip", str(result.get("stats")))
    finally:
        con2.close()
    stats = result.get("stats") or {}
    request.session["restore_result"] = {
        "backup": Path(result.get("backup_path") or "").name, "stats": stats, "kept": info["kept"],
        "created": (result.get("manifest") or {}).get("created_at", ""),
    }
    flash(request, "Đã nhập dữ liệu. Dữ liệu cũ đã được sao lưu trước khi ghi đè.")
    return _go()
