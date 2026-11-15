// Bước 104: menu Hàng hoá tách hẳn khỏi chốt ca — Nhận hàng (không cần phiếu chốt ca: chụp ảnh → chọn món → lặp → gửi; không hoá đơn),
// Đối soát (theo từng ảnh), Kiểm soát (thiếu → chờ giao bù, thừa → chờ hoá đơn bổ sung, tiền tháng), đường dẫn cũ tự chuyển; Chốt ca / phiếu ca không còn khung hàng.
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
    const id = await rpc('app_nh_create', { p: { branch_id: 1, doc_no: 'PXT104', ship_at: day + ' 08:15', total: 300000, lines: [
      { code: 'A1', name: 'Sữa đặc thử', unit: 'Hộp', qty: 10, price: 20000, amount: 200000 }, { code: 'A2', name: 'Đường thử', unit: 'Kg', qty: 5, price: 10000, amount: 50000 },
      { code: 'A3', name: 'Cà phê thử', unit: 'Gói', qty: 2, price: 20000, amount: 40000 }, { code: 'A4', name: 'Khăn giấy thử', unit: 'Gói', qty: 1, price: 10000, amount: 10000 }] } });
    const cv = document.createElement('canvas'); cv.width = 60; cv.height = 40; cv.getContext('2d').fillRect(0, 0, 60, 40);
    const img = () => new Promise((ok) => cv.toBlob((b) => ok(new File([b], 'hang.png', { type: 'image/png' })), 'image/png'));
    // menu
    await go('#/hang-hoa/nhan', '.gh-wrap');
    r.push(`menu Hàng hoá: ${$$('.hub-tabs a').map((a) => a.innerText.replace(/\s+/g, ' ')).join(' | ')} · Quản lý ca còn Giao hàng: ${/Giao hàng/.test(txt('.sidebar'))} · ${W()}`);
    r.push(`trang Nhận hàng: ${$$('.branch-tabs a').map((a) => a.innerText.replace(/\s+/g, ' ')).join(' ')} · thẻ: ${txt('.gh-hero').slice(0, 90)} · nút không HĐ ${!!$('.gh-nohd')}`);
    // Chốt ca không còn thẻ hàng
    await go('#/ca', '.cw-bar'); r.push(`Chốt ca còn thẻ hàng: ${!!$('#gh-home, .gh-hero')}`);
    // đường dẫn cũ
    location.hash = '#/quan-ly/giao-hang?nhan=' + id; await wait('#gh-recv .gh-prog'); await sleep(800);
    r.push(`link cũ → ${location.hash.split('?')[0]}`);
    location.hash = '#/ke-toan/hoa-don?cn=1'; for (let i = 0; i < 100 && !location.hash.startsWith('#/hang-hoa'); i++) await sleep(100); await sleep(800);
    r.push(`link cũ kế toán → ${location.hash.split('?')[0]}`);
    // nhận hàng KHÔNG cần mở phiếu chốt ca
    await go('#/hang-hoa/nhan?nhan=' + id, '#gh-recv .gh-prog');
    r.push(`mở nhận: ${txt('#gh-recv h1')} · ${txt('#gh-recv .sub')} · ${txt('.gh-prog')} · ${W()}`);
    const sel = (name) => $$('.gh-sel').find((x) => x.innerText.includes(name));
    const tick = (name) => { const c = sel(name).querySelector('.gh-c'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); };
    setFiles($('#gh-shot'), [await img()]); await wait('.gh-pickc'); await sleep(300);
    tick('Sữa'); tick('Đường'); setv(sel('Đường').querySelector('.gh-q'), '4'); await sleep(200);
    setv($$('.gh-note').find((n) => !n.hidden).querySelector('input'), 'thiếu 1 bao'); $('#gh-ps').click(); await sleep(2500); await wait('.gh-th');
    setFiles($('#gh-shot'), [await img()]); await wait('.gh-pickc'); await sleep(300);
    tick('Cà phê'); setv(sel('Cà phê').querySelector('.gh-q'), '3'); await sleep(200);
    setv($$('.gh-note').find((n) => !n.hidden).querySelector('input'), 'kho giao dư 1 gói'); $('#gh-ps').click(); await sleep(2500);
    $$('.gh-none').find((b) => b.closest('.gh-li').innerText.includes('Khăn')).click(); await wait('dialog[open] form'); await sleep(200);
    let f = $$('dialog[open] form').pop(); f.nt.value = 'không có trong thùng'; f.requestSubmit(); await sleep(800);
    await wait('#gh-dshot', 300); setFiles($('#gh-dshot'), [await img()]); await sleep(3000); await wait('#gh-send', 300); 
    r.push(`hết món: ${txt('.gh-prog')} · nút ${txt('#gh-send')}`);
    $('#gh-send').click(); await sleep(3000); await wait('.gh-wrap .card');
    let G = await rpc('app_gh_inbox', { p_branch: 1 }); let D = G.rows.find((x) => x.id === id);
    r.push(`sau gửi: ${D.state} · phiếu ca ${D.received_report_id ?? 'không gắn'} · ${D.lines.map((l) => l.name.split(' ')[0] + '=' + l.qty_received).join(' ')} · ${D.photos.length} ảnh · về ${location.hash}`);
    // nhận không hoá đơn (bước 104b): chụp trước → ghi tên + số lượng món trong ảnh → lặp → Xong
    await go('#/hang-hoa/nhan?cn=1', '.gh-nohd'); $('.gh-nohd').click(); await wait('#gh-recv .gh-prog'); await sleep(800);
    r.push(`không HĐ mở: ${txt('#gh-recv h1')} · ${txt('#gh-recv .sub')} · ${txt('.gh-prog')} · nút chụp ${!!$('#gh-shot')} · nút Xong ${!!$('#gh-send')}`);
    const fill = (row, n, u, q) => { row.querySelector('.gh-nn').value = n; row.querySelector('.gh-nu').value = u; setv(row.querySelector('.gh-nq'), q); };
    setFiles($('#gh-shot'), [await img()]); await wait('.gh-pickc'); await sleep(300);
    $('#gh-ps').click(); await sleep(300); r.push(`ảnh trống: ${txt('.gh-err')}`);
    fill($$('.gh-nr')[0], 'Ống hút thử', '', ''); $('#gh-ps').click(); await sleep(300); r.push(`thiếu SL: ${txt('.gh-err')}`);
    fill($$('.gh-nr')[0], 'Ống hút thử', 'Gói', '2'); $('#gh-ps').click(); await sleep(3000); await wait('.gh-th');
    r.push(`ảnh 1: ${txt('.gh-prog')} · link ${location.hash} · ${$$('.gh-li').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / ')}`);
    setFiles($('#gh-shot'), [await img()]); await wait('.gh-pickc'); await sleep(300);
    $('.gh-nadd').click(); await sleep(200); fill($$('.gh-nr')[0], 'Đá viên thử', 'Bao', '3'); fill($$('.gh-nr')[1], 'Ly giấy thử', 'Cây', '1,5');
    r.push(`nút lưu: ${txt('#gh-ps')}`); $('#gh-ps').click(); await sleep(3000);
    r.push(`ảnh 2: ${txt('.gh-prog')} · ${$$('.gh-li').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / ')} · ${W()}`);
    $$('.gh-th')[1].click(); await wait('dialog[open] #gh-pdel'); await sleep(300); $('dialog[open] #gh-pdel').click(); await sleep(2500);
    r.push(`xoá ảnh 2: ${txt('.gh-prog')} · ${$$('.gh-li').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / ')}`);
    $$('.gh-th')[0].click(); await wait('dialog[open] #gh-pdel'); await sleep(300); $('dialog[open] #gh-pdel').click(); await sleep(800);
    r.push(`xoá ảnh cuối: ${txt('dialog[open] .gh-err')}`); document.querySelectorAll('dialog[open]').forEach((x) => x.close()); await sleep(300);
    await wait('#gh-dshot', 300); setFiles($('#gh-dshot'), [await img()]); await sleep(3000); await wait('#gh-send', 300); setv($('#gh-anote'), 'tài xế giao, chưa có phiếu'); $('#gh-send').click(); await sleep(3000);
    G = await rpc('app_gh_inbox', { p_branch: 1 }); const K = G.rows.find((x) => x.kind === 'khong_hd');
    r.push(`không HĐ máy chủ: ${K.state} · ${K.lines.map((l) => l.name + '=' + l.qty_received + ' ' + (l.unit || '')).join(', ')} · ${K.photos.length} ảnh · ghi chú ${K.receive_note} · về ${location.hash}`);
    // đối soát
    await go('#/hang-hoa/doi-soat?cn=1', '.gh-tabs');
    r.push(`trang Đối soát: ${$$('.gh-tabs a').map((a) => a.innerText.replace(/\s+/g, ' ')).join(' | ')} · ${W()}`);
    await go('#/hang-hoa/doi-soat?ds=' + id, '.ds-top');
    for (let k = 0; k < 8 && $('.gh-one, .gh-all'); k++) { $('.gh-one, .gh-all').click(); await sleep(1200); }
    $('#gh-done').click(); await sleep(3000);
    r.push(`đối soát xong: ${(await rpc('app_nh_list', { p_month: day.slice(0, 7), p_branch: 1 })).rows.find((x) => x.id === id).recon_at ? 'đã xác nhận' : 'CHƯA'} · về ${location.hash}`);
    // kiểm soát
    await go('#/hang-hoa/kiem-soat?cn=1', '.ks-wrap');
    r.push(`Kiểm soát: ${$$('.ks-h').map((h) => h.innerText.replace(/\s+/g, ' ')).join(' | ')} · tiền: ${txt('.ks-money .ks-kv')} · ${W()}`);
    r.push(`chờ giao bù: ${$$('.ks-sec')[0].querySelectorAll('.ks-row').length ? txt('.ks-sec .ks-row .grow') : 'KHÔNG'}`);
    // phiếu xuất sau có giao bù
    await rpc('app_nh_create', { p: { branch_id: 1, doc_no: 'PXT104B', ship_at: day + ' 15:00', total: 60000, lines: [
      { code: 'A2', name: 'Đường thử', unit: 'Kg', qty: 1, price: 10000, amount: 10000 }, { code: 'A1', name: 'Sữa đặc thử', unit: 'Hộp', qty: 2, price: 20000, amount: 40000 }, { code: 'A4', name: 'Khăn giấy thử', unit: 'Gói', qty: 1, price: 10000, amount: 10000 }] } });
    await go('#/hang-hoa/kiem-soat?cn=1', '.ks-wrap');
    $$('.ks-row').find((x) => x.innerText.includes('Đường')).querySelector('.ks-bu').click(); await wait('dialog[open] form'); await sleep(300);
    f = $$('dialog[open] form').pop(); r.push(`chọn dòng giao bù: ${$$('.ks-cand', f).map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / ')} · tự chọn ${f.querySelector('input[name=ln]:checked')?.closest('label').innerText.split('·')[0].trim()}`);
    f.requestSubmit(); await sleep(2500); await wait('.ks-wrap');
    $$('.ks-row').find((x) => x.innerText.includes('Khăn')).querySelector('.ks-cancel').click(); await wait('dialog[open] form'); await sleep(300);
    f = $$('dialog[open] form').pop(); f.requestSubmit(); await sleep(300); r.push(`huỷ thiếu lý do: ${txt('dialog[open] .ks-err')}`);
    f.rs.value = 'kho đã trừ tiền'; f.requestSubmit(); await sleep(2500); await wait('.ks-wrap');
    $$('.ks-row').find((x) => x.innerText.includes('Cà phê')).querySelector('.ks-hd').click(); await wait('dialog[open] form'); await sleep(300);
    f = $$('dialog[open] form').pop(); r.push(`HĐ bổ sung tự điền tiền: ${f.amt.value}`); f.ref.value = 'BS-0001'; f.requestSubmit(); await sleep(2500); await wait('.ks-wrap');
    r.push(`sau xử lý: ${$$('.ks-h').map((h) => h.innerText.replace(/\s+/g, ' ')).join(' | ')} · tiền: ${txt('.ks-money .ks-kv')}`);
    r.push(`đã xử lý: ${$$('.ks-done').map((x) => x.innerText.replace(/\s+/g, ' ').slice(0, 70)).join(' / ')}`);
    $$('.ks-done').find((x) => x.innerText.includes('Đường')).querySelector('.ks-undo').click(); await sleep(2500); await wait('.ks-wrap');
    r.push(`hoàn tác giao bù: ${$$('.ks-h').map((h) => h.innerText.replace(/\s+/g, ' ')).join(' | ')} · phải trả ${txt('.ks-money .ks-tot:last-child')}`);
    // bước 106: đã xác nhận xong thì không bỏ đối soát từng món được; mở lại bị chặn khi kế toán đã xử lý
    const ln = (await rpc('app_nh_list', { p_month: day.slice(0, 7), p_branch: 1 })).rows.find((x) => x.id === id).lines.find((l) => l.name.startsWith('Đường'));
    const e1 = await rpc('app_nh_uncheck', { p_line: ln.id }).then(() => 'được (SAI)', (e) => e.message);
    const e2 = await rpc('app_gh_recon_reopen', { p_id: id }).then(() => 'được (SAI)', (e) => e.message);
    r.push(`bỏ đối soát khi đã xong: ${e1} · mở lại: ${e2}`);
    if (new URLSearchParams(location.search).get('dung')) { await go('#/hang-hoa/kiem-soat?cn=1', '.ks-wrap'); await new Promise(() => {}); }
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'hàng hoá 104', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
