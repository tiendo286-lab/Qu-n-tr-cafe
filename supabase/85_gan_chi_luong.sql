-- Bước 90 (anh Tiến 14/11/2026): Đối soát ca › Thu chi — khoản "Chi lương" tiền mặt gán cho nhân viên (không bắt buộc).
--  Có gán → Bảng công cộng vào cột "Lương tiền mặt đã trả" của người đó; để trống → chỉ là chi lương của quán.
-- Chạy lại nhiều lần không sao.

alter table public.fin_move_cats add column if not exists employee_id bigint;

create or replace function public.app_tc_move_emp(p_report bigint, p_mkey text, p_emp bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports;
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__tc_need(r.branch_id);
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT.'; end if;
  if p_emp is not null and not exists (select 1 from public.employees e where e.id = p_emp) then raise exception 'Không tìm thấy nhân viên.'; end if;
  insert into public.fin_move_cats(report_id, mkey, employee_id, by_account) values (p_report, p_mkey, p_emp, a.id)
  on conflict (report_id, mkey) do update set employee_id = excluded.employee_id;
  perform public.app_log('chi_luong_gan', 'report=' || p_report || ' ' || p_mkey || ' nv=' || coalesce(p_emp::text, '-'));
end $$;
revoke all on function public.app_tc_move_emp(bigint, text, bigint) from public, anon;
grant execute on function public.app_tc_move_emp(bigint, text, bigint) to authenticated;

CREATE OR REPLACE FUNCTION public.app_tc_list(p_branch bigint, p_from text, p_to text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app_account(); brs bigint[]; rows jsonb;
begin
  if a.id is null then raise exception 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'; end if;
  if p_from is null or p_to is null or p_from !~ '^\d{4}-\d{2}-\d{2}$' or p_to !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Khoảng ngày không hợp lệ.'; end if;
  select coalesce(array_agg(b.id order by b.sort_order), '{}') into brs from public.branches b
   where b.status = 'Đang hoạt động' and public.app__tc_can(b.id) and (p_branch is null or b.id = p_branch);
  if p_branch is not null and coalesce(array_length(brs, 1), 0) = 0 then raise exception 'Bạn không được xem thu chi của cơ sở này.'; end if;

  select coalesce(jsonb_agg(z.j order by z.d desc, z.br, z.o), '[]') into rows from (
    select m.work_date as d, m.branch_id as br, array_position(public.app__shifts(), m.shift) * 1000 + m.ord as o,
           jsonb_build_object('src', 'ca', 'report_id', m.report_id, 'mkey', m.mkey, 'branch_id', m.branch_id,
             'date', m.work_date, 'shift', m.shift, 'kind', case when m.amount < 0 then 'chi' else 'thu' end, 'pay', m.pay,
             'amount', abs(m.amount), 'note', m.note, 'category_id', fc.category_id, 'category', c.name,
             'employee_id', fc.employee_id, 'employee', (select e.code || ' – ' || e.name from public.employees e where e.id = fc.employee_id),
             'excluded', coalesce(fc.excluded, case when m.amount > 0 then 1 else 0 end) = 1,
             'status', case when coalesce(fc.checked, 0) = 1 then 'da' else 'cho' end,
             'checked_by', public.app__acc_name(fc.checked_by), 'checked_at', fc.checked_at, 'auto', m.auto,
             'loan_id', (select l.id from public.branch_loans l where l.report_id = m.report_id and l.mkey = m.mkey),
             'ka_n', (select count(*) from public.shift_shortfalls s where s.report_id = m.report_id and s.move_mkey = m.mkey and s.status <> 'huy'),
             'by', public.app__acc_name(m.created_by), 'locked', public.app__fin_locked(m.branch_id, m.work_date)) as j
      from public.app__tc_moves_x(null, p_from, p_to) m
      left join public.fin_move_cats fc on fc.report_id = m.report_id and fc.mkey = m.mkey
      left join public.fin_categories c on c.id = fc.category_id
     where m.branch_id = any(brs)
    union all
    select e.entry_date, e.branch_id, 100000 + e.id,
           jsonb_build_object('src', 'tay', 'id', e.id, 'branch_id', e.branch_id, 'date', e.entry_date, 'shift', null,
             'kind', e.kind, 'pay', e.pay_method, 'amount', e.amount, 'note', e.note, 'category_id', e.category_id, 'category', c.name,
             'excluded', false, 'status', 'da', 'checked_by', public.app__acc_name(e.created_by), 'checked_at', e.created_at,
             'bank_out', exists (select 1 from public.shift_bank_outs o where o.fin_entry_id = e.id), 'gap', exists (select 1 from public.gap_decisions g where g.fin_entry_id = e.id),
             'by', public.app__acc_name(e.created_by), 'locked', public.app__fin_locked(e.branch_id, e.entry_date))
      from public.fin_entries e left join public.fin_categories c on c.id = e.category_id
     where e.branch_id = any(brs) and e.entry_date between p_from and p_to
    union all
    select r.work_date, r.branch_id, 200000 + s.id,
           jsonb_build_object('src', 'ka', 'id', s.id, 'report_id', s.report_id, 'branch_id', r.branch_id, 'date', r.work_date, 'shift', r.shift,
             'kind', 'chi', 'pay', null, 'amount', s.amount, 'note', 'Thiếu tiền ca – ' || coalesce(em.code || ' – ' || em.name, '?'),
             'item', s.item, 'item_label', public.app__ca_item_label(s.item), 'employee_id', s.employee_id, 'employee', em.code || ' – ' || em.name,
             'reason', s.reason, 'ka_status', s.status, 'move_mkey', s.move_mkey, 'auto_tru', s.auto_tru, 'status_note', s.status_note, 'reply', s.reply, 'reply_at', s.reply_at,
             'seen_at', s.seen_at, 'category_id', null, 'category', null, 'excluded', true, 'status', 'da',
             'checked_by', public.app__acc_name(s.created_by), 'checked_at', s.created_at, 'by', public.app__acc_name(s.created_by),
             'locked', public.app__fin_locked(r.branch_id, r.work_date))
      from public.shift_shortfalls s join public.shift_reports r on r.id = s.report_id left join public.employees em on em.id = s.employee_id
     where s.status <> 'huy' and r.branch_id = any(brs) and r.work_date between p_from and p_to
  ) z;

  return jsonb_build_object('rows', rows, 'can_money', coalesce(public.app_can('doi_soat'), false), 'can_direct', coalesce(public.app__fin_admin(), false),
    'loan_branches', coalesce((select jsonb_agg(b.id) from public.branches b where b.id = any(brs) and public.app__loan_branch_ok(b.id)), '[]'),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code), 'name', b.name) order by b.sort_order)
                 from public.branches b where b.status = 'Đang hoạt động' and public.app__tc_can(b.id)), '[]'),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'name', c.name, 'active', c.active = 1) order by c.kind, c.sort_order, c.name)
                 from public.fin_categories c), '[]'));
end $function$;

CREATE OR REPLACE FUNCTION public.app_bang_cong(p_month text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; f text; t text;
begin
  a := public.app__need(null);
  if not (public.app_can('bao_cao') or public.app__cv_classify_can()) then raise exception 'Bạn không có quyền thực hiện thao tác này.'; end if;
  if coalesce(p_month, '') !~ '^\d{4}-\d{2}$' then raise exception 'Tháng không hợp lệ.'; end if;
  f := p_month || '-01'; t := to_char((f::date + interval '1 month' - interval '1 day'), 'YYYY-MM-DD');
  return jsonb_build_object('month', p_month, 'can_resolve', public.app__cv_classify_can(), 'is_owner', a.system_role = 'chu',
    'rows', coalesce((select jsonb_agg(x order by x ->> 'code') from (
        select jsonb_build_object('employee_id', e.id, 'code', e.code, 'name', e.name, 'rank', e.rank, 'pay_cash', e.pay_cash, 'status', e.status,
          'shifts', count(*) filter (where w.worked), 'hours', coalesce(sum(w.hours) filter (where w.worked), 0),
          'pending', count(*) filter (where w.worked and not w.official),
          'cash_paid', coalesce(sum(w.cash) filter (where w.worked), 0)   -- bước 90: + khoản Chi lương tiền mặt gán cho người này ở Thu chi
             + coalesce((select sum(abs(m.amount)) from public.app__tc_moves_x(null, f, t) m join public.fin_move_cats fc on fc.report_id = m.report_id and fc.mkey = m.mkey
                          where fc.employee_id = e.id and m.pay = 'tien_mat' and m.amount < 0), 0),
          'absent', count(*) filter (where not w.worked),
          'x2_hours', coalesce((select sum(c.hours) from public.shift_covers c join public.shift_reports r2 on r2.id = c.report_id
                         join public.shift_cover_reviews v on v.report_id = c.report_id and v.ok_at is not null
                        where c.helper_id = e.id and c.x2 and r2.work_date between f and t), 0),
          'deduct_hours', coalesce((select sum(c.deduct_hours) from public.shift_covers c join public.shift_reports r2 on r2.id = c.report_id
                         join public.shift_cover_reviews v on v.report_id = c.report_id and v.ok_at is not null
                        where c.absent_id = e.id and r2.work_date between f and t), 0),
          'fine', coalesce((select sum(c.fine) from public.shift_covers c join public.shift_reports r2 on r2.id = c.report_id
                         join public.shift_cover_reviews v on v.report_id = c.report_id and v.ok_at is not null
                        where c.absent_id = e.id and r2.work_date between f and t), 0)) x
          from public.employees e
          join (select (s ->> 'employee_id')::bigint eid, coalesce((s ->> 'worked')::boolean, true) worked, public.app__hours(s ->> 'time_in', s ->> 'time_out') hours,
                       coalesce(nullif(s ->> 'cash_paid', '')::bigint, 0) cash,
                       exists (select 1 from public.shift_report_checks k where k.report_id = r.id and k.item = 'nhan_su') official
                  from public.shift_reports r cross join lateral jsonb_array_elements(coalesce(public.app__ca_eff(r.id) -> 'staff', '[]'::jsonb)) s
                 where r.status = 'hoan_thanh' and r.work_date between f and t) w on w.eid = e.id
         group by e.id) q), '[]'),
    'covers', coalesce((select jsonb_agg(public.app__cv_json(c) || jsonb_build_object('date', r.work_date, 'shift', r.shift,
                  'branch', coalesce(b.display_code, b.code), 'approved', v.ok_at is not null, 'open', public.app__cv_open(r.work_date)) order by r.work_date, r.shift, c.id)
                from public.shift_covers c join public.shift_reports r on r.id = c.report_id join public.branches b on b.id = r.branch_id
                left join public.shift_cover_reviews v on v.report_id = c.report_id
               where r.work_date between f and t), '[]'));
end $function$;

insert into public.app_migrations(file) values ('85_gan_chi_luong.sql') on conflict (file) do nothing;
