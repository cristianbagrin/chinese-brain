import { dayKeyLocal } from './time.ts';
import type { LogEvent, WordRecord } from './types.ts';

const clean = (s: string | undefined) => (s ?? '').replace(/[\t\r\n]+/g, ' ').trim();
const iso = (t: number) => {
  const d = new Date(t);
  return `${dayKeyLocal(t)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function videoLink(url: string, t?: number) {
  if (t == null) return url;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('youtube.com') && u.searchParams.get('v')) {
      return `https://youtu.be/${u.searchParams.get('v')}?t=${Math.floor(t)}`;
    }
  } catch {
    /* not a URL */
  }
  return url;
}

/** One row per word in the list. Stable column order; documented in FEED_README. */
export function buildWordsTsv(words: WordRecord[], since = 0): string {
  const head = ['word', 'status', 'pinyin', 'gloss', 'added', 'updated', 'lookups', 'history', 'sentence', 'source'];
  const rows = words
    .filter((w) => w.updated > since)
    .sort((a, b) => a.added - b.added)
    .map((w) => {
      const c = w.ctx[0];
      const hist = w.hist.map((h) => `${h.s}@${dayKeyLocal(h.t)}`).join('>');
      return [w.w, w.s, w.p, w.g, iso(w.added), iso(w.updated), String(w.looks), hist, c?.text, c ? videoLink(c.url, c.t) : '']
        .map(clean)
        .join('\t');
    });
  return [head.join('\t'), ...rows].join('\n') + '\n';
}

export function buildEventsTsv(logs: LogEvent[], since = 0): string {
  const head = ['time', 'event', 'word', 'detail', 'url'];
  const rows = logs
    .filter((e) => e.at > since)
    .map((e) => {
      switch (e.k) {
        case 'look':
          return [iso(e.at), 'lookup', e.w, e.src, e.url ?? ''];
        case 'status':
          return [iso(e.at), 'status', e.w, `${e.from ?? 'untracked'}>${e.s ?? 'untracked'}`, ''];
        case 'watch':
          return [
            iso(e.at),
            'watch',
            '',
            `${Math.round(e.secs / 60)} min${e.coverage != null ? `, knew ${Math.round(e.coverage * 100)}% of words` : ''}${e.title ? ` | ${e.title}` : ''}`,
            e.url,
          ];
      }
    })
    .map((r) => r.map((x) => clean(x)).join('\t'));
  return [head.join('\t'), ...rows].join('\n') + '\n';
}

/** Anki-friendly CSV: Front = word, Back = pinyin + gloss, plus sentence and source. */
export function buildAnkiCsv(words: WordRecord[]): string {
  const q = (s: string | undefined) => `"${(s ?? '').replace(/"/g, '""')}"`;
  const rows = words.map((w) => {
    const c = w.ctx[0];
    return [w.w, w.p, w.g, c?.text, c ? videoLink(c.url, c.t) : '', w.s].map(q).join(',');
  });
  return ['word,pinyin,meaning,sentence,source,status', ...rows].join('\n') + '\n';
}

export const FEED_README = `# Chinese Brain feed

Written by the Chinese Brain browser extension. Rewritten in place a few
minutes after any change; nothing here needs exporting by hand.

## words.tsv
One row per word in the list (Traditional headword).
- status: fresh (first met, being learned) | difficult (should know, keeps slipping) | known
- pinyin: Taiwan standard reading (MOE dictionary when it differs from CC-CEDICT)
- added / updated: local time, YYYY-MM-DD HH:MM
- lookups: deliberate lookups (clicks, or a popup left open), max once per 10 minutes
- history: every status change, oldest first, e.g. fresh@2026-10-01>difficult@2026-10-05>known@2026-10-20
- sentence / source: the most recent sentence the word was met in, and where (YouTube links jump to the second)

## events.tsv
Append-only log, oldest first: lookups, status changes, and videos watched
(minutes with subtitles on, share of words already known).

## Reading only what is new
Every row has a time. Remember the newest time you processed and next time
read only later rows. Nothing is ever deleted from events.tsv, so this is safe.
`;

/** One Markdown file for Claude: summary, then the words and events as TSV blocks. */
export function buildClaudeMarkdown(words: WordRecord[], logs: LogEvent[], since = 0): string {
  const now = Date.now();
  const changed = words.filter((w) => w.updated > since);
  const evs = logs.filter((e) => e.at > since);
  const looks = evs.filter((e) => e.k === 'look');
  const watches = evs.filter((e) => e.k === 'watch');
  const statusEvs = evs.filter((e) => e.k === 'status') as Extract<LogEvent, { k: 'status' }>[];
  const by = (s: string) => changed.filter((w) => w.s === s).length;
  const slipped = [...new Set(statusEvs.filter((e) => e.s === 'difficult' && e.from && e.from !== 'difficult').map((e) => e.w))];
  const lookCount = new Map<string, number>();
  for (const e of looks) lookCount.set((e as { w: string }).w, (lookCount.get((e as { w: string }).w) ?? 0) + 1);
  const top = [...lookCount].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const mins = Math.round(watches.reduce((n, e) => n + (e as { secs: number }).secs, 0) / 60);
  const lines = [
    '# Chinese Brain export',
    '',
    `Exported ${iso(now)}. ${since ? `Covers everything after ${iso(since)}.` : 'Covers everything recorded so far.'}`,
    '',
    '## Summary',
    `- Words added or changed: ${changed.length} (now ${by('fresh')} fresh, ${by('difficult')} difficult, ${by('known')} known)`,
    `- Whole list: ${words.length} words (${words.filter((w) => w.s === 'known').length} known)`,
    `- Deliberate lookups: ${looks.length} (YouTube ${looks.filter((e) => (e as { src: string }).src === 'yt').length}, web ${looks.filter((e) => (e as { src: string }).src === 'web').length})`,
    `- Videos watched with subtitles: ${watches.length} (${mins} min)`,
    slipped.length ? `- Slipped back to difficult: ${slipped.join('、')}` : '',
    top.length ? `- Most looked up: ${top.map(([w, n]) => (n > 1 ? `${w} ×${n}` : w)).join('、')}` : '',
    '',
    'Statuses: fresh = met recently and learning; difficult = should know but keeps slipping; known = known. Pinyin is the Taiwan standard reading.',
    '',
    '## Words',
    '```tsv',
    buildWordsTsv(words, since).trimEnd(),
    '```',
    '',
    '## Events',
    '```tsv',
    buildEventsTsv(logs, since).trimEnd(),
    '```',
    '',
  ];
  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n');
}
