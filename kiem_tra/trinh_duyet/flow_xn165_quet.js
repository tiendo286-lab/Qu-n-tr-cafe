// Bài dò bước 165: ở chế độ Xem như (role=chu + &xnva=nv|ql|qlt|kt|nvkt), mở lần lượt mọi mục trong menu của người đó
// và ghi lại trang nào gọi lệnh GHI ngay khi mở (máy chủ thật sẽ chặn → hộp lỗi đỏ) hoặc hiện hộp lỗi.
// Chạy: index.html?auto=1&role=chu&confirm=1&script=flow_xn165_quet&xnva=ql. Kết quả: out[].xnquet = { ok, fail }.
export default async ({ sleep, settle, out }) => {
  const q = new URLSearchParams(location.search); const va = q.get('xnva') || 'ql';
  if (localStorage.getItem('test_viewas') !== va) { localStorage.setItem('test_viewas', va); localStorage.setItem('test_viewas_until', String(Date.now() + 1800000)); location.reload(); await sleep(60000); return; }
  const good = [], bad = [];
  const WRITE = /_(save|set|add|del|delete|mark|seen|ack|create|update|upsert|send|done|confirm|apply|close|open|claim|collect|reopen|submit|edit|move|touch|read|tick)(_|$)/;
  await sleep(1500); await settle();
  const links = [...new Set([...document.querySelectorAll('nav a[href^="#/"], .sidebar a[href^="#/"]')].map((a) => a.getAttribute('href').split('?')[0]))].filter((h) => h !== '#/he-thong/xem-nhu');
  const seen = new Set();
  const visitOne = async (h) => {
    if (seen.has(h)) return; seen.add(h);
    const k0 = window.__LOG.length; window.__ERR.length = 0;
    location.hash = h; await settle(); await sleep(400);
    const w = window.__LOG.slice(k0).filter((x) => x[0] === 'rpc' && WRITE.test(x[1])).map((x) => x[1]);
    const errBox = [...document.querySelectorAll('#root .alert.error')].filter((a) => !a.hidden && a.textContent.trim()).map((a) => a.textContent.trim().slice(0, 80));
    const errs = [...window.__ERR].filter((e) => !/404|Failed to load resource/.test(e)).slice(0, 2);
    if (w.length || errBox.length || errs.length) bad.push(`${h}: ${w.length ? 'gọi ghi ' + [...new Set(w)].join(', ') + ' · ' : ''}${errBox.join(' | ')}${errs.length ? ' · ' + errs.join(' | ').slice(0, 160) : ''}`);
    else good.push(h);
    // mục con trong thanh tab của nhóm
    for (const t of [...document.querySelectorAll('.hub-tabs a[href^="#/"]')].map((a) => a.getAttribute('href').split('?')[0])) if (!seen.has(t)) await visitOne(t);
  };
  for (const h of links) await visitOne(h);
  localStorage.removeItem('test_viewas'); localStorage.removeItem('test_viewas_until');
  out.push({ xnquet: { ok: [`${va}: ${good.length} trang không tự ghi`], fail: bad } });
};
