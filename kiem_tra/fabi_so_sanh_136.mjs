// Bước 136: bài thử module so sánh File ca Fabi (không cần trình duyệt).
// Chạy: /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m kiem_tra/fabi_so_sanh_136.mjs
import { FIELDS, compareRows, confirmedNote, reviewOf } from '../docs/js/fabi_so_sanh.js';

const log = globalThis.print || console.log;
let fail = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fail++; log('SAI: ' + msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — nhận ${JSON.stringify(a)}, cần ${JSON.stringify(b)}`);

const NV = { ipos_opening: 1000000, total_revenue: 5420000, pos_transfer: 3100000, pos_cash: 2320000, pos_debt: 0, cash_counted: 3320000, pos_diff: 0 };
const base = (x = {}) => ({ report_id: 9, report_status: 'hoan_thanh', diff: [], fixed: [], nv: { ...NV },
  dau: 1000000, net: 5420000, ck: 3100000, tm: 2320000, no: 0, tong: 3320000, chenh: 0, ...x });

eq(FIELDS.map((x) => x[2]), ['Số dư đầu', 'Doanh thu NET', 'Chuyển khoản', 'Tiền mặt', 'Nợ', 'Tổng tiền', 'Tiền chênh lệch'], 'đủ 7 mục, đúng thứ tự');

// 1. khớp hết
{ const f = base(); eq(reviewOf(f), null, 'khớp → không cần xem'); const rows = compareRows(f);
  eq(rows.length, 7, 'khớp → 7 dòng'); ok(rows.every((r) => r.same), 'khớp → mọi dòng same'); }

// 2. gõ thiếu Tổng tiền
{ const f = base({ nv: { ...NV, cash_counted: 3140000, pos_diff: -180000 },
    diff: [{ field: 'cash_counted', label: 'Tổng tiền', nv: 3140000, fabi: 3320000 }, { field: 'pos_diff', label: 'Tiền chênh lệch', nv: -180000, fabi: 0 }] });
  const v = reviewOf(f); eq(v && v.kind, 'lech', 'gõ khác → lech'); eq(v && v.short, 'Gõ khác Fabi: Tổng tiền, Tiền chênh lệch', 'câu ngắn');
  ok(v && v.lines.includes('Tổng tiền nhân viên ghi thiếu 180.000đ so với Fabi'), 'câu thiếu: ' + JSON.stringify(v && v.lines));
  ok(v && v.lines.includes('Tiền chênh lệch nhân viên ghi thiếu 180.000đ so với Fabi'), 'câu chênh lệch: ' + JSON.stringify(v && v.lines));
  const row = compareRows(f).find((r) => r.label === 'Tổng tiền'); eq(row.gap, -180000, 'gap Tổng tiền'); eq(row.same, false, 'Tổng tiền khác');
  eq(compareRows(f).filter((r) => !r.same).length, 2, 'đúng 2 dòng khác'); }

// 3. gõ thừa
{ const f = base({ nv: { ...NV, pos_transfer: 3150000 }, diff: [{ field: 'pos_transfer', label: 'Chuyển khoản', nv: 3150000, fabi: 3100000 }] });
  ok(reviewOf(f).lines.includes('Chuyển khoản nhân viên ghi thừa 50.000đ so với Fabi'), 'câu thừa: ' + JSON.stringify(reviewOf(f).lines)); }

// 4. chỉ có số web đã sửa
{ const f = base({ fixed: [{ field: 'opening_cash', label: 'Tiền đầu ca', before: 900000, fabi: 1000000 }] });
  const v = reviewOf(f); eq(v && v.kind, 'da_sua', 'chỉ fixed → da_sua'); eq(v && v.short, 'Web đã sửa theo Fabi: Tiền đầu ca', 'câu ngắn da_sua');
  ok(v && v.lines.includes('Web đã sửa số đối soát theo Fabi: Tiền đầu ca 900.000 → 1.000.000'), 'câu da_sua: ' + JSON.stringify(v && v.lines)); }

// 5. nhân viên chưa ghi Nợ
{ const f = base({ no: 50000, nv: { ...NV, pos_debt: null }, diff: [{ field: 'pos_debt', label: 'Nợ', nv: null, fabi: 50000 }] });
  const row = compareRows(f).find((r) => r.label === 'Nợ'); eq([row.nv, row.same, row.gap], [null, false, null], 'Nợ chưa ghi');
  ok(reviewOf(f).lines.includes('Nợ nhân viên chưa ghi (Fabi 50.000đ)'), 'câu chưa ghi: ' + JSON.stringify(reviewOf(f).lines)); }

// 6. chưa có phiếu / đang chốt
{ const v = reviewOf(base({ report_id: null, report_status: null, nv: null })); eq(v && v.kind, 'chua_phieu', 'không phiếu → chua_phieu');
  eq(v && v.short, 'Có file Fabi, chưa có phiếu nhân viên', 'câu chua_phieu');
  eq(reviewOf(base({ report_status: 'dang_chot' })), null, 'đang chốt → không cần xem');
  eq(compareRows(base({ nv: null })).every((r) => r.nv === null), true, 'nv null → cột NV trống'); }

// 7. lech + fixed: dòng web đã sửa vẫn có
{ const f = base({ nv: { ...NV, cash_counted: 3140000 }, diff: [{ field: 'cash_counted', label: 'Tổng tiền', nv: 3140000, fabi: 3320000 }],
    fixed: [{ field: 'cash_counted', label: 'Tổng tiền', before: 3140000, fabi: 3320000 }] });
  ok(reviewOf(f).lines.includes('Web đã sửa số đối soát theo Fabi: Tổng tiền 3.140.000 → 3.320.000'), 'lech + fixed'); }

// 8. chặng 4 (anh Tiến chốt 22/11): ca đã Xác nhận Fabi (xn) → không còn "Cần quản lý xem"; vẫn ghi nhỏ lý do + "quản lý đã xác nhận"
{ const lech = base({ xn: true, nv: { ...NV, cash_counted: 3140000 }, diff: [{ field: 'cash_counted', label: 'Tổng tiền', nv: 3140000, fabi: 3320000 }] });
  eq(reviewOf(lech), null, 'gõ khác Fabi nhưng đã xác nhận → không cần xem');
  eq(confirmedNote(lech), 'Gõ khác Fabi: Tổng tiền · quản lý đã xác nhận Fabi', 'ghi chú ca đã xác nhận (gõ khác)');
  const sua = base({ xn: true, fixed: [{ field: 'ipos_opening', label: 'Số dư đầu', before: 900000, fabi: 1000000 }] });
  eq(reviewOf(sua), null, 'web đã sửa nhưng đã xác nhận → không cần xem');
  eq(confirmedNote(sua), 'Web đã sửa theo Fabi: Số dư đầu · quản lý đã xác nhận Fabi', 'ghi chú ca đã xác nhận (web sửa)');
  eq(confirmedNote(base({ xn: true })), null, 'đã xác nhận, không có gì khác → không ghi chú');
  eq(reviewOf(base({ xn: false, diff: [{ field: 'pos_cash', label: 'Tiền mặt', nv: 1, fabi: 2 }] })).kind, 'lech', 'chưa xác nhận → vẫn cần xem');
  eq(reviewOf({ report_id: null, xn: false }).kind, 'chua_phieu', 'chưa có phiếu → vẫn cần xem'); }

log(fail ? `KIỂM TRA THẤT BẠI ${fail}/${n}` : `ĐẠT ${n} kiểm tra`);
