-- =====================================================================
-- BƯỚC 18: TAB LOG (đặc tả 07/11, mục 9). Chạy sau 17. Chạy lại nhiều lần không sao.
--  * Chỉ Chủ hệ thống vào được (quyền phan_quyen — chỉ Chủ có).
--  * Tài nguyên: dung lượng CSDL và kho tệp đọc trực tiếp từ máy chủ; giới hạn theo gói Supabase FREE (chủ hệ thống xác nhận
--    07/11/2026: 500 MB CSDL, 1 GB tệp). RAM và lưu lượng: nền tảng không cho đọc → "Không có số liệu".
--  * Phiên bản = ngày phát hành (YYYY.MM.DD). Mỗi lần cập nhật web, người cập nhật ghi một dòng vào app_releases.
--  * Lịch sử thao tác: gộp nhật ký chung (audit_log), lịch sử sửa phiếu ca / kế toán (shift_recon_log, có trước/sau)
--    và lịch sử công việc (task_events). Chỉ xem, không có chức năng sửa / xóa.
-- =====================================================================

create table if not exists public.app_releases (
  version text primary key,                 -- YYYY.MM.DD (thêm .2, .3 nếu nhiều lần trong ngày)
  released_at text not null,
  added text[] not null default '{}',
  changed text[] not null default '{}',
  fixed text[] not null default '{}',
  removed text[] not null default '{}',
  released_by text not null default 'Claude (theo yêu cầu anh Tiến)'
);
alter table public.app_releases enable row level security;
revoke all on public.app_releases from anon, authenticated;

insert into public.app_releases(version, released_at, added, changed, fixed, removed) values
('2026.11.06', '2026-11-06 23:59',
  array['Chuyển toàn bộ chức năng bản offline 1.7.6 lên web (GitHub Pages + Supabase)',
        'Quản lý ca: phiếu chốt ca Sáng/Chiều/Tối, đối soát 9 hạng mục, đối soát tiền mặt cuối ngày',
        'Nội quy & Quy trình (soạn, đăng, nhân viên xác nhận đã đọc); cột Nội quy / Cam kết ở tab Nhân viên',
        'Đào tạo chạy bàn 8 ngày · 68 hạng mục; cột Đào tạo ở tab Nhân viên; Phiếu đào tạo của tôi',
        'Yêu cầu hỗ trợ (nhân viên ↔ quản lý)',
        'Công việc: Chủ giao việc cho mọi nhân viên, 3 trạng thái Chờ nhận / Đang xử lý / Đã xử lý'],
  array['Rút gọn menu quản lý 26 → 11 mục (tab con)', 'Nhập dữ liệu an toàn (không xóa lây dữ liệu mới)',
        'Đồng bộ toàn bộ lịch đã xếp từ bản offline lên web', 'Xóa order tuần phải gõ XOA để xác nhận'],
  array['Tuần nhập từ bản offline hiện "Chưa bắt đầu xếp lịch" — nay tính là Đang xếp; chặn nút Bắt đầu xếp lịch làm mất ca đã xếp',
        'Lịch cơ sở báo rõ khi tài khoản chỉ có quyền xem', 'Hộp Tạo phiếu đào tạo bị tràn trên máy tính',
        'Tràn ngang trên điện thoại'],
  array['Đánh giá nhân viên, Voucher', 'Tab Đào tạo riêng (gộp vào Nhân viên)',
        'Nút Nhập câu trả lời Form, Tải file mẫu order, Khôi phục bản trước (trang Order)']),
('2026.11.07', to_char(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI'),
  array['Tab Công việc bắt đầu bằng "Cần xử lý" (bàn giao ca chưa xong + việc chưa giao)',
        'Sao lưu đầy đủ: gói ZIP có cả phiếu chốt ca, công việc, nội quy, cam kết, đào tạo, hỗ trợ',
        'Phiếu chốt ca: giờ đến/về người theo lịch điền sẵn theo khung ca (gợi ý)',
        'Bản đối soát riêng: phiếu nhân viên giữ nguyên, quản lý sửa trên bản đối soát, lịch sử trước/sau, mở lại / hoàn thành lại',
        'Vai trò Kế toán; tab Kế toán: Hóa đơn giao hàng kho tổng (nhân viên báo nhận ĐỦ/THIẾU trong phiếu ca) và Chuyển khoản thực nhận theo số dư BIDV',
        'Tab LOG: tài nguyên, phiên bản, lịch sử cập nhật, lịch sử thao tác'],
  array['Gộp Nhân viên với Tài khoản & phân quyền thành "Nhân viên & tài khoản"; tài khoản đăng nhập nằm ngay trong danh sách nhân viên',
        'Tổng quan ca và tiền cuối ngày dùng số của bản đối soát'],
  array['Trang Dữ liệu & sao lưu đếm sai số phiếu chốt ca / công việc', 'Menu Tài khoản ở cuối bảng bị che'],
  array['Họp (thay bằng tab Công việc)', 'Nhập Excel nhân viên, Tải file mẫu, Xuất danh sách Google Form',
        'Nhập dữ liệu từ bản offline (trang Dữ liệu & sao lưu)'])
on conflict (version) do update set released_at = excluded.released_at, added = excluded.added, changed = excluded.changed,
  fixed = excluded.fixed, removed = excluded.removed;

-- ---------------------------------------------------------------- Tài nguyên + phiên bản hiện tại
create or replace function public.app_sys_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare st jsonb; v jsonb;
begin
  if not public.app_can('phan_quyen') then raise exception 'Chỉ Chủ hệ thống vào được.'; end if;
  select coalesce(jsonb_object_agg(bucket_id, jsonb_build_object('bytes', b, 'files', n)), '{}') into st
    from (select bucket_id, sum(coalesce((metadata ->> 'size')::bigint, 0)) b, count(*) n from storage.objects group by bucket_id) x;
  select to_jsonb(r) into v from public.app_releases r order by r.version desc limit 1;
  return jsonb_build_object(
    'plan', 'Free',
    'db_bytes', pg_database_size(current_database()), 'db_limit', 500 * 1024 * 1024,
    'storage', st, 'storage_bytes', (select coalesce(sum((x ->> 'bytes')::bigint), 0) from jsonb_each(st) e(k, x)), 'storage_limit', 1024 * 1024 * 1024,
    'ram', null, 'egress', null,
    'current', v,
    'now', public.vn_now_text());
end $$;

create or replace function public.app_sys_releases() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.app_can('phan_quyen') then raise exception 'Chỉ Chủ hệ thống vào được.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.version desc) from public.app_releases r), '[]');
end $$;

-- ---------------------------------------------------------------- Lịch sử thao tác (chỉ xem)
create or replace function public.app_sys_log(p_from text, p_to text, p_account bigint, p_branch bigint, p_action text, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare lim int := least(greatest(coalesce(p_limit, 300), 1), 2000); out jsonb;
begin
  if not public.app_can('phan_quyen') then raise exception 'Chỉ Chủ hệ thống vào được.'; end if;
  with l as (
    select x.created_at as at, x.account_id, x.action,
           substring(x.detail from '(report=\d+|invoice=\d+|task=\d+|week=\d+|meeting=\d+|account=\d+)') as object,
           case when x.detail ~ 'report=\d+' then '/ca/phieu?id=' || substring(x.detail from 'report=(\d+)') end as link,
           (select r.branch_id from public.shift_reports r where x.detail ~ 'report=\d+' and r.id = substring(x.detail from 'report=(\d+)')::bigint) as branch_id,
           null::text as field, null::jsonb as before, null::jsonb as after, x.detail as note
      from public.audit_log x
    union all
    select g.at, g.by_account,
           case g.action when 'sua' then 'sua_ban_doi_soat' when 'ke_toan' then 'ke_toan_sua_so_du' when 'lam_lai' then 'mo_lai_phieu_cho_nv' else g.action end,
           'report=' || g.report_id, '/ca/phieu?id=' || g.report_id, r.branch_id, g.field, g.before, g.after, g.reason
      from public.shift_recon_log g left join public.shift_reports r on r.id = g.report_id
     where g.action not in ('hoan_thanh_doi_soat', 'mo_lai_doi_soat')        -- 2 loại này đã có trong nhật ký chung
    union all
    select e.at, e.by_account, 'cong_viec_' || e.action, 'task=' || e.task_id, '/quan-ly/giao-viec', null, null, null, null,
           left(coalesce(t.content, '') || coalesce(' · ' || e.note, ''), 300)
      from public.task_events e left join public.tasks t on t.id = e.task_id
  ), f as (
    select * from l
     where (p_from is null or l.at >= p_from) and (p_to is null or l.at < p_to || ' 99')
       and (p_account is null or l.account_id = p_account) and (p_branch is null or l.branch_id = p_branch)
       and (p_action is null or l.action = p_action)
     order by l.at desc limit lim
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('at', f.at, 'by', public.app__acc_name(f.account_id), 'action', f.action, 'object', f.object, 'link', f.link,
                        'branch', (select coalesce(b.display_code, b.code) from public.branches b where b.id = f.branch_id),
                        'field', f.field, 'before', f.before, 'after', f.after, 'note', f.note) order by f.at desc) from f), '[]'),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', public.app__acc_name(a.id)) order by public.app__acc_name(a.id))
                          from public.accounts a where a.id in (select distinct account_id from l where account_id is not null)), '[]'),
    'actions', coalesce((select jsonb_agg(distinct action) from l), '[]'),
    'limit', lim) into out;
  return out;
end $$;

revoke execute on function public.app_sys_overview(), public.app_sys_releases(), public.app_sys_log(text, text, bigint, bigint, text, int) from public, anon;
grant execute on function public.app_sys_overview(), public.app_sys_releases(), public.app_sys_log(text, text, bigint, bigint, text, int) to authenticated;
