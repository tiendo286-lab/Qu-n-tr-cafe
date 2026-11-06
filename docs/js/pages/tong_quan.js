import { isManager } from '../app.js';
import { sb } from '../sb.js';
import { ROLE_LABELS, html } from '../ui.js';

async function count(table, q = (b) => b) {
  const { count: n, error } = await q(sb.from(table).select('*', { count: 'exact', head: true }));
  return error ? '—' : n;
}

export async function render({ me, can }) {
  if (!isManager()) {
    return {
      title: 'Lịch làm',
      html: html`<div class="card stack"><h2>Xin chào, ${me.name}</h2>
        <div>Order ca và xem lịch làm trên bản web mới sẽ có ở bước tiếp theo. Bạn đã đăng nhập thành công.</div></div>`,
    };
  }
  const [empActive, empTotal, weeks, rounds] = await Promise.all([
    count('employees', (b) => b.eq('status', 'Đang làm')),
    count('employees'),
    count('weeks'),
    can('danh_gia') ? count('evaluation_rounds') : Promise.resolve('—'),
  ]);
  const noPw = can('quan_ly_nhan_vien')
    ? await count('accounts', (b) => b.eq('has_password', 0).not('employee_id', 'is', null))
    : null;
  const empty = empTotal === 0;
  return {
    title: 'Tổng quan',
    html: html`
      <div class="page-head"><div><h1>Tổng quan</h1>
        <div class="sub">Xin chào, ${me.name} · ${ROLE_LABELS[me.role]} · Milano Coffee &amp; Lela Cafe</div></div></div>
      ${empty && can('du_lieu') ? html`<div class="alert warn">Chưa có dữ liệu. Vào <a href="#/quan-ly/du-lieu">Dữ liệu &amp; sao lưu</a> để nhập file dữ liệu từ bản offline hoặc bản web cũ.</div>` : ''}
      <div class="tiles">
        <a class="tile" href="#/quan-ly/nhan-vien" style="border-top-color:#2563eb"><div class="n">${empActive}</div><div class="l">Nhân viên đang làm (tổng ${empTotal})</div></a>
        <div class="tile" style="border-top-color:#0ea5e9"><div class="n">${weeks}</div><div class="l">Tuần làm việc</div></div>
        <div class="tile" style="border-top-color:#7c3aed"><div class="n">${rounds}</div><div class="l">Lần đánh giá</div></div>
        ${noPw !== null ? html`<a class="tile" href="#/quan-ly/tai-khoan?tt=chua_co" style="border-top-color:#9ca3af"><div class="n">${noPw}</div><div class="l">Nhân viên chưa có mật khẩu</div></a>` : ''}
      </div>
      <section class="card stack">
        <h2 style="margin:0">Bản web mới (GitHub Pages + Supabase)</h2>
        <div style="font-size:14px;line-height:1.7">
          ✅ Bước 1: đăng nhập, tài khoản, phân quyền, nhập dữ liệu<br>
          ⏳ Bước 2: nhân viên order ca, xem lịch, thông báo<br>
          ⏳ Bước 3: danh mục, định biên, lịch cố định, order, xếp lịch, cảnh báo, chốt tuần<br>
          ⏳ Bước 4: báo cáo &amp; Excel, đánh giá nhân viên &amp; voucher<br>
          ⏳ Bước 5: xuất gói ZIP cho bản offline, sao lưu
        </div>
        <div style="font-size:13px;color:var(--muted)">Các mục ghi “sắp có” trong menu sẽ lần lượt được mở.</div>
      </section>`,
  };
}
