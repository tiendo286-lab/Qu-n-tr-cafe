// Sổ thu chi mới (đợt 1) — hàm tính thuần, không đọc DOM, không gọi máy chủ.
// Thiết kế: tai_lieu/superpowers/specs/2026-11-18-so-thu-chi-moi-design.md · Bài thử: kiem_tra/so_thu_chi_tinh_dot1.mjs
// Dữ liệu vào: kết quả app_stc_month (danh sách ca + danh sách khoản chuẩn hoá). Mỗi khoản: book thu|chi, pm tm|ck, col, amount > 0.

export const START = '2026-11-01';
export const FLOAT = 1000000;          // gối đầu két
export const ALERT = 20000000;         // tiền mặt quá mức này thì nhắc chuyển về Quỹ ngoài
export const SHIFT_ORDER = ['Sáng', 'Chiều', 'Tối'];
export const COLS = {
  thu: [['dt', 'Doanh thu'], ['no', 'Thu nợ'], ['khac', 'Thu khác'], ['lc', 'Luân chuyển'], ['lech', 'Chênh lệch']],
  chi: [['chi', 'Các khoản chi'], ['no', 'Cho nợ'], ['lc', 'Luân chuyển'], ['lech', 'Chênh lệch']],
};

const fmt = (v) => Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(v);
const live = (items) => items.filter((x) => !x.void);
const total = (items) => items.reduce((a, x) => a + Number(x.amount || 0), 0);
const shiftRank = (s) => { const i = SHIFT_ORDER.indexOf(s); return i < 0 ? 99 : i; };

export function sumItems(items, { book, pm, col, date, caId } = {}) {
  return total(live(items).filter((x) => (!book || x.book === book) && (!pm || x.pm === pm) && (!col || x.col === col)
    && (!date || x.date === date) && (caId === undefined || (x.ca_id ?? null) === caId)));
}

function byColOf(items, book) {
  const o = {}; COLS[book].forEach(([k]) => { o[k] = total(items.filter((x) => x.col === k)); }); return o;
}

export function dayTree(data, book, pm, col = null) {
  const its = live(data.items).filter((x) => x.book === book && x.pm === pm && (!col || x.col === col));
  const dates = [...new Set([...data.cas.map((c) => c.date), ...its.map((x) => x.date)])].sort().reverse();
  return dates.map((date) => {
    const cas = data.cas.filter((c) => c.date === date).sort((a, b) => shiftRank(a.shift) - shiftRank(b.shift))
      .map((c) => { const ci = its.filter((x) => x.ca_id === c.id); return { caId: c.id, shift: c.shift, staff: c.staff, total: total(ci), byCol: byColOf(ci, book), items: ci }; })
      .filter((c) => !col || c.total > 0);
    const oi = its.filter((x) => x.date === date && (x.ca_id ?? null) === null);
    const outside = { total: total(oi), byCol: byColOf(oi, book), items: oi };
    const all = its.filter((x) => x.date === date);
    return { date, total: total(all), byCol: byColOf(all, book), cas, outside };
  }).filter((d) => (col ? d.total > 0 : d.total > 0 || d.cas.length > 0));
}

export function caMoney(items, caId, startTm) {
  const one = (pm, start) => {
    const g = (book, c) => sumItems(items, { book, pm, col: c, caId });
    const r = { start, dt: g('thu', 'dt'), no: g('thu', 'no'), khac: g('thu', 'khac'), lc: g('thu', 'lc') - g('chi', 'lc'), chi: g('chi', 'chi'), cn: g('chi', 'no'), du: g('thu', 'lech'), th: g('chi', 'lech') };
    r.must = r.start + r.dt + r.no + r.khac + r.lc - r.chi - r.cn;
    r.real = r.must + r.du - r.th;
    r.gap = r.real - r.must;
    return r;
  };
  return { tm: one('tm', startTm), ck: one('ck', 0) };
}

export function dayChain(data, date) {
  const out = new Map(); let prev = null;
  SHIFT_ORDER.forEach((s) => {
    const c = data.cas.find((x) => x.date === date && x.shift === s); if (!c) return;
    const expOpen = !prev ? FLOAT : prev.ca.cash_mode === 'ca' ? FLOAT : prev.money.tm.real;
    // tiền ca tính từ tiền đầu ca thật (bản đối soát); lệch so với số phải là hiện ở ô "Tiền mở ca"
    const money = caMoney(data.items, c.id, c.start_tm != null ? Number(c.start_tm) : expOpen);
    out.set(c.id, { expOpen, money }); prev = { ca: c, money };
  });
  return out;
}

export function caChecks(ca, link) {
  const f = ca.fabi || {}, nv = ca.nv || {}, has = !!f.has;
  const open = has ? Number(f.opening ?? 0) : Number(nv.opening ?? 0);
  const exp = link ? link.expOpen : open;
  const cmp = (k, name, a, b, x, y) => ({ k, name, a, b, ...(x === y ? { st: 'ok', txt: '✓ Khớp' } : { st: 'red', txt: `🔴 Lệch ${signed(x - y)}` }) });
  const mo = { k: 'mo', name: 'Tiền mở ca', a: `NV ghi ${fmt(nv.opening ?? 0)} · Fabi ${has ? fmt(f.opening ?? 0) : 'chưa có'}`, b: `Phải là ${fmt(exp)}`,
    ...(open === exp ? { st: 'ok', txt: '✓ Đúng' } : { st: 'red', txt: `🔴 ${open > exp ? 'Thừa' : 'Thiếu'} ${fmt(open - exp)} khi giao ca` }) };
  const dt = has ? cmp('dt', 'Doanh thu', `NV báo ${fmt(nv.revenue ?? 0)}`, `Fabi ${fmt(f.revenue ?? 0)}`, Number(nv.revenue ?? 0), Number(f.revenue ?? 0))
    : { k: 'dt', name: 'Doanh thu', a: `NV báo ${fmt(nv.revenue ?? 0)}`, b: 'Fabi chưa có', st: 'kt', txt: '⏳ Chờ file Fabi' };
  const no = has ? cmp('no', 'Nợ', `NV khai nợ HĐ ${fmt(nv.debt ?? 0)}`, `Fabi ${fmt(f.debt ?? 0)}`, Number(nv.debt ?? 0), Number(f.debt ?? 0))
    : { k: 'no', name: 'Nợ', a: `NV khai nợ HĐ ${fmt(nv.debt ?? 0)}`, b: 'Fabi chưa có', st: 'kt', txt: '⏳ Chờ file Fabi' };
  const mm = link ? link.money : caMoney([], ca.id, open);
  const money = (pm, name, a, b) => {
    const r = mm[pm];
    if (pm === 'ck' && (ca.kt_wait || ca.bank_ck == null)) return { k: pm, name, a: 'Ngân hàng: chờ kế toán', b, st: 'kt', txt: '⏳ Chờ kế toán' };
    return { k: pm, name, a, b, ...(r.gap === 0 ? { st: 'ok', txt: '✓ Khớp' } : { st: 'red', txt: `🔴 ${r.gap < 0 ? 'Thiếu' : 'Dư'} ${fmt(r.gap)}` }) };
  };
  return [mo, dt, no,
    money('tm', 'Tiền mặt', `Thực tế ${fmt(mm.tm.real)}`, `Phải có ${fmt(mm.tm.must)}`),
    money('ck', 'Chuyển khoản', `Ngân hàng ${fmt(mm.ck.real)}`, `Phải nhận ${fmt(mm.ck.must)}`)];
}

export function caState(ca, checks) {
  if (ca.recon_money_done) return { k: 'chot', txt: '🔒 Đã chốt', cls: 'p-ok' };
  const reds = checks.filter((c) => c.st === 'red' && ['mo', 'dt', 'no'].includes(c.k));
  if (reds.length) return { k: 'lech', txt: '🔴 ' + reds.map((c) => c.name).join(', '), cls: 'p-off' };
  if (checks.some((c) => c.st === 'kt')) return { k: 'kt', txt: '⏳ Chờ kế toán', cls: 'p-info' };
  return { k: 'cho', txt: '🔵 Chờ chốt', cls: 'p-info' };
}

export function fundSummary(data) {
  const its = live(data.items);
  const dates = [...new Set(its.map((x) => x.date))].sort();
  const side = (pm) => {
    const open = Number(data.opening?.[pm] || 0);
    const thu = sumItems(its, { book: 'thu', pm });
    const toQN = total(its.filter((x) => x.pm === pm && x.to_qn));
    const chi = sumItems(its, { book: 'chi', pm }) - toQN;
    let bal = open;
    const daily = dates.map((date) => {
      const t = sumItems(its, { book: 'thu', pm, date }); const q = total(its.filter((x) => x.pm === pm && x.to_qn && x.date === date));
      const c = sumItems(its, { book: 'chi', pm, date }) - q;
      const d = { date, start: bal, thu: t, chi: c, toQN: q, end: bal + t - c - q }; bal = d.end; return d;
    }).reverse();
    return { f: { open, thu, chi, toQN, ton: open + thu - chi - toQN }, daily };
  };
  const tm = side('tm'), ck = side('ck');
  const qn = its.filter((x) => x.to_qn);
  return { tm: tm.f, ck: ck.f, daily: { tm: tm.daily, ck: ck.daily }, toQN: qn, waitQN: qn.filter((x) => x.recv === 'cho') };
}

export function compareDays(data, summary) {
  const endAt = (pm, date) => { const d = summary.daily[pm].find((x) => x.date <= date); return d ? d.end : summary[pm].open; };
  const out = [];
  (data.compare?.fund_days || []).forEach((row) => ['tm', 'ck'].forEach((pm) => {
    if (row[pm] == null) return;
    const neu = endAt(pm, row.date), old = Number(row[pm]);
    if (neu !== old) out.push({ date: row.date, pm, old, neu, diff: neu - old });
  }));
  return out;
}
