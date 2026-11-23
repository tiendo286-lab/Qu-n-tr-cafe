-- Xoá phiếu "Luân chuyển TM – CK" của ca (anh Tiến chốt 23/11/2026).
--   Vì sao: quản lý ĐK thêm trùng 2 phiếu luân chuyển 80.000 ở ca Tối 03/11 mà không gỡ được — app_stc_move_save chặn khoản luân chuyển
--   ("sửa ở phiếu ca"), còn phiếu ca đã bỏ ô sửa tiền từ chặng 5 (phần tiền làm ở trang đối soát ca).
--   Cách làm: xoá CẢ HAI vế (tiền mặt + chuyển khoản) cùng mã luân chuyển khỏi bản đối soát của ca (phiếu nhân viên giữ nguyên),
--   bắt lý do, ghi lịch sử — như app_stc_move_exchange (tệp 160).
--   Quyền: như sửa khoản của ca ở Sổ thu chi (app__stc_need — dùng lại, KHÔNG đổi, không mở thêm quyền).
--   Điều kiện như tệp 160: tháng chưa chốt, ca đã Xác nhận Fabi, ca chưa Hoàn thành đối soát (đã Hoàn thành thì Mở lại trước).
--   Khoá nhóm chi phí (fin_move_cats) đánh số theo thứ tự các khoản giống hệt nhau → xoá xong dồn số các khoản giống hệt còn lại.
-- Bài thử: kiem_tra/xoa_luan_chuyen_170_cuc_bo.sql. Chạy lại nhiều lần không sao.

create or replace function public.app_stc_move_exchange_delete(p_report bigint, p_mkey text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; m record; x record; y record; d jsonb; mv jsonb; nm jsonb; pair jsonb; n int;
        rs text := public.app__stc_reason(p_reason); k text; h text; num int;
begin
  select * into r from public.shift_reports where id = p_report for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__stc_need(r.branch_id);
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không sửa được.'; end if;
  if not (exists (select 1 from public.shift_report_results s where s.report_id = p_report and s.item = 'tien_mat')
          and exists (select 1 from public.shift_report_results s where s.report_id = p_report and s.item = 'chuyen_khoan')) then
    raise exception 'Ca chưa xác nhận Fabi — xác nhận ở Đối soát Fabi trước rồi mới xoá phiếu luân chuyển.';
  end if;
  if exists (select 1 from public.stc_ca_done dn where dn.report_id = p_report) then
    raise exception 'Ca đã hoàn thành đối soát — Mở lại ở tab ③ Hoàn thành mới xoá được.';
  end if;
  insert into public.shift_report_recon(report_id, data, updated_by) values (p_report, public.app__recon_snapshot(p_report), a.id) on conflict (report_id) do nothing;
  select data into d from public.shift_report_recon where report_id = p_report for update;
  n := jsonb_array_length(coalesce(d -> 'moves', '[]'));
  select * into m from public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) t where t.report_id = p_report and t.mkey = p_mkey;
  if m.report_id is null then raise exception 'Phiếu này vừa thay đổi. Tải lại trang rồi làm lại.'; end if;
  if m.auto is distinct from 'doi_tien' or m.ord > n then raise exception 'Khoản này không phải phiếu Luân chuyển TM – CK của ca.'; end if;
  mv := d -> 'moves' -> (m.ord - 1)::int;
  k := nullif(mv ->> 'exchange_key', '');
  if k is null or mv ->> 'kind' is distinct from m.pay or (mv ->> 'amount')::bigint is distinct from m.amount then
    raise exception 'Phiếu này vừa thay đổi. Tải lại trang rồi làm lại.';
  end if;

  -- hai vế của phiếu: bỏ nhóm chi phí, dồn số các khoản giống hệt đứng sau, ghi lịch sử Sổ thu chi (hiện gạch ngang)
  for x in select t.mkey, t.pay, t.amount, t.note from public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) t
            where t.report_id = p_report and t.ord <= n and d -> 'moves' -> (t.ord - 1)::int ->> 'exchange_key' = k order by t.ord
  loop
    h := split_part(x.mkey, '#', 1); num := split_part(x.mkey, '#', 2)::int;
    delete from public.fin_move_cats where report_id = p_report and mkey = x.mkey;
    for y in select fc.mkey from public.fin_move_cats fc where fc.report_id = p_report and fc.mkey like h || '#%' and split_part(fc.mkey, '#', 2)::int > num
              order by split_part(fc.mkey, '#', 2)::int
    loop
      update public.fin_move_cats set mkey = h || '#' || (split_part(y.mkey, '#', 2)::int - 1) where report_id = p_report and mkey = y.mkey;
    end loop;
    perform public.app__stc_log(r.branch_id, 'move', 'm:' || p_report || ':' || x.mkey, 'xoa',
      jsonb_build_object('date', r.work_date, 'ca_id', r.id, 'book', case when x.amount < 0 then 'chi' else 'thu' end,
        'pm', case when x.pay = 'chuyen_khoan' then 'ck' else 'tm' end, 'col', 'lc', 'amount', abs(x.amount), 'title', x.note, 'exchange_key', k), null, rs);
  end loop;

  select coalesce(jsonb_agg(t.v order by t.ord) filter (where t.v ->> 'exchange_key' is distinct from k), '[]'::jsonb),
         jsonb_agg(t.v order by t.ord) filter (where t.v ->> 'exchange_key' = k)
    into nm, pair from jsonb_array_elements(d -> 'moves') with ordinality t(v, ord);
  d := jsonb_set(d, '{moves}', nm);
  perform public.app__ca_validate_exchanges(nm);
  update public.shift_report_recon set data = d, updated_by = a.id, updated_at = public.vn_now_text() where report_id = p_report;
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
  values (p_report, 'xoa', 'moves', pair, null, 'Sổ thu chi: xoá Luân chuyển TM – CK · ' || rs, a.id);
  perform public.app__ca_exchange_cats(p_report, a.id);   -- phiếu luân chuyển còn lại: vẫn "Không tính", đã đối soát
  perform public.app_log('stc_xoa_luan_chuyen', 'report=' || p_report || ' ' || m.pay || ' ' || m.amount);
end $$;

revoke all on function public.app_stc_move_exchange_delete(bigint, text, text) from public, anon;
grant execute on function public.app_stc_move_exchange_delete(bigint, text, text) to authenticated;

insert into public.app_migrations(file) values ('170_xoa_luan_chuyen_trong_ca.sql') on conflict (file) do nothing;
