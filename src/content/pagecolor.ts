import { CJK } from '../shared/dict.ts';
import type { Status, Token } from '../shared/types.ts';
import { addPageCSS } from './css.ts';
import { state } from './state.ts';

const NAMES: Record<Status, string> = { fresh: 'cb-fresh', learning: 'cb-learning', known: 'cb-known' };
const CSS_TEXT = `
::highlight(cb-fresh){background-color:rgba(239,47,66,.24)}
::highlight(cb-learning){background-color:rgba(255,200,31,.42)}
::highlight(cb-known){background-color:rgba(31,174,79,.16)}`;
// Editable text (Notion, Google Docs-style editors) is colored too: highlights never touch the DOM.
const SKIP = 'script,style,noscript,textarea,input,select,code,pre,chinese-brain-popup,[data-cb-own]';
const MAX_CHARS = 300_000;

/** A text node's words, as [start, end, word], segmented from `data`. */
interface Seg {
  data: string;
  words: { s: number; e: number; word: string; range?: Range }[];
}

/**
 * Colors every word on the page by its status, like the subtitles do. Uses
 * the CSS Custom Highlight API, so the page's DOM is never modified.
 *
 * Words are kept per text node, not as live ranges: pages that re-render (image
 * grids, lightboxes, React lists) detach and re-insert text nodes, which collapses
 * any range inside them. A node that comes back is colored again from its words.
 */
export class PageColors {
  private segs = new Map<Text, Seg>();
  private chars = 0;
  private observer: MutationObserver | undefined;
  private pending = new Set<Node>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private on = false;
  private cssInjected = false;

  constructor() {
    state.onChange(() => this.sync());
    this.sync();
    browser.runtime.onMessage.addListener((msg: { type: string }) => {
      if (msg.type === 'pageStats') return Promise.resolve(this.stats());
      return undefined;
    });
  }

  private sync() {
    const want = state.colorsEnabled() && !!CSS.highlights;
    if (want === this.on) {
      if (want) this.paint();
      return;
    }
    this.on = want;
    if (want) this.start();
    else this.stop();
  }

  private async start() {
    if (!this.cssInjected) {
      this.cssInjected = true;
      addPageCSS(CSS_TEXT);
    }
    await state.loadStatuses();
    if (!this.on) return;
    this.observer = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') this.pending.add(m.target);
        else m.addedNodes.forEach((n) => this.pending.add(n));
      }
      // Throttle (not debounce), so pages that change constantly still get colored.
      this.timer ??= setTimeout(() => {
        this.timer = undefined;
        const nodes = [...this.pending];
        this.pending.clear();
        void this.scan(nodes.filter((n) => n.isConnected));
      }, 700);
    });
    this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    await this.scan([document.body]);
  }

  private stop() {
    this.observer?.disconnect();
    this.observer = undefined;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending.clear();
    for (const name of Object.values(NAMES)) CSS.highlights?.delete(name);
    this.segs.clear();
    this.chars = 0;
  }

  private async scan(roots: Node[]) {
    if (!this.on) return;
    const nodes: Text[] = [];
    const seen = new Set<Text>();
    // New text, or text whose content changed since it was segmented.
    const visit = (t: Text) => {
      if (seen.has(t) || !CJK.test(t.data) || t.parentElement?.closest(SKIP)) return;
      seen.add(t);
      if (this.segs.get(t)?.data !== t.data) nodes.push(t);
    };
    for (const root of roots) {
      // A text node added on its own (a TreeWalker never returns its root).
      if (root.nodeType === Node.TEXT_NODE) visit(root as Text);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n && this.chars < MAX_CHARS; n = walker.nextNode()) visit(n as Text);
    }
    for (let i = 0; i < nodes.length && this.chars < MAX_CHARS; i += 400) {
      const batch = nodes.slice(i, i + 400);
      const data = batch.map((n) => n.data);
      const tokens: Token[][] = await browser.runtime.sendMessage({ type: 'segment', lines: data });
      if (!this.on) return;
      batch.forEach((node, k) => {
        const seg: Seg = { data: data[k], words: [] };
        let off = 0;
        for (const t of tokens[k]) {
          if (t.word && CJK.test(t.text)) seg.words.push({ s: off, e: off + t.text.length, word: t.word });
          off += t.text.length;
        }
        this.chars += seg.data.length - (this.segs.get(node)?.data.length ?? 0);
        this.segs.set(node, seg);
      });
    }
    this.paint();
  }

  private paint() {
    if (!this.on || !CSS.highlights) return;
    const sets: Record<Status, Range[]> = { fresh: [], learning: [], known: [] };
    for (const [node, seg] of this.segs) {
      // Gone from the page: forget it (it is segmented again if it comes back).
      if (!node.isConnected) {
        this.segs.delete(node);
        this.chars -= seg.data.length;
        continue;
      }
      if (node.data !== seg.data) continue; // changed: a scan is on its way
      for (const w of seg.words) {
        const st = state.status(w.word);
        if (!st) continue;
        // A range collapses when its node is taken out of the page; make it again.
        if (w.range?.startContainer !== node || w.range.endContainer !== node || w.range.collapsed) {
          w.range = document.createRange();
          w.range.setStart(node, w.s);
          w.range.setEnd(node, w.e);
        }
        sets[st].push(w.range);
      }
    }
    for (const st of Object.keys(sets) as Status[]) CSS.highlights.set(NAMES[st], new Highlight(...sets[st]));
  }

  /** Share of the words on this page per status, for the toolbar popup. */
  private stats() {
    const c = { fresh: 0, learning: 0, known: 0, new: 0, total: 0, on: this.on };
    for (const [node, seg] of this.segs) {
      if (!node.isConnected) continue;
      for (const w of seg.words) {
        c[state.status(w.word) ?? 'new']++;
        c.total++;
      }
    }
    return c;
  }
}
