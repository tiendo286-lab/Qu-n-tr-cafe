// Giả lập app_viec_* (Họp & giao việc) — chỉ để chạy thử giao diện. Có sẵn 1 cuộc họp, 3 việc giao cho tài khoản Quản lý (id 5).
export function makeViec(T, me) {
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const today = now().slice(0, 10);
  const add = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const QL = 5;
  T.meetings = [{ id: 1, title: 'Họp quản lý tuần', meeting_date: today, note: 'Ghi chú họp', created_by: 1, created_at: now() }];
  T.tasks = [
    { id: 1, meeting_id: 1, kind: 'viec', content: 'Sửa tủ mát LHP', assignee_id: QL, due_date: add(today, -1), status: 'da_giao', created_by: 1 },
    { id: 2, meeting_id: 1, kind: 'dao_tao', employee_id: 3, content: 'SOP 05 thanh toán', assignee_id: QL, due_date: today, status: 'dang_xu_ly', created_by: 1, review_note: 'Bổ sung phần hoàn tiền' },
    { id: 3, meeting_id: 1, kind: 'viec', content: 'Thay bóng đèn biển hiệu ĐK', assignee_id: QL, due_date: add(today, 3), status: 'cho_duyet', report: 'Đã thay 2 bóng', submitted_at: now(), created_by: 1 },
  ];
  T.task_events = [];
  T.handover_items = T.handover_items || [];
  const nid = (t) => Math.max(0, ...T[t].map((x) => x.id || 0)) + 1;
  const name = (aid) => (aid ? (aid === QL ? '5 – Quản lý thử' : aid === me.account_id ? `${me.code} – ${me.name}` : 'TK ' + aid) : null);
  const ev = (task_id, action, note) => T.task_events.push({ id: nid('task_events'), task_id, at: now(), by_account: me.account_id, action, note });
  const json = (t) => ({ ...t, assignee_name: name(t.assignee_id), created_by_name: name(t.created_by), approved_by_name: name(t.approved_by),
    meeting_title: T.meetings.find((m) => m.id === t.meeting_id)?.title, meeting_date: T.meetings.find((m) => m.id === t.meeting_id)?.meeting_date,
    employee: t.employee_id ? (T.employees.find((e) => e.id === t.employee_id) || {}).code + ' – ' + (T.employees.find((e) => e.id === t.employee_id) || {}).name : null,
    source: null, overdue: !['hoan_thanh', 'cho_duyet'].includes(t.status) && t.due_date && t.due_date < today,
    events: T.task_events.filter((e) => e.task_id === t.id).map((e) => ({ ...e, by: name(e.by_account) })) });
  const task = (id) => { const t = T.tasks.find((x) => x.id === id); if (!t) throw new Error('Không tìm thấy công việc.'); return t; };
  const F = {
    app_viec_meetings: () => T.meetings.map((m) => ({ ...m, created_by: name(m.created_by), total: T.tasks.filter((t) => t.meeting_id === m.id).length, done: T.tasks.filter((t) => t.meeting_id === m.id && t.status === 'hoan_thanh').length, waiting: T.tasks.filter((t) => t.meeting_id === m.id && t.status === 'cho_duyet').length })),
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
        managers: [{ id: QL, name: name(QL), role: 'ql' }, { id: 6, name: 'TK 6', role: 'ql_tong' }],
        employees: T.employees.filter((e) => e.status === 'Đang làm').map(({ id, code, name: n, rank }) => ({ id, code, name: n, rank })) };
    },
    app_viec_add({ p_meeting, p }) {
      const content = (p.content || (p.handover_item_id ? 'Máy xay số 2 kêu to' : '')).trim(); if (!content) throw new Error('Nhập nội dung công việc.');
      if (p.kind === 'dao_tao' && !p.employee_id) throw new Error('Chọn nhân viên cần đào tạo.');
      const id = nid('tasks'); T.tasks.push({ id, meeting_id: p_meeting, kind: p.kind || 'viec', content, handover_item_id: p.handover_item_id || null, employee_id: p.employee_id || null, status: 'chua_phan_cong', created_by: me.account_id });
      ev(id, 'tao'); if (p.assignee_id || p.due_date) F.app_viec_update({ p_task: id, p }); return id;
    },
    app_viec_update({ p_task, p }) {
      const t = task(p_task); if (['cho_duyet', 'hoan_thanh'].includes(t.status)) throw new Error('Việc đang chờ duyệt hoặc đã hoàn thành.');
      const ass = 'assignee_id' in p ? (p.assignee_id ? Number(p.assignee_id) : null) : t.assignee_id;
      const due = 'due_date' in p ? p.due_date || null : t.due_date;
      if ('content' in p && p.content?.trim()) t.content = p.content.trim();
      const newly = ass && due && (t.status === 'chua_phan_cong' || ass !== t.assignee_id);
      t.status = !ass ? 'chua_phan_cong' : newly ? 'da_giao' : (!due && t.status === 'chua_phan_cong' ? 'chua_phan_cong' : t.status);
      if (newly) ev(t.id, 'giao', name(ass));
      t.assignee_id = ass; t.due_date = due;
    },
    app_viec_delete({ p_task }) { const t = task(p_task); if (t.status === 'hoan_thanh') throw new Error('Việc đã hoàn thành.'); T.tasks = T.tasks.filter((x) => x !== t); },
    app_viec_all: () => T.tasks.map(json),
    app_viec_mine: () => T.tasks.filter((t) => t.assignee_id === me.account_id && t.status !== 'chua_phan_cong').map(json),
    app_viec_start({ p_task }) { const t = task(p_task); if (t.status !== 'da_giao') throw new Error('Không ở trạng thái Đã giao.'); t.status = 'dang_xu_ly'; ev(t.id, 'bat_dau'); },
    app_viec_submit({ p_task, p_report }) { const t = task(p_task); if (!p_report?.trim()) throw new Error('Nhập báo cáo.'); t.status = 'cho_duyet'; t.report = p_report; t.submitted_at = now(); ev(t.id, 'bao_cao', p_report); },
    app_viec_review({ p_task, p_ok, p_note }) {
      const t = task(p_task); if (t.status !== 'cho_duyet') throw new Error('Không ở trạng thái Chờ duyệt.');
      if (p_ok) Object.assign(t, { status: 'hoan_thanh', approved_by: me.account_id, approved_at: now() }); else { if (!p_note?.trim()) throw new Error('Ghi ý kiến.'); Object.assign(t, { status: 'dang_xu_ly', review_note: p_note }); }
      ev(t.id, p_ok ? 'duyet' : 'lam_lai', p_note);
    },
    app_viec_reminder() {
      const mine = T.tasks.filter((t) => t.assignee_id === me.account_id && ['da_giao', 'dang_xu_ly', 'cho_duyet'].includes(t.status));
      const open = mine.filter((t) => t.status !== 'cho_duyet');
      return { overdue: open.filter((t) => t.due_date < today).length, today: open.filter((t) => t.due_date === today).length, open: open.length,
        waiting: mine.length - open.length, to_review: me.role === 'chu' ? T.tasks.filter((t) => t.status === 'cho_duyet').length : 0,
        items: mine.map((t) => ({ id: t.id, content: t.content, due_date: t.due_date, status: t.status, kind: t.kind, group: t.status === 'cho_duyet' ? 'waiting' : t.due_date < today ? 'overdue' : t.due_date === today ? 'today' : 'open' })) };
    },
  };
  return F;
}
