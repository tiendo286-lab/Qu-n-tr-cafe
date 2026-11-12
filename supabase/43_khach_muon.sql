-- Bước 43 — Khách mượn tiền quán (anh Tiến chốt 12/11/2026)
-- Ở bước Thu chi, nhân viên ghi "Khách mượn tiền": tiền lấy ra khỏi két, khách chưa trả. Khoản này nằm trong shift_debts
-- (kind = 'muon'), hiện lại ở mọi ca sau của cùng cơ sở để đòi; khách trả hết 1 lần (tiền mặt / chuyển khoản).
-- Tiền mượn KHÔNG phải doanh thu, KHÔNG phải chi phí: web tự thêm 1 dòng thu chi "Khách mượn – …" (âm, tiền mặt) để két khớp,
-- dòng này tự ghi "Không tính" + đã đối soát. Quá 3 ngày chưa trả → báo quản lý (pg_cron mỗi sáng 9:00).
-- Bill khách nợ (phương thức Nợ trên Fabi) giữ nguyên như cũ (kind = 'bill').
-- Chạy lại nhiều lần không sao.

alter table public.shift_debts add column if not exists kind text not null default 'bill';
alter table public.shift_debts add column if not exists reminded_at text;
do $$ begin
  alter table public.shift_debts add constraint shift_debts_kind_ck check (kind in ('bill', 'muon'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- Số liệu hiệu lực: thêm dòng khách mượn
create or replace function public.app__ca_eff(p_id bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select x.d || jsonb_build_object('moves', coalesce(x.d -> 'moves', '[]'::jsonb) || coalesce((
      select jsonb_agg(jsonb_build_object('kind', 'tien_mat', 'amount', -(s ->> 'cash_paid')::bigint,
               'note', 'Chi lương – ' || e.code || ' – ' || e.name, 'auto', 'luong', 'employee_id', e.id) order by e.code)
        from jsonb_array_elements(coalesce(x.d -> 'staff', '[]'::jsonb)) s join public.employees e on e.id = (s ->> 'employee_id')::bigint
       where coalesce(nullif(s ->> 'cash_paid', '')::bigint, 0) > 0 and coalesce((s ->> 'worked')::boolean, true)), '[]'::jsonb)
    -- bước 43: khách mượn tiền → tiền ra khỏi két (không phải chi phí)
    || coalesce((select jsonb_agg(jsonb_build_object('kind', 'tien_mat', 'amount', -dm.amount, 'note', 'Khách mượn – ' || dm.table_name,
               'auto', 'muon', 'debt_id', dm.id) order by dm.id)
        from public.shift_debts dm where dm.report_id = p_id and dm.kind = 'muon' and dm.amount > 0), '[]'::jsonb))
    from (select coalesce((select data from public.shift_report_recon where report_id = p_id), public.app__recon_snapshot(p_id)) d) x
   where x.d is not null
$$;

-- ---------------------------------------------------------------- Tiền ca: nợ phát sinh chỉ gồm bill nợ
create or replace function public.app__ca_money(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.shift_reports; nx public.shift_reports; d jsonb; b jsonb; tm_mv bigint; ck_mv bigint; debt_new bigint; col_tm bigint; col_ck bigint;
        cc bigint; op bigint; pc bigint; pt bigint; rt bigint; tot bigint; tm_left bigint; ck_nv bigint; ck_bank bigint; bank_ok boolean;
        nh jsonb; hg bigint := 0; ns text;
begin
  select * into r from public.shift_reports where id = p_id;
  if r.id is null then return null; end if;
  d := public.app__ca_eff(p_id);
  b := public.app__kt_bank_json(r);
  select coalesce(sum((m ->> 'amount')::bigint) filter (where m ->> 'kind' = 'tien_mat'), 0),
         coalesce(sum((m ->> 'amount')::bigint) filter (where m ->> 'kind' = 'chuyen_khoan'), 0)
    into tm_mv, ck_mv from jsonb_array_elements(coalesce(d -> 'moves', '[]')) m;
  select coalesce(sum(amount), 0) into debt_new from public.shift_debts where report_id = p_id and kind <> 'muon';
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
  ck_nv := rt - pt - ck_mv - col_ck;
  bank_ok := coalesce((b ->> 'account_count')::int, 0) > 0 and (b ->> 'entered')::int = (b ->> 'account_count')::int;
  ck_bank := case when bank_ok then (b ->> 'received')::bigint - pt - ck_mv - col_ck end;
  return jsonb_build_object('sum_gap', tot - pc - pt - debt_new, 'debt_new', debt_new, 'col_tm', col_tm, 'col_ck', col_ck,
    'tm_moves', tm_mv, 'ck_moves', ck_mv, 'tm_left_self', tm_left, 'handover_gap', hg, 'tm_left', tm_left + hg,
    'next_hand', case when nh is not null and nh ->> 'state' not in ('chua_dem', 'cho_ca_truoc') then jsonb_build_object('shift', ns, 'id', nx.id,
       'state', nh ->> 'state', 'counted', (nh ->> 'counted')::bigint, 'first_count', (nh ->> 'first_count')::bigint, 'gap', (nh ->> 'gap')::bigint,
       'giver', nh ->> 'giver', 'counted_by', nh ->> 'counted_by', 'counted_at', nh ->> 'counted_at', 'recount_at', nh ->> 'recount_at') end,
    'ck_left_nv', ck_nv, 'ck_left_bank', ck_bank,
    'bank_received', (b ->> 'received')::bigint, 'bank_ok', bank_ok,
    'ck_basis', case when bank_ok then 'ke_toan' else 'nhan_vien' end, 'ck_left', coalesce(ck_bank, ck_nv));
end $$;

-- ---------------------------------------------------------------- Kiểm tra khi gửi: tách bill nợ và khách mượn
create or replace function public.app__ca_part_check(p_id bigint, p_part text) returns void
language plpgsql security definer set search_path = public as $$
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
    if r.cups is null then miss := miss || 'Số cốc bán'::text; end if;
    if not exists (select 1 from public.shift_report_photos where report_id = r.id and kind = 'ipos') then miss := miss || 'Ảnh phiếu chốt ca iPOS'::text; end if;
    if array_length(miss, 1) > 0 then raise exception 'Phần TIỀN còn thiếu: %.', array_to_string(miss, ', '); end if;
    if least(r.total_revenue, r.pos_cash, r.pos_transfer, r.reported_transfer, r.cash_counted, r.opening_cash, r.cups, r.ipos_opening) < 0 then
      raise exception 'Các số liệu doanh thu, tiền, số cốc không được âm.';
    end if;
    if exists (select 1 from public.shift_debts where report_id = r.id and amount <= 0) then
      raise exception 'Mỗi bàn còn nợ / khách mượn cần số tiền lớn hơn 0.';
    end if;
    select coalesce(sum(amount), 0) into debt_new from public.shift_debts where report_id = r.id and kind <> 'muon';
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
    -- col_tm: khách trả BILL nợ bằng tiền mặt (Fabi đã cộng vào tiền phải có); col_tm_all: cả khách trả tiền mượn (Fabi không biết)
    select coalesce(sum(d.amount) filter (where d.collect_kind = 'tien_mat' and d.kind <> 'muon'), 0),
           coalesce(sum(d.amount) filter (where d.collect_kind = 'tien_mat'), 0), coalesce(sum(d.amount) filter (where d.collect_kind = 'chuyen_khoan'), 0)
      into col_tm, col_tm_all, col_ck from public.shift_debts d where d.closed_report_id = r.id;
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
    tm_left := r.cash_counted - r.opening_cash - r.pos_cash - (mv_tm - sal - loan_out) - col_tm_all;
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
    if exists (select 1 from public.shift_debts where report_id = r.id and kind = 'muon' and trim(table_name) = '') then
      raise exception 'Khách mượn tiền: ghi tên khách.';
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

-- ---------------------------------------------------------------- Lưu phiếu: loại khoản nợ
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
      insert into public.shift_debts(branch_id, report_id, table_name, amount, note, created_by, kind)
      values (r.branch_id, r.id, trim(x ->> 'table_name'), coalesce(nullif(x ->> 'amount', '')::bigint, 0), nullif(x ->> 'note', ''), a.id,
              case when x ->> 'kind' = 'muon' then 'muon' else 'bill' end)
      returning id into nid;
    else
      nid := (x ->> 'id')::bigint;
      update public.shift_debts set table_name = trim(x ->> 'table_name'), amount = coalesce(nullif(x ->> 'amount', '')::bigint, 0),
             note = nullif(x ->> 'note', ''), kind = case when x ->> 'kind' in ('bill', 'muon') then x ->> 'kind' else kind end
       where id = nid and report_id = r.id and closed_at is null;
    end if;
    d_ids := d_ids || to_jsonb(nid);
  end loop;
  return jsonb_build_object('at', public.vn_now_text(), 'rev_start', coalesce(forced, nullif(p ->> 'rev_start', '')),
                            'handover_ids', h_ids, 'debt_ids', d_ids);
end $$;

-- ---------------------------------------------------------------- Dòng "Khách mượn – …" ở Thu chi: tự ghi Không tính + đã đối soát
create or replace function public.app__ca_loan_cats(p_id bigint, p_acc bigint) returns void
language plpgsql security definer set search_path = public as $$
declare now_ text := public.vn_now_text(); r public.shift_reports;
begin
  select * into r from public.shift_reports where id = p_id;
  insert into public.fin_move_cats(report_id, mkey, category_id, excluded, by_account, at, checked, checked_by, checked_at)
  select x.report_id, x.mkey, null, 1, p_acc, now_, 1, p_acc, now_
    from public.app__tc_moves(r.branch_id, r.work_date, r.work_date) x
   where x.report_id = p_id and x.pay = 'tien_mat' and x.amount < 0
     and x.note in (select 'Khách mượn – ' || d.table_name from public.shift_debts d where d.report_id = p_id and d.kind = 'muon')
  on conflict (report_id, mkey) do update set excluded = 1, category_id = null, checked = 1,
     checked_by = coalesce(public.fin_move_cats.checked_by, excluded.checked_by), checked_at = coalesce(public.fin_move_cats.checked_at, excluded.checked_at);
end $$;

create or replace function public.app__ca_finish(p_id bigint, p_acc bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__ca_part_check(p_id, 'tien');
  perform public.app__ca_part_check(p_id, 'nhan_su');
  update public.shift_reports set status = 'hoan_thanh', completed_by = p_acc, completed_at = public.vn_now_text(),
         updated_by = p_acc, updated_at = public.vn_now_text()
   where id = p_id;
  perform public.app_log('hoan_thanh_chot_ca', 'report=' || p_id || ' (đủ các phần việc)');
  perform public.app__ca_loan_cats(p_id, p_acc);   -- bước 43: khách mượn tiền không tính chi phí
  perform public.app__ca_auto_recon(p_id, p_acc);
  perform public.app__fabi_apply_report(p_id);   -- bước 42: có file Fabi rồi thì so ngay
end $$;

-- ---------------------------------------------------------------- Chốt tháng: "nợ phát sinh" không gồm tiền khách mượn (đã trừ qua dòng thu chi)
create or replace function public.app__fin_calc(p_branch bigint, p_month text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b public.branches; d0 date; d1 date; today text := to_char(public.vn_now(), 'YYYY-MM-DD'); upto date;
        rev jsonb; days jsonb; moves jsonb; entries jsonb; bank jsonb; ka jsonb; n_chain int; expect_shifts int;
        chi_auto bigint; thu_auto bigint; chi_tay bigint; thu_tay bigint; by_cat jsonb; c public.fin_month_closes;
begin
  select * into b from public.branches where id = p_branch;
  if b.id is null then raise exception 'Không tìm thấy cơ sở.'; end if;
  d0 := (p_month || '-01')::date; d1 := (d0 + interval '1 month' - interval '1 day')::date;
  upto := least(d1, today::date);
  select count(*) into n_chain from public.branch_shifts bs join public.shifts s on s.id = bs.shift_id
   where bs.branch_id = p_branch and bs.enabled = 1 and s.status = 'Đang sử dụng' and public.app__ca_chain(s.name);
  expect_shifts := case when upto < d0 then 0 else n_chain * ((upto - d0) + 1) end;

  -- doanh thu theo phiếu ca (số chính thức)
  with r as (
    select x.*, public.app__ca_eff(x.id) as e from public.shift_reports x
     where x.branch_id = p_branch and x.work_date between d0::text and d1::text
  )
  select jsonb_build_object(
    'reports', count(*), 'done', count(*) filter (where status = 'hoan_thanh'),
    'recon', count(*) filter (where recon_status = 'hoan_thanh'), 'in_progress', count(*) filter (where status = 'dang_chot'),
    'expect', expect_shifts,
    'total_revenue', coalesce(sum((e ->> 'total_revenue')::bigint) filter (where status = 'hoan_thanh'), 0),
    'pos_cash', coalesce(sum((e ->> 'pos_cash')::bigint) filter (where status = 'hoan_thanh'), 0),
    'pos_transfer', coalesce(sum((e ->> 'pos_transfer')::bigint) filter (where status = 'hoan_thanh'), 0),
    'cups', coalesce(sum((e ->> 'cups')::int) filter (where status = 'hoan_thanh'), 0),
    'debt_new', coalesce((select sum(dd.amount) from public.shift_debts dd join r rr on rr.id = dd.report_id where rr.status = 'hoan_thanh' and dd.kind <> 'muon'), 0),
    'debt_col_tm', coalesce((select sum(dd.amount) from public.shift_debts dd join r rr on rr.id = dd.closed_report_id
                              where rr.status = 'hoan_thanh' and dd.collect_kind = 'tien_mat'), 0),
    'debt_col_ck', coalesce((select sum(dd.amount) from public.shift_debts dd join r rr on rr.id = dd.closed_report_id
                              where rr.status = 'hoan_thanh' and dd.collect_kind = 'chuyen_khoan'), 0))
    into rev from r;

  -- tiền mặt theo ngày (giống Đối soát cuối ngày)
  select coalesce(jsonb_agg(z.j order by z.dd), '[]') into days from (
    select g.dd, jsonb_build_object('date', g.dd, 'done', q.done, 'opening', q.opening, 'pos_cash', q.pos_cash, 'moves_cash', q.moves_cash,
             'debt_cash', q.debt_cash, 'counted', c2.counted, 'counted_by', public.app__acc_name(c2.done_by),
             'expected', case when q.opening is not null and q.pos_cash is not null then q.opening + q.pos_cash + q.moves_cash + q.debt_cash end) as j
      from (select to_char(x, 'YYYY-MM-DD') as dd from generate_series(d0, d1, interval '1 day') x) g
      cross join lateral (
        select count(*) filter (where r.status = 'hoan_thanh') as done,
               (select (public.app__ca_eff(r2.id) ->> 'opening_cash')::bigint from public.shift_reports r2
                 where r2.branch_id = p_branch and r2.work_date = g.dd order by array_position(public.app__shifts(), r2.shift) limit 1) as opening,
               sum((public.app__ca_eff(r.id) ->> 'pos_cash')::bigint) filter (where r.status = 'hoan_thanh') as pos_cash,
               coalesce((select sum((m ->> 'amount')::bigint) from public.shift_reports r3
                          cross join lateral jsonb_array_elements(public.app__ca_eff(r3.id) -> 'moves') m
                          where r3.branch_id = p_branch and r3.work_date = g.dd and r3.status = 'hoan_thanh' and m ->> 'kind' = 'tien_mat'), 0) as moves_cash,
               coalesce((select sum(dd.amount) from public.shift_debts dd join public.shift_reports r4 on r4.id = dd.closed_report_id
                          where r4.branch_id = p_branch and r4.work_date = g.dd and r4.status = 'hoan_thanh' and dd.collect_kind = 'tien_mat'), 0) as debt_cash
          from public.shift_reports r where r.branch_id = p_branch and r.work_date = g.dd) q
      left join public.daily_cash_closings c2 on c2.branch_id = p_branch and c2.work_date = g.dd
     where q.done > 0 or c2.counted is not null
  ) z;

  -- chuyển khoản thực nhận (kế toán) — chỉ các ca đã nhập đủ tài khoản
  select jsonb_build_object('pos_transfer', coalesce(sum(pt), 0), 'received', coalesce(sum(rc) filter (where ok), 0),
           'pos_transfer_ok', coalesce(sum(pt) filter (where ok), 0), 'shifts_ok', count(*) filter (where ok), 'shifts', count(*))
    into bank from (
      select (public.app__ca_eff(x.id) ->> 'pos_transfer')::bigint as pt, (k ->> 'received')::bigint as rc,
             coalesce((k ->> 'account_count')::int, 0) > 0 and (k ->> 'entered')::int = (k ->> 'account_count')::int as ok
        from public.shift_reports x cross join lateral (select public.app__kt_bank_json(x) as k) kk
       where x.branch_id = p_branch and x.work_date between d0::text and d1::text and x.status = 'hoan_thanh') y;

  -- khoản thu chi ghi ở phiếu ca + phân nhóm
  select coalesce(jsonb_agg(jsonb_build_object('report_id', m.rid, 'date', m.work_date, 'shift', m.shift, 'kind', m.kind, 'amount', m.amount, 'note', m.note,
           'mkey', m.mkey, 'category_id', fc.category_id, 'excluded', coalesce(fc.excluded, case when m.amount > 0 then 1 else 0 end) = 1,
           'set', fc.report_id is not null) order by m.work_date, array_position(public.app__shifts(), m.shift), m.ord), '[]')
    into moves from (
      select x.id as rid, x.work_date, x.shift, t.ord, t.v ->> 'kind' as kind, (t.v ->> 'amount')::bigint as amount, coalesce(t.v ->> 'note', '') as note,
             md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) || '#'
               || row_number() over (partition by x.id, md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) order by t.ord) as mkey
        from public.shift_reports x
        cross join lateral jsonb_array_elements(public.app__ca_eff(x.id) -> 'moves') with ordinality t(v, ord)
       where x.branch_id = p_branch and x.work_date between d0::text and d1::text and x.status = 'hoan_thanh') m
    left join public.fin_move_cats fc on fc.report_id = m.rid and fc.mkey = m.mkey;

  select coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object('category', c3.name, 'by', public.app__acc_name(e.created_by)) order by e.entry_date, e.id), '[]')
    into entries from public.fin_entries e left join public.fin_categories c3 on c3.id = e.category_id
   where e.branch_id = p_branch and e.entry_date between d0::text and d1::text;

  -- khoản âm của tháng
  select jsonb_build_object('total', coalesce(sum(s.amount), 0),
           'chua_xu_ly', coalesce(sum(s.amount) filter (where s.status = 'chua_xu_ly'), 0),
           'da_bu', coalesce(sum(s.amount) filter (where s.status = 'da_bu'), 0),
           'tru_luong', coalesce(sum(s.amount) filter (where s.status = 'tru_luong'), 0),
           'mien', coalesce(sum(s.amount) filter (where s.status = 'mien'), 0), 'count', count(*))
    into ka from public.shift_shortfalls s join public.shift_reports x on x.id = s.report_id
   where x.branch_id = p_branch and x.work_date between d0::text and d1::text and s.status <> 'huy';

  -- tổng chi / thu: khoản ở phiếu ca (âm = chi, dương = thu; "Không tính" bỏ qua) + nhập tay
  select coalesce(sum(-(m ->> 'amount')::bigint) filter (where (m ->> 'amount')::bigint < 0 and not (m ->> 'excluded')::boolean), 0),
         coalesce(sum((m ->> 'amount')::bigint) filter (where (m ->> 'amount')::bigint > 0 and not (m ->> 'excluded')::boolean), 0)
    into chi_auto, thu_auto from jsonb_array_elements(moves) m;
  select coalesce(sum(amount) filter (where kind = 'chi'), 0), coalesce(sum(amount) filter (where kind = 'thu'), 0)
    into chi_tay, thu_tay from public.fin_entries where branch_id = p_branch and entry_date between d0::text and d1::text;
  select coalesce(jsonb_agg(jsonb_build_object('kind', y.kind, 'category_id', y.cid, 'name', coalesce(fc.name, 'Chưa phân nhóm'), 'amount', y.amt)
           order by y.kind, coalesce(fc.sort_order, 1000), fc.name), '[]')
    into by_cat from (
      select kind, cid, sum(amt) as amt from (
        select case when (m ->> 'amount')::bigint < 0 then 'chi' else 'thu' end as kind, (m ->> 'category_id')::bigint as cid, abs((m ->> 'amount')::bigint) as amt
          from jsonb_array_elements(moves) m where not (m ->> 'excluded')::boolean
        union all
        select kind, category_id, amount from public.fin_entries where branch_id = p_branch and entry_date between d0::text and d1::text) u
      group by kind, cid) y
    left join public.fin_categories fc on fc.id = y.cid;

  select * into c from public.fin_month_closes where branch_id = p_branch and month = p_month;
  return jsonb_build_object('branch_id', b.id, 'branch_code', coalesce(b.display_code, b.code), 'branch_name', b.name, 'month', p_month,
    'from', d0, 'to', d1, 'revenue', rev, 'days', days, 'bank', bank, 'moves', moves, 'entries', entries, 'shortfalls', ka, 'by_cat', by_cat,
    'cash', jsonb_build_object(
       'pos_cash', (rev ->> 'pos_cash')::bigint, 'debt_cash', (rev ->> 'debt_col_tm')::bigint,
       'moves_cash', coalesce((select sum((x ->> 'moves_cash')::bigint) from jsonb_array_elements(days) x), 0),
       'gap', coalesce((select sum((x ->> 'counted')::bigint - (x ->> 'expected')::bigint) from jsonb_array_elements(days) x
                         where x ->> 'counted' is not null and x ->> 'expected' is not null), 0),
       'days_counted', (select count(*) from jsonb_array_elements(days) x where x ->> 'counted' is not null),
       'days_open', (select count(*) from jsonb_array_elements(days) x where (x ->> 'done')::int > 0)),
    'totals', jsonb_build_object('revenue', (rev ->> 'total_revenue')::bigint, 'chi_ca', chi_auto, 'thu_ca', thu_auto, 'chi_tay', chi_tay, 'thu_tay', thu_tay,
       'chi', chi_auto + chi_tay, 'thu', thu_auto + thu_tay,
       'profit', (rev ->> 'total_revenue')::bigint + thu_auto + thu_tay - chi_auto - chi_tay,
       'uncat', (select count(*) from jsonb_array_elements(moves) m where not (m ->> 'excluded')::boolean and m ->> 'category_id' is null)),
    'closed', case when c.branch_id is null then null else jsonb_build_object('by', public.app__acc_name(c.closed_by), 'at', c.closed_at, 'note', c.note) end);
end $$;

-- ---------------------------------------------------------------- Danh sách khách mượn chưa trả (trang Đối soát)
create or replace function public.app_ca_loans_open() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('doi_soat');
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'branch_id', d.branch_id, 'branch', coalesce(b.display_code, b.code),
            'name', d.table_name, 'amount', d.amount, 'note', d.note, 'date', o.work_date, 'shift', o.shift, 'report_id', o.id,
            'days', (public.vn_now()::date - o.work_date::date), 'by', public.app__acc_name(d.created_by)) order by o.work_date, d.id)
      from public.shift_debts d join public.shift_reports o on o.id = d.report_id join public.branches b on b.id = d.branch_id
     where d.kind = 'muon' and d.closed_at is null), '[]');
end $$;

create or replace function public.app__loan_tick() returns void
language plpgsql security definer set search_path = public as $$
declare d record;
begin
  for d in select x.id, x.table_name, x.amount, x.note, o.work_date, o.shift, coalesce(b.display_code, b.code) code
             from public.shift_debts x join public.shift_reports o on o.id = x.report_id join public.branches b on b.id = x.branch_id
            where x.kind = 'muon' and x.closed_at is null and x.reminded_at is null and o.work_date::date <= public.vn_now()::date - 3 loop
    perform public.app__notify_doi_soat('Khách mượn tiền chưa trả · ' || d.code,
      d.table_name || ' mượn ' || public.app__vnd(d.amount) || ' từ ca ' || d.shift || ' ' || to_char(d.work_date::date, 'DD/MM')
        || ' (quá 3 ngày).' || coalesce(' Ghi chú: ' || d.note, ''), '/quan-ly/doi-soat#td-muon');
    update public.shift_debts set reminded_at = public.vn_now_text() where id = d.id;
  end loop;
end $$;

revoke execute on function public.app__ca_loan_cats(bigint, bigint), public.app__loan_tick() from public, anon, authenticated;
revoke execute on function public.app_ca_loans_open() from public, anon;
grant execute on function public.app_ca_loans_open() to authenticated;
select cron.schedule('nhac-khach-muon', '0 2 * * *', 'select public.app__loan_tick()');   -- 9:00 giờ Việt Nam
