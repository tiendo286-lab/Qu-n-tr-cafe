// Luồng Kế toán: role=chu (tải hóa đơn → nhân viên báo nhận trong phiếu ca → kế toán thấy trạng thái; nhập số dư BIDV)
// role=kt (menu chỉ Kế toán, trang chủ chuyển sang Hóa đơn)
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const log = (route, title, errs = []) => out.push({ route, title: String(title).slice(0, 700), len: 0, errs });
  const step = async (name, fn) => { window.__ERR.length = 0; let r = ''; try { r = await fn(); } catch (e) { window.__ERR.push('flow: ' + e.stack); } log(name, r || '', [...window.__ERR, ...$$('#root .alert.error').map((a) => 'page: ' + a.textContent.trim())]); };
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const setFiles = (inp, files) => { const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); };
  const png = async () => { const c = document.createElement('canvas'); c.width = 20; c.height = 20; c.getContext('2d').fillRect(0, 0, 10, 10); return new File([await new Promise((r) => c.toBlob(r, 'image/png'))], 'hang.png', { type: 'image/png' }); };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(200); location.hash = h; await wait(sel); await sleep(600); };
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

  if (new URLSearchParams(location.search).get('role') === 'kt') {
    await step('Kế toán: trang chủ + menu', async () => { location.hash = '#/'; await wait('h1'); await sleep(800); return location.hash + ' · ' + txt('h1') + ' || menu: ' + txt('.nav') + ' || tab: ' + txt('.hub-tabs'); });
    await step('Kế toán: không vào được Đối soát', async () => { await go('#/quan-ly/doi-soat', '#root .card, h1'); return document.title + ' · ' + txt('#root .card'); });
    return;
  }
  const { rpc } = await import('../js/sb.js');
  let rid;
  await step('Menu Kế toán', async () => { await go('#/ke-toan/hoa-don', '#hd-new'); return txt('.nav').includes('Kế toán') + ' · tab: ' + txt('.hub-tabs'); });
  await step('Tải hóa đơn (PDF + Excel) cho cơ sở đầu, hôm nay', async () => {
    const f = $('#hd-new'); f.branch.selectedIndex = 1; f.note.value = 'Giao sữa, đá';
    setFiles(f.files, [new File(['%PDF-1.4'], 'hoadon.pdf', { type: 'application/pdf' }), new File(['a,b'], 'chitiet.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })]);
    f.requestSubmit(); await sleep(1500); await wait('.hd'); await sleep(400);
    return txt('#root .alert') + ' · ' + $$('.hd').map((c) => c.innerText.replace(/\s+/g, ' ').slice(0, 160)).join(' / ');
  });
  await step('Phiếu chốt ca: thấy hóa đơn, chụp ảnh, báo THIẾU', async () => {
    const ov = await rpc('app_ca_overview', { p_date: day });
    rid = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[0].shift });
    location.hash = '#/ca/phieu?id=' + rid; await wait('.hd-card', 600); await sleep(600); const a = txt('.hd-card');
    $('.hd-send').click(); await sleep(300); const err1 = txt('#saved-indicator');
    setFiles($('.hd-ph-in'), [await png()]); await sleep(1500); await wait('.hd-card .ph'); await sleep(300);
    const c = $('.hd-card'); c.querySelector('input[value=thieu]').click(); await sleep(100);
    setv(c.querySelector('.hd-it-name'), 'Sữa đặc'); setv(c.querySelector('.hd-it-qty'), '2 hộp');
    c.querySelector('.hd-send').click(); await sleep(1000);
    return `${a.slice(0, 120)} · bấm khi chưa chọn: "${err1}" · ảnh: ${$$('.hd-card .ph').length} · sau gửi: ${txt('.hd-card .pill')} · ${txt('.hd-card .hd-rec')}`;
  });
  await step('Kế toán thấy trạng thái', async () => { await go('#/ke-toan/hoa-don', '.hd'); return $$('.hd').map((c) => c.innerText.replace(/\s+/g, ' ').slice(0, 220)).join(' / '); });
  await step('Thêm tài khoản nhận tiền (2 TK cho cơ sở đầu) + chặn số sai', async () => {
    await go('#/ke-toan/chuyen-khoan?ngay=' + day, '.ck-row');
    const note = `trang CK: còn khung tài khoản ${!!$('.ck-accf')} · nhắc: ${txt('.alert.warn')}`;
    await go('#/cai-dat/tai-khoan', '.ck-accf');   // 12/11: tài khoản chuyển sang Cài đặt
    const f = () => $('.ck-accf');
    const before = txt('#ck-alist').slice(0, 60);
    f().branch.selectedIndex = 1; setv(f().no, '12ab'); f().requestSubmit(); await sleep(400); const err = txt('#saved-indicator');
    f().branch.selectedIndex = 1; setv(f().no, '1234 5678 90'); setv(f().label, 'QR quầy'); f().requestSubmit(); await sleep(1200); await wait('.ck-al');
    f().branch.selectedIndex = 1; setv(f().bank, 'Vietcombank'); setv(f().no, '0011223344'); f().requestSubmit(); await sleep(1200);
    const out = `${note} · Cài đặt: ${txt('#root h1')} · menu ${txt('.hub-tabs a.on')} · trước: ${before} · số sai: "${err}" · sau: ${$$('.ck-al').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / ')}`;
    await go('#/ke-toan/chuyen-khoan?ngay=' + day, '.ck-row');
    return out;
  });
  await step('Nhập số dư theo từng tài khoản', async () => {
    const row = $('.ck-row[data-report]'); if (!row) return 'KHÔNG CÓ HÀNG CÓ PHIẾU · ' + txt('.ck-row');
    const accs = row.querySelectorAll('.ck-acc');
    setv(accs[0].querySelector('.ck-open'), '10.000.000'); setv(accs[0].querySelector('.ck-close'), '12.500.000'); setv(accs[0].querySelector('.ck-out'), '300.000');
    const half = txt('.ck-row[data-report] .ck-res');
    setv(accs[1].querySelector('.ck-open'), '1.000.000'); setv(accs[1].querySelector('.ck-close'), '1.200.000');
    const res = txt('.ck-row[data-report] .ck-res');
    row.querySelector('.ck-save').click(); await sleep(600);
    return `${accs.length} TK · một TK: ${half} · đủ: ${res} · ${txt('#saved-indicator')}`;
  });
  await step('Ca sau: gợi ý số dư đầu = cuối ca trước (từng TK)', async () => {
    const ov = await rpc('app_ca_overview', { p_date: day });
    await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[1].shift });
    await go('#/ke-toan/chuyen-khoan?ngay=' + day, '.ck-row');
    const r2 = $$('.ck-row[data-report]')[1];
    return r2 ? [...r2.querySelectorAll('.ck-open')].map((i) => i.value + (i.classList.contains('st-sg') ? '(vàng)' : '')).join(' , ') : 'KHÔNG THẤY CA 2';
  });
  await step('Ngừng dùng TK thứ 2 → ca mới chỉ còn 1 TK; đã có số dư thì không có nút Xóa', async () => {
    await go('#/cai-dat/tai-khoan', '.ck-al');
    const al = $$('.ck-al')[1]; const hasDel = !!al.querySelector('.ck-del');
    al.querySelector('.ck-toggle').click(); await sleep(1200); await wait('.ck-al');
    const head = txt('.card h2:last-of-type');
    await go('#/ke-toan/chuyen-khoan?ngay=' + day, '.ck-row');
    const r2 = $$('.ck-row[data-report]')[1];
    return `nút xóa TK đã dùng: ${hasDel} · ${head} · ca 2 còn ${r2.querySelectorAll('.ck-acc').length} TK · ca 1 còn ${$$('.ck-row[data-report]')[0].querySelectorAll('.ck-acc').length} TK`;
  });
};
