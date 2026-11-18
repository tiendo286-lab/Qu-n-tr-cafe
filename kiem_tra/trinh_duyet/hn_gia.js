// Giả lập app_today_me (Việc hôm nay, bước 138) — chỉ để chạy thử giao diện.
// Tham số: hnca=0|1|2 (số ca hôm nay của nhân viên, mặc định 1), hnorder=0|1|sent (đợt Order), hnfail=dt (app_dt_work_list báo lỗi).
export function makeHn(T, me) {
  const q = new URLSearchParams(location.search);
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const nCa = me.employee_id ? Number(q.get('hnca') ?? 1) : 0;
  const ord = q.get('hnorder') || '0';
  const ca = [
    { shift: 'Sáng', branch_id: 1, branch: 'LHP', role: 'Pha chế', start: '06:45', end: '12:30', report_id: 11, report_status: 'hoan_thanh', recon_status: 'chua' },
    { shift: 'Tối', branch_id: 1, branch: 'LHP', role: 'Pha chế', start: '17:30', end: '23:00', report_id: null, report_status: null, recon_status: null },
  ];
  const out = {
    app_today_me: () => ({ today: now().slice(0, 10), now: now(), has_employee: !!me.employee_id, shifts: ca.slice(0, nCa),
      order: me.employee_id && ord !== '0' ? { week_id: 99, start_date: '2026-11-23', close_at: '2026-11-19T22:00', close_text: '22:00 Thứ Năm 19/11', submitted: ord === 'sent' } : null }),
  };
  if (q.get('hnfail') === 'dt') out.app_dt_work_list = () => { throw new Error('Lỗi thử'); };
  return out;
}
