"""Bước 5 – Cảnh báo (quản lý), Lịch của tôi + lịch cơ sở (nhân viên), Thông báo."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, RedirectResponse

from . import catalog as cat
from . import order as od
from . import schedule as sc
from .security import require_user
from .web import get_db, render

router = APIRouter()

WARN_GROUPS = [
    ("thieu", "Ca thiếu người so với định biên", "Ca thiếu người so với định biên", "#dc2626"),
    ("thieu_cap2", "Ca thiếu người Cấp 2 hoặc Quản lý", "Ca thiếu người Cấp 2 hoặc Quản lý", "#ea580c"),
    ("xep_nghi", "Đã xếp người order Nghỉ", "Đã xếp người order Nghỉ", "#b91c1c"),
    ("xep_chua_order", "Đã xếp người Chưa order", "Đã xếp người Chưa order", "#6b7280"),
    ("vuot", "Xếp vượt định biên", "Xếp vượt định biên", "#ca8a04"),
    ("thong_3_ca", "Làm thông 3 ca", "Làm thông 3 ca", "#7c3aed"),
]
STATUS_LABEL = {sc.ST_XEP: "Đang xếp", sc.ST_CHOT: "Đã chốt", sc.ST_SUA: "Đang chỉnh sửa"}


def _parse_week(tuan: Optional[str]) -> Optional[date]:
    try:
        return od.week_start(date.fromisoformat(tuan)) if tuan else None
    except ValueError:
        return None


def _hhmm(t):
    return (t or "")[:5]


# ===========================================================================
# Cảnh báo (quản lý)
# ===========================================================================
@router.get("/quan-ly/canh-bao")
def warnings_page(request: Request, tuan: Optional[str] = None, con=Depends(get_db)):
    user = require_user(request, con, perm="xep_lich")
    start = _parse_week(tuan)
    if not start:
        fw = sc.focus_week(con)
        start = date.fromisoformat(fw["start_date"]) if fw else od.week_start(date.today()) + timedelta(days=7)
    week = od.get_week(con, start)
    ctx = dict(
        start=start.isoformat(), prev_w=(start - timedelta(days=7)).isoformat(),
        next_w=(start + timedelta(days=7)).isoformat(),
        week_label=f"{start:%d/%m} – {start + timedelta(days=6):%d/%m/%Y}",
    )
    status = sc.week_status(con, week["id"]) if week else None
    if not status:
        return render(request, "canh_bao.html", user, ready=False, **ctx)
    w = sc.warnings(con, week)
    groups = [{"key": k, "title": t, "tile": tl, "color": c, "items": w[k]} for k, t, tl, c in WARN_GROUPS]
    return render(
        request, "canh_bao.html", user, ready=True, status_label=STATUS_LABEL.get(status, status), groups=groups,
        so_ca=w["so_ca"], max_ca=max([x["n"] for x in w["so_ca"]] or [1]), total=sum(len(g["items"]) for g in groups), **ctx,
    )


# ===========================================================================
# Lịch nhân viên (chỉ lịch đã chốt)
# ===========================================================================
def _published_weeks(con):
    return con.execute(
        "SELECT w.* FROM weeks w WHERE EXISTS (SELECT 1 FROM schedule_published p WHERE p.week_id = w.id) ORDER BY w.start_date"
    ).fetchall()


def _pick_week(con, tuan):
    weeks = _published_weeks(con)
    if not weeks:
        return None, [], None, None
    start = _parse_week(tuan)
    idx = None
    if start:
        idx = next((i for i, w in enumerate(weeks) if w["start_date"] == start.isoformat()), None)
    if idx is None:
        today = od.week_start(date.today()).isoformat()
        idx = next((i for i, w in enumerate(weeks) if w["start_date"] >= today), len(weeks) - 1)
    prev_w = weeks[idx - 1]["start_date"] if idx > 0 else None
    next_w = weeks[idx + 1]["start_date"] if idx + 1 < len(weeks) else None
    return weeks[idx], weeks, prev_w, next_w


def _week_nav(week, prev_w, next_w):
    return dict(week_label=od.week_label(week), start=week["start_date"], prev_w=prev_w, next_w=next_w)


SHIFT_COLORS = ["#f59e0b", "#0ea5e9", "#7c3aed", "#10b981", "#ec4899"]
WD_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]


def _when(ts: str) -> str:
    """'2026-10-01 20:40:11' → 'Hôm nay 20:40' / '01/10 20:40'"""
    try:
        t = datetime.fromisoformat(ts)
    except (ValueError, TypeError):
        return ts or ""
    if t.date() == date.today():
        return f"Hôm nay {t:%H:%M}"
    if t.date() == date.today() - timedelta(days=1):
        return f"Hôm qua {t:%H:%M}"
    return f"{t:%d/%m %H:%M}"


@router.get("/lich")
def my_schedule(request: Request, tuan: Optional[str] = None, con=Depends(get_db)):
    user = require_user(request, con, perm="xem_lich_minh")
    week, weeks, prev_w, next_w = _pick_week(con, tuan)
    if not user.employee_id:
        return render(request, "lich.html", user, tab="cua_toi", week=None, no_emp=True)
    if not week:
        return render(request, "lich.html", user, tab="cua_toi", week=None, no_emp=False)
    shift_idx = {s["name"]: i for i, s in enumerate(cat.shifts(con))}
    rows = con.execute(
        """
        SELECT p.weekday, p.shift, p.role, p.note, p.changed_at, b.code AS bcode, b.name AS bname, bs.start_time, bs.end_time
        FROM schedule_published p
        JOIN branches b ON b.id = p.branch_id
        LEFT JOIN shifts s ON s.name = p.shift
        LEFT JOIN branch_shifts bs ON bs.branch_id = p.branch_id AND bs.shift_id = s.id
        WHERE p.week_id = ? AND p.employee_id = ?
        ORDER BY p.weekday, COALESCE(s.sort_order, 99), p.shift
        """,
        (week["id"], user.employee_id),
    ).fetchall()
    link = f"/lich?tuan={week['start_date']}"
    unread = con.execute(
        "SELECT id, title, body, created_at FROM notifications WHERE account_id = ? AND read_at IS NULL AND link = ?"
        " ORDER BY id", (user.account_id, link),
    ).fetchall()
    changes = [n for n in unread if "thay đổi" in n["title"]]
    since = None
    if changes:
        since = datetime.fromisoformat(changes[0]["created_at"]) - timedelta(seconds=10)
    by_day = {}
    for r in rows:
        upd = bool(since and r["changed_at"] and datetime.fromisoformat(r["changed_at"]) >= since)
        by_day.setdefault(r["weekday"], []).append({
            "shift": r["shift"], "role": r["role"], "branch": r["bcode"], "branch_name": r["bname"],
            "hours": f"{_hhmm(r['start_time'])}–{_hhmm(r['end_time'])}" if r["start_time"] else "",
            "color": SHIFT_COLORS[shift_idx.get(r["shift"], 0) % len(SHIFT_COLORS)],
            "updated": upd, "note": r["note"] if upd else "",
        })
    days = [{**d, "shifts": by_day.get(d["index"], [])} for d in od.week_days(week)]
    banner = None
    if changes:
        lines = [l for n in changes for l in (n["body"] or "").split("\n") if l]
        banner = {"when": _when(changes[-1]["created_at"]).lower().replace("hôm nay", "hôm nay lúc").replace("hôm qua", "hôm qua lúc"),
                  "n": len(lines), "lines": lines}
    if unread:
        from .db import now_str
        con.execute("UPDATE notifications SET read_at = ? WHERE account_id = ? AND read_at IS NULL AND link = ?",
                    (now_str(), user.account_id, link))
    st = sc.week_status(con, week["id"])
    return render(
        request, "lich.html", user, tab="cua_toi", week=week, days=days, total=len(rows), no_emp=False,
        banner=banner, editing=st == sc.ST_SUA, **_week_nav(week, prev_w, next_w),
    )


@router.get("/lich/co-so")
def branch_schedule(request: Request, tuan: Optional[str] = None, cn: Optional[int] = None,
                    ngay: Optional[int] = None, con=Depends(get_db)):
    user = require_user(request, con, perm="xem_lich_minh")
    week, weeks, prev_w, next_w = _pick_week(con, tuan)
    branches = cat.branches(con, active_only=True)
    if not week or not branches:
        return render(request, "lich.html", user, tab="co_so", week=None, no_emp=False, branches=branches, branch=None)
    branch = next((b for b in branches if b["id"] == cn), branches[0])
    wstart = date.fromisoformat(week["start_date"])
    if ngay is None or not 0 <= ngay <= 6:
        delta = (date.today() - wstart).days
        ngay = delta if 0 <= delta <= 6 else 0
    role_order = {r["name"]: i for i, r in enumerate(cat.work_roles(con))}
    rank_order = {r: i for i, r in enumerate(cat.RANKS)}
    rows = con.execute(
        """
        SELECT p.shift, p.role, e.code, e.name, e.rank
        FROM schedule_published p JOIN employees e ON e.id = p.employee_id
        WHERE p.week_id = ? AND p.branch_id = ? AND p.weekday = ?
        """,
        (week["id"], branch["id"], ngay),
    ).fetchall()
    cell = {}
    for r in rows:
        cell.setdefault(r["shift"], []).append(r)
    blocks = []
    for s in cat.enabled_shifts_for_branch(con, branch["id"]):
        people = sorted(cell.get(s["name"], []), key=lambda e: (role_order.get(e["role"], 99), -rank_order.get(e["rank"], 0), e["name"]))
        blocks.append({
            "shift": s["name"], "hours": f"{_hhmm(s['start_time'])} – {_hhmm(s['end_time'])}",
            "people": [{"label": f"{p['code']} – {p['name']}", "role": p["role"], "me": p["code"] == user.code} for p in people],
        })
    day_buttons = [{"i": i, "w": WD_SHORT[i], "date": f"{wstart + timedelta(days=i):%d/%m}", "active": i == ngay} for i in range(7)]
    d = od.week_days(week)[ngay]
    return render(
        request, "lich.html", user, tab="co_so", week=week, no_emp=False, branches=branches, branch=branch,
        blocks=blocks, day_buttons=day_buttons, day_title=f"{branch['code']} – {branch['name']} · {d['name']} {d['date']}",
        ngay=ngay, editing=sc.week_status(con, week["id"]) == sc.ST_SUA, **_week_nav(week, prev_w, next_w),
    )


# ===========================================================================
# Thông báo
# ===========================================================================
KIND_ICON = [  # (từ khóa trong tiêu đề, ký hiệu, nền, chữ)
    ("thay đổi", "!", "#ffedd5", "#9a3412"),
    ("Sắp hết hạn", "!", "#fee2e2", "#991b1b"),
    ("Đã mở order", "+", "#dbeafe", "#1e3a8a"),
    ("đã được chốt", "✓", "#dcfce7", "#14532d"),
]


@router.get("/thong-bao")
def notifications_page(request: Request, con=Depends(get_db)):
    user = require_user(request, con, perm="xem_lich_minh")
    rows = con.execute(
        "SELECT * FROM notifications WHERE account_id = ? ORDER BY id DESC LIMIT 100", (user.account_id,)
    ).fetchall()
    items = []
    for r in rows:
        icon = next(((i, bg, fg) for k, i, bg, fg in KIND_ICON if k in r["title"]), ("•", "#e6e9ef", "#3b4454"))
        items.append({
            "title": r["title"], "lines": [l for l in (r["body"] or "").split("\n") if l], "when": _when(r["created_at"]),
            "unread": r["read_at"] is None, "link": r["link"], "icon": icon[0], "bg": icon[1], "fg": icon[2],
        })
    n_unread = sum(1 for i in items if i["unread"])
    if n_unread:
        from .db import now_str
        con.execute("UPDATE notifications SET read_at = ? WHERE account_id = ? AND read_at IS NULL", (now_str(), user.account_id))
    return render(request, "thong_bao.html", user, items=items, n_unread=n_unread)
