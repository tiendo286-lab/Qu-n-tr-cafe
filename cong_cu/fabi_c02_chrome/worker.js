import { FABI, MILANO, STORES, previousDay, vnClock, vnDate, validDay, monthDays, detailIdentity, isDetailUrl, queueRows } from './core.mjs';
import { fabiPage } from './fabi_page.js';
import { milanoPage } from './milano_page.js';
import { installWebBridge } from './web_bridge.mjs';

let busy = false, starting = false, clockBusy = false, stopVersion = 0;
const read = async () => (await chrome.storage.local.get('state')).state || { enabled: false, run: null, done: {} };
async function save(s, expectedStopVersion) {
  const old = (await chrome.storage.local.get('state')).state;
  if (expectedStopVersion != null && expectedStopVersion !== stopVersion) return false;
  if (s.run && old?.run?.started === s.run.started && old.run.stopRequested) {
    s.enabled = false; s.run.stopRequested = true; s.run.status = 'stopped';
    s.run.message = 'Đã dừng sau thao tác ca hiện tại; lịch tự động đã tắt.';
  }
  await chrome.storage.local.set({ state: s });
  await chrome.action.setBadgeText({ text: s.run?.status === 'running' ? '…' : s.run?.status === 'error' ? '!' : '' });
  return true;
}
async function alarmSetup() {
  if (!await chrome.alarms.get('c02-clock')) await chrome.alarms.create('c02-clock', { periodInMinutes: 15 });
}
async function execute(tabId, func, args) {
  // Fabi trì hoãn tải dữ liệu của tab nền. Đưa tab cần xử lý ra trước rồi mới chờ nội dung.
  await chrome.tabs.update(tabId, { active: true });
  const tab = await chrome.tabs.get(tabId);
  const expected = func === fabiPage ? 'https://fabi.ipos.vn/' : MILANO;
  if (!tab.url?.startsWith(expected)) throw Error('Tab tự động bị chuyển trang hoặc cần đăng nhập lại.');
  const r = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func, args });
  // Bấm mã ca làm Fabi tải trang mới, nên ngữ cảnh cũ có thể bị hủy trước khi trả kết quả.
  if (func === fabiPage && args[0] === 'open' && r[0]?.result == null) {
    const end = Date.now() + 25000;
    while (Date.now() < end) {
      const next = await chrome.tabs.get(tabId);
      if (next.status === 'complete' && isDetailUrl(next.url)) return { url: next.url };
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (r.length !== 1 || r[0].result == null) throw Error('Trang chưa trả kết quả kiểm tra.');
  if (r[0].result.pageError) throw Error(r[0].result.pageError);
  return r[0].result;
}
async function navigate(tabId, url) {
  await chrome.tabs.update(tabId, { url, active: true });
  const end = Date.now() + 25000;
  while (Date.now() < end) {
    if ((await chrome.tabs.get(tabId)).status === 'complete') return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error('Trang tải quá lâu; sẽ thử lại.');
}
const BAD_DAY = 'Ngày cần lấy không hợp lệ: chỉ lấy được từ hôm qua lùi lại tối đa 31 ngày.';
// day: ngày chọn ở cửa sổ tiện ích để lấy bù; không có thì là hôm qua. Lịch tự động luôn lấy hôm qua.
async function start(mode, { automatic = false, day: wanted } = {}) {
  if (starting) { if (automatic) return false; throw Error('Một lượt đang khởi tạo.'); }
  starting = true;
  const version = stopVersion;
  try {
  const s = await read();
  if (s.run?.status === 'running') { if (automatic) return false; throw Error('Một lượt đang chạy.'); }
  const day = automatic ? previousDay() : wanted ?? previousDay();
  if (!validDay(day)) throw Error(BAD_DAY);
  const now = vnClock();
  if (automatic && mode === 'audit') {
    // Lượt tự bù ca lỗi cả tháng: mỗi ngày một lần, sau lượt hôm qua.
    if (!s.enabled || now.minutes < 495 || s.lastAutoAudit === now.day) return false;
    s.lastAutoAudit = now.day;
  } else if (automatic) {
    if (!s.enabled || now.minutes < 495 || s.lastSuccess === day || s.lastAuto === now.day) return false;
    s.lastAuto = now.day;
  }
  const batch = (await chrome.storage.session.get('batch')).batch || {};
  const reuse = mode === 'upload' && s.run?.mode === 'preview' && s.run.status === 'success' && s.run.day === day &&
    s.run.staged?.length === s.run.queue.length && s.run.staged.every((x) => batch[x.id]);
  if (reuse) {
    s.run = { ...s.run, mode, phase: 'preflight', index: 0, results: [], status: 'running', attempts: 0,
      stopRequested: false, started: Date.now(), message: 'Kiểm tra lại bộ file đã tải trước khi đồng bộ…' };
    return await save(s, version);
  }
  await chrome.storage.session.set({ batch: {}, pending: null });
  const app = await chrome.tabs.create({ url: MILANO + '#/ke-toan/fabi', active: false });
  const fabi = await chrome.tabs.create({ url: FABI, active: false });
  if (mode === 'audit') {
    const month = monthDays();
    s.run = { mode, month, days: [], plan: {}, dayIdx: 0, day: month.at(-1), app: app.id, fabi: fabi.id, status: 'running', phase: 'scan', page: 1, pages: [], queue: [], index: 0,
      results: [], staged: [], failures: [], counts: { khop: 0, thieu: 0, khac: 0, loi: 0 }, skips: 0, attempts: 0, started: Date.now(),
      message: `Đang hỏi web các ca lỗi ${vnDate(month[0])} → ${vnDate(month.at(-1))}…` };
    return await save(s, version);
  }
  s.run = { day, mode, app: app.id, fabi: fabi.id, status: 'running', phase: 'list', page: 1, pages: [], queue: [], index: 0,
    results: [], staged: [], failures: [], attempts: 0, started: Date.now(), message: `Đang lấy danh sách ca ngày ${vnDate(day)}…` };
  return await save(s, version);
  } finally { starting = false; }
}
// Tab Fabi / Milano của lượt chạy bị đóng (anh lỡ tay, Chrome dọn tab…) thì mở lại tab mới, không kẹt "No tab with id".
async function ensureTabs(r) {
  for (const [key, url] of [['app', MILANO + '#/ke-toan/fabi'], ['fabi', FABI]]) {
    try { await chrome.tabs.get(r[key]); continue; } catch (_) { /* tab đã đóng */ }
    const t = await chrome.tabs.create({ url, active: false });
    r[key] = t.id;
    const end = Date.now() + 25000;
    while (Date.now() < end && (await chrome.tabs.get(t.id)).status !== 'complete') await new Promise((ok) => setTimeout(ok, 250));
  }
}
const STORE_SHORT = { 'Milano Coffee - Lê Hồng Phong': 'LHP', 'Milano Coffee - Đông Khê': 'ĐK', 'Milano Coffee - Hồ Sen': 'HS', 'Lela Cafe': 'LL' };
const sameCa = (maCa, short) => String(maCa).toUpperCase().endsWith(String(short).slice(1).toUpperCase());
const auditSummary = (r) => `${r.counts.khop} khớp · ${r.counts.thieu} thiếu đã nhập · ${r.counts.khac} khác Fabi chờ anh xem · ${r.counts.loi} lỗi`;
// Lượt "Kiểm tra & bù ca thiếu cả tháng": từng ngày → từng ca tải lại từ Fabi → so với file đang lưu trên web.
// Ca chưa có file thì nhập luôn; ca khác Fabi thì giữ file tạm, chờ anh xem rồi bấm nhập đè (có thể mở lại ca đã đối soát).
async function auditStep(s) {
  const r = s.run;
  if (r.phase === 'overwrite') {
    if (r.index >= r.pick.length) {
      r.status = 'success'; r.finished = Date.now(); r.phase = 'done';
      r.message = `Đã nhập đè ${r.pick.length} ca theo file Fabi. ${auditSummary(r)}.`; return;
    }
    const item = r.staged.find((x) => x.id === r.pick[r.index]);
    const batch = (await chrome.storage.session.get('batch')).batch || {};
    if (!item || !batch[item.id]) throw Error('File tạm không còn trong Chrome (Chrome đã khởi động lại?). Bấm 3. Kiểm tra lại.');
    const result = await execute(r.app, milanoPage, ['upload', { ...batch[item.id], expectedHash: item.hash }]);
    s.done[`${item.day}:${item.id}`] = { hash: item.hash, store: result.store, at: Date.now() };
    const res = r.results.find((x) => x.id === item.id && x.status === 'khac');
    if (res) { res.status = 'da_nhap_de'; res.server = result.status; }
    r.counts.khac--; item.done = true;
    r.index++; r.message = `Đã nhập đè ${r.index}/${r.pick.length} ca…`;
    return;
  }
  if (r.phase === 'scan') {
    // Bước 1: hỏi web (vài giây) — chỉ những ngày có phiếu ca chưa có file / file thiếu số mới phải mở Fabi.
    const w = await execute(r.app, milanoPage, ['suspects', { from: r.month[0], to: r.month.at(-1) }]);
    r.plan = w.days || {};
    r.days = r.month.filter((d) => r.plan[d]);
    r.phase = 'list'; r.dayIdx = 0; r.day = r.days[0] || r.day;
    const nMiss = r.days.reduce((n, d) => n + r.plan[d].missing, 0), nBroken = r.days.reduce((n, d) => n + r.plan[d].broken.length, 0);
    r.message = r.days.length ? `Web báo ${nMiss} phiếu ca chưa có file, ${nBroken} file thiếu số ở ${r.days.length} ngày. Đang lấy từ Fabi…` : '';
    return;
  }
  if (r.dayIdx >= r.days.length) {
    r.status = 'success'; r.finished = Date.now(); r.phase = 'done';
    r.message = r.days.length ? `Đã xử lý ${r.days.length} ngày có ca lỗi (${vnDate(r.month[0])} → ${vnDate(r.month.at(-1))}): ${auditSummary(r)}.`
      : `Web không có ca lỗi nào từ ${vnDate(r.month[0])} → ${vnDate(r.month.at(-1))} (không có phiếu ca thiếu file, không có file thiếu số).`;
    for (const [key, value] of Object.entries(s.done)) if (value.at < Date.now() - 45 * 86400000) delete s.done[key];
    return;
  }
  r.day = r.days[r.dayIdx];
  const useYesterday = r.day === previousDay(), dd = vnDate(r.day).slice(0, 5);
  if (r.phase === 'list') {
    await navigate(r.fabi, FABI);
    const p = await execute(r.fabi, fabiPage, ['list', { day: r.day, page: r.page, useYesterday }]);
    r.pages = r.pages.filter((x) => x.page !== p.page).concat(p);
    if (p.pages > 50) throw Error('Số trang C02 bất thường; cần kiểm tra bộ lọc ngày.');
    if (r.page < p.pages) { r.page++; return; }
    // Đọc đủ danh sách ngày (vẫn kiểm tổng số ca), rồi chỉ giữ ca web chưa có file + ca có file thiếu số.
    const plan = r.plan[r.day] || { missing: 0, saved: [], broken: [] }, full = queueRows(r.pages, r.day);
    r.queue = full.filter((q) => !plan.saved.some((m) => sameCa(m, q.short)) || plan.broken.some((m) => sameCa(m, q.short)));
    const absent = full.filter((q) => !plan.saved.some((m) => sameCa(m, q.short))).length;
    if (plan.missing > absent) r.failures.push({ day: r.day, note: `web còn ${plan.missing} phiếu ca chưa có file nhưng Fabi chỉ có ${absent} ca chưa có trên web — cần xem phiếu ca (nhầm ca / nhầm ngày?).` });
    r.pages = []; r.index = 0; r.phase = 'detail'; r.skips = 0;
    r.message = `Ngày ${dd} (${r.dayIdx + 1}/${r.days.length}): ${r.queue.length} ca cần tải lại…`;
  } else if (r.phase === 'detail') {
    if (r.index >= r.queue.length) {
      r.dayIdx++; r.phase = 'list'; r.page = 1; r.pages = []; r.queue = []; r.index = 0;
      return;
    }
    const q = r.queue[r.index];
    r.message = `Ngày ${dd} (${r.dayIdx + 1}/${r.days.length}): so ca ${r.index + 1}/${r.queue.length} ${q.short}… · ${auditSummary(r)}`;
    await navigate(r.fabi, FABI);
    await execute(r.fabi, fabiPage, ['list', { day: r.day, page: q.page, useYesterday }]);
    const opened = await execute(r.fabi, fabiPage, ['open', q]);
    const identity = detailIdentity(opened.url);
    if (!identity.id.endsWith(q.short.slice(1))) throw Error('Mã ca chi tiết khác mã đã chọn.');
    const file = await execute(r.fabi, fabiPage, ['export', q]);
    await chrome.storage.session.set({ pending: { ...file, id: identity.id, store: identity.store, day: r.day, open: q.open, close: q.close } });
    r.phase = 'check';
  } else if (r.phase === 'check') {
    const { pending } = await chrome.storage.session.get('pending');
    if (!pending) { r.phase = 'detail'; return; }
    const c = await execute(r.app, milanoPage, ['check', pending]);
    const base = { day: r.day, id: c.id, short: r.queue[r.index].short, store: STORE_SHORT[c.store] || c.store };
    if (c.state === 'thieu') {
      const up = await execute(r.app, milanoPage, ['upload', { ...pending, expectedHash: c.hash }]);
      s.done[`${r.day}:${c.id}`] = { hash: c.hash, store: up.store, at: Date.now() };
      r.results.push({ ...base, status: 'da_nhap', server: up.status }); r.counts.thieu++;
    } else if (c.state === 'khac') {
      const batch = (await chrome.storage.session.get('batch')).batch || {};
      batch[c.id] = pending; await chrome.storage.session.set({ batch });
      r.staged.push({ id: c.id, hash: c.hash, day: r.day });
      r.results.push({ ...base, status: 'khac', diff: [...(c.diff || [])] }); r.counts.khac++;
    } else {
      r.results.push({ ...base, status: 'khop' }); r.counts.khop++;
    }
    r.index++; r.phase = 'detail'; r.skips = 0;
    await save(s);
    await chrome.storage.session.remove('pending');
  }
}
// Một ngày / một ca lỗi 3 lần: ghi lại rồi làm tiếp phần sau. Lỗi liền 3 chỗ (hết phiên đăng nhập…) thì dừng hẳn.
async function auditSkip(r, e) {
  r.skips = (r.skips || 0) + 1; r.attempts = 0;
  if (r.phase === 'list') {
    r.failures.push({ day: r.day, note: 'không đọc được danh sách Fabi: ' + e.message });
    r.dayIdx++; r.page = 1; r.pages = []; r.queue = []; r.index = 0;
  } else {
    const q = r.queue[r.index] || {};
    r.results.push({ day: r.day, id: q.short, short: q.short, store: '', status: 'loi', note: e.message }); r.counts.loi++;
    r.index++; r.phase = 'detail';
    await chrome.storage.session.remove('pending');
  }
}
async function step(s) {
  const r = s.run;
  await ensureTabs(r);
  if (r.mode === 'audit') return auditStep(s);
  // Ngày giữ cố định suốt lượt. Đúng hôm qua thì bấm nút "Hôm qua" của Fabi, ngày khác thì bấm ngày trên lịch;
  // qua nửa đêm giữa lượt thì lần sau tự chuyển sang bấm lịch, trang Fabi vẫn phải ghi đúng ngày mới đọc.
  if (!validDay(r.day)) throw Error('Ngày của lượt này đã quá 31 ngày. Chạy lại.');
  const useYesterday = r.day === previousDay();
  if (r.phase === 'list') {
    await navigate(r.fabi, FABI);
    const p = await execute(r.fabi, fabiPage, ['list', { day: r.day, page: r.page, useYesterday }]);
    r.pages = r.pages.filter((x) => x.page !== p.page).concat(p);
    if (p.pages > 50) throw Error('Số trang C02 bất thường; cần kiểm tra bộ lọc ngày.');
    if (r.page < p.pages) { r.page++; return; }
    r.queue = queueRows(r.pages, r.day); r.pages = []; r.phase = 'detail';
    r.message = `Tìm thấy ${r.queue.length} ca. Đang tải từng ca…`;
  } else if (r.phase === 'detail') {
    if (r.index >= r.queue.length) { r.phase = 'preflight'; return; }
    const q = r.queue[r.index];
    r.message = `${r.mode === 'preview' ? 'Kiểm tra' : 'Đồng bộ'} ca ${r.index + 1}/${r.queue.length} ${q.short}…`;
    await navigate(r.fabi, FABI);
    await execute(r.fabi, fabiPage, ['list', { day: r.day, page: q.page, useYesterday }]);
    const opened = await execute(r.fabi, fabiPage, ['open', q]);
    const identity = detailIdentity(opened.url);
    if (!identity.id.endsWith(q.short.slice(1))) throw Error('Mã ca chi tiết khác mã đã chọn.');
    const file = await execute(r.fabi, fabiPage, ['export', q]);
    // File chỉ nằm trong RAM của phiên Chrome, không ghi vào cấu hình tiện ích.
    await chrome.storage.session.set({ pending: { ...file, id: identity.id, store: identity.store, day: r.day, open: q.open, close: q.close } });
    r.phase = 'prepare';
  } else if (r.phase === 'prepare') {
    const { pending } = await chrome.storage.session.get('pending');
    if (!pending) { r.phase = 'detail'; return; }
    const result = await execute(r.app, milanoPage, ['preview', pending]);
    if (r.staged.some((x) => x.id === result.id)) throw Error('Hai dòng danh sách trỏ cùng mã ca; cần kiểm tra lại.');
    const batch = (await chrome.storage.session.get('batch')).batch || {};
    batch[result.id] = pending;
    await chrome.storage.session.set({ batch });
    r.staged.push({ id: result.id, hash: result.hash, store: result.store });
    r.results.push({ id: result.id, status: 'preview', store: result.store });
    r.index++; r.phase = 'detail'; r.attempts = 0;
    // Lưu checkpoint trước khi xóa file RAM: worker khởi động lại vẫn tiếp tục được.
    await save(s);
    await chrome.storage.session.remove('pending');
  } else if (r.phase === 'preflight') {
    const stores = new Set(r.staged.map((x) => x.store));
    const batch = (await chrome.storage.session.get('batch')).batch || {};
    if (r.staged.length !== r.queue.length || new Set(r.staged.map((x) => x.id)).size !== r.queue.length ||
        STORES.some((name) => !stores.has(name)) || r.staged.some((x) => !STORES.includes(x.store) || !batch[x.id])) {
      throw Error('Chưa có bộ file đã kiểm tra đủ ca và cả 4 cơ sở; chưa nhập dữ liệu.');
    }
    if (r.mode === 'preview') r.phase = 'finish';
    else { r.phase = 'commit'; r.index = 0; r.results = []; }
  } else if (r.phase === 'commit') {
    if (r.index >= r.staged.length) { r.phase = 'finish'; return; }
    const item = r.staged[r.index];
    const batch = (await chrome.storage.session.get('batch')).batch || {};
    if (!batch[item.id]) throw Error('Bộ file tạm không còn trong Chrome; cần chạy Kiểm tra tải lại.');
    const key = `${r.day}:${item.id}`;
    const result = await execute(r.app, milanoPage, ['upload', { ...batch[item.id], expectedHash: item.hash, previousHash: s.done[key]?.hash }]);
    s.done[key] = { hash: item.hash, store: result.store, at: Date.now() };
    r.results.push({ id: result.id, status: result.status, store: result.store });
    r.index++;
    r.message = `Đã xác minh nhập ${r.index}/${r.staged.length} ca…`;
  } else if (r.phase === 'finish') {
    if (r.failures.length || r.results.length !== r.queue.length) throw Error('Còn ca chưa xử lý; chưa đánh dấu ngày hoàn tất.');
    const stores = new Set(r.results.map((x) => x.store));
    if (STORES.some((name) => !stores.has(name))) throw Error('Chưa xác nhận đủ báo cáo của cả 4 cơ sở. Xem lại phạm vi C02.');
    r.status = 'success'; r.finished = Date.now();
    r.message = `${r.mode === 'preview' ? 'Đã tải và kiểm tra' : 'Đã đồng bộ'} đủ ${r.results.length}/${r.queue.length} ca ngày ${vnDate(r.day)}.${r.mode === 'preview' ? ' Chưa nhập lên Milano.' : ''}`;
    if (r.mode !== 'preview') {
      // Lấy bù ngày cũ không lùi mốc ngày mới nhất (lịch tự động dựa vào mốc này).
      if (!s.lastSuccess || r.day > s.lastSuccess) s.lastSuccess = r.day;
      s.synced = { ...(s.synced || {}), [r.day]: { count: r.results.length, at: Date.now() } };
    }
    // Nhật ký không giữ dữ liệu tiền, thông tin khách hoặc thông tin đăng nhập.
    for (const [key, value] of Object.entries(s.done)) if (value.at < Date.now() - 45 * 86400000) delete s.done[key];
    for (const [key, value] of Object.entries(s.synced || {})) if (value.at < Date.now() - 45 * 86400000) delete s.synced[key];
  }
}
async function drive() {
  if (busy) return; busy = true;
  const started = Date.now();
  try {
    while (Date.now() - started < 150000) {
      const s = await read(); if (s.run?.status !== 'running') break;
      // Khi đang chờ báo thức thì không có ca đang xử lý: Dừng phải chặn ca kế tiếp.
      if (s.run.stopRequested) { await save(s); break; }
      try { await step(s); s.run.attempts = 0; await save(s); }
      catch (e) {
        const fresh = await read();
        // Không tiếp tục ghi checkpoint khi người dùng đã bấm dừng.
        if (fresh.run?.status !== 'running') break;
        s.run.attempts++;
        s.run.message = `Chưa hoàn tất: ${e.message}`;
        if (s.run.attempts >= 3) {
          if (s.run.mode === 'audit' && ['list', 'detail', 'check'].includes(s.run.phase) && (s.run.skips || 0) < 2) await auditSkip(s.run, e);
          else s.run.status = 'error';
        }
        await save(s); break;
      }
    }
  } finally {
    busy = false;
    if ((await read()).run?.status === 'running') await chrome.alarms.create('c02-step', { delayInMinutes: 0.5 });
  }
}
async function clock() {
  if (clockBusy) return;
  clockBusy = true;
  try {
  const s = await read();
  if (s.run?.status === 'running') return drive();
  // Chỉ tự chạy sau 08:15 giờ Việt Nam; tối đa một lượt mới trong ngày.
  if (s.enabled && vnClock().minutes >= 495 && s.lastSuccess !== previousDay() && s.lastAuto !== vnClock().day) {
    if (await start('upload', { automatic: true })) await drive();
  } else if (s.enabled && vnClock().minutes >= 495 && s.lastAutoAudit !== vnClock().day) {
    // Xong (hoặc đã thử) hôm qua thì tự chạy nút 3: hỏi web, chỉ tải ca lỗi; ca khác Fabi chờ anh xem (anh chọn 23/11).
    if (await start('audit', { automatic: true })) await drive();
  }
  } finally { clockBusy = false; }
}
chrome.alarms.onAlarm.addListener((a) => { (a.name === 'c02-step' ? drive() : clock()).catch(console.error); });
// Nạp bản mới: lượt cũ đang báo lỗi thì đổi thành "đã dừng" kèm câu nhắc, để không tưởng bản mới vẫn hỏng.
// Lượt dở (bản cũ khởi động) thì chạy tiếp ngay bằng bản mới, đếm lại số lần thử; không tự mở lượt mới.
async function afterUpdate() {
  const s = await read(), version = chrome.runtime.getManifest().version;
  if (s.run?.status === 'running') {
    s.run.attempts = 0; s.run.message = `Đã nạp bản ${version}, chạy tiếp lượt đang dở bằng bản mới…`;
    await save(s); return drive();
  }
  if (s.run?.status !== 'error') return;
  s.run.status = 'stopped';
  s.run.message = `Đã nạp bản ${version}. Lỗi của bản cũ đã xoá — chọn ngày rồi bấm 1. Kiểm tra tải.`;
  await save(s);
}
chrome.runtime.onInstalled.addListener((d) => {
  alarmSetup().catch(console.error);
  if (d?.reason === 'update') afterUpdate().catch(console.error);
});
chrome.runtime.onStartup.addListener(() => alarmSetup().then(clock).catch(console.error));
async function control(m) {
    if (m.type === 'state') return read();
    if (m.type === 'stop') stopVersion++;
    const s = await read();
    if (m.type === 'enable') {
      if (m.value && !s.lastSuccess && !(s.run?.status === 'success' && s.run.mode === 'upload')) throw Error('Cần đồng bộ thật thành công một lượt trước khi bật lịch.');
      s.enabled = !!m.value; await save(s); await alarmSetup();
    } else if (m.type === 'stop') {
      if (s.run?.status === 'running') s.run.stopRequested = true;
      s.enabled = false; await save(s);
      // Không có bước nào đang làm (đang chờ lần thử sau) thì dừng ngay, khỏi đợi báo thức.
      if (s.run?.status === 'running' && !busy && !starting) await drive();
    } else if (m.type === 'audit') {
      await start('audit'); drive().catch(console.error);
    } else if (m.type === 'overwrite') {
      // Nhập đè các ca anh đã xem và chọn trong lượt kiểm tra tháng vừa xong.
      const r = s.run, batch = (await chrome.storage.session.get('batch')).batch || {};
      const ids = Array.isArray(m.ids) ? [...new Set(m.ids)] : [];
      if (r?.mode !== 'audit' || r.status !== 'success' || !ids.length ||
          ids.some((id) => !r.staged.some((x) => x.id === id && !x.done) || !batch[id])) throw Error('Không còn file tạm của các ca này. Bấm 3. Kiểm tra lại.');
      r.pick = ids; r.index = 0; r.phase = 'overwrite'; r.status = 'running'; r.attempts = 0; r.stopRequested = false;
      r.message = `Đang nhập đè ${ids.length} ca…`;
      await save(s); drive().catch(console.error);
    } else if (m.type === 'upload') {
      // Đồng bộ đúng ngày của lượt Kiểm tra vừa thành công (hôm qua hoặc ngày lấy bù).
      if (!(s.run?.mode === 'preview' && s.run.status === 'success' && validDay(s.run.day))) throw Error('Cần kiểm tra đủ ca thành công trước khi đồng bộ thật.');
      await start('upload', { day: s.run.day }); drive().catch(console.error);
    } else {
      if (m.day != null && !validDay(m.day)) throw Error(BAD_DAY);
      await start('preview', { day: m.day ?? previousDay() }); drive().catch(console.error);
    }
    return read();
}
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (sender.id !== chrome.runtime.id || sender.tab || !['state', 'preview', 'upload', 'enable', 'stop', 'audit', 'overwrite'].includes(m.type)) return;
  control(m).then((state) => reply({ state }), (e) => reply({ error: e.message }));
  return true;
});
installWebBridge({ chrome, read, control, authorize: async (sender) => {
  const target = sender.documentId ? { tabId: sender.tab.id, documentIds: [sender.documentId] } : { tabId: sender.tab.id, frameIds: [0] };
  const result = await chrome.scripting.executeScript({ target, world: 'MAIN', func: milanoPage, args: ['authorize', {}] });
  return result.length === 1 && result[0].result?.allowed === true;
} });
alarmSetup().catch(console.error);
