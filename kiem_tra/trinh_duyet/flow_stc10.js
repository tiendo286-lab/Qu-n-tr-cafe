// Bài thử bước 157: Đối soát Fabi › phần A — danh sách nợ của ca ngay dưới ô Nợ bill (chưa xác nhận lẫn đã xác nhận).
// Chạy: index.html?auto=1&role=chu|qlt|ql&script=flow_stc10 và test/phone.html?... Kết quả: out[].stc10 = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wide = (m) => { if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `${m}: không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`); };
  const DS = '#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11';
  const open = async (id, b = 1) => { location.hash = DS + '&ds=' + id + '&b=' + b + '&t=' + Date.now(); await sleep(400); await wait('.stc-dsp'); await sleep(500); };   // bước 171: b = bước mở (1 Số máy Fabi, 2 Tiền thực nhận)
  const box = () => $('.stc-pa .stc-cadebt');
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    // 1. ca Chiều 18/11 (chưa xác nhận Fabi): đủ 3 khoản mới + 1 khách trả
    await open(182);
    const b = box(); const rows = b ? $$('.stc-cdr', b) : [];
    ok(!!b, '1. ca chưa xác nhận: phần A có danh sách nợ');
    ok(rows.length === 4, `1. 4 dòng (${rows.length})`);
    ok(rows.filter((r) => r.dataset.t === 'moi').length === 3 && rows.filter((r) => r.dataset.t === 'tra').length === 1, '1. 3 dòng nợ mới + 1 dòng khách trả');
    const t = txt(b);
    ok(t.includes('bàn 5') && t.includes('120.000'), '1. có Bàn 5 · 120.000');
    ok(t.includes('chú hùng') && t.includes('+200.000') && t.includes('ca tối 15/11'), '1. khách trả nợ cũ: Chú Hùng +200.000 · ca Tối 15/11');
    const lan = rows.find((r) => txt(r).includes('chị lan'));
    ok(!!lan && txt(lan).includes('đã trả · 18/11 ca tối · chuyển khoản'), '1. Chị Lan đã trả → "đã trả · 18/11 ca Tối · chuyển khoản"');
    ok(t.includes('hđ') && t.includes('tm') && t.includes('ck') && t.includes('trả'), '1. có nhãn HĐ / TM / CK / Trả');
    const nb = $$('.stc-pa .stc-c4').find((x) => x.dataset.k === 'no');
    ok(!!nb && !!(nb.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING), '1. danh sách nằm sau ô Nợ bill');
    wide('1. ca chưa xác nhận');
    // 2. ca Sáng 18/11 (đã xác nhận): vẫn có danh sách, trả một phần → còn nợ
    await open(181);
    const b2 = box();
    ok(!!b2 && !!$('.stc-pa .stc-fsum'), '2. ca đã xác nhận: vẫn có danh sách nợ');
    ok(!!b2 && txt(b2).includes('bàn 9') && txt(b2).includes('đã trả · 19/11 · quản lý thu · tiền mặt') && !txt(b2).includes('còn nợ'), '2. Bàn 9 quản lý thu ngoài ca → "đã trả · 19/11 · quản lý thu · tiền mặt"');
    wide('2. ca đã xác nhận');
    // 3. ca Tối 18/11: không nợ → không có khung
    await open(183);
    ok(!!$('.stc-pa') && !box(), '3. ca không nợ: không có khung nợ');
    // 4. bước 159: Thu nợ đưa thiếu → hỏi trước
    location.hash = '#/quan-ly/so-thu-chi?tab=thu&cn=1&thang=2026-11&cot=no&t=' + Date.now(); await sleep(500); await wait('[data-col-debt]'); await sleep(300);   // bước 164: Khách còn nợ hiện khi bấm ô Thu nợ
    const cb = $$('[data-col-debt]').find((b) => b.dataset.colDebt === 'd:501'); ok(!!cb, '4. Khách đang nợ: Anh Dũng có nút Thu nợ');
    if (cb) {
      cb.click(); await wait('dialog[open] [name=amount]', 40); await sleep(300);
      const dl = $('dialog[open]'); ok(txt(dl).includes('khách trả một lần, đủ cả khoản'), '4. hộp Thu nợ ghi "Khách trả một lần, đủ cả khoản"');
      const am = $('[name=amount]', dl); am.value = '50.000'; am.dispatchEvent(new Event('input', { bubbles: true }));
      const rs = $('[name=reason]', dl); if (rs) { rs.value = 'thử'; rs.dispatchEvent(new Event('input', { bubbles: true })); }
      (window.__LOG = window.__LOG || []).length = 0;
      $('button[type=submit]', dl).click(); await sleep(1000);
      ok((window.__LOG || []).some((l) => l[0] === 'confirm' && /đưa thiếu 40\.000/.test(l[1])), '4. đưa thiếu 40.000 → web hỏi trước khi ghi');
      $('dialog[open] [data-x]')?.click(); await sleep(200);
    }
    // 5. bước 160: Mở lại xác nhận Fabi không cần ghi lý do
    await open(181, 2);
    const rb = $('[data-dsreopen]'); ok(!!rb, '5. ca đã xác nhận có nút Mở lại xác nhận');
    if (rb) {
      rb.click(); await wait('dialog[open]', 40); await sleep(300);
      const dl = $('dialog[open]'); ok(txt(dl).includes('không bắt buộc'), '5. ô lý do ghi "không bắt buộc"');
      $('button[type=submit]', dl).click(); await sleep(1200);
      ok(!$('dialog[open]') && !$('[data-dsreopen]') && !!$('[data-dsclose]'), '5. bấm Lưu không ghi lý do → đã mở lại (có lại nút Xác nhận Fabi)');
      $('dialog[open] [data-x]')?.click();
    }
  } catch (e) { bad.push('LỖI: ' + e.message); }
  out.push({ stc10: { ok: good, fail: bad } });
};
