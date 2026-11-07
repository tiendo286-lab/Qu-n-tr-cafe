// Giả lập các hàm app_fin_* (Chốt tháng) trong bộ nhớ — chỉ để chạy thử giao diện (lấy số từ phiếu ca giả, không qua bản đối soát)
export function makeFin(T, me) {
  for (const t of ['fin_entries', 'fin_move_cats', 'fin_month_closes', 'fin_close_log', 'fin_branch_managers']) T[t] = T[t] || [];
  T.fin_categories = T.fin_categories || [['chi', 'Nguyên liệu'], ['chi', 'Lương'], ['chi', 'Mặt bằng'], ['chi', 'Điện nước'], ['chi', 'Sửa chữa & thiết bị'], ['chi', 'Marketing'], ['chi', 'Vật dụng'], ['chi', 'Khác'], ['thu', 'Thu khác']]
    .map(([kind, name], i) => ({ id: i + 1, kind, name, sort_order: i, active: 1 }));
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
  return {
    app_fin_branches: () => ({ admin: admin(), owner: me.role === 'chu', branches: T.branches.filter((b) => b.status === 'Đang hoạt động' && canB(b.id)).sort((a, c) => a.sort_order - c.sort_order).map((b) => ({ id: b.id, code: b.display_code || b.code, name: b.name })) }),
    app_fin_month({ p_branch, p_month }) { need(p_branch); return { ...calc(p_branch, p_month), categories: T.fin_categories, log: T.fin_close_log.filter((l) => l.branch_id === p_branch && l.month === p_month).slice().reverse(), can_reopen: me.role === 'chu' }; },
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
      const id = nid('fin_categories'); T.fin_categories.push({ id, kind: p_kind, name: p_name.trim(), sort_order: p_sort || 50, active: 1 }); return id;
    },
    app_fin_managers() { if (me.role !== 'chu') throw new Error('Chỉ Chủ giao cơ sở cho quản lý.'); return [{ account_id: 5, name: '5 – Quản lý thử', branches: T.fin_branch_managers.filter((m) => m.account_id === 5).map((m) => m.branch_id) }]; },
    app_fin_manager_set({ p_account, p_branches }) { T.fin_branch_managers = T.fin_branch_managers.filter((m) => m.account_id !== p_account).concat((p_branches || []).map((b) => ({ account_id: p_account, branch_id: b }))); },
    __fin_guard: guard,
  };
}
