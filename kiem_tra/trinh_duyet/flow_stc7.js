// Bài thử bước 152: bộ lọc đầy đủ ở Sổ thu / Sổ chi + quản lý cơ sở vào Sổ thu chi.
// Chạy: index.html?auto=1&role=chu|qlt|ql&script=flow_stc7 và test/phone.html?... Kết quả: out[].stc7 = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = new URLSearchParams(location.search).get('role');
  const wide = (m) => { if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `${m}: không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`); };
  const BASE = '#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11';
  const go = async (h) => { location.hash = h + '&t=' + Date.now(); await sleep(400); await wait('.stc-flt'); await sleep(400); };
  const setSel = async (k, v) => { const s = $(`select[data-lf="${k}"]`); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); await sleep(300); };
  const setQ = async (v) => { const i = $('[data-lf="q"]'); i.focus(); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); await sleep(600); };
  const rows = () => $$('#stc-book .stc-fr');
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    await go(BASE);
    ok(!!$('.stc-flt [data-lf="q"]') && !!$('select[data-lf="src"]') && !!$('select[data-lf="type"]') && !!$('select[data-lf="cat"]') && !!$('select[data-lf="st"]'), '1. có thanh lọc: Tìm, Nguồn, Loại, Nhóm, Trạng thái');
    ok(!txt($('#root h1')).includes('(mới)') && !txt($('#root')).includes('đang chạy thử'), '1. tên "Sổ thu chi", không còn chữ đang chạy thử');
    if (role === 'ql') ok($$('.branch-tabs a').length === 1 && !$('.stc-qn'), '1. quản lý cơ sở: chỉ cơ sở được giao, không có Quỹ ngoài');
    // 2. tìm không dấu
    await setQ('da');
    ok(rows().length > 0 && rows().every((r) => fold(txt(r)).includes('da')), `2. tìm "da" → ${rows().length} khoản, khoản nào cũng có "đá"/"da"`);
    ok(!$('#stc-lfclr').hidden && /loc=q%3Ada|loc=q:da/.test(location.hash), '2. hiện nút Bỏ lọc, đường dẫn giữ bộ lọc');
    ok(document.activeElement === $('[data-lf="q"]'), '2. con trỏ vẫn ở ô tìm sau khi lọc');
    await setQ('');
    // 3. có trừ lương + giải trình
    await setSel('st', 'tl');
    ok(rows().length > 0 && rows().some((r) => txt(r).includes('lan') && txt(r).includes('em đếm nhầm tờ 20 nghìn')), '3. lọc Có trừ lương: thấy phiếu của Lan kèm giải trình');
    ok(rows().every((r) => !!r.querySelector('[data-gap]') || txt(r).includes('ca đã chốt')), '3. mỗi dòng có nút Mở phiếu chênh lệch (hoặc ghi ca đã chốt)');
    rows()[0].querySelector('[data-gap]')?.click(); await wait('dialog[open]', 30); await sleep(200);
    ok(!!$('dialog[open]'), '3. bấm Mở phiếu chênh lệch → mở phiếu'); $('dialog[open] [data-x]')?.click(); await sleep(200);
    wide('3. lọc trừ lương');
    // 4. nguồn: quản lý tạo (ngoài ca)
    await setSel('st', ''); await setSel('src', 'tay');
    ok(rows().length > 0 && rows().every((r) => txt(r.querySelector('.stc-frh')).includes('ngoài ca')), `4. nguồn Quản lý tạo → ${rows().length} khoản, đều ngoài ca`);
    await setSel('src', 'ca');
    ok(rows().length > 0 && rows().every((r) => /ca (sáng|chiều|tối)/.test(txt(r.querySelector('.stc-frh')))), '4. nguồn Từ phiếu ca → đều thuộc một ca');
    // 5. nhóm (danh mục tải chậm)
    await sleep(500);
    const cat = [...$('select[data-lf="cat"]').options].map((o) => o.value).find((v) => v && rows().some((r) => txt(r).includes(v.toLowerCase())));
    if (cat) { await setSel('cat', cat); ok(rows().length > 0 && rows().every((r) => txt(r).includes(cat.toLowerCase())), `5. lọc nhóm "${cat}" → chỉ khoản nhóm đó`); }
    else ok(false, '5. danh sách Nhóm chưa có nhóm nào khớp khoản trong sổ');
    // 6. giao điều kiện rỗng → báo không có
    await setSel('src', 'bu');
    ok(!!$('#stc-book .stc-empty') && txt($('#stc-book')).includes('không có khoản nào khớp'), '6. kết hợp không có khoản → báo rõ');
    // 7. Bỏ lọc
    $('#stc-lfclr').click(); await sleep(600); await wait('.stc-flt');
    ok(!!$('#stc-book .stc-day') && !/loc=/.test(location.hash) && !$('#stc-book .stc-fr'), '7. Bỏ lọc → về sổ theo ngày, đường dẫn hết bộ lọc');
    // 8. đường dẫn có sẵn bộ lọc (đường dẫn cũ "khoản âm")
    await go(BASE + '&loc=st:tl');
    ok($('select[data-lf="st"]').value === 'tl' && rows().length > 0, '8. mở đường dẫn loc=st:tl → đang lọc Có trừ lương');
    wide('8. Sổ chi đang lọc');
  } catch (e) { bad.push('LỖI: ' + e.message); }
  out.push({ stc7: { ok: good, fail: bad } });
};
