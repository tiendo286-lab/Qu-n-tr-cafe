// Bài thử chặng 4 (anh Tiến chốt 22/11 "Báo đỏ và chặn"): ô Nợ ở bước 1 so thêm Nợ bill của ca với tổng danh sách khách nợ hoá đơn của ca
// (ca.bill_list — trang tính từ D.ca_debts). Lệch → đỏ (chặn Xác nhận Fabi), ghi rõ số danh sách; "Lấy số máy Fabi" chỉ khi máy ≥ danh sách.
// Chạy: jsc -m kiem_tra/so_thu_chi_tinh_dot17.mjs. Máy chủ: supabase/162_no_bill_khop_danh_sach.sql (cùng điều kiện).
import { billListOf, caChecks, fabiNeeds } from '../docs/js/so_thu_chi_tinh.js';
let n = 0;
const ok = (c, m) => { if (!c) throw new Error('KIỂM TRA THẤT BẠI: ' + m); n++; };
const get = (cs, k) => cs.find((x) => x.k === k);
const ca = (o = {}) => ({ id: 68, date: '2026-11-04', shift: 'Chiều', cash_mode: 'ngay', bank_ck: 0, recon_money_done: false, ticks: [],
  fabi: { has: true, opening: 1000000, revenue: 500000, debt: 0 }, nv: { opening: 1000000, revenue: 500000, debt: 0 }, ...o });
const link = (exp) => ({ expOpen: exp, money: { tm: { gap: 0, real: 0 }, ck: { gap: 0, real: 0 } } });

// 0. billListOf: chỉ khoản nợ HĐ "mới" của đúng ca
const D = { ca_debts: [{ report_id: 68, t: 'moi', kind: 'bill', amount: 84000 }, { report_id: 68, t: 'moi', kind: 'muon', amount: 100000 },
  { report_id: 68, t: 'tra', kind: 'bill', amount: 50000 }, { report_id: 69, t: 'moi', kind: 'bill', amount: 7000 }] };
ok(billListOf(D, 68) === 84000 && billListOf(D, 70) === 0, '0. tổng danh sách nợ HĐ của ca = chỉ khoản HĐ mới ghi ở ca đó');

// 1. Như LHP Chiều 01/11 sau khi lỡ "lấy số máy": nợ phiếu 0 = máy 0, danh sách 28.000 → trước đây xanh, nay đỏ
let cs = caChecks(ca({ bill_list: 28000 }), link(1000000));
let no = get(cs, 'no');
ok(no.st === 'red' && no.list === true && no.bl === 28000, '1a. nợ phiếu 0, máy 0, danh sách 28.000 → ô Nợ đỏ, đánh dấu lệch danh sách');
ok(/danh sách khách nợ/.test(no.txt) && /28\.000/.test(no.txt), '1b. chữ ghi rõ số danh sách');
ok(no.fix !== 'fabi', '1c. máy 0 < danh sách → không có "Lấy số máy Fabi"');
ok(fabiNeeds(ca({ bill_list: 28000 }), cs).some((x) => x.k === 'red'), '1d. Xác nhận Fabi còn thiếu (ô đỏ ở ①)');

// 2. Như LHP Chiều 04/11: nhân viên ghi 84.000 (đúng danh sách), máy 0 → đỏ, gỡ bằng "Sai, sửa số" (không lấy số máy)
cs = caChecks(ca({ nv: { opening: 1000000, revenue: 500000, debt: 84000 }, bill_list: 84000 }), link(1000000));
no = get(cs, 'no');
ok(no.st === 'red' && no.fix !== 'fabi', '2. nợ phiếu 84.000 = danh sách, máy 0 → đỏ, không có "Lấy số máy Fabi"');

// 3. Chủ đã duyệt Nợ bill = 84.000 = danh sách → xanh
cs = caChecks(ca({ nv: { opening: 1000000, revenue: 500000, debt: 84000 }, bill_list: 84000, fixes: { no: { id: 3, status: 'duyet', new: { val: 84000 } } } }), link(1000000));
ok(get(cs, 'no').st === 'ok', '3. Chủ duyệt Nợ bill = danh sách → xanh');

// 4. Chủ duyệt số khác danh sách → vẫn đỏ
cs = caChecks(ca({ nv: { opening: 1000000, revenue: 500000, debt: 50000 }, bill_list: 84000, fixes: { no: { id: 3, status: 'duyet', new: { val: 50000 } } } }), link(1000000));
no = get(cs, 'no');
ok(no.st === 'red' && no.list === true, '4. số đã duyệt 50.000 ≠ danh sách 84.000 → vẫn đỏ');

// 5. Máy 150.000 > danh sách 120.000 = nợ phiếu → đỏ như cũ, có "Lấy số máy Fabi" (bắt chọn người nợ phần chênh)
cs = caChecks(ca({ fabi: { has: true, opening: 1000000, revenue: 650000, debt: 150000 }, nv: { opening: 1000000, revenue: 620000, debt: 120000 }, bill_list: 120000 }), link(1000000));
no = get(cs, 'no');
ok(no.st === 'red' && no.fix === 'fabi' && !no.list, '5. máy nhiều hơn danh sách → đỏ, còn "Lấy số máy Fabi"');

// 6. Bình thường: nợ phiếu = máy = danh sách → xanh; chưa có danh sách (bill_list không có) → như cũ
ok(get(caChecks(ca({ nv: { opening: 1000000, revenue: 600000, debt: 100000 }, fabi: { has: true, opening: 1000000, revenue: 600000, debt: 100000 }, bill_list: 100000 }), link(1000000)), 'no').st === 'ok', '6a. khớp cả ba → xanh');
ok(get(caChecks(ca(), link(1000000)), 'no').st === 'ok', '6b. không có bill_list → giữ cách cũ');
print(`ĐẠT ${n} kiểm tra`);
