-- Chỉ chạy cùng migration 98 trong giao dịch tự hoàn tác. Không giữ dữ liệu kiểm thử.
DO $test$
declare uid uuid; acc bigint; emp bigint; emp2 bigint; br bigint; rid bigint; nv bigint; nuid uuid:=gen_random_uuid();
 k uuid:=gen_random_uuid(); p jsonb; result_ jsonb; bad boolean; cases text[]:='{}'; d text:=to_char(public.vn_now()::date,'YYYY-MM-DD'); nr bigint; gap_id bigint; gap_day text; action_ text; j int:=0; cat_a bigint; cat_b bigint;
begin
 select id,auth_user_id into acc,uid from public.accounts where system_role='chu' and locked=0 and auth_user_id is not null limit 1;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 insert into public.branches(code,name,sort_order) values('TEST98_'||substr(gen_random_uuid()::text,1,8),'Cơ sở kiểm thử',999) returning id into br;
 insert into public.employees(code,name,rank) values('TEST98A_'||substr(gen_random_uuid()::text,1,8),'Nhân viên kiểm thử A','1') returning id into emp;
 insert into public.employees(code,name,rank) values('TEST98B_'||substr(gen_random_uuid()::text,1,8),'Nhân viên kiểm thử B','1') returning id into emp2;
 update public.accounts set system_role='nv',auth_user_id=nuid where employee_id=emp returning id into nv;
 if nv is null then insert into public.accounts(employee_id,display_name,system_role,auth_user_id) values(emp,'Nhân viên thử','nv',nuid) returning id into nv; end if;
 insert into public.shift_reports(branch_id,work_date,shift,status,created_by) values(br,d,'Sáng','dang_chot',acc) returning id into rid;
 insert into public.shift_report_parts(report_id,part,claimed_by,claimed_at) values(rid,'tien',acc,public.vn_now_text()),(rid,'nhan_su',acc,public.vn_now_text()) on conflict(report_id,part) do update set claimed_by=acc;
 p:=jsonb_build_object('rev_start',d||' 06:45','rev_end',d||' 12:30','ipos_opening',1000000,'opening_cash',1000000,'total_revenue',1000000,'pos_cash',700000,'pos_transfer',300000,'pos_debt',0,'cash_counted',1200000,'pos_diff',-500000,'reported_transfer',800000,'cups',40,'goods',jsonb_build_array(),'debts',jsonb_build_array(),'handover',jsonb_build_array(),
 'staff',jsonb_build_array(jsonb_build_object('employee_id',emp,'source','lich','worked',false,'absent_reason','Nghỉ thử'),jsonb_build_object('employee_id',emp2,'source','ho_tro','worked',true,'time_in','06:45','time_out','12:30')),
 'moves',jsonb_build_array(jsonb_build_object('kind','tien_mat','amount',-500000,'note','Đổi tiền kiểm thử','exchange_key',k),jsonb_build_object('kind','chuyen_khoan','amount',500000,'note','Đổi tiền kiểm thử','exchange_key',k)));
 perform public.app_ca_save(rid,p);
 if (select count(*) from public.shift_report_moves where report_id=rid and exchange_key=k)<>2 then raise exception 'FAIL lưu cặp'; end if;
 if (public.app__recon_snapshot(rid)->'moves'->0->>'exchange_key') is null then raise exception 'FAIL snapshot mất liên kết'; end if;
 cases:=cases||'Lưu, tải lại một phiếu đổi tiền đủ hai vế'::text;
 bad:=false; begin perform public.app_ca_save(rid,jsonb_set(p,'{moves}',jsonb_build_array(p->'moves'->0))); exception when others then bad:=position('hai vế' in sqlerrm)>0; end;
 if not bad then raise exception 'FAIL chặn một vế'; end if;
 cases:=cases||'Chặn xoá/sửa một vế'::text;
 insert into public.fabi_stores(store_name,branch_id) values('Cơ sở kiểm thử '||br,br);
 perform public.app_ca_photo_add(rid,'r'||rid||'/ipos/test.jpg','ipos');
 result_:=public.app_ca_submit_unified(rid,'[]');
 if not (result_->>'self_reconciled')::boolean or (select recon_status from public.shift_reports where id=rid)<>'hoan_thanh' then raise exception 'FAIL quản lý tự chốt'; end if;
 if (select count(*) from public.shift_report_checks where report_id=rid)<>9 then raise exception 'FAIL số mục quản lý'; end if;
 if (public.app__ca_money(rid)->>'tm_left')::bigint<>0 or (public.app__ca_money(rid)->>'ck_left')::bigint<>0 then raise exception 'FAIL đổi tiền lệch'; end if;
 if exists(select 1 from public.app__tc_moves_x(br,d,d) m left join public.fin_move_cats c on c.report_id=m.report_id and c.mkey=m.mkey where m.report_id=rid and (c.excluded is distinct from 1 or c.checked is distinct from 1)) then raise exception 'FAIL đổi tiền tính chi phí'; end if;
 cases:=cases||'Quản lý tự chốt đủ 9 mục, đổi tiền không tính doanh thu/chi phí'::text;
 if not exists(select 1 from public.app__pc_sources() where job=2 and key='cv:'||rid) then raise exception 'FAIL thiếu việc nghỉ/làm thay chưa phân loại'; end if;
 if public.app__cv_state(rid)<>'chua_phan_loai' then raise exception 'FAIL tự duyệt nghỉ'; end if;
 perform public.app_cv_save(rid,jsonb_build_array(jsonb_build_object('absent_id',emp,'reason','tu_tim','helper_id',emp2,'hours',5.75,'x2',false)));
 perform public.app_cv_approve(rid,null,'Duyệt kiểm thử');
 if public.app__cv_state(rid)<>'da_duyet' then raise exception 'FAIL duyệt sau hoàn thành'; end if;
 cases:=cases||'Nghỉ/làm thay nhắc riêng, phân loại và duyệt sau hoàn thành'::text;
 -- Đối soát sửa cặp, ghi lịch sử, không phá phiếu gốc.
 perform public.app_ca_item_reopen(rid,'thu_chi','Kiểm thử sửa cặp');
 perform public.app_ca_item_reopen(rid,'tien_mat','Kiểm thử sửa cặp');
 perform public.app_ca_item_reopen(rid,'chuyen_khoan','Kiểm thử sửa cặp');
 p:=public.app__recon_snapshot(rid); p:=jsonb_set(p,'{moves,0,amount}','-400000');p:=jsonb_set(p,'{moves,1,amount}','400000');
 perform public.app_ca_recon_save(rid,p,'Sửa phiếu đổi tiền');
 if (select data->'moves'->0->>'exchange_key' from public.shift_report_recon where report_id=rid) is null then raise exception 'FAIL sửa mất liên kết'; end if;
 if (select amount from public.shift_report_moves where report_id=rid and kind='tien_mat')<>-500000 then raise exception 'FAIL sửa phiếu gốc'; end if;
 cases:=cases||'Sửa cặp trên bản đối soát, giữ nguyên bản gốc'::text;
 -- Nhân viên vẫn chờ quản lý, không dùng lời khai trên client để tự đối soát.
 insert into public.shift_reports(branch_id,work_date,shift,status,created_by) values(br,d,'Chiều','dang_chot',nv) returning id into nr;
 insert into public.shift_report_staff(report_id,employee_id,source,worked,time_in,time_out) values(nr,emp,'lich',1,'12:30','18:00');
 insert into public.shift_report_parts(report_id,part,claimed_by,claimed_at) values(nr,'tien',nv,public.vn_now_text()),(nr,'nhan_su',nv,public.vn_now_text()) on conflict(report_id,part) do update set claimed_by=nv;
 perform set_config('request.jwt.claim.sub',nuid::text,true);
 p:=jsonb_build_object('rev_start',d||' 12:30','rev_end',d||' 18:00','ipos_opening',1200000,'opening_cash',1200000,'total_revenue',1000000,'pos_cash',700000,'pos_transfer',300000,'pos_debt',0,'cash_counted',1900000,'pos_diff',0,'reported_transfer',300000,'cups',40,'moves','[]'::jsonb,'debts','[]'::jsonb,'handover','[]'::jsonb,'staff',jsonb_build_array(jsonb_build_object('employee_id',emp,'source','lich','worked',true,'time_in','12:30','time_out','18:00')));
 perform public.app_ca_save(nr,p); perform public.app_ca_photo_add(nr,'r'||nr||'/ipos/test.jpg','ipos');
 result_:=public.app_ca_submit_unified(nr,'[]');
 if (result_->>'self_reconciled')::boolean or (select recon_status from public.shift_reports where id=nr)='hoan_thanh' then raise exception 'FAIL nhân viên tự duyệt'; end if;
 cases:=cases||'Nhân viên gửi vẫn chờ quản lý đối soát'::text;
 -- Kiểm tra gửi lại không tạo thêm bút toán / kết quả.
 bad:=false; begin perform public.app_ca_submit_unified(nr,'[]'); exception when others then bad:=position('đã gửi' in sqlerrm)>0; end;
 if not bad then raise exception 'FAIL gửi lặp'; end if;
 cases:=cases||'Chặn gửi lặp'::text;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 insert into public.fin_categories(kind,name,active) values('chi','Nhóm kiểm thử A',1) returning id into cat_a;
 insert into public.fin_categories(kind,name,active) values('chi','Nhóm kiểm thử B',1) returning id into cat_b;
 -- Hai khoản giống nội dung / số tiền vẫn giữ hai nhóm khác nhau; lựa chọn xử lý lệch là nguyên tử.
 foreach action_ in array array['sau','chia','qc'] loop
   j:=j+1; gap_day:=to_char(public.vn_now()::date-j,'YYYY-MM-DD');
   insert into public.shift_reports(branch_id,work_date,shift,status,created_by) values(br,gap_day,'Sáng','dang_chot',acc) returning id into gap_id;
   insert into public.shift_report_parts(report_id,part,claimed_by,claimed_at) values(gap_id,'tien',acc,public.vn_now_text()),(gap_id,'nhan_su',acc,public.vn_now_text()) on conflict(report_id,part) do update set claimed_by=acc;
   p:=jsonb_build_object('rev_start',gap_day||' 06:45','rev_end',gap_day||' 12:30','ipos_opening',1000000,'opening_cash',1000000,'total_revenue',1000000,'pos_cash',700000,'pos_transfer',300000,'pos_debt',0,'cash_counted',1650000,'pos_diff',-50000,'reported_transfer',300000,'cups',40,'moves',jsonb_build_array(jsonb_build_object('kind','tien_mat','amount',-10000,'note','Chi thử'),jsonb_build_object('kind','tien_mat','amount',-10000,'note','Chi thử')),'debts','[]'::jsonb,'handover','[]'::jsonb,'staff',jsonb_build_array(jsonb_build_object('employee_id',emp,'source','lich','worked',true,'time_in','06:45','time_out','12:30'),jsonb_build_object('employee_id',emp2,'source','lich','worked',true,'time_in','06:45','time_out','12:30')));
   perform public.app_ca_save(gap_id,p); perform public.app_ca_photo_add(gap_id,'r'||gap_id||'/ipos/test.jpg','ipos');
   insert into public.fin_month_closes(branch_id,month,closed_by) values(br,left(gap_day,7),acc);
   bad:=false; begin perform public.app_ca_submit_unified(gap_id,'[]'); exception when others then bad:=position('Tháng đã chốt' in sqlerrm)>0; end;
   if not bad then raise exception 'FAIL khoá tháng'; end if;
   delete from public.fin_month_closes where branch_id=br and month=left(gap_day,7);
   -- Người khác không được gửi thay người nhận chốt.
   perform set_config('request.jwt.claim.sub',nuid::text,true);
   bad:=false; begin perform public.app_ca_submit_unified(gap_id,'[]'); exception when others then bad:=position('người nhận' in sqlerrm)>0; end;
   if not bad then raise exception 'FAIL nhận thay'; end if;
   perform set_config('request.jwt.claim.sub',uid::text,true);
   -- Số lệch thay đổi phải yêu cầu xem lại, không chốt nhầm lựa chọn cũ.
   bad:=false; begin perform public.app_ca_submit_unified(gap_id,jsonb_build_array(jsonb_build_object('kind','tien_mat','amount',-10000,'note','Chi thử','category',cat_a),jsonb_build_object('kind','tien_mat','amount',-10000,'note','Chi thử','category',cat_b)),jsonb_build_object('tien_mat',jsonb_build_object('action','chia','expected',-1))); exception when others then bad:=position('đã thay đổi' in sqlerrm)>0; end;
   if not bad or (select status from public.shift_reports where id=gap_id)<>'dang_chot' then raise exception 'FAIL giao dịch gửi phải tự hoàn tác'; end if;
   result_:=public.app_ca_submit_unified(gap_id,jsonb_build_array(jsonb_build_object('kind','tien_mat','amount',-10000,'note','Chi thử','category',cat_a),jsonb_build_object('kind','tien_mat','amount',-10000,'note','Chi thử','category',cat_b)),jsonb_build_object('tien_mat',jsonb_build_object('action',action_,'expected',-30000)));
   if (select recon_status from public.shift_reports where id=gap_id)<>'hoan_thanh' then raise exception 'FAIL hoàn thành có lệch'; end if;
   if (select count(distinct category_id) from public.fin_move_cats where report_id=gap_id)<>2 then raise exception 'FAIL nhóm hai khoản giống nhau'; end if;
   if (select computed from public.shift_report_results where report_id=gap_id and item='tien_mat')<>-30000 then raise exception 'FAIL số lệch thực tế'; end if;
   if action_='chia' and (select sum(amount) from public.shift_shortfalls where report_id=gap_id) is distinct from 30000 then raise exception 'FAIL chia thiếu'; end if;
   if action_<>'chia' and exists(select 1 from public.shift_shortfalls where report_id=gap_id) then raise exception 'FAIL tự trừ lương'; end if;
   if action_='qc' and not exists(select 1 from public.gap_decisions where report_id=gap_id and kind='quan_chiu' and amount=30000) then raise exception 'FAIL quán chịu'; end if;
   cases:=cases||('Lệch tiền: '||action_||' — hoàn thành, giữ đúng số lệch và nhóm trùng nội dung');
 end loop;
 -- Khoản nhân viên đã ghi khách trả: quản lý sửa được số/cách trả và xoá về còn nợ.
 perform public.app_ca_item_reopen(gap_id,'tien_mat','Kiểm thử sửa khách trả');
 perform public.app_ca_item_reopen(gap_id,'chuyen_khoan','Kiểm thử sửa khách trả');
 insert into public.shift_debts(branch_id,table_name,amount,note,created_by,kind,closed_at,closed_by,closed_report_id,collect_kind,close_note)
 values(br,'Khách kiểm thử',50000,'Khoản kiểm thử',nv,'bill',public.vn_now_text(),nv,gap_id,'tien_mat','Nhân viên ghi đã thu') returning id into nr;
 perform public.app_ca_recon_debt_update(gap_id,nr,'chuyen_khoan',30000,'Sửa số và cách trả kiểm thử');
 if (select amount from public.shift_debts where id=nr)<>30000 or (select collect_kind from public.shift_debts where id=nr)<>'chuyen_khoan'
    or not exists(select 1 from public.shift_debts where split_from=nr and amount=20000 and closed_at is null) then raise exception 'FAIL sửa khách trả'; end if;
 perform public.app_ca_recon_debt_uncollect(gap_id,nr,'Xoá khách trả kiểm thử');
 if (select amount from public.shift_debts where id=nr)<>50000 or (select closed_at from public.shift_debts where id=nr) is not null
    or exists(select 1 from public.shift_debts where split_from=nr) then raise exception 'FAIL xoá khách trả'; end if;
 cases:=cases||'Sửa/xoá khoản khách trả của nhân viên, gộp đúng phần còn nợ'::text;
 cases:=cases||'Giữ khoá tháng; chặn gửi thay người khác và tự hoàn tác nếu số lệch đã thay đổi'::text;
 raise exception 'REPORT>> %', array_to_string(cases,' | ');
end $test$;
