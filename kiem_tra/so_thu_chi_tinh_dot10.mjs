// Bài thử tab Tổng mẫu B (bước 166): gom việc cần làm + gom người nợ. Chạy: jsc -m kiem_tra/so_thu_chi_tinh_dot10.mjs
import { todoItems, debtGroups } from '../docs/js/so_thu_chi_tinh.js';

let n = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('KIỂM TRA THẤT BẠI: ' + msg); n++; };

// ----- todoItems
const D = {
  cas: [{ id: 2, date: '2026-11-18', shift: 'Tối', recon_money_done: false }, { id: 1, date: '2026-11-17', shift: 'Sáng', recon_money_done: false }, { id: 3, date: '2026-11-16', shift: 'Sáng', recon_money_done: true }],
  items: [
    { id: 'g:1', date: '2026-11-15', book: 'thu', pm: 'tm', col: 'lech', amount: 30000, status: 'Chờ xử lý (dư)', title: 'Chênh lệch ca Chiều' },
    { id: 'g:2', date: '2026-11-14', book: 'chi', pm: 'tm', col: 'lech', amount: 20000, status: 'Xong', title: 'x' },
    { id: 'g:3', date: '2026-11-13', book: 'chi', pm: 'tm', col: 'lech', amount: 20000, status: 'Chờ xử lý', title: 'đã xoá', void: true },
    { id: 'm:1', date: '2026-11-12', book: 'chi', pm: 'ck', col: 'chi', amount: 45000, cat: null, title: 'Mua đá' },
    { id: 'm:2', date: '2026-11-12', book: 'chi', pm: 'tm', col: 'chi', amount: 45000, cat: 'Nguyên liệu', title: 'Sữa' },
  ],
};
const wait = [{ id: 'w:7', date: '2026-11-10', pm: 'tm', amount: 8000000, title: 'Chuyển về Quỹ ngoài' }];
const T = todoItems(D, wait);
ok(T.map((t) => t.kind).join() === 'fabi,fabi,qn,cat,lech', 'thứ tự: việc đỏ trước, rồi theo ngày tăng dần: ' + T.map((t) => t.kind + t.date.slice(8)).join());
ok(T[0].red && T[1].red && !T[2].red, 'chỉ ca chưa xác nhận Fabi là việc đỏ');
ok(T[0].ref.id === 1 && T[1].ref.id === 2, 'ca cũ hơn đứng trước (17/11 trước 18/11)');
ok(!T.some((t) => t.ref && t.ref.id === 'g:3') && !T.some((t) => t.ref && t.ref.id === 'g:2'), 'bỏ khoản đã xoá và khoản lệch đã xong');
ok(T.find((t) => t.kind === 'cat').amount === 45000 && T.find((t) => t.kind === 'qn').amount === 8000000, 'việc có số tiền');
ok(T.every((t) => typeof t.text === 'string' && t.text.length > 0), 'việc nào cũng có chữ');
ok(todoItems({ cas: [], items: [] }).length === 0 && todoItems({}).length === 0, 'không có gì → rỗng');

// ----- debtGroups
const today = '2026-11-19';
const debts = [
  { id: 'd:1', who: 'Bàn 5', left: 50000, date: '2026-11-16', from: 'ca Tối 16/11', no_remind: false },
  { id: 'd:2', who: 'Cô Lan Anh', left: 20000, date: '2026-11-10', from: 'ca Chiều 10/11', no_remind: false },
  { id: 'd:3', who: 'Kho Tổng', left: 300000, date: '2026-11-16', from: 'quản lý ghi', no_remind: true },
  { id: 'd:4', who: 'Bàn 5', left: 70000, date: '2026-11-08', from: 'ca Sáng 08/11', no_remind: false },
  { id: 'd:5', who: 'Kho Tổng', left: 10000, date: '2026-11-18', from: 'ca Sáng 18/11', no_remind: false },
  { id: 'd:6', who: 'Anh Dũng', left: 0, date: '2026-11-01', from: 'đã trả', no_remind: false },
];
const G = debtGroups(debts, today);
ok(G.main.map((g) => g.who).join() === 'Bàn 5,Cô Lan Anh,Kho Tổng', 'nhóm chính xếp người nợ lâu nhất lên đầu: ' + G.main.map((g) => g.who + g.maxDays).join());
const b5 = G.main[0];
ok(b5.n === 2 && b5.total === 120000 && b5.maxDays === 11 && b5.ks.length === 2 && b5.ks.every((k) => typeof k.days === 'number'), 'Bàn 5 gom 2 khoản, cộng 120.000, lâu nhất 11 ngày');
ok(b5.ks[0].days >= b5.ks[1].days, 'trong nhóm, khoản cũ trước');
ok(G.fam.length === 1 && G.fam[0].who === 'Kho Tổng' && G.fam[0].total === 300000 && G.fam[0].no_remind === true, 'Kho Tổng ✓ tách riêng, không cộng với khoản Kho Tổng không ✓');
ok(G.main.find((g) => g.who === 'Kho Tổng').total === 10000, 'khoản Kho Tổng không ✓ ở nhóm chính');
ok(G.total === 450000, 'tổng còn nợ 450.000 (bỏ khoản đã trả hết): ' + G.total);
ok(G.late === 2, 'quá 7 ngày: Bàn 5 (11) và Cô Lan Anh (9) → 2, Kho Tổng ✓ không tính');
ok(!G.main.some((g) => g.who === 'Anh Dũng'), 'khoản còn 0 thì bỏ');
const C = debtGroups([{ id: 'a', who: 'Cô Lan', left: 10000, date: '2026-11-18' }, { id: 'b', who: ' cô lan ', left: 5000, date: '2026-11-17' }], today);
ok(C.main.length === 1 && C.main[0].n === 2 && C.main[0].total === 15000 && C.main[0].who === 'Cô Lan', 'tên khác chữ hoa / dấu cách vẫn là 1 người (hiện tên gặp đầu tiên)');
const E = debtGroups([], today);
ok(E.main.length === 0 && E.fam.length === 0 && E.total === 0 && E.late === 0, 'không ai nợ');
ok(debtGroups(undefined, today).total === 0, 'thiếu danh sách nợ không lỗi');

print(`ĐẠT ${n} kiểm tra`);
