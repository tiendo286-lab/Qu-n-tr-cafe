// Bước 42: kế toán tải file chi tiết ca Fabi (role=chu): tạo 1 phiếu đã gửi, dựng 2 file Excel giống Fabi (1 khác số, 1 cửa hàng lạ) → tải lên → bảng + thông báo
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    for (const m of ['../js/excel.js', '../js/pages/ke_toan_fabi.js']) await Promise.race([import(m).catch(() => {}), sleep(4000)]);
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const lhp = ov.find((x) => x.branch_code === 'LHP' && x.shift === 'Sáng') || ov[0];
    const id = await rpc('app_ca_open', { p_branch: lhp.branch_id, p_date: day, p_shift: lhp.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: id });
    await rpc('app_ca_save', { p_id: id, p: { rev_start: day + ' 06:45', rev_end: day + ' 12:39', total_revenue: 5000000, pos_cash: 2000000, pos_transfer: 3000000, reported_transfer: 3000000,
      cash_counted: 3200000, ipos_opening: 1000000, pos_debt: 0, pos_diff: 200000, diff_note: 'không rõ', cups: 100, moves: [], goods: [], handover: [], debts: [],
      staff: (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true });
    r.push('phiếu thử: ' + (await rpc('app_ca_get', { p_id: id })).status);
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ke-toan/fabi'; await wait('#fb-file'); await sleep(500);
    r.push(`Trang: ${txt('#root h1')} · ${txt('.alert')} · ${W()}`);
    r.push(`Ca còn thiếu (bước 44): ${txt('#kt-wait').slice(0, 260)}`);
    const X = await (await import('../js/excel.js')).xlsx();
    const [d, m, y] = [day.slice(8, 10), day.slice(5, 7), day.slice(0, 4)];
    const mk = (store, ma, tong) => {
      const aoa = [[`BÁO CÁO CA CHI TIẾT — ${store}`], [`Mã ca: ${ma}`, null, `Mở: ${d}/${m}/${y} 06:55`, null, `Đóng: ${d}/${m}/${y} 12:39`, 'NV: thungan@x'], [],
        ['TIỀN TRONG KÉT'], ['Số dư đầu ca', 1000000], ['Số dư cuối ca', 3000000], [], ['CHỈ SỐ DOANH THU'], ['Doanh thu (net)', 5000000], ['Tổng số hoá đơn', 100], [],
        ['PHƯƠNG THỨC THANH TOÁN'], ['Phương thức', 'Doanh thu'], ['CHUYỂN KHOẢN', 3000000], ['Tiền mặt', 2000000], ['TỔNG', 5000000], [],
        ['MÓN'], ['Món', 'Số lượng', 'Doanh thu'], ['Café sữa - đá', 30, 750000], ['Trà mạn', 10, 150000], ['Craven điếu nhỏ', 2, 40000], ['Món thêm', 5, 25000], [],
        ['NHÓM MÓN'], ['Nhóm', 'Doanh thu'], ['CÀ PHÊ TRUYỀN THỐNG', 750000], ['TRÀ', 150000], ['ĐỒ ĂN & THUỐC LÁ', 40000], ['TOPPING', 25000], [],
        ['HOÁ ĐƠN SỬA/XOÁ'], ['Hoá đơn', 'Số tiền'], ['#EDT_1 - EDIT', 33000], [],
        ['THÔNG TIN TỜ TIỀN'], ['Mệnh giá', 'Số lượng', 'Tổng'], [500000, 6, tong - 20000], [10000, 2, 20000]];
      const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), 'Báo cáo ca');
      return new File([X.write(wb, { type: 'array', bookType: 'xlsx' })], `shift_report_detail_${ma}.xlsx`);
    };
    const dt = new DataTransfer();
    dt.items.add(mk('Milano Coffee - Lê Hồng Phong', 'TESTMA1', 3020000)); dt.items.add(mk('Cửa hàng lạ', 'TESTMA2', 3000000)); dt.items.add(new File(['abc'], 'linh_tinh.xlsx'));
    const inp = $('#fb-file'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
    for (let i = 0; i < 5000 && !$('tbody tr'); i++) await sleep(50);   // đọc file là việc thật, trình duyệt thử tua nhanh thời gian nên phải chờ nhiều vòng
    await sleep(800);
    r.push(`Sau tải: ${txt('.alert')} | ${txt('#fb-msg')}`);
    r.push(`Bảng: ${$$('tbody tr').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' || ')} · ${W()}`);
    const Rr = await rpc('app_ca_get', { p_id: id });
    r.push(`phiếu sau file: recon_status ${Rr.recon_status}`);
    // bước 49: số cốc — món chưa có nhóm → gợi ý theo tên → Lưu → số cốc = món không thuộc đồ ăn / thuốc lá / topping
    r.push(`Nhóm món: ${txt('#fb-menu h2')} · gợi ý: ${[...document.querySelectorAll('#fb-menu [data-mn]')].map((x) => `${x.dataset.mn}→${x.value || '?'}`).join(', ')} · ${W()}`);
    $('#fb-menu-save').click(); for (let i = 0; i < 300 && !document.querySelector('#fb-menu .pill.ok'); i++) await sleep(50); await sleep(500);
    r.push(`Sau Lưu: ${txt('#fb-menu h2')} · cột Số cốc: ${[...document.querySelectorAll('tbody td[data-label="Số cốc"]')].map((x) => x.innerText).join(' / ')} · phiếu số cốc ${(await rpc('app_ca_get', { p_id: id })).cups}`);
    // bảng tuần
    r.push(`Nút xem: ${txt('.ck-view')}`);
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ke-toan/fabi?xem=tuan&ngay=' + day; await wait('.ck-w-legend'); await sleep(800);
    r.push(`Bảng tuần: ${txt('.toolbar strong')} · ${$$('table.ck-w').length} bảng (${$$('.ck-w-h h2').map((h) => h.innerText).join(', ')}) · ${txt('.alert')} · ${txt('.ck-w-h .st-meta')}`);
    r.push(`Ô có số: ${$$('table.ck-w td.ck-w-c').map((x) => x.innerText.replace(/\s+/g, ' ')).filter((t) => t && t !== '—').slice(0, 3).join(' | ')} · ${W()}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'file ca Fabi', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
