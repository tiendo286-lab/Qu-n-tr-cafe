-- 188 (anh Tiến chốt 27/11/2026): ĐÀO TẠO — hạng mục ĐÃ ĐƯỢC XÁC NHẬN ĐẠT thì nhân viên Cấp 1 không sửa được nữa.
--  Trước đây Cấp 1 chạm lại mục đã xác nhận → mục quay về "Chờ kiểm tra" (mất kết quả đã duyệt, phải xác nhận lại).
--  * app_dt_mark: người ghi là Cấp 1 (không phải người hướng dẫn chính / người phụ trách chính) + mục đang có mức và KHÔNG chờ kiểm tra → báo lỗi.
--    Ngoại lệ: Cấp 1 đang được giao luyện GIAI ĐOẠN 2 cho đúng mục đó (training_followups.is_extra, chưa xong) — đó là việc chấm lại có chủ đích.
--    Mục đang chờ kiểm tra thì Cấp 1 vẫn sửa được như cũ. Người khác (quản lý có quyền Đào tạo, HD chính, PTC) không đổi gì.
--  * app_dt_get: trả thêm cap1_lock (người xem là Cấp 1 thuộc diện trên) để web khoá sẵn ô của mục đã xác nhận.
--  Vá bằng thay chuỗi trên bản đang chạy: đã vá rồi thì bỏ qua, không thấy đúng một chỗ thì DỪNG. Chạy lại nhiều lần không lỗi.
do $$
declare d text; x record;
begin
  for x in select * from (values
      ('public.app_dt_mark(bigint,integer,jsonb)',
       '  cap1 := not checker and exists (select 1 from public.employees e where e.id = a.employee_id and e.rank = ''Cấp 1'');',
       '  cap1 := not checker and exists (select 1 from public.employees e where e.id = a.employee_id and e.rank = ''Cấp 1'');
  -- tệp 188: mục đã xác nhận đạt thì Cấp 1 không sửa (trừ khi đang được giao giai đoạn 2 của mục đó)
  if cap1 and m.level is not null and not coalesce(m.cho_kiem_tra, false)
     and not exists (select 1 from public.training_followups f2 where f2.training_id = t.id and f2.item_no = p_no
                       and f2.employee_id = a.employee_id and f2.is_extra and f2.finished_at is null) then
    raise exception ''Hạng mục % đã được xác nhận đạt — nhân viên Cấp 1 không sửa được. Cần đổi thì nhờ người hướng dẫn chính hoặc người phụ trách chính.'', p_no;
  end if;'),
      ('public.app_dt_get(bigint)',
       '    ''can_check'', public.app__dt_can_check(a, t),',
       '    ''can_check'', public.app__dt_can_check(a, t),
    ''cap1_lock'', (not public.app__dt_can_check(a, t) and exists (select 1 from public.employees e where e.id = me_emp and e.rank = ''Cấp 1'')),')
    ) v(fn, cu, moi) loop
    d := pg_get_functiondef(x.fn::regprocedure);
    continue when position('tệp 188' in d) > 0 or position('''cap1_lock''' in d) > 0;
    if (length(d) - length(replace(d, x.cu, ''))) / length(x.cu) <> 1 then
      raise exception 'Tệp 188: % không có đúng một chỗ cần vá — dừng, không đổi gì.', x.fn;
    end if;
    execute replace(d, x.cu, x.moi);
  end loop;
end $$;

insert into public.app_migrations(file) values ('188_dao_tao_cap1_khong_sua_muc_dat.sql') on conflict (file) do nothing;
