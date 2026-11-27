// Tệp 189: ảnh bản cam kết đã ký. Sau chuan_bi.sh <thư mục> --dao-tao-gia, index.html và test/phone.html:
//   role=kt&confirm=1 | chu&confirm=1 — trang Theo dõi đọc & cam kết: tải ảnh, xem, đổi trạng thái vẫn giữ ảnh, xoá ảnh (confirm=1: đồng ý hộp hỏi lại)
//   role=nvkt      — nhân viên kiêm kế toán: tải ảnh cho chính mình rồi xem ở trang Nội quy ("Bản cam kết của tôi")
//   role=nv        — nhân viên thường: có thẻ Bản cam kết của tôi, không tải được ảnh
import { rpc } from '../js/sb.js';
export default async ({ visit, sleep, out }) => {
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = new URLSearchParams(location.search).get('role') || 'kt';
  const q = (s, r = document) => r.querySelector(s);
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const fits = () => document.documentElement.scrollWidth <= innerWidth + 1;
  const waitFor = async (c) => { for (let i = 0; i < 50; i++) { if (c()) return true; await sleep(100); } return false; };
  const errOf = async (fn) => { try { await fn(); return ''; } catch (e) { return e.message || 'lỗi'; } };
  const png = async () => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; c.getContext('2d').fillRect(0, 0, 40, 30);
    const b = await new Promise((r) => c.toBlob(r, 'image/png')); return new File([b], 'cam-ket.png', { type: 'image/png' }); };
  const pick = async (input, file) => { const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); };
  const inView = (d) => { const r = d.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && d.scrollWidth <= d.clientWidth + 1; };
  try {
    if (role === 'nv') {
      const e = await errOf(() => rpc('app_tl_commit_photo', { p_employee: 1, p_path: '1/x.jpg' }));
      ok(/Chỉ Kế toán/.test(e), 'nhân viên thường gọi tải ảnh cam kết: bị chặn — ' + (e || 'KHÔNG chặn'));
      await visit('#/noi-quy'); await sleep(300);
      const m = q('#ck-mine');
      ok(!!m && /Bản cam kết của tôi/i.test(txt(m)) && !q('#ck-mine-xem'), 'trang Nội quy có thẻ Bản cam kết của tôi; chưa có ảnh thì không có nút xem');
      ok(fits(), 'trang Nội quy không tràn ngang');
    } else {
      await visit('#/theo-doi-noi-quy'); await sleep(300);
      const me = (await rpc('app_today_me').catch(() => null))?.employee_id || null;
      let card = role === 'nvkt' && me ? q(`.nqf-r[data-id="${me}"]`) : q('.nqf-r');
      const id = Number(card?.dataset.id);
      ok(!!card && /Chưa có ảnh/i.test(txt(card.querySelector('.ck-ph'))) && !!card.querySelector('.ck-tai') && !card.querySelector('.ck-xem'), 'mỗi nhân viên có dòng ảnh: "Chưa có ảnh" + nút ＋ Ảnh bản đã ký');
      window.__CK_CALLS = [];
      await pick(card.querySelector('.ck-file'), await png());
      const up = await waitFor(() => /Có ảnh bản đã ký/i.test(txt(q(`.nqf-r[data-id="${id}"] .ck-ph`))));
      card = q(`.nqf-r[data-id="${id}"]`);
      const call = (window.__CK_CALLS || [])[0];
      ok(up && call && call.p_employee === id && String(call.p_path).startsWith(id + '/') && /\.jpg$/.test(call.p_path), 'chọn ảnh → tải lên kho đúng thư mục nhân viên, lưu 1 lần — ' + JSON.stringify(call || null));
      ok(!!card.querySelector('.ck-xem') && !!card.querySelector('.ck-xoa') && /Đổi ảnh/i.test(txt(card.querySelector('.ck-tai'))), 'có ảnh rồi: nút Xem ảnh · Đổi ảnh · Xoá ảnh');
      card.querySelector('.ck-xem').click();
      const opened = await waitFor(() => !!q('dialog[open].ck-view img'));
      const dl = q('dialog[open].ck-view');
      ok(opened && inView(dl) && !!q('img', dl).getAttribute('src'), 'Xem ảnh: mở hộp có ảnh, nằm trọn trong khung');
      dl?.close(); await sleep(200);
      // đổi trạng thái vẫn giữ ảnh; thiếu ảnh vẫn đổi được
      const sel = card.querySelector('.nqf-ck'); sel.value = 'da_ky_nop'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => q(`.nqf-r[data-id="${id}"] .nqf-ck`)?.value === 'da_ky_nop' && !q(`.nqf-r[data-id="${id}"] .nqf-ck`).disabled); await sleep(200);
      ok(/Có ảnh bản đã ký/i.test(txt(q(`.nqf-r[data-id="${id}"] .ck-ph`))), 'đổi sang Đã ký và nộp: ảnh vẫn còn');
      if (role === 'nvkt') {
        await visit('#/noi-quy'); await sleep(300);
        ok(/Đã ký và nộp/i.test(txt(q('#ck-mine'))) && !!q('#ck-mine-xem'), 'nhân viên xem ở trang Nội quy: trạng thái Đã ký và nộp + nút Xem ảnh bản đã ký');
        q('#ck-mine-xem')?.click();
        ok(await waitFor(() => !!q('dialog[open].ck-view img')) && inView(q('dialog[open].ck-view')), 'nhân viên mở được ảnh của mình');
        q('dialog[open].ck-view')?.close(); await sleep(150);
        ok(fits(), 'trang Nội quy không tràn ngang');
      } else {
        const other = [...document.querySelectorAll('.nqf-r')].find((c) => Number(c.dataset.id) !== id);
        if (other) { const s2 = other.querySelector('.nqf-ck'); s2.value = 'da_ky_nop'; s2.dispatchEvent(new Event('change', { bubbles: true })); const oid = other.dataset.id;
          const done = await waitFor(() => q(`.nqf-r[data-id="${oid}"] .nqf-ck`)?.value === 'da_ky_nop' && !q(`.nqf-r[data-id="${oid}"] .nqf-ck`).disabled);
          ok(done && /Chưa có ảnh/i.test(txt(q(`.nqf-r[data-id="${oid}"] .ck-ph`))), 'không có ảnh vẫn đổi được Đã ký và nộp (không bắt buộc)'); }
        q(`.nqf-r[data-id="${id}"] .ck-xoa`).click();   // hộp hỏi lại được bộ chạy tự đồng ý
        ok(await waitFor(() => /Chưa có ảnh/i.test(txt(q(`.nqf-r[data-id="${id}"] .ck-ph`)))), 'Xoá ảnh → về "Chưa có ảnh"');
        ok(q(`.nqf-r[data-id="${id}"] .nqf-ck`).value === 'da_ky_nop', 'xoá ảnh không đổi trạng thái cam kết');
        const e = await errOf(() => rpc('app_tl_commit_photo', { p_employee: id, p_path: (id + 1) + '/x.jpg' }));
        ok(/không đúng nhân viên/.test(e), 'ảnh để nhầm thư mục nhân viên khác: bị chặn');
        ok(fits(), 'trang Theo dõi đọc & cam kết không tràn ngang');
      }
    }
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.stack || e.message)); }
  out.push({ ck189: { ok: good, fail: bad } });
};
