// Trang Đào tạo gộp (anh Tiến 28/11/2026): hàm thuần lọc + xếp danh sách người có phiếu. Không đụng DOM, chạy được bằng jsc.
// Dòng (row) lấy từ app_dt_work_list: { id, employee, branch, program, instructor, status, due, n_check } (+ n_todo do trang tính từ bảng theo ca).
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

// F = { q, cs, prog, hd, st } — chuỗi rỗng = không lọc. Không chọn trạng thái thì ẨN người đã hoàn thành.
export function matchRow(row, F = {}, skipSt = false) {
  const q = norm(F.q);
  if (q && !norm(row.employee).includes(q)) return false;
  if (F.cs && (row.branch || '') !== F.cs) return false;
  if (F.prog && (row.program || '') !== F.prog) return false;
  if (F.hd && (row.instructor || '') !== F.hd) return false;
  if (skipSt) return true;
  return F.st ? row.status === F.st : row.status !== 'hoan_thanh';
}

// Số người theo từng trạng thái (cho nút lọc) — tính trên các dòng khớp phần CÒN LẠI của bộ lọc, nên bấm nút trạng thái không làm số đổi.
export function chipCounts(rows, F = {}) {
  const out = {};
  for (const r of rows || []) if (matchRow(r, F, true)) out[r.status] = (out[r.status] || 0) + 1;
  return out;
}

const need = (r) => Number(r.n_check || 0) + Number(r.n_todo || 0);
// Việc cần làm (chờ kiểm tra / ca chưa giao) lên đầu, đã hoàn thành xuống cuối, rồi theo hạn.
export function sortRows(rows) {
  return [...(rows || [])].sort((a, b) => (need(b) > 0) - (need(a) > 0)
    || (a.status === 'hoan_thanh') - (b.status === 'hoan_thanh')
    || String(a.due || '').localeCompare(String(b.due || ''))
    || Number(a.id) - Number(b.id));
}

export const optionsOf = (rows, key) => [...new Set((rows || []).map((r) => r[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'vi'));
