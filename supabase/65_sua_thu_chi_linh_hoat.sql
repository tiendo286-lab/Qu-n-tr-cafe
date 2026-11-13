-- =====================================================================
-- BƯỚC 65: SỬA THU CHI LINH HOẠT (anh Tiến chốt 13/11/2026). Chạy sau 64. Chạy lại không sao.
--  * Khoản từ phiếu chốt ca: đổi nhóm (hoặc "Không tính") NGAY trên trang Thu chi, kể cả khoản đã đối soát.
--  * Sửa số tiền / nội dung / tiền mặt – chuyển khoản / thu – chi của khoản ở phiếu ca (app_tc_move_edit):
--      - sửa vào BẢN ĐỐI SOÁT của phiếu (phiếu nhân viên giữ nguyên), nhóm đã chọn đi theo khoản;
--      - đổi số tiền / hình thức → cần quyền Đối soát + ghi lý do; mục Tiền mặt / Chuyển khoản của ca MỞ LẠI để duyệt lại
--        (phiếu dùng file Fabi thì web tự xét lại ngay). Mục web tự đối soát chỉ Chủ sửa; khoản âm đã xử lý thì không sửa được;
--      - chỉ đổi nội dung / nhóm → không mở lại gì.
--      - khoản tự động (chi lương, khách mượn) không sửa ở đây.
--  * Đổi nhóm hàng loạt (app_tc_bulk_cat): tích nhiều dòng → 1 nhóm (khoản phiếu ca thì tính luôn là đã đối soát).
--  * Khoản tạo từ phiếu chi chuyển khoản ở Đối soát ca: chỉ đổi nhóm / nội dung; số tiền, ngày, hình thức, xoá → làm ở Đối soát ca.
--  * Tháng đã chốt: không sửa được (như cũ, nay máy chủ cũng chặn).
--  * Cho vay: sửa khoản vay (người vay, ngày, số tiền, hình thức, ghi chú) và sửa lần trả (app_loan_pay_save).
-- =====================================================================

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

  return jsonb_build_object('rows', rows, 'can_money', coalesce(public.app_can('doi_soat'), false),
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
        oldk jsonb; newk jsonb; saved jsonb; it text; reopen text[] := '{}'; res text := null; x record;
begin
  select * into r from public.shift_reports where id = p_report for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__tc_need(r.branch_id);
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT nên không sửa được.'; end if;
  select * into m from public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) t where t.report_id = p_report and t.mkey = p_mkey;
  if m.report_id is null then raise exception 'Khoản này vừa thay đổi. Tải lại trang rồi sửa lại.'; end if;
  if m.auto is not null then raise exception 'Khoản tự động (chi lương / khách mượn) — sửa ở mục Nhân viên / Công nợ của phiếu ca.'; end if;

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

  if money then
    if not coalesce(public.app_can('doi_soat'), false) then raise exception 'Sửa số tiền / hình thức khoản ở phiếu ca cần quyền Đối soát. Bạn đổi được nhóm và nội dung.'; end if;
    if why is null then raise exception 'Ghi lý do sửa số tiền / hình thức.'; end if;
    foreach it in array array[m.pay, pm] loop
      if it = any(reopen) then continue; end if;
      if exists (select 1 from public.shift_report_checks c where c.report_id = p_report and c.item = it) then
        if exists (select 1 from public.shift_report_checks c where c.report_id = p_report and c.item = it and c.auto = 1) and coalesce(a.system_role, '') <> 'chu' then
          raise exception 'Mục % của ca này web đã tự đối soát theo file Fabi và ngân hàng — chỉ Chủ sửa được số tiền / hình thức.', public.app__ca_item_label(it);
        end if;
        perform public.app__ca_item_reopen(p_report, it, a.id, 'Sửa khoản thu chi ở trang Thu chi: ' || why);
        reopen := reopen || it;
      end if;
    end loop;
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

  if cardinality(reopen) > 0 then res := public.app__ca_auto_green(p_report); end if;
  perform public.app_log('thu_chi_sua_khoan_ca', 'report=' || p_report || ' ' || m.amount || ' → ' || signed || ' ' || nt);
  return jsonb_build_object('reopened', to_jsonb(reopen), 'auto', res,
    'recon_status', (select recon_status from public.shift_reports where id = p_report),
    'still_open', coalesce((select jsonb_agg(u) from unnest(reopen) u where not exists (select 1 from public.shift_report_checks c where c.report_id = p_report and c.item = u)), '[]'));
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

revoke execute on function public.app__tc_moves_x(bigint, text, text), public.app__tc_moves(bigint, text, text) from public, anon, authenticated;
revoke execute on function public.app_tc_list(bigint, text, text), public.app_tc_check(bigint, text, bigint, boolean, boolean), public.app_tc_move_edit(bigint, text, jsonb),
  public.app_tc_bulk_cat(jsonb, bigint, boolean), public.app_tc_entry_save(bigint, jsonb), public.app_tc_entry_delete(bigint),
  public.app_loan_save(bigint, jsonb), public.app_loan_pay_save(bigint, text, bigint, text, text) from public, anon;
grant execute on function public.app_tc_list(bigint, text, text), public.app_tc_check(bigint, text, bigint, boolean, boolean), public.app_tc_move_edit(bigint, text, jsonb),
  public.app_tc_bulk_cat(jsonb, bigint, boolean), public.app_tc_entry_save(bigint, jsonb), public.app_tc_entry_delete(bigint),
  public.app_loan_save(bigint, jsonb), public.app_loan_pay_save(bigint, text, bigint, text, text) to authenticated;

insert into public.app_migrations(file) values ('65_sua_thu_chi_linh_hoat.sql') on conflict (file) do nothing;
