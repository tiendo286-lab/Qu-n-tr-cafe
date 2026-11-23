-- Bài thử tệp 167 (chặng 6.5: "đã Xác nhận Fabi" = đủ dấu 4 mục tiền). Gửi CÙNG LẦN, ngay sau tệp 167; tự hoàn tác. Trước tệp 167 phải có:
--   create temp table t167 as select r.id, (public.app__stc_ds_state(r.id) ->> 'done')::boolean d0 from public.shift_reports r
--    where r.work_date like '2026-11%' and r.status = 'hoan_thanh';
-- Đạt: "REPORT>> ĐẠT 5/5 …".
DO $test$
declare uid uuid; acc bigint; n_lost int; n_new int; n_bad int; n_mis int; b record; m jsonb; one bigint; e text; ok text[] := '{}'; r149 text; one_txt text;
begin
  select id, auth_user_id into acc, uid from public.accounts where system_role = 'chu' and locked = 0 and auth_user_id is not null limit 1;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  -- T1: ca mất "đã xác nhận" = đúng các ca thiếu dấu ở 4 mục tiền; không ca nào tự thành "đã xác nhận"
  select count(*) filter (where t.d0 and not (public.app__stc_ds_state(t.id) ->> 'done')::boolean),
         count(*) filter (where not t.d0 and (public.app__stc_ds_state(t.id) ->> 'done')::boolean) into n_lost, n_new from t167 t;
  if n_new <> 0 then raise exception 'FAIL T1 có % ca tự thành đã xác nhận', n_new; end if;
  ok := array_append(ok, ('T1 (' || n_lost || ' ca hiện lại nút Xác nhận Fabi)')::text);
  -- T2: mọi ca "đã xác nhận" đều đủ 4 dấu
  select count(*) into n_bad from t167 t where (public.app__stc_ds_state(t.id) ->> 'done')::boolean
     and (select count(distinct s.item) from public.shift_report_results s where s.report_id = t.id and s.item = any(public.app__ca_money_items())) < 4;
  if n_bad <> 0 then raise exception 'FAIL T2 % ca đã xác nhận mà thiếu dấu', n_bad; end if;
  ok := array_append(ok, 'T2'::text);
  -- T3: Sổ thu chi tháng (recon_money_done) khớp trang ca
  n_mis := 0;
  for b in select distinct r.branch_id from public.shift_reports r join t167 t on t.id = r.id loop
    m := public.app_stc_month(b.branch_id, '2026-11');
    select n_mis + count(*) into n_mis from jsonb_array_elements(m -> 'cas') c
     where (c ->> 'recon_money_done')::boolean is distinct from (public.app__stc_ds_state((c ->> 'id')::bigint) ->> 'done')::boolean;
  end loop;
  if n_mis <> 0 then raise exception 'FAIL T3 % ca Sổ thu chi khác trang ca', n_mis; end if;
  ok := array_append(ok, 'T3'::text);
  -- T4: ca LHP Tối 11/11 (149, đã bấm Hoàn thành, thiếu dấu Thu chi) — bấm Xác nhận Fabi → đủ dấu + tự Hoàn thành đối soát
  begin
    perform public.app_stc_ds_close(149);
    select recon_status into r149 from public.shift_reports where id = 149;
    if not exists (select 1 from public.shift_report_results where report_id = 149 and item = 'thu_chi') then raise exception 'FAIL T4 chưa có dấu Thu chi'; end if;
    if r149 <> 'hoan_thanh' then
      r149 := r149 || ' (thiếu: ' || coalesce((select string_agg(x, ', ') from unnest(public.app__stc_ds_missing(149)) x), '?') || ' · việc: ' || coalesce(public.app__cv_state(149), '?') || ')';
    end if;
  exception when others then get stacked diagnostics e = message_text; if e like 'FAIL%' then raise; end if; r149 := 'lỗi: ' || e; end;
  ok := array_append(ok, ('T4 ca 149 → ' || r149)::text);
  -- T5: một ca kẹt chưa bấm Hoàn thành — bấm Xác nhận Fabi → thành "đã xác nhận", chưa Đã đối soát (chờ Hoàn thành)
  select t.id into one from t167 t where t.d0 and not (public.app__stc_ds_state(t.id) ->> 'done')::boolean
     and not exists (select 1 from public.stc_ca_done d where d.report_id = t.id) order by t.id limit 1;
  begin
    perform public.app_stc_ds_close(one);
    if not (public.app__stc_ds_state(one) ->> 'done')::boolean then raise exception 'FAIL T5 ca % chưa thành đã xác nhận', one; end if;
    one_txt := 'ca ' || one || ' → đã xác nhận, ' || (select recon_status from public.shift_reports where id = one);
  exception when others then get stacked diagnostics e = message_text; if e like 'FAIL%' then raise; end if; one_txt := 'ca ' || one || ' lỗi: ' || e; end;
  ok := array_append(ok, ('T5 ' || one_txt)::text);
  raise exception 'REPORT>> ĐẠT %/5 · %', cardinality(ok), array_to_string(ok, ' · ');
end $test$;
