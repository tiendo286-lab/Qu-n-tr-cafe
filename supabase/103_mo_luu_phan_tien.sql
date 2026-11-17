-- Bước 121 (17/11/2026): bước Tiền ở phần Kiểm tra — 1 nút Mở, 1 nút Lưu (lưu cả gói, 1 lý do, lỗi thì không lưu gì)
-- Thiết kế: tai_lieu/superpowers/specs/2026-11-17-mo-luu-phan-tien-design.md · Kiểm tra: kiem_tra/audit_tien/t08_luu_ca_goi.sql
-- Chạy lại nhiều lần không sao.

-- p_changes: { fields: {...như app_ca_recon_save.p}, debts: [{op:'set',id,kind,name,amount,note} | {op:'remove',id}],
--              paid: [{op:'collect',debt,kind,amount} | {op:'update',debt,kind,amount} | {op:'uncollect',debt}],
--              to_exchange: [debt id], photos: [{op:'add',path} | {op:'del',id}] }
-- Cả hàm là 1 giao dịch: thao tác nào lỗi thì toàn bộ gói không được lưu.
create or replace function public.app_ca_recon_apply(p_id bigint, p_changes jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; why text := nullif(trim(coalesce(p_reason, '')), ''); c jsonb := coalesce(p_changes, '{}'::jsonb);
        x jsonb; it text; has boolean;
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu chưa gửi nên chưa sửa ở bước Kiểm tra được.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT — không sửa được.'; end if;
  has := coalesce(jsonb_typeof(c -> 'fields') = 'object' and c -> 'fields' <> '{}'::jsonb, false)
      or exists (select 1 from unnest(array['debts', 'paid', 'to_exchange', 'photos']) k where jsonb_typeof(c -> k) = 'array' and jsonb_array_length(c -> k) > 0);
  if not has then return jsonb_build_object('changed', false); end if;
  if why is null then raise exception 'Ghi lý do sửa trước khi lưu.'; end if;
  -- mục tiền đã duyệt → mở lại (Lưu xong phải Duyệt lại); mục web tự đối soát: chỉ Chủ
  for it in select c2.item from public.shift_report_checks c2
             where c2.report_id = p_id and c2.item in ('thoi_gian', 'doanh_thu', 'cong_no', 'thu_chi', 'tien_mat', 'chuyen_khoan') order by c2.item loop
    if exists (select 1 from public.shift_report_checks c3 where c3.report_id = p_id and c3.item = it and c3.auto = 1) and coalesce(a.system_role, '') <> 'chu' then
      raise exception 'Mục "%" web đã tự đối soát (khớp file Fabi và ngân hàng) — chỉ Chủ mở khoá được.', public.app__ca_item_label(it);
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
      perform public.app_ca_recon_debt_set(p_id, nullif(x ->> 'id', '')::bigint, x ->> 'kind', x ->> 'name', (x ->> 'amount')::bigint, nullif(x ->> 'note', ''), why);
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
  perform public.app_log('doi_soat_luu_phan_tien', 'report=' || p_id);
  return jsonb_build_object('changed', true);
end $$;

revoke all on function public.app_ca_recon_apply(bigint, jsonb, text) from public, anon;
grant execute on function public.app_ca_recon_apply(bigint, jsonb, text) to authenticated;

insert into public.app_migrations(file) values ('103_mo_luu_phan_tien.sql') on conflict (file) do nothing;
