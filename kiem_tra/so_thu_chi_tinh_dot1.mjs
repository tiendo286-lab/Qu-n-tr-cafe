// Bài thử hàm tính Sổ thu chi mới (đợt 1). Chạy: jsc -m kiem_tra/so_thu_chi_tinh_dot1.mjs
// (máy anh Tiến: /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc)
import { COLS, FLOAT, caChecks, caMoney, caState, compareDays, dayChain, dayTree, fundSummary, sumItems } from '../docs/js/so_thu_chi_tinh.js';

let n = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('KIỂM TRA THẤT BẠI: ' + msg); n++; };

// ---- Dữ liệu giả theo hợp đồng app_stc_month (số giả) ----
const SANG_16 = 31, TOI_16 = 33;
const SANG_17 = 11, CHIEU_17 = 12, TOI_17 = 13, CHO_KT = CHIEU_17;
const SANG_18 = 21, CHIEU_18 = 22, TOI_18 = 23, FULLTIME_18 = 24;
const TOQN_TM = 15000000;
const ca = (id, date, shift, o = {}) => ({ id, date, shift, staff: 'A, B', cash_mode: 'ngay', ql_counted: null, nv_counted: null,
  nv: { opening: 1000000, revenue: 0, debt: 0 }, fabi: { has: true, opening: 1000000, revenue: 0, tm: 0, ck: 0, debt: 0, edited_bills: 0 },
  bank_ck: 0, kt_wait: false, recon_money_done: true, ...o });
let k = 0;
const it = (date, caId, book, pm, col, amount, o = {}) => ({ id: 'x:' + (++k), date, ca_id: caId, book, pm, col, amount, title: col, meta: '', cat: null,
  cat_type: null, checked: true, no_cost: false, status: null, status_cls: null, from: null, who: null, to_qn: false, recv: null, src: 'test', ...o });
const dt = (date, caId, tm, ck) => [it(date, caId, 'thu', 'tm', 'dt', tm), it(date, caId, 'thu', 'ck', 'dt', ck)].filter((x) => x.amount);

const D = {
  branch: { id: 1, code: 'LHP', name: 'LHP' }, branches: [{ id: 1, code: 'LHP' }], owner: true,
  month: '2026-11', from: '2026-11-01', to: '2026-11-30', locked: false,
  opening: { tm: 8500000, ck: 12300000 },
  cas: [
    ca(SANG_16, '2026-11-16', 'Sáng'), ca(TOI_16, '2026-11-16', 'Tối'),
    ca(SANG_17, '2026-11-17', 'Sáng'), ca(CHIEU_17, '2026-11-17', 'Chiều', { kt_wait: true, bank_ck: null, recon_money_done: false, nv: { opening: 2220000, revenue: 0, debt: 0 }, fabi: { has: true, opening: 2220000, revenue: 0, tm: 0, ck: 0, debt: 0, edited_bills: 0 } }), ca(TOI_17, '2026-11-17', 'Tối'),
    ca(SANG_18, '2026-11-18', 'Sáng', { cash_mode: 'ca', ql_counted: 2350000 }),
    ca(CHIEU_18, '2026-11-18', 'Chiều', { recon_money_done: false, fabi: { has: true, opening: 1050000, revenue: 5150000, tm: 2100000, ck: 3050000, debt: 0, edited_bills: 0 }, nv: { opening: 1050000, revenue: 5150000, debt: 0 } }),
    ca(TOI_18, '2026-11-18', 'Tối'), ca(FULLTIME_18, '2026-11-18', 'FULL TIME'),
  ],
  items: [
    ...dt('2026-11-16', SANG_16, 900000, 0), ...dt('2026-11-16', TOI_16, 800000, 0),
    ...dt('2026-11-17', SANG_17, 1720000, 2640000), ...dt('2026-11-17', CHIEU_17, 1980000, 2870000), ...dt('2026-11-17', TOI_17, 1610000, 2050000),
    it('2026-11-17', SANG_17, 'chi', 'tm', 'lc', 500000, { title: 'Khách CK rút tiền mặt' }), it('2026-11-17', SANG_17, 'thu', 'ck', 'lc', 500000, { title: 'Khách CK rút tiền mặt' }),
    it('2026-11-17', CHIEU_17, 'chi', 'tm', 'chi', 380000, { cat: null }),
    it('2026-11-17', null, 'chi', 'tm', 'lc', TOQN_TM, { to_qn: true, recv: 'da', title: 'Chuyển về Quỹ ngoài' }),
    ...dt('2026-11-18', SANG_18, 1850000, 2430000), ...dt('2026-11-18', CHIEU_18, 2100000, 3050000), ...dt('2026-11-18', TOI_18, 1540000, 2210000),
    it('2026-11-18', SANG_18, 'chi', 'tm', 'chi', 500000), it('2026-11-18', SANG_18, 'thu', 'tm', 'no', 200000, { from: 'ca Chiều 07/11' }),
    it('2026-11-18', TOI_18, 'chi', 'tm', 'chi', 1000000, { cat: 'Không tính', no_cost: true }), it('2026-11-18', TOI_18, 'chi', 'tm', 'lech', 30000),
    it('2026-11-18', FULLTIME_18, 'thu', 'ck', 'dt', 300000), it('2026-11-18', FULLTIME_18, 'chi', 'tm', 'chi', 50000),
    it('2026-11-18', null, 'chi', 'ck', 'lc', 20000000, { to_qn: true, recv: 'cho', title: 'Chuyển về Quỹ ngoài' }),
    it('2026-11-18', null, 'chi', 'tm', 'chi', 99, { void: true }),
  ],
  open_debts: [],
  compare: { fund_days: [], tc: { thu: 0, chi: 0 }, gaps: [] },
};

// 1. Cộng theo cột / loại tiền
ok(COLS.thu.map((c) => c[0]).join() === 'dt,no,khac,lc,lech' && COLS.chi.map((c) => c[0]).join() === 'chi,no,lc,lech', 'đủ cột theo công thức');
ok(sumItems(D.items, { book: 'thu', pm: 'tm', col: 'dt', date: '2026-11-18' }) + sumItems(D.items, { book: 'thu', pm: 'tm', col: 'dt', date: '2026-11-17' })
  === 1850000 + 2100000 + 1540000 + 1720000 + 1980000 + 1610000, 'doanh thu TM cộng đúng');
ok(sumItems(D.items, { book: 'thu', col: 'lc' }) === sumItems(D.items, { book: 'chi', col: 'lc', pm: 'tm' }) - TOQN_TM, 'cặp đổi tiền: vế vào = vế ra');
ok(sumItems(D.items, { book: 'chi', pm: 'tm', date: '2026-11-18', caId: null }) === 0, 'khoản đã gạch (void) không cộng');

// 2. Tiền của ca: Thu − Chi = Thực tế − Đầu ca
const m = caMoney(D.items, TOI_18, 1000000);
ok(m.tm.must === 1540000 && m.tm.real === 1510000 && m.tm.gap === -30000, 'ca Tối 18/11: phải có 1.540.000, thực tế 1.510.000, lệch −30.000');
ok((sumItems(D.items, { caId: TOI_18, pm: 'tm', book: 'thu' }) - sumItems(D.items, { caId: TOI_18, pm: 'tm', book: 'chi' })) === m.tm.real - m.tm.start, 'Thu − Chi = Thực tế − Đầu ca');
ok(m.ck.start === 0 && m.ck.must === 2210000 && m.ck.gap === 0, 'chuyển khoản đầu ca = 0');

// 3. Chuỗi tiền mở ca
const ch = dayChain(D, '2026-11-18');
ok(ch.get(SANG_18).expOpen === FLOAT && ch.get(CHIEU_18).expOpen === FLOAT, 'ca Sáng 1.000.000; ca trước thu theo ca → 1.000.000');
const ch17 = dayChain(D, '2026-11-17');
ok(ch17.get(TOI_17).expOpen === ch17.get(CHIEU_17).money.tm.real, 'thu theo ngày → bằng thực tế ca trước');
ok(!ch.has(FULLTIME_18) && dayTree(D, 'thu', 'tm')[0].cas.some((c) => c.caId === FULLTIME_18), 'FULL TIME ngoài chuỗi két nhưng vẫn trong sổ');
const ch16 = dayChain(D, '2026-11-16');
ok(ch16.get(TOI_16).expOpen === ch16.get(SANG_16).money.tm.real, 'ngày thiếu ca Chiều: ca Tối mở bằng thực tế ca Sáng');

// 4. Ô đối chiếu và trạng thái ca
const ck = caChecks(D.cas.find((c) => c.id === CHO_KT), ch17.get(CHO_KT));
ok(ck.map((c) => c.k).join() === 'mo,dt,no,tm,ck', '5 ô đúng thứ tự');
ok(ck.find((c) => c.k === 'ck').st === 'kt', 'chờ kế toán: ô CK là kt, không đỏ');
const c18 = D.cas.find((c) => c.id === CHIEU_18);
const st18 = caState(c18, caChecks(c18, ch.get(CHIEU_18)));
ok(st18.k === 'lech' && st18.txt.startsWith('🔴') && st18.txt.includes('Tiền mở ca'), 'mở ca sai → đỏ, ghi tên ô');
const t18 = D.cas.find((c) => c.id === TOI_18);
ok(caState(t18, caChecks(t18, ch.get(TOI_18))).k === 'chot', 'ca đã đối soát phần tiền → Đã chốt');
ok(caState(D.cas.find((c) => c.id === CHO_KT), ck).k === 'kt', 'ca chờ kế toán chưa chốt → Chờ kế toán');

// 5. Tồn quỹ
const F = fundSummary(D);
ok(F.tm.ton === D.opening.tm + F.tm.thu - F.tm.chi - F.tm.toQN, 'tồn quỹ = đầu + thu − chi − về Quỹ ngoài');
ok(F.tm.toQN === TOQN_TM && F.ck.toQN === 20000000, 'tách tiền chuyển về Quỹ ngoài');
ok(F.daily.tm[0].date === '2026-11-18' && F.daily.tm[0].end === F.tm.ton && F.daily.ck[0].end === F.ck.ton, 'cuối ngày mới nhất = tồn quỹ');
ok(F.daily.tm.every((d, i, a) => i === a.length - 1 || a[i + 1].end === d.start), 'đầu ngày = cuối ngày trước');
ok(F.waitQN.length === 1 && F.waitQN[0].recv === 'cho', '1 khoản chờ Chủ nhận');

// 6. So với trang cũ
ok(compareDays({ ...D, compare: { ...D.compare, fund_days: [{ date: '2026-11-18', tm: F.tm.ton + 20000, ck: F.ck.ton }] } }, F).length === 1, 'so trang cũ: 1 ngày khác');
const cd = compareDays({ ...D, compare: { ...D.compare, fund_days: [{ date: '2026-11-18', tm: F.tm.ton + 20000, ck: F.ck.ton }] } }, F)[0];
ok(cd.pm === 'tm' && cd.old === F.tm.ton + 20000 && cd.neu === F.tm.ton && cd.diff === -20000, 'dòng khác ghi số cũ / mới / chênh');
ok(compareDays({ ...D, compare: { ...D.compare, fund_days: [{ date: '2026-11-17', tm: F.daily.tm[1].end, ck: F.daily.ck[1].end }] } }, F).length === 0, 'khớp thì không có dòng');

// 7. Lọc cột
ok(dayTree(D, 'chi', 'tm', 'lech').length === 1 && dayTree(D, 'chi', 'tm', 'lech').every((d) => d.total > 0 && d.cas.every((c) => c.total > 0)), 'lọc cột bỏ ngày / ca có tổng 0');
const d18 = dayTree(D, 'chi', 'tm')[0];
ok(d18.date === '2026-11-18' && d18.cas.map((c) => c.shift).join() === 'Sáng,Chiều,Tối,FULL TIME' && d18.outside.items.length === 0, 'ca theo thứ tự Sáng · Chiều · Tối, ca khác sau; khoản gạch không vào ngoài ca');
ok(d18.byCol.chi === 500000 + 1000000 + 50000 && d18.byCol.lech === 30000, 'tổng theo cột của ngày');
ok(dayTree(D, 'thu', 'tm', 'dt').every((d) => d.date >= '2026-11-16'), 'ngày đúng');

print('ĐẠT ' + n + ' kiểm tra');
