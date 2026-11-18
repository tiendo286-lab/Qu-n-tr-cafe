// Bước 135: Chuyển khoản thực nhận trên ĐIỆN THOẠI — gõ số dư là tự lưu, KHÔNG cần bấm ra ngoài ô.
// Trên điện thoại, ẩn bàn phím / bấm chỗ trống / chuyển sang app ngân hàng thì ô vẫn đang chọn → trước đây web không lưu.
// role=nvkt (kế toán là nhân viên) · chạy trên test/phone.html và máy tính.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s);
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const type = (el, v) => { el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };   // chỉ gõ — không blur, không 'change'
  const r = []; let fail = null;
  const check = (ok, m) => { if (!ok) throw new Error(m); r.push(m); };
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2000);
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const br = ov[0].branch_id; const sh = ov.filter((x) => x.branch_id === br).map((x) => x.shift);
    const id1 = await rpc('app_ca_open', { p_branch: br, p_date: day, p_shift: sh[0] });
    const id2 = await rpc('app_ca_open', { p_branch: br, p_date: day, p_shift: sh[1] });
    const acc = await rpc('app_kt_account_save', { p_id: null, p_branch: br, p_bank: 'VCB', p_no: '1234567890', p_holder: 'Chủ', p_label: null, p_active: true });
    await rpc('app_kt_bank_save_accounts', { p_report: id1, p_rows: [{ account_id: acc, opening: 4000000, closing: 5000000, transfers_out: 0, note: null }] });
    location.hash = '#/__tam'; await sleep(200); location.hash = `#/ke-toan/chuyen-khoan?cn=${br}&ngay=${day}`; await wait('.ckw-c'); await sleep(1000);
    const c = (id) => $(`.ckw-c[data-k="${id}|${acc}"]`);
    const inp = $('.ckw-close', c(id2));
    let changed = false; inp.addEventListener('change', () => { changed = true; });
    type(inp, '7.300.000'); await sleep(2500);
    check(!changed && !inp.disabled, 'Chỉ gõ, chưa rời ô (không có sự kiện "change" — giống điện thoại: ẩn bàn phím / bấm chỗ trống)');
    let b2 = await rpc('app_kt_bank_get', { p_report: id2 });
    check(b2.accounts[0].closing === 7300000, `Gõ 7.300.000 rồi dừng tay → tự lưu, không cần bấm ra ngoài (máy chủ: ${b2.accounts[0].closing})`);
    const ind = $('#saved-indicator'); const rc = ind.getBoundingClientRect();
    check(!ind.hidden && /Đã lưu/.test(ind.textContent) && rc.top >= 0 && rc.bottom <= innerHeight, `Thấy chữ "Đã lưu" trên màn hình (${ind.textContent}; top ${Math.round(rc.top)})`);
    // gõ tiếp rồi rời trang ngay (chuyển app / tắt màn hình) trước khi kịp tự lưu → vẫn lưu
    type(inp, '7.450.000');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange')); await sleep(400);   // chưa tới lúc tự lưu (dừng tay ~1 giây)
    delete document.visibilityState;
    b2 = await rpc('app_kt_bank_get', { p_report: id2 });
    check(b2.accounts[0].closing === 7450000, `Gõ rồi chuyển sang app khác ngay → vẫn lưu (máy chủ: ${b2.accounts[0].closing})`);
    check(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, 'Không tràn ngang');
  } catch (e) { fail = e.message; r.push('FAIL: ' + e.message); }
  out.push({ route: 'ck135', title: r.join(' | '), errs: [...(window.__ERR || []), ...(fail ? [fail] : [])] });
};
