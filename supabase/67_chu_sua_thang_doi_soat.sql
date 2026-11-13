-- =====================================================================
-- BƯỚC 67: CHỦ SỬA THẲNG Ở TRANG ĐỐI SOÁT CA (anh Tiến chốt 13/11/2026). Chạy sau 66. Chạy lại không sao.
--  * Mục đã đối soát (kể cả web tự đối soát, phiếu đã HOÀN THÀNH ĐỐI SOÁT): Chủ bấm "Sửa" → chọn "Sửa thẳng", ghi lý do
--    → sửa số liệu của đúng mục đó, KHÔNG mở lại, phiếu giữ nguyên đối soát. Mỗi trường đổi ghi nhật ký (số cũ → số mới, lý do).
--  * Chỉ các mục có số liệu: Thời gian, Doanh thu, Tiền mặt, Chuyển khoản, Thu chi, Nhân viên, Nhập hàng. Bàn giao / Công nợ vẫn mở lại như cũ.
--  * Người khác vẫn như cũ: "Sửa" = mở lại mục đó để duyệt lại. Tháng đã chốt không sửa được.
-- =====================================================================

-- Thay bản 51: nhận chế độ sửa thẳng (app.ca_direct = danh sách trường được đổi, chỉ app_ca_recon_direct đặt)
create or replace function public.app_ca_recon_save(p_id bigint, p jsonb, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
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
      v := coalesce((select jsonb_agg(jsonb_build_object('kind', x ->> 'kind', 'amount', (x ->> 'amount')::bigint, 'note', coalesce(x ->> 'note', '')))
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
  if new is distinct from old then
    update public.shift_report_recon set data = new, updated_by = a.id, updated_at = public.vn_now_text() where report_id = p_id;
  end if;
end $$;

create or replace function public.app_ca_recon_direct(p_id bigint, p jsonb, p_reason text, p_items text[]) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; why text := nullif(trim(coalesce(p_reason, '')), ''); flds text[];
begin
  a := public.app__need('doi_soat');
  if coalesce(a.system_role, '') <> 'chu' then raise exception 'Chỉ Chủ sửa thẳng được. Bấm "Sửa" để mở lại mục rồi duyệt lại.'; end if;
  if why is null then raise exception 'Ghi lý do sửa.'; end if;
  select * into r from public.shift_reports where id = p_id;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu ca chưa hoàn thành.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không sửa được.'; end if;
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
end $$;

revoke execute on function public.app_ca_recon_save(bigint, jsonb, text), public.app_ca_recon_direct(bigint, jsonb, text, text[]) from public, anon;
grant execute on function public.app_ca_recon_save(bigint, jsonb, text), public.app_ca_recon_direct(bigint, jsonb, text, text[]) to authenticated;

insert into public.app_migrations(file) values ('67_chu_sua_thang_doi_soat.sql') on conflict (file) do nothing;
