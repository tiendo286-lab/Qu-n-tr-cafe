"""Phần dùng chung cho các trang: template, menu, thông báo nhanh."""
from __future__ import annotations

from pathlib import Path
from typing import Iterator

from fastapi import Request
from fastapi.templating import Jinja2Templates

from . import notify
from .db import ROLE_LABELS, connect

templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))
templates.env.globals["ROLE_LABELS"] = ROLE_LABELS


def _asset_v(name: str) -> str:
    """Số phiên bản theo giờ sửa file, để trình duyệt luôn tải CSS/JS mới."""
    try:
        return str(int((Path(__file__).parent / "static" / name).stat().st_mtime))
    except OSError:
        return "0"


templates.env.globals["asset_v"] = _asset_v


def get_db() -> Iterator:
    con = connect()
    try:
        yield con
    finally:
        con.close()


# Menu quản lý: (nhóm, nhãn, đường dẫn, quyền cần, đã làm chưa)
MANAGER_MENU = [
    ("XẾP LỊCH", "Order lịch làm", "/quan-ly/order", "xem_tat_ca", True),
    ("XẾP LỊCH", "Lịch cơ sở", "/quan-ly/lich-co-so", "xem_tat_ca", True),
    ("XẾP LỊCH", "Cảnh báo", "/quan-ly/canh-bao", "xep_lich", True),
    ("XẾP LỊCH", "Lịch cố định", "/quan-ly/lich-co-dinh", "sua_danh_muc", True),
    ("THIẾT LẬP", "Định biên", "/quan-ly/dinh-bien", "sua_danh_muc", True),
    ("THIẾT LẬP", "Chi nhánh, ca & vai trò", "/quan-ly/chi-nhanh", "sua_danh_muc", True),
    ("THIẾT LẬP", "Nhân viên", "/quan-ly/nhan-vien", "quan_ly_nhan_vien", True),
    ("THIẾT LẬP", "Giờ order", "/quan-ly/gio-order", "cai_gio_order", True),
    ("THIẾT LẬP", "Phân quyền", "/quan-ly/phan-quyen", "phan_quyen", True),
    ("CÁ NHÂN", "Order ca của tôi", "/order", "order_ca", True),
    ("CÁ NHÂN", "Lịch của tôi", "/lich", "xem_lich_minh", True),
    ("CÁ NHÂN", "Thông báo", "/thong-bao", "xem_lich_minh", True),
]


def menu_for(user, current_path: str):
    groups: list[dict] = []
    for group, label, href, perm, ready in MANAGER_MENU:
        if not user.can(perm):
            continue
        if not groups or groups[-1]["name"] != group:
            groups.append({"name": group, "items": []})
        groups[-1]["items"].append(
            {"label": label, "href": href, "ready": ready, "active": current_path.startswith(href)}
        )
    return groups


def flash(request: Request, message: str, kind: str = "ok") -> None:
    request.session["flash"] = {"message": message, "kind": kind}


def render(request: Request, name: str, user=None, status_code: int = 200, **ctx):
    msg = request.session.pop("flash", None)
    unread = 0
    if user:
        notify.tick()
        con2 = connect()
        try:
            unread = notify.unread_count(con2, user.account_id)
        finally:
            con2.close()
    warn_total = 0
    if user and user.is_manager_view and not user.must_change and user.can("xep_lich"):
        con3 = connect()
        try:
            from . import schedule as _sc
            warn_total = _sc.warning_total(con3)
        except Exception:
            warn_total = 0
        finally:
            con3.close()
    ctx.update(
        warn_total=warn_total,
        unread=unread,
        request=request,
        user=user,
        flash=msg,
        menu=menu_for(user, request.url.path) if user and user.is_manager_view and not user.must_change else [],
    )
    return templates.TemplateResponse(request, name, ctx, status_code=status_code)
