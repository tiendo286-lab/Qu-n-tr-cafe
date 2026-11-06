from __future__ import annotations

# Bản gốc chứa danh sách nhân viên thật (dữ liệu nạp một lần từ app Spirit 2.5.0).
# Đã làm rỗng trước khi đưa mã lên GitHub để không lộ thông tin nhân viên.
# Bản web không dùng phần nạp dữ liệu này (dữ liệu thật nằm trong du_lieu/app.sqlite3).

SPIRIT_EMPLOYEES: list[dict] = []
SPIRIT_FIXED_RESOLVED: list = []
SPIRIT_FIXED_NEEDS_ROLE: list = []
