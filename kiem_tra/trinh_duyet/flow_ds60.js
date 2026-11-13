// Tab Đối soát — Bảng tuần (role=chu, confirm=1, điện thoại): 1 ca đã gửi chờ kế toán, 1 ca đang chốt
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => { const w = document.documentElement.clientWidth; const wide = $$('#root *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > w + 1 && !el.closest('.table-wrap, .hub-tabs')).map((el) => el.tagName + '.' + el.className).slice(0, 3); return `rộng ${w}/${document.documentElement.scrollWidth}${wide.length ? ' tràn: ' + wide.join(',') : ''}`; };
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
    const o2 = ov.find((x) => x.branch_id === o.branch_id && x.shift !== o.shift);
    if (o2) await rpc('app_ca_open', { p_branch: o2.branch_id, p_date: day, p_shift: o2.shift });
    // bước 77: mặc định bảng tuần của 1 cơ sở — ① trạng thái, ② tiền, việc chờ ở dưới
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/doi-soat?cn=' + o.branch_id; await wait('.dw-t'); await sleep(1200);
    r.push(`Mặc định: ${txt('.ck-view')} · cơ sở ${$$('.dw-bar .branch-tabs a').map((a) => a.innerText.trim()).join(',')} (đang ${txt('.dw-bar .branch-tabs a.on')}) · tuần ${txt('.dw-wt')}`);
    const tabs = $$('.dw-t'); r.push(`${tabs.length} bảng: ${$$('.dw-card h2').map((h) => h.innerText.trim()).join(' | ')}`);
    r.push(`① ${txt('.dw-card .dw-h .st-meta')} · hôm nay: ${[...(tabs[0]?.querySelector('tr.today')?.querySelectorAll('td') || [])].map((td) => td.innerText.replace(/\s+/g, ' ')).join(' | ')}`);
    r.push(`② hôm nay: ${[...(tabs[1]?.querySelector('tr.today')?.querySelectorAll('td') || [])].map((td) => td.innerText.replace(/\s+/g, ' ')).join(' | ')} · cả tuần: ${txt('.dw-wk td:last-child')}`);
    r.push(`ô có link: ${[...(tabs[0]?.querySelectorAll('td a') || [])].map((a) => a.getAttribute('href')).filter((h) => h.includes('id=') || h.includes('xem=ngay')).slice(0, 4).join(', ')}`);
    r.push(`việc chờ (lọc cơ sở, ô chọn ẩn ${$('#td-br')?.hidden}): ${txt('.td-kpis')} · ${W()}`);
    $$('.ck-view a')[1].click(); await wait('.bc-grid'); await sleep(1000);
    r.push(`Theo ngày: ${$$('.bc').length} ô ca · ${$$('.ds-day').length} khung cuối ngày`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'bảng tuần đối soát', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
