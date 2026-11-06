"""Kết nối SQLite và nâng cấp cấu trúc dữ liệu.

Bản web dùng chung file dữ liệu với bản offline 1.7.6. Các bảng cũ giữ nguyên;
bản web chỉ THÊM bảng/cột mới (không xóa, không đổi tên) để dữ liệu cũ an toàn.
"""
from __future__ import annotations

import os
import secrets
import sqlite3
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "du_lieu"
DB_PATH = Path(os.environ.get("APP_DB", DATA_DIR / "app.sqlite3"))


def now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH, timeout=15, isolation_level=None, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA busy_timeout = 15000")
    return con


# ---------------------------------------------------------------------------
# Quyền
# ---------------------------------------------------------------------------
ROLES = ["chu", "ql_tong", "ql", "nv"]
ROLE_LABELS = {"chu": "Chủ", "ql_tong": "Quản lý tổng", "ql": "Quản lý", "nv": "Nhân viên"}

# (mã quyền, nhãn hiển thị)
PERMISSIONS = [
    ("order_ca", "Order ca"),
    ("xem_lich_minh", "Xem lịch của mình"),
    ("xem_tat_ca", "Xem order và lịch của mọi người"),
    ("xep_lich", "Xếp lịch, xem tab Cảnh báo"),
    ("chot_tuan", "Chốt tuần, mở lại tuần"),
    ("sua_order_sau_han", "Sửa order sau hạn"),
    ("quan_ly_nhan_vien", "Thêm/sửa nhân viên, email, mật khẩu tạm"),
    ("cai_gio_order", "Cài giờ mở/hết hạn order"),
    ("sua_danh_muc", "Sửa định biên, giờ ca, lịch cố định"),
    ("bao_cao", "Xem báo cáo, xếp lịch tổng, xuất Excel"),
    ("danh_gia", "Đánh giá nhân viên, voucher"),
]
PERM_KEYS = [k for k, _ in PERMISSIONS]
# Nhân viên luôn có 2 quyền này; các quyền quản trị không cấp được cho nhân viên.
NV_ALWAYS = {"order_ca", "xem_lich_minh"}
NV_EDITABLE = {"xem_tat_ca"}
# Chỉ Chủ: không có ô tick.
OWNER_ONLY = [
    ("phan_quyen", "Cấp vai trò, sửa phân quyền"),
    ("xoa_du_lieu_tuan", "Xóa dữ liệu tuần"),
    ("du_lieu", "Sao lưu, chuyển dữ liệu (ZIP), khôi phục"),
]

DEFAULT_PERMS = {
    "ql_tong": {k: 1 for k in PERM_KEYS},
    "ql": {k: (1 if k in ("order_ca", "xem_lich_minh", "xem_tat_ca") else 0) for k in PERM_KEYS},
    "nv": {"xem_tat_ca": 0},
}


# ---------------------------------------------------------------------------
# Nâng cấp cấu trúc
# ---------------------------------------------------------------------------
def _columns(con, table):
    return {r["name"] for r in con.execute(f'PRAGMA table_info("{table}")')}


def _migration_1(con):
    cols = _columns(con, "employees")
    for col in ("email", "phone", "start_date"):
        if col not in cols:
            con.execute(f"ALTER TABLE employees ADD COLUMN {col} TEXT")

    ddl = (
        """
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
            login_name TEXT UNIQUE COLLATE NOCASE,
            display_name TEXT,
            system_role TEXT NOT NULL DEFAULT 'nv',
            password_hash TEXT,
            must_change INTEGER NOT NULL DEFAULT 1,
            session_version INTEGER NOT NULL DEFAULT 1,
            password_set_at TEXT,
            password_set_by INTEGER,
            last_login_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS role_permissions (
            role TEXT NOT NULL,
            perm TEXT NOT NULL,
            allowed INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (role, perm)
        );
        CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            code_hash TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            used INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER,
            action TEXT NOT NULL,
            detail TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    # Chạy từng lệnh (executescript tự COMMIT, làm hỏng giao dịch nâng cấp)
    for stmt in ddl.split(";"):
        if stmt.strip():
            con.execute(stmt)
    for role, perms in DEFAULT_PERMS.items():
        for perm, allowed in perms.items():
            con.execute(
                "INSERT OR IGNORE INTO role_permissions(role, perm, allowed) VALUES (?,?,?)",
                (role, perm, allowed),
            )


def _migration_2(con):
    """Danh mục vai trò làm việc (Chạy bàn, Pha chế, ...)."""
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS work_roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'Đang sử dụng',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    names = []
    for sql in (
        "SELECT DISTINCT role FROM employee_roles",
        "SELECT DISTINCT role FROM staffing_requirements",
        "SELECT DISTINCT preferred_role FROM employees",
    ):
        for r in con.execute(sql):
            v = (r[0] or "").strip()
            if v and v.lower() not in [n.lower() for n in names]:
                names.append(v)
    preferred = ["Pha chế", "Chạy bàn"]
    names.sort(key=lambda n: (preferred.index(n) if n in preferred else 99, n))
    for i, n in enumerate(names):
        con.execute("INSERT OR IGNORE INTO work_roles(name, sort_order) VALUES (?, ?)", (n, i))


def _migration_3(con):
    """Order ca trên web: nộp order, lịch sử sửa, giờ mở/hết hạn từng tuần."""
    for stmt in (
        """CREATE TABLE IF NOT EXISTS order_submissions (
            week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            submitted_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (week_id, employee_id)
        )""",
        """CREATE TABLE IF NOT EXISTS order_edit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            week_id INTEGER NOT NULL,
            employee_id INTEGER NOT NULL,
            weekday INTEGER NOT NULL,
            shift TEXT NOT NULL,
            old_status TEXT,
            new_status TEXT NOT NULL,
            account_id INTEGER,
            created_at TEXT NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS idx_order_edit_log_cell ON order_edit_log(week_id, employee_id, weekday, shift)",
        """CREATE TABLE IF NOT EXISTS week_order_windows (
            week_id INTEGER PRIMARY KEY REFERENCES weeks(id) ON DELETE CASCADE,
            open_at TEXT NOT NULL,
            close_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )""",
    ):
        con.execute(stmt)
    for key, value in (
        ("order_open_dow", "0"), ("order_open_time", "08:00"),
        ("order_close_dow", "3"), ("order_close_time", "22:00"),
    ):
        con.execute("INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)", (key, value))


def _migration_4(con):
    """Xếp lịch cơ sở: vị trí ô, hàng vượt định biên, khóa xếp lịch, bản chốt, thông báo."""
    if "slot" not in _columns(con, "weekly_schedule_entries"):
        con.execute("ALTER TABLE weekly_schedule_entries ADD COLUMN slot INTEGER")
    for stmt in (
        """CREATE TABLE IF NOT EXISTS schedule_extra_rows (
            week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
            branch_id INTEGER NOT NULL,
            shift TEXT NOT NULL,
            role TEXT NOT NULL,
            count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (week_id, branch_id, shift, role)
        )""",
        """CREATE TABLE IF NOT EXISTS schedule_locks (
            week_id INTEGER PRIMARY KEY REFERENCES weeks(id) ON DELETE CASCADE,
            account_id INTEGER NOT NULL,
            acquired_at TEXT NOT NULL,
            last_seen TEXT NOT NULL
        )""",
        """CREATE TABLE IF NOT EXISTS schedule_published (
            week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
            employee_id INTEGER NOT NULL,
            weekday INTEGER NOT NULL,
            shift TEXT NOT NULL,
            branch_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            published_at TEXT NOT NULL,
            PRIMARY KEY (week_id, employee_id, weekday, shift)
        )""",
        """CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            body TEXT,
            created_at TEXT NOT NULL,
            read_at TEXT
        )""",
        "CREATE INDEX IF NOT EXISTS idx_notifications_account ON notifications(account_id, created_at)",
    ):
        con.execute(stmt)


def _migration_5(con) -> None:
    """Bước 5: thông báo có đường dẫn, bảng nhớ sự kiện đã gửi (mở order, sắp hết hạn)."""
    cols = {r[1] for r in con.execute("PRAGMA table_info(notifications)")}
    if "link" not in cols:
        con.execute("ALTER TABLE notifications ADD COLUMN link TEXT")
    con.execute("CREATE TABLE IF NOT EXISTS notification_events (event_key TEXT PRIMARY KEY, created_at TEXT NOT NULL)")


def _migration_6(con) -> None:
    """Đánh dấu ca 'Mới cập nhật' trong lịch nhân viên."""
    cols = {r[1] for r in con.execute("PRAGMA table_info(schedule_published)")}
    if "note" not in cols:
        con.execute("ALTER TABLE schedule_published ADD COLUMN note TEXT")
    if "changed_at" not in cols:
        con.execute("ALTER TABLE schedule_published ADD COLUMN changed_at TEXT")


def _migration_7(con) -> None:
    """Thêm quyền Báo cáo và Đánh giá (chức năng lấy từ bản offline). Mặc định: Quản lý tổng có."""
    for perm in ("bao_cao", "danh_gia"):
        con.execute("INSERT OR IGNORE INTO role_permissions(role, perm, allowed) VALUES ('ql_tong', ?, 1)", (perm,))
        con.execute("INSERT OR IGNORE INTO role_permissions(role, perm, allowed) VALUES ('ql', ?, 0)", (perm,))


def _migration_8(con) -> None:
    """Quản lý tài khoản: khóa/mở khóa tài khoản đăng nhập."""
    if "locked" not in _columns(con, "accounts"):
        con.execute("ALTER TABLE accounts ADD COLUMN locked INTEGER NOT NULL DEFAULT 0")


MIGRATIONS = [_migration_1, _migration_2, _migration_3, _migration_4, _migration_5, _migration_6, _migration_7,
              _migration_8]


def ensure_accounts(con) -> None:
    """Mỗi nhân viên có đúng một tài khoản (chưa có mật khẩu cho tới khi được cấp)."""
    rows = con.execute(
        "SELECT e.id, e.rank FROM employees e LEFT JOIN accounts a ON a.employee_id = e.id WHERE a.id IS NULL"
    ).fetchall()
    for r in rows:
        role = "ql" if (r["rank"] or "") == "Quản lý" else "nv"
        con.execute("INSERT INTO accounts(employee_id, system_role) VALUES (?, ?)", (r["id"], role))


def ensure_owner(con):
    """Tạo tài khoản Chủ lần đầu. Trả về mật khẩu tạm nếu vừa tạo."""
    from .security import hash_password, new_temp_password

    if con.execute("SELECT 1 FROM accounts WHERE system_role = 'chu'").fetchone():
        return None
    temp = new_temp_password()
    con.execute(
        "INSERT INTO accounts(login_name, display_name, system_role, password_hash, must_change, password_set_at)"
        " VALUES ('admin', 'Chủ', 'chu', ?, 1, ?)",
        (hash_password(temp), now_str()),
    )
    note = DATA_DIR / "MAT_KHAU_CHU_LAN_DAU.txt"
    note.write_text(
        "Tài khoản Chủ (đăng nhập lần đầu)\n"
        "Mã đăng nhập: admin\n"
        f"Mật khẩu tạm: {temp}\n\n"
        "Lần đầu đăng nhập web sẽ bắt đổi mật khẩu. Đổi xong hãy xóa file này.\n",
        encoding="utf-8",
    )
    return temp


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DB_PATH.exists():
        raise SystemExit(
            f"Chưa có file dữ liệu {DB_PATH}.\n"
            "Hãy chạy file 'chay_thu.command' (nó tự sao chép dữ liệu từ bản offline), "
            "hoặc chép file xep_lich.sqlite3 của bản offline vào thư mục du_lieu và đổi tên thành app.sqlite3."
        )
    con = connect()
    try:
        run_migrations(con)
        con.execute("BEGIN")
        ensure_accounts(con)
        temp = ensure_owner(con)
        con.execute("COMMIT")
        if temp:
            print("=" * 60)
            print("Đã tạo tài khoản Chủ.  Mã: admin   Mật khẩu tạm:", temp)
            print("(Đã lưu vào du_lieu/MAT_KHAU_CHU_LAN_DAU.txt)")
            print("=" * 60)
    finally:
        con.close()


def run_migrations(con) -> None:
    """Nâng cấp cấu trúc dữ liệu của bản offline lên bản web (chạy được nhiều lần)."""
    con.execute("PRAGMA journal_mode = WAL")
    con.execute("CREATE TABLE IF NOT EXISTS web_schema_version (version INTEGER NOT NULL)")
    row = con.execute("SELECT version FROM web_schema_version").fetchone()
    version = row["version"] if row else 0
    if not row:
        con.execute("INSERT INTO web_schema_version(version) VALUES (0)")
    for i, mig in enumerate(MIGRATIONS, start=1):
        if version < i:
            con.execute("BEGIN")
            try:
                mig(con)
                con.execute("UPDATE web_schema_version SET version = ?", (i,))
                con.execute("COMMIT")
            except Exception:
                con.execute("ROLLBACK")
                raise


def get_secret_key() -> str:
    env = os.environ.get("APP_SECRET_KEY")
    if env:
        return env
    path = DATA_DIR / "secret.key"
    if not path.exists():
        path.write_text(secrets.token_hex(32), encoding="utf-8")
    return path.read_text(encoding="utf-8").strip()


def audit(con, account_id, action, detail=""):
    con.execute(
        "INSERT INTO audit_log(account_id, action, detail, created_at) VALUES (?,?,?,?)",
        (account_id, action, detail, now_str()),
    )
