// Bài thử chia nhóm Việc hôm nay (bước 142). Chạy: jsc -m kiem_tra/hom_nay_nhom_142.mjs
import { CATS, ROLE_TABS, buildSections, byRole, doneRows, everyoneWork, roleOfPerson } from '../docs/js/hom_nay_nhom.js';

let n = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('KIỂM TRA THẤT BẠI: ' + msg); n++; };
const it = (key, o) => ({ key, title: key, cat: 'vh', tag: '', kind: null, kindLabel: '', group: 'later', due: null, gap: false, review: false, redo: null,
  who: { text: 'Bạn', mine: true, none: false }, waitingFor: null, ...o });

// 1. Ba khối, đúng thứ tự, kể cả khi trống
const s0 = buildSections([]);
ok(s0.map((x) => x.cat.id).join() === 'vh,ns,kh' && s0.every((x) => x.entries.length === 0 && x.counts.n === 0), 'luôn đủ 3 khối Vận hành, Nhân sự, Khác');
ok(CATS[0].name === 'Vận hành' && CATS[1].name === 'Nhân sự' && CATS[2].name === 'Khác', 'tên khối');

// 2. Gộp: 2 việc cùng loại → 1 dòng gộp; 1 việc một loại → dòng thường; dòng gộp đứng ở vị trí việc gấp nhất
const items = [
  it('a', { kind: 'pc:1', kindLabel: 'Đối soát ca', group: 'today', due: '2026-11-18 20:00:00' }),
  it('b', { kind: 'pc:1', kindLabel: 'Đối soát ca', group: 'late', due: '2026-11-17 20:00:00' }),
  it('c', { kind: 'pc:4', kindLabel: 'Chuyển khoản', group: 'today', due: '2026-11-18 10:00:00' }),
  it('d', { group: 'waiting', waitingFor: 'QL H kiểm tra' }),
  it('e', { gap: true, group: 'soon', due: '2026-11-20 10:00:00' }),
  it('f', { review: true, group: 'later' }),
  it('g', { redo: 'Chụp lại', group: 'later' }),
  it('h', { cat: 'ns', kind: 'dtf', kindLabel: 'Đào tạo đã giao', group: 'soon', due: '2026-11-19 23:59:59' }),
  it('i', { cat: 'kh', group: 'later' }),
];
const S = buildSections(items);
const vh = S[0].entries;
const keyOf = (e) => (e.bundle ? 'B:' + e.kind : e.key);
ok(vh.map(keyOf).join() === 'f,g,e,B:pc:1,c,d', 'thứ tự: cần kiểm tra / làm lại → gấp → quá hạn → hôm nay → đang chờ (có: ' + vh.map(keyOf).join() + ')');
const B = vh.find((e) => e.bundle);
ok(B.kids.length === 2 && B.kids[0].key === 'b' && B.label === 'Đối soát ca' && B.top.key === 'b', 'dòng gộp 2 việc, việc quá hạn đứng đầu');
ok(B.counts.late === 1 && B.counts.today === 1 && B.counts.n === 2, 'số của dòng gộp');
ok(!vh.some((e) => e.bundle && e.kind === 'pc:4'), '1 việc một loại không gộp');
ok(S[1].entries.length === 1 && !S[1].entries[0].bundle, 'Nhân sự: 1 hạng mục đào tạo không gộp');
const c = S[0].counts;
ok(c.n === 7 && c.gap === 1 && c.late === 1 && c.today === 2 && c.review === 1 && c.redo === 1 && c.waiting === 1, 'số đầu khối: ' + JSON.stringify(c));
ok(S[2].counts.n === 1, 'Khác có 1 việc');

// 3. Vai trò người làm
ok(roleOfPerson({ role: 'ql', kt: true }) === 'Kế toán' && roleOfPerson({ role: 'ql_tong', kt: true }) === 'Quản lý tổng', 'Kế toán / Quản lý tổng');
ok(roleOfPerson({ role: 'ql', kt: false }) === 'Quản lý' && roleOfPerson({ role: 'nv' }) === 'Việc khác' && roleOfPerson(null) === 'Việc khác', 'Quản lý / Việc khác');
ok(ROLE_TABS.join() === 'Quản lý tổng,Quản lý,Kế toán,Việc khác', 'nút lọc vai trò');

// 4. Mọi người (Chủ = tài khoản 1)
const helpers = {
  jobName: (j) => ({ 1: 'Đối soát ca', 4: 'Chuyển khoản thực nhận' }[j] || 'Việc'), pcDue: (t) => t.due_at || null, gvDue: (k) => k.due || null,
  rstate: (k) => ({ chua_phan_cong: 0, da_giao: 1, dang_xu_ly: 2, cho_duyet: 3, hoan_thanh: 4 }[k.status] ?? 2),
  curStep: (t) => (t.steps || []).find((s) => !s.done_at),
};
const pcAll = { now: '2026-11-18 13:00:00', me: 1,
  people: [{ id: 1, name: 'Chủ', role: 'chu' }, { id: 2, name: 'QL B', role: 'ql' }, { id: 3, name: 'QL tổng D', role: 'ql_tong' }, { id: 4, name: 'KT C', role: 'ql', kt: true }, { id: 5, name: 'NV G', role: 'nv' }],
  tasks: [
    { id: 1, job: 1, code: 'LHP', steps: [{ accounts: [2, 3], names: ['QL B', 'QL tổng D'] }] },
    { id: 2, job: 4, code: 'ĐK', steps: [{ accounts: [4], names: ['KT C'] }] },
    { id: 3, job: 1, code: 'HS', steps: [{ accounts: [1], names: ['Chủ'] }] },
    { id: 4, job: 1, code: 'LL', steps: [{ accounts: [], names: [] }] }],
  gv: [
    { id: 10, content: 'Thay đèn', status: 'da_giao', assignee_id: 5, assignee: 'NV G', reviewer_id: 2, reviewer: 'QL B' },
    { id: 11, content: 'Sửa biển', status: 'cho_duyet', assignee_id: 2, assignee: 'QL B', reviewer_id: 1, reviewer: 'Chủ' },
    { id: 12, content: 'Rửa bình', status: 'hoan_thanh', assignee_id: 5, assignee: 'NV G', reviewer_id: 2, reviewer: 'QL B', approved_at: '2026-11-18 09:15:00' },
    { id: 13, content: 'Cũ', status: 'hoan_thanh', assignee_id: 5, assignee: 'NV G', reviewer_id: 2, reviewer: 'QL B', approved_at: '2026-11-17 09:15:00' }],
  done: [{ title: 'Đối soát ca LHP 16/11', code: 'LHP', job: 1, done_at: '2026-11-18 08:40:00', by: 'QL B' }, { title: 'Cũ', job: 1, done_at: '2026-11-16 08:00:00', by: 'QL B' }] };
const training = { rows: [{ id: 7, employee: 'HV1 – Học viên', status: 'dang_dao_tao', due: '2026-11-25', manager: 'QL B', instructor: 'Q1 – QL B', my_duties: [] },
  { id: 8, employee: 'HV2 – Xong', status: 'hoan_thanh', due: '2026-11-10', manager: 'QL B', my_duties: [] }] };
const E = everyoneWork(pcAll, training, 1, helpers);
const ek = (k) => E.items.find((x) => x.key === k);
ok(!ek('pc:3'), 'việc chỉ có Chủ làm không ở Mọi người');
ok(ek('pc:1').roles.includes('Quản lý') && ek('pc:1').roles.includes('Quản lý tổng'), 'việc 2 người: cả hai vai');
ok(ek('pc:4').roles.join() === 'Việc khác' && ek('pc:4').who.none, 'việc chưa có người nhận → Việc khác');
ok(ek('pc:2').roles.join() === 'Kế toán', 'việc của kế toán');
ok(ek('gv:10').roles.join() === 'Việc khác' && ek('gv:10').who.text === 'NV G', 'việc nhân viên làm → Việc khác');
ok(!ek('gv:11'), 'việc chờ Chủ kiểm tra là việc của Chủ, không ở Mọi người');
ok(!ek('gv:12') && !ek('gv:13'), 'việc đã xong không nằm trong danh sách đang mở');
ok(ek('dt:7') && ek('dt:7').roles.join() === 'Quản lý' && !ek('dt:8'), 'phiếu đào tạo đang mở theo quản lý phụ trách; phiếu xong thì bỏ');
ok(byRole(E.items, 'Kế toán').map((x) => x.key).join() === 'pc:2', 'lọc Kế toán');
ok(byRole(E.items, '').length === E.items.length, 'Tất cả');
ok(E.done.length === 2 && E.done.every((d) => /^\d\d:\d\d$/.test(d.at)), 'Đã xong hôm nay của mọi người: 2 việc, giờ HH:MM');
ok(E.done.find((d) => d.title.startsWith('Rửa bình')).by === 'QL B' && E.done.find((d) => d.title.startsWith('Rửa bình')).roles.join() === 'Việc khác', 'việc Đạt có người kiểm tra, lọc theo người làm');

// 5. Đã xong hôm nay của tôi (app_today_more.done_today)
const D = doneRows([
  { kind: 'pc', id: 1, job: 1, title: 'Đối soát ca', code: 'LHP', at: '2026-11-18 08:40:00', who: 'QL B' },
  { kind: 'gv', id: 2, title: 'Kiểm kê', code: 'LHP', handover: false, at: '2026-11-18 10:20:00', by: 'QL B', who: 'NV G' },
  { kind: 'gv', id: 3, title: 'Máy xay', handover: true, at: '2026-11-18 11:00:00', by: 'QL B', who: 'NV E' },
  { kind: 'gv', id: 4, title: 'Cũ', at: '2026-11-17 10:00:00', by: 'QL B', who: 'NV G' }], '2026-11-18', 'QL B');
ok(D.length === 3 && D[0].title.startsWith('Máy xay'), 'bỏ việc hôm qua, mới nhất trước');
ok(D[0].tag === 'Bàn giao ca' && D[1].tag === 'Giao việc riêng' && D[2].tag === 'Chốt ca', 'nhãn loại');
ok(D[2].by === null && D[1].by === 'QL B' && D[2].at === '08:40', 'pc không có người kiểm tra, giờ HH:MM');
ok(D[2].who === 'Bạn' && D[1].who === 'NV G', 'tên mình đổi thành Bạn');
ok(doneRows(null, '2026-11-18').length === 0, 'không có dữ liệu thì rỗng');

print(`ĐẠT ${n} kiểm tra`);
