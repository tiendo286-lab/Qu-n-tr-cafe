// Giả lập các hàm app_fund_* (Sổ quỹ) trong bộ nhớ — chỉ để chạy thử giao diện (chuyển khoản tự động luôn trống)
export function makeFund(T, me) {
  for (const t of ['fund_openings', 'fund_day_values', 'fund_withdrawals', 'fund_counts', 'fin_entries', 'fin_month_closes', 'daily_cash_closings']) T[t] = T[t] || [];
  const START = '2026-11-01'; const FLOAT = 1000000; const ALERT = 20000000;
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const today = () => now().slice(0, 10);
  const can = () => !!me.perms?.doi_soat || ['chu', 'ql_tong', 'ql'].includes(me.role);
  const need = () => { if (!can()) throw new Error('Bạn không được xem / sửa thu chi của cơ sở này.'); };
  const locked = (b, d) => T.fin_month_closes.some((c) => c.branch_id === b && c.month === String(d).slice(0, 7));
  const guard = (b, d) => { if (locked(b, d)) throw new Error('Tháng này đã CHỐT nên không sửa được.'); };
  const name = (aid) => (aid === me.account_id ? `${me.code} – ${me.name}` : 'TK ' + aid);
  const days = (a, b) => { const out = []; for (let d = new Date(a + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= b; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10)); return out; };
  const last = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };
  const rows = (b, from, to) => {
    const f = from > START ? from : START; const out = []; if (f > to) return out;
    days(f, to).forEach((d) => {
      const c = T.daily_cash_closings.find((x) => x.branch_id === b && x.work_date === d); const v = T.fund_day_values.find((x) => x.branch_id === b && x.work_date === d);
      const cash = v?.cash_amount ?? (c?.counted != null ? c.counted - FLOAT : null);
      if (cash) out.push({ date: d, method: 'tien_mat', type: 'nop_quy', label: v?.cash_amount != null ? 'Nộp quỹ cuối ngày (quản lý nhập)' : 'Nộp quỹ cuối ngày (tự động)', amount: cash, auto: v?.cash_amount == null, ref: { note: v?.cash_note } });
      if (v?.bank_amount) out.push({ date: d, method: 'chuyen_khoan', type: 'ck_ve', label: 'Chuyển khoản về (quản lý nhập)', amount: v.bank_amount, auto: false, ref: { note: v.bank_note } });
    });
    T.fin_entries.filter((e) => e.branch_id === b && e.entry_date >= f && e.entry_date <= to).forEach((e) => out.push({ date: e.entry_date, method: e.pay_method, type: 'thu_chi', label: (e.kind === 'chi' ? 'Chi: ' : 'Thu: ') + e.note, amount: e.kind === 'chi' ? -e.amount : e.amount, auto: false, ref: {} }));
    T.fund_withdrawals.filter((w) => w.branch_id === b && w.wdate >= f && w.wdate <= to).forEach((w) => out.push({ date: w.wdate, method: w.method, type: 'rut', label: (w.kind === 'cuoi_thang' ? 'Rút cuối tháng' : 'Rút giữ hộ') + (w.status === 'da_nhan' ? ' · Chủ đã nhận' : ' · chờ Chủ xác nhận'), amount: -w.amount, auto: false, ref: {} }));
    return out.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  };
  const opening = (b, m) => Number(T.fund_openings.find((o) => o.branch_id === b && o.method === m)?.amount || 0);
  const balance = (b, m, upto) => opening(b, m) + rows(b, START, upto).filter((r) => r.method === m).reduce((s, r) => s + r.amount, 0);
  const brs = () => T.branches.filter((b) => b.status === 'Đang hoạt động' && can()).sort((a, c) => a.sort_order - c.sort_order);
  return {
    app_fund_overview({ p_month }) {
      const d0 = p_month + '-01'; const d1 = last(p_month); const upto = d1 < today() ? d1 : today();
      const outs = (b, m) => T.fund_withdrawals.filter((w) => w.branch_id === b && w.method === m && w.wdate >= d0 && w.wdate <= d1).reduce((s, w) => s + w.amount, 0);
      return { month: p_month, start: START, alert: ALERT, owner: me.role === 'chu',
        branches: brs().map((b) => ({ id: b.id, code: b.display_code || b.code, name: b.name, cash: balance(b.id, 'tien_mat', upto), bank: balance(b.id, 'chuyen_khoan', upto), bank_actual: { amount: null },
          out_cash: outs(b.id, 'tien_mat'), out_bank: outs(b.id, 'chuyen_khoan'), pending: T.fund_withdrawals.filter((w) => w.branch_id === b.id && w.status === 'cho_nhan').length, closed: locked(b.id, d0) })) };
    },
    app_fund_branch({ p_branch, p_month }) {
      need(); const b = T.branches.find((x) => x.id === p_branch);
      const d0 = p_month + '-01'; const d1 = last(p_month); const upto = d1 < today() ? d1 : today(); const prev = days(d0, d0)[0];
      const before = new Date(Date.parse(prev + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
      const isStart = START.slice(0, 7) === p_month;
      return { branch_id: b.id, code: b.display_code || b.code, name: b.name, month: p_month, from: d0, to: d1, upto, start: START, float: FLOAT, alert: ALERT, is_start_month: isStart,
        openings: { tien_mat: T.fund_openings.find((o) => o.branch_id === b.id && o.method === 'tien_mat') || null, chuyen_khoan: T.fund_openings.find((o) => o.branch_id === b.id && o.method === 'chuyen_khoan') || null },
        open: { tien_mat: isStart ? opening(b.id, 'tien_mat') : balance(b.id, 'tien_mat', before), chuyen_khoan: isStart ? opening(b.id, 'chuyen_khoan') : balance(b.id, 'chuyen_khoan', before) },
        balance: { tien_mat: balance(b.id, 'tien_mat', upto), chuyen_khoan: balance(b.id, 'chuyen_khoan', upto) }, bank_actual: { amount: null },
        rows: rows(b.id, d0, d1),
        days: days(d0 > START ? d0 : START, upto).map((d) => { const c = T.daily_cash_closings.find((x) => x.branch_id === b.id && x.work_date === d); const v = T.fund_day_values.find((x) => x.branch_id === b.id && x.work_date === d);
          return { date: d, counted: c?.counted ?? null, cash_auto: c?.counted != null ? c.counted - FLOAT : null, cash_set: v?.cash_amount ?? null, cash_note: v?.cash_note ?? null, bank_auto: null, bank_set: v?.bank_amount ?? null, bank_note: v?.bank_note ?? null,
            reports: (T.shift_reports || []).filter((r) => r.branch_id === b.id && r.work_date === d && r.status === 'hoan_thanh').length }; }),
        withdrawals: T.fund_withdrawals.filter((w) => w.branch_id === b.id && ((w.wdate >= d0 && w.wdate <= d1) || w.status === 'cho_nhan')).map((w) => ({ ...w, by: name(w.created_by), locked: w.status === 'da_nhan' || locked(w.branch_id, w.wdate) })).sort((x, y) => (x.wdate < y.wdate ? 1 : -1)),
        counts: T.fund_counts.filter((c) => c.branch_id === b.id && c.count_date >= d0 && c.count_date <= d1).map((c) => ({ ...c, by: name(c.created_by) })),
        locked: locked(b.id, d0), owner: me.role === 'chu' };
    },
    app_fund_balance({ p_branch, p_method, p_date }) { need(); return balance(p_branch, p_method, p_date); },
    app_fund_day_set({ p_branch, p_date, p_method, p_amount, p_note }) {
      need(); guard(p_branch, p_date); if (p_date > today()) throw new Error('Không nhập trước cho ngày chưa tới.');
      let v = T.fund_day_values.find((x) => x.branch_id === p_branch && x.work_date === p_date); if (!v) { v = { branch_id: p_branch, work_date: p_date }; T.fund_day_values.push(v); }
      if (p_method === 'tien_mat') { v.cash_amount = p_amount; v.cash_note = p_note || null; } else { v.bank_amount = p_amount; v.bank_note = p_note || null; }
    },
    app_fund_opening_set({ p_branch, p_method, p_amount, p_note }) {
      need(); T.fund_openings = T.fund_openings.filter((o) => !(o.branch_id === p_branch && o.method === p_method)).concat([{ branch_id: p_branch, method: p_method, amount: p_amount, note: p_note || null }]);
    },
    app_fund_withdraw_save({ p_id, p }) {
      need(); const old = p_id ? T.fund_withdrawals.find((w) => w.id === p_id) : null;
      if (old?.status === 'da_nhan') throw new Error('Chủ đã xác nhận nhận tiền nên phiếu này không sửa được nữa.');
      const b = old ? old.branch_id : Number(p.branch_id); guard(b, p.wdate);
      if (!(p.amount > 0)) throw new Error('Nhập số tiền rút lớn hơn 0.'); if (!p.wdate) throw new Error('Chọn ngày rút.'); if (p.wdate > today()) throw new Error('Không tạo phiếu rút cho ngày chưa tới.');
      const row = { branch_id: b, method: p.method, kind: p.kind || 'giua_thang', wdate: p.wdate, amount: p.amount, note: (p.note || '').trim() };
      if (old) { Object.assign(old, row); return old.id; }
      const id = Math.max(0, ...T.fund_withdrawals.map((w) => w.id)) + 1; T.fund_withdrawals.push({ id, ...row, status: 'cho_nhan', created_by: me.account_id, created_at: now() }); return id;
    },
    app_fund_withdraw_delete({ p_id }) { need(); const w = T.fund_withdrawals.find((x) => x.id === p_id); if (w?.status === 'da_nhan') throw new Error('Chủ đã xác nhận nhận tiền nên phiếu này không xóa được.'); T.fund_withdrawals = T.fund_withdrawals.filter((x) => x !== w); },
    app_fund_withdraw_confirm({ p_id }) {
      if (me.role !== 'chu') throw new Error('Chỉ Chủ xác nhận đã nhận tiền.'); const w = T.fund_withdrawals.find((x) => x.id === p_id);
      if (w.status === 'da_nhan') throw new Error('Phiếu này đã xác nhận rồi.'); Object.assign(w, { status: 'da_nhan', received_by: me.account_id, received_at: now() });
    },
    app_fund_count_save({ p_branch, p_method, p_date, p_counted, p_note }) {
      need(); if (p_counted == null) throw new Error('Nhập số tiền thực tế.'); const bk = balance(p_branch, p_method, p_date);
      if (bk !== p_counted && !(p_note || '').trim()) throw new Error(`Lệch ${p_counted - bk}đ so với sổ — ghi lý do.`);
      T.fund_counts.push({ id: T.fund_counts.length + 1, branch_id: p_branch, method: p_method, count_date: p_date, counted: p_counted, book: bk, note: p_note || null, created_by: me.account_id, created_at: now() });
      return { book: bk, diff: p_counted - bk };
    },
  };
}
