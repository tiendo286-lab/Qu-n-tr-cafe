# Hướng dẫn cho Claude — web quản lý Milano & Lela

## Người dùng
- Chủ hệ thống: anh Tiến, chủ quán cafe ở Hải Phòng (Milano Coffee: LHP, ĐK, HS; Lela: LL, LLB). **Không phải lập trình viên.**
- Luôn trả lời bằng **tiếng Việt đơn giản**, tránh thuật ngữ; nói rõ đã làm gì, đã kiểm tra gì, anh cần làm gì tiếp.

## Kiến trúc
- Web tĩnh trong `docs/` chạy trên GitHub Pages: https://tiendo286-lab.github.io/Qu-n-tr-cafe/ (đẩy lên `main` là tự triển khai, mất ~5–7 phút).
- JavaScript thuần (ES modules, định tuyến bằng `#/...`), mẫu HTML qua `html\`\`` trong `docs/js/ui.js` (tự thoát ký tự). Menu ở `HUBS` và trang ở `PAGES` trong `docs/js/app.js`.
- Máy chủ: Supabase (dự án `krndtaskjhjpnqauoqiw`, vùng Singapore). Mọi bảng bật RLS và thu hồi quyền; web chỉ gọi hàm `app_*` (SECURITY DEFINER). Hàm nội bộ `app__*` không cho gọi từ web. Quyền kiểm tra bằng `app_can('<quyền>')`.
- Thay đổi CSDL = **thêm tệp mới có số thứ tự** trong `supabase/` (vd `15_....sql`), viết để chạy lại nhiều lần không sao. Tệp đã chạy thì không sửa lại.
- Tính năng đã chốt và việc còn để ngỏ: `tai_lieu/TINH_NANG_DA_CHOT.md` (đọc trước khi làm). Giả định tạm: `tai_lieu/GIA_DINH_CHO_CHOT.md`.

## Quy tắc bắt buộc
- Kho mã này **công khai**. **Không bao giờ** đưa lên GitHub: mã `sbp_`, khóa `service_role`/`sb_secret`, mật khẩu CSDL, token GitHub; dữ liệu thật (`du_lieu/`, `*.sqlite3`), tên nhân viên thật.
- Cập nhật Supabase: dùng Management API (`https://api.supabase.com/v1/projects/krndtaskjhjpnqauoqiw/database/query`) với mã `sbp_` anh Tiến cấp. **Chạy thử trước** trong khối `DO $$ ... RAISE EXCEPTION 'REPORT>> %' ... $$` (tự hoàn tác), xem kết quả rồi mới chạy thật. Dùng xong nhắc anh **Revoke** mã ở https://supabase.com/dashboard/account/tokens.
- Không dùng `x IN (a, NULL)` / `= NULL` trong kiểm tra quyền (ra NULL → bỏ qua kiểm tra); dùng `coalesce`.
- **Mỗi lần cập nhật web** (đẩy lên `main`), ghi/cập nhật một dòng trong bảng `app_releases` trên Supabase: `version` = ngày phát hành `YYYY.MM.DD` (nhiều lần trong ngày thì gộp vào dòng của ngày, hoặc `.2`, `.3`), các mảng `added` / `changed` / `fixed` / `removed` viết tiếng Việt dễ hiểu, `released_by`. Trang LOG hệ thống đọc bảng này.
- Commit với tên `Tien Do <tiendo286@gmail.com>`, cuối thông điệp có dòng `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Khi làm trên đám mây: làm trên nhánh riêng và mở PR; anh Tiến gộp (merge) vào `main` để lên web. Đổi CSDL thì phải cập nhật Supabase **trước** khi gộp giao diện cần nó.
- **Sổ tệp đã chạy** (từ bước 59): mỗi tệp SQL mới, dòng cuối cùng là `insert into public.app_migrations(file) values ('NN_ten_tep.sql') on conflict (file) do nothing;`. Trước khi đặt số thứ tự mới, xem `select max(file) from app_migrations` (trang LOG › Tệp máy chủ đã chạy) để không trùng số.
- **Mỗi lần đẩy giao diện lên `main`**: tăng số trong `docs/version.json` (vd `2026.11.13.2`) — web đang mở sẽ hiện "Có bản mới — Tải lại".
- Bảng mới: mặc định không cấp quyền cho `anon` / `authenticated` (bước 59); web đọc / ghi qua hàm `app_*`. Sao lưu tự lấy mọi bảng (`app__backup_tables`), không cần thêm tay.
- **Chỉ một phiên AI làm việc trên dự án tại một thời điểm** (tránh sửa trùng tệp / trùng số thứ tự SQL). Bắt đầu phiên: `git pull`, xem `git log -5` và sổ tệp đã chạy.

## Kiểm tra
- Giao diện chạy thử với Supabase giả lập: `kiem_tra/trinh_duyet/` (xem README ở đó). Không có dữ liệu thật thì bỏ qua bước dựng dữ liệu, chỉ kiểm tra cú pháp + logic.
- Sau khi đổi giao diện, kiểm tra cả khung điện thoại (390px) không bị tràn ngang.
