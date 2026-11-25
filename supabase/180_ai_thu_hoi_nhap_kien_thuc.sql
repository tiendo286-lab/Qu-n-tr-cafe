-- 180 — Công ty AI: thu hồi quyền tự ghi kiến thức của máy Mac (đã nhập xong 29 điều chốt cũ ngày 26/11/2026).
-- Từ nay kiến thức chỉ được ghi khi anh Tiến bấm "Đúng" trên trang (app_ai_dong_y). Chạy lại nhiều lần không lỗi.
revoke execute on function public.app__ai_nhap_kien_thuc(text, text) from ai_viec;
insert into public.app_migrations(file) values ('180_ai_thu_hoi_nhap_kien_thuc.sql') on conflict (file) do nothing;
