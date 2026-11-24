// Trang đối soát ca mới — đợt 2 (sửa tại chỗ, luật mới tệp 173). Kế hoạch: tai_lieu/superpowers/plans/2026-11-24-trang-doi-soat-ca-moi-dot-2-3.md (Task 2–3).
// role=chu|qlt|ql · index.html và test/phone.html. Máy chủ giả: app_ds2_* = cờ luật mới (window.__DS_MOI) + đúng hàm giả cũ.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wait = async (s, n = 80) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const until = async (f, n = 80) => { for (let i = 0; i < n; i++) { try { if (f()) return true; } catch (_) { /* chờ */ } await sleep(100); } return false; };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(250); location.hash = h; await sleep(500); if (sel) await wait(sel); await sleep(400); };
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  const L = () => window.__LOG.filter((x) => x[0] === 'rpc');
  const since = (n) => L().slice(n).map((x) => x[1]);
  const mark = () => { const m = document.createElement('i'); m.id = 'dsm-mark2'; $('#dsm')?.prepend(m); };
  const tienPane = () => $('[data-dsm-pane="tien"]');
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc } = await import('../js/sb.js');
    try { await rpc('app__test_ca_staff', { p_id: 182, p_n: 2 }); } catch (_) { /* hook cũ */ }
    // 1. đường dẫn trang mới: hàm sửa tiền đổi sang bản luật mới; trang cũ giữ hàm cũ
    await go('#/ca/doi-soat-moi?id=182&tab=tien', '#dsm');
    ok(!/Bản xem thử/.test($('#dsm')?.innerText || ''), 'trang mới không còn dòng "Bản xem thử"');
    mark();
    let n0 = L().length;
    $('[data-dsmode="ca"]')?.click();
    await until(() => since(n0).includes('app_ds2_ds_cash'), 40); await until(() => since(n0).includes('app_stc_month'), 40); await sleep(500);
    ok(since(n0).includes('app_ds2_ds_cash') && !since(n0).includes('app_stc_ds_cash'), `bấm Thu theo ca ở trang mới gọi app_ds2_ds_cash: ${since(n0).join(', ')}`);
    ok(!!$('#dsm-mark2'), 'lưu xong không vẽ lại cả trang (phần tử đánh dấu ngoài phần thân còn)');
    ok(!!$('.stc-dsp [name=ds_tm]'), 'đọc lại xong hiện ô tiền mặt quản lý đếm (thu theo ca)');
    // 2. tích một mục quản lý tự tích: đổi ngay, đúng 1 lệnh, không đọc lại sổ tháng
    const tb = $$('[data-tick]', tienPane()).find((b) => b.getAttribute('aria-pressed') !== 'true' && !b.disabled);
    ok(!!tb, `có ô tích quản lý tự tích: ${tb?.dataset.tick || '-'}`);
    if (tb) {
      const k = tb.dataset.tick; n0 = L().length; tb.click();
      await until(() => $(`[data-tick="${k}"]`, tienPane())?.getAttribute('aria-pressed') === 'true', 30); await sleep(400);
      ok($(`[data-tick="${k}"]`, tienPane())?.getAttribute('aria-pressed') === 'true', `tích "${k}" → ✓ ngay`);
      ok(since(n0).length === 1 && since(n0)[0] === 'app_stc_tick', `tích gọi đúng 1 lệnh app_stc_tick: ${since(n0).join(', ')}`);
      ok(!!$('#dsm-mark2'), 'tích không vẽ lại cả trang');
    }
    // 3. chọn nhóm khoản chi: 1 lệnh, không đọc lại
    const cs = $('select[data-catx]', tienPane());
    if (cs) {
      const v = [...cs.options].map((o) => o.value).find((x) => x && x !== cs.value && x !== 'x');
      n0 = L().length; cs.value = v; cs.dispatchEvent(new Event('change', { bubbles: true }));
      await until(() => since(n0).includes('app_tc_check') || since(n0).includes('app_stc_entry_save'), 30); await sleep(500);
      ok(since(n0).length === 1, `chọn nhóm chi gọi 1 lệnh, không đọc lại sổ tháng: ${since(n0).join(', ')}`);
    } else ok(true, 'không có khoản chi chọn nhóm được ở ca thử (bỏ qua bước chọn nhóm)');
    // 4. bấm khung khoản chi → hộp Sửa / Xoá của Sổ thu chi; lưu → bản luật mới + đọc lại, số phải có đổi
    const box = $('.dsm-it.chi[data-ed]', tienPane()) || $('.dsm-it[data-ed]', tienPane());
    ok(!!box, `khung khoản bấm được (data-ed): ${box?.innerText.replace(/\s+/g, ' ').slice(0, 50) || '-'}`);
    if (box) {
      const pm = box.closest('.dsm-sec')?.dataset.pm; const must0 = Number($(`.dsm-must[data-pm="${pm}"]`)?.dataset.v);
      box.click(); await wait('dialog[open] [name=amount], .modal [name=amount], [name=amount]', 30);
      const amt = $('[name=amount]'); ok(!!amt, 'hộp Sửa / Xoá mở, có ô số tiền');
      if (amt) {
        amt.value = '12.000'; amt.dispatchEvent(new Event('input', { bubbles: true }));
        const rs = $('[name=reason]'); if (rs) rs.value = 'thử đợt 2';
        n0 = L().length; (amt.closest('form')?.querySelector('button[type=submit]') || amt.closest('form')?.querySelector('.btn:not(.secondary)'))?.click();
        await until(() => since(n0).includes('app_ds2_move_save') && since(n0).includes('app_stc_month'), 50); await sleep(700);
        ok(since(n0).includes('app_ds2_move_save'), `lưu khoản ở trang mới gọi app_ds2_move_save: ${since(n0).join(', ')}`);
        const must1 = Number($(`.dsm-must[data-pm="${pm}"]`)?.dataset.v);
        ok(must1 !== must0, `số phải có ${pm} đổi theo khoản vừa sửa: ${must0} → ${must1}`);
        ok(!!$('#dsm-mark2'), 'sửa khoản không vẽ lại cả trang');
      }
    }
    // 5. ca đã Xác nhận Fabi (trang cũ): trang mới vẫn sửa được (luật mới); trang cũ vẫn chặn (luật cũ)
    await rpc('app__test_ds_open', { p_id: 182 });
    await go('#/ca/doi-soat-moi?id=182&tab=tien', '#dsm');
    let msg = 'được'; try { await rpc('app_stc_ds_cash', { p_report: 182, p_mode: 'ca', p_counted: 1000000 }); } catch (e) { msg = e.message; }
    ok(msg === 'được', `ca đã xác nhận, ở trang mới sửa tiền mặt được: ${msg}`);
    location.hash = '#/ca/doi-soat-cu?id=182&tab=tien'; await sleep(600);   // đợt 4: trang cũ ở đường dẫn dự phòng
    msg = 'được'; try { await rpc('app_stc_ds_cash', { p_report: 182, p_mode: 'ca', p_counted: 1000000 }); } catch (e) { msg = e.message; }
    ok(/đã chốt tiền/.test(msg), `ca đã xác nhận, ở trang cũ vẫn chặn: ${msg}`);
    // 6. không tràn ngang
    await go('#/ca/doi-soat-moi?id=182&tab=tien', '#dsm');
    ok(fits(), `trang Tiền (sửa được) không tràn ngang (${document.documentElement.clientWidth}/${document.documentElement.scrollWidth})`);
  } catch (e) { bad.push('LỖI ' + e.message); }
  out.push({ route: 'trang đối soát ca mới (đợt 2: sửa tại chỗ)', title: `ĐẠT ${good.length} · LỖI ${bad.length} || ${[...bad.map((x) => 'LỖI ' + x), ...good.map((x) => 'ĐẠT ' + x)].join(' || ')}`, len: 0, errs: [...window.__ERR, ...bad] });
};
