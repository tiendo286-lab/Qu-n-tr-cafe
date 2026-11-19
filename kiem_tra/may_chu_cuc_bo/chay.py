import sys, pgserver, psycopg2, os
SP = os.environ.get('PG_DIR') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '_tam', 'pg')
os.makedirs(SP, exist_ok=True)
srv = pgserver.get_server(os.path.join(SP, 'data'), cleanup_mode=None)
con = psycopg2.connect(srv.get_uri()); con.autocommit = True; cur = con.cursor()
sql = open(sys.argv[1]).read() if sys.argv[1].endswith('.sql') else sys.argv[1]
try:
    cur.execute(sql)
    try:
        for r in cur.fetchall(): print(*r, sep=' | ')
    except psycopg2.ProgrammingError: print('OK')
except Exception as e:
    print('LỖI:', str(e).strip())
for n in con.notices: print('NOTICE', n.strip())
