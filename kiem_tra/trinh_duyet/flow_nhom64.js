// Chặng 6.4 (anh Tiến chốt 23/11): 4 nhóm công nợ ① Khách hàng ② Kho tổng ③ Chủ (anh Tiến) ④ Người nhà / người quen; nợ khách không cần tên.
//  A. Công nợ: 4 ô tổng, nợ khách gộp một dòng "Khách" (mở ra từng khoản + ghi chú, Đã thu từng khoản); Ghi nợ khách chỉ ghi chú; nhóm Chủ riêng.
//     Sổ chi › 👥 Người nợ: ô nhóm không có Nợ khách hàng; người chung "Khách" không Sửa được.
//  B. Phiếu chốt ca: mỗi khoản nợ mới chọn Nợ khách / Nợ khác.   C. Bước 1 trang đối soát ca: nợ khách không cần Xếp, có Đổi nhóm; nợ khác phải phân loại.
// Chạy: script=flow_nhom64&phan=A (role chu, máy tính + test/phone.html) · phan=B (role nv) · phan=C (role chu / qlt / ql). confirm=1.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wait = async (s, n = 80) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const gone = async (s, n = 60) => { for (let i = 0; i < n && $(s); i++) await sleep(100); return !$(s); };
  const wide = (m) => ok(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, m + ': không tràn ngang');
  const calls = (fn, from = 0) => (window.__LOG || []).slice(from).filter((x) => x[0] === 'rpc' && x[1] === fn).map((x) => x[2]);
  const dlg = () => $$('dialog[open]').pop();
  const type = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const PHAN = new URLSearchParams(location.search).get('phan') || 'A';
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
  try {
    const { rpc } = await import('../js/sb.js');
    if (PHAN === 'A') {
      const L = await rpc('app_tc_list', { p_branch: null, p_from: '2000-01-01', p_to: '2000-01-01' });
      const br = (L.branches || [])[0]?.id;
      const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
      const people0 = await rpc('app_stc_people', { p_branch: br }).catch(() => []);
      if (!people0.some((p) => p.name === 'Chủ thử')) await rpc('app_stc_person_save', { p_id: null, p: { branch_id: br, name: 'Chủ thử', grp: 'chu' } }).catch(() => {});
      await rpc('app_cn_debt_save', { p_id: null, p: { branch_id: br, grp: 'khach', name: 'bàn 5 áo xanh', amount: 40000, kind: 'bill', date: day } });
      await rpc('app_cn_debt_save', { p_id: null, p: { branch_id: br, grp: 'khach', name: 'bàn 7', amount: 70000, kind: 'muon', date: day } });
      await rpc('app_cn_debt_save', { p_id: null, p: { branch_id: br, grp: 'chu', name: 'Chủ thử', amount: 900000, kind: 'ck', date: day } });
      const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(300); location.hash = h; await wait(sel); await sleep(1000); };
      await go('#/quan-ly/cong-no?cn=' + br, '.cn-g');
      const tiles = $$('.cn-ks .cn-k[href*="g="]').map(txt);
      ok(tiles.length === 4 && /khách hàng/.test(tiles[0]) && /kho tổng/.test(tiles[1]) && /chủ/.test(tiles[2]) && /người nhà/.test(tiles[3]), 'A1. 4 ô tổng đúng thứ tự: ' + tiles.join(' | '));
      const kh = $$('.cn-g[data-g="khach"] .cn-p');
      ok(kh.length === 1 && /^khách\b/.test(txt(kh[0].querySelector('.cn-ph b'))), `A2. nợ khách gộp một dòng "Khách" (${kh.length} dòng: ${kh.map((x) => txt(x.querySelector('.cn-ph b'))).join(', ')})`);
      ok(!!$('.cn-g[data-g="chu"]') && txt($('.cn-g[data-g="chu"]')).includes('chủ thử'), 'A5. nhóm ③ Chủ có khoản của "Chủ thử"');
      wide('A. Công nợ');
      if (kh[0]) {
        kh[0].querySelector('.cn-ph').click(); await wait('.cn-sum'); await sleep(1000);
        const body = txt($('.cn-wrap'));
        ok(body.includes('bàn 5 áo xanh') && body.includes('bàn 7'), 'A3. dòng Khách mở ra từng khoản kèm ghi chú (bàn 5 áo xanh, bàn 7)');
        ok(!$('#cn-thu') && !$('#cn-edit') && $$('.cn-thu1').length >= 2, `A3. không có "Đã thu" / "Sửa tên" chung; mỗi khoản có nút Đã thu riêng (${$$('.cn-thu1').length})`);
        const b7 = $$('.cn-l').find((l) => txt(l).includes('bàn 7'));
        b7?.querySelector('.cn-thu1')?.click(); await wait('dialog[open] form [name=amount]'); await sleep(300);
        ok(!!dlg() && txt(dlg()).includes('bàn 7') && $('[name=amount]', dlg())?.value.replace(/\D/g, '') === '70000', 'A3. Đã thu từng khoản: hộp ghi đúng khoản bàn 7, số 70.000');
        $('[data-x]', dlg())?.click(); await sleep(300);
        wide('A. trang Khách');
      }
      await go('#/quan-ly/cong-no?cn=' + br, '.cn-g');
      $('.cn-new[data-g="khach"]')?.click(); await wait('dialog[open] form [name=amount]'); await sleep(300);
      const f = dlg();
      ok(!!f && /bàn/.test(txt($('[name=kname]', f)?.closest('label'))) && (!$('select[data-nnsel]', f) || !!$('select[data-nnsel]', f).closest('[hidden]')), 'A4. "+ Ghi nợ khách": không chọn người, chỉ ô ghi chú khách / bàn');
      if (f) { $('[data-x]', f)?.click(); await sleep(300); }
      // Sổ chi › Người nợ
      location.hash = '#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11&t=' + Date.now(); await wait('#stc-book [data-people]'); await sleep(800);
      $('#stc-book [data-people]')?.click(); await wait('dialog[open] [data-prow]', 40); await sleep(300);
      const pd = dlg();
      const kRow = $$('[data-prow]', pd).find((r) => /^khách\b/.test(txt(r)));
      ok(!!kRow && !$('[data-pedit]', kRow), 'A6. người chung "Khách" có trong danh sách, không có nút Sửa');
      $('[data-padd]', pd)?.click(); await wait('dialog[open] [name=pgrp]', 40); await sleep(200);
      const opts = $$('[name=pgrp] option', dlg()).map((o) => o.value);
      ok(opts.join(',') === 'kho,chu,khac', 'A6. thêm người nợ: chỉ chọn nhóm Kho tổng / Chủ / Người nhà (' + opts.join(',') + ')');
      wide('A. thêm người nợ');
    }
  } catch (e) { bad.push('LỖI CHẠY ' + (e.message || e)); }
  out.push({ route: 'nhóm công nợ ' + PHAN, title: `ĐẠT ${good.length} · LỖI ${bad.length} || ${[...bad.map((x) => 'LỖI ' + x), ...good.map((x) => 'ĐẠT ' + x)].join(' || ')}`, len: 0, errs: [...(window.__ERR || []), ...bad] });
};
