from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Callable

from PySide6.QtCore import QDate, Qt, Signal
from PySide6.QtWidgets import QComboBox, QDateEdit, QFrame, QHBoxLayout, QLabel, QPushButton, QWidget

from .constants import WEEKDAY_NAMES
from .database import Database


def format_week(row) -> str:
    if row is None:
        return "—"
    start = datetime.strptime(str(row["start_date"]), "%Y-%m-%d").strftime("%d/%m/%Y")
    end = datetime.strptime(str(row["end_date"]), "%Y-%m-%d").strftime("%d/%m/%Y")
    return f"{start} – {end}"


def week_day_headers(db: Database, week_id: int | None, short: bool = False) -> list[str]:
    if not week_id:
        return [day.upper() for day in WEEKDAY_NAMES]
    row = db.get_week(int(week_id))
    if row is None:
        return [day.upper() for day in WEEKDAY_NAMES]
    start = datetime.strptime(str(row["start_date"]), "%Y-%m-%d")
    result: list[str] = []
    for index, day in enumerate(WEEKDAY_NAMES):
        current = start + timedelta(days=index)
        if short:
            day_text = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][index]
        else:
            day_text = day.upper()
        result.append(f"{day_text}\n{current.strftime('%d/%m')}")
    return result


class WeekSelectorBar(QFrame):
    """Thanh chọn tuần dùng chung ngay trên các trang xếp lịch/Order."""

    week_selected = Signal(int)

    def __init__(self, db: Database, week_getter: Callable[[], int | None], parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.db = db
        self.week_getter = week_getter
        self.setObjectName("Card")

        layout = QHBoxLayout(self)
        layout.setContentsMargins(14, 10, 14, 10)
        layout.setSpacing(9)

        label = QLabel("TUẦN LÀM VIỆC")
        label.setStyleSheet("font-weight:900;color:#1E3A8A;")
        layout.addWidget(label)

        self.prev_button = QPushButton("◀ TUẦN TRƯỚC")
        self.prev_button.setMinimumHeight(38)
        self.prev_button.clicked.connect(lambda: self._move_week(-7))
        layout.addWidget(self.prev_button)

        self.combo = QComboBox()
        self.combo.setMinimumWidth(310)
        self.combo.setMinimumHeight(40)
        self.combo.currentIndexChanged.connect(self._combo_changed)
        layout.addWidget(self.combo)

        self.next_button = QPushButton("TUẦN SAU ▶")
        self.next_button.setMinimumHeight(38)
        self.next_button.clicked.connect(lambda: self._move_week(7))
        layout.addWidget(self.next_button)

        layout.addSpacing(8)
        self.date_edit = QDateEdit(QDate.currentDate())
        self.date_edit.setCalendarPopup(True)
        self.date_edit.setDisplayFormat("dd/MM/yyyy")
        self.date_edit.setMinimumWidth(145)
        self.date_edit.setMinimumHeight(40)
        layout.addWidget(self.date_edit)

        self.create_button = QPushButton("CHỌN / TẠO TUẦN")
        self.create_button.setObjectName("Primary")
        self.create_button.setMinimumHeight(38)
        self.create_button.clicked.connect(self._select_date_week)
        layout.addWidget(self.create_button)
        layout.addStretch()

        self.refresh()

    def refresh(self) -> None:
        current = self.week_getter()
        rows = self.db.list_weeks()
        self.combo.blockSignals(True)
        self.combo.clear()
        selected_index = -1
        for index, row in enumerate(rows):
            week_id = int(row["id"])
            self.combo.addItem(format_week(row), week_id)
            if current and week_id == int(current):
                selected_index = index
        if selected_index >= 0:
            self.combo.setCurrentIndex(selected_index)
        elif self.combo.count():
            self.combo.setCurrentIndex(0)
        self.combo.blockSignals(False)
        if current:
            row = self.db.get_week(int(current))
            if row is not None:
                start = datetime.strptime(str(row["start_date"]), "%Y-%m-%d").date()
                self.date_edit.setDate(QDate(start.year, start.month, start.day))

    def _combo_changed(self, index: int) -> None:
        if index < 0:
            return
        week_id = self.combo.currentData()
        if week_id is not None:
            self.week_selected.emit(int(week_id))

    def _select_date_week(self) -> None:
        qdate = self.date_edit.date()
        chosen = date(qdate.year(), qdate.month(), qdate.day())
        week_id = self.db.create_week(chosen)
        self.db.set_setting("selected_week_id", str(week_id))
        self.refresh()
        self.week_selected.emit(int(week_id))

    def _move_week(self, days: int) -> None:
        current = self.week_getter()
        if current:
            row = self.db.get_week(int(current))
            if row is not None:
                start = datetime.strptime(str(row["start_date"]), "%Y-%m-%d").date()
            else:
                start = date.today()
        else:
            start = date.today()
        target = start + timedelta(days=days)
        week_id = self.db.create_week(target)
        self.db.set_setting("selected_week_id", str(week_id))
        self.refresh()
        self.week_selected.emit(int(week_id))
