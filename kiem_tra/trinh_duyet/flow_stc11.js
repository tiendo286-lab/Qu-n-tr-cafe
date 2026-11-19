// Bài thử bước 163: ô Ca trong "+ Thêm phiếu" (Sổ thu chi) đi theo ô Ngày.
// Chạy: index.html?auto=1&role=chu&confirm=1&script=flow_stc11 và test/phone.html?... Kết quả: out[].stc11 = { ok, fail }.
// Dữ liệu giả: 17/11 có Sáng 171, Chiều 172 (chưa xác nhận Fabi), Tối 173; 05/11 không có ca.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 120) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const calls = (name, k0) => (window.__LOG || []).slice(k0).filter((x) => x[0] === 'rpc' && x[1] === name);
  const P = () => $('.stc-addp'); const el = (n) => $(`[name=${n}]`, P());
  const opts = () => $$('option', el('ca')).map((o) => ({ v: o.value, t: txt(o), d: o.disabled }));
  const SO = '#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11';
  const openAdd = async () => { location.hash = SO + '&t=' + Date.now(); await wait('.stc-ch .stc-add'); await sleep(300); $('.stc-ch .stc-add').click(); await wait('.stc-addp [name=ca]', 60); await sleep(200); };
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    // 1. Ngày 17/11: Ngoài ca + Sáng → Chiều → Tối, không có ca ngày khác
    await openAdd();
    setv(el('date'), '2026-11-17'); await sleep(150);
    const o = opts();
    ok(o.length === 4 && o[0].v === '' && o[0].t === 'ngoài ca' && ['171', '172', '173'].every((id, i) => o[i + 1].v === id), '1. ngày 17/11: Ngoài ca + Sáng → Chiều → Tối (' + o.map((x) => x.v || 'ngoài').join(',') + ')');
    ok(o[1].t.startsWith('ca sáng · ') && !o[1].d, '1. "Ca Sáng · <người làm>", chọn được');
    ok(o[2].d && o[2].t.includes('chưa xác nhận fabi'), '2. ca chưa xác nhận Fabi mờ, ghi "chưa xác nhận Fabi"');
    ok(!$('.stc-canote', P()) || $('.stc-canote', P()).hidden || !txt($('.stc-canote', P())), '2. ngày có ca chọn được thì không hiện dòng nhắc');
    // 3. ngày không có ca
    setv(el('date'), '2026-11-05'); await sleep(150);
    ok(opts().length === 1 && txt($('.stc-canote', P())).includes('ngày 05/11 chưa có ca nào xác nhận fabi'), '3. ngày không có ca: chỉ "Ngoài ca" + dòng "Ngày 05/11 chưa có ca nào xác nhận Fabi"');
    // 4. chọn ca rồi đổi ngày → về Ngoài ca, ô Ngày không khoá
    setv(el('date'), '2026-11-17'); await sleep(100); setv(el('ca'), '171'); await sleep(100);
    ok(!el('date').disabled && el('reason').placeholder.includes('bắt buộc khi thêm vào ca'), '4. chọn ca: ô Ngày vẫn sửa được, Lý do bắt buộc');
    setv(el('date'), '2026-11-16'); await sleep(150);
    ok(el('ca').value === '' && el('reason').placeholder === 'không bắt buộc', '4. đổi Ngày → ô Ca về "Ngoài ca", Lý do không bắt buộc');
    // 5. Loại Cho nợ → ô Ca khoá; đổi lại Khoản chi → mở, vẫn theo ngày
    setv(el('kind'), 'no'); await sleep(100);
    ok(el('ca').disabled, '5. Loại Cho nợ → ô Ca khoá');
    setv(el('kind'), 'chi'); await sleep(100);
    ok(!el('ca').disabled && opts().every((x) => !x.v || ['161', '162', '163'].includes(x.v)), '5. đổi lại Khoản chi → ô Ca mở, vẫn là ca của 16/11');
    if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `5. khung Thêm phiếu không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`);
    // 6. Lưu sau khi chọn ca rồi đổi ngày → ghi NGOÀI ca (không gửi app_stc_move_save)
    setv(el('date'), '2026-11-17'); await sleep(100); setv(el('ca'), '171'); await sleep(100); setv(el('date'), '2026-11-16'); await sleep(100);
    setv(el('note'), 'Mua đá thử'); setv(el('amount'), '30000'); const cat = el('cat'); if (cat && cat.tagName === 'SELECT') setv(cat, cat.options[1]?.value || '');
    const k0 = (window.__LOG || []).length; $('button[type=submit]', P()).click(); await sleep(1200);
    ok(!calls('app_stc_move_save', k0).length && calls('app_stc_entry_save', k0).length === 1, '6. chọn ca rồi đổi ngày → Lưu ghi ngoài ca, không gắn vào ca cũ');
    // 7. bấm nút thêm trong dòng một ca cũ → Ngày = ngày ca, chọn sẵn ca đó
    location.hash = SO + '&t=' + Date.now(); await wait('.stc-ch .stc-all'); await sleep(300); $('.stc-ch .stc-all').click(); await sleep(400);
    const b = $('[data-addca="161"]');
    if (b) { b.click(); await wait('.stc-addp [name=ca]', 60); await sleep(200);
      ok(el('date').value === '2026-11-16' && el('ca').value === '161', '7. thêm từ dòng ca Sáng 16/11 → Ngày 16/11, chọn sẵn ca Sáng (' + el('date').value + ' / ' + el('ca').value + ')'); }
    else bad.push('7. không thấy nút thêm trong dòng ca 161');
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.message || e)); }
  out.push({ stc11: { ok: good, fail: bad } });
};
