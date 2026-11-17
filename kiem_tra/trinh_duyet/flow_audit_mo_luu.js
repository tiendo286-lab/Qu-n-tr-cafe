// Bước 121 · KIỂM TRA: bước Tiền ở phần Kiểm tra — mặc định chỉ xem, 1 nút Mở, sửa không lưu ngay, 1 nút Lưu (hỏi lý do 1 lần), Huỷ bỏ thay đổi.
// role=chu, confirm=1 (máy tính và test/phone.html)
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const vis = (s) => { const el = $(s); return !!el && !el.hidden && el.offsetParent !== null; };
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  window.confirm = () => true;
  const fails = []; const seen = [];
  const check = (ok, m) => { (ok ? seen : fails).push(m); };
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
    const open = async () => { location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca/phieu?id=' + id + '&__ds=1&buoc=4'; await wait('.ds-pane'); await sleep(1800); };
    const srvMoves = async () => { const RC = await rpc('app_ca_recon', { p_id: id }); return (RC.data?.moves || []).map((m) => `${m.note}:${m.amount}`).sort().join('|'); };
    await open();
    // 1) chỉ xem
    check(vis('#ds-money-open'), 'Chỉ xem: có nút Mở để sửa');
    check($$('.ds-pane[data-ds="3"] #moves .mv-amt').length > 0 && $$('.ds-pane[data-ds="3"] #moves .mv-amt').every((x) => x.disabled), 'Chỉ xem: ô thu chi khoá');
    check(!$$('.ds-pane[data-ds="3"] .rc-why, .ds-pane[data-ds="3"] #rc-reason').some((x) => x.offsetParent !== null), 'Chỉ xem: không còn ô lý do ở phần tiền');
    check(!$('#ds-money-edit') && !$('[data-paid-save]') && !$$('.lx-save').some((x) => x.offsetParent !== null), 'Không còn nút Sửa phần tiền / Lưu sửa / Lưu cách xử lý');
    // 2) mở để sửa
    $('#ds-money-open')?.click(); await sleep(1500); await wait('.ds-pane');
    check(vis('#ds-money-save') && vis('#ds-money-cancel') && !vis('#ds-money-open'), 'Đang sửa: chỉ còn Huỷ và Lưu');
    const rowOf = (note) => $$('#moves .mv-row').find((r) => r.querySelector('.mv-note')?.value === note);
    const da = rowOf('Mua đá'); check(!!da && !da.querySelector('.mv-amt').disabled, 'Đang sửa: ô thu chi mở');
    if (da) setv(da.querySelector('.mv-amt'), '100.000');
    rowOf('Mua giấy')?.querySelector('.pc-del')?.click(); await sleep(200);
    $('[data-addsg="1"]')?.click(); await sleep(300);
    const nr = $$('#moves .mv-row').pop(); if (nr) { setv(nr.querySelector('.mv-note'), 'Hoàn tiền'); setv(nr.querySelector('.mv-amt'), '50.000'); }
    $('[data-newdebt]')?.click(); await sleep(300);
    const dr = $$('#debts .uv-debt').pop(); if (dr) { setv(dr.querySelector('.db-table'), 'Bàn 5'); setv(dr.querySelector('.db-amt'), '40.000'); }
    await sleep(2500);
    check((await srvMoves()) === ['Mua chanh:-20000', 'Mua giấy:-30000', 'Mua đá:-150000'].sort().join('|'), 'Đang sửa: chưa lưu gì lên máy chủ');
    check(/[1-9] thay đổi/i.test($('#ds-money-save')?.innerText || ''), 'Nút Lưu đếm số thay đổi: ' + ($('#ds-money-save')?.innerText || '').trim());
    // 3) Lưu → hộp lý do
    $('#ds-money-save')?.click(); await sleep(500);
    const dlg = $('dialog[open]'); check(!!dlg && dlg.querySelectorAll('li').length >= 4, 'Lưu: hộp liệt kê thay đổi (' + (dlg ? dlg.querySelectorAll('li').length : 0) + ' dòng)');
    if (dlg) {
      dlg.querySelector('form').requestSubmit(); await sleep(400);
      check(!!$('dialog[open]') && /lý do/i.test($('dialog[open]')?.innerText || ''), 'Lưu: thiếu lý do thì chặn');
      const w = $('dialog[open] [name=why]'); if (w) w.value = 'gõ nhầm';
      $('dialog[open] form')?.requestSubmit(); await sleep(2500); await wait('.ds-pane'); await sleep(800);
    }
    const after = await srvMoves();
    check(after.includes('Mua đá:-100000') && after.includes('Hoàn tiền:50000') && !after.includes('Mua giấy'), 'Lưu: máy chủ đã có thay đổi thu chi (' + after + ')');
    check(((await rpc('app_ca_get', { p_id: id })).debts || []).some((d) => d.table_name === 'Bàn 5'), 'Lưu: máy chủ có Báo nợ mới');
    check(vis('#ds-money-open') && !!$('.mv-note-sua'), 'Lưu xong: về Chỉ xem, có ghi chú sửa');
    // 4) Huỷ
    $('#ds-money-open')?.click(); await sleep(1500);
    const da2 = rowOf('Mua đá'); if (da2) setv(da2.querySelector('.mv-amt'), '90.000');
    $('#ds-money-cancel')?.click(); await sleep(1500);
    check(vis('#ds-money-open') && (await srvMoves()).includes('Mua đá:-100000'), 'Huỷ: bỏ thay đổi, về Chỉ xem');
    // 5) Lưu khi không đổi gì
    $('#ds-money-open')?.click(); await sleep(1500); $('#ds-money-save')?.click(); await sleep(1200);
    check(!$('dialog[open]') && vis('#ds-money-open'), 'Lưu không đổi gì: không hỏi lý do');
    check(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, 'Không tràn ngang');
  } catch (er) { fails.push(er.message); }
  out.push({ route: 'audit_mo_luu', title: seen.join(' · ').slice(0, 500), errs: fails });
};
