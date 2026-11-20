-- Bước 173 · đợt C (thiết kế 6 bước mục 7, anh Tiến chốt 20/11): máy Fabi ghi sai → quản lý bấm "Sai, sửa số" gửi số đúng + lý do; Chủ bắt buộc duyệt, được từ chối.
-- Kế hoạch: tai_lieu/superpowers/plans/2026-11-20-doi-soat-6-buoc-dot-c.md. Cần tệp 150–152.
--   • Tiền của ca tính từ số trên phiếu (app__ca_eff), không từ file Fabi → Chủ duyệt = ghi số đã duyệt vào phiếu bằng app_ca_recon_apply (như nút "Lấy số máy Fabi"),
--     ô ở bước 1 coi là khớp khi có số Chủ đã duyệt bằng đúng số phiếu. Không đổi công thức tính tiền (app__ca_money giữ nguyên).
--   • Ô Doanh thu: 2 số (bán tiền mặt, bán chuyển khoản); doanh thu = TM + CK + nợ bill hiện tại. Ô Tiền mở ca, ô Nợ bill: 1 số.
--   • Đang chờ / bị từ chối → Xác nhận Fabi bị chặn (VÙNG KHOÁ: app_stc_ds_close — đã báo anh Tiến ở thiết kế mục 12). Chủ tự gửi = duyệt ngay.
--   • Chỉ gửi / bỏ khi ca chưa Xác nhận Fabi. Bỏ số Chủ đã duyệt: chỉ Chủ. Mọi lần gửi / bỏ / duyệt / từ chối ghi shift_recon_log + app_log.
-- Không sửa app_can / role_permissions / app__stc_can / app__stc_need / app_ca_recon_apply. Bài thử: kiem_tra/sua_so_fabi_153_cuc_bo.sql. Chạy lại nhiều lần không sao.

create table if not exists public.stc_fix_requests (
  id bigserial primary key,
  report_id bigint not null references public.shift_reports(id) on delete cascade,
  field text not null check (field in ('mo', 'dt', 'no')),
  old_val jsonb,
  new_val jsonb not null,
  reason text,
  status text not null default 'cho' check (status in ('cho', 'duyet', 'tu_choi', 'bo')),
  created_by bigint references public.accounts(id),
  created_at text not null default public.vn_now_text(),
  decided_by bigint references public.accounts(id),
  decided_at text,
  decide_note text
);
create unique index if not exists stc_fix_requests_live on public.stc_fix_requests (report_id, field) where status in ('cho', 'duyet');
create index if not exists stc_fix_requests_report on public.stc_fix_requests (report_id);
alter table public.stc_fix_requests enable row level security;
revoke all on public.stc_fix_requests from anon, authenticated;

-- số đang ghi trên phiếu cho một ô (để lưu "số cũ")
create or replace function public.app__stc_fix_cur(p_report bigint, p_field text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case p_field when 'mo' then jsonb_build_object('val', coalesce((e ->> 'ipos_opening')::bigint, (e ->> 'opening_cash')::bigint))
                      when 'no' then jsonb_build_object('val', coalesce((e ->> 'pos_debt')::bigint, 0))
                      else jsonb_build_object('tm', coalesce((e ->> 'pos_cash')::bigint, 0), 'ck', coalesce((e ->> 'pos_transfer')::bigint, 0), 'total', (e ->> 'total_revenue')::bigint) end
    from (select public.app__ca_eff(p_report) e) z
$$;

-- ô coi là khớp: có số Chủ đã duyệt và số trên phiếu (e = app__ca_eff) đúng bằng số đó
create or replace function public.app__stc_fix_ok(p_report bigint, p_field text, e jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stc_fix_requests q where q.report_id = p_report and q.field = p_field and q.status = 'duyet'
    and case p_field when 'mo' then coalesce((e ->> 'ipos_opening')::bigint, (e ->> 'opening_cash')::bigint) is not distinct from (q.new_val ->> 'val')::bigint
                     when 'no' then coalesce((e ->> 'pos_debt')::bigint, 0) = (q.new_val ->> 'val')::bigint
                     else coalesce((e ->> 'pos_cash')::bigint, 0) = (q.new_val ->> 'tm')::bigint and coalesce((e ->> 'pos_transfer')::bigint, 0) = (q.new_val ->> 'ck')::bigint end)
$$;

-- yêu cầu mới nhất của từng ô (đang chờ / đã duyệt / bị từ chối) — cho giao diện
create or replace function public.app__stc_fix_json(p_report bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(q.field, jsonb_build_object('id', q.id, 'status', q.status, 'old', q.old_val, 'new', q.new_val, 'reason', q.reason,
           'by', coalesce(public.app__acc_name(q.created_by), ''), 'at', q.created_at,
           'decided_by', coalesce(public.app__acc_name(q.decided_by), ''), 'decided_at', q.decided_at, 'note', q.decide_note)), '{}'::jsonb)
    from (select distinct on (x.field) x.* from public.stc_fix_requests x where x.report_id = p_report order by x.field, x.id desc) q
   where q.status in ('cho', 'duyet', 'tu_choi')
$$;

-- ghi số đã duyệt vào phiếu (đúng đường của nút "Lấy số máy Fabi")
create or replace function public.app__stc_fix_apply(p_req bigint) returns void
language plpgsql security definer set search_path = public as $$
declare q public.stc_fix_requests; e jsonb; fld jsonb; nv jsonb;
begin
  select * into q from public.stc_fix_requests where id = p_req;
  e := public.app__ca_eff(q.report_id);
  if q.field = 'mo' then fld := jsonb_build_object('ipos_opening', (q.new_val ->> 'val')::bigint, 'opening_cash', (q.new_val ->> 'val')::bigint);
  elsif q.field = 'no' then fld := jsonb_build_object('pos_debt', (q.new_val ->> 'val')::bigint);
  else
    nv := q.new_val || jsonb_build_object('total', (q.new_val ->> 'tm')::bigint + (q.new_val ->> 'ck')::bigint + coalesce((e ->> 'pos_debt')::bigint, 0));
    update public.stc_fix_requests set new_val = nv where id = q.id;
    fld := jsonb_build_object('pos_cash', (nv ->> 'tm')::bigint, 'pos_transfer', (nv ->> 'ck')::bigint, 'total_revenue', (nv ->> 'total')::bigint);
  end if;
  perform public.app_ca_recon_apply(q.report_id, jsonb_build_object('fields', fld), 'Chủ duyệt số sửa (máy Fabi ghi sai): ' || coalesce(q.reason, ''));
end $$;

create or replace function public.app__stc_fix_label(p_field text) returns text language sql immutable as $$
  select case p_field when 'mo' then 'Tiền mở ca' when 'dt' then 'Doanh thu' else 'Nợ bill' end
$$;

-- cột của bản đối soát thuộc ô nào có số Chủ đã duyệt → kế toán tải lại file Fabi không ghi đè (thiết kế mục 15)
create or replace function public.app__stc_fix_locks(p_report bigint, p_col text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stc_fix_requests q where q.report_id = p_report and q.status = 'duyet'
    and q.field = case when p_col in ('opening_cash', 'ipos_opening') then 'mo' when p_col in ('total_revenue', 'pos_cash', 'pos_transfer') then 'dt'
                       when p_col = 'pos_debt' then 'no' end)
$$;
revoke all on function public.app__stc_fix_locks(bigint, text) from public, anon, authenticated;
revoke all on function public.app__stc_fix_cur(bigint, text) from public, anon, authenticated;
revoke all on function public.app__stc_fix_ok(bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.app__stc_fix_json(bigint) from public, anon, authenticated;
revoke all on function public.app__stc_fix_apply(bigint) from public, anon, authenticated;

-- ---- Gửi số sửa (Chủ gửi = duyệt ngay). p: ô mo / no → {val}; ô dt → {tm, ck}.
create or replace function public.app_stc_fix_request(p_report bigint, p_field text, p jsonb, p_reason text) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports; s jsonb; rs text; nv jsonb; chu boolean; nid bigint; acc record; v1 bigint; v2 bigint;
begin
  r := public.app__stc_ds_need(p_report, true);
  rs := public.app__stc_reason(p_reason);
  if coalesce(p_field, '') not in ('mo', 'dt', 'no') then raise exception 'Ô cần sửa không hợp lệ.'; end if;
  s := public.app__stc_ds_state(p_report);
  if not coalesce((s ->> 'has_fabi')::boolean, false) then raise exception 'Chưa có file Fabi của ca này — chờ kế toán tải lên.'; end if;
  chu := coalesce(a.system_role, '') = 'chu';
  if p_field = 'dt' then
    v1 := case when (p ->> 'tm') ~ '^[0-9]+$' then (p ->> 'tm')::bigint end; v2 := case when (p ->> 'ck') ~ '^[0-9]+$' then (p ->> 'ck')::bigint end;
    if v1 is null or v2 is null then raise exception 'Nhập số bán tiền mặt và bán chuyển khoản (số không âm).'; end if;
    nv := jsonb_build_object('tm', v1, 'ck', v2);
  else
    v1 := case when (p ->> 'val') ~ '^[0-9]+$' then (p ->> 'val')::bigint end;
    if v1 is null then raise exception 'Nhập số đúng (số không âm).'; end if;
    nv := jsonb_build_object('val', v1);
  end if;
  perform 1 from public.shift_reports where id = p_report for update;
  if exists (select 1 from public.stc_fix_requests where report_id = p_report and field = p_field and status = 'cho') then
    raise exception 'Ô % đang chờ Chủ duyệt — bấm Bỏ sửa trước khi gửi lại.', public.app__stc_fix_label(p_field);
  end if;
  if exists (select 1 from public.stc_fix_requests where report_id = p_report and field = p_field and status = 'duyet') then
    if not chu then raise exception 'Chủ đã duyệt số cho ô % — chỉ Chủ bỏ được.', public.app__stc_fix_label(p_field); end if;
    update public.stc_fix_requests set status = 'bo', decided_by = a.id, decided_at = public.vn_now_text() where report_id = p_report and field = p_field and status = 'duyet';
  end if;
  insert into public.stc_fix_requests(report_id, field, old_val, new_val, reason, status, created_by, decided_by, decided_at)
  values (p_report, p_field, public.app__stc_fix_cur(p_report, p_field), nv, rs, case when chu then 'duyet' else 'cho' end, a.id,
          case when chu then a.id end, case when chu then public.vn_now_text() end)
  returning id into nid;
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
  values (p_report, case when chu then 'sua_so_fabi_duyet' else 'sua_so_fabi_gui' end, p_field, public.app__stc_fix_cur(p_report, p_field), nv, rs, a.id);
  if chu then
    perform public.app__stc_fix_apply(nid);
  else
    for acc in select x.id from public.accounts x where x.system_role = 'chu' and coalesce(x.locked, 0) = 0 loop
      perform public.app__notify(acc.id, 'Số sửa chờ Chủ duyệt',
        format('%s ca %s %s: %s · lý do: %s', public.app__stc_fix_label(p_field), r.shift, to_char(r.work_date::date, 'DD/MM'), coalesce(a.login_name, ''), rs),
        '#/quan-ly/so-thu-chi?tab=doi-soat&cn=' || r.branch_id || '&thang=' || left(r.work_date, 7) || '&ds=' || r.id || '&b=1');
    end loop;
  end if;
  perform public.app_log('stc_sua_so_fabi', 'report=' || p_report || ' ' || p_field || ' ' || nv::text || case when chu then ' · Chủ tự duyệt' else ' · chờ Chủ' end);
  return nid;
end $$;

-- ---- Bỏ sửa: yêu cầu đang chờ / bị từ chối → người đối soát ca bỏ được; số Chủ đã duyệt → chỉ Chủ. Số trên phiếu giữ nguyên.
create or replace function public.app_stc_fix_cancel(p_req bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); q public.stc_fix_requests;
begin
  select * into q from public.stc_fix_requests where id = p_req for update;
  if q.id is null then raise exception 'Không tìm thấy yêu cầu sửa số.'; end if;
  perform public.app__stc_ds_need(q.report_id, true);
  if q.status = 'duyet' and coalesce(a.system_role, '') <> 'chu' then raise exception 'Chỉ Chủ bỏ được số Chủ đã duyệt.'; end if;
  if q.status not in ('cho', 'duyet', 'tu_choi') then raise exception 'Yêu cầu này đã xong.'; end if;
  update public.stc_fix_requests set status = 'bo', decided_by = a.id, decided_at = public.vn_now_text() where id = q.id;
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
  values (q.report_id, 'sua_so_fabi_bo', q.field, q.new_val, null, 'Bỏ sửa số (' || q.status || ')', a.id);
  perform public.app_log('stc_bo_sua_so_fabi', 'req=' || q.id || ' ' || q.field);
end $$;

-- ---- Chủ duyệt / từ chối
create or replace function public.app_stc_fix_decide(p_req bigint, p_ok boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); q public.stc_fix_requests; r public.shift_reports;
begin
  if a.id is null or coalesce(a.system_role, '') <> 'chu' then raise exception 'Chỉ Chủ duyệt / từ chối số sửa.'; end if;
  select * into q from public.stc_fix_requests where id = p_req for update;
  if q.id is null then raise exception 'Không tìm thấy yêu cầu sửa số.'; end if;
  r := public.app__stc_ds_need(q.report_id, true);
  if q.status <> 'cho' then raise exception 'Yêu cầu này không còn chờ duyệt.'; end if;
  update public.stc_fix_requests set status = case when coalesce(p_ok, false) then 'duyet' else 'tu_choi' end, decided_by = a.id, decided_at = public.vn_now_text(),
         decide_note = nullif(btrim(coalesce(p_note, '')), '') where id = q.id;
  if coalesce(p_ok, false) then perform public.app__stc_fix_apply(q.id); end if;
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
  values (q.report_id, case when coalesce(p_ok, false) then 'sua_so_fabi_duyet' else 'sua_so_fabi_tu_choi' end, q.field, q.old_val, q.new_val,
          coalesce(nullif(btrim(coalesce(p_note, '')), ''), case when coalesce(p_ok, false) then 'Chủ duyệt' else 'Chủ từ chối' end), a.id);
  if q.created_by is not null and q.created_by <> a.id then
    perform public.app__notify(q.created_by, case when coalesce(p_ok, false) then 'Chủ đã duyệt số sửa' else 'Chủ từ chối số sửa' end,
      format('%s ca %s %s%s', public.app__stc_fix_label(q.field), r.shift, to_char(r.work_date::date, 'DD/MM'), coalesce(' · ' || nullif(btrim(coalesce(p_note, '')), ''), '')),
      '#/quan-ly/so-thu-chi?tab=doi-soat&cn=' || r.branch_id || '&thang=' || left(r.work_date, 7) || '&ds=' || r.id || '&b=1');
  end if;
  perform public.app_log('stc_duyet_sua_so_fabi', 'req=' || q.id || ' ' || case when coalesce(p_ok, false) then 'duyệt' else 'từ chối' end);
end $$;

revoke all on function public.app_stc_fix_request(bigint, text, jsonb, text) from public, anon;
revoke all on function public.app_stc_fix_cancel(bigint) from public, anon;
revoke all on function public.app_stc_fix_decide(bigint, boolean, text) from public, anon;
grant execute on function public.app_stc_fix_request(bigint, text, jsonb, text) to authenticated;
grant execute on function public.app_stc_fix_cancel(bigint) to authenticated;
grant execute on function public.app_stc_fix_decide(bigint, boolean, text) to authenticated;

-- ---- Vá bằng thay chuỗi (giữ mọi phần khác): app__stc_ds_state (ô khớp theo số Chủ đã duyệt, trả 'fix'), app_stc_ds_close (VÙNG KHOÁ: chặn khi chờ / bị từ chối),
--      app_stc_month (mỗi ca trả 'fixes').
do $$
declare d text; pairs text[][]; i int;
begin
  d := pg_get_functiondef('public.app__stc_ds_state(bigint)'::regprocedure);
  if position('app__stc_fix_ok' in d) = 0 then
    pairs := array[
      array[$q$'mo1', f is null or nv_open is not distinct from (f ->> 'dau')::bigint,$q$,
            $q$'mo1', f is null or nv_open is not distinct from (f ->> 'dau')::bigint or public.app__stc_fix_ok(p_report, 'mo', e),$q$],
      array[$q$coalesce((f ->> 'dau')::bigint, nv_open) is not distinct from (x ->> 'exp')::bigint$q$,
            $q$coalesce(case when public.app__stc_fix_ok(p_report, 'mo', e) then nv_open end, (f ->> 'dau')::bigint, nv_open) is not distinct from (x ->> 'exp')::bigint$q$],
      array[$q$'dt', f is null or (e ->> 'total_revenue')::bigint is not distinct from (f ->> 'net')::bigint,$q$,
            $q$'dt', f is null or (e ->> 'total_revenue')::bigint is not distinct from (f ->> 'net')::bigint or public.app__stc_fix_ok(p_report, 'dt', e),$q$],
      array[$q$'no', f is null or coalesce((e ->> 'pos_debt')::bigint, 0) = coalesce((f ->> 'no')::bigint, 0),$q$,
            $q$'no', f is null or coalesce((e ->> 'pos_debt')::bigint, 0) = coalesce((f ->> 'no')::bigint, 0) or public.app__stc_fix_ok(p_report, 'no', e),$q$],
      array[$q$'need_tm', r.cash_mode = 'ca' and r.ql_counted is null);$q$,
            $q$'need_tm', r.cash_mode = 'ca' and r.ql_counted is null, 'fix', public.app__stc_fix_json(p_report));$q$]];
    for i in 1 .. array_length(pairs, 1) loop
      if length(d) - length(replace(d, pairs[i][1], '')) <> length(pairs[i][1]) then raise exception 'app__stc_ds_state: không thấy đúng một chỗ vá số %.', i; end if;
      d := replace(d, pairs[i][1], pairs[i][2]);
    end loop;
    execute d;
  end if;

  d := pg_get_functiondef('public.app_stc_ds_close(bigint)'::regprocedure);
  if position('stc_fix_requests' in d) = 0 then
    if position($q$s := public.app__stc_ds_state(p_report);$q$ in d) = 0 then raise exception 'app_stc_ds_close: không thấy chỗ vá (sửa số).'; end if;
    execute replace(d, $q$s := public.app__stc_ds_state(p_report);$q$, $q$s := public.app__stc_ds_state(p_report);
  -- bước 173: số sửa (máy Fabi ghi sai) đang chờ Chủ duyệt / bị Chủ từ chối → chưa xác nhận được
  if exists (select 1 from public.stc_fix_requests q where q.report_id = p_report and q.status = 'cho') then
    raise exception 'Còn số sửa chờ Chủ duyệt — Chủ duyệt xong mới xác nhận.';
  end if;
  if exists (select 1 from (select distinct on (q.field) q.status from public.stc_fix_requests q where q.report_id = p_report order by q.field, q.id desc) z where z.status = 'tu_choi') then
    raise exception 'Chủ đã từ chối số sửa — sửa lại số hoặc bấm "Bỏ sửa, lấy số máy Fabi" rồi mới xác nhận.';
  end if;$q$);
  end if;

  -- app__fabi_apply (kế toán tải file Fabi): "bản đối soát phải theo Fabi" — bỏ qua cột thuộc ô có số Chủ đã duyệt; giữ mọi đoạn khác (bước 151, 162…)
  d := pg_get_functiondef('public.app__fabi_apply(text)'::regprocedure);
  if position('app__stc_fix_locks' in d) = 0 then
    if length(d) - length(replace(d, $q$if fv is not null and fv is distinct from ev then$q$, '')) <> length($q$if fv is not null and fv is distinct from ev then$q$) then
      raise exception 'app__fabi_apply: không thấy đúng một chỗ vá (số Chủ đã duyệt).';
    end if;
    execute replace(d, $q$if fv is not null and fv is distinct from ev then$q$,
      $q$if fv is not null and fv is distinct from ev and not public.app__stc_fix_locks(r.id, k) then   -- bước 173: giữ số Chủ đã duyệt$q$);
  end if;

  d := pg_get_functiondef('public.app_stc_month(bigint,text)'::regprocedure);
  if position('app__stc_fix_json' in d) = 0 then
    if length(d) - length(replace(d, $q$'ticks', coalesce((select jsonb_agg(tk.item$q$, '')) <> length($q$'ticks', coalesce((select jsonb_agg(tk.item$q$) then
      raise exception 'app_stc_month: không thấy đúng một chỗ chèn (fixes) — cần tệp 150.';
    end if;
    execute replace(d, $q$'ticks', coalesce((select jsonb_agg(tk.item$q$, $q$'fixes', public.app__stc_fix_json(r.id), 'ticks', coalesce((select jsonb_agg(tk.item$q$);
  end if;
end $$;

insert into public.app_migrations(file) values ('153_sua_so_fabi.sql') on conflict (file) do nothing;
