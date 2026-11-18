-- Bước 133 (anh Tiến chốt 17/11): Báo nợ chọn người nợ (vào đúng nhóm Công nợ: ① khách · ② kho tổng · ③ khác), Thu/Chi đổi thành Báo nợ
-- ở bước Kiểm tra (Lưu 1 lần, ghi "đổi từ"), Luân chuyển tiền mặt – CK 2 chiều, và quyền Kiểm tra / sửa phiếu chỉ Chủ, Quản lý tổng,
-- quản lý đối soát của cơ sở (ô Đối soát ca trong Bảng phân công). Chạy lại nhiều lần không sao.

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

  perform public.app__ca_validate_exchanges(p->'moves');
  delete from public.shift_report_moves where report_id = r.id;
  for x in select * from jsonb_array_elements(coalesce(p -> 'moves', '[]')) loop
    i := i + 1;
    insert into public.shift_report_moves(report_id, kind, amount, note, sort_order, exchange_key)
    values (r.id, x ->> 'kind', coalesce(nullif(x ->> 'amount', '')::bigint, 0), coalesce(x ->> 'note', ''), i, nullif(x->>'exchange_key','')::uuid);
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
      insert into public.shift_debts(branch_id, report_id, table_name, amount, note, created_by, kind, grp)
      values (r.branch_id, r.id, trim(x ->> 'table_name'), coalesce(nullif(x ->> 'amount', '')::bigint, 0), nullif(x ->> 'note', ''), a.id,
              case when x ->> 'kind' in ('muon', 'ck') then x ->> 'kind' else 'bill' end,
              case when x ->> 'grp' in ('khach', 'kho', 'khac') then x ->> 'grp' end)   -- bước 133: chọn người nợ → nhóm Công nợ
      returning id into nid;
    else
      nid := (x ->> 'id')::bigint;
      update public.shift_debts set table_name = trim(x ->> 'table_name'), amount = coalesce(nullif(x ->> 'amount', '')::bigint, 0),
             note = nullif(x ->> 'note', ''), kind = case when x ->> 'kind' in ('bill', 'muon', 'ck') then x ->> 'kind' else kind end,
             grp = case when x ->> 'grp' in ('khach', 'kho', 'khac') then x ->> 'grp' else grp end
       where id = nid and report_id = r.id and closed_at is null;
    end if;
    d_ids := d_ids || to_jsonb(nid);
  end loop;
  return jsonb_build_object('at', public.vn_now_text(), 'rev_start', coalesce(forced, nullif(p ->> 'rev_start', '')),
                            'handover_ids', h_ids, 'debt_ids', d_ids);
end $function$
;

create or replace function public.app_ca_debt_people(p_branch bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts := public.app_account();
begin
  if a.id is null or not (coalesce(public.app_can('chot_ca'), false) or coalesce(public.app_can('doi_soat'), false)) then raise exception 'Bạn không có quyền.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('name', z.name, 'grp', z.grp) order by z.grp desc, z.name)
    from (select distinct on (lower(trim(d.table_name))) trim(d.table_name) name, d.grp
            from public.shift_debts d where d.branch_id = p_branch and d.grp in ('kho', 'khac') and trim(coalesce(d.table_name, '')) <> ''
           order by lower(trim(d.table_name)), d.id desc) z
    where not (z.grp = 'kho' and lower(z.name) = 'kho tổng')), '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('name', 'Kho tổng', 'grp', 'kho'));
end $$;

CREATE OR REPLACE FUNCTION public.app_ca_get(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'staff', coalesce((select jsonb_agg(to_jsonb(s) || jsonb_build_object('code', e.code, 'name', e.name, 'rank', e.rank, 'pay_cash', e.pay_cash,
                           'sched', public.app__ca_sched(r.id, s.employee_id))
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
    'open_debts', coalesce((select jsonb_agg(to_jsonb(d) || jsonb_build_object('from_date', coalesce(o.work_date, left(d.created_at, 10)), 'from_shift', o.shift, 'by_ql', d.report_id is null, 'created_name', public.app__acc_name(d.created_by),
                            'closed_by_name', public.app__acc_name(d.closed_by)) order by d.id)
                           from public.shift_debts d left join public.shift_reports o on o.id = d.report_id
                          where d.branch_id = r.branch_id and coalesce(d.report_id, 0) <> r.id
                            and (d.report_id is null or (o.work_date, array_position(public.app__shifts(), o.shift)) < (r.work_date, array_position(public.app__shifts(), r.shift)))
                            and (d.closed_at is null or d.closed_report_id = r.id)), '[]'),
    'recon_debts', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.table_name, 'phone', d.phone, 'amount', d.amount, 'item', d.gap_item, 'note', d.note,
                       'closed', d.closed_at is not null, 'closed_report_id', d.closed_report_id, 'collect_kind', d.collect_kind, 'by', public.app__acc_name(d.created_by)) order by d.id)
                     from public.shift_debts d where d.gap_report = r.id), '[]'),
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
    'move_notes', case when r.status = 'hoan_thanh' then public.app__ca_move_notes(r.id) end,   -- bước 120: ghi chú sửa thu chi (nhân viên cũng xem)
    'forced_start', public.app__ca_forced_start(r),
    'tol', public.app__ca_tol(),
    'can_edit', r.status = 'dang_chot',
    'can_recon', ds and r.status = 'hoan_thanh' and public.app__ca_auto_ok(a, r.branch_id),
    'recon_note', case when ds and r.status = 'hoan_thanh' and not public.app__ca_auto_ok(a, r.branch_id) then 'Chỉ quản lý đối soát cơ sở này (Bảng phân công), Quản lý tổng hoặc Chủ kiểm tra / sửa được phiếu này.' end,
    'can_reopen', public.app_can('mo_lai_phieu_ca') and r.status = 'hoan_thanh');
  if hide_own then out := out || jsonb_build_object('cash_counted', null, 'cash_hidden', true); end if;
  return out;
end $function$
;

CREATE OR REPLACE FUNCTION public.app_ca_recon_apply(p_id bigint, p_changes jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; why text := nullif(trim(coalesce(p_reason, '')), ''); c jsonb := coalesce(p_changes, '{}'::jsonb);
        x jsonb; it text; has boolean; auto_hit boolean := false; did bigint;
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu chưa gửi nên chưa sửa ở bước Kiểm tra được.'; end if;
  if not public.app__ca_auto_ok(a, r.branch_id) then raise exception 'Chỉ Chủ, Quản lý tổng hoặc quản lý đối soát của cơ sở này kiểm tra / sửa được phiếu này.'; end if;   -- bước 133: quyền Kiểm tra theo cơ sở
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT — không sửa được.'; end if;
  has := coalesce(jsonb_typeof(c -> 'fields') = 'object' and c -> 'fields' <> '{}'::jsonb, false)
      or exists (select 1 from unnest(array['debts', 'paid', 'to_exchange', 'photos']) k where jsonb_typeof(c -> k) = 'array' and jsonb_array_length(c -> k) > 0);
  if not has then return jsonb_build_object('changed', false); end if;
  if why is null then raise exception 'Ghi lý do sửa trước khi lưu.'; end if;
  -- mục tiền đã duyệt → mở lại (Lưu xong phải Duyệt lại); mục web tự đối soát: Chủ, QL tổng, quản lý đối soát cơ sở (bước 128)
  for it in select c2.item from public.shift_report_checks c2
             where c2.report_id = p_id and c2.item in ('thoi_gian', 'doanh_thu', 'cong_no', 'thu_chi', 'tien_mat', 'chuyen_khoan') order by c2.item loop
    if exists (select 1 from public.shift_report_checks c3 where c3.report_id = p_id and c3.item = it and c3.auto = 1) then
      if not public.app__ca_auto_ok(a, r.branch_id) then raise exception 'Mục web đã tự đối soát — chỉ Chủ, Quản lý tổng hoặc quản lý đối soát của cơ sở này sửa được.'; end if;
      auto_hit := true;
    end if;
    perform public.app__ca_item_reopen(p_id, it, a.id, why);
  end loop;
  -- 1) số Phiếu Fabi, thu chi… (bản kiểm tra)
  if jsonb_typeof(c -> 'fields') = 'object' and c -> 'fields' <> '{}'::jsonb then
    perform public.app_ca_recon_save(p_id, c -> 'fields', why);
  end if;
  -- 2) báo nợ
  for x in select * from jsonb_array_elements(coalesce(c -> 'debts', '[]'::jsonb)) loop
    if x ->> 'op' = 'set' then
      did := public.app_ca_recon_debt_set(p_id, nullif(x ->> 'id', '')::bigint, x ->> 'kind', x ->> 'name', (x ->> 'amount')::bigint, nullif(x ->> 'note', ''), why, nullif(x ->> 'from', ''));
      if x ->> 'grp' in ('khach', 'kho', 'khac') then update public.shift_debts set grp = x ->> 'grp' where id = did; end if;   -- bước 133
    elsif x ->> 'op' = 'remove' then
      if not exists (select 1 from public.shift_debts where id = (x ->> 'id')::bigint and report_id = p_id) then raise exception 'Không tìm thấy khoản nợ cần xoá.'; end if;
      perform public.app_ca_recon_debt_remove(p_id, (x ->> 'id')::bigint, why);
    else raise exception 'Thao tác khách nợ không hợp lệ.'; end if;
  end loop;
  -- 3) khách trả nợ cũ trong ca
  for x in select * from jsonb_array_elements(coalesce(c -> 'paid', '[]'::jsonb)) loop
    if x ->> 'op' = 'collect' then perform public.app_ca_recon_debt_collect(p_id, (x ->> 'debt')::bigint, x ->> 'kind', (x ->> 'amount')::bigint, why);
    elsif x ->> 'op' = 'update' then perform public.app_ca_recon_debt_update(p_id, (x ->> 'debt')::bigint, x ->> 'kind', (x ->> 'amount')::bigint, why);
    elsif x ->> 'op' = 'uncollect' then perform public.app_ca_recon_debt_uncollect(p_id, (x ->> 'debt')::bigint, why);
    else raise exception 'Thao tác khách trả nợ không hợp lệ.'; end if;
  end loop;
  -- 4) Khách mượn → Khách CK rút tiền mặt
  for x in select * from jsonb_array_elements(coalesce(c -> 'to_exchange', '[]'::jsonb)) loop
    perform public.app_ca_recon_debt_to_exchange(p_id, (x #>> '{}')::bigint, why);
  end loop;
  -- 5) ảnh phiếu Fabi
  for x in select * from jsonb_array_elements(coalesce(c -> 'photos', '[]'::jsonb)) loop
    if x ->> 'op' = 'add' then perform public.app_ca_recon_photo_add(p_id, x ->> 'path', why);
    elsif x ->> 'op' = 'del' then perform public.app_ca_recon_photo_del((x ->> 'id')::bigint, why);
    else raise exception 'Thao tác ảnh không hợp lệ.'; end if;
  end loop;
  if auto_hit and coalesce(a.system_role, '') <> 'chu' then perform public.app__ca_auto_notify(p_id, a.id, why); end if;
  perform public.app_log('doi_soat_luu_phan_tien', 'report=' || p_id);
  return jsonb_build_object('changed', true);
end $function$
;

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
  if not public.app__ca_auto_ok(a, r.branch_id) then raise exception 'Chỉ Chủ, Quản lý tổng hoặc quản lý đối soát của cơ sở này kiểm tra / sửa được phiếu này.'; end if;   -- bước 133: quyền Kiểm tra theo cơ sở
  if exists (select 1 from public.shift_report_checks c where c.report_id = p_id and c.auto = 1 and c.item = any(p_items)) then
    if not public.app__ca_auto_ok(a, r.branch_id) then raise exception 'Mục web đã tự đối soát — chỉ Chủ, Quản lý tổng hoặc quản lý đối soát của cơ sở này sửa được.'; end if;
    if coalesce(a.system_role, '') <> 'chu' then perform public.app__ca_auto_notify(p_id, a.id, why); end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.app_ca_recon_finish(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; n int;
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu chưa hoàn thành.'; end if;
  if not public.app__ca_auto_ok(a, r.branch_id) then raise exception 'Chỉ Chủ, Quản lý tổng hoặc quản lý đối soát của cơ sở này kiểm tra / sửa được phiếu này.'; end if;   -- bước 133: quyền Kiểm tra theo cơ sở
  if r.recon_status = 'hoan_thanh' then return; end if;
  select count(*) into n from public.shift_report_checks where report_id = p_id;
  if n < array_length(public.app__ca_check_items(), 1) then
    raise exception 'Còn % hạng mục chưa đối soát.', array_length(public.app__ca_check_items(), 1) - n;
  end if;
  if (select count(*) from public.shift_report_results where report_id = p_id) < array_length(public.app__ca_money_items(), 1) then
    raise exception 'Các hạng mục tiền cần chọn kết quả KHỚP / THIẾU / THỪA.';
  end if;
  insert into public.shift_report_recon(report_id, data, updated_by) values (p_id, public.app__recon_snapshot(p_id), a.id)
  on conflict (report_id) do nothing;
  update public.shift_reports set recon_status = 'hoan_thanh', recon_by = a.id, recon_at = public.vn_now_text() where id = p_id;
  insert into public.shift_recon_log(report_id, action, by_account) values (p_id, 'hoan_thanh_doi_soat', a.id);
  perform public.app_log('hoan_thanh_doi_soat', 'report=' || p_id);
end $function$
;

CREATE OR REPLACE FUNCTION public.app__ca_validate_exchanges(p_moves jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare x record;
begin
  for x in select v->>'exchange_key' k, count(*) n,
    count(*) filter(where v->>'kind'='tien_mat') tm,
    count(*) filter(where v->>'kind'='chuyen_khoan') ck,
    sum((v->>'amount')::bigint) total, count(distinct v->>'note') notes
    from jsonb_array_elements(coalesce(p_moves,'[]')) v where nullif(v->>'exchange_key','') is not null group by 1
  loop
    perform x.k::uuid;
    if x.n <> 2 or x.tm <> 1 or x.ck <> 1 or x.total <> 0 or x.notes <> 1 then
      raise exception 'Phiếu luân chuyển tiền mặt – CK phải có đủ hai vế bằng nhau (một vế tiền mặt, một vế chuyển khoản). Sửa hoặc xoá cả phiếu.';
    end if;
  end loop;
end $function$
;

revoke all on function public.app_ca_debt_people(bigint) from public, anon;
grant execute on function public.app_ca_debt_people(bigint) to authenticated;
revoke all on function public.app_ca_recon_apply(bigint, jsonb, text) from public, anon;
grant execute on function public.app_ca_recon_apply(bigint, jsonb, text) to authenticated;
revoke all on function public.app_ca_recon_direct(bigint, jsonb, text, text[]) from public, anon;
grant execute on function public.app_ca_recon_direct(bigint, jsonb, text, text[]) to authenticated;
revoke all on function public.app_ca_recon_finish(bigint) from public, anon;
grant execute on function public.app_ca_recon_finish(bigint) to authenticated;
revoke all on function public.app_ca_get(bigint) from public, anon;
grant execute on function public.app_ca_get(bigint) to authenticated;
revoke all on function public.app__ca_save_core(bigint, jsonb), public.app__ca_validate_exchanges(jsonb) from public, anon, authenticated;

insert into public.app_migrations(file) values ('117_bao_no_chon_nguoi.sql') on conflict (file) do nothing;
