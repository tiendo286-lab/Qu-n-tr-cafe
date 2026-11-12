-- Bước 44 — Đối soát phần tiền chờ kế toán (anh Tiến chốt 12/11/2026, tài liệu 5o)
-- Phần tiền của phiếu ca (Thời gian, Doanh thu, Tiền mặt, Chuyển khoản, Thu chi, Công nợ) chỉ đối soát được khi kế toán đã có
-- ĐỦ 2 thứ: file chốt ca Fabi của ca đó (fabi_shifts) VÀ số dư ngân hàng của mọi tài khoản của chi nhánh trong ca (bank_account_balances).
-- Nhân sự, Bàn giao, Nhập hàng đối soát ngay. Phiếu do Chủ / quản lý tự gửi cũng chờ kế toán rồi đối soát như thường
-- (bỏ tự ghi "đã đối soát"). 10:00 sáng hôm sau báo kế toán các ca còn thiếu. Cơ sở không dùng Fabi (Lela Box) tạm không chờ.
-- Chạy lại nhiều lần không sao.

-- ---------------------------------------------------------------- Tình trạng kế toán của 1 phiếu
create or replace function public.app__ca_kt_state(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.shift_reports; need boolean; has_fabi boolean; b jsonb; n_acc int; n_in int; bank_ok boolean; miss text[] := '{}';
begin
  select * into r from public.shift_reports where id = p_id;
  if r.id is null then return null; end if;
  need := exists (select 1 from public.fabi_stores f where f.branch_id = r.branch_id);
  has_fabi := exists (select 1 from public.fabi_shifts f where f.report_id = r.id
                       or (f.branch_id = r.branch_id and f.work_date = r.work_date and f.shift = r.shift));
  b := public.app__kt_bank_json(r);
  n_acc := coalesce((b ->> 'account_count')::int, 0); n_in := coalesce((b ->> 'entered')::int, 0);
  bank_ok := n_acc > 0 and n_in >= n_acc;
  if need then
    if not has_fabi then miss := miss || 'file chốt ca Fabi'::text; end if;
    if n_acc = 0 then miss := miss || 'chi nhánh chưa khai báo tài khoản ngân hàng'::text;
    elsif not bank_ok then miss := miss || ('chuyển khoản ngân hàng (' || n_in || '/' || n_acc || ' tài khoản)')::text; end if;
  end if;
  return jsonb_build_object('need', need, 'fabi', has_fabi, 'bank', bank_ok, 'bank_in', n_in, 'bank_accounts', n_acc,
    'ready', not need or (has_fabi and bank_ok), 'missing', to_jsonb(miss));
end $$;

create or replace function public.app__ca_kt_items() returns text[]
language sql immutable as $$ select array['thoi_gian', 'doanh_thu', 'tien_mat', 'chuyen_khoan', 'thu_chi', 'cong_no'] $$;

-- ---------------------------------------------------------------- Chặn ghi kết quả phần tiền khi kế toán chưa đủ số
create or replace function public.app__ca_kt_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare k jsonb;
begin
  if NEW.item = any(public.app__ca_kt_items()) then
    k := public.app__ca_kt_state(NEW.report_id);
    if k is not null and not (k ->> 'ready')::boolean then
      raise exception 'Phần tiền chờ kế toán: còn thiếu %. Kế toán tải file chốt ca Fabi và nhập chuyển khoản ngân hàng của ca này rồi mới đối soát được.',
        (select string_agg(x, ', ') from jsonb_array_elements_text(k -> 'missing') x);
    end if;
  end if;
  return NEW;
end $$;
drop trigger if exists ca_kt_guard on public.shift_report_checks;
create trigger ca_kt_guard before insert or update on public.shift_report_checks for each row execute function public.app__ca_kt_guard();
drop trigger if exists ca_kt_guard on public.shift_report_results;
create trigger ca_kt_guard before insert or update on public.shift_report_results for each row execute function public.app__ca_kt_guard();

-- ---------------------------------------------------------------- Bỏ "quản lý tự làm phiếu → tự đối soát": ai gửi cũng đối soát như thường
create or replace function public.app__ca_auto_recon(p_id bigint, p_acc bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- ca không nhận hàng kho tổng: hạng mục Nhập hàng tự ghi đã đối soát
  if not exists (select 1 from public.delivery_invoices where received_report_id = p_id) then
    insert into public.shift_report_checks(report_id, item, checked_by, checked_at) values (p_id, 'nhap_hang', p_acc, public.vn_now_text())
    on conflict (report_id, item) do nothing;
  end if;
  perform public.app__ca_auto_finish(p_id, p_acc);
end $$;

-- ---------------------------------------------------------------- Cho web: tình trạng 1 phiếu + danh sách ca còn thiếu
create or replace function public.app_ca_kt_state(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need(null);
  if not (public.app_can('doi_soat') or public.app_can('ke_toan') or public.app_can('chot_ca')) then raise exception 'Bạn không có quyền thực hiện thao tác này.'; end if;
  return public.app__ca_kt_state(p_id);
end $$;

create or replace function public.app__ca_kt_list(p_from text, p_to text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'branch_id', r.branch_id, 'branch', coalesce(b.display_code, b.code), 'date', r.work_date, 'shift', r.shift,
           'status', r.status, 'recon_status', r.recon_status, 'fabi', (k ->> 'fabi')::boolean, 'bank', (k ->> 'bank')::boolean, 'missing', k -> 'missing')
           order by r.work_date, array_position(public.app__shifts(), r.shift), b.sort_order), '[]')
    from public.shift_reports r join public.branches b on b.id = r.branch_id
    cross join lateral (select public.app__ca_kt_state(r.id) k) kk
   where r.work_date between p_from and p_to and r.recon_status <> 'hoan_thanh' and public.app__ca_chain(r.shift)
     and (k ->> 'need')::boolean and not (k ->> 'ready')::boolean
$$;

create or replace function public.app_ca_kt_wait() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need(null);
  if not (public.app_can('doi_soat') or public.app_can('ke_toan')) then raise exception 'Bạn không có quyền thực hiện thao tác này.'; end if;
  return public.app__ca_kt_list(to_char(public.vn_now()::date - 45, 'YYYY-MM-DD'), to_char(public.vn_now()::date, 'YYYY-MM-DD'));
end $$;

-- ---------------------------------------------------------------- 10:00 sáng: báo kế toán các ca hôm trước còn thiếu
create or replace function public.app__kt_tick() returns void
language plpgsql security definer set search_path = public as $$
declare l jsonb; n int; body text; x bigint;
begin
  l := public.app__ca_kt_list(to_char(public.vn_now()::date - 14, 'YYYY-MM-DD'), to_char(public.vn_now()::date - 1, 'YYYY-MM-DD'));
  n := jsonb_array_length(l);
  if n = 0 then return; end if;
  select string_agg(e ->> 'branch' || ' ca ' || (e ->> 'shift') || ' ' || to_char((e ->> 'date')::date, 'DD/MM') || ': thiếu '
           || (select string_agg(m, ', ') from jsonb_array_elements_text(e -> 'missing') m), E'\n')
    into body from (select e from jsonb_array_elements(l) e limit 15) q;
  if n > 15 then body := body || E'\n… và ' || (n - 15) || ' ca nữa'; end if;
  for x in select a.id from public.accounts a
            where coalesce(a.locked, 0) = 0
              and (a.system_role = 'ke_toan' or exists (select 1 from public.account_perms p where p.account_id = a.id and p.perm = 'ke_toan')) loop
    perform public.app__notify(x, 'Còn ' || n || ' ca thiếu file Fabi / chuyển khoản ngân hàng', body, '/ke-toan/fabi');
  end loop;
end $$;

revoke execute on function public.app__ca_kt_state(bigint), public.app__ca_kt_guard(), public.app__ca_kt_list(text, text), public.app__kt_tick()
  from public, anon, authenticated;
revoke execute on function public.app_ca_kt_state(bigint), public.app_ca_kt_wait() from public, anon;
grant execute on function public.app_ca_kt_state(bigint), public.app_ca_kt_wait() to authenticated;
select cron.schedule('nhac-ke-toan', '0 3 * * *', 'select public.app__kt_tick()');   -- 10:00 giờ Việt Nam
