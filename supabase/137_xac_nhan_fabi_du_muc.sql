-- Bước 152 (19/11/2026): "Xác nhận Fabi" duyệt luôn Thời gian doanh thu + Doanh thu (trang Đối soát ca bỏ bước tiền — trước đây duyệt 2 mục này ở đó),
-- để ca xong phần việc thì tự "Hoàn thành đối soát". Bài thử: kiem_tra/so_thu_chi_137.sql (tự hoàn tác). Chạy lại nhiều lần không sao.
create or replace function public.app_stc_ds_close(p_report bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; s jsonb; m jsonb; it text; v bigint; res text;
begin
  r := public.app__stc_ds_need(p_report, true);
  s := public.app__stc_ds_state(p_report);
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
  perform public.app__ca_auto_finish(p_report, (public.app_account()).id);   -- xong cả phần việc thì tự Hoàn thành đối soát
  perform public.app_log('stc_chot_tien_ca', 'report=' || p_report);
  return jsonb_build_object('tm', (m ->> 'tm_left')::bigint, 'ck', (m ->> 'ck_left')::bigint);
end $$;

insert into public.app_migrations(file) values ('137_xac_nhan_fabi_du_muc.sql') on conflict (file) do nothing;
