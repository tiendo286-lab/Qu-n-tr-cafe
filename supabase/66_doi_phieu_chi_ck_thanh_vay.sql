-- =====================================================================
-- BƯỚC 66: ĐỔI PHIẾU CHI CHUYỂN KHOẢN THÀNH CHO VAY (anh Tiến chốt 13/11/2026 — "làm giống tiền mặt"). Chạy sau 65. Chạy lại không sao.
--  * Khoản "(chuyển khoản từ …, ca …)" tạo bằng nút Phiếu chi ở Đối soát ca: nút "Đổi thành cho vay" ở Thu chi như khoản khác.
--  * Phiếu chi GIỮ NGUYÊN → tiền chuyển ra của ca không đổi, ca không lệch, không phải đối soát lại. Khoản chi bỏ khỏi Thu chi,
--    thành khoản vay (chuyển khoản); Sổ quỹ trừ đúng 1 lần (dòng Cho vay thay dòng Chi).
--  * Khoản vay này chỉ đổi người vay / ghi chú. Xoá khoản vay → khoản chi trở lại Thu chi (nhóm cũ). Xoá phiếu chi ở Đối soát ca → xoá luôn
--    khoản vay (khi chưa có lần trả).
-- =====================================================================

alter table public.shift_bank_outs add column if not exists loan_id bigint references public.branch_loans(id) on delete set null;
create index if not exists ix_shift_bank_outs_loan on public.shift_bank_outs (loan_id) where loan_id is not null;

-- Thay bản 65
create or replace function public.app_tc_to_loan(p jsonb, p_person bigint, p_note text) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; e public.fin_entries; r public.shift_reports; m record; nid bigint; nt text := nullif(trim(coalesce(p_note, '')), '');
begin
  if p_person is null or not exists (select 1 from public.loan_people where id = p_person and active = 1) then raise exception 'Chọn người vay (khai báo ở Cài đặt › Người vay).'; end if;
  if p ->> 'src' = 'tay' then
    select * into e from public.fin_entries where id = (p ->> 'id')::bigint for update;
    if e.id is null then raise exception 'Không tìm thấy khoản này. Tải lại trang.'; end if;
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
end $$;

-- Thay bản 65
create or replace function public.app_loan_save(p_id bigint, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; old public.branch_loans; br bigint := nullif(p ->> 'branch_id', '')::bigint; ps bigint := nullif(p ->> 'person_id', '')::bigint;
        d text := p ->> 'date'; amt bigint := nullif(p ->> 'amount', '')::bigint; m text := coalesce(nullif(p ->> 'method', ''), 'tien_mat'); nt text := trim(coalesce(p ->> 'note', '')); nid bigint;
begin
  if p_id is not null then
    select * into old from public.branch_loans where id = p_id;
    if old.id is null then raise exception 'Không tìm thấy khoản vay.'; end if;
    br := old.branch_id;
    if public.app__fin_locked(old.branch_id, old.loan_date) then raise exception 'Tháng của khoản vay này đã CHỐT nên không sửa được.'; end if;
  end if;
  a := public.app__tc_need(br);
  if not public.app__loan_branch_ok(br) then raise exception 'Cơ sở này chưa bật mục Cho vay.'; end if;
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
    insert into public.branch_loans(branch_id, person_id, loan_date, amount, method, note, created_by) values (br, ps, d, amt, m, nt, a.id) returning id into nid;
  else
    update public.branch_loans set person_id = ps, loan_date = d, amount = amt, method = m, note = nt where id = p_id; nid := p_id;
  end if;
  perform public.app_log(case when p_id is null then 'cho_vay' else 'cho_vay_sua' end, 'loan=' || nid || ' ' || amt);
  return nid;
end $$;

-- Thay bản 65
create or replace function public.app_loan_delete(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
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
  if l.report_id is not null then delete from public.fin_move_cats where report_id = l.report_id and mkey = l.mkey; end if;
  perform public.app_log('cho_vay_xoa', 'loan=' || p_id || case when l.report_id is not null then ' (trả lại Thu chi phiếu ' || l.report_id || ')' else '' end);
end $$;

-- Thay bản 65
create or replace function public.app_loans(p_branch bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__tc_need(p_branch);
  if not public.app__loan_branch_ok(p_branch) then return jsonb_build_object('enabled', false); end if;
  return jsonb_build_object('enabled', true, 'can_people', public.app__fin_admin(),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'phone', p.phone, 'note', p.note, 'active', p.active = 1,
                 'lent', coalesce(x.lent, 0), 'paid', coalesce(x.paid, 0), 'owe', coalesce(x.lent, 0) - coalesce(x.paid, 0)) order by (coalesce(x.lent, 0) - coalesce(x.paid, 0)) desc, p.name)
               from public.loan_people p
               left join lateral (select sum(l.amount) lent, (select coalesce(sum(y.amount), 0) from public.branch_loan_payments y join public.branch_loans l2 on l2.id = y.loan_id
                                                              where l2.person_id = p.id and l2.branch_id = p_branch) paid
                                    from public.branch_loans l where l.person_id = p.id and l.branch_id = p_branch) x on true), '[]'),
    'loans', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'person_id', l.person_id, 'person', p.name, 'date', l.loan_date, 'amount', l.amount, 'method', l.method, 'note', l.note,
                 'by', public.app__acc_name(l.created_by), 'locked', public.app__fin_locked(l.branch_id, l.loan_date),
                 'report_id', l.report_id, 'bank_out', exists (select 1 from public.shift_bank_outs o where o.loan_id = l.id), 'shift', (select x.shift from public.shift_reports x where x.id = l.report_id),
                 'paid', (select coalesce(sum(y.amount), 0) from public.branch_loan_payments y where y.loan_id = l.id),
                 'payments', coalesce((select jsonb_agg(jsonb_build_object('id', y.id, 'date', y.pay_date, 'amount', y.amount, 'method', y.method, 'note', y.note,
                                'by', public.app__acc_name(y.created_by), 'locked', public.app__fin_locked(l.branch_id, y.pay_date)) order by y.pay_date, y.id)
                              from public.branch_loan_payments y where y.loan_id = l.id), '[]')) order by l.loan_date desc, l.id desc)
               from public.branch_loans l join public.loan_people p on p.id = l.person_id where l.branch_id = p_branch), '[]'));
end $$;

-- Thay bản 54
create or replace function public.app__bank_out_json(o public.shift_bank_outs) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', o.id, 'kind', o.kind, 'amount', o.amount, 'note', o.note, 'account_id', o.account_id,
    'account', (select k.bank || ' ' || k.account_no || coalesce(' · ' || k.holder, '') from public.bank_accounts k where k.id = o.account_id),
    'category', (select c.name from public.fin_categories c where c.id = o.category_id),
    'fund_status', (select w.status from public.fund_withdrawals w where w.id = o.fund_withdrawal_id),
    'loan_person', (select p.name from public.branch_loans l join public.loan_people p on p.id = l.person_id where l.id = o.loan_id),
    'by', public.app__acc_name(o.created_by), 'at', o.created_at)
$$;

-- Thay bản 54
create or replace function public.app_ca_bank_out_delete(p_out bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; o public.shift_bank_outs; r public.shift_reports;
begin
  a := public.app__need(null);
  if not public.app__bank_out_can() then raise exception 'Chỉ Chủ, Quản lý tổng, Kế toán xoá phiếu chi ở đây.'; end if;
  select * into o from public.shift_bank_outs where id = p_out for update;
  if o.id is null then raise exception 'Không tìm thấy phiếu chi.'; end if;
  select * into r from public.shift_reports where id = o.report_id for update;
  if r.recon_status = 'hoan_thanh' then raise exception 'Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.'; end if;
  if exists (select 1 from public.shift_report_checks c where c.report_id = o.report_id and c.item = 'chuyen_khoan' and c.auto = 1) then
    raise exception 'Mục Chuyển khoản web đã tự đối soát nên đã KHOÁ. Chủ mở khoá (Đèn đối soát) rồi mới xoá phiếu chi.';
  end if;
  if o.fund_withdrawal_id is not null and exists (select 1 from public.fund_withdrawals w where w.id = o.fund_withdrawal_id and w.status = 'da_nhan') then
    raise exception 'Chủ đã xác nhận phiếu rút này ở Sổ quỹ nên không xoá được.';
  end if;
  if o.loan_id is not null and exists (select 1 from public.branch_loan_payments y where y.loan_id = o.loan_id) then
    raise exception 'Phiếu chi này đã đổi thành cho vay và người vay đã trả nợ — xoá các lần trả ở khung Cho vay trước.';
  end if;
  delete from public.fin_entries where id = o.fin_entry_id;
  if o.loan_id is not null then update public.shift_bank_outs set loan_id = null where id = o.id; delete from public.branch_loans where id = o.loan_id; end if;
  delete from public.fund_withdrawals where id = o.fund_withdrawal_id;
  update public.bank_account_balances set transfers_out = greatest(coalesce(transfers_out, 0) - o.amount, 0), updated_by = a.id, updated_at = public.vn_now_text()
   where report_id = o.report_id and account_id = o.account_id;
  delete from public.shift_bank_outs where id = p_out;
  insert into public.shift_recon_log(report_id, action, field, reason, by_account)
  values (o.report_id, 'xoa_phieu_chi', 'bank_transfers_out', 'Xoá phiếu chi ' || public.app__vnd(o.amount) || ': ' || o.note, a.id);
  perform public.app_log('phieu_chi_ck_xoa', 'out=' || p_out);
end $$;

revoke execute on function public.app__bank_out_json(public.shift_bank_outs) from public, anon, authenticated;
revoke execute on function public.app_tc_to_loan(jsonb, bigint, text), public.app_loan_save(bigint, jsonb), public.app_loan_delete(bigint), public.app_loans(bigint),
  public.app_ca_bank_out_delete(bigint) from public, anon;
grant execute on function public.app_tc_to_loan(jsonb, bigint, text), public.app_loan_save(bigint, jsonb), public.app_loan_delete(bigint), public.app_loans(bigint),
  public.app_ca_bank_out_delete(bigint) to authenticated;

insert into public.app_migrations(file) values ('66_doi_phieu_chi_ck_thanh_vay.sql') on conflict (file) do nothing;
