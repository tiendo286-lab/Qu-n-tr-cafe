-- =====================================================================
-- BƯỚC 51: TỰ ĐỐI SOÁT KHI KẾ TOÁN ĐỦ SỐ (anh Tiến chốt 12/11/2026). Chạy sau 50. Chạy lại không sao.
--  * Khi ca đã gửi + có file chốt ca Fabi + đủ số dư ngân hàng (app__ca_kt_state.ready), web TỰ XÉT các hạng mục
--    như "Đèn đối soát" (doi_soat_den.js judge): mục XANH được tự duyệt (mục tiền = KHỚP) và KHOÁ (shift_report_checks.auto = 1).
--  * Mọi mục đều xong + nghỉ/làm thay đã duyệt (hoặc không cần) → tự HOÀN THÀNH ĐỐI SOÁT.
--  * Mục đã khoá: không bỏ duyệt / đổi kết quả / sửa số liệu liên quan được. Chỉ CHỦ mở khoá (ghi lý do) — app_ca_auto_unlock.
--  * Web xét lại sau khi lưu xong (trigger hoãn tới cuối giao dịch) mỗi khi: file Fabi được tải / áp vào phiếu, số dư ngân hàng đổi,
--    Chủ duyệt nghỉ & làm thay. Mục tự duyệt mà không còn xanh (vd tải lại file Fabi khác số) → web tự bỏ khoá, ca đã hoàn thành thì MỞ LẠI.
--  * Mở lại phiếu cho nhân viên sửa (app_ca_reopen) vẫn xoá hết như cũ.
-- =====================================================================

alter table public.shift_report_checks add column if not exists auto int not null default 0;

-- Thay bản 21: thêm tên các hạng mục không phải tiền
create or replace function public.app__ca_item_label(p text) returns text
language sql immutable as $$ select case p when 'tien_mat' then 'Tiền mặt' when 'chuyen_khoan' then 'Chuyển khoản' when 'thu_chi' then 'Thu chi'
  when 'cong_no' then 'Công nợ' when 'thoi_gian' then 'Thời gian doanh thu' when 'doanh_thu' then 'Doanh thu & số cốc'
  when 'nhan_su' then 'Nhân viên trong ca' when 'ban_giao' then 'Bàn giao ca sau' when 'nhap_hang' then 'Nhập hàng' else p end $$;

-- Trường số liệu (bản đối soát) gắn với từng hạng mục — mục khoá thì các trường này không sửa được
create or replace function public.app__ca_item_fields(p_item text) returns text[]
language sql immutable as $$
  select case p_item
    when 'thoi_gian' then array['rev_start', 'rev_end']
    when 'doanh_thu' then array['total_revenue', 'pos_cash', 'pos_transfer', 'cups', 'opening_cash']
    when 'tien_mat' then array['cash_counted', 'opening_cash', 'pos_cash', 'moves']
    when 'chuyen_khoan' then array['reported_transfer', 'pos_transfer', 'moves']
    when 'thu_chi' then array['moves']
    when 'nhan_su' then array['staff']
    when 'nhap_hang' then array['goods_status', 'goods_note', 'goods']
    else '{}'::text[] end
$$;

create or replace function public.app__ca_locked_items(p_id bigint) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(item order by item), '{}') from public.shift_report_checks where report_id = p_id and auto = 1
$$;

create or replace function public.app__ca_locked_fields(p_id bigint) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct f), '{}') from unnest(public.app__ca_locked_items(p_id)) i, unnest(public.app__ca_item_fields(i)) f
$$;

-- Hạng mục XANH theo cùng quy tắc với Đèn đối soát (doi_soat_den.js judge)
create or replace function public.app__ca_green(p_id bigint) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare e jsonb := public.app__ca_eff(p_id); m jsonb := public.app__ca_money(p_id); g text[] := '{}'; debt_new bigint; fx boolean; h jsonb;
begin
  -- Nhân viên: không ai nghỉ / làm hộ, hoặc Chủ đã duyệt nghỉ & làm thay
  if not exists (select 1 from jsonb_array_elements(coalesce(e -> 'staff', '[]')) s
                  where not coalesce((s ->> 'worked')::boolean, true) or coalesce(s ->> 'source', 'lich') <> 'lich')
     or public.app__cv_state(p_id) = 'da_duyet' then g := g || 'nhan_su'::text; end if;
  g := g || 'ban_giao'::text;
  if nullif(e ->> 'rev_start', '') is not null and nullif(e ->> 'rev_end', '') is not null and (e ->> 'rev_end') > (e ->> 'rev_start') then g := g || 'thoi_gian'::text; end if;
  select coalesce(sum(amount), 0) into debt_new from public.shift_debts where report_id = p_id and coalesce(kind, 'bill') <> 'muon';
  fx := exists (select 1 from public.fabi_shifts f where f.report_id = p_id and (jsonb_array_length(coalesce(f.diff, '[]')) > 0 or jsonb_array_length(coalesce(f.fixed, '[]')) > 0));
  h := public.app__ca_hand(p_id);
  if (e ->> 'total_revenue')::bigint = coalesce((e ->> 'pos_cash')::bigint, 0) + coalesce((e ->> 'pos_transfer')::bigint, 0) + debt_new
     and nullif(e ->> 'cups', '') is not null and coalesce(h ->> 'state', '') <> 'lech' and not fx then g := g || 'doanh_thu'::text; end if;
  if (m ->> 'tm_left')::bigint = 0 then g := g || 'tien_mat'::text; end if;
  if (m ->> 'ck_left')::bigint = 0 then g := g || 'chuyen_khoan'::text; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(e -> 'moves', '[]')) x where x ->> 'auto' is null) then g := g || 'thu_chi'::text; end if;
  g := g || 'cong_no'::text;
  return g;
end $$;

-- Tự xét một phiếu (không bao giờ làm hỏng việc đang làm: lỗi thì chỉ ghi nhật ký)
create or replace function public.app__ca_auto_green(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; k jsonb; g text[]; it text; dropped text[] := '{}'; added text[] := '{}'; m jsonb; n int;
begin
  select * into r from public.shift_reports where id = p_id;
  if r.id is null or r.status <> 'hoan_thanh' then return 'bo_qua'; end if;
  k := public.app__ca_kt_state(p_id);
  if not coalesce((k ->> 'need')::boolean, false) then return 'khong_dung_fabi'; end if;
  perform set_config('app.ca_auto', '1', true);
  g := case when (k ->> 'ready')::boolean then public.app__ca_green(p_id) else '{}'::text[] end;
  -- mục tự duyệt không còn xanh → bỏ khoá
  for it in select c.item from public.shift_report_checks c where c.report_id = p_id and c.auto = 1 and not (c.item = any(g)) loop
    delete from public.shift_report_results where report_id = p_id and item = it and by_account is null;
    delete from public.shift_report_checks where report_id = p_id and item = it;
    dropped := dropped || it;
  end loop;
  if cardinality(dropped) > 0 then
    insert into public.shift_recon_log(report_id, action, reason, by_account)
    values (p_id, 'tu_bo_khoa', 'Web xét lại theo file Fabi / ngân hàng: ' || (select string_agg(public.app__ca_item_label(x), ', ') from unnest(dropped) x) || ' không còn khớp', null);
    if r.recon_status = 'hoan_thanh' then
      update public.shift_reports set recon_status = 'mo_lai', recon_by = null, recon_at = null where id = p_id;
      insert into public.shift_recon_log(report_id, action, reason, by_account) values (p_id, 'mo_lai_doi_soat', 'Web xét lại: có mục không còn khớp', null);
      r.recon_status := 'mo_lai';
    end if;
  end if;
  if not (k ->> 'ready')::boolean or r.recon_status = 'hoan_thanh' then perform set_config('app.ca_auto', '', true); return 'chua_du'; end if;
  -- mục xanh chưa đối soát → tự duyệt + khoá
  m := public.app__ca_money(p_id);
  foreach it in array g loop
    if exists (select 1 from public.shift_report_checks where report_id = p_id and item = it) then continue; end if;
    if it = any(public.app__ca_money_items()) then
      insert into public.shift_report_results(report_id, item, result, amount, computed, basis, reason, by_account, at)
      values (p_id, it, 'khop', 0, case it when 'tien_mat' then (m ->> 'tm_left')::bigint when 'chuyen_khoan' then (m ->> 'ck_left')::bigint end,
              case when it = 'chuyen_khoan' then m ->> 'ck_basis' end, 'Web tự đối soát: khớp file Fabi và ngân hàng', null, public.vn_now_text())
      on conflict (report_id, item) do nothing;
    end if;
    insert into public.shift_report_checks(report_id, item, checked_by, checked_at, auto) values (p_id, it, null, public.vn_now_text(), 1)
    on conflict (report_id, item) do nothing;
    added := added || it;
  end loop;
  if cardinality(added) > 0 then
    insert into public.shift_recon_log(report_id, action, reason, by_account)
    values (p_id, 'tu_duyet', 'Web tự đối soát (khớp file Fabi và ngân hàng): ' || (select string_agg(public.app__ca_item_label(x), ', ') from unnest(added) x), null);
  end if;
  -- đủ mọi mục + nghỉ/làm thay xong → tự hoàn thành
  select count(*) into n from public.shift_report_checks where report_id = p_id;
  if r.recon_status in ('chua', 'mo_lai') and n >= array_length(public.app__ca_check_items(), 1)
     and (select count(*) from public.shift_report_results where report_id = p_id) >= array_length(public.app__ca_money_items(), 1)
     and public.app__cv_state(p_id) in ('khong_can', 'da_duyet') then
    insert into public.shift_report_recon(report_id, data, updated_by) values (p_id, public.app__recon_snapshot(p_id), null) on conflict (report_id) do nothing;
    update public.shift_reports set recon_status = 'hoan_thanh', recon_by = null, recon_at = public.vn_now_text() where id = p_id;
    insert into public.shift_recon_log(report_id, action, reason, by_account) values (p_id, 'hoan_thanh_doi_soat', 'Web tự hoàn thành: mọi mục khớp', null);
    perform set_config('app.ca_auto', '', true);
    return 'hoan_thanh';
  end if;
  perform set_config('app.ca_auto', '', true);
  return case when cardinality(added) > 0 then 'tu_duyet' else 'khong_doi' end;
exception when others then
  perform set_config('app.ca_auto', '', true);
  raise notice 'Tự đối soát phiếu % lỗi: %', p_id, sqlerrm;
  return 'loi: ' || sqlerrm;
end $$;

-- Trigger hoãn tới cuối giao dịch (mọi số đã ghi xong mới xét)
create or replace function public.app__ca_auto_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid bigint;
begin
  rid := case TG_TABLE_NAME
           when 'fabi_shifts' then coalesce(NEW.report_id, (select r.id from public.shift_reports r where r.branch_id = NEW.branch_id and r.work_date = NEW.work_date and r.shift = NEW.shift))
           when 'bank_account_balances' then coalesce(NEW.report_id, OLD.report_id)
           when 'shift_cover_reviews' then NEW.report_id end;
  if rid is not null then perform public.app__ca_auto_green(rid); end if;
  return null;
end $$;

drop trigger if exists ca_auto_fabi on public.fabi_shifts;
create constraint trigger ca_auto_fabi after insert or update on public.fabi_shifts
  deferrable initially deferred for each row execute function public.app__ca_auto_trg();
drop trigger if exists ca_auto_bank on public.bank_account_balances;
create constraint trigger ca_auto_bank after insert or update or delete on public.bank_account_balances
  deferrable initially deferred for each row execute function public.app__ca_auto_trg();
drop trigger if exists ca_auto_cover on public.shift_cover_reviews;
create constraint trigger ca_auto_cover after insert or update on public.shift_cover_reviews
  deferrable initially deferred for each row execute function public.app__ca_auto_trg();

-- Khoá: mục web tự duyệt không bỏ duyệt / đổi kết quả được (trừ web tự xét lại, Chủ mở khoá, mở lại phiếu cho nhân viên)
create or replace function public.app__ca_auto_lock_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.ca_auto', true), '') = '1'
     or not exists (select 1 from public.shift_reports r where r.id = OLD.report_id and r.status = 'hoan_thanh') then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;
  if exists (select 1 from public.shift_report_checks c where c.report_id = OLD.report_id and c.item = OLD.item and c.auto = 1) then
    raise exception 'Mục "%" web đã tự đối soát (khớp file Fabi và ngân hàng) nên đã KHOÁ. Chỉ Chủ mở khoá được (nút "Mở khoá" ở Đèn đối soát).',
      public.app__ca_item_label(OLD.item);
  end if;
  return case when TG_OP = 'DELETE' then OLD else NEW end;
end $$;
drop trigger if exists ca_auto_lock on public.shift_report_checks;
create trigger ca_auto_lock before update or delete on public.shift_report_checks for each row execute function public.app__ca_auto_lock_trg();
drop trigger if exists ca_auto_lock on public.shift_report_results;
create trigger ca_auto_lock before update or delete on public.shift_report_results for each row execute function public.app__ca_auto_lock_trg();

-- Thay bản 16: trường thuộc mục đã khoá giữ nguyên số cũ (không báo lỗi để ô tự lưu không vấp)
create or replace function public.app_ca_recon_save(p_id bigint, p jsonb, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; old jsonb; new jsonb := '{}'::jsonb; k text; v jsonb; reason text := nullif(trim(coalesce(p_reason, '')), '');
        lk text[];
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu chưa hoàn thành nên chưa đối soát được.'; end if;
  if r.recon_status = 'hoan_thanh' then raise exception 'Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.'; end if;
  lk := public.app__ca_locked_fields(p_id);   -- bước 51
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

-- Trang đối soát: mục nào web tự duyệt (khoá), trường nào khoá, ai mở khoá được
create or replace function public.app_ca_auto_locks(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app__need('doi_soat');
  return jsonb_build_object('items', to_jsonb(public.app__ca_locked_items(p_id)), 'fields', to_jsonb(public.app__ca_locked_fields(p_id)),
    'can_unlock', a.system_role = 'chu');
end $$;

-- Chủ mở khoá một mục web đã tự duyệt (ghi lý do) → mục trở lại chờ đối soát; ca đã hoàn thành thì mở lại
create or replace function public.app_ca_auto_unlock(p_id bigint, p_item text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; why text := nullif(trim(coalesce(p_reason, '')), '');
begin
  a := public.app__need('doi_soat');
  if a.system_role <> 'chu' then raise exception 'Chỉ Chủ mở khoá mục web đã tự đối soát.'; end if;
  if why is null then raise exception 'Ghi lý do mở khoá.'; end if;
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu.'; end if;
  if not exists (select 1 from public.shift_report_checks where report_id = p_id and item = p_item and auto = 1) then raise exception 'Mục này không bị khoá.'; end if;
  perform set_config('app.ca_auto', '1', true);
  delete from public.shift_report_results where report_id = p_id and item = p_item;
  delete from public.shift_report_checks where report_id = p_id and item = p_item;
  perform set_config('app.ca_auto', '', true);
  if r.recon_status = 'hoan_thanh' then
    update public.shift_reports set recon_status = 'mo_lai', recon_by = null, recon_at = null where id = p_id;
    insert into public.shift_recon_log(report_id, action, reason, by_account) values (p_id, 'mo_lai_doi_soat', 'Chủ mở khoá: ' || why, a.id);
  end if;
  insert into public.shift_recon_log(report_id, action, field, reason, by_account) values (p_id, 'mo_khoa', p_item, why, a.id);
  perform public.app_log('doi_soat_mo_khoa', 'report=' || p_id || ' ' || p_item);
end $$;

-- ---------------------------------------------------------------- Quyền gọi hàm
revoke execute on function public.app__ca_item_fields(text), public.app__ca_locked_items(bigint), public.app__ca_locked_fields(bigint),
  public.app__ca_green(bigint), public.app__ca_auto_green(bigint), public.app__ca_auto_trg(), public.app__ca_auto_lock_trg() from public, anon, authenticated;
revoke execute on function public.app_ca_recon_save(bigint, jsonb, text), public.app_ca_auto_locks(bigint), public.app_ca_auto_unlock(bigint, text, text) from public, anon;
grant execute on function public.app_ca_recon_save(bigint, jsonb, text), public.app_ca_auto_locks(bigint), public.app_ca_auto_unlock(bigint, text, text) to authenticated;

-- Xét ngay các phiếu đã gửi, chưa hoàn thành đối soát
do $$
declare x record;
begin
  for x in select id from public.shift_reports where status = 'hoan_thanh' and recon_status <> 'hoan_thanh' loop
    perform public.app__ca_auto_green(x.id);
  end loop;
end $$;
