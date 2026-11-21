-- Bài thử máy chủ cho tệp 156, 157, 158 (chặng 2) trên dữ liệu thật (tự hoàn tác). Gửi CÙNG MỘT LẦN, theo thứ tự:
--   begin isolation level repeatable read; → kiem_tra/chang2_156_158_truoc.sql → 156 → 157 → 158 (mỗi tệp 2 lần) → tệp này
-- Khi CHẠY THẬT: dùng bản chép đổi dòng cuối thành chốt chặn (HỎNG thì raise, ĐẠT thì để commit lưu).
do $$
declare chu public.accounts; rep text := ''; r2 record; g text; a0 jsonb; b0 jsonb; n int := 0; n2 int := 0; t text := ''; okb boolean; k int; kd int; d text; m int; m2 int;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  -- (0) sổ tháng giống hệt trước, trừ dấu Hoàn thành ('done') của các ca được trả về
  for r2 in select t0.branch_id, t0.j o, public.app_stc_month(t0.branch_id, to_char(public.vn_now(), 'YYYY-MM')) nw from pg_temp.tc2_so t0 order by 1 loop
    n := n + 1; okb := true;
    for g in select jsonb_object_keys(r2.o) union select jsonb_object_keys(r2.nw) loop
      a0 := r2.o -> g; b0 := r2.nw -> g;
      if g = 'cas' then
        a0 := (select coalesce(jsonb_agg(c - 'done' order by c ->> 'id'), '[]') from jsonb_array_elements(a0) c);
        b0 := (select coalesce(jsonb_agg(c - 'done' order by c ->> 'id'), '[]') from jsonb_array_elements(b0) c);
      elsif g = 'open_debts' and jsonb_typeof(a0) = 'array' and jsonb_typeof(b0) = 'array' then   -- cùng ngày thì thứ tự hiện không cố định: so theo mã khoản
        a0 := (select coalesce(jsonb_agg(c order by c ->> 'id'), '[]') from jsonb_array_elements(a0) c);
        b0 := (select coalesce(jsonb_agg(c order by c ->> 'id'), '[]') from jsonb_array_elements(b0) c);
      end if;
      if a0 is distinct from b0 then okb := false; t := t || format(E'\n    cơ sở %s · khoá %s khác', r2.branch_id, g); end if;
    end loop;
    if okb then n2 := n2 + 1; end if;
  end loop;
  rep := rep || E'\n' || case when n > 0 and n = n2 then 'ĐẠT' else 'HỎNG' end || format(' (0) sổ tháng cũ = mới (trừ dấu Hoàn thành) ở %s / %s cơ sở', n2, n) || t;
  -- (1) tiền từng ca ở Xác nhận Fabi (app__ca_money) 45 ngày gần đây không đổi — gồm cả phần lệch giao két (tệp 157)
  select count(*), count(*) filter (where t0.m is distinct from public.app__ca_money(t0.id)) into k, kd from pg_temp.tc2_ca t0;
  select string_agg(t0.id::text, ', ') into d from (select id from pg_temp.tc2_ca t0 where t0.m is distinct from public.app__ca_money(t0.id) limit 10) t0;
  rep := rep || E'\n' || case when k > 0 and kd = 0 then 'ĐẠT' else 'HỎNG' end || format(' (1) tiền của ca (Xác nhận Fabi): %s ca, %s ca khác%s', k, kd, coalesce(' — ' || d, ''));
  -- (2) kết quả tiền của ca không đổi dòng nào
  select count(*) into m from (select * from pg_temp.tc2_kq except select report_id, item, result, amount, computed, by_account from public.shift_report_results) x;
  select count(*) into m2 from (select report_id, item, result, amount, computed, by_account from public.shift_report_results except select * from pg_temp.tc2_kq) x;
  rep := rep || E'\n' || case when m = 0 and m2 = 0 then 'ĐẠT' else 'HỎNG' end || format(' (2) kết quả tiền của ca: %s dòng mất, %s dòng mới', m, m2);
  -- (3) tệp 158: đúng các ca đủ điều kiện được trả về, có bản sao; các ca khác giữ dấu Hoàn thành
  select count(*) into k from pg_temp.tc2_tra;
  select count(*) into kd from pg_temp.tc2_tra x where not exists (select 1 from public.stc_ca_done dn where dn.report_id = x.report_id)
     and exists (select 1 from public.stc_ca_done_tra_ve tv where tv.report_id = x.report_id);
  rep := rep || E'\n' || case when k > 0 and kd = k and (select count(*) from public.stc_ca_done) = (select x.so_dau from pg_temp.tc2_done x) - k then 'ĐẠT' else 'HỎNG' end
        || format(' (3) trả về %s / %s ca (bản sao đủ); còn %s dấu Hoàn thành (trước %s)', kd, k, (select count(*) from public.stc_ca_done), (select x.so_dau from pg_temp.tc2_done x));
  rep := rep || E'\n    theo cơ sở: ' || coalesce((select string_agg(cs || ' ' || c, ', ' order by cs) from (select coalesce(b.display_code, b.code) cs, count(*) c from pg_temp.tc2_tra x
        join public.shift_reports r on r.id = x.report_id join public.branches b on b.id = r.branch_id group by 1) z), '');
  -- (4) đã vá đủ chỗ + sổ tệp đã chạy
  rep := rep || E'\n' || case when position('không có số doanh thu' in pg_get_functiondef('public.app_stc_ds_fabi(bigint,text,text,text)'::regprocedure)) > 0
        and position('chặng 2 (21/11): ca trước THU THEO CA' in pg_get_functiondef('public.app__ca_hand(bigint)'::regprocedure)) > 0
        and (select count(*) from public.app_migrations where file in ('156_fabi_trong_doanh_thu.sql', '157_lech_ao_giao_ket.sql', '158_tra_ve_ca_web_tu_ghi.sql')) = 3
        and not has_function_privilege('authenticated', 'public.app__stc_tra_ve_ca_web()', 'execute')
      then 'ĐẠT' else 'HỎNG' end || ' (4) đã vá app_stc_ds_fabi (156), app__ca_hand (157), có hàm trả về (158, web không gọi được) + sổ tệp đã chạy';
  -- (5) "Lấy số máy Fabi" ở ô Doanh thu của ca LHP chiều 04/11 (máy không có số) bị chặn
  begin perform public.app_stc_ds_fabi(68, 'dt', null, null); t := 'LẤY ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%không có số doanh thu%' then 'ĐẠT' else 'HỎNG' end || ' (5) ca LHP chiều 04/11: Lấy số máy ở ô Doanh thu → ' || left(t, 90);
  raise exception 'REPORT>> %', rep;
end $$;
