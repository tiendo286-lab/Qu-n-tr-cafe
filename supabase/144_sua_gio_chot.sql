-- 144: Giờ chốt ca theo file Fabi + sửa tay khi chưa có file (bước 162, 19/11/2026)
-- Thiết kế: tai_lieu/superpowers/specs/2026-11-19-sua-gio-chot-ca-design.md (2 mục "Cập nhật" cuối tệp)
-- - Có file Fabi → giờ chốt (rev_end) = giờ đóng ca muộn nhất trong file; tự áp mỗi lần file được áp vào ca (app__fabi_apply).
-- - Chưa có file → Chủ / Quản lý tổng / quản lý đối soát của cơ sở sửa tay (app__stc_ds_need), bắt lý do.
-- - Ca sau (cùng ngày, Sáng → Chiều → Tối) đã gửi phiếu thì giờ bắt đầu đổi theo. Không đổi tiền, không bỏ dấu đã duyệt.
-- Chạy lại nhiều lần không sao. Không tự chạy bù ca cũ (gọi app__ca_gio_fabi_all(false) riêng sau khi anh Tiến duyệt danh sách).

-- Ca kế tiếp trong chuỗi cùng ngày, cùng cơ sở (không có → bản ghi rỗng, id null)
create or replace function public.app__ca_next_report(r public.shift_reports) returns public.shift_reports
language plpgsql stable security definer set search_path = public as $$
declare s text[] := public.app__shifts(); i int; nx public.shift_reports;
begin
  if r.id is null or not public.app__ca_chain(r.shift) then return nx; end if;
  i := array_position(s, r.shift);
  if i is null or i >= coalesce(array_length(s, 1), 0) or not public.app__ca_chain(s[i + 1]) then return nx; end if;
  select * into nx from public.shift_reports where branch_id = r.branch_id and work_date = r.work_date and shift = s[i + 1];
  return nx;
end $$;

-- Giờ đóng ca trong file Fabi (muộn nhất, phòng khi chốt bổ sung có nhiều file)
create or replace function public.app__ca_gio_fabi_close(r public.shift_reports) returns text
language sql stable security definer set search_path = public as $$
  select max(f.close_at) from public.fabi_shifts f
   where f.branch_id = r.branch_id and f.work_date = r.work_date and f.shift = r.shift and nullif(f.close_at, '') is not null
$$;

-- Kiểm giờ chốt mới: trả chữ lỗi hoặc null
create or replace function public.app__ca_gio_check(r public.shift_reports, p_end text) returns text
language plpgsql stable security definer set search_path = public as $$
declare st text; nx public.shift_reports; ne text;
begin
  if p_end is null or p_end !~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$' then return 'Giờ chốt không hợp lệ.'; end if;
  begin perform p_end::timestamp; exception when others then return 'Giờ chốt không hợp lệ.'; end;
  st := public.app__ca_eff(r.id) ->> 'rev_start';
  if st is not null and p_end <= st then return 'Giờ chốt phải sau giờ bắt đầu ca (' || right(st, 5) || ').'; end if;
  nx := public.app__ca_next_report(r);
  if nx.id is not null and nx.status = 'hoan_thanh' then
    ne := public.app__ca_eff(nx.id) ->> 'rev_end';
    if ne is not null and p_end >= ne then return 'Giờ chốt phải trước giờ chốt ca ' || nx.shift || ' (' || right(ne, 5) || ').'; end if;
  end if;
  return null;
end $$;

-- Khoá ghi bản đối soát khi phiếu chờ kế toán (tệp 104): thêm lối riêng CHỈ CHO GIỜ, chỉ trong giao dịch của app__ca_gio_set
-- (set_config('app.ca_gio', <ca>, true)). Lối này chỉ cho qua khi ngoài rev_start / rev_end ra dữ liệu không đổi → tiền vẫn bị khoá.
-- Ai định nghĩa lại hàm này sau này phải giữ cả 2 lối (app.fabi_report và app.ca_gio).
create or replace function public.app__ca_recon_write_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid bigint := coalesce(NEW.report_id, OLD.report_id);
begin
  if current_setting('app.fabi_report', true) = rid::text then return NEW; end if;
  if current_setting('app.ca_gio', true) = rid::text then   -- bước 162 (tệp 144)
    if TG_OP = 'INSERT' and NEW.data = public.app__recon_snapshot(rid) then return NEW; end if;
    if TG_OP = 'UPDATE' and (NEW.data - 'rev_start' - 'rev_end') = (OLD.data - 'rev_start' - 'rev_end') then return NEW; end if;
  end if;
  perform public.app__ca_recon_require_ready(rid);
  return NEW;
end $$;

-- Khoá ghi lịch sử / ảnh / phân loại của ca đã gửi khi chờ kế toán: thêm lối riêng chỉ cho 3 loại dòng lịch sử giờ, chỉ trong app__ca_gio_set.
-- Giữ nguyên bản đang chạy (bước 131), chỉ thêm khối "bước 162". Ai định nghĩa lại phải giữ khối này.
create or replace function public.app__ca_completed_source_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid bigint;
begin
  rid:=case when TG_OP='DELETE' then OLD.report_id else NEW.report_id end;
  if current_setting('app.fabi_report',true)=rid::text then return case when TG_OP='DELETE' then OLD else NEW end; end if;
  if current_setting('app.ca_submit_report',true)=rid::text then return case when TG_OP='DELETE' then OLD else NEW end; end if;
  if TG_TABLE_NAME='shift_recon_log' and TG_OP='INSERT' then   -- bước 131: lịch sử kế toán nhập số liệu (tách 2 tầng: bảng khác không có cột action)
    if NEW.action='ke_toan' then return NEW; end if;
    if NEW.action in ('sua_gio','gio_fabi','sua_gio_theo') and current_setting('app.ca_gio',true)=rid::text then return NEW; end if;   -- bước 162 (tệp 144)
  end if;
  if exists(select 1 from public.shift_reports r where r.id=rid and r.status='hoan_thanh') then
    perform public.app__ca_recon_require_ready(rid);
  end if;
  return case when TG_OP='DELETE' then OLD else NEW end;
end $$;

-- Đặt giờ chốt + kéo giờ bắt đầu ca sau + ghi lịch sử (không kiểm quyền — người gọi kiểm)
create or replace function public.app__ca_gio_set(p_report bigint, p_end text, p_action text, p_reason text, p_by bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; nx public.shift_reports; err text; old text; ost text; nxt jsonb;
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy ca.'; end if;
  err := public.app__ca_gio_check(r, p_end);
  if err is not null then raise exception '%', err; end if;
  old := public.app__ca_eff(r.id) ->> 'rev_end';
  if old is not distinct from p_end then return jsonb_build_object('changed', false, 'rev_end', p_end, 'next', null); end if;
  perform set_config('app.ca_gio', r.id::text, true);
  insert into public.shift_report_recon(report_id, data, updated_by) values (r.id, public.app__recon_snapshot(r.id), p_by) on conflict (report_id) do nothing;
  update public.shift_report_recon set data = data || jsonb_build_object('rev_end', p_end), updated_by = p_by, updated_at = public.vn_now_text() where report_id = r.id;
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
  values (r.id, p_action, 'rev_end', to_jsonb(old), to_jsonb(p_end), p_reason, p_by);
  nx := public.app__ca_next_report(r);
  if nx.id is not null and nx.status = 'hoan_thanh' then
    ost := public.app__ca_eff(nx.id) ->> 'rev_start';
    if ost is distinct from p_end then
      perform set_config('app.ca_gio', nx.id::text, true);
      insert into public.shift_report_recon(report_id, data, updated_by) values (nx.id, public.app__recon_snapshot(nx.id), p_by) on conflict (report_id) do nothing;
      update public.shift_report_recon set data = data || jsonb_build_object('rev_start', p_end), updated_by = p_by, updated_at = public.vn_now_text() where report_id = nx.id;
      insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
      values (nx.id, 'sua_gio_theo', 'rev_start', to_jsonb(ost), to_jsonb(p_end), 'Theo giờ chốt ca ' || r.shift, p_by);
      nxt := jsonb_build_object('shift', nx.shift, 'from', ost, 'to', p_end);
    end if;
  end if;
  perform set_config('app.ca_gio', '', true);
  return jsonb_build_object('changed', true, 'rev_end', p_end, 'next', nxt);
end $$;

-- Tự lấy giờ theo file Fabi (gọi từ app__fabi_apply). Giờ file vô lý → bỏ qua, không làm hỏng việc tải file.
create or replace function public.app__ca_gio_fabi(p_report bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; fc text; acc bigint;
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null or r.status <> 'hoan_thanh' then return; end if;
  fc := public.app__ca_gio_fabi_close(r);
  if fc is null then return; end if;
  begin acc := (public.app_account()).id; exception when others then acc := null; end;
  begin
    perform public.app__ca_gio_set(r.id, fc, 'gio_fabi', 'Theo file Fabi', acc);
  exception when others then null;
  end;
end $$;

-- Đọc giờ của ca cho dòng giờ / ô sửa
create or replace function public.app_ca_gio(p_report bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.shift_reports; nx public.shift_reports; e jsonb; fc text; bad boolean; byf boolean; can boolean := false; nobj jsonb;
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy ca.'; end if;
  if not coalesce(public.app__stc_can(r.branch_id), false) then raise exception 'Không có quyền xem ca này.'; end if;
  e := public.app__ca_eff(r.id);
  fc := public.app__ca_gio_fabi_close(r);
  bad := fc is not null and public.app__ca_gio_check(r, fc) is not null;
  byf := fc is not null and not bad;
  if not byf and r.status = 'hoan_thanh' then
    begin perform public.app__stc_ds_need(r.id, false); can := true; exception when others then can := false; end;
  end if;
  nx := public.app__ca_next_report(r);
  if nx.id is not null then
    nobj := jsonb_build_object('id', nx.id, 'shift', nx.shift, 'submitted', nx.status = 'hoan_thanh',
      'rev_start', case when nx.status = 'hoan_thanh' then public.app__ca_eff(nx.id) ->> 'rev_start' end,
      'rev_end', case when nx.status = 'hoan_thanh' then public.app__ca_eff(nx.id) ->> 'rev_end' end);
  end if;
  return jsonb_build_object('id', r.id, 'shift', r.shift, 'date', r.work_date, 'status', r.status,
    'rev_start', e ->> 'rev_start', 'rev_end', e ->> 'rev_end', 'fabi_close', fc, 'by_fabi', byf, 'fabi_bad', bad,
    'next', nobj, 'can_edit', can,
    'log', coalesce((select jsonb_agg(x order by x.id desc) from (
        select l.id, l.at, coalesce(a.display_name, a.login_name, 'Hệ thống') by_name, l.action, l.before, l.after, l.reason
          from public.shift_recon_log l left join public.accounts a on a.id = l.by_account
         where l.report_id = r.id and l.action in ('sua_gio', 'gio_fabi', 'sua_gio_theo')
         order by l.id desc limit 10) x), '[]'::jsonb));
end $$;

-- Sửa tay (chỉ khi ca chưa có file Fabi hợp lệ)
create or replace function public.app_ca_gio_save(p_report bigint, p_end text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; fc text; j jsonb; old text;
begin
  r := public.app__stc_ds_need(p_report, false);
  fc := public.app__ca_gio_fabi_close(r);
  if fc is not null and public.app__ca_gio_check(r, fc) is null then raise exception 'Ca đã có file Fabi — giờ chốt lấy theo file.'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Phải ghi lý do sửa giờ.'; end if;
  old := public.app__ca_eff(r.id) ->> 'rev_end';
  j := public.app__ca_gio_set(r.id, p_end, 'sua_gio', btrim(p_reason), (public.app_account()).id);
  if (j ->> 'changed')::boolean then
    perform public.app_log('sua_gio_chot', 'report=' || r.id || ' ' || coalesce(old, '?') || ' → ' || p_end || ' · ' || btrim(p_reason));
  end if;
  return j;
end $$;

-- Chạy bù: ca tháng chưa chốt có file Fabi khác giờ. p_dry = chỉ liệt kê.
create or replace function public.app__ca_gio_fabi_all(p_dry boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; nx public.shift_reports; fc text; en text; bad boolean; out jsonb := '[]'; n int := 0;
begin
  for r in select s.* from public.shift_reports s
            where s.status = 'hoan_thanh' and not public.app__fin_locked(s.branch_id, s.work_date)
              and exists (select 1 from public.fabi_shifts f where f.branch_id = s.branch_id and f.work_date = s.work_date and f.shift = s.shift and nullif(f.close_at, '') is not null)
            order by s.work_date, s.branch_id, array_position(public.app__shifts(), s.shift) loop
    fc := public.app__ca_gio_fabi_close(r);
    en := public.app__ca_eff(r.id) ->> 'rev_end';
    if fc is null or fc is not distinct from en then continue; end if;
    if p_dry then
      bad := public.app__ca_gio_check(r, fc) is not null;
      nx := public.app__ca_next_report(r);
      out := out || jsonb_build_object('report', r.id, 'branch', (select coalesce(b.display_code, b.code) from public.branches b where b.id = r.branch_id),
        'date', r.work_date, 'shift', r.shift, 'from', en, 'to', fc, 'bad', bad,
        'next_shift', case when nx.id is not null and nx.status = 'hoan_thanh' then nx.shift end,
        'next_from', case when nx.id is not null and nx.status = 'hoan_thanh' then public.app__ca_eff(nx.id) ->> 'rev_start' end);
    else
      perform public.app__ca_gio_fabi(r.id); n := n + 1;
    end if;
  end loop;
  return case when p_dry then out else jsonb_build_object('applied', n) end;
end $$;

-- Gắn tự lấy giờ vào app__fabi_apply (chạy cả lúc kế toán tải file lẫn lúc nhân viên gửi phiếu). Vá bản đang chạy, giữ đoạn vá của tệp 135.
do $$
declare d text; tgt text := E'  update public.fabi_shifts set report_id = r.id, diff = v_diff, fixed = fabi_shifts.fixed || v_fixed where ma_ca = p_ma;\n  return jsonb_build_object(''status'', st,';
begin
  d := pg_get_functiondef('public.app__fabi_apply(text)'::regprocedure);
  if position('app__ca_gio_fabi' in d) > 0 then return; end if;
  if position(tgt in d) = 0 then raise exception 'Tệp 144: không tìm thấy chỗ vá trong app__fabi_apply'; end if;
  execute replace(d, tgt, E'  perform public.app__ca_gio_fabi(r.id);   -- bước 162 (tệp 144): giờ chốt theo file Fabi\n' || tgt);
end $$;

revoke all on function public.app__ca_next_report(public.shift_reports), public.app__ca_gio_fabi_close(public.shift_reports),
  public.app__ca_gio_check(public.shift_reports, text), public.app__ca_gio_set(bigint, text, text, text, bigint),
  public.app__ca_gio_fabi(bigint), public.app__ca_gio_fabi_all(boolean) from public, anon, authenticated;
revoke all on function public.app_ca_gio(bigint), public.app_ca_gio_save(bigint, text, text) from public, anon;
grant execute on function public.app_ca_gio(bigint), public.app_ca_gio_save(bigint, text, text) to authenticated;

insert into public.app_migrations(file) values ('144_sua_gio_chot.sql') on conflict (file) do nothing;
