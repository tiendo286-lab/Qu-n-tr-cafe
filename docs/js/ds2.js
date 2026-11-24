// Trang đối soát ca mới (#/ca/doi-soat-moi) — luật mới của máy chủ tệp 173: sửa tự do tới khi Hoàn thành.
// Khi đang ở trang mới, rpc() đổi các hàm sửa tiền sang bản app_ds2_* (đặt cờ luật mới rồi gọi đúng hàm cũ); trang khác giữ hàm cũ (luật cũ).
// Dùng chung cho sb.js (web thật) và máy chủ giả của bài thử (kiem_tra/trinh_duyet/sb_gia.js). Bài thử: kiem_tra/doi_soat_moi_tinh_dot2.mjs.
// Đợt 4 (anh Tiến 24/11 "đổi toàn bộ sang trang mới"): #/ca/doi-soat mở trang mới (trang cũ dự phòng ở #/ca/doi-soat-cu — giữ luật cũ)
export const DS2_PAGES = ['#/ca/doi-soat', '#/ca/doi-soat-moi'];
export const DS2_PAGE = DS2_PAGES[0];
export const DS2 = new Set([
  'app_stc_ds_fabi', 'app_stc_ds_cash', 'app_stc_ds_blame', 'app_stc_ds_blame_undo',
  'app_stc_fix_request', 'app_stc_fix_cancel', 'app_stc_fix_decide',
  'app_stc_move_save', 'app_stc_move_exchange', 'app_stc_move_exchange_delete',
  'app_ca_recon_debt_collect', 'app_ca_recon_debt_uncollect',
]);
const onPage = (hash) => DS2_PAGES.includes(String(hash || '').split('?')[0]);
export function ds2Name(name, hash) {
  return DS2.has(name) && onPage(hash) ? name.replace(/^app_(stc|ca_recon)_/, 'app_ds2_') : name;
}
