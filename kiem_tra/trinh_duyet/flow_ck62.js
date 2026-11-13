// Bước 62: Chuyển khoản thực nhận — chỉ nhập số dư cuối; số đầu ca sau tự theo số cuối ca trước; Lưu cả ngày. role=chu (confirm=1, điện thoại)
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const typ = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
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
    // hôm trước đã có số dư cuối 5.000.000 → ca Sáng hôm nay tự lấy làm số đầu
    await rpc('app_kt_bank_save_accounts', { p_report: id1, p_rows: [{ account_id: acc, opening: 4000000, closing: 5000000, transfers_out: 0, note: null }] });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ke-toan/chuyen-khoan?ngay=' + day; await wait('.ck-row[data-report]'); await sleep(800);
    const [r1, r2] = $$('.ck-row[data-report]');
    r.push(`Ca 1: số đầu ô nhập (đã có số khác ca trước) ${!!$('.ck-open:not([hidden])', r1)} · Ca 2: số đầu hiện chữ "${txt('.ck-oa', r2)}" ${txt('.ck-osrc', r2)} · nút Lưu cả ngày ${!!$('#ck-save-all')} · ${W()}`);
    typ($('.ck-close', r1), '6.200.000'); await sleep(200);
    r.push(`Gõ số cuối ca 1 = 6.200.000 → ca 2 số đầu: ${txt('.ck-ov', r2)} (${txt('.ck-osrc', r2)}) · ${txt('#ck-dirty')}`);
    typ($('.ck-close', r2), '7.000.000'); await sleep(200);
    r.push(`ca 2: ${txt('.ck-res', r2)}`);
    $('#ck-save-all').click(); for (let i = 0; i < 60 && txt('#ck-dirty'); i++) await sleep(100); await sleep(500);
    const b1 = await rpc('app_kt_bank_get', { p_report: id1 }); const b2 = await rpc('app_kt_bank_get', { p_report: id2 });
    r.push(`Lưu cả ngày: ${txt('#saved-indicator')} · máy chủ: ca 1 ${b1.accounts[0].opening}→${b1.accounts[0].closing} · ca 2 ${b2.accounts[0].opening}→${b2.accounts[0].closing} nhận ${b2.received}`);
    $('.ck-oe', r2)?.click(); await sleep(100);
    r.push(`Bấm Sửa số đầu ca 2: ô nhập hiện ${!$('.ck-open', r2).hidden} · ${W()}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'chuyển khoản: chỉ nhập số cuối', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
