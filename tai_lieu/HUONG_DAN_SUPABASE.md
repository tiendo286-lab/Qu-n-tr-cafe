# Cài bản web mới: GitHub Pages + Supabase

Trang web nằm trong thư mục `docs/` (GitHub Pages), dữ liệu và đăng nhập nằm trên Supabase.
Làm lần lượt các bước dưới đây **một lần duy nhất**.

Dự án Supabase: `https://krndtaskjhjpnqauoqiw.supabase.co`

## 1. Cài đặt đăng nhập (Authentication)
1. Supabase → **Authentication → Sign In / Providers** (hoặc *Providers*).
2. Tắt **Allow new users to sign up** (không cho người lạ tự đăng ký). Bấm **Save**.
3. Mục **Email**: tắt **Confirm email**. Bấm **Save**.

## 2. Tạo tài khoản Chủ
1. **Authentication → Users → Add user → Create new user**.
2. Email: `admin@milano.invalid` (nếu báo không hợp lệ thì dùng `admin@example.com`).
3. Password: mật khẩu Chủ của anh (ít nhất 6 ký tự). Tick **Auto Confirm User**. Bấm **Create user**.

## 3. Tạo bảng và phân quyền (SQL Editor)
Supabase → **SQL Editor → New query**. Lần lượt mở từng file trên GitHub, bấm nút **Copy raw file**, dán vào và bấm **Run**:
1. `supabase/01_bang.sql` → phải hiện *Success*.
2. `supabase/02_bao_mat.sql` → *Success*.
3. `supabase/03_tao_tai_khoan_chu.sql` → bảng kết quả ghi **Đã gắn OK**.

## 4. Cài hàm quản lý tài khoản (Edge Function)
1. Supabase → **Edge Functions → Deploy a new function → Via Editor**.
2. Tên hàm: `admin` (đúng chữ thường).
3. Xóa code mẫu, dán toàn bộ file `supabase/functions/admin/index.ts`, bấm **Deploy function**.
4. Vào hàm `admin` → **Details** (hoặc Settings) → tắt **Verify JWT / Enforce JWT verification** → **Save**.

## 5. Bật GitHub Pages
1. GitHub → kho `Qu-n-tr-cafe` → **Settings → Pages**.
2. Source: **Deploy from a branch**. Branch: **main**, thư mục **/docs** → **Save**.
3. Chờ 1–2 phút. Link web: **https://tiendo286-lab.github.io/Qu-n-tr-cafe/**

## 6. Nhập dữ liệu
1. Mở link web, đăng nhập mã **admin** + mật khẩu ở bước 2.
2. Vào **Dữ liệu & sao lưu** → chọn file `DU_LIEU_MILANO_06-11-2026.zip` (trong thư mục Tải về) → **Nhập dữ liệu này** → gõ `NHAP`.
3. Vào **Tài khoản đăng nhập** → **Cấp & in danh sách** để phát mật khẩu tạm cho nhân viên.

## Ghi chú bảo mật
- Project URL và Publishable key nằm trong trang web là bình thường (được thiết kế để công khai).
- **Không bao giờ** đưa khóa `sb_secret_…` / `service_role`, mật khẩu database hay token `sbp_…` cho ai hoặc vào code.
- Email nội bộ dạng `a12@milano.invalid`: đuôi `.invalid` không nhận được thư, nên không ai lợi dụng "quên mật khẩu" của Supabase được.
- Gói Free của Supabase: nếu 7 ngày liền không ai dùng, dự án tạm dừng → vào Supabase bấm **Restore**.
