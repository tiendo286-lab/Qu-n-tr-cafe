-- BƯỚC 78 — NHIỀU BỘ QUY TRÌNH (13/11/2026).
-- Đã đối chiếu sổ app_migrations trên máy chủ trước khi áp dụng.
-- Nhiều bộ quy trình; giữ nguyên ID bài, nội dung, ảnh và liên kết đào tạo.
-- Không đăng lại bài cũ và không gửi lại thông báo. Chạy lại an toàn.
alter table public.docs add column if not exists procedure_title text not null default 'Quy trình nhân viên order';
alter table public.docs add column if not exists published_procedure_title text not null default 'Quy trình nhân viên order';

-- Nhóm của bản đăng chỉ đổi khi đăng; sửa nháp không làm đổi trang nhân viên.
create or replace function public.app__tl_procedure_publish() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.kind = 'quy_trinh' and new.published_version > 0
     and new.published_version is distinct from old.published_version then
    new.published_procedure_title := new.procedure_title;
  end if;
  return new;
end $$;
drop trigger if exists docs_procedure_publish on public.docs;
create trigger docs_procedure_publish before update on public.docs
for each row execute function public.app__tl_procedure_publish();
revoke execute on function public.app__tl_procedure_publish() from public, anon, authenticated;

-- Dùng hàm lưu cũ để giữ nguyên kiểm tra quyền và nội dung.
create or replace function public.app_tl_save_procedure(p_id bigint, p_title text, p_html text, p_procedure text) returns bigint
language plpgsql security definer set search_path = public as $$
declare nid bigint; group_title text;
begin
  perform public.app__need('soan_tai_lieu');
  group_title := trim(coalesce(p_procedure, ''));
  if group_title = '' then raise exception 'Nhập tên quy trình.'; end if;
  if length(group_title) > 160 then raise exception 'Tên quy trình tối đa 160 ký tự.'; end if;
  if p_id is not null then
    perform 1 from public.docs where id = p_id and kind = 'quy_trinh' for update;
    if not found then raise exception 'Không tìm thấy bài quy trình.'; end if;
  end if;
  nid := public.app_tl_save(p_id, 'quy_trinh', p_title, p_html);
  update public.docs set procedure_title = group_title where id = nid;
  return nid;
end $$;
revoke execute on function public.app_tl_save_procedure(bigint, text, text, text) from public, anon;
grant execute on function public.app_tl_save_procedure(bigint, text, text, text) to authenticated;

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
      'procedure_title', case when editor then d.procedure_title else d.published_procedure_title end,
      'published_procedure_title', d.published_procedure_title,
      'has_draft', editor and (d.draft_html is distinct from coalesce(d.published_html, '') or d.title is distinct from d.published_title or (d.kind = 'quy_trinh' and d.procedure_title is distinct from d.published_procedure_title)),
      'read_version', (select r.version from public.doc_reads r where r.doc_id = d.id and r.employee_id = a.employee_id),
      'read_at', (select r.read_at from public.doc_reads r where r.doc_id = d.id and r.employee_id = a.employee_id))
    order by d.sort_order, d.id)
    from public.docs d where d.kind = p_kind and (editor or d.published_version > 0)), '[]');
end $$;


-- Chỉ đổi thứ tự trong cùng bộ quy trình (nội quy vẫn như cũ).
create or replace function public.app_tl_move(p_id bigint, p_dir integer) returns void
language plpgsql security definer set search_path = public as $$
declare d public.docs; ids bigint[]; i int; tmp bigint;
begin
  perform public.app__need('soan_tai_lieu');
  if p_dir is null or p_dir not in (-1, 1) then raise exception 'Hướng di chuyển không hợp lệ.'; end if;
  select * into d from public.docs where id = p_id;
  if d.id is null then return; end if;
  ids := array(select id from public.docs where kind = d.kind
    and (d.kind <> 'quy_trinh' or procedure_title = d.procedure_title) order by sort_order, id);
  i := array_position(ids, p_id);
  if (p_dir < 0 and i <= 1) or (p_dir > 0 and i >= array_length(ids, 1)) then return; end if;
  tmp := ids[i]; ids[i] := ids[i + p_dir]; ids[i + p_dir] := tmp;
  update public.docs x set sort_order = array_position(ids, x.id) where x.id = any(ids);
end $$;
revoke execute on function public.app_tl_move(bigint, integer) from public, anon;
grant execute on function public.app_tl_move(bigint, integer) to authenticated;
revoke execute on function public.app_tl_list(text) from public, anon;
grant execute on function public.app_tl_list(text) to authenticated;

insert into public.app_migrations(file) values ('78_nhieu_quy_trinh.sql') on conflict (file) do nothing;
