// Nghỉ & làm thay (quy định x2, chốt 11/11/2026): Quản lý tổng phân loại người nghỉ / người hỗ trợ của ca, chọn đãi ngộ x2;
// Chủ duyệt (sửa được) thì phiếu mới hoàn thành đối soát. Dùng ở bước Nhân sự của trang Đối soát ca.
import { rpc } from './sb.js';
import { dt } from './tien.js';
import { $$, html, str } from './ui.js';

export const REASONS = [['tu_tim', 'Tự tìm người thay — không trừ'], ['nho_ql', 'Nhờ quản lý tìm — người nghỉ bị trừ giờ'], ['ma_chay', 'Ma chay tứ thân phụ mẫu — không trừ']];
export const CV_STATE = {
  khong_can: ['Không có người nghỉ / hỗ trợ', 'mute'], chua_phan_loai: ['Chưa phân loại', 'off'], lech: ['Nhân sự đã đổi — phân loại lại', 'off'],
  cho_duyet: ['Chờ Chủ duyệt', 'warn'], da_duyet: ['Chủ đã duyệt', 'ok'],
};
const hrs = (h) => (Number(h) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export const CV_CSS = html`<style>
  .cv-row { border: 1px solid var(--line-soft); border-left: 4px solid #f59e0b; border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
  .cv-row.ok { border-left-color: var(--ok-line); }
  .cv-grid { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .cv-grid > * { min-width: 0; max-width: 100%; }
  .cv-grid select.input { flex: 1 1 200px; width: auto; }
  .cv-grid .cv-h { width: 80px; }
  .cv-grid .cv-on { flex: 1 1 160px; width: auto; }
  .cv-x2 { display: inline-flex; gap: 6px; align-items: center; font-weight: 700; color: #b45309; }
  .cv-sum { font-size: 14px; }
</style>`;

export async function mountCover(box, R, ctx = {}) {
  if (!box) return;
  let C;
  try { C = await rpc('app_cv_get', { p_id: R.id }); } catch (e) { box.innerHTML = str(html`<div class="alert error">${e.message}</div>`); return; }
  const st = CV_STATE[C.state] || [C.state, 'mute'];
  if (ctx.sum) {
    ctx.sum.innerHTML = C.state === 'khong_can' ? '' : str(html`<div class="pc-line ds-sum"><strong class="grow">Nghỉ & làm thay (x2)</strong><span class="pill ${st[1]}">${st[0]}</span>
      ${C.state === 'da_duyet' ? '' : html`<span class="st-meta">Chủ duyệt thì phiếu mới hoàn thành đối soát.</span><button type="button" class="btn sm secondary" data-ds-go="0">Làm ở bước 1</button>`}</div>`);
  }
  if (C.state === 'khong_can') {
    box.innerHTML = str(html`<div class="pc-sec-head"><h2>Nghỉ & làm thay</h2></div><div class="st-meta">Ca này không có người nghỉ hay người hỗ trợ phát sinh — không cần phân loại.</div>`);
    return;
  }
  const absents = C.people.filter((p) => p.kind === 'nghi');
  const helpers = C.people.filter((p) => p.kind === 'ho_tro');
  const pName = (id) => { const p = C.people.find((x) => x.employee_id === id); return p ? `${p.code} – ${p.name}` : ''; };
  const valid = C.state === 'cho_duyet' || C.state === 'da_duyet';
  const rowOf = (absentId) => (valid ? C.rows.find((r) => r.absent_id === absentId) : null);
  const extraOf = (hid) => (valid ? C.rows.find((r) => r.absent_id === null && r.helper_id === hid) : null);
  const canEdit = C.can_classify && C.recon_status !== 'hoan_thanh' && C.open;

  const readOnly = () => html`${C.rows.map((r) => html`<div class="cv-row ${C.state === 'da_duyet' ? 'ok' : ''}">
      <div>${r.absent ? html`<strong>${r.absent}</strong> nghỉ · ${r.reason_label}` : html`<strong>${r.helper}</strong> làm thêm · ${r.reason_label}`}</div>
      ${r.absent && r.helper ? html`<div>Người làm thay: <strong>${r.helper}</strong>${r.outsider ? ' (người ngoài quán — chỉ ghi chú báo cáo lương)' : ''} · ${hrs(r.hours)} giờ</div>` : ''}
      <div>${r.helper ? html`Đãi ngộ: <strong>${r.x2 ? 'x2 lương' : 'lương thường'}</strong>` : ''}${Number(r.deduct_hours) > 0 ? html` · <span style="color:#b91c1c;font-weight:700">${r.absent} bị trừ ${hrs(r.deduct_hours)} giờ</span>` : ''}</div>
      ${r.complaint_absent ? html`<div class="st-meta">Khiếu nại của người nghỉ: ${r.complaint_absent}</div>` : ''}
      ${r.complaint_helper ? html`<div class="st-meta">Khiếu nại của người làm thay: ${r.complaint_helper}</div>` : ''}
      ${r.resolved_at ? html`<div class="st-meta">Đã xem khiếu nại · ${r.resolved_by_name || ''} ${dt(r.resolved_at)}${r.resolve_note ? ' · ' + r.resolve_note : ''}</div>` : ''}</div>`)}`;

  const helperOpts = (sel, absentId) => html`<option value="">— Không có người làm thay —</option>
    ${helpers.map((h) => html`<option value="${h.employee_id}" ${String(sel) === String(h.employee_id) ? 'selected' : ''}>${h.code} – ${h.name} (${hrs(h.hours)} giờ)</option>`)}
    <option value="ngoai" ${sel === 'ngoai' ? 'selected' : ''}>Người ngoài quán…</option>`;
  const editor = () => html`
    ${absents.map((a) => { const r = rowOf(a.employee_id) || {}; const hsel = r.helper_id || (r.outsider ? 'ngoai' : '');
      return html`<div class="cv-row cv-a" data-absent="${a.employee_id}">
        <div><strong>${a.code} – ${a.name}</strong> <span class="pill off">Nghỉ</span></div>
        <div class="cv-grid"><select class="input sm cv-reason" aria-label="Lý do nghỉ của ${a.code}"><option value="">— Chọn lý do —</option>${REASONS.map(([k, l]) => html`<option value="${k}" ${r.reason === k ? 'selected' : ''}>${l}</option>`)}</select></div>
        <div class="cv-grid"><select class="input sm cv-helper" aria-label="Người làm thay cho ${a.code}">${helperOpts(hsel, a.employee_id)}</select>
          <input class="input sm cv-on" placeholder="Tên người ngoài quán" value="${r.outsider ? r.helper_name || r.helper || '' : ''}" ${hsel === 'ngoai' ? '' : 'hidden'} aria-label="Tên người ngoài quán">
          <label class="cv-hl" ${hsel ? '' : 'hidden'}>Giờ làm thay <input class="input sm cv-h" type="number" min="0" max="24" step="0.25" value="${r.hours ?? (helpers.find((h) => String(h.employee_id) === String(hsel)) || {}).hours ?? ''}"></label>
          <label class="cv-x2" ${hsel ? '' : 'hidden'}><input type="checkbox" class="check cv-x" ${r.x2 ? 'checked' : ''}> Người làm thay được x2</label></div>
      </div>`; })}
    <div class="stack cv-extra" style="gap:8px"></div>
    <div id="cv-err"></div>
    <div class="toolbar" style="gap:6px;justify-content:flex-end">
      <button type="button" class="btn sm ${C.is_owner ? 'secondary' : ''}" id="cv-save">Lưu phân loại</button>
      ${C.is_owner ? html`<button type="button" class="btn sm" id="cv-ok">Duyệt${C.state === 'da_duyet' ? ' lại' : ''}</button>` : ''}</div>`;

  const draw = () => {
    box.innerHTML = str(html`<div class="pc-sec-head"><h2>Nghỉ & làm thay <span class="pill ${st[1]}">${st[0]}</span></h2></div>
      <div class="st-meta">Quản lý tổng chọn lý do nghỉ và đãi ngộ người làm thay (x2 hay không). Nhờ quản lý tìm người thì người nghỉ luôn bị trừ đúng số giờ người thay làm.
        Chủ duyệt thì phiếu mới hoàn thành đối soát, người nghỉ và người làm thay được báo và được khiếu nại.
        Sửa danh sách ở mục "Nhân viên thực tế làm trong ca" trước rồi mới phân loại.</div>
      ${C.set_at ? html`<div class="st-meta">Phân loại: ${C.set_by || ''} ${dt(C.set_at)}${C.ok_at ? html` · <strong>Chủ duyệt: ${C.ok_by || ''} ${dt(C.ok_at)}</strong>${C.ok_note ? ' · ' + C.ok_note : ''}` : ''}</div>` : ''}
      ${canEdit ? editor() : valid ? readOnly() : html`<div class="alert warn">Chờ Quản lý tổng phân loại ${absents.length} người nghỉ, ${helpers.length} người hỗ trợ.</div>`}`);
    if (canEdit) bind();
  };
  // người hỗ trợ chưa gắn với người nghỉ nào → làm thêm vì quản lý không xếp đủ lịch
  const drawExtra = () => {
    const used = new Set($$('.cv-a .cv-helper', box).map((s) => s.value).filter((v) => v && v !== 'ngoai'));
    const wrap = box.querySelector('.cv-extra'); if (!wrap) return;
    const keep = Object.fromEntries($$('.cv-e', wrap).map((e) => [e.dataset.helper, e.querySelector('.cv-x').checked]));
    wrap.innerHTML = str(html`${helpers.filter((h) => !used.has(String(h.employee_id))).map((h) => { const r = extraOf(h.employee_id) || {}; const x2 = keep[h.employee_id] ?? !!r.x2;
      return html`<div class="cv-row cv-e" data-helper="${h.employee_id}"><div><strong>${h.code} – ${h.name}</strong> <span class="pill warn">Hỗ trợ</span> · ${hrs(h.hours)} giờ</div>
        <div class="st-meta">Không làm thay ai → tính là <strong>Quản lý không xếp đủ lịch</strong> (không ai bị trừ).</div>
        <label class="cv-x2"><input type="checkbox" class="check cv-x" ${x2 ? 'checked' : ''}> Được x2</label></div>`; })}`);
  };
  const items = () => [
    ...$$('.cv-a', box).map((r) => { const hv = r.querySelector('.cv-helper').value;
      return { absent_id: Number(r.dataset.absent), reason: r.querySelector('.cv-reason').value, helper_id: hv && hv !== 'ngoai' ? Number(hv) : null,
        helper_name: hv === 'ngoai' ? r.querySelector('.cv-on').value.trim() : null, hours: hv ? r.querySelector('.cv-h').value : null, x2: hv ? r.querySelector('.cv-x').checked : false }; }),
    ...$$('.cv-e', box).map((r) => ({ absent_id: null, reason: 'thieu_lich', helper_id: Number(r.dataset.helper), x2: r.querySelector('.cv-x').checked })),
  ];
  const err = (m) => { const x = box.querySelector('#cv-err'); if (x) x.innerHTML = str(html`<div class="alert error">${m}</div>`); };
  function bind() {
    drawExtra();
    $$('.cv-helper', box).forEach((s) => s.addEventListener('change', () => {
      const r = s.closest('.cv-a'); const v = s.value;
      r.querySelector('.cv-on').hidden = v !== 'ngoai'; r.querySelector('.cv-hl').hidden = !v; r.querySelector('.cv-x2').hidden = !v;
      const h = helpers.find((x) => String(x.employee_id) === v); if (h) r.querySelector('.cv-h').value = h.hours;
      drawExtra();
    }));
    box.querySelector('#cv-save').addEventListener('click', async () => {
      try { await rpc('app_cv_save', { p_id: R.id, p_items: items() }); ctx.onChange?.(); } catch (e) { err(e.message); }
    });
    box.querySelector('#cv-ok')?.addEventListener('click', async () => {
      const note = prompt('Duyệt nghỉ / làm thay. Ghi chú (không bắt buộc):', ''); if (note === null) return;
      try { await rpc('app_cv_approve', { p_id: R.id, p_items: items(), p_note: note }); ctx.onChange?.(); } catch (e) { err(e.message); }
    });
  }
  draw();
}
