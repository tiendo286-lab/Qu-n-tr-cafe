-- Bước 74 (anh Tiến chốt 13/11):
--  1. Phiếu chốt ca: giờ Đến / Về gợi ý theo LỊCH TUẦN của từng người (ca đã xếp — vd FULL TIME — giờ theo cài đặt ca của cơ sở);
--     người làm hộ không có lịch ca này thì để trống (giao diện).
--  2. Đối soát ca: "Ghi nhận nợ" — khách nợ nhưng nhân viên bấm nhầm thanh toán chuyển khoản / tiền mặt trên Fabi:
--     số tiền ca KHÔNG đổi; khoản nợ vào Công nợ + nhắc ở các ca sau; tab Âm tiền ghi ca "Chờ khách trả nợ";
--     ca sau khách trả ("Khách trả nợ cũ" như thường) → tự bù phần thiếu của ca gốc. Còn chờ khách trả → chưa chốt tháng.
-- Chạy lại nhiều lần không sao.

alter table public.shift_debts add column if not exists gap_report bigint references public.shift_reports(id) on delete set null;
alter table public.shift_debts add column if not exists gap_item text;
create index if not exists shift_debts_gap on public.shift_debts(gap_report) where gap_report is not null;

-- Ca theo lịch tuần của 1 nhân viên trong phiếu: đúng ca, hoặc ca không nối két (FULL TIME…) chồng giờ; giờ theo cài đặt ca của cơ sở
create or replace function public.app__ca_sched(p_report bigint, p_emp bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('shift', e.shift, 'start', bs.start_time, 'end', bs.end_time)
    from public.shift_reports r
    join public.weeks w on w.start_date <= r.work_date and w.end_date >= r.work_date
    join public.weekly_schedule_entries e on e.week_id = w.id and e.weekday = (r.work_date::date - w.start_date::date) and e.branch_id = r.branch_id
         and e.employee_id = p_emp and e.state = 'ĐÃ XẾP'
         and (e.shift = r.shift or (not public.app__ca_chain(e.shift) and public.app__shift_overlap(r.branch_id, e.shift, r.branch_id, r.shift)))
    left join public.shifts s on s.name = e.shift
    left join public.branch_shifts bs on bs.branch_id = r.branch_id and bs.shift_id = s.id
   where r.id = p_report
   order by (e.shift = r.shift) desc
   limit 1
$$;

-- Ghi nhận nợ ở Đối soát ca (khách nợ, nhân viên bấm nhầm thanh toán CK / TM)
create or replace function public.app_ca_recon_debt(p_report bigint, p_item text, p_name text, p_phone text, p_amount bigint, p_note text) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports; nid bigint; nm text := trim(coalesce(p_name, ''));
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  if r.status <> 'hoan_thanh' then raise exception 'Nhân viên chưa hoàn thành phiếu này.'; end if;
  if public.app__gap_role(r.branch_id) is null and not coalesce(public.app_can('doi_soat'), false) then raise exception 'Chỉ quản lý được ghi nhận nợ.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng đã CHỐT.'; end if;
  if p_item not in ('tien_mat', 'chuyen_khoan') then raise exception 'Chọn nhân viên đã bấm thanh toán chuyển khoản hay tiền mặt.'; end if;
  if nm = '' then raise exception 'Ghi tên / bàn khách nợ.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nhập số tiền nợ lớn hơn 0.'; end if;
  insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, gap_report, gap_item)
  values (r.branch_id, null, nm, p_amount,
          trim(coalesce(p_note, '')) || case when trim(coalesce(p_note, '')) <> '' then ' · ' else '' end || 'ghi nhận ở đối soát ca ' || r.shift || ' ' || to_char(r.work_date::date, 'DD/MM')
          || ' (NV bấm nhầm ' || case when p_item = 'chuyen_khoan' then 'chuyển khoản' else 'tiền mặt' end || ')',
          nullif(trim(coalesce(p_phone, '')), ''), a.id, r.work_date || substr(public.vn_now_text(), 11), 'bill', p_report, p_item)
  returning id into nid;
  insert into public.shift_recon_log(report_id, action, field, after, reason, by_account)
  values (p_report, 'ghi_nhan_no', p_item, jsonb_build_object('name', nm, 'amount', p_amount), 'Ghi nhận nợ: ' || nm, a.id);
  perform public.app_log('ghi_nhan_no', 'report=' || p_report || ' ' || p_item || ' ' || p_amount || ' ' || nm);
  return nid;
end $$;

create or replace function public.app_ca_recon_debt_delete(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare d public.shift_debts; r public.shift_reports;
begin
  select * into d from public.shift_debts where id = p_id;
  if d.id is null or d.gap_report is null then raise exception 'Không tìm thấy khoản nợ ghi nhận.'; end if;
  select * into r from public.shift_reports where id = d.gap_report;
  if public.app__gap_role(r.branch_id) is null and not coalesce(public.app_can('doi_soat'), false) then raise exception 'Chỉ quản lý được xoá.'; end if;
  if d.closed_at is not null or exists (select 1 from public.shift_debts x where x.split_from = p_id) then raise exception 'Khách đã trả (một phần) — không xoá được.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng đã CHỐT.'; end if;
  delete from public.shift_debts where id = p_id;
  perform public.app_log('ghi_nhan_no_xoa', 'debt=' || p_id || ' ' || d.amount);
end $$;


-- Thay bản đang chạy (lấy từ máy chủ 13/11)
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
    'forced_start', public.app__ca_forced_start(r),
    'tol', public.app__ca_tol(),
    'can_edit', r.status = 'dang_chot',
    'can_recon', ds and r.status = 'hoan_thanh',
    'can_reopen', public.app_can('mo_lai_phieu_ca') and r.status = 'hoan_thanh');
  if hide_own then out := out || jsonb_build_object('cash_counted', null, 'cash_hidden', true); end if;
  return out;
end $function$;

-- Thay bản đang chạy (lấy từ máy chủ 13/11)
CREATE OR REPLACE FUNCTION public.app__gap_rows(p_branch bigint, p_from text, p_to text)
 RETURNS TABLE(report_id bigint, work_date text, shift text, item text, lech bigint, kind text, total bigint, tl bigint, dcs bigint, mt bigint, mp bigint, remain bigint, state text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with r as (
    select x.id, x.work_date, x.shift, public.app__ca_money(x.id) m
      from public.shift_reports x
     where x.branch_id = p_branch and x.status = 'hoan_thanh' and x.work_date between p_from and p_to),
  v as (
    select r.id, r.work_date, r.shift, it.item,
           case it.item when 'tien_mat' then coalesce((r.m ->> 'tm_left')::bigint, 0) else coalesce((r.m ->> 'ck_left')::bigint, 0) end lech
      from r cross join (values ('tien_mat'), ('chuyen_khoan')) it(item)),
  w as (
    select v.id, v.work_date, v.shift, v.item, v.lech, case when v.lech < 0 then 'thieu' else 'du' end kind, abs(v.lech) total,
           case when v.lech < 0 then coalesce((select sum(s.amount) from public.shift_shortfalls s where s.report_id = v.id and s.item = v.item and s.status <> 'huy'), 0) else 0 end tl,
           coalesce((select sum(g.amount) from public.gap_decisions g where g.report_id = v.id and g.item = v.item), 0)
             + case when v.lech < 0 then coalesce((select sum(d.amount) from public.shift_debts d where d.gap_report = v.id and d.gap_item = v.item and d.closed_at is not null), 0) else 0 end dcs,
           case when v.lech < 0 then coalesce((select sum(d.amount) from public.shift_debts d where d.gap_report = v.id and d.gap_item = v.item and d.closed_at is null), 0) else 0 end np,
           coalesce((select sum(mm.amount) from public.gap_matches mm where mm.item = v.item and mm.status = 'da_duyet'
                       and ((v.lech < 0 and mm.short_report = v.id) or (v.lech > 0 and mm.over_report = v.id))), 0) mt,
           coalesce((select sum(mm.amount) from public.gap_matches mm where mm.item = v.item and mm.status = 'cho_duyet'
                       and ((v.lech < 0 and mm.short_report = v.id) or (v.lech > 0 and mm.over_report = v.id))), 0) mp
      from v where abs(v.lech) > 5000)
  select w.id, w.work_date, w.shift, w.item, w.lech, w.kind, w.total, w.tl, w.dcs, w.mt, w.mp,
         greatest(w.total - w.tl - w.dcs - w.mt, 0),
         case when greatest(w.total - w.tl - w.dcs - w.mt, 0) <= 5000 then 'xong' when w.kind = 'du' then 'du'
              when w.np > 0 and greatest(w.total - w.tl - w.dcs - w.mt, 0) - w.np <= 5000 then 'cho_no'
              when w.item = 'chuyen_khoan' then 'cho_tien' else 'cho_gan' end
    from w
$function$;

-- Thay bản đang chạy (lấy từ máy chủ 13/11)
CREATE OR REPLACE FUNCTION public.app__gap_pending(p_branch bigint, p_from text, p_to text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (select count(*)::int from public.app__gap_rows(p_branch, p_from, p_to) g where g.kind = 'thieu' and g.state in ('cho_tien', 'cho_gan', 'cho_no'))
       + (select count(*)::int from public.gap_matches mm join public.shift_reports x on x.id = mm.short_report
           where mm.branch_id = p_branch and mm.status = 'cho_duyet' and x.work_date between p_from and p_to)
$function$;

-- Thay bản đang chạy (lấy từ máy chủ 13/11)
CREATE OR REPLACE FUNCTION public.app_gap_list(p_branch bigint, p_month text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare role text := public.app__gap_role(p_branch); f text; t text; f3 text; t3 text;
begin
  if (public.app_account()).id is null then raise exception 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'; end if;
  if role is null then raise exception 'Chỉ Chủ, Quản lý tổng, Quản lý cơ sở dùng tab Âm tiền.'; end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'Tháng không hợp lệ.'; end if;
  f := p_month || '-01'; t := to_char(f::date + interval '1 month' - interval '1 day', 'YYYY-MM-DD');
  f3 := to_char(f::date - 3, 'YYYY-MM-DD'); t3 := to_char(t::date + 3, 'YYYY-MM-DD');
  return jsonb_build_object('role', role, 'from', f, 'to', t, 'pending', public.app__gap_pending(p_branch, f, t),
    'locked', public.app__fin_locked(p_branch, f),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('report_id', g.report_id, 'date', g.work_date, 'shift', g.shift, 'item', g.item, 'lech', g.lech,
               'kind', g.kind, 'total', g.total, 'tl', g.tl, 'dcs', g.dcs, 'mt', g.mt, 'mp', g.mp, 'remain', g.remain, 'state', g.state,
               'in_month', g.work_date between f and t, 'locked', public.app__fin_locked(p_branch, g.work_date),
               'result', (select jsonb_build_object('result', rr.result, 'amount', rr.amount, 'reason', rr.reason, 'by', public.app__acc_name(rr.by_account))
                            from public.shift_report_results rr where rr.report_id = g.report_id and rr.item = g.item),
               'staff', coalesce((select jsonb_agg(jsonb_build_object('employee_id', st.employee_id, 'name', coalesce(em.code || ' – ', '') || em.name) order by st.id)
                            from public.shift_report_staff st join public.employees em on em.id = st.employee_id
                           where st.report_id = g.report_id and coalesce(st.worked, 1) = 1), '[]'),
               'people', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', coalesce(em.code || ' – ', '') || em.name, 'amount', s.amount, 'status', s.status, 'note', s.status_note) order by s.id)
                            from public.shift_shortfalls s join public.employees em on em.id = s.employee_id
                           where s.report_id = g.report_id and s.item = g.item and s.status <> 'huy'), '[]'),
               'debts', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.table_name, 'phone', d.phone, 'amount', d.amount, 'closed', d.closed_at is not null,
                              'collect_kind', d.collect_kind, 'closed_date', (select x.work_date from public.shift_reports x where x.id = d.closed_report_id),
                              'closed_shift', (select x.shift from public.shift_reports x where x.id = d.closed_report_id)) order by d.id)
                            from public.shift_debts d where d.gap_report = g.report_id and d.gap_item = g.item), '[]'),
               'decisions', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'amount', d.amount, 'reason', d.reason, 'by', public.app__acc_name(d.created_by), 'at', d.created_at) order by d.id)
                            from public.gap_decisions d where d.report_id = g.report_id and d.item = g.item), '[]'),
               'matches', coalesce((select jsonb_agg(jsonb_build_object('id', mm.id, 'amount', mm.amount, 'reason', mm.reason, 'status', mm.status,
                              'other', case when mm.short_report = g.report_id then mm.over_report else mm.short_report end,
                              'other_date', o.work_date, 'other_shift', o.shift, 'by', public.app__acc_name(mm.created_by), 'mine', mm.created_by = (public.app_account()).id,
                              'approved_by', public.app__acc_name(mm.approved_by)) order by mm.id)
                            from public.gap_matches mm join public.shift_reports o on o.id = case when mm.short_report = g.report_id then mm.over_report else mm.short_report end
                           where mm.item = g.item and (mm.short_report = g.report_id or mm.over_report = g.report_id)), '[]'))
             order by g.work_date desc, array_position(public.app__shifts(), g.shift) desc, g.item)
           from public.app__gap_rows(p_branch, f3, t3) g), '[]'),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code), 'name', b.name) order by b.sort_order)
               from public.branches b where b.status = 'Đang hoạt động' and public.app__gap_role(b.id) is not null), '[]'));
end $function$;

-- Thay bản đang chạy (lấy từ máy chủ 13/11)
CREATE OR REPLACE FUNCTION public.app_ca_debt_collect_part(p_debt bigint, p_report bigint, p_kind text, p_amount bigint, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.shift_debts;
begin
  select * into d from public.shift_debts where id = p_debt for update;
  if d.id is null or d.closed_at is not null then raise exception 'Khoản nợ này đã được thu hoặc không còn.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nhập số tiền khách trả lớn hơn 0.'; end if;
  if p_amount > d.amount then raise exception 'Khách trả nhiều hơn số nợ (%).', public.app__vnd(d.amount); end if;
  if p_amount < d.amount then
    perform public.app__ca_need_edit(p_report);
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, split_from, gap_report, gap_item)
    values (d.branch_id, d.report_id, d.table_name, d.amount - p_amount, d.note, d.phone, d.created_by, d.created_at, d.kind, d.id, d.gap_report, d.gap_item);
    update public.shift_debts set amount = p_amount where id = d.id;
  end if;
  perform public.app_ca_debt_collect(p_debt, p_report, p_kind, coalesce(nullif(trim(coalesce(p_note, '')), ''), case when p_amount < d.amount then 'Thu một phần' else 'Đã thu' end));
end $function$;

-- Thay bản đang chạy (lấy từ máy chủ 13/11)
CREATE OR REPLACE FUNCTION public.app_cn_debts(p_branch bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.app__tc_need(p_branch);
  return jsonb_build_object('can_edit', public.app__cn_can(p_branch),
    'open', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.table_name, 'phone', d.phone, 'amount', d.amount, 'note', d.note,
              'date', coalesce(o.work_date, left(d.created_at, 10)), 'shift', o.shift, 'report_id', d.report_id, 'by_ql', d.report_id is null,
              'by', public.app__acc_name(d.created_by), 'split', d.split_from is not null, 'gap_report', d.gap_report,
              'gap_ca', (select x.shift || ' ' || to_char(x.work_date::date, 'DD/MM') from public.shift_reports x where x.id = d.gap_report),
              'paid_before', coalesce((select sum(x.amount) from public.shift_debts x where x.closed_at is not null and (x.id = d.split_from or x.split_from = d.split_from) and d.split_from is not null), 0))
              order by coalesce(o.work_date, left(d.created_at, 10)), d.id)
            from public.shift_debts d left join public.shift_reports o on o.id = d.report_id
           where d.branch_id = p_branch and d.closed_at is null and coalesce(d.kind, 'bill') <> 'muon'
             and (d.report_id is null or o.status = 'hoan_thanh')), '[]'));
end $function$;

revoke execute on function public.app__ca_sched(bigint, bigint) from public, anon, authenticated;
revoke execute on function public.app_ca_recon_debt(bigint, text, text, text, bigint, text), public.app_ca_recon_debt_delete(bigint) from public, anon;
grant execute on function public.app_ca_recon_debt(bigint, text, text, text, bigint, text), public.app_ca_recon_debt_delete(bigint) to authenticated;

insert into public.app_migrations(file) values ('74_ghi_nhan_no_gio_lich.sql') on conflict (file) do nothing;
