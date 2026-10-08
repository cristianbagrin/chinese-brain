import { buildAnkiCsv, buildClaudeMarkdown } from '../shared/export.ts';
import type { LogEvent, Status, WordRecord } from '../shared/types.ts';
import { clock } from '../shared/time.ts';
import { $, ago, download, h, today } from './common.ts';

const STAMPS: [Status, string][] = [
  ['fresh', '新'],
  ['difficult', '難'],
  ['known', '熟'],
];
let words: WordRecord[] = [];
let logs: LogEvent[] = [];
let filter: Status | 'all' = 'all';
const PAGE = 300;
let limit = PAGE;

async function load() {
  const data = await browser.runtime.sendMessage({ type: 'allData' });
  words = data.words;
  logs = data.logs;
  render();
  renderExportInfo();
}

function render() {
  const n = (s: Status) => words.filter((w) => w.s === s).length;
  $('counts').replaceChildren(
    ...STAMPS.map(([s, zh]) => h('div', { class: s }, h('b', null, String(n(s))), h('span', null, `${zh} ${s}`))),
    h('div', null, h('b', null, String(words.length)), h('span', null, 'total')),
  );
  const q = $<HTMLInputElement>('q').value.trim().toLowerCase();
  const sort = $<HTMLSelectElement>('sort').value as 'updated' | 'added' | 'looks';
  const list = words
    .filter((w) => filter === 'all' || w.s === filter)
    .filter((w) => !q || w.w.includes(q) || (w.p ?? '').toLowerCase().includes(q) || (w.g ?? '').toLowerCase().includes(q))
    .sort((a, b) => (b[sort] as number) - (a[sort] as number));
  $('shown').textContent = `${list.length} shown`;
  $('rows').replaceChildren(...list.slice(0, limit).map(row));
  $('more').textContent = list.length > limit ? `Showing ${limit} of ${list.length}. Search to narrow down.` : '';
}

function row(w: WordRecord) {
  const c = w.ctx[0];
  let link: HTMLElement | null = null;
  if (c) {
    const yt = c.src === 'yt' && c.t != null;
    const href = yt ? `${c.url}&t=${c.t}s` : c.url;
    link = h('a', { href, target: '_blank', title: c.title ?? c.url }, yt ? `▶ ${clock(c.t!)}` : new URL(c.url).hostname);
  }
  const stamps = h(
    'div',
    { class: 'stamps' },
    ...STAMPS.map(([s, zh]) => {
      const b = h('button', { class: `stamp ${s}${w.s === s ? ' on' : ''}`, title: s }, zh);
      b.addEventListener('click', () => setStatus(w, s));
      return b;
    }),
  );
  const del = h('button', { class: 'stamp del', title: 'remove from list' }, '×');
  del.addEventListener('click', () => setStatus(w, null));
  stamps.append(del);
  return h(
    'tr',
    null,
    h('td', { class: `word st-${w.s}` }, w.w),
    h('td', { class: 'py' }, w.p ?? ''),
    h('td', null, w.g ?? ''),
    h('td', { class: 'ctx' }, c ? c.text : '', c ? ' ' : '', link),
    h('td', { class: 'when' }, ago(w.added)),
    h('td', null, stamps),
  );
}

async function setStatus(w: WordRecord, s: Status | null) {
  await browser.runtime.sendMessage({ type: 'setStatus', word: w.w, status: s });
  await load();
}

async function renderExportInfo() {
  const { lastExportAt, lastAnkiAt, feedWrittenAt, settings } = await browser.storage.local.get(['lastExportAt', 'lastAnkiAt', 'feedWrittenAt', 'settings']);
  $('lastExport').textContent = lastExportAt ? `Last export ${ago(lastExportAt as number)}.` : 'Nothing exported yet.';
  const folder = (settings as { feedFolder?: string } | undefined)?.feedFolder ?? 'chinese-brain';
  $('feedInfo').textContent = folder
    ? `Kept up to date automatically in Downloads/${folder}/ (words.tsv, events.tsv, README.md). ${feedWrittenAt ? `Last written ${ago(feedWrittenAt as number)}.` : ''}`
    : 'Live feed is off (Settings).';
  $('ankiNew').title = lastAnkiAt ? `Since ${new Date(lastAnkiAt as number).toLocaleString()}` : 'Nothing exported yet';
}

$('q').addEventListener('input', () => {
  limit = PAGE;
  render();
});
$('sort').addEventListener('change', render);
$('filter').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  filter = b.dataset.f as Status | 'all';
  $('filter').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  render();
});

$('exportNew').addEventListener('click', async () => {
  const { lastExportAt } = await browser.storage.local.get('lastExportAt');
  download(`chinese-brain-${today()}.md`, buildClaudeMarkdown(words, logs, (lastExportAt as number) ?? 0));
  await browser.storage.local.set({ lastExportAt: Date.now() });
  renderExportInfo();
});
$('exportAll').addEventListener('click', () => download(`chinese-brain-all-${today()}.md`, buildClaudeMarkdown(words, logs, 0)));
$('feedNow').addEventListener('click', async () => {
  $('feedNow').textContent = 'Writing…';
  await browser.runtime.sendMessage({ type: 'writeFeed' });
  $('feedNow').textContent = 'Write feed now';
  renderExportInfo();
});
$('ankiAll').addEventListener('click', () => download(`chinese-brain-anki-${today()}.csv`, buildAnkiCsv(words), 'text/csv;charset=utf-8'));
$('ankiNew').addEventListener('click', async () => {
  const { lastAnkiAt } = await browser.storage.local.get('lastAnkiAt');
  const fresh = words.filter((w) => w.added > ((lastAnkiAt as number) ?? 0));
  download(`chinese-brain-anki-new-${today()}.csv`, buildAnkiCsv(fresh), 'text/csv;charset=utf-8');
  await browser.storage.local.set({ lastAnkiAt: Date.now() });
  renderExportInfo();
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
  // Logs and settings: merge keys that don't exist yet.
  const existing = await browser.storage.local.get(null);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(json.data as Record<string, unknown>)) if (!k.startsWith('w:') && !(k in existing)) extra[k] = v;
  await browser.storage.local.set(extra);
  alert(`Restored ${n} words.`);
  load();
});

function wordsFromText(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /[㐀-鿿豈-﫿]+/.exec(line);
    if (m) out.push(m[0]);
  }
  return out;
}
$('knownFile').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) $<HTMLTextAreaElement>('knownText').value = await f.text();
});
$('knownGo').addEventListener('click', async () => {
  const list = wordsFromText($<HTMLTextAreaElement>('knownText').value);
  if (!list.length) return;
  const n = await browser.runtime.sendMessage({ type: 'bulkStatus', words: list, status: 'known', onlyNew: false });
  $('knownOk').textContent = `${n} words marked known`;
  load();
});
$('tocflGo').addEventListener('click', async () => {
  const level = Number($<HTMLSelectElement>('tocfl').value);
  const list: string[] = await browser.runtime.sendMessage({ type: 'tocflWords', level });
  const n = await browser.runtime.sendMessage({ type: 'bulkStatus', words: list, status: 'known', onlyNew: true });
  $('tocflOk').textContent = `${n} words marked known`;
  load();
});

browser.storage.onChanged.addListener((ch) => {
  if (Object.keys(ch).some((k) => k.startsWith('w:'))) {
    clearTimeout((window as unknown as { _t?: number })._t);
    (window as unknown as { _t?: number })._t = window.setTimeout(load, 500);
  }
});
load();
