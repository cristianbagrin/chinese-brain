// The word list, on the website. One page for everyone:
//   with the extension installed, it shows the words in this browser (through the extension;
//     nothing is uploaded for it) and hovering a word opens its card;
//   without it (a phone, another computer), it shows the words in your account.
import { shownSentence } from '../../src/shared/context.ts';
import { buildClaudeExport, buildPracticePrompt, exportCount, parseWordList, sourceName } from '../../src/shared/export.ts';
import { playStamp } from '../../src/shared/sounds.ts';
import { clock } from '../../src/shared/time.ts';
import type { LogEvent, SavedSentence, Status, WordRecord } from '../../src/shared/types.ts';
import { $, ago, download, h, today } from '../../src/pages/common.ts';

interface Data {
  words: WordRecord[];
  logs: LogEvent[];
  saved: Record<string, SavedSentence[]>;
}

/** Where the list lives: the extension in this browser, or the account on the server. */
interface Source {
  kind: 'extension' | 'account';
  /** What to call it on the page. */
  label: string;
  sounds: boolean;
  load(): Promise<Data>;
  setStatus(w: WordRecord, status: Status | null): Promise<void>;
  /** The record as stored (before a removal), for Undo. */
  stored(word: string): Promise<WordRecord | null>;
  restore(rec: WordRecord): Promise<void>;
  /** When "Download new" last ran; pass a time to move it. */
  mark(at?: number): Promise<number>;
  importList?(items: { w: string; s: Status; t: number }[]): Promise<number>;
}

// ---------- The extension, through its content script (src/content/bridge.ts) ----------

let nextId = 1;
const waiting = new Map<number, { ok: (v: unknown) => void; fail: (e: Error) => void }>();
window.addEventListener('message', (e) => {
  const d = e.data as { cb?: string; id?: number; result?: unknown; error?: string } | undefined;
  if (e.source !== window || d?.cb !== 'res' || d.id == null) return;
  const w = waiting.get(d.id);
  waiting.delete(d.id);
  if (d.error) w?.fail(new Error(d.error));
  else w?.ok(d.result);
});
function ask<T>(msg: Record<string, unknown>): Promise<T> {
  return new Promise<T>((ok, fail) => {
    const id = nextId++;
    waiting.set(id, { ok: ok as (v: unknown) => void, fail });
    window.postMessage({ cb: 'req', id, msg }, location.origin);
  });
}

/** Is the extension here? Its content script marks the page a moment after it loads. */
function extensionHere(ms = 900): Promise<boolean> {
  const there = () => !!document.documentElement.dataset.cbExt;
  if (there()) return Promise.resolve(true);
  return new Promise((ok) => {
    const done = (v: boolean) => {
      window.removeEventListener('message', on);
      clearTimeout(t);
      ok(v);
    };
    const on = (e: MessageEvent) => e.source === window && e.data?.cb === 'ready' && done(true);
    const t = setTimeout(() => done(there()), ms);
    window.addEventListener('message', on);
  });
}

async function extensionSource(): Promise<Source> {
  const prefs = await ask<{ sounds: boolean }>({ type: 'prefs' });
  const acct = await ask<{ signedIn: boolean; email: string }>({ type: 'account' }).catch(() => ({ signedIn: false, email: '' }));
  return {
    kind: 'extension',
    label: acct.signedIn ? `This browser · synced to ${acct.email}` : 'This browser',
    sounds: prefs.sounds,
    load: () => ask<Data>({ type: 'allData' }).then((d) => ({ words: d.words, logs: d.logs ?? [], saved: d.saved ?? {} })),
    setStatus: (w, status) => ask({ type: 'setStatus', word: w.w, status }).then(() => {}),
    stored: (word) => ask<WordRecord | null>({ type: 'getWord', word }),
    restore: (rec) => ask({ type: 'importWords', words: [rec], mode: 'merge' }).then(() => {}),
    mark: (at) => ask<number>({ type: 'mark', at }),
    importList: (items) => ask<number>({ type: 'importList', items }),
  };
}

// ---------- The account, through the API (cb.js) ----------

declare const api: (path: string, body?: unknown) => Promise<{ seq: number; more: boolean; changes: { k: string; v: unknown; t: number }[]; email?: string }>;
declare const token: () => string;

async function accountSource(): Promise<Source> {
  const me = await api('me');
  const words = new Map<string, WordRecord>();
  const saved = new Map<string, SavedSentence[]>();
  let seq = 0;
  const take = (changes: { k: string; v: unknown }[]) => {
    for (const c of changes) {
      const i = c.k.indexOf(':');
      const map = c.k.startsWith('w:') ? words : c.k.startsWith('sav:') ? saved : null;
      if (!map) continue;
      if (c.v == null) map.delete(c.k.slice(i + 1));
      else (map as Map<string, unknown>).set(c.k.slice(i + 1), c.v);
    }
  };
  const push = async (changes: { k: string; v: unknown; t: number }[]) => {
    for (let more = true; more; changes = []) {
      const res = await api('sync', { since: seq, changes });
      take(res.changes);
      seq = res.seq;
      more = res.more;
    }
  };
  const put = (rec: WordRecord | null, word: string) => {
    if (rec) words.set(word, rec);
    else words.delete(word);
    return push([{ k: `w:${word}`, v: rec, t: Date.now() }]);
  };
  return {
    kind: 'account',
    label: `Account · ${me.email}`,
    sounds: true,
    load: async () => {
      await push([]);
      return { words: [...words.values()].map((w) => ({ ...w, ctx: w.ctx ?? [], hist: w.hist ?? [] })), logs: [], saved: Object.fromEntries(saved) };
    },
    setStatus: (w, status) => {
      const old = words.get(w.w);
      const now = Date.now();
      return put(status && old ? { ...old, s: status, updated: now, hist: [...(old.hist ?? []), { t: now, s: status }] } : null, w.w);
    },
    stored: async (word) => words.get(word) ?? null,
    restore: (rec) => put({ ...rec, updated: Date.now() }, rec.w),
    mark: async (at) => {
      if (at != null) localStorage.setItem('cb-exported', String(at));
      return Number(localStorage.getItem('cb-exported')) || 0;
    },
  };
}

// ---------- The list ----------

const STAMPS: [Status, string, string][] = [
  ['fresh', '新', 'Fresh'],
  ['learning', '學', 'Learning'],
  ['known', '熟', 'Known'],
];
let src: Source;
let words: WordRecord[] = [];
let logs: LogEvent[] = [];
let saved: Record<string, SavedSentence[]> = {};
/** Fresh first: the words to work on. */
let filter: Status | 'all' = 'fresh';
const PAGE = 120;
let shown = PAGE;
/**
 * Words you restamped or removed in this view stay where they are (with their new status, or
 * faded with an Undo) until you switch filters, so the list doesn't jump while you work through it.
 */
const kept = new Map<string, number>(); // word -> when it was last changed before this view touched it
const removed = new Map<string, WordRecord>();
/** Each removal in flight: it resolves to the record as stored, which Undo puts back. */
const removing = new Map<string, Promise<WordRecord | null>>();

async function load() {
  ({ words, logs, saved } = await src.load());
  render();
  void renderExportInfo();
}

const LABEL: Record<Status | 'all', string> = { fresh: 'fresh', learning: 'learning', known: 'known', all: '' };
const EMPTY: Record<Status | 'all', string> = {
  fresh: 'No fresh words. Stamp 新 on a word in the card and it lands here.',
  learning: 'Nothing in learning yet. Stamp 學 on a word you want to study.',
  known: 'No known words yet. Stamp 熟, or import a list below.',
  all: 'No words yet. Stamp a word in the card (新, 學 or 熟) and it shows up here.',
};

function render() {
  const n = (s: Status) => words.filter((w) => w.s === s).length;
  const tab = (f: Status | 'all', count: number, ...label: (string | HTMLElement)[]) =>
    h('button', { class: f, 'data-f': f, 'aria-pressed': String(filter === f) }, ...label, h('b', null, count.toLocaleString('en-US')));
  $('filter').replaceChildren(
    ...STAMPS.map(([s, zh, label]) => tab(s, n(s), h('span', { class: 'seal', lang: 'zh-Hant' }, zh), h('span', { class: 'en' }, label))),
    tab('all', words.length, h('span', null, 'All')),
  );
  const q = $<HTMLInputElement>('q').value.trim().toLowerCase();
  const sort = $<HTMLSelectElement>('sort').value as 'updated' | 'added' | 'looks';
  const byWord = new Map(words.map((w) => [w.w, w]));
  for (const [w, rec] of removed) if (!byWord.has(w)) byWord.set(w, rec);
  const matches = (w: WordRecord) => !q || w.w.includes(q) || plain(w.p ?? '').includes(plain(q)) || (w.g ?? '').toLowerCase().includes(q);
  const list = [...byWord.values()]
    .filter((w) => filter === 'all' || w.s === filter || kept.has(w.w) || removed.has(w.w))
    .filter(matches)
    .sort((a, b) => key(b, sort) - key(a, sort));
  $('rows').replaceChildren(...list.slice(0, shown).map(row));
  if (!list.length) $('rows').append(emptyState(q, words.filter(matches).length));
  // The count is of the list's words now, not the ones only kept in place.
  const total = list.filter((w) => words.includes(w) && (filter === 'all' || w.s === filter)).length;
  const what = `${q ? 'match' : `${LABEL[filter] ? `${LABEL[filter]} ` : ''}word`}${total === 1 ? '' : q ? 'es' : 's'}`;
  $('more').textContent = list.length > shown ? `${shown} of ${total.toLocaleString('en-US')} ${what}` : total ? `${total.toLocaleString('en-US')} ${what}` : '';
  $('showMore').hidden = list.length <= shown;
  renderWeeks();
}

/** Stamps per week for the last twelve: a small picture of how steadily you work. */
function renderWeeks() {
  const WEEK = 7 * 86_400_000;
  const weeks = Array.from({ length: 12 }, () => 0);
  const start = Date.now() - 12 * WEEK;
  for (const w of words) for (const x of w.hist ?? []) if (x.t > start) weeks[Math.min(11, Math.floor((x.t - start) / WEEK))]++;
  const top = Math.max(1, ...weeks);
  $('weeks').replaceChildren(
    ...weeks.map((v, i) => {
      const bar = h('i', null);
      bar.style.height = `${Math.max(12, (v / top) * 100)}%`;
      const back = 11 - i;
      return h('span', { class: v ? '' : 'none', title: `${v} ${v === 1 ? 'stamp' : 'stamps'} ${back ? `${back} ${back === 1 ? 'week' : 'weeks'} ago` : 'this week'}` }, bar);
    }),
  );
  $('weeks').parentElement!.hidden = !words.length;
}

/** Nothing to show: say why, and when the search finds words in the other lists, offer them. */
function emptyState(q: string, elsewhere: number): HTMLElement {
  if (!q) return h('p', { class: 'empty' }, EMPTY[filter]);
  if (!elsewhere || filter === 'all') return h('p', { class: 'empty' }, `Nothing matches “${q}”.`);
  const all = h('button', { class: 'link' }, elsewhere === 1 ? 'Show it' : `Show all ${elsewhere}`);
  all.addEventListener('click', () => setFilter('all'));
  return h('p', { class: 'empty' }, `No ${LABEL[filter]} words match “${q}”, but ${elsewhere === 1 ? 'one word' : `${elsewhere} words`} in your other lists ${elsewhere === 1 ? 'does' : 'do'}. `, all);
}

/** Sort key; a word restamped here keeps its place in "Recently changed" until the filter changes. */
const key = (w: WordRecord, sort: 'updated' | 'added' | 'looks') => (sort === 'updated' ? (kept.get(w.w) ?? w.updated) : (w[sort] ?? 0));

/** Pinyin without tone marks or spaces, so "zhongwen" finds zhōngwén. */
const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f\s']/g, '').toLowerCase();

/** The sentence with the headword marked, however it's written there (台/臺, or as `alt`). */
function marked(text: string, word: string, alt?: string): (Node | string)[] {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[臺台]/g, '[臺台]');
  const re = new RegExp([word, alt].filter(Boolean).map((x) => esc(x!)).join('|'), 'g');
  const out: (Node | string)[] = [];
  let at = 0;
  for (const m of text.matchAll(re)) {
    out.push(text.slice(at, m.index), h('u', null, m[0]));
    at = m.index! + m[0].length;
  }
  out.push(text.slice(at));
  return out.filter((x) => x !== '');
}

/**
 * The headword in 田字格 squares with each character's pinyin above it, like a practice book.
 * The squares stay inline and the pinyin is drawn by CSS (data-py), so hovering the word still
 * opens the card for the whole word, not one character.
 */
function headword(w: WordRecord): HTMLElement {
  const chars = [...w.w];
  // The extension works the syllables out from its dictionary; without it, the saved pinyin splits when it fits.
  const split = (w.p ?? '').split(/\s+/).filter(Boolean);
  const syl = w.syl?.length === chars.length ? w.syl : split.length === chars.length ? split : undefined;
  return h(
    'div',
    { class: 'hw', lang: 'zh-Hant' },
    syl ? null : h('div', { class: 'pyline' }, w.p ?? ''),
    h('div', { class: `chars${syl ? '' : ' nopy'}`, title: syl ? w.p ?? '' : '' }, ...chars.map((ch, i) => h('span', { class: 'ch', 'data-py': syl?.[i] ?? '' }, h('b', null, ch)))),
  );
}

function row(w: WordRecord) {
  const gone = removed.has(w.w) && !words.some((x) => x.w === w.w);
  // The same sentence the export uses: your edit of it, else the one with the word in it, trimmed around it (shorter here).
  const sentence = shownSentence(w.ctx ?? [], w.w, saved[w.w], 36);
  const met = sentence && { c: sentence.c, text: sentence.text.split(' — ')[0] };
  let from: HTMLElement | null = null;
  if (met) {
    const c = met.c;
    const line = c.src === 'yt' && c.t != null;
    from = h('a', { class: 'src', href: line ? `${c.url}&t=${c.t}s` : c.url, target: '_blank', rel: 'noopener', title: c.title || c.url }, line ? `▶ ${clock(c.t!)}` : sourceName(c.url));
  }
  const stamps = h(
    'div',
    { class: 'stamps', role: 'group', 'aria-label': 'Status' },
    ...STAMPS.map(([s, zh, label]) => {
      const b = h('button', { class: s, title: label, 'aria-pressed': String(w.s === s), lang: 'zh-Hant' }, zh);
      b.addEventListener('click', () => setStatus(w, s));
      return b;
    }),
  );
  let corner: HTMLElement;
  if (gone) {
    corner = h('button', { class: 'undo' }, 'Undo');
    corner.addEventListener('click', () => restore(w));
  } else {
    corner = h('button', { class: 'x', title: 'Remove from the list', 'aria-label': `Remove ${w.w} from the list` }, '×');
    corner.addEventListener('click', () => remove(w));
  }
  return h(
    'article',
    { class: `word ${w.s}${gone ? ' gone' : ''}`, 'data-w': w.w },
    headword(w),
    h(
      'div',
      { class: 'txt' },
      w.g ? h('p', { class: 'gl' }, w.g) : h('p', { class: 'gl none' }, 'Not in the dictionary'),
      met ? h('p', { class: 'ctx', lang: 'zh-Hant' }, ...marked(met.text, w.w, met.c.q), from) : null,
    ),
    h('div', { class: 'act' }, gone ? corner : stamps, gone ? null : corner, h('span', { class: 'when' }, gone ? 'Removed' : ago(w.updated))),
  );
}

/** A change that didn't reach its store: say so and show what is really there. */
function failed(e: unknown) {
  $('note').textContent = e instanceof Error ? e.message : 'That didn’t save. Try again.';
  void load();
}

async function setStatus(w: WordRecord, s: Status) {
  if (w.s === s) return;
  if (!kept.has(w.w)) kept.set(w.w, w.updated);
  if (src.sounds) playStamp(s);
  w.s = s;
  w.updated = Date.now();
  render();
  document.querySelector(`.word[data-w="${CSS.escape(w.w)}"] .stamps .${s}`)?.classList.add('press');
  await src.setStatus(w, s).catch(failed);
}

async function remove(w: WordRecord) {
  if (src.sounds) playStamp(null);
  removed.set(w.w, { ...w, ctx: [...(w.ctx ?? [])], hist: [...(w.hist ?? [])] });
  words = words.filter((x) => x.w !== w.w);
  render();
  const done = (async () => {
    const stored = await src.stored(w.w);
    await src.setStatus(w, null);
    return stored;
  })();
  removing.set(w.w, done);
  await done.catch(failed);
}

/**
 * Undo a removal: the whole record comes back (sentences and history too), as it was stored,
 * not the list's tidied-up pinyin and meaning. It waits for the removal to finish first.
 */
async function restore(w: WordRecord) {
  const was = removed.get(w.w) ?? w;
  removed.delete(w.w);
  words = [...words, was];
  render();
  const { syl: _, ...fallback } = was;
  const stored = (await removing.get(w.w)?.catch(() => null)) ?? fallback;
  removing.delete(w.w);
  await src.restore(stored).catch(failed);
}

function setFilter(f: Status | 'all') {
  filter = f;
  kept.clear();
  removed.clear();
  removing.clear();
  shown = PAGE;
  history.replaceState(null, '', `#${f}`);
  render();
}

/** When you last exported, and how many words the next "Download new" has. */
async function renderExportInfo() {
  // Without the extension there is no log of what changed when: the export is the whole list.
  const whole = src.kind === 'account';
  $('exportNew').textContent = whole ? 'Download' : 'Download new';
  $('exportAll').hidden = whole;
  if (whole) return void ($('lastExport').textContent = 'Your whole list as a small file (TSV), for a spreadsheet, Anki or an AI tutor.');
  const since = await src.mark();
  const rows = exportCount(words, logs, since, saved);
  const waiting = rows > 0 ? `${rows} word${rows === 1 ? '' : 's'} to send` : 'Nothing new to send yet';
  $('lastExport').textContent = since ? `Last export ${ago(since)}. ${waiting}.` : `Nothing exported yet. ${waiting}.`;
}

/**
 * Fresh data, then the export since the last one, handed to `deliver`. The mark moves to the
 * fetch time only once it was delivered.
 */
async function exportNew(deliver: (text: string) => Promise<unknown> | unknown): Promise<void> {
  const at = Date.now();
  ({ words, logs, saved } = await src.load());
  const since = src.kind === 'account' ? 0 : await src.mark();
  await deliver(buildClaudeExport(words, logs, since, saved));
  await src.mark(at);
  render();
  void renderExportInfo();
}

const TSV = 'text/tab-separated-values;charset=utf-8';

function wire() {
  $('q').addEventListener('input', () => {
    shown = PAGE;
    render();
  });
  $('sort').addEventListener('change', render);
  $('showMore').addEventListener('click', () => {
    shown += PAGE;
    render();
  });
  $('filter').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (b) setFilter(b.dataset.f as Status | 'all');
  });
  $('practice').addEventListener('click', async () => {
    const learning = words.some((w) => w.s !== 'known');
    if (learning) await navigator.clipboard.writeText(buildPracticePrompt(words, saved));
    $('practiceOk').textContent = learning ? 'Copied. Paste it into your AI chat.' : 'Stamp some words 新 or 學 first.';
  });
  $('exportNew').addEventListener('click', () => exportNew((text) => download(`chinese-brain-${today()}.tsv`, text, TSV)));
  $('copyNew').addEventListener('click', () =>
    exportNew(async (text) => {
      await navigator.clipboard.writeText(text);
      $('copyOk').textContent = 'Copied';
    }),
  );
  $('exportAll').addEventListener('click', async () => {
    ({ words, logs, saved } = await src.load());
    download(`chinese-brain-all-${today()}.tsv`, buildClaudeExport(words, logs, 0, saved), TSV);
  });
  // Importing needs the extension's dictionary (it turns 台北 into 臺北 and finds the readings).
  $('importTool').hidden = !src.importList;
  $('knownFile').addEventListener('change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) $<HTMLTextAreaElement>('knownText').value = await f.text();
  });
  $('knownGo').addEventListener('click', async () => {
    const items = parseWordList($<HTMLTextAreaElement>('knownText').value);
    if (!items.length) return void ($('knownOk').textContent = 'Nothing to import: one word per line.');
    const n = await src.importList!(items);
    // Whoever gave you this list already has it: the next "Download new" starts from here.
    if (!(await src.mark())) await src.mark(Date.now());
    $('knownOk').textContent = `${n} word${n === 1 ? '' : 's'} added or updated.`;
    $<HTMLTextAreaElement>('knownText').value = '';
    await load();
  });
  // Words stamped in another tab since: show them when you come back.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !removed.size && !kept.size) void load();
  });
}

async function start() {
  try {
    if (await extensionHere()) src = await extensionSource();
    else if (token()) src = await accountSource();
    else {
      $('loading').hidden = true;
      return void ($('welcome').hidden = false);
    }
  } catch (e) {
    // Signed out meanwhile (a changed password): sign in again, then come back here.
    if ((e as { code?: string }).code === 'signed_out') {
      localStorage.removeItem('cb-token');
      return location.replace('/account?next=/brain/dashboard');
    }
    $('loading').hidden = true;
    $('troubleMsg').textContent = e instanceof Error ? e.message : 'Something went wrong. Try again in a moment.';
    return void ($('trouble').hidden = false);
  }
  const f = location.hash.slice(1);
  if (['all', 'fresh', 'learning', 'known'].includes(f)) filter = f as Status | 'all';
  wire();
  await load();
  // Nothing fresh to work on: open on everything.
  if (!location.hash && !words.some((w) => w.s === 'fresh') && words.length) setFilter('all');
  $('source').textContent = src.label;
  $('loading').hidden = true;
  $('app').hidden = false;
}
void start();
