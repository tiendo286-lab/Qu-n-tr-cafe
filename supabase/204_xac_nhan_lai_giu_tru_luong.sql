-- 204 (anh Tiến duyệt 28/11/2026: "sửa luật, chạy thử rồi chạy thật"): XÁC NHẬN LẠI SỐ TIỀN KHÔNG HUỶ PHẦN TRỪ LƯƠNG ĐÃ CHIA.
--  Lỗi (LHP Tối 17/11, ca 341): chuyển khoản thiếu 35.000 đã chia trừ lương 3 người; quản lý bấm Mở lại phần tiền (xoá kết quả, giữ khoản trừ lương)
--  rồi Hoàn thành → app_ds2_finish → app_stc_ds_close → app_ca_result_set(…, '[]') → app__ca_drop_shortfalls huỷ cả 3 khoản trừ lương mặc định
--  → app_stc_ds_done thấy lệch không còn cách xử lý → "Còn mục chưa kiểm tra: Chuyển khoản lệch chưa chọn cách xử lý" → hoàn tác. Bấm bao nhiêu lần
--  cũng vậy, trong khi bước 2 hiện "Đã xử lý".
--  Sửa: trong app_stc_ds_close, mục THIẾU có khoản trừ lương và chênh lệch đang "xong" theo app__gap_rows (phần đã xử lý không vượt số lệch)
--  → ghi kết quả + dấu + nhật ký trực tiếp, KHÔNG gọi app_ca_result_set nên không huỷ khoản trừ lương, không gửi lại thông báo cho nhân viên.
--  Số lệch đã đổi (phần đã chia không còn khớp) → đường cũ như trước. Chỉ thêm một khối; phần còn lại giữ nguyên bản đang chạy (pg_get_functiondef 28/11).
--  Vùng khoá tiền đối soát (đã báo anh Tiến trong chat 28/11). Không đổi số tiền / quyền, không sửa dữ liệu. Chạy lại nhiều lần không sao.

CREATE OR REPLACE FUNCTION public.app_stc_ds_close(p_report bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.shift_reports; s jsonb; m jsonb; it text; v bigint; res text;
begin
  r := public.app__stc_ds_need(p_report, true);
  s := public.app__stc_ds_state(p_report);
  -- bước 173: số sửa (máy Fabi ghi sai) đang chờ Chủ duyệt / bị Chủ từ chối → chưa xác nhận được
  if exists (select 1 from public.stc_fix_requests q where q.report_id = p_report and q.status = 'cho') then
    raise exception 'Còn số sửa chờ Chủ duyệt — Chủ duyệt xong mới xác nhận.';
  end if;
  if exists (select 1 from (select distinct on (q.field) q.status from public.stc_fix_requests q where q.report_id = p_report order by q.field, q.id desc) z where z.status = 'tu_choi') then
    raise exception 'Chủ đã từ chối số sửa — sửa lại số hoặc bấm "Bỏ sửa, lấy số máy Fabi" rồi mới xác nhận.';
  end if;
  if not (s ->> 'has_fabi')::boolean or not (s ->> 'kt_ready')::boolean then raise exception 'Chờ kế toán (file Fabi / số ngân hàng) rồi mới xác nhận.'; end if;
  if not ((s ->> 'mo1')::boolean and (s ->> 'mo2')::boolean and (s ->> 'dt')::boolean and (s ->> 'no')::boolean) then
    raise exception 'Còn ô đỏ ở ① (tiền mở ca / doanh thu / nợ) — sửa xong mới xác nhận.';
  end if;
  if (s ->> 'need_tm')::boolean then raise exception 'Nhập tiền mặt thực nhận ở ② trước.'; end if;
  m := public.app__ca_money(p_report);
  foreach it in array array['tien_mat', 'chuyen_khoan'] loop
    v := (m ->> case it when 'tien_mat' then 'tm_left' else 'ck_left' end)::bigint;
    res := case when coalesce(v, 0) = 0 then 'khop' when v < 0 then 'thieu' else 'thua' end;
    if exists (select 1 from public.shift_report_results x where x.report_id = p_report and x.item = it
                 and ((x.result = res and coalesce(x.amount, 0) = abs(coalesce(v, 0))) or (x.result = 'khop' and abs(coalesce(v, 0)) <= 5000))) then continue; end if;
    -- tệp 204: mục THIẾU đã chia trừ lương và chênh lệch đã xử lý hết (số lệch không vượt quá phần đã xử lý) → ghi lại kết quả + dấu mà KHÔNG huỷ
    --   các khoản trừ lương. (app_ca_result_set luôn huỷ khoản trừ lương mặc định rồi chờ chia lại → ca đã Mở lại phần tiền bấm Hoàn thành thì
    --   bị xoá phần đã chia và báo "lệch chưa chọn cách xử lý", không bao giờ hoàn thành được.) Số lệch đã đổi thì vẫn đi đường cũ.
    if res = 'thieu' and exists (select 1 from public.app__gap_rows(r.branch_id, r.work_date, r.work_date) g
                                  where g.report_id = p_report and g.item = it and g.tl > 0 and g.state = 'xong' and g.tl + g.dcs + g.mt <= g.total) then
      if exists (select 1 from jsonb_array_elements(public.app__ca_eff(p_report) -> 'moves') mv where nullif(mv ->> 'exchange_key', '') is not null
                   and (coalesce((mv ->> 'amount')::bigint, 0) = 0 or trim(coalesce(mv ->> 'note', '')) = '')) then
        raise exception 'Điền đủ số tiền và nội dung phiếu đổi tiền trước khi duyệt.';
      end if;
      insert into public.shift_report_results(report_id, item, result, amount, computed, basis, reason, by_account, at)
      values (p_report, it, res, abs(v), v, case when it = 'chuyen_khoan' then m ->> 'ck_basis' end,
              'Xác nhận Fabi (Sổ thu chi) — lệch đã xử lý ở phiếu chênh lệch, giữ nguyên phần trừ lương đã chia', (public.app_account()).id, public.vn_now_text())
      on conflict (report_id, item) do update set result = excluded.result, amount = excluded.amount, computed = excluded.computed, basis = excluded.basis,
             reason = excluded.reason, by_account = excluded.by_account, at = excluded.at;
      insert into public.shift_report_checks(report_id, item, checked_by, checked_at) values (p_report, it, (public.app_account()).id, public.vn_now_text())
      on conflict (report_id, item) do update set checked_by = excluded.checked_by, checked_at = excluded.checked_at;
      insert into public.shift_recon_log(report_id, action, field, after, reason, by_account)
      values (p_report, 'ket_qua', it, jsonb_build_object('result', res, 'amount', abs(v), 'people', 'giữ nguyên'), 'Xác nhận lại — giữ nguyên phần trừ lương đã chia', (public.app_account()).id);
      continue;
    end if;
    perform public.app_ca_result_set(p_report, it, res, abs(coalesce(v, 0)), case when res = 'khop' then null else 'Xác nhận Fabi (Sổ thu chi) — lệch xử lý ở phiếu chênh lệch' end, '[]'::jsonb);
  end loop;
  -- bước 152 (137): Thời gian doanh thu + Doanh thu đã so với Fabi ở phần A → duyệt luôn (trang Đối soát ca không còn bước tiền)
  foreach it in array array['thoi_gian', 'doanh_thu'] loop
    if not exists (select 1 from public.shift_report_checks c where c.report_id = p_report and c.item = it) then
      perform public.app_ca_check(p_report, it, true);
    end if;
  end loop;
  -- bước 152: trang Đối soát ca không còn phần tiền → Thu chi / Công nợ coi như khớp khi xác nhận Fabi (lệch xử lý ở Sổ thu chi, Chốt ca khoá)
  foreach it in array array['thu_chi', 'cong_no'] loop
    if not exists (select 1 from public.shift_report_results x where x.report_id = p_report and x.item = it) then
      perform public.app_ca_result_set(p_report, it, 'khop', 0, null, '[]'::jsonb);
    end if;
  end loop;
  -- bước 171: Hoàn thành đối soát do app_stc_ds_done (bấm ở bước 6), không tự làm ở đây   -- xong cả phần việc thì tự Hoàn thành đối soát
  -- chặng 6.5: ca đã bấm Hoàn thành từ trước (lúc còn thiếu dấu Thu chi / Công nợ) → xác nhận xong thì tự Hoàn thành đối soát
  if exists (select 1 from public.stc_ca_done dn where dn.report_id = p_report) then
    perform public.app__ca_auto_finish(p_report, (public.app_account()).id);
  end if;
  perform public.app_log('stc_chot_tien_ca', 'report=' || p_report);
  return jsonb_build_object('tm', (m ->> 'tm_left')::bigint, 'ck', (m ->> 'ck_left')::bigint);
end $function$;

insert into public.app_migrations(file) values ('204_xac_nhan_lai_giu_tru_luong.sql') on conflict (file) do nothing;
