// Chống tái phát lỗi 12/11: ở trang đối soát ca, sửa danh sách "nhân viên làm trong ca" (người nghỉ → có làm, người làm → nghỉ, thêm người hỗ trợ)
// thì khung "Nghỉ & làm thay" bên dưới phải tự đổi theo danh sách mới. Viết lại 29/11/2026 (anh Tiến chốt) cho trang đối soát ca mới:
// thẻ ① Phần việc — nút Sửa từng người (data-dsmst), "+ Thêm người hỗ trợ" (#dsm-staffadd), khung #dsm-cv. role=chu (confirm=1), index.html + test/phone.html.
// Kết quả: out[].cv50 = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const until = async (f, n = 100) => { for (let i = 0; i < n; i++) { try { if (f()) return true; } catch (_) { /* chờ */ } await sleep(100); } return false; };
  const txt = (el) => ((typeof el === 'string' ? $(el) : el)?.innerText || '').replace(/\s+/g, ' ').trim();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wide = (m) => { const w = document.documentElement.clientWidth;
    const o = $$('#root *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > w + 1 && !el.closest('.hub-tabs')).map((el) => `${el.tagName}.${String(el.className).slice(0, 30)}#${el.id}(${Math.round(el.getBoundingClientRect().right)})`).slice(0, 6);
    ok(document.documentElement.scrollWidth <= w + 1, `${m}: không tràn ngang (${document.documentElement.scrollWidth}/${w}${o.length ? ' · lòi ra: ' + o.join(', ') : ''})`); };
  const nghi = () => $$('#dsm-cv .cv-a'); const hotro = () => $$('#dsm-cv .cv-e');
  const names = (rows) => rows.map((x) => (x.querySelector('strong')?.innerText || '').split(' – ')[0].trim()).join(', ');
  const dlg = () => $$('dialog[open]').pop();
  const submit = async (d) => { d.querySelector('form').requestSubmit(); await until(() => !d.open, 80); await sleep(700); return txt(d.querySelector('.dsm-err2')); };
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc } = await import('../js/sb.js');
    window.__KT_XONG = true;   // ca thử coi như kế toán đã đủ số liệu (trang đọc được bản đối soát) — trường hợp chờ kế toán xem ghi chú cuối README
    const day = '2026-11-04';
    const ov = await rpc('app_ca_overview', { p_date: day });
    const id = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[0].shift });
    const R = await rpc('app_ca_get', { p_id: id });
    const emps = await rpc('app_ca_employees');
    const inCa = new Set((R.staff || []).map((s) => s.employee_id));
    const helper = emps.find((e) => !e.pay_cash && !inCa.has(e.id) && e.id !== 3 && e.id !== 5);
    // ca thử: người cuối trong lịch nghỉ, thêm 1 người hỗ trợ
    const staff = (R.staff || []).map((s, i, arr) => { const off = i === arr.length - 1; return { ...s, worked: !off, time_in: off ? null : '06:45', time_out: off ? null : '12:30', absent_reason: off ? 'Nghỉ' : null }; });
    staff.push({ employee_id: helper.id, source: 'ho_tro', worked: true, time_in: '06:30', time_out: '12:30' });
    await rpc('app_ca_save', { p_id: id, p: { rev_end: day + ' 12:30', total_revenue: 2000000, pos_cash: 1200000, pos_transfer: 800000, reported_transfer: 800000, cash_counted: 2200000, opening_cash: 1000000, ipos_opening: 1000000, cups: 80, pos_debt: 0, pos_diff: 0,
      moves: [], staff, handover: [], goods: [], debts: [] } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/doi-soat?id=' + id;
    await wait('#dsm-cv .cv-a', 200); await until(() => hotro().length > 0, 40); await sleep(600);
    const ghep = String(nghi()[0]?.querySelector('.cv-helper')?.value || '') === String(helper.id);   // 1 nghỉ + 1 hỗ trợ: web tự ghép người hỗ trợ làm thay cho người nghỉ
    ok(nghi().length === 1 && (hotro().length === 1 || ghep), `1. lúc mở: khung Nghỉ & làm thay có 1 người nghỉ và thấy người hỗ trợ (nghỉ ${nghi().length}: ${names(nghi())} · hỗ trợ đứng riêng ${hotro().length} · đã tự ghép làm thay: ${ghep})`);
    wide('1. thẻ Phần việc');
    // a. người nghỉ → Có làm
    const cur = async () => (await rpc('app_ca_get', { p_id: id })).staff || [];
    let L = await cur(); const iOff = L.findIndex((s) => !(s.worked === true || s.worked === 1));
    $(`[data-dsmst="${iOff}"]`).click(); await wait('dialog[open] form [name=worked]'); await sleep(300);
    { const d = dlg(); const f = d.querySelector('form'); f.worked.value = '1'; f.worked.dispatchEvent(new Event('change', { bubbles: true }));
      f.elements.in.value = '06:45'; f.elements.out.value = '12:30'; f.reason.value = 'Thử: người nghỉ thật ra có làm';
      const e = await submit(d); ok(!e, `2. đổi người nghỉ thành Có làm: lưu được (${e || 'không lỗi'})`); }
    await until(() => nghi().length === 0, 80); await sleep(500);
    ok(nghi().length === 0, `3. sau khi lưu, khung Nghỉ & làm thay hết người nghỉ — tự đổi theo danh sách mới (còn ${nghi().length}: ${names(nghi())})`);
    ok(hotro().length === 1, `3. người hỗ trợ vẫn còn 1 (${hotro().length})`);
    // b. một người đang làm → Phát sinh nghỉ
    L = await cur(); const iOn = L.findIndex((s) => (s.worked === true || s.worked === 1) && (s.source || 'lich') === 'lich'); const offCode = String(L[iOn].code || '');
    $(`[data-dsmst="${iOn}"]`).click(); await wait('dialog[open] form [name=worked]'); await sleep(300);
    { const d = dlg(); const f = d.querySelector('form'); f.worked.value = '0'; f.worked.dispatchEvent(new Event('change', { bubbles: true }));
      f.absent.value = 'Ốm'; f.reason.value = 'Thử: người này thật ra nghỉ';
      const e = await submit(d); ok(!e, `4. đổi một người đang làm thành Phát sinh nghỉ: lưu được (${e || 'không lỗi'})`); }
    await until(() => nghi().length === 1, 80); await sleep(500);
    const banDS = async () => ((await rpc('app_ca_recon', { p_id: id })).data.staff || []).filter((s) => !s.worked).map((s) => (emps.find((e) => e.id === s.employee_id) || {}).code || s.employee_id).join(', ');
    const tren = () => $$('.dsm-st').filter((x) => /nghỉ/i.test(x.innerText)).map((x) => txt(x).slice(0, 24)).join(' | ');
    ok(nghi().length === 1 && names(nghi()) === offCode, `5. khung Nghỉ & làm thay hiện đúng người vừa cho nghỉ (khung: ${names(nghi())} / cần ${offCode} · bản đối soát đang ghi nghỉ: ${await banDS()} · danh sách phía trên ghi nghỉ: ${tren()})`);
    // c. thêm người hỗ trợ
    const h0 = hotro().length; let themMa = '';
    $('#dsm-staffadd').click(); await wait('dialog[open] form [name=in]'); await sleep(600);
    { const d = dlg(); const f = d.querySelector('form'); const emp = f.emp; let picked = '';
      if (emp && emp.tagName === 'SELECT') { const o = [...emp.options].find((x) => x.value); if (o) { emp.value = o.value; emp.dispatchEvent(new Event('change', { bubbles: true })); picked = o.textContent.trim(); } }
      else { const it = d.querySelector('[data-pick], [data-emp], .cm-hp-it'); if (it) { it.click(); picked = txt(it); } }
      await sleep(300); f.elements.in.value = '07:00'; f.elements.out.value = '11:00'; f.reason.value = 'Thử: thêm người hỗ trợ';
      const e = await submit(d); ok(!!picked && !e, `6. thêm người hỗ trợ: chọn được người và lưu được (${picked.slice(0, 40) || 'KHÔNG chọn được'} · ${e || 'không lỗi'})`); themMa = picked.split(' – ')[0].trim(); if (d.open) d.close(); }
    await until(() => names(hotro()).split(', ').includes(themMa), 80); await sleep(500);
    ok(!!themMa && names(hotro()).split(', ').includes(themMa), `7. khung Nghỉ & làm thay có người hỗ trợ vừa thêm (${themMa}) — trước ${h0} người đứng riêng, nay ${hotro().length}: ${names(hotro())}`);
    // d. Lưu phân loại trên danh sách mới không báo lỗi
    { const a = nghi()[0]; if (a) { const sel = a.querySelector('.cv-reason'); const o = [...sel.options].find((x) => x.value && !/bo_ca/.test(x.value)); sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      const sv = $('#dsm-cv #cv-save'); ok(!!sv, '8. có nút Lưu phân loại'); sv?.click(); await sleep(1800);
      ok(!txt('#dsm-cv #cv-err'), `9. Lưu phân loại theo danh sách mới: không báo lỗi (${txt('#dsm-cv #cv-err') || 'không lỗi'})`);
      const C = await rpc('app_cv_get', { p_id: id }); const rowsA = (C.rows || C.absent || []);
      ok(nghi().length === 1 && names(nghi()) === offCode, `10. sau Lưu phân loại khung vẫn đúng 1 người nghỉ ${offCode} (${names(nghi())}; máy chủ: ${JSON.stringify(rowsA).slice(0, 80)})`); }
    wide('10. thẻ Phần việc sau khi sửa');
  } catch (e) { bad.push('LỖI: bài thử dừng giữa chừng — ' + (e.stack || e.message || e)); }
  out.push({ cv50: { ok: good, fail: bad } });
};
