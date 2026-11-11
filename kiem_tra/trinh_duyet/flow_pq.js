// Bước 40: quyền Kế toán cộng thêm (trang Phân quyền) + chân trang nhân viên có Công của tôi / Điểm đánh giá
// + nút "Cấp lại mật khẩu" ở trang Phân quyền và trang sửa nhân viên
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
      window.confirm = () => true;
      location.hash = '#/quan-ly/phan-quyen'; await wait('.kt-box'); await sleep(500);
      const b = $('.kt-box'); b.checked = true; b.dispatchEvent(new Event('change')); await sleep(800);
      r.push(`Phân quyền: ô Kế toán ${$$('.kt-box').length} · tích → ${JSON.stringify(await rpc('app_account_perms'))} · ${$('#saved-indicator')?.innerText} · ${W()}`);
      const pw = $$('.act-temp'); const n0 = window.__LOG.filter((x) => x[0] === 'fn').length;
      pw[0].click(); await sleep(800);
      const fn = window.__LOG.filter((x) => x[0] === 'fn');
      r.push(`Phân quyền: nút mật khẩu ${pw.length} (${[...new Set(pw.map((x) => x.innerText.trim()))].join('/')}) · bấm → gọi ${fn.length - n0 ? JSON.stringify(fn.at(-1)[1]) : 'KHÔNG'} · hộp: ${$('dialog[open] .temp-pass')?.innerText || 'KHÔNG'}`);
      $$('dialog').forEach((d) => d.remove());
      location.hash = '#/quan-ly/nhan-vien'; await wait('.emp-name'); await sleep(500);
      const link = $$('a.emp-name').find((a) => a.closest('tr').querySelector('.acc-menu'));
      location.hash = link.getAttribute('href'); await wait('#emp-form'); await sleep(500);
      const fb = $('#root .act-temp');
      r.push(`Sửa NV: khung tài khoản ${fb ? 'có nút "' + fb.innerText.trim() + '"' : 'KHÔNG'} · ${W()}`);
      if (fb) { fb.click(); await sleep(800); r.push(`Sửa NV bấm → hộp: ${$('dialog[open] .temp-pass')?.innerText || 'KHÔNG'}`); $$('dialog').forEach((d) => d.remove()); }
    }
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'quyền kế toán + mật khẩu', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
