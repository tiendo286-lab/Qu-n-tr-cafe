-- Chặng 2 (anh Tiến chốt 21/11/2026): sửa "lệch ảo khi giao két".
-- Ca trước THU THEO CA: quản lý đã thu két, để lại tiền gối đầu (mặc định 1.000.000) → ca sau phải mở đúng số gối đầu. Trước đây app__ca_hand so số ca sau
-- đếm với số nhân viên ca trước đếm CẢ KÉT → ca sau thiếu 30.000 thì trang Xác nhận Fabi của ca trước tạm hiện thiếu 330.000 (tới khi chọn ai chịu).
-- Nay, chỉ khi ca trước Thu theo ca:
--   • ca sau đếm lệch gối đầu QUÁ mức cho phép → lệch = số ca sau đếm − gối đầu (đúng phần thiếu / thừa thật);
--   • ca sau đếm đúng gối đầu hoặc lệch trong mức cho phép → "rút quỹ" như cũ (phần quản lý thu = két ca trước − số ca sau đếm), không lệch.
-- Ca sau mở đúng gối đầu (mọi ca thật tới 21/11) → kết quả y như cũ, KHÔNG đổi số ca nào, không đổi "So với trang cũ". Ca trước Thu cuối ngày: giữ nguyên.
-- Sổ tháng không dùng phần này. VÙNG KHOÁ (cách tính tiền của ca) — đã nói với anh Tiến ở buổi chốt chặng 2.
-- Vá bằng thay chuỗi trên bản đang chạy (tệp 104), giữ mọi phần khác. Bài thử: kiem_tra/lech_ao_157_cuc_bo.sql. Chạy lại nhiều lần không sao.
do $$
declare d text; a1 text; b1 text; a2 text; b2 text;
begin
  d := pg_get_functiondef('public.app__ca_hand(bigint)'::regprocedure);
  if position('chặng 2 (21/11): ca trước THU THEO CA' in d) = 0 then
    a1 := $q$gap := cnt - pc;$q$;
    a2 := $q$when cnt = fl and pc > fl then 'rut_quy'$q$;
    if length(d) - length(replace(d, a1, '')) <> length(a1) then raise exception 'app__ca_hand: không thấy đúng một chỗ vá 1 (lệch ảo giao két).'; end if;
    if length(d) - length(replace(d, a2, '')) <> length(a2) then raise exception 'app__ca_hand: không thấy đúng một chỗ vá 2 (lệch ảo giao két).'; end if;
    b1 := a1 || $q$
  -- chặng 2 (21/11): ca trước THU THEO CA (quản lý thu két, để lại gối đầu) mà ca sau đếm lệch gối đầu quá mức cho phép → lệch tính so với gối đầu
  if prev.id is not null and prev.status = 'hoan_thanh' and prev.cash_mode = 'ca' and abs(cnt - fl) > tol then gap := cnt - fl; end if;$q$;
    b2 := $q$when (cnt = fl and pc > fl) or (prev.cash_mode = 'ca' and abs(cnt - fl) <= tol and pc > cnt) then 'rut_quy'$q$;
    execute replace(replace(d, a1, b1), a2, b2);
  end if;
end $$;

insert into public.app_migrations(file) values ('157_lech_ao_giao_ket.sql') on conflict (file) do nothing;
