// Chinese Brain Plus: the AI layer. Every model call goes through here, with the keys kept as Worker secrets:
//   ANTHROPIC_API_KEY  Chris's Claude API key (text: Sonnet by default, Opus where it earns it)
//   POLLINATIONS_KEY   Chris's Pollinations key (images; its credits pay for them)
//   GEMINI_KEY         a free key from Google AI Studio (tried, not used: slow and often refused)
// A model is named by where it runs: "anthropic:<model>", "pollinations:<model>" or "gemini:<model>".
import Anthropic from '@anthropic-ai/sdk';

type Relay = { call(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<{ status: number; type: string; body: ArrayBuffer }> };
type Env = { ANTHROPIC_API_KEY?: string; GEMINI_KEY?: string; POLLINATIONS_KEY?: string; RELAY?: { idFromName(n: string): unknown; get(id: unknown, o?: { locationHint?: string }): Relay } };

/** Google and Anthropic refuse requests from some places (Cloudflare often serves Taiwan from Hong Kong), so their
 *  calls go through the Relay Durable Object, which lives in western North America (worker.js). */
async function gfetch(env: Env, url: string, init: { method: string; headers: Record<string, string>; body?: string }) {
  if (!env.RELAY) return fetch(url, init);
  const r = await env.RELAY.get(env.RELAY.idFromName('us'), { locationHint: 'wnam' }).call(url, init);
  return new Response(r.body, { status: r.status, headers: { 'Content-Type': r.type } });
}

/** The provider said "not now" (a free tier's daily or per-minute limit). Try again later. */
export class Quota extends Error {}

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';

export async function text(env: Env, model: string, prompt: string, opts: { json?: boolean } = {}) {
  const [where, name] = split(model);
  if (where === 'anthropic') return claude(env, name, prompt);
  if (where !== 'gemini') throw new Error(`No text route for ${model}.`);
  if (!env.GEMINI_KEY) throw new Quota('No GEMINI_KEY yet.'); // not a failure: it waits for the key
  const r = await gfetch(env, `${GEMINI}/models/${name}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(opts.json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
    }),
  });
  if (r.status === 429 || r.status === 503 || r.status === 504) throw new Quota(`${model}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  if (!r.ok) throw new Error(`${model}: ${r.status} ${(await r.text()).slice(0, 500)}`);
  const d = (await r.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]; usageMetadata?: Record<string, number> };
  const out = (d.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('');
  if (!out) throw new Error(`${model}: empty answer ${JSON.stringify(d).slice(0, 300)}`);
  return { text: out, usage: d.usageMetadata ?? {} };
}

/** The Gemini models this key can call (for choosing which take the test). */
export async function geminiModels(env: Env) {
  if (!env.GEMINI_KEY) throw new Error('No GEMINI_KEY.');
  const r = await gfetch(env, `${GEMINI}/models?pageSize=200`, { method: 'GET', headers: { 'x-goog-api-key': env.GEMINI_KEY } });
  if (!r.ok) throw new Error(`models: ${r.status} ${(await r.text()).slice(0, 300)}`);
  const d = (await r.json()) as { models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] };
  return (d.models ?? []).filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => ({ name: m.name.replace(/^models\//, ''), label: m.displayName ?? '' }));
}

/** One square image; returns its bytes and type. */
export async function image(env: Env, model: string, prompt: string) {
  const [where, name] = split(model);
  if (where === 'gemini') return geminiImage(env, name, prompt);
  if (where !== 'pollinations') throw new Error(`No image route for ${model}.`);
  if (!env.POLLINATIONS_KEY) throw new Quota('No POLLINATIONS_KEY yet.');
  const q = new URLSearchParams({ model: name, width: '1024', height: '1024', nologo: 'true', enhance: 'false', seed: String(Math.floor(Math.random() * 1e6)) });
  const r = await fetch(`https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${q}`, { headers: { Authorization: `Bearer ${env.POLLINATIONS_KEY}` } });
  if (r.status === 429) throw new Quota(`${model}: 429`);
  const type = r.headers.get('Content-Type') ?? '';
  if (!r.ok || !type.startsWith('image/')) throw new Error(`${model}: ${r.status} ${(await r.text()).slice(0, 400)}`);
  return { bytes: await r.arrayBuffer(), type };
}

function split(model: string): [string, string] {
  const i = model.indexOf(':');
  return [model.slice(0, i), model.slice(i + 1)];
}

/** Nano Banana on the Gemini key: the picture comes back inside the answer. */
async function geminiImage(env: Env, name: string, prompt: string) {
  if (!env.GEMINI_KEY) throw new Quota('No GEMINI_KEY yet.');
  const r = await gfetch(env, `${GEMINI}/models/${name}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } } }),
  });
  if (r.status === 429 || r.status === 503) throw new Quota(`gemini:${name}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  if (!r.ok) throw new Error(`gemini:${name}: ${r.status} ${(await r.text()).slice(0, 500)}`);
  const d = (await r.json()) as { candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[] };
  const img = (d.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData)?.inlineData;
  if (!img) throw new Error(`gemini:${name}: no picture ${JSON.stringify(d).slice(0, 300)}`);
  const bin = atob(img.data), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes: bytes.buffer, type: img.mimeType };
}

/** Claude through the official SDK, its requests sent by way of the Relay. Same thinking depth for every model,
 *  so a comparison between them is fair. */
async function claude(env: Env, name: string, prompt: string) {
  if (!env.ANTHROPIC_API_KEY) throw new Quota('No ANTHROPIC_API_KEY yet.');
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    maxRetries: 1,
    timeout: 290_000,
    fetch: async (url: string | URL | Request, init?: RequestInit) => {
      const h: Record<string, string> = {};
      new Headers(init?.headers).forEach((v, k) => (h[k] = v));
      return gfetch(env, String(url instanceof Request ? url.url : url), { method: init?.method ?? 'GET', headers: h, body: typeof init?.body === 'string' ? init.body : undefined });
    },
  });
  let m;
  try {
    m = await client.messages.create({ model: name, max_tokens: 16000, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' }, messages: [{ role: 'user', content: prompt }] });
  } catch (e) {
    const st = (e as { status?: number }).status;
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.APIConnectionError || st === 529 || st === 503 || st === 504) throw new Quota(`anthropic:${name}: ${String((e as Error).message).slice(0, 300)}`);
    throw e;
  }
  if (m.stop_reason === 'refusal') throw new Error(`anthropic:${name}: refused`);
  const out = m.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  if (!out) throw new Error(`anthropic:${name}: empty answer (${m.stop_reason})`);
  return { text: out, usage: m.usage as unknown as Record<string, number> };
}
