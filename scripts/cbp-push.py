#!/usr/bin/env python3
"""Keep Chris's Chinese system on the Mac and Chinese Brain Plus in step. Standard library only.

While the Mac is the source (Stage 1, the mirror):
    python3 scripts/cbp-push.py <life/chinese folder> [--site URL] [--today YYYY-MM-DD] [--dry]
  Sends only what changed since last time (by fingerprint), deletes what's gone, then sends words.py's answers for today
  so the website can check its engine against them (the `checks` table). After three nights running that all match,
  the website becomes the source (it says so); from then on the mirror refuses to run.

Once the website is the source (`--where` prints which one is):
    --pull    bring the website's changes down: files merged both ways (a file changed on both sides keeps the website's,
              the Mac's goes to .db/conflicts/), the board's documents into .db/cbp/<collection>/ and where words.py
              sync reads them (.db/board/, .db/cards/)
    --push [--test .db/test-send.json]
              send the Mac's changes up: files words.py changed, the writes in .db/out/sync.json, a new test; each
              only if the website's copy is still the one pulled (else it is reported and kept for the next night);
              then words.py's answers for today, so the nightly check keeps running
    --media FILE ...   upload a test's audio or pictures; prints their addresses (for media.py attach)
    --anki    the notes made on /plus and carded, not yet in Anki: pictures and sounds into Anki's media folder,
              the notes into anki/cbp-<date>.txt (File → Import in Anki: note type Chinese, deck Chinese)
    --adopt DIR   documents from the old claude.ai board (ArtifactData lists with out_dir DIR) changed there after
              the switch: brought over where the website's copy wasn't changed since, reported where both were

The key is CBP_PUSH_KEY in ~/.cbp-push.env (the Worker secret of the same name).
"""
import hashlib, json, os, shutil, subprocess, sys, tempfile, urllib.request, datetime, re
from pathlib import Path

SITE = 'https://chinese.cristianbagrin.com'
SKIP_DIRS = {'graded-readers', 'reference', '__pycache__', 'board', 'online-plan', '.db'}
TEXT = ('.md', '.txt', '.tsv')
ANKI_MEDIA = Path(os.environ.get('CBP_ANKI_MEDIA') or Path.home() / 'Library' / 'Application Support' / 'Anki2' / 'Chris' / 'collection.media')


def key():
    k = os.environ.get('CBP_PUSH_KEY')
    env = Path.home() / '.cbp-push.env'
    if not k and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith('CBP_PUSH_KEY='):
                k = line.split('=', 1)[1].strip().strip('"')
    if not k:
        sys.exit('No CBP_PUSH_KEY (put it in ~/.cbp-push.env).')
    return k


def files_from(d: Path):
    """The names engine.ts reads, plus every other text file of the system (history, monthly test...)."""
    f = {}
    for p in d.iterdir():
        if p.is_file() and p.suffix in TEXT:
            f[p.name] = p.read_text(encoding='utf-8')
    for sub in ('data', 'imported', 'anki'):
        if (d / sub).is_dir():
            for p in sorted((d / sub).iterdir()):
                if p.is_file() and p.suffix in TEXT and not p.name.startswith('cbp-'):
                    f[f'{sub}/{p.name}'] = p.read_text(encoding='utf-8')
    anki = sorted((d / 'anki').glob('anki-export-*.txt'), key=lambda p: p.stat().st_mtime) if (d / 'anki').is_dir() else []
    if anki:
        f['anki/latest.txt'] = anki[-1].read_text(encoding='utf-8')
    board = d / '.db' / 'board' / 'data.json'
    if board.exists():
        f['board/data.json'] = board.read_text(encoding='utf-8')
    return f


def docs_from(d: Path):
    """The board's documents as pulled into .db/cbp/<collection>/<id>.json."""
    out = {}
    root = d / '.db' / 'cbp'
    if root.is_dir():
        for col in sorted(root.iterdir()):
            if col.is_dir():
                for p in sorted(col.glob('*.json')):
                    out[(col.name, p.stem)] = json.loads(p.read_text(encoding='utf-8'))
    return out


def sha(text: str):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def js(data):
    """JSON.stringify's spelling, so unchanged documents match the Worker's fingerprint."""
    return json.dumps(data, ensure_ascii=False, separators=(',', ':'))


def outputs(d: Path, today: str):
    """words.py's answers, run on a copy (board writes files)."""
    with tempfile.TemporaryDirectory() as tmp:
        w = Path(tmp)
        for p in d.iterdir():
            if p.name in SKIP_DIRS - {'.db'}:
                continue
            (shutil.copytree if p.is_dir() else shutil.copy2)(p, w / p.name)
        py = lambda *a: subprocess.run([sys.executable, str(w / 'words.py'), '--today', today, *a], cwd=w, capture_output=True, text=True, check=True).stdout
        out = {'status': py('status'), 'test': py('test'), 'test --all': py('test', '--all')}
        py('board')
        out['board'] = (w / '.db' / 'push.json').read_text(encoding='utf-8')
        return out


def post(site, path, k, body, raw=None, ctype='application/json'):
    data = raw if raw is not None else json.dumps(body, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(site + path, data=data, method='POST',
                                 headers={'Authorization': f'Bearer {k}', 'Content-Type': ctype, 'User-Agent': 'cbp-push'})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())


# ---------- what the Mac last agreed with the website on ----------
def state_path(d: Path):
    return d / '.db' / 'cbp-sync.json'


def load_state(d: Path):
    p = state_path(d)
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else {'files': {}, 'docs': {}}


def save_state(d: Path, st):
    p = state_path(d)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(st, ensure_ascii=False, indent=1), encoding='utf-8')


def write_file(d: Path, name: str, text):
    """A file from the website, where the Mac keeps it (board/data.json lives in .db)."""
    p = d / '.db' / 'board' / 'data.json' if name == 'board/data.json' else d / name
    if name == 'anki/latest.txt':
        return  # a copy of the newest export, made by files_from
    if text is None:
        if p.exists():
            p.unlink()
        return
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding='utf-8')


# ---------- the mirror (the Mac is the source) ----------
def mirror(d, site, k, today, dry):
    have = post(site, '/api/plus/push/manifest', k, {})
    if have.get('source'):
        sys.exit(f"The website is the source since {have['source']}: use --pull and --push, not the mirror.")
    files, docs = files_from(d), docs_from(d)
    send_files = {n: t for n, t in files.items() if have['files'].get(n) != sha(t)}
    send_files.update({n: None for n in have['files'] if n not in files})
    send_docs = [{'col': c, 'id': i, 'data': v} for (c, i), v in docs.items() if have['docs'].get(f'{c}/{i}') != sha(js(v))]
    send_docs += [{'col': ci.split('/', 1)[0], 'id': ci.split('/', 1)[1], 'data': None} for ci in have['docs'] if tuple(ci.split('/', 1)) not in docs and not ci.startswith(('pics/', 'notes/'))]
    gone = [n for n, t in send_files.items() if t is None] + [f"{x['col']}/{x['id']}" for x in send_docs if x['data'] is None]
    print(f'{len(send_files) - len([1 for t in send_files.values() if t is None])} file(s), '
          f'{len([x for x in send_docs if x["data"] is not None])} document(s) changed; {len(gone)} gone{": " + ", ".join(gone) if gone else ""}')
    if dry:
        return 0
    r = post(site, '/api/plus/push', k, {'files': send_files, 'docs': send_docs, 'check': {'day': today, 'outputs': outputs(d, today)}})
    bad = [n for n, ok in (r.get('checks') or {}).items() if not ok]
    print(f'{today}: engine matches words.py' if not bad else f'{today}: engine differs from words.py on {", ".join(bad)}')
    # what both sides now hold, for the first --pull after the switch
    save_state(d, {'files': {n: sha(t) for n, t in files.items()}, 'docs': {f'{c}/{i}': sha(js(v)) for (c, i), v in docs.items()},
                   'switch_docs': {f'{c}/{i}': sha(js(v)) for (c, i), v in docs.items()}})
    if bad:
        return 1
    s = post(site, '/api/plus/push/switch', k, {})
    if s.get('switched'):
        print(f"Three nights matched: the website is the source from now on ({s['source']}). Chris makes his cards, tests and essays on /plus.")
    return 0


# ---------- the website is the source ----------
def pull(d, site, k):
    have = post(site, '/api/plus/push/manifest', k, {})
    if not have.get('source'):
        sys.exit('The Mac is still the source: run the mirror.')
    st = load_state(d)
    local = files_from(d)
    want = [n for n, s in have['files'].items() if local.get(n) is None or sha(local[n]) != s]
    got = post(site, '/api/plus/push/pull', k, {'files': want})['files'] if want else {}
    conflicts, down = [], []
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M')
    for n, s in have['files'].items():
        if n not in got:
            if n in local and sha(local[n]) == s:
                st['files'][n] = s  # the same on both sides
            continue
        base, mine = st['files'].get(n), (sha(local[n]) if n in local else None)
        if mine is not None and mine != base:  # changed on the Mac too: the website's wins, the Mac's is kept aside
            keep = d / '.db' / 'conflicts' / f'{stamp}-{n.replace("/", "_")}'
            keep.parent.mkdir(parents=True, exist_ok=True)
            keep.write_text(local[n], encoding='utf-8')
            conflicts.append(n)
        write_file(d, n, got[n]['text'])
        st['files'][n] = s
        down.append(n)
    for n in list(st['files']):
        if n not in have['files'] and n in local and sha(local[n]) == st['files'][n]:  # deleted on the website
            write_file(d, n, None)
            del st['files'][n]
            down.append(f'{n} (gone)')
    # the board's documents: all of them, fresh
    keys = list(have['docs'])
    docs = {}
    for i in range(0, len(keys), 500):
        docs.update(post(site, '/api/plus/push/pull', k, {'docs': keys[i:i + 500]})['docs'])
    root = d / '.db' / 'cbp'
    shutil.rmtree(root, ignore_errors=True)
    shutil.rmtree(d / '.db' / 'cards', ignore_errors=True)
    for ci, v in docs.items():
        col, i = ci.split('/', 1)
        text = json.dumps(v['data'], ensure_ascii=False, indent=1)
        (root / col).mkdir(parents=True, exist_ok=True)
        (root / col / f'{i}.json').write_text(text, encoding='utf-8')
        if col == 'cards':  # where words.py sync files them from
            (d / '.db' / 'cards').mkdir(parents=True, exist_ok=True)
            (d / '.db' / 'cards' / f'{i}.json').write_text(text, encoding='utf-8')
        if col == 'board' and i in ('data', 'test'):
            (d / '.db' / 'board').mkdir(parents=True, exist_ok=True)
            (d / '.db' / 'board' / f'{i}.json').write_text(text, encoding='utf-8')
    st['docs'] = {ci: v['sha'] for ci, v in docs.items()}
    save_state(d, st)
    print(f'{len(down)} file(s) from the website{": " + ", ".join(down) if down else ""}; {len(docs)} documents')
    if conflicts:
        print(f'CONFLICT (changed on both sides; the website\'s kept, the Mac\'s in .db/conflicts/): {", ".join(conflicts)}')


def push_changes(d, site, k, today, test=None):
    st = load_state(d)
    if not st['docs']:
        sys.exit('Pull first (--pull).')
    local = files_from(d)
    files = {n: t for n, t in local.items() if sha(t) != st['files'].get(n) and n != 'anki/latest.txt'}
    files.update({n: None for n in st['files'] if n not in local and n != 'anki/latest.txt'})
    docs, ops = [], []
    sync = d / '.db' / 'out' / 'sync.json'
    if sync.exists() and sync.stat().st_mtime >= state_path(d).stat().st_mtime:
        ops = json.loads(sync.read_text(encoding='utf-8'))
    for o in ops:
        data = o.get('data')
        if o.get('file_path'):
            data = json.loads(Path(o['file_path']).read_text(encoding='utf-8'))
        docs.append({'col': o['collection'], 'id': o['doc_id'], 'op': 'update' if o['op'] == 'update' else 'set', 'data': data})
    if test:
        docs.append({'col': 'board', 'id': 'test', 'op': 'set', 'data': json.loads(Path(test).read_text(encoding='utf-8'))})
    # each document once, the later write merged onto the earlier (the server applies them in order with one base)
    merged = {}
    for x in docs:
        ci = f"{x['col']}/{x['id']}"
        if ci in merged and x['op'] == 'update':
            merged[ci]['data'] = {**(merged[ci]['data'] or {}), **x['data']}
        else:
            merged[ci] = x if ci not in merged else {**x, 'op': 'set'}
    docs = list(merged.values())
    bases = {'files': {n: st['files'].get(n) for n in files}, 'docs': {ci: st['docs'].get(ci) for ci in merged}}
    r = post(site, '/api/plus/push', k, {'files': files, 'docs': docs, 'bases': bases, 'check': {'day': today, 'outputs': outputs(d, today)}})
    bad = [n for n, ok in (r.get('checks') or {}).items() if not ok]
    sent = [n for n in files if n not in r['conflicts']] + [ci for ci in merged if ci not in r['conflicts']]
    print(f'Sent {len(sent)}: {", ".join(sent) or "nothing"}')
    if r['conflicts']:
        print(f'NOT SENT (the website changed them since the pull; pull again, then run words.py and push): {", ".join(r["conflicts"])}')
    for n in files:
        if n not in r['conflicts']:
            if files[n] is None:
                st['files'].pop(n, None)
            else:
                st['files'][n] = sha(files[n])
    if ops and sync.exists():
        sync.rename(sync.with_suffix('.sent.json'))
    save_state(d, st)
    print(f'{today}: engine matches words.py' if not bad else f'{today}: engine differs from words.py on {", ".join(bad)}')
    return 1 if bad or r['conflicts'] else 0


def media(site, k, paths):
    types = {'.mp4': 'audio/mp4', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'}
    for p in paths:
        p = Path(p)
        r = post(site, '/api/plus/push/media', k, None, raw=p.read_bytes(), ctype=types.get(p.suffix.lower(), 'application/octet-stream'))
        print(site + r['url'])


def anki(d, site, k):
    """Carded notes from /plus that Anki doesn't have yet, as a file Anki imports."""
    have = post(site, '/api/plus/push/manifest', k, {})
    keys = [ci for ci in have['docs'] if ci.startswith('notes/')]
    if not keys:
        print('No notes to hand to Anki.')
        return
    got = post(site, '/api/plus/push/pull', k, {'docs': keys + ['cards/' + ci.split('/', 1)[1] for ci in keys]})['docs']
    todo = [(ci, v) for ci, v in got.items() if ci.startswith('notes/') and not v['data'].get('exported')
            and (got.get('cards/' + ci.split('/', 1)[1]) or {}).get('data', {}).get('carded')]
    if not todo:
        print('No new notes for Anki.')
        return
    if not ANKI_MEDIA.is_dir():
        sys.exit(f'No Anki media folder at {ANKI_MEDIA}.')

    def fetch(url):
        if not url or not url.startswith('/api/plus/media/'):
            return ''
        name = 'cbp-' + url.rsplit('/', 1)[1]
        if not (ANKI_MEDIA / name).exists():
            req = urllib.request.Request(site + url, headers={'User-Agent': 'cbp-push'})
            with urllib.request.urlopen(req, timeout=60) as r:
                (ANKI_MEDIA / name).write_bytes(r.read())
        return name

    one = lambda s: re.sub(r'[\t\r\n]+', ' ', str(s or ''))
    rows = []
    for ci, v in sorted(todo, key=lambda x: x[1]['data'].get('made') or ''):
        n = v['data']
        pic, snd = fetch(n.get('picture')), fetch(n.get('audio'))
        notes = '<br>'.join(str(n.get('notes') or '').split('\n'))
        rows.append('\t'.join(one(x) for x in [n.get('chinese'), n.get('word'), f'<img src="{pic}">' if pic else '', notes, n.get('pinyin'), f'[sound:{snd}]' if snd else '']))
    day = datetime.date.today().isoformat()
    out = d / 'anki' / f'cbp-{day}.txt'
    out.parent.mkdir(exist_ok=True)
    head = '#separator:tab\n#html:true\n#notetype:Chinese\n#deck:Chinese\n#columns:Chinese\tWord\tPicture\tNotes\tPinyin\tAudio\n'
    old = out.read_text(encoding='utf-8').split('\n')[5:] if out.exists() else []
    out.write_text(head + '\n'.join([l for l in old if l.strip()] + rows) + '\n', encoding='utf-8')
    docs = [{'col': 'notes', 'id': ci.split('/', 1)[1], 'op': 'update', 'data': {'exported': day}} for ci, _ in todo]
    r = post(site, '/api/plus/push', k, {'docs': docs, 'bases': {'docs': {ci: v['sha'] for ci, v in todo}}})
    print(f'{len(todo)} note(s) for Anki in {out.relative_to(d)}: in Anki, File → Import that file.'
          + (f' ({len(r["conflicts"])} changed while this ran: they come again next time)' if r.get('conflicts') else ''))


def adopt(d, site, k, src):
    """Documents edited on the old claude.ai board after the switch."""
    st = load_state(d)
    at_switch = st.get('switch_docs') or {}
    have = post(site, '/api/plus/push/manifest', k, {})
    take, both = [], []
    for col in sorted(Path(src).iterdir()):
        if not col.is_dir():
            continue
        for p in sorted(col.glob('*.json')):
            ci, v = f'{col.name}/{p.stem}', json.loads(p.read_text(encoding='utf-8'))
            if sha(js(v)) in (at_switch.get(ci), have['docs'].get(ci)):
                continue  # unchanged on the old board, or the same on both
            if have['docs'].get(ci) == at_switch.get(ci):
                take.append({'col': col.name, 'id': p.stem, 'data': v})
            else:
                both.append(ci)
    if take:
        r = post(site, '/api/plus/push', k, {'docs': take, 'bases': {'docs': {f"{x['col']}/{x['id']}": have['docs'].get(f"{x['col']}/{x['id']}") for x in take}}})
        print(f'From the old board: {", ".join(x["col"] + "/" + x["id"] for x in take)}' + (f'; not taken: {", ".join(r["conflicts"])}' if r['conflicts'] else ''))
    if both:
        print(f'Changed on the old board AND on /plus (left as /plus has them; the old board\'s copy is in {src}): {", ".join(both)}')
    if not take and not both:
        print('Nothing new on the old board.')


def main():
    a = sys.argv[1:]
    if not a or a[0].startswith('-'):
        sys.exit(__doc__)
    d = Path(a[0]).expanduser()
    opt = lambda n, dflt=None: a[a.index(n) + 1] if n in a else dflt
    site, dry = opt('--site', SITE).rstrip('/'), '--dry' in a
    today = opt('--today') or subprocess.run(['date', '+%Y-%m-%d'], capture_output=True, text=True).stdout.strip()
    k = key()
    if '--where' in a:
        s = post(site, '/api/plus/push/manifest', k, {}).get('source')
        print(f'website (since {s})' if s else 'mac')
    elif '--pull' in a:
        pull(d, site, k)
    elif '--push' in a:
        sys.exit(push_changes(d, site, k, today, opt('--test')))
    elif '--media' in a:
        media(site, k, a[a.index('--media') + 1:])
    elif '--anki' in a:
        anki(d, site, k)
    elif '--adopt' in a:
        adopt(d, site, k, opt('--adopt'))
    else:
        sys.exit(mirror(d, site, k, today, dry))


if __name__ == '__main__':
    main()
