// Đánh giá nhân viên (trang riêng + khung trừ điểm + đối soát ca) · hướng dẫn sổ tay trong phiếu đào tạo · Quy trình từ file Word
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 900) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const W = () => { const w = document.documentElement.clientWidth; const wide = $$('#root *, dialog *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > w + 1).map((el) => el.tagName + '.' + el.className).slice(0, 4); return `rộng ${w}/${document.documentElement.scrollWidth} · tràn: ${wide.join(', ') || 'không'}`; };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(200); location.hash = h; await wait(sel); await sleep(700); };
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc } = await import('../js/sb.js');
    const nv = (await rpc('app_me')).role === 'nv';
    if (nv) {
      await go('#/cua-toi/danh-gia', '.dg-mk');
      r.push(`NV: ${txt('.dg-sum')} · ${$$('.dg-mk').length} lần · ô giải trình ${$$('.dg-reply').length} · ${W()}`);
      const box = $$('.dg-reply')[0]; box.open = true; box.querySelector('.dg-text').value = 'Em xin giải trình'; box.querySelector('.dg-send').click();
      await sleep(1500); await wait('.dg-mk');
      r.push(`gửi giải trình → ${$$('.dg-rep').length} dòng giải trình`);
      out.push({ route: 'đánh giá NV', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
      return;
    }
    // 1. trang Đánh giá
    await go('#/quan-ly/danh-gia', '.dg-row');
    r.push(`Trang Đánh giá: ${$$('.dg-row').length} người · KPI: ${$$('.dg-kpi .card').map((c) => c.innerText.replace(/\s+/g, ' ')).join(' | ')} · chờ xem: ${$$('.dg-keep').length} · ${txt('.alert')} · ${W()}`);
    $('.dg-keep').click(); await sleep(1500); await wait('.dg-row');
    r.push(`Giữ điểm → còn chờ ${$$('.dg-keep').length}`);
    // 1b. chọn bộ tiêu chí trên bảng (mỗi người 1 bộ)
    r.push(`Bộ tiêu chí: ô chọn ${$$('.dg-set').length} · chưa chọn ${$$('.dg-set.unset').length} · ${txt('#dg-unset')}`);
    const ss = $('.dg-set.unset'); const sid = Number(ss.dataset.emp); ss.value = 'pc'; ss.dispatchEvent(new Event('change')); await sleep(600);
    r.push(`chọn Pha chế cho NV ${sid} → ${(await rpc('app_dg_history', { p_employee: sid })).employee.set_code} · ${txt('#saved-indicator')}`);
    { const u = $('.dg-row.no-set'); u.querySelector('.dg-rb').click(); await wait('dialog.dg-dlg .dg-form'); await sleep(400); const dd = $('dialog.dg-dlg');
      const before = `tiêu chí ${$('.dg-form', dd).crit.disabled ? 'khóa' : 'mở'} (${txt('select[name=crit] option', dd)})`;
      const s2 = $('.dg-form', dd).set; s2.value = 'cb'; s2.dispatchEvent(new Event('change', { bubbles: true })); await sleep(800);
      r.push(`Khung người chưa có bộ: ${before} → chọn Chạy bàn → ${$('.dg-form', dd).crit.disabled ? 'khóa' : 'mở'}, ${$('.dg-form', dd).crit.options.length - 1} tiêu chí, lưu: ${(await rpc('app_dg_history', { p_employee: Number(u.dataset.emp) })).employee.set_saved}`);
      $('.dg-x', dd).click(); await sleep(300); $$('dialog').forEach((x) => x.remove()); await wait('.dg-row'); await sleep(800); }
    $('#dg-only-unset').click(); await sleep(200); r.push(`lọc chưa chọn → hiện ${$$('.dg-row').filter((x) => !x.hidden).length}`); $('#dg-only-unset').click();
    if ($('#dg-guess')) { $('#dg-guess').click(); for (let i = 0; i < 300 && $('#dg-unset'); i++) await sleep(100); await wait('.dg-row'); await sleep(500); r.push(`chọn theo gợi ý → còn chưa chọn ${$$('.dg-set.unset').length}`); }
    // 2. khung trừ điểm nhân viên 3
    $('.dg-row[data-emp="3"]').click(); await wait('dialog.dg-dlg .dg-mk'); await sleep(500);
    const d = $('dialog.dg-dlg');
    r.push(`Khung: ${txt('header strong', d)} · ${txt('.dg-sum', d)} · lịch sử ${$$('.dg-mk', d).length} · "${$$('.dg-nth', d).map((x) => x.innerText).join(', ')}"`);
    const f = $('.dg-form', d); f.crit.value = 'CB001'; f.crit.dispatchEvent(new Event('change', { bubbles: true })); await sleep(300);
    r.push(`chọn "Đi làm đúng giờ" → tô nổi ${$$('.dg-mk.same', d).length} lần cũ`);
    const f2 = $('.dg-form', d); $('input[name=pts][value="3"]', f2).checked = true; f2.note.value = 'Đi muộn 30 phút';
    f2.requestSubmit(); await sleep(1500);
    r.push(`ghi −3 → ${txt('.alert', d)} · ${txt('.dg-sum', d)} · lịch sử ${$$('.dg-mk', d).length}`);
    $('.dg-mk .dg-edit', d).click(); await sleep(300);
    r.push(`Sửa → form: ${txt('.dg-form strong', d)}`);
    $('.dg-cancel', d).click(); await sleep(200);
    const f3 = $('.dg-form', d); f3.requestSubmit(); await sleep(400); r.push(`thiếu mức → ${txt('#dg-err', d)}`);
    r.push(`khung điện thoại: ${W()}`);
    $('.dg-x', d).click(); for (let i = 0; i < 300 && !/95/.test(txt('.dg-row[data-emp="3"] .dg-pt')); i++) await sleep(100);
    r.push(`đóng → bảng: ${txt('.dg-row[data-emp="3"] .dg-pt')}`);
    // 3. đối soát ca: bước Nhân sự có phần đánh giá
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const id = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[0].shift });
    const R = await rpc('app_ca_get', { p_id: id });
    await rpc('app_ca_save', { p_id: id, p: { rev_end: day + ' 12:30', total_revenue: 2000000, pos_cash: 1200000, pos_transfer: 800000, reported_transfer: 800000, cash_counted: 2200000, opening_cash: 1000000, ipos_opening: 1000000, pos_debt: 0, pos_diff: 0, diff_note: null, cups: 80,
      moves: [], staff: (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:30' })), handover: [], goods: [], debts: [] } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    await go('#/quan-ly/doi-soat/ca?id=' + id + '&buoc=1', '#ds-dg .dg-open');
    r.push(`Đối soát ca: ${txt('#ds-dg h2')} · ${$$('#ds-dg .dg-open').length} người`);
    $('#ds-dg .dg-open').click(); await wait('dialog.dg-dlg .dg-form'); await sleep(400);
    const d2 = $('dialog.dg-dlg'); const g = $('.dg-form', d2);
    if (!g.set.value) { g.set.value = 'cb'; g.set.dispatchEvent(new Event('change', { bubbles: true })); await sleep(300); }
    const g2 = $('.dg-form', d2); g2.crit.selectedIndex = 1; $('input[name=pts][value="0"]', g2).checked = true; g2.note.value = 'Quên đeo tạp dề';
    r.push(`khung ca: ${txt('.dg-form .st-meta', d2)}`);
    g2.requestSubmit(); await sleep(1500);
    r.push(`nhắc nhở → ${txt('.alert', d2)}`);
    $('.dg-x', d2).click(); await sleep(1500);
    r.push(`ô ca sau khi ghi: ${txt('#ds-dg .pc-line .st-meta')}`);
    // 4. phiếu đào tạo: hướng dẫn
    await go('#/dao-tao/phieu?id=1', '.it-guide');
    r.push(`Phiếu đào tạo: ${$$('.it-guide').length} hạng mục có hướng dẫn / ${$$('.dt-item').length}`);
    $('.it-guide').click(); await wait('dialog.dt-guide .dg-body'); await sleep(500);
    const gd = $('dialog.dt-guide');
    r.push(`Hướng dẫn: ${txt('.dg-head', gd)} · ảnh ${$$('.doc img', gd).length} · link "${txt('.dg-full', gd)}" · ${W()}`);
    $$('.dg-go', gd)[1].click(); await sleep(600); r.push(`Sau › ${txt('.dg-head strong', gd)}`);
    $$('.dg-go', gd)[1].click(); await sleep(600); r.push(`Sau › ${txt('.dg-head strong', gd)} · ${$$('.dg-sec', gd).length} đoạn`);
    $$('.dg-go', gd)[0].click(); await sleep(600); r.push(`‹ Trước ${txt('.dg-head strong', gd)}`);
    $$('.dg-x', gd)[0].click(); await sleep(300); r.push(`đóng: ${$('dialog.dt-guide') ? 'CÒN MỞ' : 'ok'}`);
    // 5. Quy trình: bài từ file Word không có nút Sửa
    await go('#/quy-trinh', '.doc-card');
    const c = $$('.doc-card').find((x) => /SOP 01/.test(x.innerText));
    r.push(`Quy trình: ${$$('.doc-card').length} bài · bài sổ tay: ${c ? txt('.pill', c) : 'KHÔNG THẤY'} · nút Sửa: ${c && $('a[href*="soan"]', c) ? 'CÒN' : 'không'} · lưới ảnh: ${c ? getComputedStyle($('.doc p:has(img + img)', c)).display : '?'}`);
    c.open = true; await sleep(300); $('.doc img', c).click(); await sleep(300); r.push(`bấm ảnh → ${$('dialog.img-zoom') ? 'xem to' : 'KHÔNG'}`); $('dialog.img-zoom')?.close();
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'đánh giá + sổ tay', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
