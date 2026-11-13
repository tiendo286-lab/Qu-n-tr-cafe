-- Bước 81 (anh Tiến 13/11/2026): Công nợ gia đình — người vay có ô "Công nợ gia đình" (Chủ / QL tổng bật ở Cài đặt › Người vay;
-- cuối tháng mới thu, không nhắc khi chốt ca). Trong Thu chi › Công nợ, quản lý bấm "Chuyển sang gia đình" ở một khoản Nợ TM / Nợ HĐ
-- → khoản đó thành khoản cho vay của người gia đình (không trừ Sổ quỹ lần nữa vì tiền đã ra khỏi két trong ca), khoản nợ ca đóng lại
-- (collect_kind 'gia_dinh'). Xoá khoản cho vay đó = hoàn tác, khoản nợ ca mở lại. Chạy lại nhiều lần không sao.

alter table public.loan_people add column if not exists family int not null default 0;
alter table public.branch_loans add column if not exists from_debt bigint;
alter table public.shift_debts drop constraint if exists shift_debts_collect_kind_check;
alter table public.shift_debts add constraint shift_debts_collect_kind_check check (collect_kind is null or collect_kind in ('tien_mat', 'chuyen_khoan', 'gia_dinh'));

drop function if exists public.app_loan_person_save(bigint, text, text, text, boolean);
create or replace function public.app_loan_person_save(p_id bigint, p_name text, p_phone text, p_note text, p_active boolean, p_family boolean default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare nid bigint; nm text := trim(coalesce(p_name, ''));
begin
  if not public.app__fin_admin() then raise exception 'Chỉ Chủ và Quản lý tổng khai báo người vay.'; end if;
  if nm = '' then raise exception 'Nhập tên người vay.'; end if;
  if p_id is null then
    insert into public.loan_people(name, phone, note, family) values (nm, nullif(trim(coalesce(p_phone, '')), ''), nullif(trim(coalesce(p_note, '')), ''),
           case when coalesce(p_family, false) then 1 else 0 end) returning id into nid;
  else
    update public.loan_people set name = nm, phone = nullif(trim(coalesce(p_phone, '')), ''), note = nullif(trim(coalesce(p_note, '')), ''),
           active = case when coalesce(p_active, true) then 1 else 0 end,
           family = case when p_family is null then family when p_family then 1 else 0 end where id = p_id returning id into nid;
    if nid is null then raise exception 'Không tìm thấy người vay.'; end if;
  end if;
  perform public.app_log('nguoi_vay', 'id=' || nid || ' ' || nm || case when coalesce(p_family, false) then ' (gia đình)' else '' end);
  return nid;
end $$;
revoke all on function public.app_loan_person_save(bigint, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.app_loan_person_save(bigint, text, text, text, boolean, boolean) to authenticated;

create or replace function public.app_cn_debt_to_family(p_id bigint, p_person bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare d public.shift_debts; o public.shift_reports; a public.accounts; dt text; nid bigint;
begin
  select * into d from public.shift_debts where id = p_id;
  if d.id is null then raise exception 'Không tìm thấy khoản nợ.'; end if;
  a := public.app__tc_need(d.branch_id);
  if not coalesce(public.app__cn_can(d.branch_id), false) then raise exception 'Bạn không có quyền chuyển khoản nợ này.'; end if;
  if d.closed_at is not null then raise exception 'Khoản nợ này đã trả / đã chuyển rồi.'; end if;
  if d.report_id is not null then
    select * into o from public.shift_reports where id = d.report_id;
    if coalesce(o.status, '') <> 'hoan_thanh' then raise exception 'Phiếu ca của khoản nợ này chưa hoàn thành.'; end if;
  end if;
  if not exists (select 1 from public.loan_people p where p.id = p_person and p.active = 1 and p.family = 1) then
    raise exception 'Chọn người trong Công nợ gia đình (Chủ / Quản lý tổng bật ở Cài đặt › Người vay).';
  end if;
  dt := coalesce(o.work_date, (select x.work_date from public.shift_reports x where x.id = d.gap_report), left(d.created_at, 10));
  if public.app__fin_locked(d.branch_id, dt) then raise exception 'Tháng của khoản nợ này đã CHỐT nên không chuyển được.'; end if;
  insert into public.branch_loans(branch_id, person_id, loan_date, amount, method, note, created_by, kind, report_id, from_debt)
  values (d.branch_id, p_person, dt, d.amount, 'tien_mat',
          case when d.kind = 'muon' then 'Nợ TM – ' else 'Nợ HĐ – ' end || d.table_name || coalesce(' · ' || nullif(d.note, ''), ''),
          a.id, 'vay', coalesce(d.report_id, d.gap_report), d.id) returning id into nid;
  update public.shift_debts set closed_at = public.vn_now_text(), closed_by = a.id, closed_report_id = null, collect_kind = 'gia_dinh',
         close_note = 'Chuyển sang công nợ gia đình' where id = d.id;
  perform public.app_log('no_sang_gia_dinh', 'debt=' || d.id || ' loan=' || nid || ' ' || d.amount);
  return nid;
end $$;
revoke all on function public.app_cn_debt_to_family(bigint, bigint) from public, anon;
grant execute on function public.app_cn_debt_to_family(bigint, bigint) to authenticated;

CREATE OR REPLACE FUNCTION public.app_loan_people()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.app__need(null);
  if not (public.app_can('doi_soat') or public.app_can('chot_thang')) then raise exception 'Bạn không có quyền thực hiện thao tác này.'; end if;
  return jsonb_build_object('can_edit', public.app__fin_admin(), 'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'phone', p.phone, 'note', p.note, 'active', p.active = 1, 'family', p.family = 1,
           'used', exists (select 1 from public.branch_loans l where l.person_id = p.id)) order by p.active desc, p.name) from public.loan_people p), '[]'));
end $function$;

CREATE OR REPLACE FUNCTION public.app_loans(p_branch bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.app__tc_need(p_branch);
  if not public.app__loan_branch_ok(p_branch) then return jsonb_build_object('enabled', false); end if;
  return jsonb_build_object('enabled', true, 'can_people', public.app__fin_admin(), 'kho_tong_id', public.app__kho_tong(), 'tra_ho_ok', public.app__tra_ho_ok(p_branch),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'phone', p.phone, 'note', p.note, 'active', p.active = 1, 'family', p.family = 1,
                 'lent', coalesce(x.lent, 0), 'paid', coalesce(x.paid, 0), 'owe', coalesce(x.lent, 0) - coalesce(x.paid, 0)) order by (coalesce(x.lent, 0) - coalesce(x.paid, 0)) desc, p.name)
               from public.loan_people p
               left join lateral (select sum(l.amount) lent, (select coalesce(sum(y.amount), 0) from public.branch_loan_payments y join public.branch_loans l2 on l2.id = y.loan_id
                                                              where l2.person_id = p.id and l2.branch_id = p_branch) paid
                                    from public.branch_loans l where l.person_id = p.id and l.branch_id = p_branch) x on true), '[]'),
    'loans', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'kind', l.kind, 'person_id', l.person_id, 'person', p.name, 'date', l.loan_date, 'amount', l.amount, 'method', l.method, 'note', l.note,
                 'by', public.app__acc_name(l.created_by), 'locked', public.app__fin_locked(l.branch_id, l.loan_date),
                 'report_id', l.report_id, 'from_debt', l.from_debt, 'bank_out', exists (select 1 from public.shift_bank_outs o where o.loan_id = l.id), 'shift', (select x.shift from public.shift_reports x where x.id = l.report_id),
                 'paid', (select coalesce(sum(y.amount), 0) from public.branch_loan_payments y where y.loan_id = l.id),
                 'payments', coalesce((select jsonb_agg(jsonb_build_object('id', y.id, 'date', y.pay_date, 'amount', y.amount, 'method', y.method, 'note', y.note,
                                'by', public.app__acc_name(y.created_by), 'locked', public.app__fin_locked(l.branch_id, y.pay_date)) order by y.pay_date, y.id)
                              from public.branch_loan_payments y where y.loan_id = l.id), '[]')) order by l.loan_date desc, l.id desc)
               from public.branch_loans l join public.loan_people p on p.id = l.person_id where l.branch_id = p_branch), '[]'));
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

CREATE OR REPLACE FUNCTION public.app_loan_delete(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.branch_loans; o public.shift_bank_outs; fe bigint;
begin
  select * into l from public.branch_loans where id = p_id;
  if l.id is null then return; end if;
  perform public.app__tc_need(l.branch_id);
  if exists (select 1 from public.branch_loan_payments where loan_id = p_id) then raise exception 'Khoản vay đã có lần trả nợ — xoá các lần trả trước.'; end if;
  if public.app__fin_locked(l.branch_id, l.loan_date) then raise exception 'Tháng của khoản vay này đã CHỐT nên không xoá được.'; end if;
  select * into o from public.shift_bank_outs where loan_id = p_id;
  if o.id is not null then
    insert into public.fin_entries(branch_id, entry_date, kind, category_id, amount, note, pay_method, created_by, updated_by)
    values (l.branch_id, l.loan_date, 'chi', coalesce(o.category_id, (select id from public.fin_categories where kind = 'chi' and active = 1 order by sort_order desc limit 1)),
            l.amount, l.note, 'chuyen_khoan', (public.app_account()).id, (public.app_account()).id) returning id into fe;
    update public.shift_bank_outs set loan_id = null, fin_entry_id = fe where id = o.id;
  end if;
  delete from public.branch_loans where id = p_id;
  if l.from_debt is not null then   -- bước 81: hoàn tác "chuyển sang công nợ gia đình" → khoản nợ ca mở lại
    update public.shift_debts set closed_at = null, closed_by = null, closed_report_id = null, collect_kind = null, close_note = null
     where id = l.from_debt and collect_kind = 'gia_dinh';
  end if;
  if l.report_id is not null then delete from public.fin_move_cats where report_id = l.report_id and mkey = l.mkey; end if;
  perform public.app_log('cho_vay_xoa', 'loan=' || p_id || case when l.report_id is not null then ' (trả lại Thu chi phiếu ' || l.report_id || ')' else '' end);
end $function$;

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
end $function$;

insert into public.app_migrations(file) values ('81_cong_no_gia_dinh.sql') on conflict (file) do nothing;
