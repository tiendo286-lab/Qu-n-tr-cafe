-- Bước 109 — thêm quyền "phan_cong" (xem Bảng phân công + Quá hạn & phạt) vào danh sách quyền web đọc (app_me → perms).
-- Chủ luôn có; Quản lý tổng bật sẵn (tệp 95); Quản lý / Nhân viên tắt. Chỉ tài khoản Chủ sửa bảng / xác nhận phạt (kiểm ở từng hàm).
create or replace function public.app__perm_keys() returns text[]
language sql immutable as $$
  select array['order_ca','xem_lich_minh','xem_tat_ca','xep_lich','chot_tuan','sua_order_sau_han',
    'quan_ly_nhan_vien','cai_gio_order','sua_danh_muc','bao_cao','danh_gia','phan_quyen','xoa_du_lieu_tuan','du_lieu',
    'chot_ca','doi_soat','mo_lai_phieu_ca','hop_giao_viec','nhan_viec','soan_tai_lieu','dao_tao','xu_ly_ho_tro','ke_toan','phan_cong']
$$;
insert into public.role_permissions(role, perm, allowed) values ('ql_tong', 'phan_cong', 1), ('ql', 'phan_cong', 0), ('nv', 'phan_cong', 0)
on conflict do nothing;
insert into public.app_migrations(file) values ('96_quyen_phan_cong.sql') on conflict (file) do nothing;
