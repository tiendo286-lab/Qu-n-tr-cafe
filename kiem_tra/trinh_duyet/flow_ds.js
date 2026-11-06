// Luồng BẢN ĐỐI SOÁT riêng (role=chu): tạo phiếu hoàn thành → mở bản đối soát → sửa số (phiếu gốc giữ nguyên, có "Phiếu NV")
// → đủ hạng mục → khóa → mở lại đối soát → hoàn thành lại → xem lịch sử → xem phiếu gốc
export default async ({ settle, sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const log = (route, title, errs = []) => out.push({ route, title: String(title).slice(0, 700), len: 0, errs });
  const step = async (name, fn) => { window.__ERR.length = 0; let r = ''; try { r = await fn(); } catch (e) { window.__ERR.push('flow: ' + e.stack); } log(name, r || '', [...window.__ERR, ...$$('#root .alert.error').map((a) => 'page: ' + a.textContent.trim())]); };
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const { rpc } = await import('../js/sb.js');
  const open = async (h) => { location.hash = '#/__tam'; await sleep(200); location.hash = h; await wait('#pc-form'); await sleep(700); };
  let id;
  await step('Tạo phiếu Sáng hoàn thành (dữ liệu thử)', async () => {
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    id = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[0].shift });
    const R = await rpc('app_ca_get', { p_id: id });
    await rpc('app_ca_save', { p_id: id, p: { rev_end: day + ' 12:30', total_revenue: 2000000, pos_cash: 1200000, pos_transfer: 800000, reported_transfer: 800000, cash_counted: 2150000, opening_cash: 1000000, cups: 80, goods_status: 'khong', goods_note: null,
      moves: [{ kind: 'tien_mat', amount: -50000, note: 'chi đá' }], staff: (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:30' })), handover: [], goods: [], debts: [] } });
    await rpc('app_ca_complete', { p_id: id });
    return 'phiếu ' + id + ' · ' + (await rpc('app_ca_get', { p_id: id })).status;
  });
  await step('Mở phiếu: mặc định Bản đối soát', async () => { await open('#/ca/phieu?id=' + id); return txt('.pc-ban') + ' · đang chọn: ' + txt('.pc-ban a.on') + ' · sửa được pos_cash: ' + !$('#pos_cash').disabled + ' · ' + txt('.pc-foot, #pc-form > section:last-of-type').slice(0, 160); });
  await step('Sửa Mục 2 trên bản đối soát (kèm lý do)', async () => {
    setv($('#rc-reason'), 'NV nhập nhầm'); setv($('#pos_cash'), '1.250.000'); await sleep(2000);
    await open('#/ca/phieu?id=' + id);
    return 'ĐS pos_cash=' + $('#pos_cash').value + ' · ghi chú: ' + txt('#pos_cash')?.slice(0, 0) + ($('#pos_cash').closest('.pc-f').querySelector('.pc-orig')?.innerText || 'KHÔNG CÓ "Phiếu NV"') + ' · lịch sử: ' + txt('details summary');
  });
  await step('Phiếu gốc không đổi', async () => { await open('#/ca/phieu?id=' + id + '&ban=goc'); return 'gốc pos_cash=' + $('#pos_cash').value + ' · khóa: ' + $('#pos_cash').disabled + ' · ' + txt('.pc-ban a.on'); });
  await step('Đủ 9 hạng mục → HOÀN THÀNH ĐỐI SOÁT, khóa', async () => {
    await open('#/ca/phieu?id=' + id);
    for (let i = 0; i < 12; i++) { const b = $('.rc-chip[data-item]:not(.on)'); if (!b) break; b.click(); await sleep(600); await wait('#pc-form'); await sleep(300); }
    return txt('.pc-head .pill.ok, .pc-head .pill') + ' · ô pos_cash khóa: ' + $('#pos_cash').disabled + ' · nút: ' + ($('#rc-reopen') ? 'Mở lại đối soát' : 'KHÔNG CÓ');
  });
  await step('Mở lại đối soát → ĐANG ĐỐI SOÁT LẠI → hoàn thành lại', async () => {
    $('#rc-reopen').click(); await sleep(800); await wait('#pc-form'); await sleep(400);
    const a = txt('.pc-head') + ' · sửa được: ' + !$('#pos_cash').disabled;
    $('#rc-finish').click(); await sleep(800); await wait('#pc-form'); await sleep(400);
    return a + ' → ' + txt('#root .alert.ok');
  });
  await step('Lịch sử sửa', async () => $$('.rc-log').map((x) => x.textContent.replace(/\s+/g, ' ')).join(' / '));
};
