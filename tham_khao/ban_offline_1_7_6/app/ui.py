from __future__ import annotations

import shutil
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Callable

from PySide6.QtCore import QDate, Qt, Signal, QTimer
from PySide6.QtGui import QColor, QFont, QKeySequence, QPainter, QPalette, QPen, QShortcut
from PySide6.QtWidgets import (
    QAbstractItemView,
    QAbstractSpinBox,
    QApplication,
    QButtonGroup,
    QCheckBox,
    QComboBox,
    QDateEdit,
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QFormLayout,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QProxyStyle,
    QScrollArea,
    QSizePolicy,
    QSpinBox,
    QStackedWidget,
    QStyle,
    QStyledItemDelegate,
    QStyleOptionViewItem,
    QTabWidget,
    QTableWidget,
    QTreeWidget,
    QTreeWidgetItem,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from .constants import (
    APP_NAME,
    APP_VERSION,
    EMPLOYEE_STATUSES,
    RANKS,
    ROLES,
    WEEKDAY_NAMES,
)
from .database import Database, DatabaseError
from .excel_io import (
    ExcelImportError,
    create_order_template,
    export_employee_form_files,
    export_evaluation_employee_file,
    export_evaluation_form_package,
    import_employee_rows,
    import_form_response_rows,
    import_order_rows,
)
from .paths import app_data_dir
from .data_transfer import TransferDataError, create_transfer_package, restore_transfer_package
from .schedule_pages import BranchSchedulePage, CloseReportPage, FixedSchedulePage, MasterSchedulePage
from .evaluation_pages import EvaluationPage
from .week_controls import WeekSelectorBar, week_day_headers


STYLE = """
QWidget {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial;
    font-size: 13px;
    font-weight: 700;
    color: #111827;
}
QMainWindow, QWidget#RootWidget { background: #F1F5F9; }
QFrame#Sidebar { background: #0F172A; border: none; }
QLabel#Brand { color: #FFFFFF; font-size: 20px; font-weight: 800; }
QLabel#Version { color: #CBD5E1; font-size: 11px; font-weight: 700; }
QListWidget#Navigation { background: transparent; border: none; color: #E2E8F0; outline: none; }
QListWidget#Navigation::item { min-height: 25px; padding: 11px 14px; margin: 3px 5px; border-radius: 7px; }
QListWidget#Navigation::item:selected { background: #2563EB; color: #FFFFFF; }
QListWidget#Navigation::item:hover { background: #1E293B; color: #FFFFFF; }
QTreeWidget#Navigation { background: transparent; border: none; color: #E2E8F0; outline: none; }
QTreeWidget#Navigation::item { min-height: 30px; padding: 7px 8px; margin: 2px 3px; border-radius: 7px; }
QTreeWidget#Navigation::item:selected { background: #2563EB; color: #FFFFFF; }
QTreeWidget#Navigation::item:hover { background: #1E293B; color: #FFFFFF; }
QTreeWidget#Navigation::branch { background: transparent; }
QFrame#Header { background: #FFFFFF; border-bottom: 2px solid #CBD5E1; }
QLabel#PageTitle { font-size: 23px; font-weight: 800; color: #0F172A; }
QLabel#Muted { color: #475569; font-weight: 700; }
QFrame#Card { background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 10px; }
QLabel#CardValue { font-size: 26px; font-weight: 800; color: #1D4ED8; }
QLabel#CardLabel { color: #334155; font-weight: 800; }
QPushButton {
    background: #FFFFFF;
    color: #0F172A;
    border: 1px solid #94A3B8;
    border-radius: 7px;
    padding: 8px 15px;
    min-height: 24px;
    font-weight: 800;
}
QPushButton:hover { background: #E2E8F0; border-color: #64748B; }
QPushButton:pressed { background: #CBD5E1; }
QPushButton:disabled { background: #E5E7EB; color: #6B7280; border-color: #CBD5E1; }
QPushButton#Primary { background: #2563EB; color: #FFFFFF; border: 1px solid #1D4ED8; }
QPushButton#Primary:hover { background: #1D4ED8; }
QPushButton#Danger { background: #FFF1F2; color: #BE123C; border: 1px solid #FDA4AF; }
QPushButton#Danger:hover { background: #FFE4E6; }
QLineEdit, QComboBox, QDateEdit, QSpinBox, QPlainTextEdit {
    background: #FFFFFF;
    color: #0F172A;
    border: 1px solid #94A3B8;
    border-radius: 6px;
    padding: 7px 10px;
    min-height: 24px;
    selection-background-color: #2563EB;
    selection-color: #FFFFFF;
}
QLineEdit:focus, QComboBox:focus, QDateEdit:focus, QSpinBox:focus, QPlainTextEdit:focus { border: 2px solid #2563EB; }
QComboBox::drop-down, QDateEdit::drop-down { width: 28px; border-left: 1px solid #CBD5E1; }
QComboBox QAbstractItemView, QComboBox QListView {
    background: #FFFFFF;
    color: #0F172A;
    border: 1px solid #64748B;
    outline: 0;
    selection-background-color: #DBEAFE;
    selection-color: #1E3A8A;
    padding: 5px;
    min-width: 220px;
}
QComboBox QAbstractItemView::item { min-height: 30px; padding: 5px 8px; }
QTableWidget {
    background: #FFFFFF;
    color: #111827;
    border: 1px solid #CBD5E1;
    gridline-color: #CBD5E1;
    alternate-background-color: #F8FAFC;
    selection-background-color: #DBEAFE;
    selection-color: #0F172A;
}
QHeaderView::section {
    background: #1E3A8A;
    color: #FFFFFF;
    padding: 9px 7px;
    min-height: 28px;
    border: none;
    border-right: 1px solid #60A5FA;
    border-bottom: 1px solid #60A5FA;
    font-weight: 800;
}
QTabWidget::pane { border: 1px solid #CBD5E1; background: #FFFFFF; }
QTabBar::tab { background: #CBD5E1; color: #334155; padding: 10px 22px; margin-right: 3px; font-weight: 800; min-width: 68px; }
QTabBar::tab:selected { background: #FFFFFF; color: #1D4ED8; border-top: 3px solid #2563EB; }
QCheckBox { spacing: 8px; font-weight: 800; min-height: 26px; }
QCheckBox::indicator { width: 18px; height: 18px; }
QDialog, QMessageBox { background: #F8FAFC; color: #111827; }
QDialog QLabel, QMessageBox QLabel { color: #111827; }
QDialog QLineEdit, QDialog QComboBox, QDialog QDateEdit, QDialog QSpinBox {
    background: #FFFFFF; color: #111827; border: 1px solid #64748B;
}
QDialogButtonBox QPushButton { min-width: 130px; min-height: 30px; }
QCalendarWidget QWidget { background: #FFFFFF; color: #111827; }
QCalendarWidget QToolButton {
    background: #E2E8F0; color: #0F172A; border: 1px solid #94A3B8;
    border-radius: 5px; min-height: 28px; padding: 4px 9px;
}
QCalendarWidget QMenu { background: #FFFFFF; color: #111827; }
QCalendarWidget QSpinBox { background: #FFFFFF; color: #111827; selection-background-color: #2563EB; }
QCalendarWidget QAbstractItemView:enabled {
    background: #FFFFFF; color: #111827; selection-background-color: #2563EB; selection-color: #FFFFFF;
    alternate-background-color: #F8FAFC;
}
QCalendarWidget QAbstractItemView:disabled { color: #9CA3AF; }
QScrollBar:vertical { background:#E2E8F0; width:14px; margin:0; }
QScrollBar::handle:vertical { background:#64748B; min-height:35px; border-radius:6px; }
QScrollBar:horizontal { background:#E2E8F0; height:14px; margin:0; }
QScrollBar::handle:horizontal { background:#64748B; min-width:35px; border-radius:6px; }
QScrollBar::add-line, QScrollBar::sub-line { width:0; height:0; }
"""


class UppercaseProxyStyle(QProxyStyle):
    """Hiển thị chữ in hoa mà không thay đổi giá trị dữ liệu gốc."""

    def drawItemText(self, painter, rect, flags, palette, enabled, text, textRole=QPalette.NoRole):
        display_text = text.upper() if isinstance(text, str) else text
        super().drawItemText(painter, rect, flags, palette, enabled, display_text, textRole)



def format_week(row) -> str:
    start = datetime.strptime(row["start_date"], "%Y-%m-%d").strftime("%d/%m/%Y")
    end = datetime.strptime(row["end_date"], "%Y-%m-%d").strftime("%d/%m/%Y")
    return f"{start} – {end}"


def info(parent: QWidget, title: str, text: str) -> None:
    QMessageBox.information(parent, title, text)


def warning(parent: QWidget, title: str, text: str) -> None:
    QMessageBox.warning(parent, title, text)


def confirm(parent: QWidget, title: str, text: str) -> bool:
    return QMessageBox.question(parent, title, text, QMessageBox.Yes | QMessageBox.No) == QMessageBox.Yes


def make_button(text: str, slot: Callable, primary: bool = False, danger: bool = False) -> QPushButton:
    button = QPushButton(text)
    button.setMinimumHeight(42)
    button.setMinimumWidth(max(120, min(260, len(text) * 9 + 38)))
    button.setSizePolicy(QSizePolicy.Minimum, QSizePolicy.Fixed)
    if primary:
        button.setObjectName("Primary")
    if danger:
        button.setObjectName("Danger")
    button.clicked.connect(slot)
    return button


def card(label: str) -> tuple[QFrame, QLabel]:
    frame = QFrame()
    frame.setObjectName("Card")
    layout = QVBoxLayout(frame)
    layout.setContentsMargins(18, 14, 18, 14)
    value_label = QLabel("0")
    value_label.setObjectName("CardValue")
    caption = QLabel(label)
    caption.setObjectName("CardLabel")
    layout.addWidget(value_label)
    layout.addWidget(caption)
    return frame, value_label


class SpiritManagerRoleDialog(QDialog):
    """Chuyển vị trí Quản lý ca cũ sang Pha chế hoặc Chạy bàn."""

    def __init__(self, parent: QWidget, pending: list[dict]) -> None:
        super().__init__(parent)
        self.setWindowTitle("Chọn vị trí cho lịch cố định Spirit")
        self.setMinimumWidth(620)
        self.combos: dict[str, QComboBox] = {}

        layout = QVBoxLayout(self)
        title = QLabel("CẦN CHỌN VỊ TRÍ CHO 4 LỊCH QUẢN LÝ CA CŨ")
        title.setObjectName("PageTitle")
        layout.addWidget(title)
        note = QLabel(
            "SPIRIT 2.5.0 DÙNG VỊ TRÍ QUẢN LÝ CA, TRONG KHI APP MỚI CHỈ CÒN PHA CHẾ VÀ CHẠY BÀN. "
            "CHỌN VỊ TRÍ THAY THẾ MỘT LẦN; PHẦN MỀM SẼ NẠP ĐỦ 7 NGÀY VÀ BỔ SUNG VỊ TRÍ VÀO HỒ SƠ NHÂN VIÊN."
        )
        note.setObjectName("Muted")
        note.setWordWrap(True)
        layout.addWidget(note)

        form = QFormLayout()
        for item in pending:
            combo = QComboBox()
            combo.addItems(ROLES)
            # Gợi ý duy nhất theo hồ sơ cũ của Cường; các trường hợp khác để Pha chế mặc định và người dùng chủ động chọn.
            if item["code"] == "2":
                combo.setCurrentText("Chạy bàn")
            label = f"{item['code']} — {item['name']} | {item['branch']} | FULL {item['shift']}"
            form.addRow(label, combo)
            self.combos[item["code"]] = combo
        layout.addLayout(form)

        buttons = QDialogButtonBox(QDialogButtonBox.Save | QDialogButtonBox.Cancel)
        buttons.button(QDialogButtonBox.Save).setText("Lưu và nạp lịch")
        buttons.button(QDialogButtonBox.Cancel).setText("Để sau")
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def values(self) -> dict[str, str]:
        return {code: combo.currentText() for code, combo in self.combos.items()}



class EmployeeDialog(QDialog):
    """Biểu mẫu dùng chung cho thao tác thêm và sửa nhân viên."""

    def __init__(self, parent: QWidget, db: Database, employee: dict | None = None) -> None:
        super().__init__(parent)
        self.employee = employee
        self.db = db
        editing = employee is not None
        self._editing = editing
        self._original_code = str(employee["code"]) if editing else ""
        self.setWindowTitle("Thêm nhân viên" if not editing else "Sửa thông tin nhân viên")
        self.setObjectName("EmployeeEditorDialog")
        self.setMinimumSize(780, 620)
        self.resize(900, 740)
        self.setStyleSheet(
            """
            QDialog#EmployeeEditorDialog { background:#F8FAFC; color:#0F172A; }
            QDialog#EmployeeEditorDialog QLabel { color:#0F172A; font-weight:800; }
            QDialog#EmployeeEditorDialog QLabel#PageTitle { color:#0F172A; font-size:23px; }
            QDialog#EmployeeEditorDialog QLabel#Muted { color:#475569; }
            QDialog#EmployeeEditorDialog QFrame#Card {
                background:#FFFFFF; border:1px solid #CBD5E1; border-radius:10px;
            }
            QDialog#EmployeeEditorDialog QLineEdit,
            QDialog#EmployeeEditorDialog QComboBox {
                background:#FFFFFF; color:#0F172A; border:1px solid #64748B;
                border-radius:7px; padding:8px 11px; min-height:26px;
            }
            QDialog#EmployeeEditorDialog QLineEdit:focus,
            QDialog#EmployeeEditorDialog QComboBox:focus { border:2px solid #2563EB; }
            QDialog#EmployeeEditorDialog QComboBox QAbstractItemView {
                background:#FFFFFF; color:#0F172A; border:1px solid #64748B;
                selection-background-color:#DBEAFE; selection-color:#1E3A8A;
                min-width:260px;
            }
            QDialog#EmployeeEditorDialog QCheckBox { color:#0F172A; spacing:9px; min-height:30px; }
            QDialog#EmployeeEditorDialog QCheckBox::indicator { width:19px; height:19px; }
            QDialog#EmployeeEditorDialog QScrollArea,
            QDialog#EmployeeEditorDialog QScrollArea > QWidget > QWidget { background:#FFFFFF; }
            QDialog#EmployeeEditorDialog QPushButton {
                background:#FFFFFF; color:#0F172A; border:1px solid #94A3B8;
                border-radius:7px; padding:9px 16px; font-weight:800;
            }
            QDialog#EmployeeEditorDialog QPushButton#Primary {
                background:#1D4ED8; color:#FFFFFF; border:1px solid #1E40AF;
            }
            QDialog#EmployeeEditorDialog QPushButton#Primary:hover { background:#1E40AF; }
            """
        )

        outer = QVBoxLayout(self)
        outer.setContentsMargins(24, 20, 24, 20)
        outer.setSpacing(14)
        title = QLabel("THÊM NHÂN VIÊN" if not editing else "SỬA THÔNG TIN NHÂN VIÊN")
        title.setObjectName("PageTitle")
        outer.addWidget(title)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        body = QWidget()
        body_layout = QVBoxLayout(body)
        body_layout.setContentsMargins(2, 2, 12, 2)
        body_layout.setSpacing(14)

        basic = QFrame()
        basic.setObjectName("Card")
        basic_layout = QGridLayout(basic)
        basic_layout.setContentsMargins(20, 18, 20, 18)
        basic_layout.setHorizontalSpacing(18)
        basic_layout.setVerticalSpacing(14)
        basic_title = QLabel("THÔNG TIN CƠ BẢN")
        basic_title.setStyleSheet("font-size:15px; font-weight:800; color:#1E3A8A;")
        basic_layout.addWidget(basic_title, 0, 0, 1, 2)

        self.code = QLineEdit()
        self.name = QLineEdit()
        self.rank = QComboBox()
        self.rank.addItems(RANKS)
        self.status = QComboBox()
        self.status.addItems(EMPLOYEE_STATUSES)
        for widget in (self.code, self.name, self.rank, self.status):
            widget.setMinimumHeight(42)
            widget.setMinimumWidth(420)

        fields = [
            ("MÃ NHÂN VIÊN *", self.code),
            ("TÊN NHÂN VIÊN *", self.name),
            ("PHÂN CẤP", self.rank),
            ("TRẠNG THÁI", self.status),
        ]
        for row, (caption, widget) in enumerate(fields, start=1):
            label = QLabel(caption)
            label.setMinimumWidth(180)
            label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
            basic_layout.addWidget(label, row, 0)
            basic_layout.addWidget(widget, row, 1)
        basic_layout.setColumnStretch(1, 1)
        body_layout.addWidget(basic)

        branch_card = QFrame()
        branch_card.setObjectName("Card")
        branch_outer = QVBoxLayout(branch_card)
        branch_outer.setContentsMargins(20, 16, 20, 16)
        branch_outer.setSpacing(10)
        branch_title = QLabel("CƠ SỞ ĐƯỢC PHÉP LÀM VIỆC *")
        branch_title.setStyleSheet("font-size:15px; font-weight:800; color:#1E3A8A;")
        branch_outer.addWidget(branch_title)

        branch_scroll = QScrollArea()
        branch_scroll.setWidgetResizable(True)
        branch_scroll.setMinimumHeight(145)
        branch_scroll.setMaximumHeight(235)
        branch_scroll.setFrameShape(QFrame.StyledPanel)
        branch_content = QWidget()
        branch_layout = QGridLayout(branch_content)
        branch_layout.setContentsMargins(14, 12, 14, 12)
        branch_layout.setHorizontalSpacing(24)
        branch_layout.setVerticalSpacing(10)
        self.branch_checks: dict[str, QCheckBox] = {}
        branches = self.db.list_branches(active_only=False)
        for index, branch in enumerate(branches):
            code = str(branch["ui_code"])
            checkbox = QCheckBox(f"{code} – {branch['name']}")
            checkbox.setMinimumHeight(32)
            checkbox.setMinimumWidth(270)
            self.branch_checks[code] = checkbox
            branch_layout.addWidget(checkbox, index // 2, index % 2)
        branch_layout.setColumnStretch(0, 1)
        branch_layout.setColumnStretch(1, 1)
        branch_layout.setRowStretch(max(1, (len(branches) + 1) // 2), 1)
        branch_scroll.setWidget(branch_content)
        branch_outer.addWidget(branch_scroll)
        body_layout.addWidget(branch_card)

        role_card = QFrame()
        role_card.setObjectName("Card")
        role_layout = QVBoxLayout(role_card)
        role_layout.setContentsMargins(20, 16, 20, 16)
        role_layout.setSpacing(10)
        role_title = QLabel("VỊ TRÍ ĐẢM NHIỆM *")
        role_title.setStyleSheet("font-size:15px; font-weight:800; color:#1E3A8A;")
        role_layout.addWidget(role_title)
        role_row = QHBoxLayout()
        role_row.setSpacing(34)
        self.role_checks: dict[str, QCheckBox] = {}
        for role_name in ROLES:
            checkbox = QCheckBox(role_name)
            checkbox.setMinimumWidth(190)
            checkbox.setMinimumHeight(34)
            self.role_checks[role_name] = checkbox
            role_row.addWidget(checkbox)
        role_row.addStretch()
        role_layout.addLayout(role_row)
        preferred_row = QHBoxLayout()
        preferred_row.setSpacing(16)
        preferred_label = QLabel("VỊ TRÍ ƯU TIÊN")
        preferred_label.setMinimumWidth(180)
        self.preferred_role = QComboBox()
        self.preferred_role.setMinimumWidth(260)
        preferred_row.addWidget(preferred_label)
        preferred_row.addWidget(self.preferred_role)
        preferred_row.addStretch()
        role_layout.addLayout(preferred_row)
        for checkbox in self.role_checks.values():
            checkbox.toggled.connect(self._refresh_preferred_roles)
        self._refresh_preferred_roles()
        body_layout.addWidget(role_card)

        note = QLabel("MỘT NHÂN VIÊN CÓ THỂ LÀM NHIỀU CƠ SỞ VÀ ĐẢM NHIỆM MỘT HOẶC CẢ HAI VỊ TRÍ.")
        note.setObjectName("Muted")
        note.setWordWrap(True)
        body_layout.addWidget(note)
        body_layout.addStretch()
        scroll.setWidget(body)
        outer.addWidget(scroll, 1)

        buttons = QDialogButtonBox(QDialogButtonBox.Save | QDialogButtonBox.Cancel)
        confirm_button = buttons.button(QDialogButtonBox.Save)
        confirm_button.setText("XÁC NHẬN" if not editing else "XÁC NHẬN THAY ĐỔI")
        confirm_button.setObjectName("Primary")
        confirm_button.setMinimumWidth(210)
        confirm_button.setMinimumHeight(44)
        cancel_button = buttons.button(QDialogButtonBox.Cancel)
        cancel_button.setText("HỦY")
        cancel_button.setMinimumWidth(140)
        cancel_button.setMinimumHeight(44)
        buttons.accepted.connect(self._validate)
        buttons.rejected.connect(self.reject)
        outer.addWidget(buttons)

        if editing:
            self.code.setText(str(employee["code"]))
            self.name.setText(str(employee["name"]))
            self.rank.setCurrentText(str(employee["rank"]))
            self.status.setCurrentText(str(employee["status"]))
            for code in employee.get("branches", []):
                if code in self.branch_checks:
                    self.branch_checks[code].setChecked(True)
            for role_name in employee.get("roles", []):
                if role_name in self.role_checks:
                    self.role_checks[role_name].setChecked(True)
            self._refresh_preferred_roles()
            preferred = str(employee.get("preferred_role") or "")
            index = self.preferred_role.findText(preferred)
            if index >= 0:
                self.preferred_role.setCurrentIndex(index)
            self.code.setReadOnly(False)
            self.code.setToolTip(
                "Có thể sửa mã nhân viên. Dữ liệu lịch và Order cũ vẫn được giữ theo ID nội bộ; "
                "các file Order nhập sau này cần dùng mã mới."
            )

    def _refresh_preferred_roles(self) -> None:
        current = self.preferred_role.currentText() if hasattr(self, "preferred_role") else ""
        selected = [name for name, check in self.role_checks.items() if check.isChecked()]
        self.preferred_role.blockSignals(True)
        self.preferred_role.clear()
        self.preferred_role.addItems(selected)
        index = self.preferred_role.findText(current)
        self.preferred_role.setCurrentIndex(index if index >= 0 else (0 if selected else -1))
        self.preferred_role.setEnabled(bool(selected))
        self.preferred_role.blockSignals(False)

    def _validate(self) -> None:
        new_code = self.code.text().strip()
        if not new_code or not self.name.text().strip():
            warning(self, "Thiếu thông tin", "Mã nhân viên và tên nhân viên là bắt buộc.")
            return
        if self._editing and self._original_code.casefold() != new_code.casefold():
            if not confirm(
                self,
                "Xác nhận đổi mã nhân viên",
                f"Đổi mã nhân viên từ '{self._original_code}' sang '{new_code}'?\n\n"
                "Dữ liệu lịch và Order đã có vẫn được giữ nguyên theo nhân viên này. "
                "Từ lần nhập dữ liệu tiếp theo, hãy dùng mã mới.",
            ):
                return
        if not any(check.isChecked() for check in self.branch_checks.values()):
            warning(self, "Thiếu cơ sở", "Chọn ít nhất một cơ sở làm việc.")
            return
        if not any(check.isChecked() for check in self.role_checks.values()):
            warning(self, "Thiếu vị trí", "Chọn ít nhất một vị trí: Pha chế hoặc Chạy bàn.")
            return
        selected_roles = [name for name, check in self.role_checks.items() if check.isChecked()]
        if self.preferred_role.currentText() not in selected_roles:
            warning(self, "Thiếu vị trí ưu tiên", "Chọn vị trí ưu tiên trong các vị trí nhân viên có thể đảm nhiệm.")
            return
        self.accept()

    def values(self) -> dict:
        return {
            "code": self.code.text().strip(),
            "name": self.name.text().strip(),
            "rank": self.rank.currentText(),
            "status": self.status.currentText(),
            "branches": [code for code, check in self.branch_checks.items() if check.isChecked()],
            "roles": [role_name for role_name, check in self.role_checks.items() if check.isChecked()],
            "preferred_role": self.preferred_role.currentText(),
        }


class DashboardPage(QWidget):
    def __init__(self, db: Database, week_getter: Callable[[], int | None]) -> None:
        super().__init__()
        self.db = db
        self.week_getter = week_getter
        layout = QVBoxLayout(self)
        layout.setContentsMargins(28, 26, 28, 24)
        layout.setSpacing(18)

        title = QLabel("Tổng quan")
        title.setObjectName("PageTitle")
        subtitle = QLabel("Bản chạy thử tổng hợp – phạm vi Bước 1 đến Bước 10")
        subtitle.setObjectName("Muted")
        layout.addWidget(title)
        layout.addWidget(subtitle)

        cards_layout = QGridLayout()
        cards_layout.setHorizontalSpacing(14)
        cards_layout.setVerticalSpacing(14)
        self.active_card, self.active_value = card("Nhân viên đang làm")
        self.order_card, self.order_value = card("Đã có dữ liệu Order")
        self.missing_card, self.missing_value = card("Chưa có dữ liệu Order")
        self.staffing_card, self.staffing_value = card("Ô định biên đã khai báo")
        cards_layout.addWidget(self.active_card, 0, 0)
        cards_layout.addWidget(self.order_card, 0, 1)
        cards_layout.addWidget(self.missing_card, 0, 2)
        cards_layout.addWidget(self.staffing_card, 0, 3)
        layout.addLayout(cards_layout)

        summary_frame = QFrame()
        summary_frame.setObjectName("Card")
        summary_layout = QVBoxLayout(summary_frame)
        summary_title = QLabel("Trạng thái tuần đang chọn")
        summary_title.setFont(QFont(summary_title.font().family(), 15, QFont.Bold))
        self.summary_text = QLabel()
        self.summary_text.setWordWrap(True)
        self.summary_text.setObjectName("Muted")
        summary_layout.addWidget(summary_title)
        summary_layout.addWidget(self.summary_text)
        layout.addWidget(summary_frame)
        layout.addStretch()

    def refresh(self) -> None:
        week_id = self.week_getter()
        self.active_value.setText(str(self.db.employee_count(active_only=True)))
        self.staffing_value.setText(str(self.db.staffing_nonzero_count()))
        if week_id:
            data = self.db.order_summary(week_id)
            self.order_value.setText(str(data["with_data"]))
            self.missing_value.setText(str(data["without_data"]))
            latest = self.db.latest_order_import(week_id)
            latest_text = "Chưa nhập file Order cho tuần này."
            if latest:
                latest_text = f"File Order gần nhất: {latest['filename']} — {latest['row_count']} nhân viên — {latest['imported_at']}"
            self.summary_text.setText(
                f"Đi làm được: {data['available']} lượt ca\n"
                f"Nghỉ: {data['off']} lượt ca\n"
                f"{latest_text}"
            )
        else:
            self.order_value.setText("0")
            self.missing_value.setText("0")
            self.summary_text.setText("Chưa chọn tuần.")


class WeeksPage(QWidget):
    weeks_changed = Signal()

    def __init__(self, db: Database) -> None:
        super().__init__()
        self.db = db
        layout = QVBoxLayout(self)
        layout.setContentsMargins(28, 24, 28, 24)
        layout.setSpacing(16)
        title = QLabel("THIẾT LẬP TUẦN")
        title.setObjectName("PageTitle")
        layout.addWidget(title)

        toolbar_frame = QFrame()
        toolbar_frame.setObjectName("Card")
        toolbar = QGridLayout(toolbar_frame)
        toolbar.setContentsMargins(18, 16, 18, 16)
        toolbar.setHorizontalSpacing(14)
        toolbar.setVerticalSpacing(12)
        caption = QLabel("CHỌN MỘT NGÀY TRONG TUẦN")
        toolbar.addWidget(caption, 0, 0)
        self.date_edit = QDateEdit(QDate.currentDate())
        self.date_edit.setCalendarPopup(True)
        self.date_edit.setDisplayFormat("dd/MM/yyyy")
        self.date_edit.setMinimumWidth(250)
        self.date_edit.setMinimumHeight(44)
        calendar = self.date_edit.calendarWidget()
        calendar.setMinimumSize(450, 340)
        calendar.setGridVisible(True)
        toolbar.addWidget(self.date_edit, 0, 1)
        create_button = make_button("TẠO TUẦN", self.create_week, primary=True)
        create_button.setMinimumWidth(190)
        cleanup_button = make_button("DỌN DỮ LIỆU QUÁ 30 NGÀY", self.cleanup)
        cleanup_button.setMinimumWidth(270)
        toolbar.addWidget(create_button, 0, 2)
        toolbar.addWidget(cleanup_button, 0, 3)
        toolbar.setColumnStretch(4, 1)
        layout.addWidget(toolbar_frame)

        note = QLabel(
            "PHẦN MỀM TỰ QUY ĐỔI NGÀY ĐÃ CHỌN VỀ THỨ 2. TẠO TUẦN VÀ CHỌN TUẦN ĐƯỢC LƯU NGAY; "
            "KHÔNG CẦN NÚT LƯU. TUẦN ĐÃ CÓ ORDER, LỊCH LÀM HOẶC DỮ LIỆU CHỐT KHÔNG ĐƯỢC XÓA."
        )
        note.setWordWrap(True)
        note.setObjectName("Muted")
        layout.addWidget(note)

        action_frame = QFrame()
        action_frame.setObjectName("Card")
        actions = QHBoxLayout(action_frame)
        actions.setContentsMargins(14, 12, 14, 12)
        actions.setSpacing(10)
        choose_button = make_button("CHỌN TUẦN LÀM VIỆC", self.select_week, primary=True)
        choose_button.setMinimumWidth(230)
        delete_button = make_button("XÓA TUẦN CHƯA CÓ DỮ LIỆU", self.delete_week, danger=True)
        delete_button.setMinimumWidth(280)
        actions.addWidget(choose_button)
        actions.addWidget(delete_button)
        actions.addStretch()
        layout.addWidget(action_frame)

        self.table = QTableWidget(0, 6)
        self.table.setHorizontalHeaderLabels(
            ["ID", "TUẦN", "TRẠNG THÁI", "ĐANG SỬ DỤNG", "NGÀY TẠO", "DỮ LIỆU"]
        )
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        self.table.setColumnHidden(0, True)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(5, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setMinimumHeight(48)
        self.table.verticalHeader().setDefaultSectionSize(46)
        self.table.doubleClicked.connect(self.select_week)
        layout.addWidget(self.table, 1)
        self.refresh()

    def selected_week_id(self) -> int | None:
        row = self.table.currentRow()
        if row < 0:
            return None
        item = self.table.item(row, 0)
        return int(item.text()) if item else None

    def create_week(self) -> None:
        qdate = self.date_edit.date()
        chosen = date(qdate.year(), qdate.month(), qdate.day())
        week_id = self.db.create_week(chosen)
        self.db.set_setting("selected_week_id", str(week_id))
        self.refresh()
        self.weeks_changed.emit()
        info(self, "Đã tạo tuần", "Tuần đã được tạo hoặc đã tồn tại và được chọn làm tuần hiện tại.")

    def select_week(self) -> None:
        week_id = self.selected_week_id()
        if week_id is None:
            warning(self, "Chưa chọn tuần", "Chọn một tuần trong bảng.")
            return
        self.db.set_setting("selected_week_id", str(week_id))
        self.refresh()
        self.weeks_changed.emit()

    def delete_week(self) -> None:
        week_id = self.selected_week_id()
        if week_id is None:
            warning(self, "Chưa chọn tuần", "Chọn tuần cần xóa.")
            return
        week = self.db.get_week(week_id)
        if week is None:
            return
        if self.db.week_has_data(week_id):
            warning(self, "Không thể xóa", "Tuần đã có Order, lịch làm hoặc dữ liệu chốt.")
            return
        if not confirm(self, "Xóa tuần", f"Xóa tuần {format_week(week)}? Phần mềm sẽ sao lưu trước khi thực hiện."):
            return
        self.db.delete_week(week_id)
        selected = self.db.get_setting("selected_week_id")
        if selected and int(selected) == week_id:
            rows = self.db.list_weeks()
            replacement = int(rows[0]["id"]) if rows else self.db.ensure_current_week()
            self.db.set_setting("selected_week_id", str(replacement))
        self.refresh()
        self.weeks_changed.emit()

    def cleanup(self) -> None:
        count = self.db.cleanup_old_data()
        self.refresh()
        self.weeks_changed.emit()
        info(self, "Dọn dữ liệu", f"Đã xóa {count} tuần có ngày kết thúc cũ hơn 30 ngày.")

    def refresh(self) -> None:
        rows = self.db.list_weeks()
        selected = self.db.get_setting("selected_week_id")
        selected_id = int(selected) if selected and selected.isdigit() else None
        self.table.setRowCount(len(rows))
        selected_row = -1
        for r, row in enumerate(rows):
            week_id = int(row["id"])
            status = self.db.week_schedule_status(week_id)
            has_data = self.db.week_has_data(week_id)
            values = [
                week_id,
                format_week(row),
                status,
                "ĐANG DÙNG" if week_id == selected_id else "",
                row["created_at"],
                "ĐÃ CÓ DỮ LIỆU" if has_data else "CHƯA CÓ DỮ LIỆU",
            ]
            for c, value in enumerate(values):
                item = QTableWidgetItem(str(value))
                if c in (2, 3, 5):
                    item.setTextAlignment(Qt.AlignCenter)
                if c == 2:
                    if status == "ĐÃ CHỐT":
                        item.setBackground(QColor("#DCFCE7"))
                        item.setForeground(QColor("#166534"))
                    elif status == "ĐANG CHỈNH SỬA":
                        item.setBackground(QColor("#FFEDD5"))
                        item.setForeground(QColor("#9A3412"))
                if c == 3 and week_id == selected_id:
                    item.setBackground(QColor("#DBEAFE"))
                    item.setForeground(QColor("#1E3A8A"))
                self.table.setItem(r, c, item)
            if week_id == selected_id:
                selected_row = r
        if selected_row >= 0:
            self.table.selectRow(selected_row)


class BranchDialog(QDialog):
    def __init__(self, parent: QWidget, branch: dict | None = None) -> None:
        super().__init__(parent)
        self.branch = branch
        self.setWindowTitle("Thêm cơ sở" if branch is None else "Sửa cơ sở")
        self.setMinimumSize(620, 410)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 22, 24, 20)
        layout.setSpacing(16)
        title = QLabel("THÊM CƠ SỞ" if branch is None else "SỬA CƠ SỞ")
        title.setObjectName("PageTitle")
        layout.addWidget(title)
        form = QFormLayout()
        form.setHorizontalSpacing(22)
        form.setVerticalSpacing(14)
        self.system_code = QLineEdit()
        self.system_code.setPlaceholderText("VD: DK, LHP, CS5")
        self.display_code = QLineEdit()
        self.display_code.setPlaceholderText("VD: ĐK")
        self.name = QLineEdit()
        self.status = QComboBox()
        self.status.addItems(["Đang hoạt động", "Ngừng hoạt động"])
        self.sort_order = QSpinBox()
        self.sort_order.setRange(0, 999)
        form.addRow("Mã hệ thống *", self.system_code)
        form.addRow("Mã hiển thị *", self.display_code)
        form.addRow("Tên cơ sở *", self.name)
        form.addRow("Trạng thái", self.status)
        form.addRow("Thứ tự hiển thị", self.sort_order)
        layout.addLayout(form)
        note = QLabel("MÃ HỆ THỐNG KHÔNG DẤU, KHÔNG KHOẢNG TRẮNG. SAU KHI TẠO SẼ KHÔNG ĐỔI ĐỂ BẢO TOÀN DỮ LIỆU.")
        note.setObjectName("Muted")
        note.setWordWrap(True)
        layout.addWidget(note)
        buttons = QDialogButtonBox(QDialogButtonBox.Save | QDialogButtonBox.Cancel)
        buttons.button(QDialogButtonBox.Save).setText("LƯU CƠ SỞ")
        buttons.button(QDialogButtonBox.Save).setObjectName("Primary")
        buttons.button(QDialogButtonBox.Cancel).setText("HỦY")
        buttons.accepted.connect(self._validate)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
        if branch:
            self.system_code.setText(str(branch.get("internal_code") or branch.get("system_code") or branch.get("code") or ""))
            self.system_code.setEnabled(False)
            self.display_code.setText(str(branch.get("ui_code") or branch.get("display_code") or branch.get("code") or ""))
            self.name.setText(str(branch.get("name") or ""))
            self.status.setCurrentText(str(branch.get("status") or "Đang hoạt động"))
            self.sort_order.setValue(int(branch.get("sort_order") or 0))

    def _validate(self) -> None:
        if not self.system_code.text().strip() or not self.display_code.text().strip() or not self.name.text().strip():
            warning(self, "Thiếu thông tin", "Nhập đủ mã hệ thống, mã hiển thị và tên cơ sở.")
            return
        self.accept()

    def values(self) -> dict:
        return {
            "system_code": self.system_code.text().strip(),
            "display_code": self.display_code.text().strip(),
            "name": self.name.text().strip(),
            "status": self.status.currentText(),
            "sort_order": self.sort_order.value(),
        }


class ShiftDialog(QDialog):
    def __init__(self, parent: QWidget, shift: dict | None = None) -> None:
        super().__init__(parent)
        self.shift = shift
        self.setWindowTitle("Thêm ca làm việc" if shift is None else "Sửa ca làm việc")
        self.setMinimumSize(600, 420)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 22, 24, 20)
        layout.setSpacing(16)
        title = QLabel("THÊM CA LÀM VIỆC" if shift is None else "SỬA CA LÀM VIỆC")
        title.setObjectName("PageTitle")
        layout.addWidget(title)
        form = QFormLayout()
        form.setHorizontalSpacing(22)
        form.setVerticalSpacing(14)
        self.code = QLineEdit()
        self.code.setPlaceholderText("VD: S, C, T, D")
        self.name = QLineEdit()
        self.name.setPlaceholderText("VD: SÁNG, CHIỀU, TỐI, ĐÊM")
        self.color = QLineEdit()
        self.color.setPlaceholderText("VD: #DBEAFE")
        self.status = QComboBox()
        self.status.addItems(["Đang sử dụng", "Ngừng sử dụng"])
        self.sort_order = QSpinBox()
        self.sort_order.setRange(0, 999)
        form.addRow("Mã ca *", self.code)
        form.addRow("Tên ca *", self.name)
        form.addRow("Màu nhận diện", self.color)
        form.addRow("Trạng thái", self.status)
        form.addRow("Thứ tự hiển thị", self.sort_order)
        layout.addLayout(form)
        note = QLabel("GIỜ BẮT ĐẦU, KẾT THÚC VÀ VIỆC BẬT/TẮT CA ĐƯỢC THIẾT LẬP RIÊNG CHO TỪNG CƠ SỞ.")
        note.setObjectName("Muted")
        note.setWordWrap(True)
        layout.addWidget(note)
        buttons = QDialogButtonBox(QDialogButtonBox.Save | QDialogButtonBox.Cancel)
        buttons.button(QDialogButtonBox.Save).setText("LƯU CA")
        buttons.button(QDialogButtonBox.Save).setObjectName("Primary")
        buttons.button(QDialogButtonBox.Cancel).setText("HỦY")
        buttons.accepted.connect(self._validate)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
        if shift:
            self.code.setText(str(shift.get("code") or ""))
            self.name.setText(str(shift.get("name") or ""))
            self.color.setText(str(shift.get("color") or "#DBEAFE"))
            self.status.setCurrentText(str(shift.get("status") or "Đang sử dụng"))
            self.sort_order.setValue(int(shift.get("sort_order") or 0))

    def _validate(self) -> None:
        if not self.code.text().strip() or not self.name.text().strip():
            warning(self, "Thiếu thông tin", "Mã ca và tên ca không được để trống.")
            return
        color = self.color.text().strip() or "#DBEAFE"
        if not QColor(color).isValid():
            warning(self, "Màu không hợp lệ", "Nhập màu theo dạng #RRGGBB, ví dụ #DBEAFE.")
            return
        self.accept()

    def values(self) -> dict:
        return {
            "code": self.code.text().strip(),
            "name": self.name.text().strip(),
            "color": self.color.text().strip() or "#DBEAFE",
            "status": self.status.currentText(),
            "sort_order": self.sort_order.value(),
        }


class BranchShiftManagementPage(QWidget):
    data_changed = Signal()

    def __init__(self, db: Database) -> None:
        super().__init__()
        self.db = db
        self.branch_rows: list = []
        self.shift_rows: list = []
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 22, 24, 20)
        layout.setSpacing(14)
        title = QLabel("DANH SÁCH CƠ SỞ & CA LÀM VIỆC")
        title.setObjectName("PageTitle")
        layout.addWidget(title)
        note = QLabel(
            "CHỌN CƠ SỞ Ở BÊN TRÁI ĐỂ BẬT/TẮT CA VÀ KHAI BÁO GIỜ RIÊNG. "
            "CA MỚI ĐƯỢC TẠO CHUNG TOÀN HỆ THỐNG NHƯNG MẶC ĐỊNH TẮT TẠI CÁC CƠ SỞ KHÁC."
        )
        note.setObjectName("Muted")
        note.setWordWrap(True)
        layout.addWidget(note)

        content = QHBoxLayout()
        content.setSpacing(14)

        left = QFrame()
        left.setObjectName("Card")
        left_layout = QVBoxLayout(left)
        left_layout.setContentsMargins(14, 14, 14, 14)
        left_layout.setSpacing(10)
        left_title = QLabel("DANH SÁCH CƠ SỞ")
        left_title.setStyleSheet("font-size:16px; font-weight:800; color:#0F172A;")
        left_layout.addWidget(left_title)
        branch_buttons = QGridLayout()
        branch_buttons.addWidget(make_button("Thêm cơ sở", self.add_branch, primary=True), 0, 0)
        branch_buttons.addWidget(make_button("Sửa cơ sở", self.edit_branch), 0, 1)
        branch_buttons.addWidget(make_button("Bật / Tắt", self.toggle_branch), 1, 0)
        branch_buttons.addWidget(make_button("Xóa", self.delete_branch, danger=True), 1, 1)
        left_layout.addLayout(branch_buttons)
        self.branch_table = QTableWidget(0, 7)
        self.branch_table.setHorizontalHeaderLabels(["ID", "MÃ HỆ THỐNG", "MÃ HIỂN THỊ", "TÊN CƠ SỞ", "TRẠNG THÁI", "CA BẬT", "THỨ TỰ"])
        self.branch_table.setColumnHidden(0, True)
        self.branch_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.branch_table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.branch_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.branch_table.verticalHeader().setVisible(False)
        self.branch_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Stretch)
        self.branch_table.setMinimumWidth(610)
        self.branch_table.itemSelectionChanged.connect(self._branch_selected)
        self.branch_table.doubleClicked.connect(self.edit_branch)
        left_layout.addWidget(self.branch_table, 1)
        content.addWidget(left, 5)

        right = QFrame()
        right.setObjectName("Card")
        right_layout = QVBoxLayout(right)
        right_layout.setContentsMargins(14, 14, 14, 14)
        right_layout.setSpacing(10)
        self.branch_shift_title = QLabel("CA LÀM VIỆC TẠI CƠ SỞ")
        self.branch_shift_title.setStyleSheet("font-size:16px; font-weight:800; color:#0F172A;")
        right_layout.addWidget(self.branch_shift_title)
        shift_buttons = QHBoxLayout()
        shift_buttons.addWidget(make_button("Thêm ca", self.add_shift, primary=True))
        shift_buttons.addWidget(make_button("Sửa ca", self.edit_shift))
        shift_buttons.addWidget(make_button("Bật / Tắt toàn hệ thống", self.toggle_shift))
        shift_buttons.addWidget(make_button("Xóa ca", self.delete_shift, danger=True))
        shift_buttons.addStretch()
        shift_buttons.addWidget(make_button("Lưu giờ & trạng thái ca", self.save_branch_shifts, primary=True))
        right_layout.addLayout(shift_buttons)
        self.shift_table = QTableWidget(0, 9)
        self.shift_table.setHorizontalHeaderLabels([
            "ID", "SỬ DỤNG", "MÃ CA", "TÊN CA", "BẮT ĐẦU", "KẾT THÚC", "MÀU", "TRẠNG THÁI CHUNG", "THỨ TỰ"
        ])
        self.shift_table.setColumnHidden(0, True)
        self.shift_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.shift_table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.shift_table.verticalHeader().setVisible(False)
        self.shift_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Stretch)
        self.shift_table.setColumnWidth(1, 95)
        self.shift_table.setColumnWidth(4, 105)
        self.shift_table.setColumnWidth(5, 105)
        self.shift_table.doubleClicked.connect(self.edit_shift)
        right_layout.addWidget(self.shift_table, 1)
        content.addWidget(right, 7)
        layout.addLayout(content, 1)
        self.refresh()

    def selected_branch_id(self) -> int | None:
        row = self.branch_table.currentRow()
        item = self.branch_table.item(row, 0) if row >= 0 else None
        return int(item.text()) if item else None

    def selected_shift_id(self) -> int | None:
        row = self.shift_table.currentRow()
        item = self.shift_table.item(row, 0) if row >= 0 else None
        return int(item.text()) if item else None

    def add_branch(self) -> None:
        dialog = BranchDialog(self)
        if dialog.exec() != QDialog.Accepted:
            return
        try:
            branch_id = self.db.save_branch(**dialog.values())
        except DatabaseError as exc:
            warning(self, "Không thể lưu cơ sở", str(exc))
            return
        self.refresh(select_branch_id=branch_id)
        self.data_changed.emit()

    def edit_branch(self) -> None:
        branch_id = self.selected_branch_id()
        if branch_id is None:
            warning(self, "Chưa chọn cơ sở", "Chọn một cơ sở cần sửa.")
            return
        row = self.db.get_branch(branch_id)
        if row is None:
            return
        dialog = BranchDialog(self, dict(row))
        if dialog.exec() != QDialog.Accepted:
            return
        try:
            self.db.save_branch(branch_id=branch_id, **dialog.values())
        except DatabaseError as exc:
            warning(self, "Không thể lưu cơ sở", str(exc))
            return
        self.refresh(select_branch_id=branch_id)
        self.data_changed.emit()

    def toggle_branch(self) -> None:
        branch_id = self.selected_branch_id()
        if branch_id is None:
            warning(self, "Chưa chọn cơ sở", "Chọn cơ sở cần bật hoặc tắt.")
            return
        row = self.db.get_branch(branch_id)
        active = str(row["status"]) == "Đang hoạt động" if row else False
        action = "ngừng hoạt động" if active else "kích hoạt lại"
        if not confirm(self, "Xác nhận", f"Xác nhận {action} cơ sở này? Dữ liệu cũ không bị xóa."):
            return
        self.db.set_branch_status(branch_id, not active)
        self.refresh(select_branch_id=branch_id)
        self.data_changed.emit()

    def delete_branch(self) -> None:
        branch_id = self.selected_branch_id()
        if branch_id is None:
            warning(self, "Chưa chọn cơ sở", "Chọn cơ sở cần xóa.")
            return
        if not confirm(self, "Xóa cơ sở", "Chỉ cơ sở chưa phát sinh dữ liệu mới được xóa. Tiếp tục?"):
            return
        try:
            self.db.delete_branch(branch_id)
        except DatabaseError as exc:
            warning(self, "Không thể xóa", str(exc))
            return
        self.refresh()
        self.data_changed.emit()

    def add_shift(self) -> None:
        dialog = ShiftDialog(self)
        if dialog.exec() != QDialog.Accepted:
            return
        try:
            self.db.save_shift(**dialog.values())
        except DatabaseError as exc:
            warning(self, "Không thể lưu ca", str(exc))
            return
        self.refresh(select_branch_id=self.selected_branch_id())
        self.data_changed.emit()

    def edit_shift(self) -> None:
        shift_id = self.selected_shift_id()
        if shift_id is None:
            warning(self, "Chưa chọn ca", "Chọn ca cần sửa.")
            return
        row = next((dict(item) for item in self.db.list_shifts(active_only=False) if int(item["id"]) == shift_id), None)
        if row is None:
            return
        dialog = ShiftDialog(self, row)
        if dialog.exec() != QDialog.Accepted:
            return
        try:
            self.db.save_shift(shift_id=shift_id, **dialog.values())
        except DatabaseError as exc:
            warning(self, "Không thể lưu ca", str(exc))
            return
        self.refresh(select_branch_id=self.selected_branch_id())
        self.data_changed.emit()

    def toggle_shift(self) -> None:
        shift_id = self.selected_shift_id()
        if shift_id is None:
            warning(self, "Chưa chọn ca", "Chọn ca cần bật hoặc tắt toàn hệ thống.")
            return
        row = next((item for item in self.db.list_shifts(active_only=False) if int(item["id"]) == shift_id), None)
        active = str(row["status"]) == "Đang sử dụng" if row else False
        if not confirm(self, "Xác nhận", "Thao tác này áp dụng cho lịch mới và không xóa dữ liệu cũ. Tiếp tục?"):
            return
        self.db.set_shift_status(shift_id, not active)
        self.refresh(select_branch_id=self.selected_branch_id())
        self.data_changed.emit()

    def delete_shift(self) -> None:
        shift_id = self.selected_shift_id()
        if shift_id is None:
            warning(self, "Chưa chọn ca", "Chọn ca cần xóa.")
            return
        if not confirm(self, "Xóa ca", "Chỉ ca chưa phát sinh dữ liệu mới được xóa. Tiếp tục?"):
            return
        try:
            self.db.delete_shift(shift_id)
        except DatabaseError as exc:
            warning(self, "Không thể xóa", str(exc))
            return
        self.refresh(select_branch_id=self.selected_branch_id())
        self.data_changed.emit()

    def save_branch_shifts(self) -> None:
        branch_id = self.selected_branch_id()
        if branch_id is None:
            warning(self, "Chưa chọn cơ sở", "Chọn cơ sở trước khi lưu giờ ca.")
            return
        values: dict[int, dict] = {}
        for row in range(self.shift_table.rowCount()):
            shift_id = int(self.shift_table.item(row, 0).text())
            enabled_item = self.shift_table.item(row, 1)
            values[shift_id] = {
                "enabled": enabled_item.checkState() == Qt.Checked,
                "start_time": self.shift_table.item(row, 4).text().strip(),
                "end_time": self.shift_table.item(row, 5).text().strip(),
                "sort_order": int(self.shift_table.item(row, 8).text() or 0),
            }
        try:
            self.db.save_branch_shift_settings(branch_id, values)
        except (DatabaseError, ValueError) as exc:
            warning(self, "Không thể lưu giờ ca", str(exc))
            return
        self.refresh(select_branch_id=branch_id)
        self.data_changed.emit()
        info(self, "Đã lưu", "Đã lưu ca làm việc và giờ riêng của cơ sở.")

    def _branch_selected(self) -> None:
        self.refresh_shifts()

    def refresh(self, select_branch_id: int | None = None) -> None:
        current = select_branch_id or self.selected_branch_id()
        self.branch_rows = self.db.list_branches(active_only=False)
        self.branch_table.setRowCount(len(self.branch_rows))
        target_row = 0
        for row_index, branch in enumerate(self.branch_rows):
            enabled_count = sum(1 for item in self.db.list_branch_shifts(int(branch["id"])) if int(item["enabled"]) and item["status"] == "Đang sử dụng")
            values = [
                branch["id"], branch["internal_code"], branch["ui_code"], branch["name"], branch["status"], enabled_count, branch["sort_order"]
            ]
            for column, value in enumerate(values):
                item = QTableWidgetItem(str(value))
                if column in (1, 2, 4, 5, 6):
                    item.setTextAlignment(Qt.AlignCenter)
                if branch["status"] != "Đang hoạt động":
                    item.setForeground(QColor("#94A3B8"))
                self.branch_table.setItem(row_index, column, item)
            if current is not None and int(branch["id"]) == int(current):
                target_row = row_index
            self.branch_table.setRowHeight(row_index, 42)
        if self.branch_rows:
            self.branch_table.selectRow(target_row)
        else:
            self.shift_table.setRowCount(0)
            self.branch_shift_title.setText("CA LÀM VIỆC TẠI CƠ SỞ")

    def refresh_shifts(self) -> None:
        branch_id = self.selected_branch_id()
        if branch_id is None:
            self.shift_table.setRowCount(0)
            return
        branch = self.db.get_branch(branch_id)
        self.branch_shift_title.setText(f"CA LÀM VIỆC TẠI {branch['ui_code']} – {branch['name']}")
        self.shift_rows = self.db.list_branch_shifts(branch_id)
        self.shift_table.setRowCount(len(self.shift_rows))
        for row_index, shift in enumerate(self.shift_rows):
            id_item = QTableWidgetItem(str(shift["shift_id"]))
            self.shift_table.setItem(row_index, 0, id_item)
            enabled = QTableWidgetItem("")
            enabled.setFlags(enabled.flags() | Qt.ItemIsUserCheckable)
            enabled.setCheckState(Qt.Checked if int(shift["enabled"]) else Qt.Unchecked)
            enabled.setTextAlignment(Qt.AlignCenter)
            self.shift_table.setItem(row_index, 1, enabled)
            values = [shift["code"], shift["name"], shift["start_time"] or "", shift["end_time"] or "", shift["color"], shift["status"], shift["branch_sort_order"]]
            for offset, value in enumerate(values, start=2):
                item = QTableWidgetItem(str(value))
                if offset not in (4, 5, 8):
                    item.setFlags(item.flags() & ~Qt.ItemIsEditable)
                if offset in (2, 4, 5, 7, 8):
                    item.setTextAlignment(Qt.AlignCenter)
                if offset == 6 and QColor(str(value)).isValid():
                    item.setBackground(QColor(str(value)))
                if shift["status"] != "Đang sử dụng":
                    item.setForeground(QColor("#94A3B8"))
                self.shift_table.setItem(row_index, offset, item)
            self.shift_table.setRowHeight(row_index, 42)


class EmployeesPage(QWidget):
    data_changed = Signal()

    def __init__(self, db: Database, project_root: Path) -> None:
        super().__init__()
        self.db = db
        self.project_root = project_root
        self.current_rows: list = []
        layout = QVBoxLayout(self)
        layout.setContentsMargins(28, 24, 28, 24)
        layout.setSpacing(14)
        title = QLabel("DANH SÁCH NHÂN VIÊN")
        title.setObjectName("PageTitle")
        layout.addWidget(title)

        stats = QGridLayout()
        stats.setHorizontalSpacing(10)
        stats.setVerticalSpacing(10)
        labels = ["TỔNG NHÂN VIÊN", "ĐANG LÀM", "NGỪNG LÀM", "QUẢN LÝ", "CẤP 1", "CẤP 2", "THỬ VIỆC"]
        self.stat_values: dict[str, QLabel] = {}
        for index, label_text in enumerate(labels):
            frame, value = card(label_text)
            frame.setMaximumHeight(92)
            frame.layout().setContentsMargins(14, 10, 14, 10)
            self.stat_values[label_text] = value
            stats.addWidget(frame, index // 4, index % 4)
        for col in range(4):
            stats.setColumnStretch(col, 1)
        layout.addLayout(stats)

        filters_frame = QFrame()
        filters_frame.setObjectName("Card")
        filters = QGridLayout(filters_frame)
        filters.setContentsMargins(16, 14, 16, 14)
        filters.setHorizontalSpacing(12)
        filters.setVerticalSpacing(10)
        self.search = QLineEdit()
        self.search.setPlaceholderText("TÌM THEO MÃ HOẶC TÊN NHÂN VIÊN...")
        self.search.setMinimumWidth(360)
        self.search.setMinimumHeight(44)
        self.rank_filter = QComboBox()
        self.rank_filter.addItem("TẤT CẢ PHÂN CẤP", "")
        for item in RANKS:
            self.rank_filter.addItem(item, item)
        self.status_filter = QComboBox()
        self.status_filter.addItem("TẤT CẢ TRẠNG THÁI", "")
        for item in EMPLOYEE_STATUSES:
            self.status_filter.addItem(item, item)
        self.branch_filter = QComboBox()
        self._reload_branch_filter()
        self.role_filter = QComboBox()
        self.role_filter.addItem("TẤT CẢ VỊ TRÍ", "")
        for item in ROLES:
            self.role_filter.addItem(item, item)
        for combo in (self.rank_filter, self.status_filter, self.branch_filter, self.role_filter):
            combo.setMinimumWidth(210)
            combo.setMinimumHeight(44)
            combo.setSizeAdjustPolicy(QComboBox.SizeAdjustPolicy.AdjustToMinimumContentsLengthWithIcon)
            combo.setMinimumContentsLength(18)
        filters.addWidget(self.search, 0, 0, 1, 2)
        filters.addWidget(self.rank_filter, 0, 2)
        filters.addWidget(self.status_filter, 0, 3)
        filters.addWidget(self.branch_filter, 1, 0)
        filters.addWidget(self.role_filter, 1, 1)
        filters.setColumnStretch(0, 2)
        filters.setColumnStretch(1, 2)
        filters.setColumnStretch(2, 1)
        filters.setColumnStretch(3, 1)
        layout.addWidget(filters_frame)

        toolbar_frame = QFrame()
        toolbar_frame.setObjectName("Card")
        toolbar = QHBoxLayout(toolbar_frame)
        toolbar.setContentsMargins(14, 12, 14, 12)
        toolbar.setSpacing(10)
        toolbar.addWidget(make_button("THÊM NHÂN VIÊN", self.add_employee, primary=True))
        toolbar.addWidget(make_button("SỬA NHÂN VIÊN", self.edit_employee))
        self.status_button = make_button("NGỪNG LÀM / KÍCH HOẠT LẠI", self.toggle_employee_status)
        self.status_button.setMinimumWidth(260)
        toolbar.addWidget(self.status_button)
        toolbar.addWidget(make_button("XÓA", self.delete_employee, danger=True))
        toolbar.addWidget(make_button("NHẬP EXCEL", self.import_excel))
        toolbar.addWidget(make_button("LƯU FILE MẪU", self.save_template))
        export_form_button = make_button("XUẤT DS CHO GOOGLE FORM", self.export_for_google_form, primary=True)
        export_form_button.setMinimumWidth(250)
        toolbar.addWidget(export_form_button)
        toolbar.addStretch()
        layout.addWidget(toolbar_frame)

        self.table = QTableWidget(0, 9)
        self.table.setHorizontalHeaderLabels(
            ["ID", "STT", "MÃ NV", "TÊN NHÂN VIÊN", "PHÂN CẤP", "TRẠNG THÁI", "CƠ SỞ LÀM VIỆC", "VỊ TRÍ ĐẢM NHIỆM", "VỊ TRÍ ƯU TIÊN"]
        )
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        self.table.setColumnHidden(0, True)
        header = self.table.horizontalHeader()
        header.setMinimumHeight(48)
        header.setSectionResizeMode(1, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(2, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.Stretch)
        header.setSectionResizeMode(4, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(5, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(6, QHeaderView.Stretch)
        header.setSectionResizeMode(7, QHeaderView.Stretch)
        header.setSectionResizeMode(8, QHeaderView.ResizeToContents)
        self.table.verticalHeader().setDefaultSectionSize(44)
        layout.addWidget(self.table, 1)

        self.search.textChanged.connect(self.refresh)
        self.rank_filter.currentIndexChanged.connect(self.refresh)
        self.branch_filter.currentIndexChanged.connect(self.refresh)
        self.role_filter.currentIndexChanged.connect(self.refresh)
        self.status_filter.currentIndexChanged.connect(self.refresh)
        self.table.doubleClicked.connect(self.edit_employee)
        self.table.itemSelectionChanged.connect(self._update_status_button)
        self.refresh()

    def _reload_branch_filter(self) -> None:
        current = self.branch_filter.currentData() if hasattr(self, "branch_filter") else ""
        self.branch_filter.blockSignals(True)
        self.branch_filter.clear()
        self.branch_filter.addItem("TẤT CẢ CƠ SỞ", "")
        for branch in self.db.list_branches(active_only=False):
            self.branch_filter.addItem(f"{branch['ui_code']} – {branch['name']}", str(branch["ui_code"]))
        index = self.branch_filter.findData(current)
        self.branch_filter.setCurrentIndex(index if index >= 0 else 0)
        self.branch_filter.blockSignals(False)

    def selected_id(self) -> int | None:
        row = self.table.currentRow()
        if row < 0:
            return None
        item = self.table.item(row, 0)
        return int(item.text()) if item else None

    def add_employee(self) -> None:
        dialog = EmployeeDialog(self, self.db)
        if dialog.exec() != QDialog.Accepted:
            return
        try:
            self.db.save_employee(**dialog.values())
        except DatabaseError as exc:
            warning(self, "Không thể lưu", str(exc))
            return
        self.refresh()
        self.data_changed.emit()

    def edit_employee(self) -> None:
        employee_id = self.selected_id()
        if employee_id is None:
            warning(self, "Chưa chọn nhân viên", "Chọn một nhân viên cần sửa.")
            return
        employee = self.db.get_employee(employee_id)
        if employee is None:
            return
        dialog = EmployeeDialog(self, self.db, employee)
        if dialog.exec() != QDialog.Accepted:
            return
        try:
            self.db.save_employee(employee_id=employee_id, **dialog.values())
        except DatabaseError as exc:
            warning(self, "Không thể lưu", str(exc))
            return
        self.refresh()
        self.data_changed.emit()

    def toggle_employee_status(self) -> None:
        employee_id = self.selected_id()
        if employee_id is None:
            warning(self, "Chưa chọn nhân viên", "Chọn một nhân viên cần đổi trạng thái.")
            return
        employee = self.db.get_employee(employee_id)
        if not employee:
            return
        next_status = "Ngừng làm" if employee["status"] == "Đang làm" else "Đang làm"
        action = "NGỪNG LÀM" if next_status == "Ngừng làm" else "KÍCH HOẠT LẠI"
        if not confirm(self, action, f"{action} nhân viên {employee['code']} – {employee['name']}?"):
            return
        self.db.set_employee_status(employee_id, next_status)
        self.refresh()
        self.data_changed.emit()

    def _update_status_button(self) -> None:
        employee_id = self.selected_id()
        if employee_id is None:
            self.status_button.setText("NGỪNG LÀM / KÍCH HOẠT LẠI")
            return
        employee = self.db.get_employee(employee_id)
        if employee and employee["status"] == "Đang làm":
            self.status_button.setText("NGỪNG LÀM")
        else:
            self.status_button.setText("KÍCH HOẠT LẠI")

    def delete_employee(self) -> None:
        employee_id = self.selected_id()
        if employee_id is None:
            warning(self, "Chưa chọn nhân viên", "Chọn một nhân viên cần xóa.")
            return
        employee = self.db.get_employee(employee_id)
        if not employee:
            return
        if self.db.employee_has_data(employee_id):
            warning(
                self,
                "Không thể xóa",
                "Nhân viên đã phát sinh Order, lịch cố định hoặc lịch làm. Hãy chuyển nhân viên sang trạng thái NGỪNG LÀM.",
            )
            return
        if not confirm(
            self,
            "Xóa nhân viên",
            f"Xóa hoàn toàn {employee['code']} – {employee['name']}? Phần mềm sẽ sao lưu trước khi thực hiện.",
        ):
            return
        self.db.delete_employee(employee_id)
        self.refresh()
        self.data_changed.emit()

    def import_excel(self) -> None:
        filename, _ = QFileDialog.getOpenFileName(self, "Chọn file danh sách nhân viên", "", "Excel (*.xlsx)")
        if not filename:
            return
        try:
            branches = self.db.list_branches()
            valid_codes = (
                {str(b["code"]).upper() for b in branches}
                | {str(b["ui_code"]).upper() for b in branches}
                | {str(b["internal_code"]).upper() for b in branches}
            )
            rows = import_employee_rows(Path(filename), valid_codes)
            added, updated = self.db.import_employees(rows)
        except (ExcelImportError, DatabaseError) as exc:
            warning(self, "Không thể nhập file", str(exc))
            return
        self.refresh()
        self.data_changed.emit()
        info(self, "Nhập thành công", f"Đã thêm {added} nhân viên và cập nhật {updated} nhân viên.")

    def save_template(self) -> None:
        source = self.project_root / "templates" / "Mau_danh_sach_nhan_vien.xlsx"
        target, _ = QFileDialog.getSaveFileName(self, "Lưu file mẫu", "Mau_danh_sach_nhan_vien.xlsx", "Excel (*.xlsx)")
        if target:
            shutil.copy2(source, target)
            info(self, "Đã lưu", "Đã lưu file mẫu danh sách nhân viên.")

    def export_for_google_form(self) -> None:
        default_path = str(Path.home() / "Downloads" / "DANH_SACH_NHAN_VIEN_GOOGLE_FORM.xlsx")
        target, _ = QFileDialog.getSaveFileName(
            self,
            "Lưu danh sách nhân viên cho Google Form",
            default_path,
            "Excel (*.xlsx)",
        )
        if not target:
            return
        try:
            rows = self.db.list_employees()
            xlsx_path = export_employee_form_files(Path(target), rows)
        except (OSError, ValueError) as exc:
            warning(self, "Không thể xuất danh sách", str(exc))
            return
        info(
            self,
            "Đã xuất danh sách nhân viên",
            "Đã lưu file Excel chỉ gồm NHÂN VIÊN ĐANG LÀM và đúng 2 cột: Mã NV + Họ và tên.\n\n"
            f"File: {xlsx_path.name}",
        )

    def _update_stats(self) -> None:
        rows = self.db.list_employees()
        counts = {
            "TỔNG NHÂN VIÊN": len(rows),
            "ĐANG LÀM": sum(1 for row in rows if row["status"] == "Đang làm"),
            "NGỪNG LÀM": sum(1 for row in rows if row["status"] == "Ngừng làm"),
            "QUẢN LÝ": sum(1 for row in rows if row["rank"] == "Quản lý"),
            "CẤP 1": sum(1 for row in rows if row["rank"] == "Cấp 1"),
            "CẤP 2": sum(1 for row in rows if row["rank"] == "Cấp 2"),
            "THỬ VIỆC": sum(1 for row in rows if row["rank"] == "Thử việc"),
        }
        for key, value in counts.items():
            self.stat_values[key].setText(str(value))

    def refresh(self) -> None:
        self._reload_branch_filter()
        self._update_stats()
        self.current_rows = self.db.list_employees(
            search=self.search.text(),
            rank=self.rank_filter.currentData() or "",
            branch_code=self.branch_filter.currentData() or "",
            status=self.status_filter.currentData() or "",
            role=self.role_filter.currentData() or "",
        )
        self.table.setRowCount(len(self.current_rows))
        for r, row in enumerate(self.current_rows):
            values = [
                row["id"], r + 1, row["code"], row["name"], row["rank"],
                row["status"], row["branches"], row["roles"], row["preferred_role"] or "—",
            ]
            for c, value in enumerate(values):
                item = QTableWidgetItem(str(value))
                if c in (1, 2, 4, 5, 8):
                    item.setTextAlignment(Qt.AlignCenter)
                if row["status"] == "Ngừng làm":
                    item.setForeground(QColor("#94A3B8"))
                elif c == 5:
                    item.setBackground(QColor("#DCFCE7"))
                    item.setForeground(QColor("#166534"))
                self.table.setItem(r, c, item)
            self.table.setRowHeight(r, 44)
        self._update_status_button()


class StaffingBranchWidget(QWidget):
    """Bảng định biên một cơ sở, tự động lưu sau mỗi thay đổi."""

    def __init__(self, db: Database, branch_row) -> None:
        super().__init__()
        self.db = db
        self.branch = branch_row
        self.shift_rows = [
            row for row in self.db.list_branch_shifts(int(branch_row["id"]))
            if row["status"] == "Đang sử dụng" and bool(row["enabled"])
        ]
        self.shifts = [str(row["name"]) for row in self.shift_rows]
        self.inputs: dict[tuple[int, str, str], QSpinBox] = {}
        self.total_labels: dict[tuple[int, str], QLabel] = {}
        self._last_values: dict[tuple[int, str, str], int] = {}
        self._undo_stack: list[tuple[tuple[int, str, str], int, int]] = []
        self._redo_stack: list[tuple[tuple[int, str, str], int, int]] = []
        self._ignore_changes = False

        self.save_timer = QTimer(self)
        self.save_timer.setSingleShot(True)
        self.save_timer.setInterval(500)
        self.save_timer.timeout.connect(self.flush_save)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(12)

        summary = QFrame()
        summary.setObjectName("Card")
        summary_layout = QHBoxLayout(summary)
        summary_layout.setContentsMargins(16, 12, 16, 12)
        name = QLabel(f"{branch_row['ui_code']} – {branch_row['name']}")
        name.setStyleSheet("font-size:17px; font-weight:800; color:#1E3A8A;")
        summary_layout.addWidget(name)
        shift_text = " • ".join(self.shifts) if self.shifts else "CHƯA BẬT CA NÀO"
        shift_label = QLabel(f"{len(self.shifts)} CA ĐANG SỬ DỤNG: {shift_text}")
        shift_label.setObjectName("Muted")
        shift_label.setWordWrap(True)
        summary_layout.addWidget(shift_label, 1)
        self.save_status = QLabel("ĐÃ LƯU")
        self.save_status.setAlignment(Qt.AlignCenter)
        self.save_status.setMinimumWidth(190)
        self._set_status("ĐÃ LƯU", "saved")
        summary_layout.addWidget(self.save_status)
        layout.addWidget(summary)

        hint = QLabel(
            "THAY ĐỔI ĐƯỢC TỰ ĐỘNG LƯU SAU 0,5 GIÂY. DÙNG COMMAND + Z ĐỂ HOÀN TÁC VÀ "
            "COMMAND + SHIFT + Z ĐỂ LÀM LẠI. DÒNG TỔNG CA TỰ TÍNH."
        )
        hint.setObjectName("Muted")
        hint.setWordWrap(True)
        layout.addWidget(hint)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(0, 0, 12, 8)
        content_layout.setSpacing(14)

        if not self.shift_rows:
            empty = QFrame()
            empty.setObjectName("Card")
            empty_layout = QVBoxLayout(empty)
            empty_label = QLabel("CƠ SỞ CHƯA BẬT CA LÀM VIỆC. HÃY THIẾT LẬP TẠI DANH SÁCH CƠ SỞ & CA LÀM VIỆC.")
            empty_label.setAlignment(Qt.AlignCenter)
            empty_label.setWordWrap(True)
            empty_label.setObjectName("Muted")
            empty_layout.addWidget(empty_label)
            content_layout.addWidget(empty)
        else:
            for shift_row in self.shift_rows:
                self._add_shift_block(content_layout, shift_row)
        content_layout.addStretch()
        scroll.setWidget(content)
        layout.addWidget(scroll, 1)

        undo_shortcut = QShortcut(QKeySequence.Undo, self)
        undo_shortcut.activated.connect(self.undo)
        redo_shortcut = QShortcut(QKeySequence.Redo, self)
        redo_shortcut.activated.connect(self.redo)
        self._shortcuts = [undo_shortcut, redo_shortcut]
        self.load()

    def _add_shift_block(self, parent_layout: QVBoxLayout, shift_row) -> None:
        shift = str(shift_row["name"])
        color = str(shift_row["color"] or "#DBEAFE")
        if not QColor(color).isValid():
            color = "#DBEAFE"
        block = QFrame()
        block.setObjectName("Card")
        block_layout = QVBoxLayout(block)
        block_layout.setContentsMargins(0, 0, 0, 14)
        block_layout.setSpacing(0)

        header = QLabel(f"CA {shift}")
        header.setMinimumHeight(46)
        header.setAlignment(Qt.AlignCenter)
        header.setStyleSheet(
            f"background:{color}; color:#0F172A; font-size:16px; font-weight:800; "
            "padding:10px; border-top-left-radius:9px; border-top-right-radius:9px;"
        )
        block_layout.addWidget(header)

        grid_widget = QWidget()
        grid = QGridLayout(grid_widget)
        grid.setContentsMargins(14, 12, 14, 0)
        grid.setHorizontalSpacing(8)
        grid.setVerticalSpacing(8)
        headers = ["VỊ TRÍ"] + [name.upper() for name in WEEKDAY_NAMES]
        for col, text in enumerate(headers):
            label = QLabel(text)
            label.setAlignment(Qt.AlignCenter)
            label.setMinimumHeight(42)
            label.setStyleSheet(
                "font-weight:800; background:#1E3A8A; color:#FFFFFF; padding:8px; "
                "border:1px solid #60A5FA;"
            )
            grid.addWidget(label, 0, col)
        grid.setColumnMinimumWidth(0, 220)
        grid.setColumnStretch(0, 2)

        for role_index, role in enumerate(ROLES, start=1):
            label = QLabel(f"{shift} – {role}")
            label.setMinimumHeight(48)
            label.setStyleSheet("padding:10px; font-weight:800; background:#F8FAFC; border:1px solid #CBD5E1;")
            grid.addWidget(label, role_index, 0)
            for weekday in range(7):
                key = (weekday, shift, role)
                spin = QSpinBox()
                spin.setRange(0, 50)
                spin.setSingleStep(1)
                spin.setAccelerated(True)
                spin.setButtonSymbols(QAbstractSpinBox.ButtonSymbols.UpDownArrows)
                spin.setAlignment(Qt.AlignCenter)
                spin.setMinimumSize(94, 48)
                spin.setMaximumWidth(130)
                spin.setStyleSheet(
                    "QSpinBox {font-size:16px; font-weight:800; padding-right:25px; background:#FFFFFF;}"
                    "QSpinBox::up-button, QSpinBox::down-button {width:24px;}"
                )
                spin.valueChanged.connect(lambda value, k=key: self._on_value_changed(k, value))
                self.inputs[key] = spin
                grid.addWidget(spin, role_index, weekday + 1, alignment=Qt.AlignCenter)
                grid.setColumnStretch(weekday + 1, 1)

        total_row = len(ROLES) + 1
        total_caption = QLabel(f"TỔNG CA {shift}")
        total_caption.setMinimumHeight(46)
        total_caption.setStyleSheet(
            "padding:10px; font-weight:800; color:#1E3A8A; background:#DBEAFE; border:1px solid #93C5FD;"
        )
        grid.addWidget(total_caption, total_row, 0)
        for weekday in range(7):
            total = QLabel("0")
            total.setAlignment(Qt.AlignCenter)
            total.setMinimumHeight(46)
            total.setStyleSheet(
                "font-size:16px; padding:10px; font-weight:800; color:#1D4ED8; "
                "background:#DBEAFE; border:1px solid #93C5FD;"
            )
            self.total_labels[(weekday, shift)] = total
            grid.addWidget(total, total_row, weekday + 1)
        block_layout.addWidget(grid_widget)
        parent_layout.addWidget(block)

    def _set_status(self, text: str, state: str) -> None:
        styles = {
            "saving": "color:#92400E; background:#FEF3C7; border:1px solid #F59E0B; border-radius:8px; padding:7px 10px;",
            "saved": "color:#166534; background:#DCFCE7; border:1px solid #86EFAC; border-radius:8px; padding:7px 10px;",
            "error": "color:#991B1B; background:#FEE2E2; border:1px solid #FCA5A5; border-radius:8px; padding:7px 10px;",
        }
        self.save_status.setText(text)
        self.save_status.setStyleSheet(styles[state] + "font-weight:800;")

    def _on_value_changed(self, key: tuple[int, str, str], value: int) -> None:
        self.update_total(key[0], key[1])
        if self._ignore_changes:
            return
        old_value = self._last_values.get(key, 0)
        new_value = int(value)
        if old_value == new_value:
            return
        self._undo_stack.append((key, old_value, new_value))
        if len(self._undo_stack) > 200:
            self._undo_stack.pop(0)
        self._redo_stack.clear()
        self._last_values[key] = new_value
        self._set_status("ĐANG LƯU…", "saving")
        self.save_timer.start()

    def update_total(self, weekday: int, shift: str) -> None:
        total = sum(self.inputs[(weekday, shift, role)].value() for role in ROLES if (weekday, shift, role) in self.inputs)
        label = self.total_labels.get((weekday, shift))
        if label is not None:
            label.setText(str(total))

    def values(self) -> dict[tuple[int, str, str], int]:
        return {key: widget.value() for key, widget in self.inputs.items()}

    def load(self) -> None:
        values = self.db.get_staffing(int(self.branch["id"]))
        self._ignore_changes = True
        try:
            for key, widget in self.inputs.items():
                widget.setValue(values.get(key, 0))
            self._last_values = {key: widget.value() for key, widget in self.inputs.items()}
            for weekday in range(7):
                for shift in self.shifts:
                    self.update_total(weekday, shift)
        finally:
            self._ignore_changes = False
        self._undo_stack.clear()
        self._redo_stack.clear()
        last_updated = self.db.staffing_last_updated(int(self.branch["id"]))
        if last_updated:
            self._set_status(f"ĐÃ LƯU • {last_updated}", "saved")
        else:
            self._set_status("ĐÃ LƯU • CHƯA CÓ DỮ LIỆU", "saved")

    def flush_save(self) -> None:
        if not self.inputs:
            return
        try:
            self.db.save_staffing(int(self.branch["id"]), self.values(), keep_history=False)
            self._last_values = self.values()
            saved_at = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            self._set_status(f"ĐÃ LƯU • {saved_at}", "saved")
        except Exception as exc:
            self._set_status("LỖI LƯU – THỬ LẠI", "error")
            warning(self, "Không thể tự động lưu", str(exc))

    def undo(self) -> None:
        if not self._undo_stack:
            return
        key, old_value, new_value = self._undo_stack.pop()
        self._redo_stack.append((key, old_value, new_value))
        self._apply_history_value(key, old_value)

    def redo(self) -> None:
        if not self._redo_stack:
            return
        key, old_value, new_value = self._redo_stack.pop()
        self._undo_stack.append((key, old_value, new_value))
        self._apply_history_value(key, new_value)

    def _apply_history_value(self, key: tuple[int, str, str], value: int) -> None:
        widget = self.inputs.get(key)
        if widget is None:
            return
        self._ignore_changes = True
        try:
            widget.setValue(int(value))
            self._last_values[key] = int(value)
            self.update_total(key[0], key[1])
        finally:
            self._ignore_changes = False
        self._set_status("ĐANG LƯU…", "saving")
        self.save_timer.start()


class StaffingPage(QWidget):
    def __init__(self, db: Database) -> None:
        super().__init__()
        self.db = db
        self.branch_widgets: list[StaffingBranchWidget] = []
        self.branch_buttons: list[QPushButton] = []
        self.branch_ids: list[int] = []

        self.layout_root = QVBoxLayout(self)
        self.layout_root.setContentsMargins(28, 24, 28, 24)
        self.layout_root.setSpacing(14)
        title = QLabel("ĐỊNH BIÊN NHÂN SỰ")
        title.setObjectName("PageTitle")
        self.layout_root.addWidget(title)
        note = QLabel(
            "ĐỊNH BIÊN HIỆN TẠI ÁP DỤNG LIÊN TỤC CHO CÁC TUẦN CHƯA CHỐT. "
            "MỖI CƠ SỞ CHỈ HIỂN THỊ CÁC CA ĐANG BẬT; MỌI THAY ĐỔI ĐƯỢC TỰ ĐỘNG LƯU."
        )
        note.setWordWrap(True)
        note.setObjectName("Muted")
        self.layout_root.addWidget(note)

        selector_card = QFrame()
        selector_card.setObjectName("Card")
        selector_layout = QVBoxLayout(selector_card)
        selector_layout.setContentsMargins(14, 12, 14, 12)
        selector_layout.setSpacing(8)
        selector_title = QLabel("CHỌN CƠ SỞ")
        selector_title.setStyleSheet("font-weight:800; color:#1E3A8A;")
        selector_layout.addWidget(selector_title)
        self.branch_scroll = QScrollArea()
        self.branch_scroll.setWidgetResizable(True)
        self.branch_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        self.branch_scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.branch_scroll.setFrameShape(QFrame.NoFrame)
        self.branch_scroll.setFixedHeight(72)
        selector_layout.addWidget(self.branch_scroll)
        self.layout_root.addWidget(selector_card)

        self.stack = QStackedWidget()
        self.layout_root.addWidget(self.stack, 1)
        self._build_branches()

    def _build_branches(self) -> None:
        current_id = self.db.get_setting("staffing_selected_branch")
        while self.stack.count():
            widget = self.stack.widget(0)
            self.stack.removeWidget(widget)
            widget.deleteLater()
        self.branch_widgets.clear()
        self.branch_buttons.clear()
        self.branch_ids.clear()

        button_host = QWidget()
        button_layout = QHBoxLayout(button_host)
        button_layout.setContentsMargins(0, 0, 0, 0)
        button_layout.setSpacing(10)
        group = QButtonGroup(self)
        group.setExclusive(True)
        self._button_group = group

        branches = self.db.list_branches(active_only=True)
        selected_index = 0
        for index, branch in enumerate(branches):
            branch_id = int(branch["id"])
            self.branch_ids.append(branch_id)
            button = QPushButton(f"{branch['ui_code']} – {branch['name']}")
            button.setCheckable(True)
            button.setMinimumWidth(190)
            button.setMinimumHeight(46)
            button.setStyleSheet(
                "QPushButton {background:#FFFFFF; color:#0F172A; border:1px solid #94A3B8; border-radius:8px; padding:8px 14px;}"
                "QPushButton:checked {background:#1D4ED8; color:#FFFFFF; border:1px solid #1E3A8A;}"
            )
            button.clicked.connect(lambda _checked=False, i=index, bid=branch_id: self._select_branch(i, bid))
            group.addButton(button)
            button_layout.addWidget(button)
            self.branch_buttons.append(button)

            page = StaffingBranchWidget(self.db, branch)
            self.branch_widgets.append(page)
            self.stack.addWidget(page)
            if current_id and current_id.isdigit() and int(current_id) == branch_id:
                selected_index = index
        button_layout.addStretch()
        self.branch_scroll.setWidget(button_host)

        if self.branch_buttons:
            self.branch_buttons[selected_index].setChecked(True)
            self.stack.setCurrentIndex(selected_index)
            self.db.set_setting("staffing_selected_branch", str(self.branch_ids[selected_index]))
        else:
            empty = QLabel("CHƯA CÓ CƠ SỞ ĐANG HOẠT ĐỘNG.")
            empty.setAlignment(Qt.AlignCenter)
            empty.setObjectName("Muted")
            self.stack.addWidget(empty)

    def _select_branch(self, index: int, branch_id: int) -> None:
        current = self.stack.currentWidget()
        if isinstance(current, StaffingBranchWidget) and current.save_timer.isActive():
            current.save_timer.stop()
            current.flush_save()
        self.stack.setCurrentIndex(index)
        self.db.set_setting("staffing_selected_branch", str(branch_id))

    def refresh(self) -> None:
        active_ids = [int(row["id"]) for row in self.db.list_branches(active_only=True)]
        if active_ids != self.branch_ids:
            self._build_branches()
            return
        # Ca bật/tắt có thể thay đổi dù danh sách cơ sở không đổi; xây lại khi cấu trúc ca khác.
        structure_changed = False
        for branch_id, widget in zip(self.branch_ids, self.branch_widgets):
            current_shifts = self.db.list_branch_shift_names(branch_id, active_only=True, enabled_only=True)
            if current_shifts != widget.shifts:
                structure_changed = True
                break
        if structure_changed:
            self._build_branches()
            return
        for widget in self.branch_widgets:
            widget.load()


class OrderStatusDelegate(QStyledItemDelegate):
    """Vẽ trạng thái Order có màu và cung cấp danh sách thả xuống khi sửa."""

    status_committed = Signal(int, int, str, str)

    STATUS_COLORS = {
        "ĐI LÀM ĐƯỢC": ("#DCFCE7", "#166534"),
        "NGHỈ": ("#FEE2E2", "#991B1B"),
        "CHƯA ORDER": ("#E5E7EB", "#4B5563"),
    }

    def __init__(self, statuses: list[str], parent: QWidget | None = None, group_size: int = 3) -> None:
        super().__init__(parent)
        self.statuses = statuses
        self.group_size = max(1, int(group_size))

    @classmethod
    def combo_style(cls, status: str) -> str:
        background, foreground = cls.STATUS_COLORS.get(status, cls.STATUS_COLORS["CHƯA ORDER"])
        return (
            "QComboBox {"
            f"background:{background}; color:{foreground}; border:2px solid #2563EB; "
            "border-radius:5px; padding:5px 8px; font-weight:800;"
            "}"
            "QComboBox QAbstractItemView {"
            "background:#FFFFFF; color:#111827; border:1px solid #64748B; "
            "selection-background-color:#DBEAFE; selection-color:#1E3A8A; min-width:210px;"
            "}"
        )

    def paint(self, painter: QPainter, option: QStyleOptionViewItem, index) -> None:
        status = str(index.data(Qt.DisplayRole) or "CHƯA ORDER")
        background, foreground = self.STATUS_COLORS.get(status, self.STATUS_COLORS["CHƯA ORDER"])
        rect = option.rect.adjusted(1, 1, -1, -1)
        dirty = bool(index.data(int(Qt.UserRole) + 3))
        selected = bool(option.state & QStyle.State_Selected)

        painter.save()
        painter.fillRect(rect, QColor(background))

        border_color = QColor("#2563EB") if selected else QColor("#CBD5E1")
        border_width = 3 if selected else 1
        painter.setPen(QPen(border_color, border_width))
        painter.drawRect(rect)

        # Đường phân cách đậm ở đầu mỗi ngày để nhóm 3 ca dễ nhìn.
        if index.column() % self.group_size == 0:
            painter.setPen(QPen(QColor("#1E3A8A"), 3))
            painter.drawLine(option.rect.topLeft(), option.rect.bottomLeft())

        painter.setPen(QColor(foreground))
        font = option.font
        font.setBold(True)
        painter.setFont(font)
        painter.drawText(
            rect.adjusted(6, 2, -6, -2),
            Qt.AlignCenter | Qt.TextWordWrap,
            status,
        )

        if dirty:
            painter.setPen(Qt.NoPen)
            painter.setBrush(QColor("#DC2626"))
            painter.drawEllipse(rect.right() - 11, rect.top() + 4, 7, 7)
        painter.restore()

    def createEditor(self, parent, option, index):
        editor = QComboBox(parent)
        editor.addItems(self.statuses)
        editor.setMinimumWidth(150)
        editor.currentTextChanged.connect(
            lambda value, combo=editor: combo.setStyleSheet(self.combo_style(value))
        )
        return editor

    def setEditorData(self, editor: QComboBox, index) -> None:
        status = str(index.data(Qt.EditRole) or "CHƯA ORDER")
        editor.setCurrentText(status if status in self.statuses else "CHƯA ORDER")
        editor.setStyleSheet(self.combo_style(editor.currentText()))
        QTimer.singleShot(0, editor.showPopup)

    def setModelData(self, editor: QComboBox, model, index) -> None:
        old_status = str(index.data(Qt.EditRole) or "CHƯA ORDER")
        new_status = editor.currentText()
        if old_status == new_status:
            return
        model.setData(index, new_status, Qt.EditRole)
        self.status_committed.emit(index.row(), index.column(), old_status, new_status)

    def updateEditorGeometry(self, editor, option, index) -> None:
        editor.setGeometry(option.rect.adjusted(1, 1, -1, -1))


class OrderPage(QWidget):
    data_changed = Signal()
    week_selected = Signal(int)

    STATUS_OPTIONS = ["CHƯA ORDER", "ĐI LÀM ĐƯỢC", "NGHỈ"]
    EMPLOYEE_ROLE = int(Qt.UserRole)
    WEEKDAY_ROLE = int(Qt.UserRole) + 1
    SHIFT_ROLE = int(Qt.UserRole) + 2
    DIRTY_ROLE = int(Qt.UserRole) + 3

    def __init__(self, db: Database, week_getter: Callable[[], int | None], project_root: Path) -> None:
        super().__init__()
        self.db = db
        self.week_getter = week_getter
        self.project_root = project_root
        self._refreshing = False
        self._dirty = False
        self._undo_stack: list[list[tuple[int, int, str, bool]]] = []
        self._employees: list = []
        self._matrix: dict = {}
        self._latest_import_text = ""
        self._order_shifts: list[str] = self.db.list_shift_names(active_only=True, order_only=True)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 22, 24, 20)
        layout.setSpacing(12)

        title = QLabel("ORDER LỊCH LÀM")
        title.setObjectName("PageTitle")
        layout.addWidget(title)

        self.week_bar = WeekSelectorBar(self.db, self.week_getter)
        self.week_bar.week_selected.connect(self.week_selected.emit)
        layout.addWidget(self.week_bar)

        note = QLabel(
            "NHẤP ĐÚP VÀO MỘT Ô ĐỂ CHỌN TRẠNG THÁI. GIỮ COMMAND TRÊN MAC HOẶC CTRL TRÊN WINDOWS "
            "ĐỂ CHỌN NHIỀU Ô; CŨNG CÓ THỂ KÉO CHUỘT QUA CÁC Ô LIỀN NHAU RỒI DÙNG NÚT SỬA NHANH. "
            "MỌI THAY ĐỔI ĐƯỢC TỰ ĐỘNG LƯU VÀ ĐÁNH DẤU CHẤM ĐỎ."
        )
        note.setWordWrap(True)
        note.setObjectName("Muted")
        layout.addWidget(note)

        toolbar_frame = QFrame()
        toolbar_frame.setObjectName("Card")
        toolbar = QGridLayout(toolbar_frame)
        toolbar.setContentsMargins(14, 12, 14, 12)
        toolbar.setHorizontalSpacing(10)
        toolbar.setVerticalSpacing(10)

        toolbar.addWidget(make_button("NHẬP CÂU TRẢ LỜI FORM", self.import_excel, primary=True), 0, 0)
        toolbar.addWidget(make_button("Lưu file mẫu Order", self.save_template), 0, 1)
        toolbar.addWidget(make_button("Khôi phục bản trước", self.restore), 0, 2)
        toolbar.addWidget(make_button("Xóa dữ liệu tuần", self.clear, danger=True), 0, 3)
        self.overwrite_schedule_button = make_button("GHI ĐÈ ORDER VÀO LỊCH TỔNG", self.overwrite_order_to_schedule)
        self.overwrite_schedule_button.setMinimumWidth(280)
        toolbar.addWidget(self.overwrite_schedule_button, 0, 4)
        self.autosave_label = QLabel("TỰ ĐỘNG LƯU")
        self.autosave_label.setAlignment(Qt.AlignCenter)
        self.autosave_label.setMinimumWidth(150)
        self.autosave_label.setStyleSheet(
            "background:#DCFCE7; color:#166534; border:1px solid #86EFAC; border-radius:7px; padding:9px 12px;"
        )
        toolbar.addWidget(self.autosave_label, 0, 5)
        toolbar.setColumnStretch(6, 1)

        quick_label = QLabel("SỬA NHANH CÁC Ô ĐANG CHỌN:")
        quick_label.setStyleSheet("color:#334155; font-weight:800;")
        toolbar.addWidget(quick_label, 1, 0)

        self.quick_available = make_button("ĐI LÀM ĐƯỢC", lambda: self.apply_status_to_selection("ĐI LÀM ĐƯỢC"))
        self.quick_available.setStyleSheet(
            "QPushButton {background:#DCFCE7; color:#166534; border:1px solid #86EFAC; min-width:145px;}"
            "QPushButton:hover {background:#BBF7D0;}"
        )
        toolbar.addWidget(self.quick_available, 1, 1)

        self.quick_off = make_button("NGHỈ", lambda: self.apply_status_to_selection("NGHỈ"))
        self.quick_off.setStyleSheet(
            "QPushButton {background:#FEE2E2; color:#991B1B; border:1px solid #FCA5A5; min-width:110px;}"
            "QPushButton:hover {background:#FECACA;}"
        )
        toolbar.addWidget(self.quick_off, 1, 2)

        self.quick_unknown = make_button("CHƯA ORDER", lambda: self.apply_status_to_selection("CHƯA ORDER"))
        self.quick_unknown.setStyleSheet(
            "QPushButton {background:#E5E7EB; color:#374151; border:1px solid #9CA3AF; min-width:125px;}"
            "QPushButton:hover {background:#D1D5DB;}"
        )
        toolbar.addWidget(self.quick_unknown, 1, 3)
        toolbar.addWidget(make_button("Hoàn tác", self.undo_last_edit), 1, 4)
        toolbar.addWidget(make_button("Bỏ chọn", self.clear_selection), 1, 5)
        layout.addWidget(toolbar_frame)

        filter_frame = QFrame()
        filter_frame.setObjectName("Card")
        filters = QGridLayout(filter_frame)
        filters.setContentsMargins(14, 12, 14, 12)
        filters.setHorizontalSpacing(10)
        filters.setVerticalSpacing(10)

        self.search_edit = QLineEdit()
        self.search_edit.setPlaceholderText("TÌM THEO MÃ HOẶC TÊN NHÂN VIÊN")
        self.search_edit.setClearButtonEnabled(True)
        self.search_edit.setMinimumWidth(270)
        self.search_edit.textChanged.connect(self._apply_filters)
        filters.addWidget(self.search_edit, 0, 0, 1, 2)

        self.rank_filter = QComboBox()
        self.rank_filter.addItem("TẤT CẢ PHÂN CẤP", "")
        for rank in RANKS:
            self.rank_filter.addItem(rank, rank)
        self.rank_filter.currentIndexChanged.connect(self._apply_filters)
        filters.addWidget(self.rank_filter, 0, 2)

        self.row_filter = QComboBox()
        self.row_filter.addItem("TẤT CẢ NHÂN VIÊN", "all")
        self.row_filter.addItem("CHƯA CÓ ORDER", "without")
        self.row_filter.addItem("CÓ Ô CHƯA ORDER", "has_unknown")
        self.row_filter.addItem("QUẢN LÝ ĐÃ SỬA", "dirty")
        self.row_filter.currentIndexChanged.connect(self._apply_filters)
        filters.addWidget(self.row_filter, 0, 3)

        self.day_filter = QComboBox()
        self.day_filter.addItem("TẤT CẢ NGÀY", -1)
        for weekday, day in enumerate(WEEKDAY_NAMES):
            self.day_filter.addItem(day, weekday)
        self.day_filter.currentIndexChanged.connect(self._apply_filters)
        filters.addWidget(self.day_filter, 1, 0)

        self.shift_filter = QComboBox()
        self.shift_filter.currentIndexChanged.connect(self._apply_filters)
        filters.addWidget(self.shift_filter, 1, 1)

        self.status_filter = QComboBox()
        self.status_filter.addItem("TẤT CẢ TRẠNG THÁI", "")
        self.status_filter.addItem("ĐI LÀM ĐƯỢC", "ĐI LÀM ĐƯỢC")
        self.status_filter.addItem("NGHỈ", "NGHỈ")
        self.status_filter.addItem("CHƯA ORDER", "CHƯA ORDER")
        self.status_filter.currentIndexChanged.connect(self._apply_filters)
        filters.addWidget(self.status_filter, 1, 2)

        reset_filters = make_button("XÓA BỘ LỌC", self._reset_filters)
        filters.addWidget(reset_filters, 1, 3)
        filters.setColumnStretch(4, 1)

        legend = QLabel(
            "<b>CHÚ GIẢI TRẠNG THÁI:</b> "
            "<span style='background:#DCFCE7;color:#166534;padding:5px 10px;border:1px solid #86EFAC;'>XANH: ĐI LÀM ĐƯỢC</span> "
            "<span style='background:#FEE2E2;color:#991B1B;padding:5px 10px;border:1px solid #FCA5A5;'>ĐỎ: NGHỈ</span> "
            "<span style='background:#E5E7EB;color:#4B5563;padding:5px 10px;border:1px solid #9CA3AF;'>XÁM: CHƯA ORDER</span> "
            "<span style='color:#DC2626;font-weight:800;'>● CHẤM ĐỎ: QUẢN LÝ ĐÃ SỬA</span>"
        )
        legend.setTextFormat(Qt.RichText)
        legend.setWordWrap(True)
        filters.addWidget(legend, 2, 0, 1, 5)
        layout.addWidget(filter_frame)

        stats_frame = QFrame()
        stats_frame.setObjectName("Card")
        stats = QGridLayout(stats_frame)
        stats.setContentsMargins(12, 10, 12, 10)
        stats.setHorizontalSpacing(8)
        stats.setVerticalSpacing(8)
        self.stat_active = QLabel()
        self.stat_with = QLabel()
        self.stat_without = QLabel()
        self.stat_available = QLabel()
        self.stat_off = QLabel()
        self.stat_unknown = QLabel()
        self.stat_manual = QLabel()
        self._stat_widgets = [
            self.stat_active,
            self.stat_with,
            self.stat_without,
            self.stat_available,
            self.stat_off,
            self.stat_unknown,
            self.stat_manual,
        ]
        for index, widget in enumerate(self._stat_widgets):
            widget.setAlignment(Qt.AlignCenter)
            widget.setMinimumHeight(38)
            widget.setStyleSheet(
                "background:#F8FAFC; color:#0F172A; border:1px solid #CBD5E1; "
                "border-radius:7px; padding:7px 10px;"
            )
            stats.addWidget(widget, index // 4, index % 4)
        layout.addWidget(stats_frame)

        self.import_info = QLabel()
        self.import_info.setObjectName("Muted")
        self.import_info.setWordWrap(True)
        layout.addWidget(self.import_info)

        tables_frame = QFrame()
        tables_frame.setObjectName("Card")
        tables = QHBoxLayout(tables_frame)
        tables.setContentsMargins(0, 0, 0, 0)
        tables.setSpacing(0)

        self.info_table = QTableWidget(0, 4)
        self.info_table.setHorizontalHeaderLabels(["STT", "MÃ NV", "TÊN NHÂN VIÊN", "PHÂN CẤP"])
        self.info_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.info_table.setSelectionMode(QAbstractItemView.NoSelection)
        self.info_table.setAlternatingRowColors(True)
        self.info_table.verticalHeader().setVisible(False)
        self.info_table.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.info_table.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.info_table.setWordWrap(False)
        self.info_table.setFixedWidth(520)
        self.info_table.setColumnWidth(0, 56)
        self.info_table.setColumnWidth(1, 92)
        self.info_table.setColumnWidth(3, 118)
        self.info_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Fixed)
        self.info_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Fixed)
        self.info_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        self.info_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Fixed)
        self.info_table.horizontalHeader().setMinimumHeight(62)
        tables.addWidget(self.info_table)

        columns = []
        for day in WEEKDAY_NAMES:
            for shift in self._order_shifts:
                columns.append(f"{day}\n{shift}")
        self.table = QTableWidget(0, len(columns))
        self.table.setHorizontalHeaderLabels(columns)
        self.table.setSelectionBehavior(QAbstractItemView.SelectItems)
        self.table.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.table.setEditTriggers(
            QAbstractItemView.DoubleClicked | QAbstractItemView.EditKeyPressed
        )
        self.table.setAlternatingRowColors(False)
        self.table.verticalHeader().setVisible(False)
        self.table.setWordWrap(True)
        self.table.horizontalHeader().setMinimumSectionSize(112)
        self.table.horizontalHeader().setDefaultSectionSize(122)
        self.table.horizontalHeader().setMinimumHeight(78)
        self.table.setMinimumHeight(360)

        day_header_colors = ["#1E3A8A", "#1D4ED8", "#1E3A8A", "#1D4ED8", "#1E3A8A", "#B45309", "#BE123C"]
        for day_index, day in enumerate(WEEKDAY_NAMES):
            for shift_index, shift in enumerate(self._order_shifts):
                column = day_index * len(self._order_shifts) + shift_index
                header_item = QTableWidgetItem(f"{day}\n{shift}")
                header_item.setBackground(QColor(day_header_colors[day_index]))
                header_item.setForeground(QColor("#FFFFFF"))
                self.table.setHorizontalHeaderItem(column, header_item)

        self.order_delegate = OrderStatusDelegate(self.STATUS_OPTIONS, self.table, len(self._order_shifts))
        self.order_delegate.status_committed.connect(self._single_status_committed)
        self.table.setItemDelegate(self.order_delegate)
        tables.addWidget(self.table, 1)
        layout.addWidget(tables_frame, 1)

        self.table.verticalScrollBar().valueChanged.connect(self.info_table.verticalScrollBar().setValue)
        self.info_table.verticalScrollBar().valueChanged.connect(self.table.verticalScrollBar().setValue)

    def _update_day_headers(self, week_id: int | None) -> None:
        day_labels = week_day_headers(self.db, int(week_id) if week_id else None)
        colors = ["#1E3A8A", "#1D4ED8", "#1E3A8A", "#1D4ED8", "#1E3A8A", "#B45309", "#BE123C"]
        for day_index, day_label in enumerate(day_labels):
            for shift_index, shift in enumerate(self._order_shifts):
                column = day_index * max(1, len(self._order_shifts)) + shift_index
                if column >= self.table.columnCount():
                    continue
                item = self.table.horizontalHeaderItem(column) or QTableWidgetItem()
                item.setText(f"{day_label}\n{shift.upper()}")
                item.setBackground(QColor(colors[day_index]))
                item.setForeground(QColor("#FFFFFF"))
                item.setTextAlignment(Qt.AlignCenter)
                self.table.setHorizontalHeaderItem(column, item)
        self.table.horizontalHeader().setMinimumHeight(78)

    def _rebuild_order_columns(self) -> None:
        columns = [f"{day}\n{shift}" for day in WEEKDAY_NAMES for shift in self._order_shifts]
        self.table.clearContents()
        self.table.setColumnCount(len(columns))
        if hasattr(self, "order_delegate"):
            self.order_delegate.group_size = max(1, len(self._order_shifts))
        for column in range(len(columns)):
            self.table.setColumnWidth(column, 122)
        self._update_day_headers(self.week_getter())

    def _reload_shift_filter(self) -> None:
        current = self.shift_filter.currentData() if hasattr(self, "shift_filter") else ""
        self.shift_filter.blockSignals(True)
        self.shift_filter.clear()
        self.shift_filter.addItem("TẤT CẢ CA", "")
        for shift in self._order_shifts:
            self.shift_filter.addItem(shift, shift)
        index = self.shift_filter.findData(current)
        self.shift_filter.setCurrentIndex(index if index >= 0 else 0)
        self.shift_filter.blockSignals(False)

    def _reset_filters(self) -> None:
        self.search_edit.clear()
        self.rank_filter.setCurrentIndex(0)
        self.row_filter.setCurrentIndex(0)
        self.day_filter.setCurrentIndex(0)
        self.shift_filter.setCurrentIndex(0)
        self.status_filter.setCurrentIndex(0)
        self._apply_filters()

    def _single_status_committed(self, row: int, column: int, old_status: str, new_status: str) -> None:
        if self._refreshing:
            return
        item = self.table.item(row, column)
        if item is None:
            return
        old_manual = bool(item.data(self.DIRTY_ROLE))
        operation = [(row, column, old_status, old_manual)]
        item.setData(self.DIRTY_ROLE, True)
        if not self._persist_order_items([item], manual=True):
            item.setText(old_status)
            item.setData(self.DIRTY_ROLE, old_manual)
            return
        self._undo_stack.append(operation)
        self._after_manual_edit()

    def _persist_order_items(self, items: list[QTableWidgetItem], manual: bool) -> bool:
        week_id = self.week_getter()
        if not week_id:
            warning(self, "Chưa chọn tuần", "Tạo và chọn tuần trước khi chỉnh Order.")
            return False
        changes: list[tuple[int, int, str, str, bool]] = []
        for item in items:
            changes.append((
                int(item.data(self.EMPLOYEE_ROLE)),
                int(item.data(self.WEEKDAY_ROLE)),
                str(item.data(self.SHIFT_ROLE)),
                item.text() or "CHƯA ORDER",
                bool(manual),
            ))
        self.autosave_label.setText("ĐANG LƯU…")
        self.autosave_label.setStyleSheet(
            "background:#FEF3C7; color:#92400E; border:1px solid #F59E0B; border-radius:7px; padding:9px 12px;"
        )
        QApplication.processEvents()
        try:
            self.db.set_order_cells(int(week_id), changes)
        except DatabaseError as exc:
            self.autosave_label.setText("LỖI LƯU")
            self.autosave_label.setStyleSheet(
                "background:#FEE2E2; color:#991B1B; border:1px solid #FCA5A5; border-radius:7px; padding:9px 12px;"
            )
            warning(self, "Không thể lưu Order", str(exc))
            return False
        self.autosave_label.setText("ĐÃ LƯU")
        self.autosave_label.setStyleSheet(
            "background:#DCFCE7; color:#166534; border:1px solid #86EFAC; border-radius:7px; padding:9px 12px;"
        )
        self.data_changed.emit()
        return True

    def _after_manual_edit(self) -> None:
        self._dirty = False
        self._update_live_stats()
        self._apply_filters()
        manual_count = self._count_dirty_cells()
        suffix = " LỊCH TỔNG ĐÃ TỒN TẠI; BẤM GHI ĐÈ ORDER VÀO LỊCH TỔNG ĐỂ ÁP DỤNG ORDER MỚI." if (self.week_getter() and self.db.week_schedule_exists(int(self.week_getter()))) else ""
        self.import_info.setText(f"TỰ ĐỘNG LƯU HOÀN TẤT. CÓ {manual_count} Ô DO QUẢN LÝ ĐÃ SỬA.{suffix}")
        self.table.viewport().update()

    def _count_dirty_cells(self) -> int:
        count = 0
        for row in range(self.table.rowCount()):
            for column in range(self.table.columnCount()):
                item = self.table.item(row, column)
                if item is not None and bool(item.data(self.DIRTY_ROLE)):
                    count += 1
        return count

    def selected_order_items(self) -> list[QTableWidgetItem]:
        items = []
        seen: set[tuple[int, int]] = set()
        for index in self.table.selectionModel().selectedIndexes():
            key = (index.row(), index.column())
            if key in seen:
                continue
            seen.add(key)
            item = self.table.item(index.row(), index.column())
            if item is not None:
                items.append(item)
        if not items and self.table.currentItem() is not None:
            items.append(self.table.currentItem())
        return items

    def apply_status_to_selection(self, status: str) -> None:
        if status not in self.STATUS_OPTIONS:
            return
        items = self.selected_order_items()
        if not items:
            warning(self, "Chưa chọn ô", "Chọn một hoặc nhiều ô Order trước khi dùng chức năng sửa nhanh.")
            return
        operation: list[tuple[int, int, str, bool]] = []
        changed_items: list[QTableWidgetItem] = []
        for item in items:
            old_status = item.text() or "CHƯA ORDER"
            old_manual = bool(item.data(self.DIRTY_ROLE))
            if old_status == status and old_manual:
                continue
            operation.append((item.row(), item.column(), old_status, old_manual))
            item.setText(status)
            item.setData(self.DIRTY_ROLE, True)
            changed_items.append(item)
        if not operation:
            return
        if not self._persist_order_items(changed_items, manual=True):
            for row, column, old_status, old_manual in operation:
                item = self.table.item(row, column)
                if item is not None:
                    item.setText(old_status)
                    item.setData(self.DIRTY_ROLE, old_manual)
            return
        self._undo_stack.append(operation)
        self._after_manual_edit()

    def undo_last_edit(self) -> None:
        if not self._undo_stack:
            warning(self, "Không có thao tác", "Chưa có thay đổi nào để hoàn tác.")
            return
        operation = self._undo_stack.pop()
        items: list[QTableWidgetItem] = []
        self._refreshing = True
        try:
            for row, column, old_status, old_manual in operation:
                item = self.table.item(row, column)
                if item is None:
                    continue
                item.setText(old_status)
                item.setData(self.DIRTY_ROLE, old_manual)
                items.append(item)
        finally:
            self._refreshing = False
        week_id = self.week_getter()
        if week_id:
            changes = [
                (int(item.data(self.EMPLOYEE_ROLE)), int(item.data(self.WEEKDAY_ROLE)), str(item.data(self.SHIFT_ROLE)), item.text() or "CHƯA ORDER", bool(item.data(self.DIRTY_ROLE)))
                for item in items
            ]
            try:
                self.db.set_order_cells(int(week_id), changes)
            except DatabaseError as exc:
                warning(self, "Không thể hoàn tác", str(exc))
                self.refresh()
                return
        self.autosave_label.setText("ĐÃ HOÀN TÁC")
        self.data_changed.emit()
        self._after_manual_edit()

    def clear_selection(self) -> None:
        self.table.clearSelection()
        self.table.setCurrentCell(-1, -1)

    def _update_live_stats(self) -> None:
        active = self.table.rowCount()
        with_data = 0
        available = 0
        off = 0
        unknown = 0
        for row in range(self.table.rowCount()):
            row_has_data = False
            for column in range(self.table.columnCount()):
                item = self.table.item(row, column)
                status = item.text() if item else "CHƯA ORDER"
                if status == "ĐI LÀM ĐƯỢC":
                    available += 1
                    row_has_data = True
                elif status == "NGHỈ":
                    off += 1
                    row_has_data = True
                else:
                    unknown += 1
            if row_has_data:
                with_data += 1
        self.stat_active.setText(f"TỔNG NV: {active}")
        self.stat_with.setText(f"CÓ ORDER: {with_data}")
        self.stat_without.setText(f"CHƯA CÓ: {max(0, active - with_data)}")
        self.stat_available.setText(f"ĐI LÀM ĐƯỢC: {available}")
        self.stat_off.setText(f"NGHỈ: {off}")
        self.stat_unknown.setText(f"CHƯA ORDER: {unknown}")
        self.stat_manual.setText(f"Ô ĐÃ SỬA: {self._count_dirty_cells()}")

    def _row_matches_filter(self, row: int) -> bool:
        if row >= len(self._employees):
            return True
        employee = self._employees[row]
        search = self.search_edit.text().strip().casefold()
        if search and search not in str(employee["code"]).casefold() and search not in str(employee["name"]).casefold():
            return False
        rank = self.rank_filter.currentData() or ""
        if rank and employee["rank"] != rank:
            return False

        mode = self.row_filter.currentData() or "all"
        all_statuses = [
            self.table.item(row, column).text() if self.table.item(row, column) else "CHƯA ORDER"
            for column in range(self.table.columnCount())
        ]
        if mode == "without" and any(status != "CHƯA ORDER" for status in all_statuses):
            return False
        if mode == "has_unknown" and not any(status == "CHƯA ORDER" for status in all_statuses):
            return False
        if mode == "dirty":
            if not any(
                self.table.item(row, column) is not None
                and bool(self.table.item(row, column).data(self.DIRTY_ROLE))
                for column in range(self.table.columnCount())
            ):
                return False

        selected_day = int(self.day_filter.currentData()) if self.day_filter.currentData() is not None else -1
        selected_shift = str(self.shift_filter.currentData() or "")
        selected_status = str(self.status_filter.currentData() or "")
        if selected_status:
            matched = False
            shift_count = max(1, len(self._order_shifts))
            for column in range(self.table.columnCount()):
                weekday = column // shift_count
                shift = self._order_shifts[column % shift_count]
                if selected_day >= 0 and weekday != selected_day:
                    continue
                if selected_shift and shift != selected_shift:
                    continue
                item = self.table.item(row, column)
                status = item.text() if item else "CHƯA ORDER"
                if status == selected_status:
                    matched = True
                    break
            if not matched:
                return False
        return True

    def _apply_filters(self, *args) -> None:
        if self._refreshing:
            return
        for row in range(self.table.rowCount()):
            hidden = not self._row_matches_filter(row)
            self.table.setRowHidden(row, hidden)
            self.info_table.setRowHidden(row, hidden)

    def import_excel(self) -> None:
        week_id = self.week_getter()
        if not week_id:
            warning(self, "Chưa chọn tuần", "Tạo và chọn đúng tuần trước khi nhập câu trả lời Form.")
            return
        week = self.db.get_week(int(week_id))
        week_text = format_week(week) if week else str(week_id)
        filename, _ = QFileDialog.getOpenFileName(
            self,
            "Chọn file câu trả lời Google Form",
            "",
            "Dữ liệu Form (*.xlsx *.csv);;Excel (*.xlsx);;CSV (*.csv)",
        )
        if not filename:
            return
        if not confirm(
            self,
            "Nhập câu trả lời Form",
            f"Nhập file câu trả lời vào {week_text}?\n\n"
            "QUY TẮC:\n"
            "• Nhân viên gửi đúng 1 lần: nhập tự động.\n"
            "• Không gửi: giữ CHƯA ORDER.\n"
            "• Gửi từ 2 lần trở lên: KHÔNG nhập lượt nào, giữ CHƯA ORDER để kiểm tra tay.\n"
            "• Các ô quản lý đã sửa tay được giữ nguyên.",
        ):
            return
        try:
            parsed = import_form_response_rows(Path(filename), self._order_shifts)
            result = self.db.import_form_order_responses(int(week_id), parsed, Path(filename).name)
        except (ExcelImportError, DatabaseError, OSError) as exc:
            warning(self, "Không thể nhập câu trả lời Form", str(exc))
            return
        self._dirty = False
        self._undo_stack.clear()
        self.refresh()
        self.data_changed.emit()

        message = (
            f"TỔNG LƯỢT TRONG FILE: {result['submission_count']}\n"
            f"ĐÃ NHẬP TỰ ĐỘNG: {result['imported']} nhân viên\n"
            f"CHƯA GỬI: {len(result['no_response'])} nhân viên\n"
            f"GỬI TRÙNG: {len(result['duplicates'])} nhân viên"
        )
        if result["duplicates"]:
            message += (
                "\n\nGỬI TRÙNG — GIỮ CHƯA ORDER, CẦN KIỂM TRA LẠI:\n"
                + ", ".join(result["duplicates"])
            )
        if result["no_response"]:
            message += "\n\nCHƯA GỬI FORM:\n" + ", ".join(result["no_response"])
        if result["invalid_rows"]:
            message += "\n\nDÒNG KHÔNG HỢP LỆ — KHÔNG NHẬP:\n" + "\n".join(result["invalid_rows"][:10])
        if result["unknown"]:
            message += "\n\nMÃ KHÔNG CÓ TRONG SQLITE — BỎ QUA:\n" + ", ".join(result["unknown"])
        if result["inactive"]:
            message += "\n\nNHÂN VIÊN ĐÃ NGỪNG LÀM — BỎ QUA:\n" + ", ".join(result["inactive"])
        if result["manual_preserved"]:
            message += f"\n\nĐã giữ nguyên {result['manual_preserved']} ô quản lý nhập tay."
        info(self, "Nhập câu trả lời Form hoàn tất", message)

    def clear(self) -> None:
        week_id = self.week_getter()
        if not week_id:
            return
        if not confirm(
            self,
            "Xóa dữ liệu Order",
            "Xóa toàn bộ dữ liệu Order của tuần đang chọn? Phần mềm sẽ lưu bản trước để có thể khôi phục.",
        ):
            return
        self.db.clear_order(week_id)
        self._dirty = False
        self._undo_stack.clear()
        self.refresh()
        self.data_changed.emit()

    def restore(self) -> None:
        week_id = self.week_getter()
        if not week_id:
            return
        if not self.db.restore_last_order(week_id):
            warning(self, "Không có bản trước", "Chưa có dữ liệu Order trước đó để khôi phục.")
            return
        self._dirty = False
        self._undo_stack.clear()
        self.refresh()
        self.data_changed.emit()
        info(self, "Đã khôi phục", "Đã khôi phục bản Order trước lần nhập, sửa hoặc xóa gần nhất.")

    def overwrite_order_to_schedule(self) -> None:
        week_id = self.week_getter()
        if not week_id:
            warning(self, "Chưa chọn tuần", "Hãy chọn tuần trước khi ghi đè Order vào Lịch tổng.")
            return
        week_id = int(week_id)
        if not self.db.week_schedule_exists(week_id):
            warning(self, "Chưa có Lịch tổng", "Tuần này chưa có Lịch tổng. Hãy tạo Lịch tổng trước.")
            return
        if self.db.is_week_closed(week_id):
            warning(self, "Lịch đã chốt", "Hãy mở lại tuần tại CHỐT LỊCH & BÁO CÁO trước khi cập nhật Order.")
            return
        if not confirm(
            self,
            "Ghi đè Order vào Lịch tổng",
            "Đọc lại toàn bộ Order của tuần đang chọn và cập nhật trạng thái Order trong Lịch tổng?\n\n"
            "Các ca đã xếp sẽ KHÔNG bị xóa. Nếu Order mới mâu thuẫn với ca đã xếp, phần mềm chỉ tạo cảnh báo để anh tự xử lý.",
        ):
            return
        try:
            result = self.db.reapply_order_to_schedule(week_id)
        except DatabaseError as exc:
            warning(self, "Không thể ghi đè Order", str(exc))
            return
        self.data_changed.emit()
        self.refresh()
        info(
            self,
            "Đã cập nhật Order",
            f"Đã cập nhật {result['updated']} ô Order vào Lịch tổng.\n"
            f"Bổ sung {result['inserted']} ô còn thiếu.\n"
            f"Giữ nguyên {result['assigned_preserved']} ca đã xếp.\n"
            f"Có {result['conflicts']} ca đã xếp đang mâu thuẫn với Order mới và sẽ xuất hiện trong Cảnh báo.",
        )

    def save_template(self) -> None:
        target, _ = QFileDialog.getSaveFileName(self, "Lưu file mẫu", "Mau_order_lich_lam.xlsx", "Excel (*.xlsx)")
        if not target:
            return
        try:
            create_order_template(Path(target), self._order_shifts)
        except (ExcelImportError, OSError) as exc:
            warning(self, "Không thể tạo file mẫu", str(exc))
            return
        info(self, "Đã lưu", "Đã lưu file mẫu Order theo danh sách ca đang sử dụng.")

    def refresh(self) -> None:
        if self._refreshing:
            return
        self._refreshing = True
        try:
            week_id = self.week_getter()
            self.week_bar.refresh()
            self._update_day_headers(week_id)
            self._employees = self.db.list_employees(status="Đang làm")
            new_shifts = self.db.list_shift_names(active_only=True, order_only=True)
            if new_shifts != self._order_shifts:
                self._order_shifts = new_shifts
                self._rebuild_order_columns()
            self._reload_shift_filter()
            self._matrix = self.db.get_order_matrix(week_id) if week_id else {}
            manual_flags = self.db.get_order_manual_flags(int(week_id)) if week_id else set()
            self._undo_stack.clear()
            self._dirty = False

            row_count = len(self._employees)
            self.info_table.setRowCount(row_count)
            self.table.setRowCount(row_count)

            for row, employee in enumerate(self._employees):
                employee_id = int(employee["id"])
                info_values = [str(row + 1), employee["code"], employee["name"], employee["rank"]]
                for column, value in enumerate(info_values):
                    item = QTableWidgetItem(str(value))
                    item.setTextAlignment(Qt.AlignCenter if column != 2 else Qt.AlignVCenter | Qt.AlignLeft)
                    item.setToolTip(str(value))
                    self.info_table.setItem(row, column, item)

                employee_data = self._matrix.get(employee_id, {})
                column = 0
                for weekday in range(7):
                    for shift in self._order_shifts:
                        status = employee_data.get((weekday, shift), "CHƯA ORDER")
                        item = QTableWidgetItem(status)
                        item.setTextAlignment(Qt.AlignCenter)
                        item.setData(self.EMPLOYEE_ROLE, employee_id)
                        item.setData(self.WEEKDAY_ROLE, weekday)
                        item.setData(self.SHIFT_ROLE, shift)
                        item.setData(self.DIRTY_ROLE, (employee_id, weekday, shift) in manual_flags)
                        item.setToolTip(
                            f"{employee['name']} — {WEEKDAY_NAMES[weekday]} {shift}\n"
                            "Nhấp đúp để sửa hoặc chọn nhiều ô rồi dùng nút SỬA NHANH. Dữ liệu tự động lưu."
                        )
                        self.table.setItem(row, column, item)
                        column += 1

                self.info_table.setRowHeight(row, 44)
                self.table.setRowHeight(row, 44)

            if week_id:
                latest = self.db.latest_order_import(week_id)
                self._latest_import_text = (
                    f"LẦN CẬP NHẬT GẦN NHẤT: {latest['filename']} — {latest['imported_at']}"
                    if latest
                    else "TUẦN NÀY CHƯA CÓ DỮ LIỆU ORDER. CÓ THỂ NHẬP CÂU TRẢ LỜI FORM HOẶC CHỈNH TRỰC TIẾP; MỌI THAY ĐỔI TỰ ĐỘNG LƯU."
                )
            else:
                self._latest_import_text = "CHƯA CHỌN TUẦN."
            self.import_info.setText(self._latest_import_text)
            self._update_live_stats()
        finally:
            self._refreshing = False
        self._apply_filters()



class EvaluationCriterionDialog(QDialog):
    def __init__(self, parent=None, criterion=None, default_role: str = "Pha chế") -> None:
        super().__init__(parent)
        self.criterion = criterion
        self.setWindowTitle("Sửa tiêu chí đánh giá" if criterion else "Thêm tiêu chí đánh giá")
        self.setMinimumWidth(560)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(22, 20, 22, 18)
        layout.setSpacing(14)

        title = QLabel("SỬA TIÊU CHÍ" if criterion else "THÊM TIÊU CHÍ")
        title.setObjectName("PageTitle")
        layout.addWidget(title)

        form = QFormLayout()
        form.setSpacing(12)
        self.role_combo = QComboBox()
        self.role_combo.addItems(ROLES)
        role_value = str(criterion["role"] if criterion else default_role)
        if role_value in ROLES:
            self.role_combo.setCurrentText(role_value)
        if criterion:
            self.role_combo.setEnabled(False)

        self.label_input = QLineEdit(str(criterion["label"] if criterion else ""))
        self.label_input.setPlaceholderText("Ví dụ: Kiểm tra nguyên liệu đầu ca")
        self.max_score_input = QSpinBox()
        self.max_score_input.setRange(1, 100)
        self.max_score_input.setValue(int(criterion["max_score"] if criterion else 5))

        form.addRow("VỊ TRÍ", self.role_combo)
        form.addRow("TÊN TIÊU CHÍ", self.label_input)
        form.addRow("ĐIỂM TỐI ĐA", self.max_score_input)
        layout.addLayout(form)

        note = QLabel(
            "Mã tiêu chí được hệ thống tự tạo và giữ cố định để dữ liệu các kỳ đánh giá không bị lệch."
        )
        note.setObjectName("Muted")
        note.setWordWrap(True)
        layout.addWidget(note)

        buttons = QDialogButtonBox(QDialogButtonBox.Save | QDialogButtonBox.Cancel)
        buttons.button(QDialogButtonBox.Save).setText("LƯU TIÊU CHÍ")
        buttons.button(QDialogButtonBox.Save).setObjectName("Primary")
        buttons.button(QDialogButtonBox.Cancel).setText("HỦY")
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def values(self) -> tuple[str, str, int]:
        return (
            self.role_combo.currentText().strip(),
            self.label_input.text().strip(),
            int(self.max_score_input.value()),
        )



class LegacyEvaluationPage(QWidget):
    """Trang đánh giá cũ 1.4.x, giữ lại để tương thích mã nguồn."""

    ID_ROLE = Qt.UserRole

    def __init__(self, db: Database, project_root: Path) -> None:
        super().__init__()
        self.db = db
        self.project_root = project_root

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 20, 24, 20)
        layout.setSpacing(14)

        title = QLabel("ĐÁNH GIÁ NHÂN VIÊN")
        title.setObjectName("PageTitle")
        layout.addWidget(title)

        note = QLabel(
            "HOÀN THIỆN SQLITE TRƯỚC KHI TẠO FORM — ANH CÓ THỂ THÊM, SỬA TÊN, "
            "SỬA ĐIỂM TỐI ĐA, NGỪNG/BẬT LẠI VÀ SẮP XẾP TIÊU CHÍ. "
            "FILE XUẤT SẼ GỒM CẢ NHÂN VIÊN VÀ BỘ TIÊU CHÍ HIỆN TẠI."
        )
        note.setObjectName("Muted")
        note.setWordWrap(True)
        layout.addWidget(note)

        cards = QHBoxLayout()
        card_active, self.stat_active = card("NHÂN VIÊN ĐANG LÀM")
        card_bar, self.stat_bar = card("CÓ VỊ TRÍ PHA CHẾ")
        card_floor, self.stat_floor = card("CÓ VỊ TRÍ CHẠY BÀN")
        card_criteria, self.stat_criteria = card("TIÊU CHÍ ĐANG DÙNG")
        for item in (card_active, card_bar, card_floor, card_criteria):
            cards.addWidget(item)
        layout.addLayout(cards)

        export_card = QFrame()
        export_card.setObjectName("Card")
        export_layout = QHBoxLayout(export_card)
        export_layout.setContentsMargins(16, 14, 16, 14)
        self.export_button = make_button(
            "XUẤT DỮ LIỆU TẠO FORM ĐÁNH GIÁ",
            self.export_form_package,
            primary=True,
        )
        export_layout.addWidget(self.export_button)
        export_hint = QLabel(
            "Xuất 1 file .xlsx gồm 3 sheet: NHAN_VIEN • TIEU_CHI_PHA_CHE • TIEU_CHI_CHAY_BAN"
        )
        export_hint.setObjectName("Muted")
        export_hint.setWordWrap(True)
        export_layout.addWidget(export_hint, 1)
        layout.addWidget(export_card)

        criteria_card = QFrame()
        criteria_card.setObjectName("Card")
        criteria_layout = QVBoxLayout(criteria_card)
        criteria_layout.setContentsMargins(16, 14, 16, 14)
        criteria_layout.setSpacing(10)

        criteria_header = QHBoxLayout()
        criteria_title = QLabel("CÀI ĐẶT TIÊU CHÍ ĐÁNH GIÁ")
        criteria_title.setStyleSheet("font-size:15px; font-weight:800; color:#5B21B6;")
        criteria_header.addWidget(criteria_title)
        criteria_header.addStretch(1)
        criteria_header.addWidget(QLabel("VỊ TRÍ:"))
        self.role_filter = QComboBox()
        self.role_filter.addItems(["Tất cả", *ROLES])
        self.role_filter.currentTextChanged.connect(self.refresh_criteria)
        criteria_header.addWidget(self.role_filter)
        criteria_layout.addLayout(criteria_header)

        toolbar = QHBoxLayout()
        toolbar.addWidget(make_button("+ THÊM TIÊU CHÍ", self.add_criterion, primary=True))
        toolbar.addWidget(make_button("SỬA TÊN / ĐIỂM", self.edit_selected))
        toolbar.addWidget(make_button("NGỪNG / BẬT LẠI", self.toggle_selected))
        toolbar.addWidget(make_button("↑ LÊN", lambda: self.move_selected(-1)))
        toolbar.addWidget(make_button("↓ XUỐNG", lambda: self.move_selected(1)))
        toolbar.addStretch(1)
        criteria_layout.addLayout(toolbar)

        self.criteria_table = QTableWidget(0, 6)
        self.criteria_table.setHorizontalHeaderLabels(
            ["VỊ TRÍ", "MÃ", "TIÊU CHÍ", "ĐIỂM TỐI ĐA", "TRẠNG THÁI", "THỨ TỰ"]
        )
        self.criteria_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.criteria_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.criteria_table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.criteria_table.verticalHeader().setVisible(False)
        self.criteria_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.criteria_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.criteria_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        self.criteria_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeToContents)
        self.criteria_table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeToContents)
        self.criteria_table.horizontalHeader().setSectionResizeMode(5, QHeaderView.ResizeToContents)
        self.criteria_table.doubleClicked.connect(self.edit_selected)
        criteria_layout.addWidget(self.criteria_table)
        layout.addWidget(criteria_card, 1)

        footer = QLabel(
            "NGUYÊN TẮC: tiêu chí đã dùng không xóa vĩnh viễn — chỉ NGỪNG SỬ DỤNG để giữ lịch sử. "
            "Tên và điểm tối đa sửa trong SQLite sẽ được dùng cho lần xuất/tạo Form tiếp theo."
        )
        footer.setObjectName("Muted")
        footer.setWordWrap(True)
        layout.addWidget(footer)

        self.refresh()

    def refresh(self) -> None:
        self.stat_active.setText(str(self.db.employee_count(active_only=True)))
        counts = self.db.evaluation_employee_counts()
        self.stat_bar.setText(str(counts.get("Pha chế", 0)))
        self.stat_floor.setText(str(counts.get("Chạy bàn", 0)))
        self.stat_criteria.setText(str(len(self.db.list_evaluation_criteria(active_only=True))))
        self.refresh_criteria()

    def refresh_criteria(self) -> None:
        role = self.role_filter.currentText() if hasattr(self, "role_filter") else "Tất cả"
        rows = self.db.list_evaluation_criteria("" if role == "Tất cả" else role, active_only=False)
        self.criteria_table.setRowCount(len(rows))
        for row_index, row in enumerate(rows):
            values = [
                row["role"], row["code"], row["label"], str(row["max_score"]),
                row["status"], str(row["sort_order"]),
            ]
            for column, value in enumerate(values):
                item = QTableWidgetItem(str(value))
                if column in (0, 1, 3, 4, 5):
                    item.setTextAlignment(Qt.AlignCenter)
                if column == 0:
                    item.setData(self.ID_ROLE, int(row["id"]))
                if str(row["status"]) != "Đang sử dụng":
                    item.setForeground(QColor("#94A3B8"))
                self.criteria_table.setItem(row_index, column, item)

    def selected_criterion_id(self) -> int | None:
        row = self.criteria_table.currentRow()
        if row < 0:
            return None
        item = self.criteria_table.item(row, 0)
        return int(item.data(self.ID_ROLE)) if item and item.data(self.ID_ROLE) is not None else None

    def add_criterion(self) -> None:
        default_role = self.role_filter.currentText()
        if default_role not in ROLES:
            default_role = "Pha chế"
        dialog = EvaluationCriterionDialog(self, default_role=default_role)
        if dialog.exec() != QDialog.Accepted:
            return
        role, label, max_score = dialog.values()
        try:
            self.db.add_evaluation_criterion(role, label, max_score)
        except Exception as exc:
            warning(self, "Không thể thêm tiêu chí", str(exc))
            return
        self.refresh()

    def edit_selected(self, *_args) -> None:
        criterion_id = self.selected_criterion_id()
        if criterion_id is None:
            warning(self, "Chưa chọn tiêu chí", "Hãy chọn một tiêu chí cần sửa.")
            return
        criterion = self.db.get_evaluation_criterion(criterion_id)
        if not criterion:
            return
        dialog = EvaluationCriterionDialog(self, criterion=criterion)
        if dialog.exec() != QDialog.Accepted:
            return
        _role, label, max_score = dialog.values()
        try:
            self.db.update_evaluation_criterion(criterion_id, label, max_score)
        except Exception as exc:
            warning(self, "Không thể sửa tiêu chí", str(exc))
            return
        self.refresh()

    def toggle_selected(self) -> None:
        criterion_id = self.selected_criterion_id()
        if criterion_id is None:
            warning(self, "Chưa chọn tiêu chí", "Hãy chọn tiêu chí cần bật/ngừng sử dụng.")
            return
        criterion = self.db.get_evaluation_criterion(criterion_id)
        if not criterion:
            return
        active = str(criterion["status"]) != "Đang sử dụng"
        action = "BẬT LẠI" if active else "NGỪNG SỬ DỤNG"
        if QMessageBox.question(
            self,
            action,
            f"{action} tiêu chí:\n\n{criterion['label']} ?",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        ) != QMessageBox.Yes:
            return
        self.db.set_evaluation_criterion_status(criterion_id, active)
        self.refresh()

    def move_selected(self, direction: int) -> None:
        criterion_id = self.selected_criterion_id()
        if criterion_id is None:
            warning(self, "Chưa chọn tiêu chí", "Hãy chọn tiêu chí cần đổi thứ tự.")
            return
        self.db.move_evaluation_criterion(criterion_id, direction)
        self.refresh_criteria()

    def export_form_package(self) -> None:
        default = Path.home() / "Downloads" / "DU_LIEU_TAO_FORM_DANH_GIA.xlsx"
        filename, _ = QFileDialog.getSaveFileName(
            self,
            "Xuất dữ liệu tạo Form đánh giá",
            str(default),
            "Excel (*.xlsx)",
        )
        if not filename:
            return
        try:
            target = export_evaluation_form_package(
                Path(filename),
                self.db.list_employees(status="Đang làm"),
                self.db.list_evaluation_criteria(active_only=False),
            )
        except Exception as exc:
            warning(self, "Không thể xuất", str(exc))
            return
        info(
            self,
            "Đã xuất dữ liệu tạo Form",
            "Đã tạo file:\n"
            f"{target}\n\n"
            "Gồm 3 sheet: NHAN_VIEN, TIEU_CHI_PHA_CHE, TIEU_CHI_CHAY_BAN.\n"
            "Google Form bước sau sẽ đọc trực tiếp tên tiêu chí, điểm tối đa và trạng thái từ file này.",
        )

    # Giữ hàm cũ để các bản cập nhật/shortcut cũ không lỗi.
    def export_employee_list(self) -> None:
        self.export_form_package()

class MainWindow(QMainWindow):
    def __init__(self, db: Database, project_root: Path) -> None:
        super().__init__()
        self.db = db
        self.project_root = project_root
        self.setWindowTitle(f"{APP_NAME} — {APP_VERSION}")
        self.resize(1620, 980)
        self.setMinimumSize(1220, 780)
        self._page_by_key: dict[str, QWidget] = {}
        self._page_keys: list[str] = []
        self._dirty_keys: set[str] = set()
        self._nav_items: dict[str, QTreeWidgetItem] = {}
        self._last_page_key = "dashboard"

        root = QWidget()
        root.setObjectName("RootWidget")
        self.setCentralWidget(root)
        main_layout = QHBoxLayout(root)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        sidebar = QFrame()
        sidebar.setObjectName("Sidebar")
        sidebar.setFixedWidth(330)
        side_layout = QVBoxLayout(sidebar)
        side_layout.setContentsMargins(14, 18, 14, 16)
        side_layout.setSpacing(8)

        brand = QLabel("QUẢN TRỊ LỊCH LÀM\nHỆ THỐNG CAFE")
        brand.setObjectName("Brand")
        brand.setWordWrap(True)
        side_layout.addWidget(brand)
        self.sidebar_week = QLabel("TUẦN: —")
        self.sidebar_week.setObjectName("Version")
        self.sidebar_week.setWordWrap(True)
        side_layout.addWidget(self.sidebar_week)
        self.sidebar_status = QLabel("TRẠNG THÁI: ĐANG XẾP")
        self.sidebar_status.setStyleSheet(
            "color:#FDE68A; background:#1E293B; border:1px solid #475569; border-radius:7px; padding:7px 9px;"
        )
        side_layout.addWidget(self.sidebar_status)
        side_layout.addSpacing(8)

        self.navigation = QTreeWidget()
        self.navigation.setObjectName("Navigation")
        self.navigation.setHeaderHidden(True)
        self.navigation.setIndentation(17)
        self.navigation.setAnimated(True)
        self.navigation.setRootIsDecorated(True)
        self.navigation.currentItemChanged.connect(self._navigation_changed)
        side_layout.addWidget(self.navigation, 1)

        export_transfer_button = make_button("XUẤT DỮ LIỆU ĐỂ CHUYỂN MÁY", self.export_transfer_data)
        export_transfer_button.setStyleSheet(
            "QPushButton {background:#1E293B; color:#E2E8F0; border:1px solid #64748B;}"
            "QPushButton:hover {background:#334155; color:#FFFFFF;}"
        )
        side_layout.addWidget(export_transfer_button)

        import_transfer_button = make_button("NHẬP DỮ LIỆU TỪ MÁY KHÁC", self.import_transfer_data)
        import_transfer_button.setStyleSheet(
            "QPushButton {background:#1E293B; color:#E2E8F0; border:1px solid #64748B;}"
            "QPushButton:hover {background:#334155; color:#FFFFFF;}"
        )
        side_layout.addWidget(import_transfer_button)
        version = QLabel(f"{APP_VERSION}\nSQLITE • OFFLINE")
        version.setObjectName("Version")
        version.setWordWrap(True)
        side_layout.addWidget(version)
        data_label = QLabel(f"DỮ LIỆU:\n{app_data_dir()}")
        data_label.setWordWrap(True)
        data_label.setObjectName("Version")
        side_layout.addWidget(data_label)
        main_layout.addWidget(sidebar)

        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(0, 0, 0, 0)
        content_layout.setSpacing(0)
        # Tuần hiện hành chỉ hiển thị ở đầu menu bên trái. Combo dưới đây được giữ ẩn
        # để các trang tuần dùng chung một nguồn lựa chọn mà không lặp lại bố cục.
        self.week_label = QLabel(content)
        self.week_label.hide()
        self.week_combo = QComboBox(content)
        self.week_combo.hide()
        self.week_range = QLabel(content)
        self.week_range.hide()
        self.data_status = QLabel(content)
        self.data_status.hide()

        self.stack = QStackedWidget()
        content_layout.addWidget(self.stack, 1)
        main_layout.addWidget(content, 1)

        self.week_combo.currentIndexChanged.connect(self._week_changed)
        self._build_pages()
        self.reload_weeks()
        self._build_navigation("dashboard")
        QTimer.singleShot(350, self._prompt_spirit_manager_roles)

    def current_week_id(self) -> int | None:
        data = self.week_combo.currentData()
        return int(data) if data is not None else None

    def _build_pages(self) -> None:
        while self.stack.count():
            widget = self.stack.widget(0)
            self.stack.removeWidget(widget)
            widget.deleteLater()

        self._page_by_key = {}
        self._page_keys = []

        self.dashboard_page = DashboardPage(self.db, self.current_week_id)
        self.branch_shift_page = BranchShiftManagementPage(self.db)
        self.employees_page = EmployeesPage(self.db, self.project_root)
        self.staffing_page = StaffingPage(self.db)
        self.order_page = OrderPage(self.db, self.current_week_id, self.project_root)
        self.evaluation_page = EvaluationPage(self.db, self.project_root)
        self.fixed_schedule_page = FixedSchedulePage(self.db)
        self.master_schedule_page = MasterSchedulePage(self.db, self.current_week_id)
        self.branch_schedule_pages: list[BranchSchedulePage] = []
        self.branch_page_keys: list[str] = []
        for branch in self.db.list_branches(active_only=True):
            key = f"branch:{branch['id']}"
            page = BranchSchedulePage(self.db, self.current_week_id, str(branch["code"]))
            self.branch_schedule_pages.append(page)
            self.branch_page_keys.append(key)
            self._page_by_key[key] = page
        self.close_report_page = CloseReportPage(self.db, self.current_week_id)

        base_pages = [
            ("dashboard", self.dashboard_page),
            ("branch_shift", self.branch_shift_page),
            ("employees", self.employees_page),
            ("staffing", self.staffing_page),
            ("order", self.order_page),
            ("evaluation", self.evaluation_page),
            ("fixed", self.fixed_schedule_page),
            ("master", self.master_schedule_page),
        ]
        ordered: list[tuple[str, QWidget]] = base_pages + [
            (key, page) for key, page in zip(self.branch_page_keys, self.branch_schedule_pages)
        ] + [("report", self.close_report_page)]
        self._page_by_key.update(dict(base_pages))
        self._page_by_key["report"] = self.close_report_page
        self._page_keys = [key for key, _page in ordered]
        for _key, page in ordered:
            self.stack.addWidget(page)

        self.branch_shift_page.data_changed.connect(
            lambda: QTimer.singleShot(0, self._configuration_changed)
        )
        self.employees_page.data_changed.connect(self._employees_changed)
        self.order_page.data_changed.connect(self._order_changed)
        self.order_page.week_selected.connect(self._select_week_from_report)
        self.master_schedule_page.week_selected.connect(self._select_week_from_report)
        self.fixed_schedule_page.data_changed.connect(
            lambda: self._mark_dirty("master", *self.branch_page_keys, "report")
        )
        self.master_schedule_page.data_changed.connect(self._schedule_changed)
        for page in self.branch_schedule_pages:
            page.data_changed.connect(self._schedule_changed)
            page.week_selected.connect(self._select_week_from_report)
        self.close_report_page.data_changed.connect(self._schedule_changed)
        self.close_report_page.week_selected.connect(self._select_week_from_report)
        self._dirty_keys = set(self._page_keys)

    def _group_item(self, text: str) -> QTreeWidgetItem:
        item = QTreeWidgetItem([text])
        item.setFlags(item.flags() & ~Qt.ItemIsSelectable)
        font = item.font(0)
        font.setBold(True)
        item.setFont(0, font)
        item.setForeground(0, QColor("#93C5FD"))
        return item

    def _add_nav_page(self, parent: QTreeWidgetItem, text: str, key: str) -> QTreeWidgetItem:
        item = QTreeWidgetItem([text])
        item.setData(0, Qt.UserRole, key)
        parent.addChild(item)
        self._nav_items[key] = item
        return item

    def _build_navigation(self, selected_key: str | None = None) -> None:
        selected_key = selected_key if selected_key in self._page_by_key else "dashboard"
        self.navigation.blockSignals(True)
        self.navigation.clear()
        self._nav_items.clear()

        setup = self._group_item("THIẾT LẬP")
        self.navigation.addTopLevelItem(setup)
        self._add_nav_page(setup, "TỔNG QUAN", "dashboard")
        self._add_nav_page(setup, "DANH SÁCH CƠ SỞ & CA LÀM VIỆC", "branch_shift")
        self._add_nav_page(setup, "DANH SÁCH NHÂN VIÊN", "employees")
        self._add_nav_page(setup, "ĐỊNH BIÊN", "staffing")

        scheduling = self._group_item("XẾP LỊCH")
        self.navigation.addTopLevelItem(scheduling)
        self._add_nav_page(scheduling, "ORDER LỊCH LÀM", "order")
        self._add_nav_page(scheduling, "LỊCH CỐ ĐỊNH", "fixed")
        self._add_nav_page(scheduling, "XẾP LỊCH LÀM TỔNG", "master")
        branches_group = self._group_item("LỊCH CƠ SỞ")
        scheduling.addChild(branches_group)
        for branch, key in zip(self.db.list_branches(active_only=True), self.branch_page_keys):
            self._add_nav_page(
                branches_group,
                f"{branch['ui_code']} – {branch['name']}",
                key,
            )

        people = self._group_item("NHÂN SỰ")
        self.navigation.addTopLevelItem(people)
        self._add_nav_page(people, "ĐÁNH GIÁ NHÂN VIÊN", "evaluation")

        finish = self._group_item("HOÀN TẤT")
        self.navigation.addTopLevelItem(finish)
        self._add_nav_page(finish, "CHỐT LỊCH & BÁO CÁO", "report")

        setup.setExpanded(True)
        scheduling.setExpanded(True)
        branches_group.setExpanded(True)
        people.setExpanded(True)
        finish.setExpanded(True)
        self.navigation.blockSignals(False)
        item = self._nav_items.get(selected_key)
        if item:
            self.navigation.setCurrentItem(item)
            self._change_to_key(selected_key, force=True)

    def _navigation_changed(self, current: QTreeWidgetItem | None, previous: QTreeWidgetItem | None) -> None:
        if current is None:
            return
        key = current.data(0, Qt.UserRole)
        if not key:
            return
        self._change_to_key(str(key))

    def _change_to_key(self, key: str, force: bool = False) -> None:
        if key not in self._page_by_key:
            return
        previous = self._last_page_key
        if previous == "staffing":
            current_staffing = self.staffing_page.stack.currentWidget() if hasattr(self, "staffing_page") else None
            if isinstance(current_staffing, StaffingBranchWidget) and current_staffing.save_timer.isActive():
                current_staffing.save_timer.stop()
                current_staffing.flush_save()
            self._mark_dirty("dashboard", "master", *self.branch_page_keys, "report")
        elif previous == "fixed":
            # Ghi nốt mọi thay đổi Lịch cố định trước khi rời tab.
            if hasattr(self, "fixed_schedule_page"):
                self.fixed_schedule_page.flush_pending_changes()
            self._mark_dirty("dashboard", "master", *self.branch_page_keys, "report")
        page = self._page_by_key[key]
        self.stack.setCurrentWidget(page)
        self._last_page_key = key
        self._refresh_key(key, force=force)

    def _refresh_key(self, key: str, force: bool = False) -> None:
        if key not in self._page_by_key:
            return
        if not force and key not in self._dirty_keys:
            return
        refresh = getattr(self._page_by_key[key], "refresh", None)
        if callable(refresh):
            refresh()
        self._dirty_keys.discard(key)

    def _mark_dirty(self, *keys: str) -> None:
        self._dirty_keys.update(key for key in keys if key in self._page_by_key)

    def _refresh_current_page(self, force: bool = False) -> None:
        self._refresh_key(self._last_page_key, force=force)

    def _configuration_changed(self) -> None:
        selected = self._last_page_key
        if selected.startswith("branch:"):
            selected = "branch_shift"
        self._build_pages()
        self._build_navigation(selected if selected in self._page_by_key else "branch_shift")
        self._week_changed()

    def _employees_changed(self) -> None:
        self._mark_dirty(
            "dashboard", "order", "evaluation", "fixed", "master", *self.branch_page_keys, "report"
        )
        if self._last_page_key != "employees":
            self._refresh_current_page()

    def _order_changed(self) -> None:
        self._mark_dirty("dashboard", "master", *self.branch_page_keys, "report")
        if self._last_page_key != "order":
            self._refresh_current_page()

    def _schedule_changed(self) -> None:
        current = self._last_page_key
        self._mark_dirty("dashboard", "master", *self.branch_page_keys, "report")
        self._dirty_keys.discard(current)

    def reload_weeks(self) -> None:
        selected_setting = self.db.get_setting("selected_week_id")
        selected_id = int(selected_setting) if selected_setting and selected_setting.isdigit() else None
        self.week_combo.blockSignals(True)
        self.week_combo.clear()
        target_index = 0
        for index, row in enumerate(self.db.list_weeks()):
            self.week_combo.addItem(format_week(row), int(row["id"]))
            if selected_id == int(row["id"]):
                target_index = index
        if self.week_combo.count():
            self.week_combo.setCurrentIndex(target_index)
        self.week_combo.blockSignals(False)
        self._week_changed()

    def _week_changed(self) -> None:
        week_id = self.current_week_id()
        if week_id:
            self.db.set_setting("selected_week_id", str(week_id))
            row = self.db.get_week(week_id)
            text = format_week(row) if row else ""
            self.week_range.setText(text)
            self.sidebar_week.setText(f"TUẦN: {text}")
            status = self.db.week_schedule_status(week_id)
            self.sidebar_status.setText(f"TRẠNG THÁI: {status}")
            if status == "ĐÃ CHỐT":
                self.sidebar_status.setStyleSheet(
                    "color:#BBF7D0; background:#14532D; border:1px solid #22C55E; border-radius:7px; padding:7px 9px;"
                )
            else:
                self.sidebar_status.setStyleSheet(
                    "color:#FDE68A; background:#1E293B; border:1px solid #475569; border-radius:7px; padding:7px 9px;"
                )
        else:
            self.week_range.clear()
            self.sidebar_week.setText("TUẦN: —")
            self.sidebar_status.setText("TRẠNG THÁI: —")
        self._mark_dirty("dashboard", "order", "master", *self.branch_page_keys, "report")
        self._refresh_current_page()

    def _select_week_from_report(self, week_id: int) -> None:
        index = self.week_combo.findData(int(week_id))
        if index < 0:
            self.reload_weeks()
            index = self.week_combo.findData(int(week_id))
        if index >= 0:
            self.week_combo.setCurrentIndex(index)

    def _flush_pending_changes(self) -> None:
        if hasattr(self, "fixed_schedule_page"):
            self.fixed_schedule_page.flush_pending_changes()
        if hasattr(self, "staffing_page"):
            for widget in getattr(self.staffing_page, "branch_widgets", []):
                if widget.save_timer.isActive():
                    widget.save_timer.stop()
                    widget.flush_save()

    def export_transfer_data(self) -> None:
        self._flush_pending_changes()
        default_name = f"BACKUP_QuanTriLichLam_{datetime.now():%d-%m-%Y_%H%M}.zip"
        default_path = Path.home() / "Downloads" / default_name
        filename, _ = QFileDialog.getSaveFileName(
            self,
            "Xuất dữ liệu để chuyển máy",
            str(default_path),
            "File chuyển dữ liệu (*.zip)",
        )
        if not filename:
            return
        try:
            target = create_transfer_package(self.db, Path(filename))
        except (TransferDataError, OSError) as exc:
            warning(self, "Không thể xuất dữ liệu", str(exc))
            return
        info(
            self,
            "Đã xuất dữ liệu",
            f"Đã tạo file:\n{target}\n\nAnh có thể gửi nguyên file ZIP này qua Zalo sang máy Mac/Windows khác.",
        )

    def import_transfer_data(self) -> None:
        filename, _ = QFileDialog.getOpenFileName(
            self,
            "Nhập dữ liệu từ máy khác",
            str(Path.home() / "Downloads"),
            "File chuyển dữ liệu (*.zip)",
        )
        if not filename:
            return
        if not confirm(
            self,
            "Xác nhận nhập dữ liệu",
            "Dữ liệu hiện tại trên máy này sẽ được SAO LƯU trước, sau đó được thay bằng dữ liệu trong file đã chọn.\n\n"
            "Hãy chắc chắn anh đã ngừng nhập liệu trên máy còn lại rồi mới tiếp tục.\n\nTiếp tục nhập?",
        ):
            return
        self._flush_pending_changes()
        try:
            result = restore_transfer_package(self.db, Path(filename))
        except (TransferDataError, OSError) as exc:
            warning(self, "Không thể nhập dữ liệu", str(exc))
            return

        self._build_pages()
        self.reload_weeks()
        self._build_navigation("dashboard")
        stats = result.get("stats") or {}
        backup_path = result.get("backup_path") or "—"
        info(
            self,
            "Nhập dữ liệu hoàn tất",
            "Đã nạp toàn bộ dữ liệu từ máy khác.\n\n"
            f"Nhân viên: {stats.get('employees', 0)}\n"
            f"Lần đánh giá: {stats.get('evaluation_rounds', 0)}\n"
            f"Phiếu đánh giá: {stats.get('evaluation_round_employees', 0)}\n"
            f"Mã Voucher đã phân: {stats.get('evaluation_voucher_allocations', 0)}\n\n"
            f"Bản sao lưu dữ liệu cũ của máy này:\n{backup_path}",
        )

    def backup_now(self) -> None:
        path = self.db.backup("sao_luu_thu_cong")
        if path:
            info(self, "Đã sao lưu", f"Đã tạo bản sao lưu:\n{path}")
        else:
            warning(self, "Chưa có dữ liệu", "Chưa có database để sao lưu.")

    def _prompt_spirit_manager_roles(self) -> None:
        pending = self.db.pending_spirit_manager_fixed()
        if not pending:
            return
        dialog = SpiritManagerRoleDialog(self, pending)
        if dialog.exec() != QDialog.Accepted:
            return
        try:
            count = self.db.apply_spirit_manager_fixed_roles(dialog.values())
        except DatabaseError as exc:
            warning(self, "Không thể nạp lịch cố định", str(exc))
            return
        self.refresh_all()
        info(self, "Đã nạp dữ liệu Spirit", f"Đã chuyển và nạp {count} ô lịch cố định từ vị trí Quản lý ca cũ.")

    def refresh_all(self) -> None:
        self._dirty_keys.update(self._page_keys)
        self._refresh_current_page(force=True)

    def closeEvent(self, event) -> None:
        # Ghi nốt thay đổi đang chờ trước khi đóng database.
        self._flush_pending_changes()
        self.db.close()
        super().closeEvent(event)

def run_app(project_root: Path) -> int:
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setStyle(UppercaseProxyStyle(app.style()))
    app_font = app.font()
    app_font.setBold(True)
    app_font.setPointSize(max(app_font.pointSize(), 10))
    app.setFont(app_font)
    app.setStyleSheet(STYLE)
    db = Database()
    try:
        db.backup_daily_once()
    except Exception:
        # Sao lưu hằng ngày không được phép làm gián đoạn việc mở phần mềm.
        pass
    window = MainWindow(db, project_root)
    window.show()
    return app.exec()
