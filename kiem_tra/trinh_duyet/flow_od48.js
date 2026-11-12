// Khách trả nợ cũ ngay ở bước Phiếu Fabi (role=nv, điện thoại): ca sáng có bàn 13 nợ 83.000 → ca chiều phiếu Fabi đã cộng 83.000 khách trả
// vào tiền phải có (chênh lệch −40.000) → web gợi ý "bàn 13", chọn "Trả bằng tiền mặt" ngay ở bước 3 → các số khớp, qua bước. (Số thử, không phải số thật.)
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s);
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const num = (k, v) => setv($(`.cm-num[data-f="${k}"]`), v);
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    for (const m of ['../js/chot_ca_moi.js', '../js/pages/phieu_ca.js']) await Promise.race([import(m).catch(() => {}), sleep(4000)]);
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const o1 = ov.find((x) => x.shift === ov[0].shift && x.branch_id === ov[0].branch_id);
    const o2 = ov.find((x) => x.branch_id === o1.branch_id && x.shift !== o1.shift);
    // ca sáng: có bàn 13 nợ 83.000, gửi xong
    const id1 = await rpc('app_ca_open', { p_branch: o1.branch_id, p_date: day, p_shift: o1.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id1, p_part: k, p_force: false });
    const R1 = await rpc('app_ca_get', { p_id: id1 });
    await rpc('app_ca_save', { p_id: id1, p: { rev_start: R1.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 3000000, total_revenue: 5000000, pos_cash: 1917000, pos_transfer: 3000000,
      cash_counted: 2917000, ipos_opening: 1000000, pos_debt: 83000, pos_diff: 0, cups: 50, moves: [], goods: [], handover: [], debts: [{ table_name: '13', amount: 83000, note: '' }],
      staff: (R1.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) } });
    await rpc('app_ca_photo_add', { p_id: id1, p_path: 'r/x.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id1, p_part: k, p_on: true, p_as_staff: true });
    r.push(`ca sáng: ${(await rpc('app_ca_get', { p_id: id1 })).status}`);
    // ca chiều: nhân viên chốt trên điện thoại
    const id2 = await rpc('app_ca_open', { p_branch: o2.branch_id, p_date: day, p_shift: o2.shift });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id2; await wait('#cm-claim'); await sleep(500);
    $('#cm-claim').click(); await wait('#cm-helper'); await sleep(800);
    if (!document.querySelectorAll('.cm-person').length) { setv($('#cm-helper'), $('#cm-emps option')?.value || ''); $('#cm-add-helper').click(); await sleep(300); }
    document.querySelectorAll('[data-t]').forEach((i) => { if (!i.value) setv(i, i.dataset.k === 'time_in' ? '12:40' : '17:10'); });
    $('#cm-next').click(); await sleep(700);
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 60; cv.getContext('2d').fillRect(0, 0, 40, 60);
    const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'phieu.jpg', { type: 'image/jpeg' }));
    const inp = $('#cm-photo'); inp.files = dt.files; inp.dispatchEvent(new Event('change')); await sleep(1500);
    if ($('#cm-open')) setv($('#cm-open'), '12:40');
    setv($('#cm-close'), '17:10');
    num('ipos_opening', '1000000'); num('total_revenue', '3322000'); num('pos_transfer', '2298000'); num('pos_cash', '996000'); num('pos_debt', '28000'); num('cash_counted', '2039000');
    $('[data-sign="-1"]').click(); await sleep(300); num('pos_diff', '40000'); await sleep(400);
    r.push(`Chưa chọn khách trả nợ: ${txt('#cm-checks')}`);
    r.push(`Mục ở bước Phiếu Fabi: ${txt('#cm-body h3')} · ${document.querySelectorAll('#cm-body [data-paid]').length} khoản · ${W()}`);
    const sel = $('#cm-body [data-paid]'); sel.value = 'tien_mat'; sel.dispatchEvent(new Event('change')); await sleep(1500);
    r.push(`Sau khi chọn bàn 13 trả tiền mặt: ${txt('#cm-checks')}`);
    $('#cm-next').click(); await sleep(900);
    r.push(`Bấm Tiếp → ${txt('#cm-root h2')} · ${txt('#cm-err')}`);
    r.push(`Bước Khách nợ: ô chọn trả nợ ${document.querySelectorAll('#cm-body [data-paid]').length} · ${txt('#cm-body')} · ${W()}`);
    // đi tiếp tới bước 10: tiền mặt / chuyển khoản thực tế phải thu
    const next = async () => { $('#cm-next').click(); await sleep(800); };
    const typ = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    $('#cm-add-debt').click(); await sleep(200); setv($('[data-db="0"][data-k="table_name"]'), '7'); setv($('[data-db="0"][data-k="amount"]'), '28000'); await next();
    typ($('#cm-hot'), '2298000'); await sleep(300); await next();
    $('#cm-nomoves').click(); await sleep(100); await next();
    setv($('#cm-cups'), '60'); await next();
    setv($('#cm-diff-note'), 'thiếu 40.000'); await next();
    await next(); await sleep(500);
    r.push(`Bước 10: ${txt('#cm-root h2')} · ${txt('.cm-real')} · ${W()}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'khách trả nợ ở bước Phiếu Fabi', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
