// Bài thử hàm tính Sổ thu chi mới (đợt 3: lệch sau ghép). Chạy: jsc -m kiem_tra/so_thu_chi_tinh_dot3.mjs
import { caMoney, gapMath, sumItems } from '../docs/js/so_thu_chi_tinh.js';

let n = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('KIỂM TRA THẤT BẠI: ' + msg); n++; };
const it = (o) => ({ date: '2026-11-18', ca_id: 7, book: 'chi', pm: 'tm', col: 'chi', amount: 0, ...o });
const items = [
  it({ col: 'dt', book: 'thu', amount: 500000 }),
  it({ col: 'lech', book: 'chi', amount: 10000, gross: 30000 }),   // thiếu 30.000, đã ghép 20.000
];
// sổ cộng phần còn lại sau ghép
ok(sumItems(items, { book: 'chi', col: 'lech' }) === 10000, 'sổ chỉ cộng phần còn lại 10.000');
// tiền thật của ca dùng lệch gộp (trước ghép)
const m = caMoney(items, 7, 1000000);
ok(m.tm.th === 30000 && m.tm.real === 1000000 + 500000 - 30000 && m.tm.gap === -30000, 'tiền thật của ca dùng lệch gộp 30.000 (' + JSON.stringify(m.tm) + ')');
// không có gross → dùng amount như cũ
ok(caMoney([it({ col: 'lech', book: 'thu', amount: 5000 })], 7, 0).tm.du === 5000, 'không có gross thì dùng số tiền');
// phép tính "30.000 − 20.000 ghép = 10.000"
ok(gapMath({ amount: 10000, gross: 30000 }) === '30.000 − 20.000 ghép = 10.000', 'phép tính ghép: ' + gapMath({ amount: 10000, gross: 30000 }));
ok(gapMath({ amount: 0, gross: 20000 }) === '20.000 − 20.000 ghép = 0', 'ghép hết');
ok(gapMath({ amount: 30000, gross: 30000 }) === '' && gapMath({ amount: 30000 }) === '', 'chưa ghép thì không có phép tính');

print('ĐẠT ' + n + ' kiểm tra');
