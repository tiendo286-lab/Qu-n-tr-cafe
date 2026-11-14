-- Bước 96 — Tắt "khách thanh toán nợ" trên Fabi POS từ ca 15/11/2026 (anh Tiến chốt 14/11/2026)
-- Cuối ca, bàn chưa trả: nhân viên bấm thanh toán TM / CK trên Fabi rồi ghi khách nợ trên web loại TM / CK (như cũ).
-- Khách trả nợ: Fabi không ghi nữa → (1) phép kiểm phiếu Fabi khi chốt ca không trừ "khách trả nợ tiền mặt";
-- (2) đèn tự đối soát Công nợ không so với file Fabi. Ca trước 15/11 giữ cách cũ.

create or replace function public.app__fabi_tra_no_on(p_date text) returns boolean
language sql immutable as $f$ select coalesce(p_date, '') < '2026-11-15' $f$;
revoke execute on function public.app__fabi_tra_no_on(text) from public, anon, authenticated;

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
    -- bước 96: từ ca 15/11/2026 Fabi không ghi khách trả nợ nữa → tiền khách trả nằm trong Tiền chênh lệch của Fabi, không trừ ra
    if not public.app__fabi_tra_no_on(r.work_date) then col_tm := 0; end if;
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

CREATE OR REPLACE FUNCTION public.app__ca_green(p_id bigint)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e jsonb := public.app__ca_eff(p_id); m jsonb := public.app__ca_money(p_id); g text[] := '{}'; debt_new bigint; fx boolean; h jsonb;
        sua boolean; f_tm bigint; f_ck bigint; c_tm bigint; c_ck bigint;
begin
  if nullif(e ->> 'rev_start', '') is not null and nullif(e ->> 'rev_end', '') is not null and (e ->> 'rev_end') > (e ->> 'rev_start') then g := g || 'thoi_gian'::text; end if;
  select coalesce(sum(amount), 0) into debt_new from public.shift_debts where report_id = p_id and coalesce(kind, 'bill') <> 'muon';
  fx := exists (select 1 from public.fabi_shifts f where f.report_id = p_id and (jsonb_array_length(coalesce(f.diff, '[]')) > 0 or jsonb_array_length(coalesce(f.fixed, '[]')) > 0));
  h := public.app__ca_hand(p_id);
  -- bước 61: Fabi có hóa đơn sửa / xóa → Doanh thu để quản lý xem (không tự duyệt)
  sua := exists (select 1 from public.fabi_shifts f where f.report_id = p_id and jsonb_array_length(coalesce(f.sua, '[]')) > 0);
  if (e ->> 'total_revenue')::bigint = coalesce((e ->> 'pos_cash')::bigint, 0) + coalesce((e ->> 'pos_transfer')::bigint, 0) + debt_new
     and nullif(e ->> 'cups', '') is not null and coalesce(h ->> 'state', '') <> 'lech' and not fx and not sua then g := g || 'doanh_thu'::text; end if;
  if abs((m ->> 'tm_left')::bigint) <= 5000 then g := g || 'tien_mat'::text; end if;
  if abs((m ->> 'ck_left')::bigint) <= 5000 then g := g || 'chuyen_khoan'::text; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(e -> 'moves', '[]')) x where x ->> 'auto' is null) then g := g || 'thu_chi'::text; end if;
  -- bước 61: khách trả nợ cũ theo file Fabi (tiền mặt / chuyển khoản) phải khớp khoản "khách đã trả" nhân viên chọn trong ca
  select coalesce(sum((t ->> 'amount')::bigint) filter (where lower(t ->> 'method') !~ '(chuyển|chuyen)'), 0),
         coalesce(sum((t ->> 'amount')::bigint) filter (where lower(t ->> 'method') ~ '(chuyển|chuyen)'), 0)
    into f_tm, f_ck from public.fabi_shifts f, jsonb_array_elements(coalesce(f.tra_no, '[]')) t where f.report_id = p_id;
  select coalesce(sum(amount) filter (where collect_kind = 'tien_mat'), 0), coalesce(sum(amount) filter (where collect_kind = 'chuyen_khoan'), 0)
    into c_tm, c_ck from public.shift_debts where closed_report_id = p_id and coalesce(kind, 'bill') <> 'muon';
  -- bước 96: từ ca 15/11/2026 Fabi không ghi khách trả nợ → không so với file Fabi
  if not public.app__fabi_tra_no_on((select work_date from public.shift_reports where id = p_id)) or (f_tm = c_tm and f_ck = c_ck) then g := g || 'cong_no'::text; end if;
  return g;
end $function$;

revoke execute on function public.app__ca_part_check(bigint, text), public.app__ca_green(bigint) from public, anon, authenticated;

insert into public.app_migrations(file) values ('88_tat_tra_no_fabi.sql') on conflict (file) do nothing;
