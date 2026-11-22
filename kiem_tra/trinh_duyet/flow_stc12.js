// Bài thử bước 164: Sổ thu / Sổ chi gọn (phần đầu 1 nút chuyển + ô số, bỏ cột phải, bấm ô → danh sách một loại, 👥 Người nợ, bộ lọc "Đang lọc", mở ngày gọn).
// Chạy: index.html?auto=1&role=chu&confirm=1&script=flow_stc12 (role chu / qlt / ql) và test/phone.html. Kết quả: out[].stc12 = { ok, fail }.
// 22/11 (Đưa Đối soát Fabi về lại Chốt ca, anh Tiến duyệt): khối tiền một ca ở trang đối soát ca #/ca/doi-soat?id= (bước 1–5 = tab ②, bước 6 = tab ③). Chỉ đổi chỗ trỏ, ý kiểm giữ nguyên.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 120) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const calls = (name, k0) => (window.__LOG || []).slice(k0).filter((x) => x[0] === 'rpc' && x[1] === name);
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const phone = window.innerWidth <= 400;
  const wide = (m) => { if (phone) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `${m}: không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`); };
  const go = async (tab, extra = '') => { location.hash = `#/quan-ly/so-thu-chi?tab=${tab}&cn=1&thang=2026-11${extra}&t=${Date.now()}`; await wait('#stc-book'); await sleep(500); };
  const hdrCols = () => $$('#stc-book .stc-hdr > span').length;
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  if (new URLSearchParams(location.search).get('stclock')) {   // duyệt mã I3: tháng đã chốt (&stclock=1)
    try { await go('chi'); $('.stc-ch .stc-all')?.click(); await sleep(500);
      const c171 = $('.stc-ca [data-ca="171"]')?.closest('.stc-ca');
      ok(!!c171 && txt(c171.querySelector('.stc-crow')).includes('tháng đã chốt') && txt($('.stc-calock', c171)).includes('tháng đã chốt'), '9. tháng đã chốt: dòng ca + ghi chú "Tháng đã chốt"');
      ok(!!c171 && !c171.querySelector('[data-addca]'), '9. tháng đã chốt: không còn nút "+ Thêm phiếu … vào ca" trái với ghi chú');
    } catch (e) { bad.push('LỖI CHẠY: ' + (e.message || e)); }
    out.push({ stc12: { ok: good, fail: bad } }); return;
  }
  try {
    // ===== Task 2: phần đầu + bảng ngày
    await go('thu');
    ok(!$('.stc-aside') && !$('#stc-page .stc-side'), '2. Sổ thu: không còn cột bên phải');
    ok($$('.stc-sw a.stc-pay').length === 2, '2. một nút chuyển 2 nửa Tiền mặt | Chuyển khoản');
    ok($$('.stc-tiles a.stc-tile[data-col]').length === 5 && !$$('.stc-tile').some((t) => txt(t).startsWith('tổng thu')), '2. 5 ô số, không còn ô "Tổng thu · Tiền mặt"');
    ok(txt($('.stc-formula')).includes('tổng thu tháng 11 =') && txt($('.stc-formula')).includes('bấm một ô để chỉ xem khoản loại đó'), '2. dòng công thức chữ nhỏ dưới hàng ô');
    const hid = { thu: null, chi: null };
    for (const b of ['thu', 'chi']) {
      await go(b);
      if ($('.stc-hidecols')) { hid[b] = hdrCols();
        ok(txt($('.stc-hidecols')).includes('đang ẩn cột') && txt($('.stc-hidecols')).includes('cả tháng bằng 0'), `2. Sổ ${b}: dòng "Đang ẩn cột … (cả tháng bằng 0)"`);
        $('.stc-hidecols [data-showzero]').click(); await sleep(300);
        ok(hdrCols() > hid[b] && !$('.stc-hidecols'), `2. Sổ ${b}: bấm "hiện lại" → hiện đủ cột (${hid[b]} → ${hdrCols()})`);
      }
    }
    ok(hid.thu !== null || hid.chi !== null, '2. dữ liệu thử có ít nhất một cột cả tháng bằng 0 được ẩn');
    await go('thu');
    const cellsTxt = $$('#stc-book .stc-drow .stc-c:not(.tot)').map((c) => c.textContent.trim());
    ok(cellsTxt.length > 0 && !cellsTxt.includes('–'), '2. ô bằng 0 để trống thay cho "–"');
    wide('2. phần đầu Sổ thu');
    // ===== Task 3: bấm ô → danh sách một loại + khung chuyển từ cột phải
    await go('thu', '&cot=no');
    ok(txt($('#stc-book .stc-ch h2')).includes('chỉ hiện') && txt($('#stc-book')).includes('✕ bỏ lọc'), '3. bấm ô Thu nợ → tiêu đề "chỉ hiện Thu nợ" + ✕ Bỏ lọc');
    ok(txt($('.stc-box')).includes('khách còn nợ') && !!$('[data-col-debt]'), '3. khung "Khách còn nợ" với nút Thu nợ');
    ok(!!$('#stc-book .stc-sum') && txt($('#stc-book .stc-sum')).startsWith('cộng'), '3. danh sách có dòng Cộng');
    ok(!$('#stc-book .stc-drow'), '3. đang xem một loại: không còn bảng ngày');
    $$('#stc-book a.btn').find((a) => txt(a).includes('bỏ lọc'))?.click(); await sleep(600);
    ok(!!$('#stc-book .stc-drow') && !/[?&]cot=no/.test(location.hash), '3. ✕ Bỏ lọc → về bảng ngày');
    await go('chi', '&cot=chi');
    const bx = txt($('#stc-book'));
    ok(bx.includes('chi theo loại') && bx.includes('cần phân loại') && bx.includes('đã phân loại') && bx.indexOf('cần phân loại') < bx.indexOf('đã phân loại'), '3. ô Các khoản chi: Chi theo loại + Cần phân loại trước Đã phân loại');
    ok(!!$('#stc-book [data-catx]'), '3. khoản cần phân loại có ô chọn nhóm trên dòng');
    await go('chi', '&cot=no');
    ok(!!$('#stc-book [data-prow]') && txt($('#stc-book')).includes('người nợ') && txt($('#stc-book')).includes('nợ kho tổng') && !$('#stc-book [data-person]'), '3. ô Cho nợ: khung Người nợ liệt kê từng người kèm nhóm công nợ (bước 172 thay ô ✓)');
    await go('chi', '&cot=lech');
    ok($$('#stc-book .stc-fr').length > 0 && $$('#stc-book .stc-fr').some((r) => r.querySelector('[data-gap]')), '3. ô Chênh lệch: dòng có nút Phiếu chênh lệch');
    let zc = null;
    for (const [b, pm] of [['chi', 'tm'], ['chi', 'ck'], ['thu', 'tm'], ['thu', 'ck']]) { await go(b, '&pm=' + pm); const z = $('.stc-tile.zero[data-col]'); if (z) { zc = [b, pm, z.dataset.col]; break; } }
    if (zc) { await go(zc[0], `&pm=${zc[1]}&cot=${zc[2]}`);
      ok(txt($('#stc-book')).includes('không có khoản nào') && $$('.stc-tile.on').length === 1 && !$('.stc-tile.on.zero'), `3. ô bằng 0 (${zc.join(' ')}) đang chọn: "Không có khoản nào", ô vẫn hiện rõ (đang lọc)`); }
    else bad.push('3. dữ liệu thử không có ô nào bằng 0');
    wide('3. danh sách một loại');
    // ===== Task 4: 👥 Người nợ + bộ lọc dễ đọc
    await go('chi');
    ok(!!$('#stc-book [data-people]'), '4. Sổ chi có nút 👥 Người nợ');
    // bước 172: người nợ là danh sách thật — từng người có nút Sửa (tên, SĐT, nhóm công nợ) thay cho ô ✓ không nhắc
    $('#stc-book [data-people]')?.click(); await wait('dialog[open] [data-prow]', 40); await sleep(200);
    const pd = $('dialog[open]');
    ok(!!pd && !!$('[data-prow]', pd) && !!$('[data-pedit]', pd) && txt(pd).includes('+ thêm người nợ'), '4. cửa sổ Người nợ: từng người có nút Sửa + "+ Thêm người nợ"');
    if (pd) { if (phone) ok(pd.scrollWidth <= window.innerWidth + 1, '4. cửa sổ Người nợ vừa khung điện thoại');
      const k0 = (window.__LOG || []).length; $('[data-pedit]', pd).click(); await wait('dialog[open] [name=pgrp]', 40); await sleep(200);
      $('dialog[open] button[type=submit]')?.click(); await sleep(900);
      ok(calls('app_stc_person_save', k0).length === 1, '4. Sửa một người rồi Lưu → gọi app_stc_person_save 1 lần'); $('dialog[open]')?.close(); await sleep(300); }
    await go('chi'); $('#stc-book [data-people]')?.click(); await wait('dialog[open] [data-padd]', 40); await sleep(200);
    $('dialog[open] [data-padd]')?.click(); await wait('dialog[open] [name=pname]', 40); await sleep(200);
    ok(!!$('dialog[open] [name=pname]') && !!$('dialog[open] [name=pgrp]') && !$('.stc-addp [name=kind]'), '4. "+ Thêm người nợ" mở khung thêm người thật (tên, SĐT, nhóm) — bước 172 thay cho mở phiếu Cho nợ');
    $('dialog[open] [data-x]')?.click(); await sleep(300);
    await go('chi', '&cot=chi');
    const fq = $('.stc-flt [data-lf="q"]'); setv(fq, 'mua'); await sleep(700);
    const srcSel = $('.stc-flt select[data-lf="src"]'); setv(srcSel, 'ca'); await sleep(500);
    ok(txt($('#stc-book .stc-locrow')).includes('đang lọc:') && $$('#stc-book [data-unloc]').filter((b) => b.dataset.unloc !== 'all').length === 2, '4. dòng "Đang lọc:" có 2 điều kiện');
    ok(/khoản ·/.test(txt($('#stc-book .stc-locrow'))), '4. dòng Đang lọc ghi số khoản · tổng tiền');
    ok(!!srcSel.closest('.stc-fl.on'), '4. ô chọn đang khác "Tất cả" được tô');
    $('#stc-book [data-unloc="q"]').click(); await sleep(500);
    ok($$('#stc-book [data-unloc]').filter((b) => b.dataset.unloc !== 'all').length === 1 && /[?&]cot=chi/.test(location.hash) && $('.stc-flt [data-lf="q"]').value === '', '4. bỏ ✕ Tìm → còn 1 điều kiện, vẫn giữ ô đang chọn (cot)');
    ok(!!$('#stc-book .stc-dh') && !!$('#stc-book .stc-sum'), '4. kết quả lọc nhóm theo ngày + dòng Cộng');
    $('#stc-book [data-unloc="all"]').click(); await sleep(800);
    ok(!$('#stc-book .stc-locrow'), '4. Bỏ hết → không còn dòng Đang lọc');
    if (phone) { await go('chi');
      const fb = $('.stc-fbtn'); const s0 = $('.stc-flt .stc-fl');
      ok(!!fb && !!s0 && getComputedStyle(s0).display === 'none', '4. điện thoại: ô tìm + nút ⚙ Lọc, 4 ô chọn ẩn');
      fb?.click(); await sleep(200); ok(!!s0 && getComputedStyle(s0).display !== 'none', '4. bấm ⚙ Lọc → hiện ô chọn'); }
    // ===== Task 5: mở ngày gọn, trạng thái ca một lần, Thêm phiếu 2 hàng, câu chữ Đối soát Fabi
    await go('chi'); $('.stc-ch .stc-all')?.click(); await sleep(500);
    const c172 = $('.stc-ca [data-ca="172"]')?.closest('.stc-ca');
    ok(!!c172 && txt(c172.querySelector('.stc-crow')).includes('chưa xác nhận fabi'), '5. dòng ca ghi trạng thái "⏳ Chưa xác nhận Fabi"');
    ok(!!c172 && c172.querySelectorAll('.stc-calock').length === 1 && !c172.querySelector('button.stc-act[disabled]') && !txt(c172).includes('🔒 xác nhận fabi'), '5. ca chưa xác nhận Fabi: 1 dòng ghi chú, từng khoản không lặp nút mờ / dòng 🔒');
    ok(!!c172 && !!c172.querySelector('.stc-calock a[href*="#/ca/doi-soat?id=172"]'), '5. dòng ghi chú có "Xử lý ca này ở trang đối soát ca ›"');
    ok($$('.stc-ca').some((c) => !c.querySelector('.stc-calock') && c.querySelector('.stc-ed')) || $$('.stc-ca').some((c) => !c.querySelector('.stc-calock') && txt(c.querySelector('.stc-crow')).includes('đã xác nhận fabi')), '5. ca đã xác nhận Fabi: không có ghi chú khoá, khoản sửa được giữ nút');
    $('.stc-ch .stc-add')?.click(); await wait('.stc-addp [name=ca]', 40);
    const ap = $('.stc-addp');
    ok(!!ap && ['kind', 'pay', 'date', 'ca', 'amount', 'note', 'reason'].every((nm) => ap.querySelector(`[name=${nm}]`)) && ap.querySelectorAll('.stc-ar').length === 2 && !!ap.querySelector('.stc-ar [name=kind]') && !!ap.querySelector('.stc-ar [name=amount]'), '5. Thêm phiếu: đủ ô cũ, xếp 2 hàng (Loại · Tiền · Ngày · Ca · Số tiền / Nội dung · Lý do)');
    wide('5. mở ngày + Thêm phiếu');
    location.hash = '#/ca/doi-soat?id=181&tab=tien'; await wait('.stc-dsp'); await sleep(600);
    ok(!txt($('#stc-ds')).includes('khung bên phải'), '5. Đối soát Fabi không còn nhắc "khung bên phải"');
    if (role === 'chu') {
      location.hash = '#/quan-ly/so-thu-chi?tab=chi&cn=ngoai&thang=2026-11&cot=chi&t=' + Date.now(); await wait('#stc-book'); await sleep(500);
      ok(txt($('#stc-book')).includes('phần mỗi cơ sở chịu'), '3. Quỹ ngoài · ô Các khoản chi: có "Phần mỗi cơ sở chịu"');
      ok(!$('#stc-book [data-pedit]') && !$('#stc-book [data-person]'), '3. Quỹ ngoài: khung Người nợ không có nút sửa');
    }
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.message || e)); }
  out.push({ stc12: { ok: good, fail: bad } });
};
