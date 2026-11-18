// Bước 118: nhân viên có thêm quyền Kế toán — nút đổi màn nhân viên ⇄ màn kế toán. role=nvkt (máy tính và test/phone.html)
export default async ({ sleep, out }) => {
  const $ = (q) => document.querySelector(q), $$ = (q) => [...document.querySelectorAll(q)];
  const wait = async (sel, n = 120) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); if (!$(sel)) throw new Error('Không thấy ' + sel); };
  const r = []; let fail = null;
  const check = (ok, m) => { if (!ok) throw new Error(m); r.push(m); };
  try {
    try { localStorage.removeItem('ktMode'); } catch (_) { /* bỏ qua */ }
    location.hash = '#/order'; await wait('.mobile'); await sleep(500);
    check(!!$('.mobile .kt-switch') && !$('.layout'), 'Màn nhân viên có nút "Sang màn Kế toán"');
    $('.kt-switch').click(); await wait('.layout .sidebar'); await sleep(800);
    const menu = $$('.sidebar .nav a').map((a) => a.textContent.trim());
    check(location.hash.startsWith('#/hom-nay') && menu.some((t) => /Kế toán/i.test(t)), 'Bấm → màn kế toán (menu có Kế toán), mở Việc hôm nay: ' + menu.join(', '));
    location.hash = '#/ke-toan/fabi'; await sleep(1500);
    check(/File ca Fabi/.test(document.title) && !!$('.layout'), 'Vào được File ca Fabi trong màn kế toán');
    location.hash = '#/ke-toan/chuyen-khoan'; await sleep(1500);
    check(/Chuyển khoản thực nhận/.test(document.title), 'Vào được Chuyển khoản thực nhận');
    check(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, 'Màn kế toán không tràn ngang');
    check(!!$('.kt-back'), 'Màn kế toán có nút "Về màn nhân viên"');
    $('.kt-back').click(); await wait('.mobile'); await sleep(500);
    check(location.hash.startsWith('#/hom-nay') && !!$('.mobile .kt-switch'), 'Bấm → quay về màn nhân viên (Việc hôm nay)');
  } catch (e) { fail = e.message; r.push('FAIL: ' + e.message); }
  out.push({ route: 'kt118', title: r.join(' | '), errs: [...(window.__ERR || []), ...(fail ? [fail] : [])] });
};
