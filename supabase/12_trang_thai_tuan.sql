-- =====================================================================
-- BƯỚC 12: TRẠNG THÁI TUẦN SAU KHI NHẬP TỪ BẢN OFFLINE. Chạy sau 11. Chạy lại nhiều lần không sao.
--
-- Bản offline coi tuần KHÔNG có dòng trong schedule_closures là "ĐANG XẾP";
-- web lại coi là "chưa bắt đầu xếp" (đang order) → tuần đã xếp ở offline hiện "Chưa bắt đầu xếp lịch",
-- không sửa được, và nút "Bắt đầu xếp lịch" sẽ làm lại lịch từ đầu.
-- Sửa: sau khi nhập, tuần nào đã có ô lịch mà chưa có trạng thái → ghi "ĐANG XẾP" (đúng như offline).
-- =====================================================================

create or replace function public.app__fill_week_status() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.schedule_closures(week_id, status, updated_at)
  select distinct e.week_id, 'ĐANG XẾP', public.vn_now_text()
    from public.weekly_schedule_entries e
   where not exists (select 1 from public.schedule_closures c where c.week_id = e.week_id)
  on conflict (week_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.app__fill_week_status() from public, anon, authenticated;

create or replace function public.app_import_finish(p_roles jsonb default '[]'::jsonb, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare t text; seq text; result jsonb := '{}'::jsonb; n bigint;
begin
  if not public.app_can('du_lieu') then raise exception 'Chỉ Chủ được nhập dữ liệu.'; end if;
  perform public.app__fill_week_status();
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

-- Chặn thêm ở máy chủ: không "bắt đầu xếp" (làm lại từ đầu) khi tuần đã có ca được xếp
create or replace function public.app_start_scheduling(p_week bigint) returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public.app__need('xep_lich');
  if exists (select 1 from public.weekly_schedule_entries where week_id = p_week and state = 'ĐÃ XẾP') then
    raise exception 'Tuần này đã có ca được xếp nên không bắt đầu lại từ đầu. Hãy tải lại trang để tiếp tục xếp.';
  end if;
  n := public.app__start_scheduling(public.app__week(p_week));
  perform public.app_log('bat_dau_xep_lich', 'week=' || p_week || ' fixed=' || n);
  return n;
end $$;

-- Sửa luôn dữ liệu hiện có (tuần 26/10 và 09/11 nhập từ offline)
select public.app__fill_week_status();
