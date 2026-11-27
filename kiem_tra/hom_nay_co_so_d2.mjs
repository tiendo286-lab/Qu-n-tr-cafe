// Bài thử Việc hôm nay đợt 2 (27/11/2026): Theo dõi theo cơ sở. Chạy: jsc -m kiem_tra/hom_nay_co_so_d2.mjs
import { branchSummary, byBranch, byFlag, isLate, isNone } from '../docs/js/hom_nay_nhom.js';
import { collectWork } from '../docs/js/hom_nay_viec.js';
let n = 0;
const ok = (c, m) => { if (!c) throw new Error('KIỂM TRA THẤT BẠI: ' + m); n++; };
const it = (key, code, o = {}) => ({ key, code, group: 'later', who: { text: 'A', mine: false, none: false }, ...o });
const none = { text: 'Chưa có người nhận', mine: false, none: true };
const items = [it('a', 'LHP', { group: 'late' }), it('b', 'LHP'), it('c', 'ĐK', { who: none }), it('d', 'ĐK', { group: 'late', who: none }),
  it('e', ''), it('f', 'XYZ', { group: 'today' }), it('g', undefined, { group: 'late' })];
const S = branchSummary(items, ['LHP', 'ĐK', 'HS']);
ok(S.map((b) => b.code).join('|') === 'LHP|ĐK|HS|XYZ|', 'thứ tự: cơ sở của hệ thống → mã lạ → việc chung — ' + S.map((b) => b.code).join('|'));
ok(S[0].n === 2 && S[0].late === 1 && S[0].none === 0, 'LHP: 2 việc, 1 quá hạn');
ok(S[1].n === 2 && S[1].late === 1 && S[1].none === 2, 'ĐK: 2 việc, 1 quá hạn, 2 chưa có người nhận');
ok(S[2].n === 0 && S[2].late === 0, 'cơ sở không có việc vẫn hiện, số 0');
ok(S[4].name === 'Việc chung' && S[4].n === 2 && S[4].late === 1, 'việc không gắn cơ sở gom vào Việc chung (kể cả thiếu trường code)');
ok(S.reduce((s, b) => s + b.n, 0) === items.length, 'tổng các dòng = tổng số việc, không sót, không đếm trùng');
ok(branchSummary([], ['LHP']).length === 1 && branchSummary([it('x', 'LHP')], ['LHP']).length === 1, 'không có việc chung thì không có dòng Việc chung');
ok(byBranch(items, null).length === 7 && byBranch(items, 'ĐK').length === 2 && byBranch(items, '').length === 2, 'lọc cơ sở: null = mọi cơ sở, "" = việc chung');
ok(byFlag(items, 'late').length === 3 && byFlag(items, 'none').length === 2 && byFlag(items, '').length === 7, 'lọc chỉ quá hạn / chỉ chưa có người nhận');
ok(byFlag(byBranch(items, 'ĐK'), 'late').map((x) => x.key).join() === 'd', 'lọc chồng: ĐK + quá hạn');
ok(isLate(items[0]) && !isLate(items[1]) && isNone(items[2]) && !isNone({}), 'isLate / isNone');
// collectWork gắn mã cơ sở cho việc Bảng phân công và Giao việc riêng; việc khác để ''
const H = { jobName: () => 'Việc', pcDue: () => null, gvDue: () => null, rstate: () => 1, curStep: () => null };
const W = collectWork({ now: '2026-11-27 10:00:00', pc: { me: 1, tasks: [{ id: 1, job: 1, code: 'HS' }], gv: [{ id: 2, content: 'x', code: 'LL', assignee_id: 1 }, { id: 3, content: 'y', assignee_id: 1 }] },
  training: { rows: [{ id: 9, employee: 'E', my_duties: [] }] } }, H);
const code = (k) => W.items.find((i) => i.key === k).code;
ok(code('pc:1') === 'HS' && code('gv:2') === 'LL' && code('gv:3') === '' && code('dt:9') === '', 'collectWork: mã cơ sở theo việc, việc không cơ sở = ""');
print('ĐẠT ' + n + ' kiểm tra');
