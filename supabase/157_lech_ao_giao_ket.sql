-- Chặng 2 (anh Tiến chốt 21/11/2026): sửa "lệch ảo khi giao két".
-- Ca trước THU THEO CA: quản lý đã thu két, để lại tiền gối đầu (mặc định 1.000.000) → ca sau phải mở đúng số gối đầu. Trước đây app__ca_hand so số ca sau
-- đếm với số nhân viên ca trước đếm CẢ KÉT → ca sau thiếu 30.000 thì trang Xác nhận Fabi của ca trước tạm hiện thiếu 330.000 (tới khi chọn ai chịu).
-- Nay: ca trước Thu theo ca → so với số gối đầu. Ca trước Thu cuối ngày: giữ nguyên cách cũ (so với két ca trước, có "rút quỹ").
-- Sổ tháng không dùng phần này (không đổi). VÙNG KHOÁ (cách tính tiền của ca) — đã nói với anh Tiến ở buổi chốt chặng 2.
-- Vá bằng thay chuỗi trên bản đang chạy (tệp 104), giữ mọi phần khác. Bài thử: kiem_tra/lech_ao_157_cuc_bo.sql. Chạy lại nhiều lần không sao.
do $$
declare d text; a1 text; b1 text;
begin
  d := pg_get_functiondef('public.app__ca_hand(bigint)'::regprocedure);
  if position('chặng 2 (21/11): ca trước THU THEO CA' in d) = 0 then
    a1 := $q$if prev.id is not null and prev.status = 'hoan_thanh' then pc := (public.app__ca_eff(prev.id) ->> 'cash_counted')::bigint; end if;$q$;
    if length(d) - length(replace(d, a1, '')) <> length(a1) then raise exception 'app__ca_hand: không thấy đúng một chỗ vá (lệch ảo giao két).'; end if;
    b1 := a1 || $q$
  -- chặng 2 (21/11): ca trước THU THEO CA → quản lý đã thu két, để lại gối đầu → ca sau phải mở đúng gối đầu (so với fl, không so cả két ca trước)
  if prev.id is not null and prev.status = 'hoan_thanh' and prev.cash_mode = 'ca' then pc := fl; end if;$q$;
    execute replace(d, a1, b1);
  end if;
end $$;

insert into public.app_migrations(file) values ('157_lech_ao_giao_ket.sql') on conflict (file) do nothing;
