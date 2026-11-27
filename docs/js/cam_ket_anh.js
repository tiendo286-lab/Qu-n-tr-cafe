// Ảnh bản cam kết đã ký (tệp 189, anh Tiến chốt 27/11/2026). Kho riêng tư `cam-ket`, đường dẫn `<mã số nhân viên>/<tệp>`.
// Kế toán / người quản lý nhân viên tải · đổi · xoá; họ và chính nhân viên đó xem được (luật ở máy chủ).
import { sb } from './sb.js';
import { compressImage } from './tien.js';
import { dialog, html } from './ui.js';

export const CK_BUCKET = 'cam-ket';
export const CK_LABEL = { chua_ky: 'Chưa ký', da_ky_chua_nop: 'Đã ký, chưa nộp', da_ky_nop: 'Đã ký và nộp' };
export const CK_CSS = html`<style>
  dialog.ck-view { max-width: min(720px, 96vw); padding: 0; } .ck-vh { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--line); }
  .ck-vh b { overflow-wrap: anywhere; min-width: 0; } .ck-view img { display: block; max-width: 100%; max-height: 78vh; margin: 0 auto; }
  .ck-ph { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 6px; } .ck-ph .st-meta { flex: 1 1 100%; overflow-wrap: anywhere; }
  .ck-mine { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 10px 14px; }
</style>`;

// Nén rồi tải 1 ảnh; trả đường dẫn trong kho
export async function ckUpload(employeeId, file) {
  if (!/^image\//.test(file.type || '')) throw new Error('Chỉ nhận tệp ảnh (chụp hoặc chọn ảnh bản cam kết đã ký).');
  const blob = await compressImage(file);
  const path = `${employeeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb.storage.from(CK_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error('Không tải được ảnh: ' + error.message);
  return path;
}
// Gỡ tệp cũ khỏi kho (tệp mồ côi không chặn việc chính)
export async function ckDrop(path) {
  if (!path) return;
  try { await sb.storage.from(CK_BUCKET).remove([path]); } catch (_) { /* bỏ qua */ }
}
// Mở ảnh bằng đường dẫn tạm (1 giờ)
export async function ckView(path, title) {
  const { data, error } = await sb.storage.from(CK_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error('Không mở được ảnh bản cam kết.');
  const d = dialog(html`<div class="ck-vh"><b>${title}</b><button type="button" class="btn sm secondary" data-x aria-label="Đóng">✕</button></div><img src="${data.signedUrl}" alt="${title}">`);
  d.classList.add('ck-view');
  d.addEventListener('click', (e) => { if (e.target.closest('[data-x]') || e.target === d) d.close(); });
  return d;
}
