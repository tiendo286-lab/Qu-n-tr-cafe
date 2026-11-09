// Ca FULL TIME gộp vào ca chính (LHP): thêm 2 ca FT vào dữ liệu giả lập rồi kiểm tra
//  role=chu: Xếp lịch cơ sở (FT hiện trong Sáng + Chiều, tổng ca tính cả FT, ô chọn có nút FULL TIME), Lịch tổng (3 cột/ngày), Báo cáo (không cảnh báo "thừa" ở ca FT)
//  role=nv : Order ca (FT là dòng con dưới ca chính; FT "Đi làm được" → ca chính "Đi làm được"; ca chính "Nghỉ" → FT "Nghỉ")
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const log = (route, title, errs = []) => out.push({ route, title: String(title).slice(0, 700), len: 0, errs });
  const step = async (name, fn) => { window.__ERR.length = 0; let r = ''; try { r = await fn(); } catch (e) { window.__ERR.push('flow: ' + e.stack); } log(name, r || '', [...window.__ERR, ...$$('#root .alert.error').map((a) => 'page: ' + a.textContent.trim())]); };
  const { sb } = await import('../js/sb.js');
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
  const W = 169; const LHP = 1;
  // dữ liệu: 2 ca FULL TIME chỉ bật ở LHP
  await sb.from('shifts').insert([{ id: 4, code: 'FS', name: 'FULL TIME CA SÁNG', status: 'Đang sử dụng', sort_order: 3 }, { id: 5, code: 'FT', name: 'FULL TIME CA TỐI', status: 'Đang sử dụng', sort_order: 4 }]);
  await sb.from('branch_shifts').insert([{ branch_id: LHP, shift_id: 4, enabled: 1, start_time: '06:45', end_time: '15:00', sort_order: 3 }, { branch_id: LHP, shift_id: 5, enabled: 1, start_time: '15:00', end_time: '23:00', sort_order: 4 }]);
  const wide = () => { const w = document.documentElement.clientWidth; return `rộng ${w} / trang ${document.documentElement.scrollWidth}`; };

  if (role === 'nv') {
    localStorage.setItem('test_open', '1');
    const t = new Date(Date.now() + 7 * 3600e3); const dow = (t.getUTCDay() + 6) % 7;
    const next = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - dow + 7)).toISOString().slice(0, 10);
    const { data: ws } = await sb.from('weeks').select('*');
    if (!ws.some((w) => w.start_date === next)) await sb.from('weeks').insert({ id: 900, start_date: next, end_date: next });
    await step('Order: FULL TIME là dòng con ngay dưới ca chính', async () => {
      location.hash = '#/__tam'; await sleep(200); location.hash = '#/order'; await wait('.order-row', 300); await sleep(500);
      const day0 = $$('.order-row').filter((r) => r.dataset.d === '0').map((r) => r.querySelector('.sn').textContent.trim());
      return `ngày T2: ${day0.join(' · ')} · số dòng FT cả tuần: ${$$('.order-row.ft').length} · ${wide()}`;
    });
    await step('Chọn FT Sáng "Đi làm được" → Sáng tự "Đi làm được"; chọn Sáng "Nghỉ" → FT Sáng tự "Nghỉ"', async () => {
      const row = (s) => $$('.order-row').find((r) => r.dataset.d === '0' && r.dataset.s === s);
      const st = (s) => row(s).querySelector('.opt:checked')?.value || '—';
      row('Sáng').querySelector('.opt[value=off]').click(); await sleep(100);
      row('FULL TIME CA SÁNG').querySelector('.opt[value=ok]').click(); await sleep(100);
      const a = `sau khi chọn FT Sáng ok: Sáng=${st('Sáng')}, FT Sáng=${st('FULL TIME CA SÁNG')}`;
      row('Sáng').querySelector('.opt[value=off]').click(); await sleep(100);
      const b = `sau khi chọn Sáng nghỉ: Sáng=${st('Sáng')}, FT Sáng=${st('FULL TIME CA SÁNG')}`;
      row('FULL TIME CA TỐI').querySelector('.opt[value=ok]').click(); await sleep(100);
      return `${a} · ${b} · FT Tối ok → Tối=${st('Tối')}`;
    });
    return;
  }

  // xếp sẵn: 1 người FT Sáng, 1 người FT Tối ngày Thứ 2 ở LHP
  const { data: eb } = await sb.from('employee_branches').select('*');
  const { data: er } = await sb.from('employee_roles').select('*');
  const { data: wse } = await sb.from('weekly_schedule_entries').select('*');
  const busy = new Set(wse.filter((r) => r.week_id === W && r.weekday === 0 && r.state === 'ĐÃ XẾP').map((r) => r.employee_id));
  const { data: emAll } = await sb.from('employees').select('*'); const act = new Set(emAll.filter((x) => x.status === 'Đang làm').map((x) => x.id));
  const cand = eb.filter((r) => r.branch_id === LHP && act.has(r.employee_id) && !busy.has(r.employee_id) && er.some((x) => x.employee_id === r.employee_id && x.role === 'Pha chế')).map((r) => r.employee_id);
  const [e1, e2] = cand;
  await sb.from('weekly_schedule_entries').insert([
    { week_id: W, employee_id: e1, weekday: 0, shift: 'FULL TIME CA SÁNG', base_status: 'ĐI LÀM ĐƯỢC', state: 'ĐÃ XẾP', branch_id: LHP, role: 'Pha chế', slot: 0, source: 'MANUAL', is_manual: 1 },
    { week_id: W, employee_id: e2, weekday: 0, shift: 'FULL TIME CA TỐI', base_status: 'ĐI LÀM ĐƯỢC', state: 'ĐÃ XẾP', branch_id: LHP, role: 'Pha chế', slot: 5, source: 'MANUAL', is_manual: 1 }]);
  const mobile = document.documentElement.clientWidth < 760;

  await step('Xếp lịch LHP: chỉ còn 3 ca chính, người FT hiện trong các ca chồng giờ', async () => {
    location.hash = '#/__tam'; await sleep(200); location.hash = `#/quan-ly/lich-co-so?tuan=2026-11-02&cn=${LHP}`; await wait(mobile ? '.m-shift' : '.sg', 400); await sleep(800);
    if (mobile) {
      const secs = $$('.m-shift').map((s) => `${s.querySelector('.m-sh-h strong').textContent.trim()} ${s.querySelector('.m-tot').textContent.trim()} (FT: ${s.querySelectorAll('.cell.ftc').length})`);
      return `${secs.join(' · ')} · ${wide()}`;
    }
    if (!$('.sg')) return 'CHƯA THẤY BẢNG: ' + ($('#root')?.innerText || '').slice(0, 300);
    const blocks = [...new Set($$('.sg tr.r-total th').map((t) => t.textContent.trim()))];
    const where = $$('.sg .cell.ftc').map((c) => `${c.closest('tr').querySelector('th').textContent.trim().split(' – ')[0]}:${c.querySelector('.ftb').textContent}${c.classList.contains('away') ? '(nét đứt)' : ''}`);
    const tot = $$('.sg tr.r-total').map((tr) => `${tr.querySelector('th').textContent.trim()} T2=${tr.querySelectorAll('td')[0].textContent.trim()}`);
    return `khối: ${blocks.join(' / ')} · ô FT: ${where.join(', ')} · ${tot.join(' · ')}`;
  });
  if (new URLSearchParams(location.search).get('ftshot')) return;   // dừng ở trang Xếp lịch để chụp màn hình
  await step('Ô trống ca Sáng → có nút chọn "FULL TIME" → xếp người FULL TIME', async () => {
    const empty = $$('.cell.empty.sel, .cell.extra.sel').find((c) => c.dataset.s === 'Sáng');
    if (!empty) return 'không có ô trống ca Sáng: ' + $$('.cell').length + ' ô, có thể sửa: ' + $$('.cell.sel').length;
    const before = $$('.cell.ftc').length;
    empty.click(); await sleep(300);
    const modes = $$('#picker .pk-modes button').map((b) => b.textContent.trim());
    $$('#picker .pk-modes button')[1]?.click(); await sleep(200);
    const on = $('#picker .pk-modes button.on')?.textContent.trim();
    const first = $('#picker button[data-pick]:not([data-pick=""])');
    const who = first?.textContent.trim();
    first?.click(); await sleep(600);
    return `nút: ${modes.join(' | ')} · đang chọn: ${on} · chọn: ${who} · ô FT ${before} → ${$$('.cell.ftc').length} · ${wide()}`;
  });
  if (mobile) return;
  await step('Lịch tổng: mỗi ngày 3 cột ca, FULL TIME hiện "· FT" ở ca chính', async () => {
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/lich-tong?tuan=2026-11-02'; await wait('#master', 400); await sleep(800);
    const heads = $$('#master thead tr:nth-child(2) th').map((t) => t.textContent.trim());
    const ftCells = $$('#master td').filter((td) => /FT/.test(td.textContent) && !td.querySelector('select')).map((td) => td.textContent.trim()).slice(0, 4);
    const ftSel = $$('#master select').filter((s) => s.selectedOptions[0]?.textContent.includes('· FT')).length;
    const ftOpt = $$('#master select option').filter((o) => o.textContent.includes('· FT')).length;
    const { data: emps } = await sb.from('employees').select('*'); const c1 = emps.find((x) => x.id === e1)?.code;
    const tr = $$('#master tbody tr').find((r) => r.querySelector('.nm strong')?.textContent.trim() === String(c1));
    const row1 = tr ? [...tr.querySelectorAll('td')].slice(3, 6).map((td) => td.querySelector('select')?.selectedOptions[0]?.textContent || td.textContent.trim()).join(' | ') : 'không thấy dòng';
    return `NV FT Sáng (${c1}) T2: ${row1} · cột ngày T2: ${heads.slice(0, 3).join(', ')} (tổng ${heads.length} cột) · ô ghi FT: ${ftCells.join(' / ')} · ô đang chọn FT: ${ftSel} · lựa chọn "· FT": ${ftOpt}`;
  });
  await step('Báo cáo: không còn cảnh báo "thừa" ở ca FULL TIME', async () => {
    const { loadReport } = await import('../js/reports.js');
    const rep = await loadReport({ id: W, start_date: '2026-11-02', end_date: '2026-11-08' });
    const lines = rep.warningReport().lines.filter((l) => /FULL TIME/.test(l));
    const t = rep.summary().branches.get('LHP|0|Chiều');
    return `dòng cảnh báo có FULL TIME: ${lines.length}${lines.length ? ' → ' + lines.slice(0, 3).join(' | ') : ''} · LHP T2 Chiều thực tế ${t.actual}/${t.required}`;
  });
};
