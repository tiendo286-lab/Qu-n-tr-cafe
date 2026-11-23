// Bước 109 — Bảng phân công: mỗi việc × mỗi cơ sở ai làm, hạn bao lâu, mấy bước, mức phạt. Chỉ tài khoản Chủ sửa; Quản lý tổng xem.
import { rpc } from '../sb.js';
import { $, $$, dialog, html, str } from '../ui.js';
import { GROUP, GROUPS, JOBS, MERGED, ORDER, ROLE, STYLE, learnJobs, money, shortName, toast } from '../cv_chung.js?v=2026.11.23.4';
import { hTxt, openJobDialog, schedTxt, webTxt } from '../pc_hop_viec.js?v=2026.11.23.4';

export const perm = 'phan_cong';
const FROM = {
  1: 'Từ lúc kế toán đủ file ca (Fabi + chuyển khoản)', 2: 'Từ lúc nhân viên gửi phiếu ca có nghỉ / làm thay', 3: 'Từ lúc hết ngày làm việc', 4: 'Từ lúc hết ngày làm việc',
  7: 'Từ lúc phát sinh lệch · lệch chờ tiền về chưa tính', 8: 'Từ lúc nhân viên gửi giải trình', 10: 'Thứ Hai hằng tuần', 11: 'Từ lúc phiếu xuất quá ngày giao mà chưa nhận',
  12: 'Từ lúc nhân viên báo nhận hàng', 13: 'Từ lúc nhân viên báo nhận hàng', 14: 'Từ lúc quản lý xác nhận xong đối soát hàng', 24: 'Bàn giao ca: từ lúc nhân viên gửi phiếu · việc giao tay: từ lúc giao',
};
const HOW = { 1: 'Mỗi phiếu ca 1 việc', 2: 'Mỗi phiếu 1 việc', 3: 'Mỗi ngày mỗi cơ sở 1 việc', 4: 'Mỗi ngày mỗi cơ sở 1 việc', 7: 'Mỗi khoản lệch 1 việc', 8: 'Mỗi giải trình 1 việc',
  10: 'Mỗi tuần mỗi cơ sở 1 việc', 11: 'Gộp: mỗi cơ sở 1 việc, liệt kê các phiếu', 12: 'Gộp: mỗi cơ sở 1 việc, liệt kê các lần giao', 13: 'Gộp chung 1 việc cho mọi cơ sở', 14: 'Gộp chung 1 việc cho mọi cơ sở',
  24: 'Mỗi nội dung 1 việc · người giao chọn người làm + người kiểm tra' };

const WEB = [1, 3, 4, 7, 8, 10, 11, 12, 13, 14];   // bước 124: việc có sẵn dùng hộp chung

export async function render() {
  let D = await rpc('app_pc_board');
  const draw = () => {
    learnJobs(D.jobs);
    const ed = D.can_edit, P = D.people || [], nameOf = (id) => shortName(P.find((p) => p.id === id)?.name) || `#${id}`;
    const J = (j) => D.jobs.find((x) => x.job === j);
    const asg = (j, b) => (D.assign.find((x) => x.job === (J(j)?.same_as_1 ? 1 : j) && x.branch_id === b)?.accounts) || [];
    const chips = (ids, cls = '') => (ids.length ? ids.map((id) => html`<span class="pb-ch ${cls}">${nameOf(id)}</span>`) : html`<span class="pb-ch none">Chưa giao</span>`);
    const whoTxt = (w) => (w === 'branch' ? 'Theo cơ sở' : w === 'branch+ql_tong' ? 'Theo cơ sở + QL tổng' : w === 'kt' ? 'Kế toán' : w === 'doer' ? 'Người được giao' : w === 'checker' ? 'Người kiểm tra (người giao chọn)' : w?.startsWith('acc:') ? nameOf(+w.slice(4)) : w);
    const stepTxt = (j) => J(j).steps.map((s, i) => `${J(j).steps.length > 1 ? i + 1 + '. ' : ''}${s.n} · ${s.d == null ? (s.who === 'doer' ? 'hạn người giao chọn' : 'không hạn') : s.d + ' ngày'}`).join(' → ');
    const qlTong = P.filter((p) => p.role === 'ql_tong').map((p) => p.id);
    const cell = (j, b) => {
      const job = J(j), ids = asg(j, b.id), plus = job.steps[0].who === 'branch+ql_tong' ? qlTong.filter((x) => !ids.includes(x)) : [];
      const sc = (D.sched || []).find((x) => x.job === j && x.branch_id === b.id);
      if (sc && !sc.enabled) return html`<td class="pb-cell ${ed ? 'ed' : ''}" data-wjob="${j}" ${ed ? html`data-cell="${j}" data-b="${b.id}"` : ''}><span class="pc-sub"><i>Tắt ở cơ sở này</i></span></td>`;
      return html`<td class="pb-cell ${ed ? 'ed' : ''}" data-wjob="${j}" ${ed ? html`data-cell="${j}" data-b="${b.id}"` : ''}>${chips(ids)}${sc ? html`<span class="pv-sch">${webTxt(j, sc)}</span>` : ''}${job.need_check && sc ? (sc.checkers || []).map((id) => html`<span class="pb-ch rv">KT: ${nameOf(id)}</span>`) : ''}${plus.map((x) => html`<span class="pb-ch">${nameOf(x)}</span>`)}${job.same_as_1 ? html`<span class="pb-l">= như Đối soát ca</span>` : ''}${j === 1 && ids.length > 1 ? html`<span class="pb-l">ai làm trước cũng được</span>` : ''}</td>`;
    };
    const mid = (j) => {
      const job = J(j);
      if (j === 2) return html`<td colspan="${D.branches.length}">${job.steps.map((s, i) => html`<span class="pc-sub">${i + 1}. ${s.n}:</span> ${s.who.startsWith('acc:') ? html`<span class="pb-ch boss">${nameOf(+s.who.slice(4))}</span>` : html`<span class="pb-ch">${whoTxt(s.who)}</span>`} `)}<span class="pc-sub">· mọi cơ sở</span></td>`;
      if (GROUP[j] === 'kt') return html`<td colspan="${D.branches.length}">${D.kt ? html`<span class="pb-ch kt">${nameOf(D.kt)}</span>` : html`<span class="pb-ch none">Chưa chọn kế toán</span>`} <span class="pc-sub">Kế toán · ${j === 3 || j === 4 ? D.branches.filter((b) => b.fabi).map((b) => b.code).join(', ') : 'mọi cơ sở'}</span></td>`;
      return D.branches.map((b) => cell(j, b));
    };
    const rowsFor = (g) => ORDER.filter((j) => GROUP[j] === g && J(j)).map((j) => { const job = J(j); return html`<tr class="${job.enabled ? '' : 'off'}">
      <td><div class="pb-jn ${ed ? 'ed' : ''}" ${ed ? html`data-job="${j}"` : ''}>${j}. ${JOBS[j]}${job.enabled ? '' : ' (đang tắt)'}</div><div class="pc-sub">${HOW[j]}</div></td>
      <td><div style="font-size:13px"><b>${stepTxt(j)}</b></div><div class="pc-sub">${FROM[j]}</div></td>${mid(j)}<td>${(D.sched || []).some((x) => x.job === j) ? html`<span class="pc-sub">theo cơ sở</span>` : job.fine ? money(job.fine) : html`<span class="pc-sub">—</span>`}</td></tr>`; });
    // bước 123: việc tự thêm
    const CU = (D.jobs || []).filter((x) => x.custom);
    const S = (j, b) => (D.sched || []).find((x) => x.job === j && x.branch_id === b);
    const cuTags = (job) => html`<div class="pv-tags">${job.need_photo ? html`<span class="pv-tg">📷 Bắt buộc ảnh</span>` : ''}${job.need_check ? html`<span class="pv-tg rv">✓ Có kiểm tra</span>` : ''}${job.enabled ? '' : html`<span class="pv-tg off">Đang tạm tắt</span>`}</div>`;
    const cuCell = (job, b) => { const s = S(job.job, b.id); const ids = (D.assign.find((x) => x.job === job.job && x.branch_id === b.id)?.accounts) || [];
      if (!s || !s.enabled) return html`<span class="pc-sub"><i>Tắt</i></span>`;
      return html`${chips(ids)}${job.need_check ? (s.checkers || []).map((id) => html`<span class="pb-ch rv">KT: ${nameOf(id)} · ${hTxt(s.check_h)}</span>`) : ''}<span class="pv-sch">${schedTxt(s)}</span>`; };
    const cuRows = CU.map((job) => html`<tr data-cjob="${job.job}" class="${job.enabled ? '' : 'off'}">
      <td><div class="pb-jn ${ed ? 'ed' : ''}" ${ed ? html`data-job="${job.job}"` : ''}>${job.name}</div>${cuTags(job)}</td>
      <td><div style="font-size:13px"><b>Làm${job.need_check ? ' → Kiểm tra' : ''}</b></div><div class="pc-sub">Theo lịch từng cơ sở${job.guide ? ' · ' + job.guide.slice(0, 60) : ''}</div></td>
      ${D.branches.map((b) => html`<td class="pb-cell ${ed ? 'ed' : ''}" ${ed ? html`data-job="${job.job}"` : ''}>${cuCell(job, b)}</td>`)}<td><span class="pc-sub">theo cơ sở</span></td></tr>`);
    const cuCards = CU.map((job) => html`<div class="pb-mc ${job.enabled ? '' : 'off'}" data-cjob="${job.job}"><div class="pb-jn ${ed ? 'ed' : ''}" ${ed ? html`data-job="${job.job}"` : ''}>${job.name} ${ed ? html`<span style="color:var(--primary);font-size:12px">✎ sửa</span>` : ''}</div>${cuTags(job)}
      ${D.branches.map((b) => html`<div class="pb-mr"><b>${b.code}</b><span style="text-align:right">${cuCell(job, b)}</span></div>`)}</div>`);
    const mcards = ORDER.filter((j) => J(j)).map((j) => { const job = J(j);
      const rows = GROUP[j] === 'kt' ? html`<div class="pb-mr"><b>Kế toán</b><span>${D.kt ? html`<span class="pb-ch kt">${nameOf(D.kt)}</span>` : html`<span class="pb-ch none">Chưa chọn</span>`}</span></div>`
        : j === 2 ? job.steps.map((s, i) => html`<div class="pb-mr"><b>${i + 1}. ${s.n}</b><span><span class="pb-ch">${whoTxt(s.who)}</span></span></div>`)
          : D.branches.map((b) => { const sc = (D.sched || []).find((x) => x.job === j && x.branch_id === b.id);
            return html`<div class="pb-mr ${ed ? 'ed' : ''}" data-wjob="${j}" ${ed ? html`data-cell="${j}" data-b="${b.id}"` : ''}><b>${b.code}</b><span style="text-align:right">${sc && !sc.enabled ? html`<i class="pc-sub">Tắt</i>` : html`${chips(asg(j, b.id))}${sc ? html`<span class="pv-sch">${webTxt(j, sc)}</span>` : ''}`}</span></div>`; });
      return html`<div class="pb-mc ${job.enabled ? '' : 'off'}"><div class="pb-jn ${ed ? 'ed' : ''}" ${ed ? html`data-job="${j}"` : ''}>${j}. ${JOBS[j]} ${ed ? html`<span style="color:var(--primary);font-size:12px">✎ sửa</span>` : ''}</div>
        <div style="font-size:13px"><b>${stepTxt(j)}</b>${job.fine ? ' · phạt ' + money(job.fine) : ''}</div><div class="pc-sub">${FROM[j]}</div>${rows}${job.same_as_1 ? html`<div class="pc-sub">= như Đối soát ca</div>` : ''}</div>`; });
    return html`
      ${D.old_rule_on ? html`<div class="alert warn">Quy tắc tự giao cũ (bước 108) vẫn đang bật.</div>` : html`<div class="alert ok" style="font-size:13px">✓ Quy tắc tự giao cũ (bước 108) đã tắt, 44 việc cũ đã đóng. Web tự tạo việc theo bảng này <b>từ ngày ${(D.start || '').split('-').reverse().join('/')}</b> — tồn cũ trước ngày đó không tạo việc, không phạt.</div>`}
      ${ed ? '' : html`<div class="pc-info" style="margin-top:10px">Quản lý tổng xem được bảng; chỉ tài khoản Chủ sửa được.</div>`}
      <div class="pb-set"><div class="card"><h3 style="margin:0">Người làm chức năng Kế toán</h3><div class="pc-sub">Chọn bất kỳ nhân viên nào. Người này nhận việc File Fabi, Chuyển khoản, Hoá đơn bù, Giao bù (và có quyền Kế toán).</div>
          <select class="input" id="pb-kt" aria-label="Kế toán phụ trách" ${ed ? '' : 'disabled'}><option value="">— Chưa chọn —</option>${P.filter((p) => p.role !== 'chu').map((p) => html`<option value="${p.id}" ${p.id === D.kt ? 'selected' : ''}>${shortName(p.name)} · ${ROLE[p.role] || p.role}</option>`)}</select></div>
        <div class="card"><h3 style="margin:0">Phạt khi quá hạn</h3><div style="font-size:14px">Mặc định <b>50.000đ / lần</b> · từng việc sửa riêng (bấm tên việc).</div><div class="pc-sub">Web <b>không tự trừ</b>: việc quá hạn lên trang <a href="#/cong-viec/qua-han">Quá hạn & phạt</a>, Chủ xác nhận hoặc bỏ qua. Lý do: "Bị phạt do không hoàn thành công việc đúng hạn".</div></div></div>
      <div class="pb-mx"><table><thead><tr><th style="width:220px">Việc ${ed ? html`<span style="font-weight:400">(bấm tên để sửa)</span>` : ''}</th><th style="width:210px">Hạn · các bước</th>${D.branches.map((b) => html`<th>${b.code}</th>`)}<th style="width:80px">Phạt</th></tr></thead>
        <tbody>${Object.keys(GROUPS).map((g) => html`<tr class="pb-gh"><td colspan="${D.branches.length + 3}">${GROUPS[g]}</td></tr>${rowsFor(g)}`)}
          <tr class="pb-gh tu"><td colspan="${D.branches.length + 3}">Việc tự thêm (lịch từng cơ sở)</td></tr>${cuRows}
          ${CU.length ? '' : html`<tr><td colspan="${D.branches.length + 3}" class="pc-sub">Chưa có việc tự thêm.</td></tr>`}</tbody></table></div>
      <div class="pb-mcs">${mcards}<div class="pc-sec pc-cat">Việc tự thêm</div>${cuCards}${CU.length ? '' : html`<div class="pc-sub">Chưa có việc tự thêm.</div>`}</div>
      <div class="pv-addbar">${ed ? html`<button type="button" class="btn" id="pv-add">+ Thêm việc</button>` : ''}<span class="pc-sub">Việc lặp lại anh tự đặt: vệ sinh máy, kiểm kho, lau kính… Mỗi cơ sở chọn người làm, ngày làm, hạn, mức phạt riêng.</span></div>
      <div class="pb-set"><div class="card"><h3 style="margin:0">Không tạo việc (để biết)</h3><div class="pc-sub" style="line-height:1.7">5 · Phiếu chi chuyển khoản — làm luôn trong Đối soát ca.<br>6 · Kiểm đếm tiền mặt cuối ngày — không hạn; lệch xử lý ở trang đối soát của ca (Chốt ca › ② Phần tiền).<br>9 · Khách nợ — luôn hiện đầu "Việc của tôi" cho người đối soát ca, tới khi khách trả.<br>15, 21, 22 · Bỏ / giữ như hiện nay.</div></div>
        <div class="card"><h3 style="margin:0">Đợt sau</h3><div class="pc-sub" style="line-height:1.7"><b>Đợt 2:</b> quản lý chỉ thấy cơ sở mình được phân công (máy chủ chặn), Quản lý tổng thấy hết.<br><b>Đợt 3:</b> 16 Xếp lịch tuần · 17 Bảng công · 18 Đào tạo · 19 Nội quy · 20 Cam kết · 23 Hỗ trợ nhân viên.</div></div></div>`;
  };
  return {
    title: 'Bảng phân công',
    html: html`${STYLE}<style>
      .pb-set{display:grid;grid-template-columns:1.3fr 1fr;gap:12px;margin:12px 0}.pb-set .card{display:flex;flex-direction:column;gap:8px}
      .pb-mx{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:auto;margin-bottom:12px}.pb-mx table{border-collapse:collapse;width:100%}
      .pb-mx th{background:var(--subtle);font-size:12px;color:var(--muted);text-align:left;padding:9px 10px;border-bottom:1px solid var(--line)}
      .pb-mx td{padding:9px 10px;border-top:1px solid var(--line-soft);vertical-align:top;font-size:13px}.pb-gh td{background:var(--navy,#2f3d31);color:#fff;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
      .pb-jn{font-weight:700;font-size:14px}.pb-jn.ed{cursor:pointer;text-decoration:underline dotted var(--primary);text-underline-offset:3px}
      .pb-cell.ed,.pb-mr.ed{cursor:pointer}.pb-cell.ed:hover,.pb-mr.ed:hover{background:var(--caramel-soft,#f6ead9)}tr.off td,.pb-mc.off{opacity:.5}
      .pb-ch{display:inline-block;background:#e6ecdc;color:#3f5a36;border-radius:6px;padding:2px 7px;margin:0 3px 3px 0;font-weight:600;font-size:12px}.pb-ch.kt{background:#efe5ee;color:#6b3d63}.pb-ch.boss{background:var(--caramel-soft,#f6ead9);color:var(--primary)}.pb-ch.none{background:var(--off-bg);color:var(--off-ink)}
      .pb-l{display:block;font-size:11px;color:var(--muted)}
      .pb-gh.tu td{background:#5b4a1e}.pb-ch.rv{background:var(--plum-bg,#efe5ee);color:var(--plum-ink,#6b3d63)}.pv-sch{display:block;font-size:12px;color:var(--ink-2);margin-top:2px}
      .pv-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}.pv-tg{font-size:11px;font-weight:600;border-radius:6px;padding:1px 6px;background:#e3eaf1;color:#2d4a66}.pv-tg.rv{background:var(--plum-bg,#efe5ee);color:var(--plum-ink,#6b3d63)}.pv-tg.off{background:var(--off-bg);color:var(--off-ink)}
      .pv-addbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:0 0 12px}.pb-mcs{display:none}.pb-mc{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:10px}
      .pb-mr{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid var(--line-soft);font-size:13px;align-items:center}
      .pb-step{display:grid;grid-template-columns:24px 1fr 1fr 84px 32px;gap:6px;align-items:center}.pb-x{border:0;background:var(--off-bg);color:var(--off-ink);border-radius:8px;height:34px;cursor:pointer}
      @media (max-width:860px){.pb-set{grid-template-columns:1fr}.pb-mx{display:none}.pb-mcs{display:block}.pb-step{grid-template-columns:22px 1fr 76px 30px}.pb-step .w{grid-column:2/4}}
      </style><div class="page-head"><div><h1>Bảng phân công</h1><div class="sub">Mỗi việc × mỗi cơ sở: ai làm, hạn bao lâu, mấy bước. Web tự tạo việc theo bảng này.</div></div></div><div id="pc-body">${draw()}</div>`,
    mount(root) {
      const body = $('#pc-body', root);
      const reload = async (msg) => { D = await rpc('app_pc_board'); body.innerHTML = str(draw()); if (msg) toast(msg); };
      const modal = (inner) => { const d = dialog(html`<div class="stack pc-dlg">${inner}<div class="alert error pc-err" hidden></div><div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn secondary" data-close>Đóng</button><button type="button" class="btn" data-ok>Lưu</button></div></div>`); d.style.maxWidth = '640px'; $('[data-close]', d).onclick = () => d.close(); return d; };
      const run = async (d, b, fn) => { b.disabled = true; $('.pc-err', d).hidden = true; try { await fn(); d.close(); } catch (e) { $('.pc-err', d).textContent = e.message; $('.pc-err', d).hidden = false; } finally { b.disabled = false; } };
      body.addEventListener('change', (e) => {
        if (e.target.id !== 'pb-kt') return;
        const v = +e.target.value || null;
        const d = modal(html`<h2>Người làm Kế toán: ${v ? shortName(D.people.find((p) => p.id === v)?.name) : 'chưa chọn'}</h2><div>Người này được cấp quyền Kế toán; người cũ bị gỡ quyền.</div><label class="pc-ck"><input type="checkbox" id="pb-ap" checked> Chuyển luôn các việc kế toán đang mở sang người này</label>`);
        d.addEventListener('close', () => { if (+e.target.value !== (D.kt || 0)) e.target.value = D.kt || ''; });
        $('[data-ok]', d).onclick = (ev) => run(d, ev.target, async () => { const n = await rpc('app_pc_kt_set', { p_account: v, p_apply: $('#pb-ap', d).checked }); D.kt = v; await reload(`Đã đổi người làm Kế toán${n ? ' · chuyển ' + n + ' việc đang mở' : ''}`); });
      });
      body.addEventListener('click', (e) => {
        if (e.target.closest('#pv-add')) { openJobDialog({ D, job: null, done: reload }); return; }
        const c = e.target.closest('[data-cell]'), jn = e.target.closest('[data-job]');
        const cj = jn && D.jobs.find((x) => x.job === +jn.dataset.job && x.custom);
        if (cj) { openJobDialog({ D, job: cj, done: reload }); return; }
        if (jn && !c && WEB.includes(+jn.dataset.job)) { const wj = D.jobs.find((x) => x.job === +jn.dataset.job); openJobDialog({ D, job: wj, mode: 'web', info: { name: JOBS[wj.job], from: FROM[wj.job], how: HOW[wj.job] }, done: reload }); return; }
        if (c) {
          const j = +c.dataset.cell, b = +c.dataset.b, job = D.jobs.find((x) => x.job === j), bc = D.branches.find((x) => x.id === b).code;
          const cur = (D.assign.find((x) => x.job === (job.same_as_1 ? 1 : j) && x.branch_id === b)?.accounts) || [];
          const d = modal(html`<h2>${JOBS[j]} · ${bc}</h2>
            ${j === 1 ? html`<div class="pc-info">Cột này cũng áp dụng cho các việc ghi "= như Đối soát ca" (Lệch tiền, Giải trình, Kiểm quỹ, Hàng hoá, phân loại bàn giao) — trừ việc đã sửa riêng.</div>` : job.same_as_1 ? html`<div class="pc-info">Đang "= như Đối soát ca". Lưu ở đây sẽ tách việc này ra để chọn người riêng.</div>` : html`<div class="pc-info">Việc này đang chọn người riêng. <button type="button" class="btn sm secondary" id="pb-relink">Dùng lại như Đối soát ca</button></div>`}
            <div class="pc-grid2">${D.people.filter((p) => p.role !== 'nv' || cur.includes(p.id) || p.kt).map((p) => html`<label class="pc-ck"><input type="checkbox" value="${p.id}" ${cur.includes(p.id) ? 'checked' : ''}> ${shortName(p.name)} <span class="pc-sub">${ROLE[p.role] || ''}</span></label>`)}</div>
            <details><summary class="pc-sub" style="cursor:pointer">Chọn nhân viên khác…</summary><select class="input" id="pb-more"><option value="">— thêm nhân viên —</option>${D.people.filter((p) => p.role === 'nv' && !cur.includes(p.id) && !p.kt).map((p) => html`<option value="${p.id}">${shortName(p.name)}</option>`)}</select></details>
            <label class="pc-ck"><input type="checkbox" id="pb-ap" checked> Chuyển luôn các việc đang mở của ô này sang người mới</label>`);
          $('#pb-relink', d)?.addEventListener('click', async () => { await rpc('app_pc_unlink', { p_job: j, p_link: true }); d.close(); reload('Đã dùng lại như Đối soát ca'); });
          $('[data-ok]', d).onclick = (ev) => run(d, ev.target, async () => {
            const ids = $$('.pc-grid2 input:checked', d).map((i) => +i.value); const more = +$('#pb-more', d).value; if (more) ids.push(more);
            const n = await rpc('app_pc_assign_save', { p_job: j, p_branch: b, p_accounts: ids, p_apply: $('#pb-ap', d).checked });
            await reload(`Đã lưu ${JOBS[j]} · ${bc}${n ? ' · chuyển ' + n + ' việc đang mở' : ''}`);
          });
        } else if (jn) {
          const j = +jn.dataset.job, job = D.jobs.find((x) => x.job === j);
          if (j === 24) {
            const d = modal(html`<h2>Sửa việc: Giao việc riêng</h2><label class="pc-ck"><input type="checkbox" id="pj-on" ${job.enabled ? 'checked' : ''}> Bật — mỗi nội dung bàn giao ca tự thành 1 việc</label>
              <div class="pc-sub"><b>Các bước cố định:</b> 1. Phân loại / giao (người đối soát ca của cơ sở) → 2. Nhận & làm (người được giao; ghi tiến độ, xin gia hạn; báo xong bắt buộc ảnh) → 3. Kiểm tra (người kiểm tra do người giao chọn): Đạt / Làm lại.</div>
              <div class="pc-grid2"><label class="pc-fld"><span>Hạn phân loại (ngày)</span><input class="input" id="pj-d0" type="number" step="0.5" min="0.5" value="${job.steps[0].d}"></label><label class="pc-fld"><span>Hạn kiểm tra (ngày)</span><input class="input" id="pj-d2" type="number" step="0.5" min="0.5" value="${job.steps[2].d}"></label></div>
              <label class="pc-fld"><span>Mức phạt mỗi lần quá hạn (đồng)</span><input class="input" id="pj-fine" type="number" step="1000" min="0" value="${job.fine}"></label>`);
            $('[data-ok]', d).onclick = (ev) => run(d, ev.target, async () => { await rpc('app_pc_job_save', { p_job: 24, p: { enabled: $('#pj-on', d).checked, fine: +$('#pj-fine', d).value, d0: +$('#pj-d0', d).value, d2: +$('#pj-d2', d).value } }); await reload('Đã lưu Giao việc riêng'); });
            return;
          }
          const auto = j === 2 ? 2 : 1, isKt = GROUP[j] === 'kt';
          const whoOpts = (w) => html`${[...(j === 2 ? [] : isKt ? ['kt'] : ['branch', 'branch+ql_tong']), ...(isKt ? [] : ['kt']), ...D.people.filter((p) => p.role !== 'nv' || p.kt).map((p) => 'acc:' + p.id)]
            .map((x) => html`<option value="${x}" ${x === w ? 'selected' : ''}>${x === 'branch' ? 'Theo cơ sở (bảng)' : x === 'branch+ql_tong' ? 'Theo cơ sở + QL tổng' : x === 'kt' ? 'Kế toán' : shortName(D.people.find((p) => 'acc:' + p.id === x)?.name)}</option>`)}`;
          const row = (s, i) => html`<div class="pb-step" data-row><b>${i + 1}</b><input class="input" data-n value="${s.n}" placeholder="Tên bước"><select class="input w" data-w>${whoOpts(s.who)}</select><input class="input" data-d type="number" min="0" step="0.5" value="${s.d ?? ''}" placeholder="không hạn">${i >= auto ? html`<button type="button" class="pb-x" data-x title="Xoá bước">✕</button>` : html`<span></span>`}</div>`;
          const d = modal(html`<h2>Sửa việc: ${JOBS[j]}</h2><label class="pc-ck"><input type="checkbox" id="pj-on" ${job.enabled ? 'checked' : ''}> Bật — web tự tạo việc này</label>
            <div class="pc-sub"><b>Tính hạn:</b> ${FROM[j]} · <b>Cách tạo việc:</b> ${HOW[j]}${MERGED.includes(j) ? ' · hạn tính cho từng mục' : ''}</div>
            <div><div class="pc-sub" style="margin-bottom:6px"><b>Các bước</b> — ${auto > 1 ? `${auto} bước đầu tự xong theo hồ sơ` : 'bước 1 tự xong khi làm xong hồ sơ'}; bước thêm sau đó người làm bấm "Xong bước". Bỏ trống hạn = không đặt hạn.</div>
              <div id="pj-rows" style="display:flex;flex-direction:column;gap:6px">${job.steps.map(row)}</div>
              ${MERGED.includes(j) ? '' : html`<button type="button" class="btn sm secondary" id="pj-add" style="margin-top:8px">+ Thêm bước (vd thêm cấp kiểm tra)</button>`}</div>
            <label class="pc-fld"><span>Mức phạt mỗi lần quá hạn (đồng, 0 = không phạt)</span><input class="input" id="pj-fine" type="number" step="1000" min="0" value="${job.fine}"></label>
            <div class="pc-sub">Đổi bước / hạn chỉ áp dụng cho việc tạo mới; việc đang mở giữ như cũ.</div>`);
          const wire = () => $$('[data-x]', d).forEach((x) => { x.onclick = () => { x.closest('[data-row]').remove(); $$('[data-row] > b', d).forEach((n, i) => { n.textContent = i + 1; }); }; });
          wire();
          $('#pj-add', d)?.addEventListener('click', () => { $('#pj-rows', d).insertAdjacentHTML('beforeend', str(row({ n: 'Kiểm tra', who: 'acc:' + (D.people.find((p) => p.role === 'ql_tong')?.id || ''), d: 1 }, $$('[data-row]', d).length))); wire(); });
          $('[data-ok]', d).onclick = (ev) => run(d, ev.target, async () => {
            const steps = $$('[data-row]', d).map((r) => ({ n: $('[data-n]', r).value.trim(), who: $('[data-w]', r).value, d: $('[data-d]', r).value === '' ? null : +$('[data-d]', r).value }));
            await rpc('app_pc_job_save', { p_job: j, p: { enabled: $('#pj-on', d).checked, fine: +$('#pj-fine', d).value, steps } });
            await reload(`Đã lưu "${JOBS[j]}"`);
          });
        }
      });
    },
  };
}
