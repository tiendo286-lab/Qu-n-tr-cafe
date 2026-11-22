// Chặng 4 (anh Tiến chốt 22/11): danh sách Hàng hoá › Đối soát chỉ dành cho người có quyền Đối soát. Người khác (nhân viên, kế toán)
// gõ thẳng địa chỉ #/hang-hoa/doi-soat thì về Nhận hàng. Chạy role=nv | kt | ql | chu (index.html và test/phone.html).
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s);
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
  try {
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/hang-hoa/doi-soat?cn=1'; await sleep(2500);
    const h = location.hash; const ds = role === 'ql' || role === 'chu';
    if (ds) ok(h.startsWith('#/hang-hoa/doi-soat') && !!$('.gh-tabs'), `${role}: có quyền Đối soát → vẫn thấy danh sách Đối soát (${h})`);
    else ok(h.startsWith('#/hang-hoa/nhan') && !/Bạn không có quyền/.test($('#root')?.innerText || ''), `${role}: gõ địa chỉ Đối soát → về Nhận hàng (${h})`);
    ok(!document.querySelector('#root .alert.error:not([hidden])'), `${role}: không báo lỗi`);
    if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `${role}: không tràn ngang`);
  } catch (e) { bad.push('LỖI CHẠY: ' + (e?.message || e)); }
  out.push({ hh_c4: { ok: good, fail: bad } });
};
