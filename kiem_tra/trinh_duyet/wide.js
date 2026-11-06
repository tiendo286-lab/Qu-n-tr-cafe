export default async ({ visit, settle, out }) => {
  const routes = new URLSearchParams(location.search).get('wr').split(',').map(decodeURIComponent);
  for (const r of routes) {
    location.hash = '#/__tam'; await settle(); await visit(r); const o = out.pop();
    const W = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll('#root *')].filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.right > W + 1 && !el.closest('.table-wrap, .grid-wrap, [style*="overflow"]'); });
    const top = wide.filter((el) => !wide.includes(el.parentElement)).slice(0, 4).map((el) => el.tagName + '.' + el.className + ' r=' + Math.round(el.getBoundingClientRect().right));
    out.push({ route: r, title: `W=${W} scroll=${document.documentElement.scrollWidth}`, len: 0, errs: [...o.errs, ...top.map((t) => 'tràn: ' + t)] });
  }
};
