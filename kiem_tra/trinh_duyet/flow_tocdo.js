// Bước 134: đo thời gian mở từng trang khi mỗi lần hỏi máy chủ mất &tre=… ms (mặc định bản giả lập 2ms).
// Chạy: script=flow_tocdo&role=chu&tre=300 — mỗi trang báo: tổng ms · số câu hỏi · số "đợt" phải chờ lần lượt.
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s);
  const res = [];
  try {
    for (let i = 0; i < 300 && !$('#root .content, #root h1'); i++) await sleep(100);
    document.querySelector('#rm-close')?.click();
    const { rpc } = await import('../js/sb.js');
    // dựng 2 phiếu ca thử: 1 phiếu đã gửi (xem / đối soát) + 1 phiếu đang chốt (nhân viên điền)
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const rid = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[0].shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: rid, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: rid }); const e = (await rpc('app_ca_employees'))[0];
    await rpc('app_ca_save', { p_id: rid, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 2400000, total_revenue: 6900000, pos_cash: 4500000, pos_transfer: 2400000,
      cash_counted: 5300000, ipos_opening: 1000000, opening_cash: 1000000, pos_debt: 0, pos_diff: -200000, cups: 50, goods: [], handover: [], debts: [],
      moves: [{ kind: 'tien_mat', amount: -150000, note: 'Mua đá' }, { kind: 'tien_mat', amount: -50000, note: 'Mua chanh' }],
      staff: [{ employee_id: e.id, source: 'ho_tro', worked: true, time_in: '06:45', time_out: '12:39' }] } });
    await rpc('app_ca_photo_add', { p_id: rid, p_path: 'r' + rid + '/ipos/a.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: rid, p_part: k, p_on: true, p_as_staff: true });
    const o2 = ov.find((x) => x.branch_id !== ov[0].branch_id) || ov[1];
    const rid2 = await rpc('app_ca_open', { p_branch: o2.branch_id, p_date: day, p_shift: o2.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: rid2, p_part: k, p_force: false });
    const routes = (new URLSearchParams(location.search).get('r') || [
      '/hom-nay', '/ca', `/ca/phieu?id=${rid}`, `/ca/phieu?id=${rid2}`, `/quan-ly/doi-soat/ca?id=${rid}`, '/quan-ly/doi-soat', '/quan-ly/so-thu-chi?tab=chi',   // bước 152: Thu chi / Lệch tiền ca cũ đã xoá
      '/quan-ly/bao-cao', '/hang-hoa/nhan', '/hang-hoa/doi-soat', '/hang-hoa/phieu-xuat', '/lich', '/quan-ly/lich-tong', '/quan-ly/cong-no',
      '/quan-ly/giao-viec', '/viec', '/quan-ly/so-thu-chi?tab=tong', '/quan-ly/chot-thang', '/order', '/quan-ly/canh-bao', '/quan-ly/nhan-vien',
    ].join(',')).split(',');
    // mở web lần đầu: từ lúc tải trang tới khi xong câu hỏi cuối cùng trước khi đo
    { const c = window.__RPCT; let w = 0, p = -1e9; for (const s of c.map((x) => x[1]).sort((a, b) => a - b)) { if (s - p > 50) w++; p = s; }
      res.push(`MỞ WEB LẦN ĐẦU: ${Math.round(Math.max(0, ...c.map((x) => x[2])))}ms · ${c.length} câu · ${w} đợt [${c.map((x) => x[0].replace(/^app_/, '')).join(' ')}]`); }
    await sleep(3000);   // để phần đếm số trên menu (1 lần / phút) chạy xong trước khi đo
    for (const r of routes) {
      const before = window.__RPCT.length; const t0 = performance.now();
      location.hash = '#' + r.replace('RID2', rid2).replace('RID', rid);
      // xong = không còn câu hỏi mới trong 1,5 giây
      let last = performance.now(), seen = before;
      for (let k = 0; k < 600; k++) {
        await sleep(100);
        if (window.__RPCT.length !== seen) { seen = window.__RPCT.length; last = performance.now(); }
        if (performance.now() - last > 1500) break;
      }
      const calls = window.__RPCT.slice(before);
      const end = calls.length ? Math.max(...calls.map((c) => c[2])) : t0;
      // đếm đợt: gom các câu bắt đầu gần nhau (< 50ms) thành 1 đợt
      const starts = calls.map((c) => c[1]).sort((a, b) => a - b); let waves = 0, prev = -1e9;
      for (const s of starts) { if (s - prev > 50) waves++; prev = s; }
      res.push(`${r.split('?')[0]} → ${location.hash.slice(1).split('?')[0]} «${document.title.split(' · ')[0]}»: ${Math.round(end - t0)}ms · ${calls.length} câu · ${waves} đợt [${calls.map((c) => c[0].replace(/^app_/, '')).join(' ')}]`);
    }
  } catch (e) { res.push('FAIL: ' + e.stack); }
  out.push({ route: 'tốc độ trang', title: res.join(' || '), errs: res.filter((x) => x.startsWith('FAIL:')) });
};
