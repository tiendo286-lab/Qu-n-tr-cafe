-- Bước 147 (19/11/2026, VÙNG KHOÁ — anh Tiến mở bằng mật khẩu 19/11): Sổ thu chi mới — đợt 3 Task 3: GÁN NỢ KHÁCH TRẢ cho ca dư.
-- Kế hoạch: tai_lieu/superpowers/plans/2026-11-19-so-thu-chi-moi-dot3.md · Bài thử: kiem_tra/so_thu_chi_132.sql (tự hoàn tác). Chạy lại nhiều lần không sao.
-- Ca dư tiền vì khách trả nợ cũ: quản lý chọn khoản nợ đang mở (ghi trước ca) → nợ đóng vào ca đó (closed_report_id, collect_kind = loại tiền dư).
--   Lệch của ca tính lại từ app__ca_money nên phần dư tự giảm; KHÔNG mở lại mục tiền đã duyệt (shift_report_results giữ nguyên).
--   Chặn: ca chưa chốt tiền, tháng đã chốt, đã có phiếu thu (Thu khác) cho phần dư, số gán > phần dư còn xử lý được, nợ ghi sau ca / trong chính ca.
--   Trả một phần: phần nợ còn lại tách thành khoản riêng (như đối soát cũ). Huỷ gán: nợ mở lại, gộp lại phần đã tách.

create or replace function public.app_stc_gap_debt(p_report bigint, p_item text, p_debt bigint, p_amount bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports; d public.shift_debts; o public.shift_reports; rs text;
  av bigint; old jsonb;
begin
  r := public.app__stc_gap_need(p_report);
  rs := public.app__stc_reason(p_reason);
  if coalesce(p_item, '') not in ('tien_mat', 'chuyen_khoan') then raise exception 'Chọn loại tiền dư (tiền mặt / chuyển khoản).'; end if;
  if exists (select 1 from public.gap_decisions g where g.report_id = p_report and g.item = p_item and g.kind = 'thu_khac') then
    raise exception 'Đã tạo phiếu thu — huỷ phiếu thu trước khi gán nợ.';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nhập số tiền khách trả lớn hơn 0.'; end if;
  av := public.app__stc_gap_avail(p_report, p_item, 'du');
  if p_amount > av then raise exception 'Ca dư chỉ còn % chờ xử lý.', public.app__vnd(av); end if;
  select * into d from public.shift_debts where id = p_debt for update;
  if d.id is null or d.closed_at is not null then raise exception 'Khoản nợ này đã được thu hoặc không còn.'; end if;
  if d.branch_id <> r.branch_id then raise exception 'Khoản nợ không thuộc cơ sở của ca này.'; end if;
  if coalesce(d.report_id, 0) = p_report then raise exception 'Đây là nợ phát sinh trong chính ca này.'; end if;
  if d.report_id is not null then
    select * into o from public.shift_reports where id = d.report_id;
    if (o.work_date, array_position(public.app__shifts(), o.shift)) >= (r.work_date, array_position(public.app__shifts(), r.shift)) then
      raise exception 'Khoản nợ ghi ở ca sau ca này.';
    end if;
  elsif left(d.created_at, 10) > r.work_date then
    raise exception 'Khoản nợ ghi sau ngày của ca này.';
  end if;
  if p_amount > d.amount then raise exception 'Khách trả nhiều hơn số nợ (%).', public.app__vnd(d.amount); end if;
  if p_amount < d.amount then   -- trả một phần: phần còn lại thành khoản nợ riêng
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, split_from, gap_report, gap_item, family, from_loan, fund_out, grp)
    values (d.branch_id, d.report_id, d.table_name, d.amount - p_amount, d.note, d.phone, d.created_by, d.created_at, d.kind, d.id, d.gap_report, d.gap_item, d.family, d.from_loan, d.fund_out, d.grp);
    update public.shift_debts set amount = p_amount where id = d.id;
  end if;
  update public.shift_debts set closed_at = public.vn_now_text(), closed_by = a.id, closed_report_id = p_report, collect_kind = p_item,
         close_note = 'Gán nợ khách trả (Sổ thu chi): ' || rs
   where id = p_debt;
  select to_jsonb(x) into old from public.shift_debts x where x.id = p_debt;
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
  values (p_report, 'gan_no', p_item, null, old, 'Sổ thu chi: ' || rs, a.id);
  perform public.app__stc_log(r.branch_id, 'collect', 'dc:' || p_debt, 'them', null, old, rs);
  perform public.app_log('stc_gan_no', 'report=' || p_report || ' debt=' || p_debt || ' ' || p_item || ' ' || p_amount || ' · ' || rs);
end $$;

create or replace function public.app__stc_debt_unassign(p_debt bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); d public.shift_debts; s public.shift_debts; r public.shift_reports; old jsonb; rs text := public.app__stc_reason(p_reason);
begin
  select * into d from public.shift_debts where id = p_debt for update;
  if d.id is null or d.closed_report_id is null or coalesce(d.close_note, '') not like 'Gán nợ khách trả%' then raise exception 'Không phải khoản gán nợ của Sổ thu chi.'; end if;
  r := public.app__stc_gap_need(d.closed_report_id);
  old := to_jsonb(d);
  update public.shift_debts set closed_at = null, closed_by = null, closed_report_id = null, collect_kind = null, close_note = null where id = p_debt;
  select * into s from public.shift_debts where split_from = p_debt and closed_at is null order by id desc limit 1 for update;
  if s.id is not null then   -- gộp lại phần đã tách khi gán một phần
    update public.shift_debts set amount = amount + s.amount where id = p_debt;
    delete from public.shift_debts where id = s.id;
  end if;
  insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
  values (r.id, 'huy_gan_no', d.collect_kind, old, null, 'Sổ thu chi: ' || rs, a.id);
  perform public.app__stc_log(r.branch_id, 'collect', 'dc:' || p_debt, 'xoa', old, null, rs);
  perform public.app_log('stc_huy_gan_no', 'report=' || r.id || ' debt=' || p_debt || ' · ' || rs);
end $$;

-- Huỷ thu ở Sổ thu chi: khoản gán nợ trong ca → huỷ gán; còn lại như cũ (thu nợ ngoài ca)
create or replace function public.app_stc_uncollect(p_debt bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare old jsonb; br bigint; rs text := public.app__stc_reason(p_reason);
begin
  select to_jsonb(d) into old from public.shift_debts d where d.id = p_debt;
  if old is null then raise exception 'Không tìm thấy khoản nợ.'; end if;
  if old ->> 'closed_report_id' is not null and coalesce(old ->> 'close_note', '') like 'Gán nợ khách trả%' then
    perform public.app__stc_debt_unassign(p_debt, rs); return;
  end if;
  br := (old ->> 'branch_id')::bigint;
  perform public.app__stc_need(br);
  perform public.app_cn_debt_uncollect(p_debt);
  perform public.app__stc_log(br, 'collect', 'dc:' || p_debt, 'xoa', old, null, rs);
end $$;

create or replace function public.app_stc_gap_undo(p_kind text, p_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare rid bigint; rs text := public.app__stc_reason(p_reason);
begin
  rid := case p_kind when 'tl' then (select report_id from public.shift_shortfalls where id = p_id)
                     when 'decision' then (select report_id from public.gap_decisions where id = p_id)
                     when 'match' then (select short_report from public.gap_matches where id = p_id)
                     when 'qc' then (select report_id from public.stc_gap_requests where id = p_id)
                     when 'debt' then (select closed_report_id from public.shift_debts where id = p_id and close_note like 'Gán nợ khách trả%') end;
  if rid is null then raise exception 'Không tìm thấy khoản cần huỷ.'; end if;
  perform public.app__stc_gap_need(rid);
  if p_kind = 'tl' then perform public.app_ka_delete(p_id, rs);
  elsif p_kind = 'decision' then perform public.app_gap_decision_delete(p_id);
  elsif p_kind = 'debt' then perform public.app__stc_debt_unassign(p_id, rs);
  elsif p_kind = 'match' then perform public.app_gap_match_delete(p_id);
  else delete from public.stc_gap_requests where id = p_id and status = 'cho_duyet'; end if;
  perform public.app_log('stc_huy_xu_ly_lech', p_kind || '=' || p_id || ' · ' || rs);
end $$;

create or replace function public.app_stc_month(p_branch bigint, p_month text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a public.accounts := public.app_account(); st text := public.app__fund_start(); d0 text; d1 text; br record; res jsonb;
begin
  if a.id is null then raise exception 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'; end if;
  if not public.app__fin_admin() then raise exception 'Đang chạy thử: chỉ Chủ và Quản lý tổng xem được.'; end if;
  if coalesce(p_month, '') !~ '^\d{4}-\d{2}$' then raise exception 'Tháng không hợp lệ.'; end if;
  d0 := greatest(p_month || '-01', st);
  d1 := to_char((p_month || '-01')::date + interval '1 month' - interval '1 day', 'YYYY-MM-DD');
  select b.id, coalesce(b.display_code, b.code) code, b.name into br from public.branches b where b.id = p_branch and b.status = 'Đang hoạt động';
  if br.id is null then raise exception 'Không tìm thấy cơ sở.'; end if;

  with r as materialized (   -- mỗi phiếu tính bản đối soát, ngân hàng, kế toán đúng 1 lần
    select x.id, x.work_date, x.shift, x.cash_mode, x.ql_counted, x.ipos_opening, x.opening_cash, x.total_revenue, x.pos_debt,
           public.app__ca_eff(x.id) e, public.app__kt_bank_json(x) b, public.app__ca_kt_state(x.id) kt,
           (select to_jsonb(f) from public.fabi_shifts f
             where f.report_id = x.id or (f.report_id is null and f.branch_id = x.branch_id and f.work_date = x.work_date and f.shift = x.shift)
             order by (f.report_id = x.id) desc nulls last limit 1) fb,
           (exists (select 1 from public.shift_report_results s where s.report_id = x.id and s.item = 'tien_mat')
            and exists (select 1 from public.shift_report_results s where s.report_id = x.id and s.item = 'chuyen_khoan')) mdone
      from public.shift_reports x
     where x.branch_id = p_branch and x.status = 'hoan_thanh' and x.work_date between st and d1),
  mv as (   -- khoản thu chi của phiếu (cùng cách đặt khoá mkey như app__tc_moves_x để nối nhóm / đối soát)
    select r.id rid, r.work_date, t.ord, (t.v ->> 'kind') pay, (t.v ->> 'amount')::bigint amt, coalesce(t.v ->> 'note', '') note,
           md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) || '#'
             || row_number() over (partition by r.id, md5((t.v ->> 'kind') || '|' || (t.v ->> 'amount') || '|' || coalesce(t.v ->> 'note', '')) order by t.ord) mkey,
           case when nullif(t.v ->> 'exchange_key', '') is not null then 'doi_tien' else t.v ->> 'auto' end auto
      from r cross join lateral jsonb_array_elements(coalesce(r.e -> 'moves', '[]'::jsonb)) with ordinality t(v, ord)
     where coalesce((t.v ->> 'amount')::bigint, 0) <> 0),
  it as (
    -- doanh thu (phần khách trả tiền mặt / chuyển khoản)
    select r.work_date d, r.id ca, 'thu' book, p.pm, 'dt' col, p.amt amount, 'Doanh thu ca ' || r.shift title,
           case when r.fb is null then 'Theo phiếu (chưa có file Fabi)' else 'Theo phiếu đã đối soát / Fabi' end meta,
           null::text cat, null::bigint cat_type, true checked, false no_cost, null::text status, null::text src_from, false to_qn, null::text recv,
           'f:' || r.id || ':' || p.pm id, 'dt' src
      from r cross join lateral (values ('tm', coalesce((r.e ->> 'pos_cash')::bigint, 0)), ('ck', coalesce((r.e ->> 'pos_transfer')::bigint, 0))) p(pm, amt)
     where p.amt > 0
    union all   -- khoản thu chi phiếu ca
    select mv.work_date, mv.rid, case when mv.amt < 0 then 'chi' else 'thu' end, case when mv.pay = 'chuyen_khoan' then 'ck' else 'tm' end,
           case when mv.auto = 'doi_tien' then 'lc' when mv.auto = 'muon' or dl.id is not null or ln.id is not null then 'no' when mv.amt < 0 then 'chi' else 'khac' end,
           abs(mv.amt), mv.note,
           case when mv.auto = 'luong' then 'Lương trả tiền mặt' when mv.auto = 'muon' then 'Khách mượn tiền két (Nợ TM)' when dl.id is not null then 'Đã thành nợ'
                when ln.id is not null then 'Đã thành cho vay' else 'Phiếu ca' end,
           c.name, c.type_id, coalesce(fc.checked, 0) = 1 or mv.auto in ('doi_tien', 'muon'), coalesce(fc.excluded, case when mv.amt > 0 then 1 else 0 end) = 1,
           null, null, false, null, 'm:' || mv.rid || ':' || mv.mkey, 'move'
      from mv left join public.fin_move_cats fc on fc.report_id = mv.rid and fc.mkey = mv.mkey
      left join public.fin_categories c on c.id = fc.category_id
      left join lateral (select d.id from public.shift_debts d where d.mv_report = mv.rid and d.mv_key = mv.mkey order by d.id limit 1) dl on true
      left join lateral (select l.id from public.branch_loans l where l.report_id = mv.rid and l.mkey = mv.mkey order by l.id limit 1) ln on true
    union all   -- nợ chuyển khoản phát sinh trong ca (cho nợ CK)
    select r.work_date, r.id, 'chi', 'ck', 'no', d.amount, 'Nợ CK – ' || d.table_name, 'Phiếu ca', null, null, true, true, null, null, false, null, 'dn:' || d.id, 'debt'
      from r join public.shift_debts d on d.report_id = r.id and d.kind = 'ck' and d.amount > 0
    union all   -- khách trả nợ trong ca
    select r.work_date, r.id, 'thu', case when d.collect_kind = 'chuyen_khoan' then 'ck' else 'tm' end, 'no', d.amount, d.table_name, case when d.close_note like 'Gán nợ khách trả%' then 'Gán nợ khách trả (quản lý)' else 'Khách trả nợ trong ca' end,
           null, null, true, true, null,
           (select 'ca ' || x.shift || ' ' || to_char(x.work_date::date, 'DD/MM') from public.shift_reports x where x.id = d.report_id), false, null, 'dc:' || d.id, 'debt'
      from r join public.shift_debts d on d.closed_report_id = r.id and d.collect_kind in ('tien_mat', 'chuyen_khoan')
    union all   -- quản lý thu nợ ngoài ca
    select left(d.closed_at, 10), null, 'thu', case when d.collect_kind = 'chuyen_khoan' then 'ck' else 'tm' end, 'no', d.amount, d.table_name, 'Quản lý thu ngoài ca',
           null, null, true, true, null,
           (select 'ca ' || x.shift || ' ' || to_char(x.work_date::date, 'DD/MM') from public.shift_reports x where x.id = d.report_id), false, null, 'dc:' || d.id, 'debt'
      from public.shift_debts d
     where d.branch_id = p_branch and d.closed_at is not null and d.closed_report_id is null and d.collect_kind in ('tien_mat', 'chuyen_khoan') and left(d.closed_at, 10) between st and d1
    union all   -- công nợ quản lý ghi, tiền đưa từ quỹ
    select left(d.created_at, 10), null, 'chi', case when d.kind = 'ck' then 'ck' else 'tm' end, 'no', d.amount,
           (case when d.kind = 'ck' then 'Nợ CK: ' else 'Nợ TM: ' end) || d.table_name, 'Quản lý ghi, tiền đưa từ quỹ', null, null, true, true, null, null, false, null, 'dn:' || d.id, 'debt'
      from public.shift_debts d where d.branch_id = p_branch and d.fund_out = 1 and d.report_id is null and left(d.created_at, 10) between st and d1
    union all   -- cho vay cũ (từ quỹ) và lần trả
    select l.loan_date, null, 'chi', case when l.method = 'chuyen_khoan' then 'ck' else 'tm' end, 'no', l.amount,
           case when l.kind = 'tra_ho' then 'Trả hộ Kho tổng' else 'Cho vay: ' || p.name end, 'Cho vay (cũ)', null, null, true, true, null, null, false, null, 'l:' || l.id, 'loan'
      from public.branch_loans l join public.loan_people p on p.id = l.person_id
     where l.branch_id = p_branch and l.report_id is null and l.from_debt is null and l.loan_date between st and d1
    union all
    select y.pay_date, null, 'thu', case when y.method = 'chuyen_khoan' then 'ck' else 'tm' end, 'no', y.amount, 'Trả nợ vay: ' || p.name, 'Cho vay (cũ)',
           null, null, true, true, null, null, false, null, 'lp:' || y.id, 'loan'
      from public.branch_loan_payments y join public.branch_loans l on l.id = y.loan_id join public.loan_people p on p.id = l.person_id
     where l.branch_id = p_branch and y.pay_date between st and d1
    union all   -- khoản quản lý tạo (kể cả phiếu chi chuyển khoản, điều chỉnh kiểm quỹ); quán chịu / thu khác từ lệch không đổi quỹ nên bỏ
    select e.entry_date, null, case when e.kind = 'chi' then 'chi' else 'thu' end, case when e.pay_method = 'chuyen_khoan' then 'ck' else 'tm' end,
           case when e.kind = 'chi' then 'chi' else 'khac' end, e.amount, e.note,
           case when bo.rid is not null then 'Phiếu chi chuyển khoản · ca ' || bo.shift || ' ' || to_char(bo.wd::date, 'DD/MM') else 'Quản lý tạo' end,
           c.name, c.type_id, true, false, null, null, false, null, 'e:' || e.id, 'entry'
      from public.fin_entries e left join public.fin_categories c on c.id = e.category_id
      left join lateral (select o.report_id rid, x.shift, x.work_date wd from public.shift_bank_outs o join public.shift_reports x on x.id = o.report_id
                          where o.fin_entry_id = e.id limit 1) bo on true
     where e.branch_id = p_branch and e.entry_date between st and d1 and not coalesce(e.no_fund, false)
    union all   -- nhân viên nộp bù khoản âm (tiền mặt)
    select left(s.status_at, 10), null, 'thu', 'tm', 'khac', s.amount, 'NV bù khoản âm: ' || coalesce(em.code || ' – ' || em.name, '?'), 'Nộp bù',
           null, null, true, true, null, null, false, null, 'k:' || s.id, 'shortfall'
      from public.shift_shortfalls s join public.shift_reports x on x.id = s.report_id left join public.employees em on em.id = s.employee_id
     where x.branch_id = p_branch and s.status = 'da_bu' and left(s.status_at, 10) between st and d1
    union all   -- luân chuyển quỹ tiền mặt ↔ tài khoản: 2 vế
    select t.tdate, null, v.book, v.pm, 'lc', t.amount,
           case when t.direction = 'tm_tk' then 'Nộp tiền mặt vào tài khoản' else 'Rút tài khoản ra tiền mặt' end || case when t.note <> '' then ' · ' || t.note else '' end,
           'Luân chuyển quỹ', null, null, true, true, null, null, false, null, 't:' || t.id || ':' || v.book, 'transfer'
      from public.fund_transfers t
      cross join lateral (values ('chi', case when t.direction = 'tm_tk' then 'tm' else 'ck' end), ('thu', case when t.direction = 'tm_tk' then 'ck' else 'tm' end)) v(book, pm)
     where t.branch_id = p_branch and t.tdate between st and d1
    union all   -- phiếu rút cũ = chuyển về Quỹ ngoài
    select w.wdate, null, 'chi', case when w.method = 'chuyen_khoan' then 'ck' else 'tm' end, 'lc', w.amount,
           'Chuyển về Quỹ ngoài' || case when w.note <> '' then ' · ' || w.note else '' end,
           case when w.kind = 'cuoi_thang' then 'Phiếu rút cuối tháng (cũ)' else 'Phiếu rút giữ hộ (cũ)' end,
           null, null, true, true, case when w.status = 'da_nhan' then 'Chủ đã nhận · khoá' else 'Chờ Chủ nhận' end, null, true,
           case when w.status = 'da_nhan' then 'da' else 'cho' end, 'w:' || w.id, 'withdrawal'
      from public.fund_withdrawals w where w.branch_id = p_branch and w.wdate between st and d1
  ),
  g as (   -- chênh lệch mỗi ca từ khoản ở trên
    select r.id, r.work_date, r.shift,
           (r.e ->> 'opening_cash')::bigint start_tm,
           case when r.cash_mode = 'ca' and r.ql_counted is not null then r.ql_counted else (r.e ->> 'cash_counted')::bigint end real_tm,
           case when coalesce((r.b ->> 'account_count')::int, 0) > 0 and (r.b ->> 'entered')::int = (r.b ->> 'account_count')::int then (r.b ->> 'received')::bigint end real_ck,
           coalesce((select sum(case when it.book = 'thu' then it.amount else -it.amount end) from it where it.ca = r.id and it.pm = 'tm'), 0) net_tm,
           coalesce((select sum(case when it.book = 'thu' then it.amount else -it.amount end) from it where it.ca = r.id and it.pm = 'ck'), 0) net_ck
      from r),
  gs as (select * from public.app__gap_rows(p_branch, d0, d1)),
  lech as (
    select g.work_date d, g.id ca, case when v.gap > 0 then 'thu' else 'chi' end book, v.pm, 'lech' col, greatest(abs(v.gap) - coalesce((select sum(mm.amount) from public.gap_matches mm where mm.status = 'da_duyet' and mm.item = case when v.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end
                     and ((v.gap < 0 and mm.short_report = g.id) or (v.gap > 0 and mm.over_report = g.id))), 0), 0) amount,
           case when v.gap > 0 then 'Ca dư tiền' else 'Ca thiếu tiền' end title,
           case when v.pm = 'tm' then 'Tiền mặt thực tế ' || public.app__vnd(g.real_tm) else 'Ngân hàng nhận ' || public.app__vnd(g.real_ck) end meta,
           null::text cat, null::bigint cat_type, true checked, true no_cost,
           coalesce((select case gs.state when 'xong' then 'Đã xử lý' when 'du' then 'Chờ xử lý (dư)' when 'cho_no' then 'Chờ khách trả nợ'
                                 when 'cho_tien' then 'Chờ tiền về' else 'Chờ xử lý · chưa làm phiếu trừ tiền' end
                       from gs where gs.report_id = g.id and gs.item = case when v.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end limit 1),
                    case when abs(v.gap) <= 5000 then 'Lệch nhỏ ≤ 5.000 (coi như khớp)' else null end)
           || case when exists (select 1 from public.gap_matches mm where mm.status = 'cho_duyet' and mm.item = case when v.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end and (mm.short_report = g.id or mm.over_report = g.id))
                     or exists (select 1 from public.stc_gap_requests q where q.status = 'cho_duyet' and q.report_id = g.id and q.item = case when v.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end)
                   then ' · ⏳ chờ Chủ duyệt' else '' end status,
           null::text src_from, false to_qn, null::text recv, 'g:' || g.id || ':' || v.pm id, 'gap' src
      from g cross join lateral (values ('tm', g.real_tm - g.start_tm - g.net_tm), ('ck', g.real_ck - g.net_ck)) v(pm, gap)
     where v.gap is not null and v.gap <> 0),
  allit as (select * from it union all select * from lech),
  ed as (select e.*, public.app__acc_name(e.by_account) by_name from public.stc_edits e where e.branch_id = p_branch),
  vd as (   -- khoản cũ đã bị sửa / xoá: hiện gạch ngang, không cộng
    select v.*, ed.action v_action, ed.by_name v_by, ed.at v_at, ed.reason v_reason
      from ed cross join lateral (
        select ed.old ->> 'entry_date' d, null::bigint ca, case when ed.old ->> 'kind' = 'chi' then 'chi' else 'thu' end book,
               case when ed.old ->> 'pay_method' = 'chuyen_khoan' then 'ck' else 'tm' end pm, case when ed.old ->> 'kind' = 'chi' then 'chi' else 'khac' end col,
               (ed.old ->> 'amount')::bigint amount, ed.old ->> 'note' title, 'Quản lý tạo' meta, ed.old ->> 'category' cat, 'v:' || ed.id id, 'entry' src
         where ed.kind = 'entry'
        union all
        select ed.old ->> 'tdate', null, l.book, l.pm, 'lc', (ed.old ->> 'amount')::bigint,
               case when ed.old ->> 'direction' = 'tm_tk' then 'Nộp tiền mặt vào tài khoản' else 'Rút tài khoản ra tiền mặt' end || case when coalesce(ed.old ->> 'note', '') <> '' then ' · ' || (ed.old ->> 'note') else '' end,
               'Luân chuyển quỹ', null, 'v:' || ed.id || ':' || l.book, 'transfer'
          from (values ('chi', case when ed.old ->> 'direction' = 'tm_tk' then 'tm' else 'ck' end), ('thu', case when ed.old ->> 'direction' = 'tm_tk' then 'ck' else 'tm' end)) l(book, pm)
         where ed.kind = 'transfer'
        union all
        select left(ed.old ->> 'created_at', 10), null, 'chi', case when ed.old ->> 'kind' = 'ck' then 'ck' else 'tm' end, 'no', (ed.old ->> 'amount')::bigint,
               (case when ed.old ->> 'kind' = 'ck' then 'Nợ CK: ' else 'Nợ TM: ' end) || (ed.old ->> 'table_name'), 'Quản lý ghi, tiền đưa từ quỹ', null, 'v:' || ed.id, 'debt'
         where ed.kind = 'debt'
        union all
        select coalesce((select x.work_date from public.shift_reports x where x.id = (ed.old ->> 'closed_report_id')::bigint), left(ed.old ->> 'closed_at', 10)), (ed.old ->> 'closed_report_id')::bigint,
               'thu', case when ed.old ->> 'collect_kind' = 'chuyen_khoan' then 'ck' else 'tm' end, 'no', (ed.old ->> 'amount')::bigint,
               ed.old ->> 'table_name', case when ed.old ->> 'closed_report_id' is not null then 'Gán nợ khách trả (quản lý)' else 'Quản lý thu ngoài ca' end, null, 'v:' || ed.id, 'debt'
         where ed.kind = 'collect'
        union all
        select ed.old ->> 'date', (ed.old ->> 'ca_id')::bigint, ed.old ->> 'book', ed.old ->> 'pm', ed.old ->> 'col', (ed.old ->> 'amount')::bigint,
               ed.old ->> 'title', 'Phiếu ca', ed.old ->> 'cat', 'v:' || ed.id, 'move'
         where ed.kind = 'move') v
     where ed.action in ('sua', 'xoa') and ed.old is not null),
  oldf as (   -- Sổ quỹ cũ: số dư cuối mỗi ngày (để so)
    select f.d, sum(f.amount) filter (where f.method = 'tien_mat') tm, sum(f.amount) filter (where f.method = 'chuyen_khoan') ck
      from public.app__fund_rows(p_branch, st, least(d1, to_char(public.vn_now(), 'YYYY-MM-DD'))) f group by f.d)
  select jsonb_build_object(
    'branch', jsonb_build_object('id', br.id, 'code', br.code, 'name', br.name),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code)) order by b.sort_order)
                            from public.branches b where b.status = 'Đang hoạt động'), '[]'),
    'owner', a.system_role = 'chu',
    'month', p_month, 'from', d0, 'to', d1, 'locked', coalesce(public.app__fin_locked(p_branch, d0), false),
    'opening', jsonb_build_object(
       'tm', coalesce((select o.amount from public.fund_openings o where o.branch_id = p_branch and o.method = 'tien_mat'), 0)
             + coalesce((select sum(case when x.book = 'thu' then x.amount else -x.amount end) from allit x where x.pm = 'tm' and x.d < d0), 0),
       'ck', coalesce((select o.amount from public.fund_openings o where o.branch_id = p_branch and o.method = 'chuyen_khoan'), 0)
             + coalesce((select sum(case when x.book = 'thu' then x.amount else -x.amount end) from allit x where x.pm = 'ck' and x.d < d0), 0)),
    'cas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'date', r.work_date, 'shift', r.shift,
        'staff', (select string_agg(em.name, ', ' order by em.code) from jsonb_array_elements(coalesce(r.e -> 'staff', '[]'::jsonb)) s
                    join public.employees em on em.id = (s ->> 'employee_id')::bigint where coalesce((s ->> 'worked')::boolean, true)),
        'cash_mode', coalesce(r.cash_mode, 'ngay'), 'ql_counted', r.ql_counted, 'nv_counted', (r.e ->> 'cash_counted')::bigint,
        'start_tm', g.start_tm, 'real_tm', g.real_tm,
        'nv', jsonb_build_object('opening', coalesce(r.ipos_opening, r.opening_cash), 'revenue', r.total_revenue, 'debt', coalesce(r.pos_debt, 0)),
        'fabi', jsonb_build_object('has', r.fb is not null, 'opening', (r.fb ->> 'dau')::bigint, 'revenue', (r.fb ->> 'net')::bigint,
                  'tm', (r.fb ->> 'tm')::bigint, 'ck', (r.fb ->> 'ck')::bigint, 'debt', coalesce((r.fb ->> 'no')::bigint, 0),
                  'edited_bills', coalesce(jsonb_array_length(case when jsonb_typeof(r.fb -> 'sua') = 'array' then r.fb -> 'sua' end), 0)),
        'bank_ck', g.real_ck, 'kt_wait', not coalesce((r.kt ->> 'ready')::boolean, true), 'kt_missing', r.kt -> 'missing',
        'recon_money_done', r.mdone) order by r.work_date, array_position(public.app__shifts(), r.shift))
      from r join g on g.id = r.id where r.work_date >= d0), '[]'),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'date', v.d, 'ca_id', v.ca, 'book', v.book, 'pm', v.pm, 'col', v.col, 'amount', v.amount,
        'title', v.title, 'meta', v.meta, 'cat', v.cat, 'void', true, 'src', v.src,
        'void_info', jsonb_build_object('action', v.v_action, 'by', v.v_by, 'at', v.v_at, 'reason', v.v_reason)) order by v.d, v.id)
      from vd v where v.d >= d0 and v.amount > 0), '[]')
      || coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'date', x.d, 'ca_id', x.ca, 'book', x.book, 'pm', x.pm, 'col', x.col, 'amount', x.amount,
        'title', x.title, 'meta', x.meta, 'cat', x.cat, 'cat_type', x.cat_type, 'checked', x.checked, 'no_cost', x.no_cost, 'status', x.status,
        'from', x.src_from, 'who', null, 'to_qn', x.to_qn, 'recv', x.recv, 'src', x.src,
        'edit', (select jsonb_build_object('action', e.action, 'by', e.by_name, 'at', e.at, 'reason', e.reason, 'old_amount', (e.old ->> 'amount')::bigint)
                   from ed e where e.ref = case when x.id like 'm:%' then x.id else split_part(x.id, ':', 1) || ':' || split_part(x.id, ':', 2) end and e.action in ('them', 'sua') order by e.id desc limit 1),

        'gross', case when x.col = 'lech' then x.amount + coalesce((select sum(mm.amount) from public.gap_matches mm where mm.status = 'da_duyet' and mm.item = case when x.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end
                   and ((x.book = 'chi' and mm.short_report = x.ca) or (x.book = 'thu' and mm.over_report = x.ca))), 0) end,
        'gap', case when x.col = 'lech' then (select jsonb_build_object('item', s.item, 'kind', s.kind, 'total', s.total, 'remain', s.remain,
            'avail', greatest(s.remain - s.mp - coalesce((select sum(q.amount) from public.stc_gap_requests q where q.report_id = x.ca and q.item = s.item and q.status = 'cho_duyet'), 0), 0),
            'people', (select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name) order by e.code) from public.shift_report_staff st join public.employees e on e.id = st.employee_id
                        where st.report_id = x.ca and coalesce(st.worked, 1) = 1),
            'tl', (select jsonb_agg(jsonb_build_object('id', sf.id, 'name', e.name, 'amount', sf.amount, 'status', sf.status) order by sf.id) from public.shift_shortfalls sf
                     left join public.employees e on e.id = sf.employee_id where sf.report_id = x.ca and sf.item = s.item and sf.status <> 'huy'),
            'decisions', (select jsonb_agg(jsonb_build_object('id', gd.id, 'kind', gd.kind, 'amount', gd.amount) order by gd.id) from public.gap_decisions gd where gd.report_id = x.ca and gd.item = s.item),
            'matches', (select jsonb_agg(jsonb_build_object('id', mm.id, 'amount', mm.amount, 'status', mm.status, 'side', case when mm.short_report = x.ca then 'thieu' else 'du' end,
                          'with', (select 'ca ' || o.shift || ' ' || to_char(o.work_date::date, 'DD/MM') from public.shift_reports o where o.id = case when mm.short_report = x.ca then mm.over_report else mm.short_report end)) order by mm.id)
                        from public.gap_matches mm where mm.item = s.item and (mm.short_report = x.ca or mm.over_report = x.ca)),
            'qc_wait', (select jsonb_agg(jsonb_build_object('id', q.id, 'amount', q.amount, 'by', public.app__acc_name(q.created_by))) from public.stc_gap_requests q
                         where q.report_id = x.ca and q.item = s.item and q.status = 'cho_duyet'),
            'cands', (select jsonb_agg(jsonb_build_object('report', o.report_id, 'label', 'ca ' || o.shift || ' ' || to_char(o.work_date::date, 'DD/MM'),
                         'amount', greatest(o.remain - o.mp - coalesce((select sum(q.amount) from public.stc_gap_requests q where q.report_id = o.report_id and q.item = o.item and q.status = 'cho_duyet'), 0), 0)) order by o.work_date, o.report_id)
                       from gs o where o.item = s.item and o.kind <> s.kind and o.report_id <> x.ca and abs(o.work_date::date - s.work_date::date) <= 3 and o.remain > 0),
            'has_tl', exists (select 1 from public.shift_shortfalls sf where sf.report_id = x.ca and sf.item = s.item and sf.status <> 'huy'),
            'has_thu', exists (select 1 from public.gap_decisions gd where gd.report_id = x.ca and gd.item = s.item and gd.kind = 'thu_khac'),
            'debts', (select jsonb_agg(jsonb_build_object('id', d.id, 'who', d.table_name, 'amount', d.amount) order by d.id) from public.shift_debts d
                       where d.closed_report_id = x.ca and d.collect_kind = s.item and d.close_note like 'Gán nợ khách trả%'))
          from gs s where s.report_id = x.ca and s.item = case when x.pm = 'tm' then 'tien_mat' else 'chuyen_khoan' end limit 1) end,
        'can_edit', x.ca is null and not coalesce(public.app__fin_locked(p_branch, x.d), false)
                    and (x.src = 'transfer' or (x.src = 'entry' and x.meta = 'Quản lý tạo') or (x.src = 'debt' and (x.id like 'dn:%' or x.id like 'dc:%')))
         or (x.src = 'debt' and x.id like 'dc:%' and x.meta = 'Gán nợ khách trả (quản lý)' and not coalesce(public.app__fin_locked(p_branch, x.d), false))
         or (x.src = 'move' and x.meta = 'Phiếu ca' and x.col in ('chi', 'khac') and not coalesce(public.app__fin_locked(p_branch, x.d), false)
             and exists (select 1 from r where r.id = x.ca and r.mdone))) order by x.d, x.ca nulls last, x.id)
      from allit x where x.d >= d0 and (x.amount > 0 or x.col = 'lech')), '[]'),
    'people', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'no_remind', p.nr, 'open', p.open, 'n', p.n) order by p.nr desc, p.name)
      from (select min(trim(d.table_name)) name, bool_or(d.grp <> 'khach') nr,
                   coalesce(sum(d.amount) filter (where d.closed_at is null), 0) open, count(*) filter (where d.closed_at is null) n
              from public.shift_debts d where d.branch_id = p_branch and trim(coalesce(d.table_name, '')) <> ''
               and (d.closed_at is null or d.grp <> 'khach') group by lower(trim(d.table_name))) p), '[]'),
    'open_debts', coalesce((select jsonb_agg(jsonb_build_object('id', 'd:' || d.id, 'who', d.table_name, 'kind', coalesce(d.kind, 'bill'), 'amount', d.amount, 'left', d.amount,
        'date', coalesce(x.work_date, left(d.created_at, 10)),
        'from', case when x.id is not null then 'ca ' || x.shift || ' ' || to_char(x.work_date::date, 'DD/MM') else 'quản lý ghi' end,
        'no_remind', coalesce(d.family, 0) = 1 or coalesce(d.grp, 'khach') <> 'khach') order by coalesce(x.work_date, left(d.created_at, 10)))
      from public.shift_debts d left join public.shift_reports x on x.id = d.report_id
     where d.branch_id = p_branch and d.closed_at is null and d.amount > 0
       and not exists (select 1 from public.shift_debts z where z.split_from = d.id)), '[]'),
    'compare', jsonb_build_object(
       'fund_days', coalesce((select jsonb_agg(jsonb_build_object('date', q.d, 'tm', q.tm, 'ck', q.ck) order by q.d)
          from (select o.d,
                       coalesce((select f.amount from public.fund_openings f where f.branch_id = p_branch and f.method = 'tien_mat'), 0) + sum(coalesce(o.tm, 0)) over w tm,
                       coalesce((select f.amount from public.fund_openings f where f.branch_id = p_branch and f.method = 'chuyen_khoan'), 0) + sum(coalesce(o.ck, 0)) over w ck
                  from oldf o window w as (order by o.d rows between unbounded preceding and current row)) q
         where q.d >= d0), '[]'),
       'gaps', coalesce((select jsonb_agg(jsonb_build_object('ca_id', gs.report_id, 'pm', case when gs.item = 'tien_mat' then 'tm' else 'ck' end, 'lech', gs.lech, 'state', gs.state)) from gs), '[]'))
  ) into res;
  return res;
end $$;

revoke all on function public.app__stc_debt_unassign(bigint, text) from public, anon, authenticated;
revoke all on function public.app_stc_gap_debt(bigint, text, bigint, bigint, text) from public, anon;
grant execute on function public.app_stc_gap_debt(bigint, text, bigint, bigint, text) to authenticated;

insert into public.app_migrations(file) values ('132_so_thu_chi_gan_no.sql') on conflict (file) do nothing;
