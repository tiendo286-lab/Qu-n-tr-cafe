"""Cấp lại mật khẩu tạm cho tài khoản Chủ (dùng khi Chủ quên mật khẩu).

Chạy trong Terminal tại thư mục này:
    .venv-mac/bin/python dat_lai_mat_khau_chu.py
"""
from app.db import connect, init_db, now_str
from app.security import hash_password, new_temp_password

init_db()
con = connect()
temp = new_temp_password()
cur = con.execute(
    "UPDATE accounts SET password_hash = ?, must_change = 1, password_set_at = ?,"
    " session_version = session_version + 1 WHERE system_role = 'chu'",
    (hash_password(temp), now_str()),
)
con.close()
if cur.rowcount:
    print("Mã đăng nhập Chủ: admin")
    print("Mật khẩu tạm mới:", temp)
else:
    print("Không tìm thấy tài khoản Chủ.")
