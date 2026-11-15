// Bước 107: Hàng hoá › Phiếu xuất thiết kế lại — tất cả cơ sở nhóm theo ngày giao, lọc trạng thái, tìm số đơn, tải nhiều file 1 lần (bảng xem trước: sẵn sàng /
// chọn cơ sở / trùng / lỗi đọc), xem 1 phiếu, tải lại + xoá khi chưa nhận (chặn khi NV đang nhận), khung "Cần ghép phiếu xuất" + ghép có ảnh hoá đơn giao. role=chu (confirm=1).
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ((typeof s === 'string' ? $(s, r) : s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const setFiles = (inp, files) => { const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(300); location.hash = h; await wait(sel, 1500); await sleep(1200); };
  const r = []; window.confirm = () => true;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js'); const { xlsx } = await import('../js/excel.js'); const X = await xlsx();
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); const dmyS = day.split('-').reverse().join('/');
    const mk = (doc, kho, rows) => { const aoa = [['Phiếu xuất điều chuyển'], [`Số đơn: ${doc}`], [`Ngày tạo: ${dmyS} 15:48`], ['Thời gian xuất', `${dmyS} 15:48`], ['Kho nhập', kho],
      ['#', 'Mã hàng', 'Tên hàng', 'Mã đơn vị tính', 'Tên đơn vị tính', 'Số lượng', 'Đơn giá', 'Giảm giá (%)', 'Tiền giảm giá', 'Vat', 'Tiền vat', 'Ghi chú', 'Tổng'], ...rows.map((x, i) => [i + 1, x[0], x[1], 'DV', x[2], x[3], x[4], 0, 0, 0, 0, null, x[3] * x[4]]),
      ['Tổng', null, null, null, null, null, null, null, null, null, null, null, rows.reduce((t, x) => t + x[3] * x[4], 0)]];
      const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), doc); return new File([X.write(wb, { type: 'array', bookType: 'xlsx' })], doc + '.xlsx'); };
    await rpc('app_nh_create', { p: { branch_id: 1, doc_no: 'PXW001', ship_at: day + ' 08:00', kho_code: 'KHOLHP', kho_name: 'Milano LHP', total: 2150000, lines: [{ code: 'A1', name: 'Sữa đặc', unit: 'Hộp', qty: 10, price: 215000, amount: 2150000 }] } });
    const idB = await rpc('app_nh_create', { p: { branch_id: 2, doc_no: 'PXW002', ship_at: day + ' 09:00', total: 50000, lines: [{ code: 'B1', name: 'Trà', unit: 'Gói', qty: 5, price: 10000, amount: 50000 }] } });
    // lần nhận chưa có phiếu xuất (LL) có ảnh hoá đơn giao
    const lid = await rpc('app_gh_receipt_save', { p_id: null, p_branch: 4, p_lines: [{ name: 'Trà đen', unit: 'Gói', qty: 6 }, { name: 'Đá viên', unit: 'Bao', qty: 3 }], p_note: null });
    await rpc('app_gh_deliv', { p_id: lid, p_path: `gh${lid}/hd.jpg`, p_note: null });
    await go('#/hang-hoa/phieu-xuat', '.px-bar');
    r.push(`trang: ${txt('#root h1')} · nút tải ${!!$('#px-files')} · cơ sở: ${$$('.px-bar .branch-tabs a').map((a) => a.innerText.trim()).join(' ')} (đang ${txt('.px-bar .branch-tabs a.on')}) · lọc: ${$$('.px-tt a').map((a) => a.innerText.replace(/\s+/g, ' ')).join(' | ')}`);
    r.push(`cần ghép: ${txt('.px-need').slice(0, 160)} · ngày: ${$$('.px-dh').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / ')} · dòng: ${$$('.px-row').map((x) => x.innerText.replace(/\s+/g, ' ').slice(0, 90)).join(' // ')} · ô tiền tháng cũ ${!!$('.nhw-k.tot')} · ${W()}`);
    const qi = $('#px-q'); qi.value = 'w002'; qi.dispatchEvent(new Event('input', { bubbles: true })); await sleep(200);
    r.push(`tìm "w002": hiện ${$$('.px-row').filter((x) => !x.hidden).length} dòng`); qi.value = ''; qi.dispatchEvent(new Event('input', { bubbles: true }));
    // tải nhiều file
    const fA = mk('PXW010', 'Milano LHP (KHOLHP)', [['A1', 'Sữa đặc', 'Hộp', 2, 20000]]); const fB = mk('PXW011', 'Kho lạ (KHOLA)', [['C1', 'Cà phê', 'Gói', 3, 10000]]);
    const fDup = mk('PXW001', 'Milano LHP (KHOLHP)', [['A1', 'Sữa đặc', 'Hộp', 1, 1000]]); const fBad = new File(['xx'], 'anh.png', { type: 'image/png' });
    setFiles($('#px-files'), [fA, fB, fDup, fBad]); await wait('dialog[open] .px-mr', 200); await sleep(500);
    r.push(`xem trước: ${$$('dialog[open] .px-mr').map((x) => x.innerText.replace(/\s+/g, ' ').slice(0, 80)).join(' // ')} · nút ${txt('#px-save')}`);
    const sb = $$('dialog[open] .px-mr').find((x) => x.innerText.includes('PXW011')).querySelector('.px-sb'); sb.value = '3'; sb.dispatchEvent(new Event('change', { bubbles: true })); await sleep(300);
    r.push(`sau chọn cơ sở: nút ${txt('#px-save')}`); $('#px-save').click(); await sleep(4000); await wait('.px-row', 200); await sleep(800);
    r.push(`sau lưu: ${$$('.px-row').length} dòng · ${$$('.px-row').map((x) => x.querySelector('.px-doc').innerText).join(', ')}`);
    // xem 1 phiếu
    $$('.px-row').find((x) => x.innerText.includes('PXW001')).querySelector('.px-view').click(); await wait('dialog[open] .px-t', 50);
    r.push(`xem: ${txt('dialog[open] .px-dlg > div')} · ${txt('dialog[open] .px-tl')} · nút: ${$$('dialog[open] .toolbar a, dialog[open] .toolbar button').map((b) => b.innerText.trim()).join(', ')}`); $('dialog[open]').close();
    // NV đang nhận PXW002 → không tải lại / xoá
    const B = (await rpc('app_nh_list', { p_month: day.slice(0, 7), p_branch: 2 })).rows.find((x) => x.id === idB);
    await rpc('app_gh_photo_add', { p_id: idB, p_path: `gh${idB}/a.jpg`, p_lines: [B.lines[0].id] });
    await go('#/hang-hoa/phieu-xuat', '.px-row');
    r.push(`PXW002 đang nhận: ${txt($$('.px-row').find((x) => x.innerText.includes('PXW002')))}`);
    // tải lại PXW010
    const rowA = () => $$('.px-row').find((x) => x.innerText.includes('PXW010'));
    r.push(`PXW010 nút: ${$$('button', rowA()).map((b) => b.innerText.trim()).join(', ')}`);
    const realCreate = document.createElement.bind(document); let fakeInp = null;
    document.createElement = (t) => { const el = realCreate(t); if (t === 'input') { fakeInp = el; el.click = () => {}; } return el; };
    rowA().querySelector('.px-re').click(); document.createElement = realCreate; setFiles(fakeInp, [mk('PXW010', 'Milano LHP (KHOLHP)', [['A1', 'Sữa đặc', 'Hộp', 2, 20000], ['A2', 'Đường', 'Kg', 1, 15000]])]);
    await wait('dialog[open] form', 100); await sleep(300); r.push(`tải lại: ${txt('dialog[open] .kv')}`); $('dialog[open] button[type=submit]').click(); await sleep(2500); await wait('.px-row', 200); await sleep(600);
    r.push(`sau tải lại: ${txt(rowA()).slice(0, 80)}`);
    rowA().querySelector('.px-del').click(); await sleep(2500); await wait('.px-bar', 200); await sleep(600);
    r.push(`sau xoá: còn PXW010 ${!!rowA()}`);
    // ghép phiếu cho lần nhận LL
    document.createElement = (t) => { const el = realCreate(t); if (t === 'input') { fakeInp = el; el.click = () => {}; } return el; };
    $('.px-need .px-merge').click(); document.createElement = realCreate; setFiles(fakeInp, [mk('PXW020', 'Lela (KHOLL)', [['T1', 'Trà đen', 'Gói', 6, 10000], ['O1', 'Ống hút', 'Bịch', 2, 5000]])]);
    await wait('dialog[open] .px-t', 100); await sleep(300);
    r.push(`ghép: ảnh HĐ giao ${!!$('dialog[open] .px-inv img')} · ${$$('dialog[open] .px-t tbody tr').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / ')}`);
    $('dialog[open] button[type=submit]').click(); await sleep(2500); await wait('.px-bar', 200); await sleep(600);
    r.push(`sau ghép: khung cần ghép ${!!$('.px-need')} · ${W()}`);
    if (new URLSearchParams(location.search).get('dung')) { await go('#/hang-hoa/phieu-xuat', '.px-bar'); window.scrollTo(0, 0); await new Promise(() => {}); }
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'phiếu xuất 107', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
