-- Bước 80 (anh Tiến 13/11/2026): bỏ chữ "khách mượn" — mọi khoản là NỢ, chia Nợ TM (kind 'muon', khách cầm tiền mặt của quán)
-- và Nợ HĐ (kind 'bill', chưa trả hóa đơn). Thu chi › Công nợ và ô "Nợ" của Thu chi tính cả Nợ TM. Chạy lại nhiều lần không sao.

CREATE OR REPLACE FUNCTION public.app_cn_debts(p_branch bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.app__tc_need(p_branch);
  return jsonb_build_object('can_edit', public.app__cn_can(p_branch),
    'open', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'kind', coalesce(d.kind, 'bill'), 'name', d.table_name, 'phone', d.phone, 'amount', d.amount, 'note', d.note,
              'date', coalesce(o.work_date, left(d.created_at, 10)), 'shift', o.shift, 'report_id', d.report_id, 'by_ql', d.report_id is null,
              'by', public.app__acc_name(d.created_by), 'split', d.split_from is not null, 'gap_report', d.gap_report,
              'gap_ca', (select x.shift || ' ' || to_char(x.work_date::date, 'DD/MM') from public.shift_reports x where x.id = d.gap_report),
              'paid_before', coalesce((select sum(x.amount) from public.shift_debts x where x.closed_at is not null and (x.id = d.split_from or x.split_from = d.split_from) and d.split_from is not null), 0))
              order by coalesce(o.work_date, left(d.created_at, 10)), d.id)
            from public.shift_debts d left join public.shift_reports o on o.id = d.report_id
           where d.branch_id = p_branch and d.closed_at is null
             and (d.report_id is null or o.status = 'hoan_thanh')), '[]'));
end $function$;

CREATE OR REPLACE FUNCTION public.app_tc_summary(p_branch bigint, p_from text, p_to text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app_account(); pf text; pt text; ca jsonb; prev jsonb; debts jsonb; loans bigint;
begin
  if a.id is null then raise exception 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'; end if;
  if p_branch is null or not public.app__tc_can(p_branch) then raise exception 'Bạn không được xem thu chi của cơ sở này.'; end if;
  if p_from !~ '^\d{4}-\d{2}-\d{2}$' or p_to !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Khoảng ngày không hợp lệ.'; end if;
  pf := to_char((p_from::date - interval '1 month')::date, 'YYYY-MM-DD');
  pt := to_char((p_from::date - interval '1 day')::date, 'YYYY-MM-DD');

  select jsonb_build_object('n', count(*), 'sum', coalesce(sum(d.amount), 0)) into debts
    from public.shift_debts d where d.branch_id = p_branch and d.closed_report_id is null and d.closed_at is null;

  select coalesce(sum(greatest(l.amount - coalesce((select sum(y.amount) from public.branch_loan_payments y where y.loan_id = l.id), 0), 0)), 0)::bigint into loans
    from public.branch_loans l where l.branch_id = p_branch;

  -- mỗi ca: lệch = tiền mặt còn + chuyển khoản còn (âm = thiếu, dương = dư); |lệch| ≤ 5.000 bỏ qua
  select jsonb_build_object(
           'short', coalesce(sum(v) filter (where v < -5000), 0), 'n_short', count(*) filter (where v < -5000),
           'over', coalesce(sum(v) filter (where v > 5000), 0), 'n_over', count(*) filter (where v > 5000), 'n', count(*)) into ca
    from (select coalesce((m ->> 'tm_left')::bigint, 0) + coalesce((m ->> 'ck_left')::bigint, 0) as v
            from public.shift_reports r cross join lateral (select public.app__ca_money(r.id) m) z
           where r.branch_id = p_branch and r.status = 'hoan_thanh' and r.work_date between p_from and p_to) x;

  select coalesce(jsonb_object_agg(k, s), '{}') into prev from (
    select coalesce(x ->> 'category_id', '0') k, sum((x ->> 'amount')::bigint) s
      from jsonb_array_elements(public.app_tc_list(p_branch, pf, pt) -> 'rows') x
     where x ->> 'kind' = 'chi' and x ->> 'src' <> 'ka' and coalesce((x ->> 'excluded')::boolean, false) = false and x ->> 'loan_id' is null
     group by 1) y;

  return jsonb_build_object('debts', debts, 'loans_left', loans, 'ca', ca, 'prev_chi', prev, 'prev_from', pf);
end $function$;

insert into public.app_migrations(file) values ('80_no_tm_no_hd.sql') on conflict (file) do nothing;
