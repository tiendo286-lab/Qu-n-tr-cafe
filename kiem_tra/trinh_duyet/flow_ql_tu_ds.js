// KIỂM TRA (bước 129 · sửa 18/11): Quản lý (không phải Chủ) bấm ✎ Mở để sửa trên phiếu có mục WEB TỰ ĐỐI SOÁT
// → ô thu chi, báo nợ, doanh thu phải SỬA ĐƯỢC (trước đây vẫn bị khoá dù máy chủ đã cho Lưu) và Lưu được.
// Chạy: role=ql (hoặc role=chu để so), confirm=1, script=flow_ql_tu_ds — index.html và test/phone.html.
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
    const btn = $('#ds-money-open');
    check(!!btn && !btn.hidden, 'có nút ✎ Mở để sửa');
    if (!btn) throw new Error('không có nút Mở để sửa');
    btn.click(); await sleep(1500);
    check(!!$('.ds-editing'), 'vào chế độ Đang sửa');
    const mv = $('#moves input:not([type=hidden])'); const db = $('#debts .db-amt'); const tr = $('#total_revenue');
    check(mv && !mv.disabled, 'ô thu chi sửa được' + (mv ? '' : ' (không thấy ô)'));
    check(db && !db.disabled, 'ô báo nợ sửa được' + (db ? '' : ' (không thấy ô)'));
    check(tr && !tr.disabled, 'ô Doanh thu NET sửa được' + (tr ? '' : ' (không thấy ô)'));
    if (db && !db.disabled) {
      setv(db, '450.000'); await sleep(400);
      $('#ds-money-save')?.click(); await sleep(800);
      const w = $('dialog[open] [name=why]'); if (w) w.value = 'thử sửa';
      $('dialog[open] form')?.requestSubmit(); await sleep(2500);
      const R2 = await rpc('app_ca_get', { p_id: id });
      const d = (R2.debts || []).find((x) => x.table_name === 'Khách thử');
      check(d && Number(d.amount) === 450000, 'Lưu báo nợ 500.000 → 450.000 lên máy chủ (thấy ' + (d ? d.amount : 'không có') + ')');
    }
    const wide = document.documentElement.scrollWidth > window.innerWidth + 1;
    check(!wide, 'không tràn ngang');
  } catch (err) { fails.push('LỖI: ' + (err && err.message || err)); }
  out.push({ route: 'ql_tu_ds', title: seen.join(' · ').slice(0, 500), errs: fails });
};
