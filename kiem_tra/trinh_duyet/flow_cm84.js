// Bước 84: phiếu chốt ca phần tiền mới — Khách nợ trong ca (HĐ / TM / CK), Thu chi 2 phần, hotline trừ Nợ CK,
// Kết quả tiền & gửi phiếu (bảng từng dòng), lệch không bắt ghi lý do. role=nv, khung điện thoại (test/phone.html)
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => { const w = document.documentElement.clientWidth; const wide = $$('#root *').filter((el) => el.offsetParent && el.getBoundingClientRect().right > w + 1).map((el) => el.tagName + '.' + el.className).slice(0, 3); return `rộng ${w}/${document.documentElement.scrollWidth}${wide.length ? ' tràn: ' + wide.join(',') : ''}`; };
  const setv = (el, v) => { if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const typ = (el, v) => { if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const num = (k, v) => setv($(`.cm-num[data-f="${k}"]`), v);
  const next = async () => { $('#cm-next').click(); await sleep(900); };
  const r = []; const STOP = new URLSearchParams(location.search).get('dung');
  const halt = (k) => { if (STOP !== k) return false; window.scrollTo(0, 0); out.push({ route: 'cm84', title: r.join(' || ') + ` h=${document.documentElement.scrollHeight}`, len: 0, errs: [...window.__ERR] }); return true; };
  try {
    await wait('#root .page-head, #root h1, #root .appbar, #root .m-foot', 600); await sleep(2500);
    const { rpc, sb } = await import('../js/sb.js');
    for (const m of ['../js/nhap_hang.js', '../js/chot_ca_moi.js', '../js/pages/phieu_ca.js']) await Promise.race([import(m).catch(() => 0), sleep(4000)]);
    const t = new Date(Date.now() + 7 * 3600e3); const day = t.toISOString().slice(0, 10); const d0 = new Date(t.getTime() - 864e5).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day }); const br = ov[0].branch_id;
    // nợ cũ: Bàn 5 (HĐ), Anh Nam (TM), Chị Hoa (CK)
    await sb.from('shift_reports').insert([{ id: 9801, branch_id: br, work_date: d0, shift: 'Tối', status: 'hoan_thanh', recon_status: 'chua', total_revenue: 500000 }]);
    await sb.from('shift_debts').insert([{ id: 9811, branch_id: br, report_id: 9801, table_name: '5', amount: 120000, kind: 'bill' },
      { id: 9812, branch_id: br, report_id: 9801, table_name: 'Anh Nam', amount: 200000, kind: 'muon' },
      { id: 9813, branch_id: br, report_id: 9801, table_name: 'Chị Hoa', amount: 300000, kind: 'ck' }]);
    const id = await rpc('app_ca_open', { p_branch: br, p_date: day, p_shift: ov[0].shift });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id; await wait('.cm-col'); await sleep(800);
    $$('dialog[open]').forEach((d) => d.close());
    r.push(`nhắc đầu phiếu: ${txt('.pc-nhac')}`);
    $('#cm-claim').click(); await wait('.cm-person, #cm-helper'); await sleep(900);
    $$('dialog[open]').forEach((d) => d.close());
    if (!$$('.cm-person').length) { $('[data-hp="in"]')?.click(); for (let i = 0; i < 100 && !$('[data-add-emp]'); i++) await sleep(50); $('[data-add-emp]')?.click(); await sleep(300); }
    $$('[data-t]').forEach((i) => { if (!i.value) setv(i, i.dataset.k === 'time_in' ? '06:45' : '12:45'); });
    r.push(`Ai làm ca: ô lương tiền mặt ${$$('[data-cash]').length} · nhãn trả lương TM ${$$('.cm-person .pill.info').length}`);
    await next(); await next();   // Ai làm ca → Bàn giao → Phiếu Fabi
    r.push(`phần tiền: ${$$('.cm-part')[1]?.innerText.replace(/\s+/g, ' ')} · ${txt('#cm-root h2')}`);
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 60; cv.getContext('2d').fillRect(0, 0, 40, 60);
    const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'phieu.jpg', { type: 'image/jpeg' }));
    const inp = $('#cm-photo'); inp.files = dt.files; inp.dispatchEvent(new Event('change')); await sleep(1500);
    r.push(`khách trả nợ cũ: ${txt('#cm-body h3')} · ${$$('#cm-body .cm-person strong').map((x) => x.innerText).join(' | ')}`);
    for (const [dId, how] of [[9811, 'tien_mat'], [9812, 'tien_mat'], [9813, 'chuyen_khoan']]) { const s = $(`[data-paid="${dId}"]`); if (s) { s.value = how; s.dispatchEvent(new Event('change')); await sleep(1500); } }
    if ($('#cm-open')) setv($('#cm-open'), '06:40');
    setv($('#cm-close'), '12:39');
    num('ipos_opening', '1000000'); num('total_revenue', '7000000'); num('pos_transfer', '2400000'); num('pos_cash', '4500000'); num('pos_debt', '100000'); num('cash_counted', '5400000');
    $('[data-sign="-1"]')?.click(); await sleep(300); num('pos_diff', '220000'); await sleep(400);
    r.push(`Fabi: ${txt('#cm-checks')}`);
    if (halt('fabi')) return;
    await next();
    r.push(`bước 2: ${txt('#cm-root h2')} · ${txt('.cm-dkk').slice(0, 60)}…`);
    await next(); r.push(`Tiếp khi chưa ghi nợ: ${txt('#cm-err')}`);
    for (const [nm, am, k] of [['3', '100000', 'bill'], ['Bàn 9', '100000', 'muon'], ['Bàn 7', '150000', 'ck']]) {
      $('#cm-add-debt').click(); await sleep(300); const i = $$('[data-db][data-k="table_name"]').length - 1;
      setv($(`[data-db="${i}"][data-k="table_name"]`), nm); setv($(`[data-db="${i}"][data-k="amount"]`), am);
      if (nm === 'Bàn 7') { await next(); r.push(`chưa chọn loại: ${txt('#cm-err')}`); }
      $(`[data-dk="${i}"][data-v="${k}"]`).click(); await sleep(300);
    }
    r.push(`ô kiểm nợ: ${txt('#cm-debt-sum')} · ${W()}`);
    if (halt('no')) return;
    await next();
    r.push(`bước 3: ${txt('#cm-root h2')} · ${$$('#cm-body h3').map((h) => h.innerText).join(' / ')} · nút ${$$('#cm-add-move, #cm-add-ckmove').length}`);
    $('#cm-add-move').click(); await sleep(250); setv($('[data-mv="0"][data-k="note"]'), 'Mua đá'); setv($('[data-mv="0"][data-k="amount"]'), '150000');
    $('#cm-add-move').click(); await sleep(250); setv($('[data-mv="1"][data-k="note"]'), 'Bán bìa carton'); setv($('[data-mv="1"][data-k="amount"]'), '50000'); $('[data-mt="1"][data-v="1"]').click(); await sleep(250);
    $('#cm-add-move').click(); await sleep(250); setv($('[data-mv="2"][data-k="note"]'), 'Chi lương Quang hỗ trợ'); setv($('[data-mv="2"][data-k="amount"]'), '200000');
    r.push(`thu chi: ${$$('#cm-body .cm-person').length} dòng · ${W()}`);
    if (halt('tc')) return;
    await next();
    r.push(`bước 4: ${txt('#cm-root h2')}`);
    typ($('#cm-hot'), '2550000'); await sleep(400);
    r.push(`hotline: ${txt('#cm-ck-box')}`);
    if (halt('hl')) return;
    await next();
    r.push(`bước 5: ${txt('#cm-root h2')} · phần tiền ${$$('.cm-part')[1]?.innerText.replace(/\s+/g, ' ')} · nút ${txt('#cm-next')}`);
    r.push(`tiền mặt: ${$$('.cm-rc')[0]?.innerText.replace(/\s+/g, ' ').slice(0, 420)}`);
    r.push(`chuyển khoản: ${$$('.cm-rc')[1]?.innerText.replace(/\s+/g, ' ').slice(0, 330)} · ${W()}`);
    if (halt('kq')) return;
    await next(); await sleep(1500);
    const R2 = await rpc('app_ca_get', { p_id: id });
    r.push(`GỬI (không ghi lý do) → ${R2.status} · nợ ${R2.debts.map((d) => `${d.table_name}:${d.kind}`).join(',')} · thu chi ${R2.moves.map((m) => m.amount).join(',')} · ${txt('#cm-err') || 'không lỗi'}`);
  } catch (e) { r.push('LỖI ' + (e.stack || e)); }
  out.push({ route: 'chốt ca 84', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
