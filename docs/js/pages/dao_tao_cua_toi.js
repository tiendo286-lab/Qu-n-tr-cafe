// Phiếu đào tạo của tôi: phiếu tôi đang học, hoặc tôi hướng dẫn / phụ trách
import { isManager } from '../app.js';
import { rpc } from '../sb.js';
import { dmy } from '../tien.js';
import { html } from '../ui.js';
import { DT_STATUS, dtLabel } from './dao_tao.js';

const ROLE = { hoc: 'Bạn được đào tạo', huong_dan: 'Bạn hướng dẫn', quan_ly: 'Bạn phụ trách' };

export async function render() {
  const list = await rpc('app_dt_mine');
  const body = html`<style>.pill.info { background: var(--info-bg); color: var(--info-ink); }</style>
    ${list.length ? list.map((t) => html`<a class="card stack" href="#/dao-tao/phieu?id=${t.id}" style="gap:6px;padding:14px;text-decoration:none;color:inherit">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>${t.employee}</strong><span class="pill ${DT_STATUS[t.status][1]}">${dtLabel(t)}</span></div>
        <div style="font-size:13px;color:var(--muted)">${ROLE[t.role]} · bắt đầu ${dmy(t.start_date)}${t.branch ? ' · ' + t.branch : ''}${t.instructor ? ' · hướng dẫn: ' + t.instructor : ''}</div></a>`)
      : html`<div class="card">Bạn chưa có phiếu đào tạo nào.</div>`}`;
  return {
    title: 'Phiếu đào tạo của tôi',
    html: isManager() ? html`<div class="page-head"><h1>Phiếu đào tạo của tôi</h1></div><div class="stack" style="max-width:720px;gap:10px">${body}</div>` : html`<div class="stack" style="gap:10px"><h2 style="margin:0">Phiếu đào tạo</h2>${body}</div>`,
  };
}
