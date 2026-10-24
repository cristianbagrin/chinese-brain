import { CJK } from '../shared/dict.ts';
import { sentenceAt } from '../shared/context.ts';
import type { LookupMatch, Token } from '../shared/types.ts';
import { addPageCSS } from './css.ts';
import { lookupText } from './lookup.ts';
import { Popup } from './popup.ts';
import { state } from './state.ts';

const HIGHLIGHT = 'chinese-brain-hit';
export { lookupText };

/** Text from (node, offset) onward, crossing into following text nodes. */
function textFrom(node: Text, offset: number, max = 10): { text: string; ranges: [Text, number, number][] } {
  let text = '';
  const ranges: [Text, number, number][] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  walker.currentNode = node;
  let cur: Text | null = node;
  let start = offset;
  while (cur && text.length < max) {
    const piece = cur.data.slice(start, start + (max - text.length));
    if (piece) {
      ranges.push([cur, start, start + piece.length]);
      text += piece;
    }
    // Stop at block-ish boundaries: only continue through inline siblings.
    const next = walker.nextNode() as Text | null;
    if (!next || !sameBlock(cur, next)) break;
    cur = next;
    start = 0;
  }
  return { text, ranges };
}

function sameBlock(a: Node, b: Node): boolean {
  const block = (n: Node) => {
    let el = n.parentElement;
    while (el && getComputedStyle(el).display.startsWith('inline')) el = el.parentElement;
    return el;
  };
  return block(a) === block(b);
}

/** The sentence around a point in a text node, for saving as context. */
export function sentenceAround(node: Text, offset: number): string {
  const block = node.parentElement?.closest('p,li,td,h1,h2,h3,h4,div,section,article,blockquote') ?? node.parentElement;
  const full = block?.textContent ?? node.data;
  // Find this node's offset inside the block text.
  let pos = offset;
  if (block) {
    const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let acc = 0;
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n === node) {
        pos = acc + offset;
        break;
      }
      acc += (n as Text).data.length;
    }
  }
  return sentenceAt(full, pos);
}

/** Is the character at (node, offset) inside the range? */
function covers(r: Range, node: Text, offset: number): boolean {
  try {
    return r.comparePoint(node, offset) === 0 && r.comparePoint(node, offset + 1) === 0;
  } catch {
    return false; // the page replaced the text
  }
}

/** Half the gap between a line's glyphs and the next line, in px. */
function lineSlack(node: Text): number {
  const el = node.parentElement;
  if (!el) return 2;
  const cs = getComputedStyle(el);
  const fs = parseFloat(cs.fontSize) || 16;
  const lh = parseFloat(cs.lineHeight);
  return Math.max(2, Number.isFinite(lh) ? (lh - fs) / 2 + 1 : fs * 0.2);
}

/** A single-line field used for searching: type=search, or a text input that says so. */
function isSearchBox(el: Element): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement) || !/^(text|search|)$/.test(el.type)) return false;
  if (el.type === 'search') return true;
  const hint = `${el.name} ${el.id} ${el.placeholder} ${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('role') ?? ''} ${el.getAttribute('enterkeyhint') ?? ''}`;
  return /search|query|\bq\b|搜尋|搜索|查詢|查询/i.test(hint) || !!el.closest('[role="search"],form[action*="search" i]');
}

/** The focused element, looking inside shadow roots (editors and search boxes often sit in one). */
function deepActive(): Element | null {
  let a = document.activeElement;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
  return a;
}

interface Selected {
  text: string;
  rect: DOMRect;
  /** The sentence or field the selection came from. */
  context: string;
}

/** What is selected: in a text field or search box, or on the page. */
function currentSelection(): Selected | undefined {
  const el = deepActive();
  if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.selectionStart != null && el.selectionEnd != null) {
    if (el.selectionEnd <= el.selectionStart) return undefined;
    const r = el.getBoundingClientRect();
    return { text: el.value.slice(el.selectionStart, el.selectionEnd), rect: new DOMRect(r.left, r.top, Math.min(r.width, 40), Math.min(r.height, 40)), context: sentenceAt(el.value, el.selectionStart) };
  }
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return undefined;
  const range = sel.getRangeAt(0);
  const text = sel.toString();
  const node = range.startContainer;
  const context = node.nodeType === Node.TEXT_NODE ? sentenceAround(node as Text, range.startOffset) : text;
  // A long selection: its last line, where the selection ended.
  const rects = range.getClientRects();
  const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
  return { text, rect, context: context.length >= text.length ? context : text };
}

/** Hover lookup on any page. Elements marked data-cb-own are left to their owners. */
export class HoverLookup {
  private popup: Popup;
  private raf = 0;
  private lastX = 0;
  private lastY = 0;
  /** Option (Alt) is held: lookup in "hold Option" mode. */
  private alt = false;
  /** Option went down on its own; letting go without another key opens the card for the selection. */
  private altTap = false;
  /** Where the context menu was opened, for a card from the menu. */
  private menuAt: { x: number; y: number } | undefined;
  private currentKey = '';
  /** The highlighted word: moving across its characters keeps its card. */
  private currentRange: Range | undefined;
  private cssInjected = false;
  private seq = 0;

  constructor(popup: Popup) {
    this.popup = popup;
    document.addEventListener('mousemove', (e) => this.onMove(e), { passive: true });
    document.addEventListener('mousedown', (e) => {
      if (!this.popup.contains(e.target)) this.popup.hide();
    });
    // Scrolling (wheel, trackpad or keys) keeps a card the pointer rests on; otherwise the word left, so the card goes.
    document.addEventListener(
      'scroll',
      () => {
        if (!this.popup.visible || this.popup.pinned) return;
        if (this.popup.isHovered) this.popup.detach();
        else this.popup.hide();
      },
      { capture: true, passive: true },
    );
    this.popup.onHide(() => {
      this.currentKey = '';
      this.currentRange = undefined;
      CSS.highlights?.delete(HIGHLIGHT);
    });
    // Selecting Chinese text inside a search box opens the card for it.
    document.addEventListener('mouseup', (e) => {
      if (!this.popup.contains(e.target)) setTimeout(() => this.onSelect(e), 0);
    });
    document.addEventListener('keyup', (e) => {
      if (e.shiftKey && e.key.startsWith('Arrow')) this.onSelect();
    });
    // Option (Alt): tap it with text selected for that text's card; hold it to look up in "hold Option" mode.
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Alt') {
          this.altTap = false;
          return;
        }
        this.altTap = !e.repeat && !e.ctrlKey && !e.metaKey && !e.shiftKey;
        this.alt = true;
        if (!e.repeat && state.settings.hoverMode === 'alt' && !currentSelection()?.text.trim()) this.check(document.elementFromPoint(this.lastX, this.lastY));
      },
      true,
    );
    window.addEventListener(
      'keyup',
      (e) => {
        if (e.key !== 'Alt') return;
        this.alt = false;
        if (!this.altTap) return;
        this.altTap = false;
        const sel = currentSelection();
        if (sel && CJK.test(sel.text) && state.siteEnabled()) {
          e.preventDefault(); // no menu bar (Windows, Linux)
          void this.showSelection(sel);
        }
      },
      true,
    );
    window.addEventListener('blur', () => {
      this.alt = false;
      this.altTap = false;
    });
    document.addEventListener('mousedown', () => (this.altTap = false), true);
    document.addEventListener('contextmenu', (e) => (this.menuAt = { x: e.clientX, y: e.clientY }), true);
    browser.runtime.onMessage.addListener((msg: { type: string; text?: string }) => {
      if (msg.type !== 'lookupSelection') return undefined;
      void this.fromMenu(msg.text ?? '');
      return Promise.resolve(true);
    });
  }

  /** "Look up" from the context menu: the live selection, or the text the menu saw. */
  private async fromMenu(text: string) {
    const sel = currentSelection();
    const same = (a: string, b: string) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '');
    if (sel && (!text || same(sel.text, text) || sel.text.length > text.length)) return this.showSelection(sel);
    const at = this.menuAt ?? { x: window.innerWidth / 2, y: window.innerHeight / 3 };
    await this.showSelection({ text, rect: new DOMRect(at.x, at.y - 10, 1, 20), context: text });
  }

  /** The card for selected text, whatever it is: a word, a name, a whole sentence. */
  private async showSelection(sel: Selected) {
    const text = sel.text.trim();
    if (!CJK.test(text)) return;
    const matches: LookupMatch[] = await browser.runtime.sendMessage({ type: 'lookupPhrase', text });
    if (!matches?.length) return;
    CSS.highlights?.delete(HIGHLIGHT);
    this.currentKey = '';
    this.currentRange = undefined;
    this.popup.show({
      matches,
      rect: sel.rect,
      src: 'web',
      pinned: true,
      ctx: { text: sel.context, url: location.href, title: document.title, at: Date.now(), src: 'web' },
    });
  }

  /** Selecting Chinese in a search box opens its card (page popups can't be seen there otherwise). */
  private async onSelect(e?: MouseEvent) {
    if (!state.siteEnabled()) return;
    // Selecting text on a page, or while writing in a text area or editor, stays quiet (Option or the menu open it).
    const active = deepActive();
    if (!active || !isSearchBox(active)) return;
    const sel = currentSelection();
    if (!sel || sel.text.trim().length > 16) return;
    if (e) sel.rect = new DOMRect(e.clientX, sel.rect.top, 1, sel.rect.height);
    await this.showSelection(sel);
  }

  private onMove(e: MouseEvent) {
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.alt = e.altKey;
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.check(e.target);
    });
  }

  private async check(target: EventTarget | null) {
    const seq = ++this.seq;
    if (this.popup.pinned) return;
    if (this.popup.contains(target)) {
      // Resting on the card keeps it. On a page, landing on a card that only just opened means
      // the pointer is sweeping past: close it and look at the text underneath instead.
      // (Subtitle cards open away from the line, so reaching one is always deliberate.)
      if (this.popup.src !== 'web' || this.popup.age() > 300) return;
      this.popup.hide();
    }
    // On the way from the word to its card: text crossed on the way doesn't count.
    if (this.popup.visible && this.popup.inBridge(this.lastX, this.lastY)) return;
    if ((target as Element | null)?.closest?.('[data-cb-own]')) return;
    const s = state.settings;
    if (!state.siteEnabled() || (s.hoverMode === 'alt' && !this.alt)) return this.scheduleHide();

    const pos = document.caretPositionFromPoint?.(this.lastX, this.lastY);
    const node = pos?.offsetNode;
    if (!node || node.nodeType !== Node.TEXT_NODE) return this.scheduleHide();
    const text = node as Text;
    let offset = pos!.offset;
    // caretPositionFromPoint snaps to the nearest gap; use the char under the pointer.
    offset = this.charUnderPointer(text, offset);
    if (offset < 0 || !CJK.test(text.data[offset] ?? '')) return this.scheduleHide();

    // Still on the word that is showing (any of its characters): keep it, no new lookup.
    if (this.currentRange && this.popup.visible && covers(this.currentRange, text, offset)) {
      this.popup.cancelHide();
      return;
    }
    // The word under the pointer is the one the segmenter sees there (as in the subtitles),
    // so 基 in 維基百科 opens 維基百科, not whatever starts at 基.
    const back = Math.min(offset, 7);
    const { text: str, ranges } = textFrom(text, offset - back, back + 10);
    const at = this.charRect(text, offset - back);
    const key = `${str}@${Math.round(at?.left ?? 0)},${Math.round(at?.top ?? 0)}`;
    const toks = await this.segment(str);
    if (seq !== this.seq) return; // the pointer moved on while we were working
    let start = back;
    let tok: Token | undefined;
    for (let pos = 0, i = 0; i < toks.length; pos += toks[i].text.length, i++) {
      if (back < pos + toks[i].text.length) {
        tok = toks[i];
        start = pos;
        break;
      }
    }
    if (!tok?.word) start = back; // not a dictionary word: look up from the character itself
    const wordKey = `${key}:${start}`;
    if (wordKey === this.currentKey) {
      this.popup.cancelHide();
      return;
    }
    let matches = await lookupText(str.slice(start));
    if (seq !== this.seq) return;
    if (!matches.length) return this.scheduleHide();
    const own = tok?.word ? matches.findIndex((m) => m.text === tok.text) : -1;
    if (own > 0) matches = [matches[own], ...matches.filter((_, i) => i !== own)];
    this.currentKey = wordKey;
    const range = this.rangeFor(ranges, matches[0].text.length, start);
    this.currentRange = range;
    this.highlight(range);
    this.popup.show({
      matches,
      rect: range.getBoundingClientRect(),
      cursor: { x: this.lastX, y: this.lastY },
      src: 'web',
      ctx: { text: sentenceAround(text, offset), url: location.href, title: document.title, at: Date.now(), src: 'web' },
    });
  }

  private charRect(node: Text, i: number): DOMRect | undefined {
    if (i < 0 || i >= node.data.length) return undefined;
    const r = document.createRange();
    r.setStart(node, i);
    r.setEnd(node, i + 1);
    return r.getBoundingClientRect();
  }

  private charUnderPointer(node: Text, offset: number): number {
    // A character's box is shorter than its line; the space between lines belongs to the line.
    const slack = lineSlack(node);
    for (const i of [offset, offset - 1]) {
      const r = this.charRect(node, i);
      if (r && this.lastX >= r.left - 1 && this.lastX <= r.right + 1 && this.lastY >= r.top - slack && this.lastY <= r.bottom + slack) return i;
    }
    return -1;
  }

  /** A DOM range for `len` characters starting `skip` characters into the collected text. */
  private rangeFor(ranges: [Text, number, number][], len: number, skip = 0): Range {
    const r = document.createRange();
    let started = false;
    let left = len;
    for (const [n, s, e] of ranges) {
      if (!started) {
        if (skip >= e - s) {
          skip -= e - s;
          continue;
        }
        r.setStart(n, s + skip);
        started = true;
        const take = Math.min(left, e - s - skip);
        r.setEnd(n, s + skip + take);
        left -= take;
      } else {
        const take = Math.min(left, e - s);
        r.setEnd(n, s + take);
        left -= take;
      }
      if (left <= 0) break;
    }
    return r;
  }

  private segCache = new Map<string, Token[]>();
  private async segment(str: string): Promise<Token[]> {
    const hit = this.segCache.get(str);
    if (hit) return hit;
    const [toks]: Token[][] = await browser.runtime.sendMessage({ type: 'segment', lines: [str] });
    if (this.segCache.size > 300) this.segCache.clear();
    this.segCache.set(str, toks ?? []);
    return toks ?? [];
  }

  private highlight(range: Range) {
    if (!CSS.highlights) return;
    if (!this.cssInjected) {
      this.cssInjected = true;
      addPageCSS(`::highlight(${HIGHLIGHT}){background:#f3d27a;color:#31261a}`);
    }
    const hl = new Highlight(range);
    hl.priority = 10; // above the page colors
    CSS.highlights.set(HIGHLIGHT, hl);
  }

  private scheduleHide() {
    if (this.currentKey) this.popup.hideSoon();
  }
}
