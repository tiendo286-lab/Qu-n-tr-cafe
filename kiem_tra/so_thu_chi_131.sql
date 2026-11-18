-- Bài thử máy chủ cho supabase/131_so_thu_chi_lech.sql (đợt 3: phiếu chênh lệch). Gửi CÙNG LẦN với 131; REPORT>> tự hoàn tác.
-- Dùng cặp ca thật LHP: 143 thiếu chuyển khoản, 146 / 148 dư chuyển khoản (đã chốt tiền). Ca 376 chưa chốt tiền.
do $$
declare chu public.accounts; qlt public.accounts; nv public.accounts; rep text := ''; j jsonb; r text; tl_id bigint; mid bigint; qid bigint;
  gap jsonb;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select * into qlt from public.accounts where system_role = 'ql_tong' and auth_user_id is not null order by id limit 1;
  select * into nv from public.accounts where system_role = 'nv' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  -- (a) Chủ ghép 146 → 143 (130.000) → đã duyệt; sổ trừ phần ghép
  r := public.app_stc_gap_match(143, 146, 'chuyen_khoan', 130000, 'thử ghép');
  j := public.app_stc_month(1, '2026-11');
  gap := (select x -> 'gap' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'g:143:ck');
  rep := rep || E'\n(a) ghép: ' || r || ' · ca thiếu còn ' || coalesce((select x ->> 'amount' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'g:143:ck'), '?')
         || ' (gộp ' || coalesce((select x ->> 'gross' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'g:143:ck'), '?') || ')'
         || ' · ca dư còn ' || coalesce((select x ->> 'amount' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'g:146:ck'), '?')
         || ' · ghép ' || coalesce(jsonb_array_length(gap -> 'matches'), 0) || ' · người làm ca ' || coalesce(jsonb_array_length(gap -> 'people'), 0)
         || ' · ca gợi ý ' || coalesce(jsonb_array_length(gap -> 'cands'), 0);
  -- (b) trừ lương 100.000 → has_tl; ghép thêm bị chặn
  perform public.app_stc_gap_tl(143, 'chuyen_khoan', jsonb_build_array(jsonb_build_object('employee_id', 54, 'amount', 50000), jsonb_build_object('employee_id', 104, 'amount', 50000)), 'thử trừ lương');
  j := public.app_stc_month(1, '2026-11');
  gap := (select x -> 'gap' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'g:143:ck');
  rep := rep || E'\n(b) trừ lương: has_tl ' || coalesce(gap ->> 'has_tl', '?') || ' · phiếu ' || coalesce(jsonb_array_length(gap -> 'tl'), 0);
  begin perform public.app_stc_gap_match(143, 148, 'chuyen_khoan', 20000, 'thử'); rep := rep || ' · KHÔNG chặn ghép sau trừ lương!';
  exception when others then rep := rep || ' · ghép sau trừ lương: ' || sqlerrm; end;
  -- (c) huỷ phiếu trừ tiền → ghép lại được (Quản lý tổng → chờ Chủ duyệt)
  for tl_id in select s.id from public.shift_shortfalls s where s.report_id = 143 and s.item = 'chuyen_khoan' and s.status <> 'huy' loop
    perform public.app_stc_gap_undo('tl', tl_id, 'thử huỷ');
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', qlt.auth_user_id, 'role', 'authenticated')::text, true);
  r := public.app_stc_gap_match(143, 148, 'chuyen_khoan', 20000, 'thử ghép QL tổng');
  select id into mid from public.gap_matches where short_report = 143 and over_report = 148 order by id desc limit 1;
  rep := rep || E'\n(c) sau huỷ trừ lương, Quản lý tổng ghép: ' || r;
  -- (d) Quản lý tổng quán chịu → chờ duyệt; Quản lý tổng duyệt bị chặn; Chủ duyệt
  r := public.app_stc_gap_qc(143, 'chuyen_khoan', 1000, 'thử quán chịu');
  select id into qid from public.stc_gap_requests where report_id = 143 order by id desc limit 1;
  rep := rep || E'\n(d) Quản lý tổng quán chịu: ' || r;
  begin perform public.app_stc_gap_approve('qc', qid, true); rep := rep || ' · KHÔNG chặn Quản lý tổng duyệt!';
  exception when others then rep := rep || ' · Quản lý tổng duyệt: ' || sqlerrm; end;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_stc_month(1, '2026-11');
  gap := (select x -> 'gap' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'g:143:ck');
  rep := rep || ' · chờ duyệt: quán chịu ' || coalesce(jsonb_array_length(gap -> 'qc_wait'), 0)
         || ', ghép ' || (select count(*) from jsonb_array_elements(gap -> 'matches') m where m ->> 'status' = 'cho_duyet')
         || ' · trạng thái "' || coalesce((select x ->> 'status' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'g:143:ck'), '') || '"';
  perform public.app_stc_gap_approve('qc', qid, true);
  perform public.app_stc_gap_approve('match', mid, true);
  j := public.app_stc_month(1, '2026-11');
  gap := (select x -> 'gap' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'g:143:ck');
  rep := rep || E'\n    Chủ duyệt: quán chịu ' || (select count(*) from jsonb_array_elements(gap -> 'decisions') d where d ->> 'kind' = 'quan_chiu')
         || ' · ghép đã duyệt ' || (select count(*) from jsonb_array_elements(gap -> 'matches') m where m ->> 'status' = 'da_duyet')
         || ' · còn ' || coalesce((select x ->> 'amount' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'g:143:ck'), '?');
  -- (e) phiếu thu cho ca dư 108
  perform public.app_stc_gap_thu(108, 'chuyen_khoan', 1000, 'thử phiếu thu');
  j := public.app_stc_month(1, '2026-11');
  rep := rep || E'\n(e) phiếu thu: has_thu ' || coalesce((select x -> 'gap' ->> 'has_thu' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'g:108:ck'), '?');
  -- (f) ca chưa chốt / nhân viên
  begin perform public.app_stc_gap_tl(376, 'chuyen_khoan', jsonb_build_array(jsonb_build_object('employee_id', 54, 'amount', 1000)), 'x'); rep := rep || E'\n(f) KHÔNG chặn ca chưa chốt!';
  exception when others then rep := rep || E'\n(f) ca chưa chốt: ' || sqlerrm; end;
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_stc_gap_qc(143, 'chuyen_khoan', 1000, 'x'); rep := rep || E'\n(f) KHÔNG chặn nhân viên!';
  exception when others then rep := rep || E'\n(f) nhân viên: ' || sqlerrm; end;
  raise exception 'REPORT>> %', rep;
end $$;
