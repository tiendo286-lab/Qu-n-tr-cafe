// Bấm lần lượt từng nút / đổi từng ô chọn trên mỗi trang, ghi lỗi
export default async ({ visit, settle, sleep, out }) => {
  const q = new URLSearchParams(location.search);
  const routes = (q.get('fz') || '').split(',').filter(Boolean).map(decodeURIComponent);
  const max = Number(q.get('max') || 25);
  for (const route of routes) {
    location.hash = '#/__tam'; await settle();
    let root = await visit(route);
    const sig = (el) => (el.tagName + ':' + (el.id || '') + ':' + (el.name || '') + ':' + (el.textContent || '').trim().slice(0, 30) + ':' + Object.keys(el.dataset).join('|'));
    const targets = () => [...root.querySelectorAll('button, select, input[type=checkbox], [data-cell], td[data-k], .cell, [role=button]')]
      .filter((el) => !el.closest('nav') && !el.hasAttribute('data-logout') && !el.disabled && el.offsetParent !== null);
    const n = Math.min(max, targets().length);
    const seen = new Set();
    for (let i = 0; i < targets().length && seen.size < n; i++) {
      location.hash = '#/__tam'; await settle(); root = await visit(route); out.pop();
      const el = targets()[i]; if (!el) break;
      const s = sig(el); if (seen.has(s.replace(/\d+/g, '#'))) continue; seen.add(s.replace(/\d+/g, '#'));
      window.__ERR.length = 0; const before = window.__LOG.length;
      try {
        if (el.tagName === 'SELECT') { if (el.options.length > 1) { el.selectedIndex = el.selectedIndex === 1 ? 0 : 1; el.dispatchEvent(new Event('change', { bubbles: true })); } }
        else el.click();
      } catch (e) { window.__ERR.push('click: ' + e); }
      await settle(); await sleep(300);
      // nếu mở hộp thoại / bảng chọn, bấm thêm nút đầu tiên trong đó
      const dlg = document.querySelector('dialog[open]') || [...document.querySelectorAll('.picker:not([hidden]), [data-picker]:not([hidden])')][0];
      let extra = '';
      if (dlg) { const b = [...dlg.querySelectorAll('button, [data-emp], li, .opt')].filter((x) => x.offsetParent !== null)[1]; if (b) { extra = ' → ' + (b.textContent || '').trim().slice(0, 25); try { b.click(); } catch (e) { window.__ERR.push('click2: ' + e); } await settle(); await sleep(200); } if (dlg.close) dlg.close(); }
      const errs = [...window.__ERR];
      document.querySelectorAll('#root .alert.error').forEach((a) => a.textContent.trim() && !a.hidden && errs.push('page: ' + a.textContent.trim().slice(0, 200)));
      const calls = window.__LOG.slice(before).map((x) => x[0] === 'rpc' ? x[1] : x[0] + ':' + (x[1] && x[1].action || x[1])).join(' ');
      out.push({ route: route + ' ⟶ ' + s + extra, title: calls.slice(0, 160), len: 0, errs });
    }
  }
};
