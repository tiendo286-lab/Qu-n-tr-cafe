-- =====================================================================
-- BƯỚC 56: ĐỐI SOÁT — SỬA TỪNG MỤC (anh Tiến chốt 12/11/2026). Chạy sau 55. Chạy lại không sao.
--  * Mục đã đối soát (quản lý duyệt hoặc web tự duyệt) → nhạt đi, KHOÁ ô nhập liên quan (app_ca_recon_save giữ nguyên số cũ).
--  * Muốn sửa: bấm "Sửa" ở đúng mục, ghi lý do → chỉ mục đó mở lại (app_ca_item_reopen). Ai có quyền đối soát làm được;
--    mục web tự đối soát (theo file Fabi) vẫn chỉ Chủ mở.
--  * Duyệt lại mục đó → phiếu TỰ HOÀN THÀNH ĐỐI SOÁT (app__ca_auto_finish nhận cả trạng thái đang sửa).
--  * Bỏ nút "Hoàn thành đối soát" và "Mở lại đối soát" cả phiếu; riêng Chủ có "Mở lại cả phiếu" = mở lại mọi mục (app_ca_recon_reopen bản mới).
--  * Khoản âm: mở lại mục tiền không huỷ khoản âm ngay — chọn lại kết quả mới thay danh sách (như cũ). Khoản âm đã xử lý (đã bù / trừ lương xác nhận / miễn) thì không mở lại được.
-- =====================================================================

-- Thay bản 51: mọi mục đã đối soát đều khoá trường liên quan (không chỉ mục web tự duyệt)
create or replace function public.app__ca_locked_fields(p_id bigint) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct f), '{}') from public.shift_report_checks c, unnest(public.app__ca_item_fields(c.item)) f where c.report_id = p_id
$$;

-- Thay bản 39: tự hoàn thành cả khi đang sửa (mo_lai)
create or replace function public.app__ca_auto_finish(p_id bigint, p_acc bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; n int;
begin
  select * into r from public.shift_reports where id = p_id;
  select count(*) into n from public.shift_report_checks where report_id = p_id;
  if r.recon_status in ('chua', 'mo_lai') and n >= array_length(public.app__ca_check_items(), 1)
     and (select count(*) from public.shift_report_results where report_id = p_id) >= array_length(public.app__ca_money_items(), 1)
     and public.app__cv_state(p_id) in ('khong_can', 'da_duyet') then
    insert into public.shift_report_recon(report_id, data, updated_by) values (p_id, public.app__recon_snapshot(p_id), p_acc)
    on conflict (report_id) do nothing;
    update public.shift_reports set recon_status = 'hoan_thanh', recon_by = p_acc, recon_at = public.vn_now_text() where id = p_id;
    insert into public.shift_recon_log(report_id, action, by_account) values (p_id, 'hoan_thanh_doi_soat', p_acc);
  end if;
end $$;

-- Mở lại một mục (nội bộ)
create or replace function public.app__ca_item_reopen(p_id bigint, p_item text, p_acc bigint, p_why text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports;
begin
  select * into r from public.shift_reports where id = p_id;
  if exists (select 1 from public.shift_shortfalls where report_id = p_id and item = p_item
              and status in ('da_bu', 'tru_luong', 'mien') and not (status = 'tru_luong' and auto_tru)) then
    raise exception 'Mục "%": khoản âm đã được xử lý (đã bù / trừ lương / miễn) nên không mở lại được.', public.app__ca_item_label(p_item);
  end if;
  perform set_config('app.ca_auto', '1', true);
  delete from public.shift_report_results where report_id = p_id and item = p_item;
  delete from public.shift_report_checks where report_id = p_id and item = p_item;
  perform set_config('app.ca_auto', '', true);
  if r.recon_status = 'hoan_thanh' then
    update public.shift_reports set recon_status = 'mo_lai', recon_by = null, recon_at = null where id = p_id;
  end if;
  insert into public.shift_recon_log(report_id, action, field, reason, by_account) values (p_id, 'mo_lai_muc', p_item, p_why, p_acc);
end $$;

create or replace function public.app_ca_item_reopen(p_id bigint, p_item text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; why text := nullif(trim(coalesce(p_reason, '')), '');
begin
  a := public.app__need('doi_soat');
  if why is null then raise exception 'Ghi lý do sửa.'; end if;
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu ca chưa hoàn thành.'; end if;
  if not (p_item = any(public.app__ca_check_items())) then raise exception 'Hạng mục không hợp lệ.'; end if;
  if not exists (select 1 from public.shift_report_checks where report_id = p_id and item = p_item) then raise exception 'Mục này chưa đối soát — sửa trực tiếp được.'; end if;
  if exists (select 1 from public.shift_report_checks where report_id = p_id and item = p_item and auto = 1) and coalesce(a.system_role, '') <> 'chu' then
    raise exception 'Mục này web đã tự đối soát theo file Fabi và ngân hàng — chỉ Chủ mở lại được.';
  end if;
  perform public.app__ca_item_reopen(p_id, p_item, a.id, why);
  perform public.app_log('doi_soat_sua_muc', 'report=' || p_id || ' ' || p_item);
end $$;

-- Thay bản 16: CHỦ "Mở lại cả phiếu" = mở lại mọi mục (bỏ qua mục có khoản âm đã xử lý)
create or replace function public.app_ca_recon_reopen(p_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; why text := nullif(trim(coalesce(p_reason, '')), ''); it text; skip text[] := '{}';
begin
  a := public.app__need('doi_soat');
  if coalesce(a.system_role, '') <> 'chu' then raise exception 'Chỉ Chủ mở lại cả phiếu. Muốn sửa thì bấm "Sửa" ở đúng mục.'; end if;
  if why is null then raise exception 'Ghi lý do mở lại.'; end if;
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu ca chưa hoàn thành.'; end if;
  for it in select item from public.shift_report_checks where report_id = p_id loop
    begin
      perform public.app__ca_item_reopen(p_id, it, a.id, why);
    exception when others then skip := skip || it;
    end;
  end loop;
  update public.shift_reports set recon_status = 'mo_lai', recon_by = null, recon_at = null where id = p_id and recon_status = 'hoan_thanh';
  insert into public.shift_recon_log(report_id, action, reason, by_account)
  values (p_id, 'mo_lai_doi_soat', why || case when cardinality(skip) > 0 then ' (giữ: ' || (select string_agg(public.app__ca_item_label(x), ', ') from unnest(skip) x) || ' — khoản âm đã xử lý)' else '' end, a.id);
  perform public.app_log('mo_lai_doi_soat', 'report=' || p_id);
end $$;

-- Thay bản 51: thêm danh sách mục đã đối soát + ai là Chủ
create or replace function public.app_ca_auto_locks(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app__need('doi_soat');
  return jsonb_build_object('items', to_jsonb(public.app__ca_locked_items(p_id)), 'fields', to_jsonb(public.app__ca_locked_fields(p_id)),
    'done', coalesce((select jsonb_agg(item) from public.shift_report_checks where report_id = p_id), '[]'),
    'can_unlock', a.system_role = 'chu', 'is_chu', a.system_role = 'chu');
end $$;

revoke execute on function public.app__ca_locked_fields(bigint), public.app__ca_auto_finish(bigint, bigint), public.app__ca_item_reopen(bigint, text, bigint, text) from public, anon, authenticated;
revoke execute on function public.app_ca_item_reopen(bigint, text, text), public.app_ca_recon_reopen(bigint, text), public.app_ca_auto_locks(bigint) from public, anon;
grant execute on function public.app_ca_item_reopen(bigint, text, text), public.app_ca_recon_reopen(bigint, text), public.app_ca_auto_locks(bigint) to authenticated;

-- Phiếu đang "đối soát lại" mà đã đủ mục → tự hoàn thành (không còn nút Hoàn thành)
do $$
declare x record;
begin
  for x in select id from public.shift_reports where status = 'hoan_thanh' and recon_status = 'mo_lai' loop
    perform public.app__ca_auto_finish(x.id, null);
  end loop;
end $$;
