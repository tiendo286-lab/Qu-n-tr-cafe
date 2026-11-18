// Bước 136: tab File ca Fabi — khung "Ca cần quản lý xem", câu lỗi, bảng so sánh Nhân viên nhập · File Fabi; quản lý xem được (không tải file).
// Chạy role=chu | ql | kt, confirm=1; index.html và test/phone.html. Kết quả "ĐẠT …" hoặc "KIỂM TRA THẤT BẠI".
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const r = []; let fail = null;
  const check = (ok, m) => { if (!ok) throw new Error(m); r.push('✓ ' + m); };
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2000);
    const { rpc } = await import('../js/sb.js');
    for (const m of ['../js/excel.js', '../js/pages/ke_toan_fabi.js', '../js/pages/fabi_board.js', '../js/fabi_so_sanh.js']) await Promise.race([import(m).catch(() => {}), sleep(4000)]);
    const day = new Date(Date.now() + 7 * 3600e3 - 86400e3).toISOString().slice(0, 10);   // hôm qua
    const ov = await rpc('app_ca_overview', { p_date: day });
    const lhp = ov.filter((x) => x.branch_code === 'LHP'); const br = lhp[0].branch_id;
    const shift = (s) => (lhp.find((x) => x.shift === s) || {}).shift;
    const mkReport = async (sh, cash, diff, t0, t1) => {
      const id = await rpc('app_ca_open', { p_branch: br, p_date: day, p_shift: sh });
      for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
      const R = await rpc('app_ca_get', { p_id: id });
      await rpc('app_ca_save', { p_id: id, p: { rev_start: `${day} ${t0}`, rev_end: `${day} ${t1}`, total_revenue: 5000000, pos_cash: 2000000, pos_transfer: 3000000, reported_transfer: 3000000,
        cash_counted: cash, ipos_opening: 1000000, pos_debt: 0, pos_diff: diff, diff_note: diff ? 'không rõ' : null, cups: 100, moves: [], goods: [], handover: [], debts: [],
        staff: (R.staff || []).map((s) => ({ ...s, worked: true, time_in: t0, time_out: t1 })) } });
      await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
      for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true });
      return id;
    };
    const [d, m, y] = [day.slice(8, 10), day.slice(5, 7), day.slice(0, 4)];
    const row = (ma, open, tong) => ({ ma_ca: ma, store: 'Milano Coffee - Lê Hồng Phong', open: `${d}/${m}/${y} ${open}`, close: `${d}/${m}/${y} 23:00`,
      dau: 1000000, cuoi: 3000000, net: 5000000, hd: 100, tong, pay: [{ name: 'CHUYỂN KHOẢN', amount: 3000000 }, { name: 'Tiền mặt', amount: 2000000 }], tra_no: [], sua: [], items: [], groups: [] });
    const idLech = await mkReport(shift('Sáng'), 2820000, -180000, '06:45', '12:39');   // gõ thiếu Tổng tiền 180.000
    await mkReport(shift('Chiều'), 3000000, 0, '12:39', '17:20');                       // khớp, nhưng web đã sửa Tiền đầu ca
    const st = (await rpc('app_ca_get', { p_id: idLech })).status;
    await rpc('app__test_fabi_seed', { p_rows: [row('T136A', '06:55', 3000000), row('T136B', '12:40', 3000000), row('T136C', '17:30', 3000000)],
      p_fixed: { T136B: [{ field: 'opening_cash', label: 'Tiền đầu ca', before: 900000, fabi: 1000000 }] } });
    r.push(`phiếu thử ${st}`);
    location.hash = '#/__tam'; await sleep(200); location.hash = `#/ke-toan/fabi?cn=${br}&ngay=${day}`; await wait('#fb-day-detail'); await sleep(800);
    check(!$('.alert.error:not([hidden])') && $('#root h1') && /File ca Fabi/i.test(txt($('#root h1'))), `Mở được tab (${role})`);
    // khung Ca cần quản lý xem
    const rows = $$('#fb-review .fb-review-row');
    check(rows.length === 3, `Khung "Ca cần quản lý xem" có 3 ca: ${rows.map(txt).join(' | ')}`);
    check(rows.some((x) => /Gõ khác Fabi: Tổng tiền, Tiền chênh lệch/.test(txt(x))), 'Dòng ca gõ khác Fabi ghi rõ mục sai');
    check(rows.some((x) => /Web đã sửa theo Fabi: Tiền đầu ca/.test(txt(x))), 'Dòng ca chỉ có số web đã sửa vẫn ghi lý do');
    check(rows.some((x) => /chưa có phiếu nhân viên/.test(txt(x))), 'Dòng ca chưa có phiếu');
    // thẻ ca lệch
    const card = $('#fb-ca-T136A');
    check(!!card && /thiếu 180\.000đ/.test(txt($('.fb-reason', card))), `Câu lỗi: ${txt($('.fb-reason', card))}`);
    const tb = $('table.fb-cmp', card); const trs = $$('tbody tr', tb);
    check(trs.length === 7, `Bảng so sánh 7 dòng: ${trs.map((x) => txt(x.cells[0])).join(', ')}`);
    const bad = trs.filter((x) => x.classList.contains('bad')).map((x) => txt(x.cells[0]));
    check(bad.join(',') === 'Tổng tiền,Tiền chênh lệch', `Dòng tô đỏ: ${bad.join(', ')}`);
    const tong = trs.find((x) => txt(x.cells[0]) === 'Tổng tiền');
    check(/2\.820\.000/.test(txt(tong.cells[1])) && /3\.000\.000/.test(txt(tong.cells[2])) && /180\.000/.test(txt(tong.cells[3])), `Dòng Tổng tiền: ${txt(tong)}`);
    check(!$('details table.fb-cmp', card), 'Bảng hiện sẵn, không nằm trong mục thu gọn');
    check(/Người chốt phiếu/.test(txt(card)), 'Có người chốt phiếu');
    const cardB = $('#fb-ca-T136B');
    check(!!cardB && /Web đã sửa số đối soát theo Fabi: Tiền đầu ca 900\.000 → 1\.000\.000/.test(txt(cardB)), 'Thẻ ca web đã sửa hiện dòng sửa');
    // ô bảng tuần
    const cell = $(`.fb-cell.review[data-day="${day}"]`);
    check(!!cell && /Tổng tiền/.test(txt(cell)), `Ô tuần ghi loại lỗi: ${txt(cell)}`);
    // quyền
    const canUp = !!$('#fb-file'), sync = !!$('.fb-sync'), ds = !!$('#fb-ca-T136A a.fb-open-ds');
    if (role === 'ql') check(!canUp && !sync && ds, 'Quản lý: không có nút tải / đồng bộ, có Mở đối soát ca');
    else if (role === 'kt') check(canUp && sync && !ds, 'Kế toán: có nút tải, không có Mở đối soát ca');
    else check(canUp && sync && ds, 'Chủ: có nút tải và Mở đối soát ca');
    check(document.documentElement.scrollWidth <= document.documentElement.clientWidth, `Không tràn ngang (${document.documentElement.clientWidth}/${document.documentElement.scrollWidth})`);
    // nút Xem
    $('#fb-review [data-ca="T136A"]').click(); await sleep(1200);
    check(/ca=T136A/.test(location.hash) && !!$('#fb-ca-T136A'), `Bấm Xem → ${location.hash}`);
  } catch (e) { fail = e.message || String(e); }
  out.push({ route: 'file ca Fabi 136', title: (fail ? `KIỂM TRA THẤT BẠI: ${fail} || ` : `ĐẠT ${r.length} kiểm tra || `) + r.join(' || '), len: 0, errs: [...window.__ERR] });
};
