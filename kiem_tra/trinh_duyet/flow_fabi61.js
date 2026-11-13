// Bước 61: luật đối soát theo file Fabi — hóa đơn sửa / xóa → Doanh thu đỏ "Đã xem — duyệt"; khách trả nợ trên Fabi lệch phiếu → Công nợ đỏ.
// role=chu (confirm=1, điện thoại)
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const row = (lbl) => $$('.den-row').find((x) => x.querySelector('strong').innerText.includes(lbl));
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
    await rpc('app_kt_bank_save_accounts', { p_report: id, p_rows: [{ account_id: acc, opening: 1000000, closing: 4000000, transfers_out: 0, note: null }] });
    const [y, mo, d] = day.split('-');
    // file Fabi: 2 hóa đơn sửa + khách trả nợ 50.000 tiền mặt (phiếu không ghi khách nào trả nợ)
    await rpc('app_fabi_upload', { p_rows: [{ ma_ca: 'F61', store: 'Milano Coffee - Lê Hồng Phong', open: `${d}/${mo}/${y} 06:55`, close: `${d}/${mo}/${y} 12:39`, dau: 1000000, cuoi: 3000000, net: 5000000, hd: 50, tong: 3000000,
      pay: [{ name: 'CHUYỂN KHOẢN', amount: 3000000 }, { name: 'Tiền mặt', amount: 2000000 }], tra_no: [{ method: 'Tiền mặt', amount: 50000 }], sua: [{ id: '#EDT_1 - EDIT', amount: 28000 }, { id: '#EDT_2 - EDIT', amount: 35000 }] }] });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat/ca?id=' + id; await wait('.den-row'); await sleep(1500);
    r.push(`Doanh thu: ${row('Doanh thu')?.innerText.replace(/\s+/g, ' ')}`);
    r.push(`Công nợ: ${row('Công nợ')?.innerText.replace(/\s+/g, ' ')}`);
    r.push(`nút "Đã xem — duyệt": ${$$('.den-man').map((b) => b.dataset.item).join(', ')} · ${W()}`);
    $$('.den-man').find((b) => b.dataset.item === 'doanh_thu')?.click();
    for (let i = 0; i < 50 && !row('Doanh thu')?.classList.contains('done'); i++) await sleep(100); await sleep(800); await wait('.den-row');
    r.push(`Sau duyệt Doanh thu: ${row('Doanh thu')?.className} · ${row('Doanh thu')?.innerText.replace(/\s+/g, ' ')}`);
    $$('.den-man').find((b) => b.dataset.item === 'cong_no')?.click();
    for (let i = 0; i < 50 && !row('Công nợ')?.classList.contains('done'); i++) await sleep(100); await sleep(800); await wait('.den-row');
    r.push(`Sau duyệt Công nợ: ${row('Công nợ')?.className}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'luật Fabi bước 61', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
