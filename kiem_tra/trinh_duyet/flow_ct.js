// Chốt tháng (role=chu, confirm=1): tạo phiếu ca tháng trước → tổng hợp → chi tiết cơ sở → phân nhóm khoản ở phiếu ca → thêm chi phí
// → chốt (bị chặn khi chưa đối soát) → đối soát xong → chốt → khóa → mở lại (Chủ) → cài đặt + giao cơ sở
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const log = (route, title, errs = []) => out.push({ route, title: String(title).slice(0, 700), len: 0, errs });
  const step = async (name, fn) => { window.__ERR.length = 0; let r = ''; try { r = await fn(); } catch (e) { window.__ERR.push('flow: ' + e.stack); } log(name, r || '', [...window.__ERR, ...$$('#root .alert.error').map((a) => 'page: ' + a.textContent.trim())]); };
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const { rpc } = await import('../js/sb.js');
  const go = async (h) => { location.hash = '#/__tam'; await sleep(200); location.hash = h; await wait('.ct-bar', 600); await sleep(600); };
  await wait('#root .page-head, #root h1', 600); await sleep(2500);
  const t = new Date(Date.now() + 7 * 3600e3); const pm = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 15)).toISOString().slice(0, 10); const M = pm.slice(0, 7);
  let id; let br; let shift; let branchCode;
  await step('Tạo phiếu ca tháng trước (đã hoàn thành, chưa đối soát)', async () => {
    const ov = await rpc('app_ca_overview', { p_date: pm }); br = ov[0].branch_id; shift = ov[0].shift; branchCode = ov[0].branch_code;
    id = await rpc('app_ca_open', { p_branch: br, p_date: pm, p_shift: ov[0].shift });
    await rpc('app_ca_save', { p_id: id, p: { rev_end: pm + ' 12:30', total_revenue: 3000000, pos_cash: 1800000, pos_transfer: 1200000, reported_transfer: 1200000, cash_counted: 2750000, opening_cash: 1000000, ipos_opening: 1000000, pos_debt: 0, pos_diff: -50000, diff_note: 'Mua đá trong ca', cups: 100, goods_status: 'khong', goods_note: null,
      moves: [{ kind: 'tien_mat', amount: -50000, note: 'Mua đá' }, { kind: 'tien_mat', amount: 20000, note: 'Khách gửi thêm' }], staff: [], handover: [], goods: [], debts: [] } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false }); for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    // Kế toán đã nhập đủ dữ liệu nhưng quản lý chưa đối soát: đúng tình huống cần thử ở Chốt tháng.
    const acc = await rpc('app_kt_account_save', { p_id: null, p_branch: br, p_bank: 'BIDV', p_no: '1234567890', p_holder: 'QUAN THU', p_label: null, p_active: true });
    await rpc('app_kt_bank_save_accounts', { p_report: id, p_rows: [{ account_id: acc, opening: 1000, closing: 1201000, transfers_out: 0, note: null }] });
    const [y, mo, d] = pm.split('-');
    const store = { LHP: 'Milano Coffee - Lê Hồng Phong', 'ĐK': 'Milano Coffee - Đông Khê', HS: 'Milano Coffee - Hồ Sen', LL: 'Lela Cafe', LLB: 'Lela Cafe' }[branchCode] || 'Milano Coffee - Lê Hồng Phong';
    await rpc('app_fabi_upload', { p_rows: [{ ma_ca: 'CT-' + pm, store, open: `${d}/${mo}/${y} 06:45`, close: `${d}/${mo}/${y} 12:30`, dau: 1000000, cuoi: 2800000, net: 3000000, hd: 100, tong: 2750000,
      pay: [{ name: 'CHUYỂN KHOẢN', amount: 1200000 }, { name: 'Tiền mặt', amount: 1800000 }], tra_no: [], sua: [] }] });
    return `phiếu ${id} ngày ${pm}`;
  });
  await step('Tổng hợp tất cả cơ sở', async () => { await go(`#/quan-ly/chot-thang?thang=${M}&cn=all`); return txt('.ct-month') + ' · ' + txt('.branch-tabs') + ' || ' + $$('.table tbody tr').slice(0, 2).map((r) => r.innerText.replace(/\s+/g, ' ')).join(' / '); });
  await step('Chi tiết cơ sở: số liệu + cảnh báo', async () => {
    await go(`#/quan-ly/chot-thang?thang=${M}&cn=${br}`);
    return txt('.ct-kpis') + ' || ' + txt('.ct-status') + ' || khoản ở phiếu ca: ' + $$('.ct-mv').length + ' · ' + txt('.ct-grid .ct-sec');
  });
  await step('Phân nhóm khoản "Mua đá" → Vật dụng', async () => {
    const s = $$('.ct-mv').find((x) => x.closest('.ct-row').innerText.includes('Mua đá')); setv(s, [...s.options].find((o) => o.text === 'Vật dụng').value);
    await sleep(800); await wait('.ct-bar'); await sleep(400);
    return txt('.ct-status') + ' · ' + txt('.ct-cats');
  });
  await step('Thêm chi phí Mặt bằng 10.000.000 (chuyển khoản)', async () => {
    $('#ct-add').click(); await sleep(200); const f = $('dialog[open] form');
    setv(f.cat, [...f.cat.options].find((o) => o.text === 'Mặt bằng').value); setv(f.note, 'Tiền nhà'); setv(f.amt, '10.000.000'); f.querySelector('input[value=chuyen_khoan]').click();
    f.requestSubmit(); await sleep(800); await wait('.ct-bar'); await sleep(400);
    return txt('.ct-kpis') + ' · ' + $$('.ct-list')[1]?.innerText.replace(/\s+/g, ' ');
  });
  await step('Chốt khi còn ca chưa đối soát → bị chặn', async () => { $('#ct-close').click(); await sleep(600); return txt('#saved-indicator, .saved') || 'KHÔNG BÁO'; });
  await step('Đối soát xong ca → Chốt tháng → khóa', async () => {
    for (const it of ['tien_mat', 'chuyen_khoan', 'thu_chi', 'cong_no']) await rpc('app_ca_result_set', { p_id: id, p_item: it, p_result: 'khop', p_amount: null, p_reason: null, p_people: null });
    for (const it of ['thoi_gian', 'doanh_thu', 'nhan_su', 'ban_giao']) await rpc('app_ca_check', { p_id: id, p_item: it, p_on: true });
    await go(`#/quan-ly/chot-thang?thang=${M}&cn=${br}`);
    $('#ct-close').click(); await sleep(800); await wait('.ct-bar'); await sleep(500);
    let blocked = ''; try { await rpc('app_fin_entry_save', { p_id: null, p: { branch_id: br, entry_date: pm, kind: 'chi', amount: 1000, note: 'x' } }); blocked = 'KHÔNG KHÓA'; } catch (e) { blocked = e.message; }
    return `${txt('.ct-status')} · nút thêm: ${!!$('#ct-add')} · ô nhóm khóa: ${$$('.ct-mv').every((s) => s.disabled)} · thêm khoản: ${blocked}`;
  });
  await step('Mở lại tháng (Chủ, có lý do)', async () => { $('#ct-reopen').click(); await sleep(800); await wait('.ct-bar'); await sleep(500); return txt('.ct-status') + ' · ' + txt('details:last-of-type'); });
  await step('Cài đặt: nhóm chi/thu + giao cơ sở cho quản lý', async () => {
    $('#ct-set').click(); await sleep(800); const d = $('dialog[open]');
    const a = `${d.querySelectorAll('.ct-cat').length} nhóm · quản lý: ${d.querySelectorAll('.ct-mgr').length}`;
    d.querySelector('#ct-nn').value = 'Phí ngân hàng'; d.querySelector('#ct-na').click(); await sleep(800); await wait('.ct-bar'); await sleep(300);
    $('#ct-set').click(); await sleep(800); const d2 = $('dialog[open]'); const cb = d2.querySelector('.ct-mgr input'); cb.checked = true; d2.querySelector('#ct-save').click(); await sleep(800);
    return `${a} → thêm nhóm: ${(await rpc('app_fin_month', { p_branch: br, p_month: M })).categories.map((c) => c.name).slice(-1)} · giao: ${JSON.stringify(await rpc('app_fin_managers'))}`;
  });
  await step('Khung 390px không tràn ngang', async () => {
    const W = document.documentElement.clientWidth; const chk = () => $$('#root *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > W + 0.5).map((el) => el.tagName + '.' + String(el.className).slice(0, 30)).slice(0, 6).join(', ') || 'không';
    const a = chk(); const sa = document.documentElement.scrollWidth; await go(`#/quan-ly/chot-thang?thang=${M}&cn=all`); const b = chk(); const sb2 = document.documentElement.scrollWidth;
    location.hash = '#/quan-ly/doi-soat'; await wait('.bc-grid', 300); await sleep(500); const c = document.documentElement.scrollWidth;
    return `rộng ${W} · trang chi tiết ${sa} / tổng hợp ${sb2} / (so sánh) Đối soát ${c} · chi tiết tràn: ${a} · tổng hợp tràn: ${b}`;
  });
};
