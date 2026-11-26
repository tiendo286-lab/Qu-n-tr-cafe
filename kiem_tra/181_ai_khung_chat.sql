-- Bài thử cho supabase/181_ai_khung_chat.sql — Công ty AI: khung chat (tệp theo tin, hỏi phần mới, nhắn khi đang làm, phòng gửi tệp).
-- Dữ liệu giả, REPORT>> tự hoàn tác. Chạy trên Postgres cục bộ sau khi nạp tới 181:
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/181_ai_khung_chat.sql
do $$
declare rep text := ''; n int; j jsonb; msg text;
  CHU constant text := '00000000-0000-0000-0000-000000000001';
  QL  constant text := '00000000-0000-0000-0000-000000000003';
  v bigint; v2 bigint; v3 bigint; t1 bigint; tin_giao bigint; tin_anh bigint; tin_phong bigint; tin_truoc bigint; ds bigint[];
begin
  -- ===== quyền
  perform set_config('request.jwt.claims', json_build_object('sub', QL, 'role', 'authenticated')::text, true);
  n := 0;
  begin perform public.app_ai_viec_moi(1, 0); exception when others then if sqlerrm like '%chỉ dành cho Chủ%' then n := n + 1; end if; end;
  begin perform public.app_ai_tra_loi(1, 'x', '{}'); exception when others then if sqlerrm like '%chỉ dành cho Chủ%' then n := n + 1; end if; end;
  rep := rep || case when n = 2 then 'ĐẠT' else 'HỎNG' end || ' quản lý gọi viec_moi / tra_loi bị chặn (' || n || '/2)' || chr(10);
  rep := rep || case when not has_function_privilege('ai_viec', 'public.app_ai_viec_moi(bigint, bigint)', 'execute') then 'ĐẠT' else 'HỎNG' end || ' ai_viec không gọi được app_ai_viec_moi' || chr(10);
  rep := rep || case when has_function_privilege('ai_viec', 'public.app__ai_ghi_tep(bigint, bigint, text, text, text)', 'execute')
                      and not has_function_privilege('authenticated', 'public.app__ai_ghi_tep(bigint, bigint, text, text, text)', 'execute') then 'ĐẠT' else 'HỎNG' end || ' app__ai_ghi_tep chỉ cho ai_viec' || chr(10);
  rep := rep || case when has_function_privilege('ai_viec', 'public.app__ai_ghi_ket_qua_tin(bigint, text, text, jsonb, text, bigint)', 'execute')
                      and not has_function_privilege('authenticated', 'public.app__ai_ghi_ket_qua_tin(bigint, text, text, jsonb, text, bigint)', 'execute') then 'ĐẠT' else 'HỎNG' end || ' ghi_ket_qua_tin chỉ cho ai_viec' || chr(10);
  rep := rep || case when (select count(*) from pg_proc where proname = 'app__ai_ghi_ket_qua') = 1 then 'ĐẠT' else 'HỎNG' end || ' chỉ một hàm app__ai_ghi_ket_qua (không trùng chữ ký)' || chr(10);

  -- ===== tệp cũ hiện ở tin giao đầu tiên
  perform set_config('request.jwt.claims', json_build_object('sub', CHU, 'role', 'authenticated')::text, true);
  t1 := public.app_ai_tai_tep('cham_cong.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', encode('xlsx'::bytea, 'base64'));
  v := public.app_ai_tao_viec('kho', 'Đối chiếu giao hàng', array[t1]);
  select id into tin_giao from public.ai_tin where viec_id = v and nguoi = 'anh' order by id limit 1;
  j := public.app_ai_viec(v);
  rep := rep || case when (j -> 'tep' -> 0 ->> 'tin_id')::bigint = tin_giao and j -> 'tep' -> 0 ->> 'nguon' = 'anh'
                      and (j -> 'tin' -> 0 ->> 'id')::bigint = tin_giao then 'ĐẠT' else 'HỎNG' end || ' app_ai_viec: tin có id, tệp cũ gắn tin giao đầu tiên' || chr(10);

  -- ===== hỏi phần mới
  j := public.app_ai_viec_moi(v, tin_giao);
  rep := rep || case when jsonb_array_length(j -> 'tin') = 0 and j -> 'viec' ->> 'trang_thai' = 'cho_lam' and j ? 'mac' then 'ĐẠT' else 'HỎNG' end || ' viec_moi sau tin giao: không có tin mới, có trạng thái + mac' || chr(10);
  tin_anh := public.app_ai_tra_loi(v, 'thêm');
  j := public.app_ai_viec_moi(v, tin_giao);
  rep := rep || case when jsonb_array_length(j -> 'tin') = 1 and (j -> 'tin' -> 0 ->> 'id')::bigint = tin_anh then 'ĐẠT' else 'HỎNG' end || ' viec_moi: đúng 1 tin mới, tra_loi trả id tin' || chr(10);

  -- ===== nhắn khi đang làm
  update public.ai_viec set trang_thai = 'dang_lam', can_chay = false, bat_dau = now() where id = v;
  tin_truoc := tin_anh;
  msg := '';
  begin tin_anh := public.app_ai_tra_loi(v, 'À tách phụ cấp'); exception when others then msg := sqlerrm; end;
  rep := rep || case when msg = '' and (select trang_thai from public.ai_viec where id = v) = 'dang_lam' then 'ĐẠT' else 'HỎNG' end || ' nhắn khi đang làm: không lỗi, vẫn Đang làm' || coalesce(' ' || nullif(msg, ''), '') || chr(10);
  tin_phong := public.app__ai_ghi_ket_qua_tin(v, 'xong', 'Đã xong bảng', null, null, tin_truoc);
  rep := rep || case when (select trang_thai from public.ai_viec where id = v) = 'cho_lam'
                      and (select nguoi from public.ai_tin where id = tin_phong) = 'phong' then 'ĐẠT' else 'HỎNG' end || ' xong nhưng còn tin anh chưa đọc → về Chờ làm, trả id tin phòng' || chr(10);

  update public.ai_viec set trang_thai = 'dang_lam', can_chay = false, bat_dau = now() where id = v;
  perform public.app__ai_ghi_ket_qua_tin(v, 'cho_anh', 'Mời anh duyệt', null, null, tin_anh);
  rep := rep || case when (select trang_thai from public.ai_viec where id = v) = 'cho_anh' then 'ĐẠT' else 'HỎNG' end || ' đã đọc hết tin anh → Chờ anh' || chr(10);

  v2 := public.app_ai_tao_viec('kt', 'Bảng lương');
  update public.ai_viec set trang_thai = 'dang_lam', can_chay = false, bat_dau = now() where id = v2;
  select max(id) into tin_truoc from public.ai_tin where viec_id = v2;
  tin_anh := public.app_ai_tra_loi(v2, 'nhớ phụ cấp');
  perform public.app__ai_ghi_ket_qua_tin(v2, 'ket', '', null, 'Quá 30 phút', tin_truoc);
  rep := rep || case when (select trang_thai from public.ai_viec where id = v2) = 'ket' and exists (select 1 from public.ai_tin where id = tin_anh) then 'ĐẠT' else 'HỎNG' end || ' kẹt: giữ Kẹt, tin anh còn' || chr(10);
  perform public.app_ai_tra_loi(v2, 'làm lại');
  rep := rep || case when (select trang_thai from public.ai_viec where id = v2) = 'cho_lam' then 'ĐẠT' else 'HỎNG' end || ' kẹt rồi nhắn → Chờ làm' || chr(10);

  -- ===== cũ 5 tham số vẫn chạy (người nhận việc cũ)
  update public.ai_viec set trang_thai = 'dang_lam', can_chay = false, bat_dau = now() where id = v2;
  msg := '';
  begin perform public.app__ai_ghi_ket_qua(v2, 'xong', 'ok', null, null); exception when others then msg := sqlerrm; end;
  rep := rep || case when msg = '' then 'ĐẠT' else 'HỎNG' end || ' ghi_ket_qua gọi kiểu cũ 5 tham số vẫn chạy' || coalesce(' ' || nullif(msg, ''), '') || chr(10);

  -- ===== phòng gửi tệp
  t1 := public.app__ai_ghi_tep(v, tin_phong, 'bang.csv', 'text/csv', encode('a,b'::bytea, 'base64'));
  rep := rep || case when exists (select 1 from public.ai_tep where id = t1 and nguon = 'phong' and tin_id = tin_phong and viec_id = v
                                    and nguoi_tao = (select nguoi_tao from public.ai_viec where id = v)) then 'ĐẠT' else 'HỎNG' end || ' ghi_tep: nguồn phòng, đúng tin, đúng người tạo' || chr(10);
  msg := '';
  begin perform public.app__ai_ghi_tep(v, tin_phong, 'x.sh', 'application/x-sh', encode('x'::bytea, 'base64')); exception when others then msg := sqlerrm; end;
  rep := rep || case when msg like '%Loại tệp này chưa nhận%' then 'ĐẠT' else 'HỎNG' end || ' ghi_tep: loại lạ bị từ chối' || chr(10);
  msg := '';
  select id into tin_giao from public.ai_tin where viec_id = v and nguoi = 'anh' order by id limit 1;
  begin perform public.app__ai_ghi_tep(v, tin_giao, 'a.md', 'text/markdown', encode('x'::bytea, 'base64')); exception when others then msg := sqlerrm; end;
  rep := rep || case when msg <> '' then 'ĐẠT' else 'HỎNG' end || ' ghi_tep: không gắn vào tin của anh' || chr(10);
  j := public.app_ai_viec_moi(v, tin_phong - 1);
  rep := rep || case when exists (select 1 from jsonb_array_elements(j -> 'tep') e where (e ->> 'id')::bigint = t1 and e ->> 'nguon' = 'phong') then 'ĐẠT' else 'HỎNG' end || ' viec_moi trả tệp phòng gửi' || chr(10);

  -- ===== anh trả lời kèm tệp
  v3 := public.app_ai_tao_viec('rd', 'Thử món');
  t1 := public.app_ai_tai_tep('anh.jpg', 'image/jpeg', encode('jpg'::bytea, 'base64'));
  tin_anh := public.app_ai_tra_loi(v3, '', array[t1]);
  rep := rep || case when (select noi_dung from public.ai_tin where id = tin_anh) = '(Anh gửi kèm tệp)'
                      and exists (select 1 from public.ai_tep where id = t1 and tin_id = tin_anh and viec_id = v3) then 'ĐẠT' else 'HỎNG' end || ' trả lời chỉ kèm tệp: gắn tệp vào tin + việc' || chr(10);
  ds := '{}';
  for n in 1..7 loop ds := ds || public.app_ai_tai_tep('a' || n || '.jpg', 'image/jpeg', encode('j'::bytea, 'base64')); end loop;
  msg := '';
  begin perform public.app_ai_tra_loi(v3, 'nhiều', ds); exception when others then msg := sqlerrm; end;
  rep := rep || case when msg like '%Tối đa 6 tệp mỗi lần%' then 'ĐẠT' else 'HỎNG' end || ' trả lời 7 tệp bị từ chối' || chr(10);

  -- ===== thông báo mở thẳng việc
  rep := rep || case when pg_get_functiondef('public.app__ai_viec_bao()'::regprocedure) like '%#viec-%' then 'ĐẠT' else 'HỎNG' end || ' thông báo trỏ #viec-<id>' || chr(10);

  raise exception 'REPORT>> %', chr(10) || rep;
end $$;
