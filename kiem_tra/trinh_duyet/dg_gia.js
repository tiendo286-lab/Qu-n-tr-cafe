// Giả lập app_dg_* (Đánh giá nhân viên) + app_dt_guide* (hướng dẫn sổ tay trong phiếu đào tạo) — chỉ để chạy thử giao diện
export function makeDg(T, me) {
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const today = now().slice(0, 10); const mon = today.slice(0, 7);
  const SETS = [{ code: 'pc', name: 'Pha chế' }, { code: 'cb', name: 'Chạy bàn' }];
  const NAMES = { pc: ['Đi làm đúng giờ', 'Trang phục/đồng phục đúng quy định', 'Giữ vệ sinh quầy, sắp xếp gọn gàng'], cb: ['Đi làm đúng giờ', 'Trang phục/đồng phục sạch sẽ, gọn gàng', 'Chào khách, giao tiếp lễ phép, niềm nở'] };
  const CRIT = SETS.flatMap((s) => Array.from({ length: 20 }, (_, i) => ({ code: `${s.code.toUpperCase()}${String(i + 1).padStart(3, '0')}`, set_code: s.code, name: NAMES[s.code][i] || `${s.name} tiêu chí ${i + 1}` })));
  T.employee_eval_sets = T.employee_eval_sets || [{ employee_id: 3, set_code: 'cb' }];
  T.eval_open = T.eval_open || [];
  T.eval_marks = T.eval_marks || [
    { id: 1, employee_id: 3, work_date: `${mon}-02`, criterion: 'CB001', points: 2, note: 'Đi muộn 10 phút', status: 'tru', created_by: 'admin – Chủ', created_at: now() },
    { id: 2, employee_id: 3, work_date: `${mon}-03`, criterion: 'CB003', points: 0, note: 'Quên chào khách', status: 'tru', reply: 'Em đang bưng khay', reply_at: now(), created_by: 'admin – Chủ', created_at: now() },
    { id: 3, employee_id: 3, work_date: '2026-09-15', criterion: 'CB001', points: 3, note: 'Đi muộn 20 phút', status: 'tru', created_by: 'admin – Chủ', created_at: '2026-09-15 08:00:00' },
  ];
  const emp = (id) => T.employees.find((e) => e.id === id);
  const setOf = (id) => (T.employee_eval_sets.find((x) => x.employee_id === id) || {}).set_code || (/pha/i.test(emp(id)?.preferred_role || '') ? 'pc' : /bàn/i.test(emp(id)?.preferred_role || '') ? 'cb' : null);
  const isOpen = (m) => { const [y, mo] = m.split('-').map(Number); return today <= new Date(Date.UTC(y, mo, 5)).toISOString().slice(0, 10) || T.eval_open.includes(m); };
  const score = (id, m) => { const u = {}; T.eval_marks.filter((x) => x.employee_id === id && x.work_date.startsWith(m) && x.status === 'tru').forEach((x) => { u[x.criterion] = (u[x.criterion] || 0) + x.points; }); return 100 - Object.values(u).reduce((s, v) => s + Math.min(5, v), 0); };
  const js = (m) => ({ id: m.id, employee_id: m.employee_id, date: m.work_date, month: m.work_date.slice(0, 7), criterion: m.criterion, criterion_name: CRIT.find((c) => c.code === m.criterion).name,
    points: m.points, note: m.note, photo: m.photo || null, report_id: m.report_id || null, shift: m.shift || null, branch: m.branch || null, status: m.status, reply: m.reply || null, reply_at: m.reply_at || null,
    reviewed_at: m.reviewed_at || null, reviewed_by: m.reviewed_at ? 'admin – Chủ' : null, review_note: m.review_note || null, pending: m.status === 'tru' && !!m.reply && !m.reviewed_at,
    created_by: m.created_by, created_at: m.created_at, open: isOpen(m.work_date.slice(0, 7)) });
  const mk = (id) => { const m = T.eval_marks.find((x) => x.id === id && x.status !== 'huy'); if (!m) throw new Error('Không tìm thấy lần đánh giá này.'); return m; };
  const need = () => { if (!me.perms.doi_soat) throw new Error('Bạn không có quyền thực hiện thao tác này.'); };
  const lockChk = (d) => { if (!isOpen(d.slice(0, 7))) throw new Error(`Tháng ${d.slice(0, 7)} đã khóa đánh giá. Nhờ Chủ mở lại.`); };
  const dl = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 5)).toISOString().slice(0, 10); };
  // 1 bài quy trình có hướng dẫn cho hạng mục 1–3, 15; bài sửa trực tiếp trên web như trước
  if (T.docs && !T.docs.some((d) => d.id === 90)) T.docs.push({ id: 90, kind: 'quy_trinh', title: 'SOP 01 – Đón khách và sắp xếp chỗ ngồi', sort_order: 1, from_file: false,
    draft_html: null, published_html: '<h2>SOP 01 · Đón khách</h2><h3>Bước 1 · Phát hiện và chào khách</h3><p><em>◆ Đào tạo: Ngày 1 · STT 1</em></p><p><strong>LHP · 2 ảnh</strong></p><p><img data-path="so-tay/a.jpg" alt=""><img data-path="so-tay/b.jpg" alt=""></p><table><tbody><tr><td>Khách vừa bước vào</td><td>“Em chào anh/chị ạ!”</td></tr></tbody></table><blockquote><p><strong>✔ Tiêu chuẩn đạt:</strong> Chủ động chào.</p></blockquote>',
    published_title: 'SOP 01 – Đón khách và sắp xếp chỗ ngồi', published_version: 1, published_at: now(), updated_at: now() });
  { const x = T.docs && T.docs.find((d) => d.id === 90); if (x && !x.draft_html) x.draft_html = x.published_html; }
  const G = { 1: [{ seq: 1, heading: 'SOP 01 · Bước 1', html: '<h3>Bước 1 · Phát hiện và chào khách</h3><p>1. Quan sát cửa ra vào.</p><p><img data-path="so-tay/a.jpg" alt=""><img data-path="so-tay/b.jpg" alt=""></p><blockquote><p><strong>✔ Tiêu chuẩn đạt:</strong> Chủ động chào.</p></blockquote>', doc_id: 90, doc_title: 'SOP 01 – Đón khách và sắp xếp chỗ ngồi' }],
    2: [{ seq: 1, heading: 'SOP 01 · Bước 2', html: '<h3>Bước 2 · Hướng dẫn chỗ ngồi</h3><p>Hỏi khách muốn ngồi đâu.</p>', doc_id: 90, doc_title: 'SOP 01 – Đón khách' }],
    15: [{ seq: 1, heading: '1.1 Đầu ca sáng · 1. Bật điện', html: '<h3>1. Bật điện và mở cửa</h3><p>Giờ: 6h45</p>', doc_id: 90, doc_title: '1.1 Đầu ca sáng' },
      { seq: 2, heading: '1.6 Đầu ca tối · 1. Bật điện', html: '<h3>1. Bật điện</h3><p>Ca tối bật đèn vàng.</p>', doc_id: 90, doc_title: '1.6 Đầu ca tối' }] };
  return {
    app_dt_guide_items: () => Object.keys(G).map(Number),
    app_dt_guide: ({ p_item }) => { const it = (window.__DT_PROG || []).find((i) => i.no === p_item) || { no: p_item, day: 1, title: 'Hạng mục ' + p_item, page: '41' }; return { item: it, guides: G[p_item] || [] }; },
    app_dg_board({ p_month, p_branch }) {
      need(); const m = p_month || mon;
      const emps = T.employees.filter((e) => (e.status === 'Đang làm' || T.eval_marks.some((x) => x.employee_id === e.id && x.work_date.startsWith(m) && x.status !== 'huy')) &&(!p_branch || T.employee_branches.some((x) => x.employee_id === e.id && x.branch_id === p_branch)));
      return { month: m, open: isOpen(m), reopened: T.eval_open.includes(m), deadline: dl(m), is_owner: me.role === 'chu', me_employee: me.employee_id, sets: SETS, criteria: CRIT,
        branches: T.branches.map((b) => ({ id: b.id, code: b.code, name: b.name })),
        employees: emps.map((e) => ({ id: e.id, code: e.code, name: e.name, rank: e.rank, status: e.status, branches: [], set_code: setOf(e.id), set_saved: T.employee_eval_sets.some((x) => x.employee_id === e.id),
          score: score(e.id, m), n_tru: T.eval_marks.filter((x) => x.employee_id === e.id && x.work_date.startsWith(m) && x.status === 'tru' && x.points > 0).length,
          n_nhac: T.eval_marks.filter((x) => x.employee_id === e.id && x.work_date.startsWith(m) && x.status === 'tru' && x.points === 0).length,
          pending: T.eval_marks.filter((x) => x.employee_id === e.id && x.status === 'tru' && x.reply && !x.reviewed_at).length })),
        pending: T.eval_marks.filter((x) => x.status === 'tru' && x.reply && !x.reviewed_at).map((x) => ({ ...js(x), employee: `${emp(x.employee_id).code} – ${emp(x.employee_id).name}` })) };
    },
    app_dg_history({ p_employee }) {
      need(); const e = emp(p_employee);
      return { employee: { id: e.id, code: e.code, name: e.name, rank: e.rank, set_code: setOf(e.id), set_saved: T.employee_eval_sets.some((x) => x.employee_id === e.id), is_me: me.employee_id === e.id },
        month: mon, score: score(e.id, mon), today, sets: SETS, criteria: CRIT, open_months: T.eval_open,
        marks: T.eval_marks.filter((x) => x.employee_id === e.id && x.status !== 'huy').sort((a, b) => (b.work_date + b.id).localeCompare(a.work_date + a.id)).map(js) };
    },
    app_dg_add({ p_employee, p_date, p_criterion, p_points, p_note, p_photo, p_report, p_set }) {
      need(); if (me.employee_id === p_employee) throw new Error('Không tự trừ điểm của mình được.');
      let d = p_date; let shift = null; let branch = null;
      if (p_report) { const r = (T.shift_reports || []).find((x) => x.id === p_report) || {}; d = r.work_date || today; shift = r.shift; branch = 'LHP'; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) throw new Error('Chọn ngày phạm lỗi.');
      lockChk(d);
      if (!(p_points >= 0 && p_points <= 5)) throw new Error('Chọn Nhắc nhở hoặc trừ 1–5 điểm.');
      if (!String(p_note || '').trim()) throw new Error('Ghi rõ nhân viên phạm lỗi gì.');
      if (p_set) { T.employee_eval_sets = T.employee_eval_sets.filter((x) => x.employee_id !== p_employee); T.employee_eval_sets.push({ employee_id: p_employee, set_code: p_set }); }
      const st = setOf(p_employee); if (!st) throw new Error('Chọn bộ tiêu chí (Pha chế / Chạy bàn) cho nhân viên này trước.');
      if (!T.employee_eval_sets.some((x) => x.employee_id === p_employee)) T.employee_eval_sets.push({ employee_id: p_employee, set_code: st });
      const c = CRIT.find((x) => x.code === p_criterion); if (!c) throw new Error('Chọn tiêu chí.'); if (c.set_code !== st) throw new Error('Tiêu chí này không thuộc bộ tiêu chí của nhân viên.');
      const id = Math.max(0, ...T.eval_marks.map((x) => x.id)) + 1;
      T.eval_marks.push({ id, employee_id: p_employee, work_date: d, criterion: c.code, points: p_points, note: p_note.trim(), photo: p_photo, report_id: p_report, shift, branch, status: 'tru', created_by: me.name, created_at: now() });
      return id;
    },
    app_dg_edit({ p_id, p_criterion, p_points, p_note }) { need(); const m = mk(p_id); lockChk(m.work_date); if (!String(p_note || '').trim()) throw new Error('Ghi rõ nhân viên phạm lỗi gì.'); Object.assign(m, { criterion: p_criterion, points: p_points, note: p_note }); },
    app_dg_delete({ p_id }) { need(); const m = mk(p_id); lockChk(m.work_date); m.status = 'huy'; },
    app_dg_resolve({ p_id, p_keep, p_note }) { need(); const m = mk(p_id); lockChk(m.work_date); Object.assign(m, { status: p_keep ? 'tru' : 'hoan', reviewed_at: now(), review_note: p_note || null }); },
    app_dg_set({ p_employee, p_set }) { need(); T.employee_eval_sets = T.employee_eval_sets.filter((x) => x.employee_id !== p_employee); T.employee_eval_sets.push({ employee_id: p_employee, set_code: p_set }); },
    app_dg_month_open({ p_month, p_open }) { if (me.role !== 'chu') throw new Error('Chỉ Chủ được mở lại / khóa lại tháng đánh giá.'); T.eval_open = T.eval_open.filter((x) => x !== p_month); if (p_open) T.eval_open.push(p_month); },
    app_dg_rename({ p_code, p_name }) { if (me.role !== 'chu') throw new Error('Chỉ Chủ được sửa tên tiêu chí.'); if (!String(p_name || '').trim()) throw new Error('Nhập tên tiêu chí.'); CRIT.find((c) => c.code === p_code).name = p_name.trim(); },
    app_dg_report({ p_report }) { need(); return T.eval_marks.filter((x) => x.report_id === p_report && x.status !== 'huy').map(js); },
    app_dg_mine() {
      if (!me.employee_id) return { month: mon, score: null, marks: [], criteria: [], months: [] };
      const st = setOf(me.employee_id); const mine = T.eval_marks.filter((x) => x.employee_id === me.employee_id && x.status !== 'huy');
      const months = [...new Set(mine.map((x) => x.work_date.slice(0, 7)))].sort().reverse();
      return { month: mon, set_code: st, set_name: (SETS.find((s) => s.code === st) || {}).name, score: score(me.employee_id, mon), criteria: CRIT.filter((c) => c.set_code === st),
        months: months.map((m) => ({ month: m, score: score(me.employee_id, m), rating: 'Tốt' })), marks: mine.sort((a, b) => (b.work_date + b.id).localeCompare(a.work_date + a.id)).map(js) };
    },
    app_dg_reply({ p_id, p_text }) { const m = mk(p_id); if (m.employee_id !== me.employee_id) throw new Error('Không tìm thấy.'); if (m.reviewed_at) throw new Error('Quản lý đã xem lần đánh giá này nên không gửi giải trình nữa.'); if (!String(p_text || '').trim()) throw new Error('Nhập nội dung giải trình.'); Object.assign(m, { reply: p_text.trim(), reply_at: now() }); },
  };
}
