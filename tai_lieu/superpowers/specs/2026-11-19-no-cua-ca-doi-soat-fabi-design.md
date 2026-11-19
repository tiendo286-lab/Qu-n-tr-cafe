# Nợ của ca hiện ngay ở Đối soát Fabi — thiết kế ngắn (19/11/2026)

## Vì sao
Anh Tiến mở Sổ thu chi › Đối soát Fabi để xem một ca nhưng không thấy phần nợ. Ô "Nợ bill" ở phần A chỉ có con số (nhân viên ghi / máy Fabi ghi). Tên khách nợ chỉ có ở phần B, mà phần B bị khoá cho tới khi bấm "Xác nhận Fabi", tức là phải chờ kế toán. Anh muốn nhân viên gửi phiếu xong là thấy nợ của ca ngay.

## Mục tiêu
- Ở phần A · Fabi, ngay dưới ô **Nợ bill**, liệt kê các khoản nợ của ca (Cách B, anh chọn qua hình mẫu https://claude.ai/artifact/Uc83czrbbX5rKvWrGV8jKw):
  - **Nợ mới trong ca**: loại HĐ / TM / CK, bàn hoặc tên khách, số tiền. Khoản đã trả hết thì ghi "đã trả", trả một phần thì ghi "còn nợ X".
  - **Khách trả nợ cũ trong ca**: tên khách, số tiền, trả tiền mặt hay chuyển khoản, nợ từ ca nào.
- Hiện ngay khi nhân viên gửi phiếu, không chờ file Fabi hay kế toán.
- Ca có nợ thì danh sách tự mở sẵn. Ca không có nợ thì giữ như hiện nay.
- Sau khi bấm "Xác nhận Fabi", phần A thu gọn nhưng vẫn hiện danh sách này dưới ô Nợ bill.

## Không làm
- Không thêm nút thu nợ hay sửa nợ ở đây. Chỉ để xem; thu nợ vẫn làm ở chỗ cũ (Sổ thu › Khách đang nợ, phiếu chênh lệch).
- Không đổi cách tính tiền, không đổi khoá Chốt ca hay quyền (vùng khoá).
- Không đổi khung "Nợ bill của ca" ở phần B.

## Cách làm (anh chọn Cách 2)
- **Cách 1 (bỏ):** chỉ sửa giao diện, dùng `open_debts` đang có. Khoản đã trả biến mất khỏi ca gốc, và phải so chữ "ca Chiều 19/11" để biết nợ của ca nào, dễ sai.
- **Cách 2 (chọn):** máy chủ gửi thêm danh sách nợ cho mỗi ca trong `app_stc_month` → `cas[]`. Đủ và đúng, cần một tệp SQL mới.

## Phần máy chủ
- Tệp mới `supabase/140_...sql`. Trước khi đặt số, xem `max(file)` trong `app_migrations`. Tệp vá bản đang chạy của `app_stc_month` theo cách tệp 139 đã làm (`pg_get_functiondef` + tìm chỗ chèn, không thấy thì dừng). Chạy lại nhiều lần không sao. Dòng cuối ghi vào `app_migrations`.
- Thêm vào mỗi ca:
  - `debts`: các dòng `shift_debts` có `report_id` = ca, `split_from is null`, `amount > 0`. Mỗi dòng gồm id, who, kind, amount, còn nợ (cộng các phần chưa thu trong chuỗi tách), đã trả hết hay chưa.
  - `paid`: các dòng có `closed_report_id` = ca, gồm who, amount, collect_kind, ca gốc.
- Thêm vào thì phải giữ được tốc độ: lấy một lần cho cả tháng rồi nhóm theo ca, không gọi lại cho từng ca. Đo theo cách trong `tai_lieu/BAN_GIAO.md`.
- `app_stc_month` không thuộc vùng khoá.

## Phần giao diện
- `docs/js/pages/so_thu_chi.js`, hàm `partA`: thêm danh sách dưới ô Nợ bill, cả lúc chưa xác nhận (lưới ô ①) lẫn lúc đã xác nhận (`stc-fsum`).
- Kiểu dáng theo hình mẫu: nhãn màu HĐ / TM / CK / Trả, số tiền canh phải. Ở khung điện thoại 390px không bị tràn ngang.

## Kiểm tra
- Bài thử máy chủ: có nợ HĐ / TM / CK; có khoản trả một phần; có khách trả nợ cũ; có ca không nợ.
- Bài thử trình duyệt: ở `index.html` và `test/phone.html`, ca có nợ thì danh sách tự mở, ca không nợ thì không hiện; xem cả trước và sau khi xác nhận.
- Chạy lại `flow_stc6` / `flow_stc7` để chắc phần tiền không bị ảnh hưởng.

## Thứ tự đưa lên
Cập nhật Supabase (chạy thử trong `DO $$ … RAISE EXCEPTION 'REPORT>> %'` trước) → đẩy giao diện lên `main` → tăng `docs/version.json` → ghi một dòng `app_releases`.

## Để người làm tự quyết
Chữ hiển thị cụ thể, màu nhãn, và cách tính "còn nợ" khi khoản bị tách nhiều lần (theo cách tệp 101 tách nợ).
