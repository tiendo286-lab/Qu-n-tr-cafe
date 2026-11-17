-- BƯỚC 130 (tệp 114): Thu chi / Lệch tiền / Chốt tháng từng cơ sở chạy nhanh — KHÔNG đổi công thức.
-- Đo máy chủ thật 17/11 (vai Chủ, cơ sở 1, tháng 11): app_tc_summary ~1,0s (app__ca_money 456 lần / 51 ca),
-- app_gap_list ~1,4s (app__ca_money 695 lần), app_fin_month ~0,8s (app__kt_bank_json 620 lần).
-- Nguyên nhân: máy chủ làm phẳng truy vấn con / CTE và chép biểu thức gọi hàm ra mọi chỗ dùng.
-- Cách sửa: "offset 0" / "as materialized" để mỗi ca chỉ tính 1 lần. Kiểm chứng: kiem_tra/toc_do/t02_thu_chi_lech_tien.sql.

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
            from public.shift_reports r cross join lateral (select public.app__ca_money(r.id) m offset 0) z   -- bước 130: offset 0 = tính 1 lần / ca
           where r.branch_id = p_branch and r.status = 'hoan_thanh' and r.work_date between p_from and p_to offset 0) x;

  select coalesce(jsonb_object_agg(k, s), '{}') into prev from (
    select coalesce(x ->> 'category_id', '0') k, sum((x ->> 'amount')::bigint) s
      from jsonb_array_elements(public.app_tc_list(p_branch, pf, pt) -> 'rows') x
     where x ->> 'kind' = 'chi' and x ->> 'src' <> 'ka' and coalesce((x ->> 'excluded')::boolean, false) = false and x ->> 'loan_id' is null
     group by 1) y;

  return jsonb_build_object('debts', debts, 'loans_left', loans, 'ca', ca, 'prev_chi', prev, 'prev_from', pf);
end $function$;

CREATE OR REPLACE FUNCTION public.app__gap_rows(p_branch bigint, p_from text, p_to text)
 RETURNS TABLE(report_id bigint, work_date text, shift text, item text, lech bigint, kind text, total bigint, tl bigint, dcs bigint, mt bigint, mp bigint, remain bigint, state text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with r as materialized (   -- bước 130: tính tiền mỗi ca 1 lần
    select x.id, x.work_date, x.shift, public.app__ca_money(x.id) m
      from public.shift_reports x
     where x.branch_id = p_branch and x.status = 'hoan_thanh' and x.work_date between p_from and p_to),
  v as (
    select r.id, r.work_date, r.shift, it.item,
           case it.item when 'tien_mat' then coalesce((r.m ->> 'tm_left')::bigint, 0) else coalesce((r.m ->> 'ck_left')::bigint, 0) end lech
      from r cross join (values ('tien_mat'), ('chuyen_khoan')) it(item)),
  w as (
    select v.id, v.work_date, v.shift, v.item, v.lech, case when v.lech < 0 then 'thieu' else 'du' end kind, abs(v.lech) total,
           case when v.lech < 0 then coalesce((select sum(s.amount) from public.shift_shortfalls s where s.report_id = v.id and s.item = v.item and s.status <> 'huy'), 0) else 0 end tl,
           coalesce((select sum(g.amount) from public.gap_decisions g where g.report_id = v.id and g.item = v.item), 0)
             + case when v.lech < 0 then coalesce((select sum(d.amount) from public.shift_debts d where d.gap_report = v.id and d.gap_item = v.item and d.closed_at is not null), 0) else 0 end dcs,
           case when v.lech < 0 then coalesce((select sum(d.amount) from public.shift_debts d where d.gap_report = v.id and d.gap_item = v.item and d.closed_at is null), 0) else 0 end np,
           coalesce((select sum(mm.amount) from public.gap_matches mm where mm.item = v.item and mm.status = 'da_duyet'
                       and ((v.lech < 0 and mm.short_report = v.id) or (v.lech > 0 and mm.over_report = v.id))), 0) mt,
           coalesce((select sum(mm.amount) from public.gap_matches mm where mm.item = v.item and mm.status = 'cho_duyet'
                       and ((v.lech < 0 and mm.short_report = v.id) or (v.lech > 0 and mm.over_report = v.id))), 0) mp
      from v where abs(v.lech) > 5000)
  select w.id, w.work_date, w.shift, w.item, w.lech, w.kind, w.total, w.tl, w.dcs, w.mt, w.mp,
         greatest(w.total - w.tl - w.dcs - w.mt, 0),
         case when greatest(w.total - w.tl - w.dcs - w.mt, 0) <= 5000 then 'xong' when w.kind = 'du' then 'du'
              when w.np > 0 and greatest(w.total - w.tl - w.dcs - w.mt, 0) - w.np <= 5000 then 'cho_no'
              when w.item = 'chuyen_khoan' then 'cho_tien' else 'cho_gan' end
    from w
$function$;

CREATE OR REPLACE FUNCTION public.app__fin_calc(p_branch bigint, p_month text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b public.branches; d0 date; d1 date; today text := to_char(public.vn_now(), 'YYYY-MM-DD'); upto date;
        rev jsonb; days jsonb; moves jsonb; entries jsonb; bank jsonb; ka jsonb; n_chain int; expect_shifts int;
        chi_auto bigint; thu_auto bigint; chi_tay bigint; thu_tay bigint; by_cat jsonb; c public.fin_month_closes;
begin
  select * into b from public.branches where id = p_branch;
  if b.id is null then raise exception 'Không tìm thấy cơ sở.'; end if;
  d0 := (p_month || '-01')::date; d1 := (d0 + interval '1 month' - interval '1 day')::date;
  upto := least(d1, today::date);
  select count(*) into n_chain from public.branch_shifts bs join public.shifts s on s.id = bs.shift_id
   where bs.branch_id = p_branch and bs.enabled = 1 and s.status = 'Đang sử dụng' and public.app__ca_chain(s.name);
  expect_shifts := case when upto < d0 then 0 else n_chain * ((upto - d0) + 1) end;

  -- doanh thu theo phiếu ca (số chính thức)
  with r as (
    select x.*, public.app__ca_eff(x.id) as e from public.shift_reports x
     where x.branch_id = p_branch and x.work_date between d0::text and d1::text
  )
  select jsonb_build_object(
    'reports', count(*), 'done', count(*) filter (where status = 'hoan_thanh'),
    'recon', count(*) filter (where recon_status = 'hoan_thanh'), 'in_progress', count(*) filter (where status = 'dang_chot'),
    'expect', expect_shifts,
    'total_revenue', coalesce(sum((e ->> 'total_revenue')::bigint) filter (where status = 'hoan_thanh'), 0),
    'pos_cash', coalesce(sum((e ->> 'pos_cash')::bigint) filter (where status = 'hoan_thanh'), 0),
    'pos_transfer', coalesce(sum((e ->> 'pos_transfer')::bigint) filter (where status = 'hoan_thanh'), 0),
    'cups', coalesce(sum((e ->> 'cups')::int) filter (where status = 'hoan_thanh'), 0),
    'debt_new', coalesce((select sum(dd.amount) from public.shift_debts dd join r rr on rr.id = dd.report_id where rr.status = 'hoan_thanh' and dd.kind <> 'muon'), 0),
    'debt_col_tm', coalesce((select sum(dd.amount) from public.shift_debts dd join r rr on rr.id = dd.closed_report_id
                              where rr.status = 'hoan_thanh' and dd.collect_kind = 'tien_mat'), 0),
    'debt_col_ck', coalesce((select sum(dd.amount) from public.shift_debts dd join r rr on rr.id = dd.closed_report_id
                              where rr.status = 'hoan_thanh' and dd.collect_kind = 'chuyen_khoan'), 0))
    into rev from r;

  -- tiền mặt theo ngày (giống Đối soát cuối ngày)
  select coalesce(jsonb_agg(z.j order by z.dd), '[]') into days from (
    select g.dd, jsonb_build_object('date', g.dd, 'done', q.done, 'opening', q.opening, 'pos_cash', q.pos_cash, 'moves_cash', q.moves_cash,
             'debt_cash', q.debt_cash, 'rut_giao_ca', public.app__ca_rut_day(p_branch, g.dd), 'counted', c2.counted, 'counted_by', public.app__acc_name(c2.done_by),
             'expected', case when q.opening is not null and q.pos_cash is not null then q.opening + q.pos_cash + q.moves_cash + q.debt_cash - public.app__ca_rut_day(p_branch, g.dd) end) as j
      from (select to_char(x, 'YYYY-MM-DD') as dd from generate_series(d0, d1, interval '1 day') x) g
      cross join lateral (
        select count(*) filter (where r.status = 'hoan_thanh') as done,
               (select (public.app__ca_eff(r2.id) ->> 'opening_cash')::bigint from public.shift_reports r2
                 where r2.branch_id = p_branch and r2.work_date = g.dd order by array_position(public.app__shifts(), r2.shift) limit 1) as opening,
               sum((public.app__ca_eff(r.id) ->> 'pos_cash')::bigint) filter (where r.status = 'hoan_thanh') as pos_cash,
               coalesce((select sum((m ->> 'amount')::bigint) from public.shift_reports r3
                          cross join lateral jsonb_array_elements(public.app__ca_eff(r3.id) -> 'moves') m
                          where r3.branch_id = p_branch and r3.work_date = g.dd and r3.status = 'hoan_thanh' and m ->> 'kind' = 'tien_mat'), 0) as moves_cash,
               coalesce((select sum(dd.amount) from public.shift_debts dd join public.shift_reports r4 on r4.id = dd.closed_report_id
                          where r4.branch_id = p_branch and r4.work_date = g.dd and r4.status = 'hoan_thanh' and dd.collect_kind = 'tien_mat'), 0) as debt_cash
          from public.shift_reports r where r.branch_id = p_branch and r.work_date = g.dd) q
      left join public.daily_cash_closings c2 on c2.branch_id = p_branch and c2.work_date = g.dd
     where q.done > 0 or c2.counted is not null
  ) z;

  -- chuyển khoản thực nhận (kế toán) — chỉ các ca đã nhập đủ tài khoản
  select jsonb_build_object('pos_transfer', coalesce(sum(pt), 0), 'received', coalesce(sum(rc) filter (where ok), 0),
           'pos_transfer_ok', coalesce(sum(pt) filter (where ok), 0), 'shifts_ok', count(*) filter (where ok), 'shifts', count(*))
    into bank from (
      select (public.app__ca_eff(x.id) ->> 'pos_transfer')::bigint as pt, (k ->> 'received')::bigint as rc,
             coalesce((k ->> 'account_count')::int, 0) > 0 and (k ->> 'entered')::int = (k ->> 'account_count')::int as ok
        from public.shift_reports x cross join lateral (select public.app__kt_bank_json(x) as k offset 0) kk   -- bước 130: tính 1 lần / ca
       where x.branch_id = p_branch and x.work_date between d0::text and d1::text and x.status = 'hoan_thanh' offset 0) y;

  -- khoản thu chi ghi ở phiếu ca + phân nhóm
  select coalesce(jsonb_agg(jsonb_build_object('report_id', m.rid, 'date', m.work_date, 'shift', m.shift, 'kind', m.kind, 'amount', m.amount, 'note', m.note,
           'mkey', m.mkey, 'category_id', fc.category_id, 'excluded', coalesce(fc.excluded, case when m.amount > 0 then 1 else 0 end) = 1,
           'set', fc.report_id is not null) order by m.work_date, array_position(public.app__shifts(), m.shift), m.ord), '[]')
    into moves from (
      select x.id as rid, x.work_date, x.shift, t.ord, t.v ->> 'kind' as kind, (t.v ->> 'amount')::bigint as amount, coalesce(t.v ->> 'note', '') as note,
             md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) || '#'
               || row_number() over (partition by x.id, md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) order by t.ord) as mkey
        from public.shift_reports x
        cross join lateral jsonb_array_elements(public.app__ca_eff(x.id) -> 'moves') with ordinality t(v, ord)
       where x.branch_id = p_branch and x.work_date between d0::text and d1::text and x.status = 'hoan_thanh') m
    left join public.fin_move_cats fc on fc.report_id = m.rid and fc.mkey = m.mkey;

  select coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object('category', c3.name, 'by', public.app__acc_name(e.created_by)) order by e.entry_date, e.id), '[]')
    into entries from public.fin_entries e left join public.fin_categories c3 on c3.id = e.category_id
   where e.branch_id = p_branch and e.entry_date between d0::text and d1::text;

  -- khoản âm của tháng
  select jsonb_build_object('total', coalesce(sum(s.amount), 0),
           'chua_xu_ly', coalesce(sum(s.amount) filter (where s.status = 'chua_xu_ly'), 0),
           'da_bu', coalesce(sum(s.amount) filter (where s.status = 'da_bu'), 0),
           'tru_luong', coalesce(sum(s.amount) filter (where s.status = 'tru_luong'), 0),
           'mien', coalesce(sum(s.amount) filter (where s.status = 'mien'), 0), 'count', count(*))
    into ka from public.shift_shortfalls s join public.shift_reports x on x.id = s.report_id
   where x.branch_id = p_branch and x.work_date between d0::text and d1::text and s.status <> 'huy';

  -- tổng chi / thu: khoản ở phiếu ca (âm = chi, dương = thu; "Không tính" bỏ qua) + nhập tay
  select coalesce(sum(-(m ->> 'amount')::bigint) filter (where (m ->> 'amount')::bigint < 0 and not (m ->> 'excluded')::boolean), 0),
         coalesce(sum((m ->> 'amount')::bigint) filter (where (m ->> 'amount')::bigint > 0 and not (m ->> 'excluded')::boolean), 0)
    into chi_auto, thu_auto from jsonb_array_elements(moves) m;
  select coalesce(sum(amount) filter (where kind = 'chi'), 0), coalesce(sum(amount) filter (where kind = 'thu'), 0)
    into chi_tay, thu_tay from public.fin_entries where branch_id = p_branch and entry_date between d0::text and d1::text;
  select coalesce(jsonb_agg(jsonb_build_object('kind', y.kind, 'category_id', y.cid, 'name', coalesce(fc.name, 'Chưa phân nhóm'), 'amount', y.amt)
           order by y.kind, coalesce(fc.sort_order, 1000), fc.name), '[]')
    into by_cat from (
      select kind, cid, sum(amt) as amt from (
        select case when (m ->> 'amount')::bigint < 0 then 'chi' else 'thu' end as kind, (m ->> 'category_id')::bigint as cid, abs((m ->> 'amount')::bigint) as amt
          from jsonb_array_elements(moves) m where not (m ->> 'excluded')::boolean
        union all
        select kind, category_id, amount from public.fin_entries where branch_id = p_branch and entry_date between d0::text and d1::text) u
      group by kind, cid) y
    left join public.fin_categories fc on fc.id = y.cid;

  select * into c from public.fin_month_closes where branch_id = p_branch and month = p_month;
  return jsonb_build_object('branch_id', b.id, 'branch_code', coalesce(b.display_code, b.code), 'branch_name', b.name, 'month', p_month,
    'from', d0, 'to', d1, 'revenue', rev, 'days', days, 'bank', bank, 'moves', moves, 'entries', entries, 'shortfalls', ka, 'by_cat', by_cat,
    'cash', jsonb_build_object(
       'pos_cash', (rev ->> 'pos_cash')::bigint, 'debt_cash', (rev ->> 'debt_col_tm')::bigint,
       'moves_cash', coalesce((select sum((x ->> 'moves_cash')::bigint) from jsonb_array_elements(days) x), 0),
       'gap', coalesce((select sum((x ->> 'counted')::bigint - (x ->> 'expected')::bigint) from jsonb_array_elements(days) x
                         where x ->> 'counted' is not null and x ->> 'expected' is not null), 0),
       'days_counted', (select count(*) from jsonb_array_elements(days) x where x ->> 'counted' is not null),
       'days_open', (select count(*) from jsonb_array_elements(days) x where (x ->> 'done')::int > 0)),
    'totals', jsonb_build_object('revenue', (rev ->> 'total_revenue')::bigint, 'chi_ca', chi_auto, 'thu_ca', thu_auto, 'chi_tay', chi_tay, 'thu_tay', thu_tay,
       'chi', chi_auto + chi_tay, 'thu', thu_auto + thu_tay,
       'profit', (rev ->> 'total_revenue')::bigint + thu_auto + thu_tay - chi_auto - chi_tay,
       'uncat', (select count(*) from jsonb_array_elements(moves) m where not (m ->> 'excluded')::boolean and m ->> 'category_id' is null)),
    'closed', case when c.branch_id is null then null else jsonb_build_object('by', public.app__acc_name(c.closed_by), 'at', c.closed_at, 'note', c.note) end);
end $function$;

insert into public.app_migrations(file) values ('114_toc_do_thu_chi_lech_tien.sql') on conflict (file) do nothing;
