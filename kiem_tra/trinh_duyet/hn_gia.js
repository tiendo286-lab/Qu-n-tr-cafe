// Giả lập app_today_me (Việc hôm nay, bước 138) — chỉ để chạy thử giao diện.
// Tham số: hnca=0|1|2 (số ca hôm nay của nhân viên, mặc định 1), hnorder=0|1|sent (đợt Order), hnfail=dt (app_dt_work_list báo lỗi).
export function makeHn(T, me) {
  const q = new URLSearchParams(location.search);
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const nCa = me.employee_id ? Number(q.get('hnca') ?? 1) : 0;
  const ord = q.get('hnorder') || '0';
  const ca = [
    { shift: 'Sáng', branch_id: 1, branch: 'LHP', role: 'Pha chế', start: '06:45', end: '12:30', report_id: 11, report_status: 'hoan_thanh', recon_status: 'chua' },
    { shift: 'Tối', branch_id: 1, branch: 'LHP', role: 'Pha chế', start: '17:30', end: '23:00', report_id: null, report_status: null, recon_status: null },
  ];
  // bước 141: việc Nội quy / Cam kết tính từ dữ liệu thử của tl_gia.js (T.docs, T.doc_reads, T.employee_commitments)
  const add12 = (d) => new Date(Date.parse(String(d).slice(0, 10)) + 12 * 864e5).toISOString().slice(0, 10);
  const pub = () => (T.docs || []).filter((d) => d.kind === 'noi_quy' && d.published_version > 0);
  const isRead = (d, emp) => (T.doc_reads || []).some((r) => r.doc_id === d.id && r.employee_id === emp && r.version === d.published_version);
  const commitOf = (emp) => ((T.employee_commitments || []).find((c) => c.employee_id === emp) || {}).status || 'chua_ky';
  const commitDue = (e) => add12([String(e.start_date || '').slice(0, 10), '2026-11-18'].sort().pop());
  const active = () => (T.employees || []).filter((e) => e.status === 'Đang làm');
  const owner = me.role === 'ke_toan' || (me.role !== 'chu' && !!me.perms.ke_toan);
  const out = {
    app_today_me: () => {
      const emp = me.employee_id; const unread = emp ? pub().filter((d) => !isRead(d, emp)) : [];
      const meE = (T.employees || []).find((e) => e.id === emp) || {};
      const pending = active().filter((e) => commitOf(e.id) !== 'da_ky_nop');
      return { today: now().slice(0, 10), now: now(), has_employee: !!emp, shifts: ca.slice(0, nCa),
        order: emp && ord !== '0' ? { week_id: 99, start_date: '2026-11-23', close_at: '2026-11-19T22:00', close_text: '22:00 Thứ Năm 19/11', submitted: ord === 'sent' } : null,
        rules: unread.length ? { total: pub().length, read: pub().length - unread.length, due: unread.map((d) => add12(d.published_at)).sort()[0], first_unread: unread[0].id } : null,
        commit: emp && commitOf(emp) !== 'da_ky_nop' ? { status: commitOf(emp), due: commitDue(meE) } : null,
        follow: owner ? { rules: pub().map((d) => ({ doc_id: d.id, title: d.published_title || d.title, version: d.published_version, due: add12(d.published_at),
          unread: active().filter((e) => !isRead(d, e.id)).length })).filter((x) => x.unread),
        commit: { pending: pending.length, overdue: 0, due: pending.map(commitDue).sort()[0] || null } } : null };
    },
    app_tl_follow: () => {
      if (!me.perms.ke_toan && !me.perms.quan_ly_nhan_vien) throw new Error('Bạn không có quyền xem theo dõi nội quy và cam kết.');
      return { today: now().slice(0, 10), can_edit: true,
        docs: pub().map((d) => ({ id: d.id, title: d.published_title || d.title, version: d.published_version, published_at: d.published_at, due: add12(d.published_at) })),
        rows: active().map((e) => ({ employee_id: e.id, code: e.code, name: e.name, rank: e.rank, start_date: e.start_date,
          unread: pub().filter((d) => !isRead(d, e.id)).map((d) => d.id), commit: commitOf(e.id), commit_at: null, commit_by: null, commit_due: commitDue(e) })) };
    },
  };
  // bước 142: app_today_more — việc mình đã báo xong chờ kiểm tra, việc xong hôm nay, đào tạo đã giao (Quản lý / Chủ). hnfail=more → lỗi.
  out.app_today_more = () => {
    if (q.get('hnfail') === 'more') throw new Error('Lỗi thử');
    const d = now().slice(0, 10); const mgr = ['ql', 'chu'].includes(me.role);
    return { today: d,
      review_wait: [{ id: 901, content: 'Sắp lại kệ ly quầy bar', branch_id: 1, code: 'LHP', status: 'cho_duyet', priority: 'binh_thuong', handover: false, src: 'Giao tay',
        assignee_id: me.account_id, assignee: me.name, reviewer_id: me.account_id === 6 ? 5 : 6, reviewer: me.account_id === 6 ? '5 – Quản lý thử' : 'NV01 – QL tổng thử', review_due: d + ' 22:00:00', submitted_at: now() }],
      done_today: [{ kind: 'pc', id: 801, job: 1, title: 'Đối soát Ca Tối LHP', code: 'LHP', at: d + ' 08:40:00', who: me.name },
        { kind: 'gv', id: 802, title: 'Rửa bình đá ngoài sân', code: 'ĐK', handover: false, at: d + ' 09:15:00', by: 'NV01 – QL tổng thử', who: me.name }],
      followups: mgr ? [{ training_id: 1, employee: 'HV1 – Học viên thử', item_no: 3, item: 'Mời nước khách', stage: 'chua_gioi_thieu', instructor: 'Nhân viên hướng dẫn thử', due: add12(d) },
        { training_id: 1, employee: 'HV1 – Học viên thử', item_no: 5, item: 'Dọn bàn đúng quy trình', stage: 'da_gioi_thieu', instructor: 'Nhân viên hướng dẫn thử', due: add12(d) }] : [] };
  };
  if (q.get('hnfail') === 'dt') out.app_dt_work_list = () => { throw new Error('Lỗi thử'); };
  return out;
}
