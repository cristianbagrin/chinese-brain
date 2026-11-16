// Shared by the website's pages, bundled to site/public/site.js. No inline scripts: the site's CSP
// allows only files from here.
//
// Without the extension, the Chinese marked [data-demo] works like it would with it: hover (or
// tap) a word for its card, 1 2 3 0 stamp it, select a phrase and tap Alt. With the extension, the
// extension does all that itself and tells this page what you did (src/content/bridge.ts), so the
// steps on How it works tick either way.
import { playSave, playStamp } from '../../src/shared/sounds.ts';
import type { Status } from '../../src/shared/types.ts';
import { PHRASES, WORDS } from './demo-words.ts';

const root = document.documentElement;
const ext = () => !!root.dataset.cbExt;
const mac = /Mac|iPhone|iPad/.test(navigator.platform);
const $$ = <T extends Element = HTMLElement>(sel: string, el: ParentNode = document) => [...el.querySelectorAll<T>(sel)];
function h(tag: string, cls?: string | null, ...kids: (Node | string | null | false | undefined)[]): HTMLElement {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const k of kids) if (k) el.append(k);
  return el;
}

// Key names as this computer calls them: Alt is Option on a Mac.
if (mac) for (const el of $$('kbd.alt')) el.textContent = '⌥ Option';

// The video loads from YouTube only when pressed (privacy-enhanced mode, no cookies before that).
for (const b of $$<HTMLButtonElement>('button.video[data-video]')) {
  b.addEventListener(
    'click',
    () => {
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${b.dataset.video}?autoplay=1&rel=0`;
      f.title = b.getAttribute('aria-label') || 'Video';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      const box = h('div', 'video on', f);
      b.replaceWith(box);
    },
    { once: true },
  );
}

// Just installed: the extension opens How it works with #welcome.
if (location.hash === '#welcome') {
  root.classList.add('welcome');
  for (const el of $$('[data-welcome]')) el.textContent = el.dataset.welcome!;
}

// ---------- Steps that tick as you do them ----------

type Did = 'card' | 'stamp' | 'select';
function did(what: Did) {
  for (const box of $$('[data-quests]')) {
    const step = box.querySelector(`[data-q="${what}"]`);
    if (!step || step.classList.contains('done')) continue;
    step.classList.add('done');
    // Steps a phone can't do (no Alt) are hidden there and don't count.
    if ($$('[data-q]', box).every((s) => s.classList.contains('done') || !(s as HTMLElement).offsetParent)) {
      setTimeout(() => {
        box.classList.add('all');
        if (!ext()) playSave();
      }, 500);
    }
  }
}
window.addEventListener('message', (e) => {
  if (e.source === window && e.data?.cb === 'did') did(e.data.did);
});

// ---------- The demo card ----------

const STAMPS: [Status, string, string][] = [
  ['fresh', '新', '1'],
  ['learning', '學', '2'],
  ['known', '熟', '3'],
];
const stamps = new Map<string, Status>();
const LONGEST = Math.max(...Object.keys(WORDS).map((w) => w.length));

/** Wrap the demo's known words in spans, longest first, like the extension finds them. */
function segment(el: Element) {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walk.nextNode()) texts.push(walk.currentNode as Text);
  for (const t of texts) {
    if (t.parentElement?.closest('.w')) continue;
    const s = t.data;
    const out: (Node | string)[] = [];
    let plain = '';
    for (let i = 0; i < s.length; ) {
      let hit = '';
      for (let n = LONGEST; n > 0 && !hit; n--) if (WORDS[s.slice(i, i + n)]) hit = s.slice(i, i + n);
      if (!hit) {
        plain += s[i++];
        continue;
      }
      if (plain) out.push(plain);
      plain = '';
      const w = h('span', `w${stamps.has(hit) ? ` st-${stamps.get(hit)}` : ''}`, hit);
      w.dataset.w = hit;
      out.push(w);
      i += hit.length;
    }
    if (plain) out.push(plain);
    if (out.length > 1 || typeof out[0] !== 'string') t.replaceWith(...out);
  }
}

const card = h('div', 'dcard');
card.setAttribute('role', 'dialog');
card.hidden = true;
let current: { word: string; phrase: boolean; at: HTMLElement | DOMRect } | undefined;
let hideTimer = 0;

function say(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-TW';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* no speech here */
  }
}

function bars(n: number) {
  const b = h('span', 'bars');
  for (let i = 1; i <= 5; i++) b.append(h('i', i <= n ? 'on' : ''));
  return h('span', 'freq', b, ['', 'rare', 'uncommon', 'useful', 'common', 'essential'][n]);
}

function render() {
  if (!current) return;
  const { word, phrase } = current;
  const st = stamps.get(word);
  const sayBtn = h('button', 'say', '🔊');
  sayBtn.title = 'Say it';
  sayBtn.addEventListener('click', () => say(word));
  if (phrase) {
    const clean = word.replace(/[，。！？、：；「」\s]/g, '');
    const parts = segmentWords(clean);
    const en = PHRASES[clean] ?? parts.map((p) => WORDS[p]?.[1].replace(/^\((.*)\)$/, '$1') ?? p).join(' · ');
    card.replaceChildren(
      h('div', 'top', h('div', 'headrow', h('span', 'head long', word), sayBtn), h('div', 'py', parts.map((p) => WORDS[p]?.[0] ?? p).join(' ')), h('div', 'en', en)),
    );
  } else {
    const [py, en, freq, parts] = WORDS[word];
    const head = h('span', `head${st ? ` st-${st}` : ''}`, word);
    card.replaceChildren(
      h('div', 'top', h('div', 'headrow', head, h('span', 'py', py), sayBtn, bars(freq)), h('div', 'en', en)),
      parts ? h('div', 'parts', ...parts.map(([c, p, e]) => h('div', null, h('b', null, c), h('span', 'ppy', p), e))) : '',
      h(
        'div',
        'stamps',
        ...STAMPS.map(([s, zh, key]) => {
          const b = h('button', `seal ${s}${st === s ? ' on' : ''}`, zh, h('small', null, key));
          b.title = `${s[0].toUpperCase()}${s.slice(1)} (${key})`;
          b.addEventListener('click', () => stamp(s));
          return b;
        }),
      ),
    );
  }
  card.lang = 'zh-Hant';
  for (const el of $$('.en, .parts, .freq', card)) el.lang = 'en';
}

/** Split a phrase into the demo's words. */
function segmentWords(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; ) {
    let n = LONGEST;
    while (n > 1 && !WORDS[s.slice(i, i + n)]) n--;
    out.push(s.slice(i, i + n));
    i += n;
  }
  return out;
}

function place() {
  if (!current) return;
  const r = current.at instanceof HTMLElement ? current.at.getBoundingClientRect() : current.at;
  const w = card.offsetWidth;
  const left = Math.max(8, Math.min(r.left + scrollX, scrollX + root.clientWidth - w - 8));
  let top = r.bottom + scrollY + 8;
  if (r.bottom + card.offsetHeight + 16 > innerHeight && r.top > card.offsetHeight + 16) top = r.top + scrollY - card.offsetHeight - 8;
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function show(word: string, at: HTMLElement | DOMRect, phrase = false) {
  clearTimeout(hideTimer);
  if (current?.word === word && current.at === at && !card.hidden) return;
  current = { word, phrase, at };
  render();
  card.hidden = false;
  card.classList.remove('in');
  void card.offsetWidth;
  card.classList.add('in');
  place();
  for (const el of $$('.w.on')) el.classList.remove('on');
  if (at instanceof HTMLElement) at.classList.add('on');
  did(phrase ? 'select' : 'card');
}

function hide() {
  card.hidden = true;
  current = undefined;
  for (const el of $$('.w.on')) el.classList.remove('on');
}
const hideSoon = (ms = 220) => {
  clearTimeout(hideTimer);
  hideTimer = window.setTimeout(hide, ms);
};

function stamp(s: Status | null) {
  if (!current || current.phrase) return;
  const { word } = current;
  const next = s && stamps.get(word) === s ? null : s;
  if (next === (stamps.get(word) ?? null)) return;
  if (next) stamps.set(word, next);
  else stamps.delete(word);
  playStamp(next);
  // Every copy of the word on the page takes the color, like the extension's page colors.
  for (const el of $$(`.w[data-w="${word}"]`)) {
    el.classList.remove('st-fresh', 'st-learning', 'st-known');
    if (next) el.classList.add(`st-${next}`);
  }
  render();
  card.querySelector(`.seal.${next}`)?.classList.add('press');
  if (next) did('stamp');
}

const demos = $$('[data-demo]');
if (demos.length) {
  document.body.append(card);
  for (const d of demos) segment(d);
  const touch = matchMedia('(hover: none)').matches;
  document.addEventListener('mouseover', (e) => {
    if (ext() || touch) return;
    const w = (e.target as Element).closest?.<HTMLElement>('[data-demo] .w');
    if (w) show(w.dataset.w!, w);
    else if (card.contains(e.target as Node)) clearTimeout(hideTimer);
    else if (current && !current.phrase) hideSoon();
  });
  document.addEventListener('click', (e) => {
    if (ext()) return;
    const w = (e.target as Element).closest?.<HTMLElement>('[data-demo] .w');
    if (w && touch) show(w.dataset.w!, w);
    else if (!card.contains(e.target as Node) && current && (touch || current.phrase)) hide();
  });
  document.addEventListener('keydown', (e) => {
    if (ext() || e.ctrlKey || e.metaKey || (e.target as Element).closest?.('input, textarea, select')) return;
    if (e.key === 'Escape') return hide();
    // Select a phrase, then tap Alt.
    if (e.key === 'Alt' && !e.repeat) {
      const sel = getSelection();
      const text = sel?.toString().trim() ?? '';
      const node = sel?.anchorNode?.parentElement;
      if (!text || !/[一-鿿]/.test(text) || !node?.closest('[data-demo]')) return;
      e.preventDefault();
      const r = sel!.getRangeAt(0).getBoundingClientRect();
      show(text, r, !WORDS[text]);
      return did('select');
    }
    if (!current || e.altKey || e.shiftKey) return;
    const s = STAMPS.find(([, , k]) => k === e.key);
    if (s) stamp(s[0]);
    else if (e.key === '0') stamp(null);
    else if (e.key === 'v') say(current.word);
    else return;
    e.preventDefault();
  });
  addEventListener('resize', place);
}

// What's new: the stamps you can hear.
for (const b of $$<HTMLButtonElement>('[data-sound]')) {
  b.addEventListener('click', () => {
    playStamp(b.dataset.sound as Status);
    b.classList.add('press');
    setTimeout(() => b.classList.remove('press'), 160);
  });
}

// ---------- YouTube, line by line (the guide's little player) ----------

for (const sim of $$('.ytsim')) {
  const lines = $$('.script li', sim);
  const zh = sim.querySelector<HTMLElement>('.band .zh')!;
  const en = sim.querySelector<HTMLElement>('.band .en')!;
  const bar = sim.querySelector<HTMLElement>('.bar')!;
  let at = 0;
  let loop = false;
  const go = (i: number, flash?: string) => {
    at = (i + lines.length) % lines.length;
    zh.textContent = lines[at].dataset.zh!;
    en.textContent = lines[at].dataset.en!;
    segment(zh);
    lines.forEach((l, j) => l.classList.toggle('now', j === at));
    bar.classList.remove('run');
    void bar.offsetWidth;
    bar.classList.add('run');
    if (flash) {
      const k = sim.querySelector(`[data-k="${flash}"]`);
      k?.classList.remove('hit');
      void (k as HTMLElement | null)?.offsetWidth;
      k?.classList.add('hit');
    }
  };
  bar.addEventListener('animationend', () => go(loop ? at : at + 1));
  // Hover the subtitles and the video waits.
  const band = sim.querySelector('.band')!;
  band.addEventListener('mouseenter', () => sim.classList.add('paused'));
  band.addEventListener('mouseleave', () => sim.classList.remove('paused'));
  const act = (k: string) => {
    if (k === 'a') go(at - 1, k);
    else if (k === 's') go(at, k);
    else if (k === 'd') go(at + 1, k);
    else if (k === 'r') {
      loop = !loop;
      sim.classList.toggle('loop', loop);
      go(at, k);
    } else if (k === 'e') {
      sim.classList.toggle('script-on');
      go(at, k);
    } else return false;
    return true;
  };
  for (const b of $$<HTMLButtonElement>('[data-k]', sim)) b.addEventListener('click', () => act(b.dataset.k!));
  lines.forEach((l, i) => l.addEventListener('click', () => go(i)));
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || (e.target as Element).closest?.('input, textarea, select')) return;
    const r = sim.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    if (act(e.key.toLowerCase())) e.preventDefault();
  });
  go(0);
}
