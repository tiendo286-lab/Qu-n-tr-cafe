-- Bài thử cho supabase/143_mo_lai_khong_ly_do.sql. Gửi riêng (trước 143: báo phải ghi lý do) hoặc sau 143. REPORT>> tự hoàn tác.
do $$
declare acc public.accounts; r public.shift_reports; rep text;
begin
  select * into acc from public.accounts where system_role = 'ql_tong' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', acc.auth_user_id, 'role', 'authenticated')::text, true);
  select x.* into r from public.shift_reports x where x.status = 'hoan_thanh' and x.work_date >= '2026-11-01' and not public.app__fin_locked(x.branch_id, x.work_date)
     and exists (select 1 from public.shift_report_checks c where c.report_id = x.id and c.item in ('tien_mat', 'chuyen_khoan')) order by x.work_date desc limit 1;
  begin
    perform public.app_stc_ds_reopen(r.id, null);
    rep := format('ca %s: mở lại KHÔNG ghi lý do ĐƯỢC · còn xác nhận=%s · nhật ký: %s', r.id, public.app__stc_ds_state(r.id) ->> 'done',
      (select reason from public.shift_recon_log where report_id = r.id order by id desc limit 1));
  exception when others then rep := format('ca %s: BỊ CHẶN — %s', r.id, sqlerrm);
  end;
  raise exception 'REPORT>> %', rep;
end $$;
