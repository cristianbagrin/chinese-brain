import { CJK } from '../shared/dict.ts';
import { numberedToMarked } from '../shared/pinyin.ts';
import type { Token } from '../shared/types.ts';
import { lookupText } from '../content/hover.ts';
import type { Popup } from '../content/popup.ts';
import { state } from '../content/state.ts';
import { alignTranslation, cueAt, cueBefore, parseTimedText, pickChinese, pickTranslation, urlInfo, type Cue, type TrackInfo } from './captions.ts';
import css from './overlay.css';

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
  private bar: HTMLElement;
  private coverage: number | undefined;
  private flashTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(popup: Popup) {
    this.popup = popup;
    this.host = document.createElement('div');
    this.host.dataset.cbOwn = '';
    this.host.hidden = true;
    this.root = this.host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = css;
    const box = document.createElement('div');
    box.className = 'box';
    this.bar = document.createElement('div');
    this.bar.className = 'bar';
    this.zh = document.createElement('div');
    this.zh.className = 'zh';
    this.tr = document.createElement('div');
    this.tr.className = 'tr';
    box.append(this.bar, this.zh, this.tr);
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
    state.onChange(() => this.renderLine(true));
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
    this.tracks = [];
    this.src = undefined;
    this.cues = [];
    this.tokens = [];
    this.trans = [];
    this.trCues = undefined;
    this.idx = -2;
    this.requestedTr = false;
    this.coverage = undefined;
    this.loop = false;
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
    const want = state.settings.transLang;
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

  private async setSource(cues: Cue[]) {
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
      const want = state.settings.transLang;
      const manual = pickTranslation(this.tracks, want);
      setTimeout(() => {
        if (manual) this.setTrack(manual);
        else if (this.src?.isTranslatable !== false) this.setTrack(this.src!, want);
        // Put the player back on the Chinese track afterwards.
        setTimeout(() => this.src && this.setTrack(this.src), 2500);
      }, 300);
    }
  }

  private setTranslation(cues: Cue[]) {
    this.trCues = cues;
    if (this.cues.length) this.trans = alignTranslation(this.cues, cues);
    this.renderLine(true);
  }

  private computeCoverage() {
    let total = 0;
    let known = 0;
    for (const line of this.tokens)
      for (const t of line) {
        if (!t.word || !CJK.test(t.text)) continue;
        total++;
        if (state.status(t.word) === 'known') known++;
      }
    this.coverage = total ? known / total : undefined;
  }

  private mount() {
    const p = document.getElementById('movie_player');
    if (!p) return;
    if (this.host.parentNode !== p) p.append(this.host);
    this.host.hidden = false;
    document.documentElement.classList.add('cb-subs-on');
    browser.runtime.sendMessage({
      type: 'insertCSS',
      css: 'html.cb-subs-on .ytp-caption-window-container{display:none!important}',
    });
    this.resize();
    this.renderBar();
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
        const text = s.toTraditional && t.trad ? t.trad : t.text;
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
    this.renderBar();
  }

  private renderBar() {
    const s = state.settings;
    const src = this.src ? this.src.name || this.src.languageCode : 'zh';
    const item = (text: string, cls = '') => {
      const el = document.createElement(cls === 'b' ? 'b' : 'span');
      if (cls && cls !== 'b') el.className = cls;
      el.textContent = text;
      return el;
    };
    const parts: HTMLElement[] = [item(`${src}${this.trCues ? ' + ' + s.transLang : ''}`)];
    if (this.coverage != null) parts.push(item(`熟 ${Math.round(this.coverage * 100)}%`, 'b'));
    parts.push(item('A ◀ · S ↺ · D ▶'));
    parts.push(item('R loop', this.loop ? 'on' : ''));
    parts.push(item('Q shadow', this.shadow ? 'on' : ''));
    parts.push(item('P pinyin', s.subPinyin ? 'on' : ''));
    parts.push(item(`X ${s.translation}`));
    this.bar.replaceChildren(...parts.flatMap((p, i) => (i ? [' · ', p] : [p])));
    this.bar.title = 'Chinese Brain: 熟 = share of words in this video you marked Known';
  }

  private flash() {
    this.bar.classList.add('flash');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.bar.classList.remove('flash'), 1500);
  }

  private tokenAt(e: Event): { span: HTMLElement; tok: Token; line: number } | undefined {
    const span = (e.target as HTMLElement).closest?.('.tok') as HTMLElement | null;
    if (!span || this.idx < 0) return undefined;
    const tok = this.tokens[this.idx]?.[Number(span.dataset.k)];
    return tok ? { span, tok, line: this.idx } : undefined;
  }

  private showSeq = 0;

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
    await this.popup.show({ matches, rect: span.getBoundingClientRect(), src: 'yt', ctx, pinned });
    if (pinned && state.settings.autoFreshOnClick && !state.status(matches[0].word)) this.popup.setStatus('fresh');
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
    if (this.host.hidden || !this.cues.length || e.ctrlKey || e.metaKey || e.altKey) return;
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
        this.loop = !this.loop;
        break;
      case 'q':
        this.shadow = !this.shadow;
        this.shadowDone = -1;
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
      this.renderBar();
      this.flash();
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
