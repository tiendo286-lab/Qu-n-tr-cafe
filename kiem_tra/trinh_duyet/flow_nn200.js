// Tệp 200 — Thêm người vào ca: 3 loại (Nhân viên trong quán · Nhân viên cũ · Người ngoài). role=ql|chu|qlt · index.html và test/phone.html.
// A. Chốt ca, bước Nhân viên: nút thứ ba "Người ngoài", gõ tên → thêm mới, không tạo trùng, không lẫn vào Nhân viên cũ.
// B. Trang đối soát ca (ca giả 182): hộp "Thêm người hỗ trợ" chọn loại người; người ngoài mới thêm được ngay trong hộp.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wait = async (s, n = 80) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const until = async (f, n = 80) => { for (let i = 0; i < n; i++) { try { if (f()) return true; } catch (_) { /* chờ */ } await sleep(100); } return false; };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(250); location.hash = h; await sleep(500); if (sel) await wait(sel, 200); await sleep(400); };
  const typ = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const chg = (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  const L = () => window.__LOG.filter((x) => x[0] === 'rpc'); const since = (n) => L().slice(n);
  const submit = (f) => (f.requestSubmit ? f.requestSubmit() : f.querySelector('button[type=submit]')?.click());
  const people = () => $$('.cm-person').map((x) => x.innerText).join(' | ');
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2000);
    const { rpc } = await import('../js/sb.js');
    for (const m of ['../js/chot_ca_moi.js', '../js/pages/phieu_ca.js']) await Promise.race([import(m).catch(() => {}), sleep(4000)]);

    // ---------- A. Chốt ca ----------
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const o = ov.find((x) => x.shift === 'Tối') || ov[ov.length - 1];
    const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
    await go('#/ca/phieu?id=' + id, '#cm-claim');
    $('#cm-claim')?.click(); await wait('[data-hp]', 100); await sleep(800);
    const tabs = $$('[data-hp]').map((b) => b.innerText.trim());
    ok(tabs.join('|') === 'Nhân viên trong quán|Nhân viên cũ|Người ngoài', `chốt ca có 3 nút loại người: ${tabs.join(' | ')}`);
    ok(fits(), `chốt ca: 3 nút không tràn ngang (${document.documentElement.clientWidth}/${document.documentElement.scrollWidth})`);
    const n0 = $$('.cm-person').length;
    $('[data-hp="out"]').click(); await wait('#cm-help-list', 50); await until(() => !/Đang tải/.test($('#cm-help-list')?.innerText || ''), 50);
    ok(!$('#cm-out-new'), 'chưa gõ tên: không có nút thêm người ngoài mới');
    typ($('#cm-helper'), 'A'); await sleep(200);
    ok(!$('#cm-out-new'), 'tên 1 ký tự: không có nút thêm');
    typ($('#cm-helper'), '  Anh   Nam thử 200 '); await sleep(200);
    ok(/\+ Thêm "Anh Nam thử 200" là người ngoài mới/.test($('#cm-out-new')?.innerText || ''), `gõ tên → có nút thêm mới (đã gọn dấu cách): ${$('#cm-out-new')?.innerText || '-'}`);
    let k = L().length; $('#cm-out-new').click();
    await until(() => $$('.cm-person').length === n0 + 1, 50); await sleep(300);
    const add1 = since(k).find((x) => x[1] === 'app_ca_outsider_add');
    ok(!!add1 && add1[2].p_name === 'Anh Nam thử 200', `gọi máy chủ tạo người ngoài: ${JSON.stringify(add1?.[2] || null)}`);
    ok($$('.cm-person').length === n0 + 1 && /NG\d+ – Anh Nam thử 200/.test(people()), `người ngoài vào danh sách người làm của ca: ${n0} → ${$$('.cm-person').length}`);
    ok(/làm hộ \/ phát sinh/.test($$('.cm-person').find((x) => /Anh Nam thử 200/.test(x.innerText))?.innerText || ''), 'người ngoài tính là người làm hộ / phát sinh');
    // gõ lại đúng tên (khác hoa thường): không có nút tạo trùng, người đã trong ca không hiện lại để bấm
    if (!$('#cm-help-list')) { $('[data-hp="out"]').click(); await wait('#cm-help-list', 50); }
    typ($('#cm-helper'), 'anh nam THỬ 200'); await sleep(200);
    ok(!$('#cm-out-new'), 'gõ lại tên đã có (khác hoa thường): không có nút tạo trùng');
    ok(!$$('[data-add-emp]').some((b) => /Anh Nam thử 200/.test(b.innerText)), 'người đã ở trong ca không hiện lại để thêm lần hai');
    // máy chủ: gọi thêm lần nữa cùng tên → trả hồ sơ cũ
    const again = await rpc('app_ca_outsider_add', { p_name: 'ANH NAM thử 200', p_phone: null });
    const H = await rpc('app_ca_helpers');
    ok(again.existed === true && H.outside.filter((x) => /anh nam thử 200/i.test(x.name)).length === 1, `trùng tên → dùng lại hồ sơ cũ (existed=${again.existed}, số hồ sơ ${H.outside.filter((x) => /anh nam thử 200/i.test(x.name)).length})`);
    ok(!H.former.some((x) => x.id === again.id) && !H.active.some((x) => x.id === again.id), 'người ngoài không lẫn vào Nhân viên cũ / Nhân viên trong quán');
    const emps = await rpc('app_ca_employees');
    ok(!emps.some((x) => x.id === again.id), 'người ngoài không có trong danh sách nhân viên đang làm');
    let err1 = ''; try { await rpc('app_ca_outsider_add', { p_name: ' x ', p_phone: null }); } catch (e) { err1 = e.message; }
    ok(/2 đến 60/.test(err1), `tên quá ngắn bị từ chối: ${err1 || '(không báo lỗi)'}`);
    // nhóm Nhân viên cũ không chứa người ngoài
    $('[data-hp="old"]').click(); await wait('#cm-help-list', 50); await sleep(400);
    ok(!/Anh Nam thử 200/.test($('#cm-help-list')?.innerText || ''), 'nút Nhân viên cũ không liệt kê người ngoài');
    ok(fits(), `chốt ca sau khi thêm không tràn ngang (${document.documentElement.clientWidth}/${document.documentElement.scrollWidth})`);

    // ---------- B. Trang đối soát ca ----------
    try { await rpc('app__test_ca_staff', { p_id: 182, p_n: 2 }); } catch (_) { /* hook cũ */ }
    await go('#/ca/doi-soat?id=182&tab=viec', '#dsm');
    const viec = () => $('[data-dsm-pane="viec"]');
    await until(() => $$('[data-dsmst]', viec()).length >= 2, 60);
    const nStaff = $$('[data-dsmst]', viec()).length;
    $('#dsm-staffadd')?.click(); await wait('form [name=loai]', 50);
    let f = $('[name=loai]')?.closest('form');
    ok(!!f, 'hộp Thêm người hỗ trợ có ô chọn loại người');
    if (f) {
      ok([...f.loai.options].map((x) => x.textContent).join('|') === 'Nhân viên trong quán|Nhân viên cũ|Người ngoài', `3 loại người: ${[...f.loai.options].map((x) => x.textContent).join(' | ')}`);
      ok(f.emp.options.length > 1 && f.querySelector('[data-ngoai-moi]').hidden, `mặc định Nhân viên trong quán (${f.emp.options.length - 1} người), ô tên người ngoài ẩn`);
      chg(f.loai, 'out'); await sleep(150);
      ok([...f.emp.options].some((x) => x.value === 'moi') && [...f.emp.options].some((x) => /Anh Nam thử 200/.test(x.textContent)), 'loại Người ngoài: có "+ Người ngoài mới…" và người ngoài đã tạo ở phần A');
      chg(f.emp, 'moi'); await sleep(150);
      ok(!f.querySelector('[data-ngoai-moi]').hidden, 'chọn Người ngoài mới → hiện ô tên + số điện thoại');
      f.in.value = '08:00'; f.out.value = '10:00'; f.reason.value = 'thử tệp 200';
      k = L().length; submit(f); await sleep(600);
      ok(!since(k).some((x) => x[1] === 'app_ca_recon_save') && !!$('[name=loai]'), 'chưa ghi tên người ngoài → không lưu, hộp còn mở');
      f.ngoai_ten.value = 'Chị Hoa thử 200'; f.ngoai_sdt.value = '0900 000 200';
      k = L().length; submit(f);
      await until(() => $$('[data-dsmst]', viec()).length === nStaff + 1, 60); await sleep(300);
      const a2 = since(k).find((x) => x[1] === 'app_ca_outsider_add'), sv = since(k).find((x) => x[1] === 'app_ca_recon_save');
      ok(!!a2 && a2[2].p_name === 'Chị Hoa thử 200' && a2[2].p_phone === '0900 000 200', `tạo người ngoài trong hộp: ${JSON.stringify(a2?.[2] || null)}`);
      ok(!!sv && sv[2].p.staff.length === nStaff + 1 && sv[2].p.staff[nStaff].source === 'ho_tro' && Number.isFinite(Number(sv[2].p.staff[nStaff].employee_id)) && !('moves' in sv[2].p),
        `lưu đủ ${nStaff + 1} người, chỉ khoá staff, người mới là người hỗ trợ`);
      ok($$('[data-dsmst]', viec()).length === nStaff + 1 && /Chị Hoa thử 200/.test(viec()?.innerText || ''), `trang đối soát hiện người ngoài vừa thêm: ${nStaff} → ${$$('[data-dsmst]', viec()).length}`);
      // nhân viên cũ cũng chọn được ở đối soát
      $('#dsm-staffadd')?.click(); await wait('form [name=loai]', 50); f = $('[name=loai]')?.closest('form');
      if (f) { chg(f.loai, 'old'); await sleep(150);
        const Hh = await rpc('app_ca_helpers');
        ok(f.emp.options.length - 1 === Hh.former.length || /Không còn ai/.test(f.emp.options[0].textContent), `loại Nhân viên cũ: ${f.emp.options.length - 1} người (máy chủ có ${Hh.former.length})`);
        chg(f.loai, 'out'); await sleep(150);
        ok(![...f.emp.options].some((x) => /Chị Hoa thử 200/.test(x.textContent)), 'người ngoài đã ở trong ca không hiện lại trong ô chọn');
        ok(fits(), `hộp thêm người không tràn ngang (${document.documentElement.clientWidth}/${document.documentElement.scrollWidth})`);
        f.closest('dialog')?.close(); }
      // bỏ người vừa thêm để ca về như cũ
      await sleep(300); $(`[data-dsmst="${nStaff}"]`, viec())?.click(); await wait('form [data-del]', 30);
      const f2 = $('form [data-del]')?.closest('form'); if (f2) { f2.reason.value = 'thêm thử'; f2.querySelector('[data-del]').click(); }
      await until(() => $$('[data-dsmst]', viec()).length === nStaff, 40);
      ok($$('[data-dsmst]', viec()).length === nStaff, 'bỏ người ngoài vừa thêm: số người về như cũ');
    }
    ok(fits(), `trang đối soát không tràn ngang (${document.documentElement.clientWidth}/${document.documentElement.scrollWidth})`);

    // ---------- C. Trang Nhân viên (người có quyền quản lý nhân viên) ----------
    await go('#/quan-ly/nhan-vien', '.emp-row');
    if ($('#show-stopped')) {
      $('#show-stopped').checked = true; $('#show-stopped').dispatchEvent(new Event('input', { bubbles: true })); await sleep(300);
      const row = $$('.emp-row').find((r) => /Anh Nam thử 200/.test(r.innerText));
      ok(!!row && !row.hidden && /Người ngoài/i.test(row.innerText), 'trang Nhân viên: người ngoài nằm trong nhóm ngừng làm, có nhãn Người ngoài');
      if (row) {
        ok(!row.querySelector('.st-btn') && !row.querySelector('a.emp-name'), 'dòng người ngoài không có nút Đi làm lại, tên không dẫn tới biểu mẫu hồ sơ đầy đủ');
        ok(!row.querySelector('.acc-menu, [data-acc]') && /Không dùng app/.test(row.innerText) || !row.querySelector('.nn-ten'), 'dòng người ngoài ghi Không dùng app (không có tài khoản)');
        if (row.querySelector('.nn-ten')) {
          await rpc('app_ca_outsider_rename', { p_id: Number(row.querySelector('.nn-ten').dataset.id), p_name: 'Anh Nam đổi tên 200' });
          await go('#/quan-ly/nhan-vien', '.emp-row');
          ok($$('.emp-row').some((r) => /Anh Nam đổi tên 200/.test(r.innerText)), 'đổi tên người ngoài: trang Nhân viên hiện tên mới');
        }
      }
      ok(fits(), `trang Nhân viên không tràn ngang (${document.documentElement.clientWidth}/${document.documentElement.scrollWidth})`);
    }
  } catch (e) { bad.push('LỖI ' + (e.stack || e.message)); }
  out.push({ route: 'tệp 200: thêm người ngoài vào ca', title: `ĐẠT ${good.length} · LỖI ${bad.length} || ${[...bad.map((x) => 'LỖI ' + x), ...good.map((x) => 'ĐẠT ' + x)].join(' || ')}`, len: 0, errs: [...window.__ERR, ...bad] });
};
