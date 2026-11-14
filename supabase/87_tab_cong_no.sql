-- Bước 95 (anh Tiến 14/11/2026): TAB CÔNG NỢ RIÊNG (Quản lý ca › Công nợ)
--  * Mỗi khoản nợ thuộc 1 nhóm (shift_debts.grp): 'khach' = Nợ khách hàng (Nợ HĐ + khách ngoài), 'kho' = Nợ kho tổng, 'khac' = Nợ khác.
--    Bỏ nhãn "Gia đình": khoản gia đình cũ → Nợ khác; khoản tên "Kho tổng" / trả hộ Kho tổng → Nợ kho tổng.
--    Cột family giữ lại, tự đồng bộ: family = 1 khi nhóm khác 'khach' (phiếu chốt ca chỉ nhắc Nợ khách hàng như trước).
--  * app_cn_book: sổ công nợ 1 cơ sở (khoản còn nợ + khoản đã trả 180 ngày gần đây, ngày nợ → ngày trả).
--  * app_cn_collect_many: thu gộp của 1 người — trừ dần từ khoản cũ nhất.
--  * app_cn_person_save: sửa tên / SĐT / nhóm của 1 người (mọi khoản của người đó).
--  * app_tc_move_to_debt / app_tc_move_undebt: đối soát › Thu chi — khoản CHI của ca "Thành nợ" (không tính chi phí, số tiền ca không đổi).
-- Chạy lại nhiều lần không sao.

alter table public.shift_debts add column if not exists grp text;
alter table public.shift_debts add column if not exists mv_report bigint;
alter table public.shift_debts add column if not exists mv_key text;

-- nhóm cho khoản cũ (chỉ khoản chưa có nhóm)
update public.shift_debts set grp = case
    when lower(trim(table_name)) like '%kho tổng%' or coalesce(note, '') ilike '%trả hộ kho tổng%' then 'kho'
    when family = 1 or from_loan is not null then 'khac'
    else 'khach' end
 where grp is null;

-- nhóm ↔ family luôn khớp; khoản tách (trả một phần) theo nhóm khoản gốc
create or replace function public.app__debt_grp_sync() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.grp is null then
      new.grp := coalesce((select x.grp from public.shift_debts x where x.id = new.split_from),
                          case when coalesce(new.family, 0) = 1 then 'khac' else 'khach' end);
    end if;
  elsif new.grp is distinct from old.grp then
    null;
  elsif coalesce(new.family, 0) is distinct from coalesce(old.family, 0) then
    new.grp := case when new.family = 1 then case when old.grp = 'khach' then 'khac' else old.grp end else 'khach' end;
  end if;
  if new.grp not in ('khach', 'kho', 'khac') then new.grp := 'khach'; end if;
  new.family := case when new.grp = 'khach' then 0 else 1 end;
  return new;
end $$;
drop trigger if exists shift_debts_grp_sync on public.shift_debts;
create trigger shift_debts_grp_sync before insert or update on public.shift_debts
  for each row execute function public.app__debt_grp_sync();
update public.shift_debts set family = case when grp = 'khach' then 0 else 1 end where family is distinct from case when grp = 'khach' then 0 else 1 end;

-- sổ công nợ 1 cơ sở
create or replace function public.app_cn_book(p_branch bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since text := to_char(public.vn_now()::date - 180, 'YYYY-MM-DD');
begin
  perform public.app__tc_need(p_branch);
  return jsonb_build_object('can_edit', coalesce(public.app__cn_can(p_branch), false), 'today', left(public.vn_now_text(), 10),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code), 'name', b.name) order by b.sort_order)
                 from public.branches b where b.status = 'Đang hoạt động' and public.app__tc_can(b.id)), '[]'),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
              'id', d.id, 'grp', d.grp, 'kind', coalesce(d.kind, 'bill'), 'name', d.table_name, 'phone', d.phone, 'amount', d.amount, 'note', d.note,
              'date', coalesce(o.work_date, left(d.created_at, 10)), 'shift', o.shift, 'report_id', d.report_id, 'by_ql', d.report_id is null,
              'by', public.app__acc_name(d.created_by), 'split', d.split_from is not null, 'fund_out', d.fund_out = 1,
              'gap_report', d.gap_report, 'gap_ca', (select x.shift || ' ' || to_char(x.work_date::date, 'DD/MM') from public.shift_reports x where x.id = d.gap_report),
              'mv_report', d.mv_report, 'mv_ca', (select x.shift || ' ' || to_char(x.work_date::date, 'DD/MM') from public.shift_reports x where x.id = d.mv_report),
              'closed', d.closed_at is not null, 'paid_date', coalesce(cr.work_date, left(d.closed_at, 10)), 'paid_shift', cr.shift, 'paid_report', d.closed_report_id,
              'paid_kind', d.collect_kind, 'paid_by', public.app__acc_name(d.closed_by), 'paid_note', d.close_note,
              'can_unthu', d.closed_at is not null and d.closed_report_id is null and coalesce(d.collect_kind, '') in ('tien_mat', 'chuyen_khoan')
                           and not public.app__fin_locked(d.branch_id, left(d.closed_at, 10)))
              order by coalesce(o.work_date, left(d.created_at, 10)), d.id)
            from public.shift_debts d left join public.shift_reports o on o.id = d.report_id left join public.shift_reports cr on cr.id = d.closed_report_id
           where d.branch_id = p_branch
             and ((d.closed_at is null and (d.report_id is null or o.status = 'hoan_thanh')) or (d.closed_at is not null and left(d.closed_at, 10) >= since))), '[]'));
end $$;
revoke all on function public.app_cn_book(bigint) from public, anon;
grant execute on function public.app_cn_book(bigint) to authenticated;

-- thu gộp: trừ dần từ khoản cũ nhất
create or replace function public.app_cn_collect_many(p_ids bigint[], p_date text, p_kind text, p_amount bigint, p_note text) returns int
language plpgsql security definer set search_path = public as $$
declare d record; rem bigint := p_amount; tot bigint; nb int; n int := 0; take bigint;
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then raise exception 'Chưa chọn khoản nợ.'; end if;
  select count(distinct branch_id), coalesce(sum(amount), 0) into nb, tot from public.shift_debts where id = any(p_ids) and closed_at is null;
  if nb <> 1 then raise exception 'Các khoản nợ phải cùng một cơ sở và chưa thu.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nhập số tiền thu lớn hơn 0.'; end if;
  if p_amount > tot then raise exception 'Số tiền thu lớn hơn tổng còn nợ (%).', public.app__vnd(tot); end if;
  for d in select x.id, x.amount from public.shift_debts x left join public.shift_reports o on o.id = x.report_id
            where x.id = any(p_ids) and x.closed_at is null order by coalesce(o.work_date, left(x.created_at, 10)), x.id loop
    exit when rem <= 0;
    take := least(rem, d.amount);
    perform public.app_cn_debt_collect(d.id, p_date, p_kind, take, p_note);
    rem := rem - take; n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.app_cn_collect_many(bigint[], text, text, bigint, text) from public, anon;
grant execute on function public.app_cn_collect_many(bigint[], text, text, bigint, text) to authenticated;

-- sửa tên / SĐT / nhóm của 1 người (mọi khoản của người đó)
create or replace function public.app_cn_person_save(p_ids bigint[], p_name text, p_phone text, p_grp text) returns int
language plpgsql security definer set search_path = public as $$
declare br bigint; nb int; n int; nm text := trim(coalesce(p_name, ''));
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then raise exception 'Chưa chọn người nợ.'; end if;
  select count(distinct branch_id), min(branch_id) into nb, br from public.shift_debts where id = any(p_ids);
  if nb <> 1 then raise exception 'Các khoản nợ phải cùng một cơ sở.'; end if;
  perform public.app__tc_need(br);
  if not coalesce(public.app__cn_can(br), false) then raise exception 'Bạn không được sửa công nợ của cơ sở này.'; end if;
  if nm = '' then raise exception 'Ghi tên người nợ.'; end if;
  if coalesce(p_grp, '') not in ('khach', 'kho', 'khac') then raise exception 'Chọn nhóm nợ.'; end if;
  update public.shift_debts set table_name = nm, phone = nullif(trim(coalesce(p_phone, '')), ''), grp = p_grp where id = any(p_ids);
  get diagnostics n = row_count;
  perform public.app_log('cong_no_nguoi', n || ' khoản → ' || nm || ' · ' || p_grp);
  return n;
end $$;
revoke all on function public.app_cn_person_save(bigint[], text, text, text) from public, anon;
grant execute on function public.app_cn_person_save(bigint[], text, text, text) to authenticated;

-- ghi nợ mới ở tab Công nợ: thêm nhóm
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
        g text := case when p ->> 'grp' in ('khach', 'kho', 'khac') then p ->> 'grp' when coalesce((p ->> 'family')::boolean, false) then 'khac' else 'khach' end;
        fo int := case when coalesce((p ->> 'fund_out')::boolean, false) and (case when p ->> 'kind' in ('muon', 'ck') then p ->> 'kind' else 'bill' end) <> 'bill' then 1 else 0 end;
begin
  if p_id is not null then
    select * into old from public.shift_debts where id = p_id;
    if old.id is null then raise exception 'Không tìm thấy khoản nợ.'; end if;
    if old.report_id is not null then raise exception 'Khoản nợ này ghi ở phiếu ca — sửa ở phiếu ca.'; end if;
    if old.closed_at is not null then raise exception 'Khoản nợ đã thu — không sửa được.'; end if;
    if old.from_loan is not null or old.split_from is not null or old.gap_report is not null or old.mv_report is not null then raise exception 'Khoản này không sửa được ở đây.'; end if;
    br := old.branch_id;
  end if;
  a := public.app__tc_need(br);
  if not public.app__cn_can(br) then raise exception 'Bạn không được ghi công nợ của cơ sở này.'; end if;
  if nm = '' and g = 'kho' then nm := 'Kho tổng'; end if;
  if nm = '' then raise exception 'Ghi tên người nợ.'; end if;
  if amt is null or amt <= 0 then raise exception 'Nhập số tiền nợ lớn hơn 0.'; end if;
  if d !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Ngày không hợp lệ.'; end if;
  if fo = 1 and public.app__fin_locked(br, coalesce(left(old.created_at, 10), d)) then raise exception 'Tháng này đã CHỐT — không ghi tiền ra quỹ được.'; end if;
  if p_id is null then
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, grp, fund_out)
    values (br, null, nm, amt, nt, nullif(ph, ''), a.id, d || substr(public.vn_now_text(), 11), k, g, fo) returning id into nid;
  else
    if old.fund_out = 1 and old.amount <> amt and public.app__fin_locked(br, left(old.created_at, 10)) then raise exception 'Tháng của khoản này đã CHỐT — không đổi số tiền được.'; end if;
    update public.shift_debts set table_name = nm, amount = amt, note = nt, phone = nullif(ph, ''), kind = k, grp = g,
           fund_out = case when public.app__fin_locked(br, left(old.created_at, 10)) then old.fund_out else fo end where id = p_id; nid := p_id;
  end if;
  perform public.app_log(case when p_id is null then 'khach_no_them' else 'khach_no_sua' end, 'debt=' || nid || ' ' || amt || ' ' || nm || ' · ' || g);
  return nid;
end $function$;

-- đối soát › Thu chi: khoản CHI của ca → nợ (không tính chi phí; tiền đã ra khỏi két trong ca nên Sổ quỹ không trừ thêm)
create or replace function public.app_tc_move_to_debt(p_report bigint, p_mkey text, p_grp text, p_name text, p_phone text, p_note text) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; m record; nid bigint; nm text := trim(coalesce(p_name, ''));
begin
  select * into r from public.shift_reports where id = p_report for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__tc_need(r.branch_id);
  if not coalesce(public.app__cn_can(r.branch_id), false) then raise exception 'Bạn không được ghi công nợ của cơ sở này.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không đổi được.'; end if;
  if coalesce(p_grp, '') not in ('khach', 'kho', 'khac') then raise exception 'Chọn nhóm nợ.'; end if;
  if nm = '' and p_grp = 'kho' then nm := 'Kho tổng'; end if;
  if nm = '' then raise exception 'Ghi tên người nợ.'; end if;
  select * into m from public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) x where x.report_id = r.id and x.mkey = p_mkey;
  if m.report_id is null then raise exception 'Khoản này vừa thay đổi. Tải lại trang.'; end if;
  if m.auto is not null then raise exception 'Khoản tự động không đổi thành nợ được.'; end if;
  if m.amount >= 0 then raise exception 'Chỉ khoản CHI mới đổi thành nợ được.'; end if;
  if exists (select 1 from public.shift_debts d where d.mv_report = r.id and d.mv_key = p_mkey) then raise exception 'Khoản này đã thành nợ rồi.'; end if;
  if public.app__tc_move_ka(r.id, p_mkey) then raise exception 'Khoản này đã gán âm tiền trừ lương — bỏ gán trước.'; end if;
  insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, grp, mv_report, mv_key)
  values (r.branch_id, null, nm, -m.amount, coalesce(nullif(trim(coalesce(p_note, '')), ''), m.note), nullif(trim(coalesce(p_phone, '')), ''), a.id,
          r.work_date || substr(public.vn_now_text(), 11), case when m.pay = 'chuyen_khoan' then 'ck' else 'muon' end, p_grp, r.id, p_mkey)
  returning id into nid;
  insert into public.fin_move_cats(report_id, mkey, category_id, excluded, by_account, at, checked, checked_by, checked_at)
  values (r.id, p_mkey, null, 1, a.id, public.vn_now_text(), 1, a.id, public.vn_now_text())
  on conflict (report_id, mkey) do update set category_id = null, excluded = 1, by_account = excluded.by_account, at = excluded.at,
          checked = 1, checked_by = excluded.checked_by, checked_at = excluded.checked_at;
  perform public.app_log('thu_chi_thanh_no', 'report=' || r.id || ' ' || m.note || ' → debt=' || nid || ' ' || -m.amount || ' · ' || p_grp);
  return nid;
end $$;
revoke all on function public.app_tc_move_to_debt(bigint, text, text, text, text, text) from public, anon;
grant execute on function public.app_tc_move_to_debt(bigint, text, text, text, text, text) to authenticated;

create or replace function public.app_tc_move_undebt(p_report bigint, p_mkey text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; d public.shift_debts;
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  perform public.app__tc_need(r.branch_id);
  if not coalesce(public.app__cn_can(r.branch_id), false) then raise exception 'Bạn không được sửa công nợ của cơ sở này.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không đổi được.'; end if;
  select * into d from public.shift_debts where mv_report = p_report and mv_key = p_mkey order by id limit 1;
  if d.id is null then raise exception 'Khoản này chưa thành nợ.'; end if;
  if d.closed_at is not null or exists (select 1 from public.shift_debts x where x.split_from = d.id) then
    raise exception 'Người nợ đã trả (một phần) khoản này — bỏ "Đã thu" ở tab Công nợ trước.';
  end if;
  delete from public.shift_debts where id = d.id;
  update public.fin_move_cats set excluded = 0, checked = 0, checked_by = null, checked_at = null where report_id = p_report and mkey = p_mkey;
  perform public.app_log('thu_chi_bo_thanh_no', 'report=' || p_report || ' debt=' || d.id);
end $$;
revoke all on function public.app_tc_move_undebt(bigint, text) from public, anon;
grant execute on function public.app_tc_move_undebt(bigint, text) to authenticated;

-- danh sách thu chi: khoản đã thành nợ
CREATE OR REPLACE FUNCTION public.app_tc_list(p_branch bigint, p_from text, p_to text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app_account(); brs bigint[]; rows jsonb;
begin
  if a.id is null then raise exception 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'; end if;
  if p_from is null or p_to is null or p_from !~ '^\d{4}-\d{2}-\d{2}$' or p_to !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Khoảng ngày không hợp lệ.'; end if;
  select coalesce(array_agg(b.id order by b.sort_order), '{}') into brs from public.branches b
   where b.status = 'Đang hoạt động' and public.app__tc_can(b.id) and (p_branch is null or b.id = p_branch);
  if p_branch is not null and coalesce(array_length(brs, 1), 0) = 0 then raise exception 'Bạn không được xem thu chi của cơ sở này.'; end if;

  select coalesce(jsonb_agg(z.j order by z.d desc, z.br, z.o), '[]') into rows from (
    select m.work_date as d, m.branch_id as br, array_position(public.app__shifts(), m.shift) * 1000 + m.ord as o,
           jsonb_build_object('src', 'ca', 'report_id', m.report_id, 'mkey', m.mkey, 'branch_id', m.branch_id,
             'date', m.work_date, 'shift', m.shift, 'kind', case when m.amount < 0 then 'chi' else 'thu' end, 'pay', m.pay,
             'amount', abs(m.amount), 'note', m.note, 'category_id', fc.category_id, 'category', c.name,
             'employee_id', fc.employee_id, 'employee', (select e.code || ' – ' || e.name from public.employees e where e.id = fc.employee_id),
             'excluded', coalesce(fc.excluded, case when m.amount > 0 then 1 else 0 end) = 1,
             'status', case when coalesce(fc.checked, 0) = 1 then 'da' else 'cho' end,
             'checked_by', public.app__acc_name(fc.checked_by), 'checked_at', fc.checked_at, 'auto', m.auto,
             'loan_id', (select l.id from public.branch_loans l where l.report_id = m.report_id and l.mkey = m.mkey),
             'debt', (select jsonb_build_object('id', d.id, 'grp', d.grp, 'name', d.table_name, 'closed', d.closed_at is not null or exists (select 1 from public.shift_debts x where x.split_from = d.id))
                        from public.shift_debts d where d.mv_report = m.report_id and d.mv_key = m.mkey order by d.id limit 1),   -- bước 95: khoản chi đã thành nợ
             'ka_n', (select count(*) from public.shift_shortfalls s where s.report_id = m.report_id and s.move_mkey = m.mkey and s.status <> 'huy'),
             'by', public.app__acc_name(m.created_by), 'locked', public.app__fin_locked(m.branch_id, m.work_date)) as j
      from public.app__tc_moves_x(null, p_from, p_to) m
      left join public.fin_move_cats fc on fc.report_id = m.report_id and fc.mkey = m.mkey
      left join public.fin_categories c on c.id = fc.category_id
     where m.branch_id = any(brs)
    union all
    select e.entry_date, e.branch_id, 100000 + e.id,
           jsonb_build_object('src', 'tay', 'id', e.id, 'branch_id', e.branch_id, 'date', e.entry_date, 'shift', null,
             'kind', e.kind, 'pay', e.pay_method, 'amount', e.amount, 'note', e.note, 'category_id', e.category_id, 'category', c.name,
             'excluded', false, 'status', 'da', 'checked_by', public.app__acc_name(e.created_by), 'checked_at', e.created_at,
             'bank_out', exists (select 1 from public.shift_bank_outs o where o.fin_entry_id = e.id), 'gap', exists (select 1 from public.gap_decisions g where g.fin_entry_id = e.id),
             'by', public.app__acc_name(e.created_by), 'locked', public.app__fin_locked(e.branch_id, e.entry_date))
      from public.fin_entries e left join public.fin_categories c on c.id = e.category_id
     where e.branch_id = any(brs) and e.entry_date between p_from and p_to
    union all
    select r.work_date, r.branch_id, 200000 + s.id,
           jsonb_build_object('src', 'ka', 'id', s.id, 'report_id', s.report_id, 'branch_id', r.branch_id, 'date', r.work_date, 'shift', r.shift,
             'kind', 'chi', 'pay', null, 'amount', s.amount, 'note', 'Thiếu tiền ca – ' || coalesce(em.code || ' – ' || em.name, '?'),
             'item', s.item, 'item_label', public.app__ca_item_label(s.item), 'employee_id', s.employee_id, 'employee', em.code || ' – ' || em.name,
             'reason', s.reason, 'ka_status', s.status, 'move_mkey', s.move_mkey, 'auto_tru', s.auto_tru, 'status_note', s.status_note, 'reply', s.reply, 'reply_at', s.reply_at,
             'seen_at', s.seen_at, 'category_id', null, 'category', null, 'excluded', true, 'status', 'da',
             'checked_by', public.app__acc_name(s.created_by), 'checked_at', s.created_at, 'by', public.app__acc_name(s.created_by),
             'locked', public.app__fin_locked(r.branch_id, r.work_date))
      from public.shift_shortfalls s join public.shift_reports r on r.id = s.report_id left join public.employees em on em.id = s.employee_id
     where s.status <> 'huy' and r.branch_id = any(brs) and r.work_date between p_from and p_to
  ) z;

  return jsonb_build_object('rows', rows, 'can_money', coalesce(public.app_can('doi_soat'), false), 'can_direct', coalesce(public.app__fin_admin(), false),
    'loan_branches', coalesce((select jsonb_agg(b.id) from public.branches b where b.id = any(brs) and public.app__loan_branch_ok(b.id)), '[]'),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code), 'name', b.name) order by b.sort_order)
                 from public.branches b where b.status = 'Đang hoạt động' and public.app__tc_can(b.id)), '[]'),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'name', c.name, 'active', c.active = 1) order by c.kind, c.sort_order, c.name)
                 from public.fin_categories c), '[]'));
end $function$;

insert into public.app_migrations(file) values ('87_tab_cong_no.sql') on conflict (file) do nothing;
