-- Bước 45 — Số dư đầu ca: web nhận CẢ 2 CÁCH (anh Tiến chốt 12/11/2026)
-- Cách 1: ca chiều / tối mở với đúng tiền ca trước để lại trong két (như cũ).
-- Cách 2: ca chiều / tối mở với 1.000.000 (tiền gối đầu) — phần dư ca trước để lại coi là "Nộp quỹ khi giao ca":
--   không bắt ghi lý do, không tính lệch cho ca nào, tự vào Sổ quỹ tiền mặt (dòng nộp quỹ), và Đối soát tiền mặt cuối ngày trừ ra.
-- Số dư đầu khác cả 2 cách → vẫn báo lệch, bắt ghi lý do (như cũ). Chạy lại nhiều lần không sao.

-- ---------------------------------------------------------------- So tiền đầu ca: thêm "nộp quỹ khi giao ca"
create or replace function public.app__ca_hand(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.shift_reports; prev public.shift_reports; ps text; tol bigint := public.app__ca_tol();
        pc bigint; cnt bigint; gap bigint; st text; fl bigint := coalesce(public.app__fund_set('fund_cash_float')::bigint, 1000000);
begin
  select * into r from public.shift_reports where id = p_id;
  if r.id is null or r.shift = (public.app__shifts())[1] or not public.app__ca_chain(r.shift) then return null; end if;
  ps := public.app__ca_prev_shift(r.shift);
  if ps is not null then
    select * into prev from public.shift_reports where branch_id = r.branch_id and work_date = r.work_date and shift = ps;
  end if;
  cnt := (public.app__ca_eff(r.id) ->> 'opening_cash')::bigint;
  if prev.id is not null and prev.status = 'hoan_thanh' then pc := (public.app__ca_eff(prev.id) ->> 'cash_counted')::bigint; end if;
  gap := cnt - pc;
  st := case when cnt is null then case when prev.id is not null and prev.status <> 'hoan_thanh' then 'cho_ca_truoc' else 'chua_dem' end
             when prev.id is null then 'khong_ca_truoc'
             when pc is null then 'cho_ca_truoc'
             when abs(gap) <= tol then 'khop'
             when cnt = fl and pc > fl then 'rut_quy'   -- bước 45: mở ca với tiền gối đầu, phần dư nộp quỹ khi giao ca
             when r.open_first_count is not null and r.open_recount_at is null then 'can_dem_lai'
             else 'lech' end;
  return jsonb_build_object('state', st, 'prev_id', prev.id, 'prev_shift', ps, 'prev_status', prev.status, 'prev_cash', pc,
    'counted', cnt, 'first_count', r.open_first_count, 'gap', gap,
    'gap_eff', case when st in ('lech', 'can_dem_lai') then gap else 0 end,
    'rut', case when st = 'rut_quy' then pc - cnt else 0 end, 'float', fl,
    'counted_by', public.app__acc_name(r.open_counted_by), 'counted_at', r.open_counted_at, 'blind', r.open_counted_at is not null,
    'giver_id', r.open_giver_emp, 'giver', (select e.code || ' – ' || e.name from public.employees e where e.id = r.open_giver_emp),
    'recount_at', r.open_recount_at, 'ipos_opening', r.ipos_opening, 'tol', tol,
    'prev_staff', case when prev.id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.code || ' – ' || e.name) order by e.code)
                    from public.shift_report_staff s join public.employees e on e.id = s.employee_id
                   where s.report_id = prev.id and s.worked = 1), '[]') end);
end $$;

-- Tổng tiền nộp quỹ khi giao ca trong 1 ngày của 1 cơ sở (chỉ phiếu đã gửi)
create or replace function public.app__ca_rut_day(p_branch bigint, p_date text) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum((public.app__ca_hand(r.id) ->> 'rut')::bigint), 0)
    from public.shift_reports r
   where r.branch_id = p_branch and r.work_date = p_date and r.status = 'hoan_thanh' and public.app__ca_chain(r.shift)
     and r.shift <> (public.app__shifts())[1]
$$;

-- ---------------------------------------------------------------- Đối soát tiền mặt cuối ngày: trừ tiền nộp quỹ khi giao ca
create or replace function public.app_ca_day(p_date text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare out jsonb;
begin
  perform public.app__need('doi_soat');
  select coalesce(jsonb_agg(jsonb_build_object(
      'branch_id', b.id, 'branch_code', coalesce(b.display_code, b.code), 'branch_name', b.name,
      'shifts', (select count(*) from public.branch_shifts bs join public.shifts s on s.id = bs.shift_id and s.status = 'Đang sử dụng'
                  where bs.branch_id = b.id and bs.enabled = 1 and public.app__ca_chain(s.name)),
      'done', (select count(*) from public.shift_reports r where r.branch_id = b.id and r.work_date = p_date and r.status = 'hoan_thanh' and public.app__ca_chain(r.shift)),
      'recon_done', (select count(*) from public.shift_reports r where r.branch_id = b.id and r.work_date = p_date and r.recon_status = 'hoan_thanh' and public.app__ca_chain(r.shift)),
      'recon_reopen', (select count(*) from public.shift_reports r where r.branch_id = b.id and r.work_date = p_date and r.recon_status = 'mo_lai'),
      'opening', (select (public.app__ca_eff(r.id) ->> 'opening_cash')::bigint from public.shift_reports r where r.branch_id = b.id and r.work_date = p_date
                   order by array_position(public.app__shifts(), r.shift) limit 1),
      'pos_cash', (select sum((public.app__ca_eff(r.id) ->> 'pos_cash')::bigint) from public.shift_reports r
                    where r.branch_id = b.id and r.work_date = p_date and r.status = 'hoan_thanh'),
      'moves_cash', (select coalesce(sum((m ->> 'amount')::bigint), 0) from public.shift_reports r
                     cross join lateral jsonb_array_elements(public.app__ca_eff(r.id) -> 'moves') m
                     where r.branch_id = b.id and r.work_date = p_date and r.status = 'hoan_thanh' and m ->> 'kind' = 'tien_mat'),
      'debt_cash', (select coalesce(sum(d.amount), 0) from public.shift_debts d join public.shift_reports r on r.id = d.closed_report_id
                     where r.branch_id = b.id and r.work_date = p_date and r.status = 'hoan_thanh' and d.collect_kind = 'tien_mat'),
      'rut_giao_ca', public.app__ca_rut_day(b.id, p_date),
      'last_counted', (select (public.app__ca_eff(r.id) ->> 'cash_counted')::bigint from public.shift_reports r
                        where r.branch_id = b.id and r.work_date = p_date and r.status = 'hoan_thanh' and public.app__ca_chain(r.shift)
                        order by array_position(public.app__shifts(), r.shift) desc limit 1),
      'last_shift', (select r.shift from public.shift_reports r where r.branch_id = b.id and r.work_date = p_date and r.status = 'hoan_thanh' and public.app__ca_chain(r.shift)
                      order by array_position(public.app__shifts(), r.shift) desc limit 1),
      'has_debt', exists (select 1 from public.shift_debts d join public.shift_reports r on r.id = d.report_id
                           where r.branch_id = b.id and r.work_date = p_date),
      'locked', public.app__fin_locked(b.id, p_date),
      'counted', c.counted, 'note', c.note, 'done_by', public.app__acc_name(c.done_by), 'done_at', c.done_at
    ) order by b.sort_order), '[]'::jsonb) into out
    from public.branches b
    left join public.daily_cash_closings c on c.branch_id = b.id and c.work_date = p_date
   where b.status = 'Đang hoạt động';
  return out;
end $$;

-- ---------------------------------------------------------------- Chốt tháng: tiền mặt theo ngày trừ tiền nộp quỹ khi giao ca
create or replace function public.app__fin_calc(p_branch bigint, p_month text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
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
        from public.shift_reports x cross join lateral (select public.app__kt_bank_json(x) as k) kk
       where x.branch_id = p_branch and x.work_date between d0::text and d1::text and x.status = 'hoan_thanh') y;

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
end $$;

-- ---------------------------------------------------------------- Sổ quỹ: dòng "Nộp quỹ khi giao ca"
create or replace function public.app__fund_rows(p_branch bigint, p_from text, p_to text)
returns table(d text, method text, typ text, label text, amount bigint, auto boolean, ref jsonb)
language plpgsql stable security definer set search_path = public as $$
declare st text := public.app__fund_start(); fl bigint := coalesce(public.app__fund_set('fund_cash_float')::bigint, 1000000);
        f text := greatest(p_from, public.app__fund_start()); dd date;
begin
  if f > p_to then return; end if;
  for dd in select generate_series(f::date, p_to::date, interval '1 day')::date loop
    -- tiền mặt nộp quỹ cuối ngày
    return query
      select to_char(dd, 'YYYY-MM-DD'), 'tien_mat'::text, 'nop_quy'::text,
             case when v.cash_amount is not null then 'Nộp quỹ cuối ngày (quản lý nhập)' else 'Nộp quỹ cuối ngày (đếm ' || public.app__vnd(c.counted) || ' − để lại ' || public.app__vnd(fl) || ')' end,
             coalesce(v.cash_amount, c.counted - fl), v.cash_amount is null,
             jsonb_build_object('counted', c.counted, 'note', v.cash_note)
        from (select 1) one
        left join public.daily_cash_closings c on c.branch_id = p_branch and c.work_date = to_char(dd, 'YYYY-MM-DD')
        left join public.fund_day_values v on v.branch_id = p_branch and v.work_date = to_char(dd, 'YYYY-MM-DD')
       where coalesce(v.cash_amount, c.counted - fl) is not null and coalesce(v.cash_amount, c.counted - fl) <> 0;
    -- bước 45: tiền mặt nộp quỹ khi giao ca (ca sau mở với tiền gối đầu)
    return query
      select to_char(dd, 'YYYY-MM-DD'), 'tien_mat'::text, 'nop_quy'::text,
             'Nộp quỹ khi giao ca ' || (hh.h ->> 'prev_shift') || ' → ' || r.shift || ' (két để lại ' || public.app__vnd(fl) || ')',
             (hh.h ->> 'rut')::bigint, true, jsonb_build_object('report_id', r.id)
        from public.shift_reports r cross join lateral (select public.app__ca_hand(r.id) h) hh
       where r.branch_id = p_branch and r.work_date = to_char(dd, 'YYYY-MM-DD') and r.status = 'hoan_thanh'
         and public.app__ca_chain(r.shift) and hh.h ->> 'state' = 'rut_quy';
    -- chuyển khoản về
    return query
      select to_char(dd, 'YYYY-MM-DD'), 'chuyen_khoan'::text, 'ck_ve'::text,
             case when v.bank_amount is not null then 'Chuyển khoản về (quản lý nhập)' else 'Chuyển khoản thực nhận (kế toán)' end,
             coalesce(v.bank_amount, a.s), v.bank_amount is null, jsonb_build_object('note', v.bank_note)
        from (select public.app__fund_bank_auto(p_branch, to_char(dd, 'YYYY-MM-DD')) s) a
        left join public.fund_day_values v on v.branch_id = p_branch and v.work_date = to_char(dd, 'YYYY-MM-DD')
       where coalesce(v.bank_amount, a.s) is not null and coalesce(v.bank_amount, a.s) <> 0;
  end loop;
  -- khoản thu chi quản lý tạo
  return query
    select e.entry_date, e.pay_method, 'thu_chi'::text, (case when e.kind = 'chi' then 'Chi: ' else 'Thu: ' end) || e.note || coalesce(' · ' || c.name, ''),
           case when e.kind = 'chi' then -e.amount else e.amount end, false, jsonb_build_object('entry_id', e.id)
      from public.fin_entries e left join public.fin_categories c on c.id = e.category_id
     where e.branch_id = p_branch and e.entry_date between f and p_to;
  -- nhân viên bù khoản âm (tiền mặt)
  return query
    select left(s.status_at, 10), 'tien_mat'::text, 'bu_khoan_am'::text, 'NV bù khoản âm: ' || coalesce(em.code || ' – ' || em.name, '?'),
           s.amount, false, jsonb_build_object('shortfall_id', s.id, 'report_id', s.report_id)
      from public.shift_shortfalls s join public.shift_reports r on r.id = s.report_id left join public.employees em on em.id = s.employee_id
     where r.branch_id = p_branch and s.status = 'da_bu' and left(s.status_at, 10) between f and p_to;
  -- phiếu rút
  return query
    select w.wdate, w.method, 'rut'::text,
           (case when w.kind = 'cuoi_thang' then 'Rút cuối tháng' else 'Rút giữ hộ' end) || case when w.status = 'da_nhan' then ' · Chủ đã nhận' else ' · chờ Chủ xác nhận' end
             || case when w.note <> '' then ' · ' || w.note else '' end,
           -w.amount, false, jsonb_build_object('withdrawal_id', w.id, 'status', w.status)
      from public.fund_withdrawals w where w.branch_id = p_branch and w.wdate between f and p_to;
end $$;

revoke execute on function public.app__ca_rut_day(bigint, text) from public, anon, authenticated;
