// Chặng 6.3d (anh Tiến chọn 23/11): "+ Thêm phiếu" ở trang đối soát ca (bước 3 / 4) luôn ghi TRONG ca — Thu khác / Khoản chi, Thu nợ
// (ca đã Xác nhận Fabi → Lưu lần 1 báo sẽ Mở lại, Lưu lần 2 tự mở lại rồi ghi vào ca), Cho nợ (nợ mới của ca), Luân chuyển (cặp TM ↔ CK của ca).
// Sổ thu chi: không còn ô Ca — luôn ngoài ca. role=chu|qlt|ql, index.html và test/phone.html, confirm=1.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wait = async (s, n = 80) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const until = async (f, n = 80) => { for (let i = 0; i < n; i++) { try { if (f()) return true; } catch (_) { /* chờ */ } await sleep(100); } return false; };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(250); location.hash = h; await sleep(500); if (sel) await wait(sel); await sleep(500); };
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  const setv = (n, v) => { const e = $(`.stc-addp [name=${n}]`); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); return e; };
  const openAdd = async (book) => { const b = $(`[data-addca][data-book="${book}"]`) || $('[data-addca]'); if (!b) return false; b.click(); await wait('.stc-addp'); await sleep(300); return true; };
  const save = async () => { $('.stc-addp').requestSubmit(); await sleep(700); };
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc } = await import('../js/sb.js');
    await rpc('app__test_ds_open', { p_id: 183 });   // ca 183 = đã Xác nhận Fabi (mở bước 3–5) — gọi trước khi trang đọc tháng
    const caOf = () => ($('.stc-addp [name=ca]')?.selectedOptions?.[0]?.textContent || '').trim();
    // Bước 3: Thu khác — ô Ca cố định là ca này
    await go('#/ca/doi-soat?id=183&tab=tien&b=3', '.stc-dsp');
    ok(await openAdd('thu'), 'bước 3 có "+ Thêm phiếu"');
    if ($('.stc-addp')) {
      ok(/Ca /.test(caOf()) && !$$('.stc-addp [name=ca] option').some((o) => o.value === ''), `ô Ca cố định là ca này: "${caOf()}"`);
      setv('kind', 'no');
      ok(/Ca /.test(caOf()), `chọn Thu nợ vẫn ở trong ca (không nhảy về Ngoài ca): "${caOf()}"`);
      const d = $('.stc-addp [name=debt]'); const o = [...d.options].find((x) => x.value);
      ok(!!o, `có khách đang nợ để chọn: ${o?.textContent.trim().slice(0, 40) || '-'}`);
      if (o) {
        setv('debt', o.value); setv('pay2', 'chuyen_khoan'); $('.stc-addp [name=amount]').value = '20.000'; $('.stc-addp [name=reason]').value = 'Khách CK trả nợ trong ca';
        await save();
        ok(/mở lại/i.test($('.stc-addp .stc-err')?.innerText || ''), `Lưu lần 1 báo sẽ Mở lại xác nhận: ${$('.stc-addp .stc-err')?.innerText.trim().slice(0, 90) || '-'}`);
        await save(); await until(() => !$('.stc-addp'), 100); await sleep(800);
        await go('#/ca/doi-soat?id=183&tab=tien&b=1', '.stc-dsp');
        const tra = $$('.stc-cdr[data-t="tra"]').map((r) => r.innerText.replace(/\s+/g, ' '));
        ok(tra.some((t) => /20\.000/.test(t)), `Lưu lần 2: thu nợ vào ca (dòng Trả của ca): ${tra.join(' | ').slice(0, 120) || '-'}`);
        await go('#/ca/doi-soat?id=183&tab=tien&b=2', '.stc-dsp');
        ok(!!$('[data-dsclose]'), `ca đã Mở lại xác nhận (bước 2 có nút Xác nhận Fabi): ${$('[data-dsclose]')?.innerText.trim() || '-'}`);
      }
    }
    // Ca 182 chưa xác nhận → không có bước 3; dùng lại ca 183 sau khi mở khoá lại cho Cho nợ / Luân chuyển
    await rpc('app__test_ds_open', { p_id: 183 }); await sleep(61000);   // trang giữ dữ liệu tháng 60 giây
    await go('#/ca/doi-soat?id=183&tab=tien&b=4', '.stc-dsp');
    if (await openAdd('chi')) {
      setv('kind', 'no');
      ok(/Ca /.test(caOf()), `bước 4 Cho nợ ở trong ca: "${caOf()}"`);
      const nm = $('.stc-addp [name=name]'); const po = [...(nm?.options || [])].find((x) => x.value);
      if (po) { nm.value = po.value; nm.dispatchEvent(new Event('change', { bubbles: true })); }
      $('.stc-addp [name=amount]').value = '30.000'; $('.stc-addp [name=reason]').value = 'Khách mượn tiền trong ca';
      await save(); await until(() => !$('.stc-addp'), 100); await sleep(800);
      await go('#/ca/doi-soat?id=183&tab=tien&b=1', '.stc-dsp');
      ok($$('.stc-cdr[data-t="moi"]').some((r) => /30\.000/.test(r.innerText)), 'Cho nợ → thành nợ mới của ca (bước 1)');
    } else ok(false, 'bước 4 không có "+ Thêm phiếu"');
    await go('#/ca/doi-soat?id=183&tab=tien&b=4', '.stc-dsp');
    if (await openAdd('chi')) {
      setv('kind', 'lc'); setv('dir', 'tk_tm');
      ok(/Ca /.test(caOf()), `Luân chuyển ở trong ca: "${caOf()}"`);
      $('.stc-addp [name=amount]').value = '40.000'; $('.stc-addp [name=note]').value = 'Khách CK lấy tiền mặt'; $('.stc-addp [name=reason]').value = 'Đổi tiền trong ca';
      await save(); await until(() => !$('.stc-addp'), 100); await sleep(800);
      if ($('.stc-addp')) bad.push('luân chuyển: form còn mở, lỗi: ' + ($('.stc-addp .stc-err')?.innerText.trim() || '-'));
      await go('#/ca/doi-soat?id=183&tab=tien', '.stc-dsp');
      const so = [...document.querySelectorAll('#dsm .dsm-sec')].filter((x) => /40\.000/.test(x.innerText)).length;   // 28/11 bỏ trang cũ: trang mới có sổ Tiền mặt + sổ Chuyển khoản thay bước 3 / 4
      ok(so >= 2, `Luân chuyển → cặp của ca: 40.000 có ở cả sổ Tiền mặt và sổ Chuyển khoản (${so} sổ)`);
    } else ok(false, 'bước 4 không có "+ Thêm phiếu" (luân chuyển)');
    // Sổ thu chi: không còn ô Ca
    await go('#/quan-ly/so-thu-chi?tab=thu', '.stc-add');
    const add = $('.stc-add'); if (add) { add.click(); await wait('.stc-addp'); await sleep(300); }
    const caLab = $('.stc-addp [name=ca]')?.closest('label');
    if (!$('.stc-addp')) bad.push(`Sổ thu chi: không mở được + Thêm phiếu (nút .stc-add: ${!!add})`); else if (caLab && !caLab.hidden) bad.push('Sổ thu chi: ô Ca vẫn hiện: ' + caLab.innerText.replace(/\s+/g, ' ').slice(0, 80));
    ok(!!$('.stc-addp') && (!caLab || caLab.hidden), 'Sổ thu chi: "+ Thêm phiếu" không có ô Ca (luôn ngoài ca)');
    ok(fits(), `không tràn ngang (${document.documentElement.clientWidth}/${document.documentElement.scrollWidth})`);
  } catch (e) { bad.push('LỖI ' + e.message); }
  out.push({ route: 'phiếu trong ca', title: `ĐẠT ${good.length} · LỖI ${bad.length} || ${[...bad.map((x) => 'LỖI ' + x), ...good.map((x) => 'ĐẠT ' + x)].join(' || ')}`, len: 0, errs: [...window.__ERR, ...bad] });
};
