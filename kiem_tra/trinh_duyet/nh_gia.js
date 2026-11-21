// Giả lập các hàm app_nh_* (Nhập hàng kho tổng, bước 31) trong bộ nhớ — chỉ để chạy thử giao diện
export function makeNh(T, me) {
  for (const t of ['delivery_invoices', 'delivery_lines', 'delivery_receipt_photos', 'delivery_photo_lines', 'delivery_invoice_files', 'nh_kho_map', 'delivery_followups']) T[t] = T[t] || [];
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
      files: T.delivery_invoice_files.filter((f) => f.invoice_id === i.id),
      has_doc: !!(i.deliv_path || i.bu_path), n_extra: i.doc_no ? L.filter((l) => l.qty_invoice == null && (qty(l) || 0) > 0).length : 0,
      n_fu_done: T.delivery_followups.filter((f) => f.invoice_id === i.id && f.status !== 'cho').length };
  };
  const staffCan = (i, r) => {
    if (i.branch_id !== r.branch_id) throw new Error('Hàng này của cơ sở khác.');
    if (i.state === 'dang_chuyen') { if (i.work_date > r.work_date) throw new Error('Chưa tới ngày giao.'); return; }
    if (i.received_report_id !== r.id) throw new Error('Hàng này đã được báo nhận ở ca khác.');
    if (i.recon_at) throw new Error('Quản lý đã đối soát hàng này nên không sửa được nữa.');
    if (i.received_date !== today()) throw new Error('Chỉ sửa được báo cáo nhận hàng trong ngày nhận.');
  };
  // bước 104: đối soát xong → món thiếu "chờ giao bù", món thừa "chờ hoá đơn bổ sung"; bỏ đối soát → xoá mục còn chờ
  const followups = (inv) => {
    const i = T.delivery_invoices.find((x) => x.id === inv);
    if (!i.recon_at) { T.delivery_followups = T.delivery_followups.filter((f) => !(f.invoice_id === inv && f.status === 'cho')); return; }
    if (!i.doc_no) return;
    lines(inv).filter((l) => !l.bu_followup_id).forEach((l) => {
      const q = l.qty_checked ?? l.qty_received ?? 0;
      if (T.delivery_followups.some((f) => f.line_id === l.id && f.status !== 'huy')) return;
      if (l.qty_invoice == null) { if (q > 0) T.delivery_followups.push({ id: nid('delivery_followups'), branch_id: i.branch_id, invoice_id: i.id, line_id: l.id, kind: 'hd_bs', name: l.name, unit: l.unit, qty: q, price: null, amount: null, status: 'cho', created_at: now() }); return; }
      if (eq(q, l.qty_invoice)) return;
      const qty = Math.abs(l.qty_invoice - q);
      T.delivery_followups.push({ id: nid('delivery_followups'), branch_id: i.branch_id, invoice_id: i.id, line_id: l.id, kind: q < l.qty_invoice ? 'bu' : 'hd_bs', name: l.name, unit: l.unit, qty, price: l.price, amount: Math.round(qty * (l.price || 0)), status: 'cho', created_at: now() });
    });
  };
  const afterCheck = (inv) => {
    const i = T.delivery_invoices.find((x) => x.id === inv);
    // bước 106: không tự xong — quản lý bấm Xác nhận xong (app_gh_recon_done)
    if (i.recon_at && lines(inv).some((l) => !l.checked_at)) { i.recon_at = null; i.recon_by = null; T.shift_report_checks = (T.shift_report_checks || []).filter((c) => !(c.report_id === i.received_report_id && c.item === 'nhap_hang')); followups(inv); }
    return;
    const rid = i.received_report_id;
    if (rid && !T.delivery_invoices.filter((d) => d.received_report_id === rid).some((d) => lines(d.id).some((l) => !l.checked_at))) {
      T.shift_report_checks = T.shift_report_checks || [];
      if (!T.shift_report_checks.some((c) => c.report_id === rid && c.item === 'nhap_hang')) T.shift_report_checks.push({ report_id: rid, item: 'nhap_hang', checked_by: me.account_id, checked_at: now() });
    }
  };
  const ghCan = (i) => {
    if (!i) throw new Error('Không tìm thấy lần giao hàng.');
    if (i.recon_at) throw new Error('Quản lý đã đối soát hàng này nên không sửa được nữa.');
    if (i.state === 'dang_chuyen') { if (i.work_date > today()) throw new Error('Chưa tới ngày giao.'); return; }
    if (i.received_date !== today() && !can('doi_soat')) throw new Error('Chỉ sửa được báo cáo nhận hàng trong ngày nhận.');
  };
  const days = (a) => Math.round((Date.parse(today()) - Date.parse(String(a).slice(0, 10))) / 864e5);
  const fuJson = (f) => { const m = money(); const inv = T.delivery_invoices.find((d) => d.id === f.invoice_id) || {};
    return { ...f, price: m ? f.price : null, amount: m ? f.amount : null, resolved_amount: m ? f.resolved_amount : null, resolved_by: name(f.resolved_by),
      resolved_doc: T.delivery_invoices.find((d) => d.id === f.resolved_invoice_id)?.doc_no || null, doc_no: inv.doc_no || null, work_date: inv.work_date || null, days: days(f.created_at),
      received_date: inv.received_date || (inv.received_at || '').slice(0, 10) || null, recon_date: (inv.recon_at || f.created_at || '').slice(0, 10) || null,
      extra: T.delivery_lines.find((l) => l.id === f.line_id)?.qty_invoice == null }; };
  const monthTotal = (br, mo) => {
    const inv = T.delivery_invoices.filter((i) => (!br || i.branch_id === br) && i.doc_no && String(i.work_date).startsWith(mo));
    const bu = T.delivery_lines.filter((l) => l.bu_followup_id && inv.some((i) => i.id === l.invoice_id)).reduce((t, l) => t + (l.amount || 0), 0);
    const bs = T.delivery_followups.filter((f) => f.kind === 'hd_bs' && f.status === 'xong' && (!br || f.branch_id === br) && f.resolved_month === mo).reduce((t, f) => t + (f.resolved_amount || 0), 0);
    return { invoices: inv.reduce((t, i) => t + (i.total || 0), 0), n_invoices: inv.length, bu, hd_bs: bs, payable: inv.reduce((t, i) => t + (i.total || 0), 0) - bu + bs };
  };
  const started = (id) => T.delivery_receipt_photos.some((p) => p.invoice_id === id) || (() => { const i = T.delivery_invoices.find((x) => x.id === id); return !!(i && (i.deliv_path || i.deliv_note)); })()
    || T.delivery_lines.some((l) => l.invoice_id === id && (l.qty_invoice == null || l.qty_received != null));
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
    app_nh_delete({ p_id }) { if (me.role !== 'chu') throw new Error('Chỉ Chủ được xóa phiếu xuất.'); const i = T.delivery_invoices.find((x) => x.id === p_id); if (!i) return [];   // bước 108: Chủ xóa được cả phiếu đã nhận
      T.delivery_invoices = T.delivery_invoices.filter((x) => x !== i); return []; },
    app_nh_replace({ p_id, p }) {
      if (!can('ke_toan')) throw new Error('Bạn không có quyền.');
      const i = T.delivery_invoices.find((x) => x.id === p_id); if (!i) throw new Error('Không tìm thấy phiếu xuất.');
      if (i.state !== 'dang_chuyen') throw new Error('Hàng đã được báo nhận — không thay phiếu được.'); if (started(p_id)) throw new Error('Nhân viên đang nhận hàng theo phiếu này — không thay phiếu được.');
      if (!p.doc_no) throw new Error('File không có Số đơn.'); if (T.delivery_invoices.some((x) => x.id !== p_id && (x.doc_no || '').toUpperCase() === p.doc_no.toUpperCase())) throw new Error(`Phiếu ${p.doc_no} đã có (lần tải khác).`);
      T.delivery_lines = T.delivery_lines.filter((l) => l.invoice_id !== p_id); T.delivery_invoice_files = T.delivery_invoice_files.filter((f) => f.invoice_id !== p_id);
      Object.assign(i, { doc_no: p.doc_no, total: p.total, ship_at: p.ship_at, work_date: p.ship_at.slice(0, 10), kho_code: p.kho_code, kho_name: p.kho_name });
      p.lines.forEach((x, k) => addLine(p_id, x, k + 1, { qty_invoice: x.qty, price: x.price, amount: x.amount })); return [];
    },
    app_nh_list({ p_month, p_branch, p_from, p_to, p_kind }) {
      if (!can('ke_toan') && !can('doi_soat')) throw new Error('Bạn không có quyền xem nhập hàng.');
      const all = T.delivery_invoices.filter((i) => !p_branch || i.branch_id === p_branch).map((i) => json(i));
      // bước 167 (tệp 146): khoảng ngày theo loại ngày
      const dk = (i) => (p_kind === 'nhan' ? i.received_date || (i.received_at || '').slice(0, 10) || null : p_kind === 'ds' ? (i.recon_at || '').slice(0, 10) || null : i.work_date);
      if (p_from && p_to && (Date.parse(p_to) - Date.parse(p_from)) / 864e5 > 400) throw new Error('Chọn khoảng ngày tối đa 400 ngày.');   // như app__nh_loc_check (tệp 146)
      if (p_from || p_to) { if (!/^\d{4}-\d{2}-\d{2}$/.test(p_from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(p_to || '') || p_to < p_from) throw new Error('Khoảng ngày không hợp lệ.'); if (p_kind && !['giao', 'nhan', 'ds'].includes(p_kind)) throw new Error('Loại ngày không hợp lệ.'); }
      const rng = !!(p_from && p_to); p_month = p_month || (rng ? p_to.slice(0, 7) : p_month);
      return { rows: all.filter((i) => (rng ? dk(i) && dk(i) >= p_from && dk(i) <= p_to : i.work_date.startsWith(p_month))).sort((a, b) => ((rng ? dk(a) < dk(b) : a.work_date < b.work_date) ? 1 : -1)), open: all.filter((i) => i.missing.length),
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
      if (T.delivery_invoices.find((x) => x.id === l.invoice_id)?.recon_at) throw new Error('Đã xác nhận đối soát xong — bấm "Mở lại đối soát" trước khi sửa.');
      const q = p_qty ?? l.qty_received ?? 0; if (!eq(q, l.qty_received ?? 0) && !(p_note || '').trim()) throw new Error('Số khác với nhân viên báo — ghi chú lý do.');
      Object.assign(l, { qty_checked: q, check_note: p_note || null, checked_by: me.account_id, checked_at: now() }); afterCheck(l.invoice_id); return { qty: q, changed: !eq(q, l.qty_received ?? 0) };
    },
    app_nh_uncheck({ p_line }) { const l = T.delivery_lines.find((x) => x.id === p_line); if (T.delivery_invoices.find((x) => x.id === l.invoice_id)?.recon_at) throw new Error('Đã xác nhận đối soát xong — bấm "Mở lại đối soát" trước khi sửa.'); Object.assign(l, { qty_checked: null, check_note: null, checked_by: null, checked_at: null }); afterCheck(l.invoice_id); },
    app_nh_tick: () => 0,
    // ---------------------------------------------------------------- bước 104: Hàng hoá (không gắn phiếu ca)
    app_gh_inbox({ p_branch }) {
      if (!can('chot_ca') && !can('doi_soat') && !can('ke_toan')) throw new Error('Bạn không có quyền.');
      return { rows: T.delivery_invoices.filter((i) => (!p_branch || i.branch_id === p_branch) && !i.recon_at && ((i.state === 'dang_chuyen' && i.work_date <= today()) || ['da_nhan', 'cho_hoa_don'].includes(i.state))).sort((a, b) => (a.work_date < b.work_date ? -1 : a.work_date > b.work_date ? 1 : a.id - b.id)).map((i) => json(i)),
        catalog: [...new Map(T.delivery_lines.filter((l) => l.qty_invoice != null).map((l) => [l.name.toUpperCase(), { code: l.code, name: l.name, unit: l.unit }])).values()],
        my_branches: (T.employee_branches || []).filter((e) => e.employee_id === me.employee_id).map((e) => e.branch_id), today: today(), can_recv: can('chot_ca'), can_recon: can('doi_soat') };
    },
    app_gh_receive({ p_id, p_lines, p_note }) {
      if (!can('chot_ca')) throw new Error('Bạn không có quyền.');
      const i = T.delivery_invoices.find((x) => x.id === p_id); ghCan(i);
      if (i.state === 'cho_hoa_don') throw new Error('Phiếu nhận không hoá đơn: dùng nút Lưu phiếu nhận.');
      if (!i.deliv_path && !i.deliv_note) throw new Error('Chụp hoá đơn giao (hoặc bấm "Tài xế không mang hoá đơn giao") trước khi gửi.');
      if (lines(p_id).some((l) => !p_lines.some((y) => y.id === l.id && y.qty !== null && y.qty !== undefined))) throw new Error('Nhập số thực nhận cho tất cả các món.');
      p_lines.forEach((y) => { const l = T.delivery_lines.find((x) => x.id === y.id); if (l) l.qty_received = y.qty; });
      Object.assign(i, { state: 'da_nhan', received_by: me.account_id, received_at: now(), received_date: today(), received_report_id: null, receive_note: p_note || null });
      return { mismatch: lines(p_id).filter((l) => !eq(l.qty_invoice, l.qty_received) && !(l.qty_invoice == null && !l.qty_received)).length };
    },
    app_gh_extra_add({ p_id, p_lines }) {
      if (!can('chot_ca')) throw new Error('Bạn không có quyền.');
      const i = T.delivery_invoices.find((x) => x.id === p_id); ghCan(i);
      if (i.state === 'cho_hoa_don') throw new Error('Phiếu nhận chưa có phiếu xuất: ghi món như thường.');
      if (!(p_lines || []).length) throw new Error('Ghi ít nhất 1 món.');
      let k = Math.max(0, ...lines(p_id).map((l) => l.sort || 0));
      return p_lines.map((x) => { if (!(x.name || '').trim() || !(x.qty > 0)) throw new Error('Món ngoài phiếu cần tên và số lượng.'); k += 1; return addLine(p_id, x, k, { qty_received: x.qty }); });
    },
    app_gh_extra_del({ p_line }) {
      const l = T.delivery_lines.find((x) => x.id === p_line); if (!l) return; const i = T.delivery_invoices.find((x) => x.id === l.invoice_id); ghCan(i);
      if (i.state === 'cho_hoa_don' || l.qty_invoice != null) throw new Error('Chỉ xoá được món ngoài phiếu.');
      T.delivery_photo_lines = T.delivery_photo_lines.filter((x) => x.line_id !== p_line); T.delivery_lines = T.delivery_lines.filter((x) => x !== l);
    },
    app_gh_deliv({ p_id, p_path, p_note }) {
      const i = T.delivery_invoices.find((x) => x.id === p_id); ghCan(i); const old = i.deliv_path || null;
      if (p_path) { if (!new RegExp('^gh' + p_id + '/[^/]+$').test(p_path)) throw new Error('Đường dẫn ảnh không hợp lệ.'); Object.assign(i, { deliv_path: p_path, deliv_note: null }); }
      else { if (!(p_note || '').trim()) throw new Error('Ghi chú vì sao không có hoá đơn giao.'); Object.assign(i, { deliv_path: null, deliv_note: p_note.trim() }); }
      Object.assign(i, { deliv_by: me.account_id, deliv_at: now() });
      return old !== p_path ? old : null;
    },
    app_gh_bu_file({ p_id, p_path, p_name }) {
      if (!can('ke_toan')) throw new Error('Bạn không có quyền.');
      const i = T.delivery_invoices.find((x) => x.id === p_id); if (!new RegExp('^hd' + p_id + '/').test(p_path || '')) throw new Error('Đường dẫn tệp không hợp lệ.');
      const old = i.bu_path || null; Object.assign(i, { bu_path: p_path, bu_name: p_name, bu_by: me.account_id, bu_at: now() }); return old;
    },
    app_gh_recon_done({ p_id }) {
      if (!can('doi_soat')) throw new Error('Bạn không có quyền.');
      const i = T.delivery_invoices.find((x) => x.id === p_id);
      if (i.state === 'dang_chuyen') throw new Error('Nhân viên chưa báo nhận hàng này.'); if (i.recon_at) throw new Error('Lần giao này đã xác nhận đối soát xong.');
      const n = lines(p_id).filter((l) => !l.checked_at).length; if (n) throw new Error(`Còn ${n} món chưa đối soát.`);
      if (!i.deliv_path && !i.bu_path) throw new Error('Chưa có hoá đơn giao — chờ kế toán tải hoá đơn bù rồi mới xác nhận xong.');
      Object.assign(i, { recon_at: now(), recon_by: me.account_id }); followups(p_id);
      const F = T.delivery_followups.filter((f) => f.invoice_id === p_id && f.status === 'cho');
      return { bu: F.filter((f) => f.kind === 'bu').length, hd_bs: F.filter((f) => f.kind === 'hd_bs').length };
    },
    app_gh_recon_reopen({ p_id }) {
      if (!can('doi_soat')) throw new Error('Bạn không có quyền.');
      const i = T.delivery_invoices.find((x) => x.id === p_id); if (!i || !i.recon_at) throw new Error('Lần giao này chưa xác nhận đối soát xong.');
      if (T.delivery_followups.some((f) => f.invoice_id === p_id && f.status !== 'cho')) throw new Error('Kế toán đã xử lý món lệch của lần giao này — kế toán Hoàn tác ở tab Kiểm soát trước rồi mới mở lại.');
      Object.assign(i, { recon_at: null, recon_by: null }); T.delivery_followups = T.delivery_followups.filter((f) => !(f.invoice_id === p_id && f.status === 'cho'));
    },
    app_gh_receipt_save({ p_id, p_branch, p_lines, p_note }) {
      if (!can('chot_ca')) throw new Error('Bạn không có quyền.');
      if (!p_lines.length) throw new Error('Ghi ít nhất 1 món hàng đã nhận.');
      if (p_lines.some((x) => !(x.qty > 0))) throw new Error('Nhập số lượng nhận cho từng món.');
      let id = p_id;
      if (!id) { if (!T.branches.some((b) => b.id === p_branch)) throw new Error('Chọn cơ sở nhận hàng.'); id = nid('delivery_invoices'); T.delivery_invoices.push({ id, branch_id: p_branch, work_date: today(), created_by: me.account_id, created_at: now(), kind: 'khong_hd', state: 'cho_hoa_don', received_by: me.account_id, received_at: now(), received_date: today(), received_report_id: null, receive_note: p_note || null }); }
      else { const i = T.delivery_invoices.find((x) => x.id === id); ghCan(i); if (i.state !== 'cho_hoa_don') throw new Error('Phiếu này đã được ghép hoá đơn.'); i.receive_note = p_note || null; }
      const keep = p_lines.map((x, k) => { const l = x.id && T.delivery_lines.find((y) => y.id === x.id && y.invoice_id === id); if (l) { Object.assign(l, { sort: k + 1, code: x.code, name: x.name, unit: x.unit, qty_received: x.qty }); return l.id; } return addLine(id, x, k + 1, { qty_received: x.qty }); });
      T.delivery_lines = T.delivery_lines.filter((l) => l.invoice_id !== id || keep.includes(l.id));
      return id;
    },
    app_gh_photo_add({ p_id, p_path, p_lines }) {
      const i = T.delivery_invoices.find((x) => x.id === p_id); ghCan(i);
      if (!new RegExp('^gh' + p_id + '/[^/]+$').test(p_path || '')) throw new Error('Đường dẫn ảnh không hợp lệ.');
      if (new Set(p_lines || []).size > 4) throw new Error('Mỗi ảnh tối đa 4 món — chụp ảnh khác cho các món còn lại.');   // bước 132 (như máy chủ)
      const id = nid('delivery_receipt_photos'); T.delivery_receipt_photos.push({ id, invoice_id: p_id, path: p_path, created_by: me.account_id, created_at: now() });
      (p_lines || []).forEach((l) => T.delivery_photo_lines.push({ photo_id: id, line_id: l })); return id;
    },
    app_gh_photo_del({ p_photo }) { const p = T.delivery_receipt_photos.find((x) => x.id === p_photo); if (!p) return null; ghCan(T.delivery_invoices.find((x) => x.id === p.invoice_id));
      T.delivery_receipt_photos = T.delivery_receipt_photos.filter((x) => x !== p); T.delivery_photo_lines = T.delivery_photo_lines.filter((x) => x.photo_id !== p_photo); return p.path; },
    app_gh_control({ p_branch, p_month, p_from, p_to, p_kind }) {
      if (!can('ke_toan') && !can('doi_soat')) throw new Error('Bạn không có quyền.');
      const F = T.delivery_followups.filter((f) => !p_branch || f.branch_id === p_branch);
      const nb = T.delivery_invoices.filter((i) => (!p_branch || i.branch_id === p_branch) && !i.recon_at && i.state !== 'dang_chuyen' && !i.deliv_path && !i.bu_path)
        .map((i) => ({ id: i.id, branch_id: i.branch_id, doc_no: i.doc_no || null, kind: i.kind, work_date: i.work_date, received_at: i.received_at, received_by: name(i.received_by), deliv_note: i.deliv_note || null }));
      const rng = !!(p_from && p_to);   // bước 167 (tệp 146): khoảng ngày chỉ lọc "Đã xử lý"; tiền tháng theo p_month
      if (rng && (Date.parse(p_to) - Date.parse(p_from)) / 864e5 > 400) throw new Error('Chọn khoảng ngày tối đa 400 ngày.');   // như app__nh_loc_check (tệp 146)
      const fd = (f) => { const j = fuJson(f); return p_kind === 'nhan' ? j.received_date : p_kind === 'ds' ? j.recon_date : j.work_date; };
      return { need_bu: nb.map((x) => ({ ...x, received_date: (x.received_at || '').slice(0, 10) || null })), open: F.filter((f) => f.status === 'cho').map(fuJson),
        done: F.filter((f) => f.status !== 'cho' && (rng ? fd(f) && fd(f) >= p_from && fd(f) <= p_to : String(f.resolved_at || f.created_at).startsWith(p_month))).map(fuJson),
        money: money() ? monthTotal(p_branch, p_month) : null, kt: can('ke_toan'), today: today() };
    },
    app_gh_bu_lines({ p_followup }) {
      if (!can('ke_toan')) throw new Error('Bạn không có quyền.');
      const f = T.delivery_followups.find((x) => x.id === p_followup); const norm = (x) => String(x || '').trim().toUpperCase();
      return T.delivery_lines.filter((l) => { const i = T.delivery_invoices.find((d) => d.id === l.invoice_id); return i && i.branch_id === f.branch_id && i.id !== f.invoice_id && i.doc_no && l.qty_invoice != null && !l.bu_followup_id && i.work_date >= f.created_at.slice(0, 10); })
        .map((l) => { const i = T.delivery_invoices.find((d) => d.id === l.invoice_id); return { line_id: l.id, invoice_id: i.id, doc_no: i.doc_no, work_date: i.work_date, name: l.name, unit: l.unit, qty: l.qty_invoice, amount: l.amount, same: norm(l.name) === norm(f.name) }; })
        .sort((a, b) => Number(b.same) - Number(a.same));
    },
    app_gh_fu_resolve({ p_id, p_line, p_ref, p_amount, p_note }) {
      if (!can('ke_toan')) throw new Error('Bạn không có quyền.');
      const f = T.delivery_followups.find((x) => x.id === p_id); if (!f || f.status !== 'cho') throw new Error('Mục này đã xử lý rồi.');
      if (f.kind === 'bu') { const l = T.delivery_lines.find((x) => x.id === p_line); const i = l && T.delivery_invoices.find((d) => d.id === l.invoice_id);
        if (!i || i.branch_id !== f.branch_id || !i.doc_no) throw new Error('Chọn dòng hàng giao bù trong phiếu xuất của cùng cơ sở.'); if (l.bu_followup_id) throw new Error('Dòng này đã được dùng cho món giao bù khác.');
        l.bu_followup_id = f.id; Object.assign(f, { status: 'xong', resolved_invoice_id: i.id, resolved_line_id: l.id, resolved_amount: l.amount, resolved_month: i.work_date.slice(0, 7) });
      } else { if (!(p_ref || '').trim()) throw new Error('Ghi số hoá đơn bổ sung.'); if (p_amount == null || p_amount < 0) throw new Error('Nhập số tiền hoá đơn bổ sung.');
        Object.assign(f, { status: 'xong', resolved_ref: p_ref.trim(), resolved_amount: p_amount, resolved_month: today().slice(0, 7) }); }
      Object.assign(f, { resolved_at: now(), resolved_by: me.account_id, note: (p_note || '').trim() || null });
    },
    app_gh_fu_cancel({ p_id, p_reason }) {
      if (!can('ke_toan')) throw new Error('Bạn không có quyền.');
      const f = T.delivery_followups.find((x) => x.id === p_id); if (!f || f.status !== 'cho') throw new Error('Mục này đã xử lý rồi.');
      if (!(p_reason || '').trim()) throw new Error('Ghi lý do huỷ.');
      Object.assign(f, { status: 'huy', note: p_reason.trim(), resolved_at: now(), resolved_by: me.account_id });
    },
    app_gh_fu_undo({ p_id }) {
      if (!can('ke_toan')) throw new Error('Bạn không có quyền.');
      const f = T.delivery_followups.find((x) => x.id === p_id); if (!f || f.status === 'cho') return;
      T.delivery_lines.filter((l) => l.bu_followup_id === f.id).forEach((l) => { l.bu_followup_id = null; });
      Object.assign(f, { status: 'cho', resolved_invoice_id: null, resolved_line_id: null, resolved_ref: null, resolved_amount: null, resolved_month: null, resolved_at: null, resolved_by: null });
    },
    app_ext_kho: ({ p_month }) => ({ total: T.delivery_invoices.filter((i) => i.doc_no && i.work_date.startsWith(p_month)).reduce((s, i) => s + (i.total || 0), 0), paid: 0, by_branch: [] }),
  };
}
