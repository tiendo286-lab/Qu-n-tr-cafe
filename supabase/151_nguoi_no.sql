-- Bước 172 · đợt B (phần quản lý) — người nợ thật + xếp nhóm công nợ ở bước 1 của Đối soát Fabi.
-- Thiết kế: tai_lieu/superpowers/specs/2026-11-20-doi-soat-thu-chi-6-buoc-design.md mục 8, 11, 13. Kế hoạch: tai_lieu/superpowers/plans/2026-11-20-doi-soat-6-buoc-dot-b.md.
--   • Mỗi cơ sở có danh sách người nợ thật (debt_people): tên, SĐT, nhóm công nợ (khach / kho / khac), còn dùng hay không. "Kho tổng" luôn có.
--   • Nợ ghi NGOÀI phiếu ca (Cho nợ ở Sổ thu chi, tab Công nợ, đổi khoản chi thành nợ, + Báo nợ) chỉ nhận tên có trong danh sách đang dùng.
--   • Nợ ghi TRONG phiếu ca (nhân viên gõ tên) vẫn nhận như cũ — phiếu chốt ca của nhân viên CHƯA đổi ở đợt này; quản lý xếp lại ở bước 1.
-- Không đổi cách tính tiền, không đổi quyền (app_can / role_permissions / app__stc_can / app__stc_need giữ nguyên).
-- Bài thử: kiem_tra/nguoi_no_151_cuc_bo.sql (cục bộ), kiem_tra/nguoi_no_151.sql (dữ liệu thật, tự hoàn tác). Chạy lại nhiều lần không sao.

create table if not exists public.debt_people (
  id bigserial primary key,
  branch_id bigint not null references public.branches(id) on delete cascade,
  name text not null,
  phone text,
  grp text not null default 'khach' check (grp in ('khach', 'kho', 'khac')),
  active int not null default 1,
  created_by bigint references public.accounts(id),
  created_at text not null default public.vn_now_text()
);
create unique index if not exists debt_people_branch_name on public.debt_people (branch_id, (lower(btrim(name))));
alter table public.debt_people enable row level security;
revoke all on public.debt_people from anon, authenticated;

alter table public.shift_debts add column if not exists person_id bigint references public.debt_people(id);
alter table public.shift_debts add column if not exists content text;
alter table public.shift_debts add column if not exists sorted_by bigint references public.accounts(id);
alter table public.shift_debts add column if not exists sorted_at text;
create index if not exists shift_debts_person on public.shift_debts (person_id) where person_id is not null;

-- ---- Trigger gác tên: một chỗ cho mọi đường ghi nợ (thay cho vá từng hàm).
create or replace function public.app__debt_person_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.debt_people; src public.shift_debts; nm text := btrim(coalesce(new.table_name, ''));
begin
  -- khoản hệ thống tự sinh từ khoản khác (phần còn thiếu khi trả nợ, khoản tách kiểu cũ, nợ từ khoản vay): thừa hưởng người + dấu đã xếp của khoản gốc, không kiểm tên
  if new.split_from is not null or new.rest_of is not null or new.from_loan is not null then
    if tg_op = 'INSERT' and new.person_id is null and coalesce(new.split_from, new.rest_of) is not null then
      select * into src from public.shift_debts where id = coalesce(new.split_from, new.rest_of);
      new.person_id := src.person_id; new.sorted_by := src.sorted_by; new.sorted_at := src.sorted_at; new.content := coalesce(new.content, src.content);
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and lower(nm) = lower(btrim(coalesce(old.table_name, ''))) then return new; end if;
  select * into p from public.debt_people where branch_id = new.branch_id and lower(btrim(name)) = lower(nm) and active = 1;
  if p.id is not null then
    new.person_id := p.id; new.table_name := p.name;
  elsif new.report_id is not null or nm = '' then
    new.person_id := null;   -- nợ ghi trong phiếu ca (nhân viên gõ tay): quản lý xếp ở bước 1 của Đối soát Fabi
  else
    raise exception 'Người nợ "%" chưa có trong danh sách. Thêm ở Sổ thu chi › Sổ chi › 👥 Người nợ trước.', nm;
  end if;
  -- tên đổi sang NGƯỜI KHÁC (hoặc về tên gõ tay) mà lần sửa này không tự đặt dấu đã xếp → coi như chưa xếp
  if tg_op = 'UPDATE' and new.person_id is distinct from old.person_id and new.sorted_at is not distinct from old.sorted_at
     and coalesce(current_setting('app.debt_sort', true), '') <> '1' then   -- '1' = đang ở trong app_stc_debt_sort (quản lý xếp)
    new.sorted_at := null; new.sorted_by := null;
  end if;
  return new;
end $$;
revoke all on function public.app__debt_person_guard() from public, anon, authenticated;
drop trigger if exists stc_debt_person on public.shift_debts;
create trigger stc_debt_person before insert or update of table_name on public.shift_debts
  for each row execute function public.app__debt_person_guard();

-- ---- Chạy bù: lập danh sách từ các tên đang có trong sổ (gọi lại nhiều lần không nhân đôi).
--   nhóm kho tổng / nợ khác lấy hết; nhóm khách hàng chỉ lấy tên còn khoản chưa thu; nhóm + SĐT theo khoản mới nhất.
create or replace function public.app__debt_people_backfill() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; k int;
begin
  insert into public.debt_people(branch_id, name, grp)
  select b.id, 'Kho tổng', 'kho' from public.branches b
  on conflict (branch_id, (lower(btrim(name)))) do nothing;
  get diagnostics k = row_count; n := n + k;
  insert into public.debt_people(branch_id, name, phone, grp)
  select z.branch_id, z.name, z.phone, z.grp from (
    select distinct on (d.branch_id, lower(btrim(d.table_name))) d.branch_id, btrim(d.table_name) name, coalesce(d.grp, 'khach') grp,
           (select nullif(btrim(x.phone), '') from public.shift_debts x
             where x.branch_id = d.branch_id and lower(btrim(x.table_name)) = lower(btrim(d.table_name)) and nullif(btrim(x.phone), '') is not null
             order by x.id desc limit 1) phone
      from public.shift_debts d
     where btrim(coalesce(d.table_name, '')) <> '' and (coalesce(d.grp, 'khach') in ('kho', 'khac') or d.closed_at is null)
     order by d.branch_id, lower(btrim(d.table_name)), d.id desc) z
  on conflict (branch_id, (lower(btrim(name)))) do nothing;
  get diagnostics k = row_count; n := n + k;
  -- gắn người cho các khoản khớp tên (không đổi tên / tiền nên không chạm các trigger canh đối soát)
  update public.shift_debts d set person_id = p.id
    from public.debt_people p
   where d.person_id is null and p.branch_id = d.branch_id and lower(btrim(p.name)) = lower(btrim(coalesce(d.table_name, '')));
  return n;
end $$;
revoke all on function public.app__debt_people_backfill() from public, anon, authenticated;

-- ---- Danh sách người nợ của một cơ sở (người vào được Sổ thu chi của cơ sở đó).
create or replace function public.app_stc_people(p_branch bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__stc_need(p_branch);
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'phone', p.phone, 'grp', p.grp, 'active', p.active,
             'open', coalesce(o.open, 0), 'n', coalesce(o.n, 0)) order by p.active desc, array_position(array['khach', 'kho', 'khac'], p.grp), lower(p.name))
      from public.debt_people p
      left join (select d.person_id, sum(d.amount) open, count(*) n from public.shift_debts d
                  where d.branch_id = p_branch and d.closed_at is null and d.amount > 0 and d.person_id is not null
                    and not exists (select 1 from public.shift_debts z where z.split_from = d.id)
                  group by d.person_id) o on o.person_id = p.id
     where p.branch_id = p_branch), '[]'::jsonb);
end $$;

-- ---- Thêm / sửa / ngừng dùng một người nợ. p = {branch_id, name, phone, grp, active}; p_id trống = thêm.
create or replace function public.app_stc_person_save(p_id bigint, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); old public.debt_people; br bigint := nullif(p ->> 'branch_id', '')::bigint;
  nm text := btrim(coalesce(p ->> 'name', '')); ph text := nullif(btrim(coalesce(p ->> 'phone', '')), ''); g text := p ->> 'grp';
  act int := case when p ? 'active' and (p ->> 'active') in ('0', 'false') then 0 else 1 end; nid bigint;
begin
  if p_id is not null then
    select * into old from public.debt_people where id = p_id;
    if old.id is null then raise exception 'Không tìm thấy người nợ.'; end if;
    br := old.branch_id;
  end if;
  perform public.app__stc_need(br);
  if nm = '' then raise exception 'Nhập tên người nợ.'; end if;
  if coalesce(g, '') not in ('khach', 'kho', 'khac') then raise exception 'Chọn nhóm công nợ.'; end if;
  if old.id is not null and lower(btrim(old.name)) = 'kho tổng' and (lower(nm) <> 'kho tổng' or act = 0 or g <> 'kho') then
    raise exception 'Kho tổng luôn có — không đổi tên / ngừng dùng được.';
  end if;
  if exists (select 1 from public.debt_people x where x.branch_id = br and lower(btrim(x.name)) = lower(nm) and x.id is distinct from p_id) then
    raise exception 'Đã có người nợ tên này.';
  end if;
  if p_id is null then
    insert into public.debt_people(branch_id, name, phone, grp, active, created_by) values (br, nm, ph, g, act, a.id) returning id into nid;
  else
    nid := p_id;
    update public.debt_people set name = nm, phone = ph, grp = g, active = act where id = p_id;
    if old.name is distinct from nm then   -- đổi tên: các khoản chưa thu của người này mang tên mới (tab Công nợ gộp theo tên)
      begin
        update public.shift_debts set table_name = nm where person_id = p_id and closed_at is null and table_name is distinct from nm;
      exception when others then
        raise exception 'Chưa đổi tên được vì người này có khoản nợ ở ca chưa đối soát được: %', sqlerrm;
      end;
    end if;
    if old.grp is distinct from g then
      update public.shift_debts set grp = g where person_id = p_id and closed_at is null and grp is distinct from g;
    end if;
  end if;
  perform public.app_log('stc_nguoi_no_luu', 'person=' || nid || ' ' || nm || ' · ' || g || case when act = 0 then ' · ngừng dùng' else '' end);
  return nid;
end $$;

-- ---- Phiếu chốt ca / trang Đối soát ca vẫn hỏi tên nhóm Kho tổng / Nợ khác như cũ — nay đọc từ danh sách thật.
create or replace function public.app_ca_debt_people(p_branch bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account();
begin
  if a.id is null or not (coalesce(public.app_can('chot_ca'), false) or coalesce(public.app_can('doi_soat'), false)) then raise exception 'Bạn không có quyền.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'grp', p.grp, 'id', p.id) order by p.grp desc, lower(p.name))
      from public.debt_people p
     where p.branch_id = p_branch and p.active = 1 and p.grp in ('kho', 'khac') and lower(btrim(p.name)) <> 'kho tổng'), '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('name', 'Kho tổng', 'grp', 'kho',
         'id', (select p.id from public.debt_people p where p.branch_id = p_branch and lower(btrim(p.name)) = 'kho tổng')));
end $$;

revoke all on function public.app_stc_people(bigint) from public, anon;
revoke all on function public.app_stc_person_save(bigint, jsonb) from public, anon;
grant execute on function public.app_stc_people(bigint) to authenticated;
grant execute on function public.app_stc_person_save(bigint, jsonb) to authenticated;

-- ---- Quản lý xếp một khoản nợ vào đúng người + nhóm công nợ (bước 1 của Đối soát Fabi; cũng dùng được cho nợ ngoài ca).
create or replace function public.app_stc_debt_sort(p_debt bigint, p_person bigint, p_grp text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); d public.shift_debts; p public.debt_people; r public.shift_reports; typed text; open_n int;
begin
  select * into d from public.shift_debts where id = p_debt for update;
  if d.id is null then raise exception 'Không tìm thấy khoản nợ.'; end if;
  if d.report_id is not null then r := public.app__stc_ds_need(d.report_id, false);
  else perform public.app__stc_need(d.branch_id); end if;
  if d.split_from is not null then raise exception 'Xếp ở khoản nợ gốc của khoản này.'; end if;
  with recursive tree as (
    select g.id, g.closed_at from public.shift_debts g where g.id = d.id
    union all
    select c.id, c.closed_at from public.shift_debts c join tree t on c.split_from = t.id)
  select count(*) into open_n from tree where closed_at is null;
  if open_n = 0 then raise exception 'Khoản nợ đã thu — không đổi được.'; end if;
  select * into p from public.debt_people where id = p_person and branch_id = d.branch_id and active = 1;
  if p.id is null then raise exception 'Chọn người nợ trong danh sách.'; end if;
  if coalesce(p_grp, '') not in ('khach', 'kho', 'khac') then raise exception 'Chọn nhóm công nợ.'; end if;
  if d.report_id is not null and exists (select 1 from public.stc_ca_done c where c.report_id = d.report_id) then
    raise exception 'Ca đã hoàn thành đối soát — bấm Mở lại trước.';
  end if;
  if public.app__fin_locked(d.branch_id, coalesce(r.work_date, left(d.created_at, 10))) then raise exception 'Tháng này đã CHỐT — không đổi được.'; end if;
  typed := btrim(coalesce(d.table_name, ''));
  perform set_config('app.debt_sort', '1', true);
  update public.shift_debts x set table_name = p.name, person_id = p.id, grp = p_grp, sorted_by = a.id, sorted_at = public.vn_now_text(),
         content = case when typed <> '' and lower(typed) <> lower(btrim(p.name)) then typed else x.content end   -- giữ lại chữ nhân viên gõ
   where x.id = d.id;
  -- khoản con chưa thu của nợ tách kiểu cũ nhận theo
  with recursive tree as (
    select c.id from public.shift_debts c where c.split_from = d.id
    union all
    select c.id from public.shift_debts c join tree t on c.split_from = t.id)
  update public.shift_debts x set table_name = p.name, person_id = p.id, grp = p_grp, sorted_by = a.id, sorted_at = public.vn_now_text()
   where x.id in (select id from tree) and x.closed_at is null;
  perform set_config('app.debt_sort', '', true);
  if d.report_id is not null then
    insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
    values (d.report_id, 'xep_no', null, jsonb_build_object('table_name', typed, 'grp', d.grp),
            jsonb_build_object('id', d.id, 'table_name', p.name, 'grp', p_grp), 'Xếp người + nhóm công nợ', a.id);
  end if;
  perform public.app_log('stc_xep_no', 'debt=' || d.id || ' → ' || p.name || ' · ' || p_grp);
end $$;
revoke all on function public.app_stc_debt_sort(bigint, bigint, text) from public, anon;
grant execute on function public.app_stc_debt_sort(bigint, bigint, text) to authenticated;

-- ---- Những mục còn thiếu để Hoàn thành đối soát ca: bản của tệp 150 + mục "nợ mới của ca đã xếp người + nhóm công nợ" (bước 172).
-- Giống hàm dsChecks ở docs/js/so_thu_chi_tinh.js. Xếp nợ KHÔNG chặn Xác nhận Fabi (hàm này chỉ dùng cho nút Hoàn thành ở bước 6).
create or replace function public.app__stc_ds_missing(p_report bigint) returns text[]
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; s jsonb; m jsonb; ca jsonb; its jsonb; out text[] := '{}'; tk text[]; last_ca boolean; nx public.shift_reports; ns jsonb;
  chi_n int; chi_nocat int; chi_big int; thu_no int; pm text; pend int; big_gap int; n_sort int;
begin
  select * into r from public.shift_reports where id = p_report;
  s := public.app__stc_ds_state(p_report);
  if not coalesce((s ->> 'done')::boolean, false) then return array['Chưa Xác nhận Fabi']; end if;
  m := public.app_stc_month(r.branch_id, left(r.work_date, 7));
  select c into ca from jsonb_array_elements(m -> 'cas') c where (c ->> 'id')::bigint = p_report;
  select coalesce(jsonb_agg(i), '[]') into its from jsonb_array_elements(m -> 'items') i
   where (i ->> 'ca_id')::bigint = p_report and not coalesce((i ->> 'void')::boolean, false);
  select coalesce(array_agg(item), '{}') into tk from public.stc_ca_ticks where report_id = p_report;
  -- bước 1
  if not ((s ->> 'mo1')::boolean and (s ->> 'mo2')::boolean) then out := array_append(out, 'Tiền mở ca chưa khớp'::text); end if;
  if not (s ->> 'dt')::boolean then out := array_append(out, 'Doanh thu chưa khớp máy Fabi'::text); end if;
  if not (s ->> 'no')::boolean then out := array_append(out, 'Nợ bill chưa khớp máy Fabi'::text); end if;
  -- bước 172: nợ mới của ca còn tiền chưa thu mà chưa xếp người + nhóm công nợ (tính cả nợ tách kiểu cũ: gốc đã thu, con chưa thu)
  with recursive tree as (
    select g.id root, g.id, g.closed_at from public.shift_debts g
     where g.report_id = p_report and g.split_from is null and g.amount > 0 and g.sorted_at is null
    union all
    select t.root, c.id, c.closed_at from public.shift_debts c join tree t on c.split_from = t.id)
  select count(distinct t.root) into n_sort from tree t where t.closed_at is null;
  if n_sort > 0 then out := array_append(out, format('Còn %s khoản nợ mới chưa xếp người + nhóm công nợ', n_sort)); end if;
  if coalesce((ca -> 'fabi' ->> 'edited_bills')::int, 0) > 0 and not ('hd' = any(tk)) then out := array_append(out, 'Chưa tích: đã hỏi về hoá đơn bị sửa / xoá'::text); end if;
  if not ('anh' = any(tk)) then out := array_append(out, 'Chưa tích: ảnh phiếu Fabi đúng với số máy'::text); end if;
  -- bước 2
  select o.* into nx from public.shift_reports o
   where o.branch_id = r.branch_id and o.work_date = r.work_date and o.status = 'hoan_thanh'
     and array_position(public.app__shifts(), o.shift) > array_position(public.app__shifts(), r.shift)
   order by array_position(public.app__shifts(), o.shift) limit 1;
  last_ca := nx.id is null;
  if coalesce(r.cash_mode, 'ngay') = 'ca' and r.ql_counted is null then out := array_append(out, 'Chưa nhập tiền mặt quản lý đếm két'::text); end if;
  if coalesce(r.cash_mode, 'ngay') = 'ca' or last_ca then
    if not ('goi' = any(tk)) then out := array_append(out, 'Chưa tích: két để lại đúng 1.000.000 cho ca sau'::text); end if;
  else
    ns := public.app__stc_ds_state(nx.id);
    if not ((ns ->> 'mo1')::boolean and (ns ->> 'mo2')::boolean) then out := array_append(out, 'Tiền đóng ca này chưa bằng tiền mở ca sau'::text); end if;
  end if;
  if ca ->> 'bank_ck' is null or coalesce((ca ->> 'kt_wait')::boolean, false) then out := array_append(out, 'Chuyển khoản chưa có số ngân hàng'::text); end if;
  -- bước 3
  select count(*) into thu_no from jsonb_array_elements(its) i where i ->> 'book' = 'thu' and i ->> 'col' = 'no';
  if thu_no > 0 and not ('tn' = any(tk)) then out := array_append(out, 'Chưa tích: thu nợ đúng khách'::text); end if;
  if not ('sot' = any(tk)) then out := array_append(out, 'Chưa tích: không sót khoản thu'::text); end if;
  -- bước 4
  select count(*), count(*) filter (where coalesce(i ->> 'cat', '') = ''), count(*) filter (where (i ->> 'amount')::numeric >= 300000)
    into chi_n, chi_nocat, chi_big from jsonb_array_elements(its) i where i ->> 'book' = 'chi' and i ->> 'col' = 'chi';
  if chi_nocat > 0 then out := array_append(out, format('Còn %s khoản chi chưa chọn nhóm', chi_nocat)); end if;
  if chi_n > 0 and not ('that' = any(tk)) then out := array_append(out, 'Chưa tích: khoản chi có thật'::text); end if;
  if chi_big > 0 and not ('lon' = any(tk)) then out := array_append(out, 'Chưa tích: đã xem khoản từ 300.000'::text); end if;
  -- bước 5: dòng Chênh lệch — xong khi chữ trạng thái không còn "chờ", hoặc đang chờ Chủ duyệt, hoặc đã bấm Để sau
  foreach pm in array array['tm', 'ck'] loop
    select count(*) into pend from jsonb_array_elements(its) i
     where i ->> 'col' = 'lech' and i ->> 'pm' = pm and coalesce((i ->> 'gross')::numeric, (i ->> 'amount')::numeric, 0) <> 0
       and case when coalesce(i ->> 'status', '') <> '' then (i ->> 'status') ~* 'chờ' and not (i ->> 'status') ~* 'chờ Chủ duyệt'
                else i -> 'gap' is not null and jsonb_typeof(i -> 'gap') <> 'null' end;
    if pend > 0 and not (('sau_' || pm) = any(tk)) then
      out := array_append(out, case pm when 'tm' then 'Tiền mặt' else 'Chuyển khoản' end || ' lệch chưa chọn cách xử lý');
    end if;
  end loop;
  select count(*) into big_gap from jsonb_array_elements(its) i
   where i ->> 'col' = 'lech' and coalesce((i ->> 'gross')::numeric, (i ->> 'amount')::numeric, 0) <> 0 and not coalesce(i ->> 'status', '') ~ 'Lệch nhỏ';
  if big_gap > 0 and not ('ld' = any(tk)) then out := array_append(out, 'Chưa tích: đã hỏi lý do thiếu / thừa'::text); end if;
  return out;
end $$;
revoke all on function public.app__stc_ds_missing(bigint) from public, anon, authenticated;

-- ---- app_stc_month: dòng "nợ mới" của ca (ca_debts, t = 'moi') trả thêm nhóm, người, đã xếp chưa, chữ nhân viên gõ. Vá đúng 1 dòng, giữ mọi phần khác.
do $$
declare d text; anchor text;
begin
  d := pg_get_functiondef('public.app_stc_month(bigint,text)'::regprocedure);
  if position($q$'sorted', g.sorted_at is not null$q$ in d) = 0 then
    anchor := $q$'amount', s.amt, 'left', s.lft, 'pm', null, 'from', null) z, g.report_id rid, 'moi' t$q$;
    if position(anchor in d) = 0 then raise exception 'app_stc_month: không thấy chỗ chèn (ca_debts · nợ mới).'; end if;
    execute replace(d, anchor,
      $q$'amount', s.amt, 'left', s.lft, 'pm', null, 'from', null, 'grp', g.grp, 'person_id', g.person_id, 'sorted', g.sorted_at is not null, 'content', g.content) z, g.report_id rid, 'moi' t$q$);
  end if;
end $$;

-- ---- Chạy bù MỘT LẦN khi phát hành.
do $$
begin
  if not exists (select 1 from public.app_migrations where file = '151_nguoi_no.sql') then
    perform public.app__debt_people_backfill();
    -- nợ của các ca đã Hoàn thành đối soát trước bước 172: coi như đã xếp (không bắt quay lại)
    update public.shift_debts d set sorted_at = 'trước bước 172'
     where d.sorted_at is null and d.report_id is not null and exists (select 1 from public.stc_ca_done c where c.report_id = d.report_id);
  end if;
end $$;

insert into public.app_migrations(file) values ('151_nguoi_no.sql') on conflict (file) do nothing;
