/* The account keyring: one master key and one recovery key for the whole cristianbagrin.com account.
 *
 * Every app that encrypts what it syncs (Money in Order, Ten Dollar Words so far) has its own random data key
 * (DK). The account has one master key (MK, 32 random bytes) that wraps every app's DK, so one password and one
 * recovery key open all of them. The servers only ever hold wrapped keys; MK and the DKs exist only on devices.
 *
 * Where it lives: the synced item `@account/keyring`, read and written with POST /api/sync { app: 'account' }
 * by any app (or the account page). Writes to it must carry `if` (the `s` the item had when it was read, 0 when
 * there was none): the server refuses the write if anyone changed it since, so two apps or devices can't
 * silently replace each other's (see `_sync` in site/worker.js). On a refusal, read it again and start over.
 *
 *   @account/keyring  { v: 1, id, salt, pw: {iv, ct}, rk: {iv, ct}, rkid, created }
 *     id     hex(HKDF(MK, "account/key-id"))[0..16]: which master key this is (app keyrings name it)
 *     pw     AES-256-GCM over MK, key = PBKDF2-SHA256(password NFC, salt 16 random bytes, 600,000 rounds),
 *            additional data "account/keyring/pw"
 *     rk     AES-256-GCM over MK, key = HKDF-SHA256(recovery key bytes, info "account/recovery"),
 *            additional data "account/keyring/rk"
 *     rkid   hex(HKDF(recovery key bytes, "account/recovery-id"))[0..16]: which recovery key opens `rk` (an app
 *            still showing a new key checks it is the current one)
 *     created  when MK was made (ms)
 *   (HKDF everywhere: SHA-256, empty salt. Base64 is standard, with padding. Every iv is 12 random bytes.)
 *
 *   An app's keyring, `@<app>/keyring`, wraps its DK under MK:
 *     { v: 2, mkid: <the account keyring's id>, mk: {iv, ct}, created, ...the app's own fields }
 *     mk     AES-256-GCM over DK, key = HKDF-SHA256(MK, info "<app>/dk-wrap"), additional data "<app>/keyring/mk"
 *
 * The recovery key is 128 random bits, shown as 26 Crockford base32 characters in groups of four
 * (K7QM-2XRA-…); typed in any case, with or without dashes and spaces, O read as 0 and I, L as 1.
 *
 * Rules every app keeps:
 *   - The password goes only to the account service (to sign in). PBKDF2 runs on the device.
 *   - A new MK is made only when `@account/keyring` doesn't exist (or by an explicit "start over" after the
 *     password, the recovery key and every signed-in device are all lost). Show its recovery key once, until the
 *     person says they saved it, and only while `rkid` still matches.
 *   - A password change rewraps `pw` (unwrap with the old password, wrap with the new). After a reset by email
 *     `pw` no longer opens: a device that still holds MK rewraps it silently, otherwise ask for the recovery key.
 *   - A new recovery key replaces `rk` and `rkid`: the old key stops working, in every app.
 *   - Never drop an older wrap of a DK before the MK wrap has been written and read back.
 *
 * Chinese Brain and At Peace don't encrypt their data, so they don't use this. A new app that does: make a DK,
 * wrap it with wrapAppKey under the account's MK, and store it as `@<app>/keyring`.
 *
 * UMD: AccountKeyring in a page (and in an ES module's globalThis), module.exports in CommonJS. WebCrypto only. Money in Order (src/lib/keys.ts) and
 * Ten Dollar Words (app/js/account-keyring.js) carry the same scheme; tests/keyring.test.ts holds a keyring
 * they must all open.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(globalThis.crypto);
  else root.AccountKeyring = factory(root.crypto);
})(typeof self !== 'undefined' ? self : globalThis, function (webcrypto) {
  'use strict';

  const ROUNDS = 600000;
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const utf8 = new TextEncoder();
  const subtle = () => {
    if (!webcrypto || !webcrypto.subtle) throw Object.assign(new Error('This needs a secure (https) page.'), { code: 'insecure' });
    return webcrypto.subtle;
  };
  const random = (n) => webcrypto.getRandomValues(new Uint8Array(n));

  function b64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(s) {
    const bin = atob(String(s));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

  /* ---------- The recovery key, as people read it ---------- */

  function formatRecovery(bytes) {
    let bits = 0, n = 0, out = '';
    for (const b of bytes) {
      bits = (bits << 8) | b; n += 8;
      while (n >= 5) { out += ALPHABET[(bits >>> (n - 5)) & 31]; n -= 5; }
      bits &= (1 << n) - 1;
    }
    if (n > 0) out += ALPHABET[(bits << (5 - n)) & 31];
    return out.match(/.{1,4}/g).join('-');
  }

  /** 16 bytes, or null when the text can't be a recovery key. */
  function parseRecovery(text) {
    const s = String(text || '').toUpperCase().replace(/[\s\-_.]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    if (s.length !== 26) return null;
    const out = new Uint8Array(16);
    let bits = 0, n = 0, k = 0;
    for (const ch of s) {
      const v = ALPHABET.indexOf(ch);
      if (v < 0) return null;
      bits = (bits << 5) | v; n += 5;
      if (n >= 8) { if (k < 16) out[k++] = (bits >>> (n - 8)) & 255; n -= 8; }
      bits &= (1 << n) - 1;
    }
    return k === 16 && bits === 0 ? out : null;
  }

  /* ---------- Keys ---------- */

  async function hkdfBits(secret, info) {
    const base = await subtle().importKey('raw', secret, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: utf8.encode(info) }, base, 256));
  }
  async function hkdfKey(secret, info) {
    const base = await subtle().importKey('raw', secret, 'HKDF', false, ['deriveKey']);
    return subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: utf8.encode(info) }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function passwordKey(password, salt) {
    const base = await subtle().importKey('raw', utf8.encode(String(password).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ROUNDS }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(key, data, label) {
    const iv = random(12);
    const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: utf8.encode(label) }, key, data);
    return { iv: b64(iv), ct: b64(new Uint8Array(ct)) };
  }
  /** The 32 bytes inside, or null when this key doesn't open it. */
  async function open(key, box, label) {
    if (!box || typeof box.iv !== 'string' || typeof box.ct !== 'string') return null;
    try {
      const out = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: unb64(box.iv), additionalData: utf8.encode(label) }, key, unb64(box.ct)));
      return out.length === 32 ? out : null;
    } catch (e) {
      if (e && e.code === 'insecure') throw e;
      return null;
    }
  }

  const keyId = async (mk) => hex(await hkdfBits(mk, 'account/key-id')).slice(0, 16);
  const recoveryId = async (rk) => hex(await hkdfBits(rk, 'account/recovery-id')).slice(0, 16);

  /* ---------- The account keyring ---------- */

  function isRing(r) {
    return !!(r && typeof r === 'object' && r.v === 1 && typeof r.id === 'string' && typeof r.salt === 'string' &&
      r.pw && typeof r.pw.ct === 'string' && r.rk && typeof r.rk.ct === 'string' && typeof r.created === 'number');
  }

  /** A new master key: { mk, recovery: 'K7QM-…', ring }. */
  async function create(password) {
    const mk = random(32);
    const rk = random(16);
    const salt = random(16);
    const [pw, rkBox, id, rkid] = await Promise.all([
      passwordKey(password, salt).then((k) => seal(k, mk, 'account/keyring/pw')),
      hkdfKey(rk, 'account/recovery').then((k) => seal(k, mk, 'account/keyring/rk')),
      keyId(mk),
      recoveryId(rk),
    ]);
    return { mk, recovery: formatRecovery(rk), ring: { v: 1, id, salt: b64(salt), pw, rk: rkBox, rkid, created: Date.now() } };
  }

  /** MK, or null when the password doesn't open it (changed or reset since). */
  async function openWithPassword(ring, password) {
    if (!isRing(ring)) return null;
    const mk = await open(await passwordKey(password, unb64(ring.salt)), ring.pw, 'account/keyring/pw');
    return mk && (await keyId(mk)) === ring.id ? mk : null;
  }

  /** MK, or null when this isn't the account's recovery key. */
  async function openWithRecovery(ring, text) {
    const rk = parseRecovery(text);
    if (!rk || !isRing(ring)) return null;
    const mk = await open(await hkdfKey(rk, 'account/recovery'), ring.rk, 'account/keyring/rk');
    return mk && (await keyId(mk)) === ring.id ? mk : null;
  }

  /** The same keyring, with MK wrapped under a new password (a new salt). */
  async function rewrapPassword(ring, mk, password) {
    const salt = random(16);
    return Object.assign({}, ring, { salt: b64(salt), pw: await seal(await passwordKey(password, salt), mk, 'account/keyring/pw') });
  }

  /** A new recovery key: { recovery, ring }. The old key stops working once this keyring is written. */
  async function newRecovery(ring, mk) {
    const rk = random(16);
    const [box, rkid] = await Promise.all([hkdfKey(rk, 'account/recovery').then((k) => seal(k, mk, 'account/keyring/rk')), recoveryId(rk)]);
    return { recovery: formatRecovery(rk), ring: Object.assign({}, ring, { rk: box, rkid }) };
  }

  /** Whether this recovery key is the one the keyring holds now (without opening anything). */
  async function isCurrentRecovery(ring, text) {
    const rk = parseRecovery(text);
    return !!(rk && isRing(ring) && ring.rkid === (await recoveryId(rk)));
  }

  /* ---------- An app's data key, under MK ---------- */

  async function wrapAppKey(mk, app, dk) {
    return seal(await hkdfKey(mk, app + '/dk-wrap'), dk, app + '/keyring/mk');
  }
  async function unwrapAppKey(mk, app, box) {
    return open(await hkdfKey(mk, app + '/dk-wrap'), box, app + '/keyring/mk');
  }

  return {
    ROUNDS, isRing, create, openWithPassword, openWithRecovery, rewrapPassword, newRecovery, isCurrentRecovery,
    keyId, wrapAppKey, unwrapAppKey, formatRecovery, parseRecovery, b64, unb64,
  };
});
