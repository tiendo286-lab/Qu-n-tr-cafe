# Thiết kế: Xem như người khác (👁 Xem như)

Ngày: 19/11/2026 · Người chốt: anh Tiến (Chủ)

## 1. Mục đích
Anh Tiến muốn **thấy đúng màn hình của từng người** (Nhân viên, Quản lý, Quản lý tổng, Kế toán) — cả máy tính lẫn điện thoại — **để biết chỗ nào cần sửa** (giao diện, phân quyền). Hiện anh đăng nhập bằng tài khoản Chủ nên luôn thấy mọi thứ, không biết người khác thấy gì.

## 2. Mục tiêu / Không làm / Thất bại nếu
- **Mục tiêu:** Chủ chọn **một người cụ thể** → web hiện y như người đó thấy: menu, nút, cơ sở được giao, số liệu, trang "Của tôi". Chuyển khung Máy tính / Điện thoại (390px) ngay trong lúc xem.
- **Không làm:** sửa dữ liệu thay người khác; cho vai khác ngoài Chủ dùng; xem như Chủ khác.
- **Thất bại nếu (dù chạy được):**
  - Trong lúc xem như, có bất kỳ dữ liệu nào bị ghi dưới tên người kia (chốt ca, đã đọc thông báo, đăng nhập lần cuối…).
  - Nhân viên / máy khác của anh bị đổi theo.
  - Quên thoát → anh tưởng mình là Chủ mà thật ra đang bị giới hạn (hoặc ngược lại).
  - Quyền thật của mọi người bị sai lệch (lỗi kiểu bước 129).

## 3. Ràng buộc
- **Vùng khoá:** cách làm sửa `app_account()` → đổi kết quả `app_can` → **thuộc vùng khoá**. Anh Tiến đã tự tắt khoá mật khẩu (19/11) cho việc này; vẫn phải nói rõ sửa gì trước khi sửa (mục 5 của tài liệu này). Sau khi sửa: chạy `flow_ql_tu_ds` (role ql + chu, `index.html` + `test/phone.html`), `flow_stc6`, `flow_stc7` (chu / qlt / ql).
- Bật chế độ Xem như **không hỏi mật khẩu** (Chủ bấm là vào).
- Đổi CSDL = tệp SQL mới có số thứ tự (xem `max(file)` ở `app_migrations`), chạy lại được nhiều lần; chạy thử trong khối `DO $$ … RAISE EXCEPTION 'REPORT>> %' $$` trước.
- Cập nhật Supabase **trước** khi đẩy giao diện. Tăng `docs/version.json`, ghi `app_releases`.

## 4. Các cách đã cân nhắc
| Cách | Ưu | Nhược |
|---|---|---|
| 1. Chỉ giả lập ở giao diện | Không đụng máy chủ / vùng khoá, nhanh | Số liệu vẫn theo quyền Chủ (thấy nhiều hơn thật) |
| **2. Máy chủ trả lời "đang xem như người X"** ✅ | Đúng 100%: dữ liệu, cơ sở, nút, trang Của tôi | Sửa vùng khoá, phải chặn ghi chặt |
| 3. Tài khoản thử từng vai | Đúng thật | Lẫn vào lịch / bảng công / giao việc; phải đăng nhập từng tài khoản |

**Anh Tiến chọn cách 2.** Lý do kỹ thuật thuận lợi: mọi kiểm tra quyền đều đi qua `app_account()` (tệp `02_bao_mat.sql`, tìm theo `auth.uid()`), nên chỉ cần một chỗ đổi.

## 5. Cách làm (đã chốt)
### Máy chủ
- **Bảng mới `view_as`**: `session_id` (lấy từ `auth.jwt()->>'session_id'` — chỉ trình duyệt đang bật bị đổi, máy khác không), `owner_account_id` (Chủ), `target_account_id`, `started_at`, `expires_at` (= bắt đầu + 30 phút). Không cấp quyền cho anon / authenticated.
- **`app_account()`**: nếu phiên hiện tại có dòng `view_as` còn hạn **và** chủ dòng đó thật sự là Chủ (`system_role = 'chu'`, không khoá) → trả tài khoản người được xem. Ngược lại giữ như cũ. Người được xem bị khoá / nghỉ việc → không cho bắt đầu.
- **Hàm mới** (chỉ Chủ thật, kiểm tra bằng tài khoản thật chứ không qua `app_account()` đã đổi):
  - `app_view_as_start(p_account bigint)` — bắt đầu / đổi người.
  - `app_view_as_stop()` — thoát (phải chạy được cả khi đang chế độ chỉ xem).
  - `app_view_as_state()` — đang xem như ai, còn bao lâu (để vẽ dải vàng).
  - `app_view_as_people()` — danh sách người chọn được, chia theo vai + cơ sở, có ghi "có thêm quyền Kế toán".
- **Chặn ghi:** khi phiên đang xem như, mọi yêu cầu chạy ở chế độ chỉ đọc của CSDL (`set_config('transaction_read_only','on', true)` — bật sang chỉ đọc được bất cứ lúc nào trong giao dịch), trừ `app_view_as_stop`. Đề xuất đặt ở hàm chạy trước mọi yêu cầu (`pgrst.db_pre_request`); người làm kiểm chứng trên Supabase thật bằng khối tự hoàn tác.
- **Các chỗ dùng thẳng `auth.uid()`** ngoài `app_account()` (`02_bao_mat.sql` dòng 130, 210, 219; chính sách kho ảnh `58_…`, `91_…` so `owner_id`): xem từng chỗ, quyết định theo nguyên tắc "đọc như người được xem, không ghi gì".
- **Nhật ký:** mỗi lần bắt đầu / thoát ghi vào log hệ thống (`app_log`): Chủ nào xem như ai, lúc nào.

### Giao diện
- Trang mới **👁 Xem như** (menu nhóm Hệ thống, chỉ Chủ thấy): ô tìm + danh sách người theo vai / cơ sở → bấm "Xem như".
- Khi đang xem: **dải vàng cố định trên cùng** mọi trang: "Đang xem như *Tên* · *Vai* · *Cơ sở* — chỉ xem · còn 24 phút" + nút **Máy tính | Điện thoại** + **Đổi người** + **Thoát**. Dải vàng nằm ngoài nội dung, không bị vai người được xem làm ẩn.
- **Khung Điện thoại:** hiện trang trong khung rộng 390px (giống `test/phone.html`) ở giữa màn hình.
- Lỗi do chặn ghi ("read-only transaction") → báo tiếng Việt: "Đang xem như — không lưu được".
- Hết 30 phút / bấm Thoát → tải lại thành Chủ.

## 6. Để người làm tự quyết
- Trang nào tự ghi khi mở (vd `app_touch_login`, đánh dấu đã đọc, tự tạo việc hôm nay): dò từng trang ở chế độ xem như; chỗ nào ghi khi mở thì bỏ qua êm (không báo lỗi đỏ), không mở cửa cho ghi.
- Cách kiểm tra giả lập (`sb_gia.js`): thêm giả lập các hàm `app_view_as_*` + chế độ chỉ đọc.
- Vị trí chính xác của trang trong `HUBS`, đường dẫn (đề xuất `#/he-thong/xem-nhu`).

## 7. Kiểm tra trước khi đẩy lên
- Máy chủ (khối tự hoàn tác): Chủ xem như QL LHP → `app_can`, danh sách cơ sở, `app_me` đúng như QL; mọi hàm ghi báo lỗi; `app_view_as_stop` chạy được; người không phải Chủ gọi `app_view_as_start` bị chặn; hết hạn tự về Chủ; phiên khác của Chủ không bị ảnh hưởng.
- Giao diện: role chu → xem như nv / ql / ql_tong / ke_toan / nv có quyền Kế toán, ở `index.html` và `test/phone.html`, không tràn ngang 390px.
- Vùng khoá: `flow_ql_tu_ds`, `flow_stc6`, `flow_stc7` đạt.
