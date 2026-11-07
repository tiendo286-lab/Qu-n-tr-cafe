// Lịch cố định: nhân viên có lịch lặp lại hằng tuần; mỗi ô chọn "chi nhánh – vị trí" đã khai báo
import { render as rerender } from '../app.js';
import { WEEKDAYS, catalog } from '../data.js';
import { rpc, sb, sel, selAll, viError } from '../sb.js';
import { $, $$, flash, hhmm, html, showSaved } from '../ui.js';

export const perm = 'sua_danh_muc';
const abbr = (n) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase();
const nowText = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');

export async function render() {
  const [cat, members, entries, emps, eb, er] = await Promise.all([
    catalog(), sel('fixed_schedule_members', 'employee_id'), selAll('fixed_schedule_entries', '*'),
    sel('employees', 'id, code, name, rank, status'), selAll('employee_branches', '*'), selAll('employee_roles', '*'),
  ]);
  const shifts = cat.activeShifts;
  const em = new Map(emps.map((e) => [e.id, e]));
  const ebm = {}; eb.forEach((r) => (ebm[r.employee_id] ||= []).push(r.branch_id));
  const erm = {}; er.forEach((r) => (erm[r.employee_id] ||= []).push(r.role));
  const ent = new Map(entries.map((r) => [`${r.employee_id}|${r.weekday}|${r.shift}`, `${r.branch_id}|${r.role}`]));
  const memberIds = new Set(members.map((m) => m.employee_id));
  const rows = members.map((m) => em.get(m.employee_id)).filter(Boolean)
    .sort((a, b) => (a.status === 'Ngừng làm') - (b.status === 'Ngừng làm') || a.name.localeCompare(b.name, 'vi'));
  const options = (eid, s) => cat.activeBranches.filter((b) => (ebm[eid] || []).includes(b.id) && cat.bsMap.get(`${b.id}|${s.id}`)?.enabled === 1)
    .flatMap((b) => (erm[eid] || []).map((r) => ({ value: `${b.id}|${r}`, label: `${b.code}-${abbr(r)}`, title: `${b.name} – ${r}` })));
  let total = 0; const roleCounts = {};
  rows.forEach((e) => { for (let d = 0; d < 7; d++) for (const s of shifts) { const v = ent.get(`${e.id}|${d}|${s.name}`); if (v) { total++; const r = v.split('|')[1]; roleCounts[r] = (roleCounts[r] || 0) + 1; } } });
  const candidates = emps.filter((e) => e.status === 'Đang làm' && !memberIds.has(e.id)).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  return {
    title: 'Lịch cố định',
    html: html`
      <div class="page-head"><div><h1>Lịch cố định</h1>
        <div class="sub">Gợi ý để xếp nhanh. Chỉ tự điền vào lịch tuần khi nhân viên order “Đi làm được” ca đó. Mỗi ô chỉ chọn được chi nhánh và vị trí đã khai báo cho nhân viên.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div style="display:grid;grid-template-columns:repeat(${2 + Object.keys(roleCounts).length},minmax(0,1fr));gap:12px">
        <div class="card" style="padding:14px 18px"><div style="font-size:13px;color:var(--muted)">Nhân viên cố định</div><div style="font-size:26px;font-weight:700">${rows.length}</div></div>
        <div class="card" style="padding:14px 18px"><div style="font-size:13px;color:var(--muted)">Tổng ca cố định</div><div style="font-size:26px;font-weight:700" id="total-fixed">${total}</div></div>
        ${Object.entries(roleCounts).map(([r, n]) => html`<div class="card" style="padding:14px 18px"><div style="font-size:13px;color:var(--muted)">${r}</div><div style="font-size:26px;font-weight:700">${n}</div></div>`)}
      </div>
      <section class="card flush">
        <div class="card-head"><form class="toolbar" id="add-form">
          <label for="add-emp" style="font-size:14px;font-weight:600">Thêm nhân viên</label>
          <select class="input sm" id="add-emp" required style="width:260px"><option value="">— Chọn nhân viên —</option>${candidates.map((c) => html`<option value="${c.id}">${c.code} – ${c.name}</option>`)}</select>
          <button class="btn sm" type="submit">Thêm</button></form></div>
        <div class="table-wrap"><table class="table rt rt-fx" aria-label="Lịch cố định">
          <thead class="dark"><tr><th rowspan="2">Mã NV</th><th rowspan="2">Tên</th><th rowspan="2">Cấp bậc</th><th rowspan="2">Chi nhánh</th><th rowspan="2">Vị trí</th>
            ${WEEKDAYS.map((d) => html`<th class="center" colspan="${shifts.length}" style="border-left:2px solid var(--forest-2)">${d}</th>`)}<th rowspan="2"></th></tr>
            <tr>${WEEKDAYS.map(() => shifts.map((s, i) => html`<th class="center" style="font-size:12px;${i === 0 ? 'border-left:2px solid var(--forest-2)' : ''}">${s.name}</th>`))}</tr></thead>
          <tbody>${rows.length ? rows.map((e) => html`<tr ${e.status !== 'Đang làm' ? 'class="muted"' : ''}>
            <td data-label="Mã NV" style="font-weight:600">${e.code}</td>
            <td data-label="Tên">${e.name}${e.status !== 'Đang làm' ? html` <span class="pill mute">Ngừng làm</span>` : ''}</td>
            <td data-label="Cấp bậc">${e.rank}</td>
            <td data-label="Chi nhánh">${cat.activeBranches.filter((b) => (ebm[e.id] || []).includes(b.id)).map((b) => b.code).join(', ')}</td>
            <td data-label="Vị trí">${(erm[e.id] || []).join(', ')}</td>
            ${WEEKDAYS.map((dn, d) => shifts.map((s, i) => {
              const v = ent.get(`${e.id}|${d}|${s.name}`) || '';
              return html`<td class="center sc" data-label="${dn} · ${s.name}" style="padding:6px 4px;${i === 0 ? 'border-left:2px solid var(--line)' : ''}">
                <select class="input sm fixed-cell ${v ? 'filled' : ''}" data-emp="${e.id}" data-weekday="${d}" data-shift="${s.name}" aria-label="${e.name} ${dn} ${s.name}" style="width:92px;padding:0 4px">
                  <option value="">Để trống</option>${options(e.id, s).map((o) => html`<option value="${o.value}" title="${o.title}" ${o.value === v ? 'selected' : ''}>${o.label}</option>`)}</select></td>`;
            }))}
            <td><button class="link-btn rm-emp" type="button" data-id="${e.id}" data-name="${e.code} – ${e.name}" style="color:var(--off-ink)">Xóa</button></td></tr>`)
            : html`<tr><td colspan="99" style="color:var(--muted)">Chưa có nhân viên nào trong lịch cố định.</td></tr>`}</tbody></table></div>
      </section><style>.fixed-cell.filled{background:#fef3c7;border-color:#f59e0b;font-weight:600}</style>`,
    mount() {
      $$('.fixed-cell').forEach((s) => {
        let last = s.value;
        s.addEventListener('change', async () => {
          const eid = Number(s.dataset.emp), d = Number(s.dataset.weekday), shift = s.dataset.shift;
          let error;
          if (!s.value) ({ error } = await sb.from('fixed_schedule_entries').delete().eq('employee_id', eid).eq('weekday', d).eq('shift', shift));
          else {
            const [bid, role] = s.value.split('|');
            ({ error } = await sb.from('fixed_schedule_entries').upsert({ employee_id: eid, weekday: d, shift, branch_id: Number(bid), role, updated_at: nowText() }, { onConflict: 'employee_id,weekday,shift' }));
          }
          if (error) { s.value = last; showSaved(viError(error), true); return; }
          const t = $('#total-fixed'); t.textContent = Number(t.textContent) + (s.value ? 1 : 0) - (last ? 1 : 0);
          last = s.value; s.classList.toggle('filled', !!s.value); showSaved('Đã lưu · ' + hhmm());
        });
      });
      $('#add-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const eid = Number($('#add-emp').value); if (!eid) return;
        const { error } = await sb.from('fixed_schedule_members').upsert({ employee_id: eid, added_at: nowText() });
        if (error) flash(viError(error), 'error'); else { rpc('app_log', { p_action: 'them_lich_co_dinh', p_detail: String(eid) }); flash('Đã thêm vào lịch cố định. Chọn chi nhánh – vị trí cho từng ô.'); }
        rerender();
      });
      $$('.rm-emp').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm(`Xóa ${b.dataset.name} khỏi lịch cố định?`)) return;
        const eid = Number(b.dataset.id);
        const e1 = await sb.from('fixed_schedule_entries').delete().eq('employee_id', eid);
        const e2 = await sb.from('fixed_schedule_members').delete().eq('employee_id', eid);
        if (e1.error || e2.error) flash(viError(e1.error || e2.error), 'error');
        else flash('Đã xóa khỏi lịch cố định. Lịch các tuần đã xếp không bị thay đổi.');
        rerender();
      }));
    },
  };
}
