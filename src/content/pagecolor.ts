import { CJK } from '../shared/dict.ts';
import type { Status, Token } from '../shared/types.ts';
import { state } from './state.ts';

const NAMES: Record<Status, string> = { fresh: 'cb-fresh', learning: 'cb-learning', known: 'cb-known' };
const CSS_TEXT = `
::highlight(cb-fresh){background-color:rgba(239,47,66,.24)}
::highlight(cb-learning){background-color:rgba(255,200,31,.42)}
::highlight(cb-known){background-color:rgba(31,174,79,.16)}`;
const SKIP = 'script,style,noscript,textarea,input,select,code,pre,[contenteditable=""],[contenteditable="true"],chinese-brain-popup,[data-cb-own]';
const MAX_CHARS = 300_000;

/**
 * Colors every word on the page by its status, like the subtitles do. Uses
 * the CSS Custom Highlight API, so the page's DOM is never modified.
 */
export class PageColors {
  private words: { range: Range; word: string }[] = [];
  private done = new WeakSet<Text>();
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
    const want = state.settings.pageColors && state.siteEnabled() && !!CSS.highlights;
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
      browser.runtime.sendMessage({ type: 'insertCSS', css: CSS_TEXT });
    }
    await state.loadStatuses();
    await this.scan(document.body);
    this.observer = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') {
          // Edited text: forget its old ranges and color it again.
          const t = m.target as Text;
          this.done.delete(t);
          this.words = this.words.filter((w) => w.range.startContainer !== t);
          this.pending.add(t);
        } else m.addedNodes.forEach((n) => this.pending.add(n));
      }
      // Throttle (not debounce), so pages that change constantly still get colored.
      this.timer ??= setTimeout(() => {
        this.timer = undefined;
        const nodes = [...this.pending];
        this.pending.clear();
        nodes.forEach((n) => n.isConnected && this.scan(n));
      }, 700);
    });
    this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  private stop() {
    this.observer?.disconnect();
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending.clear();
    for (const name of Object.values(NAMES)) CSS.highlights?.delete(name);
    this.words = [];
    this.done = new WeakSet();
    this.chars = 0;
  }

  private async scan(root: Node) {
    if (!this.on || this.chars > MAX_CHARS) return;
    const nodes: Text[] = [];
    const accept = (t: Text) => !this.done.has(t) && CJK.test(t.data) && !t.parentElement?.closest(SKIP);
    if (root.nodeType === Node.TEXT_NODE) {
      // A text node added on its own (a TreeWalker never returns its root).
      const t = root as Text;
      if (accept(t)) {
        nodes.push(t);
        this.done.add(t);
        this.chars += t.data.length;
      }
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (accept(n as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    for (let n = walker.nextNode(); n && this.chars < MAX_CHARS; n = walker.nextNode()) {
      nodes.push(n as Text);
      this.done.add(n as Text);
      this.chars += (n as Text).data.length;
    }
    for (let i = 0; i < nodes.length; i += 400) {
      const batch = nodes.slice(i, i + 400);
      const tokens: Token[][] = await browser.runtime.sendMessage({ type: 'segment', lines: batch.map((n) => n.data) });
      batch.forEach((node, k) => {
        let off = 0;
        for (const t of tokens[k]) {
          if (t.word && CJK.test(t.text)) {
            const r = document.createRange();
            r.setStart(node, off);
            r.setEnd(node, off + t.text.length);
            this.words.push({ range: r, word: t.word });
          }
          off += t.text.length;
        }
      });
    }
    this.paint();
  }

  private paint() {
    if (!this.on || !CSS.highlights) return;
    const sets: Record<Status, Range[]> = { fresh: [], learning: [], known: [] };
    this.words = this.words.filter((w) => w.range.startContainer.isConnected);
    for (const w of this.words) {
      const st = state.status(w.word);
      if (st) sets[st].push(w.range);
    }
    for (const st of Object.keys(sets) as Status[]) CSS.highlights.set(NAMES[st], new Highlight(...sets[st]));
  }

  /** Share of the words on this page per status, for the toolbar popup. */
  private stats() {
    const c = { fresh: 0, learning: 0, known: 0, new: 0, total: this.words.length, on: this.on };
    for (const w of this.words) c[state.status(w.word) ?? 'new']++;
    return c;
  }
}
