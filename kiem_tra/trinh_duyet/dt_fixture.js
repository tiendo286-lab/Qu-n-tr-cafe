// Dữ liệu tự tạo cho luồng đào tạo.
export const DATA = {
  weeks: [{ id: 1, start_date: '2026-11-02' }],
  branches: [{ id: 1, code: 'TEST', status: 'Đang hoạt động' }, { id: 2, code: 'TEST2', status: 'Đang hoạt động' }],
  employees: [
    { id: 3, code: 'NV03', name: 'Người học thử', rank: 'Thử việc', status: 'Đang làm' },
    { id: 5, code: 'NV05', name: 'Người hướng dẫn thử', rank: 'Quản lý', status: 'Đang làm' },
    { id: 7, code: 'NV07', name: 'Nhân viên cấp 1 thử', rank: 'Cấp 1', status: 'Đang làm' },
    { id: 8, code: 'NV08', name: 'Quản lý khác thử', rank: 'Quản lý', status: 'Đang làm' },
  ],
  weekly_schedule_entries: [], employee_branches: [], employee_roles: [], settings: [],
};
