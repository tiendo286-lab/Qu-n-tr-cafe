-- Bước 106 (anh Tiến chốt 15/11/2026): Hàng hoá — món ngoài phiếu, chụp hoá đơn giao, quản lý XÁC NHẬN đối soát xong / mở lại, hoá đơn bù, nhắc quá ngày giao.
--  * Nhận hàng có phiếu: thêm món KHÔNG có trong phiếu (app_gh_extra_add / app_gh_extra_del) — dòng có qty_invoice trống.
--  * Bước cuối nhận hàng: chụp hoá đơn giao giấy (app_gh_deliv) hoặc "tài xế không mang hoá đơn giao" + ghi chú. app_gh_receive đòi có 1 trong 2.
--  * Đối soát không còn tự xong khi đủ món: quản lý bấm XÁC NHẬN XONG (app_gh_recon_done) — cần đủ món + ảnh hoá đơn giao hoặc hoá đơn bù
--    (kế toán tải: app_gh_bu_file). Mở lại (app_gh_recon_reopen) khi kế toán chưa xử lý mục Kiểm soát nào của lần giao.
--  * Món ngoài phiếu sau đối soát → Chờ hoá đơn bổ sung (chưa có giá, kế toán ghi số tiền).
--  * Nhắc hằng ngày: chỉ phiếu xuất quá ngày giao mà chưa nhận (báo quản lý cơ sở).

alter table public.delivery_invoices add column if not exists deliv_path text;
alter table public.delivery_invoices add column if not exists deliv_note text;
alter table public.delivery_invoices add column if not exists deliv_by bigint;
alter table public.delivery_invoices add column if not exists deliv_at text;
alter table public.delivery_invoices add column if not exists bu_path text;
alter table public.delivery_invoices add column if not exists bu_name text;
alter table public.delivery_invoices add column if not exists bu_by bigint;
alter table public.delivery_invoices add column if not exists bu_at text;

-- ---------------------------------------------------------------- món ngoài phiếu → chờ hoá đơn bổ sung
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
  if i.doc_no is null then return; end if;   -- chưa có phiếu xuất để so
  for l in select * from public.delivery_lines where invoice_id = p_inv and bu_followup_id is null loop
    q := coalesce(l.qty_checked, l.qty_received, 0);
    if exists (select 1 from public.delivery_followups f where f.line_id = l.id and f.status <> 'huy') then continue; end if;
    if l.qty_invoice is null then
      if q > 0 then   -- món ngoài phiếu: chưa có giá, kế toán ghi số tiền
        insert into public.delivery_followups(branch_id, invoice_id, line_id, kind, name, unit, qty, price, amount)
        values (i.branch_id, i.id, l.id, 'hd_bs', l.name, l.unit, q, null, null);
      end if;
      continue;
    end if;
    if q = l.qty_invoice then continue; end if;
    insert into public.delivery_followups(branch_id, invoice_id, line_id, kind, name, unit, qty, price, amount)
    values (i.branch_id, i.id, l.id, case when q < l.qty_invoice then 'bu' else 'hd_bs' end, l.name, l.unit, abs(l.qty_invoice - q), l.price,
            round(abs(l.qty_invoice - q) * coalesce(l.price, 0))::bigint);
  end loop;
end $$;

-- kế toán ghép phiếu xuất vào lần nhận không hoá đơn đã đối soát xong → tạo mục theo dõi
create or replace function public.app__nh_doc_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.recon_at is not null and new.doc_no is not null and old.doc_no is null then perform public.app__nh_followups(new.id); end if;
  return new;
end $$;
drop trigger if exists nh_doc_trg on public.delivery_invoices;
create trigger nh_doc_trg after update of doc_no on public.delivery_invoices for each row execute function public.app__nh_doc_trg();

-- đối soát không tự xong nữa (quản lý bấm Xác nhận xong); chỉ còn gỡ khi bỏ đối soát 1 món
create or replace function public.app__nh_after_check(p_inv bigint, p_acc bigint) returns void
language plpgsql security definer set search_path = public as $$
declare i public.delivery_invoices;
begin
  select * into i from public.delivery_invoices where id = p_inv;
  if i.recon_at is not null and exists (select 1 from public.delivery_lines where invoice_id = p_inv and checked_at is null) then
    update public.delivery_invoices set recon_by = null, recon_at = null where id = p_inv;
    delete from public.shift_report_checks where report_id = i.received_report_id and item = 'nhap_hang';
    perform public.app__nh_followups(p_inv);
  end if;
end $$;

create or replace function public.app_nh_check(p_line bigint, p_qty numeric, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; l public.delivery_lines; i public.delivery_invoices; r public.shift_reports; q numeric; nt text := nullif(trim(coalesce(p_note, '')), ''); b public.branches;
begin
  a := public.app__need('doi_soat');
  select * into l from public.delivery_lines where id = p_line for update;
  if l.id is null then raise exception 'Không tìm thấy món hàng.'; end if;
  select * into i from public.delivery_invoices where id = l.invoice_id;
  if i.state = 'dang_chuyen' then raise exception 'Nhân viên chưa báo nhận hàng này.'; end if;
  if i.recon_at is not null then raise exception 'Đã xác nhận đối soát xong — bấm "Mở lại đối soát" trước khi sửa.'; end if;
  select * into r from public.shift_reports where id = i.received_report_id;
  if r.recon_status = 'hoan_thanh' then raise exception 'Phiếu ca đã HOÀN THÀNH ĐỐI SOÁT. Mở lại đối soát trước khi sửa.'; end if;
  if p_qty is not null and p_qty < 0 then raise exception 'Số lượng không được âm.'; end if;
  q := coalesce(p_qty, l.qty_received, 0);
  if q is distinct from coalesce(l.qty_received, 0) and nt is null then raise exception 'Số khác với nhân viên báo — ghi chú lý do.'; end if;
  update public.delivery_lines set qty_checked = q, check_note = nt, checked_by = a.id, checked_at = public.vn_now_text() where id = p_line;
  if q is distinct from coalesce(l.qty_received, 0) and i.received_by is not null then
    select * into b from public.branches where id = i.branch_id;
    perform public.app__notify(i.received_by, 'Kiểm kê sai khi nhận hàng · ' || coalesce(b.display_code, b.code),
      l.name || ': bạn báo ' || trim(to_char(coalesce(l.qty_received, 0), 'FM999999990.###')) || ', quản lý đếm lại ' || trim(to_char(q, 'FM999999990.###'))
      || coalesce(' ' || l.unit, '') || '. Ghi chú: ' || nt, '/hang-hoa/nhan?cn=' || i.branch_id);
  end if;
  perform public.app__nh_after_check(i.id, a.id);
  return jsonb_build_object('qty', q, 'changed', q is distinct from coalesce(l.qty_received, 0));
end $$;

create or replace function public.app_nh_uncheck(p_line bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; l public.delivery_lines; i public.delivery_invoices; r public.shift_reports;
begin
  a := public.app__need('doi_soat');
  select * into l from public.delivery_lines where id = p_line for update;
  if l.id is null then return; end if;
  select * into i from public.delivery_invoices where id = l.invoice_id;
  if i.recon_at is not null then raise exception 'Đã xác nhận đối soát xong — bấm "Mở lại đối soát" trước khi sửa.'; end if;
  select * into r from public.shift_reports where id = i.received_report_id;
  if r.recon_status = 'hoan_thanh' then raise exception 'Phiếu ca đã HOÀN THÀNH ĐỐI SOÁT. Mở lại đối soát trước khi sửa.'; end if;
  update public.delivery_lines set qty_checked = null, check_note = null, checked_by = null, checked_at = null where id = p_line;
  perform public.app__nh_after_check(i.id, a.id);
end $$;

-- ---------------------------------------------------------------- nhân viên: món ngoài phiếu
create or replace function public.app_gh_extra_add(p_id bigint, p_lines jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; i public.delivery_invoices; x jsonb; k int; ids jsonb := '[]'; nid bigint;
begin
  a := public.app__need('chot_ca');
  select * into i from public.delivery_invoices where id = p_id for update;
  perform public.app__gh_can_edit(i);
  if i.state = 'cho_hoa_don' then raise exception 'Phiếu nhận chưa có phiếu xuất: ghi món như thường.'; end if;
  if jsonb_array_length(coalesce(p_lines, '[]')) = 0 then raise exception 'Ghi ít nhất 1 món.'; end if;
  select coalesce(max(sort), 0) into k from public.delivery_lines where invoice_id = p_id;
  for x in select * from jsonb_array_elements(p_lines) loop
    if trim(coalesce(x ->> 'name', '')) = '' then raise exception 'Món hàng phải có tên.'; end if;
    if nullif(x ->> 'qty', '') is null or (x ->> 'qty')::numeric <= 0 then raise exception 'Nhập số lượng cho món "%".', x ->> 'name'; end if;
    k := k + 1;
    insert into public.delivery_lines(invoice_id, sort, code, name, unit, qty_received)
    values (p_id, k, nullif(trim(coalesce(x ->> 'code', '')), ''), trim(x ->> 'name'), nullif(trim(coalesce(x ->> 'unit', '')), ''), (x ->> 'qty')::numeric) returning id into nid;
    ids := ids || to_jsonb(nid);
  end loop;
  perform public.app_log('hang_hoa_ngoai_phieu', 'id=' || p_id || ' thêm ' || jsonb_array_length(ids) || ' món');
  return ids;
end $$;

create or replace function public.app_gh_extra_del(p_line bigint) returns void
language plpgsql security definer set search_path = public as $$
declare l public.delivery_lines; i public.delivery_invoices;
begin
  if not (public.app_can('chot_ca') or public.app_can('doi_soat')) then raise exception 'Bạn không có quyền.'; end if;
  select * into l from public.delivery_lines where id = p_line;
  if l.id is null then return; end if;
  select * into i from public.delivery_invoices where id = l.invoice_id;
  perform public.app__gh_can_edit(i);
  if i.state = 'cho_hoa_don' or l.qty_invoice is not null then raise exception 'Chỉ xoá được món ngoài phiếu.'; end if;
  delete from public.delivery_photo_lines where line_id = p_line;
  delete from public.delivery_lines where id = p_line;
end $$;

-- ---------------------------------------------------------------- nhân viên: ảnh hoá đơn giao (hoặc không có + ghi chú)
create or replace function public.app_gh_deliv(p_id bigint, p_path text, p_note text) returns text
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); i public.delivery_invoices; old text;
begin
  if a.id is null or not (public.app_can('chot_ca') or public.app_can('doi_soat')) then raise exception 'Bạn không có quyền.'; end if;
  select * into i from public.delivery_invoices where id = p_id for update;
  perform public.app__gh_can_edit(i);
  old := i.deliv_path;
  if p_path is not null then
    if p_path !~ ('^gh' || p_id || '/[^/]+$') then raise exception 'Đường dẫn ảnh không hợp lệ.'; end if;
    update public.delivery_invoices set deliv_path = p_path, deliv_note = null, deliv_by = a.id, deliv_at = public.vn_now_text() where id = p_id;
  else
    if trim(coalesce(p_note, '')) = '' then raise exception 'Ghi chú vì sao không có hoá đơn giao.'; end if;
    update public.delivery_invoices set deliv_path = null, deliv_note = trim(p_note), deliv_by = a.id, deliv_at = public.vn_now_text() where id = p_id;
  end if;
  return case when old is distinct from p_path then old end;
end $$;

create or replace function public.app_gh_receive(p_id bigint, p_lines jsonb, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; i public.delivery_invoices; x jsonb; n_mis int; b public.branches;
begin
  a := public.app__need('chot_ca');
  select * into i from public.delivery_invoices where id = p_id for update;
  perform public.app__gh_can_edit(i);
  if i.state = 'cho_hoa_don' then raise exception 'Phiếu nhận không hoá đơn: dùng nút Lưu phiếu nhận.'; end if;
  if i.deliv_path is null and i.deliv_note is null then raise exception 'Chụp hoá đơn giao (hoặc bấm "Tài xế không mang hoá đơn giao") trước khi gửi.'; end if;
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
  select count(*) into n_mis from public.delivery_lines l where l.invoice_id = p_id and l.qty_invoice is distinct from l.qty_received
     and not (l.qty_invoice is null and coalesce(l.qty_received, 0) = 0);
  select * into b from public.branches where id = i.branch_id;
  perform public.app__nh_notify(i.branch_id, case when n_mis > 0 then 'Nhận hàng lệch phiếu ' else 'Đã nhận hàng ' end || coalesce(i.doc_no, '') || ' · ' || coalesce(b.display_code, b.code),
    public.app__acc_name(a.id) || case when n_mis > 0 then ' báo ' || n_mis || ' món khác phiếu xuất' else ' nhận đủ' end || ' — chờ quản lý đối soát.',
    '/hang-hoa/doi-soat?ds=' || p_id, true, n_mis > 0);
  perform public.app_log('hang_hoa_nhan', 'id=' || p_id || ' lệch ' || n_mis);
  return jsonb_build_object('mismatch', n_mis);
end $$;

-- ---------------------------------------------------------------- kế toán: hoá đơn bù (lần giao không có hoá đơn giao)
create or replace function public.app_gh_bu_file(p_id bigint, p_path text, p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare a public.accounts; i public.delivery_invoices; old text; b public.branches;
begin
  a := public.app__need('ke_toan');
  select * into i from public.delivery_invoices where id = p_id for update;
  if i.id is null then raise exception 'Không tìm thấy lần giao hàng.'; end if;
  if coalesce(p_path, '') !~ ('^hd' || p_id || '/[^/]+$') then raise exception 'Đường dẫn tệp không hợp lệ.'; end if;
  old := i.bu_path;
  update public.delivery_invoices set bu_path = p_path, bu_name = left(coalesce(p_name, 'hoa_don_bu'), 200), bu_by = a.id, bu_at = public.vn_now_text() where id = p_id;
  select * into b from public.branches where id = i.branch_id;
  perform public.app__nh_notify(i.branch_id, 'Đã có hoá đơn bù · ' || coalesce(i.doc_no, 'nhận không phiếu') || ' · ' || coalesce(b.display_code, b.code),
    'Kế toán đã tải hoá đơn bù — quản lý xác nhận đối soát xong được.', '/hang-hoa/doi-soat?ds=' || p_id, true, false);
  perform public.app_log('hang_hoa_hoa_don_bu', 'id=' || p_id);
  return case when old is distinct from p_path then old end;
end $$;

-- ---------------------------------------------------------------- quản lý: xác nhận đối soát xong / mở lại
create or replace function public.app_gh_recon_done(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; i public.delivery_invoices; n int; rid bigint;
begin
  a := public.app__need('doi_soat');
  select * into i from public.delivery_invoices where id = p_id for update;
  if i.id is null then raise exception 'Không tìm thấy lần giao hàng.'; end if;
  if i.state = 'dang_chuyen' then raise exception 'Nhân viên chưa báo nhận hàng này.'; end if;
  if i.recon_at is not null then raise exception 'Lần giao này đã xác nhận đối soát xong.'; end if;
  select count(*) into n from public.delivery_lines where invoice_id = p_id and checked_at is null;
  if n > 0 then raise exception 'Còn % món chưa đối soát.', n; end if;
  if i.deliv_path is null and i.bu_path is null then raise exception 'Chưa có hoá đơn giao — chờ kế toán tải hoá đơn bù rồi mới xác nhận xong.'; end if;
  update public.delivery_invoices set recon_by = a.id, recon_at = public.vn_now_text() where id = p_id;
  perform public.app__nh_followups(p_id);
  rid := i.received_report_id;   -- lần giao cũ còn gắn phiếu ca
  if rid is not null and not exists (select 1 from public.delivery_invoices d where d.received_report_id = rid and d.recon_at is null) then
    insert into public.shift_report_checks(report_id, item, checked_by, checked_at) values (rid, 'nhap_hang', a.id, public.vn_now_text()) on conflict (report_id, item) do nothing;
    perform public.app__ca_auto_finish(rid, a.id);
  end if;
  perform public.app_log('hang_hoa_doi_soat_xong', 'id=' || p_id);
  return jsonb_build_object(
    'bu', (select count(*) from public.delivery_followups where invoice_id = p_id and kind = 'bu' and status = 'cho'),
    'hd_bs', (select count(*) from public.delivery_followups where invoice_id = p_id and kind = 'hd_bs' and status = 'cho'));
end $$;

create or replace function public.app_gh_recon_reopen(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; i public.delivery_invoices;
begin
  a := public.app__need('doi_soat');
  select * into i from public.delivery_invoices where id = p_id for update;
  if i.id is null or i.recon_at is null then raise exception 'Lần giao này chưa xác nhận đối soát xong.'; end if;
  if exists (select 1 from public.delivery_followups f where f.invoice_id = p_id and f.status <> 'cho') then
    raise exception 'Kế toán đã xử lý món lệch của lần giao này — kế toán Hoàn tác ở tab Kiểm soát trước rồi mới mở lại.';
  end if;
  update public.delivery_invoices set recon_by = null, recon_at = null where id = p_id;
  delete from public.delivery_followups where invoice_id = p_id and status = 'cho';
  delete from public.shift_report_checks where report_id = i.received_report_id and item = 'nhap_hang';
  perform public.app_log('hang_hoa_mo_lai_doi_soat', 'id=' || p_id);
end $$;

-- ---------------------------------------------------------------- Kiểm soát: thêm "thiếu hoá đơn giao — cần hoá đơn bù"; món ngoài phiếu
create or replace function public.app__gh_fu_json(f public.delivery_followups) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', f.id, 'branch_id', f.branch_id, 'invoice_id', f.invoice_id, 'line_id', f.line_id, 'kind', f.kind, 'name', f.name, 'unit', f.unit,
    'qty', f.qty, 'price', case when public.app__nh_money() then f.price end, 'amount', case when public.app__nh_money() then f.amount end,
    'status', f.status, 'note', f.note, 'created_at', f.created_at, 'resolved_at', f.resolved_at, 'resolved_by', public.app__acc_name(f.resolved_by),
    'resolved_ref', f.resolved_ref, 'resolved_amount', case when public.app__nh_money() then f.resolved_amount end, 'resolved_month', f.resolved_month,
    'resolved_doc', (select d.doc_no from public.delivery_invoices d where d.id = f.resolved_invoice_id),
    'doc_no', (select d.doc_no from public.delivery_invoices d where d.id = f.invoice_id), 'work_date', (select d.work_date from public.delivery_invoices d where d.id = f.invoice_id),
    'extra', (select l.qty_invoice is null from public.delivery_lines l where l.id = f.line_id),
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
    'need_bu', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'branch_id', i.branch_id, 'doc_no', i.doc_no, 'kind', i.kind, 'work_date', i.work_date,
                          'received_at', i.received_at, 'received_by', public.app__acc_name(i.received_by), 'deliv_note', i.deliv_note) order by i.received_at, i.id)
                       from public.delivery_invoices i where i.recon_at is null and i.state <> 'dang_chuyen' and i.deliv_path is null and i.bu_path is null
                         and (p_branch is null or i.branch_id = p_branch)), '[]'),
    'money', case when m then jsonb_build_object(
      'invoices', coalesce((select sum(total) from public.delivery_invoices where (p_branch is null or branch_id = p_branch) and left(work_date, 7) = p_month and doc_no is not null), 0),
      'n_invoices', (select count(*) from public.delivery_invoices where (p_branch is null or branch_id = p_branch) and left(work_date, 7) = p_month and doc_no is not null),
      'bu', coalesce((select sum(l.amount) from public.delivery_lines l join public.delivery_invoices i on i.id = l.invoice_id
                       where l.bu_followup_id is not null and (p_branch is null or i.branch_id = p_branch) and left(i.work_date, 7) = p_month and i.doc_no is not null), 0),
      'hd_bs', coalesce((select sum(f.resolved_amount) from public.delivery_followups f where f.kind = 'hd_bs' and f.status = 'xong' and (p_branch is null or f.branch_id = p_branch) and f.resolved_month = p_month), 0),
      'payable', public.app__nh_month_total(p_branch, p_month)) end,
    'kt', public.app_can('ke_toan'), 'today', public.app__nh_today());
end $$;

-- ---------------------------------------------------------------- nhắc hằng ngày: chỉ phiếu xuất quá ngày giao mà chưa nhận
create or replace function public.app_nh_tick() returns integer
language plpgsql security definer set search_path = public as $$
declare today text := public.app__nh_today(); b record; n int := 0; c int; docs text;
begin
  if not (public.app_can('ke_toan') or public.app_can('doi_soat')) then return 0; end if;
  insert into public.notification_events(event_key, created_at) values ('nh_nhac:' || today, public.vn_now_text()) on conflict do nothing;
  if not found then return 0; end if;
  for b in select br.id, coalesce(br.display_code, br.code) code from public.branches br where br.status = 'Đang hoạt động' loop
    select count(*), string_agg(coalesce(i.doc_no, '#' || i.id), ', ' order by i.work_date) into c, docs from public.delivery_invoices i
     where i.branch_id = b.id and i.state = 'dang_chuyen' and i.work_date < today;
    if c > 0 then
      perform public.app__nh_notify(b.id, 'Phiếu xuất quá ngày giao chưa nhận · ' || b.code,
        c || ' phiếu (' || docs || ') đã qua ngày giao mà chưa ai báo nhận. Kiểm tra hàng đã tới chưa và nhận ở Hàng hoá › Nhận hàng.',
        '/hang-hoa/nhan?cn=' || b.id, true, false);
      n := n + c;
    end if;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- dữ liệu 1 lần giao: thêm hoá đơn giao / hoá đơn bù / món ngoài phiếu / đã xử lý ở Kiểm soát
CREATE OR REPLACE FUNCTION public.app__nh_json(i delivery_invoices, p_money boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare lines jsonb; photos jsonb; n_mis int; n_unph int; n_unchk int; n_lines int; miss text[] := '{}'; res text; today text := public.app__nh_today();
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'sort', l.sort, 'code', l.code, 'name', l.name, 'unit', l.unit,
           'qty_invoice', l.qty_invoice, 'price', case when p_money then l.price end, 'amount', case when p_money then l.amount end,
           'qty_received', l.qty_received, 'qty_checked', l.qty_checked, 'qty', coalesce(l.qty_checked, l.qty_received),
           'check_note', l.check_note, 'checked_by', public.app__acc_name(l.checked_by), 'checked_at', l.checked_at,
           'photos', (select count(*) from public.delivery_photo_lines pl where pl.line_id = l.id)) order by l.sort, l.id), '[]'),
         count(*),
         count(*) filter (where i.state <> 'dang_chuyen' and l.qty_invoice is distinct from coalesce(l.qty_checked, l.qty_received)
                           and not (l.qty_invoice is null and coalesce(l.qty_checked, l.qty_received, 0) = 0)),
         count(*) filter (where i.state <> 'dang_chuyen' and coalesce(l.qty_checked, l.qty_received, 0) > 0
                           and not exists (select 1 from public.delivery_photo_lines pl where pl.line_id = l.id)),
         count(*) filter (where i.state <> 'dang_chuyen' and l.checked_at is null)
    into lines, n_lines, n_mis, n_unph, n_unchk
    from public.delivery_lines l where l.invoice_id = i.id;
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'path', p.path, 'by', public.app__acc_name(p.created_by), 'at', p.created_at,
           'lines', coalesce((select jsonb_agg(pl.line_id) from public.delivery_photo_lines pl where pl.photo_id = p.id), '[]')) order by p.id), '[]')
    into photos from public.delivery_receipt_photos p where p.invoice_id = i.id;
  if i.state = 'dang_chuyen' and i.work_date < today then miss := miss || 'Chưa báo nhận hàng'::text; end if;
  if i.state = 'cho_hoa_don' then miss := miss || 'Thiếu hóa đơn'::text; end if;
  if n_unph > 0 then miss := miss || ('Thiếu ảnh ' || n_unph || ' món'); end if;
  if i.state <> 'dang_chuyen' and n_unchk > 0 then miss := miss || ('Chưa đối soát ' || n_unchk || ' món'); end if;
  res := case when i.state = 'dang_chuyen' then null when i.state = 'cho_hoa_don' then 'cho_hoa_don' when n_mis = 0 then 'du' else 'lech' end;
  return jsonb_build_object('id', i.id, 'kind', i.kind, 'state', i.state, 'result', res, 'doc_no', i.doc_no, 'branch_id', i.branch_id,
    'branch_code', (select coalesce(b.display_code, b.code) from public.branches b where b.id = i.branch_id),
    'work_date', i.work_date, 'ship_at', i.ship_at, 'kho_name', i.kho_name, 'ref', i.ref, 'src_creator', i.src_creator, 'note', i.note,
    'total', case when p_money then i.total end,
    'created_by', public.app__acc_name(i.created_by), 'created_at', i.created_at,
    'received_by', public.app__acc_name(i.received_by), 'received_by_id', i.received_by, 'received_at', i.received_at, 'received_date', i.received_date,
    'received_report_id', i.received_report_id, 'receive_note', i.receive_note,
    'received_shift', (select r.shift from public.shift_reports r where r.id = i.received_report_id),
    'recon_by', public.app__acc_name(i.recon_by), 'recon_at', i.recon_at, 'matched_at', i.matched_at,
    'staff_edit', i.state in ('da_nhan', 'cho_hoa_don') and i.recon_at is null and i.received_date = today,
    'lines', lines, 'photos', photos, 'n_lines', n_lines, 'n_mismatch', n_mis, 'n_unphoto', n_unph, 'n_unchecked', case when i.state = 'dang_chuyen' then 0 else n_unchk end,
    'missing', to_jsonb(miss), 'complete', i.state = 'da_nhan' and n_unph = 0 and n_unchk = 0,
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'path', f.path, 'name', f.name, 'mime', f.mime, 'size', f.size) order by f.id)
                       from public.delivery_invoice_files f where f.invoice_id = i.id), '[]'))
    || jsonb_build_object('deliv_path', i.deliv_path, 'deliv_note', i.deliv_note, 'deliv_by', public.app__acc_name(i.deliv_by), 'deliv_at', i.deliv_at,
         'bu_path', i.bu_path, 'bu_name', i.bu_name, 'bu_at', i.bu_at, 'has_doc', i.deliv_path is not null or i.bu_path is not null,
         'n_extra', case when i.doc_no is null then 0 else (select count(*) from public.delivery_lines l where l.invoice_id = i.id and l.qty_invoice is null and coalesce(l.qty_checked, l.qty_received, 0) > 0) end,
         'n_fu_done', (select count(*) from public.delivery_followups f where f.invoice_id = i.id and f.status <> 'cho'));   -- bước 106
end $function$;

revoke execute on function public.app__nh_followups(bigint), public.app__nh_doc_trg(), public.app__nh_after_check(bigint, bigint), public.app__gh_fu_json(public.delivery_followups),
  public.app__nh_json(public.delivery_invoices, boolean) from public, anon, authenticated;
revoke execute on function public.app_gh_extra_add(bigint, jsonb), public.app_gh_extra_del(bigint), public.app_gh_deliv(bigint, text, text), public.app_gh_receive(bigint, jsonb, text),
  public.app_gh_bu_file(bigint, text, text), public.app_gh_recon_done(bigint), public.app_gh_recon_reopen(bigint), public.app_gh_control(bigint, text),
  public.app_nh_check(bigint, numeric, text), public.app_nh_uncheck(bigint), public.app_nh_tick() from public, anon;
grant execute on function public.app_gh_extra_add(bigint, jsonb), public.app_gh_extra_del(bigint), public.app_gh_deliv(bigint, text, text), public.app_gh_receive(bigint, jsonb, text),
  public.app_gh_bu_file(bigint, text, text), public.app_gh_recon_done(bigint), public.app_gh_recon_reopen(bigint), public.app_gh_control(bigint, text),
  public.app_nh_check(bigint, numeric, text), public.app_nh_uncheck(bigint), public.app_nh_tick() to authenticated;

insert into public.app_migrations(file) values ('92_hang_hoa_hoa_don_giao.sql') on conflict (file) do nothing;
