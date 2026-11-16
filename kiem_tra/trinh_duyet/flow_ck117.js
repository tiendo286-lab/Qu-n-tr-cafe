// Bước 117: Chuyển khoản thực nhận — số dư ĐẦU ca luôn = số dư CUỐI ca trước (tự lấy); sửa số cuối ca trước → số đầu ca sau tự theo;
// chỉ khi tích "khác số cuối ca trước" mới giữ số tự nhập (báo đỏ). role=chu (confirm=1; máy tính và test/phone.html)
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
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
    const id3 = await rpc('app_ca_open', { p_branch: br, p_date: day, p_shift: sh[2] });
    const acc = await rpc('app_kt_account_save', { p_id: null, p_branch: br, p_bank: 'VCB', p_no: '1234567890', p_holder: 'Chủ', p_label: null, p_active: true });
    await rpc('app_kt_bank_save_accounts', { p_report: id1, p_rows: [{ account_id: acc, opening: 4000000, closing: 5000000, transfers_out: 0, note: null }] });
    // ca 3 có số đầu cũ sai (giống lỗi thật): gửi 9.000.000 nhưng không tích tự nhập → máy chủ đặt = số cuối gần nhất (5.000.000)
    await rpc('app_kt_bank_save_accounts', { p_report: id3, p_rows: [{ account_id: acc, opening: 9000000, closing: 9500000, transfers_out: 0, note: null }] });
    check((await rpc('app_kt_bank_get', { p_report: id3 })).accounts[0].opening === 5000000, 'Máy chủ: gửi số đầu sai mà không tích → số đầu = số cuối ca trước');
    const go = async () => { location.hash = '#/__tam'; await sleep(200); location.hash = `#/ke-toan/chuyen-khoan?cn=${br}&ngay=${day}`; await wait('.ckw-c, table.ckw'); await sleep(1000); };
    await go();
    const c = (id) => $(`.ckw-c[data-k="${id}|${acc}"]`);
    check(/đầu 5\.000\.000/.test(txt('.ckw-o', c(id2))), 'Ca 2 chưa nhập: số đầu tự lấy = cuối ca 1 (5.000.000)');
    setv($('.ckw-close', c(id2)), '7.000.000'); await sleep(1500);
    let b2 = await rpc('app_kt_bank_get', { p_report: id2 }); let b3 = await rpc('app_kt_bank_get', { p_report: id3 });
    check(b2.accounts[0].opening === 5000000 && b2.accounts[0].closing === 7000000, 'Gõ số cuối ca 2 = 7.000.000 → lưu ca 2: đầu 5.000.000, cuối 7.000.000');
    check(b3.accounts[0].opening === 7000000 && /đầu 7\.000\.000/.test(txt('.ckw-o', c(id3))), 'Số đầu ca 3 (đã kê khai) tự đổi theo = 7.000.000');
    setv($('.ckw-close', c(id1)), '6.200.000'); await sleep(1500);
    b2 = await rpc('app_kt_bank_get', { p_report: id2 });
    check(b2.accounts[0].opening === 6200000 && /đầu 6\.200\.000/.test(txt('.ckw-o', c(id2))), 'Sửa số cuối ca 1 = 6.200.000 → số đầu ca 2 tự đổi = 6.200.000 (thực nhận ca 2 tính lại)');
    // hộp ⋯: ô số đầu khoá; tích "khác số cuối ca trước" mới nhập được, báo đỏ
    $('.ckw-more', c(id2)).click(); await wait('dialog[open] form .m-out'); await sleep(300);
    let f = $$('dialog[open] form').pop();
    check(f.querySelector('.m-open').disabled && !!f.querySelector('.m-man'), 'Hộp ⋯: số đầu tự lấy (khoá), có ô tích "khác số cuối ca trước"');
    f.querySelector('.m-man').checked = true; f.querySelector('.m-man').dispatchEvent(new Event('change', { bubbles: true })); await sleep(100);
    f.querySelector('.m-open').value = '6.000.000'; f.requestSubmit(); await sleep(1500);
    b2 = await rpc('app_kt_bank_get', { p_report: id2 });
    check(b2.accounts[0].opening === 6000000 && b2.accounts[0].opening_manual === true && /≠ cuối ca trước/.test(txt('.ckw-o', c(id2))), 'Tích tự nhập 6.000.000 → giữ số tự nhập, ô báo đỏ "≠ cuối ca trước"');
    $('.ckw-more', c(id2)).click(); await wait('dialog[open] form .m-out'); await sleep(300);
    f = $$('dialog[open] form').pop(); f.querySelector('.m-man').checked = false; f.querySelector('.m-man').dispatchEvent(new Event('change', { bubbles: true })); f.requestSubmit(); await sleep(1500);
    b2 = await rpc('app_kt_bank_get', { p_report: id2 });
    check(b2.accounts[0].opening === 6200000 && !b2.accounts[0].opening_manual, 'Bỏ tích → số đầu trở lại = số cuối ca trước');
    check(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, 'Không tràn ngang');
  } catch (e) { fail = e.message; r.push('FAIL: ' + e.message); }
  out.push({ route: 'ck117', title: r.join(' | '), errs: [...(window.__ERR || []), ...(fail ? [fail] : [])] });
};
