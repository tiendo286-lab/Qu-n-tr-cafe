-- BƯỚC 77 — QUY TRÌNH SỬA TRỰC TIẾP TRÊN WEB NHƯ TRƯỚC (anh Tiến chốt 13/11/2026)
--  * Bỏ khóa các bài từng nhập từ file Word; mọi bài Quy trình lại sửa / đăng / gỡ / xóa trên web.
--  * Xếp lại đúng thứ tự của lần tải đầu tiên; giữ nguyên nội dung người dùng đã sửa, ảnh, phiên bản và liên kết hướng dẫn đào tạo.
--  * Giữ src_key làm mã nội bộ để có thể khôi phục thứ tự khi chạy lại, nhưng mã này không còn khóa sửa hay hiện trên giao diện.
--  * Ngừng cập nhật nội dung Quy trình bằng công cụ Word cũ để không ghi đè sửa đổi trên web.
-- Chạy lại nhiều lần không sao.

drop trigger if exists docs_src_guard on public.docs;

-- Thứ tự đúng theo file Word ở lần tải đầu tiên. Chỉ đổi sort_order, tuyệt đối không ghi lại tiêu đề / nội dung.
with original_order(src_key, sort_order) as (values
  ('so_tay_cb:doc', 1),
  ('so_tay_cb:ca11', 2),
  ('so_tay_cb:ca12', 3),
  ('so_tay_cb:ca13', 4),
  ('so_tay_cb:ca14', 5),
  ('so_tay_cb:ca15', 6),
  ('so_tay_cb:ca16', 7),
  ('so_tay_cb:ca17', 8),
  ('so_tay_cb:sop00', 9),
  ('so_tay_cb:sop01', 10),
  ('so_tay_cb:sop02', 11),
  ('so_tay_cb:sop03', 12),
  ('so_tay_cb:sop04', 13),
  ('so_tay_cb:sop05', 14),
  ('so_tay_cb:sop06', 15),
  ('so_tay_cb:sop07', 16),
  ('so_tay_cb:sop08', 17),
  ('so_tay_cb:sop09', 18),
  ('so_tay_cb:ghi_nho', 19)
)
update public.docs d set sort_order = o.sort_order
  from original_order o
 where d.kind = 'quy_trinh' and d.src_key = o.src_key and d.sort_order is distinct from o.sort_order;

-- Bài Quy trình tự tạo ngoài bộ sổ tay: giữ thứ tự hiện tại và đặt sau 19 bài gốc.
with original_keys(src_key) as (values
  ('so_tay_cb:doc'), ('so_tay_cb:ca11'), ('so_tay_cb:ca12'), ('so_tay_cb:ca13'), ('so_tay_cb:ca14'),
  ('so_tay_cb:ca15'), ('so_tay_cb:ca16'), ('so_tay_cb:ca17'), ('so_tay_cb:sop00'), ('so_tay_cb:sop01'),
  ('so_tay_cb:sop02'), ('so_tay_cb:sop03'), ('so_tay_cb:sop04'), ('so_tay_cb:sop05'), ('so_tay_cb:sop06'),
  ('so_tay_cb:sop07'), ('so_tay_cb:sop08'), ('so_tay_cb:sop09'), ('so_tay_cb:ghi_nho')
), extras as (
  select d.id, (19 + row_number() over (order by d.sort_order, d.id))::integer as new_order
    from public.docs d
   where d.kind = 'quy_trinh' and not exists (select 1 from original_keys k where k.src_key = d.src_key)
)
update public.docs d set sort_order = e.new_order
  from extras e where d.id = e.id and d.sort_order is distinct from e.new_order;

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
