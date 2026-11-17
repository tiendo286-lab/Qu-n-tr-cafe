-- Bước 131 (anh Tiến chốt 17/11): chỉ khi đủ file Fabi + số dư ngân hàng mới kiểm tra / đối soát được.
-- Trước bước 122 (tệp 104), phiếu quản lý tự chốt được "hoàn thành đối soát" ngay cả khi kế toán chưa có số liệu → kế toán không nhập được
-- số dư nữa ("số liệu kế toán đã khoá"). Tệp này trả các phiếu đó về Chờ kế toán: bỏ mục đã duyệt + kết quả (giữ lịch sử, ghi lý do).
-- Chỉ phiếu tháng chưa chốt, chưa có khoản âm / xử lý lệch. Kế toán nhập đủ thì việc Đối soát ca tự giao lại cho người đối soát.
-- Chạy lại nhiều lần không sao (lần sau không còn phiếu nào khớp điều kiện).
do $$
declare r record; n int := 0;
begin
  set local session_replication_role = replica;   -- bỏ qua trigger khoá Kiểm tra khi chưa đủ dữ liệu kế toán (đúng là việc cần làm ở đây)
  for r in select x.id from public.shift_reports x
            where x.recon_status = 'hoan_thanh'
              and coalesce((public.app__ca_kt_state(x.id) ->> 'need')::boolean, false)
              and not coalesce((public.app__ca_kt_state(x.id) ->> 'ready')::boolean, false)
              and not public.app__fin_locked(x.branch_id, x.work_date)
              and not exists (select 1 from public.shift_shortfalls s where s.report_id = x.id)
              and not exists (select 1 from public.gap_decisions g where g.report_id = x.id) loop
    delete from public.shift_report_results where report_id = r.id;
    delete from public.shift_report_checks where report_id = r.id;
    update public.shift_reports set recon_status = 'chua', recon_by = null, recon_at = null, self_reconciled = false where id = r.id;
    insert into public.shift_recon_log(report_id, action, reason, by_account)
    values (r.id, 'tra_ve_cho_ke_toan', 'Tự chốt khi chưa đủ file Fabi + số dư ngân hàng — trả về Chờ kế toán (chỉ đủ dữ liệu kế toán mới kiểm tra đối soát)', null);
    n := n + 1;
  end loop;
  set local session_replication_role = origin;
  raise notice 'Trả về Chờ kế toán: % phiếu', n;
end $$;

-- Sửa lỗi từ tệp 104: kế toán nhập số dư ngân hàng cho phiếu đang Chờ kế toán bị chặn, vì hàm lưu ghi 1 dòng lịch sử 'ke_toan'
-- vào shift_recon_log mà trigger ca_source_guard đòi phiếu đã đủ dữ liệu kế toán (vòng lẩn quẩn). Cho qua đúng dòng lịch sử của kế toán;
-- mọi thao tác Kiểm tra khác vẫn bị chặn khi chưa đủ dữ liệu.
create or replace function public.app__ca_completed_source_guard() returns trigger
language plpgsql security definer set search_path=public as $$
declare rid bigint;
begin
  rid:=case when TG_OP='DELETE' then OLD.report_id else NEW.report_id end;
  if current_setting('app.fabi_report',true)=rid::text then return case when TG_OP='DELETE' then OLD else NEW end; end if;
  if current_setting('app.ca_submit_report',true)=rid::text then return case when TG_OP='DELETE' then OLD else NEW end; end if;
  if TG_TABLE_NAME='shift_recon_log' and TG_OP='INSERT' then   -- bước 131: lịch sử kế toán nhập số liệu (tách 2 tầng: bảng khác không có cột action)
    if NEW.action='ke_toan' then return NEW; end if;
  end if;
  if exists(select 1 from public.shift_reports r where r.id=rid and r.status='hoan_thanh') then
    perform public.app__ca_recon_require_ready(rid);
  end if;
  return case when TG_OP='DELETE' then OLD else NEW end;
end $$;
revoke all on function public.app__ca_completed_source_guard() from public, anon, authenticated;

insert into public.app_migrations(file) values ('115_tra_ve_cho_ke_toan.sql') on conflict (file) do nothing;
