// Giao thức giới hạn cho trang File ca Fabi. Không đưa file hoặc trạng thái nội bộ ra web.
import { previousDay } from './core.mjs';
const ORIGIN = 'https://tiendo286-lab.github.io';
export function isControlPage(value) {
  try {
    const u = new URL(value);
    return u.origin === ORIGIN && ['/Qu-n-tr-cafe/', '/Qu-n-tr-cafe/index.html'].includes(u.pathname) &&
      u.hash.slice(1).split('?')[0] === '/ke-toan/fabi';
  } catch (_) { return false; }
}
export function validRequest(m) {
  return m && m.v === 1 && ['state', 'preview', 'upload', 'enable', 'stop'].includes(m.type) &&
    Object.keys(m).every((k) => ['v', 'type', ...(m.type === 'enable' ? ['value'] : [])].includes(k)) &&
    (m.type !== 'enable' || typeof m.value === 'boolean');
}
export function webView(s, version) {
  const r = s.run;
  const running = r?.status === 'running';
  return { bridgeVersion: 1, extensionVersion: version, enabled: !!s.enabled,
    status: r?.status || 'idle', mode: r?.mode || null, phase: r?.phase || null, day: r?.day || null,
    progress: { done: r?.results?.length || 0, total: r?.queue?.length || 0 },
    lastSuccess: s.lastSuccess || null, lastFinishedAt: r?.finished || null,
    canUpload: !running && r?.mode === 'preview' && r.status === 'success' && r.day === previousDay(),
    canEnable: !running && (s.enabled || (r?.mode === 'upload' && r.status === 'success')) };
}
export function installWebBridge({ chrome, read, control, authorize }) {
  chrome.runtime.onMessageExternal.addListener((m, sender, reply) => {
    (async () => {
      if (!validRequest(m) || sender.id || !sender.tab?.id || sender.frameId !== 0 ||
          (sender.origin && sender.origin !== ORIGIN) || !isControlPage(sender.url)) throw Error('NOT_ALLOWED');
      const tab = await chrome.tabs.get(sender.tab.id);
      if (!isControlPage(tab.url) || !await authorize(sender)) throw Error('NOT_ALLOWED');
      // Trang web chỉ điều khiển ngày hôm qua; bản kiểm tra của ngày lấy bù chỉ nhập từ cửa sổ tiện ích.
      if (m.type === 'upload' && !webView(await read(), '').canUpload) throw Error('NOT_READY');
      const state = m.type === 'state' ? await read() : await control(m);
      return webView(state, chrome.runtime.getManifest().version);
    })().then((state) => reply({ state }), (e) => reply({ error: e.message === 'NOT_ALLOWED'
      ? 'Không có quyền điều khiển. Hãy đăng nhập tài khoản Kế toán trên trang File ca Fabi.'
      : 'Chưa thực hiện được. Mở tiện ích Đồng bộ C02 để xem hướng dẫn rồi thử lại.' }));
    return true;
  });
}
