// Bước 65: Thu chi sửa linh hoạt — chọn nhóm ngay ở dòng (= đối soát), đổi nhóm lại, sửa số tiền khoản phiếu ca (bắt lý do), đổi nhóm hàng loạt. role=chu (điện thoại)
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const typ = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const row = (t) => $$('.tc-r').find((x) => x.querySelector('strong')?.innerText.includes(t));
  const info = (t) => { const x = row(t); return x ? `${x.querySelector('.tc-a').innerText} · ${x.querySelector('.pill')?.innerText} · ${(x.querySelector('.tc-m .st-meta b')?.innerText) || '-'}` : 'KHÔNG THẤY'; };
  const reload = async () => { location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/thu-chi'; await wait('.tc-r', 600); await sleep(500); };
  const r = []; window.confirm = () => true;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { sb } = await import('../js/sb.js');
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    await sb.from('shift_reports').insert({ id: 9951, branch_id: 1, work_date: today, shift: 'Sáng', status: 'hoan_thanh', recon_status: 'chua', total_revenue: 1000000 });
    await sb.from('shift_report_moves').insert([{ id: 99511, report_id: 9951, kind: 'tien_mat', amount: -50000, note: 'Mua đá thử', sort_order: 1 },
      { id: 99512, report_id: 9951, kind: 'tien_mat', amount: -80000, note: 'Mua sữa thử', sort_order: 2 },
      { id: 99513, report_id: 9951, kind: 'tien_mat', amount: 20000, note: 'Bán bã thử', sort_order: 3 }]);
    await reload();
    r.push(`ban đầu: Mua đá ${info('Mua đá thử')} · nút ở dòng: ${$$('button, select', row('Mua đá thử').querySelector('.tc-act')).map((b) => b.tagName === 'SELECT' ? 'ô nhóm' : b.innerText).join(', ')}`);
    // 1) chọn nhóm ngay ở dòng = đối soát
    let s = row('Mua đá thử').querySelector('.tc-cat'); s.value = [...s.options].find((o) => o.text === 'Nguyên liệu').value; s.dispatchEvent(new Event('change'));
    await sleep(1500); await wait('.tc-r', 300); await sleep(300);
    r.push(`chọn nhóm Nguyên liệu: ${info('Mua đá thử')} · báo: ${txt('.alert')}`);
    // 2) đổi lại nhóm khoản đã đối soát
    s = row('Mua đá thử').querySelector('.tc-cat'); s.value = [...s.options].find((o) => o.text === 'Vật dụng').value; s.dispatchEvent(new Event('change'));
    await sleep(1500); await wait('.tc-r', 300); await sleep(300);
    r.push(`đổi sang Vật dụng: ${info('Mua đá thử')}`);
    // 3) sửa số tiền khoản phiếu ca
    row('Mua sữa thử').querySelector('.tc-med').click(); await wait('dialog[open] form'); await sleep(200);
    let dl = $('dialog[open]');
    r.push(`hộp sửa: ${txt('h2', dl)} · ô lý do ẩn: ${dl.querySelector('.tc-why').hidden}`);
    typ(dl.querySelector('[name=amt]'), '90000'); await sleep(100);
    r.push(`đổi số tiền → hiện lý do: ${!dl.querySelector('.tc-why').hidden} · cảnh báo: ${txt('.tc-mw', dl)}`);
    dl.querySelector('[name=cat]').value = [...dl.querySelector('[name=cat]').options].find((o) => o.text === 'Nguyên liệu').value;
    dl.querySelector('[type=submit]').click(); await sleep(800);
    r.push(`lưu không lý do: ${txt('#tc-err', dl)}`);
    typ(dl.querySelector('[name=why]'), 'nhân viên ghi nhầm'); dl.querySelector('[type=submit]').click();
    for (let i = 0; i < 50 && $('dialog[open]'); i++) await sleep(100); await sleep(1500); await wait('.tc-r', 300); await sleep(300);
    r.push(`sau sửa (Chủ sửa thẳng): Mua sữa ${info('Mua sữa thử')} · báo: ${txt('.alert')}`);
    // 4) đổi nhóm hàng loạt
    row('Mua đá thử').querySelector('.tc-pick').click(); row('Mua sữa thử').querySelector('.tc-pick').click(); await sleep(200);
    r.push(`chọn 2 khoản chi: thanh ${!$('#tc-bulk').hidden} · ${txt('#tc-bulk')}`.slice(0, 160));
    if (new URLSearchParams(location.search).get('shot')) { row('Mua đá thử').scrollIntoView(); return; }   // dừng để chụp màn hình
    row('Bán bã thử').querySelector('.tc-pick').click(); await sleep(150);
    r.push(`thêm 1 khoản thu: ${txt('#tc-bmsg')} · nút khoá ${$('#tc-bgo').disabled}`);
    row('Bán bã thử').querySelector('.tc-pick').click(); await sleep(150);
    $('#tc-bcat').value = [...$('#tc-bcat').options].find((o) => o.text === 'Khác').value; $('#tc-bgo').click();
    await sleep(1500); await wait('.tc-r', 300); await sleep(300);
    r.push(`sau đổi hàng loạt → Khác: Mua đá ${info('Mua đá thử')} | Mua sữa ${info('Mua sữa thử')} · báo: ${txt('.alert')}`);
    // 5) chọn tất cả đang hiện (lọc chỉ khoản chi)
    $('#f-kind').value = 'chi'; $('#f-kind').dispatchEvent(new Event('change')); await sleep(100); $('#tc-all').click(); await sleep(150);
    r.push(`chọn tất cả (lọc khoản chi): ${txt('#tc-bn')} khoản / ${txt('#f-n')} · ${W()}`);
    $('#tc-bclr').click(); await sleep(100); r.push(`bỏ chọn: thanh ẩn ${$('#tc-bulk').hidden}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'thu chi sửa linh hoạt', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
