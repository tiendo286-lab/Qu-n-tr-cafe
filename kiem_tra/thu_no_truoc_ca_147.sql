-- Bài thử cho supabase/147_thu_no_truoc_ca.sql (bước 168). Gửi SAU tệp 147. Tự tạo dữ liệu giả (năm 2031) rồi REPORT>> tự hoàn tác.
do $$
declare chu public.accounts; br bigint; sa bigint; ch bigint; d1 bigint; n int := 0; e text;
  sh text[] := public.app__shifts();
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null and locked = 0 order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  select id into br from public.branches where status = 'Đang hoạt động' order by sort_order, id limit 1;
  if array_length(sh, 1) < 2 then raise exception 'Cần ít nhất 2 ca trong bảng shifts'; end if;
  insert into public.shift_reports(branch_id, work_date, shift) values (br, '2031-03-10', sh[1]) returning id into sa;   -- ca 1 (vd Sáng)
  insert into public.shift_reports(branch_id, work_date, shift) values (br, '2031-03-10', sh[2]) returning id into ch;   -- ca 2 (vd Chiều)

  -- 1. nợ ca 1 → thu ở ca 2 cùng ngày: được
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_at) values (br, sa, 'Khách T147', 50000, '2031-03-10 08:00:00') returning id into d1;
  update public.shift_debts set closed_at = '2031-03-10 15:00:00', closed_report_id = ch, collect_kind = 'tien_mat' where id = d1; n := n + 1;
  -- bỏ trả rồi thu ở ngoài ca cùng ngày: được
  update public.shift_debts set closed_at = null, closed_report_id = null, collect_kind = null where id = d1;
  update public.shift_debts set closed_at = '2031-03-10 20:00:00', collect_kind = 'tien_mat' where id = d1; n := n + 1;
  update public.shift_debts set closed_at = null, collect_kind = null where id = d1;
  -- 2. thu trong chính ca phát sinh: chặn
  begin update public.shift_debts set closed_at = '2031-03-10 09:00:00', closed_report_id = sa, collect_kind = 'tien_mat' where id = d1; raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 2: thu trong chính ca không bị chặn'; end if; end; n := n + 1;
  -- 3. nợ ca 2 → thu ở ca 1 (ca trước): chặn
  update public.shift_debts set report_id = ch where id = d1;
  begin update public.shift_debts set closed_at = '2031-03-10 09:00:00', closed_report_id = sa, collect_kind = 'tien_mat' where id = d1; raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 3: thu ở ca trước ca phát sinh không bị chặn'; end if; end; n := n + 1;
  -- 4. thu ngoài ca, ngày trước ngày phát sinh: chặn
  begin update public.shift_debts set closed_at = '2031-03-09 20:00:00', collect_kind = 'tien_mat' where id = d1; raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 4: thu ngoài ca trước ngày phát sinh không bị chặn'; end if; end; n := n + 1;
  -- 5. nợ quản lý ghi (không có ca) ngày 10 → thu ở ca ngày 10: được; ngày 11 ghi nợ → thu ở ca ngày 10: chặn
  update public.shift_debts set report_id = null, created_at = '2031-03-10 07:00:00' where id = d1;
  update public.shift_debts set closed_at = '2031-03-10 09:00:00', closed_report_id = sa, collect_kind = 'tien_mat' where id = d1; n := n + 1;
  update public.shift_debts set closed_at = null, closed_report_id = null, collect_kind = null, created_at = '2031-03-11 07:00:00' where id = d1;
  begin update public.shift_debts set closed_at = '2031-03-11 09:00:00', closed_report_id = sa, collect_kind = 'tien_mat' where id = d1; raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 5: nợ quản lý ghi sau ngày của ca mà vẫn thu ở ca đó'; end if; end; n := n + 1;
  -- 6. qua hàm ngoài ca (Sổ thu chi › Thu nợ / Công nợ): ngày thu trước ngày ghi nợ bị chặn, đúng ngày thì được
  begin perform public.app_cn_debt_collect(d1, '2031-03-10', 'tien_mat', 50000, null); raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 6: app_cn_debt_collect ghi thu trước ngày nợ'; end if;
    if e not like '%ngày thu phải từ ngày đó%' and e not like '%Ngày thu không hợp lệ%' and e not like '%CHỐT%' and e not like '%quyền%' and e not like '%không được%' then raise exception 'SAI 6b: lỗi lạ: %', e; end if; end; n := n + 1;
  -- 7. sửa khác trên nợ đã đóng (ghi chú) không bị chặn
  update public.shift_debts set closed_at = '2031-03-11 09:00:00', collect_kind = 'tien_mat' where id = d1;
  update public.shift_debts set close_note = 'ghi chú' where id = d1; n := n + 1;

  raise exception 'REPORT>> ĐẠT % kiểm tra (tệp 147)', n;
end $$;
