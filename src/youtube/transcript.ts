import { state } from '../content/state.ts';
import { CJK } from '../shared/dict.ts';
import { numberedToMarked } from '../shared/pinyin.ts';
import { clock } from '../shared/time.ts';
import type { Status } from '../shared/types.ts';
import type { YouTubeSubs } from './index.ts';
import css from './transcript.css';

declare const __TEST__: boolean;

function el(tag: string, cls?: string, ...kids: (Node | string | null | false | undefined)[]) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k) e.append(k);
  return e;
}

interface LearnRow {
  w: string;
  count: number;
  first: number;
  status: Status | undefined;
  py: string;
  g: string;
  zipf: number;
}

/**
 * Transcript and "learn first" list for the current video. Sits in YouTube's
 * right-hand column in the default view, and over the right side of the
 * player in theater mode and fullscreen.
 */
export class Transcript {
  private subs: YouTubeSubs;
  private host: HTMLElement;
  private root: ShadowRoot;
  private box: HTMLElement;
  private body: HTMLElement;
  private tabs: HTMLElement;
  open = false;
  private tab: 'lines' | 'learn' = 'lines';
  private lineEls: HTMLElement[] = [];
  private active = -1;
  private userScrollAt = 0;
  private glossCache = new Map<string, { py: string; g: string; zipf: number }>();

  constructor(subs: YouTubeSubs) {
    this.subs = subs;
    this.host = document.createElement('div');
    this.host.dataset.cbOwn = '';
    if (__TEST__) this.host.id = 'cb-transcript';
    this.root = this.host.attachShadow({ mode: __TEST__ ? 'open' : 'closed' });
    const style = document.createElement('style');
    style.textContent = css;
    this.tabs = el('div', 'tabs');
    this.body = el('div', 'body');
    const close = el('button', 'close', '×');
    close.title = 'Close (T)';
    close.addEventListener('click', () => this.toggle(false));
    this.box = el('div', 'box', el('div', 'top', this.tabs, close), this.body);
    this.root.append(style, this.box);
    for (const t of ['click', 'mousedown', 'mouseup', 'dblclick', 'pointerdown', 'pointerup', 'wheel']) {
      this.host.addEventListener(t, (e) => e.stopPropagation());
    }
    this.body.addEventListener('wheel', () => (this.userScrollAt = Date.now()), { passive: true });
    this.body.addEventListener('mouseover', (e) => {
      if ((e.target as HTMLElement).closest('.tok') && !this.subs.popupPinned) void this.subs.showFor(e, false);
    });
    this.body.addEventListener('mouseout', (e) => {
      if ((e.target as HTMLElement).closest('.tok')) this.subs.hideCardSoon();
    });
    this.body.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('fullscreenchange', () => this.place());
    state.onChange(() => this.open && this.render());
  }

  toggle(force?: boolean) {
    this.open = force ?? !this.open;
    if (this.open) {
      this.place();
      this.render();
    } else {
      this.host.remove();
      this.subs.setRightInset(0);
    }
  }

  /** Called when the cues, tokens or translation change. */
  refresh() {
    if (this.open) this.render();
  }

  /** Mount in YouTube's side column when it is visible, otherwise inside the player. */
  place() {
    if (!this.open) return;
    const flexy = document.querySelector('ytd-watch-flexy');
    const wide = !!document.fullscreenElement || flexy?.hasAttribute('theater') || flexy?.hasAttribute('fullscreen');
    const side = document.querySelector('#secondary-inner, #secondary') as HTMLElement | null;
    const player = document.getElementById('movie_player');
    const inSide = !wide && side && side.offsetWidth > 0;
    const parent = inSide ? side : player;
    if (!parent) return;
    this.host.classList.toggle('side', !!inSide);
    this.host.classList.toggle('over', !inSide);
    if (inSide) this.host.style.height = `${Math.max(360, player?.clientHeight ?? 480)}px`;
    else this.host.style.height = '';
    if (this.host.parentNode !== parent) (inSide ? parent.prepend(this.host) : parent.append(this.host));
    // Over the player, keep the subtitles clear of the panel.
    this.subs.setRightInset(inSide ? 0 : this.host.offsetWidth + 24);
  }

  /** Highlight the current line (and keep it in view unless the user is scrolling). */
  setActive(i: number) {
    if (!this.open || this.tab !== 'lines' || i === this.active) return;
    this.lineEls[this.active]?.classList.remove('now');
    this.active = i;
    const elx = this.lineEls[i];
    if (!elx) return;
    elx.classList.add('now');
    if (Date.now() - this.userScrollAt > 4000) {
      const b = this.body;
      const top = elx.offsetTop - b.clientHeight / 3;
      b.scrollTo({ top, behavior: 'smooth' });
    }
  }

  private render() {
    this.place();
    const tab = (id: 'lines' | 'learn', label: string) => {
      const b = el('button', id === this.tab ? 'on' : '', label);
      b.addEventListener('click', () => {
        this.tab = id;
        this.render();
      });
      return b;
    };
    this.tabs.replaceChildren(tab('lines', 'Transcript'), tab('learn', 'Learn first'));
    if (this.tab === 'lines') this.renderLines();
    else void this.renderLearn();
  }

  private renderLines() {
    const { cues, tokens, trans } = this.subs.data();
    const s = state.settings;
    this.lineEls = cues.map((c, i) => {
      const zh = el('div', 'zh');
      (tokens[i] ?? []).forEach((t, k) => {
        const text = t.trad ?? t.text;
        if (!t.word && !CJK.test(t.text)) return zh.append(text);
        const span = el('span', 'tok', text);
        span.dataset.k = String(k);
        span.dataset.line = String(i);
        const st = state.status(t.word);
        if (st) span.classList.add('st-' + st);
        zh.append(span);
      });
      const en = s.translation !== 'hide' && trans[i] ? el('div', `en${s.translation === 'blur' ? ' blur' : ''}`, trans[i]) : null;
      const line = el('div', 'line', el('button', 'time', clock(c.start)), el('div', 'txt', zh, en));
      line.dataset.i = String(i);
      return line;
    });
    this.body.replaceChildren(...this.lineEls);
    const cur = this.active;
    this.active = -1;
    this.setActive(cur >= 0 ? cur : this.subs.currentLine());
  }

  private async renderLearn() {
    const { cues, tokens } = this.subs.data();
    const rows = new Map<string, LearnRow>();
    let total = 0;
    let known = 0;
    tokens.forEach((line, i) =>
      line.forEach((t) => {
        if (!t.word || !CJK.test(t.text)) return;
        total++;
        const st = state.status(t.word);
        if (st === 'known') return known++;
        const r = rows.get(t.word);
        if (r) r.count++;
        else rows.set(t.word, { w: t.word, count: 1, first: i, status: st, py: t.py ?? '', g: '', zipf: 0 });
      }),
    );
    const missing = [...rows.keys()].filter((w) => !this.glossCache.has(w));
    if (missing.length) {
      const res: Record<string, { py: string; g: string; zipf: number }> = await browser.runtime.sendMessage({ type: 'glosses', words: missing });
      for (const [w, v] of Object.entries(res)) this.glossCache.set(w, v);
    }
    // The video (or tab) may have changed while we waited.
    if (this.tab !== 'learn' || this.subs.data().tokens !== tokens) return;
    for (const r of rows.values()) {
      const g = this.glossCache.get(r.w);
      if (g) Object.assign(r, { g: g.g, zipf: g.zipf, py: r.py || g.py });
    }
    // Most useful first: how often it comes up here, weighted by how common it is in general.
    const score = (r: LearnRow) => r.count * (1 + Math.max(0, r.zipf - 30) / 10);
    const list = [...rows.values()].filter((r) => r.g).sort((a, b) => score(b) - score(a)).slice(0, 40);
    let gained = known;
    const top = list.slice(0, 15);
    for (const r of top) gained += r.count;
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

    const head = el(
      'div',
      'learnhead',
      total ? `You know ${pct(known)}% of the words here. Learn the top ${top.length} below and that becomes ${pct(gained)}%.` : 'No words yet.',
    );
    const items = list.map((r) => {
      const stamps = el('span', 'stamps');
      for (const [s, zh] of [
        ['fresh', '新'],
        ['learning', '學'],
        ['known', '熟'],
      ] as [Status, string][]) {
        const b = el('button', `stamp ${s}${r.status === s ? ' on' : ''}`, zh);
        b.title = s;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          browser.runtime.sendMessage({ type: 'setStatus', word: r.w, status: r.status === s ? null : s });
        });
        stamps.append(b);
      }
      const row = el(
        'div',
        `learn${r.status ? ' st-' + r.status : ''}`,
        el('span', 'lw', r.w),
        el('span', 'lpy', numberedToMarked(r.py)),
        el('span', 'lg', r.g),
        el('span', 'lc', `×${r.count}`),
        stamps,
      );
      row.title = `First heard at ${clock(cues[r.first]?.start ?? 0)}: click to jump there`;
      row.dataset.seek = String(r.first);
      return row;
    });
    this.body.replaceChildren(head, ...items);
  }

  private onClick(e: Event) {
    const t = e.target as HTMLElement;
    if (t.closest('.tok')) {
      void this.subs.showFor(e, true);
      return;
    }
    const line = t.closest('.line') as HTMLElement | null;
    if (line) return this.subs.seekTo(Number(line.dataset.i));
    const learn = t.closest('.learn') as HTMLElement | null;
    if (learn) this.subs.seekTo(Number(learn.dataset.seek));
  }
}
