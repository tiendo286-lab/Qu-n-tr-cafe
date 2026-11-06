-- =====================================================================
-- QUẢN TRỊ LỊCH LÀM – BƯỚC 2: PHÂN QUYỀN, BẢO MẬT, HÀM DÙNG CHUNG
-- Chạy SAU file 01_bang.sql. Chạy lại nhiều lần không sao.
--
-- Nguyên tắc:
--  * Bảng nào cũng bật RLS: không đăng nhập thì không đọc/ghi được gì.
--  * Quyền theo vai trò (Chủ / Quản lý tổng / Quản lý / Nhân viên) giống hệt bản Python.
--  * Thao tác nhạy cảm (đăng nhập, phân quyền, nhập dữ liệu...) đi qua hàm SECURITY DEFINER có kiểm tra quyền.
-- =====================================================================

-- ---------------------------------------------------------------- Người đang đăng nhập
create or replace function public.app_account() returns public.accounts
language sql stable security definer set search_path = public as $$
  select a.* from public.accounts a
  left join public.employees e on e.id = a.employee_id
  where a.auth_user_id = auth.uid()
    and a.locked = 0
    and (a.employee_id is null or e.status = 'Đang làm')
  limit 1
$$;

create or replace function public.app_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select (public.app_account()).id is not null
$$;

create or replace function public.app_my_employee() returns bigint
language sql stable security definer set search_path = public as $$
  select (public.app_account()).employee_id
$$;

-- Quyền: giống User.can() của bản Python.
create or replace function public.app_can(p text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app_account();
  if a.id is null then return false; end if;
  if a.system_role = 'chu' then return true; end if;
  if p in ('phan_quyen', 'xoa_du_lieu_tuan', 'du_lieu') then return false; end if;
  if a.system_role = 'nv' then
    if p in ('order_ca', 'xem_lich_minh') then return true; end if;
    if p <> 'xem_tat_ca' then return false; end if;
  end if;
  return coalesce((select r.allowed = 1 from public.role_permissions r where r.role = a.system_role and r.perm = p), false);
end $$;

create or replace function public.app_log(p_action text, p_detail text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.app_staff() then return; end if;
  insert into public.audit_log(account_id, action, detail) values ((public.app_account()).id, p_action, p_detail);
end $$;

-- ---------------------------------------------------------------- Bật RLS + quy tắc đọc / ghi
do $$
declare
  t text;
  all_tables text[] := array[
    'settings','branches','shifts','branch_shifts','work_roles','weeks','employees','employee_contacts',
    'employee_branches','employee_roles','employee_work_plans','staffing_requirements','staffing_history',
    'order_entries','order_import_batches','order_snapshots','order_submissions','order_edit_log',
    'week_order_windows','fixed_schedule_members','fixed_schedule_entries','weekly_schedule_entries',
    'schedule_closures','schedule_extra_rows','schedule_locks','schedule_published','evaluation_criteria',
    'evaluation_rounds','evaluation_round_employees','evaluation_round_criteria','evaluation_round_scores',
    'evaluation_round_import_batches','evaluation_round_raw_submissions','evaluation_voucher_allocations',
    'accounts','role_permissions','audit_log','notifications','notification_events'];
  -- Ai đăng nhập (đang làm) cũng xem được
  staff_read text[] := array[
    'settings','branches','shifts','branch_shifts','work_roles','weeks','employees','employee_branches',
    'employee_roles','staffing_requirements','fixed_schedule_members','fixed_schedule_entries',
    'schedule_closures','schedule_published','week_order_windows','role_permissions','schedule_locks'];
  -- Cần quyền "Xem order và lịch của mọi người"
  all_read text[] := array[
    'weekly_schedule_entries','schedule_extra_rows','order_import_batches','order_snapshots',
    'staffing_history','employee_work_plans'];
  eval_tables text[] := array[
    'evaluation_criteria','evaluation_rounds','evaluation_round_employees','evaluation_round_criteria',
    'evaluation_round_scores','evaluation_round_import_batches','evaluation_round_raw_submissions',
    'evaluation_voucher_allocations'];
  catalog_write text[] := array[
    'branches','shifts','branch_shifts','work_roles','staffing_requirements','staffing_history',
    'fixed_schedule_members','fixed_schedule_entries'];
  emp_write text[] := array['employees','employee_branches','employee_roles','employee_contacts'];
  pol record;
begin
  foreach t in array all_tables loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
  end loop;

  foreach t in array staff_read loop
    execute format('create policy doc on public.%I for select to authenticated using ((select public.app_staff()))', t);
  end loop;
  foreach t in array all_read loop
    execute format('create policy doc on public.%I for select to authenticated using ((select public.app_can(''xem_tat_ca'')))', t);
  end loop;
  foreach t in array eval_tables loop
    execute format('create policy doc on public.%I for select to authenticated using ((select public.app_can(''danh_gia'')))', t);
    execute format('create policy them on public.%I for insert to authenticated with check ((select public.app_can(''danh_gia'')))', t);
    execute format('create policy sua on public.%I for update to authenticated using ((select public.app_can(''danh_gia''))) with check ((select public.app_can(''danh_gia'')))', t);
    execute format('create policy xoa on public.%I for delete to authenticated using ((select public.app_can(''danh_gia'')))', t);
  end loop;
  foreach t in array catalog_write loop
    execute format('create policy them on public.%I for insert to authenticated with check ((select public.app_can(''sua_danh_muc'')))', t);
    execute format('create policy sua on public.%I for update to authenticated using ((select public.app_can(''sua_danh_muc''))) with check ((select public.app_can(''sua_danh_muc'')))', t);
    execute format('create policy xoa on public.%I for delete to authenticated using ((select public.app_can(''sua_danh_muc'')))', t);
  end loop;
  foreach t in array emp_write loop
    execute format('create policy them on public.%I for insert to authenticated with check ((select public.app_can(''quan_ly_nhan_vien'')))', t);
    execute format('create policy sua on public.%I for update to authenticated using ((select public.app_can(''quan_ly_nhan_vien''))) with check ((select public.app_can(''quan_ly_nhan_vien'')))', t);
    execute format('create policy xoa on public.%I for delete to authenticated using ((select public.app_can(''quan_ly_nhan_vien'')))', t);
  end loop;
end $$;

-- Order: của mình, hoặc có quyền xem tất cả
create policy doc on public.order_entries for select to authenticated
  using (employee_id = (select public.app_my_employee()) or (select public.app_can('xem_tat_ca')));
create policy doc on public.order_submissions for select to authenticated
  using (employee_id = (select public.app_my_employee()) or (select public.app_can('xem_tat_ca')));
create policy doc on public.order_edit_log for select to authenticated
  using (employee_id = (select public.app_my_employee()) or (select public.app_can('xem_tat_ca')));
-- Liên hệ nhân viên: của mình, hoặc người quản lý nhân viên
create policy doc on public.employee_contacts for select to authenticated
  using (employee_id = (select public.app_my_employee()) or (select public.app_can('quan_ly_nhan_vien')));
-- Tài khoản: của mình, hoặc người quản lý nhân viên / phân quyền (ghi qua hàm riêng)
create policy doc on public.accounts for select to authenticated
  using (auth_user_id = auth.uid() or (select public.app_can('quan_ly_nhan_vien')) or (select public.app_can('phan_quyen')));
-- Thông báo: của mình
create policy doc on public.notifications for select to authenticated
  using (account_id = (select (public.app_account()).id));
-- Nhật ký: chỉ Chủ
create policy doc on public.audit_log for select to authenticated using ((select public.app_can('du_lieu')));
-- Giờ order theo tuần, cài đặt chung
create policy them on public.week_order_windows for insert to authenticated with check ((select public.app_can('cai_gio_order')));
create policy sua on public.week_order_windows for update to authenticated using ((select public.app_can('cai_gio_order'))) with check ((select public.app_can('cai_gio_order')));
create policy xoa on public.week_order_windows for delete to authenticated using ((select public.app_can('cai_gio_order')));
create policy them on public.settings for insert to authenticated with check ((select public.app_can('cai_gio_order')) or (select public.app_can('danh_gia')));
create policy sua on public.settings for update to authenticated using ((select public.app_can('cai_gio_order')) or (select public.app_can('danh_gia'))) with check (true);
-- Bảng quyền: chỉ Chủ
create policy sua on public.role_permissions for update to authenticated using ((select public.app_can('phan_quyen'))) with check ((select public.app_can('phan_quyen')));
create policy them on public.role_permissions for insert to authenticated with check ((select public.app_can('phan_quyen')));

-- ---------------------------------------------------------------- Tài khoản tự gắn với nhân viên
-- Thêm nhân viên → tự có tài khoản (chưa có mật khẩu). Nếu đã có tài khoản cũ cùng mã NV (sau khi nhập
-- lại dữ liệu) thì gắn lại tài khoản cũ, giữ nguyên mật khẩu và vai trò.
create or replace function public.app_employee_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    update public.accounts set employee_code = new.code where employee_id = new.id;
    return new;
  end if;
  update public.accounts set employee_id = new.id, employee_code = new.code
   where id = (select id from public.accounts
               where employee_id is null and employee_code is not null and lower(employee_code) = lower(new.code)
               order by id limit 1);
  if not found then
    insert into public.accounts(employee_id, employee_code, system_role)
    values (new.id, new.code, case when new.rank = 'Quản lý' then 'ql' else 'nv' end)
    on conflict (employee_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists employee_account on public.employees;
create trigger employee_account after insert or update of code on public.employees
  for each row execute function public.app_employee_account();

-- ---------------------------------------------------------------- Đăng nhập
-- Trang đăng nhập gõ mã NV (hoặc tên đăng nhập riêng) → trả về email nội bộ để đăng nhập Supabase Auth.
create or replace function public.app_login_email(p_login text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a record;
begin
  select ac.*, e.status as emp_status into a
  from public.accounts ac left join public.employees e on e.id = ac.employee_id
  where (ac.employee_id is not null and lower(e.code) = lower(trim(p_login)))
     or (ac.employee_id is null and ac.login_name is not null and lower(ac.login_name) = lower(trim(p_login)))
  order by ac.employee_id nulls last limit 1;
  if not found then return jsonb_build_object('error', 'sai'); end if;
  if a.employee_id is not null and a.emp_status <> 'Đang làm' then return jsonb_build_object('error', 'ngung'); end if;
  if a.locked = 1 then return jsonb_build_object('error', 'khoa'); end if;
  if a.has_password = 0 or a.auth_email is null then return jsonb_build_object('error', 'chua_co'); end if;
  return jsonb_build_object('email', a.auth_email);
end $$;

-- Thông tin người đang đăng nhập + bảng quyền
create or replace function public.app_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; e public.employees; perms jsonb := '{}'::jsonb; p text;
begin
  a := public.app_account();
  if a.id is null then return null; end if;
  select * into e from public.employees where id = a.employee_id;
  foreach p in array array['order_ca','xem_lich_minh','xem_tat_ca','xep_lich','chot_tuan','sua_order_sau_han',
    'quan_ly_nhan_vien','cai_gio_order','sua_danh_muc','bao_cao','danh_gia','phan_quyen','xoa_du_lieu_tuan','du_lieu'] loop
    perms := perms || jsonb_build_object(p, public.app_can(p));
  end loop;
  return jsonb_build_object(
    'account_id', a.id, 'employee_id', a.employee_id, 'role', a.system_role, 'must_change', a.must_change = 1,
    'code', coalesce(e.code, a.login_name), 'name', coalesce(e.name, a.display_name, 'Chủ'), 'rank', e.rank,
    'perms', perms);
end $$;

create or replace function public.app_touch_login() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.accounts set last_login_at = public.vn_now_text() where auth_user_id = auth.uid();
end $$;

-- Gọi sau khi người dùng tự đổi mật khẩu (supabase.auth.updateUser)
create or replace function public.app_password_changed() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.accounts set must_change = 0, has_password = 1, password_set_at = public.vn_now_text(),
         password_set_by = id
   where auth_user_id = auth.uid();
end $$;

-- ---------------------------------------------------------------- Phân quyền (chỉ Chủ)
create or replace function public.app_set_perm(p_role text, p_perm text, p_allowed boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.app_can('phan_quyen') then raise exception 'Chỉ Chủ được sửa phân quyền.'; end if;
  if p_role not in ('ql_tong', 'ql', 'nv') then raise exception 'Vai trò không hợp lệ.'; end if;
  if p_perm not in ('order_ca','xem_lich_minh','xem_tat_ca','xep_lich','chot_tuan','sua_order_sau_han',
                    'quan_ly_nhan_vien','cai_gio_order','sua_danh_muc','bao_cao','danh_gia') then
    raise exception 'Quyền không hợp lệ.';
  end if;
  if p_role = 'nv' and p_perm <> 'xem_tat_ca' then raise exception 'Quyền này không cấp được cho Nhân viên.'; end if;
  insert into public.role_permissions(role, perm, allowed, updated_at)
  values (p_role, p_perm, case when p_allowed then 1 else 0 end, public.vn_now_text())
  on conflict (role, perm) do update set allowed = excluded.allowed, updated_at = excluded.updated_at;
  perform public.app_log('sua_quyen', p_role || '.' || p_perm || '=' || p_allowed::text);
end $$;

create or replace function public.app_set_system_role(p_account bigint, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare old text;
begin
  if not public.app_can('phan_quyen') then raise exception 'Chỉ Chủ được cấp vai trò.'; end if;
  if p_role not in ('ql_tong', 'ql', 'nv') then raise exception 'Vai trò không hợp lệ.'; end if;
  select system_role into old from public.accounts where id = p_account;
  if old is null then raise exception 'Không tìm thấy tài khoản.'; end if;
  if old = 'chu' then raise exception 'Không đổi được vai trò của Chủ.'; end if;
  update public.accounts set system_role = p_role where id = p_account;
  perform public.app_log('doi_vai_tro', p_account || ':' || old || '->' || p_role);
end $$;

-- ---------------------------------------------------------------- Nhập dữ liệu (chỉ Chủ)
-- Thứ tự nạp: bảng cha trước, bảng con sau.
create or replace function public.app_import_tables() returns text[]
language sql immutable as $$ select array[
  'settings','branches','shifts','branch_shifts','work_roles','weeks','employees','employee_branches',
  'employee_roles','employee_work_plans','staffing_requirements','staffing_history','order_entries',
  'order_import_batches','order_snapshots','order_submissions','order_edit_log','week_order_windows',
  'fixed_schedule_members','fixed_schedule_entries','weekly_schedule_entries','schedule_closures',
  'schedule_extra_rows','schedule_published','evaluation_criteria','evaluation_rounds',
  'evaluation_round_employees','evaluation_round_criteria','evaluation_round_scores',
  'evaluation_round_import_batches','evaluation_round_raw_submissions','evaluation_voucher_allocations',
  'role_permissions'] $$;

-- Bước 1: xóa dữ liệu nghiệp vụ hiện có (tài khoản, mật khẩu, nhật ký được giữ lại).
create or replace function public.app_import_begin() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.app_can('du_lieu') then raise exception 'Chỉ Chủ được nhập dữ liệu.'; end if;
  update public.accounts a set employee_code = e.code from public.employees e where e.id = a.employee_id;
  update public.accounts set employee_id = null where employee_id is not null;
  truncate table public.employee_contacts, public.schedule_locks, public.notification_events,
    public.settings, public.branches, public.shifts, public.branch_shifts, public.work_roles, public.weeks,
    public.employees, public.employee_branches, public.employee_roles, public.employee_work_plans,
    public.staffing_requirements, public.staffing_history, public.order_entries, public.order_import_batches,
    public.order_snapshots, public.order_submissions, public.order_edit_log, public.week_order_windows,
    public.fixed_schedule_members, public.fixed_schedule_entries, public.weekly_schedule_entries,
    public.schedule_closures, public.schedule_extra_rows, public.schedule_published, public.evaluation_criteria,
    public.evaluation_rounds, public.evaluation_round_employees, public.evaluation_round_criteria,
    public.evaluation_round_scores, public.evaluation_round_import_batches, public.evaluation_round_raw_submissions,
    public.evaluation_voucher_allocations, public.role_permissions
    restart identity cascade;
end $$;

-- Bước 2: nạp từng bảng (gọi nhiều lần, mỗi lần một phần). Chỉ nhận các cột bảng có.
create or replace function public.app_import_rows(p_table text, p_rows jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare cols text; n integer;
begin
  if not public.app_can('du_lieu') then raise exception 'Chỉ Chủ được nhập dữ liệu.'; end if;
  if not (p_table = any(public.app_import_tables())) then raise exception 'Bảng không hợp lệ: %', p_table; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then return 0; end if;
  select string_agg(quote_ident(c.column_name), ',' order by c.ordinal_position) into cols
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = p_table
     and exists (select 1 from jsonb_object_keys(p_rows -> 0) k where k = c.column_name);
  if cols is null then return 0; end if;
  execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) on conflict do nothing',
                 p_table, cols, cols, p_table) using p_rows;
  get diagnostics n = row_count;
  if p_table = 'employees' then
    insert into public.employee_contacts(employee_id, email, phone)
    select (r ->> 'id')::bigint, nullif(r ->> 'email', ''), nullif(r ->> 'phone', '')
      from jsonb_array_elements(p_rows) r
     where coalesce(r ->> 'email', '') <> '' or coalesce(r ->> 'phone', '') <> ''
    on conflict (employee_id) do update set email = excluded.email, phone = excluded.phone;
  end if;
  return n;
end $$;

-- Bước 3: chỉnh bộ đếm id, bổ sung mặc định, áp vai trò từ bản web cũ (nếu có), ghi nhật ký.
-- p_roles: [{"code": "88", "role": "ql_tong"}, ...] – chỉ áp cho tài khoản chưa từng đặt mật khẩu.
create or replace function public.app_import_finish(p_roles jsonb default '[]'::jsonb, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare t text; seq text; result jsonb := '{}'::jsonb; n bigint;
begin
  if not public.app_can('du_lieu') then raise exception 'Chỉ Chủ được nhập dữ liệu.'; end if;
  foreach t in array public.app_import_tables() || array['employee_contacts'] loop
    seq := null;
    if exists (select 1 from information_schema.columns c
               where c.table_schema = 'public' and c.table_name = t and c.column_name = 'id') then
      seq := pg_get_serial_sequence('public.' || t, 'id');
    end if;
    if seq is not null then
      execute format('select setval(%L, coalesce((select max(id) from public.%I), 0) + 1, false)', seq, t);
    end if;
    execute format('select count(*) from public.%I', t) into n;
    result := result || jsonb_build_object(t, n);
  end loop;
  insert into public.role_permissions(role, perm, allowed) values
    ('ql_tong','order_ca',1),('ql_tong','xem_lich_minh',1),('ql_tong','xem_tat_ca',1),('ql_tong','xep_lich',1),
    ('ql_tong','chot_tuan',1),('ql_tong','sua_order_sau_han',1),('ql_tong','quan_ly_nhan_vien',1),
    ('ql_tong','cai_gio_order',1),('ql_tong','sua_danh_muc',1),('ql_tong','bao_cao',1),('ql_tong','danh_gia',1),
    ('ql','order_ca',1),('ql','xem_lich_minh',1),('ql','xem_tat_ca',1),('ql','xep_lich',0),('ql','chot_tuan',0),
    ('ql','sua_order_sau_han',0),('ql','quan_ly_nhan_vien',0),('ql','cai_gio_order',0),('ql','sua_danh_muc',0),
    ('ql','bao_cao',0),('ql','danh_gia',0),('nv','xem_tat_ca',0)
  on conflict (role, perm) do nothing;
  insert into public.settings(key, value) values
    ('order_open_dow','0'),('order_open_time','08:00'),('order_close_dow','3'),('order_close_time','22:00')
  on conflict (key) do nothing;
  if jsonb_typeof(p_roles) = 'array' then
    update public.accounts a set system_role = r.role
      from jsonb_to_recordset(p_roles) as r(code text, role text), public.employees e
     where e.id = a.employee_id and lower(e.code) = lower(r.code) and a.has_password = 0
       and a.system_role <> 'chu' and r.role in ('ql_tong', 'ql', 'nv');
  end if;
  perform public.app_log('nhap_du_lieu', p_note);
  return result;
end $$;

-- ---------------------------------------------------------------- Dành riêng cho Edge Function "admin"
-- Đăng xuất một người khỏi mọi thiết bị. Chỉ máy chủ (service_role) gọi được.
drop function if exists public.app_kill_sessions(uuid);
create or replace function public.app_kill_sessions(p_uid uuid) returns boolean
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.sessions where user_id = p_uid;
  return true;
exception when others then
  return false;  -- không có quyền xóa phiên: bỏ qua, không làm hỏng thao tác khác
end $$;

-- ---------------------------------------------------------------- Quyền gọi hàm
revoke execute on all functions in schema public from public, anon;
grant execute on function public.app_login_email(text) to anon, authenticated;
grant execute on function public.vn_now(), public.vn_now_text() to anon, authenticated;
grant execute on function public.app_account(), public.app_staff(), public.app_my_employee(), public.app_can(text),
  public.app_log(text, text), public.app_me(), public.app_touch_login(), public.app_password_changed(),
  public.app_set_perm(text, text, boolean), public.app_set_system_role(bigint, text), public.app_import_tables(),
  public.app_import_begin(), public.app_import_rows(text, jsonb), public.app_import_finish(jsonb, text)
  to authenticated;
revoke execute on function public.app_kill_sessions(uuid) from authenticated;
grant execute on all functions in schema public to service_role;
