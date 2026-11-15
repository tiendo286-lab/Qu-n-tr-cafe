// Chụp ảnh màn hình trang Giao hàng (bước 103): &dung=nhan0 | chon | nhan1 | nhan2 | ql | ds. role=chu (confirm=1). Không dùng dữ liệu thật.
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 1500) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); };
  const setFiles = (inp, files) => { const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); };
  const hold = () => new Promise(() => {});
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
  const { rpc } = await import('../js/sb.js'); const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const ov = await rpc('app_ca_overview', { p_date: day }); const o = ov.find((x) => x.branch_id === 1);
  await rpc('app_ca_open', { p_branch: 1, p_date: day, p_shift: o.shift });
  const names = ['Sữa đặc Ông Thọ', 'Đường kính trắng', 'Cà phê bột Robusta', 'Trà đen', 'Ly nhựa 500ml', 'Ống hút'];
  const id = await rpc('app_nh_create', { p: { branch_id: 1, doc_no: 'PX0967', ship_at: day + ' 08:15', total: 2000000, lines: names.map((n, i) => ({ code: 'M' + i, name: n, unit: ['hộp', 'kg', 'gói', 'gói', 'cây', 'bịch'][i], qty: [10, 5, 2, 6, 4, 2][i], price: 1000, amount: 1000 })) } });
  const cv = document.createElement('canvas'); cv.width = 300; cv.height = 200; const g = cv.getContext('2d'); g.fillStyle = '#b08a5a'; g.fillRect(0, 0, 300, 200); g.fillStyle = '#e8d8b8'; g.fillRect(30, 40, 90, 120); g.fillRect(150, 60, 110, 90);
  const img = () => new Promise((ok) => cv.toBlob((b) => ok(new File([b], 'h.png', { type: 'image/png' })), 'image/png'));
  const D = new URLSearchParams(location.search).get('dung');
  location.hash = '#/quan-ly/giao-hang?nhan=' + id; await wait('#gh-shot'); await sleep(1200);
  if (D === 'nhan0') { window.scrollTo(0, 0); return hold(); }
  setFiles($('#gh-shot'), [await img()]); await wait('.gh-pickc'); await sleep(500);
  const tick = (i, q) => { const row = $$('.gh-sel')[i]; const c = row.querySelector('.gh-c'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); if (q) { const qi = row.querySelector('.gh-q'); qi.value = q; qi.dispatchEvent(new Event('input', { bubbles: true })); } };
  tick(0); tick(1, '4'); tick(2); await sleep(300);
  if (D === 'chon') { $('.gh-pickc').scrollIntoView(); return hold(); }
  $$('.gh-note').find((n) => !n.hidden).querySelector('input').value = 'thiếu 1 bao'; $('#gh-ps').click(); await sleep(2500);
  if (D === 'nhan1') { window.scrollTo(0, 0); return hold(); }
  setFiles($('#gh-shot'), [await img()]); await wait('.gh-pickc'); await sleep(500); tick(0); tick(1); $('#gh-ps').click(); await sleep(2500);
  $$('.gh-none')[0].click(); await wait('dialog[open] form'); const f = $$('dialog[open] form').pop(); f.nt.value = 'không có trong thùng'; f.requestSubmit(); await sleep(800);
  if (D === 'nhan2') { window.scrollTo(0, 0); return hold(); }
  $('#gh-send').click(); await sleep(3000);
  location.hash = '#/quan-ly/giao-hang?cn=1'; await wait('.gh-tabs'); await sleep(1500);
  if (D === 'ql') { window.scrollTo(0, 0); return hold(); }
  location.hash = '#/quan-ly/giao-hang?ds=' + id; await wait('.gh-pc'); await sleep(2000);
  if (D === 'ds') { window.scrollTo(0, 0); return hold(); }
  out.push({ route: 'chụp giao hàng', title: 'xong', len: 0, errs: [...window.__ERR] });
};
