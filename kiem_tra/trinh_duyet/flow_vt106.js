// Bước 123: Việc tự thêm. Phần Bảng phân công (role=chu, confirm=1; index.html + test/phone.html): nhóm "Việc tự thêm", hộp + Thêm việc,
// cột Người kiểm tra chỉ hiện khi tick Có kiểm tra, ngày làm theo chu kỳ, lỗi thiếu người kiểm tra, lưu → dòng tóm tắt, xoá hỏi lại trong hộp.
// &pcview=1: xem như Quản lý tổng (không sửa). &phan=the: chỉ chạy phần thẻ việc (Việc của tôi / Quá hạn).
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(300); location.hash = h; await wait(sel, 1500); await sleep(900); };
  const dlg = () => $('dialog[open]');
  const vis = (el) => !!el && el.offsetParent !== null;
  const setv = (el, v) => { if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const tick = (el, on) => { if (el && el.checked !== on) el.click(); };
  const fails = [], seen = [];
  const check = (ok, label) => { (ok ? seen : fails).push((ok ? '✓ ' : '✗ ') + label); };
  const noScroll = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  const q = new URLSearchParams(location.search);
  window.confirm = () => { fails.push('✗ dùng confirm() của trình duyệt'); return true; };
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    $('#rm-close')?.click(); await sleep(200);   // hộp nhắc việc lúc mở app
    if (q.get('phan') !== 'the') {
      await go('#/cong-viec/phan-cong', '#pc-body');
      const body = $('#pc-body');
      if (q.get('pcview')) {
        check(/Việc tự thêm/i.test(txt(body)) && !$('#pv-add'), 'Quản lý tổng: thấy nhóm Việc tự thêm, không có nút + Thêm việc');
        throw new Error('__xong');
      }
      check(/Việc tự thêm/i.test(txt(body)) && !!$('#pv-add'), 'Có nhóm "Việc tự thêm" + nút "+ Thêm việc"');
      check(/Vệ sinh máy pha/.test(txt(body)), 'Có việc mẫu "Vệ sinh máy pha"');
      $('#pv-add').click(); await wait('dialog[open] #pv-name', 30); await sleep(200);
      let d = dlg();
      check(!!d && !vis($('.pv-row[data-i] .pv-ckc', d)), 'Hộp mới: chưa tick Có kiểm tra thì không có cột Người kiểm tra');
      tick($('#pv-check', d), true); await sleep(200);
      check(vis($('.pv-row[data-i] .pv-ckc', d)) && /Hạn kiểm tra/.test(txt(d)), 'Tick Có kiểm tra → hiện Người kiểm tra + Hạn kiểm tra');
      const rows = $$('.pv-row[data-i]', d); const lhp = rows[0];
      setv($('[data-k=cy]', lhp), 'thang'); await sleep(200);
      check([...$('[data-k=day]', d.querySelectorAll('.pv-row[data-i]')[0]).options].some((o) => o.textContent.trim() === 'Ngày 31'), 'Chu kỳ Hằng tháng → ô Ngày làm có "Ngày 31"');
      setv($('#pv-name', d), 'Lau kính');
      rows.slice(1).forEach((r) => tick($('[data-k=on]', r), false));
      const r0 = () => $$('.pv-row[data-i]', dlg())[0];
      setv($('[data-k=cy]', r0()), 'tuan'); await sleep(150); setv($('[data-k=day]', r0()), '2');
      $('[data-pick=acc]', r0()).click(); await sleep(150); tick($('.pv-pop input[value="3"]', r0()), true); await sleep(150);
      $('#pv-save', dlg()).click(); await sleep(700);
      check(/Chọn người kiểm tra cho LHP\./.test(txt($('.pc-err', dlg()))), 'Lưu thiếu người kiểm tra → "Chọn người kiểm tra cho LHP."');
      $('[data-pick=ckr]', r0()).click(); await sleep(150); tick($('.pv-pop[data-for=ckr] input[value="5"]', r0()), true); await sleep(150);
      $('#pv-save', dlg()).click(); await sleep(1200);
      const row = $$('[data-cjob]').find((e) => vis(e) && /Lau kính/.test(txt(e)));
      check(!dlg() && !!row && /Thứ Ba hằng tuần/.test(txt(row)) && /\+1 ngày/.test(txt(row)) && /50\.000đ/.test(txt(row)), 'Lưu → dòng "Lau kính" có "Thứ Ba hằng tuần · +1 ngày · 50.000đ" (' + txt(row).slice(0, 120) + ')');
      check(noScroll(), 'Bảng không tràn ngang');
      // xoá
      $$('[data-cjob] .pb-jn').find((e) => vis(e) && /Lau kính/.test(txt(e)))?.click(); await wait('dialog[open] #pv-del', 30); await sleep(200);
      check(noScroll(), 'Hộp sửa không tràn ngang');
      $('#pv-del', dlg()).click(); await sleep(200);
      check(vis($('#pv-del-yes', dlg())) && /Các lần đang mở sẽ bị huỷ/.test(txt(dlg())), 'Xoá → hỏi lại ngay trong hộp');
      $('#pv-del-yes', dlg()).click(); await sleep(1200);
      check(!dlg() && !$$('[data-cjob]').some((e) => /Lau kính/.test(txt(e))), 'Xoá việc → dòng biến mất');
    }
    // ---- Thẻ việc: Việc của tôi ----
    if (q.get('phan') !== 'bang') {
      const photo = async (inp) => {
        const c = document.createElement('canvas'); c.width = 40; c.height = 30; c.getContext('2d').fillRect(0, 0, 20, 20);
        const b = await new Promise((ok) => c.toBlob(ok, 'image/jpeg'));
        const dt = new DataTransfer(); dt.items.add(new File([b], 'a.jpg', { type: 'image/jpeg' })); inp.files = dt.files;
      };
      const card = (re) => $$('.pc-task').find((c) => vis(c) && re.test(txt(c)));
      const toastTxt = () => txt($('#pc-toast'));
      await go('#/viec', '#pc-body');
      const role = q.get('role');
      const a = card(/Vệ sinh máy pha · LHP/);
      check(!!a && /Tháo tay pha/.test(txt(a)) && /Bắt buộc chụp ảnh/i.test(txt(a)) && /Quá hạn sẽ bị phạt 20\.000đ/.test(txt(a)), 'Thẻ việc tự thêm: hướng dẫn + bắt buộc ảnh + phạt theo cơ sở 20.000đ');
      check(/Việc tự thêm|Vệ sinh máy pha/i.test(txt($('.pc-chips'))), 'Có hạng mục cho việc tự thêm');
      const ex = card(/Vệ sinh máy pha · ĐK/);
      check(!!ex && /Làm bổ sung/i.test(txt(ex)) && !/Quá hạn sẽ bị phạt/.test(txt(ex)), 'Thẻ "Làm bổ sung": không nhắc phạt');
      a.querySelector('[data-a=pc-done]').click(); await wait('dialog[open] #pc-ph', 30);
      $('[data-ok]', dlg()).click(); await sleep(600);
      check(/Cần ít nhất 1 ảnh mới báo xong được\./.test(txt($('.pc-err', dlg()))), 'Báo xong không ảnh → "Cần ít nhất 1 ảnh mới báo xong được."');
      await photo($('#pc-ph', dlg())); setv($('#pc-nt', dlg()), 'Đã ngâm và lau');
      $('[data-ok]', dlg()).click(); await sleep(1500);
      check(!dlg() && /Đã báo xong/.test(toastTxt()), 'Có ảnh → Đã báo xong (' + toastTxt() + ')');
      if (role === 'chu') {
        const c = card(/Vệ sinh máy pha · HS/);
        check(!!c && /Chờ kiểm tra/i.test(txt(c)) && /Đã lau/.test(txt(c)) && !!c.querySelector('[data-a=pc-photos]'), 'Thẻ chờ kiểm tra: ghi chú người làm + nút Xem ảnh');
        c.querySelector('[data-a=pc-redo]').click(); await wait('dialog[open] #pc-rw', 30);
        $('[data-ok]', dlg()).click(); await sleep(600);
        check(/Ghi lý do làm lại\./.test(txt($('.pc-err', dlg()))), 'Làm lại thiếu lý do → "Ghi lý do làm lại."');
        dlg().close(); await sleep(200);
        card(/Vệ sinh máy pha · HS/).querySelector('[data-a=pc-ok]').click(); await sleep(1500);
        check(/Đã Đạt/.test(toastTxt()) && !card(/Vệ sinh máy pha · HS/), 'Đạt → "Đã Đạt", thẻ đóng');
        await go('#/cong-viec/qua-han', '#pc-body');
        const amt = $$('[data-amt]').find((i) => vis(i) && /Vệ sinh máy pha/.test(txt(i.closest('.qh-row'))));
        check(!!amt && amt.value === '30.000', 'Quá hạn & phạt: mức gợi ý theo cơ sở 30.000 (' + (amt?.value || 'không thấy') + ')');
      }
      check(noScroll(), 'Việc của tôi / Quá hạn không tràn ngang');
    }
  } catch (er) { if (er.message !== '__xong') fails.push(er.message); }
  out.push({ route: 'vt106', title: seen.join(' · ').slice(0, 900), errs: fails });
};
