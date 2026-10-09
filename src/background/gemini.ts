/**
 * Optional Gemini features, with the user's own key:
 * - transcribing YouTube videos that have no Chinese captions (opt-in per video,
 *   cached so a video is never sent twice);
 * - writing example sentences for words the bundled list doesn't cover (on request, cached).
 */
export interface GeminiLine {
  start: number;
  end: number;
  zh: string;
  en: string;
}

const API = 'https://generativelanguage.googleapis.com/v1beta';

const TRANSCRIBE = `Transcribe all spoken Mandarin Chinese in this video, verbatim, in Traditional Chinese characters as used in Taiwan (台灣正體字).
Split it into subtitle lines at natural pauses, about 1 to 4 seconds and at most about 20 characters each.
For each line give start and end times in seconds from the start of the video (numbers, e.g. 83.5), the Chinese text, and a natural American English translation.
If someone speaks Taiwanese Hokkien or another language, transcribe what you can and translate it.
Do not summarize, do not skip lines, do not add commentary. If nobody speaks Chinese, return an empty list.`;

const LINES_SCHEMA = {
  type: 'OBJECT',
  properties: {
    lines: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          start: { type: 'NUMBER' },
          end: { type: 'NUMBER' },
          zh: { type: 'STRING' },
          en: { type: 'STRING' },
        },
        required: ['start', 'end', 'zh', 'en'],
      },
    },
  },
  required: ['lines'],
};

interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

async function errorMessage(res: Response): Promise<string> {
  const raw = await res.text();
  let msg = raw.slice(0, 200);
  try {
    const j = JSON.parse(raw);
    msg = (Array.isArray(j) ? j[0] : j)?.error?.message ?? msg;
  } catch {
    /* not JSON */
  }
  if (res.status === 400 && /API key/i.test(msg)) return 'Gemini rejected the API key. Copy it again from aistudio.google.com/apikey.';
  if (res.status === 403) return `Gemini refused the request (403): ${msg}`;
  if (res.status === 404) return 'This Gemini model is not available for your key. Pick another one in Settings.';
  if (res.status === 429) return 'Gemini rate limit or free quota reached (429). Try again later or pick a lighter model.';
  return `Gemini (HTTP ${res.status}): ${msg}`;
}

/** One generateContent call; returns the model's text (thoughts left out). */
async function generate(key: string, model: string, parts: unknown[], generationConfig: Record<string, unknown>): Promise<{ text: string; finish: string }> {
  const res = await fetch(`${API}/models/${encodeURIComponent(model.replace(/^models\//, ''))}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  const data = (await res.json()) as GenerateResponse;
  if (data.promptFeedback?.blockReason) throw new Error(`Gemini blocked the request (${data.promptFeedback.blockReason}).`);
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('');
  return { text, finish: cand?.finishReason ?? '' };
}

/** "1:23.5" or "83.5" -> seconds. */
function seconds(v: unknown): number {
  if (typeof v === 'number') return v;
  const parts = String(v ?? '').trim().split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** Lines from the model's JSON; a reply cut off at the token limit still yields its complete lines. */
export function parseLines(text: string): GeminiLine[] {
  const body = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  let raw: unknown[] = [];
  try {
    const json = JSON.parse(body) as { lines?: unknown[] } | unknown[];
    raw = Array.isArray(json) ? json : (json.lines ?? []);
  } catch {
    for (const m of body.matchAll(/\{[^{}]*\}/g)) {
      try {
        raw.push(JSON.parse(m[0]));
      } catch {
        /* a cut-off object */
      }
    }
  }
  return (raw as Partial<Record<keyof GeminiLine, unknown>>[])
    .filter((l) => l && typeof l.zh === 'string' && l.zh.trim())
    .map((l) => {
      const start = seconds(l.start);
      const end = seconds(l.end);
      return { start, end: Number.isFinite(end) && end > start ? end : start + 2, zh: String(l.zh).trim(), en: String(l.en ?? '').trim() };
    })
    .filter((l) => Number.isFinite(l.start))
    .sort((a, b) => a.start - b.start);
}

export async function geminiTranscribe(videoId: string, key: string, model: string): Promise<GeminiLine[]> {
  const cacheKey = 'gem:' + videoId;
  const cached = (await browser.storage.local.get(cacheKey))[cacheKey] as GeminiLine[] | undefined;
  if (cached?.length) return cached;

  const parts = [{ file_data: { file_uri: `https://www.youtube.com/watch?v=${videoId}` } }, { text: TRANSCRIBE }];
  const config = {
    responseMimeType: 'application/json',
    responseSchema: LINES_SCHEMA,
    maxOutputTokens: 65536,
    temperature: 0.2,
    // Fewer tokens per second of video, so long videos fit the free tier.
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
  };
  let out;
  try {
    out = await generate(key, model, parts, config);
  } catch (e) {
    // Some models reject an option (schema, media resolution); retry with the bare minimum.
    if (!/HTTP 400/.test(String(e))) throw e;
    out = await generate(key, model, parts, { responseMimeType: 'application/json' });
  }
  const lines = parseLines(out.text);
  if (!lines.length) {
    if (out.finish === 'SAFETY' || out.finish === 'RECITATION' || out.finish === 'PROHIBITED_CONTENT') throw new Error(`Gemini stopped (${out.finish}).`);
    if (!out.text.trim()) throw new Error(`Gemini sent an empty reply${out.finish ? ` (${out.finish})` : ''}. Try again, or pick another model in Settings.`);
    throw new Error('Gemini heard no Mandarin in this video.');
  }
  await browser.storage.local.set({ [cacheKey]: lines });
  return lines;
}

/** Models this key can use for generateContent, newest first (for the Settings picker). */
export async function geminiModels(key: string): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];
  let page = '';
  do {
    const res = await fetch(`${API}/models?pageSize=200${page ? `&pageToken=${page}` : ''}`, { headers: { 'x-goog-api-key': key.trim() } });
    if (!res.ok) throw new Error(await errorMessage(res));
    const data = (await res.json()) as {
      models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
      nextPageToken?: string;
    };
    for (const m of data.models ?? []) {
      const id = m.name.replace(/^models\//, '');
      if (!m.supportedGenerationMethods?.includes('generateContent')) continue;
      // Text-and-video chat models only.
      if (!/^gemini-/.test(id) || /embedding|image|tts|audio|live|robotics|computer-use|aqa/.test(id)) continue;
      out.push({ id, name: m.displayName || id });
    }
    page = data.nextPageToken ?? '';
  } while (page);
  const ver = (id: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(id)?.[1] ?? 0);
  const tier = (id: string) => (/flash-lite/.test(id) ? 1 : /flash/.test(id) ? 0 : 2);
  const preview = (id: string) => (/preview|exp/.test(id) ? 1 : 0);
  return out.sort((a, b) => ver(b.id) - ver(a.id) || preview(a.id) - preview(b.id) || tier(a.id) - tier(b.id) || a.id.localeCompare(b.id));
}

/** Two Taiwan-Mandarin example sentences for a word the bundled list lacks (cached per word). */
export async function geminiExamples(word: string, gloss: string, key: string, model: string): Promise<[string, string][]> {
  const cacheKey = 'gex:' + word;
  const cached = (await browser.storage.local.get(cacheKey))[cacheKey] as [string, string][] | undefined;
  if (cached?.length) return cached;
  const prompt = `Write two natural example sentences that a Taiwanese person would really say or write, using the word 「${word}」 (${gloss}).
Use Traditional Chinese characters as used in Taiwan and Taiwan vocabulary (not Mainland forms, no 兒化).
The first sentence: 12 to 25 characters, showing typical everyday usage. The second: short and simple, under 12 characters.
Give each with a natural American English translation.`;
  const schema = {
    type: 'OBJECT',
    properties: { examples: { type: 'ARRAY', items: { type: 'OBJECT', properties: { zh: { type: 'STRING' }, en: { type: 'STRING' } }, required: ['zh', 'en'] } } },
    required: ['examples'],
  };
  const { text } = await generate(key, model, [{ text: prompt }], { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.7 });
  const json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as { examples?: { zh?: string; en?: string }[] };
  const list = (json.examples ?? [])
    .filter((x) => x.zh?.includes(word))
    .slice(0, 2)
    .map((x) => [x.zh!.trim(), (x.en ?? '').trim()] as [string, string]);
  if (!list.length) throw new Error('Gemini wrote no usable sentences.');
  await browser.storage.local.set({ [cacheKey]: list });
  return list;
}
