"""Điểm khởi động web Quản trị lịch làm."""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from . import (routes_accounts, routes_admin, routes_auth, routes_catalog, routes_data, routes_eval, routes_order,
               routes_extra, routes_report, routes_schedule, routes_view)
from .db import connect, get_secret_key, init_db
from .security import Forbidden, Redirect, current_user, require_user
from .web import MANAGER_MENU, get_db, render

init_db()

app = FastAPI(title="Quản trị lịch làm", docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def same_origin_post(request: Request, call_next):
    """Chặn gửi form từ trang web khác (CSRF): POST phải đến từ chính trang này."""
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin") or request.headers.get("referer")
        if origin:
            if urlparse(origin).netloc != request.headers.get("host"):
                return HTMLResponse("Yêu cầu không hợp lệ.", status_code=403)
    return await call_next(request)


app.add_middleware(
    SessionMiddleware,
    secret_key=get_secret_key(),
    session_cookie="lich_lam_session",
    max_age=30 * 24 * 3600,  # giữ đăng nhập 30 ngày
    same_site="lax",
    https_only=os.environ.get("APP_HTTPS") == "1",
)

app.mount("/static", StaticFiles(directory=str(Path(__file__).parent / "static")), name="static")
app.include_router(routes_auth.router)
app.include_router(routes_extra.router)  # trước routes_catalog: /nhan-vien/nhap-excel ≠ /nhan-vien/{id}
app.include_router(routes_catalog.router)
app.include_router(routes_order.router)
app.include_router(routes_schedule.router)
app.include_router(routes_view.router)
app.include_router(routes_admin.router)
app.include_router(routes_eval.router)
app.include_router(routes_report.router)
app.include_router(routes_data.router)
app.include_router(routes_accounts.router)


@app.exception_handler(Redirect)
async def on_redirect(request: Request, exc: Redirect):
    return RedirectResponse(exc.url, status_code=303)


@app.exception_handler(Forbidden)
async def on_forbidden(request: Request, exc: Forbidden):
    con = connect()
    try:
        user = current_user(request, con)
        return render(request, "thong_bao_loi.html", user, status_code=403,
                      title="Không có quyền", message="Bạn không có quyền vào trang này.")
    finally:
        con.close()


@app.get("/")
def home(request: Request, con=Depends(get_db)):
    user = require_user(request, con)
    if not user.is_manager_view:
        return RedirectResponse("/order", status_code=303)
    return render(request, "trang_chu.html", user, **_dashboard(con))


def _dashboard(con):
    """Tổng quan như bản offline: nhân viên, định biên, order và lịch tuần đang tập trung, đánh giá gần nhất."""
    from datetime import date, timedelta

    from . import order as od
    from . import schedule as sc

    q = lambda sql, *a: con.execute(sql, a).fetchone()[0]  # noqa: E731
    d = {
        "emp_active": q("SELECT COUNT(*) FROM employees WHERE status = 'Đang làm'"),
        "emp_total": q("SELECT COUNT(*) FROM employees"),
        "staff_cells": q("SELECT COUNT(*) FROM staffing_requirements WHERE required_count > 0"),
        "fixed_members": q("SELECT COUNT(*) FROM fixed_schedule_members"),
        "no_pw": q("SELECT COUNT(*) FROM accounts a JOIN employees e ON e.id = a.employee_id"
                   " WHERE e.status = 'Đang làm' AND a.password_hash IS NULL"),
    }
    fw = sc.focus_week(con)
    start = date.fromisoformat(fw["start_date"]) if fw else od.week_start(date.today()) + timedelta(days=7)
    week = od.get_week(con, start)
    d["week_start"] = start.isoformat()
    d["week_label"] = f"{start:%d/%m} – {start + timedelta(days=6):%d/%m/%Y}"
    d["week"] = week
    if week:
        wid = week["id"]
        d["submitted"] = q(
            "SELECT COUNT(DISTINCT e.id) FROM employees e WHERE e.status = 'Đang làm' AND (EXISTS (SELECT 1 FROM"
            " order_submissions s WHERE s.week_id = ? AND s.employee_id = e.id) OR EXISTS (SELECT 1 FROM order_entries o"
            " WHERE o.week_id = ? AND o.employee_id = e.id AND o.status IN ('ĐI LÀM ĐƯỢC', 'NGHỈ')))", wid, wid)
        d["win"] = od.window_state(con, week)
        d["sched_label"] = sc.status_label(con, wid)
        d["assigned"] = q("SELECT COUNT(*) FROM weekly_schedule_entries WHERE week_id = ? AND state = 'ĐÃ XẾP'", wid)
        d["warn"] = sc.warning_total(con) if sc.week_status(con, wid) else 0
    r = con.execute("SELECT * FROM evaluation_rounds ORDER BY evaluation_date DESC LIMIT 1").fetchone()
    if r:
        d["eval"] = {
            "id": r["id"], "label": r["label"], "status": r["status"],
            "done": q("SELECT COUNT(*) FROM evaluation_round_employees WHERE round_id = ? AND status = 'ĐÃ ĐÁNH GIÁ'", r["id"]),
            "total": q("SELECT COUNT(*) FROM evaluation_round_employees WHERE round_id = ?", r["id"]),
        }
    return d


# Các trang của bước sau: hiện "đang làm" thay vì lỗi 404.
for _g, _label, _href, _perm, _ready in MANAGER_MENU:
    if _ready:
        continue

    def _make(label=_label, perm=_perm):
        def page(request: Request, con=Depends(get_db)):
            user = require_user(request, con, perm=perm)
            return render(request, "thong_bao_loi.html", user, title=label,
                          message="Trang này sẽ có ở các bước tiếp theo.")
        return page

    app.add_api_route(_href, _make(), methods=["GET"])


@app.get("/healthz")
def healthz():
    return {"ok": True}
