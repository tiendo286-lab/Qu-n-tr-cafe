"""Tab Phân quyền và cấp mật khẩu tạm cho nhân viên."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from .db import NV_ALWAYS, NV_EDITABLE, OWNER_ONLY, PERM_KEYS, PERMISSIONS, ROLE_LABELS, audit, now_str
from .security import hash_password, new_temp_password, require_user
from .web import get_db, render

router = APIRouter(prefix="/quan-ly")

EDITABLE_ROLES = ["ql_tong", "ql", "nv"]
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _bad(message: str, status: int = 400):
    return JSONResponse({"ok": False, "message": message}, status_code=status)


# ---------------------------------------------------------------------------
# Phân quyền (chỉ Chủ)
# ---------------------------------------------------------------------------
@router.get("/phan-quyen")
def permissions_page(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="phan_quyen")
    rows = con.execute("SELECT role, perm, allowed FROM role_permissions").fetchall()
    allowed = {(r["role"], r["perm"]): r["allowed"] for r in rows}
    matrix = []
    for key, label in PERMISSIONS:
        cells = []
        for role in EDITABLE_ROLES:
            if role == "nv" and key in NV_ALWAYS:
                cells.append({"kind": "always"})
            elif role == "nv" and key not in NV_EDITABLE:
                cells.append({"kind": "na"})
            else:
                cells.append({"kind": "box", "role": role, "on": bool(allowed.get((role, key), 0))})
        matrix.append({"key": key, "label": label, "cells": cells})
    users = con.execute(
        """
        SELECT a.id, a.system_role, a.login_name, a.password_hash IS NOT NULL AS has_pw,
               e.code, e.name, e.rank, e.status
        FROM accounts a LEFT JOIN employees e ON e.id = a.employee_id
        ORDER BY CASE a.system_role WHEN 'chu' THEN 0 WHEN 'ql_tong' THEN 1 WHEN 'ql' THEN 2 ELSE 3 END,
                 e.status = 'Ngừng làm', e.name COLLATE NOCASE
        """
    ).fetchall()
    return render(
        request,
        "phan_quyen.html",
        user,
        matrix=matrix,
        owner_only=OWNER_ONLY,
        users=users,
        role_choices=[(r, ROLE_LABELS[r]) for r in EDITABLE_ROLES],
    )


@router.post("/phan-quyen/quyen")
async def permissions_toggle(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="phan_quyen")
    data = await request.json()
    role, perm, on = data.get("role"), data.get("perm"), 1 if data.get("allowed") else 0
    if role not in EDITABLE_ROLES or perm not in PERM_KEYS:
        return _bad("Quyền không hợp lệ.")
    if role == "nv" and perm not in NV_EDITABLE:
        return _bad("Quyền này không cấp được cho Nhân viên.")
    con.execute(
        "INSERT INTO role_permissions(role, perm, allowed, updated_at) VALUES (?,?,?,?)"
        " ON CONFLICT(role, perm) DO UPDATE SET allowed = excluded.allowed, updated_at = excluded.updated_at",
        (role, perm, on, now_str()),
    )
    audit(con, user.account_id, "sua_quyen", f"{role}.{perm}={on}")
    return {"ok": True, "saved_at": now_str()[11:16]}


@router.post("/phan-quyen/vai-tro")
async def set_role(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="phan_quyen")
    data = await request.json()
    try:
        account_id = int(data.get("account_id"))
    except (TypeError, ValueError):
        return _bad("Tài khoản không hợp lệ.")
    role = data.get("role")
    if role not in EDITABLE_ROLES:
        return _bad("Vai trò không hợp lệ.")
    row = con.execute("SELECT system_role FROM accounts WHERE id = ?", (account_id,)).fetchone()
    if not row:
        return _bad("Không tìm thấy tài khoản.", 404)
    if row["system_role"] == "chu":
        return _bad("Không đổi được vai trò của Chủ.")
    con.execute("UPDATE accounts SET system_role = ? WHERE id = ?", (role, account_id))
    audit(con, user.account_id, "doi_vai_tro", f"{account_id}:{row['system_role']}->{role}")
    return {"ok": True, "saved_at": now_str()[11:16]}


# ---------------------------------------------------------------------------
# Nhân viên: email, số điện thoại, mật khẩu tạm (bước 2 sẽ thêm sửa đầy đủ)
# ---------------------------------------------------------------------------
def _account_state(row) -> str:
    if not row["has_pw"]:
        return "chua_co"
    return "tam" if row["must_change"] else "da_dat"


@router.get("/nhan-vien")
def employees_page(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="quan_ly_nhan_vien")
    rows = con.execute(
        """
        SELECT e.id, e.code, e.name, e.rank, e.status, e.email, e.phone,
               a.id AS account_id, a.system_role, a.must_change, a.password_hash IS NOT NULL AS has_pw,
               (SELECT group_concat(b.code, ', ') FROM employee_branches eb JOIN branches b ON b.id = eb.branch_id
                 WHERE eb.employee_id = e.id) AS branch_codes,
               (SELECT group_concat(er.role, ', ') FROM employee_roles er WHERE er.employee_id = e.id) AS work_roles
        FROM employees e JOIN accounts a ON a.employee_id = e.id
        ORDER BY e.status = 'Ngừng làm', e.name COLLATE NOCASE
        """
    ).fetchall()
    employees = [dict(r) | {"state": _account_state(r)} for r in rows]
    from .catalog import RANKS

    return render(request, "nhan_vien.html", user, employees=employees, RANKS=RANKS)


@router.post("/nhan-vien/{employee_id}/mat-khau-tam")
def issue_temp_password(employee_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="quan_ly_nhan_vien")
    row = con.execute(
        "SELECT a.id, a.system_role, e.status, e.name FROM accounts a JOIN employees e ON e.id = a.employee_id"
        " WHERE e.id = ?",
        (employee_id,),
    ).fetchone()
    if not row:
        return _bad("Không tìm thấy nhân viên.", 404)
    if row["status"] != "Đang làm":
        return _bad("Nhân viên đã ngừng làm, tài khoản đang bị khóa.")
    if row["system_role"] == "ql_tong" and not user.is_owner:
        return _bad("Chỉ Chủ được cấp mật khẩu cho Quản lý tổng.", 403)
    if row["id"] == user.account_id:
        return _bad("Hãy dùng mục Đổi mật khẩu cho tài khoản của chính bạn.")
    temp = new_temp_password()
    con.execute(
        "UPDATE accounts SET password_hash = ?, must_change = 1, password_set_at = ?, password_set_by = ?,"
        " session_version = session_version + 1 WHERE id = ?",
        (hash_password(temp), now_str(), user.account_id, row["id"]),
    )
    audit(con, user.account_id, "cap_mat_khau_tam", f"employee={employee_id}")
    return {"ok": True, "password": temp, "name": row["name"]}


@router.post("/nhan-vien/{employee_id}/cap-bac")
async def update_rank(employee_id: int, request: Request, con=Depends(get_db)):
    from .catalog import RANKS

    user = require_user(request, con, perm="quan_ly_nhan_vien")
    data = await request.json()
    rank = data.get("rank")
    if rank not in RANKS:
        return _bad("Cấp bậc không hợp lệ.")
    row = con.execute(
        "SELECT e.rank, a.system_role, a.id AS account_id FROM employees e JOIN accounts a ON a.employee_id = e.id"
        " WHERE e.id = ?",
        (employee_id,),
    ).fetchone()
    if not row:
        return _bad("Không tìm thấy nhân viên.", 404)
    if row["system_role"] == "ql_tong" and not user.is_owner and row["account_id"] != user.account_id:
        return _bad("Chỉ Chủ được sửa thông tin của Quản lý tổng.", 403)
    con.execute("UPDATE employees SET rank = ?, updated_at = ? WHERE id = ?", (rank, now_str(), employee_id))
    audit(con, user.account_id, "sua_cap_bac", f"employee={employee_id}:{row['rank']}->{rank}")
    return {"ok": True, "saved_at": now_str()[11:16]}
