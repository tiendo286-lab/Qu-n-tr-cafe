"""Các chức năng nhỏ của bản offline 1.7.6 bổ sung vào màn hình web có sẵn:
- Cơ sở / ca: xóa khi chưa phát sinh dữ liệu.
- Nhân viên: xóa (chưa phát sinh dữ liệu), nhập Excel, tải file mẫu, xuất danh sách cho Google Form.
- Order: nhập câu trả lời Google Form, xóa order tuần, khôi phục bản trước, tải file mẫu order.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse, RedirectResponse

from . import catalog as cat
from . import db as dbm
from . import order as od
from . import schedule as sc
from .db import audit
from .legacy.database import DatabaseError
from .legacy.excel_io import (
    ExcelImportError,
    create_order_template,
    export_employee_form_files,
    import_employee_rows,
    import_form_response_rows,
)
from .offline import get_legacy
from .security import require_user
from .web import drop_upload, file_download, flash, get_db, save_upload

router = APIRouter(prefix="/quan-ly")
TEMPLATES = Path(__file__).parent / "legacy" / "templates"


def _go(url):
    return RedirectResponse(url, status_code=303)


# ---------------------------------------------------------------------------
# Cơ sở / ca
# ---------------------------------------------------------------------------
@router.post("/chi-nhanh/{branch_id}/xoa")
def delete_branch(branch_id: int, request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm="sua_danh_muc")
    try:
        db.delete_branch(branch_id)
        audit(con, user.account_id, "xoa_co_so", str(branch_id))
        flash(request, "Đã xóa cơ sở.")
    except DatabaseError as exc:
        flash(request, str(exc), "error")
    return _go("/quan-ly/chi-nhanh")


@router.post("/ca/{shift_id}/xoa")
def delete_shift(shift_id: int, request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm="sua_danh_muc")
    try:
        db.delete_shift(shift_id)
        audit(con, user.account_id, "xoa_ca", str(shift_id))
        flash(request, "Đã xóa ca.")
    except DatabaseError as exc:
        flash(request, str(exc), "error")
    return _go("/quan-ly/chi-nhanh")


# ---------------------------------------------------------------------------
# Nhân viên
# ---------------------------------------------------------------------------
@router.post("/nhan-vien/{employee_id}/xoa")
def delete_employee(employee_id: int, request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm="quan_ly_nhan_vien")
    acc = con.execute("SELECT id, system_role FROM accounts WHERE employee_id = ?", (employee_id,)).fetchone()
    if acc and acc["id"] == user.account_id:
        flash(request, "Không xóa được chính bạn.", "error")
        return _go("/quan-ly/nhan-vien")
    if acc and acc["system_role"] in ("chu", "ql_tong") and not user.is_owner:
        flash(request, "Chỉ Chủ được xóa Quản lý tổng.", "error")
        return _go("/quan-ly/nhan-vien")
    emp = db.get_employee(employee_id)
    if not emp:
        flash(request, "Không tìm thấy nhân viên.", "error")
        return _go("/quan-ly/nhan-vien")
    if db.employee_has_data(employee_id):
        flash(request, "Nhân viên đã phát sinh order, lịch cố định, lịch làm hoặc đánh giá. Hãy chuyển sang Ngừng làm.", "error")
        return _go(f"/quan-ly/nhan-vien/{employee_id}")
    db.delete_employee(employee_id)
    audit(con, user.account_id, "xoa_nhan_vien", f"{emp['code']} – {emp['name']}")
    flash(request, f"Đã xóa {emp['code']} – {emp['name']} (đã sao lưu trước khi xóa).")
    return _go("/quan-ly/nhan-vien")


@router.post("/nhan-vien/nhap-excel")
async def import_employees(request: Request, file: UploadFile = File(...), con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm="quan_ly_nhan_vien")
    path = None
    try:
        path = await save_upload(file, (".xlsx",))
        branches = db.list_branches()
        valid = ({str(b["code"]).upper() for b in branches} | {str(b["ui_code"]).upper() for b in branches}
                 | {str(b["internal_code"]).upper() for b in branches})
        rows = import_employee_rows(path, valid)
        added, updated = db.import_employees(rows)
    except (ExcelImportError, DatabaseError, ValueError) as exc:
        flash(request, f"Không thể nhập file: {exc}", "error")
        return _go("/quan-ly/nhan-vien")
    finally:
        drop_upload(path)
    con.execute("BEGIN")
    for r in con.execute("SELECT DISTINCT role FROM employee_roles").fetchall():
        con.execute("INSERT OR IGNORE INTO work_roles(name, sort_order) VALUES (?, 99)", (r[0],))
    dbm.ensure_accounts(con)
    con.execute("COMMIT")
    audit(con, user.account_id, "nhap_excel_nhan_vien", f"them={added} sua={updated}")
    flash(request, f"Nhập thành công: thêm {added} nhân viên, cập nhật {updated} nhân viên. Nhân viên mới đã có tài khoản (chưa có mật khẩu).")
    return _go("/quan-ly/nhan-vien")


@router.get("/nhan-vien/file-mau")
def employee_template(request: Request, con=Depends(get_db)):
    require_user(request, con, perm="quan_ly_nhan_vien")
    return FileResponse(TEMPLATES / "Mau_danh_sach_nhan_vien.xlsx", filename="Mau_danh_sach_nhan_vien.xlsx")


@router.get("/nhan-vien/xuat-google-form")
def employee_form_export(request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    require_user(request, con, perm="quan_ly_nhan_vien")
    rows = db.list_employees()
    return file_download(lambda p: export_employee_form_files(p, rows), "DANH_SACH_NHAN_VIEN_GOOGLE_FORM.xlsx")


# ---------------------------------------------------------------------------
# Order
# ---------------------------------------------------------------------------
def _resync_order(con, db, week_id) -> str:
    """Sau khi order thay đổi hàng loạt: cập nhật 'đã nộp order' của web và đưa order vào lịch đang xếp."""
    con.execute("BEGIN")
    con.execute(
        "DELETE FROM order_submissions WHERE week_id = ? AND employee_id NOT IN"
        " (SELECT employee_id FROM order_entries WHERE week_id = ? AND status IN (?, ?))",
        (week_id, week_id, od.OK, od.OFF),
    )
    con.execute(
        "INSERT OR IGNORE INTO order_submissions(week_id, employee_id, submitted_at, updated_at)"
        " SELECT DISTINCT week_id, employee_id, ?, ? FROM order_entries WHERE week_id = ? AND status IN (?, ?)",
        (dbm.now_str(), dbm.now_str(), week_id, od.OK, od.OFF),
    )
    con.execute("COMMIT")
    if sc.is_editable(con, week_id):
        try:
            db.reapply_order_to_schedule(week_id)
            sc.touch(con, week_id)
            return " Lịch đang xếp đã được cập nhật theo order mới (giữ nguyên các ca đã xếp)."
        except DatabaseError:
            pass
    return ""


def _order_week(con, week_id):
    week = od.week_by_id(con, week_id)
    back = f"/quan-ly/order?tuan={week['start_date']}" if week else "/quan-ly/order"
    return week, back


@router.post("/order/nhap-form/{week_id}")
async def import_form(week_id: int, request: Request, file: UploadFile = File(...), con=Depends(get_db),
                      db=Depends(get_legacy)):
    user = require_user(request, con, perm="sua_order_sau_han")
    week, back = _order_week(con, week_id)
    if not week:
        return _go(back)
    if sc.week_status(con, week_id) == sc.ST_CHOT:
        flash(request, "Lịch tuần đã chốt. Mở lại tuần trước khi nhập order.", "error")
        return _go(back)
    path = None
    try:
        path = await save_upload(file, (".xlsx", ".csv"))
        shifts = [s["name"] for s in od.order_shifts(con)]
        parsed = import_form_response_rows(path, shifts)
        res = db.import_form_order_responses(week_id, parsed, path.name)
    except (ExcelImportError, DatabaseError, ValueError, OSError) as exc:
        flash(request, f"Không thể nhập câu trả lời Form: {exc}", "error")
        return _go(back)
    finally:
        drop_upload(path)
    extra = _resync_order(con, db, week_id)
    audit(con, user.account_id, "nhap_form_order", f"week={week_id} imported={res['imported']}")
    msg = (f"Đã nhập câu trả lời Form: tổng {res['submission_count']} lượt, nhập tự động {res['imported']} nhân viên,"
           f" chưa gửi {len(res['no_response'])}, gửi trùng {len(res['duplicates'])}.")
    if res["duplicates"]:
        msg += " Gửi trùng (giữ Chưa order, cần kiểm tra tay): " + ", ".join(res["duplicates"][:15]) + "."
    if res.get("unknown"):
        msg += " Mã không có trong danh sách: " + ", ".join(res["unknown"][:15]) + "."
    flash(request, msg + extra, "ok" if not res["duplicates"] else "warn")
    return _go(back)


@router.post("/order/xoa-order/{week_id}")
def clear_order(week_id: int, request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm="sua_order_sau_han")
    week, back = _order_week(con, week_id)
    if not week:
        return _go(back)
    if sc.week_status(con, week_id) == sc.ST_CHOT:
        flash(request, "Lịch tuần đã chốt. Mở lại tuần trước.", "error")
        return _go(back)
    db.clear_order(week_id)
    extra = _resync_order(con, db, week_id)
    audit(con, user.account_id, "xoa_order_tuan", f"week={week_id}")
    flash(request, "Đã xóa toàn bộ order của tuần (đã lưu bản trước để khôi phục)." + extra)
    return _go(back)


@router.post("/order/khoi-phuc/{week_id}")
def restore_order(week_id: int, request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm="sua_order_sau_han")
    week, back = _order_week(con, week_id)
    if not week:
        return _go(back)
    if sc.week_status(con, week_id) == sc.ST_CHOT:
        flash(request, "Lịch tuần đã chốt. Mở lại tuần trước.", "error")
        return _go(back)
    if not db.restore_last_order(week_id):
        flash(request, "Chưa có bản order trước đó để khôi phục.", "error")
        return _go(back)
    extra = _resync_order(con, db, week_id)
    audit(con, user.account_id, "khoi_phuc_order", f"week={week_id}")
    flash(request, "Đã khôi phục bản order trước lần nhập/xóa gần nhất." + extra)
    return _go(back)


@router.get("/order/file-mau")
def order_template(request: Request, con=Depends(get_db)):
    require_user(request, con, perm="xem_tat_ca")
    shifts = [s["name"] for s in od.order_shifts(con)]
    return file_download(lambda p: create_order_template(p, shifts), "Mau_order_lich_lam.xlsx")
