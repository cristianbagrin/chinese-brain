import { numberedToMarked } from './pinyin.ts';

/** How readings are written: 注音 (Zhuyin, Bopomofo; Taiwan's own) or Hanyu Pinyin. */
export type Pron = 'zhuyin' | 'pinyin';
export const PRONS: Pron[] = ['zhuyin', 'pinyin'];
export const PRON_LABEL: Record<Pron, string> = { zhuyin: '注音', pinyin: 'Pinyin' };

const INITIALS: Record<string, string> = {
  b: 'ㄅ', p: 'ㄆ', m: 'ㄇ', f: 'ㄈ', d: 'ㄉ', t: 'ㄊ', n: 'ㄋ', l: 'ㄌ', g: 'ㄍ', k: 'ㄎ', h: 'ㄏ',
  j: 'ㄐ', q: 'ㄑ', x: 'ㄒ', zh: 'ㄓ', ch: 'ㄔ', sh: 'ㄕ', r: 'ㄖ', z: 'ㄗ', c: 'ㄘ', s: 'ㄙ',
};

/** Finals in their full (zero-initial) spelling: iou, uei, uen, ü… */
const FINALS: Record<string, string> = {
  a: 'ㄚ', o: 'ㄛ', e: 'ㄜ', ê: 'ㄝ', ai: 'ㄞ', ei: 'ㄟ', ao: 'ㄠ', ou: 'ㄡ',
  an: 'ㄢ', en: 'ㄣ', ang: 'ㄤ', eng: 'ㄥ', ong: 'ㄨㄥ', er: 'ㄦ',
  i: 'ㄧ', ia: 'ㄧㄚ', io: 'ㄧㄛ', ie: 'ㄧㄝ', iai: 'ㄧㄞ', iao: 'ㄧㄠ', iou: 'ㄧㄡ',
  ian: 'ㄧㄢ', in: 'ㄧㄣ', iang: 'ㄧㄤ', ing: 'ㄧㄥ', iong: 'ㄩㄥ',
  u: 'ㄨ', ua: 'ㄨㄚ', uo: 'ㄨㄛ', uai: 'ㄨㄞ', uei: 'ㄨㄟ', uan: 'ㄨㄢ', uen: 'ㄨㄣ', uang: 'ㄨㄤ', ueng: 'ㄨㄥ',
  ü: 'ㄩ', üe: 'ㄩㄝ', üan: 'ㄩㄢ', ün: 'ㄩㄣ',
};

/** Syllables with no vowel, or spelled outside the usual pattern (interjections). */
const WHOLE: Record<string, string> = { er: 'ㄦ', m: 'ㄇ', n: 'ㄣ', ng: 'ㄫ', hm: 'ㄏㄇ', hng: 'ㄏㄫ', ê: 'ㄝ', eh: 'ㄝ' };

/** zh ch sh r z c s + "i": the vowel is the initial itself (知 ㄓ, 四 ㄙ), with no ㄧ. */
const BUZZ = new Set(['zh', 'ch', 'sh', 'r', 'z', 'c', 's']);
const PALATAL = new Set(['j', 'q', 'x']);

/** Tone marks after the syllable; the neutral tone's dot goes before it. First tone has none. */
export const TONE_MARK = ['', '', 'ˊ', 'ˇ', 'ˋ', '˙'];

/** Toneless pinyin, lowercase ("zhong", "lü", "yuan") -> its zhuyin letters, or null if it isn't a syllable. */
export function zhuyinLetters(raw: string): string | null {
  let s = raw.toLowerCase().replace(/u:|v/g, 'ü');
  if (WHOLE[s]) return WHOLE[s];
  // y- and w- only spell a syllable with no initial.
  const yw = s[0] === 'y' || s[0] === 'w';
  if (s[0] === 'y') s = s.startsWith('yu') ? `ü${s.slice(2)}` : s.startsWith('yi') ? s.slice(1) : `i${s.slice(1)}`;
  else if (s[0] === 'w') s = s.startsWith('wu') ? s.slice(1) : `u${s.slice(1)}`;
  const m = /^(zh|ch|sh|[bpmfdtnlgkhjqxrzcs])?([a-zü]*)$/.exec(s);
  if (!m) return null;
  const ini = m[1] ?? '';
  let fin = m[2];
  if (!fin) return null;
  if (BUZZ.has(ini) && fin === 'i') return INITIALS[ini];
  // After j q x (and as yu-), u is ü.
  if (PALATAL.has(ini) && fin[0] === 'u') fin = `ü${fin.slice(1)}`;
  // Spelled short after an initial: liu = l+iou, gui = g+uei, lun = l+uen; nue/lue are nüe/lüe.
  if (ini) fin = fin === 'iu' ? 'iou' : fin === 'ui' ? 'uei' : fin === 'un' ? 'uen' : fin === 'ue' ? 'üe' : fin;
  const z = FINALS[fin];
  if (!z) return null;
  // No initial: i-, u- and ü- finals are always spelled with y or w (yi, wu, yu), the rest never.
  if (!ini) return /^[iuü]/.test(fin) === yw && fin !== 'ong' ? z : null;
  if (!allowed(ini, fin)) return null;
  return INITIALS[ini] + z;
}

/** Which initials take which finals (enough to tell real syllables from strings that only look like them). */
function allowed(ini: string, fin: string): boolean {
  const iFinal = fin[0] === 'i';
  const uFinal = fin[0] === 'u';
  const üFinal = fin[0] === 'ü';
  if (fin === 'er' || fin === 'ê' || fin === 'iai' || fin === 'io') return false;
  if (PALATAL.has(ini)) return iFinal || üFinal;
  if (üFinal) return (ini === 'n' || ini === 'l') && (fin === 'ü' || fin === 'üe');
  if (fin === 'ia') return ini === 'd' || ini === 'l';
  if (iFinal) return /^[bpmdtnl]$/.test(ini) && fin !== 'iong';
  if (fin === 'o') return /^[bpmfl]$/.test(ini);
  if (fin === 'ueng') return false;
  if (uFinal && /^[bpmf]$/.test(ini)) return fin === 'u';
  return true;
}

/** "zhong1" -> { letters: "ㄓㄨㄥ", tone: 1 }; erhua ("dianr3") keeps its ㄦ apart. Null if not a numbered syllable. */
export function parseNumbered(syl: string): { letters: string; tone: number; er: boolean } | null {
  const m = /^([a-zA-Z:üÜêÊ]+)([1-5])$/.exec(syl.trim());
  if (!m) return null;
  const base = m[1].toLowerCase();
  const tone = Number(m[2]);
  // 兒 written onto the syllable before it (CC-CEDICT also writes it on its own, as r5).
  if (base === 'r') return { letters: '', tone, er: true };
  const z = zhuyinLetters(base);
  if (z) return { letters: z, tone, er: false };
  if (base.length > 2 && base.endsWith('r')) {
    const b = zhuyinLetters(base.slice(0, -1));
    if (b) return { letters: b, tone, er: true };
  }
  return null;
}

/** One numbered syllable in zhuyin: "ma3" -> "ㄇㄚˇ", "ma5" -> "˙ㄇㄚ", "r5" -> "ㄦ". Anything else as it is. */
export function syllableToZhuyin(syl: string): string {
  const p = parseNumbered(syl);
  if (!p) return syl;
  if (!p.letters) return 'ㄦ';
  const body = p.tone === 5 ? `˙${p.letters}` : p.letters + TONE_MARK[p.tone];
  return p.er ? `${body}ㄦ` : body;
}

/** "zhong1 wen2" -> "ㄓㄨㄥ ㄨㄣˊ": one group per character, spaced, as Taiwan writes it on a line. */
export function numberedToZhuyin(py: string): string {
  const out: string[] = [];
  for (const s of py.split(/\s+/).filter(Boolean)) {
    // Erhua written apart (r5) joins the syllable before it: 一點兒 ㄧˋ ㄉㄧㄢˇㄦ.
    if (/^r[1-5]$/i.test(s) && out.length) out[out.length - 1] += 'ㄦ';
    else out.push(syllableToZhuyin(s));
  }
  return out.join(' ');
}

/** The pieces for drawing a syllable as Taiwan does, in a column beside its character. */
export interface ZhuyinParts {
  /** The letters, top to bottom (with the neutral tone's dot first). */
  letters: string;
  /** ˊ ˇ ˋ beside the last letter, or "". */
  tone: string;
  /** Erhua's ㄦ, after the tone. */
  er: string;
}
export function zhuyinParts(syl: string): ZhuyinParts | null {
  const p = parseNumbered(syl);
  if (!p) return null;
  if (!p.letters) return { letters: 'ㄦ', tone: '', er: '' };
  return { letters: p.tone === 5 ? `˙${p.letters}` : p.letters, tone: p.tone === 5 ? '' : TONE_MARK[p.tone], er: p.er ? 'ㄦ' : '' };
}

// ---------- Pinyin with tone marks (as words are saved) ----------

const COMBINING_TONE: Record<string, number> = { '̄': 1, '́': 2, '̌': 3, '̀': 4 };

/** "zhōng" -> "zhong1", "ma" -> "ma5", "lǜ" -> "lü4", "ń" -> "n2". */
export function markedToNumbered(syl: string): string {
  let tone = 5;
  const bare = syl
    .normalize('NFD')
    .replace(/[̀́̄̌]/g, (c) => {
      tone = COMBINING_TONE[c];
      return '';
    })
    .normalize('NFC')
    .toLowerCase();
  return `${bare}${tone}`;
}

const isSyllable = (s: string) => zhuyinLetters(s) != null;
const toneCount = (s: string) => (s.normalize('NFD').match(/[̀́̄̌]/g) ?? []).length;
const toneless = (s: string) => s.normalize('NFD').replace(/[̀́̄̌]/g, '').normalize('NFC').toLowerCase();

/**
 * Pinyin as written ("zhōngwén", "Xī'ān", "lǚ guǎn") split into its syllables, or null when it
 * doesn't split. With `count` (the word's number of characters) a split of that length wins.
 */
export function splitPinyin(text: string, count?: number): string[] | null {
  const chunks = text.trim().split(/[\s'’\-·]+/).filter(Boolean);
  const out: string[] = [];
  for (const c of chunks) {
    const ways = splits(c, 0);
    if (!ways.length) return null;
    out.push(...ways[0]);
  }
  if (count == null || out.length === count || chunks.length !== 1) return out;
  return splits(chunks[0], 0).find((w) => w.length === count) ?? out;
}

/** Every way to split a chunk, the longest first syllables first (how pinyin is read). */
function splits(s: string, depth: number): string[][] {
  if (!s) return [[]];
  if (depth > 12) return [];
  const out: string[][] = [];
  for (let n = Math.min(6, s.length); n > 0; n--) {
    const head = s.slice(0, n);
    // One tone mark per syllable, and the next one can't start with a vowel unless written apart.
    if (toneCount(head) > 1 || !isSyllable(toneless(head))) continue;
    const rest = s.slice(n);
    // m, n, ng, hm: interjections, only ever a word of their own.
    if ((rest || depth) && /^(m|n|ng|hm|hng)$/.test(toneless(head))) continue;
    // "xian" is xian, not xi + an: pinyin writes an apostrophe for that.
    if (/^[aeoāáǎàēéěèōóǒò]/i.test(rest.normalize('NFC'))) continue;
    for (const tail of splits(rest, depth + 1)) out.push([head, ...tail]);
    if (out.length > 8) break;
  }
  return out;
}

/** Pinyin with tone marks, as words are saved ("zhōngwén"), in zhuyin; unchanged when it doesn't split. */
export function markedToZhuyin(text: string, count?: number): string {
  const sylls = splitPinyin(text, count);
  return sylls ? numberedToZhuyin(sylls.map(markedToNumbered).join(' ')) : text;
}

/** A dictionary reading ("zhong1 wen2") the way you chose: "ㄓㄨㄥ ㄨㄣˊ", or "zhōngwén" ("zhōng wén" spaced). */
export function pron(numbered: string, mode: Pron, joined = true): string {
  return mode === 'zhuyin' ? numberedToZhuyin(numbered) : numberedToMarked(numbered, joined);
}

/** A saved reading (pinyin with tone marks) the way you chose. */
export function pronMarked(marked: string, mode: Pron, count?: number): string {
  return mode === 'zhuyin' ? markedToZhuyin(marked, count) : marked;
}

/**
 * A word with each character's zhuyin in a column on its right, the way Taiwan prints it. The
 * zhuyin is drawn by CSS from data attributes (see `.zy` in the stylesheets), so the text of the
 * element stays the word itself: selecting, copying and the hover lookup see only the characters.
 * Null when the readings don't pair up with the characters.
 */
export function zhuyinWord(word: string, numbered: string, doc: Document = document): HTMLElement | null {
  const chars = [...word];
  const sylls = numbered.split(/\s+/).filter(Boolean);
  if (chars.length !== sylls.length) return null;
  const parts = sylls.map(zhuyinParts);
  if (parts.some((p) => !p)) return null;
  const box = doc.createElement('span');
  box.className = 'zyw';
  chars.forEach((ch, i) => box.append(zhuyinChar(ch, parts[i]!, doc)));
  return box;
}

/** One character with its zhuyin column (data-zy letters, data-tone, data-er; n1..n4 = how many letters). */
export function zhuyinChar(ch: string, p: ZhuyinParts, doc: Document = document): HTMLElement {
  const c = doc.createElement('span');
  const n = [...p.letters].length + (p.er ? 1 : 0);
  c.className = `zy n${Math.min(4, n)}`;
  c.dataset.zy = p.letters + p.er;
  c.dataset.tone = p.tone;
  c.textContent = ch;
  return c;
}
