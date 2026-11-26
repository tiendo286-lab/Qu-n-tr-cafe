-- 182 (việc #11, anh Tiến 26/11/2026): NHÂN VIÊN KHÔNG CÓ TÊN TRONG CA VẪN CHỐT ĐƯỢC CA
--   "Em cho nhân viên không ở trong ca chốt được ca vì có trường hợp quản lý chưa đổi kịp lịch".
--  * Trước: app_ca_part_claim chặn người không có tên trong danh sách nhân viên của phiếu (lấy từ lịch tuần lúc mở phiếu)
--    → "Chỉ nhân viên có tên trong ca … và quản lý được nhận phần việc của phiếu này."
--  * Nay: ai có quyền Chốt ca đều bấm "Tôi chốt ca này" được khi CHƯA AI NHẬN phần đó.
--    "Nhận lại" (giành phần người khác đang làm) giữ luật cũ: chỉ người có tên trong ca + quản lý.
--  * Ảnh phiếu Fabi (kho ảnh): trước đòi cả "có tên trong ca" → người ngoài lịch đã nhận phần Tiền không tải ảnh được.
--    Nay chỉ cần đúng người đang nhận phần, phiếu đang chốt, phần chưa bấm Xong (giống app__ca_part_guard).
--  * Không đổi: danh sách nhân viên / công / tiền của phiếu, vùng khoá đối soát, app__ca_part_can (vẫn dùng cho nút "Nhận lại"
--    và ảnh nhận hàng phiếu cũ). Người ngoài lịch tự thêm tên mình ở bước Nhân viên (mục Thêm người làm hộ) như cũ.
--  * Sổ nhật ký: lượt nhận của người không có tên trong ca ghi thêm "(ngoài lịch)" để quản lý tra.
-- Viết để chạy lại nhiều lần không sao.

create or replace function public.app_ca_part_claim(p_id bigint, p_part text, p_force boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare a public.accounts; r public.shift_reports; pt public.shift_report_parts; in_ca boolean;
begin
  a := public.app__need('chot_ca');
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu chốt ca.'; end if;
  if r.status <> 'dang_chot' then raise exception 'Phiếu đã hoàn thành.'; end if;
  if p_part is null or p_part not in ('tien', 'nhan_su', 'nhan_hang') then raise exception 'Phần việc không hợp lệ.'; end if;
  in_ca := coalesce(public.app__ca_part_can(p_id), false);
  select * into pt from public.shift_report_parts where report_id = p_id and part = p_part;
  if pt.claimed_by = a.id then return public.app_ca_parts(p_id); end if;
  if pt.claimed_by is not null and not coalesce(p_force, false) then
    raise exception 'Phần % đã có % nhận. Muốn làm thay, bấm "Nhận lại phần này".', public.app__ca_part_label(p_part), public.app__acc_name(pt.claimed_by);
  end if;
  -- 182: nhận phần CHƯA AI NHẬN thì ai có quyền Chốt ca cũng được; giành phần người khác thì phải có tên trong ca hoặc là quản lý
  if pt.claimed_by is not null and not in_ca then
    raise exception 'Phần % đang do % làm. Chỉ nhân viên có tên trong ca % và quản lý được nhận lại — nhờ % bấm bỏ nhận, hoặc báo quản lý.',
      public.app__ca_part_label(p_part), public.app__acc_name(pt.claimed_by), r.shift, public.app__acc_name(pt.claimed_by);
  end if;
  insert into public.shift_report_parts(report_id, part, claimed_by, claimed_at) values (p_id, p_part, a.id, public.vn_now_text())
  on conflict (report_id, part) do update set prev_by = public.shift_report_parts.claimed_by, claimed_by = excluded.claimed_by,
         claimed_at = excluded.claimed_at, done_by = null, done_at = null, done_ql = false;
  if pt.claimed_by is not null then
    perform public.app__notify(pt.claimed_by, 'Phần việc phiếu chốt ca đã được nhận lại',
      public.app__ca_title(r) || ': ' || public.app__acc_name(a.id) || ' đã nhận lại phần ' || public.app__ca_part_label(p_part) || '. Bạn không sửa phần này nữa.',
      '/ca/phieu?id=' || p_id);
    perform public.app_log('nhan_lai_phan_ca', 'report=' || p_id || ' ' || p_part || ' từ ' || coalesce(public.app__acc_name(pt.claimed_by), ''));
  else
    perform public.app_log('nhan_phan_ca', 'report=' || p_id || ' ' || p_part || case when in_ca then '' else ' (ngoài lịch)' end);
  end if;
  return public.app_ca_parts(p_id);
end $function$;

create or replace function public.app__storage_ca_upload(p_name text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  m text[] := regexp_match(coalesce(p_name, ''), '^r([0-9]+)/(ipos|hang)/[^/]+$');
  old_m text[];
  rid bigint;
  wanted_part text;
  aid bigint := (public.app_account()).id;
begin
  if aid is null then return false; end if;
  if m is not null then
    rid := m[1]::bigint;
    -- bước 119: quản lý (quyền đối soát) thêm ảnh phiếu Fabi cho phiếu đã gửi, tháng chưa chốt
    if m[2] = 'ipos' and coalesce(public.app_can('doi_soat'), false)
       and exists (select 1 from public.shift_reports r where r.id = rid and r.status = 'hoan_thanh' and not public.app__fin_locked(r.branch_id, r.work_date)) then
      return true;
    end if;
    wanted_part := case when m[2] = 'ipos' then 'tien' else 'nhan_hang' end;
    -- 182: bỏ điều kiện "có tên trong ca" — người đang nhận phần (kể cả người ngoài lịch) tải được ảnh
    return exists (
      select 1 from public.shift_reports r
      join public.shift_report_parts pt on pt.report_id = r.id and pt.part = wanted_part
      where r.id = rid and r.status = 'dang_chot'
        and pt.claimed_by = aid and pt.done_at is null
    );
  end if;
  old_m := regexp_match(coalesce(p_name, ''), '^r([0-9]+)/[^/]+$');
  if old_m is null then return false; end if;
  rid := old_m[1]::bigint;
  return exists (
    select 1 from public.shift_reports r
    join public.shift_report_parts pt on pt.report_id = r.id
    where r.id = rid and r.status = 'dang_chot'
      and pt.claimed_by = aid and pt.done_at is null
  );
end $function$;

insert into public.app_migrations(file) values ('182_chot_ca_ngoai_lich.sql') on conflict (file) do nothing;
