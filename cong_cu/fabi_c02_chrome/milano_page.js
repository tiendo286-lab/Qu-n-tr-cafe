// Chạy trong trang Milano, dùng đúng mô-đun ứng dụng và phiên đăng nhập của trang.
// Không trả về hoặc lưu khóa đăng nhập trong tiện ích.
export async function milanoPage(command, args) {
  try {
  const base = 'https://tiendo286-lab.github.io/Qu-n-tr-cafe/';
  if (!location.href.startsWith(base)) throw Error('Sai trang nhận dữ liệu Milano.');
  const { rpc } = await import(base + 'js/sb.js');
  if (command === 'authorize') {
    const me = await rpc('app_me');
    return { allowed: !!me?.perms?.ke_toan && !me.must_change };
  }
  const [{ parseDetail }, { xlsx }] = await Promise.all([
    import(base + 'js/pages/ke_toan_fabi.js'), import(base + 'js/excel.js'),
  ]);
  const X = await xlsx();
  const bytes = Uint8Array.from(atob(args.base64), (x) => x.charCodeAt(0));
  const book = X.read(bytes, { type: 'array' });
  const raw = X.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, raw: true, defval: null });
  const numeric = (v, label, integer = true) => {
    if (v == null || typeof v === 'boolean' || String(v).trim() === '' || !Number.isFinite(Number(v)) || (integer && !Number.isSafeInteger(Number(v))) || Number(v) < 0) throw Error(`Excel thiếu/sai số gốc: ${label}.`);
    return Number(v);
  };
  // Kiểm tra ô gốc trước khi parser hiện có có thể biến ô trống thành số 0.
  for (const label of ['Số dư đầu ca', 'Số dư cuối ca', 'Doanh thu (net)', 'Tổng số hoá đơn']) {
    const cell = raw.find((r) => String(r[0] ?? '').trim() === label);
    numeric(cell?.[1], label);
  }
  const sectionRows = (title, required = true) => {
    const i = raw.findIndex((r) => String(r[0] ?? '').trim() === title);
    if (i < 0) { if (required) throw Error(`Excel thiếu phần ${title}.`); return []; }
    const out = [];
    for (let j = i + 2; j < raw.length && raw[j]?.[0] != null && String(raw[j][0]).trim() !== ''; j++) out.push(raw[j]);
    return out;
  };
  for (const title of ['PHƯƠNG THỨC THANH TOÁN', 'THÔNG TIN TỜ TIỀN', 'MÓN', 'NHÓM MÓN']) {
    const rs = sectionRows(title);
    if (!rs.length) throw Error(`Excel rỗng phần ${title}; cần xem lại.`);
    for (const r of rs) {
      numeric(r[1], title + ': ' + r[0], title !== 'MÓN');
      if (title === 'MÓN' || title === 'THÔNG TIN TỜ TIỀN') numeric(r[2], title + ': tổng ' + r[0]);
      if (title === 'THÔNG TIN TỜ TIỀN') numeric(r[0], 'Mệnh giá');
    }
  }
  for (const title of ['PHIẾU THANH TOÁN NỢ', 'HOÁ ĐƠN SỬA/XOÁ']) {
    for (const r of sectionRows(title, false)) numeric(r[1], title + ': ' + r[0]);
  }
  const row = parseDetail(X, book);
  if (!row || row.ma_ca !== args.id) throw Error('Mã ca trong Excel không khớp ca vừa tải.');
  const toISO = (s) => { const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
  if (toISO(row.open) !== args.day || row.open !== args.open || row.close !== args.close) throw Error('Ngày/giờ trong Excel không khớp ca cần nhập.');
  if (!row.store || !row.close || !row.pay?.length || !row.bills?.length || !row.items?.length) throw Error('Excel thiếu dữ liệu chi tiết. Cần xem lại file.');
  const allowedStores = ['Milano Coffee - Lê Hồng Phong', 'Milano Coffee - Đông Khê', 'Milano Coffee - Hồ Sen', 'Lela Cafe'];
  if (!allowedStores.includes(row.store)) throw Error('Tên cơ sở trong file không thuộc 4 cơ sở đã cấu hình.');
  for (const k of ['dau', 'cuoi', 'net', 'hd', 'tong']) if (!Number.isFinite(row[k]) || row[k] < 0) throw Error(`Excel thiếu/sai số ${k}.`);
  if (row.pay.some((p) => !Number.isFinite(p.amount)) || row.pay.reduce((n, p) => n + p.amount, 0) !== row.net) throw Error('Tổng phương thức thanh toán khác doanh thu NET.');
  if (row.bills.some((b) => !Number.isFinite(b.tong) || !Number.isFinite(b.sl) || b.sl < 0 || b.menh_gia * b.sl !== b.tong)) throw Error('Thông tin tờ tiền không hợp lệ.');
  const canonical = (v) => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical(row))));
  const hash = [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
  const list = await rpc('app_fabi_list', { p_from: args.day, p_to: args.day });
  if (command === 'preview') return { id: row.ma_ca, store: row.store, hash, bills: row.bills.length, items: row.items.length };
  if (command !== 'upload' && command !== 'check') throw Error('Thao tác Milano không được hỗ trợ.');
  if (command === 'upload' && args.expectedHash !== hash) throw Error('Dữ liệu ca khác bản đã kiểm tra; cần tải lại.');
  const money = (name) => row.pay.filter((p) => name === 'ck' ? /chuyển khoản/i.test(p.name) : p.name.trim().toLowerCase() === (name === 'tm' ? 'tiền mặt' : 'nợ')).reduce((n, p) => n + p.amount, 0);
  const savedTime = (v) => typeof v === 'string' ? v.slice(0, 16).replace(' ', 'T') : '';
  const fileTime = (v) => `${toISO(v)}T${v.slice(11, 16)}`;
  // Các phần của file đang lưu trên web khác file Fabi vừa tải (rỗng = khớp). Danh sách máy chủ chưa trả món/nhóm món nên chưa so phần đó.
  const num = (v, x) => v != null && Number(v) === x;
  const diffSaved = (f) => [
    ['cơ sở', f.store === row.store], ['ngày', f.work_date === args.day],
    ['tiền đầu ca', num(f.dau, row.dau)], ['doanh thu', num(f.net, row.net)], ['tổng tiền', num(f.tong, row.tong)],
    ['tiền mặt', num(f.tm, money('tm'))], ['chuyển khoản', num(f.ck, money('ck'))], ['nợ', num(f.no, money('no'))],
    ['chênh lệch', num(f.chenh, row.tong - row.cuoi)],
    ['giờ mở', savedTime(f.open_at) === fileTime(row.open)], ['giờ đóng', savedTime(f.close_at) === fileTime(row.close)],
    ['trả nợ', JSON.stringify(canonical(f.tra_no)) === JSON.stringify(canonical(row.tra_no))],
    ['hoá đơn sửa', JSON.stringify(canonical(f.sua)) === JSON.stringify(canonical(row.sua))],
  ].filter(([, ok]) => !ok).map(([label]) => label);
  const sameSaved = (f) => !!f && !diffSaved(f).length;
  if (command === 'check') {
    const saved = list.files.find((f) => f.ma_ca === row.ma_ca);
    if (!saved) return { id: row.ma_ca, store: row.store, hash, state: 'thieu' };
    const diff = diffSaved(saved);
    return { id: row.ma_ca, store: row.store, hash, state: diff.length ? 'khac' : 'khop', diff };
  }
  if (args.previousHash === hash && sameSaved(list.files.find((f) => f.ma_ca === row.ma_ca))) return { id: row.ma_ca, store: row.store, hash, status: 'unchanged' };
  const result = await rpc('app_fabi_upload', { p_rows: [row] });
  if (result.length !== 1 || result[0].ma_ca !== row.ma_ca || result[0].status === 'chua_ro_co_so') throw Error('Máy chủ chưa xác nhận đúng cơ sở/ca đã nhập.');
  const check = await rpc('app_fabi_list', { p_from: args.day, p_to: args.day });
  const saved = check.files.find((f) => f.ma_ca === row.ma_ca);
  if (!sameSaved(saved)) throw Error('Đã gửi nhưng chưa xác minh được số lưu trên máy chủ.');
  return { id: row.ma_ca, store: row.store, hash, status: result[0].status };
  } catch (e) { return { pageError: String(e.message || e) }; }
}
