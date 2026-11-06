// Đào tạo: theo dõi ai chưa đào tạo, đang đào tạo x/68, đào tạo tiếp, đã hoàn thành; tạo phiếu đào tạo
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { dmy } from '../tien.js';
import { $, $$, dialog, go, html, norm } from '../ui.js';

export const perm = 'dao_tao';
export const DT_STATUS = {
  chua_dao_tao: ['Chưa đào tạo', 'mute'], dang_dao_tao: ['Đang đào tạo', 'info'], dao_tao_tiep: ['Đào tạo tiếp', 'warn'], hoan_thanh: ['Đã hoàn thành', 'ok'],
};
export const dtLabel = (t) => (!t ? 'Chưa đào tạo' : t.status === 'dang_dao_tao' ? `Đang đào tạo — ${t.achieved}/${t.total}` : t.status === 'dao_tao_tiep' ? `Đào tạo tiếp — ${t.achieved}/${t.total}` : DT_STATUS[t.status][0]);

export async function render() {
  const [list, opt] = await Promise.all([rpc('app_dt_list'), rpc('app_dt_options')]);
  const st = (e) => (e.training ? e.training.status : 'chua_dao_tao');
  const count = (k) => list.filter((e) => st(e) === k).length;
  const branches = opt.branches.map((b) => b.code);
  return {
    title: 'Đào tạo',
    html: html`<style>.pill.info { background: #dbeafe; color: #1e3a8a; } .dt-miss { font-size: 12px; color: var(--muted); max-width: 260px; }</style>
      <div class="page-head"><div><h1>Đào tạo</h1><div class="sub">Chương trình nhân viên chạy bàn 8 ngày · 68 hạng mục. Đạt đủ 68/68 là hoàn thành; quá 8 ngày chưa đủ thì chuyển Đào tạo tiếp.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="tiles" style="max-width:900px">${Object.entries(DT_STATUS).map(([k, [l, c]]) => html`<button type="button" class="tile dt-tile" data-st="${k}" style="border-top-color:${{ mute: '#9ca3af', info: '#2563eb', warn: '#f59e0b', ok: '#16a34a' }[c]};font:inherit;text-align:left;cursor:pointer"><div class="n">${count(k)}</div><div class="l">${l}</div></button>`)}</div>
      <section class="card flush">
        <div class="emp-filters">
          <input class="input sm" id="f-q" type="search" placeholder="Tìm mã hoặc tên" aria-label="Tìm" style="width:200px">
          <select class="input sm" id="f-b" aria-label="Cơ sở"><option value="">Tất cả cơ sở</option>${branches.map((b) => html`<option>${b}</option>`)}</select>
          <select class="input sm" id="f-st" aria-label="Trạng thái đào tạo"><option value="">Mọi trạng thái</option>${Object.entries(DT_STATUS).map(([k, [l]]) => html`<option value="${k}">${l}</option>`)}</select>
          <select class="input sm" id="f-role" aria-label="Vị trí"><option value="">Mọi vị trí</option><option value="Chạy bàn">Có vị trí Chạy bàn</option></select>
          <span class="ef-count" id="f-count" role="status"></span></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Mã NV</th><th>Tên</th><th>Cơ sở</th><th>Đào tạo</th><th>Bắt đầu</th><th>Người hướng dẫn</th><th>Quản lý phụ trách</th><th>Còn thiếu</th><th></th></tr></thead>
        <tbody>${list.map((e) => { const t = e.training; const s = st(e); const brs = t?.branch ? [t.branch] : e.branches;
          return html`<tr class="dt-row" data-search="${norm(e.code + ' ' + e.name)}" data-st="${s}" data-b="|${brs.join('|')}|" data-roles="|${e.roles.join('|')}|">
            <td style="font-weight:600">${e.code}</td><td>${e.name} <span class="st-meta" style="font-size:12px;color:var(--muted)">${e.rank}</span></td>
            <td>${brs.join(', ') || '—'}</td>
            <td><span class="pill ${DT_STATUS[s][1]}">${dtLabel(t)}</span></td>
            <td>${t ? dmy(t.start_date) : '—'}</td><td>${t?.instructor || '—'}</td><td>${t?.manager || '—'}</td>
            <td class="dt-miss">${t && t.status !== 'hoan_thanh' ? `${t.missing.length} mục: ${t.missing.slice(0, 12).join(', ')}${t.missing.length > 12 ? '…' : ''}` : ''}</td>
            <td>${t ? html`<a class="btn sm secondary" href="#/dao-tao/phieu?id=${t.id}">Mở phiếu</a>` : html`<button type="button" class="btn sm new-dt" data-id="${e.employee_id}" data-name="${e.code} – ${e.name}" data-b="${e.branches[0] || ''}">Tạo phiếu</button>`}</td></tr>`; })}</tbody></table></div>
      </section>`,
    mount() {
      const apply = () => {
        const q = norm($('#f-q').value.trim()); const b = $('#f-b').value; const s = $('#f-st').value; const r = $('#f-role').value; let n = 0;
        $$('.dt-row').forEach((row) => {
          const show = (!q || row.dataset.search.includes(q)) && (!b || row.dataset.b.includes(`|${b}|`)) && (!s || row.dataset.st === s) && (!r || row.dataset.roles.includes(`|${r}|`));
          row.hidden = !show; if (show) n++;
        });
        $('#f-count').textContent = `${n} nhân viên`;
      };
      ['#f-q', '#f-b', '#f-st', '#f-role'].forEach((s) => $(s).addEventListener('input', apply)); apply();
      $$('.dt-tile').forEach((t) => t.addEventListener('click', () => { $('#f-st').value = $('#f-st').value === t.dataset.st ? '' : t.dataset.st; apply(); }));
      $$('.new-dt').forEach((b) => b.addEventListener('click', () => {
        const brId = opt.branches.find((x) => x.code === b.dataset.b)?.id || '';
        const d = dialog(html`<form class="stack" style="gap:10px" id="dt-new">
          <h2 style="margin:0">Tạo phiếu đào tạo chạy bàn</h2><div><strong>${b.dataset.name}</strong></div>
          <label class="stack" style="gap:4px">Cơ sở<select class="input" name="branch"><option value="">—</option>${opt.branches.map((x) => html`<option value="${x.id}" ${String(x.id) === String(brId) ? 'selected' : ''}>${x.code}</option>`)}</select></label>
          <label class="stack" style="gap:4px">Ngày bắt đầu<input class="input" type="date" name="start" value="${vnToday()}" required></label>
          <label class="stack" style="gap:4px">Người hướng dẫn chính<input class="input" name="hd" list="dt-emps" placeholder="Gõ mã hoặc tên"><datalist id="dt-emps">${opt.employees.map((e) => html`<option value="${e.code} – ${e.name}"></option>`)}</datalist></label>
          <label class="stack" style="gap:4px">Quản lý phụ trách<select class="input" name="ql"><option value="">—</option>${opt.managers.map((m) => html`<option value="${m.id}">${m.name}</option>`)}</select></label>
          <div id="dt-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn secondary" id="dt-cancel">Hủy</button><button class="btn" type="submit">Tạo phiếu</button></div></form>`);
        d.querySelector('#dt-cancel').addEventListener('click', () => d.close());
        d.querySelector('#dt-new').addEventListener('submit', async (ev) => {
          ev.preventDefault(); const f = ev.target;
          const q = f.hd.value.trim().toLowerCase(); const code = q.split(/\s*[–-]\s*/)[0];
          const hd = q ? (opt.employees.find((x) => `${x.code} – ${x.name}`.toLowerCase() === q) || opt.employees.find((x) => String(x.code).toLowerCase() === code)) : null;
          if (q && !hd) { d.querySelector('#dt-err').innerHTML = '<div class="alert error">Không tìm thấy người hướng dẫn. Chọn trong danh sách gợi ý.</div>'; return; }
          try {
            const id = await rpc('app_dt_create', { p_employee: Number(b.dataset.id), p: { branch_id: f.branch.value || null, start_date: f.start.value, instructor_id: hd?.id || null, manager_id: f.ql.value || null } });
            d.close(); go(`/dao-tao/phieu?id=${id}`);
          } catch (e) { d.querySelector('#dt-err').innerHTML = ''; d.querySelector('#dt-err').append(Object.assign(document.createElement('div'), { className: 'alert error', textContent: e.message })); }
        });
      }));
    },
  };
}
