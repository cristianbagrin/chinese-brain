import { numberedToMarked } from '../shared/pinyin.ts';
import type { Context, Entry, LookupMatch, Status } from '../shared/types.ts';
import css from './popup.css';
import { state } from './state.ts';

export const TOCFL_LABEL = ['', 'Novice 1', 'Novice 2', 'A1', 'A2', 'B1', 'B2', 'C1'];
const STAMPS: { s: Status; zh: string; key: string; label: string }[] = [
  { s: 'fresh', zh: '新', key: '1', label: 'Fresh' },
  { s: 'difficult', zh: '難', key: '2', label: 'Difficult' },
  { s: 'known', zh: '熟', key: '3', label: 'Known' },
];

export function freqLabel(zipf: number): string {
  if (zipf >= 55) return 'very common';
  if (zipf >= 45) return 'common';
  if (zipf >= 35) return 'uncommon';
  if (zipf > 0) return 'rare';
  return '';
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

export interface ShowOptions {
  matches: LookupMatch[];
  rect: DOMRect;
  ctx?: Context;
  src: 'yt' | 'web';
  /** Keep the popup open until closed explicitly. */
  pinned?: boolean;
  /** Prefer placing the card above the anchor (subtitles sit at the bottom). */
  above?: boolean;
}

/** The one lookup card, used by hover lookup and the YouTube subtitles. */
export class Popup {
  private host: H;
  private root: ShadowRoot;
  private card: H;
  private opts: ShowOptions | undefined;
  private sel = 0;
  private shownAt = 0;
  private lookTimer: ReturnType<typeof setTimeout> | undefined;
  private softTimer: ReturnType<typeof setTimeout> | undefined;
  private hovered = false;
  private hideListeners = new Set<() => void>();

  constructor() {
    this.host = document.createElement('chinese-brain-popup');
    this.root = this.host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = css;
    this.card = h('div', { class: 'card', hidden: '' });
    this.root.append(style, this.card);
    this.card.addEventListener('mousedown', (e) => e.stopPropagation());
    this.card.addEventListener('mouseenter', () => {
      this.hovered = true;
      clearTimeout(this.softTimer);
    });
    this.card.addEventListener('mouseleave', () => {
      this.hovered = false;
      if (!this.pinned) this.hideSoon();
    });
    state.onChange(() => this.opts && this.render());
    document.addEventListener('fullscreenchange', () => this.mount());
  }

  get visible() {
    return !!this.opts;
  }
  get pinned() {
    return !!this.opts?.pinned;
  }
  /** Milliseconds since the card was last shown. */
  age(): number {
    return Date.now() - this.shownAt;
  }
  get current(): LookupMatch | undefined {
    return this.opts?.matches[this.sel];
  }

  contains(node: EventTarget | null): boolean {
    return node === this.host;
  }

  private mount() {
    const parent = document.fullscreenElement ?? document.documentElement;
    if (this.host.parentNode !== parent) parent.append(this.host);
  }

  async show(opts: ShowOptions) {
    const same = this.opts?.matches[0]?.text === opts.matches[0]?.text && this.opts?.rect.x === opts.rect.x;
    this.opts = opts;
    clearTimeout(this.softTimer);
    if (!same) this.sel = 0;
    this.mount();
    await state.loadStatuses();
    if (this.opts !== opts) return; // a newer show() won
    this.render();
    this.position(opts.rect, opts.above);
    this.shownAt = Date.now();
    clearTimeout(this.lookTimer);
    // A popup left open for a moment counts as a deliberate lookup.
    this.lookTimer = setTimeout(() => this.recordLook(), opts.pinned ? 0 : 1200);
  }

  onHide(fn: () => void) {
    this.hideListeners.add(fn);
  }

  /** Hide after a short grace period, unless the pointer is on the card. */
  hideSoon(ms = 350) {
    if (!this.opts || this.pinned) return;
    clearTimeout(this.softTimer);
    this.softTimer = setTimeout(() => {
      if (!this.hovered && !this.pinned) this.hide();
    }, ms);
  }

  cancelHide() {
    clearTimeout(this.softTimer);
  }

  hide() {
    if (!this.opts) return;
    clearTimeout(this.lookTimer);
    clearTimeout(this.softTimer);
    this.opts = undefined;
    this.hovered = false;
    this.card.hidden = true;
    this.hideListeners.forEach((f) => f());
  }

  private recordLook() {
    const m = this.current;
    if (!m || !this.opts) return;
    browser.runtime.sendMessage({ type: 'looked', word: m.word, src: this.opts.src, url: this.opts.ctx?.url, ctx: this.opts.ctx });
  }

  setStatus(status: Status | null) {
    const m = this.current;
    if (!m || !this.opts) return;
    const cur = state.status(m.word);
    const next = cur === status ? null : status; // pressing the active stamp again clears it
    if (next) state.statuses.set(m.word, next);
    else state.statuses.delete(m.word);
    this.render();
    browser.runtime.sendMessage({ type: 'setStatus', word: m.word, status: next, entry: m.entries[0], ctx: this.opts.ctx });
  }

  speak() {
    const m = this.current;
    if (m) speak(m.word);
  }

  images() {
    const m = this.current;
    if (m) window.open(`https://duckduckgo.com/?q=${encodeURIComponent(m.word)}&iax=images&ia=images&kl=tw-tzh`, '_blank');
  }

  cycle(dir = 1) {
    if (!this.opts) return;
    const n = this.opts.matches.length;
    this.sel = (this.sel + dir + n) % n;
    this.render();
  }

  /** Keyboard shortcuts while the card is open. Returns true when handled. */
  handleKey(e: KeyboardEvent): boolean {
    if (!this.opts || e.ctrlKey || e.metaKey || e.altKey) return false;
    switch (e.key) {
      case '1':
        this.setStatus('fresh');
        return true;
      case '2':
        this.setStatus('difficult');
        return true;
      case '3':
        this.setStatus('known');
        return true;
      case '0':
      case 'Backspace':
        this.setStatus(null);
        return true;
      case 'v':
        this.speak();
        return true;
      case 'i':
        this.images();
        return true;
      case 'n':
        this.cycle(1);
        return true;
      case 'Escape':
        this.hide();
        return true;
    }
    return false;
  }

  private position(r: DOMRect, above = false) {
    const c = this.card;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = c.offsetWidth;
    const ht = c.offsetHeight;
    let x = Math.min(Math.max(8, r.left), vw - w - 8);
    let y = above ? r.top - ht - 10 : r.bottom + 8;
    if (above && y < 8) y = r.bottom + 8;
    if (!above && y + ht > vh - 8) y = Math.max(8, r.top - ht - 8);
    c.style.left = `${x}px`;
    c.style.top = `${y}px`;
  }

  private render() {
    const o = this.opts;
    if (!o) return;
    const m = o.matches[this.sel];
    if (!m) return;
    const status = state.status(m.word);
    const e0 = m.entries[0];
    const card = this.card;
    card.replaceChildren();

    if (o.matches.length > 1) {
      card.append(
        h(
          'div',
          { class: 'tabs', role: 'tablist' },
          ...o.matches.map((mm, i) => {
            const b = h('button', { role: 'tab', 'aria-selected': String(i === this.sel), title: 'n: next' }, mm.word);
            b.addEventListener('click', () => {
              this.sel = i;
              this.render();
            });
            return b;
          }),
        ),
      );
    }

    const zipf = Math.max(...m.entries.map((e) => e.zipf));
    const tocfl = m.entries.find((e) => e.tocfl)?.tocfl ?? 0;
    const twPy = numberedToMarked(e0.tw || e0.py);
    const stamps = h(
      'div',
      { class: 'stamps' },
      ...STAMPS.map((st) => {
        const b = h('button', { class: `stamp ${st.s}${status === st.s ? ' on' : ''}`, title: `${st.label} (${st.key})` }, st.zh, h('small', null, st.key));
        b.addEventListener('click', () => this.setStatus(st.s));
        return b;
      }),
    );
    card.append(
      h(
        'div',
        { class: 'stub' },
        h('div', { class: `head${status ? ' st-' + status : ''}` }, m.word, e0.simp !== e0.trad ? h('span', { class: 'simp' }, e0.simp) : null),
        stamps,
        h(
          'div',
          { class: 'meta' },
          h('span', { class: 'py' }, twPy),
          e0.tw ? h('span', { class: 'alt', title: 'Mainland reading (CC-CEDICT)' }, 'mainland ' + numberedToMarked(e0.py)) : null,
          tocfl ? h('span', { class: 'tag' }, 'TOCFL ' + TOCFL_LABEL[tocfl]) : null,
          freqLabel(zipf) ? h('span', null, freqLabel(zipf)) : null,
        ),
      ),
    );

    // Group senses by reading.
    const groups = new Map<string, Entry[]>();
    for (const e of m.entries) {
      const k = (e.tw || e.py).toLowerCase();
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(e);
    }
    const body = h('div', { class: 'body' });
    const many = groups.size > 1;
    for (const [reading, list] of groups) {
      const defs = [...new Set(list.flatMap((e) => e.defs))];
      const senses = defs.filter((d) => !d.startsWith('CL:'));
      const cls = defs.filter((d) => d.startsWith('CL:')).flatMap((d) => d.slice(3).split(','));
      body.append(
        h(
          'div',
          { class: 'reading' },
          many ? h('span', { class: 'py' }, numberedToMarked(reading)) : null,
          h('ol', null, ...senses.slice(0, 8).map((d) => h('li', null, prettyDef(d)))),
          cls.length
            ? h(
                'div',
                { class: 'cl' },
                'measure word ',
                ...cls.flatMap((c, i) => {
                  const mm = /^([^|\[]+)(?:\|[^\[]+)?\[([^\]]+)\]/.exec(c);
                  return mm ? [i ? ', ' : '', h('b', null, mm[1]), ' ' + numberedToMarked(mm[2])] : [];
                }),
              )
            : null,
        ),
      );
    }
    card.append(body);

    const speakBtn = h('button', null, 'say ', h('kbd', null, 'v'));
    speakBtn.addEventListener('click', () => this.speak());
    const imgBtn = h('button', null, 'images ', h('kbd', null, 'i'));
    imgBtn.addEventListener('click', () => this.images());
    card.append(h('div', { class: 'actions' }, speakBtn, imgBtn, h('span', { class: 'ctx' }, status ? '0 clears' : '1 2 3 to save')));
    card.hidden = false;
  }
}

let voice: SpeechSynthesisVoice | undefined;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  voice =
    voices.find((v) => v.lang === 'zh-TW' || v.lang === 'zh_TW') ??
    voices.find((v) => /taiwan|台灣|臺灣|meijia/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith('zh'));
}

export function speak(text: string, rate?: number) {
  if (!('speechSynthesis' in window)) return;
  if (!voice) pickVoice();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-TW';
  if (voice) u.voice = voice;
  u.rate = rate ?? state.settings.speechRate;
  speechSynthesis.speak(u);
}
if ('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
