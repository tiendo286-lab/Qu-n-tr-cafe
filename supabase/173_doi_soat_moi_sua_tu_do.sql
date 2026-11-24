-- Tệp 173 — Trang đối soát ca mới, đợt 2 + 3 (anh Tiến giao 24/11/2026: "làm toàn bộ để thao tác toàn bộ rồi chỉnh ở đâu chúng ta chỉnh tiếp").
-- Thiết kế: tai_lieu/superpowers/specs/2026-11-24-trang-doi-soat-ca-moi-design.md (5.4, 5.5) · Kế hoạch: tai_lieu/superpowers/plans/2026-11-24-trang-doi-soat-ca-moi-dot-2-3.md
-- VÙNG KHOÁ tiền đối soát (đã báo anh Tiến trong chat 24/11 trước khi sửa).
--
-- LUẬT MỚI cho trang đối soát ca mới (#/ca/doi-soat-moi) bằng CỜ GIAO DỊCH app.ds_moi (kiểu cờ app.stc_treo đang có):
--   * chỉ các hàm app_ds2_* đặt cờ, bằng set_config(..., true) → hết khi hết giao dịch (web gọi mỗi lệnh một giao dịch, không tự đặt được cờ);
--   * có cờ: sửa tự do tới khi Hoàn thành — không còn "Mở lại chốt" mới sửa được số Fabi / tiền mặt / ca chịu lệch / số sửa,
--     không cần "đã Xác nhận Fabi" mới sửa thu chi / luân chuyển / khách trả nợ cũ; vẫn chặn khi ca đã Hoàn thành, tháng đã chốt,
--     sai quyền, phiếu chờ kế toán (luật 17/11, chốt chặn ở cơ sở dữ liệu không đổi);
--   * sửa số Fabi / tiền mặt / ca chịu lệch / số sửa / khách trả nợ cũ khi ca ĐÃ xử lý chênh lệch (phiếu chênh lệch, trừ lương, ghép ca) → chặn,
--     phải Huỷ xử lý trước (giữ tiền đúng — trang cũ chặn hẳn những việc này sau khi đã xác nhận);
--   * KHÔNG cờ (trang cũ, Sổ thu chi): y như trước.
-- Hàm mới: app_ds2_confirm (xác nhận số trước khi xử lý lệch), app_ds2_work_ok (Duyệt phần việc), app_ds2_finish (Hoàn thành gộp — một giao dịch),
--   app_ds2_reopen (Mở lại: bỏ Hoàn thành + mục tiền, giữ duyệt phần việc), và các hàm bọc app_ds2_<tên cũ> (đặt cờ rồi gọi đúng hàm cũ).
-- Chạy lại nhiều lần không sao (create or replace).

create or replace function public.app__ds_moi() returns boolean
language sql stable set search_path = public as $f$
  select coalesce(current_setting('app.ds_moi', true), '') = '1'
$f$;

-- Ca đã xử lý chênh lệch (phiếu chênh lệch / trừ lương / ghép ca) → không cho sửa số làm đổi tiền của ca (phải Huỷ xử lý trước)
create or replace function public.app__ds2_no_gap(p_report bigint) returns void
language plpgsql stable security definer set search_path = public as $f$
begin
  if exists (select 1 from public.shift_shortfalls s where s.report_id = p_report and s.item in ('tien_mat', 'chuyen_khoan') and s.status <> 'huy')
     or exists (select 1 from public.gap_decisions g where g.report_id = p_report)
     or exists (select 1 from public.gap_matches m where (m.short_report = p_report or m.over_report = p_report) and m.status in ('da_duyet', 'cho_duyet')) then
    raise exception 'Ca đã xử lý chênh lệch (phiếu chênh lệch / trừ lương / ghép ca) — bấm Huỷ ở dòng Chênh lệch trước khi sửa số này.';
  end if;
end $f$;

-- chốt chặn số Fabi / tiền mặt / ca chịu lệch / số sửa: có cờ thì chỉ chặn khi ca đã Hoàn thành
CREATE OR REPLACE FUNCTION public.app__stc_ds_need(p_report bigint, p_open boolean)
 RETURNS shift_reports
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app_account(); r public.shift_reports;
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy ca.'; end if;
  if r.status <> 'hoan_thanh' then raise exception 'Nhân viên chưa gửi phiếu ca này.'; end if;
  if a.id is null or coalesce(a.locked, 0) = 1 or not coalesce(public.app__ca_auto_ok(a, r.branch_id), false) then
    raise exception 'Chỉ Chủ, Quản lý tổng hoặc quản lý đối soát của cơ sở này đối soát tiền được.';
  end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT.'; end if;
  if p_open and public.app__ds_moi() then   -- tệp 173: luật mới (trang đối soát ca mới) — sửa tự do tới khi Hoàn thành
    if exists (select 1 from public.stc_ca_done where report_id = p_report) then raise exception 'Ca đã hoàn thành đối soát — bấm Mở lại trước.'; end if;
  elsif p_open and coalesce((public.app__stc_ds_state(p_report) ->> 'done')::boolean, false) then
    raise exception 'Ca đã chốt tiền — bấm "Mở lại chốt" trước khi sửa.';
  end if;
  return r;
end $function$;

-- thêm / sửa / xoá thu chi của ca: có cờ thì không cần đã xác nhận Fabi
CREATE OR REPLACE FUNCTION public.app_stc_move_save(p_report bigint, p_mkey text, p jsonb, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; m record; d jsonb; mv jsonb; nmv jsonb; n int; rs text := public.app__stc_reason(p_reason);
        k text; amt bigint; pm text; ord_v bigint; pay_v text; amt_v bigint; note_v text; nt text; cat bigint; oldcat bigint; signed bigint; newmk text; act text; snap_old jsonb; snap_new jsonb;
begin
  select * into r from public.shift_reports where id = p_report for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__stc_need(r.branch_id);
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không sửa được.'; end if;
  if not public.app__ds_moi()   -- tệp 173: luật mới — không cần đã xác nhận Fabi (ca đã Hoàn thành: trigger stc_recon_tick chặn)
     and not (exists (select 1 from public.shift_report_results s where s.report_id = p_report and s.item = 'tien_mat')
          and exists (select 1 from public.shift_report_results s where s.report_id = p_report and s.item = 'chuyen_khoan')) then
    raise exception 'Ca chưa chốt tiền — chốt ở tab Đối soát tiền trước.';
  end if;
  insert into public.shift_report_recon(report_id, data, updated_by) values (p_report, public.app__recon_snapshot(p_report), a.id) on conflict (report_id) do nothing;
  select data into d from public.shift_report_recon where report_id = p_report for update;
  n := jsonb_array_length(coalesce(d -> 'moves', '[]'));
  if p_mkey is not null then
    select * into m from public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) t where t.report_id = p_report and t.mkey = p_mkey;
    if m.report_id is null then raise exception 'Khoản này vừa thay đổi. Tải lại trang rồi sửa lại.'; end if;
    if m.auto is not null or m.ord > n then raise exception 'Khoản tự động (chi lương / khách mượn / đổi tiền) — sửa ở phiếu ca.'; end if;
    if public.app__tc_move_ka(p_report, p_mkey) then raise exception 'Khoản này đã gán âm tiền trừ lương — bỏ gán trước khi sửa.'; end if;
    if exists (select 1 from public.branch_loans l where l.report_id = p_report and l.mkey = p_mkey)
       or exists (select 1 from public.shift_debts x where x.mv_report = p_report and x.mv_key = p_mkey) then
      raise exception 'Khoản này đã thành nợ / cho vay — sửa ở Công nợ.';
    end if;
    ord_v := m.ord; pay_v := m.pay; amt_v := m.amount; note_v := m.note;
    mv := d -> 'moves' -> (m.ord - 1)::int;
    if mv ->> 'kind' is distinct from m.pay or (mv ->> 'amount')::bigint is distinct from m.amount then raise exception 'Khoản này vừa thay đổi. Tải lại trang rồi sửa lại.'; end if;
    select fc.category_id into oldcat from public.fin_move_cats fc where fc.report_id = p_report and fc.mkey = p_mkey;
    snap_old := jsonb_build_object('date', r.work_date, 'ca_id', r.id, 'book', case when m.amount < 0 then 'chi' else 'thu' end,
      'pm', case when m.pay = 'chuyen_khoan' then 'ck' else 'tm' end, 'col', case when m.amount < 0 then 'chi' else 'khac' end,
      'amount', abs(m.amount), 'title', m.note, 'cat', (select c.name from public.fin_categories c where c.id = oldcat));
  end if;

  if coalesce((p ->> 'delete')::boolean, false) then
    if p_mkey is null then raise exception 'Chưa chọn khoản.'; end if;
    d := jsonb_set(d, '{moves}', (d -> 'moves') - (ord_v - 1)::int);
    act := 'xoa'; nmv := null;
  else
    k := coalesce(nullif(p ->> 'kind', ''), pay_v, 'tien_mat');
    amt := coalesce(nullif(p ->> 'amount', '')::bigint, amt_v);
    nt := trim(coalesce(nullif(p ->> 'note', ''), note_v, ''));
    if k not in ('tien_mat', 'chuyen_khoan') then raise exception 'Chọn tiền mặt hay chuyển khoản.'; end if;
    if amt is null or amt = 0 then raise exception 'Nhập số tiền khác 0 (âm là khoản chi).'; end if;
    if nt = '' then raise exception 'Ghi nội dung khoản.'; end if;
    cat := coalesce(nullif(p ->> 'category_id', '')::bigint, oldcat);
    if cat is not null and not exists (select 1 from public.fin_categories c where c.id = cat and c.kind = case when amt < 0 then 'chi' else 'thu' end) then
      raise exception 'Nhóm không đúng loại Thu / Chi.';
    end if;
    if p_mkey is null then
      nmv := jsonb_build_object('kind', k, 'amount', amt, 'note', nt);
      d := jsonb_set(d, '{moves}', coalesce(d -> 'moves', '[]'::jsonb) || jsonb_build_array(nmv)); act := 'them';
    else
      nmv := mv || jsonb_build_object('kind', k, 'amount', amt, 'note', nt);
      d := jsonb_set(d, array['moves', (ord_v - 1)::text], nmv); act := 'sua';
    end if;
  end if;
  update public.shift_report_recon set data = d, updated_by = a.id, updated_at = public.vn_now_text() where report_id = p_report;
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
  values (p_report, act, 'moves', mv, nmv, 'Sổ thu chi: ' || rs, a.id);
  if p_mkey is not null then delete from public.fin_move_cats where report_id = p_report and mkey = p_mkey; end if;
  if act <> 'xoa' then
    select t.mkey into newmk from public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) t
     where t.report_id = p_report and t.ord = case when act = 'them' then n + 1 else ord_v end;
    insert into public.fin_move_cats(report_id, mkey, category_id, excluded, by_account, at, checked, checked_by, checked_at)
    values (p_report, newmk, cat, case when cat is null and amt > 0 then 1 else 0 end, a.id, public.vn_now_text(), case when cat is not null then 1 else 0 end,
            case when cat is not null then a.id end, case when cat is not null then public.vn_now_text() end)
    on conflict do nothing;
    snap_new := jsonb_build_object('date', r.work_date, 'ca_id', r.id, 'book', case when amt < 0 then 'chi' else 'thu' end,
      'pm', case when k = 'chuyen_khoan' then 'ck' else 'tm' end, 'col', case when amt < 0 then 'chi' else 'khac' end,
      'amount', abs(amt), 'title', nt, 'cat', (select c.name from public.fin_categories c where c.id = cat));
  end if;
  perform public.app__stc_log(r.branch_id, 'move', 'm:' || p_report || ':' || coalesce(newmk, p_mkey), act, snap_old, snap_new, rs);
  return newmk;
end $function$;

-- app_stc_move_exchange: có cờ thì không cần đã xác nhận Fabi
CREATE OR REPLACE FUNCTION public.app_stc_move_exchange(p_report bigint, p_mkey text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; m record; d jsonb; mv jsonb; n int; rs text := public.app__stc_reason(p_reason);
        k text := gen_random_uuid()::text; other text; nmv jsonb; snap_old jsonb;
begin
  select * into r from public.shift_reports where id = p_report for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__stc_need(r.branch_id);
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không sửa được.'; end if;
  if not public.app__ds_moi()   -- tệp 173: luật mới — không cần đã xác nhận Fabi (ca đã Hoàn thành vẫn chặn ở dưới)
     and not (exists (select 1 from public.shift_report_results s where s.report_id = p_report and s.item = 'tien_mat')
          and exists (select 1 from public.shift_report_results s where s.report_id = p_report and s.item = 'chuyen_khoan')) then
    raise exception 'Ca chưa xác nhận Fabi — xác nhận ở trang đối soát của ca (tab ② Phần tiền) trước rồi mới đổi khoản.';
  end if;
  if exists (select 1 from public.stc_ca_done dn where dn.report_id = p_report) then
    raise exception 'Ca đã hoàn thành đối soát — Mở lại ở tab ③ Hoàn thành của trang đối soát ca mới đổi được.';
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
end $function$;

-- app_stc_move_exchange_delete: có cờ thì không cần đã xác nhận Fabi
CREATE OR REPLACE FUNCTION public.app_stc_move_exchange_delete(p_report bigint, p_mkey text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; m record; x record; y record; d jsonb; mv jsonb; nm jsonb; pair jsonb; n int;
        rs text := public.app__stc_reason(p_reason); k text; h text; num int;
begin
  select * into r from public.shift_reports where id = p_report for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__stc_need(r.branch_id);
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không sửa được.'; end if;
  if not public.app__ds_moi()   -- tệp 173: luật mới — không cần đã xác nhận Fabi (ca đã Hoàn thành vẫn chặn ở dưới)
     and not (exists (select 1 from public.shift_report_results s where s.report_id = p_report and s.item = 'tien_mat')
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
end $function$;

-- khách trả nợ cũ trong ca: có cờ thì mục tiền đã xác nhận vẫn ghi được
CREATE OR REPLACE FUNCTION public.app_ca_recon_debt_collect(p_report bigint, p_debt bigint, p_kind text, p_amount bigint, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; d public.shift_debts; o public.shift_reports; v_item text;
begin
  perform public.app__need('doi_soat');
  perform public.app__ca_gap_mark(p_report);
  a := public.app_account();
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  if r.status <> 'hoan_thanh' then raise exception 'Nhân viên chưa gửi phiếu này.'; end if;
  -- bước 119: ca đã hoàn thành vẫn sửa được (Sửa thẳng); app__ca_direct_guard chặn nếu làm đổi số lệch đã duyệt
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Ghi lý do (vd: khách trả nhưng nhân viên không biết).'; end if;
  if coalesce(p_kind, '') not in ('tien_mat', 'chuyen_khoan') then raise exception 'Chọn khách trả bằng tiền mặt hay chuyển khoản.'; end if;
  v_item := p_kind;
  if public.app__ds_moi() then   -- tệp 173: luật mới — mục tiền đã xác nhận vẫn ghi được; ca đã Hoàn thành / đã xử lý lệch thì chặn
    if exists (select 1 from public.stc_ca_done where report_id = p_report) then raise exception 'Ca đã hoàn thành đối soát — bấm Mở lại trước.'; end if;
    perform public.app__ds2_no_gap(p_report);
  elsif exists (select 1 from public.shift_report_results x where x.report_id = p_report and x.item = v_item)
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
  perform public.app__ca_direct_guard(p_report);
end $function$;

-- bỏ / sửa lần khách trả nợ cũ (p_report bigint, p_debt bigint, p_reason text): có cờ thì mục tiền đã xác nhận vẫn sửa được
CREATE OR REPLACE FUNCTION public.app_ca_recon_debt_uncollect(p_report bigint, p_debt bigint, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.shift_reports; d public.shift_debts; rest public.shift_debts; why text:=trim(coalesce(p_reason,''));
begin
  perform public.app__need('doi_soat');
  perform public.app__ca_gap_mark(p_report);
  select * into r from public.shift_reports where id=p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  -- bước 119: ca đã hoàn thành vẫn sửa được (Sửa thẳng); app__ca_direct_guard chặn nếu làm đổi số lệch đã duyệt
  if public.app__fin_locked(r.branch_id,r.work_date) then raise exception 'Tháng này đã CHỐT.'; end if;
  if why='' then raise exception 'Ghi lý do sửa hoặc xoá khoản khách trả.'; end if;
  select * into d from public.shift_debts where id=p_debt for update;
  if d.id is null or d.closed_report_id is distinct from p_report then raise exception 'Khoản khách trả không thuộc ca này.'; end if;
  if public.app__ds_moi() then   -- tệp 173: luật mới
    if exists (select 1 from public.stc_ca_done where report_id = p_report) then raise exception 'Ca đã hoàn thành đối soát — bấm Mở lại trước.'; end if;
    perform public.app__ds2_no_gap(p_report);
  elsif exists(select 1 from public.shift_report_results x where x.report_id=p_report and x.item=d.collect_kind)
     or exists(select 1 from public.shift_report_checks x where x.report_id=p_report and x.item=d.collect_kind) then
    raise exception 'Mục % đã đối soát — bấm Sửa ở mục đó để mở lại trước.',case when d.collect_kind='tien_mat' then 'Tiền mặt' else 'Chuyển khoản' end;
  end if;
  select * into rest from public.shift_debts where split_from=d.id and closed_at is null order by id limit 1;
  if rest.id is not null then
    update public.shift_debts set amount=d.amount+rest.amount where id=d.id;
    delete from public.shift_debts where id=rest.id;
  end if;
  update public.shift_debts set closed_at=null,closed_by=null,closed_report_id=null,collect_kind=null,close_note=null where id=p_debt;
  perform public.app_log('doi_soat_bo_thu_no','report='||p_report||' debt='||p_debt||' · '||why);
  perform public.app__ca_direct_guard(p_report);
end $function$;

-- bỏ / sửa lần khách trả nợ cũ (p_report bigint, p_debt bigint): có cờ thì mục tiền đã xác nhận vẫn sửa được
CREATE OR REPLACE FUNCTION public.app_ca_recon_debt_uncollect(p_report bigint, p_debt bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.shift_reports; d public.shift_debts; rest public.shift_debts;
begin
  perform public.app__need('doi_soat');
  perform public.app__ca_gap_mark(p_report);
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  -- bước 119: ca đã hoàn thành vẫn sửa được (Sửa thẳng); app__ca_direct_guard chặn nếu làm đổi số lệch đã duyệt
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT.'; end if;
  select * into d from public.shift_debts where id = p_debt for update;
  if d.id is null or d.closed_report_id is distinct from p_report or coalesce(d.close_note, '') not like 'Quản lý ghi khi đối soát:%' then
    raise exception 'Chỉ bỏ được khoản quản lý ghi khi đối soát ca này.';
  end if;
  if public.app__ds_moi() then   -- tệp 173: luật mới
    if exists (select 1 from public.stc_ca_done where report_id = p_report) then raise exception 'Ca đã hoàn thành đối soát — bấm Mở lại trước.'; end if;
    perform public.app__ds2_no_gap(p_report);
  elsif exists (select 1 from public.shift_report_results x where x.report_id = p_report and x.item = d.collect_kind)
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
  perform public.app__ca_direct_guard(p_report);
end $function$;

create or replace function public.app_ds2_ds_fabi(p_report bigint, p_field text, p_name text, p_reason text) returns void
language plpgsql security definer set search_path = public as $f$
begin
  perform set_config('app.ds_moi', '1', true);   -- tệp 173: luật mới của trang đối soát ca mới
  perform public.app__ds2_no_gap(p_report);
  perform public.app_stc_ds_fabi(p_report, p_field, p_name, p_reason);
end $f$;

create or replace function public.app_ds2_ds_cash(p_report bigint, p_mode text, p_counted bigint) returns void
language plpgsql security definer set search_path = public as $f$
begin
  perform set_config('app.ds_moi', '1', true);   -- tệp 173: luật mới của trang đối soát ca mới
  perform public.app__ds2_no_gap(p_report);
  perform public.app_stc_ds_cash(p_report, p_mode, p_counted);
end $f$;

create or replace function public.app_ds2_ds_blame(p_report bigint, p_who text, p_reason text) returns void
language plpgsql security definer set search_path = public as $f$
begin
  perform set_config('app.ds_moi', '1', true);   -- tệp 173: luật mới của trang đối soát ca mới
  perform public.app__ds2_no_gap(p_report);
  perform public.app_stc_ds_blame(p_report, p_who, p_reason);
end $f$;

create or replace function public.app_ds2_ds_blame_undo(p_report bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $f$
begin
  perform set_config('app.ds_moi', '1', true);   -- tệp 173: luật mới của trang đối soát ca mới
  perform public.app__ds2_no_gap(p_report);
  perform public.app_stc_ds_blame_undo(p_report, p_reason);
end $f$;

create or replace function public.app_ds2_fix_request(p_report bigint, p_field text, p jsonb, p_reason text) returns bigint
language plpgsql security definer set search_path = public as $f$
begin
  perform set_config('app.ds_moi', '1', true);   -- tệp 173: luật mới của trang đối soát ca mới
  perform public.app__ds2_no_gap(p_report);
  return public.app_stc_fix_request(p_report, p_field, p, p_reason);
end $f$;

create or replace function public.app_ds2_fix_cancel(p_req bigint) returns void
language plpgsql security definer set search_path = public as $f$
begin
  perform set_config('app.ds_moi', '1', true);   -- tệp 173: luật mới của trang đối soát ca mới
  perform public.app__ds2_no_gap((select q.report_id from public.stc_fix_requests q where q.id = p_req));
  perform public.app_stc_fix_cancel(p_req);
end $f$;

create or replace function public.app_ds2_fix_decide(p_req bigint, p_ok boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $f$
begin
  perform set_config('app.ds_moi', '1', true);   -- tệp 173: luật mới của trang đối soát ca mới
  perform public.app__ds2_no_gap((select q.report_id from public.stc_fix_requests q where q.id = p_req));
  perform public.app_stc_fix_decide(p_req, p_ok, p_note);
end $f$;

create or replace function public.app_ds2_move_save(p_report bigint, p_mkey text, p jsonb, p_reason text) returns text
language plpgsql security definer set search_path = public as $f$
begin
  perform set_config('app.ds_moi', '1', true);   -- tệp 173: luật mới của trang đối soát ca mới
  return public.app_stc_move_save(p_report, p_mkey, p, p_reason);
end $f$;

create or replace function public.app_ds2_move_exchange(p_report bigint, p_mkey text, p_reason text) returns text
language plpgsql security definer set search_path = public as $f$
begin
  perform set_config('app.ds_moi', '1', true);   -- tệp 173: luật mới của trang đối soát ca mới
  return public.app_stc_move_exchange(p_report, p_mkey, p_reason);
end $f$;

create or replace function public.app_ds2_move_exchange_delete(p_report bigint, p_mkey text, p_reason text) returns void
language plpgsql security definer set search_path = public as $f$
begin
  perform set_config('app.ds_moi', '1', true);   -- tệp 173: luật mới của trang đối soát ca mới
  perform public.app_stc_move_exchange_delete(p_report, p_mkey, p_reason);
end $f$;

create or replace function public.app_ds2_debt_collect(p_report bigint, p_debt bigint, p_kind text, p_amount bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $f$
begin
  perform set_config('app.ds_moi', '1', true);   -- tệp 173: luật mới của trang đối soát ca mới
  perform public.app_ca_recon_debt_collect(p_report, p_debt, p_kind, p_amount, p_reason);
end $f$;

create or replace function public.app_ds2_debt_uncollect(p_report bigint, p_debt bigint) returns void
language plpgsql security definer set search_path = public as $f$
begin
  perform set_config('app.ds_moi', '1', true);   -- tệp 173: luật mới của trang đối soát ca mới
  perform public.app_ca_recon_debt_uncollect(p_report, p_debt);
end $f$;

create or replace function public.app_ds2_debt_uncollect(p_report bigint, p_debt bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $f$
begin
  perform set_config('app.ds_moi', '1', true);   -- tệp 173: luật mới của trang đối soát ca mới
  perform public.app_ca_recon_debt_uncollect(p_report, p_debt, p_reason);
end $f$;

-- Xác nhận số của ca (như "Xác nhận Fabi" cũ: kiểm file Fabi, ngân hàng, ô đỏ ①, tiền mặt quản lý đếm, số sửa chờ duyệt) — trang mới tự gọi
-- khi bấm "Xử lý lệch" (lệch chỉ xử lý khi số đã chốt). Đã đủ 4 mục tiền thì chỉ kiểm quyền.
create or replace function public.app_ds2_confirm(p_report bigint) returns jsonb
language plpgsql security definer set search_path = public as $f$
begin
  perform set_config('app.ds_moi', '1', true);
  if not coalesce((public.app__stc_ds_state(p_report) ->> 'done')::boolean, false) then
    return public.app_stc_ds_close(p_report);
  end if;
  perform public.app__stc_ds_need(p_report, false);
  return '{}'::jsonb;
end $f$;

-- Duyệt phần việc: duyệt các phần web đã hiện cho quản lý (Nhân sự / Bàn giao / Nhập hàng) mà chưa duyệt. Mã lạ bỏ qua.
create or replace function public.app_ds2_work_ok(p_report bigint, p_parts text[]) returns void
language plpgsql security definer set search_path = public as $f$
declare it text;
begin
  perform public.app__stc_ds_need(p_report, false);
  foreach it in array coalesce(p_parts, '{}'::text[]) loop
    if it = any(array['nhan_su', 'ban_giao', 'nhap_hang'])
       and not exists (select 1 from public.shift_report_checks c where c.report_id = p_report and c.item = it) then
      perform public.app_ca_check(p_report, it, true);
    end if;
  end loop;
end $f$;

-- Hoàn thành gộp (bỏ nút Xác nhận Fabi) — MỘT giao dịch, hỏng ở đâu không lưu gì:
-- duyệt phần việc web đã hiện → phần việc còn thiếu (trừ chờ Chủ duyệt x2) thì báo → chưa đủ 4 mục tiền thì xác nhận như Xác nhận Fabi cũ
-- → tích các ô cơ bản quản lý vừa xác nhận (chỉ anh / sot / that / goi, đúng danh sách web đã hiện) → Hoàn thành (thiếu mục thì báo danh sách).
-- Ca đã đủ 4 mục tiền từ trước (trang cũ) thì không ghi lại mục tiền (như trang cũ: sửa thu chi sau khi xác nhận không ghi lại mục tiền).
create or replace function public.app_ds2_finish(p_report bigint, p_parts text[], p_ticks text[]) returns jsonb
language plpgsql security definer set search_path = public as $f$
declare r public.shift_reports; it text; left_parts text[]; m jsonb; v bigint; res text;
begin
  perform set_config('app.ds_moi', '1', true);
  r := public.app__stc_ds_need(p_report, false);
  perform 1 from public.shift_reports where id = p_report for update;
  if exists (select 1 from public.stc_ca_done where report_id = p_report) then
    return jsonb_build_object('done', true, 'recon_status', r.recon_status, 'already', true);
  end if;
  perform public.app_ds2_work_ok(p_report, p_parts);
  left_parts := array(select public.app__ca_item_label(q.u) from unnest(array['nhan_su', 'ban_giao', 'nhap_hang']) with ordinality q(u, o)
                       where not exists (select 1 from public.shift_report_checks c where c.report_id = p_report and c.item = q.u)
                         and (q.u <> 'nhap_hang' or exists (select 1 from public.delivery_invoices d where d.received_report_id = p_report))
                       order by q.o);
  if cardinality(left_parts) > 0 then raise exception 'Phần việc chưa duyệt: %', array_to_string(left_parts, ', '); end if;
  if not coalesce((public.app__stc_ds_state(p_report) ->> 'done')::boolean, false) then
    perform public.app_stc_ds_close(p_report);
  else   -- đã đủ 4 mục tiền từ trước: ghi lại tiền mặt / chuyển khoản theo số mới khi khác (như Xác nhận Fabi cũ ghi),
         -- trừ mục web tự duyệt (khoá, chỉ Chủ mở) và mục đã xử lý lệch (giữ như trang cũ)
    m := public.app__ca_money(p_report);
    foreach it in array array['tien_mat', 'chuyen_khoan'] loop
      v := (m ->> case it when 'tien_mat' then 'tm_left' else 'ck_left' end)::bigint;
      res := case when coalesce(v, 0) = 0 then 'khop' when v < 0 then 'thieu' else 'thua' end;
      continue when exists (select 1 from public.shift_report_results x where x.report_id = p_report and x.item = it
                     and ((x.result = res and coalesce(x.amount, 0) = abs(coalesce(v, 0))) or (x.result = 'khop' and abs(coalesce(v, 0)) <= 5000)));
      continue when exists (select 1 from public.shift_report_checks c where c.report_id = p_report and c.item = it and c.auto = 1);
      continue when exists (select 1 from public.shift_shortfalls s where s.report_id = p_report and s.item = it and s.status <> 'huy')
                 or exists (select 1 from public.gap_decisions g where g.report_id = p_report and g.item = it)
                 or exists (select 1 from public.gap_matches mm where mm.item = it and (mm.short_report = p_report or mm.over_report = p_report) and mm.status in ('da_duyet', 'cho_duyet'));
      perform public.app_ca_result_set(p_report, it, res, abs(coalesce(v, 0)),
        case when res = 'khop' then null else 'Hoàn thành (trang đối soát ca mới) — ghi lại theo số mới, lệch xử lý ở phiếu chênh lệch' end, '[]'::jsonb);
    end loop;
  end if;
  foreach it in array coalesce(p_ticks, '{}'::text[]) loop
    if it = any(array['anh', 'sot', 'that', 'goi']) then perform public.app_stc_tick(p_report, it, true); end if;
  end loop;
  perform public.app_stc_ds_done(p_report);
  select * into r from public.shift_reports where id = p_report;
  perform public.app_log('ds2_hoan_thanh', 'report=' || p_report);
  return jsonb_build_object('done', true, 'recon_status', r.recon_status);
end $f$;

-- Mở lại (sau Hoàn thành): bỏ dấu Hoàn thành + mục tiền (ca về "chưa xong", sửa tự do), giữ dấu duyệt phần việc. Lý do không bắt buộc.
create or replace function public.app_ds2_reopen(p_report bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $f$
begin
  perform set_config('app.ds_moi', '1', true);
  perform public.app_stc_ds_undone(p_report);
  perform public.app_stc_ds_reopen(p_report, p_reason);
end $f$;

-- quyền: như mọi hàm app_* — web (đã đăng nhập) gọi được; hàm nội bộ app__* không cho web gọi
revoke all on function public.app__ds_moi() from public, anon, authenticated;
revoke all on function public.app__ds2_no_gap(bigint) from public, anon, authenticated;
revoke all on function public.app_ds2_ds_fabi(p_report bigint, p_field text, p_name text, p_reason text) from public, anon;
grant execute on function public.app_ds2_ds_fabi(p_report bigint, p_field text, p_name text, p_reason text) to authenticated;
revoke all on function public.app_ds2_ds_cash(p_report bigint, p_mode text, p_counted bigint) from public, anon;
grant execute on function public.app_ds2_ds_cash(p_report bigint, p_mode text, p_counted bigint) to authenticated;
revoke all on function public.app_ds2_ds_blame(p_report bigint, p_who text, p_reason text) from public, anon;
grant execute on function public.app_ds2_ds_blame(p_report bigint, p_who text, p_reason text) to authenticated;
revoke all on function public.app_ds2_ds_blame_undo(p_report bigint, p_reason text) from public, anon;
grant execute on function public.app_ds2_ds_blame_undo(p_report bigint, p_reason text) to authenticated;
revoke all on function public.app_ds2_fix_request(p_report bigint, p_field text, p jsonb, p_reason text) from public, anon;
grant execute on function public.app_ds2_fix_request(p_report bigint, p_field text, p jsonb, p_reason text) to authenticated;
revoke all on function public.app_ds2_fix_cancel(p_req bigint) from public, anon;
grant execute on function public.app_ds2_fix_cancel(p_req bigint) to authenticated;
revoke all on function public.app_ds2_fix_decide(p_req bigint, p_ok boolean, p_note text) from public, anon;
grant execute on function public.app_ds2_fix_decide(p_req bigint, p_ok boolean, p_note text) to authenticated;
revoke all on function public.app_ds2_move_save(p_report bigint, p_mkey text, p jsonb, p_reason text) from public, anon;
grant execute on function public.app_ds2_move_save(p_report bigint, p_mkey text, p jsonb, p_reason text) to authenticated;
revoke all on function public.app_ds2_move_exchange(p_report bigint, p_mkey text, p_reason text) from public, anon;
grant execute on function public.app_ds2_move_exchange(p_report bigint, p_mkey text, p_reason text) to authenticated;
revoke all on function public.app_ds2_move_exchange_delete(p_report bigint, p_mkey text, p_reason text) from public, anon;
grant execute on function public.app_ds2_move_exchange_delete(p_report bigint, p_mkey text, p_reason text) to authenticated;
revoke all on function public.app_ds2_debt_collect(p_report bigint, p_debt bigint, p_kind text, p_amount bigint, p_reason text) from public, anon;
grant execute on function public.app_ds2_debt_collect(p_report bigint, p_debt bigint, p_kind text, p_amount bigint, p_reason text) to authenticated;
revoke all on function public.app_ds2_debt_uncollect(p_report bigint, p_debt bigint) from public, anon;
grant execute on function public.app_ds2_debt_uncollect(p_report bigint, p_debt bigint) to authenticated;
revoke all on function public.app_ds2_debt_uncollect(p_report bigint, p_debt bigint, p_reason text) from public, anon;
grant execute on function public.app_ds2_debt_uncollect(p_report bigint, p_debt bigint, p_reason text) to authenticated;
revoke all on function public.app_ds2_confirm(bigint) from public, anon;
grant execute on function public.app_ds2_confirm(bigint) to authenticated;
revoke all on function public.app_ds2_work_ok(bigint, text[]) from public, anon;
grant execute on function public.app_ds2_work_ok(bigint, text[]) to authenticated;
revoke all on function public.app_ds2_finish(bigint, text[], text[]) from public, anon;
grant execute on function public.app_ds2_finish(bigint, text[], text[]) to authenticated;
revoke all on function public.app_ds2_reopen(bigint, text) from public, anon;
grant execute on function public.app_ds2_reopen(bigint, text) to authenticated;

insert into public.app_migrations(file) values ('173_doi_soat_moi_sua_tu_do.sql') on conflict (file) do nothing;
