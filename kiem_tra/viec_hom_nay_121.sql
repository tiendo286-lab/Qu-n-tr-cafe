-- KIỂM TRA tệp 121 (app_today_me). Ghép supabase/121_viec_hom_nay.sql vào đầu cùng lần gửi.
-- Dữ liệu tạm cho 1 nhân viên có tài khoản; khối DO kết thúc bằng RAISE 'REPORT>> …' nên tự hoàn tác.
do $$
declare
  anv public.accounts; achu public.accounts; wk public.weeks; nxt public.weeks;
  today date := public.vn_now()::date; j jsonb; m jsonb := '{}'::jsonb; br public.branches;
begin
  select a.* into anv from public.accounts a join public.employees e on e.id = a.employee_id
    where a.system_role = 'nv' and a.auth_user_id is not null and a.locked = 0 and e.status = 'Đang làm' order by a.id limit 1;
  select * into achu from public.accounts where system_role = 'chu' and auth_user_id is not null and locked = 0 and employee_id is null order by id limit 1;
  select * into wk from public.weeks where start_date::date <= today and today <= start_date::date + 6;
  select * into br from public.branches where status = 'Đang hoạt động' order by sort_order, id limit 1;
  assert wk.id is not null, 'Chưa có tuần hiện tại để thử';

  -- 2 ca hôm nay cho nhân viên thử (Tối trước Sáng để kiểm tra thứ tự theo giờ)
  delete from public.schedule_published where employee_id = anv.employee_id and week_id = wk.id and weekday = today - wk.start_date::date;
  insert into public.schedule_published(week_id, employee_id, weekday, shift, branch_id, role, published_at)
    values (wk.id, anv.employee_id, today - wk.start_date::date, 'Tối', br.id, 'Pha chế', public.vn_now_text()),
           (wk.id, anv.employee_id, today - wk.start_date::date, 'Sáng', br.id, 'Pha chế', public.vn_now_text());
  -- đợt Order tuần sau đang mở
  select * into nxt from public.weeks where start_date::date = date_trunc('week', today)::date + 7;
  if nxt.id is null then
    insert into public.weeks(start_date, end_date) values ((date_trunc('week', today)::date + 7)::text, (date_trunc('week', today)::date + 13)::text) returning * into nxt;
  end if;
  insert into public.week_order_windows(week_id, open_at, close_at, updated_at)
    values (nxt.id, to_char(public.vn_now() - interval '1 hour', 'YYYY-MM-DD"T"HH24:MI'), to_char(public.vn_now() + interval '1 day', 'YYYY-MM-DD"T"HH24:MI'), public.vn_now_text())
    on conflict (week_id) do update set open_at = excluded.open_at, close_at = excluded.close_at;
  delete from public.order_submissions where week_id = nxt.id and employee_id = anv.employee_id;

  perform set_config('request.jwt.claims', json_build_object('sub', anv.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_today_me();
  assert (j ->> 'has_employee')::boolean, 'Nhân viên có hồ sơ';
  assert jsonb_array_length(j -> 'shifts') = 2, 'Đủ 2 ca hôm nay';
  assert j -> 'shifts' -> 0 ->> 'shift' = 'Sáng', 'Ca Sáng đứng trước ca Tối';
  assert (j -> 'shifts' -> 0 ->> 'branch_id')::bigint = br.id, 'Đúng cơ sở';
  assert (j -> 'order' ->> 'week_id')::bigint = nxt.id, 'Thấy đợt Order đang mở';
  assert not (j -> 'order' ->> 'submitted')::boolean, 'Chưa gửi Order';
  m := m || jsonb_build_object('nv', j);
  insert into public.order_submissions(week_id, employee_id, submitted_at, updated_at) values (nxt.id, anv.employee_id, public.vn_now_text(), public.vn_now_text());
  assert (public.app_today_me() -> 'order' ->> 'submitted')::boolean, 'Đã gửi Order';
  update public.week_order_windows set close_at = to_char(public.vn_now() - interval '1 minute', 'YYYY-MM-DD"T"HH24:MI') where week_id = nxt.id;
  assert public.app_today_me() -> 'order' = 'null'::jsonb or public.app_today_me() -> 'order' is null, 'Đợt đã đóng thì không nhắc';

  if achu.id is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', achu.auth_user_id, 'role', 'authenticated')::text, true);
    j := public.app_today_me();
    assert not (j ->> 'has_employee')::boolean and jsonb_array_length(j -> 'shifts') = 0, 'Chủ không gắn nhân viên thì không có ca';
    m := m || jsonb_build_object('chu', j);
  end if;
  assert not has_function_privilege('anon', 'public.app_today_me()', 'EXECUTE'), 'Khách không gọi được';
  assert has_function_privilege('authenticated', 'public.app_today_me()', 'EXECUTE'), 'Người đăng nhập gọi được';
  raise exception 'REPORT>> %', m;
end $$;
