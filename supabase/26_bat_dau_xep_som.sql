-- =====================================================================
-- 26. Cho phép "Bắt đầu xếp lịch" khi order chưa hết hạn (anh Tiến chốt 09/11/2026).
--  Bấm sớm thì order của tuần đó đóng ngay (giờ hết hạn = lúc bấm). Tuần đã có ca được xếp vẫn không bắt đầu lại.
--  Muốn cho nhân viên order tiếp: "Quay lại order" rồi cài giờ hết hạn mới ở Giờ order.
-- Chạy lại nhiều lần không sao.
-- =====================================================================

create or replace function public.app__start_scheduling(w public.weeks) returns integer
language plpgsql security definer set search_path = public as $$
declare n_fixed int := 0; win jsonb;
begin
  if public.app__week_status(w.id) is not null then raise exception 'Tuần này đã bắt đầu xếp lịch.'; end if;
  -- Bắt đầu xếp khi order chưa hết hạn: đóng order ngay lúc này (nhân viên không order thêm, lịch không lệch với order)
  win := public.app_order_window(w.id);
  if win ->> 'state' <> 'da_dong' then
    insert into public.week_order_windows(week_id, open_at, close_at, updated_at)
    values (w.id, to_char(least((win ->> 'open')::timestamp, public.vn_now() - interval '1 minute'), 'YYYY-MM-DD"T"HH24:MI'),
            to_char(public.vn_now() - interval '1 minute', 'YYYY-MM-DD"T"HH24:MI'), public.vn_now_text())
    on conflict (week_id) do update set open_at = excluded.open_at, close_at = excluded.close_at, updated_at = excluded.updated_at;
    perform public.app_log('dong_order_som', 'week=' || w.id || ' hạn cũ ' || (win ->> 'close_text'));
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

revoke execute on function public.app__start_scheduling(public.weeks) from public, anon, authenticated;
