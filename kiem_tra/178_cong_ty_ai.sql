-- Bài thử cho supabase/178_cong_ty_ai_thong_bao.sql — Công ty AI: đăng ký thông báo, gửi thông báo, nhịp tim máy Mac.
-- CSDL cục bộ không có pg_net: gửi thông báo phải trả false, không lỗi. REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/178_cong_ty_ai.sql
do $$
declare rep text := ''; n int; v bigint; msg text;
  CHU constant text := '00000000-0000-0000-0000-000000000001';
  QL  constant text := '00000000-0000-0000-0000-000000000003';
begin
  -- quản lý không đăng ký được
  perform set_config('request.jwt.claims', json_build_object('sub', QL, 'role', 'authenticated')::text, true);
  msg := '';
  begin perform public.app_ai_dang_ky_thong_bao('https://push.example/1', 'k', 'a'); exception when others then msg := sqlerrm; end;
  rep := rep || case when msg like '%chỉ dành cho Chủ%' then 'ĐẠT' else 'HỎNG' end || ' quản lý không đăng ký thông báo được' || chr(10);

  -- Chủ đăng ký 2 lần cùng thiết bị → 1 dòng
  perform set_config('request.jwt.claims', json_build_object('sub', CHU, 'role', 'authenticated')::text, true);
  perform public.app_ai_dang_ky_thong_bao('https://push.example/1', 'k1', 'a1');
  perform public.app_ai_dang_ky_thong_bao('https://push.example/1', 'k2', 'a2');
  select count(*) into n from public.ai_thong_bao where endpoint = 'https://push.example/1' and p256dh = 'k2';
  rep := rep || case when n = 1 and (select count(*) from public.ai_thong_bao where endpoint = 'https://push.example/1') = 1 then 'ĐẠT' else 'HỎNG' end || ' đăng ký lại cùng thiết bị → 1 dòng, khoá mới' || chr(10);

  -- không có pg_net / chưa cài đặt: gửi trả false, đổi trạng thái việc không lỗi
  rep := rep || case when public.app__ai_gui_thong_bao('Thử', 'nội dung', '#trang-dau') = false then 'ĐẠT' else 'HỎNG' end || ' chưa có pg_net → gửi thông báo trả false' || chr(10);
  insert into public.ai_viec(phong, tieu_de, nguoi_tao, trang_thai, can_chay, bat_dau) values ('kho', 'thử thông báo', 1, 'dang_lam', false, now()) returning id into v;
  begin
    perform public.app__ai_ghi_ket_qua(v, 'cho_anh', '❓ HỎI ANH', null, null);
    rep := rep || 'ĐẠT đổi trạng thái việc (kích hoạt trigger thông báo) không lỗi' || chr(10);
  exception when others then
    rep := rep || 'HỎNG trigger thông báo làm lỗi: ' || sqlerrm || chr(10);
  end;

  -- chỉ báo khi việc rời trạng thái Đang làm (kết quả của máy Mac), không báo khi chính anh bấm Đồng ý / Đóng việc
  rep := rep || case when (select pg_get_triggerdef(oid) from pg_trigger where tgname = 'ai_viec_bao') like '%old.trang_thai = ''dang_lam''%'
             then 'ĐẠT' else 'HỎNG' end || ' thông báo chỉ khi việc rời Đang làm' || chr(10);

  -- nhịp tim: mất quá 15 phút → báo 1 lần; có lại → hết cờ
  update public.ai_mac set lan_cuoi = now() - interval '20 minutes', da_bao_mat = false where id = 1;
  perform public.app__ai_kiem_nhip_tim();
  rep := rep || case when (select da_bao_mat from public.ai_mac where id = 1) then 'ĐẠT' else 'HỎNG' end || ' Mac mất 20 phút → đánh dấu đã báo' || chr(10);
  perform public.app__ai_kiem_nhip_tim();
  rep := rep || case when (select da_bao_mat from public.ai_mac where id = 1) then 'ĐẠT' else 'HỎNG' end || ' kiểm lại không đổi (chỉ báo 1 lần)' || chr(10);
  update public.ai_mac set lan_cuoi = now() where id = 1;
  perform public.app__ai_kiem_nhip_tim();
  rep := rep || case when not (select da_bao_mat from public.ai_mac where id = 1) then 'ĐẠT' else 'HỎNG' end || ' Mac có lại → hết cờ đã báo' || chr(10);

  -- quyền
  rep := rep || case when not has_table_privilege('authenticated', 'public.ai_cai_dat', 'select')
                      and not has_table_privilege('authenticated', 'public.ai_thong_bao', 'select')
                      and not has_function_privilege('authenticated', 'public.app__ai_gui_thong_bao(text,text,text)', 'execute')
                      and not has_function_privilege('anon', 'public.app__ai_kiem_nhip_tim()', 'execute') then 'ĐẠT' else 'HỎNG' end
             || ' bảng cài đặt / đăng ký và hàm gửi không mở cho web' || chr(10);

  raise exception 'REPORT>> %', chr(10) || rep;
end $$;
