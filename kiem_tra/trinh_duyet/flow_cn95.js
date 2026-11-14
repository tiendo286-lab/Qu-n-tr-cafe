// Bước 95: tab Công nợ riêng (3 nhóm, theo người, ngày nợ → ngày trả, thu gộp, đổi nhóm) + Đối soát › Thu chi "Thành nợ". role=chu (điện thoại, confirm=1)
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
      cash_counted: 5180000, ipos_opening: 1000000, pos_debt: 100000, pos_diff: -320000, cups: 50, moves: [{ kind: 'tien_mat', amount: -100000, note: 'Mua đá' }, { kind: 'tien_mat', amount: -200000, note: 'Chi lương Quang hỗ trợ' }], goods: [], handover: [{ content: 'Máy xay kêu to' }],
      debts: [{ table_name: '3', amount: 100000, kind: 'bill' }], staff } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });

    const d10 = new Date(Date.now() + 7 * 3600e3 - 10 * 864e5).toISOString().slice(0, 10);
    await rpc('app_cn_debt_save', { p_id: null, p: { branch_id: o.branch_id, grp: 'khac', name: 'Anh Bình', phone: '0912', amount: 300000, kind: 'muon', date: d10 } });
    await rpc('app_cn_debt_save', { p_id: null, p: { branch_id: o.branch_id, grp: 'khach', name: 'Chị Hoa', amount: 80000, kind: 'bill', date: d10 } });
    const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(300); location.hash = h; await wait(sel); await sleep(1200); };
    await go('#/quan-ly/cong-no?cn=' + o.branch_id, '.cn-g');
    r.push(`menu: ${[...document.querySelectorAll('a')].some((a) => a.getAttribute('href') === '#/quan-ly/cong-no') ? 'có Công nợ' : 'KHÔNG'}`);
    r.push(`nhóm: ${$$('.cn-g').map((g) => g.querySelector('h2').innerText + ' ' + g.querySelector('.cn-gsum').innerText + ' (' + g.querySelectorAll('.cn-p').length + ' người)').join(' | ')}`);
    r.push(`ô số: ${$$('.cn-ks .cn-k').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ')} · quá hạn: ${txt('.cn-latebox')} · ${W()}`);
    { // bước 97: bấm ô nhóm → chỉ hiện nhóm đó; bấm lại → cả 3 nhóm
      $('.cn-k[href*="g=kho"]').click(); await sleep(300); await wait('.cn-g'); await sleep(1200);
      r.push(`97 lọc Kho tổng: ${$$('.cn-g').map((g) => g.dataset.g).join(',')} · ô đang chọn ${txt('.cn-k.on .k')}`);
      $('.cn-k.on').click(); await sleep(300); await wait('.cn-g'); await sleep(1200);
      r.push(`bỏ lọc: ${$$('.cn-g').map((g) => g.dataset.g).join(',')}`); }
    const STOP = new URLSearchParams(location.search).get('dung'); const halt = async (k) => { if (STOP === k) { window.scrollTo(0, 0); await new Promise(() => {}); } };   // chụp ảnh
    await rpc('app_cn_debt_save', { p_id: null, p: { branch_id: o.branch_id, grp: 'kho', name: 'Kho tổng', amount: 1200000, kind: 'muon', date: d10, note: 'trả hộ tiền sữa' } });
    if (STOP) { await go('#/quan-ly/cong-no?cn=' + o.branch_id, '.cn-g'); } await halt('1');
    r.push(`dòng khoản: ${txt('.cn-g[data-g="khach"] .cn-l')}`);
    // + Kho tổng nợ
    $('.cn-new[data-g="kho"]').click(); await wait('dialog[open] form [name=amount]'); await sleep(300);
    let f = $$('dialog[open] form').pop(); f.amount.value = '500.000'; f.note.value = 'trả hộ tiền sữa'; f.requestSubmit(); await sleep(2500); await wait('.cn-g');
    r.push(`kho tổng: ${txt('.cn-g[data-g="kho"] .cn-p .cn-ph')}`);
    // tìm
    $('#cn-find').value = 'bình'; $('#cn-find').dispatchEvent(new Event('input')); await sleep(300);
    r.push(`tìm "bình": hiện ${$$('.cn-p').filter((x) => !x.hidden).length} người`);
    // chi tiết
    $$('.cn-p').find((x) => !x.hidden).querySelector('.cn-ph').click(); await wait('#cn-thu'); await sleep(1200);
    r.push(`chi tiết: ${txt('h1')} · ${txt('.cn-big')} · ${W()}`);
    await halt('2');
    $('#cn-thu').click(); await wait('dialog[open] form [name=amount]'); await sleep(300);
    f = $$('dialog[open] form').pop(); f.amount.value = '100.000'; f.requestSubmit(); await sleep(2500); await wait('.cn-big');
    r.push(`thu 100.000: ${txt('.cn-big')} · ${$$('section h2').map((x) => x.innerText).join(' / ')}`);
    $('.cn-unthu').click(); await sleep(2500); await wait('.cn-big');
    r.push(`bỏ thu: ${txt('.cn-big')}`);
    $('#cn-edit').click(); await wait('dialog[open] form [name=grp]'); await sleep(300);
    f = $$('dialog[open] form').pop(); [...f.grp].find((x) => x.value === 'khach').checked = true; f.requestSubmit(); await sleep(2500); await wait('.cn-big');
    r.push(`đổi nhóm: ${decodeURIComponent(location.hash)} · ${txt('.sub')}`);
    // đối soát › Thu chi: Thành nợ
    await go('#/quan-ly/doi-soat/ca?id=' + id + '&buoc=6', '.dt-2no');
    r.push(`nút Thành nợ: ${$$('.dt-2no').length}`);
    $('.dt-2no').click(); await wait('dialog[open] form [name=grp]'); await sleep(600);
    f = $$('dialog[open] form').pop(); [...f.grp].find((x) => x.value === 'kho').checked = true; f.name.value = 'Kho tổng'; f.requestSubmit(); await sleep(2500); await wait('.dt-undebt');
    r.push(`sau Thành nợ: ${txt('.dt-r .pill.warn')}`);
    const B = await rpc('app_cn_book', { p_branch: o.branch_id });
    r.push(`tab Công nợ có: ${B.rows.filter((x) => x.mv_report).map((x) => x.name + ' ' + x.amount + ' ' + x.kind + ' từ ca ' + x.mv_ca).join(', ')}`);
    { // bước 96: trang Thu chi không hiện khoản đã thành nợ, chỉ 1 dòng ghi số khoản
      const back = location.hash; await go('#/quan-ly/thu-chi?cn=' + o.branch_id, '.tc-r'); await sleep(2500);
      r.push(`96 trang Thu chi: dòng "thành nợ" ${$$('.tc-r').filter((x) => /thành nợ/i.test(x.innerText)).length} · ghi chú: ${$$('#tc-loans .st-meta').map((x) => x.innerText).join(' ') || 'KHÔNG'}`);
      await go(back, '.dt-undebt'); }
    $('.dt-undebt').click(); await sleep(2500); await wait('.dt-2no');
    r.push(`bỏ: còn ${(await rpc('app_cn_book', { p_branch: o.branch_id })).rows.filter((x) => x.mv_report).length} khoản từ thu chi · ${W()}`);
    { // bước 96: trang Thu chi › Sửa khoản ở phiếu ca › "Đây là nợ…"
      await go('#/quan-ly/thu-chi?cn=' + o.branch_id, '.tc-r[data-i]'); await sleep(2000);
      const el = $$('.tc-r[data-i]').find((x) => /−|-/.test(x.innerText) && x.innerText.includes(R.shift || '')) || $$('.tc-r[data-i]')[0];
      const n0 = $$('.tc-r[data-i]').length; el.click(); await wait('dialog[open] .tc-2no'); await sleep(300);
      r.push(`96 hộp sửa: nút ${$$('dialog[open] .toolbar button').map((x) => x.innerText).join(' / ')}`);
      $('dialog[open] .tc-2no').click(); await wait('dialog[open] form [name=grp]'); await sleep(800);
      f = $$('dialog[open] form').pop(); [...f.grp].find((x) => x.value === 'khach').checked = true; f.name.value = 'A Thắng'; f.requestSubmit(); await sleep(3500);
      await wait('.tc-r[data-i]'); await sleep(800);
      r.push(`sau Đây là nợ: dòng ${n0} → ${$$('.tc-r[data-i]').length} · ghi chú: ${$$('#tc-loans .st-meta').map((x) => x.innerText).join(' ') || 'KHÔNG'} · tab Công nợ: ${(await rpc('app_cn_book', { p_branch: o.branch_id })).rows.filter((x) => x.mv_report).map((x) => x.name + ' ' + x.grp).join(', ')} · ${W()}`);
    }
  } catch (e) { r.push('LỖI ' + (e.stack || e)); }
  out.push({ route: 'tab công nợ 95', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
