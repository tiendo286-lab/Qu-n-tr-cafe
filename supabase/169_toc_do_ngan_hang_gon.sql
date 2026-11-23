-- Tăng tốc (23/11/2026, anh Tiến báo web lag): "số chuyển khoản ngân hàng nhận của ca" lấy theo BẢN GỌN.
-- Vì sao: app__kt_bank_json dựng cả bảng chi tiết tài khoản của ca (tên người nhập, số dư kỳ trước của từng tài khoản,
-- khoản về muộn) — phần đó chỉ màn hình kế toán nhập ngân hàng cần. Còn app__ca_money (tiền lệch của ca), app__fund_bank_auto
-- (Sổ quỹ) và app__fin_calc (Chốt tháng) chỉ dùng 3 số: received / entered / account_count. Đo 23/11: Sổ thu chi tháng gọi
-- app__kt_bank_json 5 lần cho mỗi ca, chiếm 58% thời gian của trang.
-- Sửa: thêm app__kt_bank_sum — CÙNG câu hỏi dữ liệu với app__kt_bank_json (cùng FROM / WHERE / công thức), chỉ bỏ phần chi tiết;
-- 3 hàm trên đổi sang gọi bản gọn. app__kt_bank_json giữ nguyên cho màn hình kế toán và app_stc_month (vùng khoá, không đụng).
-- Không đổi kết quả (chạy thử so cũ / mới toàn bộ phiếu ca: giống hệt), không đổi quyền, không sửa dữ liệu. Chạy lại nhiều lần không sao.
-- Nếu sau này sửa cách tính "received" trong app__kt_bank_json thì phải sửa cả app__kt_bank_sum cho giống.

CREATE OR REPLACE FUNCTION public.app__kt_bank_sum(r shift_reports)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare tot bigint; n_in int; n_all int;
begin
  -- giữ y nguyên FROM / WHERE / công thức của app__kt_bank_json (tệp 100)
  select sum(case when x.opening is not null and x.closing is not null then x.closing - x.opening + coalesce(x.transfers_out, 0) + coalesce(li.s, 0) - coalesce(lo.s, 0) end),
         count(*) filter (where x.opening is not null and x.closing is not null), count(*)
    into tot, n_in, n_all
    from public.bank_accounts k
    left join public.bank_account_balances x on x.report_id = r.id and x.account_id = k.id
    left join lateral (select sum(l.amount) s from public.bank_late_receipts l where l.origin_report_id = r.id and l.account_id = k.id) li on true
    left join lateral (select sum(l.amount) s from public.bank_late_receipts l where l.arrived_report_id = r.id and l.account_id = k.id) lo on true
   where k.branch_id = r.branch_id and (k.active = 1 or x.report_id is not null or li.s is not null or lo.s is not null);
  return jsonb_build_object('received', tot, 'entered', n_in, 'account_count', n_all);
end $function$;

revoke all on function public.app__kt_bank_sum(public.shift_reports) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.app__ca_money(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.shift_reports; nx public.shift_reports; d jsonb; b jsonb; tm_mv bigint; ck_mv bigint; debt_new bigint; col_tm bigint; col_ck bigint;
        cc bigint; op bigint; pc bigint; pt bigint; rt bigint; tot bigint; tm_left bigint; ck_nv bigint; ck_bank bigint; bank_ok boolean; ck_new bigint;
        nh jsonb; hg bigint := 0; ns text;
begin
  select * into r from public.shift_reports where id = p_id;
  if r.id is null then return null; end if;
  d := public.app__ca_eff(p_id);
  b := public.app__kt_bank_sum(r);   -- tệp 169: chỉ cần received / entered / account_count
  select coalesce(sum((m ->> 'amount')::bigint) filter (where m ->> 'kind' = 'tien_mat'), 0),
         coalesce(sum((m ->> 'amount')::bigint) filter (where m ->> 'kind' = 'chuyen_khoan'), 0)
    into tm_mv, ck_mv from jsonb_array_elements(coalesce(d -> 'moves', '[]')) m;
  select coalesce(sum(amount), 0) into debt_new from public.shift_debts where report_id = p_id and coalesce(kind, 'bill') = 'bill';
  select coalesce(sum(amount), 0) into ck_new from public.shift_debts where report_id = p_id and kind = 'ck';   -- bước 84: Nợ CK
  select coalesce(sum(amount) filter (where collect_kind = 'tien_mat'), 0), coalesce(sum(amount) filter (where collect_kind = 'chuyen_khoan'), 0)
    into col_tm, col_ck from public.shift_debts where closed_report_id = p_id;
  cc := case when r.cash_mode = 'ca' and r.ql_counted is not null then r.ql_counted + public.app__stc_handover_adj(r.id) else (d ->> 'cash_counted')::bigint end; op := (d ->> 'opening_cash')::bigint; pc := (d ->> 'pos_cash')::bigint;
  pt := (d ->> 'pos_transfer')::bigint; rt := (d ->> 'reported_transfer')::bigint; tot := (d ->> 'total_revenue')::bigint;
  -- ca sau đếm nhận két lệch → khoản lệch tính cho ca này (ca giao)
  ns := public.app__ca_next_shift(r.shift);
  if ns is not null then
    select * into nx from public.shift_reports where branch_id = r.branch_id and work_date = r.work_date and shift = ns;
    if nx.id is not null then nh := public.app__ca_hand(nx.id); hg := coalesce((nh ->> 'gap_eff')::bigint, 0);
      if exists (select 1 from public.stc_open_blame ob where ob.report_id = nx.id and ob.prev_amt is not null) then hg := 0; end if; end if;
  end if;
  tm_left := cc - op - pc - tm_mv - col_tm;
  ck_nv := rt - pt - ck_mv - col_ck + ck_new;
  bank_ok := coalesce((b ->> 'account_count')::int, 0) > 0 and (b ->> 'entered')::int = (b ->> 'account_count')::int;
  ck_bank := case when bank_ok then (b ->> 'received')::bigint - pt - ck_mv - col_ck + ck_new end;
  return jsonb_build_object('sum_gap', tot - pc - pt - debt_new, 'debt_new', debt_new, 'ck_new', ck_new, 'cash_mode', coalesce(r.cash_mode, 'ngay'), 'ql_counted', r.ql_counted, 'nv_counted', (d ->> 'cash_counted')::bigint, 'col_tm', col_tm, 'col_ck', col_ck,
    'tm_moves', tm_mv, 'ck_moves', ck_mv, 'tm_left_self', tm_left, 'handover_gap', hg, 'tm_left', tm_left + hg,
    'next_hand', case when nh is not null and nh ->> 'state' not in ('chua_dem', 'cho_ca_truoc') then jsonb_build_object('shift', ns, 'id', nx.id,
       'state', nh ->> 'state', 'counted', (nh ->> 'counted')::bigint, 'first_count', (nh ->> 'first_count')::bigint, 'gap', (nh ->> 'gap')::bigint,
       'giver', nh ->> 'giver', 'counted_by', nh ->> 'counted_by', 'counted_at', nh ->> 'counted_at', 'recount_at', nh ->> 'recount_at') end,
    'ck_left_nv', ck_nv, 'ck_left_bank', ck_bank,
    'bank_received', (b ->> 'received')::bigint, 'bank_ok', bank_ok,
    'ck_basis', case when bank_ok then 'ke_toan' else 'nhan_vien' end, 'ck_left', coalesce(ck_bank, ck_nv),
    'ck_expected', pt + ck_mv + col_ck - ck_new);   -- bước 119: chuyển khoản PHẢI NHẬN (ô Chuyển khoản ngân hàng ở bước Kiểm tra)
end $function$;

CREATE OR REPLACE FUNCTION public.app__fund_bank_auto(p_branch bigint, p_date text)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select sum((public.app__kt_bank_sum(x) ->> 'received')::bigint)   -- tệp 169: bản gọn
    from public.shift_reports x where x.branch_id = p_branch and x.work_date = p_date and x.status = 'hoan_thanh'
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
        from public.shift_reports x cross join lateral (select public.app__kt_bank_sum(x) as k offset 0) kk   -- bước 130: tính 1 lần / ca; tệp 169: bản gọn
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

insert into public.app_migrations(file) values ('169_toc_do_ngan_hang_gon.sql') on conflict (file) do nothing;
