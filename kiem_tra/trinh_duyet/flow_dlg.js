// Mọi khung nổi (hộp thoại) vừa màn hình: không cuộn ngang, không phần tử nào lòi ra ngoài khung — chạy cả máy tính và test/phone.html
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s);
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const r = [];
  const CASES = [
    ['Cài đặt chốt tháng', '#/quan-ly/chot-thang', '#ct-set'],
    ['Thêm khoản thu chi', '#/quan-ly/thu-chi', '#tc-add'],
    ['Phiếu rút quỹ', '#/quan-ly/so-quy?cn=1', '#sq-new'],
    ['Kiểm quỹ', '#/quan-ly/so-quy?cn=1', '#sq-count'],
    ['Thêm việc', '#/quan-ly/giao-viec', '#v-add'],
    ['Tạo phiếu đào tạo', '#/quan-ly/nhan-vien', '.new-dt'],
    ['Đánh giá nhân viên', '#/quan-ly/danh-gia', '.dg-row'],
    ['Hướng dẫn đào tạo', '#/dao-tao/phieu?id=1', '.it-guide'],
  ];
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
  for (const [label, hash, sel] of CASES) {
    try {
      location.hash = '#/__tam'; await sleep(200); location.hash = hash;
      if (!(await wait(sel, 900))) { r.push(`${label}: KHÔNG THẤY NÚT`); continue; }
      await sleep(500); $(sel).click();
      for (let i = 0; i < 100 && !document.querySelector('dialog[open]'); i++) await sleep(100);
      await sleep(900);
      const d = [...document.querySelectorAll('dialog[open]')].pop();
      if (!d) { r.push(`${label}: KHÔNG MỞ`); continue; }
      const R = d.getBoundingClientRect(); const vw = document.documentElement.clientWidth;
      const bad = [...d.querySelectorAll('*')].filter((el) => el.getClientRects().length).filter((el) => { const x = el.getBoundingClientRect(); return x.width > 0 && (x.right > R.right + 1 || x.left < R.left - 1); })
        .map((el) => el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : '')).slice(0, 3);
      r.push(`${label}: khung ${Math.round(R.width)}/${vw}px${R.right > vw + 1 || R.left < -1 ? ' RA NGOÀI MÀN HÌNH' : ''} · cuộn ngang ${d.scrollWidth > d.clientWidth + 1 ? 'CÓ' : 'không'} · tràn: ${bad.join(', ') || 'không'}`);
      document.querySelectorAll('dialog').forEach((x) => { if (x.open) x.close(); x.remove(); });
    } catch (e) { r.push(`${label}: LỖI ${e.message}`); }
  }
  out.push({ route: 'khung nổi', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
