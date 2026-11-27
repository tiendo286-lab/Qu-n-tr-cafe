-- 181 — Công ty AI: khung chat mới (thiết kế 26/11/2026, anh Tiến duyệt).
-- Tệp gắn theo tin; hàm đọc phần mới cho trang tự cập nhật; anh nhắn được khi phòng đang làm (phòng đọc sau lượt này);
-- trả lời kèm tệp; máy Mac (vai ai_viec) gửi tệp phòng làm ra; thông báo mở thẳng việc.
-- Chạy lại nhiều lần không lỗi. Hàm cũ giữ tương thích: trang cũ gọi app_ai_tra_loi(p_viec, p_noi_dung),
-- người nhận việc cũ gọi app__ai_ghi_ket_qua 5 tham số — vẫn chạy.

-- ===== bảng tệp: gắn theo tin, nguồn anh / phòng
alter table public.ai_tep add column if not exists tin_id bigint references public.ai_tin(id) on delete set null;
alter table public.ai_tep add column if not exists nguon text not null default 'anh';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ai_tep_nguon_check') then
    alter table public.ai_tep add constraint ai_tep_nguon_check check (nguon in ('anh','phong'));
  end if;
end $$;
create index if not exists ai_tep_tin_idx on public.ai_tep(tin_id);

-- tin_id hiển thị của một tệp: tệp cũ (chưa gắn tin) → tin đầu tiên của anh trong việc; không có → null
create or replace function public.app__ai_tin_cua_tep(t public.ai_tep) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(t.tin_id, (select min(i.id) from public.ai_tin i where i.viec_id = t.viec_id and i.nguoi = 'anh'));
$$;

create or replace function public.app__ai_tep_ngan(t public.ai_tep) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'ten', t.ten, 'mime', t.mime, 'kich_thuoc', t.kich_thuoc,
                            'tin_id', public.app__ai_tin_cua_tep(t), 'nguon', t.nguon);
$$;

-- ===== đọc một việc (như 177, thêm id tin và tệp theo tin)
create or replace function public.app_ai_viec(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.ai_viec;
begin
  perform public.app__ai_can_chu();
  select * into v from public.ai_viec where id = p_id;
  if not found then raise exception 'Không có việc này'; end if;
  return jsonb_build_object(
    'viec', public.app__ai_viec_ngan(v) || jsonb_build_object('noi_dung', v.noi_dung, 'ket_qua', v.ket_qua, 'ly_do_ket', v.ly_do_ket,
                                                              'cho_ca_cong_ty', v.cho_ca_cong_ty, 'tao_luc', v.tao_luc, 'bat_dau', v.bat_dau),
    'mac', (select jsonb_build_object('lan_cuoi', m.lan_cuoi, 'dang_nhap_loi', m.dang_nhap_loi) from public.ai_mac m where m.id = 1),
    'tin', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nguoi', t.nguoi, 'hanh_dong', t.hanh_dong, 'noi_dung', t.noi_dung, 'luc', t.luc) order by t.luc, t.id)
                     from public.ai_tin t where t.viec_id = p_id), '[]'::jsonb),
    'tep', coalesce((select jsonb_agg(public.app__ai_tep_ngan(t) order by t.id) from public.ai_tep t where t.viec_id = p_id), '[]'::jsonb));
end $$;

-- ===== phần mới từ sau một tin (trang hỏi lại 5 / 20 giây khi đang mở chat)
create or replace function public.app_ai_viec_moi(p_id bigint, p_sau_tin bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.ai_viec; sau bigint := coalesce(p_sau_tin, 0);
begin
  perform public.app__ai_can_chu();
  select * into v from public.ai_viec where id = p_id;
  if not found then raise exception 'Không có việc này'; end if;
  return jsonb_build_object(
    'viec', jsonb_build_object('trang_thai', v.trang_thai, 'bat_dau', v.bat_dau, 'ly_do_ket', v.ly_do_ket, 'ket_qua', v.ket_qua,
                               'cap_nhat', v.cap_nhat, 'loai', v.loai, 'noi_dung', v.noi_dung),
    'mac', (select jsonb_build_object('lan_cuoi', m.lan_cuoi, 'dang_nhap_loi', m.dang_nhap_loi) from public.ai_mac m where m.id = 1),
    'tin', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nguoi', t.nguoi, 'hanh_dong', t.hanh_dong, 'noi_dung', t.noi_dung, 'luc', t.luc) order by t.luc, t.id)
                     from public.ai_tin t where t.viec_id = p_id and t.id > sau), '[]'::jsonb),
    'tep', coalesce((select jsonb_agg(public.app__ai_tep_ngan(t) order by t.id)
                     from public.ai_tep t where t.viec_id = p_id and public.app__ai_tin_cua_tep(t) > sau), '[]'::jsonb));
end $$;

-- ===== anh trả lời (kèm tệp; được nhắn khi phòng đang làm)
drop function if exists public.app_ai_tra_loi(bigint, text);
create or replace function public.app_ai_tra_loi(p_viec bigint, p_noi_dung text, p_tep bigint[] default '{}') returns bigint
language plpgsql security definer set search_path = public as $$
declare uid bigint; v public.ai_viec; nd text; tep bigint[]; tin bigint;
begin
  uid := public.app__ai_can_chu();
  nd := coalesce(btrim(p_noi_dung), '');
  tep := coalesce(p_tep, '{}');
  if nd = '' and cardinality(tep) = 0 then raise exception 'Anh nói hoặc gõ vài chữ trước đã'; end if;
  if cardinality(tep) > 6 then raise exception 'Tối đa 6 tệp mỗi lần'; end if;
  select * into v from public.ai_viec where id = p_viec for update;
  if not found then raise exception 'Không có việc này'; end if;
  insert into public.ai_tin(viec_id, nguoi, hanh_dong, noi_dung)
  values (p_viec, 'anh', 'tra_loi', case when nd = '' then '(Anh gửi kèm tệp)' else nd end) returning id into tin;
  update public.ai_tep set viec_id = p_viec, tin_id = tin
   where id = any(tep) and viec_id is null and kien_thuc_id is null and nguoi_tao = uid;
  -- đang làm: chỉ ghi tin, phòng đọc sau lượt này (app__ai_ghi_ket_qua đưa việc về Chờ làm)
  if v.trang_thai <> 'dang_lam' then
    -- nạp kiến thức: lời sửa của anh thay nội dung, để bấm Đúng ghi đúng bản đã sửa
    update public.ai_viec set trang_thai = 'cho_lam', can_chay = true, ly_do_ket = null, cap_nhat = now(),
           noi_dung = case when loai = 'doc_kien_thuc' and nd <> '' then nd else noi_dung end
     where id = p_viec;
  else
    -- nạp kiến thức sửa lúc phòng đang đọc: bản sửa vẫn thay nội dung (bấm Đúng ghi bản sửa, không ghi bản cũ)
    update public.ai_viec set cap_nhat = now(),
           noi_dung = case when loai = 'doc_kien_thuc' and nd <> '' then nd else noi_dung end
     where id = p_viec;
  end if;
  return tin;
end $$;

-- ===== máy Mac ghi kết quả (trả id tin vừa ghi; còn tin anh chưa đọc → làm tiếp)
-- Tên mới để không trùng chữ ký với app__ai_ghi_ket_qua (5 tham số, tệp 176) — chạy lại 176 vẫn an toàn.
create or replace function public.app__ai_ghi_ket_qua_tin(p_id bigint, p_trang_thai text, p_tin text, p_ket_qua jsonb, p_ly_do text,
                                                          p_da_doc_tin bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare tt text := p_trang_thai; tin bigint;
begin
  if coalesce(p_trang_thai, '') not in ('xong','cho_anh','ket') then
    raise exception 'Trạng thái kết quả không hợp lệ: %', p_trang_thai;
  end if;
  if tt in ('xong','cho_anh') and p_da_doc_tin is not null
     and exists (select 1 from public.ai_tin where viec_id = p_id and nguoi = 'anh' and id > p_da_doc_tin) then
    tt := 'cho_lam';
  end if;
  update public.ai_viec
     set trang_thai = tt, ket_qua = p_ket_qua,
         can_chay = case when tt = 'cho_lam' then true else can_chay end,
         ly_do_ket = case when tt = 'ket' then p_ly_do end,
         xong_luc = case when tt = 'xong' then now() end,
         cap_nhat = now()
   where id = p_id and trang_thai = 'dang_lam';
  if not found then
    raise exception 'Việc % không ở trạng thái Đang làm', p_id;
  end if;
  if coalesce(btrim(p_tin), '') <> '' then
    insert into public.ai_tin(viec_id, nguoi, noi_dung) values (p_id, 'phong', p_tin) returning id into tin;
  else
    insert into public.ai_tin(viec_id, nguoi, noi_dung)
    values (p_id, 'he_thong', case when p_trang_thai = 'ket' then '⛔ Kẹt: ' || coalesce(p_ly_do, 'không rõ lý do') else 'Phòng không gửi nội dung' end)
    returning id into tin;
  end if;
  return tin;
end $$;

-- bản cũ (người nhận việc trước 26/11): giữ chữ ký 176, không biết tin đã đọc → như trước
create or replace function public.app__ai_ghi_ket_qua(p_id bigint, p_trang_thai text, p_tin text, p_ket_qua jsonb, p_ly_do text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__ai_ghi_ket_qua_tin(p_id, p_trang_thai, p_tin, p_ket_qua, p_ly_do, null);
end $$;

-- ===== máy Mac gửi tệp phòng làm ra, gắn vào tin trả lời của phòng
create or replace function public.app__ai_ghi_tep(p_viec bigint, p_tin bigint, p_ten text, p_mime text, p_base64 text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v public.ai_viec; b bytea; id_ bigint;
begin
  select * into v from public.ai_viec where id = p_viec;
  if not found then raise exception 'Không có việc này'; end if;
  if not exists (select 1 from public.ai_tin where id = p_tin and viec_id = p_viec and nguoi = 'phong') then
    raise exception 'Tin % không phải tin của phòng trong việc %', p_tin, p_viec;
  end if;
  if coalesce(p_mime, '') not in ('image/jpeg','image/png','image/webp','application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/csv','text/markdown','text/plain') then
    raise exception 'Loại tệp này chưa nhận';
  end if;
  if (select count(*) from public.ai_tep where tin_id = p_tin) >= 6 then raise exception 'Tối đa 6 tệp mỗi lần'; end if;
  b := decode(coalesce(p_base64, ''), 'base64');
  if length(b) > 5242880 then raise exception 'Tệp quá 5 MB'; end if;
  if length(b) = 0 then raise exception 'Tệp trống'; end if;
  insert into public.ai_tep(viec_id, tin_id, nguon, ten, mime, kich_thuoc, du_lieu, nguoi_tao)
  values (p_viec, p_tin, 'phong', left(coalesce(nullif(btrim(p_ten), ''), 'tep'), 200), p_mime, length(b), b, v.nguoi_tao)
  returning id into id_;
  return id_;
end $$;

-- ===== thông báo: bấm là mở thẳng việc
create or replace function public.app__ai_viec_bao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__ai_gui_thong_bao(
    coalesce((select ten from public.ai_phong where ma = new.phong), new.phong) || ': '
      || case new.trang_thai when 'cho_anh' then 'Chờ anh' when 'xong' then 'Xong' else 'Kẹt' end,
    left(new.tieu_de, 120), '#viec-' || new.id);
  return null;
end $$;

-- ===== quyền
revoke execute on function public.app__ai_tin_cua_tep(public.ai_tep), public.app__ai_tep_ngan(public.ai_tep) from public, anon, authenticated;
revoke execute on function public.app_ai_viec(bigint), public.app_ai_viec_moi(bigint, bigint), public.app_ai_tra_loi(bigint, text, bigint[]) from public, anon;
grant execute on function public.app_ai_viec(bigint), public.app_ai_viec_moi(bigint, bigint), public.app_ai_tra_loi(bigint, text, bigint[]) to authenticated;
revoke execute on function public.app__ai_ghi_ket_qua_tin(bigint, text, text, jsonb, text, bigint), public.app__ai_ghi_ket_qua(bigint, text, text, jsonb, text),
  public.app__ai_ghi_tep(bigint, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.app__ai_ghi_ket_qua_tin(bigint, text, text, jsonb, text, bigint), public.app__ai_ghi_ket_qua(bigint, text, text, jsonb, text),
  public.app__ai_ghi_tep(bigint, bigint, text, text, text) to ai_viec;
revoke execute on function public.app__ai_viec_bao() from public, anon, authenticated;

insert into public.app_migrations(file) values ('181_ai_khung_chat.sql') on conflict (file) do nothing;
