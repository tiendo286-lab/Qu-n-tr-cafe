-- 195 (anh Tiến duyệt 28/11/2026): KHÔI PHỤC DẤU TIỀN MẶT / CHUYỂN KHOẢN cho các ca bị mất dấu trong đợt mở lại hàng loạt 13/11.
--  Gốc lỗi: đợt 13/11 ("bỏ đối soát phần tiền toàn bộ để đối soát lại theo phương án mới") gỡ dấu (shift_report_checks) nhưng GIỮ kết quả
--  (shift_report_results). Khi Xác nhận Fabi lại, app_stc_ds_close thấy kết quả đã đúng số nên bỏ qua, không gọi app_ca_result_set → dấu không
--  bao giờ được đóng lại → ca đã bấm Hoàn thành vẫn treo "chưa đối soát" (bảng tuần Chốt ca: 🟠). Cả hệ thống chỉ có 3 ca (LHP 1–2/11).
--  Việc làm (một lần, KHÔNG đổi luật, KHÔNG đổi số tiền / phiếu nào): ca nhân viên đã gửi phiếu, quản lý đã bấm Hoàn thành (stc_ca_done),
--  chưa "Đã đối soát", tháng chưa chốt, mục tiền CÓ kết quả còn đúng với số đang tính (cùng điều kiện bỏ qua của app_stc_ds_close) mà THIẾU dấu
--  → đóng lại dấu (người đóng = người đã ghi kết quả; kết quả do web ghi thì dấu tự động), ghi nhật ký ca, rồi gọi app__ca_auto_finish như thường.
--  Vùng khoá tiền đối soát (đã báo anh Tiến trong chat 28/11). Chạy lại nhiều lần không sao (lần sau không còn ca nào khớp điều kiện).
do $$
declare x record; m jsonb; v bigint; res text; n int := 0; rids bigint[] := '{}'; rid bigint; rep text := '';
begin
  perform set_config('app.ca_auto', '1', true);
  for x in
    select r.id, r.branch_id, r.work_date, r.shift, s.item, s.result, s.amount, s.by_account
      from public.shift_reports r join public.shift_report_results s on s.report_id = r.id
     where r.status = 'hoan_thanh' and r.recon_status is distinct from 'hoan_thanh'
       and s.item in ('tien_mat', 'chuyen_khoan')
       and exists (select 1 from public.stc_ca_done d where d.report_id = r.id)
       and not exists (select 1 from public.shift_report_checks c where c.report_id = r.id and c.item = s.item)
       and not public.app__fin_locked(r.branch_id, r.work_date)
     order by r.work_date, r.id, s.item
  loop
    m := public.app__ca_money(x.id);
    v := coalesce((m ->> case x.item when 'tien_mat' then 'tm_left' else 'ck_left' end)::bigint, 0);
    res := case when v = 0 then 'khop' when v < 0 then 'thieu' else 'thua' end;
    continue when not ((x.result = res and coalesce(x.amount, 0) = abs(v)) or (x.result = 'khop' and abs(v) <= 5000));
    insert into public.shift_report_checks(report_id, item, checked_by, checked_at, auto)
    values (x.id, x.item, x.by_account, public.vn_now_text(), case when x.by_account is null then 1 else 0 end)
    on conflict (report_id, item) do nothing;
    insert into public.shift_recon_log(report_id, action, reason, by_account)
    values (x.id, 'khoi_phuc_dau', 'Đóng lại dấu ' || public.app__ca_item_label(x.item) || ' bị gỡ trong đợt mở lại 13/11 (kết quả vẫn đúng số) — tệp 195', null);
    n := n + 1; if not (x.id = any(rids)) then rids := rids || x.id; end if;
  end loop;
  foreach rid in array rids loop
    perform public.app__ca_auto_finish(rid, null);
    rep := rep || ' | ca ' || rid || ' → ' || (select recon_status from public.shift_reports where id = rid);
  end loop;
  perform set_config('app.ca_auto', '', true);
  if n > 0 then perform public.app_log('khoi_phuc_dau_tien_195', 'dau=' || n || rep); end if;
  --@@REPORT@@
end $$;

insert into public.app_migrations(file) values ('195_khoi_phuc_dau_tien_ca_cu.sql') on conflict (file) do nothing;
