// Bài thử bước 173 đợt C: ô bước 1 theo số Chủ đã duyệt (máy Fabi ghi sai), điều kiện Xác nhận Fabi + trạng thái ca khi số sửa chờ duyệt / bị từ chối.
// Chạy: jsc -m kiem_tra/so_thu_chi_tinh_dot14.mjs. Máy chủ: supabase/153_sua_so_fabi.sql (app__stc_ds_state, app_stc_ds_close).
import { caChecks, fabiNeeds, caStage } from '../docs/js/so_thu_chi_tinh.js';
let n = 0;
const ok = (c, m) => { if (!c) throw new Error('KIỂM TRA THẤT BẠI: ' + m); n++; };
const get = (cs, k) => cs.find((x) => x.k === k);
const ca = (o = {}) => ({ id: 1, date: '2026-11-16', shift: 'Tối', cash_mode: 'ngay', bank_ck: 0, recon_money_done: false, ticks: [],
  fabi: { has: true, opening: 1000000, revenue: 500000, debt: 0 }, nv: { opening: 1000000, revenue: 520000, debt: 0 }, ...o });
const link = (exp) => ({ expOpen: exp, money: { tm: { gap: 0, real: 0 }, ck: { gap: 0, real: 0 } } });

// ô Doanh thu: nhân viên 520.000, máy 500.000
let cs = caChecks(ca(), link(1000000));
ok(get(cs, 'dt').st === 'red', 'chưa có số sửa: ô doanh thu đỏ');
cs = caChecks(ca({ fixes: { dt: { id: 7, status: 'cho', new: { tm: 320000, ck: 200000 } } } }), link(1000000));
ok(get(cs, 'dt').st === 'red' && get(cs, 'dt').fx?.status === 'cho', 'số sửa đang chờ: ô vẫn đỏ, mang theo yêu cầu (fx)');
cs = caChecks(ca({ fixes: { dt: { id: 7, status: 'duyet', new: { tm: 320000, ck: 200000, total: 520000 } } } }), link(1000000));
ok(get(cs, 'dt').st === 'ok' && /Chủ đã duyệt/.test(get(cs, 'dt').txt), 'Chủ đã duyệt đúng số phiếu: ô xanh "Chủ đã duyệt"');
cs = caChecks(ca({ fixes: { dt: { id: 7, status: 'duyet', new: { tm: 300000, ck: 200000, total: 500000 } } }, nv: { opening: 1000000, revenue: 480000, debt: 0 } }), link(1000000));
ok(get(cs, 'dt').st === 'red', 'số phiếu khác số đã duyệt: vẫn đỏ');
// ô Tiền mở ca: máy 1.000.000, thật 950.000 (nhân viên ghi đúng), Chủ duyệt 950.000
const mo = { fabi: { has: true, opening: 1000000, revenue: 500000, debt: 0 }, nv: { opening: 950000, revenue: 500000, debt: 0 }, fixes: { mo: { id: 8, status: 'duyet', new: { val: 950000 } } } };
cs = caChecks(ca(mo), link(950000));
ok(get(cs, 'mo').st === 'ok', 'tiền mở ca theo số đã duyệt, khớp số phải là → xanh');
cs = caChecks(ca(mo), link(1000000));
ok(get(cs, 'mo').st === 'red' && get(cs, 'mo').fix === 'blame', 'số đã duyệt khác số ca trước để lại → đỏ, chọn ca chịu (không còn "lấy số máy")');
// ô Nợ bill: máy 0, thật 30.000
cs = caChecks(ca({ nv: { opening: 1000000, revenue: 500000, debt: 30000 }, fixes: { no: { id: 9, status: 'duyet', new: { val: 30000 } } } }), link(1000000));
ok(get(cs, 'no').st === 'ok', 'nợ bill theo số đã duyệt → xanh');
// Xác nhận Fabi: còn chờ / bị từ chối
ok(fabiNeeds(ca({ fixes: { dt: { status: 'cho' } } }), caChecks(ca(), link(1000000))).some((x) => x.k === 'fix' && /chờ Chủ duyệt/.test(x.txt)), 'Xác nhận Fabi: thiếu "số sửa chờ Chủ duyệt"');
ok(fabiNeeds(ca({ fixes: { no: { status: 'tu_choi' } } }), []).some((x) => x.k === 'fix' && /từ chối/.test(x.txt)), 'Xác nhận Fabi: thiếu "Chủ từ chối số sửa"');
ok(!fabiNeeds(ca({ fixes: { no: { status: 'duyet' } } }), []).some((x) => x.k === 'fix'), 'đã duyệt thì không còn thiếu');
// trạng thái ca
ok(caStage(ca({ fixes: { dt: { status: 'cho' } } }), caChecks(ca(), link(1000000)), false).k === 'fix', 'ca có số sửa chờ duyệt → trạng thái "fix"');
ok(/Chờ Chủ duyệt số sửa/.test(caStage(ca({ fixes: { dt: { status: 'cho' } } }), caChecks(ca(), link(1000000)), false).txt), 'chữ "🟠 Chờ Chủ duyệt số sửa"');
ok(/từ chối/.test(caStage(ca({ fixes: { dt: { status: 'tu_choi' } } }), caChecks(ca(), link(1000000)), false).txt), 'bị từ chối → "Chủ từ chối số sửa"');
print('ĐẠT ' + n + ' kiểm tra');
