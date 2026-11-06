"""Thông báo trong web: mở order, sắp hết hạn order, dọn thông báo cũ."""
from __future__ import annotations

import time
from datetime import datetime, timedelta

from . import order as od
from . import schedule as sc
from .db import connect, now_str

REMIND_HOURS = 3        # nhắc trước hạn order
KEEP_DAYS = 60          # thông báo cũ tự xóa
_last_tick = 0.0


def unread_count(con, account_id) -> int:
    return con.execute(
        "SELECT COUNT(*) FROM notifications WHERE account_id = ? AND read_at IS NULL", (account_id,)
    ).fetchone()[0]


def _accounts(con):
    """Tài khoản của nhân viên đang làm: {employee_id: account_id}"""
    return {
        r["employee_id"]: r["id"]
        for r in con.execute(
            "SELECT a.id, a.employee_id FROM accounts a JOIN employees e ON e.id = a.employee_id WHERE e.status = 'Đang làm'"
        )
    }


def _once(con, key) -> bool:
    """True nếu sự kiện này chưa gửi (và đánh dấu đã gửi)."""
    if con.execute("SELECT 1 FROM notification_events WHERE event_key = ?", (key,)).fetchone():
        return False
    con.execute("INSERT INTO notification_events(event_key, created_at) VALUES (?, ?)", (key, now_str()))
    return True


def _add(con, account_id, title, body, link):
    con.execute(
        "INSERT INTO notifications(account_id, title, body, created_at, link) VALUES (?,?,?,?,?)",
        (account_id, title, body, now_str(), link),
    )


def run_due(con, now: datetime | None = None) -> dict:
    """Gửi các thông báo đến hạn + dọn thông báo cũ. Chạy lại nhiều lần vẫn không gửi trùng."""
    now = now or datetime.now()
    sent = {"mo": 0, "sap_het_han": 0, "don": 0}
    accounts = _accounts(con)
    weeks = con.execute("SELECT * FROM weeks WHERE end_date >= ?", ((now - timedelta(days=1)).date().isoformat(),)).fetchall()
    for week in weeks:
        if sc.week_status(con, week["id"]) is not None:
            continue  # đã sang giai đoạn xếp lịch
        win = od.window_state(con, week, now)
        label = od.week_label(week)
        if win["state"] != "dang_mo":
            continue
        con.execute("BEGIN")
        try:
            if _once(con, f"order_mo:{week['id']}:{win['open']:%Y%m%d%H%M}"):
                for aid in accounts.values():
                    _add(con, aid, f"Đã mở order tuần {label}",
                         f"Hạn order: {od.fmt_dt(win['close'])}. Hãy chọn đủ các ô Đi làm được / Nghỉ.", "/order")
                    sent["mo"] += 1
            if win["close"] - now <= timedelta(hours=REMIND_HOURS) and _once(
                con, f"sap_het_han:{week['id']}:{win['close']:%Y%m%d%H%M}"
            ):
                for eid, aid in accounts.items():
                    if not od.has_submitted(con, week["id"], eid):
                        _add(con, aid, f"Sắp hết hạn order tuần {label}",
                             f"Bạn chưa gửi order. Hạn: {od.fmt_dt(win['close'])} ({win['remaining']}).", "/order")
                        sent["sap_het_han"] += 1
            con.execute("COMMIT")
        except Exception:
            con.execute("ROLLBACK")
            raise
    cutoff = (now - timedelta(days=KEEP_DAYS)).strftime("%Y-%m-%d %H:%M:%S")
    cur = con.execute("DELETE FROM notifications WHERE created_at < ?", (cutoff,))
    sent["don"] = cur.rowcount if cur.rowcount and cur.rowcount > 0 else 0
    con.execute("DELETE FROM notification_events WHERE created_at < ?", (cutoff,))
    return sent


def tick() -> None:
    """Gọi khi có người dùng web; tối đa mỗi 60 giây chạy một lần."""
    global _last_tick
    if time.time() - _last_tick < 60:
        return
    _last_tick = time.time()
    con = connect()
    try:
        run_due(con)
    except Exception:  # không để lỗi thông báo làm hỏng trang
        pass
    finally:
        con.close()
