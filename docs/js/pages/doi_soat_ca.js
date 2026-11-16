// Đường dẫn cũ được giữ để thông báo và dấu trang không hỏng.
// Nội dung quản lý nay là bước Kiểm tra ngay trên chính Phiếu chốt ca.
import { render as phieu } from './phieu_ca.js';

export const perm = 'doi_soat';

export function render(ctx) {
  return phieu({ ...ctx, params: { ...ctx.params, __ds: '1' } });
}
