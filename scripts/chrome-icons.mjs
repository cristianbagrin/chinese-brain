// Renders static/icons/icon.svg to the PNG icons Chrome's manifest needs (it can't use SVG):
// static-chrome/icons/icon-{16,32,48,128}.png. Run after changing the SVG: node scripts/chrome-icons.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const svg = readFileSync('static/icons/icon.svg', 'utf8');
mkdirSync('static-chrome/icons', { recursive: true });
const browser = await chromium.launch();
try {
  for (const size of [16, 32, 48, 128]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    writeFileSync(`static-chrome/icons/icon-${size}.png`, await page.screenshot({ omitBackground: true }));
    await page.close();
  }
} finally {
  await browser.close();
}
console.log('static-chrome/icons: 16, 32, 48, 128');
