#!/usr/bin/env python3
"""Build the bundled dictionary file for Chinese Brain.

Inputs (downloaded into .cache/ on first run):
  - CC-CEDICT (MDBG), CC BY-SA 4.0
  - MOE Revised Mandarin Dictionary (教育部重編國語辭典修訂本) via g0v/moedict-data,
    CC BY-ND 3.0 TW. Only the pinyin field is used, unchanged, to give Taiwan
    standard readings (the MOE states format conversion and reuse are allowed).
  - wordfreq (Zipf frequencies, CC BY-SA 4.0), installed with pip
  - data-src/tocfl.tsv (TOCFL levels, from LingLook, GPL-3.0)

Output: static/data/dict.tsv.gz, one entry per line:
  trad  simp  pinyin  tw_pinyin  defs  zipf  tocfl
  pinyin / tw_pinyin are numbered ("xing1 qi1"); tw_pinyin is empty when the
  Taiwan reading is the same. zipf is Zipf*10 as an integer (0 when unknown).

Usage: python3 scripts/build_data.py   (needs: pip install wordfreq)
"""
import gzip
import io
import json
import lzma
import math
import os
import re
import sys
import unicodedata
import urllib.request
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from american import definition as american  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache")
OUT = os.path.join(ROOT, "static", "data", "dict.tsv.gz")

CEDICT_URL = "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.zip"
MOE_URL = "https://raw.githubusercontent.com/g0v/moedict-data/master/dict-revised.json.xz"


def fetch(url, name):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        print("downloading", url, file=sys.stderr)
        with urllib.request.urlopen(url, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


TONE_MARKS = {
    "ā": ("a", 1), "á": ("a", 2), "ǎ": ("a", 3), "à": ("a", 4),
    "ē": ("e", 1), "é": ("e", 2), "ě": ("e", 3), "è": ("e", 4),
    "ī": ("i", 1), "í": ("i", 2), "ǐ": ("i", 3), "ì": ("i", 4),
    "ō": ("o", 1), "ó": ("o", 2), "ǒ": ("o", 3), "ò": ("o", 4),
    "ū": ("u", 1), "ú": ("u", 2), "ǔ": ("u", 3), "ù": ("u", 4),
    "ǖ": ("u:", 1), "ǘ": ("u:", 2), "ǚ": ("u:", 3), "ǜ": ("u:", 4), "ü": ("u:", 0),
    "ê": ("e", 0), "ề": ("e", 4), "ế": ("e", 2),
}


def marked_to_numbered(syl):
    """'xīng' -> 'xing1', 'de' -> 'de5'."""
    tone = 5
    out = []
    for ch in unicodedata.normalize("NFC", syl):
        if ch in TONE_MARKS:
            base, t = TONE_MARKS[ch]
            out.append(base)
            if t:
                tone = t
        else:
            out.append(ch)
    s = "".join(out).lower()
    if not re.fullmatch(r"[a-z:]+", s):
        return None
    return s + str(tone)


def moe_readings():
    """trad word -> list of numbered pinyin strings (heteronym order)."""
    path = fetch(MOE_URL, "dict-revised.json.xz")
    with lzma.open(path, "rt", encoding="utf-8") as f:
        data = json.load(f)
    out = {}
    for e in data:
        title = e.get("title", "")
        if "{" in title:
            continue
        for h in e.get("heteronyms", []):
            p = h.get("pinyin")
            if not p:
                continue
            # Drop punctuation inside phrases, keep syllables only.
            sylls = [s for s in re.split(r"[\s，；、,·\-]+", p) if s]
            nums = [marked_to_numbered(s) for s in sylls]
            if not nums or any(n is None for n in nums):
                continue
            out.setdefault(title, []).append(" ".join(nums))
    return out


CEDICT_RE = re.compile(r"^(\S+) (\S+) \[([^\]]*)\] /(.*)/\s*$")


def toneless(p):
    return re.sub(r"[1-5]", "", p.lower()).replace("v", "u:")


def norm_cedict_pinyin(p):
    # CEDICT uses u: for ü, r5 for erhua, and capitalised proper nouns.
    return " ".join(s for s in p.split(" "))


def taiwan_reading(trad, pinyin, defs, moe):
    """Return a numbered Taiwan pinyin if it differs from the CEDICT one."""
    m = re.search(r"Taiwan pr\. \[([^\]]+)\]", defs)
    cands = moe.get(trad, [])
    pl = pinyin.lower()
    if cands:
        tl = toneless(pl)
        same_sylls = [c for c in cands if toneless(c) == tl]
        if same_sylls:
            if pl in same_sylls:
                return ""
            # Only override when the MOE reading is unambiguous (a single
            # character like 和 has several readings; don't guess between them).
            if len(same_sylls) == 1:
                return same_sylls[0]
            return ""
        if m:
            return m.group(1).lower()
        # Different syllables (e.g. 垃圾 la1 ji1 vs le4 se4). Only trust the MOE
        # reading when the word has a single MOE reading and CEDICT has no other
        # entry that already matches it; that check happens in build().
        if len(cands) == 1 and len(cands[0].split()) == len(pl.split()):
            return "?" + cands[0]
        return ""
    if m:
        return m.group(1).lower()
    return ""


def clean_defs(defs):
    parts = [d for d in defs.split("/") if d and not d.startswith("Taiwan pr.")]
    return "/".join(parts).replace("\t", " ")


def main():
    try:
        from wordfreq import get_frequency_dict
    except ImportError:
        sys.exit("pip install wordfreq")
    freq = get_frequency_dict("zh", "best")

    tocfl = {}
    with open(os.path.join(ROOT, "data-src", "tocfl.tsv"), encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            w, lvl = line.rstrip("\n").split("\t")
            tocfl.setdefault(w, int(lvl))

    moe = moe_readings()
    print("MOE words:", len(moe), file=sys.stderr)

    zpath = fetch(CEDICT_URL, "cedict.zip")
    with zipfile.ZipFile(zpath) as z:
        text = z.read("cedict_ts.u8").decode("utf-8")

    entries = []
    by_trad = {}
    for line in text.splitlines():
        if line.startswith("#"):
            continue
        m = CEDICT_RE.match(line)
        if not m:
            continue
        trad, simp, pinyin, defs = m.groups()
        pinyin = norm_cedict_pinyin(pinyin)
        tw = taiwan_reading(trad, pinyin, defs, moe)
        f = freq.get(simp, 0.0)
        zipf = int(round((math.log10(f) + 9) * 10)) if f > 0 else 0
        e = [trad, simp, pinyin, tw, clean_defs(defs), zipf, tocfl.get(trad, 0)]
        entries.append(e)
        by_trad.setdefault(trad, []).append(e)

    # Resolve the uncertain "different syllables" readings: keep the MOE reading
    # only if no sibling entry of the same word already has it.
    stats = {"tw": 0, "syll": 0}
    for e in entries:
        if e[3].startswith("?"):
            cand = e[3][1:]
            if any(s[2].lower() == cand or s[3] == cand for s in by_trad[e[0]] if s is not e):
                e[3] = ""
            else:
                e[3] = cand
                stats["syll"] += 1
        if e[3]:
            stats["tw"] += 1

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    buf = io.StringIO()
    buf.write("# CC-CEDICT (MDBG, CC BY-SA 4.0); Taiwan readings: MOE 重編國語辭典修訂本 (CC BY-ND 3.0 TW); frequency: wordfreq (CC BY-SA 4.0); TOCFL levels via LingLook\n")
    for e in entries:
        e[4] = american(e[4])  # American spelling in the definitions
        buf.write("\t".join(str(x) for x in e) + "\n")
    with gzip.open(OUT, "wb", compresslevel=9) as f:
        f.write(buf.getvalue().encode("utf-8"))
    print(f"{len(entries)} entries, {stats['tw']} with a Taiwan reading ({stats['syll']} different syllables), "
          f"{os.path.getsize(OUT)/1e6:.1f} MB -> {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
