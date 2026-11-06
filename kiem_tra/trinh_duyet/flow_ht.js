// Luồng Yêu cầu hỗ trợ: role=nv (tạo, nhắn, đóng) ; role=chu (thấy mọi yêu cầu, trả lời)
export default async ({ visit, settle, sleep, out }) => {
  const q = new URLSearchParams(location.search);
  const log = (route, title, errs = []) => out.push({ route, title: String(title).slice(0, 500), len: 0, errs });
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const step = async (name, fn) => { window.__ERR.length = 0; let r = ''; try { r = await fn(); } catch (e) { window.__ERR.push('flow: ' + e.stack); } log(name, r || '', [...window.__ERR, ...$$('#root .alert.error').map((a) => 'page: ' + a.textContent.trim())]); };
  const go = async (h) => { location.hash = '#/__tam'; await settle(); await visit(h); out.pop(); };
  await step('Danh sách', async () => { await go('#/ho-tro'); return $$('.ht-item').length + ' yêu cầu: ' + txt('.ht-item') + (q.get('role') === 'nv' ? ' | thanh dưới: ' + txt('.tabbar') : ' | menu: ' + txt('.nav').match(/HỖ TRỢ.*$/)?.[0]); });
  await step('Tạo yêu cầu', async () => {
    $('#new-box').open = true; const f = $('#ht-new'); f.title.value = 'Xin đổi ca thứ 7'; f.body.value = 'Em xin đổi ca Sáng sang Chiều'; f.requestSubmit(); await sleep(500); await settle();
    return location.hash + ' | ' + $$('.msg').length + ' tin | ' + txt('.msg');
  });
  await step('Nhắn thêm + đánh dấu xong + nhắn lại tự mở', async () => {
    const f = $('#ht-form'); f.body.value = 'Ai đổi được thì báo em'; f.requestSubmit(); await sleep(400); await settle(); const n = $$('.msg').length;
    $('#ht-toggle').click(); await sleep(400); await settle(); const s1 = txt('.card .pill');
    $('#ht-form').body.value = 'Còn chưa được'; $('#ht-form').requestSubmit(); await sleep(500); await settle();
    return `${n} tin → xong: ${s1} → nhắn lại: ${txt('.card .pill')}, ${$$('.msg').length} tin`;
  });
  await step('Mở yêu cầu có sẵn', async () => { await go('#/ho-tro/chi-tiet?id=1'); return $$('.msg').map((m) => m.innerText.replace(/\s+/g, ' ')).join(' || '); });
};
