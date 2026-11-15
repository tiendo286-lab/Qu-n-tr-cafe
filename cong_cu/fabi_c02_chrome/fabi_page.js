// Chỉ dùng DOM hiển thị. Không đọc cookie, localStorage hay API nội bộ Fabi.
export async function fabiPage(command, args = {}) {
  try {
  const clean = (x) => String(x || '').replace(/\s+/g, ' ').trim();
  const visible = (el) => !!el.getClientRects().length;
  const pause = () => new Promise((r) => setTimeout(r, 250));
  const wait = async (fn, message, ms = 25000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const r = fn(); if (r) return r; await pause(); }
    throw Error(message);
  };
  const exact = (text) => [...document.querySelectorAll('button,a,li,span,div')]
    .filter(visible).filter((el) => clean(el.textContent) === text)
    .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0];
  const table = () => [...document.querySelectorAll('table')].find((t) => /Thời gian mở ca/.test(t.textContent) && /Mã ca/.test(t.textContent));
  if (location.hostname !== 'fabi.ipos.vn') throw Error('Không phải trang Fabi.');
  if (/login/.test(location.pathname)) throw Error('Fabi cần đăng nhập lại trên tab vừa mở.');

  if (command === 'list') {
    await wait(() => table(), 'Chưa mở được danh sách C02. Fabi có thể cần đăng nhập.');
    // Luôn yêu cầu chọn hết cơ sở; không tự đoán một bộ lọc thiếu cơ sở.
    await wait(() => /4\s*\/\s*4/.test(document.body.innerText), 'Phạm vi Fabi chưa đủ 4/4 cơ sở. Chọn tất cả cơ sở rồi chạy lại.');
    const date = [...document.querySelectorAll('div,span,button')].filter(visible)
      .filter((e) => /^\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}\/\d{2}\/\d{4}$/.test(clean(e.textContent)))
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0];
    if (!date) throw Error('Fabi đổi bộ lọc ngày; cần kiểm tra lại thao tác.');
    date.click();
    (await wait(() => exact('Hôm qua'), 'Không thấy lựa chọn Hôm qua.')).click();
    const vn = args.day.split('-').reverse().join('/');
    await wait(() => document.body.innerText.includes(`Báo cáo được tính từ ${vn} 00:00 - ${vn} 23:59`), 'Bộ lọc C02 chưa đúng trọn ngày hôm qua.');
    // Đợi truy vấn hoàn tất và kết quả ổn định, kể cả lúc trả về rỗng.
    let previous = ''; let since = Date.now();
    await wait(() => {
      const t = table(); if (!t) return false;
      const text = t.innerText;
      if (text !== previous) { previous = text; since = Date.now(); }
      return Date.now() - since > 1800 && (t.querySelectorAll('td').length || /Chưa có bản ghi/.test(document.body.innerText));
    }, 'Danh sách ca chưa tải xong.');
    if (args.page > 1) {
      const next = [...document.querySelectorAll('a[href]')].find((a) => visible(a) && new URL(a.href).pathname === location.pathname && new URL(a.href).searchParams.get('page') === String(args.page));
      if (!next) throw Error(`Không thấy trang ${args.page} của C02.`);
      next.click();
      await wait(() => new URL(location.href).searchParams.get('page') === String(args.page), 'Chưa chuyển được trang C02.');
      let prior = ''; let stable = Date.now();
      await wait(() => {
        const txt = table()?.innerText || '';
        if (txt !== prior) { prior = txt; stable = Date.now(); }
        return txt && Date.now() - stable > 1800;
      }, 'Chưa tải xong trang C02.');
    }
    const t = table(); const headers = [...t.querySelectorAll('th')].map((h) => clean(h.textContent));
    const col = (s) => { const i = headers.findIndex((h) => h.startsWith(s)); if (i < 0) throw Error(`C02 thiếu cột ${s}.`); return i; };
    const mi = col('Mã ca'), oi = col('Thời gian mở ca'), ci = col('Thời gian đóng'), di = col('Thiết bị mở ca');
    const rows = [...t.querySelectorAll('tr')].filter((r) => r.querySelector('td')).map((r) => {
      const c = [...r.querySelectorAll('td')].map((x) => clean(x.textContent));
      return { short: c[mi], open: c[oi], close: c[ci], device: c[di] };
    });
    const pageNumbers = [...document.querySelectorAll('a[href]')].filter((a) => new URL(a.href).pathname === location.pathname)
      .map((a) => Number(new URL(a.href).searchParams.get('page'))).filter(Number.isInteger).filter((p) => p > 0);
    return { page: args.page || 1, pages: Math.max(1, ...pageNumbers), rows };
  }
  if (command === 'open') {
    const row = [...(table()?.querySelectorAll('tr') || [])].find((r) => {
      const txt = clean(r.textContent); return txt.includes(args.short) && txt.includes(args.open) && txt.includes(args.device);
    });
    if (!row) throw Error('Không tìm thấy đúng ca trong trang C02.');
    const cell = [...row.querySelectorAll('td')].find((c) => clean(c.textContent) === args.short);
    cell.click();
    await wait(() => location.pathname.endsWith('/shift-detail'), 'Bấm mã ca nhưng chưa mở được chi tiết.');
    await wait(() => document.body.innerText.includes('Tổng số hoá đơn'), 'Chi tiết ca chưa tải xong.');
    return { url: location.href };
  }
  if (command === 'export') {
    if (!location.pathname.endsWith('/shift-detail')) throw Error('Chưa ở chi tiết ca.');
    await wait(() => document.body.innerText.includes(args.open) && document.body.innerText.includes(args.close), 'Giờ ca chi tiết không khớp danh sách.');
    const button = [...document.querySelectorAll('button')].find((b) => visible(b) && /Xuất báo cáo/.test(b.textContent));
    if (!button) throw Error('Không thấy nút xuất báo cáo chi tiết.');
    // Chụp Blob Excel do chính nút xuất của Fabi tạo ra, trước khi URL bị thu hồi.
    const original = URL.createObjectURL; let captured;
    URL.createObjectURL = function (blob) {
      if (blob instanceof Blob && (blob.type.includes('spreadsheet') || blob.type.includes('octet-stream') || blob.size > 1000)) captured = blob;
      return original.call(this, blob);
    };
    try {
      button.click();
      const blob = await wait(() => captured, 'Fabi chưa tạo file Excel theo cách tiện ích hỗ trợ; chưa nhập dữ liệu.', 25000);
      if (blob.size > 5 * 1024 * 1024) throw Error('File ca vượt giới hạn 5 MB.');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes[0] !== 80 || bytes[1] !== 75) throw Error('Tệp xuất ra không phải Excel XLSX.');
      let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { base64: btoa(binary) };
    } finally { URL.createObjectURL = original; }
  }
  throw Error('Thao tác Fabi không được hỗ trợ.');
  } catch (e) { return { pageError: String(e.message || e) }; }
}
