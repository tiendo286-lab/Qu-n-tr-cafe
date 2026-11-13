-- Bước 85 (anh Tiến 13/11/2026): BỎ mục Người vay / Cho vay — mọi khoản người khác nợ quán là Nợ HĐ / Nợ TM / Nợ CK.
--  * Khoản cho vay còn nợ → Nợ TM (vay tiền mặt) / Nợ CK (vay chuyển khoản), giữ tên, ngày, số còn nợ; người nhà → đánh dấu Công nợ gia đình.
--    Khoản cho vay cũ GIỮ trong lịch sử (Sổ quỹ các tháng trước không đổi); không tạo khoản cho vay mới nữa.
--  * Công nợ: quản lý đánh dấu / bỏ "Gia đình" (phiếu chốt ca không nhắc), bấm "Đã thu" khi khách / người nhà trả ngoài ca (Sổ quỹ cộng vào),
--    ghi "+ Nợ TM / + Nợ CK" có ô "tiền đưa từ quỹ" (Sổ quỹ trừ ra, như cho vay trước đây).
-- Chạy lại nhiều lần không sao.

alter table public.shift_debts add column if not exists family int not null default 0;
alter table public.shift_debts add column if not exists from_loan bigint;
alter table public.shift_debts add column if not exists fund_out int not null default 0;
alter table public.branch_loans add column if not exists to_debt bigint;

-- chuyển khoản cho vay còn nợ thành Nợ TM / Nợ CK (chỉ khoản chưa chuyển)
do $$ declare l record; rem bigint; nid bigint;
begin
  for l in select bl.*, p.name pname, p.phone pphone, p.family pfam from public.branch_loans bl join public.loan_people p on p.id = bl.person_id
            where bl.to_debt is null order by bl.id loop
    rem := l.amount - coalesce((select sum(x.amount) from public.branch_loan_payments x where x.loan_id = l.id), 0);
    if rem <= 0 then continue; end if;
    if l.from_debt is not null then   -- khoản vay sinh từ nợ ca (bước 83) → mở lại khoản nợ ca, đánh dấu gia đình
      update public.shift_debts set closed_at = null, closed_by = null, closed_report_id = null, collect_kind = null, close_note = null, family = 1
       where id = l.from_debt and collect_kind = 'gia_dinh';
      update public.branch_loans set to_debt = l.from_debt where id = l.id;
      continue;
    end if;
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, family, from_loan)
    values (l.branch_id, null, l.pname, rem,
            nullif(trim(coalesce(l.note, '') || case when l.kind = 'tra_ho' then ' (trả hộ Kho tổng)' else '' end), ''),
            l.pphone, l.created_by, l.loan_date || substr(coalesce(l.created_at, public.vn_now_text()), 11),
            case when l.method = 'chuyen_khoan' then 'ck' else 'muon' end, coalesce(l.pfam, 0), l.id)
    returning id into nid;
    update public.branch_loans set to_debt = nid where id = l.id;
  end loop;
end $$;

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
              'family', d.family = 1, 'fund_out', d.fund_out = 1, 'from_loan', d.from_loan is not null,
              'gap_ca', (select x.shift || ' ' || to_char(x.work_date::date, 'DD/MM') from public.shift_reports x where x.id = d.gap_report),
              'paid_before', coalesce((select sum(x.amount) from public.shift_debts x where x.closed_at is not null and (x.id = d.split_from or x.split_from = d.split_from) and d.split_from is not null), 0))
              order by coalesce(o.work_date, left(d.created_at, 10)), d.id)
            from public.shift_debts d left join public.shift_reports o on o.id = d.report_id
           where d.branch_id = p_branch and d.closed_at is null
             and (d.report_id is null or o.status = 'hoan_thanh')), '[]'),
    'thu', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'kind', coalesce(d.kind, 'bill'), 'name', d.table_name, 'amount', d.amount,
              'date', left(d.closed_at, 10), 'collect_kind', d.collect_kind, 'note', d.close_note, 'by', public.app__acc_name(d.closed_by),
              'locked', public.app__fin_locked(d.branch_id, left(d.closed_at, 10))) order by d.closed_at desc)
            from public.shift_debts d where d.branch_id = p_branch and d.closed_at is not null and d.closed_report_id is null
             and d.collect_kind in ('tien_mat', 'chuyen_khoan') and left(d.closed_at, 10) >= to_char(public.vn_now()::date - 45, 'YYYY-MM-DD')), '[]'));
end $function$;

CREATE OR REPLACE FUNCTION public.app_cn_debt_save(p_id bigint, p jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; br bigint := nullif(p ->> 'branch_id', '')::bigint; nm text := trim(coalesce(p ->> 'name', ''));
        ph text := trim(coalesce(p ->> 'phone', '')); amt bigint := nullif(p ->> 'amount', '')::bigint; nt text := trim(coalesce(p ->> 'note', ''));
        d text := coalesce(nullif(p ->> 'date', ''), left(public.vn_now_text(), 10)); old public.shift_debts; nid bigint;
        k text := case when p ->> 'kind' in ('muon', 'ck') then p ->> 'kind' else 'bill' end;
        fam int := case when coalesce((p ->> 'family')::boolean, false) then 1 else 0 end;
        fo int := case when coalesce((p ->> 'fund_out')::boolean, false) and (case when p ->> 'kind' in ('muon', 'ck') then p ->> 'kind' else 'bill' end) <> 'bill' then 1 else 0 end;
begin
  if p_id is not null then
    select * into old from public.shift_debts where id = p_id;
    if old.id is null then raise exception 'Không tìm thấy khoản nợ.'; end if;
    if old.report_id is not null then raise exception 'Khoản nợ này ghi ở phiếu ca — sửa ở phiếu ca.'; end if;
    if old.closed_at is not null then raise exception 'Khoản nợ đã thu — không sửa được.'; end if;
    if old.from_loan is not null or old.split_from is not null or old.gap_report is not null then raise exception 'Khoản này không sửa được ở đây.'; end if;
    br := old.branch_id;
  end if;
  a := public.app__tc_need(br);
  if not public.app__cn_can(br) then raise exception 'Bạn không được ghi công nợ của cơ sở này.'; end if;
  if nm = '' then raise exception 'Ghi tên khách nợ.'; end if;
  if amt is null or amt <= 0 then raise exception 'Nhập số tiền nợ lớn hơn 0.'; end if;
  if d !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Ngày không hợp lệ.'; end if;
  if fo = 1 and public.app__fin_locked(br, coalesce(left(old.created_at, 10), d)) then raise exception 'Tháng này đã CHỐT — không ghi tiền ra quỹ được.'; end if;
  if p_id is null then
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, family, fund_out)
    values (br, null, nm, amt, nt, nullif(ph, ''), a.id, d || substr(public.vn_now_text(), 11), k, fam, fo) returning id into nid;
  else
    if old.fund_out = 1 and old.amount <> amt and public.app__fin_locked(br, left(old.created_at, 10)) then raise exception 'Tháng của khoản này đã CHỐT — không đổi số tiền được.'; end if;
    update public.shift_debts set table_name = nm, amount = amt, note = nt, phone = nullif(ph, ''), kind = k, family = fam,
           fund_out = case when public.app__fin_locked(br, left(old.created_at, 10)) then old.fund_out else fo end where id = p_id; nid := p_id;
  end if;
  perform public.app_log(case when p_id is null then 'khach_no_them' else 'khach_no_sua' end, 'debt=' || nid || ' ' || amt || ' ' || nm);
  return nid;
end $function$;

CREATE OR REPLACE FUNCTION public.app_ca_debt_collect_part(p_debt bigint, p_report bigint, p_kind text, p_amount bigint, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.shift_debts;
begin
  select * into d from public.shift_debts where id = p_debt for update;
  if d.id is null or d.closed_at is not null then raise exception 'Khoản nợ này đã được thu hoặc không còn.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nhập số tiền khách trả lớn hơn 0.'; end if;
  if p_amount > d.amount then raise exception 'Khách trả nhiều hơn số nợ (%).', public.app__vnd(d.amount); end if;
  if p_amount < d.amount then
    perform public.app__ca_need_edit(p_report);
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, split_from, gap_report, gap_item, family, from_loan, fund_out)
    values (d.branch_id, d.report_id, d.table_name, d.amount - p_amount, d.note, d.phone, d.created_by, d.created_at, d.kind, d.id, d.gap_report, d.gap_item, d.family, d.from_loan, d.fund_out);
    update public.shift_debts set amount = p_amount where id = d.id;
  end if;
  perform public.app_ca_debt_collect(p_debt, p_report, p_kind, coalesce(nullif(trim(coalesce(p_note, '')), ''), case when p_amount < d.amount then 'Thu một phần' else 'Đã thu' end));
end $function$;


-- đánh dấu / bỏ công nợ gia đình (phiếu chốt ca không nhắc khoản gia đình)
create or replace function public.app_cn_debt_family(p_id bigint, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare d public.shift_debts;
begin
  select * into d from public.shift_debts where id = p_id;
  if d.id is null then raise exception 'Không tìm thấy khoản nợ.'; end if;
  perform public.app__tc_need(d.branch_id);
  if not coalesce(public.app__cn_can(d.branch_id), false) then raise exception 'Bạn không được sửa công nợ của cơ sở này.'; end if;
  if d.closed_at is not null then raise exception 'Khoản nợ đã thu.'; end if;
  update public.shift_debts set family = case when coalesce(p_on, false) then 1 else 0 end where id = p_id;
  perform public.app_log('khach_no_gia_dinh', 'debt=' || p_id || ' ' || case when coalesce(p_on, false) then 'bật' else 'tắt' end);
end $$;
revoke all on function public.app_cn_debt_family(bigint, boolean) from public, anon;
grant execute on function public.app_cn_debt_family(bigint, boolean) to authenticated;

-- quản lý ghi "Đã thu" khi khách / người nhà trả ngoài ca (tiền mặt hoặc chuyển khoản) → Sổ quỹ cộng vào; trả một phần được
create or replace function public.app_cn_debt_collect(p_id bigint, p_date text, p_kind text, p_amount bigint, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; d public.shift_debts; dt text := coalesce(nullif(p_date, ''), left(public.vn_now_text(), 10));
begin
  select * into d from public.shift_debts where id = p_id;
  if d.id is null then raise exception 'Không tìm thấy khoản nợ.'; end if;
  a := public.app__tc_need(d.branch_id);
  if not coalesce(public.app__cn_can(d.branch_id), false) then raise exception 'Bạn không được thu công nợ của cơ sở này.'; end if;
  if d.closed_at is not null then raise exception 'Khoản nợ này đã thu rồi.'; end if;
  if coalesce(p_kind, '') not in ('tien_mat', 'chuyen_khoan') then raise exception 'Chọn tiền mặt hay chuyển khoản.'; end if;
  if dt !~ '^\d{4}-\d{2}-\d{2}$' or dt > left(public.vn_now_text(), 10) then raise exception 'Ngày thu không hợp lệ.'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > d.amount then raise exception 'Số tiền thu phải lớn hơn 0 và không quá %.', public.app__vnd(d.amount); end if;
  if public.app__fin_locked(d.branch_id, dt) then raise exception 'Tháng này đã CHỐT — không ghi thu được.'; end if;
  if p_amount < d.amount then
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, split_from, gap_report, gap_item, family, from_loan, fund_out)
    values (d.branch_id, d.report_id, d.table_name, d.amount - p_amount, d.note, d.phone, d.created_by, d.created_at, d.kind, d.id, d.gap_report, d.gap_item, d.family, d.from_loan, d.fund_out);
    update public.shift_debts set amount = p_amount where id = d.id;
  end if;
  update public.shift_debts set closed_at = dt || substr(public.vn_now_text(), 11), closed_by = a.id, closed_report_id = null, collect_kind = p_kind,
         close_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Quản lý thu') where id = d.id;
  perform public.app_log('khach_no_thu', 'debt=' || d.id || ' ' || p_amount || ' ' || p_kind);
end $$;
revoke all on function public.app_cn_debt_collect(bigint, text, text, bigint, text) from public, anon;
grant execute on function public.app_cn_debt_collect(bigint, text, text, bigint, text) to authenticated;

-- bỏ "Đã thu" (quản lý ghi nhầm) — tháng chưa chốt
create or replace function public.app_cn_debt_uncollect(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare d public.shift_debts;
begin
  select * into d from public.shift_debts where id = p_id;
  if d.id is null then raise exception 'Không tìm thấy khoản nợ.'; end if;
  perform public.app__tc_need(d.branch_id);
  if not coalesce(public.app__cn_can(d.branch_id), false) then raise exception 'Bạn không được sửa công nợ của cơ sở này.'; end if;
  if d.closed_at is null or d.closed_report_id is not null or coalesce(d.collect_kind, '') not in ('tien_mat', 'chuyen_khoan') then
    raise exception 'Chỉ bỏ được lần thu quản lý ghi ở Công nợ.';
  end if;
  if public.app__fin_locked(d.branch_id, left(d.closed_at, 10)) then raise exception 'Tháng này đã CHỐT — không bỏ được.'; end if;
  update public.shift_debts set closed_at = null, closed_by = null, collect_kind = null, close_note = null where id = p_id;
  perform public.app_log('khach_no_bo_thu', 'debt=' || p_id);
end $$;
revoke all on function public.app_cn_debt_uncollect(bigint) from public, anon;
grant execute on function public.app_cn_debt_uncollect(bigint) to authenticated;

CREATE OR REPLACE FUNCTION public.app__fund_rows(p_branch bigint, p_from text, p_to text)
 RETURNS TABLE(d text, method text, typ text, label text, amount bigint, auto boolean, ref jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare st text := public.app__fund_start(); fl bigint := coalesce(public.app__fund_set('fund_cash_float')::bigint, 1000000);
        f text := greatest(p_from, public.app__fund_start()); dd date;
begin
  if f > p_to then return; end if;
  for dd in select generate_series(f::date, p_to::date, interval '1 day')::date loop
    -- tiền mặt nộp quỹ cuối ngày
    return query
      select to_char(dd, 'YYYY-MM-DD'), 'tien_mat'::text, 'nop_quy'::text,
             case when v.cash_amount is not null then 'Nộp quỹ cuối ngày (quản lý sửa)'
                  else 'Nộp quỹ cuối ngày (' || coalesce(lc.src, 'đếm') || ' ' || public.app__vnd(lc.counted) || ' − để lại ' || public.app__vnd(fl) || ')' end,
             coalesce(v.cash_amount, lc.counted - fl), v.cash_amount is null,
             jsonb_build_object('counted', lc.counted, 'src', lc.src, 'note', v.cash_note)
        from (select 1) one
        left join lateral (select x.counted, x.src from public.app__fund_last_count(p_branch, to_char(dd, 'YYYY-MM-DD')) x) lc on true
        left join public.fund_day_values v on v.branch_id = p_branch and v.work_date = to_char(dd, 'YYYY-MM-DD')
       where coalesce(v.cash_amount, lc.counted - fl) is not null and coalesce(v.cash_amount, lc.counted - fl) <> 0;
    -- bước 72: luân chuyển quỹ tiền mặt ↔ tài khoản (không tính thu / chi)
    return query
      select t.tdate, m.method, 'luan_chuyen'::text,
             case when t.direction = 'tm_tk' then 'Luân chuyển: tiền mặt → tài khoản' else 'Luân chuyển: tài khoản → tiền mặt' end || case when t.note <> '' then ' · ' || t.note else '' end,
             case when (t.direction = 'tm_tk') = (m.method = 'tien_mat') then -t.amount else t.amount end, false, jsonb_build_object('transfer_id', t.id)
        from public.fund_transfers t cross join (values ('tien_mat'), ('chuyen_khoan')) m(method)
       where t.branch_id = p_branch and t.tdate = to_char(dd, 'YYYY-MM-DD');
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
     where e.branch_id = p_branch and e.entry_date between f and p_to and not coalesce(e.no_fund, false);   -- bước 71: quán chịu / thu khác (âm tiền) không đổi quỹ
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
  -- bước 64: cho vay (tiền ra khỏi quỹ) và người vay trả nợ (tiền về quỹ) — không tính chi phí / doanh thu
  return query
    select l.loan_date, l.method, 'cho_vay'::text, case when l.kind = 'tra_ho' then 'Trả hộ Kho tổng' else 'Cho vay: ' || p.name end || case when l.note <> '' then ' · ' || l.note else '' end,
           -l.amount, false, jsonb_build_object('loan_id', l.id)
      from public.branch_loans l join public.loan_people p on p.id = l.person_id
     where l.branch_id = p_branch and l.loan_date between f and p_to and l.report_id is null and l.from_debt is null;   -- bước 65: khoản vay từ phiếu ca đã ra khỏi két trong ca
  return query
    select y.pay_date, y.method, 'tra_vay'::text, 'Trả nợ vay: ' || p.name || case when y.note <> '' then ' · ' || y.note else '' end,
           y.amount, false, jsonb_build_object('loan_id', l.id, 'payment_id', y.id)
      from public.branch_loan_payments y join public.branch_loans l on l.id = y.loan_id join public.loan_people p on p.id = l.person_id
     where l.branch_id = p_branch and y.pay_date between f and p_to;
  -- bước 85: công nợ quản lý ghi có đưa tiền từ quỹ (Nợ TM / Nợ CK) và quản lý thu nợ ngoài ca
  return query
    select left(dd2.created_at, 10), case when dd2.kind = 'ck' then 'chuyen_khoan' else 'tien_mat' end, 'cho_vay'::text,
           (case when dd2.kind = 'ck' then 'Nợ CK: ' else 'Nợ TM: ' end) || dd2.table_name || case when coalesce(dd2.note, '') <> '' then ' · ' || dd2.note else '' end,
           -dd2.amount, false, jsonb_build_object('debt_id', dd2.id)
      from public.shift_debts dd2 where dd2.branch_id = p_branch and dd2.fund_out = 1 and dd2.report_id is null and left(dd2.created_at, 10) between f and p_to;
  return query
    select left(dd2.closed_at, 10), dd2.collect_kind, 'tra_vay'::text, 'Thu nợ: ' || dd2.table_name || case when coalesce(dd2.close_note, '') not in ('', 'Quản lý thu') then ' · ' || dd2.close_note else '' end,
           dd2.amount, false, jsonb_build_object('debt_id', dd2.id)
      from public.shift_debts dd2 where dd2.branch_id = p_branch and dd2.closed_at is not null and dd2.closed_report_id is null
       and dd2.collect_kind in ('tien_mat', 'chuyen_khoan') and left(dd2.closed_at, 10) between f and p_to;
end $function$;

CREATE OR REPLACE FUNCTION public.app_loan_save(p_id bigint, p jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; old public.branch_loans; br bigint := nullif(p ->> 'branch_id', '')::bigint; ps bigint := nullif(p ->> 'person_id', '')::bigint;
        d text := p ->> 'date'; amt bigint := nullif(p ->> 'amount', '')::bigint; m text := coalesce(nullif(p ->> 'method', ''), 'tien_mat'); nt text := trim(coalesce(p ->> 'note', '')); nid bigint; k text := coalesce(nullif(p ->> 'kind', ''), 'vay');
begin
  if p_id is null then raise exception 'Đã bỏ mục Người vay — ghi Nợ TM / Nợ CK ở Thu chi › Công nợ.'; end if;
  if p_id is not null then
    select * into old from public.branch_loans where id = p_id;
    if old.id is null then raise exception 'Không tìm thấy khoản vay.'; end if;
    br := old.branch_id; k := old.kind;
    if public.app__fin_locked(old.branch_id, old.loan_date) then raise exception 'Tháng của khoản vay này đã CHỐT nên không sửa được.'; end if;
  end if;
  a := public.app__tc_need(br);
  if not public.app__loan_branch_ok(br) then raise exception 'Cơ sở này chưa bật mục Cho vay.'; end if;
  if k not in ('vay', 'tra_ho') then raise exception 'Loại khoản không đúng.'; end if;
  if k = 'tra_ho' then
    if not public.app__tra_ho_ok(br) then raise exception 'Cơ sở này không dùng mục Trả hộ Kho tổng.'; end if;
    ps := public.app__kho_tong();
    if nt = '' then raise exception 'Ghi nội dung trả hộ (vd: tiền ga, ship hàng).'; end if;
  end if;
  if ps is null or not exists (select 1 from public.loan_people where id = ps and (active = 1 or ps = old.person_id)) then raise exception 'Chọn người vay (khai báo ở Cài đặt › Người vay).'; end if;
  if d is null or d !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Chọn ngày cho vay.'; end if;
  if amt is null or amt <= 0 then raise exception 'Nhập số tiền cho vay lớn hơn 0.'; end if;
  if m not in ('tien_mat', 'chuyen_khoan') then raise exception 'Chọn tiền mặt hay chuyển khoản.'; end if;
  if public.app__fin_locked(br, d) then raise exception 'Tháng này đã CHỐT nên không ghi khoản vay vào được.'; end if;
  if p_id is not null then
    if amt < (select coalesce(sum(amount), 0) from public.branch_loan_payments where loan_id = p_id) then
      raise exception 'Số tiền vay không được nhỏ hơn số đã trả (%).', public.app__vnd((select coalesce(sum(amount), 0) from public.branch_loan_payments where loan_id = p_id)::bigint);
    end if;
    if exists (select 1 from public.branch_loan_payments where loan_id = p_id and pay_date < d) then raise exception 'Ngày cho vay phải trước các lần trả nợ.'; end if;
    if (old.report_id is not null or old.from_debt is not null or exists (select 1 from public.shift_bank_outs o where o.loan_id = p_id)) and (d is distinct from old.loan_date or amt is distinct from old.amount or m is distinct from old.method) then
      raise exception 'Khoản vay này ghi từ phiếu ca / phiếu chi chuyển khoản — chỉ đổi người vay / ghi chú. Sai số tiền: xoá khoản vay (khoản trở lại Thu chi / Công nợ) rồi sửa.';
    end if;
  end if;
  if p_id is null then
    insert into public.branch_loans(branch_id, person_id, loan_date, amount, method, note, created_by, kind) values (br, ps, d, amt, m, nt, a.id, k) returning id into nid;
  else
    update public.branch_loans set person_id = ps, loan_date = d, amount = amt, method = m, note = nt where id = p_id; nid := p_id;
  end if;
  perform public.app_log(case when k = 'tra_ho' then 'tra_ho_kho_tong' when p_id is null then 'cho_vay' else 'cho_vay_sua' end, 'loan=' || nid || ' ' || amt);
  return nid;
end $function$;

CREATE OR REPLACE FUNCTION public.app_tc_to_loan(p jsonb, p_person bigint, p_note text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; e public.fin_entries; r public.shift_reports; m record; nid bigint; nt text := nullif(trim(coalesce(p_note, '')), '');
begin
  raise exception 'Đã bỏ mục Người vay — ghi Nợ TM / Nợ CK ở Thu chi › Công nợ.';
  if p_person is null or not exists (select 1 from public.loan_people where id = p_person and active = 1) then raise exception 'Chọn người vay (khai báo ở Cài đặt › Người vay).'; end if;
  if p ->> 'src' = 'tay' then
    select * into e from public.fin_entries where id = (p ->> 'id')::bigint for update;
    if e.id is null then raise exception 'Không tìm thấy khoản này. Tải lại trang.'; end if;
    if exists (select 1 from public.gap_decisions g where g.fin_entry_id = e.id) then raise exception 'Khoản này tạo từ tab Âm tiền — sửa / bỏ ở Quản lý ca › Âm tiền.'; end if;
    a := public.app__tc_need(e.branch_id);
    if not public.app__loan_branch_ok(e.branch_id) then raise exception 'Cơ sở này chưa bật mục Cho vay.'; end if;
    if public.app__fin_locked(e.branch_id, e.entry_date) then raise exception 'Khoản này thuộc tháng đã CHỐT nên không đổi được.'; end if;
    if e.kind <> 'chi' then raise exception 'Chỉ khoản CHI mới đổi thành cho vay được.'; end if;
    insert into public.branch_loans(branch_id, person_id, loan_date, amount, method, note, created_by)
    values (e.branch_id, p_person, e.entry_date, e.amount, e.pay_method, coalesce(nt, e.note), a.id) returning id into nid;
    -- bước 66: khoản từ phiếu chi chuyển khoản → phiếu chi giữ nguyên (tiền chuyển ra của ca không đổi), trỏ sang khoản vay
    update public.shift_bank_outs set loan_id = nid, fin_entry_id = null where fin_entry_id = e.id;
    delete from public.fin_entries where id = e.id;
    perform public.app_log('thu_chi_doi_cho_vay', 'entry=' || e.id || ' → loan=' || nid || ' ' || e.amount);
  elsif p ->> 'src' = 'ca' then
    select * into r from public.shift_reports where id = (p ->> 'report_id')::bigint for update;
    if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
    a := public.app__tc_need(r.branch_id);
    if not public.app__loan_branch_ok(r.branch_id) then raise exception 'Cơ sở này chưa bật mục Cho vay.'; end if;
    if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không đổi được.'; end if;
    select * into m from public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) x where x.report_id = r.id and x.mkey = p ->> 'mkey';
    if m.report_id is null then raise exception 'Khoản này vừa thay đổi. Tải lại trang.'; end if;
    if m.auto is not null then raise exception 'Khoản tự động (chi lương / khách mượn) không đổi thành cho vay được.'; end if;
    if m.amount >= 0 then raise exception 'Chỉ khoản CHI mới đổi thành cho vay được.'; end if;
    if exists (select 1 from public.branch_loans l where l.report_id = r.id and l.mkey = m.mkey) then raise exception 'Khoản này đã đổi thành cho vay rồi.'; end if;
    if public.app__tc_move_ka(r.id, m.mkey) then raise exception 'Khoản này đã gán âm tiền trừ lương — bỏ gán trước.'; end if;
    insert into public.branch_loans(branch_id, person_id, loan_date, amount, method, note, created_by, report_id, mkey)
    values (r.branch_id, p_person, r.work_date, -m.amount, m.pay, coalesce(nt, m.note), a.id, r.id, m.mkey) returning id into nid;
    insert into public.fin_move_cats(report_id, mkey, category_id, excluded, by_account, at, checked, checked_by, checked_at)
    values (r.id, m.mkey, null, 1, a.id, public.vn_now_text(), 1, a.id, public.vn_now_text())
    on conflict (report_id, mkey) do update set category_id = null, excluded = 1, by_account = excluded.by_account, at = excluded.at,
            checked = 1, checked_by = excluded.checked_by, checked_at = excluded.checked_at;
    perform public.app_log('thu_chi_doi_cho_vay', 'report=' || r.id || ' ' || m.note || ' → loan=' || nid || ' ' || -m.amount);
  else
    raise exception 'Khoản không hợp lệ.';
  end if;
  return nid;
end $function$;

insert into public.app_migrations(file) values ('83_bo_nguoi_vay.sql') on conflict (file) do nothing;
