-- Chạy cùng migration 108 trong giao dịch tự hoàn tác. Không dùng dữ liệu thật.
DO $test$
declare owner_uid uuid; owner_id bigint; kt_uid uuid; kt_id bigint; br bigint; inv_new bigint; inv_got bigint; ln bigint;
        bad boolean; paths jsonb; cases text[]:='{}'; d text:=to_char(public.vn_now()::date,'YYYY-MM-DD');
begin
  select id,auth_user_id into owner_id,owner_uid from public.accounts where system_role='chu' and locked=0 and auth_user_id is not null limit 1;
  if owner_id is null then raise exception 'FAIL cần tài khoản Chủ để kiểm thử quyền'; end if;
  kt_uid:=gen_random_uuid();
  insert into public.accounts(login_name,display_name,system_role,auth_user_id) values('t108_'||substr(gen_random_uuid()::text,1,8),'Kế toán kiểm thử 108','ke_toan',kt_uid) returning id into kt_id;
  insert into public.branches(code,name,sort_order) values('T108_'||substr(gen_random_uuid()::text,1,6),'Cơ sở kiểm thử 108',999) returning id into br;
  -- phiếu chưa nhận
  insert into public.delivery_invoices(branch_id,work_date,created_by,kind,state,doc_no,ship_at)
  values(br,d,owner_id,'hoa_don','dang_chuyen','TEST108-MOI',d||' 08:00') returning id into inv_new;
  insert into public.delivery_invoice_files(invoice_id,path,name,mime,size,created_by) values(inv_new,'test108/moi.xlsx','moi.xlsx','application/octet-stream',10,owner_id);
  -- phiếu đã nhận: có dòng hàng, ảnh nhận, ghi chú thiếu, hoá đơn giao, hoá đơn bù
  insert into public.delivery_invoices(branch_id,work_date,created_by,kind,state,doc_no,ship_at,deliv_path,bu_path)
  values(br,d,owner_id,'hoa_don','da_nhan','TEST108-DANHAN',d||' 09:00','test108/giao.jpg','test108/bu.pdf') returning id into inv_got;
  insert into public.delivery_invoice_files(invoice_id,path,name,mime,size,created_by) values(inv_got,'test108/px.xlsx','px.xlsx','application/octet-stream',10,owner_id);
  insert into public.delivery_lines(invoice_id,sort,name,qty_invoice,qty_received) values(inv_got,1,'Món thử',2,1) returning id into ln;
  insert into public.delivery_receipt_photos(invoice_id,path) values(inv_got,'test108/anh.jpg');
  insert into public.delivery_followups(branch_id,invoice_id,kind,name,qty) values(br,inv_got,'bu','Món thử',1);

  perform set_config('request.jwt.claims',json_build_object('sub',kt_uid,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',kt_uid::text,true);
  bad:=false; begin perform public.app_nh_delete(inv_got); exception when others then bad:=position('Chỉ Chủ' in sqlerrm)>0; end;
  if not bad or not exists(select 1 from public.delivery_invoices where id=inv_got) then raise exception 'FAIL Kế toán vẫn xóa được phiếu xuất'; end if;
  cases:=cases||'Kế toán gọi thẳng bị chặn'::text;

  perform set_config('request.jwt.claims',json_build_object('sub',owner_uid,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',owner_uid::text,true);
  paths:=public.app_nh_delete(inv_new);
  if exists(select 1 from public.delivery_invoices where id=inv_new) or paths<>'["test108/moi.xlsx"]'::jsonb then raise exception 'FAIL phiếu chưa nhận: %',paths; end if;
  cases:=cases||'Chủ xóa phiếu chưa nhận'::text;

  paths:=public.app_nh_delete(inv_got);
  if exists(select 1 from public.delivery_invoices where id=inv_got) then raise exception 'FAIL phiếu đã nhận chưa bị xóa'; end if;
  if not (paths ?& array['test108/px.xlsx','test108/anh.jpg','test108/giao.jpg','test108/bu.pdf']) or jsonb_array_length(paths)<>4 then raise exception 'FAIL thiếu tệp cần dọn: %',paths; end if;
  if exists(select 1 from public.delivery_lines where invoice_id=inv_got) or exists(select 1 from public.delivery_receipt_photos where invoice_id=inv_got)
     or exists(select 1 from public.delivery_followups where invoice_id=inv_got) or exists(select 1 from public.delivery_invoice_files where invoice_id=inv_got)
  then raise exception 'FAIL còn sót dữ liệu kèm phiếu'; end if;
  cases:=cases||'Chủ xóa phiếu ĐÃ NHẬN: sạch dòng hàng, ảnh, ghi chú thiếu, đủ 4 tệp cần dọn'::text;

  if public.app_nh_delete(inv_got)<>'[]'::jsonb then raise exception 'FAIL xóa lần 2 phải trả rỗng'; end if;
  cases:=cases||'Bấm xóa lần 2 không lỗi'::text;
  raise exception 'REPORT>> %',array_to_string(cases,' | ');
end $test$;
