// Bước 39: đối soát Nhân sự trước · người trả lương tiền mặt (chi lương tự vào tiền mặt) · Quản lý tổng / Chủ phân loại nghỉ & làm thay, Chủ duyệt
// · bảng công tháng · dấu thực tế trên Lịch cơ sở / Lịch tổng · Công của tôi. role=chu (confirm=1); role=nv chỉ mở Công của tôi.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 900) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const W = () => { const w = document.documentElement.clientWidth; const wide = $$('#root *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > w + 1 && !el.closest('.table-wrap, .grid-wrap, .mtx-wrap')).map((el) => el.tagName + '.' + el.className).slice(0, 4); return `rộng ${w}/${document.documentElement.scrollWidth} · tràn: ${wide.join(', ') || 'không'}`; };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(200); location.hash = h; await wait(sel); await sleep(800); };
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc } = await import('../js/sb.js');
    const me = await rpc('app_me');
    if (me.role === 'nv') {
      await go('#/cua-toi/cong', '.cg-k');
      r.push(`NV Công của tôi: ${txt('.cg-k')} · ${W()}`);
      out.push({ route: 'công của tôi', title: r.join(' || '), len: 0, errs: [...window.__ERR] }); return;
    }
    const day = '2026-11-04';   // tuần dữ liệu thử đã xếp lịch (để xem dấu trên Lịch tổng)
    const ov = await rpc('app_ca_overview', { p_date: day });
    const id = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[0].shift });
    const R = await rpc('app_ca_get', { p_id: id });
    const emps = await rpc('app_ca_employees');
    const cashE = emps.find((e) => e.pay_cash); const inCa = new Set((R.staff || []).map((s) => s.employee_id));
    const helper = emps.find((e) => !e.pay_cash && !inCa.has(e.id) && e.id !== 3 && e.id !== 5);
    const staff = (R.staff || []).filter((s) => s.employee_id !== cashE.id && s.employee_id !== helper.id).map((s, i, arr) => { const off = i === arr.length - 1; return { ...s, worked: !off, time_in: off ? null : '06:45', time_out: off ? null : '12:30', absent_reason: off ? 'Báo nghỉ gấp' : null }; });
    staff.push({ employee_id: helper.id, source: 'ho_tro', worked: true, time_in: '06:30', time_out: '12:30' });
    staff.push({ employee_id: cashE.id, source: 'ho_tro', worked: true, time_in: '07:00', time_out: '11:00', cash_paid: 150000 });
    await rpc('app_ca_save', { p_id: id, p: { rev_end: day + ' 12:30', total_revenue: 2000000, pos_cash: 1200000, pos_transfer: 800000, reported_transfer: 800000, cash_counted: 2050000, opening_cash: 1000000, ipos_opening: 1000000, cups: 80, pos_debt: 0, pos_diff: -150000, diff_note: 'thử',
      moves: [], staff, handover: [], goods: [], debts: [] } });
    r.push(`Phiếu: ${staff.length} người (nghỉ: ${staff.filter((s) => !s.worked).length}, hỗ trợ 2, 1 trả tiền mặt ${cashE.code})`);
    // phiếu nhân viên: ô lương tiền mặt + tiền mặt tính cả chi lương
    await go('#/ca/phieu?id=' + id, '#pc-form');
    await wait('.st-cash', 300);
    r.push(`Phiếu NV: ô "Đã trả lương tiền mặt" ${$$('.st-cash').length} · giá trị ${$('.st-cash')?.value} · nhãn: ${$$('.st-row .pill.info').length} · ô tiền mặt: ${txt('#diff-box .diff-card')}`);
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    // đối soát ca: nhân sự đầu tiên + phân loại
    await go('#/quan-ly/doi-soat/ca?id=' + id + '&buoc=1', '#ds-cv .cv-a, #ds-cv h2');
    await wait('#ds-cv .cv-a', 300); await sleep(500);
    r.push(`Đối soát: bước đầu "${txt('.ds-pane[data-ds="0"] .ds-hd span')}" · bước 2 "${txt('.ds-pane[data-ds="1"] .ds-hd span')}" · ${txt('#ds-cv h2')} · nghỉ ${$$('#ds-cv .cv-a').length} · làm thêm ${$$('#ds-cv .cv-e').length}`);
    const a = $('#ds-cv .cv-a'); a.querySelector('.cv-reason').value = 'nho_ql';
    const hs = a.querySelector('.cv-helper'); hs.value = String(helper.id); hs.dispatchEvent(new Event('change', { bubbles: true })); await sleep(200);
    a.querySelector('.cv-x').checked = true;
    r.push(`chọn người làm thay → giờ ${a.querySelector('.cv-h').value} · làm thêm còn ${$$('#ds-cv .cv-e').length} (${txt('#ds-cv .cv-e strong')})`);
    $('#ds-cv #cv-ok').click(); await sleep(1500); await wait('#ds-cv h2'); for (let i = 0; i < 200 && !/duyệt/i.test(txt('#ds-cv h2 .pill')); i++) await sleep(100);
    r.push(`Chủ duyệt → ${txt('#ds-cv h2')} · ${txt('#ds-cv .cv-row')} · tóm tắt: ${txt('#ds-cv-sum')} · ${W()}`);
    // bảng công
    await go('#/quan-ly/bao-cao?tab=bang-cong&thang=' + day.slice(0, 7), '#bc-m');
    r.push(`Bảng công: ${$$('.table.rt').length} bảng · ${txt('.card-head h2')} · x2: ${$$('td[data-label="Giờ x2 được cộng"] strong').map((x) => x.innerText).join(',')} · trừ: ${$$('td[data-label="Giờ bị trừ"] strong').map((x) => x.innerText).join(',')} · tiền mặt: ${$$('td[data-label="Lương tiền mặt"]').map((x) => x.innerText).filter((x) => x !== '—').join(',')} · nghỉ&làm thay: ${$$('tr[data-id]').length} dòng · ${W()}`);
    $('.bc-fix')?.click(); await sleep(400); r.push(`Sửa / xem khiếu nại: ${$('dialog[open]') ? 'mở khung' : 'KHÔNG'}`); document.querySelectorAll('dialog').forEach((d) => { d.close(); d.remove(); });
    // lịch cơ sở + lịch tổng
    await go(`#/quan-ly/lich-co-so?tuan=${day}&cn=${R.branch_code || 'LHP'}`, '#grid .cell, #grid');
    await sleep(1500);
    r.push(`Lịch cơ sở: dấu ✓ ${$$('#grid .act.ok').length} · ✗ ${$$('#grid .act.no').length} · + ${$$('#grid .act.plus').length} · ${W()}`);
    await go(`#/quan-ly/lich-tong?tuan=${day}`, '#master');
    await sleep(800);
    r.push(`Lịch tổng: dấu ✓ ${$$('#master .act.ok').length} · ✗ ${$$('#master .act.no').length} · + ${$$('#master .act.plus').length}`);
    // nhân viên: dấu trả tiền mặt
    await go('#/quan-ly/nhan-vien?id=' + cashE.id, '#emp-form');
    r.push(`Hồ sơ: ô trả tiền mặt ${$('input[name=pay_cash]')?.checked ? 'đã tích' : 'CHƯA TÍCH'}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'nhân sự thực tế + x2', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
