// Phép tính thuần của trang Phân công đào tạo theo ca (tệp 174) — không đụng DOM, thử bằng jsc (kiem_tra/pc_dao_tao_tinh_174.mjs).
// row = một phiếu từ app_dt_plan_board: { instructor_id, due, shifts:[{date, shift, branch_id, mates}], items:[{no, state, who_id, date, shift, sub_by}] }

const DONE = new Set(['dat', 'cho_kt']);
const sameCa = (it, sh) => it.date === sh.date && it.shift === sh.shift;

// Các ngày đi làm thật (theo lịch đã công bố), không trùng, đã sắp
export const workDays = (row) => [...new Set((row.shifts || []).map((s) => s.date))].sort();

// "Ngày thứ mấy" = thứ tự ngày đi làm thật; ngày không đi làm → null
export const dayNo = (row, date) => { const i = workDays(row).indexOf(date); return i < 0 ? null : i + 1; };

// Các nhóm người dạy trong một ca (người trống = HD chính), sắp theo mục nhỏ nhất
export function groupsOf(row, sh) {
  const by = new Map();
  for (const it of (row.items || []).filter((x) => sameCa(x, sh))) {
    const who = it.who_id ?? row.instructor_id ?? null;
    if (!by.has(who)) by.set(who, { who_id: who, sub_by: it.sub_by ?? null, items: [] });
    by.get(who).items.push(it);
  }
  const gs = [...by.values()];
  gs.forEach((g) => {
    g.items.sort((a, b) => a.no - b.no);
    // "giao lại bởi" tính theo TỪNG mục: cả nhóm cùng một người giao lại → sub_by; lẫn lộn → sub_by trống + mixed = [{sub_by, nos}]
    const subs = [...new Set(g.items.map((x) => x.sub_by ?? null))];
    g.sub_by = subs.length === 1 ? subs[0] : null;
    g.mixed = subs.length > 1 ? subs.filter((x) => x != null).map((x) => ({ sub_by: x, nos: g.items.filter((i) => (i.sub_by ?? null) === x).map((i) => i.no) })) : [];
  });
  return gs.sort((a, b) => a.items[0].no - b.items[0].no);
}

// trong (ca qua, không giao) · chua (chưa giao) · giao (đã giao, còn mục) · ok (mọi mục đã chấm) · tre (ca qua còn mục chưa chấm)
export function shiftState(row, sh, today) {
  const its = (row.items || []).filter((x) => sameCa(x, sh));
  if (!its.length) return sh.date < today ? 'trong' : 'chua';
  if (its.every((x) => DONE.has(x.state))) return 'ok';
  return sh.date < today ? 'tre' : 'giao';
}

// Mục đang được xếp ở ca nào (null = chưa xếp ca)
export function itemWhere(row, no) {
  const it = (row.items || []).find((x) => x.no === no);
  return it && it.date ? { date: it.date, shift: it.shift, who_id: it.who_id ?? row.instructor_id ?? null } : null;
}

// [1,2,3,4,7] → "1–4, 7"
export function span(nos) {
  const xs = [...new Set(nos)].sort((a, b) => a - b); const out = [];
  for (let i = 0; i < xs.length; i++) {
    let j = i; while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++;
    out.push(j > i ? `${xs[i]}–${xs[j]}` : String(xs[i])); i = j;
  }
  return out.join(', ');
}

// Số ngày đi làm tới hạn còn thiếu so với số ngày giáo trình
export const shortfall = (row, days) => Math.max(0, days - workDays(row).filter((d) => !row.due || d <= row.due).length);

// Các ca đã công bố + ca "không còn trong lịch" (mục đã xếp ca nhưng lịch đổi sau đó, off: true), xếp theo ngày rồi ca
const SH_ORD = ['Sáng', 'Chiều', 'Tối'];
export function allShifts(row) {
  const pub = row.shifts || []; const has = new Set(pub.map((s) => `${s.date}|${s.shift}`)); const off = new Map();
  for (const it of row.items || []) if (it.date && !has.has(`${it.date}|${it.shift}`)) off.set(`${it.date}|${it.shift}`, { date: it.date, shift: it.shift, branch_id: null, branch: null, mates: [], off: true });
  if (!off.size) return pub;
  const o = (s) => { const i = SH_ORD.indexOf(s); return i < 0 ? 99 : i; };
  return [...pub, ...off.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : o(a.shift) - o(b.shift)));
}

// Việc của một người dạy trong một ngày: [{row, sh, items}]
export function workOf(rows, whoId, date) {
  const out = [];
  for (const row of rows) for (const sh of allShifts(row).filter((s) => s.date === date)) {
    const items = groupsOf(row, sh).filter((g) => String(g.who_id) === String(whoId)).flatMap((g) => g.items);
    if (items.length) out.push({ row, sh, items });
  }
  return out;
}

// Ô tổng: số người đang đào tạo, số ca trễ chưa chấm, số mục chờ kiểm tra
export const cards = (rows, today) => ({
  n: rows.length,
  tre: rows.reduce((s, r) => s + allShifts(r).filter((sh) => shiftState(r, sh, today) === 'tre').length, 0),
  kt: rows.reduce((s, r) => s + (r.items || []).filter((x) => x.state === 'cho_kt').length, 0),
});
