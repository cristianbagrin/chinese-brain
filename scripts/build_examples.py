#!/usr/bin/env python3
"""Validate and pack the example sentences into static/data/examples.tsv.gz.

Input: data-src/examples/out-*.tsv (word, sentence, English), written by
language models from data-src/examples/PROMPT.md and spot-checked.
Checks: the headword appears, Traditional characters only (no character that
exists only as a Simplified form in CC-CEDICT), no 兒化, sane length.
"""
import glob
import gzip
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT = os.path.join(ROOT, "static", "data", "dict.tsv.gz")
OUT = os.path.join(ROOT, "static", "data", "examples.tsv.gz")
REJECTS = os.path.join(ROOT, "data-src", "examples", "rejects.tsv")


def simplified_only_chars():
    trad, simp = set(), set()
    with gzip.open(DICT, "rt", encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                continue
            t, s = line.split("\t", 2)[:2]
            trad.update(t)
            simp.update(s)
    return simp - trad


ERHUA = re.compile(r"(這兒|那兒|哪兒|一點兒|一會兒|玩兒|事兒|味兒|好玩兒)")


def main():
    simp_only = simplified_only_chars()
    seen = {}
    rejects = []
    files = sorted(glob.glob(os.path.join(ROOT, "data-src", "examples", "out-*.tsv")))
    files.append(os.path.join(ROOT, "data-src", "examples", "pilot-out.tsv"))
    for path in files:
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            for raw in f:
                line = raw.rstrip("\n")
                if not line.strip():
                    continue
                cols = line.split("\t")
                if len(cols) != 3:
                    rejects.append(("columns", line))
                    continue
                w, zh, en = (c.strip() for c in cols)
                bad = ""
                if w not in zh:
                    bad = "word missing"
                elif any(ch in simp_only for ch in zh):
                    bad = "simplified"
                elif ERHUA.search(zh):
                    bad = "erhua"
                elif not 3 <= len(zh) <= 45:
                    bad = "length"
                elif not en or re.search(r"[一-鿿]", en):
                    bad = "english"
                if bad:
                    rejects.append((bad, line))
                    continue
                lst = seen.setdefault(w, [])
                if zh in (s for s, _ in lst) or len(lst) >= 2:
                    continue
                lst.append((zh, en))
    with gzip.open(OUT, "wt", encoding="utf-8", compresslevel=9) as f:
        for w, lst in seen.items():
            for zh, en in lst:
                f.write(f"{w}\t{zh}\t{en}\n")
    with open(REJECTS, "w", encoding="utf-8") as f:
        for why, line in rejects:
            f.write(f"{why}\t{line}\n")
    n = sum(len(v) for v in seen.values())
    print(f"{len(seen)} words, {n} sentences, {len(rejects)} rejected -> {OUT} ({os.path.getsize(OUT) / 1e6:.2f} MB)", file=sys.stderr)


if __name__ == "__main__":
    main()
