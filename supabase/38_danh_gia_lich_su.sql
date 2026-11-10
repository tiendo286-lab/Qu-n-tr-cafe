-- =====================================================================
-- BƯỚC 38: Khung trừ điểm lấy đủ thông tin trong 1 lần gọi (bộ tiêu chí, tiêu chí, tháng còn sửa được). Chạy sau 36.
-- Chạy lại nhiều lần không sao.
-- =====================================================================

create or replace function public.app_dg_history(p_employee bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; e public.employees; mon text := to_char(public.vn_now(), 'YYYY-MM');
begin
  a := public.app__dg_need();
  select * into e from public.employees where id = p_employee;
  if e.id is null then raise exception 'Không tìm thấy nhân viên.'; end if;
  return jsonb_build_object(
    'employee', jsonb_build_object('id', e.id, 'code', e.code, 'name', e.name, 'rank', e.rank,
       'set_code', public.app__dg_set_of(e.id), 'set_saved', exists (select 1 from public.employee_eval_sets s where s.employee_id = e.id),
       'is_me', a.employee_id is not null and a.employee_id = e.id),
    'month', mon, 'score', public.app__dg_score(e.id, mon), 'today', to_char(public.vn_now(), 'YYYY-MM-DD'),
    'sets', (select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name) order by s.sort_order) from public.eval_sets s),
    'criteria', (select jsonb_agg(jsonb_build_object('code', c.code, 'set_code', c.set_code, 'name', c.name) order by c.set_code, c.sort_order) from public.eval_criteria c),
    'open_months', coalesce((select jsonb_agg(m.month) from public.eval_month_open m), '[]'),
    'marks', coalesce((select jsonb_agg(public.app__dg_json(m) order by m.work_date desc, m.id desc)
                from public.eval_marks m where m.employee_id = e.id and m.status <> 'huy'), '[]'));
end $$;

revoke execute on function public.app_dg_history(bigint) from public, anon;
grant execute on function public.app_dg_history(bigint) to authenticated;
