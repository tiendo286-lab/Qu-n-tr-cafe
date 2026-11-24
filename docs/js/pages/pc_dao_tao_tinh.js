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
  gs.forEach((g) => g.items.sort((a, b) => a.no - b.no));
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

// Việc của một người dạy trong một ngày: [{row, sh, items}]
export function workOf(rows, whoId, date) {
  const out = [];
  for (const row of rows) for (const sh of (row.shifts || []).filter((s) => s.date === date)) {
    const items = groupsOf(row, sh).filter((g) => String(g.who_id) === String(whoId)).flatMap((g) => g.items);
    if (items.length) out.push({ row, sh, items });
  }
  return out;
}

// Ô tổng: số người đang đào tạo, số ca trễ chưa chấm, số mục chờ kiểm tra
export const cards = (rows, today) => ({
  n: rows.length,
  tre: rows.reduce((s, r) => s + (r.shifts || []).filter((sh) => shiftState(r, sh, today) === 'tre').length, 0),
  kt: rows.reduce((s, r) => s + (r.items || []).filter((x) => x.state === 'cho_kt').length, 0),
});
