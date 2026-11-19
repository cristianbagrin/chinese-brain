// Shared by the website's pages, bundled to site/public/site.js. No inline scripts: the site's CSP
// allows only files from here.
//
// Without the extension, the Chinese marked [data-demo] works like it would with it: hover (or
// tap) a word for its card, 1 2 3 0 stamp it, select a phrase and tap Alt. With the extension, the
// extension does all that itself and tells this page what you did (src/content/bridge.ts), so the
// steps on How it works tick either way.
import { playSave, playStamp } from '../../src/shared/sounds.ts';
import type { Status } from '../../src/shared/types.ts';
import { numberedToZhuyin, PRON_LABEL, PRONS } from '../../src/shared/zhuyin.ts';
import { PHRASES, WORDS } from './demo-words.ts';
import { fromExtension, numbered, onPron, readingOf, setSitePron, sitePron, zhuyinHead } from './pron.ts';

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
let LONGEST = Math.max(...Object.keys(WORDS).map((w) => w.length));

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

function bars(n: number) {
  const b = h('span', 'bars');
  for (let i = 1; i <= 5; i++) b.append(h('i', i <= n ? 'on' : ''));
  return h('span', 'freq', b, ['', 'rare', 'less common', 'common', 'very common', 'essential'][n]);
}

function render() {
  if (!current) return;
  const { word, phrase } = current;
  const st = stamps.get(word);
  const zy = sitePron() === 'zhuyin';
  if (phrase) {
    const clean = word.replace(/[，。！？、：；「」\s]/g, '');
    const parts = segmentWords(clean);
    const en = PHRASES[clean] ?? parts.map((p) => WORDS[p]?.[1].replace(/^\((.*)\)$/, '$1') ?? p).join(' · ');
    card.replaceChildren(
      h('div', 'top', h('div', 'headrow', h('span', 'head long', word)), h('div', 'py', parts.map((p) => (WORDS[p] ? readingOf(WORDS[p][0], p.length) : p)).join(' ')), h('div', 'en', en)),
      h('div', 'foot', pronSwitch()),
    );
  } else {
    const [py, en, freq, parts] = WORDS[word];
    // 注音 beside each character, as Taiwan prints it; pinyin next to the word.
    const zyHead = zy ? zhuyinHead(word, py) : null;
    const head = h('span', `head${st ? ` st-${st}` : ''}${zyHead ? ' zyhead' : ''}`, zyHead ?? word);
    card.replaceChildren(
      h('div', 'top', h('div', 'headrow', head, zyHead ? null : h('span', 'py', readingOf(py, word.length)), bars(freq)), h('div', 'en', en)),
      parts ? h('div', 'parts', ...parts.map(([c, p, e]) => h('div', null, h('b', null, c), h('span', 'ppy', readingOf(p, 1)), e))) : '',
      h(
        'div',
        'foot',
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
        pronSwitch(),
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
  // A word open in the little player holds the line, like the extension pauses the video.
  for (const sim of $$('.ytsim')) sim.classList.toggle('held', at instanceof HTMLElement && sim.contains(at));
  did(phrase ? 'select' : 'card');
}

function hide() {
  card.hidden = true;
  current = undefined;
  for (const el of $$('.w.on')) el.classList.remove('on');
  for (const sim of $$('.ytsim.held')) sim.classList.remove('held');
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
  stamps.delete(word); // a new stamp goes to the top of the list
  if (next) stamps.set(word, next);
  playStamp(next);
  // Every copy of the word on the page takes the color, like the extension's page colors.
  for (const el of $$(`.w[data-w="${word}"]`)) {
    el.classList.remove('st-fresh', 'st-learning', 'st-known');
    if (next) el.classList.add(`st-${next}`);
  }
  render();
  card.querySelector(`.seal.${next}`)?.classList.add('press');
  mine();
  if (next) did('stamp');
}

// The home page's player and paragraph use the real dictionary's words (brain/demo.json, made by
// the build), loaded when they come near the screen.
const later = $$('[data-more]');
const demos = $$('[data-demo]');
if (demos.length) {
  document.body.append(card);
  for (const d of demos) if (!d.closest('[data-more]')) segment(d);
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
    // The path, not the target: a stamp redraws the card, so the button tapped is gone by now.
    else if (!e.composedPath().includes(card) && current && (touch || current.phrase)) hide();
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

// ---------- 注音 or pinyin ----------

/** Redraws for a new choice of reading (the card, the player's line, your words). */
const redraws: (() => void)[] = [
  () => {
    if (current && !card.hidden) {
      render();
      place();
    }
  },
  () => mine(),
];
onPron(() => redraws.forEach((r) => r()));

/** The card's own switch between 注音 and pinyin (with the extension, its Settings decide). */
function pronSwitch(): HTMLElement | null {
  if (fromExtension()) return null;
  const now = sitePron();
  const seg = h('div', 'pron');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Pronunciation');
  for (const p of PRONS) {
    const b = h('button', null, PRON_LABEL[p]) as HTMLButtonElement;
    b.type = 'button';
    b.lang = p === 'zhuyin' ? 'zh-Hant' : 'en';
    b.setAttribute('aria-pressed', String(p === now));
    b.addEventListener('click', () => p !== sitePron() && setSitePron(p));
    seg.append(b);
  }
  return seg;
}

// ---------- YouTube, line by line (the guide's little player) ----------

/** A subtitle word with its reading over it: 注音 over each character, pinyin over the word. */
function ruby(word: string): HTMLElement {
  const py = WORDS[word][0];
  const n = sitePron() === 'zhuyin' ? numbered(py, word.length) : null;
  if (!n) return h('ruby', null, word, h('rt', null, readingOf(py, word.length)));
  const r = h('ruby', 'zr'); // not .zy: that class draws the printed column (zhuyin.css)
  n.split(' ').forEach((syl, i) => r.append([...word][i], h('rt', null, numberedToZhuyin(syl))));
  return r;
}

function player(sim: HTMLElement) {
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
    if (sim.hasAttribute('data-pinyin')) for (const w of $$('.w', zh)) w.replaceChildren(ruby(w.dataset.w!));
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
  // A new choice of 注音 or pinyin shows on the line now on screen.
  redraws.push(() => {
    if (sim.hasAttribute('data-pinyin')) for (const w of $$('.w', zh)) w.replaceChildren(ruby(w.dataset.w!));
  });
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
    } else if (k === 'p' || k === 'x') {
      sim.classList.toggle(k === 'p' ? 'nopy' : 'noen');
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
for (const sim of $$('.ytsim')) if (!sim.closest('[data-more]')) player(sim);


if (later.length) {
  let asked = false;
  const io = new IntersectionObserver((seen) => seen.some((e) => e.isIntersecting) && load(), { rootMargin: '600px 0px' });
  const load = () => {
    if (asked) return;
    asked = true;
    io.disconnect();
    fetch('/brain/demo.json')
      .then((r) => r.json())
      .then((data: { words: typeof WORDS; phrases: typeof PHRASES }) => {
        // The hand-picked words of the first sentence stay as they are.
        for (const [w, v] of Object.entries(data.words)) WORDS[w] ??= v;
        for (const [k, v] of Object.entries(data.phrases)) PHRASES[k] ??= v;
        LONGEST = Math.max(...Object.keys(WORDS).map((w) => w.length));
        for (const sec of later) {
          for (const d of $$('[data-demo]', sec)) if (!d.closest('.ytsim')) segment(d);
          for (const sim of $$('.ytsim', sec)) player(sim);
        }
      })
      .catch(() => (asked = false));
  };
  for (const sec of later) {
    io.observe(sec);
    sec.addEventListener('pointerenter', load, { once: true });
  }
}

// ---------- Your words, filling as you stamp (home) ----------

function mine() {
  for (const box of $$('.yours')) {
    for (const [s] of STAMPS) box.querySelector(`[data-n="${s}"]`)!.textContent = String([...stamps.values()].filter((v) => v === s).length);
    box.querySelector('.mylist')!.replaceChildren(
      ...[...stamps].reverse().map(([w, s]) => {
        const el = h('span', `w st-${s}`, w);
        el.dataset.w = w;
        const [py, en] = WORDS[w] ?? ['', ''];
        const meaning = h('span', 'en', en);
        const reading = h('span', 'py', py && readingOf(py, w.length));
        if (sitePron() === 'zhuyin') reading.lang = 'zh-Hant';
        meaning.lang = 'en';
        return h('li', null, el, reading, meaning);
      }),
    );
    box.classList.toggle('some', stamps.size > 0);
  }
}

// ---------- The store for this browser ----------
// Firefox (and Zen, LibreWolf…) or Chrome (and Edge, Brave, Arc, Opera, Vivaldi): its store first.
// Anything else (Safari, a phone) keeps both, as the page has them without JavaScript.

const ua = navigator.userAgent;
const phone = /Mobi|Android|iPhone|iPad/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
const browser = phone ? '' : /Firefox\//.test(ua) ? 'firefox' : /Chrome\/|Chromium\/|Edg\//.test(ua) ? 'chrome' : '';
if (browser) {
  for (const box of $$('[data-stores]')) {
    const first = box.querySelector<HTMLElement>(`[data-store="${browser}"]`);
    if (!first) continue;
    box.prepend(first);
    // Quiet: next to a more important button (Sign in on the word list).
    const [one, two] = box.dataset.stores === 'quiet' ? ['btn secondary', 'btn quiet'] : ['btn primary', 'btn secondary'];
    for (const b of $$('[data-store]', box)) b.className = b === first ? one : two;
  }
}

// ---------- Signed in or not: the corner of the header ----------

const stored = (k: string) => {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
};
const forget = () => {
  try {
    localStorage.removeItem('cb-token');
    localStorage.removeItem('cb-email');
  } catch {
    /* nothing kept */
  }
};
const corner = document.querySelector<HTMLAnchorElement>('[data-account]');
const accountHost = location.hostname.startsWith('account.');
let menu: HTMLElement | undefined;

/** The signed-in email: remembered by the account page, else asked once. */
async function who() {
  const token = stored('cb-token');
  if (!token) return '';
  const email = stored('cb-email');
  if (email) return email;
  try {
    const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) forget();
    if (!res.ok) return '';
    const me = (await res.json()) as { email: string };
    localStorage.setItem('cb-email', me.email);
    return me.email;
  } catch {
    return '';
  }
}

function link(text: string, href: string) {
  const a = h('a', null, text) as HTMLAnchorElement;
  a.href = href;
  return a;
}

async function drawCorner() {
  if (!corner) return;
  const email = await who();
  menu?.remove();
  menu = undefined;
  const here = location.pathname.replace(/\/$/, '') || '/';
  if (!email) {
    // On the sign-in page itself, the corner has nothing to add.
    corner.hidden = accountHost || here === '/account' || here === '/reset';
    if (here.startsWith('/brain')) corner.href = `/account?next=${encodeURIComponent(here)}`;
    return;
  }
  corner.hidden = true;
  const out = h('button', 'out', 'Sign out') as HTMLButtonElement;
  out.type = 'button';
  out.addEventListener('click', async () => {
    out.disabled = true;
    await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${stored('cb-token')}` }, body: '{}' }).catch(() => {});
    forget();
    location.reload();
  });
  const face = h('span', 'initial', email[0].toUpperCase());
  face.setAttribute('aria-hidden', 'true');
  const summary = h('summary', null, face);
  summary.title = email;
  summary.setAttribute('aria-label', `Signed in as ${email}`);
  const words = link('Dashboard', accountHost ? 'https://chinese.cristianbagrin.com/brain/dashboard' : '/brain/dashboard');
  menu = h('details', 'me', summary, h('div', 'menu', h('p', 'who', email), words, link('Account', '/account'), out));
  corner.after(menu);
}

if (corner) {
  void drawCorner();
  addEventListener('cb-account', () => void drawCorner());
  addEventListener('storage', (e) => {
    if (e.key === 'cb-token' || e.key === 'cb-email') void drawCorner();
  });
  document.addEventListener('click', (e) => {
    if (menu && !menu.contains(e.target as Node)) menu.removeAttribute('open');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') menu?.removeAttribute('open');
  });
}
