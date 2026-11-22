// Chặng 4 (anh Tiến chốt 22/11 "Báo đỏ và chặn", máy chủ tệp 162): Nợ bill của ca phải bằng danh sách khách nợ hoá đơn của ca.
//  Ca 182 (chưa xác nhận): máy 150.000 > danh sách 120.000 → "Lấy số máy Fabi" bắt chọn người nợ phần chênh 30.000; chọn rồi → ô Nợ xanh.
//  Ca 181 (đã xác nhận): Nợ bill 0 nhưng danh sách 100.000 → ghi chú "ca đã xác nhận Fabi; muốn sửa: Mở lại xác nhận".
// Chạy role chu / qlt / ql, index.html và test/phone.html, confirm=1. Kết quả: out[].stc18 = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s);
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wait = async (s, n = 60) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const gone = async (s, n = 60) => { for (let i = 0; i < n && $(s); i++) await sleep(100); return !$(s); };
  const type = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const DS = '#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11';
  const open = async (ca, b = 1) => { location.hash = '#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-10&t=' + Date.now(); await sleep(500);
    location.hash = DS + '&ds=' + ca + '&b=' + b + '&t=' + Date.now(); await sleep(400); await wait('.stc-dsp'); await sleep(500); };
  const box = () => $('.stc-dsp .stc-c4[data-k="no"]');
  const dlg = () => $('dialog[open]');
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    await open(182);
    const b0 = box();
    ok(b0?.classList.contains('red') && txt(b0).includes('lấy số máy fabi (thêm báo nợ 30.000)'), '1. ca 182: ô Nợ đỏ, nút "Lấy số máy Fabi (thêm báo nợ 30.000)" — phần chênh tính theo danh sách');
    b0.querySelector('[data-dsfabi="no"]').click(); await wait('dialog[open] select[name=name]', 40); await sleep(200);
    ok(txt(dlg()).includes('bắt buộc') && txt(dlg()).includes('30.000'), '2. hộp Lấy số máy: người nợ phần chênh 30.000 là bắt buộc');
    $('button[type=submit]', dlg()).click(); await sleep(600);
    ok(!!dlg() && txt($('.stc-err', dlg())).includes('chọn người nợ phần chênh'), '3. chưa chọn người → báo, hộp vẫn mở');
    if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1 && dlg().getBoundingClientRect().right <= window.innerWidth + 1, '3b. hộp không tràn ngang 390px');
    type($('select[name=name]', dlg()), 'Bàn 5'); $('button[type=submit]', dlg()).click(); await gone('dialog[open] select[name=name]', 40); await sleep(900); await wait('.stc-dsp'); await sleep(400);
    ok(box()?.classList.contains('ok'), '4. chọn người → Nợ bill = danh sách = 150.000 → ô Nợ xanh');
    await open(181);
    const w = [...document.querySelectorAll('.stc-dsp .stc-warnbox')].find((x) => txt(x).includes('danh sách khách nợ hoá đơn'));
    ok(!!w && txt(w).includes('100.000') && txt(w).includes('mở lại xác nhận'), '5. ca 181 đã xác nhận, Nợ bill 0 ≠ danh sách 100.000 → ghi chú, không mở lại');
    if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `6. không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`);
  } catch (e) { bad.push('LỖI CHẠY: ' + (e?.message || e) + ' · ' + txt($('dialog[open] .stc-err'))); }
  out.push({ stc18: { ok: good, fail: bad } });
};
