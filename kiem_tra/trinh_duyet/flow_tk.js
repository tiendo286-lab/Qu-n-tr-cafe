// Luồng tài khoản trong trang Nhân viên (role=chu): cột tài khoản, menu thao tác, cấp mật khẩu tạm, khóa, in hàng loạt, tài khoản riêng
export default async ({ visit, settle, sleep, out }) => {
  const log = (route, title, errs = []) => out.push({ route, title: String(title).slice(0, 600), len: 0, errs });
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const step = async (name, fn) => { window.__ERR.length = 0; let r = ''; try { r = await fn(); } catch (e) { window.__ERR.push('flow: ' + e.stack); } log(name, r || '', [...window.__ERR, ...$$('#root .alert.error').map((a) => 'page: ' + a.textContent.trim())]); };
  const go = async (h) => { location.hash = '#/__tam'; await settle(); await visit(h); out.pop(); for (let i = 0; i < 80 && !document.querySelector(h.includes('nhan-vien') ? '#root .emp-row' : '#root .page-head'); i++) await sleep(100); await sleep(500); };
  const firstMenu = () => $$('.emp-row:not([hidden]) .acc-menu')[0];

  await step('Menu + tab con', async () => { await go('#/quan-ly/nhan-vien'); return txt('.nav') + ' || ' + txt('.hub-tabs'); });
  await step('Ô tài khoản + nút lọc', async () => txt('.emp-row:not([hidden]) td[data-label="Tài khoản"]') + ' || ' + $$('.acc-chip').map((c) => c.innerText).join(' / ') + ' || ' + ($('#bulk-open') ? 'có nút in hàng loạt' : 'THIẾU nút in'));
  await step('Bấm chip Chưa có mật khẩu', async () => { $$('.acc-chip').find((c) => c.dataset.st === 'chua_co').click(); await sleep(200); return txt('#ef-count') + ' · lọc=' + $('#ef-state').value; });
  await step('Mở menu Tài khoản', async () => { const m = firstMenu(); m.querySelector('summary').click(); await sleep(200); return (m.open ? 'mở: ' : 'KHÔNG MỞ: ') + txt('.acc-menu[open] .acc-pop'); });
  await step('Cấp mật khẩu tạm', async () => {
    $('.acc-menu[open] .act-temp').click(); await sleep(400); const d = $('dialog[open]'); const t = d ? d.innerText.replace(/\s+/g, ' ') : 'KHÔNG HIỆN';
    d?.querySelector('button[type=submit]')?.click(); await sleep(400); await settle(); return t;
  });
  await step('Khóa tài khoản', async () => { await go('#/quan-ly/nhan-vien'); const m = firstMenu(); m.querySelector('summary').click(); await sleep(100); m.querySelector('.act-lock').click(); await sleep(400); await settle(); return txt('#root .alert') + ' · gọi: ' + JSON.stringify(window.__LOG.filter((x) => x[0] === 'fn').slice(-1)); });
  await step('In hàng loạt', async () => {
    await go('#/quan-ly/nhan-vien'); $('#bulk-open').click(); await sleep(200); const open = $('#bulk-dialog').open;
    $('#bulk-btn').click(); await sleep(600); return `hộp mở=${open} → ${txt('.main h1')} · ${$$('.slip').length} phiếu`;
  });
  await step('Tài khoản riêng', async () => { await go('#/quan-ly/nhan-vien'); const sec = $$('section.card').find((s) => s.innerText.includes('Tài khoản riêng')); return sec ? sec.innerText.replace(/\s+/g, ' ').slice(0, 300) : 'KHÔNG CÓ'; });
  await step('Đường dẫn cũ #/quan-ly/tai-khoan', async () => { await go('#/quan-ly/tai-khoan'); return document.title; });
};
