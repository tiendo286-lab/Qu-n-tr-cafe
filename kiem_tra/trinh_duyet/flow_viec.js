// Luồng Họp & giao việc (role=chu) hoặc Việc của tôi + nhắc việc (role=ql)
export default async ({ visit, settle, sleep, out }) => {
  const q = new URLSearchParams(location.search);
  const log = (route, title, errs = []) => out.push({ route, title: String(title).slice(0, 500), len: 0, errs });
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const step = async (name, fn) => { window.__ERR.length = 0; let r = ''; try { r = await fn(); } catch (e) { window.__ERR.push('flow: ' + e.stack); } log(name, r || '', [...window.__ERR, ...$$('#root .alert.error').map((a) => 'page: ' + a.textContent.trim())]); };
  const go = async (h) => { location.hash = '#/__tam'; await settle(); await visit(h); out.pop(); };
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  if (q.get('role') === 'ql') {
    await step('Hộp nhắc việc khi mở app', async () => { await sleep(300); const d = $('dialog[open]'); const t = d ? d.innerText.replace(/\s+/g, ' ') : 'KHÔNG HIỆN'; d?.querySelector('#rm-close').click(); return t; });
    await step('Menu', async () => txt('.nav'));
    await step('Việc của tôi', async () => { await go('#/viec'); return [...$$('h2.tk-group')].map((h) => h.innerText).join(' | '); });
    await step('Bắt đầu xử lý + gửi báo cáo', async () => {
      $('.tk-start').click(); await sleep(400); await settle();
      const card = $$('.tk').find((c) => c.querySelector('.tk-submit') && c.innerText.includes('Sửa tủ mát'));
      setv(card.querySelector('.tk-rep'), 'Đã gọi thợ, sửa xong'); card.querySelector('.tk-submit').click(); await sleep(400); await settle();
      return txt('#root .alert') + ' | ' + [...$$('h2.tk-group')].map((h) => h.innerText).join(' | ');
    });
    await step('Không vào được Họp', async () => { await go('#/quan-ly/hop'); return document.title; });
    return;
  }
  await step('Danh sách họp', async () => { await go('#/quan-ly/hop'); return txt('.tabs-nav') + ' | ' + txt('table tbody'); });
  await step('Thêm cuộc họp', async () => {
    const f = $('#new-meeting'); f.title.value = 'Họp thử'; f.requestSubmit(); await sleep(400); await settle();
    return location.hash + ' · ' + txt('h1') + ' · bàn giao tồn: ' + $$('.ho-cb').length;
  });
  await step('Đưa bàn giao vào họp + giao việc', async () => {
    $('.ho-cb').checked = true; $('#ho-add').click(); await sleep(400); await settle();
    const t = $('.tk'); const sel = t.querySelector('select[data-f=assignee_id]'); sel.value = sel.options[1].value; sel.dispatchEvent(new Event('change')); await sleep(300); await settle();
    const t2 = $('.tk'); const due = t2.querySelector('input[data-f=due_date]'); due.value = '2030-01-01'; due.dispatchEvent(new Event('change')); await sleep(300); await settle();
    return txt('.tk .tk-top') + ' | ' + txt('.tk .st-meta');
  });
  await step('Thêm việc + giao đào tạo', async () => {
    const f = $('#add-task'); f.content.value = 'Kiểm tra camera'; f.assignee.value = f.assignee.options[1].value; f.due.value = '2030-01-02'; f.requestSubmit(); await sleep(400); await settle();
    const g = $('#add-train'); g.emp.value = $('#emp-list option').value; g.content.value = 'SOP 07'; g.requestSubmit(); await sleep(400); await settle();
    return $$('.tk').length + ' việc: ' + $$('.tk .tk-top').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / ');
  });
  await step('Chờ duyệt: làm lại thiếu ý kiến, rồi duyệt', async () => {
    await go('#/quan-ly/hop?tab=cho-duyet'); const n = $$('.rv').length;
    $('.rv-no').click(); await sleep(300); const err = txt('#saved-indicator');
    $('.rv-ok').click(); await sleep(400); await settle();
    return `${n} chờ duyệt → bấm làm lại không ý kiến: "${err}" → duyệt: ${txt('#root .alert')} | ${txt('.tabs-nav')}`;
  });
  await step('Tất cả công việc + lọc', async () => {
    await go('#/quan-ly/hop?tab=tat-ca'); const a = txt('#f-count'); setv($('#f-st'), '*'); const b = txt('#f-count'); setv($('#f-q'), 'camera'); return `${a} → tất cả ${b} → tìm "camera": ${txt('#f-count')}`;
  });
};
