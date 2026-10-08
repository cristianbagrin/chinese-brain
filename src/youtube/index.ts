import { CJK } from '../shared/dict.ts';
import { numberedToMarked } from '../shared/pinyin.ts';
import { TRANS_LANG, type Status, type Token } from '../shared/types.ts';
import { lookupText } from '../content/hover.ts';
import type { Popup } from '../content/popup.ts';
import { state } from '../content/state.ts';
import { alignTranslation, cueAt, cueBefore, parseTimedText, pickChinese, pickTranslation, urlInfo, type Cue, type TrackInfo } from './captions.ts';
import { Controls } from './controls.ts';
import css from './overlay.css';

declare const __TEST__: boolean;
declare function cloneInto<T>(obj: T, target: object, opts?: { cloneFunctions?: boolean }): T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Player = any;

const TRANSLATION_MODES = ['show', 'blur', 'hide'] as const;

/** Dual subtitles on youtube.com/watch, built from the caption tracks the player downloads. */
export class YouTubeSubs {
  private popup: Popup;
  private videoId = '';
  private tracks: TrackInfo[] = [];
  private src: TrackInfo | undefined;
  private cues: Cue[] = [];
  private tokens: Token[][] = [];
  private trans: string[] = [];
  private trCues: Cue[] | undefined;
  private idx = -2;
  private loop = false;
  private shadow = false;
  private shadowDone = -1;
  private pausedByUs = false;
  private requestedTr = false;
  private watchSecs = 0;
  private lastTick = 0;
  private host: HTMLElement;
  private root: ShadowRoot;
  private zh: HTMLElement;
  private tr: HTMLElement;
  private controls: Controls;
  /** Share of this video's words (running count) per status; 'new' = not in the list. */
  counts: Record<Status | 'new', number> = { fresh: 0, learning: 0, known: 0, new: 0 };
  private fallbackTimer: ReturnType<typeof setTimeout> | undefined;
  private domObserver: MutationObserver | undefined;
  /** True when mirroring YouTube's on-screen captions (no track was captured). */
  private live = false;

  constructor(popup: Popup) {
    this.popup = popup;
    this.host = document.createElement('div');
    this.host.dataset.cbOwn = '';
    this.host.hidden = true;
    this.root = this.host.attachShadow({ mode: __TEST__ ? 'open' : 'closed' });
    if (__TEST__) this.host.id = 'cb-subs';
    const style = document.createElement('style');
    style.textContent = css;
    const box = document.createElement('div');
    box.className = 'box';
    this.zh = document.createElement('div');
    this.zh.className = 'zh';
    this.tr = document.createElement('div');
    this.tr.className = 'tr';
    box.append(this.zh, this.tr);
    this.root.append(style, box);

    // Keep clicks away from the player (which would pause or go fullscreen).
    for (const t of ['click', 'mousedown', 'mouseup', 'dblclick', 'pointerdown', 'pointerup', 'touchstart']) {
      this.host.addEventListener(t, (e) => e.stopPropagation());
    }
    box.addEventListener('mouseenter', () => this.hoverPause(true));
    box.addEventListener('mouseleave', () => this.hoverPause(false));
    this.zh.addEventListener('mouseover', (e) => this.onTokenHover(e));
    this.zh.addEventListener('mouseout', () => this.popup.hideSoon());
    this.zh.addEventListener('click', (e) => this.onTokenClick(e));
    this.popup.onHide(() => this.maybeResume());

    browser.runtime.onMessage.addListener((msg: { type: string; url?: string; body?: string }) => {
      if (msg.type === 'ytCaptions' && msg.url && msg.body) this.onBody(msg.url, msg.body);
    });
    this.controls = new Controls(this);
    state.onChange(() => {
      this.applyEnabled();
      this.renderLine(true);
    });
    window.addEventListener('keydown', (e) => this.onKey(e), true);
    document.addEventListener('yt-navigate-finish', () => this.checkVideo());
    window.addEventListener('pagehide', () => this.flushWatch());
    setInterval(() => this.checkVideo(), 1000);
    new ResizeObserver(() => this.resize()).observe(document.documentElement);
    this.checkVideo();
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  private player(): Player | undefined {
    const el = document.getElementById('movie_player') as (HTMLElement & { wrappedJSObject?: Player }) | null;
    return el?.wrappedJSObject ?? el ?? undefined;
  }

  private video(): HTMLVideoElement | null {
    return document.querySelector('#movie_player video');
  }

  private currentId(): string {
    if (location.pathname !== '/watch') return '';
    return new URLSearchParams(location.search).get('v') ?? '';
  }

  private checkVideo() {
    const id = this.currentId();
    if (id === this.videoId) {
      if (id && !this.src) this.findTracks();
      if (id && this.cues.length) this.controls.mount();
      return;
    }
    this.flushWatch();
    this.videoId = id;
    this.reset();
    if (id) {
      state.loadStatuses();
      this.findTracks();
      // Captions may have been fetched before this script was ready.
      browser.runtime.sendMessage({ type: 'ytCached' }).then((list: { url: string; body: string }[]) => {
        for (const item of list) this.onBody(item.url, item.body);
      });
    }
  }

  private reset() {
    clearTimeout(this.fallbackTimer);
    this.domObserver?.disconnect();
    this.domObserver = undefined;
    this.live = false;
    this.tracks = [];
    this.src = undefined;
    this.cues = [];
    this.tokens = [];
    this.trans = [];
    this.trCues = undefined;
    this.idx = -2;
    this.requestedTr = false;
    this.counts = { fresh: 0, learning: 0, known: 0, new: 0 };
    this.loop = false;
    this.shadow = false;
    this.host.hidden = true;
    document.documentElement.classList.remove('cb-subs-on');
  }

  private findTracks() {
    const p = this.player();
    if (!p?.getPlayerResponse) return;
    let resp;
    try {
      resp = p.getPlayerResponse();
    } catch {
      return;
    }
    if (!resp || resp.videoDetails?.videoId !== this.videoId) return;
    const list = resp.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    this.tracks = [...list].map((t: Record<string, unknown>) => ({
      languageCode: String(t.languageCode),
      kind: t.kind ? String(t.kind) : undefined,
      name: String((t.name as { simpleText?: string })?.simpleText ?? (t.name as { runs?: { text: string }[] })?.runs?.[0]?.text ?? t.languageCode),
      vssId: t.vssId ? String(t.vssId) : undefined,
      isTranslatable: !!t.isTranslatable,
    }));
    const zh = pickChinese(this.tracks);
    if (!zh) return;
    this.src = zh;
    this.setTrack(zh);
    const id = this.videoId;
    clearTimeout(this.fallbackTimer);
    this.fallbackTimer = setTimeout(() => {
      if (!this.cues.length && this.videoId === id) this.startDomFallback();
    }, 6000);
  }

  /** Ask the player to show a track; it downloads it and we capture the body. */
  private setTrack(track: TrackInfo, tlang?: string) {
    const p = this.player();
    if (!p) return;
    try {
      p.loadModule?.('captions');
      const list: Record<string, unknown>[] = p.getOption?.('captions', 'tracklist') ?? [];
      const native = [...list].find((t) => t.languageCode === track.languageCode && (t.kind ?? '') === (track.kind ?? ''));
      const obj: Record<string, unknown> = native ? { ...native } : { languageCode: track.languageCode, kind: track.kind ?? '' };
      if (tlang) obj.translationLanguage = { languageCode: tlang, languageName: tlang };
      p.setOption('captions', 'track', typeof cloneInto === 'function' ? cloneInto(obj, window) : obj);
    } catch (e) {
      console.warn('[chinese-brain] setTrack', e);
    }
  }

  private async onBody(url: string, body: string) {
    const info = urlInfo(url);
    if (info.v && info.v !== this.videoId) return;
    let cues: Cue[];
    try {
      cues = parseTimedText(body);
    } catch {
      return;
    }
    if (!cues.length) return;
    const want = TRANS_LANG;
    const isZh = /^zh/i.test(info.lang);
    if (info.tlang) {
      if (info.tlang.split('-')[0] === want) this.setTranslation(cues);
      return;
    }
    if (isZh) {
      if (this.src && this.src.languageCode !== info.lang && this.cues.length) return;
      if (sameCues(cues, this.cues)) return;
      if (!this.src) this.src = { languageCode: info.lang, kind: info.kind || undefined, name: info.lang };
      await this.setSource(cues);
      return;
    }
    if (info.lang.split('-')[0] === want) this.setTranslation(cues);
  }

  /**
   * Fallback when no caption download was captured: read the text YouTube
   * renders on screen and show it as a single live line (no timing, no
   * second line). Keeps lookup and colouring working.
   */
  private startDomFallback() {
    const p = document.getElementById('movie_player');
    if (!p) return;
    this.live = true;
    let last = '';
    const read = async () => {
      const text = [...p.querySelectorAll('.ytp-caption-segment')]
        .map((s) => s.textContent ?? '')
        .join(' ')
        .trim();
      if (text === last || !this.live) return;
      last = text;
      if (!CJK.test(text)) return;
      const [toks]: Token[][] = await browser.runtime.sendMessage({ type: 'segment', lines: [text] });
      this.cues = [{ start: 0, end: Number.MAX_SAFE_INTEGER, text }];
      this.tokens = [toks];
      this.trans = [];
      this.idx = -2;
      this.mount();
    };
    this.domObserver = new MutationObserver(() => void read());
    this.domObserver.observe(p, { subtree: true, childList: true, characterData: true });
    read();
  }

  private async setSource(cues: Cue[]) {
    if (this.live) {
      this.live = false;
      this.domObserver?.disconnect();
    }
    this.cues = cues;
    this.idx = -2;
    const lines = cues.map((c) => c.text);
    this.tokens = await browser.runtime.sendMessage({ type: 'segment', lines });
    if (this.trCues) this.trans = alignTranslation(this.cues, this.trCues);
    this.computeCoverage();
    this.mount();
    // Then fetch the second line: a real English track if there is one, else YouTube's auto-translation.
    if (!this.requestedTr && !this.trCues && this.src) {
      this.requestedTr = true;
      const want = TRANS_LANG;
      const manual = pickTranslation(this.tracks, want);
      setTimeout(() => {
        if (manual) this.setTrack(manual);
        else if (this.src?.isTranslatable !== false) this.setTrack(this.src!, want);
        // Put the player back on the Chinese track afterwards.
        setTimeout(() => this.src && this.setTrack(this.src), 2500);
      }, 300);
      // No usable second line from YouTube (it sometimes answers 429): translate the lines ourselves.
      const id = this.videoId;
      setTimeout(() => {
        if (this.trCues || this.videoId !== id || !this.cues.length || this.live) return;
        this.translateFallback();
      }, 6000);
    }
  }

  private async translateFallback() {
    const id = this.videoId;
    const lines = this.cues.map((c) => c.text);
    const res: string[] | null = await browser.runtime.sendMessage({
      type: 'translate',
      lines,
      sl: this.src?.languageCode ?? 'zh-TW',
      tl: TRANS_LANG,
    });
    if (!res || this.videoId !== id || this.trCues) return;
    this.trCues = this.cues.map((c, i) => ({ ...c, text: res[i] ?? '' }));
    this.trans = res;
    this.renderLine(true);
  }

  private setTranslation(cues: Cue[]) {
    this.trCues = cues;
    if (this.cues.length) this.trans = alignTranslation(this.cues, cues);
    this.renderLine(true);
  }

  private computeCoverage() {
    const c = { fresh: 0, learning: 0, known: 0, new: 0 };
    for (const line of this.tokens)
      for (const t of line) {
        if (!t.word || !CJK.test(t.text)) continue;
        c[state.status(t.word) ?? 'new']++;
      }
    this.counts = c;
  }

  /** Known share of the running words, 0..1 (undefined without captions). */
  get coverage(): number | undefined {
    const c = this.counts;
    const total = c.fresh + c.learning + c.known + c.new;
    return total ? c.known / total : undefined;
  }

  get hasSubs() {
    return this.cues.length > 0;
  }
  get trackName() {
    return this.src ? this.src.name || this.src.languageCode : '';
  }
  get hasTranslation() {
    return !!this.trCues;
  }
  get looping() {
    return this.loop;
  }
  get shadowing() {
    return this.shadow;
  }

  toggleLoop() {
    this.loop = !this.loop;
    this.controls.render();
  }
  toggleShadow() {
    this.shadow = !this.shadow;
    this.shadowDone = -1;
    this.controls.render();
  }

  /** The player switch: our subtitles on or off (YouTube's own come back when off). */
  private applyEnabled() {
    const on = state.settings.ytEnabled && this.cues.length > 0;
    this.host.hidden = !on;
    document.documentElement.classList.toggle('cb-subs-on', on);
    if (!on) this.popup.hide();
  }

  private mount() {
    const p = document.getElementById('movie_player');
    if (!p) return;
    if (this.host.parentNode !== p) p.append(this.host);
    this.applyEnabled();
    this.controls.mount();
    browser.runtime.sendMessage({
      type: 'insertCSS',
      css: 'html.cb-subs-on .ytp-caption-window-container{display:none!important}',
    });
    this.resize();
  }

  private resize() {
    const p = document.getElementById('movie_player');
    if (!p) return;
    const h = p.clientHeight || 480;
    const fs = Math.max(14, Math.min(60, (state.settings.subFontSize * h) / 720));
    this.host.style.setProperty('--fs', `${fs}px`);
  }

  private tick(now: number) {
    requestAnimationFrame(this.tick);
    if (!this.cues.length || this.host.hidden) return;
    const v = this.video();
    if (this.live && v) {
      if (this.idx !== 0) {
        this.idx = 0;
        this.renderLine();
      }
      return;
    }
    if (!v) return;
    const t = v.currentTime;
    const dt = this.lastTick ? (now - this.lastTick) / 1000 : 0;
    this.lastTick = now;
    if (!v.paused && dt < 1) this.watchSecs += dt;

    const p = this.host.parentElement;
    this.host.classList.toggle('low', !!p?.classList.contains('ytp-autohide'));

    const cur = this.idx >= 0 ? this.cues[this.idx] : undefined;
    if (cur && t >= cur.end - 0.05 && t < cur.end + 0.5) {
      if (this.loop) {
        v.currentTime = cur.start;
        return;
      }
      if (this.shadow && this.shadowDone !== this.idx && !v.paused) {
        this.shadowDone = this.idx;
        v.pause();
        const wait = Math.max(1.5, (cur.end - cur.start) * state.settings.shadowFactor);
        setTimeout(() => {
          if (this.shadow && v.paused) v.play();
        }, wait * 1000);
        return;
      }
    }
    // Keep the line on screen while looping/shadowing pauses.
    const i = cueAt(this.cues, t);
    if (i !== this.idx && !(i < 0 && v.paused && this.idx >= 0)) {
      this.idx = i;
      this.renderLine();
    }
  }

  private renderLine(force = false) {
    if (force) this.computeCoverage();
    const i = this.idx;
    const toks = i >= 0 ? this.tokens[i] : undefined;
    const s = state.settings;
    this.zh.replaceChildren();
    if (toks) {
      toks.forEach((t, k) => {
        const text = t.trad ?? t.text;
        if (!t.word && !CJK.test(t.text)) {
          this.zh.append(text);
          return;
        }
        const span = document.createElement('span');
        span.className = 'tok';
        span.dataset.k = String(k);
        const st = state.status(t.word);
        if (st) span.classList.add('st-' + st);
        else if (s.markUntracked && t.word) span.classList.add('untracked');
        if (s.subPinyin && t.py) {
          const ruby = document.createElement('ruby');
          ruby.append(text);
          const rt = document.createElement('rt');
          rt.textContent = numberedToMarked(t.py);
          ruby.append(rt);
          span.append(ruby);
        } else span.textContent = text;
        this.zh.append(span);
      });
    }
    const tr = i >= 0 ? this.trans[i] ?? '' : '';
    this.tr.textContent = s.translation === 'hide' ? '' : tr;
    this.tr.classList.toggle('blur', s.translation === 'blur');
    this.resize();
    this.controls.render();
  }

  private tokenAt(e: Event): { span: HTMLElement; tok: Token; line: number } | undefined {
    const span = (e.target as HTMLElement).closest?.('.tok') as HTMLElement | null;
    if (!span || this.idx < 0) return undefined;
    const tok = this.tokens[this.idx]?.[Number(span.dataset.k)];
    return tok ? { span, tok, line: this.idx } : undefined;
  }

  private showSeq = 0;
  private lastClicked = '';

  private async showFor(e: Event, pinned: boolean) {
    const seq = ++this.showSeq;
    const hit = this.tokenAt(e);
    if (!hit) return;
    const { span, tok, line } = hit;
    // Look up from this token onward so longer words still show as tabs.
    const rest = this.tokens[line].slice(Number(span.dataset.k)).map((t) => t.text).join('');
    let matches = await lookupText(rest);
    if (seq !== this.showSeq) return;
    // Put the segmenter's choice first.
    const own = matches.findIndex((m) => m.text === tok.text);
    if (own > 0) matches = [matches[own], ...matches.filter((_, i) => i !== own)];
    if (!matches.length) return;
    this.zh.querySelectorAll('.tok.active').forEach((el) => el.classList.remove('active'));
    span.classList.add('active');
    const cue = this.cues[line];
    const ctx = {
      text: cue.text + (this.trans[line] ? ` — ${this.trans[line]}` : ''),
      url: location.href.split('&')[0],
      title: document.title.replace(/ - YouTube$/, ''),
      t: Math.floor(cue.start),
      at: Date.now(),
      src: 'yt' as const,
    };
    const cursor = e instanceof MouseEvent ? { x: e.clientX, y: e.clientY } : undefined;
    await this.popup.show({ matches, rect: span.getBoundingClientRect(), cursor, src: 'yt', ctx, pinned });
    if (pinned && state.settings.autoFreshOnClick) {
      // Click a new word: Fresh. Click it again: back to untracked.
      const st = state.status(matches[0].word);
      if (!st) this.popup.setStatus('fresh', false);
      else if (st === 'fresh' && this.lastClicked === matches[0].word) this.popup.setStatus(null, false);
    }
    if (pinned) this.lastClicked = matches[0].word;
  }

  private onTokenHover(e: Event) {
    if (this.popup.pinned) return;
    this.showFor(e, false);
  }

  private onTokenClick(e: Event) {
    this.showFor(e, true);
  }

  private hoverPause(enter: boolean) {
    const v = this.video();
    if (!v || !state.settings.pauseOnHover) return;
    if (enter) {
      if (!v.paused) {
        v.pause();
        this.pausedByUs = true;
      }
    } else {
      setTimeout(() => this.maybeResume(), 250);
    }
  }

  private maybeResume() {
    const v = this.video();
    if (!v || !this.pausedByUs) return;
    if (this.popup.visible) return; // reading the card; resume when it closes
    const overBox = this.root.querySelector('.box:hover');
    if (overBox) return;
    this.pausedByUs = false;
    v.play();
  }

  private seekLine(delta: number) {
    const v = this.video();
    if (!v || !this.cues.length) return;
    const base = this.idx >= 0 ? this.idx : cueBefore(this.cues, v.currentTime);
    const j = Math.max(0, Math.min(this.cues.length - 1, base + delta));
    v.currentTime = this.cues[j].start + 0.01;
    this.shadowDone = -1;
    if (delta === 0 && v.paused) v.play();
  }

  private onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (this.popup.visible && this.popup.handleKey(e)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (!state.settings.ytEnabled || !this.cues.length || this.live || e.ctrlKey || e.metaKey || e.altKey) return;
    const s = state.settings;
    let handled = true;
    switch (e.key.toLowerCase()) {
      case 'a':
        this.seekLine(-1);
        break;
      case 's':
        this.seekLine(0);
        break;
      case 'd':
        this.seekLine(1);
        break;
      case 'r':
        this.toggleLoop();
        break;
      case 'q':
        this.toggleShadow();
        break;
      case 'p':
        browser.runtime.sendMessage({ type: 'saveSettings', settings: { subPinyin: !s.subPinyin } });
        break;
      case 'x': {
        const next = TRANSLATION_MODES[(TRANSLATION_MODES.indexOf(s.translation) + 1) % 3];
        browser.runtime.sendMessage({ type: 'saveSettings', settings: { translation: next } });
        break;
      }
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.controls.flash(e.key.toLowerCase());
    }
  }

  private flushWatch() {
    if (this.watchSecs > 30 && this.videoId) {
      browser.runtime.sendMessage({
        type: 'watch',
        url: `https://www.youtube.com/watch?v=${this.videoId}`,
        title: document.title.replace(/ - YouTube$/, ''),
        secs: Math.round(this.watchSecs),
        coverage: this.coverage,
        lang: this.src?.languageCode,
      });
    }
    this.watchSecs = 0;
  }
}

function sameCues(a: Cue[], b: Cue[]) {
  return a.length === b.length && a[0]?.text === b[0]?.text && a[a.length - 1]?.text === b[b.length - 1]?.text;
}
