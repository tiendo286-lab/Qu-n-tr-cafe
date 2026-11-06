"""Bước 2 – Danh mục: chi nhánh, ca & giờ ca, vai trò làm việc, nhân viên, định biên, lịch cố định."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, RedirectResponse

from . import catalog as cat
from .catalog import Invalid
from .db import audit, now_str
from .security import require_user
from .web import flash, get_db, render

router = APIRouter(prefix="/quan-ly")


def _bad(message, status=400):
    return JSONResponse({"ok": False, "message": message}, status_code=status)


def _saved():
    return {"ok": True, "saved_at": now_str()[11:16]}


def _go(url):
    return RedirectResponse(url, status_code=303)


async def _json(request):
    try:
        return await request.json()
    except ValueError:
        return {}


# ===========================================================================
# Chi nhánh, ca & vai trò làm việc
# ===========================================================================
@router.get("/chi-nhanh")
def catalog_page(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="sua_danh_muc")
    return render(
        request,
        "chi_nhanh.html",
        user,
        branches=cat.branches(con),
        shifts=cat.shifts(con),
        bs=cat.branch_shift_map(con),
        roles=cat.work_roles(con),
        BRANCH_ACTIVE=cat.BRANCH_ACTIVE,
        BRANCH_STOPPED=cat.BRANCH_STOPPED,
        IN_USE=cat.IN_USE,
        NOT_IN_USE=cat.NOT_IN_USE,
    )


@router.post("/chi-nhanh/them")
async def add_branch(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="sua_danh_muc")
    form = await request.form()
    try:
        code = cat.clean_text(form.get("code"), "Mã chi nhánh", 10)
        name = cat.clean_text(form.get("name"), "Tên chi nhánh", 80)
        if con.execute("SELECT 1 FROM branches WHERE code = ? COLLATE NOCASE", (code,)).fetchone():
            raise Invalid(f"Mã chi nhánh {code} đã có.")
    except Invalid as e:
        flash(request, str(e), "error")
        return _go("/quan-ly/chi-nhanh")
    con.execute("BEGIN")
    order = con.execute("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM branches").fetchone()[0]
    cur = con.execute(
        "INSERT INTO branches(code, name, sort_order, system_code, display_code, status) VALUES (?,?,?,?,?,?)",
        (code, name, order, code, code, cat.BRANCH_ACTIVE),
    )
    bid = cur.lastrowid
    # Giờ ca mặc định: chép từ chi nhánh đầu tiên
    first = con.execute("SELECT id FROM branches WHERE id <> ? ORDER BY sort_order, id LIMIT 1", (bid,)).fetchone()
    for s in cat.shifts(con):
        src = con.execute(
            "SELECT enabled, start_time, end_time FROM branch_shifts WHERE branch_id = ? AND shift_id = ?",
            (first["id"] if first else -1, s["id"]),
        ).fetchone()
        con.execute(
            "INSERT OR IGNORE INTO branch_shifts(branch_id, shift_id, enabled, start_time, end_time, sort_order)"
            " VALUES (?,?,?,?,?,?)",
            (bid, s["id"], src["enabled"] if src else 0, src["start_time"] if src else None,
             src["end_time"] if src else None, s["sort_order"]),
        )
    audit(con, user.account_id, "them_chi_nhanh", code)
    con.execute("COMMIT")
    flash(request, f"Đã thêm chi nhánh {code}. Hãy kiểm tra giờ ca của chi nhánh này.")
    return _go("/quan-ly/chi-nhanh")


@router.post("/chi-nhanh/{branch_id}")
async def update_branch(branch_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="sua_danh_muc")
    data = await _json(request)
    row = con.execute("SELECT * FROM branches WHERE id = ?", (branch_id,)).fetchone()
    if not row:
        return _bad("Không tìm thấy chi nhánh.", 404)
    try:
        code = cat.clean_text(data.get("code", row["code"]), "Mã chi nhánh", 10)
        name = cat.clean_text(data.get("name", row["name"]), "Tên chi nhánh", 80)
        status = data.get("status", row["status"])
        if status not in (cat.BRANCH_ACTIVE, cat.BRANCH_STOPPED):
            raise Invalid("Trạng thái không hợp lệ.")
        if con.execute("SELECT 1 FROM branches WHERE code = ? COLLATE NOCASE AND id <> ?", (code, branch_id)).fetchone():
            raise Invalid(f"Mã chi nhánh {code} đã có.")
    except Invalid as e:
        return _bad(str(e))
    con.execute(
        "UPDATE branches SET code = ?, name = ?, status = ?, display_code = ? WHERE id = ?",
        (code, name, status, code, branch_id),
    )
    audit(con, user.account_id, "sua_chi_nhanh", f"{branch_id}:{code}|{name}|{status}")
    return _saved()


@router.post("/ca/them")
async def add_shift(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="sua_danh_muc")
    form = await request.form()
    try:
        name = cat.clean_text(form.get("name"), "Tên ca", 30)
        code = cat.clean_text(form.get("code"), "Mã ca", 5)
        if con.execute("SELECT 1 FROM shifts WHERE name = ? COLLATE NOCASE OR code = ? COLLATE NOCASE", (name, code)).fetchone():
            raise Invalid("Tên ca hoặc mã ca đã có.")
    except Invalid as e:
        flash(request, str(e), "error")
        return _go("/quan-ly/chi-nhanh")
    con.execute("BEGIN")
    order = con.execute("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM shifts").fetchone()[0]
    sid = con.execute(
        "INSERT INTO shifts(code, name, status, sort_order) VALUES (?,?,?,?)", (code, name, cat.IN_USE, order)
    ).lastrowid
    for b in cat.branches(con):
        con.execute(
            "INSERT OR IGNORE INTO branch_shifts(branch_id, shift_id, enabled, sort_order) VALUES (?,?,0,?)",
            (b["id"], sid, order),
        )
    audit(con, user.account_id, "them_ca", name)
    con.execute("COMMIT")
    flash(request, f"Đã thêm ca {name}. Bật ca và nhập giờ cho từng chi nhánh có ca này.")
    return _go("/quan-ly/chi-nhanh")


@router.post("/ca/{shift_id}")
async def update_shift(shift_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="sua_danh_muc")
    data = await _json(request)
    row = con.execute("SELECT * FROM shifts WHERE id = ?", (shift_id,)).fetchone()
    if not row:
        return _bad("Không tìm thấy ca.", 404)
    try:
        name = cat.clean_text(data.get("name", row["name"]), "Tên ca", 30)
        code = cat.clean_text(data.get("code", row["code"]), "Mã ca", 5)
        status = data.get("status", row["status"])
        if status not in (cat.IN_USE, cat.NOT_IN_USE):
            raise Invalid("Trạng thái không hợp lệ.")
        if con.execute(
            "SELECT 1 FROM shifts WHERE (name = ? COLLATE NOCASE OR code = ? COLLATE NOCASE) AND id <> ?",
            (name, code, shift_id),
        ).fetchone():
            raise Invalid("Tên ca hoặc mã ca đã có.")
        if status == cat.NOT_IN_USE and row["status"] == cat.IN_USE:
            if con.execute(f"SELECT COUNT(*) FROM shifts WHERE status = '{cat.IN_USE}'").fetchone()[0] <= 1:
                raise Invalid("Phải còn ít nhất một ca đang sử dụng.")
    except Invalid as e:
        return _bad(str(e))
    con.execute("BEGIN")
    if name != row["name"]:
        cat.rename_shift(con, row["name"], name)
    con.execute(
        "UPDATE shifts SET name = ?, code = ?, status = ?, updated_at = ? WHERE id = ?",
        (name, code, status, now_str(), shift_id),
    )
    audit(con, user.account_id, "sua_ca", f"{shift_id}:{row['name']}->{name}|{status}")
    con.execute("COMMIT")
    return _saved()


@router.post("/gio-ca")
async def update_branch_shift(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="sua_danh_muc")
    data = await _json(request)
    try:
        bid, sid = int(data.get("branch_id")), int(data.get("shift_id"))
    except (TypeError, ValueError):
        return _bad("Dữ liệu không hợp lệ.")
    enabled = 1 if data.get("enabled") else 0
    try:
        start = cat.clean_time(data.get("start_time"), "Giờ bắt đầu") if enabled or data.get("start_time") else None
        end = cat.clean_time(data.get("end_time"), "Giờ kết thúc") if enabled or data.get("end_time") else None
    except Invalid as e:
        return _bad(str(e))
    if not con.execute("SELECT 1 FROM branches WHERE id = ?", (bid,)).fetchone() or not con.execute(
        "SELECT 1 FROM shifts WHERE id = ?", (sid,)
    ).fetchone():
        return _bad("Không tìm thấy chi nhánh hoặc ca.", 404)
    con.execute(
        "INSERT INTO branch_shifts(branch_id, shift_id, enabled, start_time, end_time, updated_at) VALUES (?,?,?,?,?,?)"
        " ON CONFLICT(branch_id, shift_id) DO UPDATE SET enabled = excluded.enabled, start_time = excluded.start_time,"
        " end_time = excluded.end_time, updated_at = excluded.updated_at",
        (bid, sid, enabled, start, end, now_str()),
    )
    audit(con, user.account_id, "sua_gio_ca", f"{bid}/{sid}:{enabled} {start}-{end}")
    return _saved()


@router.post("/vai-tro-lam-viec/them")
async def add_work_role(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="sua_danh_muc")
    form = await request.form()
    try:
        name = cat.clean_text(form.get("name"), "Tên vai trò", 30)
        if con.execute("SELECT 1 FROM work_roles WHERE name = ? COLLATE NOCASE", (name,)).fetchone():
            raise Invalid(f"Vai trò {name} đã có.")
    except Invalid as e:
        flash(request, str(e), "error")
        return _go("/quan-ly/chi-nhanh")
    order = con.execute("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM work_roles").fetchone()[0]
    con.execute("INSERT INTO work_roles(name, sort_order) VALUES (?, ?)", (name, order))
    audit(con, user.account_id, "them_vai_tro", name)
    flash(request, f"Đã thêm vai trò {name}.")
    return _go("/quan-ly/chi-nhanh")


@router.post("/vai-tro-lam-viec/{role_id}")
async def update_work_role(role_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="sua_danh_muc")
    data = await _json(request)
    row = con.execute("SELECT * FROM work_roles WHERE id = ?", (role_id,)).fetchone()
    if not row:
        return _bad("Không tìm thấy vai trò.", 404)
    try:
        name = cat.clean_text(data.get("name", row["name"]), "Tên vai trò", 30)
        status = data.get("status", row["status"])
        if status not in (cat.IN_USE, cat.NOT_IN_USE):
            raise Invalid("Trạng thái không hợp lệ.")
        if con.execute("SELECT 1 FROM work_roles WHERE name = ? COLLATE NOCASE AND id <> ?", (name, role_id)).fetchone():
            raise Invalid(f"Vai trò {name} đã có.")
    except Invalid as e:
        return _bad(str(e))
    con.execute("BEGIN")
    if name != row["name"]:
        cat.rename_role(con, row["name"], name)
    con.execute("UPDATE work_roles SET name = ?, status = ? WHERE id = ?", (name, status, role_id))
    audit(con, user.account_id, "sua_vai_tro", f"{row['name']}->{name}|{status}")
    con.execute("COMMIT")
    return _saved()


# ===========================================================================
# Nhân viên: thêm / sửa
# ===========================================================================
def _employee_form_ctx(con, emp=None, values=None, error=None):
    return dict(
        emp=emp,
        v=values or {},
        error=error,
        RANKS=cat.RANKS,
        EMP_STATUSES=cat.EMP_STATUSES,
        all_roles=cat.work_roles(con, active_only=True),
        all_branches=cat.branches(con),
    )


def _save_employee(con, data, employee_id=None):
    now = now_str()
    if employee_id is None:
        employee_id = con.execute(
            "INSERT INTO employees(code, name, rank, status, preferred_role, email, phone, start_date, created_at, updated_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?)",
            (data["code"], data["name"], data["rank"], data["status"], data["preferred_role"],
             data["email"], data["phone"], data["start_date"], now, now),
        ).lastrowid
        role = "ql" if data["rank"] == "Quản lý" else "nv"
        con.execute("INSERT INTO accounts(employee_id, system_role) VALUES (?, ?)", (employee_id, role))
    else:
        con.execute(
            "UPDATE employees SET code=?, name=?, rank=?, status=?, preferred_role=?, email=?, phone=?, start_date=?,"
            " updated_at=? WHERE id=?",
            (data["code"], data["name"], data["rank"], data["status"], data["preferred_role"],
             data["email"], data["phone"], data["start_date"], now, employee_id),
        )
    con.execute("DELETE FROM employee_roles WHERE employee_id = ?", (employee_id,))
    con.executemany("INSERT INTO employee_roles(employee_id, role) VALUES (?, ?)", [(employee_id, r) for r in data["roles"]])
    con.execute("DELETE FROM employee_branches WHERE employee_id = ?", (employee_id,))
    con.executemany(
        "INSERT INTO employee_branches(employee_id, branch_id) VALUES (?, ?)", [(employee_id, b) for b in data["branch_ids"]]
    )
    # Lịch cố định không còn hợp lệ (bỏ chi nhánh/vai trò) thì xóa ô đó
    marks = ",".join("?" * len(data["branch_ids"]))
    rmarks = ",".join("?" * len(data["roles"]))
    con.execute(
        f"DELETE FROM fixed_schedule_entries WHERE employee_id = ? AND (branch_id NOT IN ({marks}) OR role NOT IN ({rmarks}))",
        (employee_id, *data["branch_ids"], *data["roles"]),
    )
    return employee_id


@router.get("/nhan-vien/them")
def new_employee_page(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="quan_ly_nhan_vien")
    return render(request, "nhan_vien_form.html", user, **_employee_form_ctx(con, values={"status": "Đang làm"}))


@router.post("/nhan-vien/them")
async def new_employee_submit(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="quan_ly_nhan_vien")
    form = await request.form()
    try:
        data = cat.clean_employee_form(con, form)
    except Invalid as e:
        return render(request, "nhan_vien_form.html", user, **_employee_form_ctx(con, values=_form_values(form), error=str(e)))
    con.execute("BEGIN")
    _save_employee(con, data)
    audit(con, user.account_id, "them_nhan_vien", data["code"])
    con.execute("COMMIT")
    flash(request, f"Đã thêm {data['code']} – {data['name']}. Bấm “Cấp mật khẩu tạm” để nhân viên đăng nhập.")
    return _go("/quan-ly/nhan-vien")


def _form_values(form):
    return {
        "code": form.get("code", ""), "name": form.get("name", ""), "rank": form.get("rank", ""),
        "status": form.get("status", "Đang làm"), "roles": form.getlist("roles"),
        "preferred_role": form.get("preferred_role", ""),
        "branch_ids": [int(b) for b in form.getlist("branches") if b.isdigit()],
        "email": form.get("email", ""), "phone": form.get("phone", ""), "start_date": form.get("start_date", ""),
    }


@router.get("/nhan-vien/{employee_id}")
def edit_employee_page(employee_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="quan_ly_nhan_vien")
    d = cat.employee_detail(con, employee_id)
    if not d:
        flash(request, "Không tìm thấy nhân viên.", "error")
        return _go("/quan-ly/nhan-vien")
    e = d["emp"]
    values = {
        "code": e["code"], "name": e["name"], "rank": e["rank"], "status": e["status"], "roles": d["roles"],
        "preferred_role": e["preferred_role"] or "", "branch_ids": d["branch_ids"], "email": e["email"] or "",
        "phone": e["phone"] or "", "start_date": e["start_date"] or "",
    }
    return render(request, "nhan_vien_form.html", user, **_employee_form_ctx(con, emp=e, values=values))


@router.post("/nhan-vien/{employee_id}")
async def edit_employee_submit(employee_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="quan_ly_nhan_vien")
    d = cat.employee_detail(con, employee_id)
    if not d:
        return _go("/quan-ly/nhan-vien")
    form = await request.form()
    try:
        data = cat.clean_employee_form(con, form, employee_id)
        acc = con.execute("SELECT id, system_role FROM accounts WHERE employee_id = ?", (employee_id,)).fetchone()
        if acc and acc["id"] == user.account_id and data["status"] != "Đang làm":
            raise Invalid("Bạn không thể tự chuyển mình sang Ngừng làm.")
        if acc and acc["system_role"] == "ql_tong" and not user.is_owner and acc["id"] != user.account_id:
            raise Invalid("Chỉ Chủ được sửa thông tin của Quản lý tổng.")
    except Invalid as e:
        return render(
            request, "nhan_vien_form.html", user,
            **_employee_form_ctx(con, emp=d["emp"], values=_form_values(form), error=str(e)),
        )
    old = d["emp"]
    con.execute("BEGIN")
    _save_employee(con, data, employee_id)
    audit(con, user.account_id, "sua_nhan_vien", f"{employee_id}:{old['code']}->{data['code']}|{data['status']}")
    con.execute("COMMIT")
    msg = f"Đã lưu {data['code']} – {data['name']}."
    if old["code"] != data["code"]:
        msg += f" Từ giờ nhân viên đăng nhập bằng mã mới {data['code']}."
    if old["status"] == "Đang làm" and data["status"] != "Đang làm":
        msg += " Tài khoản đã bị khóa."
    flash(request, msg)
    return _go("/quan-ly/nhan-vien")


# ===========================================================================
# Định biên
# ===========================================================================
@router.get("/dinh-bien")
def staffing_page(request: Request, cn: Optional[int] = None, con=Depends(get_db)):
    user = require_user(request, con, perm="sua_danh_muc")
    brs = cat.branches(con, active_only=True)
    if not brs:
        return render(request, "thong_bao_loi.html", user, title="Định biên", message="Chưa có chi nhánh đang hoạt động.")
    branch = next((b for b in brs if b["id"] == cn), brs[0])
    shift_rows = cat.enabled_shifts_for_branch(con, branch["id"])
    roles = cat.work_roles(con, active_only=True)
    req = {
        (r["weekday"], r["shift"], r["role"]): r["required_count"]
        for r in con.execute("SELECT * FROM staffing_requirements WHERE branch_id = ?", (branch["id"],))
    }
    blocks = []
    for s in shift_rows:
        rows = []
        for role in roles:
            rows.append({"role": role["name"], "counts": [req.get((d, s["name"], role["name"]), 0) for d in range(7)]})
        totals = [sum(r["counts"][d] for r in rows) for d in range(7)]
        blocks.append({"shift": s, "rows": rows, "totals": totals})
    return render(
        request, "dinh_bien.html", user, branches=brs, branch=branch, blocks=blocks, WEEKDAYS=cat.WEEKDAYS,
        updated=con.execute(
            "SELECT MAX(updated_at) FROM staffing_requirements WHERE branch_id = ?", (branch["id"],)
        ).fetchone()[0],
    )


@router.post("/dinh-bien")
async def staffing_save(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="sua_danh_muc")
    data = await _json(request)
    try:
        bid, weekday, count = int(data.get("branch_id")), int(data.get("weekday")), int(data.get("count"))
    except (TypeError, ValueError):
        return _bad("Số người phải là số nguyên.")
    shift, role = data.get("shift"), data.get("role")
    if not 0 <= weekday <= 6 or not 0 <= count <= 50:
        return _bad("Số người phải từ 0 đến 50.")
    if not any(s["name"] == shift for s in cat.enabled_shifts_for_branch(con, bid)):
        return _bad("Ca này không bật ở chi nhánh.")
    if not con.execute("SELECT 1 FROM work_roles WHERE name = ?", (role,)).fetchone():
        return _bad("Vai trò không hợp lệ.")
    con.execute(
        "INSERT INTO staffing_requirements(branch_id, weekday, shift, role, required_count, updated_at) VALUES (?,?,?,?,?,?)"
        " ON CONFLICT(branch_id, weekday, shift, role) DO UPDATE SET required_count = excluded.required_count,"
        " updated_at = excluded.updated_at",
        (bid, weekday, shift, role, count, now_str()),
    )
    audit(con, user.account_id, "sua_dinh_bien", f"{bid}/{weekday}/{shift}/{role}={count}")
    return _saved()


# ===========================================================================
# Lịch cố định
# ===========================================================================
def _fixed_options(con, employee_id, emp_branch_ids, emp_roles, branch_rows, bs_map, shift_row):
    opts = []
    for b in branch_rows:
        if b["id"] not in emp_branch_ids:
            continue
        cfg = bs_map.get((b["id"], shift_row["id"]))
        if not cfg or not cfg["enabled"]:
            continue
        for r in emp_roles:
            opts.append({"value": f"{b['id']}|{r}", "label": f"{b['code']}-{cat.role_abbr(r)}", "title": f"{b['name']} – {r}"})
    return opts


@router.get("/lich-co-dinh")
def fixed_page(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="sua_danh_muc")
    shift_rows = cat.shifts(con, active_only=True)
    branch_rows = cat.branches(con, active_only=True)
    bs_map = cat.branch_shift_map(con)
    members = con.execute(
        """
        SELECT e.id, e.code, e.name, e.rank, e.status FROM fixed_schedule_members m
        JOIN employees e ON e.id = m.employee_id ORDER BY e.status = 'Ngừng làm', e.name COLLATE NOCASE
        """
    ).fetchall()
    entries = {}
    for r in con.execute("SELECT * FROM fixed_schedule_entries"):
        entries[(r["employee_id"], r["weekday"], r["shift"])] = f"{r['branch_id']}|{r['role']}"
    rows = []
    role_counts: dict[str, int] = {}
    total = 0
    for m in members:
        d = cat.employee_detail(con, m["id"])
        cells = []
        for wd in range(7):
            for s in shift_rows:
                val = entries.get((m["id"], wd, s["name"]), "")
                if val:
                    total += 1
                    role = val.split("|", 1)[1]
                    role_counts[role] = role_counts.get(role, 0) + 1
                cells.append({
                    "weekday": wd, "shift_id": s["id"], "value": val,
                    "options": _fixed_options(con, m["id"], d["branch_ids"], d["roles"], branch_rows, bs_map, s),
                })
        rows.append({
            "emp": m, "cells": cells,
            "branches": ", ".join(b["code"] for b in branch_rows if b["id"] in d["branch_ids"]),
            "roles": ", ".join(d["roles"]),
        })
    candidates = con.execute(
        "SELECT id, code, name FROM employees WHERE status = 'Đang làm' AND id NOT IN"
        " (SELECT employee_id FROM fixed_schedule_members) ORDER BY name COLLATE NOCASE"
    ).fetchall()
    return render(
        request, "lich_co_dinh.html", user, rows=rows, shifts=shift_rows, WEEKDAYS=cat.WEEKDAYS,
        candidates=candidates, total=total, role_counts=role_counts,
    )


@router.post("/lich-co-dinh/them")
async def fixed_add(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="sua_danh_muc")
    form = await request.form()
    try:
        eid = int(form.get("employee_id"))
    except (TypeError, ValueError):
        flash(request, "Hãy chọn nhân viên.", "error")
        return _go("/quan-ly/lich-co-dinh")
    if not con.execute("SELECT 1 FROM employees WHERE id = ? AND status = 'Đang làm'", (eid,)).fetchone():
        flash(request, "Không tìm thấy nhân viên đang làm.", "error")
        return _go("/quan-ly/lich-co-dinh")
    con.execute("INSERT OR IGNORE INTO fixed_schedule_members(employee_id, added_at) VALUES (?, ?)", (eid, now_str()))
    audit(con, user.account_id, "them_lich_co_dinh", str(eid))
    flash(request, "Đã thêm vào lịch cố định. Chọn chi nhánh – vị trí cho từng ô.")
    return _go("/quan-ly/lich-co-dinh")


@router.post("/lich-co-dinh/{employee_id}/xoa")
def fixed_remove(employee_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="sua_danh_muc")
    con.execute("BEGIN")
    con.execute("DELETE FROM fixed_schedule_entries WHERE employee_id = ?", (employee_id,))
    con.execute("DELETE FROM fixed_schedule_members WHERE employee_id = ?", (employee_id,))
    audit(con, user.account_id, "xoa_lich_co_dinh", str(employee_id))
    con.execute("COMMIT")
    flash(request, "Đã xóa khỏi lịch cố định. Lịch các tuần đã xếp không bị thay đổi.")
    return _go("/quan-ly/lich-co-dinh")


@router.post("/lich-co-dinh/o")
async def fixed_cell(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="sua_danh_muc")
    data = await _json(request)
    try:
        eid, wd, sid = int(data.get("employee_id")), int(data.get("weekday")), int(data.get("shift_id"))
    except (TypeError, ValueError):
        return _bad("Dữ liệu không hợp lệ.")
    if not 0 <= wd <= 6:
        return _bad("Ngày không hợp lệ.")
    if not con.execute("SELECT 1 FROM fixed_schedule_members WHERE employee_id = ?", (eid,)).fetchone():
        return _bad("Nhân viên chưa có trong lịch cố định.")
    shift = con.execute("SELECT * FROM shifts WHERE id = ?", (sid,)).fetchone()
    if not shift:
        return _bad("Không tìm thấy ca.")
    value = (data.get("value") or "").strip()
    if not value:
        con.execute("DELETE FROM fixed_schedule_entries WHERE employee_id = ? AND weekday = ? AND shift = ?", (eid, wd, shift["name"]))
        return _saved()
    d = cat.employee_detail(con, eid)
    allowed = {
        o["value"]
        for o in _fixed_options(con, eid, d["branch_ids"], d["roles"], cat.branches(con, True), cat.branch_shift_map(con), shift)
    }
    if value not in allowed:
        return _bad("Chi nhánh/vị trí này không có trong khai báo của nhân viên hoặc ca không bật ở chi nhánh.")
    bid, role = value.split("|", 1)
    con.execute(
        "INSERT INTO fixed_schedule_entries(employee_id, weekday, shift, branch_id, role, updated_at) VALUES (?,?,?,?,?,?)"
        " ON CONFLICT(employee_id, weekday, shift) DO UPDATE SET branch_id = excluded.branch_id, role = excluded.role,"
        " updated_at = excluded.updated_at",
        (eid, wd, shift["name"], int(bid), role, now_str()),
    )
    audit(con, user.account_id, "sua_lich_co_dinh", f"{eid}/{wd}/{shift['name']}={value}")
    return _saved()
