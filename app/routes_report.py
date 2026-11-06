"""Xếp lịch làm tổng và Chốt lịch & báo cáo (lấy từ bản offline 1.7.6).

Mọi thao tác ghi lịch đi qua logic web (schedule.py) để giữ khóa xếp lịch, vị trí ô,
bản chốt và thông báo nhân viên. Các báo cáo dùng lại hàm báo cáo của bản offline.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import JSONResponse, RedirectResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from . import catalog as cat
from . import order as od
from . import schedule as sc
from .db import audit, now_str
from .legacy.constants import RANKS
from .legacy.database import DatabaseError
from .offline import get_legacy
from .security import require_user
from .web import file_download, flash, get_db, render

router = APIRouter(prefix="/quan-ly")

WD = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
WD_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
STATE_FILTERS = [
    ("", "Tất cả trạng thái"), ("unassigned", "Chưa được xếp"), ("assigned", "Đã được xếp"), ("off", "Có ca nghỉ"),
    ("no_order", "Chưa order"), ("fixed", "Có lịch cố định"), ("manual", "Quản lý đã sửa"),
]
WARN_CATEGORIES = ["THIẾU TỔNG", "THỪA TỔNG", "LỆCH VỊ TRÍ", "THIẾU CẤP 1+", "XẾP CA ĐÃ NGHỈ", "XẾP KHI CHƯA ORDER",
                   "LÀM THÔNG 3 CA", "CHƯA CÓ CA"]


def _go(url):
    return RedirectResponse(url, status_code=303)


def _bad(message, status=400, **extra):
    return JSONResponse({"ok": False, "message": message, **extra}, status_code=status)


def _pick_week(con, tuan: Optional[str]):
    start = None
    if tuan:
        try:
            start = od.week_start(date.fromisoformat(tuan))
        except ValueError:
            start = None
    if not start:
        fw = sc.focus_week(con)
        start = date.fromisoformat(fw["start_date"]) if fw else od.week_start(date.today())
    week = od.get_week(con, start)
    return start, week


def _week_ctx(start: date):
    days = [start + timedelta(days=i) for i in range(7)]
    return dict(
        start=start.isoformat(), prev_w=(start - timedelta(days=7)).isoformat(),
        next_w=(start + timedelta(days=7)).isoformat(),
        week_label=f"{start:%d/%m} – {start + timedelta(days=6):%d/%m/%Y}",
        day_heads=[f"{WD_SHORT[i]} {d:%d/%m}" for i, d in enumerate(days)],
        day_heads_long=[f"{WD[i]} {d:%d/%m}" for i, d in enumerate(days)],
    )


def _enabled(cfg) -> bool:
    return bool(cfg is not None and cfg["enabled"])


def _role_code(role: str) -> str:
    return cat.role_abbr(role) if hasattr(cat, "role_abbr") else ("PC" if role == "Pha chế" else "CB")


# ===========================================================================
# XẾP LỊCH LÀM TỔNG
# ===========================================================================
@router.get("/lich-tong")
def master_page(
    request: Request, tuan: Optional[str] = None, q: str = "", cap: str = "", cn: str = "", vt: str = "", tt: str = "",
    con=Depends(get_db), db=Depends(get_legacy),
):
    user = require_user(request, con, perm="bao_cao")
    start, week = _pick_week(con, tuan)
    ctx = _week_ctx(start)
    ctx.update(f=dict(q=q, cap=cap, cn=cn, vt=vt, tt=tt), RANKS=RANKS, STATE_FILTERS=STATE_FILTERS)
    branches = cat.branches(con, active_only=True)
    shifts = [s["name"] for s in od.order_shifts(con)]
    roles = [r["name"] for r in cat.work_roles(con, active_only=True)]
    ctx.update(branches=branches, shifts=shifts, roles=roles)
    status = sc.week_status(con, week["id"]) if week else None
    if not week or status is None:
        return render(request, "lich_tong.html", user, week=week, ready=False, **ctx)

    wid = week["id"]
    matrix = db.get_week_schedule_matrix(wid)
    emps = [dict(e) for e in db.list_employees(status="Đang làm")]
    bs = cat.branch_shift_map(con)
    shift_ids = {s["name"]: s["id"] for s in cat.shifts(con)}
    branch_by_code = {b["code"]: b for b in branches}
    emp_branches: dict[int, list] = {}
    for r in con.execute(
        "SELECT eb.employee_id, b.id, b.code FROM employee_branches eb JOIN branches b ON b.id = eb.branch_id"
        " WHERE b.status = 'Đang hoạt động' ORDER BY b.sort_order, b.id"
    ):
        emp_branches.setdefault(r[0], []).append((r[1], r[2]))
    emp_roles: dict[int, list] = {}
    for r in con.execute("SELECT employee_id, role FROM employee_roles"):
        emp_roles.setdefault(r[0], []).append(r[1])

    def matches(e):
        eid = int(e["id"])
        if q:
            needle = q.casefold()
            if needle not in str(e["code"]).casefold() and needle not in str(e["name"]).casefold():
                return False
        if cap and e["rank"] != cap:
            return False
        if cn and not any(code == cn for _bid, code in emp_branches.get(eid, [])):
            return False
        if vt and vt not in emp_roles.get(eid, []):
            return False
        cells = matrix.get(eid, {}).values()
        if tt == "assigned" and not any(c["state"] == sc.ASSIGNED for c in cells):
            return False
        if tt == "unassigned" and any(c["state"] == sc.ASSIGNED for c in cells):
            return False
        if tt == "off" and not any(c["base_status"] == od.OFF for c in cells):
            return False
        if tt == "no_order" and not any(c["base_status"] == od.NONE for c in cells):
            return False
        if tt == "fixed" and not any(c["source"] == "FIXED" for c in cells):
            return False
        if tt == "manual" and not any(c["is_manual"] for c in cells):
            return False
        return True

    rows = []
    for e in emps:
        if not matches(e):
            continue
        eid = int(e["id"])
        options = [
            {"v": f"{bid}|{role}", "t": f"{code} – {_role_code(role)}", "bid": bid, "role": role}
            for bid, code in emp_branches.get(eid, []) for role in emp_roles.get(eid, []) if role in roles
        ]
        cells, total = [], 0
        for d in range(7):
            for s in shifts:
                c = matrix.get(eid, {}).get((d, s))
                if c is None:
                    cells.append({"d": d, "s": s, "state": "", "base": "", "cls": "st-none", "text": "—", "val": "", "opts": []})
                    continue
                state, base = c["state"], c["base_status"]
                val = f"{c['branch_id']}|{c['role']}" if state == sc.ASSIGNED else ""
                warn = state == sc.ASSIGNED and base in (od.OFF, od.NONE)
                if state == sc.ASSIGNED:
                    total += 1
                    cls = "st-fx" if c["source"] == "FIXED" else "st-ok"
                    text = f"{c['branch_code']} – {_role_code(c['role'] or '')}" + (" CĐ" if c["source"] == "FIXED" else "")
                elif base == od.OFF:
                    cls, text = "st-off", "Nghỉ"
                elif base == od.NONE:
                    cls, text = "st-none", "Chưa order"
                else:
                    cls, text = "st-free", "Trống"
                opts = [o for o in options if _enabled(bs.get((o["bid"], shift_ids.get(s))))]
                if val and not any(o["v"] == val for o in opts):
                    opts = opts + [{"v": val, "t": text + " (!)"}]
                cells.append({"d": d, "s": s, "state": state, "base": base, "cls": cls + (" st-warn" if warn else ""),
                              "text": text, "val": val, "manual": bool(c["is_manual"]), "opts": opts, "warn": warn})
        rows.append({"e": e, "cells": cells, "total": total})

    summary = db.week_schedule_summary(wid)
    sum_rows = [{"label": "Toàn hệ thống", "cells": [summary["chain"].get((d, s)) for d in range(7) for s in shifts]}]
    for b in branches:
        sum_rows.append({"label": f"{b['code']} – {b['name']}",
                         "cells": [summary["branches"].get((b["code"], d, s)) for d in range(7) for s in shifts]})

    editable = sc.is_editable(con, wid) and user.can("xep_lich")
    lock = sc.lock_info(con, wid)
    locked_by_other = bool(lock and lock["account_id"] != user.account_id)
    return render(
        request, "lich_tong.html", user, week=week, ready=True, rows=rows, sum_rows=sum_rows,
        status_label=sc.status_label(con, wid), editable=editable and not locked_by_other,
        lock=lock if locked_by_other else None, closed=sc.week_status(con, wid) == sc.ST_CHOT,
        has_published=sc.has_published(con, wid), stats=db.week_schedule_page_stats(wid), **ctx,
    )


@router.post("/lich-tong/o")
async def master_cell(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="xep_lich")
    data = await request.json()
    try:
        week_id, eid, d = int(data["week_id"]), int(data["employee_id"]), int(data["weekday"])
        shift = str(data["shift"])
        value = str(data.get("value") or "")
        bid, role = (int(value.split("|", 1)[0]), value.split("|", 1)[1]) if value else (None, None)
    except (KeyError, TypeError, ValueError, IndexError):
        return _bad("Dữ liệu không hợp lệ.")
    if not od.week_by_id(con, week_id) or not sc.is_editable(con, week_id):
        return _bad("Tuần đã chốt hoặc chưa bắt đầu xếp. Tải lại trang.", 409)
    ok, lock = sc.try_lock(con, week_id, user.account_id)
    if not ok:
        return _bad(f"{lock['who']} đang giữ quyền xếp lịch. Bạn đang ở chế độ chỉ xem.", 409)
    if not 0 <= d <= 6:
        return _bad("Ngày không hợp lệ.")
    if bid is not None and not any(s["name"] == shift for s in cat.enabled_shifts_for_branch(con, bid)):
        return _bad("Ca này không bật ở cơ sở đã chọn.")
    con.execute("BEGIN")
    try:
        cur = sc._entry(con, week_id, eid, d, shift)
        if cur and cur["state"] == sc.ASSIGNED:
            if bid is not None and cur["branch_id"] == bid and cur["role"] == role:
                con.execute("ROLLBACK")
                return {"ok": True, "saved_at": now_str()[11:16]}
            sc.unassign(con, week_id, eid, d, shift)
        if bid is not None:
            sc.assign(con, week_id, eid, d, shift, bid, role, None)
    except sc.ScheduleError as e:
        con.execute("ROLLBACK")
        return _bad(str(e))
    sc.touch(con, week_id)
    audit(con, user.account_id, "xep_lich_tong", f"w{week_id} e{eid} d{d} {shift} -> {value or 'trống'}")
    con.execute("COMMIT")
    return {"ok": True, "saved_at": now_str()[11:16]}


@router.post("/lich-tong/tu-dong/{week_id}")
def master_auto(week_id: int, request: Request, con=Depends(get_db)):
    """XẾP THEO ORDER & LỊCH CỐ ĐỊNH (bản offline). Tuần chưa xếp → bắt đầu xếp; tuần đang xếp → xếp lại từ đầu."""
    user = require_user(request, con, perm="xep_lich")
    week = od.week_by_id(con, week_id)
    if not week:
        return _go("/quan-ly/lich-tong")
    back = f"/quan-ly/lich-tong?tuan={week['start_date']}"
    status = sc.week_status(con, week_id)
    if status == sc.ST_CHOT:
        flash(request, "Lịch tuần đã chốt. Hãy mở lại để chỉnh sửa trước khi xếp lại tự động.", "error")
        return _go(back)
    if status is not None:
        ok, lock = sc.try_lock(con, week_id, user.account_id)
        if not ok:
            flash(request, f"{lock['who']} đang giữ quyền xếp lịch.", "error")
            return _go(back)
    con.execute("BEGIN")
    try:
        if status is not None:
            con.execute("DELETE FROM schedule_closures WHERE week_id = ?", (week_id,))
        n = sc.start_scheduling(con, week, user.account_id)
        if status == sc.ST_SUA:
            con.execute("UPDATE schedule_closures SET status = ? WHERE week_id = ?", (sc.ST_SUA, week_id))
    except sc.ScheduleError as e:
        con.execute("ROLLBACK")
        flash(request, str(e), "error")
        return _go(back)
    audit(con, user.account_id, "xep_lich_tu_dong", f"week={week_id} fixed={n}")
    con.execute("COMMIT")
    flash(request, f"Đã xếp theo order & lịch cố định: {n} ca từ lịch cố định. Các ô khác để trống cho quản lý xếp tay.")
    return _go(back)


@router.post("/lich-tong/cap-nhat-order/{week_id}")
def master_reapply(week_id: int, request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    """GHI ĐÈ ORDER VÀO LỊCH TỔNG: đọc lại order nhưng giữ nguyên các ca đã xếp."""
    user = require_user(request, con, perm="xep_lich")
    week = od.week_by_id(con, week_id)
    if not week:
        return _go("/quan-ly/lich-tong")
    back = f"/quan-ly/lich-tong?tuan={week['start_date']}"
    if not sc.is_editable(con, week_id):
        flash(request, "Tuần đã chốt hoặc chưa bắt đầu xếp lịch.", "error")
        return _go(back)
    try:
        res = db.reapply_order_to_schedule(week_id)
    except DatabaseError as exc:
        flash(request, str(exc), "error")
        return _go(back)
    sc.touch(con, week_id)
    audit(con, user.account_id, "cap_nhat_order_vao_lich", f"week={week_id}")
    flash(request, f"Đã cập nhật order vào lịch: {res.get('updated', 0)} ô cập nhật, {res.get('inserted', 0)} ô mới,"
                   f" giữ nguyên {res.get('assigned_preserved', 0)} ca đã xếp"
                   + (f", {res.get('conflicts', 0)} ca cần kiểm tra (order Nghỉ/Chưa order)." if res.get("conflicts") else "."))
    return _go(back)


@router.post("/lich-tong/xoa/{week_id}")
def master_clear(week_id: int, request: Request, xac_nhan: str = Form(""), con=Depends(get_db)):
    user = require_user(request, con, perm="xep_lich")
    week = od.week_by_id(con, week_id)
    if not week:
        return _go("/quan-ly/lich-tong")
    back = f"/quan-ly/lich-tong?tuan={week['start_date']}"
    if xac_nhan.strip().upper() != "XOA":
        flash(request, "Gõ XOA để xác nhận xóa lịch tuần.", "error")
        return _go(back)
    if sc.week_status(con, week_id) == sc.ST_CHOT:
        flash(request, "Lịch tuần đã chốt. Hãy mở lại trước.", "error")
        return _go(back)
    if sc.has_published(con, week_id):
        flash(request, "Tuần này đã chốt ít nhất một lần và nhân viên đã thấy lịch, không xóa được. Hãy sửa trực tiếp rồi chốt lại.", "error")
        return _go(back)
    con.execute("BEGIN")
    for t in ("weekly_schedule_entries", "schedule_extra_rows", "schedule_locks", "schedule_closures"):
        con.execute(f"DELETE FROM {t} WHERE week_id = ?", (week_id,))
    audit(con, user.account_id, "xoa_lich_tuan", f"week={week_id}")
    con.execute("COMMIT")
    flash(request, "Đã xóa lịch tuần. Order vẫn giữ nguyên; bấm “Xếp theo order & lịch cố định” để xếp lại.")
    return _go(back)


# ===========================================================================
# CHỐT LỊCH & BÁO CÁO
# ===========================================================================
@router.get("/bao-cao")
def report_page(
    request: Request, tuan: Optional[str] = None, tab: str = "lich", che_do: str = "nv", cn: str = "", q: str = "",
    loai: str = "", con=Depends(get_db), db=Depends(get_legacy),
):
    user = require_user(request, con, perm="bao_cao")
    start, week = _pick_week(con, tuan)
    ctx = _week_ctx(start)
    branches = cat.branches(con, active_only=True)
    ctx.update(tab=tab, che_do=che_do, cn=cn or (branches[0]["code"] if branches else ""), q=q, loai=loai,
               branches=branches, WARN_CATEGORIES=WARN_CATEGORIES)
    if tab == "lich-su":
        hist = db.recent_schedule_closures()
        for h in hist:
            h["label"] = sc.status_label(con, h["week_id"])
        return render(request, "bao_cao.html", user, week=week, ready=bool(week and sc.week_status(con, week["id"])),
                      hist=hist, **ctx)
    status = sc.week_status(con, week["id"]) if week else None
    if not week or status is None:
        return render(request, "bao_cao.html", user, week=week, ready=False, **ctx)
    wid = week["id"]
    report = db.schedule_warning_report(wid)
    stats = db.week_schedule_page_stats(wid)
    cl = sc.closure(con, wid)
    ctx.update(
        ready=True, status_label=sc.status_label(con, wid), closed=status == sc.ST_CHOT, closed_at=cl["closed_at"] if cl else None,
        stats=stats, counts=report["counts"], warn_total=sum(report["counts"].values()),
    )
    if tab == "canh-bao":
        lines = []
        for line in report["lines"]:
            catg, sep, detail = line.partition(":")
            lines.append({"cat": catg.strip(), "detail": detail.strip() if sep else line})
        if loai:
            lines = [x for x in lines if x["cat"] == loai]
        ctx["lines"] = lines
    elif tab == "dinh-bien":
        ctx["staff_rows"] = db.staffing_report_rows(wid)
    elif tab == "nhan-vien":
        rows = db.employee_schedule_report(wid)
        if q:
            rows = [r for r in rows if q.casefold() in f"{r['code']} {r['name']}".casefold()]
        ctx.update(emp_rows=rows, shifts=[s["name"] for s in od.order_shifts(con)])
    elif tab == "order":
        ctx["order"] = db.order_report_details(wid)
    elif tab == "co-so":
        ctx["branch_rows"] = db.branch_schedule_report(wid)
    else:
        ctx["tab"] = "lich"
        ctx.update(_weekly_view(con, db, wid, che_do, ctx["cn"], q))
    return render(request, "bao_cao.html", user, week=week, **ctx)


def _weekly_view(con, db, wid, che_do, cn, q):
    if che_do == "cs":
        b = next((x for x in cat.branches(con) if x["code"] == cn), None)
        if not b:
            return {"grid": None}
        summary = db.week_schedule_summary(wid)
        rows = db.branch_weekly_compact_grid(wid, b["code"])
        shift_names = []
        for r in rows:
            if r["shift"] not in shift_names:
                shift_names.append(r["shift"])
        blocks = []
        for s in shift_names:
            blocks.append({
                "shift": s,
                "rows": [r for r in rows if r["shift"] == s],
                "totals": [summary["branches"].get((b["code"], d, s)) for d in range(7)],
            })
        return {"blocks": blocks, "branch": b}
    rows = db.employee_weekly_schedule_grid(wid)
    if q:
        rows = [r for r in rows if q.casefold() in f"{r['code']} {r['name']}".casefold()]
    for r in rows:
        r["cells"] = [
            [f"{(a.get('shift') or '')} · {(a.get('branch_name') or a.get('branch_ui_code') or a.get('branch_code') or '')}"
             f" – {_role_code(str(a.get('role') or ''))}" for a in r["days"].get(d, [])]
            for d in range(7)
        ]
    return {"emp_grid": rows}


# ---------------- Xuất Excel ----------------
def _style_sheet(ws, freeze="A2") -> None:
    dark_fill = PatternFill("solid", fgColor="1E3A8A")
    white_font = Font(color="FFFFFF", bold=True)
    thin = Side(style="thin", color="CBD5E1")
    for cell in ws[1]:
        cell.fill = dark_fill
        cell.font = white_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(vertical="center", wrap_text=True)
            cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)
    ws.freeze_panes = freeze
    for column_cells in ws.columns:
        length = max(len(str(cell.value or "")) for cell in column_cells)
        ws.column_dimensions[get_column_letter(column_cells[0].column)].width = min(max(length + 3, 11), 36)


def _dmy(iso):
    return datetime.strptime(iso, "%Y-%m-%d").strftime("%d/%m/%Y")


@router.get("/bao-cao/xuat")
def export_report(request: Request, tuan: str, con=Depends(get_db), db=Depends(get_legacy)):
    require_user(request, con, perm="bao_cao")
    start, week = _pick_week(con, tuan)
    if not week or sc.week_status(con, week["id"]) is None:
        flash(request, "Tuần đang chọn chưa có lịch để xuất.", "error")
        return _go(f"/quan-ly/bao-cao?tuan={start.isoformat()}")
    wid = week["id"]
    shifts = [s["name"] for s in od.order_shifts(con)]
    report = db.schedule_warning_report(wid)
    stats = db.week_schedule_page_stats(wid)
    cl = sc.closure(con, wid)
    heads = _week_ctx(start)["day_heads_long"]

    def build(path):
        wb = Workbook()
        ws = wb.active
        ws.title = "TONG_QUAN"
        ws.append(["NỘI DUNG", "GIÁ TRỊ"])
        for row in [
            ("TUẦN", f"{_dmy(week['start_date'])} – {_dmy(week['end_date'])}"),
            ("TRẠNG THÁI", sc.status_label(con, wid)),
            ("CHỐT GẦN NHẤT", (cl["closed_at"] if cl and cl["closed_at"] else "—")),
            ("NHÂN VIÊN ĐANG LÀM", stats["active"]),
            ("NHÂN VIÊN ĐÃ XẾP", stats["assigned_employees"]),
            ("NHÂN VIÊN CHƯA CÓ CA", stats["unassigned_employees"]),
            ("TỔNG CA ĐÃ XẾP", stats["total_assignments"]),
            ("TỔNG CẢNH BÁO", sum(report["counts"].values())),
        ]:
            ws.append(list(row))
        _style_sheet(ws)
        ws = wb.create_sheet("CANH_BAO")
        ws.append(["LOẠI", "CHI TIẾT"])
        for line in report["lines"] or ["KHÔNG CÓ CẢNH BÁO"]:
            catg, sep, detail = line.partition(":")
            ws.append([catg, detail.strip() if sep else line])
        _style_sheet(ws)
        ws = wb.create_sheet("DINH_BIEN")
        ws.append(["CƠ SỞ", "NGÀY", "CA", "TỔNG", "ĐỊNH BIÊN", "PHA CHẾ", "CHẠY BÀN", "CẤP 1+", "TRẠNG THÁI"])
        for r in db.staffing_report_rows(wid):
            ws.append([r["branch_code"], r["day"], r["shift"], r["actual"], r["required"],
                       f"{r['bar_actual']}/{r['bar_required']}", f"{r['floor_actual']}/{r['floor_required']}",
                       r["senior"], r["status"]])
        _style_sheet(ws)
        ws = wb.create_sheet("NHAN_VIEN")
        ws.append(["MÃ NV", "TÊN NHÂN VIÊN", "PHÂN CẤP", "TỔNG CA", *[s.upper() for s in shifts], "CƠ SỞ"])
        for r in db.employee_schedule_report(wid):
            ws.append([r["code"], r["name"], r["rank"], r["total"], *[r.get("shift_counts", {}).get(s, 0) for s in shifts],
                       r["branches"]])
        _style_sheet(ws)
        ws = wb.create_sheet("ORDER")
        ws.append(["NỘI DUNG", "GIÁ TRỊ"])
        od_data = db.order_report_details(wid)
        sm = od_data["summary"]
        for row in [("NHÂN VIÊN ĐANG LÀM", sm["active"]), ("ĐÃ CÓ ORDER", sm["with_data"]),
                    ("CHƯA CÓ ORDER", sm["without_data"]), ("Ô ĐI LÀM ĐƯỢC", sm["available"]), ("Ô NGHỈ", sm["off"])]:
            ws.append(list(row))
        ws.append([])
        ws.append(["NGOẠI LỆ", "CHI TIẾT"])
        for r in od_data["exceptions"]:
            ws.append([r["category"], r["detail"]])
        _style_sheet(ws)
        ws = wb.create_sheet("CO_SO")
        ws.append(["CƠ SỞ", "TỔNG CA NV", "CA ĐỦ", "CA THIẾU", "CA THỪA", "LỆCH VỊ TRÍ", "THIẾU CẤP 1+"])
        for r in db.branch_schedule_report(wid):
            ws.append([r["branch_code"], r["total_assignments"], r["exact"], r["shortage"], r["overstaff"],
                       r["role_mismatch"], r["missing_senior"]])
        _style_sheet(ws)
        ws = wb.create_sheet("LICH_TONG_7_NGAY")
        ws.append(["MÃ NV", "TÊN NHÂN VIÊN", "PHÂN CẤP", *heads, "TỔNG CA"])
        for r in db.employee_weekly_schedule_grid(wid):
            cells = []
            for d in range(7):
                blocks = [f"{str(a.get('shift') or '').upper()}\n"
                          f"{str(a.get('branch_name') or a.get('branch_code') or '').upper()} – {_role_code(str(a.get('role') or ''))}"
                          for a in r["days"].get(d, [])]
                cells.append("\n\n".join(blocks))
            ws.append([r["code"], r["name"], r["rank"], *cells, r["total"]])
        _style_sheet(ws, "D2")
        for i in range(2, ws.max_row + 1):
            ws.row_dimensions[i].height = 58
        wb.save(path)

    return file_download(build, f"Bao_cao_lich_{week['start_date']}_{week['end_date']}.xlsx")


@router.get("/bao-cao/xuat-lich")
def export_weekly(request: Request, tuan: str, che_do: str = "nv", cn: str = "", con=Depends(get_db), db=Depends(get_legacy)):
    require_user(request, con, perm="bao_cao")
    start, week = _pick_week(con, tuan)
    if not week or sc.week_status(con, week["id"]) is None:
        flash(request, "Tuần đang chọn chưa có lịch để xuất.", "error")
        return _go(f"/quan-ly/bao-cao?tuan={start.isoformat()}")
    wid = week["id"]
    heads = _week_ctx(start)["day_heads_long"]
    view = _weekly_view(con, db, wid, che_do, cn, "")

    def build(path):
        wb = Workbook()
        ws = wb.active
        ws.title = "LICH_TUAN"
        if che_do == "cs" and view.get("blocks") is not None:
            ws.append(["CA – VỊ TRÍ", *heads])
            for blk in view["blocks"]:
                for r in blk["rows"]:
                    n = max([len(x) for x in r["days"]] + list(r["required"]) + [1])
                    for i in range(n):
                        line = [f"{blk['shift']} – {r['role']} {i + 1}"]
                        for d in range(7):
                            items = r["days"][d]
                            if i < len(items):
                                a = items[i]
                                line.append(f"{a['code']} – {a['name']}" + (" CĐ" if a.get("source") == "FIXED" else ""))
                            elif i < r["required"][d]:
                                line.append("THIẾU")
                            else:
                                line.append("")
                        ws.append(line)
                line = [f"TỔNG CA {blk['shift'].upper()}"]
                for t in blk["totals"]:
                    line.append(f"{t['actual']}/{t['required']}" if t else "")
                ws.append(line)
            _style_sheet(ws, "B2")
            name = f"Lich_co_so_{view['branch']['code']}_{week['start_date']}.xlsx"
        else:
            ws.append(["STT", "MÃ NV", "TÊN NHÂN VIÊN", "PHÂN CẤP", *heads, "TỔNG CA"])
            for i, r in enumerate(view.get("emp_grid") or [], start=1):
                ws.append([i, r["code"], r["name"], r["rank"], *["\n".join(c) for c in r["cells"]], r["total"]])
            _style_sheet(ws, "E2")
            name = f"Lich_tong_theo_nhan_vien_{week['start_date']}.xlsx"
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        for i in range(2, ws.max_row + 1):
            ws.row_dimensions[i].height = 40
        out = path.with_name(name)
        wb.save(out)
        return out

    return file_download(build, "lich.xlsx")
