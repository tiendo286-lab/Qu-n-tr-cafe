-- Bài thử máy chủ cho supabase/135_doi_soat_fabi_chot_ca.sql (Chốt ca vĩnh viễn + Khoản treo — vùng khoá).
-- Gửi CÙNG LẦN, sau nội dung tệp 135 (chạy 135 hai lần để thử chạy lại). REPORT>> tự hoàn tác, không đổi dữ liệu thật.
-- Ca thật LHP: 305 (17/11 Chiều, đã xác nhận Fabi, dư TM), 373 (18/11 Sáng, chưa xác nhận), 209 (15/11 Sáng, không lệch),
-- 258 (16/11 Sáng, CK chờ tiền về), 205 (14/11 Tối, CK dư) — 258 / 205 thử xác nhận Fabi trong lúc chạy, không được thì báo.
create or replace function pg_temp.cat_all(p_rid bigint) returns int language plpgsql as $f$
declare n int := 0; x jsonb; mk text;
begin
  for x in select i from jsonb_array_elements(public.app_stc_month((select branch_id from public.shift_reports where id = p_rid),
             (select left(work_date, 7) from public.shift_reports where id = p_rid)) -> 'items') i
           where (i ->> 'ca_id')::bigint = p_rid and i ->> 'book' = 'chi' and i ->> 'col' = 'chi' and coalesce(i ->> 'cat', '') = '' loop
    mk := split_part(x ->> 'id', ':', 3);
    insert into public.fin_move_cats(report_id, mkey, category_id) values (p_rid, mk, (select id from public.fin_categories order by id limit 1))
      on conflict (report_id, mkey) do update set category_id = excluded.category_id;
    n := n + 1;
  end loop;
  return n;
end $f$;

do $$
declare chu public.accounts; nv public.accounts; rep text := ''; j jsonb; v bigint; v2 bigint; t1 bigint; t2 bigint; ok boolean;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select * into nv from public.accounts where system_role = 'nv' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);

  -- (a) chưa xác nhận Fabi → chặn
  begin perform public.app_stc_ca_final(373); rep := rep || E'\n(a) KHÔNG chặn ca chưa xác nhận Fabi!';
  exception when others then rep := rep || E'\n(a) ca chưa xác nhận: ' || sqlerrm; end;

  -- (b) chốt 305: lần đầu (có thể còn chi chưa phân loại) → phân loại → chốt
  begin j := public.app_stc_ca_final(305); rep := rep || E'\n(b) chốt 305 ngay: ' || j::text;
  exception when others then
    rep := rep || E'\n(b) chốt 305 lần 1: ' || sqlerrm || ' → phân loại ' || pg_temp.cat_all(305) || ' khoản';
    j := public.app_stc_ca_final(305); rep := rep || ' → chốt: ' || j::text;
  end;
  rep := rep || ' · finals=' || (select count(*) from public.stc_ca_finals where report_id = 305);
  begin perform public.app_stc_ca_final(305); rep := rep || ' · KHÔNG chặn chốt lần 2!';
  exception when others then rep := rep || ' · chốt lần 2: ' || sqlerrm; end;

  -- (c) sau chốt: bảng tiền bị chặn, bảng hệ thống bỏ qua lặng lẽ
  begin update public.shift_report_results set reason = coalesce(reason, '') || 'x' where report_id = 305; rep := rep || E'\n(c) KHÔNG chặn sửa kết quả!';
  exception when others then rep := rep || E'\n(c) sửa kết quả: ' || sqlerrm; end;
  begin update public.shift_report_moves set amount = amount - 1000 where report_id = 305; rep := rep || ' · sửa khoản phiếu: ' || case when found then 'KHÔNG chặn!' else 'không có khoản' end;
  exception when others then rep := rep || ' · sửa khoản phiếu: chặn'; end;
  begin perform public.app_stc_ds_reopen(305, 'thử mở lại'); rep := rep || ' · KHÔNG chặn Mở lại xác nhận!';
  exception when others then rep := rep || ' · mở lại xác nhận: ' || sqlerrm; end;
  begin perform public.app_stc_ds_fabi(305, 'dt', null, 'thử'); rep := rep || ' · KHÔNG chặn Lấy số máy Fabi!';
  exception when others then rep := rep || ' · lấy số Fabi: ' || sqlerrm; end;
  begin perform public.app_stc_move_save(305, null, jsonb_build_object('kind', 'tien_mat', 'amount', -1000, 'note', 'thử thêm'), 'thử'); rep := rep || ' · KHÔNG chặn thêm phiếu vào ca!';
  exception when others then rep := rep || ' · thêm phiếu vào ca: ' || sqlerrm; end;
  begin update public.shift_report_recon set updated_at = updated_at where report_id = 305; rep := rep || ' · KHÔNG chặn sửa bản đối soát!';
  exception when others then rep := rep || ' · sửa bản đối soát: chặn'; end;
  begin perform public.app_ca_recon(305); rep := rep || ' · mở trang Đối soát ca cũ: được';
  exception when others then rep := rep || ' · mở trang Đối soát ca cũ: ' || sqlerrm; end;
  v := (select pos_cash from public.shift_reports where id = 305);
  update public.shift_reports set pos_cash = pos_cash + 12345 where id = 305;
  rep := rep || E'\n    cột tiền phiếu: ' || case when (select pos_cash from public.shift_reports where id = 305) = v then 'giữ nguyên' else 'BỊ ĐỔI!' end;
  update public.shift_reports set updated_at = 'thu-135' where id = 305;
  rep := rep || ' · cột khác: ' || case when (select updated_at from public.shift_reports where id = 305) = 'thu-135' then 'sửa được' else 'BỊ CHẶN!' end;
  v := (select net from public.fabi_shifts where report_id = 305 limit 1);
  update public.fabi_shifts set net = net + 1 where report_id = 305;
  rep := rep || ' · file Fabi: ' || case when (select net from public.fabi_shifts where report_id = 305 limit 1) is not distinct from v then 'giữ nguyên' else 'BỊ ĐỔI!' end;
  begin perform public.app__fabi_apply_report(305); rep := rep || ' · kế toán áp lại Fabi: không lỗi';
  exception when others then rep := rep || ' · kế toán áp lại Fabi LỖI: ' || sqlerrm; end;
  begin j := public.app_stc_month(1, '2026-11'); rep := rep || ' · sổ tháng: đọc được';
  exception when others then rep := rep || ' · sổ tháng LỖI: ' || sqlerrm; end;
  j := public.app_stc_finals(1, '2026-11');
  rep := rep || E'\n    app_stc_finals: chốt ' || jsonb_array_length(j -> 'finals') || ' · treo ' || coalesce((select string_agg(t ->> 'kind' || ' ' || (t ->> 'pm') || ' ' || (t ->> 'left') || ' còn ' || (t ->> 'days_left') || ' ngày', ', ') from jsonb_array_elements(j -> 'treo') t), 'không');

  -- (d) khoản treo tiền thừa của 305: ca nhận không có tiền thiếu → chặn; ca nhận đã chốt → chặn
  t1 := (select id from public.stc_treo where report_id = 305 order by id limit 1);
  if t1 is not null then
    begin perform public.app_stc_treo_use(t1, 209, 1000, 'thử'); rep := rep || E'\n(d) KHÔNG chặn ghép vào ca không thiếu!';
    exception when others then rep := rep || E'\n(d) ghép vào ca không thiếu: ' || sqlerrm; end;
    begin perform public.app_stc_treo_close(t1, 'qc', null, 'thử'); rep := rep || ' · KHÔNG chặn quán chịu tiền thừa!';
    exception when others then rep := rep || ' · quán chịu tiền thừa: ' || sqlerrm; end;
  else rep := rep || E'\n(d) 305 không có khoản treo'; end if;

  -- (e) chờ tiền về: thử lần lượt các ca CK thiếu (xác nhận + chốt → treo) và ca CK dư (xác nhận → Đã về một phần)
  t2 := null;
  foreach v in array array[341, 258, 202, 151, 203] loop
    begin
      if not coalesce((public.app__stc_ds_state(v) ->> 'done')::boolean, false) then perform public.app_stc_ds_close(v); end if;
      perform pg_temp.cat_all(v);
      j := public.app_stc_ca_final(v);
      t2 := (select id from public.stc_treo where report_id = v and kind = 'tien' order by id limit 1);
      rep := rep || E'\n(e) chốt ' || v || ': ' || j::text; exit;
    exception when others then rep := rep || E'\n(e) ca ' || v || ' không dùng được: ' || left(sqlerrm, 70); end;
  end loop;
  if t2 is not null then
    v := (select report_id from public.stc_treo where id = t2);
    foreach v2 in array array[380, 205, 150, 222] loop
      begin
        if not coalesce((public.app__stc_ds_state(v2) ->> 'done')::boolean, false) then perform public.app_stc_ds_close(v2); end if;
        t1 := least(public.app__stc_gap_avail(v2, 'chuyen_khoan', 'du'), public.app__stc_treo_left(t2));
        perform public.app_stc_treo_use(t2, v2, t1, 'thử tiền về');
        rep := rep || E'\n    Đã về ' || t1 || ' ở ca ' || v2 || ' → treo còn ' || public.app__stc_treo_left(t2) || ' · ca nhận còn dư ' || public.app__stc_gap_avail(v2, 'chuyen_khoan', 'du')
               || ' · ca gốc còn ' || public.app__stc_gap_avail(v, 'chuyen_khoan', 'thieu') || ' (không đổi)';
        begin perform public.app_stc_treo_use(t2, v2, 1000, 'lần 2'); rep := rep || ' · KHÔNG chặn vượt phần dư!';
        exception when others then rep := rep || ' · lần 2: ' || sqlerrm; end;
        exit;
      exception when others then rep := rep || E'\n    ca nhận ' || v2 || ' không dùng được: ' || left(sqlerrm, 70); end;
    end loop;
    begin perform public.app_stc_treo_close(t2, 'qc', null, 'thử'); rep := rep || E'\\n    trừ / quán chịu: được (ca gốc ' || (select work_date from public.shift_reports where id = v) || ', quá 3 ngày) → treo ' || (select status || ' · ' || coalesce(done_note, '') from public.stc_treo where id = t2);
    exception when others then rep := rep || E'\\n    trừ / quán chịu: ' || sqlerrm; end;
    update public.stc_treo set done_kind = 'qc' where id = t2;
    begin insert into public.gap_decisions(report_id, item, kind, amount, reason, created_by) values (v, 'chuyen_khoan', 'quan_chiu', 1000, 'thử lối riêng', chu.id);
      rep := rep || E'\n    lối riêng quán chịu trên ca gốc: cho qua';
    exception when others then rep := rep || E'\n    lối riêng LỖI: ' || sqlerrm; end;
    update public.stc_treo set done_kind = null where id = t2;
    begin insert into public.gap_decisions(report_id, item, kind, amount, reason, created_by) values (v, 'chuyen_khoan', 'quan_chiu', 1000, 'thử không lối riêng', chu.id);
      rep := rep || ' · KHÔNG chặn khi không có lối riêng!';
    exception when others then rep := rep || ' · không lối riêng: chặn'; end;
  end if;

  -- (f) nhân viên không chốt được
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_stc_ca_final(209); rep := rep || E'\n(f) KHÔNG chặn nhân viên!';
  exception when others then rep := rep || E'\n(f) nhân viên: ' || sqlerrm; end;
  raise exception 'REPORT>> %', rep;
end $$;
