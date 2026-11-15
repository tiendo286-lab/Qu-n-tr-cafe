-- Bước 104 (anh Tiến chốt 15/11/2026): HÀNG HOÁ tách hẳn khỏi chốt ca — mục menu riêng Hàng hoá (Nhận hàng · Đối soát · Phiếu xuất · Kiểm soát).
--  * Nhận hàng không cần phiếu ca: app_gh_inbox / app_gh_receive / app_gh_receipt_save / app_gh_photo_add / app_gh_photo_del (ảnh gh<id>/…).
--    Lần giao không gắn phiếu ca (received_report_id null) → phiếu ca tự ghi xong mục Nhập hàng như ca không nhận hàng (app__ca_auto_recon).
--  * Kiểm soát: đối soát xong mà lệch → delivery_followups: THIẾU → chờ kho giao bù (bill giữ nguyên; kế toán chỉ ra dòng giao bù trong phiếu xuất
--    sau → dòng đó không tính tiền), THỪA → chờ hoá đơn bổ sung (kế toán lên hoá đơn cho kho, ghi số + tiền → cộng vào tiền tháng). Huỷ được (lý do).
--  * Tiền phải trả kho tổng tháng = tổng phiếu xuất − dòng giao bù + hoá đơn bổ sung đã ghi.

create table if not exists public.delivery_followups (
  id bigserial primary key,
  branch_id bigint not null references public.branches(id),
  invoice_id bigint not null references public.delivery_invoices(id) on delete cascade,
  line_id bigint references public.delivery_lines(id) on delete set null,
  kind text not null check (kind in ('bu', 'hd_bs')),
  name text not null, unit text, qty numeric not null, price bigint, amount bigint,
  status text not null default 'cho' check (status in ('cho', 'xong', 'huy')),
  resolved_invoice_id bigint references public.delivery_invoices(id) on delete set null,
  resolved_line_id bigint references public.delivery_lines(id) on delete set null,
  resolved_ref text, resolved_amount bigint, resolved_month text, note text,
  created_at text not null default public.vn_now_text(), resolved_at text, resolved_by bigint
);
create index if not exists delivery_followups_br on public.delivery_followups(branch_id, status);
create unique index if not exists delivery_followups_line on public.delivery_followups(line_id, kind) where status <> 'huy';
alter table public.delivery_followups enable row level security;
revoke all on public.delivery_followups from anon, authenticated;
alter table public.delivery_lines add column if not exists bu_followup_id bigint;

-- ---------------------------------------------------------------- tạo / gỡ danh sách theo dõi khi đối soát xong / bỏ đối soát
create or replace function public.app__nh_followups(p_inv bigint) returns void
language plpgsql security definer set search_path = public as $$
declare i public.delivery_invoices; l public.delivery_lines; q numeric;
begin
  select * into i from public.delivery_invoices where id = p_inv;
  if i.id is null then return; end if;
  if i.recon_at is null then
    delete from public.delivery_followups where invoice_id = p_inv and status = 'cho';
    return;
  end if;
  if i.kind = 'khong_hd' and i.doc_no is null then return; end if;   -- chưa có hoá đơn để so
  for l in select * from public.delivery_lines where invoice_id = p_inv and qty_invoice is not null and bu_followup_id is null loop
    q := coalesce(l.qty_checked, l.qty_received, 0);
    if q = l.qty_invoice or exists (select 1 from public.delivery_followups f where f.line_id = l.id and f.status <> 'huy') then continue; end if;
    insert into public.delivery_followups(branch_id, invoice_id, line_id, kind, name, unit, qty, price, amount)
    values (i.branch_id, i.id, l.id, case when q < l.qty_invoice then 'bu' else 'hd_bs' end, l.name, l.unit, abs(l.qty_invoice - q), l.price,
            round(abs(l.qty_invoice - q) * coalesce(l.price, 0))::bigint);
  end loop;
end $$;

CREATE OR REPLACE FUNCTION public.app__nh_after_check(p_inv bigint, p_acc bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i public.delivery_invoices; rid bigint;
begin
  select * into i from public.delivery_invoices where id = p_inv;
  if exists (select 1 from public.delivery_lines where invoice_id = p_inv and checked_at is null) then
    update public.delivery_invoices set recon_by = null, recon_at = null where id = p_inv and recon_at is not null;
    delete from public.shift_report_checks where report_id = i.received_report_id and item = 'nhap_hang';
    perform public.app__nh_followups(p_inv);
    return;
  end if;
  update public.delivery_invoices set recon_by = p_acc, recon_at = public.vn_now_text() where id = p_inv and recon_at is null;
  perform public.app__nh_followups(p_inv);   -- bước 104: thiếu → chờ giao bù, thừa → chờ hoá đơn bổ sung
  rid := i.received_report_id;
  if rid is not null and not exists (select 1 from public.delivery_invoices d join public.delivery_lines l on l.invoice_id = d.id
                                      where d.received_report_id = rid and l.checked_at is null) then
    insert into public.shift_report_checks(report_id, item, checked_by, checked_at) values (rid, 'nhap_hang', p_acc, public.vn_now_text()) on conflict (report_id, item) do nothing;
    perform public.app__ca_auto_finish(rid, p_acc);
  end if;
end $function$;

-- ---------------------------------------------------------------- tiền phải trả kho tổng theo tháng
create or replace function public.app__nh_month_total(p_branch bigint, p_month text) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(total) from public.delivery_invoices where (p_branch is null or branch_id = p_branch) and left(work_date, 7) = p_month and doc_no is not null), 0)
       - coalesce((select sum(l.amount) from public.delivery_lines l join public.delivery_invoices i on i.id = l.invoice_id
                    where l.bu_followup_id is not null and (p_branch is null or i.branch_id = p_branch) and left(i.work_date, 7) = p_month and i.doc_no is not null), 0)
       + coalesce((select sum(f.resolved_amount) from public.delivery_followups f
                    where f.kind = 'hd_bs' and f.status = 'xong' and (p_branch is null or f.branch_id = p_branch) and f.resolved_month = p_month), 0)
$$;

-- ---------------------------------------------------------------- quyền nhận hàng (không phiếu ca)
create or replace function public.app__gh_can_edit(i public.delivery_invoices) returns void
language plpgsql security definer set search_path = public as $$
begin
  if i.id is null then raise exception 'Không tìm thấy lần giao hàng.'; end if;
  if i.recon_at is not null then raise exception 'Quản lý đã đối soát hàng này nên không sửa được nữa.'; end if;
  if i.state = 'dang_chuyen' then
    if i.work_date > public.app__nh_today() then raise exception 'Phiếu này giao ngày % — chưa tới ngày.', to_char(i.work_date::date, 'DD/MM'); end if;
    return;
  end if;
  if i.received_date is distinct from public.app__nh_today() and not public.app_can('doi_soat') then raise exception 'Chỉ sửa được báo cáo nhận hàng trong ngày nhận.'; end if;
end $$;

create or replace function public.app_gh_inbox(p_branch bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m boolean; me public.accounts := public.app_account(); t text := public.app__nh_today();
begin
  if not (public.app_can('chot_ca') or public.app_can('doi_soat') or public.app_can('ke_toan')) then raise exception 'Bạn không có quyền.'; end if;
  m := public.app__nh_money();
  return jsonb_build_object(
    'rows', coalesce((select jsonb_agg(public.app__nh_json(i, m) order by i.work_date, i.id) from public.delivery_invoices i
                       where (p_branch is null or i.branch_id = p_branch) and i.recon_at is null
                         and ((i.state = 'dang_chuyen' and i.work_date <= t) or i.state in ('da_nhan', 'cho_hoa_don'))), '[]'),
    'catalog', coalesce((select jsonb_agg(jsonb_build_object('code', z.code, 'name', z.name, 'unit', z.unit) order by z.name) from (
                          select distinct on (public.app__nh_norm(l.name)) l.code, l.name, l.unit from public.delivery_lines l
                           where l.qty_invoice is not null order by public.app__nh_norm(l.name), l.id desc limit 400) z), '[]'),
    'my_branches', coalesce((select jsonb_agg(eb.branch_id) from public.employee_branches eb where eb.employee_id = me.employee_id), '[]'),
    'today', t, 'can_recv', public.app_can('chot_ca'), 'can_recon', public.app_can('doi_soat'));
end $$;

create or replace function public.app_gh_receive(p_id bigint, p_lines jsonb, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; i public.delivery_invoices; x jsonb; n_mis int; b public.branches;
begin
  a := public.app__need('chot_ca');
  select * into i from public.delivery_invoices where id = p_id for update;
  perform public.app__gh_can_edit(i);
  if i.state = 'cho_hoa_don' then raise exception 'Phiếu nhận không hoá đơn: dùng nút Lưu phiếu nhận.'; end if;
  if exists (select 1 from public.delivery_lines l where l.invoice_id = p_id
              and not exists (select 1 from jsonb_array_elements(coalesce(p_lines, '[]')) y where (y ->> 'id')::bigint = l.id and nullif(y ->> 'qty', '') is not null)) then
    raise exception 'Nhập số thực nhận cho tất cả các món.';
  end if;
  for x in select * from jsonb_array_elements(p_lines) loop
    if (x ->> 'qty')::numeric < 0 then raise exception 'Số lượng không được âm.'; end if;
    update public.delivery_lines set qty_received = (x ->> 'qty')::numeric where id = (x ->> 'id')::bigint and invoice_id = p_id;
  end loop;
  update public.delivery_invoices set state = 'da_nhan', received_by = a.id, received_at = public.vn_now_text(), received_date = public.app__nh_today(),
         received_report_id = null, receive_note = nullif(trim(coalesce(p_note, '')), ''), updated_at = public.vn_now_text() where id = p_id;
  select count(*) into n_mis from public.delivery_lines l where l.invoice_id = p_id and l.qty_invoice is distinct from l.qty_received;
  select * into b from public.branches where id = i.branch_id;
  perform public.app__nh_notify(i.branch_id, case when n_mis > 0 then 'Nhận hàng lệch phiếu ' else 'Đã nhận hàng ' end || coalesce(i.doc_no, '') || ' · ' || coalesce(b.display_code, b.code),
    public.app__acc_name(a.id) || case when n_mis > 0 then ' báo ' || n_mis || ' món khác số lượng phiếu xuất' else ' nhận đủ' end || ' — chờ quản lý đối soát.',
    '/hang-hoa/doi-soat?ds=' || p_id, true, n_mis > 0);
  perform public.app_log('hang_hoa_nhan', 'id=' || p_id || ' lệch ' || n_mis);
  return jsonb_build_object('mismatch', n_mis);
end $$;

create or replace function public.app_gh_receipt_save(p_id bigint, p_branch bigint, p_lines jsonb, p_note text) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; i public.delivery_invoices; x jsonb; nid bigint; k int := 0; keep bigint[] := '{}'; lid bigint; b public.branches;
begin
  a := public.app__need('chot_ca');
  if jsonb_array_length(coalesce(p_lines, '[]')) = 0 then raise exception 'Ghi ít nhất 1 món hàng đã nhận.'; end if;
  for x in select * from jsonb_array_elements(p_lines) loop
    if trim(coalesce(x ->> 'name', '')) = '' then raise exception 'Món hàng phải có tên.'; end if;
    if nullif(x ->> 'qty', '') is null or (x ->> 'qty')::numeric <= 0 then raise exception 'Nhập số lượng nhận cho món "%".', x ->> 'name'; end if;
  end loop;
  if p_id is null then
    select * into b from public.branches where id = p_branch and status = 'Đang hoạt động';
    if b.id is null then raise exception 'Chọn cơ sở nhận hàng.'; end if;
    insert into public.delivery_invoices(branch_id, work_date, created_by, kind, state, received_by, received_at, received_date, received_report_id, receive_note)
    values (b.id, public.app__nh_today(), a.id, 'khong_hd', 'cho_hoa_don', a.id, public.vn_now_text(), public.app__nh_today(), null, nullif(trim(coalesce(p_note, '')), ''))
    returning id into nid;
  else
    select * into i from public.delivery_invoices where id = p_id for update;
    perform public.app__gh_can_edit(i);
    if i.state <> 'cho_hoa_don' then raise exception 'Phiếu này đã được ghép hoá đơn.'; end if;
    nid := p_id; select * into b from public.branches where id = i.branch_id;
    update public.delivery_invoices set receive_note = nullif(trim(coalesce(p_note, '')), ''), received_at = public.vn_now_text(), updated_at = public.vn_now_text() where id = nid;
  end if;
  for x in select * from jsonb_array_elements(p_lines) loop
    k := k + 1; lid := nullif(x ->> 'id', '')::bigint;
    if lid is not null and exists (select 1 from public.delivery_lines where id = lid and invoice_id = nid) then
      update public.delivery_lines set sort = k, code = nullif(trim(coalesce(x ->> 'code', '')), ''), name = trim(x ->> 'name'), unit = nullif(trim(coalesce(x ->> 'unit', '')), ''),
             qty_received = (x ->> 'qty')::numeric where id = lid;
    else
      insert into public.delivery_lines(invoice_id, sort, code, name, unit, qty_received)
      values (nid, k, nullif(trim(coalesce(x ->> 'code', '')), ''), trim(x ->> 'name'), nullif(trim(coalesce(x ->> 'unit', '')), ''), (x ->> 'qty')::numeric) returning id into lid;
    end if;
    keep := keep || lid;
  end loop;
  delete from public.delivery_lines where invoice_id = nid and not (id = any(keep));
  if p_id is null then
    perform public.app__nh_notify(b.id, 'Nhận hàng KHÔNG có hoá đơn · ' || coalesce(b.display_code, b.code),
      public.app__acc_name(a.id) || ' nhận ' || k || ' món. Kế toán tải hoá đơn và ghép vào phiếu.', '/hang-hoa/phieu-xuat', true, true);
  end if;
  perform public.app_log('hang_hoa_khong_hoa_don', 'id=' || nid || ' ' || k || ' món');
  return nid;
end $$;

create or replace function public.app_gh_photo_add(p_id bigint, p_path text, p_lines bigint[]) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); i public.delivery_invoices; nid bigint;
begin
  if a.id is null or not (public.app_can('chot_ca') or public.app_can('doi_soat')) then raise exception 'Bạn không có quyền.'; end if;
  select * into i from public.delivery_invoices where id = p_id;
  perform public.app__gh_can_edit(i);
  if coalesce(p_path, '') !~ ('^gh' || p_id || '/[^/]+$') then raise exception 'Đường dẫn ảnh không hợp lệ.'; end if;
  insert into public.delivery_receipt_photos(invoice_id, path, created_by) values (p_id, p_path, a.id) returning id into nid;
  insert into public.delivery_photo_lines(photo_id, line_id)
  select nid, l.id from public.delivery_lines l where l.invoice_id = p_id and l.id = any(coalesce(p_lines, '{}')) on conflict do nothing;
  return nid;
end $$;

create or replace function public.app_gh_photo_del(p_photo bigint) returns text
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); ph public.delivery_receipt_photos; i public.delivery_invoices;
begin
  select * into ph from public.delivery_receipt_photos where id = p_photo;
  if ph.id is null then return null; end if;
  select * into i from public.delivery_invoices where id = ph.invoice_id;
  perform public.app__gh_can_edit(i);
  if ph.created_by is distinct from a.id and not public.app_can('doi_soat') and not public.app_can('chot_ca') then raise exception 'Bạn không có quyền xoá ảnh này.'; end if;
  delete from public.delivery_receipt_photos where id = p_photo;
  return ph.path;
end $$;

-- ---------------------------------------------------------------- Kiểm soát: chờ giao bù / chờ hoá đơn bổ sung / tiền tháng
create or replace function public.app__gh_fu_json(f public.delivery_followups) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', f.id, 'branch_id', f.branch_id, 'invoice_id', f.invoice_id, 'line_id', f.line_id, 'kind', f.kind, 'name', f.name, 'unit', f.unit,
    'qty', f.qty, 'price', case when public.app__nh_money() then f.price end, 'amount', case when public.app__nh_money() then f.amount end,
    'status', f.status, 'note', f.note, 'created_at', f.created_at, 'resolved_at', f.resolved_at, 'resolved_by', public.app__acc_name(f.resolved_by),
    'resolved_ref', f.resolved_ref, 'resolved_amount', case when public.app__nh_money() then f.resolved_amount end, 'resolved_month', f.resolved_month,
    'resolved_doc', (select d.doc_no from public.delivery_invoices d where d.id = f.resolved_invoice_id),
    'doc_no', (select d.doc_no from public.delivery_invoices d where d.id = f.invoice_id), 'work_date', (select d.work_date from public.delivery_invoices d where d.id = f.invoice_id),
    'days', (public.app__nh_today()::date - left(f.created_at, 10)::date))
$$;

create or replace function public.app_gh_control(p_branch bigint, p_month text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m boolean;
begin
  if not (public.app_can('ke_toan') or public.app_can('doi_soat')) then raise exception 'Bạn không có quyền.'; end if;
  m := public.app__nh_money();
  return jsonb_build_object(
    'open', coalesce((select jsonb_agg(public.app__gh_fu_json(f) order by f.created_at, f.id) from public.delivery_followups f where f.status = 'cho' and (p_branch is null or f.branch_id = p_branch)), '[]'),
    'done', coalesce((select jsonb_agg(public.app__gh_fu_json(f) order by f.resolved_at desc, f.id desc) from public.delivery_followups f
                       where f.status <> 'cho' and (p_branch is null or f.branch_id = p_branch) and left(coalesce(f.resolved_at, f.created_at), 7) = p_month), '[]'),
    'money', case when m then jsonb_build_object(
      'invoices', coalesce((select sum(total) from public.delivery_invoices where (p_branch is null or branch_id = p_branch) and left(work_date, 7) = p_month and doc_no is not null), 0),
      'n_invoices', (select count(*) from public.delivery_invoices where (p_branch is null or branch_id = p_branch) and left(work_date, 7) = p_month and doc_no is not null),
      'bu', coalesce((select sum(l.amount) from public.delivery_lines l join public.delivery_invoices i on i.id = l.invoice_id
                       where l.bu_followup_id is not null and (p_branch is null or i.branch_id = p_branch) and left(i.work_date, 7) = p_month and i.doc_no is not null), 0),
      'hd_bs', coalesce((select sum(f.resolved_amount) from public.delivery_followups f where f.kind = 'hd_bs' and f.status = 'xong' and (p_branch is null or f.branch_id = p_branch) and f.resolved_month = p_month), 0),
      'payable', public.app__nh_month_total(p_branch, p_month)) end,
    'kt', public.app_can('ke_toan'), 'today', public.app__nh_today());
end $$;

-- kho đã giao bù: chỉ ra dòng hàng trong phiếu xuất sau (cùng cơ sở) → dòng đó không tính tiền
create or replace function public.app_gh_bu_lines(p_followup bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f public.delivery_followups;
begin
  perform public.app__need('ke_toan');
  select * into f from public.delivery_followups where id = p_followup;
  if f.id is null then raise exception 'Không tìm thấy món chờ giao bù.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('line_id', l.id, 'invoice_id', i.id, 'doc_no', i.doc_no, 'work_date', i.work_date, 'name', l.name, 'unit', l.unit,
            'qty', l.qty_invoice, 'amount', l.amount, 'same', public.app__nh_norm(l.name) = public.app__nh_norm(f.name)) order by (public.app__nh_norm(l.name) = public.app__nh_norm(f.name)) desc, i.work_date desc, l.sort)
     from public.delivery_lines l join public.delivery_invoices i on i.id = l.invoice_id
    where i.branch_id = f.branch_id and i.id <> f.invoice_id and i.doc_no is not null and l.qty_invoice is not null and l.bu_followup_id is null
      and i.work_date >= left(f.created_at, 10)::date::text and i.work_date <= (left(f.created_at, 10)::date + 45)::text), '[]');
end $$;

create or replace function public.app_gh_fu_resolve(p_id bigint, p_line bigint, p_ref text, p_amount bigint, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; f public.delivery_followups; l public.delivery_lines; i public.delivery_invoices; t text := public.app__nh_today();
begin
  a := public.app__need('ke_toan');
  select * into f from public.delivery_followups where id = p_id for update;
  if f.id is null then raise exception 'Không tìm thấy.'; end if;
  if f.status <> 'cho' then raise exception 'Mục này đã xử lý rồi.'; end if;
  if f.kind = 'bu' then
    select * into l from public.delivery_lines where id = p_line for update;
    select * into i from public.delivery_invoices where id = l.invoice_id;
    if l.id is null or i.branch_id <> f.branch_id or i.doc_no is null then raise exception 'Chọn dòng hàng giao bù trong phiếu xuất của cùng cơ sở.'; end if;
    if l.bu_followup_id is not null then raise exception 'Dòng này đã được dùng cho món giao bù khác.'; end if;
    if public.app__fin_locked(i.branch_id, i.work_date) then raise exception 'Tháng của phiếu xuất này đã chốt.'; end if;
    update public.delivery_lines set bu_followup_id = f.id where id = l.id;
    update public.delivery_followups set status = 'xong', resolved_invoice_id = i.id, resolved_line_id = l.id, resolved_amount = l.amount, resolved_month = left(i.work_date, 7),
           resolved_at = public.vn_now_text(), resolved_by = a.id, note = nullif(trim(coalesce(p_note, '')), '') where id = f.id;
  else
    if trim(coalesce(p_ref, '')) = '' then raise exception 'Ghi số hoá đơn bổ sung.'; end if;
    if p_amount is null or p_amount < 0 then raise exception 'Nhập số tiền hoá đơn bổ sung.'; end if;
    if public.app__fin_locked(f.branch_id, t) then raise exception 'Tháng này đã chốt.'; end if;
    update public.delivery_followups set status = 'xong', resolved_ref = trim(p_ref), resolved_amount = p_amount, resolved_month = left(t, 7),
           resolved_at = public.vn_now_text(), resolved_by = a.id, note = nullif(trim(coalesce(p_note, '')), '') where id = f.id;
  end if;
  perform public.app_log('hang_hoa_kiem_soat', 'xong id=' || p_id);
end $$;

create or replace function public.app_gh_fu_cancel(p_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; f public.delivery_followups;
begin
  a := public.app__need('ke_toan');
  select * into f from public.delivery_followups where id = p_id for update;
  if f.id is null or f.status <> 'cho' then raise exception 'Mục này đã xử lý rồi.'; end if;
  if trim(coalesce(p_reason, '')) = '' then raise exception 'Ghi lý do huỷ.'; end if;
  update public.delivery_followups set status = 'huy', note = trim(p_reason), resolved_at = public.vn_now_text(), resolved_by = a.id where id = p_id;
  perform public.app_log('hang_hoa_kiem_soat', 'huy id=' || p_id);
end $$;

create or replace function public.app_gh_fu_undo(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; f public.delivery_followups;
begin
  a := public.app__need('ke_toan');
  select * into f from public.delivery_followups where id = p_id for update;
  if f.id is null or f.status = 'cho' then return; end if;
  if f.resolved_month is not null and public.app__fin_locked(f.branch_id, f.resolved_month || '-01') then raise exception 'Tháng này đã chốt.'; end if;
  update public.delivery_lines set bu_followup_id = null where bu_followup_id = f.id;
  update public.delivery_followups set status = 'cho', resolved_invoice_id = null, resolved_line_id = null, resolved_ref = null, resolved_amount = null, resolved_month = null,
         resolved_at = null, resolved_by = null where id = p_id;
end $$;

CREATE OR REPLACE FUNCTION public.app__storage_hd_upload(p_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  hd text[] := regexp_match(coalesce(p_name, ''), '^hd([0-9]+)/[^/]+$');
  nh text[] := regexp_match(coalesce(p_name, ''), '^nhan([0-9]+)/r([0-9]+)/[^/]+$');
  old_nh text[];
  iid bigint;
  rid bigint;
  a public.accounts := public.app_account();
begin
  if a.id is null then return false; end if;
  -- bước 104: ảnh nhận hàng ở trang Hàng hoá (không gắn phiếu ca): gh<id>/<tệp>
  if coalesce(p_name, '') ~ '^gh[0-9]+/[^/]+$' then
    iid := (regexp_match(p_name, '^gh([0-9]+)/'))[1]::bigint;
    return exists (select 1 from public.delivery_invoices i where i.id = iid and i.recon_at is null
      and (public.app_can('doi_soat') or (public.app_can('chot_ca') and ((i.state = 'dang_chuyen' and i.work_date <= public.app__nh_today()) or i.received_date = public.app__nh_today()))));
  end if;
  if hd is not null then
    return public.app_can('ke_toan')
      and exists (select 1 from public.delivery_invoices i where i.id = hd[1]::bigint);
  end if;
  if nh is not null then
    iid := nh[1]::bigint; rid := nh[2]::bigint;
    return exists (
      select 1 from public.delivery_invoices i
      join public.shift_reports r on r.id = rid and r.branch_id = i.branch_id
      join public.shift_report_parts pt on pt.report_id = r.id and pt.part = 'nhan_hang'
      where i.id = iid and i.recon_at is null
        and ((i.state = 'dang_chuyen' and i.work_date <= r.work_date)
          or i.received_report_id = r.id)
        and (public.app_can('doi_soat')
          or (pt.claimed_by = a.id and pt.done_at is null))
    );
  end if;
  -- Tương thích ngắn hạn với web cũ: vẫn buộc người gọi đang giữ phần
  -- nhận hàng của đúng phiếu ca; quản lý đối soát được làm thay.
  old_nh := regexp_match(coalesce(p_name, ''), '^nhan([0-9]+)/[^/]+$');
  if old_nh is null then return false; end if;
  iid := old_nh[1]::bigint;
  return exists (
    select 1 from public.delivery_invoices i
    where i.id = iid and i.recon_at is null
      and (public.app_can('doi_soat') or exists (
        select 1 from public.shift_reports r
        join public.shift_report_parts pt on pt.report_id = r.id and pt.part = 'nhan_hang'
        where r.id = i.received_report_id and r.branch_id = i.branch_id and r.status = 'dang_chot'
          and i.work_date <= r.work_date
          and pt.claimed_by = a.id and pt.done_at is null
      ))
  );
end $function$;

drop policy if exists hoa_don_xoa on storage.objects;
create policy hoa_don_xoa on storage.objects for delete to authenticated
  using (bucket_id = 'hoa-don' and (
    (name ~ '^hd[0-9]+/' and public.app_can('ke_toan'))
    or (name ~ '^(nhan|gh)[0-9]+/' and (owner_id = auth.uid()::text or public.app_can('doi_soat')
      or public.app_can('ke_toan') or public.app__storage_hd_upload(name)))
  ));

-- đối soát xong trước đây mà lệch → đưa vào danh sách theo dõi
do $x$ declare r record; begin
  for r in select id from public.delivery_invoices where recon_at is not null loop perform public.app__nh_followups(r.id); end loop;
end $x$;

revoke execute on function public.app__nh_followups(bigint), public.app__gh_can_edit(public.delivery_invoices), public.app__gh_fu_json(public.delivery_followups),
  public.app__nh_after_check(bigint, bigint), public.app__nh_month_total(bigint, text) from public, anon;
revoke execute on function public.app__nh_followups(bigint), public.app__gh_can_edit(public.delivery_invoices), public.app__gh_fu_json(public.delivery_followups),
  public.app__nh_after_check(bigint, bigint), public.app__nh_month_total(bigint, text) from authenticated;
revoke execute on function public.app_gh_inbox(bigint), public.app_gh_receive(bigint, jsonb, text), public.app_gh_receipt_save(bigint, bigint, jsonb, text),
  public.app_gh_photo_add(bigint, text, bigint[]), public.app_gh_photo_del(bigint), public.app_gh_control(bigint, text), public.app_gh_bu_lines(bigint),
  public.app_gh_fu_resolve(bigint, bigint, text, bigint, text), public.app_gh_fu_cancel(bigint, text), public.app_gh_fu_undo(bigint) from public, anon;
grant execute on function public.app_gh_inbox(bigint), public.app_gh_receive(bigint, jsonb, text), public.app_gh_receipt_save(bigint, bigint, jsonb, text),
  public.app_gh_photo_add(bigint, text, bigint[]), public.app_gh_photo_del(bigint), public.app_gh_control(bigint, text), public.app_gh_bu_lines(bigint),
  public.app_gh_fu_resolve(bigint, bigint, text, bigint, text), public.app_gh_fu_cancel(bigint, text), public.app_gh_fu_undo(bigint) to authenticated;

insert into public.app_migrations(file) values ('91_hang_hoa_rieng.sql') on conflict (file) do nothing;
