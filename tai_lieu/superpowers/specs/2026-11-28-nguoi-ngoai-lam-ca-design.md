# Thêm người vào ca: nhân viên quán · nhân viên cũ · người ngoài

Ngày 28/11/2026 — anh Tiến đề xuất. Bản thiết kế ngắn, chờ anh duyệt.

## Vì sao làm
Ca làm thực tế có 3 loại người: nhân viên quán, nhân viên cũ quay lại làm hộ, và người ngoài (không có hồ sơ).
Hiện tại:
- Chốt ca (nhân viên): chọn được nhân viên quán + nhân viên cũ. Chưa có người ngoài.
- Đối soát ca (quản lý), nút "+ Thêm người hỗ trợ": chỉ có nhân viên quán (`app_ca_employees` lọc `status = 'Đang làm'`).
- Người ngoài chỉ gõ được tên ở bước "Nghỉ & làm thay" (ghi chú báo cáo lương), không có giờ, không có tiền.

## Anh Tiến đã chốt (trong chat 28/11)
- Cả chốt ca và đối soát ca đều thêm được 3 loại người.
- Người ngoài được trả công bằng tiền mặt, thường trả ngay trong ca, có khi trả hôm khác.
- Trả hôm khác: **web không theo dõi nợ công** (cách 1). Hôm làm ghi tên + giờ, không ghi tiền. Hôm trả, người chốt ca hôm đó
  ghi khoản chi lương như bình thường, ghi chú tên người và ngày làm.

## Mục tiêu / không làm
- Làm: thêm loại "Người ngoài" ở chỗ thêm người của chốt ca và đối soát ca; thêm "Nhân viên cũ" ở đối soát ca.
- Không làm: danh sách "còn nợ công", nhắc trả, chống trả trùng.
- Không được xảy ra: đổi cách tính tiền của ca, đổi quyền sửa phần tiền, người ngoài lọt vào lịch / đánh giá / đào tạo / đăng nhập.

## Các cách đã cân nhắc
1. **Người ngoài là một hồ sơ gọn trong danh sách nhân viên, đánh dấu "Người ngoài" (chọn).**
   Hồ sơ chỉ có tên (và số điện thoại nếu có), không tài khoản, trạng thái không phải "Đang làm", bật sẵn "Trả lương tiền mặt".
   Mọi thứ đang chạy cho nhân viên cũ trả tiền mặt (giờ đến / về, khoản Chi lương của ca, bảng công) dùng lại nguyên, không sửa
   hàm tính tiền nào. Lần sau người đó làm lại thì chọn tên có sẵn.
2. Gõ tên tự do vào dòng người làm của ca (không hồ sơ). Bảng người làm của ca hiện gắn chặt với hồ sơ nhân viên ở hơn chục hàm
   máy chủ, kể cả hàm tính tiền két → phải sửa cả loạt, dễ sót, đụng sâu vùng khoá tiền. Bỏ.
3. Một hồ sơ chung tên "Người ngoài" dùng cho mọi người. Không phân biệt được ai, hai người ngoài cùng ca không ghi được. Bỏ.

## Thiết kế (cách 1)
- **Máy chủ (tệp SQL mới, số kế tiếp sổ tệp đã chạy):**
  - Cột đánh dấu người ngoài trên hồ sơ nhân viên (mặc định không).
  - `app_ca_helpers` trả thêm nhóm `outside` (người ngoài); nhóm `former` loại người ngoài ra. Cho cả người đối soát gọi được.
  - Hàm mới `app_ca_outsider_add(tên, sđt)`: người đang chốt ca / đối soát tạo nhanh một người ngoài (mã tự sinh, không tài khoản,
    trả lương tiền mặt). Trùng tên (bỏ dấu, bỏ hoa thường) thì trả lại hồ sơ cũ, không tạo thêm.
  - Rà các chỗ liệt kê nhân viên (lịch, đánh giá, đào tạo, trang Nhân viên) để người ngoài không lẫn vào; trang Nhân viên có mục
    riêng "Người ngoài" để Chủ / Quản lý tổng sửa tên, gộp, ẩn.
- **Chốt ca:** mục "Thêm người làm hộ" có 3 nút: Nhân viên trong quán · Nhân viên cũ · Người ngoài. Nút Người ngoài: danh sách
  người ngoài đã có (lọc theo tên) + nút "+ Người ngoài mới" (gõ tên, sđt không bắt buộc).
- **Đối soát ca:** hộp "Thêm người hỗ trợ" chọn loại người trước (3 loại như trên) rồi chọn tên; người ngoài mới cũng thêm được ở đây.
- **Tiền:** không đổi. Trả công ngay trong ca = khoản Chi lương tiền mặt của ca gán cho người đó (đường đang có). Trả hôm khác =
  khoản chi lương bình thường của ca hôm trả.
- **Vùng khoá tiền đối soát:** không sửa hàm nào trong vùng khoá; vẫn chạy đủ bộ bài thử của vùng khoá trước khi lên web.

## Em tự quyết (anh chưa xác nhận)
- Nhân viên chốt ca được tự tạo người ngoài mới (không cần chờ quản lý).
- Trong bảng công / báo cáo lương, người ngoài hiện như nhân viên cũ trả tiền mặt, có chữ "(người ngoài)".
- Ở bước "Nghỉ & làm thay", ô gõ tay "Người ngoài quán…" giữ nguyên; người ngoài đã thêm vào ca thì chọn được như người hỗ trợ khác.

## Để người làm quyết
- Tên cột, cách sinh mã, vị trí mục "Người ngoài" trong trang Nhân viên, chữ trên nút.

## Thực tế đã làm (28/11, khác bản thiết kế ở vài điểm nhỏ)
- Tệp máy chủ `supabase/200_nguoi_ngoai_lam_ca.sql`; mô-đun chọn người `docs/js/chon_nguoi_ca.js`.
- Thêm cả chỗ thứ ba: hộp "Thêm người vào ca" ở bảng Nghỉ & làm thay (web 2026.11.29.1 mới có).
- Trang Nhân viên: không làm mục riêng; người ngoài nằm trong nhóm ngừng làm, có nhãn + nút Đổi tên. Chưa có Ẩn / gộp.
- So trùng tên: không kể hoa thường và dấu cách thừa; CHƯA bỏ dấu (máy chủ không có sẵn hàm bỏ dấu).
- Bảng công: chưa thêm chữ "(người ngoài)" (phải sửa hàm bảng công ở máy chủ) — nhận ra bằng mã `NG…`.
- Thêm hồ sơ thì máy chủ tự tạo tài khoản rỗng (trigger `employee_account`) → hàm tạo người ngoài gỡ ngay tài khoản đó.
