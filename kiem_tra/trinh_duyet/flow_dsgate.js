// VÙNG KHOÁ — trang đối soát ca (#/ca/doi-soat?id=) chặn cả trang như trang cũ (anh Tiến chốt 28/11/2026, chọn A cả 3 ý):
//   1. người không được giao đối soát cơ sở đó (can_recon = false) → chỉ thấy lời báo không có quyền, không thấy số tiền / nút nào
//   2. nhân viên chưa hoàn thành phiếu chốt ca → "Nhân viên chưa hoàn thành phiếu chốt ca … nên chưa đối soát được"
//   3. ca còn hàng kho tổng chưa đối soát → bước ① có dòng nhắc + đường sang Hàng hoá › Đối soát
// Chạy: role=ql&noassign=1 (không được giao) · role=chu | qlt | ql (được đối soát) — index.html và test/phone.html, confirm=1.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wait = async (s, n = 80) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(250); location.hash = h; await sleep(500); if (sel) await wait(sel); await sleep(500); };
  const fits = () => document.documentElement.scrollWidth <= window.innerWidth + 1;
  const P = new URLSearchParams(location.search); const noassign = !!P.get('noassign');
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
    const { rpc } = await import('../js/sb.js');
    if (noassign) {
      const k0 = (window.__LOG || []).length;
      await go('#/ca/doi-soat?id=182', '#dsm-gate, #dsm');
      ok(!!$('#dsm-gate') && !$('#dsm') && /không có quyền đối soát|nhờ chủ thêm tên/.test(txt($('#dsm-gate'))), '1. không được giao: chỉ thấy lời báo không có quyền · thấy: ' + txt($('#root .card')).slice(0, 140));
      ok(!$('.stc-dsp') && !$('.dsm-sec') && !$('[data-dsm-tab]') && !$('#dsm-done') && !$('[data-tick]'), '1. không thấy số máy Fabi, sổ tiền, các bước, nút tích / Hoàn thành');
      ok(!(window.__LOG || []).slice(k0).some((x) => x[0] === 'rpc' && /^app_stc_month|^app_stc_people/.test(x[1])), '1. trang không tải số tiền của cơ sở khi không có quyền');
      ok(/#\/ca\/phieu\?id=182$/.test($('#dsm-gate a')?.getAttribute('href') || ''), '1. có nút Mở phiếu chốt ca');
      ok(fits(), '1. không tràn ngang');
    } else {
      await go('#/ca/doi-soat?id=182', '#dsm-gate, #dsm');
      ok(!!$('#dsm') && !$('#dsm-gate'), 'người được đối soát: mở được trang đối soát ca 182 như thường');
      ok(!$('#dsm-goods'), '3. ca không gắn hàng kho tổng: không có dòng nhắc hàng chưa đối soát');
      // 2. ca nhân viên đang chốt dở
      const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
      const idOpen = await rpc('app_ca_open', { p_branch: 1, p_date: today, p_shift: 'Sáng' });
      await go('#/ca/doi-soat?id=' + idOpen, '#dsm-gate, #dsm');
      ok(!!$('#dsm-gate') && !$('#dsm') && /nhân viên chưa hoàn thành phiếu chốt ca/.test(txt($('#dsm-gate'))) && !$('.stc-dsp') && !$('#dsm-done'), '2. ca đang chốt dở: báo nhân viên chưa hoàn thành phiếu, không có trang đối soát · thấy: ' + txt($('#root .card')).slice(0, 120));
      // 3. ca còn hàng kho tổng chưa đối soát (gắn thử vào ca 183)
      await rpc('app__test_ca_hang', { p_id: 183 });
      await go('#/ca/doi-soat?id=183&tab=viec&t=g', '#dsm');
      const g = $('#dsm-goods');
      ok(!!g && /còn hàng kho tổng chưa đối soát/.test(txt(g)) && /#\/hang-hoa\/doi-soat/.test(g.querySelector('a')?.getAttribute('href') || ''), '3. ca còn hàng chưa đối soát: bước ① có dòng nhắc + đường sang Hàng hoá › Đối soát');
      ok(fits(), 'không tràn ngang');
    }
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.stack || e.message)); }
  out.push({ dsgate: { ok: good, fail: bad } });
};
