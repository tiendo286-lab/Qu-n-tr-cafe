export default async ({ visit, settle, sleep, out }) => {
  const q = new URLSearchParams(location.search);
  const log = (route, title, errs = []) => out.push({ route, title: String(title).slice(0, 300), len: 0, errs });
  const flashText = () => [...document.querySelectorAll('#root .alert')].map((a) => a.textContent.trim()).join(' | ');
  const step = async (name, fn) => { window.__ERR.length = 0; let r = ''; try { r = await fn(); } catch (e) { window.__ERR.push('flow: ' + e.stack); } log(name, (r || '') + ' ' + flashText(), [...window.__ERR]); };
  const fresh = async (h) => { location.hash = '#/__tam'; await settle(); await visit(h); out.pop(); };
  if (q.get('role') === 'nv') {
    await step('NV gửi order', async () => {
      await fresh('#/order');
      const radios = [...document.querySelectorAll('.opt input, input.opt')].filter((x) => x.value === 'ok');
      radios.forEach((r) => { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
      const k = window.__LOG.length; document.getElementById('order-form').requestSubmit(); await sleep(800); await settle();
      const c = window.__LOG.slice(k).find((x) => x[1] === 'app_submit_order');
      return 'radios=' + radios.length + ' ' + (c ? 'gọi app_submit_order ' + JSON.stringify(c[2]).slice(0, 120) : 'KHÔNG GỌI');
    });
    await step('NV đổi mật khẩu', async () => {
      await fresh('#/doi-mat-khau');
      const ins = [...document.querySelectorAll('#root input[type=password]')]; ins.forEach((i, n) => { i.value = n === 0 ? 'cu123456' : 'moi12345'; });
      const k = window.__LOG.length; document.querySelector('#root form').requestSubmit(); await sleep(800); await settle();
      return 'inputs=' + ins.length + ' ' + window.__LOG.slice(k).map((x) => x[1]).join(',') + ' → ' + location.hash;
    });
    return;
  }
  for (const tab of ['', '&tab=canh-bao', '&tab=lich&che_do=cs&cn=LHP', '&tab=lich']) {
    await step('Xuất Excel bao-cao' + tab, async () => {
      await fresh('#/quan-ly/bao-cao?tuan=2026-11-02' + tab);
      const btns = [...document.querySelectorAll('#root button')].filter((b) => /Xuất|Excel|Tải/.test(b.textContent));
      const res = [];
      for (const b of btns) { const n = window.__blobs.length; b.click(); for (let i = 0; i < 60 && window.__blobs.length <= n; i++) await sleep(100); res.push(b.textContent.trim() + ':' + (window.__blobs[n] ? window.__blobs[n].size : 'KHÔNG')); }
      return res.join(' ; ');
    });
  }
  await step('Đăng xuất', async () => { await fresh('#/'); document.querySelector('[data-logout]').click(); await sleep(500); await settle(); return location.hash + ' ' + document.title; });
};
