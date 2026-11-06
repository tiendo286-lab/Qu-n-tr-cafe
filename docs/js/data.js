// Đọc dữ liệu dùng chung: tuần, danh mục, giờ order, định biên của tuần, trạng thái lịch.
import { rpc, sel, selAll } from './sb.js';

export const OK = 'ĐI LÀM ĐƯỢC', OFF = 'NGHỈ', NONE = 'CHƯA ORDER', ASSIGNED = 'ĐÃ XẾP';
export const CODE = { [OK]: 'ok', [OFF]: 'off', [NONE]: 'none' };
export const FROM_CODE = { ok: OK, off: OFF, none: NONE };
export const LABEL = { [OK]: 'Đi làm được', [OFF]: 'Nghỉ', [NONE]: 'Chưa order' };
export const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
export const WD_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const DOW_LABELS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
export const RANKS = ['Thử việc', 'Cấp 1', 'Cấp 2', 'Quản lý'];
export const SENIOR = new Set(['Cấp 2', 'Quản lý']);
export const ST_XEP = 'ĐANG XẾP', ST_CHOT = 'ĐÃ CHỐT', ST_SUA = 'ĐANG CHỈNH SỬA';
export const SHIFT_COLORS = ['#f59e0b', '#0ea5e9', '#7c3aed', '#10b981', '#ec4899'];

// ---------------- Ngày tháng (giờ Việt Nam)
export function vnToday() {
  const d = new Date(Date.now() + 7 * 3600e3);
  return d.toISOString().slice(0, 10);
}
export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekStart(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}
export const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const dmy = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
export const weekLabel = (start) => `${dm(start)} – ${dmy(addDays(start, 6))}`;
export function weekDays(start) {
  return WEEKDAYS.map((name, i) => ({ index: i, name, short: WD_SHORT[i], date: dm(addDays(start, i)), iso: addDays(start, i) }));
}
export function parseWeekParam(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? weekStart(v) : null;
}
// "2026-10-01 20:40:11" → "Hôm nay 20:40" / "01/10 20:40"
export function when(ts) {
  if (!ts) return '';
  const day = ts.slice(0, 10);
  const today = vnToday();
  if (day === today) return `Hôm nay ${ts.slice(11, 16)}`;
  if (day === addDays(today, -1)) return `Hôm qua ${ts.slice(11, 16)}`;
  return `${dm(day)} ${ts.slice(11, 16)}`;
}

// ---------------- Danh mục
export async function catalog() {
  const [branches, shifts, roles, bs] = await Promise.all([
    sel('branches', '*', (b) => b.order('sort_order').order('id')),
    sel('shifts', '*', (b) => b.order('sort_order').order('id')),
    sel('work_roles', '*', (b) => b.order('sort_order').order('id')),
    sel('branch_shifts', '*'),
  ]);
  const bsMap = new Map(bs.map((r) => [`${r.branch_id}|${r.shift_id}`, r]));
  const activeShifts = shifts.filter((s) => s.status === 'Đang sử dụng');
  return {
    branches, shifts, roles, bsMap,
    activeBranches: branches.filter((b) => b.status === 'Đang hoạt động'),
    activeShifts,
    activeRoles: roles.filter((r) => r.status === 'Đang sử dụng'),
    // ca đang bật ở chi nhánh (kèm giờ)
    branchShifts(branchId) {
      return activeShifts.filter((s) => bsMap.get(`${branchId}|${s.id}`)?.enabled === 1)
        .map((s) => ({ ...s, start: bsMap.get(`${branchId}|${s.id}`).start_time, end: bsMap.get(`${branchId}|${s.id}`).end_time }));
    },
    shiftEnabled(branchId, shiftName) {
      const s = activeShifts.find((x) => x.name === shiftName);
      return !!(s && bsMap.get(`${branchId}|${s.id}`)?.enabled === 1);
    },
  };
}

// ---------------- Tuần, giờ order, trạng thái lịch
export async function getWeek(start) {
  const r = await sel('weeks', '*', (b) => b.eq('start_date', start));
  return r[0] || null;
}
export async function orderWindow(weekId) { return rpc('app_order_window', { p_week: weekId }); }

export function remaining(closeIso, nowIso) {
  const secs = Math.floor((new Date(closeIso + ':00Z') - new Date(nowIso + 'Z')) / 1000);
  if (secs <= 0) return '';
  const days = Math.floor(secs / 86400), hours = Math.floor((secs % 86400) / 3600), minutes = Math.floor((secs % 3600) / 60);
  if (days) return `còn ${days} ngày ${hours} giờ`;
  if (hours) return `còn ${hours} giờ ${minutes} phút`;
  return `còn ${minutes} phút`;
}

export async function closure(weekId) {
  const r = await sel('schedule_closures', '*', (b) => b.eq('week_id', weekId));
  if (r[0]) return r[0];
  // Giống bản offline: tuần chưa có dòng trạng thái nhưng đã có ca được xếp = đang xếp
  // (tránh hiện nút "Bắt đầu xếp lịch" – nút đó làm lại lịch từ đầu, mất các ca đã xếp)
  const x = await sel('weekly_schedule_entries', 'id', (b) => b.eq('week_id', weekId).eq('state', ASSIGNED).limit(1));
  return x.length ? { week_id: weekId, status: 'ĐANG XẾP', closed_at: null, staffing_snapshot_json: null, updated_at: null } : null;
}
export async function hasPublished(weekId) {
  const r = await sel('schedule_published', 'week_id', (b) => b.eq('week_id', weekId).limit(1));
  return r.length > 0;
}
export function statusLabel(st, published) {
  if (!st) return 'Đang order';
  if (st === ST_SUA && !published) return 'Đang xếp';
  return { [ST_XEP]: 'Đang xếp', [ST_CHOT]: 'Đã chốt', [ST_SUA]: 'Đang chỉnh sửa' }[st] || st;
}

// Tuần tập trung: tuần tới nếu đã bắt đầu xếp, không thì tuần này (giống bản Python)
export async function focusWeek() {
  const cur = weekStart(vnToday());
  for (const start of [addDays(cur, 7), cur]) {
    const w = await getWeek(start);
    if (w && await closure(w.id)) return w;
  }
  return null;
}

// Định biên của tuần: {`${b}|${d}|${shift}|${role}`: n}. Tuần đã chốt dùng bản lưu lúc chốt.
export async function requirements(weekId, cl) {
  const c = cl === undefined ? await closure(weekId) : cl;
  if (c && c.staffing_snapshot_json) {
    try {
      const snap = JSON.parse(c.staffing_snapshot_json);
      if (snap && !Array.isArray(snap)) {
        const out = {};
        const entries = Object.entries(snap);
        if (entries.length && Array.isArray(entries[0][1])) {
          // Bản web: {"branch_id": [[weekday, shift, role, n], ...]}
          for (const [b, items] of entries) for (const [d, s, r, n] of items) out[`${b}|${d}|${s}|${r}`] = n;
          return out;
        }
        if (entries.length && typeof entries[0][1] === 'number') {
          // Bản offline: {"LHP|0|Sáng|Pha chế": n} – mã chi nhánh → id
          const brs = await sel('branches', 'id, code, display_code, system_code');
          const byCode = new Map();
          brs.forEach((b) => [b.code, b.display_code, b.system_code].forEach((x) => x && byCode.set(String(x).toLowerCase(), b.id)));
          for (const [k, n] of entries) {
            const [code, d, s, r] = k.split('|');
            const id = byCode.get(String(code).toLowerCase());
            if (id) out[`${id}|${d}|${s}|${r}`] = n;
          }
          return out;
        }
      }
    } catch (_) { /* dùng định biên hiện tại */ }
  }
  const rows = await selAll('staffing_requirements', 'branch_id, weekday, shift, role, required_count');
  return Object.fromEntries(rows.map((r) => [`${r.branch_id}|${r.weekday}|${r.shift}|${r.role}`, r.required_count]));
}

// ---------------- Thông báo: chạy sự kiện đến hạn (tối đa 1 lần/phút mỗi trình duyệt)
let lastTick = 0;
export async function notifyTick() {
  if (Date.now() - lastTick < 60000) return;
  lastTick = Date.now();
  try { await rpc('app_notify_tick'); } catch (_) { /* không làm hỏng trang */ }
}
export async function unreadCount(accountId) {
  const { sb } = await import('./sb.js');
  const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).eq('account_id', accountId).is('read_at', null);
  return count || 0;
}
