"""Đọc/ghi danh mục: chi nhánh, ca, vai trò làm việc, nhân viên.

Lưu ý: dữ liệu cũ lưu TÊN ca (vd 'Sáng') và TÊN vai trò (vd 'Pha chế') dạng chữ
trong nhiều bảng. Khi đổi tên phải cập nhật đồng loạt (rename_shift / rename_role).
"""
from __future__ import annotations

import json
import re
from datetime import date

WEEKDAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
RANKS = ["Thử việc", "Cấp 1", "Cấp 2", "Quản lý"]  # thấp → cao
SENIOR_RANKS = {"Cấp 2", "Quản lý"}
EMP_STATUSES = ["Đang làm", "Ngừng làm"]
BRANCH_ACTIVE, BRANCH_STOPPED = "Đang hoạt động", "Ngừng hoạt động"
IN_USE, NOT_IN_USE = "Đang sử dụng", "Ngừng sử dụng"

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[0-9 +().-]{8,20}$")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
CODE_RE = re.compile(r"^[0-9A-Za-zÀ-ỹĐđ_.-]{1,20}$")


class Invalid(Exception):
    """Dữ liệu nhập không hợp lệ; message hiển thị cho người dùng."""


def role_abbr(name: str) -> str:
    return "".join(w[0] for w in name.split() if w).upper()


# ---------------------------------------------------------------------------
# Đọc danh mục
# ---------------------------------------------------------------------------
def branches(con, active_only=False):
    sql = "SELECT * FROM branches"
    if active_only:
        sql += f" WHERE status = '{BRANCH_ACTIVE}'"
    return con.execute(sql + " ORDER BY sort_order, id").fetchall()


def shifts(con, active_only=False):
    sql = "SELECT * FROM shifts"
    if active_only:
        sql += f" WHERE status = '{IN_USE}'"
    return con.execute(sql + " ORDER BY sort_order, id").fetchall()


def work_roles(con, active_only=False):
    sql = "SELECT * FROM work_roles"
    if active_only:
        sql += f" WHERE status = '{IN_USE}'"
    return con.execute(sql + " ORDER BY sort_order, id").fetchall()


def branch_shift_map(con):
    """{(branch_id, shift_id): row} giờ ca từng chi nhánh."""
    return {(r["branch_id"], r["shift_id"]): r for r in con.execute("SELECT * FROM branch_shifts")}


def enabled_shifts_for_branch(con, branch_id):
    return con.execute(
        f"""
        SELECT s.*, bs.start_time, bs.end_time FROM shifts s
        JOIN branch_shifts bs ON bs.shift_id = s.id AND bs.branch_id = ? AND bs.enabled = 1
        WHERE s.status = '{IN_USE}' ORDER BY s.sort_order, s.id
        """,
        (branch_id,),
    ).fetchall()


def employee_detail(con, employee_id):
    emp = con.execute("SELECT * FROM employees WHERE id = ?", (employee_id,)).fetchone()
    if not emp:
        return None
    roles = [r[0] for r in con.execute("SELECT role FROM employee_roles WHERE employee_id = ?", (employee_id,))]
    brs = [r[0] for r in con.execute("SELECT branch_id FROM employee_branches WHERE employee_id = ?", (employee_id,))]
    return {"emp": emp, "roles": roles, "branch_ids": brs}


# ---------------------------------------------------------------------------
# Đổi tên có cập nhật đồng loạt
# ---------------------------------------------------------------------------
def _rename_in_json_list(con, table, column, old, new):
    for row in con.execute(f"SELECT id, {column} FROM {table}").fetchall():
        try:
            arr = json.loads(row[column] or "[]")
        except ValueError:
            continue
        if old in arr:
            arr = [new if x == old else x for x in arr]
            con.execute(f"UPDATE {table} SET {column} = ? WHERE id = ?", (json.dumps(arr, ensure_ascii=False), row["id"]))


def rename_shift(con, old, new):
    for table in ("order_entries", "weekly_schedule_entries", "staffing_requirements", "fixed_schedule_entries"):
        con.execute(f"UPDATE {table} SET shift = ? WHERE shift = ?", (new, old))
    _rename_in_json_list(con, "employee_work_plans", "shifts_json", old, new)


ROLE_COLUMNS = [
    ("employee_roles", "role"),
    ("staffing_requirements", "role"),
    ("fixed_schedule_entries", "role"),
    ("weekly_schedule_entries", "role"),
    ("employees", "preferred_role"),
    ("employee_work_plans", "preferred_role"),
    ("evaluation_criteria", "role"),
    ("evaluation_round_criteria", "role"),
    ("evaluation_round_employees", "role"),
    ("evaluation_records", "role"),
]


def rename_role(con, old, new):
    for table, col in ROLE_COLUMNS:
        con.execute(f"UPDATE {table} SET {col} = ? WHERE {col} = ?", (new, old))


# ---------------------------------------------------------------------------
# Kiểm tra dữ liệu nhập
# ---------------------------------------------------------------------------
def clean_text(value, label, max_len=60, required=True):
    v = (value or "").strip()
    if required and not v:
        raise Invalid(f"{label} không được để trống.")
    if len(v) > max_len:
        raise Invalid(f"{label} dài quá {max_len} ký tự.")
    return v


def clean_time(value, label):
    v = (value or "").strip()
    if not TIME_RE.match(v):
        raise Invalid(f"{label} phải có dạng giờ:phút, ví dụ 06:30.")
    return v


def clean_employee_form(con, form, employee_id=None):
    code = clean_text(form.get("code"), "Mã nhân viên", 20)
    if not CODE_RE.match(code):
        raise Invalid("Mã nhân viên chỉ gồm chữ, số và các dấu . _ - (không có khoảng trắng).")
    dup = con.execute(
        "SELECT id FROM employees WHERE code = ? COLLATE NOCASE AND id IS NOT ?", (code, employee_id)
    ).fetchone()
    if dup:
        raise Invalid(f"Mã {code} đã có người dùng.")
    if con.execute("SELECT 1 FROM accounts WHERE login_name = ? COLLATE NOCASE", (code,)).fetchone():
        raise Invalid(f"Mã {code} trùng mã đăng nhập của Chủ.")
    name = clean_text(form.get("name"), "Tên", 80)
    rank = form.get("rank")
    if rank not in RANKS:
        raise Invalid("Hãy chọn cấp bậc.")
    status = form.get("status") or "Đang làm"
    if status not in EMP_STATUSES:
        raise Invalid("Trạng thái không hợp lệ.")
    valid_roles = {r["name"] for r in work_roles(con)}
    roles = [r for r in form.getlist("roles") if r in valid_roles]
    if not roles:
        raise Invalid("Hãy chọn ít nhất một vai trò làm việc.")
    preferred = form.get("preferred_role") or roles[0]
    if preferred not in roles:
        raise Invalid("Vai trò ưu tiên phải nằm trong các vai trò đã chọn.")
    valid_branches = {r["id"] for r in branches(con)}
    branch_ids = []
    for b in form.getlist("branches"):
        try:
            if int(b) in valid_branches:
                branch_ids.append(int(b))
        except ValueError:
            pass
    if not branch_ids:
        raise Invalid("Hãy chọn ít nhất một chi nhánh làm được.")
    email = (form.get("email") or "").strip()
    if email and not EMAIL_RE.match(email):
        raise Invalid("Email không hợp lệ.")
    phone = (form.get("phone") or "").strip()
    if phone and not PHONE_RE.match(phone):
        raise Invalid("Số điện thoại không hợp lệ.")
    start = (form.get("start_date") or "").strip()
    if start:
        try:
            date.fromisoformat(start)
        except ValueError:
            raise Invalid("Ngày bắt đầu vào làm không hợp lệ.")
    return {
        "code": code, "name": name, "rank": rank, "status": status, "roles": roles,
        "preferred_role": preferred, "branch_ids": branch_ids, "email": email or None,
        "phone": phone or None, "start_date": start or None,
    }
