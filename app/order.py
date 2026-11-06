"""Tuần làm việc, giờ mở/hết hạn order và đọc/ghi order."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta

from .catalog import WEEKDAYS, shifts as list_shifts
from .db import now_str

OK, OFF, NONE = "ĐI LÀM ĐƯỢC", "NGHỈ", "CHƯA ORDER"
CODE = {OK: "ok", OFF: "off", NONE: "none"}
FROM_CODE = {"ok": OK, "off": OFF, "none": NONE}
LABEL = {OK: "Đi làm được", OFF: "Nghỉ", NONE: "Chưa order"}
DOW_LABELS = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"]


# ---------------------------------------------------------------------------
# Tuần
# ---------------------------------------------------------------------------
def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def get_week(con, start: date, create: bool = False):
    row = con.execute("SELECT * FROM weeks WHERE start_date = ?", (start.isoformat(),)).fetchone()
    if row or not create:
        return row
    con.execute(
        "INSERT INTO weeks(start_date, end_date, created_at) VALUES (?,?,?)",
        (start.isoformat(), (start + timedelta(days=6)).isoformat(), now_str()),
    )
    return con.execute("SELECT * FROM weeks WHERE start_date = ?", (start.isoformat(),)).fetchone()


def week_by_id(con, week_id):
    return con.execute("SELECT * FROM weeks WHERE id = ?", (week_id,)).fetchone()


def week_label(week) -> str:
    s = date.fromisoformat(week["start_date"])
    e = date.fromisoformat(week["end_date"])
    return f"{s:%d/%m} – {e:%d/%m/%Y}"


def week_days(week):
    s = date.fromisoformat(week["start_date"])
    return [{"index": i, "name": WEEKDAYS[i], "date": (s + timedelta(days=i)).strftime("%d/%m")} for i in range(7)]


def order_shifts(con):
    """Các ca đang dùng – lưới order = 7 ngày × số ca này."""
    return list_shifts(con, active_only=True)


# ---------------------------------------------------------------------------
# Giờ mở / hết hạn order
# ---------------------------------------------------------------------------
def get_setting(con, key, default):
    row = con.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row[0] if row else default


def set_setting(con, key, value):
    con.execute(
        "INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, str(value)),
    )


def recurring_rule(con):
    return {
        "open_dow": int(get_setting(con, "order_open_dow", "0")),
        "open_time": get_setting(con, "order_open_time", "08:00"),
        "close_dow": int(get_setting(con, "order_close_dow", "3")),
        "close_time": get_setting(con, "order_close_time", "22:00"),
    }


def _at(day: date, hhmm: str) -> datetime:
    h, m = hhmm.split(":")
    return datetime.combine(day, time(int(h), int(m)))


def default_window(con, start: date):
    """Mặc định: tính theo tuần LIỀN TRƯỚC tuần cần order."""
    r = recurring_rule(con)
    prev = start - timedelta(days=7)
    return _at(prev + timedelta(days=r["open_dow"]), r["open_time"]), _at(prev + timedelta(days=r["close_dow"]), r["close_time"])


def order_window(con, week):
    """(mở, hết hạn, có_cài_riêng)"""
    row = con.execute("SELECT * FROM week_order_windows WHERE week_id = ?", (week["id"],)).fetchone() if week["id"] else None
    if row:
        return datetime.fromisoformat(row["open_at"]), datetime.fromisoformat(row["close_at"]), True
    o, c = default_window(con, date.fromisoformat(week["start_date"]))
    return o, c, False


def window_state(con, week, now: datetime | None = None):
    now = now or datetime.now()
    o, c, custom = order_window(con, week)
    if now < o:
        state = "chua_mo"
    elif now <= c:
        state = "dang_mo"
    else:
        state = "da_dong"
    return {"open": o, "close": c, "custom": custom, "state": state, "remaining": _remaining(c - now)}


def _remaining(delta: timedelta) -> str:
    secs = int(delta.total_seconds())
    if secs <= 0:
        return ""
    days, rem = divmod(secs, 86400)
    hours, rem = divmod(rem, 3600)
    minutes = rem // 60
    if days:
        return f"còn {days} ngày {hours} giờ"
    if hours:
        return f"còn {hours} giờ {minutes} phút"
    return f"còn {minutes} phút"


def fmt_dt(dt: datetime) -> str:
    return f"{dt:%H:%M} {DOW_LABELS[dt.weekday()]} {dt:%d/%m}"


# ---------------------------------------------------------------------------
# Order
# ---------------------------------------------------------------------------
def employee_entries(con, week_id, employee_id):
    rows = con.execute(
        "SELECT weekday, shift, status, is_manual FROM order_entries WHERE week_id = ? AND employee_id = ?",
        (week_id, employee_id),
    ).fetchall()
    return {(r["weekday"], r["shift"]): r for r in rows}


def has_submitted(con, week_id, employee_id) -> bool:
    if con.execute(
        "SELECT 1 FROM order_submissions WHERE week_id = ? AND employee_id = ?", (week_id, employee_id)
    ).fetchone():
        return True
    # Dữ liệu cũ từ bản offline (nhập từ form) không có dòng nộp order
    return bool(con.execute(
        "SELECT 1 FROM order_entries WHERE week_id = ? AND employee_id = ? AND status IN (?, ?) LIMIT 1",
        (week_id, employee_id, OK, OFF),
    ).fetchone())


def save_employee_order(con, week_id, employee_id, cells: dict):
    """cells: {(weekday, shift_name): OK|OFF}. Ô quản lý đã sửa giữ dấu nếu nhân viên chọn giống."""
    now = now_str()
    existing = employee_entries(con, week_id, employee_id)
    for (wd, shift), status in cells.items():
        old = existing.get((wd, shift))
        manual = 1 if (old and old["is_manual"] and old["status"] == status) else 0
        con.execute(
            "INSERT INTO order_entries(week_id, employee_id, weekday, shift, status, imported_at, is_manual)"
            " VALUES (?,?,?,?,?,?,?) ON CONFLICT(week_id, employee_id, weekday, shift) DO UPDATE SET"
            " status = excluded.status, imported_at = excluded.imported_at, is_manual = excluded.is_manual",
            (week_id, employee_id, wd, shift, status, now, manual),
        )
    con.execute(
        "INSERT INTO order_submissions(week_id, employee_id, submitted_at, updated_at) VALUES (?,?,?,?)"
        " ON CONFLICT(week_id, employee_id) DO UPDATE SET updated_at = excluded.updated_at",
        (week_id, employee_id, now, now),
    )


def manager_set(con, week_id, employee_id, weekday, shift, status, account_id):
    old = con.execute(
        "SELECT status FROM order_entries WHERE week_id = ? AND employee_id = ? AND weekday = ? AND shift = ?",
        (week_id, employee_id, weekday, shift),
    ).fetchone()
    old_status = old["status"] if old else NONE
    if old_status == status and old is not None:
        return False
    now = now_str()
    con.execute(
        "INSERT INTO order_entries(week_id, employee_id, weekday, shift, status, imported_at, is_manual)"
        " VALUES (?,?,?,?,?,?,1) ON CONFLICT(week_id, employee_id, weekday, shift) DO UPDATE SET"
        " status = excluded.status, imported_at = excluded.imported_at, is_manual = 1",
        (week_id, employee_id, weekday, shift, status, now),
    )
    con.execute(
        "INSERT INTO order_edit_log(week_id, employee_id, weekday, shift, old_status, new_status, account_id, created_at)"
        " VALUES (?,?,?,?,?,?,?,?)",
        (week_id, employee_id, weekday, shift, old_status, status, account_id, now),
    )
    from .schedule import sync_order_change  # tránh import vòng

    sync_order_change(con, week_id, employee_id, weekday, shift, status)
    return True


def edit_note(con, week_id, employee_id, weekday, shift):
    row = con.execute(
        """
        SELECT l.*, COALESCE(e.code || ' – ' || e.name, a.display_name, 'Chủ') AS who
        FROM order_edit_log l LEFT JOIN accounts a ON a.id = l.account_id LEFT JOIN employees e ON e.id = a.employee_id
        WHERE l.week_id = ? AND l.employee_id = ? AND l.weekday = ? AND l.shift = ?
        ORDER BY l.id DESC LIMIT 1
        """,
        (week_id, employee_id, weekday, shift),
    ).fetchone()
    if not row:
        return "Quản lý đã sửa"
    t = datetime.fromisoformat(row["created_at"])
    return f"Sửa bởi {row['who']} lúc {t:%H:%M %d/%m}: {LABEL.get(row['old_status'], row['old_status'])} → {LABEL.get(row['new_status'], row['new_status'])}"
