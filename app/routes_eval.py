"""Đánh giá nhân viên (lấy từ bản offline 1.7.6): lần đánh giá, phiếu, form, voucher, in phiếu,
tổng hợp, lịch sử nhân viên, tiêu chí, xếp loại."""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, RedirectResponse

from .db import audit
from .legacy.constants import ROLES
from .legacy.database import DatabaseError
from .legacy.excel_io import (
    ExcelImportError,
    export_evaluation_round_package,
    export_evaluation_voucher_file,
    import_evaluation_form_rows,
    import_voucher_export_file,
)
from .offline import get_legacy
from .security import require_user
from .web import drop_upload, file_download, flash, get_db, render, save_upload

router = APIRouter(prefix="/quan-ly/danh-gia")

PERM = "danh_gia"
RATINGS = ["Xuất sắc", "Tốt", "Khá", "Trung bình", "Yếu"]
STATUS_EMPLOYEE = ["CHƯA ĐÁNH GIÁ", "ĐÃ ĐÁNH GIÁ", "TRÙNG PHẢN HỒI"]
SOURCES = ["TỪ FORM", "ĐÃ CHỈNH TAY"]
RATING_COLORS = {
    "Xuất sắc": ("#DCFCE7", "#166534"),
    "Tốt": ("#DBEAFE", "#1E40AF"),
    "Khá": ("#E0F2FE", "#075985"),
    "Trung bình": ("#FEF3C7", "#92400E"),
    "Yếu": ("#FFE4E6", "#9F1239"),
}
PRINT_EVALUATOR = "BQL Hệ thống Milano & LELA CAFE"
CLOSED = "ĐÃ CHỐT"
OPEN = "ĐANG THỰC HIỆN"


def _go(url: str) -> RedirectResponse:
    return RedirectResponse(url, status_code=303)


def _safe(label: str) -> str:
    return str(label).replace("/", "-").replace("\\", "-")


def _ctx(**kw):
    return dict(RATINGS=RATINGS, ROLES=ROLES, STATUS_EMPLOYEE=STATUS_EMPLOYEE, SOURCES=SOURCES,
                RATING_COLORS=RATING_COLORS, **kw)


# ===========================================================================
# Trang chính: các lần đánh giá / tổng hợp / lịch sử NV / tiêu chí / xếp loại
# ===========================================================================
@router.get("")
def evaluation_home(
    request: Request,
    tab: str = "lan",
    trang_thai: str = "",
    q: str = "",
    nguoi: str = "",
    bo: str = "",
    xl: str = "",
    nguon: str = "",
    sap_xep: str = "date_desc",
    tu: str = "",
    den: str = "",
    nv: Optional[int] = None,
    con=Depends(get_db),
    db=Depends(get_legacy),
):
    user = require_user(request, con, perm=PERM)
    ctx = _ctx(tab=tab)
    if tab == "tong-hop":
        rows = db.evaluation_overall_rows(
            date_from=tu, date_to=den, search=q, role=bo, rating=xl, evaluator=nguoi, source=nguon,
            sort_mode=sap_xep if sap_xep in ("date_desc", "score_desc", "score_asc") else "date_desc",
        )
        scores = [int(r.get("total_points") or 0) for r in rows]
        ctx.update(rows=rows, f=dict(q=q, nguoi=nguoi, bo=bo, xl=xl, nguon=nguon, sap_xep=sap_xep, tu=tu, den=den),
                   avg=round(sum(scores) / len(scores), 1) if scores else 0,
                   voucher_sum=sum(int(r.get("voucher_count") or 0) for r in rows))
    elif tab == "lich-su":
        emps = db.list_employees()
        ctx.update(emps=emps, nv=nv)
        if nv:
            hist = db.evaluation_employee_history(nv)
            ctx.update(hist=hist, emp=db.get_employee(nv),
                       voucher_total=sum(int(h.get("voucher_count") or 0) for h in hist))
    elif tab == "tieu-chi":
        ctx.update(criteria={r: db.list_evaluation_criteria(r, active_only=False) for r in ROLES},
                   max_points={r: db.evaluation_max_points(r) for r in ROLES})
    elif tab == "xep-loai":
        ctx.update(th=db.get_evaluation_rating_thresholds())
    else:
        ctx["tab"] = "lan"
        rounds = db.list_evaluation_rounds()
        if trang_thai:
            rounds = [r for r in rounds if r["status"] == trang_thai]
        ctx.update(rounds=rounds, trang_thai=trang_thai, today=date.today().isoformat())
    return render(request, "danh_gia.html", user, **ctx)


@router.post("/tao")
def create_round(request: Request, ngay: str = Form(...), con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm=PERM)
    try:
        date.fromisoformat(ngay)
        rid = db.create_evaluation_round(ngay)
    except ValueError:
        flash(request, "Ngày không hợp lệ.", "error")
        return _go("/quan-ly/danh-gia")
    except DatabaseError as exc:
        flash(request, str(exc), "error")
        return _go("/quan-ly/danh-gia")
    audit(con, user.account_id, "tao_lan_danh_gia", ngay)
    flash(request, "Đã tạo lần đánh giá mới với toàn bộ nhân viên đang làm.")
    return _go(f"/quan-ly/danh-gia/{rid}")


@router.post("/{rid}/xoa")
def delete_round(rid: int, request: Request, xac_nhan: str = Form(""), con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm=PERM)
    if xac_nhan.strip().upper() != "XOA":
        flash(request, "Gõ XOA để xác nhận xóa lần đánh giá.", "error")
        return _go("/quan-ly/danh-gia")
    try:
        row = db.get_evaluation_round(rid)
        db.delete_evaluation_round(rid)
    except DatabaseError as exc:
        flash(request, str(exc), "error")
        return _go("/quan-ly/danh-gia")
    audit(con, user.account_id, "xoa_lan_danh_gia", row["label"] if row else str(rid))
    flash(request, "Đã xóa lần đánh giá.")
    return _go("/quan-ly/danh-gia")


# ---------------- Tiêu chí ----------------
@router.post("/tieu-chi/them")
def add_criterion(request: Request, bo: str = Form(...), ten: str = Form(...), diem: int = Form(5),
                  con=Depends(get_db), db=Depends(get_legacy)):
    require_user(request, con, perm=PERM)
    try:
        db.add_evaluation_criterion(bo, ten.strip(), int(diem))
        flash(request, "Đã thêm tiêu chí.")
    except (DatabaseError, ValueError) as exc:
        flash(request, str(exc), "error")
    return _go("/quan-ly/danh-gia?tab=tieu-chi")


@router.post("/tieu-chi/{cid}/sua")
def edit_criterion(cid: int, request: Request, ten: str = Form(...), diem: int = Form(5),
                   con=Depends(get_db), db=Depends(get_legacy)):
    require_user(request, con, perm=PERM)
    try:
        db.update_evaluation_criterion(cid, ten.strip(), int(diem))
        flash(request, "Đã lưu tiêu chí.")
    except (DatabaseError, ValueError) as exc:
        flash(request, str(exc), "error")
    return _go("/quan-ly/danh-gia?tab=tieu-chi")


@router.post("/tieu-chi/{cid}/trang-thai")
def toggle_criterion(cid: int, request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    require_user(request, con, perm=PERM)
    try:
        row = db.get_evaluation_criterion(cid)
        if row is None:
            raise DatabaseError("Không tìm thấy tiêu chí.")
        db.set_evaluation_criterion_status(cid, row["status"] != "Đang sử dụng")
        flash(request, "Đã đổi trạng thái tiêu chí.")
    except DatabaseError as exc:
        flash(request, str(exc), "error")
    return _go("/quan-ly/danh-gia?tab=tieu-chi")


@router.post("/tieu-chi/{cid}/di-chuyen")
def move_criterion(cid: int, request: Request, huong: int = Form(...), con=Depends(get_db), db=Depends(get_legacy)):
    require_user(request, con, perm=PERM)
    try:
        db.move_evaluation_criterion(cid, -1 if int(huong) < 0 else 1)
    except DatabaseError as exc:
        flash(request, str(exc), "error")
    return _go(f"/quan-ly/danh-gia?tab=tieu-chi#tc-{cid}")


# ---------------- Xếp loại ----------------
@router.post("/xep-loai")
async def save_thresholds(request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    require_user(request, con, perm=PERM)
    form = await request.form()
    try:
        th = {name: int(str(form.get(name, "0")).strip() or 0) for name in RATINGS}
        th["Yếu"] = 0
        db.save_evaluation_rating_thresholds(th)
        flash(request, "Đã lưu cài đặt xếp loại. Áp dụng cho các lần đánh giá chưa chốt.")
    except (DatabaseError, ValueError) as exc:
        flash(request, str(exc), "error")
    return _go("/quan-ly/danh-gia?tab=xep-loai")


# ===========================================================================
# Chi tiết một lần đánh giá
# ===========================================================================
def _round_or_404(db, rid):
    row = db.get_evaluation_round(rid)
    if row is None:
        raise DatabaseError("Không tìm thấy lần đánh giá.")
    return row


@router.get("/{rid}")
def round_detail(
    rid: int,
    request: Request,
    tab: str = "nhan-vien",
    q: str = "",
    bo: str = "",
    tt: str = "",
    xl: str = "",
    nguon: str = "",
    chua_chon: int = 0,
    con=Depends(get_db),
    db=Depends(get_legacy),
):
    user = require_user(request, con, perm=PERM)
    row = db.get_evaluation_round(rid)
    if row is None:
        flash(request, "Không tìm thấy lần đánh giá.", "error")
        return _go("/quan-ly/danh-gia")
    summary = db.evaluation_round_summary(rid)
    vstats = db.evaluation_round_voucher_stats(rid)
    emps = db.list_evaluation_round_employees(rid, search=q, role=bo, status=tt, rating=xl, source=nguon)
    if chua_chon:
        emps = [e for e in emps if not str(e.get("role") or "").strip()]
    vouchers = db.list_evaluation_round_vouchers(rid)
    for e in emps:
        e["voucher_codes"] = ", ".join(
            str(v.get("voucher_code") or "").strip() for v in vouchers.get(int(e["id"]), []) if v.get("voucher_code")
        )
    request.session[f"dg_ids_{rid}"] = [int(e["id"]) for e in emps]
    return render(
        request, "danh_gia_lan.html", user,
        **_ctx(r=row, closed=row["status"] == CLOSED, summary=summary, vstats=vstats, emps=emps, tab=tab,
               f=dict(q=q, bo=bo, tt=tt, xl=xl, nguon=nguon, chua_chon=chua_chon),
               unassigned=db.evaluation_round_unassigned_count(rid),
               import_result=request.session.pop(f"dg_import_{rid}", None)),
    )


@router.post("/{rid}/bo-tieu-chi")
async def set_role(rid: int, request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    require_user(request, con, perm=PERM)
    data = await request.json()
    try:
        re_id = int(data.get("id"))
        row = db.get_evaluation_round_employee(re_id)
        if row is None or int(row["round_id"]) != rid:
            raise DatabaseError("Không tìm thấy nhân viên trong lần đánh giá.")
        db.set_evaluation_round_employee_role(re_id, str(data.get("role") or "") or None)
    except (DatabaseError, TypeError, ValueError) as exc:
        return JSONResponse({"ok": False, "message": str(exc)}, status_code=400)
    return {"ok": True, "unassigned": db.evaluation_round_unassigned_count(rid)}


@router.post("/{rid}/sao-chep")
def copy_previous(rid: int, request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    require_user(request, con, perm=PERM)
    try:
        n = db.copy_evaluation_roles_from_previous(rid)
        flash(request, f"Đã sao chép bộ tiêu chí cho {n} nhân viên.")
    except DatabaseError as exc:
        flash(request, str(exc), "error")
    return _go(f"/quan-ly/danh-gia/{rid}")


@router.get("/{rid}/xuat-form")
def export_form(rid: int, request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    require_user(request, con, perm=PERM)
    try:
        row = _round_or_404(db, rid)
        missing = db.evaluation_round_unassigned_count(rid)
        if missing:
            raise DatabaseError(f"Còn {missing} nhân viên chưa chọn PHA CHẾ / CHẠY BÀN.")
        criteria = db.prepare_evaluation_round_criteria(rid, refresh=True)
        employees = db.list_evaluation_round_employees(rid)
        return file_download(
            lambda p: export_evaluation_round_package(p, row, employees, criteria),
            f"DU_LIEU_TAO_FORM_DANH_GIA_{_safe(row['label'])}.xlsx",
        )
    except DatabaseError as exc:
        flash(request, str(exc), "error")
        return _go(f"/quan-ly/danh-gia/{rid}")


@router.post("/{rid}/nhap-form")
async def import_form(rid: int, request: Request, file: UploadFile = File(...), con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm=PERM)
    path = None
    try:
        row = _round_or_404(db, rid)
        if row["status"] == CLOSED:
            raise DatabaseError("Lần đánh giá đã chốt. Hãy mở lại trước khi nhập Form.")
        path = await save_upload(file, (".xlsx",))
        submissions = import_evaluation_form_rows(path)
        result = db.import_evaluation_form_submissions(rid, path.name, submissions)
    except (ExcelImportError, DatabaseError, ValueError) as exc:
        flash(request, f"Không thể nhập dữ liệu Form: {exc}", "error")
        return _go(f"/quan-ly/danh-gia/{rid}?tab=nhap-form")
    finally:
        drop_upload(path)
    errors = [str(e) for e in (result.get("errors") or [])]
    request.session[f"dg_import_{rid}"] = {
        "imported": result.get("imported", 0), "pending": result.get("pending", 0),
        "duplicate": result.get("duplicate", 0), "error_count": result.get("error_count", 0),
        "errors": errors[:30], "more": max(0, len(errors) - 30),
    }
    audit(con, user.account_id, "nhap_form_danh_gia", f"round={rid}")
    flash(request, f"Đã xử lý file Form: nhập {result.get('imported', 0)} phiếu.")
    return _go(f"/quan-ly/danh-gia/{rid}?tab=nhap-form")


@router.post("/{rid}/chot")
def toggle_close(rid: int, request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm=PERM)
    try:
        row = _round_or_404(db, rid)
        if row["status"] == CLOSED:
            db.set_evaluation_round_status(rid, OPEN)
            flash(request, "Đã mở lại lần đánh giá. Phiếu được phép sửa cho đến khi chốt lại.")
            audit(con, user.account_id, "mo_lai_danh_gia", row["label"])
        else:
            db.set_evaluation_round_status(rid, CLOSED)
            flash(request, "Đã chốt lần đánh giá. Phiếu bị khóa; giờ có thể nhập Voucher và in phiếu.")
            audit(con, user.account_id, "chot_danh_gia", row["label"])
    except DatabaseError as exc:
        flash(request, str(exc), "error")
    return _go(f"/quan-ly/danh-gia/{rid}")


@router.get("/{rid}/xuat-voucher")
def export_vouchers(rid: int, request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    require_user(request, con, perm=PERM)
    try:
        row = _round_or_404(db, rid)
        employees = db.list_evaluation_round_employees(rid, status="ĐÃ ĐÁNH GIÁ")
        if not employees:
            raise DatabaseError("Lần đánh giá này chưa có nhân viên nào ở trạng thái ĐÃ ĐÁNH GIÁ.")
        return file_download(
            lambda p: export_evaluation_voucher_file(p, row, employees),
            f"DANH_SACH_VOUCHER_{_safe(row['label'])}.xlsx",
        )
    except DatabaseError as exc:
        flash(request, str(exc), "error")
        return _go(f"/quan-ly/danh-gia/{rid}")


@router.post("/{rid}/nhap-voucher")
async def import_vouchers(rid: int, request: Request, file: UploadFile = File(...), con=Depends(get_db),
                          db=Depends(get_legacy)):
    user = require_user(request, con, perm=PERM)
    path = None
    try:
        row = _round_or_404(db, rid)
        if row["status"] != CLOSED:
            raise DatabaseError("Hãy CHỐT lần đánh giá trước khi nhập file Voucher.")
        stats = db.evaluation_round_voucher_stats(rid)
        required = int(stats.get("required", 0))
        if required <= 0:
            raise DatabaseError("Tổng SỐ LƯỢNG VOUCHER của nhân viên ĐÃ ĐÁNH GIÁ đang bằng 0.")
        path = await save_upload(file, (".xlsx", ".xlsm"))
        vouchers = import_voucher_export_file(path)
        if len(vouchers) < required:
            raise DatabaseError(f"Không đủ Voucher: cần {required}, file chỉ có {len(vouchers)}. Không phân Voucher.")
        result = db.assign_evaluation_vouchers(rid, vouchers, path.name)
    except (ExcelImportError, DatabaseError, ValueError, OSError) as exc:
        flash(request, f"Không thể phân Voucher: {exc}", "error")
        return _go(f"/quan-ly/danh-gia/{rid}")
    finally:
        drop_upload(path)
    skipped = int(result.get("skipped_used", 0))
    audit(con, user.account_id, "phan_voucher", f"round={rid}")
    flash(
        request,
        f"Đã phân Voucher: cần {result['required']}, file có {result['file_total']}, đã phân {result['assigned']},"
        f" còn chưa dùng {result['remaining']}" + (f", bỏ qua {skipped} mã đã dùng ở lần khác." if skipped else "."),
    )
    return _go(f"/quan-ly/danh-gia/{rid}")


@router.get("/{rid}/in")
def print_all(rid: int, request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm=PERM)
    try:
        row = _round_or_404(db, rid)
        if row["status"] != CLOSED:
            raise DatabaseError("Hãy bấm CHỐT trước khi in phiếu.")
        employees = db.list_evaluation_round_employees(rid, status="ĐÃ ĐÁNH GIÁ")
        if not employees:
            raise DatabaseError("Lần đánh giá này chưa có nhân viên nào ở trạng thái ĐÃ ĐÁNH GIÁ.")
        stats = db.evaluation_round_voucher_stats(rid)
        if int(stats.get("required", 0)) > int(stats.get("allocated", 0)):
            raise DatabaseError(
                f"Chưa phân đủ mã Voucher (cần {stats.get('required', 0)}, đã phân {stats.get('allocated', 0)})."
                " Hãy nhập file Voucher trước khi in."
            )
    except DatabaseError as exc:
        flash(request, str(exc), "error")
        return _go(f"/quan-ly/danh-gia/{rid}")
    criteria = {role: db.list_evaluation_round_criteria(rid, role) for role in ROLES}
    vouchers = db.list_evaluation_round_vouchers(rid)
    cards = []
    for e in employees:
        scores = db.get_evaluation_round_scores(int(e["id"]))
        crit = criteria.get(str(e.get("role") or ""), [])
        vs = vouchers.get(int(e["id"]), [])
        programs = {str(v.get("program_name") or "").strip() for v in vs if v.get("program_name")}
        starts = {str(v.get("start_at") or "")[:10] for v in vs if v.get("start_at")}
        ends = {str(v.get("end_at") or "")[:10] for v in vs if v.get("end_at")}
        cards.append({
            "e": e,
            "rows": [{"label": c["label"], "max": int(c["max_score"]), "score": int(scores.get(int(c["id"]), 0))} for c in crit],
            "max_points": sum(int(c["max_score"]) for c in crit),
            "vouchers": [str(v.get("voucher_code") or "") for v in vs],
            "program": next(iter(programs)) if len(programs) == 1 else ("Nhiều chương trình" if programs else "—"),
            "validity": (f"{_dmy(next(iter(starts)))} - {_dmy(next(iter(ends)))}" if len(starts) == 1 and len(ends) == 1
                         else ("theo từng mã Voucher" if vs else "—")),
        })
    pairs = [cards[i:i + 2] for i in range(0, len(cards), 2)]
    return render(request, "danh_gia_in.html", user, r=row, pairs=pairs, evaluator=PRINT_EVALUATOR, n=len(cards))


def _dmy(iso: str) -> str:
    try:
        return date.fromisoformat(iso[:10]).strftime("%d/%m/%Y")
    except ValueError:
        return iso or "—"


# ===========================================================================
# Phiếu đánh giá của một nhân viên
# ===========================================================================
@router.get("/phieu/{re_id}")
def slip(re_id: int, request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm=PERM)
    row = db.get_evaluation_round_employee(re_id)
    if row is None:
        flash(request, "Không tìm thấy phiếu đánh giá.", "error")
        return _go("/quan-ly/danh-gia")
    rid = int(row["round_id"])
    r = db.get_evaluation_round(rid)
    role = str(row["role"] or "")
    if role not in ROLES:
        flash(request, "Nhân viên chưa được chọn bộ tiêu chí (Pha chế / Chạy bàn).", "error")
        return _go(f"/quan-ly/danh-gia/{rid}")
    criteria = db.list_evaluation_round_criteria(rid, role)
    if not criteria:
        db.prepare_evaluation_round_criteria(rid, refresh=False)
        criteria = db.list_evaluation_round_criteria(rid, role)
    saved = db.get_evaluation_round_scores(re_id)
    ids = request.session.get(f"dg_ids_{rid}") or []
    nxt = ids[ids.index(re_id) + 1] if re_id in ids and ids.index(re_id) + 1 < len(ids) else None
    th = r["rating_thresholds_json"] if r else None
    return render(
        request, "danh_gia_phieu.html", user,
        **_ctx(row=row, r=r, closed=bool(r and r["status"] == CLOSED), criteria=criteria, saved=saved, nxt=nxt,
               thresholds=_thresholds(db, rid), th_json=th),
    )


def _thresholds(db, rid):
    import json

    r = db.get_evaluation_round(rid)
    try:
        data = json.loads(r["rating_thresholds_json"]) if r and r["rating_thresholds_json"] else None
    except (TypeError, ValueError):
        data = None
    data = data or db.get_evaluation_rating_thresholds()
    return sorted(((int(v), k) for k, v in data.items()), reverse=True)


@router.post("/phieu/{re_id}")
async def save_slip(re_id: int, request: Request, con=Depends(get_db), db=Depends(get_legacy)):
    user = require_user(request, con, perm=PERM)
    form = await request.form()
    row = db.get_evaluation_round_employee(re_id)
    if row is None:
        flash(request, "Không tìm thấy phiếu đánh giá.", "error")
        return _go("/quan-ly/danh-gia")
    rid = int(row["round_id"])
    r = db.get_evaluation_round(rid)
    if r and r["status"] == CLOSED:
        flash(request, "Lần đánh giá đã CHỐT. Hãy mở lại trước khi chỉnh sửa.", "error")
        return _go(f"/quan-ly/danh-gia/phieu/{re_id}")
    criteria = db.list_evaluation_round_criteria(rid, str(row["role"] or ""))
    try:
        scores = {}
        for c in criteria:
            v = int(str(form.get(f"s{c['id']}", "0")).strip() or 0)
            if v < 0 or v > int(c["max_score"]):
                raise ValueError(f"Điểm tiêu chí “{c['label']}” phải từ 0 đến {c['max_score']}.")
            scores[int(c["id"])] = v
        voucher = int(str(form.get("voucher", "0")).strip() or 0)
        db.save_evaluation_round_employee(
            re_id, str(form.get("nguoi", "")).strip(), str(form.get("nhan_xet", "")).strip(), voucher, scores, manual=True,
        )
    except (DatabaseError, ValueError) as exc:
        flash(request, f"Không thể lưu phiếu: {exc}", "error")
        return _go(f"/quan-ly/danh-gia/phieu/{re_id}")
    audit(con, user.account_id, "luu_phieu_danh_gia", f"{row['employee_code']}@{rid}")
    nxt = form.get("next")
    if nxt:
        flash(request, f"Đã lưu phiếu của {row['employee_name']}.")
        return _go(f"/quan-ly/danh-gia/phieu/{int(nxt)}")
    flash(request, "Đã lưu phiếu đánh giá.")
    return _go(f"/quan-ly/danh-gia/phieu/{re_id}")
