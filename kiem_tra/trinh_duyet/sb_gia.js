// GIẢ LẬP Supabase để chạy thử trên Chrome (không kết nối dữ liệu thật)
import { DATA } from '../test/data.js';
import { makeCa, makeStorage } from '../test/ca_gia.js';
import { makeViec } from '../test/viec_gia.js';
import { makeTl } from '../test/tl_gia.js';
import { makeDt } from '../test/dt_gia.js';
import { makeHt } from '../test/ht_gia.js';
import { makeKt } from '../test/kt_gia.js';
import { makeFin } from '../test/fin_gia.js';
import { makeFund } from '../test/fund_gia.js';
import { makeStc } from '../test/stc_gia.js';
import { makeNh } from '../test/nh_gia.js';
import { makeDg } from '../test/dg_gia.js';
import { makeCv } from '../test/cv_gia.js';
import { makeFb } from '../test/fb_gia.js';
import { makePc } from '../test/pc_gia.js';
import { makeHn } from '../test/hn_gia.js';
export const SUPABASE_URL = 'x'; export const SUPABASE_KEY = 'x';
const T = DATA;
for (const t of ['order_submissions', 'notifications', 'schedule_published', 'schedule_extra_rows', 'schedule_locks', 'week_order_windows', 'notification_events', 'audit_log', 'order_edit_log']) T[t] = T[t] || [];
const PK = { settings: ['key'], branch_shifts: ['branch_id', 'shift_id'], staffing_requirements: ['branch_id', 'weekday', 'shift', 'role'], fixed_schedule_members: ['employee_id'],
  fixed_schedule_entries: ['employee_id', 'weekday', 'shift'], week_order_windows: ['week_id'], role_permissions: ['role', 'perm'], employee_contacts: ['employee_id'] };
window.__LOG = [];
{ const w = T.weeks.find((x) => x.start_date === '2026-11-02');
  if (!T.schedule_published.length) T.schedule_published = T.weekly_schedule_entries.filter((r) => r.week_id === w.id && r.state === 'ĐÃ XẾP' && r.branch_id)
    .map((r) => ({ week_id: r.week_id, employee_id: r.employee_id, weekday: r.weekday, shift: r.shift, branch_id: r.branch_id, role: r.role, published_at: '2026-11-01 10:00:00', note: null, changed_at: null }));
  T.notifications.push({ id: 1, account_id: 3, title: 'Lịch tuần đã chốt', body: 'Xem lịch', link: '/lich?tuan=2026-11-02', created_at: '2026-11-01 10:00:00', read_at: null }); } window.__ERR = window.__ERR || [];
const role = localStorage.getItem('test_role') || 'chu';
class Q {
  constructor(t) { this.t = t; this.f = []; this.o = []; this.lim = null; this.cnt = false; this.head = false; this.rng = null; this.op = 'select'; this.one = false; }
  select(cols, opt = {}) { if (this.op === 'select') { this.cnt = !!opt.count; this.head = !!opt.head; } this.ret = true; return this; }
  eq(c, v) { this.f.push((r) => r[c] == v); return this; }
  neq(c, v) { this.f.push((r) => r[c] != v); return this; }
  in(c, vs) { this.f.push((r) => vs.includes(r[c])); return this; }
  is(c, v) { this.f.push((r) => (r[c] ?? null) === v); return this; }
  not(c, op, v) { this.f.push((r) => !((r[c] ?? null) === v)); return this; }
  gte(c, v) { this.f.push((r) => r[c] >= v); return this; }
  gt(c, v) { this.f.push((r) => r[c] > v); return this; }
  lte(c, v) { this.f.push((r) => r[c] <= v); return this; }
  lt(c, v) { this.f.push((r) => r[c] < v); return this; }
  like(c, v) { const re = new RegExp('^' + v.replace(/%/g, '.*') + '$'); this.f.push((r) => re.test(r[c])); return this; }
  ilike(c, v) { return this.like(c, v); }
  match(o) { Object.entries(o).forEach(([k, v]) => this.eq(k, v)); return this; }
  order(c, o = {}) { this.o.push([c, o.ascending !== false]); return this; }
  limit(n) { this.lim = n; return this; }
  range(a, b) { this.rng = [a, b]; return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; return this; }
  upsert(row, opt = {}) { this.op = 'upsert'; this.rows = [].concat(row); this.conf = opt.onConflict ? opt.onConflict.split(',') : (PK[this.t] || ['id']); return this; }
  insert(row) { this.op = 'insert'; this.rows = [].concat(row); return this; }
  update(row) { this.op = 'update'; this.patch = row; return this; }
  delete() { this.op = 'delete'; return this; }
  run() {
    const tab = T[this.t] || (T[this.t] = []);
    window.__LOG.push([this.op, this.t, this.rows || this.patch || null]);
    const m = (r) => this.f.every((fn) => fn(r));
    if (this.op === 'insert') { const out = this.rows.map((r) => ({ id: Math.max(0, ...tab.map((x) => x.id || 0)) + 1, ...r })); tab.push(...out); return out; }
    if (this.op === 'upsert') { const out = []; for (const r of this.rows) { const ex = tab.find((x) => this.conf.every((k) => x[k] == r[k])); if (ex) Object.assign(ex, r); else tab.push({ ...r }); out.push(ex || r); } return out; }
    if (this.op === 'update') { const rs = tab.filter(m); rs.forEach((r) => Object.assign(r, this.patch)); return rs; }
    if (this.op === 'delete') { const rs = tab.filter(m); T[this.t] = tab.filter((r) => !m(r)); return rs; }
    let rows = tab.filter(m);
    for (const [c, asc] of this.o.slice().reverse()) rows = rows.slice().sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
    const count = rows.length;
    if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
    if (this.lim) rows = rows.slice(0, this.lim);
    rows = rows.map((r) => ({ ...r }));
    return { rows, count };
  }
  then(res, rej) {
    const t0 = performance.now();
    return new Promise((ok) => setTimeout(ok, TRE)).then(() => {
      window.__RPCT.push(['bảng ' + this.t, t0, performance.now()]);
      const r = this.run();
      if (this.op === 'select') return { data: this.head ? null : (this.one ? r.rows[0] || null : r.rows), count: r.count, error: null };
      return { data: this.one ? r[0] : r, error: null };
    }).then(res, rej);
  }
}
const meFor = (role) => role === 'chu'
  ? { account_id: 1, employee_id: null, role: 'chu', must_change: false, code: 'admin', name: 'Chủ', perms: new Proxy({}, { get: () => true }) }
  : role === 'kt'
    ? { account_id: 7, employee_id: null, role: 'ke_toan', must_change: false, code: 'ketoan', name: 'Kế toán thử', perms: { ke_toan: true, nhan_viec: true } }
  : role === 'nvkt'
    ? { account_id: 3, employee_id: 3, role: 'nv', must_change: false, code: 'NV3', name: 'Nhân viên thử', perms: { order_ca: true, xem_lich_minh: true, chot_ca: true, nhan_viec: true, ke_toan: true } }
  : role === 'qlt'
    ? { account_id: 6, employee_id: 6, role: 'ql_tong', must_change: false, code: 'NV01', name: 'QL tổng thử', perms: { order_ca: true, xem_lich_minh: true, xem_tat_ca: true, chot_ca: true, nhan_viec: true, hop_giao_viec: true, phan_cong: true, doi_soat: true } }
  : role === 'c1'   // bước 169: nhân viên Cấp 1 thử (nhân viên 7 trong dt_fixture)
    ? { account_id: 9, employee_id: 7, role: 'nv', must_change: false, code: 'NV07', name: 'Nhân viên cấp 1 thử', perms: { order_ca: true, xem_lich_minh: true, chot_ca: true, nhan_viec: true } }
  : role === 'ql2'   // bước 169: Quản lý khác (không phải HD chính, không phải người phụ trách chính)
    ? { account_id: 10, employee_id: 8, role: 'ql', must_change: false, code: 'NV08', name: 'Quản lý khác thử', perms: { order_ca: true, xem_lich_minh: true, xem_tat_ca: true, chot_ca: true, nhan_viec: true, dao_tao: true, doi_soat: true } }
  : role === 'ql'
    ? { account_id: 5, employee_id: 5, role: 'ql', must_change: false, code: '5', name: 'Quản lý thử', perms: { order_ca: true, xem_lich_minh: true, xem_tat_ca: true, chot_ca: true, nhan_viec: true, dao_tao: true, doi_soat: true } }
    : { account_id: 3, employee_id: 3, role: 'nv', must_change: false, code: 'NV3', name: 'Nhân viên thử', perms: { order_ca: true, xem_lich_minh: true, chot_ca: true, nhan_viec: true } };
// bước 165: Xem như người khác — role=chu + localStorage test_viewas = nv | ql | qlt | kt | nvkt → app_me trả người đó + view_as; ghi bị chặn (CSDL chỉ đọc)
const VA_IDS = { ql: 5, nv: 3, qlt: 6, kt: 7, nvkt: 8 };
const VA_KEY = (id) => Object.keys(VA_IDS).find((k) => VA_IDS[k] === Number(id));
const vaNow = () => { if (role !== 'chu') return null; const k = localStorage.getItem('test_viewas'); if (!k || !VA_IDS[k]) return null;
  const until = Number(localStorage.getItem('test_viewas_until') || Date.now() + 1800000);
  if (Date.now() > until) { localStorage.removeItem('test_viewas'); localStorage.removeItem('test_viewas_until'); return null; }
  return { k, until }; };
const VA = vaNow();
const ME = VA ? { ...meFor(VA.k === 'nvkt' ? 'nv' : VA.k), account_id: VA_IDS[VA.k], ...(VA.k === 'nvkt' ? { name: 'Nhân viên kế toán thử' } : {}),
  view_as: { account_id: VA_IDS[VA.k], name: VA.k === 'nvkt' ? 'Nhân viên kế toán thử' : meFor(VA.k).name, role: meFor(VA.k).role, branches: VA.k === 'ql' ? ['LHP'] : [], ke_toan: VA.k === 'nvkt', expires_at: new Date(VA.until).toISOString(), expires_in: Math.max(0, Math.floor((VA.until - Date.now()) / 1000)) } } : meFor(role);
const VA_PEOPLE = [{ account_id: 6, name: 'QL tổng thử', code: 'NV01', role: 'ql_tong', branches: [], ke_toan: false }, { account_id: 5, name: 'Quản lý thử', code: '5', role: 'ql', branches: ['LHP'], ke_toan: false },
  { account_id: 7, name: 'Kế toán thử', code: 'ketoan', role: 'ke_toan', branches: [], ke_toan: false }, { account_id: 3, name: 'Nhân viên thử', code: 'NV3', role: 'nv', branches: [], ke_toan: false },
  { account_id: 8, name: 'Nhân viên kế toán thử', code: 'NV8', role: 'nv', branches: [], ke_toan: true }];
const VA_WRITE = /_(save|set|add|del|delete|mark|seen|ack|create|update|upsert|send|done|confirm|apply|close|open|claim|collect|reopen|submit|edit|move|touch|read|tick)(_|$)/;
const CA0 = { ...makeCa(T, ME), ...makeViec(T, ME), ...makeTl(T, ME), ...makeDt(T, ME), ...makeHt(T, ME), ...makeKt(T, ME), ...makeFin(T, ME), ...makeFund(T, ME), ...makeStc(T, ME), ...makeNh(T, ME), ...makeDg(T, ME), ...makeCv(T, ME), ...makeFb(T, ME), ...makePc(T, ME), ...makeHn(T, ME) };
// chặng 6.3b: app_ca_recon_debt_uncollect — dòng "Khách trả nợ cũ" của sổ tháng giả (stc) xử lý trước, còn lại như ca_gia
const CA = CA0;
{ const base = CA.app_ca_recon_debt_collect; CA.app_ca_recon_debt_collect = function (a) { if (CA.__stcTraCollect?.(a)) return null; return base.call(this, a); }; }   // chặng 6.3c
{ const base = CA.app_ca_recon_debt_uncollect; CA.app_ca_recon_debt_uncollect = function (a) { if (CA.__stcTraUncollect?.(a)) return null; return base.call(this, a); }; }
const authCbs = [];
export const sb = {
  from: (t) => new Q(t),
  rpc: async (name, args) => ({ data: await rpc(name, args), error: null }),
  auth: {
    getSession: async () => ({ data: { session: localStorage.getItem('fake_login') ? {} : null } }),
    getUser: async () => ({ data: { user: { email: 'a1@milano.invalid' } } }),
    signInWithPassword: async () => { localStorage.setItem('fake_login', '1'); return { error: null }; },
    updateUser: async () => ({ error: null }),
    signOut: async () => { localStorage.removeItem('fake_login'); authCbs.forEach((f) => f('SIGNED_OUT')); },
    onAuthStateChange(f) { authCbs.push(f); },
  },
  storage: makeStorage(),
  functions: { invoke: async (n, { body }) => { window.__LOG.push(['fn', body]); return { data: { ok: true, password: 'abc12345', results: [], rows: [{ code: 'NV1', name: 'A', password: 'x1', login: 'NV1' }], accounts: T.accounts.map((a) => ({ ...a, employees: T.employees.find((e) => e.id === a.employee_id) || null })) }, error: null }; } },
};
export function viError(e) { return String(e?.message || e); }
// &tre=300: giả lập mỗi lần hỏi máy chủ mất 300ms (mạng thật VN → Singapore); window.__RPCT ghi [tên, bắt đầu, kết thúc]
const TRE = Number(new URLSearchParams(location.search).get('tre') || 2); window.__RPCT = [];
export async function rpc(name, args = {}) {
  window.__LOG.push(['rpc', name, args]);
  const t0 = performance.now(); await new Promise((ok) => setTimeout(ok, TRE)); window.__RPCT.push([name, t0, performance.now()]);
  if (name === 'app_tc_check' && CA.__tc_check && CA.__tc_check(args)) return null;   // bước 155: khoản Sổ thu chi giả
  if (name === 'app_view_as_people') { if (role !== 'chu') throw new Error('Chỉ Chủ dùng được Xem như người khác.'); return VA_PEOPLE; }
  if (name === 'app_view_as_start') { if (role !== 'chu') throw new Error('Chỉ Chủ dùng được Xem như người khác.'); const k = VA_KEY(args.p_account); if (!k) throw new Error('Không xem như tài khoản này.');
    localStorage.setItem('test_viewas', k); if (!new URLSearchParams(location.search).get('xnexp')) localStorage.setItem('test_viewas_until', String(Date.now() + 1800000)); return null; }
  if (name === 'app_view_as_stop') { localStorage.removeItem('test_viewas'); localStorage.removeItem('test_viewas_until'); return null; }
  if (VA && VA_WRITE.test(name)) throw new Error('Đang xem như người khác — chỉ xem, không lưu được.');   // giả CSDL chỉ đọc (sb.js thật đổi lỗi read-only sang câu này)
  if (CA[name]) return CA[name](args);
  if (name === 'app_me') return ME;
  if (name === 'app_published_weeks') { const ids = new Set((T.schedule_published || []).map((p) => p.week_id)); return (T.weeks || []).filter((w) => ids.has(w.id)).sort((a, b) => (a.start_date < b.start_date ? -1 : 1)).map((w) => ({ ...w })); }   // bước 134
  if (name === 'app_sys_overview') return { plan: 'Free', db_bytes: 25165824, db_limit: 524288000, storage: { 'phieu-ca': { bytes: 3145728, files: 12 } }, storage_bytes: 3145728, storage_limit: 1073741824, ram: null, egress: null, now: '2026-11-07 02:10:00',
    current: { version: '2026.11.07', released_at: '2026-11-07 02:10', released_by: 'Claude (theo yêu cầu anh Tiến)', added: ['Tab LOG'], changed: ['Gộp menu'], fixed: ['Sửa đếm'], removed: ['Họp'] } };
  if (name === 'app_sys_releases') return [{ version: '2026.11.07', released_at: '2026-11-07 02:10', released_by: 'Claude', added: ['Tab LOG'], changed: [], fixed: [], removed: ['Họp'] }, { version: '2026.11.06', released_at: '2026-11-06 23:59', released_by: 'Claude', added: ['Quản lý ca'], changed: [], fixed: [], removed: [] }];
  if (name === 'app_sys_log') return { limit: args.p_limit || 300, people: [{ id: 1, name: 'admin – Chủ' }], actions: ['mo_phieu_chot_ca', 'sua_ban_doi_soat'],
    rows: [{ at: '2026-11-07 01:48:00', by: 'admin – Chủ', action: 'sua_ban_doi_soat', object: 'report=1', link: '/ca/phieu?id=1', branch: 'LHP', field: 'pos_cash', before: 1200000, after: 1250000, note: 'NV nhập nhầm' },
           { at: '2026-11-07 00:59:57', by: 'admin – Chủ', action: 'mo_phieu_chot_ca', object: 'report=1', link: '/ca/phieu?id=1', branch: 'LHP', field: null, before: null, after: null, note: 'report=1' }].filter((r) => !args.p_action || r.action === args.p_action) };
  if (name === 'app_backup_counts') return { shift_reports: (T.shift_reports || []).length, tasks: (T.tasks || []).length, docs: (T.docs || []).length, trainings: (T.trainings || []).length, support_requests: (T.support_requests || []).length };
  if (name === 'app_backup_extra') return { shift_reports: T.shift_reports || [], tasks: T.tasks || [], trainings: T.trainings || [] };
  if (name === 'app_login_email') return { email: 'a1@milano.invalid' };
  if (name === 'app_order_window') {
    const w = T.weeks.find((x) => x.id === args.p_week_id || x.id === args.p_week);
    const open = localStorage.getItem('test_open') === '1';
    return open ? { open: '2026-11-02T08:00', close: '2026-11-08T22:00', custom: false, state: 'dang_mo', now: '2026-11-06T10:00:00', open_text: '08:00 Thứ Hai 02/11', close_text: '22:00 Chủ Nhật 08/11' }
      : { open: '2026-10-26T08:00', close: '2026-10-29T22:00', custom: false, state: 'da_dong', now: '2026-11-06T10:00:00', open_text: '08:00 Thứ Hai 26/10', close_text: '22:00 Thứ Năm 29/10' };
  }
  if (name === 'app_schedule_lock') return { ok: true, lock: null };
  if (name === 'app_schedule_poll') return { version: 'v', status: 'ĐANG CHỈNH SỬA', lock: null, mine: true };
  if (name === 'app_import_tables') return ['settings','branches','shifts','branch_shifts','work_roles','weeks','employees','employee_contacts','employee_branches','employee_roles','employee_work_plans','staffing_requirements','staffing_history','order_entries','order_import_batches','order_snapshots','order_submissions','fixed_schedule_members','fixed_schedule_entries','weekly_schedule_entries','schedule_closures','schedule_published','evaluation_rounds','evaluation_round_scores'];
  if (name === 'app_import_rows') return (args.p_rows || []).length;
  if (name === 'app_import_finish') return { employees: 110, weeks: 9 };
  if (name === 'app_create_week') return 99;
  if (name === 'app_submit_order') return { first: true, close_text: '22:00 Chủ Nhật 08/11' };
  if (name === 'app_chot') return { first: true, changed: 0 };
  if (name === 'app_order_restore') return { ok: true, synced: 0 };
  if (name === 'app_reapply_order') return { updated: 0, added: 0, removed: 0, synced: 0 };
  if (name === 'app_order_form_import') return { imported: 1, unknown: [], multi: [] };
  if (name === 'app_import_employees') return { added: 1, updated: 0 };
  if (name === 'app_set_employee_status') { const e = T.employees.find((x) => x.id === args.p_id); if (e) e.status = args.p_status; return { status: args.p_status, future_shifts: args.p_status === 'Ngừng làm' ? 2 : 0 }; }
  return null;
}
export async function sel(table, cols = '*', q = (b) => b) { const { data, error } = await q(sb.from(table).select(cols)); if (error) throw new Error(error.message); return data || []; }
export async function selAll(table, cols = '*', q = (b) => b) { return sel(table, cols, q); }
export async function adminFn(action, payload = {}) { const { data } = await sb.functions.invoke('admin', { body: { action, ...payload } }); return data; }
