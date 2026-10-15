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
