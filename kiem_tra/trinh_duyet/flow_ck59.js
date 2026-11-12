// Kế toán › Chuyển khoản thực nhận — Bảng tuần (role=chu, confirm=1, điện thoại)
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => { const w = document.documentElement.clientWidth; const wide = $$('#root *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > w + 1 && !el.closest('.table-wrap, .hub-tabs')).map((el) => el.tagName + '.' + el.className + '[' + el.innerText.slice(0, 20) + '|' + Math.round(el.getBoundingClientRect().right) + '|' + (el.parentElement?.className || '') + ']').slice(0, 3); return `rộng ${w}/${document.documentElement.scrollWidth}${wide.length ? ' tràn: ' + wide.join(',') : ''}`; };
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const o = ov.find((x) => x.branch_code === 'LHP' && x.shift === 'Sáng') || ov[0];
    const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: id });
    await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 3000000, total_revenue: 5000000, pos_cash: 2000000, pos_transfer: 3000000,
      cash_counted: 3000000, ipos_opening: 1000000, pos_debt: 0, pos_diff: 0, cups: 50, moves: [], goods: [], handover: [], debts: [],
      staff: (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    const acc = await rpc('app_kt_account_save', { p_id: null, p_branch: o.branch_id, p_bank: 'VCB', p_no: '1234567890', p_holder: 'Chủ', p_label: null, p_active: true });
    await rpc('app_kt_bank_save_accounts', { p_report: id, p_rows: [{ account_id: acc, opening: 1000000, closing: 3935000, transfers_out: 0, note: null }] });   // nhận 2.935.000, lệch −65.000
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ke-toan/chuyen-khoan?ngay=' + day; await wait('.ck-view'); await sleep(800);
    r.push(`Trang ngày: nút ${txt('.ck-view')} · ${W()}`);
    $$('.ck-view a')[1].click(); await wait('table.ck-w'); await sleep(1200);
    r.push(`Bảng tuần: ${txt('.toolbar strong')} · ${$$('table.ck-w').length} bảng · ${txt('.ck-w-legend')}`);
    const t = $$('table.ck-w').find((x) => x.closest('section').querySelector('h2').innerText.startsWith(o.branch_code));
    r.push(`${o.branch_code}: ${txt('.ck-w-h')}`);
    r.push(`Hàng: ${[...t.querySelectorAll('tbody tr')].map((tr) => tr.innerText.replace(/\s+/g, ' ').slice(0, 140)).join(' | ')}`);
    r.push(`${W()}`);
    const a = t.querySelector('td.ok a, td.bad a'); r.push(`bấm ô → ${a?.getAttribute('href')}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'bảng tuần chuyển khoản', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
