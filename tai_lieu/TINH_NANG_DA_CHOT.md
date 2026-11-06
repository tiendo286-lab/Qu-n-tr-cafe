# Tính năng đã chốt — web quản lý Milano & Lela

Cập nhật: 07/11/2026 · Web: https://tiendo286-lab.github.io/Qu-n-tr-cafe/

Từ ngày 07/11/2026, **web là nơi duy nhất** lưu lịch, order và các dữ liệu khác. Trang web không còn chức năng nhập dữ liệu từ bản offline, nên **mọi việc sửa trên bản offline sẽ không lên web nữa**.

---

## 1. Menu của Chủ và Quản lý (10 mục)

| Mục | Tab con | Ghi chú |
|---|---|---|
| **Quản lý ca** | Chốt ca · Đối soát | Phiếu chốt ca theo ngày, đối soát 9 mục |
| **Xếp lịch tuần** | Order · Lịch cơ sở · Lịch tổng · Cảnh báo · Chốt & báo cáo | Xem bảng chi tiết ở mục 2 |
| **Công việc** | Công việc · Việc của tôi | Xem bảng chi tiết ở mục 3 |
| **Nhân viên & tài khoản** | Nhân viên · Phân quyền | Tài khoản đăng nhập nằm ngay trong danh sách nhân viên |
| **Nội quy & quy trình** | Nội quy · Quy trình | Soạn, đăng; nhân viên bấm "Tôi đã đọc" |
| **Hỗ trợ** | Yêu cầu hỗ trợ | Nhắn qua lại giữa nhân viên và quản lý |
| **Cài đặt xếp lịch** | Định biên · Chi nhánh, ca & vai trò · Giờ order · Lịch cố định | |
| **Dữ liệu & sao lưu** | — | Chỉ Chủ: xem số liệu, tải gói sao lưu ZIP |
| **Kế toán** | Hóa đơn giao hàng · Chuyển khoản thực nhận | Chỉ Kế toán và Chủ |
| **LOG hệ thống** | Tổng quan · Lịch sử cập nhật web · Lịch sử thao tác | Chỉ Chủ |
| **Của tôi** | Order ca · Lịch của tôi · Phiếu đào tạo | |

Thanh dưới trên điện thoại của nhân viên có 6 nút: **Order ca · Lịch làm · Việc · Chốt ca · Nội quy · Hỗ trợ**.

---

## 2. Xếp lịch tuần

| Chức năng | Đã chốt |
|---|---|
| Trạng thái tuần | Đang order → Đang xếp → Đã chốt → (Mở lại) Đang chỉnh sửa. Tuần đã có ca xếp mà chưa ghi trạng thái thì tính là **Đang xếp**, giống bản offline. |
| Nút "Bắt đầu xếp lịch" | Không hiện và bị máy chủ chặn khi tuần đã có ca được xếp, để không xóa mất lịch. |
| Quản lý sửa order | Lịch tự cập nhật theo các trường hợp ở dòng bên dưới. Cần quyền "Sửa order sau hạn" (mặc định Chủ, Quản lý tổng). |
| Ô đã xếp mà order đổi sang Nghỉ | Web **không tự gỡ** người khỏi ca. Ô hiện viền đỏ ⚠ và có tên trong tab Cảnh báo. |
| Tuần đã chốt | Nhân viên giữ bản đã chốt. Muốn đổi thì bấm "Mở lại tuần để sửa". Chốt lại thì nhân viên có ca thay đổi nhận thông báo. |
| Một người xếp một lúc | Ai đang mở trang xếp thì người khác chỉ được xem. Quyền tự nhả sau 15 phút. Chủ có nút "Giành quyền xếp". |
| Tài khoản chỉ có quyền xem | Trang hiện dòng vàng nói rõ lý do không xếp được. |
| Trang Order | **Đã bỏ:** Nhập câu trả lời Form, Tải file mẫu order, Khôi phục bản trước. **Còn:** Xóa order tuần (phải gõ chữ XOA), Xóa dữ liệu tuần (chỉ Chủ). |

---

## 3. Công việc

Đường đi của một việc: **Cần xử lý → chọn người nhận → Chờ nhận → Đang xử lý → Đã xử lý**

| Tab / bước | Đã chốt |
|---|---|
| **Cần xử lý** (tab đầu) | Gồm nội dung bàn giao ca chưa xong và việc Chủ tự ghi nhưng chưa giao. Chọn người nhận (hạn không bắt buộc) rồi bấm **Giao việc**. Bàn giao ca không cần giao ai thì bấm **"Đã xong, không cần giao"**. |
| Người nhận | Mọi nhân viên đang làm và có tài khoản: Quản lý tổng, Quản lý, Nhân viên. Không tự giao cho chính mình. |
| Chờ nhận → Đang xử lý | Nhân viên bấm **Nhận việc**, người giao nhận thông báo. |
| Đang xử lý → Đã xử lý | Nhân viên bấm **Đã xử lý**; ghi kết quả là không bắt buộc. Người giao nhận thông báo. Việc lấy từ bàn giao ca thì phiếu ca cũng tự ghi "Đã xử lý". |
| Duyệt | **Không còn bước duyệt.** Người giao có nút **Yêu cầu làm lại** (bắt buộc ghi lý do), việc quay về Đang xử lý. |
| Đổi người / Bỏ giao | Ở Chờ nhận và Đang xử lý đổi được người nhận và hạn. "Bỏ giao" đưa việc về Cần xử lý. |
| Họp | **Đã bỏ.** Đường dẫn cũ tự chuyển sang trang Công việc. |
| Nhắc việc | Mỗi lần mở app, người có việc chưa xong thấy hộp nhắc. Menu có số đếm việc. |
| Quyền giao việc | Quyền "Giao việc cho nhân viên". Mặc định chỉ Chủ; hiện Quản lý tổng **cũng đang được bật**. |

---

## 4. Nhân viên & tài khoản

| Chức năng | Đã chốt |
|---|---|
| Trang Nhân viên | Danh sách, bộ lọc, sửa nhanh cấp bậc, các cột Nội quy / Cam kết / Đào tạo, tạo phiếu đào tạo. **Đã bỏ:** Nhập file Excel, Tải file mẫu, Xuất danh sách cho Google Form. |
| Tài khoản đăng nhập | **Gộp vào bảng Nhân viên**: cột Tài khoản (trạng thái, vai trò, lần đăng nhập cuối) + nút **Tài khoản ▾** (cấp mật khẩu tạm, khóa / mở khóa, đăng xuất mọi nơi). Nút **Cấp & in mật khẩu hàng loạt**. Cuối trang: **Tài khoản riêng** (kế toán, chủ thứ hai…). |
| Phân quyền | Bật / tắt quyền theo vai trò: Quản lý tổng, Quản lý, Nhân viên. |

---

## 5. Dữ liệu & sao lưu

- Xem số liệu hiện có: nhân viên, tuần, ô order, ô lịch, phiếu chốt ca, công việc…
- Nút **Tải gói dữ liệu ZIP**: gói gồm toàn bộ dữ liệu (lịch, order, nhân viên… + phiếu chốt ca, công việc, nội quy, cam kết, đào tạo, hỗ trợ). Không gồm mật khẩu và ảnh. Nên tải hằng tuần và cất vào máy tính hoặc Google Drive.
- **Đã bỏ** phần nhập dữ liệu từ bản offline.

---

## 6. Đã bỏ hẳn

Đánh giá · Voucher · Họp · nhập dữ liệu từ bản offline · nhập câu trả lời Google Form · nhập Excel nhân viên · tải file mẫu · Khôi phục bản order trước.

---

## 7. Việc còn để ngỏ — làm cùng nhau

| # | Việc | Cần anh quyết |
|---|---|---|
| 1 | ~~Gói sao lưu ZIP chưa đủ~~ — **xong 07/11**: gói có thêm `du_lieu_tinh_nang_moi.json` (phiếu chốt ca, công việc, nội quy, cam kết, đào tạo, hỗ trợ). Chưa có ảnh. | — |
| 2 | **Cấp mật khẩu cho nhân viên**: 56 người đang làm chưa có mật khẩu, nên chưa nhận việc, chưa chốt ca, chưa đọc nội quy được trên web | Cấp lần lượt hay cấp một lượt rồi in danh sách? |
| 3 | **Quyền giao việc của Quản lý tổng** đang bật | Giữ hay tắt? |
| 4 | **Nhiệm vụ đào tạo** trong Công việc: trước đây giao từ trang Họp, nay chưa có chỗ giao riêng | Có cần không, hay giao như việc thường? |
| 5 | **Công nợ** chưa tính vào công thức tiền của phiếu ca | Công thức thế nào? |
| 6 | **Tab kế toán** nhập chuyển khoản | Có làm không, ai dùng? |
| 7 | **Bài kiểm tra lý thuyết** đào tạo | Nội dung câu hỏi |
| 8 | **Tải ảnh minh chứng** bản cam kết đã ký | Có cần không? |
| 9 | **Bản offline**: từ nay không còn đồng bộ lên web | Có báo quản lý ngừng dùng bản offline không? |
| 10 | **Mã truy cập Supabase** `sbp_fc3797…` | Anh thu hồi (Revoke) ở https://supabase.com/dashboard/account/tokens |

Các giả định nhỏ khác đang dùng tạm xem ở [GIA_DINH_CHO_CHOT.md](GIA_DINH_CHO_CHOT.md).
