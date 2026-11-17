-- BƯỚC 125 (tệp 109): web chạy nhanh hơn — KHÔNG đổi kết quả tính tiền.
-- Đo trên máy chủ thật 17/11 (vai Chủ): Việc hôm nay 2,8s → 0,5s; Đối soát 3,8s → 0,7s; Đối soát tuần 3,3s → 0,5s;
-- Công việc 1,8s → 0,17s; Sổ quỹ 14,2s → 1,6s; Chốt tháng quá hạn (>2 phút) → 29s.
-- Đã so: app__ca_eff 197/197 phiếu, app__kt_bank_json 197/197, app__kt_prev_closing_acc 345/345 lần — giống hệt bản cũ.
-- 1) app__ca_eff: bản SQL cũ bị máy chủ chép biểu thức "bản đối soát hoặc chụp mới" ra ~9 chỗ → phiếu chưa đối soát bị chụp 9 lần.
--    Viết lại bằng plpgsql, tính đúng 1 lần.
create or replace function public.app__ca_eff(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $function$
declare d jsonb;
begin
  -- bước 125 (tệp 109): tính bản dữ liệu phiếu ĐÚNG 1 LẦN (bản cũ viết bằng SQL bị máy chủ chép biểu thức ra ~9 chỗ → chụp bản đối soát 9 lần)
  select data into d from public.shift_report_recon where report_id = p_id;
  if d is null then d := public.app__recon_snapshot(p_id); end if;
  if d is null then return null; end if;
  if not (d ? 'pos_debt') then   -- bước 119: bản kiểm tra cũ thiếu 3 khoá mới → lấy theo phiếu nhân viên
    d := d || (select jsonb_build_object('ipos_opening', r.ipos_opening, 'pos_debt', r.pos_debt, 'pos_diff', r.pos_diff) from public.shift_reports r where r.id = p_id);
    if d is null then return null; end if;
  end if;
  return d || jsonb_build_object('moves', coalesce(d -> 'moves', '[]'::jsonb) || coalesce((
      select jsonb_agg(jsonb_build_object('kind', 'tien_mat', 'amount', -(s ->> 'cash_paid')::bigint,
               'note', 'Chi lương – ' || e.code || ' – ' || e.name, 'auto', 'luong', 'employee_id', e.id) order by e.code)
        from jsonb_array_elements(coalesce(d -> 'staff', '[]'::jsonb)) s join public.employees e on e.id = (s ->> 'employee_id')::bigint
       where coalesce(nullif(s ->> 'cash_paid', '')::bigint, 0) > 0 and coalesce((s ->> 'worked')::boolean, true)), '[]'::jsonb)
    -- bước 43: khách mượn tiền → tiền ra khỏi két (không phải chi phí)
    || coalesce((select jsonb_agg(jsonb_build_object('kind', 'tien_mat', 'amount', -dm.amount, 'note', 'Khách mượn – ' || dm.table_name,
               'auto', 'muon', 'debt_id', dm.id) order by dm.id)
        from public.shift_debts dm where dm.report_id = p_id and dm.kind = 'muon' and dm.amount > 0), '[]'::jsonb));
end $function$;


-- 2) app__kt_prev_closing_acc: lấy danh sách ca 1 lần thay vì gọi app__shifts() cho từng dòng khi lọc + sắp xếp.
create or replace function public.app__kt_prev_closing_acc(r public.shift_reports, p_acc bigint) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $function$
declare sh text[] := public.app__shifts(); pos int; res jsonb;
begin
  -- bước 125 (tệp 109): lấy danh sách ca 1 lần (bản cũ gọi app__shifts() cho từng dòng khi lọc + sắp xếp)
  pos := array_position(sh, r.shift);
  select jsonb_build_object('closing', b.closing, 'work_date', p.work_date, 'shift', p.shift) into res
    from public.shift_reports p join public.bank_account_balances b on b.report_id = p.id and b.account_id = p_acc
   where p.branch_id = r.branch_id and b.closing is not null
     and (p.work_date < r.work_date or (p.work_date = r.work_date and array_position(sh, p.shift) < pos))
   order by p.work_date desc, array_position(sh, p.shift) desc limit 1;
  return res;
end $function$;

revoke all on function public.app__ca_eff(bigint) from public, anon, authenticated;
revoke all on function public.app__kt_prev_closing_acc(public.shift_reports, bigint) from public, anon, authenticated;

insert into public.app_migrations(file) values ('109_toc_do_tinh_phieu.sql') on conflict (file) do nothing;
