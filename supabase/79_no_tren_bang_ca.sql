-- Bước 79 (anh Tiến 13/11): nhìn bảng phiếu (tab Chốt ca / Đối soát theo tuần) là biết ca nào có KHÁCH NỢ / KHÁCH MƯỢN và đã trả chưa.
-- Mỗi phiếu của 1 cơ sở trong khoảng ngày: nợ phát sinh ở ca (khách nợ, khách mượn; còn bao nhiêu chưa trả, trả ở ca nào) + nợ thu được trong ca.
-- Chỉ đọc. Chạy lại nhiều lần không sao.

create or replace function public.app_ca_debt_week(p_branch bigint, p_from text, p_to text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('chot_ca');
  if p_from !~ '^\d{4}-\d{2}-\d{2}$' or p_to !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Khoảng ngày không hợp lệ.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('report_id', r.id,
      'tao', coalesce((select jsonb_agg(jsonb_build_object('name', d.table_name, 'amount', d.amount, 'kind', d.kind, 'paid', d.closed_at is not null,
                  'collect_kind', d.collect_kind, 'paid_date', c.work_date, 'paid_shift', c.shift) order by d.id)
                from public.shift_debts d left join public.shift_reports c on c.id = d.closed_report_id
               where d.report_id = r.id or d.gap_report = r.id), '[]'),
      'thu', coalesce((select jsonb_agg(jsonb_build_object('name', d.table_name, 'amount', d.amount, 'kind', d.kind, 'collect_kind', d.collect_kind,
                  'from_date', coalesce(o.work_date, left(d.created_at, 10)), 'from_shift', o.shift) order by d.id)
                from public.shift_debts d left join public.shift_reports o on o.id = d.report_id
               where d.closed_report_id = r.id), '[]')))
    from public.shift_reports r
   where r.branch_id = p_branch and r.work_date between p_from and p_to
     and (exists (select 1 from public.shift_debts d where d.report_id = r.id or d.gap_report = r.id or d.closed_report_id = r.id))), '[]');
end $$;

revoke execute on function public.app_ca_debt_week(bigint, text, text) from public, anon;
grant execute on function public.app_ca_debt_week(bigint, text, text) to authenticated;

insert into public.app_migrations(file) values ('79_no_tren_bang_ca.sql') on conflict (file) do nothing;
