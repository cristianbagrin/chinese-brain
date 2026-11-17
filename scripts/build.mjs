// Bundles the extension twice from the same sources:
//   dist/         Firefox (MV2): load dist/manifest.json in about:debugging.
//   dist-chrome/  Chrome (MV3): chrome://extensions -> Developer mode -> Load unpacked.
// and the website's dashboard script (site/public/brain/dashboard.js) from site/src/.
// `__CHROME__` is a build-time constant, so each bundle keeps only its own code paths.
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Dictionary } from '../src/shared/dict.ts';
import { numberedToMarked } from '../src/shared/pinyin.ts';

const watch = process.argv.includes('--watch');
const entries = {
  background: 'src/background/index.ts',
  content: 'src/content/index.ts',
  early: 'src/content/early.ts',
  options: 'src/pages/options.ts',
  action: 'src/pages/action.ts',
};

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('src/manifest.json', 'utf8'));
manifest.version = pkg.version;

function prepare(dir, extraStatic) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync('static', dir, { recursive: true });
  if (extraStatic) cpSync(extraStatic, dir, { recursive: true });
}

const common = {
  bundle: true,
  format: 'iife',
  loader: { '.css': 'text' },
  logLevel: 'info',
  legalComments: 'none',
  minifySyntax: true, // drops the test-only branches from release builds
};
// Test builds (CB_TEST=1) add a hook so the browser tests can open extension pages.
// CB_SITE points a test build at a local copy of the website and account service (site/).
const define = (chrome) => ({
  __TEST__: JSON.stringify(!!process.env.CB_TEST),
  __CHROME__: JSON.stringify(chrome),
  __SITE__: JSON.stringify(process.env.CB_SITE || 'https://chinese.cristianbagrin.com'),
});

// Firefox.
prepare('dist');
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
const firefox = { ...common, entryPoints: entries, outdir: 'dist', target: 'firefox128', define: define(false) };

// Chrome.
prepare('dist-chrome', 'static-chrome');
writeFileSync('dist-chrome/manifest.json', JSON.stringify(chromeManifest(manifest), null, 2));
const chrome = {
  ...common,
  entryPoints: { ...entries, ytrelay: 'src/platform/yt-relay.ts' },
  outdir: 'dist-chrome',
  target: 'chrome128',
  define: define(true),
  // `browser.*` in the sources becomes Mozilla's promise polyfill over `chrome.*`.
  inject: ['src/platform/browser-shim.ts'],
};
// The YouTube page hook runs in the page's own world: no extension APIs, no polyfill.
const chromeHook = { ...common, entryPoints: { ythook: 'src/platform/yt-hook.ts' }, outdir: 'dist-chrome', target: 'chrome128', define: define(true) };

// The website's scripts share the extension's code (export formats, sentences, sounds), so they
// are bundled here too: the word list (dashboard.js) and every page's site.js, with the demo card.
// Their output is committed: Cloudflare deploys site/ as it is.
cpSync('static/fonts', 'site/public/fonts', { recursive: true });
const site = { ...common, entryPoints: { dashboard: 'site/src/dashboard.ts' }, outdir: 'site/public/brain', target: 'es2020', define: define(false) };

const pages = { ...site, entryPoints: { site: 'site/src/site.ts' }, outdir: 'site/public' };

writeFileSync('site/public/brain/demo.json', demoData(readFileSync('site/public/brain.html', 'utf8')));

const builds = [firefox, chrome, chromeHook, site, pages];
if (watch) {
  for (const opts of builds) await (await esbuild.context(opts)).watch();
} else {
  await Promise.all(builds.map((opts) => esbuild.build(opts)));
}

/** The Chrome (MV3) manifest, made from the Firefox one so the two can't drift apart. */
function chromeManifest(ff) {
  const icons = { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' };
  const permissions = ff.permissions
    .filter((p) => !['webRequest', 'webRequestBlocking', '<all_urls>'].includes(p))
    .map((p) => (p === 'menus' ? 'contextMenus' : p));
  const youtube = ['*://*.youtube.com/*'];
  const out = {
    manifest_version: 3,
    name: ff.name,
    version: ff.version,
    description: ff.description,
    minimum_chrome_version: '128', // document.caretPositionFromPoint
    icons,
    permissions: [...permissions, 'scripting'],
    host_permissions: ['<all_urls>'],
    background: { service_worker: 'background.js' },
    content_scripts: [
      // Copies the caption tracks the YouTube player downloads (Firefox: webRequest.filterResponseData).
      { matches: youtube, js: ['ythook.js'], run_at: 'document_start', world: 'MAIN' },
      { matches: youtube, js: ['ytrelay.js'], run_at: 'document_start' },
      ...ff.content_scripts,
    ],
    action: { default_icon: icons, default_title: ff.browser_action.default_title, default_popup: ff.browser_action.default_popup },
    options_ui: ff.options_ui,
    commands: ff.commands,
  };
  return out;
}


/**
 * The words in the home page's Chinese, looked up the way the extension does (its dictionary,
 * static/data/dict.tsv.gz, and its word splitting), so the try-it player and paragraph show what
 * the extension would. site.js loads it when they scroll into view:
 * { words: { 夜市: [pinyin, meaning, bars (0-5), parts] }, phrases: { sentence: English } }.
 * Sentences pair with their English as data-zh/data-en, or <span data-en="English">中文</span>.
 */
function demoData(html) {
  const dict = Dictionary.fromTsv(gunzipSync(readFileSync('static/data/dict.tsv.gz')).toString('utf8'));
  // The reading these sentences use, where the dictionary's first entry is another one.
  const READ = { 便宜: 'pian2 yi5', 那: 'na4', 吧: 'ba5' };
  const read = (e) => (e.tw || e.py).toLowerCase();
  const sense = (e) => {
    const defs = e.defs.filter((d) => !/^CL:|^(old )?variant of|^see /i.test(d)).map((d) => d.replace(/\|[^\s\[]+/g, '').replace(/\[([a-zA-Z0-9: ]+)\]/g, (_, p) => ` ${numberedToMarked(p)}`).replace(/^\(Tw\)\s*/, ''));
    const two = defs.slice(0, 2).join('; ');
    const one = defs[0] ?? '';
    return two.length <= 50 ? two : one.length <= 60 ? one : `${one.split(/;\s*/)[0]}`;
  };
  const bars = (z) => (z >= 52 ? 5 : z >= 45 ? 4 : z >= 40 ? 3 : z >= 33 ? 2 : z >= 1 ? 1 : 0);
  const clean = (t) => t.replace(/[，。！？、：；「」\s]/g, '');
  const unescape = (t) => t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const words = {};
  const phrases = {};
  for (const m of html.matchAll(/data-zh="([^"]+)" data-en="([^"]+)"|<span data-en="([^"]+)">([^<]+)<\/span>/g)) {
    phrases[clean(m[1] ?? m[4])] = unescape(m[2] ?? m[3]);
  }
  for (const run of html.match(/[一-鿿，。！？]+/g) ?? []) {
    for (const t of dict.segment(run)) {
      if (!t.word || words[t.text]) continue;
      const all = dict.get(t.text);
      const e = all.find((x) => read(x) === READ[t.text]) ?? all[0];
      const syls = (e.tw || e.py).split(/\s+/);
      const chars = [...t.text];
      const parts =
        chars.length > 1 && chars.length === syls.length
          ? chars.map((ch, k) => {
              const c = dict.charEntry(ch, syls[k]);
              const s = c ? sense(c).split(/;\s*/)[0] : '';
              return [ch, numberedToMarked(syls[k]), s.length > 36 ? `${s.slice(0, 34).trimEnd()}…` : s];
            })
          : undefined;
      const zipf = Math.max(...all.map((x) => x.zipf));
      words[t.text] = [numberedToMarked(e.tw || e.py), sense(e), bars(zipf), ...(parts ? [parts] : [])];
    }
  }
  return `${JSON.stringify({ words, phrases })}\n`;
}
