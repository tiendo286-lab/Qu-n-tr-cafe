// Bài thử hàm thuần cho điểm nhỏ tệp 187: nhãn "giao lại" tính theo TỪNG mục trong một nhóm người dạy.
// Chạy: jsc -m kiem_tra/pc_dao_tao_tinh_187.mjs
import { groupsOf, workOf } from '../docs/js/pages/pc_dao_tao_tinh.js';
let n = 0;
const ok = (c, m) => { if (!c) throw new Error('KIỂM TRA THẤT BẠI: ' + m); n++; };
const sh = { date: '2026-11-28', shift: 'Sáng', branch_id: 1, branch: 'LHP', mates: [] };
const it = (no, o = {}) => ({ no, day: 1, title: 'Mục ' + no, state: 'chua', level: null, who_id: 7, date: sh.date, shift: sh.shift, sub_by: null, ...o });
// NV07 giữ: mục 1, 2 giao thẳng · mục 3, 4 do quản lý 8 giao lại · mục 5 do quản lý 9 giao lại; NV10 giữ mục 6, 7 đều do 8 giao lại; HD chính (5) mục 8
const row = { id: 1, instructor_id: 5, shifts: [sh], items: [it(4, { sub_by: 8 }), it(1), it(3, { sub_by: 8 }), it(2), it(5, { sub_by: 9 }),
  it(6, { who_id: 10, sub_by: 8 }), it(7, { who_id: 10, sub_by: 8 }), it(8, { who_id: null })] };
const gs = groupsOf(row, sh);
ok(gs.length === 3 && gs.map((g) => g.who_id).join() === '7,10,5', 'vẫn 3 nhóm theo người dạy, xếp theo mục nhỏ nhất — ' + gs.map((g) => g.who_id).join());
const g7 = gs[0];
ok(g7.items.map((x) => x.no).join() === '1,2,3,4,5', 'nhóm NV07 đủ 5 mục');
ok(g7.sub_by === null, 'nhóm lẫn lộn: không gắn "giao lại" cho cả nhóm (trước đây lấy theo mục gặp đầu tiên)');
ok(g7.mixed.length === 2 && g7.mixed[0].sub_by === 8 && g7.mixed[0].nos.join() === '3,4' && g7.mixed[1].sub_by === 9 && g7.mixed[1].nos.join() === '5', 'ghi riêng: mục 3, 4 do 8 giao lại · mục 5 do 9 giao lại');
ok(gs[1].sub_by === 8 && gs[1].mixed.length === 0, 'nhóm cả 2 mục cùng một người giao lại: giữ cách ghi cũ');
ok(gs[2].sub_by === null && gs[2].mixed.length === 0, 'nhóm giao thẳng: không ghi giao lại');
ok(workOf([row], 7, sh.date)[0].items.length === 5, 'việc của người dạy trong ngày không đổi');
print('ĐẠT ' + n + ' kiểm tra');
