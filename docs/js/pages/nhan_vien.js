// Nhân viên: danh sách (lọc, sửa nhanh cấp bậc) + tài khoản đăng nhập (cấp mật khẩu, khóa, in hàng loạt, tài khoản riêng) + form thêm/sửa
import { render as rerender, can } from '../app.js';
import { RANKS, catalog } from '../data.js';
import { DT_STATUS, dtLabel, openCreateDialog } from './dao_tao.js';
import { rpc, sel, selAll } from '../sb.js';
import { ACC_CSS, ACC_STATES, accCell, accMenu, accState, bindAccountActions, bindBulk, bulkButton, canTouch, standaloneSection } from './tai_khoan_chung.js';
import { $, $$, dialog, flash, go, hhmm, html, norm, showSaved } from '../ui.js';

// Người có quyền Quản lý nhân viên: đầy đủ. Người chỉ có quyền Đào tạo: xem danh sách + cột Đào tạo, tạo phiếu đào tạo.
export const perm = ['quan_ly_nhan_vien', 'dao_tao'];
const COMMIT = { chua_ky: ['Chưa ký'], da_ky_chua_nop: ['Đã ký, chưa nộp'], da_ky_nop: ['Đã ký và nộp'] };
const RANK_COLOR = { 'Quản lý': '#8a5a83', 'Cấp 2': '#4f7f9a', 'Cấp 1': '#d9922e', 'Thử việc': '#a89a8c' };

export async function render({ params, me }) {
  const full = can('quan_ly_nhan_vien'); const dtAdmin = can('dao_tao');
  if (params.id || params.them) {
    if (!full) return { title: 'Không có quyền', html: html`<div class="card">Bạn không có quyền sửa thông tin nhân viên.</div>` };
    return renderForm(params, me);
  }
  const [cat, emps, contacts, eb, er, accs, tl, dts] = await Promise.all([
    catalog(), selAll('employees', '*'), selAll('employee_contacts', '*'), selAll('employee_branches', '*'), selAll('employee_roles', '*'),
    selAll('accounts', 'id, employee_id, employee_code, login_name, display_name, system_role, has_password, must_change, locked, last_login_at'),
    rpc('app_tl_staff_status').catch(() => null),
    rpc('app_dt_staff_status').catch(() => null),
  ]);
  const bcode = new Map(cat.branches.map((b) => [b.id, b.code]));
  const con = new Map(contacts.map((c) => [c.employee_id, c]));
  const acc = new Map(accs.map((a) => [a.employee_id, a]));
  const ebm = {}; eb.forEach((r) => (ebm[r.employee_id] ||= []).push(bcode.get(r.branch_id)));
  const erm = {}; er.forEach((r) => (erm[r.employee_id] ||= []).push(r.role));
  const nDocs = tl ? tl.noi_quy_docs : 0;
  const dtm = new Map((dts || []).map((t) => [t.employee_id, t]));
  const tlm = new Map((tl?.rows || []).map((r) => [r.employee_id, r]));
  const nq = (e) => { const r = tlm.get(e.id); return !nDocs ? 'khong' : r && r.read >= nDocs ? 'da_doc' : 'chua_doc'; };
  const list = emps.map((e) => {
    const a = acc.get(e.id) || {};
    return { ...e, email: con.get(e.id)?.email, phone: con.get(e.id)?.phone, branches: ebm[e.id] || [], roles: erm[e.id] || [], acc: a, account_id: a.id, system_role: a.system_role,
      state: accState(a, e.status !== 'Đang làm'), nq: nq(e), tl: tlm.get(e.id) || {}, dt: dtm.get(e.id) || null };
  }).sort((x, y) => (x.status === 'Ngừng làm') - (y.status === 'Ngừng làm') || x.name.localeCompare(y.name, 'vi'));
  const on = list.filter((e) => e.status === 'Đang làm');
  const standalone = accs.filter((a) => !a.employee_id && !a.employee_code);
  const nst = (k) => on.filter((e) => e.state === k).length;
  return {
    title: 'Nhân viên',
    html: html`
      <div class="page-head"><div><h1>Nhân viên</h1><div class="sub">${full ? 'Bấm vào tên để sửa đầy đủ. Cấp bậc sửa nhanh ngay trong bảng.' : 'Theo dõi đào tạo: bấm vào trạng thái ở cột Đào tạo để mở phiếu, hoặc Tạo phiếu cho người chưa đào tạo.'}${dts ? ' Cột Đào tạo: chương trình chạy bàn 8 ngày · 68 hạng mục.' : ''}</div></div>
        <div class="toolbar"><div id="saved-indicator" class="saved" role="status" hidden></div>${full ? html`<a class="btn" href="#/quan-ly/nhan-vien?them=1">+ Thêm nhân viên</a>` : ''}</div></div>
      <div class="emp-stats" aria-label="Thống kê nhân viên">
        <div class="es" style="--ac:var(--forest)"><div class="n">${list.length}</div><div class="l">Tổng NV</div></div>
        <div class="es" style="--ac:var(--ok-line)"><div class="n" style="color:var(--ok-ink)">${on.length}</div><div class="l">Đang làm</div></div>
        <div class="es" style="--ac:var(--muted)"><div class="n" style="color:var(--muted)">${list.length - on.length}</div><div class="l">Ngừng làm</div></div>
        ${['Quản lý', 'Cấp 2', 'Cấp 1', 'Thử việc'].map((r) => html`<div class="es" style="--ac:${RANK_COLOR[r]}"><div class="n">${list.filter((e) => e.rank === r).length}</div><div class="l">${r}</div></div>`)}
      </div>
      <section class="card flush">
        <div class="card-head">
          <div class="stack" style="gap:8px">
          ${full ? html`<div class="toolbar" style="font-size:14px;gap:6px"><strong style="font-size:13px">Tài khoản:</strong>
            ${Object.entries(ACC_STATES).filter(([k]) => k !== 'khoa' || nst(k)).map(([k, [l, c]]) => html`<button type="button" class="pill ${k === 'chua_co' ? 'off' : c} acc-chip" data-st="${k}" style="border:none;cursor:pointer;font:inherit;font-size:12px;font-weight:600">${l}: ${nst(k)}</button>`)}
            ${bulkButton(nst('chua_co'), nst('tam'))}</div>` : ''}
          ${dts ? html`<div class="toolbar" style="font-size:14px;gap:6px"><strong style="font-size:13px">Đào tạo:</strong>${Object.entries(DT_STATUS).map(([k, [l, c]]) => html`<button type="button" class="pill ${c} dt-chip" data-st="${k}" style="border:none;cursor:pointer;font:inherit;font-size:12px;font-weight:600">${l}: ${on.filter((e) => (e.dt ? e.dt.status : 'chua_dao_tao') === k).length}</button>`)}</div>` : ''}
          </div>
          <div class="toolbar"><label style="display:flex;align-items:center;gap:6px;font-size:14px"><input type="checkbox" id="show-stopped" class="check"> Hiện cả người ngừng làm</label>
            <input class="input sm" id="emp-search" type="search" placeholder="Tìm mã hoặc tên" aria-label="Tìm nhân viên" style="width:240px"></div></div>
        <div class="emp-filters">
          <select class="input sm" id="ef-rank" aria-label="Lọc cấp bậc"><option value="">Tất cả cấp bậc</option>${[...RANKS].reverse().map((r) => html`<option>${r}</option>`)}</select>
          <select class="input sm" id="ef-branch" aria-label="Lọc chi nhánh"><option value="">Tất cả chi nhánh</option>${cat.branches.map((b) => html`<option>${b.code}</option>`)}</select>
          <select class="input sm" id="ef-role" aria-label="Lọc vai trò"><option value="">Tất cả vai trò</option>${cat.roles.map((r) => html`<option>${r.name}</option>`)}</select>
          ${tl ? html`<select class="input sm" id="ef-nq" aria-label="Lọc nội quy"><option value="">Nội quy: tất cả</option><option value="da_doc">Đã đọc nội quy</option><option value="chua_doc">Chưa đọc nội quy</option></select>
          <select class="input sm" id="ef-ck" aria-label="Lọc cam kết"><option value="">Cam kết: tất cả</option>${Object.entries(COMMIT).map(([k, [l]]) => html`<option value="${k}">${l}</option>`)}</select>` : ''}
          ${dts ? html`<select class="input sm" id="ef-dt" aria-label="Lọc đào tạo"><option value="">Đào tạo: tất cả</option>${Object.entries(DT_STATUS).map(([k, [l]]) => html`<option value="${k}">${l}</option>`)}</select>` : ''}
          ${full ? html`<select class="input sm" id="ef-state" aria-label="Lọc tài khoản"><option value="">Mọi tài khoản</option>${Object.entries(ACC_STATES).map(([k, [l]]) => html`<option value="${k}" ${params.tk === k ? 'selected' : ''}>${l}</option>`)}</select>` : ''}
          <button class="btn sm secondary" type="button" id="ef-clear">Xóa lọc</button><span class="ef-count" id="ef-count" role="status"></span></div>
        <div class="table-wrap"><table class="table fit" aria-label="Danh sách nhân viên">
          <thead><tr><th>Mã NV</th><th>Tên</th><th>Cấp bậc</th><th>Chi nhánh</th><th>Vai trò làm việc</th>${full ? html`<th>Tài khoản</th><th>Email</th><th>Số điện thoại</th>` : ''}${tl ? html`<th>Nội quy</th><th>Cam kết</th>` : ''}${dts ? html`<th>Đào tạo</th>` : ''}<th></th></tr></thead>
          <tbody>${list.map((e) => {
            const stopped = e.status !== 'Đang làm';
            return html`<tr class="emp-row ${stopped ? 'muted stopped' : ''}" data-search="${norm(`${e.code} ${e.name}`)}" data-rank="${e.rank}" data-branches="|${e.branches.join('|')}|" data-roles="|${e.roles.join('|')}|" data-state="${e.state}" data-nq="${e.nq}" data-ck="${e.tl.commit || 'chua_ky'}" data-dt="${e.dt ? e.dt.status : 'chua_dao_tao'}" ${stopped ? 'hidden' : ''}>
              <td style="font-weight:600">${e.code}</td>
              <td>${full ? html`<a class="emp-name" href="#/quan-ly/nhan-vien?id=${e.id}"><span class="av">${e.name.trim().slice(0, 1).toUpperCase()}</span>${e.name}</a>` : html`<span class="emp-name"><span class="av">${e.name.trim().slice(0, 1).toUpperCase()}</span>${e.name}</span>`}</td>
              <td>${stopped || !full ? e.rank : html`<select class="input sm rank-select" data-id="${e.id}" aria-label="Cấp bậc của ${e.name}" style="width:120px">${RANKS.map((r) => html`<option ${r === e.rank ? 'selected' : ''}>${r}</option>`)}</select>`}</td>
              <td data-label="Chi nhánh">${e.branches.length ? e.branches.map((x) => html`<span class="chip">${x}</span>`) : '—'}</td>
              <td data-label="Vai trò làm việc">${e.roles.length ? e.roles.map((x) => html`<span class="chip role">${x}</span>`) : '—'}</td>
              ${full ? html`<td data-label="Tài khoản"><div class="acc-cell"><div>${accCell(e.state, e.acc)}</div>${canTouch(e.acc, me, stopped) ? accMenu(e.acc, `${e.code} – ${e.name}`) : ''}</div></td><td>${e.email || '—'}</td><td>${e.phone || '—'}</td>` : ''}
              ${tl ? html`<td data-label="Nội quy">${e.nq === 'khong' ? html`<span class="st-meta" title="Chưa có nội quy nào được đăng">—</span>`
                : html`<button type="button" class="nq-btn pill ${e.nq === 'da_doc' ? 'ok' : 'off'}" data-id="${e.id}" data-read="${e.nq === 'da_doc' ? 1 : 0}" data-name="${e.code} – ${e.name}"
                    title="${e.nq === 'da_doc' ? 'Đọc lúc ' + (e.tl.read_at || '') + ' · bấm để bỏ đánh dấu' : `Đã đọc ${e.tl.read || 0}/${nDocs} · bấm để đánh dấu đã đọc thay nhân viên`}">${e.nq === 'da_doc' ? 'Đã đọc' : nDocs > 1 && e.tl.read ? `Chưa đọc (${e.tl.read}/${nDocs})` : 'Chưa đọc'}</button>`}</td>
                <td data-label="Cam kết"><select class="input sm ck-select ck-${e.tl.commit || 'chua_ky'}" data-id="${e.id}" aria-label="Cam kết của ${e.name}" title="${e.tl.commit_at ? `${e.tl.commit_by} · ${e.tl.commit_at}${e.tl.commit_note ? ' · ' + e.tl.commit_note : ''}` : ''}" ${stopped ? 'disabled' : ''}>
                  ${Object.entries(COMMIT).map(([k, [l]]) => html`<option value="${k}" ${k === (e.tl.commit || 'chua_ky') ? 'selected' : ''}>${l}</option>`)}</select></td>` : ''}
              ${dts ? html`<td data-label="Đào tạo">${e.dt ? html`<a class="pill ${DT_STATUS[e.dt.status][1]}" href="#/dao-tao/phieu?id=${e.dt.id}" title="Bấm để mở phiếu${e.dt.status !== 'hoan_thanh' ? ' · còn thiếu: ' + e.dt.missing.join(', ') : ''}">${dtLabel(e.dt)}</a>
                  ${e.dt.instructor ? html`<div class="st-meta" style="font-size:11px;color:var(--muted);margin-top:2px">HD: ${e.dt.instructor}</div>` : ''}`
                : dtAdmin && !stopped ? html`<button type="button" class="btn sm secondary new-dt" data-id="${e.id}" data-name="${e.code} – ${e.name}" data-b="${e.branches[0] || ''}" title="Chưa đào tạo">+ Tạo phiếu</button>` : html`<span class="pill mute">Chưa đào tạo</span>`}</td>` : ''}
              <td class="st-cell">${full && canStop(e, me) ? (stopped
                ? html`<button type="button" class="btn sm secondary st-btn" data-id="${e.id}" data-to="Đang làm" data-name="${e.code} – ${e.name}">Đi làm lại</button>`
                : html`<button type="button" class="btn sm secondary danger st-btn" data-id="${e.id}" data-to="Ngừng làm" data-name="${e.code} – ${e.name}">Ngừng làm</button>`) : ''}</td></tr>`;
          })}</tbody></table></div>
      </section>
      ${full ? standaloneSection(standalone, me, can('phan_quyen')) : ''}${ACC_CSS}`,
    mount() {
      const rows = $$('.emp-row');
      const apply = () => {
        const q = norm($('#emp-search').value.trim()); const st = $('#show-stopped').checked;
        const rk = $('#ef-rank').value, br = $('#ef-branch').value, rl = $('#ef-role').value, ac = $('#ef-state')?.value || '';
        const fnq = $('#ef-nq')?.value || '', fck = $('#ef-ck')?.value || '', fdt = $('#ef-dt')?.value || '';
        let n = 0;
        rows.forEach((r) => {
          const show = (st || !r.classList.contains('stopped')) && (!q || r.dataset.search.includes(q)) && (!rk || r.dataset.rank === rk)
            && (!br || r.dataset.branches.includes(`|${br}|`)) && (!rl || r.dataset.roles.includes(`|${rl}|`)) && (!ac || r.dataset.state === ac)
            && (!fnq || r.dataset.nq === fnq) && (!fck || r.dataset.ck === fck) && (!fdt || r.dataset.dt === fdt);
          r.hidden = !show; if (show) n++;
        });
        $('#ef-count').textContent = `${n} nhân viên`;
      };
      ['#emp-search', '#show-stopped', '#ef-rank', '#ef-branch', '#ef-role', '#ef-state', '#ef-nq', '#ef-ck', '#ef-dt'].forEach((s) => $(s)?.addEventListener('input', apply));
      $('#ef-clear').addEventListener('click', () => { ['#ef-rank', '#ef-branch', '#ef-role', '#ef-state', '#emp-search', '#ef-nq', '#ef-ck', '#ef-dt'].forEach((s) => { if ($(s)) $(s).value = ''; }); apply(); });
      $$('.nq-btn').forEach((b) => b.addEventListener('click', async () => {
        const read = b.dataset.read === '1';
        if (!confirm(read ? `Bỏ đánh dấu đã đọc nội quy của ${b.dataset.name}?` : `Xác nhận thay ${b.dataset.name}: đã đọc toàn bộ nội quy đang đăng?`)) return;
        try { await rpc('app_tl_mark_read', { p_employee: Number(b.dataset.id), p_read: !read }); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      $$('.ck-select').forEach((s) => { let last = s.value; s.addEventListener('change', async () => {
        try { await rpc('app_tl_set_commit', { p_employee: Number(s.dataset.id), p_status: s.value, p_note: null }); s.className = `input sm ck-select ck-${s.value}`; s.closest('tr').dataset.ck = s.value; last = s.value; showSaved('Đã lưu · ' + hhmm()); }
        catch (e) { s.value = last; showSaved(e.message, true); }
      }); });
      apply();
      $$('.dt-chip').forEach((c) => c.addEventListener('click', () => { const f = $('#ef-dt'); f.value = f.value === c.dataset.st ? '' : c.dataset.st; apply(); }));
      $$('.new-dt').forEach((b) => b.addEventListener('click', () => openCreateDialog({ id: Number(b.dataset.id), name: b.dataset.name, branch: b.dataset.b }).catch((e) => showSaved(e.message, true))));
      $$('.rank-select').forEach((s) => { let last = s.value; s.addEventListener('change', async () => {
        try { await rpc('app_set_rank', { p_id: Number(s.dataset.id), p_rank: s.value }); last = s.value; showSaved('Đã lưu · ' + hhmm()); } catch (e) { s.value = last; showSaved(e.message, true); }
      }); });
      $$('.acc-chip').forEach((c) => c.addEventListener('click', () => { const f = $('#ef-state'); f.value = f.value === c.dataset.st ? '' : c.dataset.st; apply(); }));
      $$('.st-btn').forEach((b) => b.addEventListener('click', () => setStatus(Number(b.dataset.id), b.dataset.to, b.dataset.name)));
      bindAccountActions(); bindBulk();
    },
  };
}

// Người được đổi trạng thái: không phải chính mình, không phải Chủ; Quản lý tổng thì chỉ Chủ đổi được.
function canStop(e, me) {
  return e.acc?.id !== me.account_id && e.system_role !== 'chu' && (me.role === 'chu' || e.system_role !== 'ql_tong');
}

async function setStatus(id, to, name) {
  const stop = to === 'Ngừng làm';
  if (stop && !confirm(`Chuyển ${name} sang NGỪNG LÀM?\n\n• Tài khoản bị khóa ngay, không đăng nhập được nữa.\n• Không còn hiện trong order và xếp lịch mới.\n• Lịch sử (lịch đã làm, phiếu ca, đào tạo…) vẫn giữ nguyên.\n\nKhi người này quay lại, bấm “Đi làm lại”.`)) return;
  if (!stop && !confirm(`Cho ${name} ĐI LÀM LẠI?\n\nTài khoản mở lại với mật khẩu cũ (nếu quên thì cấp mật khẩu tạm).`)) return;
  try {
    const r = await rpc('app_set_employee_status', { p_id: id, p_status: to });
    const n = (stop && r?.future_shifts) || 0;
    flash(stop ? `Đã chuyển ${name} sang Ngừng làm, tài khoản đã khóa.${n ? ` Lưu ý: người này còn ${n} ca đã xếp từ hôm nay trở đi — vào Xếp lịch để thay người.` : ''}`
      : `${name} đã đi làm lại, tài khoản mở lại.`, n ? 'warn' : 'ok');
  } catch (e) { flash(e.message, 'error'); }
  rerender();
}

async function renderForm(params, me) {
  const cat = await catalog();
  let v = { status: 'Đang làm', roles: [], branch_ids: [] }; let emp = null; let acc = null;
  if (params.id) {
    const id = Number(params.id);
    const [e, c, eb, er] = await Promise.all([
      sel('employees', '*', (b) => b.eq('id', id)), sel('employee_contacts', '*', (b) => b.eq('employee_id', id)),
      sel('employee_branches', 'branch_id', (b) => b.eq('employee_id', id)), sel('employee_roles', 'role', (b) => b.eq('employee_id', id)),
    ]);
    emp = e[0];
    if (!emp) return { title: 'Nhân viên', html: html`<div class="card">Không tìm thấy nhân viên. <a href="#/quan-ly/nhan-vien">Về danh sách</a></div>` };
    acc = (await sel('accounts', 'id, system_role', (b) => b.eq('employee_id', id)))[0] || null;
    v = { ...emp, email: c[0]?.email, phone: c[0]?.phone, branch_ids: eb.map((x) => x.branch_id), roles: er.map((x) => x.role) };
  }
  return {
    title: emp ? 'Sửa nhân viên' : 'Thêm nhân viên',
    html: html`
      <div class="page-head"><div><a href="#/quan-ly/nhan-vien" style="font-size:14px;font-weight:600">‹ Danh sách nhân viên</a>
        <h1 style="margin-top:6px">${emp ? `Sửa: ${emp.code} – ${emp.name}` : 'Thêm nhân viên'}</h1></div></div>
      <div class="alert error" role="alert" id="emp-err" hidden></div>
      <form class="card stack" id="emp-form" style="max-width:860px">
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px">
          <div class="field"><label for="code">Mã nhân viên</label><input class="input" id="code" name="code" value="${v.code || ''}" maxlength="20" required autocapitalize="off">
            <div class="hint">${emp ? 'Đổi mã thì nhân viên đăng nhập bằng mã mới, mật khẩu giữ nguyên.' : 'Dùng để đăng nhập. Không trùng với người khác.'}</div></div>
          <div class="field"><label for="name">Họ tên</label><input class="input" id="name" name="name" value="${v.name || ''}" maxlength="80" required></div>
          <div class="field"><label for="rank">Cấp bậc</label><select class="input" id="rank" name="rank" required><option value="">— Chọn —</option>${RANKS.map((r) => html`<option ${r === v.rank ? 'selected' : ''}>${r}</option>`)}</select></div>
          <div class="field"><label for="status">Trạng thái</label><select class="input" id="status" name="status">${['Đang làm', 'Ngừng làm'].map((s) => html`<option ${s === v.status ? 'selected' : ''}>${s}</option>`)}</select>
            <div class="hint">Chuyển “Ngừng làm” sẽ khóa tài khoản ngay; lịch sử vẫn giữ.</div></div>
        </div>
        <fieldset style="border:1px solid var(--line);border-radius:12px;padding:14px 16px"><legend style="font-weight:600;font-size:14px;padding:0 6px">Vai trò làm việc</legend>
          <div class="toolbar">${cat.roles.map((r) => html`<label style="display:flex;align-items:center;gap:8px;min-height:44px;padding-right:16px"><input type="checkbox" class="check" name="roles" value="${r.name}" ${v.roles.includes(r.name) ? 'checked' : ''}> ${r.name}</label>`)}</div>
          <div class="field" style="margin-top:8px;max-width:300px"><label for="preferred_role">Vai trò ưu tiên</label>
            <select class="input" id="preferred_role" name="preferred_role"><option value="">(vai trò đầu tiên đã chọn)</option>${cat.roles.map((r) => html`<option ${r.name === v.preferred_role ? 'selected' : ''}>${r.name}</option>`)}</select></div></fieldset>
        <fieldset style="border:1px solid var(--line);border-radius:12px;padding:14px 16px"><legend style="font-weight:600;font-size:14px;padding:0 6px">Chi nhánh làm được</legend>
          <div class="toolbar">${cat.branches.map((b) => html`<label style="display:flex;align-items:center;gap:8px;min-height:44px;padding-right:16px"><input type="checkbox" class="check" name="branches" value="${b.id}" ${v.branch_ids.includes(b.id) ? 'checked' : ''}> ${b.code} – ${b.name}${b.status !== 'Đang hoạt động' ? ' (ngừng)' : ''}</label>`)}</div></fieldset>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px">
          <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" value="${v.email || ''}"></div>
          <div class="field"><label for="phone">Số điện thoại</label><input class="input" id="phone" name="phone" type="tel" value="${v.phone || ''}"></div>
          <div class="field"><label for="start_date">Ngày bắt đầu vào làm</label><input class="input" id="start_date" name="start_date" type="date" value="${v.start_date || ''}"></div>
        </div>
        <div class="toolbar"><button class="btn" type="submit">${emp ? 'Lưu thay đổi' : 'Thêm nhân viên'}</button><a class="btn secondary" href="#/quan-ly/nhan-vien">Hủy</a></div>
      </form>
      ${emp && canStop({ acc: { id: acc?.id }, system_role: acc?.system_role }, me) ? html`<section class="card" style="margin-top:16px;max-width:860px"><h2 style="margin-top:0;font-size:16px">${v.status === 'Đang làm' ? 'Nghỉ việc' : 'Đi làm lại'}</h2>
        <p style="font-size:14px;color:var(--ink-2)">${v.status === 'Đang làm' ? 'Nhân viên nghỉ việc thì bấm Ngừng làm: tài khoản bị khóa ngay, lịch sử vẫn giữ. Khi quay lại thì bấm Đi làm lại.' : 'Nhân viên này đang ở trạng thái Ngừng làm (tài khoản đã khóa).'}</p>
        <button class="btn sm secondary ${v.status === 'Đang làm' ? 'danger' : ''}" type="button" id="st-emp">${v.status === 'Đang làm' ? 'Ngừng làm' : 'Đi làm lại'}</button></section>` : ''}
      ${emp ? html`<section class="card" style="margin-top:16px;max-width:860px"><h2 style="margin-top:0;font-size:16px">Xóa nhân viên</h2>
        <p style="font-size:14px;color:var(--ink-2)">Chỉ xóa được nhân viên nhập nhầm, chưa có order, lịch cố định, lịch làm hay đánh giá. Nhân viên đã nghỉ việc thì chuyển trạng thái sang <strong>Ngừng làm</strong> để giữ lịch sử.</p>
        <button class="btn sm secondary danger" type="button" id="del-emp">Xóa nhân viên này</button></section>` : ''}`,
    mount() {
      $('#emp-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const p = { code: f.get('code'), name: f.get('name'), rank: f.get('rank'), status: f.get('status'), roles: f.getAll('roles'), preferred_role: f.get('preferred_role'),
          branch_ids: f.getAll('branches').map(Number), email: f.get('email'), phone: f.get('phone'), start_date: f.get('start_date') };
        try {
          await rpc('app_save_employee', { p_id: emp ? emp.id : null, p });
          flash(emp ? `Đã lưu ${p.code} – ${p.name}.` : `Đã thêm ${p.code} – ${p.name}. Hãy cấp mật khẩu tạm để nhân viên đăng nhập.`);
          go('/quan-ly/nhan-vien');
        } catch (e) { const el = $('#emp-err'); el.textContent = e.message; el.hidden = false; window.scrollTo(0, 0); }
      });
      $('#st-emp')?.addEventListener('click', () => setStatus(emp.id, v.status === 'Đang làm' ? 'Ngừng làm' : 'Đang làm', `${emp.code} – ${emp.name}`));
      $('#del-emp')?.addEventListener('click', async () => {
        if (!confirm(`Xóa hoàn toàn ${emp.code} – ${emp.name}?`)) return;
        try { await rpc('app_delete_employee', { p_id: emp.id }); flash(`Đã xóa ${emp.code} – ${emp.name}.`); go('/quan-ly/nhan-vien'); }
        catch (e) { flash(e.message, 'error'); rerender(); }
      });
    },
  };
}
