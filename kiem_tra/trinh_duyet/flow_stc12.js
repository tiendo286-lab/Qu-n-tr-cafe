// Bài thử bước 164: Sổ thu / Sổ chi gọn (phần đầu 1 nút chuyển + ô số, bỏ cột phải, bấm ô → danh sách một loại, 👥 Người nợ, bộ lọc "Đang lọc", mở ngày gọn).
// Chạy: index.html?auto=1&role=chu&confirm=1&script=flow_stc12 (role chu / qlt / ql) và test/phone.html. Kết quả: out[].stc12 = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 120) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const calls = (name, k0) => (window.__LOG || []).slice(k0).filter((x) => x[0] === 'rpc' && x[1] === name);
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const phone = window.innerWidth <= 400;
  const wide = (m) => { if (phone) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `${m}: không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`); };
  const go = async (tab, extra = '') => { location.hash = `#/quan-ly/so-thu-chi?tab=${tab}&cn=1&thang=2026-11${extra}&t=${Date.now()}`; await wait('#stc-book'); await sleep(500); };
  const hdrCols = () => $$('#stc-book .stc-hdr > span').length;
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    // ===== Task 2: phần đầu + bảng ngày
    await go('thu');
    ok(!$('.stc-aside') && !$('#stc-page .stc-side'), '2. Sổ thu: không còn cột bên phải');
    ok($$('.stc-sw a.stc-pay').length === 2, '2. một nút chuyển 2 nửa Tiền mặt | Chuyển khoản');
    ok($$('.stc-tiles a.stc-tile[data-col]').length === 5 && !$$('.stc-tile').some((t) => txt(t).startsWith('tổng thu')), '2. 5 ô số, không còn ô "Tổng thu · Tiền mặt"');
    ok(txt($('.stc-formula')).includes('tổng thu tháng 11 =') && txt($('.stc-formula')).includes('bấm một ô để chỉ xem khoản loại đó'), '2. dòng công thức chữ nhỏ dưới hàng ô');
    const hid = { thu: null, chi: null };
    for (const b of ['thu', 'chi']) {
      await go(b);
      if ($('.stc-hidecols')) { hid[b] = hdrCols();
        ok(txt($('.stc-hidecols')).includes('đang ẩn cột') && txt($('.stc-hidecols')).includes('cả tháng bằng 0'), `2. Sổ ${b}: dòng "Đang ẩn cột … (cả tháng bằng 0)"`);
        $('.stc-hidecols [data-showzero]').click(); await sleep(300);
        ok(hdrCols() > hid[b] && !$('.stc-hidecols'), `2. Sổ ${b}: bấm "hiện lại" → hiện đủ cột (${hid[b]} → ${hdrCols()})`);
      }
    }
    ok(hid.thu !== null || hid.chi !== null, '2. dữ liệu thử có ít nhất một cột cả tháng bằng 0 được ẩn');
    await go('thu');
    const cellsTxt = $$('#stc-book .stc-drow .stc-c:not(.tot)').map((c) => c.textContent.trim());
    ok(cellsTxt.length > 0 && !cellsTxt.includes('–'), '2. ô bằng 0 để trống thay cho "–"');
    wide('2. phần đầu Sổ thu');
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.message || e)); }
  out.push({ stc12: { ok: good, fail: bad } });
};
