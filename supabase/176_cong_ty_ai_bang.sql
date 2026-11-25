-- 176 — Công ty AI: bảng, vai ai_viec (máy Mac nhận việc), 7 phòng, hàm nội bộ cho máy Mac (anh Tiến duyệt thiết kế 25/11/2026)
-- Thiết kế: kho riêng cong-ty-ai, tai_lieu/2026-11-25-cong-ty-moi-design.md.
-- Không đổi web Milano, không đụng role_permissions / app_can. Bảng mới: RLS bật, thu hồi quyền anon / authenticated.
-- Mật khẩu vai ai_viec KHÔNG nằm trong tệp này: đặt riêng qua Management API (alter role ai_viec login password ...).
-- Chạy lại nhiều lần không lỗi.

-- ---------------------------------------------------------------- bảng
create table if not exists public.ai_phong (
  ma text primary key check (ma in ('gd','tk','ns','web','kho','kt','rd')),
  ten text not null,
  mo_ta text not null,
  model text not null check (model in ('manh','can_bang','nhanh')),
  thu_tu int not null,
  mo boolean not null default true,
  ghi_chu_khoa text,
  tu_giao boolean not null default false   -- công tắc "Giám đốc tự giao việc nhỏ" cho đợt sau; Đợt 1 không dùng
);

create table if not exists public.ai_viec (
  id bigserial primary key,
  phong text not null references public.ai_phong(ma),
  loai text not null default 'viec' check (loai in ('viec','de_xuat_giao','doc_kien_thuc','ghi_chep')),
  tieu_de text not null,
  noi_dung text not null default '',
  trang_thai text not null default 'cho_lam' check (trang_thai in ('cho_lam','dang_lam','cho_anh','xong','ket')),
  can_chay boolean not null default true,
  cho_ca_cong_ty boolean not null default false,
  cha_id bigint references public.ai_viec(id),
  nguoi_tao bigint not null references public.accounts(id),
  ket_qua jsonb,
  ly_do_ket text,
  tao_luc timestamptz not null default now(),
  cap_nhat timestamptz not null default now(),
  bat_dau timestamptz,
  xong_luc timestamptz
);
create index if not exists ai_viec_cho_idx on public.ai_viec(trang_thai, can_chay, tao_luc);
create index if not exists ai_viec_phong_idx on public.ai_viec(phong, cap_nhat desc);

create table if not exists public.ai_tin (
  id bigserial primary key,
  viec_id bigint not null references public.ai_viec(id) on delete cascade,
  nguoi text not null check (nguoi in ('anh','phong','he_thong')),
  hanh_dong text,
  noi_dung text not null,
  luc timestamptz not null default now()
);
create index if not exists ai_tin_viec_idx on public.ai_tin(viec_id, luc);
alter table public.ai_tin drop constraint if exists ai_tin_hanh_dong_check;
alter table public.ai_tin add constraint ai_tin_hanh_dong_check check (hanh_dong in ('giao','tra_loi','dong_y','nap_kien_thuc','dong_viec'));

create table if not exists public.ai_kien_thuc (
  id bigserial primary key,
  phong text references public.ai_phong(ma),          -- trống = chung cả công ty
  loai text not null check (loai in ('da_chot','tai_lieu')),
  noi_dung text not null,
  trang_thai text not null default 'dang_dung' check (trang_thai in ('dang_dung','da_bo')),
  nguon_viec_id bigint references public.ai_viec(id),
  tao_luc timestamptz not null default now(),
  doi_luc timestamptz not null default now()
);

create table if not exists public.ai_tep (
  id bigserial primary key,
  viec_id bigint references public.ai_viec(id) on delete set null,
  kien_thuc_id bigint references public.ai_kien_thuc(id) on delete set null,
  ten text not null,
  mime text not null,
  kich_thuoc int not null check (kich_thuoc <= 5242880),
  du_lieu bytea not null,
  nguoi_tao bigint not null references public.accounts(id),
  luc timestamptz not null default now()
);
create index if not exists ai_tep_viec_idx on public.ai_tep(viec_id);

create table if not exists public.ai_mac (
  id int primary key check (id = 1),
  lan_cuoi timestamptz,
  phien_ban text,
  dang_nhap_loi boolean not null default false,
  da_bao_mat boolean not null default false
);
insert into public.ai_mac(id) values (1) on conflict (id) do nothing;

do $$
declare t text;
begin
  foreach t in array array['ai_phong','ai_viec','ai_tin','ai_kien_thuc','ai_tep','ai_mac'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated, public', t);
  end loop;
end $$;
revoke all on sequence public.ai_viec_id_seq, public.ai_tin_id_seq, public.ai_kien_thuc_id_seq, public.ai_tep_id_seq from anon, authenticated, public;

-- ---------------------------------------------------------------- sao lưu Milano: bỏ bảng tệp ai_tep
-- app__backup_tables (tệp 59) tự lấy mọi bảng public; tệp ảnh / Excel trong ai_tep (≤5 MB mỗi tệp) làm phình bản sao lưu jsonb
-- hằng ngày (giữ 7 bản) và có thể làm hỏng sao lưu cả web. Định nghĩa lại y hệt tệp 59, chỉ thêm điều kiện bỏ ai_tep.
-- Dữ liệu ai_tep vẫn được Supabase sao lưu hằng ngày (bản sao lưu của máy chủ). Tệp sau có định nghĩa lại hàm này phải giữ điều kiện.
create or replace function public.app__backup_tables() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(c.relname::text order by c.relname), '{}')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not (c.relname::text = any(public.app_import_tables()))
     and c.relname <> 'ai_tep'
$$;

-- ---------------------------------------------------------------- 7 phòng (giữ model anh đã đổi khi chạy lại)
insert into public.ai_phong(ma, ten, mo_ta, model, thu_tu, ghi_chu_khoa) values
  ('gd', 'Giám đốc', 'Nhận việc anh giao, chia cho đúng phòng. Giai đoạn đầu: đề xuất, anh bấm Đồng ý mới giao. Khi ổn định: việc nhỏ tự giao, việc lớn hỏi anh.', 'manh', 1, null),
  ('tk', 'Thư ký', 'Việc riêng của anh, đứng ngoài đường giao việc: ghi họp và kế hoạch mới từ giọng nói của anh, lên lịch Google, nhắc lịch.', 'nhanh', 2, null),
  ('ns', 'Nhân sự & Đào tạo', 'Hồ sơ nhân viên (có mức lương). Viết SOP: pha chế trước, quản lý sau (theo mẫu sổ tay chạy bàn → quản lý góp ý → anh duyệt → Kỹ sư web đưa lên). Kế hoạch đào tạo và phiếu đào tạo.', 'manh', 3, null),
  ('web', 'Kỹ sư web', 'Danh sách tính năng web Milano. Góp ý trong tháng chạy thử chốt ca. Đưa SOP đã duyệt lên web. Sửa lỗi.', 'manh', 4, null),
  ('kho', 'Kho', 'Số liệu iPOS IVT. Ghi nhớ số kiểm kê từng kỳ. Cuối tháng làm phiếu giao hàng cho từng cửa hàng theo giá bán chung. Lãi lỗ kho tổng.', 'can_bang', 5, null),
  ('kt', 'Kế toán', 'Tính lương: tệp Excel iPOS HRM (chấm công chung cả chuỗi) so với lịch ca web Milano → bảng lương nháp và chi phí lương theo cơ sở. Lãi lỗ từng cơ sở và toàn chuỗi (tháng 11 ghi tạm tính).', 'can_bang', 6,
   'Soát tiền ca (FABi so với chốt ca): mở sau tháng chạy thử chốt ca.'),
  ('rd', 'R&D', 'Phát triển sản phẩm: kế hoạch phát triển và thử sản phẩm mới. Lấy giá nhập từ Kho để tính giá vốn; món duyệt chuyển Nhân sự viết SOP; món lên menu Kế toán theo dõi.', 'manh', 7, null)
on conflict (ma) do nothing;

-- ---------------------------------------------------------------- vai của máy Mac
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ai_viec') then
    create role ai_viec nologin noinherit connection limit 2;
  end if;
end $$;
alter role ai_viec set statement_timeout = '20s';
alter role ai_viec set idle_in_transaction_session_timeout = '60s';
grant usage on schema public to ai_viec;
grant select on public.ai_phong, public.ai_viec, public.ai_tin, public.ai_tep, public.ai_kien_thuc, public.ai_mac to ai_viec;
-- RLS bật: cho riêng vai ai_viec đọc (ghi chỉ qua hàm app__ai_*)
do $$
declare t text;
begin
  foreach t in array array['ai_phong','ai_viec','ai_tin','ai_kien_thuc','ai_tep','ai_mac'] loop
    execute format('drop policy if exists ai_viec_doc on public.%I', t);
    execute format('create policy ai_viec_doc on public.%I for select to ai_viec using (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- hàm nội bộ (chỉ máy Mac gọi)
create or replace function public.app__ai_nhip_tim(p_phien_ban text, p_dang_nhap_loi boolean) returns void
language sql security definer set search_path = public as $$
  update public.ai_mac set lan_cuoi = now(), phien_ban = p_phien_ban, dang_nhap_loi = coalesce(p_dang_nhap_loi, false) where id = 1;
$$;

drop function if exists public.app__ai_don_viec_treo();
-- p_giu = null: dọn việc Đang làm quá 35 phút (dự phòng). p_giu = danh sách việc máy Mac đang thật sự chạy:
-- mọi việc Đang làm KHÔNG có trong danh sách là mồ côi (máy Mac khởi động lại / mất việc giữa chừng) → Kẹt ngay.
create or replace function public.app__ai_don_viec_treo(p_giu bigint[] default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  for r in update public.ai_viec set trang_thai = 'ket', ly_do_ket = 'Máy Mac dừng giữa chừng', cap_nhat = now()
            where trang_thai = 'dang_lam'
              and case when p_giu is null then bat_dau < now() - interval '35 minutes' else not (id = any(p_giu)) end
            returning id loop
    insert into public.ai_tin(viec_id, nguoi, noi_dung) values (r.id, 'he_thong', '⛔ Kẹt: Máy Mac dừng giữa chừng');
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.app__ai_nhan_viec(p_toi_da int default 2) returns setof public.ai_viec
language plpgsql security definer set search_path = public as $$
declare dang int; ban text[]; r public.ai_viec;
begin
  perform pg_advisory_xact_lock(hashtext('app__ai_nhan_viec'));
  select count(*), coalesce(array_agg(phong), '{}') into dang, ban from public.ai_viec where trang_thai = 'dang_lam';
  for r in
    select v.* from public.ai_viec v
      join public.ai_phong p on p.ma = v.phong
      join public.accounts a on a.id = v.nguoi_tao
     where v.trang_thai = 'cho_lam' and v.can_chay and p.mo and coalesce(a.system_role, '') = 'chu'
     order by v.tao_luc, v.id
     for update of v skip locked
  loop
    exit when dang >= coalesce(p_toi_da, 2);
    continue when r.phong = any(ban);
    update public.ai_viec set trang_thai = 'dang_lam', can_chay = false, bat_dau = now(), cap_nhat = now()
     where id = r.id returning * into r;
    ban := ban || r.phong;
    dang := dang + 1;
    return next r;
  end loop;
end $$;

create or replace function public.app__ai_ghi_ket_qua(p_id bigint, p_trang_thai text, p_tin text, p_ket_qua jsonb, p_ly_do text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_trang_thai, '') not in ('xong','cho_anh','ket') then
    raise exception 'Trạng thái kết quả không hợp lệ: %', p_trang_thai;
  end if;
  update public.ai_viec
     set trang_thai = p_trang_thai, ket_qua = p_ket_qua,
         ly_do_ket = case when p_trang_thai = 'ket' then p_ly_do end,
         xong_luc = case when p_trang_thai = 'xong' then now() end,
         cap_nhat = now()
   where id = p_id and trang_thai = 'dang_lam';
  if not found then
    raise exception 'Việc % không ở trạng thái Đang làm', p_id;
  end if;
  if coalesce(btrim(p_tin), '') <> '' then
    insert into public.ai_tin(viec_id, nguoi, noi_dung) values (p_id, 'phong', p_tin);
  else
    insert into public.ai_tin(viec_id, nguoi, noi_dung)
    values (p_id, 'he_thong', case when p_trang_thai = 'ket' then '⛔ Kẹt: ' || coalesce(p_ly_do, 'không rõ lý do') else 'Phòng không gửi nội dung' end);
  end if;
end $$;

create or replace function public.app__ai_nhap_kien_thuc(p_phong text, p_noi_dung text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(btrim(p_noi_dung), '') = '' then return false; end if;
  if exists (select 1 from public.ai_kien_thuc where phong is not distinct from p_phong and noi_dung = p_noi_dung) then
    return false;
  end if;
  insert into public.ai_kien_thuc(phong, loai, noi_dung) values (p_phong, 'da_chot', p_noi_dung);
  return true;
end $$;

revoke execute on function public.app__ai_nhip_tim(text, boolean), public.app__ai_don_viec_treo(bigint[]), public.app__ai_nhan_viec(int),
  public.app__ai_ghi_ket_qua(bigint, text, text, jsonb, text), public.app__ai_nhap_kien_thuc(text, text) from public, anon, authenticated;
grant execute on function public.app__ai_nhip_tim(text, boolean), public.app__ai_don_viec_treo(bigint[]), public.app__ai_nhan_viec(int),
  public.app__ai_ghi_ket_qua(bigint, text, text, jsonb, text), public.app__ai_nhap_kien_thuc(text, text) to ai_viec;

insert into public.app_migrations(file) values ('176_cong_ty_ai_bang.sql') on conflict (file) do nothing;
