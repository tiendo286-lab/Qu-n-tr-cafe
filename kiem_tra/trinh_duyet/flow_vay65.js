// Bước 65: đổi khoản chi thành cho vay (khoản quản lý tạo + khoản phiếu ca) ở Thu chi LHP; xoá khoản vay từ phiếu ca → khoản trở lại Thu chi. role=chu (điện thoại)
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const row = (t) => $$('.tc-r').find((x) => x.querySelector('strong')?.innerText.includes(t));
  const r = []; window.confirm = () => true;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc, sb } = await import('../js/sb.js');
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const lhp = (await rpc('app_ca_overview', { p_date: today })).find((x) => x.branch_code === 'LHP');
    await rpc('app_loan_person_save', { p_id: null, p_name: 'Anh Vay Đổi', p_phone: '', p_note: '', p_active: true });
    await rpc('app_tc_entry_save', { p_id: null, p: { branch_id: lhp.branch_id, entry_date: today, kind: 'chi', category_id: 1, note: 'nhập sc thử', amount: 925000, pay_method: 'tien_mat' } });
    await sb.from('shift_reports').insert({ id: 9961, branch_id: lhp.branch_id, work_date: today, shift: 'Tối', status: 'hoan_thanh', recon_status: 'chua', total_revenue: 1000000 });
    await sb.from('shift_report_moves').insert([{ id: 99611, report_id: 9961, kind: 'tien_mat', amount: -100000, note: 'Cho vay anh thử', sort_order: 1 }]);
    const go = async () => { location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/thu-chi?cn=' + lhp.branch_id; await wait('#tc-list', 600); await wait('.ln-sec', 300); await sleep(600); };
    await go();
    // 1) khoản quản lý tạo
    row('nhập sc thử').querySelector('strong').click(); await wait('dialog[open] form'); await sleep(200);
    r.push(`hộp sửa khoản quản lý tạo có nút: ${!!$('dialog[open] .tc-2loan')}`);
    $('dialog[open] .tc-2loan').click(); await sleep(800); await wait('dialog[open] form');
    let dl = $('dialog[open]'); r.push(`hộp đổi: ${txt('h2', dl)} · ${txt('.alert', dl)}`.slice(0, 220));
    dl.querySelector('[name=p]').value = [...dl.querySelector('[name=p]').options].find((o) => o.text.startsWith('Anh Vay Đổi')).value;
    dl.querySelector('[type=submit]').click(); for (let i = 0; i < 50 && $('dialog[open]'); i++) await sleep(100); await sleep(1500); await wait('.ln-p', 300); await sleep(300);
    r.push(`sau đổi: còn dòng Thu chi? ${!!row('nhập sc thử')} · Cho vay: ${$$('.ln-p').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ')} · báo ${txt('.alert')}`);
    // 2) khoản phiếu ca
    row('Cho vay anh thử').querySelector('strong').click(); await wait('dialog[open] form'); await sleep(200);
    $('dialog[open] .tc-2loan').click(); await sleep(800); await wait('dialog[open] form'); dl = $('dialog[open]');
    r.push(`hộp đổi khoản phiếu ca: ${txt('.alert', dl)}`.slice(0, 200));
    dl.querySelector('[name=p]').value = [...dl.querySelector('[name=p]').options].find((o) => o.text.startsWith('Anh Vay Đổi')).value;
    dl.querySelector('[type=submit]').click(); for (let i = 0; i < 50 && $('dialog[open]'); i++) await sleep(100); await sleep(1500); await wait('.ln-p', 300); await sleep(300);
    const x = row('Cho vay anh thử');
    r.push(`dòng phiếu ca sau đổi: ${x ? txt('.tc-x', x) + ' · ô ' + (x.querySelector('.tc-ok').innerText || 'trống') : 'KHÔNG THẤY'}`);
    $('.ln-sec details')?.setAttribute('open', ''); await sleep(100);
    r.push(`lịch sử vay: ${$$('.ln-l').map((y) => y.innerText.replace(/\s+/g, ' ')).join(' | ')}`.slice(0, 400));
    // 3) sửa khoản vay từ phiếu ca: số tiền bị khoá
    const ln = $$('.ln-l').find((y) => y.innerText.includes('từ phiếu ca'));
    ln.querySelector('.ln-ed').click(); await wait('dialog[open] form'); await sleep(200); dl = $('dialog[open]');
    r.push(`sửa khoản vay từ phiếu ca: ô số tiền khoá ${dl.querySelector('[name=amt]').disabled} · ${txt('.alert', dl)}`.slice(0, 200));
    dl.querySelector('[data-x]').click(); await sleep(200);
    // 4) xoá khoản vay từ phiếu ca → khoản trở lại Thu chi
    ln.querySelector('.ln-del').click(); await sleep(1500); await wait('.tc-r', 300); await sleep(600);
    const y = row('Cho vay anh thử');
    r.push(`sau xoá khoản vay: dòng ${y ? txt('.tc-x', y) + ' · ô ' + (y.querySelector('.tc-ok').innerText || 'trống') : 'KHÔNG THẤY'} · ${W()}`);
    // 5) bước 66: khoản từ phiếu chi chuyển khoản
    await sb.from('fin_entries').insert({ id: 99901, branch_id: lhp.branch_id, entry_date: today, kind: 'chi', category_id: 1, amount: 3456000, note: 'đơn thử (chuyển khoản từ VCB 999, ca Tối)', pay_method: 'chuyen_khoan', bank_out: true, created_by: 1 });
    await go();
    row('đơn thử').querySelector('strong').click(); await wait('dialog[open] form'); await sleep(200); dl = $('dialog[open]');
    r.push(`hộp sửa phiếu chi CK: ô tiền khoá ${dl.querySelector('[name=amt]').disabled} · có nút đổi ${!!dl.querySelector('.tc-2loan')} · ${txt('.alert', dl)}`.slice(0, 260));
    dl.querySelector('.tc-2loan').click(); await sleep(800); await wait('dialog[open] form'); dl = $('dialog[open]');
    r.push(`hộp đổi: ${txt('.alert', dl)}`.slice(0, 260));
    dl.querySelector('[name=p]').value = [...dl.querySelector('[name=p]').options].find((o) => o.text.startsWith('Anh Vay Đổi')).value;
    dl.querySelector('[type=submit]').click(); for (let i = 0; i < 50 && $('dialog[open]'); i++) await sleep(100); await sleep(1500); await wait('.ln-p', 300); await sleep(300);
    $('.ln-sec details')?.setAttribute('open', ''); await sleep(100);
    const lb = $$('.ln-l').find((y) => y.innerText.includes('đơn thử'));
    r.push(`sau đổi: còn ở Thu chi ${!!row('đơn thử')} · vay: ${lb ? lb.innerText.replace(/\s+/g, ' ').slice(0, 160) : 'KHÔNG THẤY'}`);
    lb.querySelector('.ln-ed').click(); await wait('dialog[open] form'); await sleep(200); dl = $('dialog[open]');
    r.push(`sửa vay từ phiếu chi CK: ô tiền khoá ${dl.querySelector('[name=amt]').disabled} · ${W()}`); dl.querySelector('[data-x]').click();
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'đổi thành cho vay', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
