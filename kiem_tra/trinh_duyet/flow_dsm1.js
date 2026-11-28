// Trang đối soát ca mới — đợt 1 (chỉ xem): #/ca/doi-soat-moi?id=. Thiết kế: tai_lieu/superpowers/specs/2026-11-24-trang-doi-soat-ca-moi-design.md.
// Kế hoạch: tai_lieu/superpowers/plans/2026-11-24-trang-doi-soat-ca-moi-dot-1.md (Task 4). role=chu|qlt|ql (được đối soát) · role=nv (không vào được).
// Chạy ở index.html và test/phone.html. Số tiền so với cách tính của trang cũ (dayChain / caMoney) trên cùng dữ liệu giả.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const wait = async (s, n = 80) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const until = async (f, n = 80) => { for (let i = 0; i < n; i++) { try { if (f()) return true; } catch (_) { /* chờ */ } await sleep(100); } return false; };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(250); location.hash = h; await sleep(500); if (sel) await wait(sel); await sleep(400); };
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  const tab = async (k) => { $(`[data-dsm-tab="${k}"]`)?.click(); await sleep(250); };
  const rpcCount = () => window.__LOG.filter((x) => x[0] === 'rpc').length;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    if (role === 'nv') {
      await go('#/ca/doi-soat-moi?id=182');
      await sleep(800);
      ok(!$('#dsm'), 'nhân viên: không vào được trang đối soát ca mới');
    } else {
      const { rpc } = await import('../js/sb.js');
      const { dayChain, billListOf, dsChecks, dsCtx } = await import('../js/so_thu_chi_tinh.js');
      const { moneyLeftList, CHK_LABEL } = await import('../js/doi_soat_moi_tinh.js');
      // ca thử phần tiền chưa có người làm trong phiếu giả → gắn 2 người đang làm (hook sẵn có của máy chủ giả)
      try { await rpc('app__test_ca_staff', { p_id: 182, p_n: 2 }); } catch (_) { /* máy chủ giả cũ không có hook */ }
      // 1. trang cũ có nút sang trang mới
      await go('#/ca/doi-soat-cu?id=182', '#ds-newpage');   // đợt 4: trang cũ ở đường dẫn dự phòng
      const np = $('#ds-newpage');
      ok(!!np && /#\/ca\/doi-soat\?id=182$/.test(np.getAttribute('href') || ''), `trang cũ (dự phòng) có nút sang trang mới: ${np?.getAttribute('href') || '-'}`);
      // 2. trang mới: dòng bản xem thử, 3 trang, đường về trang cũ
      await go('#/ca/doi-soat-moi?id=182', '#dsm');
      ok(!!$('#dsm'), 'mở được trang mới ca 182');
      ok(/Sửa ngay tại đây/.test($('#dsm')?.textContent || ''), 'có dòng "Sửa ngay tại đây" (đợt 2: hết bản xem thử)');
      ok($$('[data-dsm-tab]').length === 3, `3 nút trang: ${$$('[data-dsm-tab]').map((b) => b.innerText.replace(/\s+/g, ' ').trim()).join(' | ')}`);
      ok(!$('#dsm-old'), 'không còn đường dẫn "Trang cũ (dự phòng)" (anh Tiến 28/11: xoá đối soát cũ)');
      // dữ liệu để so (cùng dữ liệu giả, cách tính của trang cũ)
      const R = await rpc('app_ca_get', { p_id: 182 });
      const D = await rpc('app_stc_month', { p_branch: R.branch_id, p_month: R.work_date.slice(0, 7) });
      (D.cas || []).forEach((c) => { c.bill_list = billListOf(D, c.id); });
      const ca = D.cas.find((c) => Number(c.id) === 182);
      const dsRow = ((await rpc('app_ca_ds_tuan', { p_branch: R.branch_id, p_from: R.work_date, p_to: R.work_date })) || []).find((x) => Number(x.id) === 182) || null;
      const money = dayChain(D, ca.date).get(ca.id).money;
      // 3. trang ① Phần việc: tên người làm ca
      await tab('viec');
      const names = (R.staff || []).filter((s) => s.worked !== 0 && s.worked !== false).map((s) => s.name).filter(Boolean);
      ok(names.length > 0 && names.every((nm) => ($('[data-dsm-pane="viec"]')?.innerText || '').includes(nm)), `trang Phần việc có tên người làm: ${names.join(', ')}`);
      ok(fits(), `trang Phần việc không tràn ngang (${document.documentElement.clientWidth}/${document.documentElement.scrollWidth})`);
      // mỗi bước một trang: chỉ bước đang mở hiện, 2 bước kia ẩn hẳn (lỗi 24/11: CSS .dsm{display:grid} đè thuộc tính hidden → 3 bước hiện chồng)
      const vis = (k) => { const el = $(`[data-dsm-pane="${k}"]`); return !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0; };
      ok(vis('viec') && !vis('tien') && !vis('xong'), `bước ①: chỉ hiện trang Phần việc (hiện: ${['viec', 'tien', 'xong'].filter(vis).join(', ')})`);
      // 4. đi lần lượt 3 bước: ① chưa duyệt thì ② khoá; bấm "Duyệt phần việc, sang bước 2" → sang ② Tiền
      const lock2 = !!$('[data-dsm-tab="tien"][data-lock]'); await tab('tien');
      ok(!lock2 || !!$('[data-dsm-tab="viec"][aria-selected="true"]'), 'bước ② khoá khi phần việc chưa duyệt: bấm không sang');
      $('#dsm-next1')?.click(); await until(() => !!$('[data-dsm-tab="tien"][aria-selected="true"]'), 50); await sleep(400);
      ok(!!$('[data-dsm-tab="tien"][aria-selected="true"]'), 'nút cuối bước ① → sang bước ② Tiền');
      ok(vis('tien') && !vis('viec') && !vis('xong'), `bước ②: chỉ hiện trang Tiền (hiện: ${['viec', 'tien', 'xong'].filter(vis).join(', ')})`);
      const tm = $('.dsm-must[data-pm="tm"]'), ck = $('.dsm-must[data-pm="ck"]');
      ok(Number(tm?.dataset.v) === money.tm.must, `tiền mặt phải có ${tm?.dataset.v} = trang cũ ${money.tm.must}`);
      ok(Number(ck?.dataset.v) === money.ck.must, `chuyển khoản phải nhận ${ck?.dataset.v} = trang cũ ${money.ck.must}`);
      const chiBox = $('.dsm-it.chi'), thuBox = $('.dsm-it.thu');
      ok(!!chiBox, `có khung khoản chi: ${chiBox?.innerText.replace(/\s+/g, ' ').slice(0, 60) || '-'}`);
      if (chiBox && thuBox) ok(getComputedStyle(chiBox).backgroundColor !== getComputedStyle(thuBox).backgroundColor, 'khung thu và khung chi khác màu');
      // mọi mục kiểm tiền của ca (trừ Xác nhận Fabi — Hoàn thành mới tự làm — và 3 dòng số máy mo / dt / no) đều hiện ở trang Tiền,
      // để dòng "Còn thiếu" bấm sang trang Tiền có chỗ thấy mục đó
      const keys = dsChecks(ca, dsCtx(D, ca)).flat().map((x) => x.k).filter((k) => !['fabi', 'mo', 'dt', 'no'].includes(k));
      const tienTxt = $('[data-dsm-pane="tien"]')?.innerText || '';
      const lack = keys.filter((k) => !tienTxt.includes(CHK_LABEL[k]));
      ok(keys.length > 0 && lack.length === 0, `trang Tiền hiện đủ ${keys.length} mục kiểm của ca${lack.length ? ' — thiếu: ' + lack.join(', ') : ''}`);
      ok(fits(), `trang Tiền không tràn ngang (${document.documentElement.clientWidth}/${document.documentElement.scrollWidth})`);
      // 5. bước ② còn thiếu → nút sang ③ mờ, ghi đúng các mục còn thiếu (= hàm tính); ③ khoá
      const left2 = moneyLeftList(D, ca);
      ok(left2.length === 0 ? !$('#dsm-next2')?.disabled : !!$('#dsm-next2')?.disabled && $$('[data-dsm-pane="tien"] .dsm-left li').length === left2.length,
        `bước ② còn ${left2.length} mục → nút sang Hoàn thành ${left2.length ? 'mờ' : 'bấm được'}, danh sách ${$$('[data-dsm-pane="tien"] .dsm-left li').length} dòng`);
      if (left2.length) { await tab('xong'); ok(!!$('[data-dsm-tab="tien"][aria-selected="true"]') && !!$('[data-dsm-tab="xong"][data-lock]'), 'bước ③ Hoàn thành khoá khi bước ② còn thiếu'); }
      ok(!!$('#dsm-done'), 'trang Hoàn thành có nút Hoàn thành (đợt 3: Hoàn thành gộp)');
      // 6. Tính lại: không vẽ lại cả trang, chỉ 4 lần hỏi máy chủ
      const mark = document.createElement('i'); mark.id = 'dsm-mark'; $('#dsm').prepend(mark);
      const c0 = rpcCount(); $('#dsm-recalc').click();
      await until(() => rpcCount() - c0 >= 7, 50); await sleep(600);
      const rn = window.__LOG.filter((x) => x[0] === 'rpc').slice(c0).map((x) => x[1]);
      ok(rn.length <= 7 && rn.length >= 2, `Tính lại hỏi máy chủ ${rn.length} lần (≤ 7: phiếu ca, bản đối soát, sổ tháng, người nợ, bảng tuần một ngày, ca chưa xong, giờ chốt): ${rn.join(', ')}`);
      ok(!!$('#dsm-mark'), 'Tính lại không vẽ lại cả trang');
      ok(!!$('[data-dsm-tab="tien"][aria-selected="true"]'), 'Tính lại giữ trang đang mở');
      // 7. ca chờ kế toán: chuyển khoản hiện ⏳, không có NaN
      await go('#/ca/doi-soat-moi?id=172&tab=tien', '#dsm');
      ok(/⏳/.test($('.dsm-sec[data-pm="ck"]')?.innerText || ''), 'ca chờ kế toán: mục Chuyển khoản hiện ⏳');
      ok(!/NaN|undefined/.test($('#dsm')?.innerText || ''), 'không có chữ NaN / undefined');
      // 8. không được xem tiền cơ sở: trang Tiền báo rõ, trang Phần việc vẫn hiện
      window.__STC_FAIL = true;
      await go('#/ca/doi-soat-moi?id=182&tab=tien', '#dsm');
      ok(/không được xem/i.test($('.dsm-err')?.innerText || ''), `trang Tiền báo lỗi: ${$('.dsm-err')?.innerText.trim() || '-'}`);
      await tab('viec');
      ok(names.every((nm) => ($('[data-dsm-pane="viec"]')?.innerText || '').includes(nm)), 'trang Phần việc vẫn hiện khi phần tiền lỗi');
      window.__STC_FAIL = false;
    }
  } catch (e) { bad.push('LỖI ' + e.message); }
  window.__STC_FAIL = false;
  out.push({ route: 'trang đối soát ca mới (đợt 1)', title: `ĐẠT ${good.length} · LỖI ${bad.length} || ${[...bad.map((x) => 'LỖI ' + x), ...good.map((x) => 'ĐẠT ' + x)].join(' || ')}`, len: 0, errs: [...window.__ERR, ...bad] });
};
