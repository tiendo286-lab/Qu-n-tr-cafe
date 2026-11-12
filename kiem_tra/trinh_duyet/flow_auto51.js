// Bước 51: mục web tự đối soát (khớp file Fabi + ngân hàng) → nhạt đi, khoá; Chủ mở khoá có lý do. role=chu|ql (confirm=1)
// Trình duyệt thử không tự xét như máy chủ: gọi app__test_auto_lock để giả lập kết quả tự đối soát.
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    const me = await rpc('app_me');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const o = ov[0];
    const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: id });
    await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 3000000, total_revenue: 5000000, pos_cash: 2000000, pos_transfer: 3000000,
      cash_counted: 2950000, ipos_opening: 1000000, pos_debt: 0, pos_diff: -50000, diff_note: 'mua đá', cups: 50, moves: [{ kind: 'tien_mat', amount: -50000, note: 'mua đá' }], goods: [], handover: [], debts: [],
      staff: (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    await rpc('app__test_auto_lock', { p_id: id, p_items: ['thoi_gian', 'doanh_thu', 'ban_giao', 'nhan_su'] });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat/ca?id=' + id; await wait('.den-row'); await sleep(1200);
    r.push(`${me.role}: Đèn: ${$$('.den-row').map((x) => (x.classList.contains('auto') ? '🔒' : x.classList.contains('done') ? '✓' : x.classList.contains('r') ? '🔴' : '·') + x.querySelector('strong').innerText.replace('🔒 ', '')).join(' ')}`);
    r.push(`ghi chú: ${txt('#ds-lights > .st-meta')} · nút Sửa ${$$('.den-edit').length}`);
    const secs = $$('.pc-sec.pc-auto').map((s) => s.querySelector('h2')?.innerText.split('\n')[0]);
    r.push(`Mục nhạt + khoá: ${secs.join(' | ') || 'không'} · chip: ${$$('.rc-auto').map((x) => x.innerText).join(' / ')}`);
    r.push(`Ô bị khoá: rev_end ${$('#rev_end')?.disabled} · total_revenue ${$('#total_revenue')?.disabled} · cash_counted ${$('#cash_counted')?.disabled} · nhân viên ${$$('#staff select').every((x) => x.disabled)} · thêm hỗ trợ ${!!$('#add-helper')} · thu chi ${$$('#moves input').some((x) => x.disabled)} · ${W()}`);
    if (me.role === 'chu') {
      const b = $$('.den-edit').find((x) => x.dataset.item === 'doanh_thu');
      window.prompt = () => 'kế toán tải nhầm file';
      b.click(); for (let i = 0; i < 100 && $$('.den-row.auto').length === 4; i++) await sleep(100); await sleep(1500); await wait('.den-row');
      r.push(`Sau Sửa Doanh thu: mục 🔒 còn ${$$('.den-row.auto').length} · ô total_revenue khoá ${$('#total_revenue')?.disabled} · mục 2 nhạt ${$$('.pc-sec.pc-auto').some((s) => /Nhận két/.test(s.innerText))} · ${W()}`);
    }
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'tự đối soát + khoá', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
