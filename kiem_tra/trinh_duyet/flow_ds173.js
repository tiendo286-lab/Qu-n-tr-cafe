// Bước 173 (đợt C): máy Fabi ghi sai — "Sai, sửa số" ở bước 1, chờ Chủ duyệt, Chủ duyệt / từ chối. Chạy role chu / qlt / ql, index.html và test/phone.html.
//  Ca 182 (chưa xác nhận Fabi): ô Nợ bill đỏ (máy ghi nhiều hơn phiếu).
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wait = async (s, n = 60) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const gone = async (s, n = 60) => { for (let i = 0; i < n && $(s); i++) await sleep(100); return !$(s); };
  const wide = (m) => ok(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, m + ': không tràn ngang');
  const type = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const calls = (fn, from = 0) => (window.__LOG || []).slice(from).filter((x) => x[0] === 'rpc' && x[1] === fn).map((x) => x[2]);
  const role = new URLSearchParams(location.search).get('role');
  const DS = '#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11';
  // trang giữ sổ tháng 60 giây → mở tháng khác trước để lấy dữ liệu mới (sau khi bộ thử tự sửa dữ liệu giả)
  const open = async (b = 1) => { location.hash = '#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-10&t=' + Date.now(); await sleep(500);
    location.hash = DS + '&ds=182&b=' + b + '&t=' + Date.now(); await sleep(400); await wait('.stc-dsp'); await sleep(500); };
  const box = () => $('.stc-dsp .stc-c4[data-k="no"]');
  const dlg = () => $('dialog[open]');
  const redraw = async () => { await sleep(900); await wait('.stc-dsp'); await sleep(350); };
  const sb = (await import('/js/sb.js')).sb;
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    await open();
    ok(box()?.classList.contains('red') && !!box()?.querySelector('[data-dsfix="no"]'), 'ô Nợ bill đỏ có nút "Sai, sửa số"');
    box().querySelector('[data-dsfix="no"]').click(); await wait('dialog[open] [name=fval]', 40); await sleep(200);
    ok(!!$('[name=fval]', dlg()) && !!$('[name=reason]', dlg()), 'hộp Sửa số: ô số đúng + lý do');
    wide('hộp sửa số');
    let k0 = (window.__LOG || []).length;
    type($('[name=fval]', dlg()), '77.000'); $('button[type=submit]', dlg()).click(); await sleep(600);
    ok(calls('app_stc_fix_request', k0).length === 0 && !!dlg(), 'chưa ghi lý do → chưa gửi');
    type($('[name=reason]', dlg()), 'Máy không ghi nợ bàn 4'); $('button[type=submit]', dlg()).click(); await gone('dialog[open] [name=fval]', 40); await redraw();
    const c1 = calls('app_stc_fix_request', k0);
    ok(c1.length === 1 && Number(c1[0].p_report) === 182 && c1[0].p_field === 'no' && Number(c1[0].p?.val) === 77000 && c1[0].p_reason === 'Máy không ghi nợ bàn 4', 'gửi đúng ca, ô, số, lý do');
    if (role === 'chu') {
      ok(box()?.classList.contains('ok') && txt(box()).includes('chủ đã duyệt') && !!box().querySelector('[data-dsfixcancel]'), 'Chủ gửi → duyệt ngay: ô xanh "Chủ đã duyệt", có nút Bỏ số đã duyệt');
      k0 = (window.__LOG || []).length; box().querySelector('[data-dsfixcancel]').click(); await redraw();
      ok(calls('app_stc_fix_cancel', k0).length === 1 && box()?.classList.contains('red'), 'Chủ bỏ số đã duyệt → ô về đỏ');
      // quản lý đã gửi (tạo bằng lối riêng của bộ thử) → Chủ thấy Duyệt / Từ chối
      await sb.rpc('app__thu_fix_cho', { p_report: 182, p_field: 'no', p: { val: 77000 } }); await open();
      ok(txt(box()).includes('chờ chủ duyệt') && !!box().querySelector('[data-dsfixok]') && !!box().querySelector('[data-dsfixno]'), 'Chủ thấy số sửa chờ duyệt + nút Duyệt / Từ chối');
      box().querySelector('[data-dsfixno]').click(); await wait('dialog[open] [name=fnote]', 40); await sleep(200);
      k0 = (window.__LOG || []).length; type($('[name=fnote]', dlg()), 'Xem lại camera'); $('button[type=submit]', dlg()).click(); await gone('dialog[open] [name=fnote]', 40); await redraw();
      const c2 = calls('app_stc_fix_decide', k0);
      ok(c2.length === 1 && c2[0].p_ok === false && c2[0].p_note === 'Xem lại camera', 'Từ chối → gửi đúng, kèm lý do');
      ok(txt(box()).includes('chủ từ chối') && !!box().querySelector('[data-dsfix="no"]') && !!box().querySelector('[data-dsfixfabi]'), 'bị từ chối: ô ghi "Chủ từ chối", có Sửa lại số + Bỏ sửa, lấy số máy Fabi');
      await sb.rpc('app__thu_fix_cho', { p_report: 182, p_field: 'no', p: { val: 77000 } }); await open();
      k0 = (window.__LOG || []).length; box().querySelector('[data-dsfixok]').click(); await redraw();
      ok(calls('app_stc_fix_decide', k0)[0]?.p_ok === true && box()?.classList.contains('ok'), 'Duyệt → ô xanh');
    } else {
      ok(txt(box()).includes('chờ chủ duyệt') && !box().querySelector('[data-dsfixok]') && !!box().querySelector('[data-dsfixcancel]'), 'quản lý: ô ghi "chờ Chủ duyệt", có Bỏ sửa, không có nút Duyệt');
      ok(!box().querySelector('[data-dsfabi]'), 'đang chờ duyệt thì ẩn "Lấy số máy Fabi"');
      await open(2); ok(txt($('.stc-dsp')).includes('số sửa chờ chủ duyệt') && $('.stc-dsp [data-dsclose]')?.disabled === true, 'bước 2: nút Xác nhận Fabi khoá, ghi còn thiếu "số sửa chờ Chủ duyệt"'); await open(1);
      k0 = (window.__LOG || []).length; box().querySelector('[data-dsfixcancel]').click(); await redraw();
      ok(calls('app_stc_fix_cancel', k0).length === 1 && !!box()?.querySelector('[data-dsfix="no"]'), 'Bỏ sửa → về ô đỏ có "Sai, sửa số"');
    }
    wide('ô bước 1 sau khi sửa số');
  } catch (e) { bad.push('LỖI CHẠY: ' + (e?.message || e)); }
  out.push({ ds173: { ok: good, fail: bad } });
};
