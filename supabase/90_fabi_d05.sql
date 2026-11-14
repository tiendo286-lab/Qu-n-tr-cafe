-- Bước 98 (anh Tiến 15/11/2026): nạp số Fabi từ D05 (báo cáo bán hàng, Fabi tự gửi Gmail) + danh sách ca (list_shift_report)
-- thay cho báo cáo ca chi tiết tải từng ca. app_fabi_upload nhận thêm khoá tm / ck / no: số chắc chắn thì điền,
-- ca có hoá đơn trả cả TM + CK thì để trống (null) → không so, không sửa theo Fabi. File chi tiết cũ (không có các khoá này) vẫn như trước.

CREATE OR REPLACE FUNCTION public.app_fabi_upload(p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; x jsonb; bid bigint; op text; out jsonb := '[]'; res jsonb; ma text; nm text; pay jsonb; ck bigint; tm bigint; no_ bigint; oth bigint;
begin
  a := public.app__need('ke_toan');
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'Chưa có file nào.'; end if;
  if jsonb_array_length(p_rows) > 100 then raise exception 'Mỗi lần tải tối đa 100 file.'; end if;
  for x in select * from jsonb_array_elements(p_rows) loop
    ma := trim(coalesce(x ->> 'ma_ca', '')); nm := trim(coalesce(x ->> 'store', ''));
    if ma = '' or nm = '' then raise exception 'File thiếu mã ca hoặc tên cửa hàng.'; end if;
    select branch_id into bid from public.fabi_stores where lower(store_name) = lower(nm);
    op := public.app__fabi_ts(x ->> 'open');
    pay := coalesce(x -> 'pay', '[]');
    select coalesce(sum((p ->> 'amount')::bigint) filter (where lower(p ->> 'name') like '%chuyển khoản%'), 0),
           coalesce(sum((p ->> 'amount')::bigint) filter (where lower(trim(p ->> 'name')) = 'tiền mặt'), 0),
           coalesce(sum((p ->> 'amount')::bigint) filter (where lower(trim(p ->> 'name')) = 'nợ'), 0),
           coalesce(sum((p ->> 'amount')::bigint) filter (where lower(p ->> 'name') not like '%chuyển khoản%' and lower(trim(p ->> 'name')) not in ('tiền mặt', 'nợ')), 0)
      into ck, tm, no_, oth from jsonb_array_elements(pay) p;
    -- bước 98: số ghép từ D05 + danh sách ca — có khoá 'tm' / 'ck' / 'no' thì dùng đúng số đó (để trống = không so, không sửa theo Fabi)
    if x ? 'tm' then tm := nullif(x ->> 'tm', '')::bigint; end if;
    if x ? 'ck' then ck := nullif(x ->> 'ck', '')::bigint; end if;
    if x ? 'no' then no_ := nullif(x ->> 'no', '')::bigint; end if;
    insert into public.fabi_shifts(ma_ca, store_name, branch_id, work_date, shift, open_at, close_at, dau, cuoi, net, ck, tm, no, other, hd, tong, pay, tra_no, sua, bills, uploaded_by, uploaded_at, items, groups)
    values (ma, nm, bid, left(op, 10), public.app__fabi_shift(op), op, public.app__fabi_ts(x ->> 'close'),
            nullif(x ->> 'dau', '')::bigint, nullif(x ->> 'cuoi', '')::bigint, nullif(x ->> 'net', '')::bigint, ck, tm, no_, oth,
            nullif(x ->> 'hd', '')::int, nullif(x ->> 'tong', '')::bigint, pay, coalesce(x -> 'tra_no', '[]'), coalesce(x -> 'sua', '[]'), coalesce(x -> 'bills', '[]'),
            a.id, public.vn_now_text(), coalesce(x -> 'items', '[]'), coalesce(x -> 'groups', '[]'))
    on conflict (ma_ca) do update set store_name = excluded.store_name, branch_id = excluded.branch_id, work_date = excluded.work_date, shift = excluded.shift,
      open_at = excluded.open_at, close_at = excluded.close_at, dau = excluded.dau, cuoi = excluded.cuoi, net = excluded.net, ck = excluded.ck, tm = excluded.tm,
      no = excluded.no, other = excluded.other, hd = excluded.hd, tong = excluded.tong, pay = excluded.pay, tra_no = excluded.tra_no, sua = excluded.sua, bills = excluded.bills,
      uploaded_by = excluded.uploaded_by, uploaded_at = excluded.uploaded_at, items = excluded.items, groups = excluded.groups;
    res := public.app__fabi_apply(ma);
    perform public.app__fabi_cups(ma);   -- bước 49
    if res ->> 'status' = 'chua_phieu' then
      perform public.app__notify_doi_soat('Ca có trên Fabi nhưng chưa có phiếu chốt ca',
        (select code from public.branches where id = bid) || ' · ca ' || public.app__fabi_shift(op) || ' ' || to_char(left(op, 10)::date, 'DD/MM') || ' (mã ca ' || ma || ').', '/ca?ngay=' || left(op, 10));
    end if;
    out := out || (jsonb_build_object('cups', (select cups from public.fabi_shifts where ma_ca = ma), 'cups_unknown', (select cups_unknown from public.fabi_shifts where ma_ca = ma),
                   'ma_ca', ma, 'store', nm, 'branch_code', (select code from public.branches where id = bid), 'work_date', left(op, 10),
                   'shift', public.app__fabi_shift(op)) || coalesce(res, '{}'::jsonb));
  end loop;
  perform public.app_log('tai_file_fabi', jsonb_array_length(p_rows) || ' ca');
  return out;
end $function$;

insert into public.app_migrations(file) values ('90_fabi_d05.sql') on conflict (file) do nothing;
