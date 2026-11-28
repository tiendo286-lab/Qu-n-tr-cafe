-- 197 (anh Tiến duyệt 28/11/2026): BỎ DẤU HOÀN THÀNH TREO của ca chưa từng đủ dấu 4 mục tiền (cả hệ thống có 1 ca: LHP Tối 11/11).
--  Ca được bấm Hoàn thành (stc_ca_done) ngày 22/11 khi chưa có dấu Thu chi / Công nợ. Máy chủ thấy stc_ca_done → chặn mọi ô tích
--  ("bấm Mở lại trước"); web chỉ coi ca là đã Hoàn thành khi đủ dấu 4 mục tiền (app_stc_month: done chỉ trả khi mdone) → bước 3 (nơi có nút
--  Mở lại) khoá vì bước 2 chưa xong → quản lý không làm tiếp được. Việc làm (một lần): bỏ stc_ca_done của các ca như vậy — đúng việc của nút
--  Mở lại (app__stc_undone_sys; phiếu lệch nhỏ tự tạo huỷ theo luật tệp 190, Hoàn thành lại thì tạo lại). Dấu phần việc + ô tích giữ nguyên.
--  Vùng khoá tiền đối soát (đã báo anh Tiến trong chat 28/11). Không đổi luật. Chạy lại nhiều lần không sao.
do $$
declare x record;
begin
  for x in
    select r.id from public.shift_reports r
     where r.status = 'hoan_thanh' and r.recon_status is distinct from 'hoan_thanh'
       and exists (select 1 from public.stc_ca_done d where d.report_id = r.id)
       and (select count(*) from public.shift_report_checks c where c.report_id = r.id and c.item = any(public.app__ca_money_items())) < cardinality(public.app__ca_money_items())
       and not public.app__fin_locked(r.branch_id, r.work_date)
  loop
    perform public.app__stc_undone_sys(x.id);
    insert into public.shift_recon_log(report_id, action, reason, by_account)
    values (x.id, 'mo_lai_hoan_thanh', 'Bỏ dấu Hoàn thành treo (ca chưa đủ dấu Thu chi / Công nợ nên trang đối soát khoá) — quản lý làm lại bước 2, 3 — tệp 197', null);
    perform public.app_log('bo_dau_hoan_thanh_treo_197', 'report=' || x.id);
  end loop;
end $$;

insert into public.app_migrations(file) values ('197_bo_dau_hoan_thanh_treo.sql') on conflict (file) do nothing;
