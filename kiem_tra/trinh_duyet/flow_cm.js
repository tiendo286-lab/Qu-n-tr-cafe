// Bước 41: chốt ca mới theo phiếu Fabi (nhân viên, khung điện thoại): Tôi chốt ca này → 10 bước → web bắt gõ nhầm → LỆCH bắt ghi lý do → GỬI → hoàn thành
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => { const w = document.documentElement.clientWidth; const wide = $$('#root *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > w + 1).map((el) => el.tagName + '.' + el.className).slice(0, 3); return `rộng ${w}/${document.documentElement.scrollWidth}${wide.length ? ' tràn: ' + wide.join(',') : ''}`; };
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  // gõ như người thật: ô tiền tự thêm dấu chấm nên trình duyệt KHÔNG phát 'change' (lỗi 12/11: ô hotline chỉ nghe 'change' → kẹt bước 5)
  const typ = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const num = (k, v) => setv($(`.cm-num[data-f="${k}"]`), v);
  const next = async () => { $('#cm-next').click(); await sleep(700); };
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar, #root .m-foot', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    for (const m of ['../js/nhap_hang.js', '../js/chot_ca_moi.js', '../js/pages/phieu_ca.js']) {
      const res = await Promise.race([import(m).then(() => 'ok', (e) => 'LỖI ' + e.message), sleep(4000).then(() => 'TREO')]);
      if (res.startsWith('LỖI')) r.push(`nạp ${m}: ${res}`);   // 'TREO' chỉ do trình duyệt thử tua nhanh thời gian, bỏ qua
    }
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const id = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[0].shift });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id; await wait('.cm-col'); await sleep(600);
    r.push(`Mở phiếu: ${txt('#root').slice(0, 300)} · ${W()}`);
    $('#cm-claim').click(); await wait('.cm-person, #cm-helper'); await sleep(800);
    r.push(`B2 Ai làm ca: ${$$('.cm-person').length} người · giờ gợi ý ${$$('[data-t]').map((i) => i.value).join(',')} · ${txt('.cm-sh')}`);
    if (!$$('.cm-person').length) { await sleep(500); $('[data-hp="in"]').click(); for (let i = 0; i < 100 && !document.querySelector('[data-add-emp]'); i++) await sleep(50); document.querySelector('[data-add-emp]')?.click(); await sleep(300); r.push('thêm người làm hộ: ' + $$('.cm-person').length); }
    $$('[data-t]').forEach((i) => { if (!i.value) setv(i, i.dataset.k === 'time_in' ? '06:45' : '12:45'); });
    await next();
    r.push(`B3 tiêu đề: ${txt('#cm-root h2')}`);
    $('#cm-next').click(); await sleep(300); r.push(`chưa ảnh: ${txt('#cm-err')}`);
    // ảnh phiếu
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 60; cv.getContext('2d').fillRect(0, 0, 40, 60);
    const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'phieu.jpg', { type: 'image/jpeg' }));
    const inp = $('#cm-photo'); inp.files = dt.files; inp.dispatchEvent(new Event('change')); await sleep(1500);
    { const b = $('.cm-thumb')?.getBoundingClientRect() || {}; const top = $('.cm-num[data-f="ipos_opening"]').getBoundingClientRect().top - $('#cm-body').getBoundingClientRect().top;
      r.push(`ảnh: ${$$('.cm-photos figure').length} · ô ảnh ${Math.round(b.width || 0)}x${Math.round(b.height || 0)} · ${txt('.cm-phact')} · ô Số dư đầu cách đầu thẻ ${Math.round(top)}px`); }
    setv($('#cm-close'), '12:39');
    num('ipos_opening', '1000000'); num('total_revenue', '5000000'); num('pos_transfer', '3000000'); num('pos_cash', '2200000'); num('pos_debt', '0'); num('cash_counted', '3020000'); num('pos_diff', '20000');
    await sleep(200); r.push(`gõ nhầm tiền mặt: ${txt('#cm-checks')}`);
    await next(); r.push(`bấm Tiếp khi nhầm: ${txt('#cm-err')}`);
    num('pos_cash', '2000000'); await sleep(200); r.push(`sửa đúng: ${txt('#cm-checks')} · ${W()}`);
    await next(); r.push(`B4 nợ: ${txt('#cm-body').slice(0, 80)}`);
    await next(); r.push(`B5 tiêu đề: ${txt('#cm-root h2')}`); $('#cm-add-loan').click(); await sleep(200); await next(); r.push(`mượn thiếu tên: ${txt('#cm-err')}`);
    setv($('[data-db="0"][data-k="table_name"]'), 'Anh Nam (thử)'); setv($('[data-db="0"][data-k="amount"]'), '50000'); setv($('[data-db="0"][data-k="note"]'), '09xx');
    r.push(`B5 khách mượn: ${$$('#cm-body h3').map((x) => x.innerText).join(' / ')} · ${W()}`); await next();
    r.push(`B6 tiêu đề (bỏ bước Số cốc ở cơ sở dùng Fabi): ${txt('#cm-root h2')} · ô số cốc ${!!$('#cm-cups')}`);
    typ($('#cm-hot'), '2900000'); await sleep(300); $('#cm-next').click(); await sleep(400); r.push(`B7 lệch: ${txt('#cm-ck-box')} | ${txt('#cm-err')} · nút về Thu chi ${!!$('[data-jump="5"]')}`); { $('[data-jump="5"]').click(); await sleep(800); const t1 = txt('#cm-root h2'); $('#cm-next').click(); await sleep(700); $('#cm-next').click(); await sleep(700); r.push(`Bấm Về bước Thu chi → ${t1} → Tiếp, Tiếp → ${txt('#cm-root h2')}`); }
    // lệch −65.000 → tạo phiếu chi chuyển khoản ngay ở bước hotline
    typ($('#cm-hot'), '2935000'); await sleep(400); r.push(`B7 lệch 65k: nút ${txt('#cm-ckmv')} · ${txt('.cm-ckmv .st-meta')}`);
    $('#cm-ckmv').click(); await sleep(500); r.push(`Tạo phiếu thiếu nội dung: ${txt('#cm-ckmv-err')}`);
    typ($('#cm-ckmv-note'), 'hoàn tiền khách huỷ đơn'); $('#cm-ckmv').click(); for (let i = 0; i < 50 && $('#cm-ckmv'); i++) await sleep(100); await sleep(500);
    r.push(`B7 sau tạo phiếu: ${txt('#cm-ck-box')} · ${W()}`);
    await next();
    r.push(`B8 kết quả: ${txt('#cm-body .alert')}`);
    $('#cm-next').click(); await sleep(300); r.push(`chưa lý do: ${txt('#cm-err')}`);
    setv($('#cm-diff-note'), 'Khách bo 20.000'); await next();
    r.push(`B9 bàn giao: ${txt('#cm-root h2')} · ${W()}`);
    $('#cm-add-ho').click(); await sleep(200); setv($('[data-ho="0"]'), 'Máy xay kêu to'); await next();
    r.push(`B10 tóm tắt: ${txt('#cm-body').slice(0, 300)}`);
    await next(); await sleep(1500);
    const R = await rpc('app_ca_get', { p_id: id });
    r.push(`GỬI → trạng thái ${R.status} · pos_diff ${R.pos_diff} · diff_note ${R.diff_note} · opening ${R.opening_cash} · bàn giao ${R.handover.length} · trang: ${txt('#root h1')} · ${W()}`);
    // Ca chiều: số dư đầu so với Tổng tiền ca sáng, bàn nợ, khoản chi làm két KHỚP
    const sh2 = ov.find((x) => x.branch_id === ov[0].branch_id && x.shift !== ov[0].shift);
    const id2 = await rpc('app_ca_open', { p_branch: sh2.branch_id, p_date: day, p_shift: sh2.shift });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id2; await wait('#cm-claim'); await sleep(500);
    $('#cm-claim').click(); await wait('[data-hp]'); await sleep(800);
    if (!$$('.cm-person').length) { $('[data-hp="in"]').click(); for (let i = 0; i < 100 && !document.querySelector('[data-add-emp]'); i++) await sleep(50); document.querySelector('[data-add-emp]')?.click(); await sleep(300); }
    $$('[data-t]').forEach((i) => { if (!i.value) setv(i, i.dataset.k === 'time_in' ? '12:30' : '17:30'); });
    await next();
    const inp2 = $('#cm-photo'); inp2.files = dt.files; inp2.dispatchEvent(new Event('change')); await sleep(1500);
    if ($('#cm-open')) setv($('#cm-open'), '12:40');
    setv($('#cm-close'), '17:10');
    num('ipos_opening', '2900000'); num('total_revenue', '1500000'); num('pos_transfer', '1000000'); num('pos_cash', '472000'); num('pos_debt', '28000'); num('cash_counted', '3371000');
    $('[data-sign="-1"]').click(); await sleep(300); num('pos_diff', '1000'); await sleep(300);
    r.push(`Chiều số dư đầu lệch: ${txt('#cm-checks')} · ô lý do ${!!$('#cm-open-note')}`);
    // bước 45: cách 2 — mở ca với tiền gối đầu 1.000.000, phần dư ca sáng để lại là nộp quỹ khi giao ca
    num('ipos_opening', '1000000'); num('cash_counted', '1471000'); await sleep(400);
    r.push(`Chiều mở 1 triệu: ${txt('#cm-checks')} · ô lý do ${!!$('#cm-open-note')}`);
    num('ipos_opening', '3020000'); num('cash_counted', '3491000'); await sleep(400);
    r.push(`Chiều sửa: ${txt('#cm-checks')}`);
    // khách mượn ca sáng trả 50.000 tiền mặt ở ca chiều: két thêm 50.000, Fabi không biết → chênh lệch +49.000
    num('cash_counted', '3541000'); $('[data-sign="1"]').click(); await sleep(300); num('pos_diff', '49000'); await sleep(300);
    r.push(`Chiều có tiền trả mượn: ${txt('#cm-checks')}`);
    await next(); await next(); r.push(`nợ chưa ghi bàn: ${txt('#cm-err')}`);
    $('#cm-add-debt').click(); await sleep(200);
    setv($('[data-db="0"][data-k="table_name"]'), 'Bàn 5'); setv($('[data-db="0"][data-k="amount"]'), '28000'); await next();
    r.push(`ca 2 sau Khách nợ: ${txt('#cm-root h2')}`);
    $('#cm-add-move').click(); await sleep(200); setv($('[data-mv="0"][data-k="note"]'), 'Mua đá'); setv($('[data-mv="0"][data-k="amount"]'), '1000');
    $('#cm-add-move').click(); await sleep(200);
    r.push(`Thu chi 2 dòng: hàng nút ${Math.round($('#cm-body .cm-ph').getBoundingClientRect().width)}px · ${$$('#cm-body .cm-ph')[0].innerText.replace(/\s+/g, ' ')} · nút Thu vào rộng ${Math.round($('[data-mt="0"][data-v="1"]').getBoundingClientRect().width)}px · ${W()}`);
    $('[data-mx="1"]').click(); await sleep(200);
    // bước 73: không ghi "âm tiền" vào thu chi
    setv($('[data-mv="0"][data-k="note"]'), 'Âm tiền két'); await next(); r.push(`ghi "Âm tiền": ${txt('#cm-err')} · còn ở ${txt('#cm-root h2')}`);
    setv($('[data-mv="0"][data-k="note"]'), 'Mua đá'); await sleep(200);
    r.push(`Chiều thấy khách mượn: ${$$('#cm-body .cm-person').map((x) => x.innerText.replace(/\s+/g, ' ')).pop()} · danh sách QL ${(await rpc('app_ca_loans_open')).length}`);
    r.push(`nhắc đầu phiếu có khách mượn: ${txt('.pc-nhac')}`);   // bước 75
    { const sel = $('[data-paid]'); sel.value = 'tien_mat'; sel.dispatchEvent(new Event('change')); await sleep(1200); }
    await next();
    typ($('#cm-hot'), '1000000'); await sleep(300); r.push(`Chiều hotline: ${txt('#cm-ck-box')}`); await next();
    r.push(`Chiều kết quả: ${txt('#cm-body .alert')}`);
    await next(); await next(); await next(); await sleep(1500);
    const R2 = await rpc('app_ca_get', { p_id: id2 });
    r.push(`còn khách mượn chưa trả: ${(await rpc('app_ca_loans_open')).length}`);
    r.push(`Chiều GỬI → ${R2.status} · nợ ${R2.debts.map((d) => d.table_name + ' ' + d.amount).join(',')} · chi ${R2.moves.map((m) => m.amount).join(',')} · ${W()}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'chốt ca mới', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
