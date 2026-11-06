from __future__ import annotations

from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Callable

from PySide6.QtCore import QDate, Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QAbstractItemView,
    QAbstractSpinBox,
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
    QMessageBox,
    QPlainTextEdit,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QSpinBox,
    QTabWidget,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from .constants import ROLES
from .database import Database, DatabaseError
from .excel_io import (
    ExcelImportError,
    export_evaluation_round_package,
    export_evaluation_voucher_file,
    import_evaluation_form_rows,
    import_voucher_export_file,
)
from .evaluation_pdf import export_evaluation_round_pdf


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


def make_button(text: str, slot: Callable, primary: bool = False, danger: bool = False) -> QPushButton:
    button = QPushButton(text)
    button.setMinimumHeight(40)
    button.setMinimumWidth(max(118, min(290, len(text) * 8 + 34)))
    button.setSizePolicy(QSizePolicy.Minimum, QSizePolicy.Fixed)
    if primary:
        button.setObjectName("Primary")
    if danger:
        button.setObjectName("Danger")
    button.clicked.connect(slot)
    return button


def warning(parent: QWidget, title: str, text: str) -> None:
    QMessageBox.warning(parent, title, text)


def info(parent: QWidget, title: str, text: str) -> None:
    QMessageBox.information(parent, title, text)


def confirm(parent: QWidget, title: str, text: str) -> bool:
    return QMessageBox.question(parent, title, text, QMessageBox.Yes | QMessageBox.No) == QMessageBox.Yes


def new_table(headers: list[str]) -> QTableWidget:
    table = QTableWidget(0, len(headers))
    table.setHorizontalHeaderLabels(headers)
    table.setEditTriggers(QAbstractItemView.NoEditTriggers)
    table.setSelectionBehavior(QAbstractItemView.SelectRows)
    table.setSelectionMode(QAbstractItemView.SingleSelection)
    table.verticalHeader().setVisible(False)
    table.setAlternatingRowColors(True)
    table.horizontalHeader().setStretchLastSection(True)
    return table


def role_display(role: str | None) -> str:
    return str(role or "CHƯA CHỌN")


class NewEvaluationRoundDialog(QDialog):
    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("TẠO LẦN ĐÁNH GIÁ MỚI")
        self.setMinimumWidth(470)
        layout = QVBoxLayout(self)
        form = QFormLayout()
        self.date_edit = QDateEdit(QDate.currentDate())
        self.date_edit.setCalendarPopup(True)
        self.date_edit.setDisplayFormat("dd/MM/yyyy")
        self.date_edit.setMinimumHeight(40)
        form.addRow("NGÀY ĐÁNH GIÁ:", self.date_edit)
        note = QLabel("Mỗi ngày chỉ được tạo 1 lần đánh giá. Hệ thống sẽ tự lấy toàn bộ nhân viên đang làm.")
        note.setObjectName("Muted")
        note.setWordWrap(True)
        layout.addLayout(form)
        layout.addWidget(note)
        buttons = QDialogButtonBox(QDialogButtonBox.Save | QDialogButtonBox.Cancel)
        buttons.button(QDialogButtonBox.Save).setText("TẠO LẦN ĐÁNH GIÁ")
        buttons.button(QDialogButtonBox.Cancel).setText("HỦY")
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def iso_date(self) -> str:
        return self.date_edit.date().toString("yyyy-MM-dd")


class CriterionDialog(QDialog):
    def __init__(self, role: str, parent: QWidget | None = None, criterion=None) -> None:
        super().__init__(parent)
        self.role = role
        self.setWindowTitle("THÊM TIÊU CHÍ" if criterion is None else "SỬA TIÊU CHÍ")
        self.setMinimumWidth(560)
        layout = QVBoxLayout(self)
        form = QFormLayout()
        role_label = QLabel(role.upper())
        role_label.setStyleSheet("font-weight:900;color:#5B21B6;")
        self.label_input = QLineEdit(str(criterion["label"]) if criterion is not None else "")
        self.label_input.setMinimumHeight(40)
        self.max_score = QSpinBox()
        self.max_score.setRange(1, 100)
        self.max_score.setValue(int(criterion["max_score"]) if criterion is not None else 5)
        self.max_score.setMinimumHeight(40)
        form.addRow("BỘ TIÊU CHÍ:", role_label)
        form.addRow("TÊN TIÊU CHÍ:", self.label_input)
        form.addRow("ĐIỂM TỐI ĐA:", self.max_score)
        layout.addLayout(form)
        buttons = QDialogButtonBox(QDialogButtonBox.Save | QDialogButtonBox.Cancel)
        buttons.button(QDialogButtonBox.Save).setText("LƯU")
        buttons.button(QDialogButtonBox.Cancel).setText("HỦY")
        buttons.accepted.connect(self._accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def _accept(self) -> None:
        if not self.label_input.text().strip():
            warning(self, "Thiếu tiêu chí", "Tên tiêu chí không được để trống.")
            return
        self.accept()


class CriteriaRoleWidget(QWidget):
    def __init__(self, db: Database, role: str) -> None:
        super().__init__()
        self.db = db
        self.role = role
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 10, 8, 8)
        toolbar = QHBoxLayout()
        toolbar.addWidget(make_button("+ THÊM TIÊU CHÍ", self.add_criterion, primary=True))
        toolbar.addWidget(make_button("SỬA", self.edit_selected))
        toolbar.addWidget(make_button("NGỪNG / BẬT LẠI", self.toggle_selected))
        toolbar.addWidget(make_button("↑ LÊN", lambda: self.move_selected(-1)))
        toolbar.addWidget(make_button("↓ XUỐNG", lambda: self.move_selected(1)))
        toolbar.addStretch(1)
        self.search = QLineEdit()
        self.search.setPlaceholderText("TÌM NHANH TIÊU CHÍ")
        self.search.setMinimumWidth(270)
        self.search.textChanged.connect(self.refresh)
        toolbar.addWidget(self.search)
        layout.addLayout(toolbar)
        self.table = new_table(["STT", "MÃ TIÊU CHÍ", "TÊN TIÊU CHÍ", "ĐIỂM TỐI ĐA", "TRẠNG THÁI"])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeToContents)
        self.table.doubleClicked.connect(self.edit_selected)
        layout.addWidget(self.table, 1)
        self.refresh()

    def refresh(self, *_args) -> None:
        token = self.search.text().strip().casefold() if hasattr(self, "search") else ""
        rows = self.db.list_evaluation_criteria(self.role, active_only=False)
        if token:
            rows = [row for row in rows if token in str(row["label"]).casefold() or token in str(row["code"]).casefold()]
        self.table.setRowCount(len(rows))
        for index, row in enumerate(rows):
            values = [index + 1, row["code"], row["label"], row["max_score"], row["status"]]
            for col, value in enumerate(values):
                item = QTableWidgetItem(str(value))
                if col != 2:
                    item.setTextAlignment(Qt.AlignCenter)
                if col == 0:
                    item.setData(Qt.UserRole, int(row["id"]))
                if str(row["status"]) != "Đang sử dụng":
                    item.setForeground(QColor("#94A3B8"))
                self.table.setItem(index, col, item)

    def selected_id(self) -> int | None:
        row = self.table.currentRow()
        if row < 0:
            return None
        item = self.table.item(row, 0)
        return int(item.data(Qt.UserRole)) if item and item.data(Qt.UserRole) else None

    def add_criterion(self) -> None:
        dialog = CriterionDialog(self.role, self)
        if dialog.exec() != QDialog.Accepted:
            return
        try:
            self.db.add_evaluation_criterion(self.role, dialog.label_input.text().strip(), dialog.max_score.value())
            self.refresh()
        except Exception as exc:
            warning(self, "Không thể thêm tiêu chí", str(exc))

    def edit_selected(self, *_args) -> None:
        criterion_id = self.selected_id()
        if criterion_id is None:
            warning(self, "Chưa chọn", "Hãy chọn tiêu chí cần sửa.")
            return
        criterion = self.db.get_evaluation_criterion(criterion_id)
        if criterion is None:
            return
        dialog = CriterionDialog(self.role, self, criterion)
        if dialog.exec() != QDialog.Accepted:
            return
        try:
            self.db.update_evaluation_criterion(criterion_id, dialog.label_input.text().strip(), dialog.max_score.value())
            self.refresh()
        except Exception as exc:
            warning(self, "Không thể sửa tiêu chí", str(exc))

    def toggle_selected(self) -> None:
        criterion_id = self.selected_id()
        if criterion_id is None:
            warning(self, "Chưa chọn", "Hãy chọn tiêu chí cần ngừng/bật lại.")
            return
        criterion = self.db.get_evaluation_criterion(criterion_id)
        if criterion is None:
            return
        active = str(criterion["status"]) != "Đang sử dụng"
        action = "BẬT LẠI" if active else "NGỪNG SỬ DỤNG"
        if not confirm(self, action, f"{action} tiêu chí:\n\n{criterion['label']} ?"):
            return
        self.db.set_evaluation_criterion_status(criterion_id, active)
        self.refresh()

    def move_selected(self, direction: int) -> None:
        criterion_id = self.selected_id()
        if criterion_id is None:
            warning(self, "Chưa chọn", "Hãy chọn tiêu chí cần đổi thứ tự.")
            return
        self.db.move_evaluation_criterion(criterion_id, direction)
        self.refresh()


class CriteriaPage(QWidget):
    def __init__(self, db: Database) -> None:
        super().__init__()
        self.db = db
        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 12, 12, 12)
        note = QLabel(
            "Tiêu chí được quản lý riêng. Có thể thêm, sửa tên, sửa điểm tối đa, đổi thứ tự, ngừng dùng/bật lại. "
            "Tiêu chí đã dùng không xóa vĩnh viễn."
        )
        note.setObjectName("Muted")
        note.setWordWrap(True)
        layout.addWidget(note)
        self.tabs = QTabWidget()
        self.role_widgets = {role: CriteriaRoleWidget(db, role) for role in ROLES}
        for role in ROLES:
            self.tabs.addTab(self.role_widgets[role], role.upper())
        layout.addWidget(self.tabs, 1)

    def refresh(self) -> None:
        for widget in self.role_widgets.values():
            widget.refresh()


class RatingSettingsPage(QWidget):
    def __init__(self, db: Database) -> None:
        super().__init__()
        self.db = db
        layout = QVBoxLayout(self)
        layout.setContentsMargins(18, 18, 18, 18)
        note = QLabel("Giữ cố định 5 mức xếp loại. Chỉ thay đổi ngưỡng điểm tuyệt đối.")
        note.setObjectName("Muted")
        layout.addWidget(note)
        card = QFrame()
        card.setObjectName("Card")
        form = QFormLayout(card)
        self.spins: dict[str, QSpinBox] = {}
        for rating in RATINGS:
            spin = QSpinBox()
            spin.setRange(0, 10000)
            spin.setMinimumHeight(40)
            if rating == "Yếu":
                spin.setEnabled(False)
            self.spins[rating] = spin
            form.addRow(f"{rating.upper()} — TỪ ĐIỂM:", spin)
        layout.addWidget(card)
        actions = QHBoxLayout()
        actions.addWidget(make_button("LƯU NGƯỠNG XẾP LOẠI", self.save, primary=True))
        actions.addStretch(1)
        layout.addLayout(actions)
        layout.addStretch(1)
        self.refresh()

    def refresh(self) -> None:
        data = self.db.get_evaluation_rating_thresholds()
        for key, spin in self.spins.items():
            spin.setValue(int(data[key]))

    def save(self) -> None:
        data = {key: spin.value() for key, spin in self.spins.items()}
        data["Yếu"] = 0
        try:
            self.db.save_evaluation_rating_thresholds(data)
        except Exception as exc:
            warning(self, "Không thể lưu", str(exc))
            return
        info(self, "Đã lưu", "Đã cập nhật ngưỡng xếp loại.")
        self.refresh()


class EvaluationEmployeeDialog(QDialog):
    def __init__(self, db: Database, round_employee_id: int, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.db = db
        self.round_employee_id = int(round_employee_id)
        self.next_requested = False
        row = db.get_evaluation_round_employee(self.round_employee_id)
        if row is None:
            raise DatabaseError("Không tìm thấy phiếu đánh giá.")
        self.row = row
        round_row = db.get_evaluation_round(int(row["round_id"]))
        self.read_only = bool(round_row and str(round_row["status"]) == "ĐÃ CHỐT")
        role = str(row["role"] or "")
        if role not in ROLES:
            raise DatabaseError("Nhân viên chưa được chọn bộ tiêu chí.")
        criteria = db.list_evaluation_round_criteria(int(row["round_id"]), role)
        if not criteria:
            db.prepare_evaluation_round_criteria(int(row["round_id"]), refresh=False)
            criteria = db.list_evaluation_round_criteria(int(row["round_id"]), role)
        self.criteria = criteria
        self.score_boxes: dict[int, QSpinBox] = {}

        self.setWindowTitle(f"PHIẾU ĐÁNH GIÁ — {row['employee_code']} — {row['employee_name']}")
        self.resize(980, 820)
        layout = QVBoxLayout(self)
        header = QFrame()
        header.setObjectName("Card")
        header_layout = QGridLayout(header)
        header_layout.addWidget(QLabel(f"MÃ NV: {row['employee_code']}"), 0, 0)
        name = QLabel(f"NHÂN VIÊN: {row['employee_name']}")
        name.setStyleSheet("font-size:16px;font-weight:900;color:#1D4ED8;")
        header_layout.addWidget(name, 0, 1)
        header_layout.addWidget(QLabel(f"BỘ TIÊU CHÍ: {role.upper()}"), 0, 2)
        source = QLabel(f"NGUỒN: {row['data_source'] or '—'}")
        source.setObjectName("Muted")
        header_layout.addWidget(source, 1, 0, 1, 3)
        layout.addWidget(header)

        if self.read_only:
            locked = QLabel("LẦN ĐÁNH GIÁ ĐÃ CHỐT — PHIẾU ĐANG Ở CHẾ ĐỘ CHỈ XEM. BẤM MỞ LẠI Ở MÀN HÌNH LẦN ĐÁNH GIÁ NẾU CẦN SỬA.")
            locked.setWordWrap(True)
            locked.setStyleSheet(
                "background:#FEF3C7;color:#92400E;border:1px solid #F59E0B;"
                "padding:9px 12px;border-radius:7px;font-weight:900;"
            )
            layout.addWidget(locked)

        self.table = QTableWidget(len(criteria), 4)
        self.table.setHorizontalHeaderLabels(["STT", "TIÊU CHÍ", "ĐIỂM TỐI ĐA", "ĐIỂM ĐÁNH GIÁ"])
        self.table.verticalHeader().setVisible(False)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeToContents)
        saved = db.get_evaluation_round_scores(self.round_employee_id)
        for index, criterion in enumerate(criteria):
            self.table.setItem(index, 0, QTableWidgetItem(str(index + 1)))
            self.table.setItem(index, 1, QTableWidgetItem(str(criterion["label"])))
            max_item = QTableWidgetItem(str(criterion["max_score"]))
            max_item.setTextAlignment(Qt.AlignCenter)
            self.table.setItem(index, 2, max_item)
            score_input = QSpinBox()
            score_input.setRange(0, int(criterion["max_score"]))
            score_input.setButtonSymbols(QAbstractSpinBox.NoButtons)
            score_input.setAlignment(Qt.AlignCenter)
            score_input.setMinimumWidth(86)
            score_input.setToolTip(f"Nhập số nguyên từ 0 đến {int(criterion['max_score'])}")
            score_input.setValue(int(saved.get(int(criterion["id"]), 0)))
            score_input.valueChanged.connect(self._recalculate_preview)
            score_input.setEnabled(not self.read_only)
            self.score_boxes[int(criterion["id"])] = score_input
            self.table.setCellWidget(index, 3, score_input)
            self.table.setRowHeight(index, 44)
        layout.addWidget(self.table, 1)

        form_card = QFrame()
        form_card.setObjectName("Card")
        form = QFormLayout(form_card)
        self.evaluator = QLineEdit(str(row["evaluator_name"] or ""))
        self.evaluator.setPlaceholderText("BẮT BUỘC")
        self.comments = QPlainTextEdit(str(row["comments"] or ""))
        self.comments.setPlaceholderText("NHẬN XÉT CHUNG — BẮT BUỘC")
        self.comments.setMinimumHeight(105)
        self.voucher = QSpinBox()
        self.voucher.setRange(0, 9999)
        self.voucher.setValue(int(row["voucher_count"] or 0))
        self.evaluator.setReadOnly(self.read_only)
        self.comments.setReadOnly(self.read_only)
        self.voucher.setEnabled(not self.read_only)
        self.total_preview = QLabel("0")
        self.total_preview.setStyleSheet("font-size:18px;font-weight:900;color:#1D4ED8;")
        self.rating_preview = QLabel("—")
        self.rating_preview.setStyleSheet("font-size:16px;font-weight:900;")
        form.addRow("NGƯỜI ĐÁNH GIÁ:", self.evaluator)
        form.addRow("NHẬN XÉT CHUNG:", self.comments)
        form.addRow("SỐ LƯỢNG VOUCHER:", self.voucher)
        form.addRow("TỔNG ĐIỂM:", self.total_preview)
        form.addRow("XẾP LOẠI:", self.rating_preview)
        layout.addWidget(form_card)

        actions = QHBoxLayout()
        if self.read_only:
            actions.addWidget(make_button("XEM NHÂN VIÊN TIẾP THEO", self.view_next))
        else:
            actions.addWidget(make_button("LƯU", self.save, primary=True))
            actions.addWidget(make_button("LƯU & CHUYỂN NHÂN VIÊN TIẾP THEO", self.save_next))
        actions.addStretch(1)
        actions.addWidget(make_button("QUAY LẠI", self.reject))
        layout.addLayout(actions)
        self._recalculate_preview()

    def _scores(self) -> dict[int, int]:
        return {criterion_id: spin.value() for criterion_id, spin in self.score_boxes.items()}

    def _recalculate_preview(self, *_args) -> None:
        total = sum(self._scores().values())
        self.total_preview.setText(str(total))
        rating = self.db.evaluation_rating(total)
        self.rating_preview.setText(rating)
        bg, fg = RATING_COLORS.get(rating, ("#FFFFFF", "#111827"))
        self.rating_preview.setStyleSheet(
            f"font-size:16px;font-weight:900;background:{bg};color:{fg};padding:5px 10px;border-radius:6px;"
        )

    def _save_core(self) -> bool:
        if self.read_only:
            warning(
                self,
                "Phiếu đã khóa",
                "Lần đánh giá đã CHỐT. Hãy bấm MỞ LẠI ở màn hình lần đánh giá trước khi chỉnh sửa.",
            )
            return False
        try:
            self.db.save_evaluation_round_employee(
                self.round_employee_id,
                self.evaluator.text().strip(),
                self.comments.toPlainText().strip(),
                self.voucher.value(),
                self._scores(),
                manual=True,
            )
            return True
        except Exception as exc:
            warning(self, "Không thể lưu phiếu", str(exc))
            return False

    def save(self) -> None:
        if self._save_core():
            info(self, "Đã lưu", "Đã lưu phiếu đánh giá.")

    def save_next(self) -> None:
        if self._save_core():
            self.next_requested = True
            self.accept()

    def view_next(self) -> None:
        self.next_requested = True
        self.accept()


class EvaluationRoundDialog(QDialog):
    def __init__(self, db: Database, round_id: int, project_root: Path, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.db = db
        self.round_id = int(round_id)
        self.project_root = project_root
        self.current_filtered_ids: list[int] = []
        self.import_file = ""
        self.setWindowTitle("CHI TIẾT LẦN ĐÁNH GIÁ")
        self.resize(1500, 900)
        layout = QVBoxLayout(self)

        self.header = QFrame()
        self.header.setObjectName("Card")
        header_layout = QVBoxLayout(self.header)
        title_row = QHBoxLayout()
        self.title_label = QLabel()
        self.title_label.setStyleSheet("font-size:20px;font-weight:900;color:#0F172A;")
        self.status_label = QLabel()
        self.status_label.setMinimumWidth(180)
        self.status_label.setAlignment(Qt.AlignCenter)
        title_row.addWidget(self.title_label)
        title_row.addWidget(self.status_label)
        title_row.addStretch(1)
        title_row.addWidget(make_button("QUAY LẠI DANH SÁCH", self.accept))
        header_layout.addLayout(title_row)

        action_row = QHBoxLayout()
        self.save_roles_button = make_button("LƯU PHÂN CÔNG", self.save_roles, primary=True)
        action_row.addWidget(self.save_roles_button)
        self.copy_previous_button = make_button("SAO CHÉP PHÂN CÔNG TỪ LẦN TRƯỚC", self.copy_previous)
        action_row.addWidget(self.copy_previous_button)
        self.export_form_button = make_button("XUẤT DỮ LIỆU TẠO FORM", self.export_form, primary=True)
        action_row.addWidget(self.export_form_button)
        self.close_button = make_button("CHỐT", self.toggle_close)
        action_row.addWidget(self.close_button)
        self.import_voucher_button = make_button("NHẬP FILE VOUCHER", self.import_voucher_file, primary=True)
        action_row.addWidget(self.import_voucher_button)
        self.print_all_button = make_button("IN TOÀN BỘ PHIẾU ĐÁNH GIÁ", self.print_all_evaluations, primary=True)
        action_row.addWidget(self.print_all_button)
        action_row.addStretch(1)
        header_layout.addLayout(action_row)
        layout.addWidget(self.header)

        self.tabs = QTabWidget()
        layout.addWidget(self.tabs, 1)
        self._build_overview_tab()
        self._build_employees_tab()
        self._build_import_tab()
        self.refresh()

    def _build_overview_tab(self) -> None:
        page = QWidget()
        layout = QVBoxLayout(page)
        cards = QGridLayout()
        self.summary_labels: dict[str, QLabel] = {}
        labels = [
            ("total", "TỔNG NHÂN VIÊN"),
            ("evaluated", "ĐÃ ĐÁNH GIÁ"),
            ("pending", "CHƯA ĐÁNH GIÁ"),
            ("duplicate", "TRÙNG PHẢN HỒI"),
            ("vouchers", "TỔNG VOUCHER"),
        ]
        for i, (key, label) in enumerate(labels):
            frame = QFrame(); frame.setObjectName("Card")
            box = QVBoxLayout(frame)
            value = QLabel("0"); value.setObjectName("CardValue")
            caption = QLabel(label); caption.setObjectName("CardLabel")
            box.addWidget(value); box.addWidget(caption)
            self.summary_labels[key] = value
            cards.addWidget(frame, i // 3, i % 3)
        layout.addLayout(cards)
        note = QLabel(
            "LUỒNG CHÍNH: 1) Chọn bộ tiêu chí cho toàn bộ nhân viên → 2) Xuất dữ liệu tạo Form → "
            "3) Nhập phản hồi Form. Người chưa có dữ liệu hoặc bị trùng sẽ nhập tay trực tiếp trên SQLite."
        )
        note.setObjectName("Muted")
        note.setWordWrap(True)
        layout.addWidget(note)
        layout.addStretch(1)
        self.tabs.addTab(page, "TỔNG QUAN")

    def _build_employees_tab(self) -> None:
        page = QWidget()
        layout = QVBoxLayout(page)
        self.employee_voucher_summary = QLabel("ĐÃ ĐÁNH GIÁ: 0/0 NHÂN VIÊN   •   TỔNG VOUCHER CẦN PHÂN: 0")
        self.employee_voucher_summary.setStyleSheet(
            "background:#EEF2FF;color:#3730A3;padding:9px 12px;border-radius:7px;font-weight:900;"
        )
        layout.addWidget(self.employee_voucher_summary)
        filters = QFrame(); filters.setObjectName("Card")
        grid = QGridLayout(filters)
        self.search = QLineEdit(); self.search.setPlaceholderText("TÌM NHANH MÃ NV / HỌ TÊN")
        self.search.textChanged.connect(self.refresh_employees)
        self.role_filter = QComboBox(); self.role_filter.addItem("TẤT CẢ BỘ TIÊU CHÍ", "")
        for role in ROLES: self.role_filter.addItem(role.upper(), role)
        self.role_filter.currentIndexChanged.connect(self.refresh_employees)
        self.status_filter = QComboBox(); self.status_filter.addItem("TẤT CẢ TRẠNG THÁI", "")
        for status in STATUS_EMPLOYEE: self.status_filter.addItem(status, status)
        self.status_filter.currentIndexChanged.connect(self.refresh_employees)
        self.rating_filter = QComboBox(); self.rating_filter.addItem("TẤT CẢ XẾP LOẠI", "")
        for rating in RATINGS: self.rating_filter.addItem(rating, rating)
        self.rating_filter.currentIndexChanged.connect(self.refresh_employees)
        self.source_filter = QComboBox(); self.source_filter.addItem("TẤT CẢ NGUỒN", "")
        for source in SOURCES: self.source_filter.addItem(source, source)
        self.source_filter.currentIndexChanged.connect(self.refresh_employees)
        self.only_unassigned = QCheckBox("CHỈ XEM CHƯA CHỌN BỘ TIÊU CHÍ")
        self.only_unassigned.stateChanged.connect(self.refresh_employees)
        grid.addWidget(self.search, 0, 0, 1, 2)
        grid.addWidget(self.role_filter, 0, 2)
        grid.addWidget(self.status_filter, 0, 3)
        grid.addWidget(self.rating_filter, 1, 0)
        grid.addWidget(self.source_filter, 1, 1)
        grid.addWidget(self.only_unassigned, 1, 2, 1, 2)
        layout.addWidget(filters)
        self.employee_table = QTableWidget(0, 13)
        self.employee_table.setHorizontalHeaderLabels([
            "STT", "HẠNG", "MÃ NV", "HỌ VÀ TÊN", "BỘ TIÊU CHÍ", "NGƯỜI ĐÁNH GIÁ",
            "TRẠNG THÁI", "NGUỒN", "TỔNG ĐIỂM", "XẾP LOẠI", "SL VOUCHER",
            "MÃ VOUCHER ĐÃ PHÂN", "THAO TÁC",
        ])
        self.employee_table.verticalHeader().setVisible(False)
        self.employee_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.employee_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.employee_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.employee_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self.employee_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeToContents)
        for col in range(4, 11):
            self.employee_table.horizontalHeader().setSectionResizeMode(col, QHeaderView.ResizeToContents)
        self.employee_table.horizontalHeader().setSectionResizeMode(11, QHeaderView.Stretch)
        self.employee_table.horizontalHeader().setSectionResizeMode(12, QHeaderView.ResizeToContents)
        self.employee_table.setWordWrap(False)
        layout.addWidget(self.employee_table, 1)
        self.tabs.addTab(page, "NHÂN VIÊN")

    def _build_import_tab(self) -> None:
        page = QWidget()
        layout = QVBoxLayout(page)
        card = QFrame(); card.setObjectName("Card")
        grid = QGridLayout(card)
        self.import_path = QLineEdit(); self.import_path.setReadOnly(True); self.import_path.setPlaceholderText("CHƯA CHỌN FILE .XLSX")
        grid.addWidget(self.import_path, 0, 0, 1, 3)
        self.choose_import_button = make_button("CHỌN FILE PHẢN HỒI", self.choose_import_file)
        self.import_form_button = make_button("NHẬP DỮ LIỆU FORM", self.import_form, primary=True)
        grid.addWidget(self.choose_import_button, 1, 0)
        grid.addWidget(self.import_form_button, 1, 1)
        grid.setColumnStretch(2, 1)
        layout.addWidget(card)
        self.import_result = QLabel("Chưa nhập dữ liệu Form.")
        self.import_result.setObjectName("Muted")
        self.import_result.setWordWrap(True)
        self.import_result.setAlignment(Qt.AlignTop | Qt.AlignLeft)
        layout.addWidget(self.import_result)
        layout.addStretch(1)
        self.tabs.addTab(page, "NHẬP FORM")

    def refresh(self) -> None:
        round_row = self.db.get_evaluation_round(self.round_id)
        if round_row is None:
            return
        self.title_label.setText(f"LẦN ĐÁNH GIÁ: {round_row['label']}")
        status = str(round_row["status"])
        self.status_label.setText(status)
        is_closed = status == "ĐÃ CHỐT"
        if is_closed:
            self.status_label.setStyleSheet("background:#DCFCE7;color:#166534;padding:8px;border-radius:7px;font-weight:900;")
            self.close_button.setText("MỞ LẠI")
        else:
            self.status_label.setStyleSheet("background:#DBEAFE;color:#1E40AF;padding:8px;border-radius:7px;font-weight:900;")
            self.close_button.setText("CHỐT")

        # ĐÃ CHỐT = khóa toàn bộ dữ liệu đánh giá. Chỉ các thao tác hậu kỳ Voucher/in còn dùng được.
        for button in (self.save_roles_button, self.copy_previous_button, self.export_form_button,
                       self.choose_import_button, self.import_form_button):
            button.setEnabled(not is_closed)
        self.import_voucher_button.setEnabled(is_closed)
        self.import_voucher_button.setToolTip(
            "Nhập file Voucher sau khi đã CHỐT lần đánh giá." if not is_closed else ""
        )
        self.print_all_button.setEnabled(is_closed)
        self.print_all_button.setToolTip(
            "Hãy CHỐT lần đánh giá trước khi in phiếu." if not is_closed else ""
        )

        summary = self.db.evaluation_round_summary(self.round_id)
        for key, widget in self.summary_labels.items():
            widget.setText(str(summary.get(key, 0)))
        self.employee_voucher_summary.setText(
            f"ĐÃ ĐÁNH GIÁ: {summary.get('evaluated', 0)}/{summary.get('total', 0)} NHÂN VIÊN"
            f"   •   TỔNG VOUCHER CẦN PHÂN: {summary.get('vouchers', 0)}"
        )
        self.refresh_employees()

    def save_roles(self) -> None:
        changed = 0
        for row in range(self.employee_table.rowCount()):
            id_item = self.employee_table.item(row, 0)
            combo = self.employee_table.cellWidget(row, 4)
            if id_item is None or not isinstance(combo, QComboBox):
                continue
            round_employee_id = int(id_item.data(Qt.UserRole))
            role = str(combo.currentData() or "")
            current = self.db.get_evaluation_round_employee(round_employee_id)
            if current and str(current["role"] or "") != role:
                try:
                    self.db.set_evaluation_round_employee_role(round_employee_id, role)
                    changed += 1
                except Exception as exc:
                    warning(self, "Không thể lưu phân công", str(exc))
                    return
        info(self, "Đã lưu", f"Đã lưu phân công bộ tiêu chí. Thay đổi: {changed} nhân viên.")
        self.refresh()

    def copy_previous(self) -> None:
        if not confirm(self, "Sao chép phân công", "Sao chép Pha chế/Chạy bàn từ lần đánh giá gần nhất trước đó?"):
            return
        try:
            count = self.db.copy_evaluation_roles_from_previous(self.round_id)
            info(self, "Đã sao chép", f"Đã sao chép bộ tiêu chí cho {count} nhân viên.")
            self.refresh()
        except Exception as exc:
            warning(self, "Không thể sao chép", str(exc))

    def export_form(self) -> None:
        # Lưu các lựa chọn đang hiển thị trước khi kiểm tra xuất.
        self._save_roles_silent()
        missing = self.db.evaluation_round_unassigned_count(self.round_id)
        if missing:
            warning(self, "Chưa thể xuất", f"Còn {missing} nhân viên chưa chọn PHA CHẾ / CHẠY BÀN.")
            return
        round_row = self.db.get_evaluation_round(self.round_id)
        if round_row is None:
            return
        default_name = f"DU_LIEU_TAO_FORM_DANH_GIA_{str(round_row['label']).replace('/', '-')}.xlsx"
        default = Path.home() / "Downloads" / default_name
        filename, _ = QFileDialog.getSaveFileName(self, "Xuất dữ liệu tạo Form", str(default), "Excel (*.xlsx)")
        if not filename:
            return
        try:
            criteria = self.db.prepare_evaluation_round_criteria(self.round_id, refresh=True)
            employees = self.db.list_evaluation_round_employees(self.round_id)
            target = export_evaluation_round_package(Path(filename), round_row, employees, criteria)
            info(
                self,
                "Đã xuất dữ liệu tạo Form",
                f"Đã tạo:\n{target}\n\nGồm 4 sheet: CAU_HINH, NHAN_VIEN, TIEU_CHI_PHA_CHE, TIEU_CHI_CHAY_BAN.",
            )
        except Exception as exc:
            warning(self, "Không thể xuất", str(exc))

    def _save_roles_silent(self) -> None:
        for row in range(self.employee_table.rowCount()):
            id_item = self.employee_table.item(row, 0)
            combo = self.employee_table.cellWidget(row, 4)
            if id_item is None or not isinstance(combo, QComboBox):
                continue
            round_employee_id = int(id_item.data(Qt.UserRole))
            role = str(combo.currentData() or "")
            current = self.db.get_evaluation_round_employee(round_employee_id)
            if current and str(current["role"] or "") != role:
                self.db.set_evaluation_round_employee_role(round_employee_id, role)

    def toggle_close(self) -> None:
        row = self.db.get_evaluation_round(self.round_id)
        if row is None:
            return
        if str(row["status"]) == "ĐÃ CHỐT":
            voucher_stats = self.db.evaluation_round_voucher_stats(self.round_id)
            allocated = int(voucher_stats.get("allocated", 0))
            extra = (
                f"\n\nLần này đã phân {allocated} mã Voucher. Nếu sửa SỐ LƯỢNG VOUCHER của nhân viên, "
                "mã đã phân cho người đó sẽ được xóa và cần nhập lại file Voucher trước khi in."
                if allocated else ""
            )
            if confirm(
                self,
                "Mở lại",
                "Mở lại lần đánh giá này để tiếp tục chỉnh sửa?\n\n"
                "Sau khi mở lại, phiếu đánh giá sẽ được phép sửa cho đến khi CHỐT lại." + extra,
            ):
                self.db.set_evaluation_round_status(self.round_id, "ĐANG THỰC HIỆN")
                self.refresh()
            return
        summary = self.db.evaluation_round_summary(self.round_id)
        text = (
            f"Chốt lần đánh giá {row['label']}?\n\n"
            f"Đã đánh giá: {summary.get('evaluated', 0)}\n"
            f"Chưa đánh giá: {summary.get('pending', 0)}\n"
            f"Trùng phản hồi: {summary.get('duplicate', 0)}\n\n"
            "Hệ thống vẫn cho chốt dù chưa đủ toàn bộ kết quả."
        )
        if confirm(self, "CHỐT LẦN ĐÁNH GIÁ", text):
            self.db.set_evaluation_round_status(self.round_id, "ĐÃ CHỐT")
            self.refresh()

    def export_voucher_excel(self) -> None:
        round_row = self.db.get_evaluation_round(self.round_id)
        if round_row is None:
            warning(self, "Không thể xuất", "Không tìm thấy lần đánh giá hiện tại.")
            return

        employees = self.db.list_evaluation_round_employees(self.round_id, status="ĐÃ ĐÁNH GIÁ")
        if not employees:
            warning(
                self,
                "Chưa có dữ liệu Voucher",
                "Lần đánh giá này chưa có nhân viên nào ở trạng thái ĐÃ ĐÁNH GIÁ.",
            )
            return

        safe_label = str(round_row["label"]).replace("/", "-").replace("\\", "-")
        default = Path.home() / "Downloads" / f"DANH_SACH_VOUCHER_{safe_label}.xlsx"
        filename, _ = QFileDialog.getSaveFileName(
            self,
            "Xuất danh sách Voucher nhân viên",
            str(default),
            "Excel (*.xlsx)",
        )
        if not filename:
            return

        try:
            target = export_evaluation_voucher_file(Path(filename), round_row, employees)
            total = sum(int(row.get("voucher_count") or 0) for row in employees)
            info(
                self,
                "Đã xuất Excel Voucher",
                f"Đã xuất {len(employees)} nhân viên ĐÃ ĐÁNH GIÁ.\n"
                f"Tổng Voucher: {total}\n\n"
                f"File: {target}",
            )
        except Exception as exc:
            warning(self, "Không thể xuất Excel Voucher", str(exc))

    def import_voucher_file(self) -> None:
        round_row = self.db.get_evaluation_round(self.round_id)
        if round_row is None:
            warning(self, "Không thể nhập Voucher", "Không tìm thấy lần đánh giá hiện tại.")
            return
        if str(round_row["status"]) != "ĐÃ CHỐT":
            warning(
                self,
                "Hãy chốt lần đánh giá",
                "Hãy hoàn tất đánh giá và bấm CHỐT trước khi nhập file Voucher. "
                "Sau khi chốt, số lượng Voucher của từng nhân viên sẽ được khóa để phân mã chính xác.",
            )
            return

        stats = self.db.evaluation_round_voucher_stats(self.round_id)
        required = int(stats.get("required", 0))
        if required <= 0:
            warning(
                self,
                "Chưa cần phân Voucher",
                "Tổng SỐ LƯỢNG VOUCHER của nhân viên ĐÃ ĐÁNH GIÁ đang bằng 0.",
            )
            return

        filename, _ = QFileDialog.getOpenFileName(
            self,
            "Chọn file Voucher xuất từ phần mềm",
            str(Path.home() / "Downloads"),
            "Excel (*.xlsx *.xlsm)",
        )
        if not filename:
            return

        try:
            vouchers = import_voucher_export_file(Path(filename))
        except (ExcelImportError, ValueError, OSError) as exc:
            warning(self, "Không đọc được file Voucher", str(exc))
            return

        file_total = len(vouchers)
        if file_total < required:
            warning(
                self,
                "Không đủ Voucher",
                f"Tổng Voucher cần: {required}\n"
                f"File hiện có: {file_total}\n\n"
                "Không phân Voucher. Hãy chọn file có đủ số lượng.",
            )
            return

        existing = int(stats.get("allocated", 0))
        if existing > 0:
            if not confirm(
                self,
                "Phân lại Voucher",
                f"Lần đánh giá này đã phân {existing} mã Voucher.\n\n"
                "Nhập file mới sẽ xóa phân bổ hiện tại và phân lại từ đầu theo thứ tự nhân viên.\n"
                "Bạn có muốn tiếp tục?",
            ):
                return

        try:
            result = self.db.assign_evaluation_vouchers(
                self.round_id, vouchers, Path(filename).name
            )
            skipped = int(result.get("skipped_used", 0))
            extra = (
                f"\nMã đã dùng ở lần đánh giá khác và được bỏ qua: {skipped}"
                if skipped else ""
            )
            info(
                self,
                "Đã phân Voucher",
                f"Tổng Voucher cần: {result['required']}\n"
                f"File có: {result['file_total']}\n"
                f"Đã phân: {result['assigned']}\n"
                f"Còn chưa dùng trong file: {result['remaining']}"
                f"{extra}\n\n"
                "Mã Voucher đã được lưu cố định vào lần đánh giá này.\n"
                "Khi in toàn bộ phiếu, Voucher sẽ nằm ở mặt sau phần A5 của đúng nhân viên.",
            )
            self.refresh()
        except (DatabaseError, ValueError) as exc:
            warning(self, "Không thể phân Voucher", str(exc))

    def print_all_evaluations(self) -> None:
        round_row = self.db.get_evaluation_round(self.round_id)
        if round_row is None:
            warning(self, "Không thể in", "Không tìm thấy lần đánh giá hiện tại.")
            return
        if str(round_row["status"]) != "ĐÃ CHỐT":
            warning(
                self,
                "Chưa chốt lần đánh giá",
                "Hãy bấm CHỐT trước khi in. Khi đã chốt, phiếu đánh giá sẽ bị khóa và không thể sửa cho đến khi MỞ LẠI.",
            )
            return

        employees = self.db.list_evaluation_round_employees(self.round_id, status="ĐÃ ĐÁNH GIÁ")
        if not employees:
            warning(
                self,
                "Chưa có phiếu để in",
                "Lần đánh giá này chưa có nhân viên nào ở trạng thái ĐÃ ĐÁNH GIÁ.",
            )
            return

        voucher_stats = self.db.evaluation_round_voucher_stats(self.round_id)
        required_vouchers = int(voucher_stats.get("required", 0))
        allocated_vouchers = int(voucher_stats.get("allocated", 0))
        if required_vouchers > allocated_vouchers:
            warning(
                self,
                "Chưa phân đủ mã Voucher",
                f"Tổng Voucher cần: {required_vouchers}\n"
                f"Đã phân mã: {allocated_vouchers}\n\n"
                "Hãy bấm NHẬP FILE VOUCHER trước khi in để mặt sau có đúng mã Voucher của từng nhân viên.",
            )
            return

        safe_label = str(round_row["label"]).replace("/", "-").replace("\\", "-")
        default = Path.home() / "Downloads" / f"PHIEU_DANH_GIA_{safe_label}_A4_NGANG_2_PHIEU_A5.pdf"
        filename, _ = QFileDialog.getSaveFileName(
            self,
            "In toàn bộ phiếu đánh giá - A4 ngang, 2 phiếu A5/tờ",
            str(default),
            "PDF (*.pdf)",
        )
        if not filename:
            return

        try:
            # Lấy đúng snapshot tiêu chí của lần đánh giá để lịch sử không thay đổi
            # khi bộ tiêu chí gốc được sửa ở các lần sau.
            criteria_by_role = {
                role: self.db.list_evaluation_round_criteria(self.round_id, role)
                for role in ROLES
            }
            scores_by_employee = {
                int(employee["id"]): self.db.get_evaluation_round_scores(int(employee["id"]))
                for employee in employees
            }
            vouchers_by_employee = self.db.list_evaluation_round_vouchers(self.round_id)
            target = export_evaluation_round_pdf(
                Path(filename),
                round_row,
                employees,
                criteria_by_role,
                scores_by_employee,
                vouchers_by_employee,
            )
            info(
                self,
                "Đã tạo PDF A4 ngang",
                f"Đã in {len(employees)} nhân viên.\n\n"
                f"Mỗi tờ A4 ngang = tối đa 2 phiếu A5:\n"
                f"- Trang lẻ: mặt trước Phiếu đánh giá\n"
                f"- Trang chẵn: mặt sau Mã Voucher\n"
                f"- Cắt theo đường giữa để được 2 phiếu A5\n"
                f"Nếu số nhân viên lẻ, nửa cuối được để trắng.\n"
                f"Chỉ gồm nhân viên ĐÃ ĐÁNH GIÁ.\n\n"
                f"Khi in: chọn A4 ngang, tỷ lệ 100% / Actual size.\n"
                f"Với máy in 1 mặt, nên in thử trang 1-2 trước để xác định chiều nạp lại giấy.\n\n"
                f"File: {target}",
            )
        except Exception as exc:
            warning(self, "Không thể tạo PDF", str(exc))

    def refresh_employees(self, *_args) -> None:
        round_row = self.db.get_evaluation_round(self.round_id)
        is_closed = bool(round_row and str(round_row["status"]) == "ĐÃ CHỐT")
        vouchers_by_employee = self.db.list_evaluation_round_vouchers(self.round_id)
        rows = self.db.list_evaluation_round_employees(
            self.round_id,
            search=self.search.text() if hasattr(self, "search") else "",
            role=str(self.role_filter.currentData() or "") if hasattr(self, "role_filter") else "",
            status=str(self.status_filter.currentData() or "") if hasattr(self, "status_filter") else "",
            rating=str(self.rating_filter.currentData() or "") if hasattr(self, "rating_filter") else "",
            source=str(self.source_filter.currentData() or "") if hasattr(self, "source_filter") else "",
        )
        if hasattr(self, "only_unassigned") and self.only_unassigned.isChecked():
            rows = [row for row in rows if not str(row.get("role") or "").strip()]
        self.current_filtered_ids = [int(row["id"]) for row in rows]
        self.employee_table.setRowCount(len(rows))
        for index, row in enumerate(rows):
            id_item = QTableWidgetItem(str(index + 1))
            id_item.setData(Qt.UserRole, int(row["id"]))
            id_item.setTextAlignment(Qt.AlignCenter)
            self.employee_table.setItem(index, 0, id_item)
            rank = row.get("rank_position")
            rank_item = QTableWidgetItem("—" if rank is None else str(rank)); rank_item.setTextAlignment(Qt.AlignCenter)
            self.employee_table.setItem(index, 1, rank_item)
            self.employee_table.setItem(index, 2, QTableWidgetItem(str(row["employee_code"])))
            self.employee_table.setItem(index, 3, QTableWidgetItem(str(row["employee_name"])))
            combo = QComboBox(); combo.addItem("CHƯA CHỌN", "")
            for role in ROLES: combo.addItem(role.upper(), role)
            current_role = str(row.get("role") or "")
            combo.setCurrentIndex(max(0, combo.findData(current_role)))
            combo.currentIndexChanged.connect(
                lambda _idx, rid=int(row["id"]), cb=combo: self._role_changed(rid, cb)
            )
            # ĐÃ CHỐT = toàn bộ phân công/phiếu chỉ xem. Khi đang mở, nhân viên đã có kết quả cũng không đổi bộ tiêu chí.
            combo.setEnabled((not is_closed) and str(row["status"]) != "ĐÃ ĐÁNH GIÁ")
            self.employee_table.setCellWidget(index, 4, combo)
            values = [
                row.get("evaluator_name") or "—",
                row.get("status") or "",
                row.get("data_source") or "—",
                row.get("total_points") if str(row.get("status")) == "ĐÃ ĐÁNH GIÁ" else "—",
                row.get("rating") or "—",
                row.get("voucher_count") or 0,
            ]
            for offset, value in enumerate(values, start=5):
                item = QTableWidgetItem(str(value)); item.setTextAlignment(Qt.AlignCenter if offset != 5 else Qt.AlignVCenter | Qt.AlignLeft)
                if offset == 9 and str(value) in RATING_COLORS:
                    bg, fg = RATING_COLORS[str(value)]; item.setBackground(QColor(bg)); item.setForeground(QColor(fg))
                self.employee_table.setItem(index, offset, item)

            voucher_rows = vouchers_by_employee.get(int(row["id"]), [])
            voucher_codes = ", ".join(str(v.get("voucher_code") or "").strip() for v in voucher_rows if str(v.get("voucher_code") or "").strip())
            voucher_item = QTableWidgetItem(voucher_codes or "—")
            voucher_item.setToolTip(voucher_codes or "Chưa phân mã Voucher")
            self.employee_table.setItem(index, 11, voucher_item)

            button = QPushButton("XEM PHIẾU" if is_closed else "MỞ PHIẾU")
            button.setMinimumHeight(32)
            button.clicked.connect(lambda _checked=False, rid=int(row["id"]): self.open_employee(rid))
            self.employee_table.setCellWidget(index, 12, button)
            self.employee_table.setRowHeight(index, 44)

    def open_employee(self, round_employee_id: int) -> None:
        current_id = int(round_employee_id)
        while True:
            try:
                dialog = EvaluationEmployeeDialog(self.db, current_id, self)
            except Exception as exc:
                warning(self, "Không thể mở phiếu", str(exc))
                return
            dialog.exec()
            next_requested = dialog.next_requested
            self.refresh()
            if not next_requested:
                return
            ids = list(self.current_filtered_ids)
            if current_id not in ids:
                return
            index = ids.index(current_id)
            if index + 1 >= len(ids):
                info(self, "Đã hết danh sách", "Đây là nhân viên cuối cùng trong danh sách đang lọc.")
                return
            current_id = ids[index + 1]

    def _role_changed(self, round_employee_id: int, combo: QComboBox) -> None:
        try:
            self.db.set_evaluation_round_employee_role(int(round_employee_id), str(combo.currentData() or ""))
        except Exception as exc:
            warning(self, "Không thể lưu bộ tiêu chí", str(exc))

    def choose_import_file(self) -> None:
        filename, _ = QFileDialog.getOpenFileName(self, "Chọn file phản hồi đánh giá", str(Path.home() / "Downloads"), "Excel (*.xlsx)")
        if filename:
            self.import_file = filename
            self.import_path.setText(filename)

    def import_form(self) -> None:
        if not self.import_file:
            warning(self, "Chưa chọn file", "Hãy chọn file .xlsx phản hồi Google Form.")
            return
        try:
            submissions = import_evaluation_form_rows(Path(self.import_file))
            result = self.db.import_evaluation_form_submissions(self.round_id, Path(self.import_file).name, submissions)
        except (ExcelImportError, DatabaseError, ValueError) as exc:
            warning(self, "Không thể nhập dữ liệu Form", str(exc))
            return
        except Exception as exc:
            warning(self, "Không thể nhập dữ liệu Form", str(exc))
            return
        errors = result.get("errors") or []
        text = (
            "TÓM TẮT KẾT QUẢ IMPORT\n\n"
            f"Đã nhập: {result.get('imported', 0)}\n"
            f"Chưa đánh giá: {result.get('pending', 0)}\n"
            f"Trùng phản hồi: {result.get('duplicate', 0)}\n"
            f"Lỗi: {result.get('error_count', 0)}"
        )
        if errors:
            text += "\n\n" + "\n".join(str(item) for item in errors[:8])
            if len(errors) > 8:
                text += f"\n... và {len(errors)-8} lỗi khác"
        self.import_result.setText(text)
        info(self, "Đã xử lý file Form", text)
        self.refresh()


class RoundsPage(QWidget):
    def __init__(self, db: Database, project_root: Path) -> None:
        super().__init__()
        self.db = db
        self.project_root = project_root
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        toolbar = QHBoxLayout()
        toolbar.addWidget(QLabel("CHỌN LẦN ĐÁNH GIÁ:"))
        self.round_combo = QComboBox()
        self.round_combo.setMinimumWidth(210)
        self.round_combo.setMinimumHeight(40)
        toolbar.addWidget(self.round_combo)
        toolbar.addWidget(make_button("+ TẠO LẦN ĐÁNH GIÁ", self.create_round, primary=True))
        toolbar.addWidget(make_button("MỞ", self.open_selected))
        toolbar.addWidget(make_button("XÓA", self.delete_selected, danger=True))
        toolbar.addStretch(1)
        self.status_filter = QComboBox()
        self.status_filter.addItem("TẤT CẢ TRẠNG THÁI", "")
        self.status_filter.addItem("CHỈ XEM ĐANG THỰC HIỆN", "ĐANG THỰC HIỆN")
        self.status_filter.addItem("CHỈ XEM ĐÃ CHỐT", "ĐÃ CHỐT")
        self.status_filter.currentIndexChanged.connect(self.refresh)
        toolbar.addWidget(self.status_filter)
        layout.addLayout(toolbar)
        self.table = new_table(["NGÀY ĐÁNH GIÁ", "TRẠNG THÁI", "TỔNG NV", "ĐÃ ĐÁNH GIÁ", "CHƯA ĐÁNH GIÁ", "TRÙNG", "TỔNG VOUCHER"])
        self.table.doubleClicked.connect(self.open_selected)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        for col in range(1, 7): self.table.horizontalHeader().setSectionResizeMode(col, QHeaderView.ResizeToContents)
        layout.addWidget(self.table, 1)
        self.refresh()

    def refresh(self, *_args) -> None:
        current_round = self.round_combo.currentData() if hasattr(self, "round_combo") else None
        all_rows = self.db.list_evaluation_rounds()
        if hasattr(self, "round_combo"):
            self.round_combo.blockSignals(True)
            self.round_combo.clear()
            for row in all_rows:
                self.round_combo.addItem(f"{row['label']} — {row['status']}", int(row["id"]))
            idx = self.round_combo.findData(current_round)
            self.round_combo.setCurrentIndex(idx if idx >= 0 else (0 if self.round_combo.count() else -1))
            self.round_combo.blockSignals(False)
        status = str(self.status_filter.currentData() or "") if hasattr(self, "status_filter") else ""
        rows = all_rows
        if status: rows = [row for row in rows if str(row["status"]) == status]
        self.table.setRowCount(len(rows))
        for index, row in enumerate(rows):
            values = [row["label"], row["status"], row["employee_count"], row["evaluated_count"] or 0, row["pending_count"] or 0, row["duplicate_count"] or 0, row["voucher_total"] or 0]
            for col, value in enumerate(values):
                item = QTableWidgetItem(str(value)); item.setTextAlignment(Qt.AlignCenter)
                if col == 0: item.setData(Qt.UserRole, int(row["id"]))
                self.table.setItem(index, col, item)

    def selected_round_id(self) -> int | None:
        row = self.table.currentRow()
        if row >= 0:
            item = self.table.item(row, 0)
            if item and item.data(Qt.UserRole):
                return int(item.data(Qt.UserRole))
        if hasattr(self, "round_combo") and self.round_combo.currentData():
            return int(self.round_combo.currentData())
        return None

    def create_round(self) -> None:
        dialog = NewEvaluationRoundDialog(self)
        if dialog.exec() != QDialog.Accepted: return
        try:
            round_id = self.db.create_evaluation_round(dialog.iso_date())
        except Exception as exc:
            warning(self, "Không thể tạo lần đánh giá", str(exc)); return
        self.refresh()
        self._open(round_id)

    def open_selected(self, *_args) -> None:
        round_id = self.selected_round_id()
        if round_id is None:
            warning(self, "Chưa chọn", "Hãy chọn một lần đánh giá."); return
        self._open(round_id)

    def _open(self, round_id: int) -> None:
        dialog = EvaluationRoundDialog(self.db, round_id, self.project_root, self)
        dialog.exec()
        self.refresh()

    def delete_selected(self) -> None:
        round_id = self.selected_round_id()
        if round_id is None:
            warning(self, "Chưa chọn", "Hãy chọn lần đánh giá cần xóa."); return
        row = self.db.get_evaluation_round(round_id)
        if row is None: return
        if not confirm(self, "XÁC NHẬN XÓA LẦN 1", f"Xóa toàn bộ lần đánh giá {row['label']}?"):
            return
        if not confirm(self, "XÁC NHẬN XÓA LẦN 2", "Dữ liệu điểm, nhận xét, Form import và Voucher của lần này sẽ bị xóa. Tiếp tục?"):
            return
        self.db.delete_evaluation_round(round_id)
        self.refresh()


class HistoryPage(QWidget):
    def __init__(self, db: Database) -> None:
        super().__init__()
        self.db = db
        self.selected_employee_id: int | None = None
        layout = QVBoxLayout(self)
        filters = QHBoxLayout()
        self.search = QLineEdit(); self.search.setPlaceholderText("TÌM NHANH MÃ NV / HỌ TÊN")
        self.search.textChanged.connect(self._refresh_employee_combo)
        self.employee_combo = QComboBox(); self.employee_combo.setMinimumWidth(360)
        self.employee_combo.currentIndexChanged.connect(self.refresh_history)
        filters.addWidget(self.search, 1); filters.addWidget(self.employee_combo, 1); filters.addStretch(1)
        layout.addLayout(filters)
        stats = QGridLayout()
        self.stat_count = QLabel(); self.stat_latest_rating = QLabel(); self.stat_latest_rank = QLabel(); self.stat_vouchers = QLabel()
        for idx, widget in enumerate([self.stat_count, self.stat_latest_rating, self.stat_latest_rank, self.stat_vouchers]):
            widget.setMinimumHeight(48); widget.setAlignment(Qt.AlignCenter)
            widget.setStyleSheet("background:#F8FAFC;border:1px solid #CBD5E1;border-radius:7px;padding:8px;font-weight:900;")
            stats.addWidget(widget, 0, idx)
        layout.addLayout(stats)
        self.table = new_table(["NGÀY", "BỘ TIÊU CHÍ", "NGƯỜI ĐÁNH GIÁ", "TỔNG ĐIỂM", "XẾP LOẠI", "HẠNG", "THAY ĐỔI HẠNG", "VOUCHER"])
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        layout.addWidget(self.table, 1)
        self._refresh_employee_combo()

    def _refresh_employee_combo(self, *_args) -> None:
        token = self.search.text() if hasattr(self, "search") else ""
        rows = self.db.list_employees(search=token)
        current = self.employee_combo.currentData() if hasattr(self, "employee_combo") else None
        self.employee_combo.blockSignals(True)
        self.employee_combo.clear()
        for row in rows:
            self.employee_combo.addItem(f"{row['code']} – {row['name']}", int(row["id"]))
        index = self.employee_combo.findData(self.selected_employee_id or current)
        self.employee_combo.setCurrentIndex(index if index >= 0 else (0 if self.employee_combo.count() else -1))
        self.employee_combo.blockSignals(False)
        self.refresh_history()

    def select_employee(self, employee_id: int) -> None:
        self.selected_employee_id = int(employee_id)
        self.search.clear()
        self._refresh_employee_combo()
        index = self.employee_combo.findData(int(employee_id))
        if index >= 0:
            self.employee_combo.setCurrentIndex(index)

    def refresh_history(self, *_args) -> None:
        employee_id = self.employee_combo.currentData() if hasattr(self, "employee_combo") else None
        if not employee_id:
            self.table.setRowCount(0); return
        self.selected_employee_id = int(employee_id)
        rows = self.db.evaluation_employee_history(int(employee_id))
        voucher_total = sum(int(row.get("voucher_count") or 0) for row in rows)
        self.stat_count.setText(f"SỐ LẦN ĐÁNH GIÁ\n{len(rows)}")
        self.stat_latest_rating.setText(f"XẾP LOẠI GẦN NHẤT\n{rows[0].get('rating') if rows else '—'}")
        self.stat_latest_rank.setText(f"HẠNG GẦN NHẤT\n{rows[0].get('rank_position') if rows and rows[0].get('rank_position') else '—'}")
        self.stat_vouchers.setText(f"TỔNG VOUCHER\n{voucher_total}")
        self.table.setRowCount(len(rows))
        for index, row in enumerate(rows):
            change = row.get("rank_change")
            if change is None: change_text = "—"
            elif change > 0: change_text = f"+{change}"
            elif change < 0: change_text = str(change)
            else: change_text = "KHÔNG ĐỔI"
            values = [row["round_label"], row["role"], row["evaluator_name"] or "—", row["total_points"], row["rating"] or "—", row.get("rank_position") or "—", change_text, row["voucher_count"] or 0]
            for col, value in enumerate(values):
                item = QTableWidgetItem(str(value)); item.setTextAlignment(Qt.AlignCenter if col != 2 else Qt.AlignVCenter | Qt.AlignLeft)
                if col == 4 and str(value) in RATING_COLORS:
                    bg, fg = RATING_COLORS[str(value)]; item.setBackground(QColor(bg)); item.setForeground(QColor(fg))
                self.table.setItem(index, col, item)


class OverallPage(QWidget):
    def __init__(self, db: Database, open_history_callback: Callable[[int], None]) -> None:
        super().__init__()
        self.db = db
        self.open_history_callback = open_history_callback
        layout = QVBoxLayout(self)
        filters = QFrame(); filters.setObjectName("Card")
        grid = QGridLayout(filters)
        self.search = QLineEdit(); self.search.setPlaceholderText("TÌM NHANH MÃ NV / HỌ TÊN")
        self.evaluator = QLineEdit(); self.evaluator.setPlaceholderText("NGƯỜI ĐÁNH GIÁ")
        self.role = QComboBox(); self.role.addItem("TẤT CẢ BỘ TIÊU CHÍ", "")
        for value in ROLES: self.role.addItem(value.upper(), value)
        self.rating = QComboBox(); self.rating.addItem("TẤT CẢ XẾP LOẠI", "")
        for value in RATINGS: self.rating.addItem(value, value)
        self.source = QComboBox(); self.source.addItem("TẤT CẢ NGUỒN", "")
        for value in SOURCES: self.source.addItem(value, value)
        self.sort = QComboBox(); self.sort.addItem("NGÀY MỚI NHẤT", "date_desc"); self.sort.addItem("ĐIỂM CAO NHẤT", "score_desc"); self.sort.addItem("ĐIỂM THẤP NHẤT", "score_asc")
        self.use_dates = QCheckBox("LỌC THEO KHOẢNG NGÀY")
        self.date_from = QDateEdit(QDate.currentDate().addYears(-1)); self.date_from.setCalendarPopup(True); self.date_from.setDisplayFormat("dd/MM/yyyy")
        self.date_to = QDateEdit(QDate.currentDate()); self.date_to.setCalendarPopup(True); self.date_to.setDisplayFormat("dd/MM/yyyy")
        widgets = [self.search, self.evaluator, self.role, self.rating, self.source, self.sort]
        for widget in widgets:
            if isinstance(widget, QLineEdit): widget.textChanged.connect(self.refresh)
            else: widget.currentIndexChanged.connect(self.refresh)
        self.use_dates.stateChanged.connect(self.refresh); self.date_from.dateChanged.connect(self.refresh); self.date_to.dateChanged.connect(self.refresh)
        grid.addWidget(self.search, 0, 0, 1, 2); grid.addWidget(self.evaluator, 0, 2); grid.addWidget(self.role, 0, 3)
        grid.addWidget(self.rating, 1, 0); grid.addWidget(self.source, 1, 1); grid.addWidget(self.sort, 1, 2); grid.addWidget(self.use_dates, 1, 3)
        grid.addWidget(QLabel("TỪ:"), 2, 0); grid.addWidget(self.date_from, 2, 1); grid.addWidget(QLabel("ĐẾN:"), 2, 2); grid.addWidget(self.date_to, 2, 3)
        layout.addWidget(filters)
        self.summary = QLabel(); self.summary.setObjectName("Muted"); layout.addWidget(self.summary)
        self.table = QTableWidget(0, 12)
        self.table.setHorizontalHeaderLabels(["NGÀY", "MÃ NV", "HỌ VÀ TÊN", "BỘ TIÊU CHÍ", "NGƯỜI ĐÁNH GIÁ", "TỔNG ĐIỂM", "XẾP LOẠI", "HẠNG", "VOUCHER", "TỔNG VOUCHER NV", "NGUỒN", "THAO TÁC"])
        self.table.verticalHeader().setVisible(False)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(4, QHeaderView.Stretch)
        for col in [0,1,3,5,6,7,8,9,10,11]: self.table.horizontalHeader().setSectionResizeMode(col, QHeaderView.ResizeToContents)
        layout.addWidget(self.table, 1)
        self.refresh()

    def refresh(self, *_args) -> None:
        date_from = self.date_from.date().toString("yyyy-MM-dd") if self.use_dates.isChecked() else ""
        date_to = self.date_to.date().toString("yyyy-MM-dd") if self.use_dates.isChecked() else ""
        rows = self.db.evaluation_overall_rows(
            date_from=date_from, date_to=date_to, search=self.search.text(), role=str(self.role.currentData() or ""),
            rating=str(self.rating.currentData() or ""), evaluator=self.evaluator.text(), source=str(self.source.currentData() or ""),
            sort_mode=str(self.sort.currentData() or "date_desc"),
        )
        counts = {rating: 0 for rating in RATINGS}
        vouchers = 0
        for row in rows:
            if row.get("rating") in counts: counts[row["rating"]] += 1
            vouchers += int(row.get("voucher_count") or 0)
        self.summary.setText(
            f"TỔNG PHIẾU: {len(rows)}  •  " + "  •  ".join(f"{key.upper()}: {value}" for key, value in counts.items()) + f"  •  VOUCHER: {vouchers}"
        )
        self.table.setRowCount(len(rows))
        for index, row in enumerate(rows):
            values = [row["round_label"], row["employee_code"], row["employee_name"], row["role"], row["evaluator_name"] or "—", row["total_points"], row["rating"] or "—", row.get("rank_position") or "—", row["voucher_count"] or 0, row.get("employee_voucher_total") or 0, row["data_source"] or "—"]
            for col, value in enumerate(values):
                item = QTableWidgetItem(str(value)); item.setTextAlignment(Qt.AlignCenter if col not in (2,4) else Qt.AlignVCenter | Qt.AlignLeft)
                if col == 6 and str(value) in RATING_COLORS:
                    bg, fg = RATING_COLORS[str(value)]; item.setBackground(QColor(bg)); item.setForeground(QColor(fg))
                self.table.setItem(index, col, item)
            button = QPushButton("MỞ NHÂN VIÊN")
            button.clicked.connect(lambda _checked=False, eid=int(row["employee_id"]): self.open_history_callback(eid))
            self.table.setCellWidget(index, 11, button)
            self.table.setRowHeight(index, 42)


class EvaluationPage(QWidget):
    """Module Đánh giá nhân viên 1.7.5 — A4 ngang 2 phiếu A5/tờ, nhập điểm trực tiếp, khóa sau chốt."""
    def __init__(self, db: Database, project_root: Path) -> None:
        super().__init__()
        self.db = db
        self.project_root = project_root
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 20, 24, 20)
        layout.setSpacing(12)
        title = QLabel("ĐÁNH GIÁ NHÂN VIÊN"); title.setObjectName("PageTitle"); layout.addWidget(title)
        note = QLabel(
            "3 BƯỚC: TẠO LẦN ĐÁNH GIÁ → XUẤT DỮ LIỆU TẠO FORM → NHẬP DỮ LIỆU FORM VỀ SQLITE. "
            "Nhân viên chưa có dữ liệu hoặc trùng phản hồi sẽ nhập tay trực tiếp trên SQLite."
        )
        note.setObjectName("Muted"); note.setWordWrap(True); layout.addWidget(note)
        self.tabs = QTabWidget()
        self.rounds_page = RoundsPage(db, project_root)
        self.history_page = HistoryPage(db)
        self.overall_page = OverallPage(db, self.open_employee_history)
        self.criteria_page = CriteriaPage(db)
        self.rating_page = RatingSettingsPage(db)
        self.tabs.addTab(self.rounds_page, "CÁC LẦN ĐÁNH GIÁ")
        self.tabs.addTab(self.overall_page, "TỔNG HỢP ĐÁNH GIÁ")
        self.tabs.addTab(self.history_page, "LỊCH SỬ NHÂN VIÊN")
        self.tabs.addTab(self.criteria_page, "TIÊU CHÍ ĐÁNH GIÁ")
        self.tabs.addTab(self.rating_page, "CÀI ĐẶT XẾP LOẠI")
        self.tabs.currentChanged.connect(lambda _index: self.refresh_current())
        layout.addWidget(self.tabs, 1)

    def open_employee_history(self, employee_id: int) -> None:
        self.tabs.setCurrentWidget(self.history_page)
        self.history_page.select_employee(employee_id)

    def refresh_current(self) -> None:
        widget = self.tabs.currentWidget()
        refresh = getattr(widget, "refresh", None)
        if callable(refresh): refresh()

    def refresh(self) -> None:
        self.rounds_page.refresh()
        self.refresh_current()
