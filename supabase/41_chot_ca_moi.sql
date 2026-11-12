-- =====================================================================
-- BƯỚC 41: CHỐT CA MỚI — ĐỢT 1 (phiếu nhân viên theo phiếu Fabi). Anh Tiến chốt 12/11/2026. Chạy sau 40. Chạy lại nhiều lần không sao.
--  * 1 người chốt chính (nhận cả phần TIỀN + NHÂN SỰ), gõ số theo thứ tự trên phiếu Fabi.
--  * Thêm: pos_debt (Nợ trên phiếu), pos_diff (Tiền chênh lệch trên phiếu), diff_note (lý do lệch tiền mặt), transfer_note (lý do lệch chuyển khoản).
--  * Bỏ đếm mù khi nhận két: tiền đầu ca (ca trong chuỗi két) = Số dư đầu trên phiếu Fabi; so với Tổng tiền ca trước; KHÔNG cho phép lệch (mức cho qua = 0).
--  * Kiểm tra khi gửi: CK + TM + Nợ = NET; tổng bàn nợ = Nợ; Tổng tiền − Số dư đầu − TM − trả nợ TM = Tiền chênh lệch;
--    ca sáng số dư đầu = 1.000.000 (khác thì ghi lý do); còn lệch tiền mặt / chuyển khoản sau thu chi → bắt buộc ghi lý do.
-- =====================================================================

alter table public.shift_reports add column if not exists pos_debt bigint;
alter table public.shift_reports add column if not exists pos_diff bigint;
alter table public.shift_reports add column if not exists diff_note text;
alter table public.shift_reports add column if not exists transfer_note text;

create or replace function public.app__ca_tol() returns bigint
language sql immutable as $$ select 0::bigint $$;

create or replace function public.app__ca_save_core(p_id bigint, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
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
      insert into public.shift_debts(branch_id, report_id, table_name, amount, note, created_by)
      values (r.branch_id, r.id, trim(x ->> 'table_name'), coalesce(nullif(x ->> 'amount', '')::bigint, 0), nullif(x ->> 'note', ''), a.id)
      returning id into nid;
    else
      nid := (x ->> 'id')::bigint;
      update public.shift_debts set table_name = trim(x ->> 'table_name'), amount = coalesce(nullif(x ->> 'amount', '')::bigint, 0),
             note = nullif(x ->> 'note', '')
       where id = nid and report_id = r.id and closed_at is null;
    end if;
    d_ids := d_ids || to_jsonb(nid);
  end loop;
  return jsonb_build_object('at', public.vn_now_text(), 'rev_start', coalesce(forced, nullif(p ->> 'rev_start', '')),
                            'handover_ids', h_ids, 'debt_ids', d_ids);
end $$;

create or replace function public.app_ca_save(p_id bigint, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; mine text[]; q jsonb := coalesce(p, '{}'::jsonb);
begin
  a := public.app_account();
  r := public.app__ca_need_edit(p_id);
  select coalesce(array_agg(part), '{}') into mine from public.shift_report_parts
   where report_id = r.id and claimed_by = a.id and done_at is null;
  if not ('tien' = any(mine) or 'nhan_su' = any(mine)) then
    return jsonb_build_object('at', public.vn_now_text(), 'skipped', true, 'rev_start', r.rev_start, 'handover_ids', '[]'::jsonb, 'debt_ids', '[]'::jsonb);
  end if;
  if not ('tien' = any(mine)) then
    q := q || jsonb_build_object('rev_start', r.rev_start, 'rev_end', r.rev_end, 'total_revenue', r.total_revenue, 'pos_cash', r.pos_cash,
      'pos_transfer', r.pos_transfer, 'reported_transfer', r.reported_transfer, 'cash_counted', r.cash_counted, 'opening_cash', r.opening_cash,
      'opening_note', r.opening_note, 'ipos_opening', r.ipos_opening, 'cups', r.cups,
      'pos_debt', r.pos_debt, 'pos_diff', r.pos_diff, 'diff_note', r.diff_note, 'transfer_note', r.transfer_note,
      'moves', coalesce((select jsonb_agg(jsonb_build_object('kind', m.kind, 'amount', m.amount, 'note', m.note) order by m.sort_order, m.id)
                           from public.shift_report_moves m where m.report_id = r.id), '[]'::jsonb),
      'debts', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'table_name', d.table_name, 'amount', d.amount, 'note', d.note) order by d.id)
                           from public.shift_debts d where d.report_id = r.id), '[]'::jsonb));
  end if;
  if not ('nhan_su' = any(mine)) then
    q := q || jsonb_build_object(
      'staff', coalesce((select jsonb_agg(jsonb_build_object('employee_id', s.employee_id, 'source', s.source, 'role', s.role, 'worked', s.worked = 1,
                           'absent_reason', s.absent_reason, 'time_in', s.time_in, 'time_out', s.time_out, 'note', s.note, 'cash_paid', s.cash_paid))
                           from public.shift_report_staff s where s.report_id = r.id), '[]'::jsonb),
      'handover', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'content', h.content) order by h.id)
                              from public.handover_items h where h.report_id = r.id), '[]'::jsonb));
  end if;
  -- nhập hàng kiểu cũ: giữ nguyên
  q := q || jsonb_build_object('goods_status', r.goods_status, 'goods_note', r.goods_note,
    'goods', coalesce((select jsonb_agg(jsonb_build_object('item', g.item, 'qty', g.qty) order by g.id) from public.shift_report_goods g where g.report_id = r.id), '[]'::jsonb));
  return public.app__ca_save_core(p_id, q) || jsonb_build_object('parts', to_jsonb(mine));
end $$;

create or replace function public.app__ca_part_check(p_id bigint, p_part text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; s record; debt_new bigint; miss text[] := '{}'; h jsonb; is_first boolean;
        col_tm bigint; col_ck bigint; sal bigint; mv_tm bigint; mv_ck bigint; tm_left bigint; ck_left bigint;
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
    if r.cups is null then miss := miss || 'Số cốc bán'::text; end if;
    if not exists (select 1 from public.shift_report_photos where report_id = r.id and kind = 'ipos') then miss := miss || 'Ảnh phiếu chốt ca iPOS'::text; end if;
    if array_length(miss, 1) > 0 then raise exception 'Phần TIỀN còn thiếu: %.', array_to_string(miss, ', '); end if;
    if least(r.total_revenue, r.pos_cash, r.pos_transfer, r.reported_transfer, r.cash_counted, r.opening_cash, r.cups, r.ipos_opening) < 0 then
      raise exception 'Các số liệu doanh thu, tiền, số cốc không được âm.';
    end if;
    if exists (select 1 from public.shift_debts where report_id = r.id and amount <= 0) then
      raise exception 'Mỗi bàn còn nợ cần số tiền lớn hơn 0.';
    end if;
    select coalesce(sum(amount), 0) into debt_new from public.shift_debts where report_id = r.id;
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
      if h ->> 'state' = 'lech' and coalesce(trim(r.opening_note), '') = '' then
        raise exception 'Tiền nhận két (%) lệch két cuối ca % (%). Ghi lý do lệch trước khi bấm Xong.',
          public.app__vnd(r.opening_cash), h ->> 'prev_shift', public.app__vnd((h ->> 'prev_cash')::bigint);
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
    select coalesce(sum(d.amount) filter (where d.collect_kind = 'tien_mat'), 0), coalesce(sum(d.amount) filter (where d.collect_kind = 'chuyen_khoan'), 0)
      into col_tm, col_ck from public.shift_debts d where d.closed_report_id = r.id;
    if r.cash_counted - r.ipos_opening - r.pos_cash - col_tm <> r.pos_diff then
      raise exception 'Tổng tiền − Số dư đầu − Tiền mặt% = %, khác Tiền chênh lệch trên phiếu (%). Có số gõ nhầm — xem lại phiếu Fabi.',
        case when col_tm <> 0 then ' − khách trả nợ tiền mặt' else '' end,
        public.app__vnd(r.cash_counted - r.ipos_opening - r.pos_cash - col_tm), public.app__vnd(r.pos_diff);
    end if;
    if is_first and r.ipos_opening <> 1000000 and coalesce(trim(r.opening_note), '') = '' then
      raise exception 'Số dư đầu ca sáng (%) khác tiền gối đầu 1.000.000đ. Ghi lý do trước khi gửi.', public.app__vnd(r.ipos_opening);
    end if;
    select coalesce(sum(st.cash_paid), 0) into sal from public.shift_report_staff st where st.report_id = r.id and st.worked = 1;
    select coalesce(sum(amount) filter (where kind = 'tien_mat'), 0), coalesce(sum(amount) filter (where kind = 'chuyen_khoan'), 0)
      into mv_tm, mv_ck from public.shift_report_moves where report_id = r.id;
    tm_left := r.cash_counted - r.opening_cash - r.pos_cash - (mv_tm - sal) - col_tm;
    ck_left := r.reported_transfer - r.pos_transfer - mv_ck - col_ck;
    if tm_left <> 0 and coalesce(trim(r.diff_note), '') = '' then
      raise exception 'Tiền mặt còn lệch % sau khi tính các khoản thu chi. Lệch 1 đồng cũng phải ghi lý do.', public.app__vnd(tm_left);
    end if;
    if ck_left <> 0 and coalesce(trim(r.transfer_note), '') = '' then
      raise exception 'Chuyển khoản trên hotline lệch % so với số phải có. Ghi lý do lệch chuyển khoản.', public.app__vnd(ck_left);
    end if;
    if r.ipos_opening <> r.opening_cash and coalesce(trim(r.opening_note), '') = '' then
      raise exception 'Số dư đầu trên iPOS (%) khác tiền nhận két (%). Ghi lý do trước khi bấm Xong.',
        public.app__vnd(r.ipos_opening), public.app__vnd(r.opening_cash);
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
end $$;

create or replace function public.app_ca_get(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
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
    'open_debts', coalesce((select jsonb_agg(to_jsonb(d) || jsonb_build_object('from_date', o.work_date, 'from_shift', o.shift,
                            'closed_by_name', public.app__acc_name(d.closed_by)) order by d.id)
                           from public.shift_debts d join public.shift_reports o on o.id = d.report_id
                          where d.branch_id = r.branch_id and d.report_id <> r.id
                            and (o.work_date, array_position(public.app__shifts(), o.shift)) < (r.work_date, array_position(public.app__shifts(), r.shift))
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
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('app__ca_tol', 'app__ca_save_core', 'app_ca_save', 'app__ca_part_check', 'app_ca_get') loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname like 'app\_\_%' then execute format('revoke execute on function %s from authenticated', f.sig);
    else execute format('grant execute on function %s to authenticated', f.sig); end if;
  end loop;
end $$;
