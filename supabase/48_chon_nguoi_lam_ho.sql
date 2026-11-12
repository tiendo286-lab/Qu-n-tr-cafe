-- Bước 48 — Chọn người làm hộ ở phiếu chốt ca (anh Tiến chốt 12/11/2026): 2 mục "Nhân viên trong quán" (đang làm, kèm cơ sở để
-- xếp người của cơ sở này lên trước) và "Nhân viên cũ" (đã ngừng làm, vẫn chọn được khi quay lại làm hộ). Chạy lại nhiều lần không sao.

create or replace function public.app_ca_helpers() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('chot_ca');
  return jsonb_build_object(
    'active', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'code', e.code, 'name', e.name, 'rank', e.rank, 'pay_cash', e.pay_cash,
                 'branches', coalesce((select jsonb_agg(eb.branch_id) from public.employee_branches eb where eb.employee_id = e.id), '[]'::jsonb)) order by e.code)
               from public.employees e where e.status = 'Đang làm'), '[]'),
    'former', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'code', e.code, 'name', e.name, 'rank', e.rank, 'pay_cash', e.pay_cash,
                 'branches', coalesce((select jsonb_agg(eb.branch_id) from public.employee_branches eb where eb.employee_id = e.id), '[]'::jsonb)) order by e.code)
               from public.employees e where e.status <> 'Đang làm'), '[]'));
end $$;
revoke execute on function public.app_ca_helpers() from public, anon;
grant execute on function public.app_ca_helpers() to authenticated;
