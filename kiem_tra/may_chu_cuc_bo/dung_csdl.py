# Dựng CSDL thử cục bộ: chạy lần lượt supabase/*.sql (bỏ qua lỗi từng tệp, ghi lại)
import sys, os, re, glob, pgserver, psycopg2
SP = os.environ.get('PG_DIR') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '_tam', 'pg')
os.makedirs(SP, exist_ok=True)
srv = pgserver.get_server(os.path.join(SP, 'data'), cleanup_mode=None)
uri = srv.get_uri()
print(uri)
con = psycopg2.connect(uri); con.autocommit = True; cur = con.cursor()
if '--fresh' in sys.argv:
    cur.execute("drop schema if exists public cascade; create schema public; drop schema if exists auth cascade; drop schema if exists storage cascade; drop schema if exists cron cascade; drop schema if exists extensions cascade;")
pre = r"""
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator nologin; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_admin') then create role supabase_admin nologin; end if;
end $$;
create schema if not exists auth; create schema if not exists storage; create schema if not exists extensions; create schema if not exists cron;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, encrypted_password text, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz default now(), updated_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz, aud text, role text, instance_id uuid, confirmation_token text, recovery_token text, email_change_token_new text, email_change text, banned_until timestamptz, deleted_at timestamptz, is_sso_user boolean default false, phone text);
create table if not exists auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz default now());
create table if not exists auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid, provider text, provider_id text, identity_data jsonb, created_at timestamptz, updated_at timestamptz, last_sign_in_at timestamptz);
create table if not exists auth.refresh_tokens (id bigserial primary key, user_id text, session_id uuid, revoked boolean);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(coalesce(current_setting('request.jwt.claim.sub', true), (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(auth.jwt() ->> 'role', 'anon') $$;
create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, owner_id text, metadata jsonb, path_tokens text[], version text, last_accessed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz);
create or replace function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
create or replace function cron.unschedule(a bigint) returns boolean language sql as $$ select true $$;
create table if not exists cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create or replace function cron.schedule(a text, b text, c text) returns bigint language sql as $$ insert into cron.job(jobname, schedule, command) values (a, b, c) returning jobid $$;
create or replace function cron.unschedule(a text) returns boolean language sql as $$ delete from cron.job where jobname = a returning true $$;
create or replace function public.crypt(a text, b text) returns text language sql immutable as $$ select md5(a||b) $$;
create or replace function public.gen_salt(a text) returns text language sql as $$ select md5(random()::text) $$;
create or replace function public.gen_salt(a text, n int) returns text language sql as $$ select md5(random()::text) $$;
create or replace function public.digest(a text, b text) returns bytea language sql immutable as $$ select decode(md5(a), 'hex') $$;
create or replace function public.digest(a bytea, b text) returns bytea language sql immutable as $$ select decode(md5(a), 'hex') $$;
create or replace function public.gen_random_bytes(n int) returns bytea language sql as $$ select decode(md5(random()::text), 'hex') $$;
"""
cur.execute(pre)
files = sorted(glob.glob(sys.argv[1] + '/*.sql'), key=lambda p: [int(t) if t.isdigit() else t for t in re.split(r'(\d+)', os.path.basename(p))])
only_from = next((int(a.split('=')[1]) for a in sys.argv if a.startswith('--from=')), 0)
upto = next((int(a.split('=')[1]) for a in sys.argv if a.startswith('--upto=')), 10**6)
bad = []
for f in files:
    m = re.match(r'(\d+)', os.path.basename(f))
    if not m: continue
    k = int(m.group(1))
    if k < only_from or k > upto: continue
    sql = open(f, encoding='utf-8').read()
    sql = re.sub(r'(?im)^\s*create extension[^;]*;', '', sql)
    try:
        cur.execute(sql)
    except Exception as e:
        bad.append((os.path.basename(f), str(e).split('\n')[0][:220]))
print('LỖI', len(bad))
for b in bad: print(' ', b[0], '→', b[1])
