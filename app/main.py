"""Điểm khởi động web Quản trị lịch làm."""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from . import routes_admin, routes_auth, routes_catalog, routes_order, routes_schedule, routes_view
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
app.include_router(routes_catalog.router)
app.include_router(routes_order.router)
app.include_router(routes_schedule.router)
app.include_router(routes_view.router)
app.include_router(routes_admin.router)


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
    return render(request, "trang_chu.html", user)


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
