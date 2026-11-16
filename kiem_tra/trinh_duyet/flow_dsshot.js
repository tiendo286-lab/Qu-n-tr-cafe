// Chụp màn hình trang Đối soát ca từng bước (?b=1..4, dùng kèm dung=1). Dựng phiếu như flow_ds110.
// Bước 110: Đối soát ca — phần tiền gộp 1 trang (Phiếu Fabi · Khách nợ · Thu chi · Tiền mặt · Chuyển khoản), 1 nút "Duyệt phần tiền & hoàn thành",
// nút "+ Khách chuyển khoản rút tiền mặt" (2 dòng tiền mặt − / chuyển khoản +). role=chu (confirm=1; máy tính và test/phone.html)
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ((typeof s === 'string' ? $(s) : s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const vis = () => $$('.ds-pane').filter((p) => !p.hidden).map((p) => p.dataset.ds).join(',');
  const r = []; window.confirm = () => true; window.prompt = () => '200.000';
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    for (const m of ['../js/doi_soat_den.js', '../js/pages/phieu_ca.js', '../js/pages/doi_soat_ca.js']) await Promise.race([import(m).catch(() => {}), sleep(4000)]);
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const o = ov.find((x) => x.shift === ov[0].shift && x.branch_code === 'LLB') || ov[0];
    const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: id });
    const e = (await rpc('app_ca_employees'))[0];
    const staff = (R.staff || []).length ? (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) : [{ employee_id: e.id, source: 'ho_tro', worked: true, time_in: '06:45', time_out: '12:39' }];
    await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 2400000, total_revenue: 7000000, pos_cash: 4500000, pos_transfer: 2400000,
      cash_counted: 5150000, ipos_opening: 1000000, pos_debt: 100000, pos_diff: -350000, cups: 50, moves: [{ kind: 'tien_mat', amount: -100000, note: 'Mua đá' }, { kind: 'tien_mat', amount: -200000, note: 'Mua sữa' }], goods: [], handover: [],
      debts: [{ table_name: '3', amount: 100000, kind: 'bill' }], staff } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    const b = new URLSearchParams(location.search).get('b') || '1';
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/doi-soat/ca?id=' + id + '&buoc=' + b; await wait('.ds-pane'); await sleep(2500);
    window.scrollTo(0, 0); await new Promise(() => {});
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'đối soát chụp', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
