// Khoản âm của tôi: quản lý đối soát ra THIẾU tiền và gán cho mình → xem, bấm "Đã xem", gửi giải trình nếu không đồng ý
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { dmy, dt, vnd } from '../tien.js';
import { $$, flash, html, showSaved } from '../ui.js';
import { KA_STATUS } from './phieu_ca.js';

export async function render() {
  const list = await rpc('app_ka_mine');
  const live = list.filter((k) => k.status !== 'huy');
  const open = live.filter((k) => k.status === 'chua_xu_ly');
  const luong = live.filter((k) => k.status === 'tru_luong');
  const canReply = (k) => k.status === 'chua_xu_ly' || k.auto_tru;   // trừ lương mặc định: vẫn giải trình được
  const sum = (a) => a.reduce((s, k) => s + Number(k.amount || 0), 0);
  const card = (k) => html`<article class="card stack ka-c ${canReply(k) ? 'open' : ''}" style="gap:8px;padding:14px" data-id="${k.id}">
    <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
      <strong>Ca ${k.shift} ${k.branch} · ${dmy(k.work_date)}</strong><span class="pill ${KA_STATUS[k.status][1]}">${KA_STATUS[k.status][0]}${k.auto_tru ? ' (mặc định)' : ''}</span></div>
    <div class="ka-amt">−${vnd(k.amount)} <span class="st-meta">· ${k.item_label}</span></div>
    ${k.reason ? html`<div style="font-size:14px"><span class="st-meta">Lý do:</span> ${k.reason}</div>` : ''}
    <div class="st-meta">Người đối soát: ${k.created_by || ''} · ${dt(k.created_at)}</div>
    ${k.status_note ? html`<div class="st-meta">Ghi chú xử lý: ${k.status_note}${k.status_by ? ` · ${k.status_by}` : ''}</div>` : ''}
    ${k.status === 'huy' ? '' : k.reply ? html`<div class="ka-rep"><span class="st-meta">Bạn đã giải trình ${dt(k.reply_at)}:</span> ${k.reply}</div>` : ''}
    ${canReply(k) ? html`<div class="stack" style="gap:6px">
      ${k.seen_at ? '' : html`<div><button type="button" class="btn sm ka-seen">Tôi đã xem</button></div>`}
      <details><summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--primary)">${k.reply ? 'Sửa giải trình' : 'Không đồng ý? Gửi giải trình'}</summary>
        <div class="stack" style="gap:6px;margin-top:6px"><textarea class="input ka-text" rows="2" placeholder="Giải thích cho quản lý">${k.reply || ''}</textarea>
        <div><button type="button" class="btn sm secondary ka-send">Gửi giải trình</button></div></div></details></div>` : ''}
  </article>`;
  return {
    title: 'Khoản âm của tôi',
    html: html`<style>.ka-c.open { border-left: 4px solid #dc2626; } .ka-amt { font-size: 20px; font-weight: 700; color: #b91c1c; } .ka-rep { font-size: 14px; background: var(--line-soft); border-radius: 10px; padding: 8px 10px; }</style>
      <div class="page-head"><div><h1>Khoản âm của tôi</h1><div class="sub">Khi đối soát ca ra thiếu tiền, phần thiếu chia đều cho người làm ca đó và mặc định trừ lương. Không đồng ý thì gửi giải trình.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:640px;gap:12px">
        ${live.length ? html`<div class="card" style="display:flex;gap:16px;flex-wrap:wrap;padding:14px"><div><div class="st-meta">Trừ lương</div><strong style="font-size:18px;color:#b91c1c">${vnd(sum(luong))}</strong> <span class="st-meta">(${luong.length} khoản)</span></div>
          ${open.length ? html`<div><div class="st-meta">Chưa xử lý</div><strong style="font-size:18px;color:#b91c1c">${vnd(sum(open))}</strong> <span class="st-meta">(${open.length} khoản)</span></div>` : ''}
          <div><div class="st-meta">Tổng từ trước tới nay</div><strong style="font-size:18px">${vnd(sum(live))}</strong></div></div>` : html`<div class="card">Bạn không có khoản âm nào.</div>`}
        ${list.map(card)}
      </div>`,
    mount() {
      $$('.ka-seen').forEach((b) => b.addEventListener('click', async () => {
        try { await rpc('app_ka_seen', { p_id: Number(b.closest('.ka-c').dataset.id) }); flash('Đã ghi nhận bạn đã xem.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      $$('.ka-send').forEach((b) => b.addEventListener('click', async () => {
        const c = b.closest('.ka-c');
        try { await rpc('app_ka_reply', { p_id: Number(c.dataset.id), p_text: c.querySelector('.ka-text').value }); flash('Đã gửi giải trình cho quản lý.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
    },
  };
}
