// Giả lập phần Kế toán (hóa đơn giao hàng + chuyển khoản thực nhận) — chỉ để chạy thử giao diện
export function makeKt(T, me) {
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const INV = []; const FILES = []; const PH = []; const ITEMS = []; const BANK = {};
  let seq = 1;
  const name = (id) => (id === me.account_id ? `${me.code} – ${me.name}` : id ? 'TK ' + id : null);
  const rep = (id) => T.shift_reports.find((r) => r.id === id);
  const bcode = (id) => { const b = T.branches.find((x) => x.id === id) || {}; return b.display_code || b.code; };
  const json = (i) => ({ ...i, branch_code: bcode(i.branch_id), status: !i.result ? 'chua_nhan' : i.result,
    created_by_name: name(i.created_by), received_by_name: name(i.received_by), received_shift: i.received_report_id ? rep(i.received_report_id)?.shift : null,
    files: FILES.filter((f) => f.invoice_id === i.id), photos: PH.filter((p) => p.invoice_id === i.id), items: ITEMS.filter((x) => x.invoice_id === i.id) });
  const order = ['Sáng', 'Chiều', 'Tối'];
  const bankJson = (r) => {
    const b = BANK[r.id] || {};
    const prev = T.shift_reports.filter((p) => p.branch_id === r.branch_id && BANK[p.id]?.closing != null && (p.work_date < r.work_date || (p.work_date === r.work_date && order.indexOf(p.shift) < order.indexOf(r.shift))))
      .sort((a, c) => (a.work_date + order.indexOf(a.shift)).localeCompare(c.work_date + order.indexOf(c.shift))).pop();
    return { report_id: r.id, status: r.status, recon_status: r.recon_status, rev_start: r.rev_start, rev_end: r.rev_end, pos_transfer: r.pos_transfer ?? null, reported_transfer: r.reported_transfer ?? null,
      opening: b.opening ?? null, closing: b.closing ?? null, transfers_out: b.transfers_out ?? 0, note: b.note || null,
      received: b.opening != null && b.closing != null ? b.closing - b.opening + (b.transfers_out || 0) : null, updated_by: b.updated_by ? name(b.updated_by) : null, updated_at: b.updated_at || null,
      prev: prev ? { closing: BANK[prev.id].closing, work_date: prev.work_date, shift: prev.shift } : null, locked: r.recon_status === 'hoan_thanh' };
  };
  return {
    app_kt_invoices: ({ p_from, p_to, p_branch }) => INV.filter((i) => (!p_from || i.work_date >= p_from) && (!p_to || i.work_date <= p_to) && (!p_branch || i.branch_id === p_branch)).map(json).reverse(),
    app_kt_invoice_save({ p_id, p_branch, p_date, p_note }) { if (!p_branch) throw new Error('Chọn cơ sở nhận.'); if (!p_id) { const id = seq++; INV.push({ id, branch_id: p_branch, work_date: p_date, note: p_note || null, created_by: me.account_id, created_at: now() }); return id; } Object.assign(INV.find((i) => i.id === p_id), { branch_id: p_branch, work_date: p_date, note: p_note }); return p_id; },
    app_kt_invoice_file_add({ p_invoice, p_path, p_name, p_mime, p_size }) { const id = seq++; FILES.push({ id, invoice_id: p_invoice, path: p_path, name: p_name, mime: p_mime, size: p_size }); return id; },
    app_kt_invoice_file_del({ p_file }) { const f = FILES.find((x) => x.id === p_file); FILES.splice(FILES.indexOf(f), 1); return f.path; },
    app_kt_invoice_delete({ p_id }) { const i = INV.find((x) => x.id === p_id); if (i.result) throw new Error('Hóa đơn đã được nhân viên báo nhận, không xóa được.'); INV.splice(INV.indexOf(i), 1); return FILES.filter((f) => f.invoice_id === p_id).map((f) => f.path); },
    app_hd_for_report({ p_report }) { const r = rep(p_report); return INV.filter((i) => i.branch_id === r.branch_id && i.work_date <= r.work_date && (!i.result || i.received_report_id === r.id)).map(json); },
    app_hd_photo_add({ p_invoice, p_path }) { const id = seq++; PH.push({ id, invoice_id: p_invoice, path: p_path, by: name(me.account_id), at: now() }); return id; },
    app_hd_photo_del({ p_photo }) { const ph = PH.find((x) => x.id === p_photo); PH.splice(PH.indexOf(ph), 1); return ph.path; },
    app_hd_receive({ p_invoice, p_report, p_result, p_note, p_items }) {
      if (!PH.some((p) => p.invoice_id === p_invoice)) throw new Error('Chụp / tải ít nhất 1 ảnh hàng thực nhận trước khi báo.');
      if (p_result === 'thieu' && !(p_items || []).length) throw new Error('Báo THIẾU thì ghi ít nhất 1 mặt hàng thiếu và số lượng.');
      for (let k = ITEMS.length - 1; k >= 0; k--) if (ITEMS[k].invoice_id === p_invoice) ITEMS.splice(k, 1);
      if (p_result === 'thieu') p_items.forEach((x) => ITEMS.push({ invoice_id: p_invoice, ...x }));
      Object.assign(INV.find((i) => i.id === p_invoice), { result: p_result, receive_note: p_note || null, received_by: me.account_id, received_at: now(), received_report_id: p_report });
    },
    app_kt_bank_day({ p_date }) {
      const out = [];
      T.branches.filter((b) => b.status === 'Đang hoạt động').forEach((b) => order.forEach((s) => { const r = T.shift_reports.find((x) => x.branch_id === b.id && x.work_date === p_date && x.shift === s); out.push({ branch_id: b.id, branch_code: b.display_code || b.code, branch_name: b.name, shift: s, row: r ? bankJson(r) : null }); }));
      return out;
    },
    app_kt_bank_get: ({ p_report }) => bankJson(rep(p_report)),
    app_kt_bank_save({ p_report, p_opening, p_closing, p_out, p_note }) { const r = rep(p_report); if (r.recon_status === 'hoan_thanh') throw new Error('Quản lý đã HOÀN THÀNH ĐỐI SOÁT ca này nên số liệu kế toán đã khóa.'); BANK[p_report] = { opening: p_opening, closing: p_closing, transfers_out: p_out || 0, note: p_note || null, updated_by: me.account_id, updated_at: now() }; },
  };
}
