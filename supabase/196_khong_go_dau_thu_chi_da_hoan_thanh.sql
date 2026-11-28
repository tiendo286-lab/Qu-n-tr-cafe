-- 196 (anh Tiến duyệt 28/11/2026: "giữ luật, sửa lỗi gỡ dấu và chạy bù 4 ca"): MÁY KHÔNG TỰ GỠ DẤU THU CHI CỦA CA QUẢN LÝ ĐÃ BẤM HOÀN THÀNH.
--  Lỗi: dấu Thu chi do web tự đóng (auto = 1) khi ca chưa có phiếu tay. Quản lý thêm phiếu tay (vd Luân chuyển TM – CK) rồi Xác nhận Fabi +
--  Hoàn thành: app_stc_ds_close thấy đã có kết quả Thu chi nên không ghi lại → dấu vẫn là dấu tự động. Lần web xét lại sau đó
--  (27/11 11:05, lúc duyệt nghỉ / làm thay) app__ca_auto_green thấy Thu chi "không còn khớp" (có phiếu tay) → gỡ dấu + kết quả, mở lại ca;
--  dấu Hoàn thành (stc_ca_done) vẫn còn nên trang đối soát khoá mọi ô ("Ca đã hoàn thành đối soát — bấm Mở lại trước") trong khi ca tính là chưa xong.
--  Sửa (1): app__ca_auto_green — ca có stc_ca_done thì KHÔNG gỡ dấu tự động của mục thu_chi. Chỉ thêm một điều kiện; phần còn lại giữ nguyên bản
--    đang chạy (lấy bằng pg_get_functiondef 28/11). Quản lý bấm Mở lại (xoá stc_ca_done) thì luật cũ áp dụng lại. Máy KHÔNG có thêm quyền nào.
--  Sửa (2), một lần: các ca đã bị gỡ theo lỗi trên (có stc_ca_done, chưa "Đã đối soát", không còn kết quả Thu chi, nhật ký có dòng tu_bo_khoa
--    nhắc Thu chi, tháng chưa chốt) → ghi lại kết quả + dấu Thu chi như trước khi bị gỡ (web tự đóng), ghi nhật ký, gọi app__ca_auto_finish.
--  Vùng khoá tiền đối soát (đã báo anh Tiến trong chat 28/11). Không đổi số tiền / phiếu nào. Chạy lại nhiều lần không sao.

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

do $$
declare x record; n int := 0; rep text := '';
begin
  perform set_config('app.ca_auto', '1', true);
  for x in
    select r.id from public.shift_reports r
     where r.status = 'hoan_thanh' and r.recon_status is distinct from 'hoan_thanh'
       and exists (select 1 from public.stc_ca_done d where d.report_id = r.id)
       and not exists (select 1 from public.shift_report_results s where s.report_id = r.id and s.item = 'thu_chi')
       and not exists (select 1 from public.shift_report_checks c where c.report_id = r.id and c.item = 'thu_chi')
       and exists (select 1 from public.shift_recon_log l where l.report_id = r.id and l.action = 'tu_bo_khoa' and l.reason like '%Thu chi%')
       and not public.app__fin_locked(r.branch_id, r.work_date)
     order by r.work_date, r.id
  loop
    insert into public.shift_report_results(report_id, item, result, amount, computed, basis, reason, by_account, at)
    values (x.id, 'thu_chi', 'khop', 0, null, null, 'Web đóng lại dấu Thu chi đã gỡ nhầm (ca quản lý đã Hoàn thành) — tệp 196', null, public.vn_now_text())
    on conflict (report_id, item) do nothing;
    insert into public.shift_report_checks(report_id, item, checked_by, checked_at, auto) values (x.id, 'thu_chi', null, public.vn_now_text(), 1)
    on conflict (report_id, item) do nothing;
    insert into public.shift_recon_log(report_id, action, reason, by_account)
    values (x.id, 'khoi_phuc_dau', 'Đóng lại dấu Thu chi bị web gỡ nhầm sau khi quản lý đã Hoàn thành — tệp 196', null);
    perform public.app__ca_auto_finish(x.id, null);
    n := n + 1; rep := rep || ' | ca ' || x.id || ' → ' || (select recon_status from public.shift_reports where id = x.id);
  end loop;
  perform set_config('app.ca_auto', '', true);
  if n > 0 then perform public.app_log('khoi_phuc_dau_thu_chi_196', 'ca=' || n || rep); end if;
  --@@REPORT@@
end $$;

insert into public.app_migrations(file) values ('196_khong_go_dau_thu_chi_da_hoan_thanh.sql') on conflict (file) do nothing;
