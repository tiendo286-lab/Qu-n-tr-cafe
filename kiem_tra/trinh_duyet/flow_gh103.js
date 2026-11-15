// Bước 103: Giao hàng kho tổng — thẻ "có hàng đang chuyển tới" ở trang Chốt ca → nhận hàng: chụp ảnh → chọn món trong ảnh (sửa số + ghi chú)
// → lặp tới hết → "Không nhận được" → gửi; quản lý đối soát theo từng ảnh (Đúng cả ảnh / Sai số); phiếu chốt ca + đối soát ca chỉ còn tóm tắt.
// role=chu (confirm=1). Không dùng dữ liệu thật.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 1500) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const setFiles = (inp, files) => { const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); };
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(300); location.hash = h; await wait(sel); await sleep(1000); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = []; window.confirm = () => true;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day }); const o = ov.find((x) => x.branch_id === 1) || ov[0];
    const rid = await rpc('app_ca_open', { p_branch: 1, p_date: day, p_shift: o.shift });
    const id = await rpc('app_nh_create', { p: { branch_id: 1, doc_no: 'PXT103', ship_at: day + ' 08:15', total: 300000, lines: [
      { code: 'A1', name: 'Sữa đặc thử', unit: 'Hộp', qty: 10, price: 20000, amount: 200000 }, { code: 'A2', name: 'Đường thử', unit: 'Kg', qty: 5, price: 10000, amount: 50000 },
      { code: 'A3', name: 'Cà phê thử', unit: 'Gói', qty: 2, price: 20000, amount: 40000 }, { code: 'A4', name: 'Khăn giấy thử', unit: 'Gói', qty: 1, price: 10000, amount: 10000 }] } });
    const cv = document.createElement('canvas'); cv.width = 60; cv.height = 40; cv.getContext('2d').fillRect(0, 0, 60, 40);
    const img = () => new Promise((ok) => cv.toBlob((b) => ok(new File([b], 'hang.png', { type: 'image/png' })), 'image/png'));
    // trang Chốt ca: thẻ nổi
    await go('#/ca', '#gh-home'); for (let i = 0; i < 600 && !$('#gh-home .gh-hero'); i++) await sleep(100);
    r.push(`thẻ Chốt ca: ${txt('#gh-home') || 'KHÔNG CÓ'}`);
    // nhận hàng
    await go('#/quan-ly/giao-hang?nhan=' + id, '#gh-recv .gh-prog');
    r.push(`mở nhận: ${txt('#gh-recv h1')} · ${txt('.gh-prog')} · nút chụp ${!!$('#gh-shot')} · chưa nhận ${$$('.gh-li').length} món · ${W()}`);
    setFiles($('#gh-shot'), [await img()]); await wait('.gh-pickc'); await sleep(300);
    const sel = (name) => $$('.gh-sel').find((x) => x.innerText.includes(name));
    r.push(`chọn món: ${$$('.gh-sel').length} món · số trước khi tick ô bị khoá ${sel('Sữa').querySelector('.gh-q').disabled}`);
    const tick = (name) => { const c = sel(name).querySelector('.gh-c'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); };
    tick('Sữa'); tick('Đường');
    r.push(`sau tick: Sữa ${sel('Sữa').querySelector('.gh-q').value} · Đường ${sel('Đường').querySelector('.gh-q').value} · nút ${txt('#gh-ps')}`);
    setv(sel('Đường').querySelector('.gh-q'), '4'); await sleep(200);
    $('#gh-ps').click(); await sleep(400);
    r.push(`thiếu ghi chú: ${txt('.gh-err')} · ô ghi chú hiện ${!$('.gh-note[hidden] input') || !$$('.gh-note').find((n) => !n.hidden) ? '?' : 'có'}`);
    setv($$('.gh-note').find((n) => !n.hidden).querySelector('input'), 'thiếu 1 bao'); $('#gh-ps').click(); await sleep(2500); await wait('.gh-th');
    r.push(`lưu ảnh 1: ${txt('.gh-prog')} · ảnh ${$$('.gh-th').length} · chưa nhận ${$$('.gh-li').length} · lệch: ${txt('.gh-li .st-meta')}`);
    setFiles($('#gh-shot'), [await img()]); await wait('.gh-pickc'); await sleep(300);
    r.push(`ảnh 2 chỉ hiện món chưa nhận: ${$$('.gh-sel').map((x) => x.querySelector('b').innerText).join(', ')}`);
    tick('Cà phê'); $('#gh-ps').click(); await sleep(2500);
    $$('.gh-none').find((b) => b.closest('.gh-li').innerText.includes('Khăn')).click(); await wait('dialog[open] form'); await sleep(200);
    let f = $$('dialog[open] form').pop(); f.requestSubmit(); await sleep(300); r.push(`không nhận được thiếu ghi chú: ${txt('dialog[open] .gh-err')}`);
    f.nt.value = 'không có trong thùng'; f.requestSubmit(); await sleep(800);
    r.push(`hết món: ${txt('.gh-prog')} · ${txt('#gh-recv .alert.ok')} · nút gửi ${txt('#gh-send')}`);
    $('#gh-send').click(); await sleep(3000); await wait('.gh-tabs, .gh-hero, .card');
    const L = (await rpc('app_nh_list', { p_month: day.slice(0, 7), p_branch: 1 })).rows.find((x) => x.id === id);
    r.push(`máy chủ sau gửi: ${L.state} · nhận ${L.lines.map((l) => l.name.split(' ')[0] + '=' + l.qty_received).join(' ')} · ${L.photos.length} ảnh · ghi chú: ${L.receive_note} · sau gửi về ${location.hash}`);
    // phiếu chốt ca: chỉ tóm tắt
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: rid, p_part: k, p_force: false }).catch(() => {});
    try { sessionStorage.setItem('cm:' + rid, JSON.stringify({ code: 8 })); } catch (_) { /* bỏ qua */ }
    await go('#/ca/phieu?id=' + rid, '.page-head'); for (let i = 0; i < 600 && !$('#cm-hd .gh-sum, #cm-hd .st-meta'); i++) await sleep(100); await sleep(800);
    r.push(`phiếu chốt ca: khung nhận hàng cũ ${!!$('.nh-card')} · tóm tắt ${txt('#cm-hd') || txt('#hd-box') || '(bước khác)'}`);
    // quản lý: danh sách + đối soát theo ảnh
    await go('#/quan-ly/giao-hang?cn=1', '.gh-tabs');
    r.push(`trang QL: ${$$('.gh-tabs a').map((a) => a.innerText.replace(/\s+/g, ' ')).join(' | ')} · thẻ: ${txt('.gh-card').slice(0, 140)} · ${W()}`);
    await go('#/quan-ly/giao-hang?ds=' + id, '.gh-pc');
    r.push(`đối soát: ${txt('#gh-ds .gh-prog')} · ảnh đầu: ${txt('.gh-pc .gh-ch')} · ${$$('.gh-pc').length} khung · ghi chú NV: ${txt('#gh-ds .alert.warn').slice(0, 90)}`);
    $$('.gh-dl').find((x) => x.innerText.includes('Đường')).querySelector('.gh-fix').click(); await wait('dialog[open] form'); await sleep(200);
    f = $$('dialog[open] form').pop(); f.q.value = '5'; f.nt.value = 'đếm lại đủ 5'; f.requestSubmit(); await sleep(1500);
    $$('.gh-all')[0]?.click(); await sleep(2000);
    for (const b of $$('.gh-one')) { b.click(); await sleep(1200); }
    const L2 = (await rpc('app_nh_list', { p_month: day.slice(0, 7), p_branch: 1 })).rows.find((x) => x.id === id);
    r.push(`sau đối soát: ${txt('#gh-ds .gh-prog')} · ${txt('#gh-ds .alert.ok').slice(0, 120)} · máy chủ còn ${L2.n_unchecked} món chưa đối soát · Đường QL ${L2.lines.find((l) => l.name.startsWith('Đường')).qty_checked} · ${W()}`);
    // đối soát ca: chỉ tóm tắt
    await go('#/quan-ly/doi-soat/ca?id=' + rid + '&buoc=3', '.page-head'); for (let i = 0; i < 300 && !$('#hd-box .gh-sum'); i++) await sleep(100);
    r.push(`đối soát ca: khung cũ ${!!$('.nh-card')} · tóm tắt ${txt('#hd-box') || 'KHÔNG'}`);
    if (new URLSearchParams(location.search).get('dung')) { await go('#/quan-ly/giao-hang?nhan=' + id, '#gh-recv'); await new Promise(() => {}); }
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'giao hàng kho tổng 103', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
