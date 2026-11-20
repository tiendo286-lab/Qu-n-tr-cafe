-- Bài thử máy chủ cho supabase/151_nguoi_no.sql (bước 172 đợt B — người nợ thật + xếp nhóm công nợ). Cách gửi: xem kiem_tra/nguoi_no_151_truoc.sql.
-- Dùng dữ liệu thật của tháng đang mở; REPORT>> tự hoàn tác, không đổi dữ liệu thật. Mỗi dòng bắt đầu bằng ĐẠT hoặc HỎNG.
do $$
declare chu public.accounts; nv public.accounts; rep text := ''; r public.shift_reports; j jsonb; n int; n2 int; n3 int; t text; g text; pid bigint; did bigint; d1 bigint; ok boolean;
  br bigint; s public.shift_debts; miss text[];
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select * into nv from public.accounts where system_role = 'nv' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);

  -- (0) so cũ / mới: sổ tháng giống hệt, trừ 4 khoá mới của tệp 151 (grp, person_id, sorted, content) và khoá 'edit' của tệp 152 ở các dòng nợ mới của ca
  if to_regclass('pg_temp.t151_truoc') is not null then
    select count(*), count(*) filter (where
        (t0.j - 'ca_debts') = (m.j - 'ca_debts')
        and (select coalesce(jsonb_agg(c - 'grp' - 'person_id' - 'sorted' - 'content' - 'edit' order by c ->> 't', c ->> 'id'), '[]') from jsonb_array_elements(m.j -> 'ca_debts') c)
          = (select coalesce(jsonb_agg(c order by c ->> 't', c ->> 'id'), '[]') from jsonb_array_elements(t0.j -> 'ca_debts') c))
      into n, n2
      from pg_temp.t151_truoc t0, lateral (select public.app_stc_month(t0.branch_id, to_char(public.vn_now(), 'YYYY-MM')) j) m;
    rep := rep || E'\n' || case when n > 0 and n = n2 then 'ĐẠT' else 'HỎNG' end || format(' (0) sổ tháng cũ = mới ở %s / %s cơ sở (chỉ thêm 4 khoá ở nợ mới của ca)', n2, n);
  else
    rep := rep || E'\n    (0) không có bản chụp trước (chưa gửi nguoi_no_151_truoc.sql) — bỏ qua phần so cũ / mới';
  end if;

  -- (1) chạy bù: mọi cơ sở có đúng 1 "Kho tổng"; mọi khoản CHƯA THU có tên đều đã gắn người; không trùng tên trong một cơ sở
  select count(*), count(*) filter (where k.n = 1) into n, n2
    from (select b.id, (select count(*) from public.debt_people p where p.branch_id = b.id and lower(btrim(p.name)) = 'kho tổng' and p.grp = 'kho' and p.active = 1) n from public.branches b) k;
  select count(*) into n3 from public.shift_debts d where d.closed_at is null and btrim(coalesce(d.table_name, '')) <> '' and d.person_id is null;
  rep := rep || E'\n' || case when n > 0 and n = n2 and n3 = 0 then 'ĐẠT' else 'HỎNG' end
      || format(' (1) chạy bù: Kho tổng %s / %s cơ sở · khoản chưa thu chưa gắn người: %s (phải 0)', n2, n, n3);
  rep := rep || E'\n    số người nợ theo cơ sở: ' || coalesce((select string_agg(b.code || ' ' || k.c || ' (khách ' || k.kh || ', kho ' || k.ko || ', khác ' || k.kc || ')', ' · ' order by b.id)
      from public.branches b join (select branch_id, count(*) c, count(*) filter (where grp = 'khach') kh, count(*) filter (where grp = 'kho') ko, count(*) filter (where grp = 'khac') kc
                                      from public.debt_people group by branch_id) k on k.branch_id = b.id), 'không có');

  -- (2) nợ của các ca đã Hoàn thành đối soát: coi như đã xếp
  select count(*) into n from public.shift_debts d where d.report_id is not null and d.sorted_at is null and exists (select 1 from public.stc_ca_done c where c.report_id = d.report_id);
  select count(*) into n2 from public.shift_debts d where d.sorted_at is not null;
  rep := rep || E'\n' || case when n = 0 then 'ĐẠT' else 'HỎNG' end || format(' (2) nợ của ca đã Hoàn thành mà chưa có dấu đã xếp: %s (phải 0) · tổng khoản đã có dấu: %s', n, n2);

  -- cơ sở thử: cơ sở đang hoạt động đầu tiên
  select id into br from public.branches where status = 'Đang hoạt động' order by id limit 1;

  -- (3) danh sách người nợ đọc được, có Kho tổng; hàm cũ của phiếu chốt ca vẫn trả đúng dạng
  j := public.app_stc_people(br);
  select count(*) into n from jsonb_array_elements(j) x where lower(x ->> 'name') = 'kho tổng' and x ->> 'grp' = 'kho';
  select count(*) into n2 from jsonb_array_elements(public.app_ca_debt_people(br)) x where x ? 'name' and x ? 'grp' and lower(x ->> 'name') = 'kho tổng';
  rep := rep || E'\n' || case when n = 1 and n2 = 1 then 'ĐẠT' else 'HỎNG' end || format(' (3) app_stc_people: %s người, có Kho tổng %s · app_ca_debt_people có Kho tổng %s', jsonb_array_length(j), n, n2);

  -- (4) thêm người thử → trùng tên bị từ chối → nợ ngoài ca: tên lạ bị từ chối, tên người thử thì nhận và gắn đúng người
  pid := public.app_stc_person_save(null, jsonb_build_object('branch_id', br, 'name', 'Người thử 151 xyz', 'phone', '0900151151', 'grp', 'khac'));
  begin perform public.app_stc_person_save(null, jsonb_build_object('branch_id', br, 'name', 'NGƯỜI THỬ 151 XYZ', 'grp', 'khach')); t := 'KHÔNG báo lỗi';
  exception when others then t := sqlerrm; end;
  begin perform public.app_cn_debt_save(null, jsonb_build_object('branch_id', br, 'name', 'Tên lạ 151 xyz', 'amount', 10000, 'kind', 'muon', 'grp', 'khac')); g := 'KHÔNG báo lỗi';
  exception when others then g := sqlerrm; end;
  did := public.app_cn_debt_save(null, jsonb_build_object('branch_id', br, 'name', 'người thử 151 XYZ', 'amount', 10000, 'kind', 'muon', 'grp', 'khac'));
  select d.person_id = pid and d.table_name = 'Người thử 151 xyz' into ok from public.shift_debts d where d.id = did;
  rep := rep || E'\n' || case when t like '%Đã có người nợ tên này%' and g like '%chưa có trong danh sách%' and ok then 'ĐẠT' else 'HỎNG' end
      || format(' (4) trùng tên → %s · nợ ngoài ca tên lạ → %s · tên có sẵn gắn đúng người: %s', t, left(g, 60), ok);

  -- (5) ngừng dùng người thử → không ghi nợ mới cho người đó được nữa
  perform public.app_stc_person_save(pid, jsonb_build_object('branch_id', br, 'name', 'Người thử 151 xyz', 'grp', 'khac', 'active', 0));
  begin perform public.app_cn_debt_save(null, jsonb_build_object('branch_id', br, 'name', 'Người thử 151 xyz', 'amount', 5000, 'kind', 'muon', 'grp', 'khac')); t := 'KHÔNG báo lỗi';
  exception when others then t := sqlerrm; end;
  perform public.app_stc_person_save(pid, jsonb_build_object('branch_id', br, 'name', 'Người thử 151 xyz', 'grp', 'khac', 'active', 1));
  rep := rep || E'\n' || case when t like '%chưa có trong danh sách%' then 'ĐẠT' else 'HỎNG' end || ' (5) ngừng dùng rồi ghi nợ mới: ' || left(t, 70);

  -- (5b) tab Công nợ › đổi tên cho các khoản của một người sang tên mới vẫn làm được (người được đổi tên theo, giữ mã)
  begin n := public.app_cn_person_save(array[did], 'Người thử 151 xyz đổi', '', 'khac'); t := 'đổi được ' || n || ' khoản';
  exception when others then t := 'BỊ CHẶN: ' || sqlerrm; end;
  select (select name from public.debt_people where id = pid) = 'Người thử 151 xyz đổi' and d.person_id = pid and d.table_name = 'Người thử 151 xyz đổi' into ok from public.shift_debts d where d.id = did;
  rep := rep || E'\n' || case when t = 'đổi được 1 khoản' and ok then 'ĐẠT' else 'HỎNG' end || format(' (5b) Công nợ đổi tên người: %s · người + khoản mang tên mới, giữ mã %s', t, ok);
  perform public.app_stc_person_save(pid, jsonb_build_object('branch_id', br, 'name', 'Người thử 151 xyz', 'grp', 'khac', 'active', 1));

  -- (6) xếp nợ ở một ca thật đã Xác nhận Fabi, kế toán đã nhập đủ, tháng chưa chốt (gỡ tạm dấu Hoàn thành nếu có — tự hoàn tác)
  select x.* into r from public.shift_reports x
   where x.branch_id = br and x.status = 'hoan_thanh' and left(x.work_date, 7) = to_char(public.vn_now(), 'YYYY-MM')
     and coalesce((public.app__stc_ds_state(x.id) ->> 'done')::boolean, false)
     and not (coalesce((public.app__ca_kt_state(x.id) ->> 'need')::boolean, false) and not coalesce((public.app__ca_kt_state(x.id) ->> 'ready')::boolean, false))
     and not public.app__fin_locked(x.branch_id, x.work_date)
   order by x.work_date desc, x.id desc limit 1;
  if r.id is null then
    rep := rep || E'\n    (6) tháng này cơ sở thử chưa có ca nào đã Xác nhận Fabi — bỏ qua phần xếp nợ trên ca thật (đã thử ở cục bộ)';
  else
    delete from public.stc_ca_done where report_id = r.id;
    insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind) values (br, r.id, 'bàn thử 151 xyz', 12000, chu.id, 'muon') returning id into d1;
    select count(*) into n from unnest(public.app__stc_ds_missing(r.id)) x where x like '%chưa xếp người + nhóm công nợ%';
    perform public.app_stc_debt_sort(d1, pid, 'khac');
    select * into s from public.shift_debts where id = d1;
    select count(*) into n2 from unnest(public.app__stc_ds_missing(r.id)) x where x like '%chưa xếp người + nhóm công nợ%';
    select x into j from jsonb_array_elements(public.app_stc_month(br, left(r.work_date, 7)) -> 'ca_debts') x where (x ->> 'id')::bigint = d1 and x ->> 't' = 'moi';
    rep := rep || E'\n' || case when n = 1 and n2 = 0 and s.person_id = pid and s.grp = 'khac' and s.sorted_at is not null and s.table_name = 'Người thử 151 xyz' and s.content = 'bàn thử 151 xyz'
          and (j ->> 'sorted')::boolean and (j ->> 'person_id')::bigint = pid then 'ĐẠT' else 'HỎNG' end
        || format(' (6) ca %s (%s %s): trước khi xếp bị đòi %s · sau khi xếp bị đòi %s · tên "%s" · NV ghi "%s" · sổ tháng đã xếp %s', r.id, r.work_date, r.shift, n, n2, s.table_name, s.content, j ->> 'sorted');
    insert into public.stc_ca_done(report_id, by_account) values (r.id, chu.id);
    begin perform public.app_stc_debt_sort(d1, pid, 'khach'); t := 'XẾP ĐƯỢC'; exception when others then t := sqlerrm; end;
    rep := rep || E'\n' || case when t like '%Mở lại trước%' then 'ĐẠT' else 'HỎNG' end || ' (6b) xếp khi ca đã Hoàn thành: ' || t;
  end if;

  -- (7) nhân viên: không xem / thêm người nợ, không xếp nợ được
  if nv.id is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
    begin perform public.app_stc_people(br); t := 'XEM ĐƯỢC'; exception when others then t := sqlerrm; end;
    begin perform public.app_stc_debt_sort(coalesce(d1, did), pid, 'khac'); g := 'XẾP ĐƯỢC'; exception when others then g := sqlerrm; end;
    rep := rep || E'\n' || case when t <> 'XEM ĐƯỢC' and g <> 'XẾP ĐƯỢC' then 'ĐẠT' else 'HỎNG' end || format(' (7) nhân viên: xem → %s · xếp → %s', left(t, 60), left(g, 60));
  else
    rep := rep || E'\n    (7) không có tài khoản nhân viên để thử';
  end if;

  raise exception 'REPORT>> %', rep;
end $$;
