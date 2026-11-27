-- Bài thử tệp 184 (chạy sau khi nạp 184 vào CSDL thử có dữ liệu; tự hoàn tác bằng RAISE). Đạt khi dòng REPORT có loi=[] và
-- quyen anon=false auth=false ai_doc=false ai_viec=false service=true.
do $t$
declare a jsonb; b jsonb; c jsonb; d jsonb; loi text := '';
begin
  a := public.app__sl_doanh_thu('2026-11-01','2026-11-30');
  b := public.app__sl_lich_ca('2026-11-01','2026-11-30', null);
  c := public.app__sl_nhan_vien();
  d := public.app__sl_giao_hang('2026-11-01','2026-11-30','LHP');
  if not (a ? 'theo_ngay' and a ? 'tong_theo_quan' and b ? 'ca' and c ? 'nhan_vien' and d ? 'hoa_don' and d ? 'theo_hang') then loi := loi || ' THIEU-KHOA'; end if;
  begin perform public.app__sl_doanh_thu('2026-01-01','2026-11-30'); loi := loi || ' KHONG-CHAN-KHOANG-DAI'; exception when others then null; end;
  begin perform public.app__sl_lich_ca('2026-11-30','2026-11-01'); loi := loi || ' KHONG-CHAN-NGUOC-NGAY'; exception when others then null; end;
  begin perform public.app__sl_lich_ca('abc','2026-11-30'); loi := loi || ' KHONG-CHAN-NGAY-SAI'; exception when others then null; end;
  raise exception 'REPORT>> quyen anon=% auth=% ai_doc=% ai_viec=% service=% | loi=[%]',
    has_function_privilege('anon','public.app__sl_nhan_vien()','execute'),
    has_function_privilege('authenticated','public.app__sl_nhan_vien()','execute'),
    has_function_privilege('ai_doc','public.app__sl_lich_ca(text,text,text)','execute'),
    has_function_privilege('ai_viec','public.app__sl_doanh_thu(text,text)','execute'),
    has_function_privilege('service_role','public.app__sl_giao_hang(text,text,text)','execute'), loi;
end $t$;
