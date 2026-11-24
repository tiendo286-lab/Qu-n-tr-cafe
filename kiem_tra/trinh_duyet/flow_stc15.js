// Chặng 2 (anh Tiến chốt 21/11): tệp Fabi có nhưng KHÔNG có số doanh thu → ô Doanh thu ghi "Fabi không có số doanh thu", vẫn chặn,
// không có "Lấy số máy Fabi"; quản lý ghi số theo phiếu máy in bằng "Sai, sửa số" → Chủ duyệt. Ô Nợ có lời nhắc tệp thiếu số.
// Chạy role chu / qlt / ql, index.html và test/phone.html. Ca 182 (chưa xác nhận Fabi), đặt máy không có số bằng app__thu_fabi_trong.
// 22/11 (Đưa Đối soát Fabi về lại Chốt ca, anh Tiến duyệt): đường cũ ?tab=doi-soat&ds=&b=&t= tự chuyển sang trang đối soát ca (tab ② Phần tiền, giữ b= / t=); chỉ đổi cách tải lại sổ tháng.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s);
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wait = async (s, n = 60) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const gone = async (s, n = 60) => { for (let i = 0; i < n && $(s); i++) await sleep(100); return !$(s); };
  const wide = (m) => ok(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, m + ': không tràn ngang');
  const type = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const calls = (fn, from = 0) => (window.__LOG || []).slice(from).filter((x) => x[0] === 'rpc' && x[1] === fn).map((x) => x[2]);
  const role = new URLSearchParams(location.search).get('role');
  const DS = '#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11';
  const cu = (h) => { const q = new URLSearchParams(String(h).split('?')[1] || ''); const b = q.get('b') || '';   // đợt 4: mở thẳng trang cũ dự phòng
    return q.get('ds') ? '#/ca/doi-soat-cu?id=' + q.get('ds') + '&tab=' + (b === '6' ? 'xong' : 'tien') + (b && b !== '6' ? '&b=' + b : '') + (q.get('t') ? '&t=' + q.get('t') : '') : h; };
  const open = async (b = 1) => { location.hash = '#/quan-ly/so-thu-chi?tab=tong&cn=1&thang=2026-10&t=' + Date.now(); await sleep(300); for (let i = 0; i < 80 && !document.querySelector('.stc-tabs'); i++) await sleep(100);   // 22/11: tab Đối soát Fabi đã bỏ → mở tab Tổng tháng 10 để tải lại số tháng 11
    location.hash = cu(DS + '&ds=182&b=' + b + '&t=' + Date.now()); await sleep(400); await wait('.stc-dsp'); await sleep(500); };
  const dt = () => $('.stc-dsp .stc-c4[data-k="dt"]');
  const no = () => $('.stc-dsp .stc-c4[data-k="no"]');
  const dlg = () => $('dialog[open]');
  const redraw = async () => { await sleep(900); await wait('.stc-dsp'); await sleep(350); };
  const sb = (await import('/js/sb.js')).sb;
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    await sb.rpc('app__thu_fabi_trong', { p_report: 182 });
    await open();
    ok(dt()?.classList.contains('red'), '1. ô Doanh thu vẫn chặn (đỏ)');
    ok(txt(dt()).includes('fabi không có số doanh thu'), '2. ô ghi "Fabi không có số doanh thu"');
    ok(txt(dt()).includes('máy fabi ghi: không có số') && !txt(dt()).includes('máy fabi ghi: 0'), '3. dòng "Máy Fabi ghi: không có số" (không ghi 0)');
    ok(!dt().querySelector('[data-dsfabi]'), '4. không có nút "Lấy số máy Fabi" ở ô Doanh thu');
    ok(!!dt().querySelector('[data-dsfix="dt"]'), '5. có nút "Sai, sửa số"');
    ok(txt(dt()).includes('phiếu máy in'), '6. hướng dẫn ghi số theo phiếu máy in');
    ok(txt(no()).includes('thiếu số'), '7. ô Nợ có lời nhắc: tệp Fabi thiếu số');
    wide('bước 1 ca máy không có số');
    // gửi số theo phiếu máy in
    dt().querySelector('[data-dsfix="dt"]').click(); await wait('dialog[open] [name=ftm]', 40); await sleep(200);
    ok(txt(dlg()).includes('không có số doanh thu') && $('[name=ftm]', dlg()).value === '' && $('[name=fck]', dlg()).value === '', '8. hộp sửa số: ghi máy không có số, ô tiền mặt / chuyển khoản để trống');
    wide('hộp sửa số');
    let k0 = (window.__LOG || []).length;
    type($('[name=ftm]', dlg()), '2.100.000'); type($('[name=fck]', dlg()), '3.050.000'); type($('[name=reason]', dlg()), 'Máy Fabi không có số, ghi theo phiếu máy in');
    $('button[type=submit]', dlg()).click(); await gone('dialog[open] [name=ftm]', 40); await redraw();
    const c1 = calls('app_stc_fix_request', k0);
    ok(c1.length === 1 && Number(c1[0].p_report) === 182 && c1[0].p_field === 'dt' && Number(c1[0].p?.tm) === 2100000 && Number(c1[0].p?.ck) === 3050000, '9. gửi đúng ca, ô Doanh thu, 2 số');
    if (role === 'chu') {
      ok(dt()?.classList.contains('ok') && txt(dt()).includes('chủ đã duyệt') && txt(dt()).includes('máy không có số'), '10. Chủ gửi → duyệt ngay: ô xanh, ghi "máy không có số"');
    } else {
      ok(txt(dt()).includes('chờ chủ duyệt') && !dt().querySelector('[data-dsfabi]'), '10. quản lý: chờ Chủ duyệt, vẫn không có "Lấy số máy Fabi"');
      await open(2); ok($('.stc-dsp [data-dsclose]')?.disabled === true, '11. bước 2: Xác nhận Fabi còn khoá'); await open(1);
    }
    wide('ô bước 1 sau khi gửi số');
  } catch (e) { bad.push('LỖI CHẠY: ' + (e?.message || e)); }
  out.push({ stc15: { ok: good, fail: bad } });
};
