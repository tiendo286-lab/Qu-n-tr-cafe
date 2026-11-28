// Bước 109 — Quá hạn & phạt: việc quá hạn tự vào đây; Chủ xác nhận phạt (sửa được số tiền) hoặc bỏ qua (ghi lý do). Quản lý tổng xem.
import { rpc } from '../sb.js';
import { vnToday } from '../data.js';
import { $, dialog, html, str } from '../ui.js';
import { JOBS, ROLE, jobName, STYLE, dur, fd, money, ms, shortName, toast } from '../cv_chung.js?v=2026.11.29.5';

export const perm = 'phan_cong';
let TAB = 'cho';

export async function render({ params }) {
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : vnToday().slice(0, 7);
  let D = await rpc('app_pc_penalties', { p_month: month });
  const draw = () => {
    const R = D.rows || [], ed = D.can_edit, now = D.now;
    const by = { cho: R.filter((x) => x.status === 'cho'), phat: R.filter((x) => x.status === 'phat'), bo: R.filter((x) => x.status === 'bo') };
    const per = {};
    R.forEach((x) => { const r = per[x.name] = per[x.name] || { n: 0, ph: 0, amt: 0, bo: 0 }; r.n++; if (x.status === 'phat') { r.ph++; r.amt += Number(x.amount || 0); } if (x.status === 'bo') r.bo++; });
    const row = (x) => {
      const end = x.end_at || now, open = !x.end_at, late = ms(end) - ms(x.due_at);
      let act;
      if (x.status === 'cho') act = ed ? html`<input class="input" inputmode="numeric" aria-label="Số tiền phạt" value="${Number(x.fine || D.default_fine).toLocaleString('vi-VN')}" data-amt="${x.id}"><button class="btn sm danger" data-phat="${x.id}">Xác nhận phạt</button><button class="btn sm secondary" data-bo="${x.id}">Bỏ qua</button>` : html`<span class="pill warn">Chờ Chủ xác nhận</span>`;
      else if (x.status === 'phat') act = html`<span class="pill off">Đã phạt ${money(x.amount)} · ${fd(x.decided_at)}</span>${ed ? html`<button class="btn sm secondary" data-undo="${x.id}">Huỷ</button>` : ''}`;
      else act = html`<span class="pill mute">Bỏ qua: ${x.reason}</span>${ed ? html`<button class="btn sm secondary" data-undo="${x.id}">Huỷ</button>` : ''}`;
      return html`<div class="qh-row"><div><b>${shortName(x.name)}</b><div class="pc-sub">${ROLE[x.role] || ''}</div></div>
        <div><span class="pc-jb">${jobName(x.job)}</span>${x.code ? html` <span class="pc-br">${x.code}</span>` : ''}${x.step ? html` <span class="pc-sub">bước: ${x.step}</span>` : ''}<div style="margin-top:3px;font-size:14px">${x.title}</div>${(x.others || []).length ? html`<div class="pc-sub">Giao cùng ${x.others.map(shortName).join(', ')} — phạt người nào anh chọn</div>` : ''}</div>
        <div style="font-size:13px">Hạn ${fd(x.due_at)}<br><b class="red">Trễ ${dur(late)}</b> · ${open ? html`<span class="pill off">vẫn chưa làm</span>` : html`<span class="pill mute">đã làm, trễ</span>`}</div>
        <div class="qh-act">${act}</div></div>`;
    };
    const L = by[TAB];
    return html`
      <div class="pc-info">Việc quá hạn tự vào đây. <b>Không tự trừ tiền</b>: Chủ xem rồi bấm <b>Xác nhận phạt</b> (sửa được số tiền) hoặc <b>Bỏ qua</b> (ghi lý do). Phạt xong, nhân viên nhận thông báo và thấy ở "Việc của tôi", lý do "Bị phạt do không hoàn thành công việc đúng hạn". Trừ vào lương khi làm Bảng công (đợt 3).${ed ? '' : html` <b>Quản lý tổng chỉ xem.</b>`}</div>
      <div class="pc-chips" style="align-items:center">${[['cho', 'Chờ xác nhận'], ['phat', 'Đã phạt'], ['bo', 'Đã bỏ qua']].map(([k, l]) => html`<button class="pc-chip ${TAB === k ? 'on' : ''}" data-tab="${k}">${l} (${by[k].length})</button>`)}
        <input class="input" type="month" id="qh-m" value="${month}" style="margin-left:auto;max-width:170px" aria-label="Tháng"></div>
      <div class="card" style="padding:0">${L.length ? L.map(row) : html`<div class="pc-sub" style="padding:20px;text-align:center">Không có</div>`}</div>
      <div class="pc-sec">Tổng tháng ${month.split('-').reverse().join('/')}</div>
      <div class="card" style="padding:6px 8px;overflow-x:auto"><table class="pc-tbl"><thead><tr><th>Người</th><th class="n">Lần quá hạn</th><th class="n">Đã phạt</th><th class="n">Tiền phạt</th><th class="n">Bỏ qua</th></tr></thead>
        <tbody>${Object.entries(per).map(([n, r]) => html`<tr><td><b>${shortName(n)}</b></td><td class="n">${r.n}</td><td class="n">${r.ph}</td><td class="n"><b>${money(r.amt)}</b></td><td class="n">${r.bo}</td></tr>`)}${Object.keys(per).length ? '' : html`<tr><td colspan="5" class="pc-sub">Chưa có</td></tr>`}</tbody></table></div>`;
  };
  return {
    title: 'Quá hạn & phạt',
    html: html`${STYLE}<style>.qh-row{display:grid;grid-template-columns:150px minmax(0,1fr) 170px auto;gap:12px;align-items:center;padding:12px 14px;border-top:1px solid var(--line-soft)}.qh-row:first-child{border-top:0}
      .qh-act{display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap}.qh-act input{width:100px;text-align:right}
      @media (max-width:1180px) and (min-width:861px){.qh-row{grid-template-columns:130px minmax(0,1fr)}.qh-act{justify-content:flex-start}}   /* UI-06: máy tính nhỏ không tràn ngang */
      @media (max-width:860px){.qh-row{grid-template-columns:1fr;gap:6px}.qh-act{justify-content:flex-start}}</style>
      <div class="page-head"><div><h1>Quá hạn & phạt</h1><div class="sub">Mỗi lần quá hạn: Chủ xác nhận phạt hoặc bỏ qua</div></div></div><div id="pc-body">${draw()}</div>`,
    mount(root) {
      const body = $('#pc-body', root);
      const reload = async (msg) => { D = await rpc('app_pc_penalties', { p_month: month }); body.innerHTML = str(draw()); if (msg) toast(msg); };
      const set = async (id, status, amount, reason, msg) => { try { await rpc('app_pc_penalty_set', { p_id: id, p_status: status, p_amount: amount, p_reason: reason }); await reload(msg); } catch (e) { alert(e.message || e); } };
      body.addEventListener('change', (e) => { if (e.target.id === 'qh-m' && /^\d{4}-\d{2}$/.test(e.target.value)) location.hash = `#/cong-viec/qua-han?thang=${e.target.value}`; });
      body.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tab]'); if (t) { TAB = t.dataset.tab; body.innerHTML = str(draw()); return; }
        const p = e.target.closest('[data-phat]'), b = e.target.closest('[data-bo]'), u = e.target.closest('[data-undo]');
        if (p) {
          const id = +p.dataset.phat, x = D.rows.find((r) => r.id === id), amt = +String($(`[data-amt="${id}"]`, body).value).replace(/\D/g, '');
          if (!amt) { alert('Nhập số tiền phạt'); return; }
          p.disabled = true; set(id, 'phat', amt, null, `Đã phạt ${money(amt)} · ${shortName(x.name)} — đã báo cho người bị phạt`);
        } else if (b) {
          const id = +b.dataset.bo, x = D.rows.find((r) => r.id === id);
          const d = dialog(html`<div class="stack pc-dlg"><h2>Bỏ qua, không phạt ${shortName(x.name)}</h2><label class="pc-fld"><span>Lý do (bắt buộc)</span><input class="input" id="qh-why" placeholder="vd: nghỉ phép, kế toán chậm file…"></label>
            <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn secondary" data-close>Đóng</button><button type="button" class="btn" data-ok>Bỏ qua</button></div></div>`);
          $('[data-close]', d).onclick = () => d.close();
          $('[data-ok]', d).onclick = () => { const w = $('#qh-why', d).value.trim(); if (!w) { alert('Ghi lý do bỏ qua'); return; } d.close(); set(id, 'bo', null, w, 'Đã bỏ qua'); };
        } else if (u) set(+u.dataset.undo, 'cho', null, null, 'Đã huỷ — quay về Chờ xác nhận');
      });
    },
  };
}
