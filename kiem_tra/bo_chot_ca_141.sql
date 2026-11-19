-- Bài thử cho supabase/141_bo_chot_ca_mo_khoa.sql. Gửi riêng (trước 141: QLT / QL bị chặn ở ca đối soát xong) hoặc sau 141 ×2. REPORT>> tự hoàn tác.
do $$
declare acc public.accounts; rep text := ''; r public.shift_reports; who text; st jsonb;
  procedure_try text;
begin
  rep := 'trigger stc_final_guard còn: ' || (select count(*) from pg_trigger where tgname = 'stc_final_guard')
      || ' · ca còn chốt: ' || (select count(*) from public.stc_ca_finals);
  foreach who in array array['ql_tong', 'ql', 'nv'] loop
    r := null;
    for acc in select * from public.accounts where system_role = who and auth_user_id is not null and coalesce(locked, 0) = 0 order by id loop
      perform set_config('request.jwt.claims', json_build_object('sub', acc.auth_user_id, 'role', 'authenticated')::text, true);
      -- ca đã xác nhận Fabi (ưu tiên ca đối soát xong cách cũ) mà người này có quyền cơ sở (nv: lấy ca bất kỳ)
      select x.* into r from public.shift_reports x
       where x.status = 'hoan_thanh' and x.work_date >= '2026-11-01' and not public.app__fin_locked(x.branch_id, x.work_date)
         and (who = 'nv' or public.app__stc_can(x.branch_id))
         and (x.recon_status = 'hoan_thanh' or exists (select 1 from public.shift_report_checks c where c.report_id = x.id and c.item in ('tien_mat', 'chuyen_khoan')))
       order by (x.recon_status = 'hoan_thanh') desc, x.work_date desc, x.id desc limit 1;
      exit when r.id is not null;
    end loop;
    begin
      perform public.app_stc_ds_reopen(r.id, 'bài thử 141');
      st := public.app__stc_ds_state(r.id);
      rep := rep || format(E'\n%s: mở lại ca %s ĐƯỢC · recon_status=%s · còn xác nhận=%s', who, r.id,
        (select recon_status from public.shift_reports where id = r.id), coalesce(st ->> 'done', '?'));
    exception when others then
      rep := rep || format(E'\n%s: mở lại ca %s BỊ CHẶN — %s', who, r.id, sqlerrm);
    end;
  end loop;
  -- Chốt ca mới: phải báo đã bỏ
  begin
    perform public.app_stc_ca_final(r.id);
    rep := rep || E'\nChốt ca: VẪN CHẠY';
  exception when others then rep := rep || E'\nChốt ca: ' || left(sqlerrm, 60);
  end;
  raise exception 'REPORT>> %', rep;
end $$;
