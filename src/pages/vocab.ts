import { sentenceWith } from '../shared/context.ts';
import { buildClaudeExport, parseWordList, shortSource } from '../shared/export.ts';
import { clock } from '../shared/time.ts';
import type { LogEvent, Status, WordRecord } from '../shared/types.ts';
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
 * faded with an Undo) until you switch filters, so the grid doesn't jump while you work through it.
 */
const kept = new Set<string>();
const removed = new Map<string, WordRecord>();

async function load() {
  const data = await browser.runtime.sendMessage({ type: 'allData' });
  words = data.words;
  logs = data.logs;
  render();
  renderExportInfo();
}

const LABEL: Record<Status | 'all', string> = { fresh: 'fresh', learning: 'learning', known: 'known', all: '' };

function render() {
  const n = (s: Status) => words.filter((w) => w.s === s).length;
  const tab = (f: Status | 'all', count: number, ...label: (string | HTMLElement)[]) =>
    h('button', { class: f, 'data-f': f, 'aria-pressed': String(filter === f) }, ...label, h('b', null, count.toLocaleString('en-US')));
  $('filter').replaceChildren(
    ...STAMPS.map(([s, zh, label]) => tab(s, n(s), h('span', { class: 'zh' }, zh), h('span', { class: 'en' }, label))),
    tab('all', words.length, h('span', null, 'All')),
  );
  const q = $<HTMLInputElement>('q').value.trim().toLowerCase();
  const sort = $<HTMLSelectElement>('sort').value as 'updated' | 'added' | 'looks';
  const byWord = new Map(words.map((w) => [w.w, w]));
  for (const [w, rec] of removed) if (!byWord.has(w)) byWord.set(w, rec);
  const list = [...byWord.values()]
    .filter((w) => filter === 'all' || w.s === filter || kept.has(w.w) || removed.has(w.w))
    .filter((w) => !q || w.w.includes(q) || (w.p ?? '').toLowerCase().includes(q) || (w.g ?? '').toLowerCase().includes(q))
    .sort((a, b) => (b[sort] as number) - (a[sort] as number));
  $('rows').replaceChildren(...list.slice(0, shown).map(card));
  if (!list.length) {
    $('rows').append(
      h('p', { class: 'empty' }, q ? 'No words match.' : filter === 'all' ? 'No words yet. Stamp a word in the card (1 新, 2 學, 3 熟) and it shows up here.' : `No ${LABEL[filter]} words.`),
    );
  }
  const what = `${LABEL[filter] ? `${LABEL[filter]} ` : ''}word${list.length === 1 ? '' : 's'}`;
  $('more').textContent = list.length > shown ? `${shown} of ${list.length.toLocaleString('en-US')} ${what}` : list.length ? `${list.length.toLocaleString('en-US')} ${what}` : '';
  $('showMore').hidden = list.length <= shown;
}

/** The sentence with the headword underlined. */
function sentence(text: string, word: string): (Node | string)[] {
  const out: (Node | string)[] = [];
  text.split(word).forEach((part, i) => {
    if (i) out.push(h('u', null, word));
    if (part) out.push(part);
  });
  return out;
}

function card(w: WordRecord) {
  const gone = removed.has(w.w) && !words.some((x) => x.w === w.w);
  // The same sentence the export uses: the one with the word in it, trimmed around it.
  const met = w.ctx.map((c) => ({ c, text: sentenceWith(c.text, w.w).split(' — ')[0] })).find((x) => x.text);
  let link: HTMLElement | null = null;
  if (met) {
    const c = met.c;
    const yt = c.src === 'yt' && c.t != null;
    link = h('a', { href: yt ? `${c.url}&t=${c.t}s` : c.url, target: '_blank', title: c.title ?? c.url }, yt ? `▶ ${clock(c.t!)}` : shortSource(c.url));
  }
  const stamps = h(
    'div',
    { class: 'stamps', role: 'group', 'aria-label': 'Status' },
    ...STAMPS.map(([s, zh, label]) => {
      const b = h('button', { class: s, title: label, 'aria-pressed': String(w.s === s) }, zh);
      b.addEventListener('click', () => setStatus(w, s));
      return b;
    }),
  );
  let corner: HTMLElement;
  if (gone) {
    corner = h('button', { class: 'undo' }, 'Undo');
    corner.addEventListener('click', () => restore(w));
  } else {
    corner = h('button', { class: 'x', title: 'Remove from the list', 'aria-label': 'Remove from the list' }, '×');
    corner.addEventListener('click', () => remove(w));
  }
  return h(
    'article',
    { class: `card ${w.s}${gone ? ' gone' : ''}` },
    h('div', { class: 'top' }, h('b', { class: 'hw' }, w.w), corner),
    h('div', { class: 'py' }, (w.p ?? '').toLowerCase()),
    h('div', { class: 'gl', title: w.g ?? '' }, w.g ?? ''),
    met ? h('p', { class: 'ctx' }, ...sentence(met.text, w.w), link ? ' ' : '', link) : null,
    h('div', { class: 'foot' }, gone ? h('span', { class: 'when' }, 'Removed') : stamps, gone ? null : h('span', { class: 'when' }, ago(w.updated))),
  );
}

async function setStatus(w: WordRecord, s: Status) {
  if (w.s === s) return;
  kept.add(w.w);
  w.s = s;
  w.updated = Date.now();
  render();
  await browser.runtime.sendMessage({ type: 'setStatus', word: w.w, status: s });
}

async function remove(w: WordRecord) {
  removed.set(w.w, { ...w, ctx: [...w.ctx], hist: [...w.hist] });
  words = words.filter((x) => x.w !== w.w);
  render();
  await browser.runtime.sendMessage({ type: 'setStatus', word: w.w, status: null });
}

/** Undo a removal: the whole record comes back (sentences and history too). */
async function restore(w: WordRecord) {
  const rec = removed.get(w.w) ?? w;
  removed.delete(w.w);
  words = [...words, rec];
  render();
  await browser.runtime.sendMessage({ type: 'importWords', words: [rec], mode: 'merge' });
}

function setFilter(f: Status | 'all') {
  filter = f;
  kept.clear();
  removed.clear();
  shown = PAGE;
  render();
}

async function renderExportInfo() {
  const { lastExportAt } = await browser.storage.local.get('lastExportAt');
  $('lastExport').textContent = lastExportAt
    ? `Last export ${ago(lastExportAt as number)}. "What's new" is everything since.`
    : 'Nothing exported yet.';
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
  const { lastExportAt } = await browser.storage.local.get('lastExportAt');
  const text = buildClaudeExport(words, logs, (lastExportAt as number) ?? 0, data.saved);
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
