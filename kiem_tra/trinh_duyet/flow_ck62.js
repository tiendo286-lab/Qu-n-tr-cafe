// Bước 62 / 99: Chuyển khoản thực nhận — BẢNG theo ngày (hàng = tài khoản, cột = ca theo giờ đóng ca Fabi); chỉ gõ số dư lúc đóng ca;
// số đầu ca sau tự theo số cuối ca trước; tự lưu; nút ⋯ (chuyển ra, ghi chú). Không còn so khớp / lệch. role=chu (confirm=1, điện thoại)
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const br = ov[0].branch_id; const sh = ov.filter((x) => x.branch_id === br).map((x) => x.shift);
    const id1 = await rpc('app_ca_open', { p_branch: br, p_date: day, p_shift: sh[0] });
    const id2 = await rpc('app_ca_open', { p_branch: br, p_date: day, p_shift: sh[1] });
    const acc = await rpc('app_kt_account_save', { p_id: null, p_branch: br, p_bank: 'VCB', p_no: '1234567890', p_holder: 'Chủ', p_label: null, p_active: true });
    await rpc('app_kt_bank_save_accounts', { p_report: id1, p_rows: [{ account_id: acc, opening: 4000000, closing: 5000000, transfers_out: 0, note: null }] });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ke-toan/chuyen-khoan?ngay=' + day; await wait('table.ckt'); await sleep(1000);
    const sec = $$('table.ckt').map((t) => t.closest('section')).find((s) => s.querySelector(`.ckt-c[data-k="${id1}|${acc}"]`));
    const c1 = $(`.ckt-c[data-k="${id1}|${acc}"]`, sec); const c2 = $(`.ckt-c[data-k="${id2}|${acc}"]`, sec);
    r.push(`bảng: cột ${$$('thead th', sec).map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ')} · còn chữ khớp/lệch ${/khớp|lệch|so với/i.test(sec.innerText)} · nút Lưu ${!!$('#ck-save-all')}`);
    r.push(`ca 1: ${txt('.ckt-o', c1)} · ca 2: ${txt('.ckt-o', c2)} · thực nhận: ${$$('.ckt-tot', sec).map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ')}`);
    setv($('.ckt-close', c1), '6.200.000'); await sleep(1500);
    r.push(`gõ cuối ca 1 = 6.200.000 → ca 2: ${txt('.ckt-o', c2)} · thực nhận ca 1: ${txt(`.ckt-tot[data-r="${id1}"]`, sec)} · ${txt('#saved-indicator')}`);
    setv($('.ckt-close', c2), '7.000.000'); await sleep(1500);
    let b1 = await rpc('app_kt_bank_get', { p_report: id1 }); let b2 = await rpc('app_kt_bank_get', { p_report: id2 });
    r.push(`tự lưu: ca 1 ${b1.accounts[0].opening}→${b1.accounts[0].closing} · ca 2 ${b2.accounts[0].opening}→${b2.accounts[0].closing} · thực nhận ca 2: ${txt(`.ckt-tot[data-r="${id2}"]`, sec)}`);
    $('.ckt-more', c2).click(); await wait('dialog[open] form .m-out'); await sleep(300);
    const f = $$('dialog[open] form').pop();
    r.push(`hộp ⋯: ${txt('h2', f)} · ô ${$$('.field > span:first-child', f).map((x) => x.innerText).join(' / ')} · ${txt('summary', f)}`);
    f.querySelector('.m-out').value = '300.000'; f.note.value = 'rút về TK chủ'; f.requestSubmit(); await sleep(1500);
    b2 = await rpc('app_kt_bank_get', { p_report: id2 });
    r.push(`sau ⋯: ${txt('.ckt-o', c2)} · chấm ${$('.ckt-more', c2).classList.contains('dot')} · thực nhận ca 2: ${txt(`.ckt-tot[data-r="${id2}"]`, sec)} · máy chủ chuyển ra ${b2.accounts[0].transfers_out} ghi chú ${b2.accounts[0].note} · ${W()}`);
    if (new URLSearchParams(location.search).get('dung')) { sec.scrollIntoView(); await new Promise(() => {}); }
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'chuyển khoản: bảng theo ngày', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
