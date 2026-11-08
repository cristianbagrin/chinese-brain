// Bundles the extension twice from the same sources:
//   dist/         Firefox (MV2): load dist/manifest.json in about:debugging.
//   dist-chrome/  Chrome (MV3): chrome://extensions -> Developer mode -> Load unpacked.
// `__CHROME__` is a build-time constant, so each bundle keeps only its own code paths.
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const entries = {
  background: 'src/background/index.ts',
  content: 'src/content/index.ts',
  early: 'src/content/early.ts',
  options: 'src/pages/options.ts',
  vocab: 'src/pages/vocab.ts',
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
const define = (chrome) => ({ __TEST__: JSON.stringify(!!process.env.CB_TEST), __CHROME__: JSON.stringify(chrome) });

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

const builds = [firefox, chrome, chromeHook];
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
