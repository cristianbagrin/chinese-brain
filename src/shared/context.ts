import type { SavedSentence } from './types.ts';

const HAN = /[㐀-䶿一-鿿豈-﫿]/g;

/**
 * A sentence met on a page, without the page-title clutter around it:
 * "維基百科，自由的百科全書 | PDF" -> "維基百科，自由的百科全書",
 * "簡單可愛的夏日插畫集（單色）-插圖素材[114902300] - PIXTA圖庫" -> "簡單可愛的夏日插畫集（單色）".
 * Titles join their parts with | or dashes; the part with the word is the one worth keeping.
 */
export function cleanSentence(text: string, word: string): string {
  const parts = text
    .split(/\s*(?:[|｜]|\s[-–—]\s|(?<=[^\s\x00-\x7f])[-–—_](?=[^\s\x00-\x7f]))\s*/)
    .map((p) => p.replace(/\[\d+\]|【\d+】/g, '').trim())
    .filter((p) => p && !/^(pdf|docx?|pptx?|xlsx?|html?|…|\.\.\.)$/i.test(p));
  const withWord = parts.filter((p) => p.includes(word));
  if (!withWord.length) return text.trim();
  return withWord.sort((a, b) => b.length - a.length)[0];
}

/** Worth showing: a real sentence around the word, not just the word (or a bare title). */
export function usefulSentence(text: string, word: string): boolean {
  return (text.match(HAN)?.length ?? 0) >= [...word].length + 2;
}

/**
 * Save or unsave a sentence in a word's saved list. `replace` is the saved sentence an edit
 * started from (it gives way to the edited one); `from` is the met sentence it was cut from.
 */
export function saveInList(
  list: SavedSentence[],
  o: { zh: string; en?: string; on: boolean; replace?: string; from?: string },
  now = Date.now(),
): SavedSentence[] {
  const zh = o.zh.trim();
  const old = o.replace ? list.find((x) => x.zh === o.replace) : undefined;
  const out = list.filter((x) => x.zh !== zh && (!o.replace || x.zh !== o.replace));
  if (o.on && zh) {
    const from = o.from ?? old?.from;
    out.push({ zh, en: o.en ?? '', at: now, ...(from && from !== zh ? { from } : {}) });
  }
  return out;
}

/** Ends a sentence: 。！？!? or a line break, and a "." that isn't inside a number or a name like www.x.com. */
function isStop(s: string, i: number): boolean {
  const c = s[i];
  if ('。！？!?\n\r'.includes(c)) return true;
  return c === '.' && !(/[0-9A-Za-z]/.test(s[i - 1] ?? '') && /[0-9A-Za-z]/.test(s[i + 1] ?? ''));
}
const CLOSER = /[」』"”’'）)】》〉\]]/;

/** [start, end) of the sentence around position `pos`: from the previous stop to the next one (its closing quote included). */
export function sentenceBounds(s: string, pos: number): [number, number] {
  let a = Math.min(Math.max(pos, 0), s.length);
  while (a > 0 && !isStop(s, a - 1)) a--;
  while (a < pos && (CLOSER.test(s[a]) || /\s/.test(s[a]))) a++; // the last sentence's 」 or space
  let b = Math.max(a, pos);
  while (b < s.length && !isStop(s, b)) b++;
  while (b < s.length && isStop(s, b) && !/[\n\r]/.test(s[b])) b++; // 。 or ?! or ...
  while (b < s.length && CLOSER.test(s[b])) b++;
  return [a, b];
}

/** The sentence around position `pos` in a block of text, at most `max` characters (trimmed around `pos`). */
export function sentenceAt(s: string, pos: number, max = 300): string {
  const [a, b] = sentenceBounds(s, pos);
  return trimAround(s.slice(a, b), pos - a, 1, max);
}

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('zh-TW', { granularity: 'word' }) : undefined;

/**
 * At most about `max` characters of `s` around the word at [i, i + len), cut between words
 * (after a comma or space when one is near the edge), with … where it was cut.
 */
export function trimAround(s: string, i: number, len: number, max: number): string {
  if (s.length <= max) return s.trim();
  const cuts = segmenter ? [...segmenter.segment(s)].map((x) => x.index).concat(s.length) : [...s].map((_, k) => k).concat(s.length);
  let a0 = Math.max(0, i - Math.floor((max - len) / 2));
  const b0 = Math.min(s.length, a0 + max);
  a0 = Math.max(0, b0 - max);
  const near = 12;
  const clause = /[，、；：,;:\s（(「『]/;
  // Start: just after a comma near the left edge, else the first word boundary in the window.
  let a = cuts.find((k) => k >= a0 && k <= i) ?? i;
  for (let k = a0; k <= Math.min(i, a0 + near); k++) if (k > 0 && clause.test(s[k - 1])) { a = k; break; }
  // End: just before a comma near the right edge, else the last word boundary in the window.
  let b = [...cuts].reverse().find((k) => k <= b0 && k >= i + len) ?? i + len;
  for (let k = b0; k >= Math.max(i + len, b0 - near); k--) if (k < s.length && clause.test(s[k])) { b = k; break; }
  const mid = s.slice(a, b).trim().replace(/^[，、；：,;:]+|[，、；：,;:]+$/g, '');
  return `${a > 0 ? '…' : ''}${mid}${b < s.length ? '…' : ''}`;
}

/** 臺北 and 台北 are the same word; matching treats them alike. */
const fold = (s: string) => s.replaceAll('臺', '台');

/**
 * The single sentence `word` appears in, trimmed to about `max` characters around it, or ''
 * when the word isn't in the text (an empty cell beats a wrong sentence). For YouTube's
 * "Chinese — English" the English stays only when the Chinese came through whole.
 */
export function sentenceWith(text: string, word: string, max = 80): string {
  const [zh, ...rest] = text.split(' — ');
  const i = fold(zh).indexOf(fold(word));
  if (!word || i < 0) return '';
  const [a, b] = sentenceBounds(zh, i);
  const one = trimAround(zh.slice(a, b), i - a, word.length, max);
  return one === zh.trim() && rest.length ? [one, ...rest].join(' — ') : one;
}
