// Chặng 3 (anh Tiến chốt 22/11/2026, máy chủ tệp 160): "Đổi thành Luân chuyển TM – CK" trong hộp Sửa / Xoá khoản của ca.
// Ca Sáng 18/11 (181) đã xác nhận Fabi → bỏ dấu Hoàn thành (như bấm Mở lại ở bước 6) → Sổ chi tiền mặt: "Mua đá" 50.000 → Sửa / Xoá → nút đổi
// (chưa ghi lý do thì báo) → ghi lý do → đổi: dòng thành Luân chuyển, hết nút sửa; Sổ thu chuyển khoản có vế ngược lại.
// Chạy: index.html?auto=1&role=chu|qlt|ql&script=flow_stc17&confirm=1 và test/phone.html?... Kết quả: out[].stc17 = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const dlg = () => $('dialog[open]');
  const setv = (sel, v) => { const el = $(sel, dlg() || document); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const { rpc } = await import('../js/sb.js');
  const book = async (tab, pm) => {
    location.hash = '#/__tam'; await sleep(200); location.hash = `#/quan-ly/so-thu-chi?tab=${tab}&cn=1&thang=2026-11&pm=${pm}`;
    await sleep(300); await wait('.stc-pay'); await sleep(500); $('.stc-all')?.click(); await sleep(300);
  };
  const lc = (t) => $$('.stc-it:not(.void)').find((i) => txt(i).includes(t) && $('.stc-tag.t-lc', i));
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    await rpc('app_stc_ds_undone', { p_report: 181 });
    await book('chi', 'tm');
    const ed = $('button.stc-ed[data-ed="m:181:k52"]');
    ok(!!ed, '1. ca Sáng 18/11 chưa Hoàn thành → khoản "Mua đá" có nút Sửa / Xoá');
    ed.click(); await wait('dialog[open]', 30); await sleep(250);
    ok(!!$('.stc-2lc', dlg()) && txt($('.stc-lc', dlg())).includes('thêm vế chuyển khoản +50.000') && txt($('.stc-lc', dlg())).includes('không tính là chi phí'),
      '2. hộp sửa có nút "Đổi thành Luân chuyển TM – CK" + giải thích thêm vế chuyển khoản +50.000');
    if (window.innerWidth <= 400) {
      const r = dlg().getBoundingClientRect();
      ok(document.documentElement.scrollWidth <= window.innerWidth + 1 && r.right <= window.innerWidth + 1, `2b. hộp sửa không tràn ngang (${Math.round(r.right)}/${window.innerWidth})`);
    }
    $('.stc-2lc', dlg()).click(); await sleep(600);
    ok(!!dlg() && txt($('.stc-err', dlg())).includes('lý do'), '3. chưa ghi lý do → báo "Ghi lý do", hộp vẫn mở');
    setv('[name=reason]', 'Khách chuyển khoản để rút tiền mặt'); $('.stc-2lc', dlg()).click(); await sleep(1000);
    ok(!dlg(), '4. ghi lý do → đổi xong, hộp đóng');
    await book('chi', 'tm');
    const r1 = lc('mua đá');
    ok(!!r1 && txt(r1).includes('50.000'), '5. Sổ chi tiền mặt: "Mua đá" 50.000 thành Luân chuyển');
    ok(!!r1 && !$('button.stc-ed', r1) && !$('button.stc-ed[data-ed="m:181:k52"]'), '5b. dòng đã đổi không còn nút Sửa / Xoá');
    await book('thu', 'ck');
    const r2 = lc('mua đá');
    ok(!!r2 && txt(r2).includes('50.000'), '6. Sổ thu chuyển khoản: có vế ngược lại "Mua đá" 50.000 ở cột Luân chuyển');
    if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `7. không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`);
  } catch (e) { bad.push('LỖI CHẠY: ' + e.message + ' · ' + $$('dialog[open] .stc-err').map(txt).join(' | ')); }
  out.push({ stc17: { ok: good, fail: bad } });
};
