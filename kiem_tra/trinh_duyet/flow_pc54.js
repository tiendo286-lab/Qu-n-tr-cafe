// Bước 54: chuyển khoản lệch → tạo phiếu chi ngay ở trang Đối soát ca (role=chu, confirm=1, điện thoại)
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const typ = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
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
    // CK theo Fabi 3.000.000 nhưng tài khoản chỉ nhận thêm 2.000.000 (đã chuyển đi 1.000.000 trả tiền hàng)
    await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 2000000, transfer_note: 'đã chuyển trả tiền hàng', total_revenue: 5000000, pos_cash: 2000000, pos_transfer: 3000000,
      cash_counted: 3000000, ipos_opening: 1000000, pos_debt: 0, pos_diff: 0, cups: 50, moves: [], goods: [], handover: [], debts: [],
      staff: (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) } }).catch((e) => r.push('lưu phiếu: ' + e.message));
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true }).catch((e) => r.push('xong phần: ' + e.message));
    const acc = await rpc('app_kt_account_save', { p_id: null, p_branch: o.branch_id, p_bank: 'VCB', p_no: '1234567890', p_holder: 'Chủ', p_label: null, p_active: true });
    await rpc('app_kt_bank_save_accounts', { p_report: id, p_rows: [{ account_id: acc, opening: 1000000, closing: 3000000, transfers_out: 0, note: null }] });
    const [y, mo, d] = day.split('-');
    await rpc('app_fabi_upload', { p_rows: [{ ma_ca: 'PC54', store: 'Milano Coffee - Lê Hồng Phong', open: `${d}/${mo}/${y} 06:55`, close: `${d}/${mo}/${y} 12:39`, dau: 1000000, cuoi: 3000000, net: 5000000, hd: 50, tong: 3000000,
      pay: [{ name: 'CHUYỂN KHOẢN', amount: 3000000 }, { name: 'Tiền mặt', amount: 2000000 }], tra_no: [], sua: [] }] });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat/ca?id=' + id; await wait('.den-row'); await sleep(1500);
    r.push(`Đèn CK: ${$$('.den-row').filter((x) => /Chuyển khoản/.test(x.innerText)).map((x) => x.innerText.replace(/\s+/g, ' ')).join('')} · ${W()}`);
    r.push(`Khung phiếu chi: ${txt('#bank-outs')}`);
    ($('.den-pc') || $('.pcc-add')).click(); await wait('dialog[open] form'); await sleep(300);
    const dl = $('dialog[open]');
    r.push(`Hộp: ${dl.querySelector('.diff-card')?.innerText.replace(/\s+/g, ' ')} · số tiền gợi ý ${dl.querySelector('[name=amt]').value} · nhóm chi hiện ${!dl.querySelector('.pcc-cat').hidden}`);
    dl.querySelector('[name=kind][value=rut_quy]').click(); dl.querySelector('form').dispatchEvent(new Event('change')); await sleep(100);
    r.push(`Chọn rút tiền: nhóm chi ẩn ${dl.querySelector('.pcc-cat').hidden} · ${dl.querySelector('.pcc-hint').innerText}`);
    dl.querySelector('[name=kind][value=chi_phi]').click(); dl.querySelector('form').dispatchEvent(new Event('change'));
    typ(dl.querySelector('[name=note]'), 'trả tiền hàng');
    dl.querySelector('[type=submit]').click(); await sleep(800);
    r.push(`Lưu thiếu nhóm: ${dl.querySelector('.pcc-err')?.innerText || 'không báo'}`);
    dl.querySelector('[name=cat]').value = '901';
    dl.querySelector('[type=submit]').click(); for (let i = 0; i < 100 && $('dialog[open]'); i++) await sleep(100); await sleep(2000); await wait('#bank-outs .pcc-row');
    r.push(`Sau lưu: ${txt('#bank-outs')} · ngân hàng: ${txt('#bank-box').slice(0, 200)} · ${W()}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'phiếu chi chuyển khoản', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
