// Bước 56: đối soát — sửa từng mục. Ca khớp hết → duyệt → hoàn thành; bấm "Sửa" mục Bàn giao → chỉ mục đó mở, các mục khác nhạt + khoá;
// duyệt lại → phiếu tự hoàn thành. role=chu (confirm=1, điện thoại)
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
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
    await rpc('app_kt_bank_save_accounts', { p_report: id, p_rows: [{ account_id: acc, opening: 1000, closing: 3001000, transfers_out: 0, note: null }] });
    const [y, mo, d] = day.split('-');
    await rpc('app_fabi_upload', { p_rows: [{ ma_ca: 'SUA56', store: 'Milano Coffee - Lê Hồng Phong', open: `${d}/${mo}/${y} 06:55`, close: `${d}/${mo}/${y} 12:39`, dau: 1000000, cuoi: 3000000, net: 5000000, hd: 50, tong: 3000000,
      pay: [{ name: 'CHUYỂN KHOẢN', amount: 3000000 }, { name: 'Tiền mặt', amount: 2000000 }], tra_no: [], sua: [] }] });
    const go = async () => { location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat/ca?id=' + id; await wait('.den-row'); await sleep(1500); };
    await go();
    $('#den-ok').click(); for (let i = 0; i < 300 && (await rpc('app_ca_get', { p_id: id })).recon_status !== 'hoan_thanh'; i++) await sleep(100);
    await go();
    r.push(`Đã đối soát: ${(await rpc('app_ca_get', { p_id: id })).recon_status} · nút Sửa ${$$('.den-edit').length} · nút cũ: Hoàn thành ${!!$('#rc-finish')} · Mở lại cả phiếu (Chủ) ${!!$('#rc-reopen')} · mục nhạt ${$$('.pc-sec.pc-auto').length} · ${W()}`);
    $$('.den-edit').find((x) => x.dataset.item === 'ban_giao').click(); await wait('dialog[open] form'); await sleep(200);
    $('dialog[open] [name=why]').value = 'ghi thiếu việc bàn giao'; $('dialog[open] [data-reopen]').click();
    for (let i = 0; i < 100 && (await rpc('app_ca_get', { p_id: id })).recon_status === 'hoan_thanh'; i++) await sleep(100); await sleep(1500); await wait('.den-row');
    r.push(`Sau Sửa Bàn giao: ${(await rpc('app_ca_get', { p_id: id })).recon_status} · ${txt('.alert.warn')} · mục nhạt ${$$('.pc-sec.pc-auto').map((s) => s.querySelector('h2').innerText.split('\n')[0].slice(0, 22)).join(' | ')}`);
    r.push(`Ô khoá: giờ ${$('#rev_end')?.disabled} · doanh thu ${$('#total_revenue')?.disabled} · két ${$('#cash_counted')?.disabled} · nhân viên ${$$('#staff select').every((x) => x.disabled)} · Đèn: ${$$('.den-row').map((x) => (x.classList.contains('done') ? '✓' : x.classList.contains('g') ? '🟢' : '·') + x.querySelector('strong').innerText.replace('🔒 ', '').slice(0, 10)).join(' ')}`);
    $('#den-ok').click(); for (let i = 0; i < 300 && (await rpc('app_ca_get', { p_id: id })).recon_status !== 'hoan_thanh'; i++) await sleep(100);
    r.push(`Duyệt lại Bàn giao → ${(await rpc('app_ca_get', { p_id: id })).recon_status} (tự hoàn thành, không bấm nút nào khác)`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'sửa từng mục đối soát', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
