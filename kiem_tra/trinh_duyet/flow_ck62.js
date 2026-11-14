// Bước 62 / 100: Chuyển khoản thực nhận — BẢNG TUẦN 1 CƠ SỞ (cột = ngày, hàng = ca → tài khoản → Thực nhận); chỉ gõ số dư lúc đóng ca;
// số đầu ca sau chỉ tự điền khi ca sau CHƯA kê khai; KHÔNG đổi số đã kê khai; tự lưu đúng ca vừa sửa; nút ⋯. role=chu (confirm=1, điện thoại)
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
    const id3 = await rpc('app_ca_open', { p_branch: br, p_date: day, p_shift: sh[2] });
    const acc = await rpc('app_kt_account_save', { p_id: null, p_branch: br, p_bank: 'VCB', p_no: '1234567890', p_holder: 'Chủ', p_label: null, p_active: true });
    await rpc('app_kt_bank_save_accounts', { p_report: id1, p_rows: [{ account_id: acc, opening: 4000000, closing: 5000000, transfers_out: 0, note: null }] });
    // ca 3 đã kê khai sẵn số đầu 9.000.000 (khác) — web không được đổi
    await rpc('app_kt_bank_save_accounts', { p_report: id3, p_rows: [{ account_id: acc, opening: 9000000, closing: 9500000, transfers_out: 0, note: null }] });
    const go = async () => { location.hash = '#/__tam'; await sleep(200); location.hash = `#/ke-toan/chuyen-khoan?cn=${br}&ngay=${day}`; await wait('table.ckw'); await sleep(1000); };
    await go();
    const c = (id) => $(`.ckw-c[data-k="${id}|${acc}"]`);
    r.push(`trang: cơ sở ${txt('.branch-tabs a.on')} · tuần ${txt('.ckw-nav strong')} · cột ${$$('thead th').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ')} · còn chữ khớp/lệch ${/khớp|lệch|so với/i.test(txt('table.ckw'))} · nút Theo ngày ${!!$('.ck-view')}`);
    r.push(`hàng: ${$$('table.ckw tbody th').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / ')}`);
    r.push(`ca 1: ${txt('.ckw-o', c(id1))} · ca 2: ${txt('.ckw-o', c(id2))} · ca 3: ${txt('.ckw-o', c(id3))}`);
    setv($('.ckw-close', c(id2)), '7.000.000'); await sleep(1500);
    let b2 = await rpc('app_kt_bank_get', { p_report: id2 });
    r.push(`gõ ca 2 = 7.000.000 → lưu ca 2: ${b2.accounts[0].opening}→${b2.accounts[0].closing} · thực nhận ca 2: ${txt(`.ckw-t[data-r="${id2}"]`)} · ${txt('#saved-indicator')}`);
    // sửa ca 1 → ca 2 đã kê khai: KHÔNG đổi số đầu, chỉ nhắc
    setv($('.ckw-close', c(id1)), '6.200.000'); await sleep(1500);
    b2 = await rpc('app_kt_bank_get', { p_report: id2 }); const b3 = await rpc('app_kt_bank_get', { p_report: id3 });
    r.push(`sửa ca 1 = 6.200.000 → ca 2 máy chủ vẫn ${b2.accounts[0].opening} · ô ca 2: ${txt('.ckw-o', c(id2))} · ca 3 máy chủ vẫn ${b3.accounts[0].opening} · ô ca 3: ${txt('.ckw-o', c(id3))}`);
    r.push(`tổng: ${$$('.ckw-tn').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / ')} · cả ngày: ${txt('.ckw-all')}`);
    $('.ckw-more', c(id2)).click(); await wait('dialog[open] form .m-out'); await sleep(300);
    const f = $$('dialog[open] form').pop();
    r.push(`hộp ⋯: ${txt('h2', f)} · ô ${$$('.field > span:first-child', f).map((x) => x.innerText).join(' / ')}`);
    f.querySelector('.m-out').value = '300.000'; f.note.value = 'rút về TK chủ'; f.requestSubmit(); await sleep(1500);
    b2 = await rpc('app_kt_bank_get', { p_report: id2 });
    r.push(`sau ⋯: ${txt('.ckw-o', c(id2))} · máy chủ ca 2 đầu ${b2.accounts[0].opening} ra ${b2.accounts[0].transfers_out} ghi chú ${b2.accounts[0].note} · ${W()}`);
    await go();
    r.push(`tải lại: ca 1 ${$('.ckw-close', c(id1)).value} · ca 2 ${txt('.ckw-o', c(id2))}`);
    if (new URLSearchParams(location.search).get('dung')) { window.scrollTo(0, 0); await new Promise(() => {}); }
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'chuyển khoản: bảng tuần 1 cơ sở', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
