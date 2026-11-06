"""Bước 4 – Xếp lịch cơ sở, khóa xếp lịch, chốt tuần."""
from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, RedirectResponse

from . import catalog as cat
from . import order as od
from . import schedule as sc
from .db import audit, now_str
from .security import require_user
from .web import flash, get_db, render

router = APIRouter(prefix="/quan-ly")


def _go(url):
    return RedirectResponse(url, status_code=303)


def _bad(message, status=400, **extra):
    return JSONResponse({"ok": False, "message": message, **extra}, status_code=status)


def _week_or_404(con, week_id):
    return od.week_by_id(con, week_id)


# ===========================================================================
@router.get("/lich-co-so")
def schedule_page(request: Request, tuan: Optional[str] = None, cn: Optional[int] = None, con=Depends(get_db)):
    user = require_user(request, con, perm="xem_tat_ca")
    try:
        start = od.week_start(date.fromisoformat(tuan)) if tuan else od.week_start(date.today()) + timedelta(days=7)
    except ValueError:
        start = od.week_start(date.today()) + timedelta(days=7)
    branches = cat.branches(con, active_only=True)
    branch = next((b for b in branches if b["id"] == cn), branches[0] if branches else None)
    week = od.get_week(con, start)
    ctx = dict(
        start=start.isoformat(), prev_w=(start - timedelta(days=7)).isoformat(),
        next_w=(start + timedelta(days=7)).isoformat(), branches=branches, branch=branch,
        week_label=f"{start:%d/%m} – {start + timedelta(days=6):%d/%m/%Y}", week=week,
    )
    if not week or not branch:
        return render(request, "lich_co_so.html", user, stage="chua_tao", **ctx)
    status = sc.week_status(con, week["id"])
    if status is None:
        win = od.window_state(con, week)
        return render(
            request, "lich_co_so.html", user, stage="chua_xep", win=win, close_text=od.fmt_dt(win["close"]),
            can_start=user.can("xep_lich"), **ctx,
        )
    editable = sc.is_editable(con, week["id"])
    holds, lock = False, sc.lock_info(con, week["id"])
    if editable and user.can("xep_lich"):
        holds, lock = sc.try_lock(con, week["id"], user.account_id)
    payload = sc.branch_payload(con, week, branch)
    payload["can_edit"] = bool(editable and holds)
    return render(
        request, "lich_co_so.html", user, stage="xep", status=status, status_label=sc.status_label(con, week["id"]),
        editable=editable, holds=holds, lock=lock, payload_json=json.dumps(payload, ensure_ascii=False),
        can_chot=user.can("chot_tuan"), can_xep=user.can("xep_lich"),
        can_back=status == sc.ST_XEP and not sc.has_published(con, week["id"]) and sc.manual_assigned_count(con, week["id"]) == 0,
        published=sc.has_published(con, week["id"]), **ctx,
    )


@router.post("/lich/bat-dau/{week_id}")
def start_scheduling(week_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="xep_lich")
    week = _week_or_404(con, week_id)
    if not week:
        return _go("/quan-ly/order")
    con.execute("BEGIN")
    try:
        n = sc.start_scheduling(con, week, user.account_id)
    except sc.ScheduleError as e:
        con.execute("ROLLBACK")
        flash(request, str(e), "error")
        return _go(f"/quan-ly/order?tuan={week['start_date']}")
    audit(con, user.account_id, "bat_dau_xep_lich", f"week={week_id} fixed={n}")
    con.execute("COMMIT")
    flash(request, f"Đã bắt đầu xếp lịch tuần {od.week_label(week)}. Đã đưa {n} ca từ lịch cố định vào lịch.")
    return _go(f"/quan-ly/lich-co-so?tuan={week['start_date']}")


@router.post("/lich/quay-lai/{week_id}")
def back_to_order(week_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="xep_lich")
    week = _week_or_404(con, week_id)
    if not week:
        return _go("/quan-ly/order")
    con.execute("BEGIN")
    try:
        sc.back_to_order(con, week)
    except sc.ScheduleError as e:
        con.execute("ROLLBACK")
        flash(request, str(e), "error")
        return _go(f"/quan-ly/lich-co-so?tuan={week['start_date']}")
    audit(con, user.account_id, "quay_lai_order", f"week={week_id}")
    con.execute("COMMIT")
    flash(request, "Đã quay lại giai đoạn order. Muốn nhân viên order tiếp, hãy cài giờ hết hạn mới ở Giờ order.")
    return _go(f"/quan-ly/order?tuan={week['start_date']}")


def _check_edit(con, user, week_id):
    week = _week_or_404(con, week_id)
    if not week:
        return None, _bad("Không tìm thấy tuần.", 404)
    if not sc.is_editable(con, week_id):
        return None, _bad("Tuần đã chốt hoặc chưa bắt đầu xếp. Tải lại trang.", 409, reload=True)
    ok, lock = sc.try_lock(con, week_id, user.account_id)
    if not ok:
        return None, _bad(f"{lock['who']} đang giữ quyền xếp lịch. Bạn đang ở chế độ chỉ xem.", 409, reload=True)
    return week, None


@router.post("/lich/xep")
async def assign(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="xep_lich")
    data = await request.json()
    try:
        week_id, bid, d = int(data["week_id"]), int(data["branch_id"]), int(data["weekday"])
        shift, role = data["shift"], data["role"]
        slot = int(data["slot"])
        eid = int(data["employee_id"]) if data.get("employee_id") else None
        prev = int(data["prev_employee_id"]) if data.get("prev_employee_id") else None
    except (KeyError, TypeError, ValueError):
        return _bad("Dữ liệu không hợp lệ.")
    week, err = _check_edit(con, user, week_id)
    if err:
        return err
    if not 0 <= d <= 6 or not any(s["name"] == shift for s in cat.enabled_shifts_for_branch(con, bid)):
        return _bad("Ca không bật ở chi nhánh này.")
    con.execute("BEGIN")
    try:
        if prev and prev != eid:
            sc.unassign(con, week_id, prev, d, shift)
        if eid:
            sc.assign(con, week_id, eid, d, shift, bid, role, slot)
    except sc.ScheduleError as e:
        con.execute("ROLLBACK")
        return _bad(str(e))
    sc.touch(con, week_id)
    audit(con, user.account_id, "xep_lich", f"w{week_id} b{bid} d{d} {shift} {role}#{slot}: {prev}->{eid}")
    con.execute("COMMIT")
    return {"ok": True, "version": sc.version(con, week_id), "saved_at": now_str()[11:16]}


@router.post("/lich/vuot")
async def extra_rows(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="xep_lich")
    data = await request.json()
    try:
        week_id, bid, delta = int(data["week_id"]), int(data["branch_id"]), int(data["delta"])
        shift, role = data["shift"], data["role"]
    except (KeyError, TypeError, ValueError):
        return _bad("Dữ liệu không hợp lệ.")
    week, err = _check_edit(con, user, week_id)
    if err:
        return err
    if delta not in (1, -1):
        return _bad("Dữ liệu không hợp lệ.")
    row = con.execute(
        "SELECT count FROM schedule_extra_rows WHERE week_id = ? AND branch_id = ? AND shift = ? AND role = ?",
        (week_id, bid, shift, role),
    ).fetchone()
    count = (row["count"] if row else 0) + delta
    removed = 0
    if delta == -1:
        req = sc.requirements(con, week_id, bid)
        max_req = max([req.get((bid, d, shift, role), 0) for d in range(7)] or [0])
        groups = {}
        for d in range(7):
            groups[d] = con.execute(
                "SELECT id, employee_id, slot FROM weekly_schedule_entries WHERE week_id = ? AND branch_id = ? AND weekday = ?"
                " AND shift = ? AND role = ? AND state = ? ORDER BY COALESCE(slot, 999), id",
                (week_id, bid, d, shift, role, sc.ASSIGNED),
            ).fetchall()
        cur_rows = max([max_req + (row["count"] if row else 0)] + [len(g) for g in groups.values()])
        target = max(cur_rows - 1, max_req)
        if cur_rows <= max_req:
            return _bad("Không còn hàng vượt định biên để xóa.")
        count = target - max_req
        for d, g in groups.items():
            keep = [e for e in g if e["slot"] is None or e["slot"] < target][:target]
            for e in g:
                if e not in keep:
                    sc.unassign(con, week_id, e["employee_id"], d, shift)
                    removed += 1
    con.execute(
        "INSERT INTO schedule_extra_rows(week_id, branch_id, shift, role, count) VALUES (?,?,?,?,?)"
        " ON CONFLICT(week_id, branch_id, shift, role) DO UPDATE SET count = excluded.count",
        (week_id, bid, shift, role, count),
    )
    sc.touch(con, week_id)
    audit(con, user.account_id, "vuot_dinh_bien", f"w{week_id} b{bid} {shift} {role} = {count}")
    return {"ok": True, "count": count, "removed": removed, "version": sc.version(con, week_id), "saved_at": now_str()[11:16]}


@router.get("/lich/phien-ban/{week_id}")
def poll_version(week_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="xem_tat_ca")
    lock = sc.lock_info(con, week_id)
    return {
        "version": sc.version(con, week_id), "status": sc.week_status(con, week_id),
        "lock": lock["who"] if lock else None, "mine": bool(lock and lock["account_id"] == user.account_id),
    }


@router.post("/lich/nha-khoa/{week_id}")
def release(week_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con)
    sc.release_lock(con, week_id, user.account_id)
    return {"ok": True}


@router.post("/lich/gianh-quyen/{week_id}")
def take_over(week_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="phan_quyen")  # chỉ Chủ
    week = _week_or_404(con, week_id)
    if not week:
        return _go("/quan-ly/lich-co-so")
    sc.try_lock(con, week_id, user.account_id, force=True)
    audit(con, user.account_id, "gianh_quyen_xep", f"week={week_id}")
    flash(request, "Bạn đã giành quyền xếp lịch. Người đang xếp sẽ chuyển sang chỉ xem.")
    back = request.headers.get("referer") or f"/quan-ly/lich-co-so?tuan={week['start_date']}"
    return _go(back)


@router.get("/lich/tom-tat/{week_id}")
def summary(week_id: int, request: Request, con=Depends(get_db)):
    require_user(request, con, perm="xem_tat_ca")
    week = _week_or_404(con, week_id)
    if not week:
        return _bad("Không tìm thấy tuần.", 404)
    w = sc.warnings(con, week)
    return {k: len(v) for k, v in w.items() if k != "so_ca"}


@router.post("/lich/chot/{week_id}")
def close_week(week_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="chot_tuan")
    week = _week_or_404(con, week_id)
    if not week:
        return _go("/quan-ly/lich-co-so")
    con.execute("BEGIN")
    try:
        res = sc.chot(con, week, user.account_id)
    except sc.ScheduleError as e:
        con.execute("ROLLBACK")
        flash(request, str(e), "error")
        return _go(f"/quan-ly/lich-co-so?tuan={week['start_date']}")
    audit(con, user.account_id, "chot_tuan", f"week={week_id}")
    con.execute("COMMIT")
    if res["first"]:
        msg = f"Đã chốt lịch tuần {od.week_label(week)}. Nhân viên đã xem được lịch."
    else:
        msg = f"Đã chốt lại lịch tuần {od.week_label(week)}. Đã gửi thông báo cho {res['changed']} nhân viên có ca thay đổi."
    flash(request, msg)
    return _go(request.headers.get("referer") or f"/quan-ly/lich-co-so?tuan={week['start_date']}")


@router.post("/lich/mo-lai/{week_id}")
def reopen_week(week_id: int, request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="chot_tuan")
    week = _week_or_404(con, week_id)
    if not week:
        return _go("/quan-ly/lich-co-so")
    con.execute("BEGIN")
    try:
        sc.reopen(con, week)
    except sc.ScheduleError as e:
        con.execute("ROLLBACK")
        flash(request, str(e), "error")
        return _go(f"/quan-ly/lich-co-so?tuan={week['start_date']}")
    audit(con, user.account_id, "mo_lai_tuan", f"week={week_id}")
    con.execute("COMMIT")
    flash(request, "Đã mở lại tuần để chỉnh sửa. Nhân viên vẫn xem bản đã chốt gần nhất cho tới khi chốt lại.")
    return _go(request.headers.get("referer") or f"/quan-ly/lich-co-so?tuan={week['start_date']}")
