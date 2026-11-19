// Bài thử phần đầu Sổ thu / Sổ chi gọn (bước 164). Chạy: jsc -m kiem_tra/so_thu_chi_tinh_dot9.mjs
import { zeroCols, tileInfo, locChips } from '../docs/js/so_thu_chi_tinh.js';

let n = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('KIỂM TRA THẤT BẠI: ' + msg); n++; };
let k = 0; const it = (book, pm, col, amount, o = {}) => ({ id: 'x' + (++k), date: '2026-11-18', book, pm, col, amount, ...o });
const I = [
  it('thu', 'tm', 'dt', 500000), it('thu', 'tm', 'no', 30000), it('thu', 'tm', 'lc', 70000, { void: true }),
  it('thu', 'tm', 'lech', 10000, { status: 'Chờ xử lý (dư)' }), it('thu', 'tm', 'lech', 5000, { status: 'Xong' }),
  it('thu', 'ck', 'dt', 800000),
  it('chi', 'tm', 'chi', 40000, { cat: null }), it('chi', 'tm', 'chi', 60000, { cat: null }), it('chi', 'tm', 'chi', 90000, { cat: 'Nguyên liệu' }),
];
const D = { items: I, open_debts: [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }], people: [{ name: 'A', open: 50000 }, { name: 'B', open: 0 }] };

const z = zeroCols(I, 'thu', 'tm');
ok(z.includes('lc') && z.includes('khac') && !z.includes('dt') && !z.includes('no'), 'cột cả tháng bằng 0 (khoản đã xoá không tính): ' + z.join(','));
ok(!zeroCols(I, 'thu', 'tm', 'lc').includes('lc'), 'cột đang chọn không bị ẩn');
ok(zeroCols(I, 'thu', 'ck').includes('no'), 'tính theo bảng tiền đang xem');

const lech = tileInfo(D, 'thu', 'tm', 'lech');
ok(lech.sub === '1 ca chờ xử lý' && lech.warn === true && lech.v === 15000, 'ô Chênh lệch: 1 ca chờ xử lý, viền vàng');
ok(tileInfo(D, 'thu', 'tm', 'no').sub === '+ 3 khách còn nợ', 'ô Thu nợ: + 3 khách còn nợ');
ok(tileInfo(D, 'thu', 'tm', 'lc').zero === true && tileInfo(D, 'thu', 'tm', 'lc').sub === '', 'ô bằng 0');
ok(tileInfo(D, 'thu', 'tm', 'dt').sub === '' && tileInfo(D, 'thu', 'tm', 'dt').warn === false, 'ô không có việc: không dòng phụ');
const chi = tileInfo(D, 'chi', 'tm', 'chi');
ok(chi.sub === '2 khoản cần phân loại' && chi.warn === true && chi.v === 190000, 'ô Các khoản chi: 2 khoản cần phân loại');
ok(tileInfo(D, 'chi', 'tm', 'no').sub === '1 người nợ', 'ô Cho nợ: 1 người nợ (chỉ người còn nợ)');
ok(tileInfo({ items: [it('chi', 'tm', 'chi', 20000, { cat: 'X', no_cost: true })], people: [] }, 'chi', 'tm', 'chi').sub === 'trong đó 20.000 không tính chi phí', 'không tính chi phí');
ok(tileInfo({ items: [], people: [] }, 'thu', 'tm', 'no').sub === '', 'không có khách nợ (open_debts thiếu)');

const names = { src: [['', 'Mọi nguồn'], ['ca', 'Từ phiếu ca']], st: [['', 'Mọi trạng thái'], ['cho', 'Chờ xử lý']], type: { 7: 'Nguyên liệu' } };
ok(locChips({ q: 'bàn', src: 'ca', type: '', cat: '', st: '' }, names).map((c) => c.label).join('|') === 'Tìm "bàn"|Nguồn: Từ phiếu ca', 'dòng Đang lọc: Tìm + Nguồn');
ok(locChips({ q: '', src: '', type: '7', cat: 'Đá', st: 'cho' }, names).map((c) => c.k + '=' + c.label).join('|') === 'type=Loại: Nguyên liệu|cat=Nhóm: Đá|st=Trạng thái: Chờ xử lý', 'Loại / Nhóm / Trạng thái, đúng thứ tự');
ok(locChips({ q: '', src: '', type: '', cat: '', st: '' }, names).length === 0, 'không lọc gì');

print(`ĐẠT ${n} kiểm tra`);
