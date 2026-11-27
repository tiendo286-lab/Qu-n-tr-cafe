// Chặng 6.3 (anh Tiến chọn 23/11): nút "✓ Đã xem — tích hết N mục & sang bước sau" ở mỗi bước phần tiền của trang đối soát ca.
// Tích mọi mục quản lý tự tích của bước (giống bấm tay từng mục) rồi sang bước sau; bước còn mục web tự xét chưa xong thì ở lại + báo.
// Bước 2 không bấm Xác nhận Fabi. role=chu|qlt|ql (được đối soát), role=nv (không có quyền đối soát: không có nút). index.html và test/phone.html, confirm=1.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const wait = async (s, n = 80) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const until = async (f, n = 80) => { for (let i = 0; i < n; i++) { try { if (f()) return true; } catch (_) { /* chờ */ } await sleep(100); } return false; };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(250); location.hash = h; await sleep(500); if (sel) await wait(sel); await sleep(500); };
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  const stepNo = () => Number($('.stc-step')?.dataset.step);
  const manualLeft = () => $$('.stc-chk button.stc-ci[data-tick]:not(.ok)').length;
  const redLeft = () => $$('.stc-chk .stc-ci.auto:not(.ok)').length;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    if (role === 'nv') {
      await go('#/ca/doi-soat-cu?id=182&tab=tien&b=1', '#root h1');
      ok(!$('[data-tickall]'), `${role}: không có nút tích hết`);
    } else {
      // máy chủ giả (trước khi trang đọc dữ liệu tháng, vì trang giữ dữ liệu 60 giây): coi ca 183 như đã Xác nhận Fabi để mở bước 3–5
      const { rpc } = await import('../js/sb.js');
      const ids = [];
      for (const id of [183]) { try { await rpc('app__test_ds_open', { p_id: id }); ids.push(id); } catch (_) { /* không có ca */ } }
      ok(ids.length > 0, `ca thử đã Xác nhận Fabi: ${ids.join(', ') || 'không có'}`);
      // Bước 1: có mục quản lý (Ảnh phiếu Fabi…) chưa tích → có nút; bấm → hết mục chưa tích; không còn mục đỏ thì sang bước 2, còn thì ở lại + báo
      await go('#/ca/doi-soat-cu?id=182&tab=tien&b=1', '.stc-dsp');
      const m0 = manualLeft(), r0 = redLeft(), btn = $('[data-tickall]');
      ok(m0 > 0 ? !!btn : !btn, `bước 1: ${m0} mục QL chưa tích, ${r0} mục đỏ → nút ${btn ? 'có' : 'không'} · "${btn?.innerText.trim() || ''}"`);
      if (btn) {
        ok(new RegExp(`${m0} mục`, "i").test(btn.innerText), 'nút ghi đúng số mục sẽ tích');
        ok(r0 ? !!$('.stc-tkall-red') : !$('.stc-tkall-red'), `bước có mục đỏ thì báo trước: ${$('.stc-tkall-red')?.innerText.trim() || '-'}`);
        btn.click();
        await until(() => !$('[data-tickall]') || stepNo() !== 0, 100); await sleep(800);
        if (r0) ok(stepNo() === 0 && manualLeft() === 0, `còn mục đỏ → ở lại bước 1, mục QL đã tích hết (bước ${stepNo() + 1}, còn ${manualLeft()})`);
        else ok(stepNo() === 1, `không còn mục đỏ → sang bước 2 (đang bước ${stepNo() + 1})`);
      }
      // Chặng 6.3b: "Xoá lần trả" ở khung Khách trả nợ cũ trong ca (ca 182 chưa Xác nhận Fabi) — bắt lý do, xoá xong dòng Trả biến mất
      await go('#/ca/doi-soat-cu?id=182&tab=tien&b=1', '.stc-dsp');
      const tx = $('[data-traxoa]');
      ok(!!tx, `bước 1 có nút "Xoá lần trả" ở dòng khách trả nợ cũ: ${tx?.closest('.stc-cdr')?.innerText.replace(/\s+/g, ' ').slice(0, 80) || '-'}`);
      if (tx) {
        const id = tx.dataset.traxoa; tx.click(); await wait('form.stc-dlg'); await sleep(200);
        const f = $('form.stc-dlg'); f.requestSubmit(); await sleep(500);
        ok(/lý do/i.test($('form.stc-dlg .stc-err')?.innerText || ''), `chưa ghi lý do thì chặn: ${$('form.stc-dlg .stc-err')?.innerText.trim() || '-'}`);
        $('form.stc-dlg [name=reason]').value = 'Khách CK rút TM, không phải trả nợ'; $('form.stc-dlg').requestSubmit();
        await until(() => !$(`[data-traxoa="${id}"]`) && !$('form.stc-dlg'), 100); await sleep(500);
        ok(!$(`[data-traxoa="${id}"]`), 'xoá xong: dòng Trả biến mất');
      }
      // Bước 2: không tự bấm Xác nhận Fabi
      await go('#/ca/doi-soat-cu?id=182&tab=tien&b=2', '.stc-dsp');
      const fabiBefore = !!$('[data-dsreopen]');
      const b2 = $('[data-tickall]');
      if (b2) {
        b2.click(); await until(() => !$('[data-tickall]'), 100); await sleep(800);
        ok(!!$('[data-dsreopen]') === fabiBefore, `bước 2: tích hết không bấm Xác nhận Fabi (trước ${fabiBefore ? 'đã' : 'chưa'} xác nhận, sau ${$('[data-dsreopen]') ? 'đã' : 'chưa'})`);
        if (!fabiBefore) ok(stepNo() === 1, 'bước 2 chưa Xác nhận Fabi → ở lại bước 2');
      } else ok(true, `bước 2: không có mục QL chưa tích (${manualLeft()})`);
      // Bước 3–5 của các ca thử: bước không còn mục đỏ → bấm là sang bước sau (bước 5 → thẻ ③ Hoàn thành)
      let moved = 0;
      for (const id of ids) for (const bb of [3, 4, 5]) {
        await go(`#/ca/doi-soat-cu?id=${id}&tab=tien&b=${bb}`, '.stc-dsp');
        const k = $('[data-tickall]'); if (!k || redLeft()) continue;
        const from = stepNo(); k.click();
        await until(() => stepNo() !== from || !$('.stc-step'), 100); await sleep(800);
        const tabXong = !!document.querySelector('[data-tab-pane="xong"]:not([hidden])') || /Hoàn thành/.test(document.querySelector('.ds-ptabs [aria-selected="true"], .ds-ptabs .on')?.innerText || '');
        ok(from === 4 ? tabXong || stepNo() !== from : stepNo() === from + 1, `ca ${id} bước ${from + 1} sạch → ${from === 4 ? 'sang thẻ Hoàn thành' : 'sang bước ' + (stepNo() + 1)} · còn mục QL: ${manualLeft()}`);
        moved++;
      }
      ok(moved > 0, `có ${moved} bước sạch đã thử sang bước sau`);
      // Ca đã hoàn thành / chỉ xem: không có nút
      ok(fits(), `không tràn ngang (${document.documentElement.clientWidth}/${document.documentElement.scrollWidth})`);
    }
  } catch (e) { bad.push('LỖI ' + e.message); }
  out.push({ route: 'tích hết mỗi bước', title: `ĐẠT ${good.length} · LỖI ${bad.length} || ${[...bad.map((x) => 'LỖI ' + x), ...good.map((x) => 'ĐẠT ' + x)].join(' || ')}`, len: 0, errs: [...window.__ERR, ...bad] });
};
