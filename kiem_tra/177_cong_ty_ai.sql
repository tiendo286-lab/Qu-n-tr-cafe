-- Bài thử cho supabase/177_cong_ty_ai_ham.sql — Công ty AI: hàm cho trang (chỉ tài khoản Chủ).
-- Dữ liệu giả, REPORT>> tự hoàn tác. Chạy trên Postgres cục bộ sau khi nạp 176 + 177:
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/177_cong_ty_ai.sql
do $$
declare rep text := ''; n int; j jsonb; msg text; ok boolean; hq text;
  CHU constant text := '00000000-0000-0000-0000-000000000001';
  QL  constant text := '00000000-0000-0000-0000-000000000003';
  v_gd bigint; v_tk bigint; v_kho bigint; v_kt bigint; v_tep bigint; v_kt2 bigint; kt_id bigint;
begin
  hq := to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1, 'YYYY-MM-DD');

  -- ===== tài khoản quản lý bị chặn
  perform set_config('request.jwt.claims', json_build_object('sub', QL, 'role', 'authenticated')::text, true);
  rep := rep || case when public.app_ai_la_chu() = false then 'ĐẠT' else 'HỎNG' end || ' quản lý: app_ai_la_chu = false' || chr(10);
  n := 0;
  begin perform public.app_ai_tong_quan(); exception when others then if sqlerrm like '%chỉ dành cho Chủ%' then n := n + 1; end if; end;
  begin perform public.app_ai_tao_viec('kho', 'x'); exception when others then if sqlerrm like '%chỉ dành cho Chủ%' then n := n + 1; end if; end;
  begin perform public.app_ai_tep(1); exception when others then if sqlerrm like '%chỉ dành cho Chủ%' then n := n + 1; end if; end;
  begin perform public.app_ai_lich_su('tat_ca'); exception when others then if sqlerrm like '%chỉ dành cho Chủ%' then n := n + 1; end if; end;
  rep := rep || case when n = 4 then 'ĐẠT' else 'HỎNG' end || ' quản lý gọi hàm bị chặn "chỉ dành cho Chủ" (' || n || '/4)' || chr(10);
  rep := rep || case when not has_function_privilege('anon', 'public.app_ai_tong_quan()', 'execute') then 'ĐẠT' else 'HỎNG' end || ' anon không gọi được hàm trang' || chr(10);

  -- ===== Chủ tạo việc
  perform set_config('request.jwt.claims', json_build_object('sub', CHU, 'role', 'authenticated')::text, true);
  rep := rep || case when public.app_ai_la_chu() then 'ĐẠT' else 'HỎNG' end || ' Chủ: app_ai_la_chu = true' || chr(10);
  v_gd := public.app_ai_tao_viec('gd', 'Thử trà vải ở LL, nhớ tính giá vốn');
  select count(*) into n from public.ai_viec where id = v_gd and loai = 'de_xuat_giao' and trang_thai = 'cho_lam' and can_chay
     and exists (select 1 from public.ai_tin where viec_id = v_gd and nguoi = 'anh' and hanh_dong = 'giao');
  rep := rep || case when n = 1 then 'ĐẠT' else 'HỎNG' end || ' Gửi Giám đốc → việc đề xuất giao, Chờ làm, có tin anh' || chr(10);
  v_tk := public.app_ai_tao_viec('tk', 'Họp quản lý: đổi giờ ca sáng');
  rep := rep || case when (select loai from public.ai_viec where id = v_tk) = 'ghi_chep' then 'ĐẠT' else 'HỎNG' end || ' Gửi Thư ký → ghi chép' || chr(10);
  msg := '';
  begin perform public.app_ai_tao_viec('kho', '   '); exception when others then msg := sqlerrm; end;
  rep := rep || case when msg like '%Anh nói, gõ hoặc kèm tệp trước đã%' then 'ĐẠT' else 'HỎNG' end || ' việc trống bị từ chối' || chr(10);

  -- ===== tệp
  msg := '';
  begin perform public.app_ai_tai_tep('a.heic', 'image/heic', encode('abc'::bytea, 'base64')); exception when others then msg := sqlerrm; end;
  rep := rep || case when msg like '%Loại tệp này chưa nhận%' then 'ĐẠT' else 'HỎNG' end || ' tệp HEIC bị từ chối' || chr(10);
  msg := '';
  begin perform public.app_ai_tai_tep('to.pdf', 'application/pdf', encode(convert_to(repeat('x', 6000000), 'UTF8'), 'base64')); exception when others then msg := sqlerrm; end;
  rep := rep || case when msg like '%Tệp quá 5 MB%' then 'ĐẠT' else 'HỎNG' end || ' tệp 6 MB bị từ chối' || chr(10);
  v_tep := public.app_ai_tai_tep('gia.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', encode('xlsx'::bytea, 'base64'));
  v_kho := public.app_ai_tao_viec('kho', '', array[v_tep]);
  select count(*) into n from public.ai_viec v where v.id = v_kho and v.tieu_de = 'gia.xlsx' and exists (select 1 from public.ai_tep where id = v_tep and viec_id = v_kho);
  rep := rep || case when n = 1 then 'ĐẠT' else 'HỎNG' end || ' việc chỉ kèm tệp: tiêu đề = tên tệp, tệp gắn vào việc' || chr(10);
  j := public.app_ai_tep(v_tep);
  rep := rep || case when j ->> 'ten' = 'gia.xlsx' and decode(j ->> 'base64', 'base64') = 'xlsx'::bytea then 'ĐẠT' else 'HỎNG' end || ' đọc lại tệp' || chr(10);

  -- ===== Mac làm việc Giám đốc → đề xuất → Chủ đồng ý (2 lần)
  update public.ai_viec set trang_thai = 'dang_lam', can_chay = false, bat_dau = now() where id = v_gd;
  perform public.app__ai_ghi_ket_qua(v_gd, 'cho_anh', '✅ CẦN DUYỆT Em định giao 2 việc',
    '{"giao":[{"phong":"rd","tieu_de":"Thử trà vải","noi_dung":"Kế hoạch thử ở LL"},{"phong":"kho","tieu_de":"Giá nhập vải","noi_dung":"Gửi R&D"}]}', null);
  j := public.app_ai_tong_quan();
  rep := rep || case when exists (select 1 from jsonb_array_elements(j -> 'cho_anh') e where (e ->> 'id')::bigint = v_gd) then 'ĐẠT' else 'HỎNG' end || ' tổng quan: việc đề xuất nằm trong Chờ anh' || chr(10);
  rep := rep || case when (select e ->> 'trang_thai' from jsonb_array_elements(j -> 'phong') e where e ->> 'ma' = 'gd') = 'cho_anh' then 'ĐẠT' else 'HỎNG' end || ' tổng quan: ô Giám đốc màu Chờ anh' || chr(10);
  perform public.app_ai_dong_y(v_gd);
  select count(*) into n from public.ai_viec where cha_id = v_gd and loai = 'viec' and trang_thai = 'cho_lam' and nguoi_tao = 1;
  rep := rep || case when n = 2 and (select trang_thai from public.ai_viec where id = v_gd) = 'xong' then 'ĐẠT' else 'HỎNG' end || ' Đồng ý tạo đúng 2 việc con, việc cha Xong (' || n || ')' || chr(10);
  msg := '';
  begin perform public.app_ai_dong_y(v_gd); exception when others then msg := sqlerrm; end;
  select count(*) into n from public.ai_viec where cha_id = v_gd;
  rep := rep || case when msg like '%Việc này đã xử lý%' and n = 2 then 'ĐẠT' else 'HỎNG' end || ' Đồng ý lần 2 bị chặn, không thêm việc con' || chr(10);

  -- ===== trả lời
  update public.ai_viec set trang_thai = 'dang_lam', can_chay = false, bat_dau = now() where id = v_kho;
  msg := '';
  begin perform public.app_ai_tra_loi(v_kho, 'thêm'); exception when others then msg := sqlerrm; end;
  rep := rep || case when msg like '%Phòng đang làm, chờ xong rồi nhắn%' then 'ĐẠT' else 'HỎNG' end || ' nhắn vào việc Đang làm bị chặn' || chr(10);
  perform public.app__ai_ghi_ket_qua(v_kho, 'cho_anh', '❓ HỎI ANH 3 mặt hàng chưa có giá', null, null);
  perform public.app_ai_tra_loi(v_kho, 'Lấy giá lần nhập mới nhất');
  select count(*) into n from public.ai_viec where id = v_kho and trang_thai = 'cho_lam' and can_chay;
  rep := rep || case when n = 1 then 'ĐẠT' else 'HỎNG' end || ' trả lời việc Chờ anh → mở lại Chờ làm' || chr(10);

  -- ===== kiến thức chung qua Giám đốc
  v_kt := public.app_ai_gui_kien_thuc(null, 'Sữa tươi mở hộp dùng trong 24 giờ');
  select count(*) into n from public.ai_viec where id = v_kt and phong = 'gd' and loai = 'doc_kien_thuc' and cho_ca_cong_ty;
  rep := rep || case when n = 1 then 'ĐẠT' else 'HỎNG' end || ' nạp kiến thức chung → việc đọc kiến thức ở Giám đốc' || chr(10);
  update public.ai_viec set trang_thai = 'dang_lam', can_chay = false, bat_dau = now() where id = v_kt;
  perform public.app__ai_ghi_ket_qua(v_kt, 'cho_anh', '✅ CẦN DUYỆT Em hiểu là: …', '{"hieu_la":["Sữa mở hộp dùng 24 giờ"]}', null);
  perform public.app_ai_dong_y(v_kt);
  select id into kt_id from public.ai_kien_thuc where phong is null and noi_dung = 'Sữa tươi mở hộp dùng trong 24 giờ' and loai = 'da_chot' and nguon_viec_id = v_kt;
  rep := rep || case when kt_id is not null then 'ĐẠT' else 'HỎNG' end || ' Đúng → ghi nguyên văn vào kiến thức chung' || chr(10);
  -- kiến thức phòng kèm tệp
  v_tep := public.app_ai_tai_tep('cong-thuc.jpg', 'image/jpeg', encode('jpg'::bytea, 'base64'));
  v_kt2 := public.app_ai_gui_kien_thuc('ns', 'Công thức pha chế mới', array[v_tep]);
  update public.ai_viec set trang_thai = 'dang_lam', can_chay = false, bat_dau = now() where id = v_kt2;
  perform public.app__ai_ghi_ket_qua(v_kt2, 'cho_anh', '✅ CẦN DUYỆT', '{"hieu_la":["a"]}', null);
  perform public.app_ai_dong_y(v_kt2);
  select count(*) into n from public.ai_kien_thuc k join public.ai_tep t on t.kien_thuc_id = k.id
   where k.phong = 'ns' and k.loai = 'tai_lieu' and k.noi_dung = 'cong-thuc.jpg';
  rep := rep || case when n = 1 then 'ĐẠT' else 'HỎNG' end || ' tệp kèm kiến thức → dòng Tài liệu, tệp gắn kiến thức' || chr(10);
  j := public.app_ai_phong('ns');
  rep := rep || case when jsonb_array_length(j -> 'kien_thuc') >= 2 and jsonb_array_length(j -> 'kien_thuc_chung') = 0 then 'ĐẠT' else 'HỎNG' end || ' trang phòng Nhân sự có kiến thức của phòng' || chr(10);
  j := public.app_ai_phong('gd');
  rep := rep || case when exists (select 1 from jsonb_array_elements(j -> 'kien_thuc_chung') e where (e ->> 'id')::bigint = kt_id) then 'ĐẠT' else 'HỎNG' end || ' trang Giám đốc có kiến thức chung' || chr(10);
  perform public.app_ai_bo_kien_thuc(kt_id, true);
  rep := rep || case when (select trang_thai from public.ai_kien_thuc where id = kt_id) = 'da_bo' then 'ĐẠT' else 'HỎNG' end || ' bỏ kiến thức → đã bỏ' || chr(10);
  perform public.app_ai_bo_kien_thuc(kt_id, false);
  rep := rep || case when (select trang_thai from public.ai_kien_thuc where id = kt_id) = 'dang_dung' then 'ĐẠT' else 'HỎNG' end || ' dùng lại → đang dùng' || chr(10);
  rep := rep || case when jsonb_array_length(public.app_ai_kien_thuc_chung()) >= 1 then 'ĐẠT' else 'HỎNG' end || ' danh sách kiến thức chung' || chr(10);

  -- ===== model
  perform public.app_ai_doi_model('kho', 'nhanh');
  rep := rep || case when (select model from public.ai_phong where ma = 'kho') = 'nhanh' then 'ĐẠT' else 'HỎNG' end || ' đổi model phòng Kho' || chr(10);

  -- ===== doanh thu hôm qua
  j := public.app_ai_tong_quan() -> 'doanh_thu';
  select count(*) into n from jsonb_array_elements(j -> 'co_so') e;
  rep := rep || case when j ->> 'ngay' = hq and n = (select count(*) from public.branches where status = 'Đang hoạt động') then 'ĐẠT' else 'HỎNG' end || ' doanh thu: đúng ngày hôm qua, đủ cơ sở' || chr(10);
  rep := rep || case when (select e -> 'net' from jsonb_array_elements(j -> 'co_so') e where e ->> 'ma' = 'CS1') = 'null'::jsonb then 'ĐẠT' else 'HỎNG' end || ' cơ sở chưa có Fabi → net null' || chr(10);
  insert into public.fabi_shifts(ma_ca, store_name, branch_id, work_date, net) values ('T177A', 'CS1', 1, hq, 100), ('T177B', 'CS1', 1, hq, 50);
  j := public.app_ai_tong_quan() -> 'doanh_thu';
  rep := rep || case when (select (e ->> 'net')::numeric from jsonb_array_elements(j -> 'co_so') e where e ->> 'ma' = 'CS1') = 150 then 'ĐẠT' else 'HỎNG' end || ' doanh thu cộng các ca = 150' || chr(10);

  -- ===== việc + lịch sử
  j := public.app_ai_viec(v_kho);
  rep := rep || case when jsonb_array_length(j -> 'tin') >= 3 and jsonb_array_length(j -> 'tep') = 1 and j -> 'viec' ->> 'trang_thai' = 'cho_lam' then 'ĐẠT' else 'HỎNG' end || ' chi tiết việc có tin + tệp' || chr(10);
  update public.ai_viec set trang_thai = 'cho_anh' where id = v_tk;
  j := public.app_ai_lich_su('chua_tra_loi');
  rep := rep || case when exists (select 1 from jsonb_array_elements(j) e where (e ->> 'viec_id')::bigint = v_tk and e ->> 'loai' = 'chua_tra_loi') then 'ĐẠT' else 'HỎNG' end || ' lịch sử: việc Chờ anh hiện Chưa trả lời' || chr(10);
  update public.ai_viec set cap_nhat = now() - interval '3 days' where id = v_tk;
  j := public.app_ai_lich_su('chua_tra_loi');
  rep := rep || case when exists (select 1 from jsonb_array_elements(j) e where (e ->> 'viec_id')::bigint = v_tk and e ->> 'loai' = 'qua_han') then 'ĐẠT' else 'HỎNG' end || ' lịch sử: Chờ anh quá 2 ngày → Quá hạn' || chr(10);
  j := public.app_ai_lich_su('da_duyet');
  rep := rep || case when exists (select 1 from jsonb_array_elements(j) e where (e ->> 'viec_id')::bigint = v_gd and e ->> 'loai' = 'da_duyet') then 'ĐẠT' else 'HỎNG' end || ' lịch sử: Đồng ý hiện Đã duyệt' || chr(10);
  j := public.app_ai_lich_su('chua_xong');
  rep := rep || case when exists (select 1 from jsonb_array_elements(j) e where (e ->> 'viec_id')::bigint = v_kho)
                 and not exists (select 1 from jsonb_array_elements(j) e where (e ->> 'viec_id')::bigint = v_gd) then 'ĐẠT' else 'HỎNG' end || ' lịch sử: ý chưa xong có việc Kho, không có việc đã Xong' || chr(10);

  raise exception 'REPORT>> %', chr(10) || rep;
end $$;
