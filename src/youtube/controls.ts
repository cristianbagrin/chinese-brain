import { state } from '../content/state.ts';
import { keyLabel, keyOf, type KeyAction } from '../shared/keys.ts';
import type { Status } from '../shared/types.ts';
import type { YouTubeSubs } from './index.ts';
import css from './controls.css';

declare const __TEST__: boolean;

const MODES = ['show', 'blur', 'hide'] as const;
const TOAST: Partial<Record<KeyAction, (s: YouTubeSubs) => string>> = {
  prev: () => '◀ previous line',
  replay: () => '↺ replay line',
  next: () => 'next line ▶',
  loop: (s) => (s.looping ? '↻ looping this line' : 'loop off'),
  shadow: (s) => (s.shadowing ? 'shadowing on' : 'shadowing off'),
  pinyin: () => `${state.settings.pron === 'zhuyin' ? 'zhuyin' : 'pinyin'} ${state.settings.pinyin ? 'on' : 'off'}`,
  transcript: (s) => (s.transcript.open ? 'transcript open' : 'transcript closed'),
  english: () => `English ${state.settings.translation === 'show' ? 'shown' : state.settings.translation === 'blur' ? 'blurred' : 'hidden'}`,
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
  private pill: HTMLElement;
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
    this.pill = el('div', 'pill');
    this.pill.hidden = true;
    this.panelRoot.append(s2, this.panel, this.toast, this.pill);

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
    this.updatePill();
    if (this.panel.hidden) return;
    // Rebuild only when something shown changed (a rebuild mid-click would swallow the click).
    const key = JSON.stringify([s, this.subs.counts, this.subs.looping, this.subs.shadowing, this.subs.trackName, this.subs.transcript.open, this.subs.gemini, this.subs.captionState]);
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
    const chip = (label: string, action: KeyAction | '', on: boolean, act: () => void, tip = '') => {
      const key = action && keyOf(s, action);
      const b = el('button', `chip${on ? ' on' : ''}`, label, key ? el('kbd', '', keyLabel(key)) : null);
      if (tip) b.title = tip;
      b.addEventListener('click', () => {
        act();
        setTimeout(() => this.render(), 50);
      });
      return b;
    };
    const save = (settings: Record<string, unknown>) => browser.runtime.sendMessage({ type: 'saveSettings', settings });
    const gear = el('button', 'gear', '⚙');
    gear.title = 'Settings';
    gear.addEventListener('click', () => void browser.runtime.sendMessage({ type: 'openOptions' }));

    this.panel.replaceChildren(
      gear,
      total
        ? el(
            'div',
            'cov',
            el('div', 'big', el('b', '', `${pct(c.known)}%`), 'known'),
            el('div', 'bar', seg('known', '熟 Known'), seg('learning', '學 Learning'), seg('fresh', '新 Fresh'), seg('new', 'Not in your list')),
          )
        : this.noCaptions(),
      (total && this.geminiStatus()) || '',
      el(
        'div',
        'chips',
        chip('◀', 'prev', false, () => this.subs.seekLine(-1), 'Previous line'),
        chip('↺', 'replay', false, () => this.subs.seekLine(0), 'Replay line'),
        chip('▶', 'next', false, () => this.subs.seekLine(1), 'Next line'),
        chip('Loop', 'loop', this.subs.looping, () => this.subs.toggleLoop(), 'Repeat this line'),
        chip('Shadow', 'shadow', this.subs.shadowing, () => this.subs.toggleShadow(), 'Pause after each line so you can repeat it'),
      ),
      el(
        'div',
        'chips',
        chip(s.pron === 'zhuyin' ? 'Zhuyin' : 'Pinyin', 'pinyin', s.pinyin, () => save({ pinyin: !s.pinyin }), 'Pronunciation over the words'),
        chip(s.translation === 'blur' ? 'English (blur)' : 'English', 'english', s.translation !== 'hide', () => save({ translation: MODES[(MODES.indexOf(s.translation) + 1) % 3] }), 'Shown, blurred until you hover, or hidden'),
        chip('Transcript', 'transcript', this.subs.transcript.open, () => this.subs.transcript.toggle()),
      ),
    );
  }

  /** Captions not here (yet): say which, and offer Gemini when the video has none. */
  private noCaptions() {
    const g = this.subs.gemini;
    const cs = this.subs.captionState;
    if (g.state !== 'working' && (cs === 'finding' || cs === 'loading')) {
      return el('div', 'cov', el('div', 'note', cs === 'finding' ? 'Looking for captions…' : 'Loading captions…'));
    }
    const box = el('div', 'cov', el('div', '', 'No Chinese captions.'));
    if (g.state === 'working') {
      box.append(el('div', 'note', this.progressText()));
      return box;
    }
    const b = el('button', 'chip on', state.settings.geminiKey ? 'Make subtitles with Gemini' : 'Add a Gemini key to make them');
    if (state.settings.geminiKey) {
      b.title = "Sends this video's link to Google Gemini";
      b.addEventListener('click', () => void this.subs.transcribeWithGemini());
    } else b.addEventListener('click', () => void browser.runtime.sendMessage({ type: 'openOptions', hash: 'gemini' }));
    box.append(el('div', 'gem', b));
    if (g.state === 'error') box.append(el('div', 'note err', g.error ?? 'Something went wrong.'));
    return box;
  }

  /** Gemini's progress, from the timestamps it has written so far (so the percentage is real). */
  private progressText() {
    const g = this.subs.gemini;
    if (g.pct == null) return el('div', '', 'Making subtitles with Gemini…');
    const pct = Math.round(g.pct * 100);
    const bar = el('div', 'gbar', el('i'));
    (bar.firstChild as HTMLElement).style.width = `${pct}%`;
    return el('div', '', el('div', '', pct ? `Gemini subtitles: ${pct}%` : 'Gemini is listening…'), bar);
  }

  /** A small pill on the video while Gemini works, so progress shows without opening the panel. */
  private updatePill() {
    const g = this.subs.gemini;
    const on = g.state === 'working';
    this.pill.hidden = !on;
    if (on) this.pill.textContent = g.pct ? `Gemini subtitles ${Math.round(g.pct * 100)}%` : 'Gemini subtitles…';
  }

  /** Gemini still working on, or stuck on, some parts of a video that already shows lines. */
  private geminiStatus() {
    const g = this.subs.gemini;
    if (g.state === 'working') return el('div', 'note', this.progressText());
    if (g.state !== 'error') {
      if (!this.subs.trackName.startsWith('Gemini')) return null;
      const redo = el('button', 'chip', 'Redo subtitles');
      redo.title = 'Throw these subtitles away and make new ones (for example with another model)';
      redo.addEventListener('click', () => void this.subs.redoGemini());
      return el('div', 'gem', redo);
    }
    const b = el('button', 'chip', 'Retry missing parts');
    b.addEventListener('click', () => void this.subs.transcribeWithGemini());
    return el('div', '', el('div', 'note err', g.error ?? 'Something went wrong.'), el('div', 'gem', b));
  }

  flash(key: KeyAction) {
    const msg = TOAST[key];
    if (!msg) return;
    setTimeout(() => {
      this.toast.textContent = msg(this.subs);
      this.toast.hidden = false;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => (this.toast.hidden = true), 1300);
      this.render();
    }, 60);
  }
}
