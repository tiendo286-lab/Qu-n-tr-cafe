// Đọc / ghi Excel ngay trên trình duyệt (SheetJS). Chuyển từ excel_io.py của bản offline 1.7.6.
import { RANKS, WEEKDAYS } from './data.js';
import { loadScript } from './ui.js';

const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
export async function xlsx() { await loadScript(XLSX_URL); return window.XLSX; }

export const normText = (v) => String(v ?? '').trim().split(/\s+/).filter(Boolean).join(' ');
export function normKey(v) {
  let t = normText(v).toUpperCase().replace(/Đ/g, 'D').replace(/đ/g, 'd');
  t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return t.replace(/[^A-Z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).join(' ');
}

// Đọc sheet đầu tiên (xlsx hoặc csv) → mảng các dòng
export async function readRows(file) {
  const X = await xlsx();
  const buf = await file.arrayBuffer();
  let wb;
  try { wb = X.read(buf, { type: 'array', cellDates: false, raw: false }); } catch (e) { throw new Error('Không mở được file: ' + e.message); }
  if (!wb.SheetNames.length) throw new Error('File không có sheet dữ liệu.');
  return X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, raw: false });
}

// Tải một file Excel nhiều sheet: sheets = [{name, rows: [[...]], widths?: [..]}]
export async function downloadXlsx(filename, sheets) {
  const X = await xlsx();
  const wb = X.utils.book_new();
  for (const s of sheets) {
    const ws = X.utils.aoa_to_sheet(s.rows);
    const ncol = Math.max(...s.rows.map((r) => r.length), 1);
    ws['!cols'] = s.widths ? s.widths.map((w) => ({ wch: w }))
      : Array.from({ length: ncol }, (_, c) => ({ wch: Math.min(Math.max(...s.rows.map((r) => String(r[c] ?? '').split('\n').reduce((m, l) => Math.max(m, l.length), 0)), 8) + 3, 40) }));
    if (s.freeze) ws['!freeze'] = s.freeze;
    X.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  X.writeFile(wb, filename);
}

// ---------------- Nhân viên
export function parseEmployeeRows(rows, validBranchCodes, validRoles) {
  if (!rows.length) throw new Error('File không có dữ liệu.');
  const header = rows[0].map(normKey);
  const aliases = {
    code: ['MA NV', 'MA NHAN VIEN', 'MANV'], name: ['TEN NHAN VIEN', 'TEN NV', 'HO VA TEN'], rank: ['PHAN CAP', 'CAP BAC'],
    status: ['TRANG THAI'], branches: ['CO SO LAM VIEC', 'CO SO'], roles: ['VI TRI DAM NHIEM', 'VI TRI', 'BO PHAN'],
  };
  const idx = {};
  for (const [k, cands] of Object.entries(aliases)) {
    idx[k] = header.findIndex((h) => cands.includes(h));
    if (idx[k] < 0) throw new Error('Thiếu cột bắt buộc: ' + cands[0]);
  }
  const valid = new Set([...validBranchCodes].map((x) => String(x).trim().toUpperCase()));
  const roleByKey = new Map(validRoles.map((r) => [normKey(r), r]));
  const result = []; const errors = [];
  rows.slice(1).forEach((row, i) => {
    const n = i + 2; const g = (k) => normText(row[idx[k]]);
    const code = g('code'); const name = g('name');
    if (!code && !name) return;
    const rank = g('rank'); const status = g('status');
    const branches = g('branches').split(/[,;/|]+/).map((x) => x.trim().toUpperCase()).filter(Boolean).map((x) => (x === 'LELA' ? 'LL' : x));
    const roles = [];
    for (const it of g('roles').split(/[,;/|]+/)) {
      const k = normKey(it); if (!k) continue;
      const r = roleByKey.get(k) || normText(it);
      if (!roles.includes(r)) roles.push(r);
    }
    const errs = [];
    if (!code) errs.push('thiếu Mã NV');
    if (!name) errs.push('thiếu Tên nhân viên');
    if (!RANKS.includes(rank)) errs.push(`Phân cấp không hợp lệ: ${rank || '(trống)'}`);
    if (!['Đang làm', 'Ngừng làm'].includes(status)) errs.push(`Trạng thái không hợp lệ: ${status || '(trống)'}`);
    const badB = branches.filter((b) => !valid.has(b));
    if (badB.length) errs.push('Cơ sở không hợp lệ: ' + badB.join(', '));
    if (!branches.length) errs.push('chưa chọn cơ sở');
    const badR = roles.filter((r) => !validRoles.includes(r));
    if (badR.length) errs.push('Vị trí không hợp lệ: ' + badR.join(', '));
    if (!roles.length) errs.push('chưa chọn vị trí');
    if (errs.length) errors.push(`Dòng ${n}: ${errs.join('; ')}`);
    else result.push({ code, name, rank, status, branches, roles });
  });
  if (errors.length) throw new Error('File nhân viên có dữ liệu chưa đúng:\n' + errors.slice(0, 10).join('\n') + (errors.length > 10 ? `\n... và ${errors.length - 10} lỗi khác` : ''));
  if (!result.length) throw new Error('Không tìm thấy dòng nhân viên hợp lệ.');
  return result;
}

export const EMPLOYEE_TEMPLATE = [
  ['Mã NV', 'Tên nhân viên', 'Phân cấp', 'Trạng thái', 'Cơ sở làm việc', 'Vị trí đảm nhiệm'],
  ['012', 'Nguyễn Văn A', 'Cấp 1', 'Đang làm', 'LL', 'Pha chế, Chạy bàn'],
  ['031', 'Trần Thị B', 'Cấp 2', 'Đang làm', 'LHP, ĐK', 'Chạy bàn'],
];
export const EMPLOYEE_GUIDE = [
  ['Mục', 'Hướng dẫn'],
  ['Cơ sở làm việc', 'Nhập mã cơ sở (vd LHP, ĐK, HS, LL). Một người làm nhiều cơ sở thì phân cách bằng dấu phẩy.'],
  ['Vị trí đảm nhiệm', 'Nhập Pha chế, Chạy bàn hoặc Pha chế, Chạy bàn.'],
  ['Phân cấp', 'Chỉ dùng Quản lý, Cấp 1, Cấp 2 hoặc Thử việc.'],
  ['Trạng thái', 'Đang làm hoặc Ngừng làm.'],
  ['Mã NV', 'Nhân viên trùng mã sẽ được cập nhật, mã mới sẽ được thêm.'],
];

// ---------------- Order / câu trả lời Google Form
function headerTargets(day, shift) {
  const dk = normKey(WEEKDAYS[day]); const sk = normKey(shift);
  const a = new Set([`${dk} CA ${sk}`, `${dk} ${sk}`]);
  if (day < 6) { a.add(`T${day + 2} CA ${sk}`); a.add(`T${day + 2} ${sk}`); }
  else { a.add(`CN CA ${sk}`); a.add(`CN ${sk}`); a.add(`CHU NHAT CA ${sk}`); }
  return a;
}
function findOrderCol(header, day, shift) {
  const t = headerTargets(day, shift);
  const exact = header.findIndex((h) => t.has(h));
  if (exact >= 0) return exact;
  const sk = normKey(shift); const dl = normKey(WEEKDAYS[day]); const ds = day < 6 ? `T${day + 2}` : 'CN';
  return header.findIndex((h) => {
    const p = ` ${h} `;
    return (h.includes(dl) || p.includes(` ${ds} `)) && (p.includes(` CA ${sk} `) || h.endsWith(` CA ${sk}`));
  });
}
function orderStatus(v) {
  const k = normKey(v);
  if (['DI LAM DUOC', 'CO THE DI LAM', 'DI LAM'].includes(k)) return 'ĐI LÀM ĐƯỢC';
  if (['NGHI', 'OFF', 'KHONG DI LAM DUOC', 'KHONG THE DI LAM'].includes(k)) return 'NGHỈ';
  throw new Error(`Giá trị ca không hợp lệ: ${normText(v) || '(trống)'}`);
}

// Quy tắc bản offline: Mã NV gửi đúng 1 lần → nhập; gửi ≥2 lần → không nhập (giữ Chưa order); không gửi → Chưa order.
export function parseFormResponses(rows, shifts) {
  if (!rows.length) throw new Error('File câu trả lời Form không có dữ liệu.');
  const header = rows[0].map(normKey);
  const codeIdx = header.findIndex((h) => ['MA NV', 'MA NHAN VIEN', 'MANV'].includes(h));
  const choiceIdx = header.findIndex((h) => ['CHON NHAN VIEN', 'NHAN VIEN', 'HO VA TEN', 'TEN NHAN VIEN'].includes(h));
  if (codeIdx < 0 && choiceIdx < 0) throw new Error('File Form phải có cột Mã NV hoặc CHỌN NHÂN VIÊN.');
  if (!shifts.length) throw new Error('Hiện chưa có ca làm việc nào đang sử dụng.');
  const cols = {};
  for (let d = 0; d < 7; d++) for (const s of shifts) {
    const c = findOrderCol(header, d, s);
    if (c < 0) throw new Error(`Thiếu cột Form: ${WEEKDAYS[d]} – Ca ${s}`);
    cols[`${d}|${s}`] = c;
  }
  const subs = []; const missing = [];
  rows.slice(1).forEach((row, i) => {
    const n = i + 2;
    if (!row.some((v) => normText(v))) return;
    let code = codeIdx >= 0 ? normText(row[codeIdx]) : '';
    if (!code && choiceIdx >= 0) code = normText(String(normText(row[choiceIdx])).split(/\s*[–—-]\s*/)[0]);
    if (!code) { missing.push(n); return; }
    const statuses = {}; let error = '';
    for (const [k, c] of Object.entries(cols)) {
      try { statuses[k] = orderStatus(row[c]); } catch (e) { const [d, s] = k.split('|'); error = `Dòng ${n}, ${WEEKDAYS[d]} ca ${s}: ${e.message}`; break; }
    }
    subs.push({ code, statuses, error });
  });
  if (!subs.length && !missing.length) throw new Error('Không tìm thấy câu trả lời nhân viên trong file Form.');
  const byCode = new Map();
  for (const s of subs) { const k = s.code.toLowerCase(); if (!byCode.has(k)) byCode.set(k, []); byCode.get(k).push(s); }
  const duplicates = []; const valid = []; const invalid = [];
  for (const items of byCode.values()) {
    if (items.length >= 2) { duplicates.push(items[0].code); continue; }
    if (items[0].error) invalid.push(items[0].error); else valid.push(items[0]);
  }
  if (missing.length) invalid.push('Các dòng không xác định được Mã NV: ' + missing.join(', '));
  return { valid, duplicates, invalid, submissionCount: subs.length + missing.length };
}

export function orderTemplate(shifts) {
  const head = ['Mã NV', 'Tên nhân viên'];
  for (const d of WEEKDAYS) for (const s of shifts) head.push(`${d.toUpperCase()} [CA ${s.toUpperCase()}]`);
  const n = 7 * shifts.length;
  return [head, ['NV01', 'NGUYỄN VĂN A', ...Array(n).fill('ĐI LÀM ĐƯỢC')], ['NV02', 'TRẦN VĂN B', ...Array(n).fill('NGHỈ')]];
}
