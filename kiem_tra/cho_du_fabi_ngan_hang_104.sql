-- Chạy cùng migration 104 trong một giao dịch và ROLLBACK.
-- Dữ liệu hoàn toàn giả; thành công là lỗi có chủ ý REPORT>>.
DO $test$
declare uid uuid; acc bigint; emp bigint; br bigint; br2 bigint; rid bigint; rid2 bigint; source_id bigint; close_id bigint; ba bigint; old_debt bigint; debt2 bigint; parent_debt bigint; split_debt bigint; bad boolean; k jsonb; up jsonb; sub jsonb; mk text;
        d text := to_char(public.vn_now()::date,'YYYY-MM-DD'); cases text[] := '{}'; store text; store2 text; ex uuid:=gen_random_uuid();
begin
  select id,auth_user_id into acc,uid from public.accounts where system_role='chu' and locked=0 and auth_user_id is not null limit 1;
  perform set_config('request.jwt.claim.sub',uid::text,true);
  store := 'TEST FABI 103 '||substr(gen_random_uuid()::text,1,8);
  insert into public.branches(code,name,sort_order) values('T103_'||substr(gen_random_uuid()::text,1,6),'Cơ sở kiểm thử 103',999) returning id into br;
  insert into public.fabi_stores(store_name,branch_id) values(store,br);
  insert into public.employees(code,name,rank) values('T103_'||substr(gen_random_uuid()::text,1,8),'Nhân viên thử 103','1') returning id into emp;
  insert into public.shift_reports(branch_id,work_date,shift,status,recon_status,created_by) values(br,d,'Chiều','dang_chot','chua',acc) returning id into close_id;
  insert into public.shift_report_parts(report_id,part,claimed_by,claimed_at) values(close_id,'tien',acc,public.vn_now_text()),(close_id,'nhan_su',acc,public.vn_now_text());
  perform public.app_ca_save(close_id,jsonb_build_object(
    'rev_start',d||' 12:35','rev_end',d||' 18:00','ipos_opening',1000000,'opening_cash',1000000,'total_revenue',1000000,
    'pos_cash',700000,'pos_transfer',300000,'pos_debt',0,'cash_counted',1700000,'pos_diff',0,'reported_transfer',300000,'cups',20,
    'goods','[]'::jsonb,
    'debts',jsonb_build_array(jsonb_build_object('kind','muon','table_name','Khách mượn thử','amount',10000)),
    'handover',jsonb_build_array(jsonb_build_object('content','Bàn giao thử vẫn phải tạo Công việc')),
    'moves',jsonb_build_array(jsonb_build_object('kind','tien_mat','amount',-50000,'note','Khách thử đổi tiền','exchange_key',ex::text),jsonb_build_object('kind','chuyen_khoan','amount',50000,'note','Khách thử đổi tiền','exchange_key',ex::text)),
    'staff',jsonb_build_array(jsonb_build_object('employee_id',emp,'source','lich','worked',true,'time_in','12:35','time_out','18:00'))));
  perform public.app_ca_photo_add(close_id,'r'||close_id||'/ipos/test.jpg','ipos');
  -- File Fabi có sẵn từ giao dịch trước, nhưng ngân hàng còn thiếu: gửi ca vẫn phải thành công.
  perform public.app_fabi_upload(jsonb_build_array(jsonb_build_object(
    'ma_ca','PRECLOSE-'||close_id,'store',store,'open',to_char(d::date,'DD/MM/YYYY')||' 12:35','close',to_char(d::date,'DD/MM/YYYY')||' 18:00',
    'dau',900000,'cuoi',1600000,'net',1000000,'hd',20,'tong',1700000,
    'pay',jsonb_build_array(jsonb_build_object('name','Tiền mặt','amount',700000),jsonb_build_object('name','Chuyển khoản','amount',300000)),
    'items','[]'::jsonb,'groups','[]'::jsonb)));
  perform set_config('app.fabi_report','',true); -- mô phỏng file đã tải xong ở giao dịch trước
  insert into public.shift_reports(branch_id,work_date,shift,status,recon_status,created_by,total_revenue,pos_cash,pos_transfer,reported_transfer,cash_counted,opening_cash,ipos_opening,cups)
  values(br,to_char(d::date-1,'YYYY-MM-DD'),'Sáng','dang_chot','chua',acc,1000000,700000,300000,300000,1700000,1000000,1000000,20) returning id into source_id;
  insert into public.shift_debts(branch_id,report_id,table_name,amount,kind,created_by) values(br,source_id,'Khách nợ cũ thử',20000,'bill',acc) returning id into old_debt;
  update public.shift_reports set status='hoan_thanh' where id=source_id;
  perform public.app_ca_debt_collect(old_debt,close_id,'tien_mat','Khách trả trong lúc chốt ca');
  sub:=public.app_ca_submit_unified(close_id,'[]'::jsonb,'{}'::jsonb);
  if (select status from public.shift_reports where id=close_id)<>'hoan_thanh'
     or coalesce((sub->>'self_reconciled')::boolean,true)
     or (select recon_status from public.shift_reports where id=close_id)='hoan_thanh' then
    raise exception 'FAIL thiếu nguồn không chốt được phiếu hoặc vẫn tự đối soát: %',sub;
  end if;
  if exists(select 1 from public.shift_report_checks where report_id=close_id) then
    raise exception 'FAIL phiếu chờ kế toán vẫn có tiến độ Kiểm tra';
  end if;
  if not exists(select 1 from public.fin_move_cats where report_id=close_id) then raise exception 'FAIL gửi ca không gắn nhóm cho đổi tiền/khách mượn'; end if;
  if not exists(select 1 from public.handover_items where report_id=close_id and task_id is not null) then raise exception 'FAIL gửi ca không tạo Công việc từ bàn giao'; end if;
  cases:=cases||'Có Fabi từ trước nhưng thiếu ngân hàng: quản lý vẫn chốt phiếu, phiếu chuyển sang chờ kế toán'::text;
  insert into public.shift_reports(branch_id,work_date,shift,status,recon_status,created_by,total_revenue,pos_cash,pos_transfer,reported_transfer,cash_counted,opening_cash,ipos_opening,cups)
  values(br,d,'Sáng','hoan_thanh','chua',acc,1000000,700000,300000,300000,1700000,1000000,1000000,20) returning id into rid;

  k:=public.app__ca_kt_state(rid);
  if coalesce((k->>'ready')::boolean,true) then raise exception 'FAIL ca thiếu nguồn lại được mở kiểm tra'; end if;
  bad:=false; begin perform public.app__ca_recon_require_ready(rid); exception when others then bad:=position('chờ kế toán' in lower(sqlerrm))>0; end;
  if not bad then raise exception 'FAIL helper không chặn ca thiếu nguồn'; end if;
  bad:=false; begin perform public.app_ca_recon(rid); exception when others then bad:=position('chờ kế toán' in lower(sqlerrm))>0; end;
  if not bad then raise exception 'FAIL API vẫn mở đối soát khi thiếu nguồn'; end if;
  bad:=false; begin perform public.app_ca_recon_save(rid,public.app__recon_snapshot(rid),'Thử lách sửa bản đối soát');
  exception when others then bad:=position('chờ kế toán' in lower(sqlerrm))>0; end;
  if not bad then raise exception 'FAIL RPC sửa bản đối soát vẫn lách được khi thiếu nguồn'; end if;
  bad:=false; begin perform public.app_ca_recon_apply(rid,jsonb_build_object('fields',jsonb_build_object('opening_cash',123456)),'Thử lách nút Lưu phần tiền');
  exception when others then bad:=position('chờ kế toán' in lower(sqlerrm))>0; end;
  if not bad then raise exception 'FAIL RPC Lưu phần tiền vẫn lách được khi thiếu nguồn'; end if;
  bad:=false; begin perform public.app_ca_recon_apply(rid,jsonb_build_object('photos',jsonb_build_array(jsonb_build_object('op','add','path','r'||rid||'/ipos/lach.jpg'))),'Thử lách chỉ thêm ảnh');
  exception when others then bad:=position('chờ kế toán' in lower(sqlerrm))>0; end;
  if not bad then raise exception 'FAIL gói Lưu chỉ có ảnh vẫn lách được khi thiếu nguồn'; end if;
  bad:=false; begin perform public.app_ca_recon_handover_save(rid,jsonb_build_array(jsonb_build_object('content','Bàn giao thử lách')),'Thử lách bàn giao');
  exception when others then bad:=position('chờ kế toán' in lower(sqlerrm))>0; end;
  if not bad then raise exception 'FAIL RPC sửa bàn giao vẫn lách được khi thiếu nguồn'; end if;
  bad:=false; begin perform public.app_ca_recon_photo_add(rid,'r'||rid||'/ipos/lach-truc-tiep.jpg','Thử lách ảnh');
  exception when others then bad:=position('chờ kế toán' in lower(sqlerrm))>0; end;
  if not bad then raise exception 'FAIL RPC thêm ảnh vẫn lách được khi thiếu nguồn'; end if;
  insert into public.shift_report_moves(report_id,kind,amount,note) values(rid,'tien_mat',1000,'Khoản thử khóa phân loại');
  select mkey into mk from public.app__tc_moves(br,d,d) where report_id=rid and note='Khoản thử khóa phân loại' limit 1;
  bad:=false; begin perform public.app_tc_check(rid,mk,null,true,false);
  exception when others then bad:=position('chờ kế toán' in lower(sqlerrm))>0; end;
  if not bad then raise exception 'FAIL phân loại thu chi vẫn lách được khi thiếu nguồn'; end if;
  bad:=false; begin perform public.app_ca_cash_mode(rid,'ca',123456);
  exception when others then bad:=position('chờ kế toán' in lower(sqlerrm))>0; end;
  if not bad then raise exception 'FAIL số quản lý đếm tiền mặt vẫn lách được khi thiếu nguồn'; end if;
  bad:=false; begin insert into public.gap_decisions(report_id,item,kind,amount,reason,created_by) values(rid,'tien_mat','quan_chiu',1000,'Thử lách lệch tiền',acc);
  exception when others then bad:=position('chờ kế toán' in lower(sqlerrm))>0; end;
  if not bad then raise exception 'FAIL xử lý Lệch tiền ca vẫn lách được khi thiếu nguồn'; end if;
  bad:=false; begin insert into public.shift_shortfalls(report_id,item,employee_id,amount,reason,created_by) values(rid,'tien_mat',emp,1000,'Thử lách trừ lương',acc);
  exception when others then bad:=position('chờ kế toán' in lower(sqlerrm))>0; end;
  if not bad then raise exception 'FAIL gán khoản âm/trừ lương vẫn lách được khi thiếu nguồn'; end if;
  update public.shift_reports set status='dang_chot' where id=rid;
  insert into public.shift_debts(branch_id,report_id,table_name,amount,kind,created_by) values(br,rid,'Nợ gốc thử split',20000,'bill',acc) returning id into parent_debt;
  insert into public.shift_debts(branch_id,report_id,table_name,amount,kind,created_by,split_from) values(br,rid,'Phần dư thử split',10000,'bill',acc,parent_debt) returning id into split_debt;
  update public.shift_reports set status='hoan_thanh' where id=rid;
  bad:=false; begin perform public.app_ca_recon_debt_remove(rid,split_debt,'Thử lách xóa phần dư');
  exception when others then bad:=position('chờ kế toán' in lower(sqlerrm))>0; end;
  if not bad or not exists(select 1 from public.shift_debts where id=split_debt) then raise exception 'FAIL xóa phần dư nợ split vẫn lách được khi thiếu nguồn'; end if;
  bad:=false; begin perform public.app_ca_recon_debt_set(rid,null,'bill','Khách thử',10000,null,'Thử lách công nợ',null);
  exception when others then bad:=position('chờ kế toán' in lower(sqlerrm))>0; end;
  if not bad then raise exception 'FAIL RPC công nợ đối soát vẫn lách được khi thiếu nguồn'; end if;
  bad:=false; begin insert into public.shift_report_checks(report_id,item,checked_by,checked_at) values(rid,'nhan_su',acc,public.vn_now_text());
  exception when others then bad:=position('chờ kế toán' in lower(sqlerrm))>0; end;
  if not bad then raise exception 'FAIL vẫn ghi được hạng mục kiểm tra khi thiếu nguồn'; end if;
  cases:=cases||'Thiếu Fabi/ngân hàng: mọi đường Kiểm tra, phân loại, tiền đếm, công nợ và Lệch tiền ca bị chặn'::text;

  insert into public.bank_accounts(branch_id,bank,account_no,holder,label,active,created_by) values(br,'VCB','TEST103','TEST','Tài khoản thử',1,acc) returning id into ba;
  insert into public.bank_account_balances(report_id,account_id,opening,closing,transfers_out,note,updated_by,updated_at)
  values(rid,ba,0,300000,0,'Dữ liệu giả',acc,public.vn_now_text());
  k:=public.app__ca_kt_state(rid);
  if (k->>'bank')::boolean is not true or (k->>'ready')::boolean is true then raise exception 'FAIL trạng thái thiếu riêng Fabi: %',k; end if;

  up:=public.app_fabi_upload(jsonb_build_array(jsonb_build_object(
    'ma_ca','TEST103-'||rid,'store',store,'open',to_char(d::date,'DD/MM/YYYY')||' 06:45','close',to_char(d::date,'DD/MM/YYYY')||' 12:35',
    'dau',1000000,'cuoi',1700000,'net',1000000,'hd',20,'tong',1700000,
    'pay',jsonb_build_array(jsonb_build_object('name','Tiền mặt','amount',700000),jsonb_build_object('name','Chuyển khoản','amount',300000)),
    'items','[]'::jsonb,'groups','[]'::jsonb)));
  k:=public.app__ca_kt_state(rid);
  if (k->>'ready')::boolean is not true or not exists(select 1 from public.fabi_shifts where ma_ca='TEST103-'||rid and report_id=rid) then
    raise exception 'FAIL tải file Fabi giả hoặc ghép phiếu: state %, upload %',k,up;
  end if;
  perform public.app__ca_recon_require_ready(rid);
  perform public.app_ca_recon(rid);
  perform public.app_ca_recon_save(rid,public.app__recon_snapshot(rid),'Kiểm thử đủ nguồn');
  debt2:=public.app_ca_recon_debt_set(rid,null,'bill','Khách đủ nguồn',10000,null,'Kiểm thử đủ nguồn',null);
  if debt2 is null then raise exception 'FAIL đủ nguồn vẫn không sửa được công nợ đối soát'; end if;
  insert into public.shift_report_checks(report_id,item,checked_by,checked_at) values(rid,'nhan_su',acc,public.vn_now_text()) on conflict do nothing;
  cases:=cases||'Đủ ngân hàng + tải Fabi giả: kết nối tải thành công, ghép đúng phiếu và mở Kiểm tra'::text;

  store2:='TEST FABI 103B '||substr(gen_random_uuid()::text,1,8);
  insert into public.branches(code,name,sort_order) values('T103B_'||substr(gen_random_uuid()::text,1,6),'Cơ sở kiểm thử 103B',998) returning id into br2;
  insert into public.fabi_stores(store_name,branch_id) values(store2,br2);
  insert into public.shift_reports(branch_id,work_date,shift,status,recon_status,created_by,total_revenue,pos_cash,pos_transfer,reported_transfer,cash_counted,opening_cash,ipos_opening,cups)
  values(br2,d,'Sáng','hoan_thanh','chua',acc,1000000,700000,300000,300000,1700000,1000000,1000000,20) returning id into rid2;
  up:=public.app_fabi_upload(jsonb_build_array(jsonb_build_object(
    'ma_ca','TEST103-'||rid,'store',store2,'open',to_char(d::date,'DD/MM/YYYY')||' 06:45','close',to_char(d::date,'DD/MM/YYYY')||' 12:35',
    'dau',1000000,'cuoi',1700000,'net',1000000,'hd',20,'tong',1700000,
    'pay',jsonb_build_array(jsonb_build_object('name','Tiền mặt','amount',700000),jsonb_build_object('name','Chuyển khoản','amount',300000)),
    'items','[]'::jsonb,'groups','[]'::jsonb)));
  if not exists(select 1 from public.fabi_shifts where ma_ca='TEST103-'||rid and report_id=rid2) then
    raise exception 'FAIL tải lại cùng mã Fabi không chuyển đúng sang phiếu mới: %',up;
  end if;
  cases:=cases||'Tải lại cùng mã Fabi sang ca khác vẫn ghép đúng trước khi có ngân hàng'::text;

  if has_function_privilege('anon','public.app__ca_recon_require_ready(bigint)','execute')
     or has_function_privilege('authenticated','public.app__ca_recon_require_ready(bigint)','execute') then
    raise exception 'FAIL hàm nội bộ bị cấp quyền gọi trực tiếp';
  end if;
  cases:=cases||'Hàm chặn nội bộ không cấp cho trình duyệt'::text;
  raise exception 'REPORT>> %',array_to_string(cases,' | ');
end $test$;
