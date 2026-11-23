// Bài thử "+ Thêm phiếu" ở Sổ thu chi. Bước 163 (ô Ca theo ô Ngày) đã thay bằng chặng 6.3d (anh Tiến chọn 23/11):
// Sổ thu chi luôn ghi NGOÀI ca — không có ô Ca; phiếu trong ca thêm ở trang đối soát của ca (dòng ca trong sổ có đường dẫn sang).
// Chạy: index.html?auto=1&role=chu&confirm=1&script=flow_stc11 và test/phone.html?... Kết quả: out[].stc11 = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 120) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const calls = (name, k0) => (window.__LOG || []).slice(k0).filter((x) => x[0] === 'rpc' && x[1] === name);
  const P = () => $('.stc-addp'); const el = (n) => $(`[name=${n}]`, P());
  const caHidden = () => { const l = el('ca')?.closest('label'); return !l || l.hidden; };
  const SO = '#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11';
  const openAdd = async () => { location.hash = SO + '&t=' + Date.now(); await wait('.stc-ch .stc-add'); await sleep(300); $('.stc-ch .stc-add').click(); await wait('.stc-addp', 60); await sleep(200); };
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    if (new URLSearchParams(location.search).get('stclock')) {   // tháng đã chốt (&stclock=1): vẫn không có ô Ca
      await openAdd(); setv(el('date'), '2026-11-17'); await sleep(150);
      ok(caHidden(), '9. tháng đã chốt: không có ô Ca');
      out.push({ stc11: { ok: good, fail: bad } }); return;
    }
    { const sb = (await import('/js/sb.js')).sb; for (const id of [171, 161]) await sb.rpc('app_stc_ds_undone', { p_report: id }); }
    // 1. không có ô Ca ở mọi loại
    await openAdd();
    setv(el('date'), '2026-11-17'); await sleep(150);
    ok(caHidden(), '1. Khoản chi: không có ô Ca (Sổ thu chi luôn ngoài ca)');
    for (const k of ['no', 'lc', 'chi']) { setv(el('kind'), k); await sleep(120); ok(caHidden(), `1. loại ${k}: vẫn không có ô Ca`); }
    ok(el('reason').placeholder === 'không bắt buộc', '2. Lý do không bắt buộc (ghi ngoài ca)');
    if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `2. khung Thêm phiếu không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`);
    // 3. Lưu → ghi ngoài ca (app_stc_entry_save, không app_stc_move_save)
    setv(el('note'), 'Mua đá thử'); setv(el('amount'), '30000'); const cat = el('cat'); if (cat && cat.tagName === 'SELECT') setv(cat, cat.options[1]?.value || '');
    const k0 = (window.__LOG || []).length; $('button[type=submit]', P()).click(); await sleep(1200);
    ok(!calls('app_stc_move_save', k0).length && calls('app_stc_entry_save', k0).length === 1, '3. Lưu ghi ngoài ca, không gắn vào ca');
    // 4. xem tháng khác → ô Ngày sẵn ngày đầu tháng đó
    location.hash = '#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-10&t=' + Date.now(); await wait('.stc-ch .stc-add'); await sleep(300); $('.stc-ch .stc-add').click(); await wait('.stc-addp', 60); await sleep(200);
    ok(el('date').value === '2026-10-01', '4. xem sổ tháng 10 → ô Ngày điền sẵn 01/10 (' + el('date').value + ')');
    // 5. dòng một ca trong sổ: đường dẫn "+ Thêm phiếu … ở trang đối soát ca ›", không còn nút thêm vào ca tại sổ
    location.hash = SO + '&t=' + Date.now(); await wait('.stc-ch .stc-all'); await sleep(300); $('.stc-ch .stc-all').click(); await sleep(400);
    const lk = $$('a.stc-addca-go').find((a) => a.getAttribute('href').includes('#/ca/doi-soat?id=161'));
    ok(!!lk && txt(lk).includes('trang đối soát ca'), '5. dòng ca Sáng 16/11 có đường dẫn sang trang đối soát ca: ' + (lk ? txt(lk) : '-'));
    ok(!$$('button.stc-addca[data-addca]').some((b) => !b.disabled), '5. Sổ thu chi không còn nút thêm phiếu vào ca tại sổ');
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.message || e)); }
  out.push({ stc11: { ok: good, fail: bad } });
};
