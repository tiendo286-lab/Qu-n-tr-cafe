-- Bước 107 (anh Tiến chốt 15/11/2026): Hàng hoá › Phiếu xuất thiết kế lại.
--  * app_nh_replace: phiếu CHƯA NHẬN thì kế toán tải file mới thay thế (kho sửa phiếu) — chặn khi nhân viên đã bắt đầu nhận (có ảnh / hoá đơn giao / món ngoài phiếu / số đã đếm).
--  * app_nh_delete: chặn xoá khi nhân viên đang nhận hàng theo phiếu.
--  * app_nh_create: thông báo trỏ sang Hàng hoá › Nhận hàng / Đối soát (bỏ chữ "phiếu chốt ca mục 7").

create or replace function public.app__nh_started(p_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.delivery_receipt_photos where invoice_id = p_id)
      or exists (select 1 from public.delivery_invoices where id = p_id and (deliv_path is not null or deliv_note is not null))
      or exists (select 1 from public.delivery_lines where invoice_id = p_id and (qty_invoice is null or qty_received is not null))
$$;

create or replace function public.app_nh_delete(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i public.delivery_invoices; paths jsonb;
begin
  perform public.app__need('ke_toan');
  select * into i from public.delivery_invoices where id = p_id for update;
  if i.id is null then return '[]'; end if;
  if i.state <> 'dang_chuyen' then raise exception 'Hàng đã được báo nhận, không xoá phiếu xuất được.'; end if;
  if public.app__nh_started(p_id) then raise exception 'Nhân viên đang nhận hàng theo phiếu này — không xoá được.'; end if;
  select coalesce(jsonb_agg(path), '[]') into paths from (select path from public.delivery_invoice_files where invoice_id = p_id
                                                      union all select path from public.delivery_receipt_photos where invoice_id = p_id) x;
  delete from public.delivery_invoices where id = p_id;
  perform public.app_log('nhap_hang_xoa_hoa_don', 'id=' || p_id || ' ' || coalesce(i.doc_no, ''));
  return paths;
end $$;

create or replace function public.app_nh_replace(p_id bigint, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; i public.delivery_invoices; br bigint := nullif(p ->> 'branch_id', '')::bigint; dn text := nullif(trim(coalesce(p ->> 'doc_no', '')), '');
        sa text := nullif(trim(coalesce(p ->> 'ship_at', '')), ''); kc text := nullif(trim(coalesce(p ->> 'kho_code', '')), ''); x jsonb; k int := 0; paths jsonb; b public.branches;
begin
  a := public.app__need('ke_toan');
  select * into i from public.delivery_invoices where id = p_id for update;
  if i.id is null then raise exception 'Không tìm thấy phiếu xuất.'; end if;
  if i.state <> 'dang_chuyen' then raise exception 'Hàng đã được báo nhận — không thay phiếu được (lệch xử lý bằng giao bù / hoá đơn bổ sung).'; end if;
  if public.app__nh_started(p_id) then raise exception 'Nhân viên đang nhận hàng theo phiếu này — không thay phiếu được.'; end if;
  br := coalesce(br, i.branch_id);
  if not exists (select 1 from public.branches where id = br) then raise exception 'Chọn cơ sở nhận hàng.'; end if;
  if dn is null then raise exception 'File không có Số đơn.'; end if;
  if exists (select 1 from public.delivery_invoices where upper(doc_no) = upper(dn) and id <> p_id) then raise exception 'Phiếu % đã có (lần tải khác).', dn; end if;
  if sa is null or sa !~ '^\d{4}-\d{2}-\d{2}' then raise exception 'File không có Thời gian xuất hợp lệ.'; end if;
  if jsonb_array_length(coalesce(p -> 'lines', '[]')) = 0 then raise exception 'File không có dòng hàng nào.'; end if;
  select coalesce(jsonb_agg(path), '[]') into paths from public.delivery_invoice_files where invoice_id = p_id;
  delete from public.delivery_invoice_files where invoice_id = p_id;
  delete from public.delivery_lines where invoice_id = p_id;
  update public.delivery_invoices set branch_id = br, work_date = left(sa, 10), doc_no = dn, total = nullif(p ->> 'total', '')::bigint, ship_at = sa, kho_code = kc,
         kho_name = p ->> 'kho_name', ref = p ->> 'ref', src_creator = p ->> 'src_creator', updated_at = public.vn_now_text() where id = p_id;
  for x in select * from jsonb_array_elements(p -> 'lines') loop
    k := k + 1;
    insert into public.delivery_lines(invoice_id, sort, code, name, unit, qty_invoice, price, amount)
    values (p_id, k, nullif(trim(coalesce(x ->> 'code', '')), ''), coalesce(nullif(trim(coalesce(x ->> 'name', '')), ''), '(không tên)'), nullif(trim(coalesce(x ->> 'unit', '')), ''),
            coalesce(nullif(x ->> 'qty', '')::numeric, 0), nullif(x ->> 'price', '')::numeric::bigint, nullif(x ->> 'amount', '')::numeric::bigint);
  end loop;
  if kc is not null then
    insert into public.nh_kho_map(kho_code, kho_name, branch_id) values (kc, p ->> 'kho_name', br)
    on conflict (kho_code) do update set branch_id = excluded.branch_id, kho_name = excluded.kho_name;
  end if;
  select * into b from public.branches where id = br;
  perform public.app__nh_notify(br, 'Phiếu xuất ' || dn || ' đã được cập nhật · ' || coalesce(b.display_code, b.code),
    'Kế toán tải lại phiếu (kho sửa phiếu) · ' || k || ' món. Nhận hàng theo phiếu mới ở Hàng hoá › Nhận hàng.', '/hang-hoa/nhan?cn=' || br, true, false);
  perform public.app_log('nhap_hang_tai_lai', 'id=' || p_id || ' ' || coalesce(i.doc_no, '') || ' → ' || dn);
  return paths;
end $$;

CREATE OR REPLACE FUNCTION public.app_nh_create(p jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; br bigint := nullif(p ->> 'branch_id', '')::bigint; dn text := nullif(trim(coalesce(p ->> 'doc_no', '')), '');
        sa text := nullif(trim(coalesce(p ->> 'ship_at', '')), ''); kc text := nullif(trim(coalesce(p ->> 'kho_code', '')), '');
        mid bigint := nullif(p ->> 'merge_id', '')::bigint; nid bigint; x jsonb; k int := 0; tg public.delivery_invoices; lid bigint; n_mis int; b public.branches;
begin
  a := public.app__need('ke_toan');
  if br is null or not exists (select 1 from public.branches where id = br) then raise exception 'Chọn cơ sở nhận hàng.'; end if;
  if dn is null then raise exception 'File không có Số đơn.'; end if;
  if exists (select 1 from public.delivery_invoices where upper(doc_no) = upper(dn)) then raise exception 'Hóa đơn % đã tải lên rồi.', dn; end if;
  if sa is null or sa !~ '^\d{4}-\d{2}-\d{2}' then raise exception 'File không có Thời gian xuất hợp lệ.'; end if;
  if jsonb_array_length(coalesce(p -> 'lines', '[]')) = 0 then raise exception 'File không có dòng hàng nào.'; end if;
  if kc is not null then
    insert into public.nh_kho_map(kho_code, kho_name, branch_id) values (kc, p ->> 'kho_name', br)
    on conflict (kho_code) do update set branch_id = excluded.branch_id, kho_name = excluded.kho_name;
  end if;
  select * into b from public.branches where id = br;
  if mid is null then
    insert into public.delivery_invoices(branch_id, work_date, note, created_by, kind, state, doc_no, total, ship_at, kho_code, kho_name, ref, src_creator)
    values (br, left(sa, 10), nullif(trim(coalesce(p ->> 'note', '')), ''), a.id, 'hoa_don', 'dang_chuyen', dn, nullif(p ->> 'total', '')::bigint, sa, kc,
            p ->> 'kho_name', p ->> 'ref', p ->> 'src_creator') returning id into nid;
    for x in select * from jsonb_array_elements(p -> 'lines') loop
      k := k + 1;
      insert into public.delivery_lines(invoice_id, sort, code, name, unit, qty_invoice, price, amount)
      values (nid, k, nullif(trim(coalesce(x ->> 'code', '')), ''), coalesce(nullif(trim(coalesce(x ->> 'name', '')), ''), '(không tên)'), nullif(trim(coalesce(x ->> 'unit', '')), ''),
              coalesce(nullif(x ->> 'qty', '')::numeric, 0), nullif(x ->> 'price', '')::numeric::bigint, nullif(x ->> 'amount', '')::numeric::bigint);
    end loop;
    perform public.app__nh_notify(br, 'Hàng kho tổng đang chuyển tới ' || coalesce(b.display_code, b.code),
      'Phiếu xuất ' || dn || ' · ' || k || ' món. Hàng tới thì nhận ở Hàng hoá › Nhận hàng (chụp hàng → chụp hoá đơn giao → xác nhận).', '/hang-hoa/nhan?cn=' || br, true, false);
    perform public.app_log('nhap_hang_hoa_don', 'id=' || nid || ' ' || dn);
    return nid;
  end if;
  -- ghép vào phiếu nhận không hóa đơn
  select * into tg from public.delivery_invoices where id = mid for update;
  if tg.id is null or tg.state <> 'cho_hoa_don' then raise exception 'Phiếu nhận hàng cần ghép không còn ở trạng thái Chờ hóa đơn.'; end if;
  if tg.branch_id <> br then raise exception 'Hóa đơn này của cơ sở khác với phiếu nhận hàng.'; end if;
  for x in select * from jsonb_array_elements(p -> 'lines') loop
    k := k + 1; lid := null;
    select l.id into lid from public.delivery_lines l where l.invoice_id = mid and l.qty_invoice is null
       and ((nullif(trim(coalesce(x ->> 'code', '')), '') is not null and upper(l.code) = upper(trim(x ->> 'code')))
            or public.app__nh_norm(l.name) = public.app__nh_norm(x ->> 'name'))
     order by (upper(coalesce(l.code, '')) = upper(trim(coalesce(x ->> 'code', '')))) desc, l.id limit 1;
    if lid is not null then
      update public.delivery_lines set code = coalesce(nullif(trim(coalesce(x ->> 'code', '')), ''), code), name = coalesce(nullif(trim(coalesce(x ->> 'name', '')), ''), name),
             unit = coalesce(nullif(trim(coalesce(x ->> 'unit', '')), ''), unit), qty_invoice = coalesce(nullif(x ->> 'qty', '')::numeric, 0),
             price = nullif(x ->> 'price', '')::numeric::bigint, amount = nullif(x ->> 'amount', '')::numeric::bigint, sort = k where id = lid;
    else
      insert into public.delivery_lines(invoice_id, sort, code, name, unit, qty_invoice, price, amount, qty_received)
      values (mid, k, nullif(trim(coalesce(x ->> 'code', '')), ''), coalesce(nullif(trim(coalesce(x ->> 'name', '')), ''), '(không tên)'), nullif(trim(coalesce(x ->> 'unit', '')), ''),
              coalesce(nullif(x ->> 'qty', '')::numeric, 0), nullif(x ->> 'price', '')::numeric::bigint, nullif(x ->> 'amount', '')::numeric::bigint, 0);
    end if;
  end loop;
  update public.delivery_lines set sort = sort + 1000 where invoice_id = mid and qty_invoice is null;
  update public.delivery_invoices set kind = 'hoa_don', state = 'da_nhan', doc_no = dn, total = nullif(p ->> 'total', '')::bigint, ship_at = sa, kho_code = kc,
         kho_name = p ->> 'kho_name', ref = p ->> 'ref', src_creator = p ->> 'src_creator', matched_by = a.id, matched_at = public.vn_now_text(), updated_at = public.vn_now_text()
   where id = mid;
  select count(*) into n_mis from public.delivery_lines l where l.invoice_id = mid and l.qty_invoice is distinct from coalesce(l.qty_checked, l.qty_received)
     and not (l.qty_invoice is null and coalesce(l.qty_checked, l.qty_received, 0) = 0);
  if n_mis > 0 then
    perform public.app__nh_notify(br, 'Nhận hàng lệch hóa đơn ' || dn || ' · ' || coalesce(b.display_code, b.code),
      n_mis || ' món khác số lượng so với phiếu xuất (sau khi ghép vào lần nhận chưa có phiếu xuất).', '/hang-hoa/doi-soat?ds=' || mid, true, false);
  end if;
  perform public.app_log('nhap_hang_ghep_hoa_don', 'id=' || mid || ' ' || dn);
  return mid;
end $function$;

revoke execute on function public.app__nh_started(bigint) from public, anon, authenticated;
revoke execute on function public.app_nh_delete(bigint), public.app_nh_replace(bigint, jsonb), public.app_nh_create(jsonb) from public, anon;
grant execute on function public.app_nh_delete(bigint), public.app_nh_replace(bigint, jsonb), public.app_nh_create(jsonb) to authenticated;

insert into public.app_migrations(file) values ('93_phieu_xuat_tai_lai.sql') on conflict (file) do nothing;
