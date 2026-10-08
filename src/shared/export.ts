import { dayKeyLocal } from './time.ts';
import { STATUS_CODE, type LogEvent, type Status, type WordRecord } from './types.ts';

const clean = (s: string | undefined) => (s ?? '').replace(/[\t\r\n]+/g, ' ').trim();
const stamp = (t: number) => {
  const d = new Date(t);
  return `${dayKeyLocal(t)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const code = (s: Status | null | undefined) => (s ? STATUS_CODE[s] : '-');

/** Short, clickable source: youtu.be/ID?t=83 for videos, the domain for pages. */
export function shortSource(url: string, t?: number): string {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('youtube.com') && u.searchParams.get('v')) {
      return `youtu.be/${u.searchParams.get('v')}${t != null ? `?t=${Math.floor(t)}` : ''}`;
    }
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function duration(secs: number) {
  const m = Math.round(secs / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
}

/**
 * The weekly export for Claude: one small TSV. Only words whose status changed
 * in the period, plus words looked up in it (a lookup of a Known word is a
 * recall failure worth seeing). Status codes match known-words.txt.
 */
export function buildClaudeExport(words: WordRecord[], logs: LogEvent[], since = 0): string {
  const now = Date.now();
  const evs = logs.filter((e) => e.at > since);
  const looks = new Map<string, number>();
  let yt = 0;
  for (const e of evs) {
    if (e.k !== 'look') continue;
    looks.set(e.w, (looks.get(e.w) ?? 0) + 1);
    if (e.src === 'yt') yt++;
  }
  const watches = evs.filter((e) => e.k === 'watch') as Extract<LogEvent, { k: 'watch' }>[];
  const byWord = new Map(words.map((w) => [w.w, w]));

  // Status before the period, from each word's history; removed words come from the log.
  const was = (w: WordRecord): Status | null => {
    const before = w.hist.filter((h) => h.t <= since);
    return before.length ? before[before.length - 1].s : null;
  };
  const removed = new Set<string>();
  for (const e of evs) if (e.k === 'status') (e.s ? removed.delete(e.w) : removed.add(e.w));

  type Row = { w: string; now: Status | null; was: Status | null; date: number; rec?: WordRecord };
  const rows: Row[] = [];
  for (const w of words) {
    const changed = w.hist.some((h) => h.t > since);
    if (changed || looks.has(w.w)) rows.push({ w: w.w, now: w.s, was: since ? was(w) : null, date: w.updated, rec: w });
  }
  for (const w of removed) if (!byWord.has(w)) rows.push({ w, now: null, was: null, date: now });
  for (const w of looks.keys()) if (!byWord.has(w) && !removed.has(w)) rows.push({ w, now: null, was: null, date: now });

  const order = { K: 0, L: 1, F: 2, '-': 3 } as Record<string, number>;
  rows.sort((a, b) => order[code(a.now)] - order[code(b.now)] || a.date - b.date);

  const changedCount = rows.filter((r) => r.now !== r.was).length;
  const lines = [
    `# Chinese Brain export · ${stamp(now)} · ${since ? `since ${stamp(since)}` : 'everything so far'}`,
    '# Codes as in known-words.txt: K known, L learning, F fresh (met, not studied yet), - not in the list.',
    '# was = status before this period (- = new). looks = deliberate lookups in this period (a K word looked up = forgotten).',
    `# ${changedCount} status changes · ${[...looks.values()].reduce((a, b) => a + b, 0)} lookups (YouTube ${yt}) · ${watches.length} videos with subtitles (${duration(watches.reduce((n, e) => n + e.secs, 0))})`,
    ['word', 'now', 'was', 'date', 'looks', 'pinyin', 'meaning', 'sentence', 'source'].join('\t'),
  ];
  for (const r of rows) {
    const c = r.rec?.ctx[0];
    lines.push(
      [r.w, code(r.now), code(r.was), dayKeyLocal(r.date), String(looks.get(r.w) ?? 0), r.rec?.p, r.rec?.g, c?.text, c ? shortSource(c.url, c.t) : '']
        .map((x) => clean(x))
        .join('\t'),
    );
  }
  return lines.join('\n') + '\n';
}

/** Parse a known-words.txt style list: word<TAB>K|L|F<TAB>date. Lines with only a word count as known. */
export function parseWordList(text: string): { w: string; s: Status; t: number }[] {
  const out: { w: string; s: Status; t: number }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const cols = line.split(/\t|,|;/).map((c) => c.trim());
    const m = /[㐀-鿿豈-﫿]+/.exec(cols[0]) ?? /[㐀-鿿豈-﫿]+/.exec(line);
    if (!m) continue;
    const codeCol = cols.find((c, i) => i > 0 && /^[KLF]$/i.test(c))?.toUpperCase();
    const s: Status = codeCol === 'L' ? 'learning' : codeCol === 'F' ? 'fresh' : 'known';
    const dateCol = cols.find((c) => /^\d{4}-\d{2}-\d{2}$/.test(c));
    const t = dateCol ? new Date(`${dateCol}T12:00:00`).getTime() : 0;
    out.push({ w: m[0], s, t });
  }
  return out;
}
