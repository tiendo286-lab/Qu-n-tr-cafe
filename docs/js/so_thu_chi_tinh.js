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
  const o = {}; COLS[book].forEach(([k]) => { o[k] = total(live(items).filter((x) => x.col === k)); }); return o;
}

// Khoản gạch ngang (void) vẫn nằm trong danh sách để hiện, nhưng không cộng vào tổng.
export function dayTree(data, book, pm, col = null) {
  const its = data.items.filter((x) => x.book === book && x.pm === pm && (!col || x.col === col));
  const total = (list) => live(list).reduce((a, x) => a + Number(x.amount || 0), 0);
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

// phép tính lệch sau ghép: "30.000 − 20.000 ghép = 10.000" (chưa ghép thì rỗng)
export function gapMath(x) {
  const g = Number(x.gross ?? x.amount), a = Number(x.amount); if (!(g > a)) return '';
  return `${fmt(g)} − ${fmt(g - a)} ghép = ${fmt(a)}`;
}
export function caMoney(items, caId, startTm) {
  const one = (pm, start) => {
    const g = (book, c) => sumItems(items, { book, pm, col: c, caId });
    const gl = (book) => live(items).filter((x) => x.book === book && x.pm === pm && x.col === 'lech' && (x.ca_id ?? null) === caId).reduce((a, x) => a + Number(x.gross ?? x.amount ?? 0), 0);
    const r = { start, dt: g('thu', 'dt'), no: g('thu', 'no'), khac: g('thu', 'khac'), lc: g('thu', 'lc') - g('chi', 'lc'), chi: g('chi', 'chi'), cn: g('chi', 'no'), du: gl('thu'), th: gl('chi') };   // lệch gộp (trước ghép)
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
  const cmp = (k, name, a, b, x, y) => ({ k, name, a, b, ...(x === y ? { st: 'ok', txt: '✓ Khớp' } : { st: 'red', txt: `🔴 Lệch ${signed(x - y)}`, fix: 'fabi' }) });
  const mo = { k: 'mo', name: 'Tiền mở ca', a: `NV ghi ${fmt(nv.opening ?? 0)} · Fabi ${has ? fmt(f.opening ?? 0) : 'chưa có'}`, b: `Phải là ${fmt(exp)}`,
    // đợt 4: 2 tầng — NV ghi ↔ Fabi (Sửa theo Fabi), rồi Fabi ↔ phải là (ca nào ghi sai ca đó chịu)
    ...(has && Number(nv.opening ?? 0) !== Number(f.opening ?? 0) ? { st: 'red', txt: `🔴 NV ghi khác Fabi ${signed(Number(nv.opening ?? 0) - Number(f.opening ?? 0))}`, fix: 'fabi' }
      : ca.blame ? { st: 'ok', txt: `✓ ${ca.blame.who === 'nay' ? 'Ca này chịu' : 'Ca trước chịu'} ${signed(Number(ca.blame.diff))}`, blame: ca.blame }
      : open === exp ? { st: 'ok', txt: '✓ Đúng' } : { st: 'red', txt: `🔴 ${open > exp ? 'Thừa' : 'Thiếu'} ${fmt(open - exp)} khi giao ca`, fix: 'blame' }) };
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

// ---------------- Đối soát Fabi + Chốt ca + Khoản treo (bước 151) ----------------
// Trạng thái 1 ca ở tab Đối soát Fabi. fin = {by, at} nếu đã Chốt ca; treoOpen = ca còn khoản treo mở.
export function caStage(ca, checks, fin, treoOpen = false) {
  if (fin) return { k: 'fin', txt: treoOpen ? '🔒 Đã chốt · có khoản treo' : '🔒 Đã chốt ca', cls: 'p-ok' };
  if (ca.recon_money_done) return { k: 'fab', txt: '🔵 Fabi ✓ · đã xác nhận', cls: 'p-info' };
  const ab = checks.filter((c) => ['mo', 'dt', 'no'].includes(c.k));
  if (ab.some((c) => c.st === 'kt') || ca.kt_wait || !ca.fabi?.has) return { k: 'kt', txt: '⏳ Chờ kế toán', cls: 'p-mute' };
  const reds = ab.filter((c) => c.st === 'red');
  if (reds.length) return { k: 'lech', txt: '🔴 ' + reds.map((c) => c.name).join(', '), cls: 'p-off' };
  return { k: 'cho', txt: '🟡 Chờ xác nhận Fabi', cls: 'p-warn' };
}
// Điều kiện Chốt ca (cùng luật với máy chủ app_stc_ca_final) + khoản nào sẽ thành Khoản treo.
export function finalNeeds(ca, items) {
  const need = [], treo = [];
  if (!ca.recon_money_done) need.push('Chưa xác nhận Fabi (phần A)');
  const mine = live(items).filter((x) => (x.ca_id ?? null) === ca.id);
  const todo = mine.filter((x) => x.book === 'chi' && x.col === 'chi' && !x.cat).length;
  if (todo) need.push(`Còn ${todo} khoản chi chưa phân loại`);
  const gaps = mine.filter((x) => x.col === 'lech' && x.gap);
  if (gaps.some((x) => (x.gap.qc_wait || []).length || (x.gap.matches || []).some((m) => m.status === 'cho_duyet'))) need.push('Còn khoản chờ Chủ duyệt (quán chịu / ghép)');
  gaps.forEach((x) => {
    const rest = Number(x.gap.remain || 0); if (rest <= 5000) return;
    if (x.gap.kind === 'thieu' && x.pm === 'tm') need.push(`Tiền mặt thiếu ${fmt(rest)} chưa xử lý (trừ tiền / quán chịu / ghép)`);
    else treo.push({ pm: x.pm, kind: x.gap.kind === 'thieu' ? 'tien' : 'thua', amount: rest });
  });
  return { need, treo };
}
// Nhãn khoản treo.
export function treoView(t) {
  if (t.status === 'xong') return { label: 'Đã xử lý' + (t.done_note ? ' · ' + t.done_note : ''), cls: 'ok', over: false };
  if (t.kind === 'thua') return t.thu_khac ? { label: 'Hết tháng chưa ghép → thành Thu khác', cls: 'mute', over: false } : { label: 'Tiền thừa chờ ghép · tới hết tháng', cls: 'ok', over: false };
  const d = Number(t.days_left);
  if (t.over || d < 0) return { label: `Chờ tiền về · quá hạn ${Math.abs(d)} ngày`, cls: 'off', over: true };
  return { label: d ? `Chờ tiền về · còn ${d} ngày` : 'Chờ tiền về · hạn hôm nay', cls: 'info', over: false };
}
// Tách 1 dòng chênh lệch tiền mặt thành từng nguồn: phần lệch tiền mở ca (đã chọn ca chịu) + phần còn lại.
// signedGap: dư dương, thiếu âm. cas: mọi ca của tháng (để tìm ca sau chọn "Ca trước ghi sai").
export function gapParts(ca, cas, pm, signedGap) {
  if (pm !== 'tm') return [];
  const parts = [];
  if (ca.blame && ca.blame.who === 'nay' && Number(ca.blame.diff)) parts.push({ label: 'Lệch tiền mở ca (ca này ghi sai)', amount: Number(ca.blame.diff) });
  (cas || []).filter((o) => o.blame && o.blame.who === 'truoc' && Number(o.blame.prev_report) === Number(ca.id) && Number(o.blame.diff))
    .forEach((o) => parts.push({ label: `Lệch tiền mở ca của ca ${o.shift} sau (ca này ghi sai, để lại khác số)`, amount: Number(o.blame.diff) }));
  if (!parts.length) return [];
  const rest = signedGap - parts.reduce((a, p) => a + p.amount, 0);
  if (rest) parts.push({ label: 'Lệch đếm két / do sửa thu chi', amount: rest });
  return parts;
}

// ---------------- Bước 152: bộ lọc Sổ thu / Sổ chi ----------------
// Bộ lọc giữ trên đường dẫn: loc=q:<chữ>,src:<nguồn>,type:<loại>,cat:<nhóm>,st:<trạng thái> (giá trị đã mã hoá).
export const LOC_EMPTY = Object.freeze({ q: '', src: '', type: '', cat: '', st: '' });
const LOC_KEYS = Object.keys(LOC_EMPTY);
export function parseLoc(s) {
  const f = { ...LOC_EMPTY };
  String(s || '').split(',').forEach((p) => {
    const i = p.indexOf(':'); if (i < 1) return;
    const k = p.slice(0, i); if (!LOC_KEYS.includes(k)) return;
    try { f[k] = decodeURIComponent(p.slice(i + 1)); } catch (_) { f[k] = p.slice(i + 1); }
  });
  return f;
}
export function locStr(f) {
  return LOC_KEYS.filter((k) => f && f[k]).map((k) => `${k}:${encodeURIComponent(f[k])}`).join(',');
}
// Bỏ dấu tiếng Việt + chữ thường, để tìm "da" ra "Mua đá".
export const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
const liveTl = (x) => ((x.gap && x.gap.tl) || []).filter((t) => t.status !== 'huy');
// Lọc khoản của sổ. ctx.fin(caId) → ca đã chốt chưa. Khoản đã xoá chỉ hiện khi lọc "Đã xoá".
export function filterItems(items, f, ctx = {}) {
  const fin = ctx.fin || (() => false);
  const q = fold(f.q).trim();
  return (items || []).filter((x) => {
    if (f.st === 'void' ? !x.void : x.void) return false;
    if (f.src === 'ca' && x.ca_id == null) return false;
    if (f.src === 'tay' && !(x.src === 'entry' && x.ca_id == null)) return false;
    if (f.src === 'bu' && x.src !== 'shortfall') return false;
    if (f.src === 'lech' && x.col !== 'lech') return false;
    if (f.type && String(x.cat_type ?? '') !== String(f.type)) return false;
    if (f.cat && x.cat !== f.cat) return false;
    if (f.st === 'todo' && !(x.book === 'chi' && x.col === 'chi' && !x.cat)) return false;
    if (f.st === 'cho' && !/Chờ/.test(x.status || '')) return false;
    if (f.st === 'tl' && !(x.col === 'lech' && liveTl(x).length)) return false;
    if (f.st === 'fin' && !(x.ca_id != null && fin(x.ca_id))) return false;
    if (f.st === 'open' && !(x.ca_id != null && !fin(x.ca_id))) return false;
    if (q) {
      const hay = fold([x.title, x.cat, x.meta, ...((x.gap && x.gap.tl) || []).flatMap((t) => [t.name, t.reply])].filter(Boolean).join(' · '));
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
