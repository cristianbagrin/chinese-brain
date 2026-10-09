/**
 * Fallback for the English line when YouTube's own auto-translation is
 * unavailable (it answers 429 for some networks). Uses Google's free web
 * endpoint, in batches; it is unofficial and can rate-limit, so failures
 * just leave the second line empty.
 */
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t';

export async function translateLines(lines: string[], sl: string, tl: string): Promise<string[]> {
  const out = new Array<string>(lines.length).fill('');
  let batch: number[] = [];
  let size = 0;
  const flush = async () => {
    if (!batch.length) return;
    const ids = batch;
    batch = [];
    size = 0;
    const q = ids.map((i) => lines[i].replace(/\n/g, ' ')).join('\n');
    const res = await fetch(`${ENDPOINT}&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'q=' + encodeURIComponent(q),
    });
    if (!res.ok) throw new Error(`translate HTTP ${res.status}`);
    const data = (await res.json()) as [[string, string][]];
    const text = data[0].map((seg) => seg[0]).join('');
    const parts = text.split('\n');
    if (parts.length === ids.length) ids.forEach((i, k) => (out[i] = parts[k].trim()));
  };
  for (let i = 0; i < lines.length; i++) {
    if (size + lines[i].length > 3000) await flush().catch(() => {}); // keep the batches that worked
    batch.push(i);
    size += lines[i].length + 1;
  }
  await flush().catch(() => {});
  if (out.every((x) => !x)) throw new Error('translate: no batch succeeded');
  return out;
}
