// Smoke test of the Chrome build in headless Chromium (Playwright):
//   node scripts/chrome-smoke.mjs [dist-chrome] [screenshot-dir]
// Checks: the service worker starts without errors, the context-menu item exists, hover
// lookup opens the card on tests/fixtures/page.html and 1/2/3 stamp the word, the options,
// word-list and toolbar pages load, and the YouTube mock (tests/youtube-mock) gets our
// subtitles through the MAIN-world caption hook.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(require.resolve('playwright', { paths: [process.env.NODE_PATH ?? '', '/opt/node-tools/node_modules'] })));
}

const ext = resolve(process.argv[2] ?? 'dist-chrome');
const shots = process.argv[3] ? resolve(process.argv[3]) : '';
if (shots) mkdirSync(shots, { recursive: true });
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The test page, over http://localhost.
const fixture = readFileSync('tests/fixtures/page.html');
const web = createServer((_, res) => res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(fixture));
await new Promise((r) => web.listen(0, '127.0.0.1', r));
const webUrl = `http://localhost:${web.address().port}/page.html`;

// The YouTube stand-in; www.youtube.com is routed to it below.
const ytPort = 18800 + Math.floor(Math.random() * 1000);
const yt = spawn('python3', ['tests/youtube-mock/server.py', String(ytPort)], { stdio: ['ignore', 'pipe', 'inherit'] });
let ytLog = '';
yt.stdout.on('data', (d) => (ytLog += d));

const profile = mkdtempSync(join(tmpdir(), 'cb-chrome-'));
const context = await chromium.launchPersistentContext(profile, {
  // The full Chromium (not the headless shell, which can't load extensions), in its new headless mode.
  channel: 'chromium',
  headless: true,
  args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const errors = [];
context.on('weberror', (e) => errors.push(`page: ${e.error().message}`));

try {
  // Service worker.
  let [sw] = context.serviceWorkers();
  sw ??= await context.waitForEvent('serviceworker', { timeout: 15000 });
  const swErrors = [];
  sw.on('console', (m) => m.type() === 'error' && swErrors.push(m.text()));
  const id = new URL(sw.url()).host;
  ok('service worker starts', /background\.js$/.test(sw.url()), sw.url());
  const menu = await sw.evaluate(
    () => new Promise((r) => setTimeout(() => chrome.contextMenus.update('cb-lookup', {}, () => r(chrome.runtime.lastError?.message ?? 'ok')), 500)),
  );
  ok('context-menu item registered', menu === 'ok', menu);

  // Hover lookup and the 1/2/3 shortcuts.
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`page console: ${m.text()}`));
  await page.goto(webUrl);
  await page.waitForFunction(() => document.querySelector('chinese-brain-popup') || document.readyState === 'complete');
  await sleep(1500); // the dictionary loads in the worker
  const word = '捷運';
  const at = await page.evaluate((w) => {
    const p = document.getElementById('p1').firstChild;
    const i = p.data.indexOf(w);
    const r = document.createRange();
    r.setStart(p, i);
    r.setEnd(p, i + 1);
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, word);
  // The card lives in a closed shadow root: it is showing when the page finds its host just above or below the word.
  const cardShown = () =>
    page.evaluate(({ x, y }) => [60, 100, -60, -100].some((dy) => document.elementFromPoint(x, y + dy)?.tagName === 'CHINESE-BRAIN-POPUP'), at);
  let shown = false;
  for (let i = 0; i < 10 && !shown; i++) {
    await page.mouse.move(10, 10); // blank margin: no other word on the way
    await page.mouse.move(at.x, at.y, { steps: 5 });
    for (let j = 0; j < 10 && !shown; j++) {
      await sleep(200);
      shown = await cardShown();
    }
  }
  if (shots) await page.screenshot({ path: join(shots, 'hover.png') });
  ok('hover lookup shows the card', shown);
  const statusOf = () => sw.evaluate((w) => chrome.storage.local.get('w:' + w).then((r) => r['w:' + w]?.s ?? null), word);
  for (const [key, want] of [['1', 'fresh'], ['2', 'learning'], ['3', 'known']]) {
    await page.keyboard.press(key);
    let got = null;
    for (let i = 0; i < 20 && got !== want; i++) {
      await sleep(150);
      got = await statusOf();
    }
    ok(`key ${key} stamps ${word} ${want}`, got === want, `stored: ${got}`);
  }
  if (shots) await page.screenshot({ path: join(shots, 'stamped.png') });

  // Extension pages.
  for (const name of ['options', 'vocab', 'action']) {
    const p = await context.newPage();
    const pageErrors = [];
    p.on('pageerror', (e) => pageErrors.push(e.message));
    await p.goto(`chrome-extension://${id}/${name}.html`);
    await sleep(1500);
    const text = (await p.evaluate(() => document.body.innerText)).trim();
    if (shots) await p.screenshot({ path: join(shots, `${name}.png`), fullPage: name !== 'action' });
    ok(`${name} page opens`, !pageErrors.length && text.length > 20, pageErrors.join('; ') || `${text.length} chars`);
    if (name === 'vocab') {
      await p.getByText('Known', { exact: true }).first().click();
      await sleep(500);
      ok(`word list shows ${word} under Known`, (await p.evaluate(() => document.body.innerText)).includes(word));
    }
    if (name === 'options') {
      // Audio comes back as base64 on Chrome (its messages are JSON); needs translate.google.com.
      const tts = await p.evaluate(() => chrome.runtime.sendMessage({ type: 'tts', engine: 'google', text: '你好' }));
      if (tts?.error) console.log(`SKIP  Google voice (${tts.error})`);
      else {
        const decoded = await p.evaluate(async (b64) => {
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          return (await new AudioContext().decodeAudioData(bytes.buffer)).duration;
        }, tts.audio);
        ok('Google voice audio arrives as base64 and decodes', decoded > 0.2, `${tts.audio.length} chars, ${decoded.toFixed(2)} s`);
      }
    }
    await p.close();
  }

  // The worker is stopped (Chrome does this after 30 idle seconds): lookups still work.
  await sw.evaluate(() => (self.__smokeMarker = 1));
  const cdp = await context.newCDPSession(page);
  await cdp.send('ServiceWorker.enable');
  await cdp.send('ServiceWorker.stopAllWorkers');
  await sleep(1000);
  await page.keyboard.press('Escape');
  const probe = await context.newPage();
  await probe.goto(`chrome-extension://${id}/options.html`);
  const after = await probe.evaluate(() => chrome.runtime.sendMessage({ type: 'lookup', text: '泡麵' }));
  const rec = await probe.evaluate((w) => chrome.runtime.sendMessage({ type: 'getWord', word: w }), word);
  ok('after the worker restarts: lookup and word store work', after?.[0]?.word === '泡麵' && rec?.s === 'known', `${after?.[0]?.word}, ${rec?.s}`);
  await probe.close();
  [sw] = context.serviceWorkers();
  ok('the worker really was restarted', (await sw.evaluate(() => self.__smokeMarker ?? null)) === null);
  sw.on('console', (m) => m.type() === 'error' && swErrors.push(m.text()));

  // YouTube: subtitles from captions captured by the MAIN-world hook.
  await context.route(/^https:\/\/www\.youtube\.com\//, async (route) => {
    const u = new URL(route.request().url());
    try {
      const res = await fetch(`http://127.0.0.1:${ytPort}${u.pathname}${u.search}`);
      await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
    } catch {
      await route.abort();
    }
  });
  const ytPage = await context.newPage();
  ytPage.on('console', (m) => m.type() === 'error' && !/v\.webm|Failed to load resource/.test(m.text()) && errors.push(`yt console: ${m.text()}`));
  await ytPage.goto('https://www.youtube.com/watch?v=TEST');
  const subsOn = await ytPage
    .waitForFunction(() => document.documentElement.classList.contains('cb-subs-on'), null, { timeout: 15000 })
    .then(() => true, () => false);
  ok('YouTube mock: player asked for the Chinese track (setOption via page hook)', await ytPage.evaluate(() => (window.__setOption ?? []).some((t) => t.includes('zh'))));
  ok('YouTube mock: timedtext fetched', /TIMEDTEXT .*lang=zh/.test(ytLog));
  ok('YouTube mock: our subtitles are on', subsOn);
  await sleep(1500);
  const nativeHidden = await ytPage.evaluate(() => getComputedStyle(document.querySelector('.ytp-caption-window-container')).display === 'none');
  ok('YouTube mock: native captions hidden (scripting.insertCSS)', nativeHidden);
  const trFetched = /TIMEDTEXT .*tlang=en/.test(ytLog);
  ok('YouTube mock: English translation track fetched', trFetched);
  if (shots) await ytPage.screenshot({ path: join(shots, 'youtube.png') });

  ok('no service-worker errors', !swErrors.length, swErrors.join(' | '));
  ok('no page errors', !errors.length, errors.join(' | '));
} finally {
  await context.close();
  yt.kill();
  web.close();
  rmSync(profile, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.pass).length;
console.log(failed ? `\n${failed} of ${results.length} checks failed` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
