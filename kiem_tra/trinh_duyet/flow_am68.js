// Bước 68: Thu chi — gộp âm tiền theo ca (khoản chi "Âm tiền" NV ghi + khoản âm TL) thành 1 dòng; gán trừ lương / quán chịu / bỏ gán. role=chu (điện thoại)
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = []; window.confirm = () => true;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { sb } = await import('../js/sb.js');
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    await sb.from('shift_reports').insert({ id: 9971, branch_id: 1, work_date: today, shift: 'Sáng', status: 'hoan_thanh', recon_status: 'hoan_thanh', total_revenue: 1000000 });
    await sb.from('shift_report_moves').insert([{ id: 99711, report_id: 9971, kind: 'tien_mat', amount: -155000, note: 'Âm tiền', sort_order: 1 },
      { id: 99712, report_id: 9971, kind: 'tien_mat', amount: -40000, note: 'Mua đá thử', sort_order: 2 }]);
    await sb.from('shift_report_staff').insert([{ id: 99713, report_id: 9971, employee_id: 1, source: 'lich', worked: 1 }, { id: 99714, report_id: 9971, employee_id: 2, source: 'lich', worked: 1 }]);
    const go = async () => { location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/thu-chi'; await wait('.tc-r', 600); await sleep(600); };
    await go();
    const g = () => $('.tc-r.am[data-g="9971"]');
    r.push(`dòng Âm tiền: ${g() ? txt('.tc-m', g()) + ' · ' + txt('.tc-a', g()) + ' · ' + txt('.tc-s', g()) : 'KHÔNG THẤY'} · dòng "Âm tiền" riêng còn? ${$$('.tc-r:not(.am) strong').some((x) => x.innerText === 'Âm tiền')} · "Mua đá" vẫn dòng thường ${$$('.tc-r:not(.am) strong').some((x) => x.innerText.includes('Mua đá thử'))}`);
    $('.tc-amx', g()).click(); await sleep(150);
    r.push(`mở Chi tiết: ${txt('.tc-amd', g())}`.slice(0, 220));
    $('.tc-amtl', g()).click(); await wait('dialog[open] form'); await sleep(400);
    let dl = $('dialog[open]');
    r.push(`hộp trừ lương: ${$$('.tc-pp', dl).map((x) => x.innerText.trim() + ' ' + x.querySelector('.tc-pamt').value).join(' | ')} · ${txt('#tc-psum', dl)}`);
    dl.querySelector('[type=submit]').click(); for (let i = 0; i < 50 && $('dialog[open]'); i++) await sleep(100); await sleep(1500); await wait('.tc-r', 300); await sleep(500);
    r.push(`sau gán: ${txt('.tc-m', g())} · nhãn ${txt('.tc-pm', g())} · ${txt('.tc-s', g())} · đang mở ${!g().querySelector('.tc-amd').hidden}`);
    r.push(`chi tiết: ${txt('.tc-amd', g())}`.slice(0, 260));
    if (new URLSearchParams(location.search).get('shot')) { g().scrollIntoView(); return; }
    $('.tc-amundo', g()).click(); await sleep(1500); await wait('.tc-r', 300); await sleep(500);
    r.push(`bỏ gán: ${txt('.tc-s', g())}`);
    $('.tc-amqc', g()).click(); await sleep(1500); await wait('.tc-r', 300); await sleep(500);
    r.push(`quán chịu: ${txt('.tc-m', g())} · ${txt('.tc-s', g())}`);
    // khoản khác gán âm tiền từ hộp Sửa
    $$('.tc-r').find((x) => x.querySelector('strong')?.innerText.includes('Mua đá thử')).querySelector('.tc-med').click(); await wait('dialog[open] form'); await sleep(200);
    r.push(`hộp Sửa có nút "Đây là âm tiền": ${!!$('dialog[open] .tc-2am')}`);
    $('dialog[open] [data-x]').click(); await sleep(200);
    $('#tc-ka').click(); await sleep(200);
    r.push(`bấm ô Âm tiền → lọc: ${txt('#f-n')} · ô ${txt('#tc-ka')} · ${W()}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'gộp âm tiền', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
