-- Gộp vào bước 172 · đợt B (anh Tiến duyệt 20/11 khuya) — sửa khoản nợ tiền mặt / chuyển khoản của ca ngay ở bước 1 của Sổ thu chi › Đối soát Fabi.
-- Thiết kế: tai_lieu/superpowers/specs/2026-11-20-sua-no-cua-ca-design.md. Cần tệp 150 (stc_ca_done) + 151 (debt_people).
--   • Sửa số tiền, đổi Tiền mặt ↔ Chuyển khoản, xoá, đổi khoản khách mượn (TM) thành Luân chuyển TM – CK, thêm khoản quên ghi. KHÔNG sửa nợ hoá đơn.
--   • Ai: người qua app__stc_ds_need (Chủ, Quản lý tổng, quản lý đối soát của cơ sở) — không thêm quyền, không đổi app_can / role_permissions / app__stc_can / app__stc_need.
--   • Tới khi Hoàn thành đối soát ca (stc_ca_done); tháng đã chốt / ca đã Chốt thì không. Trước và sau Xác nhận Fabi đều sửa được (trừ khi phiếu đang chờ kế toán —
--     trigger ca_source_guard sẵn có chặn như mọi chỗ sửa nợ khác).
--   • Tiền của ca: dòng "Khách mượn" / "Nợ CK" tính trực tiếp từ shift_debts (app__ca_eff, app__ca_money) nên tự đổi theo, lệch bước 5 tính lại;
--     giống app_stc_move_save: không tự đụng phiếu chênh lệch đã có. Mục kiểm tra tay liên quan (ld, sau_tm, sau_ck) tự bỏ tích.
-- Không sửa các hàm cũ app_ca_recon_debt_*, không sửa app_stc_move_save. Trigger gác tên của tệp 151 vẫn áp cho khoản thêm mới.
-- Bài thử: kiem_tra/sua_no_ca_152_cuc_bo.sql (cục bộ), kiem_tra/sua_no_ca_152.sql (dữ liệu thật, tự hoàn tác). Chạy lại nhiều lần không sao.

-- ---- kiểm chung: quyền + ca đã gửi + tháng chưa chốt (app__stc_ds_need), khoá dòng ca, chưa Hoàn thành, chưa 🔒 Chốt
create or replace function public.app__stc_ca_debt_gate(p_report bigint) returns public.shift_reports
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports;
begin
  r := public.app__stc_ds_need(p_report, false);
  perform 1 from public.shift_reports where id = p_report for update;
  if exists (select 1 from public.stc_ca_done where report_id = p_report) then raise exception 'Ca đã hoàn thành đối soát — bấm Mở lại trước.'; end if;
  if public.app__stc_final(p_report) then raise exception 'Ca đã 🔒 Chốt — không sửa được.'; end if;
  return r;
end $$;

-- ---- khoản nợ sửa / xoá / đổi được: của đúng ca này, khoản gốc, Tiền mặt hoặc Chuyển khoản, khách chưa trả đồng nào
create or replace function public.app__stc_ca_debt_pick(p_report bigint, p_debt bigint) returns public.shift_debts
language plpgsql security definer set search_path = public as $$
declare d public.shift_debts;
begin
  select * into d from public.shift_debts where id = p_debt and report_id = p_report and split_from is null for update;
  if d.id is null then raise exception 'Không tìm thấy khoản nợ của ca này.'; end if;
  if coalesce(d.kind, 'bill') not in ('muon', 'ck') then raise exception 'Nợ hoá đơn không sửa ở đây — số tiền đi theo ô Nợ bill.'; end if;
  if d.closed_at is not null or exists (select 1 from public.shift_debts x where x.split_from = d.id or x.rest_of = d.id) then
    raise exception 'Khách đã trả khoản này — Huỷ thu ở Sổ thu trước rồi mới sửa.';
  end if;
  return d;
end $$;
revoke all on function public.app__stc_ca_debt_gate(bigint) from public, anon, authenticated;
revoke all on function public.app__stc_ca_debt_pick(bigint, bigint) from public, anon, authenticated;

-- ---- Thêm (p_debt trống) / sửa một khoản nợ của ca. p = {kind: 'muon' | 'ck', amount, person_id, grp, note}; khi sửa chỉ dùng kind + amount.
create or replace function public.app_stc_ca_debt_save(p_report bigint, p_debt bigint, p jsonb, p_reason text) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports; d public.shift_debts; pp public.debt_people; rs text;
  k text := p ->> 'kind'; amt bigint; g text := p ->> 'grp'; nt text := nullif(btrim(coalesce(p ->> 'note', '')), ''); nid bigint; old jsonb; nw jsonb;
begin
  r := public.app__stc_ca_debt_gate(p_report);
  rs := public.app__stc_reason(p_reason);
  if p_debt is not null then d := public.app__stc_ca_debt_pick(r.id, p_debt); end if;   -- kiểm khoản nợ trước (nợ hoá đơn / đã trả báo đúng lý do)
  if coalesce(k, '') not in ('muon', 'ck') then raise exception 'Chọn tiền mặt hay chuyển khoản.'; end if;
  amt := case when (p ->> 'amount') ~ '^[0-9]+$' then (p ->> 'amount')::bigint end;
  if coalesce(amt, 0) <= 0 then raise exception 'Nhập số tiền nợ lớn hơn 0.'; end if;
  if p_debt is null then
    select * into pp from public.debt_people
     where id = case when (p ->> 'person_id') ~ '^[0-9]+$' then (p ->> 'person_id')::bigint end and branch_id = r.branch_id and active = 1;
    if pp.id is null then raise exception 'Chọn người nợ trong danh sách.'; end if;
    if coalesce(g, '') not in ('khach', 'kho', 'khac') then raise exception 'Chọn nhóm công nợ.'; end if;
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, created_by, kind, grp, person_id, sorted_by, sorted_at)
    values (r.branch_id, r.id, pp.name, amt, nt, a.id, k, g, pp.id, a.id, public.vn_now_text())
    returning id into nid;
    nw := jsonb_build_object('id', nid, 'kind', k, 'table_name', pp.name, 'amount', amt, 'note', nt);
    insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
    values (r.id, 'bao_no_them', null, null, nw, 'Sổ thu chi: ' || rs, a.id);
  else
    if d.kind = k and d.amount = amt then raise exception 'Chưa đổi gì.'; end if;
    update public.shift_debts set kind = k, amount = amt where id = d.id;
    nid := d.id;
    old := jsonb_build_object('id', d.id, 'kind', d.kind, 'table_name', d.table_name, 'amount', d.amount);
    nw := jsonb_build_object('id', d.id, 'kind', k, 'table_name', d.table_name, 'amount', amt);
    insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
    values (r.id, 'bao_no_sua', null, old, nw, 'Sổ thu chi: ' || rs, a.id);
  end if;
  perform public.app__stc_untick(r.id, array['ld', 'sau_tm', 'sau_ck']);
  perform public.app__stc_log(r.branch_id, 'debt', 'cd:' || nid, case when p_debt is null then 'them' else 'sua' end, old, nw, rs);
  perform public.app_log('stc_sua_no_ca', 'report=' || r.id || ' debt=' || nid || ' ' || case when p_debt is null then 'them' else 'sua' end || ' ' || k || ' ' || amt);
  return nid;
end $$;

-- ---- Xoá một khoản nợ của ca (không phải nợ thật / ghi trùng)
create or replace function public.app_stc_ca_debt_delete(p_report bigint, p_debt bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports; d public.shift_debts; rs text; old jsonb;
begin
  r := public.app__stc_ca_debt_gate(p_report);
  rs := public.app__stc_reason(p_reason);
  d := public.app__stc_ca_debt_pick(r.id, p_debt);
  old := jsonb_build_object('id', d.id, 'kind', d.kind, 'table_name', d.table_name, 'amount', d.amount);
  delete from public.shift_debts where id = d.id;
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
  values (r.id, 'bao_no_xoa', null, old, null, 'Sổ thu chi: ' || rs, a.id);
  perform public.app__stc_untick(r.id, array['ld', 'sau_tm', 'sau_ck']);
  perform public.app__stc_log(r.branch_id, 'debt', 'cd:' || d.id, 'xoa', old, null, rs);
  perform public.app_log('stc_xoa_no_ca', 'report=' || r.id || ' debt=' || d.id || ' ' || d.kind || ' ' || d.amount);
end $$;

-- ---- Khoản khách mượn (TM) thực ra là khách chuyển khoản rồi rút tiền mặt: bỏ khoản nợ, thêm cặp đổi tiền −TM / +CK vào bản đối soát của ca
--      (đúng cách tệp 101 / app_ca_recon_debt_to_exchange, gồm app__ca_validate_exchanges và app__ca_exchange_cats; khác: khoản đã có khách trả thì từ chối).
create or replace function public.app_stc_ca_debt_to_exchange(p_report bigint, p_debt bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports; d public.shift_debts; rs text; k uuid := gen_random_uuid(); old jsonb; mv jsonb; snap jsonb;
begin
  r := public.app__stc_ca_debt_gate(p_report);
  rs := public.app__stc_reason(p_reason);
  d := public.app__stc_ca_debt_pick(r.id, p_debt);
  if d.kind <> 'muon' then raise exception 'Chỉ khoản nợ tiền mặt (khách mượn) mới đổi thành Luân chuyển TM – CK.'; end if;
  snap := jsonb_build_object('id', d.id, 'kind', d.kind, 'table_name', d.table_name, 'amount', d.amount);
  delete from public.shift_debts where id = d.id;
  insert into public.shift_report_recon(report_id, data, updated_by) values (r.id, public.app__recon_snapshot(r.id), a.id) on conflict (report_id) do nothing;
  select data into old from public.shift_report_recon where report_id = r.id for update;
  mv := coalesce(old -> 'moves', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('kind', 'tien_mat', 'amount', -d.amount, 'note', 'Khách CK rút tiền mặt – ' || d.table_name, 'exchange_key', k),
    jsonb_build_object('kind', 'chuyen_khoan', 'amount', d.amount, 'note', 'Khách CK rút tiền mặt – ' || d.table_name, 'exchange_key', k));
  perform public.app__ca_validate_exchanges(mv);
  update public.shift_report_recon set data = jsonb_set(data, '{moves}', mv), updated_by = a.id, updated_at = public.vn_now_text() where report_id = r.id;
  perform public.app__ca_exchange_cats(r.id, a.id);
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
  values (r.id, 'bao_no_xoa', 'luan_chuyen', snap, null, 'Sổ thu chi: ' || rs, a.id),
         (r.id, 'sua', 'moves', old -> 'moves', mv, 'Sổ thu chi: ' || rs, a.id);
  perform public.app__stc_untick(r.id, array['ld', 'sau_tm', 'sau_ck']);
  perform public.app__stc_log(r.branch_id, 'debt', 'cd:' || d.id, 'doi', snap, null, rs);
  perform public.app_log('stc_no_ca_thanh_luan_chuyen', 'report=' || r.id || ' debt=' || d.id || ' ' || d.amount);
end $$;

revoke all on function public.app_stc_ca_debt_save(bigint, bigint, jsonb, text) from public, anon;
revoke all on function public.app_stc_ca_debt_delete(bigint, bigint, text) from public, anon;
revoke all on function public.app_stc_ca_debt_to_exchange(bigint, bigint, text) from public, anon;
grant execute on function public.app_stc_ca_debt_save(bigint, bigint, jsonb, text) to authenticated;
grant execute on function public.app_stc_ca_debt_delete(bigint, bigint, text) to authenticated;
grant execute on function public.app_stc_ca_debt_to_exchange(bigint, bigint, text) to authenticated;

-- ---- app_stc_month · ca_debts: dòng nợ mới trả thêm dấu sửa ('edit': them / sua, ai, lúc nào, lý do, số cũ, loại cũ);
--      thêm dòng t = 'xoa' cho khoản đã xoá / đã đổi thành Luân chuyển ở Sổ thu chi. Vá đúng 2 chỗ, giữ mọi phần khác (kể cả vá của tệp 140, 150, 151).
do $$
declare d text; a1 text; a2 text;
begin
  d := pg_get_functiondef('public.app_stc_month(bigint,text)'::regprocedure);
  if position($q$'t', 'xoa'$q$ in d) = 0 then
    a1 := $q$'content', g.content) z, g.report_id rid, 'moi' t$q$;
    a2 := $q$and coalesce(g.report_id, 0) <> g.closed_report_id and g.amount > 0) q), '[]')$q$;
    if position(a1 in d) = 0 then raise exception 'app_stc_month: không thấy chỗ chèn dấu sửa (ca_debts · nợ mới) — cần tệp 151.'; end if;
    if position(a2 in d) = 0 or length(d) - length(replace(d, a2, '')) <> length(a2) then raise exception 'app_stc_month: không thấy đúng một chỗ chèn dòng đã xoá (ca_debts).'; end if;
    d := replace(d, a1, $q$'content', g.content,
                   'edit', (select jsonb_build_object('action', case l.action when 'bao_no_them' then 'them' else 'sua' end, 'by', coalesce(public.app__acc_name(l.by_account), ''),
                                    'at', l.at, 'reason', regexp_replace(coalesce(l.reason, ''), '^Sổ thu chi: ', ''),
                                    'old_amount', (l.before ->> 'amount')::bigint, 'old_kind', l.before ->> 'kind')
                              from public.shift_recon_log l
                             where l.report_id = g.report_id and l.action in ('bao_no_sua', 'bao_no_them') and l.reason like 'Sổ thu chi: %' and (l.after ->> 'id')::bigint = g.id
                             order by l.id desc limit 1)) z, g.report_id rid, 'moi' t$q$);
    d := replace(d, a2, $q$and coalesce(g.report_id, 0) <> g.closed_report_id and g.amount > 0
          union all
          select jsonb_build_object('report_id', l.report_id, 't', 'xoa', 'id', (l.before ->> 'id')::bigint, 'who', l.before ->> 'table_name', 'kind', coalesce(l.before ->> 'kind', 'bill'),
                   'amount', (l.before ->> 'amount')::bigint, 'left', 0, 'pm', null, 'from', null,
                   'edit', jsonb_build_object('action', case when l.field = 'luan_chuyen' then 'doi' else 'xoa' end, 'by', coalesce(public.app__acc_name(l.by_account), ''),
                                              'at', l.at, 'reason', regexp_replace(coalesce(l.reason, ''), '^Sổ thu chi: ', ''))),
                 l.report_id, 'xoa', (l.before ->> 'id')::bigint
            from public.shift_recon_log l
           where l.report_id in (select id from cr) and l.action = 'bao_no_xoa' and l.reason like 'Sổ thu chi: %') q), '[]')$q$);
    execute d;
  end if;
end $$;

insert into public.app_migrations(file) values ('152_sua_no_cua_ca.sql') on conflict (file) do nothing;
