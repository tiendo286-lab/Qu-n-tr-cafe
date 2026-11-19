// Bài thử bước 168 (Đối soát Fabi giao diện): điều kiện Xác nhận Fabi, việc còn lại của ca, nợ trước ca. Chạy: jsc -m kiem_tra/so_thu_chi_tinh_dot11.mjs
import { fabiNeeds, dsTodo, debtBefore, debtOrigin, caChecks } from '../docs/js/so_thu_chi_tinh.js';
let n = 0;
const ok = (c, m) => { if (!c) throw new Error('KIỂM TRA THẤT BẠI: ' + m); n++; };
const ks = (a) => a.map((x) => x.k).join(',');
const red = [{ k: 'mo', st: 'red' }, { k: 'dt', st: 'ok' }, { k: 'no', st: 'ok' }];
const okc = [{ k: 'mo', st: 'ok' }, { k: 'dt', st: 'ok' }, { k: 'no', st: 'ok' }];
// fabiNeeds = đúng 3 điều kiện cũ của partA
ok(ks(fabiNeeds({ fabi: { has: true }, bank_ck: 1 }, okc)) === '', 'đủ điều kiện');
ok(ks(fabiNeeds({ fabi: { has: true }, bank_ck: 1 }, red)) === 'red', 'ô đỏ ①');
ok(ks(fabiNeeds({ fabi: { has: true }, bank_ck: null }, okc)) === 'kt', 'chờ kế toán khi chưa có số ngân hàng');
ok(ks(fabiNeeds({ fabi: { has: false }, bank_ck: 1 }, okc)) === 'kt', 'chờ kế toán khi chưa có Fabi');
ok(ks(fabiNeeds({ fabi: { has: true }, bank_ck: 1, kt_wait: true }, okc)) === 'kt', 'kt_wait');
ok(ks(fabiNeeds({ fabi: { has: true }, bank_ck: 1, cash_mode: 'ca', ql_counted: null }, red)) === 'red,cash', 'thu theo ca chưa nhập tiền mặt');
ok(ks(fabiNeeds({ fabi: { has: true }, bank_ck: 1, cash_mode: 'ca', ql_counted: 0 }, okc)) === '', 'đã nhập 0 vẫn tính là đã nhập');
ok(ks(fabiNeeds({ fabi: { has: true }, bank_ck: 1 }, [{ k: 'x', st: 'red' }])) === '', 'chỉ xét 3 ô mo/dt/no');
// caChecks thật → fabiNeeds
const ca = { fabi: { has: true, opening: 1000000, revenue: 5, debt: 0 }, nv: { opening: 1500000, revenue: 5, debt: 0 }, bank_ck: 1 };
ok(ks(fabiNeeds(ca, caChecks(ca, null))) === 'red', 'caChecks thật: tiền mở ca lệch → ô đỏ');
// dsTodo
let t = dsTodo({ recon_money_done: false, fabi: { has: true }, bank_ck: 1 }, red, []);
ok(t.step === 'fabi' && ks(t.need) === 'red', 'chưa xác nhận → bước Fabi');
t = dsTodo({ recon_money_done: true }, okc, [{ pm: 'tm', amt: -30000, done: false }, { pm: 'ck', amt: 5000, done: true }]);
ok(t.step === 'lech' && t.need.length === 1 && t.need[0].book === 'chi' && t.need[0].pm === 'tm' && /Tiền mặt thiếu 30\.000/.test(t.need[0].txt), 'đã xác nhận còn lệch → nhảy tới Sổ chi tiền mặt');
t = dsTodo({ recon_money_done: true }, okc, [{ pm: 'ck', amt: 20000, done: false, wait: true }]);
ok(t.need[0].book === 'thu' && /chờ Chủ duyệt/.test(t.need[0].txt), 'dư → Sổ thu, chờ Chủ duyệt');
ok(dsTodo({ recon_money_done: true }, okc, [{ pm: 'tm', amt: 1000, done: true }]).step === 'xong', 'hết lệch → xong');
// nợ trước ca
const sang = { date: '2026-11-18', from: 'ca Sáng 18/11' }, toi16 = { date: '2026-11-16', from: 'ca Tối 16/11' }, ql = { date: '2026-11-18', from: 'quản lý ghi' };
ok(debtOrigin(sang).shift === 'Sáng' && debtOrigin(ql).shift === null, 'đọc ca phát sinh từ chữ "from"');
ok(debtBefore(sang, { date: '2026-11-18', shift: 'Chiều' }), 'nợ ca Sáng trả ca Chiều cùng ngày: được');
ok(!debtBefore(sang, { date: '2026-11-18', shift: 'Sáng' }), 'trong chính ca: không');
ok(!debtBefore({ date: '2026-11-18', from: 'ca Chiều 18/11' }, { date: '2026-11-18', shift: 'Sáng' }), 'nợ ca sau: không');
ok(debtBefore(toi16, { date: '2026-11-17', shift: 'Sáng' }), 'nợ hôm trước: được');
ok(debtBefore(ql, { date: '2026-11-18', shift: 'Sáng' }) && !debtBefore(ql, { date: '2026-11-17', shift: 'Tối' }), 'nợ quản lý ghi: trong ngày hoặc trước');
ok(debtBefore(sang, { date: '2026-11-18' }) && !debtBefore(sang, { date: '2026-11-17' }), 'phiếu ngoài ca: nợ từ ngày đó trở về trước');
ok(debtBefore({ from: 'x' }, { date: '2026-11-01' }), 'thiếu ngày → không ẩn');
print('ĐẠT ' + n + ' kiểm tra');
