-- Chặng 3 (anh Tiến chốt 22/11/2026): "Đổi thành Luân chuyển TM – CK" cho một khoản thu / chi của ca đã xác nhận Fabi.
--   Ví dụ LHP ca Sáng 09/11: khách chuyển khoản 500.000 để rút tiền mặt, phiếu ghi thành khoản chi tiền mặt 500.000 → chuyển khoản dư 500.000,
--   khoản 500.000 bị tính là chi phí. Trước đây phiếu đã gửi thì quản lý không có cách đổi.
--   Cách làm (giống cặp "Khách CK rút tiền mặt" ở tệp 101): giữ nguyên vế cũ (gắn mã luân chuyển) + thêm vế ngược lại ở hình thức kia,
--   cùng số tiền, cùng nội dung → tiền mặt giữ nguyên, chuyển khoản "phải có" đổi đúng số đó; hai vế "Không tính" chi phí, đã đối soát
--   (app__ca_exchange_cats). Ghi vào bản đối soát của ca (phiếu nhân viên giữ nguyên), bắt lý do, ghi lịch sử — như app_stc_move_save (tệp 130).
--   Quyền: như sửa khoản của ca ở Sổ thu chi (app__stc_need — dùng lại, không đổi). Không đổi số tiền.
-- Bài thử: kiem_tra/luan_chuyen_160_cuc_bo.sql (Postgres cục bộ). Chạy lại nhiều lần không sao.

create or replace function public.app_stc_move_exchange(p_report bigint, p_mkey text, p_reason text) returns text
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; m record; d jsonb; mv jsonb; n int; rs text := public.app__stc_reason(p_reason);
        k text := gen_random_uuid()::text; other text; nmv jsonb; snap_old jsonb;
begin
  select * into r from public.shift_reports where id = p_report for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__stc_need(r.branch_id);
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không sửa được.'; end if;
  if not (exists (select 1 from public.shift_report_results s where s.report_id = p_report and s.item = 'tien_mat')
          and exists (select 1 from public.shift_report_results s where s.report_id = p_report and s.item = 'chuyen_khoan')) then
    raise exception 'Ca chưa xác nhận Fabi — xác nhận ở Đối soát Fabi trước rồi mới đổi khoản.';
  end if;
  if exists (select 1 from public.stc_ca_done dn where dn.report_id = p_report) then
    raise exception 'Ca đã hoàn thành đối soát — Mở lại ở bước 6 mới đổi được.';
  end if;
  insert into public.shift_report_recon(report_id, data, updated_by) values (p_report, public.app__recon_snapshot(p_report), a.id) on conflict (report_id) do nothing;
  select data into d from public.shift_report_recon where report_id = p_report for update;
  n := jsonb_array_length(coalesce(d -> 'moves', '[]'));
  select * into m from public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) t where t.report_id = p_report and t.mkey = p_mkey;
  if m.report_id is null then raise exception 'Khoản này vừa thay đổi. Tải lại trang rồi làm lại.'; end if;
  if m.auto is not null or m.ord > n then raise exception 'Khoản tự động (chi lương / khách mượn / đã là luân chuyển) — không đổi được.'; end if;
  mv := d -> 'moves' -> (m.ord - 1)::int;
  if mv ->> 'kind' is distinct from m.pay or (mv ->> 'amount')::bigint is distinct from m.amount then raise exception 'Khoản này vừa thay đổi. Tải lại trang rồi làm lại.'; end if;
  if nullif(mv ->> 'exchange_key', '') is not null then raise exception 'Khoản này đã là Luân chuyển TM – CK.'; end if;
  if m.pay not in ('tien_mat', 'chuyen_khoan') or coalesce(m.amount, 0) = 0 then raise exception 'Khoản này không đổi được.'; end if;
  if public.app__tc_move_ka(p_report, p_mkey) then raise exception 'Khoản này đã chuyển trừ lương — bỏ chuyển trước khi đổi.'; end if;
  if exists (select 1 from public.branch_loans l where l.report_id = p_report and l.mkey = p_mkey)
     or exists (select 1 from public.shift_debts x where x.mv_report = p_report and x.mv_key = p_mkey) then
    raise exception 'Khoản này đã thành nợ / cho vay — sửa ở Công nợ.';
  end if;
  other := case when m.pay = 'tien_mat' then 'chuyen_khoan' else 'tien_mat' end;
  nmv := jsonb_build_object('kind', other, 'amount', -m.amount, 'note', coalesce(mv ->> 'note', ''), 'exchange_key', k);
  d := jsonb_set(d, array['moves', (m.ord - 1)::text], mv || jsonb_build_object('exchange_key', k));
  d := jsonb_set(d, '{moves}', (d -> 'moves') || jsonb_build_array(nmv));
  perform public.app__ca_validate_exchanges(d -> 'moves');
  update public.shift_report_recon set data = d, updated_by = a.id, updated_at = public.vn_now_text() where report_id = p_report;
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
  values (p_report, 'sua', 'moves', mv, jsonb_build_array(mv || jsonb_build_object('exchange_key', k), nmv), 'Sổ thu chi: đổi thành Luân chuyển TM – CK · ' || rs, a.id);
  delete from public.fin_move_cats where report_id = p_report and mkey = p_mkey;   -- bỏ nhóm chi phí cũ
  perform public.app__ca_exchange_cats(p_report, a.id);                                -- 2 vế: Không tính, đã đối soát
  snap_old := jsonb_build_object('date', r.work_date, 'ca_id', r.id, 'book', case when m.amount < 0 then 'chi' else 'thu' end,
    'pm', case when m.pay = 'chuyen_khoan' then 'ck' else 'tm' end, 'col', case when m.amount < 0 then 'chi' else 'khac' end, 'amount', abs(m.amount), 'title', m.note);
  perform public.app__stc_log(r.branch_id, 'move', 'm:' || p_report || ':' || p_mkey, 'luan_chuyen', snap_old,
    snap_old || jsonb_build_object('col', 'lc', 'exchange_key', k, 'pm2', case when other = 'chuyen_khoan' then 'ck' else 'tm' end), rs);
  perform public.app_log('stc_doi_luan_chuyen', 'report=' || p_report || ' ' || m.pay || ' ' || m.amount);
  return k;
end $$;

revoke all on function public.app_stc_move_exchange(bigint, text, text) from public, anon;
grant execute on function public.app_stc_move_exchange(bigint, text, text) to authenticated;

insert into public.app_migrations(file) values ('160_doi_luan_chuyen_trong_ca.sql') on conflict (file) do nothing;
