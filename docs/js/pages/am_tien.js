// Quản lý ca › Âm tiền (bước 71, anh Tiến chốt 13/11): mọi ca THIẾU / DƯ tiền mặt, chuyển khoản của 1 cơ sở trong tháng.
//  * Trái: ca thiếu — Chờ tiền về (CK) / Chờ gán (TM) / Đã xử lý; gợi ý ghép với ca dư cùng loại tiền trong 3 ngày (ghép từng phần, lý do bắt buộc);
//    không có tiền về: Trừ lương (chia đều người làm ca, sửa được) hoặc Quán chịu (chỉ Chủ / QL tổng).
//  * Phải: ca dư — dùng để ghép, hoặc Thu khác.
//  * QL cơ sở ghép → chờ Chủ / QL tổng duyệt. Ghép sau khi đã trừ lương → web tự huỷ / giảm trừ lương, báo nhân viên.
//  * Lệch ≤ 5.000 coi như khớp. Còn ca chờ → chưa chốt được tháng.
import { render as rerender } from '../app.js';
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, fmt, noKind, parseMoney, vnd } from '../tien.js';
import { $, $$, dialog, flash, html, showSaved, str } from '../ui.js';

export const perm = 'doi_soat';
const LS_BR = 'tcBranch';
const ITEM = { tien_mat: ['TM', 'tiền mặt'], chuyen_khoan: ['CK', 'chuyển khoản'] };
const STATE = { cho_tien: ['Chờ tiền về', 'wait'], cho_no: ['Chờ khách trả nợ', 'wait'], cho_gan: ['Chờ gán', 'todo'], du: ['Chưa xử lý', 'todo'], xong: ['✓ Đã xử lý', 'ok'] };
const FGROUP = (st) => (st === 'cho_no' ? 'cho_tien' : st);   // bước 74: Chờ khách trả nợ nằm chung ô Chờ tiền về
let FILTER = '';
const monthLabel = (m) => `Tháng ${Number(m.slice(5, 7))}/${m.slice(0, 4)}`;
const shiftMonth = (m, k) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1 + k, 1)).toISOString().slice(0, 7); };
const lsGet = () => { try { return Number(localStorage.getItem(LS_BR)) || null; } catch (_) { return null; } };
const lsSet = (v) => { try { localStorage.setItem(LS_BR, String(v)); } catch (_) { /* bỏ qua */ } };
const dayDiff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);

export async function render(ctx) {
  const { params } = ctx;
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : vnToday().slice(0, 7);
  let cn = Number(params.cn) || lsGet();
  let D = cn ? await rpc('app_gap_list', { p_branch: cn, p_month: month }).catch(() => null) : null;
  if (!D) {
    const L = await rpc('app_tc_list', { p_branch: null, p_from: vnToday(), p_to: vnToday() }).catch(() => ({ branches: [] }));
    for (const b of L.branches) { D = await rpc('app_gap_list', { p_branch: b.id, p_month: month }).catch(() => null); if (D) { cn = b.id; break; } }
    if (!D) return { title: 'Lệch tiền ca', html: html`<div class="page-head"><h1>Lệch tiền ca</h1></div><div class="alert warn">Chỉ Chủ, Quản lý tổng, Quản lý cơ sở dùng tab Lệch tiền ca.</div>` };
  }
  lsSet(cn);
  const admin = D.role === 'admin';
  const BR = D.branches.find((b) => b.id === cn) || { code: '' };
  const q = (o) => '#/quan-ly/lech-tien?' + Object.entries({ thang: month, cn, ...o }).map(([k, v]) => `${k}=${v}`).join('&');
  const rows = D.rows.map((r, i) => ({ ...r, i, key: `${r.report_id}-${r.item}` }));
  const inM = rows.filter((r) => r.in_month);
  const shorts = inM.filter((r) => r.kind === 'thieu'); const overs = inM.filter((r) => r.kind === 'du');
  const sum = (a, f) => a.reduce((s, r) => s + Number(f(r)), 0);
  const K = {
    cho_tien: shorts.filter((r) => r.state === 'cho_tien' || r.state === 'cho_no'), cho_gan: shorts.filter((r) => r.state === 'cho_gan'),
    du: overs.filter((r) => r.state === 'du'), xong: inM.filter((r) => r.state === 'xong'),
  };
  const free = (r) => Math.max(0, Number(r.remain) - Number(r.mp));
  // ghép được phần đã trừ lương (ghép xong web huỷ / giảm trừ lương)
  const shortFree = (r) => Math.max(0, Number(r.total) - Number(r.dcs) - Number(r.mt) - Number(r.mp));
  const sugOf = (r) => rows.filter((o) => o.kind === 'du' && o.item === r.item && Math.abs(dayDiff(o.date, r.date)) <= 3 && free(o) > 0)
    .sort((a, b) => Math.abs(dayDiff(a.date, r.date)) - Math.abs(dayDiff(b.date, r.date)) || (dayDiff(b.date, r.date) - dayDiff(a.date, r.date)));
  const head = (r) => html`<div class="at-h"><b>${dmy(r.date).slice(0, 5)} · Ca ${r.shift} <span class="at-pm ${ITEM[r.item][0].toLowerCase()}">${ITEM[r.item][0]}</span></b>
      <span class="at-a ${r.kind === 'thieu' ? 'neg' : 'pos'}">${r.kind === 'thieu' ? '−' : '+'}${fmt(r.state === 'xong' ? r.total : r.remain)}</span>
      <span class="st-meta at-meta"><span class="pill ${STATE[r.state][1]}">${STATE[r.state][0]}</span>${r.state !== 'xong' && Number(r.remain) !== Number(r.total) ? ` · gốc ${fmt(r.total)}` : ''}${!r.in_month ? ' · ngoài tháng' : ''}
        ${r.staff.length ? ` · ${r.staff.map((s) => s.name.split(' – ').pop()).join(', ')}` : ''} · <a href="#/quan-ly/doi-soat/ca?id=${r.report_id}">Đối soát ca ›</a>
        ${r.result?.reason ? ` · ${r.result.reason}` : ''}</span></div>`;
  const matchLine = (r, m) => html`<div class="at-log" data-m="${m.id}">${m.status === 'cho_duyet' ? html`⏳ <b>Chờ Chủ / QL tổng duyệt</b>: ` : '✓ '}Ghép ${fmt(m.amount)} với ca ${m.other_shift} ${dmy(m.other_date).slice(0, 5)} · ${m.reason} · ${m.by || ''}${m.approved_by && m.status === 'da_duyet' ? ` (duyệt: ${m.approved_by})` : ''}
      ${r.locked ? '' : html`<span class="at-btns">${m.status === 'cho_duyet' && admin ? html`<button type="button" class="btn sm at-ap" data-ok="1">Duyệt</button><button type="button" class="btn sm secondary at-ap" data-ok="">Từ chối</button>`
        : admin || (m.status === 'cho_duyet' && m.mine) ? html`<button type="button" class="btn sm secondary at-unm">Bỏ ghép</button>` : ''}</span>`}</div>`;
  const decLine = (r, d) => html`<div class="at-log" data-d="${d.id}">${d.kind === 'quan_chiu' ? '🏠 Quán chịu' : '＋ Thu khác'} ${fmt(d.amount)}${d.reason ? ` · ${d.reason}` : ''} · ${d.by || ''}
      ${r.locked || (d.kind === 'quan_chiu' && !admin) ? '' : html`<span class="at-btns"><button type="button" class="btn sm secondary at-und">Bỏ</button></span>`}</div>`;
  const shortCard = (r) => {
    const sug = r.locked ? [] : sugOf(r); const can = !r.locked && shortFree(r) > 0;
    return html`<article class="at-card st-${r.state}" data-i="${r.i}" data-st="${FGROUP(r.state)}">${head(r)}
      ${(r.debts || []).length ? html`<div class="at-logs">${r.debts.map((d) => html`<div class="at-log">${d.closed ? '✓' : '📌'} ${noKind(d.kind)} <b>${d.name}</b> ${fmt(d.amount)}${d.phone ? ` · ${d.phone}` : ''} · ${d.closed ? `đã trả ${d.collect_kind === 'chuyen_khoan' ? 'CK' : 'TM'} ở ca ${d.closed_shift || ''} ${d.closed_date ? dmy(d.closed_date).slice(0, 5) : ''} — đã bù` : 'chờ khách trả (ghi nhận ở đối soát)'}</div>`)}</div>` : ''}
      ${r.people.length ? html`<div class="at-ppl">${r.people.map((p) => html`<div><span>${p.name} chịu</span><b>${fmt(p.amount)} · ${p.status === 'tru_luong' ? 'trừ lương' : p.status === 'da_bu' ? 'đã bù' : p.status === 'mien' ? 'miễn' : p.status}</b></div>`)}</div>` : ''}
      ${r.matches.length || r.decisions.length ? html`<div class="at-logs">${r.matches.map((m) => matchLine(r, m))}${r.decisions.map((d) => decLine(r, d))}</div>` : ''}
      ${can && sug.length ? html`<div class="at-sug"><span class="at-t">Gợi ý ghép${r.tl > 0 ? ' — ghép được sẽ huỷ / giảm trừ lương' : ''}</span>${sug.slice(0, 3).map((o) => { const v = Math.min(free(o), shortFree(r));
          return html`<div class="at-si"><span>Ca ${o.shift} ${dmy(o.date).slice(0, 5)} dư ${ITEM[o.item][0]} <b class="pos">+${fmt(free(o))}</b></span><button type="button" class="btn sm at-mg" data-o="${o.i}" data-v="${v}">Ghép ${fmt(v)}…</button></div>`; })}</div>`
        : can && r.state !== 'xong' ? html`<div class="st-meta">Chưa có ca dư ${ITEM[r.item][1]} cùng cơ sở trong 3 ngày để ghép.</div>` : ''}
      ${can && r.state !== 'xong' ? html`<div class="at-btns"><button type="button" class="btn sm at-tl">Trừ lương…</button>${admin ? html`<button type="button" class="btn sm secondary at-qc">Quán chịu…</button>` : ''}<button type="button" class="btn sm secondary at-mgx">Ghép ca khác…</button></div>` : ''}
    </article>`;
  };
  const overCard = (r) => html`<article class="at-card st-${r.state}" data-i="${r.i}" data-st="${r.state}">${head(r)}
      ${r.matches.length || r.decisions.length ? html`<div class="at-logs">${r.matches.map((m) => matchLine(r, m))}${r.decisions.map((d) => decLine(r, d))}</div>` : ''}
      ${!r.locked && free(r) > 0 ? html`<div class="at-btns"><button type="button" class="btn sm secondary at-tk">Thu khác…</button></div>` : ''}</article>`;
  const kpi = (k, cls, label, a, sub) => html`<button type="button" class="at-kpi ${cls}" data-f="${k}" aria-pressed="${FILTER === k}"><span class="k">${label}</span><span class="v">${fmt(sum(a, (r) => (k === 'xong' ? r.total : r.remain)))}</span><span class="s">${sub}</span></button>`;
  const nWait = K.cho_tien.length + K.cho_gan.length;
  const pendM = inM.reduce((s, r) => s + r.matches.filter((m) => m.status === 'cho_duyet' && r.kind === 'thieu').length, 0);

  return {
    title: `Lệch tiền ca ${BR.code}`,
    html: html`${STYLE}
      <div class="page-head"><div><h1>Lệch tiền ca · ${BR.code}</h1>
        <div class="sub">Ca thiếu / dư tiền mặt, chuyển khoản (lệch ≤ 5.000 coi như khớp). Ghép ca thiếu với ca dư khi tiền về chậm; không có tiền về thì trừ lương hoặc quán chịu.</div></div>
        <div class="toolbar"><div id="saved-indicator" class="saved" role="status" hidden></div><a class="btn secondary" href="#/quan-ly/thu-chi?thang=${month}&cn=${cn}">‹ Thu chi</a></div></div>
      <section class="card at-bar">
        <div class="at-month"><a class="btn sm secondary" href="${q({ thang: shiftMonth(month, -1) })}" aria-label="Tháng trước">‹</a><strong>${monthLabel(month)}</strong><a class="btn sm secondary" href="${q({ thang: shiftMonth(month, 1) })}" aria-label="Tháng sau">›</a></div>
        <nav class="branch-tabs" aria-label="Cơ sở">${D.branches.map((b) => html`<a class="${cn === b.id ? 'on' : ''}" href="${q({ cn: b.id })}" title="${b.name}">${b.code}</a>`)}</nav></section>
      ${nWait || pendM ? html`<div class="alert warn">Còn <b>${nWait} ca</b> đang chờ${pendM ? ` và <b>${pendM} khoản ghép</b> chờ duyệt` : ''}. Tháng này chưa chốt được cho tới khi xử lý xong.</div>` : inM.length ? html`<div class="alert ok">Không còn ca nào chờ xử lý trong tháng.</div>` : ''}
      <div class="at-kpis">
        ${kpi('cho_tien', 'wait', 'Chờ tiền về', K.cho_tien, `${K.cho_tien.length} ca${K.cho_tien.some((r) => r.state === 'cho_no') ? ' · có chờ khách trả nợ' : ' thiếu CK'}`)}
        ${kpi('cho_gan', 'todo', 'Chờ gán', K.cho_gan, `${K.cho_gan.length} ca thiếu TM`)}
        ${kpi('du', 'du', 'Ca dư', K.du, `${K.du.length} ca chưa xử lý`)}
        ${kpi('xong', '', 'Đã xử lý', K.xong, `${K.xong.length} khoản`)}
      </div>
      <div class="at-cols">
        <section class="at-col" id="at-short"><h2>Ca thiếu <small>${shorts.length} khoản · mới nhất trên cùng</small></h2>
          ${shorts.length ? shorts.map(shortCard) : html`<div class="st-meta at-empty">Tháng này không có ca thiếu tiền (lệch quá 5.000).</div>`}</section>
        <section class="at-col" id="at-over"><h2>Ca dư <small>dùng để ghép</small></h2>
          ${overs.length ? overs.map(overCard) : html`<div class="st-meta at-empty">Không có ca dư.</div>`}
          <div class="st-meta">Dư tiền mặt: bù ca thiếu tiền mặt hoặc Thu khác. Dư chuyển khoản không ghép được thì bấm Thu khác.</div></section>
      </div>`,
    async mount() {
      const again = async (m) => { const y = window.scrollY; if (m) flash(m); await rerender(); window.scrollTo(0, y); };
      const err = (d, e) => { d.querySelector('.at-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); };
      const apply = () => {
        $$('.at-card').forEach((c) => { const st = c.dataset.st; c.hidden = !!FILTER && st !== FILTER; });
        $$('.at-kpi').forEach((b) => b.setAttribute('aria-pressed', String(FILTER === b.dataset.f)));
      };
      $$('.at-kpi').forEach((b) => b.addEventListener('click', () => { FILTER = FILTER === b.dataset.f ? '' : b.dataset.f; apply(); }));
      apply();
      const rowOf = (el) => rows[Number(el.closest('[data-i]').dataset.i)];
      // ghép
      const matchForm = (s, o, v) => {
        const opts = o ? [o] : rows.filter((x) => x.kind === 'du' && x.item === s.item && free(x) > 0);
        if (!opts.length) { showSaved(`Không có ca dư ${ITEM[s.item][1]} nào để ghép.`, true); return; }
        const d = dialog(html`<form class="stack at-dlg" style="gap:12px"><h2 style="margin:0">Ghép ca thiếu với ca dư</h2>
          <div class="st-meta">Ca ${s.shift} ${dmy(s.date)} thiếu ${ITEM[s.item][1]} <b>${fmt(shortFree(s))}</b>${s.tl > 0 ? ` (đã trừ lương ${fmt(s.tl)} — ghép xong web tự huỷ / giảm trừ lương, báo nhân viên)` : ''}</div>
          <label class="field"><span>Ca dư</span><select class="input" name="o">${opts.map((x) => html`<option value="${x.i}" ${o && x.i === o.i ? 'selected' : ''}>Ca ${x.shift} ${dmy(x.date)} · dư ${fmt(free(x))}</option>`)}</select></label>
          <label class="field"><span>Số tiền ghép (ghép từng phần được)</span><input class="input money" name="amt" inputmode="numeric" autocomplete="off" value="${fmt(v || Math.min(free(opts[0]), shortFree(s)))}"></label>
          <label class="field"><span>Lý do (bắt buộc)</span><input class="input" name="why" autocomplete="off" value="${s.item === 'chuyen_khoan' ? `Khách CK ca ${s.shift} ${dmy(s.date).slice(0, 5)} về chậm` : 'Bù tiền mặt giữa 2 ca'}"></label>
          <div class="st-meta">${admin ? 'Bạn là Chủ / Quản lý tổng: ghép có hiệu lực ngay, báo nhân viên ca thiếu.' : 'Quản lý cơ sở ghép: chờ Chủ / Quản lý tổng duyệt rồi mới có hiệu lực.'}</div>
          <div class="at-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Ghép</button></div></form>`);
        bindMoneyInputs(d); const f = d.querySelector('form');
        f.o.addEventListener('change', () => { f.amt.value = fmt(Math.min(free(rows[Number(f.o.value)]), shortFree(s))); });
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault(); const ov = rows[Number(f.o.value)];
          try { await rpc('app_gap_match', { p_short: s.report_id, p_over: ov.report_id, p_item: s.item, p_amount: parseMoney(f.amt.value), p_reason: f.why.value });
            d.close(); await again(admin ? 'Đã ghép — đã báo nhân viên ca thiếu.' : 'Đã ghép — chờ Chủ / Quản lý tổng duyệt.'); }
          catch (e) { err(d, e); }
        });
      };
      $$('.at-mg').forEach((b) => b.addEventListener('click', () => matchForm(rowOf(b), rows[Number(b.dataset.o)], Number(b.dataset.v))));
      $$('.at-mgx').forEach((b) => b.addEventListener('click', () => matchForm(rowOf(b), null, 0)));
      $$('.at-ap').forEach((b) => b.addEventListener('click', async () => {
        b.disabled = true;
        try { await rpc('app_gap_match_approve', { p_id: Number(b.closest('[data-m]').dataset.m), p_ok: !!b.dataset.ok }); await again(b.dataset.ok ? 'Đã duyệt ghép.' : 'Đã từ chối ghép.'); }
        catch (e) { showSaved(e.message, true); b.disabled = false; }
      }));
      $$('.at-unm').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Bỏ khoản ghép này? (Khoản trừ lương đã huỷ không tự khôi phục — nếu cần thì gán trừ lương lại.)')) return;
        try { await rpc('app_gap_match_delete', { p_id: Number(b.closest('[data-m]').dataset.m) }); await again('Đã bỏ ghép.'); } catch (e) { showSaved(e.message, true); }
      }));
      $$('.at-und').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Bỏ khoản này? Khoản chi / thu tương ứng ở Thu chi cũng bị xoá.')) return;
        try { await rpc('app_gap_decision_delete', { p_id: Number(b.closest('[data-d]').dataset.d) }); await again('Đã bỏ.'); } catch (e) { showSaved(e.message, true); }
      }));
      // trừ lương — mặc định chia đều người làm ca
      $$('.at-tl').forEach((b) => b.addEventListener('click', () => {
        const r = rowOf(b); const tot = free(r);
        const d = dialog(html`<form class="stack at-dlg" style="gap:12px"><h2 style="margin:0">Trừ lương · ca ${r.shift} ${dmy(r.date).slice(0, 5)}</h2>
          <div class="st-meta">Còn thiếu ${ITEM[r.item][1]} <b>${fmt(tot)}</b>. Mặc định chia đều người làm ca (sửa được). Nhân viên được báo, giải trình được. Nếu sau này ghép được, web tự huỷ / giảm.</div>
          <div class="at-pw">${r.staff.length ? r.staff.map((s) => html`<label class="at-pp" data-e="${s.employee_id}"><input type="checkbox" checked> <span>${s.name}</span><input class="input sm money at-pa" inputmode="numeric" autocomplete="off" aria-label="Số tiền ${s.name}"></label>`)
            : html`<div class="st-meta">Phiếu ca không có danh sách nhân viên.</div>`}</div>
          <div class="st-meta" id="at-psum"></div>
          <label class="field"><span>Lý do</span><input class="input" name="why" autocomplete="off" value="${r.result?.reason || `Thiếu ${ITEM[r.item][1]} ca ${r.shift} ${dmy(r.date).slice(0, 5)}, không có tiền về`}"></label>
          <div class="at-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Trừ lương</button></div></form>`);
        bindMoneyInputs(d);
        const on = () => $$('.at-pp', d).filter((x) => x.querySelector('input[type=checkbox]').checked);
        const show = () => { const s = on().reduce((t, x) => t + parseMoney(x.querySelector('.at-pa').value || '0'), 0); d.querySelector('#at-psum').textContent = `Tổng: ${fmt(s)} / còn thiếu ${fmt(tot)}${s === tot ? ' ✓' : ''}`; };
        const split = () => { const L = on(); $$('.at-pp', d).forEach((x) => { if (!x.querySelector('input[type=checkbox]').checked) x.querySelector('.at-pa').value = ''; });
          if (L.length) { const base = Math.floor(tot / L.length / 1000) * 1000; L.forEach((x, i) => { x.querySelector('.at-pa').value = fmt(i === 0 ? tot - base * (L.length - 1) : base); }); } show(); };
        split();
        d.addEventListener('change', (ev) => { if (ev.target.type === 'checkbox') split(); });
        d.addEventListener('input', (ev) => { if (ev.target.classList.contains('at-pa')) show(); });
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        d.querySelector('form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const people = on().map((x) => ({ employee_id: Number(x.dataset.e), amount: parseMoney(x.querySelector('.at-pa').value || '0') })).filter((x) => x.amount > 0);
          try { await rpc('app_gap_tl', { p_report: r.report_id, p_item: r.item, p_people: people, p_reason: d.querySelector('[name=why]').value }); d.close(); await again(`Đã trừ lương ${people.length} người — nhân viên đã được báo.`); }
          catch (e) { err(d, e); }
        });
      }));
      // quán chịu / thu khác
      const decForm = (r, kind) => {
        const tot = free(r); const qc = kind === 'quan_chiu';
        const d = dialog(html`<form class="stack at-dlg" style="gap:12px"><h2 style="margin:0">${qc ? 'Quán chịu' : 'Thu khác'} · ca ${r.shift} ${dmy(r.date).slice(0, 5)}</h2>
          <div class="st-meta">${qc ? html`Ghi khoản chi nhóm <b>Âm tiền – quán chịu</b> (tính chi phí, không trừ lương). Tiền quỹ không đổi vì tiền đã thiếu sẵn.` : html`Ghi khoản thu nhóm <b>Thu khác</b>. Tiền quỹ không đổi vì tiền dư đã có sẵn.`}</div>
          <label class="field"><span>Số tiền</span><input class="input money" name="amt" inputmode="numeric" autocomplete="off" value="${fmt(tot)}"></label>
          <label class="field"><span>Lý do</span><input class="input" name="why" autocomplete="off" placeholder="${qc ? 'vd: không rõ nguyên nhân, quán chịu' : 'vd: không tìm được ca thiếu để ghép'}"></label>
          <div class="at-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">${qc ? 'Quán chịu' : 'Ghi Thu khác'}</button></div></form>`);
        bindMoneyInputs(d); const f = d.querySelector('form');
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          try { await rpc('app_gap_decide', { p_report: r.report_id, p_item: r.item, p_kind: kind, p_amount: parseMoney(f.amt.value), p_reason: f.why.value }); d.close(); await again(qc ? 'Đã ghi Quán chịu.' : 'Đã ghi Thu khác.'); }
          catch (e) { err(d, e); }
        });
      };
      $$('.at-qc').forEach((b) => b.addEventListener('click', () => decForm(rowOf(b), 'quan_chiu')));
      $$('.at-tk').forEach((b) => b.addEventListener('click', () => decForm(rowOf(b), 'thu_khac')));
    },
  };
}

const STYLE = html`<style>
  .at-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; margin-bottom: 12px; }
  .at-month { display: flex; align-items: center; gap: 10px; } .at-month strong { font-size: 17px; min-width: 120px; text-align: center; }
  .at-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 12px 0; }
  .at-kpi { font: inherit; color: inherit; text-align: left; background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; cursor: pointer; }
  .at-kpi[aria-pressed="true"] { outline: 3px solid var(--caramel-line); }
  .at-kpi .k { font-size: 12px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .at-kpi .v { font-size: 19px; font-weight: 800; font-variant-numeric: tabular-nums; } .at-kpi .s { font-size: 12px; color: var(--muted); }
  .at-kpi.wait { background: var(--info-bg); border-color: #c4d3e2; } .at-kpi.wait .v { color: var(--info-ink); }
  .at-kpi.todo { background: var(--warn-bg); border-color: #f6d58a; } .at-kpi.todo .v { color: var(--warn-ink); }
  .at-kpi.du .v { color: var(--ok-ink); }
  .at-cols { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 12px; align-items: start; }
  .at-col { display: flex; flex-direction: column; gap: 10px; min-width: 0; } .at-col h2 { margin: 0; font-size: 17px; } .at-col h2 small { font-weight: 500; color: var(--muted); font-size: 13px; margin-left: 4px; }
  .at-empty { padding: 10px; background: var(--card); border-radius: 12px; }
  .at-card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .at-card[hidden] { display: none; }
  .at-card.st-cho_tien { border-left: 5px solid var(--info-line); } .at-card.st-cho_gan, .at-card.st-du { border-left: 5px solid var(--warn-line); } .at-card.st-xong { border-left: 5px solid var(--ok-ink); }
  .at-h { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 8px; } .at-meta { grid-column: 1 / -1; overflow-wrap: anywhere; }
  .at-pm { font-size: 11px; font-weight: 800; border-radius: 6px; padding: 0 6px; } .at-pm.tm { background: var(--ok-bg); color: var(--ok-ink); } .at-pm.ck { background: var(--info-bg); color: var(--info-ink); }
  .at-a { font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; } .at-a.neg { color: #b91c1c; } .at-a.pos, .pos { color: var(--ok-ink); }
  .pill.wait { background: var(--info-bg); color: var(--info-ink); }
  .at-ppl { display: flex; flex-direction: column; gap: 3px; font-size: 14px; } .at-ppl div { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .at-logs { display: flex; flex-direction: column; gap: 6px; } .at-log { font-size: 13px; background: var(--subtle); border-radius: 8px; padding: 6px 8px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: space-between; overflow-wrap: anywhere; }
  .at-sug { background: var(--subtle); border: 1px dashed var(--line-strong); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
  .at-t { font-size: 12px; font-weight: 800; color: var(--ink-2); text-transform: uppercase; letter-spacing: .04em; }
  .at-si { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; align-items: center; }
  .at-btns { display: flex; gap: 6px; flex-wrap: wrap; } .at-btns .btn, .at-si .btn { width: auto; }
  .at-pw { display: flex; flex-direction: column; gap: 6px; } .at-pp { display: flex; gap: 8px; align-items: center; } .at-pp span { flex: 1 1 auto; min-width: 0; } .at-pp .at-pa { width: 120px; flex: 0 0 auto; }
  .at-dlg { width: min(480px, calc(100vw - 56px)); }
  @media (max-width: 900px) { .at-cols { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 560px) { .at-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>`;
