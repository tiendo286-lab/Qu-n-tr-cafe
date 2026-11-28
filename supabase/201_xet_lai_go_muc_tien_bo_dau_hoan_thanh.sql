-- 201 (anh Tiến duyệt 28/11/2026 "làm tiếp lỗi 8"): WEB XÉT LẠI GỠ MỤC TIỀN CỦA CA ĐÃ HOÀN THÀNH THÌ BỎ LUÔN DẤU HOÀN THÀNH.
--  Web và máy chủ hiểu "ca đã Hoàn thành" khác nhau: máy chủ = có dòng stc_ca_done (chặn mọi ô tích / sửa: "bấm Mở lại trước"); web (app_stc_month,
--  tệp 167) chỉ trả 'done' khi đủ kết quả 4 mục tiền → thiếu một mục thì trang đối soát coi là chưa Hoàn thành, bắt đi lần lượt, bước 3 (nơi có
--  nút Mở lại) khoá vì bước 2 không tích được → ca kẹt (LHP Tối 11/11 — tệp 197; 4 ca LHP bị gỡ dấu 27/11 — tệp 196).
--  Đường còn tạo ra tình trạng này: app__ca_auto_green xét lại (kế toán sửa số ngân hàng / nạp lại file Fabi / duyệt nghỉ thay) thấy mục tiền web
--  tự đóng không còn khớp → gỡ dấu + kết quả, mở lại ca, nhưng để nguyên stc_ca_done.
--  Sửa: ngay sau khi gỡ, nếu ca có stc_ca_done mà không còn đủ kết quả 4 mục tiền → bỏ stc_ca_done (app__stc_undone_sys — đúng việc nút Mở lại;
--  phiếu lệch nhỏ tự tạo huỷ theo luật tệp 190) + ghi nhật ký ca. Quản lý thấy ca "chưa xong", xem lại bước 2 rồi Hoàn thành lại.
--  Máy KHÔNG tự bấm Hoàn thành; chỉ thêm một khối; phần còn lại giữ nguyên bản đang chạy (pg_get_functiondef 28/11, sau tệp 196).
--  Vùng khoá tiền đối soát (đã báo anh Tiến trong chat 28/11). Không đổi số tiền / quyền. Chạy lại nhiều lần không sao.

CREATE OR REPLACE FUNCTION public.app__ca_auto_green(p_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.shift_reports; k jsonb; g text[]; it text; dropped text[] := '{}'; added text[] := '{}'; m jsonb; n int;
begin
  select * into r from public.shift_reports where id = p_id;
  if r.id is null or r.status <> 'hoan_thanh' then return 'bo_qua'; end if;
  k := public.app__ca_kt_state(p_id);
  if not coalesce((k ->> 'need')::boolean, false) then return 'khong_dung_fabi'; end if;
  perform set_config('app.ca_auto', '1', true);
  g := case when (k ->> 'ready')::boolean then public.app__ca_green(p_id) else '{}'::text[] end;
  -- mục tự duyệt không còn xanh → bỏ khoá
  for it in select c.item from public.shift_report_checks c where c.report_id = p_id and c.auto = 1 and not (c.item = any(g))
               -- tệp 196: quản lý đã bấm Hoàn thành → không tự gỡ dấu Thu chi chỉ vì ca có phiếu thu chi tay (quản lý đã xem khi Hoàn thành)
               and not (c.item = 'thu_chi' and exists (select 1 from public.stc_ca_done dn where dn.report_id = p_id)) loop
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
    -- tệp 201: web gỡ mất một mục TIỀN của ca quản lý đã bấm Hoàn thành → bỏ luôn dấu Hoàn thành (như nút Mở lại). Nếu để lại, máy chủ chặn mọi ô
    --   ("bấm Mở lại trước") trong khi trang đối soát không hiện nút Mở lại (web chỉ nhận ca đã Hoàn thành khi đủ kết quả 4 mục tiền) → ca kẹt.
    if exists (select 1 from public.stc_ca_done dn where dn.report_id = p_id)
       and (select count(distinct s.item) from public.shift_report_results s where s.report_id = p_id and s.item = any(public.app__ca_money_items()))
           < cardinality(public.app__ca_money_items()) then
      perform public.app__stc_undone_sys(p_id);
      insert into public.shift_recon_log(report_id, action, reason, by_account)
      values (p_id, 'mo_lai_hoan_thanh', 'Web xét lại: mục tiền không còn khớp → bỏ dấu Hoàn thành, quản lý xem lại bước 2 rồi Hoàn thành lại', null);
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
  if r.recon_status in ('chua', 'mo_lai') and exists (select 1 from public.stc_ca_done dn where dn.report_id = p_id) and n >= array_length(public.app__ca_check_items(), 1)
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
end $function$;

insert into public.app_migrations(file) values ('201_xet_lai_go_muc_tien_bo_dau_hoan_thanh.sql') on conflict (file) do nothing;
