-- BƯỚC 77 — QUY TRÌNH SỬA TRỰC TIẾP TRÊN WEB NHƯ TRƯỚC (anh Tiến chốt 13/11/2026)
--  * Bỏ khóa các bài từng nhập từ file Word; mọi bài Quy trình lại sửa / đăng / gỡ / xóa trên web.
--  * Chuyển các bài nguồn Word hiện có thành bài web bình thường, giữ nguyên nội dung, ảnh, phiên bản và liên kết hướng dẫn đào tạo.
--  * Ngừng cập nhật nội dung Quy trình bằng công cụ Word cũ để không ghi đè sửa đổi trên web.
-- Chạy lại nhiều lần không sao.

drop trigger if exists docs_src_guard on public.docs;

update public.docs
   set src_key = null, src_file = null, src_hash = null
 where kind = 'quy_trinh' and (src_key is not null or src_file is not null or src_hash is not null);

-- Danh sách tài liệu trở lại hành vi cũ: mọi bài đều là bài web có thể soạn và có bản nháp.
create or replace function public.app_tl_list(p_kind text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; editor boolean;
begin
  a := public.app__need(null);
  editor := public.app_can('soan_tai_lieu');
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', d.id, 'title', case when editor then d.title else d.published_title end, 'published_title', d.published_title,
      'sort_order', d.sort_order, 'published_html', d.published_html, 'published_version', d.published_version,
      'published_at', d.published_at, 'published_by', public.app__acc_name(d.published_by),
      'updated_at', d.updated_at, 'updated_by', public.app__acc_name(d.updated_by),
      'from_file', false,
      'has_draft', editor and (d.draft_html is distinct from coalesce(d.published_html, '') or d.title is distinct from d.published_title),
      'read_version', (select r.version from public.doc_reads r where r.doc_id = d.id and r.employee_id = a.employee_id),
      'read_at', (select r.read_at from public.doc_reads r where r.doc_id = d.id and r.employee_id = a.employee_id))
    order by d.sort_order, d.id)
    from public.docs d where d.kind = p_kind and (editor or d.published_version > 0)), '[]');
end $$;

-- Nếu ai chạy nhầm công cụ Word cũ, dừng rõ ràng thay vì tạo bài trùng hoặc ghi đè nội dung web.
create or replace function public.app__qt_upsert(p_key text, p_title text, p_sort integer, p_html text, p_file text, p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Quy trình đã chuyển về sửa trực tiếp trên web; công cụ đồng bộ Word không còn được dùng.';
end $$;

revoke execute on function public.app_tl_list(text) from public, anon;
grant execute on function public.app_tl_list(text) to authenticated;
revoke execute on function public.app__qt_upsert(text, text, integer, text, text, text) from public, anon, authenticated;
