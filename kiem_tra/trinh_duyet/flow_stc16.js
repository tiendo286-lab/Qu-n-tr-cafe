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
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    const sb = (await import('/js/sb.js')).sb; await sb.rpc('app_stc_ds_undone', { p_report: 171 });
    // A. ô Ca giữ khi đổi Loại qua lại
    location.hash = SO + '&t=' + Date.now(); await wait('.stc-ch .stc-add'); await sleep(300); $('.stc-ch .stc-add').click(); await wait('.stc-addp [name=ca]', 60); await sleep(200);
    setv(el('date'), '2026-11-17'); await sleep(150); setv(el('ca'), '171'); await sleep(150);
    ok(el('ca').value === '171', 'A1. chọn ca Sáng 17/11');
    setv(el('kind'), 'no'); await sleep(150);
    ok(el('ca').value === '' && el('ca').disabled, 'A2. đổi sang Cho nợ: ô Ca về Ngoài ca và khoá (như cũ)');
    setv(el('kind'), 'chi'); await sleep(150);
    ok(el('ca').value === '171' && !el('ca').disabled, 'A3. đổi lại Khoản chi: ô Ca quay lại ca Sáng 17/11 đã chọn (không về Ngoài ca)');
    setv(el('kind'), 'lc'); await sleep(150); setv(el('kind'), 'chi'); await sleep(150);
    ok(el('ca').value === '171', 'A4. qua Luân chuyển quỹ rồi lại Khoản chi: vẫn giữ ca đã chọn');
    setv(el('ca'), ''); await sleep(100); setv(el('kind'), 'no'); await sleep(100); setv(el('kind'), 'chi'); await sleep(150);
    ok(el('ca').value === '', 'A5. tự chọn Ngoài ca rồi đổi Loại qua lại: vẫn Ngoài ca');
    wide('hộp thêm phiếu');
    $('[data-x]', P()).click(); await sleep(200);
    // B. "Còn thiếu" bấm được
    location.hash = '#/quan-ly/so-thu-chi?tab=tong&cn=1&thang=2026-10&t=' + Date.now(); await sleep(300); for (let i = 0; i < 80 && !document.querySelector('.stc-tabs'); i++) await sleep(100);   // 22/11: tab Đối soát Fabi đã bỏ → mở tab Tổng tháng 10 để tải lại số tháng 11
    location.hash = DS + '&ds=182&b=2&t=' + Date.now(); await sleep(400); await wait('.stc-dsp'); await sleep(500);
    const lk = [...document.querySelectorAll('.stc-dsp .stc-a-end button.stc-lk')].find((b) => txt(b).includes('ô đỏ'));
    ok(!!lk, 'B1. dòng "Còn thiếu" có nút bấm "còn ô đỏ ở ①"');
    if (lk) { lk.click(); await sleep(500); ok(!!$('.stc-dsp .stc-step[data-step="0"]') && !!$('.stc-dsp .stc-c4[data-k="no"]'), 'B2. bấm → nhảy về bước 1 (thấy ô Nợ bill cần xử lý)'); }
    wide('khung Xác nhận Fabi');
  } catch (e) { bad.push('LỖI CHẠY: ' + (e?.message || e)); }
  out.push({ stc16: { ok: good, fail: bad } });
};
