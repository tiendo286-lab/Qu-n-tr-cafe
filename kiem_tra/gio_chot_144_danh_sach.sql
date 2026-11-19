-- Danh sách CHÍNH XÁC các ca sẽ đổi giờ khi chạy bù (duyệt mã: chạy thật app__ca_gio_fabi_all(false) rồi so trước / sau, tự hoàn tác).
-- Gửi SAU nội dung tệp 144 nếu 144 chưa chạy thật. Kết quả: mảng {report, branch, date, shift, start_old, start_new, end_old, end_new}.
do $$
declare rep jsonb;
begin
  create temp table _g0 on commit drop as
    select r.id, r.branch_id, r.work_date, r.shift, public.app__ca_eff(r.id) ->> 'rev_start' s0, public.app__ca_eff(r.id) ->> 'rev_end' e0
      from public.shift_reports r where r.status = 'hoan_thanh' and not public.app__fin_locked(r.branch_id, r.work_date);
  perform public.app__ca_gio_fabi_all(false);
  select coalesce(jsonb_agg(jsonb_build_object('report', g.id, 'branch', (select coalesce(b.display_code, b.code) from public.branches b where b.id = g.branch_id),
           'date', g.work_date, 'shift', g.shift, 'start_old', g.s0, 'start_new', x.s1, 'end_old', g.e0, 'end_new', x.e1)
           order by g.work_date, g.branch_id, array_position(public.app__shifts(), g.shift)), '[]')
    into rep
    from _g0 g cross join lateral (select public.app__ca_eff(g.id) ->> 'rev_start' s1, public.app__ca_eff(g.id) ->> 'rev_end' e1) x
   where g.s0 is distinct from x.s1 or g.e0 is distinct from x.e1;
  raise exception 'REPORT>> %', rep;
end $$;
