-- 149 (bước 170, anh Tiến giao 19/11/2026): ĐÀO TẠO — TAB PHÂN CÔNG + CHỜ KIỂM TRA (chạy SAU tệp 148).
--  * app_dt_assign_board(p_program): 1 lần gọi trả đủ dữ liệu 2 tab mới — phiếu đang mở (Chủ + người phụ trách chính: mọi phiếu; HD chính: phiếu của mình;
--    người khác: can_board = false), hạng mục CHƯA ĐẠT (Chưa giao · Đang giao Cấp 1 · Chờ kiểm tra), lịch NV mới, gợi ý cơ sở / người theo lịch.
--  * Gợi ý theo lịch: chỉ lịch ĐÃ CÔNG BỐ (schedule_published) từ ngày bắt đầu → hạn 12 ngày. Cơ sở chọn sẵn = nơi NV mới có nhiều ca nhất.
--    Người: "Cùng ca" (Cấp 1 cùng cơ sở + ngày + đúng ca, "trùng N ca", N giảm dần) → "Cấp 1 cơ sở <mã>" (employee_branches) → "Khác".
--    Gợi ý chỉ sắp xếp, không đổi quyền (danh sách người vẫn đúng danh sách được phép như giao từng hạng mục).
--  * app_dt_assign_bulk(p_id, p_items, p_employee, p_branch, p_note): giao hàng loạt / Trả về HD chính — gọi lại app_dt_followup_save cho từng mục
--    (DÙNG CHUNG kiểm tra quyền), mỗi người được giao nhận MỘT thông báo gộp.
--  Chạy lại nhiều lần không lỗi.

-- app_dt_followup_save (bản tệp 148) + bỏ thông báo từng mục khi đang giao hàng loạt (app.dt_bulk = '1')
create or replace function public.app_dt_followup_save(
  p_id bigint, p_no integer, p_employee bigint, p_note text, p_extra boolean default true, p_branch bigint default null
) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings; item_title text; link text; item_branch bigint; notify_emp bigint;
  prev public.training_followups; before_emp bigint; after_emp bigint; was_pending boolean; hdc bigint; bulk boolean;
begin
  a := public.app__need(null);
  bulk := coalesce(current_setting('app.dt_bulk', true), '') = '1';
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
    phase2_done_at = case when not excluded.is_extra and training_followups.is_extra and training_followups.finished_at is not null
      then training_followups.finished_at else training_followups.phase2_done_at end,
    branch_id = case when excluded.is_extra then coalesce(excluded.branch_id, training_followups.branch_id)
      else excluded.branch_id end
  returning is_extra, branch_id into p_extra, item_branch;
  after_emp := coalesce(p_employee, case when not p_extra then t.instructor_id end);
  link := '/dao-tao/phieu?id=' || t.id;
  notify_emp := case when after_emp is distinct from before_emp or (p_extra and not was_pending) then after_emp end;
  if not bulk and notify_emp is not null and notify_emp is distinct from a.employee_id then
    perform public.app__notify_emp(notify_emp, case when p_extra then 'Bạn được giao đào tạo bổ sung' else 'Bạn được giao hướng dẫn hạng mục' end, item_title, link);
  end if;
  hdc := public.app__dt_hdc_account(t);
  if not bulk and hdc is not null and hdc <> a.id and (notify_emp is not null or (p_extra and p_employee is null))
     and not exists (select 1 from public.accounts x where x.id = hdc and x.employee_id = notify_emp) then
    perform public.app__notify(hdc,
      case when p_extra and p_employee is null then 'Cần phân người đào tạo bổ sung' else 'Hạng mục đào tạo có phân công mới' end,
      item_title, link);
  end if;
  perform public.app_log(case when p_extra then 'dao_tao_bo_sung' else 'dao_tao_phan_cong_huong_dan' end, format('training=%s item=%s employee=%s branch=%s', p_id, p_no, p_employee, item_branch));
end $$;

-- ---------------------------------------------------------------- giao hàng loạt / Trả về HD chính (p_employee trống)
create or replace function public.app_dt_assign_bulk(p_id bigint, p_items integer[], p_employee bigint, p_branch bigint, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings; no int; prev public.training_followups; before_emp bigint; after_emp bigint;
  changed int[] := '{}'; titles text; hdc bigint; link text;
begin
  a := public.app__need(null);
  select * into t from public.trainings where id = p_id;
  if not found then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  if not public.app__dt_can_assign(a, t) then
    raise exception 'Chỉ người hướng dẫn chính của phiếu, người phụ trách chính đào tạo hoặc Chủ được giao hạng mục.';
  end if;
  if coalesce(cardinality(p_items), 0) = 0 then raise exception 'Chọn ít nhất 1 hạng mục.'; end if;
  if cardinality(p_items) > 100 then raise exception 'Chọn tối đa 100 hạng mục mỗi lần.'; end if;
  perform set_config('app.dt_bulk', '1', true);
  foreach no in array (select array_agg(distinct x order by x) from unnest(p_items) x) loop
    select * into prev from public.training_followups where training_id = t.id and item_no = no;
    before_emp := case when prev.training_id is null then t.instructor_id else coalesce(prev.employee_id, case when not prev.is_extra then t.instructor_id end) end;
    -- mục đang luyện giai đoạn 2 giữ nguyên loại (giao lại người luyện); mục thường giao hướng dẫn
    perform public.app_dt_followup_save(t.id, no, p_employee, p_note, coalesce(prev.is_extra and prev.finished_at is null, false), p_branch);
    after_emp := coalesce(p_employee, t.instructor_id);
    if after_emp is distinct from before_emp then changed := changed || no; end if;
  end loop;
  perform set_config('app.dt_bulk', '', true);
  link := '/dao-tao/phieu?id=' || t.id;
  if cardinality(changed) > 0 then
    select string_agg(i.no || '. ' || i.title, ' · ' order by i.no) into titles from public.training_items i where i.program_id = t.program_id and i.no = any(changed);
    after_emp := coalesce(p_employee, t.instructor_id);
    if after_emp is distinct from a.employee_id then
      perform public.app__notify_emp(after_emp, 'Bạn được giao hướng dẫn ' || cardinality(changed) || ' hạng mục', left(titles, 900), link);
    end if;
    hdc := public.app__dt_hdc_account(t);
    if hdc is not null and hdc <> a.id and not exists (select 1 from public.accounts x where x.id = hdc and x.employee_id = after_emp) then
      perform public.app__notify(hdc, 'Hạng mục đào tạo có phân công mới', cardinality(changed) || ' hạng mục: ' || left(titles, 800), link);
    end if;
  end if;
  perform public.app_log('dao_tao_giao_hang_loat', format('training=%s items=%s employee=%s branch=%s', p_id, p_items, p_employee, p_branch));
  return jsonb_build_object('n', cardinality(p_items), 'changed', cardinality(changed));
end $$;

-- ---------------------------------------------------------------- dữ liệu tab Phân công + Chờ kiểm tra (1 lần gọi)
create or replace function public.app_dt_assign_board(p_program text default 'chay_ban') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; ptc boolean; all_open boolean;
begin
  a := public.app__need(null);
  ptc := public.app__dt_is_ptc(a);
  all_open := coalesce(a.system_role = 'chu', false) or ptc;
  if not all_open and not exists (select 1 from public.trainings t join public.employees e on e.id = t.employee_id
      where a.employee_id is not null and t.instructor_id = a.employee_id and e.status = 'Đang làm' and public.app__dt_status(t) <> 'hoan_thanh') then
    return jsonb_build_object('can_board', false, 'rows', '[]'::jsonb);
  end if;
  return jsonb_build_object('can_board', true, 'all', all_open, 'today', public.vn_now()::date,
    'rows', coalesce((select jsonb_agg(r order by r ->> 'start_date', (r ->> 'id')::bigint) from (
      select jsonb_build_object(
        'id', t.id, 'employee', e.code || ' – ' || e.name, 'start_date', t.start_date, 'due', (t.start_date::date + 12)::text,
        'branch_id', t.branch_id, 'branch', (select coalesce(b.display_code, b.code) from public.branches b where b.id = t.branch_id),
        'instructor_id', t.instructor_id, 'instructor', (select h.code || ' – ' || h.name from public.employees h where h.id = t.instructor_id),
        'achieved', public.app__dt_achieved(t.id), 'total', public.app__dt_total(t.program_id),
        'sched', s.sched, 'best_branch', coalesce(s.best, t.branch_id),
        'same', g.same, 'br_c1', g.br_c1, 'other', g.other,
        'items', it.items, 'n_chua', it.n_chua, 'n_kt', it.n_kt, 'n_dang', it.n_dang, 'can_check', public.app__dt_can_check(a, t)) r
      from public.trainings t
      join public.employees e on e.id = t.employee_id and e.status = 'Đang làm'
      join public.training_programs pr on pr.id = t.program_id and pr.code = coalesce(p_program, 'chay_ban')
      -- lịch đã công bố của NV mới trong [ngày bắt đầu, hạn 12 ngày]
      cross join lateral (
        with ss as materialized (
          select (w.start_date::date + sp.weekday) d, sp.branch_id, sp.shift from public.schedule_published sp join public.weeks w on w.id = sp.week_id
           where sp.employee_id = t.employee_id and (w.start_date::date + sp.weekday) between t.start_date::date and t.start_date::date + 12)
        select coalesce((select jsonb_agg(jsonb_build_object('date', ss.d::text, 'branch_id', ss.branch_id, 'branch', coalesce(b.display_code, b.code), 'shift', ss.shift)
                    order by ss.d, coalesce(array_position(public.app__shifts(), ss.shift), 99)) from ss left join public.branches b on b.id = ss.branch_id), '[]'::jsonb) sched,
               (select ss.branch_id from ss group by ss.branch_id order by count(*) desc, ss.branch_id limit 1) best,
               (select coalesce(array_agg(ss.d::text || '|' || ss.branch_id || '|' || ss.shift), '{}') from ss) keys
      ) s
      -- gợi ý người: Cùng ca → Cấp 1 cơ sở → Khác (chỉ người được phép giao: HDC, Quản lý, Cấp 1 có tài khoản hoạt động)
      cross join lateral (
        with ok as materialized (
          select h.id, h.code || ' – ' || h.name nm, h.rank from public.employees h
           where h.status = 'Đang làm' and h.id <> t.employee_id and (h.id = t.instructor_id or h.rank in ('Cấp 1', 'Quản lý'))
             and exists (select 1 from public.accounts x where x.employee_id = h.id and x.locked = 0)),
        same as materialized (
          select ok.id, ok.nm, count(*) n from ok join public.schedule_published s2 on s2.employee_id = ok.id join public.weeks w2 on w2.id = s2.week_id
           where ok.rank = 'Cấp 1' and ((w2.start_date::date + s2.weekday)::text || '|' || s2.branch_id || '|' || s2.shift) = any(s.keys)
           group by ok.id, ok.nm),
        brc as materialized (
          select ok.id, ok.nm from ok where ok.rank = 'Cấp 1' and not exists (select 1 from same where same.id = ok.id)
             and exists (select 1 from public.employee_branches eb where eb.employee_id = ok.id and eb.branch_id = coalesce(s.best, t.branch_id)))
        select coalesce((select jsonb_agg(jsonb_build_object('id', same.id, 'name', same.nm, 'n', same.n) order by same.n desc, same.nm) from same), '[]'::jsonb) same,
               coalesce((select jsonb_agg(jsonb_build_object('id', brc.id, 'name', brc.nm) order by brc.nm) from brc), '[]'::jsonb) br_c1,
               coalesce((select jsonb_agg(jsonb_build_object('id', ok.id, 'name', ok.nm, 'hdc', ok.id = t.instructor_id) order by (ok.id = t.instructor_id) desc, ok.rank desc, ok.nm) from ok
                  where not exists (select 1 from same where same.id = ok.id) and not exists (select 1 from brc where brc.id = ok.id)), '[]'::jsonb) other
      ) g
      -- hạng mục chưa đạt: Chưa giao · Đang giao Cấp 1 (đang giao người khác HDC) · Chờ kiểm tra
      cross join lateral (
        with x as materialized (
          select i.no, i.day, i.title, m.level, coalesce(m.cho_kiem_tra and m.level is not null, false) kt, m.cho_by, m.cho_at,
                 f.employee_id fe, f.is_extra, f.finished_at, coalesce(f.branch_id, t.branch_id) bid
            from public.training_items i
            left join public.training_marks m on m.training_id = t.id and m.item_no = i.no
            left join public.training_followups f on f.training_id = t.id and f.item_no = i.no
           where i.program_id = t.program_id and (m.level is null or m.cho_kiem_tra))
        select coalesce(jsonb_agg(jsonb_build_object('no', x.no, 'day', x.day, 'title', x.title, 'level', x.level,
                 'state', case when x.kt then 'cho_kt' when x.fe is not null and x.fe is distinct from t.instructor_id then 'dang_giao' else 'chua_giao' end,
                 'who_id', coalesce(x.fe, t.instructor_id), 'who', (select h.code || ' – ' || h.name from public.employees h where h.id = coalesce(x.fe, t.instructor_id)),
                 'who_rank', (select h.rank from public.employees h where h.id = coalesce(x.fe, t.instructor_id)),
                 'branch_id', x.bid, 'branch', (select coalesce(b.display_code, b.code) from public.branches b where b.id = x.bid),
                 'phase2', coalesce(x.is_extra and x.finished_at is null, false),
                 'pending_by', public.app__acc_name(x.cho_by), 'pending_at', x.cho_at) order by x.no), '[]'::jsonb) items,
               count(*) filter (where not x.kt and (x.fe is null or x.fe = t.instructor_id)) n_chua,
               count(*) filter (where x.kt) n_kt,
               count(*) filter (where not x.kt and x.fe is not null and x.fe is distinct from t.instructor_id) n_dang
          from x
      ) it
      where public.app__dt_status(t) <> 'hoan_thanh' and (all_open or (a.employee_id is not null and t.instructor_id = a.employee_id))
    ) z(r)), '[]'::jsonb));
end $$;

revoke execute on function public.app_dt_assign_board(text), public.app_dt_assign_bulk(bigint, integer[], bigint, bigint, text) from public, anon;
grant execute on function public.app_dt_assign_board(text), public.app_dt_assign_bulk(bigint, integer[], bigint, bigint, text) to authenticated;

insert into public.app_migrations(file) values ('149_dao_tao_tab_phan_cong.sql') on conflict (file) do nothing;
