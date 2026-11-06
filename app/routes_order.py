"""Bước 3 – Order ca: nhân viên tự order, cài giờ order, quản lý theo dõi/sửa."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, RedirectResponse

from . import order as od
from . import schedule as sc
from .catalog import RANKS, TIME_RE
from .db import audit, now_str
from .security import require_user
from .web import flash, get_db, render

router = APIRouter()


def _go(url):
    return RedirectResponse(url, status_code=303)


def _bad(message, status=400):
    return JSONResponse({"ok": False, "message": message}, status_code=status)


def _target_week(con):
    """Tuần nhân viên đang order = tuần kế tiếp."""
    return od.get_week(con, od.week_start(date.today()) + timedelta(days=7))


def _next_start():
    return od.week_start(date.today()) + timedelta(days=7)


# ===========================================================================
# Nhân viên: order ca
# ===========================================================================
def _employee_grid(con, week, employee_id):
    shifts = od.order_shifts(con)
    entries = od.employee_entries(con, week["id"], employee_id)
    days = []
    for d in od.week_days(week):
        rows = []
        for s in shifts:
            e = entries.get((d["index"], s["name"]))
            status = e["status"] if e else od.NONE
            rows.append({
                "shift": s, "code": od.CODE.get(status, "none"), "manual": bool(e and e["is_manual"]),
                "field": f"c_{d['index']}_{s['id']}",
            })
        days.append({**d, "rows": rows})
    return days, len(shifts) * 7


@router.get("/order")
def employee_order_page(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="order_ca")
    if not user.employee_id:
        return render(request, "thong_bao_loi.html", user, title="Order ca",
                      message="Tài khoản Chủ không gắn với nhân viên nên không order ca.")
    week = _target_week(con)
    if not week:
        start = _next_start()
        return render(request, "thong_bao_loi.html", user, title="Order ca",
                      message=f"Quản lý chưa mở tuần mới ({start:%d/%m} – {start + timedelta(days=6):%d/%m}). Hãy quay lại sau.")
    win = od.window_state(con, week)
    days, total = _employee_grid(con, week, user.employee_id)
    return render(
        request, "order_nv.html", user, week=week, week_label=od.week_label(week), days=days, total=total,
        win=win, open_text=od.fmt_dt(win["open"]), close_text=od.fmt_dt(win["close"]),
        submitted=od.has_submitted(con, week["id"], user.employee_id),
    )


@router.post("/order")
async def employee_order_submit(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="order_ca")
    if not user.employee_id:
        return _go("/")
    week = _target_week(con)
    win = od.window_state(con, week) if week else {"state": "chua_tao"}
    if win["state"] != "dang_mo":
        flash(request, "Order tuần này đang không mở. Không lưu được.", "error")
        return _go("/order")
    form = await request.form()
    cells, missing = {}, 0
    for d in range(7):
        for s in od.order_shifts(con):
            v = form.get(f"c_{d}_{s['id']}")
            if v not in ("ok", "off"):
                missing += 1
            else:
                cells[(d, s["name"])] = od.FROM_CODE[v]
    if missing:
        flash(request, f"Còn {missing} ô chưa chọn. Phải chọn đủ mới gửi được.", "error")
        return _go("/order")
    con.execute("BEGIN")
    first = not od.has_submitted(con, week["id"], user.employee_id)
    od.save_employee_order(con, week["id"], user.employee_id, cells)
    con.execute("COMMIT")
    flash(request, ("Đã gửi order. " if first else "Đã cập nhật order. ") + f"Bạn vẫn sửa được đến {od.fmt_dt(win['close'])}.")
    return _go("/order")


# ===========================================================================
# Cài giờ order
# ===========================================================================
@router.get("/quan-ly/gio-order")
def order_hours_page(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="cai_gio_order")
    start = od.week_start(date.today())
    weeks = []
    # Chỉ hiện các tuần ĐÃ TẠO và CHƯA KẾT THÚC (tuần đã qua ẩn khỏi bảng, dữ liệu vẫn giữ)
    for w in con.execute("SELECT * FROM weeks WHERE end_date >= ? ORDER BY start_date", (date.today().isoformat(),)):
        win = od.window_state(con, w)
        weeks.append({"week": w, "label": od.week_label(w), "win": win, "exists": True,
                      "open_text": od.fmt_dt(win["open"]), "close_text": od.fmt_dt(win["close"])})
    return render(request, "gio_order.html", user, rule=od.recurring_rule(con), weeks=weeks, DOW=od.DOW_LABELS)


@router.post("/quan-ly/gio-order")
async def order_hours_save(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="cai_gio_order")
    form = await request.form()
    try:
        od_, cd_ = int(form.get("open_dow")), int(form.get("close_dow"))
        ot, ct = (form.get("open_time") or "").strip(), (form.get("close_time") or "").strip()
        if not (0 <= od_ <= 6 and 0 <= cd_ <= 6) or not TIME_RE.match(ot) or not TIME_RE.match(ct):
            raise ValueError
    except (TypeError, ValueError):
        flash(request, "Giờ không hợp lệ. Nhập dạng giờ:phút, ví dụ 08:00.", "error")
        return _go("/quan-ly/gio-order")
    if (cd_, ct) <= (od_, ot):
        flash(request, "Giờ hết hạn phải sau giờ mở.", "error")
        return _go("/quan-ly/gio-order")
    for k, v in (("order_open_dow", od_), ("order_open_time", ot), ("order_close_dow", cd_), ("order_close_time", ct)):
        od.set_setting(con, k, v)
    audit(con, user.account_id, "sua_gio_order", f"{od_} {ot} -> {cd_} {ct}")
    flash(request, "Đã lưu giờ order lặp lại hằng tuần.")
    return _go("/quan-ly/gio-order")


@router.post("/quan-ly/gio-order/tuan/{week_id}")
async def order_hours_week(week_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="cai_gio_order")
    week = od.week_by_id(con, week_id)
    if not week:
        return _go("/quan-ly/gio-order")
    form = await request.form()
    if form.get("reset"):
        con.execute("DELETE FROM week_order_windows WHERE week_id = ?", (week_id,))
        flash(request, f"Tuần {od.week_label(week)} dùng lại giờ mặc định.")
        return _go("/quan-ly/gio-order")
    try:
        o = datetime.fromisoformat(form.get("open_at"))
        c = datetime.fromisoformat(form.get("close_at"))
    except (TypeError, ValueError):
        flash(request, "Ngày giờ không hợp lệ.", "error")
        return _go("/quan-ly/gio-order")
    if c <= o:
        flash(request, "Giờ hết hạn phải sau giờ mở.", "error")
        return _go("/quan-ly/gio-order")
    con.execute(
        "INSERT INTO week_order_windows(week_id, open_at, close_at, updated_at) VALUES (?,?,?,?)"
        " ON CONFLICT(week_id) DO UPDATE SET open_at = excluded.open_at, close_at = excluded.close_at,"
        " updated_at = excluded.updated_at",
        (week_id, o.isoformat(timespec="minutes"), c.isoformat(timespec="minutes"), now_str()),
    )
    audit(con, user.account_id, "sua_gio_order_tuan", f"{week_id}: {o} -> {c}")
    flash(request, f"Đã cài giờ riêng cho tuần {od.week_label(week)}.")
    return _go("/quan-ly/gio-order")


# ===========================================================================
# Quản lý: theo dõi order
# ===========================================================================
@router.get("/quan-ly/order")
def manager_order_page(request: Request, tuan: Optional[str] = None, con=Depends(get_db)):
    user = require_user(request, con, perm="xem_tat_ca")
    try:
        start = od.week_start(date.fromisoformat(tuan)) if tuan else od.week_start(date.today()) + timedelta(days=7)
    except ValueError:
        start = od.week_start(date.today()) + timedelta(days=7)
    week = od.get_week(con, start)
    prev_w = (start - timedelta(days=7)).isoformat()
    next_w = (start + timedelta(days=7)).isoformat()
    if not week:
        return render(
            request, "order_ql_chua_tao.html", user, start=start.isoformat(), prev_w=prev_w, next_w=next_w,
            week_label=f"{start:%d/%m} – {start + timedelta(days=6):%d/%m/%Y}", can_create=user.can("xep_lich"),
            n_emp=con.execute("SELECT COUNT(*) FROM employees WHERE status = 'Đang làm'").fetchone()[0],
        )
    win = od.window_state(con, week)
    shifts = od.order_shifts(con)
    days = od.week_days(week)
    emps = con.execute(
        "SELECT id, code, name, rank FROM employees WHERE status = 'Đang làm' ORDER BY name COLLATE NOCASE"
    ).fetchall()
    entries = {}
    for r in con.execute("SELECT employee_id, weekday, shift, status, is_manual FROM order_entries WHERE week_id = ?", (week["id"],)):
        entries[(r["employee_id"], r["weekday"], r["shift"])] = r
    submitted = {r[0] for r in con.execute("SELECT employee_id FROM order_submissions WHERE week_id = ?", (week["id"],))}
    rows = []
    for e in emps:
        cells, has = [], e["id"] in submitted
        for d in days:
            for s in shifts:
                r = entries.get((e["id"], d["index"], s["name"]))
                status = r["status"] if r else od.NONE
                if status in (od.OK, od.OFF):
                    has = True
                manual = bool(r and r["is_manual"])
                cells.append({
                    "d": d["index"], "s": s["name"], "code": od.CODE.get(status, "none"), "manual": manual,
                    "note": od.edit_note(con, week["id"], e["id"], d["index"], s["name"]) if manual else "",
                })
        rows.append({"emp": e, "has": has, "cells": cells})
    return render(
        request, "order_ql.html", user, week=week, week_label=od.week_label(week), days=days, shifts=shifts,
        rows=rows, win=win, open_text=od.fmt_dt(win["open"]), close_text=od.fmt_dt(win["close"]),
        prev_w=prev_w, next_w=next_w, start=start.isoformat(), can_edit=user.can("sua_order_sau_han"),
        RANKS=RANKS, sched_status=sc.week_status(con, week["id"]), sched_label=sc.status_label(con, week["id"]),
        can_start=user.can("xep_lich"),
    )


@router.post("/quan-ly/order/tao-tuan")
async def create_week(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="xep_lich")
    form = await request.form()
    try:
        start = od.week_start(date.fromisoformat(form.get("tuan") or ""))
    except ValueError:
        flash(request, "Ngày không hợp lệ.", "error")
        return _go("/quan-ly/order")
    back = f"/quan-ly/order?tuan={start.isoformat()}"
    if od.get_week(con, start):
        flash(request, "Tuần này đã có, không thể tạo lại. Muốn làm lại từ đầu hãy dùng “Xóa dữ liệu tuần”.", "error")
        return _go(back)
    con.execute("BEGIN")
    week = od.get_week(con, start, create=True)
    audit(con, user.account_id, "tao_tuan", week["start_date"])
    con.execute("COMMIT")
    win = od.window_state(con, week)
    flash(request, f"Đã tạo tuần {od.week_label(week)}. Tất cả nhân viên đang ở trạng thái Chưa order. "
                   f"Nhân viên order từ {od.fmt_dt(win['open'])} đến {od.fmt_dt(win['close'])}.")
    return _go(back)


@router.post("/quan-ly/order/sua")
async def manager_order_edit(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="sua_order_sau_han")
    data = await request.json()
    week = od.week_by_id(con, data.get("week_id"))
    if not week:
        return _bad("Không tìm thấy tuần.", 404)
    shift_names = {s["name"] for s in od.order_shifts(con)}
    active = {r[0] for r in con.execute("SELECT id FROM employees WHERE status = 'Đang làm'")}
    cells = data.get("cells") or []
    if not isinstance(cells, list) or len(cells) > 5000:
        return _bad("Dữ liệu không hợp lệ.")
    out = []
    con.execute("BEGIN")
    try:
        for c in cells:
            eid, wd, shift, code = int(c["employee_id"]), int(c["weekday"]), c["shift"], c["status"]
            if eid not in active or not 0 <= wd <= 6 or shift not in shift_names or code not in od.FROM_CODE:
                raise ValueError
            od.manager_set(con, week["id"], eid, wd, shift, od.FROM_CODE[code], user.account_id)
            out.append({"employee_id": eid, "weekday": wd, "shift": shift, "status": code,
                        "note": od.edit_note(con, week["id"], eid, wd, shift)})
    except (KeyError, TypeError, ValueError):
        con.execute("ROLLBACK")
        return _bad("Dữ liệu không hợp lệ.")
    audit(con, user.account_id, "sua_order", f"week={week['id']} cells={len(out)}")
    con.execute("COMMIT")
    return {"ok": True, "cells": out, "saved_at": now_str()[11:16]}


@router.post("/quan-ly/order/xoa-tuan/{week_id}")
async def delete_week_orders(week_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="xoa_du_lieu_tuan")
    week = od.week_by_id(con, week_id)
    if not week:
        return _go("/quan-ly/order")
    form = await request.form()
    back = f"/quan-ly/order?tuan={week['start_date']}"
    if (form.get("xac_nhan") or "").strip().upper() != "XOA":
        flash(request, "Chưa xóa: phải gõ đúng chữ XOA để xác nhận.", "error")
        return _go(back)
    con.execute("BEGIN")
    n = con.execute("DELETE FROM order_entries WHERE week_id = ?", (week_id,)).rowcount
    con.execute("DELETE FROM order_submissions WHERE week_id = ?", (week_id,))
    con.execute("DELETE FROM order_edit_log WHERE week_id = ?", (week_id,))
    audit(con, user.account_id, "xoa_order_tuan", f"week={week_id} rows={n}")
    con.execute("COMMIT")
    flash(request, f"Đã xóa toàn bộ order tuần {od.week_label(week)} ({n} ô).")
    return _go(back)
