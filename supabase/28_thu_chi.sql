-- =====================================================================
-- BƯỚC 28: TAB THU CHI trong Quản lý ca (anh Tiến chốt 10/11/2026). Chạy sau 27. Chạy lại nhiều lần không sao.
--  * Khoản thu chi gồm 2 nguồn:
--      - Quản lý tự tạo (bảng fin_entries) → luôn "Đã đối soát".
--      - Từng dòng thu chi ở phiếu chốt ca đã hoàn thành → "Chờ đối soát" cho tới khi quản lý chọn nhóm
--        (hoặc "Không tính") và bấm Đối soát. Phiếu ca bị sửa dòng đó thì dòng mới lại chờ đối soát.
--  * Ai dùng: người có quyền Đối soát (mọi cơ sở) + quản lý được giao cơ sở ở Chốt tháng.
--  * Chốt tháng: phải đối soát hết khoản thu chi từ phiếu ca của tháng mới chốt được.
-- =====================================================================

alter table public.fin_move_cats add column if not exists checked integer not null default 0;
alter table public.fin_move_cats add column if not exists checked_by bigint;
alter table public.fin_move_cats add column if not exists checked_at text;

-- Quyền xem / sửa thu chi của một cơ sở
create or replace function public.app__tc_can(p_branch bigint) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts := public.app_account();
begin
  if a.id is null or coalesce(a.locked, 0) = 1 then return false; end if;
  return coalesce(public.app_can('doi_soat'), false) or coalesce(public.app__fin_can(p_branch), false);
end $$;

create or replace function public.app__tc_need(p_branch bigint) returns public.accounts
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.app__tc_can(p_branch) then raise exception 'Bạn không được xem / sửa thu chi của cơ sở này.'; end if;
  return public.app_account();
end $$;

-- Các dòng thu chi ở phiếu ca đã hoàn thành (khóa mkey giống hệt Chốt tháng)
create or replace function public.app__tc_moves(p_branch bigint, p_from text, p_to text)
returns table(report_id bigint, branch_id bigint, work_date text, shift text, ord bigint, pay text, amount bigint, note text, mkey text, created_by bigint)
language sql stable security definer set search_path = public as $$
  select x.id, x.branch_id, x.work_date, x.shift, t.ord, t.v ->> 'kind', (t.v ->> 'amount')::bigint, coalesce(t.v ->> 'note', ''),
         md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) || '#'
           || row_number() over (partition by x.id, md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) order by t.ord),
         coalesce(x.completed_by, x.created_by)
    from public.shift_reports x
    cross join lateral jsonb_array_elements(public.app__ca_eff(x.id) -> 'moves') with ordinality t(v, ord)
   where (p_branch is null or x.branch_id = p_branch) and x.work_date between p_from and p_to and x.status = 'hoan_thanh'
     and coalesce((t.v ->> 'amount')::bigint, 0) <> 0
$$;

-- ---------------------------------------------------------------- Đọc: danh sách thu chi
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
  ) z;

  return jsonb_build_object('rows', rows,
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code), 'name', b.name) order by b.sort_order)
                 from public.branches b where b.status = 'Đang hoạt động' and public.app__tc_can(b.id)), '[]'),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'name', c.name, 'active', c.active = 1) order by c.kind, c.sort_order, c.name)
                 from public.fin_categories c), '[]'));
end $$;

-- ---------------------------------------------------------------- Ghi: đối soát 1 dòng thu chi ở phiếu ca
-- p_checked = true → Đã đối soát (bắt buộc chọn nhóm hoặc "Không tính"); false → trả về Chờ đối soát.
create or replace function public.app_tc_check(p_report bigint, p_mkey text, p_category bigint, p_excluded boolean, p_checked boolean) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; m record; ex boolean := coalesce(p_excluded, false); ok boolean := coalesce(p_checked, false);
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__tc_need(r.branch_id);
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

-- Phân nhóm ở trang Chốt tháng = quản lý xác nhận luôn (đã đối soát); bỏ nhóm → chờ đối soát lại
create or replace function public.app_fin_move_set(p_report bigint, p_mkey text, p_category bigint, p_excluded boolean) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; ok boolean := coalesce(p_excluded, false) or p_category is not null;
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  a := public.app__fin_need(r.branch_id);
  if p_category is not null and not exists (select 1 from public.fin_categories where id = p_category) then raise exception 'Nhóm không hợp lệ.'; end if;
  insert into public.fin_move_cats(report_id, mkey, category_id, excluded, by_account, at, checked, checked_by, checked_at)
  values (p_report, p_mkey, case when coalesce(p_excluded, false) then null else p_category end, case when coalesce(p_excluded, false) then 1 else 0 end, a.id, public.vn_now_text(),
          case when ok then 1 else 0 end, case when ok then a.id end, case when ok then public.vn_now_text() end)
  on conflict (report_id, mkey) do update set category_id = excluded.category_id, excluded = excluded.excluded, by_account = excluded.by_account, at = excluded.at,
          checked = excluded.checked, checked_by = excluded.checked_by, checked_at = excluded.checked_at;
end $$;

-- ---------------------------------------------------------------- Ghi: khoản quản lý tự tạo (luôn đã đối soát)
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
  end if;
  if br is null or not exists (select 1 from public.branches where id = br) then raise exception 'Chọn cơ sở.'; end if;
  a := public.app__tc_need(br);
  if d is null or d !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Chọn ngày.'; end if;
  begin perform d::date; exception when others then raise exception 'Ngày không hợp lệ.'; end;
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
  delete from public.fin_entries where id = p_id;
  perform public.app_log('thu_chi_xoa_khoan', 'entry=' || p_id || ' ' || e.kind || ' ' || e.amount);
end $$;

-- ---------------------------------------------------------------- Chốt tháng: thêm điều kiện đối soát hết thu chi phiếu ca
create or replace function public.app_fin_close(p_branch bigint, p_month text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; j jsonb; n int;
begin
  a := public.app__fin_need(p_branch);
  perform public.app__fin_month_ok(p_month);
  if p_month >= to_char(public.vn_now(), 'YYYY-MM') then raise exception 'Chỉ chốt được tháng đã kết thúc.'; end if;
  if exists (select 1 from public.fin_month_closes where branch_id = p_branch and month = p_month) then raise exception 'Tháng này đã chốt rồi.'; end if;
  j := public.app__fin_calc(p_branch, p_month);
  if (j -> 'revenue' ->> 'in_progress')::int > 0 then
    raise exception 'Còn % phiếu chốt ca đang chốt dở trong tháng. Hoàn thành hết rồi mới chốt tháng.', j -> 'revenue' ->> 'in_progress';
  end if;
  if (j -> 'revenue' ->> 'recon')::int < (j -> 'revenue' ->> 'done')::int then
    raise exception 'Còn % ca chưa hoàn thành đối soát. Đối soát xong rồi mới chốt tháng.', (j -> 'revenue' ->> 'done')::int - (j -> 'revenue' ->> 'recon')::int;
  end if;
  select count(*) into n from public.app__tc_moves(p_branch, p_month || '-01', p_month || '-31') m
    left join public.fin_move_cats fc on fc.report_id = m.report_id and fc.mkey = m.mkey
   where coalesce(fc.checked, 0) = 0;
  if n > 0 then
    raise exception 'Còn % khoản thu chi ở phiếu chốt ca CHỜ ĐỐI SOÁT. Vào Quản lý ca › Thu chi đối soát hết rồi mới chốt tháng.', n;
  end if;
  if (j -> 'totals' ->> 'uncat')::int > 0 then
    raise exception 'Còn % khoản chi ở phiếu ca chưa phân nhóm. Chọn nhóm hoặc "Không tính" trước khi chốt.', j -> 'totals' ->> 'uncat';
  end if;
  insert into public.fin_month_closes(branch_id, month, note, snapshot, closed_by) values (p_branch, p_month, nullif(trim(coalesce(p_note, '')), ''), j, a.id);
  insert into public.fin_close_log(branch_id, month, action, reason, by_account) values (p_branch, p_month, 'chot', nullif(trim(coalesce(p_note, '')), ''), a.id);
  perform public.app_log('chot_thang', 'branch=' || p_branch || ' ' || p_month);
end $$;

revoke execute on function public.app__tc_can(bigint), public.app__tc_need(bigint), public.app__tc_moves(bigint, text, text) from public, anon, authenticated;
revoke execute on function public.app_tc_list(bigint, text, text), public.app_tc_check(bigint, text, bigint, boolean, boolean),
  public.app_tc_entry_save(bigint, jsonb), public.app_tc_entry_delete(bigint), public.app_fin_move_set(bigint, text, bigint, boolean),
  public.app_fin_close(bigint, text, text) from public, anon;
grant execute on function public.app_tc_list(bigint, text, text), public.app_tc_check(bigint, text, bigint, boolean, boolean),
  public.app_tc_entry_save(bigint, jsonb), public.app_tc_entry_delete(bigint), public.app_fin_move_set(bigint, text, bigint, boolean),
  public.app_fin_close(bigint, text, text) to authenticated;
