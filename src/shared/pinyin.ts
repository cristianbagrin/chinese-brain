const MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à', 'a'],
  e: ['ē', 'é', 'ě', 'è', 'e'],
  i: ['ī', 'í', 'ǐ', 'ì', 'i'],
  o: ['ō', 'ó', 'ǒ', 'ò', 'o'],
  u: ['ū', 'ú', 'ǔ', 'ù', 'u'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
};

/**
 * "lu:4" -> "lǜ", "xing1" -> "xīng", "r5" -> "r". Always lowercase: CC-CEDICT
 * capitalizes proper nouns ("Zhong1 wen2"), which reads oddly over a word.
 */
export function syllableToMarked(syl: string): string {
  const m = /^([a-zA-Z:üÜ]+)([1-5])$/.exec(syl);
  if (!m) return syl.toLowerCase();
  const [, raw, toneStr] = m;
  const tone = Number(toneStr) - 1;
  const base = raw.toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü');
  // Tone mark placement: a/e take it; "ou" marks o; otherwise the last vowel.
  let idx = base.search(/[ae]/);
  if (idx < 0) idx = base.indexOf('ou');
  if (idx < 0) {
    for (let i = base.length - 1; i >= 0; i--) {
      if ('aeiouü'.includes(base[i])) {
        idx = i;
        break;
      }
    }
  }
  if (idx < 0) return base;
  const marked = MARKS[base[idx]][tone];
  return base.slice(0, idx) + marked + base.slice(idx + 1);
}

/** "xing1 qi2" -> "xīngqí" (joined) or "xīng qí" (spaced). */
export function numberedToMarked(py: string, joined = true): string {
  const sylls = py.split(/\s+/).filter(Boolean).map(syllableToMarked);
  if (!joined) return sylls.join(' ');
  // Join with an apostrophe before a/e/o-initial syllables (xī'ān).
  return sylls.reduce((acc, s, i) => (i > 0 && /^[aeoāáǎàēéěèōóǒò]/i.test(s) ? acc + "'" + s : acc + s), '');
}

/** Tone numbers (1-5) of a numbered reading, for coloring. */
export function tones(py: string): number[] {
  return py.split(/\s+/).filter(Boolean).map((s) => Number(s.slice(-1)) || 5);
}
