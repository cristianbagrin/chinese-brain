const MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à', 'a'],
  e: ['ē', 'é', 'ě', 'è', 'e'],
  i: ['ī', 'í', 'ǐ', 'ì', 'i'],
  o: ['ō', 'ó', 'ǒ', 'ò', 'o'],
  u: ['ū', 'ú', 'ǔ', 'ù', 'u'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
};

/** "lu:4" -> "lǜ", "xing1" -> "xīng", "r5" -> "r". */
export function syllableToMarked(syl: string): string {
  const m = /^([a-zA-Z:üÜ]+)([1-5])$/.exec(syl);
  if (!m) return syl;
  let [, base, toneStr] = m;
  const tone = Number(toneStr) - 1;
  base = base.replace(/u:/g, 'ü').replace(/U:/g, 'Ü').replace(/v/g, 'ü');
  const lower = base.toLowerCase();
  // Tone mark placement: a/e take it; "ou" marks o; otherwise the last vowel.
  let idx = lower.search(/[ae]/);
  if (idx < 0) idx = lower.indexOf('ou');
  if (idx < 0) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('aeiouü'.includes(lower[i])) {
        idx = i;
        break;
      }
    }
  }
  if (idx < 0) return base;
  const v = lower[idx];
  let marked = MARKS[v][tone];
  if (base[idx] !== lower[idx]) marked = marked.toUpperCase();
  return base.slice(0, idx) + marked + base.slice(idx + 1);
}

/** "xing1 qi2" -> "xīngqí" (joined) or "xīng qí" (spaced). */
export function numberedToMarked(py: string, joined = true): string {
  const sylls = py.split(/\s+/).filter(Boolean).map(syllableToMarked);
  if (!joined) return sylls.join(' ');
  // Join with an apostrophe before a/e/o-initial syllables (xī'ān).
  return sylls.reduce((acc, s, i) => (i > 0 && /^[aeoāáǎàēéěèōóǒò]/i.test(s) ? acc + "'" + s : acc + s), '');
}

/** Tone numbers (1-5) of a numbered reading, for colouring. */
export function tones(py: string): number[] {
  return py.split(/\s+/).filter(Boolean).map((s) => Number(s.slice(-1)) || 5);
}
