// Writes the website's "What's new" page (site/public/brain/whats-new.html) from the version
// notes in store/PUBLISHING.md (section 4), so the page and the store notes can't drift apart.
// `npm run build` runs it. A date after a version ("1.5.0 (November 15, 2026):") is shown.
import { readFileSync, writeFileSync } from 'node:fs';

const md = readFileSync(new URL('../store/PUBLISHING.md', import.meta.url), 'utf8');
const start = md.indexOf('\n## 4. Version notes');
const notes = md.slice(start, md.indexOf('\n## ', start + 1));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const entries = [...notes.matchAll(/\n(\d+\.\d+\.\d+)(?: \(([^)]+)\))?:\s*\n+```\n([\s\S]*?)\n```/g)].map(([, v, date, text]) => ({
  v,
  date,
  items: text.split('\n').map((l) => l.replace(/^•\s*/, '').trim()).filter(Boolean),
}));
if (!entries.length) throw new Error('No version notes found in store/PUBLISHING.md');

const page = readFileSync(new URL('../site/public/brain/guide.html', import.meta.url), 'utf8');
const head = page.slice(0, page.indexOf('<main')).replace(/<title>.*?<\/title>/, "<title>What's new · Chinese Brain</title>").replace(/<meta name="description"[^>]*>\n/, '').replace('/brain/guide"', '/brain/whats-new"');
const foot = page.slice(page.indexOf('<footer>'));
const body = `<main class="wrap doc log">
  <h1>What's new</h1>
  <p class="updated">Chinese Brain updates itself. This is what changed.</p>
${entries.map((e) => `  <section class="topic" id="v${e.v}"><h2>${e.v}${e.date ? ` <small>${esc(e.date)}</small>` : ''}</h2><ul>${e.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`).join('\n')}
</main>
`;
writeFileSync(new URL('../site/public/brain/whats-new.html', import.meta.url), head + body + foot);
