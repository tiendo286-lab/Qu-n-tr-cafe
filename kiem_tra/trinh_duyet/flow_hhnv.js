// Bước 104: nhân viên — thẻ nhắc "có hàng kho tổng đang tới" ở mọi trang, link Nhận hàng ở chân trang, trang Nhận hàng không cần phiếu chốt ca.
// role=nv (confirm=1), chạy qua test/phone.html. Không dùng dữ liệu thật.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 1500) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = [];
  try {
    await wait('#root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const me = await rpc('app_me'); me.perms.ke_toan = true;   // tạm làm kế toán để tạo phiếu xuất thử
    await rpc('app_nh_create', { p: { branch_id: 1, doc_no: 'PXNV1', ship_at: day + ' 08:15', total: 0, lines: [{ code: 'A1', name: 'Sữa thử', unit: 'Hộp', qty: 3, price: 0, amount: 0 }] } });
    delete me.perms.ke_toan;
    location.hash = '#/lich'; await sleep(62000); location.hash = '#/order'; await wait('.content'); await sleep(2500);
    r.push(`thẻ nhắc: ${txt('.gh-banner') || 'KHÔNG'} · chân trang: ${$$('.m-foot a').map((a) => a.innerText.replace(/\s+/g, ' ')).filter((t) => /Nhận hàng|Kế toán/.test(t)).join(', ')} · ${W()}`);
    location.hash = '#/hang-hoa/nhan'; await wait('.gh-wrap'); await sleep(1500);
    r.push(`trang nhận: ${txt('.gh-wrap h1')} · cơ sở: ${$$('.branch-tabs a').map((a) => a.innerText.replace(/\s+/g, ' ')).join(' ') || '(1 cơ sở)'} · ${txt('.gh-hero').slice(0, 80) || txt('.gh-wrap .card').slice(0, 80)} · thẻ nhắc trên trang này ${!!$('.gh-banner')} · ${W()}`);
    $('.gh-hero .gh-big')?.click(); await wait('#gh-recv .gh-prog'); await sleep(1000);
    r.push(`mở nhận: ${txt('#gh-recv h1')} · ${txt('.gh-prog')} · nút chụp ${!!$('#gh-shot')} · ${W()}`);
    if (new URLSearchParams(location.search).get('dung')) { await new Promise(() => {}); }
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'hàng hoá nhân viên 104', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
