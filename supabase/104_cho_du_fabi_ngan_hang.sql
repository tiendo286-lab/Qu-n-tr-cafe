-- BƯỚC 104: Chỉ cho mở/ghi Kiểm tra khi đủ file Fabi và số liệu ngân hàng.
-- Phiếu nhân viên vẫn được chốt bình thường khi thiếu nguồn kế toán.

create or replace function public.app__ca_recon_require_ready(p_id bigint) returns void
language plpgsql stable security definer set search_path=public as $$
declare k jsonb; miss text;
begin
  k:=public.app__ca_kt_state(p_id);
  if k is null then raise exception 'Không tìm thấy phiếu.'; end if;
  if coalesce((k->>'need')::boolean,false) and not coalesce((k->>'ready')::boolean,false) then
    select string_agg(x,', ') into miss from jsonb_array_elements_text(k->'missing') x;
    raise exception 'Phiếu chờ kế toán: còn thiếu %. Kế toán tải file chốt ca Fabi và nhập chuyển khoản ngân hàng của ca này rồi mới kiểm tra được.',coalesce(miss,'dữ liệu kế toán');
  end if;
end $$;

-- Chặn mọi hạng mục Kiểm tra, không chỉ phần tiền.
create or replace function public.app__ca_kt_guard() returns trigger
language plpgsql security definer set search_path=public as $$
declare rid bigint;
begin
  rid:=case when TG_OP='DELETE' then OLD.report_id else NEW.report_id end;
  perform public.app__ca_recon_require_ready(rid);
  return case when TG_OP='DELETE' then OLD else NEW end;
end $$;
drop trigger if exists ca_kt_guard on public.shift_report_checks;
create trigger ca_kt_guard before insert or update or delete on public.shift_report_checks for each row execute function public.app__ca_kt_guard();
drop trigger if exists ca_kt_guard on public.shift_report_results;
create trigger ca_kt_guard before insert or update or delete on public.shift_report_results for each row execute function public.app__ca_kt_guard();

-- Fabi được phép tạo bản số chính thức trước khi ngân hàng nhập xong; mọi cách sửa
-- shift_report_recon khác vẫn phải qua điều kiện đủ nguồn.
create or replace function public.app__ca_fabi_context() returns trigger
language plpgsql security definer set search_path=public as $$
declare rid bigint;
begin
  select id into rid from public.shift_reports where branch_id=NEW.branch_id and work_date=NEW.work_date and shift=NEW.shift limit 1;
  rid:=coalesce(rid,NEW.report_id);
  if rid is not null then perform set_config('app.fabi_report',rid::text,true); end if;
  return NEW;
end $$;
drop trigger if exists ca_fabi_context on public.fabi_shifts;
create trigger ca_fabi_context after insert or update on public.fabi_shifts for each row execute function public.app__ca_fabi_context();

create or replace function public.app__ca_recon_write_guard() returns trigger
language plpgsql security definer set search_path=public as $$
declare rid bigint:=coalesce(NEW.report_id,OLD.report_id);
begin
  if current_setting('app.fabi_report',true)=rid::text then return NEW; end if;
  perform public.app__ca_recon_require_ready(rid);
  return NEW;
end $$;
drop trigger if exists ca_source_guard on public.shift_report_recon;
create trigger ca_source_guard before insert or update on public.shift_report_recon for each row execute function public.app__ca_recon_write_guard();

-- Các RPC công nợ đối soát đều đi qua shift_debts. Phiếu đang chốt vẫn sửa nợ
-- bình thường; chỉ khóa khi khoản nợ gắn với một phiếu đã gửi đang chờ kế toán.
create or replace function public.app__ca_debt_recon_guard() returns trigger
language plpgsql security definer set search_path=public as $$
declare rid bigint; semantic_changed boolean:=false;
begin
  if TG_OP='INSERT' then
    rid:=coalesce(NEW.gap_report,NEW.closed_report_id,case when NEW.split_from is null then NEW.report_id end);
  elsif TG_OP='DELETE' then
    rid:=case when OLD.split_from is null then coalesce(OLD.gap_report,OLD.closed_report_id,OLD.report_id) end;
  else
    -- Gắn/bỏ thu nợ thuộc phiếu đích; không lấy phiếu nguồn cũ để chặn ca mới đang chốt.
    if NEW.gap_report is distinct from OLD.gap_report then rid:=coalesce(NEW.gap_report,OLD.gap_report);
    elsif NEW.closed_report_id is distinct from OLD.closed_report_id then rid:=coalesce(NEW.closed_report_id,OLD.closed_report_id);
    elsif NEW.report_id is distinct from OLD.report_id then rid:=coalesce(NEW.report_id,OLD.report_id);
    else
      semantic_changed:=(NEW.table_name,NEW.amount,coalesce(NEW.kind,''),coalesce(NEW.note,''))
        is distinct from (OLD.table_name,OLD.amount,coalesce(OLD.kind,''),coalesce(OLD.note,''));
      if semantic_changed then
        -- Thu một phần tạo dòng split trước rồi giảm amount dòng gốc: đây là chốt ca, không phải sửa đối soát.
        if NEW.amount is distinct from OLD.amount and NEW.table_name is not distinct from OLD.table_name
           and coalesce(NEW.kind,'') is not distinct from coalesce(OLD.kind,'') and coalesce(NEW.note,'') is not distinct from coalesce(OLD.note,'')
           and exists(select 1 from public.shift_debts x where x.split_from=OLD.id and x.closed_at is null) then rid:=null;
        else rid:=NEW.report_id; end if;
      end if;
    end if;
  end if;
  if rid is not null and not exists(select 1 from public.shift_reports r where r.id=rid and r.status='hoan_thanh') then rid:=null; end if;
  if rid is not null then perform public.app__ca_recon_require_ready(rid); end if;
  return case when TG_OP='DELETE' then OLD else NEW end;
end $$;
drop trigger if exists ca_source_guard on public.shift_debts;
create trigger ca_source_guard before insert or update or delete on public.shift_debts for each row execute function public.app__ca_debt_recon_guard();

-- Bàn giao và ảnh cũng sửa được từ bước Kiểm tra nhưng không đi qua bảng checks/results.
-- Chỉ khóa thao tác trên phiếu đã gửi; phiếu nhân viên đang chốt vẫn ghi bình thường.
create or replace function public.app__ca_completed_source_guard() returns trigger
language plpgsql security definer set search_path=public as $$
declare rid bigint;
begin
  rid:=case when TG_OP='DELETE' then OLD.report_id else NEW.report_id end;
  if current_setting('app.fabi_report',true)=rid::text then return case when TG_OP='DELETE' then OLD else NEW end; end if;
  if current_setting('app.ca_submit_report',true)=rid::text then return case when TG_OP='DELETE' then OLD else NEW end; end if;
  if exists(select 1 from public.shift_reports r where r.id=rid and r.status='hoan_thanh') then
    perform public.app__ca_recon_require_ready(rid);
  end if;
  return case when TG_OP='DELETE' then OLD else NEW end;
end $$;
create or replace function public.app__ca_handover_source_guard() returns trigger
language plpgsql security definer set search_path=public as $$
declare rid bigint;
begin
  rid:=case when TG_OP='DELETE' then OLD.report_id else NEW.report_id end;
  -- Công việc được phép gắn task_id / đánh dấu hoàn thành; chỉ nội dung bàn giao
  -- và việc thêm/xóa dòng thuộc bước Kiểm tra mới phải chờ đủ nguồn.
  if TG_OP<>'UPDATE' or (NEW.report_id,NEW.content) is distinct from (OLD.report_id,OLD.content) then
    if exists(select 1 from public.shift_reports r where r.id=rid and r.status='hoan_thanh') then perform public.app__ca_recon_require_ready(rid); end if;
  end if;
  return case when TG_OP='DELETE' then OLD else NEW end;
end $$;
drop trigger if exists ca_source_guard on public.handover_items;
create trigger ca_source_guard before insert or update or delete on public.handover_items for each row execute function public.app__ca_handover_source_guard();
drop trigger if exists ca_source_guard on public.shift_report_photos;
create trigger ca_source_guard before insert or update or delete on public.shift_report_photos for each row execute function public.app__ca_completed_source_guard();
drop trigger if exists ca_source_guard on public.shift_recon_log;
create trigger ca_source_guard before insert or update or delete on public.shift_recon_log for each row execute function public.app__ca_completed_source_guard();
drop trigger if exists ca_source_guard on public.fin_move_cats;
create trigger ca_source_guard before insert or update or delete on public.fin_move_cats for each row execute function public.app__ca_completed_source_guard();

create or replace function public.app__ca_gap_source_guard() returns trigger
language plpgsql security definer set search_path=public as $$
declare rid bigint; rid2 bigint;
begin
  if TG_TABLE_NAME='gap_matches' then
    rid:=case when TG_OP='DELETE' then OLD.short_report else NEW.short_report end;
    rid2:=case when TG_OP='DELETE' then OLD.over_report else NEW.over_report end;
  else rid:=case when TG_OP='DELETE' then OLD.report_id else NEW.report_id end; end if;
  if rid is not null and exists(select 1 from public.shift_reports r where r.id=rid and r.status='hoan_thanh') then perform public.app__ca_recon_require_ready(rid); end if;
  if rid2 is not null and rid2 is distinct from rid and exists(select 1 from public.shift_reports r where r.id=rid2 and r.status='hoan_thanh') then perform public.app__ca_recon_require_ready(rid2); end if;
  return case when TG_OP='DELETE' then OLD else NEW end;
end $$;
drop trigger if exists ca_source_guard on public.gap_matches;
create trigger ca_source_guard before insert or update or delete on public.gap_matches for each row execute function public.app__ca_gap_source_guard();
drop trigger if exists ca_source_guard on public.gap_decisions;
create trigger ca_source_guard before insert or update or delete on public.gap_decisions for each row execute function public.app__ca_gap_source_guard();
drop trigger if exists ca_source_guard on public.shift_shortfalls;
create trigger ca_source_guard before insert or update or delete on public.shift_shortfalls for each row execute function public.app__ca_gap_source_guard();

-- Phân loại Thu/Chi từ nút Kiểm tra phải đủ nguồn. Không khóa thẳng bảng
-- fin_move_cats vì lúc gửi phiếu, hệ thống còn tự gắn nhóm cho Khách mượn/Đổi tiền.
create or replace function public.app_tc_check(p_report bigint,p_mkey text,p_category bigint,p_excluded boolean,p_checked boolean) returns void
language plpgsql security definer set search_path=public as $$
declare a public.accounts; r public.shift_reports; m record; ex boolean:=coalesce(p_excluded,false); ok boolean:=coalesce(p_checked,false);
begin
  select * into r from public.shift_reports where id=p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  if r.status='hoan_thanh' then perform public.app__ca_recon_require_ready(p_report); end if;
  a:=public.app__tc_need(r.branch_id);
  if public.app__fin_locked(r.branch_id,r.work_date) then raise exception 'Tháng này đã CHỐT nên không sửa được.'; end if;
  select * into m from public.app__tc_moves(r.branch_id,r.work_date,r.work_date) x where x.report_id=p_report and x.mkey=p_mkey;
  if m.report_id is null then raise exception 'Dòng thu chi này đã thay đổi trên phiếu ca. Tải lại trang.'; end if;
  if exists(select 1 from public.app__tc_moves_x(r.branch_id,r.work_date,r.work_date) t where t.report_id=p_report and t.mkey=p_mkey and t.auto='doi_tien') and (not ex or not ok or p_category is not null) then raise exception 'Khách CK rút tiền mặt luôn Không tính thu chi; sửa cả phiếu ở Chốt ca / Đối soát.'; end if;
  if public.app__tc_move_ka(p_report,p_mkey) then raise exception 'Khoản này đã gán âm tiền TRỪ LƯƠNG — bấm "Bỏ gán" ở dòng Âm tiền trước khi sửa / đổi nhóm.'; end if;
  if exists(select 1 from public.branch_loans l where l.report_id=p_report and l.mkey=p_mkey) then raise exception 'Khoản "%" đã đổi thành cho vay — xem ở khung Cho vay (xoá khoản vay đó thì khoản trở lại Thu chi).',m.note; end if;
  if ok and not ex and p_category is null then raise exception 'Chọn nhóm (hoặc "Không tính") rồi mới đối soát.'; end if;
  if not ex and p_category is not null and not exists(select 1 from public.fin_categories c where c.id=p_category and c.kind=case when m.amount<0 then 'chi' else 'thu' end) then raise exception 'Nhóm không đúng loại Thu / Chi.'; end if;
  insert into public.fin_move_cats(report_id,mkey,category_id,excluded,by_account,at,checked,checked_by,checked_at)
  values(p_report,p_mkey,case when ex then null else p_category end,case when ex then 1 else 0 end,a.id,public.vn_now_text(),case when ok then 1 else 0 end,case when ok then a.id end,case when ok then public.vn_now_text() end)
  on conflict(report_id,mkey) do update set category_id=excluded.category_id,excluded=excluded.excluded,by_account=excluded.by_account,at=excluded.at,checked=excluded.checked,checked_by=excluded.checked_by,checked_at=excluded.checked_at;
  perform public.app_log(case when ok then 'thu_chi_doi_soat' else 'thu_chi_bo_doi_soat' end,'report='||p_report||' '||m.amount||' '||m.note);
end $$;

create or replace function public.app_ca_cash_mode(p_id bigint,p_mode text,p_counted bigint) returns void
language plpgsql security definer set search_path=public as $$
declare a public.accounts; r public.shift_reports;
begin
  a:=public.app__need('doi_soat');
  select * into r from public.shift_reports where id=p_id;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  if r.status<>'hoan_thanh' then raise exception 'Nhân viên chưa hoàn thành phiếu ca.'; end if;
  perform public.app__ca_recon_require_ready(p_id);
  if coalesce(r.recon_status,'')='hoan_thanh' then raise exception 'Ca đã hoàn thành đối soát — mở lại để sửa.'; end if;
  if coalesce(p_mode,'') not in ('ca','ngay') then raise exception 'Chọn thu theo ca hay thu cuối ngày.'; end if;
  if p_mode='ca' and p_counted is not null and p_counted<0 then raise exception 'Số đếm không được âm.'; end if;
  if public.app__fin_locked(r.branch_id,r.work_date) then raise exception 'Tháng này đã CHỐT.'; end if;
  update public.shift_reports set cash_mode=p_mode,ql_counted=case when p_mode='ca' then p_counted end,
    ql_counted_by=case when p_mode='ca' and p_counted is not null then a.id end,
    ql_counted_at=case when p_mode='ca' and p_counted is not null then public.vn_now_text() end where id=p_id;
  perform public.app_log('ca_cach_thu','id='||p_id||' '||p_mode||coalesce(' '||p_counted,''));
end $$;

-- Khi file Fabi đã tải trước lúc nhân viên gửi, app__ca_finish áp số Fabi vào bản
-- Kiểm tra trong cùng giao dịch gửi. Đánh dấu đúng ngữ cảnh hệ thống này trước khi ghi.
create or replace function public.app__fabi_apply_report(p_id bigint) returns void
language plpgsql security definer set search_path=public as $$
declare m text; r public.shift_reports;
begin
  select * into r from public.shift_reports where id=p_id;
  perform set_config('app.fabi_report',p_id::text,true);
  for m in select f.ma_ca from public.fabi_shifts f where f.branch_id=r.branch_id and f.work_date=r.work_date and f.shift=r.shift loop
    perform public.app__fabi_apply(m);
    perform public.app__fabi_cups(m);
  end loop;
  perform set_config('app.fabi_report','',true);
end $$;

-- Mọi cách hoàn tất các phần đều đi qua đây. Context này chỉ cho phép các bút
-- toán nhóm tự sinh phục vụ Gửi phiếu; kết thúc giao dịch là tự mất.
create or replace function public.app__ca_finish(p_id bigint,p_acc bigint) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform set_config('app.ca_submit_report',p_id::text,true);
  perform public.app__ca_part_check(p_id,'tien');
  perform public.app__ca_part_check(p_id,'nhan_su');
  update public.shift_reports set status='hoan_thanh',completed_by=p_acc,completed_at=public.vn_now_text(),updated_by=p_acc,updated_at=public.vn_now_text() where id=p_id;
  perform public.app_log('hoan_thanh_chot_ca','report='||p_id||' (đủ các phần việc)');
  perform public.app__ca_loan_cats(p_id,p_acc);
  perform public.app__ca_auto_recon(p_id,p_acc);
  perform public.app__fabi_apply_report(p_id);
end $$;

-- Hoàn tất phiếu không được tạo tiến độ Kiểm tra. Khi đủ nguồn và quản lý mở
-- Kiểm tra, mục Nhập hàng không phát sinh vẫn được tự đánh dấu như quy trình cũ.
create or replace function public.app__ca_auto_recon(p_id bigint,p_acc bigint) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not coalesce((public.app__ca_kt_state(p_id)->>'ready')::boolean,false) then return; end if;
  if not exists(select 1 from public.delivery_invoices where received_report_id=p_id) then
    insert into public.shift_report_checks(report_id,item,checked_by,checked_at) values(p_id,'nhap_hang',p_acc,public.vn_now_text())
    on conflict(report_id,item) do nothing;
  end if;
  perform public.app__ca_auto_finish(p_id,p_acc);
end $$;

-- Mở bản Kiểm tra cũng phải đủ hai nguồn; không tạo snapshot khi còn thiếu.
create or replace function public.app_ca_recon(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; d jsonb; staff_names jsonb;
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_id;
  if r.id is null then raise exception 'Không tìm thấy phiếu.'; end if;
  if r.status <> 'hoan_thanh' then raise exception 'Nhân viên chưa hoàn thành phiếu này nên chưa có bản đối soát.'; end if;
  perform public.app__ca_recon_require_ready(p_id);
  perform public.app__ca_auto_recon(p_id,a.id);
  insert into public.shift_report_recon(report_id, data, updated_by) values (p_id, public.app__recon_snapshot(p_id), a.id)
  on conflict (report_id) do nothing;
  select data into d from public.shift_report_recon where report_id = p_id;
  select coalesce(jsonb_object_agg(e.id::text, jsonb_build_object('code', e.code, 'name', e.name, 'rank', e.rank, 'pay_cash', e.pay_cash)), '{}') into staff_names
    from public.employees e
   where e.id in (select (x ->> 'employee_id')::bigint from jsonb_array_elements(d -> 'staff') x
                  union select (x ->> 'employee_id')::bigint from jsonb_array_elements(public.app__recon_snapshot(p_id) -> 'staff') x);
  return jsonb_build_object(
    'data', d,
    'original', public.app__recon_snapshot(p_id),
    'employees', staff_names,
    'editable', r.recon_status <> 'hoan_thanh',
    'recon_status', r.recon_status,
    'log', coalesce((select jsonb_agg(jsonb_build_object('action', l.action, 'field', l.field, 'before', l.before, 'after', l.after,
                       'reason', l.reason, 'by', public.app__acc_name(l.by_account), 'at', l.at) order by l.id desc)
                     from public.shift_recon_log l where l.report_id = p_id), '[]'));
end $$;

-- Quản lý gửi phiếu khi thiếu nguồn: hoàn thành phần nhân viên, không tự đối soát.
create or replace function public.app_ca_submit_unified(p_id bigint, p_categories jsonb default '[]', p_gaps jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.accounts; r public.shift_reports; x record; q jsonb; c jsonb; m jsonb;
 it text; comp bigint; used bigint[] := '{}'; cat_row record; self_close boolean; cat_id bigint; is_excluded boolean; choice text; people jsonb; employee_row record; n_people int; allocation bigint; remaining bigint;
begin
 a := public.app__need('chot_ca');
 select * into r from public.shift_reports where id=p_id for update;
 if r.id is null or r.status <> 'dang_chot' then raise exception 'Phiếu đã gửi hoặc không tồn tại. Tải lại trang.'; end if;
 if public.app__fin_locked(r.branch_id,r.work_date) then raise exception 'Tháng đã chốt — không sửa được.'; end if;
 if exists(select 1 from unnest(array['tien','nhan_su']) k where not exists(select 1 from public.shift_report_parts p where p.report_id=p_id and p.part=k and p.claimed_by=a.id)) then
   raise exception 'Chỉ người nhận cả phần tiền và nhân sự được gửi phiếu này.';
 end if;
 if exists(select 1 from public.shift_report_moves where report_id=p_id and (amount=0 or trim(note)='')) then raise exception 'Mỗi khoản phải có nội dung và số tiền khác 0.'; end if;
 self_close := coalesce(public.app_can('doi_soat'),false)
   and coalesce((public.app__ca_kt_state(p_id)->>'ready')::boolean,false);
 perform public.app_ca_part_done(p_id,'tien',true);
 perform public.app_ca_part_done(p_id,'nhan_su',true);
 select * into r from public.shift_reports where id=p_id;
 if r.status <> 'hoan_thanh' then raise exception 'Còn phần nhận hàng của phiếu cũ chưa hoàn thành.'; end if;
 perform public.app__ca_exchange_cats(p_id,a.id);
 if self_close then
   for x in select * from public.app__tc_moves_x(r.branch_id,r.work_date,r.work_date) where report_id=p_id and auto is null order by ord loop
     c := null;
     for cat_row in select v, ord from jsonb_array_elements(coalesce(p_categories,'[]')) with ordinality as t(v,ord) where not ord=any(used) order by ord loop
       q:=cat_row.v;
       if q->>'kind'=x.pay and (q->>'amount')::bigint=x.amount and coalesce(q->>'note','')=x.note then c:=q; used:=array_append(used,cat_row.ord); exit; end if;
     end loop;
     if nullif(c->>'category','') is null then raise exception 'Chọn nhóm cho khoản: %',x.note; end if;
     is_excluded := c->>'category'='x'; cat_id := case when is_excluded then null else (c->>'category')::bigint end;
     perform public.app_tc_check(p_id,x.mkey,cat_id,is_excluded,true);
   end loop;
   update public.shift_reports set self_reconciled=true where id=p_id;
   perform set_config('app.ca_self_submit',p_id::text,true);
   insert into public.shift_report_checks(report_id,item,checked_by,checked_at)
   select p_id,k,a.id,public.vn_now_text() from unnest(public.app__ca_check_items()) k
   where not (k=any(public.app__ca_money_items())) on conflict(report_id,item) do nothing;
   m := public.app__ca_money(p_id);
   foreach it in array public.app__ca_money_items() loop
     comp := case it when 'tien_mat' then (m->>'tm_left')::bigint when 'chuyen_khoan' then (m->>'ck_left')::bigint else 0 end;
     if comp is null then raise exception 'Chưa đủ số liệu %.',it; end if;
     if exists(select 1 from public.shift_report_checks c join public.shift_report_results v on v.report_id=c.report_id and v.item=c.item where c.report_id=p_id and c.item=it) then continue; end if;
     if (select recon_status from public.shift_reports where id=p_id)='hoan_thanh' then exit; end if;
     choice := coalesce(p_gaps->it->>'action','sau'); people:='[]';
     if choice not in ('sau','qc','chia') then raise exception 'Cách xử lý lệch không hợp lệ.'; end if;
     if choice <> 'sau' and (p_gaps->it->>'expected')::bigint is distinct from comp then raise exception 'Số lệch đã thay đổi. Kiểm tra lại trước khi gửi.'; end if;
     if choice='chia' then
       if comp>=0 then raise exception 'Chỉ chia khoản thiếu cho người làm ca.'; end if;
       select count(*) into n_people from public.shift_report_staff where report_id=p_id and worked=1;
       if n_people=0 or abs(comp)<n_people then raise exception 'Chưa có đủ người làm ca để chia khoản thiếu.'; end if;
       remaining:=abs(comp); allocation:=abs(comp)/n_people;
       for employee_row in select employee_id from public.shift_report_staff where report_id=p_id and worked=1 order by employee_id loop
         people:=people||jsonb_build_array(jsonb_build_object('employee_id',employee_row.employee_id,'amount',case when n_people=1 then remaining else allocation end));
         remaining:=remaining-allocation; n_people:=n_people-1;
       end loop;
     end if;
     perform public.app_ca_result_set(p_id,it,case when comp<0 then 'thieu' when comp>0 then 'thua' else 'khop' end,abs(comp),
       case when choice='chia' then 'Quản lý tự chốt — chia đều người làm ca' else 'Quản lý tự chốt ca; lệch còn lại theo dõi tại Lệch tiền ca' end, people);
     if choice='qc' and comp<>0 then
       perform public.app_gap_decide(p_id,it,case when comp<0 then 'quan_chiu' else 'thu_khac' end,abs(comp),'Quản lý tự chốt — chọn xử lý lệch');
     end if;
   end loop;
   perform public.app__ca_auto_finish(p_id,a.id);
   perform set_config('app.ca_self_submit','',true);
   insert into public.shift_recon_log(report_id,action,reason,by_account) values(p_id,'ql_tu_lam','Quản lý tự chốt; nghỉ/làm thay theo dõi riêng trong Công việc',a.id);
 end if;
 perform public.app__pc_tick();
 return jsonb_build_object('completed',true,'self_reconciled',self_close);
end $$;

revoke all on function public.app__ca_recon_require_ready(bigint) from public,anon,authenticated;
revoke all on function public.app__ca_kt_guard() from public,anon,authenticated;
revoke all on function public.app__ca_fabi_context(),public.app__ca_recon_write_guard(),public.app__ca_debt_recon_guard(),public.app__ca_completed_source_guard(),public.app__ca_handover_source_guard(),public.app__ca_gap_source_guard(),public.app__ca_auto_recon(bigint,bigint),public.app__fabi_apply_report(bigint),public.app__ca_finish(bigint,bigint) from public,anon,authenticated;
revoke all on function public.app_ca_recon(bigint),public.app_ca_submit_unified(bigint,jsonb,jsonb) from public,anon;
revoke all on function public.app_tc_check(bigint,text,bigint,boolean,boolean) from public,anon;
revoke all on function public.app_ca_cash_mode(bigint,text,bigint) from public,anon;
grant execute on function public.app_ca_recon(bigint),public.app_ca_submit_unified(bigint,jsonb,jsonb),public.app_tc_check(bigint,text,bigint,boolean,boolean),public.app_ca_cash_mode(bigint,text,bigint) to authenticated;

insert into public.app_migrations(file) values ('104_cho_du_fabi_ngan_hang.sql') on conflict (file) do nothing;
