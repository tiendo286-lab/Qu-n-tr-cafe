// Công việc (người giao) — dạng bảng: thanh trạng thái tô màu (Cần xử lý → Chờ nhận → Đang xử lý → Đã xử lý),
// tìm kiếm + bộ lọc (người nhận, mức độ, hạn, nguồn), mức độ Thấp / Bình thường / Gấp, bấm từng việc để xem chi tiết & thao tác.
import { render as rerender } from '../app.js';
import { addDays, vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { dmy } from '../tien.js';
import { $, $$, dialog, flash, html, norm, showSaved } from '../ui.js';
import { PRI, STYLE, doneText, dueText, history, sourceText } from './viec.js';

export const perm = 'hop_giao_viec';

// Trạng thái hiển thị (màu cố định để nhìn là biết)
const ST = {
  can: { label: 'Cần xử lý', cls: 'vs-can' },
  cho: { label: 'Chờ nhận', cls: 'vs-cho' },
  dang: { label: 'Đang xử lý', cls: 'vs-dang' },
  xong: { label: 'Đã xử lý', cls: 'vs-xong' },
};
const ST_OF = { chua_phan_cong: 'can', da_giao: 'cho', dang_xu_ly: 'dang', cho_duyet: 'xong', hoan_thanh: 'xong' };
const TAB_KEYS = { 'tat-ca': '', 'can-xu-ly': 'can', 'cho-nhan': 'cho', 'dang-xu-ly': 'dang', 'da-xu-ly': 'xong' };
const ROLE = { ql_tong: 'Quản lý tổng', ql: 'Quản lý', nv: 'Nhân viên' };
// Bộ lọc giữ nguyên khi trang tải lại sau một thao tác
const F = { q: '', ass: '', pri: '', due: '', src: '' };

const svg = (inner) => html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICON = {
  ho: svg(html`<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>`),
  viec: svg(html`<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>`),
  dao_tao: svg(html`<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>`),
  search: svg(html`<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>`),
  filter: svg(html`<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>`),
};

const priPill = (p) => { const x = PRI[p] || PRI.binh_thuong; return html`<span class="vp ${x.cls}"><i></i>${x.label}</span>`; };
const stPill = (s) => html`<span class="vst ${ST[s].cls}">${ST[s].label}</span>`;

export async function render({ params }) {
  const [all, people, pending] = await Promise.all([rpc('app_viec_all'), rpc('app_viec_people'), rpc('app_viec_pending')]);
  const today = vnToday(); const week = addDays(today, 7);
  const tabKey = params.tab in TAB_KEYS ? params.tab : (params.tab ? 'tat-ca' : 'can-xu-ly');

  // Gộp: nội dung bàn giao chưa giao + mọi việc
  const items = [
    ...pending.handover.map((h) => ({ k: 'ho' + h.id, type: 'ho', ho: h, st: 'can', pri: 'binh_thuong', src: 'ho', content: h.content, ass: '', assName: '', due: null,
      sub: html`<a href="#/ca/phieu?id=${h.report_id}">Bàn giao ca ${h.shift} ${h.branch} ${dmy(h.work_date)}</a>${h.by ? ` · ${h.by}` : ''}` })),
    ...all.map((t) => ({ k: 't' + t.id, type: 't', t, st: ST_OF[t.status] || 'can', pri: t.priority || 'binh_thuong', src: t.kind === 'dao_tao' ? 'dao_tao' : t.handover_item_id ? 'ho' : 'viec',
      content: t.content, ass: t.assignee_id ? String(t.assignee_id) : '', assName: t.assignee_name || '', due: t.due_date,
      sub: html`#${t.id}${sourceText(t) ? html` · ${sourceText(t)}` : ''}${t.created_by_name ? ` · giao bởi ${t.created_by_name}` : ''}` })),
  ];
  const rank = { gap: 0, binh_thuong: 1, thap: 2 }; const stRank = { can: 0, cho: 1, dang: 2, xong: 3 };
  items.sort((a, b) => stRank[a.st] - stRank[b.st] || rank[a.pri] - rank[b.pri] || (a.due || '9999').localeCompare(b.due || '9999'));
  const dueBucket = (it) => (!it.due ? 'none' : it.st !== 'xong' && it.due < today ? 'late' : it.due === today ? 'today' : it.due <= week && it.due > today ? 'week' : 'later');
  const count = (s) => items.filter((it) => !s || it.st === s).length;
  const assignees = [...new Map(items.filter((it) => it.ass).map((it) => [it.ass, it.assName])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'vi'));

  const groups = Object.entries(ROLE).map(([r, label]) => [label, people.filter((p) => p.role === r)]).filter(([, ps]) => ps.length);
  const personOpts = (sel, blank) => html`<option value="">${blank}</option>${groups.map(([label, ps]) => html`<optgroup label="${label}">${ps.map((p) => html`<option value="${p.id}" ${String(p.id) === String(sel) ? 'selected' : ''}>${p.name}</option>`)}</optgroup>`)}`;
  const priOpts = (sel) => Object.entries(PRI).map(([k, x]) => html`<option value="${k}" ${k === (sel || 'binh_thuong') ? 'selected' : ''}>${x.label}</option>`);

  const row = (it) => html`<div class="vr" role="row" tabindex="0" data-k="${it.k}" data-st="${it.st}" data-pri="${it.pri}" data-ass="${it.ass}" data-due="${dueBucket(it)}" data-src="${it.src}"
      data-search="${norm(it.content + ' ' + it.assName + ' ' + (it.t ? '#' + it.t.id : ''))}">
    <div class="vc vc-main" role="cell"><span class="vic ${ST[it.st].cls}">${ICON[it.src]}</span>
      <div class="vmt"><div class="vtt">${it.content}</div><div class="vsub">${it.sub}</div></div></div>
    <div class="vc vc-ass" role="cell">${it.assName ? html`<span class="vav">${it.assName.trim().slice(0, 1)}</span><span>${it.assName}</span>` : html`<span class="st-meta">Chưa giao</span>`}</div>
    <div class="vc vc-pri" role="cell">${priPill(it.pri)}</div>
    <div class="vc vc-due" role="cell">${it.t ? dueText(it.t) : html`<span class="st-meta">—</span>`}</div>
    <div class="vc vc-st" role="cell">${stPill(it.st)}</div>
    <div class="vc vc-act" role="cell">${it.st === 'can' ? html`<button type="button" class="btn sm v-assign">Giao</button>` : ''}<button type="button" class="v-more" aria-label="Chi tiết và thao tác">⋯</button></div>
  </div>`;

  const total = items.length || 1;
  return {
    title: 'Công việc',
    html: html`${STYLE}${CSS}
      <div class="page-head v-head"><div><h1>Công việc</h1><div class="sub">Giao việc cho nhân viên và theo dõi đến khi xử lý xong.</div></div>
        <div class="v-tools">
          <label class="v-search">${ICON.search}<input id="f-q" type="search" placeholder="Tìm việc, người nhận, #mã…" value="${F.q}" aria-label="Tìm"></label>
          <button type="button" class="v-fbtn ${F.ass || F.pri || F.due || F.src ? 'on' : ''}" id="f-toggle" aria-label="Bộ lọc" aria-expanded="false">${ICON.filter}</button>
          <button type="button" class="btn sm" id="v-add">+ Thêm việc</button>
        </div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>

      <section class="card v-card">
        <div class="v-tabs" role="tablist" aria-label="Trạng thái">
          ${[['tat-ca', 'Tất cả', ''], ['can-xu-ly', 'Cần xử lý', 'can'], ['cho-nhan', 'Chờ nhận', 'cho'], ['dang-xu-ly', 'Đang xử lý', 'dang'], ['da-xu-ly', 'Đã xử lý', 'xong']].map(([k, l, s]) => html`<button type="button" role="tab" class="v-tab ${s ? ST[s].cls : 'vs-all'} ${k === tabKey ? 'on' : ''}" data-tab="${k}" aria-selected="${k === tabKey ? 'true' : 'false'}"><i></i>${l} <b>${count(s)}</b></button>`)}
        </div>
        <div class="v-bar" aria-hidden="true">${['can', 'cho', 'dang', 'xong'].map((s) => (count(s) ? html`<span class="${ST[s].cls}" style="width:${(count(s) / total) * 100}%" title="${ST[s].label}: ${count(s)}"></span>` : ''))}</div>
        <div class="v-filters" id="f-panel" hidden>
          <select class="input sm" id="f-ass" aria-label="Người nhận"><option value="">Mọi người nhận</option>${assignees.map(([id, n]) => html`<option value="${id}" ${F.ass === id ? 'selected' : ''}>${n}</option>`)}</select>
          <select class="input sm" id="f-pri" aria-label="Mức độ"><option value="">Mọi mức độ</option>${Object.entries(PRI).map(([k, x]) => html`<option value="${k}" ${F.pri === k ? 'selected' : ''}>${x.label}</option>`)}</select>
          <select class="input sm" id="f-due" aria-label="Hạn">${[['', 'Mọi hạn'], ['late', 'Quá hạn'], ['today', 'Hạn hôm nay'], ['week', 'Trong 7 ngày tới'], ['none', 'Không đặt hạn']].map(([v, l]) => html`<option value="${v}" ${F.due === v ? 'selected' : ''}>${l}</option>`)}</select>
          <select class="input sm" id="f-src" aria-label="Nguồn">${[['', 'Mọi nguồn'], ['ho', 'Bàn giao ca'], ['viec', 'Việc tự ghi'], ['dao_tao', 'Đào tạo']].map(([v, l]) => html`<option value="${v}" ${F.src === v ? 'selected' : ''}>${l}</option>`)}</select>
          <button type="button" class="btn sm secondary" id="f-clear">Xóa lọc</button>
        </div>
        <div class="vt" role="table" aria-label="Danh sách công việc">
          <div class="vr vh" role="row"><div role="columnheader">Công việc</div><div role="columnheader">Người nhận</div><div role="columnheader">Mức độ</div><div role="columnheader">Hạn</div><div role="columnheader">Trạng thái</div><div role="columnheader">Thao tác</div></div>
          ${items.map(row)}
          <div class="v-empty" id="v-empty" hidden>Không có việc nào khớp.</div>
        </div>
        <div class="v-foot st-meta"><span id="f-count"></span> · Việc đã xử lý hiện trong 30 ngày gần đây.</div>
      </section>`,
    mount() {
      let tab = tabKey;
      const apply = () => {
        const s = norm(F.q.trim()); const st = TAB_KEYS[tab]; let n = 0;
        $$('.vt .vr[data-k]').forEach((r) => {
          const d = r.dataset;
          const show = (!st || d.st === st) && (!s || d.search.includes(s)) && (!F.ass || d.ass === F.ass) && (!F.pri || d.pri === F.pri)
            && (!F.due || d.due === F.due || (F.due === 'week' && d.due === 'today')) && (!F.src || d.src === F.src);
          r.hidden = !show; if (show) n++;
        });
        $('#v-empty').hidden = n > 0; $('#f-count').textContent = `${n} việc`;
        $('#f-toggle').classList.toggle('on', !!(F.ass || F.pri || F.due || F.src));
      };
      $$('.v-tab').forEach((b) => b.addEventListener('click', () => {
        tab = b.dataset.tab;
        $$('.v-tab').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        window.history.replaceState(null, '', '#/quan-ly/giao-viec?tab=' + tab); apply();
      }));
      $('#f-q').addEventListener('input', (e) => { F.q = e.target.value; apply(); });
      [['#f-ass', 'ass'], ['#f-pri', 'pri'], ['#f-due', 'due'], ['#f-src', 'src']].forEach(([sel, key]) => $(sel).addEventListener('change', (e) => { F[key] = e.target.value; apply(); }));
      $('#f-toggle').addEventListener('click', (e) => { const p = $('#f-panel'); p.hidden = !p.hidden; e.currentTarget.setAttribute('aria-expanded', String(!p.hidden)); });
      if (F.ass || F.pri || F.due || F.src) $('#f-panel').hidden = false;
      $('#f-clear').addEventListener('click', () => { Object.assign(F, { ass: '', pri: '', due: '', src: '' }); ['#f-ass', '#f-pri', '#f-due', '#f-src'].forEach((s) => { $(s).value = ''; }); apply(); });
      apply();

      const done = (msg) => { flash(msg); rerender(); };
      const run = async (btn, fn) => { btn.disabled = true; try { await fn(); } catch (e) { showSaved(e.message, true); btn.disabled = false; } };

      // ---- Thêm việc
      $('#v-add').addEventListener('click', () => {
        const d = dialog(html`<form class="stack v-dlg" style="gap:12px" id="add-task"><h2 style="margin:0">Thêm việc</h2>
          <textarea class="input" name="content" rows="3" placeholder="Nội dung công việc" required aria-label="Nội dung công việc"></textarea>
          <label class="v-f"><span>Người nhận</span><select class="input sm" name="assignee">${personOpts('', '— Giao sau (để ở Cần xử lý) —')}</select></label>
          <div class="v-2"><label class="v-f"><span>Mức độ</span><select class="input sm" name="pri">${priOpts('binh_thuong')}</select></label>
            <label class="v-f"><span>Hạn (không bắt buộc)</span><input class="input sm" type="date" name="due"></label></div>
          <div class="st-meta">Chọn người nhận thì việc được giao ngay (người đó nhận thông báo).</div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        d.querySelector('form').addEventListener('submit', (ev) => {
          ev.preventDefault(); const f = ev.target;
          run(f.querySelector('[type=submit]'), async () => {
            await rpc('app_viec_add', { p_meeting: null, p: { kind: 'viec', content: f.content.value, assignee_id: f.assignee.value || null, due_date: f.due.value || null, priority: f.pri.value } });
            d.close(); done(f.assignee.value ? 'Đã giao việc. Người nhận đã được thông báo.' : 'Đã thêm vào Cần xử lý.');
          });
        });
      });

      // ---- Chi tiết / thao tác một việc
      const open = (k, focusAssign) => {
        const it = items.find((x) => x.k === k); if (!it) return;
        const t = it.t; const isDone = it.st === 'xong';
        const d = dialog(html`<div class="stack v-dlg" style="gap:12px">
          <div class="v-dh">${stPill(it.st)} ${priPill(it.pri)} ${t ? dueText(t) : ''}</div>
          <div class="tk-content">${it.content}</div>
          <div class="st-meta">${it.sub}</div>
          ${t?.assignee_name ? html`<div><span class="st-meta">Người nhận:</span> <strong>${t.assignee_name}</strong></div>` : ''}
          ${t && t.status === 'dang_xu_ly' && t.review_note ? html`<div class="alert warn" style="font-size:13px">Đã yêu cầu làm lại: ${t.review_note}</div>` : ''}
          ${t ? doneText(t) : ''}
          ${isDone ? html`<div class="stack" style="gap:6px"><strong style="font-size:14px">Yêu cầu làm lại</strong>
              <textarea class="input v-note" rows="2" placeholder="Lý do (bắt buộc)" aria-label="Lý do yêu cầu làm lại"></textarea>
              <div><button type="button" class="btn sm secondary v-reopen">Gửi yêu cầu làm lại</button></div></div>`
            : html`<form class="stack v-edit" style="gap:10px">
              <strong style="font-size:14px">${it.st === 'can' ? 'Giao việc' : 'Đổi người nhận / mức độ / hạn'}</strong>
              ${t && t.kind !== 'dao_tao' ? html`<textarea class="input" name="content" rows="2" aria-label="Nội dung">${t.content}</textarea>` : ''}
              <label class="v-f"><span>Người nhận</span><select class="input sm" name="assignee">${personOpts(t?.assignee_id || '', it.st === 'can' ? '— Chọn người nhận —' : '— Bỏ giao (về Cần xử lý) —')}</select></label>
              <div class="v-2"><label class="v-f"><span>Mức độ</span><select class="input sm" name="pri">${priOpts(it.pri)}</select></label>
                <label class="v-f"><span>Hạn</span><input class="input sm" type="date" name="due" value="${t?.due_date || ''}"></label></div>
              <div><button class="btn sm" type="submit">${it.st === 'can' ? 'Giao việc' : 'Lưu thay đổi'}</button></div></form>`}
          ${t ? history(t) : ''}
          <div class="toolbar" style="justify-content:space-between">
            <span>${it.type === 'ho' ? html`<button type="button" class="btn sm secondary v-hoclose">Đã xong, không cần giao</button>` : html`<button type="button" class="btn sm secondary danger v-del">Xóa việc</button>`}</span>
            <button type="button" class="btn sm secondary" data-x>Đóng</button></div></div>`);
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        const form = d.querySelector('.v-edit');
        if (form && focusAssign) setTimeout(() => form.assignee.focus(), 50);
        form?.addEventListener('submit', (ev) => {
          ev.preventDefault();
          const who = form.assignee.value; const due = form.due.value || null; const pri = form.pri.value;
          run(form.querySelector('[type=submit]'), async () => {
            if (it.type === 'ho') {
              if (!who) throw new Error('Chọn người nhận trước.');
              await rpc('app_viec_add', { p_meeting: null, p: { kind: 'viec', handover_item_id: it.ho.id, assignee_id: who, due_date: due, priority: pri } });
              d.close(); done('Đã giao việc. Người nhận đã được thông báo.'); return;
            }
            if (it.st === 'can' && !who) throw new Error('Chọn người nhận trước.');
            const p = { assignee_id: who || null, due_date: due, priority: pri };
            if (form.content) p.content = form.content.value;
            await rpc('app_viec_update', { p_task: t.id, p });
            d.close(); done(who && String(who) !== String(t.assignee_id || '') ? 'Đã giao việc. Người nhận đã được thông báo.' : 'Đã lưu thay đổi.');
          });
        });
        d.querySelector('.v-reopen')?.addEventListener('click', (ev) => {
          const note = d.querySelector('.v-note').value;
          if (!note.trim()) { showSaved('Ghi lý do yêu cầu làm lại.', true); return; }
          run(ev.target, async () => { await rpc('app_viec_reopen', { p_task: t.id, p_note: note }); d.close(); done('Đã gửi yêu cầu làm lại. Việc chuyển về Đang xử lý.'); });
        });
        d.querySelector('.v-hoclose')?.addEventListener('click', (ev) => {
          if (!confirm('Đánh dấu nội dung bàn giao này đã xong, không cần giao ai?')) return;
          run(ev.target, async () => { await rpc('app_viec_handover_close', { p_item: it.ho.id }); d.close(); done('Đã đánh dấu xong.'); });
        });
        d.querySelector('.v-del')?.addEventListener('click', (ev) => {
          if (!confirm('Xóa công việc này? Nếu việc lấy từ bàn giao ca, nội dung đó trở lại Cần xử lý.')) return;
          run(ev.target, async () => { await rpc('app_viec_delete', { p_task: t.id }); d.close(); done('Đã xóa việc.'); });
        });
      };
      $$('.vt .vr[data-k]').forEach((r) => {
        r.addEventListener('click', (e) => { if (e.target.closest('a')) return; open(r.dataset.k, !!e.target.closest('.v-assign')); });
        r.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === r) open(r.dataset.k); });
      });
    },
  };
}

const CSS = html`<style>
  .v-head { align-items: flex-end; }
  .v-tools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .v-search { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px; border-radius: 20px; background: var(--card); box-shadow: var(--shadow); color: var(--muted); min-width: 0; flex: 1 1 220px; }
  .v-search input { border: none; outline: none; background: transparent; font: inherit; font-size: 14px; color: var(--ink); min-width: 0; width: 100%; }
  .v-search:focus-within { outline: 3px solid #e2b98f; }
  .v-fbtn { width: 40px; height: 40px; border-radius: 20px; border: none; background: var(--card); box-shadow: var(--shadow); color: var(--ink-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex: 0 0 auto; }
  .v-fbtn.on { background: var(--primary); color: #fff; }
  .v-card { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .v-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
  .v-tab { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: #fff; border-radius: 20px; padding: 7px 14px; font: inherit; font-size: 14px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
  .v-tab i { width: 8px; height: 8px; border-radius: 50%; background: var(--c, var(--muted)); }
  .v-tab b { font-weight: 700; color: var(--c, var(--ink)); }
  .v-tab.on { background: var(--c, var(--navy)); border-color: var(--c, var(--navy)); color: #fff; }
  .v-tab.on i { background: #fff; } .v-tab.on b { color: #fff; }
  .vs-all { --c: var(--navy); }
  .vs-can { --c: #dc2626; --bg: #fee2e2; --fg: #991b1b; }
  .vs-cho { --c: #d97706; --bg: #fef3c7; --fg: #92400e; }
  .vs-dang { --c: #2563eb; --bg: #dbeafe; --fg: #1e40af; }
  .vs-xong { --c: #16a34a; --bg: #dcfce7; --fg: #166534; }
  .v-bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: var(--line-soft); }
  .v-bar span { background: var(--c); }
  .v-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; padding: 12px; background: #f7f1e8; border-radius: 14px; }
  .vt { display: flex; flex-direction: column; }
  .vr { display: grid; grid-template-columns: minmax(0, 2.8fr) minmax(0, 1.3fr) 118px 130px 112px 104px; gap: 12px; align-items: center; padding: 12px 8px; border-top: 1px solid var(--line-soft); }
  .vr[data-k] { cursor: pointer; border-radius: 12px; }
  .vr[data-k]:hover, .vr[data-k]:focus-visible { background: #faf5ee; outline: none; }
  .vh { border-top: none; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; padding-top: 4px; padding-bottom: 8px; }
  .vc { min-width: 0; font-size: 14px; }
  .vc-main { display: flex; gap: 12px; align-items: center; }
  .vic { flex: 0 0 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: var(--bg); color: var(--fg); }
  .vmt { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .vtt { font-weight: 600; color: var(--ink); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; }
  .vsub { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vc-ass { display: flex; align-items: center; gap: 8px; }
  .vc-ass > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vav { flex: 0 0 28px; height: 28px; border-radius: 50%; background: var(--caramel-soft, #f6ead9); color: var(--primary); font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; }
  .vst { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; background: var(--bg); color: var(--fg); white-space: nowrap; }
  .vp { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; white-space: nowrap; }
  .vp i { width: 10px; height: 10px; border-radius: 3px; background: currentColor; }
  .vp-gap { color: #dc2626; } .vp-tb { color: #8a6d55; } .vp-thap { color: #6b8f4e; }
  .vc-act { display: flex; gap: 6px; align-items: center; justify-content: flex-end; }
  .v-more { width: 34px; height: 34px; border-radius: 10px; border: none; background: transparent; font-size: 20px; line-height: 1; color: var(--muted); cursor: pointer; }
  .v-more:hover { background: var(--line-soft); color: var(--ink); }
  .v-empty { padding: 28px; text-align: center; color: var(--muted); }
  .vr[hidden], .v-empty[hidden], .v-filters[hidden] { display: none !important; }
  .v-foot { padding: 0 8px; }
  .v-dlg { width: min(560px, calc(100vw - 56px)); }
  .v-dh { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 13px; }
  .v-f { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 600; min-width: 0; }
  .v-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 760px) {
    .vr.vh { display: none; }
    .vr { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; padding: 12px 4px; }
    .vc-main { order: 1; flex: 1 1 0; }
    .vc-act { order: 2; flex: 0 0 auto; align-self: flex-start; }
    .vc-ass { order: 3; flex: 1 1 100%; padding-left: 56px; }
    .vc-pri { order: 4; margin-left: 56px; }
    .vc-due { order: 5; font-size: 13px; }
    .vc-st { order: 6; }
    .v-2 { grid-template-columns: 1fr; }
    .v-tab { padding: 6px 11px; font-size: 13px; }
  }
</style>`;
