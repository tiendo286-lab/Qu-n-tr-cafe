// Bước 136: so sánh số nhân viên nhập trên phiếu với file chốt ca Fabi — dùng ở tab File ca Fabi.
// Module thuần (không chạm trang) để chạy thử được ngoài trình duyệt: kiem_tra/fabi_so_sanh_136.mjs
import { fmt } from './tien.js';

// [cột phiếu nhân viên, cột file Fabi, nhãn] — cùng 7 mục máy chủ so (app__fabi_apply)
export const FIELDS = [
  ['ipos_opening', 'dau', 'Số dư đầu'], ['total_revenue', 'net', 'Doanh thu NET'], ['pos_transfer', 'ck', 'Chuyển khoản'],
  ['pos_cash', 'tm', 'Tiền mặt'], ['pos_debt', 'no', 'Nợ'], ['cash_counted', 'tong', 'Tổng tiền'], ['pos_diff', 'chenh', 'Tiền chênh lệch'],
];
const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

export function compareRows(f) {
  return FIELDS.map(([k, fk, label]) => {
    const nv = num(f.nv?.[k]), fabi = num(f[fk]);
    return { label, nv, fabi, gap: nv !== null && fabi !== null ? nv - fabi : null, same: fabi === null || nv === fabi };
  });
}

const diffLine = (x) => {
  const nv = num(x.nv), fabi = num(x.fabi);
  if (nv === null) return `${x.label} nhân viên chưa ghi (Fabi ${fmt(fabi)}đ)`;
  return `${x.label} nhân viên ghi ${nv < fabi ? 'thiếu' : 'thừa'} ${fmt(Math.abs(nv - fabi))}đ so với Fabi`;
};
const fixedLine = (x) => `Web đã sửa số đối soát theo Fabi: ${x.label} ${fmt(x.before) || '—'} → ${fmt(x.fabi)}`;
const labels = (a) => [...new Set(a.map((x) => x.label))].join(', ');

// Ca cần quản lý xem? null = không. kind: chua_phieu | lech (nhân viên gõ khác Fabi) | da_sua (chỉ có số đối soát web đã sửa)
export function reviewOf(f) {
  if (!f.report_id) return { kind: 'chua_phieu', short: 'Có file Fabi, chưa có phiếu nhân viên',
    lines: ['Fabi có ca này nhưng trên web chưa có phiếu chốt ca của nhân viên.'] };
  if (f.report_status !== 'hoan_thanh') return null;
  if (f.xn) return null;   // chặng 4 (anh Tiến chốt 22/11): quản lý đã Xác nhận Fabi ca này (số đã đối chiếu khớp / Chủ duyệt) → hết báo
  const diff = f.diff || [], fixed = f.fixed || [];
  if (diff.length) return { kind: 'lech', short: 'Gõ khác Fabi: ' + labels(diff), lines: [...diff.map(diffLine), ...fixed.map(fixedLine)] };
  if (fixed.length) return { kind: 'da_sua', short: 'Web đã sửa theo Fabi: ' + labels(fixed), lines: fixed.map(fixedLine) };
  return null;
}

// Ca đã Xác nhận Fabi mà lúc tải tệp từng khác Fabi → một dòng ghi nhỏ (không còn đếm vào "Cần quản lý xem"); null = không có gì để ghi
export function confirmedNote(f) {
  if (!f?.xn || f.report_status !== 'hoan_thanh') return null;
  const diff = f.diff || [], fixed = f.fixed || [];
  if (diff.length) return `Gõ khác Fabi: ${labels(diff)} · quản lý đã xác nhận Fabi`;
  if (fixed.length) return `Web đã sửa theo Fabi: ${labels(fixed)} · quản lý đã xác nhận Fabi`;
  return null;
}
