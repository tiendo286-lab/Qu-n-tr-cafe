// Sổ quỹ (bước 72 giao diện mới): 1 cơ sở (không "Tất cả"), 5 ô số, số dư đầu, nhập bù theo ngày, phiếu rút (chờ → Chủ đã nhận → khoá),
// luân chuyển quỹ TM ↔ TK, kiểm quỹ + Điều chỉnh, nhắc kiểm quỹ quá 7 ngày, nhắc vượt 20 triệu, sổ chi tiết theo ngày.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const kpi = () => $$('.sq-k').map((k) => k.innerText.replace(/\s+/g, ' ')).slice(0, 2).join(' | ');
  const r = []; window.confirm = () => true;
  const dlg = () => $('dialog[open]');
  const reload = async () => { await sleep(1200); await wait('.sq-k', 100); };
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
  location.hash = '#/quan-ly/so-quy'; await wait('.sq-k', 200); await sleep(300);
  r.push(`menu: ${$$('.hub-tabs a').map((a) => a.innerText.trim()).join(' · ')} · cơ sở: ${$$('.branch-tabs a').map((a) => a.innerText.trim()).join(',')} · có Tất cả: ${$$('.branch-tabs a').some((a) => a.innerText.includes('Tất cả'))} · đang xem ${txt('.sq-bar .branch-tabs a.on')}`);
  location.hash = '#/quan-ly/so-quy?cn=1'; await wait('.sq-k', 200); await sleep(300);
  r.push(`LHP ban đầu: ${kpi()} · 5 ô: ${$$('.sq-k span').map((x) => x.innerText.trim()).join(' / ')} · nhắc: ${txt('.alert.warn').slice(0, 80)}`);
  $('#sq-open').click(); await wait('dialog[open]', 30); $('[name=tm]', dlg()).value = '500.000'; $('button[type=submit]', dlg()).click(); await reload();
  r.push(`số dư đầu 500k: ${kpi()}`);
  $$('.sq-day[data-m=tien_mat]').pop().click(); await wait('dialog[open]', 30); $('[name=amt]', dlg()).value = '3.000.000'; $('[name=note]', dlg()).value = 'nhập bù'; $('button[type=submit]', dlg()).click(); await reload();
  r.push(`nhập bù ngày đầu 3tr: ${kpi()}`);
  $('#sq-new').click(); await wait('dialog[open]', 30); await sleep(300);
  r.push(`phiếu rút mở: ${txt('#sq-bal')}`);
  $('[name=amt]', dlg()).value = '2.000.000'; $('[name=note]', dlg()).value = 'QL giao'; $('button[type=submit]', dlg()).click(); await reload();
  r.push(`rút 2tr: ${kpi()} · ${txt('.sq-it .pill')}`);
  $('.sq-wed').click(); await wait('dialog[open]', 30); await sleep(200);
  $('input[name=k][value=cuoi_thang]', dlg()).click(); $('input[name=k][value=cuoi_thang]', dlg()).dispatchEvent(new Event('change', { bubbles: true })); await sleep(400);
  r.push(`đổi sang rút cuối tháng → tự điền ${$('[name=amt]', dlg()).value}`);
  $('button[type=submit]', dlg()).click(); await reload();
  r.push(`sau rút hết: ${kpi()}`);
  $('.sq-ok').click(); await reload();
  r.push(`Chủ bấm Đã nhận: ${txt('.sq-it .pill')} · nút Sửa còn: ${!!$('.sq-wed')}`);
  // luân chuyển quỹ
  $$('.sq-day[data-m=tien_mat]')[0].click(); await wait('dialog[open]', 30); $('[name=amt]', dlg()).value = '6.000.000'; $('button[type=submit]', dlg()).click(); await reload();
  $('#sq-move').click(); await wait('dialog[open]', 30); await sleep(200);
  r.push(`hộp luân chuyển: ${txt('dialog[open] h2')}`);
  $('[name=amt]', dlg()).value = '5.000.000'; $('[name=note]', dlg()).value = 'gửi ngân hàng'; $('button[type=submit]', dlg()).click(); await reload();
  r.push(`sau luân chuyển 5tr TM → TK: ${kpi()} · khối: ${txt('.sq-side .sq-sec:nth-child(3) .sq-it')}`);
  // kiểm quỹ + điều chỉnh
  $('#sq-count').click(); await wait('dialog[open]', 30); await sleep(300);
  $('[name=amt]', dlg()).value = '100.000'; $('[name=amt]', dlg()).dispatchEvent(new Event('input')); await sleep(100);
  const cmp = txt('#sq-cmp'); $('button[type=submit]', dlg()).click(); await sleep(300);
  const err = txt('dialog[open] .sq-err');
  $('[name=note]', dlg()).value = 'thiếu tiền lẻ'; $('button[type=submit]', dlg()).click(); await reload();
  r.push(`kiểm quỹ: ${cmp} · không lý do: "${err}" → ${txt('.alert')} · ô kiểm quỹ: ${txt('.sq-k:last-child')}`);
  $('.sq-adjb').click(); await wait('dialog[open] form', 30); await sleep(300);
  r.push(`hộp điều chỉnh: ${txt('dialog[open] .st-meta')}`.slice(0, 200));
  $('button[type=submit]', dlg()).click(); await sleep(300); r.push(`không chọn nhóm: ${txt('dialog[open] .sq-err')}`);
  const sel = $('[name=cat]', dlg()); sel.value = sel.options[1]?.value || ''; $('button[type=submit]', dlg()).click(); await reload();
  r.push(`sau điều chỉnh: ${txt('.sq-adj')} · còn nút: ${!!$('.sq-adjb')}`);
  $$('.sq-lt')[1].click(); await sleep(100);
  r.push(`sổ chi tiết TK: ${$$('#sq-led .sq-led').length} dòng · ${$$('#sq-led .sq-led').map((x) => x.innerText.replace(/\s+/g, ' ')).slice(0, 2).join(' | ')}`);
  $$('.sq-lt')[0].click(); await sleep(100);
  r.push(`sổ chi tiết TM: ${$$('#sq-led .sq-led').length} dòng · ngày: ${$$('#sq-led .sq-dh').length}`);
  $$('.sq-day[data-m=tien_mat]')[0].click(); await wait('dialog[open]', 30); $('[name=amt]', dlg()).value = '30.000.000'; $('button[type=submit]', dlg()).click(); await reload();
  r.push(`quỹ > 20tr: ${txt('.alert.error').slice(0, 90)}`);
  if (new URLSearchParams(location.search).get('sqshot')) return;   // dừng ở trang Sổ quỹ để chụp màn hình
  r.push(`rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`);
  out.push({ route: 'sổ quỹ', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
