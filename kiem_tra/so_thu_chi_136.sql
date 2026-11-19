-- Bài thử máy chủ cho supabase/136_so_thu_chi_cho_ql.sql (bước 152). Gửi CÙNG LẦN, sau nội dung tệp 136 (chạy 2 lần). REPORT>> tự hoàn tác.
do $$
declare chu public.accounts; ql public.accounts; rep text := ''; j jsonb; b1 bigint; b2 bigint; n int; rid bigint; s text;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  for ql in select a.* from public.accounts a where a.system_role = 'ql' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id loop
    perform set_config('request.jwt.claims', json_build_object('sub', ql.auth_user_id, 'role', 'authenticated')::text, true);
    select min(b.id) into b1 from public.branches b where b.status = 'Đang hoạt động' and coalesce(public.app__stc_can(b.id), false);
    exit when b1 is not null;
  end loop;
  rep := rep || E'\nQL thử: tài khoản ' || ql.id || ' · cơ sở ' || coalesce(b1::text, 'KHÔNG CÓ');
  select min(b.id) into b2 from public.branches b where b.status = 'Đang hoạt động' and not coalesce(public.app__stc_can(b.id), false);
  select count(*) into n from public.branches b where b.status = 'Đang hoạt động' and coalesce(public.app__stc_can(b.id), false);
  -- (a) QL đọc cơ sở mình
  begin j := public.app_stc_month(b1, '2026-11');
    rep := rep || E'\n(a) QL đọc cơ sở ' || b1 || ': được · danh sách cơ sở ' || jsonb_array_length(j -> 'branches') || ' (được giao ' || n || ') · owner=' || (j ->> 'owner');
  exception when others then rep := rep || E'\n(a) QL đọc cơ sở mình LỖI: ' || sqlerrm; end;
  -- (b) QL đọc cơ sở khác
  if b2 is not null then
    begin j := public.app_stc_month(b2, '2026-11'); rep := rep || E'\n(b) KHÔNG chặn QL đọc cơ sở khác!';
    exception when others then rep := rep || E'\n(b) cơ sở khác: ' || sqlerrm; end;
  else rep := rep || E'\n(b) QL được giao mọi cơ sở — bỏ qua'; end if;
  -- (e) finals
  begin j := public.app_stc_finals(b1, '2026-11'); rep := rep || E'\n(e) QL đọc ca đã chốt / khoản treo: được';
  exception when others then rep := rep || E'\n(e) finals LỖI: ' || sqlerrm; end;
  -- (d) giải trình trong tl
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_stc_month(1, '2026-11');
  rep := rep || E'\n(d) tl có reply: ' || coalesce((select bool_or(t ? 'reply')::text from jsonb_array_elements(j -> 'items') x, jsonb_array_elements(case when jsonb_typeof(x -> 'gap' -> 'tl') = 'array' then x -> 'gap' -> 'tl' else '[]'::jsonb end) t), 'không có phiếu trừ lương để xem');
  -- (c) Xác nhận Fabi ghi đủ 4 kết quả tiền
  for rid in select r.id from public.shift_reports r where r.branch_id = 1 and r.status = 'hoan_thanh' and r.work_date >= '2026-11-10'
               and not coalesce((public.app__stc_ds_state(r.id) ->> 'done')::boolean, false) order by r.work_date loop
    begin
      perform public.app_stc_ds_close(rid);
      select string_agg(item || '=' || result, ',' order by item) into s from public.shift_report_results where report_id = rid;
      rep := rep || E'\n(c) xác nhận ca ' || rid || ': ' || s || ' · đối soát ' || (select recon_status from public.shift_reports where id = rid)
             || ' · việc ' || (select count(*) from public.shift_report_checks where report_id = rid) || '/' || array_length(public.app__ca_check_items(), 1);
      exit;
    exception when others then rep := rep || E'\n    ca ' || rid || ' không xác nhận được: ' || left(sqlerrm, 80); end;
  end loop;
  raise exception 'REPORT>> %', rep;
end $$;
