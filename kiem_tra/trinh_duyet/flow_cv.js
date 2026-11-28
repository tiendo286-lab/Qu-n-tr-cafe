// Bước 39: đối soát Nhân sự trước · người trả lương tiền mặt (chi lương tự vào tiền mặt) · Quản lý tổng / Chủ phân loại nghỉ & làm thay, Chủ duyệt
// · bảng công tháng · dấu thực tế trên Lịch cơ sở / Lịch tổng · Công của tôi. role=chu (confirm=1); role=nv chỉ mở Công của tôi.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 900) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const W = () => { const w = document.documentElement.clientWidth; const wide = $$('#root *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > w + 1 && !el.closest('.table-wrap, .grid-wrap, .mtx-wrap, .hub-tabs')).map((el) => el.tagName + '.' + el.className).slice(0, 4); return `rộng ${w}/${document.documentElement.scrollWidth} · tràn: ${wide.join(', ') || 'không'}`; };
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
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos/flow-cv.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    sessionStorage.setItem('cm:' + id, JSON.stringify({ step: 1 }));
    await go('#/ca/phieu?id=' + id, '#cm-body');
    await wait('[data-cash]', 300);
    r.push(`Phiếu NV: ô "Đã trả lương tiền mặt" ${$$('[data-cash]').length} · giá trị ${$('[data-cash]')?.value} · nhãn: ${$$('.cm-person .pill.info').length}`);
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    // đối soát ca: nhân sự đầu tiên + phân loại
    await go('#/ca/doi-soat?id=' + id, '#dsm-cv .cv-a, #dsm-cv h2');
    await wait('#dsm-cv .cv-a', 300); await sleep(500);
    r.push(`Đối soát: thẻ đang mở "${txt('[data-dsm-tab][aria-selected="true"]')}" · ${txt('#dsm-cv h2')} · nghỉ ${$$('#dsm-cv .cv-a').length} · làm thêm ${$$('#dsm-cv .cv-e').length}`);
    const a = $('#dsm-cv .cv-a'); a.querySelector('.cv-reason').value = 'nho_ql';
    const hs = a.querySelector('.cv-helper'); hs.value = String(helper.id); hs.dispatchEvent(new Event('change', { bubbles: true })); await sleep(200);
    a.querySelector('.cv-x').checked = true;
    r.push(`chọn người làm thay → giờ ${a.querySelector('.cv-h').value} · làm thêm còn ${$$('#dsm-cv .cv-e').length} (${txt('#dsm-cv .cv-e strong')})`);
    $('#dsm-cv #cv-ok').click(); await sleep(1500); await wait('#dsm-cv h2'); for (let i = 0; i < 200 && !/duyệt/i.test(txt('#dsm-cv h2 .pill')); i++) await sleep(100);
    r.push(`Chủ duyệt → ${txt('#dsm-cv h2')} · ${txt('#dsm-cv .cv-row')} · tóm tắt: ${txt('#dsm-cv-sum')} · ${W()}`);
    // bảng công
    await go('#/quan-ly/bao-cao?tab=bang-cong&thang=' + day.slice(0, 7), '#bc-m');
    r.push(`Bảng công: ${$$('.table.rt').length} bảng · ${txt('.card-head h2')} · x2: ${$$('td[data-label="Giờ x2 được cộng"] strong').map((x) => x.innerText).join(',')} · trừ: ${$$('td[data-label="Giờ bị trừ"] strong').map((x) => x.innerText).join(',')} · tiền mặt: ${$$('td[data-label="Lương tiền mặt"]').map((x) => x.innerText).filter((x) => x !== '—').join(',')} · nghỉ&làm thay: ${$$('tr[data-id]').length} dòng · ${W()}`);
    $('.bc-fix')?.click(); await sleep(400); r.push(`Sửa / xem khiếu nại: ${$('dialog[open]') ? 'mở khung' : 'KHÔNG'}`); document.querySelectorAll('dialog').forEach((d) => { d.close(); d.remove(); });
    // lịch cơ sở + lịch tổng
    await go(`#/quan-ly/lich-co-so?tuan=${day}&cn=${R.branch_id}`, '#grid .cell, #grid');
    await sleep(1500);
    const dayBtn = $$('.m-day').find((b) => /\b04\b/.test(b.innerText));
    if (dayBtn) { dayBtn.click(); await sleep(300); }
    r.push(`Lịch cơ sở: dấu ✓ ${$$('#grid .act.ok').length} · ✗ ${$$('#grid .act.no').length} · + ${$$('#grid .act.plus').length} · ${W()}`);
    { const plus = $('#grid .act.plus'); const row = plus?.closest('tr, .m-shift'); const nx = row?.nextElementSibling; r.push(`dòng + nằm ở: ${row?.querySelector('.lab, .m-sh-h strong')?.innerText} · hàng sau: ${nx?.querySelector('.lab, .m-sh-h strong')?.innerText || '—'}`); }
    await go(`#/quan-ly/lich-tong?tuan=${day}`, '#master');
    await sleep(800);
    r.push(`Lịch tổng: dấu ✓ ${$$('#master .act.ok').length} · ✗ ${$$('#master .act.no').length} · + ${$$('#master .act.plus').length}`);
    // nhân viên: dấu trả tiền mặt
    await go('#/quan-ly/nhan-vien?id=' + cashE.id, '#emp-form');
    r.push(`Hồ sơ: ô trả tiền mặt ${$('input[name=pay_cash]')?.checked ? 'đã tích' : 'CHƯA TÍCH'}`);
    // 28/11 (anh Tiến chốt viết lại): đoạn đối soát chạy trên trang đối soát ca mới (#dsm-cv ở thẻ ① Phần việc); thêm ý kiểm tra thật —
    // trước đây bài chỉ in ra chữ, không ý nào làm bài báo LỖI.
    const all = r.join(' || '); const need = (re, m) => { if (!re.test(all)) window.__ERR.push('Không đạt: ' + m); };
    need(/ô "Đã trả lương tiền mặt" 1 · giá trị 150\.000/, 'phiếu chốt ca có ô Đã trả lương tiền mặt 150.000');
    need(/thẻ đang mở "① Phần việc/, 'trang đối soát ca mở ở thẻ ① Phần việc');
    need(/· nghỉ 1 · làm thêm 2 \|\|/, 'khối Nghỉ & làm thay: 1 người nghỉ, 2 người làm thêm');
    need(/chọn người làm thay → giờ [1-9][\d,]* · làm thêm còn 1 /, 'chọn người làm thay thì tự điền giờ, làm thêm còn 1');
    need(/Chủ duyệt → NGHỈ & LÀM THAY CHỦ ĐÃ DUYỆT/i, 'Chủ duyệt xong ghi "Chủ đã duyệt"');
    need(/Bảng công: [1-9]\d* bảng .*x2: \+[\d,]+ · trừ: −[\d,]+ · tiền mặt: 150\.000đ/, 'bảng công có giờ x2, giờ bị trừ và lương tiền mặt 150.000đ');
    need(/Sửa \/ xem khiếu nại: mở khung/, 'bảng công mở được khung sửa / xem khiếu nại');
    need(/Lịch cơ sở: dấu ✓ [1-9]\d* · ✗ 1 · \+ 1 /, 'Lịch cơ sở có dấu ✓ đã làm, 1 ✗ nghỉ, 1 + phát sinh');
    need(/Lịch tổng: dấu ✓ [1-9]\d* · ✗ 1 · \+ 1/, 'Lịch tổng có dấu ✓, ✗, +');
    need(/Hồ sơ: ô trả tiền mặt đã tích/, 'hồ sơ nhân viên đã tích trả lương tiền mặt');
    if (/tràn: [^k]/.test(all)) window.__ERR.push('Không đạt: có trang tràn ngang');
  } catch (e) { r.push('LỖI ' + e.stack); window.__ERR.push('Bài thử dừng giữa chừng: ' + (e.message || e)); }
  out.push({ route: 'nhân sự thực tế + x2', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
