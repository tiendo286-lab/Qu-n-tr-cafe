const q = new URLSearchParams(location.search);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function settle() { let last = ''; for (let i = 0; i < 60; i++) { await sleep(100); const h = document.getElementById('root').innerHTML; if (h === last && !h.includes('Đang tải')) return; last = h; } }
const out = [];
async function visit(route) {
  window.__ERR.length = 0;
  location.hash = route; await settle();
  const root = document.getElementById('root');
  const errs = [...window.__ERR];
  root.querySelectorAll('.alert.error').forEach((a) => a.textContent.trim() && !a.hidden && errs.push('page: ' + a.textContent.trim().slice(0, 200)));
  const txt = root.innerText;
  if (/undefined|NaN|\[object Object\]/.test(txt)) errs.push('chữ lạ: ' + (txt.match(/.{0,40}(undefined|NaN|\[object Object\]).{0,40}/) || [''])[0]);
  out.push({ route, title: document.title, len: root.innerHTML.length, errs });
  return root;
}
async function main() {
  await sleep(500); await settle();
  const routes = (q.get('routes') || '').split(',').filter(Boolean).map(decodeURIComponent);
  for (const r of routes) await visit(r);
  if (q.get('script')) { const m = await import('./' + q.get('script') + '.js'); await m.default({ visit, settle, sleep, out }); }
  const pre = document.createElement('pre'); pre.id = 'ketqua'; pre.textContent = JSON.stringify(out, null, 1); document.body.appendChild(pre);
  document.title = 'XONG'; if (window.parent !== window) window.parent.postMessage(JSON.stringify(out), '*');
}
if (q.get('auto')) main();
