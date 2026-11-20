// Bài thử bước 172 đợt B: mục kiểm tra "nợ mới của ca đã xếp đúng người + nhóm công nợ" (phanloai). Chạy: jsc -m kiem_tra/so_thu_chi_tinh_dot13.mjs
// Thiết kế: tai_lieu/superpowers/specs/2026-11-20-doi-soat-thu-chi-6-buoc-design.md (mục 8.6, 8.7). Máy chủ: app__stc_ds_missing (tệp 151).
import { dsChecks, dsLeft, dsCtx } from '../docs/js/so_thu_chi_tinh.js';
let n = 0;
const ok = (c, m) => { if (!c) throw new Error('KIỂM TRA THẤT BẠI: ' + m); n++; };
const okc = [{ k: 'mo', st: 'ok' }, { k: 'dt', st: 'ok' }, { k: 'no', st: 'ok' }];
const ks = (step) => step.map((x) => x.k).join(',');
const get = (steps, k) => steps.flat().find((x) => x.k === k);
const base = (o = {}) => ({ id: 7, fabi: { has: true }, bank_ck: 1, cash_mode: 'ca', ql_counted: 5000000, recon_money_done: true, ticks: ['anh'], ...o });
const run = (ca, x = {}) => dsChecks(ca, { checks: okc, items: [], gaps: [], next: null, last: true, ...x });
const moi = (id, o = {}) => ({ report_id: 7, t: 'moi', id, who: 'bàn ' + id, kind: 'muon', amount: 20000, left: 20000, sorted: false, ...o });

// (a) ca không có nợ mới → không có mục phanloai
ok(ks(run(base())[0]) === 'mo,dt,no,anh', 'không truyền debts: bước 1 như cũ');
ok(ks(run(base(), { debts: [] })[0]) === 'mo,dt,no,anh', 'debts rỗng: không có mục phanloai');
// (b) 2 nợ mới, 1 chưa xếp → có mục, chưa xong, đứng sau ô Nợ bill
let s = run(base(), { debts: [moi(1, { sorted: true }), moi(2)] });
ok(ks(s[0]) === 'mo,dt,no,phanloai,anh', 'có nợ mới còn tiền → mục phanloai đứng sau no');
ok(get(s, 'phanloai').auto === true && get(s, 'phanloai').ok === false, 'phanloai là mục web tự tích, đang chưa xong');
ok(get(s, 'phanloai').n === 1, 'ghi số khoản còn chưa xếp');
ok(dsLeft(s)[0] === 1, 'bước 1 còn 1 mục');
// (c) xếp hết → xong
s = run(base(), { debts: [moi(1, { sorted: true }), moi(2, { sorted: true })] });
ok(get(s, 'phanloai').ok === true && get(s, 'phanloai').n === 0 && dsLeft(s)[0] === 0, 'xếp hết → mục xong, bước 1 hết việc');
// (d) nợ mới đã trả hết thì không tính
s = run(base(), { debts: [moi(1, { left: 0 }), moi(2, { sorted: true })] });
ok(get(s, 'phanloai').ok === true, 'khoản đã trả hết (left 0) chưa xếp không bị tính');
ok(ks(run(base(), { debts: [moi(1, { left: 0 })] })[0]) === 'mo,dt,no,anh', 'chỉ có nợ đã trả hết → không hiện mục');
ok(ks(run(base(), { debts: [{ report_id: 7, t: 'tra', id: 9, left: 0, sorted: false }] })[0]) === 'mo,dt,no,anh', 'dòng khách trả nợ cũ (t = tra) không phải nợ mới');
// đứng trước mục hoá đơn sửa / xoá
ok(ks(run(base({ fabi: { has: true, edited_bills: 1 } }), { debts: [moi(1)] })[0]) === 'mo,dt,no,phanloai,hd,anh', 'thứ tự: 3 ô số, xếp nợ, hoá đơn sửa, ảnh');
// (e) dsCtx lấy đúng nợ mới của ca
const fb = (o = {}) => ({ has: true, opening: 1000000, revenue: 0, debt: 0, ...o });
const mk = (id, shift, o = {}) => ({ id, date: '2026-11-18', shift, cash_mode: 'ngay', ql_counted: null, start_tm: 1000000, real_tm: null, nv: { opening: 1000000, revenue: 0, debt: 0 }, fabi: fb(), bank_ck: 0, recon_money_done: true, ticks: [], ...o });
const D = { cas: [mk(7, 'Sáng'), mk(8, 'Chiều')], items: [],
  ca_debts: [moi(1), moi(2, { report_id: 8 }), { report_id: 7, t: 'tra', id: 3, left: 0 }, moi(4, { report_id: '7', sorted: true })] };
let c = dsCtx(D, D.cas[0]);
ok(c.debts.length === 2 && c.debts[0].id === 1 && c.debts[1].id === 4, 'dsCtx: chỉ lấy nợ mới (t = moi) của đúng ca, mã ca dạng chữ cũng nhận');
ok(dsCtx({ cas: D.cas, items: [] }, D.cas[0]).debts.length === 0, 'sổ tháng không có ca_debts → mảng rỗng');
ok(get(dsChecks(D.cas[0], c), 'phanloai').n === 1, 'ghép dsCtx vào dsChecks: còn 1 khoản chưa xếp');
print('ĐẠT ' + n + ' kiểm tra');
