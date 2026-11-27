-- 177 — Công ty AI: hàm cho trang Công ty AI (anh Tiến duyệt thiết kế 25/11/2026)
-- Mọi hàm app_ai_* chỉ cho tài khoản Chủ (accounts.system_role = 'chu'); không đụng role_permissions / app_can.
-- Không đổi web Milano. Chạy sau 176. Chạy lại nhiều lần không lỗi.

-- ---------------------------------------------------------------- hàm nội bộ dùng chung
create or replace function public.app__ai_can_chu() returns bigint
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app_account();
  if a.id is null or coalesce(a.system_role, '') <> 'chu' then
    raise exception 'Trang này chỉ dành cho Chủ';
  end if;
  return a.id;
end $$;

create or replace function public.app__ai_hom_nay() returns date
language sql stable as $$ select (now() at time zone 'Asia/Ho_Chi_Minh')::date $$;

create or replace function public.app__ai_viec_ngan(v public.ai_viec) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', v.id, 'phong', v.phong, 'phong_ten', (select ten from public.ai_phong where ma = v.phong),
    'loai', v.loai, 'tieu_de', v.tieu_de, 'trang_thai', v.trang_thai, 'cap_nhat', v.cap_nhat,
    'tom_tat', (select left(t.noi_dung, 120) from public.ai_tin t where t.viec_id = v.id order by t.luc desc, t.id desc limit 1))
$$;

create or replace function public.app__ai_kt(k public.ai_kien_thuc) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', k.id, 'phong', k.phong, 'loai', k.loai, 'noi_dung', k.noi_dung, 'trang_thai', k.trang_thai, 'tao_luc', k.tao_luc,
    'tep', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'ten', t.ten, 'mime', t.mime) order by t.id)
                     from public.ai_tep t where t.kien_thuc_id = k.id), '[]'::jsonb))
$$;

create or replace function public.app__ai_trang_thai_phong(p_ma text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.ai_viec where phong = p_ma and trang_thai = 'ket') then 'ket'
    when exists (select 1 from public.ai_viec where phong = p_ma and trang_thai = 'cho_anh') then 'cho_anh'
    when exists (select 1 from public.ai_viec where phong = p_ma and trang_thai = 'dang_lam') then 'dang_lam'
    when exists (select 1 from public.ai_viec where phong = p_ma and trang_thai = 'cho_lam') then 'cho_lam'
    when exists (select 1 from public.ai_viec where phong = p_ma and trang_thai = 'xong'
                   and (xong_luc at time zone 'Asia/Ho_Chi_Minh')::date = public.app__ai_hom_nay()) then 'xong'
    else 'ranh' end
$$;

-- gắn các tệp anh vừa tải lên (chưa gắn đâu) vào một việc
create or replace function public.app__ai_gan_tep(p_viec bigint, p_tep bigint[], p_nguoi bigint) returns void
language sql security definer set search_path = public as $$
  update public.ai_tep set viec_id = p_viec
   where id = any(coalesce(p_tep, '{}')) and viec_id is null and kien_thuc_id is null and nguoi_tao = p_nguoi;
$$;

revoke execute on function public.app__ai_can_chu(), public.app__ai_hom_nay(), public.app__ai_viec_ngan(public.ai_viec), public.app__ai_kt(public.ai_kien_thuc),
  public.app__ai_trang_thai_phong(text), public.app__ai_gan_tep(bigint, bigint[], bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------- đọc
create or replace function public.app_ai_la_chu() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((public.app_account()).system_role, '') = 'chu'
$$;

create or replace function public.app_ai_tong_quan() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare hq text;
begin
  perform public.app__ai_can_chu();
  hq := to_char(public.app__ai_hom_nay() - 1, 'YYYY-MM-DD');
  return jsonb_build_object(
    'mac', (select jsonb_build_object('lan_cuoi', m.lan_cuoi, 'ket_noi', coalesce(m.lan_cuoi > now() - interval '2 minutes', false),
                                      'dang_nhap_loi', m.dang_nhap_loi) from public.ai_mac m where m.id = 1),
    'cho_anh', coalesce((select jsonb_agg(public.app__ai_viec_ngan(v) order by v.cap_nhat desc) from public.ai_viec v where v.trang_thai = 'cho_anh'), '[]'::jsonb),
    'phong', (select jsonb_agg(jsonb_build_object('ma', p.ma, 'ten', p.ten, 'model', p.model, 'mo', p.mo,
                                                  'trang_thai', public.app__ai_trang_thai_phong(p.ma),
                                                  'so_viec_mo', (select count(*) from public.ai_viec v where v.phong = p.ma and v.trang_thai <> 'xong'))
                               order by p.thu_tu) from public.ai_phong p),
    'doanh_thu', jsonb_build_object('ngay', hq, 'co_so',
      coalesce((select jsonb_agg(jsonb_build_object('ma', b.code,
                  'net', (select sum(f.net) from public.fabi_shifts f where f.branch_id = b.id and f.work_date = hq))
                order by b.sort_order, b.id)
                from public.branches b where b.status = 'Đang hoạt động'), '[]'::jsonb)));
end $$;

create or replace function public.app_ai_phong(p_ma text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.ai_phong;
begin
  perform public.app__ai_can_chu();
  select * into p from public.ai_phong where ma = p_ma;
  if not found then raise exception 'Không có phòng này'; end if;
  return jsonb_build_object(
    'phong', jsonb_build_object('ma', p.ma, 'ten', p.ten, 'mo_ta', p.mo_ta, 'model', p.model, 'mo', p.mo, 'ghi_chu_khoa', p.ghi_chu_khoa),
    'viec', coalesce((select jsonb_agg(public.app__ai_viec_ngan(v) order by v.cap_nhat desc)
                      from (select * from public.ai_viec v where v.phong = p_ma and (v.trang_thai <> 'xong' or v.cap_nhat > now() - interval '30 days')
                            order by v.cap_nhat desc limit 200) v), '[]'::jsonb),
    'kien_thuc', coalesce((select jsonb_agg(public.app__ai_kt(k) order by k.trang_thai, k.tao_luc desc, k.id desc)
                           from public.ai_kien_thuc k where k.phong = p_ma), '[]'::jsonb),
    'kien_thuc_chung', case when p_ma = 'gd'
      then coalesce((select jsonb_agg(public.app__ai_kt(k) order by k.trang_thai, k.tao_luc desc, k.id desc)
                     from public.ai_kien_thuc k where k.phong is null), '[]'::jsonb)
      else '[]'::jsonb end);
end $$;

create or replace function public.app_ai_kien_thuc_chung() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__ai_can_chu();
  return coalesce((select jsonb_agg(public.app__ai_kt(k) order by k.trang_thai, k.tao_luc desc, k.id desc)
                   from public.ai_kien_thuc k where k.phong is null), '[]'::jsonb);
end $$;

create or replace function public.app_ai_viec(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.ai_viec;
begin
  perform public.app__ai_can_chu();
  select * into v from public.ai_viec where id = p_id;
  if not found then raise exception 'Không có việc này'; end if;
  return jsonb_build_object(
    'viec', public.app__ai_viec_ngan(v) || jsonb_build_object('noi_dung', v.noi_dung, 'ket_qua', v.ket_qua, 'ly_do_ket', v.ly_do_ket,
                                                              'cho_ca_cong_ty', v.cho_ca_cong_ty, 'tao_luc', v.tao_luc),
    'tin', coalesce((select jsonb_agg(jsonb_build_object('nguoi', t.nguoi, 'hanh_dong', t.hanh_dong, 'noi_dung', t.noi_dung, 'luc', t.luc) order by t.luc, t.id)
                     from public.ai_tin t where t.viec_id = p_id), '[]'::jsonb),
    'tep', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'ten', t.ten, 'mime', t.mime, 'kich_thuoc', t.kich_thuoc) order by t.id)
                     from public.ai_tep t where t.viec_id = p_id), '[]'::jsonb));
end $$;

create or replace function public.app_ai_lich_su(p_loc text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__ai_can_chu();
  if coalesce(p_loc, '') not in ('tat_ca','da_duyet','chua_tra_loi','chua_xong') then raise exception 'Bộ lọc không hợp lệ'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('luc', x.luc, 'loai', x.loai, 'tieu_de', x.tieu_de, 'phong_ten', x.phong_ten, 'viec_id', x.viec_id) order by x.luc desc)
    from (
      select * from (
        select t.luc, 'da_duyet'::text loai, v.tieu_de, p.ten phong_ten, v.id viec_id
          from public.ai_tin t join public.ai_viec v on v.id = t.viec_id join public.ai_phong p on p.ma = v.phong
         where p_loc in ('tat_ca','da_duyet') and t.nguoi = 'anh' and t.hanh_dong in ('dong_y','tra_loi','nap_kien_thuc')
           and t.luc > now() - interval '30 days'
        union all
        select v.cap_nhat, case when v.cap_nhat < now() - interval '2 days' then 'qua_han' else 'chua_tra_loi' end, v.tieu_de, p.ten, v.id
          from public.ai_viec v join public.ai_phong p on p.ma = v.phong
         where p_loc in ('tat_ca','chua_tra_loi') and v.trang_thai = 'cho_anh'
        union all
        select v.tao_luc, 'chua_xong', v.tieu_de, p.ten, v.id
          from public.ai_viec v join public.ai_phong p on p.ma = v.phong
         where p_loc in ('tat_ca','chua_xong') and v.cha_id is null and v.loai <> 'doc_kien_thuc' and v.trang_thai <> 'xong'
      ) u order by u.luc desc limit 100
    ) x), '[]'::jsonb);
end $$;

create or replace function public.app_ai_tep(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t public.ai_tep;
begin
  perform public.app__ai_can_chu();
  select * into t from public.ai_tep where id = p_id;
  if not found then raise exception 'Không có tệp này'; end if;
  return jsonb_build_object('ten', t.ten, 'mime', t.mime, 'base64', translate(encode(t.du_lieu, 'base64'), E'\n', ''));
end $$;

-- ---------------------------------------------------------------- ghi
create or replace function public.app_ai_tai_tep(p_ten text, p_mime text, p_base64 text) returns bigint
language plpgsql security definer set search_path = public as $$
declare uid bigint; b bytea; id_ bigint;
begin
  uid := public.app__ai_can_chu();
  if coalesce(p_mime, '') not in ('image/jpeg','image/png','image/webp','application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/csv') then
    raise exception 'Loại tệp này chưa nhận';
  end if;
  b := decode(coalesce(p_base64, ''), 'base64');
  if length(b) > 5242880 then raise exception 'Tệp quá 5 MB'; end if;
  if length(b) = 0 then raise exception 'Tệp trống'; end if;
  insert into public.ai_tep(ten, mime, kich_thuoc, du_lieu, nguoi_tao)
  values (left(coalesce(nullif(btrim(p_ten), ''), 'tep'), 200), p_mime, length(b), b, uid) returning id into id_;
  return id_;
end $$;

create or replace function public.app_ai_tao_viec(p_dich text, p_noi_dung text, p_tep bigint[] default '{}') returns bigint
language plpgsql security definer set search_path = public as $$
declare uid bigint; p public.ai_phong; nd text; tep bigint[]; id_ bigint; td text;
begin
  uid := public.app__ai_can_chu();
  select * into p from public.ai_phong where ma = p_dich;
  if not found or not p.mo then raise exception 'Phòng này chưa mở'; end if;
  nd := coalesce(btrim(p_noi_dung), '');
  tep := coalesce(p_tep, '{}');
  if nd = '' and cardinality(tep) = 0 then raise exception 'Anh nói, gõ hoặc kèm tệp trước đã'; end if;
  if cardinality(tep) > 6 then raise exception 'Tối đa 6 tệp mỗi lần'; end if;
  td := case when nd <> '' then left(regexp_replace(nd, '\s+', ' ', 'g'), 80)
             else coalesce((select ten from public.ai_tep where id = tep[1] and nguoi_tao = uid), 'Tệp anh gửi') end;
  insert into public.ai_viec(phong, loai, tieu_de, noi_dung, nguoi_tao)
  values (p_dich, case p_dich when 'gd' then 'de_xuat_giao' when 'tk' then 'ghi_chep' else 'viec' end, td, nd, uid)
  returning id into id_;
  perform public.app__ai_gan_tep(id_, tep, uid);
  insert into public.ai_tin(viec_id, nguoi, hanh_dong, noi_dung) values (id_, 'anh', 'giao', case when nd = '' then '(Anh gửi kèm tệp)' else nd end);
  return id_;
end $$;

create or replace function public.app_ai_tra_loi(p_viec bigint, p_noi_dung text) returns void
language plpgsql security definer set search_path = public as $$
declare v public.ai_viec; nd text;
begin
  perform public.app__ai_can_chu();
  nd := coalesce(btrim(p_noi_dung), '');
  if nd = '' then raise exception 'Anh nói hoặc gõ vài chữ trước đã'; end if;
  select * into v from public.ai_viec where id = p_viec for update;
  if not found then raise exception 'Không có việc này'; end if;
  if v.trang_thai = 'dang_lam' then raise exception 'Phòng đang làm, chờ xong rồi nhắn'; end if;
  insert into public.ai_tin(viec_id, nguoi, hanh_dong, noi_dung) values (p_viec, 'anh', 'tra_loi', nd);
  -- nạp kiến thức: lời sửa của anh thay nội dung, để bấm Đúng ghi đúng bản đã sửa
  update public.ai_viec set trang_thai = 'cho_lam', can_chay = true, ly_do_ket = null, cap_nhat = now(),
         noi_dung = case when loai = 'doc_kien_thuc' then nd else noi_dung end
   where id = p_viec;
end $$;

create or replace function public.app_ai_dong_viec(p_viec bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v public.ai_viec;
begin
  perform public.app__ai_can_chu();
  select * into v from public.ai_viec where id = p_viec for update;
  if not found then raise exception 'Không có việc này'; end if;
  if v.trang_thai = 'dang_lam' then raise exception 'Phòng đang làm, chờ xong rồi đóng'; end if;
  if v.trang_thai = 'xong' then raise exception 'Việc này đã xử lý'; end if;
  update public.ai_viec set trang_thai = 'xong', xong_luc = now(), cap_nhat = now(), can_chay = false where id = p_viec;
  insert into public.ai_tin(viec_id, nguoi, hanh_dong, noi_dung) values (p_viec, 'anh', 'dong_viec', 'Anh đóng việc này');
end $$;

create or replace function public.app_ai_dong_y(p_viec bigint) returns void
language plpgsql security definer set search_path = public as $$
declare uid bigint; v public.ai_viec; e jsonb; con bigint; kt bigint; t record;
begin
  uid := public.app__ai_can_chu();
  select * into v from public.ai_viec where id = p_viec for update;
  if not found then raise exception 'Không có việc này'; end if;
  if v.trang_thai <> 'cho_anh' then raise exception 'Việc này đã xử lý'; end if;

  if v.loai = 'de_xuat_giao' then
    if jsonb_typeof(v.ket_qua -> 'giao') is distinct from 'array' or jsonb_array_length(v.ket_qua -> 'giao') = 0 then
      raise exception 'Đề xuất không có việc nào để giao';
    end if;
    for e in select * from jsonb_array_elements(v.ket_qua -> 'giao') loop
      if not exists (select 1 from public.ai_phong where ma = e ->> 'phong' and mo and ma not in ('gd','tk'))
         or coalesce(btrim(e ->> 'tieu_de'), '') = '' then
        raise exception 'Đề xuất có việc giao sai phòng hoặc thiếu tiêu đề';
      end if;
      insert into public.ai_viec(phong, loai, tieu_de, noi_dung, nguoi_tao, cha_id)
      values (e ->> 'phong', 'viec', left(btrim(e ->> 'tieu_de'), 80), coalesce(e ->> 'noi_dung', ''), uid, p_viec)
      returning id into con;
      insert into public.ai_tin(viec_id, nguoi, noi_dung)
      values (con, 'he_thong', 'Giám đốc giao, anh đã đồng ý: ' || coalesce(nullif(e ->> 'noi_dung', ''), e ->> 'tieu_de'));
    end loop;
  elsif v.loai = 'doc_kien_thuc' then
    if coalesce(btrim(v.noi_dung), '') <> '' then
      insert into public.ai_kien_thuc(phong, loai, noi_dung, nguon_viec_id)
      values (case when v.cho_ca_cong_ty then null else v.phong end, 'da_chot', v.noi_dung, p_viec);
    end if;
    for t in select id, ten from public.ai_tep where viec_id = p_viec order by id loop
      insert into public.ai_kien_thuc(phong, loai, noi_dung, nguon_viec_id)
      values (case when v.cho_ca_cong_ty then null else v.phong end, 'tai_lieu', t.ten, p_viec) returning id into kt;
      update public.ai_tep set kien_thuc_id = kt where id = t.id;
    end loop;
  end if;

  update public.ai_viec set trang_thai = 'xong', xong_luc = now(), cap_nhat = now() where id = p_viec;
  insert into public.ai_tin(viec_id, nguoi, hanh_dong, noi_dung) values (p_viec, 'anh', 'dong_y', 'Đồng ý');
end $$;

create or replace function public.app_ai_gui_kien_thuc(p_phong text, p_noi_dung text, p_tep bigint[] default '{}') returns bigint
language plpgsql security definer set search_path = public as $$
declare uid bigint; ph text; nd text; tep bigint[]; id_ bigint; td text;
begin
  uid := public.app__ai_can_chu();
  ph := coalesce(p_phong, 'gd');
  if not exists (select 1 from public.ai_phong where ma = ph and mo) then raise exception 'Phòng này chưa mở'; end if;
  nd := coalesce(btrim(p_noi_dung), '');
  tep := coalesce(p_tep, '{}');
  if nd = '' and cardinality(tep) = 0 then raise exception 'Anh nói, gõ hoặc kèm tệp trước đã'; end if;
  if cardinality(tep) > 6 then raise exception 'Tối đa 6 tệp mỗi lần'; end if;
  td := 'Nạp kiến thức: ' || case when nd <> '' then left(regexp_replace(nd, '\s+', ' ', 'g'), 60)
                                  else coalesce((select ten from public.ai_tep where id = tep[1] and nguoi_tao = uid), 'tệp anh gửi') end;
  insert into public.ai_viec(phong, loai, tieu_de, noi_dung, nguoi_tao, cho_ca_cong_ty)
  values (ph, 'doc_kien_thuc', td, nd, uid, p_phong is null) returning id into id_;
  perform public.app__ai_gan_tep(id_, tep, uid);
  insert into public.ai_tin(viec_id, nguoi, hanh_dong, noi_dung) values (id_, 'anh', 'nap_kien_thuc', case when nd = '' then '(Anh gửi kèm tệp)' else nd end);
  return id_;
end $$;

create or replace function public.app_ai_bo_kien_thuc(p_id bigint, p_bo boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__ai_can_chu();
  update public.ai_kien_thuc set trang_thai = case when coalesce(p_bo, true) then 'da_bo' else 'dang_dung' end, doi_luc = now() where id = p_id;
  if not found then raise exception 'Không có kiến thức này'; end if;
end $$;

create or replace function public.app_ai_doi_model(p_ma text, p_model text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__ai_can_chu();
  if coalesce(p_model, '') not in ('manh','can_bang','nhanh') then raise exception 'Model không hợp lệ'; end if;
  update public.ai_phong set model = p_model where ma = p_ma;
  if not found then raise exception 'Không có phòng này'; end if;
end $$;

-- ---------------------------------------------------------------- quyền gọi
revoke execute on function public.app_ai_la_chu(), public.app_ai_tong_quan(), public.app_ai_phong(text), public.app_ai_kien_thuc_chung(),
  public.app_ai_viec(bigint), public.app_ai_lich_su(text), public.app_ai_tep(bigint), public.app_ai_tai_tep(text, text, text),
  public.app_ai_tao_viec(text, text, bigint[]), public.app_ai_tra_loi(bigint, text), public.app_ai_dong_y(bigint),
  public.app_ai_gui_kien_thuc(text, text, bigint[]), public.app_ai_bo_kien_thuc(bigint, boolean), public.app_ai_doi_model(text, text), public.app_ai_dong_viec(bigint)
  from public, anon;
grant execute on function public.app_ai_la_chu(), public.app_ai_tong_quan(), public.app_ai_phong(text), public.app_ai_kien_thuc_chung(),
  public.app_ai_viec(bigint), public.app_ai_lich_su(text), public.app_ai_tep(bigint), public.app_ai_tai_tep(text, text, text),
  public.app_ai_tao_viec(text, text, bigint[]), public.app_ai_tra_loi(bigint, text), public.app_ai_dong_y(bigint),
  public.app_ai_gui_kien_thuc(text, text, bigint[]), public.app_ai_bo_kien_thuc(bigint, boolean), public.app_ai_doi_model(text, text), public.app_ai_dong_viec(bigint)
  to authenticated;

insert into public.app_migrations(file) values ('177_cong_ty_ai_ham.sql') on conflict (file) do nothing;
