// Giả lập phần Kế toán (hóa đơn giao hàng + chuyển khoản thực nhận) — chỉ để chạy thử giao diện
export function makeKt(T, me) {
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const INV = []; const FILES = []; const PH = []; const ITEMS = [];
  let seq = 1;
  const name = (id) => (id === me.account_id ? `${me.code} – ${me.name}` : id ? 'TK ' + id : null);
  const rep = (id) => T.shift_reports.find((r) => r.id === id);
  const bcode = (id) => { const b = T.branches.find((x) => x.id === id) || {}; return b.display_code || b.code; };
  const json = (i) => ({ ...i, branch_code: bcode(i.branch_id), status: !i.result ? 'chua_nhan' : i.result,
    created_by_name: name(i.created_by), received_by_name: name(i.received_by), received_shift: i.received_report_id ? rep(i.received_report_id)?.shift : null,
    files: FILES.filter((f) => f.invoice_id === i.id), photos: PH.filter((p) => p.invoice_id === i.id), items: ITEMS.filter((x) => x.invoice_id === i.id) });
  const order = ['Sáng', 'Chiều', 'Tối'];
  const ACC = []; const BAL = {}; // BAL[reportId][accId]
  const rec = (x) => (x && x.opening != null && x.closing != null ? x.closing - x.opening + (x.transfers_out || 0) : null);
  const bankJson = (r) => {
    const mine = BAL[r.id] || {};
    const accs = ACC.filter((k) => k.branch_id === r.branch_id && (k.active || mine[k.id])).map((k) => {
      const x = mine[k.id] || {};
      const prev = T.shift_reports.filter((p) => p.branch_id === r.branch_id && BAL[p.id]?.[k.id]?.closing != null && (p.work_date < r.work_date || (p.work_date === r.work_date && order.indexOf(p.shift) < order.indexOf(r.shift))))
        .sort((a, c) => (a.work_date + order.indexOf(a.shift)).localeCompare(c.work_date + order.indexOf(c.shift))).pop();
      return { account_id: k.id, bank: k.bank, account_no: k.account_no, holder: k.holder, label: k.label, active: k.active,
        opening: x.opening ?? null, closing: x.closing ?? null, transfers_out: x.transfers_out ?? 0, note: x.note || null, received: rec(x),
        prev: prev ? { closing: BAL[prev.id][k.id].closing, work_date: prev.work_date, shift: prev.shift } : null };
    });
    const got = accs.filter((a) => a.received != null);
    const last = Object.values(mine).sort((a, c) => (c.updated_at || '').localeCompare(a.updated_at || ''))[0];
    return { report_id: r.id, status: r.status, recon_status: r.recon_status, rev_start: r.rev_start, rev_end: r.rev_end, pos_transfer: r.pos_transfer ?? null, reported_transfer: r.reported_transfer ?? null,
      accounts: accs, received: got.length ? got.reduce((t, a) => t + a.received, 0) : null, entered: got.length, account_count: accs.length,
      updated_by: last ? name(last.updated_by) : null, updated_at: last?.updated_at || null, locked: r.recon_status === 'hoan_thanh' };
  };
  T.__bankJson = (id) => bankJson(rep(id));   // bước 44: fb_gia tính tình trạng kế toán
  // bước 54: phiếu chi chuyển khoản ở trang Đối soát (cộng vào tiền chuyển ra của tài khoản ở ca)
  const OUTS = []; const CATS = [{ id: 901, name: 'Nguyên liệu' }, { id: 902, name: 'Sửa chữa' }];
  const ckLeft = (r) => { const b = bankJson(r); return b.received != null && b.entered === b.account_count ? b.received - (r.pos_transfer || 0) : null; };
  const canOut = () => me.role === 'chu' || !!me.perms.ke_toan;
  return {
    app_ca_bank_outs({ p_id }) {
      const r = rep(p_id); const mine = BAL[p_id] || {};
      return { can: canOut() && r.status === 'hoan_thanh' && r.recon_status !== 'hoan_thanh', ck_left: ckLeft(r), bank_ok: ckLeft(r) !== null,
        locked: (T.__autoLock?.[p_id] || []).includes('chuyen_khoan'),
        rows: OUTS.filter((o) => o.report_id === p_id).map((o) => ({ ...o, account: (() => { const k = ACC.find((a) => a.id === o.account_id); return `${k.bank} ${k.account_no}`; })(), category: CATS.find((c) => c.id === o.category_id)?.name || null, fund_status: o.kind === 'rut_quy' ? 'cho_nhan' : null })),
        accounts: ACC.filter((k) => k.branch_id === r.branch_id).map((k) => ({ id: k.id, label: `${k.bank} ${k.account_no}${k.holder ? ' · ' + k.holder : ''}`, entered: mine[k.id]?.opening != null && mine[k.id]?.closing != null })),
        categories: CATS };
    },
    app_ca_bank_out_save({ p_id, p }) {
      if (!canOut()) throw new Error('Chỉ Chủ, Quản lý tổng, Kế toán tạo phiếu chi ở đây.');
      if (!p.amount || p.amount <= 0) throw new Error('Nhập số tiền lớn hơn 0.');
      if (!(p.note || '').trim()) throw new Error('Ghi nội dung phiếu chi (chi gì / ai rút).');
      if (p.kind === 'chi_phi' && !p.category_id) throw new Error('Chọn nhóm chi.');
      const x = BAL[p_id]?.[p.account_id]; if (!x || x.opening == null) throw new Error('Tài khoản chưa có số dư đầu / cuối của ca này.');
      const id = seq++; OUTS.push({ id, report_id: p_id, account_id: p.account_id, kind: p.kind, amount: p.amount, category_id: p.category_id, note: p.note.trim(), by: name(me.account_id), at: now() });
      x.transfers_out = (x.transfers_out || 0) + p.amount; return id;
    },
    app_ca_bank_out_delete({ p_out }) {
      const o = OUTS.find((x) => x.id === p_out); if ((T.__autoLock?.[o.report_id] || []).includes('chuyen_khoan')) throw new Error('Mục Chuyển khoản web đã tự đối soát nên đã KHOÁ.');
      BAL[o.report_id][o.account_id].transfers_out -= o.amount; OUTS.splice(OUTS.indexOf(o), 1);
    },
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
    app_kt_accounts: () => ACC.map((k) => ({ ...k, branch_code: bcode(k.branch_id), used: Object.values(BAL).some((m) => m[k.id]) })),
    app_kt_account_save({ p_id, p_branch, p_bank, p_no, p_holder, p_label, p_active }) {
      const no = String(p_no || '').replace(/[\s.-]/g, ''); const bank = String(p_bank || '').trim().toUpperCase();
      if (!p_branch) throw new Error('Chọn chi nhánh.'); if (!/^[0-9]{4,20}$/.test(no)) throw new Error('Số tài khoản chỉ gồm chữ số (4–20 số).');
      if (ACC.some((k) => k.branch_id === p_branch && k.bank === bank && k.account_no === no && k.id !== p_id)) throw new Error(`Chi nhánh này đã có tài khoản ${bank} ${no}.`);
      if (!p_id) { const id = seq++; ACC.push({ id, branch_id: p_branch, bank, account_no: no, holder: p_holder || null, label: p_label || null, active: p_active !== false }); return id; }
      Object.assign(ACC.find((k) => k.id === p_id), { branch_id: p_branch, bank, account_no: no, holder: p_holder || null, label: p_label || null, active: p_active !== false }); return p_id;
    },
    app_kt_account_delete({ p_id }) { if (Object.values(BAL).some((m) => m[p_id])) throw new Error('Tài khoản đã có số dư theo ca nên không xóa được.'); ACC.splice(ACC.findIndex((k) => k.id === p_id), 1); },
    app_kt_bank_save_accounts({ p_report, p_rows }) {
      const r = rep(p_report); if (r.recon_status === 'hoan_thanh') throw new Error('Quản lý đã HOÀN THÀNH ĐỐI SOÁT ca này nên số liệu kế toán đã khóa.');
      const m = (BAL[p_report] ||= {});
      p_rows.forEach((x) => { if (!m[x.account_id] && x.opening == null && x.closing == null && !x.transfers_out && !x.note) return; m[x.account_id] = { opening: x.opening, closing: x.closing, transfers_out: x.transfers_out || 0, note: x.note || null, updated_by: me.account_id, updated_at: now() }; });
    },
  };
}
