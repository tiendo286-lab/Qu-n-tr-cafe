from __future__ import annotations

import json
import re
import shutil
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterable

from .constants import BRANCHES, DEFAULT_SHIFTS, EVALUATION_CRITERIA, EVALUATION_RATING_THRESHOLDS, ROLES, SHIFTS
from .paths import backup_dir, database_path
from .spirit_seed import SPIRIT_EMPLOYEES, SPIRIT_FIXED_NEEDS_ROLE, SPIRIT_FIXED_RESOLVED


class DatabaseError(RuntimeError):
    pass


class Database:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or database_path()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.execute("PRAGMA journal_mode = WAL")
        self.conn.execute("PRAGMA busy_timeout = 5000")
        self._create_schema()
        self._migrate_dynamic_structure()
        self._seed_base_data()
        self._seed_evaluation_criteria()
        self._migrate_legacy_branch_codes()
        self._seed_spirit_data_once()
        self._cleanup_orphan_fixed_schedule_entries()
        self.ensure_current_week()
        self.cleanup_old_data()

    def close(self) -> None:
        self.conn.close()

    @contextmanager
    def transaction(self):
        try:
            self.conn.execute("BEGIN")
            yield
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise

    def _create_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS branches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                system_code TEXT,
                display_code TEXT,
                name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Đang hoạt động',
                sort_order INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS shifts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE COLLATE NOCASE,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                color TEXT NOT NULL DEFAULT '#DBEAFE',
                status TEXT NOT NULL DEFAULT 'Đang sử dụng',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS branch_shifts (
                branch_id INTEGER NOT NULL,
                shift_id INTEGER NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 0,
                start_time TEXT,
                end_time TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (branch_id, shift_id),
                FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
                FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS weeks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_date TEXT NOT NULL UNIQUE,
                end_date TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE COLLATE NOCASE,
                name TEXT NOT NULL,
                rank TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Đang làm',
                preferred_role TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS employee_branches (
                employee_id INTEGER NOT NULL,
                branch_id INTEGER NOT NULL,
                PRIMARY KEY (employee_id, branch_id),
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
                FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS employee_roles (
                employee_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                PRIMARY KEY (employee_id, role),
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS staffing_requirements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                branch_id INTEGER NOT NULL,
                weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
                shift TEXT NOT NULL,
                role TEXT NOT NULL,
                required_count INTEGER NOT NULL DEFAULT 0 CHECK (required_count >= 0),
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (branch_id, weekday, shift, role),
                FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS staffing_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                branch_id INTEGER NOT NULL,
                snapshot_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS order_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                week_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL,
                weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
                shift TEXT NOT NULL,
                status TEXT NOT NULL,
                is_manual INTEGER NOT NULL DEFAULT 0,
                imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (week_id, employee_id, weekday, shift),
                FOREIGN KEY (week_id) REFERENCES weeks(id) ON DELETE CASCADE,
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS order_import_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                week_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                row_count INTEGER NOT NULL DEFAULT 0,
                imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (week_id) REFERENCES weeks(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS order_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                week_id INTEGER NOT NULL,
                snapshot_json TEXT NOT NULL,
                source_filename TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (week_id) REFERENCES weeks(id) ON DELETE CASCADE
            );


            CREATE TABLE IF NOT EXISTS evaluation_criteria (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                code TEXT NOT NULL,
                label TEXT NOT NULL,
                max_score INTEGER NOT NULL DEFAULT 5,
                sort_order INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'Đang sử dụng',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(role, code)
            );

            CREATE TABLE IF NOT EXISTS evaluation_periods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                period_key TEXT NOT NULL UNIQUE,
                label TEXT NOT NULL,
                start_date TEXT,
                end_date TEXT,
                status TEXT NOT NULL DEFAULT 'Đang đánh giá',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS evaluation_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                period_key TEXT NOT NULL,
                employee_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                evaluator_name TEXT,
                bonus_points INTEGER NOT NULL DEFAULT 0,
                total_points INTEGER NOT NULL DEFAULT 0,
                rating TEXT,
                comments TEXT,
                voucher TEXT,
                source TEXT NOT NULL DEFAULT 'MANUAL',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(period_key, employee_id, role),
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS evaluation_scores (
                record_id INTEGER NOT NULL,
                criterion_id INTEGER NOT NULL,
                score INTEGER NOT NULL CHECK(score >= 0),
                PRIMARY KEY (record_id, criterion_id),
                FOREIGN KEY (record_id) REFERENCES evaluation_records(id) ON DELETE CASCADE,
                FOREIGN KEY (criterion_id) REFERENCES evaluation_criteria(id) ON DELETE RESTRICT
            );

            CREATE TABLE IF NOT EXISTS evaluation_import_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                period_key TEXT NOT NULL,
                role TEXT NOT NULL,
                filename TEXT NOT NULL,
                row_count INTEGER NOT NULL DEFAULT 0,
                imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS evaluation_raw_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id INTEGER,
                period_key TEXT NOT NULL,
                role TEXT NOT NULL,
                submitted_at TEXT,
                employee_code TEXT,
                employee_name TEXT,
                evaluator_name TEXT,
                payload_json TEXT NOT NULL,
                resolution_status TEXT NOT NULL DEFAULT 'CHUA_XU_LY',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (batch_id) REFERENCES evaluation_import_batches(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS evaluation_rounds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                evaluation_date TEXT NOT NULL UNIQUE,
                label TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'ĐANG THỰC HIỆN',
                rating_thresholds_json TEXT,
                exported_at TEXT,
                closed_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS evaluation_round_employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                round_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL,
                employee_code TEXT NOT NULL,
                employee_name TEXT NOT NULL,
                role TEXT,
                status TEXT NOT NULL DEFAULT 'CHƯA ĐÁNH GIÁ',
                data_source TEXT,
                evaluator_name TEXT,
                comments TEXT,
                voucher_count INTEGER NOT NULL DEFAULT 0 CHECK(voucher_count >= 0),
                total_points INTEGER NOT NULL DEFAULT 0,
                rating TEXT,
                manually_edited INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(round_id, employee_id),
                FOREIGN KEY (round_id) REFERENCES evaluation_rounds(id) ON DELETE CASCADE,
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT
            );

            CREATE TABLE IF NOT EXISTS evaluation_round_criteria (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                round_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                criterion_code TEXT NOT NULL,
                label TEXT NOT NULL,
                max_score INTEGER NOT NULL CHECK(max_score >= 1),
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(round_id, role, criterion_code),
                FOREIGN KEY (round_id) REFERENCES evaluation_rounds(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS evaluation_round_scores (
                round_employee_id INTEGER NOT NULL,
                round_criterion_id INTEGER NOT NULL,
                score INTEGER NOT NULL CHECK(score >= 0),
                PRIMARY KEY (round_employee_id, round_criterion_id),
                FOREIGN KEY (round_employee_id) REFERENCES evaluation_round_employees(id) ON DELETE CASCADE,
                FOREIGN KEY (round_criterion_id) REFERENCES evaluation_round_criteria(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS evaluation_round_import_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                round_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                row_count INTEGER NOT NULL DEFAULT 0,
                imported_count INTEGER NOT NULL DEFAULT 0,
                duplicate_count INTEGER NOT NULL DEFAULT 0,
                error_count INTEGER NOT NULL DEFAULT 0,
                imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (round_id) REFERENCES evaluation_rounds(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS evaluation_round_raw_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id INTEGER,
                round_id INTEGER NOT NULL,
                employee_code TEXT,
                employee_name TEXT,
                evaluator_name TEXT,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (batch_id) REFERENCES evaluation_round_import_batches(id) ON DELETE SET NULL,
                FOREIGN KEY (round_id) REFERENCES evaluation_rounds(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS evaluation_voucher_allocations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                round_employee_id INTEGER NOT NULL,
                voucher_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
                program_code TEXT,
                program_name TEXT,
                start_at TEXT,
                end_at TEXT,
                source_filename TEXT,
                allocated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (round_employee_id) REFERENCES evaluation_round_employees(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_evaluation_voucher_employee
            ON evaluation_voucher_allocations(round_employee_id);

            CREATE TABLE IF NOT EXISTS fixed_schedule_members (
                employee_id INTEGER PRIMARY KEY,
                added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS fixed_schedule_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
                shift TEXT NOT NULL,
                branch_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (employee_id, weekday, shift),
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
                FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS weekly_schedule_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                week_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL,
                weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
                shift TEXT NOT NULL,
                base_status TEXT NOT NULL,
                state TEXT NOT NULL,
                branch_id INTEGER,
                role TEXT,
                source TEXT NOT NULL DEFAULT 'ORDER',
                is_manual INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (week_id, employee_id, weekday, shift),
                FOREIGN KEY (week_id) REFERENCES weeks(id) ON DELETE CASCADE,
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
                FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS employee_work_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                effective_from TEXT NOT NULL,
                effective_to TEXT,
                shifts_json TEXT NOT NULL DEFAULT '[]',
                preferred_role TEXT NOT NULL,
                plan_state TEXT NOT NULL DEFAULT 'Đang làm',
                certainty TEXT NOT NULL DEFAULT 'Đã xác nhận',
                note TEXT,
                record_status TEXT NOT NULL DEFAULT 'Đang áp dụng',
                replaced_by_id INTEGER,
                confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
                FOREIGN KEY (replaced_by_id) REFERENCES employee_work_plans(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_employee_work_plans_lookup
            ON employee_work_plans(employee_id, effective_from, effective_to, certainty, record_status);

            CREATE TABLE IF NOT EXISTS schedule_closures (
                week_id INTEGER PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'ĐANG XẾP',
                closed_at TEXT,
                staffing_snapshot_json TEXT,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (week_id) REFERENCES weeks(id) ON DELETE CASCADE
            );
            """
        )
        self.conn.commit()


    def _migrate_dynamic_structure(self) -> None:
        """Bổ sung cấu trúc cơ sở/ca động cho database của các bản thử cũ."""
        columns = {row["name"] for row in self.conn.execute("PRAGMA table_info(branches)")}
        order_columns = {row["name"] for row in self.conn.execute("PRAGMA table_info(order_entries)")}
        employee_columns = {row["name"] for row in self.conn.execute("PRAGMA table_info(employees)")}
        evaluation_round_columns = {row["name"] for row in self.conn.execute("PRAGMA table_info(evaluation_rounds)")}
        with self.transaction():
            if "rating_thresholds_json" not in evaluation_round_columns:
                self.conn.execute("ALTER TABLE evaluation_rounds ADD COLUMN rating_thresholds_json TEXT")
                self.conn.execute(
                    "UPDATE evaluation_rounds SET rating_thresholds_json=? WHERE rating_thresholds_json IS NULL",
                    (json.dumps({"Xuất sắc": 91, "Tốt": 80, "Khá": 65, "Trung bình": 50, "Yếu": 0}, ensure_ascii=False),),
                )
            if "is_manual" not in order_columns:
                self.conn.execute("ALTER TABLE order_entries ADD COLUMN is_manual INTEGER NOT NULL DEFAULT 0")
            if "preferred_role" not in employee_columns:
                self.conn.execute("ALTER TABLE employees ADD COLUMN preferred_role TEXT")
            if "system_code" not in columns:
                self.conn.execute("ALTER TABLE branches ADD COLUMN system_code TEXT")
            if "display_code" not in columns:
                self.conn.execute("ALTER TABLE branches ADD COLUMN display_code TEXT")
            if "status" not in columns:
                self.conn.execute("ALTER TABLE branches ADD COLUMN status TEXT NOT NULL DEFAULT 'Đang hoạt động'")

            # Bản 1.4.0 khóa điểm chi tiết ở 0..5. Từ 1.4.1 điểm tối đa
            # của từng tiêu chí được cấu hình động, nên bỏ giới hạn cứng này.
            score_sql_row = self.conn.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='evaluation_scores'"
            ).fetchone()
            score_sql = str(score_sql_row["sql"] or "") if score_sql_row else ""
            if "BETWEEN 0 AND 5" in score_sql.upper():
                self.conn.execute("ALTER TABLE evaluation_scores RENAME TO evaluation_scores_old_140")
                self.conn.execute(
                    """
                    CREATE TABLE evaluation_scores (
                        record_id INTEGER NOT NULL,
                        criterion_id INTEGER NOT NULL,
                        score INTEGER NOT NULL CHECK(score >= 0),
                        PRIMARY KEY (record_id, criterion_id),
                        FOREIGN KEY (record_id) REFERENCES evaluation_records(id) ON DELETE CASCADE,
                        FOREIGN KEY (criterion_id) REFERENCES evaluation_criteria(id) ON DELETE RESTRICT
                    )
                    """
                )
                self.conn.execute(
                    "INSERT INTO evaluation_scores(record_id, criterion_id, score) "
                    "SELECT record_id, criterion_id, score FROM evaluation_scores_old_140"
                )
                self.conn.execute("DROP TABLE evaluation_scores_old_140")
            self.conn.execute(
                "UPDATE branches SET system_code=CASE WHEN code='ĐK' THEN 'DK' ELSE code END "
                "WHERE system_code IS NULL OR TRIM(system_code)=''"
            )
            self.conn.execute(
                "UPDATE branches SET display_code=code WHERE display_code IS NULL OR TRIM(display_code)=''"
            )
            self.conn.execute(
                "UPDATE branches SET display_code='ĐK', name=CASE WHEN name IN ('ĐK','DK') THEN 'Đông Khê' ELSE name END "
                "WHERE code IN ('ĐK','DK')"
            )
            self.conn.execute(
                "UPDATE employees SET preferred_role=("
                "SELECT CASE "
                "WHEN EXISTS(SELECT 1 FROM employee_roles er WHERE er.employee_id=employees.id AND er.role='Pha chế') THEN 'Pha chế' "
                "WHEN EXISTS(SELECT 1 FROM employee_roles er WHERE er.employee_id=employees.id AND er.role='Chạy bàn') THEN 'Chạy bàn' "
                "ELSE NULL END"
                ") WHERE preferred_role IS NULL OR TRIM(preferred_role)=''"
            )

    @staticmethod
    def _normalize_code(value: str) -> str:
        return ''.join(ch for ch in str(value or '').strip().upper() if ch.isalnum() or ch == '_')

    def _resolve_branch_row(self, code: str) -> sqlite3.Row | None:
        token = str(code or '').strip()
        return self.conn.execute(
            "SELECT * FROM branches WHERE code=? OR system_code=? OR display_code=? COLLATE NOCASE LIMIT 1",
            (token, token, token),
        ).fetchone()

    def _migrate_legacy_branch_codes(self) -> None:
        """Gộp mã cơ sở cũ DK vào mã chuẩn ĐK mà không làm mất dữ liệu.

        Một số bản thử cũ lưu Đông Khê bằng mã ``DK``. Từ Bước 8 giao diện
        dùng ``ĐK`` nên nếu cả hai mã cùng tồn tại, định biên và lịch đã xếp có
        thể nằm ở hai branch_id khác nhau, làm tổng nhân viên tại tab Đông Khê
        bị sai. Migration này chạy an toàn mỗi lần mở ứng dụng.
        """
        old = self.conn.execute("SELECT id FROM branches WHERE code='DK'").fetchone()
        target = self.conn.execute("SELECT id FROM branches WHERE code='ĐK'").fetchone()
        if not old or not target or int(old["id"]) == int(target["id"]):
            return

        old_id = int(old["id"])
        target_id = int(target["id"])
        with self.transaction():
            # Quyền làm việc tại cơ sở: gộp và loại bản trùng.
            self.conn.execute(
                """
                INSERT OR IGNORE INTO employee_branches(employee_id, branch_id)
                SELECT employee_id, ? FROM employee_branches WHERE branch_id=?
                """,
                (target_id, old_id),
            )
            self.conn.execute("DELETE FROM employee_branches WHERE branch_id=?", (old_id,))

            # Định biên: ưu tiên giá trị đã chỉnh ở mã chuẩn ĐK; nếu đang bằng 0
            # thì nhận giá trị cũ từ DK.
            old_requirements = self.conn.execute(
                """
                SELECT weekday, shift, role, required_count
                FROM staffing_requirements WHERE branch_id=?
                """,
                (old_id,),
            ).fetchall()
            for row in old_requirements:
                self.conn.execute(
                    """
                    INSERT INTO staffing_requirements(
                        branch_id, weekday, shift, role, required_count, updated_at
                    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(branch_id, weekday, shift, role) DO UPDATE SET
                        required_count=CASE
                            WHEN staffing_requirements.required_count=0
                            THEN excluded.required_count
                            ELSE staffing_requirements.required_count
                        END,
                        updated_at=CURRENT_TIMESTAMP
                    """,
                    (
                        target_id, int(row["weekday"]), row["shift"], row["role"],
                        int(row["required_count"]),
                    ),
                )
            self.conn.execute("DELETE FROM staffing_requirements WHERE branch_id=?", (old_id,))

            # Lịch sử định biên và toàn bộ lịch đã xếp/lịch cố định.
            self.conn.execute(
                "UPDATE staffing_history SET branch_id=? WHERE branch_id=?",
                (target_id, old_id),
            )
            self.conn.execute(
                "UPDATE fixed_schedule_entries SET branch_id=? WHERE branch_id=?",
                (target_id, old_id),
            )
            self.conn.execute(
                "UPDATE weekly_schedule_entries SET branch_id=? WHERE branch_id=?",
                (target_id, old_id),
            )
            self.conn.execute("DELETE FROM branches WHERE id=?", (old_id,))

    def _seed_base_data(self) -> None:
        default_times = {
            "Sáng": ("06:30", "12:00"),
            "Chiều": ("12:00", "18:00"),
            "Tối": ("18:00", "23:00"),
        }
        with self.transaction():
            for index, (system_code, display_code, name) in enumerate(BRANCHES):
                branch = self.conn.execute(
                    "SELECT * FROM branches WHERE system_code=? OR code=? OR code=? OR display_code=? LIMIT 1",
                    (system_code, system_code, display_code, display_code),
                ).fetchone()
                if branch:
                    self.conn.execute(
                        "UPDATE branches SET system_code=?, display_code=?, name=CASE WHEN TRIM(name)='' THEN ? ELSE name END, "
                        "sort_order=CASE WHEN sort_order=0 THEN ? ELSE sort_order END WHERE id=?",
                        (system_code, display_code, name, index, int(branch["id"])),
                    )
                else:
                    self.conn.execute(
                        "INSERT INTO branches(code, system_code, display_code, name, status, sort_order) "
                        "VALUES (?, ?, ?, ?, 'Đang hoạt động', ?)",
                        (system_code, system_code, display_code, name, index),
                    )

            for index, (code, name, color) in enumerate(DEFAULT_SHIFTS):
                self.conn.execute(
                    """
                    INSERT INTO shifts(code, name, color, status, sort_order)
                    VALUES (?, ?, ?, 'Đang sử dụng', ?)
                    ON CONFLICT(code) DO UPDATE SET
                        name=excluded.name,
                        color=CASE WHEN shifts.color IS NULL OR shifts.color='' THEN excluded.color ELSE shifts.color END
                    """,
                    (code, name, color, index),
                )

            branch_rows = self.conn.execute("SELECT id FROM branches").fetchall()
            shift_rows = self.conn.execute("SELECT id, name, sort_order FROM shifts").fetchall()
            for branch in branch_rows:
                for shift in shift_rows:
                    start_time, end_time = default_times.get(str(shift["name"]), (None, None))
                    self.conn.execute(
                        """
                        INSERT OR IGNORE INTO branch_shifts
                        (branch_id, shift_id, enabled, start_time, end_time, sort_order)
                        VALUES (?, ?, 1, ?, ?, ?)
                        """,
                        (int(branch["id"]), int(shift["id"]), start_time, end_time, int(shift["sort_order"])),
                    )
                    if start_time and end_time:
                        self.conn.execute(
                            "UPDATE branch_shifts SET enabled=CASE WHEN enabled IS NULL THEN 1 ELSE enabled END, "
                            "start_time=COALESCE(start_time, ?), end_time=COALESCE(end_time, ?) "
                            "WHERE branch_id=? AND shift_id=?",
                            (start_time, end_time, int(branch["id"]), int(shift["id"])),
                        )

            for branch in branch_rows:
                for weekday in range(7):
                    for shift in self.list_shift_names(active_only=False):
                        for role in ROLES:
                            self.conn.execute(
                                """
                                INSERT OR IGNORE INTO staffing_requirements
                                (branch_id, weekday, shift, role, required_count)
                                VALUES (?, ?, ?, ?, 0)
                                """,
                                (int(branch["id"]), weekday, shift, role),
                            )


    def _seed_evaluation_criteria(self) -> None:
        """Nạp bộ tiêu chí mặc định đúng một lần, không ghi đè chỉnh sửa của người dùng."""
        with self.transaction():
            # Chuẩn hóa mã cũ PC01/CB01 -> PC001/CB001 trước khi nạp bộ mặc định mới.
            for role, prefix in (("Pha chế", "PC"), ("Chạy bàn", "CB")):
                old_rows = self.conn.execute("SELECT id, code FROM evaluation_criteria WHERE role=?", (role,)).fetchall()
                existing_codes = {str(row["code"]).upper() for row in old_rows}
                for row in old_rows:
                    match = re.match(rf"^{prefix}(\d{{2}})$", str(row["code"] or "").upper())
                    if not match:
                        continue
                    new_code = f"{prefix}{int(match.group(1)):03d}"
                    if new_code not in existing_codes:
                        self.conn.execute("UPDATE evaluation_criteria SET code=? WHERE id=?", (new_code, int(row["id"])))
                        existing_codes.add(new_code)
            for role, criteria in EVALUATION_CRITERIA.items():
                for index, (code, label) in enumerate(criteria, start=1):
                    self.conn.execute(
                        """
                        INSERT OR IGNORE INTO evaluation_criteria
                        (role, code, label, max_score, sort_order, status)
                        VALUES (?, ?, ?, 5, ?, 'Đang sử dụng')
                        """,
                        (role, code, label, index),
                    )

    def list_evaluation_criteria(
        self, role: str = "", active_only: bool = True
    ) -> list[sqlite3.Row]:
        conditions: list[str] = []
        params: list[Any] = []
        if role:
            conditions.append("role=?")
            params.append(role)
        if active_only:
            conditions.append("status='Đang sử dụng'")
        where = " WHERE " + " AND ".join(conditions) if conditions else ""
        return list(self.conn.execute(
            f"SELECT * FROM evaluation_criteria{where} ORDER BY role, sort_order, id",
            params,
        ))

    def get_evaluation_criterion(self, criterion_id: int) -> sqlite3.Row | None:
        return self.conn.execute(
            "SELECT * FROM evaluation_criteria WHERE id=?", (int(criterion_id),)
        ).fetchone()

    def _next_evaluation_criterion_code(self, role: str) -> str:
        prefix = "PC" if role == "Pha chế" else "CB"
        rows = self.conn.execute(
            "SELECT code FROM evaluation_criteria WHERE role=?", (role,)
        ).fetchall()
        max_number = 0
        for row in rows:
            match = re.match(rf"^{prefix}(\d+)$", str(row["code"] or "").upper())
            if match:
                max_number = max(max_number, int(match.group(1)))
        return f"{prefix}{max_number + 1:03d}"

    def add_evaluation_criterion(self, role: str, label: str, max_score: int) -> int:
        role = str(role or "").strip()
        label = str(label or "").strip()
        max_score = int(max_score)
        if role not in ROLES:
            raise DatabaseError("Vị trí đánh giá không hợp lệ.")
        if not label:
            raise DatabaseError("Tên tiêu chí không được để trống.")
        if max_score < 1 or max_score > 100:
            raise DatabaseError("Điểm tối đa phải từ 1 đến 100.")
        duplicate = self.conn.execute(
            "SELECT id FROM evaluation_criteria WHERE role=? AND LOWER(TRIM(label))=LOWER(TRIM(?))",
            (role, label),
        ).fetchone()
        if duplicate:
            raise DatabaseError("Tiêu chí này đã tồn tại trong vị trí đã chọn.")
        row = self.conn.execute(
            "SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM evaluation_criteria WHERE role=?",
            (role,),
        ).fetchone()
        sort_order = int(row["n"] if row else 1)
        code = self._next_evaluation_criterion_code(role)
        with self.transaction():
            cursor = self.conn.execute(
                """
                INSERT INTO evaluation_criteria(role, code, label, max_score, sort_order, status)
                VALUES (?, ?, ?, ?, ?, 'Đang sử dụng')
                """,
                (role, code, label, max_score, sort_order),
            )
        return int(cursor.lastrowid)

    def update_evaluation_criterion(self, criterion_id: int, label: str, max_score: int) -> None:
        criterion = self.get_evaluation_criterion(criterion_id)
        if not criterion:
            raise DatabaseError("Không tìm thấy tiêu chí cần sửa.")
        label = str(label or "").strip()
        max_score = int(max_score)
        if not label:
            raise DatabaseError("Tên tiêu chí không được để trống.")
        if max_score < 1 or max_score > 100:
            raise DatabaseError("Điểm tối đa phải từ 1 đến 100.")
        duplicate = self.conn.execute(
            """
            SELECT id FROM evaluation_criteria
            WHERE role=? AND id<>? AND LOWER(TRIM(label))=LOWER(TRIM(?))
            """,
            (criterion["role"], int(criterion_id), label),
        ).fetchone()
        if duplicate:
            raise DatabaseError("Tiêu chí này đã tồn tại trong vị trí đã chọn.")
        with self.transaction():
            self.conn.execute(
                """
                UPDATE evaluation_criteria
                SET label=?, max_score=?, updated_at=CURRENT_TIMESTAMP
                WHERE id=?
                """,
                (label, max_score, int(criterion_id)),
            )

    def set_evaluation_criterion_status(self, criterion_id: int, active: bool) -> None:
        status = "Đang sử dụng" if active else "Ngừng sử dụng"
        with self.transaction():
            self.conn.execute(
                "UPDATE evaluation_criteria SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (status, int(criterion_id)),
            )

    def move_evaluation_criterion(self, criterion_id: int, direction: int) -> None:
        current = self.get_evaluation_criterion(criterion_id)
        if not current or direction not in (-1, 1):
            return
        comparator = "<" if direction < 0 else ">"
        order = "DESC" if direction < 0 else "ASC"
        other = self.conn.execute(
            f"""
            SELECT * FROM evaluation_criteria
            WHERE role=? AND sort_order {comparator} ?
            ORDER BY sort_order {order}, id {order}
            LIMIT 1
            """,
            (current["role"], int(current["sort_order"])),
        ).fetchone()
        if not other:
            return
        with self.transaction():
            self.conn.execute(
                "UPDATE evaluation_criteria SET sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (int(other["sort_order"]), int(current["id"])),
            )
            self.conn.execute(
                "UPDATE evaluation_criteria SET sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (int(current["sort_order"]), int(other["id"])),
            )

    def evaluation_max_points(self, role: str, active_only: bool = True) -> int:
        criteria = self.list_evaluation_criteria(role, active_only=active_only)
        return sum(int(row["max_score"]) for row in criteria)

    def evaluation_rating(self, total_points: int, max_points: int | None = None) -> str:
        """Xếp loại theo % khi biết điểm tối đa; giữ tương thích dữ liệu cũ nếu không truyền max_points."""
        total = int(total_points)
        value = total
        if max_points is not None and int(max_points) > 0:
            value = round(total * 100 / int(max_points), 6)
        for minimum, label in EVALUATION_RATING_THRESHOLDS:
            if value >= minimum:
                return label
        return "Yếu"

    def evaluation_count(self) -> int:
        row = self.conn.execute("SELECT COUNT(*) AS n FROM evaluation_records").fetchone()
        return int(row["n"] if row else 0)

    def evaluation_employee_counts(self) -> dict[str, int]:
        result = {"Pha chế": 0, "Chạy bàn": 0}
        rows = self.conn.execute(
            """
            SELECT er.role, COUNT(DISTINCT er.employee_id) AS n
            FROM employee_roles er
            JOIN employees e ON e.id=er.employee_id
            WHERE e.status='Đang làm' AND er.role IN ('Pha chế','Chạy bàn')
            GROUP BY er.role
            """
        ).fetchall()
        for row in rows:
            result[str(row["role"])] = int(row["n"])
        return result

    # ===== ĐÁNH GIÁ NHÂN VIÊN THEO LẦN / NGÀY =====

    def get_evaluation_rating_thresholds(self) -> dict[str, int]:
        default = {"Xuất sắc": 91, "Tốt": 80, "Khá": 65, "Trung bình": 50, "Yếu": 0}
        raw = self.get_setting("evaluation_rating_thresholds")
        if not raw:
            return default
        try:
            data = json.loads(raw)
            result = {key: int(data.get(key, value)) for key, value in default.items()}
            self.validate_evaluation_rating_thresholds(result)
            return result
        except Exception:
            return default

    @staticmethod
    def validate_evaluation_rating_thresholds(thresholds: dict[str, int]) -> None:
        names = ["Xuất sắc", "Tốt", "Khá", "Trung bình", "Yếu"]
        values = [int(thresholds[name]) for name in names]
        if values[-1] != 0:
            raise DatabaseError("Ngưỡng Yếu phải bắt đầu từ 0 điểm.")
        if not all(values[i] > values[i + 1] for i in range(len(values) - 1)):
            raise DatabaseError("Ngưỡng xếp loại phải giảm dần: Xuất sắc > Tốt > Khá > Trung bình > Yếu.")
        if values[0] < 1:
            raise DatabaseError("Ngưỡng Xuất sắc không hợp lệ.")

    def save_evaluation_rating_thresholds(self, thresholds: dict[str, int]) -> None:
        cleaned = {key: int(value) for key, value in thresholds.items()}
        self.validate_evaluation_rating_thresholds(cleaned)
        self.set_setting("evaluation_rating_thresholds", json.dumps(cleaned, ensure_ascii=False))

    def evaluation_rating(self, total_points: int, max_points: int | None = None) -> str:
        """Xếp loại theo tổng điểm tuyệt đối. max_points chỉ giữ để tương thích lời gọi cũ."""
        total = int(total_points)
        thresholds = self.get_evaluation_rating_thresholds()
        for label in ["Xuất sắc", "Tốt", "Khá", "Trung bình", "Yếu"]:
            if total >= int(thresholds[label]):
                return label
        return "Yếu"

    def evaluation_rating_for_round(self, round_id: int, total_points: int) -> str:
        row = self.get_evaluation_round(round_id)
        thresholds = self.get_evaluation_rating_thresholds()
        if row is not None and row["rating_thresholds_json"]:
            try:
                data = json.loads(str(row["rating_thresholds_json"]))
                thresholds = {key: int(data[key]) for key in ["Xuất sắc", "Tốt", "Khá", "Trung bình", "Yếu"]}
                self.validate_evaluation_rating_thresholds(thresholds)
            except Exception:
                thresholds = self.get_evaluation_rating_thresholds()
        total = int(total_points)
        for label in ["Xuất sắc", "Tốt", "Khá", "Trung bình", "Yếu"]:
            if total >= int(thresholds[label]):
                return label
        return "Yếu"

    def list_evaluation_rounds(self) -> list[sqlite3.Row]:
        return list(self.conn.execute(
            """
            SELECT r.*,
                   COUNT(re.id) AS employee_count,
                   SUM(CASE WHEN re.status='ĐÃ ĐÁNH GIÁ' THEN 1 ELSE 0 END) AS evaluated_count,
                   SUM(CASE WHEN re.status='CHƯA ĐÁNH GIÁ' THEN 1 ELSE 0 END) AS pending_count,
                   SUM(CASE WHEN re.status='TRÙNG PHẢN HỒI' THEN 1 ELSE 0 END) AS duplicate_count,
                   COALESCE(SUM(CASE WHEN re.status='ĐÃ ĐÁNH GIÁ' THEN re.voucher_count ELSE 0 END), 0) AS voucher_total
            FROM evaluation_rounds r
            LEFT JOIN evaluation_round_employees re ON re.round_id=r.id
            GROUP BY r.id
            ORDER BY r.evaluation_date DESC, r.id DESC
            """
        ))

    def get_evaluation_round(self, round_id: int) -> sqlite3.Row | None:
        return self.conn.execute("SELECT * FROM evaluation_rounds WHERE id=?", (int(round_id),)).fetchone()

    def _assert_evaluation_round_editable(self, round_id: int) -> sqlite3.Row:
        round_row = self.get_evaluation_round(round_id)
        if not round_row:
            raise DatabaseError("Không tìm thấy lần đánh giá hiện tại.")
        if str(round_row["status"]) == "ĐÃ CHỐT":
            raise DatabaseError(
                "Lần đánh giá đã CHỐT và đang ở chế độ chỉ xem. "
                "Hãy bấm MỞ LẠI trước khi chỉnh sửa dữ liệu đánh giá."
            )
        return round_row

    def find_evaluation_round_by_date(self, evaluation_date: str) -> sqlite3.Row | None:
        return self.conn.execute(
            "SELECT * FROM evaluation_rounds WHERE evaluation_date=?", (str(evaluation_date),)
        ).fetchone()

    def create_evaluation_round(self, evaluation_date: str) -> int:
        evaluation_date = str(evaluation_date or "").strip()
        try:
            parsed = datetime.strptime(evaluation_date, "%Y-%m-%d")
        except ValueError as exc:
            raise DatabaseError("Ngày đánh giá không hợp lệ.") from exc
        if self.find_evaluation_round_by_date(evaluation_date):
            raise DatabaseError("Ngày này đã có một lần đánh giá. Mỗi ngày chỉ được tạo 1 lần đánh giá.")
        employees = self.list_employees(status="Đang làm")
        if not employees:
            raise DatabaseError("Không có nhân viên đang làm để tạo lần đánh giá.")
        label = parsed.strftime("%d/%m/%Y")
        with self.transaction():
            cursor = self.conn.execute(
                "INSERT INTO evaluation_rounds(evaluation_date,label,status,rating_thresholds_json) VALUES (?,?, 'ĐANG THỰC HIỆN',?)",
                (evaluation_date, label, json.dumps(self.get_evaluation_rating_thresholds(), ensure_ascii=False)),
            )
            round_id = int(cursor.lastrowid)
            for employee in employees:
                self.conn.execute(
                    """
                    INSERT INTO evaluation_round_employees
                    (round_id, employee_id, employee_code, employee_name, role, status, voucher_count)
                    VALUES (?, ?, ?, ?, NULL, 'CHƯA ĐÁNH GIÁ', 0)
                    """,
                    (round_id, int(employee["id"]), str(employee["code"]), str(employee["name"])),
                )
        return round_id

    def delete_evaluation_round(self, round_id: int) -> None:
        with self.transaction():
            self.conn.execute("DELETE FROM evaluation_rounds WHERE id=?", (int(round_id),))

    def set_evaluation_round_status(self, round_id: int, status: str) -> None:
        if status not in ("ĐANG THỰC HIỆN", "ĐÃ CHỐT"):
            raise DatabaseError("Trạng thái lần đánh giá không hợp lệ.")
        with self.transaction():
            self.conn.execute(
                """
                UPDATE evaluation_rounds
                SET status=?, closed_at=CASE WHEN ?='ĐÃ CHỐT' THEN CURRENT_TIMESTAMP ELSE NULL END,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=?
                """,
                (status, status, int(round_id)),
            )

    def list_evaluation_round_employees(
        self,
        round_id: int,
        search: str = "",
        role: str = "",
        status: str = "",
        rating: str = "",
        source: str = "",
    ) -> list[dict[str, Any]]:
        params: list[Any] = [int(round_id)]
        where = ["re.round_id=?"]
        if search.strip():
            where.append("(re.employee_code LIKE ? OR re.employee_name LIKE ?)")
            token = f"%{search.strip()}%"
            params.extend([token, token])
        if role:
            where.append("re.role=?")
            params.append(role)
        if status:
            where.append("re.status=?")
            params.append(status)
        if rating:
            where.append("re.rating=?")
            params.append(rating)
        if source:
            where.append("re.data_source=?")
            params.append(source)
        rows = [dict(row) for row in self.conn.execute(
            f"""
            SELECT re.*
            FROM evaluation_round_employees re
            WHERE {' AND '.join(where)}
            ORDER BY re.employee_name COLLATE NOCASE, re.employee_code COLLATE NOCASE
            """,
            params,
        )]
        # Hạng chính thức chỉ tính trong cùng bộ tiêu chí, bằng điểm thì đồng hạng.
        all_evaluated = [dict(row) for row in self.conn.execute(
            """
            SELECT id, role, total_points FROM evaluation_round_employees
            WHERE round_id=? AND status='ĐÃ ĐÁNH GIÁ' AND role IN ('Pha chế','Chạy bàn')
            ORDER BY role, total_points DESC
            """,
            (int(round_id),),
        )]
        rank_map: dict[int, int] = {}
        for role_name in ROLES:
            role_rows = [row for row in all_evaluated if row["role"] == role_name]
            last_score = None
            current_rank = 0
            for row in role_rows:
                score = int(row["total_points"] or 0)
                if last_score is None or score != last_score:
                    current_rank += 1
                    last_score = score
                rank_map[int(row["id"])] = current_rank
        for row in rows:
            row["rank_position"] = rank_map.get(int(row["id"]))
        return rows

    def get_evaluation_round_employee(self, round_employee_id: int) -> sqlite3.Row | None:
        return self.conn.execute(
            "SELECT * FROM evaluation_round_employees WHERE id=?", (int(round_employee_id),)
        ).fetchone()

    def set_evaluation_round_employee_role(self, round_employee_id: int, role: str | None) -> None:
        if role not in (*ROLES, None, ""):
            raise DatabaseError("Bộ tiêu chí không hợp lệ.")
        employee_row = self.get_evaluation_round_employee(round_employee_id)
        if not employee_row:
            raise DatabaseError("Không tìm thấy nhân viên trong lần đánh giá.")
        self._assert_evaluation_round_editable(int(employee_row["round_id"]))
        role_value = role or None
        with self.transaction():
            self.conn.execute(
                "UPDATE evaluation_round_employees SET role=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (role_value, int(round_employee_id)),
            )

    def copy_evaluation_roles_from_previous(self, round_id: int) -> int:
        current = self._assert_evaluation_round_editable(round_id)
        previous = self.conn.execute(
            """
            SELECT * FROM evaluation_rounds
            WHERE evaluation_date < ?
            ORDER BY evaluation_date DESC LIMIT 1
            """,
            (str(current["evaluation_date"]),),
        ).fetchone()
        if not previous:
            raise DatabaseError("Chưa có lần đánh giá trước để sao chép.")
        rows = self.conn.execute(
            "SELECT employee_id, role FROM evaluation_round_employees WHERE round_id=? AND role IS NOT NULL",
            (int(previous["id"]),),
        ).fetchall()
        mapping = {int(row["employee_id"]): str(row["role"]) for row in rows}
        count = 0
        with self.transaction():
            current_rows = self.conn.execute(
                "SELECT id, employee_id FROM evaluation_round_employees WHERE round_id=?",
                (int(round_id),),
            ).fetchall()
            for row in current_rows:
                role_value = mapping.get(int(row["employee_id"]))
                if role_value in ROLES:
                    self.conn.execute(
                        "UPDATE evaluation_round_employees SET role=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                        (role_value, int(row["id"])),
                    )
                    count += 1
        return count

    def evaluation_round_unassigned_count(self, round_id: int) -> int:
        row = self.conn.execute(
            "SELECT COUNT(*) AS n FROM evaluation_round_employees WHERE round_id=? AND (role IS NULL OR TRIM(role)='')",
            (int(round_id),),
        ).fetchone()
        return int(row["n"] if row else 0)

    def prepare_evaluation_round_criteria(self, round_id: int, refresh: bool = True) -> list[sqlite3.Row]:
        # Cho phép xuất lại trước khi có kết quả. Khi đã có kết quả thì giữ snapshot để không làm sai lịch sử.
        evaluated = self.conn.execute(
            "SELECT 1 FROM evaluation_round_employees WHERE round_id=? AND status='ĐÃ ĐÁNH GIÁ' LIMIT 1",
            (int(round_id),),
        ).fetchone()
        existing = self.conn.execute(
            "SELECT COUNT(*) AS n FROM evaluation_round_criteria WHERE round_id=?", (int(round_id),)
        ).fetchone()
        has_existing = int(existing["n"] if existing else 0) > 0
        if refresh and not evaluated:
            with self.transaction():
                self.conn.execute("DELETE FROM evaluation_round_scores WHERE round_criterion_id IN (SELECT id FROM evaluation_round_criteria WHERE round_id=?)", (int(round_id),))
                self.conn.execute("DELETE FROM evaluation_round_criteria WHERE round_id=?", (int(round_id),))
                for criterion in self.list_evaluation_criteria(active_only=True):
                    self.conn.execute(
                        """
                        INSERT INTO evaluation_round_criteria
                        (round_id, role, criterion_code, label, max_score, sort_order)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            int(round_id), str(criterion["role"]), str(criterion["code"]),
                            str(criterion["label"]), int(criterion["max_score"]), int(criterion["sort_order"]),
                        ),
                    )
                self.conn.execute(
                    "UPDATE evaluation_rounds SET exported_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                    (int(round_id),),
                )
        elif not has_existing:
            # Trường hợp dữ liệu cũ bất thường: chưa có snapshot nhưng đã có trạng thái đánh giá.
            # Tạo snapshot từ bộ tiêu chí hiện hành để có thể mở/sửa phiếu thay vì lặp vô hạn.
            with self.transaction():
                for criterion in self.list_evaluation_criteria(active_only=True):
                    self.conn.execute(
                        """
                        INSERT OR IGNORE INTO evaluation_round_criteria
                        (round_id, role, criterion_code, label, max_score, sort_order)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (int(round_id), str(criterion["role"]), str(criterion["code"]),
                         str(criterion["label"]), int(criterion["max_score"]), int(criterion["sort_order"])),
                    )
        return self.list_evaluation_round_criteria(round_id)

    def list_evaluation_round_criteria(self, round_id: int, role: str = "") -> list[sqlite3.Row]:
        if role:
            return list(self.conn.execute(
                """
                SELECT * FROM evaluation_round_criteria
                WHERE round_id=? AND role=? ORDER BY sort_order, id
                """, (int(round_id), role)
            ))
        return list(self.conn.execute(
            "SELECT * FROM evaluation_round_criteria WHERE round_id=? ORDER BY role, sort_order, id",
            (int(round_id),),
        ))

    def evaluation_round_summary(self, round_id: int) -> dict[str, int | str]:
        round_row = self.get_evaluation_round(round_id)
        if not round_row:
            return {}
        row = self.conn.execute(
            """
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN status='ĐÃ ĐÁNH GIÁ' THEN 1 ELSE 0 END) AS evaluated,
                   SUM(CASE WHEN status='CHƯA ĐÁNH GIÁ' THEN 1 ELSE 0 END) AS pending,
                   SUM(CASE WHEN status='TRÙNG PHẢN HỒI' THEN 1 ELSE 0 END) AS duplicate_count,
                   COALESCE(SUM(CASE WHEN status='ĐÃ ĐÁNH GIÁ' THEN voucher_count ELSE 0 END),0) AS vouchers
            FROM evaluation_round_employees WHERE round_id=?
            """, (int(round_id),)
        ).fetchone()
        return {
            "total": int(row["total"] or 0),
            "evaluated": int(row["evaluated"] or 0),
            "pending": int(row["pending"] or 0),
            "duplicate": int(row["duplicate_count"] or 0),
            "vouchers": int(row["vouchers"] or 0),
            "status": str(round_row["status"]),
            "label": str(round_row["label"]),
        }

    def get_evaluation_round_scores(self, round_employee_id: int) -> dict[int, int]:
        rows = self.conn.execute(
            "SELECT round_criterion_id, score FROM evaluation_round_scores WHERE round_employee_id=?",
            (int(round_employee_id),),
        ).fetchall()
        return {int(row["round_criterion_id"]): int(row["score"]) for row in rows}

    def save_evaluation_round_employee(
        self,
        round_employee_id: int,
        evaluator_name: str,
        comments: str,
        voucher_count: int,
        scores: dict[int, int],
        manual: bool = True,
    ) -> None:
        row = self.get_evaluation_round_employee(round_employee_id)
        if not row:
            raise DatabaseError("Không tìm thấy nhân viên trong lần đánh giá.")
        self._assert_evaluation_round_editable(int(row["round_id"]))
        role = str(row["role"] or "")
        if role not in ROLES:
            raise DatabaseError("Nhân viên chưa được chọn bộ tiêu chí Pha chế/Chạy bàn.")
        evaluator_name = str(evaluator_name or "").strip()
        comments = str(comments or "").strip()
        voucher_count = int(voucher_count)
        if not evaluator_name:
            raise DatabaseError("Người đánh giá là thông tin bắt buộc.")
        if not comments:
            raise DatabaseError("Nhận xét chung là thông tin bắt buộc.")
        if voucher_count < 0:
            raise DatabaseError("Số lượng Voucher không được âm.")
        criteria = self.list_evaluation_round_criteria(int(row["round_id"]), role)
        if not criteria:
            criteria = self.prepare_evaluation_round_criteria(int(row["round_id"]), refresh=False)
            criteria = [item for item in criteria if str(item["role"]) == role]
        expected = {int(item["id"]): item for item in criteria}
        if set(scores.keys()) != set(expected.keys()):
            raise DatabaseError("Chưa nhập đủ điểm cho toàn bộ tiêu chí.")
        total = 0
        for criterion_id, score in scores.items():
            criterion = expected[int(criterion_id)]
            score = int(score)
            if score < 0 or score > int(criterion["max_score"]):
                raise DatabaseError(
                    f"Điểm '{criterion['label']}' phải từ 0 đến {criterion['max_score']}."
                )
            total += score
        rating = self.evaluation_rating_for_round(int(row["round_id"]), total)
        source = "ĐÃ CHỈNH TAY" if manual else "TỪ FORM"
        old_voucher_count = int(row["voucher_count"] or 0)
        with self.transaction():
            if old_voucher_count != voucher_count:
                self.conn.execute(
                    "DELETE FROM evaluation_voucher_allocations WHERE round_employee_id=?",
                    (int(round_employee_id),),
                )
            self.conn.execute("DELETE FROM evaluation_round_scores WHERE round_employee_id=?", (int(round_employee_id),))
            for criterion_id, score in scores.items():
                self.conn.execute(
                    "INSERT INTO evaluation_round_scores(round_employee_id, round_criterion_id, score) VALUES (?,?,?)",
                    (int(round_employee_id), int(criterion_id), int(score)),
                )
            self.conn.execute(
                """
                UPDATE evaluation_round_employees
                SET evaluator_name=?, comments=?, voucher_count=?, total_points=?, rating=?,
                    status='ĐÃ ĐÁNH GIÁ', data_source=?, manually_edited=?, updated_at=CURRENT_TIMESTAMP
                WHERE id=?
                """,
                (
                    evaluator_name, comments, voucher_count, total, rating, source,
                    1 if manual else 0, int(round_employee_id),
                ),
            )

    def _clear_form_evaluation_for_duplicate(self, round_employee_id: int) -> None:
        row = self.get_evaluation_round_employee(round_employee_id)
        if not row or int(row["manually_edited"] or 0):
            return
        with self.transaction():
            self.conn.execute("DELETE FROM evaluation_round_scores WHERE round_employee_id=?", (int(round_employee_id),))
            self.conn.execute("DELETE FROM evaluation_voucher_allocations WHERE round_employee_id=?", (int(round_employee_id),))
            self.conn.execute(
                """
                UPDATE evaluation_round_employees
                SET status='TRÙNG PHẢN HỒI', data_source=NULL, evaluator_name=NULL, comments=NULL,
                    total_points=0, rating=NULL, updated_at=CURRENT_TIMESTAMP
                WHERE id=?
                """, (int(round_employee_id),)
            )

    def import_evaluation_form_submissions(
        self, round_id: int, filename: str, submissions: list[dict[str, Any]]
    ) -> dict[str, Any]:
        round_row = self._assert_evaluation_round_editable(round_id)
        self.prepare_evaluation_round_criteria(round_id, refresh=False)
        round_employees = self.list_evaluation_round_employees(round_id)
        by_code = {str(row["employee_code"]).strip().upper(): row for row in round_employees}
        by_name = {str(row["employee_name"]).strip().casefold(): row for row in round_employees}

        resolved: list[tuple[dict[str, Any], dict[str, Any] | None]] = []
        unknown_rows: list[dict[str, Any]] = []
        for submission in submissions:
            code = str(submission.get("employee_code") or "").strip().upper()
            name = str(submission.get("employee_name") or "").strip().casefold()
            target = by_code.get(code) if code else None
            if target is None and name:
                target = by_name.get(name)
            if target is None:
                unknown_rows.append(submission)
            resolved.append((submission, target))

        grouped: dict[int, list[dict[str, Any]]] = {}
        for submission, target in resolved:
            if target is None:
                continue
            grouped.setdefault(int(target["id"]), []).append(submission)

        imported = 0
        duplicates = 0
        errors: list[str] = []
        with self.transaction():
            cursor = self.conn.execute(
                """
                INSERT INTO evaluation_round_import_batches
                (round_id, filename, row_count, imported_count, duplicate_count, error_count)
                VALUES (?, ?, ?, 0, 0, 0)
                """,
                (int(round_id), str(filename), len(submissions)),
            )
            batch_id = int(cursor.lastrowid)
            for submission, _target in resolved:
                self.conn.execute(
                    """
                    INSERT INTO evaluation_round_raw_submissions
                    (batch_id, round_id, employee_code, employee_name, evaluator_name, payload_json)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        batch_id, int(round_id), str(submission.get("employee_code") or ""),
                        str(submission.get("employee_name") or ""), str(submission.get("evaluator_name") or ""),
                        json.dumps(submission, ensure_ascii=False),
                    ),
                )

        for round_employee_id, items in grouped.items():
            current = self.get_evaluation_round_employee(round_employee_id)
            if current is None:
                continue
            if int(current["manually_edited"] or 0):
                continue
            if len(items) >= 2:
                duplicates += 1
                self._clear_form_evaluation_for_duplicate(round_employee_id)
                continue
            submission = items[0]
            role = str(current["role"] or "")
            if role not in ROLES:
                errors.append(f"{current['employee_code']} – {current['employee_name']}: chưa chọn bộ tiêu chí.")
                continue
            criteria = self.list_evaluation_round_criteria(round_id, role)
            score_values = submission.get("scores") or {}
            scores: dict[int, int] = {}
            row_errors: list[str] = []
            for criterion in criteria:
                code = str(criterion["criterion_code"]).upper()
                raw_score = score_values.get(code)
                if raw_score in (None, ""):
                    row_errors.append(f"thiếu {code}")
                    continue
                try:
                    score = int(raw_score)
                except Exception:
                    row_errors.append(f"{code} không phải số nguyên")
                    continue
                if score < 0 or score > int(criterion["max_score"]):
                    row_errors.append(f"{code} ngoài 0-{criterion['max_score']}")
                    continue
                scores[int(criterion["id"])] = score
            evaluator = str(submission.get("evaluator_name") or "").strip()
            comments = str(submission.get("comments") or "").strip()
            if not evaluator:
                row_errors.append("thiếu người đánh giá")
            if not comments:
                row_errors.append("thiếu nhận xét chung")
            if row_errors:
                errors.append(
                    f"{current['employee_code']} – {current['employee_name']}: " + ", ".join(row_errors)
                )
                continue
            # Voucher chỉ nhập trên SQLite, giữ nguyên số hiện tại.
            self.save_evaluation_round_employee(
                round_employee_id, evaluator, comments, int(current["voucher_count"] or 0), scores, manual=False
            )
            imported += 1

        errors.extend([
            f"Không nhận diện được nhân viên: {item.get('employee_raw') or item.get('employee_name') or '(trống)'}"
            for item in unknown_rows
        ])
        summary = self.evaluation_round_summary(round_id)
        with self.transaction():
            self.conn.execute(
                """
                UPDATE evaluation_round_import_batches
                SET imported_count=?, duplicate_count=?, error_count=? WHERE id=?
                """,
                (imported, duplicates, len(errors), batch_id),
            )
        return {
            "imported": imported,
            "pending": int(summary.get("pending", 0)),
            "duplicate": int(summary.get("duplicate", 0)),
            "errors": errors,
            "error_count": len(errors),
            "batch_id": batch_id,
        }

    # ===== PHÂN BỔ VOUCHER CHO PHIẾU ĐÁNH GIÁ =====

    def evaluation_round_voucher_stats(self, round_id: int) -> dict[str, int]:
        required_row = self.conn.execute(
            """
            SELECT COALESCE(SUM(voucher_count),0) AS required, COUNT(*) AS employees
            FROM evaluation_round_employees
            WHERE round_id=? AND status='ĐÃ ĐÁNH GIÁ'
            """,
            (int(round_id),),
        ).fetchone()
        allocated_row = self.conn.execute(
            """
            SELECT COUNT(*) AS allocated, COUNT(DISTINCT v.round_employee_id) AS employees_allocated
            FROM evaluation_voucher_allocations v
            JOIN evaluation_round_employees re ON re.id=v.round_employee_id
            WHERE re.round_id=?
            """,
            (int(round_id),),
        ).fetchone()
        return {
            "required": int(required_row["required"] or 0) if required_row else 0,
            "employees": int(required_row["employees"] or 0) if required_row else 0,
            "allocated": int(allocated_row["allocated"] or 0) if allocated_row else 0,
            "employees_allocated": int(allocated_row["employees_allocated"] or 0) if allocated_row else 0,
        }

    def list_evaluation_round_vouchers(self, round_id: int) -> dict[int, list[dict[str, Any]]]:
        rows = self.conn.execute(
            """
            SELECT v.*, re.round_id, re.employee_code, re.employee_name
            FROM evaluation_voucher_allocations v
            JOIN evaluation_round_employees re ON re.id=v.round_employee_id
            WHERE re.round_id=?
            ORDER BY re.employee_name COLLATE NOCASE, re.employee_code COLLATE NOCASE, v.id
            """,
            (int(round_id),),
        ).fetchall()
        result: dict[int, list[dict[str, Any]]] = {}
        for row in rows:
            result.setdefault(int(row["round_employee_id"]), []).append(dict(row))
        return result

    def assign_evaluation_vouchers(
        self,
        round_id: int,
        vouchers: list[dict[str, Any]],
        source_filename: str,
    ) -> dict[str, int]:
        employees = self.conn.execute(
            """
            SELECT id, employee_code, employee_name, voucher_count
            FROM evaluation_round_employees
            WHERE round_id=? AND status='ĐÃ ĐÁNH GIÁ'
            ORDER BY employee_name COLLATE NOCASE, employee_code COLLATE NOCASE
            """,
            (int(round_id),),
        ).fetchall()
        if not employees:
            raise DatabaseError("Lần đánh giá này chưa có nhân viên ĐÃ ĐÁNH GIÁ.")

        required = sum(int(row["voucher_count"] or 0) for row in employees)
        if required <= 0:
            raise DatabaseError("Tổng số lượng Voucher cần phát đang bằng 0.")

        normalized: list[dict[str, Any]] = []
        seen: set[str] = set()
        for item in vouchers:
            code = str(item.get("voucher_code") or "").strip().upper()
            if not code:
                continue
            key = code.casefold()
            if key in seen:
                raise DatabaseError(f"File Voucher có mã bị trùng: {code}")
            seen.add(key)
            normalized.append({
                "voucher_code": code,
                "program_code": str(item.get("program_code") or "").strip(),
                "program_name": str(item.get("program_name") or "").strip(),
                "start_at": str(item.get("start_at") or "").strip(),
                "end_at": str(item.get("end_at") or "").strip(),
            })
        if not normalized:
            raise DatabaseError("File Voucher không có mã khuyến mãi hợp lệ.")

        codes = [item["voucher_code"] for item in normalized]
        used_elsewhere: set[str] = set()
        for start in range(0, len(codes), 500):
            batch = codes[start:start + 500]
            placeholders = ",".join("?" for _ in batch)
            rows = self.conn.execute(
                f"""
                SELECT v.voucher_code
                FROM evaluation_voucher_allocations v
                JOIN evaluation_round_employees re ON re.id=v.round_employee_id
                WHERE re.round_id<>? AND UPPER(v.voucher_code) IN ({placeholders})
                """,
                [int(round_id), *[code.upper() for code in batch]],
            ).fetchall()
            used_elsewhere.update(str(row["voucher_code"]).upper() for row in rows)

        available = [item for item in normalized if item["voucher_code"].upper() not in used_elsewhere]
        if len(available) < required:
            raise DatabaseError(
                "Không đủ Voucher chưa sử dụng để phân.\n\n"
                f"Cần: {required}\n"
                f"File có: {len(normalized)}\n"
                f"Đã dùng ở lần đánh giá khác: {len(used_elsewhere)}\n"
                f"Còn dùng được: {len(available)}"
            )

        assigned = 0
        cursor = 0
        with self.transaction():
            self.conn.execute(
                "DELETE FROM evaluation_voucher_allocations WHERE round_employee_id IN "
                "(SELECT id FROM evaluation_round_employees WHERE round_id=?)",
                (int(round_id),),
            )
            for employee in employees:
                count = int(employee["voucher_count"] or 0)
                for item in available[cursor:cursor + count]:
                    self.conn.execute(
                        """
                        INSERT INTO evaluation_voucher_allocations(
                            round_employee_id, voucher_code, program_code, program_name,
                            start_at, end_at, source_filename
                        ) VALUES (?,?,?,?,?,?,?)
                        """,
                        (
                            int(employee["id"]), item["voucher_code"], item["program_code"],
                            item["program_name"], item["start_at"], item["end_at"],
                            str(source_filename or "").strip(),
                        ),
                    )
                    assigned += 1
                cursor += count

        return {
            "required": required,
            "file_total": len(normalized),
            "assigned": assigned,
            "remaining": max(0, len(available) - assigned),
            "skipped_used": len(used_elsewhere),
            "employees": len(employees),
        }

    def evaluation_employee_history(self, employee_id: int) -> list[dict[str, Any]]:
        rows = [dict(row) for row in self.conn.execute(
            """
            SELECT re.*, r.evaluation_date, r.label AS round_label
            FROM evaluation_round_employees re
            JOIN evaluation_rounds r ON r.id=re.round_id
            WHERE re.employee_id=? AND re.status='ĐÃ ĐÁNH GIÁ'
            ORDER BY r.evaluation_date ASC, r.id ASC
            """, (int(employee_id),)
        )]
        if not rows:
            return []
        # Tính hạng từng lần theo bộ tiêu chí, rồi thay đổi so với lần trước cùng bộ.
        rank_cache: dict[tuple[int, str], dict[int, int]] = {}
        for item in rows:
            key = (int(item["round_id"]), str(item["role"]))
            if key not in rank_cache:
                role_rows = self.conn.execute(
                    """
                    SELECT id, total_points FROM evaluation_round_employees
                    WHERE round_id=? AND role=? AND status='ĐÃ ĐÁNH GIÁ'
                    ORDER BY total_points DESC
                    """, key
                ).fetchall()
                m: dict[int, int] = {}
                last_score = None
                rank = 0
                for rr in role_rows:
                    score = int(rr["total_points"] or 0)
                    if last_score is None or score != last_score:
                        rank += 1
                        last_score = score
                    m[int(rr["id"])] = rank
                rank_cache[key] = m
        previous_by_role: dict[str, int] = {}
        for item in rows:
            role_name = str(item["role"])
            rank = rank_cache[(int(item["round_id"]), role_name)].get(int(item["id"]))
            item["rank_position"] = rank
            previous = previous_by_role.get(role_name)
            item["rank_change"] = None if previous is None or rank is None else previous - rank
            if rank is not None:
                previous_by_role[role_name] = rank
        return list(reversed(rows))

    def evaluation_overall_rows(
        self,
        date_from: str = "",
        date_to: str = "",
        search: str = "",
        role: str = "",
        rating: str = "",
        evaluator: str = "",
        source: str = "",
        sort_mode: str = "date_desc",
    ) -> list[dict[str, Any]]:
        params: list[Any] = []
        where = ["re.status='ĐÃ ĐÁNH GIÁ'"]
        if date_from:
            where.append("r.evaluation_date>=?")
            params.append(date_from)
        if date_to:
            where.append("r.evaluation_date<=?")
            params.append(date_to)
        if search.strip():
            where.append("(re.employee_code LIKE ? OR re.employee_name LIKE ?)")
            token = f"%{search.strip()}%"
            params.extend([token, token])
        if role:
            where.append("re.role=?")
            params.append(role)
        if rating:
            where.append("re.rating=?")
            params.append(rating)
        if evaluator.strip():
            where.append("re.evaluator_name LIKE ?")
            params.append(f"%{evaluator.strip()}%")
        if source:
            where.append("re.data_source=?")
            params.append(source)
        order = {
            "score_desc": "re.total_points DESC, r.evaluation_date DESC",
            "score_asc": "re.total_points ASC, r.evaluation_date DESC",
            "date_asc": "r.evaluation_date ASC, re.employee_name COLLATE NOCASE",
        }.get(sort_mode, "r.evaluation_date DESC, re.employee_name COLLATE NOCASE")
        rows = [dict(row) for row in self.conn.execute(
            f"""
            SELECT re.*, r.evaluation_date, r.label AS round_label,
                   (SELECT COALESCE(SUM(x.voucher_count),0) FROM evaluation_round_employees x
                    WHERE x.employee_id=re.employee_id AND x.status='ĐÃ ĐÁNH GIÁ') AS employee_voucher_total
            FROM evaluation_round_employees re
            JOIN evaluation_rounds r ON r.id=re.round_id
            WHERE {' AND '.join(where)}
            ORDER BY {order}
            """, params
        )]
        # Hạng của mỗi dòng trong đúng lần + bộ tiêu chí.
        cache: dict[tuple[int, str], dict[int, int]] = {}
        for row in rows:
            key = (int(row["round_id"]), str(row["role"]))
            if key not in cache:
                all_rows = self.conn.execute(
                    """
                    SELECT id,total_points FROM evaluation_round_employees
                    WHERE round_id=? AND role=? AND status='ĐÃ ĐÁNH GIÁ'
                    ORDER BY total_points DESC
                    """, key
                ).fetchall()
                rank_map: dict[int, int] = {}
                rank = 0
                last = None
                for item in all_rows:
                    score = int(item["total_points"] or 0)
                    if last is None or score != last:
                        rank += 1
                        last = score
                    rank_map[int(item["id"])] = rank
                cache[key] = rank_map
            row["rank_position"] = cache[key].get(int(row["id"]))
        return rows

    def _seed_spirit_data_once(self) -> None:
        """Nạp một lần dữ liệu nhân viên và lịch cố định từ Spirit 2.5.0.

        Dùng upsert theo mã nhân viên để bản cập nhật hoạt động cả với database đã
        tồn tại. Các lịch cũ mang vị trí "Quản lý ca" được giữ ở trạng thái chờ
        người dùng chọn Pha chế hoặc Chạy bàn.
        """
        if self.get_setting("spirit_250_seed_v2") == "done":
            return

        if self.path.exists() and self.employee_count() > 0:
            self.backup("truoc_khi_nap_spirit_250")

        with self.transaction():
            for item in SPIRIT_EMPLOYEES:
                existing = self.conn.execute(
                    "SELECT id FROM employees WHERE code=? COLLATE NOCASE",
                    (item["code"],),
                ).fetchone()
                if existing:
                    employee_id = int(existing["id"])
                    self.conn.execute(
                        "UPDATE employees SET name=?, rank=?, status=?, preferred_role=COALESCE(NULLIF(preferred_role,''), ?), updated_at=CURRENT_TIMESTAMP WHERE id=?",
                        (item["name"], item["rank"], item["status"], (item.get("roles") or [None])[0], employee_id),
                    )
                else:
                    cursor = self.conn.execute(
                        "INSERT INTO employees(code, name, rank, status, preferred_role) VALUES (?, ?, ?, ?, ?)",
                        (item["code"], item["name"], item["rank"], item["status"], (item.get("roles") or [None])[0]),
                    )
                    employee_id = int(cursor.lastrowid)

                self.conn.execute("DELETE FROM employee_branches WHERE employee_id=?", (employee_id,))
                for branch_code in item["branches"]:
                    branch = self._resolve_branch_row(branch_code)
                    if branch:
                        self.conn.execute(
                            "INSERT OR IGNORE INTO employee_branches(employee_id, branch_id) VALUES (?, ?)",
                            (employee_id, int(branch["id"])),
                        )

                self.conn.execute("DELETE FROM employee_roles WHERE employee_id=?", (employee_id,))
                for role in item["roles"]:
                    self.conn.execute(
                        "INSERT OR IGNORE INTO employee_roles(employee_id, role) VALUES (?, ?)",
                        (employee_id, role),
                    )

            # Nạp các lịch cố định đã có vị trí phù hợp với app mới.
            for fixed in SPIRIT_FIXED_RESOLVED:
                employee = self.conn.execute(
                    "SELECT id FROM employees WHERE code=? COLLATE NOCASE",
                    (fixed["code"],),
                ).fetchone()
                branch = self._resolve_branch_row(fixed["branch"])
                if not employee or not branch:
                    continue
                employee_id = int(employee["id"])
                branch_id = int(branch["id"])
                self.conn.execute(
                    "INSERT OR IGNORE INTO fixed_schedule_members(employee_id) VALUES (?)",
                    (employee_id,),
                )
                for weekday in fixed["weekdays"]:
                    self.conn.execute(
                        """
                        INSERT INTO fixed_schedule_entries(employee_id, weekday, shift, branch_id, role)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(employee_id, weekday, shift) DO UPDATE SET
                            branch_id=excluded.branch_id, role=excluded.role, updated_at=CURRENT_TIMESTAMP
                        """,
                        (employee_id, int(weekday), fixed["shift"], branch_id, fixed["role"]),
                    )

            # Thêm 4 quản lý vào danh sách cố định, nhưng chưa tự đoán vị trí mới.
            for pending in SPIRIT_FIXED_NEEDS_ROLE:
                employee = self.conn.execute(
                    "SELECT id FROM employees WHERE code=? COLLATE NOCASE",
                    (pending["code"],),
                ).fetchone()
                if employee:
                    self.conn.execute(
                        "INSERT OR IGNORE INTO fixed_schedule_members(employee_id) VALUES (?)",
                        (int(employee["id"]),),
                    )

            self.conn.execute(
                "INSERT INTO settings(key, value) VALUES ('spirit_pending_manager_fixed_v2', ?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (json.dumps(SPIRIT_FIXED_NEEDS_ROLE, ensure_ascii=False),),
            )
            self.conn.execute(
                "INSERT INTO settings(key, value) VALUES ('spirit_250_seed_v2', 'done') "
                "ON CONFLICT(key) DO UPDATE SET value='done'"
            )

    def pending_spirit_manager_fixed(self) -> list[dict[str, Any]]:
        raw = self.get_setting("spirit_pending_manager_fixed_v2")
        if not raw:
            return []
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return []
        return data if isinstance(data, list) else []

    def apply_spirit_manager_fixed_roles(self, role_by_code: dict[str, str]) -> int:
        pending = self.pending_spirit_manager_fixed()
        if not pending:
            return 0
        missing = [item["code"] for item in pending if role_by_code.get(item["code"]) not in ROLES]
        if missing:
            raise DatabaseError("Chưa chọn vị trí cho: " + ", ".join(missing))

        self.backup("chuyen_lich_quan_ly_ca_spirit")
        inserted = 0
        with self.transaction():
            for item in pending:
                role = role_by_code[item["code"]]
                employee = self.conn.execute(
                    "SELECT id FROM employees WHERE code=? COLLATE NOCASE",
                    (item["code"],),
                ).fetchone()
                branch = self._resolve_branch_row(item["branch"])
                if not employee or not branch:
                    continue
                employee_id = int(employee["id"])
                branch_id = int(branch["id"])
                # Vị trí do quản lý chọn được bổ sung vào hồ sơ nhân viên.
                self.conn.execute(
                    "INSERT OR IGNORE INTO employee_roles(employee_id, role) VALUES (?, ?)",
                    (employee_id, role),
                )
                self.conn.execute(
                    "INSERT OR IGNORE INTO fixed_schedule_members(employee_id) VALUES (?)",
                    (employee_id,),
                )
                for weekday in item["weekdays"]:
                    self.conn.execute(
                        """
                        INSERT INTO fixed_schedule_entries(employee_id, weekday, shift, branch_id, role)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(employee_id, weekday, shift) DO UPDATE SET
                            branch_id=excluded.branch_id, role=excluded.role, updated_at=CURRENT_TIMESTAMP
                        """,
                        (employee_id, int(weekday), item["shift"], branch_id, role),
                    )
                    inserted += 1
            self.conn.execute(
                "INSERT INTO settings(key, value) VALUES ('spirit_pending_manager_fixed_v2', '[]') "
                "ON CONFLICT(key) DO UPDATE SET value='[]'"
            )
        return inserted

    def backup(self, reason: str = "backup") -> Path | None:
        if not self.path.exists():
            return None
        safe_reason = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in reason)[:40]
        target = backup_dir() / f"{datetime.now():%Y%m%d_%H%M%S}_{safe_reason}.sqlite3"
        self.conn.commit()
        destination = sqlite3.connect(target)
        try:
            self.conn.backup(destination)
        finally:
            destination.close()
        self._cleanup_backups()
        return target

    def backup_daily_once(self) -> Path | None:
        today_prefix = datetime.now().strftime("%Y%m%d_")
        for path in backup_dir().glob(f"{today_prefix}*_sao_luu_hang_ngay.sqlite3"):
            if path.exists():
                return path
        return self.backup("sao_luu_hang_ngay")

    def _cleanup_backups(self) -> None:
        files = sorted(backup_dir().glob("*.sqlite3"), key=lambda p: p.stat().st_mtime, reverse=True)
        cutoff = datetime.now() - timedelta(days=30)
        for index, path in enumerate(files):
            modified = datetime.fromtimestamp(path.stat().st_mtime)
            if index >= 20 or modified < cutoff:
                try:
                    path.unlink()
                except OSError:
                    pass

    def cleanup_old_data(self) -> int:
        cutoff = date.today() - timedelta(days=30)
        old_rows = self.conn.execute(
            "SELECT id FROM weeks WHERE end_date < ?",
            (cutoff.isoformat(),),
        ).fetchall()
        if not old_rows:
            return 0
        self.backup("don_du_lieu_30_ngay")
        ids = [row["id"] for row in old_rows]
        with self.transaction():
            self.conn.executemany("DELETE FROM weeks WHERE id = ?", [(item,) for item in ids])
        return len(ids)

    @staticmethod
    def monday_of(value: date) -> date:
        return value - timedelta(days=value.weekday())

    def ensure_current_week(self) -> int:
        monday = self.monday_of(date.today())
        return self.create_week(monday)

    def create_week(self, start: date) -> int:
        monday = self.monday_of(start)
        sunday = monday + timedelta(days=6)
        with self.transaction():
            self.conn.execute(
                "INSERT OR IGNORE INTO weeks(start_date, end_date) VALUES (?, ?)",
                (monday.isoformat(), sunday.isoformat()),
            )
        row = self.conn.execute("SELECT id FROM weeks WHERE start_date = ?", (monday.isoformat(),)).fetchone()
        if row is None:
            raise DatabaseError("Không thể tạo tuần.")
        return int(row["id"])

    def list_weeks(self) -> list[sqlite3.Row]:
        return list(self.conn.execute("SELECT * FROM weeks ORDER BY start_date DESC"))

    def get_week(self, week_id: int) -> sqlite3.Row | None:
        return self.conn.execute("SELECT * FROM weeks WHERE id = ?", (week_id,)).fetchone()

    def week_has_data(self, week_id: int) -> bool:
        checks = (
            ("order_entries", "week_id"),
            ("order_import_batches", "week_id"),
            ("order_snapshots", "week_id"),
            ("weekly_schedule_entries", "week_id"),
            ("schedule_closures", "week_id"),
        )
        for table, column in checks:
            row = self.conn.execute(
                f"SELECT 1 FROM {table} WHERE {column}=? LIMIT 1", (int(week_id),)
            ).fetchone()
            if row is not None:
                return True
        return False

    def delete_week(self, week_id: int) -> None:
        if self.week_has_data(week_id):
            raise DatabaseError("Tuần đã phát sinh Order, lịch làm hoặc dữ liệu chốt nên không thể xóa.")
        self.backup("xoa_tuan")
        with self.transaction():
            self.conn.execute("DELETE FROM weeks WHERE id=?", (int(week_id),))

    def get_setting(self, key: str, default: str | None = None) -> str | None:
        row = self.conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else default

    def set_setting(self, key: str, value: str) -> None:
        with self.transaction():
            self.conn.execute(
                "INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, value),
            )

    def list_branches(self, active_only: bool = False) -> list[sqlite3.Row]:
        where = "WHERE status='Đang hoạt động'" if active_only else ""
        return list(
            self.conn.execute(
                f"""
                SELECT *, COALESCE(NULLIF(display_code,''), code) AS ui_code,
                       COALESCE(NULLIF(system_code,''), code) AS internal_code
                FROM branches {where}
                ORDER BY sort_order, name COLLATE NOCASE
                """
            )
        )

    def get_branch(self, branch_id: int) -> sqlite3.Row | None:
        return self.conn.execute(
            "SELECT *, COALESCE(NULLIF(display_code,''), code) AS ui_code, "
            "COALESCE(NULLIF(system_code,''), code) AS internal_code FROM branches WHERE id=?",
            (branch_id,),
        ).fetchone()

    def list_shifts(self, active_only: bool = False, order_only: bool = False) -> list[sqlite3.Row]:
        conditions: list[str] = []
        if active_only:
            conditions.append("s.status='Đang sử dụng'")
        if order_only:
            conditions.append(
                "EXISTS (SELECT 1 FROM branch_shifts bs JOIN branches b ON b.id=bs.branch_id "
                "WHERE bs.shift_id=s.id AND bs.enabled=1 AND b.status='Đang hoạt động')"
            )
        where = "WHERE " + " AND ".join(conditions) if conditions else ""
        return list(
            self.conn.execute(
                f"SELECT s.* FROM shifts s {where} ORDER BY s.sort_order, s.name COLLATE NOCASE"
            )
        )

    def list_shift_names(self, active_only: bool = True, order_only: bool = False) -> list[str]:
        rows = self.list_shifts(active_only=active_only, order_only=order_only)
        return [str(row["name"]) for row in rows]

    def list_branch_shifts(self, branch_id: int) -> list[sqlite3.Row]:
        return list(
            self.conn.execute(
                """
                SELECT s.id AS shift_id, s.code, s.name, s.color, s.status, s.sort_order AS shift_sort_order,
                       COALESCE(bs.enabled, 0) AS enabled, bs.start_time, bs.end_time,
                       COALESCE(bs.sort_order, s.sort_order) AS branch_sort_order
                FROM shifts s
                LEFT JOIN branch_shifts bs ON bs.shift_id=s.id AND bs.branch_id=?
                ORDER BY COALESCE(bs.sort_order, s.sort_order), s.sort_order, s.name COLLATE NOCASE
                """,
                (branch_id,),
            )
        )

    def list_branch_shift_names(
        self,
        branch: int | str,
        active_only: bool = True,
        enabled_only: bool = True,
    ) -> list[str]:
        """Danh sách ca của một cơ sở theo đúng thứ tự hiển thị.

        ``branch`` có thể là branch_id, mã hệ thống hoặc mã hiển thị.
        """
        if isinstance(branch, int):
            branch_row = self.get_branch(branch)
        else:
            branch_row = self._resolve_branch_row(str(branch))
        if branch_row is None:
            return []
        rows = self.list_branch_shifts(int(branch_row["id"]))
        result: list[str] = []
        for row in rows:
            if active_only and str(row["status"]) != "Đang sử dụng":
                continue
            if enabled_only and not bool(row["enabled"]):
                continue
            result.append(str(row["name"]))
        return result

    def branch_uses_shift(self, branch: int | str, shift_name: str) -> bool:
        if isinstance(branch, int):
            branch_row = self.get_branch(branch)
        else:
            branch_row = self._resolve_branch_row(str(branch))
        if branch_row is None:
            return False
        row = self.conn.execute(
            """
            SELECT 1
            FROM branch_shifts bs
            JOIN shifts s ON s.id=bs.shift_id
            WHERE bs.branch_id=? AND bs.enabled=1
              AND s.status='Đang sử dụng' AND s.name=? COLLATE NOCASE
            LIMIT 1
            """,
            (int(branch_row["id"]), str(shift_name)),
        ).fetchone()
        return row is not None

    def save_branch(
        self, system_code: str, display_code: str, name: str, status: str = "Đang hoạt động",
        sort_order: int = 0, branch_id: int | None = None,
    ) -> int:
        system_code = self._normalize_code(system_code)
        display_code = str(display_code or system_code).strip().upper()
        name = str(name or '').strip()
        if not system_code or not name:
            raise DatabaseError("Mã hệ thống và tên cơ sở không được để trống.")
        existing = self.conn.execute(
            "SELECT id FROM branches WHERE (system_code=? OR code=? OR display_code=?) AND id<>COALESCE(?, -1)",
            (system_code, system_code, display_code, branch_id),
        ).fetchone()
        if existing:
            raise DatabaseError("Mã cơ sở đã tồn tại.")
        self.backup("cap_nhat_co_so")
        with self.transaction():
            if branch_id is None:
                cursor = self.conn.execute(
                    "INSERT INTO branches(code, system_code, display_code, name, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
                    (system_code, system_code, display_code, name, status, int(sort_order)),
                )
                branch_id = int(cursor.lastrowid)
                for shift in self.list_shifts(active_only=False):
                    self.conn.execute(
                        "INSERT OR IGNORE INTO branch_shifts(branch_id, shift_id, enabled, sort_order) VALUES (?, ?, 0, ?)",
                        (branch_id, int(shift["id"]), int(shift["sort_order"])),
                    )
                    for weekday in range(7):
                        for role in ROLES:
                            self.conn.execute(
                                "INSERT OR IGNORE INTO staffing_requirements(branch_id, weekday, shift, role, required_count) "
                                "VALUES (?, ?, ?, ?, 0)",
                                (branch_id, weekday, str(shift["name"]), role),
                            )
            else:
                current = self.get_branch(int(branch_id))
                if current is None:
                    raise DatabaseError("Không tìm thấy cơ sở.")
                # Mã hệ thống không đổi sau khi đã tạo để tránh làm hỏng dữ liệu liên kết.
                system_code = str(current["system_code"] or current["code"])
                self.conn.execute(
                    "UPDATE branches SET system_code=?, display_code=?, name=?, status=?, sort_order=? WHERE id=?",
                    (system_code, display_code, name, status, int(sort_order), int(branch_id)),
                )
        return int(branch_id)

    def branch_has_data(self, branch_id: int) -> bool:
        checks = [
            ("employee_branches", "branch_id"),
            ("staffing_requirements", "branch_id"),
            ("fixed_schedule_entries", "branch_id"),
            ("weekly_schedule_entries", "branch_id"),
        ]
        for table, column in checks:
            if table == "staffing_requirements":
                row = self.conn.execute(
                    "SELECT 1 FROM staffing_requirements WHERE branch_id=? AND required_count>0 LIMIT 1",
                    (branch_id,),
                ).fetchone()
            else:
                row = self.conn.execute(f"SELECT 1 FROM {table} WHERE {column}=? LIMIT 1", (branch_id,)).fetchone()
            if row:
                return True
        return False

    def set_branch_status(self, branch_id: int, active: bool) -> None:
        self.backup("doi_trang_thai_co_so")
        with self.transaction():
            self.conn.execute(
                "UPDATE branches SET status=? WHERE id=?",
                ("Đang hoạt động" if active else "Ngừng hoạt động", branch_id),
            )

    def delete_branch(self, branch_id: int) -> None:
        if self.branch_has_data(branch_id):
            raise DatabaseError("Cơ sở đã phát sinh dữ liệu; chỉ được chuyển sang Ngừng hoạt động.")
        self.backup("xoa_co_so")
        with self.transaction():
            self.conn.execute("DELETE FROM branches WHERE id=?", (branch_id,))

    def save_branch_shift_settings(self, branch_id: int, values: dict[int, dict[str, Any]]) -> None:
        self.backup("cap_nhat_ca_cua_co_so")
        with self.transaction():
            for shift_id, item in values.items():
                shift = self.conn.execute("SELECT name, sort_order FROM shifts WHERE id=?", (shift_id,)).fetchone()
                if shift is None:
                    continue
                enabled = 1 if item.get("enabled") else 0
                start_time = str(item.get("start_time") or '').strip() or None
                end_time = str(item.get("end_time") or '').strip() or None
                if enabled and (not start_time or not end_time):
                    raise DatabaseError(f"Nhập đủ giờ bắt đầu và kết thúc cho ca {shift['name']}.")
                self.conn.execute(
                    """
                    INSERT INTO branch_shifts(branch_id, shift_id, enabled, start_time, end_time, sort_order, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(branch_id, shift_id) DO UPDATE SET
                        enabled=excluded.enabled, start_time=excluded.start_time, end_time=excluded.end_time,
                        sort_order=excluded.sort_order, updated_at=CURRENT_TIMESTAMP
                    """,
                    (branch_id, shift_id, enabled, start_time, end_time, int(item.get("sort_order", shift["sort_order"]))),
                )

    def save_shift(
        self, code: str, name: str, color: str = "#DBEAFE", status: str = "Đang sử dụng",
        sort_order: int = 0, shift_id: int | None = None,
    ) -> int:
        code = self._normalize_code(code)
        name = str(name or '').strip()
        if not code or not name:
            raise DatabaseError("Mã ca và tên ca không được để trống.")
        existing = self.conn.execute(
            "SELECT id FROM shifts WHERE (code=? COLLATE NOCASE OR name=? COLLATE NOCASE) AND id<>COALESCE(?, -1)",
            (code, name, shift_id),
        ).fetchone()
        if existing:
            raise DatabaseError("Mã ca hoặc tên ca đã tồn tại.")
        self.backup("cap_nhat_danh_sach_ca")
        with self.transaction():
            if shift_id is None:
                cursor = self.conn.execute(
                    "INSERT INTO shifts(code, name, color, status, sort_order) VALUES (?, ?, ?, ?, ?)",
                    (code, name, color or "#DBEAFE", status, int(sort_order)),
                )
                shift_id = int(cursor.lastrowid)
                for branch in self.list_branches(active_only=False):
                    self.conn.execute(
                        "INSERT OR IGNORE INTO branch_shifts(branch_id, shift_id, enabled, sort_order) VALUES (?, ?, 0, ?)",
                        (int(branch["id"]), shift_id, int(sort_order)),
                    )
                    for weekday in range(7):
                        for role in ROLES:
                            self.conn.execute(
                                "INSERT OR IGNORE INTO staffing_requirements(branch_id, weekday, shift, role, required_count) "
                                "VALUES (?, ?, ?, ?, 0)",
                                (int(branch["id"]), weekday, name, role),
                            )
            else:
                old = self.conn.execute("SELECT name FROM shifts WHERE id=?", (shift_id,)).fetchone()
                if old is None:
                    raise DatabaseError("Không tìm thấy ca làm việc.")
                old_name = str(old["name"])
                self.conn.execute(
                    "UPDATE shifts SET code=?, name=?, color=?, status=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                    (code, name, color or "#DBEAFE", status, int(sort_order), int(shift_id)),
                )
                if old_name != name:
                    # Chỉ đổi nhãn của dữ liệu đang dùng; lịch đã chốt vẫn giữ bản chụp định biên.
                    for table in ("staffing_requirements", "order_entries", "fixed_schedule_entries", "weekly_schedule_entries"):
                        self.conn.execute(f"UPDATE {table} SET shift=? WHERE shift=?", (name, old_name))
        return int(shift_id)

    def shift_has_data(self, shift_id: int) -> bool:
        row = self.conn.execute("SELECT name FROM shifts WHERE id=?", (shift_id,)).fetchone()
        if row is None:
            return False
        name = str(row["name"])
        for table in ("staffing_requirements", "order_entries", "fixed_schedule_entries", "weekly_schedule_entries"):
            condition = " AND required_count>0" if table == "staffing_requirements" else ""
            if self.conn.execute(f"SELECT 1 FROM {table} WHERE shift=?{condition} LIMIT 1", (name,)).fetchone():
                return True
        return False

    def set_shift_status(self, shift_id: int, active: bool) -> None:
        self.backup("doi_trang_thai_ca")
        with self.transaction():
            self.conn.execute(
                "UPDATE shifts SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                ("Đang sử dụng" if active else "Ngừng sử dụng", shift_id),
            )

    def delete_shift(self, shift_id: int) -> None:
        if self.shift_has_data(shift_id):
            raise DatabaseError("Ca đã phát sinh dữ liệu; chỉ được chuyển sang Ngừng sử dụng.")
        self.backup("xoa_ca")
        with self.transaction():
            self.conn.execute("DELETE FROM shifts WHERE id=?", (shift_id,))

    def employee_count(self, active_only: bool = False) -> int:
        if active_only:
            row = self.conn.execute("SELECT COUNT(*) AS n FROM employees WHERE status='Đang làm'").fetchone()
        else:
            row = self.conn.execute("SELECT COUNT(*) AS n FROM employees").fetchone()
        return int(row["n"])

    def list_employees(
        self,
        search: str = "",
        rank: str = "",
        branch_code: str = "",
        status: str = "",
        role: str = "",
    ) -> list[sqlite3.Row]:
        params: list[Any] = []
        where: list[str] = []
        if search.strip():
            where.append("(e.code LIKE ? OR e.name LIKE ?)")
            token = f"%{search.strip()}%"
            params.extend([token, token])
        if rank:
            where.append("e.rank = ?")
            params.append(rank)
        if status:
            where.append("e.status = ?")
            params.append(status)
        if branch_code:
            where.append(
                "EXISTS (SELECT 1 FROM employee_branches eb2 JOIN branches b2 ON b2.id=eb2.branch_id "
                "WHERE eb2.employee_id=e.id AND (b2.code=? OR b2.system_code=? OR b2.display_code=?))"
            )
            params.extend([branch_code, branch_code, branch_code])
        if role:
            where.append("EXISTS (SELECT 1 FROM employee_roles er2 WHERE er2.employee_id=e.id AND er2.role=?)")
            params.append(role)
        where_sql = " WHERE " + " AND ".join(where) if where else ""
        query = f"""
            SELECT e.*,
                   COALESCE((
                       SELECT GROUP_CONCAT(COALESCE(NULLIF(b.display_code,''), b.code), ', ')
                       FROM employee_branches eb
                       JOIN branches b ON b.id=eb.branch_id
                       WHERE eb.employee_id=e.id
                   ), '') AS branches,
                   COALESCE((
                       SELECT GROUP_CONCAT(er.role, ', ')
                       FROM employee_roles er
                       WHERE er.employee_id=e.id
                   ), '') AS roles
            FROM employees e
            {where_sql}
            ORDER BY CASE WHEN e.status='Đang làm' THEN 0 ELSE 1 END, e.name COLLATE NOCASE
        """
        return list(self.conn.execute(query, params))

    def get_employee(self, employee_id: int) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT * FROM employees WHERE id = ?", (employee_id,)).fetchone()
        if row is None:
            return None
        branches = [
            item["code"]
            for item in self.conn.execute(
                "SELECT COALESCE(NULLIF(b.display_code,''), b.code) AS code FROM employee_branches eb JOIN branches b ON b.id=eb.branch_id "
                "WHERE eb.employee_id=? ORDER BY b.sort_order",
                (employee_id,),
            )
        ]
        role_rows = self.conn.execute(
            "SELECT role FROM employee_roles WHERE employee_id=?",
            (employee_id,),
        ).fetchall()
        role_set = {item["role"] for item in role_rows}
        roles = [role_name for role_name in ROLES if role_name in role_set]
        result = dict(row)
        result["branches"] = branches
        result["roles"] = roles
        return result

    def find_employee_by_code(self, code: str) -> sqlite3.Row | None:
        return self.conn.execute("SELECT * FROM employees WHERE code = ? COLLATE NOCASE", (code.strip(),)).fetchone()

    def employee_has_data(self, employee_id: int) -> bool:
        checks = (
            ("order_entries", "employee_id"),
            ("fixed_schedule_members", "employee_id"),
            ("fixed_schedule_entries", "employee_id"),
            ("weekly_schedule_entries", "employee_id"),
            ("employee_work_plans", "employee_id"),
            ("evaluation_records", "employee_id"),
            ("evaluation_round_employees", "employee_id"),
        )
        for table, column in checks:
            row = self.conn.execute(
                f"SELECT 1 FROM {table} WHERE {column}=? LIMIT 1", (int(employee_id),)
            ).fetchone()
            if row is not None:
                return True
        return False

    def set_employee_status(self, employee_id: int, status: str) -> None:
        if status not in ("Đang làm", "Ngừng làm"):
            raise DatabaseError("Trạng thái nhân viên không hợp lệ.")
        with self.transaction():
            self.conn.execute(
                "UPDATE employees SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (status, int(employee_id)),
            )

    def save_employee(
        self,
        code: str,
        name: str,
        rank: str,
        status: str,
        branches: Iterable[str],
        roles: Iterable[str],
        preferred_role: str | None = None,
        employee_id: int | None = None,
    ) -> int:
        code = code.strip()
        name = name.strip()
        if not code or not name:
            raise DatabaseError("Mã nhân viên và tên nhân viên không được để trống.")
        branch_codes = list(dict.fromkeys(item.strip() for item in branches if item.strip()))
        role_names = list(dict.fromkeys(item.strip() for item in roles if item.strip()))
        if not branch_codes:
            raise DatabaseError("Chọn ít nhất một cơ sở làm việc.")
        if not role_names:
            raise DatabaseError("Chọn ít nhất một vị trí: Pha chế hoặc Chạy bàn.")
        invalid_roles = [item for item in role_names if item not in ROLES]
        if invalid_roles:
            raise DatabaseError("Vị trí không hợp lệ: " + ", ".join(invalid_roles))
        preferred_role = (preferred_role or role_names[0]).strip()
        if preferred_role not in role_names:
            raise DatabaseError("Vị trí ưu tiên phải nằm trong các vị trí nhân viên đảm nhiệm.")
        try:
            with self.transaction():
                if employee_id is None:
                    cursor = self.conn.execute(
                        "INSERT INTO employees(code, name, rank, status, preferred_role) VALUES (?, ?, ?, ?, ?)",
                        (code, name, rank, status, preferred_role),
                    )
                    employee_id = int(cursor.lastrowid)
                else:
                    self.conn.execute(
                        "UPDATE employees SET code=?, name=?, rank=?, status=?, preferred_role=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                        (code, name, rank, status, preferred_role, employee_id),
                    )
                self.conn.execute("DELETE FROM employee_branches WHERE employee_id=?", (employee_id,))
                for branch_code in branch_codes:
                    row = self._resolve_branch_row(branch_code)
                    if row:
                        self.conn.execute(
                            "INSERT INTO employee_branches(employee_id, branch_id) VALUES (?, ?)",
                            (employee_id, row["id"]),
                        )
                self.conn.execute("DELETE FROM employee_roles WHERE employee_id=?", (employee_id,))
                for role_name in role_names:
                    self.conn.execute(
                        "INSERT INTO employee_roles(employee_id, role) VALUES (?, ?)",
                        (employee_id, role_name),
                    )
            return employee_id
        except sqlite3.IntegrityError as exc:
            raise DatabaseError(f"Mã nhân viên '{code}' đã tồn tại.") from exc

    def delete_employee(self, employee_id: int) -> None:
        self.backup("xoa_nhan_vien")
        with self.transaction():
            self.conn.execute("DELETE FROM employees WHERE id=?", (employee_id,))

    def import_employees(self, rows: list[dict[str, Any]]) -> tuple[int, int]:
        self.backup("nhap_danh_sach_nhan_vien")
        added = 0
        updated = 0
        with self.transaction():
            for item in rows:
                code = str(item["code"]).strip()
                existing = self.conn.execute(
                    "SELECT id FROM employees WHERE code=? COLLATE NOCASE",
                    (code,),
                ).fetchone()
                if existing:
                    employee_id = int(existing["id"])
                    self.conn.execute(
                        "UPDATE employees SET name=?, rank=?, status=?, preferred_role=COALESCE(NULLIF(preferred_role,''), ?), updated_at=CURRENT_TIMESTAMP WHERE id=?",
                        (item["name"], item["rank"], item["status"], (item.get("roles") or [None])[0], employee_id),
                    )
                    updated += 1
                else:
                    cursor = self.conn.execute(
                        "INSERT INTO employees(code, name, rank, status, preferred_role) VALUES (?, ?, ?, ?, ?)",
                        (code, item["name"], item["rank"], item["status"], (item.get("roles") or [None])[0]),
                    )
                    employee_id = int(cursor.lastrowid)
                    added += 1
                self.conn.execute("DELETE FROM employee_branches WHERE employee_id=?", (employee_id,))
                for branch_code in item["branches"]:
                    branch = self._resolve_branch_row(branch_code)
                    if branch:
                        self.conn.execute(
                            "INSERT INTO employee_branches(employee_id, branch_id) VALUES (?, ?)",
                            (employee_id, branch["id"]),
                        )
                self.conn.execute("DELETE FROM employee_roles WHERE employee_id=?", (employee_id,))
                for role_name in item["roles"]:
                    self.conn.execute(
                        "INSERT INTO employee_roles(employee_id, role) VALUES (?, ?)",
                        (employee_id, role_name),
                    )
        return added, updated

    def get_staffing(self, branch_id: int) -> dict[tuple[int, str, str], int]:
        rows = self.conn.execute(
            "SELECT weekday, shift, role, required_count FROM staffing_requirements WHERE branch_id=?",
            (branch_id,),
        )
        return {(int(r["weekday"]), r["shift"], r["role"]): int(r["required_count"]) for r in rows}

    def save_staffing(
        self,
        branch_id: int,
        values: dict[tuple[int, str, str], int],
        *,
        keep_history: bool = True,
    ) -> None:
        current = self.get_staffing(branch_id) if keep_history else {}
        with self.transaction():
            if keep_history:
                self.conn.execute(
                    "INSERT INTO staffing_history(branch_id, snapshot_json) VALUES (?, ?)",
                    (branch_id, json.dumps(self._staffing_to_json(current), ensure_ascii=False)),
                )
            for (weekday, shift, role), count in values.items():
                self.conn.execute(
                    """
                    INSERT INTO staffing_requirements(branch_id, weekday, shift, role, required_count, updated_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(branch_id, weekday, shift, role)
                    DO UPDATE SET required_count=excluded.required_count, updated_at=CURRENT_TIMESTAMP
                    """,
                    (branch_id, weekday, shift, role, max(0, int(count))),
                )

    def staffing_last_updated(self, branch_id: int) -> str | None:
        row = self.conn.execute(
            "SELECT MAX(updated_at) AS updated_at FROM staffing_requirements WHERE branch_id=?",
            (int(branch_id),),
        ).fetchone()
        return str(row["updated_at"]) if row and row["updated_at"] else None

    @staticmethod
    def _staffing_to_json(values: dict[tuple[int, str, str], int]) -> dict[str, int]:
        return {f"{weekday}|{shift}|{role}": count for (weekday, shift, role), count in values.items()}

    @staticmethod
    def _staffing_from_json(values: dict[str, int]) -> dict[tuple[int, str, str], int]:
        result: dict[tuple[int, str, str], int] = {}
        for key, count in values.items():
            weekday, shift, role = key.split("|", 2)
            result[(int(weekday), shift, role)] = int(count)
        return result

    def restore_last_staffing(self, branch_id: int) -> bool:
        row = self.conn.execute(
            "SELECT id, snapshot_json FROM staffing_history WHERE branch_id=? ORDER BY id DESC LIMIT 1",
            (branch_id,),
        ).fetchone()
        if row is None:
            return False
        values = self._staffing_from_json(json.loads(row["snapshot_json"]))
        with self.transaction():
            for (weekday, shift, role), count in values.items():
                self.conn.execute(
                    "UPDATE staffing_requirements SET required_count=?, updated_at=CURRENT_TIMESTAMP "
                    "WHERE branch_id=? AND weekday=? AND shift=? AND role=?",
                    (count, branch_id, weekday, shift, role),
                )
            self.conn.execute("DELETE FROM staffing_history WHERE id=?", (row["id"],))
        return True

    def copy_staffing(self, source_branch_id: int, target_branch_id: int) -> None:
        values = self.get_staffing(source_branch_id)
        self.save_staffing(target_branch_id, values)

    def _current_order_snapshot(self, week_id: int) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT employee_id, weekday, shift, status, is_manual FROM order_entries WHERE week_id=?",
            (week_id,),
        )
        return [dict(row) for row in rows]

    def replace_order_entries(
        self,
        week_id: int,
        rows: list[dict[str, Any]],
        filename: str,
    ) -> tuple[int, list[str]]:
        self.backup("nhap_order_lich_lam")
        snapshot = self._current_order_snapshot(week_id)
        unknown_codes: list[str] = []
        prepared: list[tuple[int, int, str, str]] = []
        for item in rows:
            employee = self.find_employee_by_code(str(item["code"]))
            if employee is None:
                unknown_codes.append(str(item["code"]))
                continue
            employee_id = int(employee["id"])
            for weekday in range(7):
                for shift in self.list_shift_names(active_only=True, order_only=True):
                    status = item.get("statuses", {}).get((weekday, shift), "CHƯA ORDER")
                    if status != "CHƯA ORDER":
                        prepared.append((employee_id, weekday, shift, status))
        with self.transaction():
            self.conn.execute(
                "INSERT INTO order_snapshots(week_id, snapshot_json, source_filename) VALUES (?, ?, ?)",
                (week_id, json.dumps(snapshot, ensure_ascii=False), filename),
            )
            self.conn.execute("DELETE FROM order_entries WHERE week_id=?", (week_id,))
            self.conn.executemany(
                """
                INSERT INTO order_entries(week_id, employee_id, weekday, shift, status, is_manual)
                VALUES (?, ?, ?, ?, ?, 0)
                """,
                [(week_id, employee_id, weekday, shift, status) for employee_id, weekday, shift, status in prepared],
            )
            self.conn.execute(
                "INSERT INTO order_import_batches(week_id, filename, row_count) VALUES (?, ?, ?)",
                (week_id, filename, len(rows) - len(unknown_codes)),
            )
        return len(rows) - len(unknown_codes), unknown_codes


    def import_form_order_responses(
        self,
        week_id: int,
        parsed: dict[str, Any],
        filename: str,
    ) -> dict[str, Any]:
        """Nhập câu trả lời Form vào Order mà không tự chọn khi nhân viên gửi trùng.

        - Chỉ Mã NV có đúng 1 lượt hợp lệ mới được nhập tự động.
        - Mã NV gửi >=2 lượt không được ghi Order, vì vậy vẫn hiện CHƯA ORDER.
        - Mã NV không có trong file cũng CHƯA ORDER.
        - Các ô quản lý đã sửa tay (is_manual=1) được giữ nguyên khi nhập lại Form.
        """
        self.backup("nhap_cau_tra_loi_form")
        snapshot = self._current_order_snapshot(week_id)
        shifts = self.list_shift_names(active_only=True, order_only=True)
        manual_flags = self.get_order_manual_flags(week_id)

        duplicate_codes = [str(code) for code in parsed.get("duplicate_codes", [])]
        invalid_rows = [str(item) for item in parsed.get("invalid_rows", [])]
        unknown_codes: list[str] = []
        inactive_codes: list[str] = []
        imported_codes: list[str] = []
        prepared: list[tuple[int, int, str, str]] = []
        preserved_manual = 0

        for item in parsed.get("valid_rows", []):
            code = str(item.get("code", "")).strip()
            employee = self.find_employee_by_code(code)
            if employee is None:
                unknown_codes.append(code)
                continue
            if str(employee["status"] or "") != "Đang làm":
                inactive_codes.append(code)
                continue
            employee_id = int(employee["id"])
            imported_codes.append(code)
            statuses = item.get("statuses", {})
            for weekday in range(7):
                for shift in shifts:
                    if (employee_id, weekday, shift) in manual_flags:
                        preserved_manual += 1
                        continue
                    status = statuses.get((weekday, shift), "CHƯA ORDER")
                    if status in ("ĐI LÀM ĐƯỢC", "NGHỈ"):
                        prepared.append((employee_id, weekday, shift, status))

        with self.transaction():
            self.conn.execute(
                "INSERT INTO order_snapshots(week_id, snapshot_json, source_filename) VALUES (?, ?, ?)",
                (week_id, json.dumps(snapshot, ensure_ascii=False), filename),
            )
            # Xóa toàn bộ dữ liệu nhập tự động cũ. Nhờ vậy người không gửi hoặc gửi trùng
            # sẽ trở lại CHƯA ORDER. Dữ liệu quản lý nhập tay được giữ nguyên.
            self.conn.execute("DELETE FROM order_entries WHERE week_id=? AND is_manual=0", (week_id,))
            self.conn.executemany(
                """
                INSERT INTO order_entries(week_id, employee_id, weekday, shift, status, is_manual)
                VALUES (?, ?, ?, ?, ?, 0)
                ON CONFLICT(week_id, employee_id, weekday, shift) DO NOTHING
                """,
                [(week_id, employee_id, weekday, shift, status) for employee_id, weekday, shift, status in prepared],
            )
            self.conn.execute(
                "INSERT INTO order_import_batches(week_id, filename, row_count) VALUES (?, ?, ?)",
                (week_id, filename, len(imported_codes)),
            )

        active_codes = {str(row["code"]).casefold(): str(row["code"]) for row in self.list_employees(status="Đang làm")}
        responded_keys = {
            str(item.get("code", "")).casefold()
            for item in parsed.get("valid_rows", [])
            if str(item.get("code", "")).strip()
        }
        responded_keys.update(code.casefold() for code in duplicate_codes)
        no_response_codes = [code for key, code in active_codes.items() if key not in responded_keys]

        return {
            "imported": len(imported_codes),
            "imported_codes": imported_codes,
            "duplicates": duplicate_codes,
            "invalid_rows": invalid_rows,
            "unknown": unknown_codes,
            "inactive": inactive_codes,
            "no_response": no_response_codes,
            "manual_preserved": preserved_manual,
            "submission_count": int(parsed.get("submission_count", 0) or 0),
        }

    def restore_last_order(self, week_id: int) -> bool:
        row = self.conn.execute(
            "SELECT id, snapshot_json FROM order_snapshots WHERE week_id=? ORDER BY id DESC LIMIT 1",
            (week_id,),
        ).fetchone()
        if row is None:
            return False
        snapshot = json.loads(row["snapshot_json"])
        self.backup("khoi_phuc_order")
        with self.transaction():
            self.conn.execute("DELETE FROM order_entries WHERE week_id=?", (week_id,))
            self.conn.executemany(
                "INSERT INTO order_entries(week_id, employee_id, weekday, shift, status, is_manual) VALUES (?, ?, ?, ?, ?, ?)",
                [
                    (week_id, int(item["employee_id"]), int(item["weekday"]), item["shift"], item["status"], int(item.get("is_manual", 0)))
                    for item in snapshot
                ],
            )
            self.conn.execute("DELETE FROM order_snapshots WHERE id=?", (row["id"],))
        return True

    def clear_order(self, week_id: int) -> None:
        self.backup("xoa_order_tuan")
        snapshot = self._current_order_snapshot(week_id)
        with self.transaction():
            self.conn.execute(
                "INSERT INTO order_snapshots(week_id, snapshot_json, source_filename) VALUES (?, ?, ?)",
                (week_id, json.dumps(snapshot, ensure_ascii=False), "Xóa dữ liệu tuần"),
            )
            self.conn.execute("DELETE FROM order_entries WHERE week_id=?", (week_id,))

    def get_order_matrix(self, week_id: int) -> dict[int, dict[tuple[int, str], str]]:
        rows = self.conn.execute(
            "SELECT employee_id, weekday, shift, status FROM order_entries WHERE week_id=?",
            (week_id,),
        )
        result: dict[int, dict[tuple[int, str], str]] = {}
        for row in rows:
            result.setdefault(int(row["employee_id"]), {})[(int(row["weekday"]), row["shift"])] = row["status"]
        return result

    def get_order_manual_flags(self, week_id: int) -> set[tuple[int, int, str]]:
        rows = self.conn.execute(
            "SELECT employee_id, weekday, shift FROM order_entries WHERE week_id=? AND is_manual=1",
            (week_id,),
        )
        return {(int(row["employee_id"]), int(row["weekday"]), str(row["shift"])) for row in rows}

    def order_manual_count(self, week_id: int) -> int:
        row = self.conn.execute(
            "SELECT COUNT(*) AS n FROM order_entries WHERE week_id=? AND is_manual=1",
            (week_id,),
        ).fetchone()
        return int(row["n"] or 0)

    def set_order_cells(
        self,
        week_id: int,
        changes: list[tuple[int, int, str, str, bool]],
    ) -> None:
        """Lưu tức thời một nhóm ô Order.

        Mỗi phần tử: (employee_id, weekday, shift, status, is_manual).
        CHƯA ORDER không do quản lý sửa được biểu diễn bằng việc không có bản ghi.
        """
        allowed = {"CHƯA ORDER", "ĐI LÀM ĐƯỢC", "NGHỈ"}
        with self.transaction():
            for employee_id, weekday, shift, status, is_manual in changes:
                if status not in allowed:
                    raise DatabaseError(f"Trạng thái Order không hợp lệ: {status}")
                if status == "CHƯA ORDER" and not is_manual:
                    self.conn.execute(
                        "DELETE FROM order_entries WHERE week_id=? AND employee_id=? AND weekday=? AND shift=?",
                        (week_id, int(employee_id), int(weekday), shift),
                    )
                    continue
                self.conn.execute(
                    """
                    INSERT INTO order_entries(week_id, employee_id, weekday, shift, status, is_manual, imported_at)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(week_id, employee_id, weekday, shift) DO UPDATE SET
                        status=excluded.status,
                        is_manual=excluded.is_manual,
                        imported_at=CURRENT_TIMESTAMP
                    """,
                    (week_id, int(employee_id), int(weekday), shift, status, int(bool(is_manual))),
                )

    def save_order_manual_matrix(
        self,
        week_id: int,
        values: dict[int, dict[tuple[int, str], str]],
    ) -> int:
        """Lưu bảng Order đã được quản lý chỉnh trực tiếp.

        CHƯA ORDER được biểu diễn bằng việc không có bản ghi tại ô đó.
        Nhờ vậy một nhân viên có thể có dữ liệu ở một số ca và chưa có dữ liệu ở
        những ca còn lại.
        """
        self.backup("luu_order_thu_cong")
        snapshot = self._current_order_snapshot(week_id)
        prepared: list[tuple[int, int, str, str]] = []
        employee_ids_with_data: set[int] = set()
        for employee_id, cells in values.items():
            for (weekday, shift), status in cells.items():
                if status == "CHƯA ORDER":
                    continue
                if status not in ("ĐI LÀM ĐƯỢC", "NGHỈ"):
                    raise DatabaseError(f"Trạng thái Order không hợp lệ: {status}")
                prepared.append((int(employee_id), int(weekday), shift, status))
                employee_ids_with_data.add(int(employee_id))
        with self.transaction():
            self.conn.execute(
                "INSERT INTO order_snapshots(week_id, snapshot_json, source_filename) VALUES (?, ?, ?)",
                (week_id, json.dumps(snapshot, ensure_ascii=False), "Chỉnh thủ công trong phần mềm"),
            )
            self.conn.execute("DELETE FROM order_entries WHERE week_id=?", (week_id,))
            self.conn.executemany(
                "INSERT INTO order_entries(week_id, employee_id, weekday, shift, status, is_manual) VALUES (?, ?, ?, ?, ?, 1)",
                [(week_id, employee_id, weekday, shift, status) for employee_id, weekday, shift, status in prepared],
            )
            self.conn.execute(
                "INSERT INTO order_import_batches(week_id, filename, row_count) VALUES (?, ?, ?)",
                (week_id, "CHỈNH THỦ CÔNG TRONG PHẦN MỀM", len(employee_ids_with_data)),
            )
        return len(employee_ids_with_data)

    def order_summary(self, week_id: int) -> dict[str, int]:
        active = self.employee_count(active_only=True)
        rows = self.conn.execute(
            """
            SELECT COUNT(DISTINCT CASE WHEN oe.status!='CHƯA ORDER' THEN oe.employee_id END) AS with_data,
                   SUM(CASE WHEN oe.status='ĐI LÀM ĐƯỢC' THEN 1 ELSE 0 END) AS available,
                   SUM(CASE WHEN oe.status='NGHỈ' THEN 1 ELSE 0 END) AS off_count
            FROM order_entries oe
            JOIN employees e ON e.id=oe.employee_id
            WHERE oe.week_id=? AND e.status='Đang làm'
            """,
            (week_id,),
        ).fetchone()
        with_data = int(rows["with_data"] or 0)
        return {
            "active": active,
            "with_data": with_data,
            "without_data": max(0, active - with_data),
            "available": int(rows["available"] or 0),
            "off": int(rows["off_count"] or 0),
        }

    def latest_order_import(self, week_id: int) -> sqlite3.Row | None:
        return self.conn.execute(
            "SELECT * FROM order_import_batches WHERE week_id=? ORDER BY id DESC LIMIT 1",
            (week_id,),
        ).fetchone()

    def staffing_nonzero_count(self) -> int:
        row = self.conn.execute(
            "SELECT COUNT(*) AS n FROM staffing_requirements WHERE required_count > 0"
        ).fetchone()
        return int(row["n"])

    # ---------------- BƯỚC 7: LỊCH CỐ ĐỊNH ----------------

    def list_fixed_schedule_members(self) -> list[sqlite3.Row]:
        return list(
            self.conn.execute(
                """
                SELECT e.*,
                       COALESCE((
                           SELECT GROUP_CONCAT(COALESCE(NULLIF(b.display_code,''), b.code), ', ')
                           FROM employee_branches eb
                           JOIN branches b ON b.id=eb.branch_id
                           WHERE eb.employee_id=e.id
                       ), '') AS branches,
                       COALESCE((
                           SELECT GROUP_CONCAT(er.role, ', ')
                           FROM employee_roles er
                           WHERE er.employee_id=e.id
                       ), '') AS roles
                FROM fixed_schedule_members fsm
                JOIN employees e ON e.id=fsm.employee_id
                ORDER BY e.name COLLATE NOCASE
                """
            )
        )

    def list_available_fixed_schedule_employees(self) -> list[sqlite3.Row]:
        return list(
            self.conn.execute(
                """
                SELECT e.*,
                       COALESCE((
                           SELECT GROUP_CONCAT(COALESCE(NULLIF(b.display_code,''), b.code), ', ')
                           FROM employee_branches eb
                           JOIN branches b ON b.id=eb.branch_id
                           WHERE eb.employee_id=e.id
                       ), '') AS branches,
                       COALESCE((
                           SELECT GROUP_CONCAT(er.role, ', ')
                           FROM employee_roles er
                           WHERE er.employee_id=e.id
                       ), '') AS roles
                FROM employees e
                WHERE e.status='Đang làm'
                  AND NOT EXISTS (
                      SELECT 1 FROM fixed_schedule_members fsm WHERE fsm.employee_id=e.id
                  )
                ORDER BY e.name COLLATE NOCASE
                """
            )
        )

    def add_fixed_schedule_members(self, employee_ids: Iterable[int]) -> int:
        ids = list(dict.fromkeys(int(item) for item in employee_ids))
        if not ids:
            return 0
        with self.transaction():
            before = self.conn.total_changes
            self.conn.executemany(
                "INSERT OR IGNORE INTO fixed_schedule_members(employee_id) VALUES (?)",
                [(employee_id,) for employee_id in ids],
            )
            added = self.conn.total_changes - before
        return int(added)

    def remove_fixed_schedule_members(self, employee_ids: Iterable[int]) -> int:
        """Xóa nhân viên khỏi mẫu lịch cố định và toàn bộ ô cố định đi kèm.

        Các bản thử trước chỉ xóa dòng trong ``fixed_schedule_members`` nhưng
        để lại các ô trong ``fixed_schedule_entries``. Những ô mồ côi đó vẫn
        bị đọc khi chạy xếp lịch tự động. Vì vậy phải xóa cả hai bảng trong
        cùng một giao dịch.
        """
        ids = list(dict.fromkeys(int(item) for item in employee_ids))
        if not ids:
            return 0
        placeholders = ",".join("?" for _ in ids)
        existing_row = self.conn.execute(
            f"SELECT COUNT(*) AS n FROM fixed_schedule_members WHERE employee_id IN ({placeholders})",
            ids,
        ).fetchone()
        existing = int(existing_row["n"] or 0)
        if existing == 0:
            return 0
        self.backup("xoa_nhan_vien_lich_co_dinh")
        with self.transaction():
            self.conn.execute(
                f"DELETE FROM fixed_schedule_entries WHERE employee_id IN ({placeholders})",
                ids,
            )
            self.conn.execute(
                f"DELETE FROM fixed_schedule_members WHERE employee_id IN ({placeholders})",
                ids,
            )
        return existing

    def _cleanup_orphan_fixed_schedule_entries(self) -> int:
        """Tự dọn ô lịch cố định còn sót từ database của các bản cũ."""
        row = self.conn.execute(
            """
            SELECT COUNT(*) AS n
            FROM fixed_schedule_entries fse
            LEFT JOIN fixed_schedule_members fsm ON fsm.employee_id=fse.employee_id
            WHERE fsm.employee_id IS NULL
            """
        ).fetchone()
        count = int(row["n"] or 0)
        if count == 0:
            return 0
        self.backup("don_lich_co_dinh_mo_coi")
        with self.transaction():
            self.conn.execute(
                """
                DELETE FROM fixed_schedule_entries
                WHERE employee_id NOT IN (SELECT employee_id FROM fixed_schedule_members)
                """
            )
        return count

    def get_fixed_schedule_matrix(self) -> dict[int, dict[tuple[int, str], dict[str, Any]]]:
        rows = self.conn.execute(
            """
            SELECT fse.employee_id, fse.weekday, fse.shift, fse.role,
                   b.id AS branch_id, COALESCE(NULLIF(b.display_code,''), b.code) AS branch_code
            FROM fixed_schedule_entries fse
            JOIN fixed_schedule_members fsm ON fsm.employee_id=fse.employee_id
            JOIN branches b ON b.id=fse.branch_id
            """
        )
        result: dict[int, dict[tuple[int, str], dict[str, Any]]] = {}
        for row in rows:
            result.setdefault(int(row["employee_id"]), {})[(int(row["weekday"]), row["shift"])] = {
                "branch_id": int(row["branch_id"]),
                "branch_code": row["branch_code"],
                "role": row["role"],
            }
        return result

    def replace_fixed_schedule_entries(
        self,
        values: dict[int, dict[tuple[int, str], tuple[str, str] | None]],
    ) -> None:
        """Thay toàn bộ lịch cố định của các nhân viên xuất hiện trong values."""
        self.backup("luu_lich_co_dinh")
        with self.transaction():
            for employee_id, cells in values.items():
                member = self.conn.execute(
                    "SELECT 1 FROM fixed_schedule_members WHERE employee_id=?",
                    (employee_id,),
                ).fetchone()
                if member is None:
                    raise DatabaseError("Nhân viên chưa được thêm vào danh sách lịch cố định.")
                employee = self.get_employee(employee_id)
                if employee is None:
                    raise DatabaseError("Không tìm thấy nhân viên.")
                allowed_branches = set(employee["branches"])
                allowed_roles = set(employee["roles"])
                visible_shifts = sorted({shift for (_weekday, shift) in cells})
                if visible_shifts:
                    placeholders = ",".join("?" for _ in visible_shifts)
                    self.conn.execute(
                        f"DELETE FROM fixed_schedule_entries WHERE employee_id=? AND shift IN ({placeholders})",
                        (employee_id, *visible_shifts),
                    )
                for (weekday, shift), assignment in cells.items():
                    if assignment is None:
                        continue
                    branch_code, role = assignment
                    branch = self._resolve_branch_row(branch_code)
                    if branch is None:
                        raise DatabaseError(f"Cơ sở không hợp lệ: {branch_code}")
                    allowed_aliases = {str(item).casefold() for item in allowed_branches}
                    branch_aliases = {
                        str(branch["code"]).casefold(),
                        str(branch["system_code"] or branch["code"]).casefold(),
                        str(branch["display_code"] or branch["code"]).casefold(),
                    }
                    if not allowed_aliases.intersection(branch_aliases):
                        raise DatabaseError(f"{employee['name']} không được khai báo làm tại {branch_code}.")
                    if role not in allowed_roles:
                        raise DatabaseError(f"{employee['name']} không được khai báo vị trí {role}.")
                    self.conn.execute(
                        """
                        INSERT INTO fixed_schedule_entries(employee_id, weekday, shift, branch_id, role)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (employee_id, weekday, shift, int(branch["id"]), role),
                    )

    def get_fixed_schedule_cell(
        self,
        employee_id: int,
        weekday: int,
        shift: str,
    ) -> dict[str, Any] | None:
        row = self.conn.execute(
            """
            SELECT fse.employee_id, fse.weekday, fse.shift, fse.role,
                   b.id AS branch_id,
                   COALESCE(NULLIF(b.display_code,''), b.code) AS branch_code
            FROM fixed_schedule_entries fse
            JOIN fixed_schedule_members fsm ON fsm.employee_id=fse.employee_id
            JOIN branches b ON b.id=fse.branch_id
            WHERE fse.employee_id=? AND fse.weekday=? AND fse.shift=?
            """,
            (employee_id, weekday, shift),
        ).fetchone()
        return None if row is None else dict(row)

    def save_fixed_schedule_cell(
        self,
        employee_id: int,
        weekday: int,
        shift: str,
        branch_code: str | None,
        role: str | None,
    ) -> None:
        member = self.conn.execute(
            "SELECT 1 FROM fixed_schedule_members WHERE employee_id=?", (employee_id,)
        ).fetchone()
        if member is None:
            raise DatabaseError("Nhân viên chưa được thêm vào danh sách lịch cố định.")
        employee = self.get_employee(employee_id)
        if employee is None:
            raise DatabaseError("Không tìm thấy nhân viên.")
        with self.transaction():
            if branch_code is None or role is None:
                self.conn.execute(
                    "DELETE FROM fixed_schedule_entries WHERE employee_id=? AND weekday=? AND shift=?",
                    (employee_id, weekday, shift),
                )
                return
            branch = self._resolve_branch_row(branch_code)
            if branch is None:
                raise DatabaseError(f"Cơ sở không hợp lệ: {branch_code}")
            aliases = {str(item).casefold() for item in employee["branches"]}
            branch_aliases = {
                str(branch["code"]).casefold(),
                str(branch["system_code"] or branch["code"]).casefold(),
                str(branch["display_code"] or branch["code"]).casefold(),
            }
            if not aliases.intersection(branch_aliases):
                raise DatabaseError(f"{employee['name']} không được khai báo làm tại {branch_code}.")
            if role not in set(employee["roles"]):
                raise DatabaseError(f"{employee['name']} không được khai báo vị trí {role}.")
            if not self.branch_uses_shift(int(branch["id"]), shift):
                raise DatabaseError(f"Cơ sở {branch_code} đang tắt ca {shift}.")
            self.conn.execute(
                """
                INSERT INTO fixed_schedule_entries(employee_id, weekday, shift, branch_id, role, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(employee_id, weekday, shift) DO UPDATE SET
                    branch_id=excluded.branch_id, role=excluded.role, updated_at=CURRENT_TIMESTAMP
                """,
                (employee_id, weekday, shift, int(branch["id"]), role),
            )

    def fixed_schedule_summary(self) -> dict[str, int]:
        member_row = self.conn.execute("SELECT COUNT(*) AS n FROM fixed_schedule_members").fetchone()
        rows = self.conn.execute(
            """
            SELECT fse.role, COUNT(*) AS n
            FROM fixed_schedule_entries fse
            JOIN fixed_schedule_members fsm ON fsm.employee_id=fse.employee_id
            GROUP BY fse.role
            """
        ).fetchall()
        role_counts = {row["role"]: int(row["n"]) for row in rows}
        return {
            "members": int(member_row["n"] or 0),
            "total": sum(role_counts.values()),
            "Pha chế": role_counts.get("Pha chế", 0),
            "Chạy bàn": role_counts.get("Chạy bàn", 0),
        }

    # ---------------- BƯỚC 8: XẾP LỊCH LÀM TỔNG ----------------

    def week_schedule_exists(self, week_id: int) -> bool:
        row = self.conn.execute(
            "SELECT 1 FROM weekly_schedule_entries WHERE week_id=? LIMIT 1",
            (week_id,),
        ).fetchone()
        return row is not None

    def _base_status_for_cell(self, week_id: int, employee_id: int, weekday: int, shift: str) -> str:
        has_any = self.conn.execute(
            "SELECT 1 FROM order_entries WHERE week_id=? AND employee_id=? LIMIT 1",
            (week_id, employee_id),
        ).fetchone()
        if has_any is None:
            return "CHƯA ORDER"
        row = self.conn.execute(
            "SELECT status FROM order_entries WHERE week_id=? AND employee_id=? AND weekday=? AND shift=?",
            (week_id, employee_id, weekday, shift),
        ).fetchone()
        if row is None:
            return "CHƯA ORDER"
        if row["status"] == "NGHỈ":
            return "NGHỈ"
        if row["status"] == "CHƯA ORDER":
            return "CHƯA ORDER"
        return "ĐI LÀM ĐƯỢC"

    @staticmethod
    def _state_from_base(base_status: str) -> str:
        if base_status == "NGHỈ":
            return "NGHỈ"
        if base_status == "CHƯA ORDER":
            return "CHƯA ORDER"
        return "TRỐNG"

    def apply_auto_schedule(self, week_id: int) -> dict[str, int]:
        """Bước 1: Order; Bước 2: lịch cố định. Không tự lấp định biên."""
        if self.is_week_closed(week_id):
            raise DatabaseError("Lịch tuần đã chốt. Hãy mở lại để chỉnh sửa trước khi xếp lại tự động.")
        self.backup("xep_lich_tu_dong")
        employees = self.list_employees(status="Đang làm")
        order_matrix = self.get_order_matrix(week_id)
        fixed_matrix = self.get_fixed_schedule_matrix()
        prepared: list[tuple[Any, ...]] = []
        fixed_count = 0
        off_count = 0
        no_order_count = 0
        for employee in employees:
            employee_id = int(employee["id"])
            has_order = employee_id in order_matrix
            for weekday in range(7):
                for shift in self.list_shift_names(active_only=True, order_only=True):
                    if not has_order:
                        base_status = "CHƯA ORDER"
                    else:
                        raw = order_matrix[employee_id].get((weekday, shift))
                        if raw is None:
                            base_status = "CHƯA ORDER"
                        elif raw == "NGHỈ":
                            base_status = "NGHỈ"
                        elif raw == "CHƯA ORDER":
                            base_status = "CHƯA ORDER"
                        else:
                            base_status = "ĐI LÀM ĐƯỢC"
                    state = self._state_from_base(base_status)
                    branch_id = None
                    role = None
                    source = "ORDER"
                    fixed = fixed_matrix.get(employee_id, {}).get((weekday, shift))
                    # Quy tắc mới: lịch cố định được áp dụng cho mọi ca KHÔNG bị
                    # đánh NGHỈ, kể cả CHƯA ORDER hoặc nhân viên chưa có dữ liệu.
                    if (
                        base_status != "NGHỈ"
                        and fixed is not None
                        and self.branch_uses_shift(int(fixed["branch_id"]), shift)
                    ):
                        state = "ĐÃ XẾP"
                        branch_id = fixed["branch_id"]
                        role = fixed["role"]
                        source = "FIXED"
                        fixed_count += 1
                    if base_status == "NGHỈ":
                        off_count += 1
                    elif base_status == "CHƯA ORDER":
                        no_order_count += 1
                    prepared.append(
                        (
                            week_id,
                            employee_id,
                            weekday,
                            shift,
                            base_status,
                            state,
                            branch_id,
                            role,
                            source,
                            0,
                        )
                    )
        with self.transaction():
            self.conn.execute("DELETE FROM weekly_schedule_entries WHERE week_id=?", (week_id,))
            self.conn.executemany(
                """
                INSERT INTO weekly_schedule_entries(
                    week_id, employee_id, weekday, shift, base_status, state,
                    branch_id, role, source, is_manual
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                prepared,
            )
        return {
            "employees": len(employees),
            "fixed": fixed_count,
            "off": off_count,
            "no_order": no_order_count,
        }

    def reapply_order_to_schedule(self, week_id: int) -> dict[str, int]:
        """Đọc lại Order vào Lịch tổng nhưng không xóa các ca đã xếp.

        Các ô chưa xếp sẽ đổi trạng thái theo Order mới. Các ô đang ĐÃ XẾP
        giữ nguyên cơ sở/vị trí; nếu Order mới là NGHỈ hoặc CHƯA ORDER thì chỉ
        cập nhật base_status để phần Cảnh báo phát hiện xung đột.
        """
        if self.is_week_closed(week_id):
            raise DatabaseError("Lịch tuần đã chốt. Hãy mở lại để cập nhật Order.")
        if not self.week_schedule_exists(week_id):
            raise DatabaseError("Tuần chưa có Lịch tổng để cập nhật.")
        self.backup("ghi_de_order_vao_lich_tong")

        employees = self.list_employees(status="Đang làm")
        shifts = self.list_shift_names(active_only=True, order_only=True)
        existing = self.get_week_schedule_matrix(week_id)
        fixed_matrix = self.get_fixed_schedule_matrix()
        updated = 0
        inserted = 0
        assigned_preserved = 0
        conflicts = 0

        with self.transaction():
            for employee in employees:
                employee_id = int(employee["id"])
                employee_cells = existing.get(employee_id, {})
                for weekday in range(7):
                    for shift in shifts:
                        base_status = self._base_status_for_cell(week_id, employee_id, weekday, shift)
                        current = employee_cells.get((weekday, shift))
                        if current is not None:
                            if current.get("state") == "ĐÃ XẾP":
                                assigned_preserved += 1
                                if base_status in ("NGHỈ", "CHƯA ORDER"):
                                    conflicts += 1
                                self.conn.execute(
                                    """
                                    UPDATE weekly_schedule_entries
                                    SET base_status=?, updated_at=CURRENT_TIMESTAMP
                                    WHERE week_id=? AND employee_id=? AND weekday=? AND shift=?
                                    """,
                                    (base_status, week_id, employee_id, weekday, shift),
                                )
                            else:
                                state = self._state_from_base(base_status)
                                self.conn.execute(
                                    """
                                    UPDATE weekly_schedule_entries
                                    SET base_status=?, state=?, branch_id=NULL, role=NULL,
                                        source='ORDER', is_manual=0, updated_at=CURRENT_TIMESTAMP
                                    WHERE week_id=? AND employee_id=? AND weekday=? AND shift=?
                                    """,
                                    (base_status, state, week_id, employee_id, weekday, shift),
                                )
                            updated += 1
                            continue

                        state = self._state_from_base(base_status)
                        branch_id = None
                        role = None
                        source = "ORDER"
                        fixed = fixed_matrix.get(employee_id, {}).get((weekday, shift))
                        if (
                            base_status != "NGHỈ"
                            and fixed is not None
                            and self.branch_uses_shift(int(fixed["branch_id"]), shift)
                        ):
                            state = "ĐÃ XẾP"
                            branch_id = int(fixed["branch_id"])
                            role = fixed["role"]
                            source = "FIXED"
                            assigned_preserved += 1
                            if base_status == "CHƯA ORDER":
                                conflicts += 1
                        self.conn.execute(
                            """
                            INSERT INTO weekly_schedule_entries(
                                week_id, employee_id, weekday, shift, base_status, state,
                                branch_id, role, source, is_manual, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
                            """,
                            (week_id, employee_id, weekday, shift, base_status, state, branch_id, role, source),
                        )
                        inserted += 1

        return {
            "updated": updated,
            "inserted": inserted,
            "assigned_preserved": assigned_preserved,
            "conflicts": conflicts,
        }

    def clear_week_schedule(self, week_id: int) -> None:
        if self.is_week_closed(week_id):
            raise DatabaseError("Lịch tuần đã chốt. Hãy mở lại để chỉnh sửa trước khi xóa.")
        self.backup("xoa_lich_tong_tuan")
        with self.transaction():
            self.conn.execute("DELETE FROM weekly_schedule_entries WHERE week_id=?", (week_id,))

    def get_week_schedule_matrix(self, week_id: int) -> dict[int, dict[tuple[int, str], dict[str, Any]]]:
        rows = self.conn.execute(
            """
            SELECT wse.employee_id, wse.weekday, wse.shift, wse.base_status, wse.state,
                   wse.role, wse.source, wse.is_manual,
                   b.id AS branch_id, COALESCE(NULLIF(b.display_code,''), b.code) AS branch_code
            FROM weekly_schedule_entries wse
            LEFT JOIN branches b ON b.id=wse.branch_id
            WHERE wse.week_id=?
            """,
            (week_id,),
        )
        result: dict[int, dict[tuple[int, str], dict[str, Any]]] = {}
        for row in rows:
            result.setdefault(int(row["employee_id"]), {})[(int(row["weekday"]), row["shift"])] = {
                "base_status": row["base_status"],
                "state": row["state"],
                "branch_id": int(row["branch_id"]) if row["branch_id"] is not None else None,
                "branch_code": row["branch_code"],
                "role": row["role"],
                "source": row["source"],
                "is_manual": bool(row["is_manual"]),
            }
        return result

    def save_manual_schedule_cell(
        self,
        week_id: int,
        employee_id: int,
        weekday: int,
        shift: str,
        branch_code: str | None,
        role: str | None,
    ) -> None:
        if self.is_week_closed(week_id):
            raise DatabaseError("Lịch tuần đã chốt. Hãy mở lại để chỉnh sửa.")
        employee = self.get_employee(employee_id)
        if employee is None:
            raise DatabaseError("Nhân viên không tồn tại.")
        # Luôn cho phép gỡ một phân công cũ, kể cả nhân viên đã chuyển sang Ngừng làm.
        # Chỉ chặn khi đang cố xếp mới một nhân viên không còn hoạt động.
        if branch_code is not None and role is not None and employee["status"] != "Đang làm":
            raise DatabaseError("Nhân viên đã ngừng làm nên không thể xếp ca mới.")
        existing = self.conn.execute(
            """
            SELECT base_status FROM weekly_schedule_entries
            WHERE week_id=? AND employee_id=? AND weekday=? AND shift=?
            """,
            (week_id, employee_id, weekday, shift),
        ).fetchone()
        base_status = existing["base_status"] if existing else self._base_status_for_cell(
            week_id, employee_id, weekday, shift
        )
        if branch_code is None or role is None:
            state = self._state_from_base(base_status)
            branch_id = None
            role_value = None
        else:
            branch = self._resolve_branch_row(branch_code)
            if branch is None:
                raise DatabaseError("Cơ sở không hợp lệ.")
            employee_branch_aliases = {str(item).casefold() for item in employee["branches"]}
            branch_aliases = {
                str(branch["code"]).casefold(),
                str(branch["system_code"] or branch["code"]).casefold(),
                str(branch["display_code"] or branch["code"]).casefold(),
            }
            if not employee_branch_aliases.intersection(branch_aliases):
                raise DatabaseError(f"Nhân viên không được khai báo làm tại cơ sở {branch_code}.")
            if role not in set(employee["roles"]):
                raise DatabaseError(f"Nhân viên không được khai báo vị trí {role}.")
            if str(branch["status"]) != "Đang hoạt động":
                raise DatabaseError("Cơ sở đang ngừng hoạt động.")
            if not self.branch_uses_shift(int(branch["id"]), shift):
                raise DatabaseError(f"Cơ sở {branch['display_code'] or branch['code']} đang tắt ca {shift}.")
            state = "ĐÃ XẾP"
            branch_id = int(branch["id"])
            role_value = role
        with self.transaction():
            self.conn.execute(
                """
                INSERT INTO weekly_schedule_entries(
                    week_id, employee_id, weekday, shift, base_status, state,
                    branch_id, role, source, is_manual, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', 1, CURRENT_TIMESTAMP)
                ON CONFLICT(week_id, employee_id, weekday, shift)
                DO UPDATE SET
                    base_status=excluded.base_status,
                    state=excluded.state,
                    branch_id=excluded.branch_id,
                    role=excluded.role,
                    source='MANUAL',
                    is_manual=1,
                    updated_at=CURRENT_TIMESTAMP
                """,
                (
                    week_id,
                    employee_id,
                    weekday,
                    shift,
                    base_status,
                    state,
                    branch_id,
                    role_value,
                ),
            )

    def restore_week_schedule_cell(
        self,
        week_id: int,
        employee_id: int,
        weekday: int,
        shift: str,
        snapshot: dict[str, Any],
    ) -> None:
        if self.is_week_closed(week_id):
            raise DatabaseError("Lịch tuần đã chốt. Hãy mở lại để chỉnh sửa.")
        branch_id = snapshot.get("branch_id")
        with self.transaction():
            self.conn.execute(
                """
                INSERT INTO weekly_schedule_entries(
                    week_id, employee_id, weekday, shift, base_status, state,
                    branch_id, role, source, is_manual, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(week_id, employee_id, weekday, shift) DO UPDATE SET
                    base_status=excluded.base_status, state=excluded.state,
                    branch_id=excluded.branch_id, role=excluded.role, source=excluded.source,
                    is_manual=excluded.is_manual, updated_at=CURRENT_TIMESTAMP
                """,
                (
                    week_id, employee_id, weekday, shift,
                    snapshot.get("base_status", "CHƯA ORDER"),
                    snapshot.get("state", "CHƯA ORDER"),
                    branch_id, snapshot.get("role"), snapshot.get("source", "ORDER"),
                    int(bool(snapshot.get("is_manual", False))),
                ),
            )

    def week_schedule_summary(self, week_id: int) -> dict[str, Any]:
        requirements = self.staffing_requirements_for_week(week_id)

        actual: dict[tuple[str, int, str], dict[str, Any]] = {}
        rows = self.conn.execute(
            """
            SELECT b.code AS branch_code, wse.weekday, wse.shift, wse.role,
                   e.rank, COUNT(DISTINCT wse.employee_id) AS n
            FROM weekly_schedule_entries wse
            JOIN branches b ON b.id=wse.branch_id
            JOIN employees e ON e.id=wse.employee_id
            WHERE wse.week_id=? AND wse.state='ĐÃ XẾP'
            GROUP BY b.code, wse.weekday, wse.shift, wse.role, e.rank
            """,
            (week_id,),
        )
        for row in rows:
            key = (row["branch_code"], int(row["weekday"]), row["shift"])
            bucket = actual.setdefault(
                key,
                {"actual": 0, "roles": {role: 0 for role in ROLES}, "senior": 0},
            )
            count = int(row["n"])
            bucket["actual"] += count
            if row["role"] in bucket["roles"]:
                bucket["roles"][row["role"]] += count
            if row["rank"] in ("Quản lý", "Cấp 1"):
                bucket["senior"] += count

        branch_result: dict[tuple[str, int, str], dict[str, Any]] = {}
        chain_result: dict[tuple[int, str], dict[str, int]] = {}
        for branch in self.list_branches(active_only=False):
            branch_code = str(branch["code"])
            for weekday in range(7):
                for shift in self.list_shift_names(active_only=False):
                    key = (branch_code, weekday, shift)
                    a = actual.get(key, {"actual": 0, "roles": {role: 0 for role in ROLES}, "senior": 0})
                    role_required = {
                        role: requirements.get((branch_code, weekday, shift, role), 0) for role in ROLES
                    }
                    required = sum(role_required.values())
                    branch_result[key] = {
                        "actual": int(a["actual"]),
                        "required": required,
                        "roles": dict(a["roles"]),
                        "role_required": role_required,
                        "senior": int(a["senior"]),
                    }
                    chain = chain_result.setdefault((weekday, shift), {"actual": 0, "required": 0})
                    chain["actual"] += int(a["actual"])
                    chain["required"] += required
        return {"branches": branch_result, "chain": chain_result}

    def current_staffing_requirements(self) -> dict[tuple[str, int, str, str], int]:
        rows = self.conn.execute(
            """
            SELECT b.code AS branch_code, sr.weekday, sr.shift, sr.role, sr.required_count
            FROM staffing_requirements sr JOIN branches b ON b.id=sr.branch_id
            """
        )
        return {
            (row["branch_code"], int(row["weekday"]), row["shift"], row["role"]): int(row["required_count"])
            for row in rows
        }

    @staticmethod
    def _all_staffing_to_json(values: dict[tuple[str, int, str, str], int]) -> dict[str, int]:
        return {f"{branch}|{weekday}|{shift}|{role}": int(count) for (branch, weekday, shift, role), count in values.items()}

    @staticmethod
    def _all_staffing_from_json(values: dict[str, int]) -> dict[tuple[str, int, str, str], int]:
        result: dict[tuple[str, int, str, str], int] = {}
        for key, count in values.items():
            branch, weekday, shift, role = key.split("|", 3)
            result[(branch, int(weekday), shift, role)] = int(count)
        return result

    def schedule_closure(self, week_id: int) -> sqlite3.Row | None:
        return self.conn.execute(
            "SELECT week_id, status, closed_at, staffing_snapshot_json, updated_at FROM schedule_closures WHERE week_id=?",
            (week_id,),
        ).fetchone()

    def week_schedule_status(self, week_id: int) -> str:
        row = self.schedule_closure(week_id)
        return row["status"] if row else "ĐANG XẾP"

    def is_week_closed(self, week_id: int) -> bool:
        return self.week_schedule_status(week_id) == "ĐÃ CHỐT"

    def staffing_requirements_for_week(self, week_id: int) -> dict[tuple[str, int, str, str], int]:
        row = self.schedule_closure(week_id)
        if row and row["status"] == "ĐÃ CHỐT" and row["staffing_snapshot_json"]:
            try:
                return self._all_staffing_from_json(json.loads(row["staffing_snapshot_json"]))
            except (TypeError, ValueError, json.JSONDecodeError):
                pass
        return self.current_staffing_requirements()

    def close_week_schedule(self, week_id: int) -> str:
        if not self.week_schedule_exists(week_id):
            raise DatabaseError("Tuần này chưa có Lịch tổng để chốt.")
        self.backup("chot_lich_tuan")
        snapshot = json.dumps(
            self._all_staffing_to_json(self.current_staffing_requirements()),
            ensure_ascii=False,
        )
        closed_at = datetime.now().isoformat(timespec="seconds")
        with self.transaction():
            self.conn.execute(
                """
                INSERT INTO schedule_closures(week_id, status, closed_at, staffing_snapshot_json, updated_at)
                VALUES (?, 'ĐÃ CHỐT', ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(week_id) DO UPDATE SET
                    status='ĐÃ CHỐT',
                    closed_at=excluded.closed_at,
                    staffing_snapshot_json=excluded.staffing_snapshot_json,
                    updated_at=CURRENT_TIMESTAMP
                """,
                (week_id, closed_at, snapshot),
            )
        return closed_at

    def reopen_week_schedule(self, week_id: int) -> None:
        if not self.week_schedule_exists(week_id):
            raise DatabaseError("Tuần này chưa có Lịch tổng.")
        self.backup("mo_lai_lich_tuan")
        with self.transaction():
            self.conn.execute(
                """
                INSERT INTO schedule_closures(week_id, status, closed_at, staffing_snapshot_json, updated_at)
                VALUES (?, 'ĐANG CHỈNH SỬA', NULL, NULL, CURRENT_TIMESTAMP)
                ON CONFLICT(week_id) DO UPDATE SET
                    status='ĐANG CHỈNH SỬA',
                    closed_at=NULL,
                    staffing_snapshot_json=NULL,
                    updated_at=CURRENT_TIMESTAMP
                """,
                (week_id,),
            )

    def branch_assignments(
        self, week_id: int, branch_code: str
    ) -> dict[tuple[int, str, str], list[dict[str, Any]]]:
        rows = self.conn.execute(
            """
            SELECT wse.employee_id, wse.weekday, wse.shift, wse.role, wse.base_status,
                   wse.source, wse.is_manual, e.code, e.name, e.rank
            FROM weekly_schedule_entries wse
            JOIN branches b ON b.id=wse.branch_id
            JOIN employees e ON e.id=wse.employee_id
            WHERE wse.week_id=? AND wse.state='ĐÃ XẾP' AND b.code=?
            ORDER BY CASE e.rank WHEN 'Quản lý' THEN 0 WHEN 'Cấp 1' THEN 1 WHEN 'Cấp 2' THEN 2 ELSE 3 END,
                     e.name COLLATE NOCASE
            """,
            (week_id, branch_code),
        )
        result: dict[tuple[int, str, str], list[dict[str, Any]]] = {}
        for row in rows:
            result.setdefault((int(row["weekday"]), row["shift"], row["role"]), []).append(dict(row))
        return result

    def schedule_warning_report(self, week_id: int) -> dict[str, Any]:
        summary = self.week_schedule_summary(week_id)
        lines: list[str] = []
        counts = {
            "shortage": 0, "overstaff": 0, "role_mismatch": 0, "missing_senior": 0,
            "assigned_off": 0, "assigned_no_order": 0, "unassigned": 0, "three_shifts": 0,
        }
        for (branch, weekday, shift), data in summary["branches"].items():
            label = f"{branch} – {['T2','T3','T4','T5','T6','T7','CN'][weekday]} – {shift}"
            if data["actual"] < data["required"]:
                counts["shortage"] += 1
                lines.append(f"THIẾU TỔNG: {label}: {data['actual']}/{data['required']}")
            elif data["actual"] > data["required"]:
                counts["overstaff"] += 1
                lines.append(f"THỪA TỔNG: {label}: {data['actual']}/{data['required']}")
            role_parts = []
            for role in ROLES:
                actual_role = data["roles"][role]
                required_role = data["role_required"][role]
                if actual_role != required_role:
                    role_parts.append(f"{role} {actual_role}/{required_role}")
            if role_parts:
                counts["role_mismatch"] += 1
                lines.append(f"LỆCH VỊ TRÍ: {label}: " + ", ".join(role_parts))
            if data["actual"] > 0 and data["senior"] == 0:
                counts["missing_senior"] += 1
                lines.append(f"THIẾU CẤP 1+: {label}")

        special_rows = self.conn.execute(
            """
            SELECT e.code, e.name, wse.weekday, wse.shift, wse.base_status, b.code AS branch_code, wse.role
            FROM weekly_schedule_entries wse
            JOIN employees e ON e.id=wse.employee_id
            JOIN branches b ON b.id=wse.branch_id
            WHERE wse.week_id=? AND wse.state='ĐÃ XẾP' AND wse.base_status IN ('NGHỈ','CHƯA ORDER')
            ORDER BY e.name, wse.weekday, wse.shift
            """,
            (week_id,),
        ).fetchall()
        for row in special_rows:
            day = ['T2','T3','T4','T5','T6','T7','CN'][int(row['weekday'])]
            text = f"{row['code']} – {row['name']} – {day} {row['shift']} – {row['branch_code']} {row['role']}"
            if row["base_status"] == "NGHỈ":
                counts["assigned_off"] += 1
                lines.append("XẾP CA ĐÃ NGHỈ: " + text)
            else:
                counts["assigned_no_order"] += 1
                lines.append("XẾP KHI CHƯA ORDER: " + text)

        three_shift_rows = self.conn.execute(
            """
            SELECT e.id AS employee_id, e.code, e.name, wse.weekday, wse.shift,
                   COALESCE(NULLIF(b.display_code,''), b.code) AS branch_code, wse.role,
                   COALESCE(s.sort_order, 999) AS shift_order
            FROM weekly_schedule_entries wse
            JOIN employees e ON e.id=wse.employee_id
            LEFT JOIN branches b ON b.id=wse.branch_id
            LEFT JOIN shifts s ON s.name=wse.shift
            WHERE wse.week_id=? AND wse.state='ĐÃ XẾP'
            ORDER BY e.name COLLATE NOCASE, wse.weekday, shift_order, wse.shift
            """,
            (week_id,),
        ).fetchall()
        grouped_three: dict[tuple[int, int], list[sqlite3.Row]] = {}
        for row in three_shift_rows:
            grouped_three.setdefault((int(row["employee_id"]), int(row["weekday"])), []).append(row)
        for (_employee_id, weekday), rows in grouped_three.items():
            distinct_shifts = {str(row["shift"]) for row in rows}
            if len(distinct_shifts) < 3:
                continue
            counts["three_shifts"] += 1
            day = ['T2','T3','T4','T5','T6','T7','CN'][weekday]
            details = " + ".join(
                f"{row['shift']} {row['branch_code'] or '—'} {row['role'] or ''}".strip() for row in rows
            )
            first = rows[0]
            lines.append(f"LÀM THÔNG 3 CA: {first['code']} – {first['name']} – {day}: {details}")

        unassigned_rows = self.conn.execute(
            """
            SELECT e.code, e.name
            FROM employees e
            WHERE e.status='Đang làm' AND NOT EXISTS (
                SELECT 1 FROM weekly_schedule_entries wse
                WHERE wse.week_id=? AND wse.employee_id=e.id AND wse.state='ĐÃ XẾP'
            )
            ORDER BY e.name
            """,
            (week_id,),
        ).fetchall()
        counts["unassigned"] = len(unassigned_rows)
        for row in unassigned_rows:
            lines.append(f"CHƯA CÓ CA: {row['code']} – {row['name']}")
        return {"counts": counts, "lines": lines}


    def staffing_report_rows(self, week_id: int) -> list[dict[str, Any]]:
        """Báo cáo 4 cơ sở × 7 ngày × 3 ca theo định biên của tuần."""
        summary = self.week_schedule_summary(week_id)
        rows: list[dict[str, Any]] = []
        day_names = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
        for branch in self.list_branches(active_only=False):
            branch_code = str(branch["code"])
            branch_name = str(branch["name"])
            for weekday in range(7):
                for shift in self.list_shift_names(active_only=False):
                    data = summary["branches"][(branch_code, weekday, shift)]
                    issues: list[str] = []
                    if data["actual"] < data["required"]:
                        issues.append("THIẾU")
                    elif data["actual"] > data["required"]:
                        issues.append("THỪA")
                    for role in ROLES:
                        if data["roles"][role] != data["role_required"][role]:
                            issues.append("LỆCH VỊ TRÍ")
                            break
                    if data["actual"] > 0 and data["senior"] == 0:
                        issues.append("THIẾU CẤP 1+")
                    rows.append(
                        {
                            "branch_code": branch_code,
                            "branch_name": branch_name,
                            "weekday": weekday,
                            "day": day_names[weekday],
                            "shift": shift,
                            "actual": int(data["actual"]),
                            "required": int(data["required"]),
                            "bar_actual": int(data["roles"]["Pha chế"]),
                            "bar_required": int(data["role_required"]["Pha chế"]),
                            "floor_actual": int(data["roles"]["Chạy bàn"]),
                            "floor_required": int(data["role_required"]["Chạy bàn"]),
                            "senior": int(data["senior"]),
                            "status": "ĐỦ" if not issues else " • ".join(issues),
                        }
                    )
        return rows

    def employee_assignment_at(
        self, week_id: int, employee_id: int, weekday: int, shift: str
    ) -> dict[str, Any] | None:
        """Trả về phân công hiện tại của nhân viên tại đúng ngày/ca."""
        row = self.conn.execute(
            """
            SELECT wse.employee_id, wse.weekday, wse.shift, wse.state, wse.base_status,
                   wse.role, wse.source, wse.is_manual,
                   b.id AS branch_id, b.code AS branch_code,
                   COALESCE(NULLIF(b.display_code,''), b.code) AS branch_ui_code,
                   b.name AS branch_name
            FROM weekly_schedule_entries wse
            LEFT JOIN branches b ON b.id=wse.branch_id
            WHERE wse.week_id=? AND wse.employee_id=? AND wse.weekday=? AND wse.shift=?
            LIMIT 1
            """,
            (week_id, employee_id, weekday, shift),
        ).fetchone()
        return dict(row) if row is not None else None

    def employee_weekly_schedule_grid(self, week_id: int) -> list[dict[str, Any]]:
        """Lịch tuần theo nhân viên, gom toàn bộ ca của mỗi ngày vào một ô."""
        employees = self.list_employees(status="Đang làm")
        rows = self.conn.execute(
            """
            SELECT wse.employee_id, wse.weekday, wse.shift, wse.base_status, wse.state,
                   wse.role, wse.source, wse.is_manual,
                   b.code AS branch_code,
                   COALESCE(NULLIF(b.display_code,''), b.code) AS branch_ui_code,
                   b.name AS branch_name, s.sort_order AS shift_order
            FROM weekly_schedule_entries wse
            LEFT JOIN branches b ON b.id=wse.branch_id
            LEFT JOIN shifts s ON s.name=wse.shift COLLATE NOCASE
            WHERE wse.week_id=? AND wse.state='ĐÃ XẾP'
            ORDER BY wse.employee_id, wse.weekday, COALESCE(s.sort_order, 999), wse.shift
            """,
            (week_id,),
        ).fetchall()
        by_employee: dict[int, dict[int, list[dict[str, Any]]]] = {}
        for row in rows:
            by_employee.setdefault(int(row["employee_id"]), {}).setdefault(int(row["weekday"]), []).append(dict(row))
        result: list[dict[str, Any]] = []
        for employee in employees:
            employee_id = int(employee["id"])
            days = by_employee.get(employee_id, {})
            result.append(
                {
                    "employee_id": employee_id,
                    "code": employee["code"],
                    "name": employee["name"],
                    "rank": employee["rank"],
                    "days": {weekday: list(days.get(weekday, [])) for weekday in range(7)},
                    "total": sum(len(days.get(weekday, [])) for weekday in range(7)),
                }
            )
        return result

    def branch_weekly_compact_grid(self, week_id: int, branch_code: str) -> list[dict[str, Any]]:
        """Báo cáo lịch cơ sở dạng gọn: mỗi ca/vị trí một dòng, không tạo dòng trống thừa."""
        assignments = self.branch_assignments(week_id, branch_code)
        requirements = self.staffing_requirements_for_week(week_id)
        rows: list[dict[str, Any]] = []
        shifts = self.list_branch_shift_names(branch_code, active_only=False, enabled_only=False)
        if not shifts:
            shifts = self.list_shift_names(active_only=False)
        for shift in shifts:
            for role in ROLES:
                required_values = [int(requirements.get((branch_code, weekday, shift, role), 0)) for weekday in range(7)]
                day_assignments = [list(assignments.get((weekday, shift, role), [])) for weekday in range(7)]
                if max(required_values or [0]) == 0 and not any(day_assignments):
                    continue
                rows.append(
                    {
                        "shift": shift,
                        "role": role,
                        "required": required_values,
                        "days": day_assignments,
                    }
                )
        return rows

    def employee_schedule_report(self, week_id: int) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT e.id, e.code, e.name, e.rank,
                   SUM(CASE WHEN wse.state='ĐÃ XẾP' THEN 1 ELSE 0 END) AS total_shifts,
                   COALESCE((
                       SELECT GROUP_CONCAT(code, ', ')
                       FROM (
                           SELECT DISTINCT COALESCE(NULLIF(b2.display_code,''), b2.code) AS code
                           FROM weekly_schedule_entries w2
                           JOIN branches b2 ON b2.id=w2.branch_id
                           WHERE w2.week_id=? AND w2.employee_id=e.id AND w2.state='ĐÃ XẾP'
                           ORDER BY b2.sort_order, b2.code
                       )
                   ), '') AS assigned_branches
            FROM employees e
            LEFT JOIN weekly_schedule_entries wse
              ON wse.employee_id=e.id AND wse.week_id=?
            WHERE e.status='Đang làm'
            GROUP BY e.id, e.code, e.name, e.rank
            ORDER BY CASE e.rank WHEN 'Quản lý' THEN 0 WHEN 'Cấp 1' THEN 1 WHEN 'Cấp 2' THEN 2 ELSE 3 END,
                     e.name COLLATE NOCASE
            """,
            (week_id, week_id),
        ).fetchall()
        count_rows = self.conn.execute(
            """
            SELECT employee_id, shift, COUNT(*) AS n
            FROM weekly_schedule_entries
            WHERE week_id=? AND state='ĐÃ XẾP'
            GROUP BY employee_id, shift
            """,
            (week_id,),
        ).fetchall()
        shift_counts: dict[int, dict[str, int]] = {}
        for row in count_rows:
            shift_counts.setdefault(int(row["employee_id"]), {})[str(row["shift"])] = int(row["n"])
        return [
            {
                "employee_id": int(row["id"]),
                "code": row["code"],
                "name": row["name"],
                "rank": row["rank"],
                "total": int(row["total_shifts"] or 0),
                "shift_counts": shift_counts.get(int(row["id"]), {}),
                # Giữ các khóa cũ để không làm hỏng dữ liệu/báo cáo của bản trước.
                "morning": shift_counts.get(int(row["id"]), {}).get("Sáng", 0),
                "afternoon": shift_counts.get(int(row["id"]), {}).get("Chiều", 0),
                "evening": shift_counts.get(int(row["id"]), {}).get("Tối", 0),
                "branches": row["assigned_branches"] or "",
            }
            for row in rows
        ]

    def order_report_details(self, week_id: int) -> dict[str, Any]:
        summary = self.order_summary(week_id)
        exceptions: list[dict[str, str]] = []
        special_rows = self.conn.execute(
            """
            SELECT e.code, e.name, wse.weekday, wse.shift, wse.base_status,
                   b.code AS branch_code, wse.role
            FROM weekly_schedule_entries wse
            JOIN employees e ON e.id=wse.employee_id
            JOIN branches b ON b.id=wse.branch_id
            WHERE wse.week_id=? AND wse.state='ĐÃ XẾP'
              AND wse.base_status IN ('NGHỈ','CHƯA ORDER')
            ORDER BY wse.base_status, e.name, wse.weekday, wse.shift
            """,
            (week_id,),
        ).fetchall()
        days = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
        for row in special_rows:
            category = "XẾP CA ĐÃ NGHỈ" if row["base_status"] == "NGHỈ" else "XẾP KHI CHƯA ORDER"
            exceptions.append(
                {
                    "category": category,
                    "detail": (
                        f"{row['code']} – {row['name']} – {days[int(row['weekday'])]} {row['shift']} – "
                        f"{row['branch_code']} {row['role']}"
                    ),
                }
            )
        missing_rows = self.conn.execute(
            """
            SELECT e.code, e.name
            FROM employees e
            WHERE e.status='Đang làm' AND NOT EXISTS (
                SELECT 1 FROM order_entries oe WHERE oe.week_id=? AND oe.employee_id=e.id
            )
            ORDER BY e.name COLLATE NOCASE
            """,
            (week_id,),
        ).fetchall()
        for row in missing_rows:
            exceptions.append(
                {"category": "CHƯA CÓ ORDER", "detail": f"{row['code']} – {row['name']}"}
            )
        return {"summary": summary, "exceptions": exceptions}

    def branch_schedule_report(self, week_id: int) -> list[dict[str, Any]]:
        staffing_rows = self.staffing_report_rows(week_id)
        result: list[dict[str, Any]] = []
        for branch in self.list_branches(active_only=False):
            branch_code = str(branch["code"])
            branch_name = str(branch["name"])
            selected = [row for row in staffing_rows if row["branch_code"] == branch_code]
            result.append(
                {
                    "branch_code": branch_code,
                    "branch_name": branch_name,
                    "total_assignments": sum(row["actual"] for row in selected),
                    "exact": sum(1 for row in selected if row["actual"] == row["required"]),
                    "shortage": sum(1 for row in selected if row["actual"] < row["required"]),
                    "overstaff": sum(1 for row in selected if row["actual"] > row["required"]),
                    "role_mismatch": sum(
                        1
                        for row in selected
                        if row["bar_actual"] != row["bar_required"]
                        or row["floor_actual"] != row["floor_required"]
                    ),
                    "missing_senior": sum(
                        1 for row in selected if row["actual"] > 0 and row["senior"] == 0
                    ),
                }
            )
        return result

    def recent_schedule_closures(self) -> list[dict[str, Any]]:
        cutoff = (date.today() - timedelta(days=30)).isoformat()
        rows = self.conn.execute(
            """
            SELECT w.id AS week_id, w.start_date, w.end_date,
                   sc.status, sc.closed_at, sc.updated_at
            FROM schedule_closures sc
            JOIN weeks w ON w.id=sc.week_id
            WHERE w.end_date >= ?
            ORDER BY w.start_date DESC
            """,
            (cutoff,),
        ).fetchall()
        result: list[dict[str, Any]] = []
        for row in rows:
            warnings = self.schedule_warning_report(int(row["week_id"]))
            result.append(
                {
                    "week_id": int(row["week_id"]),
                    "start_date": row["start_date"],
                    "end_date": row["end_date"],
                    "status": row["status"],
                    "closed_at": row["closed_at"],
                    "updated_at": row["updated_at"],
                    "warning_count": sum(int(value) for value in warnings["counts"].values()),
                }
            )
        return result

    def total_schedule_export_rows(self, week_id: int) -> list[dict[str, Any]]:
        matrix = self.get_week_schedule_matrix(week_id)
        employees = self.list_employees(status="Đang làm")
        rows: list[dict[str, Any]] = []
        for employee in employees:
            employee_id = int(employee["id"])
            cells: list[str] = []
            for weekday in range(7):
                for shift in self.list_shift_names(active_only=True, order_only=True):
                    cell = matrix.get(employee_id, {}).get((weekday, shift))
                    if not cell:
                        cells.append("CHƯA ORDER")
                    elif cell["state"] == "ĐÃ XẾP":
                        role_code = "PC" if cell["role"] == "Pha chế" else "CB"
                        cells.append(f"{cell['branch_code']}-{role_code}")
                    else:
                        cells.append(str(cell["state"]))
            rows.append(
                {
                    "code": employee["code"],
                    "name": employee["name"],
                    "rank": employee["rank"],
                    "cells": cells,
                    "total": sum(
                        1
                        for cell in matrix.get(employee_id, {}).values()
                        if cell["state"] == "ĐÃ XẾP"
                    ),
                }
            )
        return rows

    def week_schedule_page_stats(self, week_id: int) -> dict[str, int]:
        active = self.employee_count(active_only=True)
        row = self.conn.execute(
            """
            SELECT COUNT(DISTINCT CASE WHEN state='ĐÃ XẾP' THEN employee_id END) AS assigned_employees,
                   SUM(CASE WHEN state='ĐÃ XẾP' THEN 1 ELSE 0 END) AS total_assignments,
                   SUM(CASE WHEN state='NGHỈ' THEN 1 ELSE 0 END) AS off_cells,
                   SUM(CASE WHEN state='CHƯA ORDER' THEN 1 ELSE 0 END) AS no_order_cells,
                   SUM(CASE WHEN is_manual=1 THEN 1 ELSE 0 END) AS manual_cells
            FROM weekly_schedule_entries WHERE week_id=?
            """,
            (week_id,),
        ).fetchone()
        summary = self.week_schedule_summary(week_id)
        shortage = 0
        missing_senior = 0
        for data in summary["branches"].values():
            if data["actual"] < data["required"]:
                shortage += 1
            if data["actual"] > 0 and data["senior"] == 0:
                missing_senior += 1
        assigned_employees = int(row["assigned_employees"] or 0)
        return {
            "active": active,
            "assigned_employees": assigned_employees,
            "unassigned_employees": max(0, active - assigned_employees),
            "total_assignments": int(row["total_assignments"] or 0),
            "off_cells": int(row["off_cells"] or 0),
            "no_order_cells": int(row["no_order_cells"] or 0),
            "manual_cells": int(row["manual_cells"] or 0),
            "shortage": shortage,
            "missing_senior": missing_senior,
        }


    # ------------------------------------------------------------------
    # KẾ HOẠCH & DỰ BÁO NHÂN SỰ (BẢN THỬ NGHIỆM 1.2.0)
    # ------------------------------------------------------------------
    @staticmethod
    def _iso_date(value: date | str | None, field_name: str = "Ngày") -> str | None:
        if value is None or value == "":
            return None
        if isinstance(value, date):
            return value.isoformat()
        text = str(value).strip()
        try:
            return datetime.strptime(text, "%Y-%m-%d").date().isoformat()
        except ValueError as exc:
            raise DatabaseError(f"{field_name} không hợp lệ.") from exc

    @staticmethod
    def _plan_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
        if row is None:
            return None
        result = dict(row)
        try:
            shifts = json.loads(str(result.get("shifts_json") or "[]"))
        except json.JSONDecodeError:
            shifts = []
        result["shifts"] = [str(item) for item in shifts if str(item).strip()]
        return result

    def get_effective_work_plan(
        self,
        employee_id: int,
        target_date: date | str,
        *,
        include_tentative: bool = False,
    ) -> dict[str, Any] | None:
        """Lấy bản kế hoạch có ngày áp dụng gần nhất và còn hiệu lực tại ngày xem."""
        target = self._iso_date(target_date, "Ngày xem")
        certainty_sql = "" if include_tentative else "AND certainty='Đã xác nhận'"
        row = self.conn.execute(
            f"""
            SELECT *
            FROM employee_work_plans
            WHERE employee_id=?
              AND record_status='Đang áp dụng'
              AND effective_from<=?
              AND (effective_to IS NULL OR effective_to='' OR effective_to>=?)
              {certainty_sql}
            ORDER BY effective_from DESC, confirmed_at DESC, id DESC
            LIMIT 1
            """,
            (int(employee_id), target, target),
        ).fetchone()
        return self._plan_dict(row)

    def list_employee_work_plan_history(self, employee_id: int) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT *
            FROM employee_work_plans
            WHERE employee_id=?
            ORDER BY confirmed_at DESC, id DESC
            """,
            (int(employee_id),),
        ).fetchall()
        return [self._plan_dict(row) or {} for row in rows]

    def active_plan_on_start_date(self, employee_id: int, effective_from: date | str) -> list[dict[str, Any]]:
        start = self._iso_date(effective_from, "Ngày áp dụng")
        rows = self.conn.execute(
            """
            SELECT * FROM employee_work_plans
            WHERE employee_id=? AND effective_from=? AND record_status='Đang áp dụng'
            ORDER BY id DESC
            """,
            (int(employee_id), start),
        ).fetchall()
        return [self._plan_dict(row) or {} for row in rows]

    def confirm_employee_work_plan(
        self,
        employee_id: int,
        effective_from: date | str,
        effective_to: date | str | None,
        shifts: Iterable[str],
        preferred_role: str,
        plan_state: str,
        certainty: str,
        note: str = "",
        *,
        replace_existing: bool = False,
    ) -> int:
        employee = self.get_employee(int(employee_id))
        if employee is None:
            raise DatabaseError("Không tìm thấy nhân viên.")

        start = self._iso_date(effective_from, "Ngày áp dụng từ")
        end = self._iso_date(effective_to, "Ngày áp dụng đến")
        if end and start and end < start:
            raise DatabaseError("Ngày áp dụng đến không được nhỏ hơn ngày áp dụng từ.")

        valid_states = {"Đang làm", "Tạm nghỉ", "Nghỉ việc"}
        valid_certainties = {"Đã xác nhận", "Dự kiến"}
        if plan_state not in valid_states:
            raise DatabaseError("Trạng thái kế hoạch không hợp lệ.")
        if certainty not in valid_certainties:
            raise DatabaseError("Mức độ xác nhận không hợp lệ.")

        allowed_roles = list(employee.get("roles", []))
        if preferred_role not in allowed_roles:
            raise DatabaseError("Vị trí ưu tiên phải là vị trí nhân viên có thể đảm nhiệm.")

        valid_shifts = self.list_shift_names(active_only=True)
        shift_names = list(dict.fromkeys(str(item).strip() for item in shifts if str(item).strip()))
        invalid_shifts = [item for item in shift_names if item not in valid_shifts]
        if invalid_shifts:
            raise DatabaseError("Ca làm không hợp lệ: " + ", ".join(invalid_shifts))
        if plan_state == "Đang làm" and not shift_names:
            raise DatabaseError("Nhân viên đang làm phải có ít nhất một ca dự kiến.")
        if plan_state != "Đang làm":
            shift_names = []

        existing = self.active_plan_on_start_date(int(employee_id), start)
        if existing and not replace_existing:
            raise DatabaseError("Đã có kế hoạch đang áp dụng cùng ngày. Hãy xác nhận thay thế bản cũ.")

        self.backup("xac_nhan_ke_hoach_nhan_su")
        with self.transaction():
            cursor = self.conn.execute(
                """
                INSERT INTO employee_work_plans(
                    employee_id, effective_from, effective_to, shifts_json,
                    preferred_role, plan_state, certainty, note,
                    record_status, confirmed_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Đang áp dụng', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (
                    int(employee_id), start, end,
                    json.dumps(shift_names, ensure_ascii=False),
                    preferred_role, plan_state, certainty, note.strip(),
                ),
            )
            new_id = int(cursor.lastrowid)
            if existing:
                existing_ids = [int(item["id"]) for item in existing]
                placeholders = ",".join("?" for _ in existing_ids)
                self.conn.execute(
                    f"""
                    UPDATE employee_work_plans
                    SET record_status='Đã thay thế', replaced_by_id=?
                    WHERE id IN ({placeholders})
                    """,
                    [new_id, *existing_ids],
                )
            self.conn.execute(
                "UPDATE employees SET preferred_role=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (preferred_role, int(employee_id)),
            )
        return new_id

    def list_workforce_plan_employees(
        self,
        target_date: date | str,
        *,
        include_tentative: bool = False,
        search: str = "",
        employee_status: str = "",
    ) -> list[dict[str, Any]]:
        rows = self.list_employees(search=search, status=employee_status)
        result: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            plan = self.get_effective_work_plan(
                int(row["id"]), target_date, include_tentative=include_tentative
            )
            item["effective_plan"] = plan
            item["preferred_role"] = (
                (plan or {}).get("preferred_role")
                or item.get("preferred_role")
                or (str(item.get("roles") or "").split(",")[0].strip())
            )
            result.append(item)
        return result

    def workforce_forecast(
        self,
        target_date: date | str,
        *,
        include_tentative: bool = False,
    ) -> dict[str, Any]:
        target = self._iso_date(target_date, "Ngày dự báo")
        target_day = datetime.strptime(target, "%Y-%m-%d").date()
        weekday = target_day.weekday()
        shifts = self.list_shift_names(active_only=True)

        requirement_rows = self.conn.execute(
            """
            SELECT sr.shift, sr.role, SUM(sr.required_count) AS required_count
            FROM staffing_requirements sr
            JOIN branches b ON b.id=sr.branch_id
            JOIN shifts s ON s.name=sr.shift AND s.status='Đang sử dụng'
            JOIN branch_shifts bs ON bs.branch_id=sr.branch_id AND bs.shift_id=s.id AND bs.enabled=1
            WHERE sr.weekday=? AND b.status='Đang hoạt động'
            GROUP BY sr.shift, sr.role
            """,
            (weekday,),
        ).fetchall()
        requirements = {
            (str(row["shift"]), str(row["role"])): int(row["required_count"] or 0)
            for row in requirement_rows
        }

        workforce: dict[tuple[str, str], set[int]] = {
            (shift, role): set() for shift in shifts for role in ROLES
        }
        active_employees = self.list_employees(status="Đang làm")
        unplanned: list[dict[str, Any]] = []
        unavailable: list[dict[str, Any]] = []
        planned_working_ids: set[int] = set()

        for employee in active_employees:
            employee_id = int(employee["id"])
            plan = self.get_effective_work_plan(
                employee_id, target, include_tentative=include_tentative
            )
            if plan is None:
                unplanned.append({"id": employee_id, "code": employee["code"], "name": employee["name"]})
                continue
            if plan.get("plan_state") != "Đang làm":
                unavailable.append(
                    {
                        "id": employee_id,
                        "code": employee["code"],
                        "name": employee["name"],
                        "state": plan.get("plan_state"),
                    }
                )
                continue
            role = str(plan.get("preferred_role") or employee["preferred_role"] or "")
            if role not in ROLES:
                unplanned.append({"id": employee_id, "code": employee["code"], "name": employee["name"]})
                continue
            planned_working_ids.add(employee_id)
            # Một nhân viên chỉ được tính một lần cho một ca, theo Vị trí ưu tiên.
            for shift in dict.fromkeys(plan.get("shifts", [])):
                key = (str(shift), role)
                if key in workforce:
                    workforce[key].add(employee_id)

        forecast_rows: list[dict[str, Any]] = []
        for shift in shifts:
            for role in ROLES:
                required = requirements.get((shift, role), 0)
                available = len(workforce[(shift, role)])
                difference = available - required
                if difference < 0:
                    status = "THIẾU"
                elif difference > 0:
                    status = "DƯ"
                else:
                    status = "ĐỦ"
                forecast_rows.append(
                    {
                        "shift": shift,
                        "role": role,
                        "required": required,
                        "available": available,
                        "difference": difference,
                        "status": status,
                    }
                )

        return {
            "target_date": target,
            "weekday": weekday,
            "rows": forecast_rows,
            "active_employee_count": len(active_employees),
            "planned_working_count": len(planned_working_ids),
            "unplanned": unplanned,
            "unavailable": unavailable,
            "shortage_positions": sum(1 for row in forecast_rows if row["difference"] < 0),
            "total_shortage": sum(max(0, -int(row["difference"])) for row in forecast_rows),
        }
