-- Đưa Đối soát Fabi về lại Chốt ca (anh Tiến duyệt thiết kế 22/11/2026 — tai_lieu/superpowers/specs/2026-11-22-doi-soat-ve-chot-ca-design.md):
-- 2 hàm ĐỌC cho bảng tuần Chốt ca (ô hai dòng Việc · Tiền) và nút "Ca tiếp theo chưa xong" ở trang đối soát của ca.
-- KHÔNG đổi luật: không sửa app__ca_auto_finish / stc_ca_done / quyền / cách tính tiền. Vùng khoá: chỉ đọc trạng thái.
-- Quyền: app__stc_can(cơ sở) — đúng người đối soát được cơ sở đó (Chủ, Quản lý tổng, quản lý có tên ở dòng "Đối soát ca"
--   của Bảng phân công); không có quyền → [] (không báo lỗi, để bảng tuần vẫn vẽ như cũ).
-- Trạng thái phần tiền theo đúng thứ tự điều kiện của app__ca_auto_finish / khung Còn thiếu (tệp 159):
--   kt = chờ kế toán · red = chưa xác nhận Fabi, còn ô đỏ (mở ca / doanh thu / nợ) · xn = chờ xác nhận Fabi ·
--   ht = đã xác nhận, chưa bấm Hoàn thành · ok = đã bấm Hoàn thành (stc_ca_done) hoặc ca đã "Đã đối soát".
-- Phần việc xong = đủ dấu Ai làm ca (nhan_su), Bàn giao (ban_giao), Nhập hàng (nhap_hang) và x2 không cần / đã duyệt.
-- Nhập hàng (luật 15/11 — tách sang menu Hàng hoá; anh Tiến chốt 22/11 "chỉ hiện khi còn hàng"): ca không nhận hàng kho tổng nào thì không tính
--   thiếu (máy tự đánh dấu khi mở trang đối soát — app__ca_auto_recon, cùng điều kiện); chỉ ca có hàng kho tổng gắn vào (ca cũ trước 15/11) mới tính.
-- Bài thử: kiem_tra/doi_soat_ve_chot_ca_164_cuc_bo.sql. Chạy lại nhiều lần không sao.

-- một ca → {id, date, shift, recon, tab, viec{xong, thieu, x2}, tien{st, thieu}}; p_light: bỏ phân biệt red / xn (chỉ cần tab)
create or replace function public.app__ca_ds_row(p_id bigint, p_light boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.shift_reports; kt jsonb; s jsonb; n_res int; done boolean; cv text; thieu text[]; viec boolean; st text; tthieu text[] := '{}';
begin
  select * into r from public.shift_reports where id = p_id;
  if r.id is null then return null; end if;
  thieu := array(select public.app__ca_item_label(q.u) from unnest(array['nhan_su', 'ban_giao', 'nhap_hang']) with ordinality q(u, o)
                  where not exists (select 1 from public.shift_report_checks c where c.report_id = p_id and c.item = q.u)
                    and (q.u <> 'nhap_hang' or exists (select 1 from public.delivery_invoices d where d.received_report_id = p_id)) order by q.o);
  cv := case when coalesce(r.self_reconciled, false) then 'khong_can' else public.app__cv_state(p_id) end;
  if coalesce(cv, '') not in ('khong_can', 'da_duyet') then thieu := thieu || 'Chờ Chủ duyệt x2'::text; end if;
  viec := cardinality(thieu) = 0;
  done := exists (select 1 from public.stc_ca_done d where d.report_id = p_id);
  select count(*) into n_res from public.shift_report_results x where x.report_id = p_id and x.item = any(public.app__ca_money_items());
  if r.recon_status = 'hoan_thanh' then
    st := 'ok'; viec := true; thieu := '{}';
  else
    kt := public.app__ca_kt_state(p_id);
    if not coalesce((kt ->> 'ready')::boolean, true) then
      st := 'kt'; tthieu := array(select jsonb_array_elements_text(case when jsonb_typeof(kt -> 'missing') = 'array' then kt -> 'missing' else '[]'::jsonb end));
    elsif n_res < cardinality(public.app__ca_money_items()) then
      if p_light then st := 'xn';
      else
        s := public.app__stc_ds_state(p_id);
        st := case when coalesce((s ->> 'mo1')::boolean, true) and coalesce((s ->> 'mo2')::boolean, true)
                    and coalesce((s ->> 'dt')::boolean, true) and coalesce((s ->> 'no')::boolean, true) then 'xn' else 'red' end;
      end if;
    elsif not done then st := 'ht';
    else st := 'ok';
    end if;
  end if;
  return jsonb_build_object('id', r.id, 'date', r.work_date, 'shift', r.shift, 'recon', r.recon_status,
    'tab', case when not viec then 'viec' when st <> 'ok' then 'tien' else 'xong' end,
    'viec', jsonb_build_object('xong', viec, 'thieu', to_jsonb(thieu), 'x2', cv),
    'tien', jsonb_build_object('st', st, 'thieu', to_jsonb(tthieu)));
end $$;
revoke all on function public.app__ca_ds_row(bigint, boolean) from public, anon, authenticated;

-- bảng tuần Chốt ca: mọi ca nhân viên đã gửi phiếu trong khoảng ngày (theo ngày rồi thứ tự ca)
create or replace function public.app_ca_ds_tuan(p_branch bigint, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sh text[] := public.app__shifts();
begin
  if p_branch is null or p_from is null or p_to is null or not coalesce(public.app__stc_can(p_branch), false) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(public.app__ca_ds_row(r.id) order by r.work_date, array_position(sh, r.shift), r.id)
                     from public.shift_reports r
                    where r.branch_id = p_branch and r.status = 'hoan_thanh'
                      and r.work_date between to_char(p_from, 'YYYY-MM-DD') and to_char(p_to, 'YYYY-MM-DD')), '[]'::jsonb);
end $$;

-- ca chưa "Đã đối soát" của cơ sở (nhân viên đã gửi phiếu, từ ngày bắt đầu dùng web 01/11 tới hôm nay) → "Còn N ca" + "Ca tiếp theo chưa xong"
--   (st = kt: ca chờ kế toán — luật 17/11 giữ nguyên, anh Tiến chốt lại 22/11: chờ kế toán thì cả phần việc cũng chờ → nút "Ca tiếp theo" bỏ qua)
create or replace function public.app_ca_ds_con(p_branch bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sh text[] := public.app__shifts();
begin
  if p_branch is null or not coalesce(public.app__stc_can(p_branch), false) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'date', r.work_date, 'shift', r.shift, 'tab', d.j ->> 'tab', 'st', d.j -> 'tien' ->> 'st')
                            order by r.work_date, array_position(sh, r.shift), r.id)
                     from public.shift_reports r, lateral (select public.app__ca_ds_row(r.id, true) j) d
                    where r.branch_id = p_branch and r.status = 'hoan_thanh' and r.recon_status is distinct from 'hoan_thanh'
                      and r.work_date between '2026-11-01' and to_char(public.vn_now(), 'YYYY-MM-DD')), '[]'::jsonb);
end $$;

revoke all on function public.app_ca_ds_tuan(bigint, date, date), public.app_ca_ds_con(bigint) from public, anon;
grant execute on function public.app_ca_ds_tuan(bigint, date, date), public.app_ca_ds_con(bigint) to authenticated;

-- Chữ báo lỗi còn chỉ chỗ cũ ("Sổ thu chi › Đối soát Fabi", "bước 6" — tab đã bỏ) → trang đối soát của ca trong Chốt ca (tab ② Phần tiền / ③ Hoàn thành).
-- CHỈ đổi chữ trong câu báo lỗi, không đổi điều kiện nào. Bản đang chạy không có chuỗi cũ (đã vá / khác bản) thì bỏ qua hàm đó — không dừng tệp.
--   app_ca_recon_finish (tệp 150: Hoàn thành đối soát lại sau khi mở lại phiếu) · app_fin_close (tệp 159: Chốt tháng) · app_stc_move_exchange (tệp 160: đổi luân chuyển trong ca)
--   · app_ca_check (tệp 31: đánh dấu Nhập hàng — nhập hàng tách sang menu Hàng hoá từ 15/11, phiếu ca không còn "mục 7")
do $$
declare d text; i int;
  fns text[] := array['public.app_ca_recon_finish(bigint)', 'public.app_fin_close(bigint,text,text)',
                      'public.app_stc_move_exchange(bigint,text,text)', 'public.app_stc_move_exchange(bigint,text,text)', 'public.app_ca_check(bigint,text,boolean)'];
  olds text[] := array[
    'vào Sổ thu chi › Đối soát Fabi, tích đủ mục kiểm tra rồi bấm "Hoàn thành đối soát ca" ở bước 6.',
    'Xử lý ở Sổ thu chi › Đối soát Fabi (bước Chênh lệch)',
    'xác nhận ở Đối soát Fabi trước rồi mới đổi khoản.',
    'Mở lại ở bước 6 mới đổi được.',
    'Bấm "Đối soát hàng" ở mục 7.'];
  news text[] := array[
    'vào trang đối soát của ca ở Chốt ca: tab ② Phần tiền tích đủ mục kiểm tra rồi bấm "Hoàn thành đối soát ca" ở tab ③.',
    'Xử lý ở trang đối soát của ca trong Chốt ca (tab ② Phần tiền, bước Chênh lệch)',
    'xác nhận ở trang đối soát của ca (tab ② Phần tiền) trước rồi mới đổi khoản.',
    'Mở lại ở tab ③ Hoàn thành của trang đối soát ca mới đổi được.',
    'Đối soát hàng ở menu Hàng hoá › Đối soát trước.'];
begin
  for i in 1 .. array_length(fns, 1) loop
    if to_regprocedure(fns[i]) is null then continue; end if;
    d := pg_get_functiondef(fns[i]::regprocedure);
    if position(olds[i] in d) = 0 then continue; end if;
    execute replace(d, olds[i], news[i]);
  end loop;
end $$;

insert into public.app_migrations(file) values ('164_doi_soat_ve_chot_ca.sql') on conflict (file) do nothing;
