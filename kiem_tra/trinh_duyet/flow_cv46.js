// Bước 46 (role=chu, điện thoại): Chủ tự chốt ca có người nghỉ + người hỗ trợ → phân loại & duyệt nghỉ / làm thay ngay ở bước "Kiểm tra lần cuối";
// phiếu khác đã gửi mà chưa phân loại → hiện ở mục "6. Nghỉ / làm thay" của tab Đối soát
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    for (const m of ['../js/chot_ca_moi.js', '../js/nghi_thay.js', '../js/pages/phieu_ca.js', '../js/pages/doi_soat.js']) await Promise.race([import(m).catch(() => {}), sleep(4000)]);
    window.prompt = () => 'thử';   // hộp ghi chú khi Chủ duyệt
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const emps = await rpc('app_ca_employees');
    const mk = async (o, end = '12:39') => {
      const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
      for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
      const R = await rpc('app_ca_get', { p_id: id });
      const staff = (R.staff || []).map((s, i) => ({ ...s, worked: i !== 0, absent_reason: i === 0 ? 'Ốm' : null, time_in: '06:45', time_out: '12:39' }));
      const h = emps.find((e) => !staff.some((s) => s.employee_id === e.id));
      staff.push({ employee_id: h.id, source: 'ho_tro', worked: true, time_in: '06:45', time_out: '12:39' });
      const l2 = emps.find((e) => e.id !== h.id && !staff.some((s) => s.employee_id === e.id));
      if (!staff.some((s) => s.source === 'lich' && s.worked)) staff.push({ employee_id: l2.id, source: 'lich', worked: true, time_in: '06:45', time_out: '12:39' });
      await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' ' + end, reported_transfer: 3000000, total_revenue: 5000000, pos_cash: 2000000, pos_transfer: 3000000,
        cash_counted: 3000000, ipos_opening: 1000000, pos_debt: 0, pos_diff: 0, cups: 50, moves: [], goods: [], handover: [], debts: [], staff } });
      await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
      return id;
    };
    const o1 = ov.find((x) => x.shift === ov[0].shift && x.branch_id === ov[0].branch_id);
    const id1 = await mk(o1);
    try { sessionStorage.setItem('cm:' + id1, JSON.stringify({ code: 9, viecDone: true, noMoves: true })); } catch (_) { /* bỏ qua */ }
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id1; await wait('#cm-root'); await sleep(1500);
    for (let i = 0; i < 100 && ($('#cm-cv')?.hidden ?? true); i++) await sleep(100);
    await sleep(500);
    r.push(`Bước cuối (Chủ tự chốt): ${txt('#cm-root h2')} · khung nghỉ/làm thay hiện: ${$('#cm-cv') && !$('#cm-cv').hidden} · ${txt('#cm-cv').slice(0, 160)} · ${W()}`);
    // bước 47: lý do Bỏ ca (phạt 200.000đ); tích x2 chưa chọn người → chặn; chọn người trong lịch có làm
    const a = $('#cm-cv .cv-a'); a.querySelector('.cv-reason').value = 'bo_ca';
    r.push(`Lý do: ${[...a.querySelectorAll('.cv-reason option')].map((o) => o.textContent).join(' | ')}`);
    a.querySelector('.cv-x').checked = true; a.querySelector('.cv-x').dispatchEvent(new Event('change'));
    $('#cv-ok').click(); await sleep(300); r.push(`x2 chưa chọn người: ${txt('#cv-err')}`);
    const hs = a.querySelector('.cv-helper'); r.push(`Nhóm người chọn: ${[...hs.querySelectorAll('optgroup')].map((g) => g.label + ' ' + g.children.length).join(' · ')}`);
    const wOpt = hs.querySelector('optgroup[label="Người trong lịch có làm"] option'); hs.value = wOpt.value; hs.dispatchEvent(new Event('change')); await sleep(200);
    $('#cv-ok').click(); for (let i = 0; i < 100 && !txt('#cm-cv').includes('Chủ đã duyệt'); i++) await sleep(100);
    r.push(`Sau Duyệt: ${txt('#cm-cv .pc-sec-head')}`);
    { const cv = await rpc('app_cv_get', { p_id: id1 }); r.push(`Đã lưu: ${cv.rows.map((x) => `${x.reason_label || x.reason} · làm thay ${x.helper} · x2=${x.x2} · phạt ${x.fine}`).join(' | ')}`); }
    $('#cm-next').click(); for (let i = 0; i < 100 && (await rpc('app_ca_get', { p_id: id1 })).status !== 'hoan_thanh'; i++) await sleep(100);
    r.push(`GỬI → ${(await rpc('app_ca_get', { p_id: id1 })).status}`);
    // phiếu khác đã gửi (nhân viên), chưa phân loại
    const o2 = ov.find((x) => x.branch_id === ov[0].branch_id && x.shift !== ov[0].shift);
    const id2 = await mk(o2, '17:10');
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id2, p_part: k, p_on: true, p_as_staff: true });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat'; await wait('#td-cv'); await sleep(800);
    r.push(`Mục 6: ${txt('#td-cv').slice(0, 300)} · ${W()}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'nghỉ / làm thay gọn', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
