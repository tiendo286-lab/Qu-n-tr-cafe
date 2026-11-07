// LOG hệ thống (chỉ Chủ): tài nguyên, phiên bản hiện tại, lịch sử cập nhật web, lịch sử thao tác (chỉ xem)
import { catalog, vnToday, addDays } from '../data.js';
import { rpc } from '../sb.js';
import { dmy, fmt } from '../tien.js';
import { $, html } from '../ui.js';

export const perm = 'phan_quyen';

const BUCKET_LABEL = { 'phieu-ca': 'Ảnh phiếu chốt ca', 'tai-lieu': 'Ảnh trong nội quy / quy trình', 'hoa-don': 'Hóa đơn & ảnh hàng nhận' };
const ACTION = {
  mo_phieu_chot_ca: 'Mở phiếu chốt ca', hoan_thanh_chot_ca: 'Hoàn thành chốt ca', mo_lai_phieu_ca: 'Mở lại phiếu cho nhân viên sửa', mo_lai_phieu_cho_nv: 'Bản đối soát làm lại (NV sửa phiếu gốc)',
  doi_soat_ca: 'Đánh dấu hạng mục đối soát', hoan_thanh_doi_soat: 'Hoàn thành đối soát', mo_lai_doi_soat: 'Mở lại đối soát', sua_ban_doi_soat: 'Sửa bản đối soát',
  doi_soat_cuoi_ngay: 'Đối soát tiền cuối ngày', ke_toan_sua_so_du: 'Kế toán sửa số dư', ke_toan_so_du: 'Kế toán lưu số dư', ke_toan_them_hoa_don: 'Kế toán thêm hóa đơn', ke_toan_them_tai_khoan: 'Thêm tài khoản nhận tiền', ke_toan_sua_tai_khoan: 'Sửa tài khoản nhận tiền', ke_toan_xoa_tai_khoan: 'Xóa tài khoản nhận tiền',
  ke_toan_xoa_hoa_don: 'Kế toán xóa hóa đơn', bao_nhan_hang: 'Báo nhận hàng',
  tao_tuan: 'Tạo tuần', sua_order: 'Sửa order', xoa_order_tuan: 'Xóa order tuần', bat_dau_xep_lich: 'Bắt đầu xếp lịch', xep_lich: 'Xếp lịch', xep_lich_tong: 'Xếp lịch tổng',
  xep_lich_tu_dong: 'Xếp lịch tự động', chot_tuan: 'Chốt tuần', mo_lai_tuan: 'Mở lại tuần', quay_lai_order: 'Quay lại order', gianh_quyen_xep: 'Giành quyền xếp', vuot_dinh_bien: 'Thêm vượt định biên',
  xoa_lich_tuan: 'Xóa lịch tuần', cap_nhat_order_vao_lich: 'Cập nhật order vào lịch',
  sua_cap_bac: 'Sửa cấp bậc', xoa_nhan_vien: 'Xóa nhân viên', doi_vai_tro: 'Đổi vai trò tài khoản', phan_quyen: 'Sửa phân quyền', sua_quyen: 'Sửa phân quyền',
  cap_mat_khau_tam: 'Cấp mật khẩu tạm', cap_mat_khau_hang_loat: 'Cấp mật khẩu hàng loạt', khoa_tai_khoan: 'Khóa tài khoản', mo_khoa_tai_khoan: 'Mở khóa tài khoản',
  dang_xuat_moi_thiet_bi: 'Đăng xuất mọi nơi', tao_tai_khoan: 'Tạo tài khoản riêng', xoa_tai_khoan: 'Xóa tài khoản',
  dang_tai_lieu: 'Đăng nội quy / quy trình', xoa_tai_lieu: 'Xóa tài liệu', danh_dau_doc_noi_quy: 'Đánh dấu đã đọc nội quy', cam_ket: 'Cập nhật cam kết',
  tao_phieu_dao_tao: 'Tạo phiếu đào tạo', xoa_phieu_dao_tao: 'Xóa phiếu đào tạo', xoa_cong_viec: 'Xóa công việc',
  cong_viec_tao: 'Tạo việc', cong_viec_giao: 'Giao việc', cong_viec_bat_dau: 'Nhận việc', cong_viec_bao_cao: 'Báo đã xử lý', cong_viec_lam_lai: 'Yêu cầu làm lại', cong_viec_sua: 'Sửa việc',
  nhap_du_lieu: 'Nhập dữ liệu', xuat_du_lieu_zip: 'Tải gói sao lưu', them_ca: 'Thêm ca', sua_ca: 'Sửa ca', xoa_ca: 'Xóa ca', xoa_co_so: 'Xóa cơ sở', them_vai_tro: 'Thêm vai trò', sua_vai_tro: 'Sửa vai trò',
};
const FIELD = {
  rev_start: 'Bắt đầu doanh thu', rev_end: 'Kết thúc doanh thu', total_revenue: 'Tổng doanh thu', pos_cash: 'Tiền mặt POS', pos_transfer: 'CK POS', reported_transfer: 'CK NV báo',
  cash_counted: 'Tiền két', opening_cash: 'Tiền đầu ca', cups: 'Số cốc', goods_status: 'Nhận hàng', goods_note: 'Ghi chú nhận hàng', moves: 'Thu chi', staff: 'Nhân viên', goods: 'Hàng thiếu',
  bank_opening: 'Số dư đầu', bank_closing: 'Số dư cuối', bank_transfers_out: 'Tiền chuyển ra', bank_note: 'Ghi chú kế toán',
};
const actLabel = (a) => ACTION[a] || a.replace(/_/g, ' ');
const OBJ = { report: 'Phiếu ca', invoice: 'Hóa đơn', task: 'Việc', week: 'Tuần', meeting: 'Cuộc họp', account: 'Tài khoản' };
const objLabel = (o) => { const m = /^([a-z]+)=(\d+)$/.exec(o || ''); return m ? `${OBJ[m[1]] || m[1]} #${m[2]}` : o || ''; };
const val = (v) => (v === null || v === undefined ? '(trống)' : Array.isArray(v) ? `${v.length} dòng` : typeof v === 'number' ? fmt(v) : String(v));
const size = (b) => (b === null || b === undefined ? 'Không có số liệu' : b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' KB');
const bar = (used, limit) => {
  const pct = Math.min(100, Math.round((used / limit) * 1000) / 10);
  return html`<div class="sys-bar" role="img" aria-label="Đã dùng ${pct}%"><div style="width:${pct}%;background:${pct > 80 ? '#dc2626' : pct > 60 ? '#f59e0b' : 'var(--ok-line)'}"></div></div><div class="st-meta">${size(used)} / ${size(limit)} · ${pct}%</div>`;
};
const releaseCard = (r, open) => html`<details class="card sys-rel" ${open ? 'open' : ''}><summary><strong>Phiên bản ${r.version}</strong> <span class="st-meta">· ${r.released_at} · ${r.released_by}</span></summary>
  ${[['Thêm', r.added], ['Thay đổi', r.changed], ['Sửa lỗi', r.fixed], ['Loại bỏ', r.removed]].filter(([, a]) => a && a.length).map(([t, a]) => html`<div class="sys-sub">${t}</div><ul>${a.map((x) => html`<li>${x}</li>`)}</ul>`)}</details>`;

export async function render({ params }) {
  const tab = ['phat-hanh', 'thao-tac'].includes(params.tab) ? params.tab : 'tong-quan';
  const nav = html`<nav class="tabs-nav" aria-label="LOG"><a class="${tab === 'tong-quan' ? 'on' : ''}" href="#/quan-ly/log">Tổng quan</a><a class="${tab === 'phat-hanh' ? 'on' : ''}" href="#/quan-ly/log?tab=phat-hanh">Lịch sử cập nhật web</a><a class="${tab === 'thao-tac' ? 'on' : ''}" href="#/quan-ly/log?tab=thao-tac">Lịch sử thao tác</a></nav>`;
  let body;
  if (tab === 'tong-quan') {
    const o = await rpc('app_sys_overview');
    body = html`<div class="grid2">
        <section class="card stack" style="gap:10px"><h2 style="margin:0">Tài nguyên</h2>
          <div class="st-meta">Giới hạn theo gói Supabase <strong>${o.plan}</strong>. Số liệu đọc trực tiếp từ máy chủ lúc ${o.now.slice(11, 16)}.</div>
          <div><strong>Cơ sở dữ liệu</strong>${bar(o.db_bytes, o.db_limit)}</div>
          <div><strong>Ảnh & tài liệu</strong>${bar(o.storage_bytes, o.storage_limit)}
            ${Object.keys(o.storage || {}).length ? html`<div class="kv" style="margin-top:6px">${Object.entries(o.storage).map(([k, v]) => html`<div>${BUCKET_LABEL[k] || k}</div><div>${size(v.bytes)} · ${v.files} tệp</div>`)}</div>` : ''}</div>
          <div class="kv"><div>RAM</div><div>Không có số liệu</div><div>Lưu lượng tải tháng này</div><div>Không có số liệu</div></div>
          <div class="st-meta">Web chạy trên GitHub Pages + Supabase nên không có "RAM chung" của cả hệ thống. Lưu lượng tải xem ở trang Supabase → Usage.</div></section>
        <section class="card stack" style="gap:10px"><h2 style="margin:0">Phiên bản hiện tại</h2>
          ${o.current ? html`<div style="font-size:22px;font-weight:700">${o.current.version}</div><div class="st-meta">Cập nhật ${o.current.released_at} · ${o.current.released_by}</div>${releaseCard(o.current, true)}` : html`<div>Không có số liệu</div>`}</section></div>`;
  } else if (tab === 'phat-hanh') {
    const list = await rpc('app_sys_releases');
    body = list.length ? html`${list.map((r, i) => releaseCard(r, i === 0))}` : html`<div class="card">Chưa có lần cập nhật nào được ghi.</div>`;
  } else {
    const today = vnToday();
    const from = params.tu || addDays(today, -7); const to = params.den || today;
    const who = params.ai ? Number(params.ai) : null; const br = params.cn ? Number(params.cn) : null; const act = params.loai || null;
    const lim = Number(params.n) || 300;
    const [L, cat] = await Promise.all([rpc('app_sys_log', { p_from: from, p_to: to, p_account: who, p_branch: br, p_action: act, p_limit: lim }), catalog()]);
    const detail = (r) => (r.field ? html`${FIELD[r.field] || r.field}: ${val(r.before)} → <strong>${val(r.after)}</strong>${r.note ? html` <span class="st-meta">· ${r.note}</span>` : ''}` : r.note && r.note !== r.object ? r.note : '');
    body = html`<section class="card toolbar" style="padding:12px 14px;gap:8px" id="lg-f">
        <label class="st-meta">Từ <input class="input sm" type="date" name="tu" value="${from}"></label>
        <label class="st-meta">đến <input class="input sm" type="date" name="den" value="${to}"></label>
        <select class="input sm" name="ai" aria-label="Người thực hiện"><option value="">Mọi người</option>${L.people.map((p) => html`<option value="${p.id}" ${p.id === who ? 'selected' : ''}>${p.name}</option>`)}</select>
        <select class="input sm" name="cn" aria-label="Cơ sở"><option value="">Mọi cơ sở</option>${cat.activeBranches.map((b) => html`<option value="${b.id}" ${b.id === br ? 'selected' : ''}>${b.display_code || b.code}</option>`)}</select>
        <select class="input sm" name="loai" aria-label="Loại thao tác"><option value="">Mọi thao tác</option>${[...L.actions].sort((a, b) => actLabel(a).localeCompare(actLabel(b), 'vi')).map((a) => html`<option value="${a}" ${a === act ? 'selected' : ''}>${actLabel(a)}</option>`)}</select>
        <span class="st-meta">${L.rows.length} dòng</span></section>
      <div class="st-meta">Nhật ký chỉ để xem — không sửa, không xóa được. Lọc theo cơ sở chỉ áp dụng cho thao tác gắn với phiếu chốt ca.</div>
      <section class="card flush"><div class="table-wrap"><table class="table"><thead><tr><th>Thời gian</th><th>Người</th><th>Thao tác</th><th>Đối tượng</th><th>Cơ sở</th><th>Chi tiết</th></tr></thead>
        <tbody>${L.rows.map((r) => html`<tr><td style="white-space:nowrap">${dmy(r.at.slice(0, 10))} ${r.at.slice(11, 16)}</td><td>${r.by || '—'}</td><td>${actLabel(r.action)}</td>
          <td>${r.link ? html`<a href="#${r.link}">${objLabel(r.object) || 'Mở'}</a>` : objLabel(r.object) || '—'}</td><td>${r.branch || '—'}</td><td style="font-size:13px;max-width:420px">${detail(r)}</td></tr>`)}</tbody></table></div></section>
      ${L.rows.length >= lim ? html`<div><a class="btn sm secondary" id="lg-more" href="#/quan-ly/log?${new URLSearchParams({ ...params, tab: 'thao-tac', n: String(lim + 300) }).toString()}">Xem thêm</a></div>` : ''}`;
  }
  return {
    title: 'LOG hệ thống',
    html: html`<style>
        .sys-bar { height: 10px; background: var(--line-soft); border-radius: 6px; overflow: hidden; margin: 6px 0 2px; }
        .sys-bar > div { height: 100%; }
        .sys-rel summary { cursor: pointer; } .sys-rel ul { margin: 4px 0 8px; padding-left: 20px; } .sys-rel li { margin: 2px 0; font-size: 14px; }
        .sys-sub { font-weight: 700; font-size: 13px; margin-top: 8px; color: var(--primary-dark); }
      </style>
      <div class="page-head"><div><h1>LOG hệ thống</h1><div class="sub">Chỉ Chủ hệ thống xem được.</div></div></div>
      <div class="stack" style="max-width:1100px;gap:12px">${nav}${body}</div>`,
    mount() {
      const f = $('#lg-f');
      if (f) f.addEventListener('change', () => {
        const o = { tab: 'thao-tac' };
        f.querySelectorAll('input, select').forEach((el) => { if (el.value) o[el.name] = el.value; });
        location.hash = '#/quan-ly/log?' + new URLSearchParams(o).toString();
      });
    },
  };
}
