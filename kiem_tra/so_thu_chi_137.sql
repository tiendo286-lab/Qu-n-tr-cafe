-- Bài thử cho supabase/137_xac_nhan_fabi_du_muc.sql. Gửi sau 137 ×2. REPORT>> tự hoàn tác.
do $$
declare chu public.accounts; rep text := ''; rid bigint; s text; n int := 0;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  -- Kết quả mong đợi (sau 137): ca có phần việc đã duyệt → việc 9/9 · đối soát hoan_thanh. Trước 137: 7/9 · chua.
  -- ca chưa xác nhận Fabi: phần việc đã duyệt hết (nhân sự, bàn giao, nhập hàng) thì sau xác nhận phải Hoàn thành đối soát
  for rid in select r.id from public.shift_reports r where r.status = 'hoan_thanh' and r.recon_status <> 'hoan_thanh' and r.work_date >= '2026-11-05'
               and not coalesce((public.app__stc_ds_state(r.id) ->> 'done')::boolean, false) order by r.work_date loop
    begin
      delete from public.shift_report_checks where report_id = rid and item in ('thoi_gian', 'doanh_thu');   -- giả như 2 mục chưa duyệt
      perform public.app_stc_ds_close(rid);
      select string_agg(item, ',' order by item) into s from public.shift_report_checks where report_id = rid;
      rep := rep || E'\nca ' || rid || ': việc ' || (select count(*) from public.shift_report_checks where report_id = rid) || '/9 (' || s || ') · đối soát '
             || (select recon_status from public.shift_reports where id = rid);
      n := n + 1; exit when n >= 3;
    exception when others then null;   -- ca có mục tự đối soát bị khoá / chờ kế toán: bỏ qua, thử ca khác
    end;
  end loop;
  raise exception 'REPORT>> %', rep;
end $$;
