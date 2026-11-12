// Khung điện thoại: trang Đối soát (gom việc) + trang Đối soát ca từng bước — không tràn ngang
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 900) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const r = []; window.confirm = () => true;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const id = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[0].shift });
    const R = await rpc('app_ca_get', { p_id: id });
    await rpc('app_ca_save', { p_id: id, p: { rev_end: day + ' 12:30', total_revenue: 2000000, pos_cash: 1200000, pos_transfer: 800000, reported_transfer: 800000, cash_counted: 2150000, opening_cash: 1000000, ipos_opening: 1000000, cups: 80,
      pos_debt: 0, pos_diff: -50000, diff_note: 'thử: khách mượn',   // bước 41 (phiếu Fabi) + bước 43 (khách mượn tiền)
      moves: [{ kind: 'tien_mat', amount: -50000, note: 'chi đá' }], staff: (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:30' })), handover: [], goods: [],
      debts: [{ table_name: 'Anh Nam (thử)', amount: 30000, note: '09xx', kind: 'muon' }] } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    const W = () => { const w = document.documentElement.clientWidth; const wide = $$('#root *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > w + 1).map((el) => el.tagName + '.' + el.className + '<' + (el.parentElement?.className || '') + '<' + (el.parentElement?.parentElement?.className || '')).slice(0, 4); return `rộng ${w}/${document.documentElement.scrollWidth} · tràn: ${wide.join(', ') || 'không'}`; };
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat'; await wait('.td-card'); await sleep(600);
    r.push(`Trang Đối soát: ${$$('.td-k').map((k) => k.innerText.replace(/\s+/g, ' ')).join(' | ')} · phiếu chờ: ${$$('#td-rep .td-r').length} · thu chi chờ: ${$$('#td-moves .dt-r.todo').length} · ${W()}`);
    r.push(`Mục khách mượn: ${($('#td-muon')?.innerText || 'KHÔNG CÓ').replace(/\s+/g, ' ')}`);
    $('#td-rep .td-r a.btn').click(); await wait('.ds-pane'); await sleep(800);
    r.push(`Đối soát ca: ${txt('h1')} · ${$$('.ds-st').length} bước: ${txt('.ds-steps')} · đang xem: ${txt('.ds-pane:not([hidden]) .ds-hd')} · ${txt('#ds-pos')} · ${W()}`);
    r.push(`Phân nhóm thu chi bước 1: ${$$('#ds-tc .dt-r').length} dòng`);
    $('#ds-next').click(); await sleep(300); r.push(`Tiếp → ${txt('.ds-pane:not([hidden]) .ds-hd')}`);
    $('#ds-next').click(); await sleep(300); $('#ds-next').click(); await sleep(300);
    r.push(`Bước 4: ${txt('.ds-pane:not([hidden]) .ds-sum')} · ${W()}`);
    const g = $('.ds-pane:not([hidden]) [data-ds-go]'); if (g) { g.click(); await sleep(300); r.push(`bấm "Làm bước" → ${txt('.ds-pane:not([hidden]) .ds-hd')}`); }
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id; await wait('#pc-form'); await sleep(800);
    r.push(`Phiếu nhân viên: chip đối soát: ${$$('.rc-chip').length} · nút: ${txt('#pc-form > section:last-of-type a.btn')} · ${W()}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'điện thoại', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
