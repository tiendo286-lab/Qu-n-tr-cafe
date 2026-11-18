-- Bước 143 (18/11/2026): Sổ thu chi mới — Quỹ ngoài (chỉ Chủ), đợt 1 CHỈ XEM
-- Thiết kế: tai_lieu/superpowers/specs/2026-11-18-so-thu-chi-moi-design.md mục 3.7 · Bài thử: kiem_tra/so_thu_chi_127.sql phần (g)
-- app_stc_ext(tháng): khoản của Quỹ ngoài cùng dạng app_stc_month (ca_id luôn null).
--   * Tiền các cơ sở chuyển về (phiếu rút cũ) → sổ thu, cột luân chuyển, recv cho|da. Tồn gồm cả khoản chờ nhận (tiền đã rời cơ sở).
--   * Chi / thu ngoài (ext_entries) → kèm chữ cách chia cho cơ sở.

create or replace function public.app_stc_ext(p_month text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a public.accounts := public.app_account(); st text := public.app__fund_start(); d0 text; d1 text; res jsonb;
begin
  if a.id is null then raise exception 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'; end if;
  if coalesce(a.system_role, '') <> 'chu' then raise exception 'Quỹ ngoài: chỉ Chủ xem được.'; end if;
  if coalesce(p_month, '') !~ '^\d{4}-\d{2}$' then raise exception 'Tháng không hợp lệ.'; end if;
  d0 := greatest(p_month || '-01', st);
  d1 := to_char((p_month || '-01')::date + interval '1 month' - interval '1 day', 'YYYY-MM-DD');
  with it as (
    select w.wdate d, 'thu' book, case when w.method = 'chuyen_khoan' then 'ck' else 'tm' end pm, 'lc' col, w.amount,
           'Từ ' || coalesce(b.display_code, b.code) || ' chuyển về' || case when w.note <> '' then ' · ' || w.note else '' end title,
           coalesce(public.app__acc_name(w.created_by), '') || ' tạo' meta, null::text cat, null::bigint cat_type, true checked, true no_cost,
           case when w.status = 'da_nhan' then 'Chủ đã nhận · khoá' else 'Chờ Chủ nhận' end status, coalesce(b.display_code, b.code) src_from,
           false to_qn, case when w.status = 'da_nhan' then 'da' else 'cho' end recv, null::text chia, 'w:' || w.id id, 'withdrawal' src
      from public.fund_withdrawals w join public.branches b on b.id = w.branch_id where w.wdate between st and d1
    union all
    select e.entry_date, case when e.kind = 'chi' then 'chi' else 'thu' end, case when e.pay_method = 'chuyen_khoan' then 'ck' else 'tm' end,
           case when e.kind = 'chi' then 'chi' else 'khac' end, e.amount, e.note, 'Chủ ghi', c.name, c.type_id, true, false, null, null, false, null,
           case e.alloc_mode when 'doanh_thu' then 'Theo tỉ lệ doanh thu tháng' when 'deu' then 'Chia đều các cơ sở'
                when 'mot' then '1 cơ sở: ' || coalesce((select coalesce(b.display_code, b.code) from public.branches b where b.id = e.alloc_branch), '?')
                when 'tu_nhap' then 'Tự nhập phần từng cơ sở' when 'kho_tong' then 'Không chia (đã tính theo từng hoá đơn kho tổng)'
                else coalesce(e.alloc_mode, 'Chưa chọn cách chia') end,
           'x:' || e.id, 'ext'
      from public.ext_entries e left join public.fin_categories c on c.id = e.category_id where e.entry_date between st and d1)
  select jsonb_build_object('month', p_month, 'from', d0, 'to', d1,
    'opening', jsonb_build_object(
      'tm', coalesce((select o.amount from public.ext_openings o where o.method = 'tien_mat'), 0)
            + coalesce((select sum(case when x.book = 'thu' then x.amount else -x.amount end) from it x where x.pm = 'tm' and x.d < d0), 0),
      'ck', coalesce((select o.amount from public.ext_openings o where o.method = 'chuyen_khoan'), 0)
            + coalesce((select sum(case when x.book = 'thu' then x.amount else -x.amount end) from it x where x.pm = 'ck' and x.d < d0), 0)),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'date', x.d, 'ca_id', null, 'book', x.book, 'pm', x.pm, 'col', x.col, 'amount', x.amount,
        'title', x.title, 'meta', x.meta, 'cat', x.cat, 'cat_type', x.cat_type, 'checked', x.checked, 'no_cost', x.no_cost, 'status', x.status,
        'from', x.src_from, 'who', null, 'to_qn', x.to_qn, 'recv', x.recv, 'chia', x.chia, 'src', x.src) order by x.d, x.id)
      from it x where x.d >= d0 and x.amount > 0), '[]'),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code)) order by b.sort_order)
                            from public.branches b where b.status = 'Đang hoạt động'), '[]'))
  into res;
  return res;
end $$;

revoke all on function public.app_stc_ext(text) from public, anon;
grant execute on function public.app_stc_ext(text) to authenticated;

insert into public.app_migrations(file) values ('128_so_thu_chi_quy_ngoai.sql') on conflict (file) do nothing;
