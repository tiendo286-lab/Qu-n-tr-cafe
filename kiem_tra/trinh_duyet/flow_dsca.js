// Đưa Đối soát Fabi về lại Chốt ca (thiết kế 22/11/2026, anh Tiến duyệt): trang đối soát của ca 3 tab trong Chốt ca, bảng tuần Việc · Tiền,
// bỏ tab Đối soát Fabi ở Sổ thu chi. Chạy role=chu|qlt|ql (đủ), role=ql2 (không được giao), role=nv — index.html và test/phone.html, confirm=1.
// Kết quả: out[].dsca = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const wait = async (s, n = 60) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const until = async (f, n = 60) => { for (let i = 0; i < n; i++) { try { if (f()) return true; } catch (_) { /* chờ tiếp */ } await sleep(100); } return false; };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(250); location.hash = h; await sleep(500); if (sel) await wait(sel); await sleep(400); };
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    if (['chu', 'qlt', 'ql'].includes(role)) {
      // (e) đường cũ Sổ thu chi › Đối soát Fabi → trang đối soát của ca (tab ②, giữ bước)
      await go('#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11&ds=182&b=2');
      await until(() => location.hash.startsWith('#/ca/doi-soat'));
      const hp = new URLSearchParams(location.hash.split('?')[1] || '');
      ok(location.hash.startsWith('#/ca/doi-soat') && hp.get('id') === '182' && hp.get('tab') === 'tien' && hp.get('b') === '2', `(e) đường cũ ?tab=doi-soat&ds=182&b=2 → ${location.hash.slice(0, 70)}`);
      // (f) Sổ thu chi chỉ còn Tổng · Sổ thu · Sổ chi
      await go('#/quan-ly/so-thu-chi?cn=1&thang=2026-11', '.stc-tabs');
      const tabs = $$('.stc-tabs a').map((a) => txt(a));
      ok(tabs.length === 3 && !tabs.some((t) => t.includes('đối soát')), '(f) Sổ thu chi không còn tab Đối soát Fabi: ' + tabs.join(' · '));
      const m = await import('../js/pages/so_thu_chi.js');
      ok(typeof m.caMoney === 'function', '(e2) so_thu_chi.js có caMoney (khối tiền một ca)');
    }
    ok(fits(), '(l) không tràn ngang');
  } catch (e) { bad.push('LỖI CHẠY: ' + (e?.stack || e?.message || e)); }
  out.push({ dsca: { ok: good, fail: bad } });
};
