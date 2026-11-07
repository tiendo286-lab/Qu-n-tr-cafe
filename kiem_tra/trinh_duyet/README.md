# Chạy thử giao diện trên Chrome (không đụng dữ liệu thật)

- `chuan_bi.sh <thư mục tạm>`: chép `docs/` sang thư mục tạm, thay `js/sb.js` bằng `sb_gia.js` (Supabase giả lập trong bộ nhớ, đọc dữ liệu từ `du_lieu/app.sqlite3`), gắn bộ bấm thử tự động.
- Mở bằng Chrome headless: `--dump-dom "http://127.0.0.1:8765/index.html?auto=1&routes=<các #/đường-dẫn, mã hóa URL>"`; kết quả nằm trong `<pre id="ketqua">`.
- Tham số: `role=nv` (đăng nhập là nhân viên), `open=1` (order đang mở), `confirm=1` (tự đồng ý hộp xác nhận), `login=0` (chưa đăng nhập), `script=fuzz&fz=...` (bấm từng nút), `script=flow` / `flow2` / `login` (các luồng chính), `script=wide&wr=...` qua `test/phone.html` (kiểm tra tràn ngang ở khung 390px).
- Lưu ý: Chrome headless có bề rộng tối thiểu 500px, nên kiểm tra điện thoại phải qua `test/phone.html` (khung iframe 390px).
- `flow.js` cần thêm `test/offline.zip` và `test/offline_moi_nhat.sqlite3` (dữ liệu thật — không đưa lên GitHub). Phần thử NHẬP dữ liệu trong flow.js không còn dùng: trang Dữ liệu & sao lưu đã bỏ chức năng nhập (07/11/2026), chỉ còn tải gói ZIP.
- Không mở được máy chủ cục bộ thì mở thẳng bằng `file://.../index.html?...` kèm cờ Chrome `--allow-file-access-from-files`.
- `script=flow_ds`: bản đối soát + kết quả KHỚP/THIẾU/THỪA (gán khoản âm) + Bảng ca + Khoản âm + Báo cáo (role chu). `script=flow_wz` qua `test/phone.html?role=nv`: phiếu chốt ca từng bước, ảnh phiếu iPOS bắt buộc, công nợ, nhận két đếm mù → lệch → 2 người đếm lại, Số dư đầu iPOS, khách trả nợ, không tràn ngang 390px. `flow_ds` cuối luồng: ca sau nhận két lệch → cộng vào tiền mặt ca giao, cảnh báo ở Bảng ca. Khung cảnh báo đỏ "lệch" là cố ý nên bộ thử ghi ✗ ở các bước đó. Lần mở trang đầu tiên chậm nên các luồng chờ ~2,5 giây trước khi bắt đầu.
- `script=flow_ct` (role=chu, confirm=1): Chốt tháng — tổng hợp, chi tiết cơ sở, phân nhóm khoản ở phiếu ca, thêm chi phí, chốt bị chặn khi chưa đối soát, chốt → khóa, mở lại, cài đặt nhóm + giao cơ sở. Giả lập ở `fin_gia.js`.
