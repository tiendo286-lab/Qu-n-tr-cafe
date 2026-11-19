// Hàm thuần kiểm giờ chốt ca (bước 162). Cùng luật + cùng chữ lỗi với máy chủ (tệp 144: app__ca_gio_check, app_ca_gio_save).
// g = kết quả app_ca_gio: { shift, rev_start, rev_end, fabi_close, by_fabi, fabi_bad, next: { shift, submitted, rev_start, rev_end } | null }
const RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const hm = (s) => (s ? String(s).slice(11, 16) : '');

function validTime(s) {
  const m = RE.exec(s || ''); if (!m) return false;
  const [, y, mo, d, h, mi] = m.map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d && dt.getUTCHours() === h && dt.getUTCMinutes() === mi;
}

export function gioCheck(g, newEnd, reason) {
  if (g && g.by_fabi) return 'Ca đã có file Fabi — giờ chốt lấy theo file.';
  if (!String(reason || '').trim()) return 'Phải ghi lý do sửa giờ.';
  if (!validTime(newEnd)) return 'Giờ chốt không hợp lệ.';
  if (g.rev_start && newEnd <= g.rev_start) return `Giờ chốt phải sau giờ bắt đầu ca (${hm(g.rev_start)}).`;
  const nx = g.next;
  if (nx && nx.submitted && nx.rev_end && newEnd >= nx.rev_end) return `Giờ chốt phải trước giờ chốt ca ${nx.shift} (${hm(nx.rev_end)}).`;
  return null;
}

export function gioPreview(g, newEnd) {
  const nx = g && g.next;
  if (!nx || !nx.submitted || !validTime(newEnd) || newEnd === nx.rev_start) return null;
  return `Ca ${nx.shift} đổi giờ bắt đầu: ${hm(nx.rev_start)} → ${hm(newEnd)}`;
}

export function gioFabiNote(g) {
  if (!g || !g.fabi_close) return null;
  if (g.by_fabi) return { txt: 'theo file Fabi', cls: 'ok' };
  if (g.fabi_bad) return { txt: `File Fabi: ${hm(g.fabi_close)} — không hợp lệ, sửa tay`, cls: 'off' };
  return null;
}
