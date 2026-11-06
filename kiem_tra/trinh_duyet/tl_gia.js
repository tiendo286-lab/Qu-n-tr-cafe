// Giả lập app_tl_* (Nội quy, Quy trình, Cam kết) — chỉ để chạy thử giao diện
export function makeTl(T, me) {
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  T.docs = [
    { id: 1, kind: 'noi_quy', title: 'Nội quy chung', sort_order: 0, draft_html: '<h2>Giờ giấc</h2><p>Đến trước <b>10 phút</b>.</p><table><thead><tr><th>Ca</th><th>Giờ có mặt</th></tr></thead><tbody><tr><td>Sáng</td><td>06:35</td></tr></tbody></table><p><img data-path="d1/a.jpg" alt=""></p>',
      published_html: '<h2>Giờ giấc</h2><p>Đến trước <b>10 phút</b>.</p><table><thead><tr><th>Ca</th><th>Giờ có mặt</th></tr></thead><tbody><tr><td>Sáng</td><td>06:35</td></tr></tbody></table><p><img data-path="d1/a.jpg" alt=""></p><script>window.__XSS=1</script><img src=x onerror="window.__XSS=2">',
      published_title: 'Nội quy chung', published_version: 1, published_at: now(), published_by: 1, updated_at: now(), updated_by: 1 },
    { id: 2, kind: 'quy_trinh', title: 'Mở cửa ca sáng', sort_order: 0, draft_html: '<ol><li>Bật điện</li><li>Kê bàn ghế</li></ol>', published_html: '<ol><li>Bật điện</li><li>Kê bàn ghế</li></ol>',
      published_title: 'Mở cửa ca sáng', published_version: 1, published_at: now(), published_by: 1, updated_at: now(), updated_by: 1 },
  ];
  T.doc_reads = []; T.employee_commitments = [];
  const editor = !!me.perms.soan_tai_lieu;
  const nid = (t) => Math.max(0, ...T[t].map((x) => x.id || 0)) + 1;
  const doc = (id) => { const d = T.docs.find((x) => x.id === id); if (!d) throw new Error('Không tìm thấy tài liệu.'); return d; };
  const read = (d, emp) => T.doc_reads.find((r) => r.doc_id === d.id && r.employee_id === emp);
  return {
    app_tl_list: ({ p_kind }) => T.docs.filter((d) => d.kind === p_kind && (editor || d.published_version > 0)).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map((d) => ({ ...d, title: editor ? d.title : d.published_title, has_draft: editor && (d.draft_html !== (d.published_html || '') || d.title !== d.published_title),
        read_version: read(d, me.employee_id)?.version ?? null, read_at: read(d, me.employee_id)?.read_at ?? null, published_by: 'admin – Chủ', updated_by: 'admin – Chủ' })),
    app_tl_get: ({ p_id }) => { if (!editor) throw new Error('Bạn không có quyền.'); return { ...doc(p_id) }; },
    app_tl_save({ p_id, p_kind, p_title, p_html }) {
      if (!p_title?.trim()) throw new Error('Nhập tiêu đề tài liệu.');
      window.__LAST_HTML = p_html; if (!p_id) { const id = nid('docs'); T.docs.push({ id, kind: p_kind, title: p_title, draft_html: p_html, sort_order: 9, published_version: 0, updated_at: now() }); return id; }
      Object.assign(doc(p_id), { title: p_title, draft_html: p_html, updated_at: now() }); window.__LAST_HTML = p_html; return p_id;
    },
    app_tl_publish({ p_id }) { const d = doc(p_id); if (!d.draft_html.replace(/<[^>]*>/g, '').trim() && !/<img/i.test(d.draft_html)) throw new Error('Tài liệu đang trống.'); Object.assign(d, { published_html: d.draft_html, published_title: d.title, published_version: d.published_version + 1, published_at: now() }); return d.published_version; },
    app_tl_unpublish({ p_id }) { Object.assign(doc(p_id), { published_html: null, published_title: null, published_version: 0 }); },
    app_tl_delete({ p_id }) { const d = doc(p_id); T.docs = T.docs.filter((x) => x !== d); return [...(d.draft_html + (d.published_html || '')).matchAll(/data-path="([^"]+)"/g)].map((m) => m[1]); },
    app_tl_move() {},
    app_tl_read({ p_id }) { const d = doc(p_id); T.doc_reads = T.doc_reads.filter((r) => !(r.doc_id === p_id && r.employee_id === me.employee_id)); T.doc_reads.push({ doc_id: p_id, employee_id: me.employee_id, version: d.published_version, read_at: now() }); },
    app_tl_staff_status: () => {
      const pub = T.docs.filter((d) => d.kind === 'noi_quy' && d.published_version > 0);
      return { noi_quy_docs: pub.length, rows: T.employees.map((e) => { const c = T.employee_commitments.find((x) => x.employee_id === e.id) || {};
        return { employee_id: e.id, read: pub.filter((d) => read(d, e.id)?.version === d.published_version).length, read_at: null, commit: c.status || 'chua_ky', commit_note: c.note, commit_at: c.updated_at, commit_by: c.updated_at ? 'admin – Chủ' : null }; }) };
    },
    app_tl_mark_read({ p_employee, p_read }) {
      T.doc_reads = T.doc_reads.filter((r) => r.employee_id !== p_employee);
      if (p_read) T.docs.filter((d) => d.kind === 'noi_quy' && d.published_version > 0).forEach((d) => T.doc_reads.push({ doc_id: d.id, employee_id: p_employee, version: d.published_version, read_at: now() }));
    },
    app_tl_set_commit({ p_employee, p_status }) {
      if (!['chua_ky', 'da_ky_chua_nop', 'da_ky_nop'].includes(p_status)) throw new Error('Trạng thái cam kết không hợp lệ.');
      T.employee_commitments = T.employee_commitments.filter((x) => x.employee_id !== p_employee); T.employee_commitments.push({ employee_id: p_employee, status: p_status, updated_at: now() });
    },
  };
}
