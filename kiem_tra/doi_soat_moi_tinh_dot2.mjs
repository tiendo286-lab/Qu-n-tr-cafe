// Bài thử hàm thuần — trang đối soát ca mới đợt 2 + 3. Chạy: jsc -m kiem_tra/doi_soat_moi_tinh_dot2.mjs (dòng cuối "ĐẠT n kiểm tra").
import { DS2, ds2Name } from '../docs/js/ds2.js';
import { workParts, confirmKeys, mergeRecon, staffPayload } from '../docs/js/doi_soat_moi_tinh.js';
const bad = []; let n = 0;
const eq = (got, want, msg) => { n++; if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${msg}: được ${JSON.stringify(got)}, cần ${JSON.stringify(want)}`); };

// ---- ds2Name: chỉ đổi ở trang mới, chỉ các hàm trong danh sách ----
eq(ds2Name('app_stc_ds_cash', '#/ca/doi-soat-moi?id=5&tab=tien'), 'app_ds2_ds_cash', 'trang mới: tiền mặt đếm → bản mới');
eq(ds2Name('app_stc_ds_cash', '#/ca/doi-soat-moi'), 'app_ds2_ds_cash', 'trang mới không tham số');
eq(ds2Name('app_ca_recon_debt_collect', '#/ca/doi-soat-moi?id=5'), 'app_ds2_debt_collect', 'khách trả nợ cũ → app_ds2_debt_collect');
eq(ds2Name('app_ca_recon_debt_uncollect', '#/ca/doi-soat-moi?id=5'), 'app_ds2_debt_uncollect', 'bỏ lần trả → app_ds2_debt_uncollect');
eq(ds2Name('app_stc_move_exchange_delete', '#/ca/doi-soat-moi?id=5'), 'app_ds2_move_exchange_delete', 'xoá luân chuyển → bản mới');
eq(ds2Name('app_stc_ds_cash', '#/ca/doi-soat?id=5&tab=tien'), 'app_ds2_ds_cash', 'đợt 4: #/ca/doi-soat là trang mới → bản mới');
eq(ds2Name('app_stc_ds_cash', '#/ca/doi-soat'), 'app_ds2_ds_cash', 'đợt 4: #/ca/doi-soat không tham số');
eq(ds2Name('app_stc_ds_cash', '#/ca/doi-soat-cu?id=5&tab=tien'), 'app_stc_ds_cash', 'đợt 4: trang cũ dự phòng giữ hàm cũ');
eq(ds2Name('app_stc_ds_cash', '#/ca/doi-soat-ca?id=5'), 'app_stc_ds_cash', 'đường dẫn khác bắt đầu bằng doi-soat — không đổi');
eq(ds2Name('app_stc_ds_cash', '#/quan-ly/so-thu-chi?tab=thu'), 'app_stc_ds_cash', 'Sổ thu chi giữ hàm cũ');
eq(ds2Name('app_stc_ds_cash', '#/ca/doi-soat-moix'), 'app_stc_ds_cash', 'đường dẫn khác bắt đầu giống — không đổi');
eq(ds2Name('app_stc_ds_cash', ''), 'app_stc_ds_cash', 'không có đường dẫn');
eq(ds2Name('app_stc_tick', '#/ca/doi-soat-moi?id=5'), 'app_stc_tick', 'tích: không đổi (hàm cũ đã đúng luật mới)');
eq(ds2Name('app_stc_ds_close', '#/ca/doi-soat-moi?id=5'), 'app_stc_ds_close', 'Xác nhận Fabi cũ: không đổi (trang mới không gọi)');
eq(ds2Name('app_stc_gap_thu', '#/ca/doi-soat-moi?id=5'), 'app_stc_gap_thu', 'xử lý lệch: giữ hàm cũ (cần đã xác nhận — trang mới tự xác nhận trước)');
eq([...DS2].every((x) => /^app_(stc|ca_recon)_/.test(x)), true, 'mọi tên trong danh sách đổi được sang app_ds2_');
eq(DS2.size, 12, 'đủ 12 hàm sửa tiền (tệp 173 có đủ bản app_ds2_*)');

// ---- workParts: phần việc sẽ duyệt khi bấm Duyệt phần việc / Hoàn thành ----
const R0 = (checks = {}, hand = null) => ({ id: 501, checks, cash_hand: hand });
eq(workParts(R0(), null), { parts: ['nhan_su', 'ban_giao', 'nhap_hang'], blocked: [] }, 'chưa duyệt gì: duyệt cả 3 (nhập hàng: máy chủ chặn nếu còn hàng chưa đối soát)');
eq(workParts(R0({ nhan_su: {}, nhap_hang: {} }), null), { parts: ['ban_giao'], blocked: [] }, 'đã duyệt Nhân sự + Nhập hàng: chỉ còn Bàn giao');
eq(workParts(R0({ nhan_su: {}, ban_giao: {}, nhap_hang: {} }), null), { parts: [], blocked: [] }, 'đã duyệt hết: không còn gì');
eq(workParts(R0({}, { state: 'can_dem_lai', gap: -50000 }), null), { parts: ['nhan_su', 'nhap_hang'], blocked: ['Nhận két lệch: cùng người ca trước đếm lại'] },
  'nhận két lệch cần đếm lại: KHÔNG tự duyệt Bàn giao, báo việc cần làm');
eq(workParts(R0({}, { state: 'khop' }), { viec: { thieu: ['Nhân sự', 'Chờ Chủ duyệt x2'] } }).blocked, [], 'chờ Chủ duyệt x2 không chặn');
// ---- confirmKeys: ô cơ bản quản lý xác nhận khi bấm Hoàn thành (ô có ở ca và chưa tích) ----
const it2 = (o) => ({ ca_id: 501, date: '2026-11-19', void: false, ...o });
const ca2 = (o = {}) => ({ id: 501, date: '2026-11-19', shift: 'Sáng', cash_mode: 'ca', start_tm: 1000000, ql_counted: 1000000, bank_ck: 0, kt_wait: false, recon_money_done: false, ticks: [], bill_list: 0,
  fabi: { has: true, opening: 1000000, revenue: 0, debt: 0, edited_bills: 0 }, nv: { opening: 1000000, revenue: 0, debt: 0 }, ...o });
const chi2 = [it2({ id: 'm:501:a#1', book: 'chi', pm: 'tm', col: 'chi', amount: 50000, cat: 'Nguyên liệu', src: 'move', meta: 'Phiếu ca' })];
eq(confirmKeys({ cas: [ca2()], items: chi2, ca_debts: [] }, ca2()), ['anh', 'sot', 'that', 'goi'], 'có khoản chi, thu theo ca: anh, sot, that, goi');
eq(confirmKeys({ cas: [ca2()], items: [], ca_debts: [] }, ca2()), ['anh', 'sot', 'goi'], 'không có khoản chi: không có ô that');
eq(confirmKeys({ cas: [ca2({ ticks: ['anh', 'sot'] })], items: chi2, ca_debts: [] }, ca2({ ticks: ['anh', 'sot'] })), ['that', 'goi'], 'ô đã tích không đưa lên');

// ---- đợt 4: mergeRecon — trang hiện người làm theo BẢN ĐỐI SOÁT (quản lý đã sửa) như trang cũ, không theo phiếu gốc ----
const R0b = { id: 7, staff: [{ employee_id: 1, code: 'A1', name: 'Gốc', time_in: '06:45', time_out: '12:30', worked: 1 }], checks: { nhan_su: {} }, cash_hand: { state: 'khop' }, goods_status: 'khong' };
const RCb = { data: { staff: [{ employee_id: 1, source: 'lich', worked: true, time_in: '06:45', time_out: '13:15', note: 'về muộn' }, { employee_id: 2, source: 'ho_tro', worked: false, absent_reason: 'ốm' }], goods_status: 'du' },
  employees: { 1: { code: 'A1', name: 'Nhân viên một', pay_cash: 0 }, 2: { code: 'B2', name: 'Nhân viên hai', pay_cash: 1 } } };
const Mb = mergeRecon(R0b, RCb);
eq(Mb.staff.map((x) => [x.employee_id, x.time_out || null, x.worked, x.name]), [[1, '13:15', 1, 'Nhân viên một'], [2, null, 0, 'Nhân viên hai']], 'người làm lấy theo bản đối soát + tên từ danh sách nhân viên');
eq([Mb.checks.nhan_su !== undefined, Mb.cash_hand.state, Mb.goods_status, Mb.id], [true, 'khop', 'du', 7], 'giữ dấu duyệt / bàn giao két của phiếu, trường đối soát theo bản đối soát');
eq(mergeRecon(R0b, null), R0b, 'không đọc được bản đối soát: dùng phiếu như cũ');
// ---- staffPayload: một người làm gửi lên app_ca_recon_save (đúng các trường máy chủ nhận) ----
eq(staffPayload({ employee_id: 2, code: 'B2', name: 'X', source: 'ho_tro', role: null, worked: 0, time_in: '', time_out: null, absent_reason: 'ốm', note: '', cash_paid: 0, pay_cash: 1 }),
  { employee_id: 2, source: 'ho_tro', role: null, worked: false, time_in: null, time_out: null, absent_reason: 'ốm', note: null, cash_paid: null }, 'người nghỉ: worked=false, ô rỗng thành null, không gửi tên');
eq(staffPayload({ employee_id: 1, worked: 1, time_in: '06:45', time_out: '13:15', cash_paid: 150000 }),
  { employee_id: 1, source: 'lich', role: null, worked: true, time_in: '06:45', time_out: '13:15', absent_reason: null, note: null, cash_paid: 150000 }, 'người làm: thiếu nguồn = theo lịch, giữ lương trả tiền mặt');

if (bad.length) { print(bad.join('\n')); throw new Error(`HỎNG ${bad.length}/${n}`); }
print(`ĐẠT ${n} kiểm tra`);
