// Bước 40: quyền Kế toán cộng thêm (trang Phân quyền) + chân trang nhân viên có Công của tôi / Điểm đánh giá
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 900) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => { const w = document.documentElement.clientWidth; return `rộng ${w}/${document.documentElement.scrollWidth}`; };
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar, #root .m-foot', 600); await sleep(1500);
    const { rpc } = await import('../js/sb.js');
    if ((await rpc('app_me')).role === 'nv') {
      location.hash = '#/__tam'; await sleep(200); location.hash = '#/lich'; await wait('.m-foot'); await sleep(800);
      r.push(`NV chân trang: ${$$('.m-foot a').map((a) => a.innerText.trim()).join(' | ')} · ${W()}`);
    } else {
      location.hash = '#/quan-ly/phan-quyen'; await wait('.kt-box'); await sleep(500);
      const b = $('.kt-box'); b.checked = true; b.dispatchEvent(new Event('change')); await sleep(800);
      r.push(`Phân quyền: ô Kế toán ${$$('.kt-box').length} · tích → ${JSON.stringify(await rpc('app_account_perms'))} · ${$('#saved-indicator')?.innerText} · ${W()}`);
    }
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'quyền kế toán', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
