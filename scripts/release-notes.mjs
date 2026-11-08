// Prints the AMO metadata for a version (its notes from store/PUBLISHING.md, section 4, and
// the notes to reviewer, section 5) as JSON, for `web-ext sign --amo-metadata`.
// Usage: node scripts/release-notes.mjs [version] [--text]
import { readFileSync } from 'node:fs';

const md = readFileSync(new URL('../store/PUBLISHING.md', import.meta.url), 'utf8');
const version = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const section = (title) => {
  const start = md.indexOf(`\n## ${title}`);
  if (start < 0) throw new Error(`No "## ${title}" in PUBLISHING.md`);
  const end = md.indexOf('\n## ', start + 1);
  return md.slice(start, end < 0 ? undefined : end);
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const notes = section('4. Version notes').match(new RegExp(`\\n${esc(version)}:\\s*\\n+\`\`\`\\n([\\s\\S]*?)\\n\`\`\``))?.[1];
if (!notes) {
  console.error(`No version notes for ${version} in store/PUBLISHING.md (section 4). Add them before releasing.`);
  process.exit(1);
}
if (process.argv.includes('--text')) {
  console.log(notes);
} else {
  const reviewer = section('5. Notes to reviewer').match(/```\n([\s\S]*?)\n```/)?.[1] ?? '';
  console.log(JSON.stringify({ version: { release_notes: { 'en-US': notes }, approval_notes: reviewer } }, null, 2));
}
