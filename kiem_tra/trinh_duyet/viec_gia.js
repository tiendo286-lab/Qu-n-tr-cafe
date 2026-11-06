// Giả lập app_viec_* (Công việc: Chờ nhận → Đang xử lý → Đã xử lý) — chỉ để chạy thử giao diện.
// Có sẵn 1 cuộc họp, 3 việc giao cho Quản lý (tài khoản 5) và 1 việc giao cho Nhân viên (tài khoản 3).
export function makeViec(T, me) {
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const today = now().slice(0, 10);
  const add = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const QL = 5, NV = 3;
  T.meetings = [{ id: 1, title: 'Họp quản lý tuần', meeting_date: today, note: 'Ghi chú họp', created_by: 1, created_at: now() }];
  T.tasks = [
    { id: 1, meeting_id: 1, kind: 'viec', content: 'Sửa tủ mát LHP', assignee_id: QL, due_date: add(today, -1), status: 'da_giao', created_by: 1 },
    { id: 2, meeting_id: 1, kind: 'dao_tao', employee_id: 3, content: 'SOP 05 thanh toán', assignee_id: QL, due_date: today, status: 'dang_xu_ly', created_by: 1, review_note: 'Bổ sung phần hoàn tiền' },
    { id: 3, meeting_id: 1, kind: 'viec', content: 'Thay bóng đèn biển hiệu ĐK', assignee_id: QL, due_date: add(today, 3), status: 'hoan_thanh', report: 'Đã thay 2 bóng', done_at: now(), created_by: 1 },
    { id: 4, meeting_id: null, kind: 'viec', content: 'Lau kính mặt tiền LL', assignee_id: NV, due_date: null, status: 'da_giao', created_by: 1 },
  ];
  T.task_events = [];
  T.handover_items = T.handover_items || [];
  const HO = [{ id: 901, content: 'Máy xay số 2 kêu to', report_id: 1, branch: 'LHP', work_date: today, shift: 'Sáng', by: 'NV thử' }, { id: 902, content: 'Hết giấy in hóa đơn', report_id: 1, branch: 'LHP', work_date: today, shift: 'Sáng', by: 'NV thử' }];
  const hoClosed = new Set();
  const PEOPLE = [{ id: 6, name: '6 – QL tổng thử', role: 'ql_tong' }, { id: QL, name: '5 – Quản lý thử', role: 'ql' }, { id: NV, name: 'NV3 – Nhân viên thử', role: 'nv' }];
  const nid = (t) => Math.max(0, ...T[t].map((x) => x.id || 0)) + 1;
  const name = (aid) => (aid ? (PEOPLE.find((p) => p.id === aid)?.name || (aid === me.account_id ? `${me.code} – ${me.name}` : 'TK ' + aid)) : null);
  const ev = (task_id, action, note) => T.task_events.push({ id: nid('task_events'), task_id, at: now(), by_account: me.account_id, action, note });
  const json = (t) => ({ ...t, assignee_name: name(t.assignee_id), created_by_name: name(t.created_by),
    meeting_title: T.meetings.find((m) => m.id === t.meeting_id)?.title, meeting_date: T.meetings.find((m) => m.id === t.meeting_id)?.meeting_date,
    employee: t.employee_id ? (T.employees.find((e) => e.id === t.employee_id) || {}).code + ' – ' + (T.employees.find((e) => e.id === t.employee_id) || {}).name : null,
    source: null, overdue: ['da_giao', 'dang_xu_ly'].includes(t.status) && t.due_date && t.due_date < today,
    events: T.task_events.filter((e) => e.task_id === t.id).map((e) => ({ ...e, by: name(e.by_account) })) });
  const task = (id) => { const t = T.tasks.find((x) => x.id === id); if (!t) throw new Error('Không tìm thấy công việc.'); return t; };
  const F = {
    app_viec_people: () => PEOPLE,
    app_viec_pending: () => ({ handover: HO.filter((h) => !hoClosed.has(h.id) && !T.tasks.some((t) => t.handover_item_id === h.id)), tasks: T.tasks.filter((t) => t.status === 'chua_phan_cong').map(json) }),
    app_viec_handover_close({ p_item }) { if (hoClosed.has(p_item)) throw new Error('Đã xong.'); hoClosed.add(p_item); },
    app_viec_meetings: () => T.meetings.map((m) => ({ ...m, created_by: name(m.created_by), total: T.tasks.filter((t) => t.meeting_id === m.id).length, done: T.tasks.filter((t) => t.meeting_id === m.id && t.status === 'hoan_thanh').length, waiting: 0 })),
    app_viec_meeting_save({ p_id, p_title, p_date, p_note }) {
      if (!p_title?.trim()) throw new Error('Nhập tên cuộc họp.');
      if (!p_id) { const id = nid('meetings'); T.meetings.push({ id, title: p_title, meeting_date: p_date, note: p_note, created_by: me.account_id }); return id; }
      Object.assign(T.meetings.find((m) => m.id === p_id), { title: p_title, meeting_date: p_date, note: p_note }); return p_id;
    },
    app_viec_meeting_delete({ p_id }) { if (T.tasks.some((t) => t.meeting_id === p_id)) throw new Error('Cuộc họp đã có công việc.'); T.meetings = T.meetings.filter((m) => m.id !== p_id); },
    app_viec_meeting_get({ p_id }) {
      const m = T.meetings.find((x) => x.id === p_id); if (!m) throw new Error('Không tìm thấy cuộc họp.');
      return { ...m, created_by_name: name(m.created_by), tasks: T.tasks.filter((t) => t.meeting_id === m.id).map(json),
        open_handover: [{ id: 901, content: 'Máy xay số 2 kêu to', report_id: 1, branch: 'LHP', work_date: today, shift: 'Sáng', by: 'NV thử' }].filter((h) => !T.tasks.some((t) => t.handover_item_id === h.id)),
        managers: PEOPLE,
        employees: T.employees.filter((e) => e.status === 'Đang làm').map(({ id, code, name: n, rank }) => ({ id, code, name: n, rank })) };
    },
    app_viec_add({ p_meeting, p }) {
      const content = (p.content || (p.handover_item_id ? HO.find((h) => h.id === p.handover_item_id).content : '')).trim(); if (!content) throw new Error('Nhập nội dung công việc.');
      if (p.kind === 'dao_tao' && !p.employee_id) throw new Error('Chọn nhân viên cần đào tạo.');
      const id = nid('tasks'); T.tasks.push({ id, meeting_id: p_meeting || null, kind: p.kind || 'viec', content, handover_item_id: p.handover_item_id || null, employee_id: p.employee_id || null, status: 'chua_phan_cong', created_by: me.account_id });
      ev(id, 'tao'); if (p.assignee_id || p.due_date) F.app_viec_update({ p_task: id, p }); return id;
    },
    app_viec_update({ p_task, p }) {
      const t = task(p_task); if (t.status === 'hoan_thanh') throw new Error('Việc đã xử lý xong.');
      const ass = 'assignee_id' in p ? (p.assignee_id ? Number(p.assignee_id) : null) : t.assignee_id;
      const due = 'due_date' in p ? p.due_date || null : t.due_date;
      if ('content' in p && p.content?.trim()) t.content = p.content.trim();
      const changed = ass && ass !== t.assignee_id;
      t.status = !ass ? 'chua_phan_cong' : changed ? 'da_giao' : t.status;
      if (changed) ev(t.id, 'giao', name(ass));
      t.assignee_id = ass; t.due_date = due;
    },
    app_viec_delete({ p_task }) { const t = task(p_task); T.tasks = T.tasks.filter((x) => x !== t); },
    app_viec_all: () => T.tasks.map(json),
    app_viec_reopen({ p_task, p_note }) {
      const t = task(p_task); if (!p_note?.trim()) throw new Error('Ghi lý do yêu cầu làm lại.'); if (t.status !== 'hoan_thanh') throw new Error('Chỉ yêu cầu làm lại được việc đã xử lý.');
      Object.assign(t, { status: 'dang_xu_ly', review_note: p_note, done_at: null }); ev(t.id, 'lam_lai', p_note);
    },
    app_viec_mine: () => T.tasks.filter((t) => t.assignee_id === me.account_id && t.status !== 'chua_phan_cong').map(json),
    app_viec_start({ p_task }) { const t = task(p_task); if (t.assignee_id !== me.account_id || t.status !== 'da_giao') throw new Error('Việc này không còn ở trạng thái Chờ nhận.'); t.status = 'dang_xu_ly'; ev(t.id, 'bat_dau'); },
    app_viec_submit({ p_task, p_report }) {
      const t = task(p_task); if (t.assignee_id !== me.account_id || !['da_giao', 'dang_xu_ly'].includes(t.status)) throw new Error('Không báo xử lý được.');
      Object.assign(t, { status: 'hoan_thanh', report: p_report?.trim() || null, done_at: now(), review_note: null }); ev(t.id, 'bao_cao', t.report);
    },
    app_viec_reminder() {
      const open = T.tasks.filter((t) => t.assignee_id === me.account_id && ['da_giao', 'dang_xu_ly'].includes(t.status));
      return { overdue: open.filter((t) => t.due_date && t.due_date < today).length, today: open.filter((t) => t.due_date === today).length, open: open.length,
        new: open.filter((t) => t.status === 'da_giao').length, waiting: 0, to_review: me.role === 'chu' ? F.app_viec_pending().handover.length + F.app_viec_pending().tasks.length : 0,
        items: open.map((t) => ({ id: t.id, content: t.content, due_date: t.due_date, status: t.status, kind: t.kind, group: t.due_date && t.due_date < today ? 'overdue' : t.due_date === today ? 'today' : 'open' })) };
    },
  };
  return F;
}
