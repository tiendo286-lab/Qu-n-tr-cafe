-- =====================================================================
-- BƯỚC 68: GỘP ÂM TIỀN VÀ TRỪ LƯƠNG Ở THU CHI (anh Tiến chốt 13/11/2026). Chạy sau 67. Chạy lại không sao.
--  * Mỗi ca thiếu tiền = 1 dòng "Âm tiền" ở Thu chi; mở ra thấy ai chịu, bao nhiêu (không còn từng dòng TL riêng) — phần gộp làm ở giao diện.
--  * Khoản "Âm tiền" nhân viên ghi là khoản chi trên phiếu ca → quản lý gán:
--      - TRỪ LƯƠNG (app_tc_move_to_ka): chọn người chịu + số tiền (tổng = khoản) → khoản chi thành "Không tính" (không còn chi phí),
--        sinh khoản âm mục "Âm tiền (phiếu ca)" (shift_shortfalls.move_mkey), mặc định trừ lương, báo nhân viên (giải trình được như khoản âm thường);
--      - ÂM TIỀN THƯỜNG (quán chịu, không trừ lương): đối soát vào nhóm "Âm tiền – quán chịu" (chi phí).
--      - Bỏ gán (app_tc_move_ka_undo) / huỷ hết người chịu → khoản trở lại chờ gán.
--  * Khoản âm gắn khoản phiếu ca dùng mục riêng 'am_tien' → đối soát lại mục Tiền mặt / Chuyển khoản không tự huỷ.
-- =====================================================================

alter table public.shift_shortfalls add column if not exists move_mkey text;
create index if not exists ix_shift_shortfalls_move on public.shift_shortfalls (report_id, move_mkey) where move_mkey is not null;

-- Nhóm chi "Âm tiền – quán chịu" (thuộc loại "Chi phí khác" nếu có)
insert into public.fin_categories(kind, name, sort_order, active, type_id)
select 'chi', 'Âm tiền – quán chịu', 95, 1, (select t.id from public.fin_cat_types t where t.kind = 'chi' and t.name = 'Chi phí khác' limit 1)
 where not exists (select 1 from public.fin_categories where kind = 'chi' and name = 'Âm tiền – quán chịu');

create or replace function public.app__tc_move_ka(p_report bigint, p_mkey text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shift_shortfalls s where s.report_id = p_report and s.move_mkey = p_mkey and s.status <> 'huy')
$$;

-- Thay bản 51: nhãn mục 'am_tien'
create or replace function public.app__ca_item_label(p text) returns text
language sql immutable as $$ select case p when 'tien_mat' then 'Tiền mặt' when 'chuyen_khoan' then 'Chuyển khoản' when 'thu_chi' then 'Thu chi'
  when 'cong_no' then 'Công nợ' when 'thoi_gian' then 'Thời gian doanh thu' when 'doanh_thu' then 'Doanh thu & số cốc'
  when 'nhan_su' then 'Nhân viên trong ca' when 'ban_giao' then 'Bàn giao ca sau' when 'nhap_hang' then 'Nhập hàng' when 'am_tien' then 'Âm tiền (phiếu ca)' else p end $$;

-- Trường số liệu (bản đối soát) gắn với từng hạng mục — mục khoá thì các trường này không sửa được
create or replace function public.app__ca_item_fields(p_item text) returns text[]
language sql immutable as $$
  select case p_item
    when 'thoi_gian' then array['rev_start', 'rev_end']
    when 'doanh_thu' then array['total_revenue', 'pos_cash', 'pos_transfer', 'cups', 'opening_cash']
    when 'tien_mat' then array['cash_counted', 'opening_cash', 'pos_cash', 'moves']
    when 'chuyen_khoan' then array['reported_transfer', 'pos_transfer', 'moves']
    when 'thu_chi' then array['moves']
    when 'nhan_su' then array['staff']
    when 'nhap_hang' then array['goods_status', 'goods_note', 'goods']
    else '{}'::text[] end
$$;

-- ---------------------------------------------------------------- Gán khoản "Âm tiền" ở phiếu ca thành trừ lương
-- p_people: [{employee_id, amount}] — tổng phải bằng số tiền khoản
create or replace function public.app_tc_move_to_ka(p_report bigint, p_mkey text, p_people jsonb, p_reason text) returns int
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; m record; x jsonb; tot bigint := 0; n int := 0; why text;
begin
  select * into r from public.shift_reports where id = p_report for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__tc_need(r.branch_id);
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không sửa được.'; end if;
  select * into m from public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) t where t.report_id = p_report and t.mkey = p_mkey;
  if m.report_id is null then raise exception 'Khoản này vừa thay đổi. Tải lại trang.'; end if;
  if m.auto is not null or m.amount >= 0 then raise exception 'Chỉ khoản CHI nhân viên ghi mới gán âm tiền được.'; end if;
  if public.app__tc_move_ka(p_report, p_mkey) then raise exception 'Khoản này đã gán trừ lương rồi.'; end if;
  if exists (select 1 from public.branch_loans l where l.report_id = p_report and l.mkey = p_mkey) then raise exception 'Khoản này đã đổi thành cho vay.'; end if;
  if jsonb_typeof(p_people) <> 'array' or jsonb_array_length(p_people) = 0 then raise exception 'Chọn ít nhất 1 người chịu.'; end if;
  for x in select value from jsonb_array_elements(p_people) loop
    if not exists (select 1 from public.employees e where e.id = (x ->> 'employee_id')::bigint) then raise exception 'Nhân viên không hợp lệ.'; end if;
    if coalesce((x ->> 'amount')::bigint, 0) <= 0 then raise exception 'Số tiền mỗi người phải lớn hơn 0.'; end if;
    tot := tot + (x ->> 'amount')::bigint;
  end loop;
  if (select count(distinct value ->> 'employee_id') from jsonb_array_elements(p_people)) <> jsonb_array_length(p_people) then raise exception 'Mỗi người chỉ ghi 1 lần.'; end if;
  if tot <> -m.amount then raise exception 'Tổng người chịu (%) phải bằng số tiền khoản (%).', public.app__vnd(tot), public.app__vnd(-m.amount); end if;
  why := coalesce(nullif(trim(coalesce(p_reason, '')), ''), m.note);
  for x in select value from jsonb_array_elements(p_people) loop
    insert into public.shift_shortfalls(report_id, item, employee_id, amount, reason, created_by, status, auto_tru, status_note, status_by, status_at, move_mkey)
    values (p_report, 'am_tien', (x ->> 'employee_id')::bigint, (x ->> 'amount')::bigint, why, a.id, 'tru_luong', true, 'Mặc định trừ lương (âm tiền ghi trên phiếu ca)', a.id, public.vn_now_text(), p_mkey);
    perform public.app__notify_emp((x ->> 'employee_id')::bigint, 'Bạn có khoản âm — mặc định trừ lương',
      public.app__ca_title(r) || ' · Âm tiền: bạn chịu ' || public.app__vnd((x ->> 'amount')::bigint) || E'\nLý do: ' || why || E'\nNgười gán: ' || public.app__acc_name(a.id)
      || E'\nMặc định: TRỪ LƯƠNG. Không đồng ý thì gửi giải trình ở mục Khoản âm của tôi.', '/cua-toi/khoan-am');
    n := n + 1;
  end loop;
  insert into public.fin_move_cats(report_id, mkey, category_id, excluded, by_account, at, checked, checked_by, checked_at)
  values (p_report, p_mkey, null, 1, a.id, public.vn_now_text(), 1, a.id, public.vn_now_text())
  on conflict (report_id, mkey) do update set category_id = null, excluded = 1, by_account = excluded.by_account, at = excluded.at, checked = 1, checked_by = excluded.checked_by, checked_at = excluded.checked_at;
  perform public.app_log('am_tien_tru_luong', 'report=' || p_report || ' ' || -m.amount || ' ' || n || ' người');
  return n;
end $$;

create or replace function public.app_tc_move_ka_undo(p_report bigint, p_mkey text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; s public.shift_shortfalls;
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__tc_need(r.branch_id);
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không sửa được.'; end if;
  if exists (select 1 from public.shift_shortfalls x where x.report_id = p_report and x.move_mkey = p_mkey and (x.status in ('da_bu', 'mien') or (x.status = 'tru_luong' and not x.auto_tru))) then
    raise exception 'Có người đã bù / đã xác nhận trừ lương / được miễn — sửa từng người ở dòng Âm tiền thay vì bỏ gán cả khoản.';
  end if;
  for s in select * from public.shift_shortfalls x where x.report_id = p_report and x.move_mkey = p_mkey and x.status <> 'huy' loop
    update public.shift_shortfalls set status = 'huy', auto_tru = false, status_note = 'Bỏ gán âm tiền', status_by = a.id, status_at = public.vn_now_text() where id = s.id;
    perform public.app__notify_emp(s.employee_id, 'Khoản âm đã được hủy', public.app__ca_title(r) || ' · Âm tiền: khoản ' || public.app__vnd(s.amount) || ' đã hủy.', '/cua-toi/khoan-am');
  end loop;
  delete from public.fin_move_cats where report_id = p_report and mkey = p_mkey;
  perform public.app_log('am_tien_bo_gan', 'report=' || p_report);
end $$;

-- Thay bản 65
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
             'checked_by', public.app__acc_name(fc.checked_by), 'checked_at', fc.checked_at, 'auto', m.auto,
             'loan_id', (select l.id from public.branch_loans l where l.report_id = m.report_id and l.mkey = m.mkey),
             'ka_n', (select count(*) from public.shift_shortfalls s where s.report_id = m.report_id and s.move_mkey = m.mkey and s.status <> 'huy'),
             'by', public.app__acc_name(m.created_by), 'locked', public.app__fin_locked(m.branch_id, m.work_date)) as j
      from public.app__tc_moves_x(null, p_from, p_to) m
      left join public.fin_move_cats fc on fc.report_id = m.report_id and fc.mkey = m.mkey
      left join public.fin_categories c on c.id = fc.category_id
     where m.branch_id = any(brs)
    union all
    select e.entry_date, e.branch_id, 100000 + e.id,
           jsonb_build_object('src', 'tay', 'id', e.id, 'branch_id', e.branch_id, 'date', e.entry_date, 'shift', null,
             'kind', e.kind, 'pay', e.pay_method, 'amount', e.amount, 'note', e.note, 'category_id', e.category_id, 'category', c.name,
             'excluded', false, 'status', 'da', 'checked_by', public.app__acc_name(e.created_by), 'checked_at', e.created_at,
             'bank_out', exists (select 1 from public.shift_bank_outs o where o.fin_entry_id = e.id),
             'by', public.app__acc_name(e.created_by), 'locked', public.app__fin_locked(e.branch_id, e.entry_date))
      from public.fin_entries e left join public.fin_categories c on c.id = e.category_id
     where e.branch_id = any(brs) and e.entry_date between p_from and p_to
    union all
    select r.work_date, r.branch_id, 200000 + s.id,
           jsonb_build_object('src', 'ka', 'id', s.id, 'report_id', s.report_id, 'branch_id', r.branch_id, 'date', r.work_date, 'shift', r.shift,
             'kind', 'chi', 'pay', null, 'amount', s.amount, 'note', 'Thiếu tiền ca – ' || coalesce(em.code || ' – ' || em.name, '?'),
             'item', s.item, 'item_label', public.app__ca_item_label(s.item), 'employee_id', s.employee_id, 'employee', em.code || ' – ' || em.name,
             'reason', s.reason, 'ka_status', s.status, 'move_mkey', s.move_mkey, 'auto_tru', s.auto_tru, 'status_note', s.status_note, 'reply', s.reply, 'reply_at', s.reply_at,
             'seen_at', s.seen_at, 'category_id', null, 'category', null, 'excluded', true, 'status', 'da',
             'checked_by', public.app__acc_name(s.created_by), 'checked_at', s.created_at, 'by', public.app__acc_name(s.created_by),
             'locked', public.app__fin_locked(r.branch_id, r.work_date))
      from public.shift_shortfalls s join public.shift_reports r on r.id = s.report_id left join public.employees em on em.id = s.employee_id
     where s.status <> 'huy' and r.branch_id = any(brs) and r.work_date between p_from and p_to
  ) z;

  return jsonb_build_object('rows', rows, 'can_money', coalesce(public.app_can('doi_soat'), false), 'can_direct', coalesce(public.app__fin_admin(), false),
    'loan_branches', coalesce((select jsonb_agg(b.id) from public.branches b where b.id = any(brs) and public.app__loan_branch_ok(b.id)), '[]'),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code), 'name', b.name) order by b.sort_order)
                 from public.branches b where b.status = 'Đang hoạt động' and public.app__tc_can(b.id)), '[]'),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'name', c.name, 'active', c.active = 1) order by c.kind, c.sort_order, c.name)
                 from public.fin_categories c), '[]'));
end $$;

-- Thay bản 65
create or replace function public.app_tc_check(p_report bigint, p_mkey text, p_category bigint, p_excluded boolean, p_checked boolean) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; m record; ex boolean := coalesce(p_excluded, false); ok boolean := coalesce(p_checked, false);
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__tc_need(r.branch_id);
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không sửa được.'; end if;
  select * into m from public.app__tc_moves(r.branch_id, r.work_date, r.work_date) x where x.report_id = p_report and x.mkey = p_mkey;
  if m.report_id is null then raise exception 'Dòng thu chi này đã thay đổi trên phiếu ca. Tải lại trang.'; end if;
  if public.app__tc_move_ka(p_report, p_mkey) then
    raise exception 'Khoản này đã gán âm tiền TRỪ LƯƠNG — bấm "Bỏ gán" ở dòng Âm tiền trước khi sửa / đổi nhóm.';
  end if;
  if exists (select 1 from public.branch_loans l where l.report_id = p_report and l.mkey = p_mkey) then
    raise exception 'Khoản "%" đã đổi thành cho vay — xem ở khung Cho vay (xoá khoản vay đó thì khoản trở lại Thu chi).', m.note;
  end if;
  if ok and not ex and p_category is null then raise exception 'Chọn nhóm (hoặc "Không tính") rồi mới đối soát.'; end if;
  if not ex and p_category is not null and not exists (select 1 from public.fin_categories c where c.id = p_category and c.kind = case when m.amount < 0 then 'chi' else 'thu' end) then
    raise exception 'Nhóm không đúng loại Thu / Chi.';
  end if;
  insert into public.fin_move_cats(report_id, mkey, category_id, excluded, by_account, at, checked, checked_by, checked_at)
  values (p_report, p_mkey, case when ex then null else p_category end, case when ex then 1 else 0 end, a.id, public.vn_now_text(),
          case when ok then 1 else 0 end, case when ok then a.id end, case when ok then public.vn_now_text() end)
  on conflict (report_id, mkey) do update set category_id = excluded.category_id, excluded = excluded.excluded, by_account = excluded.by_account, at = excluded.at,
          checked = excluded.checked, checked_by = excluded.checked_by, checked_at = excluded.checked_at;
  perform public.app_log(case when ok then 'thu_chi_doi_soat' else 'thu_chi_bo_doi_soat' end, 'report=' || p_report || ' ' || m.amount || ' ' || m.note);
end $$;

-- Thay bản 65
create or replace function public.app_tc_move_edit(p_report bigint, p_mkey text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; m record; d jsonb; mv jsonb; nmv jsonb; n int;
        k text; amt bigint; pm text; nt text; cat bigint; ex boolean; why text; signed bigint; money boolean;
        oldk jsonb; newk jsonb; saved jsonb; it text; adm boolean := false; res text := null; x record;
begin
  select * into r from public.shift_reports where id = p_report for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__tc_need(r.branch_id);
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không sửa được.'; end if;
  select * into m from public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) t where t.report_id = p_report and t.mkey = p_mkey;
  if m.report_id is null then raise exception 'Khoản này vừa thay đổi. Tải lại trang rồi sửa lại.'; end if;
  if m.auto is not null then raise exception 'Khoản tự động (chi lương / khách mượn) — sửa ở mục Nhân viên / Công nợ của phiếu ca.'; end if;
  if public.app__tc_move_ka(p_report, p_mkey) then
    raise exception 'Khoản này đã gán âm tiền TRỪ LƯƠNG — bấm "Bỏ gán" ở dòng Âm tiền trước khi sửa / đổi nhóm.';
  end if;
  if exists (select 1 from public.branch_loans l where l.report_id = p_report and l.mkey = p_mkey) then
    raise exception 'Khoản này đã đổi thành cho vay — sửa người vay / ghi chú ở khung Cho vay; sai số tiền thì xoá khoản vay (khoản trở lại Thu chi) rồi sửa.';
  end if;

  k := coalesce(nullif(p ->> 'kind', ''), case when m.amount < 0 then 'chi' else 'thu' end);
  amt := nullif(p ->> 'amount', '')::bigint; pm := coalesce(nullif(p ->> 'pay', ''), m.pay); nt := trim(coalesce(p ->> 'note', m.note));
  cat := nullif(p ->> 'category_id', '')::bigint; ex := coalesce((p ->> 'excluded')::boolean, false); why := nullif(trim(coalesce(p ->> 'reason', '')), '');
  if k not in ('thu', 'chi') then raise exception 'Chọn Thu hay Chi.'; end if;
  if amt is null or amt <= 0 then raise exception 'Nhập số tiền lớn hơn 0.'; end if;
  if pm not in ('tien_mat', 'chuyen_khoan') then raise exception 'Chọn tiền mặt hay chuyển khoản.'; end if;
  if nt = '' then raise exception 'Ghi nội dung khoản.'; end if;
  if not ex and cat is null then raise exception 'Chọn nhóm (hoặc "Không tính").'; end if;
  if not ex and not exists (select 1 from public.fin_categories c where c.id = cat and c.kind = k) then raise exception 'Nhóm không đúng loại Thu / Chi.'; end if;
  signed := case when k = 'chi' then -amt else amt end;
  money := signed <> m.amount or pm <> m.pay;

  -- anh Tiến chốt: Chủ / Quản lý tổng SỬA THẲNG (không mở lại mục tiền, ca đã đối soát giữ nguyên, ghi nhật ký + lý do);
  -- người có quyền Đối soát khác chỉ sửa được khi mục Tiền mặt / Chuyển khoản liên quan của ca CHƯA đối soát.
  if money then
    if why is null then raise exception 'Ghi lý do sửa số tiền / hình thức.'; end if;
    adm := coalesce(public.app__fin_admin(), false);
    if not adm then
      if not coalesce(public.app_can('doi_soat'), false) then raise exception 'Sửa số tiền / hình thức khoản ở phiếu ca cần quyền Đối soát. Bạn đổi được nhóm và nội dung.'; end if;
      foreach it in array array[m.pay, pm] loop
        if exists (select 1 from public.shift_report_checks c where c.report_id = p_report and c.item = it) then
          raise exception 'Mục % của ca này đã đối soát xong — chỉ Chủ / Quản lý tổng sửa được số tiền / hình thức. Bạn đổi được nhóm và nội dung.', public.app__ca_item_label(it);
        end if;
      end loop;
    end if;
  end if;

  -- mkey cũ theo thứ tự + nhóm đã chọn (để mang sang mkey mới)
  select coalesce(jsonb_object_agg(t.ord::text, t.mkey), '{}') into oldk from public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) t where t.report_id = p_report;
  select coalesce(jsonb_object_agg(t.ord::text, to_jsonb(fc)), '{}') into saved
    from public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) t join public.fin_move_cats fc on fc.report_id = t.report_id and fc.mkey = t.mkey
   where t.report_id = p_report;

  insert into public.shift_report_recon(report_id, data, updated_by) values (p_report, public.app__recon_snapshot(p_report), a.id) on conflict (report_id) do nothing;
  select data into d from public.shift_report_recon where report_id = p_report for update;
  n := jsonb_array_length(coalesce(d -> 'moves', '[]'));
  if m.ord > n then raise exception 'Khoản này không sửa được ở đây.'; end if;
  mv := d -> 'moves' -> (m.ord - 1)::int;
  if mv ->> 'kind' is distinct from m.pay or (mv ->> 'amount')::bigint is distinct from m.amount then raise exception 'Khoản này vừa thay đổi. Tải lại trang rồi sửa lại.'; end if;
  nmv := mv || jsonb_build_object('kind', pm, 'amount', signed, 'note', nt);
  if nmv is distinct from mv then
    d := jsonb_set(d, array['moves', (m.ord - 1)::text], nmv);
    update public.shift_report_recon set data = d, updated_by = a.id, updated_at = public.vn_now_text() where report_id = p_report;
    insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
    values (p_report, 'sua', 'moves', mv, nmv, coalesce(why, 'Sửa ở trang Thu chi'), a.id);
  end if;

  -- mang nhóm sang mkey mới (khoản trùng nội dung có thể đổi số thứ tự)
  select coalesce(jsonb_object_agg(t.ord::text, t.mkey), '{}') into newk from public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) t where t.report_id = p_report;
  for x in select key from jsonb_each_text(oldk) where (oldk ->> key) is distinct from (newk ->> key) loop
    delete from public.fin_move_cats where report_id = p_report and mkey = oldk ->> x.key;
  end loop;
  for x in select key from jsonb_each(saved) where (oldk ->> key) is distinct from (newk ->> key) and newk ? key and key <> m.ord::text loop
    insert into public.fin_move_cats(report_id, mkey, category_id, excluded, by_account, at, checked, checked_by, checked_at)
    values (p_report, newk ->> x.key, nullif(saved -> x.key ->> 'category_id', '')::bigint, (saved -> x.key ->> 'excluded')::int,
            nullif(saved -> x.key ->> 'by_account', '')::bigint, coalesce(saved -> x.key ->> 'at', public.vn_now_text()),
            (saved -> x.key ->> 'checked')::int, nullif(saved -> x.key ->> 'checked_by', '')::bigint, saved -> x.key ->> 'checked_at')
    on conflict (report_id, mkey) do update set category_id = excluded.category_id, excluded = excluded.excluded, checked = excluded.checked,
            checked_by = excluded.checked_by, checked_at = excluded.checked_at;
  end loop;
  -- khoản vừa sửa: nhóm mới, tính là đã đối soát
  insert into public.fin_move_cats(report_id, mkey, category_id, excluded, by_account, at, checked, checked_by, checked_at)
  values (p_report, newk ->> m.ord::text, case when ex then null else cat end, case when ex then 1 else 0 end, a.id, public.vn_now_text(), 1, a.id, public.vn_now_text())
  on conflict (report_id, mkey) do update set category_id = excluded.category_id, excluded = excluded.excluded, by_account = excluded.by_account, at = excluded.at,
          checked = 1, checked_by = excluded.checked_by, checked_at = excluded.checked_at;

  -- người không phải quản trị (mục tiền chưa đối soát): ca dùng file Fabi thì web xét tự duyệt lại
  if money and not adm then res := public.app__ca_auto_green(p_report); end if;
  perform public.app_log('thu_chi_sua_khoan_ca', 'report=' || p_report || ' ' || m.amount || ' → ' || signed || ' ' || nt || case when money and adm then ' (sửa thẳng)' else '' end);
  return jsonb_build_object('money', money, 'direct', money and adm, 'auto', res,
    'recon_status', (select recon_status from public.shift_reports where id = p_report));
end $$;

-- Thay bản 66
create or replace function public.app_tc_to_loan(p jsonb, p_person bigint, p_note text) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; e public.fin_entries; r public.shift_reports; m record; nid bigint; nt text := nullif(trim(coalesce(p_note, '')), '');
begin
  if p_person is null or not exists (select 1 from public.loan_people where id = p_person and active = 1) then raise exception 'Chọn người vay (khai báo ở Cài đặt › Người vay).'; end if;
  if p ->> 'src' = 'tay' then
    select * into e from public.fin_entries where id = (p ->> 'id')::bigint for update;
    if e.id is null then raise exception 'Không tìm thấy khoản này. Tải lại trang.'; end if;
    a := public.app__tc_need(e.branch_id);
    if not public.app__loan_branch_ok(e.branch_id) then raise exception 'Cơ sở này chưa bật mục Cho vay.'; end if;
    if public.app__fin_locked(e.branch_id, e.entry_date) then raise exception 'Khoản này thuộc tháng đã CHỐT nên không đổi được.'; end if;
    if e.kind <> 'chi' then raise exception 'Chỉ khoản CHI mới đổi thành cho vay được.'; end if;
    insert into public.branch_loans(branch_id, person_id, loan_date, amount, method, note, created_by)
    values (e.branch_id, p_person, e.entry_date, e.amount, e.pay_method, coalesce(nt, e.note), a.id) returning id into nid;
    -- bước 66: khoản từ phiếu chi chuyển khoản → phiếu chi giữ nguyên (tiền chuyển ra của ca không đổi), trỏ sang khoản vay
    update public.shift_bank_outs set loan_id = nid, fin_entry_id = null where fin_entry_id = e.id;
    delete from public.fin_entries where id = e.id;
    perform public.app_log('thu_chi_doi_cho_vay', 'entry=' || e.id || ' → loan=' || nid || ' ' || e.amount);
  elsif p ->> 'src' = 'ca' then
    select * into r from public.shift_reports where id = (p ->> 'report_id')::bigint for update;
    if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
    a := public.app__tc_need(r.branch_id);
    if not public.app__loan_branch_ok(r.branch_id) then raise exception 'Cơ sở này chưa bật mục Cho vay.'; end if;
    if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không đổi được.'; end if;
    select * into m from public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) x where x.report_id = r.id and x.mkey = p ->> 'mkey';
    if m.report_id is null then raise exception 'Khoản này vừa thay đổi. Tải lại trang.'; end if;
    if m.auto is not null then raise exception 'Khoản tự động (chi lương / khách mượn) không đổi thành cho vay được.'; end if;
    if m.amount >= 0 then raise exception 'Chỉ khoản CHI mới đổi thành cho vay được.'; end if;
    if exists (select 1 from public.branch_loans l where l.report_id = r.id and l.mkey = m.mkey) then raise exception 'Khoản này đã đổi thành cho vay rồi.'; end if;
    if public.app__tc_move_ka(r.id, m.mkey) then raise exception 'Khoản này đã gán âm tiền trừ lương — bỏ gán trước.'; end if;
    insert into public.branch_loans(branch_id, person_id, loan_date, amount, method, note, created_by, report_id, mkey)
    values (r.branch_id, p_person, r.work_date, -m.amount, m.pay, coalesce(nt, m.note), a.id, r.id, m.mkey) returning id into nid;
    insert into public.fin_move_cats(report_id, mkey, category_id, excluded, by_account, at, checked, checked_by, checked_at)
    values (r.id, m.mkey, null, 1, a.id, public.vn_now_text(), 1, a.id, public.vn_now_text())
    on conflict (report_id, mkey) do update set category_id = null, excluded = 1, by_account = excluded.by_account, at = excluded.at,
            checked = 1, checked_by = excluded.checked_by, checked_at = excluded.checked_at;
    perform public.app_log('thu_chi_doi_cho_vay', 'report=' || r.id || ' ' || m.note || ' → loan=' || nid || ' ' || -m.amount);
  else
    raise exception 'Khoản không hợp lệ.';
  end if;
  return nid;
end $$;

-- Thay bản 34
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
  -- bước 68: huỷ hết người chịu của khoản "Âm tiền" ghi trên phiếu ca → khoản đó trở lại chờ gán
  if s.move_mkey is not null and not exists (select 1 from public.shift_shortfalls x where x.report_id = s.report_id and x.move_mkey = s.move_mkey and x.status <> 'huy') then
    delete from public.fin_move_cats where report_id = s.report_id and mkey = s.move_mkey;
  end if;
  perform public.app_log('khoan_am_xoa', 'id=' || p_id || ' report=' || s.report_id || ' ' || s.amount);
end $$;

revoke execute on function public.app__tc_move_ka(bigint, text) from public, anon, authenticated;
revoke execute on function public.app_tc_move_to_ka(bigint, text, jsonb, text), public.app_tc_move_ka_undo(bigint, text), public.app_tc_list(bigint, text, text),
  public.app_tc_check(bigint, text, bigint, boolean, boolean), public.app_tc_move_edit(bigint, text, jsonb), public.app_tc_to_loan(jsonb, bigint, text), public.app_ka_delete(bigint, text) from public, anon;
grant execute on function public.app_tc_move_to_ka(bigint, text, jsonb, text), public.app_tc_move_ka_undo(bigint, text), public.app_tc_list(bigint, text, text),
  public.app_tc_check(bigint, text, bigint, boolean, boolean), public.app_tc_move_edit(bigint, text, jsonb), public.app_tc_to_loan(jsonb, bigint, text), public.app_ka_delete(bigint, text) to authenticated;

insert into public.app_migrations(file) values ('68_gop_am_tien_tru_luong.sql') on conflict (file) do nothing;
