// Accounts and sync for Chinese Brain. Every account is its own Durable Object with a small
// SQLite database (the password hash, sessions, and the synced word list), found by email.
// Nothing here needs setting up besides the RESEND_API_KEY secret for password-reset emails.
import { DurableObject } from 'cloudflare:workers';

const MAX_BODY = 1_500_000;
const MAX_ITEMS = 60_000;
const MAX_VALUE = 16_000;
const PAGE = 1000;
const SYNCED = /^(w:|sav:|exh:|gex:).{1,60}$|^settings$/;
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

/**
 * One word, changed in two browsers: the status is the one set last; the history, the
 * sentences it was met in (the newest five) and the lookup count come from both.
 */
function mergeWord(a, b) {
  const [older, newer] = (a.updated ?? 0) > (b.updated ?? 0) ? [b, a] : [a, b];
  const hist = [...(a.hist ?? []), ...(b.hist ?? [])].sort((x, y) => x.t - y.t).filter((x, i, all) => !i || x.t !== all[i - 1].t || x.s !== all[i - 1].s);
  const seen = new Set();
  const ctx = [...(a.ctx ?? []), ...(b.ctx ?? [])].sort((x, y) => y.at - x.at).filter((x) => !seen.has(x.text) && seen.add(x.text)).slice(0, 5);
  return { ...older, ...newer, added: Math.min(a.added ?? Infinity, b.added ?? Infinity) || newer.added, hist, ctx, looks: Math.max(a.looks ?? 0, b.looks ?? 0) };
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
    this.tables();
  }

  tables() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS sessions (h TEXT PRIMARY KEY, created INTEGER, seen INTEGER);
      CREATE TABLE IF NOT EXISTS resets (h TEXT PRIMARY KEY, exp INTEGER);
      CREATE TABLE IF NOT EXISTS items (k TEXT PRIMARY KEY, v TEXT, t INTEGER, seq INTEGER);
      CREATE INDEX IF NOT EXISTS items_seq ON items (seq);
    `);
  }

  get(k) {
    return this.sql.exec('SELECT v FROM meta WHERE k = ?', k).toArray()[0]?.v;
  }
  set(k, v) {
    this.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v', k, String(v));
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

  async signup(email, password) {
    if (this.get('email')) return fail(409, 'exists', 'This email already has an account. Sign in instead.');
    this.set('email', email);
    this.set('created', Date.now());
    this.set('seq', 0);
    await this.setPassword(password);
    return { token: await this.newSession(), email };
  }

  async login(password) {
    if (!this.get('email')) return fail(401, 'wrong', 'That email and password don’t match.');
    return (await this.checkPassword(password)) ?? { token: await this.newSession(), email: this.get('email') };
  }

  /** The session behind a token's secret, or null. */
  async auth(secret) {
    if (!this.get('email')) return null;
    const h = await sha(secret);
    const row = this.sql.exec('SELECT seen FROM sessions WHERE h = ?', h).toArray()[0];
    if (!row) return null;
    if (Date.now() - row.seen > 3_600_000) this.sql.exec('UPDATE sessions SET seen = ? WHERE h = ?', Date.now(), h);
    return h;
  }

  async call(secret, method, ...args) {
    const h = await this.auth(secret);
    if (!h) return fail(401, 'signed_out', 'You’re signed out. Sign in again.');
    return this[`_${method}`](h, ...args);
  }

  _me() {
    const n = this.sql.exec("SELECT COUNT(*) AS n FROM items WHERE v IS NOT NULL AND k LIKE 'w:%'").one().n;
    return { email: this.get('email'), created: Number(this.get('created')), words: n };
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
    await this.ctx.storage.deleteAll();
    this.tables();
    return { ok: true };
  }

  _export() {
    const items = {};
    for (const r of this.sql.exec('SELECT k, v FROM items WHERE v IS NOT NULL')) items[r.k] = JSON.parse(r.v);
    return { email: this.get('email'), exported: new Date().toISOString(), items };
  }

  /** Take this device's changes (the newer one wins, per item) and hand back everyone else's. */
  _sync(_h, since, changes) {
    const now = Date.now();
    let seq = Number(this.get('seq') ?? 0);
    const mine = new Set();
    let count = this.sql.exec('SELECT COUNT(*) AS n FROM items').one().n;
    for (const c of changes) {
      if (!c || typeof c.k !== 'string' || !SYNCED.test(c.k)) continue;
      const v = c.v == null ? null : JSON.stringify(c.v);
      if (v && v.length > MAX_VALUE) continue;
      const t = Math.min(Number(c.t) || 0, now);
      const old = this.sql.exec('SELECT v, t FROM items WHERE k = ?', c.k).toArray()[0];
      if (!old && ++count > MAX_ITEMS) return fail(413, 'full', 'This account’s word list is full.');
      let next = v;
      if (old?.v && v && c.k.startsWith('w:')) {
        // The same word changed in two browsers: keep both sides (see mergeWord).
        next = JSON.stringify(mergeWord(JSON.parse(old.v), c.v));
        if (next === old.v) continue;
      } else if (old && old.t > t) continue; // a newer change from another browser stays
      this.sql.exec('INSERT INTO items (k, v, t, seq) VALUES (?, ?, ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, t = excluded.t, seq = excluded.seq', c.k, next, Math.max(t, old?.t ?? 0), ++seq);
      if (next === v) mine.add(c.k); // a merged word goes back to the browser that sent it, too
    }
    this.set('seq', seq);
    const rows = this.sql.exec('SELECT k, v, t, seq FROM items WHERE seq > ? ORDER BY seq LIMIT ?', Number(since) || 0, PAGE + 1).toArray();
    const more = rows.length > PAGE;
    const page = rows.slice(0, PAGE);
    return {
      seq: more ? page[page.length - 1].seq : seq,
      more,
      changes: page.filter((r) => !mine.has(r.k)).map((r) => ({ k: r.k, v: r.v == null ? null : JSON.parse(r.v), t: r.t })),
    };
  }

  /** A one-hour link to set a new password; null when there is no such account. */
  async startReset() {
    if (!this.get('email')) return null;
    this.sql.exec('DELETE FROM resets WHERE exp < ?', Date.now());
    if (this.sql.exec('SELECT COUNT(*) AS n FROM resets').one().n >= 3) return null; // three open links are plenty
    const secret = random(32);
    this.sql.exec('INSERT INTO resets (h, exp) VALUES (?, ?)', await sha(secret), Date.now() + 3_600_000);
    return { email: this.get('email'), token: `${this.ctx.id.toString()}.${secret}` };
  }

  async finishReset(secret, password) {
    const h = await sha(secret);
    const row = this.sql.exec('SELECT exp FROM resets WHERE h = ?', h).toArray()[0];
    if (!row || row.exp < Date.now() || !this.get('email')) return fail(400, 'expired', 'This link has expired or was already used. Ask for a new one.');
    await this.setPassword(password);
    this.sql.exec('DELETE FROM resets');
    this.sql.exec('DELETE FROM sessions');
    this.set('fails', 0);
    this.set('lock', 0);
    return { token: await this.newSession(), email: this.get('email') };
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

async function sendReset(env, email, token) {
  const link = `${env.SITE}/reset#${token}`;
  const res = await fetch(env.MAIL_API ?? 'https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [email],
      reply_to: env.SUPPORT,
      subject: 'Reset your Chinese Brain password',
      text: `Someone asked to reset the password for your Chinese Brain account.\n\nSet a new one here (the link works for one hour):\n${link}\n\nIf that wasn't you, ignore this email: your password stays as it is.\n\nChinese Brain 中文腦`,
      html: `<div style="font:16px/1.6 -apple-system,Segoe UI,sans-serif;color:#1e1a18;max-width:480px"><p>Someone asked to reset the password for your Chinese Brain account.</p><p><a href="${link}" style="display:inline-block;padding:11px 20px;border-radius:8px;background:#c8102e;color:#fff;font-weight:600;text-decoration:none">Set a new password</a></p><p style="color:#5e5650;font-size:14px">The link works for one hour. If that wasn’t you, ignore this email: your password stays as it is.</p><p style="color:#5e5650;font-size:14px">Chinese Brain 中文腦</p></div>`,
    }),
  });
  if (!res.ok) console.error('reset email failed', res.status, await res.text());
  return res.ok;
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
      return env.ACCOUNT.get(env.ACCOUNT.idFromName(email)).login(String(body.password ?? ''));
    }
    case 'POST forgot': {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!EMAIL.test(email)) throw new Fail(400, 'email', 'That doesn’t look like an email address.');
      if (!env.RESEND_API_KEY) throw new Fail(503, 'email_off', `Password reset by email isn’t available right now. Write to ${env.SUPPORT} and we’ll sort it out.`);
      await limit(env, request, 'forgot', 5, 3_600_000);
      const reset = await env.ACCOUNT.get(env.ACCOUNT.idFromName(email)).startReset();
      if (reset) await sendReset(env, reset.email, reset.token);
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
    case 'GET me':
      return authed('me');
    case 'GET export':
      return authed('export');
    case 'POST logout':
      return authed('logout');
    case 'POST password': {
      const { password } = credentials({ password: body.next }, false);
      return authed('password', String(body.old ?? ''), password);
    }
    case 'POST delete':
      return authed('remove', String(body.password ?? ''));
    case 'POST sync':
      return authed('sync', body.since, Array.isArray(body.changes) ? body.changes.slice(0, 2000) : []);
  }
  throw new Fail(404, 'not_found', 'Not found.');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      const out = await api(request, env, url.pathname.slice(5));
      if (out?.fail) return json({ error: out.fail.message, code: out.fail.code }, out.fail.status);
      return json(out);
    } catch (e) {
      if (e instanceof Fail) return json({ error: e.message, code: e.code }, e.status);
      console.error(e);
      return json({ error: 'Something went wrong on our side. Try again in a moment.', code: 'server' }, 500);
    }
  },
};
