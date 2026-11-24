// Bài thử trang đối soát ca mới — đợt 1 (chỉ xem): sổ tiền mặt / chuyển khoản của ca, trạng thái 3 trang, còn thiếu, xác nhận khi Hoàn thành.
// Thiết kế: tai_lieu/superpowers/specs/2026-11-24-trang-doi-soat-ca-moi-design.md (mục 5.2). Kế hoạch: tai_lieu/superpowers/plans/2026-11-24-trang-doi-soat-ca-moi-dot-1.md (Task 1).
// Chạy: jsc -m kiem_tra/doi_soat_moi_tinh_dot1.mjs (dữ liệu giả tự dựng, không dùng dữ liệu thật).
import { caBook, pageState, missingList, confirmList, isClean, CHK_LABEL, WORK_LABEL } from '../docs/js/doi_soat_moi_tinh.js';
import { caMoney } from '../docs/js/so_thu_chi_tinh.js';
let n = 0;
const ok = (c, m) => { if (!c) throw new Error('KIỂM TRA THẤT BẠI: ' + m); n++; };
const ID = 501;
const it = (o) => ({ ca_id: ID, date: '2026-11-19', void: false, ...o });
const baseCa = (o = {}) => ({ id: ID, date: '2026-11-19', shift: 'Sáng', cash_mode: 'ngay', start_tm: 1000000, real_tm: 1496000, bank_ck: 1676000,
  kt_wait: false, ql_counted: null, recon_money_done: false, ticks: [], bill_list: 0,
  fabi: { has: true, opening: 1000000, revenue: 2184000, debt: 0, tm: 770000, ck: 1414000, edited_bills: 0 },
  nv: { opening: 1000000, revenue: 2184000, debt: 0 }, ...o });
const dt = [it({ id: 'f:501:tm', book: 'thu', pm: 'tm', col: 'dt', amount: 770000, src: 'dt' }), it({ id: 'f:501:ck', book: 'thu', pm: 'ck', col: 'dt', amount: 1414000, src: 'dt' })];
const chi = [it({ id: 'm:501:a#1', book: 'chi', pm: 'tm', col: 'chi', amount: 70000, title: 'Mua sữa tươi', cat: 'Nguyên liệu', meta: 'Phiếu ca', src: 'move' }),
  it({ id: 'm:501:b#1', book: 'chi', pm: 'tm', col: 'chi', amount: 30000, title: 'Mua đá viên', cat: 'Nguyên liệu', meta: 'Phiếu ca', src: 'move' })];
const thu = [it({ id: 'm:501:c#1', book: 'thu', pm: 'tm', col: 'khac', amount: 20000, title: 'Bán vỏ chai', meta: 'Phiếu ca', src: 'move', edit: { action: 'them' } }),
  it({ id: 'dc:77', book: 'thu', pm: 'tm', col: 'no', amount: 55000, title: 'Bàn 5', meta: 'Khách trả nợ trong ca', src: 'debt' })];
const lech = [it({ id: 'g:501:tm', book: 'chi', pm: 'tm', col: 'lech', amount: 249000, gross: 249000, status: 'Chờ xử lý · chưa làm phiếu trừ tiền', gap: {} }),
  it({ id: 'g:501:ck', book: 'thu', pm: 'ck', col: 'lech', amount: 262000, gross: 262000, status: 'Chờ xử lý (dư)', gap: {} })];
const voided = it({ id: 'v:9', book: 'chi', pm: 'tm', col: 'chi', amount: 999000, title: 'Khoản đã xoá', void: true, src: 'move' });
const D = (ca, items) => ({ cas: [ca], items, ca_debts: [] });
const R = (checks = { nhan_su: {}, ban_giao: {}, nhap_hang: {} }) => ({ id: ID, checks });

// 1a. sổ tiền mặt: mở ca → bán → thu → chi → phải có; bằng caMoney của trang cũ
const d1 = D(baseCa(), [...dt, ...thu, ...chi, ...lech, voided]);
const b1 = caBook(d1, d1.cas[0]);
const m1 = caMoney(d1.items, ID, 1000000);
ok(b1.tm.start === 1000000 && b1.tm.ban === 770000, '1a. mở ca 1.000.000, bán tiền mặt 770.000');
ok(b1.tm.tongThu === 75000 && b1.tm.tongChi === 100000, '1a. tổng thu 75.000, tổng chi 100.000');
ok(b1.tm.must === 1745000 && b1.tm.must === m1.tm.must, `1a. phải có 1.745.000 = caMoney (${b1.tm.must} / ${m1.tm.must})`);
ok(b1.ck.must === 1414000 && b1.ck.must === m1.ck.must, '1a. chuyển khoản phải nhận 1.414.000 = caMoney');
ok(b1.tm.thu.map((x) => x.kind).join('|') === 'Thu khác|Khách trả nợ', '1a. loại khoản thu: Thu khác, Khách trả nợ');
ok(b1.tm.thu[0].who === 'QL ghi' && b1.tm.chi[0].who === 'NV ghi', '1a. ai ghi: quản lý thêm = QL ghi, phiếu ca = NV ghi');
ok(b1.tm.chi[0].cat === 'Nguyên liệu' && b1.tm.chi[0].title === 'Mua sữa tươi' && b1.tm.chi[0].amount === 70000, '1a. khoản chi có nhóm, nội dung, số tiền');
// 1b. khoản đã xoá và dòng chênh lệch không nằm trong thu / chi
ok(!b1.tm.chi.some((x) => x.id === 'v:9') && !b1.tm.thu.concat(b1.tm.chi).some((x) => x.col === 'lech'), '1b. bỏ khoản đã xoá và dòng chênh lệch');
// 1c. luân chuyển tiền mặt → chuyển khoản: chi ở mục tiền mặt, thu ở mục chuyển khoản; tổng vẫn bằng caMoney
const lc = [it({ id: 't:3:chi', book: 'chi', pm: 'tm', col: 'lc', amount: 200000, title: 'Nộp tiền mặt vào tài khoản', src: 'transfer' }),
  it({ id: 't:3:thu', book: 'thu', pm: 'ck', col: 'lc', amount: 200000, title: 'Nộp tiền mặt vào tài khoản', src: 'transfer' })];
const d2 = D(baseCa(), [...dt, ...chi, ...lc]);
const b2 = caBook(d2, d2.cas[0]); const m2 = caMoney(d2.items, ID, 1000000);
ok(b2.tm.chi.some((x) => x.kind === 'Luân chuyển ra' && x.amount === 200000), '1c. luân chuyển ra ở mục tiền mặt');
ok(b2.ck.thu.some((x) => x.kind === 'Luân chuyển vào' && x.amount === 200000), '1c. luân chuyển vào ở mục chuyển khoản');
ok(b2.tm.must === m2.tm.must && b2.ck.must === m2.ck.must, `1c. phải có / phải nhận bằng caMoney (${b2.tm.must}/${m2.tm.must}, ${b2.ck.must}/${m2.ck.must})`);
// 1d. chờ kế toán → chuyển khoản chưa có thực nhận; có số ngân hàng → lệch dư 262.000
const d3 = D(baseCa({ kt_wait: true }), [...dt, ...thu, ...chi, ...lech]);
const b3 = caBook(d3, d3.cas[0]);
ok(b3.ck.real === null && b3.ck.gap === null, '1d. chờ kế toán: chuyển khoản thực nhận / lệch để trống');
ok(b1.ck.real === 1676000 && b1.ck.gap === 262000, `1d. ngân hàng 1.676.000, lệch dư 262.000 (${b1.ck.real}, ${b1.ck.gap})`);
// 1e. tiền mặt thực nhận 1.496.000 → thiếu 249.000
ok(b1.tm.real === 1496000 && b1.tm.gap === -249000, `1e. tiền mặt thiếu 249.000 (${b1.tm.real}, ${b1.tm.gap})`);
// 1f. trạng thái trang ①: thiếu Bàn giao
const s1 = pageState(d1, d1.cas[0], R({ nhan_su: {}, nhap_hang: {} }), null);
ok(s1.viec.ok === false && s1.viec.left.includes(WORK_LABEL.ban_giao) && s1.viec.left.length === 1, '1f. phần việc còn thiếu Bàn giao');
ok(pageState(d1, d1.cas[0], R(), { viec: { thieu: ['Chờ Chủ duyệt x2'] } }).viec.left[0] === 'Chờ Chủ duyệt x2', '1f. có dòng tuần thì lấy danh sách thiếu của máy chủ');
// 1g. còn thiếu: không có Xác nhận Fabi và 4 ô cơ bản; có lệch chưa xử lý và lý do lệch
const miss = missingList(d1, d1.cas[0], R(), null);
const ks = miss.map((x) => x.k);
ok(!['fabi', 'anh', 'sot', 'that', 'goi'].some((k) => ks.includes(k)), `1g. không liệt kê fabi / 4 ô cơ bản (${ks.join(',')})`);
ok(ks.includes('tm') && ks.includes('ck5') && ks.includes('ld') && ks.includes('tn'), `1g. có lệch tiền mặt, lệch chuyển khoản, lý do lệch, thu nợ (${ks.join(',')})`);
ok(miss.every((x) => x.page === 'tien' && x.text === CHK_LABEL[x.k]), '1g. mục tiền ở trang Tiền, chữ đúng CHK_LABEL');
ok(missingList(d1, d1.cas[0], R({}), null).filter((x) => x.page === 'viec').length === 3, '1g. thiếu cả 3 mục phần việc thì liệt kê ở trang Phần việc');
// 1h. xác nhận khi Hoàn thành: thu theo ca, có chi → 4 ô cơ bản theo thứ tự
const d4 = D(baseCa({ cash_mode: 'ca', ql_counted: 1496000 }), [...dt, ...chi]);
ok(confirmList(d4, d4.cas[0]).join('|') === [CHK_LABEL.anh, CHK_LABEL.sot, CHK_LABEL.that, CHK_LABEL.goi].join('|'), `1h. 4 ô cơ bản (${confirmList(d4, d4.cas[0]).join(' | ')})`);
const tk = baseCa({ ticks: ['anh', 'sot'] });
ok(!confirmList(D(tk, [...dt]), tk).includes(CHK_LABEL.anh), '1h. ô đã tích không còn trong danh sách xác nhận');
// 1i. ca khớp hết
const clean = baseCa({ real_tm: 1670000, bank_ck: 1414000 });
const dc = D(clean, [...dt, ...chi]);
ok(isClean(dc, clean, R(), null) === true, '1i. ca khớp hết → mở thẳng trang Hoàn thành');
ok(isClean(d1, d1.cas[0], R(), null) === false, '1i. ca có lệch → không phải khớp hết');
ok(isClean(D(baseCa({ kt_wait: true, real_tm: 1670000 }), [...dt, ...chi]), baseCa({ kt_wait: true, real_tm: 1670000 }), R(), null) === false, '1i. chờ kế toán → không phải khớp hết');
const hd = baseCa({ real_tm: 1670000, bank_ck: 1414000, fabi: { ...clean.fabi, edited_bills: 2 } });
ok(isClean(D(hd, [...dt, ...chi]), hd, R(), null) === false, '1i. có hoá đơn sửa / xoá chưa hỏi → không phải khớp hết');
ok(isClean(dc, clean, R({ nhan_su: {} }), null) === false, '1i. phần việc chưa duyệt → không phải khớp hết');
print('ĐẠT ' + n + ' kiểm tra');
