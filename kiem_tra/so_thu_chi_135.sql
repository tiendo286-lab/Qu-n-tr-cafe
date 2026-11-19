-- Bài thử máy chủ cho supabase/135_doi_soat_fabi_chot_ca.sql (Chốt ca vĩnh viễn + Khoản treo — vùng khoá).
-- Gửi CÙNG LẦN, sau nội dung tệp 135 (chạy 135 hai lần để thử chạy lại). REPORT>> tự hoàn tác, không đổi dữ liệu thật.
-- Ca thật LHP: 305 (17/11 Chiều, đã xác nhận Fabi, dư TM), 373 (18/11 Sáng, chưa xác nhận), 209 (15/11 Sáng, không lệch),
-- 258 (16/11 Sáng, CK chờ tiền về), 205 (14/11 Tối, CK dư) — 258 / 205 thử xác nhận Fabi trong lúc chạy, không được thì báo.
-- (g)–(p): các lỗi người duyệt mã tìm ra 19/11 (tải lại Fabi, trả nợ một phần, huỷ Đã về, trừ quá phần treo, quán chịu không phải Chủ,
--   lối riêng chỉ trong giao dịch, gán nợ / tiền về muộn trên ca đã chốt, bản đối soát, dấu duyệt việc, gán lương, Công việc).
create or replace function pg_temp.cat_all(p_rid bigint) returns int language plpgsql as $f$
declare n int := 0; x jsonb; mk text;
begin
  for x in select i from jsonb_array_elements(public.app_stc_month((select branch_id from public.shift_reports where id = p_rid),
             (select left(work_date, 7) from public.shift_reports where id = p_rid)) -> 'items') i
           where (i ->> 'ca_id')::bigint = p_rid and i ->> 'book' = 'chi' and i ->> 'col' = 'chi' and coalesce(i ->> 'cat', '') = '' loop
    mk := split_part(x ->> 'id', ':', 3);
    insert into public.fin_move_cats(report_id, mkey, category_id) values (p_rid, mk, (select id from public.fin_categories order by id limit 1))
      on conflict (report_id, mkey) do update set category_id = excluded.category_id;
    n := n + 1;
  end loop;
  return n;
end $f$;

do $$
declare chu public.accounts; nv public.accounts; rep text := ''; j jsonb; v bigint; v2 bigint; t1 bigint; t2 bigint; ok boolean;
  dd public.shift_debts; sid bigint; fid bigint; mk text; did bigint; ma text; y bigint;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select * into nv from public.accounts where system_role = 'nv' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);

  -- (a) chưa xác nhận Fabi → chặn
  begin perform public.app_stc_ca_final(373); rep := rep || E'\n(a) KHÔNG chặn ca chưa xác nhận Fabi!';
  exception when others then rep := rep || E'\n(a) ca chưa xác nhận: ' || sqlerrm; end;

  -- (b) chốt 305: lần đầu (có thể còn chi chưa phân loại) → phân loại → chốt
  begin j := public.app_stc_ca_final(305); rep := rep || E'\n(b) chốt 305 ngay: ' || j::text;
  exception when others then
    rep := rep || E'\n(b) chốt 305 lần 1: ' || sqlerrm || ' → phân loại ' || pg_temp.cat_all(305) || ' khoản';
    j := public.app_stc_ca_final(305); rep := rep || ' → chốt: ' || j::text;
  end;
  rep := rep || ' · finals=' || (select count(*) from public.stc_ca_finals where report_id = 305);
  begin perform public.app_stc_ca_final(305); rep := rep || ' · KHÔNG chặn chốt lần 2!';
  exception when others then rep := rep || ' · chốt lần 2: ' || sqlerrm; end;

  -- (c) sau chốt: bảng tiền bị chặn, bảng hệ thống bỏ qua lặng lẽ
  begin update public.shift_report_results set reason = coalesce(reason, '') || 'x' where report_id = 305; rep := rep || E'\n(c) KHÔNG chặn sửa kết quả!';
  exception when others then rep := rep || E'\n(c) sửa kết quả: ' || sqlerrm; end;
  begin update public.shift_report_moves set amount = amount - 1000 where report_id = 305; rep := rep || ' · sửa khoản phiếu: ' || case when found then 'KHÔNG chặn!' else 'không có khoản' end;
  exception when others then rep := rep || ' · sửa khoản phiếu: chặn'; end;
  begin perform public.app_stc_ds_reopen(305, 'thử mở lại'); rep := rep || ' · KHÔNG chặn Mở lại xác nhận!';
  exception when others then rep := rep || ' · mở lại xác nhận: ' || sqlerrm; end;
  begin perform public.app_stc_ds_fabi(305, 'dt', null, 'thử'); rep := rep || ' · KHÔNG chặn Lấy số máy Fabi!';
  exception when others then rep := rep || ' · lấy số Fabi: ' || sqlerrm; end;
  begin perform public.app_stc_move_save(305, null, jsonb_build_object('kind', 'tien_mat', 'amount', -1000, 'note', 'thử thêm'), 'thử'); rep := rep || ' · KHÔNG chặn thêm phiếu vào ca!';
  exception when others then rep := rep || ' · thêm phiếu vào ca: ' || sqlerrm; end;
  begin update public.shift_report_recon set updated_at = updated_at where report_id = 305; rep := rep || ' · KHÔNG chặn sửa bản đối soát!';
  exception when others then rep := rep || ' · sửa bản đối soát: chặn'; end;
  begin perform public.app_ca_recon(305); rep := rep || ' · mở trang Đối soát ca cũ: được';
  exception when others then rep := rep || ' · mở trang Đối soát ca cũ: ' || sqlerrm; end;
  begin update public.shift_reports set pos_cash = pos_cash + 12345 where id = 305; rep := rep || E'\n    KHÔNG chặn sửa cột tiền phiếu!';
  exception when others then rep := rep || E'\n    cột tiền phiếu: ' || sqlerrm; end;
  update public.shift_reports set recon_status = recon_status where id = 305;
  rep := rep || ' · trạng thái đối soát việc: sửa được';
  update public.shift_reports set updated_at = 'thu-135' where id = 305;
  rep := rep || ' · cột khác: ' || case when (select updated_at from public.shift_reports where id = 305) = 'thu-135' then 'sửa được' else 'BỊ CHẶN!' end;
  v := (select net from public.fabi_shifts where report_id = 305 limit 1);
  update public.fabi_shifts set net = net + 1 where report_id = 305;
  rep := rep || ' · file Fabi: ' || case when (select net from public.fabi_shifts where report_id = 305 limit 1) is not distinct from v then 'giữ nguyên' else 'BỊ ĐỔI!' end;
  begin perform public.app__fabi_apply_report(305); rep := rep || ' · kế toán áp lại Fabi: không lỗi';
  exception when others then rep := rep || ' · kế toán áp lại Fabi LỖI: ' || sqlerrm; end;
  begin j := public.app_stc_month(1, '2026-11'); rep := rep || ' · sổ tháng: đọc được';
  exception when others then rep := rep || ' · sổ tháng LỖI: ' || sqlerrm; end;
  j := public.app_stc_finals(1, '2026-11');
  rep := rep || E'\n    app_stc_finals: chốt ' || jsonb_array_length(j -> 'finals') || ' · treo ' || coalesce((select string_agg(t ->> 'kind' || ' ' || (t ->> 'pm') || ' ' || (t ->> 'left') || ' còn ' || (t ->> 'days_left') || ' ngày', ', ') from jsonb_array_elements(j -> 'treo') t), 'không');

  -- (d) khoản treo tiền thừa của 305: ca nhận không có tiền thiếu → chặn; ca nhận đã chốt → chặn
  t1 := (select id from public.stc_treo where report_id = 305 order by id limit 1);
  if t1 is not null then
    begin perform public.app_stc_treo_use(t1, 209, 1000, 'thử'); rep := rep || E'\n(d) KHÔNG chặn ghép vào ca không thiếu!';
    exception when others then rep := rep || E'\n(d) ghép vào ca không thiếu: ' || sqlerrm; end;
    begin perform public.app_stc_treo_close(t1, 'qc', null, 'thử'); rep := rep || ' · KHÔNG chặn quán chịu tiền thừa!';
    exception when others then rep := rep || ' · quán chịu tiền thừa: ' || sqlerrm; end;
  else rep := rep || E'\n(d) 305 không có khoản treo'; end if;

  -- (e) chờ tiền về: thử lần lượt các ca CK thiếu (xác nhận + chốt → treo) và ca CK dư (xác nhận → Đã về một phần)
  t2 := null;
  foreach v in array array[144, 143, 54, 341, 258] loop
    begin
      if not coalesce((public.app__stc_ds_state(v) ->> 'done')::boolean, false) then perform public.app_stc_ds_close(v); end if;
      perform pg_temp.cat_all(v);
      j := public.app_stc_ca_final(v);
      t2 := (select id from public.stc_treo where report_id = v and kind = 'tien' order by id limit 1);
      rep := rep || E'\n(e) chốt ' || v || ': ' || j::text; exit;
    exception when others then rep := rep || E'\n(e) ca ' || v || ' không dùng được: ' || left(sqlerrm, 70); end;
  end loop;
  if t2 is not null then
    v := (select report_id from public.stc_treo where id = t2);
    foreach v2 in array array[146, 145, 148, 216, 222] loop
      begin
        if not coalesce((public.app__stc_ds_state(v2) ->> 'done')::boolean, false) then perform public.app_stc_ds_close(v2); end if;
        t1 := least(public.app__stc_gap_avail(v2, 'chuyen_khoan', 'du'), public.app__stc_treo_left(t2));
        perform public.app_stc_treo_use(t2, v2, t1, 'thử tiền về');
        rep := rep || E'\n    Đã về ' || t1 || ' ở ca ' || v2 || ' → treo còn ' || public.app__stc_treo_left(t2) || ' · ca nhận còn dư ' || public.app__stc_gap_avail(v2, 'chuyen_khoan', 'du')
               || ' · ca gốc còn ' || public.app__stc_gap_avail(v, 'chuyen_khoan', 'thieu') || ' (không đổi)';
        begin perform public.app_stc_treo_use(t2, v2, 1000, 'lần 2'); rep := rep || ' · KHÔNG chặn vượt phần dư!';
        exception when others then rep := rep || ' · lần 2: ' || sqlerrm; end;
        exit;
      exception when others then rep := rep || E'\n    ca nhận ' || v2 || ' không dùng được: ' || left(sqlerrm, 70); end;
    end loop;
    -- (i) huỷ "Đã về" → khoản treo mở lại đủ tiền
    did := (select id from public.gap_decisions where treo_id = t2 order by id desc limit 1);
    if did is not null then
      perform public.app_stc_gap_undo('decision', did, 'thử huỷ đã về');
      rep := rep || E'\n(i) huỷ Đã về → treo ' || (select status from public.stc_treo where id = t2) || ' còn ' || public.app__stc_treo_left(t2) || ' / ' || (select amount from public.stc_treo where id = t2);
    end if;
    -- (j) trừ tiền khác phần còn treo → chặn
    begin perform public.app_stc_treo_close(t2, 'tru', jsonb_build_array(jsonb_build_object('employee_id', (select id from public.employees order by id limit 1), 'amount', public.app__stc_treo_left(t2) + 1000)), 'thử');
      rep := rep || E'\n(j) KHÔNG chặn trừ quá phần treo!';
    exception when others then rep := rep || E'\n(j) trừ quá phần treo: ' || sqlerrm; end;
    -- (k) không phải Chủ quán chịu khoản treo → chặn
    perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
    begin perform public.app_stc_treo_close(t2, 'qc', null, 'thử'); rep := rep || E'\n(k) KHÔNG chặn nhân viên quán chịu khoản treo!';
    exception when others then rep := rep || E'\n(k) không phải Chủ quán chịu khoản treo: ' || sqlerrm; end;
    perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
    -- (l) Chủ quán chịu → đóng; sau đó ghi quyết định lên ca gốc (không trong giao dịch đóng) → chặn
    begin perform public.app_stc_treo_close(t2, 'qc', null, 'thử');
      rep := rep || E'\n(l) Chủ quán chịu: được (ca gốc ' || (select work_date from public.shift_reports where id = v) || ') → treo ' || (select status || ' · ' || coalesce(done_note, '') from public.stc_treo where id = t2)
             || ' · lối riêng sau giao dịch: ' || coalesce(nullif(current_setting('app.stc_treo', true), ''), 'đã đóng');
    exception when others then rep := rep || E'\n(l) Chủ quán chịu LỖI: ' || sqlerrm; end;
    begin insert into public.gap_decisions(report_id, item, kind, amount, reason, created_by) values (v, 'chuyen_khoan', 'quan_chiu', 1000, 'thử không lối riêng', chu.id);
      rep := rep || ' · KHÔNG chặn ghi thêm lên ca gốc!';
    exception when others then rep := rep || ' · ghi thêm lên ca gốc: chặn'; end;
  end if;

  -- (g) tải lại file Fabi: hàm app__fabi_apply (đường tải file thật, không có ngữ cảnh) với ca đã chốt
  ma := (select ma_ca from public.fabi_shifts where report_id = 305 limit 1);
  if ma is not null then
    begin j := public.app__fabi_apply(ma); rep := rep || E'\n(g) tải lại Fabi ca đã chốt: ' || (j ->> 'status');
    exception when others then rep := rep || E'\n(g) tải lại Fabi LỖI: ' || sqlerrm; end;
  end if;
  -- (h) khách trả một phần nợ của ca đã chốt (tách / gộp như hàm thu nợ), sửa tên khách được; thêm nợ mới / giảm nợ không tách → chặn
  select * into dd from public.shift_debts d where d.closed_at is null and d.split_from is null and d.report_id is not null and d.amount > 2000
     and not exists (select 1 from public.shift_debts z where z.split_from = d.id) order by d.id desc limit 1;
  if dd.id is not null then
    insert into public.stc_ca_finals(report_id, by_account) values (dd.report_id, chu.id) on conflict do nothing;
    y := (select r.id from public.shift_reports r where r.branch_id = dd.branch_id and r.status = 'hoan_thanh' and r.id <> dd.report_id
            and not public.app__stc_final(r.id) and coalesce((public.app__ca_kt_state(r.id) ->> 'ready')::boolean, false) order by r.work_date desc limit 1);
    begin
      insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, split_from)
      values (dd.branch_id, dd.report_id, dd.table_name, dd.amount - 1000, dd.note, dd.phone, dd.created_by, dd.created_at, dd.kind, dd.id) returning id into sid;
      update public.shift_debts set amount = 1000 where id = dd.id;
      update public.shift_debts set closed_at = public.vn_now_text(), closed_report_id = y, collect_kind = 'tien_mat' where id = dd.id;
      update public.shift_debts set table_name = coalesce(table_name, '') || ' (sửa tên)' where id = sid;
      rep := rep || E'\n(h) trả một phần nợ ca đã chốt: được · tổng nợ ca giữ ' || (select sum(amount) from public.shift_debts where report_id = dd.report_id and id in (dd.id, sid)) || ' = ' || dd.amount;
      update public.shift_debts set closed_at = null, closed_report_id = null, collect_kind = null where id = dd.id;
      update public.shift_debts set amount = dd.amount where id = dd.id;
      delete from public.shift_debts where id = sid;
      rep := rep || ' · huỷ thu (gộp lại): được';
    exception when others then rep := rep || E'\n(h) trả một phần nợ LỖI: ' || sqlerrm; end;
    begin update public.shift_debts set amount = amount - 500 where id = dd.id; rep := rep || ' · KHÔNG chặn giảm nợ không tách!';
    exception when others then rep := rep || ' · giảm nợ không tách: ' || sqlerrm; end;
    begin insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind) values (dd.branch_id, dd.report_id, 'thử', 1000, chu.id, dd.kind);
      rep := rep || ' · KHÔNG chặn thêm nợ mới!';
    exception when others then rep := rep || ' · thêm nợ mới: ' || sqlerrm; end;
  else rep := rep || E'\n(h) không có khoản nợ mở để thử'; end if;
  -- (p) gán nợ / tiền về muộn trên ca đã chốt → chặn
  begin perform public.app_stc_gap_debt(305, 'tien_mat', (select id from public.shift_debts where closed_at is null order by id limit 1), 1000, 'thử');
    rep := rep || E'\n(p) KHÔNG chặn gán nợ vào ca đã chốt!';
  exception when others then rep := rep || E'\n(p) gán nợ vào ca đã chốt: ' || sqlerrm; end;
  begin insert into public.bank_late_receipts(account_id, origin_report_id, arrived_report_id, amount, created_by)
    values ((select id from public.bank_accounts order by id limit 1), 305, 209, 1000, chu.id);
    rep := rep || ' · KHÔNG chặn tiền về muộn!';
  exception when others then rep := rep || ' · tiền về muộn: ' || sqlerrm; end;
  -- (m) bản đối soát mới: ảnh chụp số hiện tại → được; số khác → chặn (ca đã chốt chưa có bản đối soát)
  fid := (select r.id from public.shift_reports r where r.status = 'hoan_thanh' and not exists (select 1 from public.shift_report_recon x where x.report_id = r.id)
             and coalesce((public.app__ca_kt_state(r.id) ->> 'ready')::boolean, false) order by r.work_date desc limit 1);
  if fid is not null then
    insert into public.stc_ca_finals(report_id, by_account) values (fid, chu.id) on conflict do nothing;
    begin insert into public.shift_report_recon(report_id, data, updated_by) values (fid, jsonb_build_object('cash_counted', 1), chu.id); rep := rep || E'\n(m) KHÔNG chặn bản đối soát số khác!';
    exception when others then rep := rep || E'\n(m) bản đối soát số khác: chặn'; end;
    begin insert into public.shift_report_recon(report_id, data, updated_by) values (fid, public.app__recon_snapshot(fid), chu.id); rep := rep || ' · ảnh chụp số hiện tại: được';
    exception when others then rep := rep || ' · ảnh chụp số hiện tại LỖI: ' || sqlerrm; end;
    -- (n) dấu duyệt việc không phải tiền: được; mục tiền: bỏ qua
    begin delete from public.shift_report_checks where report_id = fid and item = 'ban_giao';
      insert into public.shift_report_checks(report_id, item, checked_by, checked_at) values (fid, 'ban_giao', chu.id, public.vn_now_text());
      rep := rep || E'\n(n) dấu duyệt Bàn giao: ' || case when exists (select 1 from public.shift_report_checks where report_id = fid and item = 'ban_giao') then 'ghi được' else 'BỊ BỎ!' end;
    exception when others then rep := rep || E'\n(n) dấu duyệt Bàn giao LỖI: ' || sqlerrm; end;
  end if;
  -- (o) gán lương tiền mặt cho nhân viên trên ca đã chốt
  mk := (select mkey from public.fin_move_cats where report_id = 305 order by mkey limit 1);
  if mk is not null then
    begin perform public.app_tc_move_emp(305, mk, null); rep := rep || E'\n(o) gán lương cho nhân viên: được';
    exception when others then rep := rep || E'\n(o) gán lương LỖI: ' || sqlerrm; end;
    begin update public.fin_move_cats set category_id = (select c.id from public.fin_categories c where c.id is distinct from fin_move_cats.category_id order by c.id desc limit 1)
      where report_id = 305 and mkey = mk; rep := rep || ' · KHÔNG chặn đổi phân loại!';
    exception when others then rep := rep || ' · đổi phân loại: chặn'; end;
  end if;
  -- (q) Công việc không nhắc lệch của ca đã chốt; (s) tiền thừa tháng này chưa ghi Thu khác được
  rep := rep || E'\n(q) Công việc nhắc lệch ca đã chốt: ' || (select count(*) from public.app__pc_sources() x where x.job = 7 and exists (select 1 from public.stc_ca_finals f where x.key like 'gap:' || f.report_id || ':%'));
  t1 := (select id from public.stc_treo where report_id = 305 and kind = 'thua' order by id limit 1);
  if t1 is not null then
    begin perform public.app_stc_treo_close(t1, 'thu', null, 'thử'); rep := rep || ' · KHÔNG chặn Thu khác trong tháng!';
    exception when others then rep := rep || E'\n(s) Thu khác trong tháng: ' || sqlerrm; end;
  end if;

  -- (f) nhân viên không chốt được
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_stc_ca_final(209); rep := rep || E'\n(f) KHÔNG chặn nhân viên!';
  exception when others then rep := rep || E'\n(f) nhân viên: ' || sqlerrm; end;
  raise exception 'REPORT>> %', rep;
end $$;
