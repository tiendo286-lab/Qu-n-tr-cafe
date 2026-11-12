// Bước 57: trang Đối soát ca — khung "Tiền của ca" (3 dòng so khớp + thu chi; số liệu chi tiết thu vào "Xem / sửa số liệu"). role=chu (confirm=1)
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => { const w = document.documentElement.clientWidth; const wide = $$('#root *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > w + 1 && !el.closest('.table-wrap')).map((el) => el.tagName + '.' + el.className).slice(0, 3); return `rộng ${w}/${document.documentElement.scrollWidth}${wide.length ? ' tràn: ' + wide.join(',') : ''}`; };
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
    await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 2000000, transfer_note: 'trả tiền hàng', total_revenue: 5000000, pos_cash: 2000000, pos_transfer: 3000000,
      cash_counted: 2950000, ipos_opening: 1000000, pos_debt: 0, pos_diff: -50000, diff_note: 'mua đá', cups: 50, moves: [{ kind: 'tien_mat', amount: -50000, note: 'mua đá' }], goods: [], handover: [], debts: [],
      staff: (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) } }).catch((e) => r.push('lưu: ' + e.message));
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true }).catch((e) => r.push('xong: ' + e.message));
    const acc = await rpc('app_kt_account_save', { p_id: null, p_branch: o.branch_id, p_bank: 'VCB', p_no: '1234567890', p_holder: 'Chủ', p_label: null, p_active: true });
    await rpc('app_kt_bank_save_accounts', { p_report: id, p_rows: [{ account_id: acc, opening: 1000000, closing: 3000000, transfers_out: 0, note: null }] });
    const [y, mo, d] = day.split('-');
    await rpc('app_fabi_upload', { p_rows: [{ ma_ca: 'CA57', store: 'Milano Coffee - Lê Hồng Phong', open: `${d}/${mo}/${y} 06:55`, close: `${d}/${mo}/${y} 12:39`, dau: 1000000, cuoi: 3000000, net: 5000000, hd: 50, tong: 2950000,
      pay: [{ name: 'CHUYỂN KHOẢN', amount: 3000000 }, { name: 'Tiền mặt', amount: 2000000 }], tra_no: [], sua: [] }] });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat/ca?id=' + id + '&buoc=2'; await wait('#ca-box .ca-row'); await sleep(1500);
    r.push(`Khung: ${txt('.ca-sec .pc-sec-head')} · ${txt('.ca-time')}`);
    r.push(`Dòng: ${$$('#ca-box .ca-row').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ')}`);
    r.push(`Thu chi trong khung: ${!!$('.ca-sec #ds-tc')} · còn mục "Phân nhóm" riêng: ${$$('.pc-sec h2').some((h) => /Phân nhóm thu chi/.test(h.innerText))} · "Xem / sửa số liệu" đóng: ${!$('#ca-more').open} · ${W()}`);
    $$('[data-ca="more"]')[0]?.click() || $('#ca-more').setAttribute('open', '');
    await sleep(500);
    r.push(`Mở "Xem / sửa số liệu": ${$('#ca-more').open} · có ô Tổng doanh thu ${!!$('#ca-more #total_revenue')} · ảnh iPOS ${!!$('#ca-more .photos')} · ${W()}`);
    $('[data-ca="pc"]')?.click(); await wait('dialog[open]', 100); await sleep(300);
    r.push(`Nút Tạo phiếu chi → ${txt('dialog[open] h2')} · gợi ý ${$('dialog[open] [name=amt]')?.value}`); $('dialog[open]')?.close();
    $('[data-ca="res"][data-item="tien_mat"]')?.click(); await wait('dialog[open]', 100); await sleep(300);
    r.push(`Nút Chọn kết quả Tiền mặt → ${txt('dialog[open] h2')}`); $('dialog[open]')?.close();
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'tiền của ca', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
