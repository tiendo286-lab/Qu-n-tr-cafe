// Bài thử bước 152: trang Thu chi / Lệch tiền ca / Sổ quỹ cũ đã xoá — đường dẫn cũ tự chuyển sang Sổ thu chi, menu không còn 3 mục.
// Chạy: index.html?auto=1&role=chu|ql&script=flow_cu152 (và test/phone.html). Kết quả: out[].cu152 = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const errs = []; window.addEventListener('error', (e) => errs.push(e.message));
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  const hp = () => new URLSearchParams(location.hash.split('?')[1] || '');
  const goOld = async (h) => { location.hash = h; await sleep(600); await wait('#stc-page', 80); await sleep(500); };
  try {
    const cases = [
      ['#/quan-ly/thu-chi?thang=2026-11&cn=1', { tab: 'chi', thang: '2026-11', cn: '1' }, 'Thu chi'],
      ['#/quan-ly/thu-chi?xem=khoan-am&thang=2026-11', { tab: 'chi', loc: 'st:tl', thang: '2026-11' }, 'Thu chi › khoản âm'],
      ['#/quan-ly/khoan-am', { tab: 'chi', loc: 'st:tl' }, 'Khoản âm (cũ)'],
      ['#/quan-ly/so-quy?thang=2026-11&cn=1', { tab: 'tong', thang: '2026-11', cn: '1' }, 'Sổ quỹ'],
      ['#/quan-ly/bao-cao-ca', { tab: 'chi' }, 'Báo cáo ca (cũ)'],
    ];
    for (const [h, want, name] of cases) {
      await goOld(h);
      const p = hp();
      const hit = location.hash.startsWith('#/quan-ly/so-thu-chi') && Object.entries(want).every(([k, v]) => p.get(k) === v);
      ok(hit && !!$('#stc-page'), `${name}: ${h} → ${location.hash}`);
    }
    // 22/11 (Đưa Đối soát Fabi về lại Chốt ca): tab Đối soát Fabi đã bỏ → Lệch tiền ca / Âm tiền cũ về bảng tuần Chốt ca (giữ cơ sở);
    //   tháng này hoặc không ghi tháng → tuần hiện tại; tháng trước → tuần có ngày 1 của tháng đó
    const wk = (d) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };   // thứ Hai
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const prevM = (() => { const x = new Date(today.slice(0, 7) + '-01T00:00:00Z'); x.setUTCMonth(x.getUTCMonth() - 1); return x.toISOString().slice(0, 7); })();
    for (const [h, cn, tuan, name] of [['#/quan-ly/lech-tien?thang=' + today.slice(0, 7) + '&cn=1', '1', wk(today), 'Lệch tiền ca (tháng này)'],
      ['#/quan-ly/lech-tien?thang=' + prevM + '&cn=1', '1', wk(prevM + '-01'), 'Lệch tiền ca (tháng trước)'], ['#/quan-ly/am-tien', null, wk(today), 'Âm tiền (cũ)']]) {
      location.hash = '#/__tam'; await sleep(250); location.hash = h; await sleep(600); await wait('.cw-bar', 80); await sleep(400);
      const p = hp();
      ok(location.hash.startsWith('#/ca?') && (!cn || p.get('cn') === cn) && p.get('tuan') === tuan && !!$('.cw-bar'), `${name}: ${h} → ${location.hash} (bảng tuần Chốt ca, tuần ${tuan})`);
    }
    // menu không còn 3 mục cũ
    const links = $$('a[href]').map((a) => a.getAttribute('href'));
    ok(!links.some((l) => /quan-ly\/(thu-chi|lech-tien|so-quy|am-tien)(\?|$)/.test(l)), 'menu / trang không còn đường dẫn tới 3 trang cũ');
    ok(links.some((l) => /quan-ly\/so-thu-chi/.test(l)), 'menu có Sổ thu chi');
    ok(!errs.length, 'không lỗi trang' + (errs.length ? ': ' + errs.join(' | ') : ''));
  } catch (e) { bad.push('LỖI: ' + e.message); }
  out.push({ cu152: { ok: good, fail: bad } });
};
