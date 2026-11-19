// Việc hôm nay chia nhóm (bước 142): chia khối Vận hành / Nhân sự / Khác, gộp việc cùng loại, Đã xong hôm nay, Mọi người (Chủ).
// Hàm thuần (không gọi máy chủ, không chạm trang) để thử bằng jsc: kiem_tra/hom_nay_nhom_142.mjs
import { ORDER, collectWork, jobCat } from './hom_nay_viec.js?v=2026.11.19.12';

export const CATS = [
  { id: 'vh', name: 'Vận hành', hint: 'Tiền · Chốt ca · Hàng hoá · Ngân hàng' },
  { id: 'ns', name: 'Nhân sự', hint: 'Nghỉ & làm thay · Đào tạo · Nội quy · Cam kết' },
  { id: 'kh', name: 'Khác', hint: 'Việc còn lại' },
];
export const ROLE_TABS = ['Quản lý tổng', 'Quản lý', 'Kế toán', 'Việc khác'];

const ms = (s) => (s ? Date.parse(String(s).replace(' ', 'T')) : NaN);
const rank = (i) => (i.review || i.redo ? 0 : i.gap && i.group !== 'waiting' ? 1 : 2);   // việc Gấp đã báo xong (đang chờ) không vượt việc quá hạn
const byUrgency = (a, b) => rank(a) - rank(b) || ORDER.indexOf(a.group) - ORDER.indexOf(b.group)
  || (ms(a.due) || Infinity) - (ms(b.due) || Infinity);
const short = (s) => String(s || '').replace(/^[^–]*–\s*/, '');
const hm = (s) => String(s || '').slice(11, 16);

export function countOf(list) {
  const c = { n: list.length, gap: 0, late: 0, today: 0, review: 0, redo: 0, waiting: 0 };
  for (const i of list) {
    if (i.gap && i.group !== 'waiting') c.gap++; if (i.review) c.review++; if (i.redo) c.redo++;
    if (i.group === 'late') c.late++; else if (i.group === 'today') c.today++; else if (i.group === 'waiting') c.waiting++;
  }
  return c;
}

// items (đã có cat, kind, group…) → 3 khối; trong khối, việc cùng kind (≥ 2) gộp 1 dòng ở vị trí việc gấp nhất
export function buildSections(items) {
  return CATS.map((cat) => {
    const list = items.filter((i) => i.cat === cat.id).sort(byUrgency);
    const entries = []; const bundles = new Map();
    for (const i of list) {
      if (!i.kind) { entries.push(i); continue; }
      if (!bundles.has(i.kind)) { const b = { bundle: true, kind: i.kind, label: i.kindLabel, tag: i.tag, kids: [] }; bundles.set(i.kind, b); entries.push(b); }
      bundles.get(i.kind).kids.push(i);
    }
    const out = entries.map((e) => (e.bundle && e.kids.length === 1 ? e.kids[0] : e.bundle ? { ...e, top: e.kids[0], counts: countOf(e.kids) } : e));
    return { cat, entries: out, counts: countOf(list) };
  });
}

// app_today_more().done_today → dòng Đã xong hôm nay (mới nhất trước). meId: mã tài khoản để đổi tên mình thành "Bạn" (tên máy chủ dạng "Mã – Tên").
const doneTag = (d) => (d.kind === 'pc' ? (jobCat(d.job).tag || 'Việc') : d.handover ? 'Bàn giao ca' : 'Giao việc riêng');
export function doneRows(list, today, meId) {
  return (list || []).filter((d) => String(d.at || '').startsWith(today))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .map((d) => ({ tag: doneTag(d), title: d.title + (d.code ? ' · ' + d.code : ''), at: hm(d.at), by: d.kind === 'gv' ? (d.by || null) : null,
      who: meId != null && d.who_id === meId ? 'Bạn' : (d.who || '') }));
}

export function roleOfPerson(p) {
  if (!p) return 'Việc khác';
  if (p.role === 'ql_tong') return 'Quản lý tổng';
  if (p.kt) return 'Kế toán';
  if (p.role === 'ql') return 'Quản lý';
  return 'Việc khác';
}
export const byRole = (list, role) => (role ? list.filter((x) => (x.roles || []).includes(role)) : list);

// Tab Mọi người của Chủ: app_pc_all() + app_dt_work_list(false). Bỏ việc chỉ có mình giữ.
export function everyoneWork(pcAll, training, me, helpers) {
  const people = pcAll?.people || [];
  const pById = new Map(people.map((p) => [p.id, p])); const pByName = new Map(people.map((p) => [p.name, p]));
  const rolesOf = (ids) => { const r = [...new Set(ids.filter((x) => x !== me).map((x) => roleOfPerson(pById.get(x))))]; return r.length ? r : ['Việc khác']; };
  const today = String(pcAll?.now || '').slice(0, 10);
  const holders = new Map();
  for (const t of pcAll?.tasks || []) holders.set('pc:' + t.id, (helpers.curStep(t)?.accounts) || []);
  const open = (pcAll?.gv || []).filter((k) => { const s = helpers.rstate(k); return s >= 0 && s < 4; });
  for (const k of open) {
    const s = helpers.rstate(k);
    holders.set('gv:' + k.id, s === 0 ? (k.classifiers || []).map((c) => c.id) : s === 3 ? [k.reviewer_id] : [k.assignee_id].filter((x) => x != null));
  }
  const rows = (training?.rows || []).filter((t) => t.status !== 'hoan_thanh');
  const W = collectWork({ now: pcAll?.now, pc: pcAll ? { me, tasks: pcAll.tasks || [], gv: open } : null, training: { rows } }, helpers);
  const items = [];
  for (const i of W.items) {
    if (i.key.startsWith('dt:')) {
      const t = rows.find((r) => 'dt:' + r.id === i.key); const p = pByName.get(t.manager);
      if (p && p.id === me) continue;
      const text = t.manager || short(t.instructor) || 'Chưa có người nhận';
      items.push({ ...i, waitingFor: null, who: { text, mine: false, none: !t.manager && !t.instructor }, roles: p ? [roleOfPerson(p)] : t.instructor ? ['Quản lý'] : ['Việc khác'] });
      continue;
    }
    const ids = holders.get(i.key) || [];
    if (ids.length && ids.every((x) => x === me)) continue;
    const k = i.key.startsWith('gv:') ? open.find((g) => 'gv:' + g.id === i.key) : null;
    const who = k && helpers.rstate(k) === 3 ? { text: short(k.reviewer) + ' (kiểm tra)', mine: false, none: false } : { ...i.who, mine: false };
    items.push({ ...i, review: false, who, roles: rolesOf(ids) });
  }
  const done = [
    // bỏ dòng không có người làm (tự bỏ làm bổ sung) hoặc do chính mình đóng (Chủ xoá việc tự thêm)
    ...(pcAll?.done || []).filter((d) => String(d.done_at || '').startsWith(today) && d.by && pByName.get(d.by)?.id !== me).map((d) => ({ tag: jobCat(d.job).tag || 'Việc', title: d.title, at: hm(d.done_at), by: null,
      who: d.by || '', roles: d.by && pByName.get(d.by) ? [roleOfPerson(pByName.get(d.by))] : ['Việc khác'], sort: d.done_at })),
    ...(pcAll?.gv || []).filter((k) => helpers.rstate(k) === 4 && String(k.approved_at || '').startsWith(today)).map((k) => ({ tag: k.handover ? 'Bàn giao ca' : 'Giao việc riêng',
      title: k.content + (k.code ? ' · ' + k.code : ''), at: hm(k.approved_at), by: short(k.reviewer) || null, who: short(k.assignee), roles: rolesOf([k.assignee_id].filter((x) => x != null)), sort: k.approved_at })),
  ].sort((a, b) => String(b.sort).localeCompare(String(a.sort)));
  return { items, done, failed: pcAll == null };
}
