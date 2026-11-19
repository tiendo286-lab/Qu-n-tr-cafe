// Bài thử hàm kiểm giờ chốt (bước 162). Chạy: jsc -m kiem_tra/gio_chot_tinh_162.mjs
import { gioCheck, gioPreview, gioFabiNote } from '../docs/js/gio_chot_tinh.js';

let n = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('KIỂM TRA THẤT BẠI: ' + msg); n++; };
const g = { shift: 'Sáng', rev_start: '2026-11-18 06:45', rev_end: '2026-11-18 14:05',
  next: { shift: 'Chiều', submitted: true, rev_start: '2026-11-18 14:05', rev_end: '2026-11-18 21:30' }, fabi_close: null, by_fabi: false, fabi_bad: false };

ok(gioCheck(g, '2026-11-18 14:20', 'nhập nhầm') === null, 'giờ hợp lệ');
ok(gioCheck(g, '2026-11-18 14:20', ' ') === 'Phải ghi lý do sửa giờ.', 'lý do trống');
ok(gioCheck(g, '2026-11-18 06:45', 'x') === 'Giờ chốt phải sau giờ bắt đầu ca (06:45).', 'bằng giờ bắt đầu');
ok(gioCheck(g, '2026-11-18 21:30', 'x') === 'Giờ chốt phải trước giờ chốt ca Chiều (21:30).', 'bằng giờ chốt ca sau');
ok(gioCheck(g, '', 'x') === 'Giờ chốt không hợp lệ.', 'trống');
ok(gioCheck(g, '2026-11-18 25:61', 'x') === 'Giờ chốt không hợp lệ.', 'giờ không có thật');
ok(gioCheck({ ...g, by_fabi: true, fabi_close: '2026-11-18 14:20' }, '2026-11-18 14:30', 'x') === 'Ca đã có file Fabi — giờ chốt lấy theo file.', 'có file Fabi');
ok(gioCheck({ ...g, next: { ...g.next, submitted: false, rev_end: null } }, '2026-11-18 22:00', 'x') === null, 'ca sau chưa gửi thì không chặn theo giờ chốt ca sau');

ok(gioPreview(g, '2026-11-18 14:20') === 'Ca Chiều đổi giờ bắt đầu: 14:05 → 14:20', 'báo ca sau');
ok(gioPreview({ ...g, next: null }, '2026-11-18 14:20') === null, 'không có ca sau');
ok(gioPreview(g, '2026-11-18 14:05') === null, 'giờ không đổi');
ok(gioPreview({ ...g, next: { ...g.next, submitted: false } }, '2026-11-18 14:20') === null, 'ca sau chưa gửi phiếu');

const t = { shift: 'Tối', rev_start: '2026-11-18 21:30', rev_end: '2026-11-18 23:50', next: null, by_fabi: false };
ok(gioCheck(t, '2026-11-19 00:30', 'x') === null, 'ca Tối qua nửa đêm');

ok(gioFabiNote({ ...g, by_fabi: true, fabi_close: '2026-11-18 14:20' }).txt === 'theo file Fabi', 'ghi chú theo file');
ok(gioFabiNote({ ...g, fabi_bad: true, fabi_close: '2026-11-18 22:00' }).txt === 'File Fabi: 22:00 — không hợp lệ, sửa tay', 'ghi chú file vô lý');
ok(gioFabiNote(g) === null, 'không có file');

print(`ĐẠT ${n} kiểm tra`);
