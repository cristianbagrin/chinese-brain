export interface Cue {
  start: number;
  end: number;
  text: string;
}

export interface TrackInfo {
  languageCode: string;
  kind?: string;
  name: string;
  vssId?: string;
  isTranslatable?: boolean;
}

/** Parse a timedtext body (json3, srv3/XML or WebVTT) into cues in seconds. */
export function parseTimedText(body: string): Cue[] {
  const t = body.trimStart();
  // Rate-limit and error responses come back as HTML pages; they are not captions.
  if (/^<(!doctype|html)/i.test(t)) return [];
  if (t.startsWith('{')) return parseJson3(t);
  if (t.startsWith('WEBVTT')) return parseVtt(t);
  if (t.startsWith('<')) return parseXml(t);
  return [];
}

function parseJson3(body: string): Cue[] {
  const data = JSON.parse(body) as {
    events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[]; aAppend?: number }[];
  };
  const cues: Cue[] = [];
  for (const ev of data.events ?? []) {
    if (!ev.segs || ev.aAppend) continue;
    const text = ev.segs
      .map((s) => s.utf8 ?? '')
      .join('')
      .replace(/\s*\n\s*/g, ' ')
      .trim();
    if (!text) continue;
    const start = (ev.tStartMs ?? 0) / 1000;
    cues.push({ start, end: start + (ev.dDurationMs ?? 2000) / 1000, text });
  }
  return tidy(cues);
}

function decodeEntities(s: string): string {
  return new DOMParser().parseFromString(s, 'text/html').documentElement.textContent ?? s;
}

function parseXml(body: string): Cue[] {
  const doc = new DOMParser().parseFromString(body, 'text/xml');
  const cues: Cue[] = [];
  // srv3: <p t="ms" d="ms">; legacy: <text start="s" dur="s">
  for (const p of doc.querySelectorAll('p')) {
    const text = (p.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const start = Number(p.getAttribute('t')) / 1000;
    cues.push({ start, end: start + Number(p.getAttribute('d') ?? 2000) / 1000, text });
  }
  for (const p of doc.querySelectorAll('text')) {
    const text = decodeEntities(p.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const start = Number(p.getAttribute('start'));
    cues.push({ start, end: start + Number(p.getAttribute('dur') ?? 2), text });
  }
  return tidy(cues);
}

function parseVtt(body: string): Cue[] {
  const cues: Cue[] = [];
  const ts = (s: string) => {
    const parts = s.trim().split(':').map(Number);
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  };
  for (const block of body.split(/\n\n+/)) {
    const m = /([\d:.]+)\s+-->\s+([\d:.]+)[^\n]*\n([\s\S]+)/.exec(block);
    if (!m) continue;
    const text = m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text) cues.push({ start: ts(m[1]), end: ts(m[2]), text });
  }
  return tidy(cues);
}

/** Sort, drop exact repeats (auto-captions roll), and clip overlaps. */
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/**
 * Caption text as shown: no markup (uploaders put <font>, <i>, <b> in captions),
 * entities decoded, invisible characters removed, whitespace collapsed.
 */
export function cleanText(s: string): string {
  return s
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[\u200b-\u200f\u2028\u2029\ufeff\u00ad]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lines that are only a sound label, like [音樂] or (Music). */
const SOUND_ONLY = /^[\[(（【♪♫\s]*(音樂|音乐|掌聲|笑聲|music|applause|laughter|♪|♫)[\])）】♪♫\s]*$/i;

function tidy(cues: Cue[]): Cue[] {
  cues = cues
    .map((c) => ({ ...c, text: cleanText(c.text) }))
    .filter((c) => c.text && !SOUND_ONLY.test(c.text) && Number.isFinite(c.start) && Number.isFinite(c.end) && c.end >= c.start);
  cues.sort((a, b) => a.start - b.start);
  const out: Cue[] = [];
  for (const c of cues) {
    const prev = out[out.length - 1];
    if (prev && prev.text === c.text && c.start - prev.end < 0.5) {
      prev.end = Math.max(prev.end, c.end);
      continue;
    }
    if (prev && prev.end > c.start) prev.end = Math.max(prev.start + 0.3, c.start);
    out.push({ ...c });
  }
  return out;
}

/** For each source cue, the translation text that overlaps it most. */
export function alignTranslation(src: Cue[], tr: Cue[]): string[] {
  let j = 0;
  return src.map((c) => {
    while (j < tr.length && tr[j].end <= c.start) j++;
    const parts: string[] = [];
    let best = '';
    let bestOverlap = 0;
    for (let k = j; k < tr.length && tr[k].start < c.end; k++) {
      const t = tr[k];
      const overlap = Math.min(c.end, t.end) - Math.max(c.start, t.start);
      const mid = (t.start + t.end) / 2;
      if (mid >= c.start && mid < c.end) parts.push(t.text);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = t.text;
      }
    }
    return parts.length ? parts.join(' ') : best;
  });
}

/** Index of the cue showing at time t, or -1. Cues are sorted by start. */
export function cueAt(cues: Cue[], t: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (ans >= 0 && t < cues[ans].end) return ans;
  return -1;
}

/** Last cue that started at or before t (for "previous/next line" navigation). */
export function cueBefore(cues: Cue[], t: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

const ZH_ORDER = ['zh-TW', 'zh-Hant', 'zh-HK', 'zh', 'zh-Hans', 'zh-CN', 'zh-SG'];

/** Best Chinese track: manual Traditional first, auto-generated last. */
export function pickChinese(tracks: TrackInfo[]): TrackInfo | undefined {
  const zh = tracks.filter((t) => /^zh\b/i.test(t.languageCode));
  const score = (t: TrackInfo) => {
    const i = ZH_ORDER.findIndex((c) => c.toLowerCase() === t.languageCode.toLowerCase());
    return (t.kind === 'asr' ? 100 : 0) + (i < 0 ? 50 : i);
  };
  return zh.sort((a, b) => score(a) - score(b))[0];
}

export function pickTranslation(tracks: TrackInfo[], lang: string): TrackInfo | undefined {
  return tracks.find((t) => t.languageCode.split('-')[0] === lang && t.kind !== 'asr');
}

/** Language info from a timedtext URL. */
export function urlInfo(url: string): { lang: string; tlang: string; kind: string; v: string } {
  const u = new URL(url);
  return {
    lang: u.searchParams.get('lang') ?? '',
    tlang: u.searchParams.get('tlang') ?? '',
    kind: u.searchParams.get('kind') ?? '',
    v: u.searchParams.get('v') ?? '',
  };
}

const HAN = /[㐀-䶿一-鿿豈-﫿]/;
const latinWords = (s: string) => (s.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) ?? []).length;

/**
 * Split an uploader's English note off a Chinese caption, e.g.
 * "一個(胡椒餅) (Note: locals usually omit the food name.)" -> text "一個(胡椒餅)", note
 * "Note: locals usually omit the food name." Only English that is clearly an
 * aside moves: a bracketed run of 4+ English words, or a trailing "Note: …".
 * English words that are part of the sentence ("我去 Costco 買") stay where they are.
 */
export function splitNote(line: string): { text: string; note: string } {
  const notes: string[] = [];
  let text = line.replace(/[(（[［【]([^()（）[\]［］【】]*)[)）\]］】]/g, (all, inner: string) => {
    if (HAN.test(inner) || latinWords(inner) < 4) return all;
    notes.push(inner.trim());
    return ' ';
  });
  text = text.replace(/(?<![A-Za-z])(?:note|n\.b\.|p\.?s\.?)\s*[:：][^㐀-䶿一-鿿豈-﫿]*$/i, (note) => {
    if (latinWords(note) < 3) return note;
    notes.push(note.trim());
    return '';
  });
  if (!notes.length) return { text: line, note: '' };
  return { text: text.replace(/\s+/g, ' ').trim(), note: notes.join(' ') };
}

/** The same note removed from the English line (YouTube's translation repeats it). */
export function stripNote(tr: string, note: string): string {
  const words = note.match(/[A-Za-z0-9]+/g);
  if (!tr || !words || words.length < 3) return tr;
  const re = new RegExp(`[(（[]?\\s*${words.join("[^A-Za-z0-9]+")}[^A-Za-z0-9()（）[\\]]*[)）\\]]?`, 'i');
  return tr.replace(re, ' ').replace(/\s+/g, ' ').trim();
}
