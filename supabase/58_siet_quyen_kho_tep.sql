-- =====================================================================
-- BƯỚC 58: SIẾT QUYỀN KHO ẢNH / HÓA ĐƠN + GIẢM LỘ TRẠNG THÁI ĐĂNG NHẬP
-- Chạy sau 57. Chạy lại nhiều lần không sao.
--
-- Trước đây mọi tài khoản đang làm có thể gọi Storage trực tiếp để tải lên
-- hoặc xóa bất kỳ tệp nào trong bucket phieu-ca / hoa-don. Các hàm nghiệp vụ
-- có kiểm tra quyền nhưng policy Storage rộng hơn nên có thể bị đi vòng.
-- =====================================================================

-- Ảnh phiếu ca mới có dạng r<report_id>/<ipos|hang>/<file>.
-- Trong thời gian chuyển phiên bản vẫn nhận đường dẫn cũ r<report_id>/<file>,
-- nhưng chỉ khi chính người gọi đang giữ một phần việc chưa hoàn thành.
create or replace function public.app__storage_ca_upload(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  m text[] := regexp_match(coalesce(p_name, ''), '^r([0-9]+)/(ipos|hang)/[^/]+$');
  old_m text[];
  rid bigint;
  wanted_part text;
  aid bigint := (public.app_account()).id;
begin
  if aid is null then return false; end if;
  if m is not null then
    rid := m[1]::bigint;
    wanted_part := case when m[2] = 'ipos' then 'tien' else 'nhan_hang' end;
    return exists (
      select 1 from public.shift_reports r
      join public.shift_report_parts pt on pt.report_id = r.id and pt.part = wanted_part
      where r.id = rid and r.status = 'dang_chot'
        and pt.claimed_by = aid and pt.done_at is null
        and public.app__ca_part_can(r.id)
    );
  end if;
  old_m := regexp_match(coalesce(p_name, ''), '^r([0-9]+)/[^/]+$');
  if old_m is null then return false; end if;
  rid := old_m[1]::bigint;
  return exists (
    select 1 from public.shift_reports r
    join public.shift_report_parts pt on pt.report_id = r.id
    where r.id = rid and r.status = 'dang_chot'
      and pt.claimed_by = aid and pt.done_at is null
      and public.app__ca_part_can(r.id)
  );
end $$;
-- Tệp hóa đơn mới: hd<invoice_id>/<file> (Kế toán).
-- Ảnh nhận hàng mới: nhan<invoice_id>/r<report_id>/<file>.
create or replace function public.app__storage_hd_upload(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  hd text[] := regexp_match(coalesce(p_name, ''), '^hd([0-9]+)/[^/]+$');
  nh text[] := regexp_match(coalesce(p_name, ''), '^nhan([0-9]+)/r([0-9]+)/[^/]+$');
  old_nh text[];
  iid bigint;
  rid bigint;
  a public.accounts := public.app_account();
begin
  if a.id is null then return false; end if;
  if hd is not null then
    return public.app_can('ke_toan')
      and exists (select 1 from public.delivery_invoices i where i.id = hd[1]::bigint);
  end if;
  if nh is not null then
    iid := nh[1]::bigint; rid := nh[2]::bigint;
    return exists (
      select 1 from public.delivery_invoices i
      join public.shift_reports r on r.id = rid and r.branch_id = i.branch_id
      join public.shift_report_parts pt on pt.report_id = r.id and pt.part = 'nhan_hang'
      where i.id = iid and i.recon_at is null
        and ((i.state = 'dang_chuyen' and i.work_date <= r.work_date)
          or i.received_report_id = r.id)
        and (public.app_can('doi_soat')
          or (pt.claimed_by = a.id and pt.done_at is null))
    );
  end if;
  -- Tương thích ngắn hạn với web cũ: vẫn buộc người gọi đang giữ phần
  -- nhận hàng của đúng phiếu ca; quản lý đối soát được làm thay.
  old_nh := regexp_match(coalesce(p_name, ''), '^nhan([0-9]+)/[^/]+$');
  if old_nh is null then return false; end if;
  iid := old_nh[1]::bigint;
  return exists (
    select 1 from public.delivery_invoices i
    where i.id = iid and i.recon_at is null
      and (public.app_can('doi_soat') or exists (
        select 1 from public.shift_reports r
        join public.shift_report_parts pt on pt.report_id = r.id and pt.part = 'nhan_hang'
        where r.id = i.received_report_id and r.branch_id = i.branch_id and r.status = 'dang_chot'
          and i.work_date <= r.work_date
          and pt.claimed_by = a.id and pt.done_at is null
      ))
  );
end $$;

drop policy if exists phieu_ca_them on storage.objects;
drop policy if exists phieu_ca_xoa on storage.objects;
create policy phieu_ca_them on storage.objects for insert to authenticated
  with check (bucket_id = 'phieu-ca' and public.app__storage_ca_upload(name));
create policy phieu_ca_xoa on storage.objects for delete to authenticated
  using (bucket_id = 'phieu-ca'
    and (owner_id = auth.uid()::text or public.app_can('doi_soat')
      or public.app__storage_ca_upload(name)));

drop policy if exists hoa_don_them on storage.objects;
drop policy if exists hoa_don_xoa on storage.objects;
create policy hoa_don_them on storage.objects for insert to authenticated
  with check (bucket_id = 'hoa-don' and public.app__storage_hd_upload(name));
create policy hoa_don_xoa on storage.objects for delete to authenticated
  using (bucket_id = 'hoa-don' and (
    (name ~ '^hd[0-9]+/' and public.app_can('ke_toan'))
    or (name ~ '^nhan[0-9]+/' and (owner_id = auth.uid()::text or public.app_can('doi_soat')
      or public.app_can('ke_toan') or public.app__storage_hd_upload(name)))
  ));

-- Gắn ảnh nhận hàng với đúng phiếu ca; không còn chỉ dựa vào mã hóa đơn.
revoke execute on function public.app_nh_photo_add(bigint, text, bigint[]) from public, anon, authenticated;
create or replace function public.app_nh_photo_add(p_id bigint, p_report bigint, p_path text, p_lines bigint[]) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); i public.delivery_invoices; r public.shift_reports; nid bigint;
begin
  if a.id is null or not (public.app_can('chot_ca') or public.app_can('doi_soat')) then raise exception 'Bạn không có quyền.'; end if;
  select * into i from public.delivery_invoices where id = p_id;
  select * into r from public.shift_reports where id = p_report;
  perform public.app__nh_staff_can(i, r);
  if not public.app_can('doi_soat') and not public.app__ca_part_can(r.id) then raise exception 'Bạn không thuộc ca nhận hàng này.'; end if;
  if coalesce(p_path, '') !~ ('^nhan' || p_id || '/r' || p_report || '/') then raise exception 'Đường dẫn ảnh không hợp lệ.'; end if;
  insert into public.delivery_receipt_photos(invoice_id, path, created_by) values (p_id, p_path, a.id) returning id into nid;
  insert into public.delivery_photo_lines(photo_id, line_id)
  select nid, l.id from public.delivery_lines l
   where l.invoice_id = p_id and l.id = any(coalesce(p_lines, '{}')) on conflict do nothing;
  return nid;
end $$;

-- Giữ web đang chạy tương thích trong lúc GitHub Pages nhận bản mới. Đường
-- dẫn cũ không có report_id nên chỉ suy ra từ hóa đơn đã báo nhận, vẫn kiểm
-- tra đúng người đang giữ phần Nhận hàng trước khi ghi.
create or replace function public.app_nh_photo_add(p_id bigint, p_path text, p_lines bigint[]) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); i public.delivery_invoices; r public.shift_reports; nid bigint;
begin
  if a.id is null or not (public.app_can('chot_ca') or public.app_can('doi_soat')) then raise exception 'Bạn không có quyền.'; end if;
  select * into i from public.delivery_invoices where id = p_id;
  if i.id is null or i.received_report_id is null then raise exception 'Hóa đơn chưa gắn với phiếu ca nhận hàng.'; end if;
  select * into r from public.shift_reports where id = i.received_report_id;
  perform public.app__nh_staff_can(i, r);
  if r.status <> 'dang_chot' and not public.app_can('doi_soat') then raise exception 'Phiếu ca đã hoàn thành, không thêm ảnh được.'; end if;
  if coalesce(p_path, '') !~ ('^nhan' || p_id || '/[^/]+$') then raise exception 'Đường dẫn ảnh không hợp lệ.'; end if;
  insert into public.delivery_receipt_photos(invoice_id, path, created_by) values (p_id, p_path, a.id) returning id into nid;
  insert into public.delivery_photo_lines(photo_id, line_id)
  select nid, l.id from public.delivery_lines l
   where l.invoice_id = p_id and l.id = any(coalesce(p_lines, '{}')) on conflict do nothing;
  return nid;
end $$;

create or replace function public.app_nh_photo_tag(p_photo bigint, p_lines bigint[]) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); ph public.delivery_receipt_photos; i public.delivery_invoices;
begin
  select * into ph from public.delivery_receipt_photos where id = p_photo;
  if ph.id is null then raise exception 'Không tìm thấy ảnh.'; end if;
  select * into i from public.delivery_invoices where id = ph.invoice_id;
  if i.recon_at is not null then raise exception 'Quản lý đã đối soát hàng này nên không sửa ảnh được.'; end if;
  if ph.created_by is distinct from a.id and not public.app_can('doi_soat') and not exists (
    select 1 from public.shift_report_parts pt
    where pt.report_id = i.received_report_id and pt.part = 'nhan_hang'
      and pt.claimed_by = a.id and pt.done_at is null
  ) then raise exception 'Bạn không có quyền sửa ảnh này.'; end if;
  delete from public.delivery_photo_lines where photo_id = p_photo;
  insert into public.delivery_photo_lines(photo_id, line_id)
  select p_photo, l.id from public.delivery_lines l
   where l.invoice_id = ph.invoice_id and l.id = any(coalesce(p_lines, '{}')) on conflict do nothing;
end $$;

create or replace function public.app_nh_photo_del(p_photo bigint) returns text
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); ph public.delivery_receipt_photos; i public.delivery_invoices;
begin
  select * into ph from public.delivery_receipt_photos where id = p_photo;
  if ph.id is null then return null; end if;
  select * into i from public.delivery_invoices where id = ph.invoice_id;
  if i.recon_at is not null then raise exception 'Quản lý đã đối soát hàng này nên không xóa ảnh được.'; end if;
  if ph.created_by is distinct from a.id and not public.app_can('doi_soat') and not exists (
    select 1 from public.shift_report_parts pt
    where pt.report_id = i.received_report_id and pt.part = 'nhan_hang'
      and pt.claimed_by = a.id and pt.done_at is null
  ) then raise exception 'Bạn không có quyền xóa ảnh này.'; end if;
  delete from public.delivery_receipt_photos where id = p_photo;
  return ph.path;
end $$;

revoke execute on function public.app__storage_ca_upload(text), public.app__storage_hd_upload(text) from public, anon;
grant execute on function public.app__storage_ca_upload(text), public.app__storage_hd_upload(text) to authenticated;
revoke execute on function public.app_nh_photo_add(bigint, text, bigint[]), public.app_nh_photo_add(bigint, bigint, text, bigint[]), public.app_nh_photo_tag(bigint, bigint[]), public.app_nh_photo_del(bigint) from public, anon;
grant execute on function public.app_nh_photo_add(bigint, text, bigint[]), public.app_nh_photo_add(bigint, bigint, text, bigint[]), public.app_nh_photo_tag(bigint, bigint[]), public.app_nh_photo_del(bigint) to authenticated;

-- Không cho người ngoài phân biệt tài khoản ngừng làm / bị khóa / chưa có mật khẩu.
-- Email nội bộ vẫn chỉ trả về cho tài khoản hợp lệ vì web tĩnh cần nó để gọi Supabase Auth.
create or replace function public.app_login_email(p_login text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a record;
begin
  select ac.*, e.status as emp_status into a
  from public.accounts ac left join public.employees e on e.id = ac.employee_id
  where (ac.employee_id is not null and lower(e.code) = lower(trim(p_login)))
     or (ac.employee_id is null and ac.login_name is not null and lower(ac.login_name) = lower(trim(p_login)))
  order by ac.employee_id nulls last limit 1;
  if not found or (a.employee_id is not null and a.emp_status <> 'Đang làm')
     or a.locked = 1 or a.has_password = 0 or a.auth_email is null then
    return jsonb_build_object('error', 'sai');
  end if;
  return jsonb_build_object('email', a.auth_email);
end $$;
