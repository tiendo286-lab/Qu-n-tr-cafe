-- Bước 84 (anh Tiến 13/11/2026): phiếu chốt ca phần tiền mới.
--  * Thêm loại nợ "Nợ CK" (kind 'ck'): Fabi ghi chuyển khoản nhưng khách chưa chuyển → trừ khỏi tiền phải nhận trên hotline, các ca sau nhắc thu.
--  * Nợ HĐ (bill) mới phải bằng dòng Nợ trên phiếu Fabi; Nợ TM / Nợ CK không tính vào đó.
--  * Gửi phiếu không còn bắt ghi lý do khi lệch tiền mặt / chuyển khoản / số dư đầu — quản lý tự chốt khi đối soát.
-- Chạy lại nhiều lần không sao.

alter table public.shift_debts drop constraint if exists shift_debts_kind_ck;
alter table public.shift_debts add constraint shift_debts_kind_ck check (kind in ('bill', 'muon', 'ck'));

CREATE OR REPLACE FUNCTION public.app__ca_save_core(p_id bigint, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; x jsonb; i int := 0; keep bigint[]; nid bigint;
        h_ids jsonb := '[]'; d_ids jsonb := '[]'; forced text;
begin
  a := public.app_account();
  r := public.app__ca_need_edit(p_id);
  forced := public.app__ca_forced_start(r);
  update public.shift_reports set
    rev_start = coalesce(forced, nullif(p ->> 'rev_start', '')),
    rev_end = nullif(p ->> 'rev_end', ''),
    total_revenue = nullif(p ->> 'total_revenue', '')::bigint,
    pos_cash = nullif(p ->> 'pos_cash', '')::bigint,
    pos_transfer = nullif(p ->> 'pos_transfer', '')::bigint,
    reported_transfer = nullif(p ->> 'reported_transfer', '')::bigint,
    cash_counted = nullif(p ->> 'cash_counted', '')::bigint,
    opening_cash = case when r.shift = (public.app__shifts())[1] then 1000000
                        when not public.app__ca_chain(r.shift) then nullif(p ->> 'opening_cash', '')::bigint
                        else coalesce(nullif(p ->> 'ipos_opening', '')::bigint, r.opening_cash) end,
    opening_note = nullif(trim(coalesce(p ->> 'opening_note', '')), ''),
    ipos_opening = case when p ? 'ipos_opening' then nullif(p ->> 'ipos_opening', '')::bigint else r.ipos_opening end,
    cups = nullif(p ->> 'cups', '')::int,
    pos_debt = case when p ? 'pos_debt' then nullif(p ->> 'pos_debt', '')::bigint else r.pos_debt end,
    pos_diff = case when p ? 'pos_diff' then nullif(p ->> 'pos_diff', '')::bigint else r.pos_diff end,
    diff_note = case when p ? 'diff_note' then nullif(trim(coalesce(p ->> 'diff_note', '')), '') else r.diff_note end,
    transfer_note = case when p ? 'transfer_note' then nullif(trim(coalesce(p ->> 'transfer_note', '')), '') else r.transfer_note end,
    goods_status = nullif(p ->> 'goods_status', ''),
    goods_note = nullif(p ->> 'goods_note', ''),
    updated_by = a.id, updated_at = public.vn_now_text()
  where id = r.id;

  delete from public.shift_report_moves where report_id = r.id;
  for x in select * from jsonb_array_elements(coalesce(p -> 'moves', '[]')) loop
    i := i + 1;
    insert into public.shift_report_moves(report_id, kind, amount, note, sort_order)
    values (r.id, x ->> 'kind', coalesce(nullif(x ->> 'amount', '')::bigint, 0), coalesce(x ->> 'note', ''), i);
  end loop;

  delete from public.shift_report_staff where report_id = r.id;
  for x in select * from jsonb_array_elements(coalesce(p -> 'staff', '[]')) loop
    if coalesce(nullif(x ->> 'cash_paid', '')::bigint, 0) < 0 then raise exception 'Số tiền lương đã trả không được âm.'; end if;
    insert into public.shift_report_staff(report_id, employee_id, source, role, worked, absent_reason, time_in, time_out, note, cash_paid)
    values (r.id, (x ->> 'employee_id')::bigint, coalesce(x ->> 'source', 'ho_tro'), nullif(x ->> 'role', ''),
            case when (x ->> 'worked')::boolean then 1 else 0 end, nullif(x ->> 'absent_reason', ''),
            nullif(x ->> 'time_in', ''), nullif(x ->> 'time_out', ''), nullif(x ->> 'note', ''),
            case when (x ->> 'worked')::boolean and exists (select 1 from public.employees e where e.id = (x ->> 'employee_id')::bigint and e.pay_cash)
                 then nullif(nullif(x ->> 'cash_paid', '')::bigint, 0) end)
    on conflict (report_id, employee_id) do nothing;
  end loop;

  delete from public.shift_report_goods where report_id = r.id;
  insert into public.shift_report_goods(report_id, item, qty)
  select r.id, trim(g ->> 'item'), coalesce(g ->> 'qty', '') from jsonb_array_elements(coalesce(p -> 'goods', '[]')) g
   where trim(coalesce(g ->> 'item', '')) <> '';

  keep := array(select (h ->> 'id')::bigint from jsonb_array_elements(coalesce(p -> 'handover', '[]')) h where h ->> 'id' is not null);
  delete from public.handover_items where report_id = r.id and task_id is null and not (id = any(keep));
  for x in select * from jsonb_array_elements(coalesce(p -> 'handover', '[]')) loop
    if trim(coalesce(x ->> 'content', '')) = '' then h_ids := h_ids || 'null'::jsonb; continue; end if;
    if x ->> 'id' is null then
      insert into public.handover_items(branch_id, report_id, content, created_by) values (r.branch_id, r.id, trim(x ->> 'content'), a.id)
      returning id into nid;
    else
      nid := (x ->> 'id')::bigint;
      update public.handover_items set content = trim(x ->> 'content') where id = nid and report_id = r.id and task_id is null;
    end if;
    h_ids := h_ids || to_jsonb(nid);
  end loop;

  keep := array(select (d ->> 'id')::bigint from jsonb_array_elements(coalesce(p -> 'debts', '[]')) d where d ->> 'id' is not null);
  delete from public.shift_debts where report_id = r.id and closed_at is null and not (id = any(keep));
  for x in select * from jsonb_array_elements(coalesce(p -> 'debts', '[]')) loop
    if trim(coalesce(x ->> 'table_name', '')) = '' then d_ids := d_ids || 'null'::jsonb; continue; end if;
    if x ->> 'id' is null then
      insert into public.shift_debts(branch_id, report_id, table_name, amount, note, created_by, kind)
      values (r.branch_id, r.id, trim(x ->> 'table_name'), coalesce(nullif(x ->> 'amount', '')::bigint, 0), nullif(x ->> 'note', ''), a.id,
              case when x ->> 'kind' in ('muon', 'ck') then x ->> 'kind' else 'bill' end)
      returning id into nid;
    else
      nid := (x ->> 'id')::bigint;
      update public.shift_debts set table_name = trim(x ->> 'table_name'), amount = coalesce(nullif(x ->> 'amount', '')::bigint, 0),
             note = nullif(x ->> 'note', ''), kind = case when x ->> 'kind' in ('bill', 'muon', 'ck') then x ->> 'kind' else kind end
       where id = nid and report_id = r.id and closed_at is null;
    end if;
    d_ids := d_ids || to_jsonb(nid);
  end loop;
  return jsonb_build_object('at', public.vn_now_text(), 'rev_start', coalesce(forced, nullif(p ->> 'rev_start', '')),
                            'handover_ids', h_ids, 'debt_ids', d_ids);
end $function$;

CREATE OR REPLACE FUNCTION public.app__ca_part_check(p_id bigint, p_part text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.shift_reports; s record; debt_new bigint; miss text[] := '{}'; h jsonb; is_first boolean;
        col_tm bigint; col_ck bigint; col_tm_all bigint; loan_out bigint; sal bigint; mv_tm bigint; mv_ck bigint; tm_left bigint; ck_left bigint;
begin
  select * into r from public.shift_reports where id = p_id;
  if p_part = 'tien' then
    is_first := r.shift = (public.app__shifts())[1];
    if public.app__ca_forced_start(r) is not null and r.rev_start is distinct from public.app__ca_forced_start(r) then
      update public.shift_reports set rev_start = public.app__ca_forced_start(r) where id = r.id;
      r.rev_start := public.app__ca_forced_start(r);
    end if;
    if r.opening_cash is null and not is_first then
      miss := miss || (case when public.app__ca_chain(r.shift) then 'Đếm nhận két đầu ca' else 'Tiền mặt đầu ca' end)::text;
    end if;
    if r.ipos_opening is null then miss := miss || 'Số dư đầu (phiếu Fabi)'::text; end if;
    if r.pos_debt is null then miss := miss || 'Nợ (phiếu Fabi, không có thì nhập 0)'::text; end if;
    if r.pos_diff is null then miss := miss || 'Tiền chênh lệch (phiếu Fabi)'::text; end if;
    if r.rev_start is null or r.rev_end is null then miss := miss || 'giờ bắt đầu/kết thúc doanh thu'::text; end if;
    if r.rev_start is not null and r.rev_end is not null and r.rev_end <= r.rev_start then
      raise exception 'Giờ kết thúc doanh thu phải sau giờ bắt đầu (nếu qua nửa đêm, chọn ngày hôm sau).';
    end if;
    if r.total_revenue is null then miss := miss || 'Mục 1 Tổng doanh thu'::text; end if;
    if r.pos_cash is null then miss := miss || 'Mục 2 Tiền mặt POS'::text; end if;
    if r.pos_transfer is null then miss := miss || 'Mục 3 Chuyển khoản POS'::text; end if;
    if r.reported_transfer is null then miss := miss || 'Mục 4 Chuyển khoản thực tế'::text; end if;
    if r.cash_counted is null then miss := miss || 'Mục 5 Tiền trong két'::text; end if;
    if r.opening_cash is null and is_first then miss := miss || 'Tiền mặt đầu ca'::text; end if;
    if r.cups is null and not exists (select 1 from public.fabi_stores fs where fs.branch_id = r.branch_id) then miss := miss || 'Số cốc bán'::text; end if;   -- bước 49
    if not exists (select 1 from public.shift_report_photos where report_id = r.id and kind = 'ipos') then miss := miss || 'Ảnh phiếu chốt ca iPOS'::text; end if;
    if array_length(miss, 1) > 0 then raise exception 'Phần TIỀN còn thiếu: %.', array_to_string(miss, ', '); end if;
    if least(r.total_revenue, r.pos_cash, r.pos_transfer, r.reported_transfer, r.cash_counted, r.opening_cash, r.cups, r.ipos_opening) < 0 then
      raise exception 'Các số liệu doanh thu, tiền, số cốc không được âm.';
    end if;
    if exists (select 1 from public.shift_debts where report_id = r.id and amount <= 0) then
      raise exception 'Mỗi bàn còn nợ / khách mượn cần số tiền lớn hơn 0.';
    end if;
    select coalesce(sum(amount), 0) into debt_new from public.shift_debts where report_id = r.id and coalesce(kind, 'bill') = 'bill';
    select coalesce(sum(amount), 0) into loan_out from public.shift_debts where report_id = r.id and kind = 'muon';
    if r.total_revenue <> r.pos_cash + r.pos_transfer + debt_new then
      raise exception 'Mục 1 (Tổng doanh thu) phải bằng Mục 2 + Mục 3 + Công nợ phát sinh (%). Đang lệch % — hãy sửa trước khi bấm Xong.',
        public.app__vnd(debt_new), public.app__vnd(r.total_revenue - r.pos_cash - r.pos_transfer - debt_new);
    end if;
    h := public.app__ca_hand(r.id);
    if h is not null then
      if h ->> 'state' = 'can_dem_lai' then
        raise exception 'Tiền nhận két lệch két cuối ca % (%). Hãy cùng 1 người ca % đếm lại và nhập số đếm lại trước khi bấm Xong.',
          h ->> 'prev_shift', public.app__vnd((h ->> 'gap')::bigint), h ->> 'prev_shift';
      end if;
    end if;
    -- Bước 41: kiểm tra theo phiếu Fabi
    if r.total_revenue <> r.pos_cash + r.pos_transfer + r.pos_debt then
      raise exception 'Chuyển khoản + Tiền mặt + Nợ (%) phải bằng Doanh thu NET (%). Có số gõ nhầm — xem lại phiếu Fabi.',
        public.app__vnd(r.pos_cash + r.pos_transfer + r.pos_debt), public.app__vnd(r.total_revenue);
    end if;
    if debt_new <> r.pos_debt then
      raise exception 'Tổng các bàn nợ (%) phải bằng dòng Nợ trên phiếu Fabi (%).', public.app__vnd(debt_new), public.app__vnd(r.pos_debt);
    end if;
    -- col_tm: khách trả BILL nợ bằng tiền mặt (Fabi đã cộng vào tiền phải có); col_tm_all: cả khách trả tiền mượn (Fabi không biết)
    select coalesce(sum(d.amount) filter (where d.collect_kind = 'tien_mat' and coalesce(d.kind, 'bill') = 'bill'), 0),
           coalesce(sum(d.amount) filter (where d.collect_kind = 'tien_mat'), 0), coalesce(sum(d.amount) filter (where d.collect_kind = 'chuyen_khoan'), 0)
      into col_tm, col_tm_all, col_ck from public.shift_debts d where d.closed_report_id = r.id;
    if r.cash_counted - r.ipos_opening - r.pos_cash - col_tm <> r.pos_diff then
      raise exception 'Tổng tiền − Số dư đầu − Tiền mặt% = %, khác Tiền chênh lệch trên phiếu (%). Có số gõ nhầm — xem lại phiếu Fabi.',
        case when col_tm <> 0 then ' − khách trả nợ tiền mặt' else '' end,
        public.app__vnd(r.cash_counted - r.ipos_opening - r.pos_cash - col_tm), public.app__vnd(r.pos_diff);
    end if;
    select coalesce(sum(st.cash_paid), 0) into sal from public.shift_report_staff st where st.report_id = r.id and st.worked = 1;
    select coalesce(sum(amount) filter (where kind = 'tien_mat'), 0), coalesce(sum(amount) filter (where kind = 'chuyen_khoan'), 0)
      into mv_tm, mv_ck from public.shift_report_moves where report_id = r.id;
    tm_left := r.cash_counted - r.opening_cash - r.pos_cash - (mv_tm - sal - loan_out) - col_tm_all;
    ck_left := r.reported_transfer - r.pos_transfer - mv_ck - col_ck;
    -- bước 84: lệch tiền mặt / chuyển khoản / số dư đầu KHÔNG bắt ghi lý do — quản lý tự chốt khi đối soát
    if exists (select 1 from public.shift_debts where report_id = r.id and kind in ('muon', 'ck') and trim(table_name) = '') then
      raise exception 'Nợ TM / Nợ CK: ghi tên khách.';
    end if;
    if exists (select 1 from public.shift_report_moves where report_id = r.id and (amount = 0 or trim(note) = '')) then
      raise exception 'Mỗi dòng thu chi cần số tiền khác 0 và nội dung.';
    end if;
  elsif p_part = 'nhan_su' then
    for s in select e.code, e.name, st.* from public.shift_report_staff st join public.employees e on e.id = st.employee_id where st.report_id = r.id loop
      if s.worked = 1 and (s.time_in is null or s.time_out is null) then
        raise exception 'Nhập giờ đến và giờ về của % – %.', s.code, s.name;
      end if;
      if s.worked = 0 and coalesce(trim(s.absent_reason), '') = '' then
        raise exception 'Ghi lý do nghỉ của % – %.', s.code, s.name;
      end if;
    end loop;
  end if;
  -- NHẬN HÀNG: số thực nhận đã bắt buộc khi báo nhận; thiếu ảnh vẫn cho Xong (nằm trong báo cáo hồ sơ còn thiếu)
end $function$;

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
  cc := (d ->> 'cash_counted')::bigint; op := (d ->> 'opening_cash')::bigint; pc := (d ->> 'pos_cash')::bigint;
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
  return jsonb_build_object('sum_gap', tot - pc - pt - debt_new, 'debt_new', debt_new, 'ck_new', ck_new, 'col_tm', col_tm, 'col_ck', col_ck,
    'tm_moves', tm_mv, 'ck_moves', ck_mv, 'tm_left_self', tm_left, 'handover_gap', hg, 'tm_left', tm_left + hg,
    'next_hand', case when nh is not null and nh ->> 'state' not in ('chua_dem', 'cho_ca_truoc') then jsonb_build_object('shift', ns, 'id', nx.id,
       'state', nh ->> 'state', 'counted', (nh ->> 'counted')::bigint, 'first_count', (nh ->> 'first_count')::bigint, 'gap', (nh ->> 'gap')::bigint,
       'giver', nh ->> 'giver', 'counted_by', nh ->> 'counted_by', 'counted_at', nh ->> 'counted_at', 'recount_at', nh ->> 'recount_at') end,
    'ck_left_nv', ck_nv, 'ck_left_bank', ck_bank,
    'bank_received', (b ->> 'received')::bigint, 'bank_ok', bank_ok,
    'ck_basis', case when bank_ok then 'ke_toan' else 'nhan_vien' end, 'ck_left', coalesce(ck_bank, ck_nv));
end $function$;

CREATE OR REPLACE FUNCTION public.app__ca_money_selfcheck(p_days integer DEFAULT 45)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'tm_money', z.tm1, 'tm_check', z.tm2, 'ck_money', z.ck1, 'ck_check', z.ck2)), '[]')
    from (select r.id, (m ->> 'tm_left_self')::bigint tm1, (m ->> 'ck_left_nv')::bigint ck1,
                 r.cash_counted - r.opening_cash - r.pos_cash
                   - ((select coalesce(sum(amount), 0) from public.shift_report_moves where report_id = r.id and kind = 'tien_mat')
                      - (select coalesce(sum(cash_paid), 0) from public.shift_report_staff where report_id = r.id and worked = 1)
                      - (select coalesce(sum(amount), 0) from public.shift_debts where report_id = r.id and kind = 'muon'))
                   - (select coalesce(sum(amount), 0) from public.shift_debts where closed_report_id = r.id and collect_kind = 'tien_mat') tm2,
                 r.reported_transfer - r.pos_transfer
                   - (select coalesce(sum(amount), 0) from public.shift_report_moves where report_id = r.id and kind = 'chuyen_khoan')
                   - (select coalesce(sum(amount), 0) from public.shift_debts where closed_report_id = r.id and collect_kind = 'chuyen_khoan')
                   + (select coalesce(sum(amount), 0) from public.shift_debts where report_id = r.id and kind = 'ck') ck2
            from public.shift_reports r cross join lateral (select public.app__ca_money(r.id) m) mm
           where r.status = 'hoan_thanh' and r.work_date >= to_char(public.vn_now()::date - p_days, 'YYYY-MM-DD')
             and not exists (select 1 from public.shift_report_recon x where x.report_id = r.id)) z
   where z.tm1 is distinct from z.tm2 or z.ck1 is distinct from z.ck2
$function$;

CREATE OR REPLACE FUNCTION public.app_cn_debt_to_family(p_id bigint, p_person bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
          case when d.kind = 'muon' then 'Nợ TM – ' when d.kind = 'ck' then 'Nợ CK – ' else 'Nợ HĐ – ' end || d.table_name || coalesce(' · ' || nullif(d.note, ''), ''),
          a.id, 'vay', coalesce(d.report_id, d.gap_report), d.id) returning id into nid;
  update public.shift_debts set closed_at = public.vn_now_text(), closed_by = a.id, closed_report_id = null, collect_kind = 'gia_dinh',
         close_note = 'Chuyển sang công nợ gia đình' where id = d.id;
  perform public.app_log('no_sang_gia_dinh', 'debt=' || d.id || ' loan=' || nid || ' ' || d.amount);
  return nid;
end $function$;

insert into public.app_migrations(file) values ('82_no_ck_chot_ca.sql') on conflict (file) do nothing;
