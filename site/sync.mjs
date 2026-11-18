// Shows the changes Chris made at chinese.cristianbagrin.com/edit, and which no longer apply.
//
//   node site/sync.mjs            list every edit: the page, the words it replaced, the new words
//   node site/sync.mjs --apply    also write the text edits into the pages in site/public
//   node site/sync.mjs --prune    drop the edits that no longer apply (needs EDIT_KEY=… in the environment)
//   --from http://localhost:8790  read another copy of the site (a local `npx wrangler dev`)
//
// Edits stay in the site's database and the Worker puts them into the pages as they're served, so
// they survive every deploy. Each one is tied to the words it replaced (src/copy.ts): once those
// change in the source, the edit no longer finds its place and the page shows the source. So run
// this before changing a page's words by hand, and fold any edit you'd overwrite into the source.
// After --apply, deploy, then --prune: the applied edits no longer apply (the source has their words).
// Node 23.6 or newer (it reads src/copy.ts as is); on Node 22 add --experimental-strip-types.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { annotate, PAGES } from './src/copy.ts';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const from = (args.includes('--from') ? args[args.indexOf('--from') + 1] : 'https://chinese.cristianbagrin.com').replace(/\/$/, '');
const fileOf = (asset) => join(here, 'public', `${asset}.html`);
const plain = (html) => (html ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const label = (page) => PAGES.find((p) => p[1] === page)?.[0] ?? page;

const res = await fetch(`${from}/api/copy`, { headers: { 'User-Agent': 'chinesebrain-sync' } });
if (!res.ok) throw new Error(`${from}/api/copy: ${res.status}`);
const { edits } = await res.json();
const names = Object.keys(edits);
if (!names.length) {
  console.log('No edits on the site.');
  process.exit(0);
}

// Every page as it is in the source now, with its words named the way the Worker names them.
const files = PAGES.map(([, , asset]) => {
  const file = fileOf(asset);
  const html = readFileSync(file, 'utf8');
  return { file, html, a: annotate(html) };
});
const where = (k) => files.filter((f) => Object.hasOwn(f.a.texts, k) || f.a.blocks.includes(k));

const stale = [];
for (const k of names) {
  const e = edits[k];
  const found = where(k);
  console.log(`\n${label(e.page)} (${e.page}), ${new Date(e.at).toISOString().slice(0, 16).replace('T', ' ')}`);
  if (!found.length) {
    stale.push(k);
    console.log('  NO LONGER APPLIES: its words changed in the source, so the site shows the source.');
  }
  console.log(`  was: ${plain(e.was) || '(a block)'}`);
  if (e.gone) console.log('  now: removed');
  if (e.to !== undefined) console.log(`  now: ${plain(e.to)}${e.to !== plain(e.to) ? `\n  html: ${e.to}` : ''}`);
  if (found.length) console.log(`  in: ${found.map((f) => relative(process.cwd(), f.file)).join(', ')}  [${k}]`);
}
console.log(`\n${names.length} ${names.length === 1 ? 'edit' : 'edits'}, ${stale.length} no longer ${stale.length === 1 ? 'applies' : 'apply'}.`);

if (args.includes('--apply')) {
  let n = 0;
  for (const f of files) {
    // From the end of the page back, so earlier positions stay right.
    const spans = names.filter((k) => edits[k].to !== undefined && f.a.spans[k]).map((k) => [...f.a.spans[k], edits[k].to]).sort((x, y) => y[0] - x[0]);
    let html = f.html;
    for (const [a, b, to] of spans) html = html.slice(0, a) + to + html.slice(b);
    if (spans.length) {
      writeFileSync(f.file, html);
      n += spans.length;
    }
  }
  const removed = names.filter((k) => edits[k].gone && where(k).length);
  console.log(`\nWrote ${n} text ${n === 1 ? 'edit' : 'edits'} into site/public.${removed.length ? ` Removals to make by hand (search for the words above): ${removed.length}.` : ''}`);
  console.log('Check the pages, commit and deploy, then run with --prune to clear the edits that are now in the source.');
}

if (args.includes('--prune')) {
  if (!stale.length) process.exit(0);
  if (!process.env.EDIT_KEY) throw new Error('Set EDIT_KEY (the /edit password) to prune.');
  const changes = Object.fromEntries(stale.flatMap((k) => [[k, null], [`-${k}`, null]]));
  const r = await fetch(`${from}/api/copy`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Edit-Key': process.env.EDIT_KEY }, body: JSON.stringify({ page: '/brain', changes }) });
  console.log(r.ok ? `\nCleared ${stale.length} that no longer ${stale.length === 1 ? 'applies' : 'apply'}.` : `\nNot cleared: ${r.status} ${await r.text()}`);
}
