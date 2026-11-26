-- Việc #8 (anh Tiến chốt 26/11/2026, chọn B): nhân viên ca sau bấm "Đã xong" được cả việc bàn giao ĐÃ chuyển vào Công việc.
--   Trước đây: app_ca_handover_done chặn việc có task_id ("chỉ xong khi người nhận báo Đã xử lý") → quản lý không giao người làm
--   thì việc hiện mãi ở mọi ca sau.
--   Nay: việc có task_id cũng đánh dấu xong được ở phiếu ca. Cùng lúc, thẻ Công việc gắn với nó chuyển "hoan_thanh"
--   (ghi nhật ký 'ca_sau_xong', báo người đang được giao nếu có). Bỏ đánh dấu (chỉ ở đúng phiếu đã bấm) → thẻ trở lại
--   chưa giao / đã giao như trước.
--   Quyền: KHÔNG đổi — vẫn app__ca_need_edit (quyền chot_ca, phiếu chưa hoàn thành) + app__ca_part_guard('nhan_su')
--   (người đang chốt ca) như hàm cũ. Không đụng tiền, không đụng vùng khoá đối soát.
--   Thẻ đã huỷ (cancelled_at) thì chỉ đánh dấu việc bàn giao, không đổi thẻ.
-- Chạy lại nhiều lần không sao (create or replace).

create or replace function public.app_ca_handover_done(p_item bigint, p_report bigint, p_done boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare a public.accounts; h public.handover_items; t public.tasks; r public.shift_reports; now_ text := public.vn_now_text(); note_ text;
begin
  a := public.app_account();
  r := public.app__ca_need_edit(p_report);
  perform public.app__ca_part_guard(p_report, 'nhan_su');
  select * into h from public.handover_items where id = p_item for update;
  if h.id is null then raise exception 'Không tìm thấy việc bàn giao.'; end if;
  if h.branch_id is distinct from r.branch_id then raise exception 'Việc bàn giao này không thuộc cơ sở của phiếu.'; end if;

  if h.task_id is null then   -- như cũ
    if p_done then
      update public.handover_items set done_at = now_, done_by = a.id, done_report_id = p_report where id = p_item and done_at is null;
    else
      update public.handover_items set done_at = null, done_by = null, done_report_id = null where id = p_item and done_report_id = p_report;
    end if;
    return;
  end if;

  select * into t from public.tasks where id = h.task_id for update;
  note_ := 'Ca ' || r.shift || ' ' || to_char(r.work_date::text::date, 'DD/MM') || ' (' || coalesce(public.app__acc_name(a.id), 'nhân viên') || ')';

  if p_done then
    if h.done_at is not null then return; end if;
    update public.handover_items set done_at = now_, done_by = a.id, done_report_id = p_report where id = p_item;
    if t.id is not null and t.cancelled_at is null and t.status <> 'hoan_thanh' then
      update public.tasks set status = 'hoan_thanh', done_at = now_, approved_at = now_, submitted_at = coalesce(submitted_at, now_),
             started_at = coalesce(started_at, now_), updated_at = now_ where id = t.id;   -- approved_at: để hiện ở mục Hoàn thành / Việc hôm nay
      perform public.app__viec_event(t.id, 'ca_sau_xong', 'Ca sau đã làm xong ở phiếu chốt ca: ' || note_);
      if t.assignee_id is not null and t.assignee_id is distinct from a.id then
        perform public.app__notify(t.assignee_id, 'Việc bàn giao đã được ca sau làm xong', t.content || E'\n' || note_, '/viec');
      end if;
    end if;
  else
    if h.done_report_id is distinct from p_report then return; end if;   -- chỉ bỏ được ở đúng phiếu đã bấm
    update public.handover_items set done_at = null, done_by = null, done_report_id = null where id = p_item;
    if t.id is not null and t.cancelled_at is null and t.status = 'hoan_thanh' then
      update public.tasks set status = case when assignee_id is null then 'chua_phan_cong' else 'da_giao' end,
             done_at = null, approved_at = null, updated_at = now_ where id = t.id;
      perform public.app__viec_event(t.id, 'ca_sau_bo_xong', 'Bỏ đánh dấu xong ở phiếu chốt ca: ' || note_);
    end if;
  end if;
end $function$;

revoke all on function public.app_ca_handover_done(bigint, bigint, boolean) from public, anon;
grant execute on function public.app_ca_handover_done(bigint, bigint, boolean) to authenticated;

insert into public.app_migrations(file) values ('183_ban_giao_ca_sau_xong.sql') on conflict (file) do nothing;
