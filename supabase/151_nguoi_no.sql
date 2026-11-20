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
  if tg_op = 'UPDATE' and new.person_id is distinct from old.person_id and new.sorted_at is not distinct from old.sorted_at then
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
