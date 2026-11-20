// Chinese Brain Plus: the AI layer. Every model call goes through here, with the keys kept as Worker secrets:
//   GEMINI_KEY        a free key from Google AI Studio (text)
//   POLLINATIONS_KEY  Chris's Pollinations key (images; its credits pay for them)
// A model is named by where it runs: "gemini:<model>" or "pollinations:<model>".

type Relay = { call(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<{ status: number; type: string; body: ArrayBuffer }> };
type Env = { GEMINI_KEY?: string; POLLINATIONS_KEY?: string; RELAY?: { idFromName(n: string): unknown; get(id: unknown, o?: { locationHint?: string }): Relay } };

/** Google refuses requests from some places (Cloudflare often serves Taiwan from Hong Kong), so Gemini calls go
 *  through the Relay Durable Object, which lives in western North America (worker.js). */
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
  if (r.status === 429 || r.status === 503) throw new Quota(`${model}: ${r.status} ${(await r.text()).slice(0, 300)}`);
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
