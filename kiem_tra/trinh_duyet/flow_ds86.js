// Bước 86: trang Đối soát ca đi từng bước như phiếu chốt ca (7 bước), "Duyệt & tiếp", bước cuối xử lý lệch
// (Quán chịu / Chia đều người làm ca / Đối soát lại sau); bảng tuần màu "Hoàn thành 1 phần". role=chu (điện thoại, confirm=1)
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const vis = () => $$('.ds-pane').filter((p) => !p.hidden).map((p) => p.dataset.ds).join(',');
  const r = []; window.confirm = () => true;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    for (const m of ['../js/doi_soat_den.js', '../js/pages/phieu_ca.js', '../js/pages/doi_soat_ca.js', '../js/pages/doi_soat.js']) await Promise.race([import(m).catch(() => {}), sleep(4000)]);
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const o = ov.find((x) => x.shift === ov[0].shift && x.branch_code === 'LLB') || ov[0];   // LLB: không chờ kế toán
    const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: id });
    const e = (await rpc('app_ca_employees'))[0];
    const staff = (R.staff || []).length ? (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) : [{ employee_id: e.id, source: 'ho_tro', worked: true, time_in: '06:45', time_out: '12:39' }];
    await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 2400000, total_revenue: 7000000, pos_cash: 4500000, pos_transfer: 2400000,
      cash_counted: 5380000, ipos_opening: 1000000, pos_debt: 100000, pos_diff: -120000, cups: 50, moves: [{ kind: 'tien_mat', amount: -100000, note: 'Mua đá' }], goods: [], handover: [{ content: 'Máy xay kêu to' }],
      debts: [{ table_name: '3', amount: 100000, kind: 'bill' }], staff } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    const open = async () => { location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/doi-soat/ca?id=' + id; await wait('.ds-pane'); await sleep(1500); };
    try { sessionStorage.removeItem('ds_step:' + id); } catch (_) { /* bỏ qua */ }
    await open();
    r.push(`các bước: ${$$('.ds-st span').map((x) => x.innerText).join(' | ')} · hiện ${vis()} · ${txt('#ds-pos')} · nút ${txt('#ds-next')} · ${W()}`);
    $('#ds-next').click(); await sleep(2500); await wait('.ds-pane'); await sleep(800);
    const R2 = await rpc('app_ca_get', { p_id: id });
    r.push(`Duyệt bước 1 → đã duyệt: ${Object.keys(R2.checks || {}).join(',') || 'chưa'} · hiện ${vis()} · ${txt('#ds-pos')}`);
    for (let k = 0; k < 4; k++) { $('#ds-next').click(); await sleep(2500); await wait('.ds-pane'); await sleep(600); }
    const R3 = await rpc('app_ca_get', { p_id: id });
    r.push(`sau 5 bước: kiểm ${Object.keys(R3.checks || {}).join(',')} · kết quả ${Object.keys(R3.results || {}).join(',')} · hiện ${vis()} · ${$$('.ds-pane:not([hidden]) h2').map((x) => x.innerText).join(' / ')} · ${txt('.cm-err, #err') || ''}`);
    $('#ds-next').click(); await sleep(2500); await wait('.ds-pane'); await sleep(800);
    r.push(`bước cuối: hiện ${vis()} · xử lý lệch: ${$$('.lx-box').map((b) => b.innerText.replace(/\s+/g, ' ').slice(0, 160)).join(' || ') || txt('.ds-pane:not([hidden]) .pc-sec')}`);
    // tuần: đang Hoàn thành 1 phần
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/doi-soat?cn=' + o.branch_id; await wait('.dw-t'); await sleep(1500);
    r.push(`bảng tuần: ${$$('.dw-t .dw-c').map((c) => c.innerText.replace(/\s+/g, ' ')).filter((t) => /Hoàn thành 1 phần|Chờ đối soát|Đã đối soát/.test(t)).slice(0, 2).join(' | ')} · chú thích có "${$$('.dw-lg .dw-c').map((c) => c.innerText).find((t) => /1 phần/.test(t)) || 'KHÔNG'}"`);
    // chia đều người làm ca
    await open();
    const box = $$('.lx-box').find((b) => b.dataset.item === 'tien_mat');
    if (box) {
      box.querySelector('input[value="chia"]').click(); box.querySelector('input[value="chia"]').dispatchEvent(new Event('change', { bubbles: true })); await sleep(400);
      r.push(`chia: ${box.querySelector('.lx-sum').innerText}`);
      box.querySelector('.lx-save').click(); await sleep(3000);
      const R4 = await rpc('app_ca_get', { p_id: id });
      r.push(`sau chia: kết quả TM ${JSON.stringify((R4.results || {}).tien_mat || null).slice(0, 120)} · khoản âm ${(R4.shortfalls || []).length} · ${txt('.lx-err')}`);
    } else r.push('không thấy khung xử lý tiền mặt');
    r.push(`cuối: ${W()}`);
  } catch (e) { r.push('LỖI ' + (e.stack || e)); }
  out.push({ route: 'đối soát từng bước 86', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
