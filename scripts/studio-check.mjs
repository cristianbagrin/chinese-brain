import { createRequire } from 'node:module'; const { chromium } = createRequire(process.cwd() + '/')('playwright');
// Checks the card inside a modal dialog that traps focus (like YouTube Studio's upload dialog):
// tests/fixtures/studio.html in Chromium with dist-chrome loaded. Run: node scripts/studio-check.mjs
import { createServer } from 'node:http';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = process.cwd();
const ext = join(root, 'dist-chrome');
const html = readFileSync(join(root, 'tests/fixtures/studio.html'));
const web = createServer((_, res) => res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html));
await new Promise((r) => web.listen(0, '127.0.0.1', r));
const url = `http://localhost:${web.address().port}/studio.html`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'cbs-')), { channel: 'chromium', headless: true, args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
let [sw] = ctx.serviceWorkers(); sw ??= await ctx.waitForEvent('serviceworker');
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(url); await sleep(2000);
const desc = await page.$('#desc');
await desc.click(); await page.keyboard.press('End'); await page.keyboard.type('abc');
const word = '朋友';
const at = await page.evaluate((w) => { const t = document.getElementById('desc').firstChild; const i = t.data.indexOf(w); const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1); const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, word);
let host = false;
for (let i = 0; i < 10 && !host; i++) { await page.mouse.move(5, 5); await page.mouse.move(at.x, at.y, { steps: 5 }); await sleep(1200); host = await page.evaluate(() => document.querySelector('chinese-brain-popup')?.parentElement?.id ?? null); }
console.log('card host parent:', host);
const cdp = await ctx.newCDPSession(page);
async function find(cls) {
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const out = [];
  const walk = (n) => { const a = n.attributes ?? []; const c = a[a.indexOf('class') + 1]; if (a.includes('class') && c?.split(' ').includes(cls)) out.push(n); for (const k of [...(n.children ?? []), ...(n.shadowRoots ?? [])]) walk(k); };
  walk(root); return out;
}
async function center(n) { const { model } = await cdp.send('DOM.getBoxModel', { backendNodeId: n.backendNodeId }); const q = model.content; return { x: (q[0] + q[4]) / 2, y: (q[1] + q[5]) / 2 }; }
// Pointer on the card, a word in the card: press 2 → no "2" in the description
const edits = await find('edit');
console.log('edit buttons:', edits.length);
const p = await center(edits[0]);
await page.mouse.move(p.x, p.y, { steps: 8 }); await sleep(300);
const before = await page.$eval('#desc', (d) => d.textContent);
await page.keyboard.press('2'); await sleep(500);
const after = await page.$eval('#desc', (d) => d.textContent);
const st = await sw.evaluate((w) => chrome.storage.local.get('w:' + w).then((r) => r['w:' + w]?.s ?? null), word);
console.log('digit went to description:', before !== after, 'status:', st);
await page.mouse.click(p.x, p.y); await sleep(500);
await page.keyboard.press('End'); await page.keyboard.type('XYZ'); await sleep(300);
console.log('desc after typing in editor:', await page.$eval('#desc', (d) => d.textContent));
console.log('host typing:', await page.evaluate(() => [document.querySelector('chinese-brain-popup')?.hasAttribute('data-typing'), document.activeElement?.tagName])); console.log('stolen focus count:', await page.evaluate(() => window.stolen ?? 0));
await page.keyboard.press('Escape'); await sleep(300);
console.log('dialog closed by Esc:', await page.evaluate(() => window.closedByEsc));
await page.screenshot({ path: join(tmpdir(), 'studio.png') });
// now edit and save with Enter
const e2 = await find('edit'); const p2 = await center(e2[0]);
await page.mouse.click(p2.x, p2.y); await sleep(400);
await page.keyboard.press('End'); await page.keyboard.type('！'); await page.keyboard.press('Enter'); await sleep(800);
console.log('store:', JSON.stringify(await sw.evaluate(() => chrome.storage.local.get(null).then((r) => Object.fromEntries(Object.entries(r).filter(([k]) => /^(w|sav):/.test(k))))))); console.log('desc end:', await page.$eval('#desc', (d) => d.textContent), await page.evaluate(() => [document.querySelector('chinese-brain-popup')?.hasAttribute('data-typing'), document.activeElement?.tagName]));
await ctx.close(); web.close();
