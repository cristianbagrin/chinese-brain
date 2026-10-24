#!/usr/bin/env python3
"""Build the Chinese web font for the extension's pages (word list, settings, toolbar menu).

The word list writes each word in 田字格 squares, like a practice book, in the font picked
below (all SIL Open Font License). A full Chinese font is 5-17 MB; this keeps the 7,000
characters people meet most (ranked by word frequency in static/data/dict.tsv.gz) plus Latin,
pinyin and punctuation, as WOFF2. Rarer characters fall back to the system's Chinese font.

Output: static/fonts/zh.woff2 (regular), static/fonts/zh-bold.woff2 (only the name 中文腦 and
the stamps 新學熟) and static/fonts/OFL.txt (the font's license).

Usage: python3 scripts/build_fonts.py [kai|song|hei|round]   (needs: pip install fonttools brotli)
Source fonts are downloaded to .cache/fonts/.
"""
import gzip
import io
import os
import sys
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.cache', 'fonts')
OUT = os.path.join(ROOT, 'static', 'fonts')
GF = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'

# Each choice: (regular, bold) as (file, url, weight to pin for variable fonts).
FONTS = {
    'kai': (('LXGWWenKaiTC-Regular.ttf', GF + 'lxgwwenkaitc/LXGWWenKaiTC-Regular.ttf', None),
            ('LXGWWenKaiTC-Bold.ttf', GF + 'lxgwwenkaitc/LXGWWenKaiTC-Bold.ttf', None)),
    'song': (('NotoSerifTC.ttf', GF + 'notoseriftc/NotoSerifTC%5Bwght%5D.ttf', 500),
             ('NotoSerifTC.ttf', GF + 'notoseriftc/NotoSerifTC%5Bwght%5D.ttf', 900)),
    'hei': (('NotoSansTC.ttf', GF + 'notosanstc/NotoSansTC%5Bwght%5D.ttf', 500),
            ('NotoSansTC.ttf', GF + 'notosanstc/NotoSansTC%5Bwght%5D.ttf', 900)),
    'round': (('jf-openhuninn-2.1.ttf', 'https://raw.githubusercontent.com/justfont/open-huninn-font/master/font/jf-openhuninn-2.1.ttf', None),
              ('jf-openhuninn-2.1.ttf', 'https://raw.githubusercontent.com/justfont/open-huninn-font/master/font/jf-openhuninn-2.1.ttf', None)),
}
# Each font's license, shipped next to it (OFL 1.1 asks for the notice to travel with the font).
LICENSES = {
    'kai': GF + 'lxgwwenkaitc/OFL.txt',
    'song': GF + 'notoseriftc/OFL.txt',
    'hei': GF + 'notosanstc/OFL.txt',
    'round': 'https://raw.githubusercontent.com/justfont/open-huninn-font/master/LICENSE',
}
HAN_COUNT = 7000
PINYIN = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛÜ'
PUNCT = '，。、；：？！「」『』（）《》〈〉【】…⋯—–～・·‧％＋－＝／＃＆＊＠“”‘’' + ''.join(chr(c) for c in range(0xFF10, 0xFF1A))
BOLD_TEXT = '中文腦新學熟'


def source(name: str, url: str) -> str:
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        print('downloading', url)
        urllib.request.urlretrieve(url, path)
    return path


def ranked_han() -> str:
    """Characters by how common the words they're in are (best zipf of any word with them)."""
    best: dict[str, float] = {}
    with gzip.open(os.path.join(ROOT, 'static', 'data', 'dict.tsv.gz'), 'rt', encoding='utf8') as f:
        for line in f:
            if line.startswith('#'):
                continue
            cols = line.rstrip('\n').split('\t')
            zipf = float(cols[5] or 0)
            for ch in cols[0]:
                if '㐀' <= ch <= '鿿' or '豈' <= ch <= '﫿':
                    best[ch] = max(best.get(ch, 0), zipf)
    return ''.join(sorted(best, key=lambda c: -best[c]))


def build(src: str, weight, text: str, out: str):
    font = TTFont(src)
    if weight is not None and 'fvar' in font:
        font = instancer.instantiateVariableFont(font, {'wght': weight})
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.hinting = False
    opts.desubroutinize = True
    opts.name_IDs = ['*']  # keep the copyright and license
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    buf = io.BytesIO()
    font.flavor = 'woff2'
    font.save(buf)
    with open(out, 'wb') as f:
        f.write(buf.getvalue())
    print(f'{os.path.relpath(out, ROOT)}: {len(buf.getvalue()) / 1e6:.2f} MB')


def main():
    choice = sys.argv[1] if len(sys.argv) > 1 else 'kai'
    (rname, rurl, rw), (bname, burl, bw) = FONTS[choice]
    os.makedirs(OUT, exist_ok=True)
    text = ranked_han()[:HAN_COUNT] + ''.join(chr(c) for c in range(0x20, 0x7F)) + PINYIN + PUNCT + BOLD_TEXT
    build(source(rname, rurl), rw, text, os.path.join(OUT, 'zh.woff2'))
    build(source(bname, burl), bw, BOLD_TEXT, os.path.join(OUT, 'zh-bold.woff2'))
    with open(source(f'LICENSE-{choice}.txt', LICENSES[choice]), encoding='utf8') as f, open(os.path.join(OUT, 'OFL.txt'), 'w', encoding='utf8') as out:
        out.write(f.read())


if __name__ == '__main__':
    main()
