// Bài thử chặng 2 (21/11): tệp Fabi của ca KHÔNG có số doanh thu (net trống — 4 ca: LHP Chiều 04/11; Lela Sáng 04, 07, 13/11).
// Anh Tiến chốt 21/11: quản lý nhập tay qua "Sai, sửa số" → Chủ duyệt. Ô ghi "Fabi không có số doanh thu" (không ghi "Fabi 0"),
// vẫn chặn Xác nhận Fabi tới khi Chủ duyệt; không có nút "Lấy số máy Fabi" ở ô đó. Ô Nợ có lời nhắc: tệp thiếu số → nợ máy ghi chưa chắc đúng.
// Chạy: jsc -m kiem_tra/so_thu_chi_tinh_dot16.mjs. Máy chủ: supabase/156_fabi_trong_doanh_thu.sql (chặn "Lấy số máy Fabi" khi máy không có số).
import { caChecks, fabiNeeds } from '../docs/js/so_thu_chi_tinh.js';
let n = 0;
const ok = (c, m) => { if (!c) throw new Error('KIỂM TRA THẤT BẠI: ' + m); n++; };
const get = (cs, k) => cs.find((x) => x.k === k);
const ca = (o = {}) => ({ id: 68, date: '2026-11-04', shift: 'Chiều', cash_mode: 'ngay', bank_ck: 0, recon_money_done: false, ticks: [],
  fabi: { has: true, opening: 3334000, revenue: null, debt: 0 }, nv: { opening: 3334000, revenue: 2107000, debt: 0 }, ...o });
const link = (exp) => ({ expOpen: exp, money: { tm: { gap: 0, real: 0 }, ck: { gap: 0, real: 0 } } });

// 1. Máy Fabi không có số doanh thu
let cs = caChecks(ca(), link(3334000));
let dt = get(cs, 'dt');
ok(dt.st === 'red', '1a. ô doanh thu vẫn chặn (đỏ) khi máy Fabi không có số');
ok(dt.empty === true, '1b. ô đánh dấu "máy không có số" (empty)');
ok(/Fabi không có số doanh thu/.test(dt.txt), '1c. chữ "Fabi không có số doanh thu"');
ok(!/Fabi 0/.test(dt.b || '') && /không có số/.test(dt.b || ''), '1d. không ghi "Fabi 0"');
ok(dt.fix !== 'fabi', '1e. không có "Lấy số máy Fabi" ở ô doanh thu');
ok(fabiNeeds(ca(), cs).some((x) => x.k === 'red'), '1f. Xác nhận Fabi còn thiếu (ô đỏ ở ①)');

// 2. Quản lý gửi số, đang chờ Chủ duyệt → vẫn chặn, không có "Lấy số máy Fabi"
cs = caChecks(ca({ fixes: { dt: { id: 5, status: 'cho', new: { tm: 992000, ck: 1031000 } } } }), link(3334000));
dt = get(cs, 'dt');
ok(dt.st === 'red' && dt.fx?.status === 'cho' && dt.fix !== 'fabi', '2. số sửa đang chờ: vẫn đỏ, mang yêu cầu, không có Lấy số máy');

// 3. Chủ đã duyệt (phiếu đã ghi theo số duyệt) → xanh
cs = caChecks(ca({ nv: { opening: 3334000, revenue: 2107000, debt: 84000 }, fixes: { dt: { id: 5, status: 'duyet', new: { tm: 992000, ck: 1031000, total: 2107000 } } } }), link(3334000));
dt = get(cs, 'dt');
ok(dt.st === 'ok' && /Chủ đã duyệt/.test(dt.txt), '3. Chủ đã duyệt đúng số phiếu → ô xanh');
ok(get(cs, 'mo').st === 'ok' && get(cs, 'dt').st === 'ok', '3b. sau khi duyệt doanh thu: ô tiền mở ca và doanh thu đều xanh');

// 4. Ô Nợ trên tệp thiếu số: vẫn so như cũ, có lời nhắc kiểm phiếu máy in
cs = caChecks(ca(), link(3334000));
const no = get(cs, 'no');
ok(no.st === 'ok', '4a. nợ 0 = máy 0 → xanh như cũ');
ok(/thiếu số/.test(no.note || '') && /Sửa số/.test(no.note || ''), '4b. ô Nợ có lời nhắc: tệp Fabi thiếu số, nợ thật thì "Sửa số"');

// 5. Ca bình thường (máy có số) không đổi
cs = caChecks(ca({ fabi: { has: true, opening: 1000000, revenue: 500000, debt: 0 }, nv: { opening: 1000000, revenue: 520000, debt: 0 } }), link(1000000));
dt = get(cs, 'dt');
ok(dt.st === 'red' && dt.fix === 'fabi' && !dt.empty, '5a. máy có số, lệch → đỏ, có "Lấy số máy Fabi" như cũ');
ok(!get(cs, 'no').note, '5b. ca bình thường: ô Nợ không có lời nhắc');
cs = caChecks(ca({ fabi: { has: true, opening: 1000000, revenue: 0, debt: 0 }, nv: { opening: 1000000, revenue: 0, debt: 0 } }), link(1000000));
ok(get(cs, 'dt').st === 'ok' && !get(cs, 'dt').empty, '5c. máy ghi đúng số 0 (không trống) → khớp, không coi là "không có số"');

// 6. Chưa có file Fabi: như cũ (chờ kế toán)
cs = caChecks(ca({ fabi: { has: false } }), link(3334000));
ok(get(cs, 'dt').st === 'kt' && !get(cs, 'dt').empty, '6. chưa có file: chờ kế toán như cũ');
print('ĐẠT ' + n + ' kiểm tra');
