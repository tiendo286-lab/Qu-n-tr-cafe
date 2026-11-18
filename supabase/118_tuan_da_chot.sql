-- BƯỚC 134 (tệp 118): trang Lịch làm lấy danh sách tuần đã chốt bằng 1 câu hỏi.
-- Trước: web tải MỌI dòng schedule_published (≈ 250 dòng / tuần) để lấy số tuần → chậm dần và chạm giới hạn 1.000 dòng / lần hỏi
-- của máy chủ sau ~4 tuần (trang Lịch có thể thiếu tuần mới nhất).
create or replace function public.app_published_weeks() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  perform public.app__need(null);   -- phải đăng nhập
  return coalesce((select jsonb_agg(to_jsonb(w) order by w.start_date)
                     from public.weeks w where exists (select 1 from public.schedule_published p where p.week_id = w.id)), '[]'::jsonb);
end $function$;
revoke all on function public.app_published_weeks() from public, anon;
grant execute on function public.app_published_weeks() to authenticated;

insert into public.app_migrations(file) values ('118_tuan_da_chot.sql') on conflict (file) do nothing;
