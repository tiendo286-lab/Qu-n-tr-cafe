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
  // 13/11/2026: bỏ 3 bước hoá đơn giao hàng kiểu cũ (giao diện hoá đơn đã đổi ở bước 31 — xem flow_nh.js); tạo phiếu ca trực tiếp cho các bước số dư
  await step('Tạo phiếu ca hôm nay (cơ sở đầu, ca đầu)', async () => {
    const ov = await rpc('app_ca_overview', { p_date: day });
    rid = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[0].shift });
    return 'phiếu ' + rid;
  });
  await step('Thêm tài khoản nhận tiền (2 TK cho cơ sở đầu) + chặn số sai', async () => {
    await go('#/ke-toan/chuyen-khoan?ngay=' + day, '.ckw-bar');   // bước 99: bảng theo ngày
    const note = `trang CK: còn khung tài khoản ${!!$('.ck-accf')} · nhắc: ${txt('.alert.warn')}`;
    await go('#/cai-dat/tai-khoan', '.ck-accf');   // 12/11: tài khoản chuyển sang Cài đặt
    const f = () => $('.ck-accf');
    const before = txt('#ck-alist').slice(0, 60);
    f().branch.selectedIndex = 1; setv(f().no, '12ab'); f().requestSubmit(); await sleep(400); const err = txt('#saved-indicator');
    f().branch.selectedIndex = 1; setv(f().no, '1234 5678 90'); setv(f().label, 'QR quầy'); f().requestSubmit(); await sleep(1200); await wait('.ck-al');
    f().branch.selectedIndex = 1; setv(f().bank, 'Vietcombank'); setv(f().no, '0011223344'); f().requestSubmit(); await sleep(1200);
    const out = `${note} · Cài đặt: ${txt('#root h1')} · menu ${txt('.hub-tabs a.on')} · trước: ${before} · số sai: "${err}" · sau: ${$$('.ck-al').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / ')}`;
    await go('#/ke-toan/chuyen-khoan?ngay=' + day, '.ckw-bar');   // bước 99: bảng theo ngày
    return out;
  });
  await step('Nhập số dư theo từng tài khoản (bảng theo ngày, bước 99)', async () => {
    await go('#/ke-toan/chuyen-khoan?ngay=' + day, 'table.ckw'); await sleep(800);
    const cells = $$(`.ckw-c[data-k^="${rid}|"]`); if (!cells.length) return 'KHÔNG CÓ Ô CỦA PHIẾU ' + rid + ' · ' + txt('#root').slice(0, 200);
    const sub = async (cell, open, close, outv) => {
      cell.querySelector('.ckw-more').click(); await wait('dialog[open] form .m-open'); await sleep(200);
      const f = [...document.querySelectorAll('dialog[open] form')].pop(); f.querySelector('.m-open').value = open; if (outv) f.querySelector('.m-out').value = outv; f.requestSubmit(); await sleep(900);
      setv(cell.querySelector('.ckw-close'), close); await sleep(900);
    };
    await sub(cells[0], '10.000.000', '12.500.000', '300.000');
    const half = txt(`.ckw-t[data-r="${rid}"]`);
    if (cells[1]) await sub(cells[1], '1.000.000', '1.200.000');
    const res = txt(`.ckw-t[data-r="${rid}"]`);
    const b = await rpc('app_kt_bank_get', { p_report: rid });
    return `${cells.length} TK · một TK: ${half} · đủ: ${res} · máy chủ nhận ${b.received} · ${txt('#saved-indicator')}`;
  });
  await step('Ca sau: số dư đầu = cuối ca trước (từng TK)', async () => {
    const ov = await rpc('app_ca_overview', { p_date: day });
    const r2 = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[1].shift });
    await go('#/ke-toan/chuyen-khoan?ngay=' + day, 'table.ckw'); await sleep(800);
    const c2 = $$(`.ckw-c[data-k^="${r2}|"]`);
    return c2.length ? c2.map((c) => c.querySelector('.ckw-o').innerText.trim()).join(' , ') : 'KHÔNG THẤY CA 2';
  });
  await step('Ngừng dùng TK thứ 2 → ca mới chỉ còn 1 TK; đã có số dư thì không có nút Xóa', async () => {
    await go('#/cai-dat/tai-khoan', '.ck-al');
    const al = $$('.ck-al')[1]; const hasDel = !!al.querySelector('.ck-del');
    al.querySelector('.ck-toggle').click(); await sleep(1200); await wait('.ck-al');
    const head = txt('.card h2:last-of-type');
    await go('#/ke-toan/chuyen-khoan?ngay=' + day, '.ckw-bar');   // bước 99: bảng theo ngày
    await wait('table.ckw'); await sleep(600);
    const ov = await rpc('app_ca_overview', { p_date: day }); const r2 = ov.find((x) => x.branch_id === ov[0].branch_id && x.shift === ov[1].shift)?.report_id;
    return `nút xóa TK đã dùng: ${hasDel} · ${head} · ca 2 còn ${$$(`.ckw-c[data-k^="${r2}|"]`).length} TK · ca 1 còn ${$$(`.ckw-c[data-k^="${rid}|"]`).length} TK`;
  });
};
