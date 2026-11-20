// The taste test (Stage 2 of Chinese Brain Plus): the same study cards, test grades, essay corrections and card
// pictures from several models, shown to Chris side by side without saying which is which. He picks the best of each.
// Text: Claude Sonnet vs Opus (is Opus worth twice the price?); pictures: the Pollinations models his credit covers.
// The samples come from his own board (scripts/cbp-taste.py); the models answer here, a few at a time (an hourly
// cron and /api/plus/push/taste-run). An item with a fixed answer in `data.claude` adds it to the lineup.
import * as AI from './ai.ts';

type Stmt = { bind(...v: unknown[]): Stmt; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<unknown> };
type Env = {
  CBP: { prepare(sql: string): Stmt; batch(s: Stmt[]): Promise<unknown[]> };
  FILES: { put(key: string, v: ArrayBuffer, o?: unknown): Promise<unknown>; get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null> };
  ANTHROPIC_API_KEY?: string;
  GEMINI_KEY?: string;
  POLLINATIONS_KEY?: string;
};
export type Item = { id: string; job: 'card' | 'grade' | 'essay' | 'image'; ord: number; data: { title: string; show: Record<string, unknown>; prompt: string; json?: boolean; claude?: unknown; board?: unknown; prompts?: Record<string, string> } };
type Model = { model: string; kind: 'text' | 'image'; label: string };

const kindOf = (job: string) => (job === 'image' ? 'image' : 'text');

async function items(env: Env): Promise<Item[]> {
  const { results } = await env.CBP.prepare('SELECT id, job, ord, data FROM taste_items ORDER BY ord').all<{ id: string; job: Item['job']; ord: number; data: string }>();
  return results.map((r) => ({ ...r, data: JSON.parse(r.data) }));
}
const models = async (env: Env) => (await env.CBP.prepare('SELECT model, kind, label FROM taste_models ORDER BY model').all<Model>()).results;
async function runs(env: Env) {
  const { results } = await env.CBP.prepare('SELECT item, model, out, err FROM taste_runs').all<{ item: string; model: string; out: string | null; err: string | null }>();
  const m = new Map<string, { out: string | null; err: string | null }>();
  for (const r of results) m.set(`${r.item}|${r.model}`, r);
  return m;
}

/** Everyone answering an item, in a fixed shuffled order (the same each time, so a pick keeps meaning the same model). */
function lineup(it: Item, ms: Model[]) {
  const names = [...(it.data.claude != null ? ['claude'] : []), ...ms.filter((m) => m.kind === kindOf(it.job)).map((m) => m.model)].sort();
  let h = 2166136261;
  for (const c of it.id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  for (let i = names.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names;
}

// ---------- the other models answer ----------
/** Answers what's missing until the time is up or every model is out of quota. Returns what happened.
 *  Every model works through its own list at the same time, so a slow one never holds up the rest. */
export async function run(env: Env, budgetMs: number) {
  const until = Date.now() + budgetMs, done: string[] = [], out: string[] = [];
  const [its, ms, rs] = await Promise.all([items(env), models(env), runs(env)]);
  let more = false;
  await Promise.all(ms.map(async (m) => {
    for (const it of its.filter((x) => kindOf(x.job) === m.kind && !rs.has(`${x.id}|${m.model}`))) {
      if (Date.now() > until) return void (more = true);
      // "model#style" answers the item's prompt for that style (the picture round tries several styles on one model)
      const prompt = it.data.prompts?.[m.model.split('#')[1] ?? ''] ?? it.data.prompt;
      try {
        let value: string;
        if (m.kind === 'image') {
          const img = await AI.image(env, m.model, prompt);
          value = `taste/${it.id}/${m.model.replace(/[^a-z0-9.-]+/gi, '_')}`;
          await env.FILES.put(value, img.bytes, { httpMetadata: { contentType: img.type } });
        } else value = (await AI.text(env, m.model, prompt, { json: it.data.json })).text;
        await env.CBP.prepare('INSERT OR REPLACE INTO taste_runs (item, model, out, err, at) VALUES (?, ?, ?, NULL, ?)').bind(it.id, m.model, value, Date.now()).run();
        done.push(`${m.model} ${it.id}`);
      } catch (e) {
        if (e instanceof AI.Quota) return void out.push(`${m.model}: ${String((e as Error).message).slice(0, 200)}`); // done for now; the next run tries again
        await env.CBP.prepare('INSERT OR REPLACE INTO taste_runs (item, model, out, err, at) VALUES (?, ?, NULL, ?, ?)').bind(it.id, m.model, String((e as Error).message).slice(0, 1000), Date.now()).run();
        done.push(`${m.model} ${it.id} failed`);
      }
    }
  }));
  return { done, out, more };
}

// ---------- what Chris sees ----------
/** Every item whose answers are all in, each answer under a number only. */
export async function board(env: Env) {
  const [its, ms, rs, picks] = await Promise.all([items(env), models(env), runs(env), env.CBP.prepare('SELECT item, pick, note FROM taste_picks').all<{ item: string; pick: string; note: string }>()]);
  const picked = new Map(picks.results.map((p) => [p.item, p.pick]));
  const notes = new Map(picks.results.map((p) => [p.item, p.note]));
  let waiting = 0;
  const ready = [];
  for (const it of its) {
    const names = lineup(it, ms);
    const answers = names.map((n) => (n === 'claude' ? { out: it.data.claude == null ? null : typeof it.data.claude === 'string' ? it.data.claude : JSON.stringify(it.data.claude), err: null } : rs.get(`${it.id}|${n}`)));
    if (answers.some((a) => !a)) {
      waiting++;
      continue;
    }
    const p = picked.get(it.id);
    ready.push({
      id: it.id, job: it.job, title: it.data.title, show: it.data.show,
      answers: answers.map((a, n) => ({ n, out: it.job === 'image' ? (a!.out ? true : null) : a!.out, failed: !a!.out })),
      pick: p == null ? null : p === 'none' ? 'none' : names.indexOf(p),
      note: notes.get(it.id) ?? '',
    });
  }
  return { items: ready, waiting, total: its.length };
}

export async function pick(env: Env, id: string, n: number | 'none') {
  const it = (await items(env)).find((x) => x.id === id);
  if (!it) throw new Error('No such item.');
  const names = lineup(it, await models(env));
  const value = n === 'none' ? 'none' : names[n];
  if (!value) throw new Error('No such answer.');
  await env.CBP.prepare('INSERT INTO taste_picks (item, pick, at) VALUES (?, ?, ?) ON CONFLICT (item) DO UPDATE SET pick = excluded.pick, at = excluded.at').bind(id, value, Date.now()).run();
  return { ok: true };
}

/** His reason for a pick. Saved on its own, so a pick changed later keeps it. */
export async function note(env: Env, id: string, text: string) {
  const r = await env.CBP.prepare('UPDATE taste_picks SET note = ? WHERE item = ?').bind(text.slice(0, 4000), id).run() as { meta?: { changes?: number } };
  if (!r.meta?.changes) throw new Error('Pick one first.');
  return { ok: true };
}

/** A picture, by its number in the item's lineup (the model's name stays hidden). */
export async function img(env: Env, id: string, n: number) {
  const it = (await items(env)).find((x) => x.id === id);
  const name = it && lineup(it, await models(env))[n];
  const r = name ? await env.CBP.prepare('SELECT out FROM taste_runs WHERE item = ? AND model = ?').bind(id, name).first<{ out: string | null }>() : null;
  const o = r?.out ? await env.FILES.get(r.out) : null;
  if (!o) return new Response('Not found', { status: 404 });
  return new Response(o.body, { headers: { 'Content-Type': o.httpMetadata?.contentType ?? 'image/jpeg', 'Cache-Control': 'private, max-age=86400' } });
}

/** Who won each job; the names come out only here, once every item of the job is picked. */
export async function results(env: Env) {
  const [its, ms, picks] = await Promise.all([items(env), models(env), env.CBP.prepare('SELECT item, pick FROM taste_picks').all<{ item: string; pick: string }>()]);
  const label = (m: string) => (m === 'claude' ? 'Claude' : m === 'none' ? 'None good enough' : ms.find((x) => x.model === m)?.label ?? m);
  const byJob: Record<string, { items: number; picked: number; tally: Record<string, number> }> = {};
  const p = new Map(picks.results.map((x) => [x.item, x.pick]));
  for (const it of its) {
    const j = (byJob[it.job] ??= { items: 0, picked: 0, tally: {} });
    j.items++;
    const v = p.get(it.id);
    if (v) {
      j.picked++;
      j.tally[label(v)] = (j.tally[label(v)] ?? 0) + 1;
    }
  }
  for (const j of Object.values(byJob)) if (j.picked < j.items) j.tally = {};
  return byJob;
}

/** The Mac sends the samples (scripts/cbp-taste.py) and who takes the test. */
export async function load(env: Env, body: { items?: Item[]; models?: Model[] }) {
  const st: Stmt[] = [];
  for (const it of body.items ?? []) st.push(env.CBP.prepare('INSERT OR REPLACE INTO taste_items (id, job, ord, data) VALUES (?, ?, ?, ?)').bind(it.id, it.job, it.ord, JSON.stringify(it.data)));
  if (body.models) {
    st.push(env.CBP.prepare('DELETE FROM taste_models'));
    for (const m of body.models) st.push(env.CBP.prepare('INSERT INTO taste_models (model, kind, label) VALUES (?, ?, ?)').bind(m.model, m.kind, m.label));
  }
  for (let i = 0; i < st.length; i += 50) await env.CBP.batch(st.slice(i, i + 50));
  return { items: (body.items ?? []).length, models: body.models?.length ?? null };
}
