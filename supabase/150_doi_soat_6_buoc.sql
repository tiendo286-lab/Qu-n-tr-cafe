-- Bước 171 · đợt A (20/11/2026, anh Tiến chốt qua bản thử): Đối soát thu chi của ca đi 6 bước.
-- Thiết kế: tai_lieu/superpowers/specs/2026-11-20-doi-soat-thu-chi-6-buoc-design.md (mục 6, 10, 12, 13).
-- VÙNG KHOÁ (đã báo anh Tiến ở mục 12 của thiết kế): vá app_stc_ds_close, app__ca_auto_finish, app_stc_ds_reopen.
--   • Xác nhận Fabi (app_stc_ds_close) KHÔNG còn làm ca thành "Đã đối soát".
--   • Ca chỉ thành "Đã đối soát" (app__ca_auto_finish) khi đã bấm "Hoàn thành đối soát ca" (bảng stc_ca_done) — áp dụng cho MỌI đường
--     đang gọi app__ca_auto_finish (xong phần việc, web tự đối soát theo Fabi, quản lý tự chốt…): ca đó hiện 🔵 ở Đối soát Fabi, quản lý vào tích đủ rồi bấm.
--   • Mở lại xác nhận Fabi (app_stc_ds_reopen) bỏ luôn dấu Hoàn thành.
-- Không đổi cách tính tiền, không đổi app_can / role_permissions / app__stc_can / app__stc_need.
-- Chưa làm ở đợt này (đợt sau): "Ca trước ghi sai" khi ca trước Thu theo ca; quản lý sửa số máy Fabi + Chủ duyệt; người nợ; phiếu tạo trong ca.
-- Bài thử: kiem_tra/doi_soat_6_buoc_150.sql. Chạy lại nhiều lần không sao.

create table if not exists public.stc_ca_ticks (
  report_id bigint not null references public.shift_reports(id) on delete cascade,
  item text not null,
  by_account bigint references public.accounts(id),
  at text not null default public.vn_now_text(),
  primary key (report_id, item)
);
create table if not exists public.stc_ca_done (
  report_id bigint primary key references public.shift_reports(id) on delete cascade,
  by_account bigint references public.accounts(id),
  at text not null default public.vn_now_text()
);
alter table public.stc_ca_ticks enable row level security;
alter table public.stc_ca_done enable row level security;
revoke all on public.stc_ca_ticks from anon, authenticated;
revoke all on public.stc_ca_done from anon, authenticated;

-- Mục quản lý tự tích: hd anh goi tn sot that lon ld · dấu "Để sau" của lệch: sau_tm sau_ck
create or replace function public.app__stc_tick_items() returns text[] language sql immutable as $$
  select array['hd', 'anh', 'goi', 'tn', 'sot', 'that', 'lon', 'ld', 'sau_tm', 'sau_ck']
$$;

create or replace function public.app_stc_tick(p_report bigint, p_item text, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports;
begin
  r := public.app__stc_ds_need(p_report, false);
  if not (p_item = any(public.app__stc_tick_items())) then raise exception 'Mục kiểm tra không hợp lệ.'; end if;
  if exists (select 1 from public.stc_ca_done where report_id = p_report) then raise exception 'Ca đã hoàn thành đối soát — bấm Mở lại trước.'; end if;
  if coalesce(p_on, false) then
    insert into public.stc_ca_ticks(report_id, item, by_account) values (p_report, p_item, a.id)
    on conflict (report_id, item) do nothing;
  else
    delete from public.stc_ca_ticks where report_id = p_report and item = p_item;
  end if;
end $$;

-- Những mục còn thiếu để Hoàn thành đối soát ca. Lấy cùng nguồn với giao diện (app_stc_month) để hai bên không lệch nhau.
-- Giống hàm dsChecks ở docs/js/so_thu_chi_tinh.js.
create or replace function public.app__stc_ds_missing(p_report bigint) returns text[]
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; s jsonb; m jsonb; ca jsonb; its jsonb; out text[] := '{}'; tk text[]; last_ca boolean; nx public.shift_reports; ns jsonb;
  chi_n int; chi_nocat int; chi_big int; thu_no int; pm text; pend int; big_gap int;
begin
  select * into r from public.shift_reports where id = p_report;
  s := public.app__stc_ds_state(p_report);
  if not coalesce((s ->> 'done')::boolean, false) then return array['Chưa Xác nhận Fabi']; end if;
  m := public.app_stc_month(r.branch_id, left(r.work_date, 7));
  select c into ca from jsonb_array_elements(m -> 'cas') c where (c ->> 'id')::bigint = p_report;
  select coalesce(jsonb_agg(i), '[]') into its from jsonb_array_elements(m -> 'items') i
   where (i ->> 'ca_id')::bigint = p_report and not coalesce((i ->> 'void')::boolean, false);
  select coalesce(array_agg(item), '{}') into tk from public.stc_ca_ticks where report_id = p_report;
  -- bước 1
  if not ((s ->> 'mo1')::boolean and (s ->> 'mo2')::boolean) then out := out || 'Tiền mở ca chưa khớp'; end if;
  if not (s ->> 'dt')::boolean then out := out || 'Doanh thu chưa khớp máy Fabi'; end if;
  if not (s ->> 'no')::boolean then out := out || 'Nợ bill chưa khớp máy Fabi'; end if;
  if coalesce((ca -> 'fabi' ->> 'edited_bills')::int, 0) > 0 and not ('hd' = any(tk)) then out := out || 'Chưa tích: đã hỏi về hoá đơn bị sửa / xoá'; end if;
  if not ('anh' = any(tk)) then out := out || 'Chưa tích: ảnh phiếu Fabi đúng với số máy'; end if;
  -- bước 2
  select o.* into nx from public.shift_reports o
   where o.branch_id = r.branch_id and o.work_date = r.work_date and o.status = 'hoan_thanh'
     and array_position(public.app__shifts(), o.shift) > array_position(public.app__shifts(), r.shift)
   order by array_position(public.app__shifts(), o.shift) limit 1;
  last_ca := nx.id is null;
  if coalesce(r.cash_mode, 'ngay') = 'ca' and r.ql_counted is null then out := out || 'Chưa nhập tiền mặt quản lý đếm két'; end if;
  if coalesce(r.cash_mode, 'ngay') = 'ca' or last_ca then
    if not ('goi' = any(tk)) then out := out || 'Chưa tích: két để lại đúng 1.000.000 cho ca sau'; end if;
  else
    ns := public.app__stc_ds_state(nx.id);
    if not ((ns ->> 'mo1')::boolean and (ns ->> 'mo2')::boolean) then out := out || 'Tiền đóng ca này chưa bằng tiền mở ca sau'; end if;
  end if;
  if ca ->> 'bank_ck' is null or coalesce((ca ->> 'kt_wait')::boolean, false) then out := out || 'Chuyển khoản chưa có số ngân hàng'; end if;
  -- bước 3
  select count(*) into thu_no from jsonb_array_elements(its) i where i ->> 'book' = 'thu' and i ->> 'col' = 'no';
  if thu_no > 0 and not ('tn' = any(tk)) then out := out || 'Chưa tích: thu nợ đúng khách'; end if;
  if not ('sot' = any(tk)) then out := out || 'Chưa tích: không sót khoản thu'; end if;
  -- bước 4
  select count(*), count(*) filter (where coalesce(i ->> 'cat', '') = ''), count(*) filter (where (i ->> 'amount')::numeric >= 300000)
    into chi_n, chi_nocat, chi_big from jsonb_array_elements(its) i where i ->> 'book' = 'chi' and i ->> 'col' = 'chi';
  if chi_nocat > 0 then out := out || format('Còn %s khoản chi chưa chọn nhóm', chi_nocat); end if;
  if chi_n > 0 and not ('that' = any(tk)) then out := out || 'Chưa tích: khoản chi có thật'; end if;
  if chi_big > 0 and not ('lon' = any(tk)) then out := out || 'Chưa tích: đã xem khoản từ 300.000'; end if;
  -- bước 5: dòng Chênh lệch — xong khi chữ trạng thái không còn "chờ", hoặc đang chờ Chủ duyệt, hoặc đã bấm Để sau
  foreach pm in array array['tm', 'ck'] loop
    select count(*) into pend from jsonb_array_elements(its) i
     where i ->> 'col' = 'lech' and i ->> 'pm' = pm and coalesce((i ->> 'gross')::numeric, (i ->> 'amount')::numeric, 0) <> 0
       and case when coalesce(i ->> 'status', '') <> '' then (i ->> 'status') ~* 'chờ' and not (i ->> 'status') ~* 'chờ Chủ duyệt'
                else i -> 'gap' is not null and jsonb_typeof(i -> 'gap') <> 'null' end;
    if pend > 0 and not (('sau_' || pm) = any(tk)) then
      out := out || (case pm when 'tm' then 'Tiền mặt' else 'Chuyển khoản' end || ' lệch chưa chọn cách xử lý');
    end if;
  end loop;
  select count(*) into big_gap from jsonb_array_elements(its) i
   where i ->> 'col' = 'lech' and coalesce((i ->> 'gross')::numeric, (i ->> 'amount')::numeric, 0) <> 0 and not coalesce(i ->> 'status', '') ~ 'Lệch nhỏ';
  if big_gap > 0 and not ('ld' = any(tk)) then out := out || 'Chưa tích: đã hỏi lý do thiếu / thừa'; end if;
  return out;
end $$;

create or replace function public.app_stc_ds_done(p_report bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports; miss text[];
begin
  r := public.app__stc_ds_need(p_report, false);
  perform 1 from public.shift_reports where id = p_report for update;
  if exists (select 1 from public.stc_ca_done where report_id = p_report) then return; end if;
  miss := public.app__stc_ds_missing(p_report);
  if cardinality(miss) > 0 then raise exception 'Còn mục chưa kiểm tra: %', array_to_string(miss, ' · '); end if;
  insert into public.stc_ca_done(report_id, by_account) values (p_report, a.id);
  perform public.app__ca_auto_finish(p_report, a.id);
  perform public.app_log('stc_hoan_thanh_ds', 'report=' || p_report);
end $$;

-- Mở lại (bỏ dấu Hoàn thành): ca về "đã xác nhận Fabi", giữ mọi mục đã tích và mọi kết quả tiền.
create or replace function public.app_stc_ds_undone(p_report bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports;
begin
  r := public.app__stc_ds_need(p_report, false);
  perform 1 from public.shift_reports where id = p_report for update;
  if not exists (select 1 from public.stc_ca_done where report_id = p_report) then return; end if;
  delete from public.stc_ca_done where report_id = p_report;
  if r.recon_status = 'hoan_thanh' then
    update public.shift_reports set recon_status = 'mo_lai', recon_by = null, recon_at = null where id = p_report;
    insert into public.shift_recon_log(report_id, action, reason, by_account) values (p_report, 'mo_lai_doi_soat', 'Mở lại Hoàn thành đối soát ca (Sổ thu chi)', a.id);
  end if;
  perform public.app_log('stc_mo_lai_hoan_thanh', 'report=' || p_report);
end $$;

revoke all on function public.app__stc_tick_items() from public, anon, authenticated;
revoke all on function public.app__stc_ds_missing(bigint) from public, anon, authenticated;
revoke all on function public.app_stc_tick(bigint, text, boolean) from public, anon;
revoke all on function public.app_stc_ds_done(bigint) from public, anon;
revoke all on function public.app_stc_ds_undone(bigint) from public, anon;
grant execute on function public.app_stc_tick(bigint, text, boolean) to authenticated;
grant execute on function public.app_stc_ds_done(bigint) to authenticated;
grant execute on function public.app_stc_ds_undone(bigint) to authenticated;

-- ---- Mục đã tích tự bỏ khi dữ liệu liên quan đổi; ca đã Hoàn thành thì khoá sửa phiếu / tiền đếm (Mở lại trước).
create or replace function public.app__stc_untick(p_report bigint, p_items text[]) returns void
language sql security definer set search_path = public as $$
  delete from public.stc_ca_ticks where report_id = p_report and item = any(p_items)
$$;
revoke all on function public.app__stc_untick(bigint, text[]) from public, anon, authenticated;

-- bản đối soát của ca: danh sách khoản thu chi (moves) đổi → bỏ tích phần thu / phần chi; số đếm két đổi → bỏ tích gối đầu
create or replace function public.app__stc_recon_tick() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb := case when tg_op = 'UPDATE' then coalesce(old.data -> 'moves', '[]'::jsonb) else '[]'::jsonb end;
  n jsonb := coalesce(new.data -> 'moves', '[]'::jsonb); thu boolean; chi boolean; cnt boolean;
begin
  if tg_op = 'INSERT' then return new; end if;   -- bản chụp đầu tiên từ phiếu nhân viên: chưa có gì đổi
  thu := (select coalesce(jsonb_agg(x order by x::text), '[]') from jsonb_array_elements(o) x where coalesce((x ->> 'amount')::numeric, 0) > 0)
         is distinct from (select coalesce(jsonb_agg(x order by x::text), '[]') from jsonb_array_elements(n) x where coalesce((x ->> 'amount')::numeric, 0) > 0);
  chi := (select coalesce(jsonb_agg(x order by x::text), '[]') from jsonb_array_elements(o) x where coalesce((x ->> 'amount')::numeric, 0) <= 0)
         is distinct from (select coalesce(jsonb_agg(x order by x::text), '[]') from jsonb_array_elements(n) x where coalesce((x ->> 'amount')::numeric, 0) <= 0);
  cnt := (old.data ->> 'cash_counted') is distinct from (new.data ->> 'cash_counted');
  if (thu or chi) and exists (select 1 from public.stc_ca_done where report_id = new.report_id) then
    raise exception 'Ca đã hoàn thành đối soát — bấm Mở lại trước.';
  end if;
  if thu then perform public.app__stc_untick(new.report_id, array['tn', 'sot', 'ld', 'sau_tm', 'sau_ck']); end if;
  if chi then perform public.app__stc_untick(new.report_id, array['that', 'lon', 'ld', 'sau_tm', 'sau_ck']); end if;
  if cnt then perform public.app__stc_untick(new.report_id, array['goi', 'ld', 'sau_tm']); end if;
  return new;
end $$;
drop trigger if exists stc_recon_tick on public.shift_report_recon;
create trigger stc_recon_tick after insert or update of data on public.shift_report_recon
  for each row execute function public.app__stc_recon_tick();

-- tiền mặt quản lý đếm / cách thu đổi
create or replace function public.app__stc_cash_tick() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ql_counted is distinct from old.ql_counted or new.cash_mode is distinct from old.cash_mode then
    if exists (select 1 from public.stc_ca_done where report_id = new.id) then raise exception 'Ca đã hoàn thành đối soát — bấm Mở lại trước.'; end if;
    perform public.app__stc_untick(new.id, array['goi', 'ld', 'sau_tm']);
  end if;
  return new;
end $$;
drop trigger if exists stc_cash_tick on public.shift_reports;
create trigger stc_cash_tick after update of ql_counted, cash_mode on public.shift_reports
  for each row execute function public.app__stc_cash_tick();

-- kế toán tải lại file Fabi của ca
create or replace function public.app__stc_fabi_tick() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__stc_untick(r.id, array['hd', 'anh'])
     from public.shift_reports r
    where r.id = new.report_id or (new.report_id is null and r.branch_id = new.branch_id and r.work_date = new.work_date and r.shift = new.shift);
  return new;
end $$;
drop trigger if exists stc_fabi_tick on public.fabi_shifts;
create trigger stc_fabi_tick after insert or update on public.fabi_shifts
  for each row execute function public.app__stc_fabi_tick();

-- khách trả nợ trong ca (ghi / bỏ)
create or replace function public.app__stc_debt_tick() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.closed_report_id is distinct from old.closed_report_id or new.closed_at is distinct from old.closed_at then
    if old.closed_report_id is not null then perform public.app__stc_untick(old.closed_report_id, array['tn', 'ld', 'sau_tm', 'sau_ck']); end if;
    if new.closed_report_id is not null then perform public.app__stc_untick(new.closed_report_id, array['tn', 'ld', 'sau_tm', 'sau_ck']); end if;
  end if;
  return new;
end $$;
drop trigger if exists stc_debt_tick on public.shift_debts;
create trigger stc_debt_tick after update of closed_at, closed_report_id on public.shift_debts
  for each row execute function public.app__stc_debt_tick();

-- ---- Vá 3 hàm vùng khoá + app_stc_month bằng thay chuỗi (giữ nguyên mọi phần khác, kể cả các bản vá trước)
do $$
declare d text; anchor text; add text;
begin
  -- 1. Xác nhận Fabi không còn tự Hoàn thành đối soát
  d := pg_get_functiondef('public.app_stc_ds_close(bigint)'::regprocedure);
  anchor := $q$perform public.app__ca_auto_finish(p_report, (public.app_account()).id);$q$;
  if position(anchor in d) > 0 then
    execute replace(d, anchor, $q$-- bước 171: Hoàn thành đối soát do app_stc_ds_done (bấm ở bước 6), không tự làm ở đây$q$);
  elsif position($q$bước 171$q$ in d) = 0 then raise exception 'app_stc_ds_close: không thấy chỗ vá (auto_finish).'; end if;

  -- 2. Ca chỉ thành Đã đối soát khi đã bấm Hoàn thành đối soát ca
  d := pg_get_functiondef('public.app__ca_auto_finish(bigint,bigint)'::regprocedure);
  if position('stc_ca_done' in d) = 0 then
    anchor := $q$if r.recon_status in ('chua', 'mo_lai') and$q$;
    if position(anchor in d) = 0 then raise exception 'app__ca_auto_finish: không thấy chỗ vá.'; end if;
    execute replace(d, anchor, anchor || $q$ exists (select 1 from public.stc_ca_done dn where dn.report_id = p_id) and$q$);
  end if;

  -- 3. Mở lại xác nhận Fabi bỏ luôn dấu Hoàn thành
  d := pg_get_functiondef('public.app_stc_ds_reopen(bigint,text)'::regprocedure);
  if position('stc_ca_done' in d) = 0 then
    anchor := $q$perform 1 from public.shift_reports where id = p_report for update;$q$;
    if position(anchor in d) = 0 then raise exception 'app_stc_ds_reopen: không thấy chỗ vá.'; end if;
    execute replace(d, anchor, anchor || E'\n  delete from public.stc_ca_done where report_id = p_report;   -- bước 171');
  end if;

  -- 4. app_stc_month: mỗi ca trả thêm mục đã tích + dấu hoàn thành
  d := pg_get_functiondef('public.app_stc_month(bigint,text)'::regprocedure);
  if position($q$'ticks', $q$ in d) = 0 then
    anchor := $q$'recon_money_done', r.mdone)$q$;
    if position(anchor in d) = 0 then raise exception 'app_stc_month: không thấy chỗ chèn (cas).'; end if;
    add := $q$'recon_money_done', r.mdone,
        'ticks', coalesce((select jsonb_agg(tk.item order by tk.item) from public.stc_ca_ticks tk where tk.report_id = r.id), '[]'::jsonb),
        'done', (select jsonb_build_object('by', coalesce(public.app__acc_name(dn.by_account), ''), 'at', dn.at) from public.stc_ca_done dn where dn.report_id = r.id))$q$;
    execute replace(d, anchor, add);
  end if;
end $$;

-- ---- Chạy bù MỘT LẦN: ca đã xác nhận Fabi trước bước 171 coi như đã Hoàn thành (không bắt quay lại tích)
do $$
begin
  if not exists (select 1 from public.app_migrations where file = '150_doi_soat_6_buoc.sql') then
    insert into public.stc_ca_done(report_id, by_account, at)
    select r.id, null, 'trước bước 171'
      from public.shift_reports r
     where exists (select 1 from public.shift_report_results s where s.report_id = r.id and s.item = 'tien_mat')
       and exists (select 1 from public.shift_report_results s where s.report_id = r.id and s.item = 'chuyen_khoan')
    on conflict (report_id) do nothing;
  end if;
end $$;

insert into public.app_migrations(file) values ('150_doi_soat_6_buoc.sql') on conflict (file) do nothing;
