// Bước 84, viết lại bước 160 (phiếu chốt ca một trang tiền + bước 159 khách trả nợ một lần):
// nhắc nợ đầu phiếu, Báo nợ HĐ khớp dòng Nợ trên phiếu Fabi, Thu nợ đưa thiếu → hỏi, khoản cũ trả đủ, phần còn thiếu thành Nợ TM mới trong ca;
// bỏ trả → nợ mới tự xoá; trả đủ không hỏi; không tràn ngang. role=nv (index.html + test/phone.html). Kết quả: out[].cm84 = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s) => (($(s) || {}).innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const setv = (el, v) => { if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const num = (k, v) => setv($(`.cm-num[data-f="${k}"]`), v);
  const next = async () => { $('#cm-next').click(); await sleep(900); };
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wide = (m) => ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `${m}: không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`);
  const asked = []; window.confirm = (m) => { asked.push(m); return true; };
  const debtRows = () => $$('.cm-debt').map((r) => ({ amt: (r.querySelector('[data-k="amount"]') || {}).value || '', kind: (r.querySelector('[data-dk][aria-pressed="true"]') || {}).dataset?.v || '' }));
  const payDebt = async (dId, how, amount) => {
    $('#cm-pick-debt').click(); await wait('dialog[open] #cp-list'); await sleep(400);
    const d = $('dialog[open]'); const am = $(`[data-paidamt="${dId}"]`, d); if (am && amount) setv(am, amount);
    const s = $(`[data-paid="${dId}"]`, d); if (!s) { bad.push(`không thấy khoản nợ ${dId} trong hộp Thu nợ`); $('#cp-close', d)?.click(); return; }
    s.value = how; s.dispatchEvent(new Event('change', { bubbles: true })); await sleep(2500); await wait('.cm-col'); await sleep(600);
    $$('dialog[open]').forEach((x) => x.close());
  };
  try {
    await wait('#root .page-head, #root h1, #root .appbar, #root .m-foot', 600); await sleep(2500);
    const { rpc, sb } = await import('../js/sb.js');
    for (const m of ['../js/nhap_hang.js', '../js/chot_ca_moi.js', '../js/pages/phieu_ca.js']) await Promise.race([import(m).catch(() => 0), sleep(4000)]);
    const t = new Date(Date.now() + 7 * 3600e3); const day = t.toISOString().slice(0, 10); const d0 = new Date(t.getTime() - 864e5).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day }); const br = ov[0].branch_id;
    // nợ cũ: Bàn 5 (HĐ 120.000), Anh Nam (TM 200.000), Chị Hoa (CK 300.000)
    await sb.from('shift_reports').insert([{ id: 9801, branch_id: br, work_date: d0, shift: 'Tối', status: 'hoan_thanh', recon_status: 'chua', total_revenue: 500000 }]);
    await sb.from('shift_debts').insert([{ id: 9811, branch_id: br, report_id: 9801, table_name: '5', amount: 120000, kind: 'bill' },
      { id: 9812, branch_id: br, report_id: 9801, table_name: 'Anh Nam', amount: 200000, kind: 'muon' },
      { id: 9813, branch_id: br, report_id: 9801, table_name: 'Chị Hoa', amount: 300000, kind: 'ck' }]);
    const id = await rpc('app_ca_open', { p_branch: br, p_date: day, p_shift: ov[0].shift });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id; await wait('.cm-col'); await sleep(800);
    $$('dialog[open]').forEach((d) => d.close());
    const nhac = txt('.pc-nhac').toLowerCase();
    ok(nhac.includes('3 khoản') && nhac.includes('620.000'), `1. đầu phiếu nhắc 3 khoản nợ · 620.000 (${nhac.slice(0, 60)})`);
    // phần việc: nhận chốt, giờ làm, Bàn giao → trang tiền
    $('#cm-claim').click(); await wait('.cm-person, #cm-helper'); await sleep(900);
    $$('dialog[open]').forEach((d) => d.close());
    if (!$$('.cm-person').length) { $('[data-hp="in"]')?.click(); for (let i = 0; i < 100 && !$('[data-add-emp]'); i++) await sleep(50); $('[data-add-emp]')?.click(); await sleep(300); }
    $$('[data-t]').forEach((i) => { if (!i.value) setv(i, i.dataset.k === 'time_in' ? '06:45' : '12:45'); });
    await next(); await next();
    ok(!!$('#cm-pick-debt') && !!$('#cm-add-debt') && !!$('.cm-num[data-f="pos_debt"]'), '2. vào trang tiền: có ô Nợ trên phiếu, nút + Thu nợ, + Báo nợ');
    // Fabi + Báo nợ HĐ khớp
    if ($('#cm-open') && !$('#cm-open').readOnly) setv($('#cm-open'), day + 'T06:40');
    setv($('#cm-close'), day + 'T12:39');
    num('ipos_opening', '1000000'); num('total_revenue', '7000000'); num('pos_transfer', '2400000'); num('pos_cash', '4500000'); num('pos_debt', '100000'); num('cash_counted', '5400000');
    $('#cm-add-debt').click(); await sleep(400); const i0 = $$('[data-db][data-k="amount"]').length - 1;
    setv($(`[data-db="${i0}"][data-k="table_name"]`), '3'); setv($(`[data-db="${i0}"][data-k="amount"]`), '100000');
    $(`[data-dk="${i0}"][data-v="bill"]`).click(); await sleep(400);
    ok(txt('#cm-debt-sum').includes('100.000') && txt('#cm-debt-sum').includes('✅'), `3. Báo nợ HĐ 100.000 = Nợ trên phiếu Fabi (${txt('#cm-debt-sum').slice(0, 60)})`);
    // Thu nợ đưa thiếu: Bàn 5 nợ 120.000, khách đưa 100.000
    asked.length = 0;
    await payDebt(9811, 'tien_mat', '100.000');
    ok(asked.some((m) => /đưa thiếu 20\.000/.test(m)), '4. Bàn 5 đưa thiếu 20.000 → web hỏi trước');
    const paid5 = $$('.cm-paid').find((r) => r.innerText.includes('5'));
    ok(!!paid5 && /120\.000/.test(paid5.innerHTML), '4. khoản cũ Bàn 5 ghi trả đủ 120.000');
    ok(debtRows().some((r) => r.amt === '20.000' && r.kind === 'muon'), `4. nợ mới 20.000 loại TM trong ca (${JSON.stringify(debtRows())})`);
    wide('4. trang tiền');
    // bỏ trả → nợ mới tự xoá
    $('[data-unpay="9811"]')?.click(); await sleep(2500); await wait('.cm-col'); await sleep(600);
    ok(!$('[data-unpay="9811"]') && !debtRows().some((r) => r.amt === '20.000'), '5. bỏ trả Bàn 5 → khoản cũ mở lại, nợ mới 20.000 tự xoá');
    // trả đủ: không hỏi
    asked.length = 0;
    await payDebt(9813, 'chuyen_khoan', null);
    ok(!asked.length && !!$('[data-unpay="9813"]'), '6. Chị Hoa trả đủ chuyển khoản → không hỏi, ghi Thu nợ');
    if ($('#cm-hot')) setv($('#cm-hot'), '2700000');
    wide('6. trang tiền');
  } catch (e) { bad.push('LỖI: ' + (e.message || e)); }
  out.push({ cm84: { ok: good, fail: bad } });
};
