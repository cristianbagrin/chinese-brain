import { buildClaudeExport, parseWordList, shortSource } from '../shared/export.ts';
import { clock } from '../shared/time.ts';
import type { LogEvent, Status, WordRecord } from '../shared/types.ts';
import { $, ago, download, h, today } from './common.ts';

const STAMPS: [Status, string, string][] = [
  ['fresh', '新', 'Fresh'],
  ['learning', '學', 'Learning'],
  ['known', '熟', 'Known'],
];
let words: WordRecord[] = [];
let logs: LogEvent[] = [];
let filter: Status | 'all' = 'all';
const PAGE = 300;

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
    ...STAMPS.map(([s, zh, label]) => h('div', { class: `count ${s}` }, h('b', null, String(n(s))), h('span', null, `${zh} ${label}`))),
    h('div', { class: 'count' }, h('b', null, String(words.length)), h('span', null, 'in your list')),
  );
  const q = $<HTMLInputElement>('q').value.trim().toLowerCase();
  const sort = $<HTMLSelectElement>('sort').value as 'updated' | 'added' | 'looks';
  const list = words
    .filter((w) => filter === 'all' || w.s === filter)
    .filter((w) => !q || w.w.includes(q) || (w.p ?? '').toLowerCase().includes(q) || (w.g ?? '').toLowerCase().includes(q))
    .sort((a, b) => (b[sort] as number) - (a[sort] as number));
  $('rows').replaceChildren(...list.slice(0, PAGE).map(row));
  $('more').textContent = list.length > PAGE ? `Showing ${PAGE} of ${list.length}. Search to narrow it down.` : `${list.length} words`;
}

function row(w: WordRecord) {
  const c = w.ctx[0];
  let link: HTMLElement | null = null;
  if (c) {
    const yt = c.src === 'yt' && c.t != null;
    link = h('a', { href: yt ? `${c.url}&t=${c.t}s` : c.url, target: '_blank', title: c.title ?? c.url }, yt ? `▶ ${clock(c.t!)}` : shortSource(c.url));
  }
  const pills = h(
    'div',
    { class: 'pills' },
    ...STAMPS.map(([s, zh, label]) => {
      const b = h('button', { class: `pill ${s}${w.s === s ? ' on' : ''}`, title: label }, zh);
      b.addEventListener('click', () => setStatus(w, s));
      return b;
    }),
  );
  const del = h('button', { class: 'pill del', title: 'Remove from the list' }, '×');
  del.addEventListener('click', () => setStatus(w, null));
  pills.append(del, h('span', { class: 'when' }, ago(w.updated)));
  return h(
    'div',
    { class: `row ${w.s}` },
    h('div', { class: 'w' }, h('b', null, w.w), h('span', null, (w.p ?? '').toLowerCase())),
    h('div', { class: 'mean' }, w.g ?? '', c ? h('span', { class: 'ctx' }, c.text.split(' — ')[0], link) : null),
    pills,
  );
}

async function setStatus(w: WordRecord, s: Status | null) {
  await browser.runtime.sendMessage({ type: 'setStatus', word: w.w, status: s });
  await load();
}

async function renderExportInfo() {
  const { lastExportAt } = await browser.storage.local.get('lastExportAt');
  $('lastExport').textContent = lastExportAt
    ? `Last export ${ago(lastExportAt as number)}. "Export what's new" covers everything since then.`
    : `Nothing exported yet. "Export what's new" will include everything so far.`;
}

$('q').addEventListener('input', render);
$('sort').addEventListener('change', render);
$('filter').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  filter = b.dataset.f as Status | 'all';
  $('filter').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  render();
});

/** Fresh data, then the export since the last one; the watermark moves to the fetch time. */
async function exportNew(): Promise<string> {
  const at = Date.now();
  const data = await browser.runtime.sendMessage({ type: 'allData' });
  words = data.words;
  logs = data.logs;
  const { lastExportAt } = await browser.storage.local.get('lastExportAt');
  const text = buildClaudeExport(words, logs, (lastExportAt as number) ?? 0);
  await browser.storage.local.set({ lastExportAt: at });
  render();
  renderExportInfo();
  return text;
}

$('exportNew').addEventListener('click', async () => {
  download(`chinese-brain-${today()}.tsv`, await exportNew(), 'text/tab-separated-values;charset=utf-8');
});
$('copyNew').addEventListener('click', async () => {
  await navigator.clipboard.writeText(await exportNew());
  $('copyOk').textContent = 'Copied. Paste it into Claude.';
});
$('exportAll').addEventListener('click', async () => {
  const data = await browser.runtime.sendMessage({ type: 'allData' });
  download(`chinese-brain-all-${today()}.tsv`, buildClaudeExport(data.words, data.logs, 0), 'text/tab-separated-values;charset=utf-8');
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
