-- Bài thử máy chủ cho supabase/132_so_thu_chi_gan_no.sql (đợt 3 Task 3: gán nợ khách trả cho ca dư — vùng khoá). Gửi CÙNG LẦN với 132; REPORT>> tự hoàn tác.
-- Ca thật LHP 108 (07/11, dư tiền mặt 20.000, đã chốt tiền); nợ 69 (ghi 02/11, còn 325.000); nợ 86 ghi 10/11 (sau ca). Ca 376 chưa chốt tiền.
do $$
declare chu public.accounts; nv public.accounts; rep text := ''; j jsonb; x jsonb; nid bigint;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select * into nv from public.accounts where system_role = 'nv' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  -- (a) gán 10.000 của nợ 69 → ca dư còn 10.000, nợ tách phần còn lại 315.000, có dòng thu nợ trong ca
  perform public.app_stc_gap_debt(108, 'tien_mat', 69, 10000, 'thử gán nợ');
  j := public.app_stc_month(1, '2026-11');
  x := (select i from jsonb_array_elements(j -> 'items') i where i ->> 'id' = 'g:108:tm');
  rep := rep || E'\n(a) gán nợ: ca dư còn ' || coalesce(x ->> 'amount', '?') || ' · gán ' || coalesce(jsonb_array_length(x -> 'gap' -> 'debts'), 0)
         || ' · thu nợ trong ca ' || (select count(*) from jsonb_array_elements(j -> 'items') i where i ->> 'id' = 'dc:69' and (i ->> 'ca_id')::bigint = 108)
         || ' · nợ còn lại ' || coalesce((select amount::text from public.shift_debts where split_from = 69 and closed_at is null order by id desc limit 1), 'không tách')
         || ' · Huỷ thu được ' || coalesce((select i ->> 'can_edit' from jsonb_array_elements(j -> 'items') i where i ->> 'id' = 'dc:69'), '?') || ' · ' || coalesce((select i ->> 'meta' from jsonb_array_elements(j -> 'items') i where i ->> 'id' = 'dc:69'), '')
         || ' · mục đã duyệt còn ' || (select count(*) from public.shift_report_results where report_id = 108);
  -- (b) gán quá phần còn lại / nợ ghi sau ca / ca chưa chốt
  begin perform public.app_stc_gap_debt(108, 'tien_mat', 68, 11000, 'x'); rep := rep || E'\n(b) KHÔNG chặn quá phần còn lại!';
  exception when others then rep := rep || E'\n(b) quá phần còn lại: ' || sqlerrm; end;
  begin perform public.app_stc_gap_debt(108, 'tien_mat', 86, 1000, 'x'); rep := rep || E'\n(b) KHÔNG chặn nợ ghi sau ca!';
  exception when others then rep := rep || E'\n(b) nợ ghi sau ca: ' || sqlerrm; end;
  begin perform public.app_stc_gap_debt(376, 'tien_mat', 68, 1000, 'x'); rep := rep || E'\n(b) KHÔNG chặn ca chưa chốt!';
  exception when others then rep := rep || E'\n(b) ca chưa chốt: ' || sqlerrm; end;
  begin perform public.app_stc_gap_debt(108, 'tien_mat', 68, 1000, ''); rep := rep || E'\n(b) KHÔNG bắt lý do!';
  exception when others then rep := rep || E'\n(b) thiếu lý do: ' || sqlerrm; end;
  -- (c) huỷ gán nợ → ca dư về 20.000, nợ 69 mở lại đủ 325.000
  perform public.app_stc_gap_undo('debt', 69, 'thử huỷ gán');
  j := public.app_stc_month(1, '2026-11');
  rep := rep || E'\n(c) huỷ gán: ca dư ' || coalesce((select i ->> 'amount' from jsonb_array_elements(j -> 'items') i where i ->> 'id' = 'g:108:tm'), '?')
         || ' · nợ 69 ' || (select case when closed_at is null then 'mở ' else 'đóng ' end || amount from public.shift_debts where id = 69)
         || ' · phần tách còn ' || (select count(*) from public.shift_debts where split_from = 69);
  -- (d) phiếu thu → gán nợ bị chặn
  perform public.app_stc_gap_thu(108, 'tien_mat', 1000, 'thử phiếu thu');
  begin perform public.app_stc_gap_debt(108, 'tien_mat', 69, 1000, 'x'); rep := rep || E'\n(d) KHÔNG chặn gán nợ sau phiếu thu!';
  exception when others then rep := rep || E'\n(d) sau phiếu thu: ' || sqlerrm; end;
  -- (e) nhân viên
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_stc_gap_debt(108, 'chuyen_khoan', 69, 1000, 'x'); rep := rep || E'\n(e) KHÔNG chặn nhân viên!';
  exception when others then rep := rep || E'\n(e) nhân viên: ' || sqlerrm; end;
  raise exception 'REPORT>> %', rep;
end $$;
