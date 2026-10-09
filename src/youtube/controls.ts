import { state } from '../content/state.ts';
import type { Status } from '../shared/types.ts';
import type { YouTubeSubs } from './index.ts';
import css from './controls.css';

declare const __TEST__: boolean;

const MODES = ['show', 'blur', 'hide'] as const;
const TOAST: Record<string, (s: YouTubeSubs) => string> = {
  a: () => '◀ previous line',
  s: () => '↺ replay line',
  d: () => 'next line ▶',
  r: (s) => (s.looping ? '↻ looping this line' : 'loop off'),
  q: (s) => (s.shadowing ? 'shadowing on: pause after each line' : 'shadowing off'),
  p: () => (state.settings.pinyin ? 'pinyin on' : 'pinyin off'),
  e: (s) => (s.transcript.open ? 'transcript open' : 'transcript closed'),
  x: () => `English: ${state.settings.translation === 'show' ? 'shown' : state.settings.translation === 'blur' ? 'blurred until hover' : 'hidden'}`,
};

function el(tag: string, cls?: string, ...kids: (Node | string | null | false | undefined)[]) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k) e.append(k);
  return e;
}

/**
 * The on/off switch in YouTube's control bar, the panel that opens when you
 * hover it (coverage, toggles, keys), and a small toast for key presses.
 */
export class Controls {
  private subs: YouTubeSubs;
  private switchHost: HTMLElement;
  private switchRoot: ShadowRoot;
  private panelHost: HTMLElement;
  private panelRoot: ShadowRoot;
  private panel: HTMLElement;
  private toast: HTMLElement;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private lastKey = '';

  constructor(subs: YouTubeSubs) {
    this.subs = subs;
    const mode = __TEST__ ? 'open' : 'closed';

    this.switchHost = document.createElement('span');
    this.switchHost.dataset.cbOwn = '';
    if (__TEST__) this.switchHost.id = 'cb-switch';
    this.switchRoot = this.switchHost.attachShadow({ mode });
    const s1 = document.createElement('style');
    s1.textContent = css;
    const btn = el('button', 'switch', el('span', 'zh', '中'), el('span', 'track', el('span', 'knob')));
    btn.setAttribute('aria-label', 'Chinese Brain subtitles');
    this.switchRoot.append(s1, btn);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      browser.runtime.sendMessage({ type: 'saveSettings', settings: { ytEnabled: !state.settings.ytEnabled } });
    });

    this.panelHost = document.createElement('div');
    this.panelHost.dataset.cbOwn = '';
    if (__TEST__) this.panelHost.id = 'cb-panel';
    this.panelRoot = this.panelHost.attachShadow({ mode });
    const s2 = document.createElement('style');
    s2.textContent = css;
    this.panel = el('div', 'panel');
    this.panel.hidden = true;
    this.toast = el('div', 'toast');
    this.toast.hidden = true;
    this.panelRoot.append(s2, this.panel, this.toast);

    for (const t of ['click', 'mousedown', 'mouseup', 'dblclick', 'pointerdown', 'pointerup']) {
      this.switchHost.addEventListener(t, (e) => e.stopPropagation());
      this.panelHost.addEventListener(t, (e) => e.stopPropagation());
    }
    const enter = () => {
      clearTimeout(this.hideTimer);
      this.panel.hidden = false;
      this.render();
    };
    const leave = () => {
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => {
        this.panel.hidden = true;
        this.lastKey = '';
      }, 280);
    };
    this.switchHost.addEventListener('mouseenter', enter);
    this.switchHost.addEventListener('mouseleave', leave);
    this.panel.addEventListener('mouseenter', enter);
    this.panel.addEventListener('mouseleave', leave);
  }

  /** (Re)insert into the player; YouTube sometimes rebuilds its control bar. */
  mount() {
    const player = document.getElementById('movie_player');
    // Newer player layouts split the right-hand controls in two; older ones have one group.
    const right = player?.querySelector('.ytp-right-controls-left') ?? player?.querySelector('.ytp-right-controls');
    if (right && this.switchHost.parentNode !== right) right.prepend(this.switchHost);
    if (player && this.panelHost.parentNode !== player) player.append(this.panelHost);
    this.render();
  }

  render() {
    const s = state.settings;
    this.switchHost.hidden = !this.subs.videoActive;
    this.switchRoot.querySelector('.switch')?.classList.toggle('on', s.ytEnabled);
    if (this.panel.hidden) return;
    // Rebuild only when something shown changed (a rebuild mid-click would swallow the click).
    const key = JSON.stringify([s, this.subs.counts, this.subs.looping, this.subs.shadowing, this.subs.trackName, this.subs.hasTranslation, this.subs.transcript.open, this.subs.gemini]);
    if (key === this.lastKey) return;
    this.lastKey = key;

    const c = this.subs.counts;
    const total = c.known + c.learning + c.fresh + c.new;
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
    const seg = (k: Status | 'new', label: string) => {
      const b = el('i', `seg ${k}`);
      b.style.flexGrow = String(c[k]);
      b.title = `${label}: ${pct(c[k])}%`;
      return b;
    };
    const chip = (label: string, key: string, on: boolean, act: () => void) => {
      const b = el('button', `chip${on ? ' on' : ''}`, label, el('kbd', '', key));
      b.addEventListener('click', () => {
        act();
        setTimeout(() => this.render(), 50);
      });
      return b;
    };
    const save = (settings: Record<string, unknown>) => browser.runtime.sendMessage({ type: 'saveSettings', settings });

    this.panel.replaceChildren(
      el(
        'div',
        'head',
        el('span', 'title', '中文腦'),
        el('span', 'state', s.ytEnabled ? 'subtitles on' : 'subtitles off · click the switch'),
      ),
      total
        ? el(
            'div',
            'cov',
            el('div', 'big', el('b', '', `${pct(c.known)}%`), ' of the words in this video are 熟 known'),
            el('div', 'bar', seg('known', '熟 known'), seg('learning', '學 learning'), seg('fresh', '新 fresh'), seg('new', 'not in your list')),
            el(
              'div',
              'legend',
              el('span', 'k', `熟 ${pct(c.known)}%`),
              el('span', 'l', `學 ${pct(c.learning)}%`),
              el('span', 'f', `新 ${pct(c.fresh)}%`),
              el('span', 'n', `new ${pct(c.new)}%`),
            ),
          )
        : this.noCaptions(),
      (total && this.geminiStatus()) || "",
      this.subs.trackName ? el('div', 'track', this.subs.trackName, this.subs.hasTranslation ? ' + English' : '') : '',
      el(
        'div',
        'chips',
        chip('Pinyin', 'P', s.pinyin, () => save({ pinyin: !s.pinyin })),
        chip(`English: ${{ show: 'shown', blur: 'blurred', hide: 'hidden' }[s.translation]}`, 'X', s.translation !== 'hide', () => save({ translation: MODES[(MODES.indexOf(s.translation) + 1) % 3] })),
        chip('Loop line', 'R', this.subs.looping, () => this.subs.toggleLoop()),
        chip('Shadowing', 'Q', this.subs.shadowing, () => this.subs.toggleShadow()),
        chip('Pause on hover', '', s.pauseOnHover, () => save({ pauseOnHover: !s.pauseOnHover })),
        chip('Transcript', 'E', this.subs.transcript.open, () => this.subs.transcript.toggle()),
      ),
      el('div', 'keys', 'A ◀ previous line · S replay · D next line ▶'),
    );
  }

  /** No Chinese track: offer the opt-in Gemini transcript. */
  private noCaptions() {
    const g = this.subs.gemini;
    const box = el('div', 'cov', el('div', '', 'No Chinese captions for this video.'));
    if (!state.settings.geminiKey) {
      box.append(el('div', 'note', 'Add a Gemini API key in Settings to get subtitles for videos like this one.'));
      return box;
    }
    if (g.state === 'working') {
      box.append(el('div', 'note', this.progressText()));
      return box;
    }
    const b = el('button', 'chip on', 'Subtitles with Gemini');
    b.addEventListener('click', () => void this.subs.transcribeWithGemini());
    box.append(
      el('div', 'gem', b),
      el(
        'div',
        'note',
        "Mandarin is transcribed; any other language is translated into Taiwan Mandarin. Sends this video's link to Google. On the free tier Google may use the request to improve its models.",
      ),
    );
    if (g.state === 'error') box.append(el('div', 'note err', g.error ?? 'Something went wrong.'));
    return box;
  }

  private progressText() {
    const g = this.subs.gemini;
    return g.total && g.total > 1
      ? `Making subtitles with Gemini… ${g.done ?? 0} of ${g.total} parts done (lines appear as parts finish).`
      : 'Making subtitles with Gemini… this takes about a minute.';
  }

  /** Gemini still working on, or stuck on, some parts of a video that already shows lines. */
  private geminiStatus() {
    const g = this.subs.gemini;
    if (g.state === 'working') return el('div', 'note', this.progressText());
    if (g.state !== 'error') {
      if (!this.subs.trackName.startsWith('Gemini')) return null;
      const redo = el('button', 'chip', 'Redo with Gemini');
      redo.title = 'Throw these subtitles away and make new ones (for example with another model)';
      redo.addEventListener('click', () => void this.subs.redoGemini());
      return el('div', 'gem', redo);
    }
    const b = el('button', 'chip', 'Try the missing parts again');
    b.addEventListener('click', () => void this.subs.transcribeWithGemini());
    return el('div', '', el('div', 'note err', g.error ?? 'Something went wrong.'), el('div', 'gem', b));
  }

  flash(key: string) {
    const msg = TOAST[key]?.(this.subs);
    if (!msg) return;
    setTimeout(() => {
      this.toast.textContent = TOAST[key](this.subs);
      this.toast.hidden = false;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => (this.toast.hidden = true), 1300);
      this.render();
    }, 60);
  }
}
