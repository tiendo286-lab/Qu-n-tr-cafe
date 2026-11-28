// Tệp 193 — phiếu phạt tiền đi kèm lần trừ điểm / nhắc nhở (anh Tiến chốt 28/11/2026).
// Chạy: role=chu&confirm=1&script=flow_dg193 (index.html và test/phone.html); role=nv: trang Điểm đánh giá thấy tiền phạt.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim();
  const ok = [], fail = [];
  const chk = (name, cond, got) => (cond ? ok : fail).push(cond ? name : `${name} — thấy: ${got}`);
  const wide = () => { const w = document.documentElement.clientWidth; return $$('#root *, dialog *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > w + 1).map((el) => el.tagName + '.' + el.className).slice(0, 4); };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(200); location.hash = h; await wait(sel); await sleep(700); };
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc } = await import('../js/sb.js');
    if ((await rpc('app_me')).role === 'nv') {
      await go('#/cua-toi/danh-gia', '.dg-mk');
      chk('NV thấy tổng tiền phạt tháng', /30\.000đ/.test(txt($('#dg-my-fine'))), txt($('.dg-sum')));
      chk('NV thấy tiền phạt ở từng lần', $$('.dg-mk .pts').some((x) => /−2 điểm · phạt 30\.000đ/.test(txt(x))), $$('.dg-mk .pts').map(txt).join(' | '));
      chk('NV: không tràn ngang', !wide().length, wide().join(', '));
      out.push({ dg193_nv: { ok, fail } }); return;
    }
    const asked = []; const cf0 = window.confirm; window.confirm = (m) => { asked.push(String(m)); return cf0 ? cf0(m) !== false : true; };
    await go('#/quan-ly/danh-gia', '.dg-row');
    chk('Bảng điểm: dòng nhân viên hiện tiền phạt có sẵn', /30\.000đ/.test(txt($('.dg-row[data-emp="3"] .dg-fine'))), txt($('.dg-row[data-emp="3"]')));
    $('.dg-row[data-emp="3"] .dg-rb').click(); await wait('dialog.dg-dlg .dg-form'); await sleep(500);
    const d = $('dialog.dg-dlg'); const F = () => $('.dg-form', d);
    const card = (re) => $$('.dg-mk', d).find((c) => re.test(txt($('.pts', c))));
    const all = () => $$('.dg-mk .pts', d).map(txt).join(' | ');
    const sum = () => txt($('.dg-fsum', d));
    const add = async (pts, note, fine) => {
      const f = F(); f.crit.value = 'CB001'; $(`input[name=pts][value="${pts}"]`, f).checked = true; f.note.value = note;
      f.fine.value = fine; f.fine.dispatchEvent(new Event('input', { bubbles: true }));
      const shown = f.fine.value; f.requestSubmit(); await sleep(1300); return shown;
    };
    chk('Cửa sổ có ô Phạt tiền', !!F().fine, 'không có ô');
    chk('Đầu cửa sổ: tổng phạt tháng 30.000đ', /30\.000đ/.test(sum()), txt($('.dg-sum', d)));
    const shown = await add(2, 'Đi muộn 20 phút', '50000');
    chk('Gõ 50000 → ô tự thành 50.000', shown === '50.000', shown);
    chk('Trừ 2 điểm + phạt 50.000đ vào lịch sử', !!card(/−2 điểm · phạt 50\.000đ/), all());
    chk('Tổng phạt tháng lên 80.000đ', /80\.000đ/.test(sum()), sum());
    chk('Dưới 200.000đ không hỏi lại', asked.length === 0, asked.join(' | '));
    await add(0, 'Quên chào khách', '20000');
    chk('Nhắc nhở + phạt 20.000đ', !!card(/Nhắc nhở · phạt 20\.000đ/), all());
    const n0 = $$('.dg-mk', d).length; await add(1, 'Không phạt tiền', '');
    chk('Để trống ô phạt → chỉ trừ điểm', $$('.dg-mk', d).length === n0 + 1 && !!card(/^−1 điểm$/), all());
    chk('Tổng phạt tháng 100.000đ', /100\.000đ/.test(sum()), sum());
    // sửa: 50.000 → 300.000 (hỏi lại vì trên 200.000đ)
    $('.dg-edit', card(/phạt 50\.000đ/)).click(); await sleep(300);
    chk('Sửa: ô phạt điền sẵn 50.000', F().fine.value === '50.000', F().fine.value);
    F().fine.value = '300000'; F().fine.dispatchEvent(new Event('input', { bubbles: true })); F().requestSubmit(); await sleep(1300);
    chk('Trên 200.000đ có hỏi lại số tiền', asked.some((m) => /300\.000đ/.test(m)), asked.join(' | ') || 'không hỏi');
    chk('Sửa thành phạt 300.000đ', !!card(/−2 điểm · phạt 300\.000đ/), all());
    chk('Tổng phạt tháng 350.000đ', /350\.000đ/.test(sum()), sum());
    // quá 5.000.000đ: chặn
    { const f = F(); f.crit.value = 'CB001'; $('input[name=pts][value="1"]', f).checked = true; f.note.value = 'Thử quá mức'; f.fine.value = '6000000'; const n1 = $$('.dg-mk', d).length; f.requestSubmit(); await sleep(600);
      chk('Trên 5.000.000đ bị chặn', /5\.000\.000đ/.test(txt($('#dg-err', d))) && $$('.dg-mk', d).length === n1, txt($('#dg-err', d))); }
    // hoàn điểm = huỷ luôn tiền phạt
    const c3 = card(/phạt 300\.000đ/); const rb = $('.dg-refund', c3);
    chk('Nút hoàn ghi rõ huỷ phạt', /Hoàn điểm \+ huỷ phạt/i.test(txt(rb)), txt(rb));
    rb.click(); await sleep(1300);
    chk('Hoàn điểm → phiếu phạt ghi (đã huỷ)', !!card(/phạt 300\.000đ \(đã huỷ\)/), all());
    chk('Tổng phạt tháng còn 50.000đ', /(^|\D)50\.000đ/.test(sum()), sum());
    chk('Cửa sổ: không tràn ngang', !wide().length, wide().join(', '));
    $('.dg-x', d).click(); for (let i = 0; i < 100 && !/(^|\D)50\.000đ/.test(txt($('.dg-row[data-emp="3"] .dg-fine'))); i++) await sleep(100);
    chk('Đóng → bảng điểm cập nhật tiền phạt 50.000đ', /(^|\D)50\.000đ/.test(txt($('.dg-row[data-emp="3"] .dg-fine'))), txt($('.dg-row[data-emp="3"]')));
    chk('Bảng điểm có tổng tiền phạt tháng', /50\.000đ/.test(txt($('#dg-fine-sum'))), txt($('#dg-fine-sum')));
    chk('Bảng điểm: không tràn ngang', !wide().length, wide().join(', '));
    // trong trang đối soát ca: lập phiếu phạt ngay ở khối Đánh giá nhân viên trong ca
    try { await rpc('app__test_ca_staff', { p_id: 182, p_n: 2 }); } catch (_) { /* hook cũ */ }
    await go('#/ca/doi-soat?id=182', '#dsm-dg .dg-open');
    const ob = $('#dsm-dg .dg-open');
    chk('Trang đối soát ca có nút đánh giá từng người', !!ob, txt($('#dsm-dg')) || 'không thấy khối đánh giá');
    if (ob) {
      ob.click(); await wait('dialog.dg-dlg .dg-form'); await sleep(500);
      const d2 = $('dialog.dg-dlg'); let g = $('.dg-form', d2);
      if (g.set && !g.set.value) { g.set.value = 'cb'; g.set.dispatchEvent(new Event('change', { bubbles: true })); await sleep(700); g = $('.dg-form', d2); }
      g.crit.selectedIndex = 1; $('input[name=pts][value="2"]', g).checked = true; g.note.value = 'Làm vỡ ly';
      g.fine.value = '40000'; g.fine.dispatchEvent(new Event('input', { bubbles: true })); g.requestSubmit(); await sleep(1300);
      chk('Trong ca: ghi trừ 2 điểm + phạt 40.000đ', $$('.dg-mk .pts', d2).some((x) => /−2 điểm · phạt 40\.000đ/.test(txt(x))), $$('.dg-mk .pts', d2).map(txt).join(' | ') + ' ' + txt($('#dg-err', d2)));
      { const w = document.documentElement.clientWidth; const o = $$('dialog.dg-dlg *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > w + 1).map((el) => el.tagName + '.' + el.className).slice(0, 4);
        chk('Trong ca: cửa sổ không tràn ngang', !o.length, o.join(', ')); }
      $('.dg-x', d2).click(); for (let i = 0; i < 60 && !/phạt 40\.000đ/.test(txt($('#dsm-dg'))); i++) await sleep(100);
      chk('Trong ca: dòng nhân viên ghi "phạt 40.000đ"', /−2 điểm · phạt 40\.000đ/.test(txt($('#dsm-dg'))), txt($('#dsm-dg')).slice(0, 300));
      { const w = document.documentElement.clientWidth; const o = $$('#root *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > w + 1).map((el) => `${el.tagName}.${el.className} "${txt(el).slice(0, 30)}" href=${el.getAttribute('href')} trong ${el.parentElement?.tagName}.${el.parentElement?.className}`).slice(0, 4);
        chk('Trang đối soát ca: cả trang không cuộn ngang', document.documentElement.scrollWidth <= w + 1, `cuộn ${document.documentElement.scrollWidth}/${w} · ${o.join(' ; ')}`);
        if (o.length) ok.push('ghi chú — phần tử nằm ngoài khung nhưng không làm cuộn ngang: ' + o.join(' ; ')); }
    }
  } catch (e) { fail.push('LỖI ' + e.stack); }
  out.push({ dg193: { ok, fail } });
};
