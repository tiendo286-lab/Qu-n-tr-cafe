// Việc đào tạo của tôi (tệp 174) — dùng ở Việc hôm nay và ở trang Phân công đào tạo khi người xem không có bảng phân công.
//  * Ca tôi được giao dạy (từ hôm qua trở đi): "Bạn dạy mục …", phần tôi đã giao lại cho Cấp 1 (+ Lấy lại), người giao lại cho tôi.
//  * Quản lý: nút "Giao lại cho Cấp 1" — chỉ mục chưa chấm của phần mình, chỉ chọn Cấp 1 (người làm cùng ca hiện sẵn thành nút).
//  * "Chờ bạn kiểm tra": mục Cấp 1 tôi giao lại đã ghi mức → Xác nhận đạt (giữ / sửa mức).
import { rpc } from '../sb.js';
import { dialog, flash, html, showSaved, str } from '../ui.js';
import { span } from './pc_dao_tao_tinh.js?v=2026.11.28.9';

export const LEVEL = { tb: 'Trung bình', kha: 'Khá', tot: 'Tốt' };
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const dm = (d) => `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}`;
export const wd = (d) => DOW[new Date(String(d).slice(0, 10) + 'T00:00:00Z').getUTCDay()];
const OPEN_ST = new Set(['chua', 'gioi_thieu']);   // chưa chấm (chưa có mức)
const lvSel = (lv, label) => html`<select class="input sm pcd-kt-lv" aria-label="${label}">${Object.entries(LEVEL).map(([k, v]) => html`<option value="${k}" ${k === lv ? 'selected' : ''}>${v}</option>`)}</select>`;

export const PCD_CSS = html`<style>
  .pcd .pill.info, .pcd-mine .pill.info, .pcd-dlg .pill.info { background: #e3eaf1; color: #2d4a66; }
  .pcd-lbl { font-size: 12px; font-weight: 700; letter-spacing: .04em; color: var(--muted); }
  .pcd-sum { display: flex; flex-wrap: wrap; gap: 6px; }
  .pcd-card { padding: 0; overflow: hidden; } .pcd-card > summary { cursor: pointer; list-style: none; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
  .pcd-card > summary::-webkit-details-marker { display: none; } .pcd-card[open] > summary { background: var(--caramel-soft, #f6ead9); border-bottom: 1px solid var(--line); }
  .pcd-h { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; overflow-wrap: anywhere; } .pcd-h b { font-size: 16px; }
  .pcd-meta { font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
  .pcd-bar { height: 8px; background: var(--line-soft, #f1ebe2); border-radius: 6px; overflow: hidden; } .pcd-bar i { display: block; height: 100%; background: #4f8a3c; }
  .pcd-body { padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
  .pcd-warn { background: #fef3c7; color: #78350f; border: 1px solid #f59e0b; border-radius: 10px; padding: 6px 10px; font-size: 13.5px; }
  .pcd-kt { background: #fffbeb; border: 1px solid #f59e0b; border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 8px; }
  .pcd-ktr, .pcd-mk { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; justify-content: space-between; font-size: 14px; }
  .pcd-ktr > span:first-child, .pcd-mk > span:first-child { flex: 1 1 220px; min-width: 0; overflow-wrap: anywhere; }
  .pcd-kta { display: flex; gap: 6px; align-items: center; } .pcd-kta select { width: auto; }
  .pcd-shs { display: flex; flex-direction: column; gap: 6px; }
  .pcd-sh { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; border: 1.5px solid var(--line); border-radius: 12px; padding: 8px 12px; cursor: pointer; background: var(--card, #fff); color: inherit; font: inherit; }
  .pcd-sh .pcd-sd { display: flex; flex-direction: column; min-width: 86px; font-size: 13px; } .pcd-sh .pcd-sd b { font-size: 14.5px; }
  .pcd-sh .pcd-dn { font-size: 12px; font-weight: 700; color: var(--primary-dark, #7a431a); }
  .pcd-sh .pcd-sw { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; font-size: 14px; } .pcd-sh .pcd-gl { display: block; }
  .pcd-sh.chua { background: #fef3c7; border-color: #f59e0b; } .pcd-sh.giao { background: #e3eaf1; border-color: #6f8fae; }
  .pcd-sh.tre { background: #fbe2df; border-color: #dc2626; } .pcd-sh.trong, .pcd-sh.ok { color: var(--muted); }
  .pcd-sh.off { border-style: dashed; } .pcd-offt { flex: none; } .pcd-sh > .pill { flex: none; }
  @media (max-width: 520px) { .pcd-sh { flex-wrap: wrap; gap: 4px 10px; } .pcd-sh .pcd-sd { flex: 1 1 auto; flex-direction: row; flex-wrap: wrap; gap: 2px 8px; align-items: baseline; }
    .pcd-sh .pcd-sw { order: 5; flex: 1 1 100%; } .pcd-sh .pcd-offt { order: 6; } }
  .pcd-fw { display: flex; flex-direction: column; gap: 8px; } .pcd-fw-f { display: flex; flex-wrap: wrap; gap: 8px; }
  .pcd-fw-f select { flex: 1 1 220px; width: auto; min-width: 0; } .pcd-fw-f input { width: 160px; max-width: 100%; }
  .pcd-fw-it { display: block; width: 100%; text-align: left; border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; background: var(--card, #fff); color: inherit; font: inherit; cursor: pointer; overflow-wrap: anywhere; }
  dialog.pcd-dlg { max-width: 640px; padding: 0; } .pcd-dlg .pcd-top { padding: 14px 16px 8px; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 6px; }
  .pcd-dlg .pcd-row { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; } .pcd-dlg h2 { font-size: 17px; margin: 0; overflow-wrap: anywhere; }
  .pcd-dlg .pcd-mid { padding: 10px 16px; max-height: 62vh; overflow: auto; display: flex; flex-direction: column; gap: 8px; }
  .pcd-dlg .pcd-foot { padding: 10px 16px 14px; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: flex-end; }
  .pcd-dlg .pcd-foot .grow { flex: 1 1 auto; }
  .pcd-seg { display: inline-flex; border: 1.5px solid var(--primary); border-radius: 10px; overflow: hidden; align-self: flex-start; }
  .pcd-seg button { border: 0; background: #fff; color: var(--primary); padding: 6px 12px; font-weight: 700; cursor: pointer; } .pcd-seg button.on { background: var(--primary); color: #fff; }
  .pcd-mates { display: flex; flex-wrap: wrap; gap: 6px; }
  .pcd-mate { display: flex; flex-direction: column; align-items: flex-start; border: 1.5px solid var(--primary); background: #fff; color: var(--primary-dark, #7a431a); border-radius: 12px; padding: 5px 12px; cursor: pointer; font-size: 12.5px; text-align: left; }
  .pcd-mate b { font-size: 14.5px; } .pcd-mate.on { background: var(--primary); color: #fff; }
  .pcd-given { background: var(--line-soft, #f7f2ea); border: 1px solid var(--line); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
  .pcd-gv { display: flex; flex-wrap: wrap; gap: 6px; justify-content: space-between; align-items: center; font-size: 14px; } .pcd-gv > span:first-child { min-width: 0; overflow-wrap: anywhere; }
  .pcd-dgrp { display: flex; flex-direction: column; gap: 2px; } .pcd-dgh { font-weight: 700; padding: 6px 0 2px; display: flex; gap: 6px; align-items: center; }
  .pcd-it { display: flex; gap: 8px; align-items: flex-start; padding: 6px 4px; border-bottom: 1px solid var(--line); font-size: 14px; cursor: pointer; }
  .pcd-it .t { min-width: 0; overflow-wrap: anywhere; } .pcd-it input { margin-top: 3px; flex: none; }
  .pcd-where, .pcd-lock { display: inline-block; margin-top: 2px; font-size: 12.5px; border-radius: 8px; padding: 1px 8px; }
  .pcd-where { background: var(--line-soft, #f1ebe2); color: var(--ink-2); } .pcd-lock { background: #fef3c7; color: #78350f; border: 1px solid #f59e0b; }
  .pcd-ditem { border-bottom: 1px solid var(--line); padding: 8px 0; display: flex; flex-direction: column; gap: 3px; font-size: 14px; overflow-wrap: anywhere; }
  .pcd-ditem ul { list-style: none; margin: 0; padding: 0 0 0 10px; border-left: 2px solid var(--line); font-size: 13.5px; }
  .pcd-tm { font-weight: 600; color: var(--primary-dark, #7a431a); margin-right: 4px; font-variant-numeric: tabular-nums; }
  .pcd-note { background: var(--line-soft, #f7f2ea); border: 1px solid var(--line); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
  .pcd-cf { display: flex; flex-wrap: wrap; gap: 6px; } .pcd-cf .pill { white-space: normal; }
  .pcd-mine { display: flex; flex-direction: column; gap: 10px; } .pcd-mine h2 { font-size: 17px; margin: 0; }
  .pcd-mc { border: 1px solid var(--line); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; overflow-wrap: anywhere; }
  .pcd-ml { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
</style>`;

const mineKey = (s) => `${s.training_id}|${s.date}|${s.shift}`;

export function myPlanHtml(P) {
  const today = P.today; const checks = P.checks || []; const shifts = P.shifts || [];
  const ql = P.me_rank === 'Quản lý';
  const scored = (xs) => xs.filter((x) => !OPEN_ST.has(x.state)).length;
  return html`${PCD_CSS}<section id="pcd-mine" class="card pcd-mine">
    <h2>Việc đào tạo của tôi</h2>
    ${checks.length ? html`<div class="pcd-kt"><div class="pcd-lbl">⏳ CHỜ BẠN KIỂM TRA · ${checks.length} MỤC (Cấp 1 bạn giao lại đã chấm)</div>
      ${checks.map((c) => html`<div class="pcd-mk" data-id="${c.training_id}" data-no="${c.no}"><span><b>${c.trainee}</b> · <b>${c.no}.</b> ${c.title}<br>
          <span class="pcd-meta">${c.who || '—'} ghi mức <b>${LEVEL[c.level] || c.level}</b>${c.at ? ' · ' + dm(c.at) + ' ' + String(c.at).slice(11, 16) : ''}</span></span>
        <span class="pcd-kta">${lvSel(c.level, 'Mức hạng mục ' + c.no)}<button type="button" class="btn sm" data-ktok>Xác nhận đạt</button></span></div>`)}</div>` : ''}
    ${shifts.length ? shifts.map((s) => { const past = s.date < today;
      const pool = s.by ? [] : s.own.filter((x) => OPEN_ST.has(x.state));
      return html`<div class="pcd-mc" data-key="${mineKey(s)}">
        <div class="pcd-ml"><b>${wd(s.date)} ${dm(s.date)} · ${s.branch || ''} ${s.shift}${s.date === today ? ' · hôm nay' : ''}</b><span class="pcd-meta">dạy <b>${s.trainee}</b> · Ngày ${s.day_no} đi làm</span><a class="pcd-meta pcd-mo" href="#/dao-tao/phieu?id=${s.training_id}">Mở phiếu ›</a></div>
        ${s.own.length ? html`<div class="pcd-ml"><span class="pill info">Bạn dạy</span> mục ${span(s.own.map((x) => x.no))}${s.by ? html` <span class="pcd-meta">(${s.by} giao lại)</span>` : ''}${scored(s.own) ? html` <span class="pcd-meta">· đã chấm ${scored(s.own)}/${s.own.length}</span>` : ''}</div>` : ''}
        ${(s.subs || []).map((g) => html`<div class="pcd-ml"><span class="pill mute">→ ${g.who} (Cấp 1) dạy</span> mục ${span(g.items.map((x) => x.no))}${scored(g.items) ? html` <span class="pcd-meta">· đã chấm ${scored(g.items)}/${g.items.length}</span>` : ''}
          ${!past && g.items.some((x) => OPEN_ST.has(x.state)) ? html`<button type="button" class="btn sm secondary" data-take="${g.who_id}">Lấy lại</button>` : ''}</div>`)}
        ${ql && !past && (pool.length || (s.subs || []).length) ? html`<div><button type="button" class="btn sm" data-sub="${mineKey(s)}">Giao lại cho Cấp 1</button></div>` : ''}
      </div>`; }) : html`<div class="pcd-meta">Bạn không có ca dạy nào từ hôm qua trở đi.</div>`}
  </section>`;
}

function openSub(P, s, reload, pick = null) {
  const cap = new Map((P.cap1 || []).map((c) => [c.id, c]));
  const mates = (s.mates || []).filter((id) => cap.has(id)).map((id) => cap.get(id));
  const others = (P.cap1 || []).filter((c) => !mates.includes(c));
  const pool = [...(s.by ? [] : s.own.filter((x) => OPEN_ST.has(x.state)).map((x) => ({ ...x, holder: null }))),
    ...(s.subs || []).flatMap((g) => g.items.filter((x) => OPEN_ST.has(x.state)).map((x) => ({ ...x, holder: g.who_id })))].sort((a, b) => a.no - b.no);
  const nameOf = (id) => cap.get(id)?.name || (s.subs || []).find((g) => g.who_id === id)?.who || '';
  const d = dialog(''); d.classList.add('pcd-dlg');
  const paint = () => {
    d.innerHTML = str(html`<div class="pcd-top"><div class="pcd-row"><h2>Giao lại · ${s.trainee} · ${s.branch || ''} ${s.shift} · ${wd(s.date)} ${dm(s.date)}</h2>
        <button type="button" class="btn sm secondary" data-x aria-label="Đóng">✕</button></div>
        <div class="pcd-meta">Ngày ${s.day_no} đi làm · chỉ giao lại được mục của bạn mà chưa ai chấm</div></div>
      <div class="pcd-mid">
        <div class="pcd-lbl">CẤP 1 LÀM CÙNG CA (THEO LỊCH)</div>
        <div class="pcd-mates">${mates.length ? mates.map((c) => html`<button type="button" class="pcd-mate ${pick === c.id ? 'on' : ''}" data-pick="${c.id}"><b>${c.name}</b><span>Cấp 1 ${(c.branches || []).join(', ')}</span></button>`) : html`<span class="pcd-meta">Không có Cấp 1 nào làm cùng ca này.</span>`}</div>
        <label class="field">Hoặc chọn Cấp 1 khác<select class="input sm" id="pcd-sother"><option value="">— Chọn Cấp 1 —</option>${others.map((c) => html`<option value="${c.id}" ${pick === c.id ? 'selected' : ''}>${c.name}${c.branches?.length ? ' (' + c.branches.join(', ') + ')' : ''}</option>`)}</select></label>
        <div class="pcd-meta">${pick ? html`Tích những mục <b>${nameOf(pick)}</b> dạy thay bạn. Mục không tích thì bạn vẫn dạy.` : 'Chọn một nhân viên Cấp 1 trước, rồi tích mục.'} Cấp 1 chấm xong, bạn hoặc người phụ trách chính bấm Xác nhận đạt.</div>
        ${pool.length ? '' : html`<div class="pcd-meta">Không còn mục nào chưa chấm để giao lại.</div>`}
        ${pool.map((x) => html`<label class="pcd-it"><input type="checkbox" data-no="${x.no}" ${pick && x.holder === pick ? 'checked' : ''} ${pick ? '' : 'disabled'}>
          <span class="t"><b>${x.no}.</b> ${x.title}<br><span class="pcd-where">${x.holder ? nameOf(x.holder) + ' đang dạy' : 'Bạn đang dạy'}</span></span></label>`)}
      </div>
      <div class="pcd-foot"><b class="grow">Đã chọn <span id="pcd-sn">0</span> mục</b><button type="button" class="btn" id="pcd-sgo" disabled>Giao lại</button></div>`);
    sync();
  };
  // Nút lưu: chưa tích mục nào mà người này cũng chưa giữ mục nào → khoá; bỏ tích hết phần người này đang giữ → "Lấy lại"
  const sync = () => {
    const n = d.querySelectorAll('input[data-no]:checked').length; const held = pool.filter((x) => pick && x.holder === pick).length;
    d.querySelector('#pcd-sn').textContent = n; const go = d.querySelector('#pcd-sgo');
    go.disabled = !pick || (!n && !held);
    go.textContent = !pick ? 'Giao lại' : !n && held ? `Lấy lại ${held} mục từ ${nameOf(pick)}` : n ? `Giao lại ${n} mục cho ${nameOf(pick)}` : `Giao lại cho ${nameOf(pick)}`;
  };
  d.addEventListener('change', (e) => { if (e.target.id === 'pcd-sother') { pick = Number(e.target.value) || null; paint(); } else sync(); });
  d.addEventListener('click', async (e) => {
    if (e.target.closest('[data-x]')) { d.close(); return; }
    const p = e.target.closest('[data-pick]'); if (p) { pick = Number(p.dataset.pick); paint(); return; }
    const go = e.target.closest('#pcd-sgo'); if (!go || !pick) return;
    const items = [...d.querySelectorAll('input[data-no]:checked')].map((x) => Number(x.dataset.no));
    go.disabled = true;
    try {
      const r = await rpc('app_dt_sub_assign', { p_id: s.training_id, p_date: s.date, p_shift: s.shift, p_employee: pick, p_items: items });
      d.close(); flash(items.length ? `Đã giao lại ${items.length} mục cho ${nameOf(pick)}.` : `Đã lấy lại mục từ ${nameOf(pick)}.`); reload();
    } catch (err) { go.disabled = false; showSaved(err.message, true); }
  });
  paint();
}

// Gắn nút của khối; trả về hàm gỡ (khi rời trang)
export function mountMyPlan(root, P, reload) {
  if (!P) return () => {};
  const byKey = new Map((P.shifts || []).map((s) => [mineKey(s), s]));
  const onClick = async (e) => {
    const t = e.target;
    const ok = t.closest('#pcd-mine .pcd-mk [data-ktok]');
    if (ok) {
      const row = ok.closest('.pcd-mk'); ok.disabled = true;
      try { await rpc('app_dt_check_ok', { p_id: Number(row.dataset.id), p_no: Number(row.dataset.no), p_level: row.querySelector('.pcd-kt-lv').value }); flash('Đã xác nhận đạt.'); reload(); }
      catch (err) { ok.disabled = false; showSaved(err.message, true); }
      return;
    }
    const sub = t.closest('#pcd-mine [data-sub]');
    if (sub) { const s = byKey.get(sub.dataset.sub); if (s) openSub(P, s, reload); return; }
    const take = t.closest('#pcd-mine [data-take]');
    if (take) {
      const s = byKey.get(take.closest('.pcd-mc').dataset.key); take.disabled = true;
      try { const n = await rpc('app_dt_sub_take', { p_id: s.training_id, p_date: s.date, p_shift: s.shift, p_employee: Number(take.dataset.take) }); flash(`Đã lấy lại ${n} mục.`); reload(); }
      catch (err) { take.disabled = false; showSaved(err.message, true); }
    }
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
