// Bước 109 — Việc của tôi: việc tự tạo theo Bảng phân công + Giao việc riêng, chia theo từng hạng mục; khách nợ ưu tiên đầu trang.
import { rpc } from '../sb.js';
import { $, html, str } from '../ui.js';
import { GROUP, JOBS, ORDER, STYLE, bindActions, fd, gvCard, gvDue, jobName, learnJobs, money, ms, dur, pcCard, pcDue, rstate, toast, tone } from '../cv_chung.js?v=2026.11.17.12';

export const perm = 'nhan_viec';
let CAT = '';
const DEBT = { bill: 'Khách nợ', ck: 'Nợ chuyển khoản', muon: 'Khách mượn' };

export async function render({ me }) {
  let D = await rpc('app_pc_mine');
  const mgr = ['chu', 'ql_tong'].includes(me.role);
  const draw = () => {
    const now = D.now, my = D.me;
    learnJobs(D.tasks);
    const cards = [];   // [job, html, due, late]
    (D.tasks || []).forEach((t) => { const due = pcDue(t); cards.push([t.job, pcCard(t, { ctx: 'my', me: my, now, mgr, chu: me.role === 'chu' }), due, tone(due, now) === 'late', tone(due, now) === 'soon']); });
    (D.gv || []).forEach((k) => { const due = gvDue(k); cards.push([24, gvCard(k, { ctx: 'my', me: my, now, mgr }), due, tone(due, now) === 'late', tone(due, now) === 'soon']); });
    const watch = D.watch || [], debts = D.debts || [];
    const late = cards.filter((c) => c[3]).length, soon = cards.filter((c) => c[4]).length;
    const cuIds = [...new Set(cards.map((c) => c[0]).filter((j) => j >= 100))].sort((x, y) => x - y);
    const cats = [...ORDER, ...cuIds].map((j) => [j, cards.filter((c) => c[0] === j)]).filter(([, a]) => a.length);
    if (CAT && !(CAT === 'debt' ? debts.length : CAT === 'watch' ? watch.length : cats.some(([j]) => String(j) === CAT))) CAT = '';
    const chip = (v, l, n, red) => html`<button class="pc-chip ${CAT === v ? 'on' : ''}" data-cat="${v}">${l} <span class="pc-cnt ${red ? 'red' : ''}">${n}</span></button>`;
    const fines = (D.fines || []).filter((f) => f.status === 'phat');
    return html`
      <div class="pc-stats"><div class="pc-stat late"><span>Quá hạn</span><strong>${late}</strong></div><div class="pc-stat soon"><span>Sắp hết hạn</span><strong>${soon}</strong></div>
        <div class="pc-stat"><span>Đang mở</span><strong>${cards.length}</strong></div><div class="pc-stat"><span>Khách nợ cần đôn đốc</span><strong>${debts.length}</strong></div></div>
      <div class="pc-info">Việc đối soát do web <b>tự tạo theo Bảng phân công</b> và <b>tự đóng</b> khi làm xong hồ sơ (bấm "Làm ngay"). <b>Giao việc riêng</b>: nhận việc → ghi tiến độ → báo xong kèm ảnh → người kiểm tra bấm Đạt mới đóng. Quá hạn có thể bị phạt.</div>
      ${fines.length ? html`<div class="alert warn" style="margin-top:10px">Tháng này bạn bị phạt <b>${fines.length} lần · ${money(fines.reduce((s, f) => s + Number(f.amount || 0), 0))}</b> do không hoàn thành công việc đúng hạn: ${fines.map((f) => f.title).join(' · ')}</div>` : ''}
      ${cards.length || debts.length || watch.length ? html`<div class="pc-chips">${chip('', 'Tất cả hạng mục', cards.length + debts.length)}${debts.length ? chip('debt', '⭐ Khách nợ', debts.length) : ''}${watch.length ? chip('watch', '👁 Tôi đã giao', watch.length) : ''}
        ${cats.map(([j, a]) => { const l = a.filter((c) => c[3]).length; return chip(String(j), jobName(j), l ? `${l} trễ / ${a.length}` : a.length, l); })}</div>` : ''}
      ${debts.length && (!CAT || CAT === 'debt') ? html`<div class="pc-sec pc-cat"><span class="pc-ic debt"></span>⭐ Ưu tiên · Khách nợ <span class="pc-cnt">${debts.length}</span><small>· hiện tới khi khách trả, không đặt hạn, không phạt</small></div>
        <div class="pc-list">${debts.map((d) => html`<div class="pc-debt"><div class="grow"><div><span class="pc-br">${d.code}</span> <b>${d.name}</b> <span class="pill mute">${DEBT[d.kind] || d.kind}</span></div><div class="pc-sub">Ghi nợ ${fd(d.at)} · đã ${dur(ms(now) - ms(d.at))}${d.note ? ' · ' + d.note : ''}</div></div><span class="amt">${money(d.amount)}</span><a class="btn sm secondary" href="#/quan-ly/cong-no?cn=${d.branch_id}">Mở Công nợ →</a></div>`)}</div>` : ''}
      ${CAT !== 'debt' && CAT !== 'watch' ? cats.filter(([j]) => !CAT || String(j) === CAT).map(([j, a]) => {
        const l = a.filter((c) => c[3]).length;
        return html`<div class="pc-sec pc-cat"><span class="pc-ic ${GROUP[j] || 'tu'}"></span>${jobName(j)} <span class="pc-cnt">${a.length} việc</span>${l ? html`<span class="pc-cnt red">${l} quá hạn</span>` : ''}</div>
          <div class="pc-list">${a.sort((x, y) => (ms(x[2]) || 9e15) - (ms(y[2]) || 9e15)).map((c) => c[1])}</div>`;
      }) : ''}
      ${watch.length && (!CAT || CAT === 'watch') ? html`<div class="pc-sec pc-cat"><span class="pc-ic rieng"></span>👁 Việc tôi đã giao — đang theo dõi <span class="pc-cnt">${watch.length} việc</span><small>· xem tiến độ, bấm Chi tiết để xem dòng thời gian</small></div>
        <div class="pc-list">${watch.sort((x, y) => (ms(gvDue(x)) || 9e15) - (ms(gvDue(y)) || 9e15)).map((k) => gvCard(k, { ctx: 'all', me: D.me, now, mgr }))}</div>` : ''}
      ${!cards.length && !debts.length && !watch.length ? html`<div class="card" style="text-align:center;padding:28px;margin-top:14px">🎉 Không có việc nào đang chờ.</div>` : ''}
      <details style="margin-top:18px"><summary class="pc-sec" style="cursor:pointer">Đã xong 7 ngày qua <span class="pc-cnt">${(D.done || []).length}</span></summary>
        <div class="card" style="padding:4px">${(D.done || []).map((x) => html`<div class="pc-done">${x.drop ? html`<span class="pill mute">${x.note || 'Không cần xử lý'}</span>` : html`<span class="pill ok">✓ Xong</span>`}<b>${jobName(x.job)}</b>${x.code ? html`<span class="pc-br">${x.code}</span>` : ''}<span>${x.title}</span><span class="pc-sub">· ${fd(x.done_at)}</span>${x.late ? html`<span class="pill off">có trễ hạn</span>` : ''}</div>`)}${(D.done || []).length ? '' : html`<div class="pc-sub" style="padding:12px">Chưa có</div>`}</div></details>`;
  };
  return {
    title: 'Việc của tôi',
    html: html`${STYLE}<div id="pc-page"><div class="page-head"><div><h1>Việc của tôi</h1><div class="sub">Việc tự tạo theo Bảng phân công và việc được giao riêng · chia theo hạng mục</div></div>
      ${D.can_give ? html`<button class="btn" data-a="gv-new">+ Giao việc riêng</button>` : ''}</div><div id="pc-body">${draw()}</div></div>`,
    mount(root) {
      const page = $('#pc-page', root), body = $('#pc-body', root);
      const reload = async (msg) => { D = await rpc('app_pc_mine'); body.innerHTML = str(draw()); if (msg) toast(msg); };
      page.addEventListener('click', (e) => { const c = e.target.closest('[data-cat]'); if (c) { CAT = c.dataset.cat; body.innerHTML = str(draw()); } });
      bindActions(page, { data: () => D, reload });
    },
  };
}
export { rstate };
