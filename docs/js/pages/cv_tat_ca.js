// Bước 109 — Tất cả công việc (Chủ / Quản lý tổng): việc tự tạo + Giao việc riêng của mọi người, chưa có người, theo dõi từng người, 5 bước việc riêng.
import { rpc } from '../sb.js';
import { $, html, str } from '../ui.js';
import { JOBS, RST, jobName, learnJobs, ROLE, STYLE, bindActions, curStep, dur, fd, gvCard, gvDue, money, ms, pcCard, pcDue, rstate, shortName, toast, tone } from '../cv_chung.js?v=2026.11.20.2';

export const perm = 'hop_giao_viec';
const F = { br: '', st: 'open', rs: '' };
const DEBT = { bill: 'Khách nợ', ck: 'Nợ chuyển khoản', muon: 'Khách mượn' };

export async function render({ me }) {
  let D = await rpc('app_pc_all');
  const mgr = ['chu', 'ql_tong'].includes(me.role);
  const draw = () => {
    learnJobs(D.tasks);
    const now = D.now, my = D.me;
    const br = (x) => !F.br || (F.br === 'chung' ? !x.branch_id : String(x.branch_id) === F.br);
    const pcs = (D.tasks || []).filter(br), gvAll = (D.gv || []).filter(br);
    const gvOpen = gvAll.filter((k) => rstate(k) >= 0 && rstate(k) < 4);
    const rows = [...pcs.map((t) => ({ kind: 'pc', x: t, due: pcDue(t), accs: curStep(t)?.accounts || [] })),
      ...gvOpen.map((k) => ({ kind: 'gv', x: k, due: gvDue(k), accs: rstate(k) === 0 ? (k.classifiers || []).map((c) => c.id) : [rstate(k) === 3 ? k.reviewer_id : k.assignee_id] }))];
    rows.forEach((r) => { r.tone = tone(r.due, now, !r.accs.length); });
    const free = rows.filter((r) => !r.accs.length), lateN = rows.filter((r) => r.tone === 'late').length;
    const people = (D.people || []).map((p) => ({ p, o: rows.filter((r) => r.accs.includes(p.id)).length, l: rows.filter((r) => r.accs.includes(p.id) && r.tone === 'late').length, l7: (D.late7 || {})[p.id] || 0 }))
      .filter((r) => r.o || r.l7);
    const rc = (i) => i === 4 ? gvAll.filter((k) => rstate(k) === 4).length : gvOpen.filter((k) => rstate(k) === i).length;
    const card = (r) => (r.kind === 'pc' ? pcCard(r.x, { ctx: 'all', me: my, now, mgr, chu: me.role === 'chu' }) : gvCard(r.x, { ctx: 'all', me: my, now, mgr }));
    const chip = (k, v, l) => html`<button class="pc-chip ${F[k] === v ? 'on' : ''}" data-f="${k}" data-v="${v}">${l}</button>`;
    let list;
    if (F.rs !== '') {
      const i = +F.rs, L = gvAll.filter((k) => rstate(k) === i);
      list = html`<div class="pc-chips"><button class="pc-chip on" data-f="rs" data-v="">Đang lọc: Giao việc riêng · ${RST[i]} ✕</button></div>
        ${L.length ? html`<div class="pc-list">${L.map((k) => gvCard(k, { ctx: 'all', me: my, now, mgr }))}</div>` : html`<div class="card pc-sub" style="padding:16px">Không có</div>`}`;
    } else if (F.st === 'done') {
      list = html`<div class="card" style="padding:4px">${(D.done || []).filter(br).map((x) => html`<div class="pc-done"><span class="pill ok">✓ Xong</span><b>${jobName(x.job)}</b>${x.code ? html`<span class="pc-br">${x.code}</span>` : ''}<span>${x.title}</span><span class="pc-sub">· ${fd(x.done_at)}${x.by ? ' · ' + shortName(x.by) : ''}</span>${x.late ? html`<span class="pill off">có trễ hạn</span>` : ''}</div>`)}
        ${gvAll.filter((k) => rstate(k) === 4 || rstate(k) < 0).map((k) => html`<div class="pc-done">${rstate(k) < 0 ? html`<span class="pill mute">Không cần xử lý</span>` : html`<span class="pill ok">✓ Đạt</span>`}<b>Giao việc riêng</b>${k.code ? html`<span class="pc-br">${k.code}</span>` : ''}<span>${k.content}</span><span class="pc-sub">· ${fd(k.approved_at || k.cancelled_at)}</span></div>`)}</div>`;
    } else {
      const R = rows.filter((r) => F.st !== 'late' || r.tone === 'late');
      const groups = [['Quá hạn', 'late'], ['Sắp hết hạn (dưới 6 giờ)', 'soon'], ['Còn thời gian', ''], ['Không đặt hạn', 'none'], ['Chưa có người', 'free']];
      const debts = (D.debts || []).filter(br);
      list = html`${F.st === 'open' && debts.length ? html`<div class="pc-sec">⭐ Khách nợ đang theo dõi <span class="pc-cnt">${debts.length}</span></div>
          <div class="pc-list">${debts.map((d) => html`<div class="pc-debt"><div class="grow"><div><span class="pc-br">${d.code}</span> <b>${d.name}</b> <span class="pill mute">${DEBT[d.kind] || d.kind}</span></div><div class="pc-sub">Ghi nợ ${fd(d.at)} · đã ${dur(ms(now) - ms(d.at))}</div></div><span class="amt">${money(d.amount)}</span></div>`)}</div>` : ''}
        ${groups.map(([l, tn]) => { const a = R.filter((r) => r.tone === tn); return a.length ? html`<div class="pc-sec">${l} <span class="pc-cnt">${a.length}</span></div><div class="pc-list">${a.sort((x, y) => (ms(x.due) || 9e15) - (ms(y.due) || 9e15)).map(card)}</div>` : ''; })}
        ${R.length ? '' : html`<div class="card pc-sub" style="padding:16px">Không có việc</div>`}`;
    }
    return html`
      <div class="pc-stats"><div class="pc-stat"><span>Đang mở</span><strong>${rows.length}</strong></div><div class="pc-stat late"><span>Quá hạn</span><strong>${lateN}</strong></div>
        <div class="pc-stat soon"><span>Chưa có người</span><strong>${free.length}</strong></div><div class="pc-stat"><span>Xong 7 ngày</span><strong>${(D.done || []).length + gvAll.filter((k) => rstate(k) === 4).length}</strong></div></div>
      ${free.length ? html`<div class="alert warn"><b>${free.length} việc chưa có người làm</b> (ô trong Bảng phân công đang trống): ${free.map((r) => (r.kind === 'pc' ? jobName(r.x.job) : 'Giao việc riêng') + (r.x.code ? ' ' + r.x.code : '')).join(' · ')}. Bấm "Giao người" trên từng việc${D.can_edit ? html`, hoặc điền ô ở <a href="#/cong-viec/phan-cong">Bảng phân công</a>` : ''}.</div>` : ''}
      ${people.length ? html`<div class="card" style="padding:6px 8px;margin:12px 0;overflow-x:auto"><table class="pc-tbl"><thead><tr><th>Người</th><th class="n">Đang mở</th><th class="n">Đang quá hạn</th><th class="n">Lần trễ 7 ngày</th></tr></thead>
        <tbody>${people.map((r) => html`<tr><td><b>${shortName(r.p.name)}</b> <span class="pc-sub">${ROLE[r.p.role] || ''}${r.p.kt ? ' + Kế toán' : ''}</span></td><td class="n">${r.o}</td><td class="n ${r.l ? 'red' : ''}"><b>${r.l}</b></td><td class="n">${r.l7}</td></tr>`)}</tbody></table></div>` : ''}
      <div class="pc-sec">Giao việc riêng — tiến độ</div>
      <div class="pc-tiles">${RST.map((n, i) => html`<button class="pc-tile ${F.rs === String(i) ? 'on' : ''}" data-f="rs" data-v="${F.rs === String(i) ? '' : i}"><span>${n}${i === 4 ? ' (7 ngày)' : ''}</span><strong>${rc(i)}</strong></button>`)}</div>
      <div class="pc-chips">${chip('br', '', 'Tất cả cơ sở')}${(D.branches || []).map((b) => chip('br', String(b.id), b.code))}${chip('br', 'chung', 'Chung')}</div>
      <div class="pc-chips">${chip('st', 'open', 'Đang mở')}${chip('st', 'late', 'Quá hạn')}${chip('st', 'done', 'Đã xong 7 ngày')}</div>
      ${list}`;
  };
  return {
    title: 'Tất cả công việc',
    html: html`${STYLE}<div id="pc-page"><div class="page-head"><div><h1>Tất cả công việc</h1><div class="sub">Mọi cơ sở, mọi người · việc tự tạo theo Bảng phân công và Giao việc riêng</div></div>
      <button class="btn" data-a="gv-new">+ Giao việc riêng</button></div><div id="pc-body">${draw()}</div></div>`,
    mount(root) {
      const page = $('#pc-page', root), body = $('#pc-body', root);
      const reload = async (msg) => { D = await rpc('app_pc_all'); body.innerHTML = str(draw()); if (msg) toast(msg); };
      page.addEventListener('click', (e) => { const c = e.target.closest('[data-f]'); if (c) { F[c.dataset.f] = c.dataset.v; if (c.dataset.f !== 'rs') F.rs = ''; body.innerHTML = str(draw()); } });
      bindActions(page, { data: () => D, reload });
    },
  };
}
