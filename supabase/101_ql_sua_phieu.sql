-- Bước 119 (17/11/2026): quản lý sửa thẳng Phiếu chốt ca ở bước Kiểm tra
-- Thiết kế: tai_lieu/superpowers/specs/2026-11-17-ql-sua-phieu-design.md · Kế hoạch: tai_lieu/superpowers/plans/2026-11-17-ql-sua-phieu.md
-- Bài kiểm tra: kiem_tra/audit_tien/t01…t06 (chạy trong begin … rollback).
-- Mỗi hàm lấy từ bản đang chạy trên máy chủ (pg_get_functiondef) rồi sửa. Chạy lại nhiều lần không sao.

-- ================================================================ 1. app__ca_money trả thêm ck_expected (Phải nhận chuyển khoản)
-- ck_left_bank = bank_received − ck_expected; ô "Chuyển khoản ngân hàng" (phieu_ca.js) dùng ck_expected thay cho CK Fabi.
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
  b := public.app__kt_bank_json(r);
  select coalesce(sum((m ->> 'amount')::bigint) filter (where m ->> 'kind' = 'tien_mat'), 0),
         coalesce(sum((m ->> 'amount')::bigint) filter (where m ->> 'kind' = 'chuyen_khoan'), 0)
    into tm_mv, ck_mv from jsonb_array_elements(coalesce(d -> 'moves', '[]')) m;
  select coalesce(sum(amount), 0) into debt_new from public.shift_debts where report_id = p_id and coalesce(kind, 'bill') = 'bill';
  select coalesce(sum(amount), 0) into ck_new from public.shift_debts where report_id = p_id and kind = 'ck';   -- bước 84: Nợ CK
  select coalesce(sum(amount) filter (where collect_kind = 'tien_mat'), 0), coalesce(sum(amount) filter (where collect_kind = 'chuyen_khoan'), 0)
    into col_tm, col_ck from public.shift_debts where closed_report_id = p_id;
  cc := case when r.cash_mode = 'ca' and r.ql_counted is not null then r.ql_counted else (d ->> 'cash_counted')::bigint end; op := (d ->> 'opening_cash')::bigint; pc := (d ->> 'pos_cash')::bigint;
  pt := (d ->> 'pos_transfer')::bigint; rt := (d ->> 'reported_transfer')::bigint; tot := (d ->> 'total_revenue')::bigint;
  -- ca sau đếm nhận két lệch → khoản lệch tính cho ca này (ca giao)
  ns := public.app__ca_next_shift(r.shift);
  if ns is not null then
    select * into nx from public.shift_reports where branch_id = r.branch_id and work_date = r.work_date and shift = ns;
    if nx.id is not null then nh := public.app__ca_hand(nx.id); hg := coalesce((nh ->> 'gap_eff')::bigint, 0); end if;
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

-- ================================================================ 2. app_ca_recon_save — bản kiểm tra (quản lý sửa)
-- Bước 119: giữ cash_paid trong danh sách nhân viên; nhận thêm ipos_opening, pos_debt, pos_diff (pos_diff được âm).
CREATE OR REPLACE FUNCTION public.app_ca_recon_save(p_id bigint, p jsonb, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; old jsonb; new jsonb := '{}'::jsonb; k text; v jsonb; reason text := nullif(trim(coalesce(p_reason, '')), '');
        lk text[]; dir text[] := string_to_array(nullif(current_setting('app.ca_direct', true), ''), ',');
begin
  a := public.app__need('doi_soat');
  perform public.app__ca_gap_mark(p_id);   -- bước 119
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu chưa hoàn thành nên chưa đối soát được.'; end if;
  if dir is null and r.recon_status = 'hoan_thanh' then raise exception 'Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.'; end if;
  -- bước 67: Chủ sửa thẳng → chỉ các trường của mục đang sửa được đổi, mọi trường khác giữ nguyên
  lk := case when dir is not null then coalesce((select array_agg(x) from unnest(public.app__ca_locked_fields(p_id)) x where not (x = any(dir))), '{}')   -- bước 119: mục chưa duyệt vẫn mở
             else public.app__ca_locked_fields(p_id) end;   -- bước 51
  insert into public.shift_report_recon(report_id, data, updated_by) values (p_id, public.app__recon_snapshot(p_id), a.id)
  on conflict (report_id) do nothing;
  select data into old from public.shift_report_recon where report_id = p_id for update;
  old := public.app__recon_snapshot(p_id) || old;   -- bước 119: bản kiểm tra cũ thiếu khoá mới → lấy theo phiếu nhân viên
  -- dựng lại dữ liệu sạch theo đúng các trường cho phép
  foreach k in array public.app__recon_fields() loop
    if k = any(lk) then new := new || jsonb_build_object(k, old -> k); continue; end if;
    v := case when p ? k then p -> k else old -> k end;
    if k in ('total_revenue','pos_cash','pos_transfer','reported_transfer','cash_counted','opening_cash','cups','ipos_opening','pos_debt','pos_diff') then
      if v is not null and jsonb_typeof(v) <> 'null' then
        if jsonb_typeof(v) <> 'number' or (v::text)::numeric <> trunc((v::text)::numeric) then raise exception 'Số liệu % phải là số nguyên.', k; end if;
        if k not in ('opening_cash', 'pos_diff') and (v::text)::numeric < 0 then raise exception 'Số liệu % không được âm.', k; end if;
      end if;
    elsif k = 'goods_status' then
      if v is not null and jsonb_typeof(v) <> 'null' and (v #>> '{}') not in ('khong', 'du', 'thieu') then raise exception 'Trạng thái nhập hàng không hợp lệ.'; end if;
    elsif k = 'moves' then
      v := coalesce((select jsonb_agg(jsonb_build_object('kind', x ->> 'kind', 'amount', (x ->> 'amount')::bigint, 'note', coalesce(x ->> 'note', ''), 'exchange_key', nullif(x->>'exchange_key','')::uuid))
                       from jsonb_array_elements(coalesce(v, '[]')) x where x ->> 'kind' in ('tien_mat', 'chuyen_khoan') and (x ->> 'amount') is not null), '[]');
    elsif k = 'staff' then
      -- bước 119: giữ lương trả tiền mặt (cash_paid) — trước đây bị bỏ mất khi quản lý lưu bất kỳ ô nào
      if exists (select 1 from jsonb_array_elements(coalesce(v, '[]')) x where coalesce(nullif(x ->> 'cash_paid', '')::bigint, 0) < 0) then
        raise exception 'Số tiền lương đã trả không được âm.';
      end if;
      v := coalesce((select jsonb_agg(jsonb_build_object('employee_id', (x ->> 'employee_id')::bigint, 'source', coalesce(x ->> 'source', 'ho_tro'),
                        'role', x ->> 'role', 'worked', coalesce((x ->> 'worked')::boolean, true), 'time_in', nullif(x ->> 'time_in', ''),
                        'time_out', nullif(x ->> 'time_out', ''), 'absent_reason', nullif(x ->> 'absent_reason', ''), 'note', nullif(x ->> 'note', ''),
                        'cash_paid', nullif(nullif(x ->> 'cash_paid', '')::bigint, 0)))
                       from jsonb_array_elements(coalesce(v, '[]')) x
                      where exists (select 1 from public.employees e where e.id = (x ->> 'employee_id')::bigint)), '[]');
    elsif k = 'goods' then
      v := coalesce((select jsonb_agg(jsonb_build_object('item', trim(x ->> 'item'), 'qty', coalesce(x ->> 'qty', '')))
                       from jsonb_array_elements(coalesce(v, '[]')) x where trim(coalesce(x ->> 'item', '')) <> ''), '[]');
    end if;
    new := new || jsonb_build_object(k, v);
    if (old -> k) is distinct from v then
      insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
      values (p_id, 'sua', k, old -> k, v, reason, a.id);
    end if;
  end loop;
  perform public.app__ca_validate_exchanges(new->'moves');
  if new is distinct from old and reason is null then raise exception 'Ghi lý do sửa bản đối soát.'; end if;
  if new is distinct from old then
    update public.shift_report_recon set data = new, updated_by = a.id, updated_at = public.vn_now_text() where report_id = p_id;
    perform public.app__ca_exchange_cats(p_id, a.id);
  end if;
  perform public.app__ca_direct_guard(p_id);   -- bước 119: không để kết quả tiền đã duyệt thành sai
end $function$;

-- ================================================================ 3. Ô Nợ, Tiền chênh lệch, Số dư đầu phiếu Fabi: quản lý sửa được, file Fabi tự sửa
-- 3 khoá mới trong bản kiểm tra; thuộc mục Doanh thu (khoá / mở cùng mục Doanh thu).
CREATE OR REPLACE FUNCTION public.app__recon_fields()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$ select array['rev_start','rev_end','total_revenue','pos_cash','pos_transfer','reported_transfer',
  'cash_counted','opening_cash','cups','goods_status','goods_note','moves','staff','goods','ipos_opening','pos_debt','pos_diff'] $function$;

CREATE OR REPLACE FUNCTION public.app__recon_snapshot(p_id bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'rev_start', r.rev_start, 'rev_end', r.rev_end, 'total_revenue', r.total_revenue, 'pos_cash', r.pos_cash,
    'pos_transfer', r.pos_transfer, 'reported_transfer', r.reported_transfer, 'cash_counted', r.cash_counted,
    'opening_cash', r.opening_cash, 'cups', r.cups, 'goods_status', r.goods_status, 'goods_note', r.goods_note,
    'ipos_opening', r.ipos_opening, 'pos_debt', r.pos_debt, 'pos_diff', r.pos_diff,
    'moves', coalesce((select jsonb_agg(jsonb_build_object('kind', m.kind, 'amount', m.amount, 'note', m.note, 'exchange_key', m.exchange_key) order by m.sort_order, m.id)
                       from public.shift_report_moves m where m.report_id = r.id), '[]'),
    'staff', coalesce((select jsonb_agg(jsonb_build_object('employee_id', s.employee_id, 'source', s.source, 'role', s.role, 'worked', s.worked = 1,
                         'time_in', s.time_in, 'time_out', s.time_out, 'absent_reason', s.absent_reason, 'note', s.note, 'cash_paid', s.cash_paid) order by s.id)
                       from public.shift_report_staff s where s.report_id = r.id), '[]'),
    'goods', coalesce((select jsonb_agg(jsonb_build_object('item', g.item, 'qty', g.qty) order by g.id)
                       from public.shift_report_goods g where g.report_id = r.id), '[]'))
    from public.shift_reports r where r.id = p_id
$function$;

CREATE OR REPLACE FUNCTION public.app__ca_item_fields(p_item text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_item
    when 'thoi_gian' then array['rev_start', 'rev_end']
    when 'doanh_thu' then array['total_revenue', 'pos_cash', 'pos_transfer', 'cups', 'opening_cash', 'ipos_opening', 'pos_debt', 'pos_diff']
    when 'cong_no' then array['debts']   -- bước 119: để Sửa thẳng nhận mục Công nợ (khách nợ sửa qua các hàm khách nợ)
    when 'tien_mat' then array['cash_counted', 'opening_cash', 'pos_cash', 'moves']
    when 'chuyen_khoan' then array['reported_transfer', 'pos_transfer', 'moves']
    when 'thu_chi' then array['moves']
    when 'nhan_su' then array['staff']
    when 'nhap_hang' then array['goods_status', 'goods_note', 'goods']
    else '{}'::text[] end
$function$;

CREATE OR REPLACE FUNCTION public.app__ca_eff(p_id bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select x.d || jsonb_build_object('moves', coalesce(x.d -> 'moves', '[]'::jsonb) || coalesce((
      select jsonb_agg(jsonb_build_object('kind', 'tien_mat', 'amount', -(s ->> 'cash_paid')::bigint,
               'note', 'Chi lương – ' || e.code || ' – ' || e.name, 'auto', 'luong', 'employee_id', e.id) order by e.code)
        from jsonb_array_elements(coalesce(x.d -> 'staff', '[]'::jsonb)) s join public.employees e on e.id = (s ->> 'employee_id')::bigint
       where coalesce(nullif(s ->> 'cash_paid', '')::bigint, 0) > 0 and coalesce((s ->> 'worked')::boolean, true)), '[]'::jsonb)
    -- bước 43: khách mượn tiền → tiền ra khỏi két (không phải chi phí)
    || coalesce((select jsonb_agg(jsonb_build_object('kind', 'tien_mat', 'amount', -dm.amount, 'note', 'Khách mượn – ' || dm.table_name,
               'auto', 'muon', 'debt_id', dm.id) order by dm.id)
        from public.shift_debts dm where dm.report_id = p_id and dm.kind = 'muon' and dm.amount > 0), '[]'::jsonb))
    from (select case when y.d is null or y.d ? 'pos_debt' then y.d   -- bước 119: bản kiểm tra cũ thiếu 3 khoá mới → lấy theo phiếu nhân viên
                      else y.d || (select jsonb_build_object('ipos_opening', r.ipos_opening, 'pos_debt', r.pos_debt, 'pos_diff', r.pos_diff) from public.shift_reports r where r.id = p_id) end d
            from (select coalesce((select data from public.shift_report_recon where report_id = p_id), public.app__recon_snapshot(p_id)) d) y) x
   where x.d is not null
$function$;

CREATE OR REPLACE FUNCTION public.app__fabi_apply(p_ma text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare f public.fabi_shifts; r public.shift_reports; e jsonb; v_diff jsonb := '[]'; v_fixed jsonb := '[]'; k text; lbl text; fv bigint; nv bigint; ev bigint;
        chain boolean; first_ boolean; st text; acc bigint;
begin
  begin acc := (public.app_account()).id; exception when others then acc := null; end;
  select * into f from public.fabi_shifts where ma_ca = p_ma;
  if f.ma_ca is null then return null; end if;
  if f.branch_id is null then update public.fabi_shifts set report_id = null, diff = '[]', fixed = '[]' where ma_ca = p_ma; return jsonb_build_object('status', 'chua_ro_co_so'); end if;
  select * into r from public.shift_reports where branch_id = f.branch_id and work_date = f.work_date and shift = f.shift;
  if r.id is null then
    update public.fabi_shifts set report_id = null, diff = '[]', fixed = '[]' where ma_ca = p_ma;
    return jsonb_build_object('status', 'chua_phieu');
  end if;
  if r.status <> 'hoan_thanh' then
    update public.fabi_shifts set report_id = r.id, diff = '[]', fixed = '[]' where ma_ca = p_ma;
    return jsonb_build_object('status', 'dang_chot', 'report_id', r.id);
  end if;
  first_ := r.shift = (public.app__shifts())[1];
  chain := public.app__ca_chain(r.shift);
  -- nhân viên gõ khác Fabi?
  for k, lbl, fv, nv in
    select * from (values ('ipos_opening', 'Số dư đầu', f.dau, r.ipos_opening), ('total_revenue', 'Doanh thu NET', f.net, r.total_revenue),
                          ('pos_transfer', 'Chuyển khoản', f.ck, r.pos_transfer), ('pos_cash', 'Tiền mặt', f.tm, r.pos_cash),
                          ('pos_debt', 'Nợ', f.no, r.pos_debt), ('cash_counted', 'Tổng tiền', f.tong, r.cash_counted),
                          ('pos_diff', 'Tiền chênh lệch', f.tong - f.cuoi, r.pos_diff)) v(a, b, c, d)
  loop
    if fv is not null and fv is distinct from nv then v_diff := v_diff || jsonb_build_object('field', k, 'label', lbl, 'nv', nv, 'fabi', fv); end if;
  end loop;
  -- bản đối soát phải theo Fabi
  e := public.app__ca_eff(r.id);
  for k, lbl, fv in
    select * from (values ('total_revenue', 'Doanh thu NET', f.net), ('pos_cash', 'Tiền mặt', f.tm), ('pos_transfer', 'Chuyển khoản', f.ck),
                          ('cash_counted', 'Tổng tiền', f.tong), ('opening_cash', 'Tiền đầu ca', case when chain and not first_ then f.dau end),
                          ('ipos_opening', 'Số dư đầu (phiếu Fabi)', f.dau), ('pos_debt', 'Nợ', f.no), ('pos_diff', 'Tiền chênh lệch', f.tong - f.cuoi)) v(a, b, c)
  loop
    ev := nullif(e ->> k, '')::bigint;
    if fv is not null and fv is distinct from ev then
      if not exists (select 1 from public.shift_report_recon where report_id = r.id) then
        insert into public.shift_report_recon(report_id, data, updated_by) values (r.id, public.app__recon_snapshot(r.id), acc);
      end if;
      update public.shift_report_recon set data = data || jsonb_build_object(k, fv), updated_by = acc, updated_at = public.vn_now_text() where report_id = r.id;
      insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
      values (r.id, 'sua', k, to_jsonb(ev), to_jsonb(fv), 'Theo file Fabi (mã ca ' || f.ma_ca || ')', acc);
      v_fixed := v_fixed || jsonb_build_object('field', k, 'label', lbl, 'before', ev, 'fabi', fv);
    end if;
  end loop;
  st := case when jsonb_array_length(v_diff) = 0 and jsonb_array_length(v_fixed) = 0 then 'khop' else 'lech' end;
  if jsonb_array_length(v_fixed) > 0 then
    if r.recon_status = 'hoan_thanh' then
      update public.shift_reports set recon_status = 'mo_lai', recon_by = null, recon_at = null where id = r.id;
      insert into public.shift_recon_log(report_id, action, reason, by_account) values (r.id, 'mo_lai_doi_soat', 'File Fabi khác số đã đối soát', acc);
    end if;
    perform public.app__notify_doi_soat('Số Fabi khác phiếu chốt ca',
      public.app__ca_title(r) || ': ' || (select string_agg(x ->> 'label', ', ') from jsonb_array_elements(v_fixed) x) || ' đã sửa theo file Fabi'
        || case when r.recon_status = 'hoan_thanh' then ' — ca đã MỞ LẠI đối soát.' else '.' end,
      '/quan-ly/doi-soat/ca?id=' || r.id);
  end if;
  update public.fabi_shifts set report_id = r.id, diff = v_diff, fixed = fabi_shifts.fixed || v_fixed where ma_ca = p_ma;
  return jsonb_build_object('status', st, 'report_id', r.id, 'diff', v_diff, 'fixed', v_fixed);
end $function$;

-- ================================================================ 4–5. Sửa thẳng: Chủ và quản lý; sửa được khách nợ; không khoá nhầm ô của mục chưa duyệt
-- Lần sửa làm đổi số lệch tiền mặt / chuyển khoản ĐÃ duyệt → từ chối (app__ca_gap_mark ghi mốc đầu, app__ca_direct_guard so lúc cuối).
create or replace function public.app__ca_gap_mark(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare m jsonb;
begin
  if coalesce(current_setting('app.gap0_' || p_id, true), '') <> '' then return; end if;   -- lời gọi lồng nhau: giữ mốc đầu tiên
  m := public.app__ca_money(p_id);
  perform set_config('app.gap0_' || p_id, jsonb_build_object('tien_mat', m -> 'tm_left', 'chuyen_khoan', m -> 'ck_left')::text, true);
end $$;

-- Mục tiền mặt / chuyển khoản ĐÃ có kết quả mà lần sửa này làm đổi số lệch → từ chối (phải Mở lại phần tiền rồi duyệt lại).
create or replace function public.app__ca_direct_guard(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare g0 jsonb; m jsonb; it text; was bigint; cur bigint;
begin
  g0 := nullif(current_setting('app.gap0_' || p_id, true), '')::jsonb;
  if g0 is null then return; end if;
  m := public.app__ca_money(p_id);
  foreach it in array array['tien_mat', 'chuyen_khoan'] loop
    if not exists (select 1 from public.shift_report_results where report_id = p_id and item = it) then continue; end if;
    was := (g0 ->> it)::bigint; cur := (m ->> case it when 'tien_mat' then 'tm_left' else 'ck_left' end)::bigint;
    if cur is distinct from was then
      raise exception 'Số lệch % đã đổi (% → %). Bấm "Sửa phần tiền" → "Mở lại phần tiền" rồi duyệt lại.',
        case it when 'tien_mat' then 'tiền mặt' else 'chuyển khoản' end, public.app__vnd(was), public.app__vnd(cur);
    end if;
  end loop;
end $$;

revoke all on function public.app__ca_gap_mark(bigint), public.app__ca_direct_guard(bigint) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.app_ca_recon_direct(p_id bigint, p jsonb, p_reason text, p_items text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; why text := nullif(trim(coalesce(p_reason, '')), ''); flds text[];
begin
  a := public.app__need('doi_soat');
  -- bước 119: quản lý (có quyền đối soát) cũng Sửa thẳng được; mục web tự đối soát vẫn chỉ Chủ
  if why is null then raise exception 'Ghi lý do sửa.'; end if;
  select * into r from public.shift_reports where id = p_id;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu ca chưa hoàn thành.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không sửa được.'; end if;
  if coalesce(a.system_role, '') <> 'chu' and exists (select 1 from public.shift_report_checks c where c.report_id = p_id and c.auto = 1 and c.item = any(p_items)) then
    raise exception 'Mục này web đã tự đối soát (khớp file Fabi và ngân hàng) — chỉ Chủ mở khoá được.';
  end if;
  if p_items is null or cardinality(p_items) = 0 or exists (select 1 from unnest(p_items) x where not (x = any(public.app__ca_check_items()))) then raise exception 'Hạng mục không hợp lệ.'; end if;
  select coalesce(array_agg(distinct x), '{}') into flds from unnest(p_items) it, unnest(public.app__ca_item_fields(it)) x;
  if cardinality(flds) = 0 then raise exception 'Mục này không có số liệu để sửa thẳng — bấm "Sửa" để mở lại mục.'; end if;
  perform set_config('app.ca_direct', array_to_string(flds, ','), true);
  begin
    perform public.app_ca_recon_save(p_id, p, 'Chủ sửa thẳng: ' || why);
  exception when others then perform set_config('app.ca_direct', '', true); raise;
  end;
  perform set_config('app.ca_direct', '', true);
  perform public.app_log('doi_soat_sua_thang', 'report=' || p_id || ' ' || array_to_string(p_items, ','));
end $function$;

CREATE OR REPLACE FUNCTION public.app_ca_auto_locks(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts;
begin
  a := public.app__need('doi_soat');
  return jsonb_build_object('items', to_jsonb(public.app__ca_locked_items(p_id)), 'fields', to_jsonb(public.app__ca_locked_fields(p_id)),
    'done', coalesce((select jsonb_agg(item) from public.shift_report_checks where report_id = p_id), '[]'),
    'can_unlock', a.system_role = 'chu', 'is_chu', a.system_role = 'chu', 'can_direct', true);   -- bước 119: mọi người có quyền đối soát được Sửa thẳng
end $function$;

CREATE OR REPLACE FUNCTION public.app_ca_recon_debt_set(p_report bigint, p_debt bigint, p_kind text, p_name text, p_amount bigint, p_note text, p_reason text, p_from text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; d public.shift_debts; nid bigint;
        why text := nullif(trim(coalesce(p_reason, '')), ''); nm text := trim(coalesce(p_name, '')); nt text := nullif(trim(coalesce(p_note, '')), '');
begin
  a := public.app__need('doi_soat');
  perform public.app__ca_gap_mark(p_report);
  select * into r from public.shift_reports where id = p_report for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu chưa hoàn thành nên chưa đối soát được.'; end if;
  -- bước 119: ca đã hoàn thành vẫn sửa được (Sửa thẳng); app__ca_direct_guard chặn nếu làm đổi số lệch đã duyệt
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT — không sửa được.'; end if;
  if why is null then raise exception 'Ghi lý do sửa ở cuối trang trước.'; end if;
  if coalesce(p_kind, '') not in ('bill', 'muon', 'ck') then raise exception 'Chọn TM / CK / HĐ cho khoản nợ.'; end if;
  if nm = '' then raise exception 'Ghi tên khách / bàn cho khoản nợ.'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'Số tiền nợ phải lớn hơn 0.'; end if;
  if p_debt is null then
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, created_by, kind)
    values (r.branch_id, r.id, nm, p_amount, nt, a.id, p_kind) returning id into nid;
    insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
    values (r.id, 'bao_no_them', null, case when nullif(trim(coalesce(p_from, '')), '') is null then null else to_jsonb(trim(p_from)) end,
            jsonb_build_object('id', nid, 'kind', p_kind, 'table_name', nm, 'amount', p_amount), why, a.id);
  else
    select * into d from public.shift_debts where id = p_debt and report_id = r.id for update;
    if d.id is null then raise exception 'Không tìm thấy khoản nợ của ca này.'; end if;
    if d.closed_at is not null then raise exception 'Khoản nợ đã thu — không sửa được.'; end if;
    nid := d.id;
    if (d.table_name, d.amount, coalesce(d.kind, 'bill'), coalesce(d.note, '')) is distinct from (nm, p_amount, p_kind, coalesce(nt, '')) then
      update public.shift_debts set table_name = nm, amount = p_amount, kind = p_kind, note = nt where id = d.id;
      insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
      values (r.id, 'bao_no_sua', null, jsonb_build_object('kind', coalesce(d.kind, 'bill'), 'table_name', d.table_name, 'amount', d.amount),
              jsonb_build_object('id', nid, 'kind', p_kind, 'table_name', nm, 'amount', p_amount), why, a.id);
    end if;
  end if;
  perform public.app_log('doi_soat_bao_no', 'report=' || r.id || ' debt=' || nid);
  perform public.app__ca_direct_guard(p_report);
  return nid;
  perform public.app__ca_direct_guard(p_report);
end $function$;

CREATE OR REPLACE FUNCTION public.app_ca_recon_debt_remove(p_report bigint, p_debt bigint, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; d public.shift_debts; why text := nullif(trim(coalesce(p_reason, '')), '');
begin
  a := public.app__need('doi_soat');
  perform public.app__ca_gap_mark(p_report);
  select * into r from public.shift_reports where id = p_report for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu chưa hoàn thành nên chưa đối soát được.'; end if;
  -- bước 119: ca đã hoàn thành vẫn sửa được (Sửa thẳng); app__ca_direct_guard chặn nếu làm đổi số lệch đã duyệt
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT — không sửa được.'; end if;
  if why is null then raise exception 'Ghi lý do sửa ở cuối trang trước.'; end if;
  select * into d from public.shift_debts where id = p_debt and report_id = r.id for update;
  if d.id is null then raise exception 'Không tìm thấy khoản nợ của ca này.'; end if;
  if d.closed_at is not null then raise exception 'Khoản nợ đã thu — không xoá được.'; end if;
  delete from public.shift_debts where id = d.id;
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
  values (r.id, 'bao_no_xoa', null, jsonb_build_object('id', d.id, 'kind', coalesce(d.kind, 'bill'), 'table_name', d.table_name, 'amount', d.amount), null, why, a.id);
  perform public.app_log('doi_soat_bao_no_xoa', 'report=' || r.id || ' debt=' || d.id);
  perform public.app__ca_direct_guard(p_report);
end $function$;

CREATE OR REPLACE FUNCTION public.app_ca_recon_debt_collect(p_report bigint, p_debt bigint, p_kind text, p_amount bigint, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; d public.shift_debts; o public.shift_reports; v_item text;
begin
  perform public.app__need('doi_soat');
  perform public.app__ca_gap_mark(p_report);
  a := public.app_account();
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  if r.status <> 'hoan_thanh' then raise exception 'Nhân viên chưa gửi phiếu này.'; end if;
  -- bước 119: ca đã hoàn thành vẫn sửa được (Sửa thẳng); app__ca_direct_guard chặn nếu làm đổi số lệch đã duyệt
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Ghi lý do (vd: khách trả nhưng nhân viên không biết).'; end if;
  if coalesce(p_kind, '') not in ('tien_mat', 'chuyen_khoan') then raise exception 'Chọn khách trả bằng tiền mặt hay chuyển khoản.'; end if;
  v_item := p_kind;
  if exists (select 1 from public.shift_report_results x where x.report_id = p_report and x.item = v_item)
     or exists (select 1 from public.shift_report_checks x where x.report_id = p_report and x.item = v_item) then
    raise exception 'Mục % đã đối soát — bấm Sửa ở mục đó để mở lại trước.', case when v_item = 'tien_mat' then 'Tiền mặt' else 'Chuyển khoản' end;
  end if;
  select * into d from public.shift_debts where id = p_debt for update;
  if d.id is null or d.closed_at is not null then raise exception 'Khoản nợ này đã được thu hoặc không còn.'; end if;
  if d.branch_id <> r.branch_id then raise exception 'Khoản nợ không thuộc cơ sở của ca này.'; end if;
  if coalesce(d.report_id, 0) = p_report then raise exception 'Đây là nợ phát sinh trong chính ca này.'; end if;
  if d.report_id is not null then
    select * into o from public.shift_reports where id = d.report_id;
    if (o.work_date, array_position(public.app__shifts(), o.shift)) >= (r.work_date, array_position(public.app__shifts(), r.shift)) then
      raise exception 'Khoản nợ ghi ở ca sau ca này.';
    end if;
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nhập số tiền khách trả lớn hơn 0.'; end if;
  if p_amount > d.amount then raise exception 'Khách trả nhiều hơn số nợ (%).', public.app__vnd(d.amount); end if;
  if p_amount < d.amount then   -- trả một phần: phần còn lại thành khoản nợ riêng
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, split_from, gap_report, gap_item, family, from_loan, fund_out)
    values (d.branch_id, d.report_id, d.table_name, d.amount - p_amount, d.note, d.phone, d.created_by, d.created_at, d.kind, d.id, d.gap_report, d.gap_item, d.family, d.from_loan, d.fund_out);
    update public.shift_debts set amount = p_amount where id = d.id;
  end if;
  update public.shift_debts set closed_at = public.vn_now_text(), closed_by = a.id, closed_report_id = p_report, collect_kind = p_kind,
         close_note = 'Quản lý ghi khi đối soát: ' || trim(p_reason)
   where id = p_debt;
  perform public.app_log('doi_soat_thu_no', 'report=' || p_report || ' debt=' || p_debt || ' ' || p_kind || ' ' || p_amount || ' · ' || trim(p_reason));
  perform public.app__ca_direct_guard(p_report);
end $function$;

CREATE OR REPLACE FUNCTION public.app_ca_recon_debt_uncollect(p_report bigint, p_debt bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.shift_reports; d public.shift_debts; rest public.shift_debts;
begin
  perform public.app__need('doi_soat');
  perform public.app__ca_gap_mark(p_report);
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  -- bước 119: ca đã hoàn thành vẫn sửa được (Sửa thẳng); app__ca_direct_guard chặn nếu làm đổi số lệch đã duyệt
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT.'; end if;
  select * into d from public.shift_debts where id = p_debt for update;
  if d.id is null or d.closed_report_id is distinct from p_report or coalesce(d.close_note, '') not like 'Quản lý ghi khi đối soát:%' then
    raise exception 'Chỉ bỏ được khoản quản lý ghi khi đối soát ca này.';
  end if;
  if exists (select 1 from public.shift_report_results x where x.report_id = p_report and x.item = d.collect_kind)
     or exists (select 1 from public.shift_report_checks x where x.report_id = p_report and x.item = d.collect_kind) then
    raise exception 'Mục % đã đối soát — bấm Sửa ở mục đó để mở lại trước.', case when d.collect_kind = 'tien_mat' then 'Tiền mặt' else 'Chuyển khoản' end;
  end if;
  -- trả một phần trước đó: gộp lại phần còn nợ (chưa ai thu)
  select * into rest from public.shift_debts where split_from = d.id and closed_at is null order by id limit 1;
  if rest.id is not null then
    update public.shift_debts set amount = d.amount + rest.amount where id = d.id;
    delete from public.shift_debts where id = rest.id;
  end if;
  update public.shift_debts set closed_at = null, closed_by = null, closed_report_id = null, collect_kind = null, close_note = null where id = p_debt;
  perform public.app_log('doi_soat_bo_thu_no', 'report=' || p_report || ' debt=' || p_debt);
  perform public.app__ca_direct_guard(p_report);
end $function$;

CREATE OR REPLACE FUNCTION public.app_ca_recon_debt_uncollect(p_report bigint, p_debt bigint, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.shift_reports; d public.shift_debts; rest public.shift_debts; why text:=trim(coalesce(p_reason,''));
begin
  perform public.app__need('doi_soat');
  perform public.app__ca_gap_mark(p_report);
  select * into r from public.shift_reports where id=p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  -- bước 119: ca đã hoàn thành vẫn sửa được (Sửa thẳng); app__ca_direct_guard chặn nếu làm đổi số lệch đã duyệt
  if public.app__fin_locked(r.branch_id,r.work_date) then raise exception 'Tháng này đã CHỐT.'; end if;
  if why='' then raise exception 'Ghi lý do sửa hoặc xoá khoản khách trả.'; end if;
  select * into d from public.shift_debts where id=p_debt for update;
  if d.id is null or d.closed_report_id is distinct from p_report then raise exception 'Khoản khách trả không thuộc ca này.'; end if;
  if exists(select 1 from public.shift_report_results x where x.report_id=p_report and x.item=d.collect_kind)
     or exists(select 1 from public.shift_report_checks x where x.report_id=p_report and x.item=d.collect_kind) then
    raise exception 'Mục % đã đối soát — bấm Sửa ở mục đó để mở lại trước.',case when d.collect_kind='tien_mat' then 'Tiền mặt' else 'Chuyển khoản' end;
  end if;
  select * into rest from public.shift_debts where split_from=d.id and closed_at is null order by id limit 1;
  if rest.id is not null then
    update public.shift_debts set amount=d.amount+rest.amount where id=d.id;
    delete from public.shift_debts where id=rest.id;
  end if;
  update public.shift_debts set closed_at=null,closed_by=null,closed_report_id=null,collect_kind=null,close_note=null where id=p_debt;
  perform public.app_log('doi_soat_bo_thu_no','report='||p_report||' debt='||p_debt||' · '||why);
  perform public.app__ca_direct_guard(p_report);
end $function$;

-- ================================================================ 6. Quản lý sửa Bàn giao ca sau và ảnh phiếu Fabi ở bước Kiểm tra
-- Cùng quy tắc bàn giao với app__ca_save_core (dòng đã giao thành việc — task_id — không xoá / sửa). Bắt buộc lý do, ghi shift_recon_log.
create or replace function public.app_ca_recon_handover_save(p_id bigint, p_items jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; why text := nullif(trim(coalesce(p_reason, '')), ''); x jsonb; nid bigint;
        keep bigint[]; before jsonb; after jsonb; ids bigint[] := '{}';
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu chưa gửi nên chưa sửa ở bước Kiểm tra được.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT — không sửa được.'; end if;
  if jsonb_typeof(coalesce(p_items, '[]')) <> 'array' then raise exception 'Danh sách bàn giao không hợp lệ.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'content', h.content) order by h.id), '[]') into before
    from public.handover_items h where h.report_id = r.id and h.task_id is null;
  keep := array(select (h ->> 'id')::bigint from jsonb_array_elements(coalesce(p_items, '[]')) h where nullif(h ->> 'id', '') is not null);
  -- chỉ đổi khi có khác; khác mà không lý do → từ chối
  if exists (select 1 from public.handover_items h where h.report_id = r.id and h.task_id is null and not (h.id = any(keep)))
     or exists (select 1 from jsonb_array_elements(coalesce(p_items, '[]')) h
                 where trim(coalesce(h ->> 'content', '')) <> ''
                   and (nullif(h ->> 'id', '') is null
                        or not exists (select 1 from public.handover_items i where i.id = (h ->> 'id')::bigint and i.report_id = r.id and i.task_id is null and i.content = trim(h ->> 'content'))))
  then
    if why is null then raise exception 'Ghi lý do sửa bàn giao.'; end if;
  else
    return jsonb_build_object('ids', to_jsonb(keep));
  end if;
  delete from public.handover_items where report_id = r.id and task_id is null and not (id = any(keep));
  for x in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    if trim(coalesce(x ->> 'content', '')) = '' then
      if nullif(x ->> 'id', '') is not null then delete from public.handover_items where id = (x ->> 'id')::bigint and report_id = r.id and task_id is null; end if;
      continue;
    end if;
    if nullif(x ->> 'id', '') is null then
      insert into public.handover_items(branch_id, report_id, content, created_by) values (r.branch_id, r.id, trim(x ->> 'content'), a.id) returning id into nid;
    else
      nid := (x ->> 'id')::bigint;
      update public.handover_items set content = trim(x ->> 'content') where id = nid and report_id = r.id and task_id is null;
    end if;
    ids := ids || nid;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'content', h.content) order by h.id), '[]') into after
    from public.handover_items h where h.report_id = r.id and h.task_id is null;
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account) values (r.id, 'sua', 'handover', before, after, why, a.id);
  perform public.app_log('doi_soat_sua_ban_giao', 'report=' || r.id);
  return jsonb_build_object('ids', to_jsonb(ids));
end $$;

create or replace function public.app_ca_recon_photo_add(p_id bigint, p_path text, p_reason text) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; why text := nullif(trim(coalesce(p_reason, '')), ''); nid bigint;
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_id;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu chưa gửi nên chưa sửa ở bước Kiểm tra được.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT — không sửa được.'; end if;
  if why is null then raise exception 'Ghi lý do thêm ảnh.'; end if;
  if coalesce(p_path, '') !~ ('^r' || p_id || '/ipos/[^/]+$') then raise exception 'Đường dẫn ảnh không hợp lệ.'; end if;
  insert into public.shift_report_photos(report_id, path, created_by, kind) values (p_id, p_path, a.id, 'ipos') returning id into nid;
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account) values (p_id, 'sua', 'photo_ipos', null, to_jsonb(p_path), why, a.id);
  return nid;
end $$;

-- Xoá khỏi phiếu (giữ tệp ảnh trong kho để còn đối chiếu). Phiếu luôn còn ít nhất 1 ảnh phiếu Fabi.
create or replace function public.app_ca_recon_photo_del(p_photo bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; ph public.shift_report_photos; r public.shift_reports; why text := nullif(trim(coalesce(p_reason, '')), '');
begin
  a := public.app__need('doi_soat');
  select * into ph from public.shift_report_photos where id = p_photo and kind = 'ipos';
  if ph.id is null then raise exception 'Không tìm thấy ảnh phiếu Fabi.'; end if;
  select * into r from public.shift_reports where id = ph.report_id for update;
  if r.status <> 'hoan_thanh' then raise exception 'Phiếu chưa gửi nên chưa sửa ở bước Kiểm tra được.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT — không sửa được.'; end if;
  if why is null then raise exception 'Ghi lý do xoá ảnh.'; end if;
  if (select count(*) from public.shift_report_photos where report_id = r.id and kind = 'ipos') <= 1 then
    raise exception 'Phiếu phải còn ít nhất 1 ảnh phiếu Fabi — thêm ảnh đúng trước rồi mới xoá ảnh này.';
  end if;
  delete from public.shift_report_photos where id = ph.id;
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account) values (r.id, 'sua', 'photo_ipos', to_jsonb(ph.path), null, why, a.id);
end $$;

revoke all on function public.app_ca_recon_handover_save(bigint, jsonb, text), public.app_ca_recon_photo_add(bigint, text, text), public.app_ca_recon_photo_del(bigint, text) from public, anon;
grant execute on function public.app_ca_recon_handover_save(bigint, jsonb, text), public.app_ca_recon_photo_add(bigint, text, text), public.app_ca_recon_photo_del(bigint, text) to authenticated;

CREATE OR REPLACE FUNCTION public.app__storage_ca_upload(p_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m text[] := regexp_match(coalesce(p_name, ''), '^r([0-9]+)/(ipos|hang)/[^/]+$');
  old_m text[];
  rid bigint;
  wanted_part text;
  aid bigint := (public.app_account()).id;
begin
  if aid is null then return false; end if;
  if m is not null then
    rid := m[1]::bigint;
    -- bước 119: quản lý (quyền đối soát) thêm ảnh phiếu Fabi cho phiếu đã gửi, tháng chưa chốt
    if m[2] = 'ipos' and coalesce(public.app_can('doi_soat'), false)
       and exists (select 1 from public.shift_reports r where r.id = rid and r.status = 'hoan_thanh' and not public.app__fin_locked(r.branch_id, r.work_date)) then
      return true;
    end if;
    wanted_part := case when m[2] = 'ipos' then 'tien' else 'nhan_hang' end;
    return exists (
      select 1 from public.shift_reports r
      join public.shift_report_parts pt on pt.report_id = r.id and pt.part = wanted_part
      where r.id = rid and r.status = 'dang_chot'
        and pt.claimed_by = aid and pt.done_at is null
        and public.app__ca_part_can(r.id)
    );
  end if;
  old_m := regexp_match(coalesce(p_name, ''), '^r([0-9]+)/[^/]+$');
  if old_m is null then return false; end if;
  rid := old_m[1]::bigint;
  return exists (
    select 1 from public.shift_reports r
    join public.shift_report_parts pt on pt.report_id = r.id
    where r.id = rid and r.status = 'dang_chot'
      and pt.claimed_by = aid and pt.done_at is null
      and public.app__ca_part_can(r.id)
  );
end $function$;

insert into public.app_migrations(file) values ('101_ql_sua_phieu.sql') on conflict (file) do nothing;
