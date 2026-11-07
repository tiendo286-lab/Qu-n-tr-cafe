-- =====================================================================
-- BƯỚC 22: CÔNG VIỆC CHIA 2 LOẠI + VIỆC TỰ SINH (anh Tiến chốt 07/11/2026). Chạy sau 21. Chạy lại nhiều lần không sao.
--  * Loại: VẬN HÀNH (hỏng hóc, đối soát ca, khoản âm, bàn giao ca, vệ sinh, nhập hàng, khác)
--          QUẢN LÝ  (đào tạo nhân viên, nội quy & quy trình, cam kết, nhân sự & lịch, khác).
--  * Việc tự sinh (tính trực tiếp từ dữ liệu, không lưu): hiện ở "Cần xử lý" để người giao bấm Giao.
--      Vận hành: ca chờ đối soát, ca quá giờ chưa chốt (3 ngày gần nhất), khoản âm chưa xử lý.
--      Quản lý: nhân viên chưa đọc bản mới của nội quy / quy trình, chưa ký / chưa nộp cam kết, đào tạo quá hạn (đào tạo tiếp).
--    Đã giao thành việc (còn mở) thì không hiện lại; việc xong mà tình trạng vẫn còn thì hiện lại.
-- =====================================================================

alter table public.tasks add column if not exists category text not null default 'van_hanh';
alter table public.tasks add column if not exists topic text;
alter table public.tasks add column if not exists link text;
alter table public.tasks add column if not exists auto_key text;
alter table public.tasks drop constraint if exists tasks_category_check;
alter table public.tasks add constraint tasks_category_check check (category in ('van_hanh', 'quan_ly'));
create index if not exists idx_tasks_auto_key on public.tasks (auto_key) where auto_key is not null;

-- Phân loại việc cũ (chỉ việc chưa có nhóm)
update public.tasks set category = 'quan_ly', topic = 'dao_tao' where topic is null and kind = 'dao_tao';
update public.tasks set category = 'van_hanh', topic = 'ban_giao' where topic is null and handover_item_id is not null;
update public.tasks set category = 'van_hanh', topic = 'khac_vh' where topic is null;

create or replace function public.app__viec_topics(p_cat text) returns text[]
language sql immutable as $$
  select case p_cat when 'van_hanh' then array['hong_hoc', 'doi_soat_ca', 'khoan_am', 'ban_giao', 've_sinh', 'nhap_hang', 'khac_vh']
                    when 'quan_ly' then array['dao_tao', 'noi_quy', 'cam_ket', 'nhan_su', 'khac_ql'] end
$$;

-- ---------------------------------------------------------------- Thêm việc (loại, nhóm, đường dẫn, mã việc tự sinh)
create or replace function public.app_viec_add(p_meeting bigint, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; nid bigint; h public.handover_items; kind text := coalesce(p ->> 'kind', 'viec'); content text;
        pri text := coalesce(nullif(p ->> 'priority', ''), 'binh_thuong'); cat text; top text; akey text := nullif(p ->> 'auto_key', '');
begin
  a := public.app__need('hop_giao_viec');
  if p_meeting is not null and not exists (select 1 from public.meetings where id = p_meeting) then raise exception 'Không tìm thấy cuộc họp.'; end if;
  if pri not in ('thap', 'binh_thuong', 'gap') then raise exception 'Mức độ không hợp lệ.'; end if;
  content := trim(coalesce(p ->> 'content', ''));
  if (p ->> 'handover_item_id') is not null then
    select * into h from public.handover_items where id = (p ->> 'handover_item_id')::bigint for update;
    if h.id is null or h.done_at is not null then raise exception 'Nội dung bàn giao này đã xong hoặc không còn.'; end if;
    if h.task_id is not null then raise exception 'Nội dung bàn giao này đã được giao rồi.'; end if;
    if content = '' then content := h.content; end if;
  end if;
  if content = '' then raise exception 'Nhập nội dung công việc.'; end if;
  if kind = 'dao_tao' and (p ->> 'employee_id') is null then raise exception 'Chọn nhân viên cần đào tạo.'; end if;
  cat := coalesce(nullif(p ->> 'category', ''), case when kind = 'dao_tao' then 'quan_ly' else 'van_hanh' end);
  top := coalesce(nullif(p ->> 'topic', ''), case when kind = 'dao_tao' then 'dao_tao' when h.id is not null then 'ban_giao' when cat = 'quan_ly' then 'khac_ql' else 'khac_vh' end);
  if cat not in ('van_hanh', 'quan_ly') then raise exception 'Loại công việc không hợp lệ.'; end if;
  if not (top = any(public.app__viec_topics(cat))) then raise exception 'Nhóm việc không thuộc loại đã chọn.'; end if;
  if akey is not null and exists (select 1 from public.tasks where auto_key = akey and status <> 'hoan_thanh') then
    raise exception 'Việc này đã được giao rồi (đang chờ xử lý).';
  end if;
  insert into public.tasks(meeting_id, kind, content, handover_item_id, employee_id, created_by, priority, category, topic, link, auto_key)
  values (p_meeting, kind, content, h.id, case when kind = 'dao_tao' then (p ->> 'employee_id')::bigint end, a.id, pri, cat, top,
          nullif(trim(coalesce(p ->> 'link', '')), ''), akey)
  returning id into nid;
  if h.id is not null then update public.handover_items set task_id = nid where id = h.id; end if;
  perform public.app__viec_event(nid, 'tao', case when pri <> 'binh_thuong' then 'Mức độ: ' || public.app__viec_pri_label(pri) end);
  if nullif(p ->> 'assignee_id', '') is not null or nullif(p ->> 'due_date', '') is not null then
    perform public.app_viec_update(nid, p - 'priority' - 'category' - 'topic');
  end if;
  return nid;
end $$;

-- Đổi loại / nhóm việc (việc chưa xử lý xong)
create or replace function public.app_viec_set_topic(p_task bigint, p_category text, p_topic text) returns void
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  perform public.app__need('hop_giao_viec');
  if p_category not in ('van_hanh', 'quan_ly') or not (p_topic = any(public.app__viec_topics(p_category))) then raise exception 'Loại / nhóm việc không hợp lệ.'; end if;
  update public.tasks set category = p_category, topic = p_topic, updated_at = public.vn_now_text() where id = p_task returning * into t;
  if t.id is null then raise exception 'Không tìm thấy công việc.'; end if;
end $$;

-- ---------------------------------------------------------------- Việc tự sinh
create or replace function public.app_viec_auto() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare out jsonb := '[]'; today text := to_char(public.vn_now(), 'YYYY-MM-DD'); nowhm text := to_char(public.vn_now(), 'HH24:MI'); x jsonb;
begin
  perform public.app__need('hop_giao_viec');
  -- Vận hành: ca chờ đối soát (30 ngày)
  select coalesce(jsonb_agg(jsonb_build_object('key', 'doi_soat:r=' || r.id, 'category', 'van_hanh', 'topic', 'doi_soat_ca',
            'title', 'Đối soát ' || public.app__ca_title(r) || case when r.recon_status = 'mo_lai' then ' (đang đối soát lại)' else '' end,
            'detail', 'Nhân viên đã hoàn thành phiếu ' || coalesce(r.completed_at, '') || ' · đã đối soát ' ||
                      (select count(*) from public.shift_report_checks c where c.report_id = r.id) || '/' || array_length(public.app__ca_check_items(), 1) || ' hạng mục',
            'link', '/ca/phieu?id=' || r.id, 'at', r.work_date) order by r.work_date, r.id), '[]') into x
    from public.shift_reports r
   where r.status = 'hoan_thanh' and r.recon_status <> 'hoan_thanh' and r.work_date >= to_char(public.vn_now() - interval '30 days', 'YYYY-MM-DD');
  out := out || x;
  -- Vận hành: ca quá giờ chưa chốt (3 ngày gần nhất, từ ngày bắt đầu dùng chốt ca trên web) — gộp mỗi ngày 1 việc
  select coalesce(jsonb_agg(jsonb_build_object('key', 'chua_chot:d=' || q.d, 'category', 'van_hanh', 'topic', 'doi_soat_ca',
            'title', q.n || ' ca quá giờ chưa chốt ngày ' || to_char(q.d::date, 'DD/MM/YYYY'),
            'detail', q.names, 'link', '/ca?ngay=' || q.d, 'at', q.d) order by q.d), '[]') into x
    from (select d.d, count(*) n,
                 string_agg(coalesce(b.display_code, b.code) || ' ' || sh.name || case when r.id is null then ' (chưa mở)' else ' (đang chốt dở)' end, ', ' order by b.sort_order, sh.sort_order) names
            from (select to_char(public.vn_now() - (g || ' days')::interval, 'YYYY-MM-DD') d from generate_series(0, 3) g) d
            cross join public.branches b
            join public.branch_shifts bs on bs.branch_id = b.id and bs.enabled = 1
            join public.shifts sh on sh.id = bs.shift_id and sh.status = 'Đang sử dụng'
            left join public.shift_reports r on r.branch_id = b.id and r.work_date = d.d and r.shift = sh.name
           where b.status = 'Đang hoạt động' and (r.id is null or r.status = 'dang_chot')
             and d.d >= coalesce((select min(work_date) from public.shift_reports), today)
             and (d.d < today or (bs.end_time is not null and left(bs.end_time::text, 5) < nowhm and bs.end_time > bs.start_time))
           group by d.d) q;
  out := out || x;
  -- Vận hành: khoản âm chưa xử lý (gộp 1 việc)
  select case when count(*) = 0 then '[]'::jsonb else jsonb_build_array(jsonb_build_object('key', 'khoan_am', 'category', 'van_hanh', 'topic', 'khoan_am',
            'title', 'Xử lý ' || count(*) || ' khoản âm chưa xử lý (' || public.app__vnd(sum(s.amount)::bigint) || ')',
            'detail', string_agg(distinct e.code || ' – ' || e.name, ', '), 'link', '/quan-ly/khoan-am', 'at', min(r.work_date))) end into x
    from public.shift_shortfalls s join public.employees e on e.id = s.employee_id join public.shift_reports r on r.id = s.report_id
   where s.status = 'chua_xu_ly';
  out := out || x;
  -- Quản lý: chưa đọc bản mới nội quy / quy trình
  select coalesce(jsonb_agg(jsonb_build_object('key', 'doc:d=' || q.id || ':v=' || q.published_version, 'category', 'quan_ly', 'topic', 'noi_quy',
            'title', q.n || ' nhân viên chưa đọc ' || case q.kind when 'noi_quy' then 'nội quy' else 'quy trình' end || ': ' || coalesce(q.published_title, q.title),
            'detail', q.names, 'link', case q.kind when 'noi_quy' then '/noi-quy' else '/quy-trinh' end, 'at', q.published_at) order by q.kind, q.sort_order), '[]') into x
    from (select dc.*, count(e.id) n, string_agg(e.code || ' – ' || e.name, ', ' order by e.code) filter (where e.id is not null) names
            from public.docs dc
            join public.employees e on e.status = 'Đang làm'
             and not exists (select 1 from public.doc_reads rd where rd.doc_id = dc.id and rd.employee_id = e.id and rd.version >= dc.published_version)
           where dc.published_version > 0
           group by dc.id) q
   where q.n > 0;
  out := out || x;
  -- Quản lý: cam kết
  select coalesce(jsonb_agg(jsonb_build_object('key', 'cam_ket:' || st, 'category', 'quan_ly', 'topic', 'cam_ket',
            'title', n || ' nhân viên ' || case st when 'chua_ky' then 'chưa ký cam kết' else 'đã ký nhưng chưa nộp cam kết' end,
            'detail', names, 'link', '/quan-ly/nhan-vien', 'at', null)), '[]') into x
    from (select coalesce(c.status, 'chua_ky') st, count(*) n, string_agg(e.code || ' – ' || e.name, ', ' order by e.code) names
            from public.employees e left join public.employee_commitments c on c.employee_id = e.id
           where e.status = 'Đang làm' and coalesce(c.status, 'chua_ky') <> 'da_ky_nop'
           group by 1) q;
  out := out || x;
  -- Quản lý: đào tạo quá hạn (đào tạo tiếp, chưa đạt)
  select coalesce(jsonb_agg(jsonb_build_object('key', 'dao_tao:t=' || t.id, 'category', 'quan_ly', 'topic', 'dao_tao',
            'title', 'Đào tạo tiếp: ' || e.code || ' – ' || e.name || ' (quá 8 ngày, ' || public.app__dt_achieved(t.id) || '/' || public.app__dt_total(t.program_id) || ' hạng mục)',
            'detail', 'Bắt đầu ' || to_char(t.start_date::date, 'DD/MM/YYYY') || coalesce(' · đào tạo tiếp: ' || t.cont_trainer_name, ''),
            'link', '/dao-tao/phieu?id=' || t.id, 'at', t.start_date) order by t.start_date), '[]') into x
    from public.trainings t join public.employees e on e.id = t.employee_id
   where e.status = 'Đang làm' and t.cont_result is null and public.app__dt_status(t) = 'dao_tao_tiep';
  out := out || x;
  -- bỏ việc đã giao (còn mở)
  return coalesce((select jsonb_agg(i) from jsonb_array_elements(out) i
                    where not exists (select 1 from public.tasks t where t.auto_key = i ->> 'key' and t.status <> 'hoan_thanh')), '[]');
end $$;

revoke execute on function public.app__viec_topics(text) from public, anon, authenticated;
revoke execute on function public.app_viec_add(bigint, jsonb), public.app_viec_set_topic(bigint, text, text), public.app_viec_auto() from public, anon;
grant execute on function public.app_viec_add(bigint, jsonb), public.app_viec_set_topic(bigint, text, text), public.app_viec_auto() to authenticated;
