# CSDL thử cục bộ (không đụng Supabase thật)

Dựng một Postgres chạy trên máy từ toàn bộ `supabase/*.sql` để chạy thử tệp SQL mới và các bài thử `kiem_tra/*.sql` (khối `DO … RAISE EXCEPTION 'REPORT>> …'`). Không có dữ liệu thật — chỉ dữ liệu giả trong `seed.sql`.

Cài 1 lần (Python hệ thống 3.9 có sẵn bánh xe `pgserver` cho macOS; Python 3.14 chưa có):
```
/usr/bin/python3 -m venv <thư mục>/pgv && <thư mục>/pgv/bin/pip install pgserver psycopg2-binary
```
Dựng (mặc định lưu ở `kiem_tra/_tam/pg`, đổi bằng biến `PG_DIR`):
```
<pgv>/bin/python kiem_tra/may_chu_cuc_bo/dung_csdl.py supabase --fresh --upto=145   # nạp tới tệp 145 (in số tệp lỗi; 19/11: 0 lỗi)
<pgv>/bin/python kiem_tra/may_chu_cuc_bo/chay.py kiem_tra/may_chu_cuc_bo/seed.sql    # dữ liệu giả: 3 cơ sở, Chủ / QLT / 2 QL / NV cấp 1 / NV mới / KT
<pgv>/bin/python kiem_tra/may_chu_cuc_bo/chay.py supabase/146_....sql                # chạy tệp mới (2 lần để thử chạy lại)
<pgv>/bin/python kiem_tra/may_chu_cuc_bo/chay.py kiem_tra/....sql                    # bài thử: ra "LỖI: REPORT>> ĐẠT …" là đạt
```
Giới hạn: không có pgcrypto (thay bằng hàm giả), `auth` / `storage` / `cron` là bảng / hàm giả tối thiểu; đăng nhập trong bài thử bằng `set_config('request.jwt.claims', json_build_object('sub', <auth_user_id>, 'role', 'authenticated')::text, true)`. Tài khoản giả tìm theo `login_name` (chu, qlt, ql1, ql2, nv1, nv6, kt).
