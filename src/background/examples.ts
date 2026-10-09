import { CJK, type Dictionary } from '../shared/dict.ts';
import type { Status, Token } from '../shared/types.ts';

export interface Example {
  zh: string;
  en: string;
  toks: Token[];
}

/**
 * The example sentences, and a way to pick the best two for a word and for you.
 *
 * Every word has (up to) two sentences written for it. Any other sentence in the
 * bundle that uses the word is a real example too, so the pool for a word is much
 * larger, and words without their own sentences still get some. From the pool the
 * card takes the ones you can read: sentences where the other words are ones you
 * know, so the new word is the only new thing (i+1).
 */
export class ExampleBank {
  /** Sentences written for each word. */
  own = new Map<string, [string, string][]>();
  private pool: [string, string][] = [];
  /** word -> pool sentences that use it (built in the background after start-up). */
  private index = new Map<string, number[]>();

  load(tsv: string) {
    const seen = new Set<string>();
    for (const line of tsv.split('\n')) {
      const [w, zh, en] = line.split('\t');
      if (!w || !zh) continue;
      const list = this.own.get(w);
      if (list) list.push([zh, en ?? '']);
      else this.own.set(w, [[zh, en ?? '']]);
      if (!seen.has(zh)) {
        seen.add(zh);
        this.pool.push([zh, en ?? '']);
      }
    }
  }

  /** Split every sentence into words, a few hundred at a time, without hogging the browser. */
  buildIndex(d: Dictionary, done?: () => void) {
    let i = 0;
    const step = () => {
      const end = Math.min(this.pool.length, i + 400);
      for (; i < end; i++) {
        const words = new Set(d.segment(this.pool[i][0]).filter((t) => t.word && CJK.test(t.text)).map((t) => t.word!));
        for (const w of words) {
          const ids = this.index.get(w);
          if (ids) ids.push(i);
          else this.index.set(w, [i]);
        }
      }
      if (i < this.pool.length) setTimeout(step, 0);
      else done?.();
    };
    step();
  }

  /**
   * The best two sentences for `word`. `extra` are sentences Gemini wrote for it; `hidden`
   * the ones you deleted; `saved` the ones you saved (always shown first).
   */
  pick(
    word: string,
    d: Dictionary,
    statusOf: (w: string) => Status | undefined,
    extra: [string, string][] = [],
    hidden: Set<string> = new Set(),
    saved: Set<string> = new Set(),
    n = 2,
  ): Example[] {
    const cands = new Map<string, { zh: string; en: string; base: number }>();
    const add = (zh: string, en: string, base: number) => {
      if (!hidden.has(zh) && !cands.has(zh)) cands.set(zh, { zh, en, base });
    };
    for (const [zh, en] of this.own.get(word) ?? []) add(zh, en, 2);
    for (const [zh, en] of extra) add(zh, en, 2);
    for (const id of (this.index.get(word) ?? []).slice(0, 80)) add(this.pool[id][0], this.pool[id][1], 0);
    const scored = [...cands.values()].map((c) => {
      const toks = d.segment(c.zh);
      return { ...c, toks, score: (saved.has(c.zh) ? 100 : c.base) + readability(toks, word, d, statusOf) };
    });
    scored.sort((a, b) => b.score - a.score);
    // Two different sentences, not two takes on the same one (樹上結了很多芒果 / 樹上結了果實).
    const out: typeof scored = [];
    for (const c of scored) if (out.length < n && !out.some((o) => similar(o.zh, c.zh))) out.push(c);
    for (const c of scored) if (out.length < n && !out.includes(c)) out.push(c);
    return out.map(({ zh, en, toks }) => ({ zh, en, toks }));
  }
}

/** Share of characters two sentences have in common (0..1), above one half. */
function similar(a: string, b: string): boolean {
  const A = new Set(a.replace(/[，。！？、\s]/g, ''));
  const B = new Set(b.replace(/[，。！？、\s]/g, ''));
  let common = 0;
  for (const c of A) if (B.has(c)) common++;
  return common / Math.min(A.size, B.size) > 0.6;
}

/**
 * How readable a sentence is for you, around 0 (higher is better): each other word you
 * don't know costs, a word you're learning costs less, and very common words you never
 * stamped cost little (you surely know 的 and 是). Very long or very short sentences cost too.
 */
export function readability(toks: Token[], word: string, d: Dictionary, statusOf: (w: string) => Status | undefined): number {
  let unknown = 0;
  const counted = new Set<string>();
  for (const t of toks) {
    if (!t.word || !CJK.test(t.text) || t.word === word || counted.has(t.word)) continue;
    counted.add(t.word);
    const st = statusOf(t.word);
    if (st === 'known') continue;
    if (st === 'learning') unknown += 0.4;
    else {
      const zipf = Math.max(0, ...d.get(t.word).map((e) => e.zipf));
      unknown += zipf >= 60 ? 0.2 : zipf >= 52 ? 0.6 : 1;
    }
  }
  const len = toks.reduce((n, t) => n + t.text.length, 0);
  const lenCost = len > 26 ? (len - 26) * 0.08 : len < 6 ? 0.6 : 0;
  return -0.6 * unknown - lenCost;
}
