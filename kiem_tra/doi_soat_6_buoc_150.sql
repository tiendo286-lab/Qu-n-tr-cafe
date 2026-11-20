-- Bài thử máy chủ cho supabase/150_doi_soat_6_buoc.sql (bước 171 đợt A — vùng khoá). Cách gửi: xem kiem_tra/doi_soat_6_buoc_150_truoc.sql.
-- Dùng ca thật của tháng đang mở; REPORT>> tự hoàn tác, không đổi dữ liệu thật. Mỗi dòng bắt đầu bằng ĐẠT hoặc HỎNG.
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
declare chu public.accounts; nv public.accounts; rep text := ''; r public.shift_reports; r2 public.shift_reports; miss text[]; j jsonb; n int; n2 int; tk text; st text;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select * into nv from public.accounts where system_role = 'nv' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);

  -- (0) so cũ / mới: sổ tháng chỉ thêm ticks + done ở từng ca, mọi thứ khác giống hệt
  if to_regclass('pg_temp.t150_truoc') is not null then
    select count(*), count(*) filter (where
        (t.j - 'cas') = (m.j - 'cas')
        and (select coalesce(jsonb_agg(c - 'ticks' - 'done' order by c ->> 'id'), '[]') from jsonb_array_elements(m.j -> 'cas') c)
          = (select coalesce(jsonb_agg(c order by c ->> 'id'), '[]') from jsonb_array_elements(t.j -> 'cas') c))
      into n, n2
      from pg_temp.t150_truoc t, lateral (select public.app_stc_month(t.branch_id, to_char(public.vn_now(), 'YYYY-MM')) j) m;
    rep := rep || E'\n' || case when n > 0 and n = n2 then 'ĐẠT' else 'HỎNG' end || format(' (0) sổ tháng cũ = mới ở %s / %s cơ sở (chỉ thêm ticks, done)', n2, n);
  else rep := rep || E'\nHỎNG (0) thiếu bản chụp trước (chưa gửi kèm doi_soat_6_buoc_150_truoc.sql)';
  end if;

  -- (1) chạy bù: mọi ca đã xác nhận Fabi đều có dấu Hoàn thành; trạng thái đối soát cũ không đổi
  select count(*) into n from public.shift_reports x where (public.app__stc_ds_state(x.id) ->> 'done')::boolean;
  select count(*) into n2 from public.stc_ca_done;
  rep := rep || E'\n' || case when n = n2 then 'ĐẠT' else 'HỎNG' end || format(' (1) chạy bù: %s ca đã xác nhận Fabi, %s dấu Hoàn thành', n, n2);

  select x.* into r from public.shift_reports x where x.status = 'hoan_thanh' and x.work_date >= to_char(public.vn_now(), 'YYYY-MM') || '-01'
     and not public.app__fin_locked(x.branch_id, x.work_date) and (public.app__stc_ds_state(x.id) ->> 'done')::boolean order by x.work_date desc, x.id desc limit 1;
  select x.* into r2 from public.shift_reports x where x.status = 'hoan_thanh' and x.work_date >= to_char(public.vn_now(), 'YYYY-MM') || '-01'
     and not public.app__fin_locked(x.branch_id, x.work_date) and not (public.app__stc_ds_state(x.id) ->> 'done')::boolean order by x.work_date desc, x.id desc limit 1;
  if r.id is null then raise exception 'REPORT>> %', rep || E'\nHỎNG không có ca đã xác nhận Fabi trong tháng mở để thử'; end if;
  rep := rep || format(E'\n    ca thử: %s (%s %s, đối soát %s) · ca chưa xác nhận: %s', r.id, r.work_date, r.shift, r.recon_status, coalesce(r2.id::text, 'không có'));

  -- (2) sổ tháng có ticks + done
  select c into j from jsonb_array_elements(public.app_stc_month(r.branch_id, left(r.work_date, 7)) -> 'cas') c where (c ->> 'id')::bigint = r.id;
  rep := rep || E'\n' || case when jsonb_typeof(j -> 'ticks') = 'array' and j -> 'done' ->> 'at' = 'trước bước 171' then 'ĐẠT' else 'HỎNG' end || ' (2) sổ tháng trả ticks + done: ' || (j -> 'ticks')::text || ' ' || (j -> 'done')::text;

  -- (3) đã Hoàn thành thì không tích / không thêm phiếu được
  begin perform public.app_stc_tick(r.id, 'anh', true); rep := rep || E'\nHỎNG (3) vẫn tích được khi ca đã Hoàn thành';
  exception when others then rep := rep || E'\nĐẠT (3) tích khi đã Hoàn thành: ' || sqlerrm; end;
  begin perform public.app_stc_move_save(r.id, null, jsonb_build_object('kind', 'tien_mat', 'amount', -1000, 'note', 'thử 150'), 'thử'); rep := rep || E'\nHỎNG (3b) vẫn thêm phiếu được khi ca đã Hoàn thành';
  exception when others then rep := rep || E'\n' || case when sqlerrm like '%Mở lại trước%' then 'ĐẠT' else 'HỎNG' end || ' (3b) thêm phiếu khi đã Hoàn thành: ' || sqlerrm; end;

  -- (4) Mở lại: mất dấu, ca về chưa đối soát xong, tiền vẫn đã xác nhận
  perform public.app_stc_ds_undone(r.id);
  rep := rep || E'\n' || case when not exists (select 1 from public.stc_ca_done where report_id = r.id) and (public.app__stc_ds_state(r.id) ->> 'done')::boolean
      and (select recon_status from public.shift_reports where id = r.id) <> 'hoan_thanh' then 'ĐẠT' else 'HỎNG' end
    || ' (4) Mở lại → đối soát ' || (select recon_status from public.shift_reports where id = r.id) || ', vẫn đã xác nhận Fabi';

  -- (4b) hai đường khác từng tự đặt "Đã đối soát": nút Hoàn thành ở trang Đối soát ca bị chặn (báo rõ làm ở Sổ thu chi); web tự hoàn thành không còn tự đặt
  begin perform public.app_ca_recon_finish(r.id); rep := rep || E'\nHỎNG (4b) app_ca_recon_finish vẫn hoàn thành được khi chưa có dấu → ' || (select recon_status from public.shift_reports where id = r.id);
  exception when others then rep := rep || E'\n' || case when sqlerrm like '%Sổ thu chi%' then 'ĐẠT' else 'HỎNG' end || ' (4b) app_ca_recon_finish: ' || sqlerrm; end;
  begin
    st := public.app__ca_auto_green(r.id);
    rep := rep || E'\n' || case when (select recon_status from public.shift_reports where id = r.id) <> 'hoan_thanh' then 'ĐẠT' else 'HỎNG' end
      || ' (4c) app__ca_auto_green trả "' || coalesce(st, '') || '" → đối soát ' || (select recon_status from public.shift_reports where id = r.id);
  exception when others then rep := rep || E'\n    (4c) app__ca_auto_green lỗi: ' || sqlerrm; end;

  -- (5) tích mã lạ bị chặn; tích / bỏ tích đúng
  begin perform public.app_stc_tick(r.id, 'la', true); rep := rep || E'\nHỎNG (5) tích được mã lạ';
  exception when others then rep := rep || E'\nĐẠT (5) mã lạ: ' || sqlerrm; end;
  perform public.app_stc_tick(r.id, 'anh', true); perform public.app_stc_tick(r.id, 'anh', true); perform public.app_stc_tick(r.id, 'sot', true); perform public.app_stc_tick(r.id, 'sot', false);
  rep := rep || E'\n' || case when (select array_agg(item order by item) from public.stc_ca_ticks where report_id = r.id) = array['anh'] then 'ĐẠT' else 'HỎNG' end || ' (5b) tích 2 lần + bỏ tích';

  -- (6) Hoàn thành khi còn thiếu → lỗi liệt kê mục
  begin perform public.app_stc_ds_done(r.id); rep := rep || E'\nHỎNG (6) Hoàn thành được khi còn thiếu mục';
  exception when others then rep := rep || E'\n' || case when sqlerrm like 'Còn mục chưa kiểm tra:%' then 'ĐẠT' else 'HỎNG' end || ' (6) ' || left(sqlerrm, 300); end;

  -- (7) tích đủ + phân loại → hết thiếu → Hoàn thành → auto_finish chạy
  n := pg_temp.cat_all(r.id);
  foreach tk in array array['hd', 'anh', 'goi', 'tn', 'sot', 'that', 'lon', 'ld', 'sau_tm', 'sau_ck'] loop perform public.app_stc_tick(r.id, tk, true); end loop;
  miss := public.app__stc_ds_missing(r.id);
  if cardinality(miss) = 0 then
    perform public.app_stc_ds_done(r.id);
    rep := rep || E'\n' || case when exists (select 1 from public.stc_ca_done where report_id = r.id and by_account = chu.id) then 'ĐẠT' else 'HỎNG' end
      || format(' (7) tích đủ (phân loại %s khoản) → Hoàn thành; đối soát %s (trước khi thử: %s)', n, (select recon_status from public.shift_reports where id = r.id), r.recon_status);
    perform public.app_stc_ds_undone(r.id);
  else rep := rep || E'\n    (7) ca thử còn thiếu ngoài mục tích (không thử Hoàn thành được): ' || array_to_string(miss, ' · ');
  end if;

  -- (8) thêm phiếu chi → that, lon, ld, sau_* tự bỏ; anh, tn, sot giữ
  begin
    perform public.app_stc_move_save(r.id, null, jsonb_build_object('kind', 'tien_mat', 'amount', -1000, 'note', 'thử 150'), 'thử');
    rep := rep || E'\n' || case when (select array_agg(item order by item) from public.stc_ca_ticks where report_id = r.id) = array['anh', 'goi', 'hd', 'sot', 'tn'] then 'ĐẠT' else 'HỎNG' end
      || ' (8) thêm phiếu chi → còn tích: ' || coalesce((select string_agg(item, ',' order by item) from public.stc_ca_ticks where report_id = r.id), '');
  exception when others then rep := rep || E'\n    (8) không thêm được phiếu chi vào ca thử: ' || sqlerrm; end;

  -- (9) Mở lại xác nhận Fabi → mất dấu Hoàn thành
  insert into public.stc_ca_done(report_id, by_account) values (r.id, chu.id) on conflict do nothing;
  begin
    perform public.app_stc_ds_reopen(r.id, 'thử 150');
    rep := rep || E'\n' || case when not exists (select 1 from public.stc_ca_done where report_id = r.id) then 'ĐẠT' else 'HỎNG' end || ' (9) Mở lại xác nhận Fabi → bỏ dấu Hoàn thành';
  exception when others then rep := rep || E'\n    (9) không mở lại xác nhận được ca thử: ' || sqlerrm; end;

  -- (10) ca chưa xác nhận Fabi: không Hoàn thành được; Xác nhận Fabi không còn làm ca thành Đã đối soát
  if r2.id is not null then
    begin perform public.app_stc_ds_done(r2.id); rep := rep || E'\nHỎNG (10) Hoàn thành được ca chưa xác nhận Fabi';
    exception when others then rep := rep || E'\n' || case when sqlerrm like '%Chưa Xác nhận Fabi%' then 'ĐẠT' else 'HỎNG' end || ' (10) ' || sqlerrm; end;
    begin
      perform public.app_stc_ds_close(r2.id);
      rep := rep || E'\n' || case when (select recon_status from public.shift_reports where id = r2.id) <> 'hoan_thanh' and not exists (select 1 from public.stc_ca_done where report_id = r2.id) then 'ĐẠT' else 'HỎNG' end
        || ' (10b) Xác nhận Fabi ca ' || r2.id || ' → đối soát ' || (select recon_status from public.shift_reports where id = r2.id) || ' (chưa Hoàn thành)';
    exception when others then rep := rep || E'\n    (10b) ca ' || r2.id || ' chưa đủ điều kiện Xác nhận Fabi: ' || sqlerrm; end;
  end if;

  -- (11) nhân viên không gọi được
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_stc_tick(r.id, 'anh', true); rep := rep || E'\nHỎNG (11) nhân viên tích được';
  exception when others then rep := rep || E'\nĐẠT (11) nhân viên: ' || sqlerrm; end;
  begin perform public.app_stc_ds_done(r.id); rep := rep || E'\nHỎNG (11b) nhân viên Hoàn thành được';
  exception when others then rep := rep || E'\nĐẠT (11b) nhân viên Hoàn thành: ' || sqlerrm; end;

  raise exception 'REPORT>> %', rep;
end $$;
