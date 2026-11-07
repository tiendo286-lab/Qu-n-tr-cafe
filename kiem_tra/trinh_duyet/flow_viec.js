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
  // Tab Công việc dạng bảng: thanh trạng thái tô màu, tìm kiếm + bộ lọc, bấm từng việc mở hộp chi tiết
  const tabs = () => txt('.v-tabs');
  const rowOf = (t) => $$('.vr[data-k]').find((r) => !r.hidden && r.innerText.includes(t));
  const dlg = () => $('dialog[open]');
  const tab = async (k) => { $(`.v-tab[data-tab="${k}"]`).click(); await sleep(150); };
  await step('Menu + tab Cần xử lý', async () => { await go('#/quan-ly/giao-viec'); for (let i = 0; i < 100 && !$('.v-tabs'); i++) await sleep(100); await sleep(300); return txt('.nav') + ' || ' + txt('.hub-tabs') + ' || ' + tabs() + ' || ' + $$('.vr[data-k]').filter((r) => !r.hidden).map((r) => r.querySelector('.vtt').innerText + ' [' + r.querySelector('.vst').innerText + ']').join(' / '); });
  await step('Giao 1 mục bàn giao (chưa chọn người thì báo) — mức độ Gấp', async () => {
    rowOf('Máy xay').querySelector('.v-assign').click(); await sleep(200);
    const f = dlg().querySelector('.v-edit'); f.requestSubmit(); await sleep(200); const err = txt('#saved-indicator');
    setv(f.assignee, '3'); setv(f.pri, 'gap'); f.requestSubmit(); await sleep(400); await settle();
    return `"${err}" → ${txt('#root .alert')} · ${tabs()}`;
  });
  await step('Đã xong không cần giao', async () => { rowOf('giấy in').click(); await sleep(200); dlg().querySelector('.v-hoclose').click(); await sleep(400); await settle(); return txt('#root .alert') + ' · ' + tabs(); });
  await step('Thêm việc giao sau, rồi giao', async () => {
    $('#v-add').click(); await sleep(200); const f = dlg().querySelector('form'); f.content.value = 'Kiểm tra camera'; f.requestSubmit(); await sleep(400); await settle();
    const a = txt('#root .alert') + ' · ' + tabs();
    rowOf('camera').click(); await sleep(200); const g = dlg().querySelector('.v-edit'); setv(g.assignee, '5'); setv(g.due, '2030-01-01'); g.requestSubmit(); await sleep(400); await settle();
    return a + ' → ' + txt('#root .alert') + ' · ' + tabs();
  });
  await step('Thêm việc giao ngay (mức độ Thấp)', async () => { $('#v-add').click(); await sleep(200); const f = dlg().querySelector('form'); f.content.value = 'Lau bàn'; f.assignee.value = '6'; f.pri.value = 'thap'; f.requestSubmit(); await sleep(400); await settle(); return txt('#root .alert') + ' · ' + tabs(); });
  await step('Tab Chờ nhận + bỏ giao', async () => {
    await tab('cho-nhan'); const a = txt('#f-count') + ' · hash ' + location.hash;
    rowOf('Lau bàn').click(); await sleep(200); const g = dlg().querySelector('.v-edit'); setv(g.assignee, ''); g.requestSubmit(); await sleep(400); await settle();
    return `${a} → bỏ giao: ${txt('#root .alert')} · ${tabs()}`;
  });
  await step('Bộ lọc mức độ + tìm kiếm', async () => {
    await tab('tat-ca'); $('#f-toggle').click(); await sleep(100); setv($('#f-pri'), 'gap'); await sleep(100);
    const a = txt('#f-count') + ': ' + $$('.vr[data-k]').filter((r) => !r.hidden).map((r) => r.querySelector('.vtt').innerText + ' ' + r.querySelector('.vp').innerText).join(' / ');
    $('#f-clear').click(); setv($('#f-q'), 'camera'); await sleep(100); const b = txt('#f-count'); setv($('#f-q'), '');
    return `${a} · tìm "camera": ${b} · thanh màu: ${$$('.v-bar span').length} đoạn`;
  });
  await step('Tab Đã xử lý + yêu cầu làm lại', async () => {
    await tab('da-xu-ly'); const before = txt('#f-count');
    const r = $$('.vr[data-k]').find((x) => !x.hidden); r.click(); await sleep(200);
    dlg().querySelector('.v-reopen').click(); await sleep(200); const err = txt('#saved-indicator');
    setv(dlg().querySelector('.v-note'), 'Còn 1 bóng chưa sáng'); dlg().querySelector('.v-reopen').click(); await sleep(400); await settle();
    return `${before} · thiếu lý do: "${err}" → ${txt('#root .alert')} · ${tabs()}`;
  });
  await step('Đường dẫn cũ #/quan-ly/hop', async () => { await go('#/quan-ly/hop'); return document.title; });
};
