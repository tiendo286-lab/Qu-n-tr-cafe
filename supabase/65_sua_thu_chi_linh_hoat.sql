-- =====================================================================
-- BƯỚC 65: SỬA THU CHI LINH HOẠT (anh Tiến chốt 13/11/2026). Chạy sau 64. Chạy lại không sao.
--  * Khoản từ phiếu chốt ca: đổi nhóm (hoặc "Không tính") NGAY trên trang Thu chi, kể cả khoản đã đối soát.
--  * Sửa số tiền / nội dung / tiền mặt – chuyển khoản / thu – chi của khoản ở phiếu ca (app_tc_move_edit):
--      - sửa vào BẢN ĐỐI SOÁT của phiếu (phiếu nhân viên giữ nguyên), nhóm đã chọn đi theo khoản;
--      - đổi số tiền / hình thức → ghi lý do. CHỦ / QUẢN LÝ TỔNG SỬA THẲNG: không mở lại mục tiền, ca đã đối soát giữ nguyên
--        (kể cả mục web tự duyệt, khoản âm đã xử lý), ghi nhật ký đối soát. Người có quyền Đối soát khác chỉ sửa được khi mục
--        Tiền mặt / Chuyển khoản liên quan của ca CHƯA đối soát (ca dùng file Fabi thì web xét tự duyệt lại);
--      - chỉ đổi nội dung / nhóm → không mở lại gì.
--      - khoản tự động (chi lương, khách mượn) không sửa ở đây.
--  * Đổi nhóm hàng loạt (app_tc_bulk_cat): tích nhiều dòng → 1 nhóm (khoản phiếu ca thì tính luôn là đã đối soát).
--  * Khoản tạo từ phiếu chi chuyển khoản ở Đối soát ca: chỉ đổi nhóm / nội dung; số tiền, ngày, hình thức, xoá → làm ở Đối soát ca.
--  * Tháng đã chốt: không sửa được (như cũ, nay máy chủ cũng chặn).
--  * Cho vay: sửa khoản vay (người vay, ngày, số tiền, hình thức, ghi chú) và sửa lần trả (app_loan_pay_save).
--  * ĐỔI KHOẢN CHI THÀNH CHO VAY (app_tc_to_loan, cơ sở bật Cho vay):
--      - khoản quản lý tạo → xoá khỏi Thu chi, thành khoản vay (cùng ngày / số tiền / hình thức) — Sổ quỹ vẫn trừ 1 lần (dòng Cho vay);
--      - khoản chi ở phiếu ca → thành "Không tính" (đã đối soát) + khoản vay ghi "từ phiếu ca" (branch_loans.report_id/mkey);
--        Sổ quỹ KHÔNG trừ thêm (tiền đã ra khỏi két trong ca). Xoá khoản vay đó → khoản trở về Thu chi, chờ đối soát.
--        Khoản vay từ phiếu ca chỉ đổi người vay / ghi chú; khoản thu chi đã đổi thì không đổi nhóm / sửa ở Thu chi.
-- =====================================================================

alter table public.branch_loans add column if not exists report_id bigint references public.shift_reports(id) on delete cascade;
alter table public.branch_loans add column if not exists mkey text;
create unique index if not exists ux_branch_loans_move on public.branch_loans (report_id, mkey) where report_id is not null;

-- Dòng thu chi ở phiếu ca + cờ khoản tự động (chi lương / khách mượn). app__tc_moves giữ nguyên kiểu trả về (gọi lại bản _x).
create or replace function public.app__tc_moves_x(p_branch bigint, p_from text, p_to text)
returns table(report_id bigint, branch_id bigint, work_date text, shift text, ord bigint, pay text, amount bigint, note text, mkey text, created_by bigint, auto text)
language sql stable security definer set search_path = public as $$
  select x.id, x.branch_id, x.work_date, x.shift, t.ord, t.v ->> 'kind', (t.v ->> 'amount')::bigint, coalesce(t.v ->> 'note', ''),
         md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) || '#'
           || row_number() over (partition by x.id, md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) order by t.ord),
         coalesce(x.completed_by, x.created_by), t.v ->> 'auto'
    from public.shift_reports x
    cross join lateral jsonb_array_elements(public.app__ca_eff(x.id) -> 'moves') with ordinality t(v, ord)
   where (p_branch is null or x.branch_id = p_branch) and x.work_date between p_from and p_to and x.status = 'hoan_thanh'
     and coalesce((t.v ->> 'amount')::bigint, 0) <> 0
$$;

create or replace function public.app__tc_moves(p_branch bigint, p_from text, p_to text)
returns table(report_id bigint, branch_id bigint, work_date text, shift text, ord bigint, pay text, amount bigint, note text, mkey text, created_by bigint)
language sql stable security definer set search_path = public as $$
  select report_id, branch_id, work_date, shift, ord, pay, amount, note, mkey, created_by from public.app__tc_moves_x(p_branch, p_from, p_to)
$$;

-- Thay bản 34: thêm 'auto' (khoản tự động) và 'bank_out' (khoản tạo từ phiếu chi chuyển khoản)
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
             'reason', s.reason, 'ka_status', s.status, 'auto_tru', s.auto_tru, 'status_note', s.status_note, 'reply', s.reply, 'reply_at', s.reply_at,
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

-- Thay bản 28: chặn tháng đã chốt
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

-- ---------------------------------------------------------------- Sửa 1 khoản thu chi ở phiếu ca (vào bản đối soát)
-- p: {kind: 'thu'|'chi', amount: >0, pay: 'tien_mat'|'chuyen_khoan', note, category_id, excluded, reason}
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

-- ---------------------------------------------------------------- Đổi nhóm hàng loạt
-- p_items: [{src:'ca', report_id, mkey} | {src:'tay', id}]; p_excluded = true → "Không tính" (chỉ khoản phiếu ca)
create or replace function public.app_tc_bulk_cat(p_items jsonb, p_category bigint, p_excluded boolean) returns int
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); it jsonb; e public.fin_entries; c public.fin_categories; n int := 0; ex boolean := coalesce(p_excluded, false);
begin
  if a.id is null then raise exception 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Chưa chọn khoản nào.'; end if;
  if jsonb_array_length(p_items) > 500 then raise exception 'Chọn tối đa 500 khoản một lần.'; end if;
  if not ex then
    select * into c from public.fin_categories where id = p_category;
    if c.id is null then raise exception 'Chọn nhóm.'; end if;
  end if;
  for it in select value from jsonb_array_elements(p_items) loop
    if it ->> 'src' = 'ca' then
      perform public.app_tc_check((it ->> 'report_id')::bigint, it ->> 'mkey', case when ex then null else p_category end, ex, true);
    elsif it ->> 'src' = 'tay' then
      select * into e from public.fin_entries where id = (it ->> 'id')::bigint;
      if e.id is null then raise exception 'Có khoản vừa bị xoá. Tải lại trang.'; end if;
      perform public.app__tc_need(e.branch_id);
      if ex then raise exception 'Khoản "%" do quản lý tạo — không chọn "Không tính" được (xoá khoản đó nếu không cần).', e.note; end if;
      if public.app__fin_locked(e.branch_id, e.entry_date) then raise exception 'Khoản "%" thuộc tháng đã CHỐT.', e.note; end if;
      if c.kind <> e.kind then raise exception 'Khoản "%" là khoản %, nhóm "%" là nhóm %.', e.note, e.kind, c.name, c.kind; end if;
      update public.fin_entries set category_id = p_category, updated_by = a.id, updated_at = public.vn_now_text() where id = e.id;
    else
      raise exception 'Khoản không hợp lệ.';
    end if;
    n := n + 1;
  end loop;
  perform public.app_log('thu_chi_doi_nhom_loat', n || ' khoản → ' || case when ex then 'Không tính' else c.name end);
  return n;
end $$;

-- ---------------------------------------------------------------- Thay bản 28: khoản quản lý tạo — chặn tháng chốt, khoản từ phiếu chi chuyển khoản
create or replace function public.app_tc_entry_save(p_id bigint, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; br bigint := nullif(p ->> 'branch_id', '')::bigint; d text := p ->> 'entry_date'; k text := p ->> 'kind';
        cat bigint := nullif(p ->> 'category_id', '')::bigint; amt bigint := nullif(p ->> 'amount', '')::bigint;
        pm text := coalesce(nullif(p ->> 'pay_method', ''), 'tien_mat'); nt text := trim(coalesce(p ->> 'note', '')); nid bigint; old public.fin_entries;
begin
  if p_id is not null then
    select * into old from public.fin_entries where id = p_id;
    if old.id is null then raise exception 'Không tìm thấy khoản này.'; end if;
    perform public.app__tc_need(old.branch_id);
    if public.app__fin_locked(old.branch_id, old.entry_date) then raise exception 'Khoản này thuộc tháng đã CHỐT nên không sửa được.'; end if;
    if exists (select 1 from public.shift_bank_outs o where o.fin_entry_id = p_id)
       and (br is distinct from old.branch_id or d is distinct from old.entry_date or k is distinct from old.kind or amt is distinct from old.amount or pm is distinct from old.pay_method) then
      raise exception 'Khoản này tạo từ phiếu chi chuyển khoản ở Đối soát ca — chỉ đổi nhóm / nội dung ở đây. Sửa số tiền: xoá phiếu chi ở Đối soát ca rồi tạo lại.';
    end if;
  end if;
  if br is null or not exists (select 1 from public.branches where id = br) then raise exception 'Chọn cơ sở.'; end if;
  a := public.app__tc_need(br);
  if d is null or d !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Chọn ngày.'; end if;
  begin perform d::date; exception when others then raise exception 'Ngày không hợp lệ.'; end;
  if public.app__fin_locked(br, d) then raise exception 'Tháng này đã CHỐT nên không ghi khoản vào được.'; end if;
  if coalesce(k, '') not in ('chi', 'thu') then raise exception 'Chọn Thu hay Chi.'; end if;
  if amt is null or amt <= 0 then raise exception 'Nhập số tiền lớn hơn 0.'; end if;
  if nt = '' then raise exception 'Ghi nội dung khoản %.', k; end if;
  if pm not in ('tien_mat', 'chuyen_khoan') then raise exception 'Hình thức không hợp lệ.'; end if;
  if cat is null then raise exception 'Chọn nhóm %.', case when k = 'chi' then 'chi' else 'thu' end; end if;
  if not exists (select 1 from public.fin_categories where id = cat and kind = k) then raise exception 'Nhóm không đúng loại Thu / Chi.'; end if;
  if p_id is null then
    insert into public.fin_entries(branch_id, entry_date, kind, category_id, amount, note, pay_method, created_by, updated_by)
    values (br, d, k, cat, amt, nt, pm, a.id, a.id) returning id into nid;
  else
    update public.fin_entries set branch_id = br, entry_date = d, kind = k, category_id = cat, amount = amt, note = nt,
           pay_method = pm, updated_by = a.id, updated_at = public.vn_now_text() where id = p_id;
    nid := p_id;
  end if;
  perform public.app_log('thu_chi_khoan', 'entry=' || nid || ' ' || k || ' ' || amt);
  return nid;
end $$;

create or replace function public.app_tc_entry_delete(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare e public.fin_entries;
begin
  select * into e from public.fin_entries where id = p_id;
  if e.id is null then return; end if;
  perform public.app__tc_need(e.branch_id);
  if public.app__fin_locked(e.branch_id, e.entry_date) then raise exception 'Khoản này thuộc tháng đã CHỐT nên không xoá được.'; end if;
  if exists (select 1 from public.shift_bank_outs o where o.fin_entry_id = p_id) then
    raise exception 'Khoản này tạo từ phiếu chi chuyển khoản ở Đối soát ca — xoá phiếu chi ở đó (để trả lại tiền chuyển ra của ca).';
  end if;
  delete from public.fin_entries where id = p_id;
  perform public.app_log('thu_chi_xoa_khoan', 'entry=' || p_id || ' ' || e.kind || ' ' || e.amount);
end $$;

-- ---------------------------------------------------------------- Cho vay: sửa khoản vay (thay bản 64) và sửa lần trả
create or replace function public.app_loan_save(p_id bigint, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; old public.branch_loans; br bigint := nullif(p ->> 'branch_id', '')::bigint; ps bigint := nullif(p ->> 'person_id', '')::bigint;
        d text := p ->> 'date'; amt bigint := nullif(p ->> 'amount', '')::bigint; m text := coalesce(nullif(p ->> 'method', ''), 'tien_mat'); nt text := trim(coalesce(p ->> 'note', '')); nid bigint;
begin
  if p_id is not null then
    select * into old from public.branch_loans where id = p_id;
    if old.id is null then raise exception 'Không tìm thấy khoản vay.'; end if;
    br := old.branch_id;
    if public.app__fin_locked(old.branch_id, old.loan_date) then raise exception 'Tháng của khoản vay này đã CHỐT nên không sửa được.'; end if;
  end if;
  a := public.app__tc_need(br);
  if not public.app__loan_branch_ok(br) then raise exception 'Cơ sở này chưa bật mục Cho vay.'; end if;
  if ps is null or not exists (select 1 from public.loan_people where id = ps and (active = 1 or ps = old.person_id)) then raise exception 'Chọn người vay (khai báo ở Cài đặt › Người vay).'; end if;
  if d is null or d !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Chọn ngày cho vay.'; end if;
  if amt is null or amt <= 0 then raise exception 'Nhập số tiền cho vay lớn hơn 0.'; end if;
  if m not in ('tien_mat', 'chuyen_khoan') then raise exception 'Chọn tiền mặt hay chuyển khoản.'; end if;
  if public.app__fin_locked(br, d) then raise exception 'Tháng này đã CHỐT nên không ghi khoản vay vào được.'; end if;
  if p_id is not null then
    if amt < (select coalesce(sum(amount), 0) from public.branch_loan_payments where loan_id = p_id) then
      raise exception 'Số tiền vay không được nhỏ hơn số đã trả (%).', public.app__vnd((select coalesce(sum(amount), 0) from public.branch_loan_payments where loan_id = p_id));
    end if;
    if exists (select 1 from public.branch_loan_payments where loan_id = p_id and pay_date < d) then raise exception 'Ngày cho vay phải trước các lần trả nợ.'; end if;
    if old.report_id is not null and (d is distinct from old.loan_date or amt is distinct from old.amount or m is distinct from old.method) then
      raise exception 'Khoản vay này ghi từ phiếu ca — chỉ đổi người vay / ghi chú. Sai số tiền: xoá khoản vay (khoản trở lại Thu chi) rồi sửa ở Thu chi.';
    end if;
  end if;
  if p_id is null then
    insert into public.branch_loans(branch_id, person_id, loan_date, amount, method, note, created_by) values (br, ps, d, amt, m, nt, a.id) returning id into nid;
  else
    update public.branch_loans set person_id = ps, loan_date = d, amount = amt, method = m, note = nt where id = p_id; nid := p_id;
  end if;
  perform public.app_log(case when p_id is null then 'cho_vay' else 'cho_vay_sua' end, 'loan=' || nid || ' ' || amt);
  return nid;
end $$;

create or replace function public.app_loan_pay_save(p_id bigint, p_date text, p_amount bigint, p_method text, p_note text) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; y public.branch_loan_payments; l public.branch_loans; owe bigint; m text := coalesce(nullif(p_method, ''), 'tien_mat');
begin
  select * into y from public.branch_loan_payments where id = p_id;
  if y.id is null then raise exception 'Không tìm thấy lần trả này.'; end if;
  select * into l from public.branch_loans where id = y.loan_id for update;
  a := public.app__tc_need(l.branch_id);
  if public.app__fin_locked(l.branch_id, y.pay_date) then raise exception 'Tháng của lần trả này đã CHỐT nên không sửa được.'; end if;
  owe := l.amount - (select coalesce(sum(amount), 0) from public.branch_loan_payments where loan_id = l.id and id <> p_id);
  if p_amount is null or p_amount <= 0 then raise exception 'Nhập số tiền trả lớn hơn 0.'; end if;
  if p_amount > owe then raise exception 'Số tiền trả (%) lớn hơn số còn nợ của khoản này (%).', public.app__vnd(p_amount), public.app__vnd(owe); end if;
  if p_date is null or p_date !~ '^\d{4}-\d{2}-\d{2}$' or p_date < l.loan_date then raise exception 'Ngày trả phải từ ngày cho vay trở đi.'; end if;
  if m not in ('tien_mat', 'chuyen_khoan') then raise exception 'Chọn tiền mặt hay chuyển khoản.'; end if;
  if public.app__fin_locked(l.branch_id, p_date) then raise exception 'Tháng này đã CHỐT nên không ghi lần trả vào được.'; end if;
  update public.branch_loan_payments set pay_date = p_date, amount = p_amount, method = m, note = trim(coalesce(p_note, '')) where id = p_id;
  perform public.app_log('tra_no_vay_sua', 'payment=' || p_id || ' ' || p_amount);
  return p_id;
end $$;


-- ---------------------------------------------------------------- Đổi khoản chi thành cho vay
-- p: {src:'tay', id} | {src:'ca', report_id, mkey}; p_person: người vay; p_note: ghi chú (bỏ trống = giữ nội dung khoản)
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
    if exists (select 1 from public.shift_bank_outs o where o.fin_entry_id = e.id) then raise exception 'Khoản này tạo từ phiếu chi chuyển khoản ở Đối soát ca — xoá phiếu chi ở đó rồi ghi cho vay.'; end if;
    insert into public.branch_loans(branch_id, person_id, loan_date, amount, method, note, created_by)
    values (e.branch_id, p_person, e.entry_date, e.amount, e.pay_method, coalesce(nt, e.note), a.id) returning id into nid;
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

-- Thay bản 64: xoá khoản vay từ phiếu ca → khoản trở lại Thu chi (chờ đối soát)
create or replace function public.app_loan_delete(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare l public.branch_loans;
begin
  select * into l from public.branch_loans where id = p_id;
  if l.id is null then return; end if;
  perform public.app__tc_need(l.branch_id);
  if exists (select 1 from public.branch_loan_payments where loan_id = p_id) then raise exception 'Khoản vay đã có lần trả nợ — xoá các lần trả trước.'; end if;
  if public.app__fin_locked(l.branch_id, l.loan_date) then raise exception 'Tháng của khoản vay này đã CHỐT nên không xoá được.'; end if;
  delete from public.branch_loans where id = p_id;
  if l.report_id is not null then delete from public.fin_move_cats where report_id = l.report_id and mkey = l.mkey; end if;
  perform public.app_log('cho_vay_xoa', 'loan=' || p_id || case when l.report_id is not null then ' (trả lại Thu chi phiếu ' || l.report_id || ')' else '' end);
end $$;

-- Thay bản 64: thêm report_id / shift (khoản vay đổi từ phiếu ca)
create or replace function public.app_loans(p_branch bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__tc_need(p_branch);
  if not public.app__loan_branch_ok(p_branch) then return jsonb_build_object('enabled', false); end if;
  return jsonb_build_object('enabled', true, 'can_people', public.app__fin_admin(),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'phone', p.phone, 'note', p.note, 'active', p.active = 1,
                 'lent', coalesce(x.lent, 0), 'paid', coalesce(x.paid, 0), 'owe', coalesce(x.lent, 0) - coalesce(x.paid, 0)) order by (coalesce(x.lent, 0) - coalesce(x.paid, 0)) desc, p.name)
               from public.loan_people p
               left join lateral (select sum(l.amount) lent, (select coalesce(sum(y.amount), 0) from public.branch_loan_payments y join public.branch_loans l2 on l2.id = y.loan_id
                                                              where l2.person_id = p.id and l2.branch_id = p_branch) paid
                                    from public.branch_loans l where l.person_id = p.id and l.branch_id = p_branch) x on true), '[]'),
    'loans', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'person_id', l.person_id, 'person', p.name, 'date', l.loan_date, 'amount', l.amount, 'method', l.method, 'note', l.note,
                 'by', public.app__acc_name(l.created_by), 'locked', public.app__fin_locked(l.branch_id, l.loan_date),
                 'report_id', l.report_id, 'shift', (select x.shift from public.shift_reports x where x.id = l.report_id),
                 'paid', (select coalesce(sum(y.amount), 0) from public.branch_loan_payments y where y.loan_id = l.id),
                 'payments', coalesce((select jsonb_agg(jsonb_build_object('id', y.id, 'date', y.pay_date, 'amount', y.amount, 'method', y.method, 'note', y.note,
                                'by', public.app__acc_name(y.created_by), 'locked', public.app__fin_locked(l.branch_id, y.pay_date)) order by y.pay_date, y.id)
                              from public.branch_loan_payments y where y.loan_id = l.id), '[]')) order by l.loan_date desc, l.id desc)
               from public.branch_loans l join public.loan_people p on p.id = l.person_id where l.branch_id = p_branch), '[]'));
end $$;

-- Thay bản 64: khoản vay đổi từ phiếu ca không trừ quỹ thêm lần nữa
create or replace function public.app__fund_rows(p_branch bigint, p_from text, p_to text)
returns table(d text, method text, typ text, label text, amount bigint, auto boolean, ref jsonb)
language plpgsql stable security definer set search_path = public as $$
declare st text := public.app__fund_start(); fl bigint := coalesce(public.app__fund_set('fund_cash_float')::bigint, 1000000);
        f text := greatest(p_from, public.app__fund_start()); dd date;
begin
  if f > p_to then return; end if;
  for dd in select generate_series(f::date, p_to::date, interval '1 day')::date loop
    -- tiền mặt nộp quỹ cuối ngày
    return query
      select to_char(dd, 'YYYY-MM-DD'), 'tien_mat'::text, 'nop_quy'::text,
             case when v.cash_amount is not null then 'Nộp quỹ cuối ngày (quản lý nhập)' else 'Nộp quỹ cuối ngày (đếm ' || public.app__vnd(c.counted) || ' − để lại ' || public.app__vnd(fl) || ')' end,
             coalesce(v.cash_amount, c.counted - fl), v.cash_amount is null,
             jsonb_build_object('counted', c.counted, 'note', v.cash_note)
        from (select 1) one
        left join public.daily_cash_closings c on c.branch_id = p_branch and c.work_date = to_char(dd, 'YYYY-MM-DD')
        left join public.fund_day_values v on v.branch_id = p_branch and v.work_date = to_char(dd, 'YYYY-MM-DD')
       where coalesce(v.cash_amount, c.counted - fl) is not null and coalesce(v.cash_amount, c.counted - fl) <> 0;
    -- bước 45: tiền mặt nộp quỹ khi giao ca (ca sau mở với tiền gối đầu)
    return query
      select to_char(dd, 'YYYY-MM-DD'), 'tien_mat'::text, 'nop_quy'::text,
             'Nộp quỹ khi giao ca ' || (hh.h ->> 'prev_shift') || ' → ' || r.shift || ' (két để lại ' || public.app__vnd(fl) || ')',
             (hh.h ->> 'rut')::bigint, true, jsonb_build_object('report_id', r.id)
        from public.shift_reports r cross join lateral (select public.app__ca_hand(r.id) h) hh
       where r.branch_id = p_branch and r.work_date = to_char(dd, 'YYYY-MM-DD') and r.status = 'hoan_thanh'
         and public.app__ca_chain(r.shift) and hh.h ->> 'state' = 'rut_quy';
    -- chuyển khoản về
    return query
      select to_char(dd, 'YYYY-MM-DD'), 'chuyen_khoan'::text, 'ck_ve'::text,
             case when v.bank_amount is not null then 'Chuyển khoản về (quản lý nhập)' else 'Chuyển khoản thực nhận (kế toán)' end,
             coalesce(v.bank_amount, a.s), v.bank_amount is null, jsonb_build_object('note', v.bank_note)
        from (select public.app__fund_bank_auto(p_branch, to_char(dd, 'YYYY-MM-DD')) s) a
        left join public.fund_day_values v on v.branch_id = p_branch and v.work_date = to_char(dd, 'YYYY-MM-DD')
       where coalesce(v.bank_amount, a.s) is not null and coalesce(v.bank_amount, a.s) <> 0;
  end loop;
  -- khoản thu chi quản lý tạo
  return query
    select e.entry_date, e.pay_method, 'thu_chi'::text, (case when e.kind = 'chi' then 'Chi: ' else 'Thu: ' end) || e.note || coalesce(' · ' || c.name, ''),
           case when e.kind = 'chi' then -e.amount else e.amount end, false, jsonb_build_object('entry_id', e.id)
      from public.fin_entries e left join public.fin_categories c on c.id = e.category_id
     where e.branch_id = p_branch and e.entry_date between f and p_to;
  -- nhân viên bù khoản âm (tiền mặt)
  return query
    select left(s.status_at, 10), 'tien_mat'::text, 'bu_khoan_am'::text, 'NV bù khoản âm: ' || coalesce(em.code || ' – ' || em.name, '?'),
           s.amount, false, jsonb_build_object('shortfall_id', s.id, 'report_id', s.report_id)
      from public.shift_shortfalls s join public.shift_reports r on r.id = s.report_id left join public.employees em on em.id = s.employee_id
     where r.branch_id = p_branch and s.status = 'da_bu' and left(s.status_at, 10) between f and p_to;
  -- phiếu rút
  return query
    select w.wdate, w.method, 'rut'::text,
           (case when w.kind = 'cuoi_thang' then 'Rút cuối tháng' else 'Rút giữ hộ' end) || case when w.status = 'da_nhan' then ' · Chủ đã nhận' else ' · chờ Chủ xác nhận' end
             || case when w.note <> '' then ' · ' || w.note else '' end,
           -w.amount, false, jsonb_build_object('withdrawal_id', w.id, 'status', w.status)
      from public.fund_withdrawals w where w.branch_id = p_branch and w.wdate between f and p_to;
  -- bước 64: cho vay (tiền ra khỏi quỹ) và người vay trả nợ (tiền về quỹ) — không tính chi phí / doanh thu
  return query
    select l.loan_date, l.method, 'cho_vay'::text, 'Cho vay: ' || p.name || case when l.note <> '' then ' · ' || l.note else '' end,
           -l.amount, false, jsonb_build_object('loan_id', l.id)
      from public.branch_loans l join public.loan_people p on p.id = l.person_id
     where l.branch_id = p_branch and l.loan_date between f and p_to and l.report_id is null;   -- bước 65: khoản vay từ phiếu ca đã ra khỏi két trong ca
  return query
    select y.pay_date, y.method, 'tra_vay'::text, 'Trả nợ vay: ' || p.name || case when y.note <> '' then ' · ' || y.note else '' end,
           y.amount, false, jsonb_build_object('loan_id', l.id, 'payment_id', y.id)
      from public.branch_loan_payments y join public.branch_loans l on l.id = y.loan_id join public.loan_people p on p.id = l.person_id
     where l.branch_id = p_branch and y.pay_date between f and p_to;
end $$;

revoke execute on function public.app__tc_moves_x(bigint, text, text), public.app__tc_moves(bigint, text, text), public.app__fund_rows(bigint, text, text) from public, anon, authenticated;
revoke execute on function public.app_tc_list(bigint, text, text), public.app_tc_check(bigint, text, bigint, boolean, boolean), public.app_tc_move_edit(bigint, text, jsonb),
  public.app_tc_bulk_cat(jsonb, bigint, boolean), public.app_tc_entry_save(bigint, jsonb), public.app_tc_entry_delete(bigint),
  public.app_loan_save(bigint, jsonb), public.app_loan_pay_save(bigint, text, bigint, text, text),
  public.app_tc_to_loan(jsonb, bigint, text), public.app_loan_delete(bigint), public.app_loans(bigint) from public, anon;
grant execute on function public.app_tc_list(bigint, text, text), public.app_tc_check(bigint, text, bigint, boolean, boolean), public.app_tc_move_edit(bigint, text, jsonb),
  public.app_tc_bulk_cat(jsonb, bigint, boolean), public.app_tc_entry_save(bigint, jsonb), public.app_tc_entry_delete(bigint),
  public.app_loan_save(bigint, jsonb), public.app_loan_pay_save(bigint, text, bigint, text, text),
  public.app_tc_to_loan(jsonb, bigint, text), public.app_loan_delete(bigint), public.app_loans(bigint) to authenticated;

insert into public.app_migrations(file) values ('65_sua_thu_chi_linh_hoat.sql') on conflict (file) do nothing;
