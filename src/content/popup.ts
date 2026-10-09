import { CJK } from '../shared/dict.ts';
import { numberedToMarked } from '../shared/pinyin.ts';
import type { Context, Entry, LookupMatch, Status, Token } from '../shared/types.ts';
import { speak, stampSound } from './audio.ts';
import { lookupText } from './lookup.ts';
import css from './popup.css';
import { state } from './state.ts';

export const STAMPS: { s: Status; zh: string; key: string; label: string }[] = [
  { s: 'fresh', zh: '新', key: '1', label: 'Fresh' },
  { s: 'learning', zh: '學', key: '2', label: 'Learning' },
  { s: 'known', zh: '熟', key: '3', label: 'Known' },
];

interface Sentence {
  zh: string;
  toks: Token[];
}
interface WordInfo {
  /** The breakdown: smaller words (depth 0) with their characters indented under them. */
  chars: { ch: string; py: string; gloss: string; depth: number }[];
  examples: (Sentence & { en: string })[];
  seen: (Sentence & Context)[];
  /** Example sentences you saved (for the export). */
  saved: string[];
}

type H = HTMLElement;
function h(tag: string, attrs: Record<string, string> | null, ...kids: (Node | string | null | undefined | false)[]): H {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const k of kids) if (k) el.append(k);
  return el;
}

/** Turn "variant of 臺|台[tai2]" into "variant of 臺 tái". */
function prettyDef(d: string): string {
  return d.replace(/([^\s\[|,;(]+)(?:\|([^\s\[,;]+))?\[([a-zA-Z0-9: ]+)\]/g, (_, t: string, _s: string, p: string) => `${t} ${numberedToMarked(p)}`);
}

/** How common a word is, in words: Zipf score (x10) thresholds, roughly the top 1k / 4k / 9k / 23k words. */
const FREQ = [
  { min: 52, bars: 5, label: 'essential', tip: "One of the words you'll meet every day. Learn it now." },
  { min: 45, bars: 4, label: 'very common', tip: 'Comes up all the time in speech and writing. Worth learning soon.' },
  { min: 40, bars: 3, label: 'common', tip: "You'll meet it regularly in shows, news and conversation." },
  { min: 33, bars: 2, label: 'less common', tip: 'Shows up now and then. Learn it if it keeps coming back.' },
  { min: 1, bars: 1, label: 'rare', tip: 'Rarely used. Fine to skip for now.' },
];
export function frequency(zipf: number) {
  return FREQ.find((f) => zipf >= f.min);
}

/** The first real sense of an entry, short enough for a one-line hint. */
function mainSense(e: Entry): string {
  const d = e.defs.find((x) => !x.startsWith('CL:') && !/^(old )?variant of|^see /i.test(x)) ?? e.defs[0] ?? '';
  const first = prettyDef(d).split(/;\s*/)[0];
  return first.length > 60 ? first.slice(0, 58) + '…' : first;
}

type Pt = { x: number; y: number };
/** Is p inside triangle abc, allowing `pad` px outside each edge? */
function inTriangle(p: Pt, a: Pt, b: Pt, c: Pt, pad: number): boolean {
  const side = (u: Pt, v: Pt, w: Pt, q: Pt) => {
    const len = Math.hypot(v.x - u.x, v.y - u.y) || 1;
    const sq = (v.x - u.x) * (q.y - u.y) - (v.y - u.y) * (q.x - u.x);
    const sw = (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
    return sq * Math.sign(sw || 1) >= -pad * len;
  };
  return side(a, b, c, p) && side(b, c, a, p) && side(c, a, b, p);
}

/**
 * Is the point inside the trapezoid that runs from the word's edge (at `from`, spanning
 * lo0..hi0) to the card's edge (at `to`, spanning lo1..hi1)? p is the position along that
 * direction, q across it. It starts exactly at the word, so the word's own line (and the
 * words next to it) never counts as "on the way".
 */
function inTrapezoid(p: number, from: number, to: number, lo0: number, hi0: number, lo1: number, hi1: number, q: number, pad: number): boolean {
  const len = Math.abs(to - from);
  const t = (p - from) * (to >= from ? 1 : -1);
  if (t <= 0 || t > len + pad) return false;
  const f = len ? Math.min(1, t / len) : 0;
  return q >= lo0 + (lo1 - lo0) * f - pad && q <= hi0 + (hi1 - hi0) * f + pad;
}

export interface ShowOptions {
  matches: LookupMatch[];
  /** The word on screen. */
  rect: DOMRect;
  /** Pointer position; the card opens just below it. */
  cursor?: { x: number; y: number };
  ctx?: Context;
  src: 'yt' | 'web';
  /** Keep the card open until closed. */
  pinned?: boolean;
}

/** The one lookup card, used by hover lookup, selections and the YouTube subtitles. */
export class Popup {
  private host: H;
  private root: ShadowRoot;
  private card: H;
  /** The small, non-interactive hint over words inside the card. */
  private hint: H;
  private hintSeq = 0;
  private opts: ShowOptions | undefined;
  private info: WordInfo | undefined;
  private gemState: { word: string; busy: boolean; error?: string } | undefined;
  /** The word the card belongs to, for the corridor between them (gone after a scroll). */
  private anchor: DOMRect | undefined;
  private px = -1;
  private py = -1;
  /** The last point where the pointer was on the word: the tip of the "safe triangle" to the card. */
  private exit: Pt | undefined;
  private shownAt = 0;
  private hovered = false;
  /** Cards visited by clicking words inside the card, and where we are in them (← →). */
  private trail: ShowOptions[] = [];
  private pos = 0;
  /** The word inside the card under the pointer: shortcuts act on it while it is hovered. */
  private hoverWord: { q: string; sentence: string } | undefined;
  private lookTimer: ReturnType<typeof setTimeout> | undefined;
  private softTimer: ReturnType<typeof setTimeout> | undefined;
  /** A hide is counting down (moving on doesn't restart it, so leaving is quick). */
  private hiding = false;
  private hideListeners = new Set<() => void>();
  private infoCache = new Map<string, WordInfo>();

  constructor() {
    this.host = document.createElement('chinese-brain-popup');
    this.root = this.host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = css;
    this.card = h('div', { class: 'card', hidden: '' });
    this.hint = h('div', { class: 'hint', hidden: '' });
    this.root.append(style, this.card, this.hint);
    document.addEventListener(
      'mousemove',
      (e) => {
        this.px = e.clientX;
        this.py = e.clientY;
        const a = this.anchor;
        if (a && e.clientX >= a.left - 2 && e.clientX <= a.right + 2 && e.clientY >= a.top - 2 && e.clientY <= a.bottom + 2) {
          this.exit = { x: e.clientX, y: e.clientY };
        }
      },
      { capture: true, passive: true },
    );
    // Hovering a word inside the card shows its main sense (and pinyin): look, don't touch.
    this.card.addEventListener('mouseover', (e) => {
      const w = (e.target as HTMLElement).closest('.w') as H | null;
      this.hoverWord = w?.dataset.q ? { q: w.dataset.q, sentence: w.closest('li')?.querySelector('.zh')?.textContent ?? '' } : undefined;
      if (w && !w.classList.contains('c')) void this.showHint(w);
      else this.hideHint();
    });
    this.card.addEventListener('mouseout', (e) => {
      const w = (e.target as HTMLElement).closest('.w');
      if (w && !w.contains(e.relatedTarget as Node | null)) this.hideHint();
    });
    this.card.addEventListener('scroll', () => this.hideHint(), { passive: true });
    for (const t of ['mousedown', 'mouseup', 'dblclick', 'pointerdown', 'pointerup']) this.card.addEventListener(t, (e) => e.stopPropagation());
    this.card.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onCardClick(e);
    });
    this.card.addEventListener('mouseenter', () => {
      this.hovered = true;
      this.cancelHide();
    });
    this.card.addEventListener('mouseleave', () => {
      this.hovered = false;
      this.hoverWord = undefined;
      this.hideHint();
      if (!this.pinned) this.hideSoon();
    });
    state.onChange(() => {
      if (this.opts) {
        this.infoCache.clear();
        this.render();
      }
    });
    document.addEventListener('fullscreenchange', () => this.mount());
  }

  get visible() {
    return !!this.opts;
  }
  /** Where the open card came from ('yt' subtitles or 'web'). */
  get src() {
    return this.opts?.src;
  }
  get pinned() {
    return !!this.opts?.pinned;
  }
  /** Milliseconds since the card was last shown. */
  age(): number {
    return Date.now() - this.shownAt;
  }
  get current(): LookupMatch | undefined {
    return this.opts?.matches[0];
  }
  get isHovered() {
    return this.hovered;
  }

  contains(node: EventTarget | null): boolean {
    return node === this.host;
  }

  private mount() {
    const parent = document.fullscreenElement ?? document.documentElement;
    if (this.host.parentNode !== parent) parent.append(this.host);
  }

  onHide(fn: () => void) {
    this.hideListeners.add(fn);
  }

  /**
   * Hide after a short grace period, unless the pointer is on the card or on its
   * way there: while it is in the corridor between the word and the card, however
   * slowly it moves, the card waits.
   */
  hideSoon(ms = 140) {
    if (!this.opts || this.pinned || this.hiding) return;
    this.hiding = true;
    const check = () => {
      if (!this.opts || this.pinned || this.hovered) {
        this.hiding = false;
        return;
      }
      if (this.inBridge(this.px, this.py)) {
        this.softTimer = setTimeout(check, 50);
        return;
      }
      this.hide();
    };
    this.softTimer = setTimeout(check, ms);
  }

  /**
   * Is (x, y) on the way from the word to the card (whichever side the card is on)? Two
   * shapes count: the corridor between the word's edge and the card's facing edge, and the
   * "safe triangle" from the last point on the word to the card's two near corners, so a
   * diagonal path that leaves the word by another edge still counts.
   */
  inBridge(x: number, y: number): boolean {
    const a = this.anchor;
    if (!this.opts || !a || this.card.hidden || x < 0) return false;
    if (x >= a.left && x <= a.right && y >= a.top && y <= a.bottom) return false; // on the word itself
    const c = this.card.getBoundingClientRect();
    const pad = 8;
    const p = { x, y };
    const e = this.exit;
    let near: [Pt, Pt] | undefined;
    let lane = false;
    if (c.top >= a.bottom - 2) {
      lane = inTrapezoid(y, a.bottom, c.top, a.left, a.right, c.left, c.right, x, pad);
      near = [{ x: c.left, y: c.top }, { x: c.right, y: c.top }];
    } else if (c.bottom <= a.top + 2) {
      lane = inTrapezoid(y, a.top, c.bottom, a.left, a.right, c.left, c.right, x, pad);
      near = [{ x: c.left, y: c.bottom }, { x: c.right, y: c.bottom }];
    } else if (c.left >= a.right - 2) {
      lane = inTrapezoid(x, a.right, c.left, a.top, a.bottom, c.top, c.bottom, y, pad);
      near = [{ x: c.left, y: c.top }, { x: c.left, y: c.bottom }];
    } else if (c.right <= a.left + 2) {
      lane = inTrapezoid(x, a.left, c.right, a.top, a.bottom, c.top, c.bottom, y, pad);
      near = [{ x: c.right, y: c.top }, { x: c.right, y: c.bottom }];
    }
    // Card above or below: the triangle only counts past the word's edge, so the words beside it on its line stay hoverable.
    const past = c.top >= a.bottom - 2 ? y > a.bottom : c.bottom <= a.top + 2 ? y < a.top : true;
    return lane || (past && !!near && !!e && inTriangle(p, e, near[0], near[1], pad));
  }

  /** The page scrolled under a card the pointer rests on: keep it, but the word has moved away. */
  detach() {
    this.anchor = undefined;
    this.exit = undefined;
    this.hideHint();
  }

  cancelHide() {
    clearTimeout(this.softTimer);
    this.hiding = false;
  }

  async show(opts: ShowOptions, keepPlace = false) {
    const sameWord = this.opts?.matches[0]?.word === opts.matches[0]?.word;
    this.opts = opts;
    this.cancelHide();
    if (!keepPlace) {
      this.trail = [opts];
      this.pos = 0;
    }
    this.mount();
    const m = opts.matches[0];
    const e0 = m.entries[0];
    const [, info] = await Promise.all([state.loadStatuses(), this.wordInfo(m.word, e0.tw || e0.py)]);
    if (this.opts !== opts) return; // a newer show() won
    this.info = info;
    this.hoverWord = undefined;
    this.hideHint();
    this.render();
    if (!keepPlace) {
      this.anchor = opts.rect;
      this.exit = this.px >= 0 ? { x: this.px, y: this.py } : undefined;
      this.position(opts);
    } else this.keepOnScreen();
    this.shownAt = Date.now();
    clearTimeout(this.lookTimer);
    // A card left open for a moment counts as a deliberate lookup.
    this.lookTimer = setTimeout(() => this.recordLook(), opts.pinned ? 0 : 1200);
  }

  private async wordInfo(word: string, py: string): Promise<WordInfo> {
    const hit = this.infoCache.get(word);
    if (hit) return hit;
    const info: WordInfo = await browser.runtime.sendMessage({ type: 'wordInfo', word, py });
    if (this.infoCache.size > 200) this.infoCache.clear();
    this.infoCache.set(word, info);
    return info;
  }

  hide() {
    if (!this.opts) return;
    clearTimeout(this.lookTimer);
    this.cancelHide();
    this.opts = undefined;
    this.trail = [];
    this.pos = 0;
    this.hoverWord = undefined;
    this.hovered = false;
    this.anchor = undefined;
    this.exit = undefined;
    this.card.hidden = true;
    this.hideHint();
    this.hideListeners.forEach((f) => f());
  }

  private recordLook() {
    const m = this.current;
    if (!m || !this.opts) return;
    browser.runtime.sendMessage({ type: 'looked', word: m.word, src: this.opts.src, url: this.opts.ctx?.url, ctx: this.opts.ctx });
  }

  /** Set a status; pressing the active one again clears it. */
  setStatus(status: Status | null, toggle = true) {
    const m = this.current;
    if (!m || !this.opts) return;
    const cur = state.status(m.word);
    const next = toggle && cur === status ? null : status;
    if (next === cur) return;
    if (next) state.statuses.set(m.word, next);
    else state.statuses.delete(m.word);
    stampSound(next);
    this.infoCache.delete(m.word);
    this.render(next ?? undefined);
    browser.runtime.sendMessage({ type: 'setStatus', word: m.word, status: next, entry: m.entries[0], ctx: this.opts.ctx });
  }

  speak() {
    const m = this.current;
    if (m) void speak(m.word);
  }

  images(word = this.current?.word) {
    if (word) window.open(`https://duckduckgo.com/?q=${encodeURIComponent(word)}&iax=images&ia=images&kl=tw-tzh`, '_blank');
  }

  /** Open a word clicked inside the card, in the same place, with a way back (← and →). */
  private async openInside(q: string) {
    if (!this.opts) return;
    const matches = await lookupText(q);
    if (!matches.length || !this.opts) return;
    const exact = matches.findIndex((m) => m.text === q);
    const ordered = exact > 0 ? [matches[exact], ...matches.filter((_, i) => i !== exact)] : matches;
    if (ordered[0].word === this.current?.word) return; // already showing this word
    const next = { ...this.opts, matches: ordered, pinned: true };
    // Like a browser: opening a word drops anything you had gone back from.
    this.trail = [...this.trail.slice(0, this.pos + 1).map((o) => ({ ...o, pinned: true })), next];
    this.pos = this.trail.length - 1;
    await this.show(next, true);
  }

  /** ← the word before (true when there was one). */
  back(): boolean {
    if (this.pos <= 0) return false;
    this.pos--;
    void this.show(this.trail[this.pos], true);
    return true;
  }

  /** → the word you came back from. */
  forward(): boolean {
    if (this.pos >= this.trail.length - 1) return false;
    this.pos++;
    void this.show(this.trail[this.pos], true);
    return true;
  }

  private onCardClick(e: Event) {
    const t = (e.target as HTMLElement).closest('[data-q]') as HTMLElement | null;
    if (t?.dataset.q) void this.openInside(t.dataset.q);
  }

  /** Keyboard shortcuts while the card is open. Returns true when handled. */
  handleKey(e: KeyboardEvent): boolean {
    if (!this.opts || e.ctrlKey || e.metaKey || e.altKey) return false;
    // Pointing at a word inside the card: 1 2 3 0 V I are for that word.
    if (this.hoverWord && this.hovered && /^[1230vi]$/.test(e.key)) {
      void this.actOnHovered(e.key, this.hoverWord);
      return true;
    }
    switch (e.key) {
      case '1':
        this.setStatus('fresh');
        return true;
      case '2':
        this.setStatus('learning');
        return true;
      case '3':
        this.setStatus('known');
        return true;
      case '0':
      case 'Backspace':
        this.setStatus(null, false);
        return true;
      case 'v':
        this.speak();
        return true;
      case 'i':
        this.images();
        return true;
      case 'ArrowLeft':
        return this.back();
      case 'ArrowRight':
        return this.forward();
      case 'Escape':
        this.hide();
        return true;
    }
    return false;
  }

  /** A shortcut for the word under the pointer inside the card. */
  private async actOnHovered(key: string, target: { q: string; sentence: string }) {
    const matches = await lookupText(target.q);
    const m = matches.find((x) => x.text === target.q) ?? matches[0];
    if (!m || !this.opts) return;
    if (key === 'v') return void speak(m.word);
    if (key === 'i') return this.images(m.word);
    const want: Status | null = key === '1' ? 'fresh' : key === '2' ? 'learning' : key === '3' ? 'known' : null;
    const cur = state.status(m.word);
    const next = want && cur === want ? null : want;
    if (next === cur) return;
    if (next) state.statuses.set(m.word, next);
    else state.statuses.delete(m.word);
    stampSound(next);
    const ctx: Context | undefined = target.sentence
      ? { text: target.sentence, url: location.href, title: document.title, at: Date.now(), src: this.opts.src }
      : undefined;
    browser.runtime.sendMessage({ type: 'setStatus', word: m.word, status: next, entry: m.entries[0], ctx });
  }

  private async showHint(el: H) {
    const q = el.dataset.q;
    if (!q) return;
    const seq = ++this.hintSeq;
    const matches = await lookupText(q);
    if (seq !== this.hintSeq || !el.isConnected || this.card.hidden) return;
    const m = matches.find((x) => x.text === q) ?? matches[0];
    if (!m) return this.hideHint();
    const e = m.entries[0];
    const hint = this.hint;
    hint.classList.toggle('large', state.settings.cardSize === 'large');
    hint.replaceChildren(
      h('div', { class: 'hg' }, mainSense(e)),
      h('div', { class: 'hpy' }, numberedToMarked(e.tw || e.py, false)),
    );
    hint.hidden = false;
    const r = el.getBoundingClientRect();
    const w = hint.offsetWidth;
    const ht = hint.offsetHeight;
    let y = r.top - ht - 6;
    if (y < 4) y = r.bottom + 6;
    hint.style.left = `${Math.min(Math.max(4, r.left + r.width / 2 - w / 2), window.innerWidth - w - 4)}px`;
    hint.style.top = `${y}px`;
  }

  private hideHint() {
    this.hintSeq++;
    this.hint.hidden = true;
  }

  /** Ask Gemini for sentences when this word has fewer than two. */
  private async writeExamples(word: string, want: number) {
    this.gemState = { word, busy: true };
    this.render();
    // The request finishes in the background even if you move on; the result waits for you.
    const res: { ok?: boolean; error?: string } = await browser.runtime.sendMessage({ type: 'geminiExamples', word, want });
    this.infoCache.delete(word);
    this.gemState = res.ok ? undefined : { word, busy: false, error: res.error };
    const cur = this.current;
    if (cur?.word !== word) return;
    if (res.ok) {
      const e0 = cur.entries[0];
      this.info = await this.wordInfo(word, e0.tw || e0.py);
      if (this.current?.word !== word) return;
    }
    this.render();
  }

  /**
   * Never over the word or the pointer: below the word if the card fits there, else above;
   * if it fits in neither, beside the word (right, then left); failing that, in the taller
   * of the two gaps, scrolling inside.
   */
  private position(o: ShowOptions) {
    const c = this.card;
    c.style.maxHeight = '';
    const r = o.rect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 8;
    const gap = 10;
    const w = c.offsetWidth;
    let ht = c.offsetHeight;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
    const near = clamp((o.cursor?.x ?? r.left) - 28, m, vw - w - m);
    const belowTop = Math.max(r.bottom, o.cursor?.y ?? 0) + gap;
    const spaceBelow = vh - m - belowTop;
    const spaceAbove = r.top - gap - m;
    let x: number;
    let y: number;
    if (ht <= spaceBelow) [x, y] = [near, belowTop];
    else if (ht <= spaceAbove) [x, y] = [near, r.top - gap - ht];
    else if (vw - m - (r.right + gap) >= w || r.left - gap - m >= w) {
      x = vw - m - (r.right + gap) >= w ? r.right + gap : r.left - gap - w;
      if (ht > vh - 2 * m) {
        ht = vh - 2 * m;
        c.style.maxHeight = `${ht}px`;
      }
      y = clamp(r.top - 40, m, vh - m - ht);
    } else {
      const roomy = spaceBelow >= spaceAbove;
      ht = Math.max(120, roomy ? spaceBelow : spaceAbove);
      c.style.maxHeight = `${ht}px`;
      [x, y] = [near, roomy ? belowTop : r.top - gap - ht];
    }
    c.style.left = `${x}px`;
    c.style.top = `${y}px`;
  }

  /** After the content changed in place (← →, a clicked word), keep the card inside the window. */
  private keepOnScreen() {
    const c = this.card;
    const b = c.getBoundingClientRect();
    const vh = window.innerHeight;
    if (b.bottom > vh - 8) c.style.top = `${Math.max(8, vh - 8 - b.height)}px`;
  }

  /** Save an example sentence to learn it: it goes into the export for Claude. */
  private saveButton(word: string, zh: string, en: string): H {
    const on = !!this.info?.saved?.includes(zh);
    const b = h('button', { class: `save${on ? ' on' : ''}`, title: on ? 'Saved for your export (click to unsave)' : 'Save this sentence to learn it', 'aria-label': 'Save this sentence' });
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M4 2.5h8v11l-4-3-4 3z');
    svg.append(path);
    b.append(svg);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const next = !this.info?.saved?.includes(zh);
      if (this.info) this.info = { ...this.info, saved: next ? [...(this.info.saved ?? []), zh] : (this.info.saved ?? []).filter((x) => x !== zh) };
      if (next) stampSound('known');
      this.infoCache.delete(word);
      this.render();
      void browser.runtime.sendMessage({ type: 'saveSentence', word, zh, en, on: next });
    });
    return b;
  }

  /** A small × that deletes a sentence from this word's card for good. */
  private deleteButton(word: string, msg: { type: 'hideExample'; zh: string } | { type: 'forgetContext'; text: string }): H {
    const b = h('button', { class: 'del', title: 'Delete this sentence', 'aria-label': 'Delete this sentence' }, '×');
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      // Gone at once; the stored lists follow (and the card refills from them).
      if (this.info && this.current?.word === word) {
        this.info = {
          ...this.info,
          examples: msg.type === 'hideExample' ? this.info.examples.filter((x) => x.zh !== msg.zh) : this.info.examples,
          seen: msg.type === 'forgetContext' ? this.info.seen.filter((c) => c.text !== msg.text) : this.info.seen,
        };
        this.render();
      }
      this.infoCache.delete(word);
      void browser.runtime.sendMessage({ ...msg, word }).then(async () => {
        this.infoCache.delete(word);
        const cur = this.current;
        if (cur?.word !== word) return;
        const e0 = cur.entries[0];
        this.info = await this.wordInfo(word, e0.tw || e0.py);
        if (this.current?.word === word) this.render();
      });
    });
    return b;
  }

  /** A small speaker button that reads a sentence aloud. */
  private sayButton(text: string): H {
    const b = h('button', { class: 'say', title: 'Play the sentence', 'aria-label': 'Play the sentence' });
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M2 6h3l4-3v10l-4-3H2zM11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.5a6 6 0 0 1 0 9');
    svg.append(path);
    b.append(svg);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      void speak(text);
    });
    return b;
  }

  /** A clickable, status-colored word. */
  private word(text: string, q: string, word?: string): H {
    const el = h('span', { class: 'w', 'data-q': q }, text);
    const st = state.settings.cardColors && word ? state.status(word) : undefined;
    if (st) el.classList.add('st-' + st);
    return el;
  }

  /** Sentence tokens as clickable words; the headword is underlined. */
  private sentence(toks: Token[], head: string): (Node | string)[] {
    return toks.map((t) => {
      const text = t.trad ?? t.text;
      if (!t.word && !CJK.test(t.text)) return text;
      const el = this.word(text, t.text, t.word);
      if (t.word === head || text === head) el.classList.add('hw');
      else if (head && text.includes(head)) {
        // The headword inside a longer word: underline just its part, the word stays one word.
        const i = text.indexOf(head);
        el.replaceChildren(text.slice(0, i), h('span', { class: 'hwp' }, head), text.slice(i + head.length));
      }
      return el;
    });
  }

  /** Plain text with its Chinese runs made clickable (definitions, measure words). */
  private richText(text: string): (Node | string)[] {
    const out: (Node | string)[] = [];
    for (const m of text.matchAll(/[㐀-鿿豈-﫿]+|[^㐀-鿿豈-﫿]+/g)) {
      out.push(CJK.test(m[0][0]) ? this.word(m[0], m[0], m[0]) : m[0]);
    }
    return out;
  }

  private render(stamped?: Status) {
    const o = this.opts;
    const m = o?.matches[0];
    if (!o || !m) return;
    const status = state.status(m.word);
    const e0 = m.entries[0];
    const s = state.settings;
    const card = this.card;
    card.classList.toggle('pinned', !!o.pinned);
    card.classList.toggle('large', s.cardSize === 'large');
    card.replaceChildren();

    const freq = frequency(Math.max(...m.entries.map((e) => e.zipf)));
    // Pinyin is always shown here: opening the card means you are learning the word.
    const pyEl = h('span', { class: 'py' }, numberedToMarked(e0.tw || e0.py, false));

    // Senses grouped by reading; each group on one line.
    const groups = new Map<string, Entry[]>();
    for (const e of m.entries) {
      const k = (e.tw || e.py).toLowerCase();
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(e);
    }
    const readings: H[] = [];
    let first = true;
    for (const [reading, list] of groups) {
      const defs = [...new Set(list.flatMap((e) => e.defs))];
      const senses = defs.filter((d) => !d.startsWith('CL:')).slice(0, 10).map(prettyDef);
      const cls = defs.filter((d) => d.startsWith('CL:')).flatMap((d) => d.slice(3).split(','));
      const line = h('div', { class: 'defs' });
      if (!first) line.append(h('span', { class: 'rpy' }, numberedToMarked(reading, false)));
      senses.forEach((d, i) => {
        if (i) line.append(h('span', { class: 'sep' }, '·'));
        line.append(...this.richText(d));
      });
      const block = h('div', { class: 'reading' }, line);
      if (cls.length) {
        block.append(
          h(
            'div',
            { class: 'cl' },
            'measure word ',
            ...cls.flatMap((c, i) => {
              const mm = /^([^|\[]+)(?:\|[^\[]+)?\[([^\]]+)\]/.exec(c);
              return mm ? [i ? ', ' : '', this.word(mm[1], mm[1], mm[1]), ' ' + numberedToMarked(mm[2])] : [];
            }),
          ),
        );
      }
      readings.push(block);
      first = false;
    }

    const head = h('span', { class: `head${status ? ' st-' + status : ''}` }, m.word);
    const top = h('div', { class: 'top' });
    if (this.trail.length > 1) {
      const nav = h('div', { class: 'nav' });
      const backBtn = h('button', { title: 'Back (←)' }, '←');
      const fwdBtn = h('button', { title: 'Forward (→)' }, '→');
      if (this.pos <= 0) backBtn.setAttribute('disabled', '');
      if (this.pos >= this.trail.length - 1) fwdBtn.setAttribute('disabled', '');
      backBtn.addEventListener('click', () => this.back());
      fwdBtn.addEventListener('click', () => this.forward());
      nav.append(backBtn, fwdBtn);
      top.append(nav);
    }
    top.append(
      h(
        'div',
        { class: 'headrow' },
        head,
        pyEl,
        freq
          ? h(
              'span',
              { class: `freq f${freq.bars}`, title: freq.tip },
              h('span', { class: 'bars' }, ...[1, 2, 3, 4, 5].map((i) => h('i', { class: i <= freq.bars ? 'on' : '' }))),
              freq.label,
            )
          : null,
      ),
      ...readings,
    );
    card.append(top);

    const info = this.info;
    if (info?.chars.length) {
      const grid = h('div', { class: 'chars' });
      for (const c of info.chars) {
        const ch = this.word(c.ch, c.ch, c.ch);
        ch.classList.add('c');
        const cell = h('span', { class: `cw d${Math.min(c.depth, 3)}` }, ch);
        grid.append(cell, h('span', { class: 'cpy' }, numberedToMarked(c.py, false)), h('span', { class: 'cg' }, c.gloss));
      }
      card.append(h('div', { class: 'sect' }, grid));
    }

    // The sentence you're reading now isn't repeated; two at most, like the examples.
    const here = o.ctx?.text.split(' — ')[0].trim();
    const seen = (info?.seen ?? []).filter((c) => c.zh !== here && c.text !== o.ctx?.text).slice(0, 2);
    const examples = info?.examples ?? [];
    const canWrite = examples.length < 2 && !!s.geminiKey;
    if (examples.length || seen.length || canWrite) {
      const sect = h('div', { class: 'sect' });
      if (examples.length) {
        sect.append(
          h(
            'ul',
            { class: 'ex' },
            ...examples.map((x) =>
              h(
                'li',
                null,
                h('span', { class: 'zh' }, ...this.sentence(x.toks, m.word)),
                this.sayButton(x.zh),
                this.saveButton(m.word, x.zh, x.en),
                this.deleteButton(m.word, { type: 'hideExample', zh: x.zh }),
                h('span', { class: 'en' }, x.en),
              ),
            ),
          ),
        );
      }
      if (canWrite) {
        const g = this.gemState?.word === m.word ? this.gemState : undefined;
        const label = g?.busy ? 'Writing…' : examples.length ? '✦ Write another example with Gemini' : '✦ Write example sentences with Gemini';
        const b = h('button', { class: 'gem' }, label);
        if (g?.busy) b.setAttribute('disabled', '');
        b.addEventListener('click', () => void this.writeExamples(m.word, 2 - examples.length));
        sect.append(h('div', { class: 'gemrow', style: examples.length ? 'margin-top:6px' : '' }, b, g?.error ? h('div', { class: 'err' }, g.error) : null));
      }
      if (seen.length) {
        sect.append(
          h('div', { class: 'label', style: examples.length || canWrite ? 'margin-top:8px' : '' }, 'You met it in'),
          h(
            'ul',
            { class: 'ex seen' },
            ...seen.map((c) =>
              h(
                'li',
                null,
                h('span', { class: 'zh' }, ...this.sentence(c.toks, m.word)),
                this.sayButton(c.zh),
                this.deleteButton(m.word, { type: 'forgetContext', text: c.text }),
              ),
            ),
          ),
        );
      }
      card.append(sect);
    }

    const stamps = STAMPS.map((st) => {
      const b = h(
        'button',
        { class: `stamp ${st.s}${status === st.s ? ' on' : ''}${stamped === st.s ? ' pop' : ''}`, title: `${st.label} (${st.key})` },
        st.zh,
        h('small', null, st.key),
      );
      b.addEventListener('click', () => this.setStatus(st.s));
      return b;
    });
    const say = h('button', null, 'say', h('kbd', null, 'v'));
    say.addEventListener('click', () => this.speak());
    const img = h('button', null, 'images', h('kbd', null, 'i'));
    img.addEventListener('click', () => this.images());
    card.append(h('div', { class: 'foot' }, h('div', { class: 'stamps' }, ...stamps), h('div', { class: 'tools' }, say, img)));
    card.hidden = false;
  }
}
