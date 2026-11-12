-- Bước 46 — Nghỉ & làm thay (x2) gọn thao tác (anh Tiến chốt 12/11/2026)
-- 1) Chủ / Quản lý tổng tự làm phiếu chốt ca thì phân loại (và Chủ duyệt) nghỉ / làm thay NGAY trong phiếu, không phải chờ gửi rồi sang Đối soát.
-- 2) Tab Đối soát có danh sách "Nghỉ / làm thay": chờ Quản lý tổng phân loại · chờ Chủ duyệt.
-- Chạy lại nhiều lần không sao.

create or replace function public.app_cv_save(p_id bigint, p_items jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; x bigint;
begin
  a := public.app__need('doi_soat');
  if not public.app__cv_classify_can() then raise exception 'Chỉ Quản lý tổng / Chủ phân loại nghỉ và làm thay.'; end if;
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status not in ('hoan_thanh', 'dang_chot') then raise exception 'Không tìm thấy phiếu.'; end if;   -- bước 46: làm được cả khi đang chốt
  if r.recon_status = 'hoan_thanh' then raise exception 'Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.'; end if;
  perform public.app__cv_write(p_id, p_items);
  insert into public.shift_cover_reviews(report_id, set_by, set_at) values (p_id, a.id, public.vn_now_text())
  on conflict (report_id) do update set set_by = excluded.set_by, set_at = excluded.set_at, ok_by = null, ok_at = null, ok_note = null;
  perform public.app_log('phan_loai_nghi_lam_thay', 'report=' || p_id);
  if a.system_role <> 'chu' then
    for x in select id from public.accounts where system_role = 'chu' and coalesce(locked, 0) = 0 loop
      perform public.app__notify(x, 'Chờ duyệt nghỉ / làm thay', public.app__ca_title(r) || E'\nQuản lý tổng đã phân loại, Chủ duyệt thì phiếu mới hoàn thành đối soát.',
        '/quan-ly/doi-soat/ca?id=' || p_id);
    end loop;
  end if;
  return public.app__cv_state(p_id);
end $$;

create or replace function public.app_cv_approve(p_id bigint, p_items jsonb, p_note text) returns text
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; c public.shift_covers; st text; t text;
begin
  a := public.app__need('doi_soat');
  if a.system_role <> 'chu' then raise exception 'Chỉ Chủ duyệt nghỉ / làm thay.'; end if;
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status not in ('hoan_thanh', 'dang_chot') then raise exception 'Không tìm thấy phiếu.'; end if;   -- bước 46: làm được cả khi đang chốt
  if r.recon_status = 'hoan_thanh' then raise exception 'Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.'; end if;
  if p_items is not null then perform public.app__cv_write(p_id, p_items); end if;
  st := public.app__cv_state(p_id);
  if st in ('chua_phan_loai', 'lech') then raise exception 'Chưa phân loại đủ người nghỉ / người hỗ trợ của ca.'; end if;
  if st = 'khong_can' then return st; end if;
  insert into public.shift_cover_reviews(report_id, set_by, set_at, ok_by, ok_at, ok_note) values (p_id, a.id, public.vn_now_text(), a.id, public.vn_now_text(), nullif(trim(coalesce(p_note, '')), ''))
  on conflict (report_id) do update set ok_by = excluded.ok_by, ok_at = excluded.ok_at, ok_note = excluded.ok_note,
     set_by = coalesce(public.shift_cover_reviews.set_by, excluded.set_by), set_at = coalesce(public.shift_cover_reviews.set_at, excluded.set_at);
  t := public.app__ca_title(r);
  for c in select * from public.shift_covers where report_id = p_id loop
    if c.absent_id is not null then
      perform public.app__notify_emp(c.absent_id, case when c.deduct_hours > 0 then 'Nghỉ ca: bị trừ ' || c.deduct_hours || ' giờ' else 'Nghỉ ca: không bị trừ' end,
        t || E'\nLý do: ' || public.app__cv_label(c.reason)
        || coalesce(E'\nNgười làm thay: ' || (select e.code || ' – ' || e.name from public.employees e where e.id = c.helper_id), E'\nNgười làm thay: ' || c.helper_name, '')
        || case when c.deduct_hours > 0 then E'\nSố giờ người làm thay đã làm được trừ vào lương của bạn.' else '' end
        || E'\nKhông đồng ý thì gửi khiếu nại ở Của tôi › Công của tôi.', '/cua-toi/cong');
    end if;
    if c.helper_id is not null then
      perform public.app__notify_emp(c.helper_id, case when c.x2 then 'Làm thay ca: được x2 lương' else 'Làm thay ca: lương thường' end,
        t || E'\n' || case when c.absent_id is not null then 'Làm thay: ' || (select e.code || ' – ' || e.name from public.employees e where e.id = c.absent_id) else 'Làm thêm (quản lý không xếp đủ lịch)' end
        || E'\nSố giờ: ' || c.hours || case when c.x2 then ' (được cộng thêm ' || c.hours || ' giờ)' else '' end
        || E'\nKhông đồng ý thì gửi khiếu nại ở Của tôi › Công của tôi.', '/cua-toi/cong');
    end if;
  end loop;
  perform public.app_log('duyet_nghi_lam_thay', 'report=' || p_id);
  perform public.app__ca_auto_finish(p_id, a.id);
  return public.app__cv_state(p_id);
end $$;

-- Danh sách phiếu có nghỉ / làm thay chưa xong (tab Đối soát)
create or replace function public.app_cv_todo() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('doi_soat');
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'branch_id', r.branch_id, 'branch', coalesce(b.display_code, b.code), 'date', r.work_date, 'shift', r.shift,
            'state', x.st,
            'absent', (select string_agg(e.code || ' – ' || e.name, ', ' order by e.code) from public.app__cv_people(r.id) p join public.employees e on e.id = p.employee_id where p.kind = 'nghi'),
            'helper', (select string_agg(e.code || ' – ' || e.name, ', ' order by e.code) from public.app__cv_people(r.id) p join public.employees e on e.id = p.employee_id where p.kind = 'ho_tro'),
            'x2', (select string_agg(coalesce(e.code, c.helper_name), ', ') from public.shift_covers c left join public.employees e on e.id = c.helper_id where c.report_id = r.id and c.x2),
            'set_by', (select public.app__acc_name(v.set_by) from public.shift_cover_reviews v where v.report_id = r.id))
           order by r.work_date, array_position(public.app__shifts(), r.shift), b.sort_order)
      from public.shift_reports r join public.branches b on b.id = r.branch_id
      cross join lateral (select public.app__cv_state(r.id) st) x
     where r.status = 'hoan_thanh' and r.recon_status <> 'hoan_thanh' and r.work_date >= to_char(public.vn_now()::date - 60, 'YYYY-MM-DD')
       and x.st in ('chua_phan_loai', 'lech', 'cho_duyet')), '[]');
end $$;
revoke execute on function public.app_cv_todo() from public, anon;
grant execute on function public.app_cv_todo() to authenticated;
