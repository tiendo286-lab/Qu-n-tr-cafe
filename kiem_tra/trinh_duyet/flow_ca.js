// Luồng Chốt ca → Hoàn thành → ca sau → Đối soát
export default async ({ visit, settle, sleep, out }) => {
  const log = (route, title, errs = []) => out.push({ route, title: String(title).slice(0, 500), len: 0, errs });
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const step = async (name, fn) => { window.__ERR.length = 0; let r = ''; try { r = await fn(); } catch (e) { window.__ERR.push('flow: ' + e.stack); } log(name, r || '', [...window.__ERR, ...$$('#root .alert.error').map((a) => 'page: ' + a.textContent.trim())]); };
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const openShift = async (i) => { location.hash = '#/__tam'; await settle(); await visit('#/ca?ngay=' + day); out.pop(); $$('.ca-shift')[i].click(); await sleep(500); await settle(); };
  await step('Danh sách ca', async () => { await visit('#/ca?ngay=' + day); out.pop(); return $$('.ca-shift').length + ' ô ca · ' + txt('.ca-date'); });
  await step('Mở phiếu Sáng LHP', async () => { await openShift(0); return location.hash + ' · ' + txt('h1') + ' · NV theo lịch: ' + $$('.st-row').length; });
  await step('Điền phiếu Sáng', async () => {
    for (const [id, v] of Object.entries({ rev_end: day + 'T12:30', total_revenue: '5000000', pos_cash: '3000000', pos_transfer: '1500000', reported_transfer: '1480000', cash_counted: '3930000', cups: '120' })) setv($('#' + id), v);
    $$('.st-row').forEach((r) => { setv(r.querySelector('.st-in'), '06:45'); setv(r.querySelector('.st-out'), '12:30'); });
    const sumBad = txt('#sum-check');
    setv($('#total_revenue'), '4500000');
    $('#add-move').click(); await sleep(50); const mv = $$('.mv-row').at(-1); setv(mv.querySelector('.mv-amt'), '50000'); setv(mv.querySelector('.mv-note'), 'Chi tiền đá');
    $('#add-ho').click(); await sleep(50); setv($$('.ho-text').at(-1), 'Máy xay số 2 kêu to, ca chiều kiểm tra');
    $('#add-debt').click(); await sleep(50); $$('.db-row').at(-1).querySelector('.pc-del').click();
    await sleep(800);
    setv($('#helper'), ($('#emp-list option:nth-child(5)')?.value) || ''); $('#add-helper').click(); await sleep(50);
    const h = $$('.st-row').at(-1); setv(h.querySelector('.st-in'), '09:00'); setv(h.querySelector('.st-out'), '12:00');
    const du = $('input[name=goods][value=du]'); du.checked = true; du.dispatchEvent(new Event('change', { bubbles: true }));
    const c = document.createElement('canvas'); c.width = 2400; c.height = 1800; c.getContext('2d').fillRect(0, 0, 100, 100);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
    await sleep(1500);
    const inp = $('#photo-input'); const dt = new DataTransfer(); dt.items.add(new File([blob], 'hang.png', { type: 'image/png' })); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
    await sleep(2000); await settle();
    const up = window.__LOG.filter((x) => x[0] === 'upload').map((x) => x[2] + 'B');
    return `trước sửa: ${sumBad} | sau: ${txt('#sum-check')} | ${txt('#diff-box')} | người làm: ${txt('#staff-count')} | ảnh: ${$$('.ph').length} (${up}) | bàn giao: ${$$('.ho-row').length}`;
  });
  await step('Hoàn thành Sáng', async () => {
    $('#finish').click(); await sleep(1200);
    const d = $('dialog[open]'); if (!d) return 'KHÔNG MỞ HỘP XÁC NHẬN';
    const q = d.querySelector('.alert').innerText;
    d.querySelector('#confirm-finish').click(); await sleep(800); await settle();
    return 'hỏi: ' + q + ' → ' + txt('.pc-head .toolbar') + ' | ' + txt('#root .alert.ok');
  });
  await step('Mở phiếu Chiều LHP', async () => {
    await openShift(1);
    return 'bắt đầu: ' + txt('.pc-f .pc-fixed') + ' | việc cũ: ' + $$('.carried').length + ' | ' + txt('#open-check');
  });
  await step('Chiều: tiền đầu ca lệch + đánh dấu việc xong', async () => {
    setv($('#opening_cash'), '3900000'); await sleep(50); const a = txt('#open-check');
    setv($('#opening_cash'), '3930000'); await sleep(50); const b = txt('#open-check');
    $('.ho-done').click(); await sleep(800); await settle();
    return a + ' || ' + b + ' || sau đánh dấu: ' + txt('.carried');
  });
  await step('Chiều: hoàn thành khi thiếu số liệu', async () => {
    $('#finish').click(); await sleep(1200); const d = $('dialog[open]');
    d.querySelector('#confirm-finish').click(); await sleep(800); const e = d.querySelector('#finish-err').innerText; d.querySelector('#back').click();
    return 'lỗi máy chủ: ' + e;
  });
  await step('Đối soát phiếu Sáng', async () => {
    await openShift(0);
    const n = $$('.rc-chip[data-item]').length;
    for (let i = 0; i < n; i++) { const c = $$('.rc-chip[data-item]:not(.on)')[0]; if (!c) break; c.click(); await sleep(400); await settle(); }
    return `${n} hạng mục → ${txt('.pc-head .toolbar')} | ${txt('#root .alert.ok')}`;
  });
  await step('Trang Đối soát', async () => {
    location.hash = '#/__tam'; await settle(); await visit('#/quan-ly/doi-soat?ngay=' + day); out.pop();
    const f = $('.ds-form'); return txt('.tiles') + ' | bảng: ' + $$('.ds-table tbody tr').length + ' cơ sở | form cuối ngày: ' + (f ? 'có' : 'chưa (đúng: chưa đủ ca)') + ' | ' + txt('.ds-day .kv').slice(0, 200);
  });
};
