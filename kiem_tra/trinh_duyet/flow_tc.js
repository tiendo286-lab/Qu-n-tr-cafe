// Quản lý ca › Thu chi (bước 69 giao diện mới): khoản phiếu ca chờ đối soát → đối soát ở trang Đối soát; quản lý tự tạo khoản (nhóm bắt buộc);
// 6 ô số; 1 cơ sở (không "Tất cả"); lọc nhanh; Chi theo loại; cài đặt loại & nhóm; đường dẫn cũ.
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (s, el) => ((el || document).querySelector(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const { sb } = await import('../js/sb.js');
  const r = []; window.confirm = () => true;
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  await sb.from('shift_reports').insert({ id: 9901, branch_id: 1, work_date: today, shift: 'Sáng', status: 'hoan_thanh', recon_status: 'chua', total_revenue: 1000000 });
  await sb.from('shift_report_moves').insert([{ id: 99011, report_id: 9901, kind: 'tien_mat', amount: -50000, note: 'Mua đá', sort_order: 1 },
    { id: 99012, report_id: 9901, kind: 'tien_mat', amount: 20000, note: 'Bán bã cafe', sort_order: 2 }]);
  location.hash = '#/quan-ly/thu-chi?cn=1'; await wait('.tc-r.todo', 900); await sleep(400);
  r.push(`menu Quản lý ca: ${$$('.hub-tabs a').map((a) => a.innerText.trim()).join(' · ')}`);
  r.push(`ban đầu: ${$$('.tc-r').length} dòng, chờ: ${$$('.tc-r.todo').length} · ô Đã đối soát: ${txt('#k-ds')} · cơ sở: ${$$('.branch-tabs a').map((a) => a.innerText.trim()).join(',')} (có Tất cả: ${$$('.branch-tabs a').some((a) => a.innerText.includes('Tất cả'))})`);
  r.push(`6 ô: ${$$('.tc-kpi .k').map((k) => k.innerText.trim()).join(' · ')} · ô tích trống: ${$$('.tc-r.todo .tc-ok.n').length} · ngày: ${$$('.tc-dh').map((d) => d.innerText.replace(/\s+/g, ' ')).join(' | ')}`);
  // đối soát dòng thu chi ở trang Đối soát (gom việc)
  location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat'; await wait('.dt-r.todo', 900); await sleep(400);
  r.push(`trang Đối soát: ${$$('.td-k').map((k) => k.innerText.replace(/\s+/g, ' ')).join(' | ')}`);
  let row = $$('.dt-r.todo').find((x) => x.innerText.includes('Mua đá'));
  row.querySelector('.dt-ok').click(); await sleep(400);
  r.push(`đối soát khi chưa chọn nhóm: ${txt('#saved-indicator') || '(không báo)'}`);
  const sel = row.querySelector('.dt-cat'); sel.value = sel.options[1].value; row.querySelector('.dt-ok').click(); await sleep(1500); await wait('.td-card', 300); await sleep(300);
  r.push(`sau đối soát: còn ${$$('.dt-r.todo').length} dòng chờ ở trang Đối soát`);
  location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/thu-chi?cn=1'; await wait('.tc-r', 900); await sleep(400);
  row = $$('.tc-r').find((x) => x.innerText.includes('Mua đá'));
  r.push(`sau đối soát "Mua đá": ô ${row.querySelector('.tc-ok').innerText || 'trống'} · ${txt('.tc-x', row)}`);
  $('#tc-add').click(); await wait('.tc-dlg', 30);
  const f = $('.tc-dlg');
  r.push(`khung thêm: ${txt('h2', f)} · loại ${$$('[name=kind]').map((x) => x.value).join('/')} · nhãn nhóm "${txt('label.field span', f.querySelectorAll('label.field')[1])}"`);
  f.querySelector('[name=note]').value = 'Tiền điện'; f.querySelector('[name=amt]').value = '300.000'; f.querySelector('[name=pay][value=chuyen_khoan]').checked = true;
  f.querySelector('button[type=submit]').click(); await sleep(400);
  r.push(`lưu khi chưa chọn nhóm: ${txt('#tc-err')}`);
  f.querySelector('[name=cat]').value = f.querySelector('[name=cat]').options[2].value;
  f.querySelector('button[type=submit]').click(); await sleep(1200); await wait('.tc-r', 50);
  row = $$('.tc-r').find((x) => x.innerText.includes('Tiền điện'));
  r.push(`khoản tự tạo: ${row ? (row.querySelector('.tc-ok').innerText || 'trống') + ' · ' + txt('.tc-x', row) + ' · ' + txt('.alert') : 'KHÔNG THẤY'}`);
  if (new URLSearchParams(location.search).get('tcshot')) return;   // dừng ở trang Thu chi để chụp màn hình
  r.push(`ô Thu / Chi: ${txt('#k-thu')} | ${txt('#k-chi')}`);
  r.push(`nhãn dòng: ${$$('.tc-r').map((x) => x.querySelector('.tc-pm')?.innerText + ' ' + x.querySelector('strong').innerText).join(', ')}`);
  $('.tc-chip[data-q="ck"]').click(); await sleep(150); r.push(`lọc CK: ${txt('#f-n')} · nút sáng ${$('.tc-chip[data-q="ck"]').getAttribute('aria-pressed')}`);
  $('.tc-chip[data-q="tm"]').click(); await sleep(150); r.push(`bấm TM: ${txt('#f-n')}`); $('.tc-chip[data-q="all"]').click(); await sleep(100);
  // bước 57 + 69: loại › nhóm, so tháng trước
  r.push(`Chi theo loại: ${txt('.tc-side .tc-sc:nth-child(2)')}`.slice(0, 300));
  r.push(`dòng ghi nhóm: ${$$('.tc-r .tc-c').map((b) => b.innerText).join(' | ')}`);
  $$('[data-ft]').find((b) => b.dataset.ft)?.click(); await sleep(150); r.push(`bấm loại "${txt('.tc-tyb[aria-pressed="true"] .grow')}": ${txt('#f-n')} · ô lọc Loại = ${$('#f-type').selectedOptions[0]?.text}`);
  $('.tc-chip[data-q="all"]').click(); await sleep(100);
  location.hash = '#/cai-dat/thu-chi'; await wait('.tc-tb', 100); await sleep(400);
  r.push(`Cài đặt loại & nhóm: ${txt('#root h1')} · menu ${txt('.hub-tabs a.on')} · ${$$('.tc-tb').length} khối · ${$$('.tc-tb').map((b) => b.querySelector('.tc-th').innerText.replace(/\s+/g, ' ').trim()).join(' / ')}`);
  { const rw = $$('.tc-cr').find((x) => x.querySelector('.tc-cn').value === 'Marketing'); const s2 = rw.querySelector('.tc-ct'); s2.value = s2.options[2].value; $('#tc-save').click(); await sleep(1200); await wait('.tc-tb', 100); await sleep(300);
    r.push(`chuyển Marketing → ${$$('.tc-tb').find((b) => [...b.querySelectorAll('.tc-cn')].some((i) => i.value === 'Marketing'))?.querySelector('.tc-tn')?.value} · ${txt('.alert')}`); }
  location.hash = '#/quan-ly/thu-chi'; await wait('.tc-r', 300); await sleep(400);
  r.push(`mở lại không có cn → nhớ cơ sở: ${txt('.branch-tabs a.on')}`);
  $('.tc-chip[data-q="cho"]').click(); await sleep(100);
  r.push(`lọc chưa đối soát: ${txt('#f-n')}`);
  r.push(`rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`);
  location.hash = '#/quan-ly/thu-chi?xem=khoan-am'; await wait('.tc-kpis', 200); await sleep(300);
  r.push(`đường dẫn Khoản âm cũ → lọc: ${$('#f-src').value} · ${txt('#root h1:not(.x)')} · menu ${$$('.hub-tabs a.on').map((a) => a.innerText.trim())}`);
  location.hash = '#/quan-ly/khoan-am?thang=2026-10'; await sleep(1500); await wait('.tc-kpis', 100);
  r.push(`đường dẫn cũ khoan-am → ${location.hash}`);
  location.hash = '#/quan-ly/bao-cao-ca'; await sleep(1500);
  r.push(`đường dẫn cũ bao-cao-ca → ${location.hash} · rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`);
  out.push({ route: 'thu chi', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
