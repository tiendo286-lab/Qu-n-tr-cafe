// Danh mục: chi nhánh, ca làm việc (giờ ca từng chi nhánh), vai trò làm việc. Tự động lưu.
import { render as rerender } from '../app.js';
import { catalog } from '../data.js';
import { rpc, sb, viError } from '../sb.js';
import { $, $$, flash, hhmm, html, showSaved } from '../ui.js';

export const perm = 'sua_danh_muc';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const abbr = (n) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase();

export async function render() {
  const cat = await catalog();
  return {
    title: 'Chi nhánh, ca & vai trò',
    html: html`
      <div class="page-head"><div><h1>Chi nhánh, ca &amp; vai trò</h1><div class="sub">Mọi thay đổi tự động lưu. Chi nhánh đóng cửa thì chuyển “Ngừng hoạt động” (không xóa, giữ lịch sử).</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <section class="card flush">
        <div class="card-head"><h2>Chi nhánh</h2></div>
        <div class="table-wrap"><table class="table" aria-label="Chi nhánh">
          <thead><tr><th>Mã</th><th>Tên chi nhánh</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>${cat.branches.map((b) => html`<tr class="br-row" data-id="${b.id}">
            <td><input class="input sm" data-f="code" value="${b.code}" maxlength="10" aria-label="Mã chi nhánh" style="width:90px"></td>
            <td><input class="input sm" data-f="name" value="${b.name}" maxlength="80" aria-label="Tên chi nhánh" style="width:320px"></td>
            <td><select class="input sm" data-f="status" aria-label="Trạng thái chi nhánh">${['Đang hoạt động', 'Ngừng hoạt động'].map((s) => html`<option ${s === b.status ? 'selected' : ''}>${s}</option>`)}</select></td>
            <td><button class="btn sm secondary danger del-br" type="button" data-id="${b.id}" data-code="${b.code}" title="Xóa (chỉ khi chưa phát sinh dữ liệu)">Xóa</button></td></tr>`)}</tbody></table></div>
        <form class="toolbar" id="add-br" style="padding:14px 20px;border-top:1px solid var(--line-soft)">
          <strong style="font-size:14px">Thêm chi nhánh</strong>
          <input class="input sm" name="code" placeholder="Mã, vd: TH" maxlength="10" required aria-label="Mã chi nhánh mới" style="width:110px">
          <input class="input sm" name="name" placeholder="Tên chi nhánh" maxlength="80" required aria-label="Tên chi nhánh mới" style="width:260px">
          <button class="btn sm" type="submit">Thêm</button></form>
      </section>
      <section class="card flush">
        <div class="card-head"><h2>Ca làm việc &amp; giờ ca từng chi nhánh</h2><div style="font-size:13px;color:var(--muted)">Tick để bật ca ở chi nhánh; giờ dạng 06:30. Ca “Ngừng sử dụng” không hiện trong lưới order.</div></div>
        <div class="table-wrap"><table class="table rt-fx" aria-label="Ca làm việc">
          <thead><tr><th>Tên ca</th><th>Mã</th><th>Trạng thái</th>${cat.branches.map((b) => html`<th>${b.code}</th>`)}<th></th></tr></thead>
          <tbody>${cat.shifts.map((s) => html`<tr>
            <td class="sh-cell" data-id="${s.id}"><input class="input sm" data-f="name" value="${s.name}" maxlength="30" aria-label="Tên ca" style="width:100px"></td>
            <td class="sh-cell" data-id="${s.id}"><input class="input sm" data-f="code" value="${s.code}" maxlength="5" aria-label="Mã ca" style="width:60px"></td>
            <td class="sh-cell" data-id="${s.id}"><select class="input sm" data-f="status" aria-label="Trạng thái ca">${['Đang sử dụng', 'Ngừng sử dụng'].map((x) => html`<option ${x === s.status ? 'selected' : ''}>${x}</option>`)}</select></td>
            ${cat.branches.map((b) => { const c = cat.bsMap.get(`${b.id}|${s.id}`); return html`<td class="bs-cell" data-b="${b.id}" data-s="${s.id}" data-order="${s.sort_order}">
              <div style="display:flex;align-items:center;gap:6px">
                <input type="checkbox" class="check" data-f="enabled" ${c && c.enabled ? 'checked' : ''} aria-label="${b.code} có ca ${s.name}">
                <input class="input sm" type="text" inputmode="numeric" maxlength="5" placeholder="06:30" data-f="start_time" value="${c?.start_time || ''}" aria-label="${b.code} ${s.name} bắt đầu" style="width:68px;text-align:center">
                <span>–</span><input class="input sm" type="text" inputmode="numeric" maxlength="5" placeholder="12:00" data-f="end_time" value="${c?.end_time || ''}" aria-label="${b.code} ${s.name} kết thúc" style="width:68px;text-align:center"></div></td>`; })}
            <td><button class="btn sm secondary danger del-sh" type="button" data-id="${s.id}" data-name="${s.name}">Xóa</button></td></tr>`)}</tbody></table></div>
        <form class="toolbar" id="add-sh" style="padding:14px 20px;border-top:1px solid var(--line-soft)">
          <strong style="font-size:14px">Thêm ca</strong>
          <input class="input sm" name="name" placeholder="Tên ca, vd: Đêm" maxlength="30" required aria-label="Tên ca mới" style="width:160px">
          <input class="input sm" name="code" placeholder="Mã, vd: Đ" maxlength="5" required aria-label="Mã ca mới" style="width:100px">
          <button class="btn sm" type="submit">Thêm</button><span style="font-size:13px;color:var(--muted)">Thêm ca thì lưới order của nhân viên có thêm 7 ô.</span></form>
      </section>
      <section class="card flush">
        <div class="card-head"><h2>Vai trò làm việc</h2></div>
        <div class="table-wrap"><table class="table" aria-label="Vai trò làm việc">
          <thead><tr><th>Tên vai trò</th><th>Viết tắt</th><th>Trạng thái</th></tr></thead>
          <tbody>${cat.roles.map((r) => html`<tr class="role-row" data-id="${r.id}">
            <td><input class="input sm" data-f="name" value="${r.name}" maxlength="30" aria-label="Tên vai trò" style="width:200px"></td>
            <td style="color:var(--muted)">${abbr(r.name)}</td>
            <td><select class="input sm" data-f="status" aria-label="Trạng thái vai trò">${['Đang sử dụng', 'Ngừng sử dụng'].map((x) => html`<option ${x === r.status ? 'selected' : ''}>${x}</option>`)}</select></td></tr>`)}</tbody></table></div>
        <form class="toolbar" id="add-role" style="padding:14px 20px;border-top:1px solid var(--line-soft)">
          <strong style="font-size:14px">Thêm vai trò</strong>
          <input class="input sm" name="name" placeholder="Vd: Thu ngân" maxlength="30" required aria-label="Tên vai trò mới" style="width:200px">
          <button class="btn sm" type="submit">Thêm</button><span style="font-size:13px;color:var(--muted)">Đổi tên vai trò hoặc ca sẽ cập nhật cả dữ liệu cũ.</span></form>
      </section>`,
    mount() {
      const val = (scope, f) => { const el = scope.querySelector(`[data-f="${f}"]`); return el.type === 'checkbox' ? el.checked : el.value.trim(); };
      const saved = () => showSaved('Đã lưu · ' + hhmm());
      const fail = (e) => showSaved(viError(e), true);
      // Chi nhánh
      $$('.br-row').forEach((row) => row.querySelectorAll('[data-f]').forEach((el) => el.addEventListener('change', async () => {
        const code = val(row, 'code'), name = val(row, 'name'), status = val(row, 'status');
        if (!code || !name) { showSaved('Mã và tên chi nhánh không được để trống.', true); return; }
        if (cat.branches.some((b) => b.id !== Number(row.dataset.id) && b.code.toLowerCase() === code.toLowerCase())) { showSaved(`Mã chi nhánh ${code} đã có.`, true); return; }
        const { error } = await sb.from('branches').update({ code, name, status, display_code: code }).eq('id', Number(row.dataset.id));
        if (error) fail(error); else { saved(); rpc('app_log', { p_action: 'sua_chi_nhanh', p_detail: `${row.dataset.id}:${code}|${name}|${status}` }); }
      })));
      $$('.del-br').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm(`Xóa hẳn chi nhánh ${b.dataset.code}? Chỉ xóa được khi chưa có nhân viên, định biên, lịch nào gắn với chi nhánh này. Nếu đã có dữ liệu, hãy chuyển sang Ngừng hoạt động.`)) return;
        try { await rpc('app_delete_branch', { p_id: Number(b.dataset.id) }); flash('Đã xóa chi nhánh.'); } catch (e) { flash(e.message, 'error'); }
        rerender();
      }));
      $('#add-br').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target); const code = String(f.get('code')).trim(); const name = String(f.get('name')).trim();
        if (cat.branches.some((b) => b.code.toLowerCase() === code.toLowerCase())) { alert(`Mã chi nhánh ${code} đã có.`); return; }
        const order = Math.max(0, ...cat.branches.map((b) => b.sort_order)) + 1;
        const { data, error } = await sb.from('branches').insert({ code, name, sort_order: order, system_code: code, display_code: code, status: 'Đang hoạt động' }).select().single();
        if (error) { alert(viError(error)); return; }
        const first = cat.branches[0];
        const rows = cat.shifts.map((s) => { const src = first ? cat.bsMap.get(`${first.id}|${s.id}`) : null; return { branch_id: data.id, shift_id: s.id, enabled: src?.enabled || 0, start_time: src?.start_time || null, end_time: src?.end_time || null, sort_order: s.sort_order }; });
        if (rows.length) await sb.from('branch_shifts').insert(rows);
        await rpc('app_log', { p_action: 'them_chi_nhanh', p_detail: code });
        flash(`Đã thêm chi nhánh ${code}. Hãy kiểm tra giờ ca của chi nhánh này.`); rerender();
      });
      // Ca
      $$('.sh-cell [data-f]').forEach((el) => el.addEventListener('change', async () => {
        const id = Number(el.closest('.sh-cell').dataset.id);
        const cells = $$(`.sh-cell[data-id="${id}"]`);
        const get = (f) => cells.map((c) => c.querySelector(`[data-f="${f}"]`)).find(Boolean).value.trim();
        const s = cat.shifts.find((x) => x.id === id);
        const status = get('status');
        if (status === 'Ngừng sử dụng' && s.status === 'Đang sử dụng' && cat.shifts.filter((x) => x.status === 'Đang sử dụng').length <= 1) { showSaved('Phải còn ít nhất một ca đang sử dụng.', true); return; }
        try { await rpc('app_save_shift', { p_id: id, p_name: get('name'), p_code: get('code'), p_status: status }); s.status = status; saved(); } catch (e) { fail(e); }
      }));
      $$('.bs-cell [data-f]').forEach((el) => el.addEventListener('change', async () => {
        const c = el.closest('.bs-cell');
        const enabled = val(c, 'enabled'); const st = val(c, 'start_time'); const en = val(c, 'end_time');
        if ((enabled || st) && !TIME_RE.test(st)) { showSaved('Giờ bắt đầu phải có dạng giờ:phút, ví dụ 06:30.', true); return; }
        if ((enabled || en) && !TIME_RE.test(en)) { showSaved('Giờ kết thúc phải có dạng giờ:phút, ví dụ 12:00.', true); return; }
        const { error } = await sb.from('branch_shifts').upsert({ branch_id: Number(c.dataset.b), shift_id: Number(c.dataset.s), enabled: enabled ? 1 : 0, start_time: st || null, end_time: en || null, sort_order: Number(c.dataset.order) || 0 });
        if (error) fail(error); else saved();
      }));
      $$('.del-sh').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm(`Xóa hẳn ca ${b.dataset.name}? Chỉ xóa được khi chưa có order, định biên, lịch nào dùng ca này. Nếu đã có dữ liệu, hãy chuyển sang Ngừng sử dụng.`)) return;
        try { await rpc('app_delete_shift', { p_id: Number(b.dataset.id) }); flash('Đã xóa ca.'); } catch (e) { flash(e.message, 'error'); }
        rerender();
      }));
      $('#add-sh').addEventListener('submit', async (ev) => {
        ev.preventDefault(); const f = new FormData(ev.target);
        try { await rpc('app_save_shift', { p_id: null, p_name: f.get('name'), p_code: f.get('code'), p_status: 'Đang sử dụng' }); flash(`Đã thêm ca ${f.get('name')}. Bật ca và nhập giờ cho từng chi nhánh có ca này.`); }
        catch (e) { flash(e.message, 'error'); }
        rerender();
      });
      // Vai trò
      $$('.role-row [data-f]').forEach((el) => el.addEventListener('change', async () => {
        const row = el.closest('.role-row');
        try { await rpc('app_save_role', { p_id: Number(row.dataset.id), p_name: val(row, 'name'), p_status: val(row, 'status') }); saved(); } catch (e) { fail(e); }
      }));
      $('#add-role').addEventListener('submit', async (ev) => {
        ev.preventDefault(); const f = new FormData(ev.target);
        try { await rpc('app_save_role', { p_id: null, p_name: f.get('name'), p_status: 'Đang sử dụng' }); flash('Đã thêm vai trò.'); } catch (e) { flash(e.message, 'error'); }
        rerender();
      });
    },
  };
}
