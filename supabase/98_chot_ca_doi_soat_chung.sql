-- 98: Chốt ca / đối soát chung; một phiếu khách CK rút TM; quản lý tự chốt.
-- Không sửa dữ liệu phiếu cũ, không tự duyệt thay các ca đang chờ.
-- Đã đối chiếu sổ máy chủ: 97. Chạy thử toàn bộ trong giao dịch tự hoàn tác trước khi áp dụng.
alter table public.shift_report_moves add column if not exists exchange_key uuid;
alter table public.shift_reports add column if not exists self_reconciled boolean not null default false;

create or replace function public.app__ca_validate_exchanges(p_moves jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare x record;
begin
  for x in select v->>'exchange_key' k, count(*) n,
    count(*) filter(where v->>'kind'='tien_mat' and (v->>'amount')::bigint <= 0) tm,
    count(*) filter(where v->>'kind'='chuyen_khoan' and (v->>'amount')::bigint >= 0) ck,
    sum((v->>'amount')::bigint) total, count(distinct v->>'note') notes
    from jsonb_array_elements(coalesce(p_moves,'[]')) v where nullif(v->>'exchange_key','') is not null group by 1
  loop
    perform x.k::uuid;
    if x.n <> 2 or x.tm <> 1 or x.ck <> 1 or x.total <> 0 or x.notes <> 1 then
      raise exception 'Phiếu khách CK rút tiền mặt phải có đủ hai vế bằng nhau. Sửa hoặc xoá cả phiếu đổi tiền.';
    end if;
  end loop;
end $$;

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

CREATE OR REPLACE FUNCTION public.app_ca_save(p_id bigint, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'moves', coalesce((select jsonb_agg(jsonb_build_object('kind', m.kind, 'amount', m.amount, 'note', m.note, 'exchange_key', m.exchange_key) order by m.sort_order, m.id)
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
end $function$;

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
    'moves', coalesce((select jsonb_agg(jsonb_build_object('kind', m.kind, 'amount', m.amount, 'note', m.note, 'exchange_key', m.exchange_key) order by m.sort_order, m.id)
                       from public.shift_report_moves m where m.report_id = r.id), '[]'),
    'staff', coalesce((select jsonb_agg(jsonb_build_object('employee_id', s.employee_id, 'source', s.source, 'role', s.role, 'worked', s.worked = 1,
                         'time_in', s.time_in, 'time_out', s.time_out, 'absent_reason', s.absent_reason, 'note', s.note, 'cash_paid', s.cash_paid) order by s.id)
                       from public.shift_report_staff s where s.report_id = r.id), '[]'),
    'goods', coalesce((select jsonb_agg(jsonb_build_object('item', g.item, 'qty', g.qty) order by g.id)
                       from public.shift_report_goods g where g.report_id = r.id), '[]'))
    from public.shift_reports r where r.id = p_id
$function$;

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
  -- dựng lại dữ liệu sạch theo đúng các trường cho phép
  foreach k in array public.app__recon_fields() loop
    if k = any(lk) then new := new || jsonb_build_object(k, old -> k); continue; end if;
    v := case when p ? k then p -> k else old -> k end;
    if k in ('total_revenue','pos_cash','pos_transfer','reported_transfer','cash_counted','opening_cash','cups') then
      if v is not null and jsonb_typeof(v) <> 'null' then
        if jsonb_typeof(v) <> 'number' or (v::text)::numeric <> trunc((v::text)::numeric) then raise exception 'Số liệu % phải là số nguyên.', k; end if;
        if k <> 'opening_cash' and (v::text)::numeric < 0 then raise exception 'Số liệu % không được âm.', k; end if;
      end if;
    elsif k = 'goods_status' then
      if v is not null and jsonb_typeof(v) <> 'null' and (v #>> '{}') not in ('khong', 'du', 'thieu') then raise exception 'Trạng thái nhập hàng không hợp lệ.'; end if;
    elsif k = 'moves' then
      v := coalesce((select jsonb_agg(jsonb_build_object('kind', x ->> 'kind', 'amount', (x ->> 'amount')::bigint, 'note', coalesce(x ->> 'note', ''), 'exchange_key', nullif(x->>'exchange_key','')::uuid))
                       from jsonb_array_elements(coalesce(v, '[]')) x where x ->> 'kind' in ('tien_mat', 'chuyen_khoan') and (x ->> 'amount') is not null), '[]');
    elsif k = 'staff' then
      v := coalesce((select jsonb_agg(jsonb_build_object('employee_id', (x ->> 'employee_id')::bigint, 'source', coalesce(x ->> 'source', 'ho_tro'),
                        'role', x ->> 'role', 'worked', coalesce((x ->> 'worked')::boolean, true), 'time_in', nullif(x ->> 'time_in', ''),
                        'time_out', nullif(x ->> 'time_out', ''), 'absent_reason', nullif(x ->> 'absent_reason', ''), 'note', nullif(x ->> 'note', '')))
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


create or replace function public.app__ca_exchange_guard() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 perform public.app__ca_validate_exchanges(new.data->'moves');
 return new;
end $$;
drop trigger if exists ca_exchange_guard on public.shift_report_recon;
create trigger ca_exchange_guard before insert or update of data on public.shift_report_recon for each row execute function public.app__ca_exchange_guard();

CREATE OR REPLACE FUNCTION public.app__tc_moves_x(p_branch bigint, p_from text, p_to text)
 RETURNS TABLE(report_id bigint, branch_id bigint, work_date text, shift text, ord bigint, pay text, amount bigint, note text, mkey text, created_by bigint, auto text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select x.id, x.branch_id, x.work_date, x.shift, t.ord, t.v ->> 'kind', (t.v ->> 'amount')::bigint, coalesce(t.v ->> 'note', ''),
         md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) || '#'
           || row_number() over (partition by x.id, md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) order by t.ord),
         coalesce(x.completed_by, x.created_by), case when nullif(t.v->>'exchange_key','') is not null then 'doi_tien' else t.v->>'auto' end
    from public.shift_reports x
    cross join lateral jsonb_array_elements(public.app__ca_eff(x.id) -> 'moves') with ordinality t(v, ord)
   where (p_branch is null or x.branch_id = p_branch) and x.work_date between p_from and p_to and x.status = 'hoan_thanh'
     and coalesce((t.v ->> 'amount')::bigint, 0) <> 0
$function$;


create or replace function public.app__ca_exchange_cats(p_id bigint, p_acc bigint) returns void
language plpgsql security definer set search_path=public as $$
declare r public.shift_reports;
begin
 select * into r from public.shift_reports where id=p_id;
 insert into public.fin_move_cats(report_id,mkey,category_id,excluded,by_account,at,checked,checked_by,checked_at)
 select x.report_id,x.mkey,null,1,p_acc,public.vn_now_text(),1,p_acc,public.vn_now_text()
 from public.app__tc_moves_x(r.branch_id,r.work_date,r.work_date) x where x.report_id=p_id and x.auto='doi_tien'
 on conflict(report_id,mkey) do update set category_id=null,excluded=1,checked=1,checked_by=excluded.checked_by,checked_at=excluded.checked_at;
end $$;

CREATE OR REPLACE FUNCTION public.app__ca_kt_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare k jsonb;
begin
  if current_setting('app.ca_self_submit',true) = NEW.report_id::text and coalesce(public.app_can('doi_soat'),false) then return NEW; end if;
  if NEW.item = any(public.app__ca_kt_items()) then
    k := public.app__ca_kt_state(NEW.report_id);
    if k is not null and not (k ->> 'ready')::boolean then
      raise exception 'Phần tiền chờ kế toán: còn thiếu %. Kế toán tải file chốt ca Fabi và nhập chuyển khoản ngân hàng của ca này rồi mới đối soát được.',
        (select string_agg(x, ', ') from jsonb_array_elements_text(k -> 'missing') x);
    end if;
  end if;
  return NEW;
end $function$;

CREATE OR REPLACE FUNCTION public.app__ca_auto_finish(p_id bigint, p_acc bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.shift_reports; n int;
begin
  select * into r from public.shift_reports where id = p_id;
  select count(*) into n from public.shift_report_checks where report_id = p_id and item=any(public.app__ca_check_items());
  if r.recon_status in ('chua', 'mo_lai') and n >= array_length(public.app__ca_check_items(), 1)
     and (select count(*) from public.shift_report_results where report_id = p_id and item=any(public.app__ca_money_items())) >= array_length(public.app__ca_money_items(), 1)
     and (r.self_reconciled or public.app__cv_state(p_id) in ('khong_can', 'da_duyet')) then
    insert into public.shift_report_recon(report_id, data, updated_by) values (p_id, public.app__recon_snapshot(p_id), p_acc)
    on conflict (report_id) do nothing;
    update public.shift_reports set recon_status = 'hoan_thanh', recon_by = p_acc, recon_at = public.vn_now_text() where id = p_id;
    insert into public.shift_recon_log(report_id, action, by_account) values (p_id, 'hoan_thanh_doi_soat', p_acc);
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.app_cv_save(p_id bigint, p_items jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; x bigint;
begin
  a := public.app__need('doi_soat');
  if not public.app__cv_classify_can() then raise exception 'Chỉ Quản lý tổng / Chủ phân loại nghỉ và làm thay.'; end if;
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status not in ('hoan_thanh', 'dang_chot') then raise exception 'Không tìm thấy phiếu.'; end if;   -- bước 46: làm được cả khi đang chốt
  if r.recon_status = 'hoan_thanh' and not r.self_reconciled then raise exception 'Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.'; end if;
  perform public.app__cv_write(p_id, p_items);
  insert into public.shift_cover_reviews(report_id, set_by, set_at) values (p_id, a.id, public.vn_now_text())
  on conflict (report_id) do update set set_by = excluded.set_by, set_at = excluded.set_at, ok_by = null, ok_at = null, ok_note = null;
  perform public.app_log('phan_loai_nghi_lam_thay', 'report=' || p_id);
  if a.system_role <> 'chu' then
    for x in select id from public.accounts where system_role = 'chu' and coalesce(locked, 0) = 0 loop
      perform public.app__notify(x, 'Chờ duyệt nghỉ / làm thay', public.app__ca_title(r) || E'\nQuản lý tổng đã phân loại, Chủ duyệt thì phiếu mới hoàn thành đối soát.',
        '/quan-ly/doi-soat/ca?id=' || p_id);
    end loop;
  end if;
  return public.app__cv_state(p_id);
end $function$;

CREATE OR REPLACE FUNCTION public.app_cv_approve(p_id bigint, p_items jsonb, p_note text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; c public.shift_covers; st text; t text;
begin
  a := public.app__need('doi_soat');
  if a.system_role <> 'chu' then raise exception 'Chỉ Chủ duyệt nghỉ / làm thay.'; end if;
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status not in ('hoan_thanh', 'dang_chot') then raise exception 'Không tìm thấy phiếu.'; end if;   -- bước 46: làm được cả khi đang chốt
  if r.recon_status = 'hoan_thanh' and not r.self_reconciled then raise exception 'Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.'; end if;
  if p_items is not null then perform public.app__cv_write(p_id, p_items); end if;
  st := public.app__cv_state(p_id);
  if st in ('chua_phan_loai', 'lech') then raise exception 'Chưa phân loại đủ người nghỉ / người hỗ trợ của ca.'; end if;
  if st = 'khong_can' then return st; end if;
  insert into public.shift_cover_reviews(report_id, set_by, set_at, ok_by, ok_at, ok_note) values (p_id, a.id, public.vn_now_text(), a.id, public.vn_now_text(), nullif(trim(coalesce(p_note, '')), ''))
  on conflict (report_id) do update set ok_by = excluded.ok_by, ok_at = excluded.ok_at, ok_note = excluded.ok_note,
     set_by = coalesce(public.shift_cover_reviews.set_by, excluded.set_by), set_at = coalesce(public.shift_cover_reviews.set_at, excluded.set_at);
  t := public.app__ca_title(r);
  for c in select * from public.shift_covers where report_id = p_id loop
    if c.absent_id is not null then
      perform public.app__notify_emp(c.absent_id, case when c.fine > 0 then 'Bỏ ca: bị phạt ' || public.app__vnd(c.fine) when c.deduct_hours > 0 then 'Nghỉ ca: bị trừ ' || c.deduct_hours || ' giờ' else 'Nghỉ ca: không bị trừ' end,
        t || E'\nLý do: ' || public.app__cv_label(c.reason)
        || coalesce(E'\nNgười làm thay: ' || (select e.code || ' – ' || e.name from public.employees e where e.id = c.helper_id), E'\nNgười làm thay: ' || c.helper_name, '')
        || case when c.deduct_hours > 0 then E'\nSố giờ người làm thay đã làm được trừ vào lương của bạn.' else '' end
        || E'\nKhông đồng ý thì gửi khiếu nại ở Của tôi › Công của tôi.', '/cua-toi/cong');
    end if;
    if c.helper_id is not null then
      perform public.app__notify_emp(c.helper_id, case when c.x2 then 'Làm thay ca: được x2 lương' else 'Làm thay ca: lương thường' end,
        t || E'\n' || case when c.absent_id is not null then 'Làm thay: ' || (select e.code || ' – ' || e.name from public.employees e where e.id = c.absent_id) else 'Làm thêm (quản lý không xếp đủ lịch)' end
        || E'\nSố giờ: ' || c.hours || case when c.x2 then ' (được cộng thêm ' || c.hours || ' giờ)' else '' end
        || E'\nKhông đồng ý thì gửi khiếu nại ở Của tôi › Công của tôi.', '/cua-toi/cong');
    end if;
  end loop;
  perform public.app_log('duyet_nghi_lam_thay', 'report=' || p_id);
  perform public.app__ca_auto_finish(p_id, a.id);
  return public.app__cv_state(p_id);
end $function$;

CREATE OR REPLACE FUNCTION public.app_cv_get(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; rv public.shift_cover_reviews;
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_id;
  if r.id is null then raise exception 'Không tìm thấy phiếu.'; end if;
  select * into rv from public.shift_cover_reviews where report_id = p_id;
  return jsonb_build_object('state', public.app__cv_state(p_id), 'can_classify', public.app__cv_classify_can(), 'is_owner', a.system_role = 'chu',
    'open', public.app__cv_open(r.work_date), 'recon_status', r.recon_status, 'self_reconciled', r.self_reconciled,
    'people', coalesce((select jsonb_agg(jsonb_build_object('employee_id', p.employee_id, 'kind', p.kind, 'hours', p.hours,
                  'code', e.code, 'name', e.name, 'pay_cash', e.pay_cash) order by p.kind desc, e.code)
                from public.app__cv_people(p_id) p join public.employees e on e.id = p.employee_id), '[]'),
    -- bước 47: người trong lịch có làm ở ca (chọn làm người làm thay / được x2)
    'workers', coalesce((select jsonb_agg(jsonb_build_object('employee_id', e.id, 'code', e.code, 'name', e.name,
                  'hours', public.app__hours(s ->> 'time_in', s ->> 'time_out')) order by e.code)
                from jsonb_array_elements(coalesce(public.app__ca_eff(p_id) -> 'staff', '[]'::jsonb)) s join public.employees e on e.id = (s ->> 'employee_id')::bigint
               where coalesce((s ->> 'worked')::boolean, true) and s ->> 'source' = 'lich'), '[]'),
    'fine', public.app__cv_fine(),
    'rows', coalesce((select jsonb_agg(public.app__cv_json(c) order by c.id) from public.shift_covers c where c.report_id = p_id), '[]'),
    'set_by', public.app__acc_name(rv.set_by), 'set_at', rv.set_at, 'ok_by', public.app__acc_name(rv.ok_by), 'ok_at', rv.ok_at, 'ok_note', rv.ok_note);
end $function$;

CREATE OR REPLACE FUNCTION public.app_cv_todo()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.app__need('doi_soat');
  return coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'branch_id', q.branch_id, 'branch', q.branch, 'date', q.work_date, 'shift', q.shift,
            'state', q.st, 'absent', q.absent, 'helper', q.helper,
            'x2', (select string_agg(coalesce(e.code, c.helper_name), ', ') from public.shift_covers c left join public.employees e on e.id = c.helper_id where c.report_id = q.id and c.x2),
            'set_by', (select public.app__acc_name(v.set_by) from public.shift_cover_reviews v where v.report_id = q.id))
           order by q.work_date, array_position(public.app__shifts(), q.shift), q.sort_order)
      from (select r.id, r.branch_id, coalesce(b.display_code, b.code) branch, b.sort_order, r.work_date, r.shift, pp.absent, pp.helper, public.app__cv_state(r.id) st
              from public.shift_reports r join public.branches b on b.id = r.branch_id
              cross join lateral (select string_agg(e.code || ' – ' || e.name, ', ' order by e.code) filter (where p.kind = 'nghi') absent,
                                         string_agg(e.code || ' – ' || e.name, ', ' order by e.code) filter (where p.kind = 'ho_tro') helper, count(*) n
                                    from public.app__cv_people(r.id) p join public.employees e on e.id = p.employee_id) pp
             where r.status = 'hoan_thanh' and (r.recon_status <> 'hoan_thanh' or r.self_reconciled) and r.work_date >= to_char(public.vn_now()::date - 60, 'YYYY-MM-DD') and pp.n > 0) q
     where q.st in ('chua_phan_loai', 'lech', 'cho_duyet')), '[]');
end $function$;

CREATE OR REPLACE FUNCTION public.app__pc_sources()
 RETURNS TABLE(job integer, key text, branch_id bigint, title text, link text, start_at text, step integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with st as (select coalesce((select value from public.settings where key = 'pc_start'), '2099-01-01') d,
                   to_char(public.vn_now(), 'YYYY-MM-DD') today)
-- 1 Đối soát ca: phiếu đã gửi + kế toán đủ file; xong phần quản lý (chỉ còn chờ duyệt nghỉ / làm thay) cũng tính là xong
select 1, 'ca:' || r.id, r.branch_id, 'Đối soát ' || public.app__ca_title(r), '/quan-ly/doi-soat/ca?id=' || r.id, null::text, 0
  from public.shift_reports r cross join st
 where r.work_date >= st.d and r.status = 'hoan_thanh' and r.recon_status <> 'hoan_thanh'
   and coalesce((public.app__ca_kt_state(r.id)->>'ready')::boolean, false)
   and not ((select count(*) from public.shift_report_checks c where c.report_id = r.id) >= array_length(public.app__ca_check_items(), 1) - 1
            and exists(select 1 from public.shift_cover_reviews v where v.report_id = r.id and v.ok_at is null))
union all
-- 2 Phân chia nhân viên phát sinh: bước 0 phân loại, bước 1 duyệt
select 2, 'cv:' || r.id, r.branch_id, 'Nghỉ / làm thay · ' || public.app__ca_title(r), '/quan-ly/doi-soat/ca?id=' || r.id,
       coalesce(r.completed_at, public.vn_now_text()), case when v.set_at is null then 0 else 1 end
  from public.shift_reports r cross join st left join public.shift_cover_reviews v on v.report_id = r.id
 where r.work_date >= st.d and r.status = 'hoan_thanh' and v.ok_at is null
   and exists(select 1 from public.app__cv_people(r.id))
union all
-- 3 File ca Fabi · 4 Chuyển khoản: gộp mỗi ngày mỗi cơ sở (chỉ cơ sở dùng Fabi)
select x.j, 'kt' || x.j || ':' || x.branch_id || ':' || x.work_date, x.branch_id,
       case x.j when 3 then 'File ca Fabi' else 'Chuyển khoản thực nhận' end || ' · ngày ' || to_char(x.work_date::date, 'DD/MM'),
       case x.j when 3 then '/ke-toan/fabi' else '/ke-toan/chuyen-khoan' end,
       to_char(x.work_date::date + 1, 'YYYY-MM-DD') || ' 00:00:00', 0
  from (select r.branch_id, r.work_date, j.j
          from public.shift_reports r cross join st cross join (values (3), (4)) j(j)
         where r.work_date >= st.d and r.status = 'hoan_thanh' and exists(select 1 from public.fabi_stores f where f.branch_id = r.branch_id)
           and not coalesce((public.app__ca_kt_state(r.id)->>(case j.j when 3 then 'fabi' else 'bank' end))::boolean, false)
         group by 1, 2, 3) x
union all
-- 7 Lệch tiền ca chờ xử lý (chờ ghép / dư); lệch chờ tiền về chưa tính
select 7, 'gap:' || g.report_id || ':' || g.item, b.id, 'Lệch ' || g.item || ' · ' || public.app__ca_title(r) || ' · ' || public.app__vnd(abs(g.remain)),
       '/quan-ly/lech-tien', coalesce(r.completed_at, public.vn_now_text()), 0
  from public.branches b cross join st
  cross join lateral public.app__gap_rows(b.id, st.d, st.today) g
  join public.shift_reports r on r.id = g.report_id
 where b.status = 'Đang hoạt động' and g.state in ('cho_gan', 'du') and g.work_date >= st.d
union all
-- 8 Giải trình khoản trừ chưa được xem
select 8, 'gt:' || s.id, r.branch_id, 'Giải trình · ' || coalesce(e.code || ' – ', '') || e.name || ' · ' || public.app__vnd(s.amount),
       '/quan-ly/khoan-am', s.reply_at, 0
  from public.shift_shortfalls s join public.shift_reports r on r.id = s.report_id join public.employees e on e.id = s.employee_id cross join st
 where s.reply_at is not null and s.reply_at >= st.d and s.status <> 'huy' and (s.status_at is null or s.status_at < s.reply_at)
union all
-- 10 Kiểm quỹ hằng tuần (mỗi tuần mỗi cơ sở, từ Thứ Hai)
select 10, 'kq:' || b.id || ':' || w.mon, b.id,
       'Kiểm quỹ tuần ' || to_char(w.mon::date, 'DD/MM') || ' – ' || to_char(w.mon::date + 6, 'DD/MM'), '/quan-ly/so-quy', w.mon || ' 00:00:00', 0
  from public.branches b cross join st
  cross join lateral (select to_char(g, 'YYYY-MM-DD') mon from generate_series(date_trunc('week', st.d::date), date_trunc('week', st.today::date), interval '7 day') g) w
 where b.status = 'Đang hoạt động' and w.mon >= st.d
   and not exists(select 1 from public.fund_counts f where f.branch_id = b.id and f.count_date between w.mon and to_char(w.mon::date + 6, 'YYYY-MM-DD'))
union all
-- 11 Phiếu xuất quá ngày giao mà chưa nhận
select 11, 'nh:' || i.id, i.branch_id, coalesce(i.doc_no, 'Lần giao #' || i.id) || ' · giao ngày ' || to_char(i.work_date::date, 'DD/MM'),
       '/hang-hoa/nhan?cn=' || i.branch_id, to_char(i.work_date::date + 1, 'YYYY-MM-DD') || ' 00:00:00', 0
  from public.delivery_invoices i cross join st
 where i.state = 'dang_chuyen' and i.work_date < st.today and i.work_date >= st.d
union all
-- 12 Đối soát hàng (đã nhận, có hoá đơn giao / hoá đơn bù, có phiếu xuất)
select 12, 'ds:' || i.id, i.branch_id, coalesce(i.doc_no, 'Lần giao #' || i.id) || ' · nhận ' || to_char(coalesce(i.received_at, i.work_date)::timestamp, 'DD/MM HH24:MI'),
       '/hang-hoa/doi-soat?ds=' || i.id, coalesce(i.received_at, i.work_date || ' 00:00:00'), 0
  from public.delivery_invoices i cross join st
 where i.state <> 'dang_chuyen' and i.recon_at is null and i.doc_no is not null and (i.deliv_path is not null or i.bu_path is not null)
   and coalesce(i.received_date, i.work_date) >= st.d
union all
-- 13 Hoá đơn bù & ghép phiếu xuất (kế toán, gộp chung)
select 13, 'hd:' || i.id, null::bigint,
       case when i.doc_no is null then 'Ghép phiếu xuất · ' || public.app__pc_bcode(i.branch_id) || ' · lần nhận #' || i.id
            else 'Hoá đơn bù · ' || public.app__pc_bcode(i.branch_id) || ' · ' || i.doc_no end,
       case when i.doc_no is null then '/hang-hoa/phieu-xuat' else '/hang-hoa/kiem-soat?cn=' || i.branch_id end,
       coalesce(i.received_at, i.work_date || ' 00:00:00'), 0
  from public.delivery_invoices i cross join st
 where i.state <> 'dang_chuyen' and coalesce(i.received_date, i.work_date) >= st.d
   and (i.doc_no is null or (i.deliv_path is null and i.bu_path is null))
union all
-- 14 Giao bù & hoá đơn bổ sung (kế toán, gộp chung)
select 14, 'fu:' || f.id, null::bigint,
       case f.kind when 'bu' then 'Giao bù · ' else 'Hoá đơn bổ sung · ' end || public.app__pc_bcode(f.branch_id) || ' · ' || f.name,
       '/hang-hoa/kiem-soat?cn=' || f.branch_id, f.created_at, 0
  from public.delivery_followups f cross join st
 where f.status = 'cho' and f.created_at >= st.d
$function$;


CREATE OR REPLACE FUNCTION public.app_tc_check(p_report bigint, p_mkey text, p_category bigint, p_excluded boolean, p_checked boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; m record; ex boolean := coalesce(p_excluded, false); ok boolean := coalesce(p_checked, false);
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__tc_need(r.branch_id);
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không sửa được.'; end if;
  select * into m from public.app__tc_moves(r.branch_id, r.work_date, r.work_date) x where x.report_id = p_report and x.mkey = p_mkey;
  if m.report_id is null then raise exception 'Dòng thu chi này đã thay đổi trên phiếu ca. Tải lại trang.'; end if;
  if exists(select 1 from public.app__tc_moves_x(r.branch_id,r.work_date,r.work_date) t where t.report_id=p_report and t.mkey=p_mkey and t.auto='doi_tien') and (not ex or not ok or p_category is not null) then raise exception 'Khách CK rút tiền mặt luôn Không tính thu chi; sửa cả phiếu ở Chốt ca / Đối soát.'; end if;
  if public.app__tc_move_ka(p_report, p_mkey) then
    raise exception 'Khoản này đã gán âm tiền TRỪ LƯƠNG — bấm "Bỏ gán" ở dòng Âm tiền trước khi sửa / đổi nhóm.';
  end if;
  if exists (select 1 from public.branch_loans l where l.report_id = p_report and l.mkey = p_mkey) then
    raise exception 'Khoản "%" đã đổi thành cho vay — xem ở khung Cho vay (xoá khoản vay đó thì khoản trở lại Thu chi).', m.note;
  end if;
  if ok and not ex and p_category is null then raise exception 'Chọn nhóm (hoặc "Không tính") rồi mới đối soát.'; end if;
  if not ex and p_category is not null and not exists (select 1 from public.fin_categories c where c.id = p_category and c.kind = case when m.amount < 0 then 'chi' else 'thu' end) then
    raise exception 'Nhóm không đúng loại Thu / Chi.';
  end if;
  insert into public.fin_move_cats(report_id, mkey, category_id, excluded, by_account, at, checked, checked_by, checked_at)
  values (p_report, p_mkey, case when ex then null else p_category end, case when ex then 1 else 0 end, a.id, public.vn_now_text(),
          case when ok then 1 else 0 end, case when ok then a.id end, case when ok then public.vn_now_text() end)
  on conflict (report_id, mkey) do update set category_id = excluded.category_id, excluded = excluded.excluded, by_account = excluded.by_account, at = excluded.at,
          checked = excluded.checked, checked_by = excluded.checked_by, checked_at = excluded.checked_at;
  perform public.app_log(case when ok then 'thu_chi_doi_soat' else 'thu_chi_bo_doi_soat' end, 'report=' || p_report || ' ' || m.amount || ' ' || m.note);
end $function$;

-- Gửi cả phiếu trong một giao dịch: không để Tiền đã khoá nhưng Nhân sự chưa gửi.
CREATE OR REPLACE FUNCTION public.app_ca_result_set(p_id bigint, p_item text, p_result text, p_amount bigint, p_reason text, p_people jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; m jsonb; amt bigint; why text := nullif(trim(coalesce(p_reason, '')), '');
        x jsonb; tot bigint := 0; emps bigint[] := '{}'; e bigint; ea bigint; comp bigint; basis text;
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Nhân viên chưa hoàn thành phiếu này.'; end if;
  if r.recon_status = 'hoan_thanh' then raise exception 'Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.'; end if;
  if public.app__fin_locked(r.branch_id,r.work_date) then raise exception 'Tháng đã chốt — không sửa được.'; end if;
  if exists(select 1 from jsonb_array_elements(public.app__ca_eff(p_id)->'moves') v where nullif(v->>'exchange_key','') is not null and (coalesce((v->>'amount')::bigint,0)=0 or trim(coalesce(v->>'note',''))='')) then raise exception 'Điền đủ số tiền và nội dung phiếu đổi tiền trước khi duyệt.'; end if;
  if not (p_item = any(public.app__ca_money_items())) then raise exception 'Hạng mục không hợp lệ.'; end if;
  if p_result not in ('khop', 'thieu', 'thua') then raise exception 'Chọn KHỚP, THIẾU hoặc THỪA.'; end if;
  amt := case when p_result = 'khop' then 0 else coalesce(p_amount, 0) end;
  if p_result <> 'khop' and amt <= 0 then raise exception 'Nhập số tiền % (lớn hơn 0).', case when p_result = 'thieu' then 'thiếu' else 'thừa' end; end if;
  if p_result <> 'khop' and why is null then raise exception 'Ghi lý do % tiền.', case when p_result = 'thieu' then 'thiếu' else 'thừa' end; end if;
  if exists (select 1 from public.shift_shortfalls where report_id = p_id and item = p_item and status in ('da_bu', 'tru_luong', 'mien') and not (status = 'tru_luong' and auto_tru)) then
    raise exception 'Khoản âm của hạng mục này đã được xử lý (đã bù / trừ lương / miễn) nên không đổi được kết quả.';
  end if;
  -- bước 71: tiền mặt / chuyển khoản THIẾU được để tab Âm tiền xử lý (không chọn người) — CK = Chờ tiền về, TM = Chờ gán
  if p_result = 'thieu' and p_item in ('tien_mat', 'chuyen_khoan') and jsonb_array_length(coalesce(p_people, '[]')) = 0 then
    p_people := '[]'; emps := '{}';
  elsif p_result = 'thieu' and not exists (select 1 from public.shift_report_checks c where c.report_id = p_id and c.item = 'nhan_su') then
    raise exception 'Đối soát bước Nhân sự trước (biết đủ người làm ca) rồi mới chọn THIẾU để chia tiền âm.';
  end if;
  if p_result = 'thieu' and not (p_item in ('tien_mat', 'chuyen_khoan') and jsonb_array_length(coalesce(p_people, '[]')) = 0) then
    if jsonb_typeof(coalesce(p_people, '[]')) <> 'array' or jsonb_array_length(coalesce(p_people, '[]')) = 0 then
      raise exception 'Chọn nhân viên chịu khoản thiếu.';
    end if;
    for x in select * from jsonb_array_elements(p_people) loop
      e := (x ->> 'employee_id')::bigint; ea := coalesce((x ->> 'amount')::bigint, 0);
      if not exists (select 1 from public.employees where id = e) then raise exception 'Nhân viên không hợp lệ.'; end if;
      if e = any(emps) then raise exception 'Mỗi nhân viên chỉ chọn một lần.'; end if;
      if ea <= 0 then raise exception 'Số tiền của từng nhân viên phải lớn hơn 0.'; end if;
      emps := emps || e; tot := tot + ea;
    end loop;
    if tot <> amt then raise exception 'Tổng tiền chia cho nhân viên (%) phải bằng số tiền thiếu (%).', public.app__vnd(tot), public.app__vnd(amt); end if;
  end if;
  m := public.app__ca_money(p_id);
  comp := case p_item when 'tien_mat' then (m ->> 'tm_left')::bigint when 'chuyen_khoan' then (m ->> 'ck_left')::bigint end;
  basis := case when p_item = 'chuyen_khoan' then m ->> 'ck_basis' end;
  -- khoản âm: thay danh sách chưa xử lý bằng danh sách mới
  perform public.app__ca_drop_shortfalls(p_id, p_item, emps, 'Quản lý đã đổi kết quả đối soát.');
  if p_result = 'thieu' then
    for x in select * from jsonb_array_elements(p_people) loop
      insert into public.shift_shortfalls(report_id, item, employee_id, amount, reason, created_by, status, auto_tru, status_note, status_by, status_at)
      values (p_id, p_item, (x ->> 'employee_id')::bigint, (x ->> 'amount')::bigint, why, a.id,
              'tru_luong', true, 'Mặc định trừ lương khi đối soát', a.id, public.vn_now_text());
      perform public.app__notify_emp((x ->> 'employee_id')::bigint, 'Bạn có khoản âm — mặc định trừ lương',
        public.app__ca_title(r) || ' · ' || public.app__ca_item_label(p_item) || ': bạn chịu ' || public.app__vnd((x ->> 'amount')::bigint)
        || E'\nLý do: ' || why || E'\nNgười đối soát: ' || public.app__acc_name(a.id)
        || E'\nMặc định: TRỪ LƯƠNG. Không đồng ý thì gửi giải trình ở mục Khoản âm của tôi.', '/cua-toi/khoan-am');
    end loop;
  end if;
  insert into public.shift_report_results(report_id, item, result, amount, computed, basis, reason, by_account, at)
  values (p_id, p_item, p_result, amt, comp, basis, why, a.id, public.vn_now_text())
  on conflict (report_id, item) do update set result = excluded.result, amount = excluded.amount, computed = excluded.computed, basis = excluded.basis,
         reason = excluded.reason, by_account = excluded.by_account, at = excluded.at;
  insert into public.shift_report_checks(report_id, item, checked_by, checked_at) values (p_id, p_item, a.id, public.vn_now_text())
  on conflict (report_id, item) do update set checked_by = excluded.checked_by, checked_at = excluded.checked_at;
  insert into public.shift_recon_log(report_id, action, field, after, reason, by_account)
  values (p_id, 'ket_qua', p_item, jsonb_build_object('result', p_result, 'amount', amt, 'people', coalesce(p_people, '[]')), why, a.id);
  perform public.app__ca_auto_finish(p_id, a.id);
  perform public.app_log('doi_soat_ket_qua', 'report=' || p_id || ' ' || p_item || '=' || p_result || ' ' || amt);
end $function$;

create or replace function public.app_ca_submit_unified(p_id bigint, p_categories jsonb default '[]', p_gaps jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.accounts; r public.shift_reports; x record; q jsonb; c jsonb; m jsonb;
 it text; comp bigint; used bigint[] := '{}'; cat_row record; self_close boolean; cat_id bigint; is_excluded boolean; choice text; people jsonb; employee_row record; n_people int; allocation bigint; remaining bigint;
begin
 a := public.app__need('chot_ca');
 select * into r from public.shift_reports where id=p_id for update;
 if r.id is null or r.status <> 'dang_chot' then raise exception 'Phiếu đã gửi hoặc không tồn tại. Tải lại trang.'; end if;
 if public.app__fin_locked(r.branch_id,r.work_date) then raise exception 'Tháng đã chốt — không sửa được.'; end if;
 if exists(select 1 from unnest(array['tien','nhan_su']) k where not exists(select 1 from public.shift_report_parts p where p.report_id=p_id and p.part=k and p.claimed_by=a.id)) then
   raise exception 'Chỉ người nhận cả phần tiền và nhân sự được gửi phiếu này.';
 end if;
 if exists(select 1 from public.shift_report_moves where report_id=p_id and (amount=0 or trim(note)='')) then raise exception 'Mỗi khoản phải có nội dung và số tiền khác 0.'; end if;
 self_close := coalesce(public.app_can('doi_soat'),false);
 perform public.app_ca_part_done(p_id,'tien',true);
 perform public.app_ca_part_done(p_id,'nhan_su',true);
 select * into r from public.shift_reports where id=p_id;
 if r.status <> 'hoan_thanh' then raise exception 'Còn phần nhận hàng của phiếu cũ chưa hoàn thành.'; end if;
 perform public.app__ca_exchange_cats(p_id,a.id);
 if self_close then
   -- Ghi nhóm theo đúng khoản đã lưu; không nhận số tiền do trình duyệt tự tính.
   for x in select * from public.app__tc_moves_x(r.branch_id,r.work_date,r.work_date) where report_id=p_id and auto is null order by ord loop
     c := null;
     for cat_row in select v, ord from jsonb_array_elements(coalesce(p_categories,'[]')) with ordinality as t(v,ord) where not ord=any(used) order by ord loop
       q:=cat_row.v;
       if q->>'kind'=x.pay and (q->>'amount')::bigint=x.amount and coalesce(q->>'note','')=x.note then c:=q; used:=array_append(used,cat_row.ord); exit; end if;
     end loop;
     if nullif(c->>'category','') is null then raise exception 'Chọn nhóm cho khoản: %',x.note; end if;
     is_excluded := c->>'category'='x'; cat_id := case when is_excluded then null else (c->>'category')::bigint end;
     perform public.app_tc_check(p_id,x.mkey,cat_id,is_excluded,true);
   end loop;
   update public.shift_reports set self_reconciled=true where id=p_id;
   perform set_config('app.ca_self_submit',p_id::text,true);
   -- Các khoản lệch vẫn ghi đúng THIẾU/THỪA và theo dõi ở Lệch tiền ca; không tự trừ lương.
   insert into public.shift_report_checks(report_id,item,checked_by,checked_at)
   select p_id,k,a.id,public.vn_now_text() from unnest(public.app__ca_check_items()) k
   where not (k=any(public.app__ca_money_items())) on conflict(report_id,item) do nothing;
   m := public.app__ca_money(p_id);
   foreach it in array public.app__ca_money_items() loop
     comp := case it when 'tien_mat' then (m->>'tm_left')::bigint when 'chuyen_khoan' then (m->>'ck_left')::bigint else 0 end;
     if comp is null then raise exception 'Chưa đủ số liệu %.',it; end if;
     if exists(select 1 from public.shift_report_checks c join public.shift_report_results v on v.report_id=c.report_id and v.item=c.item where c.report_id=p_id and c.item=it) then continue; end if;
     -- Ca có file về trước có thể đã tự đối soát một số mục.
     if (select recon_status from public.shift_reports where id=p_id)='hoan_thanh' then exit; end if;
     choice := coalesce(p_gaps->it->>'action','sau'); people:='[]';
     if choice not in ('sau','qc','chia') then raise exception 'Cách xử lý lệch không hợp lệ.'; end if;
     if choice <> 'sau' and (p_gaps->it->>'expected')::bigint is distinct from comp then raise exception 'Số lệch đã thay đổi. Kiểm tra lại trước khi gửi.'; end if;
     if choice='chia' then
       if comp>=0 then raise exception 'Chỉ chia khoản thiếu cho người làm ca.'; end if;
       select count(*) into n_people from public.shift_report_staff where report_id=p_id and worked=1;
       if n_people=0 or abs(comp)<n_people then raise exception 'Chưa có đủ người làm ca để chia khoản thiếu.'; end if;
       remaining:=abs(comp); allocation:=abs(comp)/n_people;
       for employee_row in select employee_id from public.shift_report_staff where report_id=p_id and worked=1 order by employee_id loop
         people:=people||jsonb_build_array(jsonb_build_object('employee_id',employee_row.employee_id,'amount',case when n_people=1 then remaining else allocation end));
         remaining:=remaining-allocation; n_people:=n_people-1;
       end loop;
     end if;
     perform public.app_ca_result_set(p_id,it,case when comp<0 then 'thieu' when comp>0 then 'thua' else 'khop' end,abs(comp),
       case when choice='chia' then 'Quản lý tự chốt — chia đều người làm ca' else 'Quản lý tự chốt ca; lệch còn lại theo dõi tại Lệch tiền ca' end, people);
     if choice='qc' and comp<>0 then
       perform public.app_gap_decide(p_id,it,case when comp<0 then 'quan_chiu' else 'thu_khac' end,abs(comp),'Quản lý tự chốt — chọn xử lý lệch');
     end if;
   end loop;
   perform public.app__ca_auto_finish(p_id,a.id);
   perform set_config('app.ca_self_submit','',true);
   insert into public.shift_recon_log(report_id,action,reason,by_account) values(p_id,'ql_tu_lam','Quản lý tự chốt; nghỉ/làm thay theo dõi riêng trong Công việc',a.id);
 end if;
 -- Bộ nhắc hiện có sẽ lấy cả hồ sơ chưa phân loại (không phụ thuộc đã có shift_covers).
 perform public.app__pc_tick();
 return jsonb_build_object('completed',true,'self_reconciled',self_close);
end $$;
revoke all on function public.app_ca_submit_unified(bigint,jsonb,jsonb) from public,anon;
grant execute on function public.app_ca_submit_unified(bigint,jsonb,jsonb) to authenticated;

-- Quản lý được sửa / bỏ mọi khoản khách trả nợ trong bản đối soát, kể cả khoản
-- nhân viên đã ghi lúc chốt ca. Bỏ thu sẽ đưa khách về danh sách còn nợ; khoản
-- trả một phần được gộp lại trước khi ghi số mới.
create or replace function public.app_ca_recon_debt_uncollect(p_report bigint, p_debt bigint, p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare r public.shift_reports; d public.shift_debts; rest public.shift_debts; why text:=trim(coalesce(p_reason,''));
begin
  perform public.app__need('doi_soat');
  select * into r from public.shift_reports where id=p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  if coalesce(r.recon_status,'')='hoan_thanh' then raise exception 'Ca đã hoàn thành đối soát — mở lại để sửa.'; end if;
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
end $$;

create or replace function public.app_ca_recon_debt_update(p_report bigint,p_debt bigint,p_kind text,p_amount bigint,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare d public.shift_debts; why text:=trim(coalesce(p_reason,''));
begin
  if why='' then raise exception 'Ghi lý do sửa khoản khách trả.'; end if;
  perform public.app_ca_recon_debt_uncollect(p_report,p_debt,why);
  select * into d from public.shift_debts where id=p_debt;
  perform public.app_ca_recon_debt_collect(p_report,p_debt,p_kind,p_amount,why);
  perform public.app_log('doi_soat_sua_thu_no','report='||p_report||' debt='||p_debt||' '||coalesce(p_kind,'')||' '||coalesce(p_amount,0)||' · '||why);
end $$;

revoke all on function public.app_ca_recon_debt_uncollect(bigint,bigint,text),public.app_ca_recon_debt_update(bigint,bigint,text,bigint,text) from public,anon;
grant execute on function public.app_ca_recon_debt_uncollect(bigint,bigint,text),public.app_ca_recon_debt_update(bigint,bigint,text,bigint,text) to authenticated;
revoke all on function public.app__ca_validate_exchanges(jsonb),public.app__ca_exchange_guard(),public.app__ca_exchange_cats(bigint,bigint) from public,anon,authenticated;
insert into public.app_migrations(file) values ('98_chot_ca_doi_soat_chung.sql') on conflict(file) do nothing;
