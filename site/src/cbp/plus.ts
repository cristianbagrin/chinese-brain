// Chinese Brain Plus on the Worker: the data in the CBP database, the engine on top of it, the Mac's push
// (Stage 1, while the Mac is still the source) and the connector Claude sessions use.
//   files   the Chinese system's texts (engine.ts reads them by name)
//   docs    the board's documents: essays, reviews, improve, cards, board/*
//   checks  each night's comparison of the engine with words.py
import * as E from './engine.ts';

type Env = { CBP: D1Database; CBP_PUSH_KEY?: string };
type D1Database = {
  prepare(sql: string): D1Stmt;
  batch(s: D1Stmt[]): Promise<unknown[]>;
};
type D1Stmt = {
  bind(...v: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};

const enc = new TextEncoder();
export async function hex(text: string) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
/** Today in Taipei, where Chris lives (words.py uses the Mac's local date). */
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
const day = (d: unknown) => (typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d) ? d : today());

// ---------- files ----------
let cache: { stamp: string; files: E.Files } | null = null;
/** All files, from a copy kept between requests while nothing changed (the engine changes what it gets). */
export async function loadFiles(env: Env): Promise<E.Files> {
  const s = await env.CBP.prepare('SELECT MAX(updated) AS m, COUNT(*) AS n FROM files').first<{ m: number; n: number }>();
  const stamp = `${s?.m}|${s?.n}`;
  if (cache?.stamp !== stamp) {
    const { results } = await env.CBP.prepare('SELECT name, text FROM files').all<{ name: string; text: string }>();
    cache = { stamp, files: new Map(results.map((r) => [r.name, r.text])) };
  }
  return new Map(cache.files);
}

export async function listDocs(env: Env, col: string) {
  const { results } = await env.CBP.prepare('SELECT id, data, updated FROM docs WHERE col = ? ORDER BY id').bind(col).all<{ id: string; data: string; updated: number }>();
  return results.map((r) => ({ id: r.id, data: JSON.parse(r.data), updated: r.updated }));
}
export async function getDoc(env: Env, col: string, id: string) {
  const r = await env.CBP.prepare('SELECT data FROM docs WHERE col = ? AND id = ?').bind(col, id).first<{ data: string }>();
  return r ? JSON.parse(r.data) : null;
}

// ---------- the Mac's push ----------
/** What the database holds, by fingerprint, so the Mac sends only what changed. */
export async function manifest(env: Env) {
  const f = await env.CBP.prepare('SELECT name, sha FROM files').all<{ name: string; sha: string }>();
  const d = await env.CBP.prepare('SELECT col, id, sha FROM docs').all<{ col: string; id: string; sha: string }>();
  return {
    files: Object.fromEntries(f.results.map((r) => [r.name, r.sha])),
    docs: Object.fromEntries(d.results.map((r) => [`${r.col}/${r.id}`, r.sha])),
  };
}

type Push = {
  files?: Record<string, string | null>;
  docs?: { col: string; id: string; data: unknown }[];
  check?: { day: string; outputs: Record<string, string> };
};

export async function push(env: Env, body: Push) {
  const at = Date.now();
  const stmts: D1Stmt[] = [];
  for (const [name, text] of Object.entries(body.files ?? {})) {
    if (text === null) stmts.push(env.CBP.prepare('DELETE FROM files WHERE name = ?').bind(name));
    else stmts.push(env.CBP.prepare('INSERT INTO files (name, text, sha, updated) VALUES (?, ?, ?, ?) ON CONFLICT (name) DO UPDATE SET text = excluded.text, sha = excluded.sha, updated = excluded.updated').bind(name, text, await hex(text), at));
  }
  for (const d of body.docs ?? []) {
    if (d.data === null) stmts.push(env.CBP.prepare('DELETE FROM docs WHERE col = ? AND id = ?').bind(d.col, d.id));
    else {
      const data = JSON.stringify(d.data);
      stmts.push(env.CBP.prepare('INSERT INTO docs (col, id, data, sha, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, sha = excluded.sha, updated = excluded.updated').bind(d.col, d.id, data, await hex(data), at));
    }
  }
  for (let i = 0; i < stmts.length; i += 50) await env.CBP.batch(stmts.slice(i, i + 50));
  const checks = body.check ? await check(env, body.check.day, body.check.outputs) : null;
  return { files: Object.keys(body.files ?? {}).length, docs: (body.docs ?? []).length, checks };
}

/** The engine's answers, by the names the Mac uses for words.py's (same command, same day). */
export function engineOutputs(files: E.Files, d: string): Record<string, string> {
  return {
    status: E.statusText(files, d),
    test: E.testPlanText(files, d),
    'test --all': E.testPlanText(files, d, true),
    board: E.pyJson(E.boardPayload(files, d)),
  };
}

/** Compare words.py's outputs with the engine's on the files just pushed; keep the result. */
async function check(env: Env, d: string, outputs: Record<string, string>) {
  const mine = engineOutputs(await loadFiles(env), d);
  const at = Date.now();
  const out: Record<string, boolean> = {};
  const stmts = Object.entries(outputs).map(([name, theirs]) => {
    const ok = mine[name] === theirs;
    out[name] = ok;
    let detail = '';
    if (!ok) {
      const a = theirs.split('\n'), b = (mine[name] ?? '').split('\n');
      const i = a.findIndex((x, k) => x !== b[k]);
      const k = i < 0 ? a.length : i;
      detail = `line ${k + 1}\nwords.py: ${a[k] ?? ''}\nengine:   ${b[k] ?? ''}`;
    }
    return env.CBP.prepare('INSERT INTO checks (day, name, ok, detail, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (day, name) DO UPDATE SET ok = excluded.ok, detail = excluded.detail, at = excluded.at').bind(d, name, ok ? 1 : 0, detail, at);
  });
  if (stmts.length) await env.CBP.batch(stmts);
  return out;
}

export async function checks(env: Env) {
  const { results } = await env.CBP.prepare('SELECT day, name, ok, detail FROM checks ORDER BY day DESC, name LIMIT 60').all();
  return results;
}

// ---------- reading, for the board and Claude ----------
export async function read(env: Env, what: string, q: URLSearchParams) {
  const d = day(q.get('day'));
  switch (what) {
    case 'status':
      return { day: d, text: E.statusText(await loadFiles(env), d) };
    case 'test':
      return { day: d, text: E.testPlanText(await loadFiles(env), d, q.get('all') === '1') };
    case 'board':
      return E.boardPayload(await loadFiles(env), d);
    case 'db': {
      const col = q.get('col') ?? '', id = q.get('id');
      return id ? getDoc(env, col, id) : listDocs(env, col);
    }
    case 'checks':
      return checks(env);
    default:
      return undefined;
  }
}

// ---------- the connector (MCP over HTTP, for Claude sessions) ----------
// Read-only while the Mac is the source. Its address carries the secret: /mcp/<CBP_MCP_KEY>.
const TOOLS = [
  { name: 'status', description: "Chris's Chinese status: words known, queue, tests waiting, the sprint (words.py status).", inputSchema: { type: 'object', properties: { day: { type: 'string', description: 'YYYY-MM-DD, default today in Taipei' } } } },
  { name: 'test_plan', description: "Today's test plan from the test log (words.py test).", inputSchema: { type: 'object', properties: { day: { type: 'string' }, all: { type: 'boolean', description: 'every item, not only those due' } } } },
  { name: 'list_files', description: 'The Chinese system files (known-words.txt, learn-next.md, test-log.tsv, sprints, Chinese Brain exports, Anki exports, history.md, monthly-test.md...).', inputSchema: { type: 'object', properties: {} } },
  { name: 'read_file', description: 'One Chinese system file, whole.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'list_docs', description: "The board's documents in one collection: essays, reviews, improve, cards or board. Returns ids with their last change.", inputSchema: { type: 'object', properties: { col: { type: 'string' } }, required: ['col'] } },
  { name: 'get_docs', description: "Board documents by id (essays d001..., reviews, improve, cards, board/data|test|cardkit). Several ids at once.", inputSchema: { type: 'object', properties: { col: { type: 'string' }, ids: { type: 'array', items: { type: 'string' } } }, required: ['col', 'ids'] } },
];

async function tool(env: Env, name: string, a: Record<string, unknown>) {
  const files = () => loadFiles(env);
  switch (name) {
    case 'status':
      return E.statusText(await files(), day(a.day));
    case 'test_plan':
      return E.testPlanText(await files(), day(a.day), !!a.all);
    case 'list_files':
      return [...(await files()).keys()].sort().join('\n');
    case 'read_file': {
      const t = (await files()).get(String(a.name));
      if (t === undefined) throw new Error(`No file called ${a.name}. list_files shows them.`);
      return t;
    }
    case 'list_docs': {
      const { results } = await env.CBP.prepare('SELECT id, updated FROM docs WHERE col = ? ORDER BY id').bind(String(a.col)).all<{ id: string; updated: number }>();
      return results.map((r) => `${r.id}\t${new Date(r.updated).toISOString().slice(0, 10)}`).join('\n') || `No documents in ${a.col}.`;
    }
    case 'get_docs': {
      const ids = (Array.isArray(a.ids) ? a.ids : []).slice(0, 50).map(String);
      const out: Record<string, unknown> = {};
      for (const id of ids) out[id] = await getDoc(env, String(a.col), id);
      return JSON.stringify(out, null, 1);
    }
  }
  throw new Error(`Unknown tool ${name}.`);
}

export async function mcp(env: Env, msg: { id?: unknown; method?: string; params?: Record<string, unknown> }) {
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id: msg.id, result });
  switch (msg.method) {
    case 'initialize':
      return ok({ protocolVersion: (msg.params?.protocolVersion as string) ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'Chinese Brain', version: '1' } });
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: TOOLS });
    case 'tools/call': {
      const p = msg.params ?? {};
      try {
        const text = await tool(env, String(p.name), (p.arguments as Record<string, unknown>) ?? {});
        return ok({ content: [{ type: 'text', text }] });
      } catch (e) {
        return ok({ content: [{ type: 'text', text: String((e as Error).message) }], isError: true });
      }
    }
  }
  if (msg.id === undefined) return null; // a notification
  return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } };
}
