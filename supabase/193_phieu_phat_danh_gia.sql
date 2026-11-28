-- =====================================================================
-- TỆP 193: Phiếu phạt tiền đi kèm lần trừ điểm / nhắc nhở (anh Tiến chốt 28/11/2026).
-- Quản lý lập là có hiệu lực ngay. Web chỉ GHI LẠI và cộng tổng theo tháng — không tự trừ vào Sổ thu chi / khoản âm / bảng công.
-- Hoàn điểm hoặc xoá lần đánh giá = tiền phạt không còn tính (chỉ cộng dòng status = 'tru').
-- Quyền giữ nguyên (app__dg_need = quyền Đối soát), khoá tháng giữ nguyên (app__dg_open).
-- Các hàm dưới đây lấy từ bản đang chạy trên máy chủ (36, 38) rồi thêm phần tiền phạt. Chạy lại nhiều lần không sao.
-- =====================================================================

alter table public.eval_marks add column if not exists fine bigint not null default 0 check (fine >= 0);

-- ' · phạt 50.000đ' (rỗng khi không phạt)
create or replace function public.app__dg_fine_txt(p_fine bigint) returns text
language sql immutable as $$
  select case when coalesce(p_fine, 0) > 0 then ' · phạt ' || replace(to_char(p_fine, 'FM999,999,999,990'), ',', '.') || 'đ' else '' end
$$;

-- Tổng tiền phạt tháng của 1 nhân viên (chỉ lần còn hiệu lực)
create or replace function public.app__dg_fine(p_emp bigint, p_month text) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum(m.fine), 0)::bigint from public.eval_marks m
   where m.employee_id = p_emp and left(m.work_date, 7) = p_month and m.status = 'tru'
$$;

-- Hai hàm đổi tham số: bỏ bản cũ để không trùng tên (web cũ gọi không có p_fine vẫn chạy nhờ giá trị mặc định)
drop function if exists public.app_dg_add(bigint, text, text, integer, text, text, bigint, bigint, text);
drop function if exists public.app_dg_edit(bigint, text, integer, text);

CREATE OR REPLACE FUNCTION public.app__dg_json(m eval_marks)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('id', m.id, 'employee_id', m.employee_id, 'date', m.work_date, 'month', left(m.work_date, 7),
    'criterion', m.criterion, 'criterion_name', c.name, 'set_code', c.set_code, 'points', m.points, 'fine', m.fine, 'note', m.note, 'photo', m.photo_path,
    'report_id', m.report_id, 'shift', r.shift, 'branch_id', m.branch_id, 'branch', coalesce(b.display_code, b.code),
    'status', m.status, 'reply', m.reply, 'reply_at', m.reply_at,
    'reviewed_at', m.reviewed_at, 'reviewed_by', public.app__acc_name(m.reviewed_by), 'review_note', m.review_note,
    'pending', m.status = 'tru' and m.reply is not null and m.reviewed_at is null,
    'created_at', m.created_at, 'created_by', public.app__acc_name(m.created_by),
    'updated_at', m.updated_at, 'updated_by', public.app__acc_name(m.updated_by),
    'open', public.app__dg_open(left(m.work_date, 7)))
    from public.eval_criteria c
    left join public.shift_reports r on r.id = m.report_id
    left join public.branches b on b.id = m.branch_id
   where c.code = m.criterion
$function$;

CREATE OR REPLACE FUNCTION public.app_dg_add(p_employee bigint, p_date text, p_criterion text, p_points integer, p_note text, p_photo text, p_report bigint, p_branch bigint, p_set text, p_fine bigint DEFAULT 0)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; e public.employees; r public.shift_reports; d text := p_date; br bigint := p_branch;
        nt text := nullif(trim(coalesce(p_note, '')), ''); c public.eval_criteria; st text; nid bigint;
begin
  a := public.app__dg_need();
  select * into e from public.employees where id = p_employee;
  if e.id is null then raise exception 'Không tìm thấy nhân viên.'; end if;
  if a.employee_id is not null and a.employee_id = e.id then raise exception 'Không tự trừ điểm của mình được.'; end if;
  if p_report is not null then
    select * into r from public.shift_reports where id = p_report;
    if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
    d := r.work_date; br := r.branch_id;
  end if;
  if coalesce(d, '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Chọn ngày phạm lỗi.'; end if;
  if d > to_char(public.vn_now(), 'YYYY-MM-DD') then raise exception 'Ngày phạm lỗi không được sau hôm nay.'; end if;
  if not public.app__dg_open(left(d, 7)) then raise exception 'Tháng % đã khóa đánh giá (quá ngày 5 tháng sau). Nhờ Chủ mở lại.', left(d, 7); end if;
  if coalesce(p_points, -1) not between 0 and 5 then raise exception 'Chọn Nhắc nhở hoặc trừ 1–5 điểm.'; end if;
  if coalesce(p_fine, 0) < 0 or coalesce(p_fine, 0) > 5000000 then raise exception 'Tiền phạt không hợp lệ (từ 0 đến 5.000.000đ).'; end if;
  if nt is null then raise exception 'Ghi rõ nhân viên phạm lỗi gì.'; end if;
  if p_photo is not null and p_photo !~ '^dg/[\w\-/.]+$' then raise exception 'Ảnh không hợp lệ.'; end if;
  if nullif(p_set, '') is not null then
    if not exists (select 1 from public.eval_sets s where s.code = p_set) then raise exception 'Bộ tiêu chí không hợp lệ.'; end if;
    insert into public.employee_eval_sets(employee_id, set_code, updated_by, updated_at) values (e.id, p_set, a.id, public.vn_now_text())
    on conflict (employee_id) do update set set_code = excluded.set_code, updated_by = excluded.updated_by, updated_at = excluded.updated_at
      where public.employee_eval_sets.set_code is distinct from excluded.set_code;
  end if;
  st := public.app__dg_set_of(e.id);
  if st is null then raise exception 'Chọn bộ tiêu chí (Pha chế / Chạy bàn) cho nhân viên này trước.'; end if;
  if not exists (select 1 from public.employee_eval_sets s where s.employee_id = e.id) then
    insert into public.employee_eval_sets(employee_id, set_code, updated_by) values (e.id, st, a.id) on conflict do nothing;
  end if;
  select * into c from public.eval_criteria where code = p_criterion;
  if c.code is null then raise exception 'Chọn tiêu chí.'; end if;
  if c.set_code <> st then raise exception 'Tiêu chí này không thuộc bộ tiêu chí của nhân viên.'; end if;
  insert into public.eval_marks(employee_id, work_date, criterion, points, note, photo_path, report_id, branch_id, created_by, fine)
  values (e.id, d, c.code, p_points, nt, p_photo, p_report, br, a.id, coalesce(p_fine, 0)) returning id into nid;
  perform public.app__notify_emp(e.id, 'Đánh giá: ' || public.app__dg_label(p_points) || public.app__dg_fine_txt(coalesce(p_fine, 0)),
    c.name || ' · ngày ' || to_char(to_date(d, 'YYYY-MM-DD'), 'DD/MM') || E'\n' || nt
    || E'\nĐiểm tháng ' || to_char(to_date(d, 'YYYY-MM-DD'), 'MM/YYYY') || ': ' || public.app__dg_score(e.id, left(d, 7)) || '/100'
    || E'\nNgười ghi: ' || public.app__acc_name(a.id) || E'\nKhông đồng ý thì gửi giải trình.', '/cua-toi/danh-gia');
  perform public.app_log('danh_gia_tru', 'id=' || nid || ' emp=' || e.id || ' ' || c.code || ' -' || p_points || ' phat=' || coalesce(p_fine, 0));
  return nid;
end $function$;

CREATE OR REPLACE FUNCTION public.app_dg_edit(p_id bigint, p_criterion text, p_points integer, p_note text, p_fine bigint DEFAULT NULL::bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; m public.eval_marks; c public.eval_criteria; nt text := nullif(trim(coalesce(p_note, '')), '');
begin
  a := public.app__dg_need();
  select * into m from public.eval_marks where id = p_id for update;
  if m.id is null or m.status = 'huy' then raise exception 'Không tìm thấy lần đánh giá này (có thể đã bị xóa).'; end if;
  if not public.app__dg_open(left(m.work_date, 7)) then raise exception 'Tháng % đã khóa đánh giá. Nhờ Chủ mở lại.', left(m.work_date, 7); end if;
  if coalesce(p_points, -1) not between 0 and 5 then raise exception 'Chọn Nhắc nhở hoặc trừ 1–5 điểm.'; end if;
  if coalesce(p_fine, 0) < 0 or coalesce(p_fine, 0) > 5000000 then raise exception 'Tiền phạt không hợp lệ (từ 0 đến 5.000.000đ).'; end if;
  if nt is null then raise exception 'Ghi rõ nhân viên phạm lỗi gì.'; end if;
  select * into c from public.eval_criteria where code = p_criterion;
  if c.code is null then raise exception 'Chọn tiêu chí.'; end if;
  update public.eval_marks set criterion = c.code, points = p_points, note = nt, fine = coalesce(p_fine, fine), updated_by = a.id, updated_at = public.vn_now_text() where id = p_id;
  if m.points is distinct from p_points or m.criterion is distinct from c.code or m.note is distinct from nt or coalesce(p_fine, m.fine) is distinct from m.fine then
    perform public.app__notify_emp(m.employee_id, 'Đánh giá đã sửa: ' || public.app__dg_label(p_points) || public.app__dg_fine_txt(coalesce(p_fine, m.fine)),
      c.name || ' · ngày ' || to_char(to_date(m.work_date, 'YYYY-MM-DD'), 'DD/MM') || E'\n' || nt
      || E'\nĐiểm tháng: ' || public.app__dg_score(m.employee_id, left(m.work_date, 7)) || '/100' || E'\nNgười sửa: ' || public.app__acc_name(a.id), '/cua-toi/danh-gia');
  end if;
  perform public.app_log('danh_gia_sua', 'id=' || p_id || ' ' || c.code || ' -' || p_points || ' phat=' || coalesce(p_fine, m.fine));
end $function$;

CREATE OR REPLACE FUNCTION public.app_dg_delete(p_id bigint, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; m public.eval_marks; c public.eval_criteria;
begin
  a := public.app__dg_need();
  select * into m from public.eval_marks where id = p_id for update;
  if m.id is null or m.status = 'huy' then return; end if;
  if not public.app__dg_open(left(m.work_date, 7)) then raise exception 'Tháng % đã khóa đánh giá. Nhờ Chủ mở lại.', left(m.work_date, 7); end if;
  select * into c from public.eval_criteria where code = m.criterion;
  update public.eval_marks set status = 'huy', review_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), review_note),
         updated_by = a.id, updated_at = public.vn_now_text() where id = p_id;
  perform public.app__notify_emp(m.employee_id, 'Đánh giá đã xóa', public.app__dg_label(m.points) || public.app__dg_fine_txt(m.fine) || ' · ' || c.name || ' · ngày '
    || to_char(to_date(m.work_date, 'YYYY-MM-DD'), 'DD/MM') || ' đã được xóa.' || E'\nNgười xóa: ' || public.app__acc_name(a.id), '/cua-toi/danh-gia');
  perform public.app_log('danh_gia_xoa', 'id=' || p_id);
end $function$;

CREATE OR REPLACE FUNCTION public.app_dg_resolve(p_id bigint, p_keep boolean, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; m public.eval_marks; c public.eval_criteria; nt text := nullif(trim(coalesce(p_note, '')), '');
begin
  a := public.app__dg_need();
  select * into m from public.eval_marks where id = p_id for update;
  if m.id is null or m.status = 'huy' then raise exception 'Không tìm thấy lần đánh giá này (có thể đã bị xóa).'; end if;
  if not public.app__dg_open(left(m.work_date, 7)) then raise exception 'Tháng % đã khóa đánh giá. Nhờ Chủ mở lại.', left(m.work_date, 7); end if;
  select * into c from public.eval_criteria where code = m.criterion;
  update public.eval_marks set status = case when coalesce(p_keep, true) then 'tru' else 'hoan' end,
         reviewed_by = a.id, reviewed_at = public.vn_now_text(), review_note = nt where id = p_id;
  perform public.app__notify_emp(m.employee_id, case when coalesce(p_keep, true) then 'Giải trình: quản lý giữ nguyên ' || lower(public.app__dg_label(m.points)) || public.app__dg_fine_txt(m.fine)
                                                     else 'Giải trình được chấp nhận: đã hoàn điểm' || case when m.fine > 0 then ', huỷ tiền phạt' else '' end end,
    c.name || ' · ngày ' || to_char(to_date(m.work_date, 'YYYY-MM-DD'), 'DD/MM') || coalesce(E'\n' || nt, '')
    || E'\nĐiểm tháng: ' || public.app__dg_score(m.employee_id, left(m.work_date, 7)) || '/100' || E'\nNgười xem: ' || public.app__acc_name(a.id), '/cua-toi/danh-gia');
  perform public.app_log('danh_gia_giai_trinh', 'id=' || p_id || case when coalesce(p_keep, true) then ' giu' else ' hoan' end);
end $function$;

CREATE OR REPLACE FUNCTION public.app_dg_board(p_month text, p_branch bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; mon text := coalesce(nullif(p_month, ''), to_char(public.vn_now(), 'YYYY-MM'));
begin
  a := public.app__dg_need();
  if mon !~ '^\d{4}-\d{2}$' then raise exception 'Tháng không hợp lệ.'; end if;
  return jsonb_build_object(
    'month', mon, 'open', public.app__dg_open(mon),
    'reopened', exists (select 1 from public.eval_month_open o where o.month = mon),
    'deadline', to_char(to_date(mon || '-01', 'YYYY-MM-DD') + interval '1 month' + interval '4 days', 'YYYY-MM-DD'),
    'is_owner', a.system_role = 'chu', 'me_employee', a.employee_id,
    'sets', (select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name) order by s.sort_order) from public.eval_sets s),
    'criteria', (select jsonb_agg(jsonb_build_object('code', c.code, 'set_code', c.set_code, 'name', c.name) order by c.set_code, c.sort_order) from public.eval_criteria c),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code), 'name', b.name) order by b.sort_order)
                 from public.branches b where b.status = 'Đang hoạt động'), '[]'),
    'employees', coalesce((select jsonb_agg(x order by x ->> 'code') from (
        select jsonb_build_object('id', e.id, 'code', e.code, 'name', e.name, 'rank', e.rank, 'status', e.status,
          'branches', coalesce((select jsonb_agg(eb.branch_id) from public.employee_branches eb where eb.employee_id = e.id), '[]'),
          'set_code', public.app__dg_set_of(e.id),
          'set_saved', exists (select 1 from public.employee_eval_sets s where s.employee_id = e.id),
          'score', public.app__dg_score(e.id, mon), 'fine', public.app__dg_fine(e.id, mon),
          'n_tru', (select count(*) from public.eval_marks m where m.employee_id = e.id and left(m.work_date, 7) = mon and m.status = 'tru' and m.points > 0),
          'n_nhac', (select count(*) from public.eval_marks m where m.employee_id = e.id and left(m.work_date, 7) = mon and m.status = 'tru' and m.points = 0),
          'pending', (select count(*) from public.eval_marks m where m.employee_id = e.id and m.status = 'tru' and m.reply is not null and m.reviewed_at is null)) x
          from public.employees e
         where not e.pay_cash and (e.status = 'Đang làm' or exists (select 1 from public.eval_marks m where m.employee_id = e.id and left(m.work_date, 7) = mon and m.status <> 'huy'))
           and (p_branch is null or exists (select 1 from public.employee_branches eb where eb.employee_id = e.id and eb.branch_id = p_branch))) q), '[]'),
    'pending', coalesce((select jsonb_agg(public.app__dg_json(m) || jsonb_build_object('employee', e.code || ' – ' || e.name) order by m.reply_at)
                 from public.eval_marks m join public.employees e on e.id = m.employee_id
                where m.status = 'tru' and m.reply is not null and m.reviewed_at is null
                  and (p_branch is null or exists (select 1 from public.employee_branches eb where eb.employee_id = e.id and eb.branch_id = p_branch))), '[]'));
end $function$;

CREATE OR REPLACE FUNCTION public.app_dg_history(p_employee bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; e public.employees; mon text := to_char(public.vn_now(), 'YYYY-MM');
begin
  a := public.app__dg_need();
  select * into e from public.employees where id = p_employee;
  if e.id is null then raise exception 'Không tìm thấy nhân viên.'; end if;
  return jsonb_build_object(
    'employee', jsonb_build_object('id', e.id, 'code', e.code, 'name', e.name, 'rank', e.rank,
       'set_code', public.app__dg_set_of(e.id), 'set_saved', exists (select 1 from public.employee_eval_sets s where s.employee_id = e.id),
       'is_me', a.employee_id is not null and a.employee_id = e.id),
    'month', mon, 'score', public.app__dg_score(e.id, mon), 'fine', public.app__dg_fine(e.id, mon), 'today', to_char(public.vn_now(), 'YYYY-MM-DD'),
    'sets', (select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name) order by s.sort_order) from public.eval_sets s),
    'criteria', (select jsonb_agg(jsonb_build_object('code', c.code, 'set_code', c.set_code, 'name', c.name) order by c.set_code, c.sort_order) from public.eval_criteria c),
    'open_months', coalesce((select jsonb_agg(m.month) from public.eval_month_open m), '[]'),
    'marks', coalesce((select jsonb_agg(public.app__dg_json(m) order by m.work_date desc, m.id desc)
                from public.eval_marks m where m.employee_id = e.id and m.status <> 'huy'), '[]'));
end $function$;

CREATE OR REPLACE FUNCTION public.app_dg_mine()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; mon text := to_char(public.vn_now(), 'YYYY-MM'); st text;
begin
  a := public.app__need(null);
  if a.employee_id is null then
    return jsonb_build_object('month', mon, 'score', null, 'marks', '[]'::jsonb, 'criteria', '[]'::jsonb, 'months', '[]'::jsonb);
  end if;
  st := public.app__dg_set_of(a.employee_id);
  return jsonb_build_object('month', mon, 'set_code', st, 'set_name', (select s.name from public.eval_sets s where s.code = st),
    'score', public.app__dg_score(a.employee_id, mon), 'fine', public.app__dg_fine(a.employee_id, mon),
    'criteria', coalesce((select jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name) order by c.sort_order) from public.eval_criteria c where c.set_code = st), '[]'),
    'months', coalesce((select jsonb_agg(jsonb_build_object('month', x.mo, 'score', public.app__dg_score(a.employee_id, x.mo), 'fine', public.app__dg_fine(a.employee_id, x.mo),
                  'rating', public.app__dg_rating(public.app__dg_score(a.employee_id, x.mo))) order by x.mo desc)
                from (select distinct left(m.work_date, 7) mo from public.eval_marks m where m.employee_id = a.employee_id and m.status <> 'huy') x), '[]'),
    'marks', coalesce((select jsonb_agg(public.app__dg_json(m) order by m.work_date desc, m.id desc)
                from public.eval_marks m where m.employee_id = a.employee_id and m.status <> 'huy'), '[]'));
end $function$;

-- Cấp quyền gọi hàm (như tệp 36)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'app\_dg\_%' or p.proname like 'app\_\_dg\_%') loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname like 'app\_\_%' then
      execute format('revoke execute on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

insert into public.app_migrations(file) values ('193_phieu_phat_danh_gia.sql') on conflict (file) do nothing;
