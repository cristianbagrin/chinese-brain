// Account and sync, end to end, in two headless Chromium profiles (two "browsers"):
//   1. in site/:  npx wrangler dev --port 8799
//   2. CB_TEST=1 CB_SITE=http://127.0.0.1:8799 npm run build
//   3. node scripts/sync-check.mjs [screenshot-dir]      (then `npm run build` again for a release build)
// Checks: create an account in Settings, a stamped word reaches the second browser, a word
// changed in both keeps the later status and both sentences, removing a word removes it
// there too, API keys stay local, and signing out keeps the words.
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(require.resolve('playwright', { paths: [process.env.NODE_PATH ?? '', '/opt/node-tools/node_modules'] })));
}
const ext = resolve('dist-chrome');
const shots = process.argv[2] ? resolve(process.argv[2]) : '';
if (shots) mkdirSync(shots, { recursive: true });
let failed = 0;
const ok = (name, pass, detail = '') => {
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const email = `sync${Date.now()}@test.co`;

async function browserWith() {
  const dir = mkdtempSync(join(tmpdir(), 'cb-sync-'));
  const context = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  let [sw] = context.serviceWorkers();
  sw ??= await context.waitForEvent('serviceworker', { timeout: 15000 });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1000, height: 1100 });
  await page.goto(`chrome-extension://${new URL(sw.url()).host}/options.html`);
  await page.waitForSelector('#acct:not([hidden])');
  const send = (msg) => page.evaluate((m) => chrome.runtime.sendMessage(m), msg);
  const get = (k) => page.evaluate((key) => chrome.storage.local.get(key).then((r) => r[key] ?? null), k);
  return { context, page, send, get, dir, close: () => context.close().then(() => rmSync(dir, { recursive: true, force: true })) };
}
const ctx = (text) => ({ text, url: 'https://example.com/', at: Date.now(), src: 'web' });

const a = await browserWith();
const b = await browserWith();
try {
  // Browser A: two words, then a new account.
  await a.send({ type: 'setStatus', word: '捷運', status: 'fresh', ctx: ctx('臺北的捷運很方便。') });
  await a.send({ type: 'setStatus', word: '夜市', status: 'known' });
  await a.send({ type: 'saveSettings', settings: { geminiKey: 'secret-key', subFontSize: 36 } });
  if (shots) await a.page.screenshot({ path: join(shots, 'settings-signed-out.png'), fullPage: true });
  await a.page.fill('#email', email);
  await a.page.fill('#password', 'correct horse');
  await a.page.click('#signUp');
  await a.page.waitForSelector('#signedIn:not([hidden])', { timeout: 15000 });
  await a.page.waitForFunction(() => /Synced/.test(document.getElementById('acctSync').textContent));
  ok('create account in Settings', (await a.page.textContent('#acctEmail')) === email, await a.page.textContent('#acctSync'));
  if (shots) await a.page.screenshot({ path: join(shots, 'settings-signed-in.png'), fullPage: true });

  // Browser B: a wrong password, then sign in; A's words and settings arrive, the API key doesn't.
  await b.send({ type: 'setStatus', word: '珍珠奶茶', status: 'learning' });
  await b.page.fill('#email', email);
  await b.page.fill('#password', 'wrong password');
  await b.page.click('#signIn');
  await b.page.waitForFunction(() => document.getElementById('acctStatus').textContent.includes('match'));
  ok('wrong password is refused', true, await b.page.textContent('#acctStatus'));
  await b.page.fill('#password', 'correct horse');
  await b.page.click('#signIn');
  await b.page.waitForSelector('#signedIn:not([hidden])', { timeout: 15000 });
  await b.page.waitForFunction(() => /Synced/.test(document.getElementById('acctSync').textContent));
  ok('words reach the second browser', (await b.get('w:捷運'))?.s === 'fresh' && (await b.get('w:夜市'))?.s === 'known');
  const statuses = await b.send({ type: 'statuses' });
  ok('…and its live word list', statuses['捷運'] === 'fresh', JSON.stringify(statuses));
  const sb = await b.get('settings');
  ok('settings sync, API keys stay local', sb?.subFontSize === 36 && !sb?.geminiKey, `size ${sb?.subFontSize}, key "${sb?.geminiKey}"`);
  await a.send({ type: 'syncNow' });
  ok('the second browser’s word reaches the first', (await a.get('w:珍珠奶茶'))?.s === 'learning');
  ok('the first browser keeps its API key', (await a.get('settings'))?.geminiKey === 'secret-key');

  // The same word changed in both before either syncs: later status, both sentences.
  await a.send({ type: 'setStatus', word: '捷運', status: 'learning', ctx: ctx('我每天搭捷運上班。') });
  await new Promise((r) => setTimeout(r, 50));
  await b.send({ type: 'setStatus', word: '捷運', status: 'known', ctx: ctx('捷運站在哪裡？') });
  await a.send({ type: 'syncNow' });
  await b.send({ type: 'syncNow' });
  await a.send({ type: 'syncNow' });
  const [wa, wb] = [await a.get('w:捷運'), await b.get('w:捷運')];
  ok('a word changed in both: later status wins', wa.s === 'known' && wb.s === 'known', `${wa.s} / ${wb.s}`);
  ok('…and both browsers keep every sentence', wa.ctx.length === 3 && wb.ctx.length === 3, `${wa.ctx.length} / ${wb.ctx.length}`);

  // Removing a word removes it everywhere.
  await b.send({ type: 'setStatus', word: '夜市', status: null });
  await b.send({ type: 'syncNow' });
  await a.send({ type: 'syncNow' });
  ok('a removed word is removed in the other browser', (await a.get('w:夜市')) === null && !(await a.send({ type: 'statuses' }))['夜市']);

  // Signing out keeps this browser's words.
  await b.page.click('#signOut');
  await b.page.waitForSelector('#signedOut:not([hidden])');
  ok('signing out keeps the words here', (await b.get('w:捷運'))?.s === 'known' && (await b.get('acct')) === null);
  if (shots) {
    const id = new URL(a.page.url()).host;
    await a.page.goto(`chrome-extension://${id}/action.html`);
    await a.page.setViewportSize({ width: 330, height: 640 });
    await a.page.waitForTimeout(500);
    await a.page.screenshot({ path: join(shots, 'menu.png') });
  }
} catch (e) {
  ok('ran to the end', false, String(e));
} finally {
  await a.close();
  await b.close();
}
process.exit(failed ? 1 : 0);
