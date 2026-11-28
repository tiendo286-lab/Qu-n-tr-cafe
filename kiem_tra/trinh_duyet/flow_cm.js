// Chốt ca của nhân viên — đi trọn 4 bước Nhân viên · Bàn giao · Tiền · Kiểm tra rồi GỬI (viết lại 28/11/2026, anh Tiến chốt;
// bản cũ từ bước 41 viết cho màn hình 10 bước nên dừng giữa chừng). role=nv, index.html + test/phone.html. Kết quả: out[].cm = { ok, fail }.
// Thử: thanh 4 bước · thiếu giờ thì chặn · việc bàn giao · thiếu ảnh phiếu Fabi thì chặn · gõ nhầm số thì web bắt · khoản nợ thiếu loại / thiếu tên thì chặn ·
// không cho ghi "âm tiền" vào thu chi · lệch chuyển khoản vẫn gửi được (quản lý xử lý ở đối soát) · bước Kiểm tra · GỬI → hoàn thành ·
// ca sau: số dư đầu khác tổng tiền ca trước thì hiện ô ghi chú. Số thử, không phải số thật.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s) => (($(s) || {}).innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const setv = (el, v) => { if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const num = (k, v) => setv($(`.cm-num[data-f="${k}"]`), v);
  const next = async () => { $('#cm-next').click(); await sleep(900); };
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wide = (m) => ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `${m}: không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`);
  const stepNow = () => $$('.sc-steps button').findIndex((b) => b.getAttribute('aria-current') === 'step');
  const err = () => txt('#cm-err');
  window.confirm = () => true;
  const photo = async () => {
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 60; cv.getContext('2d').fillRect(0, 0, 40, 60);
    const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'phieu.jpg', { type: 'image/jpeg' }));
    const inp = $('#cm-photo'); inp.files = dt.files; inp.dispatchEvent(new Event('change')); for (let i = 0; i < 60 && !$('.cm-photos figure'); i++) await sleep(100); await sleep(600);
  };
  const people = async (tin, tout) => {
    if (!$$('.cm-person').length) { $('[data-hp="in"]')?.click(); for (let i = 0; i < 100 && !$('[data-add-emp]'); i++) await sleep(50); $('[data-add-emp]')?.click(); await sleep(300); }
    $$('[data-t]').forEach((i) => { if (!i.value) setv(i, i.dataset.k === 'time_in' ? tin : tout); });
  };
  try {
    await wait('#root .page-head, #root h1, #root .appbar, #root .m-foot', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    for (const m of ['../js/nhap_hang.js', '../js/chot_ca_moi.js', '../js/pages/phieu_ca.js']) await Promise.race([import(m).catch(() => 0), sleep(4000)]);
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const id = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[0].shift });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id; await wait('.cm-col'); await sleep(800);
    $$('dialog[open]').forEach((d) => d.close());
    ok(!!$('#cm-claim'), '1. mở phiếu ca chưa ai chốt: có nút "Tôi chốt ca này"');
    $('#cm-claim').click(); await wait('.cm-person, #cm-helper'); await sleep(900); $$('dialog[open]').forEach((d) => d.close());
    // ---- bước 1 Nhân viên
    const labels = $$('.sc-steps button').map((b) => b.innerText.replace(/\s+/g, ' ').replace(/^\d+\s*/, '').trim().toLowerCase());
    ok(labels.join('|') === 'nhân viên|bàn giao|tiền|kiểm tra' && stepNow() === 0, `2. thanh 4 bước Nhân viên · Bàn giao · Tiền · Kiểm tra, đang ở bước 1 (${labels.join(' · ')} / bước ${stepNow() + 1})`);
    await people('06:45', '12:45');
    const t0 = $('[data-t]'); const keep = t0.value; setv(t0, ''); await next();
    ok(/Nhập giờ đến và giờ về/.test(err()) && stepNow() === 0, `3. thiếu giờ của một người → chặn, vẫn ở bước 1 (${err().slice(0, 70)})`);
    setv($('[data-t]'), keep || '06:45'); await sleep(200);
    wide('3. bước Nhân viên');
    await next();
    // ---- bước 2 Bàn giao
    ok(stepNow() === 1 && !!$('#cm-add-ho'), `4. đủ giờ → sang bước 2 Bàn giao (bước ${stepNow() + 1})`);
    $('#cm-add-ho').click(); await sleep(300); setv($('[data-ho="0"]'), 'Máy xay kêu to'); await sleep(200);
    wide('4. bước Bàn giao');
    await next();
    // ---- bước 3 Tiền
    ok(stepNow() === 2 && !!$('#cm-photo') && !!$('.cm-num[data-f="ipos_opening"]') && !!$('#cm-hot'), `5. sang bước 3 Tiền: có chỗ chụp phiếu Fabi, các ô số, ô chuyển khoản hotline (bước ${stepNow() + 1})`);
    if ($('#cm-open') && !$('#cm-open').readOnly) setv($('#cm-open'), day + 'T06:40');
    setv($('#cm-close'), day + 'T12:39');
    // phiếu Fabi thử: doanh thu 5.000.000 = chuyển khoản 3.000.000 + tiền mặt 2.000.000; số dư đầu 1.000.000; tổng tiền đếm 3.020.000 (thừa 20.000)
    num('ipos_opening', '1000000'); num('total_revenue', '5000000'); num('pos_transfer', '3000000'); num('pos_cash', '2200000'); num('pos_debt', '0'); num('cash_counted', '3020000');
    if ($('.cm-num[data-f="pos_diff"]')) num('pos_diff', '20000');
    setv($('#cm-hot'), '3000000'); if ($('#cm-nomoves')) { $('#cm-nomoves').checked = true; $('#cm-nomoves').dispatchEvent(new Event('change', { bubbles: true })); }
    await sleep(300); await next();
    ok(/Chụp ảnh phiếu chốt ca Fabi trước/.test(err()) && stepNow() === 2, `6. chưa chụp ảnh phiếu Fabi → chặn (${err().slice(0, 60)})`);
    await photo();
    ok($$('.cm-photos figure').length === 1, `7. chụp ảnh xong: có 1 ảnh phiếu (${$$('.cm-photos figure').length})`);
    const nham = txt('#cm-checks');
    await next();
    ok(/chưa khớp nhau|gõ nhầm/.test(err()) && stepNow() === 2, `8. gõ nhầm tiền mặt 2.200.000 → web bắt, không cho qua (${err().slice(0, 70)} · ${nham.slice(0, 80)})`);
    num('pos_cash', '2000000'); await sleep(400);
    ok(!/🔴|❌/.test(txt('#cm-checks')) && /✅/.test(txt('#cm-checks')) && /🔴/.test(nham),`9. sửa đúng 2.000.000 → các số khớp (${txt('#cm-checks').slice(0, 90)})`);
    // khoản nợ: thiếu loại, thiếu tên
    $('#cm-add-debt').click(); await sleep(400); await next();
    ok(/Chọn HĐ \/ TM \/ CK/.test(err()) && stepNow() === 2, `10. khoản nợ chưa chọn loại → chặn (${err().slice(0, 60)})`);
    { const i0 = $$('[data-db][data-k="amount"]').length - 1; $(`[data-dk="${i0}"][data-v="muon"]`).click(); await sleep(400); await next();
      ok(/phải có ghi chú/.test(err()) && stepNow() === 2, `11. Nợ TM thiếu tên / số tiền → chặn (${err().slice(0, 70)})`);
      const i1 = $$('[data-db][data-k="amount"]').length - 1; setv($(`[data-db="${i1}"][data-k="table_name"]`), 'Anh Nam (thử)'); setv($(`[data-db="${i1}"][data-k="amount"]`), '50000'); await sleep(300); }
    // thu chi: không ghi "âm tiền"
    if ($('#cm-nomoves')?.checked) { $('#cm-nomoves').checked = false; $('#cm-nomoves').dispatchEvent(new Event('change', { bubbles: true })); await sleep(200); }
    ($('[data-new-move="1"]') || $('#cm-add-move')).click(); await sleep(400);   // nút "+ Thu" của bước Tiền (bản cũ: #cm-add-move)
    { const iM = $$('[data-mv][data-k="note"]').length - 1;
      setv($(`[data-mv="${iM}"][data-k="note"]`), 'Âm tiền két'); setv($(`[data-mv="${iM}"][data-k="amount"]`), '1000'); await sleep(300); await next();
      ok(/Không ghi "âm \/ thiếu tiền"/.test(err()) && stepNow() === 2, `12. ghi "Âm tiền két" vào thu chi → chặn (${err().slice(0, 60)})`);
      $(`[data-mx="${iM}"]`).click(); await sleep(400); if ($('#cm-nomoves')) { $('#cm-nomoves').checked = true; $('#cm-nomoves').dispatchEvent(new Event('change', { bubbles: true })); } }
    // lệch chuyển khoản 100.000: nhân viên vẫn gửi được (quản lý xử lý ở đối soát)
    setv($('#cm-hot'), '2900000'); await sleep(400);
    const lech = txt('#cm-verdict');
    wide('12. bước Tiền');
    await next();
    // ---- bước 4 Kiểm tra
    ok(stepNow() === 3 && $$('.cm-review-row').length >= 4, `13. lệch chuyển khoản vẫn sang được bước 4 Kiểm tra, có bảng tóm tắt (bước ${stepNow() + 1} · ${$$('.cm-review-row').length} dòng · lỗi: ${err().slice(0, 60)} · kết quả bước Tiền: ${lech.slice(0, 80)})`);
    ok(document.body.textContent.includes('Số nhân viên đã gửi được giữ nguyên'), '14. bước Kiểm tra nhắc "số nhân viên đã gửi được giữ nguyên"');
    wide('14. bước Kiểm tra');
    await next(); await sleep(1800);
    const R = await rpc('app_ca_get', { p_id: id });
    ok(R.status === 'hoan_thanh', `15. GỬI → phiếu hoàn thành (${R.status})`);
    ok((R.handover || []).length === 1 && Number(R.reported_transfer) === 2900000 && Number(R.pos_cash) === 2000000 && Number(R.cash_counted) === 3020000,
      `16. máy chủ lưu đúng: 1 việc bàn giao, hotline 2.900.000, tiền mặt 2.000.000, tổng tiền 3.020.000 (${(R.handover || []).length} · ${R.reported_transfer} · ${R.pos_cash} · ${R.cash_counted})`);
    ok((R.debts || []).some((d) => d.table_name === 'Anh Nam (thử)' && Number(d.amount) === 50000 && d.kind === 'muon'), `17. khoản Nợ TM 50.000 của "Anh Nam (thử)" được lưu (${(R.debts || []).map((d) => d.table_name + ' ' + d.amount + ' ' + d.kind).join(', ')})`);
    // ---- ca sau: số dư đầu so với tổng tiền ca trước
    const sh2 = ov.find((x) => x.branch_id === ov[0].branch_id && x.shift !== ov[0].shift);
    if (!sh2) bad.push('18. không có ca thứ hai trong ngày ở cơ sở thử');
    else {
      const id2 = await rpc('app_ca_open', { p_branch: sh2.branch_id, p_date: day, p_shift: sh2.shift });
      location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id2; await wait('#cm-claim'); await sleep(600);
      ok(/1 khoản/.test(txt('.pc-nhac')) && /50\.000/.test(txt('.pc-nhac')), `18. ca sau: đầu phiếu nhắc khách đang nợ 1 khoản 50.000 (${txt('.pc-nhac').slice(0, 70)})`);
      $('#cm-claim').click(); await wait('.cm-person, #cm-helper'); await sleep(900); $$('dialog[open]').forEach((d) => d.close());
      await people('12:30', '17:30'); await next(); await next();
      ok(stepNow() === 2, `19. ca sau: tới bước Tiền (bước ${stepNow() + 1} · ${err().slice(0, 60)})`);
      num('ipos_opening', '2900000'); await sleep(500);
      const w1 = $('#cm-open-wrap');
      ok(!!w1 && !w1.hidden, `20. số dư đầu 2.900.000 khác tổng tiền ca trước 3.020.000 → hiện ô ghi chú (${w1 ? (w1.hidden ? 'đang ẩn' : 'hiện') : 'không có ô'} · ${txt('#cm-checks').slice(0, 80)})`);
      num('ipos_opening', '3020000'); await sleep(500);
      const w2 = $('#cm-open-wrap');
      ok(!w2 || w2.hidden, `21. sửa thành 3.020.000 → ô ghi chú ẩn đi (${w2 ? (w2.hidden ? 'ẩn' : 'vẫn hiện') : 'không có ô'})`);
      wide('21. ca sau, bước Tiền');
    }
  } catch (e) { bad.push('LỖI: bài thử dừng giữa chừng — ' + (e.stack || e.message || e)); }
  out.push({ cm: { ok: good, fail: bad } });
};
