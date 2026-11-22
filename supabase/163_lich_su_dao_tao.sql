-- Chặng 4 (anh Tiến duyệt thiết kế "lịch sử đào tạo theo ngày thật" + 8 điểm lúc 00:47 21/11; 22/11 chốt làm cả 2 đợt).
-- Thiết kế: tai_lieu/superpowers/specs/2026-11-22-lich-su-dao-tao-theo-ngay-design.md. Phần máy chủ (lên trước, màn hình phiếu đổi sau khi anh duyệt ảnh):
--   1) Sổ lịch sử training_mark_log: mọi lần tích / bỏ tích / chọn mức / đổi mức / Xác nhận đạt / đào tạo lại — ai, lúc nào (giờ VN), ngày VN, cũ → mới,
--      có đang chờ kiểm tra (Cấp 1 ghi), có thuộc giai đoạn 2 không. Ghi bằng trigger trên training_marks (mọi đường đổi đều vào sổ); chỉ thêm dòng,
--      không có hàm sửa / xoá; không cấp quyền cho web (đọc qua app_dt_history).
--   2) Đào tạo lại (kể cả ra cùng mức cũ): app_dt_mark nhận thêm p.relearn = true → luôn ghi một dòng dao_tao_lai. Người được giao giai đoạn 2
--      ghi lại mức → cũng là đào tạo lại.
--   3) Chạy bù: mỗi hạng mục đang có số liệu → 1 dòng ghi_cu theo lần ghi gần nhất; mục đã có Xác nhận đạt → thêm 1 dòng xac_nhan. Chạy lại không nhân đôi.
--   4) Nhận xét + hai lần xác nhận theo NGÀY THẬT (training_day_notes) — app_dt_dnote_comment / app_dt_dnote_confirm, cùng quyền với
--      app_dt_day_comment / app_dt_day_confirm; chỉ nhận ngày đã có ít nhất một dòng lịch sử. training_days (theo ngày giáo trình) giữ nguyên.
--   5) app_dt_history(p_id): lịch sử + nhận xét theo ngày (kèm tên người), cùng điều kiện xem phiếu như app_dt_get (tệp 148). app_dt_get KHÔNG đổi.
-- Không đổi quyền (ai giao / ghi / xác nhận đạt), không đổi cách tính số hạng mục đạt / trạng thái phiếu. Không đụng vùng khoá tiền đối soát.
-- Bài thử: kiem_tra/lich_su_dao_tao_163_cuc_bo.sql (Postgres cục bộ). Chạy lại nhiều lần không sao.

create table if not exists public.training_mark_log (
  id bigserial primary key,
  training_id bigint not null references public.trainings(id) on delete cascade,
  item_no integer not null,
  at text not null,                      -- giờ Việt Nam 'YYYY-MM-DD HH24:MI:SS'
  day text not null,                     -- ngày Việt Nam của lúc ghi
  by_account bigint,
  kind text not null check (kind in ('gioi_thieu', 'thuc_hanh', 'muc', 'xac_nhan', 'bo_tich', 'dao_tao_lai', 'ghi_cu')),
  old jsonb, new jsonb,                  -- {introduced, practiced, level}
  pending boolean not null default false,
  gd2 boolean not null default false,
  note text);
create index if not exists training_mark_log_ngay on public.training_mark_log(training_id, day, id);
alter table public.training_mark_log enable row level security;
revoke all on public.training_mark_log from public, anon, authenticated;
revoke all on sequence public.training_mark_log_id_seq from public, anon, authenticated;

create table if not exists public.training_day_notes (
  training_id bigint not null references public.trainings(id) on delete cascade,
  day text not null,                     -- ngày đào tạo thật (YYYY-MM-DD)
  comment text, comment_by bigint, comment_at text,
  trainee_at text, trainee_by bigint, instructor_at text, instructor_by bigint,
  primary key (training_id, day));
alter table public.training_day_notes enable row level security;
revoke all on public.training_day_notes from public, anon, authenticated;

-- (1)(2) ghi sổ sau mỗi lần thêm / sửa training_marks
create or replace function public.app__dt_mark_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; k text; relearn boolean := coalesce(current_setting('app.dt_relearn', true), '') = '1'; gd2 boolean; acc bigint; t_at text;
begin
  if coalesce(current_setting('app.dt_nolog', true), '') = '1' then return null; end if;
  n := jsonb_build_object('introduced', coalesce(new.introduced, false), 'practiced', coalesce(new.practiced, false), 'level', new.level);
  if tg_op = 'UPDATE' then o := jsonb_build_object('introduced', coalesce(old.introduced, false), 'practiced', coalesce(old.practiced, false), 'level', old.level); end if;
  gd2 := exists (select 1 from public.training_followups f where f.training_id = new.training_id and f.item_no = new.item_no and f.is_extra and f.employee_id is not null);
  acc := (public.app_account()).id;
  -- Xác nhận đạt (HDC / PTC): mục đang chờ kiểm tra được xác nhận
  if tg_op = 'UPDATE' and coalesce(old.cho_kiem_tra, false) and not coalesce(new.cho_kiem_tra, false) and new.checked_at is not null and old.checked_at is distinct from new.checked_at then
    insert into public.training_mark_log(training_id, item_no, at, day, by_account, kind, old, new, pending, gd2)
    values (new.training_id, new.item_no, new.checked_at, left(new.checked_at, 10), coalesce(new.checked_by, acc), 'xac_nhan', o, n, false, gd2);
    return null;
  end if;
  if o is not distinct from n and not relearn then return null; end if;   -- lưu lại không đổi gì
  k := case
    when relearn or (gd2 and o ->> 'level' is not null and n ->> 'level' is not null) then 'dao_tao_lai'
    when o is not null and ((coalesce((o ->> 'introduced')::boolean, false) and not (n ->> 'introduced')::boolean)
                         or (coalesce((o ->> 'practiced')::boolean, false) and not (n ->> 'practiced')::boolean)
                         or (o ->> 'level' is not null and n ->> 'level' is null)) then 'bo_tich'
    when n ->> 'level' is not null and n ->> 'level' is distinct from o ->> 'level' then 'muc'
    when (n ->> 'practiced')::boolean and not coalesce((o ->> 'practiced')::boolean, false) then 'thuc_hanh'
    else 'gioi_thieu' end;
  t_at := coalesce(new.at, public.vn_now_text());
  insert into public.training_mark_log(training_id, item_no, at, day, by_account, kind, old, new, pending, gd2)
  values (new.training_id, new.item_no, t_at, left(t_at, 10), coalesce(new.by_account, acc), k, o, n, coalesce(new.cho_kiem_tra, false), gd2);
  return null;
end $$;
revoke all on function public.app__dt_mark_log() from public, anon, authenticated;
drop trigger if exists training_marks_log on public.training_marks;
create trigger training_marks_log after insert or update on public.training_marks for each row execute function public.app__dt_mark_log();

-- (2) app_dt_mark nhận p.relearn (đào tạo lại — ghi sổ cả khi mức không đổi). Vá bằng thay chuỗi trên bản đang chạy (bản tệp 148).
do $$
declare d text; o1 text; n1 text; o2 text; n2 text;
begin
  d := pg_get_functiondef('public.app_dt_mark(bigint,integer,jsonb)'::regprocedure);
  if position('app.dt_relearn' in d) = 0 then
    o1 := $q$  insert into public.training_marks(training_id, item_no, introduced, practiced, level, by_account, at, cho_kiem_tra, cho_by, cho_at, checked_by, checked_at)$q$;
    n1 := $q$  perform set_config('app.dt_relearn', case when coalesce((p ->> 'relearn')::boolean, false) then '1' else '' end, true);   -- tệp 163: đào tạo lại
  insert into public.training_marks(training_id, item_no, introduced, practiced, level, by_account, at, cho_kiem_tra, cho_by, cho_at, checked_by, checked_at)$q$;
    o2 := $q$         checked_at = case when excluded.level is null then null when checker then excluded.checked_at else training_marks.checked_at end;$q$;
    n2 := $q$         checked_at = case when excluded.level is null then null when checker then excluded.checked_at else training_marks.checked_at end;
  perform set_config('app.dt_relearn', '', true);$q$;
    if position(o1 in d) = 0 or position(o2 in d) = 0 then raise exception 'Tệp 163: app_dt_mark đang chạy khác dự kiến — dừng, không vá.'; end if;
    execute replace(replace(d, o1, n1), o2, n2);
  end if;
end $$;

-- (3) chạy bù — trả số dòng đã thêm
create or replace function public.app__dt_log_backfill() returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- chỉ các hạng mục CŨ chưa có dòng nào trong sổ (cùng một lượt chụp dữ liệu cho cả hai lần thêm)
  with legacy as (
    select m.* from public.training_marks m
     where m.at is not null and (coalesce(m.introduced, false) or coalesce(m.practiced, false) or m.level is not null)
       and not exists (select 1 from public.training_mark_log l where l.training_id = m.training_id and l.item_no = m.item_no)),
  a as (
    insert into public.training_mark_log(training_id, item_no, at, day, by_account, kind, old, new, pending, gd2, note)
    select g.training_id, g.item_no, g.at, left(g.at, 10), g.by_account, 'ghi_cu', null,
           jsonb_build_object('introduced', coalesce(g.introduced, false), 'practiced', coalesce(g.practiced, false), 'level', g.level),
           coalesce(g.cho_kiem_tra, false), false, 'Lần ghi gần nhất trước khi có sổ lịch sử'
      from legacy g returning 1),
  b as (
    insert into public.training_mark_log(training_id, item_no, at, day, by_account, kind, old, new, pending, gd2, note)
    select g.training_id, g.item_no, g.checked_at, left(g.checked_at, 10), g.checked_by, 'xac_nhan', null,
           jsonb_build_object('introduced', coalesce(g.introduced, false), 'practiced', coalesce(g.practiced, false), 'level', g.level),
           false, false, 'Xác nhận đạt trước khi có sổ lịch sử'
      from legacy g where g.checked_at is not null returning 1)
  select (select count(*) from a) + (select count(*) from b) into n;
  return n;
end $$;
revoke all on function public.app__dt_log_backfill() from public, anon, authenticated;
select public.app__dt_log_backfill();

-- (5) xem lịch sử + nhận xét theo ngày thật (cùng điều kiện xem phiếu như app_dt_get, tệp 148)
create or replace function public.app_dt_history(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t public.trainings; a public.accounts; me_emp bigint;
begin
  a := public.app__need(null);
  select * into t from public.trainings where id = p_id;
  if t.id is null then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  me_emp := public.app_my_employee();
  if not (public.app_can('dao_tao') or public.app_can('quan_ly_nhan_vien')
          or coalesce(me_emp = any(array_remove(array[t.employee_id, t.instructor_id, t.cont_trainer_id], null)), false)
          or public.app__dt_can_assign(a, t)
          or exists (select 1 from public.training_followups f where f.training_id = t.id and f.employee_id = me_emp)) then
    raise exception 'Bạn không xem được phiếu đào tạo này.';
  end if;
  return jsonb_build_object(
    'log', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'no', l.item_no, 'at', l.at, 'day', l.day, 'by', public.app__acc_name(l.by_account),
              'kind', l.kind, 'old', l.old, 'new', l.new, 'pending', l.pending, 'gd2', l.gd2, 'note', l.note) order by l.day, l.at, l.id)
             from public.training_mark_log l where l.training_id = t.id), '[]'),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('day', n.day, 'comment', n.comment, 'comment_by', public.app__acc_name(n.comment_by), 'comment_at', n.comment_at,
              'trainee_at', n.trainee_at, 'trainee_by', public.app__acc_name(n.trainee_by), 'instructor_at', n.instructor_at,
              'instructor_by', public.app__acc_name(n.instructor_by)) order by n.day)
             from public.training_day_notes n where n.training_id = t.id), '[]'));
end $$;

-- (4) nhận xét + xác nhận theo ngày thật
create or replace function public.app_dt_dnote_comment(p_id bigint, p_day text, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare t public.trainings; a public.accounts;
begin
  t := public.app__dt_need(p_id);   -- cùng quyền với app_dt_day_comment
  a := public.app_account();
  if t.workflow_review_at is not null then raise exception 'Phiếu đã có nhận xét cuối.'; end if;
  if coalesce(p_day, '') !~ '^\d{4}-\d{2}-\d{2}$' or not exists (select 1 from public.training_mark_log l where l.training_id = t.id and l.day = p_day) then
    raise exception 'Ngày này chưa có lần đào tạo nào trên phiếu.';
  end if;
  insert into public.training_day_notes(training_id, day, comment, comment_by, comment_at)
  values (t.id, p_day, nullif(trim(coalesce(p_comment, '')), ''), a.id, public.vn_now_text())
  on conflict (training_id, day) do update set comment = excluded.comment, comment_by = excluded.comment_by, comment_at = excluded.comment_at;
end $$;

create or replace function public.app_dt_dnote_confirm(p_id bigint, p_day text, p_who text, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings;
begin
  a := public.app__need(null);   -- cùng quyền với app_dt_day_confirm
  select * into t from public.trainings where id = p_id;
  if t.id is null then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  if t.workflow_review_at is not null then raise exception 'Phiếu đã có nhận xét cuối.'; end if;
  if coalesce(p_day, '') !~ '^\d{4}-\d{2}-\d{2}$' or not exists (select 1 from public.training_mark_log l where l.training_id = t.id and l.day = p_day) then
    raise exception 'Ngày này chưa có lần đào tạo nào trên phiếu.';
  end if;
  if p_who = 'nv' then
    if a.employee_id is distinct from t.employee_id then raise exception 'Chỉ chính nhân viên được đào tạo mới xác nhận phần của nhân viên.'; end if;
    insert into public.training_day_notes(training_id, day, trainee_at, trainee_by) values (t.id, p_day, case when p_on then public.vn_now_text() end, case when p_on then a.id end)
    on conflict (training_id, day) do update set trainee_at = excluded.trainee_at, trainee_by = excluded.trainee_by;
  elsif p_who = 'hd' then
    if not public.app__dt_can_edit(t) then raise exception 'Chỉ người hướng dẫn / người có quyền Đào tạo mới xác nhận phần người hướng dẫn.'; end if;
    insert into public.training_day_notes(training_id, day, instructor_at, instructor_by) values (t.id, p_day, case when p_on then public.vn_now_text() end, case when p_on then a.id end)
    on conflict (training_id, day) do update set instructor_at = excluded.instructor_at, instructor_by = excluded.instructor_by;
  else
    raise exception 'Không hợp lệ.';
  end if;
end $$;

revoke all on function public.app_dt_history(bigint), public.app_dt_dnote_comment(bigint, text, text), public.app_dt_dnote_confirm(bigint, text, text, boolean) from public, anon;
grant execute on function public.app_dt_history(bigint), public.app_dt_dnote_comment(bigint, text, text), public.app_dt_dnote_confirm(bigint, text, text, boolean) to authenticated;

insert into public.app_migrations(file) values ('163_lich_su_dao_tao.sql') on conflict (file) do nothing;
