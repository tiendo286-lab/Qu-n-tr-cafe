-- Chặng 6.5 (anh Tiến chọn 23/11/2026: "quản lý bấm Xác nhận Fabi lại"): ca được web tự duyệt (khớp file Fabi + ngân hàng) nhưng có khoản thu chi
-- ghi tay thì thiếu dấu mục Thu chi → trang ca coi là "đã Xác nhận Fabi" (chỉ xét tiền mặt + chuyển khoản), bấm Hoàn thành không thành Đã đối soát
-- (73 ca tháng 11). Sửa: "đã Xác nhận Fabi" = đủ dấu 4 mục tiền (giống app__ca_ds_row / app__fin_missing) → nút Xác nhận Fabi hiện lại, bấm là ghi
-- dấu Thu chi / Công nợ còn thiếu (app_stc_ds_close vốn làm); ca đã bấm Hoàn thành từ trước thì xác nhận xong tự Hoàn thành đối soát.
-- Vùng khoá (đã báo anh Tiến): app__stc_ds_state, app_stc_month (mdone), app_stc_ds_close. Không đổi quyền, không đổi cách tính tiền, không sửa dữ liệu.
-- Sinh từ bản hàm đang chạy (pg_get_functiondef) + thay chữ có kiểm số lần khớp.

CREATE OR REPLACE FUNCTION public.app__stc_ds_state(p_report bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.shift_reports; e jsonb; f jsonb; x jsonb; nv_open bigint; b public.stc_open_blame; kt jsonb; done boolean;
begin
  select * into r from public.shift_reports where id = p_report;
  e := public.app__ca_eff(p_report);
  select to_jsonb(s) into f from public.fabi_shifts s
   where s.report_id = r.id or (s.report_id is null and s.branch_id = r.branch_id and s.work_date = r.work_date and s.shift = r.shift)
   order by (s.report_id = r.id) desc nulls last limit 1;
  x := public.app__stc_exp_open(p_report);
  select * into b from public.stc_open_blame where report_id = p_report;
  kt := public.app__ca_kt_state(p_report);
  nv_open := coalesce((e ->> 'ipos_opening')::bigint, (e ->> 'opening_cash')::bigint);
  -- chặng 6.5 (anh Tiến chọn 23/11): đã Xác nhận Fabi = đủ dấu 4 mục tiền (như Chốt tháng / bảng tuần). Web tự duyệt khi khớp file Fabi + ngân hàng
  -- không duyệt mục Thu chi của ca có khoản ghi tay → trước đây ca hiện "đã xác nhận" mà Hoàn thành không thành Đã đối soát; nay hiện lại nút Xác nhận Fabi.
  done := (select count(distinct s.item) from public.shift_report_results s where s.report_id = p_report and s.item = any(public.app__ca_money_items()))
          >= cardinality(public.app__ca_money_items());
  return jsonb_build_object('has_fabi', f is not null, 'kt_ready', coalesce((kt ->> 'ready')::boolean, true), 'done', done,
    'nv_open', nv_open, 'fabi_open', (f ->> 'dau')::bigint, 'exp', x -> 'exp', 'prev', x -> 'prev', 'blame', case when b.report_id is null then null else to_jsonb(b) end,
    'mo1', f is null or nv_open is not distinct from (f ->> 'dau')::bigint or public.app__stc_fix_ok(p_report, 'mo', e),
    'mo2', b.report_id is not null or x ->> 'exp' is null or coalesce(case when public.app__stc_fix_ok(p_report, 'mo', e) then nv_open end, (f ->> 'dau')::bigint, nv_open) is not distinct from (x ->> 'exp')::bigint,
    'dt', f is null or (e ->> 'total_revenue')::bigint is not distinct from (f ->> 'net')::bigint or public.app__stc_fix_ok(p_report, 'dt', e),
    'no', (f is null or coalesce((e ->> 'pos_debt')::bigint, 0) = coalesce((f ->> 'no')::bigint, 0) or public.app__stc_fix_ok(p_report, 'no', e))
            and coalesce((e ->> 'pos_debt')::bigint, 0) = public.app__ca_bill_list(p_report),   -- chặng 4: Nợ bill phải bằng danh sách khách nợ HĐ của ca
    'bill_list', public.app__ca_bill_list(p_report),
    'fabi_rev', (f ->> 'net')::bigint, 'fabi_debt', coalesce((f ->> 'no')::bigint, 0),
    'need_tm', r.cash_mode = 'ca' and r.ql_counted is null, 'fix', public.app__stc_fix_json(p_report));
end $function$;

CREATE OR REPLACE FUNCTION public.app_stc_month(p_branch bigint, p_month text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app_account(); st text := public.app__fund_start(); d0 text; d1 text; br record; res jsonb;
begin
  if a.id is null then raise exception 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'; end if;
  if not coalesce(public.app__stc_can(p_branch), false) then raise exception 'Bạn không được xem thu chi của cơ sở này.'; end if;
  if coalesce(p_month, '') !~ '^\d{4}-\d{2}$' then raise exception 'Tháng không hợp lệ.'; end if;
  d0 := greatest(p_month || '-01', st);
  d1 := to_char((p_month || '-01')::date + interval '1 month' - interval '1 day', 'YYYY-MM-DD');
  select b.id, coalesce(b.display_code, b.code) code, b.name into br from public.branches b where b.id = p_branch and b.status = 'Đang hoạt động';
  if br.id is null then raise exception 'Không tìm thấy cơ sở.'; end if;

  with r as materialized (   -- mỗi phiếu tính bản đối soát, ngân hàng, kế toán đúng 1 lần
    select x.id, x.work_date, x.shift, x.cash_mode, x.ql_counted, x.ipos_opening, x.opening_cash, x.total_revenue, x.pos_debt,
           public.app__ca_eff(x.id) e, public.app__kt_bank_json(x) b, public.app__ca_kt_state(x.id) kt,
           (select to_jsonb(f) from public.fabi_shifts f
             where f.report_id = x.id or (f.report_id is null and f.branch_id = x.branch_id and f.work_date = x.work_date and f.shift = x.shift)
             order by (f.report_id = x.id) desc nulls last limit 1) fb,
           ((select count(distinct s.item) from public.shift_report_results s where s.report_id = x.id and s.item = any(public.app__ca_money_items()))
            >= cardinality(public.app__ca_money_items())) mdone   -- chặng 6.5: đủ 4 mục tiền
      from public.shift_reports x
     where x.branch_id = p_branch and x.status = 'hoan_thanh' and x.work_date between st and d1),
  mv as (   -- khoản thu chi của phiếu (cùng cách đặt khoá mkey như app__tc_moves_x để nối nhóm / đối soát)
    select r.id rid, r.work_date, t.ord, (t.v ->> 'kind') pay, (t.v ->> 'amount')::bigint amt, coalesce(t.v ->> 'note', '') note,
           md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) || '#'
             || row_number() over (partition by r.id, md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) order by t.ord) mkey,
           case when nullif(t.v ->> 'exchange_key', '') is not null then 'doi_tien' else t.v ->> 'auto' end auto
      from r cross join lateral jsonb_array_elements(coalesce(r.e -> 'moves', '[]'::jsonb)) with ordinality t(v, ord)
     where coalesce((t.v ->> 'amount')::bigint, 0) <> 0),
  it as (
    -- doanh thu (phần khách trả tiền mặt / chuyển khoản)
    select r.work_date d, r.id ca, 'thu' book, p.pm, 'dt' col, p.amt amount, 'Doanh thu ca ' || r.shift title,
           case when r.fb is null then 'Theo phiếu (chưa có file Fabi)' else 'Theo phiếu đã đối soát / Fabi' end meta,
           null::text cat, null::bigint cat_type, true checked, false no_cost, null::text status, null::text src_from, false to_qn, null::text recv,
           'f:' || r.id || ':' || p.pm id, 'dt' src
      from r cross join lateral (values ('tm', coalesce((r.e ->> 'pos_cash')::bigint, 0)), ('ck', coalesce((r.e ->> 'pos_transfer')::bigint, 0))) p(pm, amt)
     where p.amt > 0
    union all   -- khoản thu chi phiếu ca
    select mv.work_date, mv.rid, case when mv.amt < 0 then 'chi' else 'thu' end, case when mv.pay = 'chuyen_khoan' then 'ck' else 'tm' end,
           case when mv.auto = 'doi_tien' then 'lc' when mv.auto = 'muon' or dl.id is not null or ln.id is not null then 'no' when mv.amt < 0 then 'chi' else 'khac' end,
           abs(mv.amt), mv.note,
           case when mv.auto = 'luong' then 'Lương trả tiền mặt' when mv.auto = 'muon' then 'Khách mượn tiền két (Nợ TM)' when dl.id is not null then 'Đã thành nợ'
                when ln.id is not null then 'Đã thành cho vay' else 'Phiếu ca' end,
           c.name, c.type_id, coalesce(fc.checked, 0) = 1 or mv.auto in ('doi_tien', 'muon'), coalesce(fc.excluded, case when mv.amt > 0 then 1 else 0 end) = 1,
           null, null, false, null, 'm:' || mv.rid || ':' || mv.mkey, 'move'
      from mv left join public.fin_move_cats fc on fc.report_id = mv.rid and fc.mkey = mv.mkey
      left join public.fin_categories c on c.id = fc.category_id
      left join lateral (select d.id from public.shift_debts d where d.mv_report = mv.rid and d.mv_key = mv.mkey order by d.id limit 1) dl on true
      left join lateral (select l.id from public.branch_loans l where l.report_id = mv.rid and l.mkey = mv.mkey order by l.id limit 1) ln on true
    union all   -- nợ chuyển khoản phát sinh trong ca (cho nợ CK)
    select r.work_date, r.id, 'chi', 'ck', 'no', d.amount, 'Nợ CK – ' || d.table_name, 'Phiếu ca', null, null, true, true, null, null, false, null, 'dn:' || d.id, 'debt'
      from r join public.shift_debts d on d.report_id = r.id and d.kind = 'ck' and d.amount > 0
    union all   -- khách trả nợ trong ca
    select r.work_date, r.id, 'thu', case when d.collect_kind = 'chuyen_khoan' then 'ck' else 'tm' end, 'no', d.amount, d.table_name, case when d.close_note like 'Gán nợ khách trả%' then 'Gán nợ khách trả (quản lý)' else 'Khách trả nợ trong ca' end,
           null, null, true, true, null,
           (select 'ca ' || x.shift || ' ' || to_char(x.work_date::date, 'DD/MM') from public.shift_reports x where x.id = d.report_id), false, null, 'dc:' || d.id, 'debt'
      from r join public.shift_debts d on d.closed_report_id = r.id and d.collect_kind in ('tien_mat', 'chuyen_khoan')
    union all   -- quản lý thu nợ ngoài ca
    select left(d.closed_at, 10), null, 'thu', case when d.collect_kind = 'chuyen_khoan' then 'ck' else 'tm' end, 'no', d.amount, d.table_name, 'Quản lý thu ngoài ca',
           null, null, true, true, null,
           (select 'ca ' || x.shift || ' ' || to_char(x.work_date::date, 'DD/MM') from public.shift_reports x where x.id = d.report_id), false, null, 'dc:' || d.id, 'debt'
      from public.shift_debts d
     where d.branch_id = p_branch and d.closed_at is not null and d.closed_report_id is null and d.collect_kind in ('tien_mat', 'chuyen_khoan') and left(d.closed_at, 10) between st and d1
    union all   -- công nợ quản lý ghi, tiền đưa từ quỹ
    select left(d.created_at, 10), null, 'chi', case when d.kind = 'ck' then 'ck' else 'tm' end, 'no', d.amount,
           (case when d.kind = 'ck' then 'Nợ CK: ' else 'Nợ TM: ' end) || d.table_name, 'Quản lý ghi, tiền đưa từ quỹ', null, null, true, true, null, null, false, null, 'dn:' || d.id, 'debt'
      from public.shift_debts d where d.branch_id = p_branch and d.fund_out = 1 and d.report_id is null and left(d.created_at, 10) between st and d1
    union all   -- cho vay cũ (từ quỹ) và lần trả
    select l.loan_date, null, 'chi', case when l.method = 'chuyen_khoan' then 'ck' else 'tm' end, 'no', l.amount,
           case when l.kind = 'tra_ho' then 'Trả hộ Kho tổng' else 'Cho vay: ' || p.name end, 'Cho vay (cũ)', null, null, true, true, null, null, false, null, 'l:' || l.id, 'loan'
      from public.branch_loans l join public.loan_people p on p.id = l.person_id
     where l.branch_id = p_branch and l.report_id is null and l.from_debt is null and l.loan_date between st and d1
    union all
    select y.pay_date, null, 'thu', case when y.method = 'chuyen_khoan' then 'ck' else 'tm' end, 'no', y.amount, 'Trả nợ vay: ' || p.name, 'Cho vay (cũ)',
           null, null, true, true, null, null, false, null, 'lp:' || y.id, 'loan'
      from public.branch_loan_payments y join public.branch_loans l on l.id = y.loan_id join public.loan_people p on p.id = l.person_id
     where l.branch_id = p_branch and y.pay_date between st and d1
    union all   -- khoản quản lý tạo (kể cả phiếu chi chuyển khoản, điều chỉnh kiểm quỹ); quán chịu / thu khác từ lệch không đổi quỹ nên bỏ
    select e.entry_date, null, case when e.kind = 'chi' then 'chi' else 'thu' end, case when e.pay_method = 'chuyen_khoan' then 'ck' else 'tm' end,
           case when e.kind = 'chi' then 'chi' else 'khac' end, e.amount, e.note,
           case when bo.rid is not null then 'Phiếu chi chuyển khoản · ca ' || bo.shift || ' ' || to_char(bo.wd::date, 'DD/MM') else 'Quản lý tạo' end,
           c.name, c.type_id, true, false, null, null, false, null, 'e:' || e.id, 'entry'
      from public.fin_entries e left join public.fin_categories c on c.id = e.category_id
      left join lateral (select o.report_id rid, x.shift, x.work_date wd from public.shift_bank_outs o join public.shift_reports x on x.id = o.report_id
                          where o.fin_entry_id = e.id limit 1) bo on true
     where e.branch_id = p_branch and e.entry_date between st and d1 and not coalesce(e.no_fund, false)
    union all   -- nhân viên nộp bù khoản âm (tiền mặt)
    select left(s.status_at, 10), null, 'thu', 'tm', 'khac', s.amount, 'NV bù khoản âm: ' || coalesce(em.code || ' – ' || em.name, '?'), 'Nộp bù',
           null, null, true, true, null, null, false, null, 'k:' || s.id, 'shortfall'
      from public.shift_shortfalls s join public.shift_reports x on x.id = s.report_id left join public.employees em on em.id = s.employee_id
     where x.branch_id = p_branch and s.status = 'da_bu' and left(s.status_at, 10) between st and d1
    union all   -- luân chuyển quỹ tiền mặt ↔ tài khoản: 2 vế
    select t.tdate, null, v.book, v.pm, 'lc', t.amount,
           case when t.direction = 'tm_tk' then 'Nộp tiền mặt vào tài khoản' else 'Rút tài khoản ra tiền mặt' end || case when t.note <> '' then ' · ' || t.note else '' end,
           'Luân chuyển quỹ', null, null, true, true, null, null, false, null, 't:' || t.id || ':' || v.book, 'transfer'
      from public.fund_transfers t
      cross join lateral (values ('chi', case when t.direction = 'tm_tk' then 'tm' else 'ck' end), ('thu', case when t.direction = 'tm_tk' then 'ck' else 'tm' end)) v(book, pm)
     where t.branch_id = p_branch and t.tdate between st and d1
    union all   -- phiếu rút cũ = chuyển về Quỹ ngoài
    select w.wdate, null, 'chi', case when w.method = 'chuyen_khoan' then 'ck' else 'tm' end, 'lc', w.amount,
           'Chuyển về Quỹ ngoài' || case when w.note <> '' then ' · ' || w.note else '' end,
           case when w.kind = 'cuoi_thang' then 'Phiếu rút cuối tháng (cũ)' else 'Phiếu rút giữ hộ (cũ)' end,
           null, null, true, true, case when w.status = 'da_nhan' then 'Chủ đã nhận · khoá' else 'Chờ Chủ nhận' end, null, true,
           case when w.status = 'da_nhan' then 'da' else 'cho' end, 'w:' || w.id, 'withdrawal'
      from public.fund_withdrawals w where w.branch_id = p_branch and w.wdate between st and d1
  ),
  g as (   -- chênh lệch mỗi ca từ khoản ở trên
    select r.id, r.work_date, r.shift,
           (r.e ->> 'opening_cash')::bigint start_tm,
           case when r.cash_mode = 'ca' and r.ql_counted is not null then r.ql_counted + public.app__stc_handover_adj(r.id) else (r.e ->> 'cash_counted')::bigint end real_tm,
           case when coalesce((r.b ->> 'account_count')::int, 0) > 0 and (r.b ->> 'entered')::int = (r.b ->> 'account_count')::int then (r.b ->> 'received')::bigint end real_ck,
           coalesce((select sum(case when it.book = 'thu' then it.amount else -it.amount end) from it where it.ca = r.id and it.pm = 'tm'), 0) net_tm,
           coalesce((select sum(case when it.book = 'thu' then it.amount else -it.amount end) from it where it.ca = r.id and it.pm = 'ck'), 0) net_ck
      from r),
  gs as (select * from public.app__gap_rows(p_branch, d0, d1)),
  lech as (
    select g.work_date d, g.id ca, case when v.gap > 0 then 'thu' else 'chi' end book, v.pm, 'lech' col, greatest(abs(v.gap) - coalesce((select sum(mm.amount) from public.gap_matches mm where mm.status = 'da_duyet' and mm.item = case when v.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end
                     and ((v.gap < 0 and mm.short_report = g.id) or (v.gap > 0 and mm.over_report = g.id))), 0), 0) amount,
           case when v.gap > 0 then 'Ca dư tiền' else 'Ca thiếu tiền' end title,
           case when v.pm = 'tm' then 'Tiền mặt thực tế ' || public.app__vnd(g.real_tm) else 'Ngân hàng nhận ' || public.app__vnd(g.real_ck) end meta,
           null::text cat, null::bigint cat_type, true checked, true no_cost,
           coalesce((select case gs.state when 'xong' then 'Đã xử lý' when 'du' then 'Chờ xử lý (dư)' when 'cho_no' then 'Chờ khách trả nợ'
                                 when 'cho_tien' then 'Chờ tiền về' else 'Chờ xử lý · chưa làm phiếu trừ tiền' end
                       from gs where gs.report_id = g.id and gs.item = case when v.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end limit 1),
                    case when abs(v.gap) <= 5000 then 'Lệch nhỏ ≤ 5.000 (coi như khớp)' else null end)
           || case when exists (select 1 from public.gap_matches mm where mm.status = 'cho_duyet' and mm.item = case when v.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end and (mm.short_report = g.id or mm.over_report = g.id))
                     or exists (select 1 from public.stc_gap_requests q where q.status = 'cho_duyet' and q.report_id = g.id and q.item = case when v.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end)
                   then ' · ⏳ chờ Chủ duyệt' else '' end status,
           null::text src_from, false to_qn, null::text recv, 'g:' || g.id || ':' || v.pm id, 'gap' src
      from g cross join lateral (values ('tm', g.real_tm - g.start_tm - g.net_tm), ('ck', g.real_ck - g.net_ck)) v(pm, gap)
     where v.gap is not null and v.gap <> 0),
  allit as (select * from it union all select * from lech),
  ed as (select e.*, public.app__acc_name(e.by_account) by_name from public.stc_edits e where e.branch_id = p_branch),
  vd as (   -- khoản cũ đã bị sửa / xoá: hiện gạch ngang, không cộng
    select v.*, ed.action v_action, ed.by_name v_by, ed.at v_at, ed.reason v_reason
      from ed cross join lateral (
        select ed.old ->> 'entry_date' d, null::bigint ca, case when ed.old ->> 'kind' = 'chi' then 'chi' else 'thu' end book,
               case when ed.old ->> 'pay_method' = 'chuyen_khoan' then 'ck' else 'tm' end pm, case when ed.old ->> 'kind' = 'chi' then 'chi' else 'khac' end col,
               (ed.old ->> 'amount')::bigint amount, ed.old ->> 'note' title, 'Quản lý tạo' meta, ed.old ->> 'category' cat, 'v:' || ed.id id, 'entry' src
         where ed.kind = 'entry'
        union all
        select ed.old ->> 'tdate', null, l.book, l.pm, 'lc', (ed.old ->> 'amount')::bigint,
               case when ed.old ->> 'direction' = 'tm_tk' then 'Nộp tiền mặt vào tài khoản' else 'Rút tài khoản ra tiền mặt' end || case when coalesce(ed.old ->> 'note', '') <> '' then ' · ' || (ed.old ->> 'note') else '' end,
               'Luân chuyển quỹ', null, 'v:' || ed.id || ':' || l.book, 'transfer'
          from (values ('chi', case when ed.old ->> 'direction' = 'tm_tk' then 'tm' else 'ck' end), ('thu', case when ed.old ->> 'direction' = 'tm_tk' then 'ck' else 'tm' end)) l(book, pm)
         where ed.kind = 'transfer'
        union all
        select left(ed.old ->> 'created_at', 10), null, 'chi', case when ed.old ->> 'kind' = 'ck' then 'ck' else 'tm' end, 'no', (ed.old ->> 'amount')::bigint,
               (case when ed.old ->> 'kind' = 'ck' then 'Nợ CK: ' else 'Nợ TM: ' end) || (ed.old ->> 'table_name'), 'Quản lý ghi, tiền đưa từ quỹ', null, 'v:' || ed.id, 'debt'
         where ed.kind = 'debt'
        union all
        select coalesce((select x.work_date from public.shift_reports x where x.id = (ed.old ->> 'closed_report_id')::bigint), left(ed.old ->> 'closed_at', 10)), (ed.old ->> 'closed_report_id')::bigint,
               'thu', case when ed.old ->> 'collect_kind' = 'chuyen_khoan' then 'ck' else 'tm' end, 'no', (ed.old ->> 'amount')::bigint,
               ed.old ->> 'table_name', case when ed.old ->> 'closed_report_id' is not null then 'Gán nợ khách trả (quản lý)' else 'Quản lý thu ngoài ca' end, null, 'v:' || ed.id, 'debt'
         where ed.kind = 'collect'
        union all
        select ed.old ->> 'date', (ed.old ->> 'ca_id')::bigint, ed.old ->> 'book', ed.old ->> 'pm', ed.old ->> 'col', (ed.old ->> 'amount')::bigint,
               ed.old ->> 'title', 'Phiếu ca', ed.old ->> 'cat', 'v:' || ed.id, 'move'
         where ed.kind = 'move') v
     where ed.action in ('sua', 'xoa') and ed.old is not null),
  oldf as (   -- Sổ quỹ cũ: số dư cuối mỗi ngày (để so)
    select f.d, sum(f.amount) filter (where f.method = 'tien_mat') tm, sum(f.amount) filter (where f.method = 'chuyen_khoan') ck
      from public.app__fund_rows(p_branch, st, least(d1, to_char(public.vn_now(), 'YYYY-MM-DD'))) f group by f.d)
  select jsonb_build_object(
    'branch', jsonb_build_object('id', br.id, 'code', br.code, 'name', br.name),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code)) order by b.sort_order)
                            from public.branches b where b.status = 'Đang hoạt động' and coalesce(public.app__stc_can(b.id), false)), '[]'),
    'owner', a.system_role = 'chu',
    'month', p_month, 'from', d0, 'to', d1, 'locked', coalesce(public.app__fin_locked(p_branch, d0), false),
    'opening', jsonb_build_object(
       'tm', coalesce((select o.amount from public.fund_openings o where o.branch_id = p_branch and o.method = 'tien_mat'), 0)
             + coalesce((select sum(case when x.book = 'thu' then x.amount else -x.amount end) from allit x where x.pm = 'tm' and x.d < d0), 0),
       'ck', coalesce((select o.amount from public.fund_openings o where o.branch_id = p_branch and o.method = 'chuyen_khoan'), 0)
             + coalesce((select sum(case when x.book = 'thu' then x.amount else -x.amount end) from allit x where x.pm = 'ck' and x.d < d0), 0)),
    'cas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'date', r.work_date, 'shift', r.shift,
        'staff', (select string_agg(em.name, ', ' order by em.code) from jsonb_array_elements(coalesce(r.e -> 'staff', '[]'::jsonb)) s
                    join public.employees em on em.id = (s ->> 'employee_id')::bigint where coalesce((s ->> 'worked')::boolean, true)),
        'cash_mode', coalesce(r.cash_mode, 'ngay'), 'ql_counted', r.ql_counted, 'nv_counted', (r.e ->> 'cash_counted')::bigint,
        'start_tm', g.start_tm, 'real_tm', g.real_tm,
        'nv', jsonb_build_object('opening', coalesce((r.e ->> 'ipos_opening')::bigint, (r.e ->> 'opening_cash')::bigint), 'revenue', (r.e ->> 'total_revenue')::bigint, 'debt', coalesce((r.e ->> 'pos_debt')::bigint, 0)),
        'nv_raw', jsonb_build_object('opening', coalesce(r.ipos_opening, r.opening_cash), 'revenue', r.total_revenue, 'debt', coalesce(r.pos_debt, 0)),
        'blame', (select to_jsonb(ob) || jsonb_build_object('by', public.app__acc_name(ob.by_account)) from public.stc_open_blame ob where ob.report_id = r.id),
        'fabi', jsonb_build_object('has', r.fb is not null, 'opening', (r.fb ->> 'dau')::bigint, 'revenue', (r.fb ->> 'net')::bigint,
                  'tm', (r.fb ->> 'tm')::bigint, 'ck', (r.fb ->> 'ck')::bigint, 'debt', coalesce((r.fb ->> 'no')::bigint, 0),
                  'edited_bills', coalesce(jsonb_array_length(case when jsonb_typeof(r.fb -> 'sua') = 'array' then r.fb -> 'sua' end), 0)),
        'bank_ck', g.real_ck, 'kt_wait', not coalesce((r.kt ->> 'ready')::boolean, true), 'kt_missing', r.kt -> 'missing',
        'recon_money_done', r.mdone,
        'fixes', public.app__stc_fix_json(r.id), 'ticks', coalesce((select jsonb_agg(tk.item order by tk.item) from public.stc_ca_ticks tk where tk.report_id = r.id), '[]'::jsonb),
        'done', case when r.mdone then (select jsonb_build_object('by', coalesce(public.app__acc_name(dn.by_account), ''), 'at', dn.at) from public.stc_ca_done dn where dn.report_id = r.id) end) order by r.work_date, array_position(public.app__shifts(), r.shift))
      from r join g on g.id = r.id where r.work_date >= d0), '[]'),
    'shortfalls', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'report_id', s.report_id, 'date', x.work_date, 'shift', x.shift,
        'item', s.item, 'employee_id', s.employee_id, 'name', coalesce(em.name, '?'), 'amount', s.amount, 'status', s.status, 'reply', s.reply,
        'reason', s.reason, 'note', s.status_note, 'move_mkey', s.move_mkey) order by x.work_date, s.id)
      from public.shift_shortfalls s join public.shift_reports x on x.id = s.report_id left join public.employees em on em.id = s.employee_id
     where x.branch_id = p_branch and x.work_date between d0 and d1 and s.status <> 'huy'), '[]'),
    'ca_debts', coalesce((with recursive cr as (
          select x.id from public.shift_reports x where x.branch_id = p_branch and x.work_date between d0 and d1),
        tree as (
          select g.id root, g.id, g.amount, g.closed_at from public.shift_debts g
           where g.report_id in (select id from cr) and g.split_from is null and g.amount > 0
          union all
          select t.root, c.id, c.amount, c.closed_at from public.shift_debts c join tree t on c.split_from = t.id)
      select jsonb_agg(q.z order by q.rid, q.t, q.did) from (
        select jsonb_build_object('report_id', g.report_id, 't', 'moi', 'id', g.id, 'who', g.table_name, 'kind', coalesce(g.kind, 'bill'),
                 'amount', s.amt, 'left', s.lft, 'pm', null, 'from', null, 'grp', g.grp, 'person_id', g.person_id, 'sorted', (g.sorted_at is not null or g.grp = 'khach'), 'content', g.content,
                   'edit', (select jsonb_build_object('action', case l.action when 'bao_no_them' then 'them' else 'sua' end, 'by', coalesce(public.app__acc_name(l.by_account), ''),
                                    'at', l.at, 'reason', regexp_replace(coalesce(l.reason, ''), '^Sổ thu chi: ', ''),
                                    'old_amount', (l.before ->> 'amount')::bigint, 'old_kind', l.before ->> 'kind')
                              from public.shift_recon_log l
                             where l.report_id = g.report_id and l.action in ('bao_no_sua', 'bao_no_them') and l.reason like 'Sổ thu chi: %' and (l.after ->> 'id')::bigint = g.id
                             order by l.id desc limit 1)) z, g.report_id rid, 'moi' t, g.id did
          from public.shift_debts g
          join (select root, sum(amount) amt, coalesce(sum(amount) filter (where closed_at is null), 0) lft from tree group by root) s on s.root = g.id
        union all
        select jsonb_build_object('report_id', g.closed_report_id, 't', 'tra', 'id', g.id, 'who', g.table_name, 'kind', coalesce(g.kind, 'bill'),
                 'amount', g.amount, 'left', 0, 'pm', g.collect_kind,
                 'from', case when o.id is not null then 'ca ' || o.shift || ' ' || to_char(o.work_date::date, 'DD/MM') else 'quản lý ghi' end),
               g.closed_report_id, 'tra', g.id
          from public.shift_debts g left join public.shift_reports o on o.id = g.report_id
         where g.closed_report_id in (select id from cr) and coalesce(g.report_id, 0) <> g.closed_report_id and g.amount > 0
          union all
          select jsonb_build_object('report_id', l.report_id, 't', 'xoa', 'id', (l.before ->> 'id')::bigint, 'who', l.before ->> 'table_name', 'kind', coalesce(l.before ->> 'kind', 'bill'),
                   'amount', (l.before ->> 'amount')::bigint, 'left', 0, 'pm', null, 'from', null,
                   'edit', jsonb_build_object('action', case when l.field = 'luan_chuyen' then 'doi' else 'xoa' end, 'by', coalesce(public.app__acc_name(l.by_account), ''),
                                              'at', l.at, 'reason', regexp_replace(coalesce(l.reason, ''), '^Sổ thu chi: ', ''))),
                 l.report_id, 'xoa', (l.before ->> 'id')::bigint
            from public.shift_recon_log l
           where l.report_id in (select id from cr) and l.action = 'bao_no_xoa' and l.reason like 'Sổ thu chi: %') q), '[]'),
    'debt_paid', coalesce((select jsonb_object_agg(g.id::text, jsonb_build_object('date', coalesce(x.work_date, left(g.closed_at, 10)), 'shift', x.shift, 'pm', g.collect_kind))
        from public.shift_debts g left join public.shift_reports x on x.id = g.closed_report_id left join public.shift_reports o on o.id = g.report_id
       where g.branch_id = p_branch and g.closed_at is not null
         and (left(g.closed_at, 10) >= d0 or coalesce(o.work_date, left(g.created_at, 10)) >= d0)), '{}'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'date', v.d, 'ca_id', v.ca, 'book', v.book, 'pm', v.pm, 'col', v.col, 'amount', v.amount,
        'title', v.title, 'meta', v.meta, 'cat', v.cat, 'void', true, 'src', v.src,
        'void_info', jsonb_build_object('action', v.v_action, 'by', v.v_by, 'at', v.v_at, 'reason', v.v_reason)) order by v.d, v.id)
      from vd v where v.d >= d0 and v.amount > 0), '[]')
      || coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'date', x.d, 'ca_id', x.ca, 'book', x.book, 'pm', x.pm, 'col', x.col, 'amount', x.amount,
        'title', x.title, 'meta', x.meta, 'cat', x.cat, 'cat_type', x.cat_type, 'checked', x.checked, 'no_cost', x.no_cost, 'status', x.status,
        'from', x.src_from, 'who', null, 'to_qn', x.to_qn, 'recv', x.recv, 'src', x.src,
        'edit', (select jsonb_build_object('action', e.action, 'by', e.by_name, 'at', e.at, 'reason', e.reason, 'old_amount', (e.old ->> 'amount')::bigint)
                   from ed e where e.ref = case when x.id like 'm:%' then x.id else split_part(x.id, ':', 1) || ':' || split_part(x.id, ':', 2) end and e.action in ('them', 'sua') order by e.id desc limit 1),

        'gross', case when x.col = 'lech' then x.amount + coalesce((select sum(mm.amount) from public.gap_matches mm where mm.status = 'da_duyet' and mm.item = case when x.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end
                   and ((x.book = 'chi' and mm.short_report = x.ca) or (x.book = 'thu' and mm.over_report = x.ca))), 0) end,
        'gap', case when x.col = 'lech' then (select jsonb_build_object('item', s.item, 'kind', s.kind, 'total', s.total, 'remain', s.remain,
            'avail', greatest(s.remain - s.mp - coalesce((select sum(q.amount) from public.stc_gap_requests q where q.report_id = x.ca and q.item = s.item and q.status = 'cho_duyet'), 0), 0),
            'people', (select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name) order by e.code) from public.shift_report_staff st join public.employees e on e.id = st.employee_id
                        where st.report_id = x.ca and coalesce(st.worked, 1) = 1),
            'tl', (select jsonb_agg(jsonb_build_object('id', sf.id, 'name', e.name, 'amount', sf.amount, 'status', sf.status, 'reply', sf.reply) order by sf.id) from public.shift_shortfalls sf
                     left join public.employees e on e.id = sf.employee_id where sf.report_id = x.ca and sf.item = s.item and sf.status <> 'huy'),
            'decisions', (select jsonb_agg(jsonb_build_object('id', gd.id, 'kind', gd.kind, 'amount', gd.amount) order by gd.id) from public.gap_decisions gd where gd.report_id = x.ca and gd.item = s.item),
            'matches', (select jsonb_agg(jsonb_build_object('id', mm.id, 'amount', mm.amount, 'status', mm.status, 'side', case when mm.short_report = x.ca then 'thieu' else 'du' end,
                          'with', (select 'ca ' || o.shift || ' ' || to_char(o.work_date::date, 'DD/MM') from public.shift_reports o where o.id = case when mm.short_report = x.ca then mm.over_report else mm.short_report end)) order by mm.id)
                        from public.gap_matches mm where mm.item = s.item and (mm.short_report = x.ca or mm.over_report = x.ca)),
            'qc_wait', (select jsonb_agg(jsonb_build_object('id', q.id, 'amount', q.amount, 'by', public.app__acc_name(q.created_by))) from public.stc_gap_requests q
                         where q.report_id = x.ca and q.item = s.item and q.status = 'cho_duyet'),
            'cands', (select jsonb_agg(jsonb_build_object('report', o.report_id, 'label', 'ca ' || o.shift || ' ' || to_char(o.work_date::date, 'DD/MM'),
                         'amount', greatest(o.remain - o.mp - coalesce((select sum(q.amount) from public.stc_gap_requests q where q.report_id = o.report_id and q.item = o.item and q.status = 'cho_duyet'), 0), 0)) order by o.work_date, o.report_id)
                       from gs o where o.item = s.item and o.kind <> s.kind and o.report_id <> x.ca and abs(o.work_date::date - s.work_date::date) <= 3 and o.remain > 0),
            'has_tl', exists (select 1 from public.shift_shortfalls sf where sf.report_id = x.ca and sf.item = s.item and sf.status <> 'huy'),
            'has_thu', exists (select 1 from public.gap_decisions gd where gd.report_id = x.ca and gd.item = s.item and gd.kind = 'thu_khac'),
            'debts', (select jsonb_agg(jsonb_build_object('id', d.id, 'who', d.table_name, 'amount', d.amount) order by d.id) from public.shift_debts d
                       where d.closed_report_id = x.ca and d.collect_kind = s.item and d.close_note like 'Gán nợ khách trả%'))
          from gs s where s.report_id = x.ca and s.item = case when x.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end limit 1) end,
        'can_edit', x.ca is null and not coalesce(public.app__fin_locked(p_branch, x.d), false)
                    and (x.src = 'transfer' or (x.src = 'entry' and x.meta = 'Quản lý tạo') or (x.src = 'debt' and (x.id like 'dn:%' or x.id like 'dc:%')))
         or (x.src = 'debt' and x.id like 'dc:%' and x.meta = 'Gán nợ khách trả (quản lý)' and not coalesce(public.app__fin_locked(p_branch, x.d), false))
         or (x.src = 'move' and x.meta = 'Phiếu ca' and x.col in ('chi', 'khac') and not coalesce(public.app__fin_locked(p_branch, x.d), false)
             and exists (select 1 from r where r.id = x.ca and r.mdone))) order by x.d, x.ca nulls last, x.id)
      from allit x where x.d >= d0 and (x.amount > 0 or x.col = 'lech')), '[]'),
    'people', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'no_remind', p.nr, 'open', p.open, 'n', p.n) order by p.nr desc, p.name)
      from (select min(trim(d.table_name)) name, bool_or(d.grp <> 'khach') nr,
                   coalesce(sum(d.amount) filter (where d.closed_at is null), 0) open, count(*) filter (where d.closed_at is null) n
              from public.shift_debts d where d.branch_id = p_branch and trim(coalesce(d.table_name, '')) <> ''
               and (d.closed_at is null or d.grp <> 'khach') group by lower(trim(d.table_name))) p), '[]'),
    'open_debts', coalesce((select jsonb_agg(jsonb_build_object('id', 'd:' || d.id, 'who', d.table_name, 'kind', coalesce(d.kind, 'bill'), 'amount', d.amount, 'left', d.amount,
        'date', coalesce(x.work_date, left(d.created_at, 10)),
        'from', case when x.id is not null then 'ca ' || x.shift || ' ' || to_char(x.work_date::date, 'DD/MM') else 'quản lý ghi' end,
        'no_remind', coalesce(d.family, 0) = 1 or coalesce(d.grp, 'khach') <> 'khach') order by coalesce(x.work_date, left(d.created_at, 10)))
      from public.shift_debts d left join public.shift_reports x on x.id = d.report_id
     where d.branch_id = p_branch and d.closed_at is null and d.amount > 0
       and not exists (select 1 from public.shift_debts z where z.split_from = d.id)), '[]'),
    'compare', jsonb_build_object(
       'fund_days', coalesce((select jsonb_agg(jsonb_build_object('date', q.d, 'tm', q.tm, 'ck', q.ck) order by q.d)
          from (select o.d,
                       coalesce((select f.amount from public.fund_openings f where f.branch_id = p_branch and f.method = 'tien_mat'), 0) + sum(coalesce(o.tm, 0)) over w tm,
                       coalesce((select f.amount from public.fund_openings f where f.branch_id = p_branch and f.method = 'chuyen_khoan'), 0) + sum(coalesce(o.ck, 0)) over w ck
                  from oldf o window w as (order by o.d rows between unbounded preceding and current row)) q
         where q.d >= d0), '[]'),
       'gaps', coalesce((select jsonb_agg(jsonb_build_object('ca_id', gs.report_id, 'pm', case when gs.item = 'tien_mat' then 'tm' else 'ck' end, 'lech', gs.lech, 'state', gs.state)) from gs), '[]'))
  ) into res;
  return res;
end $function$;

CREATE OR REPLACE FUNCTION public.app_stc_ds_close(p_report bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.shift_reports; s jsonb; m jsonb; it text; v bigint; res text;
begin
  r := public.app__stc_ds_need(p_report, true);
  s := public.app__stc_ds_state(p_report);
  -- bước 173: số sửa (máy Fabi ghi sai) đang chờ Chủ duyệt / bị Chủ từ chối → chưa xác nhận được
  if exists (select 1 from public.stc_fix_requests q where q.report_id = p_report and q.status = 'cho') then
    raise exception 'Còn số sửa chờ Chủ duyệt — Chủ duyệt xong mới xác nhận.';
  end if;
  if exists (select 1 from (select distinct on (q.field) q.status from public.stc_fix_requests q where q.report_id = p_report order by q.field, q.id desc) z where z.status = 'tu_choi') then
    raise exception 'Chủ đã từ chối số sửa — sửa lại số hoặc bấm "Bỏ sửa, lấy số máy Fabi" rồi mới xác nhận.';
  end if;
  if not (s ->> 'has_fabi')::boolean or not (s ->> 'kt_ready')::boolean then raise exception 'Chờ kế toán (file Fabi / số ngân hàng) rồi mới xác nhận.'; end if;
  if not ((s ->> 'mo1')::boolean and (s ->> 'mo2')::boolean and (s ->> 'dt')::boolean and (s ->> 'no')::boolean) then
    raise exception 'Còn ô đỏ ở ① (tiền mở ca / doanh thu / nợ) — sửa xong mới xác nhận.';
  end if;
  if (s ->> 'need_tm')::boolean then raise exception 'Nhập tiền mặt thực nhận ở ② trước.'; end if;
  m := public.app__ca_money(p_report);
  foreach it in array array['tien_mat', 'chuyen_khoan'] loop
    v := (m ->> case it when 'tien_mat' then 'tm_left' else 'ck_left' end)::bigint;
    res := case when coalesce(v, 0) = 0 then 'khop' when v < 0 then 'thieu' else 'thua' end;
    if exists (select 1 from public.shift_report_results x where x.report_id = p_report and x.item = it
                 and ((x.result = res and coalesce(x.amount, 0) = abs(coalesce(v, 0))) or (x.result = 'khop' and abs(coalesce(v, 0)) <= 5000))) then continue; end if;
    perform public.app_ca_result_set(p_report, it, res, abs(coalesce(v, 0)), case when res = 'khop' then null else 'Xác nhận Fabi (Sổ thu chi) — lệch xử lý ở phiếu chênh lệch' end, '[]'::jsonb);
  end loop;
  -- bước 152 (137): Thời gian doanh thu + Doanh thu đã so với Fabi ở phần A → duyệt luôn (trang Đối soát ca không còn bước tiền)
  foreach it in array array['thoi_gian', 'doanh_thu'] loop
    if not exists (select 1 from public.shift_report_checks c where c.report_id = p_report and c.item = it) then
      perform public.app_ca_check(p_report, it, true);
    end if;
  end loop;
  -- bước 152: trang Đối soát ca không còn phần tiền → Thu chi / Công nợ coi như khớp khi xác nhận Fabi (lệch xử lý ở Sổ thu chi, Chốt ca khoá)
  foreach it in array array['thu_chi', 'cong_no'] loop
    if not exists (select 1 from public.shift_report_results x where x.report_id = p_report and x.item = it) then
      perform public.app_ca_result_set(p_report, it, 'khop', 0, null, '[]'::jsonb);
    end if;
  end loop;
  -- bước 171: Hoàn thành đối soát do app_stc_ds_done (bấm ở bước 6), không tự làm ở đây   -- xong cả phần việc thì tự Hoàn thành đối soát
  -- chặng 6.5: ca đã bấm Hoàn thành từ trước (lúc còn thiếu dấu Thu chi / Công nợ) → xác nhận xong thì tự Hoàn thành đối soát
  if exists (select 1 from public.stc_ca_done dn where dn.report_id = p_report) then
    perform public.app__ca_auto_finish(p_report, (public.app_account()).id);
  end if;
  perform public.app_log('stc_chot_tien_ca', 'report=' || p_report);
  return jsonb_build_object('tm', (m ->> 'tm_left')::bigint, 'ck', (m ->> 'ck_left')::bigint);
end $function$;

insert into public.app_migrations(file) values ('167_xac_nhan_du_4_muc.sql') on conflict (file) do nothing;
