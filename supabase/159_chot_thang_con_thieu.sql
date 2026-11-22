-- Chặng 3 (anh Tiến chốt 22/11/2026): chuẩn bị chốt tháng — khung "Còn thiếu để chốt tháng" trên trang Chốt tháng.
--   1) app_fin_missing(p_branch, p_month): đếm các việc còn chặn Chốt tháng của 1 cơ sở, CÙNG điều kiện với app_fin_close,
--      kèm danh sách ca để trang dẫn tới đúng chỗ làm:
--        • phiếu chốt ca đang chốt dở (in_progress);
--        • ca đã gửi mà chưa hoàn thành đối soát, chia theo chỗ kẹt (cùng thứ tự điều kiện với app__ca_auto_finish):
--          kt = chờ kế toán (file Fabi / số dư ngân hàng) · fabi = chưa xác nhận Fabi · hoan_thanh = đã xác nhận, chưa bấm
--          "Hoàn thành đối soát ca" · viec = phần tiền xong, còn phần việc (Nhân sự, Bàn giao, Nghỉ & làm thay…) · cho = đủ cả, chờ ghi nhận;
--        • khoản thu chi ở phiếu ca chưa đối soát (unchecked) · chênh lệch tiền đang chờ (gap_pending) · Quỹ ngoài chưa chia hết (ext_bad).
--      Số chi chưa phân nhóm / tiền rút về lệch: trang đã có sẵn từ app_fin_month / app_fin_overview (app__fin_full) nên không tính lại.
--   2) app_fin_close: CHỈ đổi chữ báo lỗi đang chỉ tới trang đã gỡ (Quản lý ca › Thu chi, Quản lý ca › Âm tiền, Sổ quỹ) sang trang mới.
--      KHÔNG đổi điều kiện chặn. Vá bằng thay chuỗi trên bản đang chạy (như tệp 156), giữ nguyên mọi phần khác; thiếu chuỗi cũ thì dừng.
-- Bài thử: kiem_tra/chot_thang_159_cuc_bo.sql (Postgres cục bộ). Chạy lại nhiều lần không sao.

create or replace function public.app__fin_missing(p_branch bigint, p_month text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d0 text := p_month || '-01'; d1 text; sh text[] := public.app__shifts(); ci text[] := public.app__ca_check_items(); mi text[] := public.app__ca_money_items();
        n_mv int; n_gap int; n_ext int; prog jsonb; rc jsonb;
begin
  d1 := to_char(d0::date + interval '1 month' - interval '1 day', 'YYYY-MM-DD');
  -- khoản thu chi ở phiếu chốt ca chưa đối soát — y hệt app_fin_close
  select count(*) into n_mv from public.app__tc_moves(p_branch, p_month || '-01', p_month || '-31') m
    left join public.fin_move_cats fc on fc.report_id = m.report_id and fc.mkey = m.mkey
   where coalesce(fc.checked, 0) = 0;
  -- chênh lệch tiền (âm tiền) đang chờ — y hệt app_fin_close
  n_gap := public.app__gap_pending(p_branch, d0, d1);
  -- Quỹ ngoài chưa chia hết (chung mọi cơ sở) — y hệt app_fin_close
  select count(*) into n_ext from public.ext_entries e where left(e.entry_date, 7) = p_month and not public.app__ext_ok(e.id);
  -- phiếu chốt ca đang chốt dở (app__fin_calc đếm status = 'dang_chot' trong tháng)
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'date', r.work_date, 'shift', r.shift) order by r.work_date, array_position(sh, r.shift), r.id), '[]')
    into prog from public.shift_reports r where r.branch_id = p_branch and r.work_date between d0 and d1 and r.status = 'dang_chot';
  -- ca đã gửi mà chưa hoàn thành đối soát (app__fin_calc: done − recon), chia theo chỗ kẹt
  with x as (
    select r.id, r.work_date, r.shift, public.app__ca_kt_state(r.id) kt,
           (select count(*) from public.shift_report_results s where s.report_id = r.id and s.item = any(mi)) n_res,
           exists (select 1 from public.stc_ca_done dn where dn.report_id = r.id) tien_xong,
           array(select u.it from unnest(ci) with ordinality u(it, o)
                  where not exists (select 1 from public.shift_report_checks c where c.report_id = r.id and c.item = u.it) order by u.o) thieu,
           case when coalesce(r.self_reconciled, false) then 'khong_can' else public.app__cv_state(r.id) end cv
      from public.shift_reports r
     where r.branch_id = p_branch and r.work_date between d0 and d1 and r.status = 'hoan_thanh' and r.recon_status is distinct from 'hoan_thanh'),
  g as (
    select x.*, case when not coalesce((x.kt ->> 'ready')::boolean, true) then 'kt'
                     when x.n_res < cardinality(mi) then 'fabi'
                     when not x.tien_xong then 'hoan_thanh'
                     when cardinality(x.thieu) > 0 or coalesce(x.cv, '') not in ('khong_can', 'da_duyet') then 'viec'
                     else 'cho' end grp
      from x)
  select coalesce(jsonb_object_agg(z.grp, z.items), '{}') into rc from (
    select g.grp, jsonb_agg(jsonb_build_object('id', g.id, 'date', g.work_date, 'shift', g.shift,
             'miss', case g.grp
                       when 'kt' then coalesce(g.kt -> 'missing', '[]')
                       when 'viec' then to_jsonb(array(select public.app__ca_item_label(t) from unnest(g.thieu) t)
                                          || case when coalesce(g.cv, '') in ('khong_can', 'da_duyet') then '{}'::text[]
                                                  when g.cv = 'cho_duyet' then array['Nghỉ & làm thay (chờ duyệt)']
                                                  else array['Nghỉ & làm thay'] end)
                       else '[]'::jsonb end)
             order by g.work_date, array_position(sh, g.shift), g.id) items
      from g group by g.grp) z;
  return jsonb_build_object('branch_id', p_branch, 'month', p_month, 'unchecked', n_mv, 'gap_pending', n_gap, 'ext_bad', n_ext,
    'in_progress', prog, 'recon', rc);
end $$;

create or replace function public.app_fin_missing(p_branch bigint, p_month text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__fin_need(p_branch);
  perform public.app__fin_month_ok(p_month);
  return public.app__fin_missing(p_branch, p_month);
end $$;

revoke all on function public.app__fin_missing(bigint, text) from public, anon, authenticated;
revoke all on function public.app_fin_missing(bigint, text) from public, anon;
grant execute on function public.app_fin_missing(bigint, text) to authenticated;

-- app_fin_close: chỉ đổi chữ báo lỗi (bản đang chạy của tệp 31 / 71). Thiếu chuỗi cũ nào thì dừng để không vá nhầm.
do $$
declare d text; n text; i int;
  olds text[] := array[
    'Đối soát xong rồi mới chốt tháng.',
    'Còn % khoản thu chi ở phiếu chốt ca CHỜ ĐỐI SOÁT. Vào Quản lý ca › Thu chi đối soát hết rồi mới chốt tháng.',
    'Chọn nhóm hoặc "Không tính" trước khi chốt.',
    'Còn % ca âm tiền đang chờ (Chờ tiền về / Chờ gán / ghép chờ duyệt). Vào Quản lý ca › Âm tiền xử lý hết rồi mới chốt tháng.',
    'Chủ vào Sổ quỹ › Quỹ ngoài để chia.'];
  news text[] := array[
    'Xem khung "Còn thiếu để chốt tháng" ở đầu trang Chốt tháng: ca nào kẹt ở đâu, bấm vào là tới chỗ làm.',
    'Còn % khoản thu chi ở phiếu chốt ca chưa đối soát (chưa chọn nhóm). Chọn nhóm hoặc "Không tính" ở mục 4 của trang Chốt tháng hoặc ở Sổ thu chi › Sổ chi rồi mới chốt tháng.',
    'Chọn nhóm hoặc "Không tính" ở mục 4 của trang Chốt tháng hoặc ở Sổ thu chi › Sổ chi trước khi chốt.',
    'Còn % ca có chênh lệch tiền đang chờ xử lý (chờ tiền về / chờ gán người chịu / ghép chờ duyệt). Xử lý ở Sổ thu chi › Đối soát Fabi (bước Chênh lệch) rồi mới chốt tháng.',
    'Chủ vào Sổ thu chi › Quỹ ngoài để chia.'];
begin
  d := pg_get_functiondef('public.app_fin_close(bigint,text,text)'::regprocedure);
  if position('Sổ thu chi › Quỹ ngoài' in d) > 0 then return; end if;   -- đã vá
  n := d;
  for i in 1 .. array_length(olds, 1) loop
    if position(olds[i] in n) = 0 then raise exception 'Tệp 159: bản app_fin_close đang chạy không có chuỗi "%" — dừng, không vá.', olds[i]; end if;
    n := replace(n, olds[i], news[i]);
  end loop;
  execute n;
end $$;

insert into public.app_migrations(file) values ('159_chot_thang_con_thieu.sql') on conflict (file) do nothing;
