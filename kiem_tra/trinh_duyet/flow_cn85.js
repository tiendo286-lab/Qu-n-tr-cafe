// Bước 85: bỏ mục Người vay — Công nợ ở Thu chi: + Nợ HĐ / + Nợ TM / + Nợ CK (tiền đưa từ quỹ), Gia đình / Bỏ gia đình,
// Đã thu ngoài ca (một phần), Bỏ đã thu; phiếu chốt ca không nhắc công nợ gia đình, mục thu gọn ở bước Phiếu Fabi. role=chu (điện thoại, confirm=1)
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const typ = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const closed = async () => { for (let i = 0; i < 50 && $('dialog[open]'); i++) await sleep(100); await sleep(1500); await wait('.ln-sec', 300); await sleep(300); };
  const r = []; window.confirm = () => true;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const lhp = ov.find((x) => x.branch_code === 'LHP');
    const go = async (b) => { location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/thu-chi?cn=' + b; await wait('.ln-sec', 600); await sleep(600); };
    const row = (nm) => $$('.cn-row').find((x) => x.innerText.includes(nm));
    await go(lhp.branch_id);
    r.push(`khung: ${txt('.ln-sec h2')} · nút: ${$$('.ln-btns .btn').map((b) => b.innerText.trim()).join(', ')} · nhóm: ${$$('.ln-g').map((g) => g.innerText.replace(/\s+/g, ' ')).join(' / ')} · menu Người vay ${!!$('a[href="#/cai-dat/nguoi-vay"]')}`);
    // 1) Nợ TM tiền đưa từ quỹ, người nhà
    $('.cn-new[data-k="muon"]').click(); await wait('dialog[open] form'); await sleep(200); let dl = $('dialog[open]');
    r.push(`hộp: ${txt('h2', dl)} · ô quỹ ${!!dl.querySelector('[name=fo]')} (tích ${dl.querySelector('[name=fo]')?.checked}) · ô gia đình ${!!dl.querySelector('[name=fam]')}`);
    dl.querySelector('[name=nm]').value = 'Người nhà thử'; typ(dl.querySelector('[name=amt]'), '500.000'); dl.querySelector('[name=fam]').checked = true;
    dl.querySelector('[type=submit]').click(); await closed();
    // 2) Nợ HĐ khách ngoài
    $('.cn-new[data-k="bill"]').click(); await wait('dialog[open] form'); await sleep(200); dl = $('dialog[open]');
    r.push(`hộp Nợ HĐ có ô quỹ: ${!!dl.querySelector('[name=fo]')}`);
    dl.querySelector('[name=nm]').value = 'Công ty thử'; typ(dl.querySelector('[name=amt]'), '380.000'); dl.querySelector('[type=submit]').click(); await closed();
    const grp = () => $$('.ln-g').map((g) => { const out2 = []; let e = g.nextElementSibling; while (e && !e.classList.contains('ln-g')) { if (e.classList.contains('cn-row')) out2.push(e.querySelector('strong').innerText); e = e.nextElementSibling; } return `${g.firstChild.textContent.trim()}: ${out2.join(', ') || '—'}`; }).join(' | ');
    r.push(`sau ghi: ${grp()} · dòng NN: ${row('Người nhà thử')?.innerText.replace(/\s+/g, ' ')}`);
    // 3) Đã thu một phần ngoài ca
    row('Người nhà thử').querySelector('.cn-thu').click(); await wait('dialog[open] form'); await sleep(200); dl = $('dialog[open]');
    r.push(`hộp đã thu: ${txt('h2', dl)} · gợi ý ${dl.querySelector('[name=amt]').value} · hình thức ${dl.querySelector('[name=pay]:checked').value}`);
    typ(dl.querySelector('[name=amt]'), '200.000'); dl.querySelector('[type=submit]').click(); await closed();
    r.push(`sau thu 200k: ${row('Người nhà thử')?.innerText.replace(/\s+/g, ' ')} · đã thu gần đây: ${txt('.ln-sec details summary')}`);
    // 4) bỏ gia đình / gia đình
    row('Công ty thử').querySelector('.cn-fam').click(); await closed();
    r.push(`Công ty thử → gia đình: ${grp()}`);
    row('Công ty thử').querySelector('.cn-fam').click(); await closed();
    // 5) Bỏ đã thu
    $('.ln-sec details summary').click(); await sleep(200); $('.cn-unthu').click(); await closed();
    r.push(`bỏ đã thu: ${$$('.cn-row').filter((x) => x.innerText.includes('Người nhà thử')).map((x) => x.querySelector('.ln-owe').innerText).join(' + ')} · ${W()}`);
    // 6) Thêm khoản ở Thu chi: không còn Cho vay / Trả hộ
    $('#tc-add').click(); await wait('dialog[open] form'); await sleep(200);
    r.push(`Thêm khoản có loại: ${$$('dialog[open] [name=kind]').map((x) => x.closest('label').innerText.trim()).join(' / ')}`); $('dialog[open] [data-x]').click(); await sleep(200);
    // 7) phiếu chốt ca: nhắc khách nợ, không nhắc gia đình; gia đình ở mục thu gọn
    const cand = ov.filter((x) => x.branch_code === 'LHP'); const pick = cand.find((x) => !x.report_id && !x.status) || cand[cand.length - 1];
    const id = await rpc('app_ca_open', { p_branch: lhp.branch_id, p_date: day, p_shift: pick.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    try { sessionStorage.setItem('cm:' + id, JSON.stringify({ code: 2, viecDone: true })); } catch (_) { /* bỏ qua */ }
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id; await wait('.pc-nhac', 300); await sleep(800);
    r.push(`nhắc đầu phiếu: ${txt('.pc-nhac') || 'KHÔNG CÓ'} · bước ${txt('.cm-card h2')}`);
    r.push(`danh sách khách trả: ${$$('#cm-body > .cm-person strong').map((x) => x.innerText).join(' | ')} · mục gia đình: ${txt('#cm-body details summary')}`);
    r.push(`cuối: ${W()}`);
  } catch (e) { r.push('LỖI ' + (e.stack || e.message)); }
  out.push({ route: 'công nợ 85', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
