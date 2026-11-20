// Bài thử bộ lọc ngày Hàng hoá (bước 167). Chạy: jsc -m kiem_tra/loc_ngay_167.mjs
import { readLoc, presetRange, locQuery, dateOf, inLoc, sortLoc, coverRange, locLabel, locToSave, hasLocParams } from '../docs/js/loc_ngay.js';
let n = 0;
const ok = (c, m) => { if (!c) throw new Error('KIỂM TRA THẤT BẠI: ' + m); n++; };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' — được ' + JSON.stringify(a) + ', cần ' + JSON.stringify(b));
const T = '2026-11-19';
// nút nhanh
eq(presetRange('hom_nay', T), { from: T, to: T }, 'hôm nay');
eq(presetRange('7_ngay', T), { from: '2026-11-13', to: T }, '7 ngày tính cả hôm nay');
eq(presetRange('thang_nay', T), { from: '2026-11-01', to: '2026-11-30' }, 'tháng này cả tháng');
eq(presetRange('thang_truoc', T), { from: '2026-10-01', to: '2026-10-31' }, 'tháng trước');
eq(presetRange('thang_truoc', '2026-01-05'), { from: '2025-12-01', to: '2025-12-31' }, 'tháng trước qua năm');
eq(presetRange('7_ngay', '2026-03-02'), { from: '2026-02-24', to: '2026-03-02' }, '7 ngày qua tháng');
// mặc định + nhớ + đường dẫn
let L = readLoc({ today: T, kinds: ['giao', 'nhan', 'ds'] });
eq([L.kind, L.preset, L.from, L.to], ['giao', 'thang_nay', '2026-11-01', '2026-11-30'], 'mặc định Tháng này, Ngày giao');
L = readLoc({ today: T, kinds: ['giao', 'nhan', 'ds'], saved: { kind: 'ds', nhanh: 'hom_nay' } });
eq([L.kind, L.from], ['ds', T], 'nhớ nút nhanh theo tên');
L = readLoc({ today: T, kinds: ['giao'], saved: { kind: 'ds', nhanh: '7_ngay' } });
eq([L.kind, L.wantKind], ['giao', 'ds'], 'loại không áp dụng → dùng loại đầu, vẫn giữ loại đã nhớ');
eq(locToSave(L), { kind: 'ds', nhanh: '7_ngay' }, 'không ghi đè loại đã nhớ');
L = readLoc({ today: T, kinds: ['giao', 'nhan'], params: { thang: '2026-10' }, saved: { kind: 'nhan', nhanh: 'hom_nay' } });
eq([L.kind, L.from, L.to, L.preset], ['nhan', '2026-10-01', '2026-10-31', null], 'đường dẫn cũ ?thang=');
L = readLoc({ today: T, kinds: ['giao', 'nhan'], params: { tu: '2026-11-10', den: '2026-11-03', loai: 'nhan' } });
eq([L.kind, L.from, L.to], ['nhan', '2026-11-03', '2026-11-10'], 'từ > đến thì đảo');
L = readLoc({ today: T, kinds: ['giao'], params: { tu: 'xx', den: 'yy' }, saved: { from: 'a', to: 'b' } });
eq(L.preset, 'thang_nay', 'ngày hỏng → mặc định');
ok(hasLocParams({ nhanh: 'hom_nay' }) && !hasLocParams({ cn: 1, tt: 'cho' }), 'nhận biết có tham số lọc');
eq(locQuery({ kind: 'nhan', preset: 'hom_nay' }), { loai: 'nhan', nhanh: 'hom_nay', tu: '', den: '', thang: '' }, 'tham số nút nhanh');
eq(locQuery({ kind: 'giao', from: '2026-11-01', to: '2026-11-05' }), { loai: 'giao', nhanh: '', tu: '2026-11-01', den: '2026-11-05', thang: '' }, 'tham số khoảng');
// ngày theo loại
const r = { id: 1, work_date: '2026-11-02', received_at: '2026-11-03 09:10:00', recon_at: '2026-11-05 14:00:00' };
eq([dateOf(r, 'giao'), dateOf(r, 'nhan'), dateOf(r, 'ds')], ['2026-11-02', '2026-11-03', '2026-11-05'], 'ngày theo loại');
eq(dateOf({ work_date: '2026-11-02', received_date: '2026-11-04', recon_date: '2026-11-06' }, 'ds'), '2026-11-06', 'mục Kiểm soát có recon_date');
ok(!inLoc({ work_date: '2026-11-02' }, { kind: 'nhan', from: '2026-11-01', to: '2026-11-30' }), 'chưa nhận → không lọt khi lọc Ngày nhận');
ok(inLoc(r, { kind: 'ds', from: '2026-11-05', to: '2026-11-05' }), 'trong khoảng (tính cả 2 đầu)');
// xếp
const rows = [{ id: 1, work_date: '2026-11-02' }, { id: 2, work_date: '2026-11-09' }, { id: 3, work_date: '2026-11-05' }];
eq(sortLoc(rows, 'giao').map((x) => x.id), [2, 3, 1], 'mới nhất trên');
eq(sortLoc(rows, 'giao', true).map((x) => x.id), [1, 3, 2], 'Chờ đối soát: cũ nhất trên');
// mục chờ bị ẩn
eq(coverRange([{ work_date: '2026-10-20' }], { kind: 'giao', from: '2026-11-01', to: '2026-11-30' }), { kind: 'giao', preset: null, from: '2026-10-20', to: '2026-11-30' }, 'khoảng bao cả mục bị ẩn');
ok(coverRange([{ work_date: '2026-10-20' }], { kind: 'nhan', from: '2026-11-01', to: '2026-11-30' }) === null, 'không có ngày theo loại → không có khoảng');
eq([locLabel({ from: '2026-11-01', to: '2026-11-30' }), locLabel({ from: T, to: T }), locLabel({ from: '2026-11-13', to: T })], ['tháng 11/2026', '19/11/2026', '13/11 – 19/11'], 'nhãn khoảng');
print('ĐẠT ' + n + ' kiểm tra');
