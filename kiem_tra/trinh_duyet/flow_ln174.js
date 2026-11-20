// Bước 174 (21/11): Hàng hoá — bộ lọc ngày.
//  (1) Chọn khoảng ngày quá 400 ngày: trang KHÔNG kẹt ở ô báo lỗi — vẫn còn thanh lọc để chọn lại, khoảng đó không được nhớ.
//  (2) Loại ngày đã chọn không mất khi bấm qua mục Chưa nhận (chỉ có Ngày giao) rồi quay lại.
// Chạy: role=chu | qlt | kt, index.html và test/phone.html (390px).
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)]; const res = [];
  const wait = async (s, ms = 24000) => { for (let i = 0; i < ms / 100 && !$(s); i++) await sleep(100); if (!$(s)) throw new Error('Không thấy ' + s + ' ở ' + location.hash + ' — trang đang hiện: ' + ($('#root')?.textContent || '').trim().slice(0, 160)); };
  const go = async (h, s) => { location.hash = h; await sleep(300); await wait(s); await sleep(400); };
  const wide = () => { if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) throw new Error('Tràn ngang ở ' + location.hash + ' (' + document.documentElement.scrollWidth + 'px)'); };
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const kindNow = () => $('[data-loc-kind]')?.value || ($('.loc-k1')?.textContent || '');
  const saved = (k) => { try { return JSON.parse(localStorage.getItem('locNgay:' + k) || '{}'); } catch (_) { return {}; } };
  const tabLink = (sel, text) => $$(sel + ' a').find((a) => a.textContent.includes(text));
  try {
    await wait('#root');
    try { Object.keys(localStorage).filter((k) => k.startsWith('locNgay:')).forEach((k) => localStorage.removeItem(k)); } catch (_) { /* bỏ qua */ }
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const LONG = 'tu=2024-01-01&den=' + day;   // gần 3 năm

    // dùng chung: mở trang với khoảng quá dài → còn thanh lọc + lời nhắc; không nhớ; mở lại trang thì bình thường; bấm nút nhanh thì thoát
    const tooLong = async (name, base, key, listSel) => {
      await go(base + '&nhanh=7_ngay', '[data-loc]');
      const before = JSON.stringify(saved(key));
      await go(base + '&' + LONG, '[data-loc]');   // bản cũ: trang chỉ còn ô báo lỗi, không có [data-loc] → hỏng ở đây
      if (!$('#loc-qua-dai')) throw new Error(name + ': chọn quá 400 ngày mà không có lời nhắc');
      if (!/400 ngày/.test($('#loc-qua-dai').textContent)) throw new Error(name + ': lời nhắc không nói 400 ngày');
      if ($('[data-loc-from]').value !== '2024-01-01' || $('[data-loc-to]').value !== day) throw new Error(name + ': thanh lọc không hiện lại ngày vừa chọn');
      if (JSON.stringify(saved(key)) !== before) throw new Error(name + ': khoảng quá dài bị nhớ lại — ' + JSON.stringify(saved(key)));
      wide();
      // mở lại trang không kèm ngày → dùng lựa chọn cũ (7 ngày), không kẹt
      await go(base, '[data-loc]');
      if ($('#loc-qua-dai')) throw new Error(name + ': mở lại trang vẫn kẹt ở lời nhắc quá dài');
      if (!$('.loc-p.on') || $('.loc-p.on').dataset.nhanh !== '7_ngay') throw new Error(name + ': mở lại không về lựa chọn 7 ngày đã nhớ');
      if (listSel && !$(listSel)) throw new Error(name + ': mở lại không thấy danh sách (' + listSel + ')');
      // từ trang báo quá dài bấm nút nhanh → thoát
      await go(base + '&' + LONG, '#loc-qua-dai');
      $$('.loc-p').find((a) => a.dataset.nhanh === 'thang_nay').click(); await sleep(900); await wait('[data-loc]');
      if ($('#loc-qua-dai')) throw new Error(name + ': bấm Tháng này vẫn còn lời nhắc quá dài');
      // từ trang báo quá dài sửa ngày "từ" cho ngắn lại → thoát
      await go(base + '&' + LONG, '#loc-qua-dai');
      const f = $('[data-loc-from]'); f.value = day.slice(0, 8) + '01'; f.dispatchEvent(new Event('change', { bubbles: true })); await sleep(900); await wait('[data-loc]');
      if ($('#loc-qua-dai')) throw new Error(name + ': sửa ngày ngắn lại vẫn còn lời nhắc quá dài');
      // khoảng quá dài lỡ nhớ từ bản cũ (máy đang kẹt) → mở trang phải tự về Tháng này
      localStorage.setItem('locNgay:' + key, JSON.stringify({ kind: 'giao', from: '2024-01-01', to: day }));
      await go(base + '&_=' + Date.now(), '[data-loc]');
      if ($('#loc-qua-dai')) throw new Error(name + ': máy đã nhớ khoảng quá dài từ trước vẫn bị kẹt');
      if ($('[data-loc-from]').value !== day.slice(0, 8) + '01') throw new Error(name + ': khoảng quá dài đã nhớ không tự về Tháng này — ' + $('[data-loc-from]').value);
      res.push(name + ': quá 400 ngày không kẹt, không nhớ, thoát được');
    };

    await tooLong('Phiếu xuất', '#/hang-hoa/phieu-xuat?tt=', 'px', '#px-list');
    await tooLong('Kiểm soát', '#/hang-hoa/kiem-soat?cn=1', 'ks', '.ks-sec');
    if (role !== 'kt') {
      await tooLong('Đối soát › Đã xong', '#/hang-hoa/doi-soat?tt=xong', 'ds', '.gh-tabs');
      // Chờ đối soát không lọc ngày → đường dẫn mang khoảng quá dài vẫn hiện danh sách bình thường
      await go('#/hang-hoa/doi-soat?tt=cho&' + LONG, '#gh-all');
      if ($('#loc-qua-dai')) throw new Error('Chờ đối soát: không lọc ngày nên không được báo quá dài');
      res.push('Chờ đối soát: không bị ảnh hưởng');
    }

    // ---- (2) loại ngày không mất khi qua mục Chưa nhận
    localStorage.removeItem('locNgay:px');
    await go('#/hang-hoa/phieu-xuat?tt=&loai=ds&nhanh=thang_nay', '[data-loc-kind]');
    if (kindNow() !== 'ds') throw new Error('Phiếu xuất: không chọn được Ngày đối soát');
    tabLink('.px-tt', 'Chưa nhận').click(); await sleep(900); await wait('.loc-k1');
    if (!/Ngày giao/.test(kindNow())) throw new Error('Phiếu xuất › Chưa nhận: phải lọc theo Ngày giao — có ' + kindNow());
    // ở Chưa nhận bấm một nút nhanh (đổi khoảng ngày, không đổi loại)
    $$('.loc-p').find((a) => a.dataset.nhanh === '7_ngay').click(); await sleep(900); await wait('.loc-k1');
    tabLink('.px-tt', 'Mọi trạng thái').click(); await sleep(900); await wait('[data-loc-kind]');
    if (kindNow() !== 'ds') throw new Error('Phiếu xuất: qua Chưa nhận rồi quay lại thì mất loại ngày đã chọn — còn ' + kindNow());
    if (saved('px').kind !== 'ds') throw new Error('Phiếu xuất: loại ngày được nhớ bị đổi thành ' + saved('px').kind);
    if ($('.loc-p.on')?.dataset.nhanh !== '7_ngay') throw new Error('Phiếu xuất: khoảng ngày chọn ở Chưa nhận không được giữ');
    // tự tay đổi loại ở mục có ô chọn → theo loại mới
    const sel = $('[data-loc-kind]'); sel.value = 'nhan'; sel.dispatchEvent(new Event('change', { bubbles: true })); await sleep(900); await wait('[data-loc-kind]');
    if (kindNow() !== 'nhan' || saved('px').kind !== 'nhan') throw new Error('Phiếu xuất: tự đổi sang Ngày nhận không được nhớ');
    res.push('Phiếu xuất: loại ngày giữ nguyên khi qua Chưa nhận');
    wide();
    if (role !== 'kt') {
      localStorage.removeItem('locNgay:ds');
      await go('#/hang-hoa/doi-soat?tt=xong&loai=ds&nhanh=thang_nay', '[data-loc-kind]');
      tabLink('.gh-tabs', 'Chưa nhận').click(); await sleep(900); await wait('.loc-k1');
      $$('.loc-p').find((a) => a.dataset.nhanh === '7_ngay').click(); await sleep(900); await wait('.loc-k1');
      tabLink('.gh-tabs', 'Đã xong').click(); await sleep(900); await wait('[data-loc-kind]');
      if (kindNow() !== 'ds') throw new Error('Đối soát: qua Chưa nhận rồi về Đã xong thì mất loại ngày — còn ' + kindNow());
      res.push('Đối soát: loại ngày giữ nguyên khi qua Chưa nhận');
      wide();
    }
  } catch (e) { res.push('FAIL: ' + (e.stack || e)); }
  out.push({ route: 'lọc ngày Hàng hoá 174 (' + role + ')', title: res.join(' | '), errs: res.filter((x) => x.startsWith('FAIL:')) });
};
