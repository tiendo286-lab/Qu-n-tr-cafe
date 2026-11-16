-- Chỉ chạy cùng migration 99 trong giao dịch tự hoàn tác (begin; <99>; <tệp này>; rollback;). Không giữ dữ liệu kiểm thử.
DO $test$
declare uid uuid; acc bigint; br bigint; rid bigint; did bigint; t0 bigint; t1 bigint; bad boolean; cases text[] := '{}';
        d text := to_char(public.vn_now()::date, 'YYYY-MM-DD');
begin
  select id, auth_user_id into acc, uid from public.accounts where system_role = 'chu' and locked = 0 and auth_user_id is not null limit 1;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  insert into public.branches(code, name, sort_order) values ('TEST99_' || substr(gen_random_uuid()::text, 1, 8), 'Cơ sở kiểm thử', 999) returning id into br;
  insert into public.shift_reports(branch_id, work_date, shift, status, created_by) values (br, d, 'Sáng', 'hoan_thanh', acc) returning id into rid;
  update public.shift_reports set opening_cash = 1000000, ipos_opening = 1000000, total_revenue = 500000, pos_cash = 500000, pos_transfer = 0,
         cash_counted = 1300000, reported_transfer = 0 where id = rid;
  t0 := (public.app__ca_money(rid) ->> 'tm_left')::bigint;

  bad := false; begin perform public.app_ca_recon_debt_set(rid, null, 'muon', 'Chị Hoa', 200000, null, ''); exception when others then bad := position('lý do' in sqlerrm) > 0; end;
  if not bad then raise exception 'FAIL không lý do vẫn ghi'; end if;
  cases := cases || 'Chặn khi chưa ghi lý do'::text;

  did := public.app_ca_recon_debt_set(rid, null, 'muon', 'Chị Hoa', 200000, null, 'NV ghi nhầm thành chi', 'Chi TM 200.000 "đưa chị Hoa mượn"');
  t1 := (public.app__ca_money(rid) ->> 'tm_left')::bigint;
  if (select count(*) from public.shift_debts where id = did and report_id = rid and kind = 'muon' and amount = 200000) <> 1 then raise exception 'FAIL thêm báo nợ'; end if;
  if t0 is not null and t1 - t0 <> 200000 then raise exception 'FAIL tiền mặt phải có không giảm 200.000 (% → %)', t0, t1; end if;
  cases := cases || ('Thêm Báo nợ TM 200.000 → tiền mặt phải có giảm 200.000 (lệch ' || coalesce(t0::text, '?') || ' → ' || coalesce(t1::text, '?') || ')');

  perform public.app_ca_recon_debt_set(rid, did, 'ck', 'Chị Hoa B7', 150000, '0912', 'Sửa số tiền');
  if (select count(*) from public.shift_debts where id = did and kind = 'ck' and amount = 150000 and table_name = 'Chị Hoa B7' and note = '0912') <> 1 then raise exception 'FAIL sửa báo nợ'; end if;
  cases := cases || 'Sửa loại / số tiền / tên / ghi chú'::text;

  update public.shift_debts set closed_at = public.vn_now_text() where id = did;
  bad := false; begin perform public.app_ca_recon_debt_remove(rid, did, 'xoá thử'); exception when others then bad := position('đã thu' in sqlerrm) > 0; end;
  if not bad then raise exception 'FAIL xoá khoản đã thu'; end if;
  update public.shift_debts set closed_at = null where id = did;
  cases := cases || 'Chặn xoá khoản đã thu'::text;

  perform public.app_ca_recon_debt_remove(rid, did, 'Ghi trùng');
  if exists (select 1 from public.shift_debts where id = did) then raise exception 'FAIL xoá'; end if;
  if (select count(*) from public.shift_recon_log where report_id = rid and action in ('bao_no_them', 'bao_no_sua', 'bao_no_xoa')) <> 3 then raise exception 'FAIL lịch sử'; end if;
  if (select before #>> '{}' from public.shift_recon_log where report_id = rid and action = 'bao_no_them') <> 'Chi TM 200.000 "đưa chị Hoa mượn"' then raise exception 'FAIL ghi nhân viên ghi gì'; end if;
  cases := cases || 'Xoá + lịch sử 3 dòng (thêm / sửa / xoá) có "nhân viên ghi"'::text;

  update public.shift_reports set recon_status = 'hoan_thanh' where id = rid;
  bad := false; begin perform public.app_ca_recon_debt_set(rid, null, 'muon', 'X', 1000, null, 'thử'); exception when others then bad := position('Sửa phần tiền' in sqlerrm) > 0; end;
  if not bad then raise exception 'FAIL ca đã đối soát vẫn sửa'; end if;
  cases := cases || 'Ca đã hoàn thành đối soát thì chặn'::text;

  raise exception 'REPORT>> %', array_to_string(cases, ' | ');
end $test$;
