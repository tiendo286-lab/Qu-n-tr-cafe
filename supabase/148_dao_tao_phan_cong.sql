-- 148 (bước 169, anh Tiến giao 19/11/2026): ĐÀO TẠO — QUY TẮC PHÂN CÔNG.
--  1. Người phụ trách chính (PTC) = tài khoản Chủ chọn ở "người nhận xét" (app__dt_reviewer). Không gắn cứng tên.
--  2. PTC + Chủ được chọn / đổi Người hướng dẫn chính (HDC) trên phiếu (hàm mới app_dt_instructor_save). Anh chốt 20/11: người có quyền Đào tạo KHÔNG còn đổi được.
--  3. Giao từng hạng mục (cả giai đoạn 2): CHỈ HDC của phiếu + PTC + Chủ. Quản lý khác, Quản lý tổng: hết quyền giao.
--  4. Nhân viên Cấp 1 ghi mức đạt → hạng mục "Chờ kiểm tra", CHƯA tính đạt; báo HDC + PTC.
--  5. HDC hoặc PTC bấm "Xác nhận đạt" (giữ / sửa mức) mới tính đạt (hàm mới app_dt_check_ok). HDC / PTC tự ghi thì khỏi kiểm.
--     Phiếu chỉ sang chờ nhận xét / hoàn thành khi không còn "Chờ kiểm tra" (app__dt_achieved không đếm mục chờ kiểm tra).
--  6. Bỏ "Quản lý phụ trách" (trainings.manager_id) khỏi quyền / thông báo / Việc của tôi — đổi sang HDC. GIỮ cột trong CSDL.
--  7. Hạng mục ghi trước đây: giữ là đạt (cột mới mặc định false).
--  Sửa thêm: chỉ báo "được giao hướng dẫn" khi thật sự đổi người (đổi cơ sở thì không báo); "Đổi phân công" giữ dấu
--  "Đã đánh giá giai đoạn 2" (cột phase2_done_at); HDC phải có tài khoản đang hoạt động.
--  Chạy lại nhiều lần không lỗi.

alter table public.training_marks add column if not exists cho_kiem_tra boolean not null default false;
alter table public.training_marks add column if not exists cho_by bigint references public.accounts(id) on delete set null;
alter table public.training_marks add column if not exists cho_at text;
alter table public.training_marks add column if not exists checked_by bigint references public.accounts(id) on delete set null;
alter table public.training_marks add column if not exists checked_at text;
alter table public.training_followups add column if not exists phase2_done_at text;

-- ---------------------------------------------------------------- vai trò trên 1 phiếu
-- HDC = tài khoản đang hoạt động của nhân viên instructor_id; PTC = app__dt_reviewer()
create or replace function public.app__dt_is_hdc(a public.accounts, t public.trainings) returns boolean
language sql stable set search_path = public as $$
  select coalesce(a.employee_id is not null and a.employee_id = t.instructor_id, false)
$$;
create or replace function public.app__dt_is_ptc(a public.accounts) returns boolean
language sql stable set search_path = public as $$
  select coalesce(a.id = public.app__dt_reviewer(), false)
$$;
-- 3. quyền giao hạng mục: chỉ HDC của phiếu + PTC + Chủ (không còn Quản lý khác / Quản lý tổng / quyền Đào tạo / Quản lý phụ trách)
create or replace function public.app__dt_can_assign(a public.accounts, t public.trainings) returns boolean
language sql stable set search_path = public as $$
  select coalesce(a.system_role = 'chu', false) or public.app__dt_is_ptc(a) or public.app__dt_is_hdc(a, t)
$$;
-- 5. người kiểm tra (Xác nhận đạt): HDC hoặc PTC
create or replace function public.app__dt_can_check(a public.accounts, t public.trainings) returns boolean
language sql stable set search_path = public as $$
  select public.app__dt_is_ptc(a) or public.app__dt_is_hdc(a, t)
$$;

-- 4/5. hạng mục "Chờ kiểm tra" không tính đạt
create or replace function public.app__dt_achieved(p_training bigint) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.training_marks where training_id = p_training and level is not null and not cho_kiem_tra
$$;
create or replace function public.app__dt_summary(t public.trainings) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', t.id, 'employee_id', t.employee_id, 'start_date', t.start_date, 'branch_id', t.branch_id,
    'branch', (select coalesce(b.display_code, b.code) from public.branches b where b.id = t.branch_id),
    'instructor', (select e.code || ' – ' || e.name from public.employees e where e.id = t.instructor_id),
    'manager', public.app__acc_name(t.manager_id),
    'achieved', public.app__dt_achieved(t.id), 'total', public.app__dt_total(t.program_id),
    'status', public.app__dt_status(t),
    'n_check', (select count(*) from public.training_marks m where m.training_id = t.id and m.cho_kiem_tra and m.level is not null),
    'missing', (select coalesce(jsonb_agg(i.no order by i.no), '[]') from public.training_items i
                 where i.program_id = t.program_id and not exists (select 1 from public.training_marks m where m.training_id = t.id and m.item_no = i.no and m.level is not null and not m.cho_kiem_tra)))
$$;

-- HDC phải là Quản lý đang làm VÀ có tài khoản đang hoạt động (chỉ kiểm khi đổi người)
create or replace function public.app__dt_instructor_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.instructor_id is not distinct from old.instructor_id then return new; end if;
  if new.instructor_id is null then
    raise exception 'Chọn người hướng dẫn chính (nhân viên cấp Quản lý).';
  end if;
  if not exists (select 1 from public.employees e where e.id = new.instructor_id and e.rank = 'Quản lý' and e.status = 'Đang làm') then
    raise exception 'Người hướng dẫn chính phải là nhân viên cấp Quản lý đang làm.';
  end if;
  if not exists (select 1 from public.accounts x where x.employee_id = new.instructor_id and x.locked = 0) then
    raise exception 'Người hướng dẫn chính phải có tài khoản đang hoạt động.';
  end if;
  return new;
end $$;

-- 6. thông báo phân công phiếu: bỏ Quản lý phụ trách; HDC / người đào tạo tiếp chỉ báo khi thật sự đổi người
create or replace function public.app__dt_notify_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
declare recipient bigint; link text; is_new boolean;
begin
  is_new := tg_op = 'INSERT';
  if new.workflow_legacy_done or new.workflow_review_at is not null then return new; end if;
  link := '/dao-tao/phieu?id=' || new.id;
  for recipient in
    select distinct x.id from public.accounts x where x.locked = 0 and (
      (x.employee_id = new.instructor_id and (is_new or new.instructor_id is distinct from old.instructor_id))
      or (x.employee_id = new.cont_trainer_id and (is_new or new.cont_trainer_id is distinct from old.cont_trainer_id))
    )
  loop
    perform public.app__notify(recipient, 'Bạn được phân công đào tạo', 'Xem phiếu để biết nhiệm vụ và hạn hoàn thành.', link);
  end loop;
  return new;
end $$;

-- báo 1 người, bỏ qua nếu đã có thông báo giống hệt chưa đọc (tránh dồn thông báo khi Cấp 1 ghi nhiều hạng mục liền)
create or replace function public.app__dt_notify_once(p_account bigint, p_title text, p_body text, p_link text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_account is null then return; end if;
  if exists (select 1 from public.notifications n where n.account_id = p_account and n.title = p_title and n.link = p_link and n.read_at is null) then return; end if;
  perform public.app__notify(p_account, p_title, p_body, p_link);
end $$;
create or replace function public.app__dt_hdc_account(t public.trainings) returns bigint
language sql stable set search_path = public as $$
  select x.id from public.accounts x where x.employee_id = t.instructor_id and x.locked = 0 order by x.id limit 1
$$;

-- ---------------------------------------------------------------- 2. PTC hoặc Chủ đổi HDC trên phiếu (anh chốt 20/11)
create or replace function public.app_dt_instructor_save(p_id bigint, p_employee bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings;
begin
  a := public.app__need(null);
  select * into t from public.trainings where id = p_id for update;
  if not found then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  if not (public.app__dt_is_ptc(a) or coalesce(a.system_role = 'chu', false)) then
    raise exception 'Chỉ người phụ trách chính đào tạo hoặc Chủ được đổi người hướng dẫn chính.';
  end if;
  if public.app__dt_status(t) = 'hoan_thanh' then raise exception 'Phiếu đã hoàn thành.'; end if;
  if p_employee is null then raise exception 'Chọn người hướng dẫn chính (nhân viên cấp Quản lý).'; end if;
  if p_employee = t.employee_id then raise exception 'Người hướng dẫn chính không được là người học.'; end if;
  update public.trainings set instructor_id = p_employee, updated_at = public.vn_now_text() where id = p_id;   -- trigger kiểm Quản lý + tài khoản, tự báo người mới
  perform public.app_log('dao_tao_doi_hd_chinh', format('training=%s employee=%s', p_id, p_employee));
end $$;

-- Anh Tiến chốt 20/11: đổi HD chính CHỈ người phụ trách chính + Chủ. app_dt_update (tệp 09) trước cho người có quyền Đào tạo đổi instructor_id → chặn đường này.
--  Chặn bằng trigger nên mọi đường sửa đều bị kiểm. Tạo phiếu (INSERT) không bị ảnh hưởng; bỏ trống HDC (vd xoá nhân viên) vẫn được.
create or replace function public.app__dt_hdc_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.accounts;
begin
  if new.instructor_id is not distinct from old.instructor_id then return new; end if;
  if new.instructor_id is null then return new; end if;
  if coalesce(auth.uid()::text, '') = '' then return new; end if;   -- việc nội bộ máy chủ (không có người gọi)
  select * into a from public.accounts where auth_user_id = auth.uid() and locked = 0 limit 1;
  if a.id is not null and (coalesce(a.system_role = 'chu', false) or public.app__dt_is_ptc(a)) then return new; end if;
  raise exception 'Chỉ người phụ trách chính đào tạo hoặc Chủ được đổi người hướng dẫn chính.';
end $$;
drop trigger if exists dt_hdc_guard on public.trainings;
create trigger dt_hdc_guard before update of instructor_id on public.trainings
for each row execute function public.app__dt_hdc_guard();
revoke execute on function public.app__dt_hdc_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------- 3 + sửa thêm: giao từng hạng mục
create or replace function public.app_dt_followup_save(
  p_id bigint, p_no integer, p_employee bigint, p_note text, p_extra boolean default true, p_branch bigint default null
) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings; item_title text; link text; item_branch bigint; notify_emp bigint;
  prev public.training_followups; before_emp bigint; after_emp bigint; was_pending boolean; hdc bigint;
begin
  a := public.app__need(null);
  select * into t from public.trainings where id = p_id for update;
  if not found then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  if p_extra is null then raise exception 'Chọn loại phân công.'; end if;
  if p_branch is not null and not exists (
    select 1 from public.branches where id = p_branch and status = 'Đang hoạt động'
  ) then raise exception 'Chọn cơ sở đang hoạt động.'; end if;
  if p_employee is null and p_extra then
    if a.id is distinct from public.app__dt_reviewer() then raise exception 'Chỉ người nhận xét được yêu cầu luyện thêm.'; end if;
    if nullif(btrim(p_note), '') is null then raise exception 'Nhập nội dung cần luyện thêm.'; end if;
  else
    if not public.app__dt_can_assign(a, t) then
      raise exception 'Chỉ người hướng dẫn chính của phiếu, người phụ trách chính đào tạo hoặc Chủ được giao hạng mục.';
    end if;
    if p_employee is null and exists (
      select 1 from public.training_followups f where f.training_id = t.id and f.item_no = p_no
        and f.is_extra and f.finished_at is null
    ) then
      p_employee := t.instructor_id;
      if p_employee is null then raise exception 'Chọn người hướng dẫn hạng mục bổ sung.'; end if;
    end if;
    if p_employee is not null and not exists (select 1 from public.employees e join public.accounts x on x.employee_id = e.id
        where e.id = p_employee and x.locked = 0 and e.status = 'Đang làm'
          and e.id <> t.employee_id and (e.id = t.instructor_id or e.rank in ('Cấp 1', 'Quản lý'))) then
      raise exception 'Chọn người hướng dẫn chính, quản lý hoặc nhân viên cấp 1 có tài khoản hoạt động.';
    end if;
  end if;
  if public.app__dt_status(t) = 'hoan_thanh' then raise exception 'Phiếu đã hoàn thành.'; end if;
  select title into item_title from public.training_items where program_id = t.program_id and no = p_no;
  if not found then raise exception 'Hạng mục không hợp lệ.'; end if;
  select * into prev from public.training_followups where training_id = t.id and item_no = p_no for update;
  was_pending := coalesce(prev.is_extra and prev.finished_at is null, false);
  before_emp := case when prev.training_id is null then t.instructor_id else coalesce(prev.employee_id, case when not prev.is_extra then t.instructor_id end) end;
  insert into public.training_followups(training_id, item_no, employee_id, note, is_extra, branch_id)
    values (t.id, p_no, p_employee, nullif(btrim(p_note), ''), p_extra, p_branch)
  on conflict (training_id, item_no) do update set employee_id = excluded.employee_id,
    note = coalesce(excluded.note, training_followups.note), finished_at = null,
    is_extra = excluded.is_extra or (training_followups.is_extra and training_followups.finished_at is null),
    -- "Đổi phân công" trên mục đã đánh giá giai đoạn 2: giữ dấu
    phase2_done_at = case when not excluded.is_extra and training_followups.is_extra and training_followups.finished_at is not null
      then training_followups.finished_at else training_followups.phase2_done_at end,
    branch_id = case when excluded.is_extra then coalesce(excluded.branch_id, training_followups.branch_id)
      else excluded.branch_id end
  returning is_extra, branch_id into p_extra, item_branch;
  after_emp := coalesce(p_employee, case when not p_extra then t.instructor_id end);
  link := '/dao-tao/phieu?id=' || t.id;
  -- chỉ báo khi thật sự đổi người (đổi cơ sở / ghi chú thì không báo); giao giai đoạn 2 mới thì báo
  notify_emp := case when after_emp is distinct from before_emp or (p_extra and not was_pending) then after_emp end;
  if notify_emp is not null and notify_emp is distinct from a.employee_id then
    perform public.app__notify_emp(notify_emp, case when p_extra then 'Bạn được giao đào tạo bổ sung' else 'Bạn được giao hướng dẫn hạng mục' end, item_title, link);
  end if;
  -- 6. báo HDC (thay Quản lý phụ trách) khi người khác giao hạng mục trên phiếu của mình
  hdc := public.app__dt_hdc_account(t);
  if hdc is not null and hdc <> a.id and (notify_emp is not null or (p_extra and p_employee is null))
     and not exists (select 1 from public.accounts x where x.id = hdc and x.employee_id = notify_emp) then
    perform public.app__notify(hdc,
      case when p_extra and p_employee is null then 'Cần phân người đào tạo bổ sung' else 'Hạng mục đào tạo có phân công mới' end,
      item_title, link);
  end if;
  perform public.app_log(case when p_extra then 'dao_tao_bo_sung' else 'dao_tao_phan_cong_huong_dan' end, format('training=%s item=%s employee=%s branch=%s', p_id, p_no, p_employee, item_branch));
end $$;

-- ---------------------------------------------------------------- 4. ghi hạng mục: Cấp 1 → Chờ kiểm tra
create or replace function public.app_dt_mark(p_id bigint, p_no integer, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings; m public.training_marks; intro boolean; prac boolean; lv text; old_status text; reviewer bigint;
  checker boolean; cap1 boolean; pend boolean; item_title text; link text; hdc bigint;
begin
  a := public.app__need(null);
  select * into t from public.trainings where id = p_id for update;
  if not found then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  if t.workflow_review_at is not null then raise exception 'Phiếu đã có nhận xét cuối.'; end if;
  if not (public.app__dt_can_edit(t) or exists (select 1 from public.training_followups f
      where f.training_id = t.id and f.item_no = p_no and f.employee_id = a.employee_id and (not f.is_extra or f.finished_at is null))) then
    raise exception 'Bạn chỉ được cập nhật hạng mục được giao.';
  end if;
  select title into item_title from public.training_items where program_id = t.program_id and no = p_no;
  if not found then raise exception 'Hạng mục không hợp lệ.'; end if;
  old_status := public.app__dt_status(t);
  select * into m from public.training_marks where training_id = t.id and item_no = p_no;
  intro := case when p ? 'introduced' then (p ->> 'introduced')::boolean else coalesce(m.introduced, false) end;
  prac := case when p ? 'practiced' then (p ->> 'practiced')::boolean else coalesce(m.practiced, false) end;
  lv := case when p ? 'level' then nullif(p ->> 'level', '') else m.level end;
  if prac and lv is null and (not coalesce(m.practiced, false) or m.level is not null) then
    raise exception 'Chọn mức đạt khi đánh dấu đã thực hành.';
  end if;
  if prac and not intro then raise exception 'Hạng mục % phải “Đã giới thiệu” trước khi “Đã thực hành”.', p_no; end if;
  if lv is not null and not (intro and prac) then raise exception 'Hạng mục % phải đủ “Đã giới thiệu” và “Đã thực hành có giám sát” rồi mới đánh giá mức đạt.', p_no; end if;
  if lv is not null and lv not in ('tb', 'kha', 'tot') then raise exception 'Mức đạt không hợp lệ.'; end if;
  -- HDC / PTC tự ghi thì khỏi kiểm; nhân viên Cấp 1 ghi mức đạt → Chờ kiểm tra (chưa tính đạt)
  checker := public.app__dt_can_check(a, t);
  cap1 := not checker and exists (select 1 from public.employees e where e.id = a.employee_id and e.rank = 'Cấp 1');
  pend := lv is not null and cap1;
  insert into public.training_marks(training_id, item_no, introduced, practiced, level, by_account, at, cho_kiem_tra, cho_by, cho_at, checked_by, checked_at)
  values (t.id, p_no, intro, prac, lv, a.id, public.vn_now_text(), pend, case when pend then a.id end, case when pend then public.vn_now_text() end,
          case when lv is not null and not pend then a.id end, case when lv is not null and not pend then public.vn_now_text() end)
  on conflict (training_id, item_no) do update set introduced = excluded.introduced, practiced = excluded.practiced, level = excluded.level,
         by_account = excluded.by_account, at = excluded.at,
         -- người không phải Cấp 1 (vd quản lý có quyền Đào tạo) sửa mục đang chờ kiểm tra: giữ chờ (chỉ HDC / PTC xác nhận)
         cho_kiem_tra = case when excluded.level is null then false when checker then false else excluded.cho_kiem_tra or training_marks.cho_kiem_tra end,
         cho_by = case when excluded.level is null or checker then null when excluded.cho_kiem_tra then excluded.cho_by else training_marks.cho_by end,
         cho_at = case when excluded.level is null or checker then null when excluded.cho_kiem_tra then excluded.cho_at else training_marks.cho_at end,
         checked_by = case when excluded.level is null then null when checker then excluded.checked_by else training_marks.checked_by end,
         checked_at = case when excluded.level is null then null when checker then excluded.checked_at else training_marks.checked_at end;
  update public.training_followups
    set finished_at = case when lv is not null then public.vn_now_text() end
    where training_id = t.id and item_no = p_no and employee_id is not null
      and (employee_id = a.employee_id or public.app_can('dao_tao') or public.app__dt_can_check(a, t))
      and (p ? 'level' or lv is null);
  update public.trainings set updated_at = public.vn_now_text(),
    workflow_legacy_done = workflow_legacy_done and lv is not null
    where id = t.id returning * into t;
  link := '/dao-tao/phieu?id=' || t.id;
  if pend then   -- báo HDC + PTC (mỗi người 1 thông báo chưa đọc cho phiếu này)
    hdc := public.app__dt_hdc_account(t); reviewer := public.app__dt_reviewer();
    if hdc is distinct from a.id then perform public.app__dt_notify_once(hdc, 'Hạng mục đào tạo chờ kiểm tra', 'Nhân viên cấp 1 đã ghi mức đạt — vào phiếu bấm Xác nhận đạt.', link); end if;
    if reviewer is distinct from a.id and reviewer is distinct from hdc then perform public.app__dt_notify_once(reviewer, 'Hạng mục đào tạo chờ kiểm tra', 'Nhân viên cấp 1 đã ghi mức đạt — vào phiếu bấm Xác nhận đạt.', link); end if;
  end if;
  reviewer := public.app__dt_reviewer();
  if reviewer is not null and old_status <> 'cho_nhan_xet' and public.app__dt_status(t) = 'cho_nhan_xet' then
    perform public.app__notify(reviewer, 'Phiếu đào tạo chờ nhận xét', 'Đã hoàn thành các hạng mục', link);
  end if;
  return jsonb_build_object('by', public.app__acc_name(a.id), 'at', public.vn_now_text(), 'achieved', public.app__dt_achieved(t.id),
    'status', public.app__dt_status(t), 'pending', pend or coalesce((select cho_kiem_tra from public.training_marks where training_id = t.id and item_no = p_no), false));
end $$;

-- ---------------------------------------------------------------- 5. HDC / PTC xác nhận đạt (giữ hoặc sửa mức)
create or replace function public.app_dt_check_ok(p_id bigint, p_no integer, p_level text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings; m public.training_marks; lv text; old_status text; reviewer bigint;
begin
  a := public.app__need(null);
  select * into t from public.trainings where id = p_id for update;
  if not found then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  if not public.app__dt_can_check(a, t) then raise exception 'Chỉ người hướng dẫn chính của phiếu hoặc người phụ trách chính đào tạo được xác nhận đạt.'; end if;
  if t.workflow_review_at is not null then raise exception 'Phiếu đã có nhận xét cuối.'; end if;
  select * into m from public.training_marks where training_id = t.id and item_no = p_no for update;
  if m.training_id is null or not m.cho_kiem_tra or m.level is null then raise exception 'Hạng mục này không chờ kiểm tra.'; end if;
  lv := coalesce(nullif(p_level, ''), m.level);
  if lv not in ('tb', 'kha', 'tot') then raise exception 'Mức đạt không hợp lệ.'; end if;
  old_status := public.app__dt_status(t);
  update public.training_marks set level = lv, cho_kiem_tra = false, checked_by = a.id, checked_at = public.vn_now_text()
   where training_id = t.id and item_no = p_no;
  update public.trainings set updated_at = public.vn_now_text() where id = t.id returning * into t;
  reviewer := public.app__dt_reviewer();
  if reviewer is not null and reviewer <> a.id and old_status <> 'cho_nhan_xet' and public.app__dt_status(t) = 'cho_nhan_xet' then
    perform public.app__notify(reviewer, 'Phiếu đào tạo chờ nhận xét', 'Đã hoàn thành các hạng mục', '/dao-tao/phieu?id=' || t.id);
  end if;
  perform public.app_log('dao_tao_xac_nhan_dat', format('training=%s item=%s level=%s', p_id, p_no, lv));
  return jsonb_build_object('achieved', public.app__dt_achieved(t.id), 'status', public.app__dt_status(t), 'level', lv);
end $$;

-- ---------------------------------------------------------------- xem phiếu: thêm vai trò, mục chờ kiểm tra, danh sách chọn HDC
create or replace function public.app_dt_get(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t public.trainings; a public.accounts; me_emp bigint; pr public.training_programs; can_pick boolean;
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
  can_pick := public.app__dt_is_ptc(a) or coalesce(a.system_role = 'chu', false);
  select * into pr from public.training_programs where id = t.program_id;
  return to_jsonb(t) || public.app__dt_summary(t) || jsonb_build_object(
    'program', jsonb_build_object('code', pr.code, 'name', pr.name, 'days', pr.days),
    'employee', (select jsonb_build_object('code', e.code, 'name', e.name, 'rank', e.rank) from public.employees e where e.id = t.employee_id),
    'cont_trainer', (select e.code || ' – ' || e.name from public.employees e where e.id = t.cont_trainer_id),
    'items', (select jsonb_agg(jsonb_build_object('no', i.no, 'day', i.day, 'title', i.title, 'page', i.page,
                 'introduced', coalesce(m.introduced, false), 'practiced', coalesce(m.practiced, false), 'level', m.level,
                 'by', public.app__acc_name(m.by_account), 'at', m.at,
                 'pending', coalesce(m.cho_kiem_tra and m.level is not null, false), 'pending_by', public.app__acc_name(m.cho_by), 'pending_at', m.cho_at,
                 'checked_by', public.app__acc_name(m.checked_by), 'checked_at', m.checked_at) order by i.no)
                from public.training_items i left join public.training_marks m on m.training_id = t.id and m.item_no = i.no where i.program_id = t.program_id),
    'days_log', coalesce((select jsonb_object_agg(d.day, jsonb_build_object('comment', d.comment, 'trainee_at', d.trainee_at, 'instructor_at', d.instructor_at,
                 'instructor_by', public.app__acc_name(d.instructor_by))) from public.training_days d where d.training_id = t.id), '{}'),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'content', k.content, 'status', k.status, 'due_date', k.due_date, 'assignee', public.app__acc_name(k.assignee_id)) order by k.id)
                         from public.tasks k where k.training_id = t.id), '[]'),
    'can_edit', public.app__dt_can_edit(t),
    'can_review', coalesce(a.id = public.app__dt_reviewer(), false),
    'can_assign', public.app__dt_can_assign(a, t),
    'can_check', public.app__dt_can_check(a, t),
    'is_ptc', public.app__dt_is_ptc(a), 'is_hdc', public.app__dt_is_hdc(a, t),
    'ptc', public.app__acc_name(public.app__dt_reviewer()),
    'can_pick_hdc', can_pick,
    'hdc_choices', case when can_pick then coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'code', e.code, 'name', e.name) order by e.code)
        from public.employees e where e.rank = 'Quản lý' and e.status = 'Đang làm' and e.id <> t.employee_id
          and exists (select 1 from public.accounts x where x.employee_id = e.id and x.locked = 0)), '[]') end,
    'due', t.start_date::date + 12, 'today', public.vn_now()::date,
    'review_from', t.start_date::date + 8,
    'item_branches', case when public.app__dt_can_assign(a, t) then coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code)) order by b.sort_order, b.id)
      from public.branches b where b.status = 'Đang hoạt động'
    ), '[]') end,
    'followups', coalesce((select jsonb_agg(jsonb_build_object(
      'no', f.item_no, 'employee_id', f.employee_id, 'name', e.name, 'note', f.note,
      'branch_id', f.branch_id, 'branch', coalesce(b.display_code, b.code),
      'finished_at', f.finished_at, 'is_extra', f.is_extra, 'phase2_done_at', f.phase2_done_at, 'mine', coalesce(f.employee_id = me_emp, false)
    ) order by f.item_no) from public.training_followups f
      left join public.employees e on e.id = f.employee_id
      left join public.branches b on b.id = f.branch_id where f.training_id = t.id), '[]'),
    'helpers', case when public.app__dt_can_assign(a, t)
      then coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.code || ' – ' || e.name) order by e.code)
        from public.employees e join public.accounts x on x.employee_id = e.id
        where x.locked = 0 and e.status = 'Đang làm' and e.id <> t.employee_id
          and (e.id = t.instructor_id or e.rank in ('Cấp 1', 'Quản lý'))), '[]') end,
    'can_admin', public.app_can('dao_tao'),
    'is_trainee', coalesce(me_emp = t.employee_id, false));
end $$;

-- ---------------------------------------------------------------- Việc của tôi: bỏ "Quản lý phụ trách", thêm "Chờ bạn kiểm tra N hạng mục"
create or replace function public.app_dt_work_list(p_mine boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; reviewer bigint; see_all boolean;
begin
  a := public.app__need(null);
  reviewer := public.app__dt_reviewer();
  see_all := a.system_role in ('chu', 'ql_tong', 'ql')
    or coalesce(a.id = reviewer, false) or coalesce(public.app_can('dao_tao'), false);
  return jsonb_build_object(
    'today', public.vn_now()::date, 'reviewer', public.app__acc_name(reviewer), 'reviewer_id', reviewer,
    'accounts', case when not p_mine and a.system_role = 'chu' then coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', public.app__acc_name(x.id)) order by public.app__acc_name(x.id))
      from public.accounts x left join public.employees e on e.id = x.employee_id
      where x.locked = 0 and (x.employee_id is null or e.status = 'Đang làm')
    ), '[]') end,
    'rows', coalesce((select jsonb_agg(public.app__dt_summary(t) || jsonb_build_object(
      'employee', e.code || ' – ' || e.name, 'program', pr.code, 'due', t.start_date::date + 12,
      'my_duties', duties.roles,
      'my_followups', (select count(*) from public.training_followups f
        where f.training_id = t.id and f.employee_id = a.employee_id and f.is_extra and f.finished_at is null)
    ) order by (public.app__dt_status(t) = 'hoan_thanh'), t.start_date, t.id)
    from public.trainings t join public.employees e on e.id = t.employee_id
    join public.training_programs pr on pr.id = t.program_id
    cross join lateral (select count(*) n from public.training_marks m where m.training_id = t.id and m.cho_kiem_tra and m.level is not null) chk
    cross join lateral (select array_remove(array[
      case when a.id = reviewer then 'Kiểm tra và nhận xét' end,
      case when a.employee_id in (t.instructor_id, t.cont_trainer_id) then 'Hướng dẫn' end,
      case when a.employee_id = t.employee_id then 'Bạn được đào tạo' end,
      case when chk.n > 0 and (a.id = reviewer or a.employee_id = t.instructor_id) then 'Chờ bạn kiểm tra ' || chk.n || ' hạng mục' end,
      case when exists (select 1 from public.training_followups f
        left join public.training_marks m on m.training_id = f.training_id and m.item_no = f.item_no
        where f.training_id = t.id and f.employee_id = a.employee_id and f.finished_at is null
          and (f.is_extra or m.level is null)) then 'Hướng dẫn hạng mục được giao' end
    ], null) as roles) duties
    where e.status = 'Đang làm' and (
      (p_mine and cardinality(duties.roles) > 0 and public.app__dt_status(t) <> 'hoan_thanh')
      or (not p_mine and (see_all or cardinality(duties.roles) > 0
        or exists (select 1 from public.training_followups f where f.training_id = t.id and f.employee_id = a.employee_id)))
    )), '[]'));
end $$;

-- ---------------------------------------------------------------- Nhắc hạn: bỏ Quản lý phụ trách (HDC đã có trong danh sách)
create or replace function public.app_dt_work_action(p_id bigint, p_action text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings; recipient bigint; link text;
begin
  a := public.app__need(null);
  if a.id is distinct from public.app__dt_reviewer() then raise exception 'Chỉ người được giao nhận xét có quyền.'; end if;
  select * into t from public.trainings where id = p_id for update;
  if not found then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  if p_action = 'review' then
    if public.vn_now()::date < t.start_date::date + 8 then
      raise exception 'Chưa đến mốc 8 ngày để hoàn thành phiếu.';
    end if;
    if public.app__dt_status(t) <> 'cho_nhan_xet' then raise exception 'Cần hoàn thành đủ hạng mục (không còn hạng mục chờ kiểm tra) trước khi nhận xét cuối.'; end if;
    if nullif(btrim(p_note), '') is null then raise exception 'Nhập nhận xét cuối.'; end if;
    update public.trainings set workflow_review = btrim(p_note), workflow_review_by = a.id,
      workflow_review_at = public.vn_now_text() where id = p_id;
  elsif p_action = 'remind' then
    if public.app__dt_status(t) = 'hoan_thanh' then raise exception 'Phiếu đã hoàn thành.'; end if;
    link := '/dao-tao/phieu?id=' || p_id;
    for recipient in
      select x.id from public.accounts x where x.locked = 0 and x.id <> a.id and (
        x.employee_id in (t.employee_id, t.instructor_id, t.cont_trainer_id)
        or exists (select 1 from public.training_followups f where f.training_id = t.id
          and f.employee_id = x.employee_id and f.finished_at is null))
    loop
      perform public.app__notify(recipient, 'Nhắc hoàn thành đào tạo',
        'Hạn ' || to_char(t.start_date::date + 12, 'DD/MM/YYYY') || coalesce(' · ' || nullif(btrim(p_note), ''), ''), link);
    end loop;
    if not found then
      raise exception 'Chưa có tài khoản phù hợp để nhận nhắc nhở.';
    end if;
  else
    raise exception 'Thao tác không hợp lệ.';
  end if;
  perform public.app_log('dao_tao_' || p_action, 'training=' || p_id);
end $$;

-- ---------------------------------------------------------------- Việc hôm nay (app_today_more): "Đào tạo đã giao người hướng dẫn" theo HDC thay Quản lý phụ trách
do $$
declare d text;
begin
  d := pg_get_functiondef('public.app_today_more()'::regprocedure);
  if position('where t.manager_id = a.id and (f.is_extra or m.level is null)' in d) > 0 then
    d := replace(d, 'where t.manager_id = a.id and (f.is_extra or m.level is null)',
                    'where t.instructor_id = a.employee_id and f.employee_id is distinct from a.employee_id and (f.is_extra or m.level is null)');
    execute d;
  elsif position('t.instructor_id = a.employee_id and f.employee_id is distinct from a.employee_id' in d) = 0 then
    raise exception 'app_today_more: không thấy chỗ vá (manager_id).';
  end if;
end $$;

revoke execute on function public.app__dt_is_hdc(public.accounts, public.trainings), public.app__dt_is_ptc(public.accounts),
  public.app__dt_can_assign(public.accounts, public.trainings), public.app__dt_can_check(public.accounts, public.trainings),
  public.app__dt_notify_once(bigint, text, text, text), public.app__dt_hdc_account(public.trainings),
  public.app__dt_instructor_guard(), public.app__dt_notify_assignment() from public, anon, authenticated;
revoke execute on function public.app_dt_instructor_save(bigint, bigint), public.app_dt_check_ok(bigint, integer, text) from public, anon;
grant execute on function public.app_dt_instructor_save(bigint, bigint), public.app_dt_check_ok(bigint, integer, text) to authenticated;

insert into public.app_migrations(file) values ('148_dao_tao_phan_cong.sql') on conflict (file) do nothing;
