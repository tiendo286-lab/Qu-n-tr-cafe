-- Bước 109b — trang Lệch tiền ca (LHP) không mở được: app_gap_list tính bảng lệch 2 lần (danh sách + đếm chờ xử lý),
-- LHP mất ~8,8 giây > giới hạn 8 giây của web. Sửa: tính app__gap_rows 1 lần vào bảng tạm rồi dùng lại. Nghiệp vụ không đổi.
CREATE OR REPLACE FUNCTION public.app_gap_list(p_branch bigint, p_month text)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
declare role text := public.app__gap_role(p_branch); f text; t text; f3 text; t3 text;
begin
  if (public.app_account()).id is null then raise exception 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'; end if;
  if role is null then raise exception 'Chỉ Chủ, Quản lý tổng, Quản lý cơ sở dùng tab Âm tiền.'; end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'Tháng không hợp lệ.'; end if;
  f := p_month || '-01'; t := to_char(f::date + interval '1 month' - interval '1 day', 'YYYY-MM-DD');
  f3 := to_char(f::date - 3, 'YYYY-MM-DD'); t3 := to_char(t::date + 3, 'YYYY-MM-DD');
  drop table if exists _gap_rows;
  create temp table _gap_rows on commit drop as select * from public.app__gap_rows(p_branch, f3, t3);
  return jsonb_build_object('role', role, 'from', f, 'to', t, 'pending', (select count(*)::int from _gap_rows g where g.work_date between f and t and g.kind = 'thieu' and g.state in ('cho_tien', 'cho_gan', 'cho_no'))
       + (select count(*)::int from public.gap_matches mm join public.shift_reports x on x.id = mm.short_report
           where mm.branch_id = p_branch and mm.status = 'cho_duyet' and x.work_date between f and t),
    'locked', public.app__fin_locked(p_branch, f),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('report_id', g.report_id, 'date', g.work_date, 'shift', g.shift, 'item', g.item, 'lech', g.lech,
               'kind', g.kind, 'total', g.total, 'tl', g.tl, 'dcs', g.dcs, 'mt', g.mt, 'mp', g.mp, 'remain', g.remain, 'state', g.state,
               'in_month', g.work_date between f and t, 'locked', public.app__fin_locked(p_branch, g.work_date),
               'result', (select jsonb_build_object('result', rr.result, 'amount', rr.amount, 'reason', rr.reason, 'by', public.app__acc_name(rr.by_account))
                            from public.shift_report_results rr where rr.report_id = g.report_id and rr.item = g.item),
               'staff', coalesce((select jsonb_agg(jsonb_build_object('employee_id', st.employee_id, 'name', coalesce(em.code || ' – ', '') || em.name) order by st.id)
                            from public.shift_report_staff st join public.employees em on em.id = st.employee_id
                           where st.report_id = g.report_id and coalesce(st.worked, 1) = 1), '[]'),
               'people', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', coalesce(em.code || ' – ', '') || em.name, 'amount', s.amount, 'status', s.status, 'note', s.status_note) order by s.id)
                            from public.shift_shortfalls s join public.employees em on em.id = s.employee_id
                           where s.report_id = g.report_id and s.item = g.item and s.status <> 'huy'), '[]'),
               'decisions', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'amount', d.amount, 'reason', d.reason, 'by', public.app__acc_name(d.created_by), 'at', d.created_at) order by d.id)
                            from public.gap_decisions d where d.report_id = g.report_id and d.item = g.item), '[]'),
               'matches', coalesce((select jsonb_agg(jsonb_build_object('id', mm.id, 'amount', mm.amount, 'reason', mm.reason, 'status', mm.status,
                              'other', case when mm.short_report = g.report_id then mm.over_report else mm.short_report end,
                              'other_date', o.work_date, 'other_shift', o.shift, 'by', public.app__acc_name(mm.created_by), 'mine', mm.created_by = (public.app_account()).id,
                              'approved_by', public.app__acc_name(mm.approved_by)) order by mm.id)
                            from public.gap_matches mm join public.shift_reports o on o.id = case when mm.short_report = g.report_id then mm.over_report else mm.short_report end
                           where mm.item = g.item and (mm.short_report = g.report_id or mm.over_report = g.report_id)), '[]'))
             order by g.work_date desc, array_position(public.app__shifts(), g.shift) desc, g.item)
           from _gap_rows g), '[]'),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code), 'name', b.name) order by b.sort_order)
               from public.branches b where b.status = 'Đang hoạt động' and public.app__gap_role(b.id) is not null), '[]'));
end $fn$;
revoke execute on function public.app_gap_list(bigint, text) from public, anon;
grant execute on function public.app_gap_list(bigint, text) to authenticated;
insert into public.app_migrations(file) values ('97_lech_tien_nhanh.sql') on conflict (file) do nothing;
