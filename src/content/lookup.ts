import type { LookupMatch } from '../shared/types.ts';

const cache = new Map<string, LookupMatch[]>();

/** Dictionary matches for text starting at its first character (cached). */
export async function lookupText(text: string): Promise<LookupMatch[]> {
  const key = text.slice(0, 8);
  const hit = cache.get(key);
  if (hit) return hit;
  const res: LookupMatch[] = await browser.runtime.sendMessage({ type: 'lookup', text: key });
  if (cache.size > 300) cache.clear();
  cache.set(key, res);
  return res;
}
