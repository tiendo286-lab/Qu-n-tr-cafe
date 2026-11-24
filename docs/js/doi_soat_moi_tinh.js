// Trang đối soát ca mới — hàm thuần (đợt 1: chỉ xem). Không gọi máy chủ, không đụng giao diện: giao diện và bài thử dùng chung.
// Thiết kế: tai_lieu/superpowers/specs/2026-11-24-trang-doi-soat-ca-moi-design.md (mục 5.2). Bài thử: kiem_tra/doi_soat_moi_tinh_dot1.mjs (jsc -m).
// Số tiền tính bằng đúng hàm của Sổ thu chi (dayChain → caMoney) nên khớp trang đối soát cũ; danh sách mục kiểm lấy từ dsChecks / dsCtx.
import { dayChain, dsChecks, dsCtx } from './so_thu_chi_tinh.js';

// Chữ của từng mục kiểm (chép chữ đầu của CHK trong pages/so_thu_chi.js)
export const CHK_LABEL = {
  mo: 'Tiền mở ca khớp tiền ca trước để lại',
  dt: 'Doanh thu trên phiếu khớp máy Fabi',
  no: 'Nợ bill trên phiếu khớp máy Fabi',
  phanloai: 'Nợ khác của ca đã phân loại (Chủ / Người nhà / Kho tổng)',
  hd: 'Đã hỏi về hoá đơn bị sửa / xoá trên máy',
  anh: 'Ảnh phiếu Fabi in cuối ca đúng với số máy',
  cash: 'Đã đếm két và nhập tiền mặt thực nhận',
  ck: 'Chuyển khoản đã có số ngân hàng',
  goi: 'Két để lại đúng 1.000.000 cho ca sau',
  ket: 'Tiền đóng ca này bằng tiền mở ca sau',
  fabi: 'Đã Xác nhận Fabi',
  tn: 'Thu nợ đúng khách, đúng tiền mặt / chuyển khoản',
  sot: 'Không sót khoản thu ngoài bán hàng',
  cat: 'Mọi khoản chi đã chọn nhóm',
  that: 'Khoản chi là thật, đúng số tiền',
  lon: 'Đã xem kỹ khoản từ 300.000 trở lên',
  tm: 'Tiền mặt lệch đã chọn cách xử lý',
  ck5: 'Chuyển khoản lệch đã chọn cách xử lý',
  ld: 'Đã hỏi người làm ca lý do thiếu / thừa',
};
export const WORK_LABEL = { nhan_su: 'Nhân sự', ban_giao: 'Bàn giao', nhap_hang: 'Nhập hàng' };
// 4 ô cơ bản quản lý xác nhận khi bấm Hoàn thành (thiết kế mục 9.2); mục "fabi" do Hoàn thành mới tự làm
export const BASIC = ['anh', 'sot', 'that', 'goi'];

const KIND = { thu: { khac: 'Thu khác', no: 'Khách trả nợ', lc: 'Luân chuyển vào' }, chi: { chi: 'Chi', no: 'Cho nợ', lc: 'Luân chuyển ra' } };
const COLS = { thu: ['khac', 'no', 'lc'], chi: ['chi', 'no', 'lc'] };
const who = (x) => ((x.src === 'move' && x.edit) || /quản lý/i.test(x.meta || '') ? 'QL ghi' : 'NV ghi');   // như nhãn bước 3 / 4 trang cũ
const line = (x) => ({ id: x.id, kind: x.meta === 'Lương trả tiền mặt' ? 'Lương' : KIND[x.book][x.col], title: x.title || '',
  amount: Number(x.amount || 0), cat: x.cat || null, who: who(x), col: x.col });
const sum = (xs) => xs.reduce((a, x) => a + x.amount, 0);

// Sổ tiền mặt / chuyển khoản của một ca: mở ca → bán → từng khoản thu → từng khoản chi → phải có → thực nhận → lệch.
// D = kết quả app_stc_month (đã gán bill_list như Sổ thu chi), ca = một phần tử của D.cas.
export function caBook(D, ca) {
  const link = dayChain(D, ca.date).get(ca.id) || null;
  const mine = (D.items || []).filter((x) => !x.void && x.ca_id === ca.id);
  const kt = !!ca.kt_wait || ca.bank_ck == null;
  const one = (pm) => {
    const xs = mine.filter((x) => x.pm === pm);
    const m = link ? link.money[pm] : null;
    const start = pm === 'tm' ? (m ? m.start : Number(ca.start_tm || 0)) : 0;
    const ban = xs.filter((x) => x.col === 'dt').reduce((a, x) => a + Number(x.amount || 0), 0);
    const thu = xs.filter((x) => x.book === 'thu' && COLS.thu.includes(x.col)).map(line);
    const chi = xs.filter((x) => x.book === 'chi' && COLS.chi.includes(x.col)).map(line);
    const tongThu = sum(thu), tongChi = sum(chi);
    const must = start + ban + tongThu - tongChi;
    const real = pm === 'ck' && kt ? null : m ? m.real : null;
    return { pm, start, ban, thu, tongThu, chi, tongChi, must, real, gap: real == null ? null : real - must };
  };
  return { tm: one('tm'), ck: one('ck') };
}

const workLeft = (R, dsRow) => {
  const t = dsRow && dsRow.viec && Array.isArray(dsRow.viec.thieu) ? dsRow.viec.thieu : null;
  if (t) return t.slice();
  const ch = (R && R.checks) || {};
  return Object.keys(WORK_LABEL).filter((k) => !ch[k]).map((k) => WORK_LABEL[k]);
};
// Mục tiền chưa xong, bỏ "fabi" (Hoàn thành mới tự xác nhận) và 4 ô cơ bản (xác nhận khi bấm Hoàn thành)
const moneyLeft = (D, ca) => dsChecks(ca, dsCtx(D, ca)).flat().filter((x) => !x.ok && x.k !== 'fabi' && !BASIC.includes(x.k));

// Trạng thái 3 trang: ① Phần việc, ② Tiền (wait = chờ kế toán), đã Hoàn thành chưa.
export function pageState(D, ca, R, dsRow) {
  const left = workLeft(R, dsRow);
  const ml = moneyLeft(D, ca);
  return { viec: { ok: left.length === 0, left }, tien: { ok: ml.length === 0, left: ml.length, wait: !!ca.kt_wait || ca.bank_ck == null }, done: !!ca.done };
}

// Danh sách "Còn thiếu" ở trang Hoàn thành: việc phần việc trước, rồi mục tiền.
export function missingList(D, ca, R, dsRow) {
  return [...workLeft(R, dsRow).map((t) => ({ page: 'viec', k: 'viec', text: t })),
    ...moneyLeft(D, ca).map((x) => ({ page: 'tien', k: x.k, text: CHK_LABEL[x.k] || x.k }))];
}

// Điều quản lý xác nhận khi bấm Hoàn thành: 4 ô cơ bản ca có và chưa tích, theo thứ tự anh, sot, that, goi.
export function confirmList(D, ca) {
  const all = dsChecks(ca, dsCtx(D, ca)).flat();
  return BASIC.filter((k) => all.some((x) => x.k === k && !x.ok)).map((k) => CHK_LABEL[k]);
}

// Ca khớp hết: phần việc xong, mục tiền (trừ 4 ô cơ bản và Xác nhận Fabi) đều xanh, không chờ kế toán → mở thẳng trang Hoàn thành.
export function isClean(D, ca, R, dsRow) {
  const s = pageState(D, ca, R, dsRow);
  return s.viec.ok && s.tien.ok && !s.tien.wait;
}

// Đợt 3: phần việc sẽ duyệt khi bấm Duyệt phần việc / Hoàn thành — Nhân sự, Bàn giao, Nhập hàng chưa duyệt. Trang cũ duyệt Bàn giao + Nhập hàng cùng lúc,
// kể cả khi ca không có hàng (máy chủ chặn nếu còn hàng chưa đối soát). Nhận két lệch cần đếm lại: KHÔNG tự duyệt Bàn giao, báo việc cần làm.
// Chờ Chủ duyệt x2 không chặn (ca Hoàn thành được, thành Đã đối soát khi Chủ duyệt).
export function workParts(R) {
  const ch = (R && R.checks) || {};
  const recount = R?.cash_hand?.state === 'can_dem_lai';
  return {
    parts: ['nhan_su', 'ban_giao', 'nhap_hang'].filter((k) => !ch[k] && !(k === 'ban_giao' && recount)),
    blocked: !ch.ban_giao && recount ? ['Nhận két lệch: cùng người ca trước đếm lại'] : [],
  };
}
// Đợt 4: trang hiện phần việc theo BẢN ĐỐI SOÁT (app_ca_recon — quản lý đã sửa) như trang cũ (mergeRecon của phieu_ca.js), không theo phiếu gốc.
// Không đọc được bản đối soát (chưa có quyền / lỗi mạng) thì dùng phiếu như cũ.
export function mergeRecon(R0, RC) {
  if (!RC) return R0;
  const d = RC.data || {}; const emp = RC.employees || {};
  return { ...R0, ...d, moves: d.moves || [], goods: d.goods || [],
    staff: (d.staff || []).map((x) => ({ ...x, worked: x.worked ? 1 : 0, ...(emp[String(x.employee_id)] || {}) })) };
}
// Đợt 4: một người làm gửi lên app_ca_recon_save — đúng các trường máy chủ nhận (ô rỗng → null, không gửi tên / mã)
export function staffPayload(s) {
  const t = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());
  return { employee_id: Number(s.employee_id), source: s.source || 'lich', role: s.role || null, worked: !!(s.worked === undefined ? true : s.worked),
    time_in: t(s.time_in), time_out: t(s.time_out), absent_reason: t(s.absent_reason), note: t(s.note), cash_paid: Number(s.cash_paid) > 0 ? Number(s.cash_paid) : null };
}
// Đi lần lượt 3 bước (anh Tiến 24/11 chọn "Đi lần lượt từng bước"): ① Phần việc xong mới sang ② Tiền, ② xong mới sang ③ Hoàn thành.
// ① xong = không còn phần việc phải duyệt và không vướng (nhận két lệch cần đếm lại); chờ Chủ duyệt x2 không chặn.
// ② xong = mọi mục tiền xanh (trừ 4 ô cơ bản và Xác nhận Fabi — Hoàn thành tự làm), không chờ kế toán. Ca đã Hoàn thành: xem được cả 3 bước.
export function stepState(D, ca, R, dsRow) {
  const w = workParts(R); const done = !!(ca && ca.done);
  const viec = done || (!w.parts.length && !w.blocked.length);
  if (!ca || !D) return { viec, tien: done, xong: done, wait: false };
  const p = pageState(D, ca, R, dsRow);
  return { viec, tien: done || (p.tien.ok && !p.tien.wait), xong: done, wait: !done && p.tien.wait };
}
export const canStep = (st, k) => k === 'viec' || (k === 'tien' ? !!st.viec : !!(st.viec && st.tien));
export const firstStep = (st) => (st.xong ? 'xong' : !st.viec ? 'viec' : !st.tien ? 'tien' : 'xong');
// Bước ② còn thiếu gì (chữ của từng mục tiền chưa xong, bỏ 4 ô cơ bản và Xác nhận Fabi)
export const moneyLeftList = (D, ca) => moneyLeft(D, ca).map((x) => CHK_LABEL[x.k] || x.k);
// Chênh lệch tiền mặt / chuyển khoản của ca xử lý thế nào (anh Tiến 24/11 "muốn hiện rõ"): thiếu / dư bao nhiêu, từng cách xử lý một dòng,
// còn lại bao nhiêu, trạng thái. x = dòng 'lech' của sổ tháng (x.gap do app_stc_month dựng: tl, decisions, matches, qc_wait, debts, remain, avail).
// state: nho (≤ 5.000, coi như khớp) · xong (đã xử lý hết) · cho_duyet (phần còn lại chờ Chủ duyệt) · de_sau (đã bấm Để sau) · chua.
const GAP_DC = { quan_chiu: 'Quán chịu', thu_khac: 'Ghi Thu khác', treo: 'Khoản treo' };   // như GAP_DC của Sổ thu chi
const TL_ST = { tru_luong: 'trừ lương', da_bu: 'đã nộp bù', mien: 'miễn' };   // như TL_ST của Sổ thu chi
export function gapView(x, ticks = []) {
  const g = x.gap || {}; const pm = x.pm === 'ck' ? 'ck' : 'tm';
  const kind = g.kind === 'du' || (g.kind !== 'thieu' && x.book === 'thu') ? 'du' : 'thieu';
  const lines = [];
  (g.tl || []).filter((t) => t.status !== 'huy').forEach((t) => lines.push({ how: 'Trừ lương', who: t.name || '', amount: Number(t.amount || 0), note: TL_ST[t.status] || 'chờ xử lý' }));
  (g.decisions || []).forEach((d) => lines.push({ how: GAP_DC[d.kind] || d.kind, who: '', amount: Number(d.amount || 0), note: '' }));
  (g.matches || []).forEach((m) => lines.push({ how: 'Ghép với ' + (m.with || 'ca khác'), who: '', amount: Number(m.amount || 0), note: m.status === 'cho_duyet' ? 'chờ Chủ duyệt' : '' }));
  (g.qc_wait || []).forEach((q) => lines.push({ how: 'Quán chịu', who: '', amount: Number(q.amount || 0), note: 'chờ Chủ duyệt' + (q.by ? ' · ' + q.by + ' đề nghị' : '') }));
  (g.debts || []).forEach((d) => lines.push({ how: 'Gán nợ khách', who: d.who || '', amount: Number(d.amount || 0), note: '' }));
  const small = /Lệch nhỏ/.test(x.status || '');
  const remain = small ? 0 : Math.max(Number(g.remain ?? x.amount ?? 0), 0);
  const avail = Math.max(Number(g.avail ?? remain), 0);
  const sau = (ticks || []).includes('sau_' + pm);
  const state = small ? 'nho' : remain <= 0 ? 'xong' : avail <= 0 ? 'cho_duyet' : sau ? 'de_sau' : 'chua';
  return { pm, kind, total: Number(g.total ?? x.gross ?? x.amount ?? 0), lines, remain, state };
}
// Đợt 3: mã các ô cơ bản quản lý xác nhận khi bấm Hoàn thành (cùng danh sách, cùng thứ tự với confirmList) — gửi lên app_ds2_finish
export function confirmKeys(D, ca) {
  const all = dsChecks(ca, dsCtx(D, ca)).flat();
  return BASIC.filter((k) => all.some((x) => x.k === k && !x.ok));
}
