import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

// The account service's sync (site/worker.js), run here on a real SQLite database: what an app can read and
// write, and the compare-and-set that keeps two apps (or an older app) from writing over a keyring.

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers') {
      return { url: 'data:text/javascript,export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }', shortCircuit: true };
    }
    return next(specifier, context);
  },
});

/** A Durable Object's `ctx.storage.sql`, on node:sqlite. */
function sqlStorage() {
  const db = new DatabaseSync(':memory:');
  const cursor = (rows: Record<string, unknown>[]) => ({
    toArray: () => rows,
    one: () => {
      if (rows.length !== 1) throw new Error(`expected one row, got ${rows.length}`);
      return rows[0];
    },
    [Symbol.iterator]: () => rows[Symbol.iterator](),
  });
  return {
    exec(query: string, ...args: unknown[]) {
      if (!args.length && query.trim().replace(/;\s*$/, '').includes(';')) {
        db.exec(query);
        return cursor([]);
      }
      const st = db.prepare(query);
      if (/^\s*(SELECT|PRAGMA)/i.test(query)) return cursor(st.all(...(args as never[])) as Record<string, unknown>[]);
      st.run(...(args as never[]));
      return cursor([]);
    },
  };
}

const workerUrl = new URL('../site/worker.js', import.meta.url).href;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Account } = (await import(workerUrl)) as any;

async function account() {
  const env = { DIRECTORY: { idFromName: () => 'all', get: () => ({ seen() {}, remove() {} }) } };
  const ctx = { id: { toString: () => 'acct1' }, storage: { sql: sqlStorage(), deleteAll: async () => {} } };
  const a = new Account(ctx, env);
  const { token } = await a.signup('ana@example.com', 'first password');
  const secret = token.split('.')[1];
  type Change = { k: string; v: unknown; t?: number; if?: number };
  type Reply = { seq: number; more: boolean; changes: { k: string; v: unknown; t: number; s: number }[]; rejected?: string[] };
  const sync = (app: string, changes: Change[] = [], since = 0): Promise<Reply> => a.call(secret, 'sync', since, changes, app);
  return { a, sync };
}

const item = (r: { changes: { k: string; v: unknown; s: number }[] }, k: string) => r.changes.find((c) => c.k === k);

test('the shared @account/ items: every app reads and writes them, only with a precondition', async () => {
  const { sync } = await account();
  const ring = { v: 1, id: 'abc' };
  // Without `if`: refused.
  let r = await sync('account', [{ k: '@account/keyring', v: ring, t: 1 }]);
  assert.deepEqual(r.rejected, ['@account/keyring']);
  assert.equal(item(await sync('account'), '@account/keyring'), undefined);
  // Created from nothing (`if: 0`).
  r = await sync('account', [{ k: '@account/keyring', v: ring, t: 1, if: 0 }]);
  assert.equal(r.rejected, undefined);
  const read = item(await sync('account'), '@account/keyring')!;
  assert.deepEqual(read.v, ring);
  assert.ok(read.s > 0);
  // Not an app's own: Money in Order and Chinese Brain don't get it in their sync, nor can they write it there.
  assert.equal(item(await sync('mio'), '@account/keyring'), undefined);
  assert.equal(item(await sync(''), '@account/keyring'), undefined);
  await sync('mio', [{ k: '@account/keyring', v: { evil: 1 }, t: Date.now(), if: read.s }]);
  assert.deepEqual(item(await sync('account'), '@account/keyring')!.v, ring);
  // And the account sync takes no app's keys.
  await sync('account', [{ k: '@mio/keyring', v: { x: 1 }, t: 1, if: 0 }]);
  assert.equal(item(await sync('mio'), '@mio/keyring'), undefined);
});

test('two apps making the account keyring at once: the second is refused and gets the first one', async () => {
  const { sync } = await account();
  const fromMio = { v: 1, id: 'mio' };
  const fromTdw = { v: 1, id: 'tdw' };
  const a = await sync('account', [{ k: '@account/keyring', v: fromMio, t: Date.now(), if: 0 }]);
  const b = await sync('account', [{ k: '@account/keyring', v: fromTdw, t: Date.now() + 5000, if: 0 }]);
  assert.equal(a.rejected, undefined);
  assert.deepEqual(b.rejected, ['@account/keyring']);
  // The refused write hands back what won, even with a `since` past it.
  assert.deepEqual(item(b, '@account/keyring')!.v, fromMio);
  const c = await sync('account', [{ k: '@account/keyring', v: fromTdw, t: 1, if: 0 }], 999);
  assert.deepEqual(item(c, '@account/keyring')!.v, fromMio);
  // With the `s` it read, a later write goes through, whatever its time.
  const s = item(await sync('account'), '@account/keyring')!.s;
  const d = await sync('account', [{ k: '@account/keyring', v: fromTdw, t: 1, if: s }]);
  assert.equal(d.rejected, undefined);
  assert.deepEqual(item(await sync('account'), '@account/keyring')!.v, fromTdw);
  // The old `s` no longer works.
  assert.deepEqual((await sync('account', [{ k: '@account/keyring', v: fromMio, t: Date.now(), if: s }])).rejected, ['@account/keyring']);
});

test('an app keyring written with a precondition is guarded from apps that send none (the versions live today)', async () => {
  const { sync } = await account();
  // Today's apps write their keyring without `if`, and that keeps working while nothing newer has written it.
  await sync('tdw', [{ k: '@tdw/keyring', v: { v: 1, pw: 'a' }, t: Date.now() }]);
  await sync('tdw', [{ k: '@tdw/keyring', v: { v: 1, pw: 'b' }, t: Date.now() + 1 }]);
  let now = item(await sync('tdw'), '@tdw/keyring')!;
  assert.deepEqual(now.v, { v: 1, pw: 'b' });
  // A newer app moves it, with the `s` it read.
  const moved = await sync('tdw', [{ k: '@tdw/keyring', v: { v: 2, mk: 'x' }, t: 1, if: now.s }]);
  assert.equal(moved.rejected, undefined);
  now = item(await sync('tdw'), '@tdw/keyring')!;
  assert.deepEqual(now.v, { v: 2, mk: 'x' });
  // An older tab still open writes its keyring (a new password wrap, or a new keyring of its own): refused.
  const old = await sync('tdw', [{ k: '@tdw/keyring', v: { v: 1, pw: 'c' }, t: Date.now() + 60_000 }]);
  assert.deepEqual(old.rejected, ['@tdw/keyring']);
  assert.deepEqual(item(old, '@tdw/keyring')!.v, { v: 2, mk: 'x' });
  // Nor can it remove it.
  await sync('tdw', [{ k: '@tdw/keyring', v: null, t: Date.now() + 60_000 }]);
  assert.deepEqual(item(await sync('tdw'), '@tdw/keyring')!.v, { v: 2, mk: 'x' });
  // A newer app can, with its precondition.
  await sync('tdw', [{ k: '@tdw/keyring', v: null, t: 1, if: now.s }]);
  assert.equal(item(await sync('tdw'), '@tdw/keyring')!.v, null);
});

test('everything else syncs as before: newer wins, words merge, and each change comes back with its `s`', async () => {
  const { sync } = await account();
  await sync('', [{ k: 'settings', v: { a: 1 }, t: 100 }]);
  await sync('', [{ k: 'settings', v: { a: 0 }, t: 50 }]);
  const r = await sync('');
  assert.deepEqual(item(r, 'settings')!.v, { a: 1 });
  assert.equal(typeof item(r, 'settings')!.s, 'number');
  await sync('', [{ k: 'w:好', v: { s: 1, updated: 1, hist: [{ t: 1, s: 1 }] }, t: 1 }]);
  await sync('', [{ k: 'w:好', v: { s: 2, updated: 2, hist: [{ t: 2, s: 2 }] }, t: 2 }]);
  const w = item(await sync(''), 'w:好')!.v as { s: number; hist: unknown[] };
  assert.equal(w.s, 2);
  assert.equal(w.hist.length, 2);
  // A word the precondition wrote is guarded too, like any other item.
  const s = item(await sync(''), 'w:好')!.s;
  await sync('', [{ k: 'w:好', v: { s: 3, updated: 3 }, t: 3, if: s }]);
  await sync('', [{ k: 'w:好', v: { s: 4, updated: 4 }, t: 4 }]);
  assert.equal((item(await sync(''), 'w:好')!.v as { s: number }).s, 3);
});

test('a stale precondition writes nothing, the rest of the batch still lands', async () => {
  const { sync } = await account();
  await sync('mio', [{ k: '@mio/keyring', v: { n: 1 }, t: 1, if: 0 }]);
  const r = await sync('mio', [
    { k: '@mio/keyring', v: { n: 2 }, t: 2, if: 0 },
    { k: '@mio/other', v: { n: 3 }, t: 2 },
  ]);
  assert.deepEqual(r.rejected, ['@mio/keyring']);
  const all = await sync('mio');
  assert.deepEqual(item(all, '@mio/keyring')!.v, { n: 1 });
  assert.deepEqual(item(all, '@mio/other')!.v, { n: 3 });
});
