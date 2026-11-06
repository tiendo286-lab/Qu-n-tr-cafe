"""Mật khẩu, phiên đăng nhập và kiểm tra quyền."""
from __future__ import annotations
import hashlib
import hmac
import secrets
import time

from .db import NV_ALWAYS, NV_EDITABLE, PERM_KEYS

# ---------------------------------------------------------------------------
# Mật khẩu (scrypt, thư viện chuẩn Python)
# ---------------------------------------------------------------------------
_N, _R, _P = 2 ** 14, 8, 1
MIN_PASSWORD_LEN = 6


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    return f"scrypt${_N}${_R}${_P}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        algo, n, r, p, salt_hex, hash_hex = stored.split("$")
        if algo != "scrypt":
            return False
        dk = hashlib.scrypt(
            password.encode("utf-8"), salt=bytes.fromhex(salt_hex), n=int(n), r=int(r), p=int(p), dklen=32
        )
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, TypeError):
        return False


_TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # bỏ ký tự dễ nhầm: l, 1, o, 0, i


def new_temp_password(length: int = 8) -> str:
    return "".join(secrets.choice(_TEMP_ALPHABET) for _ in range(length))


def password_problem(new: str, confirm: str) -> str | None:
    if len(new) < MIN_PASSWORD_LEN:
        return f"Mật khẩu phải có ít nhất {MIN_PASSWORD_LEN} ký tự."
    if new != confirm:
        return "Hai lần nhập mật khẩu không khớp."
    return None


# ---------------------------------------------------------------------------
# Chống dò mật khẩu: tối đa 10 lần sai / 15 phút cho mỗi mã đăng nhập
# ---------------------------------------------------------------------------
_FAILS: dict[str, list[float]] = {}
_WINDOW, _MAX_FAILS = 15 * 60, 10


def login_blocked(key: str) -> bool:
    now = time.time()
    arr = [t for t in _FAILS.get(key, []) if now - t < _WINDOW]
    _FAILS[key] = arr
    return len(arr) >= _MAX_FAILS


def record_fail(key: str) -> None:
    _FAILS.setdefault(key, []).append(time.time())


def clear_fails(key: str) -> None:
    _FAILS.pop(key, None)


# ---------------------------------------------------------------------------
# Người dùng hiện tại và quyền
# ---------------------------------------------------------------------------
class Redirect(Exception):
    def __init__(self, url: str):
        self.url = url


class Forbidden(Exception):
    pass


USER_SQL = """
SELECT a.id AS account_id, a.employee_id, a.login_name, a.system_role, a.password_hash,
       a.must_change, a.session_version, a.display_name, a.locked,
       e.code, e.name, e.rank, e.status, e.email, e.preferred_role
FROM accounts a LEFT JOIN employees e ON e.id = a.employee_id
"""


class User:
    def __init__(self, row, perms: dict):
        self.account_id = row["account_id"]
        self.employee_id = row["employee_id"]
        self.role = row["system_role"]
        self.code = row["code"] or row["login_name"]
        self.name = row["name"] or row["display_name"] or "Chủ"
        self.rank = row["rank"]
        self.must_change = bool(row["must_change"])
        self.session_version = row["session_version"]
        self._perms = perms

    @property
    def is_owner(self) -> bool:
        return self.role == "chu"

    def can(self, perm: str) -> bool:
        if self.role == "chu":
            return True
        if perm in ("phan_quyen", "xoa_du_lieu_tuan", "du_lieu"):
            return False
        if self.role == "nv":
            if perm in NV_ALWAYS:
                return True
            if perm not in NV_EDITABLE:
                return False
        return bool(self._perms.get(perm, 0))

    @property
    def is_manager_view(self) -> bool:
        """Có ít nhất một quyền quản trị → dùng giao diện quản lý (máy tính)."""
        return self.role in ("chu", "ql_tong", "ql")


def load_role_perms(con, role: str) -> dict:
    rows = con.execute("SELECT perm, allowed FROM role_permissions WHERE role = ?", (role,)).fetchall()
    perms = {r["perm"]: r["allowed"] for r in rows}
    return {k: perms.get(k, 0) for k in PERM_KEYS}


def current_user(request, con) -> User | None:
    aid = request.session.get("aid")
    ver = request.session.get("ver")
    if not aid:
        return None
    row = con.execute(USER_SQL + " WHERE a.id = ?", (aid,)).fetchone()
    if not row or row["session_version"] != ver:
        request.session.clear()
        return None
    if row["employee_id"] and row["status"] != "Đang làm":
        request.session.clear()
        return None
    if row["locked"]:
        request.session.clear()
        return None
    return User(row, load_role_perms(con, row["system_role"]))


def require_user(request, con, perm: str | None = None, allow_must_change: bool = False) -> User:
    user = current_user(request, con)
    if not user:
        raise Redirect("/dang-nhap")
    if user.must_change and not allow_must_change:
        raise Redirect("/doi-mat-khau")
    if perm and not user.can(perm):
        raise Forbidden()
    return user


def mask_email(email: str) -> str:
    name, _, domain = email.partition("@")
    if len(name) <= 2:
        shown = name[:1] + "•" * max(len(name) - 1, 1)
    else:
        shown = name[0] + "•" * (len(name) - 2) + name[-1]
    return f"{shown}@{domain}"


def hash_reset_code(code: str, secret: str) -> str:
    return hmac.new(secret.encode(), code.encode(), hashlib.sha256).hexdigest()
