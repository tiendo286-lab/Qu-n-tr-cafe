// Tổng quan (trang chủ quản lý), giống màn TỔNG QUAN của bản offline
import { isManager, state } from '../app.js';
import { addDays, closure, focusWeek, getWeek, hasPublished, orderWindow, remaining, statusLabel, vnToday, weekLabel, weekStart } from '../data.js';
import { sb, sel, selAll } from '../sb.js';
import { ROLE_LABELS, go, html } from '../ui.js';

async function count(table, q = (b) => b) {
  const { count: n, error } = await q(sb.from(table).select('*', { count: 'exact', head: true }));
  return error ? '—' : n;
}

export async function render({ me, can }) {
  if (!isManager()) { go('/order'); return { title: 'Lịch làm', html: html`` }; }
  const [empActive, empTotal, staffCells, fixedMembers] = await Promise.all([
    count('employees', (b) => b.eq('status', 'Đang làm')), count('employees'),
    count('staffing_requirements', (b) => b.gt('required_count', 0)), count('fixed_schedule_members'),
  ]);
  const noPw = can('quan_ly_nhan_vien') ? await count('accounts', (b) => b.eq('has_password', 0).not('employee_id', 'is', null)) : null;
  const fw = await focusWeek();
  const start = fw ? fw.start_date : addDays(weekStart(vnToday()), 7);
  const week = fw || await getWeek(start);
  let wk = null;
  if (week) {
    const [win, cl, published, subs, ords, assigned, active] = await Promise.all([
      orderWindow(week.id), closure(week.id), hasPublished(week.id),
      sel('order_submissions', 'employee_id', (b) => b.eq('week_id', week.id)),
      can('xem_tat_ca') ? sel('order_entries', 'employee_id', (b) => b.eq('week_id', week.id).in('status', ['ĐI LÀM ĐƯỢC', 'NGHỈ'])) : Promise.resolve([]),
      can('xem_tat_ca') ? count('weekly_schedule_entries', (b) => b.eq('week_id', week.id).eq('state', 'ĐÃ XẾP')) : Promise.resolve('—'),
      selAll('employees', 'id', (b) => b.eq('status', 'Đang làm')),
    ]);
    // Chỉ đếm nhân viên đang làm (người đã nghỉ vẫn có thể còn order cũ)
    const activeIds = new Set(active.map((e) => e.id));
    const submitted = new Set([...subs.map((x) => x.employee_id), ...ords.map((x) => x.employee_id)].filter((id) => activeIds.has(id))).size;
    wk = { win, cl, label: statusLabel(cl?.status, published), submitted, assigned };
  }
  const empty = empTotal === 0;
  return {
    title: 'Tổng quan',
    html: html`
      <div class="page-head"><div><h1>Tổng quan</h1><div class="sub">Xin chào, ${me.name} · ${ROLE_LABELS[me.role]} · Milano Coffee &amp; Lela Cafe</div></div></div>
      ${empty && can('du_lieu') ? html`<div class="alert warn">Chưa có dữ liệu. Thêm nhân viên ở <a href="#/quan-ly/nhan-vien">Nhân viên &amp; tài khoản</a>, rồi tạo tuần ở <a href="#/quan-ly/order">Xếp lịch tuần → Order</a>.</div>` : ''}
      <div class="tiles">
        <a class="tile" href="#/quan-ly/nhan-vien" style="border-top-color:#2563eb"><div class="n">${empActive}</div><div class="l">Nhân viên đang làm (tổng ${empTotal})</div></a>
        <a class="tile" href="#/quan-ly/dinh-bien" style="border-top-color:#0ea5e9"><div class="n">${staffCells}</div><div class="l">Ô định biên đã khai báo</div></a>
        <a class="tile" href="#/quan-ly/lich-co-dinh" style="border-top-color:#f59e0b"><div class="n">${fixedMembers}</div><div class="l">Nhân viên có lịch cố định</div></a>
        ${noPw !== null ? html`<a class="tile" href="#/quan-ly/nhan-vien?tk=chua_co" style="border-top-color:#9ca3af"><div class="n">${noPw}</div><div class="l">Nhân viên chưa có mật khẩu</div></a>` : ''}
      </div>
      <div class="grid2">
        <section class="card stack">
          <h2 style="margin:0">Tuần ${weekLabel(start)}</h2>
          ${!week ? html`<div>Tuần này chưa được tạo.</div>${can('xem_tat_ca') ? html`<div><a class="btn sm" href="#/quan-ly/order?tuan=${start}">Tạo tuần ở Order lịch làm</a></div>` : ''}`
          : html`<div class="kv">
              <div>Order</div><div>${wk.win.state === 'dang_mo' ? html`<span class="pill ok">Đang mở</span> ${remaining(wk.win.close, wk.win.now)}` : wk.win.state === 'chua_mo' ? html`<span class="pill mute">Chưa mở</span> mở lúc ${wk.win.open_text}` : html`<span class="pill off">Đã hết hạn</span> ${wk.win.close_text}`}</div>
              <div>Đã order</div><div><strong>${wk.submitted}</strong> / ${empActive} nhân viên</div>
              <div>Lịch</div><div><span class="pill warn">${wk.label}</span></div>
              <div>Ca đã xếp</div><div><strong>${wk.assigned}</strong></div>
              ${can('xep_lich') ? html`<div>Cảnh báo</div><div><a href="#/quan-ly/canh-bao?tuan=${start}"><strong>${state.warn}</strong></a></div>` : ''}</div>
            <div class="toolbar">
              ${can('xem_tat_ca') ? html`<a class="btn sm" href="#/quan-ly/order?tuan=${start}">Order lịch làm</a><a class="btn sm secondary" href="#/quan-ly/lich-co-so?tuan=${start}">Lịch cơ sở</a>` : ''}
              ${can('bao_cao') ? html`<a class="btn sm secondary" href="#/quan-ly/lich-tong?tuan=${start}">Lịch tổng</a><a class="btn sm secondary" href="#/quan-ly/bao-cao?tuan=${start}">Chốt &amp; báo cáo</a>` : ''}</div>`}
        </section>
        <section class="card stack"><h2 style="margin:0">Cá nhân</h2>
          <div class="toolbar">
            ${me.employee_id ? html`<a class="btn sm" href="#/order">Order ca của tôi</a><a class="btn sm secondary" href="#/lich">Lịch của tôi</a>` : ''}
            <a class="btn sm secondary" href="#/thong-bao">Thông báo${state.unread ? ` (${state.unread})` : ''}</a>
            <a class="btn sm secondary" href="#/doi-mat-khau">Đổi mật khẩu</a></div></section>
      </div>`,
  };
}
