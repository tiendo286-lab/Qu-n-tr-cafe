-- Bước 120 (17/11/2026): ghi chú khi Chủ / quản lý thêm · sửa · xoá khoản Thu / Chi trên Phiếu chốt ca
-- Thiết kế: tai_lieu/superpowers/specs/2026-11-17-ghi-chu-sua-thu-chi-design.md · Kiểm tra: kiem_tra/audit_tien/t07_ghi_chu_thu_chi.sql
-- Chạy lại nhiều lần không sao.

-- Danh sách dòng thu chi để so: bỏ dòng tự sinh (lương, khách mượn), cặp "Khách CK rút tiền mặt" (cùng exchange_key) gộp 1 dòng.
create or replace function public.app__ca_move_lines(p jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(x.line order by x.ord), '[]'::jsonb) from (
    select ord, jsonb_build_object('kind', kind, 'amount', amount, 'note', note) line
      from (select m ->> 'kind' kind, (m ->> 'amount')::bigint amount, coalesce(m ->> 'note', '') note, nullif(m ->> 'exchange_key', '') ek, t.ord
              from jsonb_array_elements(coalesce(p, '[]'::jsonb)) with ordinality t(m, ord) where m ->> 'auto' is null) z
     where ek is null
    union all
    select min(ord), jsonb_build_object('kind', 'doi_tien', 'amount', max(abs(amount)), 'note', min(note))
      from (select (m ->> 'amount')::bigint amount, coalesce(m ->> 'note', '') note, nullif(m ->> 'exchange_key', '') ek, t.ord
              from jsonb_array_elements(coalesce(p, '[]'::jsonb)) with ordinality t(m, ord) where m ->> 'auto' is null) z
     where ek is not null group by ek
  ) x
$$;

-- Số dòng giống hệt `line` trong 1 danh sách thu chi (để biết lần sửa nào thêm / bớt, kể cả khi có 2 dòng giống nhau)
create or replace function public.app__ca_line_count(p jsonb, line jsonb) returns int
language sql immutable set search_path = public as $$
  select count(*)::int from jsonb_array_elements(public.app__ca_move_lines(p)) e where e = line
$$;

-- So thu chi nhân viên gửi với hiện tại → mỗi dòng: giu / sua / them / doi (đổi từ Khách mượn) / xoa, kèm ai · lúc nào · lý do (shift_recon_log).
create or replace function public.app__ca_move_notes(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o jsonb[]; c jsonb[]; ou boolean[]; ct text[]; cb jsonb[]; i int; j int; nc int; no int; out jsonb := '[]'; lid bigint; lby bigint; lat text; lrs text; mb jsonb; tp text; bf jsonb;
begin
  if not exists (select 1 from public.shift_report_recon where report_id = p_id) then return '[]'::jsonb; end if;
  o := array(select e from jsonb_array_elements(public.app__ca_move_lines(public.app__recon_snapshot(p_id) -> 'moves')) e);
  c := array(select e from jsonb_array_elements(public.app__ca_move_lines(public.app__ca_eff(p_id) -> 'moves')) e);
  no := coalesce(array_length(o, 1), 0); nc := coalesce(array_length(c, 1), 0);
  ou := array_fill(false, array[greatest(no, 1)]); ct := array_fill(null::text, array[greatest(nc, 1)]); cb := array_fill(null::jsonb, array[greatest(nc, 1)]);
  -- 1) giống hệt → giữ
  for i in 1..nc loop
    for j in 1..no loop
      if not ou[j] and o[j] = c[i] then ct[i] := 'giu'; ou[j] := true; exit; end if;
    end loop;
  end loop;
  -- 2) ghép sửa: cùng loại + nội dung → cùng loại + số tiền → cùng nội dung + số tiền
  for i in 1..nc loop
    if ct[i] is not null then continue; end if;
    for j in 1..no loop
      if not ou[j] and o[j] ->> 'kind' = c[i] ->> 'kind' and o[j] ->> 'note' = c[i] ->> 'note' then ct[i] := 'sua'; cb[i] := o[j]; ou[j] := true; exit; end if;
    end loop;
    if ct[i] is not null then continue; end if;
    for j in 1..no loop
      if not ou[j] and o[j] ->> 'kind' = c[i] ->> 'kind' and o[j] ->> 'amount' = c[i] ->> 'amount' then ct[i] := 'sua'; cb[i] := o[j]; ou[j] := true; exit; end if;
    end loop;
    if ct[i] is not null then continue; end if;
    for j in 1..no loop
      if not ou[j] and o[j] ->> 'note' = c[i] ->> 'note' and o[j] ->> 'amount' = c[i] ->> 'amount' then ct[i] := 'sua'; cb[i] := o[j]; ou[j] := true; exit; end if;
    end loop;
  end loop;
  -- 3) dòng hiện tại
  for i in 1..nc loop
    tp := coalesce(ct[i], 'them'); bf := cb[i]; lid := null; lby := null; lat := null; lrs := null;
    if tp <> 'giu' then
      select x.id, x.by_account, x.at, x.reason into lid, lby, lat, lrs from public.shift_recon_log x
       where x.report_id = p_id and x.field = 'moves'
         and public.app__ca_line_count(x.after, c[i]) > public.app__ca_line_count(x.before, c[i])   -- lần sửa làm có thêm dòng này
       order by x.id desc limit 1;
      if tp = 'them' and c[i] ->> 'kind' = 'doi_tien' and lid is not null then
        mb := null;
        select x.before into mb from public.shift_recon_log x
         where x.report_id = p_id and x.action = 'bao_no_xoa' and x.at = lat and x.before ->> 'kind' = 'muon' and (x.before ->> 'amount')::bigint = (c[i] ->> 'amount')::bigint
         order by x.id desc limit 1;
        if mb is not null then tp := 'doi'; bf := jsonb_build_object('kind', 'muon', 'amount', (mb ->> 'amount')::bigint, 'table_name', mb ->> 'table_name'); end if;
      end if;
    end if;
    out := out || jsonb_build_array(c[i] || jsonb_build_object('type', tp, 'before', bf,
      'by', case when lid is not null then public.app__acc_name(lby) end, 'at', lat, 'reason', lrs));
  end loop;
  -- 4) dòng đã xoá
  for j in 1..no loop
    if ou[j] then continue; end if;
    lid := null; lby := null; lat := null; lrs := null;
    select x.id, x.by_account, x.at, x.reason into lid, lby, lat, lrs from public.shift_recon_log x
     where x.report_id = p_id and x.field = 'moves'
       and public.app__ca_line_count(x.before, o[j]) > public.app__ca_line_count(x.after, o[j])   -- lần sửa làm bớt dòng này
     order by x.id desc limit 1;
    out := out || jsonb_build_array(o[j] || jsonb_build_object('type', 'xoa', 'before', null,
      'by', case when lid is not null then public.app__acc_name(lby) end, 'at', lat, 'reason', lrs));
  end loop;
  return out;
end $$;

revoke all on function public.app__ca_move_lines(jsonb), public.app__ca_line_count(jsonb, jsonb), public.app__ca_move_notes(bigint) from public, anon, authenticated;

-- app_ca_get trả thêm move_notes cho phiếu đã gửi (bản đang chạy + 1 khoá)
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
    'can_recon', ds and r.status = 'hoan_thanh',
    'can_reopen', public.app_can('mo_lai_phieu_ca') and r.status = 'hoan_thanh');
  if hide_own then out := out || jsonb_build_object('cash_counted', null, 'cash_hidden', true); end if;
  return out;
end $function$;

insert into public.app_migrations(file) values ('102_ghi_chu_sua_thu_chi.sql') on conflict (file) do nothing;
