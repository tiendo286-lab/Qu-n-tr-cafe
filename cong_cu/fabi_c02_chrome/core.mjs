// 0.3.0 (23/11/2026): Fabi chuyển trang báo cáo sang đường dẫn /micro/. Vẫn nhận đường dẫn cũ nếu Fabi chuyển ngược lại.
export const FABI = 'https://fabi.ipos.vn/micro/report/revenue/revenue/shift';
export const MILANO = 'https://tiendo286-lab.github.io/Qu-n-tr-cafe/';
export const STORES = ['Milano Coffee - Lê Hồng Phong', 'Milano Coffee - Đông Khê', 'Milano Coffee - Hồ Sen', 'Lela Cafe'];
const DETAIL_PATHS = ['/micro/report/revenue/revenue/shift-detail', '/report/revenue/revenue/shift-detail'];
// Lấy bù tối đa 31 ngày trước hôm nay (giờ Việt Nam); không lấy hôm nay vì ngày chưa xong.
export const MAX_BACK_DAYS = 31;
export function vnClock(now = Date.now()) {
  const d = new Date(now + 7 * 3600000);
  return { day: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
export function previousDay(now = Date.now()) {
  return new Date(now + 7 * 3600000 - 86400000).toISOString().slice(0, 10);
}
// n ngày gần nhất trước hôm nay, mới nhất trước: [hôm qua, hôm kia, …].
export function recentDays(n, now = Date.now()) {
  return Array.from({ length: n }, (_, i) => new Date(now + 7 * 3600000 - (i + 1) * 86400000).toISOString().slice(0, 10));
}
export function validDay(day, now = Date.now()) {
  return typeof day === 'string' && recentDays(MAX_BACK_DAYS, now).includes(day);
}
export function vnDate(day) {
  return String(day).split('-').reverse().join('/');
}
export function isoFromVN(text) {
  const m = String(text).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
export function isDetailUrl(url) {
  try {
    const u = new URL(url);
    return u.origin === 'https://fabi.ipos.vn' && DETAIL_PATHS.includes(u.pathname);
  } catch (_) { return false; }
}
export function detailIdentity(url) {
  if (!isDetailUrl(url)) throw Error('Đường dẫn chi tiết ca không hợp lệ.');
  const u = new URL(url);
  const id = u.searchParams.get('shift_id');
  const store = u.searchParams.get('store');
  if (!id || !store || !/^[\w-]+$/.test(id)) throw Error('Chi tiết ca thiếu mã ca hoặc cơ sở.');
  return { id, store };
}
export function queueRows(pages, day) {
  const found = new Map();
  for (const page of pages) for (const r of page.rows) {
    if (isoFromVN(r.open) !== day) throw Error('Danh sách Fabi chưa đúng ngày cần lấy.');
    if (!r.close || !/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(r.close)) throw Error(`Ca ${r.short} chưa đóng hoặc thiếu giờ đóng.`);
    if (!/^#[A-Z0-9]{5}$/i.test(r.short)) throw Error('Không đọc được mã ca trên danh sách.');
    const key = `${r.short}|${r.open}|${r.device}`;
    if (found.has(key)) throw Error('Phân trang trả về ca trùng; dừng để kiểm tra.');
    found.set(key, { ...r, page: page.page });
  }
  // Fabi mới ghi "Hiển thị a - b trên tổng số N": số ca đọc được phải đúng bằng N, không bỏ sót trang nào.
  const totals = new Set(pages.map((p) => p.total).filter(Number.isInteger));
  if (totals.size > 1) throw Error('Tổng số ca trên Fabi thay đổi giữa các trang; chạy lại sau ít phút.');
  const [total] = totals;
  if (total != null && total !== found.size) throw Error(`Fabi báo ${total} ca nhưng tiện ích chỉ đọc được ${found.size} ca; dừng để kiểm tra, chưa nhập gì.`);
  if (!found.size) throw Error('Không có ca đã đóng; chưa thể xác nhận ngày đã đủ dữ liệu.');
  return [...found.values()];
}
