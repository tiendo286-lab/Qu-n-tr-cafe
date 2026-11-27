-- 184 — Công ty AI: số liệu CHỈ ĐỌC cho phòng Kế toán và Kho chat trong ứng dụng Claude (anh Tiến duyệt 26/11/2026).
-- Bốn hàm đọc cố định, không ghi gì, không nhận câu SQL tự do. Chỉ hàm Edge "ai-so-lieu" gọi được (qua service_role);
-- web (anon / authenticated) và chìa khoá máy Mac (ai_doc, ai_viec) KHÔNG gọi được.
-- Không đụng app_can, role_permissions, vùng khoá tiền đối soát. Chạy lại nhiều lần không lỗi.

-- 1) Doanh thu NET theo Fabi, từng ngày từng quán (tối đa 62 ngày)
create or replace function public.app__sl_doanh_thu(p_tu text, p_den text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare tu date := p_tu::date; den date := p_den::date;
begin
  if den < tu or den - tu > 62 then raise exception 'Khoảng ngày không hợp lệ (từ ≤ đến, tối đa 62 ngày).'; end if;
  return jsonb_build_object(
    'tu', to_char(tu, 'YYYY-MM-DD'), 'den', to_char(den, 'YYYY-MM-DD'),
    'nguon', 'Fabi — doanh thu NET theo ca đã đồng bộ vào Milano App',
    'ghi_chu', 'LLB (Lela Box) bán trên web riêng, không có trong số này. Ngày / quán không có dòng nghĩa là Fabi chưa đồng bộ, KHÔNG phải doanh thu 0.',
    'fabi_moi_nhat', (select max(work_date) from fabi_shifts),
    'theo_ngay', coalesce((
      select jsonb_agg(jsonb_build_object('ngay', x.ngay, 'quan', x.quan, 'so_ca', x.so_ca, 'net', x.net) order by x.ngay, x.bid)
      from (select f.work_date ngay, b.code quan, b.id bid, count(*) so_ca, sum(coalesce(f.net, 0)) net
              from fabi_shifts f join branches b on b.id = f.branch_id
             where f.work_date between to_char(tu, 'YYYY-MM-DD') and to_char(den, 'YYYY-MM-DD')
             group by f.work_date, b.code, b.id) x), '[]'::jsonb),
    'tong_theo_quan', coalesce((
      select jsonb_agg(jsonb_build_object('quan', x.quan, 'so_ngay', x.so_ngay, 'net', x.net) order by x.bid)
      from (select b.code quan, b.id bid, count(distinct f.work_date) so_ngay, sum(coalesce(f.net, 0)) net
              from fabi_shifts f join branches b on b.id = f.branch_id
             where f.work_date between to_char(tu, 'YYYY-MM-DD') and to_char(den, 'YYYY-MM-DD')
             group by b.code, b.id) x), '[]'::jsonb));
end $$;

-- 2) Lịch ca đã xếp (ai, ngày nào, ca nào, quán nào) — tối đa 45 ngày; p_quan = mã quán hoặc null (mọi quán)
create or replace function public.app__sl_lich_ca(p_tu text, p_den text, p_quan text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare tu date := p_tu::date; den date := p_den::date;
begin
  if den < tu or den - tu > 45 then raise exception 'Khoảng ngày không hợp lệ (từ ≤ đến, tối đa 45 ngày).'; end if;
  return jsonb_build_object(
    'tu', to_char(tu, 'YYYY-MM-DD'), 'den', to_char(den, 'YYYY-MM-DD'), 'quan', coalesce(p_quan, 'tất cả'),
    'nguon', 'Lịch ca trên web Milano — chỉ các ô ĐÃ XẾP',
    'ghi_chu', 'FULL TIME CA SÁNG = Sáng + Chiều; FULL TIME CA TỐI = Chiều + Tối. Đây là lịch xếp, chưa phải công thực tế.',
    'ca', coalesce((
      select jsonb_agg(jsonb_build_object('ngay', to_char(x.ngay, 'YYYY-MM-DD'), 'quan', x.quan, 'ca', x.ca, 'ma_nv', x.ma_nv, 'ten', x.ten)
                       order by x.ngay, x.bid, x.ca, x.ten)
      from (select (w.start_date::date + e.weekday) ngay, b.code quan, b.id bid, e.shift ca, p.code ma_nv,
                   coalesce(p.name, '#' || e.employee_id) ten
              from weekly_schedule_entries e
              join weeks w on w.id = e.week_id
              join branches b on b.id = e.branch_id
              left join employees p on p.id = e.employee_id
             where e.state = 'ĐÃ XẾP'
               and w.start_date::date between tu - 6 and den
               and (w.start_date::date + e.weekday) between tu and den
               and (p_quan is null or b.code = p_quan)) x), '[]'::jsonb));
end $$;

-- 3) Danh sách nhân viên đang làm (không có lương, số điện thoại, giấy tờ)
create or replace function public.app__sl_nhan_vien() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nguon', 'Danh sách nhân viên trên web Milano — chỉ người Đang làm',
    'nhan_vien', coalesce(jsonb_agg(jsonb_build_object('ma', e.code, 'ten', e.name, 'bac', e.rank, 'vi_tri', e.preferred_role,
                                                         'ngay_vao', e.start_date) order by e.code), '[]'::jsonb))
    from employees e where e.status = 'Đang làm'
$$;

-- 4) Hàng kho tổng giao cho các quán: từng hoá đơn + tổng theo quán và mặt hàng (tối đa 62 ngày)
create or replace function public.app__sl_giao_hang(p_tu text, p_den text, p_quan text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare tu date := p_tu::date; den date := p_den::date;
begin
  if den < tu or den - tu > 62 then raise exception 'Khoảng ngày không hợp lệ (từ ≤ đến, tối đa 62 ngày).'; end if;
  return jsonb_build_object(
    'tu', to_char(tu, 'YYYY-MM-DD'), 'den', to_char(den, 'YYYY-MM-DD'), 'quan', coalesce(p_quan, 'tất cả'),
    'nguon', 'Hoá đơn giao hàng kho → quán trên web Milano',
    'hoa_don', coalesce((
      select jsonb_agg(jsonb_build_object('ngay', i.work_date, 'quan', b.code, 'so_hd', i.doc_no, 'loai', i.kind, 'trang_thai', i.state,
                                          'tong_tien', i.total, 'da_nhan', i.received_at is not null) order by i.work_date, b.id, i.id)
        from delivery_invoices i join branches b on b.id = i.branch_id
       where i.work_date between to_char(tu, 'YYYY-MM-DD') and to_char(den, 'YYYY-MM-DD') and (p_quan is null or b.code = p_quan)), '[]'::jsonb),
    'theo_hang', coalesce((
      select jsonb_agg(jsonb_build_object('quan', x.quan, 'ma_hang', x.ma, 'hang', x.ten, 'dvt', x.dvt, 'so_luong', x.sl, 'thanh_tien', x.tien)
                       order by x.bid, x.ten)
      from (select b.code quan, b.id bid, l.code ma, max(l.name) ten, max(l.unit) dvt, sum(l.qty_invoice) sl, sum(coalesce(l.amount, 0)) tien
              from delivery_lines l join delivery_invoices i on i.id = l.invoice_id join branches b on b.id = i.branch_id
             where i.work_date between to_char(tu, 'YYYY-MM-DD') and to_char(den, 'YYYY-MM-DD') and (p_quan is null or b.code = p_quan)
             group by b.code, b.id, l.code) x), '[]'::jsonb));
end $$;

revoke all on function public.app__sl_doanh_thu(text, text), public.app__sl_lich_ca(text, text, text),
  public.app__sl_nhan_vien(), public.app__sl_giao_hang(text, text, text) from public, anon, authenticated;
grant execute on function public.app__sl_doanh_thu(text, text), public.app__sl_lich_ca(text, text, text),
  public.app__sl_nhan_vien(), public.app__sl_giao_hang(text, text, text) to service_role;

insert into public.app_migrations(file) values ('184_ai_so_lieu.sql') on conflict (file) do nothing;
