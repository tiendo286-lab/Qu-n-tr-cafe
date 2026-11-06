# Chạy thử giao diện trên Chrome (không đụng dữ liệu thật)

- `chuan_bi.sh <thư mục tạm>`: chép `docs/` sang thư mục tạm, thay `js/sb.js` bằng `sb_gia.js` (Supabase giả lập trong bộ nhớ, đọc dữ liệu từ `du_lieu/app.sqlite3`), gắn bộ bấm thử tự động.
- Mở bằng Chrome headless: `--dump-dom "http://127.0.0.1:8765/index.html?auto=1&routes=<các #/đường-dẫn, mã hóa URL>"`; kết quả nằm trong `<pre id="ketqua">`.
- Tham số: `role=nv` (đăng nhập là nhân viên), `open=1` (order đang mở), `confirm=1` (tự đồng ý hộp xác nhận), `login=0` (chưa đăng nhập), `script=fuzz&fz=...` (bấm từng nút), `script=flow` / `flow2` / `login` (các luồng chính), `script=wide&wr=...` qua `test/phone.html` (kiểm tra tràn ngang ở khung 390px).
- Lưu ý: Chrome headless có bề rộng tối thiểu 500px, nên kiểm tra điện thoại phải qua `test/phone.html` (khung iframe 390px).
- `flow.js` cần thêm `test/offline.zip` và `test/offline_moi_nhat.sqlite3` (dữ liệu thật — không đưa lên GitHub).
