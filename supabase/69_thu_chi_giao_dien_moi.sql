-- Bước 69: Thu chi giao diện mới (anh Tiến chốt 13/11) — số tổng hợp đầu trang cho 1 cơ sở:
--   * Nợ = khách nợ chưa thu (mọi thời điểm, cơ sở đang xem)
--   * Cho vay = còn nợ (vay − đã trả) của cơ sở
--   * Chênh lệch tiền = thiếu / dư của các ca đã chốt trong tháng (tiền mặt + chuyển khoản; lệch ≤ 5.000 coi như khớp)
--   * Chi tháng trước theo nhóm (để so sánh ▲ / ▼ ở khối "Chi theo loại")
-- Chạy lại nhiều lần không sao.

create or replace function public.app_tc_summary(p_branch bigint, p_from text, p_to text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
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
end $$;

revoke execute on function public.app_tc_summary(bigint, text, text) from public, anon;
grant execute on function public.app_tc_summary(bigint, text, text) to authenticated;

insert into public.app_migrations(file) values ('69_thu_chi_giao_dien_moi.sql') on conflict (file) do nothing;
