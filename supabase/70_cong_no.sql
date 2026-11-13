-- Bước 70 (anh Tiến chốt 13/11): mục CÔNG NỢ ở Thu chi
--   * Cho vay mở cho MỌI cơ sở đang hoạt động.
--   * Trả hộ Kho tổng (cơ sở trong cài đặt "tra_ho_co_so", mặc định LHP) = khoản Kho tổng nợ, cộng chung với tiền vay (branch_loans.kind = 'tra_ho'),
--     người vay luôn là "Kho tổng" (tự tạo nếu chưa có); không tính chi phí, Sổ quỹ ghi "Trả hộ Kho tổng".
--   * Khách nợ: quản lý ghi thêm ở Công nợ (không thuộc ca nào: report_id trống) với tên + SĐT; hiện ở mọi phiếu chốt ca sau để thu.
--     Thu một phần: tách khoản (phần đã thu đóng ở ca này, phần còn lại vẫn mở, cùng ca gốc → nợ phát sinh của ca gốc không đổi);
--     bỏ đánh dấu thì gộp lại.
-- Chạy lại nhiều lần không sao.

alter table public.shift_debts alter column report_id drop not null;
alter table public.shift_debts add column if not exists phone text;
alter table public.shift_debts add column if not exists split_from bigint;
alter table public.branch_loans add column if not exists kind text not null default 'vay';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'branch_loans_kind_ck') then
    alter table public.branch_loans add constraint branch_loans_kind_ck check (kind in ('vay', 'tra_ho'));
  end if;
end $$;

insert into public.loan_people(name, phone, note, active)
select 'Kho tổng', '', 'Tự tạo: khoản trả hộ Kho tổng', 1
 where not exists (select 1 from public.loan_people where lower(trim(name)) = 'kho tổng');

create or replace function public.app__kho_tong() returns bigint
language sql stable security definer set search_path = public as $$
  select id from public.loan_people where lower(trim(name)) = 'kho tổng' order by id limit 1
$$;

create or replace function public.app__tra_ho_ok(p_branch bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.branches b where b.id = p_branch
                  and upper(coalesce(b.display_code, b.code)) = any(string_to_array(upper(replace(coalesce(public.app__fund_set('tra_ho_co_so'), 'LHP'), ' ', '')), ',')))
$$;

-- Cho vay: mọi cơ sở đang hoạt động
create or replace function public.app__loan_branch_ok(p_branch bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.branches b where b.id = p_branch and b.status = 'Đang hoạt động')
$$;

-- Khách nợ của cơ sở (cho mục Công nợ ở Thu chi): còn nợ + đã thu gần đây
create or replace function public.app_cn_debts(p_branch bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__tc_need(p_branch);
  return jsonb_build_object('can_edit', public.app__cn_can(p_branch),
    'open', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.table_name, 'phone', d.phone, 'amount', d.amount, 'note', d.note,
              'date', coalesce(o.work_date, left(d.created_at, 10)), 'shift', o.shift, 'report_id', d.report_id, 'by_ql', d.report_id is null,
              'by', public.app__acc_name(d.created_by), 'split', d.split_from is not null,
              'paid_before', coalesce((select sum(x.amount) from public.shift_debts x where x.closed_at is not null and (x.id = d.split_from or x.split_from = d.split_from) and d.split_from is not null), 0))
              order by coalesce(o.work_date, left(d.created_at, 10)), d.id)
            from public.shift_debts d left join public.shift_reports o on o.id = d.report_id
           where d.branch_id = p_branch and d.closed_at is null and coalesce(d.kind, 'bill') <> 'muon'
             and (d.report_id is null or o.status = 'hoan_thanh')), '[]'));
end $$;

create or replace function public.app__cn_can(p_branch bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app__fin_admin(), false)
      or (coalesce((select a.system_role = 'ql' from public.accounts a where a.id = (public.app_account()).id), false) and coalesce(public.app__tc_can(p_branch), false))
$$;

-- Quản lý ghi / sửa / xoá khách nợ ngoài ca (chưa thu)
create or replace function public.app_cn_debt_save(p_id bigint, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; br bigint := nullif(p ->> 'branch_id', '')::bigint; nm text := trim(coalesce(p ->> 'name', ''));
        ph text := trim(coalesce(p ->> 'phone', '')); amt bigint := nullif(p ->> 'amount', '')::bigint; nt text := trim(coalesce(p ->> 'note', ''));
        d text := coalesce(nullif(p ->> 'date', ''), left(public.vn_now_text(), 10)); old public.shift_debts; nid bigint;
begin
  if p_id is not null then
    select * into old from public.shift_debts where id = p_id;
    if old.id is null then raise exception 'Không tìm thấy khoản nợ.'; end if;
    if old.report_id is not null then raise exception 'Khoản nợ này ghi ở phiếu ca — sửa ở phiếu ca.'; end if;
    if old.closed_at is not null then raise exception 'Khoản nợ đã thu — không sửa được.'; end if;
    br := old.branch_id;
  end if;
  a := public.app__tc_need(br);
  if not public.app__cn_can(br) then raise exception 'Bạn không được ghi công nợ của cơ sở này.'; end if;
  if nm = '' then raise exception 'Ghi tên khách nợ.'; end if;
  if amt is null or amt <= 0 then raise exception 'Nhập số tiền nợ lớn hơn 0.'; end if;
  if d !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Ngày không hợp lệ.'; end if;
  if p_id is null then
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind)
    values (br, null, nm, amt, nt, nullif(ph, ''), a.id, d || substr(public.vn_now_text(), 11), 'bill') returning id into nid;
  else
    update public.shift_debts set table_name = nm, amount = amt, note = nt, phone = nullif(ph, '') where id = p_id; nid := p_id;
  end if;
  perform public.app_log(case when p_id is null then 'khach_no_them' else 'khach_no_sua' end, 'debt=' || nid || ' ' || amt || ' ' || nm);
  return nid;
end $$;

create or replace function public.app_cn_debt_delete(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare old public.shift_debts;
begin
  select * into old from public.shift_debts where id = p_id;
  if old.id is null then raise exception 'Không tìm thấy khoản nợ.'; end if;
  perform public.app__tc_need(old.branch_id);
  if not public.app__cn_can(old.branch_id) then raise exception 'Bạn không được sửa công nợ của cơ sở này.'; end if;
  if old.report_id is not null then raise exception 'Khoản nợ này ghi ở phiếu ca — xoá ở phiếu ca.'; end if;
  if old.closed_at is not null then raise exception 'Khoản nợ đã thu — không xoá được.'; end if;
  delete from public.shift_debts where id = p_id;
  perform public.app_log('khach_no_xoa', 'debt=' || p_id || ' ' || old.amount || ' ' || old.table_name);
end $$;

-- Thu một phần ở phiếu chốt ca: phần đã thu đóng ở ca này, phần còn lại tách thành khoản mới vẫn mở
create or replace function public.app_ca_debt_collect_part(p_debt bigint, p_report bigint, p_kind text, p_amount bigint, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare d public.shift_debts;
begin
  select * into d from public.shift_debts where id = p_debt for update;
  if d.id is null or d.closed_at is not null then raise exception 'Khoản nợ này đã được thu hoặc không còn.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nhập số tiền khách trả lớn hơn 0.'; end if;
  if p_amount > d.amount then raise exception 'Khách trả nhiều hơn số nợ (%).', public.app__vnd(d.amount); end if;
  if p_amount < d.amount then
    perform public.app__ca_need_edit(p_report);
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, split_from)
    values (d.branch_id, d.report_id, d.table_name, d.amount - p_amount, d.note, d.phone, d.created_by, d.created_at, d.kind, d.id);
    update public.shift_debts set amount = p_amount where id = d.id;
  end if;
  perform public.app_ca_debt_collect(p_debt, p_report, p_kind, coalesce(nullif(trim(coalesce(p_note, '')), ''), case when p_amount < d.amount then 'Thu một phần' else 'Đã thu' end));
end $$;


-- Thay bản đang chạy (lấy từ máy chủ 13/11)
CREATE OR REPLACE FUNCTION public.app_ca_get(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; prev public.shift_reports; prev_shift text; b public.branches; out jsonb; pe jsonb;
        h jsonb; ds boolean := public.app_can('doi_soat'); hide_prev boolean; hide_own boolean := false; nx public.shift_reports; ns text;
begin
  a := public.app__need('chot_ca');
  select * into r from public.shift_reports where id = p_id;
  if r.id is null then raise exception 'Không tìm thấy phiếu chốt ca.'; end if;
  select * into b from public.branches where id = r.branch_id;
  prev_shift := public.app__ca_prev_shift(r.shift);
  if prev_shift is not null then
    select * into prev from public.shift_reports where branch_id = r.branch_id and work_date = r.work_date and shift = prev_shift;
    if prev.id is not null then pe := public.app__ca_eff(prev.id); end if;
  end if;
  h := public.app__ca_hand(r.id);
  -- chưa đếm nhận két → không cho nhân viên thấy số két ca trước khai
  hide_prev := false;   -- bước 41: bỏ đếm mù, không ẩn số két ca trước
  if h is not null and hide_prev then h := h || jsonb_build_object('prev_cash', null, 'gap', null, 'hidden', true); end if;
  -- phiếu đã hoàn thành mà ca sau chưa đếm nhận két → giấu số két (và ảnh phiếu iPOS) với người khác
  ns := public.app__ca_next_shift(r.shift);
  if r.status = 'hoan_thanh' and not ds and coalesce(r.completed_by, -1) <> a.id and ns is not null then
    select * into nx from public.shift_reports where branch_id = r.branch_id and work_date = r.work_date and shift = ns;
    hide_own := false;   -- bước 41
  end if;
  out := to_jsonb(r) || jsonb_build_object(
    'branch_code', coalesce(b.display_code, b.code), 'branch_name', b.name,
    'first_shift', (public.app__shifts())[1], 'second_shift', (public.app__shifts())[2],
    'created_by_name', public.app__acc_name(r.created_by), 'completed_by_name', public.app__acc_name(r.completed_by),
    'recon_by_name', public.app__acc_name(r.recon_by), 'updated_by_name', public.app__acc_name(r.updated_by),
    'prev', case when prev_shift is null then null else jsonb_build_object(
        'shift', prev_shift, 'id', prev.id, 'status', prev.status,
        'cash_counted', case when hide_prev then null when prev.status = 'hoan_thanh' then (pe ->> 'cash_counted')::bigint else prev.cash_counted end,
        'rev_end', case when prev.status = 'hoan_thanh' then pe ->> 'rev_end' else prev.rev_end end) end,
    'cash_hand', h,
    'moves', coalesce((select jsonb_agg(to_jsonb(m) order by m.sort_order, m.id) from public.shift_report_moves m where m.report_id = r.id), '[]'),
    'staff', coalesce((select jsonb_agg(to_jsonb(s) || jsonb_build_object('code', e.code, 'name', e.name, 'rank', e.rank, 'pay_cash', e.pay_cash)
                         order by s.source, e.code) from public.shift_report_staff s join public.employees e on e.id = s.employee_id
                        where s.report_id = r.id), '[]'),
    'handover', coalesce((select jsonb_agg(to_jsonb(h2) || jsonb_build_object('created_by_name', public.app__acc_name(h2.created_by)) order by h2.id)
                            from public.handover_items h2 where h2.report_id = r.id), '[]'),
    'carried', coalesce((select jsonb_agg(to_jsonb(h2) || jsonb_build_object(
                            'created_by_name', public.app__acc_name(h2.created_by), 'done_by_name', public.app__acc_name(h2.done_by),
                            'from_date', o.work_date, 'from_shift', o.shift) order by o.work_date, h2.id)
                           from public.handover_items h2 join public.shift_reports o on o.id = h2.report_id
                          where h2.branch_id = r.branch_id and h2.report_id <> r.id
                            and (o.work_date, array_position(public.app__shifts(), o.shift)) < (r.work_date, array_position(public.app__shifts(), r.shift))
                            and (h2.done_at is null or h2.done_report_id = r.id)), '[]'),
    'goods', coalesce((select jsonb_agg(to_jsonb(g) order by g.id) from public.shift_report_goods g where g.report_id = r.id), '[]'),
    'photos', coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.shift_report_photos p
                         where p.report_id = r.id and not (hide_own and p.kind = 'ipos')), '[]'),
    'debts', coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from public.shift_debts d where d.report_id = r.id), '[]'),
    'open_debts', coalesce((select jsonb_agg(to_jsonb(d) || jsonb_build_object('from_date', coalesce(o.work_date, left(d.created_at, 10)), 'from_shift', o.shift, 'by_ql', d.report_id is null, 'created_name', public.app__acc_name(d.created_by),
                            'closed_by_name', public.app__acc_name(d.closed_by)) order by d.id)
                           from public.shift_debts d left join public.shift_reports o on o.id = d.report_id
                          where d.branch_id = r.branch_id and coalesce(d.report_id, 0) <> r.id
                            and (d.report_id is null or (o.work_date, array_position(public.app__shifts(), o.shift)) < (r.work_date, array_position(public.app__shifts(), r.shift)))
                            and (d.closed_at is null or d.closed_report_id = r.id)), '[]'),
    'checks', coalesce((select jsonb_object_agg(c.item, jsonb_build_object('by', public.app__acc_name(c.checked_by), 'at', c.checked_at))
                          from public.shift_report_checks c where c.report_id = r.id), '{}'),
    'check_items', to_jsonb(public.app__ca_check_items()),
    'money_items', to_jsonb(public.app__ca_money_items()),
    'results', coalesce((select jsonb_object_agg(x.item, jsonb_build_object('result', x.result, 'amount', x.amount, 'computed', x.computed, 'basis', x.basis,
                           'reason', x.reason, 'by', public.app__acc_name(x.by_account), 'at', x.at))
                          from public.shift_report_results x where x.report_id = r.id), '{}'),
    'shortfalls', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'item', s.item, 'employee_id', s.employee_id, 'employee', e.code || ' – ' || e.name,
                           'amount', s.amount, 'status', s.status, 'status_note', s.status_note, 'seen_at', s.seen_at, 'reply', s.reply) order by s.id)
                          from public.shift_shortfalls s join public.employees e on e.id = s.employee_id
                         where s.report_id = r.id and s.status <> 'huy'), '[]'),
    'money', case when r.status = 'hoan_thanh' and ds then public.app__ca_money(r.id) end,
    'forced_start', public.app__ca_forced_start(r),
    'tol', public.app__ca_tol(),
    'can_edit', r.status = 'dang_chot',
    'can_recon', ds and r.status = 'hoan_thanh',
    'can_reopen', public.app_can('mo_lai_phieu_ca') and r.status = 'hoan_thanh');
  if hide_own then out := out || jsonb_build_object('cash_counted', null, 'cash_hidden', true); end if;
  return out;
end $function$;

-- Thay bản đang chạy (lấy từ máy chủ 13/11)
CREATE OR REPLACE FUNCTION public.app_ca_debt_collect(p_debt bigint, p_report bigint, p_kind text, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts;
begin
  a := public.app_account();
  perform public.app__ca_need_edit(p_report);
  perform public.app__ca_part_guard(p_report, 'tien');
  if p_kind is null then
    update public.shift_debts set closed_at = null, closed_by = null, closed_report_id = null, close_note = null, collect_kind = null
     where id = p_debt and closed_report_id = p_report;
    if found then   -- bước 70: gộp lại phần còn lại tách ra khi thu một phần
      update public.shift_debts set amount = amount + coalesce((select sum(x.amount) from public.shift_debts x where x.split_from = p_debt and x.closed_at is null), 0) where id = p_debt;
      delete from public.shift_debts where split_from = p_debt and closed_at is null;
    end if;
    return;
  end if;
  if p_kind not in ('tien_mat', 'chuyen_khoan') then raise exception 'Chọn khách trả bằng tiền mặt hay chuyển khoản.'; end if;
  update public.shift_debts set closed_at = public.vn_now_text(), closed_by = a.id, closed_report_id = p_report,
         close_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Đã thu'), collect_kind = p_kind
   where id = p_debt and closed_at is null and coalesce(report_id, 0) <> p_report;
  if not found then raise exception 'Khoản nợ này đã được thu hoặc không thuộc ca trước.'; end if;
end $function$;

-- Thay bản đang chạy (lấy từ máy chủ 13/11)
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
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'phone', p.phone, 'note', p.note, 'active', p.active = 1,
                 'lent', coalesce(x.lent, 0), 'paid', coalesce(x.paid, 0), 'owe', coalesce(x.lent, 0) - coalesce(x.paid, 0)) order by (coalesce(x.lent, 0) - coalesce(x.paid, 0)) desc, p.name)
               from public.loan_people p
               left join lateral (select sum(l.amount) lent, (select coalesce(sum(y.amount), 0) from public.branch_loan_payments y join public.branch_loans l2 on l2.id = y.loan_id
                                                              where l2.person_id = p.id and l2.branch_id = p_branch) paid
                                    from public.branch_loans l where l.person_id = p.id and l.branch_id = p_branch) x on true), '[]'),
    'loans', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'kind', l.kind, 'person_id', l.person_id, 'person', p.name, 'date', l.loan_date, 'amount', l.amount, 'method', l.method, 'note', l.note,
                 'by', public.app__acc_name(l.created_by), 'locked', public.app__fin_locked(l.branch_id, l.loan_date),
                 'report_id', l.report_id, 'bank_out', exists (select 1 from public.shift_bank_outs o where o.loan_id = l.id), 'shift', (select x.shift from public.shift_reports x where x.id = l.report_id),
                 'paid', (select coalesce(sum(y.amount), 0) from public.branch_loan_payments y where y.loan_id = l.id),
                 'payments', coalesce((select jsonb_agg(jsonb_build_object('id', y.id, 'date', y.pay_date, 'amount', y.amount, 'method', y.method, 'note', y.note,
                                'by', public.app__acc_name(y.created_by), 'locked', public.app__fin_locked(l.branch_id, y.pay_date)) order by y.pay_date, y.id)
                              from public.branch_loan_payments y where y.loan_id = l.id), '[]')) order by l.loan_date desc, l.id desc)
               from public.branch_loans l join public.loan_people p on p.id = l.person_id where l.branch_id = p_branch), '[]'));
end $function$;

-- Thay bản đang chạy (lấy từ máy chủ 13/11)
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
    if (old.report_id is not null or exists (select 1 from public.shift_bank_outs o where o.loan_id = p_id)) and (d is distinct from old.loan_date or amt is distinct from old.amount or m is distinct from old.method) then
      raise exception 'Khoản vay này ghi từ phiếu ca / phiếu chi chuyển khoản — chỉ đổi người vay / ghi chú. Sai số tiền: xoá khoản vay (khoản trở lại Thu chi) rồi sửa.';
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

-- Thay bản đang chạy (lấy từ máy chủ 13/11)
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
  -- bước 64: cho vay (tiền ra khỏi quỹ) và người vay trả nợ (tiền về quỹ) — không tính chi phí / doanh thu
  return query
    select l.loan_date, l.method, 'cho_vay'::text, case when l.kind = 'tra_ho' then 'Trả hộ Kho tổng' else 'Cho vay: ' || p.name end || case when l.note <> '' then ' · ' || l.note else '' end,
           -l.amount, false, jsonb_build_object('loan_id', l.id)
      from public.branch_loans l join public.loan_people p on p.id = l.person_id
     where l.branch_id = p_branch and l.loan_date between f and p_to and l.report_id is null;   -- bước 65: khoản vay từ phiếu ca đã ra khỏi két trong ca
  return query
    select y.pay_date, y.method, 'tra_vay'::text, 'Trả nợ vay: ' || p.name || case when y.note <> '' then ' · ' || y.note else '' end,
           y.amount, false, jsonb_build_object('loan_id', l.id, 'payment_id', y.id)
      from public.branch_loan_payments y join public.branch_loans l on l.id = y.loan_id join public.loan_people p on p.id = l.person_id
     where l.branch_id = p_branch and y.pay_date between f and p_to;
end $function$;

-- Thay bản đang chạy (lấy từ máy chủ 13/11)
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
    from public.shift_debts d where d.branch_id = p_branch and d.closed_report_id is null and d.closed_at is null and coalesce(d.kind, 'bill') <> 'muon';

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


revoke execute on function public.app__kho_tong(), public.app__tra_ho_ok(bigint), public.app__cn_can(bigint) from public, anon, authenticated;
revoke execute on function public.app_cn_debts(bigint), public.app_cn_debt_save(bigint, jsonb), public.app_cn_debt_delete(bigint),
  public.app_ca_debt_collect_part(bigint, bigint, text, bigint, text) from public, anon;
grant execute on function public.app_cn_debts(bigint), public.app_cn_debt_save(bigint, jsonb), public.app_cn_debt_delete(bigint),
  public.app_ca_debt_collect_part(bigint, bigint, text, bigint, text) to authenticated;

insert into public.app_migrations(file) values ('70_cong_no.sql') on conflict (file) do nothing;
