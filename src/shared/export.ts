import { shownSentence } from './context.ts';
import { dayKeyLocal } from './time.ts';
import { STATUS_CODE, type LogEvent, type SavedSentence, type Status, type WordRecord } from './types.ts';

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

/** Sites by the names people call them, for the word list ("Notion", not app.notion.com). */
const SITES: [string, string][] = [
  ['notion.so', 'Notion'], ['notion.com', 'Notion'], ['notion.site', 'Notion'], ['youtube.com', 'YouTube'], ['youtu.be', 'YouTube'],
  ['gemini.google.com', 'Gemini'], ['docs.google.com', 'Google Docs'], ['fonts.google.com', 'Google Fonts'], ['translate.google.com', 'Google Translate'],
  ['chatgpt.com', 'ChatGPT'], ['claude.ai', 'Claude'], ['tally.so', 'Tally'], ['wikipedia.org', 'Wikipedia'], ['ptt.cc', 'PTT'], ['dcard.tw', 'Dcard'],
  ['facebook.com', 'Facebook'], ['instagram.com', 'Instagram'], ['threads.net', 'Threads'], ['threads.com', 'Threads'], ['reddit.com', 'Reddit'],
  ['x.com', 'X'], ['twitter.com', 'X'], ['netflix.com', 'Netflix'], ['line.me', 'LINE'],
];

/** A short, readable name for where a sentence came from. */
export function sourceName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^(www|m|app)\./, '');
    return SITES.find(([d]) => host === d || host.endsWith('.' + d))?.[1] ?? host;
  } catch {
    return '';
  }
}

function duration(secs: number) {
  const m = Math.round(secs / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
}

/**
 * The weekly export for Claude: one small TSV with the words whose status you
 * changed in the period (only your own stamps count; lookups don't), plus the
 * example sentences you saved in it. Status codes match known-words.txt.
 */
export function buildClaudeExport(words: WordRecord[], logs: LogEvent[], since = 0, saved: Record<string, SavedSentence[]> = {}): string {
  const now = Date.now();
  const { rows, savedNow, watches } = exportRows(words, logs, since, saved);
  const lines = [
    `# Chinese Brain export · ${stamp(now)} · ${since ? `since ${stamp(since)}` : 'everything so far'}`,
    '# Codes as in known-words.txt: K known, L learning, F fresh (met, not studied yet), - not in the list.',
    '# date = the day I set this status · sentence = where I met the word · saved = sentences I saved for a card, several joined with " ‖ "',
    '# was = status before this period (- = new). Only status changes I made are listed.',
    `# ${rows.length} words · ${[...savedNow.values()].flat().length} saved sentences · ${watches.length} videos with subtitles (${duration(watches.reduce((n, e) => n + e.secs, 0))})`,
    ['word', 'now', 'was', 'date', 'pinyin', 'meaning', 'sentence', 'source', 'saved'].join('\t'),
  ];
  for (const r of rows) {
    // Your edit of a sentence you met it in, else the first one that has the word; none rather than a wrong one.
    const met = shownSentence(r.rec?.ctx ?? [], r.w, saved[r.w]);
    lines.push(
      [
        r.w,
        code(r.now),
        code(r.was),
        dayKeyLocal(r.date),
        r.rec?.p?.toLowerCase(),
        r.rec?.g,
        met?.text,
        met ? shortSource(met.c.url, met.c.t) : '',
        (savedNow.get(r.w) ?? []).map((x) => (x.en ? `${x.zh} — ${x.en}` : x.zh)).join(' ‖ '),
      ]
        .map((x) => clean(x))
        .join('\t'),
    );
  }
  return lines.join('\n') + '\n';
}

/** How many words the export would have (without building its sentences). */
export function exportCount(words: WordRecord[], logs: LogEvent[], since = 0, saved: Record<string, SavedSentence[]> = {}): number {
  return exportRows(words, logs, since, saved).rows.length;
}

type ExportRow = { w: string; now: Status | null; was: Status | null; date: number; rec?: WordRecord };

/** The export's rows, in order: status changes in the period, then words with sentences saved in it. */
function exportRows(words: WordRecord[], logs: LogEvent[], since: number, saved: Record<string, SavedSentence[]>) {
  const now = Date.now();
  const evs = logs.filter((e) => e.at > since);
  const watches = evs.filter((e) => e.k === 'watch') as Extract<LogEvent, { k: 'watch' }>[];
  const byWord = new Map(words.map((w) => [w.w, w]));

  // Status before the period = the "from" of each word's first status change in it.
  const before = new Map<string, Status | null>();
  for (const e of evs) if (e.k === 'status' && !before.has(e.w)) before.set(e.w, e.from ?? null);

  const rows: ExportRow[] = [];
  if (!since) {
    for (const w of words) rows.push({ w: w.w, now: w.s, was: null, date: w.updated, rec: w });
  } else {
    for (const [w, was] of before) {
      const rec = byWord.get(w);
      const cur = rec?.s ?? null;
      if (was === cur) continue; // changed and changed back: nothing to report
      rows.push({ w, now: cur, was, date: rec?.updated ?? now, rec });
    }
  }
  // Sentences saved in the period, on their word's row (a word of its own if its status didn't change).
  const savedNow = new Map<string, SavedSentence[]>();
  const listed = new Set(rows.map((r) => r.w));
  for (const [w, list] of Object.entries(saved)) {
    const fresh = list.filter((x) => x.at > since);
    if (!fresh.length) continue;
    savedNow.set(w, fresh);
    if (!listed.has(w)) {
      const rec = byWord.get(w);
      rows.push({ w, now: rec?.s ?? null, was: rec?.s ?? null, date: rec?.updated ?? Math.max(...fresh.map((x) => x.at)), rec });
    }
  }

  const order = { K: 0, L: 1, F: 2, '-': 3 } as Record<string, number>;
  rows.sort((a, b) => order[code(a.now)] - order[code(b.now)] || a.date - b.date);
  return { rows, savedNow, watches };
}

/** The import format, shown and offered as a file on the Dashboard. */
export const IMPORT_EXAMPLE = [
  '# Chinese Brain word list: one word per line, then a comma and K (known), L (learning) or F (fresh). No letter means known.',
  '臺北,K',
  '捷運,L',
  '夜市,F',
  '',
].join('\n');

/** For any AI chat, with your own list (an Anki export, a spreadsheet, a photo): it answers in IMPORT_EXAMPLE's format. */
export const IMPORT_PROMPT = [
  'Turn my Chinese word list (below or attached) into this exact format, so I can import it into Chinese Brain:',
  '',
  '- One word per line, in Traditional characters as used in Taiwan (convert Simplified ones).',
  '- After each word, a comma and one letter for how well I know it: K known, L learning, F fresh (new to me).',
  '- If my list shows how well I know each word (Anki intervals or due dates, a column, a mark), use that. Otherwise use K.',
  '- Only the words: no pinyin, meanings, numbering or headings. Leave out duplicates and anything that isn\'t a Chinese word.',
  '',
  'Reply with the list only, in one code block, like this:',
  '',
  '臺北,K',
  '捷運,L',
  '夜市,F',
  '',
  'My list:',
  '',
].join('\n');

/** Parse a known-words.txt style list: word, K|L|F, date (tab, comma or semicolon). Lines with only a word count as known. */
export function parseWordList(text: string): { w: string; s: Status; t: number }[] {
  const out: { w: string; s: Status; t: number }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    // Columns by tab, comma or semicolon; "臺北 K" (an AI chat turns tabs into spaces) works too.
    const spaced = /^(\S+)\s+([KLF])$/i.exec(line);
    const cols = spaced ? [spaced[1], spaced[2]] : line.split(/\t|,|;/).map((c) => c.trim());
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
