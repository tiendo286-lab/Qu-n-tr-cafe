-- Bước 153 (19/11/2026, anh Tiến chốt sau duyệt mã bước 152): Sổ thu chi trả thêm danh sách MỌI phiếu trừ lương (khoản âm) của tháng —
-- kể cả loại không gắn dòng chênh lệch (Âm tiền chuyển từ khoản chi, trừ vì thu chi / công nợ) — để lọc "Có trừ lương" ở Sổ chi hiện hết,
-- có nút Sửa (app_ka_edit) / Xoá (app_ka_delete) như trang Thu chi cũ, và biết khoản chi nào đã "→ Trừ lương" (move_mkey).
-- Vá thẳng bản đang chạy của app_stc_month (thêm khoá 'shortfalls'), không thấy chỗ chèn thì dừng. Bài thử: kiem_tra/so_thu_chi_139.sql. Chạy lại nhiều lần không sao.
do $$
declare d text;
  anchor text := '''items'', coalesce((select jsonb_agg(jsonb_build_object(''id'', v.id';
  add text := '''shortfalls'', coalesce((select jsonb_agg(jsonb_build_object(''id'', s.id, ''report_id'', s.report_id, ''date'', x.work_date, ''shift'', x.shift,
        ''item'', s.item, ''employee_id'', s.employee_id, ''name'', coalesce(em.name, ''?''), ''amount'', s.amount, ''status'', s.status, ''reply'', s.reply,
        ''reason'', s.reason, ''note'', s.status_note, ''move_mkey'', s.move_mkey) order by x.work_date, s.id)
      from public.shift_shortfalls s join public.shift_reports x on x.id = s.report_id left join public.employees em on em.id = s.employee_id
     where x.branch_id = p_branch and x.work_date between d0 and d1 and s.status <> ''huy''), ''[]''),
    ';
begin
  d := pg_get_functiondef('public.app_stc_month(bigint,text)'::regprocedure);
  if position('''shortfalls'', coalesce(' in d) = 0 then
    if position(anchor in d) = 0 then raise exception 'app_stc_month: không thấy chỗ chèn (items).'; end if;
    d := replace(d, anchor, add || anchor);
    execute d;
  end if;
end $$;

insert into public.app_migrations(file) values ('139_so_thu_chi_moi_tru_luong.sql') on conflict (file) do nothing;
