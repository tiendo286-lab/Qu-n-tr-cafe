-- Danh sách ca sẽ đổi giờ chốt theo file Fabi khi chạy bù (chỉ đọc). Gửi SAU nội dung tệp 144 nếu 144 chưa chạy thật; tự hoàn tác.
do $$ begin raise exception 'REPORT>> %', public.app__ca_gio_fabi_all(true); end $$;
