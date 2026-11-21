// Chinese Brain Plus, Stage 3: what the card window on /plus asks the server for.
//   sample    Claude writes the study card (and answers questions about it, and grades tests): Sonnet 5.5, his pick
//   photos    for the review card's pictures: Wikimedia Commons, straight from its servers
//   drawings  two drawings in his flashcard style (prompts by Claude, kept with them in docs `pics`)
//   grab      a picture from the web, kept in R2;  pinyin  the sentence's reading, done for him
//   voice     the sentence read by an Azure Taiwan voice (YunJhe or HsiaoChen, picked at random)
//   media     pictures and audio kept in R2 under an unguessable name, so <img> and <audio> can load them
import * as ai from './ai.ts';
import { hex } from './plus.ts';

type R2Object = { body: ReadableStream; httpMetadata?: { contentType?: string } };
type Env = {
  CBP: { prepare(sql: string): { bind(...v: unknown[]): { first<T>(): Promise<T | null>; run(): Promise<unknown> } } };
  FILES: { put(k: string, v: ArrayBuffer | ReadableStream, o?: { httpMetadata?: { contentType?: string } }): Promise<unknown>; get(k: string): Promise<R2Object | null> };
  CBP_PUSH_KEY?: string;
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
  ANTHROPIC_API_KEY?: string;
  POLLINATIONS_KEY?: string;
};

export const CARD_MODEL = 'anthropic:claude-sonnet-5-5';
/** The two that draw a picture (his picks in the taste test): FLUX.2 Flex writes Chinese correctly. */
export const DRAWERS = ['pollinations:microsoft/mai-image-2.7', 'pollinations:black-forest-labs/flux.2-flex'];
/** Who's asking, as Wikimedia asks programs to say. */
const BOT = 'ChineseBrainPlus/1.0 (https://chinese.cristianbagrin.com; flashcard pictures)';

export class Bad extends Error {}

// ---------- Claude ----------
/** The board's `sample`: one prompt, or the turns of a conversation. */
export async function sample(env: Env, body: { input?: unknown; effort?: unknown }) {
  const input = body.input;
  let msgs: ai.Input;
  if (typeof input === 'string') msgs = input;
  else if (Array.isArray(input) && input.length && input.length <= 60) {
    msgs = input.map((m) => {
      const role = (m as { role?: unknown })?.role, content = (m as { content?: unknown })?.content;
      if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') throw new Bad('Bad message.');
      return { role, content };
    });
  } else throw new Bad('Nothing to send.');
  if (JSON.stringify(msgs).length > 400_000) throw new Bad('Too long.');
  const effort = body.effort === 'low' || body.effort === 'high' ? body.effort : 'medium';
  const r = await ai.text(env, CARD_MODEL, msgs, { effort });
  return { text: r.text, model: CARD_MODEL.split(':')[1] };
}

// ---------- media ----------
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a' };
export const mediaUrl = (name: string) => `/api/plus/media/${name}`;
/** Keep bytes; returns the address they're served at. */
export async function keepMedia(env: Env, bytes: ArrayBuffer, type: string) {
  const t = type.split(';')[0].trim().toLowerCase();
  if (!EXT[t]) throw new Bad('Not a picture or a sound.');
  if (bytes.byteLength > 12_000_000) throw new Bad('Too big.');
  const name = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('') + '.' + EXT[t];
  await env.FILES.put(`m/${name}`, bytes, { httpMetadata: { contentType: t } });
  return mediaUrl(name);
}
export async function media(env: Env, name: string) {
  if (!/^[0-9a-f]{32}\.(jpg|png|webp|gif|mp3|m4a)$/.test(name)) return new Response('Not found', { status: 404 });
  const o = await env.FILES.get(`m/${name}`);
  if (!o) return new Response('Not found', { status: 404 });
  return new Response(o.body, { headers: { 'Content-Type': o.httpMetadata?.contentType ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=31536000, immutable' } });
}

// ---------- pictures from the web ----------
/** A picture from anywhere on the web (one he pasted, a photo he picked), kept for good: the web's copy can vanish,
 *  and the page shows only its own site's pictures (and Commons'). */
export async function grab(env: Env, b: { url?: unknown }) {
  const u = String(b.url ?? '');
  if (!/^https:\/\/[^/]+\//.test(u) || /^https:\/\/(localhost|127\.|10\.|192\.168\.|\[)/.test(u)) throw new Bad('Not a picture address.');
  const r = await fetch(u, { headers: { 'User-Agent': BOT, Accept: 'image/*' }, redirect: 'follow' });
  const type = (r.headers.get('Content-Type') ?? '').split(';')[0];
  if (!r.ok || !type.startsWith('image/')) throw new Bad('No picture there.');
  const bytes = await r.arrayBuffer();
  return { url: await keepMedia(env, bytes, type) };
}

/** Wikimedia Commons photos (its API is open to programs; Bing and DuckDuckGo turn a server away). Commons serves
 *  thumbnails only at its standard widths: 330 for the choices, 960 for the card. The page loads them from Commons. */
export async function photos(env: Env, b: { q?: unknown; offset?: unknown }) {
  const q = String(b.q ?? '').trim().slice(0, 120);
  if (!q) throw new Bad('Nothing to look for.');
  const off = Math.max(0, Math.min(200, Number(b.offset) || 0));
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent('filetype:bitmap ' + q)}&gsrnamespace=6&gsrlimit=16&gsroffset=${off}&prop=imageinfo&iiprop=url|mime&iiurlwidth=960`;
  const r = await fetch(u, { headers: { 'User-Agent': BOT } });
  if (!r.ok) throw new Error(`photos: ${r.status}`);
  const d = (await r.json()) as { query?: { pages?: Record<string, { index: number; imageinfo?: { thumburl?: string; mime?: string }[] }> } };
  const list = Object.values(d.query?.pages ?? {})
    .sort((x, y) => x.index - y.index)
    .map((p) => p.imageinfo?.[0])
    .filter((i): i is { thumburl: string; mime: string } => !!i?.thumburl && /^image\/(jpeg|png|webp)/.test(i.mime ?? '') && /\/960px-/.test(i.thumburl))
    .map((i) => i.thumburl.split('?')[0])
    .map((u) => ({ full: u, thumb: u.replace('/960px-', '/330px-') }));
  return { photos: list.slice(0, 12), next: off + 16 };
}

// ---------- drawings ----------
// His flashcard skill (life/chinese/reference/SKILL-taiwanese-mandarin-flashcards.md), the parts a prompt needs,
// with his notes from the taste test: the meaning must land at a glance, funny and over the top beats polite.
const PICTURE_RULES = `How his flashcard pictures work (his rules):
- Anchor the meaning in natural Taiwan usage and visually rule out the closest synonym or confusion trap. Abstract evaluations and trade-offs: show both sides (a heavy pale boulder of struggle outweighed on a scale by one tiny glowing reward). Relational, identity or spatial nouns: the reference person or place in quiet pale washes, ONLY the target in the richest, warmest color. Mutual vs one-way actions: partners combining strengths on one shared action. Transitive verbs and restrictions: clear physical contact, barriers or force vectors, never gesturing into empty space.
- One soft, harmonious palette of 3 to 5 related hues across the whole image; secondary people and context in its quieter, paler tones; the thing that carries the meaning in its deepest, most saturated tone. Never a mostly black-and-white image with one bright accent.
- Default style: tactile Taiwanese picture book (台灣繪本), chunky wax-crayon and oil-pastel edges, thick gouache brushwork, visible warm paper grain, flat hand-drawn look, never 3D or glossy. For chaos, noise, waste or absurd overreactions: deadpan vs hyper-detailed gag-anime ink with brush-pen energy lines and watercolor washes. For quiet or poetic moods and places: fine crosshatched ink under luminous watercolor.
- Pure solid white (#FFFFFF) background, at least 65% empty white space, no clutter, one unified scene, no split panels. Simple hands (at most two items per person), big readable faces that match the word's mood.
- Funny and over the top beats polite; the meaning must land at a glance.
- Words only when they genuinely help an abstract word: a short Traditional-Chinese speech bubble or sign. Never the target word itself, no captions or labels. Otherwise say "no text".`;

type Plan = { word: string; query: string; prompts: string[]; drawn?: string[] };

function planPrompt(word: string, meaning: string, sentence: string) {
  return `Chris is making a flashcard for the Taiwan Mandarin word ${word}${meaning ? ` (${meaning})` : ''}${sentence ? `, in the sentence ${sentence}` : ''}. Its picture: two drawings, and photos from Wikimedia Commons.

query: English search words for Wikimedia Commons photos that show it at a glance, with a word that rules out the wrong sense ("apple fruit", not "apple"); add Taiwan when Taiwan's version looks different (a Taiwan night market, a Taiwan scooter). For an abstract word, the photo scene that shows it best.
prompts: two picture prompts, two different takes on the word, each written for an image model, following his rules:

${PICTURE_RULES}

Reply with only this JSON: {"query": string, "prompts": [string, string]}`;
}

const picsId = (word: string) => 'w' + [...word].map((c) => c.codePointAt(0)!.toString(16)).join('-');
async function loadPlan(env: Env, word: string) {
  const r = await env.CBP.prepare("SELECT data FROM docs WHERE col = 'pics' AND id = ?").bind(picsId(word)).first<{ data: string }>();
  const p = r ? (JSON.parse(r.data) as Plan) : null;
  return p?.prompts?.length ? p : null;
}
async function savePlan(env: Env, p: Plan) {
  const data = JSON.stringify(p);
  await env.CBP.prepare("INSERT INTO docs (col, id, data, sha, updated) VALUES ('pics', ?, ?, ?, ?) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, sha = excluded.sha, updated = excluded.updated")
    .bind(picsId(p.word), data, await hex(data), Date.now()).run();
}

/** POST plus/drawings {word, meaning, sentence, again}: two drawings in his flashcard style (kept, so a card opened
 *  again shows the same ones; `again` draws two more), and Claude's search words for better photos. */
export async function drawings(env: Env, b: { word?: unknown; meaning?: unknown; sentence?: unknown; again?: unknown }) {
  const word = String(b.word ?? '').trim().slice(0, 30);
  if (!word) throw new Bad('No word.');
  let p = await loadPlan(env, word);
  if (!p) {
    const r = await ai.text(env, CARD_MODEL, planPrompt(word, String(b.meaning ?? '').slice(0, 200), String(b.sentence ?? '').slice(0, 300)), { effort: 'low' });
    const j = JSON.parse(/\{[\s\S]*\}/.exec(r.text)?.[0] ?? '{}');
    const prompts = (Array.isArray(j.prompts) ? j.prompts : []).map(String).filter(Boolean).slice(0, 2);
    p = { word, query: String(j.query || ''), prompts: prompts.length ? prompts : [word] };
    await savePlan(env, p);
  }
  const errs: string[] = [];
  if (!p.drawn?.length || b.again) {
    const made = await Promise.all(
      DRAWERS.map(async (m, i) => {
        try {
          const im = await ai.image(env, m, p!.prompts[i % p!.prompts.length]);
          return await keepMedia(env, im.bytes, im.type);
        } catch (e) {
          errs.push(String((e as Error).message).slice(0, 200));
          return null;
        }
      }),
    );
    p.drawn = [...made.filter((x): x is string => !!x), ...(p.drawn ?? [])].slice(0, 12);
    await savePlan(env, p);
  }
  return { drawn: p.drawn ?? [], query: p.query, errs };
}

// ---------- pinyin ----------
/** POST plus/pinyin {text}: the sentence's Taiwan reading, for the Pinyin field he never has to see. */
export async function pinyin(env: Env, b: { text?: unknown }) {
  const text = String(b.text ?? '').trim().slice(0, 600);
  if (!text) return { pinyin: '' };
  const r = await ai.text(env, CARD_MODEL, `Write the pinyin of this Traditional Chinese text with tone marks, using Taiwan readings (垃圾 lèsè, 星期 xīngqí). Join the syllables of a word (Wǒmen míngtiān dā huǒchē), capitalize the first word of each sentence, keep the punctuation as English punctuation, and keep the line breaks and any "- " at the start of a line. Reply with the pinyin only.

${text}`, { effort: 'low' });
  return { pinyin: r.text.trim() };
}

// ---------- the voice ----------
const VOICES = ['zh-TW-YunJheNeural', 'zh-TW-HsiaoChenNeural'];
const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
/** POST plus/voice {text}: the sentence read aloud; an exchange (one line per speaker) gets both voices. */
export async function voice(env: Env, b: { text?: unknown }) {
  if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) throw new Bad('No voice key yet.');
  const lines = String(b.text ?? '').split('\n').map((l) => l.replace(/^[-–]\s*/, '').trim()).filter(Boolean).slice(0, 8);
  if (!lines.length || lines.join('').length > 600) throw new Bad('Nothing to read.');
  const first = Math.floor(Math.random() * 2);
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-TW">${lines
    .map((l, i) => `<voice name="${VOICES[(first + i) % 2]}">${xml(l)}${i < lines.length - 1 ? '<break time="500ms"/>' : ''}</voice>`)
    .join('')}</speak>`;
  const r = await fetch(`https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'chinese-brain-plus' },
    body: ssml,
  });
  if (!r.ok) throw new Error(`voice: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return { url: await keepMedia(env, await r.arrayBuffer(), 'audio/mpeg'), voice: VOICES[first].replace(/^zh-TW-|Neural$/g, '') };
}
