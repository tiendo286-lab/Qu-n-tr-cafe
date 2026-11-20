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

    // ---- b. + Thêm phiếu › Cho nợ: chỉ chọn người có sẵn trong danh sách (không gõ tên)
    const addNo = async () => { await go(CHI); $('button.stc-add')?.click(); await wait('.stc-addp [name=kind]', 40); await sleep(200); type($('.stc-addp [name=kind]'), 'no'); await sleep(250); return $('.stc-addp'); };
    let box = await addNo();
    let ps = $('select[name=name]', box);
    ok(!!ps && !$('input[name=name]', box), 'b. Cho nợ: ô Người nợ là ô chọn, không còn ô gõ tên');
    ok(!!ps && $$('option', ps).some((o) => o.value === 'Kho Tổng') && $$('option', ps).some((o) => o.value === 'Bàn 5'), 'b. ô chọn có những người đang dùng');
    ok(!!ps && !$$('option', ps).some((o) => o.value === 'Anh Thắng xe ôm'), 'b. người đã ngừng dùng không còn trong ô chọn');
    ok(!!ps && $$('optgroup', ps).length >= 2 && !!$('option[value="__add"]', ps), 'b. chia theo nhóm công nợ, cuối danh sách có "+ Thêm người nợ…"');
    wide('b. khung Thêm phiếu › Cho nợ');
    if (ps) {
      type($('[name=amount]', box), '70.000'); $('[type=submit]', box).click(); await sleep(600);
      ok(txt($('.stc-addp .stc-err')).includes('chọn người nợ'), 'b. chưa chọn người → báo "Chọn người nợ."');
      let k1 = (window.__LOG || []).length; type(ps, 'Kho Tổng'); $('[type=submit]', box).click(); await gone('.stc-addp', 40); await sleep(700);
      const c1 = calls('app_stc_debt_save', k1);
      ok(c1.length === 1 && c1[0].args?.p?.name === 'Kho Tổng' && c1[0].args?.p?.grp === 'kho', 'b. chọn Kho Tổng → lưu Cho nợ với đúng tên + nhóm của người đó');
      // + Thêm người nợ… ngay trong ô chọn → thêm xong người mới được chọn sẵn, khung Thêm phiếu vẫn mở
      box = await addNo(); ps = $('select[name=name]', box);
      type(ps, '__add'); await wait('dialog[open] [name=pname]', 40); await sleep(200);
      ok(!!$('dialog[open] [name=pname]'), 'b. chọn "+ Thêm người nợ…" → mở khung thêm người');
      type($('dialog[open] [name=pname]'), 'Chị Hoa rau'); $('dialog[open] button[type=submit]')?.click(); await gone('dialog[open] [name=pname]', 40); await sleep(500);
      ps = $('.stc-addp select[name=name]');
      ok(!!$('.stc-addp') && ps?.value === 'Chị Hoa rau', 'b. thêm xong: khung Thêm phiếu vẫn mở, người mới được chọn sẵn');
      $('.stc-addp [data-x]')?.click(); await sleep(200);
    }

    // ---- c. bước 1 của ca: quản lý xếp người + nhóm công nợ cho từng khoản nợ mới (ca 182: Bàn 5, Bàn 3 còn nợ; Chị Lan đã trả)
    const DS = '#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11';
    const openCa = async (id, b) => { location.hash = DS + '&ds=' + id + (b ? '&b=' + b : '') + '&t=' + Date.now(); await sleep(400); await wait('.stc-dsp'); await sleep(500); };
    const sortItem = () => $$('.stc-dsp .stc-chk .stc-ci').find((x) => txt(x).includes('nợ mới của ca'));
    const rows = () => $$('.stc-dsp .stc-cdr[data-t="moi"]');
    const rowOf = (name) => rows().find((x) => txt(x).includes(name));
    const redraw = async () => { await sleep(900); await wait('.stc-dsp'); await sleep(350); };
    await openCa(182, 1);
    ok(!!sortItem() && sortItem().classList.contains('auto') && !sortItem().classList.contains('ok'), 'c. bước 1 có mục "Nợ mới của ca đã xếp đúng người + nhóm công nợ", đang chưa xong');
    ok(!!rowOf('bàn 5')?.querySelector('[data-dsort]') && !!rowOf('bàn 3')?.querySelector('[data-dsort]'), 'c. khoản nợ mới còn tiền chưa thu có ô xếp người + nhóm');
    ok(!!rowOf('chị lan') && !rowOf('chị lan').querySelector('[data-dsort]'), 'c. khoản đã trả không có ô xếp');
    wide('c. bước 1 có ô xếp nợ');
    let r = rowOf('bàn 5');
    ok(r?.querySelector('select[data-dperson]')?.value === 'Bàn 5' && r?.querySelector('select[data-dgrp]')?.value === 'khach', 'c. Bàn 5 có trong danh sách → web gợi ý sẵn người + nhóm Nợ khách hàng');
    const k2 = (window.__LOG || []).length; r?.querySelector('[data-dsortok]')?.click(); await redraw();
    const c2 = calls('app_stc_debt_sort', k2);
    ok(c2.length === 1 && Number(c2[0].args?.p_debt) === 701 && Number(c2[0].args?.p_person) === 2 && c2[0].args?.p_grp === 'khach', 'c. bấm Xếp → gọi app_stc_debt_sort đúng khoản, đúng người, đúng nhóm');
    r = rowOf('bàn 5');
    ok(!!r && !r.querySelector('[data-dsortok]') && txt(r).includes('nợ khách hàng') && !!r.querySelector('[data-dsortedit]'), 'c. xếp xong: dòng hiện nhóm "Nợ khách hàng" + nút Đổi, không còn nút Xếp');
    ok(!!sortItem() && !sortItem().classList.contains('ok'), 'c. còn 1 khoản chưa xếp → mục vẫn chưa xong');
    r = rowOf('bàn 3');
    ok(r?.querySelector('select[data-dperson]')?.value === '', 'c. tên nhân viên gõ không có trong danh sách → chưa gợi ý ai');
    r?.querySelector('[data-dsortok]')?.click(); await sleep(600);
    ok(calls('app_stc_debt_sort', k2).length === 1, 'c. chưa chọn người thì chưa gửi lên máy chủ');
    r = rowOf('bàn 3');
    if (r?.querySelector('select[data-dperson]')) {
      type(r.querySelector('select[data-dperson]'), 'Cô Lan Anh'); type(r.querySelector('select[data-dgrp]'), 'khac');
      r.querySelector('[data-dsortok]').click(); await redraw();
    }
    r = rows().find((x) => txt(x).includes('cô lan anh'));
    ok(!!r && txt(r).includes('nợ khác') && txt(r).includes('nv ghi: bàn 3'), 'c. xếp khoản 2: tên theo danh sách, nhóm Nợ khác, giữ dòng "NV ghi: Bàn 3"');
    ok(!!sortItem() && sortItem().classList.contains('ok'), 'c. xếp hết → mục tự tích ✓');
    r?.querySelector('[data-dsortedit]')?.click(); await sleep(350);
    ok(!!rows().find((x) => txt(x).includes('cô lan anh'))?.querySelector('[data-dsortok]'), 'c. bấm Đổi → mở lại ô xếp của khoản đó');
    wide('c. sau khi xếp');

    // ---- d. còn nợ mới chưa xếp thì không Hoàn thành được (ca 181 đã xác nhận Fabi; dùng lối thêm nợ riêng của bộ thử)
    const sb = (await import('/js/sb.js')).sb;
    const tryRpc = async (fn, args) => { try { const x = await sb.rpc(fn, args); return x?.error?.message || ''; } catch (e) { return e?.message || String(e); } };
    await tryRpc('app__thu_them_no_ca', { p_report: 181, p_who: 'Bàn 12 chưa trả', p_amount: 45000 });
    await openCa(181, 6);
    $('.stc-dsp [data-dsundone]')?.click(); await redraw();   // Mở lại bằng nút trên màn hình (màn hình tải lại số mới, thấy khoản nợ vừa thêm)
    const e1 = await tryRpc('app_stc_ds_done', { p_report: 181 });
    ok(e1.includes('phanloai'), 'd. máy chủ từ chối Hoàn thành khi còn nợ mới chưa xếp: ' + e1.slice(0, 80));
    await openCa(181, 6);
    ok($('.stc-dsp [data-dsdone]')?.disabled === true, 'd. bước 6: nút Hoàn thành đang khoá');
    await openCa(181, 1);
    r = rowOf('bàn 12');
    if (r?.querySelector('select[data-dperson]')) { type(r.querySelector('select[data-dperson]'), 'Bàn 5'); r.querySelector('[data-dsortok]').click(); await redraw(); }
    const e2 = await tryRpc('app_stc_ds_done', { p_report: 181 });
    ok(!e2.includes('phanloai'), 'd. xếp xong thì mục xếp nợ không còn chặn Hoàn thành' + (e2 ? ' (còn thiếu mục khác: ' + e2.slice(0, 60) + ')' : ''));
    if (!e2) await tryRpc('app_stc_ds_undone', { p_report: 181 });

    // ---- e. sửa khoản nợ của ca ở bước 1 (thiết kế sua-no-cua-ca): ca 182 — Cô Lan Anh (TM 85.000, chưa trả), Bàn 5 (HĐ), Chị Lan (CK, đã trả)
    await openCa(182, 1);
    r = rows().find((x) => txt(x).includes('cô lan anh'));
    ok(!!r?.querySelector('[data-dedit]'), 'e. khoản nợ tiền mặt chưa trả có nút Sửa / Xoá');
    ok(!!rowOf('bàn 5') && !rowOf('bàn 5').querySelector('[data-dedit]') && txt(rowOf('bàn 5')).includes('nợ hoá đơn'), 'e. nợ hoá đơn không có nút, ghi rõ "Nợ hoá đơn — số tiền theo ô Nợ bill"');
    ok(!!rowOf('chị lan') && !rowOf('chị lan').querySelector('[data-dedit]') && txt(rowOf('chị lan')).includes('khách đã trả'), 'e. khoản khách đã trả không có nút, ghi rõ phải Huỷ thu trước');
    ok(!!$('.stc-dsp [data-dadd="182"]'), 'e. có nút "+ Thêm khoản nợ quên ghi"');
    // sửa số tiền: thiếu lý do → báo; có lý do → gửi đúng
    r?.querySelector('[data-dedit]')?.click(); await wait('dialog[open] [name=damt]', 40); await sleep(200);
    let dg = dlg();
    ok(!!dg && $('[name=damt]', dg)?.value === '85.000' && $('[name=dkind]', dg)?.value === 'muon' && !!$('.stc-del', dg) && !!$('[data-dexch]', dg), 'e. hộp Sửa: số tiền, loại TM / CK, nút Xoá khoản nợ, nút Đổi thành Luân chuyển');
    wide('e. hộp sửa khoản nợ');
    let k3 = (window.__LOG || []).length;
    type($('[name=damt]', dg), '80.000'); $('button[type=submit]', dg).click(); await sleep(600);
    ok(calls('app_stc_ca_debt_save', k3).length === 1 && txt($('.stc-err', dlg())).includes('ghi lý do'), 'e. chưa ghi lý do → máy chủ từ chối, hộp báo "Ghi lý do"');
    k3 = (window.__LOG || []).length;
    type($('[name=reason]', dlg()), 'NV ghi nhầm số'); $('button[type=submit]', dlg()).click(); await gone('dialog[open] [name=damt]', 40); await redraw();
    let c3 = calls('app_stc_ca_debt_save', k3);
    ok(c3.length === 1 && Number(c3[0].args?.p_report) === 182 && Number(c3[0].args?.p_debt) === 702 && c3[0].args?.p?.kind === 'muon' && Number(c3[0].args?.p?.amount) === 80000 && c3[0].args?.p_reason === 'NV ghi nhầm số', 'e. Lưu → gửi đúng ca, đúng khoản, 80.000, lý do');
    r = rows().find((x) => txt(x).includes('cô lan anh'));
    ok(!!r && txt(r).includes('80.000') && txt(r).includes('quản lý sửa') && txt(r).includes('85.000 → 80.000') && txt(r).includes('nv ghi nhầm số'), 'e. dòng hiện số mới + "Quản lý sửa · 85.000 → 80.000 · … lý do"');
    // đổi TM → CK
    r?.querySelector('[data-dedit]')?.click(); await wait('dialog[open] [name=dkind]', 40); await sleep(200);
    k3 = (window.__LOG || []).length; type($('[name=dkind]', dlg()), 'ck'); type($('[name=reason]', dlg()), 'Khách hứa chuyển khoản'); $('button[type=submit]', dlg()).click(); await gone('dialog[open] [name=damt]', 40); await redraw();
    ok(calls('app_stc_ca_debt_save', k3)[0]?.args?.p?.kind === 'ck', 'e. đổi Tiền mặt → Chuyển khoản');
    // xoá
    r = rows().find((x) => txt(x).includes('cô lan anh'));
    r?.querySelector('[data-dedit]')?.click(); await wait('dialog[open] .stc-del', 40); await sleep(200);
    ok(!$('[data-dexch]', dlg()), 'e. khoản chuyển khoản không có nút Đổi thành Luân chuyển');
    k3 = (window.__LOG || []).length; type($('[name=reason]', dlg()), 'Không phải nợ'); $('.stc-del', dlg()).click(); await gone('dialog[open] .stc-del', 40); await redraw();
    ok(calls('app_stc_ca_debt_delete', k3).length === 1 && !rows().some((x) => txt(x).includes('cô lan anh')), 'e. Xoá khoản nợ → gửi xoá, dòng không còn trong Nợ mới');
    const gone1 = $$('.stc-dsp .stc-cdr[data-t="xoa"]').find((x) => txt(x).includes('cô lan anh'));
    ok(!!gone1 && txt(gone1).includes('đã xoá') && txt(gone1).includes('không phải nợ'), 'e. khoản đã xoá hiện dòng gạch ngang "Đã xoá · … lý do"');
    // thêm khoản quên ghi
    $('.stc-dsp [data-dadd="182"]')?.click(); await wait('dialog[open] [name=dperson]', 40); await sleep(200); dg = dlg();
    ok(!!dg && !!$('select[name=dperson]', dg) && !!$('[name=dgrp]', dg) && !!$('[name=dnote]', dg), 'e. hộp Thêm: loại, người nợ (ô chọn), nhóm, số tiền, nội dung, lý do');
    type($('[name=dperson]', dg), 'Kho Tổng'); await sleep(100);
    ok($('[name=dgrp]', dg)?.value === 'kho', 'e. chọn Kho Tổng → nhóm tự là Nợ kho tổng');
    k3 = (window.__LOG || []).length;
    type($('[name=damt]', dg), '30.000'); type($('[name=dnote]', dg), 'mượn tiền lẻ'); type($('[name=reason]', dg), 'NV quên ghi'); $('button[type=submit]', dg).click(); await gone('dialog[open] [name=dperson]', 40); await redraw();
    c3 = calls('app_stc_ca_debt_save', k3);
    ok(c3.length === 1 && c3[0].args?.p_debt == null && Number(c3[0].args?.p?.person_id) === 1 && c3[0].args?.p?.grp === 'kho' && Number(c3[0].args?.p?.amount) === 30000 && c3[0].args?.p?.note === 'mượn tiền lẻ', 'e. Thêm → gửi đúng người, nhóm, số tiền, nội dung');
    r = rows().find((x) => txt(x).includes('kho tổng'));
    ok(!!r && txt(r).includes('quản lý ghi') && txt(r).includes('30.000'), 'e. khoản vừa thêm hiện với nhãn "Quản lý ghi"');
    // đổi thành Luân chuyển (khoản TM vừa thêm)
    r?.querySelector('[data-dedit]')?.click(); await wait('dialog[open] [data-dexch]', 40); await sleep(200);
    const oldConfirm = window.confirm; window.confirm = () => true;
    k3 = (window.__LOG || []).length; type($('[name=reason]', dlg()), 'Khách CK rồi rút tiền'); $('[data-dexch]', dlg()).click(); await gone('dialog[open] [data-dexch]', 40); await redraw();
    window.confirm = oldConfirm;
    ok(calls('app_stc_ca_debt_to_exchange', k3).length === 1 && !rows().some((x) => txt(x).includes('kho tổng')), 'e. Đổi thành Luân chuyển → gửi đổi, khoản nợ không còn');
    ok($$('.stc-dsp .stc-cdr[data-t="xoa"]').some((x) => txt(x).includes('kho tổng') && txt(x).includes('luân chuyển')), 'e. hiện dòng "Đã đổi thành Luân chuyển TM – CK"');
    wide('e. khung nợ sau khi sửa');
    // dòng khoá "Khách mượn" ở bước 4 chỉ về bước 1 (ca 181 đã xác nhận, đang mở)
    await openCa(181, 4);
    const km = $$('.stc-dsp .stc-it').find((x) => txt(x).includes('khách mượn – chị hoa'));
    ok(!!km && txt(km).includes('sửa ở bước 1') && !!km.querySelector('button[data-dsstep="0"]'), 'e. bước 4: dòng Khách mượn ghi "sửa ở bước 1 · Nợ của ca", chữ "bước 1" bấm được');
    km?.querySelector('button[data-dsstep="0"]')?.click(); await sleep(400);
    ok($('.stc-dsp .stc-steps [data-dsstep].on')?.dataset.dsstep === '0', 'e. bấm "bước 1" → về bước 1');
    await go('#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11&cot=no');
    const km2 = $$('#stc-book .stc-it').find((x) => txt(x).includes('khách mượn – chị hoa'));
    ok(!!km2 && txt(km2).includes('đối soát fabi › bước 1'), 'e. Sổ chi: dòng Khách mượn ghi "sửa ở Đối soát Fabi › bước 1"');
    // dòng khoá "Lương trả tiền mặt" chỉ sang trang Đối soát ca › Ai làm ca (nơi sửa ô Đã trả lương tiền mặt), có liên kết mở đúng ca
    await go('#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11&cot=chi');
    const lg = $$('#stc-book .stc-it').find((x) => txt(x).includes('chi lương – minh'));
    ok(!!lg && txt(lg).includes('lương tiền mặt — sửa ở đối soát ca › ai làm ca') && !!lg.querySelector('a[href*="#/quan-ly/doi-soat/ca?id=181"]'), 'e. dòng Lương tiền mặt: "sửa ở Đối soát ca › Ai làm ca" + liên kết mở đúng ca');
  } catch (e) { bad.push('LỖI CHẠY: ' + (e?.message || e)); }
  out.push({ ds172: { ok: good, fail: bad } });
};
