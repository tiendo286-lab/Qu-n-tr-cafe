// Bài thử phép tính bảng Chênh lệch tiền (27/11/2026). Chạy: jsc -m kiem_tra/chenh_lech_tinh.mjs
import { CL_ST, filterRows, gapRows, handled, sortRows, summary, waitingCas } from '../docs/js/chenh_lech_tinh.js';
import { caGaps, dayChain } from '../docs/js/so_thu_chi_tinh.js';
let n = 0;
const ok = (c, m) => { if (!c) throw new Error('KIỂM TRA THẤT BẠI: ' + m); n++; };
const ca = (id, date, shift, o = {}) => ({ id, date, shift, cash_mode: 'ca', start_tm: 1000000, staff: 'A, B', recon_money_done: true, done: { by: 'QL', at: 'x' }, ...o });
const lech = (id, caId, date, pm, book, amount, o = {}) => ({ id, ca_id: caId, date, pm, book, col: 'lech', amount, gross: amount, ...o });
const dt = (id, caId, date, pm, amount) => ({ id, ca_id: caId, date, pm, book: 'thu', col: 'dt', amount });
const gap = (kind, avail, o = {}) => ({ kind, avail, item: 'tien_mat', people: [{ employee_id: 1, name: 'A' }, { employee_id: 2, name: 'B' }], tl: [], decisions: [], debts: [], matches: [], qc_wait: [], cands: [], ...o });
const D = { branch: { id: 1, code: 'LHP' }, cas: [ca(10, '2026-11-20', 'Sáng'), ca(11, '2026-11-20', 'Tối'), ca(12, '2026-11-21', 'Sáng'), ca(13, '2026-11-22', 'Sáng'), ca(14, '2026-11-23', 'Sáng', { recon_money_done: false }), ca(15, '2026-11-24', 'Sáng'), ca(16, '2026-11-25', 'Sáng', { done: null }), ca(17, '2026-11-26', 'Sáng', { done: null })],
  items: [dt('d10', 10, '2026-11-20', 'tm', 500000),
    lech('g10', 10, '2026-11-20', 'tm', 'chi', 50000, { gap: gap('thieu', 50000) }),                                   // thiếu 50k, chưa xử lý
    lech('g11', 11, '2026-11-20', 'tm', 'chi', 80000, { status: 'Đã xử lý', gap: gap('thieu', 0, { tl: [{ id: 1, name: 'A', amount: 40000 }, { id: 2, name: 'B', amount: 40000 }] }) }),
    lech('g12', 12, '2026-11-21', 'ck', 'thu', 60000, { status: 'Quán chịu · chờ Chủ duyệt', gap: gap('du', 0, { matches: [{ id: 7, with: 'ca Tối 20/11', amount: 60000, status: 'cho_duyet' }] }) }),
    lech('g13', 13, '2026-11-22', 'tm', 'thu', 2000, { status: 'Lệch nhỏ' }),
    lech('g14', 14, '2026-11-23', 'tm', 'chi', 30000),                                                                   // ca chưa xác nhận tiền: chưa có phiếu chênh lệch
    lech('g16', 16, '2026-11-25', 'tm', 'chi', 70000, { gap: gap('thieu', 70000) }),   // ca CHƯA đối soát xong: không vào bảng
    lech('g17', 17, '2026-11-26', 'tm', 'thu', 3000, { status: 'Lệch nhỏ' }),                 // chưa xong + lệch nhỏ: không tính là ca đang chờ
    lech('g15', 15, '2026-11-24', 'tm', 'chi', 100000, { gap: gap('thieu', 40000, { qc_wait: [{ id: 9, by: 'QL', amount: 60000 }] }) })] };
const R = gapRows(D); const by = (id) => R.find((r) => r.id === id);
ok(R.length === 6 && !R.some((r) => r.id === 'g16' || r.id === 'g17'), 'chỉ ca đã đối soát xong mới vào bảng (ca 16, 17 chưa xong: không có) — ' + R.length);
ok(gapRows(D, { all: true }).length === 8 && waitingCas(D) === 1, 'đếm riêng: 1 ca chưa đối soát xong đang có lệch đáng kể (ca chỉ lệch nhỏ không tính)');
ok(CL_ST.cho[0] === 'Còn chênh lệch' && CL_ST.xong[0] === 'Đã xử lý', 'tên trạng thái theo lời anh: Còn chênh lệch / Đã xử lý');
// số phải khớp đúng nguồn của Sổ thu chi
for (const c of D.cas.filter((x) => x.done)) for (const g of caGaps(D.items, c.id)) { const r = by(g.x.id); const mm = dayChain(D, c.date).get(c.id).money[g.pm];
  ok(r.amt === g.amt && r.must === mm.must && r.real === mm.real && r.real - r.must === r.amt, `ca ${c.id}: lệch / phải có / thực tế đúng số của Sổ thu chi, thực tế − phải có = lệch`); }
ok(by('g10').st === 'cho' && by('g10').left === 50000 && by('g10').amt === -50000 && by('g10').can_open, 'thiếu chưa xử lý: Chờ xử lý, còn lại 50.000, mở được phiếu');
ok(by('g11').st === 'xong' && by('g11').left === 0 && by('g11').handled.length === 2 && by('g11').handled[0].text === 'Trừ lương A', 'đã trừ lương hết: Đã xử lý, ghi từng người');
ok(by('g12').st === 'chu' && by('g12').amt === 60000 && by('g12').waits.join() === 'match:7', 'ghép ca chờ Chủ: Chờ Chủ duyệt, có mã để Chủ duyệt');
ok(by('g13').st === 'nho' && by('g13').left === 0 && !by('g13').can_open, 'lệch nhỏ: nhãn riêng, không cần xử lý');
ok(by('g14').st === 'tam' && by('g14').left === 30000 && !by('g14').can_open, 'ca chưa xác nhận tiền: Số tạm, chưa mở được phiếu');
ok(by('g15').st === 'chu' && by('g15').left === 40000 && by('g15').waits.join() === 'qc:9', 'quán chịu chờ Chủ + còn 40.000: Chờ Chủ duyệt, vẫn ghi còn lại');
ok(by('g10').staff === 'A, B' && by('g14').staff === 'A, B' && by('g10').branch === 'LHP', 'người làm ca + cơ sở');
ok(sortRows(R).map((r) => r.id).join() === 'g10,g15,g12,g14,g11,g13', 'xếp: chờ xử lý → chờ Chủ (mới trước) → số tạm → đã xử lý → lệch nhỏ — ' + sortRows(R).map((r) => r.id).join());
ok(filterRows(R, {}).length === 5 && !filterRows(R, {}).some((r) => r.st === 'nho'), 'mặc định ẩn lệch nhỏ');
ok(filterRows(R, { st: 'nho' }).length === 1 && filterRows(R, { st: 'cho' }).length === 1 && filterRows(R, { dir: 'du' }).map((r) => r.id).join() === 'g12' && filterRows(R, { pm: 'ck' }).length === 1 && filterRows(R, { dir: 'thieu', pm: 'tm' }).length === 4, 'lọc trạng thái / thiếu-dư / loại tiền, lọc chồng');
const S = summary(R);
ok(S.thieu.v === 260000 && S.thieu.n === 4 && S.du.v === 60000 && S.du.n === 1 && S.nho === 1, 'ô tổng thiếu / dư không tính lệch nhỏ — ' + JSON.stringify(S.thieu));
ok(S.cho.n === 1 && S.cho.v === 50000 && S.chu.n === 2 && S.chu.v === 120000 && S.tam.n === 1 && S.tam.v === 30000, 'ô chờ xử lý / chờ Chủ duyệt / số tạm');
ok(S.xong.v === 80000 && S.xong.tl === 80000 && S.xong.qc === 0, 'ô đã xử lý: chỉ tính khoản đã xong, tách trừ lương');
ok(handled(null).length === 0 && Object.keys(CL_ST).join() === 'cho,chu,xong,nho,tam', 'không có phiếu thì không có cách xử lý; đủ 5 trạng thái');
print('ĐẠT ' + n + ' kiểm tra');
