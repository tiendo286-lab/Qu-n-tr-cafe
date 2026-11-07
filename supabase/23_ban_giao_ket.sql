-- =====================================================================
-- BƯỚC 23: KIỂM SOÁT TIỀN TỪNG CA — ANH TIẾN CHỐT 07/11/2026. Chạy sau 22. Chạy lại nhiều lần không sao.
--  1. Bàn giao két ĐẾM MÙ: ca sau tự đếm két và nhập số TRƯỚC khi thấy số ca trước khai (ca trước phải hoàn thành phiếu trước).
--     Số đếm lần đầu được giữ nguyên, không sửa được.
--  2. Lệch quá mức cho qua → 2 người (người nhận + 1 người ca trước) đếm lại cùng nhau, nhập số đếm lại (1 lần).
--     Vẫn lệch → báo quản lý + người giao; khoản lệch TÍNH CHO CA GIAO (cộng vào tiền mặt chưa giải trình của ca giao).
--  3. Số dư đầu trên iPOS phải bằng số tiền nhận két; khác thì bắt buộc ghi lý do.
--  4. Mức lệch cho qua: 5.000đ (bàn giao két, tiền đầu ca so với két ca trước).
--  5. Khoản âm: quản lý chọn nhân viên khi đối soát (giữ như bước 21).
--  7. Bắt buộc ảnh phiếu chốt ca iPOS mới hoàn thành được phiếu.
--  Không làm: chi tiền mặt, giảm giá giữ như cũ; không kiểm két đột xuất; không cảnh báo tỉ lệ tiền mặt; không rút bớt két.
-- =====================================================================

alter table public.shift_reports add column if not exists open_first_count bigint;   -- số đếm mù lần đầu (giữ nguyên)
alter table public.shift_reports add column if not exists open_counted_by bigint;
alter table public.shift_reports add column if not exists open_counted_at text;
alter table public.shift_reports add column if not exists open_giver_emp bigint references public.employees(id);
alter table public.shift_reports add column if not exists open_recount_at text;
alter table public.shift_reports add column if not exists ipos_opening bigint;       -- Số dư đầu trên phiếu iPOS

alter table public.shift_report_photos add column if not exists kind text not null default 'hang';
alter table public.shift_report_photos drop constraint if exists shift_report_photos_kind_check;
alter table public.shift_report_photos add constraint shift_report_photos_kind_check check (kind in ('hang', 'ipos'));

-- ---------------------------------------------------------------- Mức lệch cho qua + ca liền sau
create or replace function public.app__ca_tol() returns bigint
language sql immutable as $$ select 5000::bigint $$;

create or replace function public.app__ca_next_shift(p_shift text) returns text
language plpgsql stable security definer set search_path = public as $$
declare s text[] := public.app__shifts(); i int;
begin
  i := array_position(s, p_shift);
  if i is null or i >= array_length(s, 1) then return null; end if;
  return s[i + 1];
end $$;

-- ---------------------------------------------------------------- Tình trạng nhận két của một phiếu (phiếu ca NHẬN)
-- state: chua_dem · cho_ca_truoc · khong_ca_truoc · khop · can_dem_lai · lech
create or replace function public.app__ca_hand(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.shift_reports; prev public.shift_reports; ps text; tol bigint := public.app__ca_tol();
        pc bigint; cnt bigint; gap bigint; st text;
begin
  select * into r from public.shift_reports where id = p_id;
  if r.id is null or r.shift = (public.app__shifts())[1] then return null; end if;
  ps := public.app__ca_prev_shift(r.shift);
  if ps is not null then
    select * into prev from public.shift_reports where branch_id = r.branch_id and work_date = r.work_date and shift = ps;
  end if;
  cnt := (public.app__ca_eff(r.id) ->> 'opening_cash')::bigint;
  if prev.id is not null and prev.status = 'hoan_thanh' then pc := (public.app__ca_eff(prev.id) ->> 'cash_counted')::bigint; end if;
  gap := cnt - pc;
  st := case when cnt is null then case when prev.id is not null and prev.status <> 'hoan_thanh' then 'cho_ca_truoc' else 'chua_dem' end
             when prev.id is null then 'khong_ca_truoc'
             when pc is null then 'cho_ca_truoc'
             when abs(gap) <= tol then 'khop'
             when r.open_first_count is not null and r.open_recount_at is null then 'can_dem_lai'
             else 'lech' end;
  return jsonb_build_object('state', st, 'prev_id', prev.id, 'prev_shift', ps, 'prev_status', prev.status, 'prev_cash', pc,
    'counted', cnt, 'first_count', r.open_first_count, 'gap', gap,
    'gap_eff', case when st in ('lech', 'can_dem_lai') then gap else 0 end,
    'counted_by', public.app__acc_name(r.open_counted_by), 'counted_at', r.open_counted_at, 'blind', r.open_counted_at is not null,
    'giver_id', r.open_giver_emp, 'giver', (select e.code || ' – ' || e.name from public.employees e where e.id = r.open_giver_emp),
    'recount_at', r.open_recount_at, 'ipos_opening', r.ipos_opening, 'tol', tol,
    'prev_staff', case when prev.id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.code || ' – ' || e.name) order by e.code)
                    from public.shift_report_staff s join public.employees e on e.id = s.employee_id
                   where s.report_id = prev.id and s.worked = 1), '[]') end);
end $$;

-- Báo cho người đối soát (Chủ, Quản lý tổng, Quản lý có quyền đối soát)
create or replace function public.app__notify_doi_soat(p_title text, p_body text, p_link text) returns void
language plpgsql security definer set search_path = public as $$
declare x bigint;
begin
  for x in select a.id from public.accounts a
            where coalesce(a.locked, 0) = 0
              and (a.system_role in ('chu', 'ql_tong')
                   or (a.system_role = 'ql' and exists (select 1 from public.role_permissions p where p.role = 'ql' and p.perm = 'doi_soat' and p.allowed = 1))) loop
    perform public.app__notify(x, p_title, p_body, p_link);
  end loop;
end $$;

-- ---------------------------------------------------------------- 1. Đếm mù khi nhận két
create or replace function public.app_ca_cash_receive(p_id bigint, p_amount bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; prev public.shift_reports; h jsonb;
begin
  a := public.app_account();
  r := public.app__ca_need_edit(p_id);
  if r.shift = (public.app__shifts())[1] then raise exception 'Ca % là ca đầu ngày, nhận 1.000.000đ cố định — không cần đếm nhận két.', r.shift; end if;
  if r.opening_cash is not null then
    raise exception 'Ca này đã nhập tiền nhận két (%). Nếu lệch, hãy cùng người ca trước đếm lại.', public.app__vnd(r.opening_cash);
  end if;
  if p_amount is null or p_amount < 0 then raise exception 'Nhập số tiền đếm được trong két.'; end if;
  select * into prev from public.shift_reports
   where branch_id = r.branch_id and work_date = r.work_date and shift = public.app__ca_prev_shift(r.shift);
  if prev.id is not null and prev.status <> 'hoan_thanh' then
    raise exception 'Ca % chưa bấm HOÀN THÀNH phiếu chốt ca. Người ca % đếm két, hoàn thành phiếu trước, sau đó bạn mới đếm nhận két.', prev.shift, prev.shift;
  end if;
  update public.shift_reports set opening_cash = p_amount, open_first_count = p_amount, open_counted_by = a.id, open_counted_at = public.vn_now_text(),
         updated_by = a.id, updated_at = public.vn_now_text()
   where id = r.id;
  h := public.app__ca_hand(r.id);
  perform public.app_log('nhan_ket', 'report=' || r.id || ' ' || p_amount || ' ' || coalesce(h ->> 'state', ''));
  return h;
end $$;

-- ---------------------------------------------------------------- 2. Lệch → 2 người đếm lại (1 lần)
create or replace function public.app_ca_cash_recount(p_id bigint, p_amount bigint, p_giver bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; h jsonb; msg text; prev_id bigint;
begin
  a := public.app_account();
  r := public.app__ca_need_edit(p_id);
  h := public.app__ca_hand(r.id);
  if coalesce(h ->> 'state', '') <> 'can_dem_lai' then raise exception 'Chỉ đếm lại khi tiền nhận két lệch két cuối ca trước (và chưa đếm lại lần nào).'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'Nhập số tiền 2 người cùng đếm lại.'; end if;
  if p_giver is null then raise exception 'Chọn người ca trước cùng đếm lại.'; end if;
  prev_id := (h ->> 'prev_id')::bigint;
  if jsonb_array_length(h -> 'prev_staff') > 0
     and not exists (select 1 from public.shift_report_staff where report_id = prev_id and employee_id = p_giver and worked = 1) then
    raise exception 'Người cùng đếm lại phải là nhân viên làm ca %.', h ->> 'prev_shift';
  end if;
  if not exists (select 1 from public.employees where id = p_giver) then raise exception 'Nhân viên không hợp lệ.'; end if;
  update public.shift_reports set opening_cash = p_amount, open_giver_emp = p_giver, open_recount_at = public.vn_now_text(),
         updated_by = a.id, updated_at = public.vn_now_text()
   where id = r.id;
  h := public.app__ca_hand(r.id);
  if h ->> 'state' = 'lech' then
    msg := public.app__ca_title(r) || ': tiền nhận két ' || public.app__vnd((h ->> 'counted')::bigint) || ', két cuối ca ' || (h ->> 'prev_shift')
      || ' khai ' || public.app__vnd((h ->> 'prev_cash')::bigint) || ' → lệch ' || public.app__vnd((h ->> 'gap')::bigint)
      || E'.\nĐã đếm lại cùng ' || coalesce(h ->> 'giver', '') || ' lúc ' || substr(h ->> 'recount_at', 12, 5)
      || ' (lần đầu đếm ' || public.app__vnd((h ->> 'first_count')::bigint) || '). Khoản lệch tính cho ca ' || (h ->> 'prev_shift') || '.';
    perform public.app__notify_doi_soat('Bàn giao két bị lệch', msg, '/ca/phieu?id=' || prev_id);
    perform public.app__notify_emp(p_giver, 'Bàn giao két ca của bạn bị lệch', msg, '/ca/phieu?id=' || prev_id);
  end if;
  perform public.app_log('dem_lai_ket', 'report=' || r.id || ' ' || p_amount || ' ' || coalesce(h ->> 'state', ''));
  return h;
end $$;

-- ---------------------------------------------------------------- Ảnh: thêm loại (hang | ipos)
drop function if exists public.app_ca_photo_add(bigint, text);
create or replace function public.app_ca_photo_add(p_id bigint, p_path text, p_kind text default 'hang') returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; nid bigint;
begin
  a := public.app_account();
  perform public.app__ca_need_edit(p_id);
  if p_path !~ ('^r' || p_id || '/') then raise exception 'Đường dẫn ảnh không hợp lệ.'; end if;
  if coalesce(p_kind, 'hang') not in ('hang', 'ipos') then raise exception 'Loại ảnh không hợp lệ.'; end if;
  insert into public.shift_report_photos(report_id, path, created_by, kind) values (p_id, p_path, a.id, coalesce(p_kind, 'hang')) returning id into nid;
  return nid;
end $$;

-- ---------------------------------------------------------------- Số liệu tiền: cộng khoản lệch bàn giao vào ca GIAO
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
  select coalesce(sum(amount), 0) into debt_new from public.shift_debts where report_id = p_id;
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

-- ---------------------------------------------------------------- Đọc phiếu: tình trạng nhận két; GIẤU số két ca trước khi chưa đếm mù
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
  hide_prev := not ds and r.opening_cash is null and r.shift <> (public.app__shifts())[1];
  if h is not null and hide_prev then h := h || jsonb_build_object('prev_cash', null, 'gap', null, 'hidden', true); end if;
  -- phiếu đã hoàn thành mà ca sau chưa đếm nhận két → giấu số két (và ảnh phiếu iPOS) với người khác
  ns := public.app__ca_next_shift(r.shift);
  if r.status = 'hoan_thanh' and not ds and coalesce(r.completed_by, -1) <> a.id and ns is not null then
    select * into nx from public.shift_reports where branch_id = r.branch_id and work_date = r.work_date and shift = ns;
    hide_own := nx.id is null or nx.opening_cash is null;
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
    'staff', coalesce((select jsonb_agg(to_jsonb(s) || jsonb_build_object('code', e.code, 'name', e.name, 'rank', e.rank)
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

-- ---------------------------------------------------------------- Lưu nháp: tiền đầu ca chỉ đặt qua "Đếm nhận két"; thêm Số dư đầu iPOS
create or replace function public.app_ca_save(p_id bigint, p jsonb) returns jsonb
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
    opening_cash = case when r.shift = (public.app__shifts())[1] then 1000000 else r.opening_cash end,
    opening_note = nullif(trim(coalesce(p ->> 'opening_note', '')), ''),
    ipos_opening = case when p ? 'ipos_opening' then nullif(p ->> 'ipos_opening', '')::bigint else r.ipos_opening end,
    cups = nullif(p ->> 'cups', '')::int,
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
    insert into public.shift_report_staff(report_id, employee_id, source, role, worked, absent_reason, time_in, time_out, note)
    values (r.id, (x ->> 'employee_id')::bigint, coalesce(x ->> 'source', 'ho_tro'), nullif(x ->> 'role', ''),
            case when (x ->> 'worked')::boolean then 1 else 0 end, nullif(x ->> 'absent_reason', ''),
            nullif(x ->> 'time_in', ''), nullif(x ->> 'time_out', ''), nullif(x ->> 'note', ''))
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

-- ---------------------------------------------------------------- Hoàn thành: thêm nhận két, Số dư đầu iPOS, ảnh phiếu iPOS
create or replace function public.app_ca_complete(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; s record; debt_new bigint; miss text[] := '{}'; h jsonb; is_first boolean;
begin
  a := public.app_account();
  r := public.app__ca_need_edit(p_id);
  is_first := r.shift = (public.app__shifts())[1];
  if public.app__ca_forced_start(r) is not null and r.rev_start is distinct from public.app__ca_forced_start(r) then
    update public.shift_reports set rev_start = public.app__ca_forced_start(r) where id = r.id;
    r.rev_start := public.app__ca_forced_start(r);
  end if;
  if r.opening_cash is null and not is_first then miss := miss || 'Đếm nhận két đầu ca'::text; end if;
  if r.ipos_opening is null then miss := miss || 'Số dư đầu trên phiếu iPOS'::text; end if;
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
  if r.goods_status is null then miss := miss || 'Nhập hàng (Không nhận / Đủ / Thiếu)'::text; end if;
  if not exists (select 1 from public.shift_report_photos where report_id = r.id and kind = 'ipos') then miss := miss || 'Ảnh phiếu chốt ca iPOS'::text; end if;
  if array_length(miss, 1) > 0 then raise exception 'Còn thiếu: %.', array_to_string(miss, ', '); end if;
  if least(r.total_revenue, r.pos_cash, r.pos_transfer, r.reported_transfer, r.cash_counted, r.opening_cash, r.cups, r.ipos_opening) < 0 then
    raise exception 'Các số liệu doanh thu, tiền, số cốc không được âm.';
  end if;
  if exists (select 1 from public.shift_debts where report_id = r.id and amount <= 0) then
    raise exception 'Mỗi bàn còn nợ cần số tiền lớn hơn 0.';
  end if;
  select coalesce(sum(amount), 0) into debt_new from public.shift_debts where report_id = r.id;
  if r.total_revenue <> r.pos_cash + r.pos_transfer + debt_new then
    raise exception 'Mục 1 (Tổng doanh thu) phải bằng Mục 2 + Mục 3 + Công nợ phát sinh (%). Đang lệch % — hãy sửa trước khi hoàn thành.',
      public.app__vnd(debt_new), public.app__vnd(r.total_revenue - r.pos_cash - r.pos_transfer - debt_new);
  end if;
  h := public.app__ca_hand(r.id);
  if h is not null then
    if h ->> 'state' = 'can_dem_lai' then
      raise exception 'Tiền nhận két lệch két cuối ca % (%). Hãy cùng 1 người ca % đếm lại và nhập số đếm lại trước khi hoàn thành.',
        h ->> 'prev_shift', public.app__vnd((h ->> 'gap')::bigint), h ->> 'prev_shift';
    end if;
    if h ->> 'state' = 'lech' and coalesce(trim(r.opening_note), '') = '' then
      raise exception 'Tiền nhận két (%) lệch két cuối ca % (%). Ghi lý do lệch trước khi hoàn thành.',
        public.app__vnd(r.opening_cash), h ->> 'prev_shift', public.app__vnd((h ->> 'prev_cash')::bigint);
    end if;
  end if;
  if r.ipos_opening <> r.opening_cash and coalesce(trim(r.opening_note), '') = '' then
    raise exception 'Số dư đầu trên iPOS (%) khác tiền nhận két (%). Ghi lý do trước khi hoàn thành.',
      public.app__vnd(r.ipos_opening), public.app__vnd(r.opening_cash);
  end if;
  if r.goods_status = 'thieu' and not exists (select 1 from public.shift_report_goods where report_id = r.id) then
    raise exception 'Nhập hàng THIẾU: hãy ghi mặt hàng và số lượng thiếu.';
  end if;
  if exists (select 1 from public.shift_report_moves where report_id = r.id and (amount = 0 or trim(note) = '')) then
    raise exception 'Mỗi dòng thu chi cần số tiền khác 0 và nội dung.';
  end if;
  for s in select e.code, e.name, st.* from public.shift_report_staff st join public.employees e on e.id = st.employee_id where st.report_id = r.id loop
    if s.worked = 1 and (s.time_in is null or s.time_out is null) then
      raise exception 'Nhập giờ đến và giờ về của % – %.', s.code, s.name;
    end if;
    if s.worked = 0 and coalesce(trim(s.absent_reason), '') = '' then
      raise exception 'Ghi lý do nghỉ của % – %.', s.code, s.name;
    end if;
  end loop;
  update public.shift_reports set status = 'hoan_thanh', completed_by = a.id, completed_at = public.vn_now_text(),
         updated_by = a.id, updated_at = public.vn_now_text()
   where id = r.id;
  perform public.app_log('hoan_thanh_chot_ca', 'report=' || r.id);
end $$;

-- ---------------------------------------------------------------- Bảng ca: thêm tình trạng nhận két
create or replace function public.app_ca_overview(p_date text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare out jsonb; ds boolean := public.app_can('doi_soat');
begin
  perform public.app__need('chot_ca');
  select coalesce(jsonb_agg(x.j order by x.ord, x.sord), '[]'::jsonb) into out from (
    select b.sort_order as ord, sh.sort_order as sord,
           jsonb_build_object('branch_id', b.id, 'branch_code', coalesce(b.display_code, b.code), 'branch_name', b.name,
             'shift', sh.name, 'start_time', bs.start_time, 'end_time', bs.end_time,
             'report_id', r.id, 'status', r.status, 'recon_status', r.recon_status,
             'created_by', public.app__acc_name(r.created_by), 'completed_by', public.app__acc_name(r.completed_by),
             'completed_at', r.completed_at,
             'cash_left', (m.j ->> 'tm_left')::bigint, 'transfer_left', (m.j ->> 'ck_left')::bigint, 'ck_basis', m.j ->> 'ck_basis',
             'handover_gap', (m.j ->> 'handover_gap')::bigint,
             'hand_state', case when ds then hd.h ->> 'state' end, 'hand_gap', case when ds then (hd.h ->> 'gap')::bigint end,
             'revenue', (e.d ->> 'total_revenue')::bigint, 'cups', (e.d ->> 'cups')::int,
             'checks', (select count(*) from public.shift_report_checks c where c.report_id = r.id),
             'short_total', (select sum(x.amount) from public.shift_report_results x where x.report_id = r.id and x.result = 'thieu'),
             'over_total', (select sum(x.amount) from public.shift_report_results x where x.report_id = r.id and x.result = 'thua'),
             'has_debt', exists (select 1 from public.shift_debts d where d.report_id = r.id)) as j
      from public.branches b
      join public.branch_shifts bs on bs.branch_id = b.id and bs.enabled = 1
      join public.shifts sh on sh.id = bs.shift_id and sh.status = 'Đang sử dụng'
      left join public.shift_reports r on r.branch_id = b.id and r.work_date = p_date and r.shift = sh.name
      left join lateral (select case when r.status = 'hoan_thanh' then public.app__ca_eff(r.id) end as d) e on true
      left join lateral (select case when r.status = 'hoan_thanh' and ds then public.app__ca_money(r.id) end as j) m on true
      left join lateral (select case when r.id is not null and ds then public.app__ca_hand(r.id) end as h) hd on true
     where b.status = 'Đang hoạt động'
  ) x;
  return out;
end $$;

-- ---------------------------------------------------------------- Quyền gọi hàm
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'app\_ca\_%' or p.proname like 'app\_\_ca\_%' or p.proname = 'app__notify_doi_soat') loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname like 'app\_\_%' then execute format('revoke execute on function %s from authenticated', f.sig);
    else execute format('grant execute on function %s to authenticated', f.sig); end if;
  end loop;
end $$;
