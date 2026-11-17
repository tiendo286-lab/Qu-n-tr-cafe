-- KIỂM TRA (đang FAIL = có lỗi): ô "CHUYỂN KHOẢN NGÂN HÀNG" ở bước Kiểm tra (phieu_ca.js, #bank-box)
-- lấy "Phải nhận" = money.ck_expected ?? pos_transfer. Máy chủ (app__ca_money) KHÔNG trả ck_expected
-- → ô luôn dùng CK Fabi, bỏ qua Thu/Chi CK, Khách trả nợ CK, Nợ CK → báo KHỚP/LỆCH khác với kết quả chính thức (ck_left_bank).
-- Chỉ đọc. Kết quả ở dòng REPORT>>.
do $$
declare thieu_khoa boolean; n int; vd json;
begin
  select not (public.app__ca_money(r.id) ? 'ck_expected') into thieu_khoa
    from public.shift_reports r where r.status = 'hoan_thanh' order by r.id desc limit 1;
  select count(*), json_agg(json_build_object('ca', y.cn || ' ' || y.ngay || ' ' || y.ca, 'o_hien_thi', y.o, 'may_chu', y.mc) order by y.ngay desc) filter (where y.rn <= 5)
    into n, vd
    from (select z.*, row_number() over (order by z.ngay desc) rn from (select b.code cn, r.work_date ngay, r.shift ca,
                 (m ->> 'bank_received')::bigint - coalesce((m ->> 'ck_expected')::bigint, (public.app__ca_eff(r.id) ->> 'pos_transfer')::bigint) o,
                 (m ->> 'ck_left_bank')::bigint mc
            from public.shift_reports r join public.branches b on b.id = r.branch_id
            cross join lateral (select public.app__ca_money(r.id) m) mm
           where r.status = 'hoan_thanh' and r.work_date >= to_char(public.vn_now()::date - 31, 'YYYY-MM-DD') and (m ->> 'bank_ok')::boolean) z
          where z.o is distinct from z.mc) y;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when not thieu_khoa and n = 0 then 'PASS' else 'FAIL' end,
    'may_chu_co_ck_expected', not thieu_khoa, 'so_ca_o_hien_thi_khac_may_chu_31_ngay', n, 'vi_du', vd);
end $$;
