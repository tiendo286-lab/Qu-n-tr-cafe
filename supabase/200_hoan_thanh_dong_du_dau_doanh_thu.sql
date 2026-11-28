-- 200 (anh Tiến duyệt 28/11/2026: "làm tiếp lỗi 7, chạy thử rồi chạy thật"): NÚT HOÀN THÀNH (trang đối soát ca mới) ĐÓNG ĐỦ DẤU THỜI GIAN + DOANH THU.
--  app_ds2_finish: ca chưa đủ 4 mục tiền → gọi app_stc_ds_close (đóng cả dấu Thời gian doanh thu + Doanh thu); ca ĐÃ đủ 4 mục tiền từ trước
--  (web tự đóng khi khớp file Fabi / ngân hàng) → đi nhánh còn lại, KHÔNG đóng 2 dấu đó. Ca có Doanh thu chưa "tự khớp" lúc ấy (Fabi có hoá đơn
--  sửa / xoá — quản lý đã tích "Đã hỏi về hoá đơn bị sửa / xoá"; hoặc mở ca lệch vừa được ghi lý do) → Hoàn thành xong vẫn thiếu dấu Doanh thu,
--  ca treo (bảng tuần Chốt ca: "Thiếu dấu: Doanh thu & số cốc"). 28/11 có 11 ca (5 ĐK, 4 HS, 2 LHP).
--  Sửa (1): nhánh "đã đủ 4 mục tiền" cũng đóng 2 dấu đó nếu thiếu — đúng việc app_stc_ds_close vẫn làm. Chỉ thêm một vòng lặp; phần còn lại
--    giữ nguyên bản đang chạy (pg_get_functiondef 28/11, sau tệp 199).
--  Sửa (2), một lần: ca có stc_ca_done, chưa "Đã đối soát", đủ dấu 4 mục tiền, thiếu dấu Thời gian / Doanh thu, tháng chưa chốt → đóng dấu
--    (người đóng = người đã bấm Hoàn thành), ghi nhật ký, gọi app__ca_auto_finish. Ca còn chờ Chủ duyệt x2 thì vẫn chờ.
--  Vùng khoá tiền đối soát (đã báo anh Tiến trong chat 28/11). Không đổi số tiền / phiếu nào. Chạy lại nhiều lần không sao.

CREATE OR REPLACE FUNCTION public.app_ds2_finish(p_report bigint, p_parts text[], p_ticks text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.shift_reports; it text; left_parts text[]; m jsonb; v bigint; res text;
begin
  perform set_config('app.ds_moi', '1', true);
  r := public.app__stc_ds_need(p_report, false);
  perform 1 from public.shift_reports where id = p_report for update;
  if exists (select 1 from public.stc_ca_done where report_id = p_report) then
    return jsonb_build_object('done', true, 'recon_status', r.recon_status, 'already', true);
  end if;
  perform public.app_ds2_work_ok(p_report, p_parts);
  left_parts := array(select public.app__ca_item_label(q.u) from unnest(array['nhan_su', 'ban_giao', 'nhap_hang']) with ordinality q(u, o)
                       where not exists (select 1 from public.shift_report_checks c where c.report_id = p_report and c.item = q.u)
                         and (q.u <> 'nhap_hang' or exists (select 1 from public.delivery_invoices d where d.received_report_id = p_report))
                       order by q.o);
  if cardinality(left_parts) > 0 then raise exception 'Phần việc chưa duyệt: %', array_to_string(left_parts, ', '); end if;
  if not coalesce((public.app__stc_ds_state(p_report) ->> 'done')::boolean, false) then
    perform public.app_stc_ds_close(p_report);
  else   -- đã đủ 4 mục tiền từ trước: ghi lại tiền mặt / chuyển khoản theo số mới khi khác (như Xác nhận Fabi cũ ghi),
         -- trừ mục web tự duyệt (khoá, chỉ Chủ mở) và mục đã xử lý lệch (giữ như trang cũ)
    m := public.app__ca_money(p_report);
    foreach it in array array['tien_mat', 'chuyen_khoan'] loop
      v := (m ->> case it when 'tien_mat' then 'tm_left' else 'ck_left' end)::bigint;
      res := case when coalesce(v, 0) = 0 then 'khop' when v < 0 then 'thieu' else 'thua' end;
      continue when exists (select 1 from public.shift_report_results x where x.report_id = p_report and x.item = it
                     and ((x.result = res and coalesce(x.amount, 0) = abs(coalesce(v, 0))) or (x.result = 'khop' and abs(coalesce(v, 0)) <= 5000)));
      continue when exists (select 1 from public.shift_report_checks c where c.report_id = p_report and c.item = it and c.auto = 1);
      continue when exists (select 1 from public.shift_shortfalls s where s.report_id = p_report and s.item = it and s.status <> 'huy')
                 or exists (select 1 from public.gap_decisions g where g.report_id = p_report and g.item = it)
                 or exists (select 1 from public.gap_matches mm where mm.item = it and (mm.short_report = p_report or mm.over_report = p_report) and mm.status in ('da_duyet', 'cho_duyet'));
      perform public.app_ca_result_set(p_report, it, res, abs(coalesce(v, 0)),
        case when res = 'khop' then null else 'Hoàn thành (trang đối soát ca mới) — ghi lại theo số mới, lệch xử lý ở phiếu chênh lệch' end, '[]'::jsonb);
    end loop;
    -- tệp 200: đường này (đã đủ 4 mục tiền từ trước, vd web tự đóng) trước đây bỏ sót dấu Thời gian doanh thu + Doanh thu mà Xác nhận Fabi
    --   (app_stc_ds_close) vẫn đóng → ca Hoàn thành xong vẫn treo "thiếu dấu Doanh thu". Nay đóng như app_stc_ds_close.
    foreach it in array array['thoi_gian', 'doanh_thu'] loop
      if not exists (select 1 from public.shift_report_checks c where c.report_id = p_report and c.item = it) then
        perform public.app_ca_check(p_report, it, true);
      end if;
    end loop;
  end if;
  foreach it in array coalesce(p_ticks, '{}'::text[]) loop
    if it = any(array['anh', 'sot', 'that', 'goi']) then perform public.app_stc_tick(p_report, it, true); end if;
  end loop;
  perform public.app_stc_ds_done(p_report);
  select * into r from public.shift_reports where id = p_report;
  perform public.app_log('ds2_hoan_thanh', 'report=' || p_report);
  return jsonb_build_object('done', true, 'recon_status', r.recon_status);
end $function$;

do $$
declare x record; n int := 0; rids bigint[] := '{}'; bys bigint[] := '{}'; i int; rep text := '';
begin
  perform set_config('app.ca_auto', '1', true);
  for x in
    select r.id, d.by_account, it.item
      from public.shift_reports r join public.stc_ca_done d on d.report_id = r.id cross join (values ('thoi_gian'), ('doanh_thu')) it(item)
     where r.status = 'hoan_thanh' and r.recon_status is distinct from 'hoan_thanh'
       and (select count(*) from public.shift_report_checks c where c.report_id = r.id and c.item = any(public.app__ca_money_items())) >= cardinality(public.app__ca_money_items())
       and not exists (select 1 from public.shift_report_checks c where c.report_id = r.id and c.item = it.item)
       and not public.app__fin_locked(r.branch_id, r.work_date)
     order by r.work_date, r.id, it.item
  loop
    insert into public.shift_report_checks(report_id, item, checked_by, checked_at) values (x.id, x.item, x.by_account, public.vn_now_text())
    on conflict (report_id, item) do nothing;
    insert into public.shift_recon_log(report_id, action, reason, by_account)
    values (x.id, 'khoi_phuc_dau', 'Đóng dấu ' || public.app__ca_item_label(x.item) || ' mà nút Hoàn thành đã bỏ sót (ghi theo người đã bấm Hoàn thành) — tệp 200', null);
    n := n + 1;
    if not (x.id = any(rids)) then rids := rids || x.id; bys := bys || coalesce(x.by_account, 0); end if;
  end loop;
  for i in 1 .. cardinality(rids) loop
    perform public.app__ca_auto_finish(rids[i], nullif(bys[i], 0));
    rep := rep || ' | ' || rids[i] || '→' || (select recon_status from public.shift_reports where id = rids[i]) || '(x2 ' || coalesce(public.app__cv_state(rids[i]), '') || ')';
  end loop;
  perform set_config('app.ca_auto', '', true);
  if n > 0 then perform public.app_log('dong_dau_doanh_thu_200', left('dau=' || n || rep, 900)); end if;
  --@@REPORT@@
end $$;

insert into public.app_migrations(file) values ('200_hoan_thanh_dong_du_dau_doanh_thu.sql') on conflict (file) do nothing;
