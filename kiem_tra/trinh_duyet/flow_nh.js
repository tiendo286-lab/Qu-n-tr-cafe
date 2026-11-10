// Nhập hàng kho tổng (role=chu): kế toán tải phiếu xuất Excel (file tự tạo, không phải dữ liệu thật) → phiếu ca: nhân viên kiểm từng món + ảnh
// → nhận không hóa đơn → quản lý đối soát từng ảnh → ghép hóa đơn → Chốt tháng / Quỹ ngoài thấy tiền hàng kho tổng
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const r = []; const errs = []; window.confirm = () => true; const dlg = () => $('dialog[open]');
  const step = async (name, fn) => { try { r.push(`${name}: ${await fn()}`); } catch (e) { errs.push(`${name}: ${e.message}`); r.push(`${name}: LỖI ${e.message}`); } };
  const setFiles = (inp, files) => { const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); };
  const { rpc } = await import('../js/sb.js'); const { xlsx } = await import('../js/excel.js');
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); const dmyS = day.split('-').reverse().join('/');
  const X = await xlsx();
  const aoa = [['Phiếu xuất điều chuyển'], ['Số đơn: XNBTEST001'], [`Ngày tạo: ${dmyS} 15:48`], ['Người tạo: ketoan@test.vn'], ['Trạng thái: Hoàn thành'],
    ['Kho xuất', 'Kho Tổng (KT0)'], ['Hình thức xuất', 'Bán nội bộ'], ['Thời gian xuất', `${dmyS} 15:48`], ['Kho nhập', 'Milano Coffee - Lê Hồng Phong (KHOTEST1)'], ['Tham chiếu', 'PO1, NNB1'],
    ['#', 'Mã hàng', 'Tên hàng', 'Mã đơn vị tính', 'Tên đơn vị tính', 'Số lượng', 'Đơn giá', 'Giảm giá (%)', 'Tiền giảm giá', 'Vat', 'Tiền vat', 'Ghi chú', 'Tổng'],
    [1, 'T001', 'HÀNG THỬ A', 'HOP', 'Hộp', 10, 5000, 0, 0, 0, 0, null, 50000], [2, 'T002', 'HÀNG THỬ B', 'KG', 'Kg', 2.5, 40000, 0, 0, 0, 0, null, 100000],
    [3, 'T003', 'HÀNG THỬ C', 'CHAI', 'Chai', 3, 20000, 0, 0, 0, 0, null, 60000], ['Tổng', null, null, null, null, null, null, null, null, null, null, null, 210000]];
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), 'XNBTEST001');
  const xfile = new File([X.write(wb, { type: 'array', bookType: 'xlsx' })], 'XNBTEST001.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const cv = document.createElement('canvas'); cv.width = 60; cv.height = 40; cv.getContext('2d').fillRect(0, 0, 60, 40);
  const img = new File([await new Promise((ok) => cv.toBlob(ok, 'image/png'))], 'hang.png', { type: 'image/png' });

  await step('Kế toán tải Excel', async () => {
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/ke-toan/hoa-don'; await wait('#nh-file', 300); await sleep(300);
    setFiles($('#nh-file'), [xfile]); await wait('dialog[open] form', 50); await sleep(300);
    const d = dlg(); const info = `${txt('h2', d)} · cơ sở chọn sẵn: ${$('[name=br]', d).selectedOptions[0]?.text} · ${txt('div > strong', d)}`;
    $('button[type=submit]', d).click(); await sleep(1500); await wait('.nh-list', 50);
    return `${info} → danh sách: ${txt('.nh-list tbody tr td:nth-child(4)')} · ô tổng: ${txt('.nh-k.tot b')}`;
  });
  await step('Tải trùng số đơn', async () => { setFiles($('#nh-file'), [xfile]); await wait('dialog[open] form', 50); await sleep(300); $('button[type=submit]', dlg()).click(); await sleep(500); const e = txt('.nh-err', dlg()); dlg().close(); return e; });
  let id;
  await step('Nhân viên kiểm hàng trong phiếu ca', async () => {
    const ov = await rpc('app_ca_overview', { p_date: day }); const o = ov.find((x) => x.branch_id === 1) || ov[0];
    id = await rpc('app_ca_open', { p_branch: 1, p_date: day, p_shift: o.shift });
    location.hash = '#/ca/phieu?id=' + id; await wait('.nh-card', 300); await sleep(500);
    const c = $('.nh-card'); const head = txt('.nh-head', c);
    $('.nh-duall', c).click(); const q = $$('.nh-q', c); q[2].value = '2'; q[2].dispatchEvent(new Event('input'));
    $('.nh-send', c).click(); await sleep(1500); await wait('.nh-card', 50);
    return `${head.slice(0, 90)} → sau gửi: ${txt('.nh-card .nh-pills')}`;
  });
  await step('Chụp ảnh + gắn món', async () => {
    const c = $('.nh-card'); setFiles($('.nh-ph-in', c), [img]); await wait('dialog[open] .nh-tags', 80); await sleep(200);
    const d = dlg(); const n = $$('input[type=checkbox]', d).length; $$('input[type=checkbox]', d).forEach((x) => { x.checked = true; }); $('button[type=submit]', d).click();
    await sleep(1500); await wait('.nh-card', 50);
    return `hộp chọn ${n} món → ${txt('.nh-card .nh-pills')} · ảnh: ${txt('.nh-photos figcaption')}`;
  });
  await step('Nhận hàng KHÔNG có hóa đơn', async () => {
    $('#nh-new').click(); await wait('.nh-rc-save', 30);
    const row = $('.nh-rcrow'); row.querySelector('.nh-rc-name').value = 'Đá viên'; row.querySelector('.nh-rc-qty').value = '3';
    $('.nh-rc-save').click(); await sleep(1500); await wait('.nh-card', 50);
    return `${$$('.nh-card').length} thẻ · thẻ mới: ${txt('.nh-card:last-of-type .nh-pills')}`;
  });
  if (new URLSearchParams(location.search).get('nhshot')) { $('[data-go="3"]')?.click(); await sleep(500); $('#hd-box')?.scrollIntoView(); await sleep(300); return; }   // dừng ở phiếu ca để chụp màn hình
  await step('Phiếu ca hoàn thành không bị đòi mục 7', async () => {
    const R = await rpc('app_ca_get', { p_id: id });
    await rpc('app_ca_save', { p_id: id, p: { rev_end: day + ' 23:00', total_revenue: 1000000, pos_cash: 600000, pos_transfer: 400000, reported_transfer: 400000, cash_counted: 1600000, opening_cash: 1000000, ipos_opening: 1000000, cups: 10,
      moves: [], staff: (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:30' })), handover: [], goods: [], debts: [] } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos.jpg', p_kind: 'ipos' });
    await rpc('app_ca_complete', { p_id: id });
    return (await rpc('app_ca_get', { p_id: id })).status;
  });
  await step('Quản lý đối soát từng ảnh', async () => {
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id; await wait('.nh-recon', 300); await sleep(500);
    const btn = $('.nh-recon'); const before = btn.innerText; btn.click(); await wait('dialog[open] .nh-rcd h2', 50); await sleep(300);
    const first = txt('dialog[open] .nh-rcd .nh-head');
    const w = $('dialog[open] .nh-wrong'); w.click(); const row = w.closest('.nh-rcl'); row.querySelector('.nh-fq').value = '9'; row.querySelector('.nh-fn').value = 'đếm lại thiếu 1'; row.querySelector('.nh-fsave').click(); await sleep(600);
    for (let k = 0; k < 6 && $('dialog[open] [data-ok]'); k++) { $('dialog[open] [data-ok]').click(); await sleep(700); }
    const end = txt('dialog[open] .nh-rcd .nh-head'); $('dialog[open] [data-x]')?.click(); await sleep(3000); await wait('.nh-recon', 80);
    const S = await rpc('app_nh_for_report', { p_report: id });
    const after = $$('.nh-recon').map((b) => b.innerText).join(' / ');
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca/phieu?id=' + id; await wait('.nh-recon', 300); await sleep(800);
    r.push(`ngay sau khi đóng: ${after} · mở lại trang: ${$$('.nh-recon').map((b) => b.innerText).join(' / ')}`);
    return `${before} · mở: ${first} · cuối: ${end} → máy chủ: còn ${S.rows.map((x) => x.n_unchecked).join('/')} món chưa đối soát · nút: ${txt('.nh-recon')} · hạng mục Nhập hàng: ${$$('.rc-chip').map((c) => c.innerText).find((t) => /nhập hàng/i.test(t)) || '?'}`;
  });
  await step('Kế toán ghép hóa đơn vào phiếu không hóa đơn', async () => {
    const L = await rpc('app_nh_list', { p_month: day.slice(0, 7), p_branch: null }); const w = L.rows.find((x) => x.state === 'cho_hoa_don');
    await rpc('app_nh_create', { p: { branch_id: 1, doc_no: 'XNBTEST002', ship_at: day + ' 16:00', total: 30000, merge_id: w.id, lines: [{ code: 'T009', name: 'Đá viên', unit: 'Bao', qty: 3, price: 10000, amount: 30000 }] } });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ke-toan/hoa-don'; await wait('.nh-list', 200); await sleep(400);
    $$('.nh-view')[0].click(); await wait('dialog[open] .nh-t', 30); const v = txt('dialog[open] .nh-head'); dlg().close();
    return `${$$('.nh-list tbody tr').length} dòng · xem: ${v.slice(0, 120)}`;
  });
  await step('Chốt tháng + Quỹ ngoài', async () => {
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/chot-thang?cn=1'; await wait('.ct-rc', 300); await sleep(800);
    const a = [...document.querySelectorAll('.pc-sub')].find((x) => /KHO TỔNG/i.test(x.innerText))?.innerText.replace(/\s+/g, ' ').slice(0, 70) || ('KHÔNG THẤY: ' + [...document.querySelectorAll('.pc-sub, h2')].map((x) => x.innerText.slice(0, 25)).join(' / ') + ' ' + (window.__ERR || []).join(' ').slice(0, 200));
    location.hash = '#/quan-ly/so-quy?cn=ngoai'; await wait('.sq-k', 200); await sleep(400);
    return `${a} · nút Quỹ ngoài: ${txt('#ex-kho') || 'KHÔNG CÓ'}`;
  });
  out.push({ route: 'nhập hàng kho tổng', title: r.join(' || ') + ` || rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`, len: 0, errs: [...errs, ...window.__ERR] });
};
