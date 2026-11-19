// KIỂM TRA VÙNG KHOÁ (bước 152, 19/11 — thay bài bước 129): trang Đối soát ca KHÔNG còn phần tiền.
// Bước Tiền chỉ còn thẻ dẫn sang Sổ thu chi › Đối soát Fabi (mở đúng ca); không còn nút ✎ Mở để sửa / Lưu, không còn ô sửa số tiền.
// Phiếu thử có mục WEB TỰ ĐỐI SOÁT như trước (để chắc không còn đường nào sửa tiền ở trang cũ).
// Chạy: role=ql và role=chu, confirm=1, script=flow_ql_tu_ds — index.html và test/phone.html.
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  window.confirm = () => true;
  const fails = []; const seen = [];
  const check = (ok, m) => { (ok ? seen : fails).push(m); };
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    document.querySelector('#rm-close')?.click(); await sleep(200);
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const o = ov.find((x) => x.branch_code === 'LLB') || ov[0];
    const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: id });
    const e = (await rpc('app_ca_employees'))[0];
    const staff = (R.staff || []).length ? R.staff.map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) : [{ employee_id: e.id, source: 'ho_tro', worked: true, time_in: '06:45', time_out: '12:39' }];
    await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 2400000, total_revenue: 6900000, pos_cash: 4500000, pos_transfer: 2400000,
      cash_counted: 5300000, ipos_opening: 1000000, opening_cash: 1000000, pos_debt: 0, pos_diff: -200000, cups: 50, goods: [], handover: [], staff,
      debts: [{ kind: 'muon', table_name: 'Khách thử', amount: 500000, note: 'ck rút tm' }],
      moves: [{ kind: 'tien_mat', amount: -150000, note: 'Mua đá' }] } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos/a.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    await rpc('app__test_auto_lock', { p_id: id, p_items: ['thoi_gian', 'doanh_thu', 'cong_no', 'thu_chi'] });   // như phiếu LHP 9/11 Sáng
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca/phieu?id=' + id + '&__ds=1&buoc=4'; await wait('.ds-pane'); await sleep(1800);
    check(!$('#ds-money-open') && !$('#ds-money-save') && !$('.ds-editing') && !$('.ds-mlock'), 'không còn nút ✎ Mở để sửa / Lưu phần tiền');
    const pane = $('.ds-pane[data-ds="3"]') || document;
    const inputs = [...pane.querySelectorAll('#total_revenue, #reported_transfer, #moves input, #debts input, .lx-box input')].filter((x) => !x.disabled && x.type !== 'hidden');
    check(!inputs.length, 'bước Tiền không còn ô sửa số tiền' + (inputs.length ? ` (còn ${inputs.length} ô)` : ''));
    const a = pane.querySelector('a.ds-stc');
    const href = a ? a.getAttribute('href') : '';
    check(!!a && /quan-ly\/so-thu-chi\?/.test(href) && /tab=doi-soat/.test(href) && new RegExp('ds=' + id + '(&|$)').test(href), 'có thẻ "Phần tiền làm ở Sổ thu chi › Đối soát Fabi" mở đúng ca' + (a ? '' : ' (không thấy)'));
    check(!!a && /(chưa xác nhận fabi|đã xác nhận fabi|đã chốt ca)/i.test(a.closest('.ds-stc-card')?.innerText || ''), 'thẻ ghi trạng thái phần tiền');
    // bước 152 (lỗi duyệt mã C1): sửa phần việc ở Đối soát ca KHÔNG được gửi số tiền / thu chi / khách nợ rỗng (ô tiền đã bỏ khỏi trang)
    { location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca/phieu?id=' + id + '&__ds=1&buoc=1'; await wait('.ds-pane'); await sleep(1500);
      const k0 = window.__LOG.length;
      const why = $('.rc-why') || $('#rc-reason'); if (why) setv(why, 'thử sửa giờ');
      const note = $('.st-row .st-note'); if (note) { note.focus(); setv(note, 'ghi chú thử'); note.blur(); note.dispatchEvent(new Event('focusout', { bubbles: true })); }
      for (let i = 0; i < 40 && !window.__LOG.slice(k0).some((x) => x[0] === 'rpc' && x[1] === 'app_ca_recon_save'); i++) await sleep(150);
      const sv = window.__LOG.slice(k0).filter((x) => x[0] === 'rpc' && x[1] === 'app_ca_recon_save').map((x) => (x[2] && x[2].p) || {});
      const bad = sv.flatMap((p) => ['total_revenue', 'pos_cash', 'pos_transfer', 'reported_transfer', 'cash_counted', 'opening_cash', 'rev_start', 'moves', 'debts'].filter((k) => k in p));
      check(!!note && sv.length > 0 && !bad.length, 'sửa giờ / ghi chú người làm ở Đối soát ca: lưu không gửi ô tiền rỗng' + (!note ? ' (không thấy ô)' : !sv.length ? ' (không thấy lần lưu)' : bad.length ? ' (gửi ' + [...new Set(bad)].join(', ') + ')' : ''));
      location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca/phieu?id=' + id + '&__ds=1&buoc=4'; await wait('.ds-pane'); await sleep(1200); }
    if (new URLSearchParams(location.search).get('dung')) { window.scrollTo(0, 0); out.push({ route: 'ql_tu_ds', title: seen.join(' · '), errs: fails }); return; }   // &dung=1: dừng để chụp màn hình
    const a2 = document.querySelector('.ds-pane[data-ds="3"] a.ds-stc');
    if (a2) {
      a2.click(); await sleep(2500);
      const hp = new URLSearchParams(location.hash.split('?')[1] || '');
      check(location.hash.startsWith('#/quan-ly/so-thu-chi') && hp.get('tab') === 'doi-soat' && hp.get('ds') === String(id), 'bấm thẻ → Sổ thu chi › Đối soát Fabi đúng ca (' + location.hash.slice(0, 80) + ')');
      check(!!document.querySelector('#stc-page, #root .alert'), 'trang Sổ thu chi mở được');
      history.back(); await sleep(1500);
    }
    const wide = document.documentElement.scrollWidth > window.innerWidth + 1;
    check(!wide, 'không tràn ngang');
  } catch (err) { fails.push('LỖI: ' + (err && err.message || err)); }
  out.push({ route: 'ql_tu_ds', title: seen.join(' · ').slice(0, 500), errs: fails });
};
