-- 190 (anh Tiến chốt 27/11/2026, 4 câu): LỆCH NHỎ ≤ 5.000 TỰ TẠO PHIẾU khi quản lý Hoàn thành đối soát ca.
--  Trước đây lệch từ 5.000 trở xuống "coi như khớp": không có phiếu nào, không vào kết quả tháng.
--  Nay: ca vừa được bấm Hoàn thành đối soát (có dòng stc_ca_done) mà tiền mặt / chuyển khoản còn lệch 1 … 5.000 đồng thì web TỰ tạo
--    · ca THIẾU → phiếu chi nhóm "Âm tiền – quán chịu" (quán chịu, không trừ lương ai, không cần Chủ duyệt vì số nhỏ)
--    · ca DƯ    → phiếu thu nhóm "Thu khác"
--  đúng kiểu phiếu của nút "Quán chịu" / "Tạo phiếu thu" đang có (fin_entries.no_fund = true + gap_decisions), đánh dấu auto = true.
--  Mở lại Hoàn thành (xoá stc_ca_done bằng bất kỳ đường nào) → phiếu tự tạo của ca đó tự huỷ; Hoàn thành lại thì tạo lại theo số mới.
--  Không tạo khi: tháng đã CHỐT, mục đó đã có cách xử lý (trừ lương / quyết định / ghép ca / đề nghị chờ duyệt / gán nợ), chưa có nhóm thu chi.
--  Tạo / huỷ phiếu tự động KHÔNG BAO GIỜ chặn việc Hoàn thành / Mở lại (lỗi thì bỏ qua, ghi nhật ký).
--  * app__gap_rows: lệch nhỏ ĐÃ CÓ phiếu thì thành một dòng chênh lệch (trạng thái 'xong') — để Sổ thu chi / bảng Chênh lệch tiền ghi "Đã xử lý";
--    lệch nhỏ chưa có phiếu vẫn như cũ (không có dòng). Các chỗ lọc remain > 5000 không đổi kết quả.
--  * app_stc_month: mỗi quyết định trả thêm 'auto'.
--  * Tạo bù cho các ca ĐÃ Hoàn thành từ trước: hàm app__gap_auto_backfill() — KHÔNG tự chạy trong tệp này; chạy riêng sau khi anh Tiến xem số trước / sau.
--  Vùng khoá tiền đối soát (đã báo anh Tiến trong chat 27/11). Chạy lại nhiều lần không lỗi.

alter table public.gap_decisions add column if not exists auto boolean not null default false;
create index if not exists gap_decisions_report on public.gap_decisions (report_id, item);

-- ---------------------------------------------------------------- tạo phiếu cho lệch nhỏ của một ca (trả số phiếu đã tạo)
create or replace function public.app__gap_auto_small(p_report bigint, p_by bigint) returns integer
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; m jsonb; it text; v bigint; k text; cat bigint; eid bigint; n int := 0;
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null or r.status <> 'hoan_thanh' then return 0; end if;
  if not exists (select 1 from public.stc_ca_done d where d.report_id = p_report) then return 0; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then return 0; end if;
  m := public.app__ca_money(p_report);
  foreach it in array array['tien_mat', 'chuyen_khoan'] loop
    v := (m ->> case it when 'tien_mat' then 'tm_left' else 'ck_left' end)::bigint;
    continue when v is null or v = 0 or abs(v) > 5000;
    continue when exists (select 1 from public.gap_decisions g where g.report_id = p_report and g.item = it)
               or exists (select 1 from public.shift_shortfalls s where s.report_id = p_report and s.item = it and s.status <> 'huy')
               or exists (select 1 from public.gap_matches mm where mm.item = it and (mm.short_report = p_report or mm.over_report = p_report) and mm.status in ('da_duyet', 'cho_duyet'))
               or exists (select 1 from public.stc_gap_requests q where q.report_id = p_report and q.item = it and q.status = 'cho_duyet')
               or exists (select 1 from public.shift_debts d where d.gap_report = p_report and d.gap_item = it);
    k := case when v < 0 then 'quan_chiu' else 'thu_khac' end;
    select id into cat from public.fin_categories where kind = case when k = 'quan_chiu' then 'chi' else 'thu' end
       and name = case when k = 'quan_chiu' then 'Âm tiền – quán chịu' else 'Thu khác' end order by id limit 1;
    continue when cat is null;
    insert into public.fin_entries(branch_id, entry_date, kind, category_id, amount, note, pay_method, created_by, updated_by, no_fund)
    values (r.branch_id, r.work_date, case when k = 'quan_chiu' then 'chi' else 'thu' end, cat, abs(v),
            case when k = 'quan_chiu' then 'Âm tiền ' else 'Tiền dư ' end || public.app__ca_item_label(it) || ' – ca ' || r.shift || ' ' || to_char(r.work_date::date, 'DD/MM')
            || ' · lệch nhỏ, web tự tạo khi Hoàn thành đối soát', it, p_by, p_by, true) returning id into eid;
    insert into public.gap_decisions(report_id, item, kind, amount, reason, fin_entry_id, created_by, auto)
    values (p_report, it, k, abs(v), 'Lệch nhỏ ≤ 5.000 — web tự tạo phiếu khi Hoàn thành đối soát', eid, p_by, true);
    n := n + 1;
  end loop;
  if n > 0 then perform public.app_log('lech_nho_tu_tao', 'report=' || p_report || ' n=' || n); end if;
  return n;
end $$;

-- ---------------------------------------------------------------- huỷ phiếu tự tạo của một ca (khi Mở lại Hoàn thành)
create or replace function public.app__gap_auto_clear(p_report bigint) returns integer
language plpgsql security definer set search_path = public as $$
declare ids bigint[]; fes bigint[];
begin
  select array_agg(g.id), array_agg(g.fin_entry_id) filter (where g.fin_entry_id is not null) into ids, fes
    from public.gap_decisions g where g.report_id = p_report and g.auto;
  if ids is null then return 0; end if;
  delete from public.gap_decisions where id = any(ids);
  if fes is not null then delete from public.fin_entries where id = any(fes); end if;
  perform public.app_log('lech_nho_huy_tu_tao', 'report=' || p_report || ' n=' || cardinality(ids));
  return cardinality(ids);
end $$;

-- ---------------------------------------------------------------- gắn vào dấu Hoàn thành đối soát (mọi đường ghi / xoá stc_ca_done)
create or replace function public.app__gap_auto_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_op = 'INSERT' then perform public.app__gap_auto_small(new.report_id, new.by_account);
    else perform public.app__gap_auto_clear(old.report_id); end if;
  exception when others then   -- không bao giờ chặn Hoàn thành / Mở lại
    begin perform public.app_log('lech_nho_loi', 'report=' || coalesce(new.report_id, old.report_id) || ' ' || tg_op || ': ' || sqlerrm); exception when others then null; end;
  end;
  return null;
end $$;
drop trigger if exists stc_ca_done_lech_nho on public.stc_ca_done;
create trigger stc_ca_done_lech_nho after insert or delete on public.stc_ca_done
  for each row execute function public.app__gap_auto_trg();

-- ---------------------------------------------------------------- tạo bù cho các ca đã Hoàn thành từ trước (chạy riêng, có chủ ý)
create or replace function public.app__gap_auto_backfill() returns jsonb
language plpgsql security definer set search_path = public as $$
declare d record; n int := 0; ca int := 0; loi int := 0; k int;
begin
  for d in select x.report_id, x.by_account from public.stc_ca_done x join public.shift_reports r on r.id = x.report_id order by r.work_date, x.report_id loop
    begin k := public.app__gap_auto_small(d.report_id, d.by_account); if k > 0 then n := n + k; ca := ca + 1; end if;
    exception when others then loi := loi + 1; end;
  end loop;
  return jsonb_build_object('phieu', n, 'ca', ca, 'loi', loi);
end $$;

-- ---------------------------------------------------------------- vá thay chuỗi trên bản đang chạy (đã vá thì bỏ qua; không thấy đúng một chỗ thì DỪNG)
do $$
declare d text; x record;
begin
  for x in select * from (values
      ('public.app__gap_rows(bigint,text,text)', 'from v where abs(v.lech) > 5000)',
       'from v where abs(v.lech) > 5000 or (v.lech <> 0 and exists (select 1 from public.gap_decisions g0 where g0.report_id = v.id and g0.item = v.item)))   -- tệp 190: lệch nhỏ đã có phiếu', 'tệp 190'),
      ('public.app_stc_month(bigint,text)', 'jsonb_build_object(''id'', gd.id, ''kind'', gd.kind, ''amount'', gd.amount)',
       'jsonb_build_object(''id'', gd.id, ''kind'', gd.kind, ''amount'', gd.amount, ''auto'', coalesce(gd.auto, false))', '''auto'', coalesce(gd.auto, false)')
    ) v(fn, cu, moi, dau) loop
    d := pg_get_functiondef(x.fn::regprocedure);
    continue when position(x.dau in d) > 0;
    if (length(d) - length(replace(d, x.cu, ''))) / length(x.cu) <> 1 then
      raise exception 'Tệp 190: % không có đúng một chỗ cần vá — dừng, không đổi gì.', x.fn;
    end if;
    execute replace(d, x.cu, x.moi);
  end loop;
end $$;

revoke all on function public.app__gap_auto_small(bigint, bigint), public.app__gap_auto_clear(bigint), public.app__gap_auto_trg(), public.app__gap_auto_backfill()
  from public, anon, authenticated;

insert into public.app_migrations(file) values ('190_lech_nho_tu_tao_phieu.sql') on conflict (file) do nothing;
