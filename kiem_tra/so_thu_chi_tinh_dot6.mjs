// Bài thử hàm tính Đối soát Fabi + Chốt ca + Khoản treo (bước 151). Chạy: jsc -m kiem_tra/so_thu_chi_tinh_dot6.mjs
import { caStage, finalNeeds, treoView, gapParts } from '../docs/js/so_thu_chi_tinh.js';

let n = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('KIỂM TRA THẤT BẠI: ' + msg); n++; };
const ok3 = [{ k: 'mo', st: 'ok' }, { k: 'dt', st: 'ok' }, { k: 'no', st: 'ok' }];
const ca = (o = {}) => ({ id: 7, shift: 'Tối', recon_money_done: true, fabi: { has: true }, ...o });
const gap = (pm, kind, remain, extra = {}) => ({ id: `g:7:${pm}`, ca_id: 7, book: kind === 'thieu' ? 'chi' : 'thu', pm, col: 'lech', amount: remain, gap: { kind, remain, ...extra } });

// trạng thái
ok(caStage(ca(), ok3, { by: 'x' }).k === 'fin', 'đã chốt → fin');
ok(caStage(ca(), ok3, { by: 'x' }, true).txt.includes('khoản treo'), 'đã chốt có khoản treo');
ok(caStage(ca(), ok3, null).k === 'fab', 'đã xác nhận Fabi → fab');
ok(caStage(ca({ recon_money_done: false }), ok3, null).k === 'cho', 'chưa xác nhận, khớp → chờ xác nhận');
ok(caStage(ca({ recon_money_done: false }), [{ k: 'mo', st: 'red', name: 'Tiền mở ca' }, ...ok3.slice(1)], null).k === 'lech', 'ô đỏ → lech');
ok(caStage(ca({ recon_money_done: false, fabi: { has: false } }), ok3, null).k === 'kt', 'chưa có file Fabi → chờ kế toán');

// điều kiện chốt
ok(finalNeeds(ca({ recon_money_done: false }), []).need[0] === 'Chưa xác nhận Fabi (phần A)', 'chưa xác nhận Fabi');
ok(finalNeeds(ca(), [{ ca_id: 7, book: 'chi', col: 'chi', cat: null, amount: 40000 }]).need.includes('Còn 1 khoản chi chưa phân loại'), 'chi chưa nhóm');
ok(finalNeeds(ca(), [{ ca_id: 7, book: 'chi', col: 'chi', cat: null, amount: 40000, void: true }]).need.length === 0, 'khoản đã xoá không tính');
ok(finalNeeds(ca(), [gap('tm', 'thieu', 10000, { qc_wait: [{ id: 1 }] })]).need.includes('Còn khoản chờ Chủ duyệt (quán chịu / ghép)'), 'quán chịu chờ duyệt');
ok(finalNeeds(ca(), [gap('tm', 'thieu', 0, { matches: [{ status: 'cho_duyet' }] })]).need.includes('Còn khoản chờ Chủ duyệt (quán chịu / ghép)'), 'ghép chờ duyệt');
const tmT = finalNeeds(ca(), [gap('tm', 'thieu', 20000)]);
ok(tmT.need.some((x) => x.startsWith('Tiền mặt thiếu 20.000')) && !tmT.treo.length, 'TM thiếu 20.000 chặn chốt, không thành khoản treo');
ok(finalNeeds(ca(), [gap('tm', 'thieu', 5000)]).need.length === 0, 'lệch ≤ 5.000 coi như khớp');
const ck = finalNeeds(ca(), [gap('ck', 'thieu', 98000)]);
ok(!ck.need.length && ck.treo.length === 1 && ck.treo[0].kind === 'tien' && ck.treo[0].amount === 98000, 'CK thiếu 98.000 → khoản treo chờ tiền về');
const du = finalNeeds(ca(), [gap('tm', 'du', 46000), gap('ck', 'du', 200000)]);
ok(du.treo.length === 2 && du.treo.every((t) => t.kind === 'thua'), 'dư TM + CK → 2 khoản treo tiền thừa');
ok(finalNeeds(ca({ id: 8 }), [gap('ck', 'thieu', 98000)]).treo.length === 0, 'khoản của ca khác không tính');

// nhãn khoản treo
ok(treoView({ kind: 'tien', status: 'mo', days_left: 2 }).label === 'Chờ tiền về · còn 2 ngày', 'còn 2 ngày');
ok(treoView({ kind: 'tien', status: 'mo', days_left: 0 }).label === 'Chờ tiền về · hạn hôm nay', 'hạn hôm nay');
const ov = treoView({ kind: 'tien', status: 'mo', days_left: -2, over: true });
ok(ov.over && ov.label === 'Chờ tiền về · quá hạn 2 ngày' && ov.cls === 'off', 'quá hạn 2 ngày');
ok(treoView({ kind: 'thua', status: 'mo', thu_khac: false }).label.includes('tới hết tháng'), 'tiền thừa tới hết tháng');
ok(treoView({ kind: 'thua', status: 'mo', thu_khac: true }).label.includes('Thu khác'), 'hết tháng → Thu khác');
ok(treoView({ kind: 'tien', status: 'xong', done_note: 'quán chịu' }).label === 'Đã xử lý · quán chịu', 'đã xử lý');

// tách nguồn lệch tiền mặt
const p1 = gapParts(ca({ blame: { who: 'nay', diff: 50000 } }), [], 'tm', 30000);
ok(p1.length === 2 && p1[0].amount === 50000 && p1[1].amount === -20000, 'ca này ghi sai +50.000, còn lại −20.000');
const p2 = gapParts(ca({ id: 5, shift: 'Chiều' }), [{ id: 7, shift: 'Tối', blame: { who: 'truoc', diff: -30000, prev_report: 5 } }], 'tm', -30000);
ok(p2.length === 1 && p2[0].amount === -30000, 'ca sau báo ca này ghi sai −30.000');
ok(gapParts(ca(), [], 'tm', -10000).length === 0 && gapParts(ca({ blame: { who: 'nay', diff: 50000 } }), [], 'ck', 1).length === 0, 'không có nguồn mở ca / chuyển khoản → không tách');

print('ĐẠT ' + n + ' kiểm tra');
