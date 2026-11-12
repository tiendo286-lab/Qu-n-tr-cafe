// Thêm người làm hộ ở bước "Ai làm ca" (role=ql, điện thoại, ca Tối nếu có): 2 mục "Nhân viên trong quán" (cơ sở này lên trước) / "Nhân viên cũ";
// bấm mục → hiện danh sách, bấm tên để thêm; ô lọc tên không dấu
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
    $('#cm-claim').click(); await wait('[data-hp]'); await sleep(1000);
    const n0 = $$('.cm-person').length;
    r.push(`Ca ${o.shift} · 2 mục: ${$$('[data-hp]').map((b) => b.innerText).join(' | ')} · danh sách đang đóng: ${!$('#cm-help-list')}`);
    $('[data-hp="in"]').click(); await wait('[data-add-emp]', 100); await sleep(300);
    r.push(`Nhân viên trong quán: ${$$('.cm-hp-g').map((g) => g.innerText).join(' · ')} · ${$$('[data-add-emp]').length} người · ${W()}`);
    const first = $('[data-add-emp]'); const nm = first.querySelector('strong').innerText; first.click(); await sleep(400);
    r.push(`Bấm "${nm}" → ${n0} → ${$$('.cm-person').length} người · mục vẫn mở: ${!!$('#cm-help-list')}`);
    const helpers = await rpc('app_ca_helpers');
    const inList = [...document.querySelectorAll('.cm-person')].map((x) => x.innerText).join(' '); const t = helpers.active.find((e) => !inList.includes(e.name) && e.name.split(' ').length > 1);
    const w = norm(t.name.split(' ').pop()); typ($('#cm-helper'), w); await sleep(300);
    r.push(`Lọc "${w}": ${$$('[data-add-emp]').map((b) => b.querySelector('strong').innerText).join(' · ')}`);
    $('[data-hp="old"]').click(); await wait('#cm-help-list', 50); for (let i = 0; i < 50 && !$('[data-add-emp]') && !txt('#cm-help-list').includes('Không'); i++) await sleep(50);
    r.push(`Nhân viên cũ: ${$$('.cm-hp-g').map((g) => g.innerText).join(' · ') || txt('#cm-help-list')} · ${W()}`);
    if ($('[data-add-emp]')) { $('[data-add-emp]').click(); await sleep(400); r.push(`Thêm người cũ → ${$$('.cm-person').length} người`); }
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'thêm người làm hộ', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
