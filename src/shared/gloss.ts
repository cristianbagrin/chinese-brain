import { CJK, type Dictionary } from './dict.ts';
import { numberedToMarked } from './pinyin.ts';
import type { Entry, WordRecord } from './types.ts';

/** What the extension writes where it has no meaning: not a meaning. */
const PLACEHOLDER = /^\(?(your own word|not in the dictionary)\)?$/i;
export const isPlaceholder = (g: string | undefined) => !g || PLACEHOLDER.test(g.trim());

/** Senses that only point elsewhere or say how else to read the word. */
const POINTER = /^(CL:|(old |unofficial )?variant of |used in |see |also pr\.|also written |surname )/i;

/**
 * A sense without CC-CEDICT's notation: no measure words, 繁|简[pin1 yin1] becomes 繁, and long
 * notes in parentheses go when they explain usage ("(indicating that sth turns out …)
 * unfortunately" -> "unfortunately") or trail a long sense. A long note that says which sense a
 * short word has stays ("light (of food, not greasy …)"), and a sense that is only a note keeps
 * its words.
 */
function tidy(sense: string): string {
  let s = sense
    .replace(/\s*\(?CL:[^)/]*\)?/g, '')
    .replace(/\s*\(Taiwan pr\. \[[^\]]*\]\)/g, '')
    .replace(/([^\s[|,;()"]+)\|[^\s[,;()"]+\[[^\]]*\]/g, '$1')
    .replace(/([^\s[|,;()"]+)\[[a-zA-Z0-9: ]+\]/g, '$1');
  const outside = s.replace(/\([^()]*\)/g, '').trim();
  s = s.replace(/\(([^()]*)\)/g, (note, inner: string, at: number) => {
    if (!outside) return inner;
    if (inner.length <= 24) return note;
    return at > 0 && outside.length <= 12 ? note : '';
  });
  return s.replace(/\s+/g, ' ').replace(/\s+([,;])/g, '$1').replace(/^[\s,;]+|[\s,;]+$/g, '');
}

/** The part before the first comma outside parentheses. */
function beforeComma(s: string): string {
  let depth = 0;
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth = Math.max(0, depth - 1);
    else if (s[i] === ',' && s[i + 1] === ' ' && !depth) return s.slice(0, i);
  }
  return s;
}

/** At most `max` characters, cut after a whole word, with … */
function cutWords(s: string, max: number): string {
  const cut = s.lastIndexOf(' ', max - 1);
  return `${s.slice(0, cut > max / 2 ? cut : max - 1).replace(/[\s,;]+$/, '')}…`;
}

/**
 * A short meaning for lists and exports: the first senses, up to about `max` characters, cut
 * between senses, never inside a word. Duplicate senses and pointers (CL:, variant of …) go, and
 * a long first sense keeps the part before its comma ("Southern Min, a Sinitic language spoken
 * in …" -> "Southern Min").
 */
export function shortGloss(e: Entry, max = 60): string {
  if (e.defs.every((d) => isPlaceholder(d))) return '';
  const items: string[] = [];
  const seen = new Set<string>();
  for (const sense of e.defs) {
    if (POINTER.test(sense)) continue;
    for (let item of tidy(sense).split(/;\s*/)) {
      if (item.length > 40) item = beforeComma(item);
      const key = (item.replace(/\([^()]*\)/g, '').trim() || item).toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  // Only pointers ("variant of 留"): say where it points.
  if (!items.length) return tidy(e.defs[0] ?? '');
  let out = items[0].length > max ? cutWords(items[0], max) : items[0];
  for (const item of items.slice(1)) {
    if (out.length + 2 + item.length > max) break;
    out += '; ' + item;
  }
  return out;
}

/**
 * Pinyin for a list: syllables of a word joined (Hanyu Pinyin style), a long word spaced into
 * the smaller words it's made of: 工作人員 -> gōngzuò rényuán, not gōngzuòrényuán.
 * `parts` is the word split into smaller words (Dictionary.split).
 */
export function listPinyin(py: string, word: string, parts: string[]): string {
  const sylls = py.split(/\s+/).filter(Boolean);
  const chars = [...word];
  if (sylls.length < 4 || sylls.length !== chars.length || parts.length < 2 || /[A-Za-z0-9]/.test(word)) return numberedToMarked(py);
  const out: string[] = [];
  let i = 0;
  for (const part of parts) {
    const n = [...part].length;
    out.push(numberedToMarked(sylls.slice(i, i + n).join(' ')));
    i += n;
  }
  return i === sylls.length ? out.join(' ') : numberedToMarked(py);
}

/**
 * A word's pinyin and meaning as the dictionary gives them now, for the word list and the export:
 * older versions cut meanings mid-word and joined long pinyin, and words typed in by hand had
 * neither. The stamped reading (the saved pinyin) picks the entry.
 */
export function freshen(d: Dictionary, w: WordRecord): WordRecord {
  // Words you stamped that no dictionary has are added to it as your own: not real entries.
  const entries = d.get(w.w).filter((x) => !x.own);
  w = withSurface(w, entries);
  const marked = (e: Entry) => numberedToMarked(e.tw || e.py);
  const saved = (w.p ?? '').replace(/\s+/g, '').toLowerCase();
  const e = saved ? entries.find((x) => marked(x).toLowerCase() === saved) : entries[0];
  if (e) {
    const sylls = (e.tw || e.py).split(/\s+/).filter(Boolean);
    const syl = sylls.length === [...w.w].length && [...w.w].every((c) => CJK.test(c)) ? sylls.map((x) => numberedToMarked(x)) : undefined;
    return { ...w, p: listPinyin(e.tw || e.py, w.w, d.split(w.w)), g: shortGloss(e), ...(syl ? { syl } : {}) };
  }
  if (w.g && isPlaceholder(w.g)) w = { ...w, g: '' };
  if (w.p || entries.length || !CJK.test(w.w)) return w.g && w.g.length >= 118 ? { ...w, g: uncut(w.g) } : w;
  // Not in the dictionary (a phrase, or a typo): the readings and meanings of its parts.
  // split() never returns the word itself (it may be in the dictionary as your own word).
  const parts = d.split(w.w).map((t) => ({ t, e: d.get(t).filter((x) => !x.own)[0] }));
  const sylls = parts.flatMap(({ e: pe }) => (pe ? (pe.tw || pe.py).split(/\s+/).filter(Boolean) : []));
  const whole = parts.length > 0 && parts.every(({ e: pe }) => pe) && sylls.length === [...w.w].length;
  return {
    ...w,
    p: parts.map(({ t, e: pe }) => (pe ? marked(pe) : t)).join(' '),
    ...(whole ? { syl: sylls.map((x) => numberedToMarked(x)) } : {}),
    g: w.g || parts.map(({ t, e: pe }) => (pe ? `${t} ${shortGloss(pe, 24).split('; ')[0]}` : '')).filter(Boolean).join(' + '),
  };
}

/**
 * Sentences saved before the word's form as written there was kept (`q`): on a simplified page
 * that's the simplified form, so they still count as having the word.
 */
export function withSurface(w: WordRecord, entries: Entry[]): WordRecord {
  const simp = entries.find((e) => e.simp && e.simp !== w.w)?.simp;
  if (!simp || w.ctx.every((c) => c.q)) return w;
  return { ...w, ctx: w.ctx.map((c) => (c.q ? c : { ...c, q: simp })) };
}

/** A meaning older versions cut at 120 characters, back to its last whole sense. */
function uncut(g: string): string {
  const i = g.lastIndexOf('; ');
  return i > 0 ? g.slice(0, i) : g;
}
