// Bước 106: Hàng hoá — nhận hàng 3 bước (chụp hàng + món ngoài phiếu → chụp hoá đơn giao / không có → xác nhận đủ / lệch),
// quản lý đối soát (món lệch xem trước, món khớp theo ảnh, Xác nhận xong, chặn khi thiếu hoá đơn giao, sang lần giao tiếp, mở lại),
// kế toán Kiểm soát (tải hoá đơn bù, món ngoài phiếu chưa có giá). role=chu (confirm=1). Không dùng dữ liệu thật.
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
    const id = await rpc('app_nh_create', { p: { branch_id: 1, doc_no: 'PXT106', ship_at: day + ' 08:15', total: 300000, lines: [
      { code: 'A1', name: 'Sữa đặc thử', unit: 'Hộp', qty: 10, price: 20000, amount: 200000 }, { code: 'A2', name: 'Đường thử', unit: 'Kg', qty: 5, price: 10000, amount: 50000 },
      { code: 'A3', name: 'Cà phê thử', unit: 'Gói', qty: 2, price: 20000, amount: 40000 }, { code: 'A4', name: 'Khăn giấy thử', unit: 'Gói', qty: 1, price: 10000, amount: 10000 }] } });
    const id2 = await rpc('app_nh_create', { p: { branch_id: 2, doc_no: 'PXT106B', ship_at: day + ' 09:00', total: 20000, lines: [{ code: 'B1', name: 'Trà thử', unit: 'Gói', qty: 2, price: 10000, amount: 20000 }] } });
    const cv = document.createElement('canvas'); cv.width = 60; cv.height = 40; cv.getContext('2d').fillRect(0, 0, 60, 40);
    const img = () => new Promise((ok) => cv.toBlob((b) => ok(new File([b], 'hang.png', { type: 'image/png' })), 'image/png'));
    const sel = (name) => $$('.gh-sel').find((x) => x.innerText.includes(name));
    const tick = (name) => { const c = sel(name).querySelector('.gh-c'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); };
    const fill = (row, n, u, q) => { row.querySelector('.gh-nn').value = n; row.querySelector('.gh-nu').value = u; setv(row.querySelector('.gh-nq'), q); };
    // ---- ① nhân viên nhận PXT106: lệch + món ngoài phiếu
    await go('#/hang-hoa/nhan?nhan=' + id, '#gh-recv .gh-prog');
    r.push(`bước: ${txt('.gh-steps')} · ${W()}`);
    setFiles($('#gh-shot'), [await img()]); await wait('.gh-pickc'); await sleep(300);
    r.push(`chọn món: có khung ngoài phiếu ${!!$('.gh-extra')} · ${txt('.gh-extra b')}`);
    tick('Sữa'); tick('Đường'); setv(sel('Đường').querySelector('.gh-q'), '4'); await sleep(200);
    setv($$('.gh-note').find((n) => !n.hidden).querySelector('input'), 'thiếu 1 bao'); $('#gh-ps').click(); await sleep(2500); await wait('.gh-th');
    setFiles($('#gh-shot'), [await img()]); await wait('.gh-pickc'); await sleep(300);
    tick('Cà phê'); setv(sel('Cà phê').querySelector('.gh-q'), '3'); await sleep(200); setv($$('.gh-note').find((n) => !n.hidden).querySelector('input'), 'dư 1 gói');
    $('.gh-extra .gh-nadd').click(); await sleep(200); fill($('.gh-extra .gh-nr'), 'Khăn giấy hộp', 'Hộp', '2');
    r.push(`nút lưu ảnh 2: ${txt('#gh-ps')}`); $('#gh-ps').click(); await sleep(3000);
    $$('.gh-none').find((b) => b.closest('.gh-li').innerText.includes('Khăn giấy thử')).click(); await wait('dialog[open] form'); await sleep(200);
    let f = $$('dialog[open] form').pop(); f.nt.value = 'không có trong thùng'; f.requestSubmit(); await sleep(800);
    r.push(`hết món: ${txt('.gh-steps')} · ${txt('.gh-prog')} · nút chụp HĐ giao ${!!$('#gh-dshot')} · nút gửi ${!!$('#gh-send')} · nút không mang ${!!$('#gh-dnone')}`);
    setFiles($('#gh-dshot'), [await img()]); await sleep(3000); await wait('#gh-step3');
    r.push(`bước 3: ${txt('.gh-steps')} · ảnh HĐ ${!!$('#gh-step3 img')} · danh sách: ${$$('.gh-cmp').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' / ')}`);
    r.push(`cảnh báo: ${txt('.gh-warnbox')} · nút: ${txt('#gh-send')} · ${W()}`);
    $('#gh-send').click(); await sleep(3000); await wait('.gh-wrap .card');
    let D = (await rpc('app_nh_list', { p_month: day.slice(0, 7), p_branch: 1 })).rows.find((x) => x.id === id);
    r.push(`máy chủ: ${D.state} · HĐ giao ${!!D.deliv_path} · ${D.lines.map((l) => l.name.split(' ')[0] + '=' + l.qty_received + (l.qty_invoice == null ? '(ngoài)' : '')).join(' ')}`);
    // ---- PXT106B (ĐK): nhận đủ, tài xế không mang hoá đơn giao
    await go('#/hang-hoa/nhan?nhan=' + id2, '#gh-recv .gh-prog');
    setFiles($('#gh-shot'), [await img()]); await wait('.gh-pickc'); await sleep(300); tick('Trà'); $('#gh-ps').click(); await sleep(2500); await wait('#gh-dnone');
    $('#gh-dnone').click(); await wait('dialog[open] form'); await sleep(200); f = $$('dialog[open] form').pop(); f.requestSubmit(); await sleep(300);
    r.push(`không mang thiếu ghi chú: ${txt('dialog[open] .gh-err')}`); f.nt.value = 'tài xế quên phiếu'; f.requestSubmit(); await sleep(1500); await wait('#gh-step3');
    r.push(`nhận đủ: ${txt('#gh-step3 .alert')} · ${txt('.gh-okbox')} · nút: ${txt('#gh-send')}`);
    $('#gh-send').click(); await sleep(3000);
    // ---- ② quản lý: danh sách
    await go('#/hang-hoa/doi-soat', '.gh-tabs');
    r.push(`danh sách: ${$$('.branch-tabs a').map((a) => a.innerText.replace(/\s+/g, ' ')).join(' ')} · ${$$('.gh-tabs a').map((a) => a.innerText.replace(/\s+/g, ' ')).join(' | ')}`);
    r.push(`thẻ: ${$$('.ql-card').map((x) => x.innerText.replace(/\s+/g, ' ').slice(0, 130)).join(' // ')} · ${W()}`);
    // ---- đối soát PXT106
    await go('#/hang-hoa/doi-soat?ds=' + id, '.ds-top');
    r.push(`đối soát: ${txt('#gh-ds .sub')} · ${txt('.gh-steps')} · NV xác nhận: ${txt('.ds-main > div')} · ${$$('.ds-lech').length} món lệch · ${$$('.ds-split').length} ảnh khớp · nút xong khoá ${$('#gh-done')?.disabled}`);
    r.push(`món lệch: ${$$('.ds-lech').map((x) => x.querySelector('.grow').innerText.replace(/\s+/g, ' ').slice(0, 70)).join(' // ')}`);
    for (let k = 0; k < 6 && $('.gh-one'); k++) { $('.gh-one').click(); await sleep(1200); }
    $('.gh-all')?.click(); await sleep(1500);
    r.push(`sau soát: ${txt('.gh-steps')} · tóm tắt: ${txt('.ds-sum').slice(0, 220)} · nút xong khoá ${$('#gh-done')?.disabled} · ${W()}`);
    $('#gh-done').click(); await sleep(3000); await wait('.ds-top');
    r.push(`xác nhận xong → ${location.hash} · ${txt('.alert.ok, .alert.info').slice(0, 120)}`);
    // ---- PXT106B: thiếu hoá đơn giao → khoá
    for (let k = 0; k < 3 && $('.gh-one, .gh-all'); k++) { $('.gh-all, .gh-one').click(); await sleep(1200); }
    r.push(`PXT106B: ${txt('.ds-doc')} · ${txt('.ds-sum .ds-lock')} · nút xong khoá ${$('#gh-done')?.disabled}`);
    // ---- ③ kế toán: Kiểm soát
    await go('#/hang-hoa/kiem-soat?cn=2', '.ks-wrap');
    r.push(`Kiểm soát ĐK: ${txt('.ks-nb')}`.slice(0, 260));
    setFiles($('.ks-bufile'), [await img()]); await sleep(3000); await wait('.ks-wrap');
    r.push(`sau tải hoá đơn bù: còn mục thiếu HĐ ${!!$('.ks-nb')}`);
    await go('#/hang-hoa/doi-soat?ds=' + id2, '.ds-top');
    r.push(`PXT106B sau bù: ${txt('.ds-doc')} · khoá ${!!$('.ds-sum .ds-lock')} · nút xong khoá ${$('#gh-done')?.disabled}`);
    $('#gh-done').click(); await sleep(3000);
    await go('#/hang-hoa/kiem-soat?cn=1', '.ks-wrap');
    r.push(`Kiểm soát LHP: ${$$('.ks-h').map((h) => h.innerText.replace(/\s+/g, ' ')).join(' | ')} · ${$$('.ks-sec .ks-row').map((x) => x.querySelector('.grow').innerText.replace(/\s+/g, ' ').slice(0, 60)).join(' // ')} · ${W()}`);
    // ---- mở lại đối soát
    await go('#/hang-hoa/doi-soat?tt=xong&cn=1', '.gh-tabs');
    r.push(`đã xong: ${$$('.ql-card').map((x) => x.innerText.replace(/\s+/g, ' ').slice(0, 110)).join(' // ')}`);
    $('.ql-reopen')?.click(); await sleep(3000); await wait('.ds-top');
    const C1 = await rpc('app_gh_control', { p_branch: 1, p_month: day.slice(0, 7) });
    r.push(`mở lại → ${location.hash} · Kiểm soát còn ${C1.open.length} mục chờ · nút xong ${!!$('#gh-done')}`);
    $('#gh-done').click(); await sleep(3000);
    const C2 = await rpc('app_gh_control', { p_branch: 1, p_month: day.slice(0, 7) }); const fx = C2.open.find((x) => x.extra);
    await rpc('app_gh_fu_resolve', { p_id: fx.id, p_line: null, p_ref: 'BS9', p_amount: 15000, p_note: null });
    await go('#/hang-hoa/doi-soat?xem=' + id, '.ds-top');
    r.push(`xem sau khi KT xử lý: ${txt('#gh-ds .alert.ok').slice(0, 160)} · nút mở lại ${!!$('#gh-reopen')}`);
    // ---- nhận chưa có phiếu xuất
    await go('#/hang-hoa/nhan?cn=1', '.gh-nohd'); r.push(`nút: ${txt('.gh-nohd')}`); $('.gh-nohd').click(); await wait('#gh-recv .gh-prog'); await sleep(800);
    setFiles($('#gh-shot'), [await img()]); await wait('.gh-pickc'); await sleep(300); fill($('.gh-nr'), 'Đá viên thử', 'Bao', '3'); $('#gh-ps').click(); await sleep(3000); await wait('#gh-dshot');
    setFiles($('#gh-dshot'), [await img()]); await sleep(3000); await wait('#gh-step3');
    r.push(`chưa có phiếu: ${txt('.gh-steps')} · ${txt('.gh-okbox')} · nút ${txt('#gh-send')}`);
    $('#gh-send').click(); await sleep(3000);
    const K = (await rpc('app_gh_inbox', { p_branch: 1 })).rows.find((x) => x.kind === 'khong_hd');
    r.push(`máy chủ: ${K?.state} · HĐ giao ${!!K?.deliv_path} · ${K?.lines.map((l) => l.name + '=' + l.qty_received).join(', ')}`);
    if (new URLSearchParams(location.search).get('dung')) { await go('#/hang-hoa/doi-soat?xem=' + id, '.ds-top'); await new Promise(() => {}); }
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'hàng hoá 106', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
