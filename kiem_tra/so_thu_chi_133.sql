-- Bài thử máy chủ cho supabase/133_so_thu_chi_doi_soat.sql (đợt 4: Đối soát tiền 3 bước — vùng khoá). Gửi CÙNG LẦN với 133; REPORT>> tự hoàn tác.
-- Ca thật LHP 341 (17/11 Tối, chưa chốt tiền, đã có Fabi + ngân hàng), ca trước 305. Tự tạo lệch giả trong lúc thử.
do $$
declare chu public.accounts; nv public.accounts; rep text := ''; s jsonb; j jsonb; f0 bigint; oc bigint; c305 bigint;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select * into nv from public.accounts where system_role = 'nv' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  -- (a) doanh thu NV ghi khác Fabi → Sửa theo Fabi
  update public.shift_report_recon set data = data || jsonb_build_object('total_revenue', (public.app__ca_eff(341) ->> 'total_revenue')::bigint + 70000) where report_id = 341;
  if not found then insert into public.shift_report_recon(report_id, data) values (341, jsonb_build_object('total_revenue', (public.app__ca_eff(341) ->> 'total_revenue')::bigint + 70000)); end if;
  s := public.app__stc_ds_state(341);
  rep := rep || E'\n(a) doanh thu lệch: dt=' || (s ->> 'dt');
  begin perform public.app_stc_ds_close(341); rep := rep || ' · KHÔNG chặn chốt khi còn ô đỏ!';
  exception when others then rep := rep || ' · chốt khi còn đỏ: ' || sqlerrm; end;
  perform public.app_stc_ds_fabi(341, 'dt', null, 'NV gõ nhầm');
  s := public.app__stc_ds_state(341);
  rep := rep || ' · Sửa theo Fabi → dt=' || (s ->> 'dt') || ' · nhật ký ' || (select count(*) from public.shift_recon_log where report_id = 341 and reason like 'Sửa theo Fabi%');
  -- (b) mở ca: Fabi khác số phải là → Ca này ghi sai / huỷ / Ca trước ghi sai / huỷ
  update public.fabi_shifts set dau = (public.app__stc_exp_open(341) ->> 'exp')::bigint + 50000 where report_id = 341 or (report_id is null and branch_id = 1 and work_date = '2026-11-17' and shift = 'Tối');
  perform public.app_stc_ds_fabi(341, 'mo', null, 'theo Fabi');
  s := public.app__stc_ds_state(341);
  rep := rep || E'\n(b) mở ca lệch: mo1=' || (s ->> 'mo1') || ' mo2=' || (s ->> 'mo2');
  oc := (public.app__ca_eff(341) ->> 'opening_cash')::bigint;
  perform public.app_stc_ds_blame(341, 'nay', 'NV ca này đếm nhầm');
  s := public.app__stc_ds_state(341);
  rep := rep || ' · ca này chịu → mo2=' || (s ->> 'mo2') || ' · tiền đầu ca ' || oc || '→' || (public.app__ca_eff(341) ->> 'opening_cash');
  perform public.app_stc_ds_blame_undo(341, 'chọn lại');
  rep := rep || ' · huỷ → ' || (public.app__ca_eff(341) ->> 'opening_cash') || ' mo2=' || (public.app__stc_ds_state(341) ->> 'mo2');
  c305 := public.app__stc_real_tm(305);
  perform public.app_stc_ds_blame(341, 'truoc', 'ca trước để lại thừa');
  rep := rep || E'\n    ca trước chịu → két ca 305 ' || c305 || '→' || public.app__stc_real_tm(305) || ' · mục đã duyệt của 305 còn ' || (select count(*) from public.shift_report_results where report_id = 305);
  perform public.app_stc_ds_blame_undo(341, 'chọn lại');
  rep := rep || ' · huỷ → ' || public.app__stc_real_tm(305);
  perform public.app_stc_ds_blame(341, 'nay', 'chốt thử');
  -- (c) tiền thực nhận thu theo ca
  perform public.app_stc_ds_cash(341, 'ca', 5000000);
  rep := rep || E'\n(c) thu theo ca: ' || (select cash_mode || ' ' || ql_counted from public.shift_reports where id = 341);
  -- (d) chốt → đã chốt, sổ thấy ca đã chốt; sửa sau chốt bị chặn; mở lại
  j := public.app_stc_ds_close(341);
  j := public.app_stc_month(1, '2026-11');
  rep := rep || E'\n(d) chốt: done=' || (public.app__stc_ds_state(341) ->> 'done') || ' · sổ: ' || coalesce((select c ->> 'recon_money_done' from jsonb_array_elements(j -> 'cas') c where (c ->> 'id')::bigint = 341), '?')
         || ' · ca có blame ' || coalesce((select (c -> 'blame' ->> 'who') from jsonb_array_elements(j -> 'cas') c where (c ->> 'id')::bigint = 341), '-')
         || ' · lệch TM ' || coalesce((select string_agg(i ->> 'amount', ',') from jsonb_array_elements(j -> 'items') i where i ->> 'id' = 'g:341:tm'), 'không');
  begin perform public.app_stc_ds_fabi(341, 'dt', null, 'x'); rep := rep || ' · KHÔNG chặn sửa sau chốt!';
  exception when others then rep := rep || ' · sửa sau chốt: ' || sqlerrm; end;
  begin perform public.app_stc_ds_reopen(341, ''); rep := rep || ' · KHÔNG bắt lý do mở lại!';
  exception when others then rep := rep || ' · mở lại thiếu lý do: ' || sqlerrm; end;
  perform public.app_stc_ds_reopen(341, 'nhập lại tiền');
  rep := rep || ' · mở lại → done=' || (public.app__stc_ds_state(341) ->> 'done');
  -- (e) nhân viên
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_stc_ds_close(341); rep := rep || E'\n(e) KHÔNG chặn nhân viên!';
  exception when others then rep := rep || E'\n(e) nhân viên: ' || sqlerrm; end;
  raise exception 'REPORT>> %', rep;
end $$;
