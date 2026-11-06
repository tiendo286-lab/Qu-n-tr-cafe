// Giờ mở / hết hạn order: lặp lại hằng tuần + giờ riêng từng tuần
import { render as rerender } from '../app.js';
import { DOW_LABELS, orderWindow, vnToday, weekLabel } from '../data.js';
import { rpc, sb, sel, viError } from '../sb.js';
import { $$, flash, html } from '../ui.js';

export const perm = 'cai_gio_order';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function render() {
  const [settings, weeks] = await Promise.all([
    sel('settings', 'key, value', (b) => b.like('key', 'order_%')),
    sel('weeks', '*', (b) => b.gte('end_date', vnToday()).order('start_date')),
  ]);
  const s = Object.fromEntries(settings.map((x) => [x.key, x.value]));
  const rule = { open_dow: Number(s.order_open_dow ?? 0), open_time: s.order_open_time || '08:00', close_dow: Number(s.order_close_dow ?? 3), close_time: s.order_close_time || '22:00' };
  const wins = await Promise.all(weeks.map((w) => orderWindow(w.id)));
  return {
    title: 'Giờ order',
    html: html`
      <div class="page-head"><div><h1>Giờ order</h1><div class="sub">Nhân viên chỉ order được trong khoảng giờ mở → hết hạn. Sau hạn chỉ người có quyền “Sửa order sau hạn” sửa được.</div></div></div>
      <section class="card stack" style="max-width:860px">
        <h2>Lặp lại hằng tuần</h2>
        <div style="font-size:14px;color:var(--muted)">Tính theo <strong>tuần liền trước</strong> tuần cần order. Ví dụ: mở Thứ Hai 08:00, hết hạn Thứ Năm 22:00 → order cho tuần sau.</div>
        <form class="toolbar" style="gap:16px" id="rule-form">
          <div class="field"><label for="open_dow">Mở order</label><div class="toolbar" style="gap:8px">
            <select class="input" id="open_dow" name="open_dow" style="width:150px">${DOW_LABELS.map((d, i) => html`<option value="${i}" ${i === rule.open_dow ? 'selected' : ''}>${d}</option>`)}</select>
            <input class="input" name="open_time" value="${rule.open_time}" maxlength="5" inputmode="numeric" aria-label="Giờ mở" style="width:90px;text-align:center"></div></div>
          <div class="field"><label for="close_dow">Hết hạn</label><div class="toolbar" style="gap:8px">
            <select class="input" id="close_dow" name="close_dow" style="width:150px">${DOW_LABELS.map((d, i) => html`<option value="${i}" ${i === rule.close_dow ? 'selected' : ''}>${d}</option>`)}</select>
            <input class="input" name="close_time" value="${rule.close_time}" maxlength="5" inputmode="numeric" aria-label="Giờ hết hạn" style="width:90px;text-align:center"></div></div>
          <button class="btn" type="submit" style="align-self:flex-end">Lưu</button>
        </form>
      </section>
      <section class="card flush">
        <div class="card-head"><h2>Các tuần đã tạo</h2><div style="font-size:13px;color:var(--muted)">Sửa riêng một tuần (dịp lễ) mà không ảnh hưởng tuần khác. Tuần mới tạo ở trang Order lịch làm.</div></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Tuần</th><th>Mở order</th><th>Hết hạn</th><th>Trạng thái</th><th>Cài riêng tuần này</th></tr></thead>
          <tbody>${weeks.length ? weeks.map((w, i) => {
            const win = wins[i];
            return html`<tr><td style="font-weight:600">${weekLabel(w.start_date)}</td><td>${win.open_text}</td><td>${win.close_text}</td>
              <td>${win.state === 'dang_mo' ? html`<span class="pill ok">Đang mở</span>` : win.state === 'chua_mo' ? html`<span class="pill mute">Chưa mở</span>` : html`<span class="pill off">Đã hết hạn</span>`}
                ${win.custom ? html`<span class="pill warn">Giờ riêng</span>` : ''}</td>
              <td><form class="toolbar week-win" data-id="${w.id}" style="gap:6px">
                <input class="input sm" type="datetime-local" name="open_at" value="${win.open}" required aria-label="Mở order">
                <span>→</span><input class="input sm" type="datetime-local" name="close_at" value="${win.close}" required aria-label="Hết hạn">
                <button class="btn sm" type="submit">Lưu</button>
                ${win.custom ? html`<button class="btn sm secondary reset-win" type="button" data-id="${w.id}">Về mặc định</button>` : ''}</form></td></tr>`;
          }) : html`<tr><td colspan="5" style="color:var(--muted)">Chưa có tuần nào từ tuần này trở đi. Hãy tạo tuần mới ở trang <a href="#/quan-ly/order">Order lịch làm</a>.</td></tr>`}</tbody>
        </table></div>
      </section>`,
    mount() {
      document.getElementById('rule-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const od = Number(f.get('open_dow')), cd = Number(f.get('close_dow'));
        const ot = String(f.get('open_time')).trim(), ct = String(f.get('close_time')).trim();
        if (!TIME_RE.test(ot) || !TIME_RE.test(ct)) { alert('Giờ không hợp lệ. Nhập dạng giờ:phút, ví dụ 08:00.'); return; }
        if (cd < od || (cd === od && ct <= ot)) { alert('Giờ hết hạn phải sau giờ mở.'); return; }
        const rows = [['order_open_dow', String(od)], ['order_open_time', ot], ['order_close_dow', String(cd)], ['order_close_time', ct]].map(([key, value]) => ({ key, value }));
        const { error } = await sb.from('settings').upsert(rows);
        if (error) { alert(viError(error)); return; }
        await rpc('app_log', { p_action: 'sua_gio_order', p_detail: `${od} ${ot} -> ${cd} ${ct}` });
        flash('Đã lưu giờ order lặp lại hằng tuần.'); rerender();
      });
      $$('.week-win').forEach((form) => form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = new FormData(form);
        const o = String(f.get('open_at')), c = String(f.get('close_at'));
        if (!o || !c || c <= o) { alert('Giờ hết hạn phải sau giờ mở.'); return; }
        const { error } = await sb.from('week_order_windows').upsert({ week_id: Number(form.dataset.id), open_at: o.slice(0, 16), close_at: c.slice(0, 16), updated_at: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ') });
        if (error) { alert(viError(error)); return; }
        await rpc('app_log', { p_action: 'sua_gio_order_tuan', p_detail: `${form.dataset.id}: ${o} -> ${c}` });
        flash('Đã cài giờ riêng cho tuần.'); rerender();
      }));
      $$('.reset-win').forEach((b) => b.addEventListener('click', async () => {
        const { error } = await sb.from('week_order_windows').delete().eq('week_id', Number(b.dataset.id));
        if (error) { alert(viError(error)); return; }
        flash('Tuần dùng lại giờ mặc định.'); rerender();
      }));
    },
  };
}
