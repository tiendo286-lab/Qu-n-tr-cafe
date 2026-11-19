// Bài thử bước 155: tính năng bản mẫu 18/11 còn thiếu — chọn nhóm ngay trên dòng chi / ở "Cần phân loại", "Chi theo loại",
// ô Chênh lệch ghi số ca chờ xử lý, ca thiếu / dư ở khung phải bấm mở phiếu chênh lệch, người nợ + trạng thái trên dòng Cho nợ,
// Quỹ ngoài "Phần mỗi cơ sở chịu". Chạy: index.html?auto=1&role=chu|qlt|ql&confirm=1&script=flow_stc9 (+ test/phone.html).
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = new URLSearchParams(location.search).get('role');
  const wide = (m) => { if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `${m}: không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`); };
  const BASE = '#/quan-ly/so-thu-chi?cn=1&thang=2026-11';
  const go = async (h) => { location.hash = h + '&t=' + Date.now(); await sleep(400); await wait('.stc-flt'); await sleep(900); };
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    // 1. Sổ chi: chọn nhóm ngay trên dòng
    await go(BASE + '&tab=chi'); $('.stc-all')?.click(); await sleep(500);
    const sel = $('#stc-book select[data-catx]');
    ok(!!sel, '1. dòng chi của ca có ô chọn nhóm ngay trên dòng');
    if (sel) {
      const id = sel.dataset.catx; const v = [...sel.options].map((o) => o.value).find((x) => x && x !== 'x' && x !== sel.value);
      sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); await sleep(1500); await wait('.stc-flt'); $('.stc-all')?.click(); await sleep(500);
      const s2 = $(`#stc-book select[data-catx="${id}"]`);
      ok(!!s2 && s2.value === v, '1. chọn nhóm → lưu ngay, dòng giữ nhóm mới');
    }
    // 2. Cần phân loại: chọn nhóm tại chỗ; Chi theo loại có loại + nhóm con
    // bước 164: Cần phân loại / Chi theo loại hiện khi bấm ô Các khoản chi
    await go(BASE + '&tab=chi&cot=chi');
    const hasTodo = $$('#stc-book .stc-sech').some((h) => txt(h).includes('cần phân loại'));
    ok(!hasTodo || !!$('#stc-book select[data-catx]'), '2. khung Cần phân loại chọn nhóm tại chỗ');
    const ty = $$('.stc-box').find((s) => txt(s.querySelector('h3')).startsWith('chi theo loại'));
    ok(!!ty && !!ty.querySelector('.stc-tyg .stc-tyh') && !!ty.querySelector('.stc-tyc') && !!ty.querySelector('.stc-bar i'), '2. khung Chi theo loại: loại · thanh tỉ lệ · nhóm con');
    // 3. ô Chênh lệch ghi số ca chờ xử lý (Sổ chi · TM có ca Tối 18/11 thiếu 30.000 chờ xử lý)
    const lt = $('.stc-tile[data-col="lech"]');
    ok(!!lt && /\d+ ca chờ xử lý/.test(txt(lt)), '3. ô Chênh lệch: "N ca chờ xử lý"');
    // 4. Ca thiếu tiền ở khung phải: bấm mở phiếu chênh lệch
    await go(BASE + '&tab=chi&cot=lech');   // bước 164: thay khung "Ca thiếu tiền" = bấm ô Chênh lệch
    const gb = $('#stc-book .stc-fr [data-gap]');
    ok(!!gb, '4. ô Chênh lệch (Sổ chi): ca thiếu tiền có nút "Phiếu chênh lệch"');
    if (gb) { gb.click(); await wait('dialog[open]', 40); await sleep(300); ok(!!$('dialog[open]'), '4. bấm → mở phiếu chênh lệch'); $('dialog[open] [data-x]')?.click(); await sleep(300); }
    // 5. Cho nợ: người nợ + trạng thái trên dòng
    await go(BASE + '&tab=chi&pm=ck'); $('.stc-all')?.click(); await sleep(500);
    const cn = $$('#stc-book .stc-it').find((i) => i.querySelector('[data-whox]') || /còn nợ|đã thu hết/.test(txt(i)));
    ok(!!cn && /(phiếu chốt ca sẽ nhắc thu|không nhắc thu)/.test(txt(cn)) && /(còn nợ|đã thu hết|đã thu)/.test(txt(cn)), '5. dòng Cho nợ: nhãn nhắc thu + trạng thái đã thu / còn nợ');
    const dg = $$('#stc-book .stc-it').find((i) => txt(i).includes('anh dũng'));
    ok(!!dg && txt(dg).includes('còn nợ 90.000') && !txt(dg).includes('đã thu 30.000') && !!dg.querySelector('[data-whox] option[value="__add"]'), '5. Anh Dũng (bước 159 trả một lần): "Còn nợ 90.000", không còn "đã thu một phần"; chọn người nợ có "+ Thêm người nợ…"');
    wide('5. Sổ chi');
    // 6. Quỹ ngoài (chỉ Chủ): Phần mỗi cơ sở chịu
    if (role === 'chu') {
      location.hash = '#/quan-ly/so-thu-chi?cn=ngoai&tab=chi&thang=2026-11&cot=chi&t=' + Date.now(); await sleep(500); await wait('.stc-flt'); await sleep(700);
      const sh = $$('.stc-box').find((s) => txt(s.querySelector('h3')).startsWith('phần mỗi cơ sở chịu'));
      ok(!!sh && $$('.stc-si', sh).length >= 2, '6. Quỹ ngoài › Sổ chi: khung Phần mỗi cơ sở chịu');
    }
  } catch (e) { bad.push('LỖI: ' + e.message); }
  out.push({ stc9: { ok: good, fail: bad } });
};
