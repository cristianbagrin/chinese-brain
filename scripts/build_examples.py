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
    # Base: the numbered generation output; then the editors' corrections (fix-*.tsv).
    base_path = os.path.join(ROOT, "data-src", "examples", "all-numbered.tsv")
    base = {}
    with open(base_path, encoding="utf-8") as f:
        for raw in f:
            n, w, zh, en = raw.rstrip("\n").split("\t")
            base[int(n)] = [w, zh, en]
    drop_words = set()
    fixed = dropped = 0
    for path in sorted(glob.glob(os.path.join(ROOT, "data-src", "examples", "fix-*.tsv"))):
        with open(path, encoding="utf-8") as f:
            for raw in f:
                c = raw.rstrip("\n").split("\t")
                if len(c) < 2 or not c[0].strip().isdigit() or int(c[0]) not in base:
                    continue
                n, action = int(c[0]), c[1].strip()
                if action == "fix" and len(c) >= 4 and c[2].strip():
                    base[n][1], base[n][2] = c[2].strip(), c[3].strip()
                    fixed += 1
                elif action == "drop":
                    base[n] = None
                    dropped += 1
                elif action == "dropword":
                    drop_words.add(base[n][0])
    print(f"applied {fixed} fixes, {dropped} drops, {len(drop_words)} headwords removed", file=sys.stderr)
    rows = [v for _, v in sorted(base.items()) if v and v[0] not in drop_words]
    for w, zh, en in rows:
        w, zh, en = w.strip(), zh.strip(), en.strip()
        # Full-width punctuation in Chinese text.
        zh = re.sub(r"(?<=[\u3400-\u9fff」』）]),\s*", "，", zh)
        zh = re.sub(r"(?<=[\u3400-\u9fff」』）])\?", "？", zh)
        zh = re.sub(r"(?<=[\u3400-\u9fff」』）])!", "！", zh)
        zh = re.sub(r"(?<=[\u3400-\u9fff」』）]):", "：", zh)
        bad = ""
        if w not in zh:
            bad = "word missing"
        elif any(ch in simp_only for ch in zh):
            bad = "simplified"
        elif ERHUA.search(zh):
            bad = "erhua"
        elif not 3 <= len(zh) <= 45:
            bad = "length"
        elif not en or re.search(r"[\u4e00-\u9fff]", en):
            bad = "english"
        if bad:
            rejects.append((bad, f"{w}\t{zh}\t{en}"))
            continue
        lst = seen.setdefault(w, [])
        if zh in (x for x, _ in lst) or len(lst) >= 2:
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
