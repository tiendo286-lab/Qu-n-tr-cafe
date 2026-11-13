// Bước 64: Cho vay (LHP) — Cài đặt › Người vay → Thu chi LHP: Cho vay → Ghi trả nợ (trả dần) → còn nợ. role=chu (confirm=1, điện thoại)
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const typ = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc } = await import('../js/sb.js');
    location.hash = '#/cai-dat/nguoi-vay'; await wait('#lp-add'); await sleep(300);
    r.push(`Cài đặt › Người vay: ${txt('#root h1')} · menu ${txt('.hub-tabs a.on')}`);
    typ($('#lp-nn'), 'Anh Thử Vay'); typ($('#lp-np'), '0900000001'); $('#lp-add').click(); await sleep(1200); await wait('.lp-r');
    r.push(`Đã thêm: ${$$('.lp-r').map((x) => x.querySelector('.lp-n').value).join(', ')}`);
    const lhp = (await rpc('app_ca_overview', { p_date: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10) })).find((x) => x.branch_code === 'LHP');
    await sleep(800); location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/thu-chi?cn=' + lhp.branch_id; await wait('#tc-list', 600); await wait('.ln-sec', 300); await sleep(500);
    r.push(`Thu chi LHP: ${txt('.ln-sec .ln-h')} · ${txt('.ln-sec > .st-meta')}`);
    if (!$('.ln-sec')) r.push(`DÒ: app_loans(${lhp.branch_id}) = ${JSON.stringify(await rpc('app_loans', { p_branch: lhp.branch_id }).catch((e) => e.message)).slice(0, 200)} · tc-loans ${!!$("#tc-loans")} · ${location.hash} · h1 ${txt("#root h1")} · lỗi ${window.__ERR.join(" ; ").slice(0, 300)}`);
    $('.ln-new').click(); await wait('dialog[open] form'); await sleep(200);
    let dl = $('dialog[open]'); typ(dl.querySelector('[name=amt]'), '2000000'); dl.querySelector('[name=note]').value = 'vay mua hàng';
    dl.querySelector('[type=submit]').click(); for (let i = 0; i < 50 && $('dialog[open]'); i++) await sleep(100); await sleep(1500); await wait('.ln-p');
    r.push(`Sau cho vay: ${txt('.ln-p')}`);
    $('.ln-pay-btn').click(); await wait('dialog[open] form'); await sleep(200);
    dl = $('dialog[open]'); r.push(`Hộp trả nợ: gợi ý ${dl.querySelector('[name=amt]').value}`);
    typ(dl.querySelector('[name=amt]'), '500000'); dl.querySelector('[type=submit]').click(); for (let i = 0; i < 50 && $('dialog[open]'); i++) await sleep(100); await sleep(1500); await wait('.ln-p');
    r.push(`Sau trả 500.000: ${txt('.ln-p')} · ${txt('.ln-sec .ln-h .st-meta')}`);
    $('.ln-sec details')?.setAttribute('open', ''); await sleep(100);
    r.push(`Lịch sử: ${$$('.ln-l').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ')} · ${W()}`);
    // bước 65: sửa khoản vay + sửa lần trả
    $('.ln-ed').click(); await wait('dialog[open] form'); await sleep(200); dl = $('dialog[open]');
    typ(dl.querySelector('[name=amt]'), '300000'); dl.querySelector('[type=submit]').click(); await sleep(800);
    r.push(`Sửa vay nhỏ hơn số đã trả: ${txt('.ln-err', dl)}`);
    typ(dl.querySelector('[name=amt]'), '2500000'); dl.querySelector('[type=submit]').click(); for (let i = 0; i < 50 && $('dialog[open]'); i++) await sleep(100); await sleep(1500); await wait('.ln-p');
    r.push(`Sau sửa vay 2.500.000: ${txt('.ln-p')}`);
    $('.ln-sec details')?.setAttribute('open', ''); await sleep(100);
    $('.ln-ped').click(); await wait('dialog[open] form'); await sleep(200); dl = $('dialog[open]');
    typ(dl.querySelector('[name=amt]'), '700000'); dl.querySelector('[type=submit]').click(); for (let i = 0; i < 50 && $('dialog[open]'); i++) await sleep(100); await sleep(1500); await wait('.ln-p');
    r.push(`Sau sửa lần trả 700.000: ${txt('.ln-p')} · ${W()}`);
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/thu-chi?cn=' + ((await rpc('app_ca_overview', { p_date: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10) })).find((x) => x.branch_code !== 'LHP').branch_id); await wait('.tc-r, #tc-empty'); await sleep(800);
    r.push(`Thu chi cơ sở khác có khung Cho vay: ${!!$('.ln-sec')}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'cho vay LHP', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
