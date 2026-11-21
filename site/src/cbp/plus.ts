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
    source: await source(env),
  };
}

type Push = {
  files?: Record<string, string | null>;
  docs?: { col: string; id: string; data: unknown; op?: 'set' | 'update' }[];
  check?: { day: string; outputs: Record<string, string> };
  /** Once the website is the source: the fingerprint each change was made from (null: it didn't exist). A change
   *  whose base no longer matches is not made; it comes back in `conflicts` and nothing is lost. */
  bases?: { files?: Record<string, string | null>; docs?: Record<string, string | null> };
};

/** The day the website became the source, or null while the Mac still is. */
export async function source(env: Env) {
  const r = await env.CBP.prepare("SELECT v FROM meta WHERE k = 'source'").first<{ v: string }>();
  return r?.v ?? null;
}

const fileSha = async (env: Env, name: string) => (await env.CBP.prepare('SELECT sha FROM files WHERE name = ?').bind(name).first<{ sha: string }>())?.sha ?? null;
const docRow = (env: Env, col: string, id: string) => env.CBP.prepare('SELECT data, sha, updated FROM docs WHERE col = ? AND id = ?').bind(col, id).first<{ data: string; sha: string; updated: number }>();

export async function push(env: Env, body: Push) {
  const at = Date.now();
  const src = await source(env);
  const stmts: D1Stmt[] = [];
  const conflicts: string[] = [];
  // while the Mac is the source it overwrites; afterwards every change must say what it was made from
  const fresh = async (key: string, base: string | null | undefined, now: string | null) => {
    if (!src) return true;
    if (base === undefined || base !== now) {
      conflicts.push(key);
      return false;
    }
    return true;
  };
  for (const [name, text] of Object.entries(body.files ?? {})) {
    if (!(await fresh(name, body.bases?.files?.[name], await fileSha(env, name)))) continue;
    if (text === null) stmts.push(env.CBP.prepare('DELETE FROM files WHERE name = ?').bind(name));
    else stmts.push(env.CBP.prepare('INSERT INTO files (name, text, sha, updated) VALUES (?, ?, ?, ?) ON CONFLICT (name) DO UPDATE SET text = excluded.text, sha = excluded.sha, updated = excluded.updated').bind(name, text, await hex(text), at));
  }
  for (const d of body.docs ?? []) {
    const k = `${d.col}/${d.id}`, row = await docRow(env, d.col, d.id);
    if (!(await fresh(k, body.bases?.docs?.[k], row?.sha ?? null))) continue;
    let data = d.data;
    if (d.op === 'update' && data !== null) data = { ...(row ? JSON.parse(row.data) : {}), ...(data as object) };
    if (src && row) stmts.push(...keep(env, d.col, d.id, row));
    if (data === null) stmts.push(env.CBP.prepare('DELETE FROM docs WHERE col = ? AND id = ?').bind(d.col, d.id));
    else stmts.push(putDoc(env, d.col, d.id, JSON.stringify(data), await hex(JSON.stringify(data)), at));
  }
  for (let i = 0; i < stmts.length; i += 50) await env.CBP.batch(stmts.slice(i, i + 50));
  const checks = body.check ? await check(env, body.check.day, body.check.outputs) : null;
  return { files: Object.keys(body.files ?? {}).length, docs: (body.docs ?? []).length, checks, conflicts, source: src };
}

const putDoc = (env: Env, col: string, id: string, data: string, sha: string, at: number) =>
  env.CBP.prepare('INSERT INTO docs (col, id, data, sha, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, sha = excluded.sha, updated = excluded.updated').bind(col, id, data, sha, at);
/** The version about to be replaced goes into history, unless one was kept in the last ten minutes. */
const keep = (env: Env, col: string, id: string, row: { data: string; updated: number }) => [
  env.CBP.prepare('INSERT INTO history (col, id, data, at) SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM history WHERE col = ? AND id = ? AND at > ?)').bind(col, id, row.data, row.updated, col, id, Date.now() - 600_000),
];

/** The Mac asks for the texts it doesn't have yet (by name, and documents by "col/id"). */
export async function pull(env: Env, want: { files?: string[]; docs?: string[] }) {
  const files: Record<string, { text: string; sha: string }> = {};
  for (const n of (want.files ?? []).slice(0, 500)) {
    const r = await env.CBP.prepare('SELECT text, sha FROM files WHERE name = ?').bind(n).first<{ text: string; sha: string }>();
    if (r) files[n] = r;
  }
  const docs: Record<string, { data: unknown; sha: string }> = {};
  for (const k of (want.docs ?? []).slice(0, 2000)) {
    const i = k.indexOf('/');
    const r = await docRow(env, k.slice(0, i), k.slice(i + 1));
    if (r) docs[k] = { data: JSON.parse(r.data), sha: r.sha };
  }
  return { files, docs, source: await source(env) };
}

/** Three nights running in which every check matched, ending today or yesterday (Taipei): the website becomes the
 *  source. Once it is, it stays. */
export async function switchOver(env: Env) {
  const now = await source(env);
  if (now) return { source: now, switched: false };
  const { results } = await env.CBP.prepare('SELECT day, SUM(ok) AS ok, COUNT(*) AS n FROM checks GROUP BY day ORDER BY day DESC LIMIT 3').all<{ day: string; ok: number; n: number }>();
  const good = results.length === 3 && results.every((r) => r.n >= 4 && r.ok === r.n) && results.every((r, i) => i === 0 || E.plus(r.day, 1) === results[i - 1].day) && E.cmp(results[0].day, E.plus(today(), -1)) >= 0;
  if (!good) return { source: null, switched: false, nights: results };
  await env.CBP.prepare("INSERT INTO meta (k, v) VALUES ('source', ?) ON CONFLICT (k) DO NOTHING").bind(today()).run();
  return { source: await source(env), switched: true };
}

// ---------- the board's writes (website as the source) ----------
/** What /plus may change: the board's own documents. board/data and board/cardkit stay the nightly's. */
const WRITABLE = new Set(['essays', 'reviews', 'improve', 'cards', 'notes']);
export class WriteError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
export async function write(env: Env, w: { col?: unknown; id?: unknown; op?: unknown; data?: unknown }) {
  const col = String(w.col ?? ''), id = String(w.id ?? ''), op = String(w.op ?? '');
  if (!(WRITABLE.has(col) || (col === 'board' && id === 'test')) || !/^[\w.-]{1,120}$/.test(id)) throw new WriteError('permission_denied', 'Not writable.');
  if (!(await source(env))) throw new WriteError('read_only', 'Read-only until the website is the source.');
  const row = await docRow(env, col, id);
  let data: unknown;
  if (op === 'delete') data = null;
  else if (op === 'set') data = w.data;
  else if (op === 'update') {
    if (!row) throw new WriteError('invalid_argument', 'No such document.');
    data = { ...JSON.parse(row.data), ...(w.data as object) };
  } else throw new WriteError('invalid_argument', 'Unknown write.');
  if (data !== null && (typeof data !== 'object' || Array.isArray(data))) throw new WriteError('invalid_argument', 'A document is an object.');
  const stmts = row ? keep(env, col, id, row) : [];
  const text = data === null ? '' : JSON.stringify(data);
  if (text.length > 900_000) throw new WriteError('invalid_argument', 'Too big.');
  const sha = data === null ? null : await hex(text);
  stmts.push(data === null ? env.CBP.prepare('DELETE FROM docs WHERE col = ? AND id = ?').bind(col, id) : putDoc(env, col, id, text, sha!, Date.now()));
  await env.CBP.batch(stmts);
  return { ok: true, sha };
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
    case 'source':
      return { source: await source(env) };
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
