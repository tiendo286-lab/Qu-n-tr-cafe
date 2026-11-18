// Bài thử hàm tính Sổ thu chi mới (đợt 4: ô Tiền mở ca 2 tầng). Chạy: jsc -m kiem_tra/so_thu_chi_tinh_dot4.mjs
import { caChecks } from '../docs/js/so_thu_chi_tinh.js';

let n = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('KIỂM TRA THẤT BẠI: ' + msg); n++; };
const ca = (o = {}) => ({ id: 1, nv: { opening: 1000000, revenue: 500000, debt: 0 }, fabi: { has: true, opening: 1000000, revenue: 500000, debt: 0 }, bank_ck: 0, kt_wait: false, ...o });
const link = (exp) => ({ expOpen: exp, money: { tm: { start: 1000000, real: 0, must: 0, gap: 0 }, ck: { real: 0, must: 0, gap: 0 } } });
const mo = (c, l) => caChecks(c, l)[0];

ok(mo(ca(), link(1000000)).st === 'ok', 'khớp cả 2 tầng');
// tầng 1: NV ghi khác Fabi → Sửa theo Fabi
const t1 = mo(ca({ nv: { opening: 1500000, revenue: 500000, debt: 0 }, fabi: { has: true, opening: 1050000, revenue: 500000, debt: 0 } }), link(1000000));
ok(t1.st === 'red' && t1.fix === 'fabi' && /Fabi/.test(t1.txt), 'tầng 1: NV khác Fabi → sửa theo Fabi (' + t1.txt + ')');
// tầng 2: Fabi khác số phải là → chọn ca chịu
const t2 = mo(ca({ nv: { opening: 1050000, revenue: 500000, debt: 0 }, fabi: { has: true, opening: 1050000, revenue: 500000, debt: 0 } }), link(1000000));
ok(t2.st === 'red' && t2.fix === 'blame' && t2.txt.includes('50.000'), 'tầng 2: Fabi khác số phải là → chọn ca chịu (' + t2.txt + ')');
// đã chọn ca chịu → xanh, ghi rõ
const t3 = mo(ca({ nv: { opening: 1050000, revenue: 500000, debt: 0 }, fabi: { has: true, opening: 1050000, revenue: 500000, debt: 0 }, blame: { who: 'nay', diff: 50000 } }), link(1000000));
ok(t3.st === 'ok' && t3.txt.includes('Ca này chịu') && t3.blame, 'đã chọn ca này chịu → xanh (' + t3.txt + ')');
const t4 = mo(ca({ nv: { opening: 1050000, revenue: 500000, debt: 0 }, fabi: { has: true, opening: 1050000, revenue: 500000, debt: 0 }, blame: { who: 'truoc', diff: 50000 } }), link(1000000));
ok(t4.st === 'ok' && t4.txt.includes('Ca trước chịu'), 'đã chọn ca trước chịu → xanh');
// doanh thu / nợ đỏ → sửa theo Fabi
const cs = caChecks(ca({ nv: { opening: 1000000, revenue: 400000, debt: 120000 }, fabi: { has: true, opening: 1000000, revenue: 500000, debt: 150000 } }), link(1000000));
ok(cs[1].st === 'red' && cs[1].fix === 'fabi' && cs[2].st === 'red' && cs[2].fix === 'fabi', 'doanh thu / nợ đỏ → sửa theo Fabi');

print('ĐẠT ' + n + ' kiểm tra');
