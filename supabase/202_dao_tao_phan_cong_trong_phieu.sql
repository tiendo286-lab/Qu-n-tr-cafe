-- 202: Phân công nằm trong thẻ ngày của phiếu đào tạo (anh Tiến 28/11/2026: "gộp thao tác phân công vào thẻ ngày").
-- Chỉ THÊM một hàm ĐỌC: app_dt_plan_one(p_id) — lịch đi làm đã công bố + phân công theo ca của MỘT phiếu.
--   * Ai đọc được: đúng những người mở được phiếu đó (cùng điều kiện với app_dt_get) → quản lý / quản lý tổng xem được ai dạy ca nào.
--   * Ai giao / sửa / bỏ phân công: KHÔNG ĐỔI — vẫn do app_dt_plan_assign / app_dt_plan_unassign chặn (Chủ, người phụ trách chính, HD chính của phiếu).
--     can_assign chỉ để web ẩn / hiện nút.
--   * Dữ liệu một dòng giống hệt một dòng của app_dt_plan_board (tệp 174 / 187) để web dùng chung mã.
-- Không đổi bảng, không đổi hàm cũ, không đụng tiền. Chạy lại nhiều lần không sao.

create or replace function public.app_dt_plan_one(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; t public.trainings; me_emp bigint;
begin
  a := public.app__need(null);
  select * into t from public.trainings where id = p_id;
  if t.id is null then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  me_emp := public.app_my_employee();
  -- cùng điều kiện xem với app_dt_get (tệp 148); coalesce để NULL không lọt qua kiểm tra
  if not (coalesce(public.app_can('dao_tao'), false) or coalesce(public.app_can('quan_ly_nhan_vien'), false)
          or coalesce(me_emp = any(array_remove(array[t.employee_id, t.instructor_id, t.cont_trainer_id], null)), false)
          or coalesce(public.app__dt_can_assign(a, t), false)
          or exists (select 1 from public.training_followups f where f.training_id = t.id and f.employee_id = me_emp)) then
    raise exception 'Bạn không xem được phiếu đào tạo này.';
  end if;
  return jsonb_build_object('today', public.vn_now()::date::text,
    'can_assign', coalesce(public.app__dt_can_assign(a, t), false) and public.app__dt_status(t) <> 'hoan_thanh',
    'trainers', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.code || ' – ' || e.name, 'rank', e.rank,
        'branches', coalesce((select jsonb_agg(coalesce(b.display_code, b.code) order by b.sort_order) from public.employee_branches eb
                               join public.branches b on b.id = eb.branch_id where eb.employee_id = e.id), '[]'::jsonb)) order by e.rank desc, e.code)
      from public.employees e where e.status = 'Đang làm' and e.rank in ('Cấp 1', 'Quản lý')
        and exists (select 1 from public.accounts x where x.employee_id = e.id and x.locked = 0)), '[]'::jsonb),
    'row', (select jsonb_build_object(
        'id', t.id, 'employee_id', t.employee_id, 'employee', e.code || ' – ' || e.name, 'program', pr.name,
        'start_date', t.start_date, 'due', (t.start_date::date + 12)::text,
        'branch', (select coalesce(b.display_code, b.code) from public.branches b where b.id = t.branch_id),
        'instructor_id', t.instructor_id, 'instructor', (select h.code || ' – ' || h.name from public.employees h where h.id = t.instructor_id),
        'achieved', public.app__dt_achieved(t.id), 'total', public.app__dt_total(t.program_id), 'can_check', coalesce(public.app__dt_can_check(a, t), false),
        'shifts', coalesce((select jsonb_agg(jsonb_build_object('date', s.d::text, 'branch_id', s.branch_id,
              'branch', (select coalesce(b.display_code, b.code) from public.branches b where b.id = s.branch_id), 'shift', s.shift,
              'mates', public.app__dt_mates(s.d, s.shift, s.branch_id, t.employee_id))
            order by s.d, coalesce(array_position(public.app__shifts(), s.shift), 99))
          from public.app__dt_sched(t.employee_id, t.start_date::date) s), '[]'::jsonb),
        'items', coalesce((select jsonb_agg(jsonb_build_object('no', i.no, 'day', i.day, 'title', i.title,
              'state', public.app__dt_item_state(m), 'level', m.level, 'who_id', f.employee_id, 'date', f.work_date::text, 'shift', f.work_shift,
              'branch_id', f.branch_id, 'sub_by', f.sub_by,
              'pending_by', case when m.cho_kiem_tra and m.level is not null then public.app__acc_name(m.cho_by) end,
              'pending_at', case when m.cho_kiem_tra and m.level is not null then m.cho_at end) order by i.no)
          from public.training_items i
          left join public.training_marks m on m.training_id = t.id and m.item_no = i.no
          left join public.training_followups f on f.training_id = t.id and f.item_no = i.no
          where i.program_id = t.program_id), '[]'::jsonb))
      from public.employees e join public.training_programs pr on pr.id = t.program_id where e.id = t.employee_id));
end $$;

revoke all on function public.app_dt_plan_one(bigint) from public, anon;
grant execute on function public.app_dt_plan_one(bigint) to authenticated;

insert into public.app_migrations(file) values ('202_dao_tao_phan_cong_trong_phieu.sql') on conflict (file) do nothing;
