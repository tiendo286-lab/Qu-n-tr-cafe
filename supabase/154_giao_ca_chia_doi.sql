-- Bước 173 · đợt C phần 2 — lệch tiền khi giao ca (ô Tiền mở ca ở bước 1). Anh Tiến chốt 20/11 khuya:
--   • Thiếu tiền khi giao ca: thêm lựa chọn "Hai ca cùng chịu" — chia đôi cho ca trước và ca này (số lẻ ca này chịu). Thừa thì vẫn chọn một ca.
--   • Giữ "Ca trước ghi sai" / "Ca này ghi sai". Ca trước THU THEO CA cũng chọn được ca trước / chia đôi (thiết kế 6 bước mục 5, bước 1).
--   • Ca trước Thu theo ca: tiền thực nhận = số quản lý đếm + phần ca trước chịu (app__stc_handover_adj) — số quản lý đếm và tiền đã nộp quỹ giữ nguyên;
--     phần thiếu thành dòng Chênh lệch tiền mặt của ca trước (bước 5). Ca trước Thu cuối ngày: như cũ (sửa số đếm két ca trước trong bản đối soát).
-- VÙNG KHOÁ (đã báo anh Tiến ở thiết kế mục 12): app_stc_ds_blame, app_stc_ds_blame_undo; cách tính tiền thực nhận ca Thu theo ca (app__stc_real_tm,
-- app__ca_money, app_stc_month). Bài thử: kiem_tra/giao_ca_154_cuc_bo.sql. Chạy lại nhiều lần không sao.

alter table public.stc_open_blame add column if not exists prev_amt bigint;   -- phần ca trước chịu (âm = thiếu); null ở dòng cũ

-- phần lệch giao ca mà ca này (ca trước của ca sau) phải chịu khi ca này Thu theo ca
create or replace function public.app__stc_handover_adj(p_report bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum(coalesce(b.prev_amt, case when b.who = 'truoc' then b.diff else 0 end)), 0)::bigint
    from public.stc_open_blame b join public.shift_reports pr on pr.id = b.prev_report
   where b.prev_report = p_report and pr.cash_mode = 'ca'
$$;
revoke all on function public.app__stc_handover_adj(bigint) from public, anon, authenticated;

create or replace function public.app__stc_real_tm(p_report bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select case when r.cash_mode = 'ca' and r.ql_counted is not null then r.ql_counted + public.app__stc_handover_adj(r.id) else (public.app__ca_eff(r.id) ->> 'cash_counted')::bigint end
    from public.shift_reports r where r.id = p_report
$$;

create or replace function public.app_stc_ds_blame(p_report bigint, p_who text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports; s jsonb; rs text := public.app__stc_reason(p_reason);
  opn bigint; ex bigint; diff bigint; pa bigint; p public.shift_reports; d jsonb;
begin
  r := public.app__stc_ds_need(p_report, true);
  if exists (select 1 from public.stc_open_blame where report_id = p_report) then raise exception 'Đã chọn ca chịu lệch mở ca — huỷ trước khi chọn lại.'; end if;
  if coalesce(p_who, '') not in ('nay', 'truoc', 'doi') then raise exception 'Chọn ca chịu lệch: ca trước, ca này hoặc hai ca cùng chịu.'; end if;
  s := public.app__stc_ds_state(p_report);
  if not (s ->> 'mo1')::boolean then raise exception 'Số nhân viên ghi khác Fabi — bấm "Sửa theo Fabi" trước.'; end if;
  ex := (s ->> 'exp')::bigint; opn := coalesce((s ->> 'fabi_open')::bigint, (s ->> 'nv_open')::bigint);
  if ex is null then raise exception 'Chưa biết tiền mở ca phải là (ca trước chưa gửi phiếu).'; end if;
  diff := opn - ex;
  if diff = 0 then raise exception 'Tiền mở ca đã đúng — không cần chọn.'; end if;
  if p_who = 'doi' and diff > 0 then raise exception 'Hai ca cùng chịu chỉ dùng khi thiếu tiền lúc giao ca — thừa thì chọn một ca.'; end if;
  pa := case p_who when 'truoc' then diff when 'doi' then trunc(diff / 2.0)::bigint else 0 end;   -- chia đôi: ca này chịu phần lẻ
  if p_who in ('truoc', 'doi') then
    select * into p from public.shift_reports where id = (s ->> 'prev')::bigint;
    if p.id is null then raise exception 'Ca đầu ngày không có ca trước — chọn "Ca này ghi sai".'; end if;
    perform public.app__stc_ds_need(p.id, false);
    if coalesce(p.cash_mode, 'ngay') <> 'ca' then
      -- ca trước Thu cuối ngày: sửa thẳng số đếm két của ca trước trong bản đối soát (không mở lại mục đã duyệt), ghi nhật ký
      select data into d from public.shift_report_recon where report_id = p.id;
      if d is null then
        insert into public.shift_report_recon(report_id, data, updated_by, updated_at) values (p.id, jsonb_build_object('cash_counted', public.app__stc_real_tm(p.id) + pa), a.id, public.vn_now_text());
      else
        update public.shift_report_recon set data = d || jsonb_build_object('cash_counted', public.app__stc_real_tm(p.id) + pa), updated_by = a.id, updated_at = public.vn_now_text() where report_id = p.id;
      end if;
    end if;   -- ca trước Thu theo ca: không đổi số quản lý đếm; phần chịu tính qua app__stc_handover_adj
    insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
    values (p.id, 'ca_sau_bao_lech_mo_ca', 'cash_counted', jsonb_build_object('cash_counted', public.app__stc_real_tm(p.id)), jsonb_build_object('cash_counted', public.app__stc_real_tm(p.id) + pa),
            'Ca sau mở ca ' || public.app__vnd(opn) || ' (phải là ' || public.app__vnd(ex) || ') — ' || case when p_who = 'doi' then 'hai ca cùng chịu' else 'ca trước ghi sai' end || ': ' || rs, a.id);
  end if;
  if p_who in ('nay', 'doi') then
    perform public.app_ca_recon_apply(p_report, jsonb_build_object('fields', jsonb_build_object('opening_cash', ex + pa)),
      case when p_who = 'doi' then 'Hai ca cùng chịu lệch mở ca: ' else 'Ca này ghi sai tiền mở ca: ' end || rs);
  end if;
  insert into public.stc_open_blame(report_id, who, diff, prev_report, reason, by_account, prev_amt) values (p_report, p_who, diff, (s ->> 'prev')::bigint, rs, a.id, pa);
  perform public.app_log('stc_lech_mo_ca', 'report=' || p_report || ' ' || p_who || ' ' || diff || ' · ca trước chịu ' || pa);
end $$;

create or replace function public.app_stc_ds_blame_undo(p_report bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); b public.stc_open_blame; rs text := public.app__stc_reason(p_reason); d jsonb; pa bigint; p public.shift_reports;
begin
  perform public.app__stc_ds_need(p_report, true);
  select * into b from public.stc_open_blame where report_id = p_report for update;
  if b.report_id is null then raise exception 'Chưa chọn ca chịu lệch mở ca.'; end if;
  pa := coalesce(b.prev_amt, case when b.who = 'truoc' then b.diff else 0 end);
  if b.who in ('nay', 'doi') then
    perform public.app_ca_recon_apply(p_report, jsonb_build_object('fields', jsonb_build_object('opening_cash', (public.app__ca_eff(p_report) ->> 'opening_cash')::bigint + b.diff - pa)),
      'Huỷ "' || case when b.who = 'doi' then 'hai ca cùng chịu' else 'ca này ghi sai' end || '": ' || rs);
  end if;
  if b.who in ('truoc', 'doi') and b.prev_report is not null then
    perform public.app__stc_ds_need(b.prev_report, false);
    select * into p from public.shift_reports where id = b.prev_report;
    if coalesce(p.cash_mode, 'ngay') <> 'ca' then
      select data into d from public.shift_report_recon where report_id = b.prev_report;
      update public.shift_report_recon set data = d || jsonb_build_object('cash_counted', public.app__stc_real_tm(b.prev_report) - pa), updated_by = a.id, updated_at = public.vn_now_text()
       where report_id = b.prev_report;
    end if;
    insert into public.shift_recon_log(report_id, action, field, reason, by_account) values (b.prev_report, 'huy_lech_mo_ca', 'cash_counted', 'Huỷ chọn ca chịu lệch mở ca: ' || rs, a.id);
  end if;
  delete from public.stc_open_blame where report_id = p_report;
  perform public.app_log('stc_huy_lech_mo_ca', 'report=' || p_report);
end $$;

-- tiền thực nhận của ca Thu theo ca ở 2 chỗ tính tiền đang viết thẳng (giữ mọi phần khác)
do $$
declare d text; a1 text; b1 text;
begin
  d := pg_get_functiondef('public.app__ca_money(bigint)'::regprocedure);
  a1 := $q$cc := case when r.cash_mode = 'ca' and r.ql_counted is not null then r.ql_counted else$q$;
  b1 := $q$cc := case when r.cash_mode = 'ca' and r.ql_counted is not null then r.ql_counted + public.app__stc_handover_adj(r.id) else$q$;
  if position('app__stc_handover_adj' in d) = 0 then
    if length(d) - length(replace(d, a1, '')) <> length(a1) then raise exception 'app__ca_money: không thấy đúng một chỗ vá (giao ca).'; end if;
    execute replace(d, a1, b1);
  end if;
  d := pg_get_functiondef('public.app_stc_month(bigint,text)'::regprocedure);
  a1 := $q$case when r.cash_mode = 'ca' and r.ql_counted is not null then r.ql_counted else (r.e ->> 'cash_counted')::bigint end real_tm$q$;
  b1 := $q$case when r.cash_mode = 'ca' and r.ql_counted is not null then r.ql_counted + public.app__stc_handover_adj(r.id) else (r.e ->> 'cash_counted')::bigint end real_tm$q$;
  if position('app__stc_handover_adj' in d) = 0 then
    if length(d) - length(replace(d, a1, '')) <> length(a1) then raise exception 'app_stc_month: không thấy đúng một chỗ vá (giao ca).'; end if;
    execute replace(d, a1, b1);
  end if;
end $$;

insert into public.app_migrations(file) values ('154_giao_ca_chia_doi.sql') on conflict (file) do nothing;
