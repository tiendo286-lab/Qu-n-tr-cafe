-- =====================================================================
-- BƯỚC 60: TĂNG TỐC — Giai đoạn 2 rà soát (13/11/2026). Chạy sau 59. Chạy lại không sao.
--  1. Chỉ mục cho mọi cột nối bảng (khóa ngoại 1 cột) chưa có chỉ mục (65 cột lúc rà soát).
--  2. app__ca_kt_state gọn: đếm tài khoản ngân hàng trực tiếp (trước dựng cả phiếu qua app__kt_bank_json chỉ để đếm)
--     → nhanh "Ca chờ kế toán", Bảng ca, Đối soát, File Fabi.
--  3. app_cv_todo: tính người nghỉ / hỗ trợ 1 lần mỗi ca, chỉ xét trạng thái ca có người nghỉ / hỗ trợ (trước dựng phiếu 4 lần / ca).
--  4. Gộp bảng tuần thành 1 lần gọi: app_ds_week (tab Đối soát), app_kt_bank_week (Chuyển khoản thực nhận).
--  5. app_ca_money: trang Đối soát ca lấy số tiền do máy chủ tính sau mỗi lần lưu (1 chỗ tính duy nhất).
-- =====================================================================

-- ---------------------------------------------------------------- 1. Chỉ mục khóa ngoại
do $ix$
declare x record; nm text;
begin
  for x in select cl.relname tbl, a.attname col
             from pg_constraint co join pg_class cl on cl.oid = co.conrelid join pg_namespace n on n.oid = cl.relnamespace
             join pg_attribute a on a.attrelid = co.conrelid and a.attnum = co.conkey[1]
            where co.contype = 'f' and n.nspname = 'public' and array_length(co.conkey, 1) = 1
              and not exists (select 1 from pg_index i where i.indrelid = co.conrelid and i.indkey[0] = co.conkey[1]) loop
    nm := left('ix_' || x.tbl || '_' || x.col, 63);
    execute format('create index if not exists %I on public.%I (%I)', nm, x.tbl, x.col);
  end loop;
end $ix$;
create index if not exists ix_shift_reports_recon_open on public.shift_reports (work_date) where recon_status <> 'hoan_thanh';

-- ---------------------------------------------------------------- 2. Tình trạng kế toán (gọn)
create or replace function public.app__ca_kt_state(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.shift_reports; need boolean; has_fabi boolean; n_acc int; n_in int; bank_ok boolean; miss text[] := '{}';
begin
  select * into r from public.shift_reports where id = p_id;
  if r.id is null then return null; end if;
  need := exists (select 1 from public.fabi_stores f where f.branch_id = r.branch_id);
  has_fabi := exists (select 1 from public.fabi_shifts f where f.report_id = r.id
                       or (f.branch_id = r.branch_id and f.work_date = r.work_date and f.shift = r.shift));
  -- cùng cách đếm với app__kt_bank_json: tài khoản đang dùng của cơ sở + tài khoản đã có số dư ở phiếu này
  select count(*), count(*) filter (where x.opening is not null and x.closing is not null) into n_acc, n_in
    from public.bank_accounts k left join public.bank_account_balances x on x.report_id = r.id and x.account_id = k.id
   where k.branch_id = r.branch_id and (k.active = 1 or x.report_id is not null);
  bank_ok := n_acc > 0 and n_in >= n_acc;
  if need then
    if not has_fabi then miss := miss || 'file chốt ca Fabi'::text; end if;
    if n_acc = 0 then miss := miss || 'chi nhánh chưa khai báo tài khoản ngân hàng'::text;
    elsif not bank_ok then miss := miss || ('chuyển khoản ngân hàng (' || n_in || '/' || n_acc || ' tài khoản)')::text; end if;
  end if;
  return jsonb_build_object('need', need, 'fabi', has_fabi, 'bank', bank_ok, 'bank_in', n_in, 'bank_accounts', n_acc,
    'ready', not need or (has_fabi and bank_ok), 'missing', to_jsonb(miss));
end $$;

-- ---------------------------------------------------------------- 3. Nghỉ / làm thay chờ xử lý (gọn)
create or replace function public.app_cv_todo() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('doi_soat');
  return coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'branch_id', q.branch_id, 'branch', q.branch, 'date', q.work_date, 'shift', q.shift,
            'state', q.st, 'absent', q.absent, 'helper', q.helper,
            'x2', (select string_agg(coalesce(e.code, c.helper_name), ', ') from public.shift_covers c left join public.employees e on e.id = c.helper_id where c.report_id = q.id and c.x2),
            'set_by', (select public.app__acc_name(v.set_by) from public.shift_cover_reviews v where v.report_id = q.id))
           order by q.work_date, array_position(public.app__shifts(), q.shift), q.sort_order)
      from (select r.id, r.branch_id, coalesce(b.display_code, b.code) branch, b.sort_order, r.work_date, r.shift, pp.absent, pp.helper, public.app__cv_state(r.id) st
              from public.shift_reports r join public.branches b on b.id = r.branch_id
              cross join lateral (select string_agg(e.code || ' – ' || e.name, ', ' order by e.code) filter (where p.kind = 'nghi') absent,
                                         string_agg(e.code || ' – ' || e.name, ', ' order by e.code) filter (where p.kind = 'ho_tro') helper, count(*) n
                                    from public.app__cv_people(r.id) p join public.employees e on e.id = p.employee_id) pp
             where r.status = 'hoan_thanh' and r.recon_status <> 'hoan_thanh' and r.work_date >= to_char(public.vn_now()::date - 60, 'YYYY-MM-DD') and pp.n > 0) q
     where q.st in ('chua_phan_loai', 'lech', 'cho_duyet')), '[]');
end $$;

-- ---------------------------------------------------------------- 4. Bảng tuần: 1 lần gọi
create or replace function public.app_ds_week(p_from text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date; out jsonb := '[]';
begin
  perform public.app__need('doi_soat');
  if coalesce(p_from, '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Ngày không hợp lệ.'; end if;
  for i in 0..6 loop
    d := p_from::date + i;
    out := out || jsonb_build_array(jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'ov', public.app_ca_overview(to_char(d, 'YYYY-MM-DD')),
             'cd', public.app_ca_day(to_char(d, 'YYYY-MM-DD'))));
  end loop;
  return jsonb_build_object('days', out, 'kt', public.app_ca_kt_wait());
end $$;

create or replace function public.app_kt_bank_week(p_from text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date; out jsonb := '[]';
begin
  perform public.app__need('ke_toan');
  if coalesce(p_from, '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Ngày không hợp lệ.'; end if;
  for i in 0..6 loop
    d := p_from::date + i;
    out := out || jsonb_build_array(jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'rows', public.app_kt_bank_day(to_char(d, 'YYYY-MM-DD'))));
  end loop;
  return out;
end $$;

-- ---------------------------------------------------------------- 5. Số tiền của ca do máy chủ tính (trang Đối soát ca)
create or replace function public.app_ca_money(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('doi_soat');
  return public.app__ca_money(p_id);
end $$;

-- ---------------------------------------------------------------- 6. Tự so 2 cách tính tiền (app__ca_money ↔ kiểm tra khi gửi phiếu)
-- Phiếu chưa có bản đối soát: tiền mặt / chuyển khoản còn lệch tính theo app__ca_money phải bằng cách tính ở app__ca_part_check.
create or replace function public.app__ca_money_selfcheck(p_days int default 45) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'tm_money', z.tm1, 'tm_check', z.tm2, 'ck_money', z.ck1, 'ck_check', z.ck2)), '[]')
    from (select r.id, (m ->> 'tm_left_self')::bigint tm1, (m ->> 'ck_left_nv')::bigint ck1,
                 r.cash_counted - r.opening_cash - r.pos_cash
                   - ((select coalesce(sum(amount), 0) from public.shift_report_moves where report_id = r.id and kind = 'tien_mat')
                      - (select coalesce(sum(cash_paid), 0) from public.shift_report_staff where report_id = r.id and worked = 1)
                      - (select coalesce(sum(amount), 0) from public.shift_debts where report_id = r.id and kind = 'muon'))
                   - (select coalesce(sum(amount), 0) from public.shift_debts where closed_report_id = r.id and collect_kind = 'tien_mat') tm2,
                 r.reported_transfer - r.pos_transfer
                   - (select coalesce(sum(amount), 0) from public.shift_report_moves where report_id = r.id and kind = 'chuyen_khoan')
                   - (select coalesce(sum(amount), 0) from public.shift_debts where closed_report_id = r.id and collect_kind = 'chuyen_khoan') ck2
            from public.shift_reports r cross join lateral (select public.app__ca_money(r.id) m) mm
           where r.status = 'hoan_thanh' and r.work_date >= to_char(public.vn_now()::date - p_days, 'YYYY-MM-DD')
             and not exists (select 1 from public.shift_report_recon x where x.report_id = r.id)) z
   where z.tm1 is distinct from z.tm2 or z.ck1 is distinct from z.ck2
$$;
-- hằng ngày 02:45: lệch thì ghi nhật ký + báo Chủ
create or replace function public.app__ca_money_selfcheck_job() returns void
language plpgsql security definer set search_path = public as $$
declare bad jsonb := public.app__ca_money_selfcheck(45); x bigint;
begin
  if jsonb_array_length(bad) = 0 then return; end if;
  insert into public.audit_log(account_id, action, detail) values (null, 'tu_kiem_tien_lech', bad::text);
  for x in select id from public.accounts where system_role = 'chu' and coalesce(locked, 0) = 0 loop
    perform public.app__notify(x, 'Tự kiểm tra: 2 cách tính tiền ca không khớp', jsonb_array_length(bad) || ' phiếu ca tính tiền lệch giữa 2 chỗ trên máy chủ — báo Claude kiểm tra (LOG hệ thống › tu_kiem_tien_lech).', '/quan-ly/log');
  end loop;
end $$;
do $cron$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'tu-kiem-tien';
  perform cron.schedule('tu-kiem-tien', '45 19 * * *', 'select public.app__ca_money_selfcheck_job()');   -- 02:45 giờ VN
end $cron$;
revoke execute on function public.app__ca_money_selfcheck(int), public.app__ca_money_selfcheck_job() from public, anon, authenticated;

revoke execute on function public.app__ca_kt_state(bigint) from public, anon, authenticated;
revoke execute on function public.app_cv_todo(), public.app_ds_week(text), public.app_kt_bank_week(text), public.app_ca_money(bigint) from public, anon;
grant execute on function public.app_cv_todo(), public.app_ds_week(text), public.app_kt_bank_week(text), public.app_ca_money(bigint) to authenticated;

insert into public.app_migrations(file) values ('60_tang_toc.sql') on conflict (file) do nothing;
