-- Bước 152 (19/11/2026): Sổ thu chi thành chỗ làm tiền duy nhất — mở cho quản lý cơ sở, giải trình trong phiếu trừ lương,
-- "Xác nhận Fabi" ghi đủ 4 kết quả tiền (trang Đối soát ca bỏ phần tiền). Thiết kế: tai_lieu/superpowers/specs/2026-11-19-xoa-phan-cu-design.md
-- Bài thử: kiem_tra/so_thu_chi_136.sql (tự hoàn tác). Chạy lại nhiều lần không sao.

-- Ai làm Sổ thu chi của một cơ sở: Chủ / QLT, quản lý quỹ cơ sở (fin_branch_managers), hoặc quản lý được giao việc
-- "Đối soát ca" của cơ sở (Phân công việc — cùng cách giao với Xác nhận Fabi / Chốt ca).
create or replace function public.app__stc_can(p_branch bigint) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts := public.app_account();
begin
  if a.id is null or coalesce(a.locked, 0) = 1 or p_branch is null then return false; end if;
  if coalesce(public.app__fin_can(p_branch), false) then return true; end if;
  return coalesce(a.system_role, '') = 'ql' and a.id = any(coalesce(public.app__pc_who(1, 'branch', p_branch), '{}'::bigint[]));
end $$;
revoke all on function public.app__stc_can(bigint) from public, anon, authenticated;

-- Hàm ghi của Sổ thu chi dùng chung cách giao này
create or replace function public.app__stc_need(p_branch bigint) returns public.accounts
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts := public.app_account();
begin
  if a.id is null or coalesce(a.locked, 0) = 1 then raise exception 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'; end if;
  if not public.app__stc_can(p_branch) then raise exception 'Bạn không được sửa thu chi của cơ sở này.'; end if;
  return a;
end $$;
revoke all on function public.app__stc_need(bigint) from public, anon, authenticated;

-- app_stc_month / app_stc_finals: quyền theo cơ sở (app__stc_can); danh sách cơ sở chỉ cơ sở được giao;
-- phiếu trừ lương (gap.tl) kèm giải trình của nhân viên. Vá thẳng bản đang chạy, không thấy chỗ chèn thì dừng.
do $$
declare f text; d text; n int;
  old_chk text := 'if not public.app__fin_admin() then raise exception ''Đang chạy thử: chỉ Chủ và Quản lý tổng xem được.''; end if;';
  new_chk text := 'if not coalesce(public.app__stc_can(p_branch), false) then raise exception ''Bạn không được xem thu chi của cơ sở này.''; end if;';
  old_br text := 'from public.branches b where b.status = ''Đang hoạt động''), ''[]'')';
  new_br text := 'from public.branches b where b.status = ''Đang hoạt động'' and coalesce(public.app__stc_can(b.id), false)), ''[]'')';
  old_tl text := '''status'', sf.status) order by sf.id)';
  new_tl text := '''status'', sf.status, ''reply'', sf.reply) order by sf.id)';
begin
  foreach f in array array['public.app_stc_month(bigint,text)', 'public.app_stc_finals(bigint,text)'] loop
    d := pg_get_functiondef(f::regprocedure);
    if position(old_chk in d) > 0 then d := replace(d, old_chk, new_chk);
    elsif position(new_chk in d) = 0 then raise exception '%: không thấy câu kiểm tra quyền cũ.', f; end if;
    if f like '%stc_month%' then
      if position(new_br in d) = 0 then
        if position(old_br in d) = 0 then raise exception 'app_stc_month: không thấy danh sách cơ sở.'; end if;
        d := replace(d, old_br, new_br);
      end if;
      if position(new_tl in d) = 0 then
        if position(old_tl in d) = 0 then raise exception 'app_stc_month: không thấy phiếu trừ lương (tl).'; end if;
        d := replace(d, old_tl, new_tl);
      end if;
    end if;
    execute d;
  end loop;
end $$;

-- Xác nhận Fabi (bản 135 + ghi Thu chi / Công nợ + tự hoàn thành đối soát)
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


insert into public.app_migrations(file) values ('136_so_thu_chi_cho_ql.sql') on conflict (file) do nothing;
