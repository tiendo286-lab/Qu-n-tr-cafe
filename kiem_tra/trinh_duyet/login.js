export default async ({ settle, sleep, out }) => {
  window.__ERR.length = 0;
  document.querySelector('#root input[type=text], #root input:not([type])').value = 'admin';
  document.querySelector('#root input[type=password]').value = 'abc123';
  document.querySelector('#root form').requestSubmit(); await sleep(1000); await settle();
  out.push({ route: 'đăng nhập', title: location.hash + ' ' + document.title + ' ' + window.__LOG.filter((x) => x[0] === 'rpc').map((x) => x[1]).slice(0, 5).join(','), len: 0, errs: [...window.__ERR] });
};
