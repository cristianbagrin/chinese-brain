// Does the CBP engine (site/src/cbp/engine.ts) say exactly what words.py says, on the same files?
//   node --experimental-strip-types scripts/cbp-parity.ts <life/chinese folder> [YYYY-MM-DD ...]
// Works on a copy in a temporary folder (words.py rank and board write files). Prints only differences.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as E from '../site/src/cbp/engine.ts';

/** The engine's Files from a life/chinese folder: the same names the Mac pushes (see scripts/cbp-push.py). */
export function filesFrom(dir: string): E.Files {
  const f: E.Files = new Map();
  const put = (name: string, path: string) => existsSync(path) && f.set(name, readFileSync(path, 'utf8'));
  for (const n of ['known-words.txt', 'learn-next.md', 'test-log.tsv']) put(n, join(dir, n));
  for (const n of readdirSync(dir)) if (n.endsWith('-sprint.md')) put(n, join(dir, n));
  for (const n of readdirSync(join(dir, 'imported'))) if (/^chinese-brain-.*\.tsv$/.test(n)) put('imported/' + n, join(dir, 'imported', n));
  put('data/zh-freq.tsv', join(dir, 'data', 'zh-freq.tsv'));
  put('data/tocfl.tsv', join(dir, 'data', 'tocfl.tsv'));
  const anki = existsSync(join(dir, 'anki')) ? readdirSync(join(dir, 'anki')).filter((n) => /^anki-export-.*\.txt$/.test(n)).map((n) => join(dir, 'anki', n)) : [];
  if (anki.length) put('anki/latest.txt', anki.sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs).at(-1)!);
  put('board/data.json', join(dir, '.db', 'board', 'data.json'));
  return f;
}

function diff(label: string, a: string, b: string) {
  if (a === b) return 0;
  const x = a.split('\n'), y = b.split('\n');
  let shown = 0;
  console.log(`✗ ${label}`);
  for (let i = 0; i < Math.max(x.length, y.length) && shown < 8; i++) {
    if (x[i] !== y[i]) {
      console.log(`  line ${i + 1}\n    words.py: ${x[i]}\n    engine:   ${y[i]}`);
      shown++;
    }
  }
  return 1;
}

const [src, ...dates] = process.argv.slice(2);
if (!src) throw new Error('usage: cbp-parity.ts <life/chinese folder> [dates]');
const today = new Date().toISOString().slice(0, 10);
let bad = 0;
for (const d of dates.length ? dates : [today, E.plus(today, 7), E.plus(today, 30)]) {
  const work = mkdtempSync(join(tmpdir(), 'cbp-parity-'));
  for (const n of readdirSync(src)) {
    if (['graded-readers', 'reference', '__pycache__', 'board'].includes(n)) continue;
    cpSync(join(src, n), join(work, n), { recursive: true });
  }
  const py = (...a: string[]) => execFileSync('python3', [join(work, 'words.py'), '--today', d, ...a], { cwd: work, encoding: 'utf8' });
  const files = filesFrom(work);
  bad += diff(`${d} status`, py('status'), E.statusText(files, d));
  bad += diff(`${d} test`, py('test'), E.testPlanText(files, d));
  bad += diff(`${d} test --all`, py('test', '--all'), E.testPlanText(files, d, true));
  py('board');
  bad += diff(`${d} board/data`, readFileSync(join(work, '.db', 'push.json'), 'utf8'), E.pyJson(E.boardPayload(files, d)));
  const q = E.loadQueue(files);
  E.rank(files, q, d);
  py('rank');
  bad += diff(`${d} learn-next.md`, readFileSync(join(work, 'learn-next.md'), 'utf8'), q.text());
  for (const w of ['任何', '提供', '卻', '揪']) bad += diff(`${d} saved ${w}`, py('saved', w), E.savedSentences(files, w).map((s) => s + '\n').join(''));
  // the commands that change things: card the first Next up word, queue two words, log graded rows
  const first = q.nextUp[0]?.[0] ?? '提供';
  py('card', first);
  E.card(files, first, d);
  const pyIn = (input: string, ...a: string[]) => execFileSync('python3', [join(work, 'words.py'), '--today', d, ...a], { cwd: work, encoding: 'utf8', input });
  pyIn('Life\t揪 · jiū · round people up · Chris\nTaiwan\t任何 · rènhé · any · test\n', 'add');
  E.addWords(files, [['Life', '揪 · jiū · round people up · Chris'], ['Taiwan', '任何 · rènhé · any · test']], d);
  const rows = [{ date: d, target: first, kind: 'new', result: 'pass', note: 'parity' }, { date: d, target: '又 vs 再', kind: 'leak', result: 'fail', note: 'parity' }];
  pyIn(rows.map((r) => [r.date, r.target, r.kind, r.result, r.note].join('\t')).join('\n') + '\n', 'log');
  E.logRows(files, rows);
  const after = filesFrom(work);
  for (const n of ['known-words.txt', 'learn-next.md', 'test-log.tsv', ...E.sprintNames(after)]) bad += diff(`${d} after card/add/log: ${n}`, after.get(n) ?? '', files.get(n) ?? '');
  bad += diff(`${d} status after changes`, py('status'), E.statusText(files, d));
  console.log(`${d}: checked`);
}
console.log(bad ? `${bad} difference(s)` : 'Same answers everywhere.');
process.exit(bad ? 1 : 0);
