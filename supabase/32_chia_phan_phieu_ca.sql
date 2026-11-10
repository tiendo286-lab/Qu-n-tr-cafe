-- =====================================================================
-- BƯỚC 32: CHIA PHIẾU CHỐT CA THÀNH 3 PHẦN VIỆC — anh Tiến chốt 11/11/2026 (tai_lieu/TINH_NANG_DA_CHOT.md mục 5i). Chạy sau 31.
-- Chạy lại nhiều lần không sao.
--  * 3 phần: TIỀN (mục 1–4) · NHÂN SỰ & BÀN GIAO (mục 5, 6) · NHẬN HÀNG (mục 7 — chỉ bắt buộc khi ca có nhận hàng kho tổng
--    hoặc có người đã nhận phần này).
--  * Người được nhận phần: nhân viên có tên trong ca + người có quyền Đối soát (quản lý). Phiếu chưa có ai trong ca → ai chốt ca cũng nhận được.
--  * Chỉ người nhận phần được sửa phần đó (máy chủ chặn). Muốn làm thay → "Nhận lại phần này" (ghi lịch sử, báo người cũ).
--  * "Xong phần này": kiểm tra đúng các mục của phần. Đủ các phần Xong → phiếu TỰ HOÀN THÀNH (bỏ nút Hoàn thành riêng).
--  * Phần do quản lý nhận và bấm Xong → khi phiếu hoàn thành, các hạng mục đối soát của phần đó tự tính đã đối soát
--    (TIỀN: thời gian, doanh thu, tiền mặt, chuyển khoản, thu chi + từng dòng thu chi, công nợ; NHÂN SỰ: nhân sự, bàn giao;
--     NHẬN HÀNG: từng món hàng). Ca không nhận hàng → hạng mục Nhập hàng tự ghi đã đối soát.
--  * Nhắc: 30 phút trước khi hết ca, còn phần chưa xong → báo người nhận phần (phần chưa ai nhận → báo nhân viên trong ca);
--    sau đó mỗi giờ nhắc lại, tối đa 24 giờ sau khi hết ca (không nhắc từ 0h đến 6h sáng).
-- =====================================================================

create table if not exists public.shift_report_parts (
  report_id bigint not null references public.shift_reports(id) on delete cascade,
  part text not null check (part in ('tien', 'nhan_su', 'nhan_hang')),
  claimed_by bigint references public.accounts(id),
  claimed_at text,
  prev_by bigint,                 -- người nhận trước (khi có người "Nhận lại phần này")
  done_by bigint,
  done_at text,
  done_ql boolean not null default false,   -- người bấm Xong có quyền Đối soát → tự đối soát khi phiếu hoàn thành
  primary key (report_id, part)
);
alter table public.shift_report_parts enable row level security;
revoke all on public.shift_report_parts from anon, authenticated;

-- ---------------------------------------------------------------- Tiện ích
create or replace function public.app__ca_part_label(p text) returns text
language sql immutable as $$
  select case p when 'tien' then 'TIỀN' when 'nhan_su' then 'NHÂN SỰ & BÀN GIAO' when 'nhan_hang' then 'NHẬN HÀNG' else p end
$$;

-- Các phần bắt buộc xong trước khi phiếu hoàn thành
create or replace function public.app__ca_parts_need(p_id bigint) returns text[]
language sql stable security definer set search_path = public as $$
  select array['tien', 'nhan_su']::text[]
    || case when exists (select 1 from public.delivery_invoices d where d.received_report_id = p_id)
              or exists (select 1 from public.shift_report_parts pt where pt.report_id = p_id and pt.part = 'nhan_hang' and pt.claimed_by is not null)
            then array['nhan_hang']::text[] else '{}'::text[] end
$$;

-- Giờ hết ca (theo khung giờ ca của cơ sở; qua nửa đêm thì sang ngày sau)
create or replace function public.app__ca_end_at(r public.shift_reports) returns timestamp
language sql stable security definer set search_path = public as $$
  select (r.work_date::date + bs.end_time::time)
         + case when bs.start_time ~ '^\d{1,2}:\d{2}' and bs.end_time::time <= bs.start_time::time then interval '1 day' else interval '0' end
    from public.shifts s join public.branch_shifts bs on bs.shift_id = s.id and bs.branch_id = r.branch_id
   where s.name = r.shift and bs.end_time ~ '^\d{1,2}:\d{2}'
   limit 1
$$;

-- Ai được nhận phần: quản lý (quyền Đối soát) hoặc nhân viên có tên trong ca; phiếu chưa có ai → ai chốt ca cũng được
create or replace function public.app__ca_part_can(p_id bigint) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts := public.app_account();
begin
  if a.id is null then return false; end if;
  return coalesce(public.app_can('doi_soat'), false)
      or not exists (select 1 from public.shift_report_staff s where s.report_id = p_id)
      or coalesce(exists (select 1 from public.shift_report_staff s where s.report_id = p_id and s.employee_id = a.employee_id), false);
end $$;

-- Khóa: chỉ người nhận phần (chưa bấm Xong) được sửa phần đó
create or replace function public.app__ca_part_guard(p_report bigint, p_part text) returns void
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports; pt public.shift_report_parts;
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then return; end if;
  select * into pt from public.shift_report_parts where report_id = p_report and part = p_part;
  if r.status <> 'dang_chot' then
    if pt.claimed_by is not null and pt.claimed_by is distinct from a.id then
      raise exception 'Phần % do % nhận — chỉ người nhận phần được sửa.', public.app__ca_part_label(p_part), public.app__acc_name(pt.claimed_by);
    end if;
    return;
  end if;
  if pt.claimed_by is null then
    raise exception 'Phần % chưa có người nhận. Bấm "Tôi nhận phần này" ở đầu phần đó trước (không thấy nút thì tải lại trang).', public.app__ca_part_label(p_part);
  end if;
  if pt.claimed_by is distinct from a.id then
    raise exception 'Phần % do % đang làm — chỉ người nhận phần được sửa. Muốn làm thay, bấm "Nhận lại phần này".',
      public.app__ca_part_label(p_part), public.app__acc_name(pt.claimed_by);
  end if;
  if pt.done_at is not null then
    raise exception 'Phần % đã bấm Xong. Muốn sửa, bấm "Sửa lại" ở đầu phần.', public.app__ca_part_label(p_part);
  end if;
end $$;

-- ---------------------------------------------------------------- Kiểm tra từng phần (tách từ Hoàn thành cũ)
create or replace function public.app__ca_part_check(p_id bigint, p_part text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; s record; debt_new bigint; miss text[] := '{}'; h jsonb; is_first boolean;
begin
  select * into r from public.shift_reports where id = p_id;
  if p_part = 'tien' then
    is_first := r.shift = (public.app__shifts())[1];
    if public.app__ca_forced_start(r) is not null and r.rev_start is distinct from public.app__ca_forced_start(r) then
      update public.shift_reports set rev_start = public.app__ca_forced_start(r) where id = r.id;
      r.rev_start := public.app__ca_forced_start(r);
    end if;
    if r.opening_cash is null and not is_first then
      miss := miss || (case when public.app__ca_chain(r.shift) then 'Đếm nhận két đầu ca' else 'Tiền mặt đầu ca' end)::text;
    end if;
    if r.ipos_opening is null then miss := miss || 'Số dư đầu trên phiếu iPOS'::text; end if;
    if r.rev_start is null or r.rev_end is null then miss := miss || 'giờ bắt đầu/kết thúc doanh thu'::text; end if;
    if r.rev_start is not null and r.rev_end is not null and r.rev_end <= r.rev_start then
      raise exception 'Giờ kết thúc doanh thu phải sau giờ bắt đầu (nếu qua nửa đêm, chọn ngày hôm sau).';
    end if;
    if r.total_revenue is null then miss := miss || 'Mục 1 Tổng doanh thu'::text; end if;
    if r.pos_cash is null then miss := miss || 'Mục 2 Tiền mặt POS'::text; end if;
    if r.pos_transfer is null then miss := miss || 'Mục 3 Chuyển khoản POS'::text; end if;
    if r.reported_transfer is null then miss := miss || 'Mục 4 Chuyển khoản thực tế'::text; end if;
    if r.cash_counted is null then miss := miss || 'Mục 5 Tiền trong két'::text; end if;
    if r.opening_cash is null and is_first then miss := miss || 'Tiền mặt đầu ca'::text; end if;
    if r.cups is null then miss := miss || 'Số cốc bán'::text; end if;
    if not exists (select 1 from public.shift_report_photos where report_id = r.id and kind = 'ipos') then miss := miss || 'Ảnh phiếu chốt ca iPOS'::text; end if;
    if array_length(miss, 1) > 0 then raise exception 'Phần TIỀN còn thiếu: %.', array_to_string(miss, ', '); end if;
    if least(r.total_revenue, r.pos_cash, r.pos_transfer, r.reported_transfer, r.cash_counted, r.opening_cash, r.cups, r.ipos_opening) < 0 then
      raise exception 'Các số liệu doanh thu, tiền, số cốc không được âm.';
    end if;
    if exists (select 1 from public.shift_debts where report_id = r.id and amount <= 0) then
      raise exception 'Mỗi bàn còn nợ cần số tiền lớn hơn 0.';
    end if;
    select coalesce(sum(amount), 0) into debt_new from public.shift_debts where report_id = r.id;
    if r.total_revenue <> r.pos_cash + r.pos_transfer + debt_new then
      raise exception 'Mục 1 (Tổng doanh thu) phải bằng Mục 2 + Mục 3 + Công nợ phát sinh (%). Đang lệch % — hãy sửa trước khi bấm Xong.',
        public.app__vnd(debt_new), public.app__vnd(r.total_revenue - r.pos_cash - r.pos_transfer - debt_new);
    end if;
    h := public.app__ca_hand(r.id);
    if h is not null then
      if h ->> 'state' = 'can_dem_lai' then
        raise exception 'Tiền nhận két lệch két cuối ca % (%). Hãy cùng 1 người ca % đếm lại và nhập số đếm lại trước khi bấm Xong.',
          h ->> 'prev_shift', public.app__vnd((h ->> 'gap')::bigint), h ->> 'prev_shift';
      end if;
      if h ->> 'state' = 'lech' and coalesce(trim(r.opening_note), '') = '' then
        raise exception 'Tiền nhận két (%) lệch két cuối ca % (%). Ghi lý do lệch trước khi bấm Xong.',
          public.app__vnd(r.opening_cash), h ->> 'prev_shift', public.app__vnd((h ->> 'prev_cash')::bigint);
      end if;
    end if;
    if r.ipos_opening <> r.opening_cash and coalesce(trim(r.opening_note), '') = '' then
      raise exception 'Số dư đầu trên iPOS (%) khác tiền nhận két (%). Ghi lý do trước khi bấm Xong.',
        public.app__vnd(r.ipos_opening), public.app__vnd(r.opening_cash);
    end if;
    if exists (select 1 from public.shift_report_moves where report_id = r.id and (amount = 0 or trim(note) = '')) then
      raise exception 'Mỗi dòng thu chi cần số tiền khác 0 và nội dung.';
    end if;
  elsif p_part = 'nhan_su' then
    for s in select e.code, e.name, st.* from public.shift_report_staff st join public.employees e on e.id = st.employee_id where st.report_id = r.id loop
      if s.worked = 1 and (s.time_in is null or s.time_out is null) then
        raise exception 'Nhập giờ đến và giờ về của % – %.', s.code, s.name;
      end if;
      if s.worked = 0 and coalesce(trim(s.absent_reason), '') = '' then
        raise exception 'Ghi lý do nghỉ của % – %.', s.code, s.name;
      end if;
    end loop;
  end if;
  -- NHẬN HÀNG: số thực nhận đã bắt buộc khi báo nhận; thiếu ảnh vẫn cho Xong (nằm trong báo cáo hồ sơ còn thiếu)
end $$;

-- ---------------------------------------------------------------- Quản lý tự làm phần nào → phần đó tự đối soát (chạy khi phiếu hoàn thành)
create or replace function public.app__ca_auto_recon(p_id bigint, p_acc bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; pt public.shift_report_parts; m jsonb; it text; comp bigint; res text; now_ text := public.vn_now_text();
        why text := 'Quản lý tự làm phiếu — tự tính đã đối soát';
begin
  select * into r from public.shift_reports where id = p_id;
  for pt in select * from public.shift_report_parts where report_id = p_id and done_at is not null and done_ql loop
    if pt.part = 'tien' then
      m := public.app__ca_money(p_id);
      foreach it in array public.app__ca_money_items() loop
        comp := case it when 'tien_mat' then (m ->> 'tm_left')::bigint when 'chuyen_khoan' then (m ->> 'ck_left')::bigint else 0 end;
        res := case when coalesce(comp, 0) = 0 then 'khop' when comp < 0 then 'thieu' else 'thua' end;
        insert into public.shift_report_results(report_id, item, result, amount, computed, basis, reason, by_account, at)
        values (p_id, it, res, abs(coalesce(comp, 0)), comp, case when it = 'chuyen_khoan' then m ->> 'ck_basis' end, why, pt.done_by, now_)
        on conflict (report_id, item) do nothing;
      end loop;
      insert into public.shift_report_checks(report_id, item, checked_by, checked_at)
      select p_id, x, pt.done_by, now_ from unnest(array['thoi_gian', 'doanh_thu', 'tien_mat', 'chuyen_khoan', 'thu_chi', 'cong_no']) x
      on conflict (report_id, item) do nothing;
      -- từng dòng thu chi của phiếu → đã đối soát (nhóm chi vẫn chọn ở Thu chi / Chốt tháng)
      insert into public.fin_move_cats(report_id, mkey, category_id, excluded, by_account, at, checked, checked_by, checked_at)
      select x.report_id, x.mkey, null, case when x.amount > 0 then 1 else 0 end, pt.done_by, now_, 1, pt.done_by, now_
        from public.app__tc_moves(r.branch_id, r.work_date, r.work_date) x where x.report_id = p_id
      on conflict (report_id, mkey) do update set checked = 1, checked_by = excluded.checked_by, checked_at = excluded.checked_at;
    elsif pt.part = 'nhan_su' then
      insert into public.shift_report_checks(report_id, item, checked_by, checked_at)
      select p_id, x, pt.done_by, now_ from unnest(array['nhan_su', 'ban_giao']) x
      on conflict (report_id, item) do nothing;
    elsif pt.part = 'nhan_hang' then
      update public.delivery_lines l set qty_checked = coalesce(l.qty_received, 0), checked_by = pt.done_by, checked_at = now_
        from public.delivery_invoices d where l.invoice_id = d.id and d.received_report_id = p_id and l.checked_at is null;
      update public.delivery_invoices set recon_by = pt.done_by, recon_at = now_
       where received_report_id = p_id and recon_at is null and state <> 'dang_chuyen';
      insert into public.shift_report_checks(report_id, item, checked_by, checked_at) values (p_id, 'nhap_hang', pt.done_by, now_)
      on conflict (report_id, item) do nothing;
    end if;
    insert into public.shift_recon_log(report_id, action, field, reason, by_account) values (p_id, 'ql_tu_lam', pt.part, why, pt.done_by);
  end loop;
  -- ca không nhận hàng kho tổng: hạng mục Nhập hàng tự ghi đã đối soát
  if not exists (select 1 from public.delivery_invoices where received_report_id = p_id) then
    insert into public.shift_report_checks(report_id, item, checked_by, checked_at) values (p_id, 'nhap_hang', p_acc, now_)
    on conflict (report_id, item) do nothing;
  end if;
  perform public.app__ca_auto_finish(p_id, p_acc);
end $$;

-- Hoàn thành phiếu (khi đủ các phần Xong)
create or replace function public.app__ca_finish(p_id bigint, p_acc bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__ca_part_check(p_id, 'tien');
  perform public.app__ca_part_check(p_id, 'nhan_su');
  update public.shift_reports set status = 'hoan_thanh', completed_by = p_acc, completed_at = public.vn_now_text(),
         updated_by = p_acc, updated_at = public.vn_now_text()
   where id = p_id;
  perform public.app_log('hoan_thanh_chot_ca', 'report=' || p_id || ' (đủ các phần việc)');
  perform public.app__ca_auto_recon(p_id, p_acc);
end $$;

-- ---------------------------------------------------------------- Đọc tình trạng các phần
create or replace function public.app_ca_parts(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; need text[]; e timestamp;
begin
  a := public.app__need('chot_ca');
  select * into r from public.shift_reports where id = p_id;
  if r.id is null then raise exception 'Không tìm thấy phiếu chốt ca.'; end if;
  need := public.app__ca_parts_need(p_id);
  e := public.app__ca_end_at(r);
  return jsonb_build_object(
    'status', r.status, 'me', a.id, 'can_claim', public.app__ca_part_can(p_id), 'is_ql', coalesce(public.app_can('doi_soat'), false),
    'end_at', to_char(e, 'YYYY-MM-DD HH24:MI'), 'remind_at', to_char(e - interval '30 minutes', 'YYYY-MM-DD HH24:MI'),
    'parts', (select jsonb_agg(jsonb_build_object('part', u.p, 'label', public.app__ca_part_label(u.p), 'need', u.p = any(need),
                'claimed_by', pt.claimed_by, 'claimed_name', public.app__acc_name(pt.claimed_by), 'claimed_at', pt.claimed_at,
                'mine', coalesce(pt.claimed_by = a.id, false), 'done_at', pt.done_at, 'done_name', public.app__acc_name(pt.done_by),
                'done_ql', coalesce(pt.done_ql, false), 'prev_name', public.app__acc_name(pt.prev_by)) order by u.o)
                from unnest(array['tien', 'nhan_su', 'nhan_hang']) with ordinality u(p, o)
                left join public.shift_report_parts pt on pt.report_id = p_id and pt.part = u.p));
end $$;

-- ---------------------------------------------------------------- Nhận phần / Nhận lại / Bỏ nhận
create or replace function public.app_ca_part_claim(p_id bigint, p_part text, p_force boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; pt public.shift_report_parts;
begin
  a := public.app__need('chot_ca');
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu chốt ca.'; end if;
  if r.status <> 'dang_chot' then raise exception 'Phiếu đã hoàn thành.'; end if;
  if p_part is null or p_part not in ('tien', 'nhan_su', 'nhan_hang') then raise exception 'Phần việc không hợp lệ.'; end if;
  if not public.app__ca_part_can(p_id) then
    raise exception 'Chỉ nhân viên có tên trong ca % và quản lý được nhận phần việc của phiếu này.', r.shift;
  end if;
  select * into pt from public.shift_report_parts where report_id = p_id and part = p_part;
  if pt.claimed_by = a.id then return public.app_ca_parts(p_id); end if;
  if pt.claimed_by is not null and not coalesce(p_force, false) then
    raise exception 'Phần % đã có % nhận. Muốn làm thay, bấm "Nhận lại phần này".', public.app__ca_part_label(p_part), public.app__acc_name(pt.claimed_by);
  end if;
  insert into public.shift_report_parts(report_id, part, claimed_by, claimed_at) values (p_id, p_part, a.id, public.vn_now_text())
  on conflict (report_id, part) do update set prev_by = public.shift_report_parts.claimed_by, claimed_by = excluded.claimed_by,
         claimed_at = excluded.claimed_at, done_by = null, done_at = null, done_ql = false;
  if pt.claimed_by is not null then
    perform public.app__notify(pt.claimed_by, 'Phần việc phiếu chốt ca đã được nhận lại',
      public.app__ca_title(r) || ': ' || public.app__acc_name(a.id) || ' đã nhận lại phần ' || public.app__ca_part_label(p_part) || '. Bạn không sửa phần này nữa.',
      '/ca/phieu?id=' || p_id);
    perform public.app_log('nhan_lai_phan_ca', 'report=' || p_id || ' ' || p_part || ' từ ' || coalesce(public.app__acc_name(pt.claimed_by), ''));
  else
    perform public.app_log('nhan_phan_ca', 'report=' || p_id || ' ' || p_part);
  end if;
  return public.app_ca_parts(p_id);
end $$;

create or replace function public.app_ca_part_release(p_id bigint, p_part text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; pt public.shift_report_parts;
begin
  a := public.app__need('chot_ca');
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status <> 'dang_chot' then raise exception 'Phiếu đã hoàn thành hoặc không tồn tại.'; end if;
  select * into pt from public.shift_report_parts where report_id = p_id and part = p_part;
  if pt.claimed_by is distinct from a.id then raise exception 'Bạn không phải người nhận phần này.'; end if;
  if pt.done_at is not null then raise exception 'Phần này đã bấm Xong. Bấm "Sửa lại" trước.'; end if;
  delete from public.shift_report_parts where report_id = p_id and part = p_part;
  perform public.app_log('bo_nhan_phan_ca', 'report=' || p_id || ' ' || p_part);
  return public.app_ca_parts(p_id);
end $$;

-- ---------------------------------------------------------------- Xong phần / Sửa lại. Đủ các phần Xong → phiếu tự hoàn thành
create or replace function public.app_ca_part_done(p_id bigint, p_part text, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; pt public.shift_report_parts; left_ text[];
begin
  a := public.app__need('chot_ca');
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu chốt ca.'; end if;
  if r.status <> 'dang_chot' then raise exception 'Phiếu đã hoàn thành.'; end if;
  select * into pt from public.shift_report_parts where report_id = p_id and part = p_part;
  if pt.claimed_by is null then raise exception 'Phần % chưa có người nhận.', public.app__ca_part_label(p_part); end if;
  if pt.claimed_by is distinct from a.id then
    raise exception 'Phần % do % nhận — chỉ người nhận bấm Xong được.', public.app__ca_part_label(p_part), public.app__acc_name(pt.claimed_by);
  end if;
  if coalesce(p_on, true) then
    if pt.done_at is null then
      perform public.app__ca_part_check(p_id, p_part);
      update public.shift_report_parts set done_by = a.id, done_at = public.vn_now_text(), done_ql = coalesce(public.app_can('doi_soat'), false)
       where report_id = p_id and part = p_part;
      perform public.app_log('xong_phan_ca', 'report=' || p_id || ' ' || p_part);
    end if;
  else
    update public.shift_report_parts set done_by = null, done_at = null, done_ql = false where report_id = p_id and part = p_part;
    perform public.app_log('sua_lai_phan_ca', 'report=' || p_id || ' ' || p_part);
    return jsonb_build_object('completed', false);
  end if;
  select coalesce(array_agg(public.app__ca_part_label(x)), '{}') into left_ from unnest(public.app__ca_parts_need(p_id)) x
   where not exists (select 1 from public.shift_report_parts q where q.report_id = p_id and q.part = x and q.done_at is not null);
  if coalesce(array_length(left_, 1), 0) = 0 then
    perform public.app__ca_finish(p_id, a.id);
    return jsonb_build_object('completed', true, 'left', '[]'::jsonb);
  end if;
  return jsonb_build_object('completed', false, 'left', to_jsonb(left_));
end $$;

-- Nút HOÀN THÀNH cũ (web chưa tải lại): chỉ hoàn thành khi đủ các phần Xong
create or replace function public.app_ca_complete(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; left_ text;
begin
  a := public.app_account();
  r := public.app__ca_need_edit(p_id);
  select string_agg(public.app__ca_part_label(x), ', ') into left_ from unnest(public.app__ca_parts_need(p_id)) x
   where not exists (select 1 from public.shift_report_parts q where q.report_id = p_id and q.part = x and q.done_at is not null);
  if left_ is not null then
    raise exception 'Phiếu chốt ca đã chia phần việc: còn phần % chưa bấm Xong. Đủ các phần Xong thì phiếu tự hoàn thành (tải lại trang nếu chưa thấy các phần).', left_;
  end if;
  perform public.app__ca_finish(p_id, a.id);
end $$;

-- ---------------------------------------------------------------- Lưu nháp: chỉ ghi phần mình đang nhận, phần khác giữ nguyên
create or replace function public.app__ca_save_core(p_id bigint, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; x jsonb; i int := 0; keep bigint[]; nid bigint;
        h_ids jsonb := '[]'; d_ids jsonb := '[]'; forced text;
begin
  a := public.app_account();
  r := public.app__ca_need_edit(p_id);
  forced := public.app__ca_forced_start(r);
  update public.shift_reports set
    rev_start = coalesce(forced, nullif(p ->> 'rev_start', '')),
    rev_end = nullif(p ->> 'rev_end', ''),
    total_revenue = nullif(p ->> 'total_revenue', '')::bigint,
    pos_cash = nullif(p ->> 'pos_cash', '')::bigint,
    pos_transfer = nullif(p ->> 'pos_transfer', '')::bigint,
    reported_transfer = nullif(p ->> 'reported_transfer', '')::bigint,
    cash_counted = nullif(p ->> 'cash_counted', '')::bigint,
    opening_cash = case when r.shift = (public.app__shifts())[1] then 1000000
                        when not public.app__ca_chain(r.shift) then nullif(p ->> 'opening_cash', '')::bigint
                        else r.opening_cash end,
    opening_note = nullif(trim(coalesce(p ->> 'opening_note', '')), ''),
    ipos_opening = case when p ? 'ipos_opening' then nullif(p ->> 'ipos_opening', '')::bigint else r.ipos_opening end,
    cups = nullif(p ->> 'cups', '')::int,
    goods_status = nullif(p ->> 'goods_status', ''),
    goods_note = nullif(p ->> 'goods_note', ''),
    updated_by = a.id, updated_at = public.vn_now_text()
  where id = r.id;

  delete from public.shift_report_moves where report_id = r.id;
  for x in select * from jsonb_array_elements(coalesce(p -> 'moves', '[]')) loop
    i := i + 1;
    insert into public.shift_report_moves(report_id, kind, amount, note, sort_order)
    values (r.id, x ->> 'kind', coalesce(nullif(x ->> 'amount', '')::bigint, 0), coalesce(x ->> 'note', ''), i);
  end loop;

  delete from public.shift_report_staff where report_id = r.id;
  for x in select * from jsonb_array_elements(coalesce(p -> 'staff', '[]')) loop
    insert into public.shift_report_staff(report_id, employee_id, source, role, worked, absent_reason, time_in, time_out, note)
    values (r.id, (x ->> 'employee_id')::bigint, coalesce(x ->> 'source', 'ho_tro'), nullif(x ->> 'role', ''),
            case when (x ->> 'worked')::boolean then 1 else 0 end, nullif(x ->> 'absent_reason', ''),
            nullif(x ->> 'time_in', ''), nullif(x ->> 'time_out', ''), nullif(x ->> 'note', ''))
    on conflict (report_id, employee_id) do nothing;
  end loop;

  delete from public.shift_report_goods where report_id = r.id;
  insert into public.shift_report_goods(report_id, item, qty)
  select r.id, trim(g ->> 'item'), coalesce(g ->> 'qty', '') from jsonb_array_elements(coalesce(p -> 'goods', '[]')) g
   where trim(coalesce(g ->> 'item', '')) <> '';

  keep := array(select (h ->> 'id')::bigint from jsonb_array_elements(coalesce(p -> 'handover', '[]')) h where h ->> 'id' is not null);
  delete from public.handover_items where report_id = r.id and task_id is null and not (id = any(keep));
  for x in select * from jsonb_array_elements(coalesce(p -> 'handover', '[]')) loop
    if trim(coalesce(x ->> 'content', '')) = '' then h_ids := h_ids || 'null'::jsonb; continue; end if;
    if x ->> 'id' is null then
      insert into public.handover_items(branch_id, report_id, content, created_by) values (r.branch_id, r.id, trim(x ->> 'content'), a.id)
      returning id into nid;
    else
      nid := (x ->> 'id')::bigint;
      update public.handover_items set content = trim(x ->> 'content') where id = nid and report_id = r.id and task_id is null;
    end if;
    h_ids := h_ids || to_jsonb(nid);
  end loop;

  keep := array(select (d ->> 'id')::bigint from jsonb_array_elements(coalesce(p -> 'debts', '[]')) d where d ->> 'id' is not null);
  delete from public.shift_debts where report_id = r.id and closed_at is null and not (id = any(keep));
  for x in select * from jsonb_array_elements(coalesce(p -> 'debts', '[]')) loop
    if trim(coalesce(x ->> 'table_name', '')) = '' then d_ids := d_ids || 'null'::jsonb; continue; end if;
    if x ->> 'id' is null then
      insert into public.shift_debts(branch_id, report_id, table_name, amount, note, created_by)
      values (r.branch_id, r.id, trim(x ->> 'table_name'), coalesce(nullif(x ->> 'amount', '')::bigint, 0), nullif(x ->> 'note', ''), a.id)
      returning id into nid;
    else
      nid := (x ->> 'id')::bigint;
      update public.shift_debts set table_name = trim(x ->> 'table_name'), amount = coalesce(nullif(x ->> 'amount', '')::bigint, 0),
             note = nullif(x ->> 'note', '')
       where id = nid and report_id = r.id and closed_at is null;
    end if;
    d_ids := d_ids || to_jsonb(nid);
  end loop;
  return jsonb_build_object('at', public.vn_now_text(), 'rev_start', coalesce(forced, nullif(p ->> 'rev_start', '')),
                            'handover_ids', h_ids, 'debt_ids', d_ids);
end $$;

create or replace function public.app_ca_save(p_id bigint, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; mine text[]; q jsonb := coalesce(p, '{}'::jsonb);
begin
  a := public.app_account();
  r := public.app__ca_need_edit(p_id);
  select coalesce(array_agg(part), '{}') into mine from public.shift_report_parts
   where report_id = r.id and claimed_by = a.id and done_at is null;
  if not ('tien' = any(mine) or 'nhan_su' = any(mine)) then
    return jsonb_build_object('at', public.vn_now_text(), 'skipped', true, 'rev_start', r.rev_start, 'handover_ids', '[]'::jsonb, 'debt_ids', '[]'::jsonb);
  end if;
  if not ('tien' = any(mine)) then
    q := q || jsonb_build_object('rev_start', r.rev_start, 'rev_end', r.rev_end, 'total_revenue', r.total_revenue, 'pos_cash', r.pos_cash,
      'pos_transfer', r.pos_transfer, 'reported_transfer', r.reported_transfer, 'cash_counted', r.cash_counted, 'opening_cash', r.opening_cash,
      'opening_note', r.opening_note, 'ipos_opening', r.ipos_opening, 'cups', r.cups,
      'moves', coalesce((select jsonb_agg(jsonb_build_object('kind', m.kind, 'amount', m.amount, 'note', m.note) order by m.sort_order, m.id)
                           from public.shift_report_moves m where m.report_id = r.id), '[]'::jsonb),
      'debts', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'table_name', d.table_name, 'amount', d.amount, 'note', d.note) order by d.id)
                           from public.shift_debts d where d.report_id = r.id), '[]'::jsonb));
  end if;
  if not ('nhan_su' = any(mine)) then
    q := q || jsonb_build_object(
      'staff', coalesce((select jsonb_agg(jsonb_build_object('employee_id', s.employee_id, 'source', s.source, 'role', s.role, 'worked', s.worked = 1,
                           'absent_reason', s.absent_reason, 'time_in', s.time_in, 'time_out', s.time_out, 'note', s.note))
                           from public.shift_report_staff s where s.report_id = r.id), '[]'::jsonb),
      'handover', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'content', h.content) order by h.id)
                              from public.handover_items h where h.report_id = r.id), '[]'::jsonb));
  end if;
  -- nhập hàng kiểu cũ: giữ nguyên
  q := q || jsonb_build_object('goods_status', r.goods_status, 'goods_note', r.goods_note,
    'goods', coalesce((select jsonb_agg(jsonb_build_object('item', g.item, 'qty', g.qty) order by g.id) from public.shift_report_goods g where g.report_id = r.id), '[]'::jsonb));
  return public.app__ca_save_core(p_id, q) || jsonb_build_object('parts', to_jsonb(mine));
end $$;

-- ---------------------------------------------------------------- Các thao tác khác trong phiếu: thêm khóa phần việc
create or replace function public.app_ca_cash_receive(p_id bigint, p_amount bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; prev public.shift_reports; h jsonb;
begin
  a := public.app_account();
  r := public.app__ca_need_edit(p_id);
  perform public.app__ca_part_guard(p_id, 'tien');
  if r.shift = (public.app__shifts())[1] then raise exception 'Ca % là ca đầu ngày, nhận 1.000.000đ cố định — không cần đếm nhận két.', r.shift; end if;
  if not public.app__ca_chain(r.shift) then raise exception 'Ca % không nằm trong chuỗi bàn giao két — nhập tiền đầu ca trực tiếp.', r.shift; end if;
  if r.opening_cash is not null then
    raise exception 'Ca này đã nhập tiền nhận két (%). Nếu lệch, hãy cùng người ca trước đếm lại.', public.app__vnd(r.opening_cash);
  end if;
  if p_amount is null or p_amount < 0 then raise exception 'Nhập số tiền đếm được trong két.'; end if;
  select * into prev from public.shift_reports
   where branch_id = r.branch_id and work_date = r.work_date and shift = public.app__ca_prev_shift(r.shift);
  if prev.id is not null and prev.status <> 'hoan_thanh' then
    raise exception 'Ca % chưa bấm HOÀN THÀNH phiếu chốt ca. Người ca % đếm két, hoàn thành phiếu trước, sau đó bạn mới đếm nhận két.', prev.shift, prev.shift;
  end if;
  update public.shift_reports set opening_cash = p_amount, open_first_count = p_amount, open_counted_by = a.id, open_counted_at = public.vn_now_text(),
         updated_by = a.id, updated_at = public.vn_now_text()
   where id = r.id;
  h := public.app__ca_hand(r.id);
  perform public.app_log('nhan_ket', 'report=' || r.id || ' ' || p_amount || ' ' || coalesce(h ->> 'state', ''));
  return h;
end $$;

create or replace function public.app_ca_cash_recount(p_id bigint, p_amount bigint, p_giver bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; h jsonb; msg text; prev_id bigint;
begin
  a := public.app_account();
  r := public.app__ca_need_edit(p_id);
  perform public.app__ca_part_guard(p_id, 'tien');
  h := public.app__ca_hand(r.id);
  if coalesce(h ->> 'state', '') <> 'can_dem_lai' then raise exception 'Chỉ đếm lại khi tiền nhận két lệch két cuối ca trước (và chưa đếm lại lần nào).'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'Nhập số tiền 2 người cùng đếm lại.'; end if;
  if p_giver is null then raise exception 'Chọn người ca trước cùng đếm lại.'; end if;
  prev_id := (h ->> 'prev_id')::bigint;
  if jsonb_array_length(h -> 'prev_staff') > 0
     and not exists (select 1 from public.shift_report_staff where report_id = prev_id and employee_id = p_giver and worked = 1) then
    raise exception 'Người cùng đếm lại phải là nhân viên làm ca %.', h ->> 'prev_shift';
  end if;
  if not exists (select 1 from public.employees where id = p_giver) then raise exception 'Nhân viên không hợp lệ.'; end if;
  update public.shift_reports set opening_cash = p_amount, open_giver_emp = p_giver, open_recount_at = public.vn_now_text(),
         updated_by = a.id, updated_at = public.vn_now_text()
   where id = r.id;
  h := public.app__ca_hand(r.id);
  if h ->> 'state' = 'lech' then
    msg := public.app__ca_title(r) || ': tiền nhận két ' || public.app__vnd((h ->> 'counted')::bigint) || ', két cuối ca ' || (h ->> 'prev_shift')
      || ' khai ' || public.app__vnd((h ->> 'prev_cash')::bigint) || ' → lệch ' || public.app__vnd((h ->> 'gap')::bigint)
      || E'.\nĐã đếm lại cùng ' || coalesce(h ->> 'giver', '') || ' lúc ' || substr(h ->> 'recount_at', 12, 5)
      || ' (lần đầu đếm ' || public.app__vnd((h ->> 'first_count')::bigint) || '). Khoản lệch tính cho ca ' || (h ->> 'prev_shift') || '.';
    perform public.app__notify_doi_soat('Bàn giao két bị lệch', msg, '/ca/phieu?id=' || prev_id);
    perform public.app__notify_emp(p_giver, 'Bàn giao két ca của bạn bị lệch', msg, '/ca/phieu?id=' || prev_id);
  end if;
  perform public.app_log('dem_lai_ket', 'report=' || r.id || ' ' || p_amount || ' ' || coalesce(h ->> 'state', ''));
  return h;
end $$;

create or replace function public.app_ca_photo_add(p_id bigint, p_path text, p_kind text default 'hang') returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; nid bigint;
begin
  a := public.app_account();
  perform public.app__ca_need_edit(p_id);
  perform public.app__ca_part_guard(p_id, case when coalesce(p_kind, 'hang') = 'ipos' then 'tien' else 'nhan_hang' end);
  if p_path !~ ('^r' || p_id || '/') then raise exception 'Đường dẫn ảnh không hợp lệ.'; end if;
  if coalesce(p_kind, 'hang') not in ('hang', 'ipos') then raise exception 'Loại ảnh không hợp lệ.'; end if;
  insert into public.shift_report_photos(report_id, path, created_by, kind) values (p_id, p_path, a.id, coalesce(p_kind, 'hang')) returning id into nid;
  return nid;
end $$;

create or replace function public.app_ca_photo_del(p_photo bigint) returns text
language plpgsql security definer set search_path = public as $$
declare ph public.shift_report_photos;
begin
  select * into ph from public.shift_report_photos where id = p_photo;
  if ph.id is null then return null; end if;
  perform public.app__ca_need_edit(ph.report_id);
  perform public.app__ca_part_guard(ph.report_id, case when ph.kind = 'ipos' then 'tien' else 'nhan_hang' end);
  delete from public.shift_report_photos where id = p_photo;
  return ph.path;
end $$;

create or replace function public.app_ca_debt_collect(p_debt bigint, p_report bigint, p_kind text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app_account();
  perform public.app__ca_need_edit(p_report);
  perform public.app__ca_part_guard(p_report, 'tien');
  if p_kind is null then
    update public.shift_debts set closed_at = null, closed_by = null, closed_report_id = null, close_note = null, collect_kind = null
     where id = p_debt and closed_report_id = p_report;
    return;
  end if;
  if p_kind not in ('tien_mat', 'chuyen_khoan') then raise exception 'Chọn khách trả bằng tiền mặt hay chuyển khoản.'; end if;
  update public.shift_debts set closed_at = public.vn_now_text(), closed_by = a.id, closed_report_id = p_report,
         close_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Đã thu'), collect_kind = p_kind
   where id = p_debt and closed_at is null and report_id <> p_report;
  if not found then raise exception 'Khoản nợ này đã được thu hoặc không thuộc ca trước.'; end if;
end $$;

create or replace function public.app_ca_handover_done(p_item bigint, p_report bigint, p_done boolean) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; h public.handover_items;
begin
  a := public.app_account();
  perform public.app__ca_need_edit(p_report);
  perform public.app__ca_part_guard(p_report, 'nhan_su');
  select * into h from public.handover_items where id = p_item;
  if h.id is null then raise exception 'Không tìm thấy việc bàn giao.'; end if;
  if h.task_id is not null then raise exception 'Việc này đã được giao ở tab Công việc; chỉ xong khi người nhận báo Đã xử lý.'; end if;
  if p_done then
    update public.handover_items set done_at = public.vn_now_text(), done_by = a.id, done_report_id = p_report where id = p_item and done_at is null;
  else
    update public.handover_items set done_at = null, done_by = null, done_report_id = null where id = p_item and done_report_id = p_report;
  end if;
end $$;

create or replace function public.app__nh_staff_can(i public.delivery_invoices, r public.shift_reports) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if i.id is null or r.id is null then raise exception 'Không tìm thấy hàng hoặc phiếu ca.'; end if;
  if r.status = 'dang_chot' then perform public.app__ca_part_guard(r.id, 'nhan_hang'); end if;
  if i.branch_id <> r.branch_id then raise exception 'Hàng này của cơ sở khác.'; end if;
  if i.state = 'dang_chuyen' then
    if i.work_date > r.work_date then raise exception 'Hóa đơn này giao ngày % — chưa tới ngày.', to_char(i.work_date::date, 'DD/MM'); end if;
    return;
  end if;
  if i.received_report_id is distinct from r.id then raise exception 'Hàng này đã được báo nhận ở ca khác.'; end if;
  if i.recon_at is not null then raise exception 'Quản lý đã đối soát hàng này nên không sửa được nữa.'; end if;
  if i.received_date <> public.app__nh_today() then raise exception 'Chỉ sửa được báo cáo nhận hàng trong ngày nhận.'; end if;
end $$;

create or replace function public.app_nh_receipt_save(p_id bigint, p_report bigint, p_lines jsonb, p_note text) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; i public.delivery_invoices; r public.shift_reports; x jsonb; nid bigint; k int := 0; keep bigint[] := '{}'; lid bigint; b public.branches;
begin
  a := public.app__need('chot_ca');
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  if r.status = 'dang_chot' then perform public.app__ca_part_guard(r.id, 'nhan_hang'); end if;
  if jsonb_array_length(coalesce(p_lines, '[]')) = 0 then raise exception 'Ghi ít nhất 1 món hàng đã nhận.'; end if;
  for x in select * from jsonb_array_elements(p_lines) loop
    if trim(coalesce(x ->> 'name', '')) = '' then raise exception 'Món hàng phải có tên.'; end if;
    if nullif(x ->> 'qty', '') is null or (x ->> 'qty')::numeric <= 0 then raise exception 'Nhập số lượng nhận cho món "%".', x ->> 'name'; end if;
  end loop;
  if p_id is null then
    insert into public.delivery_invoices(branch_id, work_date, created_by, kind, state, received_by, received_at, received_date, received_report_id, receive_note)
    values (r.branch_id, r.work_date, a.id, 'khong_hd', 'cho_hoa_don', a.id, public.vn_now_text(), public.app__nh_today(), p_report, nullif(trim(coalesce(p_note, '')), ''))
    returning id into nid;
  else
    select * into i from public.delivery_invoices where id = p_id for update;
    perform public.app__nh_staff_can(i, r);
    if i.state <> 'cho_hoa_don' then raise exception 'Phiếu này đã được ghép hóa đơn.'; end if;
    nid := p_id;
    update public.delivery_invoices set receive_note = nullif(trim(coalesce(p_note, '')), ''), received_at = public.vn_now_text(), updated_at = public.vn_now_text() where id = nid;
  end if;
  for x in select * from jsonb_array_elements(p_lines) loop
    k := k + 1; lid := nullif(x ->> 'id', '')::bigint;
    if lid is not null and exists (select 1 from public.delivery_lines where id = lid and invoice_id = nid) then
      update public.delivery_lines set sort = k, code = nullif(trim(coalesce(x ->> 'code', '')), ''), name = trim(x ->> 'name'), unit = nullif(trim(coalesce(x ->> 'unit', '')), ''),
             qty_received = (x ->> 'qty')::numeric where id = lid;
    else
      insert into public.delivery_lines(invoice_id, sort, code, name, unit, qty_received)
      values (nid, k, nullif(trim(coalesce(x ->> 'code', '')), ''), trim(x ->> 'name'), nullif(trim(coalesce(x ->> 'unit', '')), ''), (x ->> 'qty')::numeric) returning id into lid;
    end if;
    keep := keep || lid;
  end loop;
  delete from public.delivery_lines where invoice_id = nid and not (id = any(keep));
  if p_id is null then
    select * into b from public.branches where id = r.branch_id;
    perform public.app__nh_notify(r.branch_id, 'Nhận hàng KHÔNG có hóa đơn · ' || coalesce(b.display_code, b.code),
      public.app__acc_name(a.id) || ' nhận ' || k || ' món (ca ' || r.shift || ' ' || to_char(r.work_date::date, 'DD/MM') || '). Kế toán tải hóa đơn và ghép vào phiếu.',
      '/ke-toan/hoa-don', true, true);
  end if;
  perform public.app_log('nhap_hang_khong_hoa_don', 'id=' || nid || ' ' || k || ' món');
  return nid;
end $$;

-- Mở lại phiếu: các phần phải bấm Xong lại
create or replace function public.app_ca_reopen(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app__need('mo_lai_phieu_ca');
  update public.shift_reports set status = 'dang_chot', recon_status = 'chua', recon_by = null, recon_at = null,
         completed_at = null, completed_by = null, updated_by = a.id, updated_at = public.vn_now_text()
   where id = p_id and status = 'hoan_thanh';
  if not found then raise exception 'Phiếu chưa hoàn thành hoặc không tồn tại.'; end if;
  perform public.app__ca_drop_shortfalls(p_id, null, null, 'Phiếu ca được mở lại cho nhân viên sửa — sẽ đối soát lại.');
  delete from public.shift_report_results where report_id = p_id;
  delete from public.shift_report_checks where report_id = p_id;
  delete from public.shift_report_recon where report_id = p_id;
  update public.shift_report_parts set done_at = null, done_by = null, done_ql = false where report_id = p_id;  -- bước 32: các phần phải bấm Xong lại
  insert into public.shift_recon_log(report_id, action, by_account) values (p_id, 'lam_lai', a.id);
  perform public.app_log('mo_lai_phieu_ca', 'report=' || p_id);
end $$;

-- ---------------------------------------------------------------- Nhắc phiếu chưa xong: 30 phút trước khi hết ca, sau đó mỗi giờ
create or replace function public.app_ca_part_tick() returns int
language plpgsql security definer set search_path = public as $$
declare now_ timestamp := public.vn_now(); r public.shift_reports; e timestamp; slot int; k text; need text[]; rc record; n int := 0;
begin
  for r in select * from public.shift_reports
            where status = 'dang_chot' and work_date between to_char(now_::date - 1, 'YYYY-MM-DD') and to_char(now_::date, 'YYYY-MM-DD') loop
    e := public.app__ca_end_at(r);
    if e is null or now_ < e - interval '30 minutes' or now_ > e + interval '24 hours' then continue; end if;
    if extract(hour from now_) < 6 then continue; end if;   -- không nhắc ban đêm (0h–6h)
    slot := floor(extract(epoch from (now_ - (e - interval '30 minutes'))) / 3600)::int;
    k := 'ca_phan:' || r.id || ':' || slot;
    insert into public.notification_events(event_key, created_at) values (k, public.vn_now_text()) on conflict do nothing;
    if not found then continue; end if;
    need := public.app__ca_parts_need(r.id);
    for rc in
      select z.acc, string_agg(distinct z.lbl, ', ') as lbls from (
        select pt.claimed_by as acc, public.app__ca_part_label(pt.part) as lbl from public.shift_report_parts pt
         where pt.report_id = r.id and pt.done_at is null and pt.claimed_by is not null and pt.part = any(need)
        union all
        select ac.id, public.app__ca_part_label(u.p) from unnest(need) u(p)
          join public.shift_report_staff s on s.report_id = r.id and s.worked = 1
          join public.accounts ac on ac.employee_id = s.employee_id and coalesce(ac.locked, 0) = 0
         where not exists (select 1 from public.shift_report_parts pt where pt.report_id = r.id and pt.part = u.p and pt.claimed_by is not null)
      ) z group by z.acc
    loop
      perform public.app__notify(rc.acc, 'Phiếu chốt ca chưa xong · ' || public.app__ca_title(r),
        'Còn phần chưa bấm Xong: ' || rc.lbls || '. Ca hết lúc ' || to_char(e, 'HH24:MI')
        || '. Nhận phần còn trống, làm xong rồi bấm "Xong phần này" — đủ các phần thì phiếu tự hoàn thành.', '/ca/phieu?id=' || r.id);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

-- Hẹn giờ trên máy chủ (5 phút một lần). Không bật được thì web tự gọi khi nhân viên mở trang.
do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'nhac-phieu-ca';
  perform cron.schedule('nhac-phieu-ca', '*/5 * * * *', 'select public.app_ca_part_tick()');
exception when others then
  raise notice 'Không bật được hẹn giờ pg_cron: %', sqlerrm;
end $cron$;

-- ---------------------------------------------------------------- Sao lưu: thêm bảng phần việc
create or replace function public.app__backup_tables() returns text[]
language sql immutable as $$ select array[
  'shift_reports','shift_report_moves','shift_report_staff','handover_items','shift_report_goods','shift_report_photos',
  'shift_report_checks','shift_debts','daily_cash_closings','shift_report_recon','shift_recon_log',
  'shift_report_results','shift_shortfalls',
  'delivery_invoices','delivery_invoice_files','delivery_receipt_photos','delivery_receipt_items','bank_shift_balances',
  'bank_accounts','bank_account_balances','bank_late_receipts',
  'meetings','tasks','task_events',
  'docs','doc_reads','employee_commitments',
  'training_programs','training_items','trainings','training_marks','training_days',
  'support_requests','support_messages','support_reads',
  'fin_categories','fin_branch_managers','fin_entries','fin_move_cats','fin_month_closes','fin_close_log',
  'shift_report_parts'] $$;

-- ---------------------------------------------------------------- Quyền gọi hàm
revoke execute on function public.app__ca_part_label(text), public.app__ca_parts_need(bigint), public.app__ca_end_at(public.shift_reports),
  public.app__ca_part_can(bigint), public.app__ca_part_guard(bigint, text), public.app__ca_part_check(bigint, text),
  public.app__ca_auto_recon(bigint, bigint), public.app__ca_finish(bigint, bigint), public.app__ca_save_core(bigint, jsonb),
  public.app__backup_tables(), public.app__nh_staff_can(public.delivery_invoices, public.shift_reports)
  from public, anon, authenticated;
revoke execute on function public.app_ca_parts(bigint), public.app_ca_part_claim(bigint, text, boolean), public.app_ca_part_release(bigint, text),
  public.app_ca_part_done(bigint, text, boolean), public.app_ca_part_tick(), public.app_ca_complete(bigint), public.app_ca_save(bigint, jsonb)
  from public, anon;
grant execute on function public.app_ca_parts(bigint), public.app_ca_part_claim(bigint, text, boolean), public.app_ca_part_release(bigint, text),
  public.app_ca_part_done(bigint, text, boolean), public.app_ca_part_tick(), public.app_ca_complete(bigint), public.app_ca_save(bigint, jsonb)
  to authenticated;
