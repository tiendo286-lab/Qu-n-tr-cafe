// Bài thử hàm tính lệch giao ca "Hai ca cùng chịu" (bước 173 đợt C phần 2, tệp 154). Chạy: jsc -m kiem_tra/so_thu_chi_tinh_dot15.mjs
import { caChecks, gapParts, blameShare, blameText } from '../docs/js/so_thu_chi_tinh.js';

let n = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('KIỂM TRA THẤT BẠI: ' + msg); n++; };
const ca = (o = {}) => ({ id: 7, shift: 'Chiều', nv: { opening: 970000, revenue: 500000, debt: 0 }, fabi: { has: true, opening: 970000, revenue: 500000, debt: 0 }, bank_ck: 0, kt_wait: false, ...o });
const link = (exp) => ({ expOpen: exp, money: { tm: { start: 970000, real: 0, must: 0, gap: 0 }, ck: { real: 0, must: 0, gap: 0 } } });
const mo = (c, l) => caChecks(c, l)[0];

// phần mỗi ca chịu
ok(JSON.stringify(blameShare({ who: 'doi', diff: -30000, prev_amt: -15000 })) === '{"prev":-15000,"nay":-15000}', 'chia đôi 30.000 → mỗi ca 15.000');
const s1 = blameShare({ who: 'doi', diff: -25001, prev_amt: -12500 });
ok(s1.prev === -12500 && s1.nay === -12501, 'số lẻ: ca này chịu phần lẻ (12.501)');
ok(blameShare({ who: 'truoc', diff: -30000 }).prev === -30000 && blameShare({ who: 'truoc', diff: -30000 }).nay === 0, 'dòng cũ không có prev_amt: ca trước chịu cả');
ok(blameShare({ who: 'nay', diff: 20000, prev_amt: 0 }).nay === 20000, 'ca này ghi sai: ca này chịu cả');
ok(blameShare(null).prev === 0, 'chưa chọn → 0');
ok(blameText({ who: 'doi', diff: -30000, prev_amt: -15000 }).includes('Hai ca cùng chịu'), 'chữ: hai ca cùng chịu');

// ô Tiền mở ca: thiếu → có cờ short (hiện nút Hai ca cùng chịu); thừa → không
const t1 = mo(ca(), link(1000000));
ok(t1.st === 'red' && t1.fix === 'blame' && t1.short === true, 'thiếu khi giao ca → được chia đôi');
const t2 = mo(ca({ nv: { opening: 1020000, revenue: 500000, debt: 0 }, fabi: { has: true, opening: 1020000, revenue: 500000, debt: 0 } }), link(1000000));
ok(t2.st === 'red' && t2.fix === 'blame' && t2.short === false, 'thừa khi giao ca → không chia đôi');
const t3 = mo(ca({ blame: { who: 'doi', diff: -30000, prev_amt: -15000 } }), link(1000000));
ok(t3.st === 'ok' && t3.txt.includes('Hai ca cùng chịu') && t3.txt.includes('15.000'), 'đã chọn hai ca cùng chịu → xanh, ghi rõ phần (' + t3.txt + ')');

// tách nguồn lệch tiền mặt: mỗi ca thấy đúng phần của mình
const pNay = gapParts(ca({ blame: { who: 'doi', diff: -25001, prev_amt: -12500, prev_report: 5 } }), [], 'tm', -12501);
ok(pNay.length === 1 && pNay[0].amount === -12501 && pNay[0].label.includes('hai ca'), 'ca này: phần −12.501');
const pTruoc = gapParts(ca({ id: 5, shift: 'Sáng', blame: null }), [{ id: 7, shift: 'Chiều', blame: { who: 'doi', diff: -25001, prev_amt: -12500, prev_report: 5 } }], 'tm', -12500);
ok(pTruoc.length === 1 && pTruoc[0].amount === -12500, 'ca trước: phần −12.500');
const pCu = gapParts(ca({ id: 5, shift: 'Sáng', blame: null }), [{ id: 7, shift: 'Chiều', blame: { who: 'nay', diff: -30000, prev_report: 5 } }], 'tm', 0);
ok(pCu.length === 0, 'ca sau tự chịu → ca trước không có phần');

print('ĐẠT ' + n + ' kiểm tra');
