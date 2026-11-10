-- =====================================================================
-- BƯỚC 37: SỔ TAY QUY TRÌNH TỪ FILE WORD + HƯỚNG DẪN TRONG PHIẾU ĐÀO TẠO (anh Tiến chốt 11/11/2026)
--  * Bản gốc: file Word trong thư mục quy_trinh_goc/ trên máy anh Tiến (không lên GitHub).
--    Công cụ cong_cu/cap_nhat_quy_trinh.py chuyển file thành các bài Quy trình và gọi các hàm app__qt_* dưới đây
--    (chỉ chạy được bằng quyền quản trị máy chủ, web không gọi được).
--  * Bài đi từ file chỉ để đọc trên web: không sửa / xóa / gỡ đăng trên web (chỉ đổi thứ tự được).
--  * Mỗi thẻ công việc / bước SOP có dòng "◆ Đào tạo: Ngày X · STT Y" → lưu đoạn hướng dẫn theo STT
--    để phiếu đào tạo mở cửa sổ hướng dẫn đúng hạng mục.
-- Chạy lại nhiều lần không sao.
-- =====================================================================

alter table public.docs add column if not exists src_key text;     -- vd 'so_tay_cb:sop01' — bài lấy từ file Word
alter table public.docs add column if not exists src_file text;
alter table public.docs add column if not exists src_hash text;
create unique index if not exists docs_src_key on public.docs (src_key) where src_key is not null;

create table if not exists public.training_guides (
  program_code text not null,
  item_no integer not null,
  seq integer not null,
  doc_id bigint references public.docs(id) on delete cascade,
  heading text,
  html text not null,
  primary key (program_code, item_no, seq)
);
alter table public.training_guides enable row level security;
revoke all on public.training_guides from anon, authenticated;

-- Chặn sửa / xóa bài lấy từ file Word (trừ khi công cụ cập nhật đang chạy, hoặc chỉ đổi thứ tự)
create or replace function public.app__docs_src_guard() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.qt_sync', true), '') = '1' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    if old.src_key is not null then raise exception 'Bài này lấy từ sổ tay gốc (file Word trên máy anh Tiến) nên không xóa trên web được.'; end if;
    return old;
  end if;
  if old.src_key is not null and (new.title, new.draft_html, new.published_html, new.published_title, new.published_version, new.src_key)
       is distinct from (old.title, old.draft_html, old.published_html, old.published_title, old.published_version, old.src_key) then
    raise exception 'Bài này lấy từ sổ tay gốc (file Word trên máy anh Tiến): sửa file Word rồi nhắn cập nhật quy trình.';
  end if;
  if old.src_key is null and new.src_key is not null then raise exception 'Không đổi được nguồn bài.'; end if;
  return new;
end $$;
drop trigger if exists docs_src_guard on public.docs;
create trigger docs_src_guard before update or delete on public.docs for each row execute function public.app__docs_src_guard();

-- Danh sách tài liệu: thêm cờ from_file để web ẩn nút Sửa
create or replace function public.app_tl_list(p_kind text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; editor boolean;
begin
  a := public.app__need(null);
  editor := public.app_can('soan_tai_lieu');
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', d.id, 'title', case when editor then d.title else d.published_title end, 'published_title', d.published_title,
      'sort_order', d.sort_order, 'published_html', d.published_html, 'published_version', d.published_version,
      'published_at', d.published_at, 'published_by', coalesce(public.app__acc_name(d.published_by), case when d.src_key is not null then 'Sổ tay gốc' end),
      'updated_at', d.updated_at, 'updated_by', public.app__acc_name(d.updated_by),
      'from_file', d.src_key is not null,
      'has_draft', d.src_key is null and (editor and d.draft_html is distinct from coalesce(d.published_html, '') or (editor and d.title is distinct from d.published_title)),
      'read_version', (select r.version from public.doc_reads r where r.doc_id = d.id and r.employee_id = a.employee_id),
      'read_at', (select r.read_at from public.doc_reads r where r.doc_id = d.id and r.employee_id = a.employee_id))
    order by d.sort_order, d.id)
    from public.docs d where d.kind = p_kind and (editor or d.published_version > 0)), '[]');
end $$;

-- ---------------------------------------------------------------- Công cụ cập nhật (chỉ quyền quản trị)
-- Thêm / cập nhật 1 bài. Trả về {id, changed}. Nội dung đổi → đăng phiên bản mới.
create or replace function public.app__qt_upsert(p_key text, p_title text, p_sort integer, p_html text, p_file text, p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.docs; nid bigint;
begin
  perform set_config('app.qt_sync', '1', true);
  select * into d from public.docs where src_key = p_key;
  if d.id is null then
    insert into public.docs(kind, title, sort_order, draft_html, published_html, published_title, published_version, published_at, src_key, src_file, src_hash)
    values ('quy_trinh', p_title, p_sort, p_html, p_html, p_title, 1, public.vn_now_text(), p_key, p_file, p_hash) returning id into nid;
    return jsonb_build_object('id', nid, 'changed', true, 'new', true);
  end if;
  if d.published_html is not distinct from p_html and d.published_title is not distinct from p_title then
    update public.docs set sort_order = p_sort, src_file = p_file, src_hash = p_hash where id = d.id;
    return jsonb_build_object('id', d.id, 'changed', false);
  end if;
  update public.docs set title = p_title, draft_html = p_html, published_html = p_html, published_title = p_title,
         published_version = published_version + 1, published_at = public.vn_now_text(), published_by = null,
         sort_order = p_sort, src_file = p_file, src_hash = p_hash, updated_at = public.vn_now_text(), updated_by = null
   where id = d.id;
  return jsonb_build_object('id', d.id, 'changed', true);
end $$;

-- Gỡ các bài của 1 file không còn trong lần cập nhật này (vd file bỏ bớt phần)
create or replace function public.app__qt_prune(p_prefix text, p_keep text[]) returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform set_config('app.qt_sync', '1', true);
  delete from public.docs where src_key like p_prefix || '%' and not (src_key = any(p_keep));
  get diagnostics n = row_count;
  return n;
end $$;

-- Thay toàn bộ đoạn hướng dẫn của 1 chương trình đào tạo. p_rows: [{item, seq, key, heading, html}]
create or replace function public.app__qt_guides(p_program text, p_rows jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.training_guides where program_code = p_program;
  insert into public.training_guides(program_code, item_no, seq, doc_id, heading, html)
  select p_program, (x ->> 'item')::int, (x ->> 'seq')::int, d.id, x ->> 'heading', x ->> 'html'
    from jsonb_array_elements(p_rows) x left join public.docs d on d.src_key = x ->> 'key';
  get diagnostics n = row_count;
  return n;
end $$;

-- Cập nhật số trang sổ tay của hạng mục đào tạo. p_pages: {"1": "41", ...}. Trả về số hạng mục đổi.
create or replace function public.app__qt_pages(p_program text, p_pages jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.training_items i set page = p_pages ->> i.no::text
    from public.training_programs p
   where p.id = i.program_id and p.code = p_program and p_pages ? i.no::text and i.page is distinct from p_pages ->> i.no::text;
  get diagnostics n = row_count;
  return n;
end $$;

-- Báo 1 lần cho mọi người khi có bài mới / bài thay đổi
create or replace function public.app__qt_notify(p_titles text[]) returns integer
language plpgsql security definer set search_path = public as $$
declare x bigint; n int := 0;
begin
  if coalesce(array_length(p_titles, 1), 0) = 0 then return 0; end if;
  for x in select ac.id from public.accounts ac left join public.employees e on e.id = ac.employee_id
            where ac.locked = 0 and (ac.employee_id is null or e.status = 'Đang làm') loop
    perform public.app__notify(x, 'Sổ tay quy trình cập nhật: ' || array_length(p_titles, 1) || ' bài',
      array_to_string(p_titles[1:8], E'\n') || case when array_length(p_titles, 1) > 8 then E'\n…' else '' end, '/quy-trinh');
    n := n + 1;
  end loop;
  perform public.app_log('cap_nhat_quy_trinh', array_length(p_titles, 1) || ' bài');
  return n;
end $$;

-- ---------------------------------------------------------------- Web: hướng dẫn của 1 hạng mục đào tạo
create or replace function public.app_dt_guide(p_program text, p_item integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need(null);
  return jsonb_build_object(
    'item', (select jsonb_build_object('no', i.no, 'day', i.day, 'title', i.title, 'page', i.page)
               from public.training_items i join public.training_programs p on p.id = i.program_id where p.code = p_program and i.no = p_item),
    'guides', coalesce((select jsonb_agg(jsonb_build_object('seq', g.seq, 'heading', g.heading, 'html', g.html,
                  'doc_id', g.doc_id, 'doc_title', d.published_title) order by g.seq)
                from public.training_guides g left join public.docs d on d.id = g.doc_id and d.published_version > 0
               where g.program_code = p_program and g.item_no = p_item), '[]'));
end $$;

-- Số hạng mục có hướng dẫn (để phiếu đào tạo biết hạng mục nào bấm được)
create or replace function public.app_dt_guide_items(p_program text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.app_staff() then coalesce((select jsonb_agg(distinct g.item_no) from public.training_guides g where g.program_code = p_program), '[]') end
$$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'app\_\_qt\_%' or p.proname in ('app__docs_src_guard', 'app_dt_guide', 'app_dt_guide_items', 'app_tl_list')) loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname like 'app\_\_%' then
      execute format('revoke execute on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
