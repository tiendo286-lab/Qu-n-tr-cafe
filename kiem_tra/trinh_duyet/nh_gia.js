// Giả lập các hàm app_nh_* (Nhập hàng kho tổng, bước 31) trong bộ nhớ — chỉ để chạy thử giao diện
export function makeNh(T, me) {
  for (const t of ['delivery_invoices', 'delivery_lines', 'delivery_receipt_photos', 'delivery_photo_lines', 'delivery_invoice_files', 'nh_kho_map']) T[t] = T[t] || [];
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const today = () => now().slice(0, 10);
  const nid = (t) => Math.max(0, ...T[t].map((x) => x.id || 0)) + 1;
  const can = (p) => !!me.perms?.[p];
  const money = () => can('ke_toan') || can('doi_soat');
  const name = (aid) => (aid === me.account_id ? `${me.code} – ${me.name}` : aid ? 'TK ' + aid : null);
  const lines = (id) => T.delivery_lines.filter((l) => l.invoice_id === id).sort((a, b) => a.sort - b.sort || a.id - b.id);
  const photosOf = (id) => T.delivery_receipt_photos.filter((p) => p.invoice_id === id);
  const tags = (lid) => T.delivery_photo_lines.filter((x) => x.line_id === lid).length;
  const eq = (a, b) => (a ?? null) === (b ?? null) || (a !== null && b !== null && a !== undefined && b !== undefined && Math.abs(a - b) < 0.0005);
  const json = (i, m = money()) => {
    const L = lines(i.id); const off = i.state !== 'dang_chuyen';
    const qty = (l) => l.qty_checked ?? l.qty_received;
    const nMis = L.filter((l) => off && !eq(l.qty_invoice, qty(l)) && !(l.qty_invoice == null && !(qty(l) || 0))).length;
    const nUnph = L.filter((l) => off && (qty(l) || 0) > 0 && !tags(l.id)).length;
    const nUnchk = off ? L.filter((l) => !l.checked_at).length : 0;
    const miss = [];
    if (i.state === 'dang_chuyen' && i.work_date < today()) miss.push('Chưa báo nhận hàng');
    if (i.state === 'cho_hoa_don') miss.push('Thiếu hóa đơn');
    if (nUnph) miss.push(`Thiếu ảnh ${nUnph} món`);
    if (nUnchk) miss.push(`Chưa đối soát ${nUnchk} món`);
    const b = T.branches.find((x) => x.id === i.branch_id);
    return { ...i, branch_code: b?.display_code || b?.code, total: m ? i.total : null, result: i.state === 'dang_chuyen' ? null : i.state === 'cho_hoa_don' ? 'cho_hoa_don' : nMis ? 'lech' : 'du',
      created_by: name(i.created_by), received_by: name(i.received_by), received_by_id: i.received_by, recon_by: name(i.recon_by),
      received_shift: T.shift_reports.find((r) => r.id === i.received_report_id)?.shift,
      staff_edit: ['da_nhan', 'cho_hoa_don'].includes(i.state) && !i.recon_at && i.received_date === today(),
      lines: L.map((l) => ({ ...l, price: m ? l.price : null, amount: m ? l.amount : null, qty: qty(l), checked_by: name(l.checked_by), photos: tags(l.id) })),
      photos: photosOf(i.id).map((p) => ({ id: p.id, path: p.path, by: name(p.created_by), at: p.created_at, lines: T.delivery_photo_lines.filter((x) => x.photo_id === p.id).map((x) => x.line_id) })),
      n_lines: L.length, n_mismatch: nMis, n_unphoto: nUnph, n_unchecked: nUnchk, missing: miss, complete: i.state === 'da_nhan' && !nUnph && !nUnchk,
      files: T.delivery_invoice_files.filter((f) => f.invoice_id === i.id) };
  };
  const staffCan = (i, r) => {
    if (i.branch_id !== r.branch_id) throw new Error('Hàng này của cơ sở khác.');
    if (i.state === 'dang_chuyen') { if (i.work_date > r.work_date) throw new Error('Chưa tới ngày giao.'); return; }
    if (i.received_report_id !== r.id) throw new Error('Hàng này đã được báo nhận ở ca khác.');
    if (i.recon_at) throw new Error('Quản lý đã đối soát hàng này nên không sửa được nữa.');
    if (i.received_date !== today()) throw new Error('Chỉ sửa được báo cáo nhận hàng trong ngày nhận.');
  };
  const afterCheck = (inv) => {
    const i = T.delivery_invoices.find((x) => x.id === inv);
    if (lines(inv).some((l) => !l.checked_at)) { i.recon_at = null; i.recon_by = null; T.shift_report_checks = (T.shift_report_checks || []).filter((c) => !(c.report_id === i.received_report_id && c.item === 'nhap_hang')); return; }
    if (!i.recon_at) { i.recon_at = now(); i.recon_by = me.account_id; }
    const rid = i.received_report_id;
    if (rid && !T.delivery_invoices.filter((d) => d.received_report_id === rid).some((d) => lines(d.id).some((l) => !l.checked_at))) {
      T.shift_report_checks = T.shift_report_checks || [];
      if (!T.shift_report_checks.some((c) => c.report_id === rid && c.item === 'nhap_hang')) T.shift_report_checks.push({ report_id: rid, item: 'nhap_hang', checked_by: me.account_id, checked_at: now() });
    }
  };
  const addLine = (inv, x, k, extra = {}) => { const id = nid('delivery_lines'); T.delivery_lines.push({ id, invoice_id: inv, sort: k, code: x.code || null, name: x.name, unit: x.unit || null, qty_invoice: null, price: null, amount: null, qty_received: null, qty_checked: null, ...extra }); return id; };
  return {
    app_nh_kho_map: () => Object.fromEntries(T.nh_kho_map.map((m) => [m.kho_code, m.branch_id])),
    app_nh_create({ p }) {
      if (!can('ke_toan')) throw new Error('Bạn không có quyền.');
      if (!p.branch_id) throw new Error('Chọn cơ sở nhận hàng.'); if (!p.doc_no) throw new Error('File không có Số đơn.');
      if (T.delivery_invoices.some((i) => (i.doc_no || '').toUpperCase() === p.doc_no.toUpperCase())) throw new Error(`Hóa đơn ${p.doc_no} đã tải lên rồi.`);
      if (p.kho_code) { T.nh_kho_map = T.nh_kho_map.filter((m) => m.kho_code !== p.kho_code).concat([{ kho_code: p.kho_code, branch_id: p.branch_id }]); }
      const meta = { doc_no: p.doc_no, total: p.total, ship_at: p.ship_at, kho_code: p.kho_code, kho_name: p.kho_name, ref: p.ref, src_creator: p.src_creator };
      if (!p.merge_id) {
        const id = nid('delivery_invoices');
        T.delivery_invoices.push({ id, branch_id: p.branch_id, work_date: p.ship_at.slice(0, 10), note: p.note || null, kind: 'hoa_don', state: 'dang_chuyen', created_by: me.account_id, created_at: now(), ...meta });
        p.lines.forEach((x, k) => addLine(id, x, k + 1, { qty_invoice: x.qty, price: x.price, amount: x.amount }));
        return id;
      }
      const tg = T.delivery_invoices.find((i) => i.id === p.merge_id);
      if (!tg || tg.state !== 'cho_hoa_don') throw new Error('Phiếu nhận hàng cần ghép không còn ở trạng thái Chờ hóa đơn.');
      p.lines.forEach((x, k) => {
        const hit = lines(tg.id).find((l) => l.qty_invoice == null && ((x.code && (l.code || '').toUpperCase() === x.code.toUpperCase()) || l.name.toUpperCase() === x.name.toUpperCase()));
        if (hit) Object.assign(hit, { code: x.code || hit.code, name: x.name, unit: x.unit || hit.unit, qty_invoice: x.qty, price: x.price, amount: x.amount, sort: k + 1 });
        else addLine(tg.id, x, k + 1, { qty_invoice: x.qty, price: x.price, amount: x.amount, qty_received: 0 });
      });
      Object.assign(tg, meta, { kind: 'hoa_don', state: 'da_nhan', matched_at: now(), matched_by: me.account_id });
      return tg.id;
    },
    app_nh_delete({ p_id }) { const i = T.delivery_invoices.find((x) => x.id === p_id); if (!i) return []; if (i.state !== 'dang_chuyen') throw new Error('Hàng đã được báo nhận, không xóa hóa đơn được.'); T.delivery_invoices = T.delivery_invoices.filter((x) => x !== i); return []; },
    app_nh_list({ p_month, p_branch }) {
      const all = T.delivery_invoices.filter((i) => !p_branch || i.branch_id === p_branch).map((i) => json(i));
      return { rows: all.filter((i) => i.work_date.startsWith(p_month)).sort((a, b) => (a.work_date < b.work_date ? 1 : -1)), open: all.filter((i) => i.missing.length),
        by_branch: T.branches.filter((b) => b.status === 'Đang hoạt động').map((b) => ({ branch_id: b.id, code: b.display_code || b.code, total: T.delivery_invoices.filter((i) => i.branch_id === b.id && i.doc_no && i.work_date.startsWith(p_month)).reduce((s, i) => s + (i.total || 0), 0),
          count: T.delivery_invoices.filter((i) => i.branch_id === b.id && i.work_date.startsWith(p_month)).length })), money: money(), kt: can('ke_toan') };
    },
    app_nh_for_report({ p_report }) {
      const r = T.shift_reports.find((x) => x.id === p_report);
      return { rows: T.delivery_invoices.filter((i) => i.branch_id === r.branch_id && ((i.state === 'dang_chuyen' && i.work_date <= r.work_date) || i.received_report_id === r.id)).map((i) => json(i)),
        catalog: [...new Map(T.delivery_lines.filter((l) => l.qty_invoice != null).map((l) => [l.name.toUpperCase(), { code: l.code, name: l.name, unit: l.unit }])).values()], today: today() };
    },
    app_nh_receive({ p_id, p_report, p_lines, p_note }) {
      const i = T.delivery_invoices.find((x) => x.id === p_id); const r = T.shift_reports.find((x) => x.id === p_report); staffCan(i, r);
      if (lines(p_id).some((l) => !p_lines.some((y) => y.id === l.id && y.qty !== null && y.qty !== undefined))) throw new Error('Nhập số thực nhận cho tất cả các món (bấm "Đủ" nếu nhận đủ).');
      p_lines.forEach((y) => { const l = T.delivery_lines.find((x) => x.id === y.id); if (l) l.qty_received = y.qty; });
      const first = i.state === 'dang_chuyen';
      Object.assign(i, { state: 'da_nhan', received_by: me.account_id, received_at: now(), received_date: today(), received_report_id: p_report, receive_note: p_note || null });
      return { mismatch: lines(p_id).filter((l) => !eq(l.qty_invoice, l.qty_received)).length, first };
    },
    app_nh_receipt_save({ p_id, p_report, p_lines, p_note }) {
      const r = T.shift_reports.find((x) => x.id === p_report);
      if (!p_lines.length) throw new Error('Ghi ít nhất 1 món hàng đã nhận.');
      let id = p_id;
      if (!id) { id = nid('delivery_invoices'); T.delivery_invoices.push({ id, branch_id: r.branch_id, work_date: r.work_date, created_by: me.account_id, created_at: now(), kind: 'khong_hd', state: 'cho_hoa_don', received_by: me.account_id, received_at: now(), received_date: today(), received_report_id: p_report, receive_note: p_note || null }); }
      else { const i = T.delivery_invoices.find((x) => x.id === id); staffCan(i, r); i.receive_note = p_note || null; }
      const keep = p_lines.map((x, k) => { const l = x.id && T.delivery_lines.find((y) => y.id === x.id && y.invoice_id === id); if (l) { Object.assign(l, { sort: k + 1, code: x.code, name: x.name, unit: x.unit, qty_received: x.qty }); return l.id; } return addLine(id, x, k + 1, { qty_received: x.qty }); });
      T.delivery_lines = T.delivery_lines.filter((l) => l.invoice_id !== id || keep.includes(l.id));
      return id;
    },
    app_nh_photo_add({ p_id, p_report, p_path, p_lines }) {
      const i = T.delivery_invoices.find((x) => x.id === p_id); const r = T.shift_reports.find((x) => x.id === p_report); staffCan(i, r);
      const id = nid('delivery_receipt_photos'); T.delivery_receipt_photos.push({ id, invoice_id: p_id, path: p_path, created_by: me.account_id, created_at: now() });
      (p_lines || []).forEach((l) => T.delivery_photo_lines.push({ photo_id: id, line_id: l })); return id;
    },
    app_nh_photo_tag({ p_photo, p_lines }) { T.delivery_photo_lines = T.delivery_photo_lines.filter((x) => x.photo_id !== p_photo).concat((p_lines || []).map((l) => ({ photo_id: p_photo, line_id: l }))); },
    app_nh_photo_del({ p_photo }) { const p = T.delivery_receipt_photos.find((x) => x.id === p_photo); T.delivery_receipt_photos = T.delivery_receipt_photos.filter((x) => x !== p); T.delivery_photo_lines = T.delivery_photo_lines.filter((x) => x.photo_id !== p_photo); return p?.path || null; },
    app_nh_check({ p_line, p_qty, p_note }) {
      if (!can('doi_soat')) throw new Error('Bạn không có quyền.'); const l = T.delivery_lines.find((x) => x.id === p_line);
      const q = p_qty ?? l.qty_received ?? 0; if (!eq(q, l.qty_received ?? 0) && !(p_note || '').trim()) throw new Error('Số khác với nhân viên báo — ghi chú lý do.');
      Object.assign(l, { qty_checked: q, check_note: p_note || null, checked_by: me.account_id, checked_at: now() }); afterCheck(l.invoice_id); return { qty: q, changed: !eq(q, l.qty_received ?? 0) };
    },
    app_nh_uncheck({ p_line }) { const l = T.delivery_lines.find((x) => x.id === p_line); Object.assign(l, { qty_checked: null, check_note: null, checked_by: null, checked_at: null }); afterCheck(l.invoice_id); },
    app_nh_tick: () => 0,
    app_ext_kho: ({ p_month }) => ({ total: T.delivery_invoices.filter((i) => i.doc_no && i.work_date.startsWith(p_month)).reduce((s, i) => s + (i.total || 0), 0), paid: 0, by_branch: [] }),
  };
}
