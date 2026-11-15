export const FABI = 'https://fabi.ipos.vn/report/revenue/revenue/shift';
export const MILANO = 'https://tiendo286-lab.github.io/Qu-n-tr-cafe/';
export const STORES = ['Milano Coffee - Lê Hồng Phong', 'Milano Coffee - Đông Khê', 'Milano Coffee - Hồ Sen', 'Lela Cafe'];
export function vnClock(now = Date.now()) {
  const d = new Date(now + 7 * 3600000);
  return { day: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
export function previousDay(now = Date.now()) {
  return new Date(now + 7 * 3600000 - 86400000).toISOString().slice(0, 10);
}
export function isoFromVN(text) {
  const m = String(text).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
export function detailIdentity(url) {
  const u = new URL(url);
  if (u.origin !== 'https://fabi.ipos.vn' || u.pathname !== '/report/revenue/revenue/shift-detail') throw Error('Đường dẫn chi tiết ca không hợp lệ.');
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
  if (!found.size) throw Error('Không có ca đã đóng; chưa thể xác nhận ngày đã đủ dữ liệu.');
  return [...found.values()];
}
