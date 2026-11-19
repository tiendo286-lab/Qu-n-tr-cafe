# Chạy 1 bài thử Chrome bằng Playwright (thời gian thật, không cần --virtual-time-budget).
# Cài 1 lần: python3 -m venv <thư mục>/venv && <thư mục>/venv/bin/pip install playwright   (dùng Chrome có sẵn trên máy)
# Dùng:  kiem_tra/trinh_duyet/chuan_bi.sh <thư mục tạm> [--dao-tao-gia]
#        <venv>/bin/python kiem_tra/trinh_duyet/chay_pw.py <thư mục tạm> "role=chu&script=flow_ln167" [--phone] [--timeout 180]
# --phone: mở test/phone.html (khung 390px). In kết quả #ketqua; mã thoát 1 nếu có lỗi (errs) hoặc hết giờ.
import sys, json, threading, functools, http.server, socketserver, time
from playwright.sync_api import sync_playwright

def main():
    a = sys.argv[1:]
    root, params = a[0], a[1]
    phone = '--phone' in a
    tmo = int(a[a.index('--timeout') + 1]) if '--timeout' in a else 180
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *x): pass
    H = functools.partial(Q, directory=root)
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), H); srv.daemon_threads = True
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{port}/' + ('test/phone.html' if phone else 'index.html') + '?auto=1&' + params
    logs = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 430 if phone else 1280, 'height': 900})
        pg = ctx.new_page()
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error',) else None)
        pg.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
        pg.on('dialog', lambda d: d.accept())
        pg.goto(url)
        t0 = time.time(); txt = None
        while time.time() - t0 < tmo:
            el = pg.query_selector('#ketqua')
            if el: txt = el.text_content(); break
            time.sleep(0.5)
        b.close()
    srv.shutdown()
    if txt is None:
        print('HẾT GIỜ — không có kết quả', url); [print(' ', l) for l in logs[-15:]]; sys.exit(1)
    try: out = json.loads(txt)
    except Exception: print(txt); sys.exit(1)
    bad = False
    for o in out:
        if 'errs' in o or 'route' in o:
            errs = o.get('errs') or []
            print(('LỖI  ' if errs else 'ĐẠT  ') + str(o.get('route')) + ' — ' + str(o.get('title'))[:1500])
        else:   # kiểu {ten: {ok: [...], fail: [...]}} của các bài flow_stc*
            errs = []
            for k, v in o.items():
                if isinstance(v, dict) and ('fail' in v or 'ok' in v):
                    f = v.get('fail') or []; errs += f
                    print(('LỖI  ' if f else 'ĐẠT  ') + f'{k} — {len(v.get("ok") or [])} đạt, {len(f)} hỏng')
                else: print('     ', k, json.dumps(v, ensure_ascii=False)[:1500])
        bad = bad or bool(errs)
        for e in errs: print('   ✗', str(e)[:1500])
    if logs: print('Console:', *logs[-10:], sep='\n  ')
    sys.exit(1 if bad else 0)

main()
