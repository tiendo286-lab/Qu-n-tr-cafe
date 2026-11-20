-- Bài thử CỤC BỘ cho supabase/154_giao_ca_chia_doi.sql (bước 173 đợt C phần 2 — anh Tiến chốt 20/11 khuya):
--   thiếu tiền khi giao ca → thêm lựa chọn "Hai ca cùng chịu" (chia đôi, ca này chịu phần lẻ); thừa thì vẫn chọn một ca;
--   ca trước Thu theo ca cũng chọn được "Ca trước ghi sai" / chia đôi (tiền thực nhận của ca trước = số quản lý đếm + phần ca trước chịu).
-- Chạy trên Postgres cục bộ đã có tệp 150–153. REPORT>> tự hoàn tác.
do $$
declare chu public.accounts; rep text := ''; it text; t text; b public.stc_open_blame; m0 bigint; m1 bigint; op bigint;
  P constant bigint := 994001; TT constant bigint := 994002; P2 constant bigint := 994003; T2 constant bigint := 994004;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  -- ngày 12/11: ca Sáng THU THEO CA (quản lý đếm 1.300.000, để lại 1.000.000) → ca Chiều đếm đầu ca chỉ 970.000 (thiếu 30.000)
  -- ngày 11/11: ca Sáng THU CUỐI NGÀY (két 1.300.000 giao hết) → ca Chiều đếm đầu ca 1.274.999 (thiếu 25.001)
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode, ql_counted,
      opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer) values
    (P,  1, '2026-11-12', 'Sáng',  'hoan_thanh', 'chua', 'ca',   1300000, 1000000, 1000000, 300000, 300000, 0, 0, 1300000, 0),
    (TT, 1, '2026-11-12', 'Chiều', 'hoan_thanh', 'chua', 'ca',   1170000, 970000,  970000,  200000, 200000, 0, 0, 1170000, 0),
    (P2, 1, '2026-11-11', 'Sáng',  'hoan_thanh', 'chua', 'ngay', null,    1000000, 1000000, 300000, 300000, 0, 0, 1300000, 0),
    (T2, 1, '2026-11-11', 'Chiều', 'hoan_thanh', 'chua', 'ngay', null,    1274999, 1274999, 200000, 200000, 0, 0, 1474999, 0);
  insert into public.fabi_stores(store_name, branch_id) values ('Cửa hàng thử 154', 1) on conflict do nothing;
  insert into public.fabi_shifts(ma_ca, store_name, branch_id, work_date, shift, dau, net, tm, ck, no, report_id) values
    ('thu-154-P', 'Cửa hàng thử 154', 1, '2026-11-12', 'Sáng', 1000000, 300000, 300000, 0, 0, P),
    ('thu-154-T', 'Cửa hàng thử 154', 1, '2026-11-12', 'Chiều', 970000, 200000, 200000, 0, 0, TT),
    ('thu-154-P2', 'Cửa hàng thử 154', 1, '2026-11-11', 'Sáng', 1000000, 300000, 300000, 0, 0, P2),
    ('thu-154-T2', 'Cửa hàng thử 154', 1, '2026-11-11', 'Chiều', 1274999, 200000, 200000, 0, 0, T2);
  insert into public.bank_account_balances(report_id, account_id, opening, closing)
  select q.id, k.id, 0, 0 from public.bank_accounts k, (values (P), (TT), (P2), (T2)) q(id) where k.branch_id = 1 and k.active = 1;

  -- (1) "Hai ca cùng chịu" khi ca trước Thu theo ca: ca trước chịu 15.000 (tiền thực nhận ca trước giảm 15.000), ca này chịu 15.000 (tiền đầu ca tính 985.000)
  m0 := (public.app__ca_money(P) ->> 'tm_left')::bigint;
  perform public.app_stc_ds_blame(TT, 'doi', 'Không rõ ai đếm sai');
  m1 := (public.app__ca_money(P) ->> 'tm_left')::bigint; op := (public.app__ca_eff(TT) ->> 'opening_cash')::bigint;
  select * into b from public.stc_open_blame where report_id = TT;
  rep := rep || E'\n' || case when b.who = 'doi' and b.diff = -30000 and b.prev_amt = -15000 and m1 - m0 = -15000 and op = 985000
        and public.app__stc_real_tm(P) = 1285000 and coalesce((public.app__stc_ds_state(TT) ->> 'mo2')::boolean, false) then 'ĐẠT' else 'HỎNG' end
      || format(' (1) chia đôi (ca trước thu theo ca): ca trước dư %s → %s · tiền thực nhận ca trước %s · tiền đầu ca này tính %s · phần ca trước %s', m0, m1, public.app__stc_real_tm(P), op, b.prev_amt);
  -- (6) sổ tháng: tiền thực tế của ca trước theo số mới
  rep := rep || E'\n' || case when (select (c ->> 'real_tm')::bigint from jsonb_array_elements(public.app_stc_month(1, '2026-11') -> 'cas') c where (c ->> 'id')::bigint = P) = 1285000
        then 'ĐẠT' else 'HỎNG' end || ' (6) sổ tháng: tiền thực tế ca trước = 1.285.000';

  -- (2) Huỷ chọn → ca trước, ca này về như cũ
  perform public.app_stc_ds_blame_undo(TT, 'Chọn lại');
  rep := rep || E'\n' || case when (public.app__ca_money(P) ->> 'tm_left')::bigint = m0 and (public.app__ca_eff(TT) ->> 'opening_cash')::bigint = 970000 and public.app__stc_real_tm(P) = 1300000
        then 'ĐẠT' else 'HỎNG' end || format(' (2) huỷ chọn: ca trước dư %s · tiền đầu ca này %s', public.app__ca_money(P) ->> 'tm_left', public.app__ca_eff(TT) ->> 'opening_cash');

  -- (3) "Ca trước ghi sai" khi ca trước Thu theo ca (nay cho chọn): ca trước chịu cả 30.000, ca này tính từ số thật nhận 970.000
  perform public.app_stc_ds_blame(TT, 'truoc', 'Ca sáng để lại thiếu');
  rep := rep || E'\n' || case when (public.app__ca_money(P) ->> 'tm_left')::bigint - m0 = -30000 and (public.app__ca_eff(TT) ->> 'opening_cash')::bigint = 970000
        and (select prev_amt from public.stc_open_blame where report_id = TT) = -30000 then 'ĐẠT' else 'HỎNG' end
      || format(' (3) ca trước ghi sai (thu theo ca): ca trước dư %s → %s', m0, public.app__ca_money(P) ->> 'tm_left');
  perform public.app_stc_ds_blame_undo(TT, 'Chọn lại');

  -- (4) thừa tiền thì không chia đôi được
  update public.shift_reports set opening_cash = 1020000, ipos_opening = 1020000 where id = TT;
  update public.fabi_shifts set dau = 1020000 where ma_ca = 'thu-154-T';
  begin perform public.app_stc_ds_blame(TT, 'doi', 'thử'); t := 'CHIA ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%chỉ dùng khi thiếu%' then 'ĐẠT' else 'HỎNG' end || ' (4) chia đôi khi thừa: ' || t;

  -- (5) chia đôi khi ca trước Thu cuối ngày, số lẻ: thiếu 25.001 → ca trước 12.500, ca này 12.501 (tiền đầu ca này tính 1.287.500)
  m0 := (public.app__ca_money(P2) ->> 'tm_left')::bigint;
  perform public.app_stc_ds_blame(T2, 'doi', 'Không rõ');
  m1 := (public.app__ca_money(P2) ->> 'tm_left')::bigint; op := (public.app__ca_eff(T2) ->> 'opening_cash')::bigint;
  rep := rep || E'\n' || case when m1 - m0 = -12500 and op = 1287500 and (select prev_amt from public.stc_open_blame where report_id = T2) = -12500 then 'ĐẠT' else 'HỎNG' end
      || format(' (5) chia đôi (ca trước thu cuối ngày, số lẻ): ca trước dư %s → %s · tiền đầu ca này tính %s', m0, m1, op);
  perform public.app_stc_ds_blame_undo(T2, 'Chọn lại');
  rep := rep || E'\n' || case when (public.app__ca_money(P2) ->> 'tm_left')::bigint = m0 and (public.app__ca_eff(T2) ->> 'opening_cash')::bigint = 1274999 then 'ĐẠT' else 'HỎNG' end
      || ' (5b) huỷ chọn (thu cuối ngày) → về như cũ';

  raise exception 'REPORT>> %', rep;
end $$;
