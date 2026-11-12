// Sửa lỗi 12/11: ở trang Đối soát ca, sửa mục "Nhân viên thực tế làm trong ca" (người nghỉ → có làm, thêm người hỗ trợ)
// thì khung "Nghỉ & làm thay" bên dưới phải tự vẽ lại theo danh sách mới (sau khi tự lưu). role=chu (confirm=1).
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 900) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc } = await import('../js/sb.js');
    const day = '2026-11-04';
    const ov = await rpc('app_ca_overview', { p_date: day });
    const id = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[0].shift });
    const R = await rpc('app_ca_get', { p_id: id });
    const emps = await rpc('app_ca_employees');
    const inCa = new Set((R.staff || []).map((s) => s.employee_id));
    const helper = emps.find((e) => !e.pay_cash && !inCa.has(e.id) && e.id !== 3 && e.id !== 5);
    const staff = (R.staff || []).map((s, i, arr) => { const off = i === arr.length - 1; return { ...s, worked: !off, time_in: off ? null : '06:45', time_out: off ? null : '12:30', absent_reason: off ? 'Nghỉ' : null }; });
    staff.push({ employee_id: helper.id, source: 'ho_tro', worked: true, time_in: '06:30', time_out: '12:30' });
    await rpc('app_ca_save', { p_id: id, p: { rev_end: day + ' 12:30', total_revenue: 2000000, pos_cash: 1200000, pos_transfer: 800000, reported_transfer: 800000, cash_counted: 2200000, opening_cash: 1000000, ipos_opening: 1000000, cups: 80, pos_debt: 0, pos_diff: 0,
      moves: [], staff, handover: [], goods: [], debts: [] } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat/ca?id=' + id + '&buoc=1';
    await wait('#ds-cv .cv-a', 600); await sleep(800);
    const names = () => $$('#ds-cv .cv-row strong').map((x) => x.innerText.split(' – ')[0]).join(', ');
    r.push(`Trước khi sửa: nghỉ ${$$('#ds-cv .cv-a').length} · hỗ trợ ${$$('#ds-cv .cv-e').length} (${names()})`);
    // người nghỉ → Có làm
    const off = $$('.st-row').find((x) => x.querySelector('.st-worked').value === '0');
    const sel = off.querySelector('.st-worked'); sel.value = '1'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    off.querySelector('.st-in').value = '06:45'; off.querySelector('.st-out').value = '12:30'; off.querySelector('.st-out').dispatchEvent(new Event('input', { bubbles: true }));
    for (let i = 0; i < 80 && $$('#ds-cv .cv-a').length; i++) await sleep(100); await sleep(600);
    r.push(`Sau khi sửa (tự lưu): ${txt('#ds-cv h2')} · nghỉ ${$$('#ds-cv .cv-a').length} · hỗ trợ ${$$('#ds-cv .cv-e').length} · ${txt('#ds-cv').slice(0, 160)} · ${W()}`);
    // lại cho 1 người nghỉ rồi bấm Lưu phân loại NGAY (chưa kịp tự lưu) → web lưu nhân viên trước
    const a2 = $$('.st-row')[0]; const s2 = a2.querySelector('.st-worked'); s2.value = '0'; s2.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(100);
    const save = $('#ds-cv #cv-save');
    r.push(`Bấm Lưu phân loại ngay: có nút ${!!save}`);
    if (save) { save.click(); await sleep(2500); }
    await wait('#ds-cv h2', 300);
    r.push(`Sau Lưu: ${txt('#ds-cv h2')} · nghỉ ${$$('#ds-cv .cv-a').length} (${names()}) · lỗi: ${txt('#cv-err') || 'không'}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'nghỉ & làm thay theo danh sách mới', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
