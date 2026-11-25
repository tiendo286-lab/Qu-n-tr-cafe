-- Bài thử cho supabase/176_cong_ty_ai_bang.sql — Công ty AI: bảng, vai ai_viec, 7 phòng, hàm nội bộ cho máy Mac.
-- Dữ liệu giả, REPORT>> tự hoàn tác. Chạy trên Postgres cục bộ:
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/176_cong_ty_ai.sql
do $$
declare rep text := ''; n int; v_kho1 bigint; v_kho2 bigint; v_tk bigint; v_ql bigint; v_treo bigint; t text; ids bigint[]; msg text;
  procedure_ok boolean;
begin
  -- 7 phòng + mặc định
  select count(*) into n from public.ai_phong;
  rep := rep || case when n = 7 then 'ĐẠT' else 'HỎNG' end || ' có 7 phòng (' || n || ')' || chr(10);
  select model into t from public.ai_phong where ma = 'tk';
  rep := rep || case when t = 'nhanh' then 'ĐẠT' else 'HỎNG' end || ' Thư ký mặc định model nhanh' || chr(10);
  select count(*) into n from public.ai_phong where ma = 'kt' and ghi_chu_khoa like 'Soát tiền ca%';
  rep := rep || case when n = 1 then 'ĐẠT' else 'HỎNG' end || ' Kế toán có dòng khoá soát tiền ca' || chr(10);

  -- quyền
  rep := rep || case when not has_table_privilege('anon', 'public.ai_viec', 'select')
                      and not has_table_privilege('authenticated', 'public.ai_viec', 'select')
                      and not has_table_privilege('authenticated', 'public.ai_tep', 'select') then 'ĐẠT' else 'HỎNG' end
             || ' anon/authenticated không đọc thẳng bảng ai_*' || chr(10);
  rep := rep || case when not has_function_privilege('authenticated', 'public.app__ai_nhan_viec(integer)', 'execute')
                      and not has_function_privilege('anon', 'public.app__ai_ghi_ket_qua(bigint,text,text,jsonb,text)', 'execute')
                      and has_function_privilege('ai_viec', 'public.app__ai_nhan_viec(integer)', 'execute') then 'ĐẠT' else 'HỎNG' end
             || ' hàm nội bộ chỉ ai_viec gọi được' || chr(10);

  -- nhận việc: 2 việc kho + 1 việc tk + 1 việc do ql1 tạo (không được nhận)
  insert into public.ai_viec(phong, tieu_de, nguoi_tao, tao_luc) values ('kho', 'kho 1', 1, now() - interval '3 minutes') returning id into v_kho1;
  insert into public.ai_viec(phong, tieu_de, nguoi_tao, tao_luc) values ('kho', 'kho 2', 1, now() - interval '2 minutes') returning id into v_kho2;
  insert into public.ai_viec(phong, tieu_de, nguoi_tao, tao_luc) values ('tk', 'tk 1', 1, now() - interval '1 minutes') returning id into v_tk;
  insert into public.ai_viec(phong, tieu_de, nguoi_tao, tao_luc) values ('rd', 'của ql1', 3, now() - interval '5 minutes') returning id into v_ql;

  execute 'set local role ai_viec';
  select array_agg(id order by id) into ids from public.app__ai_nhan_viec(2);
  rep := rep || case when ids = array[v_kho1, v_tk] then 'ĐẠT' else 'HỎNG' end || ' nhận 2 việc ở 2 phòng khác nhau, việc kho cũ nhất (' || coalesce(ids::text, 'null') || ')' || chr(10);
  select count(*) into n from public.app__ai_nhan_viec(2);
  rep := rep || case when n = 0 then 'ĐẠT' else 'HỎNG' end || ' gọi lại không nhận thêm khi đủ 2 việc (' || n || ')' || chr(10);
  execute 'reset role';
  select count(*) into n from public.ai_viec where id = v_ql and trang_thai = 'cho_lam';
  rep := rep || case when n = 1 then 'ĐẠT' else 'HỎNG' end || ' việc do quản lý tạo không bao giờ được nhận' || chr(10);
  select count(*) into n from public.ai_viec where id = v_kho1 and trang_thai = 'dang_lam' and not can_chay and bat_dau is not null;
  rep := rep || case when n = 1 then 'ĐẠT' else 'HỎNG' end || ' việc nhận chuyển Đang làm, có giờ bắt đầu' || chr(10);

  -- ghi kết quả
  execute 'set local role ai_viec';
  perform public.app__ai_ghi_ket_qua(v_kho1, 'cho_anh', '❓ HỎI ANH Ngày kiểm kê?', null, null);
  execute 'reset role';
  select count(*) into n from public.ai_viec v where v.id = v_kho1 and v.trang_thai = 'cho_anh'
     and (select count(*) from public.ai_tin where viec_id = v_kho1 and nguoi = 'phong') = 1;
  rep := rep || case when n = 1 then 'ĐẠT' else 'HỎNG' end || ' ghi kết quả → Chờ anh, có 1 tin của phòng' || chr(10);
  begin
    execute 'set local role ai_viec';
    perform public.app__ai_ghi_ket_qua(v_kho1, 'xong', 'lần 2', null, null);
    execute 'reset role';
    rep := rep || 'HỎNG ghi kết quả lần 2 vào việc không còn Đang làm phải báo lỗi' || chr(10);
  exception when others then
    execute 'reset role';
    rep := rep || 'ĐẠT ghi kết quả vào việc không Đang làm bị chặn' || chr(10);
  end;
  execute 'set local role ai_viec';
  perform public.app__ai_ghi_ket_qua(v_tk, 'xong', '✅ XONG', null, null);
  execute 'reset role';
  select count(*) into n from public.ai_viec where id = v_tk and trang_thai = 'xong' and xong_luc is not null;
  rep := rep || case when n = 1 then 'ĐẠT' else 'HỎNG' end || ' Xong có giờ xong' || chr(10);

  -- dọn việc treo
  insert into public.ai_viec(phong, tieu_de, nguoi_tao, trang_thai, can_chay, bat_dau) values ('ns', 'treo', 1, 'dang_lam', false, now() - interval '40 minutes') returning id into v_treo;
  execute 'set local role ai_viec';
  select public.app__ai_don_viec_treo() into n;
  execute 'reset role';
  rep := rep || case when n >= 1 and exists (select 1 from public.ai_viec where id = v_treo and trang_thai = 'ket' and ly_do_ket = 'Máy Mac dừng giữa chừng')
             then 'ĐẠT' else 'HỎNG' end || ' việc Đang làm quá 35 phút → Kẹt "Máy Mac dừng giữa chừng"' || chr(10);

  -- nhập kiến thức không trùng
  execute 'set local role ai_viec';
  rep := rep || case when public.app__ai_nhap_kien_thuc('kho', 'A thử') then 'ĐẠT' else 'HỎNG' end || ' nhập kiến thức mới' || chr(10);
  rep := rep || case when not public.app__ai_nhap_kien_thuc('kho', 'A thử') then 'ĐẠT' else 'HỎNG' end || ' nhập lại không trùng' || chr(10);
  rep := rep || case when public.app__ai_nhap_kien_thuc(null, 'B chung thử') then 'ĐẠT' else 'HỎNG' end || ' nhập kiến thức chung (phòng trống)' || chr(10);
  -- nhịp tim
  perform public.app__ai_nhip_tim('thu', true);
  execute 'reset role';
  select count(*) into n from public.ai_mac where id = 1 and phien_ban = 'thu' and dang_nhap_loi and lan_cuoi > now() - interval '1 minute';
  rep := rep || case when n = 1 then 'ĐẠT' else 'HỎNG' end || ' nhịp tim ghi giờ + lỗi đăng nhập' || chr(10);

  raise exception 'REPORT>> %', chr(10) || rep;
end $$;
