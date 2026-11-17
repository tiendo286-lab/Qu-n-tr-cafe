// Bước 120 · KIỂM TRA: ghi chú khi Chủ / quản lý sửa · xoá · thêm khoản Thu / Chi.
// Bước Kiểm tra: ✎ dưới dòng sửa (NV ghi: 150.000), ＋ dưới dòng thêm, dòng xoá gạch ngang có ✗.
// Phiếu nhân viên (mở không __ds): nhãn "Quản lý đã sửa 3 khoản thu chi", "Bạn ghi: 150.000", dòng xoá. role=chu, confirm=1
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim();
  window.confirm = () => true;
  const fails = []; const seen = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
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
      cash_counted: 5300000, ipos_opening: 1000000, opening_cash: 1000000, pos_debt: 0, pos_diff: -200000, cups: 50, goods: [], handover: [], debts: [], staff,
      moves: [{ kind: 'tien_mat', amount: -150000, note: 'Mua đá' }, { kind: 'tien_mat', amount: -30000, note: 'Mua giấy' }, { kind: 'tien_mat', amount: -20000, note: 'Mua chanh' }] } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos/a.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    await rpc('app_ca_recon_save', { p_id: id, p_reason: 'gõ nhầm', p: { moves: [{ kind: 'tien_mat', amount: -100000, note: 'Mua đá' }, { kind: 'tien_mat', amount: -20000, note: 'Mua chanh' }, { kind: 'chuyen_khoan', amount: 50000, note: 'Hoàn tiền' }] } });
    // 1) bước Kiểm tra
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca/phieu?id=' + id + '&__ds=1&buoc=4'; await wait('.ds-pane'); await sleep(2000);
    const sua = $('.mv-note-sua'); const them = $('.mv-note-them'); const del = $('.mv-del');
    seen.push('Kiểm tra: ' + [txt(sua), txt(them), txt(del)].join(' | '));
    if (!sua || !/NV ghi: 150\.000/.test(txt(sua)) || !/gõ nhầm/.test(txt(sua))) fails.push('Kiểm tra: thiếu ghi chú ✎ sửa Mua đá (NV ghi: 150.000, lý do)');
    if (!them || !/thêm/.test(txt(them))) fails.push('Kiểm tra: thiếu ghi chú ＋ thêm');
    if (!del || !/Mua giấy/.test(txt(del)) || !/xoá/.test(txt(del))) fails.push('Kiểm tra: thiếu dòng xoá Mua giấy');
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) fails.push('Kiểm tra: tràn ngang');
    // 2) phiếu nhân viên (chỉ xem)
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca/phieu?id=' + id; await wait('.page-head'); await sleep(2000);
    const pill = [...document.querySelectorAll('.pill')].find((p) => /quản lý đã sửa/i.test(p.innerText));
    const sua2 = $('.mv-note-sua'); const del2 = $('.mv-del');
    seen.push('Phiếu NV: ' + [txt(pill), txt(sua2), txt(del2)].join(' | '));
    if (!pill || !/3 khoản thu chi/i.test(txt(pill))) fails.push('Phiếu NV: thiếu nhãn "Quản lý đã sửa 3 khoản thu chi"');
    if (!sua2 || !/Bạn ghi: 150\.000/.test(txt(sua2))) fails.push('Phiếu NV: thiếu "Bạn ghi: 150.000"');
    if (!del2 || !/Mua giấy/.test(txt(del2))) fails.push('Phiếu NV: thiếu dòng xoá Mua giấy');
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) fails.push('Phiếu NV: tràn ngang');
  } catch (er) { fails.push(er.message); }
  out.push({ route: 'audit_ghi_chu', title: seen.join(' ‖ ').slice(0, 400), errs: fails });
};
