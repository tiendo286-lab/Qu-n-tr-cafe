// Điểm đánh giá của tôi: điểm tháng này, các tháng trước, mọi lần bị trừ điểm / nhắc nhở; không đồng ý thì gửi giải trình
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { $$, flash, html, showSaved } from '../ui.js';
import { DG_CSS, fillPhotos, markCard, monthLabel, rating } from '../danh_gia.js';

export async function render() {
  const D = await rpc('app_dg_mine');
  const r = rating(D.score ?? 100);
  const cur = D.marks.filter((m) => m.month === D.month && m.status === 'tru');
  const lost = {}; cur.forEach((m) => { lost[m.criterion] = (lost[m.criterion] || 0) + Number(m.points); });
  const hit = (D.criteria || []).filter((c) => lost[c.code]);
  const canReply = (m) => m.status === 'tru' && !m.reviewed_at;
  return {
    title: 'Điểm đánh giá của tôi',
    html: html`${DG_CSS}
      <div class="page-head"><div><h1>Điểm đánh giá của tôi</h1><div class="sub">Đầu tháng bạn có 100 điểm${D.set_name ? ` theo 20 tiêu chí ${D.set_name}` : ''}. Phạm lỗi bị trừ 1–5 điểm vào tiêu chí liên quan hoặc bị nhắc nhở. Không đồng ý thì gửi giải trình cho quản lý.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:640px;gap:12px">
        ${D.score === null ? html`<div class="card">Tài khoản này không gắn với nhân viên.</div>` : html`
        <div class="card dg-sum" style="padding:14px"><div><div class="st-meta">Tháng ${monthLabel(D.month)}</div><span class="dg-score">${D.score}</span><span class="st-meta">/100</span></div>
          <span class="pill ${r[2]}">${r[1]}</span>
          <span class="st-meta">${cur.filter((m) => m.points > 0).length} lần trừ · ${cur.filter((m) => Number(m.points) === 0).length} nhắc nhở</span></div>
        ${hit.length ? html`<div class="card stack" style="gap:4px;padding:14px"><strong>Tiêu chí bị trừ tháng này</strong>
          ${hit.map((c) => html`<div style="display:flex;justify-content:space-between;gap:8px;font-size:14px"><span>${c.name}</span><strong style="white-space:nowrap">còn ${Math.max(0, 5 - lost[c.code])}/5</strong></div>`)}</div>` : ''}
        ${D.months.filter((m) => m.month !== D.month).length ? html`<div class="card stack" style="gap:4px;padding:14px"><strong>Các tháng trước</strong>
          ${D.months.filter((m) => m.month !== D.month).map((m) => html`<div style="display:flex;justify-content:space-between;gap:8px;font-size:14px"><span>Tháng ${monthLabel(m.month)}</span><span><strong>${m.score}</strong> · ${m.rating}</span></div>`)}</div>` : ''}
        <strong>Lịch sử (${D.marks.length})</strong>
        ${D.marks.length ? D.marks.map((m) => html`<div class="stack" style="gap:6px">${markCard(m, { mine: true })}
          ${canReply(m) ? html`<details class="dg-reply" data-id="${m.id}"><summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--primary)">${m.reply ? 'Sửa giải trình' : 'Không đồng ý? Gửi giải trình'}</summary>
            <div class="stack" style="gap:6px;margin-top:6px"><textarea class="input dg-text" rows="2" placeholder="Giải thích cho quản lý">${m.reply || ''}</textarea>
            <div><button type="button" class="btn sm secondary dg-send">Gửi giải trình</button></div></div></details>` : ''}</div>`)
          : html`<div class="card">Bạn chưa bị trừ điểm hay nhắc nhở lần nào. Cố gắng giữ nhé!</div>`}`}
      </div>`,
    mount(root) {
      $$('.dg-send').forEach((b) => b.addEventListener('click', async () => {
        const box = b.closest('.dg-reply');
        try { await rpc('app_dg_reply', { p_id: Number(box.dataset.id), p_text: box.querySelector('.dg-text').value }); flash('Đã gửi giải trình cho quản lý.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      fillPhotos(root);
    },
  };
}
