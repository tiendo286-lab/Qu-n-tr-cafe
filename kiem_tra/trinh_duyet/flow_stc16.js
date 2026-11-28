// Chặng 2 (21/11): 2 lỗi nhỏ của bản Đối soát 6 bước.
//  A. "+ Thêm phiếu": ô Ca đã chọn KHÔNG bị về "Ngoài ca" khi đổi Loại qua lại (Khoản chi → Cho nợ → Khoản chi).
//  B. Khung Xác nhận Fabi (bước 2): dòng "Còn thiếu" bấm được, nhảy tới chỗ cần làm (ô đỏ ở ① → bước 1).
// Chạy role chu / qlt / ql, index.html và test/phone.html. Dữ liệu giả: 17/11 Sáng 171 (Mở lại trước), ca 182 chưa xác nhận Fabi, ô Nợ bill đỏ.
// 22/11 (Đưa Đối soát Fabi về lại Chốt ca, anh Tiến duyệt): đường cũ ?tab=doi-soat&ds=&b=&t= tự chuyển sang trang đối soát ca (tab ② Phần tiền, giữ b= / t=); chỉ đổi cách tải lại sổ tháng.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s);
  const wait = async (sel, n = 120) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const wide = (m) => ok(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, m + ': không tràn ngang');
  const P = () => $('.stc-addp'); const el = (n) => $(`[name=${n}]`, P());
  const SO = '#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11';
  const DS = '#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11';
  const cu = (h) => { const q = new URLSearchParams(String(h).split('?')[1] || ''); const b = q.get('b') || '';   // đợt 4: mở thẳng trang cũ dự phòng
    return q.get('ds') ? '#/ca/doi-soat?id=' + q.get('ds') + '&tab=' + (b === '6' ? 'xong' : 'tien') + (b && b !== '6' ? '&b=' + b : '') + (q.get('t') ? '&t=' + q.get('t') : '') : h; };
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    const sb = (await import('/js/sb.js')).sb; await sb.rpc('app_stc_ds_undone', { p_report: 171 });
    // A. ô Ca giữ khi đổi Loại qua lại
    // chặng 6.3d (anh Tiến chọn 23/11): Sổ thu chi luôn ngoài ca — không có ô Ca ở mọi loại (phần A cũ "ô Ca giữ khi đổi Loại" bỏ)
    location.hash = SO + '&t=' + Date.now(); await wait('.stc-ch .stc-add'); await sleep(300); $('.stc-ch .stc-add').click(); await wait('.stc-addp', 60); await sleep(200);
    const caHid = () => { const l = el('ca')?.closest('label'); return !l || l.hidden; };
    ok(caHid(), 'A1. Sổ chi: không có ô Ca');
    for (const k of ['no', 'lc', 'chi']) { setv(el('kind'), k); await sleep(150); ok(caHid(), `A2. loại ${k}: vẫn không có ô Ca`); }
    wide('hộp thêm phiếu');
    $('[data-x]', P()).click(); await sleep(200);
    // B (dòng "Còn thiếu" của khung Xác nhận Fabi): bỏ 28/11 cùng trang đối soát cũ — trang mới ẩn khung này, việc còn thiếu ghi ở cuối bước ② (flow_dsm2 / dsm4 kiểm).
    wide('khung Xác nhận Fabi');
  } catch (e) { bad.push('LỖI CHẠY: ' + (e?.message || e)); }
  out.push({ stc16: { ok: good, fail: bad } });
};
