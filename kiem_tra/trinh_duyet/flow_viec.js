// Luồng Công việc: role=chu (Cần xử lý → giao, các tab trạng thái, yêu cầu làm lại) · role=ql / role=nv (nhắc việc, Nhận việc → Đã xử lý)
export default async ({ visit, settle, sleep, out }) => {
  const q = new URLSearchParams(location.search);
  const log = (route, title, errs = []) => out.push({ route, title: String(title).slice(0, 600), len: 0, errs });
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const step = async (name, fn) => { window.__ERR.length = 0; let r = ''; try { r = await fn(); } catch (e) { window.__ERR.push('flow: ' + e.stack); } log(name, r || '', [...window.__ERR, ...$$('#root .alert.error').map((a) => 'page: ' + a.textContent.trim())]); };
  const go = async (h) => { location.hash = '#/__tam'; await settle(); await visit(h); out.pop(); for (let i = 0; i < 50 && !document.querySelector('#root .page-head, #root h1'); i++) await sleep(100); await sleep(300); };
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const groups = () => $$('h2.tk-group').map((h) => h.innerText).join(' | ');

  if (q.get('role') === 'ql' || q.get('role') === 'nv') {
    await step('Hộp nhắc việc khi mở app', async () => { await sleep(300); const d = $('dialog[open]'); const t = d ? d.innerText.replace(/\s+/g, ' ') : 'KHÔNG HIỆN'; d?.querySelector('#rm-close').click(); return t; });
    await step('Menu / thanh dưới', async () => (q.get('role') === 'nv' ? txt('.tabbar') : txt('.nav') + ' || tab con: ' + txt('.hub-tabs')));
    await step('Việc của tôi', async () => { await go('#/viec'); return groups(); });
    await step('Nhận việc', async () => { $('.tk-start').click(); await sleep(400); await settle(); return txt('#root .alert') + ' | ' + groups(); });
    await step('Báo đã xử lý (có ghi kết quả)', async () => {
      const card = $$('.tk').find((c) => c.querySelector('.tk-submit'));
      setv(card.querySelector('.tk-rep'), 'Xong rồi'); card.querySelector('.tk-submit').click(); await sleep(400); await settle();
      return txt('#root .alert') + ' | ' + groups() + ' | ' + ($$('.tk-report').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / '));
    });
    await step('Không vào được trang Công việc của chủ', async () => { await go('#/quan-ly/giao-viec'); return document.title + ' · ' + txt('#root .card'); });
    return;
  }
  await step('Menu + tab Cần xử lý', async () => { await go('#/quan-ly/giao-viec'); return txt('.nav') + ' || ' + txt('.hub-tabs') + ' || ' + txt('.tabs-nav') + ' || ' + $$('.pend .tk-content').map((x) => x.innerText).join(' / '); });
  await step('Giao 1 mục bàn giao (chưa chọn người thì báo)', async () => {
    const c = $$('.pend').find((x) => x.innerText.includes('Máy xay')); c.querySelector('.as-go').click(); await sleep(200); const err = txt('#saved-indicator');
    setv(c.querySelector('.as-who'), '3'); c.querySelector('.as-go').click(); await sleep(400); await settle();
    return `"${err}" → ${txt('#root .alert')} · ${txt('.tabs-nav')}`;
  });
  await step('Đã xong không cần giao', async () => { $$('.pend').find((x) => x.innerText.includes('giấy in')).querySelector('.ho-close').click(); await sleep(400); await settle(); return txt('#root .alert') + ' · ' + txt('.tabs-nav'); });
  await step('Thêm việc giao sau, rồi giao', async () => {
    const f = $('#add-task'); f.content.value = 'Kiểm tra camera'; f.assignee.value = ''; f.requestSubmit(); await sleep(400); await settle();
    const a = txt('#root .alert') + ' · ' + txt('.tabs-nav');
    const c = $$('.pend').find((x) => x.innerText.includes('camera')); setv(c.querySelector('.as-who'), '5'); setv(c.querySelector('.as-due'), '2030-01-01'); c.querySelector('.as-go').click(); await sleep(400); await settle();
    return a + ' → ' + txt('#root .alert') + ' · ' + txt('.tabs-nav');
  });
  await step('Thêm việc giao ngay', async () => { const f = $('#add-task'); f.content.value = 'Lau bàn'; f.assignee.value = '6'; f.requestSubmit(); await sleep(400); await settle(); return txt('#root .alert') + ' · ' + txt('.tabs-nav'); });
  await step('Tab Chờ nhận + bỏ giao', async () => {
    await go('#/quan-ly/giao-viec?tab=cho-nhan'); const a = txt('#f-count');
    const c = $$('.tk').find((x) => x.innerText.includes('Lau bàn')); setv(c.querySelector('select[data-f=assignee_id]'), ''); await sleep(400); await settle();
    return `${a} → bỏ giao: ${txt('.tabs-nav')}`;
  });
  await step('Tab Đã xử lý + yêu cầu làm lại', async () => {
    await go('#/quan-ly/giao-viec?tab=da-xu-ly'); const before = $$('.tk').length;
    const c = $('.tk'); c.querySelector('.tk-reopen').click(); await sleep(200); const err = txt('#saved-indicator');
    setv(c.querySelector('.tk-note'), 'Còn 1 bóng chưa sáng'); c.querySelector('.tk-reopen').click(); await sleep(400); await settle();
    return `${before} việc · thiếu lý do: "${err}" → ${txt('#root .alert')} · ${txt('.tabs-nav')}`;
  });
  await step('Đường dẫn cũ #/quan-ly/hop', async () => { await go('#/quan-ly/hop'); return document.title; });
};
