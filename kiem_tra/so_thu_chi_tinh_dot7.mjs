// Bài thử bộ lọc Sổ thu / Sổ chi (bước 152). Chạy: jsc -m kiem_tra/so_thu_chi_tinh_dot7.mjs
import { filterItems, parseLoc, locStr, LOC_EMPTY } from '../docs/js/so_thu_chi_tinh.js';

let n = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('KIỂM TRA THẤT BẠI: ' + msg); n++; };
const ids = (a) => a.map((x) => x.id).join(',');
const I = [
  { id: 'm:1', date: '2026-11-18', ca_id: 181, book: 'chi', pm: 'tm', col: 'chi', amount: 30000, title: 'Mua đá', cat: 'Nguyên liệu', cat_type: 2, src: 'move' },
  { id: 'm:2', date: '2026-11-18', ca_id: 181, book: 'chi', pm: 'tm', col: 'chi', amount: 50000, title: 'Âm tiền Hà', cat: null, src: 'move' },
  { id: 'e:3', date: '2026-11-17', ca_id: null, book: 'chi', pm: 'ck', col: 'chi', amount: 900000, title: 'Tiền điện', cat: 'Điện nước', cat_type: 3, src: 'entry' },
  { id: 'k:4', date: '2026-11-16', ca_id: null, book: 'thu', pm: 'tm', col: 'khac', amount: 20000, title: 'NV bù khoản âm: Tú', src: 'shortfall' },
  { id: 'g:183:tm', date: '2026-11-18', ca_id: 183, book: 'chi', pm: 'tm', col: 'lech', amount: 30000, title: 'Ca thiếu tiền', status: 'Chờ xử lý', src: 'gap',
    gap: { tl: [{ id: 9, name: 'Ngọc Anh', amount: 30000, status: 'cho_tru', reply: 'em đếm nhầm' }] } },
  { id: 'g:150:tm', date: '2026-11-12', ca_id: 150, book: 'chi', pm: 'tm', col: 'lech', amount: 10000, title: 'Ca thiếu tiền', status: 'Xong', src: 'gap',
    gap: { tl: [{ id: 8, name: 'Bình', amount: 10000, status: 'huy' }] } },
  { id: 'm:5', date: '2026-11-15', ca_id: 151, book: 'chi', pm: 'tm', col: 'chi', amount: 15000, title: 'Mua đá viên', cat: 'Nguyên liệu', cat_type: 2, src: 'move', void: true },
];
const fin = (id) => id === 183;
const F = (o) => filterItems(I, { ...LOC_EMPTY, ...o }, { fin });

// không lọc: bỏ khoản đã xoá
ok(ids(F({})) === 'm:1,m:2,e:3,k:4,g:183:tm,g:150:tm', 'không lọc: mọi khoản còn hiệu lực');
// tìm không dấu, trong tên nhóm và tên người trừ lương
ok(ids(F({ q: 'da' })) === 'm:1', 'tìm "da" khớp "Mua đá" (không dấu), không lấy khoản đã xoá');
ok(ids(F({ q: 'nguyen lieu' })) === 'm:1', 'tìm theo tên nhóm');
ok(ids(F({ q: 'ngoc anh' })) === 'g:183:tm', 'tìm theo tên người trong phiếu trừ lương');
ok(ids(F({ q: 'EM ĐẾM' })) === 'g:183:tm', 'tìm trong giải trình, không phân biệt hoa thường');
// nguồn
ok(ids(F({ src: 'ca' })) === 'm:1,m:2,g:183:tm,g:150:tm', 'nguồn: từ phiếu ca');
ok(ids(F({ src: 'tay' })) === 'e:3', 'nguồn: quản lý tạo (ngoài ca)');
ok(ids(F({ src: 'bu' })) === 'k:4', 'nguồn: nộp bù khoản âm');
ok(ids(F({ src: 'lech' })) === 'g:183:tm,g:150:tm', 'nguồn: chênh lệch');
// loại / nhóm
ok(ids(F({ type: '2' })) === 'm:1', 'loại theo cat_type');
ok(ids(F({ cat: 'Điện nước' })) === 'e:3', 'nhóm theo tên');
// trạng thái
ok(ids(F({ st: 'todo' })) === 'm:2', 'chưa phân loại = chi chưa có nhóm');
ok(ids(F({ st: 'cho' })) === 'g:183:tm', 'chờ xử lý');
ok(ids(F({ st: 'tl' })) === 'g:183:tm', 'có trừ lương: bỏ phiếu đã huỷ');
ok(ids(F({ st: 'void' })) === 'm:5', 'đã xoá: chỉ khoản đã xoá');
ok(ids(F({ st: 'fin' })) === 'g:183:tm', 'ca đã chốt');
ok(ids(F({ st: 'open' })) === 'm:1,m:2,g:150:tm', 'ca chưa chốt (chỉ khoản có ca)');
// giao nhiều điều kiện
ok(ids(F({ src: 'ca', st: 'todo', q: 'am' })) === 'm:2', 'nhiều điều kiện là giao');
ok(ids(F({ src: 'tay', st: 'todo' })) === '', 'giao rỗng');
// đường dẫn
const f = { ...LOC_EMPTY, q: 'mua đá', src: 'ca', st: 'tl', type: '2', cat: 'Nguyên liệu' };
const back = parseLoc(locStr(f));
ok(JSON.stringify(back) === JSON.stringify(f), 'parseLoc(locStr(f)) giữ nguyên');
ok(locStr(LOC_EMPTY) === '', 'không lọc → chuỗi rỗng');
ok(JSON.stringify(parseLoc('')) === JSON.stringify(LOC_EMPTY) && JSON.stringify(parseLoc(undefined)) === JSON.stringify(LOC_EMPTY), 'chuỗi rỗng / thiếu → không lọc');
ok(parseLoc('st:tl').st === 'tl', 'đường dẫn cũ khoản âm: st:tl');
ok(parseLoc('q:a%2Cb').q === 'a,b', 'giá trị có dấu phẩy được mã hoá');

print(`ĐẠT ${n} kiểm tra`);
