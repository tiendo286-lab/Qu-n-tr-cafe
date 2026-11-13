// Giả lập các hàm app_fin_* (Chốt tháng) trong bộ nhớ — chỉ để chạy thử giao diện (lấy số từ phiếu ca giả, không qua bản đối soát)
export function makeFin(T, me) {
  for (const t of ['fin_entries', 'fin_move_cats', 'fin_month_closes', 'fin_close_log', 'fin_branch_managers']) T[t] = T[t] || [];
  T.fin_categories = T.fin_categories || [['chi', 'Nguyên liệu'], ['chi', 'Lương'], ['chi', 'Mặt bằng'], ['chi', 'Điện nước'], ['chi', 'Sửa chữa & thiết bị'], ['chi', 'Marketing'], ['chi', 'Vật dụng'], ['chi', 'Khác'], ['chi', 'Âm tiền – quán chịu'], ['thu', 'Thu khác']]
    .map(([kind, name], i) => ({ id: i + 1, kind, name, sort_order: i, active: 1 }));
  // bước 57: loại thu chi (tầng trên nhóm)
  T.fin_cat_types = T.fin_cat_types || [{ id: 1, kind: 'chi', name: 'Chi phí cố định', sort_order: 1, active: true }, { id: 2, kind: 'chi', name: 'Chi phí bán hàng', sort_order: 2, active: true },
    { id: 3, kind: 'chi', name: 'Chi phí khác', sort_order: 3, active: true }, { id: 4, kind: 'thu', name: 'Thu khác', sort_order: 1, active: true }];
  T.fin_categories.forEach((c) => { if (c.type_id === undefined) c.type_id = c.kind === 'thu' ? 4 : /^(Mặt bằng|Lương|Điện nước)/.test(c.name) ? 1 : /^(Nguyên liệu|Vật dụng)/.test(c.name) ? 2 : 3; });
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const today = () => now().slice(0, 10);
  const nid = (t) => Math.max(0, ...T[t].map((x) => x.id || 0)) + 1;
  const admin = () => ['chu', 'ql_tong'].includes(me.role);
  const canB = (b) => admin() || (me.role === 'ql' && T.fin_branch_managers.some((m) => m.account_id === me.account_id && m.branch_id === b));
  const need = (b) => { if (!canB(b)) throw new Error('Bạn không được xem / sửa chốt tháng của cơ sở này.'); };
  const locked = (b, d) => T.fin_month_closes.some((c) => c.branch_id === b && c.month === String(d).slice(0, 7));
  const guard = (b, d) => { if (locked(b, d)) throw new Error(`Tháng ${d.slice(5, 7)}/${d.slice(0, 4)} của cơ sở này đã CHỐT nên không sửa được. Chủ mở lại tháng (ghi lý do) trước khi sửa.`); };
  const br = (id) => T.branches.find((b) => b.id === id);
  const name = (aid) => (aid === me.account_id ? `${me.code} – ${me.name}` : 'TK ' + aid);
  const calc = (b, m) => {
    const B = br(b); const from = m + '-01'; const [y, mo] = m.split('-').map(Number); const to = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
    const rs = T.shift_reports.filter((r) => r.branch_id === b && r.work_date >= from && r.work_date <= to); const dn = rs.filter((r) => r.status === 'hoan_thanh');
    const chain = T.branch_shifts.filter((x) => x.branch_id === b && x.enabled).length;
    const upto = today() < to ? today() : to; const nd = upto < from ? 0 : Math.round((new Date(upto) - new Date(from)) / 864e5) + 1;
    const s = (a, k) => a.reduce((t, r) => t + Number(r[k] || 0), 0);
    const mv = (rid) => T.shift_report_moves.filter((x) => x.report_id === rid);
    const moves = []; dn.forEach((r) => { const seen = {}; mv(r.id).forEach((x) => { const h = `${x.kind}|${x.amount}|${x.note}`; seen[h] = (seen[h] || 0) + 1; const mkey = h + '#' + seen[h];
      const c = T.fin_move_cats.find((z) => z.report_id === r.id && z.mkey === mkey);
      moves.push({ report_id: r.id, date: r.work_date, shift: r.shift, kind: x.kind, amount: x.amount, note: x.note, mkey, category_id: c ? c.category_id : null, excluded: c ? !!c.excluded : x.amount > 0, set: !!c }); }); });
    const entries = T.fin_entries.filter((e) => e.branch_id === b && e.entry_date >= from && e.entry_date <= to).map((e) => ({ ...e, category: T.fin_categories.find((c) => c.id === e.category_id)?.name || null, by: name(e.created_by) }));
    const days = [...new Set(dn.map((r) => r.work_date))].sort().map((d) => { const x = dn.filter((r) => r.work_date === d); const c = T.daily_cash_closings.find((z) => z.branch_id === b && z.work_date === d);
      const op = rs.find((r) => r.work_date === d)?.opening_cash ?? null; const pc = s(x, 'pos_cash'); const mc = x.reduce((t, r) => t + mv(r.id).filter((z) => z.kind === 'tien_mat').reduce((u, z) => u + z.amount, 0), 0);
      return { date: d, done: x.length, opening: op, pos_cash: pc, moves_cash: mc, debt_cash: 0, counted: c?.counted ?? null, expected: op === null ? null : op + pc + mc }; });
    const inc = moves.filter((x) => !x.excluded);
    const chiCa = inc.filter((x) => x.amount < 0).reduce((t, x) => t - x.amount, 0); const thuCa = inc.filter((x) => x.amount > 0).reduce((t, x) => t + x.amount, 0);
    const chiTay = s(entries.filter((e) => e.kind === 'chi'), 'amount'); const thuTay = s(entries.filter((e) => e.kind === 'thu'), 'amount');
    const grp = {}; [...inc.map((x) => ({ kind: x.amount < 0 ? 'chi' : 'thu', cid: x.category_id, amt: Math.abs(x.amount) })), ...entries.map((e) => ({ kind: e.kind, cid: e.category_id, amt: e.amount }))]
      .forEach((x) => { const k = x.kind + '|' + (x.cid || ''); grp[k] = grp[k] || { kind: x.kind, category_id: x.cid || null, name: T.fin_categories.find((c) => c.id === x.cid)?.name || 'Chưa phân nhóm', amount: 0 }; grp[k].amount += x.amt; });
    const rev = s(dn, 'total_revenue'); const cl = T.fin_month_closes.find((c) => c.branch_id === b && c.month === m);
    const ka = { total: 0, chua_xu_ly: 0, da_bu: 0, tru_luong: 0, mien: 0, count: 0 };
    return { branch_id: b, branch_code: B.display_code || B.code, branch_name: B.name, month: m, from, to,
      revenue: { reports: rs.length, done: dn.length, recon: rs.filter((r) => r.recon_status === 'hoan_thanh').length, in_progress: rs.filter((r) => r.status === 'dang_chot').length, expect: chain * nd,
        total_revenue: rev, pos_cash: s(dn, 'pos_cash'), pos_transfer: s(dn, 'pos_transfer'), cups: s(dn, 'cups'), debt_new: 0, debt_col_tm: 0, debt_col_ck: 0 },
      days, bank: { pos_transfer: s(dn, 'pos_transfer'), received: 0, pos_transfer_ok: 0, shifts_ok: 0, shifts: dn.length }, moves, entries, shortfalls: ka, by_cat: Object.values(grp),
      cash: { pos_cash: s(dn, 'pos_cash'), debt_cash: 0, moves_cash: days.reduce((t, d) => t + d.moves_cash, 0), gap: days.filter((d) => d.counted !== null && d.expected !== null).reduce((t, d) => t + d.counted - d.expected, 0),
        days_counted: days.filter((d) => d.counted !== null).length, days_open: days.length },
      totals: { revenue: rev, chi_ca: chiCa, thu_ca: thuCa, chi_tay: chiTay, thu_tay: thuTay, chi: chiCa + chiTay, thu: thuCa + thuTay, profit: rev + thuCa + thuTay - chiCa - chiTay, uncat: inc.filter((x) => !x.category_id).length },
      closed: cl ? { by: name(cl.closed_by), at: cl.closed_at, note: cl.note } : null };
  };
  // Thu chi (Quản lý ca): người có quyền Đối soát xem mọi cơ sở
  const tcCan = (b) => !!me.perms?.doi_soat || canB(b);
  const ktId = () => { T.loan_people = T.loan_people || []; let k = T.loan_people.find((p) => p.name.toLowerCase() === 'kho tổng'); if (!k) { k = { id: T.loan_people.length + 1, name: 'Kho tổng', phone: null, note: null, active: true }; T.loan_people.push(k); } return k.id; };
  const tcRows = (b, from, to) => {
    const brs = T.branches.filter((x) => x.status === 'Đang hoạt động' && tcCan(x.id) && (!b || x.id === b)).map((x) => x.id);
    const out = [];
    T.shift_reports.filter((r) => brs.includes(r.branch_id) && r.status === 'hoan_thanh' && r.work_date >= from && r.work_date <= to).forEach((r) => {
      const seen = {};
      T.shift_report_moves.filter((x) => x.report_id === r.id && x.amount).forEach((x) => {
        const h = `${x.kind}|${x.amount}|${x.note}`; seen[h] = (seen[h] || 0) + 1; const mkey = h + '#' + seen[h];
        const c = T.fin_move_cats.find((z) => z.report_id === r.id && z.mkey === mkey);
        out.push({ src: 'ca', report_id: r.id, mkey, branch_id: r.branch_id, date: r.work_date, shift: r.shift, kind: x.amount < 0 ? 'chi' : 'thu', pay: x.kind, amount: Math.abs(x.amount), note: x.note,
          category_id: c ? c.category_id : null, category: T.fin_categories.find((k) => k.id === c?.category_id)?.name || null, excluded: c ? !!c.excluded : x.amount > 0,
          loan_id: (T.branch_loans || []).find((l) => l.report_id === r.id && l.mkey === mkey)?.id || null,
          ka_n: (T.__SF || []).filter((k) => k.report_id === r.id && k.move_mkey === mkey && k.status !== 'huy').length,
          status: c?.checked ? 'da' : 'cho', checked_by: c?.checked ? name(c.checked_by) : null, checked_at: c?.checked_at || null, by: 'NV chốt ca', locked: locked(r.branch_id, r.work_date) });
      });
    });
    (T.__SF || []).filter((k) => k.status !== 'huy').forEach((k) => {
      const r = T.shift_reports.find((x) => x.id === k.report_id); if (!r || !brs.includes(r.branch_id) || r.work_date < from || r.work_date > to) return;
      const e = T.employees.find((x) => x.id === k.employee_id) || {};
      out.push({ src: 'ka', id: k.id, report_id: r.id, branch_id: r.branch_id, date: r.work_date, shift: r.shift, kind: 'chi', pay: null, amount: k.amount, note: `Thiếu tiền ca – ${e.code} – ${e.name}`,
        item: k.item, item_label: { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản', thu_chi: 'Thu chi', cong_no: 'Công nợ', am_tien: 'Âm tiền (phiếu ca)' }[k.item], move_mkey: k.move_mkey || null, employee_id: k.employee_id, employee: `${e.code} – ${e.name}`,
        reason: k.reason, ka_status: k.status, auto_tru: !!k.auto_tru, status_note: k.status_note, reply: k.reply || null, seen_at: k.seen_at || null,
        category_id: null, category: null, excluded: true, status: 'da', by: name(k.created_by), locked: locked(r.branch_id, r.work_date) });
    });
    T.fin_entries.filter((e) => brs.includes(e.branch_id) && e.entry_date >= from && e.entry_date <= to).forEach((e) => out.push({ src: 'tay', id: e.id, branch_id: e.branch_id, date: e.entry_date, shift: null,
      kind: e.kind, pay: e.pay_method, amount: e.amount, note: e.note, category_id: e.category_id, category: T.fin_categories.find((k) => k.id === e.category_id)?.name || null, excluded: false,
      status: 'da', checked_by: name(e.created_by), checked_at: e.created_at, by: name(e.created_by), locked: locked(e.branch_id, e.entry_date), bank_out: !!e.bank_out }));
    return out.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  };
  const tc = {
    app_tc_list: ({ p_branch, p_from, p_to }) => ({ rows: tcRows(p_branch, p_from, p_to), can_money: !!me.perms?.doi_soat, can_direct: admin(), loan_branches: T.branches.filter((b) => (b.display_code || b.code) === 'LHP').map((b) => b.id), categories: T.fin_categories.map((c) => ({ ...c, active: !!c.active })),
      branches: T.branches.filter((b) => b.status === 'Đang hoạt động' && tcCan(b.id)).sort((a, c) => a.sort_order - c.sort_order).map((b) => ({ id: b.id, code: b.display_code || b.code, name: b.name })) }),
    // Bước 69: số tổng hợp đầu trang Thu chi (1 cơ sở)
    app_tc_summary: ({ p_branch, p_from }) => {
      const d0 = new Date(p_from + 'T00:00:00Z'); const pf = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
      const pt = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 0)).toISOString().slice(0, 10);
      const prev = {}; tcRows(p_branch, pf, pt).filter((x) => x.kind === 'chi' && x.src !== 'ka' && !x.excluded && !x.loan_id).forEach((x) => { const k = String(x.category_id || 0); prev[k] = (prev[k] || 0) + Number(x.amount); });
      const debts = (T.shift_debts || []).filter((x) => x.branch_id === p_branch && !x.closed_report_id && !x.closed_at);
      const loans = (T.branch_loans || []).filter((l) => l.branch_id === p_branch).reduce((s, l) => s + Math.max(0, l.amount - (T.loan_pays || []).filter((y) => y.loan_id === l.id).reduce((t, y) => t + y.amount, 0)), 0);
      return { debts: { n: debts.length, sum: debts.reduce((t, x) => t + Number(x.amount), 0) }, loans_left: loans, ca: { n: 0, short: 0, over: 0, n_short: 0, n_over: 0 }, prev_chi: prev, prev_from: pf };
    },
    // Bước 35: gom việc chờ đối soát
    app_ds_todo() {
      const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
      const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 2); const from = d.toISOString().slice(0, 10);
      const brs = T.branches.filter((x) => x.status === 'Đang hoạt động');
      const lbl = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản', thu_chi: 'Thu chi', cong_no: 'Công nợ' };
      const emp = (id) => T.employees.find((x) => x.id === id) || {};
      return {
        from, today, branches: brs.map((b) => ({ id: b.id, code: b.display_code || b.code, name: b.name })),
        categories: T.fin_categories.map((c) => ({ ...c, active: !!c.active })),
        reports: T.shift_reports.filter((r) => r.status === 'hoan_thanh' && r.recon_status !== 'hoan_thanh').map((r) => ({ id: r.id, branch_id: r.branch_id, date: r.work_date, shift: r.shift,
          recon_status: r.recon_status || 'chua', checks: T.shift_report_checks.filter((c) => c.report_id === r.id).length, cash_left: null, transfer_left: null, ck_basis: 'nhan_vien', revenue: r.total_revenue })),
        moves: tcRows(null, from, today).filter((x) => x.src === 'ca' && x.status === 'cho'),
        goods: (T.delivery_invoices || []).filter((i) => i.state !== 'dang_chuyen' && i.received_report_id && (T.delivery_lines || []).some((l) => l.invoice_id === i.id && !l.checked_at)).map((i) => {
          const r = T.shift_reports.find((x) => x.id === i.received_report_id) || {}; const ls = (T.delivery_lines || []).filter((l) => l.invoice_id === i.id);
          return { id: i.id, branch_id: i.branch_id, doc_no: i.doc_no, kind: i.kind, report_id: i.received_report_id, report_status: r.status, date: r.work_date, shift: r.shift, n_lines: ls.length, n_unchecked: ls.filter((l) => !l.checked_at).length };
        }),
        ka: (T.__SF || []).filter((k) => k.reply && (k.auto_tru || k.status === 'chua_xu_ly')).map((k) => {
          const r = T.shift_reports.find((x) => x.id === k.report_id) || {}; const e = emp(k.employee_id);
          return { ...k, employee: `${e.code} – ${e.name}`, item_label: lbl[k.item], branch_id: r.branch_id, branch: (T.branches.find((b) => b.id === r.branch_id) || {}).code, work_date: r.work_date, shift: r.shift };
        }),
      };
    },
    app_tc_check({ p_report, p_mkey, p_category, p_excluded, p_checked }) {
      const r = T.shift_reports.find((x) => x.id === p_report); if (!tcCan(r.branch_id)) throw new Error('Bạn không được xem / sửa thu chi của cơ sở này.'); guard(r.branch_id, r.work_date);
      if (p_checked && !p_excluded && !p_category) throw new Error('Chọn nhóm (hoặc "Không tính") rồi mới đối soát.');
      T.fin_move_cats = T.fin_move_cats.filter((z) => !(z.report_id === p_report && z.mkey === p_mkey)).concat([{ report_id: p_report, mkey: p_mkey, category_id: p_excluded ? null : p_category,
        excluded: p_excluded ? 1 : 0, checked: p_checked ? 1 : 0, checked_by: p_checked ? me.account_id : null, checked_at: p_checked ? now() : null }]);
    },
    app_tc_entry_save({ p_id, p }) {
      const b = Number(p.branch_id); if (!b) throw new Error('Chọn cơ sở.'); if (!tcCan(b)) throw new Error('Bạn không được xem / sửa thu chi của cơ sở này.'); guard(b, p.entry_date);
      if (!(p.amount > 0)) throw new Error('Nhập số tiền lớn hơn 0.'); if (!(p.note || '').trim()) throw new Error(`Ghi nội dung khoản ${p.kind}.`);
      if (!p.category_id) throw new Error(`Chọn nhóm ${p.kind}.`);
      const row = { branch_id: b, entry_date: p.entry_date, kind: p.kind, category_id: Number(p.category_id), amount: p.amount, note: p.note.trim(), pay_method: p.pay_method || 'tien_mat' };
      const old = p_id ? T.fin_entries.find((e) => e.id === p_id) : null;
      if (old) { Object.assign(old, row); return old.id; } const id = nid('fin_entries'); T.fin_entries.push({ id, ...row, created_by: me.account_id, created_at: now() }); return id;
    },
    // bước 65: sửa khoản phiếu ca (giả lập: sửa thẳng dòng phiếu, mang nhóm sang khoá mới) + đổi nhóm hàng loạt
    app_tc_move_edit({ p_report, p_mkey, p }) {
      const r = T.shift_reports.find((x) => x.id === p_report); if (!tcCan(r.branch_id)) throw new Error('Bạn không được xem / sửa thu chi của cơ sở này.'); guard(r.branch_id, r.work_date);
      const seen = {}; const mv = T.shift_report_moves.filter((x) => x.report_id === p_report && x.amount).find((x) => { const h = `${x.kind}|${x.amount}|${x.note}`; seen[h] = (seen[h] || 0) + 1; return h + '#' + seen[h] === p_mkey; });
      if (!mv) throw new Error('Khoản này vừa thay đổi. Tải lại trang rồi sửa lại.');
      if (!(p.amount > 0)) throw new Error('Nhập số tiền lớn hơn 0.'); if (!(p.note || '').trim()) throw new Error('Ghi nội dung khoản.');
      if (!p.excluded && !p.category_id) throw new Error('Chọn nhóm (hoặc "Không tính").');
      const signed = p.kind === 'chi' ? -p.amount : p.amount; const money = signed !== mv.amount || p.pay !== mv.kind;
      if (money && !me.perms?.doi_soat) throw new Error('Sửa số tiền / hình thức khoản ở phiếu ca cần quyền Đối soát. Bạn đổi được nhóm và nội dung.');
      if (money && !(p.reason || '').trim()) throw new Error('Ghi lý do sửa số tiền / hình thức.');
      Object.assign(mv, { kind: p.pay, amount: signed, note: p.note.trim() });
      const s2 = {}; let nk = null; T.shift_report_moves.filter((x) => x.report_id === p_report && x.amount).forEach((x) => { const h = `${x.kind}|${x.amount}|${x.note}`; s2[h] = (s2[h] || 0) + 1; if (x === mv) nk = h + '#' + s2[h]; });
      T.fin_move_cats = T.fin_move_cats.filter((z) => !(z.report_id === p_report && (z.mkey === p_mkey || z.mkey === nk))).concat([{ report_id: p_report, mkey: nk, category_id: p.excluded ? null : Number(p.category_id), excluded: p.excluded ? 1 : 0, checked: 1, checked_by: me.account_id, checked_at: now() }]);
      return { money, direct: money && admin(), auto: null, recon_status: r.recon_status };
    },
    // bước 68: gán khoản "Âm tiền" thành trừ lương / bỏ gán
    app_tc_move_to_ka({ p_report, p_mkey, p_people, p_reason }) {
      const row = tcRows(null, '2000-01-01', '2999-12-31').find((x) => x.src === 'ca' && x.report_id === p_report && x.mkey === p_mkey);
      const tot = p_people.reduce((t, x) => t + x.amount, 0);
      if (!p_people.length) throw new Error('Chọn ít nhất 1 người chịu.');
      if (tot !== row.amount) throw new Error(`Tổng người chịu (${tot}) phải bằng số tiền khoản (${row.amount}).`);
      const SF = T.__SF; let id = Math.max(0, ...SF.map((k) => k.id)) + 1;
      p_people.forEach((x) => SF.push({ id: id++, report_id: p_report, item: 'am_tien', employee_id: x.employee_id, amount: x.amount, reason: p_reason || row.note, status: 'tru_luong', auto_tru: true, move_mkey: p_mkey, created_by: me.account_id }));
      tc.app_tc_check({ p_report, p_mkey, p_category: null, p_excluded: true, p_checked: true }); return p_people.length;
    },
    app_tc_move_ka_undo({ p_report, p_mkey }) {
      T.__SF.filter((k) => k.report_id === p_report && k.move_mkey === p_mkey).forEach((k) => { k.status = 'huy'; });
      T.fin_move_cats = T.fin_move_cats.filter((z) => !(z.report_id === p_report && z.mkey === p_mkey));
    },
    app_tc_bulk_cat({ p_items, p_category, p_excluded }) {
      let n = 0;
      for (const it of p_items) {
        if (it.src === 'ca') tc.app_tc_check({ p_report: it.report_id, p_mkey: it.mkey, p_category, p_excluded, p_checked: true });
        else { const e = T.fin_entries.find((x) => x.id === it.id); if (p_excluded) throw new Error(`Khoản "${e.note}" do quản lý tạo — không chọn "Không tính" được.`); guard(e.branch_id, e.entry_date); e.category_id = p_category; }
        n++;
      }
      return n;
    },
    app_tc_entry_delete({ p_id }) { const e = T.fin_entries.find((x) => x.id === p_id); if (!e) return; guard(e.branch_id, e.entry_date); T.fin_entries = T.fin_entries.filter((x) => x !== e); },
  };
  return {
    ...tc,
    app_fin_branches: () => ({ admin: admin(), owner: me.role === 'chu', branches: T.branches.filter((b) => b.status === 'Đang hoạt động' && canB(b.id)).sort((a, c) => a.sort_order - c.sort_order).map((b) => ({ id: b.id, code: b.display_code || b.code, name: b.name })) }),
    app_fin_month({ p_branch, p_month }) { need(p_branch); const c = calc(p_branch, p_month); const wd = (T.fund_withdrawals || []).filter((w) => w.branch_id === p_branch && w.wdate.startsWith(p_month)).reduce((s, w) => s + w.amount, 0);
      return { ...c, ext: [], ext_bad: 0, recon: { active: p_month >= '2026-11', profit: c.totals.profit, must: c.totals.profit, withdrawn: wd, withdrawn_tm: wd, withdrawn_ck: 0, gap: wd - c.totals.profit, closing: 0, cash_diff: 0, bank_diff: 0 }, categories: T.fin_categories, log: T.fin_close_log.filter((l) => l.branch_id === p_branch && l.month === p_month).slice().reverse(), can_reopen: me.role === 'chu' }; },
    app_fin_overview: ({ p_month }) => T.branches.filter((b) => b.status === 'Đang hoạt động' && canB(b.id)).map((b) => { const c = calc(b.id, p_month); return { branch_id: b.id, code: c.branch_code, name: c.branch_name, revenue: c.revenue, totals: c.totals, cash: c.cash, shortfalls: c.shortfalls, closed: c.closed }; }),
    app_fin_entry_save({ p_id, p }) {
      const old = p_id ? T.fin_entries.find((e) => e.id === p_id) : null; const b = old ? old.branch_id : p.branch_id; need(b);
      if (old) guard(b, old.entry_date); guard(b, p.entry_date);
      if (!(p.amount > 0)) throw new Error('Nhập số tiền lớn hơn 0.'); if (!(p.note || '').trim()) throw new Error('Ghi nội dung khoản.');
      if (p.category_id && T.fin_categories.find((c) => c.id === Number(p.category_id))?.kind !== p.kind) throw new Error('Nhóm không đúng loại Chi / Thu.');
      const row = { branch_id: b, entry_date: p.entry_date, kind: p.kind, category_id: p.category_id ? Number(p.category_id) : null, amount: p.amount, note: p.note.trim(), pay_method: p.pay_method || 'tien_mat' };
      if (old) { Object.assign(old, row); return old.id; } const id = nid('fin_entries'); T.fin_entries.push({ id, ...row, created_by: me.account_id, created_at: now() }); return id;
    },
    app_fin_entry_delete({ p_id }) { const e = T.fin_entries.find((x) => x.id === p_id); if (!e) return; need(e.branch_id); guard(e.branch_id, e.entry_date); T.fin_entries = T.fin_entries.filter((x) => x !== e); },
    app_fin_move_set({ p_report, p_mkey, p_category, p_excluded }) {
      const r = T.shift_reports.find((x) => x.id === p_report); need(r.branch_id); guard(r.branch_id, r.work_date);
      T.fin_move_cats = T.fin_move_cats.filter((z) => !(z.report_id === p_report && z.mkey === p_mkey)).concat([{ report_id: p_report, mkey: p_mkey, category_id: p_excluded ? null : p_category, excluded: p_excluded ? 1 : 0 }]);
    },
    app_fin_close({ p_branch, p_month, p_note }) {
      need(p_branch); if (p_month >= today().slice(0, 7)) throw new Error('Chỉ chốt được tháng đã kết thúc.');
      const c = calc(p_branch, p_month);
      if (c.revenue.in_progress) throw new Error(`Còn ${c.revenue.in_progress} phiếu chốt ca đang chốt dở trong tháng.`);
      if (c.revenue.recon < c.revenue.done) throw new Error(`Còn ${c.revenue.done - c.revenue.recon} ca chưa hoàn thành đối soát. Đối soát xong rồi mới chốt tháng.`);
      if (c.totals.uncat) throw new Error(`Còn ${c.totals.uncat} khoản chi ở phiếu ca chưa phân nhóm.`);
      T.fin_month_closes.push({ branch_id: p_branch, month: p_month, note: p_note || null, closed_by: me.account_id, closed_at: now() });
      T.fin_close_log.push({ branch_id: p_branch, month: p_month, action: 'chot', reason: p_note || null, by: name(me.account_id), at: now() });
    },
    app_fin_reopen({ p_branch, p_month, p_reason }) {
      if (me.role !== 'chu') throw new Error('Chỉ Chủ được mở lại tháng đã chốt.'); if (!(p_reason || '').trim()) throw new Error('Ghi lý do mở lại tháng.');
      T.fin_month_closes = T.fin_month_closes.filter((c) => !(c.branch_id === p_branch && c.month === p_month));
      T.fin_close_log.push({ branch_id: p_branch, month: p_month, action: 'mo_lai', reason: p_reason, by: name(me.account_id), at: now() });
    },
    app_fin_category_save({ p_id, p_kind, p_name, p_sort, p_active }) {
      if (!admin()) throw new Error('Chỉ Chủ và Quản lý tổng sửa được nhóm chi / thu.'); if (!(p_name || '').trim()) throw new Error('Nhập tên nhóm.');
      if (p_id) { Object.assign(T.fin_categories.find((c) => c.id === p_id), { name: p_name.trim(), active: p_active ? 1 : 0 }); return p_id; }
      const id = nid('fin_categories'); T.fin_categories.push({ id, kind: p_kind, name: p_name.trim(), sort_order: p_sort || 50, active: 1, type_id: null }); return id;
    },
    // bước 71: tab Âm tiền — dữ liệu mẫu do bài thử gán vào T.gap_fx (mỗi dòng: report_id, date, shift, item, kind, total, staff)
    app_gap_list({ p_branch, p_month }) {
      if (!(admin() || me.role === 'ql')) throw new Error('Chỉ Chủ, Quản lý tổng, Quản lý cơ sở dùng tab Âm tiền.');
      T.gap_m = T.gap_m || []; T.gap_d = T.gap_d || []; T.gap_tl = T.gap_tl || [];
      const rows = (T.gap_fx || []).filter((g) => g.branch_id === p_branch).map((g) => {
        const side = (m) => (g.kind === 'thieu' ? m.short === g.report_id : m.over === g.report_id) && m.item === g.item;
        const ms = T.gap_m.filter(side); const mt = ms.filter((m) => m.status === 'da_duyet').reduce((s, m) => s + m.amount, 0); const mp = ms.filter((m) => m.status === 'cho_duyet').reduce((s, m) => s + m.amount, 0);
        const ds = T.gap_d.filter((d) => d.report_id === g.report_id && d.item === g.item); const dcs = ds.reduce((s, d) => s + d.amount, 0);
        const pp = g.kind === 'thieu' ? T.gap_tl.filter((x) => x.report_id === g.report_id && x.item === g.item && x.status !== 'huy') : [];
        const tl = pp.reduce((s, x) => s + x.amount, 0); const remain = Math.max(0, g.total - tl - dcs - mt);
        const state = remain <= 5000 ? 'xong' : g.kind === 'du' ? 'du' : g.item === 'chuyen_khoan' ? 'cho_tien' : 'cho_gan';
        return { ...g, lech: g.kind === 'thieu' ? -g.total : g.total, tl, dcs, mt, mp, remain, state, in_month: (g.date || '').startsWith(p_month), locked: false, result: { result: g.kind === 'thieu' ? 'thieu' : 'thua', amount: g.total, reason: 'lệch tiền' },
          people: pp.map((x) => ({ id: x.id, name: x.name, amount: x.amount, status: x.status })), decisions: ds.map((d) => ({ ...d, by: 'admin – Chủ' })),
          matches: ms.map((m) => { const o = (T.gap_fx || []).find((x) => x.report_id === (g.kind === 'thieu' ? m.over : m.short)); return { id: m.id, amount: m.amount, reason: m.reason, status: m.status, other: o?.report_id, other_date: o?.date, other_shift: o?.shift, by: 'admin – Chủ', mine: true, approved_by: m.status === 'da_duyet' ? 'admin – Chủ' : null }; }) };
      });
      const pending = rows.filter((r) => r.kind === 'thieu' && ['cho_tien', 'cho_gan'].includes(r.state)).length;
      return { role: admin() ? 'admin' : 'ql', from: p_month + '-01', to: p_month + '-30', pending, locked: false, rows,
        branches: T.branches.filter((b) => b.status === 'Đang hoạt động').map((b) => ({ id: b.id, code: b.display_code || b.code, name: b.name })) };
    },
    app_gap_match({ p_short, p_over, p_item, p_amount, p_reason }) {
      if (!(p_reason || '').trim()) throw new Error('Ghi lý do ghép (vd: khách CK tối 13 về sáng 14).'); if (!(p_amount > 0)) throw new Error('Nhập số tiền ghép lớn hơn 0.');
      T.gap_m = T.gap_m || []; const id = T.gap_m.length + 1; const st = admin() ? 'da_duyet' : 'cho_duyet';
      T.gap_m.push({ id, short: p_short, over: p_over, item: p_item, amount: p_amount, reason: p_reason, status: st });
      if (st === 'da_duyet') { let ex = p_amount; (T.gap_tl || []).filter((x) => x.report_id === p_short && x.item === p_item && x.status === 'tru_luong').reverse().forEach((x) => { if (ex <= 0) return; const t = Math.min(ex, x.amount); if (t === x.amount) x.status = 'huy'; else x.amount -= t; ex -= t; }); }
      return id;
    },
    app_gap_match_approve({ p_id, p_ok }) { if (!admin()) throw new Error('Chỉ Chủ / Quản lý tổng duyệt ghép.'); const m = T.gap_m.find((x) => x.id === p_id); if (p_ok) m.status = 'da_duyet'; else T.gap_m = T.gap_m.filter((x) => x.id !== p_id); },
    app_gap_match_delete({ p_id }) { T.gap_m = (T.gap_m || []).filter((x) => x.id !== p_id); },
    app_gap_tl({ p_report, p_item, p_people, p_reason }) {
      if (!(p_reason || '').trim()) throw new Error('Ghi lý do.'); if (!(p_people || []).length) throw new Error('Chọn nhân viên chịu.');
      T.gap_tl = T.gap_tl || []; const g = (T.gap_fx || []).find((x) => x.report_id === p_report && x.item === p_item);
      p_people.forEach((x) => T.gap_tl.push({ id: T.gap_tl.length + 1, report_id: p_report, item: p_item, amount: x.amount, status: 'tru_luong', name: (g?.staff || []).find((s) => s.employee_id === x.employee_id)?.name || 'NV' }));
    },
    app_gap_decide({ p_report, p_item, p_kind, p_amount, p_reason }) {
      if (p_kind === 'quan_chiu' && !admin()) throw new Error('Chỉ Chủ / Quản lý tổng bấm Quán chịu.'); if (!(p_amount > 0)) throw new Error('Nhập số tiền lớn hơn 0.');
      T.gap_d = T.gap_d || []; const id = T.gap_d.length + 1; T.gap_d.push({ id, report_id: p_report, item: p_item, kind: p_kind, amount: p_amount, reason: p_reason || '' }); return id;
    },
    app_gap_decision_delete({ p_id }) { T.gap_d = (T.gap_d || []).filter((x) => x.id !== p_id); },
    // bước 70: khách nợ (quản lý ghi, không thuộc ca) + khách nợ từ phiếu ca
    app_cn_debts({ p_branch }) {
      const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
      const open = (T.shift_debts || []).filter((d) => d.branch_id === p_branch && !d.closed_at && d.kind !== 'muon' && (d.report_id == null || T.shift_reports.find((r) => r.id === d.report_id)?.status === 'hoan_thanh'))
        .map((d) => { const r = T.shift_reports.find((x) => x.id === d.report_id); return { id: d.id, name: d.table_name, phone: d.phone || null, amount: d.amount, note: d.note || '', date: r ? r.work_date : (d.created_at || today).slice(0, 10), shift: r?.shift || null, report_id: d.report_id ?? null, by_ql: d.report_id == null, by: 'admin – Chủ', split: !!d.split_from, paid_before: 0, gap_report: d.gap_report || null, gap_ca: d.gap_report ? 'Sáng' : null }; });
      return { can_edit: admin() || me.role === 'ql', open };
    },
    app_cn_debt_save({ p_id, p }) {
      if (!(p.name || '').trim()) throw new Error('Ghi tên khách nợ.'); if (!(p.amount > 0)) throw new Error('Nhập số tiền nợ lớn hơn 0.');
      T.shift_debts = T.shift_debts || [];
      if (p_id) { Object.assign(T.shift_debts.find((d) => d.id === p_id), { table_name: p.name.trim(), phone: p.phone || null, amount: p.amount, note: p.note || '' }); return p_id; }
      const id = nid('shift_debts'); T.shift_debts.push({ id, branch_id: p.branch_id, report_id: null, table_name: p.name.trim(), phone: p.phone || null, amount: p.amount, note: p.note || '', kind: 'bill', created_at: (p.date || '') + ' 09:00:00' }); return id;
    },
    app_cn_debt_delete({ p_id }) { T.shift_debts = T.shift_debts.filter((d) => d.id !== p_id); },
    // bước 64: cho vay (chỉ LHP)
    app_loans({ p_branch }) {
      const b = T.branches.find((x) => x.id === p_branch); if (!b) return { enabled: false };
      T.loan_people = T.loan_people || []; T.branch_loans = T.branch_loans || []; T.loan_pays = T.loan_pays || [];
      const kt = ktId();
      const paidOf = (l) => T.loan_pays.filter((y) => y.loan_id === l.id).reduce((s, y) => s + y.amount, 0);
      const mine = T.branch_loans.filter((l) => l.branch_id === p_branch);
      return { enabled: true, can_people: admin(), kho_tong_id: kt, tra_ho_ok: (b.display_code || b.code) === 'LHP',
        people: T.loan_people.map((p) => { const ls = mine.filter((l) => l.person_id === p.id); const lent = ls.reduce((s, l) => s + l.amount, 0); const paid = ls.reduce((s, l) => s + paidOf(l), 0); return { ...p, lent, paid, owe: lent - paid }; }),
        loans: mine.map((l) => ({ kind: 'vay', ...l, shift: l.report_id ? T.shift_reports.find((x) => x.id === l.report_id)?.shift : null, person: T.loan_people.find((p) => p.id === l.person_id)?.name, paid: paidOf(l), locked: false, by: 'admin – Chủ', payments: T.loan_pays.filter((y) => y.loan_id === l.id).map((y) => ({ ...y, locked: false, by: 'admin – Chủ' })) })).reverse() };
    },
    app_loan_people: () => ({ can_edit: admin(), people: (T.loan_people || []).map((p) => ({ ...p, used: (T.branch_loans || []).some((l) => l.person_id === p.id) })) }),
    app_loan_person_save({ p_id, p_name, p_phone, p_note, p_active }) {
      if (!admin()) throw new Error('Chỉ Chủ và Quản lý tổng khai báo người vay.'); if (!(p_name || '').trim()) throw new Error('Nhập tên người vay.');
      T.loan_people = T.loan_people || [];
      if (p_id) { Object.assign(T.loan_people.find((p) => p.id === p_id), { name: p_name.trim(), phone: p_phone || null, note: p_note || null, active: !!p_active }); return p_id; }
      const id = T.loan_people.length + 1; T.loan_people.push({ id, name: p_name.trim(), phone: p_phone || null, note: p_note || null, active: true }); return id;
    },
    app_loan_save({ p_id, p }) {
      const kind = p_id ? ((T.branch_loans || []).find((x) => x.id === p_id)?.kind || 'vay') : p.kind || 'vay';
      if (kind === 'tra_ho') { if ((T.branches.find((x) => x.id === p.branch_id)?.code) !== 'LHP') throw new Error('Cơ sở này không dùng mục Trả hộ Kho tổng.'); p.person_id = ktId(); if (!(p.note || '').trim()) throw new Error('Ghi nội dung trả hộ (vd: tiền ga, ship hàng).'); }
      if (!p.person_id) throw new Error('Chọn người vay.'); if (!(p.amount > 0)) throw new Error('Nhập số tiền cho vay lớn hơn 0.');
      T.branch_loans = T.branch_loans || [];
      if (p_id) { const l = T.branch_loans.find((x) => x.id === p_id); const paid = (T.loan_pays || []).filter((y) => y.loan_id === p_id).reduce((s, y) => s + y.amount, 0);
        if (p.amount < paid) throw new Error(`Số tiền vay không được nhỏ hơn số đã trả (${paid}).`); Object.assign(l, { person_id: p.person_id, date: p.date, amount: p.amount, method: p.method, note: p.note || '' }); return p_id; }
      const id = T.branch_loans.length + 1;
      T.branch_loans.push({ id, kind, branch_id: p.branch_id, person_id: p.person_id, date: p.date, amount: p.amount, method: p.method, note: p.note || '' }); return id;
    },
    app_loan_pay({ p_loan, p_date, p_amount, p_method, p_note }) {
      T.loan_pays = T.loan_pays || []; const l = T.branch_loans.find((x) => x.id === p_loan);
      const owe = l.amount - T.loan_pays.filter((y) => y.loan_id === l.id).reduce((s, y) => s + y.amount, 0);
      if (!(p_amount > 0)) throw new Error('Nhập số tiền trả lớn hơn 0.'); if (p_amount > owe) throw new Error(`Số tiền trả lớn hơn số còn nợ của khoản này (${owe}).`);
      const id = T.loan_pays.length + 1; T.loan_pays.push({ id, loan_id: p_loan, date: p_date, amount: p_amount, method: p_method, note: p_note || '' }); return id;
    },
    app_loan_pay_save({ p_id, p_date, p_amount, p_method, p_note }) {
      const y = T.loan_pays.find((x) => x.id === p_id); const l = T.branch_loans.find((x) => x.id === y.loan_id);
      const owe = l.amount - T.loan_pays.filter((z) => z.loan_id === l.id && z.id !== p_id).reduce((s, z) => s + z.amount, 0);
      if (!(p_amount > 0)) throw new Error('Nhập số tiền trả lớn hơn 0.'); if (p_amount > owe) throw new Error(`Số tiền trả lớn hơn số còn nợ của khoản này (${owe}).`);
      Object.assign(y, { date: p_date, amount: p_amount, method: p_method, note: p_note || '' }); return p_id;
    },
    app_loan_delete({ p_id }) { const l = T.branch_loans.find((x) => x.id === p_id); T.branch_loans = T.branch_loans.filter((x) => x.id !== p_id); if (l?.report_id) T.fin_move_cats = T.fin_move_cats.filter((z) => !(z.report_id === l.report_id && z.mkey === l.mkey)); },
    app_tc_to_loan({ p, p_person, p_note }) {
      T.branch_loans = T.branch_loans || []; const id = Math.max(0, ...T.branch_loans.map((l) => l.id)) + 1;
      if (p.src === 'tay') { const e = T.fin_entries.find((x) => x.id === p.id); if (e.kind !== 'chi') throw new Error('Chỉ khoản CHI mới đổi thành cho vay được.');
        T.branch_loans.push({ id, branch_id: e.branch_id, person_id: p_person, date: e.entry_date, amount: e.amount, method: e.pay_method, note: p_note || e.note, bank_out: !!e.bank_out }); T.fin_entries = T.fin_entries.filter((x) => x !== e); return id; }
      const row = tcRows(null, '2000-01-01', '2999-12-31').find((x) => x.src === 'ca' && x.report_id === p.report_id && x.mkey === p.mkey);
      T.branch_loans.push({ id, branch_id: row.branch_id, person_id: p_person, date: row.date, amount: row.amount, method: row.pay, note: p_note || row.note, report_id: p.report_id, mkey: p.mkey });
      tc.app_tc_check({ p_report: p.report_id, p_mkey: p.mkey, p_category: null, p_excluded: true, p_checked: true }); return id;
    },
    app_loan_pay_delete({ p_id }) { T.loan_pays = T.loan_pays.filter((y) => y.id !== p_id); },
    app_fin_types: () => ({ types: T.fin_cat_types, cats: T.fin_categories.map((c) => ({ id: c.id, kind: c.kind, name: c.name, type_id: c.type_id, sort_order: c.sort_order, active: !!c.active })), can_edit: admin() }),
    app_fin_type_save({ p_id, p_kind, p_name, p_sort, p_active }) {
      if (!admin()) throw new Error('Chỉ Chủ và Quản lý tổng sửa được loại thu chi.'); if (!(p_name || '').trim()) throw new Error('Nhập tên loại.');
      if (p_id) { Object.assign(T.fin_cat_types.find((t) => t.id === p_id), { name: p_name.trim(), active: !!p_active }); return p_id; }
      const id = Math.max(0, ...T.fin_cat_types.map((t) => t.id)) + 1; T.fin_cat_types.push({ id, kind: p_kind, name: p_name.trim(), sort_order: p_sort || 50, active: true }); return id;
    },
    app_fin_category_type_set({ p_cat, p_type }) { if (!admin()) throw new Error('Chỉ Chủ và Quản lý tổng sửa được loại thu chi.'); T.fin_categories.find((c) => c.id === p_cat).type_id = p_type; },
    app_fin_managers() { if (me.role !== 'chu') throw new Error('Chỉ Chủ giao cơ sở cho quản lý.'); return [{ account_id: 5, name: '5 – Quản lý thử', branches: T.fin_branch_managers.filter((m) => m.account_id === 5).map((m) => m.branch_id) }]; },
    app_fin_manager_set({ p_account, p_branches }) { T.fin_branch_managers = T.fin_branch_managers.filter((m) => m.account_id !== p_account).concat((p_branches || []).map((b) => ({ account_id: p_account, branch_id: b }))); },
    __fin_guard: guard,
  };
}
