import type { SavedSentence } from './types.ts';

const HAN = /[㐀-䶿一-鿿豈-﫿]/g;

/** 臺北 and 台北 are the same word; matching treats them alike. */
const fold = (s: string) => s.replaceAll('臺', '台');

/** Where the word is in the text: as stored, else as it was written there (`alt`, e.g. simplified). */
function findWord(text: string, word: string, alt?: string): { i: number; len: number } | undefined {
  const t = fold(text);
  for (const w of [word, alt]) {
    const i = w ? t.indexOf(fold(w)) : -1;
    if (w && i >= 0) return { i, len: w.length };
  }
  return undefined;
}

/** Is the word in the text (as stored, or as written there)? */
export function hasWord(text: string, word: string, alt?: string): boolean {
  return !!findWord(text, word, alt);
}

/** Caption cues that aren't speech: [音樂], ［笑］, *拍手*, ♪, and [114902300]-style ids. */
const CUES = /\[[^\]\n]{1,10}\]|［[^］\n]{1,10}］|【\d+】|\*[^*\n]{1,10}\*|[♪♫]/g;

/**
 * A sentence met on a page, without the page-title clutter around it:
 * "維基百科，自由的百科全書 | PDF" -> "維基百科，自由的百科全書",
 * "簡單可愛的夏日插畫集（單色）-插圖素材[114902300] - PIXTA圖庫" -> "簡單可愛的夏日插畫集（單色）".
 * Titles join their parts with | or dashes; the part with the word is the one worth keeping.
 */
export function cleanSentence(text: string, word: string, alt?: string): string {
  // A "cue" with the word in it is the word, not a cue: 請按下[確定]按鈕.
  const uncue = (s: string) => s.replace(CUES, (cue) => (hasWord(cue, word, alt) ? cue : ' '));
  const parts = uncue(text)
    .split(/\s*(?:[|｜]|\s[-–—]\s|(?<=[^\s\x00-\x7f])[-–—_](?=[^\s\x00-\x7f]))\s*/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter((p) => p && !/^(pdf|docx?|pptx?|xlsx?|html?|…|\.\.\.)$/i.test(p));
  const withWord = parts.filter((p) => hasWord(p, word, alt));
  if (!withWord.length) return uncue(text).replace(/[ \t]+/g, ' ').trim();
  return withWord.sort((a, b) => b.length - a.length)[0];
}

/**
 * Worth showing: a real Chinese sentence around the word. Not just the word, a bare title, or an
 * English note with a few Chinese words in it. English words count, not letters, so a name or
 * a term (我在用Visual Studio Code寫程式) is fine: at least 1.5 Chinese characters per English word.
 */
export function usefulSentence(text: string, word: string): boolean {
  const han = text.match(HAN)?.length ?? 0;
  const latinWords = text.match(/[A-Za-z][A-Za-z'’-]*/g)?.length ?? 0;
  return han >= [...word].length + 2 && han * 2 >= latinWords * 3;
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

/**
 * Positions inside a quote: between 「 and its 」, or 『 and its 』. A quote that never closes
 * (or a 」 with no 「) doesn't count, so a quote cut off by the page doesn't swallow the text.
 */
function quoted(s: string): boolean[] {
  const inside = new Array<boolean>(s.length).fill(false);
  const open: { i: number; close: string }[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '「' || c === '『') open.push({ i, close: c === '「' ? '」' : '』' });
    else if (c === '」' || c === '』') {
      const k = open.map((o) => o.close).lastIndexOf(c);
      if (k < 0) continue;
      const from = open[k].i;
      open.length = k;
      for (let j = from + 1; j < i; j++) inside[j] = true;
    }
  }
  return inside;
}

/**
 * Ends a sentence: 。！？ or a line break, and . ! ? unless a letter or digit follows them (3.5,
 * www.x.com, .srt and watch?v= don't). Punctuation inside 「」 or 『』 doesn't: 「你好嗎？」他問。
 * is one sentence.
 */
function isStop(s: string, i: number, inside: boolean[]): boolean {
  const c = s[i];
  if (c === '\n' || c === '\r') return true;
  if (inside[i]) return false;
  if ('。！？'.includes(c)) return true;
  return '.!?'.includes(c) && !/[0-9A-Za-z]/.test(s[i + 1] ?? '');
}
const CLOSER = /[」』"”’'）)】》〉\]]/;

/** [start, end) of the sentence around position `pos`: from the previous stop to the next one (its closing quote included). */
export function sentenceBounds(s: string, pos: number): [number, number] {
  const q = quoted(s);
  let a = Math.min(Math.max(pos, 0), s.length);
  while (a > 0 && !isStop(s, a - 1, q)) a--;
  while (a < pos && (CLOSER.test(s[a]) || /\s/.test(s[a]))) a++; // the last sentence's 」 or space
  let b = Math.max(a, pos);
  while (b < s.length && !isStop(s, b, q)) b++;
  while (b < s.length && isStop(s, b, q) && !/[\n\r]/.test(s[b])) b++; // 。 or ?! or ...
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

/**
 * The sentence a word was met in, ready to show or export: the one sentence with the word in it
 * (from stop to stop, page-title clutter and caption cues removed), trimmed to about `max`
 * characters around the word. '' when the text doesn't have the word or isn't really a Chinese
 * sentence: an empty cell beats a wrong sentence. `q` is the word as written there (simplified,
 * 台 for 臺). For YouTube's "Chinese — English" the English stays only with the whole line.
 */
export function metSentence(c: { text: string; q?: string }, word: string, max = 80): string {
  const [zh, ...en] = c.text.split(' — ');
  const hit = findWord(zh, word, c.q);
  if (!hit) return '';
  const [a, b] = sentenceBounds(zh, hit.i);
  const one = cleanSentence(zh.slice(a, b), word, c.q);
  const at = findWord(one, word, c.q);
  if (!at || !usefulSentence(one, word)) return '';
  const out = trimAround(one, at.i, at.len, max);
  // The English (a YouTube line's translation) belongs to the whole line: kept only when the
  // sentence is the whole line, caption cues aside.
  const english = en.join(' — ').replace(CUES, ' ').replace(/\s+/g, ' ').trim();
  return english && out === cleanSentence(zh, word, c.q) ? `${out} — ${english}` : out;
}
