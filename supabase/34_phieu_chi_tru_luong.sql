-- =====================================================================
-- BƯỚC 34: BỎ TAB KHOẢN ÂM → PHIẾU CHI TRỪ LƯƠNG TRONG THU CHI — anh Tiến chốt 11/11/2026. Chạy sau 33. Chạy lại nhiều lần không sao.
--  * Mỗi người chịu khoản thiếu (từ đối soát ca) = 1 phiếu chi "Thiếu tiền ca – <nhân viên>" hiện trong danh sách Thu chi.
--    Không tính vào tổng chi của quán (tiền trừ vào lương).
--  * Quản lý + Chủ (người xem / sửa được thu chi của cơ sở) sửa được: người chịu, số tiền, tình trạng (Trừ lương / Đã bù / Miễn);
--    xóa được (thành "Đã hủy", báo nhân viên). Tháng đã chốt thì khóa.
-- =====================================================================

create or replace function public.app_tc_list(p_branch bigint, p_from text, p_to text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts := public.app_account(); brs bigint[]; rows jsonb;
begin
  if a.id is null then raise exception 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'; end if;
  if p_from is null or p_to is null or p_from !~ '^\d{4}-\d{2}-\d{2}$' or p_to !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Khoảng ngày không hợp lệ.'; end if;
  select coalesce(array_agg(b.id order by b.sort_order), '{}') into brs from public.branches b
   where b.status = 'Đang hoạt động' and public.app__tc_can(b.id) and (p_branch is null or b.id = p_branch);
  if p_branch is not null and coalesce(array_length(brs, 1), 0) = 0 then raise exception 'Bạn không được xem thu chi của cơ sở này.'; end if;

  select coalesce(jsonb_agg(z.j order by z.d desc, z.br, z.o), '[]') into rows from (
    select m.work_date as d, m.branch_id as br, array_position(public.app__shifts(), m.shift) * 1000 + m.ord as o,
           jsonb_build_object('src', 'ca', 'report_id', m.report_id, 'mkey', m.mkey, 'branch_id', m.branch_id,
             'date', m.work_date, 'shift', m.shift, 'kind', case when m.amount < 0 then 'chi' else 'thu' end, 'pay', m.pay,
             'amount', abs(m.amount), 'note', m.note, 'category_id', fc.category_id, 'category', c.name,
             'excluded', coalesce(fc.excluded, case when m.amount > 0 then 1 else 0 end) = 1,
             'status', case when coalesce(fc.checked, 0) = 1 then 'da' else 'cho' end,
             'checked_by', public.app__acc_name(fc.checked_by), 'checked_at', fc.checked_at,
             'by', public.app__acc_name(m.created_by), 'locked', public.app__fin_locked(m.branch_id, m.work_date)) as j
      from public.app__tc_moves(null, p_from, p_to) m
      left join public.fin_move_cats fc on fc.report_id = m.report_id and fc.mkey = m.mkey
      left join public.fin_categories c on c.id = fc.category_id
     where m.branch_id = any(brs)
    union all
    select e.entry_date, e.branch_id, 100000 + e.id,
           jsonb_build_object('src', 'tay', 'id', e.id, 'branch_id', e.branch_id, 'date', e.entry_date, 'shift', null,
             'kind', e.kind, 'pay', e.pay_method, 'amount', e.amount, 'note', e.note, 'category_id', e.category_id, 'category', c.name,
             'excluded', false, 'status', 'da', 'checked_by', public.app__acc_name(e.created_by), 'checked_at', e.created_at,
             'by', public.app__acc_name(e.created_by), 'locked', public.app__fin_locked(e.branch_id, e.entry_date))
      from public.fin_entries e left join public.fin_categories c on c.id = e.category_id
     where e.branch_id = any(brs) and e.entry_date between p_from and p_to
    union all
    -- bước 34: phiếu chi trừ lương (khoản âm) — hiện trong Thu chi, không tính vào chi phí quán
    select r.work_date, r.branch_id, 200000 + s.id,
           jsonb_build_object('src', 'ka', 'id', s.id, 'report_id', s.report_id, 'branch_id', r.branch_id, 'date', r.work_date, 'shift', r.shift,
             'kind', 'chi', 'pay', null, 'amount', s.amount, 'note', 'Thiếu tiền ca – ' || coalesce(em.code || ' – ' || em.name, '?'),
             'item', s.item, 'item_label', public.app__ca_item_label(s.item), 'employee_id', s.employee_id, 'employee', em.code || ' – ' || em.name,
             'reason', s.reason, 'ka_status', s.status, 'auto_tru', s.auto_tru, 'status_note', s.status_note, 'reply', s.reply, 'reply_at', s.reply_at,
             'seen_at', s.seen_at, 'category_id', null, 'category', null, 'excluded', true, 'status', 'da',
             'checked_by', public.app__acc_name(s.created_by), 'checked_at', s.created_at, 'by', public.app__acc_name(s.created_by),
             'locked', public.app__fin_locked(r.branch_id, r.work_date))
      from public.shift_shortfalls s join public.shift_reports r on r.id = s.report_id left join public.employees em on em.id = s.employee_id
     where s.status <> 'huy' and r.branch_id = any(brs) and r.work_date between p_from and p_to
  ) z;

  return jsonb_build_object('rows', rows,
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code), 'name', b.name) order by b.sort_order)
                 from public.branches b where b.status = 'Đang hoạt động' and public.app__tc_can(b.id)), '[]'),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'name', c.name, 'active', c.active = 1) order by c.kind, c.sort_order, c.name)
                 from public.fin_categories c), '[]'));
end $$;

-- Sửa phiếu chi trừ lương
create or replace function public.app_ka_edit(p_id bigint, p_employee bigint, p_amount bigint, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; s public.shift_shortfalls; r public.shift_reports; st text := coalesce(p_status, 'tru_luong');
        nt text := nullif(trim(coalesce(p_note, '')), ''); lbl text;
begin
  select * into s from public.shift_shortfalls where id = p_id for update;
  if s.id is null or s.status = 'huy' then raise exception 'Không tìm thấy phiếu (có thể đã bị xóa).'; end if;
  select * into r from public.shift_reports where id = s.report_id;
  a := public.app__tc_need(r.branch_id);
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng % đã chốt nên không sửa được.', left(r.work_date, 7); end if;
  if st not in ('tru_luong', 'da_bu', 'mien') then raise exception 'Chọn Trừ lương, Đã bù hoặc Miễn.'; end if;
  if st = 'mien' and nt is null then raise exception 'Miễn khoản âm phải ghi lý do.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Số tiền phải lớn hơn 0.'; end if;
  if p_employee is null or not exists (select 1 from public.employees where id = p_employee) then raise exception 'Chọn nhân viên chịu khoản này.'; end if;
  lbl := case st when 'da_bu' then 'Đã bù' when 'tru_luong' then 'Trừ lương' else 'Miễn' end;
  update public.shift_shortfalls set employee_id = p_employee, amount = p_amount, status = st, auto_tru = false,
         status_note = nt, status_by = a.id, status_at = case when status = st and status_at is not null then status_at else public.vn_now_text() end,
         seen_at = case when employee_id = p_employee and amount = p_amount then seen_at end
   where id = p_id;
  if s.employee_id <> p_employee then
    perform public.app__notify_emp(s.employee_id, 'Khoản âm đã chuyển cho người khác',
      public.app__ca_title(r) || ' · ' || public.app__vnd(s.amount) || ': quản lý đã bỏ khoản này khỏi bạn.', '/cua-toi/khoan-am');
  end if;
  perform public.app__notify_emp(p_employee, 'Khoản âm: ' || lbl,
    public.app__ca_title(r) || ' · ' || public.app__ca_item_label(s.item) || ': ' || public.app__vnd(p_amount) || ' → ' || lbl
    || coalesce(E'\n' || nt, '') || E'\nNgười sửa: ' || public.app__acc_name(a.id), '/cua-toi/khoan-am');
  perform public.app_log('khoan_am_sua', 'id=' || p_id || ' report=' || s.report_id || ' ' || p_amount || ' ' || st);
end $$;

-- Xóa phiếu chi trừ lương (thành Đã hủy, giữ lịch sử, báo nhân viên)
create or replace function public.app_ka_delete(p_id bigint, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; s public.shift_shortfalls; r public.shift_reports; nt text := coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Quản lý xóa phiếu');
begin
  select * into s from public.shift_shortfalls where id = p_id for update;
  if s.id is null or s.status = 'huy' then return; end if;
  select * into r from public.shift_reports where id = s.report_id;
  a := public.app__tc_need(r.branch_id);
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng % đã chốt nên không xóa được.', left(r.work_date, 7); end if;
  update public.shift_shortfalls set status = 'huy', auto_tru = false, status_note = nt, status_by = a.id, status_at = public.vn_now_text() where id = p_id;
  perform public.app__notify_emp(s.employee_id, 'Khoản âm đã được hủy',
    public.app__ca_title(r) || ' · ' || public.app__ca_item_label(s.item) || ': khoản ' || public.app__vnd(s.amount) || ' đã hủy. ' || nt, '/cua-toi/khoan-am');
  perform public.app_log('khoan_am_xoa', 'id=' || p_id || ' report=' || s.report_id || ' ' || s.amount);
end $$;

revoke execute on function public.app_ka_edit(bigint, bigint, bigint, text, text), public.app_ka_delete(bigint, text) from public, anon;
grant execute on function public.app_ka_edit(bigint, bigint, bigint, text, text), public.app_ka_delete(bigint, text) to authenticated;
