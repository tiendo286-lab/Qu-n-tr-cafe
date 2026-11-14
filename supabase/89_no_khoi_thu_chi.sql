-- Bước 96 (anh Tiến 14/11/2026): khoản nợ không nằm ở trang Thu chi nữa — xem ở tab Công nợ.
-- Dọn dữ liệu cũ: dòng "Khách mượn – …" tự thêm (nợ TM của khách) và khoản đã đổi thành cho vay (mục cũ, nay là Công nợ)
-- còn "chưa đối soát" → ghi Không tính + đã đối soát (không tính chi phí, không còn nằm trong việc chờ đối soát).
insert into public.fin_move_cats(report_id, mkey, category_id, excluded, by_account, at, checked, checked_by, checked_at)
select x.report_id, x.mkey, null, 1, null, public.vn_now_text(), 1, null, public.vn_now_text()
  from public.app__tc_moves_x(null, '2000-01-01', '2999-12-31') x
 where x.auto = 'muon' or exists (select 1 from public.branch_loans l where l.report_id = x.report_id and l.mkey = x.mkey)
on conflict (report_id, mkey) do update set excluded = 1, category_id = null, checked = 1,
   checked_at = coalesce(public.fin_move_cats.checked_at, excluded.checked_at)
 where public.fin_move_cats.checked = 0 or public.fin_move_cats.excluded = 0;

insert into public.app_migrations(file) values ('89_no_khoi_thu_chi.sql') on conflict (file) do nothing;
