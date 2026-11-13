#!/usr/bin/env python3
"""Dựng bản xem thử sổ tay quy trình từ file Word.

Dùng:
    python3 -I cong_cu/cap_nhat_quy_trinh.py --xem <thư mục tạm>          # chỉ dựng bản xem thử (không gửi gì)

Từ 13/11/2026, trang Quy trình trên web là bản chính và sửa trực tiếp như trước. Chế độ --gui đã ngừng dùng để
không ghi đè nội dung trên web; công cụ chỉ còn phục vụ xem lại file Word cũ.

- Chia sổ tay thành các bài nhỏ (cách đọc + sơ đồ bàn · 1.1–1.7 · giới thiệu SOP · SOP 01–09 · ghi nhớ); bỏ Phần 4
  (chương trình đào tạo đã có trên web dưới dạng phiếu đào tạo).
- Ảnh thu nhỏ (cạnh dài 1400px) rồi đưa vào kho ảnh riêng tư "tai-lieu" (phải đăng nhập mới xem được).
- Mỗi thẻ công việc / bước SOP có dòng "◆ Đào tạo: Ngày X · STT Y" → lưu làm hướng dẫn của hạng mục đào tạo STT Y.
- Số trang hạng mục đào tạo lấy từ Phần 4 của sổ tay.
Không chứa mã bí mật: mã sbp_ đọc từ file truyền vào, khóa kho ảnh lấy tạm qua API khi chạy.
"""
import argparse, hashlib, html, json, re, ssl, subprocess, sys, tempfile, urllib.error, urllib.request, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

GOC = Path(__file__).resolve().parent.parent
REF = 'krndtaskjhjpnqauoqiw'
PROGRAM = 'chay_ban'
KEY = 'so_tay_cb:'
BUCKET = 'tai-lieu'
IMG_DIR = 'so-tay'

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
MC = '{http://schemas.openxmlformats.org/markup-compatibility/2006}'
WPS = '{http://schemas.microsoft.com/office/word/2010/wordprocessingShape}'

# ------------------------------------------------------------------ đọc file Word

def dark(fill):
    if not fill or not re.fullmatch(r'[0-9A-Fa-f]{6}', fill):
        return False
    r, g, b = (int(fill[i:i + 2], 16) for i in (0, 2, 4))
    return 0.299 * r + 0.587 * g + 0.114 * b < 140


def walk(el, skip=(MC + 'Fallback', W + 'txbxContent', WPS + 'txbx')):
    """Duyệt con cháu theo thứ tự, bỏ phần dự phòng (ảnh lặp) và hộp chữ."""
    for ch in el:
        if ch.tag in skip:
            continue
        yield ch
        yield from walk(ch, skip)


class Doc:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        self.root = ET.fromstring(self.z.read('word/document.xml'))
        rels = ET.fromstring(self.z.read('word/_rels/document.xml.rels'))
        self.rels = {r.get('Id'): r.get('Target') for r in rels}
        self.images = {}          # rId -> đường dẫn trong kho
        self.img_src = {}         # đường dẫn trong kho -> (tên file trong zip)

    def img_path(self, rid):
        tgt = self.rels.get(rid)
        if not tgt:
            return None
        name = 'word/' + tgt.lstrip('/').replace('word/', '', 1) if not tgt.startswith('word/') else tgt
        data = self.z.read(name)
        ext = '.png' if name.lower().endswith('.png') else '.jpg'
        p = f'{IMG_DIR}/{hashlib.sha1(data).hexdigest()[:20]}{ext}'
        self.img_src[p] = name
        return p


def cell_fill(tc):
    sh = tc.find(W + 'tcPr/' + W + 'shd')
    return sh.get(W + 'fill') if sh is not None else None


def cell_span(tc):
    sp = tc.find(W + 'tcPr/' + W + 'gridSpan')
    return int(sp.get(W + 'val')) if sp is not None else 1


def p_text(p):
    out = []
    for el in walk(p):
        if el.tag == W + 't':
            out.append(el.text or '')
        elif el.tag == W + 'tab':
            out.append(' ')
    return ''.join(out).strip()


def p_images(doc, p):
    res = []
    for el in walk(p):
        if el.tag == A + 'blip':
            rid = el.get(R + 'embed')
            path = doc.img_path(rid) if rid else None
            if path:
                res.append(path)
    return res


def is_bold(rpr):
    if rpr is None:
        return False
    b = rpr.find(W + 'b')
    return b is not None and b.get(W + 'val') not in ('0', 'false')


def is_italic(rpr):
    if rpr is None:
        return False
    i = rpr.find(W + 'i')
    return i is not None and i.get(W + 'val') not in ('0', 'false')


def p_html(p):
    """Đoạn chữ → HTML (đậm / nghiêng / xuống dòng), không gồm ảnh."""
    parts = []
    for r in walk(p):
        if r.tag != W + 'r':
            continue
        rpr = r.find(W + 'rPr')
        txt = ''
        for ch in r:
            if ch.tag == W + 't':
                txt += html.escape(ch.text or '', quote=False)
            elif ch.tag == W + 'tab':
                txt += ' '
            elif ch.tag in (W + 'br', W + 'cr') and ch.get(W + 'type') != 'page':
                txt += '<br>'
        if not txt:
            continue
        if is_bold(rpr):
            txt = f'<strong>{txt}</strong>'
        if is_italic(rpr):
            txt = f'<em>{txt}</em>'
        parts.append(txt)
    s = ''.join(parts).replace('</strong><strong>', '').replace('</em><em>', '')
    return re.sub(r'\s{2,}', ' ', s).strip()


def p_all_bold(p):
    runs = [r for r in walk(p) if r.tag == W + 'r' and ''.join(t.text or '' for t in r.iter(W + 't')).strip()]
    return bool(runs) and all(is_bold(r.find(W + 'rPr')) for r in runs)


def p_style(p):
    s = p.find(W + 'pPr/' + W + 'pStyle')
    return s.get(W + 'val') if s is not None else ''


def has_page_break(p):
    return any(b.get(W + 'type') == 'page' for b in p.iter(W + 'br'))


# ------------------------------------------------------------------ chuyển sang HTML (chỉ thẻ web cho phép)

BOX = re.compile(r'^(✔|⚠|✖|★|Lưu ý)')
TRAIN = re.compile(r'◆\s*Đào tạo:\s*Ngày\s*(\d+)\s*·\s*STT\s*([\d,\s]+)')
H2_TXT = re.compile(r'^(\d\.\d\s|SOP \d\d\s|PHẦN \d|SƠ ĐỒ)')


class Builder:
    def __init__(self, doc):
        self.doc = doc
        self.out = []           # khối HTML của bài hiện tại
        self.card = None        # thẻ đang mở: {'title', 'blocks', 'stt'}
        self.cards = []

    def emit(self, h):
        if not h:
            return
        self.out.append(h)
        if self.card is not None:
            self.card['blocks'].append(h)

    def close_card(self):
        if self.card is not None:
            self.cards.append(self.card)
        self.card = None

    # ---- đoạn
    def para(self, p, in_box=False):
        imgs = p_images(self.doc, p)
        t = p_text(p)
        h = p_html(p)
        if t:
            m = TRAIN.search(t)
            if m and self.card is not None:
                self.card['stt'] |= {int(x) for x in re.findall(r'\d+', m.group(2))}
            if (p_style(p).startswith('Heading') or (p_all_bold(p) and len(t) <= 70 and not t.endswith(':') and not in_box)) and not t[:1].isdigit():
                if self.card is not None:
                    self.emit(f'<h4>{html.escape(t, quote=False)}</h4>')
                else:
                    self.emit(f'<h3>{html.escape(t, quote=False)}</h3>')
            elif in_box or BOX.match(t):
                self.emit(f'<p>{h}</p>')
            elif m:
                self.emit(f'<p><em>{html.escape(t, quote=False)}</em></p>')
            else:
                self.emit(f'<p>{h}</p>')
        if imgs:
            self.emit('<p>' + ''.join(f'<img data-path="{x}" alt="">' for x in imgs) + '</p>')

    def blocks(self, el, in_box=False):
        for ch in el:
            if ch.tag == W + 'p':
                self.para(ch, in_box)
            elif ch.tag == W + 'tbl':
                self.table(ch)
            elif ch.tag == W + 'sdt':
                c = ch.find(W + 'sdtContent')
                if c is not None:
                    self.blocks(c, in_box)

    # ---- bảng
    def cell_has(self, tc):
        has_img = any(e.tag == A + 'blip' for e in walk(tc))
        has_tbl = tc.find(W + 'tbl') is not None
        return has_img, has_tbl

    def is_data_table(self, tbl):
        rows = tbl.findall(W + 'tr')
        multi = 0
        for r in rows:
            cells = r.findall(W + 'tc')
            for tc in cells:
                hi, ht = self.cell_has(tc)
                if hi or ht:
                    return False
                if TRAIN.search(''.join(p_text(p) for p in tc.findall(W + 'p'))):
                    return False
            if len(cells) >= 2:
                multi += 1
        return multi >= 2

    def data_table(self, tbl):
        rows = tbl.findall(W + 'tr')
        ncol = max(sum(cell_span(tc) for tc in r.findall(W + 'tc')) for r in rows)
        out = []
        for i, r in enumerate(rows):
            cells = r.findall(W + 'tc')
            if len(cells) == 1 and i == 0 and len(rows) > 1:
                t = '<br>'.join(p_html(p) for p in cells[0].findall(W + 'p') if p_text(p))
                if t:
                    self.emit(f'<p><strong>{re.sub("</?strong>", "", t)}</strong></p>')
                continue
            head = all(dark(cell_fill(tc)) for tc in cells)
            tag = 'th' if head else 'td'
            tds = []
            for tc in cells:
                t = '<br>'.join(p_html(p) for p in tc.findall(W + 'p') if p_text(p))
                sp = cell_span(tc)
                if len(cells) == 1 and ncol > 1:
                    sp = ncol
                tds.append(f'<{tag}{f" colspan={chr(34)}{sp}{chr(34)}" if sp > 1 else ""}>{t}</{tag}>')
            out.append('<tr>' + ''.join(tds) + '</tr>')
        self.emit('<table><tbody>' + ''.join(out) + '</tbody></table>')

    def heading_row(self, cells):
        first = cells[0]
        ps = [p for p in first.findall(W + 'p') if p_text(p)]
        if not ps:
            return
        title = re.sub(r'\s{2,}', ' ', p_text(ps[0]))
        level = 'h2' if H2_TXT.match(title) else 'h3'
        self.close_card()
        self.emit(f'<{level}>{html.escape(title, quote=False)}</{level}>')
        if level == 'h3':
            self.card = {'title': title, 'blocks': [], 'stt': set()}
        for p in ps[1:]:
            t = p_text(p)
            m = TRAIN.search(t)
            if m and self.card is not None:
                self.card['stt'] |= {int(x) for x in re.findall(r'\d+', m.group(2))}
            self.emit(f'<p><em>{html.escape(t, quote=False)}</em></p>')
        for tc in cells[1:]:
            for p in tc.findall(W + 'p'):
                if p_text(p):
                    self.emit(f'<p>{p_html(p)}</p>')

    def photo_table(self, tbl):
        """Bảng ảnh: mỗi hàng = nhãn (cơ sở / tầng / số ảnh) + các ô ảnh."""
        for r in tbl.findall(W + 'tr'):
            labels, imgs = [], []
            for tc in r.findall(W + 'tc'):
                for p in tc.findall(W + 'p'):
                    t = p_text(p)
                    if t:
                        labels.append(t)
                    imgs += p_images(self.doc, p)
            if labels and not imgs:
                self.emit('<p><strong>' + html.escape(' · '.join(labels), quote=False) + '</strong></p>')
            elif labels:
                self.emit('<p><strong>' + html.escape(' · '.join(labels), quote=False) + '</strong></p>')
            if imgs:
                self.emit('<p>' + ''.join(f'<img data-path="{x}" alt="">' for x in imgs) + '</p>')

    def table(self, tbl):
        if self.is_data_table(tbl):
            self.data_table(tbl)
            return
        rows = tbl.findall(W + 'tr')
        # bảng ảnh: có ảnh, mỗi ô hoặc là chữ ngắn hoặc là ảnh
        if any(e.tag == A + 'blip' for e in walk(tbl)) and tbl.find('.//' + W + 'tbl') is None and \
                all(len(r.findall(W + 'tc')) >= 2 or not any(e.tag == A + 'blip' for e in walk(r)) for r in rows):
            self.photo_table(tbl)
            return
        pend = []   # hàng chữ nhiều ô liền nhau (vd câu nói mẫu) → gom thành bảng
        def flush():
            if pend:
                t = ET.Element(W + 'tbl')
                for r in pend:
                    t.append(r)
                self.data_table(t)
                pend.clear()
        for r in rows:
            cells = r.findall(W + 'tc')
            texts = [''.join(p_text(p) for p in tc.findall(W + 'p')) for tc in cells]
            if cells and all(dark(cell_fill(tc)) for tc in cells) and texts[0]:
                flush()
                self.heading_row(cells)
                continue
            plain = len(cells) >= 2 and not any(any(self.cell_has(tc)) for tc in cells) \
                and not any(BOX.match(t or '') for t in texts) and not any(TRAIN.search(t or '') for t in texts)
            if plain:
                pend.append(r)
                continue
            flush()
            for tc in cells:
                box = bool(BOX.match(texts[cells.index(tc)] or ''))
                if box:
                    self.out.append('<blockquote>')
                    if self.card is not None:
                        self.card['blocks'].append('<blockquote>')
                self.blocks(tc, in_box=box)
                if box:
                    self.out.append('</blockquote>')
                    if self.card is not None:
                        self.card['blocks'].append('</blockquote>')
        flush()


# ------------------------------------------------------------------ chia bài

def article_key(el):
    """Trả về (khóa, tiêu đề mặc định) nếu phần tử mở đầu một bài mới."""
    if el.tag == W + 'p':
        t = p_text(el)
        if t.startswith('CÁCH ĐỌC TÀI LIỆU'):
            return 'doc'
        return None
    if el.tag != W + 'tbl':
        return None
    r0 = el.find(W + 'tr')
    if r0 is None:
        return None
    tc = r0.find(W + 'tc')
    t = ''.join(p_text(p) for p in tc.findall(W + 'p')[:1]) if tc is not None else ''
    if tc is None or not dark(cell_fill(tc)):
        return None
    m = re.match(r'^1\.([1-7])\s', t)
    if m:
        return f'ca1{m.group(1)}'
    m = re.match(r'^SOP (\d\d)\s', t)
    if m:
        return f'sop{m.group(1)}'
    if t.startswith('PHẦN 2'):
        return 'sop00'
    if t.startswith('PHẦN 3'):
        return 'ghi_nho'
    if t.startswith('PHẦN 4'):
        return 'STOP'
    return None


def toc_titles(body):
    """Tên bài lấy từ mục lục: '1.1  Đầu ca sáng — 10 công việc\t7'."""
    res = {}
    for el in body:
        if el.tag != W + 'p':
            continue
        t = re.sub(r'\s+\d+$', '', p_text(el)).strip()
        m = re.match(r'^1\.([1-7])\s+(.+)$', t)
        if m and f'ca1{m.group(1)}' not in res:
            res[f'ca1{m.group(1)}'] = f'1.{m.group(1)} ' + re.sub(r'\s*—\s*', ' — ', m.group(2)).strip()
        m = re.match(r'^SOP (\d\d)\s+(.+)$', t)
        if m and f'sop{m.group(1)}' not in res:
            res[f'sop{m.group(1)}'] = f'SOP {m.group(1)} – {m.group(2).strip()}'
        if t.startswith('CÁCH ĐỌC TÀI LIỆU'):
            break
    res['doc'] = 'Sổ tay – Cách đọc tài liệu & sơ đồ bàn'
    res['sop00'] = 'SOP – Giới thiệu bộ 9 quy trình phục vụ khách'
    res['ghi_nho'] = 'Ghi nhớ – Quy định bắt buộc'
    return res


ORDER = ['doc', 'ca11', 'ca12', 'ca13', 'ca14', 'ca15', 'ca16', 'ca17', 'sop00'] + [f'sop{i:02d}' for i in range(1, 10)] + ['ghi_nho']


def training_pages(doc, body):
    """Số trang hạng mục đào tạo trong Phần 4: hàng 'STT | Hạng mục | Tr. | …'."""
    pages, started = {}, False
    for el in body:
        if el.tag == W + 'tbl':
            if article_key(el) == 'STOP':
                started = True
            if not started:
                continue
            for r in el.iter(W + 'tr'):
                cells = [''.join(p_text(p) for p in tc.findall(W + 'p')) for tc in r.findall(W + 'tc')]
                if len(cells) >= 3 and cells[0].strip().isdigit() and re.fullmatch(r'\d{1,3}', cells[2].strip()):
                    pages[str(int(cells[0]))] = cells[2].strip()
    return pages


def build(path):
    doc = Doc(path)
    body = doc.root.find(W + 'body')
    titles = toc_titles(body)
    arts, cur, b = {}, None, None
    for el in body:
        k = article_key(el)
        if k == 'STOP':
            break
        if k and k != cur:
            if b is not None:
                b.close_card()
                arts[cur] = b
            cur, b = k, Builder(doc)
        if b is None:
            continue
        if el.tag == W + 'p':
            b.para(el)
        elif el.tag == W + 'tbl':
            b.table(el)
            b.close_card()
    if b is not None:
        b.close_card()
        arts[cur] = b
    missing = [k for k in ORDER if k not in arts]
    if missing:
        raise SystemExit('Không tìm thấy phần: ' + ', '.join(missing) + ' — cấu trúc sổ tay đã đổi, cần xem lại công cụ.')
    out, guides = [], []
    for i, k in enumerate(ORDER):
        bl = arts[k]
        h = '\n'.join(x for x in bl.out if x)
        h = re.sub(r'<blockquote>\s*</blockquote>', '', h)
        out.append({'key': KEY + k, 'title': titles.get(k, k), 'sort': i + 1, 'html': h})
        seq = {}
        for c in bl.cards:
            if not c['stt']:
                continue
            ch = re.sub(r'<blockquote>\s*</blockquote>', '', '\n'.join(c['blocks']))
            for stt in sorted(c['stt']):
                seq[stt] = seq.get(stt, 0) + 1
                guides.append({'item': stt, 'key': KEY + k, 'heading': f"{titles.get(k, k)} · {c['title']}", 'html': ch, 'art': k})
    # số thứ tự đoạn hướng dẫn theo từng hạng mục
    cnt = {}
    for g in guides:
        cnt[g['item']] = cnt.get(g['item'], 0) + 1
        g['seq'] = cnt[g['item']]
    return doc, out, guides, training_pages(doc, body)


# ------------------------------------------------------------------ ảnh

def shrink(doc, path, cache):
    """Thu nhỏ ảnh (cạnh dài 1400px) bằng sips của macOS; trả về bytes."""
    src = doc.img_src[path]
    out = cache / path.replace('/', '_')
    if not out.exists():
        tmp = cache / ('raw_' + Path(src).name)
        tmp.write_bytes(doc.z.read(src))
        fmt = ['-s', 'format', 'png'] if path.endswith('.png') else ['-s', 'format', 'jpeg', '-s', 'formatOptions', '72']
        subprocess.run(['sips', '-Z', '1400', *fmt, str(tmp), '--out', str(out)], check=True, capture_output=True)
        tmp.unlink()
    return out.read_bytes()


# ------------------------------------------------------------------ Supabase

try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = ssl.create_default_context(cafile='/etc/ssl/cert.pem')


def http(method, url, headers, data=None):
    req = urllib.request.Request(url, data=data, method=method, headers={'User-Agent': 'milano-quy-trinh', **headers})
    try:
        with urllib.request.urlopen(req, timeout=180, context=CTX) as r:
            t = r.read().decode()
            return r.status, (json.loads(t) if t.strip().startswith(('[', '{')) else t)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:2000]


def sql(token, q):
    st, res = http('POST', f'https://api.supabase.com/v1/projects/{REF}/database/query',
                   {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}, json.dumps({'query': q}).encode())
    if st >= 300:
        raise SystemExit(f'Lỗi máy chủ ({st}): {res}')
    return res


def lit(s):
    return "'" + str(s).replace("'", "''") + "'"


def send(token, doc, arts, guides, pages, src_name, cache):
    st, keys = http('GET', f'https://api.supabase.com/v1/projects/{REF}/api-keys?reveal=true', {'Authorization': f'Bearer {token}'})
    if st >= 300:
        raise SystemExit(f'Không lấy được khóa kho ảnh ({st}).')
    svc = next((k['api_key'] for k in keys if k.get('name') == 'service_role'), None) or \
        next((k['api_key'] for k in keys if str(k.get('api_key', '')).startswith('sb_secret_')), None)
    if not svc:
        raise SystemExit('Không thấy khóa kho ảnh.')
    have = {r['name'] for r in sql(token, f"select name from storage.objects where bucket_id = '{BUCKET}' and name like '{IMG_DIR}/%'")}
    need = sorted({p for a in arts for p in re.findall(r'data-path="([^"]+)"', a['html'])})
    up = 0
    for p in need:
        if p in have:
            continue
        data = shrink(doc, p, cache)
        ct = 'image/png' if p.endswith('.png') else 'image/jpeg'
        s, res = http('POST', f'https://{REF}.supabase.co/storage/v1/object/{BUCKET}/{p}',
                      {'Authorization': f'Bearer {svc}', 'apikey': svc, 'Content-Type': ct, 'x-upsert': 'true'}, data)
        if s >= 300:
            raise SystemExit(f'Không tải được ảnh {p}: {s} {res}')
        up += 1
    svc = None
    q = ['begin;', 'create temp table _qt(k text, t text, changed boolean) on commit drop;']
    for a in arts:
        hsh = hashlib.sha1(a['html'].encode()).hexdigest()
        q.append(f"insert into _qt select {lit(a['key'])}, {lit(a['title'])}, (public.app__qt_upsert({lit(a['key'])}, {lit(a['title'])}, {a['sort']}, {lit(a['html'])}, {lit(src_name)}, {lit(hsh)}) ->> 'changed')::boolean;")
    q.append(f"select public.app__qt_prune({lit(KEY)}, array[{', '.join(lit(a['key']) for a in arts)}]);")
    rows = [{'item': g['item'], 'seq': g['seq'], 'key': g['key'], 'heading': g['heading'], 'html': g['html']} for g in guides]
    q.append(f"select public.app__qt_guides({lit(PROGRAM)}, {lit(json.dumps(rows, ensure_ascii=False))}::jsonb);")
    q.append(f"create temp table _pg as select public.app__qt_pages({lit(PROGRAM)}, {lit(json.dumps(pages))}::jsonb) n;")
    q.append("create temp table _nt as select public.app__qt_notify(coalesce((select array_agg(t order by k) from _qt where changed), '{}')) n;")
    q.append("select (select count(*) from _qt where changed) changed, (select count(*) from _qt) total, (select n from _pg) pages, (select n from _nt) notified,"
             f" (select count(*) from public.training_guides where program_code = {lit(PROGRAM)}) guides,"
             " (select string_agg(t, ' | ' order by k) from _qt where changed) titles;")
    q.append('commit;')
    res = sql(token, '\n'.join(q))
    return up, len(need), res


def preview(arts, guides, doc, outdir, cache):
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / 'img').mkdir(exist_ok=True)
    for a in arts:
        for p in re.findall(r'data-path="([^"]+)"', a['html']):
            f = outdir / 'img' / p.replace('/', '_')
            if not f.exists():
                f.write_bytes(shrink(doc, p, cache))
    def fix(h):
        return re.sub(r'data-path="([^"]+)"', lambda m: f'data-path="{m.group(1)}" src="img/{m.group(1).replace("/", "_")}"', h)
    idx = ['<meta charset="utf-8"><h1>Xem thử sổ tay</h1><ul>']
    for a in arts:
        f = a['key'].split(':')[1] + '.html'
        (outdir / f).write_text(f'<meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="xem.css"><div class="doc"><h1>{html.escape(a["title"])}</h1>{fix(a["html"])}</div>', encoding='utf-8')
        idx.append(f'<li><a href="{f}">{html.escape(a["title"])}</a> ({len(a["html"]) // 1024} KB)</li>')
    idx.append('</ul>')
    (outdir / 'index.html').write_text('\n'.join(idx), encoding='utf-8')
    g = ['<meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="xem.css"><div class="doc">']
    for x in sorted(guides, key=lambda x: (x['item'], x['seq'])):
        g.append(f'<hr><h2>STT {x["item"]}.{x["seq"]} — {html.escape(x["heading"])}</h2>{fix(x["html"])}')
    (outdir / 'huong_dan.html').write_text('\n'.join(g) + '</div>', encoding='utf-8')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--file', help='file Word (mặc định: file .docx mới nhất trong quy_trinh_goc/)')
    ap.add_argument('--xem', help='dựng bản xem thử vào thư mục này')
    ap.add_argument('--gui', action='store_true', help='gửi lên Supabase')
    ap.add_argument('--ma', help='file chứa mã sbp_')
    ap.add_argument('--cache', help='thư mục giữ ảnh đã thu nhỏ')
    a = ap.parse_args()
    if a.gui:
        raise SystemExit('Quy trình đã chuyển về sửa trực tiếp trên web; --gui không còn được dùng.')
    f = Path(a.file) if a.file else max((p for p in (GOC / 'quy_trinh_goc').glob('*.docx') if not p.name.startswith('~$')), key=lambda p: p.stat().st_mtime)
    doc, arts, guides, pages = build(f)
    items = sorted({g['item'] for g in guides})
    print(f'File: {f.name}')
    print(f'{len(arts)} bài, {len(doc.img_src)} ảnh, {len(guides)} đoạn hướng dẫn cho {len(items)} hạng mục, số trang {len(pages)} hạng mục')
    for x in arts:
        print(f"  {x['title']}: {len(x['html']) // 1024} KB, {x['html'].count('<img')} ảnh")
    miss = [i for i in range(1, 69) if i not in items]
    if miss:
        print('  ! Hạng mục chưa có hướng dẫn:', miss)
    cache = Path(a.cache) if a.cache else Path(tempfile.gettempdir()) / 'milano_quy_trinh_anh'
    cache.mkdir(parents=True, exist_ok=True)
    if a.xem:
        preview(arts, guides, doc, Path(a.xem), cache)
        print('Bản xem thử:', a.xem)
    if a.gui:
        if not a.ma:
            raise SystemExit('Cần --ma <file chứa mã sbp_>.')
        token = Path(a.ma).read_text().strip()
        up, total, res = send(token, doc, arts, guides, pages, f.name, cache)
        print(f'Ảnh: tải mới {up}/{total}')
        print('Kết quả:', json.dumps(res, ensure_ascii=False))


if __name__ == '__main__':
    main()
