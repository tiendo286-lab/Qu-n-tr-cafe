-- Bài thử máy chủ cho supabase/153_sua_so_fabi.sql trên dữ liệu thật (tự hoàn tác). Gửi CÙNG MỘT LẦN, theo thứ tự:
--   begin isolation level repeatable read; → kiem_tra/sua_so_fabi_153_truoc.sql → supabase/153_sua_so_fabi.sql (2 lần) → tệp này
do $$
declare chu public.accounts; rep text := ''; r2 record; g text; a0 jsonb; b0 jsonb; n int := 0; n2 int := 0; t text := ''; okb boolean; r public.shift_reports; q bigint; s jsonb; e jsonb;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  -- (0) sổ tháng giống hệt trước, trừ khoá mới 'fixes' ở từng ca
  for r2 in select t0.branch_id, t0.j o, public.app_stc_month(t0.branch_id, to_char(public.vn_now(), 'YYYY-MM')) nw from pg_temp.t153_truoc t0 order by 1 loop
    n := n + 1; okb := true;
    for g in select jsonb_object_keys(r2.o) union select jsonb_object_keys(r2.nw) loop
      a0 := r2.o -> g; b0 := r2.nw -> g;
      if g = 'cas' then b0 := (select coalesce(jsonb_agg(c - 'fixes' order by c ->> 'id'), '[]') from jsonb_array_elements(b0) c);
                        a0 := (select coalesce(jsonb_agg(c order by c ->> 'id'), '[]') from jsonb_array_elements(a0) c); end if;
      if a0 is distinct from b0 then okb := false; t := t || format(E'\n    cơ sở %s · khoá %s khác', r2.branch_id, g); end if;
    end loop;
    if okb then n2 := n2 + 1; end if;
  end loop;
  rep := rep || E'\n' || case when n > 0 and n = n2 then 'ĐẠT' else 'HỎNG' end || format(' (0) sổ tháng cũ = mới ở %s / %s cơ sở (chỉ thêm fixes)', n2, n) || t;
  -- (1) trên một ca thật đã có file Fabi, chưa Xác nhận Fabi: Chủ sửa ô Nợ bill (+1.000) → duyệt ngay, phiếu theo số mới, ô xanh
  select x.* into r from public.shift_reports x
   where x.status = 'hoan_thanh' and left(x.work_date, 7) = to_char(public.vn_now(), 'YYYY-MM') and not public.app__fin_locked(x.branch_id, x.work_date)
     and coalesce((public.app__stc_ds_state(x.id) ->> 'has_fabi')::boolean, false) and not coalesce((public.app__stc_ds_state(x.id) ->> 'done')::boolean, false)
   order by x.work_date desc, x.id desc limit 1;
  if r.id is null then
    rep := rep || E'\n    (1) tháng này không có ca nào đã có file Fabi mà chưa Xác nhận Fabi — bỏ qua (đã thử ở cục bộ)';
  else
    e := public.app__ca_eff(r.id);
    q := public.app_stc_fix_request(r.id, 'no', jsonb_build_object('val', coalesce((e ->> 'pos_debt')::bigint, 0) + 1000), 'Bài thử 153');
    s := public.app__stc_ds_state(r.id);
    rep := rep || E'\n' || case when (select status from public.stc_fix_requests where id = q) = 'duyet' and (s ->> 'no')::boolean
          and (public.app__ca_eff(r.id) ->> 'pos_debt')::bigint = coalesce((e ->> 'pos_debt')::bigint, 0) + 1000 then 'ĐẠT' else 'HỎNG' end
        || format(' (1) ca %s (%s %s): Chủ sửa nợ bill → duyệt ngay, ô nợ bill %s', r.id, r.work_date, r.shift, s ->> 'no');
  end if;
  raise exception 'REPORT>> %', rep;
end $$;
