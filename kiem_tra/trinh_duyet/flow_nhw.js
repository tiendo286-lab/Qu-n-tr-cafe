// Bước 102: Hoá đơn giao hàng — chọn 1 cơ sở, xem Tuần | Tháng (máy tính: cột ngày; điện thoại: dải ngày). role=chu (confirm=1)
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    await rpc('app_nh_create', { p: { branch_id: 1, doc_no: 'PXW001', ship_at: day + ' 08:00', total: 2150000, lines: [{ code: 'A1', name: 'Sữa đặc', unit: 'Hộp', qty: 10, price: 215000, amount: 2150000 }] } });
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/ke-toan/hoa-don?cn=1'; await wait('.nhw-bar', 1500); await sleep(1200);
    r.push(`ROOT: ${txt('#root').slice(0, 300)} · LỖI: ${(window.__ERR || []).join(' / ').slice(0, 400)}`);
    r.push(`trang: ${txt('#root h1')} · lỗi trang ${txt('#root .alert.error') || 'không'} · nút tải ${!!$('#nh-file')} · cơ sở ${txt('.branch-tabs a.on')} · cách xem ${txt('.nhw-view a.on')} · ${txt('.nhw-nav strong')}`);
    r.push(`bố cục ${$('.nhw-grid') ? 'CỘT NGÀY' : $('.nhw-days') ? 'DẢI NGÀY' : 'KHÔNG RÕ'} · dải: ${$$('.nhw-d').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ')} · thẻ: ${$$('.nhw-day:not([hidden]) .nhw-c, .nhw-grid .nhw-c').map((x) => x.innerText.replace(/\s+/g, ' ').slice(0, 80)).join(' / ')}`);
    r.push(`ô: ${$$('.nhw-k').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ')} · ${W()}`);
    $('.nhw-c .nh-view')?.click(); await wait('dialog[open]', 30); r.push(`Xem: ${txt('dialog[open] h2').slice(0, 80) || txt('dialog[open]').slice(0, 80)}`); $('dialog[open]')?.close();
    $$('.nhw-view a')[1].click(); await sleep(400); await wait('.nhw-bar', 1500); await sleep(1200);
    r.push(`Tháng: ${txt('.nhw-view a.on')} · ${txt('.nhw-nav strong')} · lọc ${!!$('#nh-st')} · ${txt('.card-head h2')} · dòng ${$$('.nh-list tbody tr').length} · ${W()}`);
    if (new URLSearchParams(location.search).get('dung')) { location.hash = '#/ke-toan/hoa-don?cn=1'; await sleep(2500); window.scrollTo(0, 0); await new Promise(() => {}); }
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'hoá đơn giao hàng tuần / tháng', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
