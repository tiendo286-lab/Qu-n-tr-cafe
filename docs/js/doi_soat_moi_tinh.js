// Trang đối soát ca mới — hàm thuần (đợt 1: chỉ xem). Không gọi máy chủ, không đụng giao diện: giao diện và bài thử dùng chung.
// Thiết kế: tai_lieu/superpowers/specs/2026-11-24-trang-doi-soat-ca-moi-design.md (mục 5.2). Bài thử: kiem_tra/doi_soat_moi_tinh_dot1.mjs (jsc -m).
// Số tiền tính bằng đúng hàm của Sổ thu chi (dayChain → caMoney) nên khớp trang đối soát cũ; danh sách mục kiểm lấy từ dsChecks / dsCtx.
import { dayChain, dsChecks, dsCtx } from './so_thu_chi_tinh.js';

// Chữ của từng mục kiểm (chép chữ đầu của CHK trong pages/so_thu_chi.js)
export const CHK_LABEL = {
  mo: 'Tiền mở ca khớp tiền ca trước để lại',
  dt: 'Doanh thu trên phiếu khớp máy Fabi',
  no: 'Nợ bill trên phiếu khớp máy Fabi',
  phanloai: 'Nợ khác của ca đã phân loại (Chủ / Người nhà / Kho tổng)',
  hd: 'Đã hỏi về hoá đơn bị sửa / xoá trên máy',
  anh: 'Ảnh phiếu Fabi in cuối ca đúng với số máy',
  cash: 'Đã đếm két và nhập tiền mặt thực nhận',
  ck: 'Chuyển khoản đã có số ngân hàng',
  goi: 'Két để lại đúng 1.000.000 cho ca sau',
  ket: 'Tiền đóng ca này bằng tiền mở ca sau',
  fabi: 'Đã Xác nhận Fabi',
  tn: 'Thu nợ đúng khách, đúng tiền mặt / chuyển khoản',
  sot: 'Không sót khoản thu ngoài bán hàng',
  cat: 'Mọi khoản chi đã chọn nhóm',
  that: 'Khoản chi là thật, đúng số tiền',
  lon: 'Đã xem kỹ khoản từ 300.000 trở lên',
  tm: 'Tiền mặt lệch đã chọn cách xử lý',
  ck5: 'Chuyển khoản lệch đã chọn cách xử lý',
  ld: 'Đã hỏi người làm ca lý do thiếu / thừa',
};
export const WORK_LABEL = { nhan_su: 'Nhân sự', ban_giao: 'Bàn giao', nhap_hang: 'Nhập hàng' };
// 4 ô cơ bản quản lý xác nhận khi bấm Hoàn thành (thiết kế mục 9.2); mục "fabi" do Hoàn thành mới tự làm
export const BASIC = ['anh', 'sot', 'that', 'goi'];

const KIND = { thu: { khac: 'Thu khác', no: 'Khách trả nợ', lc: 'Luân chuyển vào' }, chi: { chi: 'Chi', no: 'Cho nợ', lc: 'Luân chuyển ra' } };
const COLS = { thu: ['khac', 'no', 'lc'], chi: ['chi', 'no', 'lc'] };
const who = (x) => ((x.src === 'move' && x.edit) || /quản lý/i.test(x.meta || '') ? 'QL ghi' : 'NV ghi');   // như nhãn bước 3 / 4 trang cũ
const line = (x) => ({ id: x.id, kind: x.meta === 'Lương trả tiền mặt' ? 'Lương' : KIND[x.book][x.col], title: x.title || '',
  amount: Number(x.amount || 0), cat: x.cat || null, who: who(x), col: x.col });
const sum = (xs) => xs.reduce((a, x) => a + x.amount, 0);

// Sổ tiền mặt / chuyển khoản của một ca: mở ca → bán → từng khoản thu → từng khoản chi → phải có → thực nhận → lệch.
// D = kết quả app_stc_month (đã gán bill_list như Sổ thu chi), ca = một phần tử của D.cas.
export function caBook(D, ca) {
  const link = dayChain(D, ca.date).get(ca.id) || null;
  const mine = (D.items || []).filter((x) => !x.void && x.ca_id === ca.id);
  const kt = !!ca.kt_wait || ca.bank_ck == null;
  const one = (pm) => {
    const xs = mine.filter((x) => x.pm === pm);
    const m = link ? link.money[pm] : null;
    const start = pm === 'tm' ? (m ? m.start : Number(ca.start_tm || 0)) : 0;
    const ban = xs.filter((x) => x.col === 'dt').reduce((a, x) => a + Number(x.amount || 0), 0);
    const thu = xs.filter((x) => x.book === 'thu' && COLS.thu.includes(x.col)).map(line);
    const chi = xs.filter((x) => x.book === 'chi' && COLS.chi.includes(x.col)).map(line);
    const tongThu = sum(thu), tongChi = sum(chi);
    const must = start + ban + tongThu - tongChi;
    const real = pm === 'ck' && kt ? null : m ? m.real : null;
    return { pm, start, ban, thu, tongThu, chi, tongChi, must, real, gap: real == null ? null : real - must };
  };
  return { tm: one('tm'), ck: one('ck') };
}

const workLeft = (R, dsRow) => {
  const t = dsRow && dsRow.viec && Array.isArray(dsRow.viec.thieu) ? dsRow.viec.thieu : null;
  if (t) return t.slice();
  const ch = (R && R.checks) || {};
  return Object.keys(WORK_LABEL).filter((k) => !ch[k]).map((k) => WORK_LABEL[k]);
};
// Mục tiền chưa xong, bỏ "fabi" (Hoàn thành mới tự xác nhận) và 4 ô cơ bản (xác nhận khi bấm Hoàn thành)
const moneyLeft = (D, ca) => dsChecks(ca, dsCtx(D, ca)).flat().filter((x) => !x.ok && x.k !== 'fabi' && !BASIC.includes(x.k));

// Trạng thái 3 trang: ① Phần việc, ② Tiền (wait = chờ kế toán), đã Hoàn thành chưa.
export function pageState(D, ca, R, dsRow) {
  const left = workLeft(R, dsRow);
  const ml = moneyLeft(D, ca);
  return { viec: { ok: left.length === 0, left }, tien: { ok: ml.length === 0, left: ml.length, wait: !!ca.kt_wait || ca.bank_ck == null }, done: !!ca.done };
}

// Danh sách "Còn thiếu" ở trang Hoàn thành: việc phần việc trước, rồi mục tiền.
export function missingList(D, ca, R, dsRow) {
  return [...workLeft(R, dsRow).map((t) => ({ page: 'viec', k: 'viec', text: t })),
    ...moneyLeft(D, ca).map((x) => ({ page: 'tien', k: x.k, text: CHK_LABEL[x.k] || x.k }))];
}

// Điều quản lý xác nhận khi bấm Hoàn thành: 4 ô cơ bản ca có và chưa tích, theo thứ tự anh, sot, that, goi.
export function confirmList(D, ca) {
  const all = dsChecks(ca, dsCtx(D, ca)).flat();
  return BASIC.filter((k) => all.some((x) => x.k === k && !x.ok)).map((k) => CHK_LABEL[k]);
}

// Ca khớp hết: phần việc xong, mục tiền (trừ 4 ô cơ bản và Xác nhận Fabi) đều xanh, không chờ kế toán → mở thẳng trang Hoàn thành.
export function isClean(D, ca, R, dsRow) {
  const s = pageState(D, ca, R, dsRow);
  return s.viec.ok && s.tien.ok && !s.tien.wait;
}
