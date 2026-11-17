-- Chạy cùng migration 105 trong giao dịch tự hoàn tác. Không dùng dữ liệu thật.
DO $test$
declare owner_uid uuid; owner_id bigint; kt_uid uuid; kt_id bigint; br bigint; inv_owner bigint; inv_kt bigint; inv_started bigint;
        bad boolean; paths jsonb; cases text[]:='{}'; d text:=to_char(public.vn_now()::date,'YYYY-MM-DD');
begin
  select id,auth_user_id into owner_id,owner_uid from public.accounts where system_role='chu' and locked=0 and auth_user_id is not null limit 1;
  select id,auth_user_id into kt_id,kt_uid from public.accounts where system_role='ke_toan' and locked=0 and auth_user_id is not null limit 1;
  if owner_id is null then raise exception 'FAIL cần tài khoản Chủ để kiểm thử quyền'; end if;
  if kt_id is null then
    kt_uid:=gen_random_uuid();
    insert into public.accounts(login_name,display_name,system_role,auth_user_id) values('t105_'||substr(gen_random_uuid()::text,1,8),'Kế toán kiểm thử 105','ke_toan',kt_uid) returning id into kt_id;
  end if;
  insert into public.branches(code,name,sort_order) values('T105_'||substr(gen_random_uuid()::text,1,6),'Cơ sở kiểm thử 105',999) returning id into br;
  insert into public.delivery_invoices(branch_id,work_date,created_by,kind,state,doc_no,ship_at)
  values(br,d,owner_id,'hoa_don','dang_chuyen','TEST105-OWNER',d||' 08:00') returning id into inv_owner;
  insert into public.delivery_invoice_files(invoice_id,path,name,mime,size,created_by) values(inv_owner,'test105/owner.xlsx','owner.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',10,owner_id);
  insert into public.delivery_invoices(branch_id,work_date,created_by,kind,state,doc_no,ship_at)
  values(br,d,kt_id,'hoa_don','dang_chuyen','TEST105-KT',d||' 09:00') returning id into inv_kt;
  insert into public.delivery_invoices(branch_id,work_date,created_by,kind,state,doc_no,ship_at)
  values(br,d,owner_id,'hoa_don','dang_chuyen','TEST105-START',d||' 10:00') returning id into inv_started;
  insert into public.delivery_lines(invoice_id,sort,name,qty_invoice,qty_received) values(inv_started,1,'Món thử',1,1);

  perform set_config('request.jwt.claim.sub',kt_uid::text,true);
  bad:=false; begin perform public.app_nh_delete(inv_kt); exception when others then bad:=position('Chỉ Chủ' in sqlerrm)>0; end;
  if not bad or not exists(select 1 from public.delivery_invoices where id=inv_kt) then raise exception 'FAIL Kế toán vẫn xóa được phiếu xuất'; end if;
  cases:=cases||'Kế toán gọi API bị chặn'::text;

  perform set_config('request.jwt.claim.sub',owner_uid::text,true);
  paths:=public.app_nh_delete(inv_owner);
  if exists(select 1 from public.delivery_invoices where id=inv_owner) or not (paths ? 'test105/owner.xlsx') then raise exception 'FAIL Chủ không xóa được phiếu chưa nhận hoặc thiếu đường dẫn dọn tệp: %',paths; end if;
  cases:=cases||'Chủ xóa phiếu chưa nhận và nhận danh sách tệp cần dọn'::text;
  bad:=false; begin perform public.app_nh_delete(inv_started); exception when others then bad:=position('đang nhận' in lower(sqlerrm))>0; end;
  if not bad or not exists(select 1 from public.delivery_invoices where id=inv_started) then raise exception 'FAIL phiếu đang nhận vẫn bị xóa'; end if;
  cases:=cases||'Phiếu nhân viên đã bắt đầu nhận bị khóa xóa'::text;
  raise exception 'REPORT>> %',array_to_string(cases,' | ');
end $test$;
