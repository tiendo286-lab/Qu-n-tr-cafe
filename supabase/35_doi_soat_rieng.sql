-- =====================================================================
-- BƯỚC 35: TÁCH RIÊNG PHẦN ĐỐI SOÁT — anh Tiến chốt 11/11/2026 (tai_lieu/TINH_NANG_DA_CHOT.md mục 5j). Chạy sau 34. Chạy lại nhiều lần không sao.
--  * app_ds_todo: gom MỌI việc chờ đối soát cho tab Đối soát (Quản lý ca):
--      phiếu ca chờ đối soát · dòng thu chi ở phiếu ca chờ đối soát (3 tháng gần nhất) · hàng nhận chưa đối soát ·
--      phiếu trừ lương có nhân viên giải trình mà quản lý chưa quyết.
--  * Trang Đối soát ca từng bước dùng lại các hàm đối soát sẵn có (không đổi dữ liệu).
-- =====================================================================

create or replace function public.app_ds_todo(p_branch bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; brs bigint[]; f text; t text;
begin
  a := public.app__need('doi_soat');
  select coalesce(array_agg(b.id order by b.sort_order), '{}') into brs from public.branches b
   where b.status = 'Đang hoạt động' and public.app__tc_can(b.id) and (p_branch is null or b.id = p_branch);
  t := to_char(public.vn_now(), 'YYYY-MM-DD');
  f := to_char(date_trunc('month', public.vn_now()) - interval '2 months', 'YYYY-MM-DD');
  return jsonb_build_object(
    'from', f, 'today', t,
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code), 'name', b.name) order by b.sort_order)
                 from public.branches b where b.status = 'Đang hoạt động' and public.app__tc_can(b.id)), '[]'),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'name', c.name, 'active', c.active = 1) order by c.kind, c.sort_order, c.name)
                 from public.fin_categories c), '[]'),
    -- 1. phiếu ca đã hoàn thành, chưa hoàn thành đối soát
    'reports', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'branch_id', r.branch_id, 'date', r.work_date, 'shift', r.shift,
                  'recon_status', r.recon_status, 'checks', (select count(*) from public.shift_report_checks c where c.report_id = r.id),
                  'cash_left', (m ->> 'tm_left')::bigint, 'transfer_left', (m ->> 'ck_left')::bigint, 'ck_basis', m ->> 'ck_basis',
                  'revenue', r.total_revenue, 'completed_by', public.app__acc_name(r.completed_by))
                  order by r.work_date, array_position(public.app__shifts(), r.shift), r.branch_id)
                 from (select x.*, public.app__ca_money(x.id) m from public.shift_reports x
                        where x.status = 'hoan_thanh' and x.recon_status <> 'hoan_thanh' and x.branch_id = any(brs)
                        order by x.work_date limit 300) r), '[]'),
    -- 2. dòng thu chi ở phiếu ca chờ đối soát (3 tháng gần nhất)
    'moves', coalesce((select jsonb_agg(jsonb_build_object('src', 'ca', 'report_id', m.report_id, 'mkey', m.mkey, 'branch_id', m.branch_id,
                  'date', m.work_date, 'shift', m.shift, 'kind', case when m.amount < 0 then 'chi' else 'thu' end, 'pay', m.pay,
                  'amount', abs(m.amount), 'note', m.note, 'category_id', fc.category_id,
                  'excluded', coalesce(fc.excluded, case when m.amount > 0 then 1 else 0 end) = 1, 'status', 'cho',
                  'by', public.app__acc_name(m.created_by), 'locked', public.app__fin_locked(m.branch_id, m.work_date))
                  order by m.work_date, m.branch_id, m.ord)
                 from public.app__tc_moves(null, f, t) m
                 left join public.fin_move_cats fc on fc.report_id = m.report_id and fc.mkey = m.mkey
                where m.branch_id = any(brs) and coalesce(fc.checked, 0) = 0), '[]'),
    -- 3. hàng đã nhận còn món chưa đối soát
    'goods', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'branch_id', i.branch_id, 'doc_no', i.doc_no, 'kind', i.kind,
                  'report_id', i.received_report_id, 'report_status', r.status, 'date', r.work_date, 'shift', r.shift,
                  'received_by', public.app__acc_name(i.received_by), 'received_at', i.received_at,
                  'n_lines', (select count(*) from public.delivery_lines l where l.invoice_id = i.id),
                  'n_unchecked', (select count(*) from public.delivery_lines l where l.invoice_id = i.id and l.checked_at is null))
                  order by r.work_date, i.id)
                 from public.delivery_invoices i join public.shift_reports r on r.id = i.received_report_id
                where i.state <> 'dang_chuyen' and i.branch_id = any(brs)
                  and exists (select 1 from public.delivery_lines l where l.invoice_id = i.id and l.checked_at is null)), '[]'),
    -- 4. phiếu trừ lương có giải trình, quản lý chưa quyết (còn "mặc định" hoặc chưa xử lý)
    'ka', coalesce((select jsonb_agg(public.app__ka_json(s) order by s.reply_at)
                 from public.shift_shortfalls s join public.shift_reports r on r.id = s.report_id
                where r.branch_id = any(brs) and s.reply is not null and (s.auto_tru or s.status = 'chua_xu_ly')), '[]'));
end $$;

revoke execute on function public.app_ds_todo(bigint) from public, anon;
grant execute on function public.app_ds_todo(bigint) to authenticated;
