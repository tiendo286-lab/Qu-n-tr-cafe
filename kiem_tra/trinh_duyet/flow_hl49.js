// Thêm người làm hộ ở bước "Ai làm ca" (role=ql, điện thoại, ca Tối nếu có): gõ tên không dấu → danh sách → bấm tên để thêm; gõ mã + "+ Thêm"
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const typ = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const norm = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    for (const m of ['../js/chot_ca_moi.js', '../js/pages/phieu_ca.js']) await Promise.race([import(m).catch(() => {}), sleep(4000)]);
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const o = ov.find((x) => x.shift === 'Tối') || ov[ov.length - 1];
    const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id; await wait('#cm-claim'); await sleep(500);
    $('#cm-claim').click(); await wait('#cm-helper'); await sleep(1500);
    const emps = await rpc('app_ca_employees');
    const n0 = $$('.cm-person').length;
    const target = emps.find((e) => !txt('#cm-body').includes(e.name) && e.name.split(' ').length > 1);
    const word = norm(target.name.split(' ').pop());
    typ($('#cm-helper'), word); await sleep(400);
    r.push(`Ca ${o.shift} · gõ "${word}": ${$$('#cm-help-list [data-add-emp]').length} người khớp · ${txt('#cm-help-list').slice(0, 160)} · ${W()}`);
    $(`#cm-help-list [data-add-emp="${target.id}"]`).click(); await sleep(400);
    r.push(`Bấm tên → danh sách ${n0} → ${$$('.cm-person').length} người · có ${target.name}: ${txt('#cm-body').includes(target.name)}`);
    const t2 = emps.find((e) => !txt('#cm-body').includes(e.name));
    typ($('#cm-helper'), t2.code); await sleep(200); $('#cm-add-helper').click(); await sleep(400);
    r.push(`Gõ mã ${t2.code} + Thêm → ${$$('.cm-person').length} người · ${W()}`);
    typ($('#cm-helper'), 'xyzkhongco'); await sleep(300);
    r.push(`Gõ tên không có: ${txt('#cm-help-list')}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'thêm người làm hộ', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
