#!/usr/bin/env python3
"""Copy Chris's board (life/chinese/board, the claude.ai artifact's source) into Chinese Brain Plus at /plus.

    python3 scripts/cbp-board.py <life/chinese/board folder>

Writes site/public/plus.html (the board's page, its scripts listed for plus.js to load once the account is let in)
and site/public/plus/board/{js,css}/. Leaves out dev/ and the saved copy of his data (SNAPSHOT): the files are public,
so nothing personal goes in them; /plus reads everything from the CBP database (plus/runtime.js).
"""
import re, shutil, sys
from pathlib import Path

if len(sys.argv) != 2:
    sys.exit(__doc__)
SRC = Path(sys.argv[1]).expanduser()
PUB = Path(__file__).resolve().parent.parent / 'site' / 'public'
OUT = PUB / 'plus' / 'board'
EMPTY = 'const SNAPSHOT = {"months":{},"nextUp":[],"tests":{},"total":0,"words":{}};\n'

page = (SRC / 'index.html').read_text(encoding='utf-8')
css = re.findall(r'href="(css/[^"]+)"', page)
js = [f for f in re.findall(r'<script src="([^"]+)"', page) if not f.startswith('dev/')]
body = page[page.index('<header class="appbar"'):page.index('<!--@JS@-->')].rstrip() + '\n'
assert 'SNAPSHOT' not in body and '<script' not in body

if OUT.exists():
    shutil.rmtree(OUT)
for f in css + js:
    (OUT / f).parent.mkdir(parents=True, exist_ok=True)
    text = (SRC / f).read_text(encoding='utf-8')
    if f == 'js/core.js':
        text, n = re.subn(r'^const SNAPSHOT = .*\n', EMPTY, text, count=1, flags=re.M)
        assert n == 1, 'no SNAPSHOT line in core.js'
    (OUT / f).write_text(text, encoding='utf-8')

links = '\n'.join(f'<link rel="stylesheet" href="/plus/board/{f}">' for f in css)
(PUB / 'plus.html').write_text(f'''<!doctype html>
<html lang="en" class="locked">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Chinese Brain Plus</title>
<link rel="icon" href="/icon.png">
<meta name="robots" content="noindex">
<style>:root{{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}html{{scroll-padding-top:env(safe-area-inset-top,0px)}}body{{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}}img{{max-width:100%}}[hidden]:not([hidden=until-found i]){{display:none!important}}html.locked body{{visibility:hidden}}</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..650&family=Noto+Sans+TC:wght@400..600&family=LXGW+WenKai+TC:wght@400;700&family=Noto+Serif+TC:wght@500;700;900&display=swap">
{links}
</head>
<body>
{body}<script src="/plus/runtime.js"></script>
<script src="/plus.js" data-board="{' '.join(js)}"></script>
</body>
</html>
''', encoding='utf-8')
print(f'plus.html, {len(css)} stylesheets, {len(js)} scripts')
