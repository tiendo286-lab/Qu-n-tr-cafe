-- Bước 157 (19/11/2026, anh Tiến chốt): Đối soát Fabi hiện NGAY danh sách nợ của ca dưới ô Nợ bill (không chờ Xác nhận Fabi).
-- Sổ thu chi (app_stc_month) trả thêm khoá 'ca_debts' cho mọi ca của tháng:
--   t = 'moi': khoản nợ ghi trong ca (dòng gốc, split_from is null). amount = số ban đầu (cộng cả cây tách khi khách trả một phần),
--              left = phần còn nợ (các dòng trong cây chưa đóng).
--   t = 'tra': khách trả nợ cũ trong ca (closed_report_id = ca, nợ không phải của chính ca đó); pm = collect_kind, from = ca gốc.
-- Vá thẳng bản đang chạy (như tệp 139): chèn trước khoá 'items'; đã có thì bỏ qua; không thấy chỗ chèn thì dừng.
-- Chỉ xem, không đổi tiền / quyền. Bài thử: kiem_tra/so_thu_chi_140.sql. Chạy lại nhiều lần không sao.
do $$
declare d text;
  anchor text := $q$'items', coalesce((select jsonb_agg(jsonb_build_object('id', v.id$q$;
  add text := $q$'ca_debts', coalesce((with recursive cr as (
          select x.id from public.shift_reports x where x.branch_id = p_branch and x.work_date between d0 and d1),
        tree as (
          select g.id root, g.id, g.amount, g.closed_at from public.shift_debts g
           where g.report_id in (select id from cr) and g.split_from is null and g.amount > 0
          union all
          select t.root, c.id, c.amount, c.closed_at from public.shift_debts c join tree t on c.split_from = t.id)
      select jsonb_agg(q.z order by q.rid, q.t, q.did) from (
        select jsonb_build_object('report_id', g.report_id, 't', 'moi', 'id', g.id, 'who', g.table_name, 'kind', coalesce(g.kind, 'bill'),
                 'amount', s.amt, 'left', s.lft, 'pm', null, 'from', null) z, g.report_id rid, 'moi' t, g.id did
          from public.shift_debts g
          join (select root, sum(amount) amt, coalesce(sum(amount) filter (where closed_at is null), 0) lft from tree group by root) s on s.root = g.id
        union all
        select jsonb_build_object('report_id', g.closed_report_id, 't', 'tra', 'id', g.id, 'who', g.table_name, 'kind', coalesce(g.kind, 'bill'),
                 'amount', g.amount, 'left', 0, 'pm', g.collect_kind,
                 'from', case when o.id is not null then 'ca ' || o.shift || ' ' || to_char(o.work_date::date, 'DD/MM') else 'quản lý ghi' end),
               g.closed_report_id, 'tra', g.id
          from public.shift_debts g left join public.shift_reports o on o.id = g.report_id
         where g.closed_report_id in (select id from cr) and coalesce(g.report_id, 0) <> g.closed_report_id and g.amount > 0) q), '[]'),
    $q$;
begin
  d := pg_get_functiondef('public.app_stc_month(bigint,text)'::regprocedure);
  if position($q$'ca_debts', coalesce($q$ in d) = 0 then
    if position(anchor in d) = 0 then raise exception 'app_stc_month: không thấy chỗ chèn (items).'; end if;
    d := replace(d, anchor, add || anchor);
    execute d;
  end if;
end $$;

insert into public.app_migrations(file) values ('140_no_cua_ca.sql') on conflict (file) do nothing;
