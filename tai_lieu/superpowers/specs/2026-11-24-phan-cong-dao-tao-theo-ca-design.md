# Phân công đào tạo theo ca — thiết kế (anh Tiến 24/11/2026)

Trang mẫu đã duyệt qua 11 lần sửa (bản riêng, không lưu trong kho). Bản này mô tả cách làm thật.

## Vì sao làm

- Người phụ trách chính (PTC) nhận đào tạo trực tiếp cho **toàn bộ** nhân viên mới. PTC cần một màn hình
  phân công **dễ thao tác, dễ kiểm soát**: ai dạy, dạy mục nào, ca nào, đã chấm chưa.
- Màn hình hiện nay (tab Phân công trong Công việc › Đào tạo) giao theo hạng mục, không gắn ngày / ca cụ thể.
  Người dạy không biết ca nào phải dạy gì; PTC không thấy ca nào bị trễ.

## Mục tiêu

1. Trang **Phân công đào tạo** mới, chạy **song song** với trang cũ (trang cũ, phiếu cũ giữ nguyên, dùng chung dữ liệu).
2. Xếp theo **nhân viên mới**: mỗi người một thẻ, mở ra là danh sách các ca của người đó theo **lịch đã công bố**.
3. Bấm một ca: chọn người dạy (người làm cùng ca hiện sẵn thành nút: Cấp 1 + Quản lý), tích các mục, bấm **Phân công**.
   Một ca có **nhiều người dạy**, mỗi người một phần.
4. Mục đã giao ở ca khác hiện ghi chú "Đã giao T3 24/11 · B" (tránh tích nhầm); mục đã đạt không hiện; mục chờ kiểm tra bị khoá.
   Tích một mục đã giao ở ca khác (chưa chấm) = **chuyển** mục sang ca này.
5. Ngày đã qua / hôm nay: bấm vào hiện **chi tiết như phiếu** (giới thiệu, thực hành, mức, giờ, người tích, xác nhận).
6. **Ngày thứ mấy** = thứ tự ca đi làm thật của nhân viên mới (theo lịch đã công bố, kể từ ngày bắt đầu), không theo lịch giáo trình.
7. **Chờ kiểm tra** nằm trong thẻ từng nhân viên (không còn tab riêng ở trang mới); bấm Xác nhận đạt ngay tại đó.
8. **Lọc người dạy + ngày**: xem một người phải dạy gì trong một ngày.
9. **Quản lý được giao lại cho Cấp 1** (mở thêm quyền, anh Tiến đồng ý 24/11): quản lý được PTC giao việc ở một ca
   được giao lại **chỉ phần của mình** cho một người **Cấp 1**; Lấy lại khi Cấp 1 chưa chấm.
   Cấp 1 chấm xong thì **quản lý đó hoặc PTC** xác nhận đạt. PTC nhìn thấy "C (A giao lại)".
10. Người dạy thấy **Việc đào tạo của tôi** trên trang Việc hôm nay: ca nào, dạy ai, mục nào; quản lý thấy thêm
    nút Giao lại cho Cấp 1, Lấy lại, và khung Chờ bạn kiểm tra.

## Không làm (đợt này)

- Không sửa phiếu đào tạo cũ (tab ngày của phiếu vẫn theo giáo trình). Đánh số ngày theo lịch làm trên phiếu: đợt sau.
- Không bỏ trang Phân công cũ, không bỏ tab Chờ kiểm tra cũ — bỏ khi anh Tiến thấy trang mới dùng ổn.
- Không đổi cách chấm mức, cách tính đạt, cách nhận xét cuối, không đổi quyền ai được mở / ghi phiếu.
- Không tự động gán PTC làm Người hướng dẫn chính cho phiếu mới (anh tự chọn PTC trên web; giữ như cũ).

## Cách làm (đã chọn)

- **Cách đã chọn — mở rộng bảng phân công hạng mục hiện có** (`training_followups`): thêm ngày, ca, "giao lại bởi".
  Quyền tích, thông báo, Chờ kiểm tra, lịch sử đều chạy tiếp. Một mục luôn thuộc đúng một người; chuyển ca = sửa dòng đó.
  Đổi lại: một mục không nằm ở hai ca cùng lúc (chuyển đi là rời ca cũ) — lịch sử tích vẫn giữ ai đã ghi.
- Cách bỏ: bảng "kế hoạch ca" riêng tách khỏi bảng phân công — phải đồng bộ hai nơi, quyền tích trên phiếu không biết
  kế hoạch, dễ lệch khi chạy song song với trang cũ.

## Máy chủ (tệp mới `174_phan_cong_dao_tao_theo_ca.sql`, chạy lại nhiều lần không lỗi)

Bảng `training_followups` thêm cột:
- `work_date date` — ngày ca dạy (trống = chưa xếp ca, như phân công cũ).
- `work_shift text` — tên ca (Sáng / Chiều / Tối… như `schedule_published.shift`). Cơ sở dùng cột `branch_id` sẵn có.
- `sub_by bigint → employees` — quản lý đã giao lại mục này cho Cấp 1 (trống = giao thẳng).

Chạy song song an toàn: trigger trước khi sửa dòng — nếu người được giao đổi mà **không** đi qua hàm mới
(cờ phiên `app.dt_plan`), thì xoá ngày / ca / giao lại bởi. Nghĩa là trang cũ giao lại một mục thì mục rời khỏi ca cũ,
trang mới hiện "đã giao, chưa xếp ca".

Hàm mới (đều `SECURITY DEFINER`, quyền kiểm tra bên trong):
- `app_dt_plan_board()` — cho người có quyền giao (Chủ, PTC, HDC của phiếu): các phiếu đang đào tạo, mỗi phiếu kèm
  ca theo lịch đã công bố (từ ngày bắt đầu), phân công theo ca, trạng thái từng mục (chưa / giới thiệu / chờ kiểm tra / đạt),
  danh sách người dạy được chọn (Quản lý, Cấp 1 có tài khoản hoạt động) và ai làm cùng ca nào.
- `app_dt_plan_assign(p_id, p_date, p_shift, p_branch, p_employee, p_items int[])` — giao các mục cho một người ở một ca.
  Quyền như giao hạng mục hiện nay (`app__dt_can_assign`). Gọi lại `app_dt_followup_save` cho từng mục (dùng chung kiểm tra
  người dạy hợp lệ, thông báo gộp một lần như giao hàng loạt). Mục đã đạt / đang chờ kiểm tra: bỏ qua. Mục người này đang có ở
  ca này mà bỏ tích: trả về chưa xếp ca (người hướng dẫn chính).
- `app_dt_plan_unassign(p_id, p_date, p_shift, p_employee)` — bỏ phần của một người ở một ca (mục chưa chấm).
- `app_dt_sub_assign(p_id, p_date, p_shift, p_employee, p_items int[])` — quản lý giao lại cho Cấp 1. Chỉ người đang giữ phần
  ở ca đó (rank Quản lý), chỉ mục của mình (hoặc mục mình đã giao lại) và chưa chấm; người nhận phải là Cấp 1 có tài khoản.
  Mục bỏ tích của người nhận quay về quản lý. Ghi `sub_by`. Thông báo cho Cấp 1.
- `app_dt_sub_take(p_id, p_date, p_shift, p_employee)` — Lấy lại các mục chưa chấm từ Cấp 1.
- `app_dt_my_plan()` — cho người dạy: các ca tôi được giao (từ hôm qua trở đi) hoặc tôi đã giao lại, và các mục chờ tôi kiểm tra.
- Sửa `app_dt_check_ok`: thêm người được xác nhận = quản lý đã giao lại mục đó (`sub_by`). Sửa `app_dt_mark`: Cấp 1 ghi mức mục
  do quản lý giao lại thì báo thêm quản lý đó. Không đổi gì khác trong hai hàm.
- Không đụng vùng khoá tiền, `app_can`, `role_permissions`.

## Giao diện

- Trang mới `#/dao-tao/phan-cong` — "Phân công đào tạo", trong menu Công việc ngay dưới "Đào tạo". Ai mở được: người có
  phiếu để giao (Chủ, PTC, HDC). Người khác mở thì thấy "Việc đào tạo của tôi".
- Bố cục theo trang mẫu: ô tổng (đang đào tạo / ca trễ chưa chấm / chờ kiểm tra), ô lọc người dạy + ngày, thẻ từng nhân viên
  (Đạt x/68, hạn, cảnh báo thiếu ca so với hạn, khung Chờ kiểm tra, danh sách ca có Ngày thứ mấy), bảng dưới để Phân công /
  Chi tiết ngày. Chi tiết ngày lấy từ dữ liệu phiếu (`app_dt_get` + `app_dt_history`), hiện như tab ngày của phiếu.
- Việc hôm nay (`viec.js`): thêm khối **Việc đào tạo của tôi** ở đầu nếu có (ca hôm nay và sắp tới, Chờ bạn kiểm tra,
  Giao lại cho Cấp 1, Lấy lại). Không đụng danh sách việc hiện có.
- Điện thoại 390px không tràn ngang.

## Kiểm tra

- Bài thử máy chủ trên Supabase giả lập: giao / chuyển ca / bỏ giao / giao lại / lấy lại / xác nhận của quản lý giao lại /
  trang cũ giao đè thì xoá ca / người không có quyền bị chặn.
- Bài thử trình duyệt `kiem_tra/trinh_duyet`: trang mới (Chủ, PTC, quản lý, Cấp 1) ở máy tính + điện thoại 390px;
  Việc hôm nay có khối mới; trang Đào tạo cũ vẫn chạy.
- Lên web: chạy thử tệp 174 trong khối tự hoàn tác trên máy chủ thật, xem kết quả, rồi chạy thật (ngoài giờ cao điểm),
  sau đó mới đẩy giao diện. Tăng `docs/version.json`, ghi `app_releases`.

## Để người làm tự quyết

- Tên nút, câu chữ, màu — theo trang mẫu và web hiện có.
- Cách tải dữ liệu chi tiết ngày (gọi khi bấm, không tải trước).
- Nhận xét ngày: dùng nhận xét ngày sẵn có của phiếu (một nhận xét / ngày); hai người dạy cùng ngày thì người ghi trước ký.
