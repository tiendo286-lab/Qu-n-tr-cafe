// So số trang đối soát ca mới với cách tính của trang cũ trên DỮ LIỆU THẬT (đợt 1). Dữ liệu không vào git.
// Chuẩn bị: lưu mảng kết quả app_stc_month(<cơ sở>, '<tháng>') của mọi cơ sở vào kiem_tra/_tam/stc_month_that.json
// (gọi trong giao dịch chỉ đọc, vai Chủ). Chạy: jsc -m kiem_tra/doi_soat_moi_so_that.mjs
// Kiểm từng ca: phải có / phải nhận của caBook = caMoney (qua dayChain, như trang cũ); thực nhận tiền mặt = real_tm máy chủ;
// chuyển khoản: chờ kế toán thì để trống, không thì = bank_ck máy chủ.
import { caBook } from '../docs/js/doi_soat_moi_tinh.js';
import { billListOf, dayChain } from '../docs/js/so_thu_chi_tinh.js';
const all = JSON.parse(read('kiem_tra/_tam/stc_month_that.json'));
const bad = []; let n = 0;
for (const D of all) {
  if (Array.isArray(D.ca_debts)) (D.cas || []).forEach((c) => { c.bill_list = billListOf(D, c.id); });   // như load() của Sổ thu chi
  for (const ca of D.cas || []) {
    n++;
    const b = caBook(D, ca); const m = dayChain(D, ca.date).get(ca.id).money;
    const name = `${D.branch?.code} ${ca.date} ${ca.shift} (#${ca.id})`;
    if (b.tm.must !== m.tm.must) bad.push(`${name}: tiền mặt phải có ${b.tm.must} ≠ ${m.tm.must}`);
    if (b.ck.must !== m.ck.must) bad.push(`${name}: chuyển khoản phải nhận ${b.ck.must} ≠ ${m.ck.must}`);
    if (b.tm.real !== Number(ca.real_tm)) bad.push(`${name}: tiền mặt thực nhận ${b.tm.real} ≠ máy chủ ${ca.real_tm}`);
    const kt = !!ca.kt_wait || ca.bank_ck == null;
    if (kt ? b.ck.real !== null : b.ck.real !== Number(ca.bank_ck)) bad.push(`${name}: chuyển khoản thực nhận ${b.ck.real} ≠ máy chủ ${kt ? '(chờ kế toán)' : ca.bank_ck}`);
  }
}
if (bad.length) { print(bad.slice(0, 40).join('\n')); throw new Error(`HỎNG ${bad.length} chỗ lệch / ${n} ca`); }
print(`ĐẠT ${n} ca`);
