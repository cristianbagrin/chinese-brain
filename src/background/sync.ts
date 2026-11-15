import type { SavedSentence, WordRecord } from '../shared/types.ts';

export const SITE = __SITE__;

/** What the account pages show. */
export interface AccountInfo {
  email: string;
  signedIn: boolean;
  /** When the last sync finished. */
  at?: number;
  error?: string;
  /** Changes waiting to go up. */
  pending: number;
}

interface Acct {
  email: string;
  token: string;
  /** How far into the account's changes this browser has read. */
  seq: number;
  at?: number;
  error?: string;
}
interface Change {
  k: string;
  v: unknown;
  t: number;
}

/** Your words, saved sentences and examples follow you; logs, caches and API keys stay here. */
const SYNCED = /^(w:|sav:|exh:|gex:)|^settings$/;
/** One request carries at most this many items and about this many characters. */
const BATCH = 400;
const BATCH_CHARS = 400_000;
/** The server takes items up to 32,000 characters. */
const MAX_ITEM = 30_000;
/** Without changes of its own, a browser asks for the others' at most this often. */
const QUIET = 15 * 60_000;

/** Settings as they travel: never the API keys. */
function travel(k: string, v: unknown): unknown {
  if (k !== 'settings' || !v) return v;
  const { azureKey: _a, geminiKey: _g, ...rest } = v as Record<string, unknown>;
  return rest;
}
/** JSON with object keys in order: Chrome's storage hands objects back with their keys sorted. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}
const json = (k: string, v: unknown) => stable(travel(k, v));

class ApiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

async function api(path: string, body?: unknown, token?: string) {
  let res: Response;
  try {
    res = await fetch(`${SITE}/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Can’t reach Chinese Brain. Check your connection.', 'offline');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Something went wrong. Try again in a moment.', data.code ?? 'server');
  return data;
}

/**
 * Optional account: the word list kept in step across browsers. Every change to a synced
 * storage key is noted (with its time) and sent up; changes from other browsers come down
 * with the same request. Per item, the newer change wins.
 */
export class Sync {
  private acct: Acct | null = null;
  private dirty: Record<string, number> = {};
  /** What sync itself just wrote, so those writes aren't sent back up. */
  private applied = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | null = null;
  private ready: Promise<void>;
  /** A change from another browser landed in storage. */
  private onRemote: (k: string, v: unknown) => void;

  constructor(onRemote: (k: string, v: unknown) => void) {
    this.onRemote = onRemote;
    this.ready = browser.storage.local.get(['acct', 'acct:dirty']).then((got) => {
      this.acct = (got.acct as Acct | undefined) ?? null;
      this.dirty = (got['acct:dirty'] as Record<string, number> | undefined) ?? {};
    });
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') void this.ready.then(() => this.note(changes));
    });
    browser.alarms.onAlarm.addListener((a) => {
      if (a.name === 'sync') void this.now();
    });
    // Chrome restarts the background after every idle half minute: don't restart the clock, or
    // ask the server, each time.
    void browser.alarms.get('sync').then((a) => a || browser.alarms.create('sync', { periodInMinutes: 20 }));
    void this.ready.then(() => {
      if (Object.keys(this.dirty).length || Date.now() - (this.acct?.at ?? 0) > QUIET) void this.now();
    });
  }

  private note(changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) {
    if (!this.acct?.token) return;
    let any = false;
    for (const [k, ch] of Object.entries(changes)) {
      if (!SYNCED.test(k)) continue;
      const now = json(k, ch.newValue);
      if (this.applied.get(k) === now) {
        this.applied.delete(k);
        continue;
      }
      if (json(k, ch.oldValue) === now) continue; // only an API key changed
      this.dirty[k] = Date.now();
      any = true;
    }
    if (!any) return;
    void browser.storage.local.set({ 'acct:dirty': this.dirty });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.now(), 4000);
  }

  async info(): Promise<AccountInfo> {
    await this.ready;
    const a = this.acct;
    return { email: a?.email ?? '', signedIn: !!a?.token, at: a?.at, error: a?.error, pending: Object.keys(this.dirty).length };
  }

  private saveAcct() {
    return this.acct ? browser.storage.local.set({ acct: this.acct }) : browser.storage.local.remove(['acct', 'acct:dirty']);
  }

  /** Sign in or create the account, then merge this browser's list with the account's. */
  async signIn(email: string, password: string, create: boolean): Promise<AccountInfo> {
    await this.ready;
    try {
      const res: { token: string; email: string } = await api(create ? 'signup' : 'login', { email, password });
      this.acct = { email: res.email, token: res.token, seq: 0 };
    } catch (e) {
      return { ...(await this.info()), error: (e as Error).message };
    }
    // Everything here goes up with its own date, so the newer stamp of a word wins either way.
    const all = await browser.storage.local.get(null);
    this.dirty = {};
    for (const [k, v] of Object.entries(all)) {
      if (!SYNCED.test(k)) continue;
      if (k.startsWith('w:')) this.dirty[k] = (v as WordRecord).updated || 1;
      else if (k.startsWith('sav:')) this.dirty[k] = Math.max(1, ...(v as SavedSentence[]).map((x) => x.at || 0));
      else this.dirty[k] = 1; // settings and examples: the account's copy wins when it has one
    }
    await browser.storage.local.set({ acct: this.acct, 'acct:dirty': this.dirty });
    await this.now();
    return this.info();
  }

  async signOut() {
    await this.ready;
    const token = this.acct?.token;
    this.acct = null;
    this.dirty = {};
    await this.saveAcct();
    if (token) await api('logout', {}, token).catch(() => {});
    return this.info();
  }

  async forgot(email: string): Promise<{ ok?: boolean; error?: string }> {
    return api('forgot', { email }).then(
      () => ({ ok: true }),
      (e) => ({ error: (e as Error).message }),
    );
  }

  /** Send what changed here, take what changed elsewhere. One run at a time. */
  now(): Promise<void> {
    this.running ??= this.ready
      .then(() => this.run())
      .finally(() => (this.running = null));
    return this.running;
  }

  private async run() {
    const a = this.acct;
    if (!a?.token) return;
    try {
      for (let more = true; more; ) {
        const keys = Object.keys(this.dirty).slice(0, BATCH);
        const sent = Object.fromEntries(keys.map((k) => [k, this.dirty[k]]));
        const have = keys.length ? await browser.storage.local.get(keys) : {};
        const changes: Change[] = [];
        let size = 0;
        for (const k of keys) {
          const v = travel(k, have[k]) ?? null;
          const n = JSON.stringify(v).length;
          if (n > MAX_ITEM) {
            console.warn('[chinese-brain] too large to sync', k);
            delete this.dirty[k];
            continue;
          }
          if (changes.length && size + n > BATCH_CHARS) break; // the rest goes in the next request
          size += n;
          changes.push({ k, v, t: sent[k] });
        }
        const res: { seq: number; more: boolean; changes: Change[] } = await api('sync', { since: a.seq, changes }, a.token);
        if (this.acct !== a) return; // signed out meanwhile
        for (const c of changes) if (this.dirty[c.k] === sent[c.k]) delete this.dirty[c.k];
        await this.apply(res.changes);
        a.seq = res.seq;
        a.at = Date.now();
        delete a.error;
        await browser.storage.local.set({ acct: a, 'acct:dirty': this.dirty });
        more = res.more || Object.keys(this.dirty).length > 0;
      }
    } catch (e) {
      if (this.acct !== a) return;
      const err = e as ApiError;
      if (err.code === 'signed_out') {
        // The password changed elsewhere, or the account is gone: this browser keeps its words.
        a.token = '';
        this.dirty = {};
      }
      a.error = err.message;
      await browser.storage.local.set({ acct: a, 'acct:dirty': this.dirty });
    }
  }

  private async apply(changes: Change[]) {
    const set: Record<string, unknown> = {};
    const remove: string[] = [];
    let settings: Record<string, unknown> | undefined;
    for (const c of changes) {
      if (!SYNCED.test(c.k) || (this.dirty[c.k] ?? 0) > c.t) continue; // changed here since: ours goes up next
      if (c.k === 'settings') settings = c.v as Record<string, unknown> | undefined;
      else if (c.v == null) remove.push(c.k);
      else set[c.k] = c.v;
    }
    if (settings) {
      // This browser's API keys stay as they are.
      const mine = ((await browser.storage.local.get('settings')).settings ?? {}) as Record<string, unknown>;
      set.settings = { ...settings, azureKey: mine.azureKey ?? '', geminiKey: mine.geminiKey ?? '' };
      // The Azure voice needs its key, which stays in the browser it was typed in.
      if (settings.voice === 'azure' && !mine.azureKey) (set.settings as Record<string, unknown>).voice = mine.voice ?? 'google';
    }
    for (const [k, v] of Object.entries(set)) this.applied.set(k, json(k, v));
    for (const k of remove) this.applied.set(k, 'null');
    if (Object.keys(set).length) await browser.storage.local.set(set);
    if (remove.length) await browser.storage.local.remove(remove);
    for (const [k, v] of Object.entries(set)) this.onRemote(k, v);
    for (const k of remove) this.onRemote(k, undefined);
    // Writes that changed nothing fire no event: don't let their marks swallow a later real change.
    setTimeout(() => this.applied.clear(), 2000);
  }
}
