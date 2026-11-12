-- Bước 49 — Số cốc theo file Fabi (anh Tiến chốt 12/11/2026)
-- File chi tiết ca Fabi có mục MÓN (số lượng từng món) và NHÓM MÓN (chỉ doanh thu). Web "tự học" nhóm của từng món: món mới chưa có nhóm
-- thì kế toán / quản lý chọn nhóm 1 lần (fabi_menu). Số cốc của ca = tổng số lượng các món KHÔNG thuộc nhóm "Đồ ăn & thuốc lá" và "Topping".
-- Bỏ bước "Số cốc" ở phiếu chốt ca các cơ sở dùng Fabi: số cốc tự điền khi có file Fabi (ca đã gửi). Chạy lại nhiều lần không sao.

create table if not exists public.fabi_menu (
  name text primary key,
  grp text,
  updated_by bigint, updated_at text not null default public.vn_now_text()
);
alter table public.fabi_menu enable row level security;
revoke all on public.fabi_menu from anon, authenticated;

alter table public.fabi_shifts add column if not exists items jsonb not null default '[]';
alter table public.fabi_shifts add column if not exists groups jsonb not null default '[]';
alter table public.fabi_shifts add column if not exists cups int;
alter table public.fabi_shifts add column if not exists cups_by jsonb not null default '[]';
alter table public.fabi_shifts add column if not exists cups_unknown jsonb not null default '[]';

-- nhóm có tính cốc không (không tính: đồ ăn, thuốc lá, topping)
create or replace function public.app__fabi_cup_grp(g text) returns boolean
language sql immutable as $$ select coalesce(upper(g) !~ '(ĐỒ ĂN|THUỐC|TOPPING)', false) $$;

-- Tính số cốc của 1 file; ca đã gửi thì điền vào phiếu (và bản đối soát nếu có)
create or replace function public.app__fabi_cups(p_ma text) returns void
language plpgsql security definer set search_path = public as $$
declare f public.fabi_shifts; unk jsonb; byg jsonb; tot int; r public.shift_reports; acc bigint;
begin
  begin acc := (public.app_account()).id; exception when others then acc := null; end;
  select * into f from public.fabi_shifts where ma_ca = p_ma;
  if f.ma_ca is null then return; end if;
  select coalesce(jsonb_agg(distinct x ->> 'name') filter (where m.grp is null), '[]'),
         coalesce(sum((x ->> 'qty')::numeric) filter (where m.grp is not null and public.app__fabi_cup_grp(m.grp)), 0)::int
    into unk, tot
    from jsonb_array_elements(f.items) x left join public.fabi_menu m on m.name = x ->> 'name';
  select coalesce(jsonb_agg(jsonb_build_object('grp', g, 'qty', q, 'cup', public.app__fabi_cup_grp(g)) order by q desc), '[]') into byg
    from (select m.grp g, sum((x ->> 'qty')::numeric)::int q from jsonb_array_elements(f.items) x join public.fabi_menu m on m.name = x ->> 'name'
           where m.grp is not null group by m.grp) z;
  update public.fabi_shifts set cups = case when jsonb_array_length(unk) = 0 and jsonb_array_length(f.items) > 0 then tot end,
         cups_by = byg, cups_unknown = unk where ma_ca = p_ma;
  if jsonb_array_length(unk) > 0 or jsonb_array_length(f.items) = 0 or f.report_id is null then return; end if;
  select * into r from public.shift_reports where id = f.report_id;
  if r.status <> 'hoan_thanh' then return; end if;
  if r.cups is distinct from tot then
    update public.shift_reports set cups = tot where id = r.id;
  end if;
  update public.shift_report_recon set data = data || jsonb_build_object('cups', tot) where report_id = r.id and (data ->> 'cups') is distinct from tot::text;
end $$;

create or replace function public.app_fabi_upload(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; x jsonb; bid bigint; op text; out jsonb := '[]'; res jsonb; ma text; nm text; pay jsonb; ck bigint; tm bigint; no_ bigint; oth bigint;
begin
  a := public.app__need('ke_toan');
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'Chưa có file nào.'; end if;
  if jsonb_array_length(p_rows) > 100 then raise exception 'Mỗi lần tải tối đa 100 file.'; end if;
  for x in select * from jsonb_array_elements(p_rows) loop
    ma := trim(coalesce(x ->> 'ma_ca', '')); nm := trim(coalesce(x ->> 'store', ''));
    if ma = '' or nm = '' then raise exception 'File thiếu mã ca hoặc tên cửa hàng.'; end if;
    select branch_id into bid from public.fabi_stores where lower(store_name) = lower(nm);
    op := public.app__fabi_ts(x ->> 'open');
    pay := coalesce(x -> 'pay', '[]');
    select coalesce(sum((p ->> 'amount')::bigint) filter (where lower(p ->> 'name') like '%chuyển khoản%'), 0),
           coalesce(sum((p ->> 'amount')::bigint) filter (where lower(trim(p ->> 'name')) = 'tiền mặt'), 0),
           coalesce(sum((p ->> 'amount')::bigint) filter (where lower(trim(p ->> 'name')) = 'nợ'), 0),
           coalesce(sum((p ->> 'amount')::bigint) filter (where lower(p ->> 'name') not like '%chuyển khoản%' and lower(trim(p ->> 'name')) not in ('tiền mặt', 'nợ')), 0)
      into ck, tm, no_, oth from jsonb_array_elements(pay) p;
    insert into public.fabi_shifts(ma_ca, store_name, branch_id, work_date, shift, open_at, close_at, dau, cuoi, net, ck, tm, no, other, hd, tong, pay, tra_no, sua, bills, uploaded_by, uploaded_at, items, groups)
    values (ma, nm, bid, left(op, 10), public.app__fabi_shift(op), op, public.app__fabi_ts(x ->> 'close'),
            nullif(x ->> 'dau', '')::bigint, nullif(x ->> 'cuoi', '')::bigint, nullif(x ->> 'net', '')::bigint, ck, tm, no_, oth,
            nullif(x ->> 'hd', '')::int, nullif(x ->> 'tong', '')::bigint, pay, coalesce(x -> 'tra_no', '[]'), coalesce(x -> 'sua', '[]'), coalesce(x -> 'bills', '[]'),
            a.id, public.vn_now_text(), coalesce(x -> 'items', '[]'), coalesce(x -> 'groups', '[]'))
    on conflict (ma_ca) do update set store_name = excluded.store_name, branch_id = excluded.branch_id, work_date = excluded.work_date, shift = excluded.shift,
      open_at = excluded.open_at, close_at = excluded.close_at, dau = excluded.dau, cuoi = excluded.cuoi, net = excluded.net, ck = excluded.ck, tm = excluded.tm,
      no = excluded.no, other = excluded.other, hd = excluded.hd, tong = excluded.tong, pay = excluded.pay, tra_no = excluded.tra_no, sua = excluded.sua, bills = excluded.bills,
      uploaded_by = excluded.uploaded_by, uploaded_at = excluded.uploaded_at, items = excluded.items, groups = excluded.groups;
    res := public.app__fabi_apply(ma);
    perform public.app__fabi_cups(ma);   -- bước 49
    if res ->> 'status' = 'chua_phieu' then
      perform public.app__notify_doi_soat('Ca có trên Fabi nhưng chưa có phiếu chốt ca',
        (select code from public.branches where id = bid) || ' · ca ' || public.app__fabi_shift(op) || ' ' || to_char(left(op, 10)::date, 'DD/MM') || ' (mã ca ' || ma || ').', '/ca?ngay=' || left(op, 10));
    end if;
    out := out || (jsonb_build_object('cups', (select cups from public.fabi_shifts where ma_ca = ma), 'cups_unknown', (select cups_unknown from public.fabi_shifts where ma_ca = ma),
                   'ma_ca', ma, 'store', nm, 'branch_code', (select code from public.branches where id = bid), 'work_date', left(op, 10),
                   'shift', public.app__fabi_shift(op)) || coalesce(res, '{}'::jsonb));
  end loop;
  perform public.app_log('tai_file_fabi', jsonb_array_length(p_rows) || ' ca');
  return out;
end $$;

create or replace function public.app__fabi_apply_report(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare m text; r public.shift_reports;
begin
  select * into r from public.shift_reports where id = p_id;
  for m in select f.ma_ca from public.fabi_shifts f where f.branch_id = r.branch_id and f.work_date = r.work_date and f.shift = r.shift loop
    perform public.app__fabi_apply(m);
    perform public.app__fabi_cups(m);   -- bước 49: ca vừa gửi → điền số cốc theo file Fabi
  end loop;
end $$;

create or replace function public.app_fabi_list(p_from text, p_to text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('ke_toan');
  return jsonb_build_object(
    'files', coalesce((select jsonb_agg(jsonb_build_object('ma_ca', f.ma_ca, 'store', f.store_name, 'branch_code', b.code, 'work_date', f.work_date, 'shift', f.shift,
               'open_at', f.open_at, 'close_at', f.close_at, 'dau', f.dau, 'net', f.net, 'ck', f.ck, 'tm', f.tm, 'no', f.no, 'tong', f.tong, 'chenh', f.tong - f.cuoi,
               'tra_no', f.tra_no, 'sua', f.sua, 'report_id', f.report_id, 'report_status', r.status, 'diff', f.diff, 'fixed', f.fixed,
               'uploaded_by', public.app__acc_name(f.uploaded_by), 'uploaded_at', f.uploaded_at, 'cups', f.cups, 'cups_by', f.cups_by, 'cups_unknown', f.cups_unknown)
               order by f.work_date desc, b.sort_order, f.open_at)
             from public.fabi_shifts f left join public.branches b on b.id = f.branch_id left join public.shift_reports r on r.id = f.report_id
            where f.work_date between p_from and p_to), '[]'),
    'missing', coalesce((select jsonb_agg(jsonb_build_object('report_id', r.id, 'branch_code', b.code, 'work_date', r.work_date, 'shift', r.shift, 'status', r.status)
               order by r.work_date desc, b.sort_order, r.shift)
             from public.shift_reports r join public.branches b on b.id = r.branch_id
            where r.work_date between p_from and p_to and public.app__ca_chain(r.shift)
              and exists (select 1 from public.fabi_stores s where s.branch_id = r.branch_id)
              and not exists (select 1 from public.fabi_shifts f where f.branch_id = r.branch_id and f.work_date = r.work_date and f.shift = r.shift)), '[]'));
end $$;

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
    if r.cups is null and not exists (select 1 from public.fabi_stores fs where fs.branch_id = r.branch_id) then miss := miss || 'Số cốc bán'::text; end if;   -- bước 49
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

-- Danh mục món (tự học từ file Fabi) cho trang Kế toán › File ca Fabi
create or replace function public.app_fabi_menu() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need(null);
  if not (public.app_can('ke_toan') or public.app_can('doi_soat')) then raise exception 'Bạn không có quyền thực hiện thao tác này.'; end if;
  return jsonb_build_object(
    'groups', coalesce((select jsonb_agg(g order by g) from (select distinct g ->> 'name' g from public.fabi_shifts f, jsonb_array_elements(f.groups) g
                 union select distinct grp from public.fabi_menu where grp is not null) z where g is not null), '[]'),
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', n.name, 'grp', m.grp, 'files', n.files, 'qty', n.qty, 'cup', m.grp is not null and public.app__fabi_cup_grp(m.grp),
                 'by', public.app__acc_name(m.updated_by), 'at', m.updated_at) order by (m.grp is null) desc, m.grp, n.name)
               from (select x ->> 'name' name, count(distinct f.ma_ca) files, sum((x ->> 'qty')::numeric) qty
                       from public.fabi_shifts f, jsonb_array_elements(f.items) x group by 1) n
               left join public.fabi_menu m on m.name = n.name), '[]'));
end $$;

-- Lưu nhóm cho các món (p_items: [{name, grp}]) → tính lại số cốc các ca có món đó
create or replace function public.app_fabi_menu_set(p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare a public.accounts; x jsonb; n int := 0; m text; names text[] := '{}';
begin
  a := public.app__need(null);
  if not (public.app_can('ke_toan') or public.app_can('doi_soat')) then raise exception 'Bạn không có quyền thực hiện thao tác này.'; end if;
  if jsonb_typeof(coalesce(p_items, '[]')) <> 'array' then raise exception 'Dữ liệu không hợp lệ.'; end if;
  for x in select * from jsonb_array_elements(p_items) loop
    if trim(coalesce(x ->> 'name', '')) = '' then continue; end if;
    insert into public.fabi_menu(name, grp, updated_by, updated_at) values (x ->> 'name', nullif(trim(coalesce(x ->> 'grp', '')), ''), a.id, public.vn_now_text())
    on conflict (name) do update set grp = excluded.grp, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
    names := names || (x ->> 'name'); n := n + 1;
  end loop;
  for m in select f.ma_ca from public.fabi_shifts f where exists (select 1 from jsonb_array_elements(f.items) y where y ->> 'name' = any(names)) loop
    perform public.app__fabi_cups(m);
  end loop;
  perform public.app_log('nhom_mon_fabi', n || ' món');
  return n;
end $$;

revoke execute on function public.app__fabi_cup_grp(text), public.app__fabi_cups(text) from public, anon, authenticated;
revoke execute on function public.app_fabi_menu(), public.app_fabi_menu_set(jsonb) from public, anon;
grant execute on function public.app_fabi_menu(), public.app_fabi_menu_set(jsonb) to authenticated;
