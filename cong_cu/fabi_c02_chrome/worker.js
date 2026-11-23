import { FABI, MILANO, STORES, previousDay, vnClock, vnDate, validDay, detailIdentity, isDetailUrl, queueRows } from './core.mjs';
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
  if (automatic) {
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
  s.run = { day, mode, app: app.id, fabi: fabi.id, status: 'running', phase: 'list', page: 1, pages: [], queue: [], index: 0,
    results: [], staged: [], failures: [], attempts: 0, started: Date.now(), message: `Đang lấy danh sách ca ngày ${vnDate(day)}…` };
  return await save(s, version);
  } finally { starting = false; }
}
async function step(s) {
  const r = s.run;
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
        if (s.run.attempts >= 3) s.run.status = 'error';
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
  }
  } finally { clockBusy = false; }
}
chrome.alarms.onAlarm.addListener((a) => { (a.name === 'c02-step' ? drive() : clock()).catch(console.error); });
// Nạp bản mới: lượt cũ đang báo lỗi thì đổi thành "đã dừng" kèm câu nhắc, để không tưởng bản mới vẫn hỏng.
// Lượt đang chạy để bản mới chạy tiếp; không tự mở lượt mới.
async function afterUpdate() {
  const s = await read();
  if (s.run?.status !== 'error') return;
  s.run.status = 'stopped';
  s.run.message = `Đã nạp bản ${chrome.runtime.getManifest().version}. Lỗi của bản cũ đã xoá — chọn ngày rồi bấm 1. Kiểm tra tải.`;
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
      if (m.value && !(s.run?.status === 'success' && s.run.mode === 'upload')) throw Error('Cần đồng bộ thật thành công một lượt trước khi bật lịch.');
      s.enabled = !!m.value; await save(s); await alarmSetup();
    } else if (m.type === 'stop') {
      if (s.run?.status === 'running') s.run.stopRequested = true;
      s.enabled = false; await save(s);
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
  if (sender.id !== chrome.runtime.id || sender.tab || !['state', 'preview', 'upload', 'enable', 'stop'].includes(m.type)) return;
  control(m).then((state) => reply({ state }), (e) => reply({ error: e.message }));
  return true;
});
installWebBridge({ chrome, read, control, authorize: async (sender) => {
  const target = sender.documentId ? { tabId: sender.tab.id, documentIds: [sender.documentId] } : { tabId: sender.tab.id, frameIds: [0] };
  const result = await chrome.scripting.executeScript({ target, world: 'MAIN', func: milanoPage, args: ['authorize', {}] });
  return result.length === 1 && result[0].result?.allowed === true;
} });
alarmSetup().catch(console.error);
