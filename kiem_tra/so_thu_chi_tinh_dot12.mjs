// Bài thử bước 171 đợt A (Đối soát thu chi 6 bước): mục quản lý phải kiểm tra + trạng thái ca. Chạy: jsc -m kiem_tra/so_thu_chi_tinh_dot12.mjs
// Thiết kế: tai_lieu/superpowers/specs/2026-11-20-doi-soat-thu-chi-6-buoc-design.md (mục 6, 10)
import { dsChecks, dsLeft, dsCtx, caStage, BIG, DS_STEPS, TICKS } from '../docs/js/so_thu_chi_tinh.js';
let n = 0;
const ok = (c, m) => { if (!c) throw new Error('KIỂM TRA THẤT BẠI: ' + m); n++; };
const okc = [{ k: 'mo', st: 'ok' }, { k: 'dt', st: 'ok' }, { k: 'no', st: 'ok' }];
const ks = (step) => step.map((x) => x.k).join(',');
const get = (steps, k) => steps.flat().find((x) => x.k === k);
const base = (o = {}) => ({ id: 7, fabi: { has: true }, bank_ck: 1, cash_mode: 'ca', ql_counted: 5000000, recon_money_done: true, ticks: [], ...o });
const chi = (amount, cat = 'Nguyên liệu') => ({ ca_id: 7, book: 'chi', pm: 'tm', col: 'chi', amount, cat });
const thuNo = { ca_id: 7, book: 'thu', pm: 'tm', col: 'no', amount: 200000 };
const run = (ca, x = {}) => dsChecks(ca, { checks: okc, items: [], gaps: [], next: null, last: true, ...x });

ok(BIG === 300000 && DS_STEPS.length === 6 && TICKS.includes('sau_tm') && TICKS.includes('hd'), 'hằng số');
// bước 1
let s = run(base());
ok(s.length === 5, '5 bước có mục kiểm tra');
ok(ks(s[0]) === 'mo,dt,no,anh', 'bước 1 ca thường: 3 ô + ảnh, không có hd khi không có hoá đơn sửa / xoá');
ok(get(s, 'mo').auto && get(s, 'mo').ok && !get(s, 'anh').auto && !get(s, 'anh').ok, 'ô khớp tự tích, ảnh chờ tích tay');
ok(ks(run(base({ fabi: { has: true, edited_bills: 2 } }))[0]) === 'mo,dt,no,hd,anh', 'có hoá đơn sửa / xoá → có mục hd');
ok(!get(run(base(), { checks: [{ k: 'mo', st: 'red' }, { k: 'dt', st: 'ok' }, { k: 'no', st: 'ok' }] }), 'mo').ok, 'ô đỏ → chưa xong');
ok(get(run(base({ ticks: ['anh'] })), 'anh').ok, 'đã tích ảnh');
// bước 2
ok(ks(run(base({ ql_counted: null, recon_money_done: false }))[1]) === 'cash,ck,goi,fabi', 'thu theo ca: đếm két, ngân hàng, gối đầu, xác nhận');
ok(!get(run(base({ ql_counted: null, recon_money_done: false })), 'cash').ok, 'chưa nhập tiền mặt → cash chưa xong');
ok(get(run(base({ ql_counted: 0 })), 'cash').ok, 'nhập 0 vẫn là đã nhập');
ok(!get(run(base({ bank_ck: null })), 'ck').ok && !get(run(base({ kt_wait: true })), 'ck').ok, 'chưa có số ngân hàng / chờ kế toán → ck chưa xong');
ok(!get(run(base({ recon_money_done: false })), 'fabi').ok && get(run(base()), 'fabi').ok, 'mục Xác nhận Fabi');
const ngay = base({ cash_mode: 'ngay', ql_counted: null });
ok(ks(run(ngay, { last: false, next: { sent: true, moOk: true } })[1]) === 'ck,ket,fabi', 'thu cuối ngày, không phải ca cuối: không đếm két, không gối đầu, có ket');
ok(get(run(ngay, { last: false, next: { sent: true, moOk: true } }), 'ket').ok, 'ca sau mở ca khớp → ket xong');
ok(!get(run(ngay, { last: false, next: { sent: true, moOk: false } }), 'ket').ok && !get(run(ngay, { last: false, next: { sent: true, moOk: false } }), 'ket').wait, 'ca sau mở ca lệch → ket chưa xong, không phải chờ');
const cho = get(run(ngay, { last: false, next: null }), 'ket');
ok(!cho.ok && cho.wait === true, 'ca sau chưa gửi phiếu → ket chờ, chưa xong');
ok(ks(run(ngay, { last: true })[1]) === 'cash,ck,goi,fabi', 'thu cuối ngày, ca cuối ngày: đếm két + gối đầu');
// bước 3
ok(ks(run(base())[2]) === 'sot', 'không có thu nợ → chỉ có sot');
ok(ks(run(base(), { items: [thuNo] })[2]) === 'tn,sot', 'có thu nợ → có tn');
ok(ks(run(base(), { items: [{ ...thuNo, ca_id: 8 }] })[2]) === 'sot', 'thu nợ của ca khác không tính');
ok(ks(run(base(), { items: [{ ...thuNo, void: true }] })[2]) === 'sot', 'phiếu đã xoá không tính');
// bước 4
ok(ks(run(base())[3]) === 'cat', 'không có khoản chi → chỉ có cat (xong)');
ok(get(run(base()), 'cat').ok, 'không có khoản chi → cat xong');
ok(ks(run(base(), { items: [chi(299999)] })[3]) === 'cat,that', 'chi 299.999 → không có lon');
ok(ks(run(base(), { items: [chi(300000)] })[3]) === 'cat,that,lon', 'chi 300.000 → có lon');
ok(!get(run(base(), { items: [chi(50000, null)] }), 'cat').ok, 'khoản chi chưa có nhóm → cat chưa xong');
ok(ks(run(base(), { items: [{ ca_id: 7, book: 'chi', pm: 'tm', col: 'no', amount: 900000 }] })[3]) === 'cat', 'Cho nợ không phải khoản chi cần nhóm');
// bước 5
const gap = (o) => ({ pm: 'tm', amt: -30000, done: false, wait: false, small: false, ...o });
ok(ks(run(base())[4]) === 'tm,ck5' && get(run(base()), 'tm').ok, 'không lệch → tm, ck5 xong, không có ld');
s = run(base(), { gaps: [gap()] });
ok(ks(s[4]) === 'tm,ck5,ld' && !get(s, 'tm').ok && get(s, 'ck5').ok, 'lệch tiền mặt −30.000 chưa xử lý → tm chưa xong, có ld');
ok(get(run(base({ ticks: ['sau_tm'] }), { gaps: [gap()] }), 'tm').ok, 'bấm Để sau → tm xong');
ok(!get(run(base({ ticks: ['sau_ck'] }), { gaps: [gap()] }), 'tm').ok, 'Để sau của chuyển khoản không tính cho tiền mặt');
ok(get(run(base(), { gaps: [gap({ done: true })] }), 'tm').ok && get(run(base(), { gaps: [gap({ wait: true })] }), 'tm').ok, 'đã xử lý / chờ Chủ duyệt → tm xong');
s = run(base(), { gaps: [gap({ amt: -5000, small: true, done: true })] });
ok(get(s, 'tm').ok && ks(s[4]) === 'tm,ck5', 'lệch nhỏ 5.000 → xong, không có ld');
ok(!get(run(base(), { gaps: [gap({ pm: 'ck', amt: 40000 })] }), 'ck5').ok, 'lệch chuyển khoản chưa xử lý → ck5 chưa xong');
// đếm còn thiếu
ok(dsLeft(run(base(), { items: [chi(400000, null), thuNo], gaps: [gap()] })).join(',') === '1,1,2,3,2', 'dsLeft đếm mục chưa xong từng bước');
ok(dsLeft(run(base({ ticks: ['anh', 'goi', 'sot'] }))).join(',') === '0,0,0,0,0', 'tích đủ → không còn mục nào');
// trạng thái ca
const st = (ca, gaps = []) => caStage(ca, okc, null, false, gaps);
ok(st(base({ recon_money_done: false })).k === 'cho', 'chưa xác nhận → chờ xác nhận Fabi');
ok(st(base()).k === 'xn' && /Đã xác nhận Fabi/.test(st(base()).txt), 'đã xác nhận, chưa bấm Hoàn thành → xn');
ok(st(base(), [gap()]).k === 'xn', 'chưa Hoàn thành thì còn lệch cũng vẫn là xn');
ok(st(base({ done: { by: 'x', at: 'y' } }), [gap()]).k === 'con', 'đã Hoàn thành + còn lệch → 🟠');
ok(st(base({ done: { by: 'x', at: 'y' } }), [gap({ done: true })]).k === 'xong', 'đã Hoàn thành + hết lệch → 🟢');
// dsCtx: gom dữ liệu của 1 ca từ sổ tháng (giao diện và bộ giả lập dùng chung)
const fb = (o = {}) => ({ has: true, opening: 1000000, revenue: 0, debt: 0, ...o });
const mk = (id, shift, o = {}) => ({ id, date: '2026-11-18', shift, cash_mode: 'ngay', ql_counted: null, start_tm: 1000000, real_tm: null, nv: { opening: 1000000, revenue: 0, debt: 0 }, fabi: fb(), bank_ck: 0, recon_money_done: true, ticks: [], ...o });
// ca Sáng thiếu 30.000 (thu cuối ngày) → két để lại 970.000 → ca Chiều mở ca 970.000 là khớp
const D = { cas: [mk(1, 'Sáng'), mk(2, 'Chiều', { fabi: fb({ opening: 970000 }), nv: { opening: 970000, revenue: 0, debt: 0 } }), { ...mk(9, 'Sáng'), date: '2026-11-19' }],
  items: [{ id: 'g', ca_id: 1, book: 'chi', pm: 'tm', col: 'lech', amount: 30000, status: 'Chờ xử lý (thiếu)', gap: {} }, { id: 'x', ca_id: 2, book: 'chi', pm: 'tm', col: 'chi', amount: 400000, cat: null }] };
let c = dsCtx(D, D.cas[0]);
ok(c.last === false && c.next && c.next.sent === true && c.next.moOk === true, 'ca Sáng: có ca sau đã gửi phiếu, tiền mở ca sau khớp');
ok(c.gaps.length === 1 && c.gaps[0].amt === -30000 && c.checks.length === 5 && c.items === D.items, 'ca Sáng: lấy đúng dòng chênh lệch và 5 ô kiểm');
ok(ks(dsChecks(D.cas[0], c)[1]) === 'ck,ket,fabi' && ks(dsChecks(D.cas[0], c)[4]) === 'tm,ck5,ld', 'dsCtx nối thẳng vào dsChecks');
c = dsCtx(D, D.cas[1]);
ok(c.last === true && c.next === null && c.gaps.length === 0, 'ca Chiều là ca cuối ngày');
ok(ks(dsChecks(D.cas[1], c)[3]) === 'cat,that,lon', 'ca Chiều: khoản chi 400.000 chưa nhóm');
ok(dsCtx(D, D.cas[2]).last === true, 'ca ngày khác không tính là ca sau');
const D2 = { cas: [mk(1, 'Sáng'), mk(2, 'Chiều', { fabi: fb({ opening: 950000 }), nv: { opening: 950000, revenue: 0, debt: 0 } })], items: [] };
ok(dsCtx(D2, D2.cas[0]).next.moOk === false, 'ca sau mở ca lệch tiền ca này để lại → moOk false');
print('ĐẠT ' + n + ' kiểm tra');
