-- Bài thử cho supabase/180: máy Mac (ai_viec) không còn tự ghi kiến thức được; vẫn nhận việc / ghi kết quả được.
do $$
declare rep text := '';
begin
  rep := rep || case when not has_function_privilege('ai_viec', 'public.app__ai_nhap_kien_thuc(text,text)', 'execute') then 'ĐẠT' else 'HỎNG' end || ' ai_viec không tự ghi kiến thức' || chr(10);
  rep := rep || case when has_function_privilege('ai_viec', 'public.app__ai_nhan_viec(integer)', 'execute')
                      and has_function_privilege('ai_viec', 'public.app__ai_ghi_ket_qua(bigint,text,text,jsonb,text)', 'execute') then 'ĐẠT' else 'HỎNG' end || ' ai_viec vẫn nhận việc, ghi kết quả' || chr(10);
  raise exception 'REPORT>> %', chr(10) || rep;
end $$;
