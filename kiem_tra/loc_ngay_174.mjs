// Bài thử bộ lọc ngày Hàng hoá — bước 174 (21/11): (1) khoảng ngày quá 400 ngày không làm trang kẹt, không được nhớ;
// (2) loại ngày đã chọn không mất khi đi qua mục chỉ có Ngày giao (Chưa nhận). Chạy: jsc -m kiem_tra/loc_ngay_174.mjs
const mem = {};
globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const { readLoc, locQuery, locBar, locLoad, locSave, locRemember, MAX_DAYS } = await import('../docs/js/loc_ngay.js');
let n = 0;
const ok = (c, m) => { if (!c) throw new Error('KIỂM TRA THẤT BẠI: ' + m); n++; };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' — được ' + JSON.stringify(a) + ', cần ' + JSON.stringify(b));
const T = '2026-11-21'; const K3 = ['giao', 'nhan', 'ds'];

// ---- (1) khoảng ngày quá dài
eq(MAX_DAYS, 400, 'giới hạn bằng máy chủ (tệp 146: đến − từ > 400 thì từ chối)');
let L = readLoc({ today: T, kinds: K3, params: { tu: '2024-01-01', den: '2026-11-21' } });
eq([L.tooLong, L.from, L.to], [true, '2024-01-01', '2026-11-21'], 'chọn quá 400 ngày → báo quá dài, giữ ngày đã chọn để hiện lại trên thanh lọc');
L = readLoc({ today: T, kinds: K3, params: { tu: '2025-10-17', den: '2026-11-21' } });   // đúng 400 ngày
eq(L.tooLong, false, 'đúng 400 ngày thì được');
L = readLoc({ today: T, kinds: K3, params: { tu: '2025-10-16', den: '2026-11-21' } });   // 401 ngày
eq(L.tooLong, true, '401 ngày thì quá');
L = readLoc({ today: T, kinds: K3, params: { tu: '2026-11-21', den: '2024-01-01' } });
eq(L.tooLong, true, 'gõ ngược từ > đến vẫn tính đúng độ dài');
L = readLoc({ today: T, kinds: K3 });
eq(L.tooLong, false, 'mặc định Tháng này không quá dài');
// khoảng quá dài đã lỡ nhớ từ trước (máy đang kẹt) → bỏ, về mặc định
L = readLoc({ today: T, kinds: K3, saved: { kind: 'nhan', from: '2024-01-01', to: '2026-11-21' } });
eq([L.tooLong, L.preset, L.from, L.to, L.kind], [false, 'thang_nay', '2026-11-01', '2026-11-30', 'nhan'], 'khoảng quá dài đã nhớ → bỏ, về Tháng này, giữ loại ngày');
// không nhớ khoảng quá dài
locSave('t1', { kind: 'nhan', nhanh: '7_ngay' });
let R = locRemember('t1', { params: { tu: '2024-01-01', den: '2026-11-21' }, kinds: K3, today: T });
eq([R.tooLong, locLoad('t1')], [true, { kind: 'nhan', nhanh: '7_ngay' }], 'khoảng quá dài không ghi đè lựa chọn đã nhớ');
R = locRemember('t1', { params: { tu: '2026-11-01', den: '2026-11-05' }, kinds: K3, today: T });
eq([R.tooLong, locLoad('t1')], [false, { kind: 'nhan', from: '2026-11-01', to: '2026-11-05' }], 'khoảng hợp lệ thì nhớ');
R = locRemember('t1', { params: { cn: 2 }, kinds: K3, today: T });
eq([R.from, R.to, locLoad('t1')], ['2026-11-01', '2026-11-05', { kind: 'nhan', from: '2026-11-01', to: '2026-11-05' }], 'không có tham số lọc → dùng cái đã nhớ, không ghi gì');

// ---- (2) loại ngày đã chọn không mất khi qua mục chỉ có Ngày giao
L = readLoc({ today: T, kinds: ['giao'], params: { loai: 'ds', nhanh: 'thang_nay' } });
eq([L.kind, L.wantKind], ['giao', 'ds'], 'mục Chưa nhận: lọc theo Ngày giao, vẫn biết loại đã chọn là Ngày đối soát');
eq(locQuery(L).loai, 'ds', 'đường dẫn sang mục khác mang loại đã chọn, không mang loại bị ép');
const seen = [];
locBar(L, ['giao'], (o) => { seen.push(locQuery(o).loai); return '#'; });
eq([...new Set(seen)], ['ds'], 'nút nhanh ở mục Chưa nhận không đổi loại đã chọn');
// đi một vòng: Mọi trạng thái (chọn Ngày đối soát) → Chưa nhận → về Mọi trạng thái
locSave('t2', {});
let A = locRemember('t2', { params: { loai: 'ds', nhanh: 'thang_nay' }, kinds: K3, kindsShown: K3, today: T });
let B = locRemember('t2', { params: { tt: 'dang', ...locQuery(A) }, kinds: K3, kindsShown: ['giao'], today: T });
eq(B.kind, 'giao', 'vòng: ở Chưa nhận lọc theo Ngày giao');
let C = locRemember('t2', { params: { tt: '', ...locQuery(B) }, kinds: K3, kindsShown: K3, today: T });
eq([C.kind, locLoad('t2').kind], ['ds', 'ds'], 'vòng: quay lại vẫn là Ngày đối soát, và vẫn được nhớ');
// tự tay đổi loại thì theo loại mới
eq(locQuery({ ...C, kind: 'nhan', wantKind: 'nhan' }).loai, 'nhan', 'tự chọn loại khác thì theo loại mới');
eq(locQuery({ kind: 'nhan', preset: 'hom_nay' }).loai, 'nhan', 'lựa chọn không có loại đã nhớ thì dùng loại đang lọc');
print('ĐẠT ' + n + ' kiểm tra');
