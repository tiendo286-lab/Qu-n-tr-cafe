# Thử đoạn mã tiện ích chạy trong trang Fabi (fabi_page.js) trên TRANG FABI GIẢ (fabi_gia.html), bằng Chrome thật, không ra mạng.
# Trang giả dựng theo ảnh chụp Fabi mới (23/11/2026); 4 kiểu lịch vì chưa biết chắc cấu trúc trang thật.
# Chạy: <python có playwright> cong_cu/fabi_c02_chrome/thu_dom/thu_dom.py [đường dẫn fabi_page.js]
# Không thay thế lần chạy thử trên Fabi thật bằng tiện ích (anh Tiến bấm "Kiểm tra tải").
import json, os, pathlib, re, sys, time
from playwright.sync_api import sync_playwright, Error as PwError

HERE = pathlib.Path(__file__).resolve().parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / 'fabi_page.js'
MOCK = (HERE / 'fabi_gia.html').read_text(encoding='utf-8')
FABI = 'https://fabi.ipos.vn/micro/report/revenue/revenue/shift'
FN = SRC.read_text(encoding='utf-8').replace('export async function fabiPage', 'window.__fabiPage = async function fabiPage', 1)
DETAIL = re.compile(r'^https://fabi\.ipos\.vn/(micro/)?report/revenue/revenue/shift-detail\?')
passed = 0


def ok(cond, what):
    global passed
    if not cond:
        raise AssertionError(what)
    passed += 1


def vnd(d):
    return '/'.join(reversed(d.split('-')))


def call(page, cmd, args):
    page.add_script_tag(content=FN)
    t = time.time()
    try:
        r = page.evaluate('([c, a]) => window.__fabiPage(c, a)', [cmd, args])
    except PwError as e:
        # Bấm mã ca làm trang tải lại: giống tiện ích, đọc đường dẫn tab sau khi tải xong.
        if cmd == 'open' and ('destroyed' in str(e) or 'navigat' in str(e).lower()):
            page.wait_for_url(DETAIL, timeout=25000)
            page.wait_for_load_state('load')
            print(f'    open {args.get("short")}: trang tải lại sang chi tiết, {time.time() - t:.1f}s')
            return {'url': page.url}
        raise
    if r and r.get('pageError'):
        raise AssertionError(f'{cmd} {json.dumps(args, ensure_ascii=False)[:120]}: {r["pageError"]}')
    print(f'    {cmd} {args.get("day", args.get("short", ""))} trang {args.get("page", "-")}: {time.time() - t:.1f}s')
    return r


def lst(page, day, pg, yest):
    page.goto(FABI)  # như tiện ích: mỗi lần đọc danh sách đều mở lại trang
    return call(page, 'list', {'day': day, 'page': pg, 'useYesterday': yest})


def full_day(page, day, yest, total=12):
    p1 = lst(page, day, 1, yest)
    ok(p1['total'] == total and p1['pages'] == 2 and len(p1['rows']) == 10, f'trang 1 ngày {day}: {p1["total"]=} {p1["pages"]=} {len(p1["rows"])=}')
    p2 = lst(page, day, 2, yest)
    ok(p2['total'] == total and len(p2['rows']) == total - 10, f'trang 2 ngày {day}: {p2["total"]=} {len(p2["rows"])=}')
    rows = p1['rows'] + p2['rows']
    ok(len({r['short'] for r in rows}) == total, 'mã ca không trùng, đủ cả hai trang')
    ok(all(r['open'].startswith(vnd(day)) and r['close'].startswith(vnd(day)) for r in rows), f'mọi ca đúng ngày {day}')
    ok(all(re.match(r'^#[A-Z0-9]{5}$', r['short']) and r['device'].startswith('TEST-DEVICE-') for r in rows), 'đọc đúng cột mã ca / thiết bị')
    return rows


def open_export(page, day, yest, row):
    lst(page, day, 2, yest)
    o = call(page, 'open', row)
    ok(bool(DETAIL.match(o['url'])) and o['url'].endswith(row['short'][1:]), f'mở đúng chi tiết ca: {o["url"]}')
    x = call(page, 'export', row)
    ok(x['base64'].startswith('UEsDB'), 'bắt được tệp Excel do nút Xuất báo cáo tạo')


CASES = [
    dict(variant='title', apply=False, spa=True, split=True),     # ô ngày có title="YYYY-MM-DD", bảng đầu cố định, chuyển trang không tải lại
    dict(variant='data-day', apply=True, spa=False, split=True),  # ô ngày có data-day, cần bấm "Áp dụng", mở ca tải lại trang
    dict(variant='plain', apply=False, spa=False, split=False),   # lịch chỉ có chữ số, nút mũi tên chỉ là hình
    dict(variant='select', apply=False, spa=True, split=False),   # tháng/năm nằm trong ô chọn: tự nhận ra tháng theo số ngày + thứ của ngày 1
    dict(variant='typed', apply=False, spa=True, split=False),    # bấm ngày trên lịch không ăn: dự phòng gõ ngày vào ô + Enter
]
ONLY = os.environ.get('KIEU')  # vd KIEU=select: chỉ chạy một kiểu lịch
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True)
    for c in [x for x in CASES if not ONLY or x['variant'] == ONLY]:
        for today, yday, back, prev_month in [('2026-11-23', '2026-11-22', '2026-11-18', None), ('2026-12-02', '2026-12-01', None, '2026-11-28')]:
            cfg = dict(c, today=today, empty=['2026-11-20'])
            print(f'== kiểu {c["variant"]} · hôm nay {today}')
            ctx = b.new_context(viewport={'width': 1400, 'height': 900})
            ctx.add_init_script(f'window.__FABI__ = {json.dumps(cfg)};')
            ctx.route('https://fabi.ipos.vn/**', lambda route: route.fulfill(status=200, content_type='text/html; charset=utf-8', body=MOCK))
            page = ctx.new_page()
            page.set_default_timeout(60000)
            rows = full_day(page, yday, True)               # hôm qua: bấm nút "Hôm qua"
            if back:
                rows = full_day(page, back, False)          # lấy bù: bấm ngày trên lịch
                open_export(page, back, False, rows[10])    # ca ở trang 2: mở chi tiết + xuất file
                empty = lst(page, '2026-11-20', 1, False)   # ngày không có ca: trả về rỗng, không treo
                ok(empty['total'] == 0 and empty['rows'] == [], f'ngày rỗng: {empty}')
            if prev_month:
                full_day(page, prev_month, False)           # ngày ở tháng trước: phải lùi lịch một tháng
                open_export(page, yday, True, rows[11])
            ctx.close()
    b.close()
print(json.dumps({'passed': passed, 'note': 'Trang Fabi giả; chưa thay thế chạy thử trên Fabi thật.'}, ensure_ascii=False))
