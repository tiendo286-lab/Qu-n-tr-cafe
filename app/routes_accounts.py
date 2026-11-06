"""Quản lý tài khoản đăng nhập: xem trạng thái, cấp mật khẩu tạm (từng người / hàng loạt),
khóa – mở khóa, đăng xuất khỏi mọi thiết bị, tạo tài khoản riêng (không phải nhân viên)."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import JSONResponse, RedirectResponse

from .db import ROLE_LABELS, audit, now_str
from .security import hash_password, new_temp_password, require_user
from .web import flash, get_db, render

router = APIRouter(prefix="/quan-ly/tai-khoan")
PERM = "quan_ly_nhan_vien"
LOGIN_RE = re.compile(r"^[A-Za-z0-9._-]{3,30}$")

ACCOUNT_SQL = """
SELECT a.id, a.employee_id, a.login_name, a.display_name, a.system_role, a.must_change, a.locked,
       a.password_hash IS NOT NULL AS has_pw, a.last_login_at, a.password_set_at,
       e.code, e.name, e.rank, e.status, e.email,
       (SELECT group_concat(b.code, ', ') FROM employee_branches eb JOIN branches b ON b.id = eb.branch_id
         WHERE eb.employee_id = e.id) AS branch_codes
FROM accounts a LEFT JOIN employees e ON e.id = a.employee_id
"""


def _bad(message, status=400):
    return JSONResponse({"ok": False, "message": message}, status_code=status)


def _go(url="/quan-ly/tai-khoan"):
    return RedirectResponse(url, status_code=303)


def _state(r) -> str:
    if r["employee_id"] and r["status"] != "Đang làm":
        return "ngung"
    if r["locked"]:
        return "khoa"
    if not r["has_pw"]:
        return "chua_co"
    if r["must_change"]:
        return "tam"
    return "dang_dung"


STATE_LABELS = {
    "dang_dung": ("Đang dùng", "ok"),
    "tam": ("Mật khẩu tạm – chờ đổi", "warn"),
    "chua_co": ("Chưa cấp mật khẩu", "mute"),
    "khoa": ("Đang bị khóa", "off"),
    "ngung": ("Khóa – NV ngừng làm", "off"),
}


def _can_touch(user, target) -> str | None:
    """Trả về lý do không được thao tác (None nếu được)."""
    if target["id"] == user.account_id:
        return "Không thao tác được trên tài khoản của chính bạn (dùng mục Đổi mật khẩu)."
    if target["system_role"] == "chu" and not user.is_owner:
        return "Chỉ Chủ được thao tác trên tài khoản Chủ."
    if target["system_role"] == "ql_tong" and not user.is_owner:
        return "Chỉ Chủ được thao tác trên tài khoản Quản lý tổng."
    return None


def _load(con, account_id):
    return con.execute(ACCOUNT_SQL + " WHERE a.id = ?", (account_id,)).fetchone()


@router.get("")
def accounts_page(request: Request, q: str = "", tt: str = "", vt: str = "", con=Depends(get_db)):
    user = require_user(request, con, perm=PERM)
    rows = con.execute(
        ACCOUNT_SQL + """ ORDER BY CASE a.system_role WHEN 'chu' THEN 0 WHEN 'ql_tong' THEN 1 WHEN 'ql' THEN 2 ELSE 3 END,
                 COALESCE(e.status, 'Đang làm') = 'Ngừng làm', COALESCE(e.name, a.display_name) COLLATE NOCASE"""
    ).fetchall()
    items = []
    counts = {k: 0 for k in STATE_LABELS}
    for r in rows:
        st = _state(r)
        counts[st] += 1
        d = dict(r) | {"state": st, "login": r["code"] or r["login_name"], "who": r["name"] or r["display_name"] or "—"}
        if q and q.casefold() not in f"{d['login']} {d['who']}".casefold():
            continue
        if tt and st != tt:
            continue
        if vt and r["system_role"] != vt:
            continue
        items.append(d)
    return render(
        request, "tai_khoan.html", user, items=items, counts=counts, STATE_LABELS=STATE_LABELS, f=dict(q=q, tt=tt, vt=vt),
        role_choices=[(k, v) for k, v in ROLE_LABELS.items()], printed=request.session.pop("printed_passwords", None),
    )


@router.post("/{account_id}/mat-khau-tam")
def temp_password(account_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm=PERM)
    t = _load(con, account_id)
    if not t:
        return _bad("Không tìm thấy tài khoản.", 404)
    why = _can_touch(user, t)
    if why:
        return _bad(why, 403)
    if t["employee_id"] and t["status"] != "Đang làm":
        return _bad("Nhân viên đã ngừng làm, tài khoản đang bị khóa.")
    temp = new_temp_password()
    con.execute(
        "UPDATE accounts SET password_hash = ?, must_change = 1, password_set_at = ?, password_set_by = ?,"
        " session_version = session_version + 1 WHERE id = ?",
        (hash_password(temp), now_str(), user.account_id, account_id),
    )
    audit(con, user.account_id, "cap_mat_khau_tam", f"account={account_id}")
    return {"ok": True, "password": temp, "name": t["name"] or t["display_name"], "login": t["code"] or t["login_name"]}


@router.post("/hang-loat")
def bulk_temp(request: Request, pham_vi: str = Form("chua_co"), con=Depends(get_db)):
    """Cấp mật khẩu tạm hàng loạt cho người chưa có mật khẩu (hoặc cả người đang chờ đổi)."""
    user = require_user(request, con, perm=PERM)
    rows = con.execute(ACCOUNT_SQL + " WHERE a.employee_id IS NOT NULL AND e.status = 'Đang làm' AND a.locked = 0"
                                     " ORDER BY e.name COLLATE NOCASE").fetchall()
    targets = [r for r in rows if _state(r) in (("chua_co", "tam") if pham_vi == "chua_doi" else ("chua_co",))
               and not _can_touch(user, r)]
    out = []
    con.execute("BEGIN")
    for r in targets:
        temp = new_temp_password()
        con.execute(
            "UPDATE accounts SET password_hash = ?, must_change = 1, password_set_at = ?, password_set_by = ?,"
            " session_version = session_version + 1 WHERE id = ?",
            (hash_password(temp), now_str(), user.account_id, r["id"]),
        )
        out.append({"login": r["code"], "name": r["name"], "branches": r["branch_codes"] or "", "password": temp})
    audit(con, user.account_id, "cap_mat_khau_hang_loat", f"n={len(out)}")
    con.execute("COMMIT")
    if not out:
        flash(request, "Không có tài khoản nào cần cấp mật khẩu.", "error")
        return _go()
    return render(request, "tai_khoan_in.html", user, rows=out, at=now_str()[:16])


@router.post("/{account_id}/khoa")
def toggle_lock(account_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm=PERM)
    t = _load(con, account_id)
    if not t:
        return _bad("Không tìm thấy tài khoản.", 404)
    why = _can_touch(user, t)
    if why:
        return _bad(why, 403)
    new = 0 if t["locked"] else 1
    con.execute("UPDATE accounts SET locked = ?, session_version = session_version + ? WHERE id = ?",
                (new, new, account_id))
    audit(con, user.account_id, "khoa_tai_khoan" if new else "mo_khoa_tai_khoan", f"account={account_id}")
    return {"ok": True, "locked": bool(new)}


@router.post("/{account_id}/dang-xuat")
def force_logout(account_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm=PERM)
    t = _load(con, account_id)
    if not t:
        return _bad("Không tìm thấy tài khoản.", 404)
    why = _can_touch(user, t)
    if why:
        return _bad(why, 403)
    con.execute("UPDATE accounts SET session_version = session_version + 1 WHERE id = ?", (account_id,))
    audit(con, user.account_id, "dang_xuat_moi_thiet_bi", f"account={account_id}")
    return {"ok": True}


@router.post("/tao")
def create_account(request: Request, ten_dang_nhap: str = Form(...), ten: str = Form(...), vai_tro: str = Form("ql"),
                   con=Depends(get_db)):
    """Tài khoản không gắn nhân viên (vd kế toán, người đánh giá, chủ thứ hai). Chỉ Chủ tạo được."""
    user = require_user(request, con, perm="phan_quyen")
    login = ten_dang_nhap.strip()
    name = ten.strip()
    if not LOGIN_RE.match(login):
        flash(request, "Tên đăng nhập 3–30 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch ngang, gạch dưới.", "error")
        return _go()
    if not name or len(name) > 60:
        flash(request, "Hãy nhập tên hiển thị (tối đa 60 ký tự).", "error")
        return _go()
    if vai_tro not in ROLE_LABELS or vai_tro == "nv":
        flash(request, "Vai trò không hợp lệ.", "error")
        return _go()
    clash = con.execute("SELECT 1 FROM accounts WHERE login_name = ? COLLATE NOCASE", (login,)).fetchone() or \
        con.execute("SELECT 1 FROM employees WHERE code = ? COLLATE NOCASE", (login,)).fetchone()
    if clash:
        flash(request, "Tên đăng nhập đã trùng với một tài khoản hoặc mã nhân viên khác.", "error")
        return _go()
    temp = new_temp_password()
    con.execute(
        "INSERT INTO accounts(login_name, display_name, system_role, password_hash, must_change, password_set_at,"
        " password_set_by) VALUES (?,?,?,?,1,?,?)",
        (login, name, vai_tro, hash_password(temp), now_str(), user.account_id),
    )
    audit(con, user.account_id, "tao_tai_khoan", f"{login}:{vai_tro}")
    request.session["printed_passwords"] = {"login": login, "name": name, "password": temp}
    flash(request, f"Đã tạo tài khoản {login}. Mật khẩu tạm hiện bên dưới – chỉ hiện một lần.")
    return _go()


@router.post("/{account_id}/xoa")
def delete_account(account_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="phan_quyen")
    t = _load(con, account_id)
    if not t:
        flash(request, "Không tìm thấy tài khoản.", "error")
        return _go()
    if t["employee_id"]:
        flash(request, "Tài khoản của nhân viên không xóa được; hãy khóa tài khoản hoặc chuyển nhân viên sang Ngừng làm.", "error")
        return _go()
    if t["id"] == user.account_id:
        flash(request, "Không xóa được tài khoản của chính bạn.", "error")
        return _go()
    if t["system_role"] == "chu" and con.execute("SELECT COUNT(*) FROM accounts WHERE system_role = 'chu'").fetchone()[0] <= 1:
        flash(request, "Phải còn ít nhất một tài khoản Chủ.", "error")
        return _go()
    con.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
    audit(con, user.account_id, "xoa_tai_khoan", t["login_name"] or str(account_id))
    flash(request, "Đã xóa tài khoản.")
    return _go()
