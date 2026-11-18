// Bài thử hàm gom Việc của tôi (bước 138). Chạy: jsc -m kiem_tra/hom_nay_viec_138.mjs
import { collectWork, GROUP_LABEL } from '../docs/js/hom_nay_viec.js';

const helpers = {
  jobName: (j) => ({ 1: 'Đối soát ca', 24: 'Giao việc riêng' }[j] || 'Việc'),
  pcDue: (t) => t.due_at || null,
  gvDue: (k) => k.due || null,
  rstate: (k) => ({ chua_phan_cong: 0, da_giao: 1, dang_xu_ly: 2, cho_duyet: 3 }[k.status] ?? 2),
};
const now = '2026-11-18 13:00:00';
const out = [];
let n = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('KIỂM TRA THẤT BẠI: ' + msg); n++; };

const pc = { me: 7, tasks: [{ id: 1, job: 1, code: 'LHP', due_at: '2026-11-18 20:00:00' }, { id: 2, job: 1, code: 'HS', due_at: '2026-11-17 22:00:00' }],
  gv: [{ id: 5, job: 24, content: 'Sửa máy', code: 'LHP', status: 'dang_xu_ly', assignee_id: 7, due: '2026-11-20 10:00:00' },
       { id: 6, job: 24, content: 'Kiểm kê', reviewer: 'NV9 – Lan', status: 'cho_duyet', assignee_id: 7, reviewer_id: 9, due: '2026-11-19 10:00:00' }], watch: [] };
const training = { rows: [{ id: 3, employee: 'Học viên', program: 'chay_ban', status: 'dao_tao_tiep', due: '2026-11-25', my_duties: ['Hướng dẫn'], achieved: 10, total: 68 },
  { id: 4, employee: 'Học viên 2', program: 'chay_ban', status: 'cho_nhan_xet', due: '2026-11-21', my_duties: ['Quản lý phụ trách'], achieved: 68, total: 68 }] };
const ka = [{ id: 8, status: 'chua_xu_ly', seen_at: null, shift: 'Sáng', branch: 'LHP', work_date: '2026-11-17', amount: 50000 },
  { id: 9, status: 'chua_xu_ly', seen_at: '2026-11-17 10:00:00', reply: 'Đã giải thích', shift: 'Tối', branch: 'HS', work_date: '2026-11-16', amount: 20000 },
  { id: 10, status: 'tru_luong', seen_at: '2026-11-10 10:00:00', reply: 'x', auto_tru: false, shift: 'Tối', branch: 'HS', work_date: '2026-11-10', amount: 10000 }];
const todo = [{ key: 'cho_doi_soat', label: 'Ca chờ đối soát', n: 3, link: '/quan-ly/doi-soat', group: 'Đối soát' },
  { key: 'cong_viec_cua_toi', label: 'Việc của tôi đang mở', n: 4, link: '/viec', group: 'Công việc' },
  { key: 'mon', label: 'Món chưa có nhóm', n: 0, link: '/cai-dat/nhom-mon', group: 'Kế toán' }];

const r = collectWork({ now, pc, training, ka, todo }, helpers);
const keys = r.items.map((i) => i.key);
ok(!r.failed, 'có dữ liệu thì không báo lỗi');
ok(keys.indexOf('pc:2') < keys.indexOf('pc:1'), 'việc quá hạn đứng trước việc hạn hôm nay');
ok(r.items.find((i) => i.key === 'pc:2').group === 'late' && r.items.find((i) => i.key === 'pc:1').group === 'today', 'nhóm quá hạn / hôm nay');
ok(r.items.find((i) => i.key === 'gv:5').group === 'soon', 'việc trong 3 ngày là sắp đến hạn');
ok(!keys.includes('todo:cong_viec_cua_toi') && !keys.includes('todo:mon') && keys.includes('todo:cho_doi_soat'), 'bỏ dòng trùng Việc của tôi và dòng 0');
ok(new Set(keys).size === keys.length, 'không lặp hồ sơ');
ok(r.items.find((i) => i.key === 'gv:6').group === 'waiting' && r.items.find((i) => i.key === 'dt:4').group === 'waiting', 'đang chờ người khác');
ok(r.items.find((i) => i.key === 'dt:3').link === '/dao-tao/phieu?id=3', 'mở đúng phiếu đào tạo');
ok(keys.includes('ka:8') && r.items.find((i) => i.key === 'ka:9').group === 'waiting' && !keys.includes('ka:10'), 'khoản âm: mới / chờ quản lý / đã xử lý');
ok(keys[keys.length - 1].startsWith('gv:6') || r.items[r.items.length - 1].group === 'waiting', 'nhóm đang chờ ở cuối');
ok(collectWork({ now, pc: null, training: null, ka: null, todo: null }, helpers).failed, 'mọi nguồn lỗi thì báo lỗi');
ok(!collectWork({ now, pc, training: null, ka, todo }, helpers).failed, 'một nguồn lỗi vẫn hiện phần còn lại');
ok(collectWork({ now, pc: { tasks: [], gv: [] }, training: { rows: [] }, ka: [], todo: [] }, helpers).items.length === 0, 'trống');
ok(r.items.find((i) => i.key === 'gv:5').title === 'Sửa máy · LHP' && r.items.find((i) => i.key === 'gv:6').waitingFor === 'Lan kiểm tra', 'việc giao riêng hiện nội dung, người đang giữ bước');
ok(GROUP_LABEL.late === 'Quá hạn' && GROUP_LABEL.waiting === 'Đang chờ', 'nhãn nhóm');
out.push(`ĐẠT ${n} kiểm tra`);
print(out.join('\n'));
