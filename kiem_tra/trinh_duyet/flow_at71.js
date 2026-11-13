// Bước 71: tab Âm tiền — ca thiếu / dư, 4 ô lọc, gợi ý ghép (ghép → huỷ trừ lương), trừ lương chia đều, quán chịu, thu khác. role=chu (điện thoại, confirm=1)
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const closed = async () => { for (let i = 0; i < 50 && $('dialog[open]'); i++) await sleep(100); await sleep(1500); await wait('.at-kpis', 300); await sleep(300); };
  const card = (rid, item) => $$('.at-card').find((c) => c.innerText.includes(rid) && c.querySelector('.at-pm')?.innerText === item);
  const r = []; window.confirm = () => true;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { sb } = await import('../js/sb.js');
    const m = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
    const staff = [{ employee_id: 1, name: 'NV01 – Thử Một' }, { employee_id: 2, name: 'NV02 – Thử Hai' }];
    await sb.from('gap_fx').insert([
      { branch_id: 1, report_id: 801, date: m + '-03', shift: 'Tối', item: 'chuyen_khoan', kind: 'thieu', total: 894000, staff },
      { branch_id: 1, report_id: 802, date: m + '-04', shift: 'Sáng', item: 'chuyen_khoan', kind: 'du', total: 600000, staff },
      { branch_id: 1, report_id: 803, date: m + '-03', shift: 'Chiều', item: 'tien_mat', kind: 'thieu', total: 131000, staff },
      { branch_id: 1, report_id: 804, date: m + '-01', shift: 'Tối', item: 'chuyen_khoan', kind: 'du', total: 207000, staff }]);
    const go = async () => { location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/am-tien?cn=1&thang=' + m; await wait('.at-kpis', 600); await sleep(600); };
    await go();
    r.push(`trang: ${txt('#root h1')} · menu ${$$('.hub-tabs a').map((a) => a.innerText.trim()).join(' · ')} · ${txt('.alert')}`);
    r.push(`ô: ${$$('.at-kpi').map((k) => k.innerText.replace(/\s+/g, ' ')).join(' | ')}`);
    r.push(`thiếu: ${$$('#at-short .at-card .at-h b').map((b) => b.innerText).join(' / ')} · dư: ${$$('#at-over .at-card .at-h b').map((b) => b.innerText).join(' / ')}`);
    const c1 = $$('#at-short .at-card').find((c) => c.innerText.includes('Tối') && c.innerText.includes('CK'));
    r.push(`gợi ý ca CK thiếu: ${txt('.at-sug', c1)}`);
    // ghép 600.000 với ca dư sáng hôm sau
    c1.querySelector('.at-mg').click(); await wait('dialog[open] form'); await sleep(200); let dl = $('dialog[open]');
    r.push(`hộp ghép: ${txt('h2', dl)} · số ${dl.querySelector('[name=amt]').value} · lý do "${dl.querySelector('[name=why]').value}"`);
    dl.querySelector('[type=submit]').click(); await closed();
    const c1b = $$('#at-short .at-card').find((c) => c.innerText.includes('Tối') && c.innerText.includes('CK'));
    r.push(`sau ghép: ${txt('.at-h', c1b)} · ${txt('.at-logs', c1b)}`.slice(0, 300));
    // trừ lương phần còn lại — chia đều
    c1b.querySelector('.at-tl').click(); await wait('dialog[open] form'); await sleep(200); dl = $('dialog[open]');
    r.push(`hộp trừ lương: ${$$('.at-pp', dl).map((x) => x.innerText.trim() + ' ' + x.querySelector('.at-pa').value).join(' | ')} · ${txt('#at-psum', dl)}`);
    dl.querySelector('[type=submit]').click(); await closed();
    const c1c = $$('#at-short .at-card').find((c) => c.innerText.includes('Tối') && c.innerText.includes('CK'));
    r.push(`sau trừ lương: ${txt('.at-h .pill', c1c)} · ${txt('.at-ppl', c1c)}`);
    // quán chịu ca thiếu tiền mặt
    const c2 = $$('#at-short .at-card').find((c) => c.innerText.includes('TM'));
    c2.querySelector('.at-qc').click(); await wait('dialog[open] form'); await sleep(200); dl = $('dialog[open]');
    dl.querySelector('[name=why]').value = 'không rõ'; dl.querySelector('[type=submit]').click(); await closed();
    r.push(`quán chịu TM: ${txt('.at-h .pill', $$('#at-short .at-card').find((c) => c.innerText.includes('TM')))} · ${txt('.at-logs', $$('#at-short .at-card').find((c) => c.innerText.includes('TM')))}`);
    // thu khác ca dư còn lại
    const c3 = $$('#at-over .at-card').find((c) => c.querySelector('.at-tk'));
    c3.querySelector('.at-tk').click(); await wait('dialog[open] form'); await sleep(200); dl = $('dialog[open]'); dl.querySelector('[type=submit]').click(); await closed();
    r.push(`sau thu khác: ${$$('#at-over .at-card').map((c) => txt('.at-h', c)).join(' | ')}`.slice(0, 300));
    r.push(`cuối: ${txt('.alert')} · ô ${$$('.at-kpi .v').map((v) => v.innerText).join('/')}`);
    $$('.at-kpi')[3].click(); await sleep(150); r.push(`lọc Đã xử lý: hiện ${$$('.at-card:not([hidden])').length} thẻ`);
    r.push(W());
  } catch (e) { r.push('LỖI ' + e.message); }
  out.push({ route: 'âm tiền 71', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
