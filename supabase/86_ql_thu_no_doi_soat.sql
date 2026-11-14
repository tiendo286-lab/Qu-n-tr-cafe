-- Bước 94 (anh Tiến 14/11/2026): Đối soát ca › Phiếu Fabi — quản lý ghi "khách đã trả nợ trong ca này"
-- cho khoản nợ cũ mà nhân viên chốt ca không biết (khách trả mà nhân viên không ghi).
--  Tiền khách trả cộng vào tiền phải có của ca (tiền mặt → két, chuyển khoản → hotline) như nhân viên ghi.
--  Bắt buộc ghi lý do. Mục Tiền mặt / Chuyển khoản đã đối soát thì phải mở lại trước.
-- Chạy lại nhiều lần không sao.

create or replace function public.app_ca_recon_debt_collect(p_report bigint, p_debt bigint, p_kind text, p_amount bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; d public.shift_debts; o public.shift_reports; v_item text;
begin
  perform public.app__need('doi_soat');
  a := public.app_account();
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  if r.status <> 'hoan_thanh' then raise exception 'Nhân viên chưa gửi phiếu này.'; end if;
  if coalesce(r.recon_status, '') = 'hoan_thanh' then raise exception 'Ca đã hoàn thành đối soát — mở lại để sửa.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Ghi lý do (vd: khách trả nhưng nhân viên không biết).'; end if;
  if coalesce(p_kind, '') not in ('tien_mat', 'chuyen_khoan') then raise exception 'Chọn khách trả bằng tiền mặt hay chuyển khoản.'; end if;
  v_item := p_kind;
  if exists (select 1 from public.shift_report_results x where x.report_id = p_report and x.item = v_item)
     or exists (select 1 from public.shift_report_checks x where x.report_id = p_report and x.item = v_item) then
    raise exception 'Mục % đã đối soát — bấm Sửa ở mục đó để mở lại trước.', case when v_item = 'tien_mat' then 'Tiền mặt' else 'Chuyển khoản' end;
  end if;
  select * into d from public.shift_debts where id = p_debt for update;
  if d.id is null or d.closed_at is not null then raise exception 'Khoản nợ này đã được thu hoặc không còn.'; end if;
  if d.branch_id <> r.branch_id then raise exception 'Khoản nợ không thuộc cơ sở của ca này.'; end if;
  if coalesce(d.report_id, 0) = p_report then raise exception 'Đây là nợ phát sinh trong chính ca này.'; end if;
  if d.report_id is not null then
    select * into o from public.shift_reports where id = d.report_id;
    if (o.work_date, array_position(public.app__shifts(), o.shift)) >= (r.work_date, array_position(public.app__shifts(), r.shift)) then
      raise exception 'Khoản nợ ghi ở ca sau ca này.';
    end if;
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nhập số tiền khách trả lớn hơn 0.'; end if;
  if p_amount > d.amount then raise exception 'Khách trả nhiều hơn số nợ (%).', public.app__vnd(d.amount); end if;
  if p_amount < d.amount then   -- trả một phần: phần còn lại thành khoản nợ riêng
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, split_from, gap_report, gap_item, family, from_loan, fund_out)
    values (d.branch_id, d.report_id, d.table_name, d.amount - p_amount, d.note, d.phone, d.created_by, d.created_at, d.kind, d.id, d.gap_report, d.gap_item, d.family, d.from_loan, d.fund_out);
    update public.shift_debts set amount = p_amount where id = d.id;
  end if;
  update public.shift_debts set closed_at = public.vn_now_text(), closed_by = a.id, closed_report_id = p_report, collect_kind = p_kind,
         close_note = 'Quản lý ghi khi đối soát: ' || trim(p_reason)
   where id = p_debt;
  perform public.app_log('doi_soat_thu_no', 'report=' || p_report || ' debt=' || p_debt || ' ' || p_kind || ' ' || p_amount || ' · ' || trim(p_reason));
end $$;
revoke all on function public.app_ca_recon_debt_collect(bigint, bigint, text, bigint, text) from public, anon;
grant execute on function public.app_ca_recon_debt_collect(bigint, bigint, text, bigint, text) to authenticated;

-- bỏ khoản quản lý đã ghi (ghi nhầm)
create or replace function public.app_ca_recon_debt_uncollect(p_report bigint, p_debt bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; d public.shift_debts; rest public.shift_debts;
begin
  perform public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  if coalesce(r.recon_status, '') = 'hoan_thanh' then raise exception 'Ca đã hoàn thành đối soát — mở lại để sửa.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT.'; end if;
  select * into d from public.shift_debts where id = p_debt for update;
  if d.id is null or d.closed_report_id is distinct from p_report or coalesce(d.close_note, '') not like 'Quản lý ghi khi đối soát:%' then
    raise exception 'Chỉ bỏ được khoản quản lý ghi khi đối soát ca này.';
  end if;
  if exists (select 1 from public.shift_report_results x where x.report_id = p_report and x.item = d.collect_kind)
     or exists (select 1 from public.shift_report_checks x where x.report_id = p_report and x.item = d.collect_kind) then
    raise exception 'Mục % đã đối soát — bấm Sửa ở mục đó để mở lại trước.', case when d.collect_kind = 'tien_mat' then 'Tiền mặt' else 'Chuyển khoản' end;
  end if;
  -- trả một phần trước đó: gộp lại phần còn nợ (chưa ai thu)
  select * into rest from public.shift_debts where split_from = d.id and closed_at is null order by id limit 1;
  if rest.id is not null then
    update public.shift_debts set amount = d.amount + rest.amount where id = d.id;
    delete from public.shift_debts where id = rest.id;
  end if;
  update public.shift_debts set closed_at = null, closed_by = null, closed_report_id = null, collect_kind = null, close_note = null where id = p_debt;
  perform public.app_log('doi_soat_bo_thu_no', 'report=' || p_report || ' debt=' || p_debt);
end $$;
revoke all on function public.app_ca_recon_debt_uncollect(bigint, bigint) from public, anon;
grant execute on function public.app_ca_recon_debt_uncollect(bigint, bigint) to authenticated;

insert into public.app_migrations(file) values ('86_ql_thu_no_doi_soat.sql') on conflict (file) do nothing;
