import { MAX_BACK_DAYS, recentDays, vnDate } from './core.mjs';
const $ = (s) => document.querySelector(s);
const labels = { preview: 'Đã kiểm tra, chưa nhập', unchanged: 'Đã có, số liệu khớp', khop: 'Đã nhập, khớp phiếu',
  lech: 'Đã nhập, khác phiếu và báo quản lý', chua_phieu: 'Đã nhập, chưa có phiếu trên web', dang_chot: 'Đã nhập, phiếu đang chốt' };
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const short = (d) => vnDate(d).slice(0, 5);
let chosen = null, last = null; // ngày đang chọn: giữ nguyên qua các lần làm mới 2 giây/lần
async function send(type, extra = {}) {
  const r = await chrome.runtime.sendMessage({ type, ...extra });
  if (r.error) throw Error(r.error);
  return r.state || r;
}
// Số ca tiện ích đã đồng bộ của một ngày (bản 0.3.0 ghi riêng; ngày cũ hơn đếm theo nhật ký từng ca).
const syncedCount = (s, d) => Math.max(s.synced?.[d]?.count || 0, Object.keys(s.done || {}).filter((k) => k.startsWith(d + ':')).length);
function fillDays(s) {
  const days = recentDays(MAX_BACK_DAYS);
  const busyDay = s.run?.day && days.includes(s.run.day) && (s.run.status === 'running' || (s.run.mode === 'preview' && s.run.status === 'success')) ? s.run.day : null;
  if (s.run?.status === 'running') chosen = busyDay;
  if (!chosen || !days.includes(chosen)) chosen = busyDay || days[0];
  const opts = days.map((d, i) => {
    const n = syncedCount(s, d);
    return [d, `${WD[new Date(d + 'T00:00:00Z').getUTCDay()]} ${short(d)}${i === 0 ? ' · hôm qua' : ''} · ${n ? `✓ đã đồng bộ ${n} ca` : 'chưa đồng bộ'}`];
  });
  const sel = $('#day'), key = JSON.stringify(opts);
  if (sel.dataset.key !== key) {
    sel.replaceChildren(...opts.map(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; return o; }));
    sel.dataset.key = key;
  }
  sel.value = chosen;
}
function show(s) {
  last = s;
  fillDays(s);
  const running = s.run?.status === 'running';
  const ready = !running && s.run?.mode === 'preview' && s.run?.status === 'success';
  $('#status').textContent = s.run?.message || 'Chưa chạy. Chọn ngày rồi bấm Kiểm tra tải.';
  $('#day').disabled = running;
  $('#preview').disabled = running;
  $('#preview').textContent = `1. Kiểm tra tải ngày ${short(chosen)} — chưa nhập`;
  $('#upload').disabled = !(ready && s.run.day === chosen);
  $('#upload').textContent = ready && s.run.day === chosen ? `2. Đồng bộ ngày ${short(chosen)} lên Milano` : '2. Đồng bộ lên Milano';
  $('#hint').hidden = !(ready && s.run.day !== chosen);
  $('#hint').textContent = ready ? `Đã kiểm tra ngày ${short(s.run.day)}. Ngày đang chọn cần bấm 1. Kiểm tra tải trước.` : '';
  $('#stop').disabled = !running && !s.enabled;
  $('#enabled').checked = !!s.enabled;
  $('#enabled').disabled = running || (!s.enabled && !(s.run?.mode === 'upload' && s.run?.status === 'success'));
  $('#results').replaceChildren(...(s.run?.results || []).map((r) => {
    const li = document.createElement('li'); li.textContent = `${r.store} · ${r.id} · ${labels[r.status] || r.status}`; return li;
  }));
}
async function act(type, extra) { try { $('#error').textContent = ''; show(await send(type, extra)); } catch (e) { $('#error').textContent = e.message; } }
// Chrome chỉ đổi phần chạy nền khi nạp lại tiện ích, còn cửa sổ này đọc tệp mới mỗi lần mở.
// Tệp trên máy đã là bản mới mà Chrome còn chạy bản cũ → hiện nút nạp lại (anh khỏi phải tìm nút ↻ trong Quản lý tiện ích).
const loaded = chrome.runtime.getManifest().version;
$('#ver').textContent = `bản ${loaded}`;
try {
  const disk = (await (await fetch(chrome.runtime.getURL('manifest.json'), { cache: 'no-store' })).json()).version;
  if (disk && disk !== loaded) {
    $('#update').hidden = false; $('#newver').textContent = disk; $('#oldver').textContent = loaded;
    $('#reload').onclick = () => chrome.runtime.reload();
  }
} catch (_) { /* không đọc được tệp: bỏ qua */ }
$('#day').onchange = (e) => { chosen = e.target.value; if (last) show(last); };
$('#preview').onclick = () => act('preview', { day: chosen });
$('#upload').onclick = () => act('upload');
$('#stop').onclick = () => act('stop');
$('#enabled').onchange = (e) => act('enable', { value: e.target.checked });
await act('state');
setInterval(() => act('state'), 2000);
