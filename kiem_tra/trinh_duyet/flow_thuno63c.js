// Chặng 6.3c (anh Tiến chọn 23/11): nút "+ Khách trả nợ cũ trong ca" ở bước 1 phần tiền (khung Nợ của ca) — ghi khách trả nợ cũ VÀO ca
// (app_ca_recon_debt_collect sẵn có). Ca đã Xác nhận Fabi → nhắc Mở lại. Từ 6.3d: "+ Thêm phiếu" bước 3 chọn Thu nợ cũng ghi trong ca.
// role=chu|qlt|ql; role=nv không có nút. index.html và test/phone.html, confirm=1.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const wait = async (s, n = 80) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const until = async (f, n = 80) => { for (let i = 0; i < n; i++) { try { if (f()) return true; } catch (_) { /* chờ */ } await sleep(100); } return false; };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(250); location.hash = h; await sleep(500); if (sel) await wait(sel); await sleep(500); };
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    if (role === 'nv') {
      await go('#/ca/doi-soat?id=182&tab=tien&b=1', '#root h1');
      ok(!$('[data-traadd]'), 'nv: không có nút');
    } else {
      const { rpc } = await import('../js/sb.js');
      await rpc('app__test_ds_open', { p_id: 183 });   // trước khi trang đọc tháng (trang giữ dữ liệu 60 giây)
      // Ca 182 chưa Xác nhận Fabi: có nút, chọn khách nợ từ ca trước, bắt lý do, ghi xong thành dòng Trả của ca
      await go('#/ca/doi-soat?id=182&tab=tien&b=1', '.stc-dsp');
      const btn = $('[data-traadd]');
      ok(!!btn, `bước 1 có nút "${btn?.innerText.trim() || '+ Khách trả nợ cũ trong ca'}"`);
      if (btn) {
        const before = $$('.stc-cdr[data-t="tra"]').length;
        btn.click(); await wait('form.stc-dlg'); await sleep(200);
        const sel = $('form.stc-dlg [name=debt]'); const opts = [...(sel?.options || [])].filter((o) => o.value);
        ok(opts.length > 0, `danh sách khách đang nợ (nợ từ ca trước): ${opts.map((o) => o.textContent.trim()).slice(0, 3).join(' | ')}`);
        ok(!opts.some((o) => /kho tổng/i.test(o.textContent)), 'trong ca không hiện nợ Kho tổng / Chủ / Người nhà (chỉ nợ khách hàng)');
        if (opts.length) {
          sel.value = opts[0].value; sel.dispatchEvent(new Event('change', { bubbles: true }));
          const who = opts[0].textContent.split('·')[0].trim();
          $('form.stc-dlg').requestSubmit(); await sleep(500);
          ok(/lý do/i.test($('form.stc-dlg .stc-err')?.innerText || ''), `chưa ghi lý do thì chặn: ${$('form.stc-dlg .stc-err')?.innerText.trim() || '-'}`);
          $('form.stc-dlg [name=reason]').value = 'Khách chuyển khoản trả nợ trong ca, nhân viên quên ghi'; $('form.stc-dlg').requestSubmit();
          await until(() => !$('form.stc-dlg'), 100); await sleep(800);
          const rows = $$('.stc-cdr[data-t="tra"]');
          ok(rows.length === before + 1 && rows.some((r) => r.innerText.includes(who)), `ghi xong: thêm dòng Trả của ${who} (${before} → ${rows.length})`);
        }
      }
      // Ca 183 đã Xác nhận Fabi (trang mới, luật mới tệp 173): chưa Hoàn thành thì vẫn có nút
      await go('#/ca/doi-soat?id=183&tab=tien&b=1', '.stc-dsp');
      { const xong = $$('[data-dsm-tab]').some((b) => /Hoàn thành.*xong/.test(b.innerText.replace(/\s+/g, ' ')));   // 28/11 bỏ trang cũ: trang mới theo luật mới (tệp 173) — sửa tự do tới khi Hoàn thành
        ok(xong ? !$('[data-traadd]') : !!$('[data-traadd]'), `ca đã Xác nhận Fabi: ${xong ? 'đã Hoàn thành → không còn nút' : 'chưa Hoàn thành → vẫn ghi được khách trả nợ cũ (luật mới)'}`); }
      // Bước 3, "+ Thêm phiếu" chọn Thu nợ → nhắc làm ở bước 1
      await go('#/ca/doi-soat?id=183&tab=tien&b=3', '.stc-dsp');
      const add = $('[data-addca][data-book="thu"]') || $('[data-addca]');
      if (add) {
        add.click(); await wait('.stc-addp'); await sleep(300);
        const k = $('.stc-addp [name=kind]'); k.value = 'no'; k.dispatchEvent(new Event('change', { bubbles: true })); await sleep(200);
        const cv = ($('.stc-addp [name=ca]')?.selectedOptions?.[0]?.textContent || '').trim();   // chặng 6.3d: ở trang ca, Thu nợ ghi trong ca
        ok(/Ca /.test(cv), `Thu nợ ở "+ Thêm phiếu" bước 3 ghi trong ca: "${cv}"`);
      } else ok(false, 'không thấy nút + Thêm phiếu ở bước 3');
      ok(fits(), `không tràn ngang (${document.documentElement.clientWidth}/${document.documentElement.scrollWidth})`);
    }
  } catch (e) { bad.push('LỖI ' + e.message); }
  out.push({ route: 'thu nợ trong ca', title: `ĐẠT ${good.length} · LỖI ${bad.length} || ${[...bad.map((x) => 'LỖI ' + x), ...good.map((x) => 'ĐẠT ' + x)].join(' || ')}`, len: 0, errs: [...window.__ERR, ...bad] });
};
