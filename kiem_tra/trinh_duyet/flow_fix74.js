// Bước 74: (1) giờ gợi ý theo lịch tuần từng người; (2) Ghi nhận nợ ở Đối soát ca → Công nợ; (3) gõ ô Số dư đầu không bị nhảy; (4) khung Công nợ 2 tầng. role=chu (điện thoại)
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const typ = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = []; window.confirm = () => true;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc, sb } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day }); const lhp = ov.find((x) => x.branch_code === 'LHP');
    // (1) giờ gợi ý theo lịch của từng người
    const cand = ov.filter((x) => x.branch_code === 'LHP'); const pick = cand.find((x) => !x.report_id && !x.status) || cand[cand.length - 1];
    const id = await rpc('app_ca_open', { p_branch: lhp.branch_id, p_date: day, p_shift: pick.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: id }); const st = (R.staff || []).filter((s) => s.source === 'lich');
    if (st.length) await sb.from('sched_fx').insert([{ employee_id: st[0].employee_id, shift: 'FULL TIME', start: '07:15', end: '11:45' }]);
    try { sessionStorage.setItem('cm:' + id, JSON.stringify({ step: 1 })); } catch (_) { /* bỏ qua */ }
    location.hash = '#/__tam'; await sleep(800); location.hash = '#/ca/phieu?id=' + id; await wait('[data-t]', 300); await sleep(600);
    if (!$('[data-t]')) { location.hash = '#/__tam'; await sleep(800); location.hash = '#/ca/phieu?id=' + id; await wait('[data-t]', 300); await sleep(600); }
    if (!$('[data-t]')) r.push(`(1) chưa thấy ô giờ: ${location.hash} · ${txt('#root').slice(0, 200)}`);
    r.push(`(1) bước ${txt('.cm-card h2')}: ${$$('.cm-person').slice(0, 3).map((p) => `${(p.querySelector('strong')?.innerText || '').trim()} ${[...p.querySelectorAll('input[type=time]')].map((i) => i.value).join('–')}`).join(' | ')}`);
    // (3) gõ ô Số dư đầu từng số — ô không bị vẽ lại / mất số
    try { sessionStorage.setItem('cm:' + id, JSON.stringify({ code: 2, viecDone: true })); } catch (_) { /* bỏ qua */ }
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id; await wait('[data-f="ipos_opening"]', 300); await sleep(600);
    const el = $('[data-f="ipos_opening"]'); el.focus();
    for (const v of ['1', '12', '123', '1.234', '12.345']) { typ(el, v); await sleep(120); }
    r.push(`(3) gõ Số dư đầu: ô còn nguyên ${el.isConnected} · đang chọn ô ${document.activeElement === el} · giá trị ${el.value} · ô lý do hiện ${!$('#cm-open-wrap')?.hidden}`);
    // (2) Ghi nhận nợ ở Đối soát ca
    await sb.from('shift_reports').insert({ id: 9981, branch_id: lhp.branch_id, work_date: day, shift: 'Sáng', status: 'hoan_thanh', recon_status: 'chua', total_revenue: 1000000 });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat/ca?id=9981'; await wait('#rd-add', 400); await sleep(800);
    r.push(`(2) trang đối soát có nút: ${!!$('#rd-add')}`);
    $('#rd-add').click(); await wait('dialog[open] form'); await sleep(200); let dl = $('dialog[open]');
    r.push(`hộp: ${txt('h2', dl)} · lựa chọn: ${$$('[name=it]', dl).map((x) => x.closest('label').innerText.trim()).join(' / ')}`);
    dl.querySelector('[name=nm]').value = 'Bàn 5'; typ(dl.querySelector('[name=amt]'), '28.000'); dl.querySelector('[type=submit]').click();
    for (let i = 0; i < 50 && $('dialog[open]'); i++) await sleep(100); await sleep(1500); await wait('#rd-add', 300); await sleep(500);
    r.push(`sau ghi nhận: ${$$('.rd-del').length} khoản · ${txt('#rd-add')}`);
    // (4) Công nợ ở Thu chi — 2 tầng, khoản ghi nhận có link đối soát
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/cong-no?cn=' + lhp.branch_id; await wait('.cn-g', 600); await sleep(800);   // bước 95: Công nợ sang tab riêng
    const row = $$('.cn-p').find((x) => x.innerText.includes('Bàn 5'));
    r.push(`(4) Công nợ: ${row ? row.innerText.replace(/\s+/g, ' ') : 'KHÔNG THẤY'}`);
    const g = row?.querySelector('.cn-ph .grow'); r.push(`tên rộng ${g ? Math.round(g.getBoundingClientRect().width) : 0}px / khung ${Math.round(($('.cn-g')?.getBoundingClientRect().width) || 0)}px · ${W()}`);
  } catch (e) { r.push('LỖI ' + e.message); }
  out.push({ route: 'sửa 74', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
