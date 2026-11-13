// Bước 70: Công nợ ở Thu chi — trả hộ Kho tổng (cộng vào nợ Kho tổng), quản lý ghi khách nợ (tên, SĐT), Cho vay mọi cơ sở;
// phiếu chốt ca nhắc khách nợ ở đầu phiếu, khách trả một phần (phần còn lại vẫn nhắc). role=chu (điện thoại, confirm=1)
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
    const lhp = ov.find((x) => x.branch_code === 'LHP'); const other = ov.find((x) => x.branch_code !== 'LHP');
    const go = async (b) => { location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/thu-chi?cn=' + b; await wait('.ln-sec', 600); await sleep(600); };
    await go(lhp.branch_id);
    r.push(`khung: ${txt('.ln-sec h2')} · nút: ${$$('.ln-btns .btn').map((b) => b.innerText.trim()).join(', ')}`);
    // 1) trả hộ Kho tổng
    $('.ln-traho').click(); await wait('dialog[open] form'); await sleep(200); let dl = $('dialog[open]');
    r.push(`hộp trả hộ: ${txt('h2', dl)} · ô người vay ẩn ${dl.querySelector('[name=p]').closest('label').hidden}`);
    typ(dl.querySelector('[name=amt]'), '420.000'); dl.querySelector('[type=submit]').click(); await sleep(600);
    r.push(`lưu không nội dung: ${txt('.ln-err', dl)}`);
    dl.querySelector('[name=note]').value = 'tiền ga'; dl.querySelector('[type=submit]').click(); await closed();
    r.push(`Kho tổng: ${$$('.ln-p').map((x) => x.innerText.replace(/\s+/g, ' ')).find((t) => /kho tổng/i.test(t)) || 'KHÔNG THẤY'}`);
    // 2) khách nợ do quản lý ghi
    $('.cn-new').click(); await wait('dialog[open] form'); await sleep(200); dl = $('dialog[open]');
    dl.querySelector('[name=nm]').value = 'Công ty thử'; dl.querySelector('[name=ph]').value = '0900111222'; typ(dl.querySelector('[name=amt]'), '380.000');
    dl.querySelector('[type=submit]').click(); await closed();
    r.push(`khách nợ: ${$$('.cn-row').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ') || 'KHÔNG THẤY'} · ô Nợ: ${txt('#k-no .v')} · ô Cho vay: ${txt('#k-vay .v')}`);
    $('#tc-add').click(); await wait('dialog[open] form'); await sleep(200);
    r.push(`Thêm khoản có loại: ${$$('dialog[open] [name=kind]').map((x) => x.closest('label').innerText.trim()).join(' / ')}`); $('dialog[open] [data-x]').click(); await sleep(200);
    // 3) cơ sở khác: có Cho vay, không có Trả hộ
    await go(other.branch_id);
    r.push(`${other.branch_code}: ${txt('.ln-sec h2')} · nút: ${$$('.ln-btns .btn').map((b) => b.innerText.trim()).join(', ')}`);
    // 4) phiếu chốt ca LHP: nhắc + thu một phần
    const cand = ov.filter((x) => x.branch_code === 'LHP'); const pick = cand.find((x) => !x.report_id && !x.status) || cand[cand.length - 1];
    const id = await rpc('app_ca_open', { p_branch: lhp.branch_id, p_date: day, p_shift: pick.shift });
    r.push(`ca thử: ${pick.shift} · trạng thái ${(await rpc('app_ca_get', { p_id: id })).status} · ô ca: ${Object.keys(pick).join(',')}`.slice(0, 200));
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    try { sessionStorage.setItem('cm:' + id, JSON.stringify({ step: 2 })); } catch (_) { /* bỏ qua */ }
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id; await wait('.pc-nhac', 300); await sleep(800);
    if (new URLSearchParams(location.search).get('shot')) return;
    r.push(`nhắc đầu phiếu: ${txt('.pc-nhac') || 'KHÔNG CÓ'} · bước ${txt('.cm-card h2')}`);
    const am = $$('[data-paidamt]').find((x) => x.closest('.cm-person')?.innerText.includes('Công ty thử'));
    if (!am) throw new Error('không thấy ô khách trả nợ (bước ' + txt('.cm-card h2') + ')');
    const row = am.closest('.cm-person');
    r.push(`dòng nợ: ${row.innerText.replace(/\s+/g, ' ')} · gợi ý ${am.value}`);
    typ(am, '200.000'); const sl = row.querySelector('[data-paid]'); sl.value = 'tien_mat'; sl.dispatchEvent(new Event('change'));
    await sleep(2500); await wait('.pc-nhac', 100); await sleep(800);
    r.push(`sau thu 200.000: nhắc ${txt('.pc-nhac')} · dòng: ${$$('.cm-person').map((x) => x.innerText.replace(/\s+/g, ' ')).filter((t) => t.includes('Công ty thử')).join(' | ')}`);
    r.push(`cuối: ${W()}`);
  } catch (e) { r.push('LỖI ' + e.message); }
  out.push({ route: 'công nợ 70', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
