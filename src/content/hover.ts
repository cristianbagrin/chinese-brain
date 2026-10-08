import { CJK } from '../shared/dict.ts';
import type { LookupMatch } from '../shared/types.ts';
import { Popup } from './popup.ts';
import { state } from './state.ts';

const HIGHLIGHT = 'chinese-brain-hit';
const cache = new Map<string, LookupMatch[]>();

export async function lookupText(text: string): Promise<LookupMatch[]> {
  const key = text.slice(0, 8);
  const hit = cache.get(key);
  if (hit) return hit;
  const res: LookupMatch[] = await browser.runtime.sendMessage({ type: 'lookup', text: key });
  if (cache.size > 300) cache.clear();
  cache.set(key, res);
  return res;
}

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

/** Hover lookup on any page. Elements marked data-cb-own are left to their owners. */
export class HoverLookup {
  private popup: Popup;
  private raf = 0;
  private lastX = 0;
  private lastY = 0;
  private shift = false;
  private currentKey = '';
  private cssInjected = false;
  private seq = 0;

  constructor(popup: Popup) {
    this.popup = popup;
    document.addEventListener('mousemove', (e) => this.onMove(e), { passive: true });
    document.addEventListener('mousedown', (e) => {
      if (!this.popup.contains(e.target)) this.popup.hide();
    });
    window.addEventListener('scroll', () => !this.popup.pinned && this.popup.hide(), { passive: true });
    this.popup.onHide(() => {
      this.currentKey = '';
      CSS.highlights?.delete(HIGHLIGHT);
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
    if (this.popup.contains(target)) {
      // Landing on a card that just opened means the pointer is sweeping past:
      // close it and look at the text underneath instead.
      if (this.popup.pinned || this.popup.age() > 500) return;
      this.popup.hide();
    }
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

    const { text: str, ranges } = textFrom(text, offset);
    const key = `${str}@${Math.round(this.charRect(text, offset)?.left ?? 0)}`;
    if (key === this.currentKey) {
      this.popup.cancelHide();
      return;
    }
    const matches = await lookupText(str);
    if (seq !== this.seq) return; // the pointer moved on while we were looking up
    if (!matches.length) return this.scheduleHide();
    this.currentKey = key;
    const range = this.rangeFor(ranges, matches[0].text.length);
    this.highlight(range);
    this.popup.show({
      matches,
      rect: range.getBoundingClientRect(),
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
    for (const i of [offset, offset - 1]) {
      const r = this.charRect(node, i);
      if (r && this.lastX >= r.left - 1 && this.lastX <= r.right + 1 && this.lastY >= r.top - 2 && this.lastY <= r.bottom + 2) return i;
    }
    return -1;
  }

  private rangeFor(ranges: [Text, number, number][], len: number): Range {
    const r = document.createRange();
    const [n0, s0] = ranges[0];
    r.setStart(n0, s0);
    let left = len;
    for (const [n, s, e] of ranges) {
      const take = Math.min(left, e - s);
      r.setEnd(n, s + take);
      left -= take;
      if (left <= 0) break;
    }
    return r;
  }

  private highlight(range: Range) {
    if (!CSS.highlights) return;
    if (!this.cssInjected) {
      this.cssInjected = true;
      browser.runtime.sendMessage({ type: 'insertCSS', css: `::highlight(${HIGHLIGHT}){background:#f3d27a;color:#31261a}` });
    }
    CSS.highlights.set(HIGHLIGHT, new Highlight(range));
  }

  private scheduleHide() {
    if (this.currentKey) this.popup.hideSoon();
  }
}
