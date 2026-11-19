// Bước 167: Hàng hoá — bộ lọc ngày (loại ngày + khoảng từ–đến + nút nhanh) ở Đối soát · Phiếu xuất · Kiểm soát.
// Chạy: role=chu | qlt | kt, index.html và test/phone.html (390px).
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)]; const res = [];
  const wait = async (s, ms = 24000) => { for (let i = 0; i < ms / 100 && !$(s); i++) await sleep(100); if (!$(s)) throw new Error('Không thấy ' + s + ' ở ' + location.hash); };
  const go = async (h, s) => { location.hash = h; await sleep(300); await wait(s); await sleep(400); };
  const wide = () => { if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) throw new Error('Tràn ngang ở ' + location.hash + ' (' + document.documentElement.scrollWidth + 'px)'); };
  const kinds = () => { const s = $('[data-loc-kind]'); return s ? [...s.options].map((o) => o.value).join(',') : ($('.loc-k1')?.textContent || ''); };
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  try {
    await wait('#root'); const { rpc, sb } = await import('../js/sb.js');
    try { Object.keys(localStorage).filter((k) => k.startsWith('locNgay:')).forEach((k) => localStorage.removeItem(k)); } catch (_) { /* bỏ qua */ }
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const add = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
    const ins = async (o) => { const r = await sb.from('delivery_invoices').insert({ branch_id: 1, kind: 'hoa_don', ...o }).select(); return (r.data && r.data[0]) || null; };
    // dữ liệu giả: A cũ (40 ngày trước, chờ đối soát) · B hôm nay · C 3 ngày trước · D đang chuyển · E đối soát xong hôm qua
    await ins({ doc_no: 'LN-A', work_date: add(day, -40), state: 'da_nhan', received_at: add(day, -38) + ' 09:00:00', received_date: add(day, -38), deliv_path: 'x/a.jpg' });
    await ins({ doc_no: 'LN-B', work_date: day, state: 'da_nhan', received_at: day + ' 09:00:00', received_date: day, deliv_path: 'x/b.jpg' });
    await ins({ doc_no: 'LN-C', work_date: add(day, -3), state: 'da_nhan', received_at: add(day, -2) + ' 09:00:00', received_date: add(day, -2), deliv_path: 'x/c.jpg' });
    await ins({ doc_no: 'LN-D', work_date: day, state: 'dang_chuyen' });
    const E = await ins({ doc_no: 'LN-E', work_date: add(day, -5), state: 'da_nhan', received_at: add(day, -5) + ' 09:00:00', received_date: add(day, -5), recon_at: add(day, -1) + ' 15:00:00', deliv_path: 'x/e.jpg' });
    const all = await sb.from('delivery_invoices').select('*'); const eid = E?.id || (all.data || []).find((x) => x.doc_no === 'LN-E')?.id;
    await sb.from('delivery_followups').insert({ branch_id: 1, invoice_id: eid, kind: 'bu', name: 'Món LN thiếu', unit: 'Cái', qty: 1, status: 'cho', created_at: add(day, -1) + ' 15:00:00' });
    const order = () => $$('.ql-t').map((x) => (x.textContent.match(/LN-[A-E]/) || [''])[0]).filter(Boolean).join(',');

    if (role !== 'kt') {
      // ---- Đối soát: Chờ đối soát — chỉ Ngày giao / Ngày nhận, cũ nhất trên, mục ngoài khoảng có "Hiện cả"
      await go('#/hang-hoa/doi-soat?cn=1&tt=cho&nhanh=7_ngay&loai=giao', '[data-loc]');
      if ($('.gh-mon')) throw new Error('Đối soát: vẫn còn nút chuyển tháng');
      if (kinds() !== 'giao,nhan') throw new Error('Chờ đối soát: loại ngày phải là Ngày giao, Ngày nhận — có ' + kinds());
      if (order() !== 'LN-C,LN-B') throw new Error('Chờ đối soát (7 ngày): phải C rồi B (cũ nhất trên) — có ' + order());
      if (!$('#gh-hidden') || !/Còn\s*1\s*lần giao/.test($('#gh-hidden').textContent)) throw new Error('Chờ đối soát: thiếu dòng báo 1 lần giao ngoài khoảng ngày');
      $('#gh-hidden a').click(); await sleep(900); await wait('[data-loc]');
      if (order() !== 'LN-A,LN-C,LN-B') throw new Error('Bấm Hiện cả: phải A,C,B — có ' + order());
      if ($('#gh-hidden')) throw new Error('Bấm Hiện cả xong vẫn còn dòng báo');
      res.push('Chờ đối soát: Ngày giao/Ngày nhận, cũ nhất trên, Hiện cả');
      wide();
      // Ngày nhận + Hôm nay → chỉ B
      await go('#/hang-hoa/doi-soat?cn=1&tt=cho&nhanh=hom_nay&loai=nhan', '[data-loc]');
      if (order() !== 'LN-B') throw new Error('Ngày nhận hôm nay: phải chỉ B — có ' + order());
      // Chưa nhận: chỉ Ngày giao (không có ô chọn loại)
      await go('#/hang-hoa/doi-soat?cn=1&tt=dang', '[data-loc]');
      if ($('[data-loc-kind]') || !/Ngày giao/.test(kinds())) throw new Error('Chưa nhận: chỉ được có Ngày giao — có ' + kinds());
      if (!$$('.ql-t').some((x) => x.textContent.includes('LN-D'))) throw new Error('Chưa nhận: thiếu D (giao hôm nay, lọc Hôm nay đã nhớ)');
      // Đã xong: đủ 3 loại, Ngày đối soát 7 ngày → E
      await go('#/hang-hoa/doi-soat?cn=1&tt=xong&loai=ds&nhanh=7_ngay', '[data-loc]');
      if (kinds() !== 'giao,nhan,ds') throw new Error('Đã xong: phải đủ 3 loại ngày — có ' + kinds());
      if (!$$('.ql-t').some((x) => x.textContent.includes('LN-E'))) throw new Error('Đã xong (Ngày đối soát 7 ngày): thiếu E');
      await go('#/hang-hoa/doi-soat?cn=1&tt=xong&loai=ds&nhanh=hom_nay', '[data-loc]');
      if ($$('.ql-t').some((x) => x.textContent.includes('LN-E'))) throw new Error('Đã xong (Ngày đối soát hôm nay): không được có E (đối soát hôm qua)');
      res.push('Chưa nhận chỉ Ngày giao; Đã xong đủ 3 loại, lọc đúng');
      wide();
      // nhớ lựa chọn: bấm nút nhanh "Tháng trước" rồi mở lại trang không tham số
      $$('.loc-p').find((a) => a.dataset.nhanh === 'thang_truoc').click(); await sleep(900); await wait('[data-loc]');
      await go('#/hang-hoa/doi-soat?cn=1&tt=xong', '[data-loc]');
      if ($('.loc-p.on')?.dataset.nhanh !== 'thang_truoc' || $('[data-loc-kind]').value !== 'ds') throw new Error('Không nhớ lựa chọn (Tháng trước + Ngày đối soát)');
      // đổi ô ngày → đường dẫn có tu/den
      const f = $('[data-loc-from]'); $('[data-loc-to]').value = day; f.value = add(day, -10); f.dispatchEvent(new Event('change')); await sleep(900); await wait('[data-loc]');
      if (!location.hash.includes('tu=' + add(day, -10)) || !location.hash.includes('den=' + day)) throw new Error('Đổi ô Từ ngày không lọc lại: ' + location.hash);
      if ($('.loc-p.on')) throw new Error('Khoảng tự chọn mà vẫn sáng nút nhanh');
      res.push('Nhớ lựa chọn + ô từ–đến');
    }
    // ---- Phiếu xuất (kế toán / quản lý / chủ): Ngày nhận tháng này → B, C (không có D chưa nhận)
    await go('#/hang-hoa/phieu-xuat?cn=1&loai=nhan&nhanh=7_ngay', '[data-loc]');
    if ($('.px-mon')) throw new Error('Phiếu xuất: vẫn còn nút chuyển tháng');
    const docs = () => $$('.px-row').map((r) => r.dataset.doc).filter((x) => x.startsWith('ln-')).join(',');
    if (docs() !== 'ln-b,ln-c,ln-e') throw new Error('Phiếu xuất Ngày nhận 7 ngày: phải B,C,E (mới nhất trên) — có ' + docs());
    await go('#/hang-hoa/phieu-xuat?cn=1&tt=dang&loai=nhan&nhanh=7_ngay', '[data-loc]');
    if ($('[data-loc-kind]') || !/Ngày giao/.test(kinds())) throw new Error('Phiếu xuất › Chưa nhận: chỉ Ngày giao — có ' + kinds());
    if (docs() !== 'ln-d') throw new Error('Phiếu xuất › Chưa nhận: phải D — có ' + docs());
    await go('#/hang-hoa/phieu-xuat?cn=1&tt=cho&loai=ds&nhanh=7_ngay', '[data-loc]');
    if (kinds() !== 'giao,nhan') throw new Error('Phiếu xuất › Chờ đối soát: không được có Ngày đối soát — có ' + kinds());
    await go('#/hang-hoa/phieu-xuat?cn=1&tt=&loai=ds&nhanh=7_ngay', '[data-loc]');
    if (docs() !== 'ln-e') throw new Error('Phiếu xuất Ngày đối soát 7 ngày: phải E — có ' + docs());
    res.push('Phiếu xuất: lọc theo loại ngày, ẩn loại không áp dụng');
    wide();
    // ---- Kiểm soát: lọc chỉ danh sách; tiền tháng không đổi
    await go('#/hang-hoa/kiem-soat?cn=1&loai=giao&nhanh=thang_nay', '[data-loc]');
    if ($('.ks-mon')) throw new Error('Kiểm soát: vẫn còn nút chuyển tháng');
    const money1 = $('.ks-money')?.textContent || '';
    const hasItem = () => $$('.ks-row').some((r) => r.textContent.includes('Món LN thiếu'));
    if (!hasItem()) throw new Error('Kiểm soát (Ngày giao tháng này): thiếu món chờ giao bù của E');
    await go('#/hang-hoa/kiem-soat?cn=1&loai=giao&nhanh=hom_nay', '[data-loc]');
    if (hasItem()) throw new Error('Kiểm soát (Ngày giao hôm nay): không được có món của E (giao 5 ngày trước)');
    if (!$('#ks-hidden')) throw new Error('Kiểm soát: thiếu dòng báo mục chờ ngoài khoảng ngày');
    const money2 = $('.ks-money')?.textContent || '';
    if (money1 !== money2) throw new Error('Kiểm soát: tiền tháng đổi khi lọc ngày');
    if (money1 && !money1.includes('Tính cả tháng')) throw new Error('Kiểm soát: thiếu ghi chú tiền tính cả tháng');
    $('#ks-hidden a').click(); await sleep(900); await wait('[data-loc]');
    if (!hasItem()) throw new Error('Kiểm soát: bấm Hiện cả vẫn không thấy món của E');
    await go('#/hang-hoa/kiem-soat?cn=1&loai=ds&nhanh=hom_nay', '[data-loc]');
    if (hasItem()) throw new Error('Kiểm soát (Ngày đối soát hôm nay): không được có món của E (đối soát hôm qua)');
    // đường dẫn cũ ?thang= vẫn mở đúng tháng
    await go('#/hang-hoa/kiem-soat?cn=1&thang=' + day.slice(0, 7), '[data-loc]');
    if ($('[data-loc-from]').value !== day.slice(0, 7) + '-01') throw new Error('Đường dẫn cũ ?thang= không mở đúng tháng');
    res.push('Kiểm soát: lọc danh sách, tiền tháng giữ nguyên, Hiện cả, ?thang= cũ');
    wide();
  } catch (e) { res.push('FAIL: ' + (e.stack || e)); }
  out.push({ route: 'lọc ngày Hàng hoá 167 (' + role + ')', title: res.join(' | '), errs: res.filter((x) => x.startsWith('FAIL:')) });
};
