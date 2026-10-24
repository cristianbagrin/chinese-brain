import { metSentence } from '../shared/context.ts';
import { buildClaudeExport, exportCount, parseWordList, sourceName } from '../shared/export.ts';
import { clock } from '../shared/time.ts';
import type { Context, LogEvent, SavedSentence, Status, WordRecord } from '../shared/types.ts';
import { $, ago, download, h, saveAs, today } from './common.ts';

const STAMPS: [Status, string, string][] = [
  ['fresh', '新', 'Fresh'],
  ['learning', '學', 'Learning'],
  ['known', '熟', 'Known'],
];
let words: WordRecord[] = [];
let logs: LogEvent[] = [];
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

let saved: Record<string, SavedSentence[]> = {};

async function load() {
  const data = await browser.runtime.sendMessage({ type: 'allData' });
  words = data.words;
  logs = data.logs;
  saved = data.saved ?? {};
  render();
  renderExportInfo();
}

const LABEL: Record<Status | 'all', string> = { fresh: 'fresh', learning: 'learning', known: 'known', all: '' };
const EMPTY: Record<Status | 'all', string> = {
  fresh: 'No fresh words. Stamp 新 on a word in the card (press 1) and it lands here.',
  learning: 'Nothing in learning yet. Stamp 學 (press 2) on a word you want to study.',
  known: 'No known words yet. Stamp 熟 (press 3), or import your known-words.txt below.',
  all: 'No words yet. Stamp a word in the card (1 新, 2 學, 3 熟) and it shows up here.',
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
const key = (w: WordRecord, sort: 'updated' | 'added' | 'looks') => (sort === 'updated' ? (kept.get(w.w) ?? w.updated) : w[sort]);

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
  const syl = w.syl?.length === chars.length ? w.syl : undefined;
  return h(
    'div',
    { class: 'hw', lang: 'zh-Hant' },
    syl ? null : h('div', { class: 'pyline' }, w.p ?? ''),
    h('div', { class: `chars${syl ? '' : ' nopy'}`, title: syl ? w.p ?? '' : '' }, ...chars.map((ch, i) => h('span', { class: 'ch', 'data-py': syl?.[i] ?? '' }, h('b', null, ch)))),
  );
}

function row(w: WordRecord) {
  const gone = removed.has(w.w) && !words.some((x) => x.w === w.w);
  // The same sentence the export uses: the one with the word in it, trimmed around it (shorter here).
  let met: { c: Context; text: string } | undefined;
  for (const c of w.ctx) {
    const text = metSentence(c, w.w, 36).split(' — ')[0];
    if (text) {
      met = { c, text };
      break;
    }
  }
  let src: HTMLElement | null = null;
  if (met) {
    const c = met.c;
    const line = c.src === 'yt' && c.t != null;
    src = h('a', { class: 'src', href: line ? `${c.url}&t=${c.t}s` : c.url, target: '_blank', title: c.title || c.url }, line ? `▶ ${clock(c.t!)}` : sourceName(c.url));
  }
  const stamps = h(
    'div',
    { class: 'stamps', role: 'group', 'aria-label': 'Status' },
    ...STAMPS.map(([s, zh, label]) => {
      const b = h('button', { class: s, title: `${label} (${zh})`, 'aria-pressed': String(w.s === s), lang: 'zh-Hant' }, zh);
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
      met ? h('p', { class: 'ctx', lang: 'zh-Hant' }, ...marked(met.text, w.w, met.c.q), src) : null,
    ),
    h('div', { class: 'act' }, gone ? corner : stamps, gone ? null : corner, h('span', { class: 'when' }, gone ? 'Removed' : ago(w.updated))),
  );
}

async function setStatus(w: WordRecord, s: Status) {
  if (w.s === s) return;
  if (!kept.has(w.w)) kept.set(w.w, w.updated);
  w.s = s;
  w.updated = Date.now();
  render();
  document.querySelector(`.word[data-w="${CSS.escape(w.w)}"] .stamps .${s}`)?.classList.add('press');
  await browser.runtime.sendMessage({ type: 'setStatus', word: w.w, status: s });
}

async function remove(w: WordRecord) {
  removed.set(w.w, { ...w, ctx: [...w.ctx], hist: [...w.hist] });
  words = words.filter((x) => x.w !== w.w);
  render();
  const done = (async () => {
    const stored: WordRecord | null = await browser.runtime.sendMessage({ type: 'getWord', word: w.w });
    await browser.runtime.sendMessage({ type: 'setStatus', word: w.w, status: null });
    return stored;
  })();
  removing.set(w.w, done);
  await done;
}

/**
 * Undo a removal: the whole record comes back (sentences and history too), as it was stored,
 * not the list's tidied-up pinyin and meaning. It waits for the removal to finish first.
 */
async function restore(w: WordRecord) {
  const shown = removed.get(w.w) ?? w;
  removed.delete(w.w);
  words = [...words, shown];
  render();
  const { syl: _, ...fallback } = shown;
  const stored = (await removing.get(w.w)) ?? fallback;
  removing.delete(w.w);
  await browser.runtime.sendMessage({ type: 'importWords', words: [stored], mode: 'merge' });
}

function setFilter(f: Status | 'all') {
  filter = f;
  kept.clear();
  removed.clear();
  removing.clear();
  shown = PAGE;
  render();
}

/** When you last exported, and how many words the next "Download new" has. */
async function renderExportInfo() {
  const { lastExportAt } = await browser.storage.local.get('lastExportAt');
  const since = (lastExportAt as number) ?? 0;
  const rows = exportCount(words, logs, since, saved);
  const waiting = rows > 0 ? `${rows} word${rows === 1 ? '' : 's'} to send` : 'Nothing new to send yet';
  $('lastExport').textContent = since ? `Last export ${ago(since)}. ${waiting}.` : `Nothing exported yet. ${waiting}.`;
}

$('q').addEventListener('input', () => {
  shown = PAGE;
  render();
});
$('sort').addEventListener('change', render);
$('showMore').addEventListener('click', () => {
  shown += PAGE;
  render();
});
/** Open on a status straight from the toolbar menu (vocab.html#fresh, #learning, #known). */
function filterFromHash() {
  const f = location.hash.slice(1);
  if (!['all', 'fresh', 'learning', 'known'].includes(f)) return false;
  filter = f as Status | 'all';
  return true;
}
filterFromHash();
window.addEventListener('hashchange', () => {
  if (filterFromHash()) setFilter(filter);
});

$('filter').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (b) setFilter(b.dataset.f as Status | 'all');
});

/**
 * Fresh data, then the export since the last one, handed to `deliver`. The watermark moves to
 * the fetch time only once it was delivered (cancel the save dialog and nothing is lost).
 */
async function exportNew(deliver: (text: string) => Promise<boolean>): Promise<void> {
  const at = Date.now();
  const data = await browser.runtime.sendMessage({ type: 'allData' });
  words = data.words;
  logs = data.logs;
  saved = data.saved ?? {};
  const { lastExportAt } = await browser.storage.local.get('lastExportAt');
  const text = buildClaudeExport(words, logs, (lastExportAt as number) ?? 0, saved);
  if (!(await deliver(text))) return;
  await browser.storage.local.set({ lastExportAt: at });
  render();
  renderExportInfo();
}

const TSV = 'text/tab-separated-values;charset=utf-8';
$('exportNew').addEventListener('click', () => exportNew((text) => saveAs(`chinese-brain-${today()}.tsv`, text, TSV)));
$('copyNew').addEventListener('click', () =>
  exportNew(async (text) => {
    await navigator.clipboard.writeText(text);
    $('copyOk').textContent = 'Copied';
    return true;
  }),
);
$('exportAll').addEventListener('click', async () => {
  const data = await browser.runtime.sendMessage({ type: 'allData' });
  await saveAs(`chinese-brain-all-${today()}.tsv`, buildClaudeExport(data.words, data.logs, 0, data.saved), TSV);
});

$('backup').addEventListener('click', async () => {
  const all = await browser.storage.local.get(null);
  download(`chinese-brain-backup-${today()}.json`, JSON.stringify({ app: 'chinese-brain', v: 1, at: Date.now(), data: all }), 'application/json');
});
$('restore').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  const json = JSON.parse(await f.text());
  if (json.app !== 'chinese-brain') return alert('Not a Chinese Brain backup.');
  const recs = Object.entries(json.data as Record<string, unknown>)
    .filter(([k]) => k.startsWith('w:'))
    .map(([, v]) => v as WordRecord);
  const n = await browser.runtime.sendMessage({ type: 'importWords', words: recs, mode: 'merge' });
  const existing = await browser.storage.local.get(null);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(json.data as Record<string, unknown>)) if (!k.startsWith('w:') && !(k in existing)) extra[k] = v;
  await browser.storage.local.set(extra);
  alert(`Restored ${n} words.`);
  load();
});

$('knownFile').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) $<HTMLTextAreaElement>('knownText').value = await f.text();
});
$('knownGo').addEventListener('click', async () => {
  const items = parseWordList($<HTMLTextAreaElement>('knownText').value);
  if (!items.length) return;
  const n = await browser.runtime.sendMessage({ type: 'importList', items });
  // Claude already has this file: the first "what's new" export should start from here.
  const { lastExportAt } = await browser.storage.local.get('lastExportAt');
  if (!lastExportAt) await browser.storage.local.set({ lastExportAt: Date.now() });
  const by = (s: Status) => items.filter((i) => i.s === s).length;
  $('knownOk').textContent = `${n} words updated (file: ${by('known')} K, ${by('learning')} L${by('fresh') ? `, ${by('fresh')} F` : ''})`;
  load();
});

let reloadTimer: ReturnType<typeof setTimeout> | undefined;
browser.storage.onChanged.addListener((ch) => {
  if (Object.keys(ch).some((k) => k.startsWith('w:'))) {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(load, 500);
  }
});
load();
