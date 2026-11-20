-- 146 (bước 167, anh Tiến giao 19/11/2026): Hàng hoá — lọc theo KHOẢNG NGÀY cho Đối soát · Phiếu xuất · Kiểm soát.
--  * Loại ngày: 'giao' = ngày giao (work_date) · 'nhan' = ngày nhận (received_date) · 'ds' = ngày đối soát xong (recon_at).
--  * app_nh_list(p_month, p_branch [, p_from, p_to, p_kind]) — thêm 3 tham số có mặc định; gọi kiểu cũ (2 tham số) chạy y như trước.
--  * app_gh_control(p_branch, p_month [, p_from, p_to, p_kind]) — khoảng ngày chỉ lọc danh sách "Đã xử lý";
--    TIỀN THÁNG vẫn tính cả tháng p_month như cũ (không đổi cách tính tiền).
--  * app__gh_fu_json thêm 'received_date', 'recon_date' (của lần giao) để web lọc các mục đang chờ theo ngày nhận / ngày đối soát.
--  Chạy lại nhiều lần không lỗi.

-- ngày theo loại của một lần giao
create or replace function public.app__nh_loc_date(i public.delivery_invoices, p_kind text) returns text
language sql stable set search_path = public as $$
  select case coalesce(p_kind, 'giao') when 'nhan' then coalesce(i.received_date, left(i.received_at, 10))
                                       when 'ds' then left(i.recon_at, 10) else i.work_date end
$$;

-- kiểm khoảng ngày (cả hai trống = không lọc)
create or replace function public.app__nh_loc_check(p_from text, p_to text, p_kind text) returns boolean
language plpgsql immutable as $$
begin
  if p_from is null and p_to is null then return false; end if;
  if coalesce(p_from, '') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p_to, '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Khoảng ngày không hợp lệ.'; end if;
  if p_to < p_from then raise exception 'Ngày "đến" phải sau ngày "từ".'; end if;
  if p_to::date - p_from::date > 400 then raise exception 'Chọn khoảng ngày tối đa 400 ngày.'; end if;
  if coalesce(p_kind, 'giao') not in ('giao', 'nhan', 'ds') then raise exception 'Loại ngày không hợp lệ.'; end if;
  return true;
end $$;

-- ---------------------------------------------------------------- Danh sách lần giao (Phiếu xuất · Đối soát › Đã xong)
drop function if exists public.app_nh_list(text, bigint);
create or replace function public.app_nh_list(p_month text, p_branch bigint, p_from text default null, p_to text default null, p_kind text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m boolean; rng boolean; mon text;
begin
  if not (public.app_can('ke_toan') or public.app_can('doi_soat')) then raise exception 'Bạn không có quyền xem nhập hàng.'; end if;
  rng := public.app__nh_loc_check(p_from, p_to, p_kind);
  if rng then mon := coalesce(p_month, left(p_to, 7)); else mon := p_month; end if;
  perform public.app__fin_month_ok(mon);
  m := public.app__nh_money();
  return jsonb_build_object(
    'rows', coalesce((select jsonb_agg(public.app__nh_json(i, m) order by public.app__nh_loc_date(i, case when rng then p_kind end) desc, i.id desc) from public.delivery_invoices i
                       where (p_branch is null or i.branch_id = p_branch)
                         and case when rng then public.app__nh_loc_date(i, p_kind) between p_from and p_to else left(i.work_date, 7) = mon end), '[]'),
    'open', coalesce((select jsonb_agg(j order by j ->> 'work_date', (j ->> 'id')::bigint) from (
                        select public.app__nh_json(i, m) j from public.delivery_invoices i where (p_branch is null or i.branch_id = p_branch)
                          and (i.state <> 'da_nhan' or i.recon_at is null or exists (select 1 from public.delivery_lines l where l.invoice_id = i.id and coalesce(l.qty_checked, l.qty_received, 0) > 0
                               and not exists (select 1 from public.delivery_photo_lines pl where pl.line_id = l.id)))) z
                       where jsonb_array_length(j -> 'missing') > 0), '[]'),
    'by_branch', coalesce((select jsonb_agg(jsonb_build_object('branch_id', b.id, 'code', coalesce(b.display_code, b.code),
                       'total', case when m then (select coalesce(sum(i.total), 0) from public.delivery_invoices i where i.branch_id = b.id and left(i.work_date, 7) = mon and i.doc_no is not null) end,
                       'count', (select count(*) from public.delivery_invoices i where i.branch_id = b.id and left(i.work_date, 7) = mon)) order by b.sort_order)
                     from public.branches b where b.status = 'Đang hoạt động'), '[]'),
    'money', m, 'kt', public.app_can('ke_toan'),
    'range', case when rng then jsonb_build_object('from', p_from, 'to', p_to, 'kind', coalesce(p_kind, 'giao')) end);
end $$;

-- ---------------------------------------------------------------- mục Kiểm soát: thêm ngày nhận / ngày đối soát của lần giao
create or replace function public.app__gh_fu_json(f public.delivery_followups) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', f.id, 'branch_id', f.branch_id, 'invoice_id', f.invoice_id, 'line_id', f.line_id, 'kind', f.kind, 'name', f.name, 'unit', f.unit,
    'qty', f.qty, 'price', case when public.app__nh_money() then f.price end, 'amount', case when public.app__nh_money() then f.amount end,
    'status', f.status, 'note', f.note, 'created_at', f.created_at, 'resolved_at', f.resolved_at, 'resolved_by', public.app__acc_name(f.resolved_by),
    'resolved_ref', f.resolved_ref, 'resolved_amount', case when public.app__nh_money() then f.resolved_amount end, 'resolved_month', f.resolved_month,
    'resolved_doc', (select d.doc_no from public.delivery_invoices d where d.id = f.resolved_invoice_id),
    'doc_no', d.doc_no, 'work_date', d.work_date,
    'received_date', public.app__nh_loc_date(d, 'nhan'), 'recon_date', coalesce(left(d.recon_at, 10), left(f.created_at, 10)),
    'extra', (select l.qty_invoice is null from public.delivery_lines l where l.id = f.line_id),
    'days', (public.app__nh_today()::date - left(f.created_at, 10)::date))
  from (select 1) one left join public.delivery_invoices d on d.id = f.invoice_id
$$;

-- ---------------------------------------------------------------- Kiểm soát: khoảng ngày lọc "Đã xử lý"; tiền tháng giữ nguyên theo p_month
drop function if exists public.app_gh_control(bigint, text);
create or replace function public.app_gh_control(p_branch bigint, p_month text, p_from text default null, p_to text default null, p_kind text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m boolean; rng boolean;
begin
  if not (public.app_can('ke_toan') or public.app_can('doi_soat')) then raise exception 'Bạn không có quyền.'; end if;
  rng := public.app__nh_loc_check(p_from, p_to, p_kind);
  perform public.app__fin_month_ok(p_month);
  m := public.app__nh_money();
  return jsonb_build_object(
    'open', coalesce((select jsonb_agg(public.app__gh_fu_json(f) order by f.created_at, f.id) from public.delivery_followups f where f.status = 'cho' and (p_branch is null or f.branch_id = p_branch)), '[]'),
    'done', coalesce((select jsonb_agg(public.app__gh_fu_json(f) order by f.resolved_at desc, f.id desc) from public.delivery_followups f
                       left join public.delivery_invoices i on i.id = f.invoice_id
                       where f.status <> 'cho' and (p_branch is null or f.branch_id = p_branch)
                         and case when not rng then left(coalesce(f.resolved_at, f.created_at), 7) = p_month
                                  when coalesce(p_kind, 'giao') = 'ds' then coalesce(left(i.recon_at, 10), left(f.created_at, 10)) between p_from and p_to
                                  else public.app__nh_loc_date(i, p_kind) between p_from and p_to end), '[]'),
    'need_bu', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'branch_id', i.branch_id, 'doc_no', i.doc_no, 'kind', i.kind, 'work_date', i.work_date,
                          'received_at', i.received_at, 'received_date', public.app__nh_loc_date(i, 'nhan'),
                          'received_by', public.app__acc_name(i.received_by), 'deliv_note', i.deliv_note) order by i.received_at, i.id)
                       from public.delivery_invoices i where i.recon_at is null and i.state <> 'dang_chuyen' and i.deliv_path is null and i.bu_path is null
                         and (p_branch is null or i.branch_id = p_branch)), '[]'),
    'money', case when m then jsonb_build_object(
      'invoices', coalesce((select sum(total) from public.delivery_invoices where (p_branch is null or branch_id = p_branch) and left(work_date, 7) = p_month and doc_no is not null), 0),
      'n_invoices', (select count(*) from public.delivery_invoices where (p_branch is null or branch_id = p_branch) and left(work_date, 7) = p_month and doc_no is not null),
      'bu', coalesce((select sum(l.amount) from public.delivery_lines l join public.delivery_invoices i on i.id = l.invoice_id
                       where l.bu_followup_id is not null and (p_branch is null or i.branch_id = p_branch) and left(i.work_date, 7) = p_month and i.doc_no is not null), 0),
      'hd_bs', coalesce((select sum(f.resolved_amount) from public.delivery_followups f where f.kind = 'hd_bs' and f.status = 'xong' and (p_branch is null or f.branch_id = p_branch) and f.resolved_month = p_month), 0),
      'payable', public.app__nh_month_total(p_branch, p_month)) end,
    'kt', public.app_can('ke_toan'), 'today', public.app__nh_today(),
    'range', case when rng then jsonb_build_object('from', p_from, 'to', p_to, 'kind', coalesce(p_kind, 'giao')) end);
end $$;

revoke execute on function public.app__nh_loc_date(public.delivery_invoices, text), public.app__nh_loc_check(text, text, text),
  public.app__gh_fu_json(public.delivery_followups) from public, anon, authenticated;
revoke execute on function public.app_nh_list(text, bigint, text, text, text), public.app_gh_control(bigint, text, text, text, text) from public, anon;
grant execute on function public.app_nh_list(text, bigint, text, text, text), public.app_gh_control(bigint, text, text, text, text) to authenticated;
notify pgrst, 'reload schema';

insert into public.app_migrations(file) values ('146_hang_hoa_loc_ngay.sql') on conflict (file) do nothing;
