-- Bài thử CỤC BỘ cho supabase/189_anh_cam_ket.sql (27/11/2026). Seed: Chủ A1, QL tổng A2, QL A3 / A4, NV Cấp 1 A5, NV mới A6, Kế toán A7. Chạy sau tệp 189 ×2:
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/anh_cam_ket_189_cuc_bo.sql
do $$
declare rep text := ''; j jsonb; r jsonb; e text; old text; c public.employee_commitments; login text := 'request.jwt.claims';
  u_kt text := '00000000-0000-0000-0000-000000000007'; u_c1 text := '00000000-0000-0000-0000-000000000005'; u_nv text := '00000000-0000-0000-0000-000000000006';
begin
  delete from public.employee_commitments where employee_id in (5, 6);
  -- (1) kế toán tải ảnh cho NV 6 khi chưa có dòng cam kết: trạng thái vẫn "chưa ký" (không bắt buộc đi kèm)
  perform set_config(login, json_build_object('sub', u_kt, 'role', 'authenticated')::text, true);
  old := public.app_tl_commit_photo(6, '6/a.jpg');
  select * into c from public.employee_commitments where employee_id = 6;
  rep := rep || E'\n' || case when old is null and c.photo_path = '6/a.jpg' and c.status = 'chua_ky' and c.photo_by = 7 and c.photo_at is not null then 'ĐẠT' else 'HỎNG' end || format(' (1) tải ảnh lần đầu: lưu đường dẫn, người, giờ; trạng thái giữ %s', c.status);
  -- (2) đổi trạng thái không làm mất ảnh; thiếu ảnh vẫn đổi được Đã ký và nộp
  perform public.app_tl_set_commit(6, 'da_ky_nop', null); perform public.app_tl_set_commit(5, 'da_ky_nop', null);
  select * into c from public.employee_commitments where employee_id = 6;
  rep := rep || E'\n' || case when c.status = 'da_ky_nop' and c.photo_path = '6/a.jpg' and (select status = 'da_ky_nop' and photo_path is null from public.employee_commitments where employee_id = 5) then 'ĐẠT' else 'HỎNG' end || ' (2) đổi trạng thái giữ nguyên ảnh; không có ảnh vẫn đổi được Đã ký và nộp';
  -- (3) đổi ảnh: trả đường dẫn cũ để web xoá tệp
  old := public.app_tl_commit_photo(6, '6/b.jpg');
  rep := rep || E'\n' || case when old = '6/a.jpg' and (select photo_path from public.employee_commitments where employee_id = 6) = '6/b.jpg' then 'ĐẠT' else 'HỎNG' end || format(' (3) đổi ảnh: trả ảnh cũ %s', old);
  -- (4) đường dẫn của nhân viên khác bị chặn
  e := null; begin perform public.app_tl_commit_photo(6, '5/x.jpg'); exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when e like '%không đúng nhân viên%' then 'ĐẠT' else 'HỎNG' end || format(' (4) ảnh để nhầm thư mục nhân viên khác: chặn — %s', coalesce(e, 'KHÔNG chặn'));
  -- (5) trang theo dõi có ảnh
  j := public.app_tl_follow();
  select x into r from jsonb_array_elements(j -> 'rows') x where (x ->> 'employee_id')::bigint = 6;
  rep := rep || E'\n' || case when r ->> 'commit_photo' = '6/b.jpg' and r ->> 'commit_photo_at' is not null and r ->> 'commit' = 'da_ky_nop' then 'ĐẠT' else 'HỎNG' end || ' (5) Theo dõi đọc & cam kết trả ảnh + giờ tải của NV 6';
  -- (6) nhân viên xem cam kết của mình; không tải / xoá được ảnh, kể cả của mình
  perform set_config(login, json_build_object('sub', u_nv, 'role', 'authenticated')::text, true);
  j := public.app_tl_my_commit();
  e := null; begin perform public.app_tl_commit_photo(6, '6/c.jpg'); exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when j ->> 'photo_path' = '6/b.jpg' and j ->> 'status' = 'da_ky_nop' and e like '%Chỉ Kế toán%' then 'ĐẠT' else 'HỎNG' end || format(' (6) nhân viên: xem được ảnh của mình, tự tải bị chặn — %s', coalesce(e, 'KHÔNG chặn'));
  perform set_config(login, json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  j := public.app_tl_my_commit();
  e := null; begin perform public.app_tl_follow(); exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when j ->> 'photo_path' is null and e is not null then 'ĐẠT' else 'HỎNG' end || ' (7) nhân viên khác: không thấy ảnh của NV 6, không vào được trang theo dõi';
  -- (8) xoá ảnh
  perform set_config(login, json_build_object('sub', u_kt, 'role', 'authenticated')::text, true);
  old := public.app_tl_commit_photo(6, null);
  select * into c from public.employee_commitments where employee_id = 6;
  rep := rep || E'\n' || case when old = '6/b.jpg' and c.photo_path is null and c.photo_at is null and c.status = 'da_ky_nop' then 'ĐẠT' else 'HỎNG' end || ' (8) xoá ảnh: trả ảnh cũ, trạng thái cam kết giữ nguyên';
  -- (9) luật kho tệp + quyền gọi
  rep := rep || E'\n' || case when (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('cam_ket_doc', 'cam_ket_them', 'cam_ket_xoa')) = 3
      and not has_function_privilege('anon', 'public.app_tl_commit_photo(bigint, text)', 'execute') and not has_function_privilege('anon', 'public.app_tl_my_commit()', 'execute')
      and (select not public from storage.buckets where id = 'cam-ket') then 'ĐẠT' else 'HỎNG' end || ' (9) kho ảnh riêng tư, đủ 3 luật, khách không gọi được hàm';
  raise exception 'REPORT>> %', rep;
end $$;
