// Bước 172 (đợt B, phần quản lý): người nợ thật + xếp người / nhóm công nợ cho nợ mới của ca. Chạy role chu / qlt / ql, index.html và test/phone.html.
//  a. Sổ chi › 👥 Người nợ: danh sách thật (tên, SĐT, nhóm công nợ) — thêm, trùng tên, sửa nhóm, ngừng dùng; Kho Tổng không ngừng dùng được
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wait = async (s, n = 60) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const gone = async (s, n = 60) => { for (let i = 0; i < n && $(s); i++) await sleep(100); return !$(s); };
  const wide = (m) => ok(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, m + ': không tràn ngang');
  const CHI = '#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11';
  const go = async (h) => { location.hash = h + '&t=' + Date.now(); await sleep(500); await wait('#stc-book'); await sleep(500); };
  const dlg = () => $('dialog[open]');
  const type = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const people = async () => { $('#stc-book [data-people]')?.click(); await wait('dialog[open] [data-prow]', 40); await sleep(250); return dlg(); };
  const row = (pd, name) => $$('[data-prow]', pd).find((r) => txt(r).includes(name.toLowerCase()));
  const calls = (fn, from = 0) => (window.__LOG || []).slice(from).filter((x) => x[0] === 'rpc' && x[1] === fn).map((x) => ({ fn: x[1], args: x[2] }));
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    // ---- a. hộp 👥 Người nợ là danh sách thật
    await go(CHI);
    ok(!!$('#stc-book [data-people]'), 'a. Sổ chi có nút 👥 Người nợ');
    let pd = await people();
    ok(!!pd && $$('[data-prow]', pd).length >= 3, 'a. cửa sổ Người nợ liệt kê từng người (data-prow)');
    ok(!!row(pd, 'kho tổng') && txt(row(pd, 'kho tổng')).includes('nợ kho tổng'), 'a. Kho Tổng mang nhãn nhóm "Nợ kho tổng"');
    ok(!!row(pd, 'bàn 5') && txt(row(pd, 'bàn 5')).includes('nợ khách hàng') && txt(row(pd, 'bàn 5')).includes('50.000'), 'a. Bàn 5: nhóm "Nợ khách hàng", còn nợ 50.000');
    ok(!$('[data-person]', pd), 'a. không còn ô tích "✓ không nhắc" (thay bằng nhóm công nợ)');
    wide('a. cửa sổ Người nợ');
    // thêm người: mở khung thêm người thật, không mở phiếu Cho nợ
    $('[data-padd]', pd)?.click(); await wait('dialog[open] [name=pname]', 40); await sleep(200);
    let f = dlg();
    ok(!!f && !!$('[name=pname]', f) && !!$('[name=pphone]', f) && $$('[name=pgrp] option', f).length === 3 && !$('.stc-addp [name=kind]'), 'a. "+ Thêm người nợ" mở khung thêm người (tên, SĐT, 3 nhóm), không mở phiếu Cho nợ');
    wide('a. khung thêm người');
    if (f) {
      let k0 = (window.__LOG || []).length;
      type($('[name=pname]', f), 'Anh Thắng xe ôm'); type($('[name=pphone]', f), '0912000172'); type($('[name=pgrp]', f), 'khac');
      $('button[type=submit]', f)?.click(); await gone('dialog[open] [name=pname]', 40); await sleep(700);
      const c = calls('app_stc_person_save', k0);
      ok(c.length === 1 && c[0].args?.p?.name === 'Anh Thắng xe ôm' && c[0].args?.p?.grp === 'khac' && c[0].args?.p_id == null, 'a. lưu → gọi app_stc_person_save 1 lần với tên + nhóm');
      pd = await people();
      const r = row(pd, 'anh thắng xe ôm');
      ok(!!r && txt(r).includes('nợ khác') && txt(r).includes('0912000172'), 'a. người mới hiện trong danh sách với nhóm "Nợ khác" + SĐT');
      // thêm trùng tên (khác hoa thường) → báo lỗi, khung vẫn mở
      $('[data-padd]', pd)?.click(); await wait('dialog[open] [name=pname]', 40); await sleep(200); f = dlg();
      type($('[name=pname]', f), 'anh thắng XE ÔM'); $('button[type=submit]', f)?.click(); await sleep(700);
      ok(!!dlg() && txt($('.stc-err', dlg())).includes('đã có người nợ tên này'), 'a. thêm trùng tên → báo "Đã có người nợ tên này."');
      $('[data-x]', dlg())?.click(); await sleep(300);
      // sửa nhóm
      pd = await people(); row(pd, 'anh thắng xe ôm')?.querySelector('[data-pedit]')?.click(); await wait('dialog[open] [name=pname]', 40); await sleep(200); f = dlg();
      ok(!!f && $('[name=pname]', f)?.value === 'Anh Thắng xe ôm' && $('[name=pgrp]', f)?.value === 'khac' && !!$('[data-poff]', f), 'a. Sửa: khung mở sẵn tên + nhóm, có nút Ngừng dùng');
      type($('[name=pgrp]', f), 'khach'); $('button[type=submit]', f)?.click(); await gone('dialog[open] [name=pname]', 40); await sleep(700);
      pd = await people();
      ok(txt(row(pd, 'anh thắng xe ôm')).includes('nợ khách hàng'), 'a. đổi nhóm → nhãn đổi thành "Nợ khách hàng"');
      // ngừng dùng
      row(pd, 'anh thắng xe ôm')?.querySelector('[data-pedit]')?.click(); await wait('dialog[open] [data-poff]', 40); await sleep(200);
      k0 = (window.__LOG || []).length; $('[data-poff]', dlg())?.click(); await gone('dialog[open] [name=pname]', 40); await sleep(700);
      ok(calls('app_stc_person_save', k0)[0]?.args?.p?.active === 0, 'a. Ngừng dùng → lưu active = 0');
      pd = await people();
      const off = row(pd, 'anh thắng xe ôm');
      ok(!!off && off.classList.contains('off') && txt(off).includes('ngừng dùng'), 'a. người ngừng dùng vẫn nằm trong danh sách, chữ mờ, có nhãn "ngừng dùng"');
      ok($$('[data-prow]', pd).indexOf(off) === $$('[data-prow]', pd).length - 1, 'a. người ngừng dùng xếp cuối');
    }
    // Kho Tổng: không đổi tên, không ngừng dùng
    pd = dlg() || await people(); row(pd, 'kho tổng')?.querySelector('[data-pedit]')?.click(); await wait('dialog[open] [name=pname]', 40); await sleep(200); f = dlg();
    ok(!!f && $('[name=pname]', f)?.disabled === true && !$('[data-poff]', f), 'a. Kho Tổng: ô tên khoá, không có nút Ngừng dùng');
    wide('a. khung sửa người');
    $('[data-x]', dlg())?.click(); await sleep(300); $('dialog[open] [data-x]')?.click(); await sleep(200);
  } catch (e) { bad.push('LỖI CHẠY: ' + (e?.message || e)); }
  out.push({ ds172: { ok: good, fail: bad } });
};
