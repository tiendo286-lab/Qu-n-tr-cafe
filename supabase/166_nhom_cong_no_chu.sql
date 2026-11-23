-- Bước chặng 6.4 (anh Tiến chốt 23/11/2026): 4 nhóm công nợ + nợ khách hàng không cần tên.
--  * Nhóm mới 'chu' = nợ của Chủ (anh Tiến): như Kho tổng / Người nhà — không nhắc ở phiếu chốt ca, chỉ quản lý thu. 'khac' hiển thị "Người nhà / người quen".
--  * Nợ khách hàng ('khach'): gắn người chung "Khách" của cơ sở (app__khach_person), chữ đã gõ (khách / bàn 5…) giữ ở table_name làm ghi chú;
--    không phải Xếp ở bước 1 (app__stc_ds_missing, app_stc_month 'sorted'). Không thêm người nhóm Khách hàng vào danh sách nữa.
--  * Vùng khoá: app_ca_recon_apply chỉ thêm 'chu' vào danh sách nhóm hợp lệ; app__stc_ds_missing bỏ qua nợ khách khi đếm "chưa xếp". Không đổi quyền / cách tính tiền.
--  * Chuyển dữ liệu (chạy lại được): người chung "Khách" mọi cơ sở; mọi nợ khách → người chung; người nợ nhóm khách khác → ngừng dùng;
--    người nợ mã 17 (anh Tiến) → nhóm 'chu'; khoản 26, 29 (người nhà) → nhóm 'khac', người mã 14.
-- Sinh từ bản hàm đang chạy (pg_get_functiondef) + thay chữ có kiểm số lần khớp.

alter table public.debt_people drop constraint if exists debt_people_grp_check;
alter table public.debt_people add constraint debt_people_grp_check check (grp = any (array['khach', 'kho', 'chu', 'khac']));

create or replace function public.app__khach_person(p_branch bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare pid bigint;
begin
  if p_branch is null then return null; end if;
  select id into pid from public.debt_people where branch_id = p_branch and lower(btrim(name)) = 'khách' order by (grp = 'khach') desc, active desc, id limit 1;
  if pid is null then
    insert into public.debt_people(branch_id, name, grp, active) values (p_branch, 'Khách', 'khach', 1) returning id into pid;
  else
    update public.debt_people set grp = 'khach', active = 1, name = 'Khách' where id = pid and (grp, active, name) is distinct from ('khach', 1, 'Khách');
  end if;
  return pid;
end $$;
revoke all on function public.app__khach_person(bigint) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.app__debt_grp_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    if new.grp is null then
      new.grp := coalesce((select x.grp from public.shift_debts x where x.id = new.split_from),
                          case when coalesce(new.family, 0) = 1 then 'khac' else 'khach' end);
    end if;
  elsif new.grp is distinct from old.grp then
    null;
  elsif coalesce(new.family, 0) is distinct from coalesce(old.family, 0) then
    new.grp := case when new.family = 1 then case when old.grp = 'khach' then 'khac' else old.grp end else 'khach' end;
  end if;
  if new.grp not in ('khach', 'kho', 'chu', 'khac') then new.grp := 'khach'; end if;
  new.family := case when new.grp = 'khach' then 0 else 1 end;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.app__debt_person_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.debt_people; src public.shift_debts; nm text := btrim(coalesce(new.table_name, ''));
begin
  -- khoản hệ thống tự sinh từ khoản khác (phần còn thiếu khi trả nợ, khoản tách kiểu cũ, nợ từ khoản vay): thừa hưởng người + dấu đã xếp của khoản gốc, không kiểm tên
  if new.split_from is not null or new.rest_of is not null or new.from_loan is not null then
    if tg_op = 'INSERT' and new.person_id is null and coalesce(new.split_from, new.rest_of) is not null then
      select * into src from public.shift_debts where id = coalesce(new.split_from, new.rest_of);
      new.person_id := src.person_id; new.sorted_by := src.sorted_by; new.sorted_at := src.sorted_at; new.content := coalesce(new.content, src.content);
    end if;
    return new;
  end if;
  -- chặng 6.4: nợ khách hàng không cần tên — gắn người chung "Khách" của cơ sở; chữ đã gõ (khách / bàn 5…) giữ làm ghi chú
  if coalesce(new.grp, 'khach') = 'khach' then
    new.person_id := public.app__khach_person(new.branch_id);
    if nm = '' then new.table_name := 'Khách'; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and lower(nm) = lower(btrim(coalesce(old.table_name, ''))) then return new; end if;
  select * into p from public.debt_people where branch_id = new.branch_id and lower(btrim(name)) = lower(nm) and active = 1;
  if p.id is not null then
    new.person_id := p.id; new.table_name := p.name;
  elsif new.report_id is not null or nm = '' then
    new.person_id := null;   -- nợ ghi trong phiếu ca (nhân viên gõ tay): quản lý xếp ở bước 1 của Đối soát Fabi
  else
    raise exception 'Người nợ "%" chưa có trong danh sách. Thêm ở Sổ thu chi › Sổ chi › 👥 Người nợ trước.', nm;
  end if;
  -- tên đổi sang NGƯỜI KHÁC (hoặc về tên gõ tay) mà lần sửa này không tự đặt dấu đã xếp → coi như chưa xếp
  if tg_op = 'UPDATE' and new.person_id is distinct from old.person_id and new.sorted_at is not distinct from old.sorted_at
     and coalesce(current_setting('app.debt_sort', true), '') <> '1' then   -- '1' = đang ở trong app_stc_debt_sort (quản lý xếp)
    new.sorted_at := null; new.sorted_by := null;
  end if;
  return new;
end $function$;

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
              case when x ->> 'grp' in ('khach', 'kho', 'chu', 'khac') then x ->> 'grp' end)   -- bước 133: chọn người nợ → nhóm Công nợ
      returning id into nid;
    else
      nid := (x ->> 'id')::bigint;
      update public.shift_debts set table_name = trim(x ->> 'table_name'), amount = coalesce(nullif(x ->> 'amount', '')::bigint, 0),
             note = nullif(x ->> 'note', ''), kind = case when x ->> 'kind' in ('bill', 'muon', 'ck') then x ->> 'kind' else kind end,
             grp = case when x ->> 'grp' in ('khach', 'kho', 'chu', 'khac') then x ->> 'grp' else grp end
       where id = nid and report_id = r.id and closed_at is null;
    end if;
    d_ids := d_ids || to_jsonb(nid);
  end loop;
  return jsonb_build_object('at', public.vn_now_text(), 'rev_start', coalesce(forced, nullif(p ->> 'rev_start', '')),
                            'handover_ids', h_ids, 'debt_ids', d_ids);
end $function$;

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
      if x ->> 'grp' in ('khach', 'kho', 'chu', 'khac') then update public.shift_debts set grp = x ->> 'grp' where id = did; end if;   -- bước 133
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
end $function$;

CREATE OR REPLACE FUNCTION public.app_ca_debt_people(p_branch bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app_account();
begin
  if a.id is null or not (coalesce(public.app_can('chot_ca'), false) or coalesce(public.app_can('doi_soat'), false)) then raise exception 'Bạn không có quyền.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'grp', p.grp, 'id', p.id) order by p.grp desc, lower(p.name))
      from public.debt_people p
     where p.branch_id = p_branch and p.active = 1 and p.grp in ('kho', 'chu', 'khac') and lower(btrim(p.name)) <> 'kho tổng'), '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('name', 'Kho tổng', 'grp', 'kho',
         'id', (select p.id from public.debt_people p where p.branch_id = p_branch and lower(btrim(p.name)) = 'kho tổng')));
end $function$;

CREATE OR REPLACE FUNCTION public.app_cn_debt_save(p_id bigint, p jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; br bigint := nullif(p ->> 'branch_id', '')::bigint; nm text := trim(coalesce(p ->> 'name', ''));
        ph text := trim(coalesce(p ->> 'phone', '')); amt bigint := nullif(p ->> 'amount', '')::bigint; nt text := trim(coalesce(p ->> 'note', ''));
        d text := coalesce(nullif(p ->> 'date', ''), left(public.vn_now_text(), 10)); old public.shift_debts; nid bigint;
        k text := case when p ->> 'kind' in ('muon', 'ck') then p ->> 'kind' else 'bill' end;
        g text := case when p ->> 'grp' in ('khach', 'kho', 'chu', 'khac') then p ->> 'grp' when coalesce((p ->> 'family')::boolean, false) then 'khac' else 'khach' end;
        fo int := case when coalesce((p ->> 'fund_out')::boolean, false) and (case when p ->> 'kind' in ('muon', 'ck') then p ->> 'kind' else 'bill' end) <> 'bill' then 1 else 0 end;
begin
  if p_id is not null then
    select * into old from public.shift_debts where id = p_id;
    if old.id is null then raise exception 'Không tìm thấy khoản nợ.'; end if;
    if old.report_id is not null then raise exception 'Khoản nợ này ghi ở phiếu ca — sửa ở phiếu ca.'; end if;
    if old.closed_at is not null then raise exception 'Khoản nợ đã thu — không sửa được.'; end if;
    if old.from_loan is not null or old.split_from is not null or old.gap_report is not null or old.mv_report is not null then raise exception 'Khoản này không sửa được ở đây.'; end if;
    br := old.branch_id;
  end if;
  a := public.app__tc_need(br);
  if not public.app__cn_can(br) then raise exception 'Bạn không được ghi công nợ của cơ sở này.'; end if;
  if nm = '' and g = 'kho' then nm := 'Kho tổng'; end if;
  if nm = '' and g = 'khach' then nm := 'Khách'; end if;   -- chặng 6.4
  if nm = '' then raise exception 'Ghi tên người nợ.'; end if;
  if amt is null or amt <= 0 then raise exception 'Nhập số tiền nợ lớn hơn 0.'; end if;
  if d !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Ngày không hợp lệ.'; end if;
  if fo = 1 and public.app__fin_locked(br, coalesce(left(old.created_at, 10), d)) then raise exception 'Tháng này đã CHỐT — không ghi tiền ra quỹ được.'; end if;
  if p_id is null then
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, grp, fund_out)
    values (br, null, nm, amt, nt, nullif(ph, ''), a.id, d || substr(public.vn_now_text(), 11), k, g, fo) returning id into nid;
  else
    if old.fund_out = 1 and old.amount <> amt and public.app__fin_locked(br, left(old.created_at, 10)) then raise exception 'Tháng của khoản này đã CHỐT — không đổi số tiền được.'; end if;
    update public.shift_debts set table_name = nm, amount = amt, note = nt, phone = nullif(ph, ''), kind = k, grp = g,
           fund_out = case when public.app__fin_locked(br, left(old.created_at, 10)) then old.fund_out else fo end where id = p_id; nid := p_id;
  end if;
  perform public.app_log(case when p_id is null then 'khach_no_them' else 'khach_no_sua' end, 'debt=' || nid || ' ' || amt || ' ' || nm || ' · ' || g);
  return nid;
end $function$;

CREATE OR REPLACE FUNCTION public.app_cn_person_save(p_ids bigint[], p_name text, p_phone text, p_grp text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare br bigint; nb int; n int; nm text := trim(coalesce(p_name, ''));
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then raise exception 'Chưa chọn người nợ.'; end if;
  select count(distinct branch_id), min(branch_id) into nb, br from public.shift_debts where id = any(p_ids);
  if nb <> 1 then raise exception 'Các khoản nợ phải cùng một cơ sở.'; end if;
  perform public.app__tc_need(br);
  if not coalesce(public.app__cn_can(br), false) then raise exception 'Bạn không được sửa công nợ của cơ sở này.'; end if;
  if nm = '' then raise exception 'Ghi tên người nợ.'; end if;
  if coalesce(p_grp, '') not in ('khach', 'kho', 'chu', 'khac') then raise exception 'Chọn nhóm nợ.'; end if;
  if p_grp <> 'khach' then perform public.app__debt_people_sync_rename(br, p_ids, nm, p_phone, p_grp); end if;   -- chặng 6.4: khách không vào danh sách   -- bước 172: danh sách người nợ đi trước
  update public.shift_debts set table_name = nm, phone = nullif(trim(coalesce(p_phone, '')), ''), grp = p_grp where id = any(p_ids);
  get diagnostics n = row_count;
  perform public.app_log('cong_no_nguoi', n || ' khoản → ' || nm || ' · ' || p_grp);
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.app_stc_ca_debt_save(p_report bigint, p_debt bigint, p jsonb, p_reason text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app_account(); r public.shift_reports; d public.shift_debts; pp public.debt_people; rs text;
  k text := p ->> 'kind'; amt bigint; g text := p ->> 'grp'; nt text := nullif(btrim(coalesce(p ->> 'note', '')), ''); nid bigint; old jsonb; nw jsonb;
begin
  r := public.app__stc_ca_debt_gate(p_report);
  rs := public.app__stc_reason(p_reason);
  if p_debt is not null then d := public.app__stc_ca_debt_pick(r.id, p_debt); end if;   -- kiểm khoản nợ trước (nợ hoá đơn / đã trả báo đúng lý do)
  if coalesce(k, '') not in ('muon', 'ck') then raise exception 'Chọn tiền mặt hay chuyển khoản.'; end if;
  amt := case when (p ->> 'amount') ~ '^[0-9]+$' then (p ->> 'amount')::bigint end;
  if coalesce(amt, 0) <= 0 then raise exception 'Nhập số tiền nợ lớn hơn 0.'; end if;
  if p_debt is null then
    select * into pp from public.debt_people
     where id = case when (p ->> 'person_id') ~ '^[0-9]+$' then (p ->> 'person_id')::bigint end and branch_id = r.branch_id and active = 1;
    if pp.id is null then raise exception 'Chọn người nợ trong danh sách.'; end if;
    if coalesce(g, '') not in ('khach', 'kho', 'chu', 'khac') then raise exception 'Chọn nhóm công nợ.'; end if;
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, created_by, kind, grp, person_id, sorted_by, sorted_at)
    values (r.branch_id, r.id, pp.name, amt, nt, a.id, k, g, pp.id, a.id, public.vn_now_text())
    returning id into nid;
    nw := jsonb_build_object('id', nid, 'kind', k, 'table_name', pp.name, 'amount', amt, 'note', nt);
    insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
    values (r.id, 'bao_no_them', null, null, nw, 'Sổ thu chi: ' || rs, a.id);
  else
    if d.kind = k and d.amount = amt then raise exception 'Chưa đổi gì.'; end if;
    update public.shift_debts set kind = k, amount = amt where id = d.id;
    nid := d.id;
    old := jsonb_build_object('id', d.id, 'kind', d.kind, 'table_name', d.table_name, 'amount', d.amount);
    nw := jsonb_build_object('id', d.id, 'kind', k, 'table_name', d.table_name, 'amount', amt);
    insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
    values (r.id, 'bao_no_sua', null, old, nw, 'Sổ thu chi: ' || rs, a.id);
  end if;
  perform public.app__stc_untick(r.id, array['ld', 'sau_tm', 'sau_ck']);
  perform public.app__stc_log(r.branch_id, 'debt', 'cd:' || nid, case when p_debt is null then 'them' else 'sua' end, old, nw, rs);
  perform public.app_log('stc_sua_no_ca', 'report=' || r.id || ' debt=' || nid || ' ' || case when p_debt is null then 'them' else 'sua' end || ' ' || k || ' ' || amt);
  return nid;
end $function$;

CREATE OR REPLACE FUNCTION public.app_stc_debt_sort(p_debt bigint, p_person bigint, p_grp text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app_account(); d public.shift_debts; p public.debt_people; r public.shift_reports; typed text; open_n int;
begin
  select * into d from public.shift_debts where id = p_debt for update;
  if d.id is null then raise exception 'Không tìm thấy khoản nợ.'; end if;
  if d.report_id is not null then r := public.app__stc_ds_need(d.report_id, false);
  else perform public.app__stc_need(d.branch_id); end if;
  if d.split_from is not null then raise exception 'Xếp ở khoản nợ gốc của khoản này.'; end if;
  with recursive tree as (
    select g.id, g.closed_at from public.shift_debts g where g.id = d.id
    union all
    select c.id, c.closed_at from public.shift_debts c join tree t on c.split_from = t.id)
  select count(*) into open_n from tree where closed_at is null;
  if open_n = 0 then raise exception 'Khoản nợ đã thu — không đổi được.'; end if;
  select * into p from public.debt_people where id = case when p_grp = 'khach' then public.app__khach_person(d.branch_id) else p_person end
     and branch_id = d.branch_id and active = 1;   -- chặng 6.4: Khách hàng → người chung
  if p.id is null then raise exception 'Chọn người nợ trong danh sách.'; end if;
  if coalesce(p_grp, '') not in ('khach', 'kho', 'chu', 'khac') then raise exception 'Chọn nhóm công nợ.'; end if;
  if d.report_id is not null and exists (select 1 from public.stc_ca_done c where c.report_id = d.report_id) then
    raise exception 'Ca đã hoàn thành đối soát — bấm Mở lại trước.';
  end if;
  if public.app__fin_locked(d.branch_id, coalesce(r.work_date, left(d.created_at, 10))) then raise exception 'Tháng này đã CHỐT — không đổi được.'; end if;
  typed := btrim(coalesce(d.table_name, ''));
  perform set_config('app.debt_sort', '1', true);
  update public.shift_debts x set table_name = case when p_grp = 'khach' then coalesce(nullif(btrim(x.content), ''), x.table_name) else p.name end,
         person_id = p.id, grp = p_grp, sorted_by = a.id, sorted_at = public.vn_now_text(),
         content = case when p_grp = 'khach' then x.content when typed <> '' and lower(typed) <> lower(btrim(p.name)) then typed else x.content end   -- giữ lại chữ nhân viên gõ
   where x.id = d.id;
  -- khoản con chưa thu của nợ tách kiểu cũ nhận theo
  with recursive tree as (
    select c.id from public.shift_debts c where c.split_from = d.id
    union all
    select c.id from public.shift_debts c join tree t on c.split_from = t.id)
  update public.shift_debts x set table_name = case when p_grp = 'khach' then x.table_name else p.name end, person_id = p.id, grp = p_grp, sorted_by = a.id, sorted_at = public.vn_now_text()
   where x.id in (select id from tree) and x.closed_at is null;
  perform set_config('app.debt_sort', '', true);
  if d.report_id is not null then
    insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
    values (d.report_id, 'xep_no', null, jsonb_build_object('table_name', typed, 'grp', d.grp),
            jsonb_build_object('id', d.id, 'table_name', p.name, 'grp', p_grp), 'Xếp người + nhóm công nợ', a.id);
  end if;
  perform public.app_log('stc_xep_no', 'debt=' || d.id || ' → ' || p.name || ' · ' || p_grp);
end $function$;

CREATE OR REPLACE FUNCTION public.app_stc_person_save(p_id bigint, p jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app_account(); old public.debt_people; br bigint := nullif(p ->> 'branch_id', '')::bigint;
  nm text := btrim(coalesce(p ->> 'name', '')); ph text := nullif(btrim(coalesce(p ->> 'phone', '')), ''); g text := p ->> 'grp';
  act int := case when p ? 'active' and (p ->> 'active') in ('0', 'false') then 0 else 1 end; nid bigint;
begin
  if p_id is not null then
    select * into old from public.debt_people where id = p_id;
    if old.id is null then raise exception 'Không tìm thấy người nợ.'; end if;
    br := old.branch_id;
  end if;
  perform public.app__stc_need(br);
  if nm = '' then raise exception 'Nhập tên người nợ.'; end if;
  if coalesce(g, '') not in ('khach', 'kho', 'chu', 'khac') then raise exception 'Chọn nhóm công nợ.'; end if;
  if old.id is not null and lower(btrim(old.name)) = 'kho tổng' and (lower(nm) <> 'kho tổng' or act = 0 or g <> 'kho') then
    raise exception 'Kho tổng luôn có — không đổi tên / ngừng dùng được.';
  end if;
  if old.id is not null and old.grp = 'khach' and lower(btrim(old.name)) = 'khách' then
    raise exception 'Người chung "Khách" luôn có — không sửa được.';
  end if;
  if g = 'khach' then raise exception 'Nợ khách hàng không cần tên — ghi chú ở khoản nợ.'; end if;   -- chặng 6.4
  if exists (select 1 from public.debt_people x where x.branch_id = br and lower(btrim(x.name)) = lower(nm) and x.id is distinct from p_id) then
    raise exception 'Đã có người nợ tên này.';
  end if;
  if p_id is null then
    insert into public.debt_people(branch_id, name, phone, grp, active, created_by) values (br, nm, ph, g, act, a.id) returning id into nid;
  else
    nid := p_id;
    update public.debt_people set name = nm, phone = ph, grp = g, active = act where id = p_id;
    if old.name is distinct from nm then   -- đổi tên: các khoản chưa thu của người này mang tên mới (tab Công nợ gộp theo tên)
      begin
        update public.shift_debts set table_name = nm where person_id = p_id and closed_at is null and table_name is distinct from nm;
      exception when others then
        raise exception 'Chưa đổi tên được vì người này có khoản nợ ở ca chưa đối soát được: %', sqlerrm;
      end;
    end if;
    if old.grp is distinct from g then
      update public.shift_debts set grp = g where person_id = p_id and closed_at is null and grp is distinct from g;
    end if;
  end if;
  perform public.app_log('stc_nguoi_no_luu', 'person=' || nid || ' ' || nm || ' · ' || g || case when act = 0 then ' · ngừng dùng' else '' end);
  return nid;
end $function$;

CREATE OR REPLACE FUNCTION public.app_stc_people(p_branch bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.app__stc_need(p_branch);
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'phone', p.phone, 'grp', p.grp, 'active', p.active,
             'open', coalesce(o.open, 0), 'n', coalesce(o.n, 0), 'shared', p.grp = 'khach' and lower(btrim(p.name)) = 'khách') order by p.active desc, array_position(array['khach', 'kho', 'chu', 'khac'], p.grp), lower(p.name))
      from public.debt_people p
      left join (select d.person_id, sum(d.amount) open, count(*) n from public.shift_debts d
                  where d.branch_id = p_branch and d.closed_at is null and d.amount > 0 and d.person_id is not null
                    and not exists (select 1 from public.shift_debts z where z.split_from = d.id)
                  group by d.person_id) o on o.person_id = p.id
     where p.branch_id = p_branch), '[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.app_tc_move_to_debt(p_report bigint, p_mkey text, p_grp text, p_name text, p_phone text, p_note text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; m record; nid bigint; nm text := trim(coalesce(p_name, ''));
begin
  select * into r from public.shift_reports where id = p_report for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__tc_need(r.branch_id);
  if not coalesce(public.app__cn_can(r.branch_id), false) then raise exception 'Bạn không được ghi công nợ của cơ sở này.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không đổi được.'; end if;
  if coalesce(p_grp, '') not in ('khach', 'kho', 'chu', 'khac') then raise exception 'Chọn nhóm nợ.'; end if;
  if nm = '' and p_grp = 'kho' then nm := 'Kho tổng'; end if;
  if nm = '' then raise exception 'Ghi tên người nợ.'; end if;
  select * into m from public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) x where x.report_id = r.id and x.mkey = p_mkey;
  if m.report_id is null then raise exception 'Khoản này vừa thay đổi. Tải lại trang.'; end if;
  if m.auto is not null then raise exception 'Khoản tự động không đổi thành nợ được.'; end if;
  if m.amount >= 0 then raise exception 'Chỉ khoản CHI mới đổi thành nợ được.'; end if;
  if exists (select 1 from public.shift_debts d where d.mv_report = r.id and d.mv_key = p_mkey) then raise exception 'Khoản này đã thành nợ rồi.'; end if;
  if public.app__tc_move_ka(r.id, p_mkey) then raise exception 'Khoản này đã gán âm tiền trừ lương — bỏ gán trước.'; end if;
  insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, grp, mv_report, mv_key)
  values (r.branch_id, null, nm, -m.amount, coalesce(nullif(trim(coalesce(p_note, '')), ''), m.note), nullif(trim(coalesce(p_phone, '')), ''), a.id,
          r.work_date || substr(public.vn_now_text(), 11), case when m.pay = 'chuyen_khoan' then 'ck' else 'muon' end, p_grp, r.id, p_mkey)
  returning id into nid;
  insert into public.fin_move_cats(report_id, mkey, category_id, excluded, by_account, at, checked, checked_by, checked_at)
  values (r.id, p_mkey, null, 1, a.id, public.vn_now_text(), 1, a.id, public.vn_now_text())
  on conflict (report_id, mkey) do update set category_id = null, excluded = 1, by_account = excluded.by_account, at = excluded.at,
          checked = 1, checked_by = excluded.checked_by, checked_at = excluded.checked_at;
  perform public.app_log('thu_chi_thanh_no', 'report=' || r.id || ' ' || m.note || ' → debt=' || nid || ' ' || -m.amount || ' · ' || p_grp);
  return nid;
end $function$;

CREATE OR REPLACE FUNCTION public.app__stc_ds_missing(p_report bigint)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.shift_reports; s jsonb; m jsonb; ca jsonb; its jsonb; out text[] := '{}'; tk text[]; last_ca boolean; nx public.shift_reports; ns jsonb;
  chi_n int; chi_nocat int; chi_big int; thu_no int; pm text; pend int; big_gap int; n_sort int;
begin
  select * into r from public.shift_reports where id = p_report;
  s := public.app__stc_ds_state(p_report);
  if not coalesce((s ->> 'done')::boolean, false) then return array['Chưa Xác nhận Fabi']; end if;
  m := public.app_stc_month(r.branch_id, left(r.work_date, 7));
  select c into ca from jsonb_array_elements(m -> 'cas') c where (c ->> 'id')::bigint = p_report;
  select coalesce(jsonb_agg(i), '[]') into its from jsonb_array_elements(m -> 'items') i
   where (i ->> 'ca_id')::bigint = p_report and not coalesce((i ->> 'void')::boolean, false);
  select coalesce(array_agg(item), '{}') into tk from public.stc_ca_ticks where report_id = p_report;
  -- bước 1
  if not ((s ->> 'mo1')::boolean and (s ->> 'mo2')::boolean) then out := array_append(out, 'Tiền mở ca chưa khớp'::text); end if;
  if not (s ->> 'dt')::boolean then out := array_append(out, 'Doanh thu chưa khớp máy Fabi'::text); end if;
  if not (s ->> 'no')::boolean then out := array_append(out, 'Nợ bill chưa khớp máy Fabi'::text); end if;
  -- bước 172: nợ mới của ca còn tiền chưa thu mà chưa xếp người + nhóm công nợ (tính cả nợ tách kiểu cũ: gốc đã thu, con chưa thu)
  with recursive tree as (
    select g.id root, g.id, g.closed_at from public.shift_debts g
     where g.report_id = p_report and g.split_from is null and g.amount > 0 and g.sorted_at is null and coalesce(g.grp, 'khach') <> 'khach'
    union all
    select t.root, c.id, c.closed_at from public.shift_debts c join tree t on c.split_from = t.id)
  select count(distinct t.root) into n_sort from tree t where t.closed_at is null;
  if n_sort > 0 then out := array_append(out, format('Còn %s khoản nợ mới chưa xếp người + nhóm công nợ', n_sort)); end if;
  if coalesce((ca -> 'fabi' ->> 'edited_bills')::int, 0) > 0 and not ('hd' = any(tk)) then out := array_append(out, 'Chưa tích: đã hỏi về hoá đơn bị sửa / xoá'::text); end if;
  if not ('anh' = any(tk)) then out := array_append(out, 'Chưa tích: ảnh phiếu Fabi đúng với số máy'::text); end if;
  -- bước 2
  select o.* into nx from public.shift_reports o
   where o.branch_id = r.branch_id and o.work_date = r.work_date and o.status = 'hoan_thanh'
     and array_position(public.app__shifts(), o.shift) > array_position(public.app__shifts(), r.shift)
   order by array_position(public.app__shifts(), o.shift) limit 1;
  last_ca := nx.id is null;
  if coalesce(r.cash_mode, 'ngay') = 'ca' and r.ql_counted is null then out := array_append(out, 'Chưa nhập tiền mặt quản lý đếm két'::text); end if;
  if coalesce(r.cash_mode, 'ngay') = 'ca' or last_ca then
    if not ('goi' = any(tk)) then out := array_append(out, 'Chưa tích: két để lại đúng 1.000.000 cho ca sau'::text); end if;
  else
    ns := public.app__stc_ds_state(nx.id);
    if not ((ns ->> 'mo1')::boolean and (ns ->> 'mo2')::boolean) then out := array_append(out, 'Tiền đóng ca này chưa bằng tiền mở ca sau'::text); end if;
  end if;
  if ca ->> 'bank_ck' is null or coalesce((ca ->> 'kt_wait')::boolean, false) then out := array_append(out, 'Chuyển khoản chưa có số ngân hàng'::text); end if;
  -- bước 3
  select count(*) into thu_no from jsonb_array_elements(its) i where i ->> 'book' = 'thu' and i ->> 'col' = 'no';
  if thu_no > 0 and not ('tn' = any(tk)) then out := array_append(out, 'Chưa tích: thu nợ đúng khách'::text); end if;
  if not ('sot' = any(tk)) then out := array_append(out, 'Chưa tích: không sót khoản thu'::text); end if;
  -- bước 4
  select count(*), count(*) filter (where coalesce(i ->> 'cat', '') = ''), count(*) filter (where (i ->> 'amount')::numeric >= 300000)
    into chi_n, chi_nocat, chi_big from jsonb_array_elements(its) i where i ->> 'book' = 'chi' and i ->> 'col' = 'chi';
  if chi_nocat > 0 then out := array_append(out, format('Còn %s khoản chi chưa chọn nhóm', chi_nocat)); end if;
  if chi_n > 0 and not ('that' = any(tk)) then out := array_append(out, 'Chưa tích: khoản chi có thật'::text); end if;
  if chi_big > 0 and not ('lon' = any(tk)) then out := array_append(out, 'Chưa tích: đã xem khoản từ 300.000'::text); end if;
  -- bước 5: dòng Chênh lệch — xong khi chữ trạng thái không còn "chờ", hoặc đang chờ Chủ duyệt, hoặc đã bấm Để sau
  foreach pm in array array['tm', 'ck'] loop
    select count(*) into pend from jsonb_array_elements(its) i
     where i ->> 'col' = 'lech' and i ->> 'pm' = pm and coalesce((i ->> 'gross')::numeric, (i ->> 'amount')::numeric, 0) <> 0
       and case when coalesce(i ->> 'status', '') <> '' then (i ->> 'status') ~* 'chờ' and not (i ->> 'status') ~* 'chờ Chủ duyệt'
                else i -> 'gap' is not null and jsonb_typeof(i -> 'gap') <> 'null' end;
    if pend > 0 and not (('sau_' || pm) = any(tk)) then
      out := array_append(out, case pm when 'tm' then 'Tiền mặt' else 'Chuyển khoản' end || ' lệch chưa chọn cách xử lý');
    end if;
  end loop;
  select count(*) into big_gap from jsonb_array_elements(its) i
   where i ->> 'col' = 'lech' and coalesce((i ->> 'gross')::numeric, (i ->> 'amount')::numeric, 0) <> 0 and not coalesce(i ->> 'status', '') ~ 'Lệch nhỏ';
  if big_gap > 0 and not ('ld' = any(tk)) then out := array_append(out, 'Chưa tích: đã hỏi lý do thiếu / thừa'::text); end if;
  return out;
end $function$;

CREATE OR REPLACE FUNCTION public.app_stc_month(p_branch bigint, p_month text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app_account(); st text := public.app__fund_start(); d0 text; d1 text; br record; res jsonb;
begin
  if a.id is null then raise exception 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'; end if;
  if not coalesce(public.app__stc_can(p_branch), false) then raise exception 'Bạn không được xem thu chi của cơ sở này.'; end if;
  if coalesce(p_month, '') !~ '^\d{4}-\d{2}$' then raise exception 'Tháng không hợp lệ.'; end if;
  d0 := greatest(p_month || '-01', st);
  d1 := to_char((p_month || '-01')::date + interval '1 month' - interval '1 day', 'YYYY-MM-DD');
  select b.id, coalesce(b.display_code, b.code) code, b.name into br from public.branches b where b.id = p_branch and b.status = 'Đang hoạt động';
  if br.id is null then raise exception 'Không tìm thấy cơ sở.'; end if;

  with r as materialized (   -- mỗi phiếu tính bản đối soát, ngân hàng, kế toán đúng 1 lần
    select x.id, x.work_date, x.shift, x.cash_mode, x.ql_counted, x.ipos_opening, x.opening_cash, x.total_revenue, x.pos_debt,
           public.app__ca_eff(x.id) e, public.app__kt_bank_json(x) b, public.app__ca_kt_state(x.id) kt,
           (select to_jsonb(f) from public.fabi_shifts f
             where f.report_id = x.id or (f.report_id is null and f.branch_id = x.branch_id and f.work_date = x.work_date and f.shift = x.shift)
             order by (f.report_id = x.id) desc nulls last limit 1) fb,
           (exists (select 1 from public.shift_report_results s where s.report_id = x.id and s.item = 'tien_mat')
            and exists (select 1 from public.shift_report_results s where s.report_id = x.id and s.item = 'chuyen_khoan')) mdone
      from public.shift_reports x
     where x.branch_id = p_branch and x.status = 'hoan_thanh' and x.work_date between st and d1),
  mv as (   -- khoản thu chi của phiếu (cùng cách đặt khoá mkey như app__tc_moves_x để nối nhóm / đối soát)
    select r.id rid, r.work_date, t.ord, (t.v ->> 'kind') pay, (t.v ->> 'amount')::bigint amt, coalesce(t.v ->> 'note', '') note,
           md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) || '#'
             || row_number() over (partition by r.id, md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) order by t.ord) mkey,
           case when nullif(t.v ->> 'exchange_key', '') is not null then 'doi_tien' else t.v ->> 'auto' end auto
      from r cross join lateral jsonb_array_elements(coalesce(r.e -> 'moves', '[]'::jsonb)) with ordinality t(v, ord)
     where coalesce((t.v ->> 'amount')::bigint, 0) <> 0),
  it as (
    -- doanh thu (phần khách trả tiền mặt / chuyển khoản)
    select r.work_date d, r.id ca, 'thu' book, p.pm, 'dt' col, p.amt amount, 'Doanh thu ca ' || r.shift title,
           case when r.fb is null then 'Theo phiếu (chưa có file Fabi)' else 'Theo phiếu đã đối soát / Fabi' end meta,
           null::text cat, null::bigint cat_type, true checked, false no_cost, null::text status, null::text src_from, false to_qn, null::text recv,
           'f:' || r.id || ':' || p.pm id, 'dt' src
      from r cross join lateral (values ('tm', coalesce((r.e ->> 'pos_cash')::bigint, 0)), ('ck', coalesce((r.e ->> 'pos_transfer')::bigint, 0))) p(pm, amt)
     where p.amt > 0
    union all   -- khoản thu chi phiếu ca
    select mv.work_date, mv.rid, case when mv.amt < 0 then 'chi' else 'thu' end, case when mv.pay = 'chuyen_khoan' then 'ck' else 'tm' end,
           case when mv.auto = 'doi_tien' then 'lc' when mv.auto = 'muon' or dl.id is not null or ln.id is not null then 'no' when mv.amt < 0 then 'chi' else 'khac' end,
           abs(mv.amt), mv.note,
           case when mv.auto = 'luong' then 'Lương trả tiền mặt' when mv.auto = 'muon' then 'Khách mượn tiền két (Nợ TM)' when dl.id is not null then 'Đã thành nợ'
                when ln.id is not null then 'Đã thành cho vay' else 'Phiếu ca' end,
           c.name, c.type_id, coalesce(fc.checked, 0) = 1 or mv.auto in ('doi_tien', 'muon'), coalesce(fc.excluded, case when mv.amt > 0 then 1 else 0 end) = 1,
           null, null, false, null, 'm:' || mv.rid || ':' || mv.mkey, 'move'
      from mv left join public.fin_move_cats fc on fc.report_id = mv.rid and fc.mkey = mv.mkey
      left join public.fin_categories c on c.id = fc.category_id
      left join lateral (select d.id from public.shift_debts d where d.mv_report = mv.rid and d.mv_key = mv.mkey order by d.id limit 1) dl on true
      left join lateral (select l.id from public.branch_loans l where l.report_id = mv.rid and l.mkey = mv.mkey order by l.id limit 1) ln on true
    union all   -- nợ chuyển khoản phát sinh trong ca (cho nợ CK)
    select r.work_date, r.id, 'chi', 'ck', 'no', d.amount, 'Nợ CK – ' || d.table_name, 'Phiếu ca', null, null, true, true, null, null, false, null, 'dn:' || d.id, 'debt'
      from r join public.shift_debts d on d.report_id = r.id and d.kind = 'ck' and d.amount > 0
    union all   -- khách trả nợ trong ca
    select r.work_date, r.id, 'thu', case when d.collect_kind = 'chuyen_khoan' then 'ck' else 'tm' end, 'no', d.amount, d.table_name, case when d.close_note like 'Gán nợ khách trả%' then 'Gán nợ khách trả (quản lý)' else 'Khách trả nợ trong ca' end,
           null, null, true, true, null,
           (select 'ca ' || x.shift || ' ' || to_char(x.work_date::date, 'DD/MM') from public.shift_reports x where x.id = d.report_id), false, null, 'dc:' || d.id, 'debt'
      from r join public.shift_debts d on d.closed_report_id = r.id and d.collect_kind in ('tien_mat', 'chuyen_khoan')
    union all   -- quản lý thu nợ ngoài ca
    select left(d.closed_at, 10), null, 'thu', case when d.collect_kind = 'chuyen_khoan' then 'ck' else 'tm' end, 'no', d.amount, d.table_name, 'Quản lý thu ngoài ca',
           null, null, true, true, null,
           (select 'ca ' || x.shift || ' ' || to_char(x.work_date::date, 'DD/MM') from public.shift_reports x where x.id = d.report_id), false, null, 'dc:' || d.id, 'debt'
      from public.shift_debts d
     where d.branch_id = p_branch and d.closed_at is not null and d.closed_report_id is null and d.collect_kind in ('tien_mat', 'chuyen_khoan') and left(d.closed_at, 10) between st and d1
    union all   -- công nợ quản lý ghi, tiền đưa từ quỹ
    select left(d.created_at, 10), null, 'chi', case when d.kind = 'ck' then 'ck' else 'tm' end, 'no', d.amount,
           (case when d.kind = 'ck' then 'Nợ CK: ' else 'Nợ TM: ' end) || d.table_name, 'Quản lý ghi, tiền đưa từ quỹ', null, null, true, true, null, null, false, null, 'dn:' || d.id, 'debt'
      from public.shift_debts d where d.branch_id = p_branch and d.fund_out = 1 and d.report_id is null and left(d.created_at, 10) between st and d1
    union all   -- cho vay cũ (từ quỹ) và lần trả
    select l.loan_date, null, 'chi', case when l.method = 'chuyen_khoan' then 'ck' else 'tm' end, 'no', l.amount,
           case when l.kind = 'tra_ho' then 'Trả hộ Kho tổng' else 'Cho vay: ' || p.name end, 'Cho vay (cũ)', null, null, true, true, null, null, false, null, 'l:' || l.id, 'loan'
      from public.branch_loans l join public.loan_people p on p.id = l.person_id
     where l.branch_id = p_branch and l.report_id is null and l.from_debt is null and l.loan_date between st and d1
    union all
    select y.pay_date, null, 'thu', case when y.method = 'chuyen_khoan' then 'ck' else 'tm' end, 'no', y.amount, 'Trả nợ vay: ' || p.name, 'Cho vay (cũ)',
           null, null, true, true, null, null, false, null, 'lp:' || y.id, 'loan'
      from public.branch_loan_payments y join public.branch_loans l on l.id = y.loan_id join public.loan_people p on p.id = l.person_id
     where l.branch_id = p_branch and y.pay_date between st and d1
    union all   -- khoản quản lý tạo (kể cả phiếu chi chuyển khoản, điều chỉnh kiểm quỹ); quán chịu / thu khác từ lệch không đổi quỹ nên bỏ
    select e.entry_date, null, case when e.kind = 'chi' then 'chi' else 'thu' end, case when e.pay_method = 'chuyen_khoan' then 'ck' else 'tm' end,
           case when e.kind = 'chi' then 'chi' else 'khac' end, e.amount, e.note,
           case when bo.rid is not null then 'Phiếu chi chuyển khoản · ca ' || bo.shift || ' ' || to_char(bo.wd::date, 'DD/MM') else 'Quản lý tạo' end,
           c.name, c.type_id, true, false, null, null, false, null, 'e:' || e.id, 'entry'
      from public.fin_entries e left join public.fin_categories c on c.id = e.category_id
      left join lateral (select o.report_id rid, x.shift, x.work_date wd from public.shift_bank_outs o join public.shift_reports x on x.id = o.report_id
                          where o.fin_entry_id = e.id limit 1) bo on true
     where e.branch_id = p_branch and e.entry_date between st and d1 and not coalesce(e.no_fund, false)
    union all   -- nhân viên nộp bù khoản âm (tiền mặt)
    select left(s.status_at, 10), null, 'thu', 'tm', 'khac', s.amount, 'NV bù khoản âm: ' || coalesce(em.code || ' – ' || em.name, '?'), 'Nộp bù',
           null, null, true, true, null, null, false, null, 'k:' || s.id, 'shortfall'
      from public.shift_shortfalls s join public.shift_reports x on x.id = s.report_id left join public.employees em on em.id = s.employee_id
     where x.branch_id = p_branch and s.status = 'da_bu' and left(s.status_at, 10) between st and d1
    union all   -- luân chuyển quỹ tiền mặt ↔ tài khoản: 2 vế
    select t.tdate, null, v.book, v.pm, 'lc', t.amount,
           case when t.direction = 'tm_tk' then 'Nộp tiền mặt vào tài khoản' else 'Rút tài khoản ra tiền mặt' end || case when t.note <> '' then ' · ' || t.note else '' end,
           'Luân chuyển quỹ', null, null, true, true, null, null, false, null, 't:' || t.id || ':' || v.book, 'transfer'
      from public.fund_transfers t
      cross join lateral (values ('chi', case when t.direction = 'tm_tk' then 'tm' else 'ck' end), ('thu', case when t.direction = 'tm_tk' then 'ck' else 'tm' end)) v(book, pm)
     where t.branch_id = p_branch and t.tdate between st and d1
    union all   -- phiếu rút cũ = chuyển về Quỹ ngoài
    select w.wdate, null, 'chi', case when w.method = 'chuyen_khoan' then 'ck' else 'tm' end, 'lc', w.amount,
           'Chuyển về Quỹ ngoài' || case when w.note <> '' then ' · ' || w.note else '' end,
           case when w.kind = 'cuoi_thang' then 'Phiếu rút cuối tháng (cũ)' else 'Phiếu rút giữ hộ (cũ)' end,
           null, null, true, true, case when w.status = 'da_nhan' then 'Chủ đã nhận · khoá' else 'Chờ Chủ nhận' end, null, true,
           case when w.status = 'da_nhan' then 'da' else 'cho' end, 'w:' || w.id, 'withdrawal'
      from public.fund_withdrawals w where w.branch_id = p_branch and w.wdate between st and d1
  ),
  g as (   -- chênh lệch mỗi ca từ khoản ở trên
    select r.id, r.work_date, r.shift,
           (r.e ->> 'opening_cash')::bigint start_tm,
           case when r.cash_mode = 'ca' and r.ql_counted is not null then r.ql_counted + public.app__stc_handover_adj(r.id) else (r.e ->> 'cash_counted')::bigint end real_tm,
           case when coalesce((r.b ->> 'account_count')::int, 0) > 0 and (r.b ->> 'entered')::int = (r.b ->> 'account_count')::int then (r.b ->> 'received')::bigint end real_ck,
           coalesce((select sum(case when it.book = 'thu' then it.amount else -it.amount end) from it where it.ca = r.id and it.pm = 'tm'), 0) net_tm,
           coalesce((select sum(case when it.book = 'thu' then it.amount else -it.amount end) from it where it.ca = r.id and it.pm = 'ck'), 0) net_ck
      from r),
  gs as (select * from public.app__gap_rows(p_branch, d0, d1)),
  lech as (
    select g.work_date d, g.id ca, case when v.gap > 0 then 'thu' else 'chi' end book, v.pm, 'lech' col, greatest(abs(v.gap) - coalesce((select sum(mm.amount) from public.gap_matches mm where mm.status = 'da_duyet' and mm.item = case when v.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end
                     and ((v.gap < 0 and mm.short_report = g.id) or (v.gap > 0 and mm.over_report = g.id))), 0), 0) amount,
           case when v.gap > 0 then 'Ca dư tiền' else 'Ca thiếu tiền' end title,
           case when v.pm = 'tm' then 'Tiền mặt thực tế ' || public.app__vnd(g.real_tm) else 'Ngân hàng nhận ' || public.app__vnd(g.real_ck) end meta,
           null::text cat, null::bigint cat_type, true checked, true no_cost,
           coalesce((select case gs.state when 'xong' then 'Đã xử lý' when 'du' then 'Chờ xử lý (dư)' when 'cho_no' then 'Chờ khách trả nợ'
                                 when 'cho_tien' then 'Chờ tiền về' else 'Chờ xử lý · chưa làm phiếu trừ tiền' end
                       from gs where gs.report_id = g.id and gs.item = case when v.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end limit 1),
                    case when abs(v.gap) <= 5000 then 'Lệch nhỏ ≤ 5.000 (coi như khớp)' else null end)
           || case when exists (select 1 from public.gap_matches mm where mm.status = 'cho_duyet' and mm.item = case when v.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end and (mm.short_report = g.id or mm.over_report = g.id))
                     or exists (select 1 from public.stc_gap_requests q where q.status = 'cho_duyet' and q.report_id = g.id and q.item = case when v.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end)
                   then ' · ⏳ chờ Chủ duyệt' else '' end status,
           null::text src_from, false to_qn, null::text recv, 'g:' || g.id || ':' || v.pm id, 'gap' src
      from g cross join lateral (values ('tm', g.real_tm - g.start_tm - g.net_tm), ('ck', g.real_ck - g.net_ck)) v(pm, gap)
     where v.gap is not null and v.gap <> 0),
  allit as (select * from it union all select * from lech),
  ed as (select e.*, public.app__acc_name(e.by_account) by_name from public.stc_edits e where e.branch_id = p_branch),
  vd as (   -- khoản cũ đã bị sửa / xoá: hiện gạch ngang, không cộng
    select v.*, ed.action v_action, ed.by_name v_by, ed.at v_at, ed.reason v_reason
      from ed cross join lateral (
        select ed.old ->> 'entry_date' d, null::bigint ca, case when ed.old ->> 'kind' = 'chi' then 'chi' else 'thu' end book,
               case when ed.old ->> 'pay_method' = 'chuyen_khoan' then 'ck' else 'tm' end pm, case when ed.old ->> 'kind' = 'chi' then 'chi' else 'khac' end col,
               (ed.old ->> 'amount')::bigint amount, ed.old ->> 'note' title, 'Quản lý tạo' meta, ed.old ->> 'category' cat, 'v:' || ed.id id, 'entry' src
         where ed.kind = 'entry'
        union all
        select ed.old ->> 'tdate', null, l.book, l.pm, 'lc', (ed.old ->> 'amount')::bigint,
               case when ed.old ->> 'direction' = 'tm_tk' then 'Nộp tiền mặt vào tài khoản' else 'Rút tài khoản ra tiền mặt' end || case when coalesce(ed.old ->> 'note', '') <> '' then ' · ' || (ed.old ->> 'note') else '' end,
               'Luân chuyển quỹ', null, 'v:' || ed.id || ':' || l.book, 'transfer'
          from (values ('chi', case when ed.old ->> 'direction' = 'tm_tk' then 'tm' else 'ck' end), ('thu', case when ed.old ->> 'direction' = 'tm_tk' then 'ck' else 'tm' end)) l(book, pm)
         where ed.kind = 'transfer'
        union all
        select left(ed.old ->> 'created_at', 10), null, 'chi', case when ed.old ->> 'kind' = 'ck' then 'ck' else 'tm' end, 'no', (ed.old ->> 'amount')::bigint,
               (case when ed.old ->> 'kind' = 'ck' then 'Nợ CK: ' else 'Nợ TM: ' end) || (ed.old ->> 'table_name'), 'Quản lý ghi, tiền đưa từ quỹ', null, 'v:' || ed.id, 'debt'
         where ed.kind = 'debt'
        union all
        select coalesce((select x.work_date from public.shift_reports x where x.id = (ed.old ->> 'closed_report_id')::bigint), left(ed.old ->> 'closed_at', 10)), (ed.old ->> 'closed_report_id')::bigint,
               'thu', case when ed.old ->> 'collect_kind' = 'chuyen_khoan' then 'ck' else 'tm' end, 'no', (ed.old ->> 'amount')::bigint,
               ed.old ->> 'table_name', case when ed.old ->> 'closed_report_id' is not null then 'Gán nợ khách trả (quản lý)' else 'Quản lý thu ngoài ca' end, null, 'v:' || ed.id, 'debt'
         where ed.kind = 'collect'
        union all
        select ed.old ->> 'date', (ed.old ->> 'ca_id')::bigint, ed.old ->> 'book', ed.old ->> 'pm', ed.old ->> 'col', (ed.old ->> 'amount')::bigint,
               ed.old ->> 'title', 'Phiếu ca', ed.old ->> 'cat', 'v:' || ed.id, 'move'
         where ed.kind = 'move') v
     where ed.action in ('sua', 'xoa') and ed.old is not null),
  oldf as (   -- Sổ quỹ cũ: số dư cuối mỗi ngày (để so)
    select f.d, sum(f.amount) filter (where f.method = 'tien_mat') tm, sum(f.amount) filter (where f.method = 'chuyen_khoan') ck
      from public.app__fund_rows(p_branch, st, least(d1, to_char(public.vn_now(), 'YYYY-MM-DD'))) f group by f.d)
  select jsonb_build_object(
    'branch', jsonb_build_object('id', br.id, 'code', br.code, 'name', br.name),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code)) order by b.sort_order)
                            from public.branches b where b.status = 'Đang hoạt động' and coalesce(public.app__stc_can(b.id), false)), '[]'),
    'owner', a.system_role = 'chu',
    'month', p_month, 'from', d0, 'to', d1, 'locked', coalesce(public.app__fin_locked(p_branch, d0), false),
    'opening', jsonb_build_object(
       'tm', coalesce((select o.amount from public.fund_openings o where o.branch_id = p_branch and o.method = 'tien_mat'), 0)
             + coalesce((select sum(case when x.book = 'thu' then x.amount else -x.amount end) from allit x where x.pm = 'tm' and x.d < d0), 0),
       'ck', coalesce((select o.amount from public.fund_openings o where o.branch_id = p_branch and o.method = 'chuyen_khoan'), 0)
             + coalesce((select sum(case when x.book = 'thu' then x.amount else -x.amount end) from allit x where x.pm = 'ck' and x.d < d0), 0)),
    'cas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'date', r.work_date, 'shift', r.shift,
        'staff', (select string_agg(em.name, ', ' order by em.code) from jsonb_array_elements(coalesce(r.e -> 'staff', '[]'::jsonb)) s
                    join public.employees em on em.id = (s ->> 'employee_id')::bigint where coalesce((s ->> 'worked')::boolean, true)),
        'cash_mode', coalesce(r.cash_mode, 'ngay'), 'ql_counted', r.ql_counted, 'nv_counted', (r.e ->> 'cash_counted')::bigint,
        'start_tm', g.start_tm, 'real_tm', g.real_tm,
        'nv', jsonb_build_object('opening', coalesce((r.e ->> 'ipos_opening')::bigint, (r.e ->> 'opening_cash')::bigint), 'revenue', (r.e ->> 'total_revenue')::bigint, 'debt', coalesce((r.e ->> 'pos_debt')::bigint, 0)),
        'nv_raw', jsonb_build_object('opening', coalesce(r.ipos_opening, r.opening_cash), 'revenue', r.total_revenue, 'debt', coalesce(r.pos_debt, 0)),
        'blame', (select to_jsonb(ob) || jsonb_build_object('by', public.app__acc_name(ob.by_account)) from public.stc_open_blame ob where ob.report_id = r.id),
        'fabi', jsonb_build_object('has', r.fb is not null, 'opening', (r.fb ->> 'dau')::bigint, 'revenue', (r.fb ->> 'net')::bigint,
                  'tm', (r.fb ->> 'tm')::bigint, 'ck', (r.fb ->> 'ck')::bigint, 'debt', coalesce((r.fb ->> 'no')::bigint, 0),
                  'edited_bills', coalesce(jsonb_array_length(case when jsonb_typeof(r.fb -> 'sua') = 'array' then r.fb -> 'sua' end), 0)),
        'bank_ck', g.real_ck, 'kt_wait', not coalesce((r.kt ->> 'ready')::boolean, true), 'kt_missing', r.kt -> 'missing',
        'recon_money_done', r.mdone,
        'fixes', public.app__stc_fix_json(r.id), 'ticks', coalesce((select jsonb_agg(tk.item order by tk.item) from public.stc_ca_ticks tk where tk.report_id = r.id), '[]'::jsonb),
        'done', case when r.mdone then (select jsonb_build_object('by', coalesce(public.app__acc_name(dn.by_account), ''), 'at', dn.at) from public.stc_ca_done dn where dn.report_id = r.id) end) order by r.work_date, array_position(public.app__shifts(), r.shift))
      from r join g on g.id = r.id where r.work_date >= d0), '[]'),
    'shortfalls', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'report_id', s.report_id, 'date', x.work_date, 'shift', x.shift,
        'item', s.item, 'employee_id', s.employee_id, 'name', coalesce(em.name, '?'), 'amount', s.amount, 'status', s.status, 'reply', s.reply,
        'reason', s.reason, 'note', s.status_note, 'move_mkey', s.move_mkey) order by x.work_date, s.id)
      from public.shift_shortfalls s join public.shift_reports x on x.id = s.report_id left join public.employees em on em.id = s.employee_id
     where x.branch_id = p_branch and x.work_date between d0 and d1 and s.status <> 'huy'), '[]'),
    'ca_debts', coalesce((with recursive cr as (
          select x.id from public.shift_reports x where x.branch_id = p_branch and x.work_date between d0 and d1),
        tree as (
          select g.id root, g.id, g.amount, g.closed_at from public.shift_debts g
           where g.report_id in (select id from cr) and g.split_from is null and g.amount > 0
          union all
          select t.root, c.id, c.amount, c.closed_at from public.shift_debts c join tree t on c.split_from = t.id)
      select jsonb_agg(q.z order by q.rid, q.t, q.did) from (
        select jsonb_build_object('report_id', g.report_id, 't', 'moi', 'id', g.id, 'who', g.table_name, 'kind', coalesce(g.kind, 'bill'),
                 'amount', s.amt, 'left', s.lft, 'pm', null, 'from', null, 'grp', g.grp, 'person_id', g.person_id, 'sorted', (g.sorted_at is not null or g.grp = 'khach'), 'content', g.content,
                   'edit', (select jsonb_build_object('action', case l.action when 'bao_no_them' then 'them' else 'sua' end, 'by', coalesce(public.app__acc_name(l.by_account), ''),
                                    'at', l.at, 'reason', regexp_replace(coalesce(l.reason, ''), '^Sổ thu chi: ', ''),
                                    'old_amount', (l.before ->> 'amount')::bigint, 'old_kind', l.before ->> 'kind')
                              from public.shift_recon_log l
                             where l.report_id = g.report_id and l.action in ('bao_no_sua', 'bao_no_them') and l.reason like 'Sổ thu chi: %' and (l.after ->> 'id')::bigint = g.id
                             order by l.id desc limit 1)) z, g.report_id rid, 'moi' t, g.id did
          from public.shift_debts g
          join (select root, sum(amount) amt, coalesce(sum(amount) filter (where closed_at is null), 0) lft from tree group by root) s on s.root = g.id
        union all
        select jsonb_build_object('report_id', g.closed_report_id, 't', 'tra', 'id', g.id, 'who', g.table_name, 'kind', coalesce(g.kind, 'bill'),
                 'amount', g.amount, 'left', 0, 'pm', g.collect_kind,
                 'from', case when o.id is not null then 'ca ' || o.shift || ' ' || to_char(o.work_date::date, 'DD/MM') else 'quản lý ghi' end),
               g.closed_report_id, 'tra', g.id
          from public.shift_debts g left join public.shift_reports o on o.id = g.report_id
         where g.closed_report_id in (select id from cr) and coalesce(g.report_id, 0) <> g.closed_report_id and g.amount > 0
          union all
          select jsonb_build_object('report_id', l.report_id, 't', 'xoa', 'id', (l.before ->> 'id')::bigint, 'who', l.before ->> 'table_name', 'kind', coalesce(l.before ->> 'kind', 'bill'),
                   'amount', (l.before ->> 'amount')::bigint, 'left', 0, 'pm', null, 'from', null,
                   'edit', jsonb_build_object('action', case when l.field = 'luan_chuyen' then 'doi' else 'xoa' end, 'by', coalesce(public.app__acc_name(l.by_account), ''),
                                              'at', l.at, 'reason', regexp_replace(coalesce(l.reason, ''), '^Sổ thu chi: ', ''))),
                 l.report_id, 'xoa', (l.before ->> 'id')::bigint
            from public.shift_recon_log l
           where l.report_id in (select id from cr) and l.action = 'bao_no_xoa' and l.reason like 'Sổ thu chi: %') q), '[]'),
    'debt_paid', coalesce((select jsonb_object_agg(g.id::text, jsonb_build_object('date', coalesce(x.work_date, left(g.closed_at, 10)), 'shift', x.shift, 'pm', g.collect_kind))
        from public.shift_debts g left join public.shift_reports x on x.id = g.closed_report_id left join public.shift_reports o on o.id = g.report_id
       where g.branch_id = p_branch and g.closed_at is not null
         and (left(g.closed_at, 10) >= d0 or coalesce(o.work_date, left(g.created_at, 10)) >= d0)), '{}'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'date', v.d, 'ca_id', v.ca, 'book', v.book, 'pm', v.pm, 'col', v.col, 'amount', v.amount,
        'title', v.title, 'meta', v.meta, 'cat', v.cat, 'void', true, 'src', v.src,
        'void_info', jsonb_build_object('action', v.v_action, 'by', v.v_by, 'at', v.v_at, 'reason', v.v_reason)) order by v.d, v.id)
      from vd v where v.d >= d0 and v.amount > 0), '[]')
      || coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'date', x.d, 'ca_id', x.ca, 'book', x.book, 'pm', x.pm, 'col', x.col, 'amount', x.amount,
        'title', x.title, 'meta', x.meta, 'cat', x.cat, 'cat_type', x.cat_type, 'checked', x.checked, 'no_cost', x.no_cost, 'status', x.status,
        'from', x.src_from, 'who', null, 'to_qn', x.to_qn, 'recv', x.recv, 'src', x.src,
        'edit', (select jsonb_build_object('action', e.action, 'by', e.by_name, 'at', e.at, 'reason', e.reason, 'old_amount', (e.old ->> 'amount')::bigint)
                   from ed e where e.ref = case when x.id like 'm:%' then x.id else split_part(x.id, ':', 1) || ':' || split_part(x.id, ':', 2) end and e.action in ('them', 'sua') order by e.id desc limit 1),

        'gross', case when x.col = 'lech' then x.amount + coalesce((select sum(mm.amount) from public.gap_matches mm where mm.status = 'da_duyet' and mm.item = case when x.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end
                   and ((x.book = 'chi' and mm.short_report = x.ca) or (x.book = 'thu' and mm.over_report = x.ca))), 0) end,
        'gap', case when x.col = 'lech' then (select jsonb_build_object('item', s.item, 'kind', s.kind, 'total', s.total, 'remain', s.remain,
            'avail', greatest(s.remain - s.mp - coalesce((select sum(q.amount) from public.stc_gap_requests q where q.report_id = x.ca and q.item = s.item and q.status = 'cho_duyet'), 0), 0),
            'people', (select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name) order by e.code) from public.shift_report_staff st join public.employees e on e.id = st.employee_id
                        where st.report_id = x.ca and coalesce(st.worked, 1) = 1),
            'tl', (select jsonb_agg(jsonb_build_object('id', sf.id, 'name', e.name, 'amount', sf.amount, 'status', sf.status, 'reply', sf.reply) order by sf.id) from public.shift_shortfalls sf
                     left join public.employees e on e.id = sf.employee_id where sf.report_id = x.ca and sf.item = s.item and sf.status <> 'huy'),
            'decisions', (select jsonb_agg(jsonb_build_object('id', gd.id, 'kind', gd.kind, 'amount', gd.amount) order by gd.id) from public.gap_decisions gd where gd.report_id = x.ca and gd.item = s.item),
            'matches', (select jsonb_agg(jsonb_build_object('id', mm.id, 'amount', mm.amount, 'status', mm.status, 'side', case when mm.short_report = x.ca then 'thieu' else 'du' end,
                          'with', (select 'ca ' || o.shift || ' ' || to_char(o.work_date::date, 'DD/MM') from public.shift_reports o where o.id = case when mm.short_report = x.ca then mm.over_report else mm.short_report end)) order by mm.id)
                        from public.gap_matches mm where mm.item = s.item and (mm.short_report = x.ca or mm.over_report = x.ca)),
            'qc_wait', (select jsonb_agg(jsonb_build_object('id', q.id, 'amount', q.amount, 'by', public.app__acc_name(q.created_by))) from public.stc_gap_requests q
                         where q.report_id = x.ca and q.item = s.item and q.status = 'cho_duyet'),
            'cands', (select jsonb_agg(jsonb_build_object('report', o.report_id, 'label', 'ca ' || o.shift || ' ' || to_char(o.work_date::date, 'DD/MM'),
                         'amount', greatest(o.remain - o.mp - coalesce((select sum(q.amount) from public.stc_gap_requests q where q.report_id = o.report_id and q.item = o.item and q.status = 'cho_duyet'), 0), 0)) order by o.work_date, o.report_id)
                       from gs o where o.item = s.item and o.kind <> s.kind and o.report_id <> x.ca and abs(o.work_date::date - s.work_date::date) <= 3 and o.remain > 0),
            'has_tl', exists (select 1 from public.shift_shortfalls sf where sf.report_id = x.ca and sf.item = s.item and sf.status <> 'huy'),
            'has_thu', exists (select 1 from public.gap_decisions gd where gd.report_id = x.ca and gd.item = s.item and gd.kind = 'thu_khac'),
            'debts', (select jsonb_agg(jsonb_build_object('id', d.id, 'who', d.table_name, 'amount', d.amount) order by d.id) from public.shift_debts d
                       where d.closed_report_id = x.ca and d.collect_kind = s.item and d.close_note like 'Gán nợ khách trả%'))
          from gs s where s.report_id = x.ca and s.item = case when x.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end limit 1) end,
        'can_edit', x.ca is null and not coalesce(public.app__fin_locked(p_branch, x.d), false)
                    and (x.src = 'transfer' or (x.src = 'entry' and x.meta = 'Quản lý tạo') or (x.src = 'debt' and (x.id like 'dn:%' or x.id like 'dc:%')))
         or (x.src = 'debt' and x.id like 'dc:%' and x.meta = 'Gán nợ khách trả (quản lý)' and not coalesce(public.app__fin_locked(p_branch, x.d), false))
         or (x.src = 'move' and x.meta = 'Phiếu ca' and x.col in ('chi', 'khac') and not coalesce(public.app__fin_locked(p_branch, x.d), false)
             and exists (select 1 from r where r.id = x.ca and r.mdone))) order by x.d, x.ca nulls last, x.id)
      from allit x where x.d >= d0 and (x.amount > 0 or x.col = 'lech')), '[]'),
    'people', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'no_remind', p.nr, 'open', p.open, 'n', p.n) order by p.nr desc, p.name)
      from (select min(trim(d.table_name)) name, bool_or(d.grp <> 'khach') nr,
                   coalesce(sum(d.amount) filter (where d.closed_at is null), 0) open, count(*) filter (where d.closed_at is null) n
              from public.shift_debts d where d.branch_id = p_branch and trim(coalesce(d.table_name, '')) <> ''
               and (d.closed_at is null or d.grp <> 'khach') group by lower(trim(d.table_name))) p), '[]'),
    'open_debts', coalesce((select jsonb_agg(jsonb_build_object('id', 'd:' || d.id, 'who', d.table_name, 'kind', coalesce(d.kind, 'bill'), 'amount', d.amount, 'left', d.amount,
        'date', coalesce(x.work_date, left(d.created_at, 10)),
        'from', case when x.id is not null then 'ca ' || x.shift || ' ' || to_char(x.work_date::date, 'DD/MM') else 'quản lý ghi' end,
        'no_remind', coalesce(d.family, 0) = 1 or coalesce(d.grp, 'khach') <> 'khach') order by coalesce(x.work_date, left(d.created_at, 10)))
      from public.shift_debts d left join public.shift_reports x on x.id = d.report_id
     where d.branch_id = p_branch and d.closed_at is null and d.amount > 0
       and not exists (select 1 from public.shift_debts z where z.split_from = d.id)), '[]'),
    'compare', jsonb_build_object(
       'fund_days', coalesce((select jsonb_agg(jsonb_build_object('date', q.d, 'tm', q.tm, 'ck', q.ck) order by q.d)
          from (select o.d,
                       coalesce((select f.amount from public.fund_openings f where f.branch_id = p_branch and f.method = 'tien_mat'), 0) + sum(coalesce(o.tm, 0)) over w tm,
                       coalesce((select f.amount from public.fund_openings f where f.branch_id = p_branch and f.method = 'chuyen_khoan'), 0) + sum(coalesce(o.ck, 0)) over w ck
                  from oldf o window w as (order by o.d rows between unbounded preceding and current row)) q
         where q.d >= d0), '[]'),
       'gaps', coalesce((select jsonb_agg(jsonb_build_object('ca_id', gs.report_id, 'pm', case when gs.item = 'tien_mat' then 'tm' else 'ck' end, 'lech', gs.lech, 'state', gs.state)) from gs), '[]'))
  ) into res;
  return res;
end $function$;

-- ===== chuyển dữ liệu (chạy lại được) =====
do $mig$
declare b record;
begin
  for b in select id from public.branches loop perform public.app__khach_person(b.id); end loop;
  -- khoản 26, 29: người nhà (đang ghi nhầm nhóm Khách hàng) → nhóm Người nhà, người mã 14
  if exists (select 1 from public.debt_people where id = 14 and grp = 'khac') then
    update public.shift_debts d set grp = 'khac', person_id = 14 where d.id in (26, 29) and d.branch_id = (select branch_id from public.debt_people where id = 14)
       and (d.grp, d.person_id) is distinct from ('khac', 14::bigint);
  end if;
  -- người nợ mã 17 = anh Tiến → nhóm Chủ (cả khoản đã thu, để lịch sử đúng nhóm)
  if exists (select 1 from public.debt_people where id = 17 and lower(btrim(name)) = 'tiến') then
    update public.debt_people set grp = 'chu' where id = 17 and grp is distinct from 'chu';
    update public.shift_debts set grp = 'chu' where person_id = 17 and grp is distinct from 'chu';
  end if;
  -- mọi khoản nợ khách hàng → người chung "Khách" (chữ cũ giữ ở table_name làm ghi chú)
  update public.shift_debts d set person_id = public.app__khach_person(d.branch_id)
   where coalesce(d.grp, 'khach') = 'khach' and d.person_id is distinct from public.app__khach_person(d.branch_id);
  -- người nợ nhóm Khách hàng khác người chung → ngừng dùng (không xoá, giữ lịch sử)
  update public.debt_people p set active = 0
   where p.grp = 'khach' and p.active = 1 and p.id <> public.app__khach_person(p.branch_id);
end $mig$;

insert into public.app_migrations(file) values ('166_nhom_cong_no_chu.sql') on conflict (file) do nothing;
