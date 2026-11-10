// Quản lý ca › Thu chi: khoản từ phiếu chốt ca chờ đối soát → đối soát; quản lý tự tạo khoản (đã đối soát); phần Khoản âm; đường dẫn cũ.
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const { sb } = await import('../js/sb.js');
  const r = []; window.confirm = () => true;
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  await sb.from('shift_reports').insert({ id: 9901, branch_id: 1, work_date: today, shift: 'Sáng', status: 'hoan_thanh', recon_status: 'chua', total_revenue: 1000000 });
  await sb.from('shift_report_moves').insert([{ id: 99011, report_id: 9901, kind: 'tien_mat', amount: -50000, note: 'Mua đá', sort_order: 1 },
    { id: 99012, report_id: 9901, kind: 'tien_mat', amount: 20000, note: 'Bán bã cafe', sort_order: 2 }]);
  location.hash = '#/quan-ly/thu-chi'; await wait('.tc-r', 200); await sleep(400);
  r.push(`menu Quản lý ca: ${$$('.hub-tabs a').map((a) => a.innerText.trim()).join(' · ')}`);
  r.push(`ban đầu: ${$$('.tc-r').length} dòng, chờ: ${$$('.tc-r.todo').length} · ô Chờ đối soát: ${txt('#tc-pend')}`);
  let row = $$('.tc-r.todo').find((x) => x.innerText.includes('Mua đá'));
  row.querySelector('.tc-ok').click(); await sleep(400);
  r.push(`đối soát khi chưa chọn nhóm: ${txt('#saved-indicator') || '(không báo)'}`);
  const sel = row.querySelector('.tc-cat'); sel.value = sel.options[1].value; row.querySelector('.tc-ok').click(); await sleep(1200); await wait('.tc-r', 50);
  row = $$('.tc-r').find((x) => x.innerText.includes('Mua đá'));
  r.push(`sau đối soát "Mua đá": ${row.querySelector('.pill').innerText} · ${row.querySelector('.st-meta').innerText.split('·').pop().trim()}`);
  $('#tc-add').click(); await wait('.tc-dlg', 30);
  const f = $('.tc-dlg'); f.querySelector('[name=cat]').value = f.querySelector('[name=cat]').options[2].value;
  f.querySelector('[name=note]').value = 'Tiền điện'; f.querySelector('[name=amt]').value = '300.000';
  if (f.querySelector('[name=br]').value === '') f.querySelector('[name=br]').value = f.querySelector('[name=br]').options[1].value;
  f.querySelector('button[type=submit]').click(); await sleep(1200); await wait('.tc-r', 50);
  row = $$('.tc-r').find((x) => x.innerText.includes('Tiền điện'));
  r.push(`khoản tự tạo: ${row ? row.querySelector('.pill').innerText + ' · ' + txt('.alert') : 'KHÔNG THẤY'}`);
  if (new URLSearchParams(location.search).get('tcshot')) return;   // dừng ở trang Thu chi để chụp màn hình
  r.push(`ô tổng: ${$$('.tc-k').map((k) => k.innerText.replace(/\s+/g, ' ')).join(' | ')}`);
  $('#f-st').value = 'cho'; $('#f-st').dispatchEvent(new Event('change')); await sleep(100);
  r.push(`lọc chờ đối soát: ${txt('#f-n')}`);
  r.push(`rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`);
  location.hash = '#/quan-ly/thu-chi?xem=khoan-am'; await wait('#ka-list', 200); await sleep(300);
  r.push(`phần Khoản âm: ${txt('.tc-switch a.on')} · ${txt('#root h1:not(.x)')} · menu ${$$('.hub-tabs a.on').map((a) => a.innerText.trim())}`);
  location.hash = '#/quan-ly/khoan-am?thang=2026-10'; await sleep(1500); await wait('#ka-list', 100);
  r.push(`đường dẫn cũ khoan-am → ${location.hash}`);
  location.hash = '#/quan-ly/bao-cao-ca'; await sleep(1500);
  r.push(`đường dẫn cũ bao-cao-ca → ${location.hash} · rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`);
  out.push({ route: 'thu chi', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
