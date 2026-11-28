-- Tệp 199 — Trang đối soát ca mới: sửa / xoá / thêm lần khách trả nợ cũ khi ca ĐÃ xác nhận số tiền thì không kẹt nữa (anh Tiến duyệt 28/11/2026).
-- VÙNG KHOÁ tiền đối soát (đã báo anh Tiến trong chat 28/11 trước khi sửa, anh trả lời "làm 2").
--
-- Lỗi: ca tối 9/11 LHP — quản lý xoá lần khách trả 63k ở trang mới, máy chủ báo
--   "Số lệch chuyển khoản đã đổi … Bấm Sửa phần tiền → Mở lại phần tiền" (hai nút này trang mới không có).
--   Ca đã xác nhận số (trang mới tự xác nhận khi mở dòng chênh lệch) nhưng chưa Hoàn thành → không có nút Mở lại → kẹt.
-- Gốc: luật mới (tệp 173) cho sửa tự do tới khi Hoàn thành, nhưng chốt chặn cũ app__ca_direct_guard (bước 119) vẫn chặn khi số lệch đổi.
-- Sửa: CÓ cờ app.ds_moi (chỉ các hàm app_ds2_* đặt) mà số lệch của mục tiền đã xác nhận bị đổi → không chặn,
--   tự mở lại hai mục tiền của ca (đúng cách nút Mở lại đang làm: app__ca_item_reopen, có ghi nhật ký) → số tính lại, quản lý xác nhận lại.
--   Ca đã xử lý chênh lệch / đã Hoàn thành / tháng đã chốt vẫn chặn như cũ (các hàm gọi đã kiểm trước đó).
--   KHÔNG cờ (trang cũ, Sổ thu chi): y như trước.
-- Chạy lại nhiều lần không sao (create or replace).

create or replace function public.app__ca_direct_guard(p_id bigint) returns void
language plpgsql security definer set search_path = public as $function$
declare g0 jsonb; m jsonb; it text; it2 text; was bigint; cur bigint; a public.accounts;
begin
  g0 := nullif(current_setting('app.gap0_' || p_id, true), '')::jsonb;
  if g0 is null then return; end if;
  m := public.app__ca_money(p_id);
  foreach it in array array['tien_mat', 'chuyen_khoan'] loop
    if not exists (select 1 from public.shift_report_results where report_id = p_id and item = it) then continue; end if;
    was := (g0 ->> it)::bigint; cur := (m ->> case it when 'tien_mat' then 'tm_left' else 'ck_left' end)::bigint;
    if cur is distinct from was then
      if public.app__ds_moi() then   -- tệp 199: trang mới — tự mở lại hai mục tiền thay vì chặn
        a := public.app_account();
        foreach it2 in array array['tien_mat', 'chuyen_khoan'] loop
          if exists (select 1 from public.shift_report_checks c where c.report_id = p_id and c.item = it2) then
            perform public.app__ca_item_reopen(p_id, it2, a.id,
              'Tự mở lại mục tiền: số lệch ' || case it when 'tien_mat' then 'tiền mặt' else 'chuyển khoản' end
              || ' đổi sau khi sửa (' || public.app__vnd(was) || ' → ' || public.app__vnd(cur) || ')');
          end if;
        end loop;
        return;
      end if;
      raise exception 'Số lệch % đã đổi (% → %). Bấm "Sửa phần tiền" → "Mở lại phần tiền" rồi duyệt lại.',
        case it when 'tien_mat' then 'tiền mặt' else 'chuyển khoản' end, public.app__vnd(was), public.app__vnd(cur);
    end if;
  end loop;
end $function$;

revoke all on function public.app__ca_direct_guard(bigint) from public, anon, authenticated;

insert into public.app_migrations(file) values ('199_ds_moi_tra_no_khong_ket.sql') on conflict (file) do nothing;
