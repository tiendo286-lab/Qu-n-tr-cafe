// Giờ chốt ca (bước 162): dòng "Giờ doanh thu" + ô ✎ Sửa giờ chốt dùng chung cho khối tiền (② Phần tiền của trang đối soát ca — thiết kế 22/11; trước là Sổ thu chi › Đối soát Fabi) và trang Đối soát ca.
// Trang chỉ đặt ô giữ chỗ <div class="stc-gio" data-gio-ca="<id ca>"></div>; watchGio(root, onSaved) tự lấp mỗi khi trang vẽ lại.
// Máy chủ (tệp 144): app_ca_gio (đọc), app_ca_gio_save (sửa tay — chỉ khi ca chưa có file Fabi). Có file Fabi thì giờ chốt tự theo file.
import { rpc } from './sb.js';
import { dialog, html, once, showSaved, str } from './ui.js';
import { gioCheck, gioFabiNote, gioPreview } from './gio_chot_tinh.js';

const hm = (s) => (s ? String(s).slice(11, 16) : '–');
const dm = (s) => (s ? `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}` : '');
const toIn = (s) => String(s || '').replace(' ', 'T').slice(0, 16);
const fromIn = (s) => String(s || '').replace('T', ' ').slice(0, 16);
const ACT = { sua_gio: 'Sửa tay', gio_fabi: 'Theo file Fabi', sua_gio_theo: 'Theo ca trước' };

export function gioLine(g) {
  const note = gioFabiNote(g);
  const nextDay = g.rev_end && g.date && String(g.rev_end).slice(0, 10) !== g.date ? ` (${dm(g.rev_end)})` : '';
  return html`<div class="gio-line"><span>Giờ doanh thu <b>${hm(g.rev_start)} → ${hm(g.rev_end)}${nextDay}</b></span>
    ${note ? html`<span class="pill ${note.cls}">${note.txt}</span>` : ''}
    ${g.can_edit ? html`<button type="button" class="btn sm secondary" data-gio="${g.id}">✎ Sửa giờ chốt</button>` : ''}</div>`;
}

async function fill(el) {
  el.dataset.gioState = 'loading';
  try { el.innerHTML = str(gioLine(await rpc('app_ca_gio', { p_report: Number(el.dataset.gioCa) }))); el.dataset.gioState = 'done'; }
  catch (_) { el.innerHTML = ''; el.dataset.gioState = 'err'; }   // không có quyền xem / lỗi mạng: không hiện dòng giờ
}

export function fillGio(root) { root.querySelectorAll('.stc-gio[data-gio-ca]:not([data-gio-state])').forEach(fill); }

// Gắn một lần cho mỗi phần tử gốc: lấp ô giữ chỗ (cả khi trang vẽ lại một phần) + bắt nút ✎ Sửa giờ chốt
export function watchGio(root, onSaved) {
  if (!root) return;
  fillGio(root);
  if (root.__gio) { root.__gio.onSaved = onSaved; return; }
  root.__gio = { onSaved };
  new MutationObserver(() => fillGio(root)).observe(root, { childList: true, subtree: true });
  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-gio]');
    if (b && root.contains(b)) gioDialog(Number(b.dataset.gio), { onSaved: root.__gio.onSaved });
  });
}

export async function gioDialog(id, { onSaved } = {}) {
  let g;
  try { g = await rpc('app_ca_gio', { p_report: id }); } catch (e) { showSaved(e.message || String(e), true); return; }
  if (!g.can_edit) { showSaved(g.by_fabi ? 'Ca đã có file Fabi — giờ chốt lấy theo file.' : 'Bạn không sửa được giờ chốt của ca này.', true); return; }
  const note = gioFabiNote(g);
  const log = (g.log || []).slice(0, 3);
  const d = dialog(html`<form class="stack gio-dlg" style="gap:10px"><h2 style="margin:0">Sửa giờ chốt · Ca ${g.shift} ${dm(g.date)}</h2>
    <div class="st-meta">Giờ bắt đầu <b>${hm(g.rev_start)}</b> (${g.shift === 'Sáng' ? 'ca Sáng luôn 06:45' : 'bằng giờ chốt ca trước'}) · giờ chốt hiện tại <b>${hm(g.rev_end)}</b>${note ? html` · <span class="pill ${note.cls}">${note.txt}</span>` : ''}</div>
    <label class="field"><span>Giờ chốt mới <small class="st-meta">(qua nửa đêm thì chọn ngày hôm sau)</small></span><input class="input" type="datetime-local" name="end" value="${toIn(g.rev_end)}"></label>
    <div class="st-meta gio-pv"></div>
    <label class="field"><span>Lý do (bắt buộc)</span><input class="input" name="reason" placeholder="vd: nhập nhầm / chốt ca bổ sung"></label>
    ${log.length ? html`<div class="st-meta gio-log"><b>Đã sửa:</b>${log.map((x) => html`<div>${x.at || ''} · ${x.by_name || ''} · ${ACT[x.action] || x.action}: ${hm(x.before)} → ${hm(x.after)}${x.reason ? ' · ' + x.reason : ''}</div>`)}</div>` : ''}
    <div class="alert error gio-err" hidden></div>
    <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
  const end = d.querySelector('[name=end]'); const pv = d.querySelector('.gio-pv'); const er = d.querySelector('.gio-err');
  const showErr = (m) => { er.textContent = m; er.hidden = false; };
  const upd = () => { pv.textContent = gioPreview(g, fromIn(end.value)) || ''; };
  end.addEventListener('input', upd); upd();
  d.querySelector('[data-x]').addEventListener('click', () => d.close());
  const save = once(async () => {
    const v = fromIn(end.value); const r = d.querySelector('[name=reason]').value;
    const bad = gioCheck(g, v, r); if (bad) { showErr(bad); return; }
    try {
      await rpc('app_ca_gio_save', { p_report: id, p_end: v, p_reason: r.trim() });
      d.close();
      if (onSaved) onSaved(); else showSaved('Đã sửa giờ chốt');
    } catch (e) { showErr(e.message || String(e)); }
  });
  d.querySelector('form').addEventListener('submit', (ev) => { ev.preventDefault(); save(ev); });
}
