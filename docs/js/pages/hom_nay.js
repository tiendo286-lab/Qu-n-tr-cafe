// Việc hôm nay (bước 62, làm lại bước 138): trang đầu của cả 5 vai trò — ca của tôi hôm nay, việc của tôi, theo dõi, bảng lương của tôi.
// Mỗi nguồn dữ liệu hỏi cùng lúc; nguồn nào lỗi thì chỉ phần đó báo, các khối khác vẫn hiện.
import { render as rerender, state } from '../app.js';
import { rpc } from '../sb.js';
import { dmy, vnd } from '../tien.js';
import { $, ROLE_LABELS, html } from '../ui.js';
import { gvDue, jobName, learnJobs, pcDue, rstate } from '../cv_chung.js?v=2026.11.18.8';
import { GROUP_LABEL, collectWork } from '../hom_nay_viec.js?v=2026.11.18.8';
import { KA_STATUS } from './phieu_ca.js';

const h2 = (n) => (Number(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const soft = (p) => p.catch(() => null);
const REPORT = { hoan_thanh: 'Đã gửi phiếu chốt ca' };

function caBlock(T, can) {
  let body;
  if (!T) body = html`<div class="alert warn">Chưa tải được ca hôm nay.</div>`;
  else if (!T.has_employee) body = html`<div class="sub">Tài khoản này không gắn nhân viên nên không có ca.</div>`;
  else if (!T.shifts.length) body = html`<div class="sub">Hôm nay bạn không có ca.</div>`;
  else {
    body = T.shifts.map((c) => {
      const st = !c.report_id ? 'Chưa mở phiếu' : (REPORT[c.report_status] || 'Đang chốt ca')
        + (c.report_status === 'hoan_thanh' ? (c.recon_status && c.recon_status !== 'chua' ? ' · đã đối soát' : ' · chờ đối soát') : '');
      return html`<div class="hn-ca">
        <div class="grow"><strong>Ca ${c.shift} · ${c.branch}</strong>
          <div class="sub">${c.start ? `${c.start}–${c.end || ''}` : 'Chưa cài giờ'}${c.role ? ' · ' + c.role : ''} · ${st}</div></div>
        ${can('chot_ca') ? html`<a class="btn sm" style="white-space:nowrap" href="#/ca">Mở ca</a>` : ''}</div>`;
    });
  }
  return html`<section id="hn-ca" class="card stack" style="gap:8px"><h2 style="margin:0">Ca của tôi hôm nay</h2>${body}</section>`;
}

function viecBlock(W) {
  const groups = Object.keys(GROUP_LABEL).map((g) => [g, W.items.filter((i) => i.group === g)]).filter(([, a]) => a.length);
  const row = (i) => html`<a class="hn-row ${i.group}" data-key="${i.key}" href="#${i.link}">
    <div class="grow"><strong>${i.title}</strong>${i.sub ? html`<div class="sub">${i.sub}</div>` : ''}
      ${i.waitingFor ? html`<div class="sub">Đang chờ: ${i.waitingFor}</div>` : ''}</div>
    ${i.due ? html`<span class="hn-due">${dmy(i.due.slice(0, 10))} ${i.due.slice(11, 16) === '23:59' ? '' : i.due.slice(11, 16)}</span>` : ''}<i>›</i></a>`;
  const body = W.failed
    ? html`<div class="alert warn" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">Chưa tải được công việc <button type="button" class="btn sm secondary" id="hn-retry">Thử lại</button></div>`
    : groups.length ? groups.map(([g, a]) => html`<div class="hn-gh ${g}">${GROUP_LABEL[g]} <span>${a.length}</span></div>${a.map(row)}`)
      : html`<div class="sub hn-empty">Hôm nay bạn không có việc cần xử lý</div>`;
  return html`<section id="hn-viec" class="card stack" style="gap:6px"><h2 style="margin:0">Việc của tôi</h2>${body}
    <div style="margin-top:6px"><a class="btn sm secondary" href="#/viec">Xem tất cả công việc</a></div></section>`;
}

function theoDoiBlock(pc, can) {
  const watch = pc?.watch || [];
  return html`<details id="hn-theo-doi" class="card" ${innerWidth > 700 ? 'open' : ''}><summary><h2 style="margin:0;display:inline">Theo dõi</h2></summary>
    <div class="stack" style="gap:8px;margin-top:8px">
      ${watch.length ? html`<a class="hn-row" href="#/viec"><div class="grow"><strong>Việc tôi đã giao đang theo dõi</strong><div class="sub">${watch.length} việc chưa xong</div></div><i>›</i></a>`
        : html`<div class="sub">Không có việc bạn giao đang chờ người khác.</div>`}
      <div class="toolbar" style="gap:8px">
        ${can('hop_giao_viec') ? html`<a class="btn sm secondary" href="#/quan-ly/giao-viec">Tất cả công việc</a>` : ''}
        ${can('phan_cong') ? html`<a class="btn sm secondary" href="#/cong-viec/qua-han">Quá hạn & phạt</a>` : ''}
        <a class="btn sm secondary" href="#/cong-viec/dao-tao">Đào tạo</a>
        <a class="btn sm secondary" href="#/thong-bao">Thông báo${state.unread ? ` (${state.unread})` : ''}</a></div>
    </div></details>`;
}

function luongBlock(cong, ka) {
  if (!cong) return html`<section id="hn-luong" class="card stack" style="gap:8px"><h2 style="margin:0">Bảng lương của tôi</h2>
    <div class="alert warn">Chưa tải được giờ làm.</div><div><a id="hn-luong-more" class="btn sm secondary" href="#/cua-toi/cong">Xem chi tiết</a></div></section>`;
  const worked = cong.shifts.filter((x) => x.worked);
  const hours = worked.reduce((t, x) => t + Number(x.hours || 0), 0);
  const plus = cong.covers.filter((c) => !c.me_absent && c.x2).reduce((t, c) => t + Number(c.hours || 0), 0);
  const minus = cong.covers.filter((c) => c.me_absent).reduce((t, c) => t + Number(c.deduct_hours || 0), 0);
  const ml = `${cong.month.slice(5)}/${cong.month.slice(0, 4)}`;
  const kaM = (ka || []).filter((k) => k.status !== 'huy' && String(k.work_date || '').startsWith(cong.month));
  const notes = cong.covers.slice(0, 3);
  return html`<section id="hn-luong" class="card stack" style="gap:10px"><h2 style="margin:0">Bảng lương của tôi · tháng ${ml}</h2>
    <div class="hn-k"><div><span>Số ca</span><b>${worked.length}</b></div><div><span>Giờ thực tế</span><b>${h2(hours)}</b></div>
      <div><span>Giờ x2 cộng</span><b style="color:#15803d">${plus ? '+' + h2(plus) : '0'}</b></div><div><span>Giờ bị trừ</span><b style="color:#b91c1c">${minus ? '−' + h2(minus) : '0'}</b></div></div>
    ${notes.length ? html`<div class="stack" style="gap:4px"><strong>Ghi chú nghỉ / làm thay</strong>${notes.map((c) => html`<div class="sub">${dmy(c.date)} · ca ${c.shift} ${c.branch} · ${c.me_absent
      ? `nghỉ (${c.reason_label})${Number(c.deduct_hours) ? ` · trừ ${h2(c.deduct_hours)} giờ` : ''}` : `làm thay${c.absent ? ' ' + c.absent : ''} · ${h2(c.hours)} giờ${c.x2 ? ' · x2' : ''}`}</div>`)}</div>` : ''}
    <div class="stack" style="gap:4px"><strong>Khoản âm tháng này</strong>
      ${ka === null ? html`<div class="sub">Chưa tải được khoản âm.</div>` : kaM.length ? kaM.map((k) => html`<div class="hn-ka"><span>${dmy(k.work_date)} · ca ${k.shift} ${k.branch}</span>
        <b>−${vnd(k.amount)}</b><span class="pill ${KA_STATUS[k.status]?.[1] || 'mute'}">${KA_STATUS[k.status]?.[0] || k.status}${k.auto_tru ? ' (mặc định)' : ''}</span></div>`)
        : html`<div class="sub">Không có khoản âm.</div>`}</div>
    <div><a id="hn-luong-more" class="btn sm secondary" href="#/cua-toi/cong">Xem chi tiết</a></div></section>`;
}

export async function render({ me, can }) {
  const emp = !!me.employee_id;
  const [T, todo, pc, training, ka, cong] = await Promise.all([
    soft(rpc('app_today_me')),
    soft(rpc('app_home_todo')),
    can('nhan_viec') ? soft(rpc('app_pc_mine')) : Promise.resolve({ tasks: [], gv: [], watch: [] }),
    soft(rpc('app_dt_work_list', { p_mine: true })),
    emp ? soft(rpc('app_ka_mine')) : Promise.resolve([]),
    emp ? soft(rpc('app_cong_mine', { p_month: null })) : Promise.resolve(null),
  ]);
  if (pc) learnJobs(pc.tasks);
  const now = T?.now || pc?.now || new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const W = collectWork({ now, pc, training, ka, todo: todo ? todo.items || [] : null }, { jobName, pcDue, gvDue, rstate });
  const order = T?.order && !T.order.submitted ? T.order : null;
  const watcher = ['chu', 'ql_tong', 'ql', 'ke_toan'].includes(me.role) || can('doi_soat') || can('ke_toan');
  const today = T?.today || now.slice(0, 10);
  return {
    title: 'Việc hôm nay',
    html: html`<style>
        .hn-wrap { max-width: 1000px; gap: 14px; }
        .hn-ca, .hn-row { display: flex; gap: 10px; align-items: center; min-width: 0; }
        .hn-ca { padding: 8px 0; border-top: 1px solid var(--line-soft); } .hn-ca:first-of-type { border-top: 0; }
        .hn-row { padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line-soft); border-left: 4px solid var(--line-strong); text-decoration: none; color: inherit; }
        .hn-row.late { border-left-color: #dc2626; } .hn-row.today { border-left-color: #f59e0b; } .hn-row.soon { border-left-color: #2563eb; } .hn-row.waiting { border-left-color: #94a3b8; }
        .hn-row .grow, .hn-ca .grow { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; } .hn-row i { font-style: normal; color: var(--muted); font-size: 20px; }
        .hn-due { font-size: 13px; color: var(--ink-2); white-space: nowrap; } .hn-row.late .hn-due { color: #b91c1c; font-weight: 600; }
        .hn-gh { font-size: 13px; font-weight: 700; color: var(--ink-2); margin-top: 6px; } .hn-gh.late { color: #b91c1c; } .hn-gh span { font-weight: 400; }
        .hn-k { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; } .hn-k div { border: 1px solid var(--line-soft); border-radius: 10px; padding: 8px 10px; }
        .hn-k span { display: block; font-size: 12px; color: var(--ink-2); } .hn-k b { font-size: 20px; }
        .hn-ka { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 14px; } .hn-ka span:first-child { flex: 1 1 160px; } .hn-ka b { color: #b91c1c; }
        .hn-order { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; } .hn-order small { font-weight: 400; opacity: .9; }
        #hn-theo-doi summary { cursor: pointer; list-style-position: inside; }
        .hn-cols { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 900px) { .hn-cols { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); align-items: start; } }
      </style>
      <div class="page-head"><div><h1>Việc hôm nay</h1><div class="sub">Xin chào, ${me.name} · ${ROLE_LABELS[me.role] || ''} · ${dmy(today)}</div></div>
        ${order ? html`<a id="hn-order" class="btn hn-order" href="#/order">Order ca tuần ${dmy(order.start_date)}<small>Hạn ${order.close_text || order.close_at}</small></a>` : ''}</div>
      <div class="stack hn-wrap">
        ${caBlock(T, can)}
        <div class="hn-cols">
          <div class="stack" style="gap:14px">${viecBlock(W)}</div>
          <div class="stack" style="gap:14px">${watcher ? theoDoiBlock(pc, can) : ''}${emp ? luongBlock(cong, ka) : ''}</div>
        </div>
      </div>`,
    mount(root) {
      $('#hn-retry', root)?.addEventListener('click', () => rerender());
    },
  };
}
