import type { Entry, LookupMatch, Token } from './types.ts';

export const CJK = /[㐀-䶿一-鿿豈-﫿]/;
const MAX_WORD = 8;

/** In-memory CC-CEDICT with Taiwan readings. Built from static/data/dict.tsv.gz. */
export class Dictionary {
  entries: Entry[] = [];
  private index = new Map<string, number[]>();

  static fromTsv(text: string): Dictionary {
    const d = new Dictionary();
    let start = 0;
    while (start < text.length) {
      let end = text.indexOf('\n', start);
      if (end < 0) end = text.length;
      if (text.charCodeAt(start) !== 35 /* # */ && end > start) {
        const f = text.slice(start, end).split('\t');
        const e: Entry = {
          trad: f[0],
          simp: f[1],
          py: f[2],
          tw: f[3],
          defs: f[4].split('/'),
          zipf: Number(f[5]) || 0,
          tocfl: Number(f[6]) || 0,
        };
        const i = d.entries.push(e) - 1;
        d.add(e.trad, i);
        if (e.simp !== e.trad) d.add(e.simp, i);
      }
      start = end + 1;
    }
    d.computeRanks();
    return d;
  }

  /** Frequency rank per headword (1 = most common), from the Zipf scores. */
  private computeRanks() {
    const best = new Map<string, number>();
    for (const e of this.entries) if (e.zipf > (best.get(e.trad) ?? 0)) best.set(e.trad, e.zipf);
    const order = [...best].sort((a, b) => b[1] - a[1]);
    const rank = new Map<string, number>();
    order.forEach(([w], i) => rank.set(w, i + 1));
    for (const e of this.entries) e.rank = rank.get(e.trad) ?? 0;
  }

  /** The best entry for a single character read as `syllable` (numbered, e.g. "dian4"). */
  charEntry(ch: string, syllable?: string): Entry | undefined {
    // Only entries whose traditional form is this character (台 is also the simplified form of 檯/颱).
    const all = this.get(ch);
    let list = all.filter((e) => e.trad === ch).length ? all.filter((e) => e.trad === ch) : all;
    // 台 is listed as "variant of 臺": use the main form's senses.
    const v = /variant of ([^|\[\s]+)\|/.exec(list.map((e) => e.defs.join('/')).join('/'));
    if (v && list.every((e) => /^\(classical\)|variant of/.test(e.defs[0] ?? '') || e.defs.length <= 2)) {
      const main = this.get(v[1]).filter((e) => e.trad === v[1]);
      if (main.length) list = main;
    }
    if (!syllable) return list[0];
    const read = (e: Entry) => (e.tw || e.py).toLowerCase();
    const want = syllable.toLowerCase();
    const bare = (x: string) => x.replace(/[1-5]$/, '');
    return list.find((e) => read(e) === want) ?? list.find((e) => bare(read(e)) === bare(want)) ?? list[0];
  }

  private add(key: string, i: number) {
    const list = this.index.get(key);
    if (list) list.push(i);
    else this.index.set(key, [i]);
  }

  has(word: string): boolean {
    return this.index.has(word);
  }

  /** All entries for a headword (either script), best first. */
  get(word: string): Entry[] {
    const ids = this.index.get(word);
    if (!ids) return [];
    return rankEntries(
      ids.map((i) => this.entries[i]),
      word,
    );
  }

  /** Longest-prefix matches for text starting at the cursor, longest first. */
  lookup(text: string, max = 4): LookupMatch[] {
    if (!text || !CJK.test(text[0])) return [];
    const out: LookupMatch[] = [];
    for (let len = Math.min(MAX_WORD, text.length); len >= 1 && out.length < max; len--) {
      const s = text.slice(0, len);
      const entries = this.get(s);
      if (entries.length) out.push({ text: s, word: entries[0].trad, entries });
    }
    return out;
  }

  /** log10 probability-ish score for a dictionary word. */
  private score(word: string): number {
    const entries = this.get(word);
    if (!entries.length) return word.length === 1 ? -14 : -Infinity;
    const zipf = Math.max(...entries.map((e) => e.zipf));
    if (zipf > 0) return zipf / 10 - 9;
    return word.length === 1 ? -9 : -8.6;
  }

  /**
   * Split a line into words: dynamic programming over dictionary words,
   * maximizing the summed log-frequency (a unigram model, like jieba).
   */
  segment(line: string): Token[] {
    const tokens: Token[] = [];
    // Split into CJK runs and everything else.
    const re = /[㐀-䶿一-鿿豈-﫿]+|[^㐀-䶿一-鿿豈-﫿]+/g;
    for (const m of line.matchAll(re)) {
      const run = m[0];
      if (!CJK.test(run[0])) {
        tokens.push({ text: run });
        continue;
      }
      const n = run.length;
      const best = new Array<number>(n + 1).fill(-Infinity);
      const back = new Array<number>(n + 1).fill(0);
      best[0] = 0;
      for (let i = 0; i < n; i++) {
        if (best[i] === -Infinity) continue;
        for (let len = 1; len <= MAX_WORD && i + len <= n; len++) {
          const s = run.slice(i, i + len);
          const sc = len === 1 || this.index.has(s) ? this.score(s) : -Infinity;
          if (sc === -Infinity) continue;
          const v = best[i] + sc;
          if (v > best[i + len]) {
            best[i + len] = v;
            back[i + len] = i;
          }
        }
      }
      const parts: string[] = [];
      for (let j = n; j > 0; j = back[j]) parts.push(run.slice(back[j], j));
      parts.reverse();
      for (const p of parts) tokens.push(this.token(p));
    }
    return tokens;
  }

  private token(text: string): Token {
    const entries = this.get(text);
    if (!entries.length) return { text, trad: text };
    const e = entries[0];
    return { text, word: e.trad, py: e.tw || e.py, trad: e.trad };
  }
}

const LOW_VALUE = /^(old )?variant of|^see |^surname |^used in |^\(old\)|^archaic /i;

/**
 * The everyday reading of characters CC-CEDICT lists with a rarer one first
 * (要 is far more often yào "want" than yāo "demand").
 */
const PREFERRED: Record<string, string> = {
  要: 'yao4', 著: 'zhe5', 着: 'zhe5', 看: 'kan4', 行: 'xing2', 重: 'zhong4', 背: 'bei4', 教: 'jiao4', 空: 'kong1',
};

/** Order entries: matching script first, common senses before proper nouns and variants. */
export function rankEntries(entries: Entry[], query: string): Entry[] {
  const rank = (e: Entry) => {
    let r = 0;
    if (e.trad !== query) r += 1; // query is simplified: still fine, small penalty
    if (PREFERRED[query] === (e.tw || e.py)) r -= 1;
    if (/^[A-Z]/.test(e.py)) r += 4; // proper noun
    if (LOW_VALUE.test(e.defs[0] ?? '')) r += 8;
    if (e.defs.every((d) => /^(old )?variant of|^see /i.test(d))) r += 8;
    return r;
  };
  return entries
    .map((e, i) => ({ e, i, r: rank(e) }))
    .sort((a, b) => a.r - b.r || b.e.zipf - a.e.zipf || a.i - b.i)
    .map((x) => x.e);
}
