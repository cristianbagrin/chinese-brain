/**
 * Optional Gemini features, with the user's own key:
 * - subtitling YouTube videos that have no Chinese captions (opt-in per video, cached so
 *   a video is never sent twice). Mandarin is transcribed; any other language is
 *   translated into Taiwan Mandarin;
 * - writing example sentences for words the bundled list doesn't cover (on request, cached).
 *
 * Google's servers answer 503 ("high demand") now and then. Every call retries once
 * after a short wait and then falls back to another model the key can use.
 */
export interface GeminiLine {
  start: number;
  end: number;
  zh: string;
  en: string;
}

export interface TranscribeProgress {
  done: number;
  total: number;
  lines: GeminiLine[];
  model: string;
  /** How far through the video Gemini has written, 0..1 (from the timestamps it has sent). */
  pct?: number;
}

const API = 'https://generativelanguage.googleapis.com/v1beta';
/** Long videos go in parts of this many seconds: better timing, smaller replies, fewer timeouts. */
const CHUNK = 300;

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function subtitlePrompt(clip?: { start: number; end: number }) {
  return `You are subtitling a YouTube video for someone learning Taiwan Mandarin.
${clip ? `Only handle the part of the video from ${mmss(clip.start)} to ${mmss(clip.end)}.\n` : ''}Listen to everything that is said and write subtitle lines:
- Split at natural pauses: one phrase per line, about 1 to 5 seconds, at most about 18 Chinese characters.
- "start" and "end": when the line is spoken, as MM:SS.s (for example 01:23.4), counted from the start of the full video. Follow the audio closely.
- "zh": the line in Traditional Chinese characters as used in Taiwan.
  - If the speaker speaks Mandarin, write exactly what they say, verbatim, including particles (啊, 欸, 啦, 喔, 嗯).
  - If they speak another language (English or anything else), translate the line into the natural spoken Mandarin a Taiwanese subtitler would write: Taiwan vocabulary and phrasing (影片, 軟體, 網路, 資訊, 品質, 計程車, 捷運, 機車, 便當, 超商, 好喔, 真的假的), never Mainland terms (視頻, 軟件, 質量, 信息, 出租車, 打車, 牛逼), no 兒化.
- "en": natural American English: the translation of the Mandarin, or the original words if they were English.
- "spoken": the language actually spoken in this part (for example "zh", "en", "nan").
Do not summarize, skip or merge lines, and add no commentary. Skip music without words. If nothing is said, return an empty list.`;
}

const LINES_SCHEMA = {
  type: 'OBJECT',
  properties: {
    spoken: { type: 'STRING' },
    lines: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          start: { type: 'STRING', description: 'MM:SS.s' },
          end: { type: 'STRING', description: 'MM:SS.s' },
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
}

class GeminiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function errorFor(res: Response): Promise<GeminiError> {
  const raw = await res.text();
  let msg = raw.slice(0, 200);
  try {
    const j = JSON.parse(raw);
    msg = (Array.isArray(j) ? j[0] : j)?.error?.message ?? msg;
  } catch {
    /* not JSON */
  }
  const s = res.status;
  if (s === 400 && /API key/i.test(msg)) return new GeminiError('Gemini rejected the API key. Copy it again from aistudio.google.com/apikey.', 401);
  if (s === 403) return new GeminiError(`Gemini refused the request (403): ${msg}`, s);
  if (s === 404) return new GeminiError('This Gemini model is not available for your key. Pick another one in Settings.', s);
  if (s === 429) return new GeminiError('Gemini rate limit or free quota reached (429). Wait a minute, or pick another model in Settings.', s);
  if (s === 503 || s === 500 || s === 504) return new GeminiError(`Gemini's servers are busy right now (${s}). This is on Google's side and passes; try again in a few minutes.`, s);
  return new GeminiError(`Gemini (HTTP ${s}): ${msg}`, s);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One generateContent call; returns the model's text (thoughts left out). With `onText`
 * the reply is streamed and onText sees the text so far as it grows (for real progress).
 */
async function generate(
  key: string,
  model: string,
  parts: unknown[],
  generationConfig: Record<string, unknown>,
  onText?: (text: string) => void,
): Promise<{ text: string; finish: string }> {
  const id = encodeURIComponent(model.replace(/^models\//, ''));
  let res: Response;
  try {
    res = await fetch(`${API}/models/${id}:${onText ? 'streamGenerateContent?alt=sse' : 'generateContent'}`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
    });
  } catch {
    throw new GeminiError('Could not reach Gemini. Check your connection.', 0);
  }
  if (!res.ok) throw await errorFor(res);
  let text = '';
  let finish = '';
  const take = (data: GenerateResponse) => {
    if (data.promptFeedback?.blockReason) throw new GeminiError(`Gemini blocked the request (${data.promptFeedback.blockReason}).`, 400);
    const cand = data.candidates?.[0];
    text += (cand?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('');
    finish = cand?.finishReason ?? finish;
  };
  if (!onText || !res.body || !/event-stream/i.test(res.headers.get('content-type') ?? '')) {
    // Plain JSON (also what a stream call returns without SSE: an array of chunks).
    const data = (await res.json()) as GenerateResponse | GenerateResponse[];
    for (const d of Array.isArray(data) ? data : [data]) take(d);
    onText?.(text);
    return { text, finish };
  }
  // Server-sent events: "data: {json}" blocks separated by blank lines.
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let cut: number;
      while ((cut = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        for (const line of block.split('\n')) if (line.startsWith('data:')) take(JSON.parse(line.slice(5)) as GenerateResponse);
      }
      onText(text);
    }
  } catch (e) {
    if (e instanceof GeminiError) throw e;
    throw new GeminiError('The connection to Gemini dropped.', 0);
  }
  return { text, finish };
}

/** Other models this key can use, cached for a day, best fallbacks first (stable flash, then lite). */
async function fallbackModels(key: string, chosen: string): Promise<string[]> {
  const tag = key.slice(-6);
  const { gemModels } = (await browser.storage.local.get('gemModels')) as { gemModels?: { at: number; tag: string; ids: string[] } };
  let ids = gemModels && gemModels.tag === tag && Date.now() - gemModels.at < 86_400_000 ? gemModels.ids : undefined;
  if (!ids) {
    try {
      ids = (await geminiModels(key)).map((m) => m.id);
      await browser.storage.local.set({ gemModels: { at: Date.now(), tag, ids } });
    } catch {
      ids = [];
    }
  }
  const rank = (id: string) => (/preview|exp/.test(id) ? 2 : 0) + (/lite/.test(id) ? 1 : 0) + (/flash/.test(id) ? 0 : 4);
  return ids
    .filter((id) => id !== chosen && /flash/.test(id))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 2);
}

/**
 * generate(), made sturdy: a busy server (500/503/504) is retried once after 2.5 s;
 * then, as for a quota error or a missing model, the next model in line takes over.
 * Options a model rejects (400) are dropped once before giving up on it.
 */
async function generateSturdy(
  key: string,
  model: string,
  parts: unknown[],
  config: Record<string, unknown>,
  onText?: (text: string) => void,
): Promise<{ text: string; finish: string; model: string }> {
  const models = [model, ...(await fallbackModels(key, model))];
  let last: unknown;
  for (const m of models) {
    let cfg = config;
    let retried = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return { ...(await generate(key, m, parts, cfg, onText)), model: m };
      } catch (e) {
        last = e;
        const st = e instanceof GeminiError ? e.status : 0;
        if (st === 401 || st === 403) throw e; // the key itself: no model will help
        if (st === 400 && cfg !== BARE) {
          cfg = BARE;
          continue;
        }
        if ((st === 500 || st === 503 || st === 504 || st === 0) && !retried) {
          retried = true;
          await sleep(2500);
          continue;
        }
        break; // 429, 404, still busy: try the next model
      }
    }
  }
  throw last;
}
const BARE = { responseMimeType: 'application/json' };

/** "01:23.4", "1:02:03" or 83.4 -> seconds. */
function seconds(v: unknown): number {
  if (typeof v === 'number') return v;
  const parts = String(v ?? '').trim().split(':').map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** Lines from the model's JSON; a reply cut off at the token limit still yields its complete lines. */
export function parseLines(text: string): GeminiLine[] {
  return parseReply(text).lines;
}

function parseReply(text: string): { lines: GeminiLine[]; spoken: string } {
  const body = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  let raw: unknown[] = [];
  let spoken = '';
  try {
    const json = JSON.parse(body) as { lines?: unknown[]; spoken?: string } | unknown[];
    if (Array.isArray(json)) raw = json;
    else {
      raw = json.lines ?? [];
      spoken = String(json.spoken ?? '');
    }
  } catch {
    for (const m of body.matchAll(/\{[^{}]*\}/g)) {
      try {
        raw.push(JSON.parse(m[0]));
      } catch {
        /* a cut-off object */
      }
    }
    spoken = /"spoken"\s*:\s*"([^"]*)"/.exec(body)?.[1] ?? '';
  }
  const lines = (raw as Partial<Record<keyof GeminiLine, unknown>>[])
    .filter((l) => l && typeof l.zh === 'string' && l.zh.trim())
    .map((l) => {
      const start = seconds(l.start);
      const end = seconds(l.end);
      return { start, end: Number.isFinite(end) && end > start ? end : start + 2, zh: String(l.zh).trim(), en: String(l.en ?? '').trim() };
    })
    .filter((l) => Number.isFinite(l.start))
    .sort((a, b) => a.start - b.start);
  return { lines, spoken };
}

/**
 * A part's lines on the video's clock. Models sometimes count from the start of the
 * clip instead of the video; if every line sits before the clip, shift them into it.
 */
export function placeChunk(lines: GeminiLine[], clip: { start: number; end: number }): GeminiLine[] {
  if (!lines.length) return lines;
  const median = lines[Math.floor(lines.length / 2)].start;
  const shift = clip.start > 0 && median < clip.start - 5 ? clip.start : 0;
  return lines
    .map((l) => ({ ...l, start: l.start + shift, end: l.end + shift }))
    .filter((l) => l.start >= clip.start - 3 && l.start <= clip.end + 3);
}

export interface TranscribeResult {
  lines: GeminiLine[];
  /** Mandarin was transcribed; anything else was translated into it. */
  translated: boolean;
  /** Some parts failed (the rest is shown; pressing again retries only those). */
  error?: string;
  model: string;
}

export async function geminiTranscribe(
  videoId: string,
  key: string,
  model: string,
  duration: number,
  progress: (p: TranscribeProgress) => void,
): Promise<TranscribeResult> {
  const cacheKey = 'gem:' + videoId;
  const cached = (await browser.storage.local.get(cacheKey))[cacheKey] as GeminiLine[] | { lines: GeminiLine[]; translated: boolean } | undefined;
  if (cached && (Array.isArray(cached) ? cached.length : cached.lines.length)) {
    return Array.isArray(cached) ? { lines: cached, translated: false, model } : { ...cached, model };
  }

  const n = Number.isFinite(duration) && duration > CHUNK * 1.25 ? Math.ceil(duration / CHUNK) : 1;
  const clips = Array.from({ length: n }, (_, i) => ({ start: i * CHUNK, end: Math.min(duration, (i + 1) * CHUNK) }));
  const partKey = (i: number) => `gemc:${videoId}:${i}/${n}`;
  const stored = await browser.storage.local.get(clips.map((_, i) => partKey(i)));
  const parts: ({ lines: GeminiLine[]; spoken: string } | undefined)[] = clips.map((_, i) => stored[partKey(i)] as { lines: GeminiLine[]; spoken: string } | undefined);
  const errors: string[] = [];
  let used = model;
  // Real progress: each part counts by how far into its stretch of video the written lines reach.
  const reached: number[] = clips.map((_, i) => (parts[i] ? 1 : 0));
  const pct = () => (Number.isFinite(duration) && duration > 0 ? clips.reduce((sum, c, i) => sum + reached[i] * (c.end - c.start), 0) / duration : undefined);
  const report = () =>
    progress({
      done: parts.filter(Boolean).length,
      total: n,
      lines: parts.flatMap((p) => p?.lines ?? []).sort((a, b) => a.start - b.start),
      model: used,
      pct: pct(),
    });
  let lastTick = 0;
  const streamed = (i: number) => (text: string) => {
    const times = [...text.matchAll(/"start"\s*:\s*"?([\d:.]+)/g)];
    if (!times.length) return;
    const clip = clips[i];
    let t = seconds(times[times.length - 1][1]);
    if (n > 1 && t < clip.start - 5) t += clip.start; // counted from the clip's start
    reached[i] = Math.max(reached[i], Math.min(0.99, (t - clip.start) / Math.max(1, clip.end - clip.start)));
    if (Date.now() - lastTick > 700) {
      lastTick = Date.now();
      progress({ done: parts.filter(Boolean).length, total: n, lines: [], model: used, pct: pct() });
    }
  };

  const config = { responseMimeType: 'application/json', responseSchema: LINES_SCHEMA, maxOutputTokens: 65536, temperature: 0.2, mediaResolution: 'MEDIA_RESOLUTION_LOW' };
  const work = async (i: number) => {
    const clip = clips[i];
    const video: Record<string, unknown> = { file_data: { file_uri: `https://www.youtube.com/watch?v=${videoId}` } };
    if (n > 1) video.video_metadata = { start_offset: `${clip.start}s`, end_offset: `${Math.ceil(clip.end)}s` };
    try {
      const out = await generateSturdy(key, used, [video, { text: subtitlePrompt(n > 1 ? clip : undefined) }], config, streamed(i));
      used = out.model; // a fallback that worked keeps going for the remaining parts
      const reply = parseReply(out.text);
      if (!reply.lines.length && !out.text.trim()) throw new Error(`Gemini sent an empty reply${out.finish ? ` (${out.finish})` : ''}.`);
      const part = { lines: n > 1 ? placeChunk(reply.lines, clip) : reply.lines, spoken: reply.spoken };
      parts[i] = part;
      reached[i] = 1;
      await browser.storage.local.set({ [partKey(i)]: part });
      report();
    } catch (e) {
      errors.push(String(e instanceof Error ? e.message : e));
    }
  };
  // Two parts at a time: quick, and gentle on the free tier's per-minute limit.
  const queue = clips.map((_, i) => i).filter((i) => !parts[i]);
  report();
  await Promise.all(
    [0, 1].map(async () => {
      for (let i = queue.shift(); i !== undefined; i = queue.shift()) await work(i);
    }),
  );

  const lines = parts.flatMap((p) => p?.lines ?? []).sort((a, b) => a.start - b.start);
  const spoken = parts.map((p) => p?.spoken ?? '').filter(Boolean);
  const translated = spoken.length > 0 && spoken.every((s) => !/^(zh|cmn|mandarin|chinese)/i.test(s));
  const failed = parts.filter((p) => !p).length;
  if (!lines.length) {
    if (errors.length) throw new Error(errors[0]);
    throw new Error('Gemini heard no speech in this video.');
  }
  if (!failed) {
    await browser.storage.local.set({ [cacheKey]: { lines, translated } });
    await browser.storage.local.remove(clips.map((_, i) => partKey(i)));
    return { lines, translated, model: used };
  }
  return { lines, translated, model: used, error: `${failed} of ${n} parts failed: ${errors[0]} Press the button again to retry just those.` };
}

/** Models this key can use for generateContent, newest first (for the Settings picker). */
export async function geminiModels(key: string): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];
  let page = '';
  do {
    const res = await fetch(`${API}/models?pageSize=200${page ? `&pageToken=${page}` : ''}`, { headers: { 'x-goog-api-key': key.trim() } });
    if (!res.ok) throw await errorFor(res);
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

/**
 * Taiwan-Mandarin example sentences for a word, up to `want` new ones (cached per word,
 * added to any kept earlier). Sentences you deleted are never brought back.
 */
export async function geminiExamples(word: string, gloss: string, key: string, model: string, want = 2): Promise<[string, string][]> {
  const cacheKey = 'gex:' + word;
  const got = await browser.storage.local.get([cacheKey, 'exh:' + word]);
  const cached = (got[cacheKey] as [string, string][] | undefined) ?? [];
  const hidden = new Set((got['exh:' + word] as string[] | undefined) ?? []);
  const prompt = `Write ${want === 1 ? 'one natural example sentence' : 'two natural example sentences'} that a Taiwanese person would really say or write, using the word 「${word}」 (${gloss}).
- Show the word's most common meaning, in a concrete, everyday situation (not textbook, not a definition).
- Besides 「${word}」, use only common, everyday words, so a learner can understand everything else.
- Traditional Chinese characters and Taiwan vocabulary (not Mainland forms, no 兒化).
- ${want === 1 ? 'About 10 to 22 characters.' : 'The first 12 to 25 characters; the second short and simple, under 12.'}
Give each with a natural American English translation.`;
  const schema = {
    type: 'OBJECT',
    properties: { examples: { type: 'ARRAY', items: { type: 'OBJECT', properties: { zh: { type: 'STRING' }, en: { type: 'STRING' } }, required: ['zh', 'en'] } } },
    required: ['examples'],
  };
  const { text } = await generateSturdy(key, model, [{ text: prompt }], { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.7 });
  const json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as { examples?: { zh?: string; en?: string }[] };
  const fresh = (json.examples ?? [])
    .map((x) => [(x.zh ?? '').trim(), (x.en ?? '').trim()] as [string, string])
    .filter(([zh]) => zh.includes(word) && !hidden.has(zh) && !cached.some(([c]) => c === zh))
    .slice(0, want);
  if (!fresh.length) throw new Error('Gemini wrote no usable sentences. Try again.');
  const list = [...cached, ...fresh];
  await browser.storage.local.set({ [cacheKey]: list });
  return list;
}
