// Soạn nội quy / quy trình: lưu nháp tự động, xem trước, đăng cho nhân viên xem
import { render as rerender } from '../app.js';
import { DOC_BUCKET, DOC_STYLE, TOOLBAR, bindEditor, fillImages, sanitize, toStore } from '../editor.js';
import { rpc, sb } from '../sb.js';
import { dt } from '../tien.js';
import { $, flash, go, hhmm, html, raw, showSaved } from '../ui.js';
import { KINDS, DEFAULT_PROCEDURE } from './tai_lieu.js';

export const perm = 'soan_tai_lieu';

export async function render({ params }) {
  let D = params.id ? await rpc('app_tl_get', { p_id: Number(params.id) }) : { id: null, kind: params.loai === 'quy_trinh' ? 'quy_trinh' : 'noi_quy', title: '', draft_html: '', published_version: 0 };
  const [label, back] = KINDS[D.kind];
  const isProcedure = D.kind === 'quy_trinh';
  const siblings = isProcedure ? await rpc('app_tl_list', { p_kind: 'quy_trinh' }) : [];
  const procedureReady = !isProcedure || siblings.every((d) => typeof d.procedure_title === 'string');
  const procedure = D.procedure_title || (D.id || !procedureReady ? DEFAULT_PROCEDURE : params.nhom || '');
  const groups = [...new Set(siblings.map((d) => d.procedure_title || DEFAULT_PROCEDURE))];
  const backLink = isProcedure && procedure ? `${back}?nhom=${encodeURIComponent(procedure)}` : back;
  return {
    title: D.id ? `Sửa: ${D.title}` : `Soạn ${label.toLowerCase()} mới`,
    html: html`${raw(DOC_STYLE)}
      <div class="page-head"><div><h1>${D.id ? 'Sửa ' + label.toLowerCase() : 'Soạn ' + label.toLowerCase() + ' mới'}</h1>
        <div class="sub" id="ed-status">${D.published_version ? `Đang đăng phiên bản ${D.published_version} (${dt(D.published_at)}). Sửa ở đây là bản nháp — nhân viên chỉ thấy sau khi bấm Đăng.` : 'Chưa đăng — nhân viên chưa thấy tài liệu này.'}</div></div>
        <div class="toolbar"><a class="btn sm secondary" href="#${backLink}">‹ ${label}</a><div id="saved-indicator" class="saved" role="status" hidden></div></div></div>
      <div class="stack" style="max-width:900px;gap:10px">
        ${isProcedure && !procedureReady ? html`<div class="alert warn">Cần cập nhật máy chủ để thêm quy trình khác. Hiện vẫn lưu và đăng được bài trong Quy trình nhân viên order.</div>` : ''}
        ${isProcedure ? html`<label for="ed-procedure">Tên quy trình</label><input class="input" id="ed-procedure" ${procedureReady ? '' : 'readonly'} list="ed-procedures" maxlength="160" placeholder="Ví dụ: Quy trình pha chế" value="${procedure}"><datalist id="ed-procedures">${groups.map((name) => html`<option value="${name}"></option>`)}</datalist><div class="st-meta">Chọn quy trình có sẵn hoặc nhập tên mới. Quy trình mới được tạo khi lưu bài đầu tiên; nhân viên chỉ thấy bài đã đăng.</div><label for="ed-title">Tên bài hướng dẫn</label>` : ''}
        <input class="input" id="ed-title" placeholder="${isProcedure ? 'Ví dụ: Mở cửa ca sáng' : 'Tiêu đề (vd: Nội quy giờ giấc và đồng phục)'}" value="${D.title}" aria-label="Tiêu đề">
        <div class="ed-tools" id="ed-tools" role="toolbar" aria-label="Định dạng">${TOOLBAR.map(([c, t, l]) => html`<button type="button" data-cmd="${c}" title="${t}" aria-label="${t}">${l}</button>`)}</div>
        <div class="ed-area doc" id="ed-area" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Nội dung">${raw(sanitize(D.draft_html) || '<p><br></p>')}</div>
        <div class="toolbar" style="gap:8px">
          <button type="button" class="btn secondary" id="ed-save">Lưu nháp</button>
          <button type="button" class="btn secondary" id="ed-preview">Xem trước</button>
          <button type="button" class="btn" id="ed-publish">Đăng cho nhân viên xem</button>
          ${D.published_version ? html`<button type="button" class="btn sm secondary" id="ed-unpub">Gỡ khỏi trang nhân viên</button>` : ''}
          ${D.id ? html`<button type="button" class="btn sm secondary danger" id="ed-del" style="margin-left:auto">Xóa tài liệu</button>` : ''}</div>
        <div class="st-meta" style="font-size:12px;color:var(--muted)">Bản nháp tự lưu sau mỗi lần sửa. Dán từ Word / Google Docs được (định dạng lạ sẽ được lọc bỏ; ảnh hãy chèn bằng nút 🖼 Ảnh).</div>
        <section class="card" id="ed-prev" hidden><div class="st-meta" style="margin-bottom:8px">XEM TRƯỚC — nhân viên sẽ thấy như sau</div><h2 id="prev-title" style="margin:0 0 6px"></h2><div class="doc" id="prev-body"></div></section>
      </div>`,
    async mount() {
      const area = $('#ed-area'); const title = $('#ed-title'); const group = $('#ed-procedure');
      let timer = null; let saving = null; let dirty = false;
      const save = async (force) => {
        clearTimeout(timer);
        if (saving) await saving;
        if (!dirty && !force) return D.id;
        if (!title.value.trim()) { showSaved('Nhập tiêu đề để lưu.', true); throw new Error('Nhập tiêu đề tài liệu.'); }
        if (group && !group.value.trim()) { showSaved('Nhập tên quy trình để lưu.', true); throw new Error('Nhập tên quy trình.'); }
        dirty = false;
        saving = (isProcedure && procedureReady
          ? rpc('app_tl_save_procedure', { p_id: D.id, p_title: title.value, p_html: toStore(area), p_procedure: group.value.trim() })
          : rpc('app_tl_save', { p_id: D.id, p_kind: D.kind, p_title: title.value, p_html: toStore(area) }))
          .then((id) => { if (!D.id) { D.id = id; history.replaceState(null, '', `#/tai-lieu/soan?id=${id}`); } showSaved('Đã lưu nháp · ' + hhmm()); return id; })
          .catch((e) => { dirty = true; showSaved('Chưa lưu được: ' + e.message, true); throw e; })
          .finally(() => { saving = null; });
        return saving;
      };
      const changed = () => { dirty = true; clearTimeout(timer); timer = setTimeout(() => { if (title.value.trim()) save().catch(() => {}); }, 2000); };
      bindEditor({ toolbar: $('#ed-tools'), area, getDocId: () => save(true), onChange: changed, onError: (m) => showSaved(m, true) });
      title.addEventListener('input', changed);
      group?.addEventListener('input', changed);
      await fillImages(area);
      $('#ed-save').addEventListener('click', () => save(true).catch(() => {}));
      $('#ed-preview').addEventListener('click', async () => {
        const p = $('#ed-prev'); p.hidden = !p.hidden;
        if (!p.hidden) { $('#prev-title').textContent = title.value; $('#prev-body').innerHTML = toStore(area); await fillImages(p); p.scrollIntoView({ behavior: 'smooth' }); }
      });
      $('#ed-publish').addEventListener('click', async () => {
        if (!confirm(D.kind === 'noi_quy' ? 'Đăng nội quy này cho nhân viên? Mọi người sẽ nhận thông báo và phải bấm “Tôi đã đọc” lại.' : 'Đăng quy trình này cho nhân viên xem? Mọi người sẽ nhận thông báo.')) return;
        try { await save(true); const v = await rpc('app_tl_publish', { p_id: D.id }); flash(`Đã đăng phiên bản ${v}.`); go(`${back}?id=${D.id}`); } catch (e) { showSaved(e.message, true); }
      });
      $('#ed-unpub')?.addEventListener('click', async () => {
        if (!confirm('Gỡ tài liệu khỏi trang nhân viên? Bản nháp vẫn giữ, trạng thái đã đọc sẽ bị xóa.')) return;
        try { await rpc('app_tl_unpublish', { p_id: D.id }); flash('Đã gỡ khỏi trang nhân viên.'); rerender(); } catch (e) { showSaved(e.message, true); }
      });
      $('#ed-del')?.addEventListener('click', async () => {
        if (!confirm('Xóa hẳn tài liệu này (cả bản đã đăng)?')) return;
        try {
          dirty = false; clearTimeout(timer);
          const paths = await rpc('app_tl_delete', { p_id: D.id });
          if (paths && paths.length) await sb.storage.from(DOC_BUCKET).remove(paths).catch(() => {});
          flash('Đã xóa tài liệu.'); go(back);
        } catch (e) { showSaved(e.message, true); }
      });
      return () => { if (dirty && title.value.trim()) save().catch(() => {}); };
    },
  };
}
