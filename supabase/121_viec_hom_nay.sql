-- Việc hôm nay (đợt 1): ca của người đăng nhập trong ngày + đợt Order đang mở chưa gửi.
create or replace function public.app_today_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a public.accounts; me_emp bigint; today date := public.vn_now()::date;
  nxt public.weeks; ow jsonb; order_info jsonb;
begin
  a := public.app__need(null);
  me_emp := public.app_my_employee();
  if me_emp is not null and coalesce(public.app_can('order_ca'), false) then
    select * into nxt from public.weeks where start_date::date = date_trunc('week', today)::date + 7;
    if nxt.id is not null then
      ow := public.app_order_window(nxt.id);
      if ow ->> 'state' = 'dang_mo' then
        order_info := jsonb_build_object('week_id', nxt.id, 'start_date', nxt.start_date, 'close_at', ow ->> 'close',
          'close_text', ow ->> 'close_text',
          'submitted', exists (select 1 from public.order_submissions s where s.week_id = nxt.id and s.employee_id = me_emp));
      end if;
    end if;
  end if;
  return jsonb_build_object(
    'today', today, 'now', public.vn_now_text(), 'has_employee', me_emp is not null,
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'shift', sp.shift, 'branch_id', sp.branch_id, 'branch', coalesce(b.display_code, b.code), 'role', sp.role,
        'start', left(bs.start_time, 5), 'end', left(bs.end_time, 5),
        'report_id', r.id, 'report_status', r.status, 'recon_status', r.recon_status)
        order by bs.start_time nulls last, sh.sort_order, sp.shift)
      from public.schedule_published sp
      join public.weeks w on w.id = sp.week_id
      join public.branches b on b.id = sp.branch_id
      left join public.shifts sh on sh.name = sp.shift
      left join public.branch_shifts bs on bs.branch_id = sp.branch_id and bs.shift_id = sh.id
      left join lateral (select x.id, x.status, x.recon_status from public.shift_reports x
        where x.branch_id = sp.branch_id and x.work_date = today::text and x.shift = sp.shift order by x.id desc limit 1) r on true
      where me_emp is not null and sp.employee_id = me_emp
        and w.start_date::date <= today and today <= w.start_date::date + 6
        and sp.weekday = today - w.start_date::date
    ), '[]'::jsonb),
    'order', order_info);
end $$;

revoke execute on function public.app_today_me() from public, anon;
grant execute on function public.app_today_me() to authenticated;

insert into public.app_migrations(file) values ('121_viec_hom_nay.sql') on conflict (file) do nothing;
