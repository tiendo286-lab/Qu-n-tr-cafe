-- Chặng 6.2 (anh Tiến duyệt hình mẫu 23/11/2026): trang "Duyệt nghỉ & làm thay" — thẻ "Đã duyệt".
-- Danh sách ca đã Chủ duyệt nghỉ & làm thay (x2) trong một tháng, kèm cờ còn khiếu nại chưa xem.
-- CHỈ ĐỌC. Quyền như app_cv_todo (doi_soat). Không đổi quyền, không đổi cách tính x2 / trừ giờ.
-- Chi tiết từng ca vẫn đọc bằng app_cv_get; sửa / duyệt lại vẫn bằng app_cv_approve (chỉ Chủ). Chạy lại nhiều lần không sao.
create or replace function public.app_cv_done(p_month text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('doi_soat');
  if coalesce(p_month, '') !~ '^\d{4}-\d{2}$' then raise exception 'Tháng không hợp lệ.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'branch_id', r.branch_id, 'branch', coalesce(b.display_code, b.code),
            'date', r.work_date, 'shift', r.shift, 'ok_at', v.ok_at, 'ok_by', public.app__acc_name(v.ok_by),
            'complaint', exists (select 1 from public.shift_covers c where c.report_id = r.id and c.resolved_at is null
                                   and (c.complaint_absent is not null or c.complaint_helper is not null)))
           order by r.work_date, array_position(public.app__shifts(), r.shift), b.sort_order)
      from public.shift_cover_reviews v
      join public.shift_reports r on r.id = v.report_id
      join public.branches b on b.id = r.branch_id
     where v.ok_at is not null and r.work_date like p_month || '-%'
       and public.app__cv_state(r.id) = 'da_duyet'), '[]');
end $$;
revoke execute on function public.app_cv_done(text) from public, anon;
grant execute on function public.app_cv_done(text) to authenticated;

insert into public.app_migrations(file) values ('165_cv_da_duyet.sql') on conflict (file) do nothing;
