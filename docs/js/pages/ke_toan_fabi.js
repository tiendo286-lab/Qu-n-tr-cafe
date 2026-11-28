// Kế toán · File ca Fabi (bước 42): tải file "BÁO CÁO CA CHI TIẾT" của từng ca từ Fabi (chọn nhiều file một lần).
// Web đọc file ngay trên trình duyệt, gửi số lên máy chủ; máy chủ tự so với phiếu chốt ca, sửa theo Fabi và báo quản lý.
// Kế toán không phải xem hay xử lý lệch.
export const perm = ['ke_toan', 'doi_soat'];   // bước 136: quản lý xem được (chỉ kế toán tải file)

// Bước 49: gợi ý nhóm theo tên món (kế toán xem lại rồi bấm Lưu)
const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
const RULES = [
  [/(thuoc|craven|vinataba|marlboro|555|dieu|huong duong|hat dua|hat |banh|kho ga|kho bo|xuc xich|nem|snack|mi tom|thang long)/, /ĐỒ ĂN/],
  [/(mon them|them |topping|tran chau|thach|kem cheese|kem muoi|shot)/, /TOPPING/],
  [/(da xay|sinh to|tuyet|frappe|smoothie)/, /ĐÁ XAY/],
  [/(^ep |nuoc ep| ep |^ep$)/, /NƯỚC ÉP/],
  [/(cacao|bot san|sua chua)/, /ĐỒ UỐNG KHÁC/],
  [/(ca phe|cafe|coffee|bac xiu|nau |den da|espresso|latte|cappuccino|capuchino|americano)/, /CÀ PHÊ/],
  [/(^tra |^tra$| tra )/, /^TRÀ$/],
];
export function guessGroup(name, groups) {
  const n = norm(name) + ' ';
  for (const [re, g] of RULES) if (re.test(n)) { const hit = groups.find((x) => g.test(x)); if (hit) return hit; }
  return '';
}

// Đọc 1 file chi tiết ca (sheet "Báo cáo ca")
export function parseDetail(X, wb) {
  const a = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
  if (!String(a[0]?.[0] || '').startsWith('BÁO CÁO CA CHI TIẾT')) return null;
  const ma = (String(a[1]?.[0] || '').match(/Mã ca:\s*(\S+)/) || [])[1];
  const cell = (re) => { for (const v of a[1] || []) { const m = String(v ?? '').match(re); if (m) return m[1].trim(); } return null; };
  const val = (lab) => { const r = a.find((x) => x && String(x[0] ?? '').trim() === lab); return r ? Number(r[1]) : null; };
  const section = (title) => {
    const i = a.findIndex((x) => x && String(x[0] ?? '').trim() === title); if (i < 0) return [];
    const rows = []; for (let j = i + 2; j < a.length && a[j] && a[j][0] != null && String(a[j][0]).trim() !== ''; j++) rows.push(a[j]); return rows;
  };
  const bills = section('THÔNG TIN TỜ TIỀN').map((r) => ({ menh_gia: Number(r[0]), sl: Number(r[1]), tong: Number(r[2]) }));
  return {
    ma_ca: ma, store: String(a[0][0]).replace(/^.*—\s*/, '').trim(), open: cell(/Mở:\s*(.+)/), close: cell(/Đóng:\s*(.+)/),
    dau: val('Số dư đầu ca'), cuoi: val('Số dư cuối ca'), net: val('Doanh thu (net)'), hd: val('Tổng số hoá đơn'),
    pay: section('PHƯƠNG THỨC THANH TOÁN').filter((r) => String(r[0]).trim() !== 'TỔNG').map((r) => ({ name: String(r[0]).trim(), amount: Number(r[1]) })),
    tra_no: section('PHIẾU THANH TOÁN NỢ').map((r) => ({ method: String(r[0]).trim(), amount: Number(r[1]) })),
    sua: section('HOÁ ĐƠN SỬA/XOÁ').map((r) => ({ id: String(r[0]), amount: Number(r[1]) })),
    bills, tong: bills.length ? bills.reduce((s, b) => s + (b.tong || 0), 0) : null,
    // bước 49: số lượng từng món + doanh thu từng nhóm → web tính số cốc
    items: section('MÓN').map((r) => ({ name: String(r[0]).trim(), qty: Number(r[1]) || 0, amount: Number(r[2]) || 0 })),
    groups: section('NHÓM MÓN').map((r) => ({ name: String(r[0]).trim(), amount: Number(r[1]) || 0 })),
  };
}

// Bảng tuần: giao diện kiểm soát một cơ sở, giữ parser dùng chung cho tiện ích C02.
export { render } from './fabi_board.js?v=2026.11.28.9';
