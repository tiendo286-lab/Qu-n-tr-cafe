// Bước 119 · KIỂM TRA: ô "CHUYỂN KHOẢN NGÂN HÀNG" ở bước Kiểm tra dùng Phải nhận = CK Fabi + Thu CK (máy chủ ck_expected),
// không chỉ CK Fabi. Ca: CK Fabi 2.400.000 + Thu CK 50.000 → phải nhận 2.450.000; ngân hàng nhận 2.450.000 → KHỚP. role=chu, confirm=1
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s);
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  window.confirm = () => true;
  let fail = null; let seen = '';
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const o = ov[0];
    const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: id });
    const e = (await rpc('app_ca_employees'))[0];
    const staff = (R.staff || []).length ? R.staff.map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) : [{ employee_id: e.id, source: 'ho_tro', worked: true, time_in: '06:45', time_out: '12:39' }];
    await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 2450000, total_revenue: 6900000, pos_cash: 4500000, pos_transfer: 2400000,
      cash_counted: 5500000, ipos_opening: 1000000, opening_cash: 1000000, pos_debt: 0, pos_diff: 0, cups: 50,
      moves: [{ kind: 'chuyen_khoan', amount: 50000, note: 'Thu CK' }], goods: [], handover: [], debts: [], staff } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    const acc = await rpc('app_kt_account_save', { p_id: null, p_branch: o.branch_id, p_bank: 'VCB', p_no: '1234567890', p_holder: 'Chủ', p_label: null, p_active: true });
    await rpc('app_kt_bank_save_accounts', { p_report: id, p_rows: [{ account_id: acc, opening: 1000000, closing: 3450000, transfers_out: 0, note: null }] });
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca/phieu?id=' + id + '&__ds=1'; await wait('.ds-pane'); await sleep(2500);
    seen = ($('#bank-box')?.innerText || '').replace(/\s+/g, ' ').trim();
    if (!/Phải nhận\s*2\.450\.000/.test(seen)) fail = 'Phải nhận không phải 2.450.000';
    else if (!/KHỚP/.test(seen)) fail = 'Không báo KHỚP';
  } catch (er) { fail = er.message; }
  out.push({ route: 'audit_ck_box', title: seen.slice(0, 160), errs: fail ? [fail] : [] });
};
