# Bản FastAPI/SQLite cũ – hướng dẫn chạy thử

> Tài liệu này chỉ dành cho bản cũ trong `app/`. Web đang sử dụng nằm trong `docs/` và lưu dữ liệu trên Supabase. Xem `README.md` và `tai_lieu/HUONG_DAN_SUPABASE.md` khi làm web hiện tại.

## Chạy trên máy Mac
1. Mở thư mục này trong Finder, **bấm đúp `chay_thu.command`**.
   - Nếu macOS hỏi có mở không: chuột phải vào file → **Open** → **Open**.
   - Lần đầu sẽ mất 1–2 phút để cài thư viện (cần mạng).
2. Trình duyệt tự mở `http://127.0.0.1:8000`.
3. Đăng nhập Chủ lần đầu: mã **admin**, mật khẩu tạm nằm trong `du_lieu/MAT_KHAU_CHU_LAN_DAU.txt`.
   Web sẽ bắt đổi mật khẩu; đổi xong hãy xóa file đó.
4. Thử trên điện thoại (cùng Wi‑Fi): mở địa chỉ `http://<IP máy Mac>:8000` hiện trong cửa sổ Terminal.
5. Dừng web: đóng cửa sổ Terminal.

## Dữ liệu
- Lần chạy đầu, web **sao chép** dữ liệu từ bản offline
  (`~/Library/Application Support/QuanTriLichLamCafe/xep_lich.sqlite3`) sang `du_lieu/app.sqlite3`.
  File gốc của bản offline **không bị thay đổi**.
- Muốn làm lại từ dữ liệu offline mới nhất: đóng web, xóa `du_lieu/app.sqlite3`, chạy lại `chay_thu.command`.
- `du_lieu/ban_sao_offline_01-10-2026.sqlite3` chỉ dùng cho kiểm tra tự động.

## Gửi email khôi phục mật khẩu
Chép `du_lieu/cau_hinh.vi_du.json` thành `du_lieu/cau_hinh.json` và điền tài khoản email.
Với Gmail cần bật xác minh 2 bước rồi tạo **Mật khẩu ứng dụng** (16 ký tự) để điền vào `smtp_password`.
Chưa cài thì nút "Gửi mã qua email" sẽ báo nhờ quản lý cấp mật khẩu tạm.

## Chủ quên mật khẩu
Trong Terminal tại thư mục này: `.venv-mac/bin/python dat_lai_mat_khau_chu.py`

## Kiểm tra tự động
`.venv-mac/bin/python kiem_tra/kiem_tra_buoc1.py` (tương tự buoc2 … buoc6) – chạy trên bản sao, không đụng dữ liệu thật.

## Các bước
- [x] Bước 1: đăng nhập, tài khoản, phân quyền, cấp mật khẩu tạm
- [x] Bước 2: danh mục – chi nhánh, ca, nhân viên, định biên, lịch cố định
- [x] Bước 3: order ca
- [x] Bước 4: xếp lịch cơ sở, khóa xếp lịch, chốt tuần
- [x] Bước 5: cảnh báo, lịch của nhân viên, thông báo
- [x] Bước 6: đủ chức năng bản offline 1.7.6 + quản lý tài khoản

## Cách dùng bước 4 (xếp lịch)
1. Tab **Order lịch làm**: sau khi hết hạn order, quản lý bấm **Bắt đầu xếp lịch** (tự đưa lịch cố định vào cho người đã order "đi làm được").
2. Tab **Lịch cơ sở**: chọn tuần + chi nhánh, bấm ô để chọn người. Chỉ 1 người xếp một tuần; sau 15 phút không thao tác sẽ tự nhả khoá (Chủ có thể giành quyền).
3. Bấm **Chốt tuần** → hiện tóm tắt cảnh báo, chốt xong lịch bị khoá và nhân viên nhận thông báo. Cần sửa thì dùng **Mở lại**, chốt lần sau chỉ báo những người bị đổi ca.

## Cách dùng bước 5
- **Cảnh báo** (quản lý có quyền xếp lịch): chọn tuần, xem 6 nhóm cảnh báo + số ca mỗi người; bấm *Mở* để nhảy tới ca đó trong Lịch cơ sở.
- **Nhân viên** dùng thanh dưới màn hình: *Order ca* · *Lịch làm* (Lịch của tôi / Lịch cơ sở 4 chi nhánh, chỉ thấy lịch đã chốt) · *Thông báo* (có số chưa đọc).
- **Thông báo tự động**: mở order tuần mới; còn dưới 3 giờ là hết hạn (chỉ người chưa order); lịch được chốt; lịch chốt bị sửa (chỉ người đổi ca). Tự xóa sau 60 ngày.

## Bước 6 – chức năng lấy từ bản offline 1.7.6
Phần xử lý dữ liệu dùng lại nguyên mã gốc của bản offline (`app/legacy/`, bản gốc đầy đủ ở `tham_khao/`).
- **Tổng quan** (trang chủ quản lý): số nhân viên, tiến độ order, trạng thái tuần, cảnh báo, đánh giá gần nhất.
- **Xếp lịch làm tổng**: bảng mọi nhân viên × mọi ca trong tuần, chọn “cơ sở – vị trí” ngay trong ô; bảng tổng định biên;
  nút *Xếp theo order & lịch cố định*, *Cập nhật order vào lịch* (giữ ca đã xếp), *Xóa lịch tuần*. Dùng chung khóa xếp lịch với Lịch cơ sở.
- **Chốt lịch & báo cáo**: 7 tab Xem lịch tuần (theo nhân viên / theo cơ sở) · Cảnh báo · Định biên · Nhân viên · Order · Cơ sở · Lịch 30 ngày;
  chốt / mở lại tuần; xuất báo cáo Excel 7 sheet như bản offline; xuất lịch đang xem.
- **Đánh giá nhân viên**: tạo lần đánh giá, chọn bộ tiêu chí (sao chép từ lần trước), xuất dữ liệu tạo Google Form, nhập phản hồi Form,
  chấm tay từng phiếu (Lưu & chuyển người tiếp theo), chốt / mở lại, xuất Excel voucher, nhập file voucher, in toàn bộ phiếu
  (A4 ngang, 2 phiếu A5/tờ, mặt sau mã voucher — bấm *In / Lưu PDF* trên trình duyệt); tab Tổng hợp, Lịch sử nhân viên, Tiêu chí, Cài đặt xếp loại.
- **Nhân viên**: nhập Excel, tải file mẫu, xuất danh sách cho Google Form, xóa nhân viên nhập nhầm (chưa phát sinh dữ liệu).
- **Order lịch làm**: nhập câu trả lời Google Form, tải file mẫu order, xóa order tuần, khôi phục bản trước.
- **Chi nhánh, ca**: xóa khi chưa phát sinh dữ liệu (đã có dữ liệu thì chuyển Ngừng hoạt động/Ngừng sử dụng).
- **Tài khoản đăng nhập**: trạng thái từng tài khoản, cấp mật khẩu tạm từng người hoặc hàng loạt (in phiếu cắt nhỏ), khóa / mở khóa,
  buộc đăng xuất mọi thiết bị, tạo tài khoản riêng không phải nhân viên (chỉ Chủ).
- **Dữ liệu & sao lưu** (chỉ Chủ): tải / nhập gói ZIP cùng định dạng bản offline. Nhập gói từ bản offline vẫn **giữ tài khoản và mật khẩu web**
  (khớp theo mã NV). Sao lưu tự động mỗi ngày vào `du_lieu/sao_luu` (giữ 20 bản / 30 ngày), có nút sao lưu ngay và tải bản sao lưu.
- **Phân quyền**: thêm 2 quyền “Xem báo cáo, xếp lịch tổng, xuất Excel” và “Đánh giá nhân viên, voucher” (mặc định Quản lý tổng có).
- Khác bản offline: web **không tự xóa tuần cũ hơn 30 ngày** và không tự tạo tuần khi mở — giữ toàn bộ lịch sử.
