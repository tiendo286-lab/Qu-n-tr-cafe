from __future__ import annotations

from pathlib import Path
from datetime import datetime
from typing import Any, Iterable

from PySide6.QtCore import QMarginsF, QRectF, Qt
from PySide6.QtGui import (
    QColor,
    QFont,
    QFontMetricsF,
    QPageLayout,
    QPageSize,
    QPainter,
    QPdfWriter,
    QPen,
)


PRINT_EVALUATOR = "BQL Hệ thống Milano & LELA CAFE"


def _mm(resolution: int, value: float) -> float:
    return float(value) * float(resolution) / 25.4


def _font(size_pt: float, bold: bool = False) -> QFont:
    font = QFont("Arial")
    font.setPointSizeF(float(size_pt))
    font.setBold(bool(bold))
    return font


def _draw_text(
    painter: QPainter,
    rect: QRectF,
    text: str,
    size_pt: float,
    *,
    bold: bool = False,
    align: int = Qt.AlignLeft | Qt.AlignVCenter,
    color: str = "#111827",
    wrap: bool = True,
) -> None:
    painter.save()
    painter.setFont(_font(size_pt, bold))
    painter.setPen(QColor(color))
    flags = int(align)
    if wrap:
        flags |= int(Qt.TextWordWrap)
    painter.drawText(rect, flags, str(text or ""))
    painter.restore()


def _fitted_text(
    text: str,
    rect: QRectF,
    *,
    start_pt: float = 8.0,
    min_pt: float = 7.0,
    suffix: str = "… (xem đầy đủ trong phần mềm)",
) -> tuple[str, float]:
    """Fit comments into a fixed box. Shrink to min_pt, then truncate with suffix."""
    value = str(text or "").strip()
    if not value:
        return "—", start_pt

    flags = int(Qt.TextWordWrap | Qt.AlignLeft | Qt.AlignTop)
    size = float(start_pt)
    while size >= min_pt - 0.01:
        metrics = QFontMetricsF(_font(size))
        bounds = metrics.boundingRect(rect, flags, value)
        if bounds.height() <= rect.height() + 0.5:
            return value, size
        size -= 0.25

    size = float(min_pt)
    metrics = QFontMetricsF(_font(size))
    if metrics.boundingRect(rect, flags, value).height() <= rect.height() + 0.5:
        return value, size

    # Binary-search the largest prefix that fits with the suffix.
    low, high = 0, len(value)
    best = suffix
    while low <= high:
        mid = (low + high) // 2
        prefix = value[:mid].rstrip()
        candidate = (prefix + " " + suffix).strip() if prefix else suffix
        if metrics.boundingRect(rect, flags, candidate).height() <= rect.height() + 0.5:
            best = candidate
            low = mid + 1
        else:
            high = mid - 1
    return best, size


def _criterion_row_height(label: str, width: float, font_pt: float, base_height: float) -> float:
    metrics = QFontMetricsF(_font(font_pt))
    rect = QRectF(0, 0, max(1.0, width - 8.0), 10000)
    bounds = metrics.boundingRect(rect, int(Qt.TextWordWrap | Qt.AlignLeft | Qt.AlignVCenter), str(label or ""))
    line_height = max(metrics.height(), 1.0)
    lines = max(1, int(round(bounds.height() / line_height)))
    return max(base_height, line_height * lines + 7.0)


def _draw_page(
    painter: QPainter,
    writer: QPdfWriter,
    round_row: Any,
    employee: dict[str, Any],
    criteria: Iterable[Any],
    scores: dict[int, int],
    content_rect: QRectF | None = None,
) -> None:
    resolution = writer.resolution()
    page = content_rect if content_rect is not None else writer.pageLayout().paintRectPixels(resolution)
    left, top, width, height = map(float, (page.x(), page.y(), page.width(), page.height()))
    right = left + width
    bottom = top + height

    dark = QColor("#111827")
    border = QColor("#CBD5E1")
    light = QColor("#F8FAFC")
    accent = QColor("#E2E8F0")

    painter.setPen(QPen(border, max(0.7, _mm(resolution, 0.18))))

    # Header
    y = top
    header_h = _mm(resolution, 15.8)
    _draw_text(
        painter,
        QRectF(left, y, width, _mm(resolution, 6.5)),
        "MILANO COFFEE & LELA CAFE",
        11.0,
        bold=True,
        align=Qt.AlignHCenter | Qt.AlignVCenter,
    )
    _draw_text(
        painter,
        QRectF(left, y + _mm(resolution, 5.5), width, _mm(resolution, 6.5)),
        "PHIẾU ĐÁNH GIÁ NHÂN VIÊN",
        12.5,
        bold=True,
        align=Qt.AlignHCenter | Qt.AlignVCenter,
        color="#0F172A",
    )
    _draw_text(
        painter,
        QRectF(left, y + _mm(resolution, 11.3), width, _mm(resolution, 5.0)),
        f"Ngày đánh giá: {round_row['label']}",
        8.0,
        align=Qt.AlignHCenter | Qt.AlignVCenter,
        color="#475569",
    )
    y += header_h

    # Employee information card.
    info_h = _mm(resolution, 18.8)
    painter.fillRect(QRectF(left, y, width, info_h), light)
    painter.drawRect(QRectF(left, y, width, info_h))
    pad = _mm(resolution, 2.0)
    half = width / 2.0
    row_h = info_h / 3.0
    _draw_text(painter, QRectF(left + pad, y, half - pad * 2, row_h), f"Mã NV: {employee.get('employee_code') or ''}", 8.2, bold=True)
    _draw_text(painter, QRectF(left + half, y, half - pad, row_h), f"Họ tên: {employee.get('employee_name') or ''}", 8.2, bold=True)
    _draw_text(painter, QRectF(left + pad, y + row_h, width - pad * 2, row_h), f"Bộ tiêu chí: {employee.get('role') or ''}", 8.0)
    _draw_text(
        painter,
        QRectF(left + pad, y + row_h * 2, width - pad * 2, row_h),
        f"Người đánh giá: {PRINT_EVALUATOR}",
        7.8,
    )
    y += info_h + _mm(resolution, 1.7)

    # Reserve result, comments and footer first. Table consumes the remaining space.
    result_h = _mm(resolution, 14.4)
    comments_h = _mm(resolution, 32.0)
    footer_h = _mm(resolution, 6.2)
    gaps = _mm(resolution, 4.5)
    table_available = bottom - y - result_h - comments_h - footer_h - gaps

    criteria_list = list(criteria)
    col_stt = width * 0.075
    col_label = width * 0.735
    col_max = width * 0.095
    col_score = width - col_stt - col_label - col_max
    header_row_h = _mm(resolution, 6.8)
    base_row_h = _mm(resolution, 5.35)

    # Find a compact table font that keeps all criteria on one A5 page.
    table_font = 7.7
    row_heights: list[float] = []
    while table_font >= 6.4:
        row_heights = [
            _criterion_row_height(str(c["label"]), col_label, table_font, base_row_h)
            for c in criteria_list
        ]
        if header_row_h + sum(row_heights) <= table_available:
            break
        table_font -= 0.2
    if header_row_h + sum(row_heights) > table_available and row_heights:
        scale = max(0.65, (table_available - header_row_h) / sum(row_heights))
        row_heights = [max(_mm(resolution, 4.6), h * scale) for h in row_heights]

    # Table header.
    x_positions = [left, left + col_stt, left + col_stt + col_label, left + col_stt + col_label + col_max, right]
    painter.fillRect(QRectF(left, y, width, header_row_h), accent)
    painter.drawRect(QRectF(left, y, width, header_row_h))
    for x in x_positions[1:-1]:
        painter.drawLine(int(x), int(y), int(x), int(y + header_row_h))
    header_titles = ["STT", "TIÊU CHÍ ĐÁNH GIÁ", "TỐI ĐA", "ĐIỂM"]
    col_widths = [col_stt, col_label, col_max, col_score]
    x = left
    for idx, title in enumerate(header_titles):
        _draw_text(
            painter,
            QRectF(x + 2, y, col_widths[idx] - 4, header_row_h),
            title,
            7.2,
            bold=True,
            align=(Qt.AlignLeft | Qt.AlignVCenter) if idx == 1 else (Qt.AlignHCenter | Qt.AlignVCenter),
        )
        x += col_widths[idx]
    y += header_row_h

    # Table rows.
    for index, criterion in enumerate(criteria_list, start=1):
        row_h = row_heights[index - 1] if row_heights else base_row_h
        painter.drawRect(QRectF(left, y, width, row_h))
        for x in x_positions[1:-1]:
            painter.drawLine(int(x), int(y), int(x), int(y + row_h))
        cid = int(criterion["id"])
        score = scores.get(cid, "")
        _draw_text(painter, QRectF(left + 1, y, col_stt - 2, row_h), str(index), table_font, align=Qt.AlignHCenter | Qt.AlignVCenter)
        _draw_text(painter, QRectF(left + col_stt + 4, y + 1, col_label - 8, row_h - 2), str(criterion["label"]), table_font, align=Qt.AlignLeft | Qt.AlignVCenter)
        _draw_text(painter, QRectF(left + col_stt + col_label + 1, y, col_max - 2, row_h), str(int(criterion["max_score"])), table_font, align=Qt.AlignHCenter | Qt.AlignVCenter)
        _draw_text(painter, QRectF(left + col_stt + col_label + col_max + 1, y, col_score - 2, row_h), str(score), table_font, bold=True, align=Qt.AlignHCenter | Qt.AlignVCenter)
        y += row_h

    y += _mm(resolution, 1.5)

    # Result box.
    max_points = sum(int(c["max_score"] or 0) for c in criteria_list)
    total_points = int(employee.get("total_points") or 0)
    rating = str(employee.get("rating") or "—")
    vouchers = int(employee.get("voucher_count") or 0)
    painter.fillRect(QRectF(left, y, width, result_h), light)
    painter.drawRect(QRectF(left, y, width, result_h))
    result_row = result_h / 3.0
    _draw_text(painter, QRectF(left + pad, y, width - pad * 2, result_row), f"TỔNG ĐIỂM: {total_points} / {max_points}", 8.4, bold=True)
    _draw_text(painter, QRectF(left + pad, y + result_row, width - pad * 2, result_row), f"XẾP LOẠI: {rating.upper()}", 9.0, bold=True, color="#0F172A")
    _draw_text(painter, QRectF(left + pad, y + result_row * 2, width - pad * 2, result_row), f"SỐ LƯỢNG VOUCHER: {vouchers}", 8.0, bold=True)
    y += result_h + _mm(resolution, 1.5)

    # Fixed-height comments. Never spills to page 2.
    painter.drawRect(QRectF(left, y, width, comments_h))
    title_h = _mm(resolution, 5.0)
    _draw_text(painter, QRectF(left + pad, y, width - pad * 2, title_h), "NHẬN XÉT CHUNG", 8.0, bold=True)
    comment_rect = QRectF(left + pad, y + title_h, width - pad * 2, comments_h - title_h - _mm(resolution, 1.0))
    fitted, comment_size = _fitted_text(str(employee.get("comments") or ""), comment_rect, start_pt=8.2, min_pt=7.0)
    _draw_text(painter, comment_rect, fitted, comment_size, align=Qt.AlignLeft | Qt.AlignTop)
    y += comments_h + _mm(resolution, 1.0)

    # Footer.
    painter.setPen(dark)
    _draw_text(
        painter,
        QRectF(left, min(y, bottom - footer_h), width, footer_h),
        "MILANO COFFEE & LELA CAFE – Phiếu đánh giá nội bộ",
        6.7,
        align=Qt.AlignHCenter | Qt.AlignVCenter,
        color="#64748B",
    )


def _display_datetime(value: Any, *, include_time: bool = False) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y"):
        try:
            parsed = datetime.strptime(raw, fmt)
            return parsed.strftime("%d/%m/%Y %H:%M" if include_time else "%d/%m/%Y")
        except ValueError:
            pass
    return raw


def _draw_voucher_back_page(
    painter: QPainter,
    writer: QPdfWriter,
    round_row: Any,
    employee: dict[str, Any],
    vouchers: list[dict[str, Any]],
    content_rect: QRectF | None = None,
) -> None:
    resolution = writer.resolution()
    page = content_rect if content_rect is not None else writer.pageLayout().paintRectPixels(resolution)
    left, top, width, height = map(float, (page.x(), page.y(), page.width(), page.height()))
    right = left + width
    bottom = top + height

    border = QColor("#CBD5E1")
    light = QColor("#F8FAFC")
    accent = QColor("#E2E8F0")
    painter.setPen(QPen(border, max(0.7, _mm(resolution, 0.18))))

    # Header mặt sau.
    y = top
    _draw_text(
        painter, QRectF(left, y, width, _mm(resolution, 6.5)),
        "MILANO COFFEE & LELA CAFE", 11.0, bold=True,
        align=Qt.AlignHCenter | Qt.AlignVCenter,
    )
    _draw_text(
        painter, QRectF(left, y + _mm(resolution, 5.5), width, _mm(resolution, 6.5)),
        "VOUCHER NHÂN VIÊN ĐƯỢC NHẬN", 12.0, bold=True,
        align=Qt.AlignHCenter | Qt.AlignVCenter, color="#0F172A",
    )
    _draw_text(
        painter, QRectF(left, y + _mm(resolution, 11.2), width, _mm(resolution, 5.0)),
        f"Ngày đánh giá: {round_row['label']}", 8.0,
        align=Qt.AlignHCenter | Qt.AlignVCenter, color="#475569",
    )
    y += _mm(resolution, 16.0)

    # Thông tin nhân viên.
    info_h = _mm(resolution, 25.0)
    painter.fillRect(QRectF(left, y, width, info_h), light)
    painter.drawRect(QRectF(left, y, width, info_h))
    pad = _mm(resolution, 2.0)
    half = width / 2.0
    row_h = info_h / 4.0
    _draw_text(painter, QRectF(left + pad, y, half - pad * 2, row_h), f"Mã NV: {employee.get('employee_code') or ''}", 8.4, bold=True)
    _draw_text(painter, QRectF(left + half, y, half - pad, row_h), f"Họ tên: {employee.get('employee_name') or ''}", 8.4, bold=True)
    expected = int(employee.get("voucher_count") or 0)
    _draw_text(painter, QRectF(left + pad, y + row_h, width - pad * 2, row_h), f"Số lượng Voucher: {expected}", 8.5, bold=True)

    programs = {str(v.get("program_name") or "").strip() for v in vouchers if str(v.get("program_name") or "").strip()}
    program_text = next(iter(programs)) if len(programs) == 1 else ("Nhiều chương trình" if programs else "—")
    _draw_text(painter, QRectF(left + pad, y + row_h * 2, width - pad * 2, row_h), f"Chương trình: {program_text}", 7.8)

    date_pairs = {
        (_display_datetime(v.get("start_at")), _display_datetime(v.get("end_at")))
        for v in vouchers
        if str(v.get("start_at") or "").strip() or str(v.get("end_at") or "").strip()
    }
    if len(date_pairs) == 1:
        start_text, end_text = next(iter(date_pairs))
        validity = f"Hiệu lực: {start_text or '—'} - {end_text or '—'}"
    elif date_pairs:
        validity = "Hiệu lực: theo từng mã Voucher"
    else:
        validity = "Hiệu lực: —"
    _draw_text(painter, QRectF(left + pad, y + row_h * 3, width - pad * 2, row_h), validity, 7.8)
    y += info_h + _mm(resolution, 2.0)

    footer_h = _mm(resolution, 7.0)
    content_bottom = bottom - footer_h

    if not vouchers:
        box_h = min(_mm(resolution, 35.0), content_bottom - y - _mm(resolution, 2.0))
        painter.drawRect(QRectF(left, y, width, box_h))
        _draw_text(
            painter, QRectF(left + pad, y, width - pad * 2, box_h),
            "KHÔNG CÓ VOUCHER ĐƯỢC CẤP TRONG LẦN ĐÁNH GIÁ NÀY.",
            9.0, bold=True, align=Qt.AlignHCenter | Qt.AlignVCenter, color="#475569",
        )
    else:
        _draw_text(
            painter, QRectF(left, y, width, _mm(resolution, 6.0)),
            "DANH SÁCH MÃ VOUCHER", 8.5, bold=True, align=Qt.AlignLeft | Qt.AlignVCenter,
        )
        y += _mm(resolution, 6.2)

        # Hai cột để in được nhiều mã trên một mặt A5.
        gap = _mm(resolution, 3.0)
        block_w = (width - gap) / 2.0
        rows_per_col = max(1, (len(vouchers) + 1) // 2)
        table_h = max(_mm(resolution, 20.0), content_bottom - y - _mm(resolution, 1.0))
        header_h = _mm(resolution, 6.3)
        raw_row_h = (table_h - header_h) / rows_per_col
        data_row_h = max(_mm(resolution, 3.8), min(_mm(resolution, 7.2), raw_row_h))
        table_h = header_h + data_row_h * rows_per_col
        font_pt = 8.4
        if data_row_h < _mm(resolution, 5.0):
            font_pt = 6.8
        elif data_row_h < _mm(resolution, 6.0):
            font_pt = 7.5

        for column in range(2):
            x0 = left + column * (block_w + gap)
            painter.fillRect(QRectF(x0, y, block_w, header_h), accent)
            painter.drawRect(QRectF(x0, y, block_w, header_h))
            stt_w = block_w * 0.18
            painter.drawLine(int(x0 + stt_w), int(y), int(x0 + stt_w), int(y + header_h))
            _draw_text(painter, QRectF(x0, y, stt_w, header_h), "STT", 7.2, bold=True, align=Qt.AlignHCenter | Qt.AlignVCenter)
            _draw_text(painter, QRectF(x0 + stt_w + 2, y, block_w - stt_w - 4, header_h), "MÃ VOUCHER", 7.2, bold=True, align=Qt.AlignLeft | Qt.AlignVCenter)

            for r in range(rows_per_col):
                index = column * rows_per_col + r
                row_y = y + header_h + r * data_row_h
                painter.drawRect(QRectF(x0, row_y, block_w, data_row_h))
                painter.drawLine(int(x0 + stt_w), int(row_y), int(x0 + stt_w), int(row_y + data_row_h))
                if index >= len(vouchers):
                    continue
                code = str(vouchers[index].get("voucher_code") or "").strip()
                _draw_text(painter, QRectF(x0, row_y, stt_w, data_row_h), str(index + 1), font_pt, align=Qt.AlignHCenter | Qt.AlignVCenter)
                _draw_text(painter, QRectF(x0 + stt_w + 3, row_y, block_w - stt_w - 6, data_row_h), code, font_pt, bold=True, align=Qt.AlignLeft | Qt.AlignVCenter, wrap=False)

    _draw_text(
        painter, QRectF(left, bottom - footer_h, width, footer_h),
        "MILANO COFFEE & LELA CAFE - Voucher theo kết quả đánh giá nhân viên",
        6.6, align=Qt.AlignHCenter | Qt.AlignVCenter, color="#64748B",
    )


def _draw_a4_cut_line(painter: QPainter, writer: QPdfWriter) -> None:
    """Vẽ đường cắt giữa tờ A4 ngang để chia thành 2 phiếu A5."""
    resolution = writer.resolution()
    page = writer.pageLayout().paintRectPixels(resolution)
    left, top, width, height = map(float, (page.x(), page.y(), page.width(), page.height()))
    center_x = left + width / 2.0

    painter.save()
    pen = QPen(QColor("#94A3B8"), max(0.7, _mm(resolution, 0.18)))
    pen.setStyle(Qt.DashLine)
    painter.setPen(pen)
    painter.drawLine(int(center_x), int(top + _mm(resolution, 3.0)), int(center_x), int(top + height - _mm(resolution, 3.0)))
    painter.restore()

    label_w = _mm(resolution, 12.0)
    _draw_text(
        painter,
        QRectF(center_x - label_w / 2.0, top + _mm(resolution, 0.7), label_w, _mm(resolution, 4.0)),
        "CẮT",
        5.8,
        bold=True,
        align=Qt.AlignHCenter | Qt.AlignVCenter,
        color="#64748B",
        wrap=False,
    )


def _a5_panel_content_rect(writer: QPdfWriter, slot: int) -> QRectF:
    """Trả về vùng nội dung A5 (có lề 7 mm) ở nửa trái/phải tờ A4 ngang."""
    resolution = writer.resolution()
    page = writer.pageLayout().paintRectPixels(resolution)
    left, top, width, height = map(float, (page.x(), page.y(), page.width(), page.height()))
    panel_w = width / 2.0
    margin = _mm(resolution, 7.0)
    x = left + (panel_w * int(slot)) + margin
    return QRectF(
        x,
        top + margin,
        max(1.0, panel_w - margin * 2.0),
        max(1.0, height - margin * 2.0),
    )


def export_evaluation_round_pdf(
    path: Path,
    round_row: Any,
    employees: list[dict[str, Any]],
    criteria_by_role: dict[str, list[Any]],
    scores_by_employee: dict[int, dict[int, int]],
    vouchers_by_employee: dict[int, list[dict[str, Any]]] | None = None,
) -> Path:
    """
    Xuất PDF A4 ngang, 2 phiếu A5 trên mỗi mặt.

    Mỗi cặp nhân viên dùng 2 trang A4 liên tiếp:
    - Trang 1: mặt trước phiếu đánh giá (NV A trái, NV B phải).
    - Trang 2: mặt sau Voucher đúng cùng vị trí trái/phải.

    Sau khi in hai mặt và cắt theo đường giữa sẽ thu được phiếu A5 của từng nhân viên.
    Nếu số nhân viên lẻ, nửa bên phải của cặp cuối được để trắng ở cả hai mặt.
    """
    target = Path(path)
    if target.suffix.lower() != ".pdf":
        target = target.with_suffix(".pdf")
    target.parent.mkdir(parents=True, exist_ok=True)

    evaluated = [row for row in employees if str(row.get("status") or "") == "ĐÃ ĐÁNH GIÁ"]
    vouchers_by_employee = vouchers_by_employee or {}
    if not evaluated:
        raise ValueError("Lần đánh giá này chưa có nhân viên nào ở trạng thái ĐÃ ĐÁNH GIÁ.")

    writer = QPdfWriter(str(target))
    writer.setResolution(144)
    writer.setTitle(f"Phiếu đánh giá nhân viên {round_row['label']} - A4 ngang 2 phiếu A5")
    writer.setCreator("Quản Trị Lịch Làm Cafe - SQLite")
    layout = QPageLayout(
        QPageSize(QPageSize.PageSizeId.A4),
        QPageLayout.Orientation.Landscape,
        QMarginsF(0.0, 0.0, 0.0, 0.0),
        QPageLayout.Unit.Millimeter,
    )
    writer.setPageLayout(layout)

    painter = QPainter(writer)
    if not painter.isActive():
        raise RuntimeError("Không thể khởi tạo trình tạo PDF.")

    try:
        for pair_start in range(0, len(evaluated), 2):
            if pair_start > 0:
                writer.newPage()

            pair = evaluated[pair_start:pair_start + 2]

            # Mặt trước: tối đa 2 phiếu đánh giá A5 trên một tờ A4 ngang.
            for slot, employee in enumerate(pair):
                role = str(employee.get("role") or "")
                criteria = criteria_by_role.get(role, [])
                employee_id = int(employee["id"])
                scores = scores_by_employee.get(employee_id, {})
                _draw_page(
                    painter, writer, round_row, employee, criteria, scores,
                    content_rect=_a5_panel_content_rect(writer, slot),
                )
            _draw_a4_cut_line(painter, writer)

            # Mặt sau: phải đảo trái/phải so với mặt trước.
            # Khi in hai mặt rồi cắt đôi, mỗi phiếu A5 mới có đúng
            # mặt trước đánh giá và mặt sau Voucher của cùng nhân viên.
            writer.newPage()
            pair_len = len(pair)
            for slot, employee in enumerate(pair):
                employee_id = int(employee["id"])
                back_slot = (pair_len - 1 - slot) if pair_len > 1 else 1
                _draw_voucher_back_page(
                    painter, writer, round_row, employee,
                    vouchers_by_employee.get(employee_id, []),
                    content_rect=_a5_panel_content_rect(writer, back_slot),
                )
            _draw_a4_cut_line(painter, writer)
    finally:
        painter.end()

    return target

