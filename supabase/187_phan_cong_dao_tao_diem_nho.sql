-- 187 (27/11/2026): PHÂN CÔNG ĐÀO TẠO THEO CA — các điểm nhỏ người duyệt nêu ở tệp 174 (anh Tiến giao 27/11).
--  (1) app_dt_plan_assign: lưu lại mà KHÔNG có mục mới cho người dạy (chỉ bớt mục / bấm lưu y nguyên) thì không gửi thông báo
--      "Bạn được giao đào tạo" nữa; số mục trong thông báo = số mục mới. Còn lại y như tệp 174.
--  (2) chỉ mục schedule_published(employee_id) — app__dt_sched tra lịch theo nhân viên (khoá chính bắt đầu bằng week_id nên không dùng được).
--  (3) app_dt_my_plan: danh sách nhân viên Cấp 1 (để Giao lại) chỉ gửi cho người có cấp Quản lý; người khác nhận danh sách rỗng.
--  (4) XEM phiếu (app_dt_get, app_dt_history): thêm quản lý ĐÃ GIAO LẠI một mục của phiếu cho Cấp 1 (training_followups.sub_by).
--      Trước đây quản lý giao lại hết phần mình thì không mở được phiếu, dù vẫn là người Xác nhận đạt các mục đó (tệp 174).
--      Chỉ là quyền XEM một phiếu; không đổi app_can / role_permissions, không đổi ai được sửa / chấm / giao.
--  Mục (3) (4) vá bằng thay chuỗi trên bản đang chạy: đã vá rồi thì bỏ qua, không thấy chuỗi cũ thì DỪNG. Chạy lại nhiều lần không lỗi.

create index if not exists schedule_published_employee on public.schedule_published (employee_id);

-- ---------------------------------------------------------------- (1) giao các mục cho một người ở một ca: chỉ báo khi có mục mới
create or replace function public.app_dt_plan_assign(p_id bigint, p_date date, p_shift text, p_branch bigint, p_employee bigint, p_items integer[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings; f public.training_followups; v integer; br bigint; n int := 0; moved int := 0; skipped int := 0; moi int := 0;
begin
  a := public.app__need(null);
  select * into t from public.trainings where id = p_id for update;
  if not found then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  if not public.app__dt_can_assign(a, t) then
    raise exception 'Chỉ người hướng dẫn chính của phiếu, người phụ trách chính đào tạo hoặc Chủ được giao hạng mục.';
  end if;
  if public.app__dt_status(t) = 'hoan_thanh' then raise exception 'Phiếu đã hoàn thành.'; end if;
  if p_employee is null then raise exception 'Chọn người dạy.'; end if;
  if p_date is null or p_date < public.vn_now()::date then raise exception 'Ngày đã qua không phân công lại được.'; end if;
  select s.branch_id into br from public.app__dt_sched(t.employee_id, t.start_date::date) s
   where s.d = p_date and s.shift = p_shift order by (s.branch_id = p_branch) desc limit 1;
  if br is null then raise exception 'Ca này không có trong lịch đã công bố của nhân viên.'; end if;
  perform set_config('app.dt_bulk', '1', true); perform set_config('app.dt_plan', '1', true);
  -- phần của người này ở ca này mà nay bỏ tích (chưa chấm) → trả về chưa xếp ca (người hướng dẫn chính)
  for f in select * from public.training_followups x where x.training_id = t.id and x.employee_id = p_employee
      and x.work_date = p_date and x.work_shift = p_shift and not (x.item_no = any(coalesce(p_items, '{}'))) loop
    continue when exists (select 1 from public.training_marks mk where mk.training_id = t.id and mk.item_no = f.item_no and mk.level is not null);
    perform public.app_dt_followup_save(t.id, f.item_no, null, null, false, null);
    update public.training_followups set work_date = null, work_shift = null, sub_by = null where training_id = t.id and item_no = f.item_no;
  end loop;
  foreach v in array coalesce(p_items, '{}') loop
    if exists (select 1 from public.training_marks mk where mk.training_id = t.id and mk.item_no = v and mk.level is not null) then
      skipped := skipped + 1; continue;
    end if;
    select * into f from public.training_followups where training_id = t.id and item_no = v;
    if f.work_date is not null and (f.work_date <> p_date or f.work_shift is distinct from p_shift) then moved := moved + 1; end if;
    -- mục MỚI với người này ở ca này (trước đó ở người khác / ca khác / chưa giao) — chỉ khi có mục mới mới báo
    if f.employee_id is distinct from p_employee or f.work_date is distinct from p_date or f.work_shift is distinct from p_shift then moi := moi + 1; end if;
    perform public.app_dt_followup_save(t.id, v, p_employee, null, false, br);
    -- mục đã ở đúng người + đúng ca (vd quản lý đã giao lại cho Cấp 1 này): GIỮ dấu "giao lại bởi"
    update public.training_followups set work_date = p_date, work_shift = p_shift,
      sub_by = case when f.employee_id = p_employee and f.work_date = p_date and f.work_shift is not distinct from p_shift then f.sub_by end
     where training_id = t.id and item_no = v;
    n := n + 1;
  end loop;
  perform set_config('app.dt_bulk', '', true); perform set_config('app.dt_plan', '', true);
  if moi > 0 and p_employee is distinct from a.employee_id then
    perform public.app__notify_emp(p_employee, 'Bạn được giao đào tạo',
      format('Ca %s %s · %s mục · %s', p_shift, to_char(p_date, 'DD/MM'), moi, (select e.code || ' – ' || e.name from public.employees e where e.id = t.employee_id)),
      '/dao-tao/phan-cong');
  end if;
  perform public.app_log('dao_tao_phan_cong_ca', format('training=%s date=%s shift=%s employee=%s items=%s', p_id, p_date, p_shift, p_employee, p_items));
  return jsonb_build_object('n', n, 'moved', moved, 'skipped', skipped, 'moi', moi);
end $$;

-- ---------------------------------------------------------------- (3) (4) vá thay chuỗi
do $$
declare d text; x record;
begin
  for x in select * from (values
      ('public.app_dt_my_plan()', 'from public.employees e where e.rank = ''Cấp 1'' and e.status = ''Đang làm'' and exists (select 1 from public.accounts x where x.employee_id = e.id and x.locked = 0)',
        'from public.employees e where exists (select 1 from public.employees q where q.id = me and q.rank = ''Quản lý'') and e.rank = ''Cấp 1'' and e.status = ''Đang làm'' and exists (select 1 from public.accounts x where x.employee_id = e.id and x.locked = 0)'),
      ('public.app_dt_get(bigint)', 'f.training_id = t.id and f.employee_id = me_emp)', 'f.training_id = t.id and (f.employee_id = me_emp or f.sub_by = me_emp))'),
      ('public.app_dt_history(bigint)', 'f.training_id = t.id and f.employee_id = me_emp)', 'f.training_id = t.id and (f.employee_id = me_emp or f.sub_by = me_emp))')
    ) v(fn, cu, moi) loop
    d := pg_get_functiondef(x.fn::regprocedure);
    continue when position(x.moi in d) > 0;
    if (length(d) - length(replace(d, x.cu, ''))) / length(x.cu) <> 1 then
      raise exception 'tệp 187: % không có đúng một chỗ cần vá — dừng, không đổi gì.', x.fn;
    end if;
    execute replace(d, x.cu, x.moi);
  end loop;
end $$;

-- quyền gọi giữ như tệp 174 (create or replace không đổi quyền; ghi lại cho chắc)
revoke all on function public.app_dt_plan_assign(bigint, date, text, bigint, bigint, integer[]) from public, anon;
grant execute on function public.app_dt_plan_assign(bigint, date, text, bigint, bigint, integer[]) to authenticated;

insert into public.app_migrations(file) values ('187_phan_cong_dao_tao_diem_nho.sql') on conflict (file) do nothing;
