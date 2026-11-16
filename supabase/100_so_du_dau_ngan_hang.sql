-- Bước 117 (chốt 16/11/2026): Số dư ngân hàng — số dư ĐẦU ca luôn = số dư CUỐI ca trước của cùng tài khoản.
--  Lỗi cũ: trang Kế toán › Chuyển khoản thực nhận điền sẵn số dư đầu theo số cuối gần nhất lúc mở trang và lưu luôn số đó cho
--  các tài khoản chưa nhập; sau đó số đầu bị giữ nguyên số cũ qua nhiều ca → tiền thực nhận cộng dồn, lệch chuyển khoản rất lớn.
--  * Cột opening_manual: chỉ khi kế toán tích "Số dư đầu khác số cuối ca trước" mới giữ số tự nhập.
--  * Lưu số dư (app_kt_bank_save_accounts): không tích thì số đầu = số cuối ca trước (nếu có ca trước).
--  * Sửa / nhập số cuối của 1 ca → số đầu của ca sau (cùng tài khoản, chưa tích tự nhập, chưa hoàn thành đối soát, tháng chưa chốt) tự cập nhật.
--  * Sửa dữ liệu từ 01/11/2026: số đầu ≠ số cuối ca trước (chưa tích tự nhập, chưa hoàn thành đối soát, tháng chưa chốt) → = số cuối ca trước; ghi lịch sử.
-- Chạy lại nhiều lần không sao.

alter table public.bank_account_balances add column if not exists opening_manual boolean not null default false;

-- Số đầu của dòng ca SAU (cùng tài khoản) theo số cuối mới
create or replace function public.app__kt_bank_next_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; nx record; pv jsonb;
begin
  select * into r from public.shift_reports where id = new.report_id;
  if r.id is null then return null; end if;
  select x.report_id, x.opening, p.* into nx
    from public.bank_account_balances x join public.shift_reports p on p.id = x.report_id
   where x.account_id = new.account_id and p.branch_id = r.branch_id and not x.opening_manual
     and (p.work_date > r.work_date or (p.work_date = r.work_date and array_position(public.app__shifts(), p.shift) > array_position(public.app__shifts(), r.shift)))
   order by p.work_date, array_position(public.app__shifts(), p.shift) limit 1;
  if nx.report_id is null then return null; end if;
  if coalesce(nx.recon_status, '') = 'hoan_thanh' or public.app__fin_locked(nx.branch_id, nx.work_date) then return null; end if;
  select * into r from public.shift_reports where id = nx.report_id;
  pv := public.app__kt_prev_closing_acc(r, new.account_id);
  if pv is not null and (pv ->> 'closing')::bigint is distinct from nx.opening then
    update public.bank_account_balances set opening = (pv ->> 'closing')::bigint where report_id = nx.report_id and account_id = new.account_id;
    insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
    values (nx.report_id, 'ke_toan', 'bank_opening', to_jsonb(nx.opening), pv -> 'closing', 'Tự cập nhật: số dư đầu = số dư cuối ca trước', new.updated_by);
  end if;
  return null;
end $$;
revoke all on function public.app__kt_bank_next_sync() from public, anon, authenticated;
drop trigger if exists trg_kt_bank_next_sync on public.bank_account_balances;
create trigger trg_kt_bank_next_sync after insert or update of closing on public.bank_account_balances
  for each row execute function public.app__kt_bank_next_sync();

-- Lưu số dư: thêm opening_manual; không tự nhập thì số đầu = số cuối ca trước
create or replace function public.app_kt_bank_save_accounts(p_report bigint, p_rows jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; e jsonb; acc public.bank_accounts; old public.bank_account_balances;
        v_open bigint; v_close bigint; v_out bigint; v_note text; v_man boolean; pv jsonb; k text; o jsonb; n jsonb; tag text;
begin
  a := public.app__need('ke_toan');
  select * into r from public.shift_reports where id = p_report for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  if r.recon_status = 'hoan_thanh' then raise exception 'Quản lý đã HOÀN THÀNH ĐỐI SOÁT ca này nên số liệu kế toán đã khóa. Cần quản lý mở lại đối soát.'; end if;
  if jsonb_typeof(coalesce(p_rows, '[]')) <> 'array' then raise exception 'Dữ liệu không hợp lệ.'; end if;
  for e in select * from jsonb_array_elements(coalesce(p_rows, '[]')) loop
    select * into acc from public.bank_accounts where id = (e ->> 'account_id')::bigint;
    if acc.id is null or acc.branch_id <> r.branch_id then raise exception 'Tài khoản không thuộc chi nhánh của phiếu ca này.'; end if;
    v_open := (e ->> 'opening')::bigint; v_close := (e ->> 'closing')::bigint; v_out := coalesce((e ->> 'transfers_out')::bigint, 0);
    v_note := nullif(trim(coalesce(e ->> 'note', '')), ''); v_man := coalesce((e ->> 'opening_manual')::boolean, false);
    if v_out < 0 then raise exception 'Tiền chuyển ra không được âm (tài khoản %).', acc.account_no; end if;
    select * into old from public.bank_account_balances where report_id = p_report and account_id = acc.id;
    -- chưa nhập gì cho tài khoản này (chỉ có số đầu điền sẵn) → không lưu
    if old.report_id is null and v_close is null and v_out = 0 and v_note is null and not v_man then continue; end if;
    if old.report_id is null and acc.active <> 1 then raise exception 'Tài khoản % đã ngừng dùng.', acc.account_no; end if;
    pv := public.app__kt_prev_closing_acc(r, acc.id);
    if not v_man and pv is not null then v_open := (pv ->> 'closing')::bigint; end if;
    insert into public.bank_account_balances(report_id, account_id, opening, closing, transfers_out, note, opening_manual, updated_by, updated_at)
    values (p_report, acc.id, v_open, v_close, v_out, v_note, v_man, a.id, public.vn_now_text())
    on conflict (report_id, account_id) do update set opening = excluded.opening, closing = excluded.closing, transfers_out = excluded.transfers_out,
           note = excluded.note, opening_manual = excluded.opening_manual, updated_by = excluded.updated_by, updated_at = excluded.updated_at
     where (bank_account_balances.opening, bank_account_balances.closing, bank_account_balances.transfers_out, bank_account_balances.note, bank_account_balances.opening_manual)
           is distinct from (excluded.opening, excluded.closing, excluded.transfers_out, excluded.note, excluded.opening_manual);
    tag := 'TK ' || acc.bank || ' ' || acc.account_no;
    foreach k in array array['opening', 'closing', 'transfers_out', 'note'] loop
      o := case k when 'opening' then to_jsonb(old.opening) when 'closing' then to_jsonb(old.closing) when 'transfers_out' then to_jsonb(old.transfers_out) else to_jsonb(old.note) end;
      n := case k when 'opening' then to_jsonb(v_open) when 'closing' then to_jsonb(v_close) when 'transfers_out' then to_jsonb(v_out) else to_jsonb(v_note) end;
      if o is distinct from n and not (old.report_id is null and (n = 'null'::jsonb or (k = 'transfers_out' and n = '0'::jsonb))) then
        insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account) values (p_report, 'ke_toan', 'bank_' || k, o, n, tag, a.id);
      end if;
    end loop;
  end loop;
  perform public.app_log('ke_toan_so_du', 'report=' || p_report);
end $$;
revoke all on function public.app_kt_bank_save_accounts(bigint, jsonb) from public, anon;
grant execute on function public.app_kt_bank_save_accounts(bigint, jsonb) to authenticated;

-- Trả thêm opening_manual cho trang kế toán (giữ nguyên phần còn lại của bản 21)
create or replace function public.app__kt_bank_json(r public.shift_reports) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d jsonb := public.app__ca_eff(r.id); accs jsonb; tot bigint; n_in int; n_all int; l_by text; l_at text; late jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('account_id', k.id, 'bank', k.bank, 'account_no', k.account_no, 'holder', k.holder, 'label', k.label,
            'active', k.active = 1, 'opening', x.opening, 'closing', x.closing, 'transfers_out', coalesce(x.transfers_out, 0), 'note', x.note,
            'opening_manual', coalesce(x.opening_manual, false),
            'late_in', li.s, 'late_out', lo.s,
            'received', case when x.opening is not null and x.closing is not null then x.closing - x.opening + coalesce(x.transfers_out, 0) + coalesce(li.s, 0) - coalesce(lo.s, 0) end,
            'updated_by', public.app__acc_name(x.updated_by), 'updated_at', x.updated_at,
            'prev', public.app__kt_prev_closing_acc(r, k.id)) order by k.sort_order, k.id), '[]'),
         sum(case when x.opening is not null and x.closing is not null then x.closing - x.opening + coalesce(x.transfers_out, 0) + coalesce(li.s, 0) - coalesce(lo.s, 0) end),
         count(*) filter (where x.opening is not null and x.closing is not null), count(*)
    into accs, tot, n_in, n_all
    from public.bank_accounts k
    left join public.bank_account_balances x on x.report_id = r.id and x.account_id = k.id
    left join lateral (select sum(l.amount) s from public.bank_late_receipts l where l.origin_report_id = r.id and l.account_id = k.id) li on true
    left join lateral (select sum(l.amount) s from public.bank_late_receipts l where l.arrived_report_id = r.id and l.account_id = k.id) lo on true
   where k.branch_id = r.branch_id and (k.active = 1 or x.report_id is not null or li.s is not null or lo.s is not null);
  select public.app__acc_name(x.updated_by), x.updated_at into l_by, l_at
    from public.bank_account_balances x where x.report_id = r.id order by x.updated_at desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'account_id', l.account_id, 'account', k.bank || ' ' || k.account_no, 'amount', l.amount, 'note', l.note,
            'dir', case when l.origin_report_id = r.id then 'in' else 'out' end,
            'other', public.app__ca_title(o), 'other_id', o.id, 'by', public.app__acc_name(l.created_by), 'at', l.created_at) order by l.id), '[]')
    into late
    from public.bank_late_receipts l join public.bank_accounts k on k.id = l.account_id
    join public.shift_reports o on o.id = case when l.origin_report_id = r.id then l.arrived_report_id else l.origin_report_id end
   where l.origin_report_id = r.id or l.arrived_report_id = r.id;
  return jsonb_build_object('report_id', r.id, 'status', r.status, 'recon_status', r.recon_status,
    'rev_start', d ->> 'rev_start', 'rev_end', d ->> 'rev_end',
    'pos_transfer', (d ->> 'pos_transfer')::bigint, 'reported_transfer', (d ->> 'reported_transfer')::bigint,
    'accounts', accs, 'received', tot, 'entered', n_in, 'account_count', n_all, 'late', late,
    'updated_by', l_by, 'updated_at', l_at,
    'locked', r.recon_status = 'hoan_thanh');
end $$;

-- Sửa dữ liệu từ 01/11/2026
with fix as (
  select x.report_id, x.account_id, x.opening old_open, (public.app__kt_prev_closing_acc(r, x.account_id) ->> 'closing')::bigint new_open
    from public.bank_account_balances x join public.shift_reports r on r.id = x.report_id
   where r.work_date >= '2026-11-01' and not x.opening_manual and coalesce(r.recon_status, '') <> 'hoan_thanh'
     and not public.app__fin_locked(r.branch_id, r.work_date)
), upd as (
  update public.bank_account_balances x set opening = f.new_open
    from fix f where x.report_id = f.report_id and x.account_id = f.account_id and f.new_open is not null and f.new_open is distinct from f.old_open
  returning x.report_id, x.account_id, f.old_open, f.new_open
)
insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
select u.report_id, 'ke_toan', 'bank_opening', to_jsonb(u.old_open), to_jsonb(u.new_open),
       'Sửa tự động (bước 117): số dư đầu TK ' || k.bank || ' ' || k.account_no || ' = số dư cuối ca trước', null
  from upd u join public.bank_accounts k on k.id = u.account_id;

insert into public.app_migrations(file) values ('100_so_du_dau_ngan_hang.sql') on conflict (file) do nothing;
