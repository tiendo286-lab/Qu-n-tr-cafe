-- Bài thử máy chủ cho supabase/130_so_thu_chi_sua_ca.sql (đợt 2b: sửa / thêm / xoá khoản thu chi của CA — vùng khoá).
-- Gửi CÙNG LẦN với tệp 130. Kết thúc REPORT>> nên tự hoàn tác.
do $$
declare chu public.accounts; nv public.accounts; j jsonb; rep text := ''; rid bigint; mk text; wd text; br bigint; nv0 text; nv1 text; chk0 int; chk1 int;
        lech0 bigint; lech1 bigint; amt bigint; nmk text; mk2 text; un bigint;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select * into nv from public.accounts where system_role = 'nv' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  -- một khoản chi thường của ca đã chốt tiền (tháng chưa chốt)
  select t.report_id, t.mkey, t.work_date, t.branch_id, -t.amount into rid, mk, wd, br, amt
    from public.app__tc_moves_x(null, '2026-11-01', '2026-11-30') t
   where t.amount < 0 and t.auto is null and not public.app__fin_locked(t.branch_id, t.work_date)
     and exists (select 1 from public.shift_report_results s where s.report_id = t.report_id and s.item = 'tien_mat')
     and exists (select 1 from public.shift_report_results s where s.report_id = t.report_id and s.item = 'chuyen_khoan')
     and not exists (select 1 from public.shift_debts d where d.mv_report = t.report_id and d.mv_key = t.mkey)
     and not exists (select 1 from public.branch_loans l where l.report_id = t.report_id and l.mkey = t.mkey)
   order by t.work_date desc limit 1;
  select string_agg(kind || amount || note, '|' order by sort_order) into nv0 from public.shift_report_moves where report_id = rid;
  select count(*) into chk0 from public.shift_report_checks where report_id = rid;
  select coalesce(sum(case when x ->> 'book' = 'thu' then (x ->> 'amount')::bigint else -(x ->> 'amount')::bigint end), 0) into lech0
    from jsonb_array_elements(public.app_stc_month(br, left(wd, 7)) -> 'items') x where x ->> 'col' = 'lech' and (x ->> 'ca_id')::bigint = rid and x ->> 'pm' = 'tm';
  j := public.app_stc_month(br, left(wd, 7));
  rep := rep || E'\nca ' || rid || ' khoản ' || amt || ' · sửa được trước khi sửa: ' || coalesce((select x ->> 'can_edit' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'm:' || rid || ':' || mk), '?');
  -- (1) sửa số tiền +1.000
  nmk := public.app_stc_move_save(rid, mk, jsonb_build_object('amount', -(amt + 1000)), 'thử sửa');
  select string_agg(kind || amount || note, '|' order by sort_order) into nv1 from public.shift_report_moves where report_id = rid;
  select count(*) into chk1 from public.shift_report_checks where report_id = rid;
  j := public.app_stc_month(br, left(wd, 7));
  select coalesce(sum(case when x ->> 'book' = 'thu' then (x ->> 'amount')::bigint else -(x ->> 'amount')::bigint end), 0) into lech1
    from jsonb_array_elements(j -> 'items') x where x ->> 'col' = 'lech' and (x ->> 'ca_id')::bigint = rid and x ->> 'pm' = 'tm' and not coalesce((x ->> 'void')::boolean, false);
  rep := rep || E'\n(1) sửa: phiếu NV đổi? ' || (nv0 is distinct from nv1) || ' · mục đã duyệt ' || chk0 || '→' || chk1
         || ' · gạch ngang ' || (select count(*) from jsonb_array_elements(j -> 'items') x where (x ->> 'void')::boolean and (x ->> 'ca_id')::bigint = rid)
         || ' · phiếu bổ sung ' || coalesce((select x -> 'edit' ->> 'action' || ' cũ ' || (x -> 'edit' ->> 'old_amount') from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'm:' || rid || ':' || nmk), 'KHÔNG THẤY')
         || ' · lệch TM ' || lech0 || '→' || lech1 || ' (phải +1000)';
  -- (2) thêm khoản thu vào ca
  mk2 := public.app_stc_move_save(rid, null, jsonb_build_object('kind', 'tien_mat', 'amount', 5000, 'note', 'Thu thử STC'), 'thử thêm');
  j := public.app_stc_month(br, left(wd, 7));
  rep := rep || E'\n(2) thêm: ' || coalesce((select x -> 'edit' ->> 'action' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'm:' || rid || ':' || mk2), 'KHÔNG THẤY');
  -- (3) xoá khoản vừa thêm
  perform public.app_stc_move_save(rid, mk2, jsonb_build_object('delete', true), 'thử xoá');
  j := public.app_stc_month(br, left(wd, 7));
  rep := rep || E'\n(3) xoá: còn ' || (select count(*) from jsonb_array_elements(j -> 'items') x where x ->> 'title' = 'Thu thử STC' and not coalesce((x ->> 'void')::boolean, false))
         || ' · gạch ngang ' || (select count(*) from jsonb_array_elements(j -> 'items') x where x ->> 'title' = 'Thu thử STC' and (x ->> 'void')::boolean);
  -- (4) thiếu lý do
  begin perform public.app_stc_move_save(rid, nmk, jsonb_build_object('amount', -1), ' '); rep := rep || E'\n(4) KHÔNG chặn thiếu lý do!';
  exception when others then rep := rep || E'\n(4) thiếu lý do: ' || sqlerrm; end;
  -- (5) ca chưa chốt tiền
  select r.id into un from public.shift_reports r where r.status = 'hoan_thanh' and r.work_date >= '2026-11-01'
     and not exists (select 1 from public.shift_report_results s where s.report_id = r.id and s.item = 'tien_mat') order by r.work_date desc limit 1;
  if un is not null then
    begin perform public.app_stc_move_save(un, null, jsonb_build_object('kind', 'tien_mat', 'amount', -1000, 'note', 'x'), 'x'); rep := rep || E'\n(5) KHÔNG chặn ca chưa chốt!';
    exception when others then rep := rep || E'\n(5) ca chưa chốt: ' || sqlerrm; end;
  end if;
  -- (6) nhân viên
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_stc_move_save(rid, nmk, jsonb_build_object('amount', -1), 'x'); rep := rep || E'\n(6) KHÔNG chặn nhân viên!';
  exception when others then rep := rep || E'\n(6) nhân viên: ' || sqlerrm; end;
  raise exception 'REPORT>> %', rep;
end $$;
