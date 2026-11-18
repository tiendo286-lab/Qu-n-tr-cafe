// Bước 132: mỗi ảnh nhận hàng tối đa 4 món. role=chu (confirm=1), index.html + test/phone.html. Không dùng dữ liệu thật.
// Phiếu xuất thử 6 món → chụp ảnh → tick 4 món: các ô còn lại khoá, có dòng nhắc; lưu 4 món được; ảnh 2 chọn được 2 món còn lại.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 1500) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const fails = [], seen = []; const check = (ok, l) => { (ok ? seen : fails).push((ok ? '✓ ' : '✗ ') + l); };
  const shoot = async () => {
    const c = document.createElement('canvas'); c.width = 40; c.height = 30; c.getContext('2d').fillRect(0, 0, 20, 20);
    const b = await new Promise((ok) => c.toBlob(ok, 'image/jpeg'));
    const inp = $('#gh-shot'); const dt = new DataTransfer(); dt.items.add(new File([b], 'a.jpg', { type: 'image/jpeg' })); inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true })); await wait('#gh-pick .gh-sel', 50); await sleep(400);
  };
  const tick = (row) => { const c = row.querySelector('.gh-c'); if (!c.checked && !c.disabled) c.click(); };
  try {
    await wait('#root .appbar, #root .page-head', 600); await sleep(2500); $('#rm-close')?.click();
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const me = await rpc('app_me'); me.perms.ke_toan = true;
    const lines = Array.from({ length: 6 }, (_, i) => ({ code: 'G' + i, name: 'Món thử ' + (i + 1), unit: 'Hộp', qty: 2, price: 0, amount: 0 }));
    await rpc('app_nh_create', { p: { branch_id: 1, doc_no: 'PX4MON', ship_at: day + ' 08:15', total: 0, lines } });
    delete me.perms.ke_toan;
    location.hash = '#/hang-hoa/nhan'; await wait('.gh-wrap'); await sleep(1500);
    const big = $$('.gh-hero .gh-big, .gh-big').find((b) => /PX4MON/.test(txt(b.closest('.gh-hero, .card') || b))) || $('.gh-hero .gh-big');
    big?.click(); await wait('#gh-shot'); await sleep(800);
    await shoot();
    const rows = $$('#gh-pick .gh-sel');
    check(rows.length >= 6, 'Ảnh 1: có ' + rows.length + ' món để chọn');
    rows.slice(0, 4).forEach(tick); await sleep(300);
    const pick = $('#gh-pick');
    check(rows.slice(4).every((r) => r.querySelector('.gh-c').disabled), 'Đủ 4 món: các ô còn lại bị khoá');
    check(/Mỗi ảnh tối đa 4 món/.test(txt(pick)), 'Có dòng nhắc "Mỗi ảnh tối đa 4 món"');
    check(!$$('.gh-nadd', pick).some((b) => b.offsetParent !== null), 'Đủ 4 món: ẩn nút "+ Thêm món ngoài phiếu"');
    rows[0].querySelector('.gh-c').click(); await sleep(200);
    check(!rows[5].querySelector('.gh-c').disabled, 'Bỏ 1 món: ô khác mở lại');
    rows[0].querySelector('.gh-c').click(); await sleep(200);
    $('#gh-ps').click(); await sleep(2500);
    check(!$('#gh-pick .gh-sel') && !txt($('#gh-pick .gh-err')), 'Lưu ảnh 4 món được' + (txt($('#gh-pick .gh-err')) ? ' — lỗi: ' + txt($('#gh-pick .gh-err')) : ''));
    await shoot();
    const rows2 = $$('#gh-pick .gh-sel');
    check(rows2.length === 2, 'Ảnh 2: còn 2 món chưa chụp (' + rows2.length + ')');
    check(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, 'Không tràn ngang');
  } catch (e) { fails.push('LỖI ' + (e.stack || e)); }
  out.push({ route: 'gh4', title: seen.join(' · '), errs: fails });
};
