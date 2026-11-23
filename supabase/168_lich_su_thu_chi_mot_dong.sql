-- Sửa lỗi "cannot extract elements from an object" khi mở phiếu ca (anh Tiến báo 23/11/2026: chốt ca sáng 9/11 LHP).
-- Nguyên nhân: Sổ thu chi (từ 19/11) ghi lịch sử sửa khoản thu chi của ca vào shift_recon_log (field = 'moves') theo TỪNG DÒNG
-- (before / after là một mục), còn phiếu ca ghi CẢ DANH SÁCH. Hàm app__ca_move_lines (dùng để hiện "ai sửa / thêm dòng này"
-- trên phiếu ca) chỉ nhận danh sách → gặp một mục là báo lỗi, cả trang ca không mở được (6 ca: 51, 60, 81, 142, 146, 203).
-- Sửa: một mục thì coi như danh sách một dòng. Chỉ đổi phần hiện lịch sử sửa; không đổi tiền, không đổi quyền, không sửa dữ liệu.

CREATE OR REPLACE FUNCTION public.app__ca_move_lines(p jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  with a as (select case jsonb_typeof(p) when 'array' then p when 'object' then jsonb_build_array(p) else '[]'::jsonb end p)
  select coalesce(jsonb_agg(x.line order by x.ord), '[]'::jsonb) from (
    select ord, jsonb_build_object('kind', kind, 'amount', amount, 'note', note) line
      from (select m ->> 'kind' kind, (m ->> 'amount')::bigint amount, coalesce(m ->> 'note', '') note, nullif(m ->> 'exchange_key', '') ek, t.ord
              from a cross join lateral jsonb_array_elements(a.p) with ordinality t(m, ord) where m ->> 'auto' is null) z
     where ek is null
    union all
    select min(ord), jsonb_build_object('kind', 'doi_tien', 'amount', max(abs(amount)), 'note', min(note))
      from (select (m ->> 'amount')::bigint amount, coalesce(m ->> 'note', '') note, nullif(m ->> 'exchange_key', '') ek, t.ord
              from a cross join lateral jsonb_array_elements(a.p) with ordinality t(m, ord) where m ->> 'auto' is null) z
     where ek is not null group by ek
  ) x
$function$;

revoke all on function public.app__ca_move_lines(jsonb) from public, anon, authenticated;

insert into public.app_migrations(file) values ('168_lich_su_thu_chi_mot_dong.sql') on conflict (file) do nothing;
