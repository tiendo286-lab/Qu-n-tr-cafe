// Đối soát ca (trang riêng, từng bước): Tiền → Nhân sự & bàn giao → Nhận hàng → Hoàn thành.
// Dùng chung giao diện với phiếu chốt ca (bản đối soát), phiếu nhân viên giữ nguyên ở #/ca/phieu.
import { render as phieu } from './phieu_ca.js';

export const perm = 'doi_soat';

export function render(ctx) {
  return phieu({ ...ctx, params: { ...ctx.params, __ds: '1' } });
}
