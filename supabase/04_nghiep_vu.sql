-- =====================================================================
-- QUẢN TRỊ LỊCH LÀM – BƯỚC 4: NGHIỆP VỤ (order, xếp lịch, chốt tuần, thông báo, danh mục)
-- Chạy SAU 01, 02. Chạy lại nhiều lần không sao. Logic chuyển nguyên từ bản Python (order.py, schedule.py,
-- notify.py, catalog.py) và phần xử lý của bản offline 1.7.6.
-- Hàm tên app__... là hàm nội bộ (không gọi trực tiếp từ trang web).
-- =====================================================================

-- ---------------------------------------------------------------- Tiện ích
create or replace function public.app__need(p text) returns public.accounts
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app_account();
  if a.id is null then raise exception 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'; end if;
  if p is not null and not public.app_can(p) then raise exception 'Bạn không có quyền thực hiện thao tác này.'; end if;
  return a;
end $$;

create or replace function public.app__week(p_week bigint) returns public.weeks
language plpgsql stable security definer set search_path = public as $$
declare w public.weeks;
begin
  select * into w from public.weeks where id = p_week;
  if not found then raise exception 'Không tìm thấy tuần.'; end if;
  return w;
end $$;

create or replace function public.app__week_label(w public.weeks) returns text
language sql immutable as $$
  select to_char(w.start_date::date, 'DD/MM') || ' – ' || to_char(w.end_date::date, 'DD/MM/YYYY')
$$;

create or replace function public.app__day_label(p_start text, p_day int) returns text
language sql immutable as $$
  select (array['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','Chủ nhật'])[p_day + 1] || ' ' ||
         to_char(p_start::date + p_day, 'DD/MM')
$$;

create or replace function public.app__fmt_dt(t timestamp) returns text
language sql immutable as $$
  select to_char(t, 'HH24:MI') || ' ' ||
         (array['Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy','Chủ nhật'])[extract(isodow from t)::int] || ' ' ||
         to_char(t, 'DD/MM')
$$;

create or replace function public.app__setting(p_key text, p_default text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.settings where key = p_key), p_default)
$$;

create or replace function public.app__shifts() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(name order by sort_order, id), '{}') from public.shifts where status = 'Đang sử dụng'
$$;

create or replace function public.app__status_code(p text) returns text
language sql immutable as $$
  select case p when 'ok' then 'ĐI LÀM ĐƯỢC' when 'off' then 'NGHỈ' when 'none' then 'CHƯA ORDER' end
$$;

create or replace function public.app__state_from_base(p text) returns text
language sql immutable as $$
  select case p when 'ĐI LÀM ĐƯỢC' then 'TRỐNG' when 'NGHỈ' then 'NGHỈ' else 'CHƯA ORDER' end
$$;

create or replace function public.app__notify(p_account bigint, p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications(account_id, title, body, link, created_at)
  values (p_account, p_title, p_body, p_link, public.vn_now_text())
$$;

-- ---------------------------------------------------------------- Giờ mở / hết hạn order
create or replace function public.app_order_window(p_week bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w public.weeks; o timestamp; c timestamp; custom boolean; st text; prev date; now_ timestamp := public.vn_now();
begin
  select * into w from public.weeks where id = p_week;
  if not found then return null; end if;
  select open_at::timestamp, close_at::timestamp into o, c from public.week_order_windows where week_id = p_week;
  custom := found;
  if not custom then
    prev := w.start_date::date - 7;
    o := (prev + public.app__setting('order_open_dow', '0')::int) + public.app__setting('order_open_time', '08:00')::time;
    c := (prev + public.app__setting('order_close_dow', '3')::int) + public.app__setting('order_close_time', '22:00')::time;
  end if;
  st := case when now_ < o then 'chua_mo' when now_ <= c then 'dang_mo' else 'da_dong' end;
  return jsonb_build_object('open', to_char(o, 'YYYY-MM-DD"T"HH24:MI'), 'close', to_char(c, 'YYYY-MM-DD"T"HH24:MI'),
                            'custom', custom, 'state', st, 'now', to_char(now_, 'YYYY-MM-DD"T"HH24:MI:SS'),
                            'open_text', public.app__fmt_dt(o), 'close_text', public.app__fmt_dt(c));
end $$;

create or replace function public.app__has_submitted(p_week bigint, p_emp bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.order_submissions where week_id = p_week and employee_id = p_emp)
      or exists (select 1 from public.order_entries where week_id = p_week and employee_id = p_emp
                  and status in ('ĐI LÀM ĐƯỢC', 'NGHỈ'))
$$;

-- ---------------------------------------------------------------- Tuần
create or replace function public.app_create_week(p_date text) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; d date; mon date; wid bigint;
begin
  a := public.app__need('xep_lich');
  begin d := p_date::date; exception when others then raise exception 'Ngày không hợp lệ.'; end;
  mon := d - (extract(isodow from d)::int - 1);
  if exists (select 1 from public.weeks where start_date = mon::text) then
    raise exception 'Tuần này đã có, không thể tạo lại. Muốn làm lại từ đầu hãy dùng “Xóa dữ liệu tuần”.';
  end if;
  insert into public.weeks(start_date, end_date) values (mon::text, (mon + 6)::text) returning id into wid;
  perform public.app_log('tao_tuan', mon::text);
  return wid;
end $$;

create or replace function public.app_delete_week_orders(p_week bigint) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public.app__need('xoa_du_lieu_tuan');
  perform public.app__week(p_week);
  delete from public.order_entries where week_id = p_week;
  get diagnostics n = row_count;
  delete from public.order_submissions where week_id = p_week;
  delete from public.order_edit_log where week_id = p_week;
  perform public.app_log('xoa_order_tuan', 'week=' || p_week || ' rows=' || n);
  return n;
end $$;

-- ---------------------------------------------------------------- Order: nhân viên gửi
-- p_cells: [{"weekday":0,"shift":"Sáng","status":"ok"|"off"}, ...] – phải đủ 7 ngày × các ca đang dùng.
create or replace function public.app_submit_order(p_week bigint, p_cells jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; win jsonb; shifts text[]; n_need int; n_ok int; first boolean; now_ text := public.vn_now_text();
begin
  a := public.app__need('order_ca');
  if a.employee_id is null then raise exception 'Tài khoản này không gắn với nhân viên nào.'; end if;
  perform public.app__week(p_week);
  win := public.app_order_window(p_week);
  if win ->> 'state' <> 'dang_mo' then raise exception 'Order tuần này đang không mở. Không lưu được.'; end if;
  shifts := public.app__shifts();
  n_need := 7 * coalesce(array_length(shifts, 1), 0);
  select count(distinct (c ->> 'weekday') || '|' || (c ->> 'shift')) into n_ok
    from jsonb_array_elements(p_cells) c
   where (c ->> 'weekday')::int between 0 and 6 and (c ->> 'shift') = any(shifts) and (c ->> 'status') in ('ok', 'off');
  if n_ok < n_need then
    raise exception 'Còn % ô chưa chọn. Phải chọn đủ mới gửi được.', n_need - n_ok;
  end if;
  first := not public.app__has_submitted(p_week, a.employee_id);
  insert into public.order_entries as oe (week_id, employee_id, weekday, shift, status, imported_at, is_manual)
  select distinct on ((c ->> 'weekday')::int, c ->> 'shift')
         p_week, a.employee_id, (c ->> 'weekday')::int, c ->> 'shift', public.app__status_code(c ->> 'status'), now_, 0
    from jsonb_array_elements(p_cells) c
   where (c ->> 'weekday')::int between 0 and 6 and (c ->> 'shift') = any(shifts) and (c ->> 'status') in ('ok', 'off')
  on conflict (week_id, employee_id, weekday, shift) do update
    set status = excluded.status, imported_at = excluded.imported_at,
        is_manual = case when oe.is_manual = 1 and oe.status = excluded.status then 1 else 0 end;
  insert into public.order_submissions(week_id, employee_id, submitted_at, updated_at) values (p_week, a.employee_id, now_, now_)
  on conflict (week_id, employee_id) do update set updated_at = excluded.updated_at;
  return jsonb_build_object('first', first, 'close_text', win ->> 'close_text');
end $$;

-- ---------------------------------------------------------------- Xếp lịch: trạng thái, khóa
create or replace function public.app__week_status(p_week bigint) returns text
language sql stable security definer set search_path = public as $$
  select status from public.schedule_closures where week_id = p_week
$$;

create or replace function public.app__editable(p_week bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app__week_status(p_week) in ('ĐANG XẾP', 'ĐANG CHỈNH SỬA'), false)
$$;

create or replace function public.app__touch(p_week bigint) returns void
language sql security definer set search_path = public as $$
  update public.schedule_closures set updated_at = to_char(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI:SS.US')
   where week_id = p_week
$$;

create or replace function public.app__lock_info(p_week bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record;
begin
  select l.*, coalesce(e.code || ' – ' || e.name, a.display_name, 'Chủ') as who into r
    from public.schedule_locks l join public.accounts a on a.id = l.account_id
    left join public.employees e on e.id = a.employee_id
   where l.week_id = p_week;
  if not found or r.last_seen::timestamp < public.vn_now() - interval '15 minutes' then return null; end if;
  return jsonb_build_object('account_id', r.account_id, 'who', r.who, 'acquired_at', r.acquired_at);
end $$;

create or replace function public.app__try_lock(p_week bigint, p_account bigint, p_force boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare info jsonb; now_ text := public.vn_now_text();
begin
  info := public.app__lock_info(p_week);
  if info is not null and (info ->> 'account_id')::bigint <> p_account and not p_force then
    return jsonb_build_object('ok', false, 'lock', info);
  end if;
  if info is not null and (info ->> 'account_id')::bigint = p_account then
    update public.schedule_locks set last_seen = now_ where week_id = p_week;
  else
    insert into public.schedule_locks(week_id, account_id, acquired_at, last_seen) values (p_week, p_account, now_, now_)
    on conflict (week_id) do update set account_id = excluded.account_id, acquired_at = excluded.acquired_at,
                                        last_seen = excluded.last_seen;
    if info is not null and p_force then
      perform public.app__notify((info ->> 'account_id')::bigint, 'Chủ đã giành quyền xếp lịch',
        'Bạn chuyển sang chế độ chỉ xem cho tuần đang xếp.', '/quan-ly/lich-co-so');
    end if;
  end if;
  return jsonb_build_object('ok', true, 'lock', public.app__lock_info(p_week));
end $$;

-- Người dùng mở màn hình xếp lịch: lấy / giữ quyền xếp. p_force = Chủ giành quyền.
create or replace function public.app_schedule_lock(p_week bigint, p_force boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app__need('xep_lich');
  if p_force and not public.app_can('phan_quyen') then raise exception 'Chỉ Chủ được giành quyền xếp lịch.'; end if;
  if not public.app__editable(p_week) then return jsonb_build_object('ok', false, 'lock', null); end if;
  if p_force then perform public.app_log('gianh_quyen_xep', 'week=' || p_week); end if;
  return public.app__try_lock(p_week, a.id, p_force);
end $$;

create or replace function public.app_schedule_release(p_week bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.schedule_locks where week_id = p_week and account_id = (public.app_account()).id;
end $$;

create or replace function public.app_schedule_poll(p_week bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; info jsonb;
begin
  a := public.app__need('xem_tat_ca');
  info := public.app__lock_info(p_week);
  return jsonb_build_object(
    'version', (select updated_at from public.schedule_closures where week_id = p_week),
    'status', public.app__week_status(p_week),
    'lock', info ->> 'who', 'lock_since', info ->> 'acquired_at',
    'mine', coalesce((info ->> 'account_id')::bigint = a.id, false));
end $$;

-- Kiểm tra được sửa lịch tuần này không (đang xếp + đang giữ khóa); lấy khóa nếu trống.
create or replace function public.app__check_edit(p_week bigint) returns public.accounts
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r jsonb;
begin
  a := public.app__need('xep_lich');
  perform public.app__week(p_week);
  if not public.app__editable(p_week) then raise exception 'Tuần đã chốt hoặc chưa bắt đầu xếp. Hãy tải lại trang.'; end if;
  r := public.app__try_lock(p_week, a.id, false);
  if not (r ->> 'ok')::boolean then
    raise exception '% đang giữ quyền xếp lịch. Bạn đang ở chế độ chỉ xem.', r -> 'lock' ->> 'who';
  end if;
  return a;
end $$;

-- ---------------------------------------------------------------- Xếp lịch: xếp / gỡ người
create or replace function public.app__unassign(p_week bigint, p_emp bigint, p_day int, p_shift text) returns void
language sql security definer set search_path = public as $$
  update public.weekly_schedule_entries
     set state = public.app__state_from_base(base_status), branch_id = null, role = null, slot = null,
         source = 'MANUAL', is_manual = 1, updated_at = public.vn_now_text()
   where week_id = p_week and employee_id = p_emp and weekday = p_day and shift = p_shift and state = 'ĐÃ XẾP'
$$;

create or replace function public.app__base_for(p_week bigint, p_emp bigint, p_day int, p_shift text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select base_status from public.weekly_schedule_entries where week_id = p_week and employee_id = p_emp and weekday = p_day and shift = p_shift),
    (select status from public.order_entries where week_id = p_week and employee_id = p_emp and weekday = p_day and shift = p_shift
       and status in ('ĐI LÀM ĐƯỢC', 'NGHỈ', 'CHƯA ORDER')),
    'CHƯA ORDER')
$$;

create or replace function public.app__assign(p_week bigint, p_emp bigint, p_day int, p_shift text, p_branch bigint,
                                              p_role text, p_slot int) returns void
language plpgsql security definer set search_path = public as $$
declare e record; bcode text;
begin
  if not exists (select 1 from public.employees where id = p_emp and status = 'Đang làm') then
    raise exception 'Nhân viên không còn làm.';
  end if;
  if not exists (select 1 from public.employee_branches where employee_id = p_emp and branch_id = p_branch) then
    raise exception 'Nhân viên không được khai báo làm ở chi nhánh này.';
  end if;
  if not exists (select 1 from public.employee_roles where employee_id = p_emp and role = p_role) then
    raise exception 'Nhân viên không có vai trò này.';
  end if;
  select * into e from public.weekly_schedule_entries
   where week_id = p_week and employee_id = p_emp and weekday = p_day and shift = p_shift;
  if found and e.state = 'ĐÃ XẾP' and not (e.branch_id = p_branch and e.role = p_role) then
    select code into bcode from public.branches where id = e.branch_id;
    raise exception 'Nhân viên này đã được xếp ở % cùng ca.', coalesce(bcode, 'chi nhánh khác');
  end if;
  if found then
    update public.weekly_schedule_entries set state = 'ĐÃ XẾP', branch_id = p_branch, role = p_role, slot = p_slot,
           source = 'MANUAL', is_manual = 1, updated_at = public.vn_now_text() where id = e.id;
  else
    insert into public.weekly_schedule_entries(week_id, employee_id, weekday, shift, base_status, state, branch_id, role,
                                               slot, source, is_manual)
    values (p_week, p_emp, p_day, p_shift, public.app__base_for(p_week, p_emp, p_day, p_shift), 'ĐÃ XẾP', p_branch, p_role,
            p_slot, 'MANUAL', 1);
  end if;
end $$;

create or replace function public.app__shift_enabled(p_branch bigint, p_shift text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.branch_shifts bs join public.shifts s on s.id = bs.shift_id
                  where bs.branch_id = p_branch and bs.enabled = 1 and s.name = p_shift and s.status = 'Đang sử dụng')
$$;

-- Lịch cơ sở: chọn người cho một ô (p_emp null = để trống), p_prev = người đang ở ô đó.
create or replace function public.app_assign(p_week bigint, p_branch bigint, p_day int, p_shift text, p_role text,
                                             p_slot int, p_emp bigint, p_prev bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app__check_edit(p_week);
  if p_day not between 0 and 6 or not public.app__shift_enabled(p_branch, p_shift) then
    raise exception 'Ca không bật ở chi nhánh này.';
  end if;
  if p_prev is not null and p_prev is distinct from p_emp then
    perform public.app__unassign(p_week, p_prev, p_day, p_shift);
  end if;
  if p_emp is not null then
    perform public.app__assign(p_week, p_emp, p_day, p_shift, p_branch, p_role, p_slot);
  end if;
  perform public.app__touch(p_week);
  perform public.app_log('xep_lich', format('w%s b%s d%s %s %s#%s: %s->%s', p_week, p_branch, p_day, p_shift, p_role, p_slot, p_prev, p_emp));
  return jsonb_build_object('version', (select updated_at from public.schedule_closures where week_id = p_week));
end $$;

-- Lịch tổng: chọn "cơ sở – vị trí" cho một ô của một nhân viên (p_branch null = để trống)
create or replace function public.app_master_cell(p_week bigint, p_emp bigint, p_day int, p_shift text, p_branch bigint,
                                                  p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; cur record;
begin
  a := public.app__check_edit(p_week);
  if p_day not between 0 and 6 then raise exception 'Ngày không hợp lệ.'; end if;
  if p_branch is not null and not public.app__shift_enabled(p_branch, p_shift) then
    raise exception 'Ca này không bật ở cơ sở đã chọn.';
  end if;
  select * into cur from public.weekly_schedule_entries
   where week_id = p_week and employee_id = p_emp and weekday = p_day and shift = p_shift;
  if found and cur.state = 'ĐÃ XẾP' then
    if p_branch is not null and cur.branch_id = p_branch and cur.role = p_role then return; end if;
    perform public.app__unassign(p_week, p_emp, p_day, p_shift);
  end if;
  if p_branch is not null then
    perform public.app__assign(p_week, p_emp, p_day, p_shift, p_branch, p_role, null);
  end if;
  perform public.app__touch(p_week);
  perform public.app_log('xep_lich_tong', format('w%s e%s d%s %s -> %s|%s', p_week, p_emp, p_day, p_shift, p_branch, p_role));
end $$;

-- ---------------------------------------------------------------- Định biên của tuần (tuần đã chốt dùng bản lưu)
create or replace function public.app__requirements(p_week bigint) returns table(branch_id bigint, weekday int, shift text, role text, n int)
language plpgsql stable security definer set search_path = public as $$
declare snap text;
begin
  select staffing_snapshot_json into snap from public.schedule_closures where week_id = p_week;
  if snap is not null and snap <> '' then
    begin
      return query
        select k.key::bigint, (it ->> 0)::int, it ->> 1, it ->> 2, (it ->> 3)::int
          from jsonb_each(snap::jsonb) k, jsonb_array_elements(k.value) it;
      return;
    exception when others then null;
    end;
  end if;
  return query select s.branch_id, s.weekday, s.shift, s.role, s.required_count from public.staffing_requirements s;
end $$;

create or replace function public.app__snapshot_requirements() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(b, items)::text, '{}')
    from (select branch_id::text as b, jsonb_agg(jsonb_build_array(weekday, shift, role, required_count)) as items
            from public.staffing_requirements group by branch_id) x
$$;

-- Thêm (+1) / xóa (-1) hàng "vượt định biên" cho ca – vai trò ở một chi nhánh trong tuần đang xếp.
create or replace function public.app_extra_row(p_week bigint, p_branch bigint, p_shift text, p_role text, p_delta int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; cur int; cnt int; max_req int; cur_rows int; target int; removed int := 0; d int; r record; kept int;
begin
  a := public.app__check_edit(p_week);
  if p_delta not in (1, -1) then raise exception 'Dữ liệu không hợp lệ.'; end if;
  select "count" into cur from public.schedule_extra_rows where week_id = p_week and branch_id = p_branch and shift = p_shift and role = p_role;
  cur := coalesce(cur, 0);
  cnt := cur + p_delta;
  if p_delta = -1 then
    select coalesce(max(n), 0) into max_req from public.app__requirements(p_week) q
     where q.branch_id = p_branch and q.shift = p_shift and q.role = p_role;
    select greatest(max_req + cur, coalesce(max(c), 0)) into cur_rows
      from (select count(*) c from public.weekly_schedule_entries
             where week_id = p_week and branch_id = p_branch and shift = p_shift and role = p_role and state = 'ĐÃ XẾP'
             group by weekday) g;
    if cur_rows <= max_req then raise exception 'Không còn hàng vượt định biên để xóa.'; end if;
    target := greatest(cur_rows - 1, max_req);
    cnt := target - max_req;
    for d in 0..6 loop
      kept := 0;
      for r in select id, employee_id, slot from public.weekly_schedule_entries
                where week_id = p_week and branch_id = p_branch and weekday = d and shift = p_shift and role = p_role
                  and state = 'ĐÃ XẾP' order by coalesce(slot, 999), id loop
        if (r.slot is null or r.slot < target) and kept < target then
          kept := kept + 1;
        else
          perform public.app__unassign(p_week, r.employee_id, d, p_shift);
          removed := removed + 1;
        end if;
      end loop;
    end loop;
  end if;
  insert into public.schedule_extra_rows(week_id, branch_id, shift, role, count) values (p_week, p_branch, p_shift, p_role, cnt)
  on conflict (week_id, branch_id, shift, role) do update set count = excluded.count;
  perform public.app__touch(p_week);
  perform public.app_log('vuot_dinh_bien', format('w%s b%s %s %s = %s', p_week, p_branch, p_shift, p_role, cnt));
  return jsonb_build_object('count', cnt, 'removed', removed,
                            'version', (select updated_at from public.schedule_closures where week_id = p_week));
end $$;

-- ---------------------------------------------------------------- Bắt đầu xếp / quay lại order / xếp lại
create or replace function public.app__start_scheduling(w public.weeks) returns integer
language plpgsql security definer set search_path = public as $$
declare n_fixed int := 0;
begin
  if public.app__week_status(w.id) is not null then raise exception 'Tuần này đã bắt đầu xếp lịch.'; end if;
  if public.app_order_window(w.id) ->> 'state' <> 'da_dong' then
    raise exception 'Chỉ bắt đầu xếp lịch được sau giờ hết hạn order (%).', public.app_order_window(w.id) ->> 'close_text';
  end if;
  delete from public.weekly_schedule_entries where week_id = w.id;
  insert into public.weekly_schedule_entries(week_id, employee_id, weekday, shift, base_status, state, branch_id, role, source, is_manual)
  select w.id, e.id, d.d, s.name, base.b,
         case when fx.ok then 'ĐÃ XẾP' else public.app__state_from_base(base.b) end,
         case when fx.ok then f.branch_id end, case when fx.ok then f.role end,
         case when fx.ok then 'FIXED' else 'ORDER' end, 0
    from public.employees e
   cross join generate_series(0, 6) d(d)
   cross join (select name, id from public.shifts where status = 'Đang sử dụng') s
    left join public.order_entries o on o.week_id = w.id and o.employee_id = e.id and o.weekday = d.d and o.shift = s.name
   cross join lateral (select case when o.status in ('ĐI LÀM ĐƯỢC', 'NGHỈ', 'CHƯA ORDER') then o.status else 'CHƯA ORDER' end as b) base
    left join public.fixed_schedule_entries f on f.employee_id = e.id and f.weekday = d.d and f.shift = s.name
         and exists (select 1 from public.fixed_schedule_members m where m.employee_id = e.id)
   cross join lateral (select (f.id is not null and base.b = 'ĐI LÀM ĐƯỢC'
         and exists (select 1 from public.branches b where b.id = f.branch_id and b.status = 'Đang hoạt động')
         and exists (select 1 from public.branch_shifts bs where bs.branch_id = f.branch_id and bs.shift_id = s.id and bs.enabled = 1)
         and exists (select 1 from public.employee_branches eb where eb.employee_id = e.id and eb.branch_id = f.branch_id)
         and exists (select 1 from public.employee_roles er where er.employee_id = e.id and er.role = f.role)) as ok) fx
   where e.status = 'Đang làm';
  select count(*) into n_fixed from public.weekly_schedule_entries where week_id = w.id and source = 'FIXED';
  insert into public.schedule_closures(week_id, status, updated_at) values (w.id, 'ĐANG XẾP', public.vn_now_text())
  on conflict (week_id) do update set status = excluded.status, updated_at = excluded.updated_at;
  return n_fixed;
end $$;

create or replace function public.app_start_scheduling(p_week bigint) returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public.app__need('xep_lich');
  n := public.app__start_scheduling(public.app__week(p_week));
  perform public.app_log('bat_dau_xep_lich', 'week=' || p_week || ' fixed=' || n);
  return n;
end $$;

create or replace function public.app_back_to_order(p_week bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__need('xep_lich');
  perform public.app__week(p_week);
  if public.app__week_status(p_week) is distinct from 'ĐANG XẾP'
     or exists (select 1 from public.schedule_published where week_id = p_week) then
    raise exception 'Chỉ quay lại order được khi tuần đang xếp và chưa chốt lần nào.';
  end if;
  if exists (select 1 from public.weekly_schedule_entries where week_id = p_week and state = 'ĐÃ XẾP' and source = 'MANUAL') then
    raise exception 'Đã xếp lịch, không thể quay lại order.';
  end if;
  delete from public.weekly_schedule_entries where week_id = p_week;
  delete from public.schedule_extra_rows where week_id = p_week;
  delete from public.schedule_locks where week_id = p_week;
  delete from public.schedule_closures where week_id = p_week;
  perform public.app_log('quay_lai_order', 'week=' || p_week);
end $$;

-- Lịch tổng: "Xếp theo order & lịch cố định" – tuần chưa xếp thì bắt đầu xếp, đang xếp thì xếp lại từ đầu.
create or replace function public.app_master_auto(p_week bigint) returns integer
language plpgsql security definer set search_path = public as $$
declare a public.accounts; w public.weeks; st text; n int; r jsonb;
begin
  a := public.app__need('xep_lich');
  w := public.app__week(p_week);
  st := public.app__week_status(p_week);
  if st = 'ĐÃ CHỐT' then raise exception 'Lịch tuần đã chốt. Hãy mở lại để chỉnh sửa trước khi xếp lại tự động.'; end if;
  if st is not null then
    r := public.app__try_lock(p_week, a.id, false);
    if not (r ->> 'ok')::boolean then raise exception '% đang giữ quyền xếp lịch.', r -> 'lock' ->> 'who'; end if;
    delete from public.schedule_closures where week_id = p_week;
  end if;
  n := public.app__start_scheduling(w);
  if st = 'ĐANG CHỈNH SỬA' then
    update public.schedule_closures set status = 'ĐANG CHỈNH SỬA' where week_id = p_week;
  end if;
  perform public.app_log('xep_lich_tu_dong', 'week=' || p_week || ' fixed=' || n);
  return n;
end $$;

-- Đọc lại order vào lịch nhưng giữ nguyên các ca đã xếp (bản offline: GHI ĐÈ ORDER VÀO LỊCH TỔNG)
create or replace function public.app__reapply_order(p_week bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare updated int := 0; inserted int := 0; kept int := 0; conflicts int := 0;
begin
  -- Trạng thái gốc theo order mới
  create temporary table if not exists tmp_base (employee_id bigint, weekday int, shift text, b text) on commit drop;
  truncate tmp_base;
  insert into tmp_base
  select e.id, d.d, s.name,
         case when not exists (select 1 from public.order_entries x where x.week_id = p_week and x.employee_id = e.id) then 'CHƯA ORDER'
              when o.status = 'NGHỈ' then 'NGHỈ' when o.status = 'ĐI LÀM ĐƯỢC' then 'ĐI LÀM ĐƯỢC' else 'CHƯA ORDER' end
    from public.employees e cross join generate_series(0, 6) d(d)
   cross join (select name from public.shifts where status = 'Đang sử dụng') s
    left join public.order_entries o on o.week_id = p_week and o.employee_id = e.id and o.weekday = d.d and o.shift = s.name
   where e.status = 'Đang làm';
  select count(*) filter (where w.state = 'ĐÃ XẾP'), count(*) filter (where w.state = 'ĐÃ XẾP' and t.b in ('NGHỈ', 'CHƯA ORDER'))
    into kept, conflicts
    from tmp_base t join public.weekly_schedule_entries w
      on w.week_id = p_week and w.employee_id = t.employee_id and w.weekday = t.weekday and w.shift = t.shift;
  update public.weekly_schedule_entries w set base_status = t.b, updated_at = public.vn_now_text(),
         state = case when w.state = 'ĐÃ XẾP' then w.state else public.app__state_from_base(t.b) end,
         branch_id = case when w.state = 'ĐÃ XẾP' then w.branch_id end,
         role = case when w.state = 'ĐÃ XẾP' then w.role end,
         source = case when w.state = 'ĐÃ XẾP' then w.source else 'ORDER' end,
         is_manual = case when w.state = 'ĐÃ XẾP' then w.is_manual else 0 end
    from tmp_base t
   where w.week_id = p_week and w.employee_id = t.employee_id and w.weekday = t.weekday and w.shift = t.shift;
  get diagnostics updated = row_count;
  insert into public.weekly_schedule_entries(week_id, employee_id, weekday, shift, base_status, state, branch_id, role, source, is_manual)
  select p_week, t.employee_id, t.weekday, t.shift, t.b,
         case when fx.ok then 'ĐÃ XẾP' else public.app__state_from_base(t.b) end,
         case when fx.ok then f.branch_id end, case when fx.ok then f.role end, case when fx.ok then 'FIXED' else 'ORDER' end, 0
    from tmp_base t
    left join public.fixed_schedule_entries f on f.employee_id = t.employee_id and f.weekday = t.weekday and f.shift = t.shift
         and exists (select 1 from public.fixed_schedule_members m where m.employee_id = t.employee_id)
   cross join lateral (select (f.id is not null and t.b <> 'NGHỈ' and public.app__shift_enabled(f.branch_id, t.shift)) as ok) fx
   where not exists (select 1 from public.weekly_schedule_entries w
                      where w.week_id = p_week and w.employee_id = t.employee_id and w.weekday = t.weekday and w.shift = t.shift);
  get diagnostics inserted = row_count;
  perform public.app__touch(p_week);
  return jsonb_build_object('updated', updated, 'inserted', inserted, 'assigned_preserved', kept, 'conflicts', conflicts);
end $$;

create or replace function public.app_reapply_order(p_week bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r jsonb;
begin
  a := public.app__check_edit(p_week);
  r := public.app__reapply_order(p_week);
  perform public.app_log('cap_nhat_order_vao_lich', 'week=' || p_week);
  return r;
end $$;

create or replace function public.app_clear_schedule(p_week bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__need('xep_lich');
  perform public.app__week(p_week);
  if public.app__week_status(p_week) = 'ĐÃ CHỐT' then raise exception 'Lịch tuần đã chốt. Hãy mở lại trước.'; end if;
  if exists (select 1 from public.schedule_published where week_id = p_week) then
    raise exception 'Tuần này đã chốt ít nhất một lần và nhân viên đã thấy lịch, không xóa được. Hãy sửa trực tiếp rồi chốt lại.';
  end if;
  delete from public.weekly_schedule_entries where week_id = p_week;
  delete from public.schedule_extra_rows where week_id = p_week;
  delete from public.schedule_locks where week_id = p_week;
  delete from public.schedule_closures where week_id = p_week;
  perform public.app_log('xoa_lich_tuan', 'week=' || p_week);
end $$;

-- ---------------------------------------------------------------- Order: quản lý sửa
create or replace function public.app__sync_order_change(p_week bigint, p_emp bigint, p_day int, p_shift text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare e record;
begin
  select * into e from public.weekly_schedule_entries where week_id = p_week and employee_id = p_emp and weekday = p_day and shift = p_shift;
  if not found then
    if public.app__week_status(p_week) is null then return; end if;
    insert into public.weekly_schedule_entries(week_id, employee_id, weekday, shift, base_status, state, source, is_manual)
    values (p_week, p_emp, p_day, p_shift, p_status, public.app__state_from_base(p_status), 'ORDER', 0);
  elsif e.state = 'ĐÃ XẾP' then
    update public.weekly_schedule_entries set base_status = p_status, updated_at = public.vn_now_text() where id = e.id;
  else
    update public.weekly_schedule_entries set base_status = p_status, state = public.app__state_from_base(p_status),
           updated_at = public.vn_now_text() where id = e.id;
  end if;
  perform public.app__touch(p_week);
end $$;

-- p_cells: [{"employee_id":1,"weekday":0,"shift":"Sáng","status":"ok"|"off"|"none"}]
create or replace function public.app_manager_set_orders(p_week bigint, p_cells jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare a public.accounts; c jsonb; eid bigint; wd int; sh text; st text; old text; shifts text[]; n int := 0; now_ text;
begin
  a := public.app__need('sua_order_sau_han');
  perform public.app__week(p_week);
  shifts := public.app__shifts();
  if jsonb_typeof(p_cells) <> 'array' or jsonb_array_length(p_cells) > 5000 then raise exception 'Dữ liệu không hợp lệ.'; end if;
  for c in select * from jsonb_array_elements(p_cells) loop
    eid := (c ->> 'employee_id')::bigint; wd := (c ->> 'weekday')::int; sh := c ->> 'shift'; st := public.app__status_code(c ->> 'status');
    if st is null or wd not between 0 and 6 or not (sh = any(shifts))
       or not exists (select 1 from public.employees where id = eid and status = 'Đang làm') then
      raise exception 'Dữ liệu không hợp lệ.';
    end if;
    select status into old from public.order_entries where week_id = p_week and employee_id = eid and weekday = wd and shift = sh;
    if found and old = st then continue; end if;
    now_ := public.vn_now_text();
    insert into public.order_entries(week_id, employee_id, weekday, shift, status, imported_at, is_manual)
    values (p_week, eid, wd, sh, st, now_, 1)
    on conflict (week_id, employee_id, weekday, shift) do update set status = excluded.status, imported_at = excluded.imported_at, is_manual = 1;
    insert into public.order_edit_log(week_id, employee_id, weekday, shift, old_status, new_status, account_id, created_at)
    values (p_week, eid, wd, sh, coalesce(old, 'CHƯA ORDER'), st, a.id, now_);
    perform public.app__sync_order_change(p_week, eid, wd, sh, st);
    n := n + 1;
  end loop;
  perform public.app_log('sua_order', 'week=' || p_week || ' cells=' || n);
  return n;
end $$;

-- Sau khi order đổi hàng loạt: cập nhật "đã nộp order" và đưa order vào lịch đang xếp.
create or replace function public.app__resync_order(p_week bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from public.order_submissions s where s.week_id = p_week and not exists (
    select 1 from public.order_entries o where o.week_id = p_week and o.employee_id = s.employee_id and o.status in ('ĐI LÀM ĐƯỢC', 'NGHỈ'));
  insert into public.order_submissions(week_id, employee_id, submitted_at, updated_at)
  select distinct p_week, employee_id, public.vn_now_text(), public.vn_now_text() from public.order_entries
   where week_id = p_week and status in ('ĐI LÀM ĐƯỢC', 'NGHỈ')
  on conflict do nothing;
  if public.app__editable(p_week) then
    perform public.app__reapply_order(p_week);
    return true;
  end if;
  return false;
end $$;

create or replace function public.app__order_snapshot(p_week bigint, p_source text) returns void
language sql security definer set search_path = public as $$
  insert into public.order_snapshots(week_id, snapshot_json, source_filename)
  select p_week, coalesce(jsonb_agg(jsonb_build_object('employee_id', employee_id, 'weekday', weekday, 'shift', shift,
                                                       'status', status, 'is_manual', is_manual))::text, '[]'), p_source
    from public.order_entries where week_id = p_week
$$;

-- Nhập câu trả lời Google Form (trang web đã đọc file và loại người gửi trùng).
-- p_rows: [{"code":"12","statuses":{"0|Sáng":"ĐI LÀM ĐƯỢC",...}}]
create or replace function public.app_order_form_import(p_week bigint, p_rows jsonb, p_filename text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r jsonb; e record; shifts text[]; d int; sh text; st text; imported text[] := '{}';
        unknown text[] := '{}'; inactive text[] := '{}'; manual_kept int := 0; synced boolean;
begin
  a := public.app__need('sua_order_sau_han');
  perform public.app__week(p_week);
  if public.app__week_status(p_week) = 'ĐÃ CHỐT' then raise exception 'Lịch tuần đã chốt. Mở lại tuần trước khi nhập order.'; end if;
  shifts := public.app__shifts();
  perform public.app__order_snapshot(p_week, p_filename);
  create temporary table if not exists tmp_manual (employee_id bigint, weekday int, shift text) on commit drop;
  truncate tmp_manual;
  insert into tmp_manual select employee_id, weekday, shift from public.order_entries where week_id = p_week and is_manual = 1;
  delete from public.order_entries where week_id = p_week and is_manual = 0;
  for r in select * from jsonb_array_elements(p_rows) loop
    select id, code, status into e from public.employees where lower(code) = lower(trim(r ->> 'code'));
    if not found then unknown := unknown || (r ->> 'code'); continue; end if;
    if e.status <> 'Đang làm' then inactive := inactive || e.code; continue; end if;
    imported := imported || e.code;
    for d in 0..6 loop
      foreach sh in array shifts loop
        if exists (select 1 from tmp_manual m where m.employee_id = e.id and m.weekday = d and m.shift = sh) then
          manual_kept := manual_kept + 1; continue;
        end if;
        st := r -> 'statuses' ->> (d || '|' || sh);
        if st in ('ĐI LÀM ĐƯỢC', 'NGHỈ') then
          insert into public.order_entries(week_id, employee_id, weekday, shift, status, is_manual)
          values (p_week, e.id, d, sh, st, 0) on conflict do nothing;
        end if;
      end loop;
    end loop;
  end loop;
  insert into public.order_import_batches(week_id, filename, row_count) values (p_week, p_filename, coalesce(array_length(imported, 1), 0));
  synced := public.app__resync_order(p_week);
  perform public.app_log('nhap_form_order', 'week=' || p_week || ' imported=' || coalesce(array_length(imported, 1), 0));
  return jsonb_build_object('imported', coalesce(array_length(imported, 1), 0), 'unknown', to_jsonb(unknown),
                            'inactive', to_jsonb(inactive), 'manual_preserved', manual_kept, 'synced', synced);
end $$;

create or replace function public.app_order_clear(p_week bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__need('sua_order_sau_han');
  perform public.app__week(p_week);
  if public.app__week_status(p_week) = 'ĐÃ CHỐT' then raise exception 'Lịch tuần đã chốt. Mở lại tuần trước.'; end if;
  perform public.app__order_snapshot(p_week, 'Xóa dữ liệu tuần');
  delete from public.order_entries where week_id = p_week;
  perform public.app_log('xoa_order_tuan', 'week=' || p_week);
  return public.app__resync_order(p_week);
end $$;

create or replace function public.app_order_restore(p_week bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  perform public.app__need('sua_order_sau_han');
  perform public.app__week(p_week);
  if public.app__week_status(p_week) = 'ĐÃ CHỐT' then raise exception 'Lịch tuần đã chốt. Mở lại tuần trước.'; end if;
  select id, snapshot_json into s from public.order_snapshots where week_id = p_week order by id desc limit 1;
  if not found then return jsonb_build_object('ok', false); end if;
  delete from public.order_entries where week_id = p_week;
  insert into public.order_entries(week_id, employee_id, weekday, shift, status, is_manual)
  select p_week, (x ->> 'employee_id')::bigint, (x ->> 'weekday')::int, x ->> 'shift', x ->> 'status', coalesce((x ->> 'is_manual')::int, 0)
    from jsonb_array_elements(s.snapshot_json::jsonb) x
   where exists (select 1 from public.employees e where e.id = (x ->> 'employee_id')::bigint)
  on conflict do nothing;
  delete from public.order_snapshots where id = s.id;
  perform public.app_log('khoi_phuc_order', 'week=' || p_week);
  return jsonb_build_object('ok', true, 'synced', public.app__resync_order(p_week));
end $$;

-- ---------------------------------------------------------------- Chốt / mở lại tuần
create or replace function public.app_chot(p_week bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; w public.weeks; st text; first boolean; now_ text := public.vn_now_text(); label text; link text;
        r record; n_changed int := 0;
begin
  a := public.app__need('chot_tuan');
  w := public.app__week(p_week);
  st := public.app__week_status(p_week);
  if st is null or st not in ('ĐANG XẾP', 'ĐANG CHỈNH SỬA') then raise exception 'Tuần không ở trạng thái đang xếp.'; end if;
  label := public.app__week_label(w);
  link := '/lich?tuan=' || w.start_date;
  create temporary table if not exists tmp_old (employee_id bigint, weekday int, shift text, branch_id bigint, role text,
                                                note text, changed_at text) on commit drop;
  truncate tmp_old;
  insert into tmp_old select employee_id, weekday, shift, branch_id, role, note, changed_at from public.schedule_published where week_id = p_week;
  first := not exists (select 1 from tmp_old);
  delete from public.schedule_published where week_id = p_week;
  insert into public.schedule_published(week_id, employee_id, weekday, shift, branch_id, role, published_at, note, changed_at)
  select p_week, n.employee_id, n.weekday, n.shift, n.branch_id, n.role, now_,
         case when first then null
              when o.employee_id is null then 'Ca mới được xếp thêm'
              when o.branch_id <> n.branch_id or o.role <> n.role then
                'Đổi từ ' || coalesce((select code from public.branches where id = o.branch_id), '?') || ' – ' || o.role
              else o.note end,
         case when first then null
              when o.employee_id is null or o.branch_id <> n.branch_id or o.role <> n.role then now_
              else o.changed_at end
    from public.weekly_schedule_entries n
    left join tmp_old o on o.employee_id = n.employee_id and o.weekday = n.weekday and o.shift = n.shift
   where n.week_id = p_week and n.state = 'ĐÃ XẾP' and n.branch_id is not null;
  update public.schedule_closures set status = 'ĐÃ CHỐT', closed_at = now_,
         staffing_snapshot_json = coalesce(nullif(staffing_snapshot_json, ''), public.app__snapshot_requirements()),
         updated_at = now_ where week_id = p_week;
  delete from public.schedule_locks where week_id = p_week;
  if first then
    perform public.app__notify(ac.id, 'Lịch tuần ' || label || ' đã được chốt', 'Xem lịch của bạn trong mục Lịch làm.', link)
       from public.accounts ac join public.employees e on e.id = ac.employee_id where e.status = 'Đang làm';
  else
    for r in
      with ch as (
        select coalesce(n.employee_id, o.employee_id) as eid, coalesce(n.weekday, o.weekday) as d, coalesce(n.shift, o.shift) as s,
               o.branch_id as ob, o.role as orl, n.branch_id as nb, n.role as nrl
          from tmp_old o
          full join (select * from public.schedule_published where week_id = p_week) n
            on n.employee_id = o.employee_id and n.weekday = o.weekday and n.shift = o.shift
         where o.employee_id is null or n.employee_id is null or o.branch_id <> n.branch_id or o.role <> n.role)
      select ch.eid, ac.id as aid,
             string_agg(public.app__day_label(w.start_date, ch.d) || ' · ' || ch.s || ': ' ||
               case when ch.nb is null then 'ca ở ' || coalesce(bo.code, '?') || ' – ' || ch.orl || ' đã bị hủy'
                    when ch.ob is null then 'bạn được xếp thêm ca ở ' || coalesce(bn.code, '?') || ' – ' || ch.nrl
                    else 'đổi từ ' || coalesce(bo.code, '?') || ' – ' || ch.orl || ' sang ' || coalesce(bn.code, '?') || ' – ' || ch.nrl end,
               E'\n' order by ch.d, ch.s) as body
        from ch join public.accounts ac on ac.employee_id = ch.eid
        left join public.branches bo on bo.id = ch.ob left join public.branches bn on bn.id = ch.nb
       group by ch.eid, ac.id
    loop
      perform public.app__notify(r.aid, 'Lịch tuần ' || label || ' của bạn đã thay đổi', r.body, link);
      n_changed := n_changed + 1;
    end loop;
  end if;
  perform public.app_log('chot_tuan', 'week=' || p_week);
  return jsonb_build_object('first', first, 'changed', n_changed);
end $$;

create or replace function public.app_reopen(p_week bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__need('chot_tuan');
  perform public.app__week(p_week);
  if public.app__week_status(p_week) is distinct from 'ĐÃ CHỐT' then raise exception 'Tuần chưa chốt.'; end if;
  update public.schedule_closures set status = 'ĐANG CHỈNH SỬA', updated_at = public.vn_now_text() where week_id = p_week;
  perform public.app_log('mo_lai_tuan', 'week=' || p_week);
end $$;

-- ---------------------------------------------------------------- Thông báo tự động
-- Trang web gọi khi có người mở (tối đa ~1 lần/phút). Gửi "mở order", "sắp hết hạn" (3 giờ trước, chỉ người
-- chưa order), dọn thông báo cũ hơn 60 ngày. Chạy nhiều lần không gửi trùng.
create or replace function public.app_notify_tick() returns jsonb
language plpgsql security definer set search_path = public as $$
declare w public.weeks; win jsonb; label text; k text; n_mo int := 0; n_sap int := 0; now_ timestamp := public.vn_now();
begin
  if not public.app_staff() then return null; end if;
  for w in select * from public.weeks where end_date >= (now_::date - 1)::text loop
    if public.app__week_status(w.id) is not null then continue; end if;
    win := public.app_order_window(w.id);
    if win ->> 'state' <> 'dang_mo' then continue; end if;
    label := public.app__week_label(w);
    k := 'order_mo:' || w.id || ':' || to_char((win ->> 'open')::timestamp, 'YYYYMMDDHH24MI');
    insert into public.notification_events(event_key, created_at) values (k, public.vn_now_text()) on conflict do nothing;
    if found then
      insert into public.notifications(account_id, title, body, link, created_at)
      select ac.id, 'Đã mở order tuần ' || label, 'Hạn order: ' || (win ->> 'close_text') || '. Hãy chọn đủ các ô Đi làm được / Nghỉ.',
             '/order', public.vn_now_text()
        from public.accounts ac join public.employees e on e.id = ac.employee_id where e.status = 'Đang làm';
      get diagnostics n_mo = row_count;
    end if;
    if (win ->> 'close')::timestamp - now_ <= interval '3 hours' then
      k := 'sap_het_han:' || w.id || ':' || to_char((win ->> 'close')::timestamp, 'YYYYMMDDHH24MI');
      insert into public.notification_events(event_key, created_at) values (k, public.vn_now_text()) on conflict do nothing;
      if found then
        insert into public.notifications(account_id, title, body, link, created_at)
        select ac.id, 'Sắp hết hạn order tuần ' || label, 'Bạn chưa gửi order. Hạn: ' || (win ->> 'close_text') || '.',
               '/order', public.vn_now_text()
          from public.accounts ac join public.employees e on e.id = ac.employee_id
         where e.status = 'Đang làm' and not public.app__has_submitted(w.id, e.id);
        get diagnostics n_sap = row_count;
      end if;
    end if;
  end loop;
  delete from public.notifications where created_at < to_char(now_ - interval '60 days', 'YYYY-MM-DD HH24:MI:SS');
  delete from public.notification_events where created_at < to_char(now_ - interval '60 days', 'YYYY-MM-DD HH24:MI:SS');
  return jsonb_build_object('mo', n_mo, 'sap_het_han', n_sap);
end $$;

create or replace function public.app_notifications_read() returns void
language sql security definer set search_path = public as $$
  update public.notifications set read_at = public.vn_now_text()
   where account_id = (public.app_account()).id and read_at is null
$$;

-- ---------------------------------------------------------------- Danh mục
create or replace function public.app_save_shift(p_id bigint, p_name text, p_code text, p_status text) returns bigint
language plpgsql security definer set search_path = public as $$
declare old text; nid bigint; nm text := trim(p_name); cd text := upper(trim(p_code));
begin
  perform public.app__need('sua_danh_muc');
  if nm = '' or length(nm) > 30 then raise exception 'Tên ca không hợp lệ (1–30 ký tự).'; end if;
  if cd = '' or length(cd) > 5 then raise exception 'Mã ca không hợp lệ (1–5 ký tự).'; end if;
  if p_status not in ('Đang sử dụng', 'Ngừng sử dụng') then raise exception 'Trạng thái không hợp lệ.'; end if;
  if exists (select 1 from public.shifts where (lower(name) = lower(nm) or lower(code) = lower(cd)) and id is distinct from p_id) then
    raise exception 'Tên hoặc mã ca đã có.';
  end if;
  if p_id is null then
    insert into public.shifts(code, name, status, sort_order) values (cd, nm, p_status, (select coalesce(max(sort_order), 0) + 1 from public.shifts))
    returning id into nid;
    insert into public.branch_shifts(branch_id, shift_id, enabled) select id, nid, 0 from public.branches on conflict do nothing;
    perform public.app_log('them_ca', nm);
    return nid;
  end if;
  select name into old from public.shifts where id = p_id;
  if old is null then raise exception 'Không tìm thấy ca.'; end if;
  update public.shifts set name = nm, code = cd, status = p_status, updated_at = public.vn_now_text() where id = p_id;
  if old <> nm then
    update public.order_entries set shift = nm where shift = old;
    update public.weekly_schedule_entries set shift = nm where shift = old;
    update public.staffing_requirements set shift = nm where shift = old;
    update public.fixed_schedule_entries set shift = nm where shift = old;
    update public.order_edit_log set shift = nm where shift = old;
    update public.schedule_published set shift = nm where shift = old;
    update public.schedule_extra_rows set shift = nm where shift = old;
  end if;
  perform public.app_log('sua_ca', old || ' -> ' || nm);
  return p_id;
end $$;

create or replace function public.app_save_role(p_id bigint, p_name text, p_status text) returns bigint
language plpgsql security definer set search_path = public as $$
declare old text; nid bigint; nm text := trim(p_name);
begin
  perform public.app__need('sua_danh_muc');
  if nm = '' or length(nm) > 30 then raise exception 'Tên vai trò không hợp lệ (1–30 ký tự).'; end if;
  if p_status not in ('Đang sử dụng', 'Ngừng sử dụng') then raise exception 'Trạng thái không hợp lệ.'; end if;
  if exists (select 1 from public.work_roles where lower(name) = lower(nm) and id is distinct from p_id) then raise exception 'Vai trò đã có.'; end if;
  if p_id is null then
    insert into public.work_roles(name, status, sort_order) values (nm, p_status, (select coalesce(max(sort_order), 0) + 1 from public.work_roles))
    returning id into nid;
    perform public.app_log('them_vai_tro', nm);
    return nid;
  end if;
  select name into old from public.work_roles where id = p_id;
  if old is null then raise exception 'Không tìm thấy vai trò.'; end if;
  update public.work_roles set name = nm, status = p_status where id = p_id;
  if old <> nm then
    update public.employee_roles set role = nm where role = old;
    update public.staffing_requirements set role = nm where role = old;
    update public.fixed_schedule_entries set role = nm where role = old;
    update public.weekly_schedule_entries set role = nm where role = old;
    update public.employees set preferred_role = nm where preferred_role = old;
    update public.employee_work_plans set preferred_role = nm where preferred_role = old;
    update public.schedule_published set role = nm where role = old;
    update public.schedule_extra_rows set role = nm where role = old;
    update public.evaluation_criteria set role = nm where role = old;
    update public.evaluation_round_criteria set role = nm where role = old;
    update public.evaluation_round_employees set role = nm where role = old;
  end if;
  perform public.app_log('sua_vai_tro', old || ' -> ' || nm);
  return p_id;
end $$;

create or replace function public.app_delete_branch(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__need('sua_danh_muc');
  if exists (select 1 from public.employee_branches where branch_id = p_id)
     or exists (select 1 from public.staffing_requirements where branch_id = p_id and required_count > 0)
     or exists (select 1 from public.fixed_schedule_entries where branch_id = p_id)
     or exists (select 1 from public.weekly_schedule_entries where branch_id = p_id) then
    raise exception 'Cơ sở đã phát sinh dữ liệu; chỉ được chuyển sang Ngừng hoạt động.';
  end if;
  delete from public.branches where id = p_id;
  perform public.app_log('xoa_co_so', p_id::text);
end $$;

create or replace function public.app_delete_shift(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  perform public.app__need('sua_danh_muc');
  select name into nm from public.shifts where id = p_id;
  if nm is null then return; end if;
  if exists (select 1 from public.staffing_requirements where shift = nm and required_count > 0)
     or exists (select 1 from public.order_entries where shift = nm)
     or exists (select 1 from public.fixed_schedule_entries where shift = nm)
     or exists (select 1 from public.weekly_schedule_entries where shift = nm) then
    raise exception 'Ca đã phát sinh dữ liệu; chỉ được chuyển sang Ngừng sử dụng.';
  end if;
  delete from public.staffing_requirements where shift = nm;
  delete from public.shifts where id = p_id;
  perform public.app_log('xoa_ca', nm);
end $$;

create or replace function public.app_delete_employee(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; acc public.accounts; e record;
begin
  a := public.app__need('quan_ly_nhan_vien');
  select * into e from public.employees where id = p_id;
  if not found then raise exception 'Không tìm thấy nhân viên.'; end if;
  select * into acc from public.accounts where employee_id = p_id;
  if acc.id = a.id then raise exception 'Không xóa được chính bạn.'; end if;
  if acc.system_role in ('chu', 'ql_tong') and not public.app_can('phan_quyen') then raise exception 'Chỉ Chủ được xóa Quản lý tổng.'; end if;
  if exists (select 1 from public.order_entries where employee_id = p_id)
     or exists (select 1 from public.fixed_schedule_members where employee_id = p_id)
     or exists (select 1 from public.fixed_schedule_entries where employee_id = p_id)
     or exists (select 1 from public.weekly_schedule_entries where employee_id = p_id)
     or exists (select 1 from public.employee_work_plans where employee_id = p_id)
     or exists (select 1 from public.evaluation_round_employees where employee_id = p_id) then
    raise exception 'Nhân viên đã phát sinh order, lịch cố định, lịch làm hoặc đánh giá. Hãy chuyển sang Ngừng làm.';
  end if;
  if acc.auth_user_id is not null then
    raise exception 'Nhân viên đã có tài khoản đăng nhập đang dùng. Hãy chuyển sang Ngừng làm thay vì xóa.';
  end if;
  delete from public.accounts where employee_id = p_id;
  delete from public.employees where id = p_id;
  perform public.app_log('xoa_nhan_vien', e.code || ' – ' || e.name);
end $$;

-- Thêm / sửa nhân viên. p: {code,name,rank,status,roles[],preferred_role,branch_ids[],email,phone,start_date}
create or replace function public.app_save_employee(p_id bigint, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; acc public.accounts; v_code text := trim(coalesce(p ->> 'code', '')); nm text := trim(coalesce(p ->> 'name', ''));
        rk text := p ->> 'rank'; st text := coalesce(nullif(p ->> 'status', ''), 'Đang làm'); roles text[]; brs bigint[];
        pref text; em text := nullif(trim(coalesce(p ->> 'email', '')), ''); ph text := nullif(trim(coalesce(p ->> 'phone', '')), '');
        sd text := nullif(trim(coalesce(p ->> 'start_date', '')), ''); eid bigint;
begin
  a := public.app__need('quan_ly_nhan_vien');
  if v_code = '' or length(v_code) > 20 or v_code !~ '^[0-9A-Za-zÀ-ỹĐđ_.-]+$' then
    raise exception 'Mã nhân viên chỉ gồm chữ, số và các dấu . _ - (không có khoảng trắng), tối đa 20 ký tự.';
  end if;
  if exists (select 1 from public.employees where lower(employees.code) = lower(v_code) and employees.id is distinct from p_id) then
    raise exception 'Mã % đã có người dùng.', v_code;
  end if;
  if exists (select 1 from public.accounts where lower(login_name) = lower(v_code)) then raise exception 'Mã % trùng mã đăng nhập riêng.', v_code; end if;
  if nm = '' or length(nm) > 80 then raise exception 'Tên không được để trống (tối đa 80 ký tự).'; end if;
  if rk not in ('Thử việc', 'Cấp 1', 'Cấp 2', 'Quản lý') then raise exception 'Hãy chọn cấp bậc.'; end if;
  if st not in ('Đang làm', 'Ngừng làm') then raise exception 'Trạng thái không hợp lệ.'; end if;
  select coalesce(array_agg(x), '{}') into roles from jsonb_array_elements_text(coalesce(p -> 'roles', '[]')) x
   where exists (select 1 from public.work_roles w where w.name = x);
  if coalesce(array_length(roles, 1), 0) = 0 then raise exception 'Hãy chọn ít nhất một vai trò làm việc.'; end if;
  pref := coalesce(nullif(p ->> 'preferred_role', ''), roles[1]);
  if not (pref = any(roles)) then raise exception 'Vai trò ưu tiên phải nằm trong các vai trò đã chọn.'; end if;
  select coalesce(array_agg(x::bigint), '{}') into brs from jsonb_array_elements_text(coalesce(p -> 'branch_ids', '[]')) x
   where exists (select 1 from public.branches b where b.id = x::bigint);
  if coalesce(array_length(brs, 1), 0) = 0 then raise exception 'Hãy chọn ít nhất một chi nhánh làm được.'; end if;
  if em is not null and em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email không hợp lệ.'; end if;
  if ph is not null and ph !~ '^[0-9 +().-]{8,20}$' then raise exception 'Số điện thoại không hợp lệ.'; end if;
  if sd is not null then begin perform sd::date; exception when others then raise exception 'Ngày bắt đầu vào làm không hợp lệ.'; end; end if;
  if p_id is not null then
    select * into acc from public.accounts where employee_id = p_id;
    if acc.system_role in ('chu', 'ql_tong') and not public.app_can('phan_quyen') and acc.id <> a.id then
      raise exception 'Chỉ Chủ được sửa thông tin của Quản lý tổng.';
    end if;
    update public.employees set code = v_code, name = nm, rank = rk, status = st, preferred_role = pref,
           start_date = sd, updated_at = public.vn_now_text() where id = p_id;
    if not found then raise exception 'Không tìm thấy nhân viên.'; end if;
    eid := p_id;
  else
    insert into public.employees(code, name, rank, status, preferred_role, start_date) values (v_code, nm, rk, st, pref, sd)
    returning id into eid;
  end if;
  insert into public.employee_contacts(employee_id, email, phone) values (eid, em, ph)
  on conflict (employee_id) do update set email = excluded.email, phone = excluded.phone;
  delete from public.employee_roles where employee_id = eid;
  insert into public.employee_roles(employee_id, role) select eid, unnest(roles);
  delete from public.employee_branches where employee_id = eid;
  insert into public.employee_branches(employee_id, branch_id) select eid, unnest(brs);
  delete from public.fixed_schedule_entries where employee_id = eid and (not (branch_id = any(brs)) or not (role = any(roles)));
  perform public.app_log(case when p_id is null then 'them_nhan_vien' else 'sua_nhan_vien' end, v_code);
  return eid;
end $$;

-- Nhập danh sách nhân viên từ Excel. p_rows: [{code,name,rank,status,branches:["LHP"],roles:["Pha chế"]}]
create or replace function public.app_import_employees(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; eid bigint; added int := 0; updated int := 0; rl text;
begin
  perform public.app__need('quan_ly_nhan_vien');
  for r in select * from jsonb_array_elements(p_rows) loop
    select id into eid from public.employees where lower(code) = lower(trim(r ->> 'code'));
    if eid is not null then
      update public.employees set name = r ->> 'name', rank = r ->> 'rank', status = r ->> 'status',
             preferred_role = coalesce(nullif(preferred_role, ''), r -> 'roles' ->> 0), updated_at = public.vn_now_text()
       where id = eid;
      updated := updated + 1;
    else
      insert into public.employees(code, name, rank, status, preferred_role)
      values (trim(r ->> 'code'), r ->> 'name', r ->> 'rank', r ->> 'status', r -> 'roles' ->> 0) returning id into eid;
      added := added + 1;
    end if;
    delete from public.employee_branches where employee_id = eid;
    insert into public.employee_branches(employee_id, branch_id)
    select distinct eid, b.id from jsonb_array_elements_text(coalesce(r -> 'branches', '[]')) x
      join public.branches b on lower(b.code) = lower(x) or lower(coalesce(b.display_code, '')) = lower(x) or lower(coalesce(b.system_code, '')) = lower(x);
    delete from public.employee_roles where employee_id = eid;
    for rl in select distinct x from jsonb_array_elements_text(coalesce(r -> 'roles', '[]')) x loop
      insert into public.employee_roles(employee_id, role) values (eid, rl);
      insert into public.work_roles(name, sort_order) select rl, 99 where not exists (select 1 from public.work_roles where lower(name) = lower(rl));
    end loop;
    eid := null;
  end loop;
  perform public.app_log('nhap_excel_nhan_vien', 'them=' || added || ' sua=' || updated);
  return jsonb_build_object('added', added, 'updated', updated);
end $$;

-- ---------------------------------------------------------------- Quyền gọi hàm
revoke execute on all functions in schema public from public, anon;
grant execute on function public.app_login_email(text) to anon, authenticated;
grant execute on function public.vn_now(), public.vn_now_text() to anon, authenticated;
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'app%' loop
    if f.proname like 'app\_\_%' or f.proname = 'app_kill_sessions' then
      execute format('revoke execute on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
grant execute on all functions in schema public to service_role;
