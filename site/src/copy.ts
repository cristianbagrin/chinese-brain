// The words on the website's pages, named so Chris can change them at /edit (see worker.js).
// Shared by the Worker (which marks each page as it serves it) and site/sync.mjs (which lists his
// edits for folding into the source). No DOM: plain string work, so it runs in both.
//
// Every piece of text gets data-copy="t…" and every block that can be removed data-block="r…".
// A name is a hash of the element's tag and its words in the source, so it stays the same from
// deploy to deploy while the words stay the same, and changes when they change: an edit made to
// the old words then no longer finds a place, and the page shows the source (never a broken mix).

const CONTROLS = new Set(['input', 'select', 'textarea', 'button']);
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/** Tags whose words aren't edited: code, controls, and the parts of the page scripts fill in. */
const SKIP = new Set(['script', 'style', 'head', 'title', 'button', 'svg', 'noscript', 'template', 'picture', 'select', 'option', 'textarea']);
/**
 * Attributes and classes that mark words a script draws or reads: the demo's Chinese (its words
 * and their English come from brain/demo.json, built from the source by `npm run build`), the
 * little YouTube player, the demo word list, and anything marked data-js-text.
 */
const SKIP_ATTRS = ['data-demo', 'data-js-text', 'data-n', 'data-zh'];
const SKIP_CLASSES = new Set(['ytsim', 'mylist', 'piles', 'ghost']);
/** Tags and classes that can be removed as a whole. */
const BLOCKS = new Set(['section', 'figure', 'li', 'blockquote', 'article']);
const BLOCK_CLASSES = new Set(['feature', 'tile', 'maker-card', 'tool', 'entry']);

interface El {
  tag: string;
  attrs: Map<string, string>;
  /** Where the start tag's ">" is, and where its content starts. */
  gt: number;
  inner: number;
  close?: number;
  text: boolean;
  /** Its own runs of words, [start, end), and whether a form control sits inside it (a label). */
  runs: [number, number][];
  controls: boolean;
  skip: boolean;
  kids: El[];
}

export interface Annotated {
  /** The page with data-copy and data-block on its elements. */
  html: string;
  /** Each piece of text's name and its words in the source (HTML). */
  texts: Record<string, string>;
  /** The names of the blocks. */
  blocks: string[];
  /** Each block's first words, to recognize it by. */
  blockWords: Record<string, string>;
  /** Where each text's words sit in the source page: [start, end). */
  spans: Record<string, [number, number]>;
}

const TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\/?([a-zA-Z][\w:-]*)((?:\s+[^\s"'=<>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const ATTR = /([^\s"'=<>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parse(doc: string): El[] {
  const stack: El[] = [];
  const all: El[] = [];
  let inBody = false;
  let last = 0;
  const textUpTo = (end: number) => {
    const top = stack[stack.length - 1];
    if (!inBody || !top || !/\S/.test(doc.slice(last, end).replace(/&nbsp;/g, ' '))) return;
    top.text = true;
    const lead = doc.slice(last, end).search(/\S/);
    top.runs.push([last + lead, last + doc.slice(last, end).trimEnd().length]);
  };
  TOKEN.lastIndex = 0;
  for (let m = TOKEN.exec(doc); m; m = TOKEN.exec(doc)) {
    textUpTo(m.index);
    last = TOKEN.lastIndex;
    const tag = m[1]?.toLowerCase();
    if (!tag) continue; // a comment or doctype
    if (m[0][1] === '/') {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag !== tag) continue;
        for (const el of stack.slice(i)) el.close = m.index;
        stack.length = i;
        break;
      }
      continue;
    }
    if (tag === 'body') inBody = true;
    if (CONTROLS.has(tag) && stack.length) stack[stack.length - 1].controls = true;
    if (VOID.has(tag) || m[3]) continue;
    const attrs = new Map<string, string>();
    ATTR.lastIndex = 0;
    for (let a = ATTR.exec(m[2]); a; a = ATTR.exec(m[2])) attrs.set(a[1].toLowerCase(), a[2] ?? a[3] ?? a[4] ?? '');
    const parent = stack[stack.length - 1];
    const cls = (attrs.get('class') ?? '').split(/\s+/);
    const skip = !!parent?.skip || SKIP.has(tag) || SKIP_ATTRS.some((a) => attrs.has(a)) || cls.some((c) => SKIP_CLASSES.has(c));
    const el: El = { tag, attrs, gt: TOKEN.lastIndex - 1 - (m[0].endsWith('/>') ? 1 : 0), inner: TOKEN.lastIndex, text: false, runs: [], controls: false, skip, kids: [] };
    parent?.kids.push(el);
    stack.push(el);
    all.push(el);
    // Scripts and styles hold no tags: jump to their end.
    if (tag === 'script' || tag === 'style') {
      const end = doc.toLowerCase().indexOf(`</${tag}`, TOKEN.lastIndex);
      TOKEN.lastIndex = end < 0 ? doc.length : end;
      last = TOKEN.lastIndex;
    }
  }
  return all;
}

/** A short, stable name for some words (cyrb53, in base 36). */
export function hash(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Has words, not only numbers and marks (a counter's "0" isn't copy). */
const wordy = (html: string) => /\p{L}/u.test(html.replace(/<[^>]*>/g, '').replace(/&[#\w]+;/g, ''));

/**
 * Names every piece of text and every removable block on a page. A piece of text is the outermost
 * element that holds words of its own (a paragraph, a heading, a link), with everything inside it.
 * The n-th copy of the same words on one page gets "-n".
 */
export function annotate(doc: string): Annotated {
  const seen = new Map<string, number>();
  const marks: [number, string][] = [];
  const texts: Record<string, string> = {};
  const spans: Record<string, [number, number]> = {};
  const blocks: string[] = [];
  const blockWords: Record<string, string> = {};
  const name = (prefix: string, el: El) => {
    const inner = doc.slice(el.inner, el.close);
    const base = prefix + hash(`${el.tag}|${inner}`);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { key: n ? `${base}-${n}` : base, inner };
  };
  const walk = (el: El, inText: boolean) => {
    if (el.skip || el.close === undefined || el.attrs.has('data-copy') || el.attrs.has('data-block')) return;
    if (el.tag === 'html' || el.tag === 'body') {
      for (const k of el.kids) walk(k, inText);
      return;
    }
    const cls = (el.attrs.get('class') ?? '').split(/\s+/);
    if (!inText && (BLOCKS.has(el.tag) || cls.some((c) => BLOCK_CLASSES.has(c)))) {
      const { key, inner } = name('r', el);
      blocks.push(key);
      blockWords[key] = inner.replace(/<(script|style)\b[\s\S]*?<\/\1>|<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
      marks.push([el.gt, ` data-block="${key}"`]);
    }
    if (!inText && el.text && el.controls) {
      // A label around a field: its words get a span of their own, so editing them can't touch the field.
      for (const [a, b] of el.runs) {
        const words = doc.slice(a, b);
        if (!wordy(words)) continue;
        const { key } = name('t', { ...el, tag: 'span', inner: a, close: b });
        texts[key] = words;
        spans[key] = [a, b];
        marks.push([a, `<span data-copy="${key}">`], [b, '</span>']);
      }
    } else if (!inText && el.text) {
      const { key, inner } = name('t', el);
      if (wordy(inner)) {
        texts[key] = inner;
        spans[key] = [el.inner, el.close];
        marks.push([el.gt, ` data-copy="${key}"`]);
        inText = true;
      }
    }
    for (const k of el.kids) walk(k, inText);
  };
  const root = parse(doc).find((el) => el.tag === 'html');
  if (root) walk(root, false);
  let out = '';
  let at = 0;
  for (const [pos, attr] of marks.sort((a, b) => a[0] - b[0] || (a[1] === '</span>' ? -1 : b[1] === '</span>' ? 1 : 0))) {
    out += doc.slice(at, pos) + attr;
    at = pos;
  }
  return { html: out + doc.slice(at), texts, blocks, blockWords, spans };
}

/** An edit as stored: new words (HTML) or removed, with the words it replaced and where. */
export interface Edit {
  to?: string;
  gone?: true;
  was: string;
  page: string;
  at: number;
}

/** What may go into a page: no scripts, frames, forms or event handlers. */
export function clean(s: string): string {
  return String(s)
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|form|input|textarea|select|button|meta|link|base)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

/** The pages Chris edits, by their address at /edit, and the file each is served from. */
export const PAGES: [label: string, path: string, asset: string][] = [
  ['Home', '/brain', '/brain'],
  ['How it works', '/brain/guide', '/brain/guide'],
  ["What's new", '/brain/whats-new', '/brain/whats-new'],
  ['Dashboard', '/brain/dashboard', '/brain/dashboard'],
  ['Privacy', '/brain/privacy', '/brain/privacy'],
  ['Account', '/account', '/account'],
  ['New password', '/reset', '/reset'],
  ['Page not found', '/404', '/404'],
];
