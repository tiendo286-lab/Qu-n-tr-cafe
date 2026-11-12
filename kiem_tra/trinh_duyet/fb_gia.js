// Giả lập bước 42: kế toán tải file chi tiết ca Fabi (app_fabi_*) — chỉ để chạy thử giao diện
export function makeFb(T, me) {
  T.fabi_shifts = T.fabi_shifts || []; T.fabi_menu = T.fabi_menu || {};   // bước 49: nhóm món (tên món → nhóm)
  const cupGrp = (g) => !/(ĐỒ ĂN|THUỐC|TOPPING)/i.test(g || '');
  const cups = (f) => {
    const unk = [...new Set((f.items || []).filter((x) => !T.fabi_menu[x.name]).map((x) => x.name))];
    f.cups_unknown = unk; f.cups = unk.length || !(f.items || []).length ? null : f.items.filter((x) => cupGrp(T.fabi_menu[x.name])).reduce((s, x) => s + x.qty, 0);
    const r = T.shift_reports.find((x) => x.id === f.report_id); if (r && r.status === 'hoan_thanh' && f.cups !== null) r.cups = f.cups;
  };
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
  // bước 44: phần tiền chờ kế toán = cơ sở dùng Fabi mà thiếu file Fabi hoặc thiếu số dư ngân hàng
  const ktState = (id) => {
    const r = T.shift_reports.find((x) => x.id === id); if (!r) return null;
    const b = T.branches.find((x) => x.id === r.branch_id) || {};
    const need = Object.values(STORES).includes(b.code);
    const fabi = T.fabi_shifts.some((f) => f.report_id === id || (f.branch_id === r.branch_id && f.work_date === r.work_date && f.shift === r.shift));
    const bj = T.__bankJson ? T.__bankJson(id) : { account_count: 0, entered: 0 };
    const bank = bj.account_count > 0 && bj.entered >= bj.account_count;
    const missing = need ? [...(fabi ? [] : ['file chốt ca Fabi']), ...(bank ? [] : [bj.account_count ? `chuyển khoản ngân hàng (${bj.entered}/${bj.account_count} tài khoản)` : 'chi nhánh chưa khai báo tài khoản ngân hàng'])] : [];
    return { need, fabi, bank, bank_in: bj.entered, bank_accounts: bj.account_count, ready: !need || (fabi && bank), missing };
  };
  T.__ktState = ktState;
  // bước 51: mục web tự đối soát (khoá). Trình duyệt thử không tự xét như máy chủ — bài thử gọi app__test_auto_lock để giả lập.
  const LKF = { thoi_gian: ['rev_start', 'rev_end'], doanh_thu: ['total_revenue', 'pos_cash', 'pos_transfer', 'cups', 'opening_cash'], tien_mat: ['cash_counted', 'opening_cash', 'pos_cash', 'moves'],
    chuyen_khoan: ['reported_transfer', 'pos_transfer', 'moves'], thu_chi: ['moves'], nhan_su: ['staff'], nhap_hang: ['goods_status', 'goods_note', 'goods'] };
  T.__autoLock = T.__autoLock || {};
  return {
    app_ca_auto_locks({ p_id }) { const it = T.__autoLock[p_id] || []; const done = T.shift_report_checks.filter((c) => c.report_id === p_id).map((c) => c.item); return { items: it, fields: [...new Set(done.flatMap((i) => LKF[i] || []))], done, can_unlock: me.role === 'chu', is_chu: me.role === 'chu' }; },
    app_ca_auto_unlock({ p_id, p_item, p_reason }) {
      if (me.role !== 'chu') throw new Error('Chỉ Chủ mở khoá mục web đã tự đối soát.');
      if (!(p_reason || '').trim()) throw new Error('Ghi lý do mở khoá.');
      T.__autoLock[p_id] = (T.__autoLock[p_id] || []).filter((x) => x !== p_item);
      T.shift_report_checks = T.shift_report_checks.filter((c) => !(c.report_id === p_id && c.item === p_item));
    },
    app__test_auto_lock({ p_id, p_items }) {
      T.__autoLock[p_id] = p_items;
      p_items.forEach((it) => { if (!T.shift_report_checks.some((c) => c.report_id === p_id && c.item === it)) T.shift_report_checks.push({ report_id: p_id, item: it, checked_by: null, checked_at: '2026-11-12 10:00' }); });
    },
    app_ca_kt_state: ({ p_id }) => ktState(p_id),
    app_ca_kt_wait() {
      return T.shift_reports.filter((r) => r.recon_status !== 'hoan_thanh' && !/full/i.test(r.shift)).map((r) => ({ r, k: ktState(r.id) })).filter(({ k }) => k && k.need && !k.ready)
        .map(({ r, k }) => { const b = T.branches.find((x) => x.id === r.branch_id) || {};
          return { id: r.id, branch_id: r.branch_id, branch: b.display_code || b.code, date: r.work_date, shift: r.shift, status: r.status, recon_status: r.recon_status, fabi: k.fabi, bank: k.bank, missing: k.missing }; });
    },
    app_fabi_upload({ p_rows }) {
      if (!me.perms.ke_toan && me.role !== 'chu') throw new Error('Bạn không có quyền thực hiện thao tác này.');
      return p_rows.map((x) => {
        const op = ts(x.open);
        const f = { ma_ca: x.ma_ca, store: x.store, code: STORES[x.store.toLowerCase()] || null, work_date: op.slice(0, 10), shift: shiftOf(op), open_at: op, close_at: ts(x.close),
          dau: x.dau, cuoi: x.cuoi, net: x.net, hd: x.hd, tong: x.tong, tra_no: x.tra_no || [], sua: x.sua || [],
          items: x.items || [], groups: x.groups || [], ck: sumPay(x.pay, (n) => n.includes('chuyển khoản')), tm: sumPay(x.pay, (n) => n === 'tiền mặt'), no: sumPay(x.pay, (n) => n === 'nợ'), uploaded_at: '2026-11-12 10:00' };
        T.fabi_shifts = T.fabi_shifts.filter((y) => y.ma_ca !== f.ma_ca).concat(f);
        const res = apply(f); cups(f);
        return { ma_ca: f.ma_ca, store: f.store, branch_code: f.code, work_date: f.work_date, shift: f.shift, cups: f.cups, cups_unknown: f.cups_unknown, ...res };
      });
    },
    app_fabi_menu() {
      const by = {}; T.fabi_shifts.forEach((f) => (f.items || []).forEach((x) => { const o = (by[x.name] ||= { name: x.name, files: 0, qty: 0 }); o.files += 1; o.qty += x.qty; }));
      const groups = [...new Set([...T.fabi_shifts.flatMap((f) => (f.groups || []).map((g) => g.name)), ...Object.values(T.fabi_menu)])].sort();
      return { groups, items: Object.values(by).map((o) => ({ ...o, grp: T.fabi_menu[o.name] || null, cup: !!T.fabi_menu[o.name] && cupGrp(T.fabi_menu[o.name]) })) };
    },
    app_fabi_menu_set({ p_items }) { p_items.forEach((x) => { if (x.grp) T.fabi_menu[x.name] = x.grp; else delete T.fabi_menu[x.name]; }); T.fabi_shifts.forEach(cups); return p_items.length; },
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
