// Bước 123 — hộp cài đặt 1 việc trong Bảng phân công, chia từng cơ sở: người làm, (người + hạn kiểm tra), chu kỳ, ngày làm, quá hạn cho phép, mức phạt.
// Lần 1 dùng cho việc tự thêm (mode 'custom'); lần 2 dùng lại cho việc có sẵn.
import { rpc } from './sb.js';
import { $, $$, dialog, html, str } from './ui.js';
import { money, shortName, ROLE } from './cv_chung.js?v=2026.11.24.5';

export const CYCLE = { ngay: 'Hằng ngày', tuan: 'Hằng tuần', thang: 'Hằng tháng' };
export const DOW = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
export const GRACE = [0, 2, 4, 12, 24, 48, 72, 168];
export const CHECK_H = [2, 4, 12, 24, 48, 72];
export const DUE_H = [0, 4, 12, 24, 48, 72, 96, 120, 168];   // hạn làm việc có sẵn (0 = không đặt hạn)
const dueTxt = (h) => (!+h ? 'Không đặt hạn' : hTxt(h));
// ô cơ sở của việc có sẵn: "1 ngày · 50.000đ"
export const webTxt = (job, s) => (job === 10 ? schedTxt(s) : `${!+s.due_h ? 'không hạn' : hTxt(s.due_h)} · ${money(s.fine)}`);
export const hTxt = (h) => (+h === 0 ? 'xong trong ngày' : +h < 24 ? `${+h} giờ` : `${+h / 24} ngày`);
const dayTxt = (s) => (s.cycle === 'ngay' ? 'Hằng ngày' : s.cycle === 'tuan' ? `${DOW[s.day] || '?'} hằng tuần` : `Ngày ${s.day} hằng tháng`);
// "Thứ Ba hằng tuần · +1 ngày · 50.000đ"
export const schedTxt = (s) => `${dayTxt(s)} · ${+s.grace_h === 0 ? 'xong trong ngày' : '+' + hTxt(s.grace_h)} · ${money(s.fine)}`;

export const STYLE_HOP = html`<style>
  .pv{display:flex;flex-direction:column;gap:12px}
  .pv-top{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .pv-rows{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:12px;overflow:hidden}
  .pv-row{display:grid;gap:8px;align-items:center;padding:8px 10px;border-top:1px solid var(--line-soft);grid-template-columns:70px 1.3fr 1.3fr .9fr 1fr 1fr 1fr .9fr}
  .pv.nock .pv-row{grid-template-columns:70px 1.5fr 1fr 1fr 1fr .9fr}
  .pv.pvw .pv-row{grid-template-columns:70px 1.5fr 1.3fr .9fr 1fr .9fr}.pv.pvw.nock .pv-row{grid-template-columns:70px 1.7fr 1fr .9fr}
  .pv.pv1 .pv-row{grid-template-columns:110px 1fr 1fr}
  .pv-tag{font-size:12px;font-weight:600;border-radius:6px;padding:2px 8px;background:#e3eaf1;color:#2d4a66;vertical-align:middle;margin-left:6px}
  .pv-row:first-child{border-top:0}.pv-hd{background:var(--subtle);font-size:12px;color:var(--muted);font-weight:600}
  .pv.nock .pv-ckc{display:none}
  .pv-row.off .pv-c:not(.pv-on){opacity:.35;pointer-events:none}
  .pv-c{min-width:0;display:flex;flex-direction:column;gap:3px}.pv-l{display:none;font-size:12px;color:var(--muted)}
  .pv-on{flex-direction:row;align-items:center;gap:6px}
  .pv-c .input{width:100%;min-width:0;padding:6px 8px}
  .pv-pick{position:relative}.pv-pb{text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#fff}
  .pv-pop{position:absolute;z-index:5;left:0;right:0;min-width:200px;max-height:240px;overflow:auto;background:var(--card);border:1px solid var(--line-strong);border-radius:10px;padding:6px;box-shadow:0 8px 20px rgba(60,40,20,.15)}
  .pv-pop label{display:flex;gap:6px;align-items:center;padding:4px 6px;font-size:13px;cursor:pointer}
  .pv-cf[hidden]{display:none}.pv-cf{background:var(--off-bg);color:var(--off-ink);border-radius:12px;padding:10px 12px;font-size:13px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .btn.pv-danger{background:#fff;color:var(--off-line);border:1px solid #f0b4ad}.btn.pv-danger.solid{background:var(--off-line);color:#fff;border-color:var(--off-line)}
  .pv-foot{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center}.pv-foot>div{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  @media (max-width:720px){
    .pv-top{grid-template-columns:1fr}.pv-hd{display:none}
    .pv-row,.pv.nock .pv-row,.pv.pvw .pv-row,.pv.pvw.nock .pv-row,.pv.pv1 .pv-row{grid-template-columns:1fr 1fr;padding:10px}.pv-on{grid-column:1/-1}.pv-l{display:block}
    .pv-row.off .pv-c:not(.pv-on){display:none}
  }
</style>`;

export function openJobDialog({ D, job, done, mode = 'custom', info = {} }) {
  const P = D.people || [];
  const web = mode === 'web', isNew = !job && !web;
  const one = web && (job.job === 13 || job.job === 14);   // gộp chung mọi cơ sở
  const sch = !web || job.job === 10;                        // có chu kỳ / ngày làm
  const ktJob = web && [3, 4].includes(job.job);
  const J = job || { job: null, name: '', guide: '', need_photo: false, need_check: false, enabled: true };
  const sOf = (b) => (D.sched || []).find((x) => x.job === J.job && x.branch_id === b);
  const aOf = (b) => ((D.assign || []).find((x) => x.job === J.job && x.branch_id === b)?.accounts) || [];
  const R = (D.branches || []).map((b) => { const s = sOf(b.id); return { b, on: s ? s.enabled : true, acc: isNew ? [] : [...aOf(b.id)], ckr: [...(s?.checkers || [])],
    cy: s?.cycle || 'tuan', day: s?.day ?? 1, grace: s ? +s.grace_h : (web ? 72 : 24), fine: s ? +s.fine : (web ? +job.fine : 50000), ckh: s ? +s.check_h : 24,
    due: s ? +(s.due_h || 0) : +((job?.steps?.[0]?.d || 0) * 24) }; });
  const acc0 = R.map((r) => r.acc.join(','));
  const ONE = { b: { id: null, code: 'Mọi cơ sở' }, on: true, acc: [], ckr: [], due: +((job?.steps?.[0]?.d || 0) * 24), fine: +(job?.fine || 0) };
  let chk = !!J.need_check, enabled = J.enabled !== false;
  const nameOf = (id) => shortName(P.find((p) => p.id === id)?.name) || `#${id}`;
  const pbTxt = (ids) => (ids.length ? ids.map(nameOf).join(', ') : '— chọn —');
  const opt = (v, l, sel) => html`<option value="${v}" ${String(v) === String(sel) ? 'selected' : ''}>${l}</option>`;
  const picker = (k, ids) => html`<div class="pv-pick"><button type="button" class="input pv-pb" data-pick="${k}">${pbTxt(ids)}</button>
    <div class="pv-pop" data-for="${k}" hidden>${P.map((p) => html`<label><input type="checkbox" value="${p.id}" ${ids.includes(p.id) ? 'checked' : ''}> ${shortName(p.name)} <span class="pc-sub">${ROLE[p.role] || ''}</span></label>`)}</div></div>`;
  const daySel = (r) => (r.cy === 'ngay' ? html`<select class="input" data-k="day" disabled><option>Mỗi ngày</option></select>`
    : html`<select class="input" data-k="day">${r.cy === 'tuan' ? DOW.slice(1).map((l, i) => opt(i + 1, l, r.day)) : Array.from({ length: 31 }, (_, i) => opt(i + 1, `Ngày ${i + 1}`, r.day))}</select>`);
  const dueSel = (r) => html`<select class="input" data-k="due">${DUE_H.map((h) => opt(h, dueTxt(h), r.due))}</select>`;
  const oneHtml = (r) => html`<div class="pv-row" data-i="0"><div class="pv-c pv-on"><b>Mọi cơ sở</b></div>
    <div class="pv-c"><span class="pv-l">Hạn làm (từ lúc web tạo việc)</span>${dueSel(r)}</div>
    <div class="pv-c"><span class="pv-l">Mức phạt (đ)</span><input class="input" type="number" min="0" step="1000" data-k="fine" value="${r.fine}"></div></div>`;
  const rowHtml = (r, i) => html`<div class="pv-row ${r.on ? '' : 'off'}" data-i="${i}" data-b="${r.b.id}">
    <label class="pv-c pv-on"><input type="checkbox" data-k="on" ${r.on ? 'checked' : ''}> <b>${r.b.code}</b></label>
    <div class="pv-c"><span class="pv-l">Người làm</span>${ktJob ? html`<span class="pb-ch kt">${D.kt ? nameOf(D.kt) : 'Chưa chọn kế toán'}</span>` : picker('acc', r.acc)}</div>
    <div class="pv-c pv-ckc"><span class="pv-l">Người kiểm tra</span>${picker('ckr', r.ckr)}</div>
    <div class="pv-c pv-ckc"><span class="pv-l">Hạn kiểm tra (từ lúc báo xong)</span><select class="input" data-k="ckh">${CHECK_H.map((h) => opt(h, hTxt(h), r.ckh))}</select></div>
    ${sch ? html`<div class="pv-c"><span class="pv-l">Chu kỳ</span><select class="input" data-k="cy">${Object.entries(CYCLE).map(([v, l]) => opt(v, l, r.cy))}</select></div>
    <div class="pv-c"><span class="pv-l">Ngày làm</span>${daySel(r)}</div>
    <div class="pv-c"><span class="pv-l">Quá hạn cho phép</span><select class="input" data-k="grace">${GRACE.map((h) => opt(h, h === 0 ? '0 (xong trong ngày)' : hTxt(h), r.grace))}</select></div>`
    : html`<div class="pv-c"><span class="pv-l">Hạn làm (từ lúc web tạo việc)</span>${dueSel(r)}</div>`}
    <div class="pv-c"><span class="pv-l">Mức phạt (đ)</span><input class="input" type="number" min="0" step="1000" data-k="fine" value="${r.fine}"></div>
  </div>`;
  const head = one ? html`<div class="pv-row pv-hd"><span></span><span>Hạn làm</span><span>Mức phạt (đ)</span></div>`
    : html`<div class="pv-row pv-hd"><span>Bật</span><span>Người làm</span><span class="pv-ckc">Người kiểm tra</span><span class="pv-ckc">Hạn kiểm tra</span>${sch ? html`<span>Chu kỳ</span><span>Ngày làm</span><span>Quá hạn cho phép</span>` : html`<span>Hạn làm (từ lúc web tạo việc)</span>`}<span>Mức phạt (đ)</span></div>`;
  const ckBox = html`<label class="pc-ck"><input type="checkbox" id="pv-check" ${chk ? 'checked' : ''}><span><b>Có kiểm tra (giai đoạn 2)</b><br><span class="pc-sub">${web ? 'Làm xong hồ sơ → người kiểm tra bấm Đạt / Làm lại. ' : ''}Bắt buộc chọn người kiểm tra + hạn kiểm tra cho từng cơ sở</span></span></label>`;
  const d = dialog(html`${STYLE_HOP}<div class="stack pc-dlg pv ${chk ? '' : 'nock'} ${web && !sch ? 'pvw' : ''} ${one ? 'pv1' : ''}">
    <h2>${isNew ? '+ Thêm việc' : html`Sửa việc: ${web ? info.name : J.name}`}${web ? html`<span class="pv-tag">Việc có sẵn · tên không đổi được</span>` : ''}</h2>
    ${web ? html`<div class="pc-sub"><b>Web tạo việc khi:</b> ${info.from || ''}${info.how ? ' · ' + info.how : ''} · tự xong khi làm xong hồ sơ.</div>` : ''}
    ${web && job.same_as_1 ? html`<div class="pc-info">Người làm đang dùng chung với "Đối soát ca". Đổi người làm ở đây sẽ tách việc này ra để chọn người riêng.</div>` : ''}
    <div class="pv-top">
      ${web ? '' : html`<label class="pc-fld"><span>Tên việc</span><input class="input" id="pv-name" value="${J.name || ''}" placeholder="vd: Vệ sinh máy pha"></label>`}
      <label class="pc-fld"><span>Hướng dẫn (người làm đọc được)</span><textarea class="input" id="pv-guide" rows="2" placeholder="Làm thế nào, chụp ảnh gì…">${J.guide || ''}</textarea></label>
      ${web ? '' : html`<label class="pc-ck"><input type="checkbox" id="pv-photo" ${J.need_photo ? 'checked' : ''}><span><b>Bắt buộc chụp ảnh khi báo xong</b><br><span class="pc-sub">Không có ảnh thì không bấm xong được</span></span></label>`}
      ${one ? '' : ckBox}
    </div>
    <div class="pc-sub">${one ? html`<b>Chung mọi cơ sở</b> (1 việc gộp cho các cơ sở).` : html`<b>Từng cơ sở</b> · ${sch ? 'Hạn = hết 23:59 ngày làm + quá hạn cho phép.' : 'Hạn tính từ lúc web tạo việc.'}`} Đổi cài đặt áp dụng cho lần tạo sau; việc đang mở giữ như cũ.</div>
    <div class="pv-rows" id="pv-rows">${head}${one ? oneHtml(ONE) : R.map(rowHtml)}</div>
    ${isNew || one || ktJob ? '' : html`<label class="pc-ck"><input type="checkbox" id="pv-apply" checked> Chuyển luôn việc đang mở sang người làm${web ? '' : ' / người kiểm tra'} mới</label>`}
    <div class="pv-cf" id="pv-cf" hidden>Xoá "${J.name}"? Các lần đang mở sẽ bị huỷ. Lịch sử, ảnh, phạt đã ghi vẫn giữ.
      <span style="margin-left:auto;display:flex;gap:8px"><button type="button" class="btn sm secondary" id="pv-del-no">Không xoá</button><button type="button" class="btn sm pv-danger solid" id="pv-del-yes">Xoá việc</button></span></div>
    <div class="alert error pc-err" hidden></div>
    <div class="pv-foot"><div>${isNew ? '' : html`<button type="button" class="btn sm secondary" id="pv-pause">${enabled ? '⏸ Tạm tắt cả việc' : '▶ Bật lại cả việc'}</button>${web ? '' : html`<button type="button" class="btn sm pv-danger" id="pv-del">Xoá việc</button>`}<span class="pc-sub" id="pv-pst">${enabled ? '' : 'Đang tạm tắt'}</span>`}</div>
      <div><button type="button" class="btn secondary" data-close>Đóng</button><button type="button" class="btn" id="pv-save">Lưu</button></div></div>
  </div>`);
  d.style.maxWidth = '1100px'; d.style.width = 'min(1100px, calc(100vw - 24px))';
  const root = $('.pv', d), er = $('.pc-err', d);
  const showErr = (m) => { er.textContent = m; er.hidden = !m; };
  const redrawRow = (i) => { if (one) return; const el = $(`.pv-row[data-i="${i}"]`, d); el.outerHTML = str(rowHtml(R[i], i)); };
  $('[data-close]', d).onclick = () => d.close();
  $('#pv-check', d)?.addEventListener('change', (e) => { chk = e.target.checked; root.classList.toggle('nock', !chk); });
  $('#pv-rows', d).addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]'); if (!b) return;
    const pop = b.parentElement.querySelector('.pv-pop'); const open = pop.hidden;
    $$('.pv-pop', d).forEach((x) => { x.hidden = true; }); pop.hidden = !open;
  });
  $('#pv-rows', d).addEventListener('change', (e) => {
    const row = e.target.closest('.pv-row[data-i]'); if (!row) return; const i = +row.dataset.i, r = one ? ONE : R[i];
    const pop = e.target.closest('.pv-pop');
    if (pop) { const ids = $$('input:checked', pop).map((x) => +x.value); r[pop.dataset.for] = ids; pop.parentElement.querySelector('.pv-pb').textContent = pbTxt(ids); return; }
    const k = e.target.dataset.k;
    if (k === 'on') { r.on = e.target.checked; redrawRow(i); }
    else if (k === 'cy') { r.cy = e.target.value; r.day = 1; redrawRow(i); }
    else if (k === 'day') r.day = +e.target.value;
    else if (k === 'grace') r.grace = +e.target.value;
    else if (k === 'ckh') r.ckh = +e.target.value;
    else if (k === 'due') r.due = +e.target.value;
    else if (k === 'fine') r.fine = Math.max(0, +e.target.value || 0);
  });
  $('#pv-rows', d).addEventListener('input', (e) => { if (e.target.dataset.k === 'fine') { const i = +e.target.closest('.pv-row').dataset.i; (one ? ONE : R[i]).fine = Math.max(0, +e.target.value || 0); } });
  $('#pv-pause', d)?.addEventListener('click', (e) => { enabled = !enabled; e.target.textContent = enabled ? '⏸ Tạm tắt cả việc' : '▶ Bật lại cả việc'; $('#pv-pst', d).textContent = enabled ? 'Bấm Lưu để bật lại' : 'Bấm Lưu để tạm tắt'; });
  $('#pv-del', d)?.addEventListener('click', () => { $('#pv-cf', d).hidden = false; });
  $('#pv-del-no', d)?.addEventListener('click', () => { $('#pv-cf', d).hidden = true; });
  const run = async (btn, fn) => { btn.disabled = true; showErr(''); try { await fn(); d.close(); } catch (e) { showErr(e.message || String(e)); } finally { btn.disabled = false; } };
  $('#pv-del-yes', d)?.addEventListener('click', (e) => run(e.target, async () => {
    const n = await rpc('app_pc_custom_delete', { p_job: J.job });
    await done(`Đã xoá "${J.name}"${n ? ' · huỷ ' + n + ' lần đang mở' : ''}`);
  }));
  $('#pv-save', d).addEventListener('click', (e) => run(e.target, async () => {
    if (web) {
      const apply = $('#pv-apply', d)?.checked ?? false;
      await rpc('app_pc_job_save', { p_job: job.job, p: one
        ? { enabled, guide: $('#pv-guide', d).value.trim(), need_check: false, fine: ONE.fine, due_d: ONE.due / 24 }
        : { enabled, guide: $('#pv-guide', d).value.trim(), need_check: chk, fine: job.fine,
            rows: R.map((r) => ({ branch_id: r.b.id, enabled: r.on, due_h: sch ? null : r.due, fine: r.fine, checkers: chk ? r.ckr : [], check_h: r.ckh,
              cycle: sch ? r.cy : null, day: sch && r.cy !== 'ngay' ? +r.day : null, grace_h: r.grace })) } });
      let n = 0;
      if (!one && !ktJob) for (const [i, r] of R.entries()) if (r.acc.join(',') !== acc0[i]) n += (await rpc('app_pc_assign_save', { p_job: job.job, p_branch: r.b.id, p_accounts: r.acc, p_apply: apply })) || 0;
      await done(`Đã lưu "${info.name}"${n ? ' · chuyển ' + n + ' việc đang mở' : ''}`);
      return;
    }
    const name = $('#pv-name', d).value.trim();
    await rpc('app_pc_custom_save', { p_job: J.job || null, p: {
      name, guide: $('#pv-guide', d).value.trim(), need_photo: $('#pv-photo', d).checked, need_check: chk, enabled, apply: $('#pv-apply', d)?.checked ?? false,
      rows: R.map((r) => ({ branch_id: r.b.id, enabled: r.on, accounts: r.acc, cycle: r.cy, day: r.cy === 'ngay' ? null : +r.day, grace_h: r.grace, fine: r.fine, checkers: chk ? r.ckr : [], check_h: r.ckh })),
    } });
    await done(`Đã lưu "${name}"`);
  }));
  return d;
}
