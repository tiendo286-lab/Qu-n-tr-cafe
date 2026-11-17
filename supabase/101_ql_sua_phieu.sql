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
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu chưa hoàn thành nên chưa đối soát được.'; end if;
  if dir is null and r.recon_status = 'hoan_thanh' then raise exception 'Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.'; end if;
  -- bước 67: Chủ sửa thẳng → chỉ các trường của mục đang sửa được đổi, mọi trường khác giữ nguyên
  lk := case when dir is not null then coalesce((select array_agg(x) from unnest(public.app__recon_fields()) x where not (x = any(dir))), '{}')
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

insert into public.app_migrations(file) values ('101_ql_sua_phieu.sql') on conflict (file) do nothing;
