// Bài thử bước 162: giờ chốt ca theo file Fabi + sửa tay (dòng giờ + ô sửa dùng chung) ở Sổ thu chi › Đối soát Fabi và trang Đối soát ca.
// Chạy: index.html?auto=1&confirm=1&script=flow_gio162 với role=chu | qlt | ql, và test/phone.html. Kết quả: out[].gio162 = { ok, fail }.
// Dữ liệu giả (stc_gia.js): ca 181 Sáng 18/11 có file Fabi vô lý (23:59) → sửa tay được; ca 182 Chiều có file → theo file Fabi; ca 183 Tối không file.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s);
  const wait = async (sel, n = 120) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const dlg = () => $('dialog[open]');
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const calls = (name, k0) => (window.__LOG || []).slice(k0).filter((x) => x[0] === 'rpc' && x[1] === name);
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const phone = window.innerWidth <= 400;
  const DS = '#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11';
  const openDs = async (id) => { location.hash = DS + '&ds=' + id + '&b=1&t=' + Date.now(); await wait('.stc-dsp'); await wait('.stc-pa .stc-gio[data-gio-state="done"]', 60); await sleep(200); };
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    // 1. ca 181: file Fabi vô lý → hiện "không hợp lệ, sửa tay" + nút sửa
    await openDs(181);
    const g1 = $('.stc-pa .stc-gio');
    ok(txt(g1).includes('giờ doanh thu') && txt(g1).includes('06:45 → 12:30'), '1. Đối soát Fabi phần A có dòng "Giờ doanh thu 06:45 → 12:30"');
    ok(txt(g1).includes('không hợp lệ, sửa tay') && !!$('[data-gio]', g1), '1. file Fabi vô lý → "không hợp lệ, sửa tay" + nút ✎ Sửa giờ chốt');
    if (role === 'chu') {
      $('[data-gio]', g1).click(); await wait('dialog[open] [name=end]', 40); await sleep(200);
      const d = dlg();
      ok(!!d && txt(d).includes('sửa giờ chốt'), '2. bấm nút → mở ô Sửa giờ chốt');
      if (d) {
        setv($('[name=end]', d), '2026-11-18T12:45'); await sleep(100);
        ok(txt($('.gio-pv', d)).includes('ca chiều đổi giờ bắt đầu: 12:30 → 12:45'), '2. báo trước "Ca Chiều đổi giờ bắt đầu: 12:30 → 12:45"');
        if (phone) ok(d.scrollWidth <= window.innerWidth + 1, `2. ô sửa vừa khung điện thoại (${d.scrollWidth}/${window.innerWidth})`);
        const k0 = (window.__LOG || []).length;
        $('button[type=submit]', d).click(); await sleep(400);
        ok(txt($('.gio-err', d)).includes('phải ghi lý do sửa giờ.') && !calls('app_ca_gio_save', k0).length, '3. Lưu khi trống lý do → báo "Phải ghi lý do sửa giờ.", không gửi máy chủ');
        await sleep(900);
        setv($('[name=reason]', d), 'chốt ca bổ sung');
        const k1 = (window.__LOG || []).length;
        $('button[type=submit]', d).click(); $('button[type=submit]', d)?.click(); await sleep(1500);
        ok(calls('app_ca_gio_save', k1).length === 1, `3. bấm Lưu 2 lần nhanh → gửi đúng 1 lần (${calls('app_ca_gio_save', k1).length})`);
        await openDs(181);
        ok(txt($('.stc-pa .stc-gio')).includes('06:45 → 12:45'), '3. lưu xong dòng giờ đổi thành 06:45 → 12:45');
        await openDs(182);
        ok(txt($('.stc-pa .stc-gio')).includes('12:45 →'), '3. ca Chiều tự đổi giờ bắt đầu thành 12:45');
      }
    }
    // 4. ca 182: có file Fabi → theo file, không có nút
    await openDs(182);
    const g2 = $('.stc-pa .stc-gio');
    ok(txt(g2).includes('theo file fabi') && !$('[data-gio]', g2), '4. ca có file Fabi → "theo file Fabi", không có nút sửa');
    // 5. ca 183: không file → có nút (mọi vai được phép)
    await openDs(183);
    ok(!!$('.stc-pa .stc-gio [data-gio]'), '5. ca không có file Fabi → có nút ✎ Sửa giờ chốt (' + role + ')');
    if (phone) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `5. Đối soát Fabi không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`);
    // 6. trang đối soát ca — 22/11 (Đưa Đối soát Fabi về lại Chốt ca, anh Tiến duyệt): thẻ "Phần tiền · làm ở Sổ thu chi" đã bỏ, khối tiền nằm ngay tab ② của trang
    //   → dòng giờ + nút sửa ở bước 1 của tab ② (ca 183 không có file Fabi: vai nào được giao cũng có nút). Mục 1–5 ở trên mở bằng đường cũ (tự chuyển sang trang này).
    if (role === 'chu' || role === 'ql') {
      location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca/doi-soat?id=183&tab=tien&b=1';
      await wait('.ds-ptabs'); await wait('[data-tab-pane="tien"] .stc-pa .stc-gio[data-gio-state="done"]', 60); await sleep(300);
      const g = $('[data-tab-pane="tien"] .stc-pa .stc-gio');
      ok(!!g && txt(g).includes('giờ doanh thu') && !!$('[data-gio]', g) && !$('[data-tab-pane="tien"]').hidden, '6. Đối soát ca: tab ② Phần tiền có dòng giờ + nút sửa (' + role + ', cơ sở được giao)'
        + (g ? '' : ` [ô=${!!$('.stc-gio')} trang="${txt($('#root .page-head, #root h1')).slice(0, 120)}"]`));
      if (role === 'chu' && g && $('[data-gio]', g)) { $('[data-gio]', g).click(); await wait('dialog[open] [name=end]', 40); ok(!!dlg() && txt(dlg()).includes('sửa giờ chốt'), '6. nút ở Đối soát ca mở cùng ô sửa'); dlg()?.close(); await sleep(200); }
      if (phone) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, '6. Đối soát ca không tràn ngang');
    }
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.message || e)); }
  out.push({ gio162: { ok: good, fail: bad } });
};
