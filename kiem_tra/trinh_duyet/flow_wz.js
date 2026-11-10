// Phiếu chốt ca TỪNG BƯỚC (nhân viên, khung điện thoại): 5 bước, chấm đỏ ở bước còn thiếu, bước 5 liệt kê chỗ thiếu → sửa → HOÀN THÀNH
// + công nợ tính vào công thức, ca sau: giờ bắt đầu tự lấy, tiền đầu ca lệch phải ghi lý do, khách trả nợ bằng tiền mặt
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const log = (route, title, errs = []) => out.push({ route, title: String(title).slice(0, 700), len: 0, errs });
  const step = async (name, fn) => { window.__ERR.length = 0; let r = ''; try { r = await fn(); } catch (e) { window.__ERR.push('flow: ' + e.stack); } log(name, r || '', [...window.__ERR, ...$$('#root .alert.error').map((a) => 'page: ' + a.textContent.trim())]); };
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const { rpc } = await import('../js/sb.js');
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const open = async (id) => { location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id; await wait('#pc-form', 600); await sleep(700); };
  const go = async (i) => { $(`.wz-st[data-go="${i}"]`).click(); await sleep(250); };
  const vis = () => $$('.wz-pane').findIndex((p) => !p.hidden);
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
  const ov = await rpc('app_ca_overview', { p_date: day });
  let r1; let r2;
  await step('Mở phiếu Sáng: có 5 bước', async () => {
    r1 = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[0].shift });
    await open(r1); document.querySelector('dialog[open]')?.close();
    return `${$$('.wz-st').length} bước: ${txt('.wz-steps')} · đang ở bước ${vis() + 1} · ${txt('#wz-pos')} · nút HOÀN THÀNH ẩn: ${$('#finish').hidden}`;
  });
  await step('Bước 1: nhập số liệu, Mục 1 lệch 200.000 (chưa ghi nợ)', async () => {
    for (const [id, v] of Object.entries({ rev_end: day + 'T12:30', total_revenue: '1700000', pos_cash: '1000000', pos_transfer: '500000', reported_transfer: '500000', cash_counted: '2000000', cups: '50', ipos_opening: '1.000.000' })) setv($('#' + id), v);
    $$('.st-row').forEach((r) => { setv(r.querySelector('.st-in'), '06:45'); setv(r.querySelector('.st-out'), '12:30'); });
    await sleep(300);
    return `${txt('#sum-check')} · chấm đỏ: ${$$('.wz-st').filter((b) => !b.querySelector('.wz-dot').hidden).map((b) => b.dataset.go * 1 + 1).join(',')}`;
  });
  await step('Bước 2: ghi bàn nợ 200.000 → Mục 1 khớp', async () => {
    $('#wz-next').click(); await sleep(250);
    $('#add-debt').click(); await sleep(50); const d = $$('.db-row').at(-1); setv(d.querySelector('.db-table'), 'B5'); setv(d.querySelector('.db-amt'), '200.000');
    await sleep(1500);
    return `đang ở bước ${vis() + 1} · ${txt('#diff-box').slice(0, 120)} · bước 1 giờ: ${(await (async () => { await go(0); return txt('#sum-check'); })())}`;
  });
  await step('Bước 5: liệt kê chỗ còn thiếu → bấm Sửa nhảy đúng bước', async () => {
    await go(4); const a = txt('#wz-check');
    const btn = $$('#wz-check [data-go]')[0]; const target = btn?.dataset.go; btn?.click(); await sleep(250);
    return `${a.slice(0, 260)} · bấm Sửa → bước ${vis() + 1} (đúng: ${Number(target) + 1})`;
  });
  await step('Chụp ảnh phiếu chốt ca iPOS (bắt buộc)', async () => {
    await go(4); const before = $$('#wz-check .wz-miss').map((x) => x.innerText.split('\n')[0]).filter((t) => /iPOS/.test(t)).join(';');
    await go(0); const inp = $('#ipos-input');
    const c = document.createElement('canvas'); c.width = c.height = 40; c.getContext('2d').fillRect(0, 0, 20, 20);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    const dtf = new DataTransfer(); dtf.items.add(new File([blob], 'ipos.png', { type: 'image/png' })); inp.files = dtf.files;
    inp.dispatchEvent(new Event('change', { bubbles: true })); await sleep(2500); await wait('#pc-form'); await sleep(500);
    await go(4); const after = $$('#wz-check .wz-miss').map((x) => x.innerText.split('\n')[0]).filter((t) => /iPOS/.test(t)).join(';');
    await go(0);
    return `trước: "${before}" · ảnh iPOS: ${$$('#ipos-input').length && $('#ipos-input').closest('.pc-f').querySelectorAll('.ph').length} · sau: "${after || 'hết thiếu'}" · ${txt('#ipos-check')}`;
  });
  await step('Bước 4: không có hàng kho tổng (không phải chọn gì) → bước 5 đủ → HOÀN THÀNH', async () => {
    await go(3); const nh = txt('#hd-box'); await sleep(400); await go(4);
    const a = txt('#wz-check');
    $('#finish').click(); await sleep(1500); const d = $('dialog[open]'); const sum = d ? d.innerText.replace(/\s+/g, ' ').slice(0, 260) : 'KHÔNG HIỆN HỘP';
    d?.querySelector('#confirm-finish').click(); await sleep(1200); await wait('#pc-form');
    return `mục 7: ${nh.slice(0, 60)} || ${a.slice(0, 120)} || ${sum} || ${txt("#root .alert")} · ${(await rpc("app_ca_get", { p_id: r1 })).status}`;
  });
  let r3;
  await step('Ca Tối mở trước khi ca Chiều hoàn thành: chưa cho đếm nhận két', async () => {
    if (!ov[2] || ov[2].branch_id !== ov[0].branch_id) return '(cơ sở không có ca thứ 3)';
    r3 = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[2].shift });
    await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[1].shift });
    await open(r3); return `${txt('.hand-wait')} · có ô đếm: ${!!$('#hand-count')}`;
  });
  await step('Ca Chiều: đếm mù — không thấy số két ca Sáng trước khi xác nhận', async () => {
    r2 = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[1].shift });
    await open(r2);
    const start = txt('.pc-fixed');
    const page = $('#pc-form').innerText; const leak = /2\.000\.000/.test(page);
    return `${start} · ${txt('.hand-blind')} · lộ số ca Sáng (2.000.000): ${leak}`;
  });
  await step('Đếm 1.900.000 → lệch −100.000 → phải 2 người đếm lại', async () => {
    setv($('#hand-count'), '1.900.000'); $('#hand-ok').click(); await sleep(1500); await wait('#pc-form'); await sleep(500);
    const a = txt('.hand-kv') + ' · ' + txt('#pc-form .alert.error');
    await go(4); const miss = $$('#wz-check .wz-miss').map((x) => x.innerText.split('\n')[0]).filter((t) => /két|lý do/.test(t)).join(';'); await go(0);
    return `${a} · bước 5: ${miss} · còn ô đếm mù: ${!!$('#hand-count')}`;
  });
  await step('2 người đếm lại 1.950.000 → vẫn lệch −50.000 → báo quản lý, phải ghi lý do', async () => {
    const g = $('#hand-giver'); g.value = g.options[1]?.value || ''; setv($('#hand-recount'), '1.950.000'); $('#hand-re').click(); await sleep(1500); await wait('#pc-form'); await sleep(500);
    const a = txt('.hand-kv') + ' · ' + txt('#pc-form .alert.error');
    setv($('#ipos_opening'), '1.000.000'); await sleep(200);
    const ip = txt('#ipos-check') + ' · ô lý do hiện: ' + !$('#open-note-box').hidden;
    return `${a} · iPOS: ${ip}`;
  });
  await step('Khung 390px: phần nhận két không tràn ngang', async () => {
    await go(0); const W = document.documentElement.clientWidth;
    const wide = $$('#pc-form *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > W + 1).map((el) => el.tagName + '.' + el.className).slice(0, 5);
    return `rộng ${W}px · trang ${document.documentElement.scrollWidth}px · tràn: ${wide.join(', ') || 'không'}`;
  });
  await step('Ca Chiều: lý do lệch, khách trả nợ tiền mặt', async () => {
    const oc = 'ô lý do hiện: ' + !$('#open-note-box').hidden; const start = '';
    await go(4); const miss = $$('#wz-check .wz-miss').map((x) => x.innerText.split('\n')[0]).filter((t) => /lý do/.test(t)).join(';');
    await go(1); const b = $('.debt-close'); let col = 'không có nợ cũ';
    if (b) { b.click(); await sleep(200); const d = $('dialog[open]'); d.querySelector('input[value=tien_mat]').click(); d.querySelector('form').requestSubmit(); await sleep(1500); await wait('#pc-form'); await sleep(500); await go(1); col = txt('#diff-box').slice(0, 200) + ' · ' + txt('.pc-line.carried'); }
    return `${start} | ${oc} | bước 5: ${miss} | ${col}`;
  });
};
