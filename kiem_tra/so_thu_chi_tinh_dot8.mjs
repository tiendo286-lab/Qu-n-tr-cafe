// Bài thử ô Ca theo Ngày trong "+ Thêm phiếu" (bước 163). Chạy: jsc -m kiem_tra/so_thu_chi_tinh_dot8.mjs
import { caChoices } from '../docs/js/so_thu_chi_tinh.js';

let n = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('KIỂM TRA THẤT BẠI: ' + msg); n++; };
const C = [
  { id: 3, date: '2026-11-18', shift: 'Tối', staff: 'Bình', recon_money_done: false },
  { id: 1, date: '2026-11-18', shift: 'Sáng', staff: 'Hà, Tú', recon_money_done: true },
  { id: 2, date: '2026-11-18', shift: 'Chiều', staff: null, recon_money_done: true },
  { id: 9, date: '2026-11-17', shift: 'Sáng', staff: 'An', recon_money_done: true },
];
const a = caChoices(C, '2026-11-18');
ok(a.map((x) => x.id).join() === '1,2,3', 'chỉ ca của ngày, xếp Sáng → Chiều → Tối');
ok(a[0].label === 'Ca Sáng · Hà, Tú' && a[0].ok === true && a[0].why === null, 'ca Sáng có người làm, chọn được');
ok(a[1].label === 'Ca Chiều', 'ca không có tên người làm không ra chữ null');
ok(a[2].ok === false && a[2].why === 'chưa xác nhận Fabi', 'ca chưa xác nhận Fabi mờ kèm lý do');
ok(caChoices(C, '2026-11-18', { locked: true }).every((x) => x.why === 'tháng đã chốt' && !x.ok), 'tháng đã chốt thì mọi ca mờ');
ok(caChoices(C, '').length === 0, 'ô Ngày trống');
ok(caChoices(C, '2026-11-19').length === 0, 'ngày không có ca');
ok(caChoices(undefined, '2026-11-18').length === 0, 'không có danh sách ca');
ok(caChoices([{ id: 5, date: '2026-11-18', shift: 'Tối', staff: '', recon_money_done: true }], '2026-11-18')[0].label === 'Ca Tối', 'tên người làm rỗng');

print(`ĐẠT ${n} kiểm tra`);
