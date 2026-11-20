#!/usr/bin/env python3
"""Push Chris's Chinese system from the Mac to Chinese Brain Plus (Stage 1: the Mac is still the source).

    python3 scripts/cbp-push.py <life/chinese folder> [--site URL] [--today YYYY-MM-DD] [--dry]

Sends only what changed since last time (by fingerprint), deletes what's gone, then sends words.py's answers
for today so the website can check its engine against them (the `checks` table; /api/plus/checks shows them).
The key is CBP_PUSH_KEY in ~/.cbp-push.env (the Worker secret of the same name). Standard library only.
"""
import hashlib, json, os, shutil, subprocess, sys, tempfile, urllib.request
from pathlib import Path

SITE = 'https://chinese.cristianbagrin.com'
SKIP_DIRS = {'graded-readers', 'reference', '__pycache__', 'board', 'online-plan', '.db'}
TEXT = ('.md', '.txt', '.tsv')


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
                if p.is_file() and p.suffix in TEXT:
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


def post(site, path, k, body):
    req = urllib.request.Request(site + path, data=json.dumps(body, ensure_ascii=False).encode('utf-8'), method='POST',
                                 headers={'Authorization': f'Bearer {k}', 'Content-Type': 'application/json', 'User-Agent': 'cbp-push'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def main():
    a = sys.argv[1:]
    if not a or a[0].startswith('-'):
        sys.exit(__doc__)
    d = Path(a[0]).expanduser()
    opt = lambda n, dflt=None: a[a.index(n) + 1] if n in a else dflt
    site, dry = opt('--site', SITE).rstrip('/'), '--dry' in a
    today = opt('--today') or subprocess.run(['date', '+%Y-%m-%d'], capture_output=True, text=True).stdout.strip()
    k = key()
    have = post(site, '/api/plus/push/manifest', k, {})
    files, docs = files_from(d), docs_from(d)
    send_files = {n: t for n, t in files.items() if have['files'].get(n) != sha(t)}
    send_files.update({n: None for n in have['files'] if n not in files})
    send_docs = [{'col': c, 'id': i, 'data': v} for (c, i), v in docs.items() if have['docs'].get(f'{c}/{i}') != sha(js(v))]
    send_docs += [{'col': ci.split('/', 1)[0], 'id': ci.split('/', 1)[1], 'data': None} for ci in have['docs'] if tuple(ci.split('/', 1)) not in docs]
    gone = [n for n, t in send_files.items() if t is None] + [f"{x['col']}/{x['id']}" for x in send_docs if x['data'] is None]
    print(f'{len(send_files) - len([1 for t in send_files.values() if t is None])} file(s), '
          f'{len([x for x in send_docs if x["data"] is not None])} document(s) changed; {len(gone)} gone{": " + ", ".join(gone) if gone else ""}')
    if dry:
        return
    r = post(site, '/api/plus/push', k, {'files': send_files, 'docs': send_docs, 'check': {'day': today, 'outputs': outputs(d, today)}})
    bad = [n for n, ok in (r.get('checks') or {}).items() if not ok]
    print(f'{today}: engine matches words.py' if not bad else f'{today}: engine differs from words.py on {", ".join(bad)}')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
