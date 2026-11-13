// Bước 76: tab Chốt ca xem theo tuần, mỗi lần 1 cơ sở — hàng ngày × cột ca, ô màu + chữ, TM / CK lệch, "Thiếu phiếu" bấm mở bù. role=chu (điện thoại, confirm=1)
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = []; window.confirm = () => true;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca'; await wait('.cw-t', 600); await sleep(600);
    if (new URLSearchParams(location.search).get('shot')) return;   // dừng để chụp màn hình
    r.push(`trang: ${txt('#root h1')} · cơ sở: ${$$('.cw-bar .branch-tabs a').map((a) => a.innerText.trim()).join(',')} (đang ${txt('.cw-bar .branch-tabs a.on')}) · tuần ${txt('.cw-wt')}`);
    r.push(`bảng: ${$$('.cw-t tbody tr').length} hàng × ${$$('.cw-t thead th').length - 1} ca (${$$('.cw-t thead th').map((t) => t.innerText.trim()).filter(Boolean).join('/')}) · hôm nay ${txt('.cw-t tr.today th')}`);
    const cnt = (c) => $$(`.cw-t .cw-c.${c}`).length;
    r.push(`ô: xong ${cnt('ok')} · đang ${cnt('warn')} · chưa mở ${cnt('none')} · thiếu phiếu ${cnt('miss')} · tổng ${txt('.cw-h .st-meta')}`);
    const ok = $('.cw-t .cw-c.ok'); if (ok) r.push(`ô xong: ${ok.innerText.replace(/\s+/g, ' ')}`);
    $$('.cw-bar .branch-tabs a')[1]?.click(); await sleep(1500); await wait('.cw-t', 300);
    r.push(`đổi cơ sở → ${txt('.cw-h h2')}`);
    $('.cw-wk a[aria-label="Tuần trước"]').click(); await sleep(1500); await wait('.cw-t', 300);
    r.push(`tuần trước: ${txt('.cw-wt')} · giữ cơ sở ${txt('.cw-bar .branch-tabs a.on')}`);
    const miss = $('.cw-t .cw-c.miss') || $('.cw-t .cw-c.none');
    if (miss) { const cls = miss.className; miss.click(); await wait('.cm-card, .pc', 300); await sleep(800); r.push(`bấm ô (${cls.includes('miss') ? 'thiếu phiếu' : 'chưa mở'}) → ${location.hash.split('?')[0]} · ${txt('#root h1')}`); }
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca?ngay=2026-11-12'; await wait('.cw-t', 300); await sleep(500);
    r.push(`đường dẫn cũ ?ngay= → tuần ${txt('.cw-wt')} · ${W()}`);
  } catch (e) { r.push('LỖI ' + e.message); }
  out.push({ route: 'chốt ca tuần 76', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
