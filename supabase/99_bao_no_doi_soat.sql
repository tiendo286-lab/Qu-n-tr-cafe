-- Bước 116 (chốt 16/11/2026): Đối soát — quản lý thêm / sửa / xoá Báo nợ giống nhân viên.
--  * Báo nợ = khoản nợ của phiếu ca (shift_debts, loại TM 'muon' / CK 'ck' / HĐ 'bill'). Tiền của ca tính lại ngay
--    (TM trừ tiền phải có trong két, CK trừ tiền phải thấy trên hotline, HĐ không trừ) — giống nhân viên ghi khi chốt ca.
--  * Dùng khi quản lý đổi 1 khoản Thu / Chi nhân viên ghi nhầm thành Báo nợ, sửa số tiền / tên của Báo nợ nhân viên ghi, hoặc thêm mới.
--  * Bắt buộc lý do; ghi lịch sử (shift_recon_log: bao_no_them / bao_no_sua / bao_no_xoa); ca đã hoàn thành đối soát
--    phải "Sửa phần tiền" (mở lại) trước; tháng đã chốt thì không sửa được; khoản đã thu thì không sửa / xoá.
-- Chạy lại nhiều lần không sao.

create or replace function public.app_ca_recon_debt_set(p_report bigint, p_debt bigint, p_kind text, p_name text, p_amount bigint,
                                                        p_note text, p_reason text, p_from text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; d public.shift_debts; nid bigint;
        why text := nullif(trim(coalesce(p_reason, '')), ''); nm text := trim(coalesce(p_name, '')); nt text := nullif(trim(coalesce(p_note, '')), '');
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_report for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu chưa hoàn thành nên chưa đối soát được.'; end if;
  if coalesce(r.recon_status, '') = 'hoan_thanh' then raise exception 'Ca đã hoàn thành đối soát — bấm "Sửa phần tiền" để mở lại rồi sửa.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT — không sửa được.'; end if;
  if why is null then raise exception 'Ghi lý do sửa ở cuối trang trước.'; end if;
  if coalesce(p_kind, '') not in ('bill', 'muon', 'ck') then raise exception 'Chọn TM / CK / HĐ cho khoản nợ.'; end if;
  if nm = '' then raise exception 'Ghi tên khách / bàn cho khoản nợ.'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'Số tiền nợ phải lớn hơn 0.'; end if;
  if p_debt is null then
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, created_by, kind)
    values (r.branch_id, r.id, nm, p_amount, nt, a.id, p_kind) returning id into nid;
    insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
    values (r.id, 'bao_no_them', null, case when nullif(trim(coalesce(p_from, '')), '') is null then null else to_jsonb(trim(p_from)) end,
            jsonb_build_object('id', nid, 'kind', p_kind, 'table_name', nm, 'amount', p_amount), why, a.id);
  else
    select * into d from public.shift_debts where id = p_debt and report_id = r.id for update;
    if d.id is null then raise exception 'Không tìm thấy khoản nợ của ca này.'; end if;
    if d.closed_at is not null then raise exception 'Khoản nợ đã thu — không sửa được.'; end if;
    nid := d.id;
    if (d.table_name, d.amount, coalesce(d.kind, 'bill'), coalesce(d.note, '')) is distinct from (nm, p_amount, p_kind, coalesce(nt, '')) then
      update public.shift_debts set table_name = nm, amount = p_amount, kind = p_kind, note = nt where id = d.id;
      insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
      values (r.id, 'bao_no_sua', null, jsonb_build_object('kind', coalesce(d.kind, 'bill'), 'table_name', d.table_name, 'amount', d.amount),
              jsonb_build_object('id', nid, 'kind', p_kind, 'table_name', nm, 'amount', p_amount), why, a.id);
    end if;
  end if;
  perform public.app_log('doi_soat_bao_no', 'report=' || r.id || ' debt=' || nid);
  return nid;
end $$;

create or replace function public.app_ca_recon_debt_remove(p_report bigint, p_debt bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; d public.shift_debts; why text := nullif(trim(coalesce(p_reason, '')), '');
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_report for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Phiếu chưa hoàn thành nên chưa đối soát được.'; end if;
  if coalesce(r.recon_status, '') = 'hoan_thanh' then raise exception 'Ca đã hoàn thành đối soát — bấm "Sửa phần tiền" để mở lại rồi sửa.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT — không sửa được.'; end if;
  if why is null then raise exception 'Ghi lý do sửa ở cuối trang trước.'; end if;
  select * into d from public.shift_debts where id = p_debt and report_id = r.id for update;
  if d.id is null then raise exception 'Không tìm thấy khoản nợ của ca này.'; end if;
  if d.closed_at is not null then raise exception 'Khoản nợ đã thu — không xoá được.'; end if;
  delete from public.shift_debts where id = d.id;
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
  values (r.id, 'bao_no_xoa', null, jsonb_build_object('id', d.id, 'kind', coalesce(d.kind, 'bill'), 'table_name', d.table_name, 'amount', d.amount), null, why, a.id);
  perform public.app_log('doi_soat_bao_no_xoa', 'report=' || r.id || ' debt=' || d.id);
end $$;

revoke all on function public.app_ca_recon_debt_set(bigint, bigint, text, text, bigint, text, text, text) from public, anon;
revoke all on function public.app_ca_recon_debt_remove(bigint, bigint, text) from public, anon;
grant execute on function public.app_ca_recon_debt_set(bigint, bigint, text, text, bigint, text, text, text) to authenticated;
grant execute on function public.app_ca_recon_debt_remove(bigint, bigint, text) to authenticated;

insert into public.app_migrations(file) values ('99_bao_no_doi_soat.sql') on conflict (file) do nothing;
