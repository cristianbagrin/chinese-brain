/**
 * Optional fallback for videos without Chinese captions: ask Gemini (with the
 * user's own free-tier key) to transcribe the YouTube video. Opt-in per video;
 * the result is cached so a video is never sent twice.
 */
export interface GeminiLine {
  start: number;
  end: number;
  zh: string;
  en: string;
}

const PROMPT = `Transcribe all spoken Mandarin Chinese in this video, verbatim, in Traditional Chinese characters as used in Taiwan (台灣正體字).
Split it into subtitle lines at natural pauses, about 1 to 4 seconds and at most about 20 characters each.
For each line give start and end times in seconds from the start of the video, the Chinese text, and a natural English translation.
If someone speaks Taiwanese Hokkien or another language, transcribe what you can and translate it.
Do not summarise, do not skip lines, do not add commentary.`;

const SCHEMA = {
  type: 'object',
  properties: {
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          start: { type: 'number' },
          end: { type: 'number' },
          zh: { type: 'string' },
          en: { type: 'string' },
        },
        required: ['start', 'end', 'zh', 'en'],
      },
    },
  },
  required: ['lines'],
};

export async function geminiTranscribe(videoId: string, key: string, model: string): Promise<GeminiLine[]> {
  const cacheKey = 'gem:' + videoId;
  const cached = (await browser.storage.local.get(cacheKey))[cacheKey] as GeminiLine[] | undefined;
  if (cached?.length) return cached;

  const call = async (structured: boolean) => {
    const body: Record<string, unknown> = {
      model,
      input: [
        { type: 'text', text: PROMPT },
        { type: 'video', uri: `https://www.youtube.com/watch?v=${videoId}` },
      ],
    };
    if (structured) body.response_format = { type: 'text', mime_type: 'application/json', schema: SCHEMA };
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const raw = await res.text();
      let msg = raw.slice(0, 200);
      try {
        const j = JSON.parse(raw);
        msg = (Array.isArray(j) ? j[0] : j)?.error?.message ?? msg;
      } catch {
        /* not JSON */
      }
      throw new Error(`Gemini (HTTP ${res.status}): ${msg}`);
    }
    const data = (await res.json()) as { steps?: { type: string; content?: { type: string; text?: string }[] }[] };
    return (data.steps ?? [])
      .filter((s) => s.type === 'model_output')
      .flatMap((s) => s.content ?? [])
      .map((c) => c.text ?? '')
      .join('');
  };

  let text: string;
  try {
    text = await call(true);
  } catch (e) {
    // Older/newer models may reject the schema option; ask for plain JSON instead.
    if (!/HTTP 400/.test(String(e)) || /API key/i.test(String(e))) throw e;
    text = await call(false);
  }
  const json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as { lines?: GeminiLine[] } | GeminiLine[];
  const lines = (Array.isArray(json) ? json : json.lines ?? [])
    .filter((l) => l && typeof l.zh === 'string' && l.zh.trim())
    .map((l) => ({ start: Number(l.start) || 0, end: Number(l.end) || Number(l.start) + 2, zh: l.zh.trim(), en: (l.en ?? '').trim() }))
    .sort((a, b) => a.start - b.start);
  if (!lines.length) throw new Error('Gemini returned no lines');
  await browser.storage.local.set({ [cacheKey]: lines });
  return lines;
}
