// KIỂM TRA VÙNG KHOÁ (bước 152, 19/11 — thay bài bước 129; đổi 22/11 theo thiết kế "Đưa Đối soát Fabi về lại Chốt ca", anh Tiến duyệt):
// trang đối soát của ca có 3 tab. Tab ① Phần việc KHÔNG có phần tiền (không nút ✎ Mở để sửa / Lưu, không ô sửa số tiền).
// Tiền chỉ làm ở tab ② ③ = khối 6 bước của Sổ thu chi (chế độ một ca), ĐÚNG ca đang mở (#stc-page.stc-one[data-ds=<ca>]); thay cho thẻ dẫn sang Sổ thu chi cũ.
// 28/11/2026 (bỏ trang đối soát cũ): bài chạy trên trang mới #/ca/doi-soat?id= — bước ① [data-dsm-pane=viec] không có ô tiền; tiền ở bước ② [data-dsm-pane=tien] của đúng ca.
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
    // 28/11/2026 (anh Tiến: "xoá đối soát cũ"): trang đối soát cũ (#/ca/phieu?..&__ds=1, 3 thẻ + khối 6 bước) đã bỏ — bài này kiểm đúng các ý cũ trên trang mới #/ca/doi-soat?id=
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca/doi-soat?id=' + id; await wait('#dsm'); await sleep(1800);
    check(!$('#ds-money-open') && !$('#ds-money-save') && !$('.ds-editing') && !$('.ds-mlock') && !$('#pc-form') && !$('.ds-ptabs'), 'không còn nút ✎ Mở để sửa / Lưu phần tiền (trang đối soát cũ đã bỏ)');
    const pane = $('[data-dsm-pane="viec"]');
    const inputs = pane ? [...pane.querySelectorAll('#total_revenue, #reported_transfer, #moves input, #debts input, .lx-box input, .stc-dsp input, .stc-part input, .stc-c4 input')].filter((x) => !x.disabled && x.type !== 'hidden') : [];
    check(!!pane && !inputs.length && !pane.querySelector('.stc-dsp, .stc-c4, [data-dsclose], [data-tick]'), 'bước ① Phần việc không có ô sửa số tiền, không có khối số máy Fabi / mục tích tiền' + (inputs.length ? ` (còn ${inputs.length} ô)` : !pane ? ' (không thấy bước ①)' : ''));
    check(!$('a.ds-stc') && !$('.ds-stc-card'), 'không còn thẻ dẫn sang Sổ thu chi (tiền ở bước ② ngay trong trang)');
    const mp = $('[data-dsm-pane="tien"]');
    check(!!mp && !!$('[data-dsm-pane="xong"]') && $('#dsm-phieu')?.getAttribute('href') === '#/ca/phieu?id=' + id && new URLSearchParams(location.hash.split('?')[1] || '').get('id') === String(id),
      'bước ② ③ là phần tiền của ĐÚNG ca đang mở (ca ' + id + ')' + (mp ? '' : ' (không thấy)'));
    // bước 152 (lỗi duyệt mã C1): sửa phần việc ở Đối soát ca KHÔNG được gửi số tiền / thu chi / khách nợ (trang mới chỉ gửi khoá staff)
    { const k0 = window.__LOG.length;
      const st = pane && pane.querySelector('[data-dsmst]'); if (st) { st.click(); await wait('dialog[open] form [name=note]', 40); await sleep(200); }
      const f = $('dialog[open] form');
      if (f) { setv(f.elements.note, 'ghi chú thử'); setv(f.elements.reason, 'thử sửa ghi chú'); f.querySelector('[type=submit]').click(); }
      for (let i = 0; i < 40 && !window.__LOG.slice(k0).some((x) => x[0] === 'rpc' && x[1] === 'app_ca_recon_save'); i++) await sleep(150);
      await sleep(900);
      const sv = window.__LOG.slice(k0).filter((x) => x[0] === 'rpc' && x[1] === 'app_ca_recon_save').map((x) => (x[2] && x[2].p) || {});
      const bad = sv.flatMap((q) => Object.keys(q).filter((k) => k !== 'staff'));
      check(!!st && sv.length > 0 && !bad.length, 'sửa ghi chú người làm ở Đối soát ca: lưu chỉ gửi người làm, không gửi ô tiền' + (!st ? ' (không thấy nút sửa người làm)' : !sv.length ? ' (không thấy lần lưu: ' + (($('dialog[open] .dsm-err2') || {}).textContent || '') + ')' : bad.length ? ' (gửi ' + [...new Set(bad)].join(', ') + ')' : ''));
      $('dialog[open]')?.close(); }
    if (new URLSearchParams(location.search).get('dung')) { window.scrollTo(0, 0); out.push({ route: 'ql_tu_ds', title: seen.join(' · '), errs: fails }); return; }   // &dung=1: dừng để chụp màn hình
    const t2 = document.querySelector('[data-dsm-tab="tien"]');
    check(!!t2, 'có bước ② Tiền');
    { const m2 = $('[data-dsm-pane="tien"]'), v2 = $('[data-dsm-pane="viec"]'); check(!!m2 && m2.hidden && !!v2 && !v2.hidden && getComputedStyle(m2).display === 'none', 'đang ở bước ① thì phần tiền ẩn hẳn (không sửa tiền lẫn trong phần việc)'); }
    const wide = document.documentElement.scrollWidth > window.innerWidth + 1;
    check(!wide, 'không tràn ngang');
  } catch (err) { fails.push('LỖI: ' + (err && err.message || err)); }
  out.push({ route: 'ql_tu_ds', title: seen.join(' · ').slice(0, 500), errs: fails });
};
