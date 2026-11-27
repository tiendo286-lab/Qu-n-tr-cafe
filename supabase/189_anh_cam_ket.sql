-- 189 (anh Tiến chốt 27/11/2026): ẢNH BẢN CAM KẾT ĐÃ KÝ.
--  * Kế toán / người quản lý nhân viên (đúng người đang đổi được trạng thái cam kết — không mở thêm quyền) tải 1 ảnh bản đã ký cho từng nhân viên,
--    đổi ảnh, xoá ảnh. KHÔNG bắt buộc có ảnh mới đổi được "Đã ký và nộp".
--  * Ai xem ảnh: người có quyền Kế toán / Quản lý nhân viên (Chủ luôn có) + CHÍNH nhân viên đó. Người khác không xem được.
--  * Ảnh nằm trong kho riêng tư `cam-ket`, đường dẫn `<mã số nhân viên>/<tên tệp>`; web xem bằng đường dẫn tạm.
--  Chạy lại nhiều lần không lỗi.

alter table public.employee_commitments add column if not exists photo_path text;
alter table public.employee_commitments add column if not exists photo_at text;
alter table public.employee_commitments add column if not exists photo_by bigint;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cam-ket', 'cam-ket', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- người được quản lý cam kết (cùng điều kiện với app_tl_set_commit)
create or replace function public.app__ck_manage() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_can('quan_ly_nhan_vien'), false) or coalesce(public.app_can('ke_toan'), false)
$$;

drop policy if exists cam_ket_doc on storage.objects;
drop policy if exists cam_ket_them on storage.objects;
drop policy if exists cam_ket_xoa on storage.objects;
create policy cam_ket_doc on storage.objects for select to authenticated using (bucket_id = 'cam-ket'
  and ((select public.app__ck_manage()) or split_part(name, '/', 1) = coalesce((select public.app_my_employee())::text, '-')));
create policy cam_ket_them on storage.objects for insert to authenticated with check (bucket_id = 'cam-ket' and (select public.app__ck_manage()));
create policy cam_ket_xoa on storage.objects for delete to authenticated using (bucket_id = 'cam-ket' and (select public.app__ck_manage()));

-- Ghi / đổi / xoá ảnh (p_path null = xoá). Trả đường dẫn ảnh CŨ để web xoá tệp khỏi kho.
create or replace function public.app_tl_commit_photo(p_employee bigint, p_path text) returns text
language plpgsql security definer set search_path = public as $$
declare a public.accounts; old_path text; np text := nullif(trim(coalesce(p_path, '')), '');
begin
  a := public.app__need(null);
  if not public.app__ck_manage() then raise exception 'Chỉ Kế toán hoặc người quản lý nhân viên được tải ảnh bản cam kết.'; end if;
  if not exists (select 1 from public.employees e where e.id = p_employee) then raise exception 'Không tìm thấy nhân viên.'; end if;
  if np is not null and np not like p_employee::text || '/%' then raise exception 'Đường dẫn ảnh không đúng nhân viên.'; end if;
  select c.photo_path into old_path from public.employee_commitments c where c.employee_id = p_employee;
  insert into public.employee_commitments(employee_id, photo_path, photo_at, photo_by)
  values (p_employee, np, case when np is not null then public.vn_now_text() end, case when np is not null then a.id end)
  on conflict (employee_id) do update set photo_path = excluded.photo_path, photo_at = excluded.photo_at, photo_by = excluded.photo_by;
  perform public.app_log('cam_ket_anh', 'employee=' || p_employee || ':' || case when np is null then 'xoa' else 'tai' end);
  return case when old_path is distinct from np then old_path end;
end $$;

-- Nhân viên xem cam kết của chính mình (trạng thái + ảnh)
create or replace function public.app_tl_my_commit() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; c public.employee_commitments;
begin
  a := public.app__need(null);
  if a.employee_id is null then return null; end if;
  select * into c from public.employee_commitments where employee_id = a.employee_id;
  return jsonb_build_object('status', coalesce(c.status, 'chua_ky'), 'photo_path', c.photo_path, 'photo_at', c.photo_at);
end $$;

-- Trang Theo dõi đọc & cam kết: thêm ảnh vào từng dòng (vá thay chuỗi trên bản đang chạy; đã vá thì bỏ qua, không thấy đúng một chỗ thì DỪNG)
do $$
declare d text := pg_get_functiondef('public.app_tl_follow()'::regprocedure);
  cu text := '''commit_due'', public.app__tl_commit_due(e)) order by e.code)';
  moi text := '''commit_due'', public.app__tl_commit_due(e), ''commit_photo'', c.photo_path, ''commit_photo_at'', c.photo_at, ''commit_photo_by'', public.app__acc_name(c.photo_by)) order by e.code)';
begin
  if position('''commit_photo''' in d) = 0 then
    if (length(d) - length(replace(d, cu, ''))) / length(cu) <> 1 then raise exception 'Tệp 189: app_tl_follow không có đúng một chỗ cần vá — dừng.'; end if;
    execute replace(d, cu, moi);
  end if;
end $$;

revoke all on function public.app__ck_manage() from public, anon;
grant execute on function public.app__ck_manage() to authenticated;   -- luật kho tệp gọi hàm này với vai authenticated
revoke all on function public.app_tl_commit_photo(bigint, text), public.app_tl_my_commit() from public, anon;
grant execute on function public.app_tl_commit_photo(bigint, text), public.app_tl_my_commit() to authenticated;

insert into public.app_migrations(file) values ('189_anh_cam_ket.sql') on conflict (file) do nothing;
