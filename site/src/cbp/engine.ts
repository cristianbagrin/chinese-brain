// Chinese Brain Plus: Chris's Chinese engine, ported line for line from life/chinese/words.py.
// It works on the same texts the Python reads (known-words.txt, learn-next.md, test-log.tsv, the sprint
// files, the Chinese Brain exports, data/*.tsv), kept in the CBP database's `files` table, so both give the
// same answer from the same data (tests/cbp-engine.test.ts and scripts/cbp-parity.ts check that).
// Pure: no I/O. A Files object goes in; what changed comes back in it.

export type Files = Map<string, string>;

export const TOCFL_DATE = '2026-12-12';
export const LOGGED_FROM = '2026-10-28';
export const TEST_EVERY = 5;
export const LANES: Record<string, string> = { Life: 'life', Taiwan: 'tw', Test: 'test' };
const LANE_NAMES = Object.keys(LANES);
const NEXT_PATTERN = ['Life', 'Taiwan', 'Life', 'Test', 'Life', 'Taiwan', 'Life', 'Test', 'Life', 'Taiwan', 'Life', 'Test'];
const ADJ = /^[+-]\d+(\.\d+)?$/;
export const TEST_KINDS = ['new', 'old', 'leak', 'burst'];
export const WRITING_KINDS = ['free', 'essay'];
export const RESULTS = ['pass', 'partial', 'fail', 'none'];
const SOURCE_WEIGHT: Record<string, number> = {
  Chris: 4, test: 3, essay: 3, free: 3, '動齡': 3,
  Todoist: 2, notes: 2, saved: 2, video: 2,
  Brain: 1, reader: 1, sweep: 1, Lexirise: 1, TOCFL: 0,
};

export const KW = 'known-words.txt';
export const LN = 'learn-next.md';
export const LOG = 'test-log.tsv';
export const FREQ = 'data/zh-freq.tsv';
export const TOC = 'data/tocfl.tsv';
export const ANKI = 'anki/latest.txt';
export const BOARD_DATA = 'board/data.json';

// ---------- Python's ways, where JavaScript differs ----------
export const key = (w: string) => w.trim().replaceAll('臺', '台');
export function plus(d: string, n: number) {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
/** Python's str < str: by code point (JavaScript's < compares UTF-16 units). */
export function cmp(a: string, b: string) {
  const x = [...a], y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
    if (d) return d;
  }
  return x.length - y.length;
}
/** Python's round(x, n): the exact binary value, ties to even. */
export function pyRound(x: number, n: number) {
  const [int, frac = ''] = exactDecimal(Math.abs(x)).split('.');
  const kept = BigInt(int + frac.slice(0, n).padEnd(n, '0'));
  const tail = frac.slice(n).replace(/0+$/, '');
  // the exact value against the halfway point: above rounds up, below down, exactly on it to even
  const up = tail === '' ? false : tail[0] > '5' || (tail[0] === '5' && (tail.length > 1 || kept % 2n === 1n));
  const v = Number(up ? kept + 1n : kept) / 10 ** n;
  return x < 0 ? -v : v;
}
function exactDecimal(x: number) {
  // x = mantissa * 2^e exactly; write it in base 10 with BigInt
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, x);
  const hi = buf.getUint32(0), lo = buf.getUint32(4);
  const expBits = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let e: number;
  if (expBits === 0) e = -1074;
  else { mant |= 1n << 52n; e = expBits - 1075; }
  if (e >= 0) return (mant << BigInt(e)).toString();
  const scaled = mant * 5n ** BigInt(-e); // mant * 2^e = mant * 5^-e / 10^-e
  const digits = scaled.toString().padStart(-e + 1, '0');
  return digits.slice(0, digits.length + e) + '.' + digits.slice(digits.length + e);
}
/** Python's str(float): 3.0, 4.5, 7.1. */
export const pyFloat = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
const lines = (t: string) => t.split('\n');

// ---------- known-words.txt ----------
export function loadKw(files: Files) {
  const l = lines(files.get(KW) ?? '');
  if (l.length && l[l.length - 1] === '') l.pop();
  return l;
}
export function kwIndex(l: string[]) {
  const idx = new Map<string, number>();
  l.forEach((x, i) => {
    if (!x.trim() || x.startsWith('#')) return;
    idx.set(key(x.split('\t')[0]), i);
  });
  return idx;
}
export function kwGet(l: string[], i: number): [string, string, string] {
  const p = [...l[i].split('\t'), '', ''];
  return [p[0], p[1], p[2]];
}
export const kwTotal = (l: string[]) => l.filter((x) => x.trim() && !x.startsWith('#')).length;
export const kwSave = (files: Files, l: string[]) => files.set(KW, l.join('\n') + '\n');
export function kwStatus(l: string[]) {
  const out = new Map<string, [string, string]>();
  for (const i of kwIndex(l).values()) {
    const [w, s, d] = kwGet(l, i);
    out.set(key(w), [s, d]);
  }
  return out;
}

// ---------- data: frequency and the TOCFL list ----------
const freqMemo = new WeakMap<object, { f: Map<string, number>; t2s: Map<string, string> }>();
const tocMemo = new WeakMap<object, Map<string, string>>();
function freqData(files: Files) {
  let m = freqMemo.get(files);
  if (!m) {
    const f = new Map<string, number>(), t2s = new Map<string, string>();
    for (const l of lines(files.get(FREQ) ?? '')) {
      if (l.startsWith('#') || !l) continue;
      const [a, b] = l.split('\t');
      if (a.startsWith('~')) t2s.set(a.slice(1), b);
      else f.set(a, parseFloat(b));
    }
    m = { f, t2s };
    freqMemo.set(files, m);
  }
  return m;
}
const simp = (files: Files, w: string) => {
  const { t2s } = freqData(files);
  return [...key(w)].map((c) => t2s.get(c) ?? c).join('');
};
export function zipf(files: Files, word: string): number | null {
  const { f } = freqData(files);
  if (!f.size) return null;
  const s = [...simp(files, word)];
  const whole = s.join('');
  if (f.has(whole)) return f.get(whole)!;
  let inv = 0, i = 0, n = 0;
  while (i < s.length) {
    let found = false;
    for (let j = Math.min(s.length, i + 6); j > i; j--) {
      const piece = s.slice(i, j).join('');
      if (f.has(piece)) {
        inv += 1 / 10 ** (f.get(piece)! - 9);
        n += 1;
        i = j;
        found = true;
        break;
      }
    }
    if (!found) return null;
  }
  return pyRound(Math.log10(1 / inv / 10 ** (n - 1)) + 9, 2);
}
export const listed = (files: Files, word: string) => freqData(files).f.has(simp(files, word));
export function tocfl(files: Files) {
  let m = tocMemo.get(files);
  if (!m) {
    m = new Map();
    for (const l of lines(files.get(TOC) ?? '')) {
      if (!l.startsWith('#') && l.trim()) {
        const p = l.split('\t');
        m.set(p[0], p[1]);
      }
    }
    tocMemo.set(files, m);
  }
  return m;
}

// ---------- test-log.tsv ----------
export type Row = { i: number; date: string; target: string; kind: string; result: string; note: string };
export function readLog(files: Files): Row[] {
  const rows: Row[] = [];
  lines(files.get(LOG) ?? '').forEach((l, i) => {
    if (i === 0 || !l.trim()) return;
    const p = [...l.split('\t'), '', '', '', '', ''];
    rows.push({ i, date: p[0].trim(), target: p[1].trim(), kind: p[2].trim(), result: p[3].trim(), note: p[4].trim() });
  });
  return rows;
}
export function appendLog(files: Files, rows: Partial<Row>[]) {
  let text = files.get(LOG) ?? '';
  if (text && !text.endsWith('\n')) text += '\n';
  text += rows.map((r) => [r.date, r.target, r.kind, r.result || '-', (r.note ?? '').replaceAll('\t', ' ').replaceAll('\n', ' ')].join('\t') + '\n').join('');
  files.set(LOG, text);
}

export class Item {
  active = false; due: string | null = null; streak = 0; fails = 0;
  tries: string[] = []; lastTest: string | null = null; burst = false; retired: string | null = null; form = '';
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  activate(d: string, res: string, tested: boolean) {
    this.active = true; this.retired = null; this.due = plus(d, 3); this.streak = 0;
    this.fails = res === 'fail' && tested ? 1 : 0;
    this.tries = tested ? [res[0]] : [];
    this.burst = false;
  }
}
const sortRows = (a: Row, b: Row) => cmp(a.date, b.date) || a.i - b.i;
export function schedule(rows: Row[]) {
  const items = new Map<string, Item>();
  const it = (name: string) => {
    if (!items.has(name)) items.set(name, new Item(name));
    return items.get(name)!;
  };
  const seeds = rows.filter((r) => r.kind === 'seed').map((r) => r.i);
  const live = rows.filter((r) => !seeds.length || r.i >= seeds[0]);
  for (const r of rows) if (r.kind === 'form') it(r.target).form = r.note;
  const events: Row[] = live.filter((r) => r.kind === 'seed');
  const bursts = new Map<string, Row>();
  for (const r of live.filter((r) => r.kind !== 'seed').sort(sortRows)) {
    if (r.kind === 'burst') {
      const k = r.target + '\u0000' + r.date;
      if (!bursts.has(k)) {
        bursts.set(k, { ...r });
        events.push(bursts.get(k)!);
      } else if (r.result !== 'pass') {
        const b = bursts.get(k)!;
        b.result = [b.result, r.result].includes('fail') ? 'fail' : 'partial';
      }
    } else events.push(r);
  }
  for (const e of events) {
    const k = e.kind, d = e.date, res = e.result, x = it(e.target);
    if (k === 'seed') {
      const v: Record<string, string> = {};
      for (const m of e.note.matchAll(/(\w+)=(\S*)/g)) v[m[1]] = m[2];
      x.active = true; x.due = v.due ?? null; x.streak = parseInt(v.streak ?? '0'); x.fails = parseInt(v.fails ?? '0');
      x.tries = [...(v.tries ?? '')]; x.lastTest = v.last || null;
      x.burst = x.fails >= 3;
    } else if (k === 'retire') {
      x.active = false; x.retired = d; x.burst = false;
    } else if (TEST_KINDS.includes(k) && ['pass', 'partial', 'fail'].includes(res)) {
      x.lastTest = maxStr(x.lastTest ?? d, d);
      if (!x.active) {
        if (res !== 'pass') x.activate(d, res, true);
        continue;
      }
      if (res === 'pass') {
        if (k !== 'burst' && cmp(d, x.due!) < 0) {
          x.fails = 0;
          continue;
        }
        x.tries.push('s');
        x.fails = 0; x.burst = false;
        if (x.streak >= 1) { x.active = false; x.retired = d; }
        else { x.streak = 1; x.due = plus(d, 7); }
      } else {
        x.tries.push(res[0]);
        x.due = plus(d, 3); x.streak = 0;
        x.fails = res === 'fail' ? x.fails + 1 : 0;
        x.burst = x.fails >= 3;
      }
    } else if (WRITING_KINDS.includes(k) && ['partial', 'fail'].includes(res)) {
      if (x.lastTest && cmp(d, x.lastTest) < 0) continue;
      if (x.active) { x.due = minStr(x.due!, plus(d, 3)); x.streak = 0; }
      else x.activate(d, res, false);
    }
  }
  return items;
}
const maxStr = (a: string, b: string) => (cmp(a, b) >= 0 ? a : b);
const minStr = (a: string, b: string) => (cmp(a, b) <= 0 ? a : b);
export function table(rows: Row[]) {
  return [...schedule(rows).values()].filter((x) => x.active)
    .sort((a, b) => cmp(a.due!, b.due!) || b.fails - a.fails || cmp(a.name, b.name));
}
const lastSent = (rows: Row[]) => {
  const s = rows.filter((r) => r.kind === 'sent').map((r) => r.i);
  return s.length ? s[s.length - 1] : -1;
};
export function waitingTest(rows: Row[]) {
  const sent = rows.filter((r) => r.kind === 'sent').map((r) => r.target);
  const last = sent[sent.length - 1];
  return last !== undefined && !rows.some((r) => r.kind === 'graded' && r.target === last) ? last : null;
}
export function cardsSinceTest(rows: Row[]) {
  const after = lastSent(rows);
  return [...new Set(rows.filter((r) => r.kind === 'card' && r.i > after).map((r) => r.target))];
}

// ---------- learn-next.md: the queue ----------
export type Entry = { word: string; pinyin: string; gloss: string; sources: string[]; raw?: number; score?: number };
type Section = [string, string, Entry[] | string[]];
export class Queue {
  head = '';
  sections: Section[] = [];
  nextUp: [string, string, string, string][] = [];
  changed = false;
  constructor(text: string) {
    const t = lines(text);
    const heads = t.map((l, i) => (l.startsWith('## ') ? i : -1)).filter((i) => i >= 0);
    this.head = heads.length ? t.slice(0, heads[0]).join('\n').replace(/\s+$/, '') : '';
    heads.forEach((h, n) => {
      const end = n + 1 < heads.length ? heads[n + 1] : t.length;
      const title = t[h].slice(3);
      const name = title.split(' (')[0].split(' —')[0].trim();
      const rest = title.includes(' — ') ? title.slice(title.indexOf(' — ') + 3) : '';
      const body = t.slice(h + 1, end);
      if (LANE_NAMES.includes(name)) {
        const entries: Entry[] = [];
        for (const l of body) {
          if (!l.startsWith('- ')) continue;
          const f = l.slice(2).split(' · ');
          entries.push({
            word: f[0].trim(),
            pinyin: f.length > 1 ? f[1] : '',
            gloss: f.length > 4 ? f.slice(2, -2).join(' · ') : f.length > 2 ? f[2] : '',
            sources: f.length > 3 ? f[f.length - 1].split(',').map((s) => s.trim()).filter(Boolean) : [],
          });
        }
        this.sections.push([name, rest, entries]);
      } else if (name !== 'Next up') {
        this.sections.push([name, rest, body.filter((l) => l.trim())]);
      }
    });
  }
  lane(name: string): Entry[] {
    const s = this.sections.find((s) => s[0] === name);
    return (s?.[2] ?? []) as Entry[];
  }
  *entries(): Generator<[string, Entry]> {
    for (const name of LANE_NAMES) for (const e of this.lane(name)) yield [name, e];
  }
  find(word: string): [string | null, Entry | null] {
    const k = key(word);
    for (const [name, e] of this.entries()) if (key(e.word) === k) return [name, e];
    return [null, null];
  }
  parked(word: string) {
    const k = key(word);
    return (this.lane('Parked') as unknown as string[]).some((l) => l.split(' · ').map(key).includes(k));
  }
  remove(word: string) {
    const k = key(word);
    let where: string | null = null;
    for (const s of this.sections) {
      if (LANE_NAMES.includes(s[0])) {
        const n = s[2].length;
        s[2] = (s[2] as Entry[]).filter((e) => key(e.word) !== k);
        if (s[2].length < n) where = s[0];
      } else if (s[0] === 'Parked') {
        s[2] = (s[2] as string[]).map((l) => l.split(' · ').filter((x) => key(x) !== k).join(' · '));
      }
    }
    this.changed = this.changed || !!where;
    return where;
  }
  add(lane: string, word: string, pinyin: string, gloss: string, sources: string[]) {
    const [name, e] = this.find(word);
    if (e) {
      e.sources.push(...sources);
      this.changed = true;
      return `${word}: already in ${name}, +${sources.join(', ')}`;
    }
    this.lane(lane).push({ word: key(word), pinyin, gloss, sources: [...sources] });
    this.changed = true;
    return `${word} → ${lane}`;
  }
  text() {
    const out = [this.head, '', '## Next up', ''];
    this.nextUp.forEach(([w, p, g, lane], n) => out.push(`${n + 1}. ${w} · ${p} · ${g} (${lane})`));
    for (const [name, rest, body] of this.sections) {
      if (LANE_NAMES.includes(name)) {
        out.push('', `## ${name} (${body.length})` + (rest ? ` — ${rest}` : ''), '');
        for (const e of body as Entry[]) out.push(`- ${e.word} · ${e.pinyin} · ${e.gloss} · ${pyFloat(e.score!)} · ${e.sources.join(', ')}`);
      } else {
        const n = name === 'Parked' ? (body as string[]).reduce((a, l) => a + l.split(' · ').filter((x) => x.trim()).length, 0) : null;
        out.push('', `## ${name}` + (n !== null ? ` (${n})` : '') + (rest ? ` — ${rest}` : ''), '');
        out.push(...(body as string[]));
      }
    }
    return out.join('\n').replace(/\n+$/, '') + '\n';
  }
  save(files: Files, today: string) {
    rank(files, this, today);
    files.set(LN, this.text());
  }
}
export const loadQueue = (files: Files) => new Queue(files.get(LN) ?? '');

// ---------- sprints ----------
export const sprintNames = (files: Files) => [...files.keys()].filter((n) => /^[^/]*-sprint\.md$/.test(n)).sort(cmp);
export function sprintFile(files: Files, today: string) {
  const live: [string, string][] = [];
  for (const p of sprintNames(files)) {
    const first = lines(files.get(p)!)[0] + '\n';
    const m = first.match(/\[until (\d{4}-\d{2}-\d{2})\]/);
    const f = first.match(/\[from (\d{4}-\d{2}-\d{2})\]/);
    if (m && cmp(today, m[1]) <= 0 && (!f || cmp(f[1], today) <= 0)) live.push([m[1], p]);
  }
  live.sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]));
  return live.length ? live[0][1] : null;
}
export function sprintRule(files: Files, path: string, name: string) {
  const l = lines(files.get(path)!).find((x) => x.startsWith(`- **${name}**`));
  return l ? l.replace(/^[- ]+/, '').trim() : '';
}
export function sprintCap(files: Files, path: string) {
  const m = files.get(path)!.match(/Retest cap: (\d+)/);
  return m ? parseInt(m[1]) : 1;
}
export function sprintWords(files: Files, path: string): [number, string, string, string, boolean][] {
  const out: [number, string, string, string, boolean][] = [];
  lines(files.get(path)!).forEach((l, i) => {
    const m = l.match(/^\d+\.\s+(.+?) · (.+?) · (.+?) · [A-Z]\b(.*)$/u);
    if (m) out.push([i, m[1].trim(), m[2].trim(), m[3].trim(), m[4].includes('✓')]);
  });
  return out;
}

// ---------- ranking ----------
export function rank(files: Files, q: Queue, today: string) {
  const status = kwStatus(loadKw(files));
  const readable = new Set<string>();
  for (const [w, [s]] of status) if (s === 'K') for (const c of w) readable.add(c);
  const toc = tocfl(files);
  const wanted = [...q.entries()].map(([, e]) => key(e.word));
  for (const [w, lv] of toc) if (['N1', 'N2', '1', '2', '3', '4'].includes(lv) && !status.has(w)) wanted.push(w);
  const charCount = new Map<string, number>();
  for (const w of new Set(wanted)) for (const c of new Set(w)) if (!readable.has(c)) charCount.set(c, (charCount.get(c) ?? 0) + 1);
  const beforeTest = cmp(today, TOCFL_DATE) <= 0;
  for (const [, e] of q.entries()) {
    const w = key(e.word);
    const adj = e.sources.filter((s) => ADJ.test(s)).reduce((a, s) => a + parseFloat(s), 0);
    let weights = e.sources.filter((s) => !ADJ.test(s)).map((s) => SOURCE_WEIGHT[s.split(/\s+/)[0]] ?? 1);
    if (!weights.length) weights = [1];
    const personal = 1.5 * Math.min(5, Math.max(...weights) + 0.5 * (weights.length - 1));
    const L = status.get(w)?.[0] === 'L' ? 4 : 0;
    const z = zipf(files, w);
    let freq = z !== null ? Math.min(3.5, Math.max(0, z - 2.5)) : 0;
    if ([...w].length > 1 && !listed(files, w)) freq = Math.max(freq, 1);
    const lv = toc.get(w);
    const tb = (({ N1: 1.5, N2: 1.5, '1': 1.5, '2': 1.5, '3': 1.5, '4': 1 } as Record<string, number>)[lv ?? ''] ?? 0) * (beforeTest ? 1 : 0.5);
    const fresh = new Set([...w].filter((c) => !readable.has(c)));
    let reading = 0;
    for (const c of fresh) reading += Math.min(1, ((charCount.get(c) ?? 1) - 1) / 6);
    reading = Math.min(2, reading);
    e.raw = pyRound(1 + personal + L + freq + tb + reading + adj, 1);
    e.score = e.raw;
  }
  for (const s of q.sections) if (LANE_NAMES.includes(s[0])) (s[2] as Entry[]).sort((a, b) => b.raw! - a.raw! || cmp(a.word, b.word));
  const sp = sprintFile(files, today);
  if (sp) {
    q.nextUp = sprintWords(files, sp).filter(([, w, , , done]) => !done && status.get(key(w))?.[0] !== 'K').slice(0, 12).map(([, w, p, g]) => [w, p, g, 'Life']);
  } else {
    const tops = Object.fromEntries(LANE_NAMES.map((n) => [n, q.lane(n)[Symbol.iterator]()]));
    q.nextUp = [];
    for (const lane of NEXT_PATTERN) {
      const e = tops[lane].next();
      if (!e.done) q.nextUp.push([e.value.word, e.value.pinyin, e.value.gloss, lane]);
    }
  }
}

// ---------- Chinese Brain exports and the Anki snapshot ----------
export type BrainRow = { word: string; now: string; was: string; date: string; pinyin: string; meaning: string; sentence: string; source: string; saved: string };
export function readExport(text: string): [BrainRow[], string, boolean] {
  const rows: BrainRow[] = [];
  let edate: string | null = null, full = false;
  for (let l of lines(text)) {
    l = l.replace(/\r$/, '');
    if (l.startsWith('#')) {
      const m = l.match(/(\d{4}-\d{2}-\d{2})/);
      if (m && edate === null) edate = m[1];
      if (l.includes('everything so far')) full = true;
      continue;
    }
    if (!l.trim() || l.startsWith('word\t')) continue;
    const p = [...l.split('\t'), ...Array(9).fill('')];
    rows.push({ word: p[0].trim(), now: p[1].trim() || '-', was: p[2].trim() || '-', date: p[3].trim(), pinyin: p[4], meaning: p[5], sentence: p[6], source: p[7], saved: p[8] });
  }
  return [rows, edate ?? '0000-00-00', full];
}
export const exportNames = (files: Files) => [...files.keys()].filter((n) => /^imported\/chinese-brain-.*\.tsv$/.test(n)).sort(cmp);
export function ankiTargets(files: Files) {
  const t = new Set<string>();
  for (const l of lines(files.get(ANKI) ?? '')) {
    if (l.startsWith('#')) continue;
    const p = l.split('\t');
    if (p.length > 1 && p[1].trim()) t.add(key(p[1]));
  }
  return t;
}
export function savedSentences(files: Files, word: string) {
  const k = key(word), out: string[] = [];
  for (const f of exportNames(files)) {
    for (const r of readExport(files.get(f)!)[0]) {
      if (key(r.word) === k && r.saved.trim()) out.push(...r.saved.split('‖').map((x) => x.trim()).filter(Boolean));
    }
  }
  return [...new Set(out)];
}

// ---------- what the commands print ----------
export function statusText(files: Files, today: string) {
  const t = table(readLog(files));
  const out = [`Retest table, ${t.length} items (due · item · tries · right form)`];
  for (const x of t) {
    const flag = cmp(x.due!, today) < 0 ? ' · OVERDUE' : x.due === today ? ' · due' : '';
    out.push(`  ${x.due} · ${x.name} · ${x.tries.slice(-4).join('') || '-'}${x.burst ? ' · BURST' : ''}${flag} · ${x.form || '?'}`);
  }
  return out.join('\n') + '\n';
}

export function testPlanText(files: Files, today: string, allItems = false) {
  const out: string[] = [];
  const rows = readLog(files);
  const w = waitingTest(rows);
  if (w) {
    return `Test ${w} is still on the board, not filed. Pull board/test and run \`words.py ingest\` first; one test at a time.\n`;
  }
  const t = table(rows);
  const sp = sprintFile(files, today);
  const cap = allItems ? null : sp ? sprintCap(files, sp) : 3;
  const due = t.filter((x) => cmp(x.due!, today) <= 0);
  const burst = due.filter((x) => x.burst);
  if (burst.length && !allItems) {
    const x = burst[0];
    return `BURST: ${x.name} failed three tests in a row. The whole test is a burst drill on it: 8–10 fast situations, every one needing the right form (${x.form}).\n`;
  }
  out.push(due.length ? 'Retests due (oldest first):' : 'No retests due.');
  for (const x of cap === null ? due : due.slice(0, cap)) out.push(`  ${x.name} · due ${x.due} · tries ${x.tries.slice(-4).join('') || '-'} · right form: ${x.form || '?'}`);
  if (cap !== null && due.length > cap) out.push(`  (${due.length - cap} more due; they wait for the next test)`);
  const taught = new Set([...ankiTargets(files), ...rows.filter((r) => r.kind === 'card').map((r) => key(r.target))]);
  const names = new Set(t.map((x) => x.name));
  const st = kwStatus(loadKw(files));
  const waiting = [...st].filter(([w, [s, d]]) => s === 'L' && taught.has(w) && cmp(d, plus(today, -14)) <= 0 && !names.has(w))
    .map(([w, [, d]]) => [d, w] as [string, string]).sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]));
  const n = allItems ? 2 : 1;
  if (waiting.length) {
    out.push(`Delayed check (${waiting.length} L words taught 2+ weeks ago; oldest first):`);
    for (const [d, w] of waiting.slice(0, n)) out.push(`  ${w} · taught or last changed ${d}`);
  }
  const since = cardsSinceTest(rows).filter((w) => st.get(key(w))?.[0] !== 'K');
  out.push('Cards since the last test: ' + (since.length ? since.join(' · ') : 'none'));
  if (sp) out.push(`Sprint on (${sp}): ${sprintRule(files, sp, 'Tests') || 'see its file'}`);
  return out.join('\n') + '\n';
}

/** Every field the board reads from board/data that the engine owns. */
export function boardPayload(files: Files, today: string) {
  const l = loadKw(files), rows = readLog(files);
  const q = loadQueue(files);
  rank(files, q, today);
  const old = JSON.parse(files.get(BOARD_DATA) ?? '{}');
  const words: Record<string, number> = {}, tests: Record<string, [number, number]> = {};
  for (const [d, n] of Object.entries(old.words ?? {})) if (cmp(d, LOGGED_FROM) < 0) words[d] = n as number;
  for (const [d, v] of Object.entries(old.tests ?? {})) if (cmp(d, LOGGED_FROM) < 0) tests[d] = v as [number, number];
  for (const r of rows) {
    if (cmp(r.date, LOGGED_FROM) < 0) continue;
    if (r.kind === 'card') words[r.date] = (words[r.date] ?? 0) + 1;
    else if (TEST_KINDS.includes(r.kind) && ['pass', 'partial', 'fail'].includes(r.result)) {
      const [p, g] = tests[r.date] ?? [0, 0];
      tests[r.date] = [p + (r.result === 'pass' ? 1 : 0), g + 1];
    }
  }
  return { total: kwTotal(l), nextUp: q.nextUp.map(([w, p, g, lane]) => [w, p, g, LANES[lane]]), words, tests, updated: today };
}

/** Python's json.dumps(x, ensure_ascii=False, indent=1), for comparing with push.json. */
export function pyJson(x: unknown, indent = 1, level = 0): string {
  const pad = ' '.repeat(indent * (level + 1)), end = ' '.repeat(indent * level);
  if (Array.isArray(x)) return x.length ? '[\n' + x.map((v) => pad + pyJson(v, indent, level + 1)).join(',\n') + '\n' + end + ']' : '[]';
  if (x && typeof x === 'object') {
    const e = Object.entries(x);
    return e.length ? '{\n' + e.map(([k, v]) => pad + JSON.stringify(k) + ': ' + pyJson(v, indent, level + 1)).join(',\n') + '\n' + end + '}' : '{}';
  }
  return JSON.stringify(x);
}

// ---------- changes (used once the website is the source) ----------
/** words.py card: the word is being taught today. */
export function card(files: Files, word: string, today: string) {
  const out = [];
  const sents = savedSentences(files, word);
  out.push(sents.length ? 'His saved sentences (put them first in the card):' : 'No saved sentences.');
  for (const s of sents) out.push('  ' + s);
  const l = loadKw(files), idx = kwIndex(l), k = key(word);
  if (idx.has(k)) l[idx.get(k)!] = `${kwGet(l, idx.get(k)!)[0]}\tL\t${today}`;
  else l.push(`${k}\tL\t${today}`);
  kwSave(files, l);
  appendLog(files, [{ date: today, target: k, kind: 'card', result: '-', note: '' }]);
  const q = loadQueue(files);
  const where = q.remove(word);
  const sp = sprintFile(files, today);
  if (sp) {
    const text = lines(files.get(sp)!);
    for (const [i, w, , , done] of sprintWords(files, sp)) {
      if (key(w) === k && !done) {
        text[i] += ' ✓';
        files.set(sp, text.join('\n'));
      }
    }
  }
  q.save(files, today);
  const n = cardsSinceTest(readLog(files)).length;
  out.push(`${word} → L ${today}` + (where ? `; out of ${where}` : ''));
  out.push('Suggested next: ' + q.nextUp.slice(0, 3).map(([w, p, g]) => `${w} (${p} — ${g})`).join(' · '));
  const waiting = waitingTest(readLog(files));
  if (waiting) out.push(`TEST WAITING: ${waiting} is on the board.`);
  else if (n >= TEST_EVERY) out.push(`TEST DUE: ${n} cards since the last test.`);
  else out.push(`${n} of ${TEST_EVERY} cards toward the next test.`);
  return out.join('\n');
}

/** words.py add: queue words, one [lane, 'word · pinyin · gloss · source'] each. */
export function addWords(files: Files, items: [string, string][], today: string) {
  const q = loadQueue(files), st = kwStatus(loadKw(files)), out = [];
  for (const [lane, line] of items) {
    const f = line.replace(/^[- ]+/, '').split(' · ').map((x) => x.trim());
    if (f.length >= 2 && /^\d+$/.test(f[f.length - 2])) f.splice(f.length - 2, 1);
    const word = f[0], sources = f[f.length - 1].split(',').map((s) => s.trim());
    if (st.get(key(word))?.[0] === 'K') { out.push(`skip ${word}: already K`); continue; }
    out.push(q.add(lane.trim(), word, f.length > 2 ? f[1] : '', f.slice(2, -1).join(' · '), sources));
  }
  q.save(files, today);
  return out.join('\n');
}

/** words.py log (file_rows): graded rows in, known-word flips applied. */
export function logRows(files: Files, rows: Partial<Row>[]) {
  appendLog(files, rows);
  const l = loadKw(files), idx = kwIndex(l), flips = [];
  for (const r of rows) {
    const k = key(r.target!);
    if (!idx.has(k) || !['pass', 'fail'].includes(r.result!)) continue;
    const [w, s, d] = kwGet(l, idx.get(k)!);
    if (r.result === 'pass' && s === 'L' && cmp(r.date!, plus(d, 14)) >= 0) { l[idx.get(k)!] = `${w}\tK\t${r.date}`; flips.push(`${w} L→K`); }
    else if (r.result === 'fail' && s === 'K' && TEST_KINDS.includes(r.kind!)) { l[idx.get(k)!] = `${w}\tL\t${r.date}`; flips.push(`${w} K→L`); }
  }
  if (flips.length) kwSave(files, l);
  return `Logged ${rows.length} row(s).` + (flips.length ? ` Known words: ${flips.join(', ')}.` : '');
}
