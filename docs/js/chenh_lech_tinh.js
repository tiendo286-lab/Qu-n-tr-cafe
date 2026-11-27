// Bảng Chênh lệch tiền (anh Tiến 27/11/2026) — phép tính thuần, thử bằng jsc (kiem_tra/chenh_lech_tinh.mjs).
// KHÔNG tính lại tiền: lấy đúng dòng chênh lệch của Sổ thu chi (caGaps) và số phải có / thực tế của dayChain.
import { caGaps, dayChain } from './so_thu_chi_tinh.js';

export const CL_ST = {
  cho: ['Còn chênh lệch', 'warn'], chu: ['Chờ Chủ duyệt', 'plum'], xong: ['Đã xử lý', 'ok'], nho: ['Lệch nhỏ', 'mute'], tam: ['Số tạm', 'mute'],
};
const KIND = { quan_chiu: 'Quán chịu', thu_khac: 'Phiếu thu (Thu khác)', treo: 'Khoản treo' };

// Các cách đã xử lý của một dòng chênh lệch: [{ text, amount, wait, ref }] (ref = 'match:<id>' / 'qc:<id>' khi chờ Chủ duyệt)
export function handled(g) {
  if (!g) return [];
  return [
    ...(g.tl || []).map((t) => ({ text: 'Trừ lương ' + (t.name || ''), amount: Number(t.amount || 0), wait: false, ref: null })),
    ...(g.decisions || []).map((d) => ({ text: KIND[d.kind] || d.kind, amount: Number(d.amount || 0), wait: false, ref: null })),
    ...(g.debts || []).map((o) => ({ text: 'Gán nợ khách trả · ' + (o.who || ''), amount: Number(o.amount || 0), wait: false, ref: null })),
    ...(g.matches || []).map((m) => ({ text: 'Ghép với ' + (m.with || 'ca khác'), amount: Number(m.amount || 0), wait: m.status === 'cho_duyet', ref: m.status === 'cho_duyet' ? 'match:' + m.id : null })),
    ...(g.qc_wait || []).map((q) => ({ text: 'Quán chịu' + (q.by ? ' · ' + q.by + ' đề nghị' : ''), amount: Number(q.amount || 0), wait: true, ref: 'qc:' + q.id })),
  ];
}

// Dòng chênh lệch của một cơ sở trong tháng (D = sổ tháng của Sổ thu chi).
// Anh Tiến chốt 27/11/2026: ca quản lý ĐỐI SOÁT XONG (đã bấm Hoàn thành đối soát ca — ca.done) mới về bảng, với trạng thái Còn chênh lệch
// hoặc Đã xử lý. Ca chưa đối soát xong không vào bảng (all = true: lấy cả ca chưa xong — chỉ dùng để đếm / thử).
export function gapRows(D, { all = false } = {}) {
  const out = [];
  const chains = new Map();
  for (const c of D.cas || []) {
    if (!all && !c.done) continue;
    const gs = caGaps(D.items || [], c.id);
    if (!gs.length) continue;
    if (!chains.has(c.date)) chains.set(c.date, dayChain(D, c.date));
    const money = chains.get(c.date).get(c.id)?.money || {};
    for (const g of gs) {
      const x = g.x; const gap = x.gap || null; const mm = money[g.pm] || {};
      const hs = handled(gap);
      // ca chưa xác nhận xong phần tiền: số còn có thể đổi, chưa mở được phiếu chênh lệch → "Số tạm"
      // máy chủ chỉ ghi trạng thái + phiếu chênh lệch khi ca đã có dòng xử lý lệch; chưa có cả hai = ca chưa xác nhận xong phần tiền
      const st = g.small ? 'nho' : !gap && !x.status ? 'tam' : g.wait || hs.some((h) => h.wait) ? 'chu' : g.done ? 'xong' : 'cho';
      const left = st === 'xong' || st === 'nho' ? 0 : gap ? Number(gap.avail || 0) : Math.abs(g.amt);
      out.push({
        key: D.branch.id + ':' + x.id, id: x.id, branch_id: D.branch.id, branch: D.branch.code, ca_id: c.id, date: c.date, shift: c.shift || '', pm: g.pm,
        must: mm.must ?? null, real: mm.real ?? null, amt: g.amt, staff: (gap?.people || []).map((p) => p.name).join(', ') || c.staff || '',
        handled: hs, left, st, can_open: !!gap, note: String(x.status || '').replace(/\s*·\s*⏳ chờ Chủ duyệt/, ''), waits: hs.filter((h) => h.wait && h.ref).map((h) => h.ref),
      });
    }
  }
  return out;
}

const ORD = { cho: 0, chu: 1, tam: 2, xong: 3, nho: 4 };
const SH = { 'Sáng': 0, 'Chiều': 1, 'Tối': 2 };
// Chờ xử lý lên trước, rồi ngày mới nhất, ca muộn nhất
export const sortRows = (rows) => [...rows].sort((a, b) => ORD[a.st] - ORD[b.st] || (a.date < b.date ? 1 : a.date > b.date ? -1 : (SH[b.shift] ?? 9) - (SH[a.shift] ?? 9)) || String(a.branch).localeCompare(String(b.branch)) || (a.pm === b.pm ? 0 : a.pm === 'tm' ? -1 : 1));

// Lọc: f = { st: '' | cho | chu | xong | nho | tam, dir: '' | thieu | du, pm: '' | tm | ck }. st trống = mọi dòng TRỪ lệch nhỏ (ẩn sẵn)
export function filterRows(rows, f = {}) {
  return rows.filter((r) => (f.st ? r.st === f.st : r.st !== 'nho')
    && (!f.dir || (f.dir === 'thieu' ? r.amt < 0 : r.amt > 0)) && (!f.pm || r.pm === f.pm));
}

// Số ca CHƯA đối soát xong mà đang có lệch đáng kể (chưa vào bảng) — để ghi một dòng nhắc ở đầu bảng
export function waitingCas(D) {
  const ids = new Set(gapRows(D, { all: true }).filter((r) => r.st !== 'nho').map((r) => r.ca_id));
  return (D.cas || []).filter((c) => !c.done && ids.has(c.id)).length;
}

// Ô tổng (không tính lệch nhỏ vào thiếu / dư cần soát)
export function summary(rows) {
  const big = rows.filter((r) => r.st !== 'nho');
  const sum = (xs, f) => xs.reduce((s, r) => s + f(r), 0);
  const thieu = big.filter((r) => r.amt < 0), du = big.filter((r) => r.amt > 0);
  const cho = big.filter((r) => r.st === 'cho'), chu = big.filter((r) => r.st === 'chu'), tam = big.filter((r) => r.st === 'tam');
  const hs = big.flatMap((r) => r.handled.filter((h) => !h.wait));
  const by = (re) => sum(hs.filter((h) => re.test(h.text)), (h) => h.amount);
  return {
    n: big.length, nho: rows.length - big.length,
    thieu: { n: thieu.length, v: sum(thieu, (r) => -r.amt) }, du: { n: du.length, v: sum(du, (r) => r.amt) },
    cho: { n: cho.length, v: sum(cho, (r) => r.left) }, tam: { n: tam.length, v: sum(tam, (r) => Math.abs(r.amt)) },
    chu: { n: chu.reduce((s, r) => s + Math.max(1, r.waits.length), 0), v: sum(chu.flatMap((r) => r.handled.filter((h) => h.wait)), (h) => h.amount) },
    xong: { v: sum(hs, (h) => h.amount), tl: by(/^Trừ lương/), qc: by(/^Quán chịu/) },
  };
}
