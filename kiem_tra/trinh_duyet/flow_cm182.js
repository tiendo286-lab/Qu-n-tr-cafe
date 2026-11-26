// Việc #11 (tệp 182, anh Tiến chốt cách A 26/11/2026): nhân viên KHÔNG có tên trong lịch ca vẫn bấm "Tôi chốt ca này";
// bước Nhân viên hiện dòng nhắc tự thêm tên mình ở THÊM NGƯỜI LÀM HỘ; thêm xong thì dòng nhắc biến mất.
// Quản lý (quyền đối soát) không thấy dòng nhắc. Chạy: role=c1 (nhân viên 7 đang làm — role=nv trỏ nhân viên 3 đã nghỉ trong dữ liệu thử nên không có trong danh sách làm hộ)
// và role=ql, index.html + test/phone.html.
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => { const w = document.documentElement.clientWidth; const wide = $$('#root *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > w + 1).map((el) => el.tagName + '.' + el.className).slice(0, 3); return { w, sw: document.documentElement.scrollWidth, wide }; };
  const r = []; const errs = [];
  const ok = (c, m) => { r.push((c ? 'ĐẠT ' : 'HỎNG ') + m); if (!c) errs.push(m); };
  try {
    await wait('#root .page-head, #root h1, #root .appbar, #root .m-foot', 600); await sleep(2000);
    const { rpc } = await import('../js/sb.js'); const { state } = await import('../js/app.js');
    const me = state.me; const isQl = !!me.perms?.doi_soat;
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const id = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[0].shift });
    // dựng: lịch ca KHÔNG có tên người đang đăng nhập (quản lý chưa đổi kịp lịch)
    const R = await rpc('app_ca_get', { p_id: id });
    const others = (R.staff || []).filter((s) => Number(s.employee_id) !== Number(me.employee_id));
    await rpc('app_ca_save', { p_id: id, p: { moves: [], goods: [], handover: [], debts: [], staff: others.map((s) => ({ employee_id: s.employee_id, source: s.source || 'lich', role: s.role || null, worked: true })) } });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id; await wait('.cm-col'); await sleep(600);
    ok(!!$('#cm-claim'), `nút "Tôi chốt ca này" hiện cho người ngoài lịch (${me.code})`);
    $('#cm-claim').click(); await wait('.cm-person, #cm-helper, [data-hp]'); await sleep(800);
    const banner = $('.cm-notinca');
    if (isQl) ok(!banner, 'quản lý không thấy dòng nhắc ngoài lịch');
    else {
      ok(!!banner && /không có tên trong lịch/.test(banner.innerText) && /THÊM NGƯỜI LÀM HỘ/i.test(banner.innerText), 'dòng nhắc: ' + (banner?.innerText || '(không có)'));
      // tự thêm tên mình ở mục làm hộ → dòng nhắc biến mất
      $('[data-hp="in"]').click(); await wait('[data-add-emp]', 100);
      const mine = $(`[data-add-emp="${me.employee_id}"]`);
      ok(!!mine, `có tên mình trong danh sách làm hộ (mã ${me.employee_id}; ${$$('[data-add-emp]').length} người trong danh sách)`);
      const n0 = $$('.cm-person').length; const label = (mine?.querySelector('strong')?.innerText || '').trim();
      mine?.click(); await sleep(600);
      ok(!$('.cm-notinca'), 'thêm tên mình xong → hết dòng nhắc');
      ok($$('.cm-person').length === n0 + 1 && !!label && $$('.cm-person').some((p) => p.innerText.includes(label)), `tên mình (${label}) có trong danh sách người làm`);
    }
    const w = W(); ok(w.sw <= w.w + 1 && !w.wide.length, `không tràn ngang (${w.w}/${w.sw}${w.wide.length ? ' ' + w.wide.join(',') : ''})`);
  } catch (e) { errs.push('lỗi: ' + e.message); r.push('LỖI ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  out.push({ route: 'chốt ca ngoài lịch (việc #11)', title: r.join(' || '), len: 0, errs: [...errs, ...(window.__ERR || [])] });
};
