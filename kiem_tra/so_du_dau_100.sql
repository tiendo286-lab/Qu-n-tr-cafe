-- Chỉ chạy cùng migration 100 trong giao dịch tự hoàn tác (begin; <100>; <tệp này>; rollback;).
DO $test$
declare uid uuid; fixed text; hs text; r0 public.shift_reports; nx_before bigint; nx_after bigint; nxid bigint; acc5 bigint; cases text[] := '{}'; s jsonb;
begin
  select auth_user_id into uid from public.accounts where system_role = 'chu' and locked = 0 and auth_user_id is not null limit 1;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  select string_agg(b.code || ' ' || substr(r.work_date, 6) || ' ' || r.shift || ' TK' || l.field || ':' || (l.before #>> '{}') || '→' || (l.after #>> '{}'), ' ; ' order by b.code, r.work_date, r.id)
    into fixed
    from (select report_id, before, after, substring(reason from 'TK [^ ]+ ([0-9]+)') field from public.shift_recon_log where reason like 'Sửa tự động (bước 117)%') l
    join public.shift_reports r on r.id = l.report_id join public.branches b on b.id = r.branch_id;
  cases := cases || ('Đã sửa số đầu: ' || coalesce(fixed, 'không có'));
  -- tiền thực nhận HS sau khi sửa
  select string_agg(substr(r.work_date, 6) || ' ' || r.shift || ' nhận ' || coalesce((public.app__kt_bank_json(r) ->> 'received'), '—') || ' / CK Fabi ' || coalesce(r.pos_transfer::text, '—'), ' ; ' order by r.work_date, r.id)
    into hs from public.shift_reports r join public.branches b on b.id = r.branch_id where b.code = 'HS' and r.work_date between '2026-11-13' and '2026-11-15';
  cases := cases || ('HS sau sửa: ' || hs);
  -- trigger: đổi số cuối 1 ca → số đầu ca sau tự theo
  select r.* into r0 from public.shift_reports r join public.branches b on b.id = r.branch_id where b.code = 'HS' and r.work_date = '2026-11-14' and r.shift = 'Sáng';
  select x.account_id into acc5 from public.bank_account_balances x where x.report_id = r0.id and x.closing is not null order by x.closing desc limit 1;
  select x.report_id, x.opening into nxid, nx_before from public.bank_account_balances x join public.shift_reports p on p.id = x.report_id
   where x.account_id = acc5 and p.work_date = '2026-11-14' and p.shift = 'Chiều';
  update public.bank_account_balances set closing = closing + 1000 where report_id = r0.id and account_id = acc5;
  select opening into nx_after from public.bank_account_balances where report_id = nxid and account_id = acc5;
  if nx_after - nx_before <> 1000 then raise exception 'FAIL trigger: % → %', nx_before, nx_after; end if;
  cases := cases || ('Đổi số cuối Sáng 14/11 +1.000 → số đầu Chiều 14/11 tự +1.000 (' || nx_before || ' → ' || nx_after || ')');
  -- lưu qua hàm: không tích tự nhập thì số đầu gửi sai vẫn = số cuối ca trước; tích thì giữ
  perform public.app_kt_bank_save_accounts(nxid, jsonb_build_array(jsonb_build_object('account_id', acc5, 'opening', 1, 'closing', 90000000, 'transfers_out', 0)));
  if (select opening from public.bank_account_balances where report_id = nxid and account_id = acc5) <> nx_after then raise exception 'FAIL lưu không tích'; end if;
  perform public.app_kt_bank_save_accounts(nxid, jsonb_build_array(jsonb_build_object('account_id', acc5, 'opening', 123, 'closing', 90000000, 'transfers_out', 0, 'opening_manual', true)));
  if (select opening from public.bank_account_balances where report_id = nxid and account_id = acc5 and opening_manual) <> 123 then raise exception 'FAIL lưu có tích'; end if;
  cases := cases || 'Lưu: không tích "khác số cuối ca trước" thì số đầu tự = số cuối ca trước; có tích thì giữ số tự nhập'::text;
  raise exception 'REPORT>> %', array_to_string(cases, ' || ');
end $test$;
