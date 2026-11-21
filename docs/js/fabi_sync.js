import { addDays, vnToday } from './data.js';
import { dmy } from './tien.js';
import { $, html } from './ui.js';

// ID công khai của tiện ích trên máy làm việc; không phải khóa đăng nhập.
const EXTENSION = 'jeipbpnccocfgojbjdfabkbdeiknfeba';
export function syncPanel() {
  return html`<section class="card fb-sync" aria-labelledby="fb-sync-title">
    <div class="fb-sync-head"><div><div class="fb-eyebrow">TỰ LẤY FILE CA TỪ FABI</div><h2 id="fb-sync-title">Đồng bộ từ Fabi</h2>
      <p class="st-meta">Hôm qua · ${dmy(addDays(vnToday(), -1))} · cả 4 cơ sở</p></div><span class="pill mute" id="fb-sync-badge">Đang kết nối…</span></div>
    <p id="fb-sync-state" role="status">Đang kiểm tra tiện ích trên Chrome này…</p>
    <div id="fb-sync-progress" class="fb-progress" hidden><progress max="1" value="0"></progress><span></span></div>
    <div class="fb-sync-actions"><button class="btn" id="fb-sync-preview" disabled>1. Kiểm tra tải</button>
      <button class="btn secondary" id="fb-sync-upload" disabled>2. Đồng bộ lên web</button>
      <button class="btn sm secondary" id="fb-sync-stop" disabled>Dừng và tắt lịch</button></div>
    <div class="fb-sync-foot"><label><input type="checkbox" id="fb-sync-enabled" disabled> Tự chạy từ 08:15 hằng ngày</label>
      <button class="btn sm secondary" id="fb-sync-refresh">Kiểm tra kết nối</button></div>
    <p class="st-meta" id="fb-sync-note">Máy cần thức, Chrome mở, có mạng và đang đăng nhập Fabi cùng Milano.</p>
    <p id="fb-sync-error" class="alert error" role="alert" hidden></p>
  </section>`;
}
export function mountSync(onImported) {
  let alive = true, timer, pending = false, lastFinished, observed = false;
  const rt = globalThis.chrome?.runtime;
  const request = (type, extra = {}) => new Promise((resolve, reject) => {
    if (!rt?.sendMessage) { reject(Error('NO_EXTENSION')); return; }
    let settled = false;
    const timeout = setTimeout(() => { if (!settled) { settled = true; reject(Error('NO_EXTENSION')); } }, 12000);
    try {
      rt.sendMessage(EXTENSION, { v: 1, type, ...extra }, (r) => {
        const err = rt.lastError;
        if (settled) return; settled = true; clearTimeout(timeout);
        if (err || !r) reject(Error('NO_EXTENSION'));
        else if (r.error) reject(Error(r.error));
        else if (r.state?.bridgeVersion !== 1) reject(Error('NO_EXTENSION'));
        else resolve(r.state);
      });
    } catch (_) { clearTimeout(timeout); reject(Error('NO_EXTENSION')); }
  });
  function paint(s) {
    if (!alive || !$('#fb-sync-state')) return;
    $('#fb-sync-state').closest('.fb-sync').dataset.connected = 'yes';
    const running = s.status === 'running';
    const badge = $('#fb-sync-badge'); badge.className = `pill ${s.status === 'error' ? 'warn' : 'ok'}`;
    badge.textContent = running ? 'Đang chạy' : s.status === 'error' ? 'Cần kiểm tra' : 'Đã kết nối';
    const phase = ['list', 'detail', 'prepare', 'preflight'].includes(s.phase) ? 'Đang tải và kiểm tra file' : 'Đang nhập và xác minh';
    $('#fb-sync-state').textContent = running ? `${phase} · ${s.progress.done}/${s.progress.total || '…'} ca.`
      : s.status === 'error' ? 'Lượt chạy chưa hoàn tất. Mở tiện ích Đồng bộ C02 trên thanh Chrome để xem lỗi và chạy lại.'
      : s.status === 'stopped' ? 'Đã dừng. Lịch tự động đã tắt.'
      : s.status === 'success' && s.mode === 'preview' ? `Đã kiểm tra ${s.progress.done}/${s.progress.total} ca ngày ${dmy(s.day)}. Sẵn sàng nhập.`
      : s.lastSuccess ? `Đã đồng bộ thành công ngày ${dmy(s.lastSuccess)}.${s.status === 'success' ? ` ${s.progress.done}/${s.progress.total} ca.` : ''}`
      : 'Sẵn sàng. Bắt đầu bằng Kiểm tra tải để lấy đủ ca hôm qua.';
    $('#fb-sync-preview').disabled = running || pending;
    $('#fb-sync-upload').disabled = !s.canUpload || pending;
    $('#fb-sync-stop').disabled = (!running && !s.enabled) || pending;
    $('#fb-sync-enabled').checked = s.enabled;
    $('#fb-sync-enabled').disabled = !s.canEnable || running || pending;
    $('#fb-sync-progress').hidden = !running;
    const bar = $('#fb-sync-progress progress'); bar.max = Math.max(s.progress.total, 1); bar.value = s.progress.done;
    $('#fb-sync-progress span').textContent = `${s.progress.done}/${s.progress.total || '…'} ca`;
    $('#fb-sync-note').textContent = 'Nút đồng bộ áp dụng cả 4 cơ sở, độc lập với cơ sở đang xem bên dưới. Máy cần thức và Chrome mở, có mạng.';
    if (observed && s.status === 'success' && s.mode === 'upload' && lastFinished !== s.lastFinishedAt) onImported?.();
    observed = true;
    lastFinished = s.lastFinishedAt || lastFinished;
  }
  function disconnected() {
    if (!alive || !$('#fb-sync-state')) return;
    $('#fb-sync-state').closest('.fb-sync').dataset.connected = 'no';
    $('#fb-sync-badge').className = 'pill mute'; $('#fb-sync-badge').textContent = 'Chưa kết nối';
    $('#fb-sync-state').textContent = 'Mở bằng Chrome trên máy đã cài tiện ích Đồng bộ C02 để dùng các nút tự động.';
    $('#fb-sync-note').textContent = 'Trên iPhone, bạn vẫn xem kết quả và chọn file Excel để nhập thủ công. Lịch chạy được lưu trên máy Chrome đã cài tiện ích.';
    ['preview', 'upload', 'stop', 'enabled'].forEach((x) => { $(`#fb-sync-${x}`).disabled = true; });
    $('#fb-sync-enabled').checked = false; $('#fb-sync-progress').hidden = true;
  }
  async function refresh() {
    if (!alive || pending) return;
    try { paint(await request('state')); } catch (_) { disconnected(); }
  }
  async function action(type, event, extra = {}) {
    if (!event.isTrusted || !navigator.userActivation?.isActive || pending) return;
    if (type === 'upload' && !confirm('Nhập các ca đã kiểm tra của hôm qua cho cả 4 cơ sở lên Milano? Web sẽ cập nhật số đối soát theo Fabi và có thể mở lại ca, báo quản lý.')) return;
    pending = true; $('#fb-sync-error').hidden = true;
    ['preview', 'upload', 'stop', 'enabled'].forEach((x) => { $(`#fb-sync-${x}`).disabled = true; });
    try { const s = await request(type, extra); pending = false; paint(s); }
    catch (e) { pending = false; if (alive) { $('#fb-sync-error').textContent = e.message === 'NO_EXTENSION' ? 'Chưa kết nối được tiện ích. Kiểm tra tiện ích đã bật rồi thử lại.' : e.message; $('#fb-sync-error').hidden = false; await refresh(); } }
  }
  ['preview', 'upload', 'stop'].forEach((type) => { $(`#fb-sync-${type}`).onclick = (e) => action(type, e); });
  $('#fb-sync-enabled').onchange = (e) => action('enable', e, { value: e.target.checked });
  $('#fb-sync-refresh').onclick = () => refresh();
  const visible = () => { if (!document.hidden) refresh(); };
  document.addEventListener('visibilitychange', visible);
  refresh(); timer = setInterval(visible, 5000);
  return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
}
