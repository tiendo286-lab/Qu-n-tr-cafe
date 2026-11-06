// Luồng Công việc: role=chu (giao việc, họp, yêu cầu làm lại) · role=ql / role=nv (nhắc việc, Nhận việc → Đã xử lý)
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
    await step('Không vào được Giao việc', async () => { await go('#/quan-ly/giao-viec'); return document.title + ' · ' + txt('#root .card'); });
    return;
  }
  await step('Menu Công việc', async () => { await go('#/quan-ly/giao-viec'); return txt('.hub-tabs') + ' || ' + txt('.tabs-nav'); });
  await step('Giao việc thiếu người nhận', async () => {
    const f = $('#add-task'); f.content.value = 'Thử'; f.assignee.value = ''; const ok = f.checkValidity(); return ok ? 'KHÔNG CHẶN' : 'trình duyệt chặn: thiếu người nhận';
  });
  await step('Giao việc cho nhân viên (không hạn)', async () => {
    const f = $('#add-task'); f.content.value = 'Kiểm tra camera'; f.assignee.value = '3'; f.requestSubmit(); await sleep(400); await settle();
    return location.hash + ' · ' + txt('#root .alert') + ' · ' + txt('.tabs-nav') + ' · ' + $$('.tk .tk-top').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / ');
  });
  await step('Lọc theo người nhận', async () => { const a = txt('#f-count'); setv($('#f-ass'), '3'); return `${a} → người 3: ${txt('#f-count')}`; });
  await step('Đổi người nhận', async () => {
    const t = $$('.tk').find((c) => c.innerText.includes('Kiểm tra camera')); const s = t.querySelector('select[data-f=assignee_id]'); setv(s, '6'); await sleep(400); await settle();
    return $$('.tk .tk-top').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / ');
  });
  await step('Tab Đã xử lý + yêu cầu làm lại', async () => {
    await go('#/quan-ly/giao-viec?tab=da-xu-ly'); const before = $$('.tk').length;
    const c = $('.tk'); c.querySelector('.tk-reopen').click(); await sleep(200); const err = txt('#saved-indicator');
    setv(c.querySelector('.tk-note'), 'Còn 1 bóng chưa sáng'); c.querySelector('.tk-reopen').click(); await sleep(400); await settle();
    return `${before} việc · thiếu lý do: "${err}" → ${txt('#root .alert')} · ${txt('.tabs-nav')}`;
  });
  await step('Họp: danh sách', async () => { await go('#/quan-ly/hop'); return txt('table tbody'); });
  await step('Họp: đưa bàn giao vào + giao cho nhân viên', async () => {
    await go('#/quan-ly/hop/chi-tiet?id=1');
    $('.ho-cb').checked = true; $('#ho-add').click(); await sleep(400); await settle();
    const t = $$('.tk').find((c) => c.querySelector('.tk-top .pill')?.innerText === 'Chưa giao'); const sel = t.querySelector('select[data-f=assignee_id]');
    const groupsTxt = [...sel.querySelectorAll('optgroup')].map((g) => g.label).join(',');
    setv(sel, '3'); await sleep(400); await settle();
    return 'nhóm người nhận: ' + groupsTxt + ' | ' + $$('.tk .tk-top').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / ');
  });
};
