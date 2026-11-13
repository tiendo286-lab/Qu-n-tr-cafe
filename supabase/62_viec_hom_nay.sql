-- =====================================================================
-- BƯỚC 62: TRANG "VIỆC HÔM NAY" theo vai trò — Giai đoạn 3 rà soát (13/11/2026). Chạy sau 61. Chạy lại không sao.
--  * app_home_todo(): 1 lần gọi, trả các việc còn tồn của đúng người đăng nhập (theo quyền):
--    quản lý đối soát: ca chờ đối soát / đang sửa / chờ kế toán, nghỉ & làm thay chờ, phiếu ca quá ngày chưa gửi, dòng thu chi chờ chọn nhóm;
--    kế toán: ca thiếu file Fabi / thiếu số dư ngân hàng, món Fabi chưa có nhóm;
--    Chủ: phiếu rút chờ xác nhận, nghỉ & làm thay chờ Chủ duyệt, số ngày chưa tải gói sao lưu ZIP.
-- =====================================================================

create or replace function public.app_home_todo() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; items jsonb := '[]'; today text := to_char(public.vn_now(), 'YYYY-MM-DD');
        from45 text := to_char(public.vn_now()::date - 45, 'YYYY-MM-DD'); from2m text := to_char(date_trunc('month', public.vn_now()) - interval '2 months', 'YYYY-MM-DD');
        n int; kt jsonb; cv jsonb; last text;
begin
  a := public.app__need(null);
  if public.app_can('doi_soat') then
    -- ca đã gửi, kế toán đã đủ số (hoặc cơ sở không dùng Fabi), chưa hoàn thành đối soát
    select count(*) into n from public.shift_reports r
     where r.status = 'hoan_thanh' and r.recon_status <> 'hoan_thanh' and r.work_date >= from45
       and coalesce((public.app__ca_kt_state(r.id) ->> 'ready')::boolean, true);
    items := items || jsonb_build_array(
      jsonb_build_object('key', 'cho_doi_soat', 'group', 'Quản lý', 'label', 'Ca chờ đối soát', 'n', n, 'link', '/quan-ly/doi-soat', 'tone', 'warn'));
    select count(*) into n from public.shift_reports where status = 'hoan_thanh' and recon_status = 'mo_lai';
    items := items || jsonb_build_array(jsonb_build_object('key', 'dang_sua', 'group', 'Quản lý', 'label', 'Ca đang sửa đối soát (chưa duyệt lại)', 'n', n, 'link', '/quan-ly/doi-soat', 'tone', 'warn'));
    cv := public.app_cv_todo();
    items := items || jsonb_build_array(jsonb_build_object('key', 'nghi_thay', 'group', 'Quản lý', 'label', 'Nghỉ & làm thay chờ phân loại / duyệt', 'n', jsonb_array_length(cv), 'link', '/quan-ly/doi-soat', 'tone', 'warn'));
    select count(*) into n from public.shift_reports where status = 'dang_chot' and work_date < today and work_date >= from45;
    items := items || jsonb_build_array(jsonb_build_object('key', 'qua_ngay', 'group', 'Quản lý', 'label', 'Phiếu chốt ca quá ngày chưa gửi', 'n', n, 'link', '/ca', 'tone', 'off'));
    select count(*) into n from public.app__tc_moves(null, from2m, today) m left join public.fin_move_cats fc on fc.report_id = m.report_id and fc.mkey = m.mkey
     where coalesce(fc.checked, 0) = 0;
    items := items || jsonb_build_array(jsonb_build_object('key', 'thu_chi', 'group', 'Quản lý', 'label', 'Dòng thu chi chờ chọn nhóm', 'n', n, 'link', '/quan-ly/doi-soat', 'tone', 'mute'));
  end if;
  if public.app_can('ke_toan') then
    kt := public.app__ca_kt_list(from45, today);
    select count(*) into n from jsonb_array_elements(kt) x where not (x ->> 'fabi')::boolean and x ->> 'status' = 'hoan_thanh';
    items := items || jsonb_build_array(jsonb_build_object('key', 'thieu_fabi', 'group', 'Kế toán', 'label', 'Ca thiếu file chốt ca Fabi', 'n', n, 'link', '/ke-toan/fabi', 'tone', 'warn'));
    select count(*) into n from jsonb_array_elements(kt) x where not (x ->> 'bank')::boolean and x ->> 'status' = 'hoan_thanh';
    items := items || jsonb_build_array(jsonb_build_object('key', 'thieu_nh', 'group', 'Kế toán', 'label', 'Ca thiếu số dư ngân hàng', 'n', n, 'link', '/ke-toan/chuyen-khoan', 'tone', 'warn'));
    select count(distinct x ->> 'name') into n from public.fabi_shifts f, jsonb_array_elements(coalesce(f.items, '[]')) x
     where not exists (select 1 from public.fabi_menu m where m.name = x ->> 'name');
    items := items || jsonb_build_array(jsonb_build_object('key', 'mon', 'group', 'Kế toán', 'label', 'Món Fabi chưa có nhóm (chưa tính được số cốc)', 'n', n, 'link', '/cai-dat/nhom-mon', 'tone', 'mute'));
  end if;
  if coalesce(a.system_role, '') = 'chu' then
    select count(*) into n from public.fund_withdrawals where status = 'cho_nhan';
    items := items || jsonb_build_array(jsonb_build_object('key', 'phieu_rut', 'group', 'Chủ', 'label', 'Phiếu rút chờ anh xác nhận đã nhận tiền', 'n', n, 'link', '/quan-ly/so-quy', 'tone', 'warn'));
    if cv is null then cv := public.app_cv_todo(); end if;
    select count(*) into n from jsonb_array_elements(cv) x where x ->> 'state' = 'cho_duyet';
    items := items || jsonb_build_array(jsonb_build_object('key', 'chu_duyet', 'group', 'Chủ', 'label', 'Nghỉ & làm thay chờ Chủ duyệt', 'n', n, 'link', '/quan-ly/doi-soat', 'tone', 'warn'));
    last := (select max(created_at) from public.audit_log where action = 'xuat_du_lieu_zip');
    n := case when last is null then 999 else (public.vn_now()::date - left(last, 10)::date) end;
    items := items || jsonb_build_array(jsonb_build_object('key', 'sao_luu', 'group', 'Chủ', 'label', case when last is null then 'Chưa tải gói sao lưu ZIP về máy lần nào' else 'Ngày chưa tải gói sao lưu ZIP về máy' end,
      'n', case when n >= 7 then n else 0 end, 'link', '/quan-ly/du-lieu', 'tone', 'off'));
  end if;
  return jsonb_build_object('today', today, 'items', items);
end $$;

revoke execute on function public.app_home_todo() from public, anon;
grant execute on function public.app_home_todo() to authenticated;

insert into public.app_migrations(file) values ('62_viec_hom_nay.sql') on conflict (file) do nothing;
