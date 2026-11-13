// Nội quy / Quy trình: thư viện nhiều bộ quy trình, trạng thái training & đánh giá của nhân viên
import { render as rerender, can, isManager } from '../app.js';
import { DOC_STYLE, fillImages, sanitize, zoomImages } from '../editor.js';
import { rating } from '../danh_gia.js';
import { rpc } from '../sb.js';
import { dmy, dt } from '../tien.js';
import { $, $$, html, norm, raw, showSaved } from '../ui.js';

export const DEFAULT_PROCEDURE = 'Quy trình nhân viên order';
export const procedureOf = (d) => d.procedure_title || DEFAULT_PROCEDURE;
export const KINDS = { noi_quy: ['Nội quy', '/noi-quy'], quy_trinh: ['Quy trình', '/quy-trinh'] };

const TRAINING_LABEL = {
  hoan_thanh: ['Đã hoàn thành', 'ok'],
  dang_dao_tao: ['Đang training', 'info'],
  dao_tao_tiep: ['Đào tạo tiếp', 'warn'],
};

export async function render({ params, me }) {
  const kind = location.hash.startsWith('#/quy-trinh') ? 'quy_trinh' : 'noi_quy';
  const isProcedure = kind === 'quy_trinh';
  const [label] = KINDS[kind];
  const editor = can('soan_tai_lieu');
  const [docs, trainings, evaluation] = await Promise.all([
    rpc('app_tl_list', { p_kind: kind }),
    isProcedure && me.employee_id ? rpc('app_dt_mine').catch(() => []) : [],
    isProcedure && me.employee_id ? rpc('app_dg_mine').catch(() => null) : null,
  ]);
  const procedureReady = !isProcedure || docs.every((d) => typeof d.procedure_title === 'string');
  const focus = Number(params.id) || null;
  const visible = docs.filter((d) => d.published_version > 0 || editor);
  const groups = [...new Set(visible.map(procedureOf))];
  const selected = isProcedure ? (focus ? procedureOf(visible.find((d) => d.id === focus) || {}) : params.nhom || '') : '';
  const shown = selected ? visible.filter((d) => procedureOf(d) === selected) : visible;
  const groupHome = isProcedure && !selected;
  const groupUrl = (name) => `/quy-trinh?nhom=${encodeURIComponent(name)}`;
  const createUrl = `/tai-lieu/soan?loai=${kind}${selected ? '&nhom=' + encodeURIComponent(selected) : ''}`;
  const seg = html`<div class="seg" role="tablist">${Object.entries(KINDS).map(([k, [l, p]]) => html`<a href="#${p}" class="${k === kind ? 'on' : ''}">${l}</a>`)}</div>`;

  const training = (trainings || []).find((t) => t.role === 'hoc') || null;
  const isWaitstaff = !!training || evaluation?.set_code === 'cb';
  const latestEval = evaluation?.marks?.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
  const evalRating = evaluation?.set_code === 'cb' && evaluation.score !== null ? rating(evaluation.score) : null;
  const personalStatus = isWaitstaff ? html`<section class="qt-my-status card" aria-label="Trạng thái training và đánh giá của tôi">
      <div class="qt-status-title">TRẠNG THÁI CỦA TÔI</div>
      <div class="qt-status-item"><span class="qt-status-icon" aria-hidden="true">◇</span><div><strong>Training chạy bàn</strong><small>${training ? `${training.achieved}/${training.total} hạng mục đạt` : 'Chưa có phiếu đào tạo'}</small></div>
        ${training ? html`<span class="pill ${TRAINING_LABEL[training.status]?.[1] || 'mute'}">${TRAINING_LABEL[training.status]?.[0] || 'Chưa bắt đầu'}</span>` : html`<span class="pill mute">Chưa training</span>`}</div>
      <div class="qt-status-item"><span class="qt-status-icon" aria-hidden="true">✓</span><div><strong>Đánh giá chạy bàn tháng này</strong><small>${latestEval ? `Gần nhất ${dmy(latestEval.date)}` : 'Chưa có lần trừ điểm hoặc nhắc nhở'}</small></div>
        ${evalRating ? html`<span class="pill ${evalRating[2]}">${evaluation.score}/100 · ${evalRating[1]}</span>` : html`<span class="pill mute">Chưa đánh giá</span>`}</div>
      <div class="qt-status-links">${training ? html`<a href="#/dao-tao/phieu?id=${training.id}">Xem phiếu đào tạo →</a>` : ''}${evaluation?.set_code === 'cb' ? html`<a href="#/cua-toi/danh-gia">Xem điểm đánh giá →</a>` : ''}</div>
    </section>` : '';

  const card = (d, i) => {
    const published = d.published_version > 0;
    const read = d.read_version && d.read_version === d.published_version;
    const state = !published ? 'draft' : d.has_draft ? 'changed' : 'published';
    return html`<details class="card stack doc-card ${isProcedure ? 'qt-doc-card' : ''}" data-search="${norm(`${d.published_title || d.title} ${d.title}`)}" data-state="${state}" ${focus ? (focus === d.id ? 'open' : '') : ((isProcedure ? i === 0 : shown.length <= 2 || i === 0) ? 'open' : '')} id="doc-${d.id}">
      <summary class="doc-sum">${isProcedure ? html`<span class="qt-number">${String(i + 1).padStart(2, '0')}</span>` : ''}<span class="doc-title">${published ? d.published_title : d.title}</span>
        ${kind === 'noi_quy' && me.employee_id && published ? (read ? html`<span class="pill ok">Đã đọc</span>` : html`<span class="pill off">Chưa đọc</span>`) : ''}
        ${editor && !published ? html`<span class="pill mute">Chưa đăng</span>` : ''}
        ${editor && published && d.has_draft ? html`<span class="pill warn">Có sửa đổi chưa đăng</span>` : ''}</summary>
      ${published ? html`<div class="st-meta">Đăng ${dt(d.published_at)} · phiên bản ${d.published_version}${d.published_by ? ' · ' + d.published_by : ''}</div>
        <div class="doc">${raw(sanitize(d.published_html))}</div>` : html`<div class="st-meta">Bài này chưa đăng nên nhân viên chưa thấy. Bấm Sửa để soạn và đăng.</div>`}
      ${kind === 'noi_quy' && me.employee_id && published ? (read ? html`<div class="alert ok">Bạn đã xác nhận đọc lúc ${dt(d.read_at)}.</div>`
        : html`<div><button type="button" class="btn read-btn" data-id="${d.id}">Tôi đã đọc và hiểu nội quy này</button></div>`) : ''}
      ${editor ? html`<div class="toolbar qt-doc-actions"><a class="btn sm secondary" href="#/tai-lieu/soan?id=${d.id}">Sửa bài</a>
        <button type="button" class="btn sm secondary mv" data-id="${d.id}" data-dir="-1" aria-label="Đưa bài lên" ${isProcedure && i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="btn sm secondary mv" data-id="${d.id}" data-dir="1" aria-label="Đưa bài xuống" ${isProcedure && i === shown.length - 1 ? 'disabled' : ''}>↓</button>
        <span class="st-meta">Sửa gần nhất ${dt(d.updated_at)}${d.updated_by ? ' · ' + d.updated_by : ''}</span></div>` : ''}
    </details>`;
  };

  const unread = kind === 'noi_quy' && me.employee_id ? docs.filter((d) => d.published_version > 0 && d.read_version !== d.published_version).length : 0;
  const countDrafts = (items) => items.filter((d) => !d.published_version || d.has_draft).length;
  const createButton = editor && procedureReady ? html`<a class="btn" href="#${createUrl}">${groupHome ? '+ Tạo quy trình' : '+ Thêm bài'}</a>` : '';
  const procedureCards = groups.map((name) => {
    const items = visible.filter((d) => procedureOf(d) === name);
    const published = items.filter((d) => d.published_version > 0).length;
    const draft = countDrafts(items);
    return html`<article class="card procedure-card" data-href="#${groupUrl(name)}" data-search="${norm(name + ' ' + items.map((d) => `${d.title} ${d.published_title || ''}`).join(' '))}" data-state="${draft ? 'draft' : 'published'}">
      <div class="qt-card-head"><span class="qt-folder" aria-hidden="true">▤</span><span class="pill ${published ? 'ok' : 'mute'}">${published ? 'Đã đăng' : 'Đang soạn'}</span></div>
      <h2><a href="#${groupUrl(name)}">${name}</a></h2><div class="qt-card-meta">${items.length} bài hướng dẫn${editor ? ` · ${published} bài đã đăng` : ''}</div>
      <div class="qt-preview">${items.slice(0, 3).map((d) => html`<div>• ${d.published_title || d.title}</div>`)}</div>
      ${name === DEFAULT_PROCEDURE && personalStatus ? html`<div class="qt-card-personal">${personalStatus}</div>` : ''}
      <a class="qt-open" href="#${groupUrl(name)}">Mở quy trình <span aria-hidden="true">→</span></a>
    </article>`;
  });
  const tools = html`<div class="qt-tools"><label class="qt-search"><span aria-hidden="true">⌕</span><input id="qt-search" class="input" type="search" placeholder="${groupHome ? 'Tìm quy trình hoặc tên bài…' : 'Tìm bài trong quy trình…'}"></label>
    ${editor ? html`<select class="input" id="qt-filter" aria-label="Lọc trạng thái"><option value="all">Tất cả trạng thái</option><option value="published">Đã đăng</option><option value="draft">Chưa đăng</option>${groupHome ? '' : html`<option value="changed">Có sửa đổi chưa đăng</option>`}</select>` : ''}
    <span id="qt-count" class="st-meta">${groupHome ? groups.length + ' quy trình' : shown.length + ' bài'}</span></div>`;

  const procedureBody = html`${raw(DOC_STYLE)}${PROCEDURE_STYLE}<div class="qt-page">
    ${isManager() ? '' : seg}
    ${groupHome ? '' : html`<nav class="qt-breadcrumb"><a href="#/quy-trinh">‹ Tất cả quy trình</a></nav>`}
    <section class="qt-hero"><div><span class="qt-eyebrow">SỔ TAY VẬN HÀNH</span><h1>${groupHome ? 'Thư viện quy trình' : selected}</h1><p>${groupHome ? 'Chọn quy trình để xem các bài hướng dẫn.' : `${shown.length} bài hướng dẫn · Chọn bài trong mục lục để xem nội dung.`}</p></div>${createButton}</section>
    <div id="saved-indicator" class="saved" role="status" hidden></div>
    ${editor && !procedureReady ? html`<div class="alert warn">Cần cập nhật máy chủ để tạo nhiều quy trình. Các bài hiện có vẫn xem và sửa được.</div>` : ''}
    ${!groupHome && selected === DEFAULT_PROCEDURE ? personalStatus : ''}
    ${tools}
    ${groupHome ? html`<div class="qt-grid">${procedureCards}</div>` : html`<div class="qt-reader"><aside class="qt-index-side"><details class="card qt-index" open><summary>MỤC LỤC <span>${shown.length} bài</span></summary><nav>${shown.map((d, i) => html`<button type="button" class="qt-index-link" data-doc="${d.id}" data-search="${norm(`${d.published_title || d.title} ${d.title}`)}" data-state="${!d.published_version ? 'draft' : d.has_draft ? 'changed' : 'published'}"><span>${String(i + 1).padStart(2, '0')}</span><span>${d.published_title || d.title}</span></button>`)}</nav></details></aside><div class="qt-articles">${shown.map(card)}</div></div>`}
    <div class="card qt-empty" id="qt-empty" hidden><strong>Không tìm thấy nội dung phù hợp</strong><span>Thử từ khóa ngắn hơn hoặc chọn lại trạng thái.</span><button class="btn sm secondary" id="qt-reset" type="button">Xóa bộ lọc</button></div>
  </div>`;

  const normalBody = html`${raw(DOC_STYLE)}<style>${raw(NORMAL_STYLE)}</style>${isManager() ? '' : seg}
    ${editor ? html`<div class="toolbar"><a class="btn" href="#${createUrl}">+ Soạn nội quy mới</a></div>` : ''}
    ${unread ? html`<div class="alert warn">Bạn còn ${unread} nội quy chưa xác nhận đã đọc.</div>` : ''}
    ${shown.length ? shown.map(card) : html`<div class="card">Chưa có nội quy nào được đăng.</div>`}`;
  return {
    title: selected || label,
    html: isProcedure ? procedureBody : (isManager()
      ? html`<div class="page-head"><div><h1>${label}</h1><div class="sub">Nhân viên đọc và bấm “Tôi đã đọc”. Trạng thái hiện ở cột Nội quy trong tab Nhân viên.</div></div><div id="saved-indicator" class="saved" role="status" hidden></div></div><div class="stack" style="max-width:860px;gap:12px">${normalBody}</div>`
      : html`<div class="stack" style="gap:12px">${normalBody}</div>`),
    async mount(root) {
      if (isProcedure) mountProcedure(root, { groupHome, focus, shown });
      $$('.read-btn', root).forEach((b) => b.addEventListener('click', async () => {
        try { await rpc('app_tl_read', { p_id: Number(b.dataset.id) }); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      $$('.mv', root).forEach((b) => b.addEventListener('click', async () => {
        try { await rpc('app_tl_move', { p_id: Number(b.dataset.id), p_dir: Number(b.dataset.dir) }); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      if (focus) document.getElementById(`doc-${focus}`)?.scrollIntoView({ block: 'start' });
      zoomImages(root);
      await fillImages(root);
    },
  };
}

function mountProcedure(root, { groupHome, focus, shown }) {
  const search = $('#qt-search', root); const filter = $('#qt-filter', root);
  const entries = $$(groupHome ? '.procedure-card' : '.qt-doc-card', root);
  const links = $$('.qt-index-link', root); const index = $('.qt-index', root);
  if (index && matchMedia('(max-width: 760px)').matches) index.open = false;
  const match = (el, term, state) => (!term || el.dataset.search.includes(term)) && (state === 'all' || el.dataset.state === state);
  const apply = () => {
    const term = norm(search.value.trim()); const state = filter?.value || 'all';
    entries.forEach((el) => { el.hidden = !match(el, term, state); });
    links.forEach((el) => { el.hidden = !match(el, term, state); });
    const count = entries.filter((el) => !el.hidden).length;
    $('#qt-count', root).textContent = `${count} ${groupHome ? 'quy trình' : 'bài'}`;
    $('#qt-empty', root).hidden = count > 0;
    if (index) index.closest('aside').hidden = count === 0;
  };
  search.addEventListener('input', apply); filter?.addEventListener('change', apply);
  $('#qt-reset', root)?.addEventListener('click', () => { search.value = ''; if (filter) filter.value = 'all'; apply(); search.focus(); });
  if (groupHome) entries.forEach((entry) => entry.addEventListener('click', (event) => {
    if (event.target.closest('a, button')) return;
    location.hash = entry.dataset.href;
  }));
  const active = (id) => links.forEach((link) => link.classList.toggle('on', link.dataset.doc === String(id)));
  links.forEach((link) => link.addEventListener('click', () => {
    const target = root.querySelector(`#doc-${link.dataset.doc}`); if (!target) return;
    entries.forEach((entry) => { entry.open = entry === target; }); active(link.dataset.doc);
    if (index && matchMedia('(max-width: 760px)').matches) index.open = false;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  entries.forEach((entry) => entry.addEventListener('toggle', () => { if (entry.open) active(entry.id.replace('doc-', '')); }));
  active(focus || shown[0]?.id || '');
}

const NORMAL_STYLE = `.doc-sum{cursor:pointer;display:flex;gap:8px;align-items:center;flex-wrap:wrap;list-style:none}.doc-sum::-webkit-details-marker{display:none}.doc-sum::before{content:'▸';color:var(--muted)}details[open]>.doc-sum::before{content:'▾'}.doc-title{font-size:17px;font-weight:700;flex:1 1 auto}.st-meta{font-size:12px;color:var(--muted)}`;

const PROCEDURE_STYLE = html`<style>
  .qt-page{max-width:1160px;margin:0 auto;display:grid;gap:16px}.qt-page *{box-sizing:border-box}.qt-page [hidden]{display:none!important}.qt-breadcrumb a{font-size:13px;text-decoration:none}.qt-hero{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:22px 24px;border:1px solid var(--caramel-line);border-radius:18px;background:var(--caramel-soft)}
  .qt-eyebrow{color:var(--primary);font-size:10px;font-weight:700;letter-spacing:.14em}.qt-hero h1{margin:5px 0;font-size:30px;text-transform:none;overflow-wrap:anywhere}.qt-hero p{margin:0;color:var(--muted);font-size:13px}.qt-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.qt-search{position:relative;flex:1 1 260px}.qt-search span{position:absolute;left:14px;top:10px;font-size:23px;color:var(--muted)}.qt-search input{width:100%;padding-left:40px}.qt-tools select{width:auto;max-width:220px}.qt-tools>.st-meta{margin-left:auto}
  .qt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,330px),1fr));gap:16px}.procedure-card{display:flex;flex-direction:column;gap:10px;padding:20px;text-decoration:none;color:var(--ink);border-color:var(--line-strong);box-shadow:none}.procedure-card:hover{border-color:var(--primary);color:var(--ink)}.qt-card-head{display:flex;justify-content:space-between;align-items:center}.qt-folder{display:grid;place-items:center;width:42px;height:42px;border-radius:11px;background:var(--caramel-soft);color:var(--primary);font-size:24px}.procedure-card h2{margin:4px 0 0;font-size:19px;text-transform:none}.qt-card-meta{color:var(--muted);font-size:12px}.qt-preview{display:grid;gap:5px;color:var(--ink-2);font-size:12px;line-height:1.5}.qt-open{border-top:1px solid var(--line);padding-top:12px;color:var(--primary);font-size:13px;font-weight:700}
  .qt-card-personal{margin:2px -4px 0}.qt-card-personal .qt-my-status{grid-template-columns:1fr;padding:10px;background:var(--subtle);box-shadow:none}.qt-card-personal .qt-status-title{padding:0 0 5px;font-size:9px}.qt-card-personal .qt-status-item{border-left:0;border-top:1px solid var(--line);padding:7px 0}.qt-card-personal .qt-status-links{display:none}.qt-my-status{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1fr) auto;align-items:center;gap:0;padding:12px 16px;box-shadow:none}.qt-status-title{padding-right:16px;font-size:10px;font-weight:800;letter-spacing:.08em;color:var(--primary)}.qt-status-item{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:7px;padding:4px 14px;border-left:1px solid var(--line)}.qt-status-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:var(--caramel-soft);color:var(--primary);font-weight:800}.qt-status-item strong,.qt-status-item small{display:block}.qt-status-item strong{font-size:12px}.qt-status-item small{color:var(--muted);font-size:10px;margin-top:2px}.qt-status-item .pill{white-space:nowrap;font-size:10px}.qt-status-links{display:grid;gap:4px;padding-left:14px;font-size:11px;font-weight:600;white-space:nowrap}
  .qt-reader{display:grid;grid-template-columns:250px minmax(0,1fr);gap:14px;align-items:start}.qt-index-side{position:sticky;top:16px}.qt-index{padding:0;box-shadow:none;overflow:hidden}.qt-index summary{padding:14px;cursor:pointer;font-size:12px;font-weight:800;letter-spacing:.04em}.qt-index summary span{float:right;color:var(--muted);font-weight:400}.qt-index nav{max-height:calc(100vh - 230px);overflow:auto;padding:0 7px 8px}.qt-index-link{width:100%;display:grid;grid-template-columns:28px minmax(0,1fr);gap:7px;padding:9px;border:0;border-radius:8px;background:none;text-align:left;color:var(--ink-2);font:inherit;font-size:12px;line-height:1.45;cursor:pointer}.qt-index-link span:first-child{color:var(--muted);font-size:10px;padding-top:2px}.qt-index-link:hover,.qt-index-link.on{background:var(--caramel-soft);color:var(--primary)}
  .qt-articles{min-width:0;display:grid;gap:10px}.qt-doc-card{gap:0!important;padding:0!important;box-shadow:none;overflow:hidden;scroll-margin-top:16px}.qt-doc-card[open]{border-color:var(--caramel-line)}.qt-doc-card .doc-sum{display:flex;align-items:center;gap:10px;padding:15px;list-style:none;cursor:pointer}.qt-doc-card .doc-sum::-webkit-details-marker{display:none}.qt-doc-card .doc-sum::after{content:'+';margin-left:auto;color:var(--primary);font-size:19px}.qt-doc-card[open] .doc-sum::after{content:'−'}.qt-number{display:grid;place-items:center;flex:0 0 32px;height:32px;border-radius:8px;background:var(--caramel-soft);color:var(--primary);font-size:11px;font-weight:800}.qt-doc-card[open] .qt-number{background:var(--primary);color:#fff}.qt-doc-card .doc-title{flex:1;min-width:0;font-size:15px;font-weight:700;overflow-wrap:anywhere}.qt-doc-card>.st-meta{border-top:1px solid var(--line-soft);padding:10px 20px 0;font-size:10px}.qt-doc-card>.doc{padding:14px 20px 20px;font-size:14px;line-height:1.75;overflow-wrap:anywhere}.qt-doc-actions{padding:12px 16px;border-top:1px solid var(--line);background:var(--subtle)}.qt-doc-actions .st-meta{flex:1 1 100%;font-size:10px}.qt-empty{display:grid;justify-items:center;gap:8px;padding:30px;text-align:center}.qt-empty span{color:var(--muted);font-size:12px}
  @media(max-width:900px){.qt-my-status{grid-template-columns:1fr 1fr}.qt-status-title,.qt-status-links{grid-column:1/-1;padding:5px 0}.qt-status-item:first-of-type{border-left:0;padding-left:0}}
  @media(max-width:760px){.qt-page{gap:12px}.qt-hero{align-items:stretch;flex-direction:column;padding:18px}.qt-hero h1{font-size:24px}.qt-hero>.btn{width:100%}.qt-search{flex-basis:100%}.qt-tools select{flex:1;min-width:0;max-width:none}.qt-tools>.st-meta{margin-left:0}.qt-reader{grid-template-columns:1fr}.qt-index-side{position:static}.qt-index nav{max-height:300px}.qt-my-status{grid-template-columns:1fr;padding:12px}.qt-status-title,.qt-status-links{grid-column:auto}.qt-status-item{border-left:0;border-top:1px solid var(--line);padding:10px 0}.qt-status-links{padding:6px 0 0}.qt-doc-card .doc-sum{padding:12px;gap:7px}.qt-doc-card .doc-title{font-size:13px}.qt-doc-card>.doc{padding:12px;font-size:13px}.qt-doc-card>.st-meta{padding:10px 12px 0}.qt-card-personal .qt-status-item .pill{font-size:9px}}
</style>`;
