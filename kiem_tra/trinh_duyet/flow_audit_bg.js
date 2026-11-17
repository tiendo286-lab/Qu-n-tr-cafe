// Bước 119 · KIỂM TRA: quản lý sửa Bàn giao ca sau ở bước Kiểm tra (ghi lý do) → lưu qua app_ca_recon_handover_save;
// xoá ảnh phiếu Fabi (còn 2 ảnh) → còn 1 ảnh. role=chu, confirm=1
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  window.confirm = () => true;
  let fail = null; let seen = '';
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
      cash_counted: 5500000, ipos_opening: 1000000, opening_cash: 1000000, pos_debt: 0, pos_diff: 0, cups: 50, moves: [], goods: [], handover: [{ content: 'Máy xay kêu to' }], debts: [], staff } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos/a.jpg', p_kind: 'ipos' });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos/b.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    const open = async (b) => { location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca/phieu?id=' + id + '&__ds=1&buoc=' + b; await wait('.ds-pane'); await sleep(2000); };
    await open(3);
    const why = document.querySelector('.rc-why') || $('#rc-reason'); if (!why) throw new Error('Không có ô lý do sửa');
    why.value = 'sửa nội dung bàn giao'; why.dispatchEvent(new Event('input', { bubbles: true }));
    const ta = $('.ho-row .ho-text'); if (!ta || ta.disabled) throw new Error('Ô bàn giao bị khoá');
    ta.value = 'Máy xay kêu to — đã báo thợ'; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(3500);
    const after = await rpc('app_ca_get', { p_id: id });
    const hs = (after.handover || []).map((h) => h.content); seen = 'bàn giao: ' + hs.join(' / ');
    if (!hs.includes('Máy xay kêu to — đã báo thợ')) fail = 'Không lưu nội dung bàn giao mới';
    await open(4);
    // bước 121: ảnh phiếu Fabi sửa khi Đang sửa phần tiền → Lưu (lý do trong hộp)
    $('#ds-money-open')?.click(); await sleep(1500); await wait('.ds-pane');
    const del = $('.ph-del-ds'); if (!del) throw new Error('Không có nút xoá ảnh Fabi');
    del.click(); await sleep(300);
    $('#ds-money-save')?.click(); await sleep(400);
    const why2 = $('dialog[open] [name=why]'); if (!why2) throw new Error('Không có hộp lý do khi Lưu');
    why2.value = 'ảnh mờ'; $('dialog[open] form').requestSubmit(); await sleep(2500);
    const n = ((await rpc('app_ca_get', { p_id: id })).photos || []).filter((p) => p.kind === 'ipos').length; seen += ' · ảnh Fabi còn ' + n;
    if (n !== 1) fail = fail || 'Xoá ảnh không đúng (còn ' + n + ')';
  } catch (er) { fail = er.message; }
  out.push({ route: 'audit_bg', title: seen, errs: fail ? [fail] : [] });
};
