// Nhập hàng kho tổng (role=chu): kế toán tải phiếu xuất Excel (file tự tạo, không phải dữ liệu thật) → phiếu ca: nhân viên kiểm từng món + ảnh
// → nhận không hóa đơn → quản lý đối soát từng ảnh → ghép hóa đơn (bước 103: nhận + đối soát ở trang Giao hàng) → Chốt tháng / Quỹ ngoài thấy tiền hàng kho tổng
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
  const NH = async () => ({ rows: (await rpc('app_nh_list', { p_month: day.slice(0, 7), p_branch: 1 })).rows });   // bước 104: hàng không gắn phiếu ca
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

  await step('Kế toán tải Excel', async () => {   // bước 107: tải nhiều file 1 lần → bảng xem trước → Lưu
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/hang-hoa/phieu-xuat?cn=1'; await wait('#px-files', 1500); await sleep(300);
    setFiles($('#px-files'), [xfile]); await wait('dialog[open] .px-mr', 80); await sleep(300);
    const info = txt('.px-mr', dlg()); $('#px-save', dlg()).click(); await sleep(2500); await wait('.px-row', 80);
    return `${info} → danh sách: ${txt('.px-row')}`;
  });
  await step('Tải trùng số đơn', async () => { setFiles($('#px-files'), [xfile]); await wait('dialog[open] .px-mr', 80); await sleep(300); const e = txt('.px-mr', dlg()); dlg().close(); return e; });
  let id;
  await step('Nhân viên kiểm hàng trong phiếu ca', async () => {
    const ov = await rpc('app_ca_overview', { p_date: day }); const o = ov.find((x) => x.branch_id === 1) || ov[0];
    id = await rpc('app_ca_open', { p_branch: 1, p_date: day, p_shift: o.shift });
    await rpc('app_ca_part_claim', { p_id: id, p_part: 'tien', p_force: false });
    await rpc('app_ca_part_claim', { p_id: id, p_part: 'nhan_su', p_force: false });
    // Bước 104: nhận hàng ở menu Hàng hoá › Nhận hàng (không gắn phiếu ca) — chụp ảnh → chọn món trong ảnh → gửi
    const inv = (await NH()).rows.find((x) => x.state === 'dang_chuyen');
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/hang-hoa/nhan?nhan=' + inv.id; await wait('#gh-shot', 1500); await sleep(500);
    const head = txt('#gh-recv h1');
    setFiles($('#gh-shot'), [img]); await wait('.gh-pickc', 80); await sleep(300);
    $$('.gh-sel .gh-c').forEach((c) => { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
    const q2 = $$('.gh-sel')[2].querySelector('.gh-q'); q2.value = '2'; q2.dispatchEvent(new Event('input', { bubbles: true }));
    const nt = $$('.gh-note').find((n) => !n.hidden); if (nt) { nt.querySelector('input').value = 'thiếu 1 chai'; }
    $('#gh-ps').click(); await sleep(2500); await wait('#gh-dshot', 300); setFiles($('#gh-dshot'), [img]); await sleep(3000); await wait('#gh-send', 300); 
    $('#gh-send').click(); await sleep(3000);
    const S1 = (await NH()).rows.find((x) => x.id === inv.id);
    return `${head} → sau gửi: ${S1.state} · lệch ${S1.n_mismatch} · ${S1.photos.length} ảnh`;
  });
  await step('Chụp ảnh + gắn món', async () => {
    const S1 = (await NH()).rows.find((x) => x.kind !== 'khong_hd');
    const RR = await rpc('app_ca_get', { p_id: id }); const PP = await rpc('app_ca_parts', { p_id: id }).catch(() => null);
    return `ảnh gắn ${S1.photos.map((p) => p.lines.length).join('+')} món · thiếu ảnh ${S1.n_unphoto} món · phiếu ${RR.status} · phần ${JSON.stringify(PP?.parts || PP).slice(0, 200)}`;
  });
  await step('Nhận hàng KHÔNG có hóa đơn', async () => {
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/hang-hoa/nhan?cn=1'; await wait('.gh-nohd', 1500); await sleep(300);
    $('.gh-nohd').click(); await wait('#gh-shot', 300); await sleep(500);   // bước 104b: chụp trước → ghi tên + số lượng
    setFiles($('#gh-shot'), [img]); await wait('.gh-pickc', 80); await sleep(300);
    const row = $('.gh-nr'); row.querySelector('.gh-nn').value = 'Đá viên'; row.querySelector('.gh-nq').value = '3'; $('#gh-ps').click(); await sleep(3000); await wait('#gh-dshot', 300); setFiles($('#gh-dshot'), [img]); await sleep(3000); await wait('#gh-send', 300); 
    const btn = txt('#gh-send'); $('#gh-send').click(); await sleep(2500);
    const rows = (await NH()).rows;
    const R5 = await rpc('app_ca_get', { p_id: id });
    return `nút ${btn} · ${rows.length} lần giao · không HĐ: ${rows.filter((x) => x.kind === 'khong_hd').map((x) => x.state + ' ' + x.photos.length + ' ảnh').join(', ')} · phiếu ${R5.status}`;
  });
  if (new URLSearchParams(location.search).get('nhshot')) { $('[data-go="3"]')?.click(); await sleep(500); $('#hd-box')?.scrollIntoView(); await sleep(300); return; }   // dừng ở phiếu ca để chụp màn hình
  await step('Phiếu ca hoàn thành không bị đòi mục 7', async () => {
    const R = await rpc('app_ca_get', { p_id: id }); if (R.status !== 'dang_chot') return 'phiếu đã ' + R.status + ' trước bước này';
    await rpc('app_ca_save', { p_id: id, p: { rev_end: day + ' 23:00', total_revenue: 1000000, pos_cash: 600000, pos_transfer: 400000, reported_transfer: 400000, cash_counted: 1600000, opening_cash: 1000000, ipos_opening: 1000000, pos_debt: 0, pos_diff: 0, diff_note: null, cups: 10,
      moves: [], staff: (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:30' })), handover: [], goods: [], debts: [] } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false }).catch(() => {}); for (const k of ['tien', 'nhan_su']) { if ((await rpc('app_ca_get', { p_id: id })).status === 'hoan_thanh') break; await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true }); }   // bước 104: phiếu ca không còn phần nhận hàng
    return (await rpc('app_ca_get', { p_id: id })).status;
  });
  await step('Quản lý đối soát từng ảnh', async () => {
    const inv = (await NH()).rows.find((x) => x.kind !== 'khong_hd');
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/hang-hoa/doi-soat?ds=' + inv.id; await wait('.ds-top', 1500); await sleep(800);
    const before = txt('#gh-ds .gh-steps');
    const fix = $$('.gh-dl').find((x) => x.querySelector('.gh-fix')); fix.querySelector('.gh-fix').click(); await wait('dialog[open] form', 50); await sleep(200);
    const f = $$('dialog[open] form').pop(); f.q.value = '9'; f.nt.value = 'đếm lại thiếu 1'; f.requestSubmit(); await sleep(1500);
    for (let k = 0; k < 6 && $('.gh-all, .gh-one'); k++) { $('.gh-all, .gh-one').click(); await sleep(1500); }
    $('#gh-done')?.click(); await sleep(3000);   // bước 106: quản lý bấm Xác nhận xong
    const S = await NH();
    return `${before} → máy chủ: còn ${S.rows.filter((x) => x.kind !== 'khong_hd').map((x) => x.n_unchecked).join('/')} món chưa đối soát · kết quả: ${location.hash}`;
  });
  await step('Kế toán ghép hóa đơn vào phiếu không hóa đơn', async () => {
    const L = await rpc('app_nh_list', { p_month: day.slice(0, 7), p_branch: null }); const w = L.rows.find((x) => x.state === 'cho_hoa_don');
    await rpc('app_nh_create', { p: { branch_id: 1, doc_no: 'XNBTEST002', ship_at: day + ' 16:00', total: 30000, merge_id: w.id, lines: [{ code: 'T009', name: 'Đá viên', unit: 'Bao', qty: 3, price: 10000, amount: 30000 }] } });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/hang-hoa/phieu-xuat?cn=1'; await wait('.px-row', 200); await sleep(400);
    $$('.px-view')[0].click(); await wait('dialog[open] .px-t', 30); const v = txt('dialog[open] .px-dlg > div'); dlg().close();
    return `${$$('.px-row').length} dòng · xem: ${v.slice(0, 120)}`;
  });
  await step('Chốt tháng + Quỹ ngoài', async () => {
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/chot-thang?cn=1'; await wait('.ct-rc', 300); await sleep(800);
    const a = [...document.querySelectorAll('.pc-sub')].find((x) => /KHO TỔNG/i.test(x.innerText))?.innerText.replace(/\s+/g, ' ').slice(0, 70) || ('KHÔNG THẤY: ' + [...document.querySelectorAll('.pc-sub, h2')].map((x) => x.innerText.slice(0, 25)).join(' / ') + ' ' + (window.__ERR || []).join(' ').slice(0, 200));
    return a;   // bước 152: Sổ quỹ cũ (nút tiền hàng kho tổng ở Quỹ ngoài) đã bỏ
  });
  out.push({ route: 'nhập hàng kho tổng', title: r.join(' || ') + ` || rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`, len: 0, errs: [...errs, ...window.__ERR] });
};
