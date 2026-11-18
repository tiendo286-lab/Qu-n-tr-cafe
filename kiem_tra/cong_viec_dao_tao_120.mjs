import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2];
if (!modulePath) throw new Error('Truyền đường dẫn đến dist/index.js của PGlite.');
const { PGlite } = await import(pathToFileURL(resolve(modulePath)).href);
const db = new PGlite();
await db.exec('begin');
const read = (p) => readFileSync(p, 'utf8');
await db.exec('create role anon; create role authenticated;');
await db.exec(read('supabase/01_bang.sql'));
const tasks = read('supabase/07_hop_giao_viec.sql').match(/create table if not exists public.tasks \([\s\S]*?\n\);/)[0];
await db.exec('create table public.meetings(id bigint primary key); create table public.handover_items(id bigint primary key);');
await db.exec(tasks);
await db.exec(`
  create table app_migrations(file text primary key);
  create function app_account() returns accounts language sql stable as $$
    select a from accounts a where a.id = current_setting('test.account', true)::bigint
  $$;
  create function app_my_employee() returns bigint language sql stable as $$ select (app_account()).employee_id $$;
  create function app_can(text) returns boolean language sql stable as $$
    select coalesce((app_account()).system_role = 'chu' or ((app_account()).system_role = 'ql' and $1 = 'dao_tao'), false)
  $$;
  create function app__need(text) returns accounts language plpgsql stable as $$
  begin
    if (app_account()).id is null or ($1 is not null and not app_can($1)) then raise exception 'Từ chối'; end if;
    return app_account();
  end $$;
  create function app__acc_name(bigint) returns text language sql stable as $$ select 'TK' || $1 $$;
  create function app_log(text,text) returns void language sql as $$ select null::void $$;
  create table test_notifications(account bigint, title text);
  create function app__notify(bigint,text,text,text) returns void language sql as $$ insert into test_notifications values ($1,$2) $$;
  create function app__notify_emp(bigint,text,text,text) returns void language sql as $$
    select app__notify(a.id,$2,$3,$4) from accounts a where a.employee_id = $1
  $$;
`);
await db.exec(read('supabase/09_dao_tao.sql'));
await db.exec(read('kiem_tra/cong_viec_dao_tao_120.sql').split('-- Bắt đầu kiểm tra')[0]);
const migration = read('supabase/120_cong_viec_dao_tao.sql');
await db.exec(migration);
await db.exec(migration);
const results = await db.exec(read('kiem_tra/cong_viec_dao_tao_120.sql').split('-- Bắt đầu kiểm tra')[1]);
console.log(results.at(-1).rows[0].ket_qua);
await db.exec('rollback');
console.log('Đã tự hoàn tác giao dịch PostgreSQL cục bộ.');
await db.close();
