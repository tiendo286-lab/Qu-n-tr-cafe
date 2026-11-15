// Quy ước hiển thị; trạng thái nghiệp vụ do máy chủ quyết định.
export const SOURCES = {
  recon: ['Đối soát ca', 'Phiếu hoàn thành đối soát'], accounting: ['Đầu vào kế toán', 'Đủ file Fabi và số ngân hàng'],
  goods_recon: ['Đối soát hàng hóa', 'Quản lý xác nhận xong lần giao'], goods_bill: ['Hóa đơn giao còn thiếu', 'Có hóa đơn giao hoặc hóa đơn bù'],
  goods_photo: ['Ảnh hàng còn thiếu', 'Mọi món thực nhận có ảnh bằng chứng'],
  goods_followup: ['Giao bù & hóa đơn bổ sung', 'Hồ sơ theo dõi xong hoặc hủy có lý do'],
  doc_read: ['Nhân viên đọc tài liệu', 'Nhân viên xác nhận đúng phiên bản'], doc_followup: ['Đôn đốc đọc tài liệu', 'Tất cả nhân viên xác nhận đúng phiên bản'],
  commitment: ['Cam kết nhân viên', 'Hồ sơ ghi nhận đã ký và nộp đủ'], training: ['Đào tạo nhân viên', 'Đạt điều kiện trên phiếu đào tạo'],
  recurring: ['Việc định kỳ', 'Báo kết quả; xác nhận nếu được yêu cầu'],
};
export const STATES = { unassigned: ['Chờ phân công', 'off'], waiting: ['Chờ nhận', 'warn'], working: ['Đang làm', 'info'], blocked: ['Chờ đầu vào', 'mute'], review: ['Chờ xác nhận', 'warn'], done: ['Hoàn thành', 'ok'], cancelled: ['Đã hủy', 'mute'] };
export function stateOf(t) {
  if (t.cancelled_at) return 'cancelled';
  if (t.status === 'hoan_thanh') return 'done';
  if (t.status === 'cho_duyet') return 'review';
  if (!t.assignee_id || t.status === 'chua_phan_cong') return 'unassigned';
  if (t.source_state?.blocked) return 'blocked';
  return t.status === 'da_giao' ? 'waiting' : 'working';
}
export const isOverdue = (t, now) => !['done', 'cancelled'].includes(stateOf(t)) && !!t.due_date && `${t.due_date} ${t.due_time || '23:59'}` < now.slice(0, 16);
export const isSourceTask = (t) => !!t.cv_kind && t.cv_kind !== 'recurring';
export const sourceLabel = (t) => SOURCES[t.cv_kind]?.[0] || (t.handover_item_id ? 'Bàn giao ca' : 'Việc một lần');
export const validSourceLink = (s) => /^\/(?!\/)[^<>"\s]*$/.test(s || '') ? s : '';
