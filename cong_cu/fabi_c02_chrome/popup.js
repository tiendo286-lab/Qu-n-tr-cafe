const $ = (s) => document.querySelector(s);
const labels = { preview: 'Đã kiểm tra, chưa nhập', unchanged: 'Đã có, số liệu khớp', khop: 'Đã nhập, khớp phiếu',
  lech: 'Đã nhập, khác phiếu và báo quản lý', chua_phieu: 'Đã nhập, chưa có phiếu trên web', dang_chot: 'Đã nhập, phiếu đang chốt' };
async function send(type, extra = {}) {
  const r = await chrome.runtime.sendMessage({ type, ...extra });
  if (r.error) throw Error(r.error);
  return r.state || r;
}
function show(s) {
  const running = s.run?.status === 'running';
  $('#status').textContent = s.run?.message || 'Chưa chạy. Bắt đầu bằng Kiểm tra tải.';
  $('#preview').disabled = running;
  $('#stop').disabled = !running && !s.enabled;
  $('#upload').disabled = running || s.run?.mode !== 'preview' || s.run?.status !== 'success';
  $('#enabled').checked = !!s.enabled;
  $('#enabled').disabled = running || (!s.enabled && !(s.run?.mode === 'upload' && s.run?.status === 'success'));
  $('#results').replaceChildren(...(s.run?.results || []).map((r) => {
    const li = document.createElement('li'); li.textContent = `${r.store} · ${r.id} · ${labels[r.status] || r.status}`; return li;
  }));
}
async function act(type, extra) { try { $('#error').textContent = ''; show(await send(type, extra)); } catch (e) { $('#error').textContent = e.message; } }
$('#preview').onclick = () => act('preview');
$('#upload').onclick = () => act('upload');
$('#stop').onclick = () => act('stop');
$('#enabled').onchange = (e) => act('enable', { value: e.target.checked });
await act('state');
setInterval(() => act('state'), 2000);
