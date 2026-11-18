-- Bước 149 (19/11/2026, VÙNG KHOÁ — anh Tiến mở bằng mật khẩu 19/11): Sổ thu chi mới — đợt 4: tab Đối soát tiền làm thật.
-- Kế hoạch: tai_lieu/superpowers/plans/2026-11-19-so-thu-chi-moi-dot4.md · Bài thử: kiem_tra/so_thu_chi_133.sql (tự hoàn tác). Chạy lại nhiều lần không sao.
-- Mỗi ca 3 bước: ① so phiếu Fabi ↔ nhân viên ghi (Fabi là chuẩn: "Sửa theo Fabi"; mở ca khác số phải là → "Ca trước ghi sai" / "Ca này ghi sai")
--   ② tiền thực nhận (thu theo ca / theo ngày; chuyển khoản = số kế toán) ③ Chốt tiền ca (ghi kết quả Tiền mặt + Chuyển khoản theo số lệch, lệch thành phiếu chênh lệch) / Mở lại chốt.
-- Bọc hàm đối soát có sẵn (app_ca_recon_apply, app_ca_cash_mode, app_ca_result_set, app_ca_item_reopen, app_ca_recon_reopen) — quyền và luật cũ vẫn áp dụng.

create table if not exists public.stc_open_blame (
  report_id bigint primary key, who text not null, diff bigint not null, prev_report bigint, reason text, by_account bigint,
  at text not null default public.vn_now_text());
alter table public.stc_open_blame enable row level security;
revoke all on public.stc_open_blame from anon, authenticated;

-- tiền mặt thực tế của ca (két): thu theo ca có số quản lý đếm thì lấy số đó, còn lại số đếm trên phiếu (bản đối soát)
create or replace function public.app__stc_real_tm(p_report bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select case when r.cash_mode = 'ca' and r.ql_counted is not null then r.ql_counted else (public.app__ca_eff(r.id) ->> 'cash_counted')::bigint end
    from public.shift_reports r where r.id = p_report
$$;

-- tiền mở ca "phải là": ca đầu ngày 1.000.000; ca trước thu theo ca → 1.000.000; thu theo ngày → tiền thực tế ca trước để lại
create or replace function public.app__stc_exp_open(p_report bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.shift_reports; p public.shift_reports;
begin
  select * into r from public.shift_reports where id = p_report;
  if r.shift = (public.app__shifts())[1] then return jsonb_build_object('exp', 1000000, 'prev', null); end if;
  select * into p from public.shift_reports where branch_id = r.branch_id and work_date = r.work_date and shift = public.app__ca_prev_shift(r.shift) and status = 'hoan_thanh';
  if p.id is null then return jsonb_build_object('exp', null, 'prev', null); end if;
  return jsonb_build_object('exp', case when p.cash_mode = 'ca' then 1000000 else public.app__stc_real_tm(p.id) end, 'prev', p.id);
end $$;

-- trạng thái 3 bước của 1 ca (dùng cho Chốt tiền ca)
create or replace function public.app__stc_ds_state(p_report bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.shift_reports; e jsonb; f jsonb; x jsonb; nv_open bigint; b public.stc_open_blame; kt jsonb; done boolean;
begin
  select * into r from public.shift_reports where id = p_report;
  e := public.app__ca_eff(p_report);
  select to_jsonb(s) into f from public.fabi_shifts s
   where s.report_id = r.id or (s.report_id is null and s.branch_id = r.branch_id and s.work_date = r.work_date and s.shift = r.shift)
   order by (s.report_id = r.id) desc nulls last limit 1;
  x := public.app__stc_exp_open(p_report);
  select * into b from public.stc_open_blame where report_id = p_report;
  kt := public.app__ca_kt_state(p_report);
  nv_open := coalesce((e ->> 'ipos_opening')::bigint, (e ->> 'opening_cash')::bigint);
  done := exists (select 1 from public.shift_report_results s where s.report_id = p_report and s.item = 'tien_mat')
          and exists (select 1 from public.shift_report_results s where s.report_id = p_report and s.item = 'chuyen_khoan');
  return jsonb_build_object('has_fabi', f is not null, 'kt_ready', coalesce((kt ->> 'ready')::boolean, true), 'done', done,
    'nv_open', nv_open, 'fabi_open', (f ->> 'dau')::bigint, 'exp', x -> 'exp', 'prev', x -> 'prev', 'blame', case when b.report_id is null then null else to_jsonb(b) end,
    'mo1', f is null or nv_open is not distinct from (f ->> 'dau')::bigint,
    'mo2', b.report_id is not null or x ->> 'exp' is null or coalesce((f ->> 'dau')::bigint, nv_open) is not distinct from (x ->> 'exp')::bigint,
    'dt', f is null or (e ->> 'total_revenue')::bigint is not distinct from (f ->> 'net')::bigint,
    'no', f is null or coalesce((e ->> 'pos_debt')::bigint, 0) = coalesce((f ->> 'no')::bigint, 0),
    'fabi_rev', (f ->> 'net')::bigint, 'fabi_debt', coalesce((f ->> 'no')::bigint, 0),
    'need_tm', r.cash_mode = 'ca' and r.ql_counted is null);
end $$;

create or replace function public.app__stc_ds_need(p_report bigint, p_open boolean) returns public.shift_reports
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports;
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null then raise exception 'Không tìm thấy ca.'; end if;
  if r.status <> 'hoan_thanh' then raise exception 'Nhân viên chưa gửi phiếu ca này.'; end if;
  if a.id is null or coalesce(a.locked, 0) = 1 or not coalesce(public.app__ca_auto_ok(a, r.branch_id), false) then
    raise exception 'Chỉ Chủ, Quản lý tổng hoặc quản lý đối soát của cơ sở này đối soát tiền được.';
  end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT.'; end if;
  if p_open and coalesce((public.app__stc_ds_state(p_report) ->> 'done')::boolean, false) then
    raise exception 'Ca đã chốt tiền — bấm "Mở lại chốt" trước khi sửa.';
  end if;
  return r;
end $$;

-- ① Sửa theo Fabi: p_field mo | dt | no. Nợ: Fabi nhiều hơn và có p_name → thêm báo nợ phần chênh.
create or replace function public.app_stc_ds_fabi(p_report bigint, p_field text, p_name text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; s jsonb; rs text; fld jsonb; diff bigint; e jsonb;
begin
  r := public.app__stc_ds_need(p_report, true);
  rs := 'Sửa theo Fabi' || coalesce(': ' || nullif(trim(coalesce(p_reason, '')), ''), '');
  s := public.app__stc_ds_state(p_report);
  if not (s ->> 'has_fabi')::boolean then raise exception 'Chưa có file Fabi của ca này — chờ kế toán tải lên.'; end if;
  e := public.app__ca_eff(p_report);
  if p_field = 'mo' then fld := jsonb_build_object('ipos_opening', (s ->> 'fabi_open')::bigint, 'opening_cash', (s ->> 'fabi_open')::bigint);
  elsif p_field = 'dt' then fld := jsonb_build_object('total_revenue', (s ->> 'fabi_rev')::bigint);
  elsif p_field = 'no' then
    fld := jsonb_build_object('pos_debt', (s ->> 'fabi_debt')::bigint);
    diff := (s ->> 'fabi_debt')::bigint - coalesce((e ->> 'pos_debt')::bigint, 0);
  else raise exception 'Ô cần sửa không hợp lệ.'; end if;
  perform public.app_ca_recon_apply(p_report, jsonb_build_object('fields', fld), rs);
  if p_field = 'no' and diff > 0 and nullif(trim(coalesce(p_name, '')), '') is not null then
    perform public.app_ca_recon_apply(p_report, jsonb_build_object('debts', jsonb_build_array(jsonb_build_object('op', 'set', 'kind', 'bill', 'name', trim(p_name), 'amount', diff, 'note', 'Theo Fabi'))), rs);
  end if;
  perform public.app_log('stc_sua_theo_fabi', 'report=' || p_report || ' ' || p_field);
end $$;

-- ① Mở ca lệch số phải là: ca nào ghi sai ca đó chịu. nay = ca này chịu (tiền đầu ca tính bằng số phải là);
--   truoc = ca trước chịu (tiền thực tế ca trước để lại = số mở ca của ca này).
create or replace function public.app_stc_ds_blame(p_report bigint, p_who text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports; s jsonb; rs text := public.app__stc_reason(p_reason);
  opn bigint; ex bigint; diff bigint; p public.shift_reports; d jsonb;
begin
  r := public.app__stc_ds_need(p_report, true);
  if exists (select 1 from public.stc_open_blame where report_id = p_report) then raise exception 'Đã chọn ca chịu lệch mở ca — huỷ trước khi chọn lại.'; end if;
  s := public.app__stc_ds_state(p_report);
  if not (s ->> 'mo1')::boolean then raise exception 'Số nhân viên ghi khác Fabi — bấm "Sửa theo Fabi" trước.'; end if;
  ex := (s ->> 'exp')::bigint; opn := coalesce((s ->> 'fabi_open')::bigint, (s ->> 'nv_open')::bigint);
  if ex is null then raise exception 'Chưa biết tiền mở ca phải là (ca trước chưa gửi phiếu).'; end if;
  diff := opn - ex;
  if diff = 0 then raise exception 'Tiền mở ca đã đúng — không cần chọn.'; end if;
  if p_who = 'nay' then
    perform public.app_ca_recon_apply(p_report, jsonb_build_object('fields', jsonb_build_object('opening_cash', ex)), 'Ca này ghi sai tiền mở ca: ' || rs);
  elsif p_who = 'truoc' then
    select * into p from public.shift_reports where id = (s ->> 'prev')::bigint;
    if p.id is null then raise exception 'Ca đầu ngày không có ca trước — chọn "Ca này ghi sai".'; end if;
    if p.cash_mode = 'ca' then raise exception 'Ca trước thu theo ca (đã giao lại 1.000.000) — chọn "Ca này ghi sai".'; end if;
    perform public.app__stc_ds_need(p.id, false);
    -- sửa thẳng số đếm két của ca trước trong bản đối soát (không mở lại mục đã duyệt), ghi nhật ký
    select data into d from public.shift_report_recon where report_id = p.id;
    if d is null then
      insert into public.shift_report_recon(report_id, data, updated_by, updated_at) values (p.id, jsonb_build_object('cash_counted', public.app__stc_real_tm(p.id) + diff), a.id, public.vn_now_text());
    else
      update public.shift_report_recon set data = d || jsonb_build_object('cash_counted', public.app__stc_real_tm(p.id) + diff), updated_by = a.id, updated_at = public.vn_now_text() where report_id = p.id;
    end if;
    insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
    values (p.id, 'ca_sau_bao_lech_mo_ca', 'cash_counted', jsonb_build_object('cash_counted', public.app__stc_real_tm(p.id) - diff), jsonb_build_object('cash_counted', public.app__stc_real_tm(p.id)),
            'Ca sau mở ca ' || public.app__vnd(opn) || ' (phải là ' || public.app__vnd(ex) || ') — ca trước ghi sai: ' || rs, a.id);
  else raise exception 'Chọn ca chịu lệch: ca trước hoặc ca này.'; end if;
  insert into public.stc_open_blame(report_id, who, diff, prev_report, reason, by_account) values (p_report, p_who, diff, (s ->> 'prev')::bigint, rs, a.id);
  perform public.app_log('stc_lech_mo_ca', 'report=' || p_report || ' ' || p_who || ' ' || diff);
end $$;

create or replace function public.app_stc_ds_blame_undo(p_report bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); b public.stc_open_blame; rs text := public.app__stc_reason(p_reason); d jsonb;
begin
  perform public.app__stc_ds_need(p_report, true);
  select * into b from public.stc_open_blame where report_id = p_report for update;
  if b.report_id is null then raise exception 'Chưa chọn ca chịu lệch mở ca.'; end if;
  if b.who = 'nay' then
    perform public.app_ca_recon_apply(p_report, jsonb_build_object('fields', jsonb_build_object('opening_cash', (public.app__ca_eff(p_report) ->> 'opening_cash')::bigint + b.diff)), 'Huỷ "ca này ghi sai": ' || rs);
  else
    perform public.app__stc_ds_need(b.prev_report, false);
    select data into d from public.shift_report_recon where report_id = b.prev_report;
    update public.shift_report_recon set data = d || jsonb_build_object('cash_counted', public.app__stc_real_tm(b.prev_report) - b.diff), updated_by = a.id, updated_at = public.vn_now_text()
     where report_id = b.prev_report;
    insert into public.shift_recon_log(report_id, action, field, reason, by_account) values (b.prev_report, 'huy_lech_mo_ca', 'cash_counted', 'Huỷ "ca trước ghi sai": ' || rs, a.id);
  end if;
  delete from public.stc_open_blame where report_id = p_report;
  perform public.app_log('stc_huy_lech_mo_ca', 'report=' || p_report);
end $$;

-- ② Tiền thực nhận: thu theo ca (quản lý đếm két mỗi ca) / theo ngày (chỉ ca cuối, ghi số đếm két sau ca vào bản đối soát)
create or replace function public.app_stc_ds_cash(p_report bigint, p_mode text, p_counted bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports;
begin
  r := public.app__stc_ds_need(p_report, true);
  if coalesce(p_mode, '') not in ('ca', 'ngay') then raise exception 'Chọn thu theo ca hay theo ngày.'; end if;
  if p_counted is not null and p_counted < 0 then raise exception 'Số đếm không được âm.'; end if;
  if p_mode = 'ca' then perform public.app_ca_cash_mode(p_report, 'ca', p_counted);
  else
    perform public.app_ca_cash_mode(p_report, 'ngay', null);
    if p_counted is not null then
      perform public.app_ca_recon_apply(p_report, jsonb_build_object('fields', jsonb_build_object('cash_counted', p_counted)), 'Quản lý đếm két cuối ngày (Sổ thu chi)');
    end if;
  end if;
end $$;

-- ③ Chốt tiền ca: hết ô đỏ ở ①, có file Fabi + ngân hàng, có tiền mặt thực nhận (thu theo ca). Lệch không chặn → phiếu chênh lệch.
create or replace function public.app_stc_ds_close(p_report bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; s jsonb; m jsonb; it text; v bigint; res text;
begin
  r := public.app__stc_ds_need(p_report, true);
  s := public.app__stc_ds_state(p_report);
  if not (s ->> 'has_fabi')::boolean or not (s ->> 'kt_ready')::boolean then raise exception 'Chờ kế toán (file Fabi / số ngân hàng) rồi mới chốt.'; end if;
  if not ((s ->> 'mo1')::boolean and (s ->> 'mo2')::boolean and (s ->> 'dt')::boolean and (s ->> 'no')::boolean) then
    raise exception 'Còn ô đỏ ở bước ① (tiền mở ca / doanh thu / nợ) — sửa xong mới chốt.';
  end if;
  if (s ->> 'need_tm')::boolean then raise exception 'Nhập tiền mặt thực nhận ở bước ② trước.'; end if;
  m := public.app__ca_money(p_report);
  foreach it in array array['tien_mat', 'chuyen_khoan'] loop
    v := (m ->> case it when 'tien_mat' then 'tm_left' else 'ck_left' end)::bigint;
    res := case when coalesce(v, 0) = 0 then 'khop' when v < 0 then 'thieu' else 'thua' end;
    perform public.app_ca_result_set(p_report, it, res, abs(coalesce(v, 0)), case when res = 'khop' then null else 'Chốt tiền ca (Sổ thu chi) — lệch xử lý ở phiếu chênh lệch' end, '[]'::jsonb);
  end loop;
  perform public.app_log('stc_chot_tien_ca', 'report=' || p_report);
  return jsonb_build_object('tm', (m ->> 'tm_left')::bigint, 'ck', (m ->> 'ck_left')::bigint);
end $$;

create or replace function public.app_stc_ds_reopen(p_report bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; rs text := public.app__stc_reason(p_reason); it text;
begin
  r := public.app__stc_ds_need(p_report, false);
  if r.recon_status = 'hoan_thanh' then perform public.app_ca_recon_reopen(p_report, 'Mở lại chốt tiền ca: ' || rs); end if;
  foreach it in array array['tien_mat', 'chuyen_khoan'] loop
    if exists (select 1 from public.shift_report_checks c where c.report_id = p_report and c.item = it) then
      perform public.app_ca_item_reopen(p_report, it, 'Mở lại chốt tiền ca: ' || rs);
    end if;
  end loop;
  perform public.app_log('stc_mo_lai_chot', 'report=' || p_report || ' · ' || rs);
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
        'nv', jsonb_build_object('opening', coalesce((r.e ->> 'ipos_opening')::bigint, (r.e ->> 'opening_cash')::bigint), 'revenue', (r.e ->> 'total_revenue')::bigint, 'debt', coalesce((r.e ->> 'pos_debt')::bigint, 0)),
        'nv_raw', jsonb_build_object('opening', coalesce(r.ipos_opening, r.opening_cash), 'revenue', r.total_revenue, 'debt', coalesce(r.pos_debt, 0)),
        'blame', (select to_jsonb(ob) || jsonb_build_object('by', public.app__acc_name(ob.by_account)) from public.stc_open_blame ob where ob.report_id = r.id),
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

revoke all on function public.app__stc_real_tm(bigint), public.app__stc_exp_open(bigint), public.app__stc_ds_state(bigint), public.app__stc_ds_need(bigint, boolean) from public, anon, authenticated;
revoke all on function public.app_stc_ds_fabi(bigint, text, text, text), public.app_stc_ds_blame(bigint, text, text), public.app_stc_ds_blame_undo(bigint, text),
  public.app_stc_ds_cash(bigint, text, bigint), public.app_stc_ds_close(bigint), public.app_stc_ds_reopen(bigint, text) from public, anon;
grant execute on function public.app_stc_ds_fabi(bigint, text, text, text), public.app_stc_ds_blame(bigint, text, text), public.app_stc_ds_blame_undo(bigint, text),
  public.app_stc_ds_cash(bigint, text, bigint), public.app_stc_ds_close(bigint), public.app_stc_ds_reopen(bigint, text) to authenticated;

insert into public.app_migrations(file) values ('133_so_thu_chi_doi_soat.sql') on conflict (file) do nothing;
