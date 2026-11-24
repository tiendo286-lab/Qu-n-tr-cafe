// Bài thử hàm thuần trang Phân công đào tạo theo ca (tệp 174). Thiết kế: tai_lieu/superpowers/specs/2026-11-24-phan-cong-dao-tao-theo-ca-design.md
// Chạy: jsc -m kiem_tra/pc_dao_tao_tinh_174.mjs (dữ liệu giả tự dựng).
import { workDays, dayNo, groupsOf, shiftState, itemWhere, span, shortfall, workOf, cards, allShifts } from '../docs/js/pages/pc_dao_tao_tinh.js';
let n = 0;
const ok = (c, m) => { if (!c) throw new Error('KIỂM TRA THẤT BẠI: ' + m); n++; };
const sh = (date, shift = 'Sáng') => ({ date, shift, branch_id: 1, branch: 'LHP', mates: [] });
const it = (no, o = {}) => ({ no, day: 1, title: 'Mục ' + no, state: 'chua', level: null, who_id: null, date: null, shift: null, sub_by: null, ...o });
const row = {
  id: 1, instructor_id: 5, start_date: '2026-11-19', due: '2026-12-01', achieved: 2, total: 68,
  shifts: [sh('2026-11-19'), sh('2026-11-20'), sh('2026-11-21'), sh('2026-11-23', 'Tối'), sh('2026-11-24'), sh('2026-11-24', 'Tối')],
  items: [it(1, { state: 'dat', date: '2026-11-23', shift: 'Tối', who_id: 7 }), it(2, { state: 'chua', date: '2026-11-23', shift: 'Tối', who_id: 7 }),
    it(3, { date: '2026-11-24', shift: 'Sáng' }), it(4, { date: '2026-11-24', shift: 'Sáng', who_id: 5 }),
    it(5, { date: '2026-11-24', shift: 'Sáng', who_id: 9, sub_by: 8 }), it(6, { state: 'cho_kt', date: '2026-11-24', shift: 'Tối', who_id: 7 }), it(7)],
};
ok(workDays(row).join(',') === '2026-11-19,2026-11-20,2026-11-21,2026-11-23,2026-11-24', 'workDays: 5 ngày phân biệt, đã sắp');
ok(workDays({ shifts: [] }).length === 0, 'workDays: không lịch → rỗng');
ok(dayNo(row, '2026-11-24') === 5, 'dayNo: 24/11 là Ngày 5 (theo lịch đi làm thật)');
ok(dayNo(row, '2026-11-22') === null, 'dayNo: ngày không đi làm → null');
ok(span([1, 2, 3, 4, 7]) === '1–4, 7' && span([9]) === '9' && span([]) === '', 'span: "1–4, 7"');
const g = groupsOf(row, sh('2026-11-24'));
ok(g.length === 2 && g[0].who_id === 5 && g[0].items.map((x) => x.no).join() === '3,4' && g[1].who_id === 9 && g[1].sub_by === 8, 'groupsOf: mục người trống gộp vào HD chính 5; nhóm giao lại giữ sub_by');
ok(shiftState(row, sh('2026-11-23', 'Tối'), '2026-11-24') === 'tre', 'shiftState: ca qua còn mục chưa chấm → tre');
ok(shiftState(row, sh('2026-11-21'), '2026-11-24') === 'trong', 'shiftState: ca qua không phân công → trong');
ok(shiftState(row, sh('2026-11-24', 'Tối'), '2026-11-24') === 'ok', 'shiftState: mọi mục đã chấm (chờ kiểm tra) → ok');
ok(shiftState(row, sh('2026-11-24'), '2026-11-24') === 'giao', 'shiftState: hôm nay còn mục → giao');
ok(shiftState({ ...row, items: [] }, sh('2026-11-25'), '2026-11-24') === 'chua', 'shiftState: ca tới chưa giao → chua');
ok(itemWhere(row, 7) === null && itemWhere(row, 4).date === '2026-11-24' && itemWhere(row, 3).who_id === 5, 'itemWhere: mục không ngày → null; người trống → HD chính');
ok(shortfall({ ...row, shifts: row.shifts.concat([sh('2026-12-02')]) }, 8) === 3, 'shortfall: tới hạn 01/12 có 5 ngày làm, cần 8 → thiếu 3');
ok(shortfall({ ...row, shifts: [] }, 8) === 8, 'shortfall: không lịch → thiếu đủ 8');
const w = workOf([row], 7, '2026-11-24');
ok(w.length === 1 && w[0].sh.shift === 'Tối' && w[0].items.length === 1, 'workOf: người 7 ngày 24 → 1 ca, 1 mục');
ok(workOf([row], 5, '2026-11-24')[0].items.length === 2, 'workOf: HD chính tính cả mục người trống');
const c = cards([row], '2026-11-24');
ok(c.n === 1 && c.tre === 1 && c.kt === 1, 'cards: 1 người, 1 ca trễ, 1 mục chờ kiểm tra');
// Lịch đổi sau khi đã phân công: mục xếp ca 22/11 Chiều (không còn trong lịch) vẫn phải hiện, đếm, lọc được
const moved = { ...row, items: row.items.concat([it(8, { date: '2026-11-22', shift: 'Chiều', who_id: 7 })]) };
const as = allShifts(moved);
const off = as.find((s) => s.date === '2026-11-22');
ok(as.length === 7 && off && off.off === true && off.shift === 'Chiều' && as.indexOf(off) === 3, 'allShifts: thêm ca "không còn trong lịch" (đánh dấu off), xếp đúng thứ tự ngày');
ok(allShifts(row).length === 6 && allShifts(row).every((s) => !s.off), 'allShifts: không có mục lệch lịch → đúng các ca đã công bố');
ok(cards([moved], '2026-11-24').tre === 2, 'cards: ca lệch lịch đã qua còn mục chưa chấm → tính là ca trễ');
ok(workOf([moved], 7, '2026-11-22').length === 1, 'workOf: lọc người dạy thấy cả ca lệch lịch');
print('ĐẠT ' + n + ' kiểm tra');
