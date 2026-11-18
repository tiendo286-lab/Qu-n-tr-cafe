-- KIỂM TRA bước 132 (tệp 116): mỗi ảnh nhận hàng gắn tối đa 4 món. Chạy trong begin … rollback (in REPORT>>).
-- a) 5 món → lỗi "Mỗi ảnh tối đa 4 món…"   b) 4 món → lưu được, đúng 4 món gắn ảnh
begin;
do $$
declare chu uuid; inv bigint; ids bigint[]; pid bigint; e text; a_ok boolean := false; b_ok boolean := false; m jsonb := '{}'::jsonb;
begin
  select a.auth_user_id into chu from public.accounts a where a.system_role = 'chu' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id limit 1;
  select i.id into inv from public.delivery_invoices i where (select count(*) from public.delivery_lines l where l.invoice_id = i.id) >= 5 order by i.id desc limit 1;
  set local session_replication_role = replica;
  update public.delivery_invoices set recon_at = null where id = inv;
  set local session_replication_role = origin;
  select array_agg(id order by id) into ids from (select id from public.delivery_lines where invoice_id = inv order by id limit 5) z;
  perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
  begin
    perform public.app_gh_photo_add(inv, 'gh' || inv || '/thu5.jpg', ids);
    e := 'không bị chặn';
  exception when others then e := sqlerrm; end;
  a_ok := e = 'Mỗi ảnh tối đa 4 món — chụp ảnh khác cho các món còn lại.';
  m := m || jsonb_build_object('a', e);
  begin
    pid := public.app_gh_photo_add(inv, 'gh' || inv || '/thu4.jpg', ids[1:4]);
    b_ok := (select count(*) from public.delivery_photo_lines where photo_id = pid) = 4;
  exception when others then m := m || jsonb_build_object('b', sqlerrm); end;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when a_ok and b_ok then 'PASS' else 'FAIL' end, 'a_5_mon_bi_chan', a_ok, 'b_4_mon_luu_duoc', b_ok, 'loi', m, 'phieu', inv);
end $$;
rollback;
