// Khoản âm nối với ca (Việc hôm nay đợt 2, 27/11/2026): mỗi khoản âm có đường mở đúng phiếu chốt ca phát sinh.
// Chạy trên web dựng ĐỦ dữ liệu (có phiếu ca), role=nv (hoặc ql), index.html và test/phone.html.
import { rpc } from '../js/sb.js';
export default async ({ visit, sleep, out }) => {
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const q = (s, r = document) => r.querySelector(s);
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const fits = () => document.documentElement.scrollWidth <= innerWidth + 1;
  try {
    const rid = await rpc('app__test_ka_add', { p_amount: 25000 });
    const want = '#/ca/phieu?id=' + rid;
    await visit('#/cua-toi/khoan-am'); await sleep(300);
    const a1 = q('.ka-c .ka-ca');
    ok(!!a1 && a1.getAttribute('href') === want && /Xem phiếu ca/i.test(txt(a1)), 'Khoản âm của tôi: thẻ khoản âm có nút "Xem phiếu ca …" tới đúng phiếu — ' + (a1?.getAttribute('href') || 'không có'));
    ok(fits(), 'Khoản âm của tôi không tràn ngang');
    await visit('#/hom-nay'); await sleep(400);
    const row = q('#hn-luong .hn-ka'); const a2 = q('#hn-luong .hn-ka .hn-ka-ca');
    if (row) ok(!!a2 && a2.getAttribute('href') === want, 'Việc hôm nay › Bảng lương: dòng khoản âm có "Xem ca ›" tới đúng phiếu');
    else ok(true, '(khoản âm thử không thuộc tháng đang xem ở Bảng lương — bỏ qua dòng này)');
    ok(fits(), 'Việc hôm nay không tràn ngang');
    await visit('#/cua-toi/cong'); await sleep(300);
    const a3 = q('#cg-ka .ka-ca');
    if (q('#cg-ka .ka-c')) ok(!!a3 && a3.getAttribute('href') === want, 'Công của tôi: khoản âm trong tháng có nút Xem phiếu ca');
    // bấm thật: mở được phiếu ca, không báo lỗi quyền
    await visit('#/cua-toi/khoan-am'); await sleep(300);
    q('.ka-c .ka-ca').click(); await sleep(1200);
    const body = txt(document.getElementById('root'));
    ok(location.hash.startsWith(want) && !/không có quyền|Không tìm thấy/i.test(body), 'bấm vào: mở phiếu chốt ca của ca đó, không báo lỗi');
    ok(fits(), 'phiếu ca không tràn ngang');
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.stack || e.message)); }
  out.push({ ka_ca: { ok: good, fail: bad } });
};
