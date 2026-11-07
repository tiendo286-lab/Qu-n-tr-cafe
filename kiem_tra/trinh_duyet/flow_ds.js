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
  const open = async (h) => { location.hash = '#/__tam'; await sleep(200); location.hash = h; await wait('#pc-form', 600); await sleep(700); };
  await wait('#root .page-head, #root h1', 600); await sleep(2500);
  let id;
  await step('Tạo phiếu Sáng hoàn thành (dữ liệu thử)', async () => {
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    id = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[0].shift });
    const R = await rpc('app_ca_get', { p_id: id });
    await rpc('app_ca_save', { p_id: id, p: { rev_end: day + ' 12:30', total_revenue: 2000000, pos_cash: 1200000, pos_transfer: 800000, reported_transfer: 800000, cash_counted: 2150000, opening_cash: 1000000, ipos_opening: 1000000, cups: 80, goods_status: 'khong', goods_note: null,
      moves: [{ kind: 'tien_mat', amount: -50000, note: 'chi đá' }], staff: (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:30' })), handover: [], goods: [], debts: [] } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos.jpg', p_kind: 'ipos' });
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
  let resLog = '';
  await step('Hạng mục tiền: KHỚP / THIẾU (gán nhân viên) / THỪA', async () => {
    await open('#/ca/phieu?id=' + id);
    // Tiền mặt: web gợi ý THIẾU 50.000 (két 2.150.000 − 1.000.000 − 1.250.000 + chi 50.000)
    $('.rc-res[data-item=tien_mat]').click(); await sleep(300);
    let d = $('dialog[open]'); const sug = d.querySelector('input[name=res]:checked').value + ' ' + d.querySelector('input[name=amt]').value + ' · ' + d.querySelector('.diff-card').innerText.replace(/\s+/g, ' ').slice(0, 60);
    d.querySelector('form').requestSubmit(); await sleep(300); const errWhy = d.querySelector('#rs-err').innerText;
    setv(d.querySelector('input[name=why]'), 'Thiếu tiền két');
    const people = d.querySelectorAll('.rs-p input[type=checkbox]');
    if (people.length) { people[0].checked = true; people[0].dispatchEvent(new Event('change', { bubbles: true })); await sleep(100); }
    else { d.querySelector('input[value=khop]').click(); d.querySelector('input[value=khop]').dispatchEvent(new Event('change', { bubbles: true })); }
    const split = d.querySelector('#rs-sum')?.innerText || '';
    d.querySelector('form').requestSubmit(); await sleep(900); await wait('#pc-form'); await sleep(300);
    const after = txt('.rc-res[data-item=tien_mat]') + ' · ' + txt('.ka-box');
    for (const it of ['chuyen_khoan', 'thu_chi', 'cong_no']) {
      $(`.rc-res[data-item=${it}]`).click(); await sleep(300); d = $('dialog[open]');
      d.querySelector('input[value=khop]').click(); d.querySelector('form').requestSubmit(); await sleep(800); await wait('#pc-form'); await sleep(300);
    }
    resLog = `gợi ý: ${sug} · thiếu lý do: "${errWhy}" · ${people.length} NV · ${split} → ${after}`;
    return resLog + ' · chips: ' + $$('.rc-res').map((b) => b.innerText).join(' | ');
  });
  await step('Đủ 9 hạng mục → HOÀN THÀNH ĐỐI SOÁT, khóa', async () => {
    for (let i = 0; i < 12; i++) { const b = $('.rc-chip[data-item]:not(.on):not(.rc-res)'); if (!b) break; b.click(); await sleep(600); await wait('#pc-form'); await sleep(300); }
    return txt('.pc-head .pill.ok, .pc-head .pill') + ' · ô pos_cash khóa: ' + $('#pos_cash').disabled + ' · nút: ' + ($('#rc-reopen') ? 'Mở lại đối soát' : 'KHÔNG CÓ');
  });
  await step('Bảng ca hôm nay (Đối soát)', async () => {
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat'; await wait('.bc-grid'); await sleep(500);
    return txt('.bc-legend') + ' || ' + $$('.bc-grid .bc').slice(0, 4).map((b) => b.className.replace('bc ', '') + ':' + b.innerText.replace(/\s+/g, ' ')).join(' / ');
  });
  await step('Khoản âm (quản lý)', async () => {
    location.hash = '#/quan-ly/khoan-am'; await wait('#ka-list'); await sleep(400);
    const a = txt('.ka-sum') + ' · ' + txt('#f-n');
    const b = $('.ka-set'); if (!b) return a + ' · (không có khoản âm)';
    b.click(); await sleep(200); const d = $('dialog[open]'); d.querySelector('input[value=mien]').click(); d.querySelector('form').requestSubmit(); await sleep(300);
    const err = d.querySelector('#ka-err').innerText; d.querySelector('input[value=da_bu]').click(); d.querySelector('form').requestSubmit(); await sleep(600);
    return `${a} · miễn không lý do: "${err}" → ${txt('#root .alert')}`;
  });
  await step('Báo cáo ca', async () => {
    location.hash = '#/quan-ly/bao-cao-ca'; await wait('.rp-kpis'); await sleep(400);
    return txt('.rp-kpis') + ' · cột: ' + $$('.rp-bar').length + ' · ' + txt('.rp-wrap table tbody tr:last-child');
  });
  await step('Quay lại phiếu', async () => { await open('#/ca/phieu?id=' + id); return txt('.pc-head .pill'); });
  await step('Mở lại đối soát → ĐANG ĐỐI SOÁT LẠI → hoàn thành lại', async () => {
    $('#rc-reopen').click(); await sleep(800); await wait('#pc-form'); await sleep(400);
    const a = txt('.pc-head') + ' · sửa được: ' + !$('#pos_cash').disabled;
    $('#rc-finish').click(); await sleep(800); await wait('#pc-form'); await sleep(400);
    return a + ' → ' + txt('#root .alert.ok');
  });
  await step('Lịch sử sửa', async () => $$('.rc-log').map((x) => x.textContent.replace(/\s+/g, ' ')).join(' / '));
  let id2;
  await step('Ca Chiều đếm nhận két lệch → đếm lại vẫn lệch (máy chủ giả)', async () => {
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    id2 = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[1].shift });
    const h1 = await rpc('app_ca_cash_receive', { p_id: id2, p_amount: 2000000 });
    let again = ''; try { await rpc('app_ca_cash_receive', { p_id: id2, p_amount: 2150000 }); again = 'ĐẾM MÙ LẦN 2 KHÔNG BỊ CHẶN'; } catch (e) { again = 'đếm mù lần 2: chặn'; }
    const giver = h1.prev_staff[0]?.id || (await rpc('app_ca_employees'))[0].id;
    const h2 = await rpc('app_ca_cash_recount', { p_id: id2, p_amount: 2100000, p_giver: giver });
    let again2 = ''; try { await rpc('app_ca_cash_recount', { p_id: id2, p_amount: 2150000, p_giver: giver }); again2 = 'ĐẾM LẠI LẦN 2 KHÔNG BỊ CHẶN'; } catch (e) { again2 = 'đếm lại lần 2: chặn'; }
    return `lần đầu ${h1.state} ${h1.gap} · ${again} · đếm lại ${h2.state} ${h2.gap} · ${again2} · báo: ${JSON.stringify(window.__LOG.filter((x) => x[0] === 'notify'))}`;
  });
  await step('Phiếu Chiều (quản lý xem): kết quả nhận két', async () => { await open('#/ca/phieu?id=' + id2 + '&ban=goc'); return txt('.hand-kv') + ' · ' + txt('#pc-form .alert.error'); });
  await step('Bản đối soát ca Sáng: lệch bàn giao cộng vào tiền mặt', async () => {
    await open('#/ca/phieu?id=' + id);
    return txt('#diff-box .diff-card') + ' || ' + txt('.diff-card.hand-bad');
  });
  await step('Bảng ca: ô ca Chiều có cảnh báo nhận két lệch', async () => {
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat'; await wait('.bc-grid'); await sleep(500);
    return $$('.bc-grid .bc').filter((b) => b.querySelector('.bc-hand')).map((b) => b.innerText.replace(/\s+/g, ' ')).join(' / ') || 'KHÔNG THẤY CẢNH BÁO';
  });
};
