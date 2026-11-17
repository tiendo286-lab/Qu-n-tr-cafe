-- Bước 129: phiếu web đã tự đối soát (khớp file Fabi + ngân hàng) — Quản lý tổng và quản lý đối soát của cơ sở cũng Lưu / Sửa thẳng được
-- (trước chỉ Chủ). Lý do bắt buộc, có lịch sử như cũ; Chủ nhận thông báo khi người khác sửa. Quản lý cơ sở khác vẫn bị chặn. Anh chốt 17/11.
-- Chạy lại nhiều lần không sao.

-- Ai được mở / sửa mục web đã tự đối soát: Chủ, Quản lý tổng, quản lý đối soát của cơ sở (ô Đối soát ca trong Bảng phân công)
create or replace function public.app__ca_auto_ok(p_acc public.accounts, p_branch bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_acc.system_role, '') in ('chu', 'ql_tong')
      or (coalesce(p_acc.system_role, '') = 'ql' and p_acc.id = any(public.app__pc_who(1, 'branch', p_branch)))
$$;
revoke execute on function public.app__ca_auto_ok(public.accounts, bigint) from public, anon, authenticated;

-- Báo Chủ khi người khác sửa phiếu web đã tự đối soát
create or replace function public.app__ca_auto_notify(p_report bigint, p_acc bigint, p_why text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; x bigint;
begin
  select * into r from public.shift_reports where id = p_report;
  for x in select id from public.accounts where system_role = 'chu' and coalesce(locked, 0) = 0 and id <> p_acc loop
    perform public.app__notify(x, 'Quản lý sửa phiếu web đã tự đối soát',
      public.app__acc_name(p_acc) || ' · ' || public.app__ca_title(r) || ' · lý do: ' || p_why, '/ca/phieu?id=' || p_report || '&__ds=1');
  end loop;
end $$;
revoke execute on function public.app__ca_auto_notify(bigint, bigint, text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.app_ca_recon_apply(p_id bigint, p_changes jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; why text := nullif(trim(coalesce(p_reason, '')), ''); c jsonb := coalesce(p_changes, '{}'::jsonb);
        x jsonb; it text; has boolean; auto_hit boolean := false;
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu chưa gửi nên chưa sửa ở bước Kiểm tra được.'; end if;
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
  if auto_hit and coalesce(a.system_role, '') <> 'chu' then perform public.app__ca_auto_notify(p_id, a.id, why); end if;
  perform public.app_log('doi_soat_luu_phan_tien', 'report=' || p_id);
  return jsonb_build_object('changed', true);
end $function$
;

CREATE OR REPLACE FUNCTION public.app_ca_recon_direct(p_id bigint, p jsonb, p_reason text, p_items text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; why text := nullif(trim(coalesce(p_reason, '')), ''); flds text[];
begin
  a := public.app__need('doi_soat');
  -- bước 119: quản lý (có quyền đối soát) cũng Sửa thẳng được; mục web tự đối soát vẫn chỉ Chủ
  if why is null then raise exception 'Ghi lý do sửa.'; end if;
  select * into r from public.shift_reports where id = p_id;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu ca chưa hoàn thành.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không sửa được.'; end if;
  if exists (select 1 from public.shift_report_checks c where c.report_id = p_id and c.auto = 1 and c.item = any(p_items)) then
    if not public.app__ca_auto_ok(a, r.branch_id) then raise exception 'Mục web đã tự đối soát — chỉ Chủ, Quản lý tổng hoặc quản lý đối soát của cơ sở này sửa được.'; end if;
    if coalesce(a.system_role, '') <> 'chu' then perform public.app__ca_auto_notify(p_id, a.id, why); end if;
  end if;
  if p_items is null or cardinality(p_items) = 0 or exists (select 1 from unnest(p_items) x where not (x = any(public.app__ca_check_items()))) then raise exception 'Hạng mục không hợp lệ.'; end if;
  select coalesce(array_agg(distinct x), '{}') into flds from unnest(p_items) it, unnest(public.app__ca_item_fields(it)) x;
  if cardinality(flds) = 0 then raise exception 'Mục này không có số liệu để sửa thẳng — bấm "Sửa" để mở lại mục.'; end if;
  perform set_config('app.ca_direct', array_to_string(flds, ','), true);
  begin
    perform public.app_ca_recon_save(p_id, p, 'Chủ sửa thẳng: ' || why);
  exception when others then perform set_config('app.ca_direct', '', true); raise;
  end;
  perform set_config('app.ca_direct', '', true);
  perform public.app_log('doi_soat_sua_thang', 'report=' || p_id || ' ' || array_to_string(p_items, ','));
end $function$
;

revoke all on function public.app_ca_recon_apply(bigint, jsonb, text) from public, anon;
grant execute on function public.app_ca_recon_apply(bigint, jsonb, text) to authenticated;
revoke all on function public.app_ca_recon_direct(bigint, jsonb, text, text[]) from public, anon;
grant execute on function public.app_ca_recon_direct(bigint, jsonb, text, text[]) to authenticated;

insert into public.app_migrations(file) values ('113_ql_sua_phieu_tu_doi_soat.sql') on conflict (file) do nothing;
