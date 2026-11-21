// One account for all of Chris's apps (Chinese Brain, At Peace, Money in Order, Ten Dollar Words), and
// Chinese Brain's website. Every account is its own Durable Object with a small SQLite database (the
// password hash, sessions, and each app's synced items), found by email. Each app syncs its own keys:
// Chinese Brain's have no prefix, the others' start with @<app>/ (see APPS), and an app only ever reads
// and writes its own. `@account/` is the account's own, shared by every app: its keyring (the master key
// that apps wrap their data keys under, see public/acct/keyring.js). After an email change the new address
// is an alias that points at the account.
// Nothing here needs setting up besides the RESEND_API_KEY secret for password-reset emails
// (and, to see who signed up at /admin, an ADMIN_KEY secret of your choosing; to change the
// pages' words at /edit, an EDIT_KEY secret: see "Editing the pages" below).
import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers';
import { annotate, clean, PAGES } from './src/copy.ts';
import * as plus from './src/cbp/plus.ts';
import * as taste from './src/cbp/taste.ts';
import * as ai from './src/cbp/ai.ts';
import * as cards from './src/cbp/cards.ts';

const MAX_BODY = 1_500_000;
const MAX_ITEMS = 60_000;
const MAX_VALUE = 32_000;
const PAGE = 1000;
const SYNCED = /^(w:|sav:|exh:|gex:).{1,60}$|^settings$/;
/** The other apps and what they're called in emails. Chinese Brain is the default (no prefix). */
const APPS = { ap: 'At Peace', mio: 'Money in Order', tdw: 'Ten Dollar Words' };
const APP_KEY = /^@([a-z]{2,8})\/[^\0]{1,200}$/;
/** `app` for the items every app shares (sync with app: 'account'). Written only with a precondition (see _sync). */
const SHARED = 'account';
/** Which keys belong to `app`: '' is Chinese Brain. */
const keyOf = (app, k) => (app ? APP_KEY.test(k) && k.startsWith(`@${app}/`) : SYNCED.test(k));
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@.]{2,}$/;

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const random = (n) => b64(crypto.getRandomValues(new Uint8Array(n)));
const sha = async (s) => b64(await crypto.subtle.digest('SHA-256', enc.encode(s)));

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: 100_000 }, key, 256));
}

function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** JSON with object keys in order, so the same data from any browser is the same text. */
function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}

const list = (x) => (Array.isArray(x) ? x.filter((y) => y && typeof y === 'object') : []);

/**
 * One word, changed in two browsers: the status is the one set last; the history, the
 * sentences it was met in (the newest five) and the lookup count come from both.
 */
function mergeWord(a, b) {
  const [older, newer] = (a.updated ?? 0) > (b.updated ?? 0) ? [b, a] : [a, b];
  const hist = [...list(a.hist), ...list(b.hist)].sort((x, y) => x.t - y.t).filter((x, i, all) => !i || x.t !== all[i - 1].t || x.s !== all[i - 1].s);
  const seen = new Set();
  const ctx = [...list(a.ctx), ...list(b.ctx)].sort((x, y) => y.at - x.at).filter((x) => !seen.has(x.text) && seen.add(x.text)).slice(0, 5);
  const added = Math.min(Number(a.added) || Infinity, Number(b.added) || Infinity);
  return { ...older, ...newer, added: Number.isFinite(added) ? added : Date.now(), hist, ctx, looks: Math.max(Number(a.looks) || 0, Number(b.looks) || 0) };
}

/** An error the person can read; `code` lets the pages react to it. */
class Fail extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, code, message) => ({ fail: { status, code, message } });

export class Account extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    // Tables are made at sign-up: a sign-in try for an email without an account stores nothing.
    this.made = this.sql.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'").toArray().length > 0;
    // Accounts made before a table was added get it now (the emails table came later: without
    // it, opening an older account failed with a server error).
    if (this.made) this.tables();
  }

  tables() {
    this.made = true;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS sessions (h TEXT PRIMARY KEY, created INTEGER, seen INTEGER);
      CREATE TABLE IF NOT EXISTS resets (h TEXT PRIMARY KEY, exp INTEGER);
      CREATE TABLE IF NOT EXISTS emails (h TEXT PRIMARY KEY, email TEXT, exp INTEGER);
      CREATE TABLE IF NOT EXISTS items (k TEXT PRIMARY KEY, v TEXT, t INTEGER, seq INTEGER);
      CREATE INDEX IF NOT EXISTS items_seq ON items (seq);
      CREATE TABLE IF NOT EXISTS guarded (k TEXT PRIMARY KEY);
    `);
  }

  get(k) {
    if (!this.made) return undefined;
    return this.sql.exec('SELECT v FROM meta WHERE k = ?', k).toArray()[0]?.v;
  }
  set(k, v) {
    this.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v', k, String(v));
  }

  /** Tell the directory this account exists and was used today (once a day is enough). */
  async report() {
    const day = Math.floor(Date.now() / 86_400_000);
    if (Number(this.get('reported')) === day) return;
    this.set('reported', day);
    await this.env.DIRECTORY.get(this.env.DIRECTORY.idFromName('all')).seen(this.get('email'), Number(this.get('created')), Number(this.get('count') ?? 0));
  }

  async newSession() {
    const secret = random(32);
    const now = Date.now();
    this.sql.exec('INSERT INTO sessions (h, created, seen) VALUES (?, ?, ?)', await sha(secret), now, now);
    return `${this.ctx.id.toString()}.${secret}`;
  }

  async setPassword(password) {
    const salt = random(16);
    this.set('salt', salt);
    this.set('hash', await hashPassword(password, salt));
  }

  async checkPassword(password) {
    const lock = Number(this.get('lock') ?? 0);
    if (lock > Date.now()) return fail(429, 'locked', `Too many tries. Try again in ${Math.ceil((lock - Date.now()) / 60_000)} min, or reset your password.`);
    if (same(await hashPassword(password, this.get('salt')), this.get('hash'))) {
      this.set('fails', 0);
      return null;
    }
    const fails = Number(this.get('fails') ?? 0) + 1;
    this.set('fails', fails);
    // From the fifth wrong password on: wait 1, 2, 4… minutes (an hour at most).
    if (fails >= 5) this.set('lock', Date.now() + Math.min(60, 2 ** (fails - 5)) * 60_000);
    return fail(401, 'wrong', 'That email and password don’t match.');
  }

  /** An account lives here (its own, not an alias). */
  taken() {
    return !!this.get('email');
  }
  /** This address belongs to an account elsewhere (an email change): that account's id. */
  alias() {
    return this.get('alias') || null;
  }
  /** Hold this address for the account `id` (it changed its email to this one). */
  claim(id) {
    if (this.get('email') || (this.alias() && this.alias() !== id)) return false;
    this.tables();
    this.set('alias', id);
    return true;
  }
  /** The account `id` left this address. */
  async release(id) {
    if (this.alias() !== id) return;
    await this.ctx.storage.deleteAll();
    this.made = false;
  }

  async signup(email, password) {
    if (this.get('email') || this.alias()) return fail(409, 'exists', 'This email already has an account. Sign in instead.');
    this.tables();
    this.set('email', email);
    this.set('created', Date.now());
    this.set('seq', 0);
    await this.setPassword(password);
    await this.report();
    return { token: await this.newSession(), email };
  }

  /** `email` is the address typed: after an email change the old one no longer signs in. */
  async login(password, email) {
    if (!this.get('email') || (email && email !== this.get('email'))) return fail(401, 'wrong', 'That email and password don’t match.');
    return (await this.checkPassword(password)) ?? { token: await this.newSession(), email: this.get('email') };
  }

  /** The session behind a token's secret, or null. */
  async auth(secret) {
    if (!this.get('email')) return null;
    const h = await sha(secret);
    const row = this.sql.exec('SELECT seen FROM sessions WHERE h = ?', h).toArray()[0];
    if (!row) return null;
    if (Date.now() - row.seen > 3_600_000) {
      this.sql.exec('UPDATE sessions SET seen = ? WHERE h = ?', Date.now(), h);
      await this.report();
    }
    return h;
  }

  async call(secret, method, ...args) {
    const h = await this.auth(secret);
    if (!h) return fail(401, 'signed_out', 'You’re signed out. Sign in again.');
    return this[`_${method}`](h, ...args);
  }

  /** Who this is, and nothing else: one row, for checks on every request (_me counts every item; the Plus pages
   *  call on every picture and save, which ran past the free tier's daily rows-read limit on 2026-11-20). */
  _who() {
    return { email: this.get('email') };
  }

  _me() {
    // key ranges, not LIKE: each count reads only its own items, not the whole table again
    const count = (from, to) => this.sql.exec('SELECT COUNT(*) AS n FROM items WHERE k >= ? AND k < ? AND v IS NOT NULL', from, to).one().n;
    const n = count('w:', 'w;');
    const apps = { brain: n };
    for (const app of Object.keys(APPS)) apps[app] = count(`@${app}/`, `@${app}0`);
    const pending = this.made ? this.sql.exec('SELECT email FROM emails WHERE exp > ? ORDER BY exp DESC LIMIT 1', Date.now()).toArray()[0]?.email : undefined;
    return { email: this.get('email'), created: Number(this.get('created')), words: n, apps, pendingEmail: pending ?? null };
  }

  /** Ask to move the account to a new address: a one-day link goes to that address. */
  async _email(_h, password, email) {
    const bad = await this.checkPassword(password);
    if (bad) return bad.fail.code === 'wrong' ? fail(401, 'wrong', 'That password isn’t right.') : bad;
    if (email === this.get('email')) return fail(400, 'same', 'That’s already your email.');
    if (email !== (this.get('home') || this.get('email'))) {
      const there = this.env.ACCOUNT.get(this.env.ACCOUNT.idFromName(email));
      const alias = await there.alias();
      if ((alias && alias !== this.ctx.id.toString()) || (await there.taken())) return fail(409, 'exists', 'That email already has an account.');
    }
    this.sql.exec('DELETE FROM emails WHERE exp < ?', Date.now());
    if (this.sql.exec('SELECT COUNT(*) AS n FROM emails').one().n >= 3) return fail(429, 'slow', 'Too many open requests. Use a link you were sent, or try again tomorrow.');
    const secret = random(32);
    this.sql.exec('INSERT INTO emails (h, email, exp) VALUES (?, ?, ?)', await sha(secret), email, Date.now() + 86_400_000);
    return { email, old: this.get('email'), token: `${this.ctx.id.toString()}.${secret}` };
  }

  /** The link from the new address was opened: the account answers to it from now on. */
  async finishEmail(secret) {
    const row = this.get('email') && this.sql.exec('SELECT email, exp FROM emails WHERE h = ?', await sha(secret)).toArray()[0];
    if (!row || row.exp < Date.now()) return fail(400, 'expired', 'This link has expired or was already used. Ask for a new one on your account page.');
    const id = this.ctx.id.toString();
    const old = this.get('email');
    const home = this.get('home') || old; // the address this account's database is named after
    const next = row.email;
    if (next !== home) {
      const ok = await this.env.ACCOUNT.get(this.env.ACCOUNT.idFromName(next)).claim(id);
      if (!ok) return fail(409, 'exists', 'That email already has an account.');
    }
    if (old !== home) await this.env.ACCOUNT.get(this.env.ACCOUNT.idFromName(old)).release(id);
    this.set('home', home);
    this.set('email', next);
    this.sql.exec('DELETE FROM emails');
    const dir = this.env.DIRECTORY.get(this.env.DIRECTORY.idFromName('all'));
    await dir.remove(old);
    await dir.seen(next, Number(this.get('created')), Number(this.get('count') ?? 0));
    return { email: next, old };
  }

  _logout(h) {
    this.sql.exec('DELETE FROM sessions WHERE h = ?', h);
    return { ok: true };
  }

  async _password(h, old, next) {
    const bad = await this.checkPassword(old);
    if (bad) return bad.fail.code === 'wrong' ? fail(401, 'wrong', 'Your current password isn’t right.') : bad;
    await this.setPassword(next);
    // Everywhere else is signed out.
    this.sql.exec('DELETE FROM sessions WHERE h != ?', h);
    return { ok: true };
  }

  async _remove(_h, password) {
    const bad = await this.checkPassword(password);
    if (bad) return bad.fail.code === 'wrong' ? fail(401, 'wrong', 'That password isn’t right.') : bad;
    await this.env.DIRECTORY.get(this.env.DIRECTORY.idFromName('all')).remove(this.get('email'));
    const home = this.get('home');
    if (home && home !== this.get('email')) await this.env.ACCOUNT.get(this.env.ACCOUNT.idFromName(this.get('email'))).release(this.ctx.id.toString());
    await this.ctx.storage.deleteAll();
    this.made = false;
    return { ok: true };
  }

  _export(_h, app) {
    const items = {};
    for (const r of this.sql.exec('SELECT k, v FROM items WHERE v IS NOT NULL')) if (app === undefined || keyOf(app, r.k)) items[r.k] = JSON.parse(r.v);
    return { email: this.get('email'), exported: new Date().toISOString(), items };
  }

  /**
   * Take this device's changes (the newer one wins, per item) and hand back everyone else's.
   *
   * A change with `if` (the `s` its item had when this device read it, 0 for none) is a compare-and-set: it
   * lands only if the item is still at that `s`, whatever the times say, and is otherwise refused (listed in
   * `rejected`, and the item as it is now comes back). An item once written that way is guarded: a change
   * without `if` no longer replaces it, so an older app that knows nothing of preconditions can't write over a
   * keyring a newer one wrote. `@account/` items always need `if`.
   */
  _sync(_h, since, changes, app = '') {
    const now = Date.now();
    const seq0 = Number(this.get('seq') ?? 0);
    let seq = seq0;
    const mine = new Set();
    const rejected = new Set();
    // How many items the account holds is kept, not counted: counting reads every row.
    let count = this.get('count');
    count = count === undefined ? this.sql.exec('SELECT COUNT(*) AS n FROM items').one().n : Number(count);
    const count0 = count;
    for (const c of changes) {
      if (!c || typeof c.k !== 'string' || !keyOf(app, c.k)) continue;
      const word = c.k.startsWith('w:');
      if (word && c.v != null && (typeof c.v !== 'object' || Array.isArray(c.v))) continue;
      const v = c.v == null ? null : canon(c.v);
      if (v && v.length > MAX_VALUE) continue;
      const t = Math.min(Number(c.t) || 0, now);
      const old = this.sql.exec('SELECT v, t, seq FROM items WHERE k = ?', c.k).toArray()[0];
      const cond = c.if !== undefined && c.if !== null;
      if (cond) {
        if (!Number.isSafeInteger(c.if) || c.if !== (old?.seq ?? 0)) {
          rejected.add(c.k);
          continue;
        }
      } else if (app === SHARED || this.sql.exec('SELECT 1 FROM guarded WHERE k = ?', c.k).toArray().length) {
        rejected.add(c.k);
        continue;
      }
      if (!old && count >= MAX_ITEMS) return fail(413, 'full', 'This account’s word list is full.');
      let next = v;
      if (cond) {
        // The precondition held: this change replaces the item as it is.
      } else if (old?.v && v && word) {
        // The same word changed in two browsers: keep both sides (see mergeWord).
        next = canon(mergeWord(JSON.parse(old.v), c.v));
      } else if (old && old.t > t) continue; // a newer change from another browser stays
      if (cond) this.sql.exec('INSERT OR IGNORE INTO guarded (k) VALUES (?)', c.k);
      if (next === v) mine.add(c.k); // a merged word goes back to the browser that sent it, too
      if (old && next === old.v) continue; // nothing new: no write, and nothing for the others to fetch
      if (!old) count++;
      this.sql.exec('INSERT INTO items (k, v, t, seq) VALUES (?, ?, ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, t = excluded.t, seq = excluded.seq', c.k, next, Math.max(t, old?.t ?? 0), ++seq);
    }
    if (seq !== seq0) this.set('seq', seq);
    if (count !== count0 || this.get('count') === undefined) this.set('count', count);
    // Only this app's items come back; the others' are skipped over.
    const mineOnly = app ? "k LIKE ? || '/%'" : "substr(k, 1, 1) != ?";
    const rows = this.sql.exec(`SELECT k, v, t, seq FROM items WHERE seq > ? AND ${mineOnly} ORDER BY seq LIMIT ?`, Number(since) || 0, app ? `@${app}` : '@', PAGE + 1).toArray();
    const more = rows.length > PAGE;
    const page = rows.slice(0, PAGE);
    // A refused change: the item as it is now, so the device can see what it lost to.
    for (const k of rejected) {
      if (page.some((r) => r.k === k)) continue;
      const r = this.sql.exec('SELECT k, v, t, seq FROM items WHERE k = ?', k).toArray()[0];
      if (r) page.push(r);
    }
    return {
      seq: more ? rows[PAGE - 1].seq : seq,
      more,
      changes: page.filter((r) => !mine.has(r.k)).map((r) => ({ k: r.k, v: r.v == null ? null : JSON.parse(r.v), t: r.t, s: r.seq })),
      ...(rejected.size ? { rejected: [...rejected] } : {}),
    };
  }

  /** A one-hour link to set a new password; null when there is no such account. */
  async startReset(email) {
    if (!this.get('email') || (email && email !== this.get('email'))) return null;
    this.sql.exec('DELETE FROM resets WHERE exp < ?', Date.now());
    if (this.sql.exec('SELECT COUNT(*) AS n FROM resets').one().n >= 3) return null; // three open links are plenty
    const secret = random(32);
    this.sql.exec('INSERT INTO resets (h, exp) VALUES (?, ?)', await sha(secret), Date.now() + 3_600_000);
    return { email: this.get('email'), token: `${this.ctx.id.toString()}.${secret}` };
  }

  async finishReset(secret, password) {
    const h = await sha(secret);
    const row = this.get('email') && this.sql.exec('SELECT exp FROM resets WHERE h = ?', h).toArray()[0];
    if (!row || row.exp < Date.now()) return fail(400, 'expired', 'This link has expired or was already used. Ask for a new one.');
    await this.setPassword(password);
    this.sql.exec('DELETE FROM resets');
    this.sql.exec('DELETE FROM sessions');
    this.set('fails', 0);
    this.set('lock', 0);
    return { token: await this.newSession(), email: this.get('email') };
  }
}

/**
 * The one list of who has an account: email, when it was made, when it was last used.
 * Accounts live in separate databases, so without this there is no way to count them.
 */
export class Directory extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, created INTEGER, seen INTEGER, words INTEGER)');
  }
  seen(email, created, words) {
    this.sql.exec('INSERT INTO users (email, created, seen, words) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO UPDATE SET seen = excluded.seen, words = excluded.words', email, created, Date.now(), words);
  }
  remove(email) {
    this.sql.exec('DELETE FROM users WHERE email = ?', email);
  }
  list() {
    const week = Date.now() - 7 * 86_400_000;
    const users = this.sql.exec('SELECT email, created, seen, words FROM users ORDER BY created DESC LIMIT 5000').toArray();
    const one = (q, ...a) => this.sql.exec(q, ...a).one().n;
    return { total: one('SELECT COUNT(*) AS n FROM users'), newThisWeek: one('SELECT COUNT(*) AS n FROM users WHERE created > ?', week), activeThisWeek: one('SELECT COUNT(*) AS n FROM users WHERE seen > ?', week), users };
  }
}

/** Counts tries per address, in memory: enough to stop a script hammering sign-up or reset. */
export class Limiter extends DurableObject {
  hits = [];
  take(max, windowMs) {
    const now = Date.now();
    this.hits = this.hits.filter((t) => now - t < windowMs);
    if (this.hits.length >= max) return false;
    this.hits.push(now);
    return true;
  }
}

/**
 * Chris's edits to the pages' words (/edit), kept in one small database so they outlive every
 * deploy: { v: version, edits: { name: { to?: new HTML, gone?: true, was: the source's words, page, at } } }.
 * The one before the last save is kept too ("previous"), in case a save goes wrong.
 */
// Calls that some providers refuse from where the Worker happens to run (Gemini: not from Hong Kong, which is where
// Cloudflare often serves Taiwan). One instance, created with a western-North-America location hint (src/cbp/ai.ts).
export class Relay extends DurableObject {
  async call(url, init) {
    // a model that hangs gives up after two minutes instead of holding everything behind it
    let r;
    try {
      r = await fetch(url, { ...init, signal: AbortSignal.timeout(295_000) });
    } catch (e) {
      return { status: 504, type: 'text/plain', body: new TextEncoder().encode(`timed out: ${e?.message ?? e}`).buffer };
    }
    return { status: r.status, type: r.headers.get('Content-Type') ?? '', body: await r.arrayBuffer() };
  }
}

/** Production's AI for the staging copy, which has no keys of its own (its BRAINS service binding, wrangler.jsonc):
 *  text and pictures on production's keys. Only Workers on this Cloudflare account can bind to it. A provider's
 *  "not now" crosses as an error starting "QUOTA: " (ai.ts turns it back into one). */
export class Brains extends WorkerEntrypoint {
  async text(model, input, opts) {
    return brains(() => ai.text(this.env, model, input, opts));
  }
  async image(model, prompt) {
    return brains(() => ai.image(this.env, model, prompt));
  }
}
async function brains(f) {
  try {
    return await f();
  } catch (e) {
    throw new Error((e instanceof ai.Quota ? 'QUOTA: ' : '') + String(e?.message ?? e));
  }
}

export class Copy extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS copy (k TEXT PRIMARY KEY, v TEXT)');
  }
  read() {
    const row = this.sql.exec("SELECT v FROM copy WHERE k = 'edits'").toArray()[0];
    return row ? JSON.parse(row.v) : { v: 0, edits: {} };
  }
  /** `updates`: name -> the new edit, or null to drop it. */
  apply(updates) {
    const doc = this.read();
    const put = (k, v) => this.sql.exec('INSERT INTO copy (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v', k, v);
    put('previous', JSON.stringify(doc));
    for (const [k, e] of Object.entries(updates)) {
      if (e) doc.edits[k] = e;
      else delete doc.edits[k];
    }
    doc.v += 1;
    put('edits', JSON.stringify(doc));
    return doc;
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } });

function credentials(body, withEmail = true) {
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (withEmail && !EMAIL.test(email)) throw new Fail(400, 'email', 'That doesn’t look like an email address.');
  if (password.length < 8) throw new Fail(400, 'short', 'Use at least 8 characters for your password.');
  if (password.length > 200) throw new Fail(400, 'long', 'That password is too long.');
  return { email, password };
}

async function limit(env, request, what, max, windowMs) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  const ok = await env.LIMITER.get(env.LIMITER.idFromName(`${what}:${ip}`)).take(max, windowMs);
  if (!ok) throw new Fail(429, 'slow', 'Too many tries from here. Wait a little and try again.');
}

/** The account a token belongs to, and the token's secret. */
function byToken(env, token) {
  const [id, secret] = String(token ?? '').split('.');
  try {
    if (!secret) throw 0;
    return { account: env.ACCOUNT.get(env.ACCOUNT.idFromString(id)), secret };
  } catch {
    throw new Fail(401, 'signed_out', 'You’re signed out. Sign in again.');
  }
}

/** The page with the link: the shared account site, else this one. */
const accountSite = (env) => env.ACCOUNT_SITE ?? env.SITE;
const appName = (app) => APPS[app] ?? (app === 'brain' ? 'Chinese Brain' : null);

async function mail(env, to, subject, lines, button) {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const text = [...lines, ...(button ? [`${button.label}: ${button.href}`] : []), '', 'cristianbagrin.com'].join('\n\n');
  const p = (t) => `<p>${esc(t)}</p>`;
  const html = `<div style="font:16px/1.6 -apple-system,Segoe UI,sans-serif;color:#1e1a18;max-width:480px">${p(lines[0])}${button ? `<p><a href="${button.href}" style="display:inline-block;padding:11px 20px;border-radius:8px;background:#1e1a18;color:#fff;font-weight:600;text-decoration:none">${esc(button.label)}</a></p>` : ''}${lines.slice(1).map((l) => `<p style="color:#5e5650;font-size:14px">${esc(l)}</p>`).join('')}<p style="color:#5e5650;font-size:14px"><a href="https://cristianbagrin.com" style="color:#5e5650">cristianbagrin.com</a></p></div>`;
  const res = await fetch(env.MAIL_API ?? 'https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], reply_to: env.SUPPORT, subject, text, html }),
  });
  if (!res.ok) console.error('email failed', subject, res.status, await res.text());
  return res.ok;
}

const sendReset = (env, email, token, app) =>
  mail(env, email, 'Reset your password', [`Someone asked to reset the password for your account${appName(app) ? ` (used in ${appName(app)})` : ''}.`, 'The link works for one hour. If that wasn’t you, ignore this email: your password stays as it is.'], { label: 'Set a new password', href: `${accountSite(env)}/reset#${token}` });

const sendEmailConfirm = (env, email, token) =>
  mail(env, email, 'Confirm your new email', ['Confirm this address to make it your account’s email. You’ll sign in with it from then on, in every app.', 'The link works for one day. If you didn’t ask for this, ignore this email: nothing changes.'], { label: 'Confirm my new email', href: `${accountSite(env)}/account#confirm=${token}` });

const sendEmailChanged = (env, old, next) =>
  mail(env, old, 'Your account email changed', [`Your account now uses ${next}. This address no longer signs in.`, `If you didn’t do this, write to ${env.SUPPORT} right away.`]);

/** The account an email signs in to: its own database, or the account it was moved to. */
async function byEmail(env, email) {
  const own = env.ACCOUNT.get(env.ACCOUNT.idFromName(email));
  const alias = await own.alias();
  return alias ? env.ACCOUNT.get(env.ACCOUNT.idFromString(alias)) : own;
}

/** `app` from a request: one of APPS, or '' for Chinese Brain. */
function appOf(v) {
  const app = String(v ?? '');
  if (app === '' || app === 'brain') return '';
  if (app === SHARED) return app;
  if (!Object.hasOwn(APPS, app)) throw new Fail(400, 'app', 'Unknown app.');
  return app;
}

// ---------- Release switches ----------
// Anything new ships behind a switch: on for one account (Chris) while he tries it, then on for
// everyone ('*') to release it. Switches live in the CBP database's `flags` table (FLAGS binding:
// production's database, read by staging too) and are flipped on /admin. No redeploy.

/** Every switch the admin page shows. Add one here before code checks it. */
const SWITCHES = { plus: 'Chinese Brain Plus', 'plus.write': 'Plus: changes saved on the website', staging: 'Staging site', 'plus.demo': 'Plus: switch test' };

async function owner(env, bearer) {
  if (!env.ADMIN_KEY || !same(await sha(bearer), await sha(env.ADMIN_KEY))) throw new Fail(404, 'not_found', 'Not found.');
}

const accountId = (bearer) => String(bearer).split('.')[0];

async function flagsOf(env, id) {
  if (!env.FLAGS) return [];
  const { results } = await env.FLAGS.prepare("SELECT DISTINCT flag FROM flags WHERE who = ? OR who = '*'").bind(id).all();
  return results.map((r) => r.flag);
}

async function setFlag(env, who, flag, on) {
  await (on
    ? env.FLAGS.prepare('INSERT INTO flags (who, flag, at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').bind(who, flag, Date.now())
    : env.FLAGS.prepare('DELETE FROM flags WHERE who = ? AND flag = ?').bind(who, flag)
  ).run();
}

/** The switches, and who has each: '*' for everyone, else by email (accounts from the directory). */
async function listFlags(env) {
  const { results } = await env.FLAGS.prepare('SELECT who, flag FROM flags').all();
  const byWho = new Map();
  for (const r of results) byWho.set(r.who, [...(byWho.get(r.who) ?? []), r.flag]);
  const { users } = await env.DIRECTORY.get(env.DIRECTORY.idFromName('all')).list();
  const people = {};
  for (const u of users) {
    const id = (await byEmail(env, u.email)).id.toString();
    if (byWho.has(id)) people[u.email] = byWho.get(id);
  }
  return { switches: SWITCHES, everyone: byWho.get('*') ?? [], people };
}

// ---------- Staging ----------
// chinese-staging.cristianbagrin.com runs the next version of this Worker (wrangler.jsonc, env
// "staging") on the same accounts. Only an account with the `staging` switch gets in: it signs in
// as usual, /staging trades the session for a 30-day cookie, and every request checks that cookie
// and the switch. Signing in and the account pages stay open, so there's a way in.

const STAGING_OPEN = /^\/(staging(\.js)?|account(\.js)?|reset|cb\.js|site\.js|style\.css|icon\.png|chris\.webp|acct\/.*|fonts\/.*|api\/.*|mcp\/.*)$/;
const STAGING_DAYS = 30;

async function hmac(env, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(env.STAGING_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

async function stagingPass(request, env) {
  const cookie = (request.headers.get('Cookie') ?? '').match(/(?:^|;\s*)stg=([^;]+)/)?.[1];
  if (!cookie || !env.STAGING_KEY) return false;
  const [id, exp, sig] = decodeURIComponent(cookie).split('|');
  if (!sig || Number(exp) < Date.now() || !same(sig, await hmac(env, `${id}|${exp}`))) return false;
  return (await flagsOf(env, id)).includes('staging');
}

async function stagingEnter(request, env) {
  const bearer = (request.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const { account, secret } = byToken(env, bearer);
  const me = await account.call(secret, 'me');
  if (me?.fail) throw new Fail(401, 'signed_out', 'You’re signed out. Sign in again.');
  const id = accountId(bearer);
  if (!(await flagsOf(env, id)).includes('staging')) throw new Fail(403, 'not_yours', 'This account can’t open staging.');
  const exp = Date.now() + STAGING_DAYS * 86_400_000;
  const value = encodeURIComponent(`${id}|${exp}|${await hmac(env, `${id}|${exp}`)}`);
  const res = json({ ok: true });
  res.headers.set('Set-Cookie', `stg=${value}; Max-Age=${STAGING_DAYS * 86_400}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  return res;
}

// ---------- Chinese Brain Plus: the machines ----------
// POST /api/plus/push/manifest and /api/plus/push: the Mac (Bearer CBP_PUSH_KEY), while it is the source.
// POST /mcp/<CBP_MCP_KEY>: the connector Claude sessions add (MCP, JSON-RPC over HTTP).
async function plusMachine(request, env, url) {
  const nope = () => new Response('Not found', { status: 404 });
  if (url.pathname.startsWith('/mcp/')) {
    const key = url.pathname.slice(5);
    if (!env.CBP_MCP_KEY || !same(await sha(key), await sha(env.CBP_MCP_KEY))) return nope();
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    let msg;
    try {
      msg = await request.json();
    } catch {
      return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
    }
    const out = Array.isArray(msg) ? (await Promise.all(msg.map((m) => plus.mcp(env, m)))).filter(Boolean) : await plus.mcp(env, msg);
    return out && (!Array.isArray(out) || out.length) ? json(out) : new Response(null, { status: 202 });
  }
  const bearer = (request.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  if (!env.CBP_PUSH_KEY || request.method !== 'POST' || !same(await sha(bearer), await sha(env.CBP_PUSH_KEY))) return nope();
  try {
    if (url.pathname === '/api/plus/push/manifest') return json(await plus.manifest(env));
    if (url.pathname === '/api/plus/push') return json(await plus.push(env, await request.json()));
    // once the website is the source: the Mac pulls what changed, and the switch-over itself
    if (url.pathname === '/api/plus/push/pull') return json(await plus.pull(env, await request.json()));
    if (url.pathname === '/api/plus/push/switch') return json(await plus.switchOver(env));
    // a test's audio and pictures (media.py), kept like the card window's
    if (url.pathname === '/api/plus/push/media') return json({ url: await cards.keepMedia(env, await request.arrayBuffer(), request.headers.get('Content-Type') ?? '') });
    // the taste test: its samples and models, a run now, and which Gemini models the key can call
    if (url.pathname === '/api/plus/push/taste') return json(await taste.load(env, await request.json()));
    if (url.pathname === '/api/plus/push/taste-run') return json(await taste.run(env, Math.min(280, Number(url.searchParams.get('s')) || 25) * 1000));
    if (url.pathname === '/api/plus/push/models') return json(await ai.geminiModels(env));
    if (url.pathname === '/api/plus/push/probe') {
      const { model, prompt } = await request.json();
      const t0 = Date.now();
      try {
        const r = await ai.text(env, model, prompt || 'Reply with one word: hello');
        return json({ ok: true, secs: (Date.now() - t0) / 1000, text: r.text, usage: r.usage });
      } catch (e) {
        return json({ ok: false, secs: (Date.now() - t0) / 1000, error: String(e?.message ?? e).slice(0, 600) });
      }
    }
  } catch (e) {
    console.error(e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
  return nope();
}

/** POST /api/plus/upload: a picture he pasted or dropped into a card (the body is the file). */
async function plusUpload(request, env) {
  const bearer = (request.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  try {
    const { account, secret } = byToken(env, bearer);
    const me = await account.call(secret, 'who');
    if (me?.fail) return json({ error: me.fail.message, code: me.fail.code }, me.fail.status);
    if (!(await flagsOf(env, accountId(bearer))).includes('plus')) return json({ error: 'Not found.', code: 'not_found' }, 404);
    return json({ url: await cards.keepMedia(env, await request.arrayBuffer(), request.headers.get('Content-Type') ?? '') });
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.message, code: e.code }, e.status);
    if (e instanceof cards.Bad) return json({ error: e.message, code: 'invalid_argument' }, 400);
    console.error(e);
    return json({ error: 'Something went wrong on our side.', code: 'server' }, 500);
  }
}

async function api(request, env, path) {
  if (request.method === 'GET' && path === 'health') return { ok: true, email: !!env.RESEND_API_KEY };
  const bearer = (request.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  let body = {};
  if (request.method === 'POST') {
    const text = await request.text();
    if (text.length > MAX_BODY) throw new Fail(413, 'big', 'That’s too much at once.');
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new Fail(400, 'json', 'Bad request.');
    }
  }
  const authed = async (method, ...args) => {
    const { account, secret } = byToken(env, bearer);
    return account.call(secret, method, ...args);
  };
  // Chinese Brain Plus: everything under plus/ needs the account's `plus` switch.
  if (path.startsWith('plus/') && path !== 'plus/me') {
    const me = await authed('who');
    if (me?.fail) return me;
    const flags = await flagsOf(env, accountId(bearer));
    if (!flags.includes('plus')) throw new Fail(404, 'not_found', 'Not found.');
    const q = new URL(request.url).searchParams;
    try {
      if (request.method === 'POST') {
        // the taste test (src/cbp/taste.ts)
        if (path === 'plus/taste/pick') return taste.pick(env, String(body.item ?? ''), body.n === 'none' ? 'none' : Number(body.n));
        if (path === 'plus/taste/note') return taste.note(env, String(body.item ?? ''), String(body.note ?? ''));
        // the board's own documents, once the website is the source and this account may change them
        if (path === 'plus/db') {
          if (!flags.includes('plus.write')) throw new Fail(403, 'read_only', 'Read-only for now.');
          return await plus.write(env, body);
        }
        // the card window (src/cbp/cards.ts)
        if (path === 'plus/sample') return await cards.sample(env, body);
        if (path === 'plus/photos') return await cards.photos(env, body);
        if (path === 'plus/drawings') return await cards.drawings(env, body);
        if (path === 'plus/grab') return await cards.grab(env, body);
        if (path === 'plus/pinyin') return await cards.pinyin(env, body);
        if (path === 'plus/voice') return await cards.voice(env, body);
        throw new Fail(404, 'not_found', 'Not found.');
      }
    } catch (e) {
      if (e instanceof plus.WriteError) throw new Fail(e.code === 'read_only' ? 403 : 400, e.code, e.message);
      if (e instanceof cards.Bad) throw new Fail(400, 'invalid_argument', e.message);
      if (e instanceof ai.Quota) throw new Fail(429, 'rate_limited', 'Not now: try again in a while.');
      throw e;
    }
    if (path === 'plus/taste') return taste.board(env);
    if (path === 'plus/taste/results') return taste.results(env);
    if (path === 'plus/taste/img') return taste.img(env, q.get('item') ?? '', Number(q.get('n')));
    const out = await plus.read(env, path.slice(5), q);
    if (out === undefined) throw new Fail(404, 'not_found', 'Not found.');
    return out;
  }
  switch (`${request.method} ${path}`) {
    case 'POST signup': {
      const { email, password } = credentials(body);
      await limit(env, request, 'signup', 10, 3_600_000);
      return env.ACCOUNT.get(env.ACCOUNT.idFromName(email)).signup(email, password);
    }
    case 'POST login': {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!EMAIL.test(email)) throw new Fail(400, 'email', 'That doesn’t look like an email address.');
      await limit(env, request, 'login', 30, 600_000);
      return (await byEmail(env, email)).login(String(body.password ?? ''), email);
    }
    case 'POST forgot': {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!EMAIL.test(email)) throw new Fail(400, 'email', 'That doesn’t look like an email address.');
      if (!env.RESEND_API_KEY) throw new Fail(503, 'email_off', `Password reset by email isn’t available right now. Write to ${env.SUPPORT} and we’ll sort it out.`);
      await limit(env, request, 'forgot', 5, 3_600_000);
      const reset = await (await byEmail(env, email)).startReset(email);
      if (reset && !(await sendReset(env, reset.email, reset.token, String(body.app ?? '')))) {
        throw new Fail(502, 'email_failed', `We couldn’t send the email just now. Try again in a few minutes, or write to ${env.SUPPORT}.`);
      }
      return { ok: true }; // the same answer whether or not the account exists
    }
    case 'POST reset': {
      const { password } = credentials(body, false);
      let link;
      try {
        link = byToken(env, body.token);
      } catch {
        throw new Fail(400, 'expired', 'This link has expired or was already used. Ask for a new one.');
      }
      return link.account.finishReset(link.secret, password);
    }
    case 'GET admin/users': {
      // For the owner: set the ADMIN_KEY secret, then open /admin.
      await owner(env, bearer);
      return env.DIRECTORY.get(env.DIRECTORY.idFromName('all')).list();
    }
    case 'GET admin/flags':
      await owner(env, bearer);
      return listFlags(env);
    case 'POST admin/flags': {
      await owner(env, bearer);
      const flag = String(body.flag ?? '');
      if (!Object.hasOwn(SWITCHES, flag)) throw new Fail(400, 'flag', 'Unknown switch.');
      const who = body.email === '*' ? '*' : (await byEmail(env, String(body.email ?? '').trim().toLowerCase())).id.toString();
      await setFlag(env, who, flag, !!body.on);
      return listFlags(env);
    }
    case 'GET plus/me': {
      const me = await authed('who');
      if (me?.fail) return me;
      const flags = await flagsOf(env, accountId(bearer));
      if (!flags.includes('plus')) throw new Fail(404, 'not_found', 'Not found.');
      return { email: me.email, flags };
    }
    case 'GET me':
      return authed('me');
    case 'GET export':
      return authed('export', new URL(request.url).searchParams.has('app') ? appOf(new URL(request.url).searchParams.get('app')) : undefined);
    case 'POST email': {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!EMAIL.test(email)) throw new Fail(400, 'email', 'That doesn’t look like an email address.');
      if (!env.RESEND_API_KEY) throw new Fail(503, 'email_off', `Changing your email isn’t available right now. Write to ${env.SUPPORT} and we’ll sort it out.`);
      await limit(env, request, 'email', 5, 3_600_000);
      const out = await authed('email', String(body.password ?? ''), email);
      if (out?.fail) return out;
      if (!(await sendEmailConfirm(env, out.email, out.token))) throw new Fail(502, 'email_failed', `We couldn’t send the email just now. Try again in a few minutes, or write to ${env.SUPPORT}.`);
      return { ok: true, email: out.email };
    }
    case 'POST email/confirm': {
      let link;
      try {
        link = byToken(env, body.token);
      } catch {
        throw new Fail(400, 'expired', 'This link has expired or was already used. Ask for a new one on your account page.');
      }
      const out = await link.account.finishEmail(link.secret);
      if (out?.fail) return out;
      await sendEmailChanged(env, out.old, out.email);
      return { ok: true, email: out.email };
    }
    case 'POST logout':
      return authed('logout');
    case 'POST password': {
      const { password } = credentials({ password: body.next }, false);
      return authed('password', String(body.old ?? ''), password);
    }
    case 'POST delete':
      return authed('remove', String(body.password ?? ''));
    case 'GET copy':
      return copyFor(request, env, new URL(request.url).searchParams.get('page'));
    case 'POST copy':
      return saveCopy(request, env, body);
    case 'POST sync':
      return authed('sync', body.since, Array.isArray(body.changes) ? body.changes.slice(0, 2000) : [], appOf(body.app));
  }
  throw new Fail(404, 'not_found', 'Not found.');
}

// ---------- Editing the pages (/edit) ----------
// Chris opens /edit (or /edit/brain/guide…), clicks any words and changes them, and saves with the
// password (the EDIT_KEY secret, the same one as cristianbagrin.com/edit). Every page is marked as
// it's served (src/copy.ts: each piece of text gets data-copy, each block data-block, named after
// its words in the source) and his edits go in with HTMLRewriter. An edit is tied to the words it
// replaced: when those change in the source, it no longer applies and the page shows the source.
// `node site/sync.mjs` lists the edits and which no longer apply, to fold them into the source.

const NO_EDITS = { v: 0, edits: {} };
let memo = null; // { at, doc }: the edits, kept a short while in this instance
const MEMO_MS = 30_000;
const cacheKey = (env) => `${env.SITE}/__copy`;

/** The saved edits; `fresh` skips the caches (the editor, and right after a save). */
async function editsOf(env, fresh = false) {
  if (!env.COPY) return NO_EDITS;
  if (!fresh && memo && Date.now() - memo.at < MEMO_MS) return memo.doc;
  let doc;
  // Each place Cloudflare serves from keeps the edits for a minute, so a page doesn't wait on the database.
  const cache = globalThis.caches?.default;
  if (!fresh && cache) {
    try {
      const hit = await cache.match(cacheKey(env));
      if (hit) doc = await hit.json();
    } catch {}
  }
  if (!doc) {
    doc = await env.COPY.get(env.COPY.idFromName('site')).read();
    if (cache) {
      try {
        await cache.put(cacheKey(env), new Response(JSON.stringify(doc), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=60' } }));
      } catch {}
    }
  }
  memo = { at: Date.now(), doc };
  return doc;
}

/** Pages as marked for editing, by file and version (they only change with a deploy). */
const marked = new Map();
function markedPage(key, etag, html) {
  const id = `${key}|${etag}`;
  let a = etag && marked.get(id);
  if (!a) {
    a = annotate(html);
    if (etag) {
      if (marked.size > 40) marked.clear();
      marked.set(id, a);
    }
  }
  return a;
}

/** A page from the site's files, without the visitor's cache headers (its ETag is ours, not the file's). */
function pageFile(env, request, path) {
  const url = new URL(path, request.url);
  const headers = new Headers(request.headers);
  headers.delete('If-None-Match');
  headers.delete('If-Modified-Since');
  return env.ASSETS.fetch(new Request(url, { method: 'GET', headers, redirect: 'manual' }));
}

async function pageWords(env, request, page) {
  const p = PAGES.find((x) => x[1] === page);
  if (!p) throw new Fail(404, 'not_found', 'No such page.');
  const res = await pageFile(env, request, p[2]);
  if (!res.ok) throw new Fail(404, 'not_found', 'No such page.');
  return markedPage(p[2], res.headers.get('ETag') ?? '', await res.text());
}

/** GET /api/copy: every saved edit; with ?page=, also that page's words as in the source. */
async function copyFor(request, env, page) {
  const doc = await editsOf(env, true);
  if (!page) return doc;
  const a = await pageWords(env, request, page);
  return { ...doc, texts: a.texts, blocks: a.blocks, pages: PAGES.map(([label, path]) => [label, path]) };
}

/** POST /api/copy { page, changes: { name: new HTML | null, "-name": true | null } }, with the password. */
async function saveCopy(request, env, body) {
  await limit(env, request, 'edit', 30, 600_000);
  const key = request.headers.get('X-Edit-Key') ?? '';
  if (!env.EDIT_KEY || !env.COPY || !same(await sha(key), await sha(env.EDIT_KEY))) throw new Fail(401, 'wrong', 'Wrong password.');
  const page = String(body.page ?? '');
  const a = await pageWords(env, request, page);
  const { edits } = await editsOf(env, true);
  const updates = {};
  for (const [name, v] of Object.entries(body.changes ?? {})) {
    const gone = name.startsWith('-');
    const k = gone ? name.slice(1) : name;
    const known = Object.hasOwn(a.texts, k) || a.blocks.includes(k);
    // Unknown names can only be cleared (an edit whose words changed in the source).
    if (!known) {
      if ((v === null || v === false) && edits[k]) updates[k] = null;
      continue;
    }
    const e = { ...(updates[k] ?? edits[k] ?? {}), was: a.texts[k] ?? a.blockWords[k] ?? '', page, at: Date.now() };
    if (gone) {
      if (v === true) e.gone = true;
      else delete e.gone;
    } else if (v === null || v === false || v === a.texts[k]) delete e.to;
    else if (typeof v === 'string' && v.length <= 8000) e.to = clean(v);
    updates[k] = e.to !== undefined || e.gone ? e : null;
  }
  const doc = await env.COPY.get(env.COPY.idFromName('site')).apply(updates);
  memo = { at: Date.now(), doc };
  try {
    await globalThis.caches?.default?.delete(cacheKey(env));
  } catch {}
  return { ok: true, edited: Object.keys(doc.edits).length };
}

/** The edits, put into a page as it streams out; at /edit, the editor too (and none of the page's own scripts). */
function withCopy(res, edits, edit) {
  let rw = new HTMLRewriter().on('[data-copy],[data-block]', {
    element(el) {
      for (const attr of ['data-block', 'data-copy']) {
        const k = el.getAttribute(attr);
        if (!k || !edits[k]?.gone) continue;
        if (edit) el.setAttribute('data-gone', '');
        else {
          // Hidden rather than taken out: the page's scripts may still look for what's inside.
          el.setAttribute('hidden', '');
          el.setAttribute('style', 'display:none!important');
          return;
        }
      }
      const e = edits[el.getAttribute('data-copy')];
      if (typeof e?.to === 'string') el.setInnerContent(clean(e.to), { html: true });
    },
  });
  if (edit) {
    rw = rw
      .on('html', { element: (el) => el.setAttribute('data-edit', '') })
      .on('title', { element: (el) => el.prepend('Edit · ') })
      .on('head', { element: (el) => el.append('<meta name="robots" content="noindex">', { html: true }) })
      // The page's own scripts would rewrite words as you edit them (your email in the corner, Option for Alt…).
      .on('script', { element: (el) => el.remove() })
      .on('body', { element: (el) => el.append('<script src="/edit.js" defer></script>', { html: true }) });
  }
  return rw.transform(res);
}

/** Serves a page with the edits in. Anything that isn't a page passes through as it is. */
async function servePage(request, env, res, { key, edit = false, status = res.status }) {
  if (!(res.headers.get('Content-Type') ?? '').startsWith('text/html') || (res.status !== 200 && res.status !== 404)) return res;
  const fileTag = res.headers.get('ETag') ?? '';
  const a = markedPage(key, fileTag, await res.text());
  const doc = await editsOf(env, edit);
  const h = new Headers(res.headers);
  h.delete('Content-Length');
  if (edit) {
    h.delete('ETag');
    h.set('Cache-Control', 'no-store');
  } else if (fileTag) {
    // Changes with the file (a deploy) and with the edits, so browsers can still ask "anything new?".
    const tag = `W/"${fileTag.replace(/^W\//, '').replace(/"/g, '')}.${doc.v}"`;
    h.set('ETag', tag);
    if (status === 200 && request.headers.get('If-None-Match') === tag) return new Response(null, { status: 304, headers: h });
  }
  if (request.method === 'HEAD') return new Response(null, { status, headers: h });
  return withCopy(new Response(a.html, { status, headers: h }), doc.edits, edit);
}

/** The extension's store pages. The pages link to /brain/firefox and /brain/chrome, so each address lives only here. */
const STORES = {
  firefox: 'https://addons.mozilla.org/firefox/addon/chinesebrain/',
  chrome: 'https://chromewebstore.google.com/detail/chinese-brain/pdhgpdlkjdkehlpoomonehbnhiplgaao',
};

const PLUS_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://upload.wikimedia.org https://thumb.wikimedia.org; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; media-src 'self' blob: data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

/** Addresses from before the extension's pages moved under /brain. */
const MOVED = { '/welcome': '/brain/guide#welcome', '/brain/welcome': '/brain/guide#welcome', '/privacy': '/brain/privacy', '/dashboard': '/brain/dashboard', '/guide': '/brain/guide', '/whats-new': '/brain/whats-new' };

export default {
  // hourly: the taste test's other models answer a few more samples (free tiers allow only so many a day)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(taste.run(env, 240_000).then((r) => console.log('taste', JSON.stringify(r))));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (env.STAGING && !STAGING_OPEN.test(url.pathname) && !(await stagingPass(request, env))) {
      return Response.redirect(`${url.origin}/staging`, 302);
    }
    // The Mac's push to Chinese Brain Plus (scripts/cbp-push.py) and Claude's connector: each with its own secret.
    if (url.pathname.startsWith('/api/plus/push') || url.pathname.startsWith('/mcp/')) return plusMachine(request, env, url);
    // Chinese Brain Plus's pictures and sounds, by unguessable name
    if (request.method === 'GET' && url.pathname.startsWith('/api/plus/media/')) return cards.media(env, url.pathname.slice(16));
    if (request.method === 'POST' && url.pathname === '/api/plus/upload') return plusUpload(request, env);
    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      try {
        if (env.STAGING && request.method === 'POST' && url.pathname === '/api/staging/enter') return await stagingEnter(request, env);
        const out = await api(request, env, url.pathname.slice(5));
        if (out instanceof Response) return out;
        if (out?.fail) return json({ error: out.fail.message, code: out.fail.code }, out.fail.status);
        return json(out);
      } catch (e) {
        if (e instanceof Fail) return json({ error: e.message, code: e.code }, e.status);
        console.error(e);
        return json({ error: 'Something went wrong on our side. Try again in a moment.', code: 'server' }, 500);
      }
    }
    // The pages (to put Chris's edits in), the front page and the addresses that moved (see
    // run_worker_first in wrangler.jsonc). Files that aren't pages are served without the Worker.
    const path = url.pathname.replace(/\/$/, '');
    const accountSite = url.hostname.startsWith('account.');
    if (path === '/edit' || path.startsWith('/edit/')) {
      const page = path.slice(5) || (accountSite ? '/account' : '/brain');
      const p = PAGES.find((x) => x[1] === page);
      if (!p) return Response.redirect(`${url.origin}/edit`, 302);
      return servePage(request, env, await pageFile(env, request, p[2]), { key: p[2], edit: true, status: 200 });
    }
    // account.cristianbagrin.com: the account pages for every app.
    if (accountSite && path === '') return servePage(request, env, await pageFile(env, request, `/account${url.search}`), { key: '/account' });
    // chinesebrain.cristianbagrin.com is the short address of the extension's pages.
    const short = url.hostname.startsWith('chinesebrain.');
    if (short || MOVED[path]) {
      const [to, hash] = (MOVED[path] ?? (path || '/brain')).split('#');
      return Response.redirect(`${env.SITE}${to}${url.search}${hash ? `#${hash}` : ''}`, 301);
    }
    if (path === '/brain/firefox' || path === '/brain/chrome') return Response.redirect(STORES[path.slice(7)], 302);
    // Chinese Brain Plus: the board, which loads its fonts from Google (the site's own CSP allows none).
    if (path === '/plus' || path === '/plus/taste') {
      const res = await pageFile(env, request, path);
      const h = new Headers(res.headers);
      h.set('Content-Security-Policy', PLUS_CSP);
      h.set('Cache-Control', 'no-store');
      return new Response(res.body, { status: res.status, headers: h });
    }
    // Until the main site exists, the front page is Chinese Brain's.
    if (path === '') return servePage(request, env, await pageFile(env, request, `/brain${url.search}`), { key: '/brain' });
    const res = await pageFile(env, request, url.pathname + url.search);
    // An address with no file (not_found_handling is "none", so it comes here): the 404 page.
    if (res.status === 404) return servePage(request, env, await pageFile(env, request, '/404'), { key: '/404', status: 404 });
    return servePage(request, env, res, { key: url.pathname });
  },
};
