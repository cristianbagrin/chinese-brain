import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// The account keyring (site/public/acct/keyring.js): one master key for the whole account, wrapped under the
// password and the one recovery key; each app's data key wrapped under it. fixtures/account-keyring.json is a
// keyring every app's copy of the scheme must open (Money in Order and Ten Dollar Words test it too).

await import(new URL('../site/public/acct/keyring.js', import.meta.url).href);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const K = (globalThis as any).AccountKeyring;
const fixture = JSON.parse(readFileSync(new URL('./fixtures/account-keyring.json', import.meta.url), 'utf8'));
const b64 = (u: Uint8Array) => K.b64(u);

test('the shared fixture opens with its password and its recovery key, and gives both apps’ data keys', async () => {
  const mk = await K.openWithPassword(fixture.ring, fixture.password);
  assert.equal(b64(mk), fixture.mk);
  assert.equal(b64(await K.openWithRecovery(fixture.ring, fixture.recovery.toLowerCase().replace(/-/g, ' '))), fixture.mk);
  assert.equal(b64(await K.unwrapAppKey(mk, 'mio', fixture.mio)), fixture.dk);
  assert.equal(b64(await K.unwrapAppKey(mk, 'tdw', fixture.tdw)), fixture.dk);
  // Each app's wrap is its own: the labels keep them apart.
  assert.equal(await K.unwrapAppKey(mk, 'tdw', fixture.mio), null);
  assert.equal(await K.isCurrentRecovery(fixture.ring, fixture.recovery), true);
  assert.equal(await K.keyId(mk), fixture.ring.id);
});

test('a wrong password or recovery key opens nothing', async () => {
  assert.equal(await K.openWithPassword(fixture.ring, 'fixture password'), null);
  assert.equal(await K.openWithRecovery(fixture.ring, K.formatRecovery(new Uint8Array(16))), null);
  assert.equal(await K.openWithRecovery(fixture.ring, 'not a key'), null);
  assert.equal(await K.openWithPassword({ ...fixture.ring, v: 2 }, fixture.password), null);
});

test('a new keyring; a password change and a new recovery key keep the same master key', async () => {
  const made = await K.create('first password');
  assert.match(made.recovery, /^([0-9A-Z]{4}-){6}[0-9A-Z]{2}$/);
  assert.equal(K.isRing(made.ring), true);
  const moved = await K.rewrapPassword(made.ring, made.mk, 'second password');
  assert.equal(await K.openWithPassword(moved, 'first password'), null);
  assert.equal(b64(await K.openWithPassword(moved, 'second password')), b64(made.mk));
  const next = await K.newRecovery(moved, made.mk);
  assert.equal(await K.openWithRecovery(next.ring, made.recovery), null);
  assert.equal(b64(await K.openWithRecovery(next.ring, next.recovery)), b64(made.mk));
  assert.equal(await K.isCurrentRecovery(next.ring, made.recovery), false);
  assert.equal(await K.isCurrentRecovery(next.ring, next.recovery), true);
  assert.equal(next.ring.id, made.ring.id);
});

test('recovery keys read the way people type them', () => {
  const bytes = new Uint8Array(16).map((_, i) => i * 17);
  const text = K.formatRecovery(bytes);
  assert.deepEqual(K.parseRecovery(text), bytes);
  assert.deepEqual(K.parseRecovery(text.toLowerCase().replace(/-/g, '  ')), bytes);
  assert.deepEqual(K.parseRecovery(text.replace(/0/g, 'O').replace(/1/g, 'l')), bytes);
  assert.equal(K.parseRecovery(text.slice(1)), null);
  assert.equal(K.parseRecovery(text.replace(/.$/, 'U')), null);
});
