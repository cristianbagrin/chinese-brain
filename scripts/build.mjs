// Bundles the extension into dist/ (load dist/manifest.json in about:debugging).
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const entries = {
  background: 'src/background/index.ts',
  content: 'src/content/index.ts',
  options: 'src/pages/options.ts',
  vocab: 'src/pages/vocab.ts',
  action: 'src/pages/action.ts',
};

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('static', 'dist', { recursive: true });
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('src/manifest.json', 'utf8'));
manifest.version = pkg.version;
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));

const opts = {
  entryPoints: entries,
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'firefox128',
  loader: { '.css': 'text' },
  logLevel: 'info',
  legalComments: 'none',
  minifySyntax: true, // drops the test-only branches from release builds
  // Test builds (CB_TEST=1) add a hook so the browser tests can open extension pages.
  define: { __TEST__: JSON.stringify(!!process.env.CB_TEST) },
};
if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
} else {
  await esbuild.build(opts);
}
