"""Đăng nhập, đăng xuất, đổi mật khẩu, quên mật khẩu."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse

from .db import audit, get_secret_key, now_str
from .emailer import email_configured, send_email
from .security import (
    USER_SQL,
    clear_fails,
    current_user,
    hash_password,
    hash_reset_code,
    login_blocked,
    mask_email,
    password_problem,
    record_fail,
    require_user,
    verify_password,
)
from .web import flash, get_db, render

router = APIRouter()

RESET_MINUTES = 15
RESET_MAX_PER_DAY = 5
RESET_MAX_TRIES = 5


def _find_account(con, login: str):
    login = login.strip()
    if not login:
        return None
    row = con.execute(USER_SQL + " WHERE e.code = ? COLLATE NOCASE", (login,)).fetchone()
    if row:
        return row
    return con.execute(USER_SQL + " WHERE a.login_name = ? COLLATE NOCASE", (login,)).fetchone()


def _go(url: str):
    return RedirectResponse(url, status_code=303)


# ---------------------------------------------------------------------------
@router.get("/dang-nhap")
def login_page(request: Request, con=Depends(get_db)):
    if current_user(request, con):
        return _go("/")
    return render(request, "dang_nhap.html")


@router.post("/dang-nhap")
def login_submit(request: Request, ma: str = Form(""), mat_khau: str = Form(""), con=Depends(get_db)):
    key = ma.strip().lower()
    if login_blocked(key):
        return render(request, "dang_nhap.html", error="Sai mật khẩu quá nhiều lần. Hãy thử lại sau 15 phút.", ma=ma)
    row = _find_account(con, ma)
    if row and row["employee_id"] and row["status"] != "Đang làm":
        return render(request, "dang_nhap.html", error="Tài khoản đã bị khóa vì nhân viên đã ngừng làm.", ma=ma)
    if row and row["locked"]:
        return render(request, "dang_nhap.html", error="Tài khoản đang bị khóa. Hãy liên hệ quản lý.", ma=ma)
    if row and not row["password_hash"]:
        return render(
            request,
            "dang_nhap.html",
            error="Tài khoản chưa có mật khẩu. Hãy nhờ quản lý cấp mật khẩu tạm.",
            ma=ma,
        )
    if not row or not verify_password(mat_khau, row["password_hash"]):
        record_fail(key)
        return render(request, "dang_nhap.html", error="Mã nhân viên hoặc mật khẩu không đúng.", ma=ma)
    clear_fails(key)
    request.session.clear()
    request.session["aid"] = row["account_id"]
    request.session["ver"] = row["session_version"]
    con.execute("UPDATE accounts SET last_login_at = ? WHERE id = ?", (now_str(), row["account_id"]))
    return _go("/doi-mat-khau" if row["must_change"] else "/")


@router.post("/dang-xuat")
def logout(request: Request):
    request.session.clear()
    return _go("/dang-nhap")


# ---------------------------------------------------------------------------
@router.get("/doi-mat-khau")
def change_page(request: Request, con=Depends(get_db)):
    user = require_user(request, con, allow_must_change=True)
    return render(request, "doi_mat_khau.html", user)


@router.post("/doi-mat-khau")
def change_submit(
    request: Request,
    mat_khau_cu: str = Form(""),
    mat_khau_moi: str = Form(""),
    nhap_lai: str = Form(""),
    con=Depends(get_db),
):
    user = require_user(request, con, allow_must_change=True)
    row = con.execute("SELECT password_hash FROM accounts WHERE id = ?", (user.account_id,)).fetchone()
    if not user.must_change and not verify_password(mat_khau_cu, row["password_hash"]):
        return render(request, "doi_mat_khau.html", user, error="Mật khẩu hiện tại không đúng.")
    problem = password_problem(mat_khau_moi, nhap_lai)
    if problem:
        return render(request, "doi_mat_khau.html", user, error=problem)
    if verify_password(mat_khau_moi, row["password_hash"]):
        return render(request, "doi_mat_khau.html", user, error="Mật khẩu mới phải khác mật khẩu đang dùng.")
    con.execute(
        "UPDATE accounts SET password_hash = ?, must_change = 0, password_set_at = ?, password_set_by = ?,"
        " session_version = session_version + 1 WHERE id = ?",
        (hash_password(mat_khau_moi), now_str(), user.account_id, user.account_id),
    )
    new_ver = con.execute("SELECT session_version FROM accounts WHERE id = ?", (user.account_id,)).fetchone()[0]
    request.session["ver"] = new_ver
    audit(con, user.account_id, "doi_mat_khau")
    flash(request, "Đã đổi mật khẩu.")
    return _go("/")


# ---------------------------------------------------------------------------
@router.get("/quen-mat-khau")
def forgot_page(request: Request):
    return render(request, "quen_mat_khau.html", step=1)


@router.post("/quen-mat-khau/gui-ma")
def forgot_send(request: Request, ma: str = Form(""), con=Depends(get_db)):
    row = _find_account(con, ma)
    ctx = {"step": 1, "ma": ma}
    if not row or not row["employee_id"]:
        return render(request, "quen_mat_khau.html", error="Không tìm thấy mã nhân viên này.", **ctx)
    if row["status"] != "Đang làm":
        return render(request, "quen_mat_khau.html", error="Tài khoản đã bị khóa vì nhân viên đã ngừng làm.", **ctx)
    email = (row["email"] or "").strip()
    if not email:
        return render(
            request,
            "quen_mat_khau.html",
            error="Tài khoản này chưa có email. Hãy nhờ quản lý cấp mật khẩu tạm.",
            **ctx,
        )
    import os

    if not email_configured() and os.environ.get("APP_DEBUG_EMAIL") != "1":
        return render(
            request,
            "quen_mat_khau.html",
            error="Web chưa được cài đặt gửi email. Hãy nhờ quản lý cấp mật khẩu tạm.",
            **ctx,
        )
    since = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")
    sent_today = con.execute(
        "SELECT COUNT(*) FROM password_resets WHERE account_id = ? AND created_at >= ?",
        (row["account_id"], since),
    ).fetchone()[0]
    if sent_today >= RESET_MAX_PER_DAY:
        return render(
            request,
            "quen_mat_khau.html",
            error="Đã gửi mã 5 lần trong 24 giờ qua. Hãy thử lại sau hoặc nhờ quản lý cấp mật khẩu tạm.",
            **ctx,
        )
    code = f"{secrets.randbelow(1_000_000):06d}"
    expires = (datetime.now() + timedelta(minutes=RESET_MINUTES)).strftime("%Y-%m-%d %H:%M:%S")
    con.execute("UPDATE password_resets SET used = 1 WHERE account_id = ? AND used = 0", (row["account_id"],))
    con.execute(
        "INSERT INTO password_resets(account_id, code_hash, expires_at, created_at) VALUES (?,?,?,?)",
        (row["account_id"], hash_reset_code(code, get_secret_key()), expires, now_str()),
    )
    try:
        send_email(
            email,
            "Mã khôi phục mật khẩu – Lịch làm",
            f"Chào {row['name']},\n\nMã khôi phục mật khẩu của bạn là: {code}\n"
            f"Mã có hiệu lực {RESET_MINUTES} phút.\n\n"
            "Nếu bạn không yêu cầu, hãy bỏ qua email này.",
        )
    except Exception as exc:  # noqa: BLE001 — báo lỗi gửi mail cho người dùng
        print("Lỗi gửi email:", exc)
        return render(
            request,
            "quen_mat_khau.html",
            error="Không gửi được email lúc này. Hãy thử lại sau hoặc nhờ quản lý cấp mật khẩu tạm.",
            **ctx,
        )
    return render(request, "quen_mat_khau.html", step=2, ma=row["code"], masked=mask_email(email))


@router.post("/quen-mat-khau/dat-lai")
def forgot_reset(
    request: Request,
    ma: str = Form(""),
    ma_khoi_phuc: str = Form(""),
    mat_khau_moi: str = Form(""),
    nhap_lai: str = Form(""),
    con=Depends(get_db),
):
    row = _find_account(con, ma)
    ctx = {"step": 2, "ma": ma}
    if not row:
        return render(request, "quen_mat_khau.html", error="Không tìm thấy mã nhân viên này.", **ctx)
    reset = con.execute(
        "SELECT * FROM password_resets WHERE account_id = ? AND used = 0 ORDER BY id DESC LIMIT 1",
        (row["account_id"],),
    ).fetchone()
    if not reset or reset["expires_at"] < now_str() or reset["attempts"] >= RESET_MAX_TRIES:
        return render(request, "quen_mat_khau.html", step=1, ma=ma, error="Mã đã hết hạn. Hãy gửi mã mới.")
    if hash_reset_code(ma_khoi_phuc.strip(), get_secret_key()) != reset["code_hash"]:
        con.execute("UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?", (reset["id"],))
        return render(request, "quen_mat_khau.html", error="Mã khôi phục không đúng.", **ctx)
    problem = password_problem(mat_khau_moi, nhap_lai)
    if problem:
        return render(request, "quen_mat_khau.html", error=problem, **ctx)
    con.execute("BEGIN")
    con.execute("UPDATE password_resets SET used = 1 WHERE id = ?", (reset["id"],))
    con.execute(
        "UPDATE accounts SET password_hash = ?, must_change = 0, password_set_at = ?, password_set_by = ?,"
        " session_version = session_version + 1 WHERE id = ?",
        (hash_password(mat_khau_moi), now_str(), row["account_id"], row["account_id"]),
    )
    audit(con, row["account_id"], "khoi_phuc_mat_khau")
    con.execute("COMMIT")
    flash(request, "Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.")
    return _go("/dang-nhap")
