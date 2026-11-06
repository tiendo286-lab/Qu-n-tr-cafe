from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QColor, QFont
from PySide6.QtWidgets import (
    QAbstractItemView,
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
    QPushButton,
    QPlainTextEdit,
    QTableWidget,
    QTableWidgetItem,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from .constants import RANKS, ROLES, WEEKDAY_NAMES
from .database import Database, DatabaseError
from .week_controls import WeekSelectorBar, week_day_headers


def info(parent: QWidget, title: str, text: str) -> None:
    QMessageBox.information(parent, title, text)


def warning(parent: QWidget, title: str, text: str) -> None:
    QMessageBox.warning(parent, title, text)


def confirm(parent: QWidget, title: str, text: str) -> bool:
    return QMessageBox.question(parent, title, text, QMessageBox.Yes | QMessageBox.No) == QMessageBox.Yes


def make_button(text: str, slot: Callable, primary: bool = False, danger: bool = False) -> QPushButton:
    button = QPushButton(text)
    button.setMinimumHeight(42)
    button.setMinimumWidth(max(120, min(280, len(text) * 9 + 38)))
    if primary:
        button.setObjectName("Primary")
    if danger:
        button.setObjectName("Danger")
    button.clicked.connect(slot)
    return button


def short_assignment(branch_code: str, role: str) -> str:
    role_code = "PC" if role == "Pha chế" else "CB"
    return f"{branch_code}-{role_code}"


def full_assignment(branch_code: str, role: str) -> str:
    return f"{branch_code} – {role}"


def parse_csv(value: Any) -> list[str]:
    if isinstance(value, (list, tuple, set)):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value or "").split(",") if item.strip()]


def assignment_options(
    db: Database,
    employee: Any,
    shift: str | None = None,
) -> list[tuple[str, str]]:
    employee_branches = {
        item.casefold()
        for item in parse_csv(employee["branches"] if not isinstance(employee, dict) else employee.get("branches", ""))
    }
    roles = parse_csv(employee["roles"] if not isinstance(employee, dict) else employee.get("roles", ""))
    options: list[tuple[str, str]] = []
    for branch in db.list_branches(active_only=True):
        aliases = {
            str(branch["code"]).casefold(),
            str(branch["ui_code"]).casefold(),
            str(branch["internal_code"]).casefold(),
        }
        if not employee_branches.intersection(aliases):
            continue
        if shift and not db.branch_uses_shift(int(branch["id"]), shift):
            continue
        display_code = str(branch["ui_code"])
        for role in ROLES:
            if role in roles:
                options.append((short_assignment(display_code, role), f"{display_code}|{role}"))
    return options


class AddFixedEmployeesDialog(QDialog):
    def __init__(self, parent: QWidget, rows: list[Any]) -> None:
        super().__init__(parent)
        self.setWindowTitle("Thêm nhân viên vào Lịch cố định")
        self.setMinimumSize(820, 580)
        self.resize(880, 640)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 22, 24, 20)
        layout.setSpacing(16)
        title = QLabel("THÊM NHÂN VIÊN VÀO LỊCH CỐ ĐỊNH")
        title.setObjectName("PageTitle")
        layout.addWidget(title)
        note = QLabel("Chọn một hoặc nhiều nhân viên. Chỉ nhân viên đang làm và chưa có trong Lịch cố định mới xuất hiện.")
        note.setWordWrap(True)
        note.setObjectName("Muted")
        layout.addWidget(note)
        self.list = QListWidget()
        self.list.setAlternatingRowColors(True)
        self.list.setSpacing(4)
        for row in rows:
            item = QListWidgetItem(
                f"{row['code']} — {row['name']}  |  {row['rank']}  |  {row['branches']}  |  {row['roles']}"
            )
            item.setData(Qt.UserRole, int(row["id"]))
            item.setFlags(item.flags() | Qt.ItemIsUserCheckable)
            item.setCheckState(Qt.Unchecked)
            self.list.addItem(item)
        layout.addWidget(self.list)
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.button(QDialogButtonBox.Ok).setText("THÊM NHÂN VIÊN")
        buttons.button(QDialogButtonBox.Ok).setObjectName("Primary")
        buttons.button(QDialogButtonBox.Ok).setMinimumWidth(190)
        buttons.button(QDialogButtonBox.Cancel).setText("HỦY")
        buttons.button(QDialogButtonBox.Cancel).setMinimumWidth(130)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def selected_ids(self) -> list[int]:
        result: list[int] = []
        for index in range(self.list.count()):
            item = self.list.item(index)
            if item.checkState() == Qt.Checked:
                result.append(int(item.data(Qt.UserRole)))
        return result


class ScheduleCloseDialog(QDialog):
    def __init__(self, parent: QWidget, summary: str, lines: list[str]) -> None:
        super().__init__(parent)
        self.setWindowTitle("Kiểm tra trước khi chốt lịch")
        self.setMinimumSize(820, 620)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 22, 24, 20)
        layout.setSpacing(14)
        title = QLabel("KIỂM TRA TRƯỚC KHI CHỐT LỊCH")
        title.setObjectName("PageTitle")
        layout.addWidget(title)
        note = QLabel(
            "CÁC CẢNH BÁO KHÔNG CHẶN CHỐT LỊCH. CHỌN CHỐT LỊCH DÙ VẪN CÒN CẢNH BÁO ĐỂ TIẾP TỤC."
        )
        note.setWordWrap(True)
        note.setObjectName("Muted")
        layout.addWidget(note)
        summary_label = QLabel(summary)
        summary_label.setStyleSheet(
            "background:#FFF7ED; color:#9A3412; border:1px solid #FDBA74; border-radius:8px; padding:12px;"
        )
        summary_label.setWordWrap(True)
        layout.addWidget(summary_label)
        details = QPlainTextEdit()
        details.setReadOnly(True)
        details.setPlainText("\n".join(lines) if lines else "KHÔNG CÓ CẢNH BÁO.")
        layout.addWidget(details, 1)
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.button(QDialogButtonBox.Ok).setText("CHỐT LỊCH DÙ VẪN CÒN CẢNH BÁO")
        buttons.button(QDialogButtonBox.Ok).setObjectName("Primary")
        buttons.button(QDialogButtonBox.Ok).setMinimumWidth(330)
        buttons.button(QDialogButtonBox.Cancel).setText("QUAY LẠI CHỈNH SỬA")
        buttons.button(QDialogButtonBox.Cancel).setMinimumWidth(230)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)


class FixedSchedulePage(QWidget):
    """Bước 7: chỉ những nhân viên được thêm mới xuất hiện trong bảng."""

    data_changed = Signal()
    INFO_COLUMNS = 7

    def __init__(self, db: Database) -> None:
        super().__init__()
        self.db = db
        self.shifts = self.db.list_shift_names(active_only=True, order_only=True)
        self.current_rows: list[Any] = []
        self.combo_cells: dict[tuple[int, int, str], QComboBox] = {}
        self._refreshing = False

        layout = QVBoxLayout(self)
        layout.setContentsMargins(28, 26, 28, 24)
        layout.setSpacing(16)
        title = QLabel("Lịch cố định")
        title.setObjectName("PageTitle")
        layout.addWidget(title)
        note = QLabel(
            "Chỉ thêm những nhân viên có lịch lặp lại hằng tuần. Mỗi ô chỉ cho chọn cơ sở và vị trí đã khai báo trong Danh sách nhân viên."
        )
        note.setObjectName("Muted")
        note.setWordWrap(True)
        layout.addWidget(note)

        toolbar_frame = QFrame()
        toolbar_frame.setObjectName("Card")
        toolbar = QHBoxLayout(toolbar_frame)
        toolbar.setContentsMargins(14, 12, 14, 12)
        toolbar.setSpacing(10)
        toolbar.addWidget(make_button("Thêm nhân viên", self.add_employees, primary=True))
        toolbar.addWidget(make_button("Xóa khỏi Lịch cố định", self.remove_selected, danger=True))
        self.save_status = QLabel("ĐÃ LƯU")
        self.save_status.setMinimumWidth(160)
        self.save_status.setAlignment(Qt.AlignCenter)
        self.save_status.setStyleSheet(
            "background:#DCFCE7; color:#166534; border:1px solid #86EFAC; border-radius:7px; padding:9px 12px;"
        )
        toolbar.addWidget(self.save_status)
        toolbar.addStretch()
        layout.addWidget(toolbar_frame)

        stats_frame = QFrame()
        stats_frame.setObjectName("Card")
        stats = QGridLayout(stats_frame)
        stats.setContentsMargins(14, 12, 14, 12)
        stats.setHorizontalSpacing(10)
        stats.setVerticalSpacing(10)
        self.stat_members = QLabel()
        self.stat_total = QLabel()
        self.stat_pc = QLabel()
        self.stat_cb = QLabel()
        stat_widgets = [self.stat_members, self.stat_total, self.stat_pc, self.stat_cb]
        for index, widget in enumerate(stat_widgets):
            widget.setAlignment(Qt.AlignCenter)
            widget.setWordWrap(True)
            widget.setMinimumSize(210, 62)
            widget.setStyleSheet(
                "background:#F8FAFC; border:1px solid #CBD5E1; border-radius:8px; "
                "padding:9px 14px; font-size:14px; font-weight:800;"
            )
            stats.addWidget(widget, index // 2, index % 2)
        stats.setColumnStretch(0, 1)
        stats.setColumnStretch(1, 1)
        layout.addWidget(stats_frame)

        columns = ["Chọn", "ID", "Mã NV", "Tên nhân viên", "Phân cấp", "Cơ sở", "Vị trí"]
        for day in WEEKDAY_NAMES:
            for shift in self.shifts:
                columns.append(f"{day}\n{shift}")
        self.table = QTableWidget(0, len(columns))
        self.table.setHorizontalHeaderLabels(columns)
        self.table.setAlternatingRowColors(True)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.verticalHeader().setVisible(False)
        self.table.setColumnHidden(1, True)
        self.table.setColumnWidth(0, 55)
        self.table.setColumnWidth(2, 95)
        self.table.setColumnWidth(3, 245)
        self.table.setColumnWidth(4, 120)
        self.table.setColumnWidth(5, 150)
        self.table.setColumnWidth(6, 175)
        self.table.horizontalHeader().setMinimumSectionSize(112)
        self.table.horizontalHeader().setDefaultSectionSize(132)
        self.table.horizontalHeader().setMinimumHeight(54)
        self.table.setWordWrap(True)
        layout.addWidget(self.table, 1)
        self.refresh()

    def _new_fixed_combo(self, employee: Any, shift: str, current: dict[str, Any] | None) -> QComboBox:
        combo = QComboBox()
        combo.setMinimumWidth(126)
        combo.setMinimumHeight(38)
        combo.setSizeAdjustPolicy(QComboBox.AdjustToMinimumContentsLengthWithIcon)
        combo.setMinimumContentsLength(13)
        combo.addItem("Để trống", "")
        for label, data in assignment_options(self.db, employee, shift):
            combo.addItem(label, data)
        saved_data = ""
        if current:
            wanted = f"{current['branch_code']}|{current['role']}"
            index = combo.findData(wanted)
            if index < 0:
                combo.addItem(
                    f"[ĐÃ TẮT] {short_assignment(current['branch_code'], current['role'])}",
                    wanted,
                )
                index = combo.findData(wanted)
            combo.setCurrentIndex(index)
            combo.setToolTip(full_assignment(current["branch_code"], current["role"]))
            saved_data = wanted
        combo.setProperty("last_saved_data", saved_data)
        return combo

    def add_employees(self) -> None:
        available = self.db.list_available_fixed_schedule_employees()
        if not available:
            info(self, "Không còn nhân viên", "Tất cả nhân viên đang làm đã có trong danh sách Lịch cố định.")
            return
        dialog = AddFixedEmployeesDialog(self, available)
        if dialog.exec() != QDialog.Accepted:
            return
        ids = dialog.selected_ids()
        if not ids:
            warning(self, "Chưa chọn nhân viên", "Chọn ít nhất một nhân viên để thêm.")
            return
        self.db.add_fixed_schedule_members(ids)
        self.refresh()
        self.data_changed.emit()

    def _checked_employee_ids(self) -> list[int]:
        result: list[int] = []
        for row in range(self.table.rowCount()):
            item = self.table.item(row, 0)
            if item and item.checkState() == Qt.Checked:
                result.append(int(self.table.item(row, 1).text()))
        return result

    def remove_selected(self) -> None:
        ids = self._checked_employee_ids()
        if not ids:
            warning(self, "Chưa chọn nhân viên", "Đánh dấu cột Chọn trước khi xóa.")
            return
        if not confirm(
            self,
            "Xóa khỏi Lịch cố định",
            f"Xóa {len(ids)} nhân viên và toàn bộ ca cố định của họ? Danh sách nhân viên gốc không bị xóa.",
        ):
            return
        self.db.remove_fixed_schedule_members(ids)
        self.refresh()
        self.data_changed.emit()

    def _set_save_status(self, state: str) -> None:
        if state == "saving":
            self.save_status.setText("ĐANG LƯU…")
            self.save_status.setStyleSheet(
                "background:#FEF3C7; color:#92400E; border:1px solid #F59E0B; border-radius:7px; padding:9px 12px;"
            )
        elif state == "error":
            self.save_status.setText("LỖI LƯU – THỬ LẠI")
            self.save_status.setStyleSheet(
                "background:#FEE2E2; color:#991B1B; border:1px solid #FCA5A5; border-radius:7px; padding:9px 12px;"
            )
        else:
            self.save_status.setText("ĐÃ LƯU")
            self.save_status.setStyleSheet(
                "background:#DCFCE7; color:#166534; border:1px solid #86EFAC; border-radius:7px; padding:9px 12px;"
            )

    def _fixed_cell_changed(
        self, employee_id: int, weekday: int, shift: str, combo: QComboBox, force: bool = False
    ) -> bool:
        if self._refreshing:
            return True
        data = str(combo.currentData() or "")
        previous = str(combo.property("last_saved_data") or "")
        if not force and data == previous:
            return True
        branch_code: str | None = None
        role: str | None = None
        if data:
            try:
                branch_code, role = data.split("|", 1)
            except ValueError:
                self._set_save_status("error")
                warning(self, "Không thể lưu", "Giá trị cơ sở – vị trí không hợp lệ.")
                return False
        self._set_save_status("saving")
        try:
            self.db.save_fixed_schedule_cell(employee_id, weekday, shift, branch_code, role)
            saved = self.db.get_fixed_schedule_cell(employee_id, weekday, shift)
            if data:
                expected = f"{branch_code}|{role}"
                actual = "" if saved is None else f"{saved['branch_code']}|{saved['role']}"
                if actual != expected:
                    raise DatabaseError("Dữ liệu vừa chọn chưa được ghi đúng vào cơ sở dữ liệu.")
            elif saved is not None:
                raise DatabaseError("Ô lịch cố định chưa được xóa khỏi cơ sở dữ liệu.")
        except Exception as exc:
            self._set_save_status("error")
            warning(self, "Không thể tự động lưu Lịch cố định", str(exc))
            self.refresh()
            return False
        combo.setProperty("last_saved_data", data)
        if data and branch_code and role:
            combo.setToolTip(full_assignment(branch_code, role))
        else:
            combo.setToolTip("")
        self._set_save_status("saved")
        self.refresh_stats()
        self.data_changed.emit()
        return True

    def flush_pending_changes(self) -> bool:
        """Ghi nốt mọi ô khác dữ liệu đã lưu trước khi rời tab hoặc đóng ứng dụng."""
        if self._refreshing:
            return True
        ok = True
        for (employee_id, weekday, shift), combo in list(self.combo_cells.items()):
            current = str(combo.currentData() or "")
            saved = str(combo.property("last_saved_data") or "")
            if current != saved:
                ok = self._fixed_cell_changed(employee_id, weekday, shift, combo, force=True) and ok
        return ok

    def refresh_stats(self) -> None:
        summary = self.db.fixed_schedule_summary()
        self.stat_members.setText(f"NHÂN VIÊN CỐ ĐỊNH\n{summary['members']}")
        self.stat_total.setText(f"TỔNG CA CỐ ĐỊNH\n{summary['total']}")
        self.stat_pc.setText(f"PHA CHẾ\n{summary['Pha chế']}")
        self.stat_cb.setText(f"CHẠY BÀN\n{summary['Chạy bàn']}")

    def refresh(self) -> None:
        if self._refreshing:
            return
        self._refreshing = True
        try:
            self.current_rows = self.db.list_fixed_schedule_members()
            matrix = self.db.get_fixed_schedule_matrix()
            self.combo_cells.clear()
            self.table.setRowCount(len(self.current_rows))
            for row_index, employee in enumerate(self.current_rows):
                check_item = QTableWidgetItem()
                check_item.setFlags(Qt.ItemIsEnabled | Qt.ItemIsUserCheckable)
                check_item.setCheckState(Qt.Unchecked)
                self.table.setItem(row_index, 0, check_item)
                values = [employee["id"], employee["code"], employee["name"], employee["rank"], employee["branches"], employee["roles"]]
                for col, value in enumerate(values, start=1):
                    item = QTableWidgetItem(str(value))
                    item.setFlags(item.flags() & ~Qt.ItemIsEditable)
                    self.table.setItem(row_index, col, item)
                col = self.INFO_COLUMNS
                for weekday in range(7):
                    for shift in self.shifts:
                        current = matrix.get(int(employee["id"]), {}).get((weekday, shift))
                        combo = self._new_fixed_combo(employee, shift, current)
                        # currentIndexChanged lưu ngay khi giá trị thay đổi; activated là lớp dự phòng
                        # cho một số phiên bản Qt/macOS không phát tín hiệu ổn định trong bảng.
                        callback = (
                            lambda _index, eid=int(employee["id"]), wd=weekday, sh=shift, cb=combo:
                            self._fixed_cell_changed(eid, wd, sh, cb)
                        )
                        combo.currentIndexChanged.connect(callback)
                        combo.activated.connect(callback)
                        self.table.setCellWidget(row_index, col, combo)
                        self.combo_cells[(int(employee["id"]), weekday, shift)] = combo
                        col += 1
                self.table.setRowHeight(row_index, 50)
        finally:
            self._refreshing = False
        self._set_save_status("saved")
        self.refresh_stats()


class MasterSchedulePage(QWidget):
    """Xếp lịch tổng: tự động lưu, màu thống nhất và bảng định biên cố định."""

    data_changed = Signal()
    week_selected = Signal(int)

    def __init__(self, db: Database, week_getter: Callable[[], int | None]) -> None:
        super().__init__()
        self.db = db
        self.week_getter = week_getter
        self.shifts = self.db.list_shift_names(active_only=True, order_only=True)
        self.branches = self.db.list_branches(active_only=True)
        self.matrix: dict[int, dict[tuple[int, str], dict[str, Any]]] = {}
        self.visible_employees: list[Any] = []
        self.employee_by_id: dict[int, Any] = {}
        self.combos: dict[tuple[int, int, str], QComboBox] = {}
        self._refreshing = False
        self._undo_stack: list[tuple[int, int, str, dict[str, Any], dict[str, Any]]] = []
        self._redo_stack: list[tuple[int, int, str, dict[str, Any], dict[str, Any]]] = []

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 18, 20, 18)
        layout.setSpacing(10)

        title_row = QHBoxLayout()
        title = QLabel("XẾP LỊCH LÀM TỔNG")
        title.setObjectName("PageTitle")
        self.status_label = QLabel("TRẠNG THÁI: ĐANG XẾP")
        self.status_label.setMinimumWidth(220)
        self.status_label.setAlignment(Qt.AlignCenter)
        title_row.addWidget(title)
        title_row.addStretch()
        title_row.addWidget(self.status_label)
        layout.addLayout(title_row)

        self.week_bar = WeekSelectorBar(self.db, self.week_getter)
        self.week_bar.week_selected.connect(self.week_selected.emit)
        layout.addWidget(self.week_bar)

        note = QLabel(
            "XẾP TỰ ĐỘNG CHỈ ĐƯA TRẠNG THÁI ORDER VÀ LỊCH CỐ ĐỊNH VÀO BẢNG. "
            "MỌI THAO TÁC XẾP TAY ĐƯỢC LƯU NGAY VÀ ĐỒNG BỘ VỚI CÁC TAB CƠ SỞ."
        )
        note.setObjectName("Muted")
        note.setWordWrap(True)
        layout.addWidget(note)

        toolbar_frame = QFrame()
        toolbar_frame.setObjectName("Card")
        toolbar = QGridLayout(toolbar_frame)
        toolbar.setContentsMargins(12, 10, 12, 10)
        toolbar.setHorizontalSpacing(9)
        toolbar.setVerticalSpacing(8)
        self.auto_button = make_button("XẾP THEO ORDER & LỊCH CỐ ĐỊNH", self.auto_schedule, primary=True)
        self.undo_button = make_button("HOÀN TÁC", self.undo_last_change)
        self.redo_button = make_button("LÀM LẠI", self.redo_last_change)
        self.clear_button = make_button("XÓA LỊCH TUẦN", self.clear_schedule, danger=True)
        self.autosave_label = QLabel("TỰ ĐỘNG LƯU")
        self.autosave_label.setMinimumWidth(150)
        self.autosave_label.setAlignment(Qt.AlignCenter)
        self.autosave_label.setStyleSheet(
            "background:#DCFCE7; color:#166534; border:1px solid #86EFAC; border-radius:7px; padding:9px 12px;"
        )
        toolbar.addWidget(self.auto_button, 0, 0)
        toolbar.addWidget(self.undo_button, 0, 1)
        toolbar.addWidget(self.redo_button, 0, 2)
        toolbar.addWidget(self.clear_button, 0, 3)
        toolbar.addWidget(self.autosave_label, 0, 4)
        toolbar.setColumnStretch(5, 1)
        layout.addWidget(toolbar_frame)

        filters_frame = QFrame()
        filters_frame.setObjectName("Card")
        filters = QGridLayout(filters_frame)
        filters.setContentsMargins(12, 10, 12, 10)
        filters.setHorizontalSpacing(10)
        filters.setVerticalSpacing(9)
        self.search = QLineEdit()
        self.search.setPlaceholderText("TÌM MÃ HOẶC TÊN NHÂN VIÊN")
        self.search.setMinimumWidth(330)
        self.search.setMinimumHeight(42)
        self.rank_filter = QComboBox()
        self.rank_filter.addItem("TẤT CẢ PHÂN CẤP", "")
        for value in RANKS:
            self.rank_filter.addItem(value, value)
        self.branch_filter = QComboBox()
        self.branch_filter.addItem("TẤT CẢ CƠ SỞ", "")
        for branch in self.branches:
            self.branch_filter.addItem(str(branch["ui_code"]), str(branch["code"]))
        self.role_filter = QComboBox()
        self.role_filter.addItem("TẤT CẢ VỊ TRÍ", "")
        for role in ROLES:
            self.role_filter.addItem(role, role)
        self.state_filter = QComboBox()
        for label, data in [
            ("TẤT CẢ TRẠNG THÁI", ""),
            ("CHƯA ĐƯỢC XẾP", "unassigned"),
            ("ĐÃ ĐƯỢC XẾP", "assigned"),
            ("CÓ CA NGHỈ", "off"),
            ("CHƯA ORDER", "no_order"),
            ("CÓ LỊCH CỐ ĐỊNH", "fixed"),
            ("QUẢN LÝ ĐÃ SỬA", "manual"),
        ]:
            self.state_filter.addItem(label, data)
        for combo in [self.rank_filter, self.branch_filter, self.role_filter, self.state_filter]:
            combo.setMinimumWidth(200)
            combo.setMinimumHeight(42)
        filters.addWidget(self.search, 0, 0, 1, 2)
        filters.addWidget(self.rank_filter, 0, 2)
        filters.addWidget(self.branch_filter, 0, 3)
        filters.addWidget(self.role_filter, 1, 0)
        filters.addWidget(self.state_filter, 1, 1, 1, 2)
        filters.setColumnStretch(4, 1)
        layout.addWidget(filters_frame)

        staffing_legend = QLabel(
            "<b>GHI CHÚ BẢNG TỔNG ĐỊNH BIÊN:</b> "
            "SỐ HIỂN THỊ = <b>THỰC TẾ / ĐỊNH BIÊN</b> &nbsp; "
            "<span style='background:#DCFCE7;color:#166534;padding:4px 8px;'>XANH: ĐÚNG</span> &nbsp; "
            "<span style='background:#FEE2E2;color:#991B1B;padding:4px 8px;'>ĐỎ: THIẾU</span> &nbsp; "
            "<span style='background:#FEF3C7;color:#92400E;padding:4px 8px;'>VÀNG: VƯỢT</span> &nbsp; "
            "<span style='background:#FFEDD5;color:#9A3412;padding:4px 8px;'>CAM: SAI CƠ CẤU PC/CB HOẶC THIẾU QL/CẤP 1</span>"
        )
        staffing_legend.setTextFormat(Qt.RichText)
        staffing_legend.setWordWrap(True)
        staffing_legend.setStyleSheet(
            "background:#FFFFFF; color:#0F172A; border:1px solid #CBD5E1; border-radius:8px; padding:9px 12px;"
        )
        layout.addWidget(staffing_legend)

        summary_frame = QFrame()
        summary_frame.setObjectName("Card")
        summary_layout = QHBoxLayout(summary_frame)
        summary_layout.setContentsMargins(0, 0, 0, 0)
        summary_layout.setSpacing(0)
        summary_rows = 1 + len(self.branches)
        schedule_columns = 7 * len(self.shifts)
        self.summary_left = QTableWidget(summary_rows, 1)
        self.summary_left.setHorizontalHeaderLabels(["CƠ SỞ"])
        self.summary_left.verticalHeader().setVisible(False)
        self.summary_left.setFixedWidth(205)
        self.summary_left.setFixedHeight(218)
        self.summary_left.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.summary_left.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.summary_left.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.summary_left.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        labels = ["TOÀN HỆ THỐNG"] + [
            f"{branch['ui_code']} – {branch['name']}" for branch in self.branches
        ]
        for row, label in enumerate(labels):
            item = QTableWidgetItem(label)
            item.setTextAlignment(Qt.AlignCenter)
            self.summary_left.setItem(row, 0, item)
            self.summary_left.setRowHeight(row, 33)

        headers = [f"{day}\n{shift}" for day in WEEKDAY_NAMES for shift in self.shifts]
        self.summary_right = QTableWidget(summary_rows, schedule_columns)
        self.summary_right.setHorizontalHeaderLabels(headers)
        self.summary_right.verticalHeader().setVisible(False)
        self.summary_right.setFixedHeight(218)
        self.summary_right.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.summary_right.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.summary_right.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.summary_right.horizontalHeader().setMinimumSectionSize(118)
        self.summary_right.horizontalHeader().setDefaultSectionSize(132)
        self.summary_right.horizontalHeader().setMinimumHeight(78)
        for row in range(summary_rows):
            self.summary_right.setRowHeight(row, 33)
        summary_layout.addWidget(self.summary_left)
        summary_layout.addWidget(self.summary_right, 1)
        layout.addWidget(summary_frame)

        schedule_legend = QLabel(
            "<b>CHÚ GIẢI BẢNG LỊCH:</b> "
            "<span style='background:#DCFCE7;color:#166534;padding:4px 8px;'>XANH: ĐI LÀM ĐƯỢC – CHƯA XẾP</span> &nbsp; "
            "<span style='background:#FEE2E2;color:#991B1B;padding:4px 8px;'>ĐỎ: NGHỈ</span> &nbsp; "
            "<span style='background:#E5E7EB;color:#4B5563;padding:4px 8px;'>XÁM: CHƯA ORDER</span> &nbsp; "
            "<span style='background:#FEF3C7;color:#92400E;padding:4px 8px;'>VÀNG: ĐÃ XẾP CA</span> &nbsp; "
            "<b>CĐ</b>: LỊCH CỐ ĐỊNH &nbsp; <span style='color:#DC2626;'>●</span>: QUẢN LÝ ĐÃ SỬA &nbsp; "
            "<span style='color:#B91C1C;'>⚠ VIỀN ĐỎ</span>: DỮ LIỆU CẦN KIỂM TRA"
        )
        schedule_legend.setTextFormat(Qt.RichText)
        schedule_legend.setWordWrap(True)
        schedule_legend.setStyleSheet(
            "background:#FFFFFF; color:#0F172A; border:1px solid #CBD5E1; border-radius:8px; padding:9px 12px;"
        )
        layout.addWidget(schedule_legend)

        table_frame = QFrame()
        table_frame.setObjectName("Card")
        table_layout = QHBoxLayout(table_frame)
        table_layout.setContentsMargins(0, 0, 0, 0)
        table_layout.setSpacing(0)
        self.info_table = QTableWidget(0, 5)
        self.info_table.setHorizontalHeaderLabels(["STT", "MÃ NV", "TÊN NHÂN VIÊN", "PHÂN CẤP", "TỔNG CA"])
        self.info_table.verticalHeader().setVisible(False)
        self.info_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.info_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.info_table.setAlternatingRowColors(True)
        self.info_table.setFixedWidth(650)
        self.info_table.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.info_table.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.info_table.setColumnWidth(0, 56)
        self.info_table.setColumnWidth(1, 105)
        self.info_table.setColumnWidth(2, 285)
        self.info_table.setColumnWidth(3, 120)
        self.info_table.setColumnWidth(4, 82)
        self.info_table.horizontalHeader().setMinimumHeight(58)

        self.schedule_table = QTableWidget(0, schedule_columns)
        self.schedule_table.setHorizontalHeaderLabels(headers)
        self.schedule_table.verticalHeader().setVisible(False)
        self.schedule_table.setAlternatingRowColors(False)
        self.schedule_table.setSelectionBehavior(QAbstractItemView.SelectItems)
        self.schedule_table.horizontalHeader().setMinimumSectionSize(128)
        self.schedule_table.horizontalHeader().setDefaultSectionSize(142)
        self.schedule_table.horizontalHeader().setMinimumHeight(78)
        table_layout.addWidget(self.info_table)
        table_layout.addWidget(self.schedule_table, 1)
        layout.addWidget(table_frame, 1)

        self.schedule_table.verticalScrollBar().valueChanged.connect(self.info_table.verticalScrollBar().setValue)
        self.info_table.verticalScrollBar().valueChanged.connect(self.schedule_table.verticalScrollBar().setValue)
        self.schedule_table.horizontalScrollBar().valueChanged.connect(self.summary_right.horizontalScrollBar().setValue)

        self.search.textChanged.connect(self.refresh)
        self.rank_filter.currentIndexChanged.connect(self.refresh)
        self.branch_filter.currentIndexChanged.connect(self.refresh)
        self.role_filter.currentIndexChanged.connect(self.refresh)
        self.state_filter.currentIndexChanged.connect(self.refresh)

    def _update_day_headers(self, week_id: int | None) -> None:
        day_labels = week_day_headers(self.db, int(week_id) if week_id else None)
        for day_index, day_label in enumerate(day_labels):
            for shift_index, shift in enumerate(self.shifts):
                column = day_index * max(1, len(self.shifts)) + shift_index
                text = f"{day_label}\n{shift.upper()}"
                for table in (self.summary_right, self.schedule_table):
                    if column >= table.columnCount():
                        continue
                    item = table.horizontalHeaderItem(column) or QTableWidgetItem()
                    item.setText(text)
                    item.setTextAlignment(Qt.AlignCenter)
                    table.setHorizontalHeaderItem(column, item)

    def _default_cell(self) -> dict[str, Any]:
        return {
            "base_status": "CHƯA TẠO",
            "state": "CHƯA TẠO",
            "branch_id": None,
            "branch_code": None,
            "role": None,
            "source": "",
            "is_manual": False,
        }

    def _cell(self, employee_id: int, weekday: int, shift: str) -> dict[str, Any]:
        return dict(self.matrix.get(employee_id, {}).get((weekday, shift), self._default_cell()))

    def _employee_matches_state(self, employee_id: int, state_filter: str) -> bool:
        if not state_filter:
            return True
        cells = self.matrix.get(employee_id, {}).values()
        if state_filter == "assigned":
            return any(cell["state"] == "ĐÃ XẾP" for cell in cells)
        if state_filter == "unassigned":
            return not any(cell["state"] == "ĐÃ XẾP" for cell in cells)
        if state_filter == "off":
            return any(cell["base_status"] == "NGHỈ" for cell in cells)
        if state_filter == "no_order":
            return any(cell["base_status"] == "CHƯA ORDER" for cell in cells)
        if state_filter == "fixed":
            return any(cell["source"] == "FIXED" for cell in cells)
        if state_filter == "manual":
            return any(cell["is_manual"] for cell in cells)
        return True

    def _cell_error(self, employee: Any, shift: str, cell: dict[str, Any]) -> str:
        if cell.get("state") != "ĐÃ XẾP":
            return ""
        if cell.get("base_status") == "NGHỈ":
            return "NHÂN VIÊN ĐƯỢC XẾP VÀO CA ĐÃ ĐĂNG KÝ NGHỈ."
        if str(employee["status"]) != "Đang làm":
            return "NHÂN VIÊN ĐÃ NGỪNG LÀM."
        branch_code = str(cell.get("branch_code") or "")
        aliases = {item.casefold() for item in parse_csv(employee["branches"])}
        branch = next(
            (
                row for row in self.db.list_branches(active_only=False)
                if branch_code.casefold() in {
                    str(row["code"]).casefold(), str(row["ui_code"]).casefold(), str(row["internal_code"]).casefold()
                }
            ),
            None,
        )
        if branch is None:
            return "CƠ SỞ KHÔNG CÒN TỒN TẠI."
        branch_aliases = {
            str(branch["code"]).casefold(), str(branch["ui_code"]).casefold(), str(branch["internal_code"]).casefold()
        }
        if not aliases.intersection(branch_aliases):
            return "NHÂN VIÊN KHÔNG ĐƯỢC KHAI BÁO TẠI CƠ SỞ NÀY."
        if cell.get("role") not in parse_csv(employee["roles"]):
            return "NHÂN VIÊN KHÔNG ĐƯỢC KHAI BÁO VỊ TRÍ NÀY."
        if not self.db.branch_uses_shift(int(branch["id"]), shift):
            return "CA NÀY ĐÃ BỊ TẮT TẠI CƠ SỞ."
        return ""

    def _style_combo(self, combo: QComboBox, employee: Any, shift: str, cell: dict[str, Any]) -> None:
        error = self._cell_error(employee, shift, cell)
        state = cell.get("state")
        if state == "ĐÃ XẾP":
            background, foreground, border = "#FEF3C7", "#92400E", "#F59E0B"
        elif state == "NGHỈ":
            background, foreground, border = "#FEE2E2", "#991B1B", "#FCA5A5"
        elif state == "CHƯA ORDER":
            background, foreground, border = "#E5E7EB", "#4B5563", "#9CA3AF"
        elif state == "TRỐNG":
            background, foreground, border = "#DCFCE7", "#166534", "#86EFAC"
        else:
            background, foreground, border = "#F8FAFC", "#64748B", "#CBD5E1"
        border_width = 2 if error else 1
        border_color = "#DC2626" if error else border
        combo.setStyleSheet(
            "QComboBox {"
            f"background:{background}; color:{foreground}; border:{border_width}px solid {border_color}; "
            "border-radius:6px; padding:7px 9px; font-weight:800; min-height:28px;"
            "}"
            "QComboBox QAbstractItemView {background:#FFFFFF; color:#0F172A; border:1px solid #64748B; "
            "selection-background-color:#DBEAFE; selection-color:#1E3A8A; min-width:250px;}"
        )

    def _configure_combo(
        self,
        combo: QComboBox,
        employee: Any,
        employee_id: int,
        weekday: int,
        shift: str,
        cell: dict[str, Any],
    ) -> None:
        combo.blockSignals(True)
        combo.clear()
        combo.setMinimumWidth(132)
        combo.setMinimumHeight(44)
        state = cell.get("state")
        if state == "CHƯA TẠO":
            combo.addItem("CHƯA TẠO LỊCH", "__BASE__")
            combo.setEnabled(False)
        else:
            combo.setEnabled(True)
            if state == "NGHỈ":
                combo.addItem("NGHỈ", "__BASE__")
            elif state == "CHƯA ORDER":
                combo.addItem("CHƯA ORDER", "__BASE__")
            elif state == "TRỐNG":
                combo.addItem("ĐI LÀM ĐƯỢC", "__BASE__")
            combo.addItem("ĐỂ TRỐNG", "")
            for label, data in assignment_options(self.db, employee, shift):
                combo.addItem(label, data)
            if state == "ĐÃ XẾP":
                wanted = f"{cell['branch_code']}|{cell['role']}"
                index = combo.findData(wanted)
                if index < 0:
                    combo.addItem(short_assignment(str(cell["branch_code"]), str(cell["role"])), wanted)
                    index = combo.findData(wanted)
                marker_parts: list[str] = []
                if cell.get("source") == "FIXED":
                    marker_parts.append("CĐ")
                if cell.get("is_manual"):
                    marker_parts.append("●")
                if self._cell_error(employee, shift, cell):
                    marker_parts.append("⚠")
                prefix = " ".join(marker_parts)
                label = short_assignment(str(cell["branch_code"]), str(cell["role"]))
                combo.setItemText(index, f"{prefix} {label}".strip())
                combo.setCurrentIndex(index)
            else:
                base_index = combo.findData("__BASE__")
                combo.setCurrentIndex(base_index if base_index >= 0 else 0)
                if cell.get("is_manual") and base_index >= 0:
                    combo.setItemText(base_index, "● " + combo.itemText(base_index))
        error = self._cell_error(employee, shift, cell)
        if state == "ĐÃ XẾP":
            source = "LỊCH CỐ ĐỊNH" if cell.get("source") == "FIXED" else "QUẢN LÝ XẾP"
            tooltip = (
                f"{full_assignment(str(cell['branch_code']), str(cell['role']))}\n"
                f"NGUỒN: {source}\nORDER: {cell.get('base_status')}"
            )
            if cell.get("is_manual"):
                tooltip += "\n● QUẢN LÝ ĐÃ SỬA THỦ CÔNG"
            if error:
                tooltip += f"\n⚠ {error}"
            combo.setToolTip(tooltip)
        elif state == "NGHỈ":
            combo.setToolTip("NHÂN VIÊN ĐĂNG KÝ NGHỈ. VẪN CÓ THỂ XẾP NGOẠI LỆ SAU KHI XÁC NHẬN.")
        elif state == "CHƯA ORDER":
            combo.setToolTip("NHÂN VIÊN CHƯA ORDER CA NÀY.")
        else:
            combo.setToolTip("NHÂN VIÊN ĐI LÀM ĐƯỢC NHƯNG CHƯA ĐƯỢC XẾP.")
        self._style_combo(combo, employee, shift, cell)
        week_id = self.week_getter()
        if week_id and self.db.is_week_closed(int(week_id)):
            combo.setEnabled(False)
        combo.blockSignals(False)

    def _combo_changed(self, employee_id: int, weekday: int, shift: str, combo: QComboBox) -> None:
        if self._refreshing:
            return
        week_id = self.week_getter()
        if not week_id:
            return
        data = combo.currentData()
        if data == "__BASE__":
            return
        old_cell = self._cell(employee_id, weekday, shift)
        branch_code: str | None = None
        role: str | None = None
        if data:
            branch_code, role = str(data).split("|", 1)
            if old_cell.get("base_status") == "NGHỈ" and not confirm(
                self, "XẾP LỊCH NGOẠI LỆ", "NHÂN VIÊN ĐÃ ĐĂNG KÝ NGHỈ CA NÀY. XÁC NHẬN VẪN XẾP LỊCH?"
            ):
                self._configure_combo(combo, self.employee_by_id[employee_id], employee_id, weekday, shift, old_cell)
                return
            if old_cell.get("base_status") == "CHƯA ORDER" and not confirm(
                self, "NHÂN VIÊN CHƯA ORDER", "NHÂN VIÊN CHƯA ORDER CA NÀY. XÁC NHẬN VẪN XẾP LỊCH?"
            ):
                self._configure_combo(combo, self.employee_by_id[employee_id], employee_id, weekday, shift, old_cell)
                return
        self.autosave_label.setText("ĐANG LƯU…")
        self.autosave_label.setStyleSheet(
            "background:#FEF3C7; color:#92400E; border:1px solid #F59E0B; border-radius:7px; padding:9px 12px;"
        )
        try:
            self.db.save_manual_schedule_cell(int(week_id), employee_id, weekday, shift, branch_code, role)
        except DatabaseError as exc:
            self.autosave_label.setText("LỖI LƯU")
            warning(self, "KHÔNG THỂ CẬP NHẬT", str(exc))
            self._configure_combo(combo, self.employee_by_id[employee_id], employee_id, weekday, shift, old_cell)
            return
        self.matrix = self.db.get_week_schedule_matrix(int(week_id))
        new_cell = self._cell(employee_id, weekday, shift)
        self._undo_stack.append((employee_id, weekday, shift, old_cell, new_cell))
        self._redo_stack.clear()
        self.autosave_label.setText("ĐÃ LƯU")
        self.autosave_label.setStyleSheet(
            "background:#DCFCE7; color:#166534; border:1px solid #86EFAC; border-radius:7px; padding:9px 12px;"
        )
        self._configure_combo(combo, self.employee_by_id[employee_id], employee_id, weekday, shift, new_cell)
        self._update_employee_total(employee_id)
        self.refresh_summary()
        self.data_changed.emit()
        if self.state_filter.currentData():
            self.refresh()

    def _update_employee_total(self, employee_id: int) -> None:
        for row_index, employee in enumerate(self.visible_employees):
            if int(employee["id"]) == employee_id:
                count = sum(1 for cell in self.matrix.get(employee_id, {}).values() if cell["state"] == "ĐÃ XẾP")
                item = QTableWidgetItem(str(count))
                item.setTextAlignment(Qt.AlignCenter)
                self.info_table.setItem(row_index, 4, item)
                break

    def undo_last_change(self) -> None:
        if not self._undo_stack:
            warning(self, "KHÔNG CÓ THAO TÁC", "CHƯA CÓ THAY ĐỔI NÀO ĐỂ HOÀN TÁC.")
            return
        week_id = self.week_getter()
        if not week_id:
            return
        employee_id, weekday, shift, old_cell, new_cell = self._undo_stack.pop()
        try:
            self.db.restore_week_schedule_cell(int(week_id), employee_id, weekday, shift, old_cell)
        except DatabaseError as exc:
            warning(self, "KHÔNG THỂ HOÀN TÁC", str(exc))
            return
        self._redo_stack.append((employee_id, weekday, shift, old_cell, new_cell))
        self.autosave_label.setText("ĐÃ HOÀN TÁC")
        self.refresh()
        self.data_changed.emit()

    def redo_last_change(self) -> None:
        if not self._redo_stack:
            warning(self, "KHÔNG CÓ THAO TÁC", "CHƯA CÓ THAY ĐỔI NÀO ĐỂ LÀM LẠI.")
            return
        week_id = self.week_getter()
        if not week_id:
            return
        employee_id, weekday, shift, old_cell, new_cell = self._redo_stack.pop()
        try:
            self.db.restore_week_schedule_cell(int(week_id), employee_id, weekday, shift, new_cell)
        except DatabaseError as exc:
            warning(self, "KHÔNG THỂ LÀM LẠI", str(exc))
            return
        self._undo_stack.append((employee_id, weekday, shift, old_cell, new_cell))
        self.autosave_label.setText("ĐÃ LÀM LẠI")
        self.refresh()
        self.data_changed.emit()

    def auto_schedule(self) -> None:
        week_id = self.week_getter()
        if not week_id:
            warning(self, "CHƯA CHỌN TUẦN", "TẠO VÀ CHỌN TUẦN TRƯỚC KHI XẾP LỊCH.")
            return
        if self.db.week_schedule_exists(int(week_id)) and not confirm(
            self,
            "XẾP LẠI LỊCH TỰ ĐỘNG",
            "CHẠY LẠI SẼ XÓA CÁC CHỈNH SỬA THỦ CÔNG CỦA TUẦN VÀ TẠO LẠI TỪ ORDER + LỊCH CỐ ĐỊNH. TIẾP TỤC?",
        ):
            return
        try:
            result = self.db.apply_auto_schedule(int(week_id))
        except DatabaseError as exc:
            warning(self, "KHÔNG THỂ XẾP LỊCH", str(exc))
            return
        self._undo_stack.clear()
        self._redo_stack.clear()
        self.refresh()
        self.data_changed.emit()
        info(
            self,
            "ĐÃ XẾP LỊCH TỰ ĐỘNG",
            f"NHÂN VIÊN: {result['employees']}\nCA NGHỈ: {result['off']}\n"
            f"Ô CHƯA ORDER: {result['no_order']}\nCA CỐ ĐỊNH ĐƯỢC ÁP DỤNG: {result['fixed']}",
        )

    def clear_schedule(self) -> None:
        week_id = self.week_getter()
        if not week_id or not self.db.week_schedule_exists(int(week_id)):
            warning(self, "CHƯA CÓ LỊCH", "TUẦN NÀY CHƯA CÓ LỊCH TỔNG ĐỂ XÓA.")
            return
        if not confirm(self, "XÓA LỊCH TỔNG", "XÓA TOÀN BỘ LỊCH TỔNG CỦA TUẦN? ORDER VÀ LỊCH CỐ ĐỊNH KHÔNG BỊ XÓA."):
            return
        try:
            self.db.clear_week_schedule(int(week_id))
        except DatabaseError as exc:
            warning(self, "KHÔNG THỂ XÓA LỊCH", str(exc))
            return
        self._undo_stack.clear()
        self._redo_stack.clear()
        self.refresh()
        self.data_changed.emit()

    def refresh_lock_state(self) -> None:
        week_id = self.week_getter()
        closed = bool(week_id and self.db.is_week_closed(int(week_id)))
        status = self.db.week_schedule_status(int(week_id)) if week_id else "CHƯA CHỌN TUẦN"
        self.status_label.setText(f"TRẠNG THÁI: {status}")
        if closed:
            self.status_label.setStyleSheet(
                "background:#DCFCE7; color:#166534; border:1px solid #22C55E; border-radius:7px; padding:9px 12px;"
            )
        else:
            self.status_label.setStyleSheet(
                "background:#FEF3C7; color:#92400E; border:1px solid #F59E0B; border-radius:7px; padding:9px 12px;"
            )
        self.auto_button.setEnabled(not closed)
        self.clear_button.setEnabled(not closed)
        self.undo_button.setEnabled(not closed and bool(self._undo_stack))
        self.redo_button.setEnabled(not closed and bool(self._redo_stack))

    @staticmethod
    def _summary_color(data: dict[str, Any]) -> tuple[str, str, str]:
        if data["required"] == 0 and data["actual"] == 0:
            return "—", "#FFFFFF", "#64748B"
        if data["actual"] < data["required"]:
            return f"{data['actual']}/{data['required']}", "#FEE2E2", "#991B1B"
        if data["actual"] > data["required"]:
            return f"{data['actual']}/{data['required']}", "#FEF3C7", "#92400E"
        role_mismatch = any(
            int(data["roles"].get(role, 0)) != int(data["role_required"].get(role, 0)) for role in ROLES
        )
        if role_mismatch or (data["actual"] > 0 and data["senior"] == 0):
            return f"{data['actual']}/{data['required']}", "#FFEDD5", "#9A3412"
        return f"{data['actual']}/{data['required']}", "#DCFCE7", "#166534"

    def refresh_summary(self) -> None:
        week_id = self.week_getter()
        if not week_id or not self.db.week_schedule_exists(int(week_id)):
            for row in range(1 + len(self.branches)):
                for col in range(7 * len(self.shifts)):
                    item = QTableWidgetItem("—")
                    item.setTextAlignment(Qt.AlignCenter)
                    item.setBackground(QColor("#FFFFFF"))
                    item.setForeground(QColor("#64748B"))
                    self.summary_right.setItem(row, col, item)
            return
        summary = self.db.week_schedule_summary(int(week_id))
        col = 0
        for weekday in range(7):
            for shift in self.shifts:
                chain = summary["chain"][(weekday, shift)]
                chain_item = QTableWidgetItem(f"{chain['actual']}/{chain['required']}" if chain["required"] or chain["actual"] else "—")
                chain_item.setTextAlignment(Qt.AlignCenter)
                if not chain["required"] and not chain["actual"]:
                    chain_item.setBackground(QColor("#FFFFFF")); chain_item.setForeground(QColor("#64748B"))
                elif chain["actual"] < chain["required"]:
                    chain_item.setBackground(QColor("#FEE2E2")); chain_item.setForeground(QColor("#991B1B"))
                elif chain["actual"] > chain["required"]:
                    chain_item.setBackground(QColor("#FEF3C7")); chain_item.setForeground(QColor("#92400E"))
                else:
                    chain_item.setBackground(QColor("#DCFCE7")); chain_item.setForeground(QColor("#166534"))
                self.summary_right.setItem(0, col, chain_item)
                for row_index, branch in enumerate(self.branches, start=1):
                    branch_code = str(branch["code"])
                    data = summary["branches"][(branch_code, weekday, shift)]
                    text, bg, fg = self._summary_color(data)
                    item = QTableWidgetItem(text)
                    item.setTextAlignment(Qt.AlignCenter)
                    item.setBackground(QColor(bg))
                    item.setForeground(QColor(fg))
                    item.setToolTip(
                        f"{branch['ui_code']} – {WEEKDAY_NAMES[weekday]} – CA {shift}\n"
                        f"TỔNG: {data['actual']}/{data['required']}\n"
                        f"PHA CHẾ: {data['roles']['Pha chế']}/{data['role_required']['Pha chế']}\n"
                        f"CHẠY BÀN: {data['roles']['Chạy bàn']}/{data['role_required']['Chạy bàn']}\n"
                        f"QUẢN LÝ/CẤP 1: {data['senior']}"
                    )
                    self.summary_right.setItem(row_index, col, item)
                col += 1

    def refresh(self) -> None:
        if self._refreshing:
            return
        self._refreshing = True
        try:
            week_id = self.week_getter()
            self.week_bar.refresh()
            self._update_day_headers(week_id)
            exists = bool(week_id and self.db.week_schedule_exists(int(week_id)))
            self.matrix = self.db.get_week_schedule_matrix(int(week_id)) if exists else {}
            employees = self.db.list_employees(
                search=self.search.text(),
                rank=self.rank_filter.currentData() or "",
                branch_code=self.branch_filter.currentData() or "",
                status="Đang làm",
                role=self.role_filter.currentData() or "",
            )
            state_filter = self.state_filter.currentData() or ""
            self.visible_employees = [
                employee for employee in employees if self._employee_matches_state(int(employee["id"]), state_filter)
            ]
            self.employee_by_id = {int(employee["id"]): employee for employee in employees}
            self.combos.clear()
            self.info_table.setRowCount(len(self.visible_employees))
            self.schedule_table.setRowCount(len(self.visible_employees))
            for row_index, employee in enumerate(self.visible_employees):
                employee_id = int(employee["id"])
                total = sum(1 for cell in self.matrix.get(employee_id, {}).values() if cell["state"] == "ĐÃ XẾP")
                left_values = [row_index + 1, employee["code"], employee["name"], employee["rank"], total]
                for col, value in enumerate(left_values):
                    item = QTableWidgetItem(str(value))
                    item.setTextAlignment(Qt.AlignCenter if col in (0, 1, 3, 4) else Qt.AlignVCenter | Qt.AlignLeft)
                    item.setToolTip(str(value))
                    self.info_table.setItem(row_index, col, item)
                col = 0
                for weekday in range(7):
                    for shift in self.shifts:
                        cell = self._cell(employee_id, weekday, shift)
                        combo = QComboBox()
                        self._configure_combo(combo, employee, employee_id, weekday, shift, cell)
                        combo.currentIndexChanged.connect(
                            lambda _index, eid=employee_id, wd=weekday, sh=shift, cb=combo: self._combo_changed(eid, wd, sh, cb)
                        )
                        self.schedule_table.setCellWidget(row_index, col, combo)
                        self.combos[(employee_id, weekday, shift)] = combo
                        col += 1
                self.info_table.setRowHeight(row_index, 52)
                self.schedule_table.setRowHeight(row_index, 52)
            self.refresh_summary()
            self.refresh_lock_state()
        finally:
            self._refreshing = False

class AddOverstaffRowDialog(QDialog):
    def __init__(self, parent: QWidget, shifts: list[str]) -> None:
        super().__init__(parent)
        self.setWindowTitle("Thêm nhân viên vượt định biên")
        self.setMinimumWidth(520)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 22, 24, 20)
        layout.setSpacing(16)
        title = QLabel("THÊM DÒNG VƯỢT ĐỊNH BIÊN")
        title.setObjectName("PageTitle")
        layout.addWidget(title)
        note = QLabel(
            "Chọn đúng ngày, ca và vị trí cần thêm. Dòng mới chỉ dùng cho ô đã chọn và được đánh dấu vượt định biên."
        )
        note.setWordWrap(True)
        note.setObjectName("Muted")
        layout.addWidget(note)
        grid = QGridLayout()
        grid.setHorizontalSpacing(12)
        grid.setVerticalSpacing(12)
        grid.addWidget(QLabel("NGÀY"), 0, 0)
        self.day = QComboBox()
        for index, name in enumerate(WEEKDAY_NAMES):
            self.day.addItem(name, index)
        self.day.setMinimumWidth(210)
        grid.addWidget(self.day, 0, 1)
        grid.addWidget(QLabel("CA"), 1, 0)
        self.shift = QComboBox()
        for value in shifts:
            self.shift.addItem(value, value)
        grid.addWidget(self.shift, 1, 1)
        grid.addWidget(QLabel("VỊ TRÍ"), 2, 0)
        self.role = QComboBox()
        for value in ROLES:
            self.role.addItem(value, value)
        grid.addWidget(self.role, 2, 1)
        layout.addLayout(grid)
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.button(QDialogButtonBox.Ok).setText("THÊM DÒNG")
        buttons.button(QDialogButtonBox.Ok).setObjectName("Primary")
        buttons.button(QDialogButtonBox.Cancel).setText("HỦY")
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def values(self) -> tuple[int, str, str]:
        return int(self.day.currentData()), str(self.shift.currentData()), str(self.role.currentData())


class BranchSchedulePage(QWidget):
    """Bước 9: lịch theo một cơ sở, đồng bộ chung với Lịch tổng."""

    data_changed = Signal()
    week_selected = Signal(int)

    def __init__(
        self,
        db: Database,
        week_getter: Callable[[], int | None],
        branch_code: str,
    ) -> None:
        super().__init__()
        self.db = db
        self.week_getter = week_getter
        self.branch_code = branch_code
        self.branch = next(
            (row for row in self.db.list_branches(active_only=False) if str(row["code"]) == str(branch_code)),
            None,
        )
        self.branch_ui_code = str(self.branch["ui_code"]) if self.branch is not None else str(branch_code)
        self.branch_aliases = {
            str(self.branch["code"]).casefold(),
            str(self.branch["ui_code"]).casefold(),
            str(self.branch["internal_code"]).casefold(),
        } if self.branch is not None else {str(branch_code).casefold()}
        self.shifts = self.db.list_branch_shift_names(branch_code, active_only=True, enabled_only=True)
        self._refreshing = False
        self.matrix: dict[int, dict[tuple[int, str], dict[str, Any]]] = {}
        self.employees: list[Any] = []
        self.employee_by_id: dict[int, Any] = {}
        self.slot_current: dict[tuple[int, int], int | None] = {}
        self.extra_slots: dict[tuple[int, str, str], int] = {}

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 22, 24, 20)
        layout.setSpacing(14)

        title_row = QHBoxLayout()
        title = QLabel(f"XẾP LỊCH CƠ SỞ {self.branch_ui_code}")
        title.setObjectName("PageTitle")
        self.status_label = QLabel("TRẠNG THÁI: ĐANG XẾP")
        self.status_label.setMinimumWidth(220)
        self.status_label.setAlignment(Qt.AlignCenter)
        title_row.addWidget(title)
        title_row.addStretch()
        title_row.addWidget(self.status_label)
        layout.addLayout(title_row)

        self.week_bar = WeekSelectorBar(self.db, self.week_getter)
        self.week_bar.week_selected.connect(self.week_selected.emit)
        layout.addWidget(self.week_bar)

        note = QLabel(
            "MỖI Ô CHỈ HIỆN NHÂN VIÊN ĐANG LÀM, ĐƯỢC KHAI BÁO TẠI CƠ SỞ VÀ ĐÚNG VỊ TRÍ. "
            "MỌI THAY ĐỔI ĐƯỢC LƯU NGAY VÀ ĐỒNG BỘ VỚI XẾP LỊCH LÀM TỔNG."
        )
        note.setObjectName("Muted")
        note.setWordWrap(True)
        layout.addWidget(note)

        toolbar_frame = QFrame()
        toolbar_frame.setObjectName("Card")
        toolbar = QHBoxLayout(toolbar_frame)
        toolbar.setContentsMargins(14, 12, 14, 12)
        toolbar.setSpacing(12)
        self.show_off = QCheckBox("HIỆN CẢ NHÂN VIÊN ĐÃ ĐĂNG KÝ NGHỈ")
        self.show_off.stateChanged.connect(self.refresh)
        toolbar.addWidget(self.show_off)
        toolbar.addWidget(make_button("Thêm vượt định biên", self.add_overstaff_row, primary=True))
        toolbar.addWidget(make_button("Làm mới", self.refresh))
        self.autosave_label = QLabel("TỰ ĐỘNG LƯU")
        self.autosave_label.setMinimumWidth(150)
        self.autosave_label.setAlignment(Qt.AlignCenter)
        self.autosave_label.setStyleSheet(
            "background:#DCFCE7; color:#166534; border:1px solid #86EFAC; border-radius:7px; padding:9px 12px;"
        )
        toolbar.addWidget(self.autosave_label)
        toolbar.addStretch()
        layout.addWidget(toolbar_frame)

        legend = QLabel(
            "<b>CHÚ GIẢI LỊCH CƠ SỞ:</b> "
            "<span style='background:#FFFFFF;color:#475569;padding:4px 8px;border:1px solid #CBD5E1;'>TRẮNG: CHƯA XẾP</span> &nbsp; "
            "<span style='background:#FEF3C7;color:#92400E;padding:4px 8px;border:1px solid #F59E0B;'>VÀNG: ĐÃ XẾP CA</span> &nbsp; "
            "<b>CĐ</b>: LỊCH CỐ ĐỊNH &nbsp; <span style='color:#DC2626;'>●</span>: QUẢN LÝ ĐÃ SỬA &nbsp; "
            "<b>CHƯA ORDER</b>: NHÃN CẢNH BÁO &nbsp; "
            "<span style='color:#B91C1C;'>⚠ VIỀN ĐỎ</span>: NGHỈ HOẶC DỮ LIỆU CẦN KIỂM TRA"
        )
        legend.setTextFormat(Qt.RichText)
        legend.setWordWrap(True)
        legend.setStyleSheet(
            "background:#FFFFFF; color:#0F172A; border:1px solid #CBD5E1; border-radius:8px; padding:9px 12px;"
        )
        layout.addWidget(legend)

        self.table = QTableWidget(0, 9)
        self.table.setHorizontalHeaderLabels(["CA / VỊ TRÍ"] + WEEKDAY_NAMES + ["THAO TÁC"])
        self.table.verticalHeader().setVisible(False)
        self.table.setAlternatingRowColors(True)
        self.table.setSelectionMode(QAbstractItemView.NoSelection)
        self.table.setWordWrap(True)
        self.table.setColumnWidth(0, 330)
        self.table.horizontalHeader().setMinimumHeight(68)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Fixed)
        for column in range(1, 8):
            self.table.setColumnWidth(column, 175)
        self.table.setColumnWidth(8, 178)
        self.table.horizontalHeader().setSectionResizeMode(8, QHeaderView.Fixed)
        layout.addWidget(self.table, 1)

    def _update_day_headers(self, week_id: int | None) -> None:
        labels = week_day_headers(self.db, int(week_id) if week_id else None)
        for weekday, label in enumerate(labels):
            item = self.table.horizontalHeaderItem(weekday + 1) or QTableWidgetItem()
            item.setText(label)
            item.setTextAlignment(Qt.AlignCenter)
            self.table.setHorizontalHeaderItem(weekday + 1, item)

    def _employee_cell(self, employee_id: int, weekday: int, shift: str) -> dict[str, Any]:
        return self.matrix.get(employee_id, {}).get(
            (weekday, shift),
            {
                "base_status": "CHƯA ORDER",
                "state": "CHƯA ORDER",
                "branch_code": None,
                "role": None,
                "source": "",
                "is_manual": False,
            },
        )

    def _assignment_error(
        self, employee_id: int, weekday: int, shift: str, role: str, cell: dict[str, Any]
    ) -> str:
        if cell.get("state") != "ĐÃ XẾP":
            return ""
        employee = self.employee_by_id.get(employee_id)
        if employee is None:
            return "NHÂN VIÊN KHÔNG CÒN TRONG DANH SÁCH."
        if str(employee["status"]) != "Đang làm":
            return "NHÂN VIÊN ĐÃ NGỪNG LÀM."
        if cell.get("base_status") == "NGHỈ":
            return "NHÂN VIÊN ĐƯỢC XẾP VÀO CA ĐÃ ĐĂNG KÝ NGHỈ."
        if str(cell.get("branch_code") or "").casefold() not in self.branch_aliases:
            return "DỮ LIỆU ĐANG THUỘC CƠ SỞ KHÁC."
        if str(cell.get("role") or "") != role:
            return "DỮ LIỆU ĐANG THUỘC VỊ TRÍ KHÁC."
        branches = {item.casefold() for item in parse_csv(employee["branches"])}
        if not branches.intersection(self.branch_aliases):
            return "NHÂN VIÊN KHÔNG ĐƯỢC KHAI BÁO TẠI CƠ SỞ NÀY."
        if role not in parse_csv(employee["roles"]):
            return "NHÂN VIÊN KHÔNG ĐƯỢC KHAI BÁO VỊ TRÍ NÀY."
        if self.branch is None or not self.db.branch_uses_shift(int(self.branch["id"]), shift):
            return "CA NÀY ĐÃ BỊ TẮT TẠI CƠ SỞ."
        return ""

    def _eligible_employees(
        self,
        weekday: int,
        shift: str,
        role: str,
        current_employee_id: int | None,
    ) -> list[Any]:
        assigned_elsewhere: set[int] = set()
        for employee_id, cells in self.matrix.items():
            cell = cells.get((weekday, shift))
            if cell and cell["state"] == "ĐÃ XẾP":
                assigned_elsewhere.add(employee_id)
        result: list[Any] = []
        for employee in self.employees:
            employee_id = int(employee["id"])
            branches = {item.casefold() for item in parse_csv(employee["branches"])}
            roles = parse_csv(employee["roles"])
            if not branches.intersection(self.branch_aliases) or role not in roles:
                continue
            if employee_id in assigned_elsewhere and employee_id != current_employee_id:
                continue
            cell = self._employee_cell(employee_id, weekday, shift)
            if cell["base_status"] == "NGHỈ" and not self.show_off.isChecked() and employee_id != current_employee_id:
                continue
            result.append(employee)
        rank_order = {"Quản lý": 0, "Cấp 1": 1, "Cấp 2": 2, "Thử việc": 3}
        order_priority = {"ĐI LÀM ĐƯỢC": 0, "CHƯA ORDER": 1, "NGHỈ": 2}
        result.sort(
            key=lambda row: (
                order_priority.get(
                    self._employee_cell(int(row["id"]), weekday, shift)["base_status"], 9
                ),
                rank_order.get(row["rank"], 9),
                str(row["name"]).casefold(),
            )
        )
        return result

    def _new_employee_combo(
        self,
        row_index: int,
        weekday: int,
        shift: str,
        role: str,
        current_employee_id: int | None,
        slot_enabled: bool = True,
    ) -> QComboBox:
        combo = QComboBox()
        combo.setMinimumWidth(165)
        combo.setMinimumHeight(44)
        if not slot_enabled and current_employee_id is None:
            combo.addItem("— NGOÀI ĐỊNH BIÊN —", None)
            combo.setEnabled(False)
            combo.setStyleSheet(
                "QComboBox {background:#F8FAFC;color:#94A3B8;border:1px solid #CBD5E1;border-radius:6px;padding:7px;}"
            )
            return combo
        combo.addItem("ĐỂ TRỐNG", None)
        for employee in self._eligible_employees(weekday, shift, role, current_employee_id):
            employee_id = int(employee["id"])
            cell = self._employee_cell(employee_id, weekday, shift)
            base = cell["base_status"]
            prefix = "⚠ " if base == "NGHỈ" else ""
            suffix = " – CHƯA ORDER" if base == "CHƯA ORDER" else ""
            label = f"{prefix}{employee['code']} – {employee['name']} – {employee['rank']}{suffix}"
            combo.addItem(label, employee_id)
            index = combo.count() - 1
            if base == "NGHỈ":
                combo.setItemData(index, QColor("#FEE2E2"), Qt.BackgroundRole)
                combo.setItemData(index, QColor("#991B1B"), Qt.ForegroundRole)
            elif base == "CHƯA ORDER":
                combo.setItemData(index, QColor("#E5E7EB"), Qt.BackgroundRole)
                combo.setItemData(index, QColor("#4B5563"), Qt.ForegroundRole)
            else:
                combo.setItemData(index, QColor("#DCFCE7"), Qt.BackgroundRole)
                combo.setItemData(index, QColor("#166534"), Qt.ForegroundRole)
        current_cell: dict[str, Any] | None = None
        if current_employee_id is not None:
            current_cell = self._employee_cell(current_employee_id, weekday, shift)
            index = combo.findData(current_employee_id)
            if index < 0:
                employee = self.employee_by_id.get(current_employee_id)
                fallback_name = employee["name"] if employee is not None else str(current_employee_id)
                fallback_code = employee["code"] if employee is not None else ""
                combo.addItem(f"⚠ {fallback_code} – {fallback_name}", current_employee_id)
                index = combo.findData(current_employee_id)
            if index >= 0:
                markers: list[str] = []
                if current_cell.get("source") == "FIXED":
                    markers.append("CĐ")
                if current_cell.get("is_manual"):
                    markers.append("●")
                if current_cell.get("base_status") == "NGHỈ":
                    markers.append("⚠")
                employee = self.employee_by_id.get(current_employee_id)
                name = employee["name"] if employee is not None else str(current_employee_id)
                code = employee["code"] if employee is not None else ""
                combo.setItemText(index, f"{' '.join(markers)} {code} – {name}".strip())
                combo.setCurrentIndex(index)
        week_id = self.week_getter()
        if week_id and self.db.is_week_closed(int(week_id)):
            combo.setEnabled(False)
        if current_employee_id is not None and current_cell is not None:
            error_text = self._assignment_error(current_employee_id, weekday, shift, role, current_cell)
            error = bool(error_text)
            border = "#DC2626" if error else "#F59E0B"
            width = 2 if error else 1
            combo.setStyleSheet(
                "QComboBox {"
                f"background:#FEF3C7;color:#92400E;border:{width}px solid {border};"
                "border-radius:6px;padding:7px 9px;font-weight:800;}"
                "QComboBox QAbstractItemView {background:#FFFFFF;color:#0F172A;border:1px solid #64748B;"
                "selection-background-color:#DBEAFE;selection-color:#1E3A8A;min-width:320px;}"
            )
            tooltip = f"ĐÃ XẾP: {code} – {name}\nORDER: {current_cell.get('base_status')}"
            if current_cell.get("source") == "FIXED":
                tooltip += "\nCĐ: LỊCH CỐ ĐỊNH"
            if current_cell.get("is_manual"):
                tooltip += "\n● QUẢN LÝ ĐÃ SỬA"
            if current_cell.get("base_status") == "CHƯA ORDER":
                tooltip += "\nCHƯA ORDER"
            if error:
                tooltip += f"\n⚠ {error_text}"
            combo.setToolTip(tooltip)
        else:
            combo.setStyleSheet(
                "QComboBox {background:#FFFFFF;color:#0F172A;border:1px solid #94A3B8;border-radius:6px;padding:7px 9px;}"
                "QComboBox QAbstractItemView {background:#FFFFFF;color:#0F172A;border:1px solid #64748B;"
                "selection-background-color:#DBEAFE;selection-color:#1E3A8A;min-width:320px;}"
            )
        combo.currentIndexChanged.connect(
            lambda _index, row=row_index, wd=weekday, sh=shift, rl=role, cb=combo: self._slot_changed(
                row, wd, sh, rl, cb
            )
        )
        return combo

    @staticmethod
    def _summary_item(data: dict[str, Any]) -> QTableWidgetItem:
        suffix = " !" if data["actual"] > 0 and data["senior"] == 0 else ""
        item = QTableWidgetItem(f"{data['actual']}/{data['required']}{suffix}")
        item.setTextAlignment(Qt.AlignCenter)
        item.setFlags(Qt.ItemIsEnabled)
        summary_font = item.font()
        summary_font.setBold(True)
        item.setFont(summary_font)
        if data["required"] == 0 and data["actual"] == 0:
            item.setBackground(QColor("#F1F5F9"))
            item.setForeground(QColor("#475569"))
        elif data["actual"] < data["required"]:
            item.setBackground(QColor("#FEE2E2"))
            item.setForeground(QColor("#991B1B"))
        elif data["actual"] > data["required"]:
            item.setBackground(QColor("#FEF3C7"))
            item.setForeground(QColor("#92400E"))
        elif (
            any(int(data["roles"].get(role, 0)) != int(data["role_required"].get(role, 0)) for role in ROLES)
            or (data["actual"] > 0 and data["senior"] == 0)
        ):
            item.setBackground(QColor("#FFEDD5"))
            item.setForeground(QColor("#9A3412"))
        else:
            item.setBackground(QColor("#DCFCE7"))
            item.setForeground(QColor("#166534"))
        item.setToolTip(
            f"TỔNG: {data['actual']}/{data['required']}\n"
            f"PHA CHẾ: {data['roles']['Pha chế']}/{data['role_required']['Pha chế']}\n"
            f"CHẠY BÀN: {data['roles']['Chạy bàn']}/{data['role_required']['Chạy bàn']}\n"
            f"QUẢN LÝ/CẤP 1: {data['senior']}"
        )
        return item

    def _slot_changed(
        self,
        row_index: int,
        weekday: int,
        shift: str,
        role: str,
        combo: QComboBox,
    ) -> None:
        if self._refreshing:
            return
        week_id = self.week_getter()
        if not week_id:
            return
        old_employee_id = self.slot_current.get((row_index, weekday))
        new_employee_id = combo.currentData()
        new_employee_id = int(new_employee_id) if new_employee_id is not None else None
        if old_employee_id == new_employee_id:
            return

        if new_employee_id is not None:
            current_assignment = self.db.employee_assignment_at(int(week_id), new_employee_id, weekday, shift)
            if current_assignment and current_assignment.get("state") == "ĐÃ XẾP":
                current_branch = str(current_assignment.get("branch_code") or "")
                current_role = str(current_assignment.get("role") or "")
                same_slot = (
                    current_branch.casefold() in self.branch_aliases
                    and current_role == role
                    and old_employee_id == new_employee_id
                )
                if not same_slot:
                    branch_label = current_assignment.get("branch_ui_code") or current_branch
                    warning(
                        self,
                        "NHÂN VIÊN ĐÃ ĐƯỢC XẾP",
                        f"NHÂN VIÊN ĐÃ ĐƯỢC XẾP Ở {branch_label} – {current_role} TRONG CÙNG NGÀY VÀ CA. "
                        "HÃY XÓA HOẶC ĐỔI CA HIỆN TẠI TRƯỚC.",
                    )
                    self.refresh()
                    return
            cell = self._employee_cell(new_employee_id, weekday, shift)
            if cell["base_status"] == "NGHỈ":
                if not confirm(
                    self,
                    "Xếp lịch ngoại lệ",
                    "Nhân viên đã đăng ký NGHỈ ca này. Xác nhận vẫn xếp lịch?",
                ):
                    self.refresh()
                    return
            elif cell["base_status"] == "CHƯA ORDER":
                if not confirm(
                    self,
                    "Nhân viên chưa có Order",
                    "Nhân viên chưa có dữ liệu Order cho ca này. Xác nhận vẫn xếp lịch?",
                ):
                    self.refresh()
                    return
        self.autosave_label.setText("ĐANG LƯU…")
        self.autosave_label.setStyleSheet(
            "background:#FEF3C7; color:#92400E; border:1px solid #F59E0B; border-radius:7px; padding:9px 12px;"
        )
        try:
            if new_employee_id is not None:
                self.db.save_manual_schedule_cell(
                    int(week_id), new_employee_id, weekday, shift, self.branch_code, role
                )
            if old_employee_id is not None and old_employee_id != new_employee_id:
                self.db.save_manual_schedule_cell(
                    int(week_id), old_employee_id, weekday, shift, None, None
                )
        except DatabaseError as exc:
            self.autosave_label.setText("LỖI LƯU")
            self.autosave_label.setStyleSheet(
                "background:#FEE2E2; color:#991B1B; border:1px solid #FCA5A5; border-radius:7px; padding:9px 12px;"
            )
            warning(self, "Không thể cập nhật", str(exc))
            self.refresh()
            return
        self.autosave_label.setText("ĐÃ LƯU")
        self.autosave_label.setStyleSheet(
            "background:#DCFCE7; color:#166534; border:1px solid #86EFAC; border-radius:7px; padding:9px 12px;"
        )
        self.data_changed.emit()
        self.refresh()

    def add_overstaff_row(self) -> None:
        week_id = self.week_getter()
        if not week_id or not self.db.week_schedule_exists(int(week_id)):
            warning(self, "Chưa có lịch", "Hãy tạo Lịch tổng trước khi thêm nhân viên vượt định biên.")
            return
        if self.db.is_week_closed(int(week_id)):
            warning(self, "Lịch đã chốt", "Hãy mở lại lịch tại tab CHỐT LỊCH & BÁO CÁO trước khi chỉnh sửa.")
            return
        if not self.shifts:
            warning(self, "Chưa có ca", "Cơ sở này chưa bật ca làm việc nào.")
            return
        dialog = AddOverstaffRowDialog(self, self.shifts)
        if dialog.exec() != QDialog.Accepted:
            return
        weekday, shift, role = dialog.values()
        key = (weekday, shift, role)
        self.extra_slots[key] = self.extra_slots.get(key, 0) + 1
        self.refresh()

    def delete_overstaff_row(self, shift: str, role: str, slot: int) -> None:
        """Xóa phần vượt định biên của một dòng mà không đụng vào các ô định biên chính.

        Một dòng bảng trải ngang 7 ngày. Có ngày dòng này là định biên chính, có ngày lại là
        dòng vượt. Vì vậy thao tác chỉ gỡ các ô vượt của đúng chỉ số dòng; các ngày mà dòng
        vẫn thuộc định biên chính được giữ nguyên.
        """
        week_id = self.week_getter()
        if not week_id or not self.db.week_schedule_exists(int(week_id)):
            warning(self, "CHƯA CÓ LỊCH", "TUẦN ĐANG CHỌN CHƯA CÓ LỊCH ĐỂ XÓA DÒNG VƯỢT ĐỊNH BIÊN.")
            return
        week_id = int(week_id)
        if self.db.is_week_closed(week_id):
            warning(self, "LỊCH ĐÃ CHỐT", "HÃY MỞ LẠI LỊCH TRƯỚC KHI XÓA DÒNG VƯỢT ĐỊNH BIÊN.")
            return

        assignments = self.db.branch_assignments(week_id, self.branch_code)
        requirements = self.db.staffing_requirements_for_week(week_id)
        affected_days: list[int] = []
        assigned_cells: list[tuple[int, dict[str, Any]]] = []

        for weekday in range(7):
            required = int(requirements.get((self.branch_code, weekday, shift, role), 0))
            current_list = assignments.get((weekday, shift, role), [])
            current_assignment = current_list[slot] if slot < len(current_list) else None
            extra_count = int(self.extra_slots.get((weekday, shift, role), 0))
            has_extra_capacity = slot >= required and slot < required + extra_count
            has_extra_assignment = slot >= required and current_assignment is not None
            if has_extra_capacity or has_extra_assignment:
                affected_days.append(weekday)
                if current_assignment is not None:
                    assigned_cells.append((weekday, current_assignment))

        if not affected_days:
            info(self, "KHÔNG CÓ DÒNG VƯỢT", "DÒNG NÀY KHÔNG CÒN PHẦN VƯỢT ĐỊNH BIÊN ĐỂ XÓA.")
            self.refresh()
            return

        if assigned_cells:
            details = "\n".join(
                f"• {WEEKDAY_NAMES[weekday].upper()}: {row.get('code', '')} – {row.get('name', '')}"
                for weekday, row in assigned_cells
            )
            if not confirm(
                self,
                "XÓA DÒNG VƯỢT ĐỊNH BIÊN",
                "DÒNG VƯỢT ĐỊNH BIÊN ĐANG CÓ NHÂN VIÊN:\n\n"
                f"{details}\n\n"
                "XÓA DÒNG SẼ GỠ CÁC NHÂN VIÊN NÀY KHỎI CA VÀ ĐỒNG BỘ SANG LỊCH TỔNG. TIẾP TỤC?",
            ):
                return

        self.autosave_label.setText("ĐANG LƯU…")
        self.autosave_label.setStyleSheet(
            "background:#FEF3C7; color:#92400E; border:1px solid #F59E0B; border-radius:7px; padding:9px 12px;"
        )
        try:
            for weekday, row in assigned_cells:
                self.db.save_manual_schedule_cell(
                    week_id, int(row["employee_id"]), weekday, shift, None, None
                )
            for weekday in affected_days:
                key = (weekday, shift, role)
                current = int(self.extra_slots.get(key, 0))
                if current <= 1:
                    self.extra_slots.pop(key, None)
                else:
                    self.extra_slots[key] = current - 1
        except (DatabaseError, KeyError, TypeError, ValueError) as exc:
            self.autosave_label.setText("LỖI LƯU")
            self.autosave_label.setStyleSheet(
                "background:#FEE2E2; color:#991B1B; border:1px solid #FCA5A5; border-radius:7px; padding:9px 12px;"
            )
            warning(self, "KHÔNG THỂ XÓA DÒNG VƯỢT", str(exc))
            self.refresh()
            return

        self.autosave_label.setText("ĐÃ LƯU")
        self.autosave_label.setStyleSheet(
            "background:#DCFCE7; color:#166534; border:1px solid #86EFAC; border-radius:7px; padding:9px 12px;"
        )
        self.data_changed.emit()
        self.refresh()

    def refresh(self) -> None:
        if self._refreshing:
            return
        self._refreshing = True
        try:
            week_id = self.week_getter()
            self.week_bar.refresh()
            self._update_day_headers(week_id)
            if not week_id or not self.db.week_schedule_exists(int(week_id)):
                self.table.setRowCount(0)
                self.status_label.setText("CHƯA CÓ LỊCH TỔNG")
                self.status_label.setStyleSheet(
                    "background:#E5E7EB; color:#475569; border:1px solid #94A3B8; border-radius:7px; padding:9px 12px;"
                )
                return
            week_id = int(week_id)
            self.matrix = self.db.get_week_schedule_matrix(week_id)
            self.employees = self.db.list_employees(status="Đang làm")
            self.employee_by_id = {int(row["id"]): row for row in self.employees}
            assignments = self.db.branch_assignments(week_id, self.branch_code)
            requirements = self.db.staffing_requirements_for_week(week_id)
            summary = self.db.week_schedule_summary(week_id)
            closed = self.db.is_week_closed(week_id)
            status = self.db.week_schedule_status(week_id)
            self.status_label.setText(f"TRẠNG THÁI: {status}")
            self.status_label.setStyleSheet(
                ("background:#DCFCE7; color:#166534; border:1px solid #22C55E;" if closed else
                 "background:#FEF3C7; color:#92400E; border:1px solid #F59E0B;")
                + " border-radius:7px; padding:9px 12px;"
            )

            row_defs: list[dict[str, Any]] = []
            for shift in self.shifts:
                for role in ROLES:
                    max_required = max(
                        requirements.get((self.branch_code, weekday, shift, role), 0)
                        for weekday in range(7)
                    )
                    max_actual = max(
                        len(assignments.get((weekday, shift, role), []))
                        for weekday in range(7)
                    )
                    max_allowed = max(
                        requirements.get((self.branch_code, weekday, shift, role), 0)
                        + self.extra_slots.get((weekday, shift, role), 0)
                        for weekday in range(7)
                    )
                    slot_count = max(max_required, max_actual, max_allowed)
                    for slot in range(slot_count):
                        row_defs.append({"kind": "slot", "shift": shift, "role": role, "slot": slot})
                row_defs.append({"kind": "summary", "shift": shift})

            # Dựng lại toàn bộ bảng từ đầu. Khi thêm dòng vượt định biên,
            # vị trí các dòng TỔNG CA có thể dịch xuống. Nếu chỉ tăng rowCount,
            # QComboBox của dòng cũ vẫn còn phủ lên QTableWidgetItem của dòng tổng,
            # làm mất nền/màu/định dạng. Xóa toàn bộ hàng và cell widget trước khi dựng lại.
            self.table.setUpdatesEnabled(False)
            self.table.setRowCount(0)
            self.table.setRowCount(len(row_defs))
            self.slot_current.clear()
            for row_index, row_def in enumerate(row_defs):
                if row_def["kind"] == "summary":
                    shift = row_def["shift"]
                    label = QTableWidgetItem(f"TỔNG CA {shift.upper()}")
                    label.setTextAlignment(Qt.AlignCenter)
                    label.setBackground(QColor("#DBEAFE"))
                    label.setForeground(QColor("#1E3A8A"))
                    label.setFlags(Qt.ItemIsEnabled)
                    summary_font = label.font()
                    summary_font.setBold(True)
                    label.setFont(summary_font)
                    self.table.setItem(row_index, 0, label)
                    for weekday in range(7):
                        data = summary["branches"][(self.branch_code, weekday, shift)]
                        self.table.setItem(row_index, weekday + 1, self._summary_item(data))
                    action_item = QTableWidgetItem("")
                    action_item.setFlags(Qt.ItemIsEnabled)
                    action_item.setBackground(QColor("#DBEAFE"))
                    self.table.setItem(row_index, 8, action_item)
                    self.table.setRowHeight(row_index, 46)
                    continue

                shift = row_def["shift"]
                role = row_def["role"]
                slot = int(row_def["slot"])
                overstaff_days: list[int] = []
                for weekday in range(7):
                    required_for_day = int(requirements.get((self.branch_code, weekday, shift, role), 0))
                    current_list_for_day = assignments.get((weekday, shift, role), [])
                    extra_count_for_day = int(self.extra_slots.get((weekday, shift, role), 0))
                    if slot >= required_for_day and (
                        slot < required_for_day + extra_count_for_day
                        or slot < len(current_list_for_day)
                    ):
                        overstaff_days.append(weekday)
                extra_suffix = " – VƯỢT ĐỊNH BIÊN" if overstaff_days else ""
                label = QTableWidgetItem(f"{shift.upper()} – {role.upper()} {slot + 1}{extra_suffix}")
                label.setTextAlignment(Qt.AlignVCenter | Qt.AlignLeft)
                if role == "Pha chế":
                    label.setBackground(QColor("#E0F2FE"))
                    label.setForeground(QColor("#075985"))
                else:
                    label.setBackground(QColor("#F3E8FF"))
                    label.setForeground(QColor("#6B21A8"))
                self.table.setItem(row_index, 0, label)
                for weekday in range(7):
                    current_list = assignments.get((weekday, shift, role), [])
                    current_employee_id = (
                        int(current_list[slot]["employee_id"]) if slot < len(current_list) else None
                    )
                    self.slot_current[(row_index, weekday)] = current_employee_id
                    required_for_day = requirements.get(
                        (self.branch_code, weekday, shift, role), 0
                    )
                    allowed_for_day = required_for_day + self.extra_slots.get(
                        (weekday, shift, role), 0
                    )
                    slot_enabled = slot < allowed_for_day or current_employee_id is not None
                    combo = self._new_employee_combo(
                        row_index, weekday, shift, role, current_employee_id, slot_enabled
                    )
                    if slot >= required_for_day and slot_enabled:
                        combo.setToolTip((combo.toolTip() + "\n" if combo.toolTip() else "") + "DÒNG VƯỢT ĐỊNH BIÊN")
                    self.table.setCellWidget(row_index, weekday + 1, combo)
                if overstaff_days:
                    delete_button = QPushButton("XÓA DÒNG VƯỢT")
                    delete_button.setObjectName("Danger")
                    delete_button.setMinimumHeight(38)
                    delete_button.setMinimumWidth(154)
                    delete_button.setToolTip(
                        "XÓA PHẦN VƯỢT ĐỊNH BIÊN TẠI: "
                        + ", ".join(WEEKDAY_NAMES[weekday].upper() for weekday in overstaff_days)
                    )
                    delete_button.clicked.connect(
                        lambda _checked=False, sh=shift, rl=role, sl=slot: self.delete_overstaff_row(sh, rl, sl)
                    )
                    self.table.setCellWidget(row_index, 8, delete_button)
                else:
                    action_item = QTableWidgetItem("")
                    action_item.setFlags(Qt.ItemIsEnabled)
                    self.table.setItem(row_index, 8, action_item)
                self.table.setRowHeight(row_index, 52)
            self.table.setUpdatesEnabled(True)
            self.table.viewport().update()
        finally:
            # Bảo đảm bảng luôn được bật cập nhật lại kể cả khi phát sinh lỗi giữa lúc dựng bảng.
            self.table.setUpdatesEnabled(True)
            self._refreshing = False


class CloseReportPage(QWidget):
    """Bước 10: chốt lịch, báo cáo và lịch lưu trong 30 ngày."""

    data_changed = Signal()
    week_selected = Signal(int)

    def __init__(self, db: Database, week_getter: Callable[[], int | None]) -> None:
        super().__init__()
        self.db = db
        self.week_getter = week_getter
        self.shifts = self.db.list_shift_names(active_only=True, order_only=True)
        self._current_report: dict[str, Any] | None = None

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 22, 24, 20)
        layout.setSpacing(14)

        title = QLabel("CHỐT LỊCH & BÁO CÁO")
        title.setObjectName("PageTitle")
        layout.addWidget(title)
        note = QLabel(
            "KIỂM TRA TOÀN BỘ LỊCH SAU KHI ĐÃ XẾP XONG CÁC CƠ SỞ. CẢNH BÁO KHÔNG CHẶN CHỐT LỊCH. "
            "KHI CHỐT, ĐỊNH BIÊN HIỆN TẠI ĐƯỢC LƯU CÙNG TUẦN ĐÓ."
        )
        note.setWordWrap(True)
        note.setObjectName("Muted")
        layout.addWidget(note)

        action_frame = QFrame()
        action_frame.setObjectName("Card")
        action_layout = QGridLayout(action_frame)
        action_layout.setContentsMargins(16, 14, 16, 14)
        action_layout.setHorizontalSpacing(12)
        action_layout.setVerticalSpacing(10)
        self.week_info = QLabel("TUẦN: —")
        self.week_info.setMinimumWidth(280)
        self.status_label = QLabel("TRẠNG THÁI: —")
        self.status_label.setMinimumWidth(230)
        self.status_label.setAlignment(Qt.AlignCenter)
        self.closed_at_label = QLabel("CHỐT GẦN NHẤT: —")
        self.closed_at_label.setObjectName("Muted")
        action_layout.addWidget(self.week_info, 0, 0)
        action_layout.addWidget(self.status_label, 0, 1)
        action_layout.addWidget(self.closed_at_label, 0, 2, 1, 2)
        self.refresh_button = make_button("Kiểm tra lại dữ liệu", self.refresh)
        self.close_button = make_button("Chốt lịch", self.toggle_close, primary=True)
        self.close_button.setMinimumWidth(230)
        self.export_button = make_button("Xuất báo cáo Excel", self.export_current_week)
        action_layout.addWidget(self.refresh_button, 1, 0)
        action_layout.addWidget(self.close_button, 1, 1)
        action_layout.addWidget(self.export_button, 1, 2)
        action_layout.setColumnStretch(3, 1)
        layout.addWidget(action_frame)

        stats_frame = QFrame()
        stats_frame.setObjectName("Card")
        stats = QGridLayout(stats_frame)
        stats.setContentsMargins(14, 12, 14, 12)
        stats.setHorizontalSpacing(10)
        stats.setVerticalSpacing(10)
        self.stat_employees = QLabel()
        self.stat_assignments = QLabel()
        self.stat_warnings = QLabel()
        self.stat_shortage = QLabel()
        self.stat_overstaff = QLabel()
        self.stat_unassigned = QLabel()
        for index, widget in enumerate(
            [
                self.stat_employees,
                self.stat_assignments,
                self.stat_warnings,
                self.stat_shortage,
                self.stat_overstaff,
                self.stat_unassigned,
            ]
        ):
            widget.setAlignment(Qt.AlignCenter)
            widget.setMinimumHeight(46)
            widget.setStyleSheet(
                "background:#F8FAFC; color:#0F172A; border:1px solid #CBD5E1; "
                "border-radius:7px; padding:8px 10px;"
            )
            stats.addWidget(widget, index // 3, index % 3)
        layout.addWidget(stats_frame)

        self.tabs = QTabWidget()

        weekly_page = QWidget()
        weekly_layout = QVBoxLayout(weekly_page)
        weekly_layout.setContentsMargins(12, 12, 12, 12)
        weekly_layout.setSpacing(10)
        weekly_controls = QFrame()
        weekly_controls.setObjectName("Card")
        weekly_controls_layout = QHBoxLayout(weekly_controls)
        weekly_controls_layout.setContentsMargins(14, 12, 14, 12)
        weekly_controls_layout.setSpacing(10)
        self.weekly_mode = QComboBox()
        self.weekly_mode.addItem("LỊCH TỔNG THEO NHÂN VIÊN", "employee")
        self.weekly_mode.addItem("LỊCH THEO CƠ SỞ", "branch")
        self.weekly_mode.setMinimumWidth(260)
        self.weekly_mode.setMinimumHeight(42)
        self.weekly_branch = QComboBox()
        self.weekly_branch.setMinimumWidth(250)
        self.weekly_branch.setMinimumHeight(42)
        for branch in self.db.list_branches(active_only=True):
            self.weekly_branch.addItem(f"{branch['ui_code']} – {branch['name']}", str(branch['code']))
        self.weekly_employee_search = QLineEdit()
        self.weekly_employee_search.setPlaceholderText("TÌM NHANH MÃ NV / HỌ TÊN")
        self.weekly_employee_search.setMinimumWidth(300)
        self.weekly_employee_search.setMinimumHeight(42)
        self.weekly_view_title = QLabel("LỊCH TỔNG THEO NHÂN VIÊN")
        self.weekly_view_title.setStyleSheet("color:#1E3A8A;font-weight:900;font-size:15px;")
        weekly_controls_layout.addWidget(self.weekly_mode)
        weekly_controls_layout.addWidget(self.weekly_branch)
        weekly_controls_layout.addWidget(self.weekly_employee_search)
        weekly_controls_layout.addWidget(make_button("XUẤT LỊCH ĐANG XEM", self.export_weekly_view, primary=True))
        weekly_controls_layout.addStretch()
        weekly_controls_layout.addWidget(self.weekly_view_title)
        weekly_layout.addWidget(weekly_controls)

        weekly_note = QLabel(
            "LỊCH TỔNG: MỖI NHÂN VIÊN MỘT DÒNG, CHỈ 7 CỘT TỪ THỨ 2 ĐẾN CHỦ NHẬT. "
            "MỖI Ô GHI TÊN CA, TÊN CƠ SỞ ĐẦY ĐỦ VÀ VỊ TRÍ PC/CB. "
            "LỊCH CƠ SỞ: MỖI NHÂN VIÊN HIỂN THỊ CẢ MÃ VÀ TÊN; CHỈ HIỆN CÁC CA/VỊ TRÍ CÓ ĐỊNH BIÊN "
            "HOẶC ĐÃ CÓ NGƯỜI, KHÔNG TẠO DÒNG TRỐNG THỪA."
        )
        weekly_note.setObjectName("Muted")
        weekly_note.setWordWrap(True)
        weekly_layout.addWidget(weekly_note)

        self.weekly_view_table = self._new_table([])
        self.weekly_view_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.weekly_view_table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.weekly_view_table.setAlternatingRowColors(False)
        self.weekly_view_table.setWordWrap(True)
        self.weekly_view_table.horizontalHeader().setMinimumHeight(64)
        weekly_layout.addWidget(self.weekly_view_table, 1)
        self.tabs.addTab(weekly_page, "XEM LỊCH TUẦN")
        self.weekly_mode.currentIndexChanged.connect(self._weekly_mode_changed)
        self.weekly_branch.currentIndexChanged.connect(self._weekly_mode_changed)
        self.weekly_employee_search.textChanged.connect(lambda _text: self._refresh_weekly_view())
        self._weekly_mode_changed()

        warning_page = QWidget()
        warning_layout = QVBoxLayout(warning_page)
        warning_layout.setContentsMargins(12, 12, 12, 12)
        warning_layout.setSpacing(10)
        warning_controls = QHBoxLayout()
        warning_controls.addWidget(QLabel("LỌC CẢNH BÁO:"))
        self.warning_filter = QComboBox()
        self.warning_filter.addItem("TẤT CẢ CẢNH BÁO", "")
        self.warning_filter.setMinimumWidth(300)
        self.warning_filter.currentIndexChanged.connect(self._apply_warning_filter)
        warning_controls.addWidget(self.warning_filter)
        warning_controls.addStretch()
        warning_layout.addLayout(warning_controls)
        self.warning_table = self._new_table(["LOẠI CẢNH BÁO", "CHI TIẾT"])
        self.warning_table.setColumnWidth(0, 230)
        self.warning_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        warning_layout.addWidget(self.warning_table, 1)
        self._warning_rows: list[tuple[str, str]] = []
        self.tabs.addTab(warning_page, "CẢNH BÁO")

        self.staffing_table = self._new_table(
            ["CƠ SỞ", "NGÀY", "CA", "TỔNG", "ĐỊNH BIÊN", "PHA CHẾ", "CHẠY BÀN", "CẤP 1+", "TRẠNG THÁI"]
        )
        self.staffing_table.horizontalHeader().setSectionResizeMode(8, QHeaderView.Stretch)
        self.tabs.addTab(self.staffing_table, "ĐỊNH BIÊN")

        employee_headers = ["MÃ NV", "TÊN NHÂN VIÊN", "PHÂN CẤP", "TỔNG CA"] + [
            shift.upper() for shift in self.shifts
        ] + ["CƠ SỞ ĐÃ XẾP"]
        employee_filter_bar = QFrame()
        employee_filter_bar.setObjectName("Card")
        employee_filter_layout = QHBoxLayout(employee_filter_bar)
        employee_filter_layout.setContentsMargins(12, 9, 12, 9)
        employee_filter_layout.addWidget(QLabel("TÌM NHÂN VIÊN:"))
        self.employee_report_search = QLineEdit()
        self.employee_report_search.setPlaceholderText("NHẬP MÃ NV HOẶC HỌ TÊN")
        self.employee_report_search.setMinimumWidth(360)
        self.employee_report_search.textChanged.connect(self._apply_employee_report_filter)
        employee_filter_layout.addWidget(self.employee_report_search)
        employee_filter_layout.addStretch(1)
        employee_page = QWidget()
        employee_page_layout = QVBoxLayout(employee_page)
        employee_page_layout.setContentsMargins(8, 8, 8, 8)
        employee_page_layout.addWidget(employee_filter_bar)
        self.employee_table = self._new_table(employee_headers)
        report_font = QFont("Arial", 12)
        report_font.setBold(True)
        self.employee_table.setFont(report_font)
        self.employee_table.setColumnWidth(1, 230)
        self.employee_table.horizontalHeader().setSectionResizeMode(len(employee_headers) - 1, QHeaderView.Stretch)
        employee_page_layout.addWidget(self.employee_table, 1)
        self.tabs.addTab(employee_page, "NHÂN VIÊN")

        order_page = QWidget()
        order_layout = QVBoxLayout(order_page)
        order_layout.setContentsMargins(12, 12, 12, 12)
        order_layout.setSpacing(10)
        order_stats = QGridLayout()
        self.order_active = QLabel()
        self.order_with = QLabel()
        self.order_without = QLabel()
        self.order_available = QLabel()
        self.order_off = QLabel()
        for index, widget in enumerate(
            [self.order_active, self.order_with, self.order_without, self.order_available, self.order_off]
        ):
            widget.setAlignment(Qt.AlignCenter)
            widget.setMinimumHeight(42)
            widget.setStyleSheet(
                "background:#F8FAFC; color:#0F172A; border:1px solid #CBD5E1; "
                "border-radius:7px; padding:7px;"
            )
            order_stats.addWidget(widget, 0, index)
        order_layout.addLayout(order_stats)
        self.order_table = self._new_table(["NỘI DUNG", "CHI TIẾT"])
        self.order_table.setColumnWidth(0, 230)
        self.order_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        order_layout.addWidget(self.order_table, 1)
        self.tabs.addTab(order_page, "ORDER")

        self.branch_table = self._new_table(
            ["CƠ SỞ", "TỔNG CA NV", "CA ĐỦ", "CA THIẾU", "CA THỪA", "LỆCH VỊ TRÍ", "THIẾU CẤP 1+"]
        )
        self.branch_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.tabs.addTab(self.branch_table, "CƠ SỞ")

        history_page = QWidget()
        history_layout = QVBoxLayout(history_page)
        history_layout.setContentsMargins(12, 12, 12, 12)
        history_layout.setSpacing(10)
        self.history_table = self._new_table(
            ["TUẦN", "TRẠNG THÁI", "NGÀY CHỐT GẦN NHẤT", "CẢNH BÁO"]
        )
        self.history_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.history_table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.history_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self.history_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        history_layout.addWidget(self.history_table, 1)
        history_buttons = QHBoxLayout()
        history_buttons.addWidget(make_button("Xem tuần đã chọn", self.view_selected_history, primary=True))
        history_buttons.addWidget(make_button("Mở lại tuần đã chọn", self.reopen_selected_history))
        history_buttons.addWidget(make_button("Xuất tuần đã chọn", self.export_selected_history))
        history_buttons.addStretch()
        history_layout.addLayout(history_buttons)
        self.tabs.addTab(history_page, "LỊCH 30 NGÀY")

        layout.addWidget(self.tabs, 1)

    def _set_warning_rows(self, lines: list[str]) -> None:
        self._warning_rows = []
        categories: list[str] = [
            "THIẾU TỔNG", "THỪA TỔNG", "LỆCH VỊ TRÍ", "THIẾU CẤP 1+",
            "XẾP CA ĐÃ NGHỈ", "XẾP KHI CHƯA ORDER", "LÀM THÔNG 3 CA", "CHƯA CÓ CA",
        ]
        for line in lines:
            category, sep, detail = line.partition(":")
            category = category.strip() if sep else line.strip()
            detail_text = detail.strip() if sep else line.strip()
            self._warning_rows.append((category, detail_text))
            if category not in categories:
                categories.append(category)
        current = str(self.warning_filter.currentData() or "")
        self.warning_filter.blockSignals(True)
        self.warning_filter.clear()
        self.warning_filter.addItem("TẤT CẢ CẢNH BÁO", "")
        for category in categories:
            self.warning_filter.addItem(category, category)
        index = self.warning_filter.findData(current)
        self.warning_filter.setCurrentIndex(index if index >= 0 else 0)
        self.warning_filter.blockSignals(False)
        self._apply_warning_filter()

    def _apply_warning_filter(self, *args) -> None:
        if not hasattr(self, "warning_table"):
            return
        selected = str(self.warning_filter.currentData() or "") if hasattr(self, "warning_filter") else ""
        rows = [row for row in self._warning_rows if not selected or row[0] == selected]
        self.warning_table.setRowCount(len(rows))
        for index, (category, detail) in enumerate(rows):
            self._set_row(self.warning_table, index, [category, detail])

    def _weekly_mode_changed(self, *args) -> None:
        branch_mode = str(self.weekly_mode.currentData() or "employee") == "branch"
        self.weekly_branch.setEnabled(branch_mode)
        self._refresh_weekly_view()

    def _week_day_headers(self, week_id: int) -> list[str]:
        week = self.db.get_week(week_id)
        if week is None:
            return [day.upper() for day in WEEKDAY_NAMES]
        start = datetime.strptime(str(week["start_date"]), "%Y-%m-%d")
        return [
            f"{WEEKDAY_NAMES[index].upper()}\n{(start + timedelta(days=index)).strftime('%d/%m')}"
            for index in range(7)
        ]

    @staticmethod
    def _role_code(role: str) -> str:
        return "PC" if role == "Pha chế" else "CB"

    def _refresh_employee_weekly_view(self, week_id: int) -> None:
        headers = ["STT", "MÃ NV", "TÊN NHÂN VIÊN", "PHÂN CẤP", *self._week_day_headers(week_id), "TỔNG CA"]
        table = self.weekly_view_table
        table.clear()
        table.setColumnCount(len(headers))
        table.setHorizontalHeaderLabels(headers)
        rows = self.db.employee_weekly_schedule_grid(week_id)
        token = self.weekly_employee_search.text().strip().casefold() if hasattr(self, "weekly_employee_search") else ""
        if token:
            rows = [row for row in rows if token in str(row["code"]).casefold() or token in str(row["name"]).casefold()]
        table.setRowCount(len(rows))
        widths = [54, 92, 235, 112, *([205] * 7), 88]
        for index, width in enumerate(widths):
            table.setColumnWidth(index, width)
        for row_index, row in enumerate(rows):
            fixed_values = [row_index + 1, row["code"], row["name"], row["rank"]]
            for column, value in enumerate(fixed_values):
                item = QTableWidgetItem(str(value))
                item.setTextAlignment(Qt.AlignCenter if column != 2 else Qt.AlignVCenter | Qt.AlignLeft)
                item.setToolTip(str(value))
                table.setItem(row_index, column, item)
            max_lines = 1
            for weekday in range(7):
                blocks: list[str] = []
                for assignment in row["days"].get(weekday, []):
                    branch_name = str(assignment.get("branch_name") or assignment.get("branch_ui_code") or assignment.get("branch_code") or "")
                    blocks.append(
                        f"{str(assignment.get('shift') or '').upper()}\n{branch_name.upper()} – {self._role_code(str(assignment.get('role') or ''))}"
                    )
                text = "\n\n".join(blocks)
                item = QTableWidgetItem(text)
                item.setTextAlignment(Qt.AlignCenter)
                if text:
                    item.setBackground(QColor("#FEF3C7"))
                    item.setForeground(QColor("#78350F"))
                    item.setToolTip(text)
                    max_lines = max(max_lines, text.count("\n") + 1)
                else:
                    item.setBackground(QColor("#FFFFFF"))
                table.setItem(row_index, 4 + weekday, item)
            total_item = QTableWidgetItem(str(row["total"]))
            total_item.setTextAlignment(Qt.AlignCenter)
            total_item.setBackground(QColor("#DBEAFE"))
            total_item.setForeground(QColor("#1E3A8A"))
            table.setItem(row_index, 11, total_item)
            table.setRowHeight(row_index, max(54, min(150, 18 * max_lines + 18)))
        table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Fixed)
        self.weekly_view_title.setText("LỊCH TỔNG THEO NHÂN VIÊN – 7 CỘT NGÀY")

    @staticmethod
    def _rank_code(rank: str) -> str:
        return {"Quản lý": "QL", "Cấp 1": "C1", "Cấp 2": "C2", "Thử việc": "TV"}.get(rank, rank)

    def _refresh_branch_weekly_view(self, week_id: int) -> None:
        branch_code = str(self.weekly_branch.currentData() or "")
        table = self.weekly_view_table
        headers = ["CA / VỊ TRÍ", *self._week_day_headers(week_id)]
        table.clear()
        table.setColumnCount(len(headers))
        table.setHorizontalHeaderLabels(headers)
        if not branch_code:
            table.setRowCount(0)
            self.weekly_view_title.setText("CHƯA CHỌN CƠ SỞ")
            return
        branch = next((row for row in self.db.list_branches(active_only=False) if str(row["code"]) == branch_code), None)
        rows = self.db.branch_weekly_compact_grid(week_id, branch_code)
        summary = self.db.week_schedule_summary(week_id)
        row_defs: list[tuple[str, dict[str, Any]]] = []
        grouped: dict[str, list[dict[str, Any]]] = {}
        for row in rows:
            grouped.setdefault(str(row["shift"]), []).append(row)
        for shift in self.db.list_branch_shift_names(branch_code, active_only=False, enabled_only=False):
            shift_rows = grouped.get(shift, [])
            if not shift_rows:
                continue
            for row in shift_rows:
                row_defs.append(("role", row))
            row_defs.append(("summary", {"shift": shift}))
        table.setRowCount(len(row_defs))
        table.setColumnWidth(0, 235)
        for column in range(1, 8):
            table.setColumnWidth(column, 205)
        for row_index, (kind, data) in enumerate(row_defs):
            shift = str(data["shift"])
            if kind == "summary":
                label = QTableWidgetItem(f"TỔNG CA {shift.upper()}")
                label.setTextAlignment(Qt.AlignCenter)
                label.setBackground(QColor("#DBEAFE"))
                label.setForeground(QColor("#1E3A8A"))
                table.setItem(row_index, 0, label)
                for weekday in range(7):
                    cell = summary["branches"][(branch_code, weekday, shift)]
                    text = f"{cell['actual']}/{cell['required']}"
                    item = QTableWidgetItem(text)
                    item.setTextAlignment(Qt.AlignCenter)
                    if cell["actual"] < cell["required"]:
                        item.setBackground(QColor("#FEE2E2")); item.setForeground(QColor("#991B1B"))
                    elif cell["actual"] > cell["required"]:
                        item.setBackground(QColor("#FEF3C7")); item.setForeground(QColor("#92400E"))
                    elif any(cell["roles"].get(role, 0) != cell["role_required"].get(role, 0) for role in ROLES) or (cell["actual"] > 0 and cell["senior"] == 0):
                        item.setBackground(QColor("#FFEDD5")); item.setForeground(QColor("#9A3412"))
                    else:
                        item.setBackground(QColor("#DCFCE7")); item.setForeground(QColor("#166534"))
                    item.setToolTip(
                        f"TỔNG: {cell['actual']}/{cell['required']}\n"
                        f"PHA CHẾ: {cell['roles']['Pha chế']}/{cell['role_required']['Pha chế']}\n"
                        f"CHẠY BÀN: {cell['roles']['Chạy bàn']}/{cell['role_required']['Chạy bàn']}\n"
                        f"QUẢN LÝ/CẤP 1: {cell['senior']}"
                    )
                    table.setItem(row_index, weekday + 1, item)
                table.setRowHeight(row_index, 44)
                continue
            role = str(data["role"])
            label = QTableWidgetItem(f"{shift.upper()} – {role.upper()}")
            label.setTextAlignment(Qt.AlignVCenter | Qt.AlignLeft)
            label.setBackground(QColor("#E0F2FE" if role == "Pha chế" else "#F3E8FF"))
            label.setForeground(QColor("#075985" if role == "Pha chế" else "#6B21A8"))
            table.setItem(row_index, 0, label)
            max_names = 1
            for weekday in range(7):
                names: list[str] = []
                for assignment in data["days"][weekday]:
                    marker = " CĐ" if assignment.get("source") == "FIXED" else ""
                    manual = " ●" if assignment.get("is_manual") else ""
                    warning_mark = " ⚠ NGHỈ" if assignment.get("base_status") == "NGHỈ" else (" CHƯA ORDER" if assignment.get("base_status") == "CHƯA ORDER" else "")
                    names.append(
                        f"{str(assignment.get('code') or '').upper()} – {str(assignment['name']).upper()}{marker}{manual}{warning_mark}"
                    )
                text = "\n".join(names)
                item = QTableWidgetItem(text)
                item.setTextAlignment(Qt.AlignCenter)
                if text:
                    item.setBackground(QColor("#FEF3C7"))
                    item.setForeground(QColor("#78350F"))
                    if any("⚠" in value for value in names):
                        item.setBackground(QColor("#FEE2E2"))
                        item.setForeground(QColor("#991B1B"))
                    item.setToolTip(text)
                    max_names = max(max_names, len(names))
                else:
                    required = int(data["required"][weekday])
                    if required > 0:
                        item.setText(f"THIẾU {required}")
                        item.setBackground(QColor("#FEE2E2"))
                        item.setForeground(QColor("#991B1B"))
                    else:
                        item.setBackground(QColor("#FFFFFF"))
                table.setItem(row_index, weekday + 1, item)
            table.setRowHeight(row_index, max(50, min(130, 24 + max_names * 22)))
        branch_label = f"{branch['ui_code']} – {branch['name']}" if branch is not None else branch_code
        self.weekly_view_title.setText(f"LỊCH THEO CƠ SỞ: {branch_label.upper()}")

    def _refresh_weekly_view(self, week_id: int | None = None) -> None:
        if not hasattr(self, "weekly_view_table"):
            return
        if week_id is None:
            current = self.week_getter()
            week_id = int(current) if current else None
        if not week_id or not self.db.week_schedule_exists(int(week_id)):
            self.weekly_view_table.clear()
            self.weekly_view_table.setRowCount(0)
            self.weekly_view_table.setColumnCount(0)
            self.weekly_view_title.setText("CHƯA CÓ LỊCH TUẦN")
            return
        if str(self.weekly_mode.currentData() or "employee") == "branch":
            self._refresh_branch_weekly_view(int(week_id))
        else:
            self._refresh_employee_weekly_view(int(week_id))

    def export_weekly_view(self) -> None:
        week_id = self.week_getter()
        if not week_id or not self.db.week_schedule_exists(int(week_id)):
            warning(self, "CHƯA CÓ LỊCH", "TUẦN ĐANG CHỌN CHƯA CÓ LỊCH ĐỂ XUẤT.")
            return
        mode = str(self.weekly_mode.currentData() or "employee")
        default_name = "Lich_tong_theo_nhan_vien.xlsx" if mode == "employee" else f"Lich_co_so_{self.weekly_branch.currentText().split('–')[0].strip()}.xlsx"
        filename, _ = QFileDialog.getSaveFileName(self, "XUẤT LỊCH ĐANG XEM", default_name, "Excel (*.xlsx)")
        if not filename:
            return
        table = self.weekly_view_table
        wb = Workbook()
        ws = wb.active
        ws.title = "LICH_TUAN"
        headers = [table.horizontalHeaderItem(column).text() if table.horizontalHeaderItem(column) else "" for column in range(table.columnCount())]
        ws.append(headers)
        for row in range(table.rowCount()):
            ws.append([table.item(row, column).text() if table.item(row, column) else "" for column in range(table.columnCount())])
        self._style_sheet(ws)
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        for row_index in range(2, ws.max_row + 1):
            ws.row_dimensions[row_index].height = 54
        ws.freeze_panes = "E2" if mode == "employee" else "B2"
        try:
            wb.save(filename)
        except OSError as exc:
            warning(self, "KHÔNG THỂ XUẤT FILE", str(exc))
            return
        info(self, "ĐÃ XUẤT LỊCH", f"ĐÃ LƯU FILE:\n{filename}")

    @staticmethod
    def _new_table(headers: list[str]) -> QTableWidget:
        table = QTableWidget(0, len(headers))
        table.setHorizontalHeaderLabels(headers)
        table.verticalHeader().setVisible(False)
        table.setAlternatingRowColors(True)
        table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        table.setSelectionMode(QAbstractItemView.SingleSelection)
        table.setWordWrap(True)
        table.horizontalHeader().setMinimumHeight(46)
        for index in range(len(headers)):
            table.setColumnWidth(index, 135)
        return table

    @staticmethod
    def _week_text(row: Any) -> str:
        if row is None:
            return "—"
        start = datetime.strptime(row["start_date"], "%Y-%m-%d").strftime("%d/%m/%Y")
        end = datetime.strptime(row["end_date"], "%Y-%m-%d").strftime("%d/%m/%Y")
        return f"{start} – {end}"

    @staticmethod
    def _warning_summary_text(report: dict[str, Any]) -> str:
        counts = report["counts"]
        return (
            f"CA THIẾU TỔNG: {counts['shortage']}\n"
            f"CA THỪA TỔNG: {counts['overstaff']}\n"
            f"CA LỆCH PHA CHẾ/CHẠY BÀN: {counts['role_mismatch']}\n"
            f"CA THIẾU QUẢN LÝ/CẤP 1: {counts['missing_senior']}\n"
            f"XẾP VÀO CA ĐÃ NGHỈ: {counts['assigned_off']}\n"
            f"XẾP KHI CHƯA ORDER: {counts['assigned_no_order']}\n"
            f"LÀM THÔNG 3 CA: {counts.get('three_shifts', 0)}\n"
            f"NHÂN VIÊN CHƯA CÓ CA: {counts['unassigned']}"
        )

    @staticmethod
    def _set_row(table: QTableWidget, row_index: int, values: list[Any]) -> None:
        for column, value in enumerate(values):
            item = QTableWidgetItem(str(value))
            item.setFont(table.font())
            item.setTextAlignment(Qt.AlignVCenter | (Qt.AlignLeft if column in (0, 1) else Qt.AlignCenter))
            table.setItem(row_index, column, item)
        table.setRowHeight(row_index, 38)

    def _selected_history_week_id(self) -> int | None:
        row = self.history_table.currentRow()
        if row < 0:
            return None
        item = self.history_table.item(row, 0)
        value = item.data(Qt.UserRole) if item else None
        return int(value) if value is not None else None

    def view_selected_history(self) -> None:
        week_id = self._selected_history_week_id()
        if not week_id:
            warning(self, "Chưa chọn tuần", "Chọn một dòng trong LỊCH 30 NGÀY.")
            return
        self.week_selected.emit(week_id)

    def reopen_selected_history(self) -> None:
        week_id = self._selected_history_week_id()
        if not week_id:
            warning(self, "Chưa chọn tuần", "Chọn một dòng trong LỊCH 30 NGÀY.")
            return
        if not self.db.is_week_closed(week_id):
            self.week_selected.emit(week_id)
            info(self, "Tuần đang mở", "Tuần này đã ở trạng thái chỉnh sửa.")
            return
        if not confirm(
            self,
            "Mở lại lịch",
            "Mở lại tuần đã chọn để chỉnh sửa? Bản chốt cũ không được lưu riêng.",
        ):
            return
        try:
            self.db.reopen_week_schedule(week_id)
        except DatabaseError as exc:
            warning(self, "Không thể mở lại", str(exc))
            return
        self.week_selected.emit(week_id)
        self.data_changed.emit()
        self.refresh()

    def export_selected_history(self) -> None:
        week_id = self._selected_history_week_id()
        if not week_id:
            warning(self, "Chưa chọn tuần", "Chọn một dòng trong LỊCH 30 NGÀY.")
            return
        self._export_week(week_id)

    def toggle_close(self) -> None:
        week_id = self.week_getter()
        if not week_id or not self.db.week_schedule_exists(int(week_id)):
            warning(self, "Chưa có lịch", "Chưa có dữ liệu Lịch tổng để chốt.")
            return
        week_id = int(week_id)
        if self.db.is_week_closed(week_id):
            if not confirm(
                self,
                "Mở lại lịch",
                "Mở lại lịch để chỉnh sửa? Bản chốt cũ không được lưu riêng.",
            ):
                return
            try:
                self.db.reopen_week_schedule(week_id)
            except DatabaseError as exc:
                warning(self, "Không thể mở lại", str(exc))
                return
            self.data_changed.emit()
            self.refresh()
            info(self, "Đã mở lại", "Lịch đã chuyển sang trạng thái ĐANG CHỈNH SỬA.")
            return

        report = self.db.schedule_warning_report(week_id)
        dialog = ScheduleCloseDialog(self, self._warning_summary_text(report), report["lines"])
        if dialog.exec() != QDialog.Accepted:
            return
        try:
            closed_at = self.db.close_week_schedule(week_id)
        except DatabaseError as exc:
            warning(self, "Không thể chốt lịch", str(exc))
            return
        self.data_changed.emit()
        self.refresh()
        info(
            self,
            "Đã chốt lịch",
            f"Đã chốt lịch lúc {closed_at.replace('T', ' ')}. Định biên hiện tại đã được lưu cùng tuần này.",
        )

    def export_current_week(self) -> None:
        week_id = self.week_getter()
        if not week_id or not self.db.week_schedule_exists(int(week_id)):
            warning(self, "Chưa có lịch", "Chưa có dữ liệu để xuất báo cáo.")
            return
        self._export_week(int(week_id))

    @staticmethod
    def _style_sheet(ws) -> None:
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
        ws.freeze_panes = "A2"
        for column_cells in ws.columns:
            length = max(len(str(cell.value or "")) for cell in column_cells)
            ws.column_dimensions[get_column_letter(column_cells[0].column)].width = min(max(length + 3, 11), 36)

    def _export_week(self, week_id: int) -> None:
        week = self.db.get_week(week_id)
        if not week:
            warning(self, "Không tìm thấy tuần", "Tuần đã chọn không còn trong dữ liệu.")
            return
        default_name = f"Bao_cao_lich_{week['start_date']}_{week['end_date']}.xlsx"
        filename, _ = QFileDialog.getSaveFileName(
            self,
            "Xuất báo cáo lịch",
            str(Path.home() / default_name),
            "Excel Workbook (*.xlsx)",
        )
        if not filename:
            return
        if not filename.lower().endswith(".xlsx"):
            filename += ".xlsx"

        report = self.db.schedule_warning_report(week_id)
        stats = self.db.week_schedule_page_stats(week_id)
        staffing_rows = self.db.staffing_report_rows(week_id)
        employee_rows = self.db.employee_schedule_report(week_id)
        order_data = self.db.order_report_details(week_id)
        branch_rows = self.db.branch_schedule_report(week_id)
        total_rows = self.db.employee_weekly_schedule_grid(week_id)
        closure = self.db.schedule_closure(week_id)

        wb = Workbook()
        ws = wb.active
        ws.title = "TONG_QUAN"
        ws.append(["NỘI DUNG", "GIÁ TRỊ"])
        overview = [
            ("TUẦN", self._week_text(week)),
            ("TRẠNG THÁI", self.db.week_schedule_status(week_id)),
            ("CHỐT GẦN NHẤT", closure["closed_at"] if closure and closure["closed_at"] else "—"),
            ("NHÂN VIÊN ĐANG LÀM", stats["active"]),
            ("NHÂN VIÊN ĐÃ XẾP", stats["assigned_employees"]),
            ("NHÂN VIÊN CHƯA CÓ CA", stats["unassigned_employees"]),
            ("TỔNG CA ĐÃ XẾP", stats["total_assignments"]),
            ("TỔNG CẢNH BÁO", sum(report["counts"].values())),
        ]
        for row in overview:
            ws.append(list(row))
        self._style_sheet(ws)

        ws = wb.create_sheet("CANH_BAO")
        ws.append(["LOẠI", "CHI TIẾT"])
        for line in report["lines"] or ["KHÔNG CÓ CẢNH BÁO"]:
            category, sep, detail = line.partition(":")
            ws.append([category, detail.strip() if sep else line])
        self._style_sheet(ws)

        ws = wb.create_sheet("DINH_BIEN")
        ws.append(["CƠ SỞ", "NGÀY", "CA", "TỔNG", "ĐỊNH BIÊN", "PHA CHẾ", "CHẠY BÀN", "CẤP 1+", "TRẠNG THÁI"])
        for row in staffing_rows:
            ws.append(
                [
                    row["branch_code"], row["day"], row["shift"], row["actual"], row["required"],
                    f"{row['bar_actual']}/{row['bar_required']}",
                    f"{row['floor_actual']}/{row['floor_required']}", row["senior"], row["status"],
                ]
            )
        self._style_sheet(ws)

        ws = wb.create_sheet("NHAN_VIEN")
        ws.append(["MÃ NV", "TÊN NHÂN VIÊN", "PHÂN CẤP", "TỔNG CA", *[shift.upper() for shift in self.shifts], "CƠ SỞ"])
        for row in employee_rows:
            ws.append([
                row["code"], row["name"], row["rank"], row["total"],
                *[row.get("shift_counts", {}).get(shift, 0) for shift in self.shifts],
                row["branches"],
            ])
        self._style_sheet(ws)

        ws = wb.create_sheet("ORDER")
        ws.append(["NỘI DUNG", "GIÁ TRỊ"])
        order_summary = order_data["summary"]
        for row in [
            ("NHÂN VIÊN ĐANG LÀM", order_summary["active"]),
            ("ĐÃ CÓ ORDER", order_summary["with_data"]),
            ("CHƯA CÓ ORDER", order_summary["without_data"]),
            ("Ô ĐI LÀM ĐƯỢC", order_summary["available"]),
            ("Ô NGHỈ", order_summary["off"]),
        ]:
            ws.append(list(row))
        ws.append([])
        ws.append(["NGOẠI LỆ", "CHI TIẾT"])
        for row in order_data["exceptions"]:
            ws.append([row["category"], row["detail"]])
        self._style_sheet(ws)

        ws = wb.create_sheet("CO_SO")
        ws.append(["CƠ SỞ", "TỔNG CA NV", "CA ĐỦ", "CA THIẾU", "CA THỪA", "LỆCH VỊ TRÍ", "THIẾU CẤP 1+"])
        for row in branch_rows:
            ws.append([row["branch_code"], row["total_assignments"], row["exact"], row["shortage"], row["overstaff"], row["role_mismatch"], row["missing_senior"]])
        self._style_sheet(ws)

        ws = wb.create_sheet("LICH_TONG_7_NGAY")
        headers = ["MÃ NV", "TÊN NHÂN VIÊN", "PHÂN CẤP", *self._week_day_headers(week_id), "TỔNG CA"]
        ws.append(headers)
        for row in total_rows:
            day_cells: list[str] = []
            for weekday in range(7):
                blocks: list[str] = []
                for assignment in row["days"].get(weekday, []):
                    branch_name = str(assignment.get("branch_name") or assignment.get("branch_ui_code") or assignment.get("branch_code") or "")
                    blocks.append(
                        f"{str(assignment.get('shift') or '').upper()}\n{branch_name.upper()} – {self._role_code(str(assignment.get('role') or ''))}"
                    )
                day_cells.append("\n\n".join(blocks))
            ws.append([row["code"], row["name"], row["rank"], *day_cells, row["total"]])
        self._style_sheet(ws)
        ws.freeze_panes = "D2"
        for row_index in range(2, ws.max_row + 1):
            ws.row_dimensions[row_index].height = 58

        try:
            wb.save(filename)
        except OSError as exc:
            warning(self, "Không thể xuất file", str(exc))
            return
        info(self, "Đã xuất báo cáo", f"Đã lưu file:\n{filename}")

    def _apply_employee_report_filter(self, *_args) -> None:
        if not hasattr(self, "employee_table"):
            return
        token = self.employee_report_search.text().strip().casefold() if hasattr(self, "employee_report_search") else ""
        for row in range(self.employee_table.rowCount()):
            code_item = self.employee_table.item(row, 0)
            name_item = self.employee_table.item(row, 1)
            text = f"{code_item.text() if code_item else ''} {name_item.text() if name_item else ''}".casefold()
            self.employee_table.setRowHidden(row, bool(token and token not in text))

    def refresh(self) -> None:
        week_id = self.week_getter()
        schedule_exists = bool(week_id and self.db.week_schedule_exists(int(week_id)))
        if not week_id:
            self.week_info.setText("TUẦN: CHƯA CHỌN")
        else:
            self.week_info.setText(f"TUẦN: {self._week_text(self.db.get_week(int(week_id)))}")

        if not schedule_exists:
            self.status_label.setText("TRẠNG THÁI: CHƯA CÓ LỊCH")
            self.status_label.setStyleSheet(
                "background:#E5E7EB; color:#475569; border:1px solid #94A3B8; border-radius:7px; padding:9px 12px;"
            )
            self.closed_at_label.setText("CHỐT GẦN NHẤT: —")
            self.close_button.setEnabled(False)
            self.export_button.setEnabled(False)
            for table in [self.warning_table, self.staffing_table, self.employee_table, self.order_table, self.branch_table]:
                table.setRowCount(0)
            self._warning_rows = []
            self.warning_filter.blockSignals(True)
            self.warning_filter.clear()
            self.warning_filter.addItem("TẤT CẢ CẢNH BÁO", "")
            self.warning_filter.blockSignals(False)
            self._refresh_weekly_view(None)
            for widget, value in zip(
                [self.stat_employees, self.stat_assignments, self.stat_warnings, self.stat_shortage, self.stat_overstaff, self.stat_unassigned],
                ["NHÂN VIÊN: —", "TỔNG CA: —", "CẢNH BÁO: —", "CA THIẾU: —", "CA THỪA: —", "CHƯA CÓ CA: —"],
            ):
                widget.setText(value)
            self._refresh_history()
            return

        week_id = int(week_id)
        self.close_button.setEnabled(True)
        self.export_button.setEnabled(True)
        status = self.db.week_schedule_status(week_id)
        closed = self.db.is_week_closed(week_id)
        self.status_label.setText(f"TRẠNG THÁI: {status}")
        self.status_label.setStyleSheet(
            ("background:#DCFCE7; color:#166534; border:1px solid #22C55E;" if closed else
             "background:#FEF3C7; color:#92400E; border:1px solid #F59E0B;")
            + " border-radius:7px; padding:9px 12px;"
        )
        self.close_button.setText("Mở lại để chỉnh sửa" if closed else "Chốt lịch")
        closure = self.db.schedule_closure(week_id)
        closed_at = closure["closed_at"] if closure and closure["closed_at"] else None
        self.closed_at_label.setText(
            "CHỐT GẦN NHẤT: " + (closed_at.replace("T", " ") if closed_at else "—")
        )

        report = self.db.schedule_warning_report(week_id)
        stats = self.db.week_schedule_page_stats(week_id)
        total_warnings = sum(int(value) for value in report["counts"].values())
        self.stat_employees.setText(f"NHÂN VIÊN: {stats['active']}")
        self.stat_assignments.setText(f"TỔNG CA: {stats['total_assignments']}")
        self.stat_warnings.setText(f"CẢNH BÁO: {total_warnings}")
        self.stat_shortage.setText(f"CA THIẾU: {report['counts']['shortage']}")
        self.stat_overstaff.setText(f"CA THỪA: {report['counts']['overstaff']}")
        self.stat_unassigned.setText(f"CHƯA CÓ CA: {report['counts']['unassigned']}")

        warning_lines = report["lines"] or ["KHÔNG CÓ CẢNH BÁO"]
        self._set_warning_rows(warning_lines)

        staffing_rows = self.db.staffing_report_rows(week_id)
        self.staffing_table.setRowCount(len(staffing_rows))
        for index, row in enumerate(staffing_rows):
            self._set_row(
                self.staffing_table,
                index,
                [
                    row["branch_code"], row["day"], row["shift"], row["actual"], row["required"],
                    f"{row['bar_actual']}/{row['bar_required']}",
                    f"{row['floor_actual']}/{row['floor_required']}", row["senior"], row["status"],
                ],
            )
            status_item = self.staffing_table.item(index, 8)
            if row["status"] == "ĐỦ":
                status_item.setBackground(QColor("#DCFCE7"))
                status_item.setForeground(QColor("#166534"))
            elif "THIẾU" in row["status"]:
                status_item.setBackground(QColor("#FEE2E2"))
                status_item.setForeground(QColor("#991B1B"))
            else:
                status_item.setBackground(QColor("#FEF3C7"))
                status_item.setForeground(QColor("#92400E"))

        employee_rows = self.db.employee_schedule_report(week_id)
        self.employee_table.setRowCount(len(employee_rows))
        for index, row in enumerate(employee_rows):
            self._set_row(
                self.employee_table,
                index,
                [
                    row["code"], row["name"], row["rank"], row["total"],
                    *[row.get("shift_counts", {}).get(shift, 0) for shift in self.shifts],
                    row["branches"],
                ],
            )
            if row["total"] == 0:
                for column in range(self.employee_table.columnCount()):
                    self.employee_table.item(index, column).setBackground(QColor("#FEE2E2"))
        self._apply_employee_report_filter()

        order_data = self.db.order_report_details(week_id)
        order_summary = order_data["summary"]
        self.order_active.setText(f"ĐANG LÀM: {order_summary['active']}")
        self.order_with.setText(f"ĐÃ ORDER: {order_summary['with_data']}")
        self.order_without.setText(f"CHƯA ORDER: {order_summary['without_data']}")
        self.order_available.setText(f"ĐI LÀM ĐƯỢC: {order_summary['available']}")
        self.order_off.setText(f"NGHỈ: {order_summary['off']}")
        exceptions = order_data["exceptions"] or [{"category": "KHÔNG CÓ NGOẠI LỆ", "detail": "—"}]
        self.order_table.setRowCount(len(exceptions))
        for index, row in enumerate(exceptions):
            self._set_row(self.order_table, index, [row["category"], row["detail"]])

        branch_rows = self.db.branch_schedule_report(week_id)
        self.branch_table.setRowCount(len(branch_rows))
        for index, row in enumerate(branch_rows):
            self._set_row(
                self.branch_table,
                index,
                [row["branch_code"], row["total_assignments"], row["exact"], row["shortage"], row["overstaff"], row["role_mismatch"], row["missing_senior"]],
            )
        self._refresh_weekly_view(week_id)
        self._refresh_history()

    def _refresh_history(self) -> None:
        rows = self.db.recent_schedule_closures()
        self.history_table.setRowCount(len(rows))
        for index, row in enumerate(rows):
            start = datetime.strptime(row["start_date"], "%Y-%m-%d").strftime("%d/%m/%Y")
            end = datetime.strptime(row["end_date"], "%Y-%m-%d").strftime("%d/%m/%Y")
            closed_at = row["closed_at"].replace("T", " ") if row["closed_at"] else "—"
            self._set_row(
                self.history_table,
                index,
                [f"{start} – {end}", row["status"], closed_at, row["warning_count"]],
            )
            self.history_table.item(index, 0).setData(Qt.UserRole, row["week_id"])
            status_item = self.history_table.item(index, 1)
            if row["status"] == "ĐÃ CHỐT":
                status_item.setBackground(QColor("#DCFCE7"))
                status_item.setForeground(QColor("#166534"))
            else:
                status_item.setBackground(QColor("#FEF3C7"))
                status_item.setForeground(QColor("#92400E"))
