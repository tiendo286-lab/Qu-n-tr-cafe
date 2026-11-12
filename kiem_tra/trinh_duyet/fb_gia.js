// Giả lập bước 42: kế toán tải file chi tiết ca Fabi (app_fabi_*) — chỉ để chạy thử giao diện
export function makeFb(T, me) {
  T.fabi_shifts = T.fabi_shifts || [];
  const STORES = { 'milano coffee - lê hồng phong': 'LHP', 'milano coffee - đông khê': 'ĐK', 'milano coffee - hồ sen': 'HS', 'lela cafe': 'LL' };
  const ts = (p) => (/^\d{2}\/\d{2}\/\d{4}/.test(p || '') ? `${p.slice(6, 10)}-${p.slice(3, 5)}-${p.slice(0, 2)} ${p.slice(11, 16)}`.trim() : null);
  const shiftOf = (op) => { const h = Number(op.slice(11, 13)); return h < 11 ? 'Sáng' : h < 16 ? 'Chiều' : 'Tối'; };
  const sumPay = (pay, f) => pay.filter((p) => f(p.name.toLowerCase().trim())).reduce((s, p) => s + p.amount, 0);
  const apply = (f) => {
    const b = T.branches.find((x) => x.code === f.code); f.branch_id = b?.id || null;
    if (!b) return { status: 'chua_ro_co_so' };
    const r = T.shift_reports.find((x) => x.branch_id === b.id && x.work_date === f.work_date && x.shift === f.shift);
    f.report_id = r?.id || null; f.diff = []; f.fixed = f.fixed || [];
    if (!r) return { status: 'chua_phieu' };
    if (r.status !== 'hoan_thanh') return { status: 'dang_chot', report_id: r.id };
    const pairs = [['ipos_opening', 'Số dư đầu', f.dau], ['total_revenue', 'Doanh thu NET', f.net], ['pos_transfer', 'Chuyển khoản', f.ck], ['pos_cash', 'Tiền mặt', f.tm], ['pos_debt', 'Nợ', f.no], ['cash_counted', 'Tổng tiền', f.tong], ['pos_diff', 'Tiền chênh lệch', f.tong - f.cuoi]];
    f.diff = pairs.filter(([k, , v]) => v != null && r[k] !== v).map(([k, l, v]) => ({ field: k, label: l, nv: r[k], fabi: v }));
    if (f.diff.length && r.recon_status === 'hoan_thanh') r.recon_status = 'mo_lai';
    return { status: f.diff.length ? 'lech' : 'khop', report_id: r.id, diff: f.diff, fixed: [] };
  };
  return {
    app_fabi_upload({ p_rows }) {
      if (!me.perms.ke_toan && me.role !== 'chu') throw new Error('Bạn không có quyền thực hiện thao tác này.');
      return p_rows.map((x) => {
        const op = ts(x.open);
        const f = { ma_ca: x.ma_ca, store: x.store, code: STORES[x.store.toLowerCase()] || null, work_date: op.slice(0, 10), shift: shiftOf(op), open_at: op, close_at: ts(x.close),
          dau: x.dau, cuoi: x.cuoi, net: x.net, hd: x.hd, tong: x.tong, tra_no: x.tra_no || [], sua: x.sua || [],
          ck: sumPay(x.pay, (n) => n.includes('chuyển khoản')), tm: sumPay(x.pay, (n) => n === 'tiền mặt'), no: sumPay(x.pay, (n) => n === 'nợ'), uploaded_at: '2026-11-12 10:00' };
        T.fabi_shifts = T.fabi_shifts.filter((y) => y.ma_ca !== f.ma_ca).concat(f);
        return { ma_ca: f.ma_ca, store: f.store, branch_code: f.code, work_date: f.work_date, shift: f.shift, ...apply(f) };
      });
    },
    app_fabi_list({ p_from, p_to }) {
      const files = T.fabi_shifts.filter((f) => f.work_date >= p_from && f.work_date <= p_to).map((f) => {
        const r = T.shift_reports.find((x) => x.id === f.report_id);
        return { ...f, branch_code: f.code, chenh: f.tong - f.cuoi, report_status: r?.status || null, uploaded_by: 'Chủ' };
      });
      const missing = T.shift_reports.filter((r) => r.work_date >= p_from && r.work_date <= p_to && !/full/i.test(r.shift) && !T.fabi_shifts.some((f) => f.branch_id === r.branch_id && f.work_date === r.work_date && f.shift === r.shift))
        .map((r) => ({ report_id: r.id, branch_code: (T.branches.find((b) => b.id === r.branch_id) || {}).code, work_date: r.work_date, shift: r.shift, status: r.status }));
      return { files, missing };
    },
    app_fabi_for_report({ p_id }) {
      const r = T.shift_reports.find((x) => x.id === p_id);
      const f = T.fabi_shifts.find((x) => x.branch_id === r.branch_id && x.work_date === r.work_date && x.shift === r.shift);
      return f ? { ...f, chenh: f.tong - f.cuoi, other: 0, pay: [] } : null;
    },
  };
}
