// Dữ liệu GIẢ cho bài thử Sổ thu chi mới (đợt 1) — cùng dạng kết quả app_stc_month / app_stc_ext. Số giả, tên giả.
import { fundSummary } from '../js/so_thu_chi_tinh.js';

let k = 0;
// bước 171: ca đã xác nhận Fabi từ trước coi như đã bấm Hoàn thành đối soát ca (done), như phần chạy bù của tệp 150
const ca = (id, date, shift, o = {}) => { const c = { id, date, shift, staff: 'Lan, Minh', cash_mode: 'ngay', ql_counted: null, nv_counted: null, start_tm: 1000000, real_tm: null,
  nv: { opening: 1000000, revenue: 0, debt: 0 }, fabi: { has: true, opening: 1000000, revenue: 0, tm: 0, ck: 0, debt: 0, edited_bills: 0 },
  bank_ck: 0, kt_wait: false, kt_missing: [], recon_money_done: true, ticks: [], ...o };
  if (c.done === undefined) c.done = c.recon_money_done ? { by: '', at: 'trước bước 171' } : null;
  return c; };
const it = (date, caId, book, pm, col, amount, o = {}) => ({ id: 'z:' + (++k), date, ca_id: caId, book, pm, col, amount, title: col, meta: 'Phiếu ca', cat: null,
  cat_type: null, checked: true, no_cost: false, status: null, status_cls: null, from: null, who: null, to_qn: false, recv: null, src: 'move', ...o });
// chi tiết lệch (đợt 3) — cùng dạng gap của app_stc_month
const G = (kind, total, names, o = {}) => ({ item: 'tien_mat', kind, total, remain: total, avail: total, people: names.map((name, i) => ({ id: 900 + i, name })),
  tl: [], decisions: [], matches: [], qc_wait: [], cands: [], debts: [], has_tl: false, has_thu: false, ...o });
const dt = (date, caId, tm, ck) => [it(date, caId, 'thu', 'tm', 'dt', tm, { title: 'Doanh thu', src: 'dt' }), it(date, caId, 'thu', 'ck', 'dt', ck, { title: 'Doanh thu', src: 'dt' })];
const rev = (tm, ck, o = {}) => ({ nv: { opening: 1000000, revenue: tm + ck, debt: 0 }, fabi: { has: true, opening: 1000000, revenue: tm + ck, tm, ck, debt: 0, edited_bills: 0 }, bank_ck: ck, ...o });

const D14 = '2026-11-14', D15 = '2026-11-15', D16 = '2026-11-16', D17 = '2026-11-17', D18 = '2026-11-18';
const cas = [
  ca(141, D14, 'Sáng', rev(1760000, 2580000)), ca(142, D14, 'Chiều', rev(2050000, 3120000)), ca(143, D14, 'Tối', rev(1640000, 2400000)),
  ca(151, D15, 'Sáng', rev(1930000, 2760000)), ca(152, D15, 'Chiều', rev(2380000, 3610000)), ca(153, D15, 'Tối', rev(1820000, 2690000)),
  ca(161, D16, 'Sáng', rev(2010000, 2980000)), ca(162, D16, 'Chiều', rev(2260000, 3420000)), ca(163, D16, 'Tối', rev(1700000, 2530000)),
  ca(171, D17, 'Sáng', rev(1720000, 2640000)), ca(172, D17, 'Chiều', rev(1980000, 2870000, { kt_wait: true, bank_ck: null, kt_missing: ['chuyển khoản ngân hàng (0/1 tài khoản)'], recon_money_done: false })),
  ca(173, D17, 'Tối', rev(1610000, 2050000)),
  // chặng 4 (tệp 162 — Nợ bill phải bằng danh sách khách nợ HĐ của ca): ca 181 có khách nợ HĐ Bàn 9 100.000 (id 705) → NV khai + máy Fabi cùng ghi 100.000
  ca(181, D18, 'Sáng', rev(1850000, 2430000, { cash_mode: 'ca', ql_counted: 2072000, recon_money_done: true,
    nv: { opening: 1000000, revenue: 4280000, debt: 100000 }, fabi: { has: true, opening: 1000000, revenue: 4280000, tm: 1850000, ck: 2430000, debt: 100000, edited_bills: 0 } })),
  ca(182, D18, 'Chiều', { ...rev(2100000, 3050000), staff: 'Hà, Tú', recon_money_done: false, start_tm: 1050000,
    nv: { opening: 1500000, revenue: 5150000, debt: 120000 }, fabi: { has: true, opening: 1050000, revenue: 5150000, tm: 2100000, ck: 3050000, debt: 150000, edited_bills: 0 } }),
  ca(183, D18, 'Tối', { ...rev(1540000, 2210000), staff: 'Tú, Ngọc' }),
];
// tiền đầu ca thật theo chuỗi két (ca Sáng 1.000.000; thu theo ngày: bằng ca trước để lại)
const items = [
  ...dt(D14, 141, 1760000, 2580000), ...dt(D14, 142, 2050000, 3120000), ...dt(D14, 143, 1640000, 2400000),
  it(D14, 142, 'chi', 'tm', 'chi', 65000, { title: 'Mua chanh, cam', cat: 'Nguyên liệu' }), it(D14, 143, 'thu', 'tm', 'lech', 10000, { id: 'g:143:tm', title: 'Ca dư tiền', src: 'gap', status: 'Chờ xử lý (dư)', gross: 10000, gap: G('du', 10000, ['Lan', 'Minh']) }),
  ...dt(D15, 151, 1930000, 2760000), ...dt(D15, 152, 2380000, 3610000), ...dt(D15, 153, 1820000, 2690000),
  it(D15, 151, 'chi', 'tm', 'chi', 50000, { title: 'Mua đá', cat: 'Nguyên liệu' }), it(D15, 152, 'chi', 'tm', 'chi', 120000, { title: 'Mua cốc giấy', cat: 'Vật dụng' }),
  it(D15, 152, 'chi', 'tm', 'lech', 40000, { id: 'g:152:tm', title: 'Ca thiếu tiền', src: 'gap', status: 'Đã xử lý', gross: 40000,
    gap: G('thieu', 40000, ['Lan', 'Minh'], { remain: 0, avail: 0, has_tl: true, tl: [{ id: 71, name: 'Lan', amount: 20000, status: 'tru_luong', reply: 'Em đếm nhầm tờ 20 nghìn' }, { id: 72, name: 'Minh', amount: 20000, status: 'tru_luong' }] }) }),
  it(D15, 153, 'chi', 'ck', 'chi', 350000, { title: 'Thợ sửa máy xay', cat: 'Sửa chữa & thiết bị' }), it(D15, 153, 'chi', 'tm', 'no', 500000, { title: 'Khách mượn – Anh Vinh', meta: 'Khách mượn tiền két (Nợ TM)' }),
  ...dt(D16, 161, 2010000, 2980000), ...dt(D16, 162, 2260000, 3420000), ...dt(D16, 163, 1700000, 2530000),
  it(D16, 161, 'chi', 'tm', 'chi', 50000, { title: 'Mua đá', cat: 'Nguyên liệu' }), it(D16, 161, 'chi', 'tm', 'chi', 35000, { title: 'Bút, sổ ghi order', cat: 'Khác' }),
  it(D16, 162, 'chi', 'tm', 'lech', 50000, { id: 'g:162:tm', title: 'Ca thiếu tiền', src: 'gap', status: 'Chờ xử lý · chưa làm phiếu trừ tiền · ⏳ chờ Chủ duyệt', gross: 50000,
    gap: G('thieu', 50000, ['Lan', 'Minh'], { avail: 0, qc_wait: [{ id: 5, amount: 50000, by: 'Quản lý tổng' }] }) }),
  it(D16, 163, 'chi', 'tm', 'chi', 250000, { title: 'Chi lương – Phong', meta: 'Lương trả tiền mặt', cat: 'Lương' }),
  it(D16, 163, 'thu', 'tm', 'no', 180000, { title: 'Chị Hoa', meta: 'Khách trả nợ trong ca', from: 'ca Chiều 12/11', src: 'debt' }),
  it(D16, null, 'chi', 'ck', 'chi', 280000, { title: 'Internet tháng 11', meta: 'Quản lý tạo', cat: 'Internet', src: 'entry' }),
  it(D16, null, 'chi', 'tm', 'lc', 15000000, { title: 'Chuyển về Quỹ ngoài', meta: 'Phiếu rút giữ hộ (cũ)', to_qn: true, recv: 'da', status: 'Chủ đã nhận · khoá', src: 'withdrawal' }),
  ...dt(D17, 171, 1720000, 2640000), ...dt(D17, 172, 1980000, 2870000), ...dt(D17, 173, 1610000, 2050000),
  it(D17, 171, 'thu', 'tm', 'khac', 60000, { title: 'Bán vỏ thùng carton', cat: 'Thu khác' }), it(D17, 171, 'chi', 'tm', 'chi', 70000, { title: 'Mua chanh', cat: 'Nguyên liệu' }),
  it(D17, 172, 'chi', 'tm', 'chi', 380000, { title: 'Đổi bình gas', checked: false }),
  it(D17, 173, 'thu', 'tm', 'no', 260000, { title: 'Bàn 12', meta: 'Khách trả nợ trong ca', from: 'ca Sáng 17/11', src: 'debt' }),
  it(D17, 173, 'chi', 'ck', 'no', 90000, { title: 'Nợ CK – Anh Dũng', src: 'debt' }),
  it(D17, null, 'chi', 'tm', 'lc', 10000000, { title: 'Nộp tiền mặt vào tài khoản', meta: 'Luân chuyển quỹ', src: 'transfer', id: 't:1:chi' }),
  it(D17, null, 'thu', 'ck', 'lc', 10000000, { title: 'Nộp tiền mặt vào tài khoản', meta: 'Luân chuyển quỹ', src: 'transfer', id: 't:1:thu' }),
  ...dt(D18, 181, 1850000, 2430000), ...dt(D18, 182, 2100000, 3050000), ...dt(D18, 183, 1540000, 2210000),
  it(D18, 181, 'thu', 'tm', 'no', 200000, { title: 'Anh Hùng', meta: 'Khách trả nợ trong ca', from: 'ca Chiều 07/11', src: 'debt' }),
  it(D18, 181, 'chi', 'tm', 'chi', 50000, { title: 'Mua đá', cat: 'Nguyên liệu' }), it(D18, 181, 'chi', 'tm', 'chi', 300000, { title: 'Chi lương – Minh', meta: 'Lương trả tiền mặt', cat: 'Lương' }),
  it(D18, 181, 'chi', 'tm', 'no', 128000, { title: 'Khách mượn – Chị Hoa', meta: 'Khách mượn tiền két (Nợ TM)' }),
  it(D18, 181, 'chi', 'ck', 'no', 90000, { id: 'dn:501', title: 'Nợ CK – Anh Dũng', meta: 'Phiếu ca', src: 'debt', can_edit: true }),   // bước 155: cho nợ CK còn mở
  it(D18, 181, 'chi', 'tm', 'lc', 500000, { title: 'Khách chuyển khoản, lấy tiền mặt' }), it(D18, 181, 'thu', 'ck', 'lc', 500000, { title: 'Khách chuyển khoản, lấy tiền mặt' }),
  it(D18, 182, 'chi', 'tm', 'chi', 180000, { title: 'Mua sữa tươi', checked: false }), it(D18, 182, 'chi', 'ck', 'chi', 45000, { title: 'Phí ship nguyên liệu', cat: 'Nguyên liệu' }),
  it(D18, 183, 'chi', 'tm', 'chi', 1000000, { title: 'Quản lý lấy tiền két', cat: 'Không tính', no_cost: true }),
  it(D18, 183, 'chi', 'tm', 'lech', 30000, { id: 'g:183:tm', title: 'Ca thiếu tiền', src: 'gap', status: 'Chờ xử lý · chưa làm phiếu trừ tiền', gross: 30000,
    gap: G('thieu', 30000, ['Tú', 'Ngọc'], { cands: [{ report: 181, label: 'ca Sáng 18/11', amount: 20000 }] }) }),
  it(D18, 181, 'thu', 'tm', 'lech', 20000, { id: 'g:181:tm', title: 'Ca dư tiền', src: 'gap', status: 'Chờ xử lý (dư)', gross: 20000,
    gap: G('du', 20000, ['Lan', 'Minh'], { cands: [{ report: 183, label: 'ca Tối 18/11', amount: 30000 }] }) }),
  it(D18, null, 'chi', 'tm', 'chi', 1250000, { title: 'Tiền điện tháng 10', meta: 'Quản lý tạo', cat: 'Điện nước', src: 'entry' }),
  it(D18, null, 'thu', 'ck', 'no', 150000, { title: 'Cô Mai', meta: 'Quản lý thu ngoài ca', from: 'quản lý ghi', src: 'debt' }),
  it(D18, null, 'chi', 'ck', 'lc', 20000000, { id: 'w:902', title: 'Chuyển về Quỹ ngoài', meta: 'Phiếu rút giữ hộ (cũ)', to_qn: true, recv: 'cho', status: 'Chờ Chủ nhận', src: 'withdrawal' }),
];
// đợt 2a: khoản ngoài ca sửa được (khoản quản lý tạo, luân chuyển quỹ, thu nợ ngoài ca); khoản của ca chưa sửa được
items.forEach((x) => { x.can_edit = false; });
// đợt 2b: khoản thu chi thường của ca đã chốt tiền sửa được (mã m:<ca>:<khoá>)
items.forEach((x, i) => { if (x.ca_id && ['chi', 'khac'].includes(x.col) && x.meta === 'Phiếu ca') { x.id = `m:${x.ca_id}:k${i}`; x.src = 'move'; } });
{ const set = (title, id) => { const x = items.find((i) => i.title === title && i.ca_id === null); if (x) { x.id = id; x.can_edit = true; } };
  set('Internet tháng 11', 'e:901'); set('Tiền điện tháng 10', 'e:902'); set('Cô Mai', 'dc:3');
  items.filter((x) => x.src === 'transfer').forEach((x) => { x.can_edit = true; }); }
// tiền đầu ca thật: theo chuỗi két + thực tế
const byDate = {};
cas.forEach((c) => { (byDate[c.date] = byDate[c.date] || []).push(c); });
Object.values(byDate).forEach((list) => {
  let prev = null;
  list.forEach((c) => {
    if (c.id === 182) { prev = c; return; }   // ca Chiều 18/11: két nhận 1.050.000 (mở ca sai so với 1.000.000)
    c.start_tm = !prev || prev.cash_mode === 'ca' ? 1000000 : prev.real_tm;
    c.nv.opening = c.start_tm; c.fabi.opening = c.start_tm;
    const net = items.filter((x) => x.ca_id === c.id && x.pm === 'tm').reduce((a, x) => a + (x.book === 'thu' ? x.amount : -x.amount), 0);
    c.real_tm = c.start_tm + net; c.nv_counted = c.real_tm; prev = c;
  });
});
{ const c = cas.find((x) => x.id === 182); const net = items.filter((x) => x.ca_id === 182 && x.pm === 'tm').reduce((a, x) => a + (x.book === 'thu' ? x.amount : -x.amount), 0); c.real_tm = 1050000 + net; c.nv_counted = c.real_tm; }

items.forEach((x) => { if (x.id.startsWith('m:') || x.id.startsWith('dn:')) x.can_edit = !!cas.find((c) => c.id === x.ca_id)?.recon_money_done; });
const base = {
  branch: { id: 1, code: 'LHP', name: 'Lê Hồng Phong' },
  branches: [{ id: 1, code: 'LHP' }, { id: 2, code: 'ĐK' }, { id: 3, code: 'HS' }, { id: 4, code: 'LL' }, { id: 5, code: 'LLB' }],
  owner: true, month: '2026-11', from: '2026-11-01', to: '2026-11-30', locked: false,
  opening: { tm: 8500000, ck: 12300000 }, cas, items,
  open_debts: [
    { id: 'd:1', who: 'Bàn 5', kind: 'bill', amount: 50000, left: 50000, date: D16, from: 'ca Tối 16/11', no_remind: false },
    { id: 'd:2', who: 'Cô Lan Anh', kind: 'bill', amount: 20000, left: 20000, date: '2026-11-10', from: 'ca Chiều 10/11', no_remind: false },
    { id: 'd:3', who: 'Kho Tổng', kind: 'ck', amount: 300000, left: 300000, date: D16, from: 'quản lý ghi', no_remind: true },
    { id: 'd:501', who: 'Anh Dũng', kind: 'ck', amount: 90000, left: 90000, date: D18, from: 'ca Sáng 18/11', no_remind: false },
  ],
  // bước 159: ngày / ca trả (app_stc_month.debt_paid)
  debt_paid: { 703: { date: '2026-11-18', shift: 'Tối', pm: 'chuyen_khoan' }, 705: { date: '2026-11-19', shift: null, pm: 'tien_mat' } },
  // bước 157: nợ của ca (app_stc_month.ca_debts) — ca 182 chưa xác nhận, ca 181 đã xác nhận, ca 183 không nợ
  ca_debts: [
    { report_id: 182, t: 'moi', id: 701, who: 'Bàn 5', kind: 'bill', amount: 120000, left: 120000, pm: null, from: null },
    { report_id: 182, t: 'moi', id: 702, who: 'Bàn 3', kind: 'muon', amount: 85000, left: 85000, pm: null, from: null },
    { report_id: 182, t: 'moi', id: 703, who: 'Chị Lan', kind: 'ck', amount: 60000, left: 0, pm: null, from: null },
    { report_id: 182, t: 'tra', id: 704, who: 'Chú Hùng', kind: 'bill', amount: 200000, left: 0, pm: 'tien_mat', from: 'ca Tối 15/11' },
    { report_id: 181, t: 'moi', id: 705, who: 'Bàn 9', kind: 'bill', amount: 100000, left: 0, pm: null, from: null },
  ],
  compare: { fund_days: [], gaps: [{ ca_id: 183, pm: 'tm', lech: -30000, state: 'cho_gan' }, { ca_id: 152, pm: 'tm', lech: -40000, state: 'xong' }] },
  // bước 172: người nợ là danh sách thật (id, SĐT, nhóm công nợ, còn dùng) — app_stc_people trả các dòng này; no_remind giữ cho sổ tháng kiểu cũ
  people: [{ id: 1, name: 'Kho Tổng', phone: null, grp: 'kho', active: 1, no_remind: true, open: 300000, n: 1 },
    { id: 2, name: 'Bàn 5', phone: null, grp: 'khach', active: 1, no_remind: false, open: 50000, n: 1 },
    { id: 3, name: 'Cô Lan Anh', phone: '0903000003', grp: 'khach', active: 1, no_remind: false, open: 20000, n: 1 },
    { id: 4, name: 'Khách', phone: null, grp: 'khach', active: 1, no_remind: false, open: 0, n: 0, shared: true }],   // chặng 6.4: người chung "Khách"
};
const F = fundSummary(base);
const end = (pm, d) => F.daily[pm].find((x) => x.date === d).end;
base.compare.fund_days = [D16, D17, D18].map((d) => ({ date: d, tm: end('tm', d) + (d === D18 ? 20000 : 0), ck: end('ck', d) }));
export const MONTH = base;

export const EXT = {
  month: '2026-11', from: '2026-11-01', to: '2026-11-30', opening: { tm: 5000000, ck: 30000000 },
  branches: base.branches,
  items: [
    { id: 'w:901', date: D16, ca_id: null, book: 'thu', pm: 'tm', col: 'lc', amount: 15000000, title: 'Từ LHP chuyển về', meta: 'QL Bình tạo', cat: null, cat_type: null, checked: true, no_cost: true, status: 'Chủ đã nhận · khoá', from: 'LHP', who: null, to_qn: false, recv: 'da', chia: null, src: 'withdrawal' },
    { id: 'w:902', date: D18, ca_id: null, book: 'thu', pm: 'ck', col: 'lc', amount: 20000000, title: 'Từ LHP chuyển về', meta: 'QL Bình tạo', cat: null, cat_type: null, checked: true, no_cost: true, status: 'Chờ Chủ nhận', from: 'LHP', who: null, to_qn: false, recv: 'cho', chia: null, src: 'withdrawal' },
    { id: 'x:1', date: D16, ca_id: null, book: 'chi', pm: 'ck', col: 'chi', amount: 25000000, title: 'Tiền nhà tháng 11', meta: 'Chủ ghi', cat: 'Mặt bằng', cat_type: null, checked: true, no_cost: false, status: null, from: null, who: null, to_qn: false, recv: null, chia: 'Chia đều các cơ sở', src: 'ext' },
    { id: 'x:2', date: D17, ca_id: null, book: 'chi', pm: 'tm', col: 'chi', amount: 6000000, title: 'Mua máy xay cho HS', meta: 'Chủ ghi', cat: 'Sửa chữa & thiết bị', cat_type: null, checked: true, no_cost: false, status: null, from: null, who: null, to_qn: false, recv: null, chia: '1 cơ sở: HS', src: 'ext' },
  ],
};
