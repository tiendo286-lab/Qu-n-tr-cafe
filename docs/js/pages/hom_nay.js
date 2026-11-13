// Việc hôm nay (bước 62): trang chủ của Chủ / Quản lý / Kế toán — chỉ hiện việc còn tồn của đúng người đăng nhập, bấm là tới chỗ làm.
import { state } from '../app.js';
import { rpc } from '../sb.js';
import { dmy } from '../tien.js';
import { ROLE_LABELS, html } from '../ui.js';

export async function render({ me, can }) {
  const D = await rpc('app_home_todo').catch(() => ({ items: [], today: '' }));
  const todo = D.items.filter((x) => Number(x.n) > 0);
  const groups = [...new Set(D.items.map((x) => x.group))];
  const card = (x) => html`<a class="hn-i ${x.tone}" href="#${x.link}"><b>${x.key === 'sao_luu' && Number(x.n) >= 999 ? '!' : x.n}</b><span>${x.label}</span><i>›</i></a>`;
  return {
    title: 'Việc hôm nay',
    html: html`<style>
        .hn-g { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
        .hn-i { display: flex; gap: 12px; align-items: center; padding: 12px 14px; border-radius: 14px; background: var(--card); box-shadow: var(--shadow); text-decoration: none; color: inherit; border-left: 5px solid var(--line-strong); min-width: 0; }
        .hn-i b { font-size: 24px; min-width: 40px; text-align: center; font-variant-numeric: tabular-nums; } .hn-i span { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; } .hn-i i { font-style: normal; color: var(--muted); font-size: 20px; }
        .hn-i.warn { border-left-color: #f59e0b; } .hn-i.warn b { color: #b45309; } .hn-i.off { border-left-color: #dc2626; } .hn-i.off b { color: #b91c1c; } .hn-i.mute b { color: var(--ink-2); }
        .hn-done { padding: 18px; text-align: center; font-size: 16px; }
      </style>
      <div class="page-head"><div><h1>Việc hôm nay</h1><div class="sub">Xin chào, ${me.name} · ${ROLE_LABELS[me.role] || ''} · ${D.today ? dmy(D.today) : ''}. Chỉ hiện việc còn tồn — bấm vào để làm ngay.</div></div></div>
      <div class="stack" style="max-width:1000px;gap:14px">
        ${todo.length ? groups.map((g) => { const list = todo.filter((x) => x.group === g); return list.length ? html`<section class="stack" style="gap:8px"><h2 style="margin:0">${g}</h2><div class="hn-g">${list.map(card)}</div></section>` : ''; })
          : html`<div class="card hn-done">✓ Không còn việc tồn nào. Mọi thứ đã xong.</div>`}
        <section class="card stack" style="gap:8px"><h2 style="margin:0">Đi nhanh</h2>
          <div class="toolbar" style="gap:8px">
            ${can('chot_ca') ? html`<a class="btn sm secondary" href="#/ca">Chốt ca</a>` : ''}
            ${can('doi_soat') ? html`<a class="btn sm secondary" href="#/quan-ly/doi-soat">Đối soát</a><a class="btn sm secondary" href="#/quan-ly/thu-chi">Thu chi</a>` : ''}
            ${can('ke_toan') ? html`<a class="btn sm secondary" href="#/ke-toan/chuyen-khoan">Chuyển khoản thực nhận</a><a class="btn sm secondary" href="#/ke-toan/fabi">File ca Fabi</a>` : ''}
            ${me.employee_id ? html`<a class="btn sm secondary" href="#/order">Order ca của tôi</a>` : ''}
            <a class="btn sm secondary" href="#/thong-bao">Thông báo${state.unread ? ` (${state.unread})` : ''}</a></div></section>
      </div>`,
  };
}
