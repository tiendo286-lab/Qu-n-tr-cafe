// Bước 81: Công nợ gia đình — Cài đặt › Người vay có ô "Công nợ gia đình"; Thu chi › Công nợ: nút "→ Gia đình" chuyển Nợ TM của ca
// thành khoản cho vay của người gia đình (khoản nợ ca biến mất, phiếu không nhắc); xoá khoản cho vay = hoàn tác. role=chu (điện thoại, confirm=1)
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const closed = async () => { for (let i = 0; i < 50 && $('dialog[open]'); i++) await sleep(100); await sleep(1500); await wait('.ln-sec', 300); await sleep(300); };
  const r = []; window.confirm = () => true;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc, sb } = await import('../js/sb.js');
    const t = new Date(Date.now() + 7 * 3600e3); const d0 = new Date(t.getTime() - 864e5).toISOString().slice(0, 10);
    // 1) Cài đặt › Người vay: thêm người gia đình
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/cai-dat/nguoi-vay'; await wait('#lp-add', 300); await sleep(500);
    $('#lp-nn').value = 'Người nhà thử'; $('#lp-nf').checked = true; $('#lp-add').click(); await sleep(1500); await wait('.lp-r', 200);
    r.push(`người vay: ${$$('.lp-r').map((x) => `${x.querySelector('.lp-n').value}${x.querySelector('.lp-f').checked ? ' [gia đình]' : ''}`).join(', ')} · ${W()}`);
    // 2) phiếu ca hôm qua có Nợ TM chưa trả
    await sb.from('shift_reports').insert([{ id: 9801, branch_id: 1, work_date: d0, shift: 'Sáng', status: 'hoan_thanh', recon_status: 'chua', total_revenue: 500000 }]);
    await sb.from('shift_debts').insert([{ id: 9811, branch_id: 1, report_id: 9801, table_name: 'Bác Thử', amount: 180000, kind: 'muon' }]);
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/thu-chi?cn=1'; await wait('.ln-sec', 600); await sleep(800);
    const row = () => $$('.cn-row').find((x) => /Bác Thử/.test(x.innerText));
    r.push(`Công nợ trước: ${row()?.innerText.replace(/\s+/g, ' ') || 'KHÔNG THẤY'} · nút → Gia đình: ${!!row()?.querySelector('.cn-fam')}`);
    row().querySelector('.cn-fam').click(); await wait('dialog[open] form'); await sleep(300); const dl = $('dialog[open]');
    r.push(`hộp: ${txt('h2', dl)} · chọn: ${[...dl.querySelectorAll('[name=p] option')].map((o) => o.innerText).join(', ')}`);
    dl.querySelector('[type=submit]').click(); await closed();
    r.push(`sau chuyển: còn dòng Bác Thử ${!!row()} · người: ${$$('.ln-p').map((x) => x.innerText.replace(/\s+/g, ' ')).filter((s) => /Người nhà/.test(s)).join(' | ') || 'KHÔNG THẤY'}`);
    const L = (await rpc('app_loans', { p_branch: 1 })).loans.find((l) => l.from_debt === 9811);
    r.push(`khoản cho vay: ${L ? `${L.note} ${L.amount} từ phiếu ${L.report_id}` : 'KHÔNG CÓ'} · nợ ca: ${JSON.stringify((await sb.from('shift_debts').select('*').eq('id', 9811)).data?.[0]?.collect_kind ?? null)}`);
    // 3) bảng tuần ghi "→ công nợ gia đình"
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca?cn=1'; await wait('.cw-t', 600); await sleep(800);
    r.push(`bảng tuần: ${$$('.cw-t .nl').map((b) => b.innerText).filter((s) => /Bác Thử/.test(s)).join(' | ')} · dưới bảng: ${$$('.nd-r').map((x) => x.innerText.replace(/\s+/g, ' ')).filter((s) => /Bác Thử/.test(s)).join(' | ')}`);
    // 4) hoàn tác: xoá khoản cho vay → nợ ca mở lại
    await rpc('app_loan_delete', { p_id: L.id });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/thu-chi?cn=1'; await wait('.ln-sec', 600); await sleep(800);
    r.push(`hoàn tác: dòng Bác Thử lại có ${!!row()} · ${W()}`);
  } catch (e) { r.push('LỖI ' + e.message); }
  out.push({ route: 'công nợ gia đình 81', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
