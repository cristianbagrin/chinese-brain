import { CJK } from '../shared/dict.ts';
import type { Token } from '../shared/types.ts';
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
  const stops = /[。！？!?；\n]/;
  let a = pos;
  while (a > 0 && !stops.test(full[a - 1]) && pos - a < 120) a--;
  let b = pos;
  while (b < full.length && !stops.test(full[b]) && b - pos < 160) b++;
  return full.slice(a, Math.min(full.length, b + 1)).trim();
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

/** Hover lookup on any page. Elements marked data-cb-own are left to their owners. */
export class HoverLookup {
  private popup: Popup;
  private raf = 0;
  private lastX = 0;
  private lastY = 0;
  private shift = false;
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
    // Selecting Chinese text (also inside search boxes and text fields) opens the card for it.
    document.addEventListener('mouseup', (e) => {
      if (!this.popup.contains(e.target)) setTimeout(() => this.onSelect(e), 0);
    });
    document.addEventListener('keyup', (e) => {
      if (e.shiftKey && e.key.startsWith('Arrow')) this.onSelect();
    });
  }

  /** Card for the selected text: the longest dictionary word it starts with. */
  private async onSelect(e?: MouseEvent) {
    if (!state.siteEnabled()) return;
    const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    let text = '';
    let rect: DOMRect | undefined;
    let ctxText = '';
    const field = active && (active instanceof HTMLTextAreaElement || (active instanceof HTMLInputElement && /^(text|search|url|email|)$/.test(active.type)));
    if (field && active.selectionStart != null && active.selectionEnd != null && active.selectionEnd > active.selectionStart) {
      text = active.value.slice(active.selectionStart, active.selectionEnd);
      const r = active.getBoundingClientRect();
      rect = new DOMRect(e?.clientX ?? r.left, r.top, 1, r.height);
    } else {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      text = sel.toString();
      rect = sel.getRangeAt(0).getBoundingClientRect();
      if (sel.anchorNode?.nodeType === Node.TEXT_NODE) ctxText = sentenceAround(sel.anchorNode as Text, sel.anchorOffset);
    }
    text = text.trim();
    if (!text || text.length > 16 || !CJK.test(text[0])) return;
    const matches = await lookupText(text);
    if (!matches.length) return;
    // Prefer exactly what was selected when it is a word.
    const exact = matches.findIndex((m) => m.text === text);
    const ordered = exact > 0 ? [matches[exact], ...matches.filter((_, i) => i !== exact)] : matches;
    CSS.highlights?.delete(HIGHLIGHT);
    this.currentKey = '';
    this.currentRange = undefined;
    this.popup.show({
      matches: ordered,
      rect: rect!,
      cursor: e ? { x: e.clientX, y: e.clientY } : undefined,
      src: 'web',
      pinned: true,
      ctx: { text: ctxText || (field ? active!.value.slice(0, 200) : text), url: location.href, title: document.title, at: Date.now(), src: 'web' },
    });
  }

  private onMove(e: MouseEvent) {
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.shift = e.shiftKey;
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
    if (!state.siteEnabled() || (s.hoverMode === 'shift' && !this.shift)) return this.scheduleHide();

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
