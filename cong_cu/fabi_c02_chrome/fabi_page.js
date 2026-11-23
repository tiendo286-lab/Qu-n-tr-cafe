// Chỉ dùng DOM hiển thị. Không đọc cookie, localStorage hay API nội bộ Fabi.
// 0.3.0 (23/11/2026): Fabi đổi giao diện — ô ngày là ô nhập chữ, lịch 2 tháng có nút "Hôm qua",
// phân trang bằng nút số và dòng "Hiển thị a - b trên tổng số N". Thử trên trang giả: thu_dom/thu_dom.py.
export async function fabiPage(command, args = {}) {
  try {
  const clean = (x) => String(x || '').replace(/\s+/g, ' ').trim();
  const visible = (el) => !!el && !!el.getClientRects().length;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = async (fn, message, ms = 25000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const r = fn(); if (r) return r; await sleep(250); }
    throw Error(typeof message === 'function' ? message() : message);
  };
  const after = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); // b đứng sau a trên trang
  // Các mẩu chữ đang hiện (đi theo nút chữ: nhanh, và bắt được chữ do React tách thành nhiều mẩu).
  const texts = (root = document.body) => {
    const out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = clean(n.nodeValue), el = n.parentElement;
      if (t && el && !/^(SCRIPT|STYLE|OPTION|SELECT|TEXTAREA)$/.test(el.tagName) && visible(el)) out.push([el, t]);
    }
    return out;
  };
  const byText = (text, root) => texts(root).filter(([, t]) => t === text).map(([el]) => el);
  // Bấm như chuột thật (có trang chỉ nghe mousedown/pointerdown, không nghe click).
  const press = (el) => {
    el.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, composed: true, view: window, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    el.dispatchEvent(new PointerEvent('pointerdown', { ...o, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
    el.dispatchEvent(new MouseEvent('mousedown', o));
    el.focus?.({ preventScroll: true });
    el.dispatchEvent(new PointerEvent('pointerup', { ...o, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.dispatchEvent(new MouseEvent('click', o));
  };
  // Tên thẻ + lớp, gắn vào câu báo lỗi để sửa nhanh khi Fabi đổi giao diện; không chứa dữ liệu ca.
  const sig = (el) => el ? el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') : 'không có';
  const pageText = () => clean(document.body.innerText);
  const vn = String(args.day || '').split('-').reverse().join('/');
  const reportIs = () => pageText().includes(`Báo cáo được tính từ ${vn} 00:00 - ${vn} 23:59`);
  const reportNow = () => (pageText().match(/Báo cáo được tính từ ([0-9/: -]{0,45})/) || [])[1]?.trim() || 'không thấy dòng ngày';
  const info = () => { const m = pageText().match(/Hiển thị\s*(\d+)\s*-\s*(\d+)\s*trên tổng số\s*(\d+)/i); return m ? { from: +m[1], to: +m[2], total: +m[3] } : null; };
  // Bảng C02: tiêu đề có "Mã ca" và "Thời gian mở ca". Bảng có đầu cố định thì phần thân là <table> khác cùng khung.
  const grid = () => {
    const t = [...document.querySelectorAll('table')].find((x) => /Thời gian mở ca/.test(x.textContent) && /Mã ca/.test(x.textContent));
    if (!t) return null;
    const headers = [...t.querySelectorAll('th')].map((h) => clean(h.textContent));
    let box = t;
    for (let i = 0; i < 6 && box.parentElement && !box.querySelector('td'); i++) box = box.parentElement;
    // Bỏ dòng ẩn / dòng đo cột không có chữ, dòng "Không có dữ liệu" (một ô gộp).
    const rows = [...box.querySelectorAll('tr')].filter((r) => visible(r) && clean(r.textContent) && r.querySelectorAll('td').length >= Math.max(2, headers.length - 1));
    return { t, headers, rows };
  };
  const cols = (g) => {
    const col = (s) => { const i = g.headers.findIndex((h) => h.startsWith(s)); if (i < 0) throw Error(`C02 thiếu cột ${s}.`); return i; };
    return { mi: col('Mã ca'), oi: col('Thời gian mở ca'), ci: col('Thời gian đóng'), di: col('Thiết bị mở ca') };
  };
  const cells = (r) => [...r.querySelectorAll('td')].map((td) => clean(td.textContent));
  const readRows = (g, c) => g.rows.map((r) => { const x = cells(r); return { short: x[c.mi], open: x[c.oi], close: x[c.ci], device: x[c.di] }; });
  // Đợi bảng đứng yên 1,5 giây và mọi dòng thuộc đúng ngày cần lấy (bảng cũ còn hiện lúc Fabi đang tải thì chưa đọc).
  const settle = async (label) => {
    let prior = null, since = Date.now(), seen = { rows: 0, total: null };
    return wait(() => {
      const g = grid(); if (!g) return false;
      const c = cols(g), rows = readRows(g, c), n = info(), key = JSON.stringify([rows, n]);
      seen = { rows: rows.length, total: n?.total ?? null };
      if (key !== prior) { prior = key; since = Date.now(); return false; }
      if (Date.now() - since < 1500) return false;
      if (rows.length) return rows.every((r) => r.open.startsWith(vn)) && { g, c, rows };
      return (n ? n.total === 0 : /Chưa có bản ghi|Không có dữ liệu|Chưa có dữ liệu|Không tìm thấy/i.test(pageText())) && { g, c, rows };
    }, () => `${label} chưa tải xong hoặc chưa đúng ngày ${vn} (đang là: ${reportNow()}; đọc được ${seen.rows} dòng, Fabi báo ${seen.total ?? '?'} ca; bảng: ${sig(grid()?.t)}).`);
  };

  // ---- Chọn ngày ----
  const DATE = /^\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}\/\d{2}\/\d{4}$/;
  const dateBox = () => [...document.querySelectorAll('input')].find((e) => visible(e) && DATE.test(clean(e.value)))
    || [...document.querySelectorAll('div,span,button')].filter((e) => visible(e) && DATE.test(clean(e.textContent)))
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0];
  const preset = (name) => byText(name)[0];
  // Lưới tháng: vùng nhỏ nhất chứa 28–42 ô chỉ có một con số, ngoài ra chỉ có chữ ngắn (T2…CN).
  const calendars = () => {
    const nums = texts().filter(([, t]) => /^\d{1,2}$/.test(t)).map(([el]) => el);
    const count = new Map();
    for (const el of nums) for (let a = el.parentElement, k = 0; a && k < 6; a = a.parentElement, k++) count.set(a, (count.get(a) || 0) + 1);
    const inRange = (a) => count.get(a) >= 28 && count.get(a) <= 42;
    const groups = new Map();
    for (const el of nums) {
      let a = el.parentElement;
      for (let k = 0; a && k < 6 && !inRange(a); k++) a = a.parentElement;
      if (!a || !inRange(a)) continue;
      if (!groups.has(a)) groups.set(a, []);
      groups.get(a).push(el);
    }
    return [...groups].map(([box, list]) => ({ box, cells: list }))
      .filter((g) => g.cells.some((el) => clean(el.textContent) === '1'))
      .filter((g) => { const other = texts(g.box).filter(([, t]) => !/^\d{1,2}$/.test(t)); return other.length <= 10 && other.every(([, t]) => t.length <= 12); })
      .sort((x, y) => (after(x.box, y.box) ? -1 : 1));
  };
  // Nhãn "Tháng m" (năm có thể nằm cùng mẩu chữ, mẩu bên cạnh, hoặc trong ô chọn năm).
  const monthLabels = () => texts().map(([el, t]) => {
    const m = t.match(/^Tháng\s*(\d{1,2})(?:\s*(?:,|\/|-|năm)?\s*(\d{4}))?$/i);
    if (!m || +m[1] < 1 || +m[1] > 12) return null;
    let y = m[2] ? +m[2] : null;
    for (let a = el.parentElement, k = 0; !y && a && k < 3; a = a.parentElement, k++) {
      const pickedYear = [...a.querySelectorAll('select')].map((s) => clean(s.selectedOptions?.[0]?.textContent)).find((x) => /^\d{4}$/.test(x));
      const yt = pickedYear || (clean(a.textContent).match(/(20\d{2})(?!\d)/) || [])[1];
      if (yt) y = +yt;
    }
    return y ? { el, m: +m[1], y } : null;
  }).filter(Boolean);
  // Lưới có đúng là tháng m/y không: đủ số ngày của tháng, và (nếu lịch vẽ cả ngày tháng trước) ngày 1 rơi đúng thứ.
  const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const fits = (g, y, m) => {
    const t = g.cells.map((el) => clean(el.textContent)), first = t.indexOf('1');
    if (first < 0) return false;
    let n = 0; while (first + n < t.length && t[first + n] === String(n + 1)) n++;
    if (n !== daysIn(y, m)) return false;
    const wd = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 = CN
    return first === 0 || first === (wd + 6) % 7 || first === wd; // tuần bắt đầu T2 hoặc CN
  };
  // Tháng của từng lưới theo thứ tự: theo nhãn nếu nhãn khớp lưới, không thì tự nhận ra trong ±3 tháng quanh ngày cần lấy.
  const months = () => {
    const cals = calendars(), labels = monthLabels();
    if (cals.length && labels.length === cals.length && cals.every((g, i) => fits(g, labels[i].y, labels[i].m))) return cals.map((g, i) => ({ g, y: labels[i].y, m: labels[i].m }));
    const [ty, tm] = String(args.day).split('-').map(Number);
    const near = [-3, -2, -1, 0, 1, 2, 3].map((k) => { const d = new Date(Date.UTC(ty, tm - 1 + k, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; });
    return cals.map((g) => { const hit = near.filter((c) => fits(g, c.y, c.m)); return hit.length === 1 ? { g, ...hit[0] } : { g, y: null, m: null }; });
  };
  const dayCell = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    const dmy = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    const outside = (el) => /outside|disabled|other-month|muted|\bout\b|prev-month|next-month|not-current|\bold\b|\bnew\b/i.test(typeof el.className === 'string' ? el.className : '')
      || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled');
    // Cách 1: ô ngày có ghi sẵn ngày (title / data-day / data-date…), bỏ ô mờ của tháng bên cạnh.
    const tagged = [...document.querySelectorAll(`[data-day="${iso}"],[data-date="${iso}"],[data-value="${iso}"],td[title="${iso}"],[title="${dmy}"]`)]
      .filter((el) => visible(el) && ![el, ...el.querySelectorAll('*')].some(outside));
    if (tagged.length) {
      const el = tagged[0];
      return el.querySelector('button,[role=button]') || [...el.querySelectorAll('*')].filter((e) => clean(e.textContent) === String(d)).pop() || el;
    }
    // Cách 2: tìm lưới của đúng tháng (theo nhãn hoặc tự nhận ra), đếm từ ô "1" đầu tiên của lưới.
    const hit = months().find((x) => x.y === y && x.m === m);
    if (!hit) return null;
    const cs = hit.g.cells, first = cs.findIndex((el) => clean(el.textContent) === '1'), el = cs[first + d - 1];
    return el && clean(el.textContent) === String(d) ? el : null;
  };
  // Nút lùi / tiến tháng. Không dùng chữ "Tháng trước" (đó là nút chọn nhanh cả tháng trước).
  const navButton = (dir) => {
    const cals = calendars(), labels = monthLabels();
    if (!cals.length) return null;
    let root = cals[0].box;
    while (root.parentElement && !cals.every((c) => root.contains(c.box))) root = root.parentElement;
    for (let k = 0; k < 2 && root.parentElement; k++) root = root.parentElement;
    const inGrid = (el) => cals.some((c) => c.box.contains(el));
    const hint = (el) => `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${typeof el.className === 'string' ? el.className : ''}`;
    const glyph = dir < 0 ? /^[‹<❮←]$/ : /^[›>❯→]$/, word = dir < 0 ? /prev/i : /next/i;
    const hit = [...root.querySelectorAll('button,[role=button],a,span,i')].find((el) => visible(el) && !inGrid(el) &&
      (glyph.test(clean(el.textContent)) || (!clean(el.textContent) && word.test(hint(el)) && !/super|year/i.test(hint(el)))));
    if (hit) return hit;
    // Nút chỉ có hình: xét vị trí so với nhãn tháng đầu / cuối.
    if (!labels.length) return null;
    const icons = [...root.querySelectorAll('button,[role=button]')].filter((el) => visible(el) && !inGrid(el) && !clean(el.textContent));
    const before = icons.filter((el) => after(el, labels[0].el)), behind = icons.filter((el) => after(labels.at(-1).el, el));
    return dir < 0 ? (behind.length ? before.at(-1) : before[0]) : (behind.length ? behind[0] : before[1]);
  };
  const openPicker = async () => {
    const box = await wait(dateBox, 'Không thấy ô chọn ngày trên C02 (Fabi đổi giao diện).', 15000);
    for (const how of [press, (el) => el.click()]) {
      how(box);
      try { await wait(() => preset('Hôm qua') || calendars().length, '', 3000); return box; } catch (_) { /* thử cách bấm khác */ }
    }
    throw Error(`Bấm ô ngày nhưng không mở được bảng chọn ngày (ô ngày: ${sig(box)}).`);
  };
  const applyButton = () => [...document.querySelectorAll('button,[role=button]')]
    .find((el) => visible(el) && /^(Áp dụng|Xác nhận|Đồng ý|Chọn|OK|Lọc)$/i.test(clean(el.textContent)));
  const pickDay = async (box) => {
    const [y, m] = args.day.split('-').map(Number), want = y * 12 + m;
    for (let k = 0; k < 14; k++) {
      const cell = dayCell(args.day);
      if (cell) {
        // Lịch chọn khoảng: bấm ngày đầu rồi ngày cuối (cùng một ngày). Lịch vẽ lại sau mỗi lần bấm nên tìm lại ô.
        press(cell); await sleep(450);
        if (!reportIs()) { const again = dayCell(args.day); if (again) { press(again); await sleep(450); } }
        const ok = !reportIs() && applyButton(); if (ok) press(ok);
        return;
      }
      const ms = months().filter((x) => x.y);
      if (!ms.length) throw Error(`Không đọc được tháng trên bảng chọn ngày của Fabi (lưới ngày: ${calendars().length}, nhãn tháng: ${monthLabels().length}).`);
      const first = ms[0].y * 12 + ms[0].m, last = ms.at(-1).y * 12 + ms.at(-1).m;
      if (want >= first && want <= last) throw Error(`Lịch Fabi đang hiện tháng ${m}/${y} nhưng không bấm được ngày ${vn} (lưới ngày: ${calendars().length}, nhãn tháng: ${monthLabels().length}, ô ngày: ${sig(box)}).`);
      const nav = navButton(want < first ? -1 : 1);
      if (!nav) throw Error(`Không thấy nút ${want < first ? 'lùi' : 'tiến'} tháng trên lịch Fabi.`);
      press(nav); await sleep(450);
    }
    throw Error('Lùi lịch quá 14 lần vẫn chưa tới tháng cần lấy.');
  };
  const chooseDay = async () => {
    const box = await openPicker();
    const yesterday = args.useYesterday && preset('Hôm qua');
    if (yesterday) press(yesterday); else await pickDay(box);
    try { await wait(reportIs, '', 12000); return; } catch (_) { /* có lịch chỉ áp dụng khi đóng lại */ }
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    press(document.body);
    await wait(reportIs, () => `Bộ lọc C02 chưa đúng trọn ngày ${vn} (đang là: ${reportNow()}; ô ngày: ${clean(box.value ?? box.textContent) || 'trống'}).`, 10000);
  };

  // ---- Phân trang kiểu mới: nút số trang + dòng "Hiển thị a - b trên tổng số N" ----
  const pager = () => {
    for (const [el0] of texts().filter(([, t]) => /trên tổng số|Hiển thị/i.test(t))) {
      let label = el0;
      for (let k = 0; k < 4 && label.parentElement && !/Hiển thị\s*\d+\s*-\s*\d+\s*trên tổng số\s*\d+/i.test(clean(label.textContent)); k++) label = label.parentElement;
      if (!/Hiển thị\s*\d+\s*-\s*\d+\s*trên tổng số\s*\d+/i.test(clean(label.textContent))) continue;
      for (let box = label.parentElement, k = 0; box && k < 4; box = box.parentElement, k++) {
        const nums = texts(box).filter(([el, t]) => /^\d+$/.test(t) && !label.contains(el) && after(label, el)).map(([el]) => el);
        if (nums.length) return { box, label, nums };
      }
    }
    return null;
  };
  const pageButton = (p) => pager()?.nums.find((el) => clean(el.textContent) === String(p)) || null;
  const pageStep = (dir) => {
    const pg = pager(); if (!pg) return null;
    const all = [...pg.box.querySelectorAll('button,a,li,[role=button]')].filter((el) => visible(el) && after(pg.label, el));
    const hint = (el) => `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${typeof el.className === 'string' ? el.className : ''}`;
    const hit = all.find((el) => dir > 0 ? /^[›>❯→]$/.test(clean(el.textContent)) || (!clean(el.textContent) && /next/i.test(hint(el)))
      : /^[‹<❮←]$/.test(clean(el.textContent)) || (!clean(el.textContent) && /prev/i.test(hint(el))));
    if (hit) return hit;
    const icons = all.filter((el) => !clean(el.textContent));
    return dir > 0 ? icons.find((el) => after(pg.nums.at(-1), el)) : icons.filter((el) => after(el, pg.nums[0])).at(-1);
  };
  const toPage = async (p, per) => {
    const want = (p - 1) * per + 1;
    for (let k = 0; k < 60 && info()?.from !== want; k++) {
      const before = info()?.from;
      const btn = pageButton(p) || pageStep(before < want ? 1 : -1);
      if (!btn) throw Error(`Không thấy nút sang trang ${p} của C02 (khung trang: ${sig(pager()?.box)}).`);
      press(btn);
      await wait(() => info() && info().from !== before, `Bấm sang trang ${p} nhưng C02 chưa đổi trang.`, 15000);
    }
    if (info()?.from !== want) throw Error(`Chưa sang được trang ${p} của C02.`);
    return settle(`Trang ${p} của C02`);
  };

  if (location.hostname !== 'fabi.ipos.vn') throw Error('Không phải trang Fabi.');
  if (/login/.test(location.pathname)) throw Error('Fabi cần đăng nhập lại trên tab vừa mở.');

  if (command === 'list') {
    await wait(() => grid(), 'Chưa mở được danh sách C02. Fabi có thể cần đăng nhập.');
    // Luôn yêu cầu chọn hết cơ sở; không tự đoán một bộ lọc thiếu cơ sở.
    await wait(() => /4\s*\/\s*4/.test(document.body.innerText), 'Phạm vi Fabi chưa đủ 4/4 cơ sở. Chọn tất cả cơ sở rồi chạy lại.');
    if (!reportIs()) await chooseDay();
    let { rows } = await settle('Danh sách ca');
    const page = args.page || 1;
    let n = info();
    if (n) {
      if (n.total > 0 && n.from !== 1) { ({ rows } = await toPage(1, 1)); n = info(); }
      const per = Math.max(1, n.to - n.from + 1), pages = n.total ? Math.ceil(n.total / per) : 1;
      if (page > pages) throw Error(`C02 ngày ${vn} chỉ có ${pages} trang, không có trang ${page}.`);
      if (page > 1) { ({ rows } = await toPage(page, per)); n = info(); }
      return { page, pages, rows, total: n.total };
    }
    // Giao diện cũ: phân trang bằng liên kết ?page=N (không có dòng "trên tổng số").
    if (page > 1) {
      const next = [...document.querySelectorAll('a[href]')].find((a) => visible(a) && new URL(a.href).pathname === location.pathname && new URL(a.href).searchParams.get('page') === String(page));
      if (!next) throw Error(`Không thấy trang ${page} của C02.`);
      next.click();
      await wait(() => new URL(location.href).searchParams.get('page') === String(page), 'Chưa chuyển được trang C02.');
      ({ rows } = await settle(`Trang ${page} của C02`));
    }
    const pageNumbers = [...document.querySelectorAll('a[href]')].filter((a) => new URL(a.href).pathname === location.pathname)
      .map((a) => Number(new URL(a.href).searchParams.get('page'))).filter(Number.isInteger).filter((p) => p > 0);
    return { page, pages: Math.max(1, ...pageNumbers), rows };
  }
  if (command === 'open') {
    const g = grid(), c = g && cols(g);
    const row = g?.rows.find((r) => { const x = cells(r); return x[c.mi] === args.short && x[c.oi] === args.open && x[c.di] === args.device; });
    if (!row) throw Error('Không tìm thấy đúng ca trong trang C02.');
    const cell = row.querySelectorAll('td')[c.mi];
    // Bấm vào chính chữ mã ca (thường là liên kết bên trong ô).
    press(byText(args.short, cell).at(-1) || cell);
    await wait(() => location.pathname.endsWith('/shift-detail'), 'Bấm mã ca nhưng chưa mở được chi tiết.');
    await wait(() => /Tổng số h(oá|óa) đơn/i.test(document.body.innerText) || (document.body.innerText.includes(args.short) && /Thời gian mở ca/.test(document.body.innerText)), 'Chi tiết ca chưa tải xong.');
    return { url: location.href };
  }
  if (command === 'export') {
    if (!location.pathname.endsWith('/shift-detail')) throw Error('Chưa ở chi tiết ca.');
    await wait(() => document.body.innerText.includes(args.open) && document.body.innerText.includes(args.close), 'Giờ ca chi tiết không khớp danh sách.');
    const button = [...document.querySelectorAll('button,a,[role=button]')].find((b) => visible(b) && /Xuất báo cáo/.test(b.textContent));
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
