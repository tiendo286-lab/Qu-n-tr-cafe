-- BƯỚC 128 (tệp 112): Sổ quỹ + Chốt tháng chạy nhanh — KHÔNG đổi kết quả tiền.
-- Trước (máy chủ thật, 17/11, tháng 11): Chốt tháng ~30s, Sổ quỹ ~1,6s, Sổ quỹ từng cơ sở ~0,6s / cơ sở.
-- Nguyên nhân: app_fin_overview gọi app__fin_full 6 lần / cơ sở; mỗi lần dựng sổ quỹ (app__fund_rows) 3–5 lượt từ ngày bắt đầu quỹ.
-- Cách sửa: app__fund_sum dựng 1 lượt và trả mọi tổng; app__fund_rows / app__fund_balance / app__fin_calc giữ nguyên.
-- Kiểm chứng: kiem_tra/toc_do/t01_so_quy_giong_het.sql (so cũ / mới tháng 10–12, mọi cơ sở).

create or replace function public.app__fund_sum(p_branch bigint, p_upto text, p_d0 text, p_d1 text)
 returns table(cash bigint, bank bigint, cash_before bigint, bank_before bigint, bu bigint, dep bigint, bin bigint)
 language sql stable security definer set search_path to 'public'
as $function$
  -- bước 128: dựng sổ quỹ 1 LƯỢT (từ ngày bắt đầu quỹ tới p_upto) rồi lấy mọi tổng cần:
  -- cash / bank = số dư tại p_upto (như app__fund_balance(…, p_upto)); *_before = số dư trước p_d0 (như app__fund_balance(…, p_d0 − 1));
  -- bu / dep / bin = tổng dòng bù khoản âm / nộp quỹ / chuyển khoản về có ngày trong [p_d0, p_d1].
  with r as materialized (select x.d, x.method, x.typ, x.amount from public.app__fund_rows(p_branch, public.app__fund_start(), p_upto) x),
       o as (select coalesce((select amount from public.fund_openings where branch_id = p_branch and method = 'tien_mat'), 0) tm,
                    coalesce((select amount from public.fund_openings where branch_id = p_branch and method = 'chuyen_khoan'), 0) ck)
  select (o.tm + coalesce((select sum(amount) from r where method = 'tien_mat'), 0))::bigint,
         (o.ck + coalesce((select sum(amount) from r where method = 'chuyen_khoan'), 0))::bigint,
         (o.tm + coalesce((select sum(amount) from r where method = 'tien_mat' and d < p_d0), 0))::bigint,
         (o.ck + coalesce((select sum(amount) from r where method = 'chuyen_khoan' and d < p_d0), 0))::bigint,
         coalesce((select sum(amount) from r where typ = 'bu_khoan_am' and d between p_d0 and p_d1), 0)::bigint,
         coalesce((select sum(amount) from r where typ = 'nop_quy' and d between p_d0 and p_d1), 0)::bigint,
         coalesce((select sum(amount) from r where typ = 'ck_ve' and d between p_d0 and p_d1), 0)::bigint
    from o
$function$;
revoke all on function public.app__fund_sum(bigint, text, text, text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.app__fin_full(p_branch bigint, p_month text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare j jsonb; d0 text; d1 text; st text := public.app__fund_start(); ext jsonb; ext_chi bigint; ext_thu bigint; t jsonb; bycat jsonb;
        rv jsonb; mv_excl bigint; mv_tm bigint; mv_ck bigint; ka bigint; bu bigint; dep bigint; bin bigint; op bigint; cl bigint; wd bigint; wd_tm bigint; wd_ck bigint;
        profit bigint; must bigint; fs record; cash_diff bigint; bank_diff bigint; active boolean; kho jsonb; kho_tot bigint; kho_cat bigint;
begin
  j := public.app__fin_calc(p_branch, p_month);
  d0 := p_month || '-01'; d1 := to_char((d0::date + interval '1 month' - interval '1 day'), 'YYYY-MM-DD');
  select coalesce(jsonb_agg(jsonb_build_object('entry_id', e.id, 'date', e.entry_date, 'kind', e.kind, 'category_id', e.category_id, 'category', c.name,
           'note', e.note, 'total', e.amount, 'amount', a.amount, 'mode', e.alloc_mode) order by e.entry_date, e.id), '[]'),
         coalesce(sum(a.amount) filter (where e.kind = 'chi'), 0), coalesce(sum(a.amount) filter (where e.kind = 'thu'), 0)
    into ext, ext_chi, ext_thu
    from public.ext_entries e cross join lateral public.app__ext_alloc(e.id) a left join public.fin_categories c on c.id = e.category_id
   where e.entry_date between d0 and d1 and a.branch_id = p_branch and a.amount <> 0;
  -- hàng kho tổng (hóa đơn trong tháng)
  select id into kho_cat from public.fin_categories where kind = 'chi' and lower(name) = lower('Nguyên liệu (kho tổng)') limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'doc_no', i.doc_no, 'date', i.work_date, 'total', coalesce(i.total, 0), 'state', i.state) order by i.work_date, i.id), '[]'),
         coalesce(sum(i.total), 0)
    into kho, kho_tot from public.delivery_invoices i where i.branch_id = p_branch and i.doc_no is not null and i.work_date between d0 and d1;
  t := j -> 'totals';
  profit := (t ->> 'profit')::bigint - ext_chi + ext_thu - kho_tot;
  t := t || jsonb_build_object('chi_ngoai', ext_chi, 'thu_ngoai', ext_thu, 'chi_kho', kho_tot,
    'chi', (t ->> 'chi')::bigint + ext_chi + kho_tot, 'thu', (t ->> 'thu')::bigint + ext_thu, 'profit', profit);
  select coalesce(jsonb_agg(jsonb_build_object('kind', y.kind, 'category_id', y.cid, 'name', coalesce(fc.name, 'Chưa phân nhóm'), 'amount', y.amt)
           order by y.kind, coalesce(fc.sort_order, 1000), fc.name), '[]')
    into bycat from (
      select kind, cid, sum(amt) amt from (
        select x ->> 'kind' kind, (x ->> 'category_id')::bigint cid, (x ->> 'amount')::bigint amt from jsonb_array_elements(j -> 'by_cat') x
        union all
        select x ->> 'kind', (x ->> 'category_id')::bigint, (x ->> 'amount')::bigint from jsonb_array_elements(ext) x
        union all
        select 'chi', kho_cat, kho_tot where kho_tot <> 0) u
      group by kind, cid) y left join public.fin_categories fc on fc.id = y.cid;

  active := d1 >= st;
  rv := j -> 'revenue';
  select coalesce(sum((m ->> 'amount')::bigint) filter (where (m ->> 'excluded')::boolean), 0),
         coalesce(sum((m ->> 'amount')::bigint) filter (where m ->> 'kind' = 'tien_mat'), 0),
         coalesce(sum((m ->> 'amount')::bigint) filter (where m ->> 'kind' = 'chuyen_khoan'), 0)
    into mv_excl, mv_tm, mv_ck from jsonb_array_elements(j -> 'moves') m;
  ka := coalesce((j -> 'shortfalls' ->> 'total')::bigint, 0);
  -- bước 128: dựng sổ quỹ 1 lượt (trước: 3–5 lượt, mỗi lượt từ ngày bắt đầu quỹ)
  select * into fs from public.app__fund_sum(p_branch, d1, d0, d1);
  bu := fs.bu; dep := fs.dep; bin := fs.bin;
  if d0 <= st then
    op := coalesce((select sum(amount) from public.fund_openings where branch_id = p_branch), 0);
  else
    op := fs.cash_before + fs.bank_before;
  end if;
  cl := fs.cash + fs.bank;
  select coalesce(sum(amount), 0), coalesce(sum(amount) filter (where method = 'tien_mat'), 0), coalesce(sum(amount) filter (where method = 'chuyen_khoan'), 0)
    into wd, wd_tm, wd_ck from public.fund_withdrawals where branch_id = p_branch and wdate between d0 and d1;
  must := profit - (rv ->> 'debt_new')::bigint + (rv ->> 'debt_col_tm')::bigint + (rv ->> 'debt_col_ck')::bigint + ext_chi - ext_thu + kho_tot + mv_excl - ka + bu + op;
  cash_diff := dep - ((rv ->> 'pos_cash')::bigint + mv_tm + (rv ->> 'debt_col_tm')::bigint) + ka;
  bank_diff := bin - ((rv ->> 'pos_transfer')::bigint + mv_ck + (rv ->> 'debt_col_ck')::bigint);

  return j || jsonb_build_object('totals', t, 'by_cat', bycat, 'ext', ext, 'kho', kho,
    'recon', jsonb_build_object('active', active, 'profit', profit, 'debt_new', (rv ->> 'debt_new')::bigint,
       'debt_col', (rv ->> 'debt_col_tm')::bigint + (rv ->> 'debt_col_ck')::bigint, 'ext_cost', ext_chi - ext_thu, 'kho_cost', kho_tot, 'moves_excluded', mv_excl,
       'shortfalls', ka, 'bu', bu, 'opening', op, 'must', must, 'withdrawn', wd, 'withdrawn_tm', wd_tm, 'withdrawn_ck', wd_ck,
       'gap', wd - must, 'closing', cl, 'cash_diff', cash_diff, 'bank_diff', bank_diff, 'deposits', dep, 'bank_in', bin));
end $function$;

create or replace function public.app_fin_overview(p_month text)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare j jsonb := '[]'::jsonb; b record; x jsonb;
begin
  perform public.app__fin_month_ok(p_month);
  -- bước 128: vòng lặp → app__fin_full đúng 1 lần mỗi cơ sở (bản cũ "cross join lateral (select app__fin_full(…) as j)" bị gọi 6 lần / cơ sở)
  for b in select br.id, coalesce(br.display_code, br.code) code, br.name from public.branches br
            where br.status = 'Đang hoạt động' and public.app__fin_can(br.id) order by br.sort_order loop
    x := public.app__fin_full(b.id, p_month);
    j := j || jsonb_build_array(jsonb_build_object('branch_id', b.id, 'code', b.code, 'name', b.name,
           'revenue', x -> 'revenue', 'totals', x -> 'totals', 'cash', x -> 'cash', 'shortfalls', x -> 'shortfalls', 'closed', x -> 'closed', 'recon', x -> 'recon'));
  end loop;
  return j;
end $function$;

CREATE OR REPLACE FUNCTION public.app_fund_overview(p_month text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d0 text; d1 text; upto text; lim bigint := coalesce(public.app__fund_set('fund_cash_alert')::bigint, 20000000);
begin
  perform public.app__fin_month_ok(p_month);
  d0 := p_month || '-01'; d1 := to_char((d0::date + interval '1 month' - interval '1 day'), 'YYYY-MM-DD');
  upto := least(d1, to_char(public.vn_now(), 'YYYY-MM-DD'));
  return jsonb_build_object('month', p_month, 'start', public.app__fund_start(), 'alert', lim, 'branches',
    coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code), 'name', b.name,
        'cash', fs.cash, 'bank', fs.bank,   -- bước 128: 1 lượt sổ quỹ
        'bank_actual', public.app__fund_bank_actual(b.id, upto),
        'out_cash', (select coalesce(sum(amount), 0) from public.fund_withdrawals w where w.branch_id = b.id and w.method = 'tien_mat' and w.wdate between d0 and d1),
        'out_bank', (select coalesce(sum(amount), 0) from public.fund_withdrawals w where w.branch_id = b.id and w.method = 'chuyen_khoan' and w.wdate between d0 and d1),
        'pending', (select count(*) from public.fund_withdrawals w where w.branch_id = b.id and w.status = 'cho_nhan'),
        'closed', exists (select 1 from public.fin_month_closes c where c.branch_id = b.id and c.month = p_month)) order by b.sort_order)
       from public.branches b cross join lateral public.app__fund_sum(b.id, upto, upto, upto) fs
       where b.status = 'Đang hoạt động' and public.app__tc_can(b.id)), '[]'),
    'owner', coalesce((public.app_account()).system_role, '') = 'chu');
end $function$;

CREATE OR REPLACE FUNCTION public.app_fund_branch(p_branch bigint, p_month text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d0 text; d1 text; upto text; st text := public.app__fund_start(); b public.branches; fl bigint := coalesce(public.app__fund_set('fund_cash_float')::bigint, 1000000);
        open_tm bigint; open_ck bigint; rows jsonb; days jsonb; allr jsonb; bal_tm bigint; bal_ck bigint;
begin
  perform public.app__tc_need(p_branch);
  perform public.app__fin_month_ok(p_month);
  select * into b from public.branches where id = p_branch;
  d0 := p_month || '-01'; d1 := to_char((d0::date + interval '1 month' - interval '1 day'), 'YYYY-MM-DD');
  upto := least(d1, to_char(public.vn_now(), 'YYYY-MM-DD'));
  -- bước 128: dựng sổ quỹ 1 lượt từ ngày bắt đầu quỹ tới cuối tháng (trước: 5 lượt)
  select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object('ord', r.ord) order by r.ord), '[]') into allr
    from public.app__fund_rows(p_branch, st, d1) with ordinality r(d, method, typ, label, amount, auto, ref, ord);
  open_tm := coalesce((select amount from public.fund_openings where branch_id = p_branch and method = 'tien_mat'), 0)
           + coalesce((select sum((e ->> 'amount')::bigint) from jsonb_array_elements(allr) e where e ->> 'method' = 'tien_mat' and e ->> 'd' < d0), 0);
  open_ck := coalesce((select amount from public.fund_openings where branch_id = p_branch and method = 'chuyen_khoan'), 0)
           + coalesce((select sum((e ->> 'amount')::bigint) from jsonb_array_elements(allr) e where e ->> 'method' = 'chuyen_khoan' and e ->> 'd' < d0), 0);
  bal_tm := coalesce((select amount from public.fund_openings where branch_id = p_branch and method = 'tien_mat'), 0)
          + coalesce((select sum((e ->> 'amount')::bigint) from jsonb_array_elements(allr) e where e ->> 'method' = 'tien_mat' and e ->> 'd' <= upto), 0);
  bal_ck := coalesce((select amount from public.fund_openings where branch_id = p_branch and method = 'chuyen_khoan'), 0)
          + coalesce((select sum((e ->> 'amount')::bigint) from jsonb_array_elements(allr) e where e ->> 'method' = 'chuyen_khoan' and e ->> 'd' <= upto), 0);
  if d0 <= st then   -- tháng bắt đầu sổ: số dư đầu là số quản lý nhập
    open_tm := coalesce((select amount from public.fund_openings where branch_id = p_branch and method = 'tien_mat'), 0);
    open_ck := coalesce((select amount from public.fund_openings where branch_id = p_branch and method = 'chuyen_khoan'), 0);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('date', e ->> 'd', 'method', e ->> 'method', 'type', e ->> 'typ', 'label', e ->> 'label',
             'amount', (e ->> 'amount')::bigint, 'auto', (e ->> 'auto')::boolean, 'ref', e -> 'ref')
           order by e ->> 'd', case e ->> 'typ' when 'nop_quy' then 1 when 'ck_ve' then 1 when 'bu_khoan_am' then 2 when 'thu_chi' then 3 else 4 end, (e ->> 'ord')::bigint), '[]')
    into rows from jsonb_array_elements(allr) e where e ->> 'd' between d0 and d1;
  -- bảng theo ngày (để quản lý nhập bổ sung)
  select coalesce(jsonb_agg(jsonb_build_object('date', g.dd, 'counted', lc.counted, 'counted_src', lc.src,
           'cash_auto', case when lc.counted is not null then lc.counted - fl end, 'cash_set', v.cash_amount, 'cash_note', v.cash_note,
           'bank_auto', public.app__fund_bank_auto(p_branch, g.dd), 'bank_set', v.bank_amount, 'bank_note', v.bank_note,
           'reports', (select count(*) from public.shift_reports x where x.branch_id = p_branch and x.work_date = g.dd and x.status = 'hoan_thanh'))
           order by g.dd), '[]')
    into days
    from (select to_char(x, 'YYYY-MM-DD') dd from generate_series(greatest(d0, st)::date, upto::date, interval '1 day') x) g
    left join lateral (select x.counted, x.src from public.app__fund_last_count(p_branch, g.dd) x) lc on true
    left join public.fund_day_values v on v.branch_id = p_branch and v.work_date = g.dd;
  return jsonb_build_object('branch_id', b.id, 'code', coalesce(b.display_code, b.code), 'name', b.name, 'month', p_month,
    'from', d0, 'to', d1, 'upto', upto, 'start', st, 'float', fl, 'alert', coalesce(public.app__fund_set('fund_cash_alert')::bigint, 20000000),
    'is_start_month', left(st, 7) = p_month,
    'openings', jsonb_build_object('tien_mat', (select to_jsonb(o) from public.fund_openings o where o.branch_id = p_branch and o.method = 'tien_mat'),
                                   'chuyen_khoan', (select to_jsonb(o) from public.fund_openings o where o.branch_id = p_branch and o.method = 'chuyen_khoan')),
    'open', jsonb_build_object('tien_mat', open_tm, 'chuyen_khoan', open_ck),
    'balance', jsonb_build_object('tien_mat', bal_tm, 'chuyen_khoan', bal_ck),
    'bank_actual', public.app__fund_bank_actual(p_branch, upto),
    'rows', rows, 'days', days,
    'withdrawals', coalesce((select jsonb_agg(to_jsonb(w) || jsonb_build_object('by', public.app__acc_name(w.created_by), 'received_name', public.app__acc_name(w.received_by),
                       'locked', w.status = 'da_nhan' or public.app__fin_locked(w.branch_id, w.wdate)) order by w.wdate desc, w.id desc)
                     from public.fund_withdrawals w where w.branch_id = p_branch and (w.wdate between d0 and d1 or w.status = 'cho_nhan')), '[]'),
    'counts', coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object('by', public.app__acc_name(c.created_by), 'adj', (select jsonb_build_object('id', e.id, 'kind', e.kind, 'amount', e.amount, 'category', fc.name)
                                  from public.fin_entries e left join public.fin_categories fc on fc.id = e.category_id where e.id = c.adj_entry_id)) order by c.count_date desc, c.id desc)
                 from public.fund_counts c where c.branch_id = p_branch and c.count_date between d0 and d1), '[]'),
    'locked', public.app__fin_locked(p_branch, d0),
    'transfers', coalesce((select jsonb_agg(to_jsonb(t) || jsonb_build_object('by', public.app__acc_name(t.created_by), 'locked', public.app__fin_locked(t.branch_id, t.tdate)) order by t.tdate desc, t.id desc)
                 from public.fund_transfers t where t.branch_id = p_branch and t.tdate between d0 and d1), '[]'),
    'last_count', jsonb_build_object('tien_mat', (select max(count_date) from public.fund_counts where branch_id = p_branch and method = 'tien_mat'),
                                     'chuyen_khoan', (select max(count_date) from public.fund_counts where branch_id = p_branch and method = 'chuyen_khoan')),
    'can_move', public.app__fund_mover(p_branch),
    'owner', coalesce((public.app_account()).system_role, '') = 'chu');
end $function$;


insert into public.app_migrations(file) values ('112_toc_do_so_quy.sql') on conflict (file) do nothing;
