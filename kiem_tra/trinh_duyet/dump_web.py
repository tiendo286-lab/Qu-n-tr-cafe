import sqlite3, json, sys
con = sqlite3.connect(sys.argv[1]); con.row_factory = sqlite3.Row
out = {}
for (t,) in con.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%'"):
    if t in ('password_resets', 'web_schema_version'): continue
    rows = [dict(r) for r in con.execute(f'select * from "{t}"')]
    out[t] = rows
for a in out['accounts']:
    has = 1 if a.pop('password_hash', None) else 0
    a.pop('session_version', None)
    a['has_password'] = has; a['auth_email'] = f"a{a['id']}@milano.invalid"
    e = next((x for x in out['employees'] if x['id'] == a['employee_id']), None)
    a['employee_code'] = e['code'] if e else None
out['employee_contacts'] = [{'employee_id': e['id'], 'email': e.pop('email', None), 'phone': e.pop('phone', None)} for e in out['employees']]
open(sys.argv[2], 'w').write('export const DATA = ' + json.dumps(out, ensure_ascii=False) + ';\n')
print({k: len(v) for k, v in out.items() if v})
