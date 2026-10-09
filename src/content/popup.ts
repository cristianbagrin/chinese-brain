import { CJK } from '../shared/dict.ts';
import { shortSource } from '../shared/export.ts';
import { numberedToMarked } from '../shared/pinyin.ts';
import { clock } from '../shared/time.ts';
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
  chars: { ch: string; py: string; gloss: string }[];
  examples: (Sentence & { en: string })[];
  seen: (Sentence & Context)[];
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

/** 1..5 bars from the Zipf score. */
function freqBars(zipf: number): number {
  if (zipf >= 60) return 5;
  if (zipf >= 50) return 4;
  if (zipf >= 42) return 3;
  if (zipf >= 33) return 2;
  return zipf > 0 ? 1 : 0;
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
  private opts: ShowOptions | undefined;
  private info: WordInfo | undefined;
  private shownAt = 0;
  private hovered = false;
  private revealPy = false;
  /** Cards visited by clicking words inside the card (for the back arrow). */
  private history: ShowOptions[] = [];
  private lookTimer: ReturnType<typeof setTimeout> | undefined;
  private softTimer: ReturnType<typeof setTimeout> | undefined;
  private hideListeners = new Set<() => void>();
  private infoCache = new Map<string, WordInfo>();

  constructor() {
    this.host = document.createElement('chinese-brain-popup');
    this.root = this.host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = css;
    this.card = h('div', { class: 'card', hidden: '' });
    this.root.append(style, this.card);
    for (const t of ['mousedown', 'mouseup', 'dblclick', 'pointerdown', 'pointerup']) this.card.addEventListener(t, (e) => e.stopPropagation());
    this.card.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onCardClick(e);
    });
    this.card.addEventListener('mouseenter', () => {
      this.hovered = true;
      clearTimeout(this.softTimer);
    });
    this.card.addEventListener('mouseleave', () => {
      this.hovered = false;
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

  /** Hide after a short grace period, unless the pointer is on the card. */
  hideSoon(ms = 300) {
    if (!this.opts || this.pinned) return;
    clearTimeout(this.softTimer);
    this.softTimer = setTimeout(() => {
      if (!this.hovered && !this.pinned) this.hide();
    }, ms);
  }

  cancelHide() {
    clearTimeout(this.softTimer);
  }

  async show(opts: ShowOptions, keepPlace = false) {
    const sameWord = this.opts?.matches[0]?.word === opts.matches[0]?.word;
    this.opts = opts;
    clearTimeout(this.softTimer);
    if (!sameWord) this.revealPy = false;
    if (!keepPlace) this.history = [];
    this.mount();
    const m = opts.matches[0];
    const e0 = m.entries[0];
    const [, info] = await Promise.all([state.loadStatuses(), this.wordInfo(m.word, e0.tw || e0.py)]);
    if (this.opts !== opts) return; // a newer show() won
    this.info = info;
    this.render();
    if (!keepPlace) this.position(opts);
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
    clearTimeout(this.softTimer);
    this.opts = undefined;
    this.history = [];
    this.hovered = false;
    this.card.hidden = true;
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

  images() {
    const m = this.current;
    if (m) window.open(`https://duckduckgo.com/?q=${encodeURIComponent(m.word)}&iax=images&ia=images&kl=tw-tzh`, '_blank');
  }

  /** Open a word clicked inside the card, in the same place, with a way back. */
  private async openInside(q: string) {
    if (!this.opts) return;
    const matches = await lookupText(q);
    if (!matches.length || !this.opts) return;
    this.history.push(this.opts);
    await this.show({ ...this.opts, matches, ctx: this.opts.ctx, pinned: true }, true);
  }

  back() {
    const prev = this.history.pop();
    if (prev) void this.show({ ...prev, pinned: true }, true);
  }

  private onCardClick(e: Event) {
    const t = (e.target as HTMLElement).closest('[data-q]') as HTMLElement | null;
    if (t?.dataset.q) void this.openInside(t.dataset.q);
  }

  /** Keyboard shortcuts while the card is open. Returns true when handled. */
  handleKey(e: KeyboardEvent): boolean {
    if (!this.opts || e.ctrlKey || e.metaKey || e.altKey) return false;
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
      case 'p':
        if (state.settings.cardPinyin !== 'hover') return false;
        this.revealPy = !this.revealPy;
        this.render();
        return true;
      case 'Escape':
        if (this.history.length) this.back();
        else this.hide();
        return true;
    }
    return false;
  }

  /** Just below the pointer (or the word), never on top of the line being read. */
  private position(o: ShowOptions) {
    const c = this.card;
    const r = o.rect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = c.offsetWidth;
    const ht = c.offsetHeight;
    const x0 = o.cursor ? o.cursor.x - 28 : r.left;
    const x = Math.min(Math.max(8, x0), vw - w - 8);
    let y = Math.max(r.bottom, o.cursor?.y ?? 0) + 12;
    if (y + ht > vh - 8) y = Math.max(8, r.top - ht - 10);
    c.style.left = `${x}px`;
    c.style.top = `${y}px`;
  }

  /** A clickable, status-coloured word. */
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
      if (t.word === head || text === head) el.classList.add('head');
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
    card.replaceChildren();

    const zipf = Math.max(...m.entries.map((e) => e.zipf));
    const rank = e0.rank ?? 0;
    const bars = freqBars(zipf);
    const pyHidden = s.cardPinyin === 'hover' && !this.revealPy;
    const pyEl = h('span', { class: `py${pyHidden ? ' hidden' : ''}`, title: pyHidden ? 'p: show pinyin' : '' }, numberedToMarked(e0.tw || e0.py, false));
    pyEl.addEventListener('click', () => {
      this.revealPy = true;
      this.render();
    });

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
    if (this.history.length) {
      const backBtn = h('button', { class: 'back', title: 'Back (Esc)' }, '←');
      backBtn.addEventListener('click', () => this.back());
      top.append(backBtn);
    }
    top.append(
      h(
        'div',
        { class: 'headrow' },
        head,
        pyEl,
        bars
          ? h(
              'span',
              { class: 'freq', title: `Frequency rank #${rank.toLocaleString()} of all words` },
              h('span', { class: 'bars' }, ...[1, 2, 3, 4, 5].map((i) => h('i', { class: i <= bars ? 'on' : '', style: `height:${3 + i * 2}px` }))),
              rank ? `#${rank.toLocaleString()}` : '',
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
        grid.append(ch, h('span', { class: 'cpy' }, pyHidden ? '' : numberedToMarked(c.py)), h('span', { class: 'cg' }, c.gloss));
      }
      card.append(h('div', { class: 'sect' }, grid));
    }

    const seen = (info?.seen ?? []).filter((c) => c.text !== o.ctx?.text).slice(0, 3);
    if (info?.examples.length || seen.length) {
      const sect = h('div', { class: 'sect' });
      if (info?.examples.length) {
        sect.append(
          h(
            'ul',
            { class: 'ex' },
            ...info.examples.map((x) => h('li', null, h('span', { class: 'zh' }, ...this.sentence(x.toks, m.word)), h('span', { class: 'en' }, x.en))),
          ),
        );
      }
      if (seen.length) {
        sect.append(
          h('div', { class: 'label', style: info?.examples.length ? 'margin-top:8px' : '' }, 'You met it in'),
          h(
            'ul',
            { class: 'ex seen' },
            ...seen.map((c) => {
              const href = c.src === 'yt' && c.t != null ? `${c.url}&t=${c.t}s` : c.url;
              return h(
                'li',
                null,
                h('span', { class: 'zh' }, ...this.sentence(c.toks, m.word)),
                h('a', { class: 'src', href, target: '_blank' }, c.src === 'yt' && c.t != null ? `▶ ${clock(c.t)}` : shortSource(c.url)),
              );
            }),
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
