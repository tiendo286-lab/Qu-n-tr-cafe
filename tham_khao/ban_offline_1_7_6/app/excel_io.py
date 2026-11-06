from __future__ import annotations

import csv
import re
import unicodedata
from pathlib import Path
from datetime import date, datetime
from typing import Any

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill

from .constants import BRANCHES, EMPLOYEE_STATUSES, ORDER_STATUSES, RANKS, ROLES, SHIFTS, WEEKDAY_NAMES


class ExcelImportError(ValueError):
    pass


FORM_EMPLOYEE_EXPORT_HEADERS = [
    "Mã NV",
    "Họ và tên",
]


EVALUATION_EMPLOYEE_EXPORT_HEADERS = [
    "MÃ NV",
    "HỌ VÀ TÊN",
    "PHA CHẾ",
    "CHẠY BÀN",
]


def export_evaluation_form_package(target_path: Path, employee_rows, criteria_rows) -> Path:
    """Xuất 1 file Excel gồm nhân viên + tiêu chí để Google Sheet tạo Form động."""
    target_path = Path(target_path)
    if target_path.suffix.lower() != ".xlsx":
        target_path = target_path.with_suffix(".xlsx")
    target_path.parent.mkdir(parents=True, exist_ok=True)

    employees: list[list[str]] = []
    for row in employee_rows:
        if str(row["status"] or "").strip() != "Đang làm":
            continue
        code = str(row["code"] or "").strip()
        name = str(row["name"] or "").strip()
        roles = {item.strip() for item in str(row["roles"] or "").split(",") if item.strip()}
        if not code or not name:
            continue
        employees.append([
            code,
            name,
            "CÓ" if "Pha chế" in roles else "",
            "CÓ" if "Chạy bàn" in roles else "",
        ])
    if not employees:
        raise ValueError("Không có nhân viên đang làm để xuất đánh giá.")

    criteria_by_role: dict[str, list] = {"Pha chế": [], "Chạy bàn": []}
    for row in criteria_rows:
        role = str(row["role"] or "").strip()
        if role in criteria_by_role:
            criteria_by_role[role].append(row)

    workbook = Workbook()
    employee_sheet = workbook.active
    employee_sheet.title = "NHAN_VIEN"
    employee_sheet.append(EVALUATION_EMPLOYEE_EXPORT_HEADERS)
    for row in employees:
        employee_sheet.append(row)

    criteria_headers = ["STT", "MÃ TIÊU CHÍ", "TÊN TIÊU CHÍ", "ĐIỂM TỐI ĐA", "TRẠNG THÁI"]
    role_sheets = {"Pha chế": "TIEU_CHI_PHA_CHE", "Chạy bàn": "TIEU_CHI_CHAY_BAN"}
    sheets = [employee_sheet]
    for role, sheet_name in role_sheets.items():
        sheet = workbook.create_sheet(sheet_name)
        sheets.append(sheet)
        sheet.append(criteria_headers)
        rows = sorted(criteria_by_role[role], key=lambda item: (int(item["sort_order"]), int(item["id"])))
        for index, row in enumerate(rows, start=1):
            sheet.append([
                index,
                str(row["code"] or ""),
                str(row["label"] or ""),
                int(row["max_score"]),
                str(row["status"] or ""),
            ])

    header_fill = PatternFill("solid", fgColor="7C3AED")
    header_font = Font(color="FFFFFF", bold=True)
    for sheet in sheets:
        for cell in sheet[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        sheet.freeze_panes = "A2"
        sheet.row_dimensions[1].height = 34

    employee_sheet.auto_filter.ref = f"A1:D{max(employee_sheet.max_row, 1)}"
    employee_sheet.column_dimensions["A"].width = 16
    employee_sheet.column_dimensions["B"].width = 36
    employee_sheet.column_dimensions["C"].width = 16
    employee_sheet.column_dimensions["D"].width = 16
    for row in employee_sheet.iter_rows(min_row=2, max_col=4):
        row[0].number_format = "@"
        for cell in row:
            cell.alignment = Alignment(horizontal="center" if cell.column >= 3 else "left", vertical="center", wrap_text=True)

    for sheet in sheets[1:]:
        sheet.auto_filter.ref = f"A1:E{max(sheet.max_row, 1)}"
        sheet.column_dimensions["A"].width = 8
        sheet.column_dimensions["B"].width = 16
        sheet.column_dimensions["C"].width = 58
        sheet.column_dimensions["D"].width = 16
        sheet.column_dimensions["E"].width = 18
        for row in sheet.iter_rows(min_row=2, max_col=5):
            row[1].number_format = "@"
            for cell in row:
                cell.alignment = Alignment(
                    horizontal="left" if cell.column == 3 else "center",
                    vertical="center",
                    wrap_text=True,
                )

    workbook.save(target_path)
    return target_path


def export_evaluation_employee_file(target_path: Path, rows) -> Path:
    """Tương thích với bản cũ: chỉ xuất danh sách nhân viên đánh giá."""
    target_path = Path(target_path)
    if target_path.suffix.lower() != ".xlsx":
        target_path = target_path.with_suffix(".xlsx")
    target_path.parent.mkdir(parents=True, exist_ok=True)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "DANH_SACH_NV_DANH_GIA"
    sheet.append(EVALUATION_EMPLOYEE_EXPORT_HEADERS)
    count = 0
    for row in rows:
        if str(row["status"] or "").strip() != "Đang làm":
            continue
        code = str(row["code"] or "").strip()
        name = str(row["name"] or "").strip()
        roles = {item.strip() for item in str(row["roles"] or "").split(",") if item.strip()}
        if not code or not name:
            continue
        sheet.append([code, name, "CÓ" if "Pha chế" in roles else "", "CÓ" if "Chạy bàn" in roles else ""])
        count += 1
    if not count:
        raise ValueError("Không có nhân viên đang làm để xuất đánh giá.")
    for cell in sheet[1]:
        cell.fill = PatternFill("solid", fgColor="7C3AED")
        cell.font = Font(color="FFFFFF", bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    sheet.freeze_panes = "A2"
    for row in sheet.iter_rows(min_row=2, max_col=4):
        row[0].number_format = "@"
    workbook.save(target_path)
    return target_path


def _employee_form_export_rows(rows) -> list[list[str]]:
    """Chỉ xuất nhân viên ĐANG LÀM và đúng 2 cột dùng để tạo Form."""
    result: list[list[str]] = []
    for row in rows:
        if str(row["status"] or "").strip() != "Đang làm":
            continue
        code = str(row["code"] or "").strip()
        name = str(row["name"] or "").strip()
        if not code or not name:
            continue
        result.append([code, name])
    return result


def export_employee_form_files(target_path: Path, rows) -> Path:
    """Xuất đúng 1 file XLSX gồm nhân viên ĐANG LÀM và 2 cột dùng cho Form."""
    target_path = Path(target_path)
    if target_path.suffix.lower() != ".xlsx":
        target_path = target_path.with_suffix(".xlsx")
    target_path.parent.mkdir(parents=True, exist_ok=True)

    data_rows = _employee_form_export_rows(rows)
    if not data_rows:
        raise ValueError("Danh sách nhân viên đang trống.")

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "DANH SÁCH NHÂN VIÊN"
    sheet.append(FORM_EMPLOYEE_EXPORT_HEADERS)
    for row in data_rows:
        sheet.append(row)

    header_fill = PatternFill("solid", fgColor="1F4E78")
    header_font = Font(color="FFFFFF", bold=True)
    for cell in sheet[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = f"A1:B{max(sheet.max_row, 1)}"
    sheet.row_dimensions[1].height = 34
    sheet.column_dimensions["A"].width = 16
    sheet.column_dimensions["B"].width = 36
    for row in sheet.iter_rows(min_row=2, max_col=2):
        row[0].number_format = "@"  # Giữ Mã NV dạng text, kể cả 001/002...
        for cell in row:
            cell.alignment = Alignment(vertical="center", wrap_text=True)

    workbook.save(target_path)
    return target_path


def normalize_text(value: Any) -> str:
    text = "" if value is None else str(value)
    text = " ".join(text.strip().split())
    return text


def normalize_key(value: Any) -> str:
    text = normalize_text(value).upper()
    text = text.replace("Đ", "D").replace("đ", "d")
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    return " ".join(text.split())


def _first_sheet(path: Path):
    try:
        workbook = load_workbook(path, data_only=True, read_only=True)
    except Exception as exc:
        raise ExcelImportError(f"Không mở được file Excel: {exc}") from exc
    if not workbook.sheetnames:
        raise ExcelImportError("File Excel không có sheet dữ liệu.")
    return workbook, workbook[workbook.sheetnames[0]]


def import_employee_rows(path: Path, valid_branch_codes: set[str] | None = None) -> list[dict[str, Any]]:
    workbook, sheet = _first_sheet(path)
    try:
        rows = list(sheet.iter_rows(values_only=True))
    finally:
        workbook.close()
    if not rows:
        raise ExcelImportError("File không có dữ liệu.")

    header = [normalize_key(cell) for cell in rows[0]]
    aliases = {
        "code": {"MA NV", "MA NHAN VIEN", "MANV"},
        "name": {"TEN NHAN VIEN", "TEN NV", "HO VA TEN"},
        "rank": {"PHAN CAP", "CAP BAC"},
        "status": {"TRANG THAI"},
        "branches": {"CO SO LAM VIEC", "CO SO"},
        "roles": {"VI TRI DAM NHIEM", "VI TRI", "BO PHAN"},
    }
    indexes: dict[str, int] = {}
    for key, candidates in aliases.items():
        for index, value in enumerate(header):
            if value in candidates:
                indexes[key] = index
                break
        if key not in indexes:
            raise ExcelImportError(f"Thiếu cột bắt buộc: {next(iter(candidates))}")

    if valid_branch_codes is None:
        valid_branch_codes = {value for system, display, _name in BRANCHES for value in (system, display)}
    valid_branch_codes = {str(item).strip().upper() for item in valid_branch_codes}
    result: list[dict[str, Any]] = []
    errors: list[str] = []
    for row_number, row in enumerate(rows[1:], start=2):
        code = normalize_text(row[indexes["code"]] if indexes["code"] < len(row) else "")
        name = normalize_text(row[indexes["name"]] if indexes["name"] < len(row) else "")
        if not code and not name:
            continue
        rank = normalize_text(row[indexes["rank"]] if indexes["rank"] < len(row) else "")
        status = normalize_text(row[indexes["status"]] if indexes["status"] < len(row) else "")
        branches_raw = normalize_text(row[indexes["branches"]] if indexes["branches"] < len(row) else "")
        branches = [item.strip().upper() for item in re.split(r"[,;/|]+", branches_raw) if item.strip()]
        branches = ["LL" if item == "LELA" else item for item in branches]
        roles_raw = normalize_text(row[indexes["roles"]] if indexes["roles"] < len(row) else "")
        roles: list[str] = []
        for item in re.split(r"[,;/|]+", roles_raw):
            key = normalize_key(item)
            if not key:
                continue
            if key == "PHA CHE":
                role_name = "Pha chế"
            elif key == "CHAY BAN":
                role_name = "Chạy bàn"
            else:
                role_name = normalize_text(item)
            if role_name not in roles:
                roles.append(role_name)

        row_errors: list[str] = []
        if not code:
            row_errors.append("thiếu Mã NV")
        if not name:
            row_errors.append("thiếu Tên nhân viên")
        if rank not in RANKS:
            row_errors.append(f"Phân cấp không hợp lệ: {rank or '(trống)'}")
        if status not in EMPLOYEE_STATUSES:
            row_errors.append(f"Trạng thái không hợp lệ: {status or '(trống)'}")
        invalid_branches = [item for item in branches if item not in valid_branch_codes]
        if invalid_branches:
            row_errors.append("Cơ sở không hợp lệ: " + ", ".join(invalid_branches))
        if not branches:
            row_errors.append("chưa chọn cơ sở")
        invalid_roles = [item for item in roles if item not in ROLES]
        if invalid_roles:
            row_errors.append("Vị trí không hợp lệ: " + ", ".join(invalid_roles))
        if not roles:
            row_errors.append("chưa chọn vị trí")
        if row_errors:
            errors.append(f"Dòng {row_number}: " + "; ".join(row_errors))
            continue
        result.append(
            {
                "code": code,
                "name": name,
                "rank": rank,
                "status": status,
                "branches": branches,
                "roles": roles,
            }
        )
    if errors:
        preview = "\n".join(errors[:10])
        extra = f"\n... và {len(errors) - 10} lỗi khác" if len(errors) > 10 else ""
        raise ExcelImportError("File nhân viên có dữ liệu chưa đúng:\n" + preview + extra)
    if not result:
        raise ExcelImportError("Không tìm thấy dòng nhân viên hợp lệ.")
    return result


def _order_header_target(day_index: int, shift: str) -> set[str]:
    day = WEEKDAY_NAMES[day_index]
    day_key = normalize_key(day)
    shift_key = normalize_key(shift)
    aliases = {
        f"{day_key} CA {shift_key}",
        f"{day_key} {shift_key}",
    }
    if day_index < 6:
        number = day_index + 2
        aliases.update({f"T{number} CA {shift_key}", f"T{number} {shift_key}"})
    else:
        aliases.update({f"CN CA {shift_key}", f"CN {shift_key}", f"CHU NHAT CA {shift_key}"})
    return aliases


def _find_order_header_index(header: list[str], day_index: int, shift: str) -> int | None:
    """Tìm cột ca, chấp nhận cả tiêu đề Form có chèn ngày, ví dụ:
    THỨ 2 — 07/09/2026 [CA SÁNG].
    """
    aliases = _order_header_target(day_index, shift)
    exact = next((i for i, value in enumerate(header) if value in aliases), None)
    if exact is not None:
        return exact

    shift_key = normalize_key(shift)
    day_long = normalize_key(WEEKDAY_NAMES[day_index])
    day_short = f"T{day_index + 2}" if day_index < 6 else "CN"
    for index, value in enumerate(header):
        padded = f" {value} "
        day_match = day_long in value or f" {day_short} " in padded
        shift_match = f" CA {shift_key} " in padded or value.endswith(f" CA {shift_key}")
        if day_match and shift_match:
            return index
    return None


def _normalize_order_status(value: Any) -> str:
    key = normalize_key(value)
    if key in {"DI LAM DUOC", "CO THE DI LAM", "DI LAM"}:
        return "ĐI LÀM ĐƯỢC"
    if key in {"NGHI", "OFF", "KHONG DI LAM DUOC", "KHONG THE DI LAM"}:
        return "NGHỈ"
    raise ExcelImportError(f"Giá trị ca không hợp lệ: {normalize_text(value) or '(trống)'}")


def import_order_rows(path: Path, shifts: list[str] | None = None) -> list[dict[str, Any]]:
    workbook, sheet = _first_sheet(path)
    try:
        rows = list(sheet.iter_rows(values_only=True))
    finally:
        workbook.close()
    if not rows:
        raise ExcelImportError("File Order không có dữ liệu.")

    header = [normalize_key(cell) for cell in rows[0]]
    code_candidates = {"MA NV", "MA NHAN VIEN", "MANV"}
    name_candidates = {"TEN NHAN VIEN", "TEN NV", "HO VA TEN"}
    code_index = next((i for i, value in enumerate(header) if value in code_candidates), None)
    name_index = next((i for i, value in enumerate(header) if value in name_candidates), None)
    if code_index is None or name_index is None:
        raise ExcelImportError("File Order phải có cột Mã NV và Tên nhân viên.")

    shifts = [str(item).strip() for item in (shifts or SHIFTS) if str(item).strip()]
    if not shifts:
        raise ExcelImportError("Hiện chưa có ca làm việc nào đang sử dụng.")

    status_indexes: dict[tuple[int, str], int] = {}
    for weekday in range(7):
        for shift in shifts:
            found = _find_order_header_index(header, weekday, shift)
            if found is None:
                raise ExcelImportError(f"Thiếu cột: {WEEKDAY_NAMES[weekday]} – Ca {shift}")
            status_indexes[(weekday, shift)] = found

    result: list[dict[str, Any]] = []
    errors: list[str] = []
    seen_codes: set[str] = set()
    for row_number, row in enumerate(rows[1:], start=2):
        code = normalize_text(row[code_index] if code_index < len(row) else "")
        name = normalize_text(row[name_index] if name_index < len(row) else "")
        if not code and not name:
            continue
        if not code:
            errors.append(f"Dòng {row_number}: thiếu Mã NV")
            continue
        if code.casefold() in seen_codes:
            errors.append(f"Dòng {row_number}: Mã NV {code} bị lặp trong file")
            continue
        seen_codes.add(code.casefold())
        statuses: dict[tuple[int, str], str] = {}
        row_error = None
        for key, index in status_indexes.items():
            try:
                statuses[key] = _normalize_order_status(row[index] if index < len(row) else None)
            except ExcelImportError as exc:
                weekday, shift = key
                row_error = f"Dòng {row_number}, {WEEKDAY_NAMES[weekday]} ca {shift}: {exc}"
                break
        if row_error:
            errors.append(row_error)
            continue
        result.append({"code": code, "name": name, "statuses": statuses})

    if errors:
        preview = "\n".join(errors[:10])
        extra = f"\n... và {len(errors) - 10} lỗi khác" if len(errors) > 10 else ""
        raise ExcelImportError("File Order chưa đúng cấu trúc:\n" + preview + extra)
    if not result:
        raise ExcelImportError("Không tìm thấy dòng Order hợp lệ.")
    return result


FORM_EMPLOYEE_CHOICE_ALIASES = {
    "CHON NHAN VIEN",
    "NHAN VIEN",
    "HO VA TEN",
    "TEN NHAN VIEN",
}
FORM_CODE_ALIASES = {"MA NV", "MA NHAN VIEN", "MANV"}
FORM_TIMESTAMP_ALIASES = {"DAU THOI GIAN", "TIMESTAMP", "THOI GIAN GUI"}


def _read_tabular_rows(path: Path) -> list[tuple[Any, ...]]:
    """Đọc file câu trả lời Form từ XLSX hoặc CSV."""
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".csv":
        encodings = ("utf-8-sig", "utf-8", "cp1258")
        last_error: Exception | None = None
        for encoding in encodings:
            try:
                with path.open("r", encoding=encoding, newline="") as handle:
                    return [tuple(row) for row in csv.reader(handle)]
            except UnicodeDecodeError as exc:
                last_error = exc
                continue
        raise ExcelImportError(f"Không đọc được file CSV: {last_error}")
    if suffix not in {".xlsx", ".xlsm"}:
        raise ExcelImportError("Chỉ hỗ trợ file câu trả lời Form dạng .xlsx hoặc .csv.")
    workbook, sheet = _first_sheet(path)
    try:
        return [tuple(row) for row in sheet.iter_rows(values_only=True)]
    finally:
        workbook.close()


def _employee_code_from_choice(value: Any) -> str:
    text = normalize_text(value)
    if not text:
        return ""
    parts = re.split(r"\s*[–—-]\s*", text, maxsplit=1)
    return normalize_text(parts[0]) if parts else ""


def import_form_response_rows(path: Path, shifts: list[str] | None = None) -> dict[str, Any]:
    """Đọc trực tiếp file câu trả lời Google Form.

    Quy tắc nghiệp vụ:
    - Một Mã NV xuất hiện đúng 1 lần và đủ 21 câu trả lời -> đủ điều kiện nhập.
    - Một Mã NV xuất hiện từ 2 lần trở lên -> đánh dấu trùng, không nhập Order.
    - Dòng duy nhất nhưng thiếu/sai câu trả lời -> không nhập, để CHƯA ORDER.
    """
    rows = _read_tabular_rows(Path(path))
    if not rows:
        raise ExcelImportError("File câu trả lời Form không có dữ liệu.")

    header = [normalize_key(cell) for cell in rows[0]]
    code_index = next((i for i, value in enumerate(header) if value in FORM_CODE_ALIASES), None)
    choice_index = next((i for i, value in enumerate(header) if value in FORM_EMPLOYEE_CHOICE_ALIASES), None)
    timestamp_index = next((i for i, value in enumerate(header) if value in FORM_TIMESTAMP_ALIASES), None)
    if code_index is None and choice_index is None:
        raise ExcelImportError("File Form phải có cột Mã NV hoặc CHỌN NHÂN VIÊN.")

    shifts = [str(item).strip() for item in (shifts or SHIFTS) if str(item).strip()]
    if not shifts:
        raise ExcelImportError("Hiện chưa có ca làm việc nào đang sử dụng.")

    status_indexes: dict[tuple[int, str], int] = {}
    for weekday in range(7):
        for shift in shifts:
            found = _find_order_header_index(header, weekday, shift)
            if found is None:
                raise ExcelImportError(f"Thiếu cột Form: {WEEKDAY_NAMES[weekday]} – Ca {shift}")
            status_indexes[(weekday, shift)] = found

    submissions: list[dict[str, Any]] = []
    missing_code_rows: list[int] = []
    for row_number, row in enumerate(rows[1:], start=2):
        if not any(normalize_text(value) for value in row):
            continue
        code = ""
        if code_index is not None:
            code = normalize_text(row[code_index] if code_index < len(row) else "")
        if not code and choice_index is not None:
            code = _employee_code_from_choice(row[choice_index] if choice_index < len(row) else "")
        if not code:
            missing_code_rows.append(row_number)
            continue

        name = ""
        if choice_index is not None:
            choice = normalize_text(row[choice_index] if choice_index < len(row) else "")
            parts = re.split(r"\s*[–—-]\s*", choice, maxsplit=1)
            if len(parts) == 2:
                name = normalize_text(parts[1])
        timestamp = normalize_text(row[timestamp_index] if timestamp_index is not None and timestamp_index < len(row) else "")

        statuses: dict[tuple[int, str], str] = {}
        error = ""
        for key, index in status_indexes.items():
            try:
                statuses[key] = _normalize_order_status(row[index] if index < len(row) else None)
            except ExcelImportError as exc:
                weekday, shift = key
                error = f"Dòng {row_number}, {WEEKDAY_NAMES[weekday]} ca {shift}: {exc}"
                break
        submissions.append(
            {
                "row_number": row_number,
                "code": code,
                "name": name,
                "timestamp": timestamp,
                "statuses": statuses,
                "error": error,
            }
        )

    if not submissions and not missing_code_rows:
        raise ExcelImportError("Không tìm thấy câu trả lời nhân viên trong file Form.")

    by_code: dict[str, list[dict[str, Any]]] = {}
    canonical_code: dict[str, str] = {}
    for item in submissions:
        key = str(item["code"]).casefold()
        by_code.setdefault(key, []).append(item)
        canonical_code.setdefault(key, str(item["code"]))

    duplicate_codes = [canonical_code[key] for key, items in by_code.items() if len(items) >= 2]
    duplicate_keys = {code.casefold() for code in duplicate_codes}
    valid_rows: list[dict[str, Any]] = []
    invalid_rows: list[str] = []
    for key, items in by_code.items():
        if key in duplicate_keys:
            continue
        item = items[0]
        if item["error"]:
            invalid_rows.append(str(item["error"]))
            continue
        valid_rows.append(item)

    if missing_code_rows:
        invalid_rows.append(
            "Các dòng không xác định được Mã NV: " + ", ".join(str(n) for n in missing_code_rows)
        )

    return {
        "valid_rows": valid_rows,
        "duplicate_codes": duplicate_codes,
        "invalid_rows": invalid_rows,
        "submission_count": len(submissions) + len(missing_code_rows),
        "employee_submission_count": len(by_code),
    }


def create_order_template(path: Path, shifts: list[str]) -> None:
    """Tạo file mẫu Order theo đúng danh sách ca đang dùng tại thời điểm lưu."""
    shifts = [str(item).strip() for item in shifts if str(item).strip()]
    if not shifts:
        raise ExcelImportError("Hiện chưa có ca làm việc nào đang sử dụng để tạo file mẫu.")
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "ORDER LỊCH"
    headers = ["Mã NV", "Tên nhân viên"]
    for day in WEEKDAY_NAMES:
        for shift in shifts:
            headers.append(f"{day.upper()} [CA {shift.upper()}]")
    sheet.append(headers)
    header_fill = PatternFill("solid", fgColor="1D4ED8")
    weekend_fill = PatternFill("solid", fgColor="B45309")
    header_font = Font(color="FFFFFF", bold=True)
    for col, header in enumerate(headers, start=1):
        cell = sheet.cell(row=1, column=col)
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.fill = weekend_fill if ("THỨ 7" in header or "CHỦ NHẬT" in header) else header_fill
    sheet.freeze_panes = "C2"
    sheet.row_dimensions[1].height = 42
    sheet.column_dimensions["A"].width = 14
    sheet.column_dimensions["B"].width = 28
    for col in range(3, len(headers) + 1):
        from openpyxl.utils import get_column_letter
        sheet.column_dimensions[get_column_letter(col)].width = 18
    # Hai dòng ví dụ giúp người dùng hiểu đúng giá trị cần nhập.
    example = ["NV01", "NGUYỄN VĂN A"] + ["ĐI LÀM ĐƯỢC"] * (7 * len(shifts))
    sheet.append(example)
    example2 = ["NV02", "TRẦN VĂN B"] + ["NGHỈ"] * (7 * len(shifts))
    sheet.append(example2)
    workbook.save(path)


def export_evaluation_round_package(
    target_path: Path,
    round_row,
    employee_rows,
    criteria_rows,
) -> Path:
    """Xuất đúng gói dữ liệu của một lần đánh giá để Google Sheet tạo 1 Form động."""
    target_path = Path(target_path)
    if target_path.suffix.lower() != ".xlsx":
        target_path = target_path.with_suffix(".xlsx")
    target_path.parent.mkdir(parents=True, exist_ok=True)

    employees = []
    for row in employee_rows:
        role = str(row.get("role") if isinstance(row, dict) else row["role"] or "").strip()
        if role not in ROLES:
            raise ValueError(
                f"Nhân viên {row.get('employee_code') if isinstance(row, dict) else row['employee_code']} "
                "chưa được chọn bộ tiêu chí Pha chế/Chạy bàn."
            )
        code = str(row.get("employee_code") if isinstance(row, dict) else row["employee_code"] or "").strip()
        name = str(row.get("employee_name") if isinstance(row, dict) else row["employee_name"] or "").strip()
        employees.append([len(employees) + 1, code, name, role])
    if not employees:
        raise ValueError("Lần đánh giá chưa có nhân viên.")

    criteria_by_role: dict[str, list] = {"Pha chế": [], "Chạy bàn": []}
    for row in criteria_rows:
        role = str(row.get("role") if isinstance(row, dict) else row["role"] or "").strip()
        if role in criteria_by_role:
            criteria_by_role[role].append(row)
    for role in ROLES:
        if not criteria_by_role[role]:
            raise ValueError(f"Bộ tiêu chí {role} đang trống.")

    workbook = Workbook()
    config = workbook.active
    config.title = "CAU_HINH"
    config.append(["THÔNG TIN", "GIÁ TRỊ"])
    config.append(["NGÀY ĐÁNH GIÁ", str(round_row["label"])])
    config.append(["NGÀY ĐÁNH GIÁ ISO", str(round_row["evaluation_date"])])
    config.append(["TÊN FORM", f"ĐÁNH GIÁ NHÂN VIÊN {round_row['label']}"])
    config.append(["MÔ HÌNH FORM", "1 FORM - CHỌN NHÂN VIÊN - TỰ CHUYỂN PHA CHẾ/CHẠY BÀN"])

    employee_sheet = workbook.create_sheet("NHAN_VIEN")
    employee_sheet.append(["STT", "MÃ NV", "HỌ VÀ TÊN", "BỘ TIÊU CHÍ"])
    for row in employees:
        employee_sheet.append(row)

    role_sheet_names = {"Pha chế": "TIEU_CHI_PHA_CHE", "Chạy bàn": "TIEU_CHI_CHAY_BAN"}
    sheets = [config, employee_sheet]
    for role, sheet_name in role_sheet_names.items():
        sheet = workbook.create_sheet(sheet_name)
        sheets.append(sheet)
        sheet.append(["STT", "MÃ TIÊU CHÍ", "TÊN TIÊU CHÍ", "ĐIỂM TỐI ĐA"])
        rows = sorted(
            criteria_by_role[role],
            key=lambda item: (
                int(item.get("sort_order") if isinstance(item, dict) else item["sort_order"]),
                str(item.get("criterion_code") if isinstance(item, dict) else item["criterion_code"]),
            ),
        )
        for index, row in enumerate(rows, start=1):
            get = row.get if isinstance(row, dict) else row.__getitem__
            sheet.append([
                index,
                str(get("criterion_code") or ""),
                str(get("label") or ""),
                int(get("max_score")),
            ])

    header_fill = PatternFill("solid", fgColor="7C3AED")
    header_font = Font(color="FFFFFF", bold=True)
    for sheet in sheets:
        for cell in sheet[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        sheet.freeze_panes = "A2"
        sheet.row_dimensions[1].height = 32

    config.column_dimensions["A"].width = 28
    config.column_dimensions["B"].width = 68
    employee_sheet.column_dimensions["A"].width = 8
    employee_sheet.column_dimensions["B"].width = 16
    employee_sheet.column_dimensions["C"].width = 38
    employee_sheet.column_dimensions["D"].width = 18
    employee_sheet.auto_filter.ref = f"A1:D{employee_sheet.max_row}"
    for row in employee_sheet.iter_rows(min_row=2, max_col=4):
        row[1].number_format = "@"
        for cell in row:
            cell.alignment = Alignment(vertical="center", wrap_text=True)

    for sheet in sheets[2:]:
        sheet.column_dimensions["A"].width = 8
        sheet.column_dimensions["B"].width = 16
        sheet.column_dimensions["C"].width = 62
        sheet.column_dimensions["D"].width = 16
        sheet.auto_filter.ref = f"A1:D{sheet.max_row}"
        for row in sheet.iter_rows(min_row=2, max_col=4):
            row[1].number_format = "@"
            for cell in row:
                cell.alignment = Alignment(vertical="center", wrap_text=True)

    workbook.save(target_path)
    return target_path



def export_evaluation_voucher_file(target_path: Path, round_row, employee_rows) -> Path:
    """Xuất danh sách Voucher của một lần đánh giá ra Excel để đối chiếu/phát Voucher."""
    target_path = Path(target_path)
    if target_path.suffix.lower() != ".xlsx":
        target_path = target_path.with_suffix(".xlsx")
    target_path.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    for row in employee_rows:
        get = row.get if isinstance(row, dict) else row.__getitem__
        if str(get("status") or "").strip() != "ĐÃ ĐÁNH GIÁ":
            continue
        code = str(get("employee_code") or "").strip()
        name = str(get("employee_name") or "").strip()
        voucher = int(get("voucher_count") or 0)
        if not name:
            continue
        rows.append((code, name, voucher))

    if not rows:
        raise ValueError("Lần đánh giá này chưa có nhân viên ở trạng thái ĐÃ ĐÁNH GIÁ để xuất Voucher.")

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "VOUCHER"

    # Tiêu đề báo cáo.
    sheet.merge_cells("A1:D1")
    sheet["A1"] = "DANH SÁCH VOUCHER NHÂN VIÊN"
    sheet["A1"].font = Font(size=14, bold=True, color="FFFFFF")
    sheet["A1"].fill = PatternFill("solid", fgColor="7C3AED")
    sheet["A1"].alignment = Alignment(horizontal="center", vertical="center")
    sheet.row_dimensions[1].height = 26

    sheet.merge_cells("A2:D2")
    sheet["A2"] = f"LẦN ĐÁNH GIÁ: {round_row['label']}"
    sheet["A2"].font = Font(size=11, bold=True, color="4C1D95")
    sheet["A2"].alignment = Alignment(horizontal="center", vertical="center")
    sheet.row_dimensions[2].height = 22

    headers = ["STT", "MÃ NV", "HỌ VÀ TÊN", "SỐ LƯỢNG VOUCHER"]
    for col, value in enumerate(headers, start=1):
        cell = sheet.cell(row=4, column=col, value=value)
        cell.fill = PatternFill("solid", fgColor="EDE9FE")
        cell.font = Font(bold=True, color="4C1D95")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    sheet.row_dimensions[4].height = 30

    total_vouchers = 0
    start_row = 5
    for index, (code, name, voucher) in enumerate(rows, start=1):
        row_no = start_row + index - 1
        sheet.cell(row=row_no, column=1, value=index)
        code_cell = sheet.cell(row=row_no, column=2, value=code)
        code_cell.number_format = "@"
        sheet.cell(row=row_no, column=3, value=name)
        sheet.cell(row=row_no, column=4, value=voucher)
        total_vouchers += voucher
        for col in range(1, 5):
            cell = sheet.cell(row=row_no, column=col)
            cell.alignment = Alignment(
                horizontal="left" if col == 3 else "center",
                vertical="center",
                wrap_text=True,
            )
        sheet.row_dimensions[row_no].height = 22

    total_row = start_row + len(rows)
    sheet.merge_cells(start_row=total_row, start_column=1, end_row=total_row, end_column=3)
    total_label = sheet.cell(row=total_row, column=1, value="TỔNG VOUCHER")
    total_label.font = Font(bold=True, color="166534")
    total_label.fill = PatternFill("solid", fgColor="DCFCE7")
    total_label.alignment = Alignment(horizontal="right", vertical="center")
    total_cell = sheet.cell(row=total_row, column=4, value=total_vouchers)
    total_cell.font = Font(bold=True, color="166534")
    total_cell.fill = PatternFill("solid", fgColor="DCFCE7")
    total_cell.alignment = Alignment(horizontal="center", vertical="center")
    sheet.row_dimensions[total_row].height = 24

    sheet.freeze_panes = "A5"
    sheet.auto_filter.ref = f"A4:D{start_row + len(rows) - 1}"
    sheet.column_dimensions["A"].width = 8
    sheet.column_dimensions["B"].width = 16
    sheet.column_dimensions["C"].width = 38
    sheet.column_dimensions["D"].width = 22

    # Viền nhẹ cho bảng dữ liệu.
    from openpyxl.styles import Border, Side
    thin = Side(style="thin", color="D1D5DB")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    for row_no in range(4, total_row + 1):
        for col in range(1, 5):
            sheet.cell(row=row_no, column=col).border = border

    workbook.save(target_path)
    return target_path

def _voucher_datetime_text(value: Any) -> str:
    if value is None or str(value).strip() == "":
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time()).strftime("%Y-%m-%d %H:%M:%S")
    raw = str(value).strip()
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(raw, fmt)
            return parsed.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass
    return raw


def import_voucher_export_file(path: Path) -> list[dict[str, Any]]:
    """Đọc file Voucher xuất từ phần mềm bán hàng.

    Cấu trúc chuẩn đang dùng gồm: Mã chương trình, Tên chương trình,
    Mã khuyến mãi, Ngày bắt đầu, Ngày kết thúc. Chỉ Mã khuyến mãi là bắt buộc.
    """
    path = Path(path)
    if path.suffix.lower() not in {".xlsx", ".xlsm"}:
        raise ExcelImportError("File Voucher phải là .xlsx hoặc .xlsm.")
    try:
        # Một số file Voucher xuất từ phần mềm có worksheet dimension bị khai báo A1:A1
        # dù thực tế có nhiều cột. Không dùng read_only để openpyxl đọc đúng toàn bộ A:E.
        workbook = load_workbook(path, data_only=True, read_only=False)
    except Exception as exc:
        raise ExcelImportError(f"Không mở được file Voucher: {exc}") from exc
    try:
        target_rows = None
        indexes = None
        for sheet in workbook.worksheets:
            rows = list(sheet.iter_rows(values_only=True))
            if not rows:
                continue
            header = [normalize_key(value) for value in rows[0]]
            code_index = next(
                (i for i, value in enumerate(header) if value in {"MA KHUYEN MAI", "MA VOUCHER", "VOUCHER", "VOUCHER CODE"}),
                None,
            )
            if code_index is None:
                continue
            program_code_index = next(
                (i for i, value in enumerate(header) if value in {"MA CHUONG TRINH", "PROGRAM ID", "PROGRAM CODE"}),
                None,
            )
            program_name_index = next(
                (i for i, value in enumerate(header) if value in {"TEN CHUONG TRINH", "PROGRAM NAME"}),
                None,
            )
            start_index = next(
                (i for i, value in enumerate(header) if value in {"NGAY BAT DAU", "BAT DAU", "START DATE"}),
                None,
            )
            end_index = next(
                (i for i, value in enumerate(header) if value in {"NGAY KET THUC", "KET THUC", "END DATE"}),
                None,
            )
            target_rows = rows
            indexes = (code_index, program_code_index, program_name_index, start_index, end_index)
            break
        if target_rows is None or indexes is None:
            raise ExcelImportError(
                "Không tìm thấy tab Voucher hợp lệ. File cần có cột 'Mã khuyến mãi'."
            )

        code_index, program_code_index, program_name_index, start_index, end_index = indexes
        result: list[dict[str, Any]] = []
        seen: set[str] = set()
        for row_number, row in enumerate(target_rows[1:], start=2):
            code = normalize_text(row[code_index] if code_index < len(row) else "").upper()
            if not code:
                continue
            key = code.casefold()
            if key in seen:
                raise ExcelImportError(f"Mã Voucher bị trùng trong file tại dòng {row_number}: {code}")
            seen.add(key)
            def get_value(index):
                return row[index] if index is not None and index < len(row) else ""
            result.append({
                "voucher_code": code,
                "program_code": normalize_text(get_value(program_code_index)),
                "program_name": normalize_text(get_value(program_name_index)),
                "start_at": _voucher_datetime_text(get_value(start_index)),
                "end_at": _voucher_datetime_text(get_value(end_index)),
                "row_number": row_number,
            })
        if not result:
            raise ExcelImportError("File Voucher không có mã khuyến mãi nào.")
        return result
    finally:
        workbook.close()


def _parse_evaluation_employee_value(value: Any) -> tuple[str, str]:
    raw = normalize_text(value)
    if not raw:
        return "", ""
    # Form hiển thị dạng MÃ NV – HỌ VÀ TÊN. Chấp nhận cả dấu '-' thường.
    for sep in (" – ", " — ", " - ", "|", "–", "—"):
        if sep in raw:
            left, right = raw.split(sep, 1)
            code = normalize_text(left)
            name = normalize_text(right)
            if code:
                return code, name
    # Fallback: token đầu tiên là mã nếu không có dấu phân cách.
    match = re.match(r"^([^\s]+)\s+(.+)$", raw)
    if match:
        return normalize_text(match.group(1)), normalize_text(match.group(2))
    return raw, ""


def import_evaluation_form_rows(path: Path) -> list[dict[str, Any]]:
    """Đọc file phản hồi Google Form đánh giá.

    Tìm sheet có cột nhân viên + người đánh giá + nhận xét. Mỗi tiêu chí được nhận diện
    bằng mã PCxxx/CBxxx nằm trong tiêu đề câu hỏi; các cột section không được trả lời có thể trống.
    """
    path = Path(path)
    try:
        workbook = load_workbook(path, data_only=True, read_only=True)
    except Exception as exc:
        raise ExcelImportError(f"Không mở được file phản hồi đánh giá: {exc}") from exc
    try:
        target_sheet = None
        target_rows = None
        indexes = None
        for sheet in workbook.worksheets:
            rows = list(sheet.iter_rows(values_only=True))
            if not rows:
                continue
            raw_header = [normalize_text(value) for value in rows[0]]
            header = [normalize_key(value) for value in rows[0]]
            employee_index = next(
                (i for i, value in enumerate(header) if value in {"CHON NHAN VIEN", "TEN NHAN VIEN", "NHAN VIEN", "HO VA TEN"}),
                None,
            )
            evaluator_index = next(
                (i for i, value in enumerate(header) if value in {"NGUOI DANH GIA", "TEN NGUOI DANH GIA"}),
                None,
            )
            comments_index = next(
                (i for i, value in enumerate(header) if value in {"NHAN XET CHUNG", "NHAN XET"}),
                None,
            )
            if employee_index is None or evaluator_index is None or comments_index is None:
                continue
            criterion_indexes: dict[str, int] = {}
            for i, raw in enumerate(raw_header):
                match = re.search(r"\b((?:PC|CB)\d{2,3})\b", raw.upper())
                if match:
                    code = match.group(1).upper()
                    # Chuẩn hóa mã cũ PC01 -> PC001 nếu có.
                    prefix = code[:2]
                    number = int(code[2:])
                    criterion_indexes[f"{prefix}{number:03d}"] = i
            target_sheet = sheet
            target_rows = rows
            indexes = (employee_index, evaluator_index, comments_index, criterion_indexes)
            break
        if target_sheet is None or target_rows is None or indexes is None:
            raise ExcelImportError(
                "Không tìm thấy tab phản hồi đánh giá hợp lệ. Cần có các cột Chọn nhân viên, Người đánh giá và Nhận xét chung."
            )

        employee_index, evaluator_index, comments_index, criterion_indexes = indexes
        result: list[dict[str, Any]] = []
        for row_number, row in enumerate(target_rows[1:], start=2):
            employee_raw = normalize_text(row[employee_index] if employee_index < len(row) else "")
            if not employee_raw:
                continue
            code, name = _parse_evaluation_employee_value(employee_raw)
            evaluator = normalize_text(row[evaluator_index] if evaluator_index < len(row) else "")
            comments = normalize_text(row[comments_index] if comments_index < len(row) else "")
            scores: dict[str, Any] = {}
            for criterion_code, index in criterion_indexes.items():
                value = row[index] if index < len(row) else None
                if value is None or normalize_text(value) == "":
                    continue
                scores[criterion_code] = value
            result.append({
                "row_number": row_number,
                "employee_raw": employee_raw,
                "employee_code": code,
                "employee_name": name,
                "evaluator_name": evaluator,
                "comments": comments,
                "scores": scores,
            })
        if not result:
            raise ExcelImportError("File phản hồi chưa có dữ liệu đánh giá.")
        return result
    finally:
        workbook.close()
