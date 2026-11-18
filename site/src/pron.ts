// How the website writes readings: the extension's choice when it's installed (it marks the page
// with data-cb-pron, src/content/bridge.ts), else the visitor's own, kept in this browser. 注音 first.
import { markedToNumbered, pronMarked, splitPinyin, zhuyinWord, type Pron } from '../../src/shared/zhuyin.ts';

const KEY = 'cb-pron';
const root = document.documentElement;

/** Set by the extension: then the site follows its Settings and offers no switch of its own. */
export const fromExtension = () => !!root.dataset.cbPron;

export function sitePron(): Pron {
  const ext = root.dataset.cbPron;
  if (ext === 'pinyin' || ext === 'zhuyin') return ext;
  try {
    return localStorage.getItem(KEY) === 'pinyin' ? 'pinyin' : 'zhuyin';
  } catch {
    return 'zhuyin';
  }
}

export function setSitePron(p: Pron) {
  try {
    localStorage.setItem(KEY, p);
  } catch {
    /* kept for this page only */
  }
  dispatchEvent(new Event('cb-pron'));
}

/** Calls `redraw` whenever the choice changes: here, in another tab, or in the extension's Settings. */
export function onPron(redraw: () => void) {
  let last = sitePron();
  const check = () => {
    if (sitePron() === last) return;
    last = sitePron();
    redraw();
  };
  addEventListener('cb-pron', () => {
    last = sitePron();
    redraw();
  });
  addEventListener('storage', (e) => e.key === KEY && check());
  new MutationObserver(check).observe(root, { attributes: true, attributeFilter: ['data-cb-pron'] });
}

/** A saved reading ("yèshì") as numbered syllables, one per character, or null. */
export function numbered(marked: string, chars: number): string | null {
  const s = splitPinyin(marked, chars);
  return s && s.length === chars ? s.map(markedToNumbered).join(' ') : null;
}

/** A word's reading the way the visitor reads: 注音 beside each character (Taiwan style), or pinyin. */
export function readingOf(marked: string, chars: number): string {
  return pronMarked(marked, sitePron(), chars);
}

/** The word with 注音 beside each character, when the reading pairs up with the characters. */
export function zhuyinHead(word: string, marked: string): HTMLElement | null {
  const n = numbered(marked, [...word].length);
  return n ? zhuyinWord(word, n) : null;
}
