#!/usr/bin/env python3
"""Build the extra word list of names and foods for Chinese Brain.

CC-CEDICT knows few Taiwan place names, sights and dishes (野柳, 清境, 滷肉飯,
薑母鴨...). This adds them from Wikidata (CC0): everything in Taiwan that has a
Chinese Wikipedia article, plus foods and drinks that have one. Each name gets
its Traditional (Taiwan) label, the English label and description, and a
frequency from wordfreq. Readings are worked out by the extension from the
words and characters inside the name.

Output: static/data/names.tsv.gz, same columns as dict.tsv.gz, pinyin left empty:
  trad  simp  ""  ""  english/description  zipf  0

Usage: python3 scripts/build_names.py   (needs: pip install wordfreq)
Raw query results are cached in .cache/names-*.json; delete them to refresh.
"""
import gzip
import io
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from american import definition as american  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache")
DICT = os.path.join(ROOT, "static", "data", "dict.tsv.gz")
OUT = os.path.join(ROOT, "static", "data", "names.tsv.gz")
ENDPOINT = "https://query.wikidata.org/sparql"
UA = "chinese-brain-build/1.0 (https://github.com/cristianbagrin/chinese-brain)"

ZHWIKI = "?a schema:about ?item ; schema:isPartOf <https://zh.wikipedia.org/> ."
SETS = {
    # Places, sights, companies, schools... anything in Taiwan with a zh.wikipedia article.
    "taiwan": "?item wdt:P17 wd:Q865 . " + ZHWIKI,
    # Foods, dishes and drinks (from anywhere) with a zh.wikipedia article; small queries, as big ones time out.
    "food": "?item wdt:P31/wdt:P279* wd:Q2095 . " + ZHWIKI,
    "foodclass": "?item wdt:P279+ wd:Q2095 . " + ZHWIKI,
    "drink": "?item wdt:P31/wdt:P279* wd:Q40050 . " + ZHWIKI,
    "drinkclass": "?item wdt:P279+ wd:Q40050 . " + ZHWIKI,
}
CJK_ONLY = re.compile(r"^[㐀-䶿一-鿿豈-﫿]{2,8}$")


def sparql(query):
    body = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
    for attempt in range(8):
        try:
            req = urllib.request.Request(ENDPOINT, data=body, headers={
                "User-Agent": UA, "Accept": "application/sparql-results+json",
                "Content-Type": "application/x-www-form-urlencoded"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)["results"]["bindings"]
        except Exception as e:  # busy or rate-limited server (at times one query a minute): wait and retry
            print("  retry", attempt + 1, e, file=sys.stderr)
            time.sleep(65)
    raise SystemExit("Wikidata query failed: " + query[:120])


def cached(name, build):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"names-{name}.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    data = build()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    return data


def item_ids(where):
    # One go when it fits; large sets in pages (which need a stable order).
    rows = sparql(f"SELECT DISTINCT ?item WHERE {{ {where} }} LIMIT 20000")
    if len(rows) < 20000:
        return [r["item"]["value"].rsplit("/", 1)[1] for r in rows]
    ids, offset, page = [], 0, 4000
    while True:
        rows = sparql(f"SELECT DISTINCT ?item WHERE {{ {where} }} ORDER BY ?item LIMIT {page} OFFSET {offset}")
        ids += [r["item"]["value"].rsplit("/", 1)[1] for r in rows]
        print(f"  {len(ids)} items", file=sys.stderr)
        if len(rows) < page:
            return ids
        offset += page


def labels(ids):
    out = {}
    for i in range(0, len(ids), 2000):
        values = " ".join("wd:" + x for x in ids[i:i + 2000])
        rows = sparql(
            f"""SELECT ?item ?l ?d WHERE {{ VALUES ?item {{ {values} }}
              {{ ?item rdfs:label ?l FILTER(LANG(?l) IN ("zh-tw","zh-hant","zh-hk","zh-cn","zh-hans","en")) }}
              UNION {{ ?item schema:description ?d FILTER(LANG(?d) = "en") }} }}"""
        )
        for r in rows:
            rec = out.setdefault(r["item"]["value"].rsplit("/", 1)[1], {})
            for k in ("l", "d"):
                if k in r:
                    rec[(k + ":" + r[k].get("xml:lang", "")) if k == "l" else "desc"] = r[k]["value"]
        print(f"  labels {min(i + 2000, len(ids))}/{len(ids)}", file=sys.stderr)
    return out


def clean(label):
    return re.sub(r"\s*[（(][^）)]*[）)]\s*$", "", label or "").strip()


def main():
    try:
        from wordfreq import get_frequency_dict
    except ImportError:
        sys.exit("pip install wordfreq")
    freq = get_frequency_dict("zh", "best")

    known = set()
    t2s = {}
    with gzip.open(DICT, "rt", encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                continue
            trad, simp = line.split("\t", 2)[:2]
            known.add(trad)
            known.add(trad.replace("臺", "台"))
            if len(trad) == len(simp):
                for a, b in zip(trad, simp):
                    t2s.setdefault(a, b)

    kinds = {}
    for name, where in SETS.items():
        print("query", name, file=sys.stderr)
        for q in cached(name, lambda: item_ids(where)):
            kinds.setdefault(q, "place" if name == "taiwan" else "food")
    info = cached("labels", lambda: labels(sorted(kinds)))

    out = {}
    for q, kind in sorted(kinds.items()):
        rec = info.get(q, {})
        trad = clean(rec.get("l:zh-tw") or rec.get("l:zh-hant") or rec.get("l:zh-hk"))
        if not CJK_ONLY.match(trad) or trad in known or trad.replace("臺", "台") in known:
            continue
        en = clean(rec.get("l:en"))
        desc = rec.get("desc", "")
        if not en and not desc:
            continue
        simp = clean(rec.get("l:zh-cn") or rec.get("l:zh-hans"))
        if len(simp) != len(trad) or not CJK_ONLY.match(simp):
            simp = "".join(t2s.get(c, c) for c in trad)
        f = max(freq.get(simp, 0.0), freq.get(trad, 0.0))
        zipf = int(round((math.log10(f) + 9) * 10)) if f > 0 else 0
        parts = [en] if en else []
        if desc and desc.lower() != en.lower():
            parts.append(desc)
        defs = "/".join(american(d).replace("/", ", ").replace("\t", " ") for d in parts)
        prev = out.get(trad)
        # Two items with the same name: keep the better-known one (a place over a namesake school).
        if prev and prev[5] >= zipf and len(prev[4]) >= len(defs):
            continue
        out[trad] = [trad, simp, "", "", defs, zipf, 0]

    buf = io.StringIO()
    buf.write("# Names and foods from Wikidata (CC0); frequency: wordfreq (CC BY-SA 4.0)\n")
    for e in sorted(out.values()):
        buf.write("\t".join(str(x) for x in e) + "\n")
    with gzip.open(OUT, "wb", compresslevel=9) as f:
        f.write(buf.getvalue().encode("utf-8"))
    print(f"{len(out)} names, {os.path.getsize(OUT) / 1e6:.2f} MB -> {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
